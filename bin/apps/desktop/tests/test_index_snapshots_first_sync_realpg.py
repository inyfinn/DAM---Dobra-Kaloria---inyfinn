# -*- coding: utf-8 -*-
"""07.10.2026: pierwsze pobranie katalogu z bazy na komputerze bez zadnych plikow (instalator nie
pakuje spisu) - zachowanie na PRAWDZIWEJ bazie dam_eta_test (schemat jednorazowy t_*, rola testowa).

Baza jest prawdziwa (publish_index_snapshot, index_snapshot_meta, fetch_index_snapshot to realny SQL).
"Baza niedostepna" to prawdziwy blad polaczenia (psycopg2 do portu, na ktorym nikt nie slucha), nie
atrapa. Atrapa jest tylko ZEGAR petli (SnapshotLoop/FirstSyncRetry dostaja zegar testu, zeby 40 s
niedostepnosci nie trwalo 40 s).

Uruchomienie (bez DAM_TEST_PG_DSN testy sa pomijane):
    python ~/.claude/mcp/dam-pg/test_dsn.py -- python -m pytest tests/test_index_snapshots_first_sync_realpg.py
"""
from __future__ import annotations

import hashlib
import inspect
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
DESKTOP = HERE.parent
for _p in (str(DESKTOP), str(HERE)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import index_snapshots as ix  # noqa: E402

KEYS = ("file-index", "search-index", "branding-search-index", "campaigns")


def _payload(key: str, n: int = 1) -> bytes:
    return json.dumps({"key": key, "n": n, "pad": "x" * 1200}).encode("utf-8")


class _Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


class _RealPG(unittest.TestCase):
    def setUp(self):
        import psycopg2  # noqa: PLC0415
        import psycopg2.extras  # noqa: PLC0415
        import realpg  # noqa: PLC0415

        admin_dsn = realpg.require(self)
        cm = realpg.fresh_db(admin_dsn)
        self.dsn = cm.__enter__()
        self.addCleanup(cm.__exit__, None, None, None)
        self._psycopg2 = psycopg2
        self._extras = psycopg2.extras
        self.outage = False
        self.connects: list[float] = []   # zegar testu w chwili kazdej proby polaczenia (udanej i nie)
        self.timeouts: list = []          # limit polaczenia zadany przez wolajacego (None = domyslny pg_db)
        self.clock = _Clock()

        import pg_db  # noqa: PLC0415

        self.pg_db = pg_db
        p = mock.patch.object(pg_db, "connect", self._connect)
        p.start()
        self.addCleanup(p.stop)

        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.data = self.base / "data"
        self.data.mkdir()
        self.state_dir = self.base / "state"
        p2 = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p2.start()
        self.addCleanup(p2.stop)

        ix._FIRST_SYNC.update(done=False, ok=None, started_at="", finished_at="", attempts=0,
                              last_error="", next_retry_at="")
        ix._LAST.clear()
        ix._ROWS_MODE_CACHE.update(value=False, at=0.0)
        import index_authority  # noqa: PLC0415

        index_authority._CACHE.update(at=0.0, value=None, raw={}, error="")
        self.addCleanup(lambda: index_authority._CACHE.update(at=0.0, value=None, raw={}, error=""))

    # -- baza ---------------------------------------------------------------
    def _connect(self, timeout=None):
        self.connects.append(self.clock.t)
        self.timeouts.append(timeout)
        if self.outage:
            # prawdziwy blad sieci: nikt nie slucha na porcie 1 (natychmiastowe "connection refused")
            return self._psycopg2.connect(host="127.0.0.1", port=1, dbname="x", user="x", password="x",
                                          connect_timeout=2)
        return self._psycopg2.connect(self.dsn, cursor_factory=self._extras.RealDictCursor, connect_timeout=10)

    def publish(self, key: str, n: int = 1, built_by: str = "TEST-A") -> dict:
        raw = _payload(key, n)
        return self.pg_db.publish_index_snapshot(
            key, raw, sha256=hashlib.sha256(raw).hexdigest(),
            built_at="2026-09-01T00:00:00+00:00", built_by=built_by)

    def seed_all(self, n: int = 1):
        for k in KEYS:
            self.publish(k, n)

    def snapshot_rows(self) -> dict:
        conn = self._connect()
        try:
            cur = conn.cursor()
            cur.execute("SELECT store_key, sha256, generation, published_at FROM dam_index_snapshots ORDER BY 1")
            return {r["store_key"]: (r["sha256"], r["generation"], r["published_at"]) for r in cur.fetchall()}
        finally:
            conn.close()

    # -- petla ----------------------------------------------------------------
    def make_loop(self, root_alive=lambda: False):
        def cycle(why):
            ix._cycle_safe(self.data, root_alive, None, why)

        retry = ix.FirstSyncRetry(lambda: ix.retry_first_pull(self.data, root_alive, None), clock=self.clock)
        return ix.SnapshotLoop(self.data, run_cycle=cycle, remote_watch=None, clock=self.clock,
                               first_retry=retry)

    def run_ticks(self, loop, seconds: int, step: float = 1.0):
        for _ in range(seconds):
            self.clock.t += step
            loop.tick()

    def local_files(self) -> set[str]:
        return {p.name for p in self.data.iterdir() if p.suffix == ".json"}

    # -- lista publikujacych (index_authority) na prawdziwej bazie ------------------
    def set_machines(self, machines) -> None:
        conn = self._connect()
        try:
            cur = conn.cursor()
            cur.execute("INSERT INTO dam_meta (key, value) VALUES ('index_authority', %s) "
                        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                        (json.dumps({"machines": machines}),))
            conn.commit()
        finally:
            conn.close()

    @staticmethod
    def forget_authority_cache() -> None:
        import index_authority  # noqa: PLC0415

        index_authority._CACHE.update(at=0.0, value=None, raw={}, error="")

    def as_machine(self, name: str) -> None:
        import index_authority  # noqa: PLC0415

        p = mock.patch.object(index_authority, "current_machine", return_value=name)
        p.start()
        self.addCleanup(p.stop)

    def real_decision_loop(self, root_alive=lambda: True):
        """Petla z PRAWDZIWA decyzja listy (index_authority.may_publish na tej bazie), nie z domyslnym
        None z procesu testow (ix._authority_decision pomija baze, gdy w sys.modules jest unittest)."""
        import index_authority  # noqa: PLC0415

        p = mock.patch.object(ix, "_authority_decision",
                              side_effect=lambda: index_authority.may_publish(self.pg_db.connect))
        p.start()
        self.addCleanup(p.stop)
        return self.make_loop(root_alive)

    def build_locally(self, tag: str) -> bytes:
        path = self.data / "file-index.json"
        path.write_bytes(json.dumps({"key": "file-index", "lokalny": tag}).encode("utf-8") + b" " * 1200)
        ix.mark_built_here("file-index", path)
        return path.read_bytes()


class FirstSyncOnRealDbTests(_RealPG):
    def test_pierwsza_proba_pada_druga_po_5_s_sie_udaje(self):
        self.seed_all()
        rows_before = self.snapshot_rows()
        loop = self.make_loop()
        self.outage = True
        self.assertEqual(loop.tick(), "first")           # pierwszy cykl: baza niedostepna
        fs = ix.status()["first_sync"]
        self.assertTrue(fs["done"])
        self.assertIs(fs["ok"], False)
        self.assertTrue(fs["last_error"])
        last_at_1 = ix.status()["last"]["at"]
        self.assertEqual(ix._LAST["publish"]["skipped"], "db_unreachable")  # nie laczymy sie jeszcze raz po publikacje
        self.assertEqual(self.local_files(), set())
        self.outage = False
        n_before = len(self.connects)
        self.run_ticks(loop, 4)                           # 4 s po porazce: jeszcze cisza
        self.assertEqual(len(self.connects), n_before)
        self.run_ticks(loop, 1)                           # 5 s po porazce: ponowienie
        self.assertGreater(len(self.connects), n_before)
        st = ix.status()
        self.assertIs(st["first_sync"]["ok"], True)
        self.assertEqual(st["first_sync"]["next_retry_at"], "")
        self.assertEqual(st["last"]["why"], "first_sync_retry")
        self.assertNotEqual(st["last"]["at"], last_at_1)  # last.at zmienione po probie
        self.assertEqual(self.local_files(), {"file-index.json", "search-index.json",
                                              "branding-search-index.json", "campaigns.json"})
        self.assertEqual(self.snapshot_rows(), rows_before)  # ponowienie niczego nie opublikowalo

    def test_ponowienie_nie_budzi_publikacji_nawet_gdy_jest_co_publikowac(self):
        """Komputer ze swiezym lokalnym skanem (zbudowany tu, wlasciciel/brak listy) i dostepnym ROOT:
        zwykly cykl opublikowalby go; ponowienie pierwszego pobrania robi tylko pull."""
        self.seed_all(n=1)
        rows_before = self.snapshot_rows()
        local = self.data / "file-index.json"
        local.write_text(json.dumps({"key": "file-index", "n": 99, "pad": "y" * 1200}), encoding="utf-8")
        ix.mark_built_here("file-index", local)
        loop = self.make_loop(root_alive=lambda: True)
        self.outage = True
        loop.tick()
        self.outage = False
        self.run_ticks(loop, 6)
        self.assertIs(ix.status()["first_sync"]["ok"], True)
        self.assertEqual(ix._LAST["publish"], {"ok": True, "skipped": "first_sync_retry"})
        self.assertEqual(self.snapshot_rows(), rows_before)

    def test_baza_wraca_po_40_s(self):
        self.seed_all()
        loop = self.make_loop()
        self.outage = True
        loop.tick()
        t0 = self.clock.t
        failed_at: list[float] = []
        last_ats = [ix.status()["last"]["at"]]
        for _ in range(39):
            self.clock.t += 1.0
            n = len(self.connects)
            loop.tick()
            if len(self.connects) > n:
                failed_at.append(self.clock.t - t0)
                last_ats.append(ix.status()["last"]["at"])
        # proby co 5 s: 5, 10, ..., 35 s od porazki (kazda to jedno nieudane polaczenie)
        self.assertEqual(failed_at, [5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 35.0])
        self.assertEqual(len(set(last_ats)), len(last_ats), "last.at ma sie zmieniac po kazdej probie")
        self.assertIs(ix.status()["first_sync"]["ok"], False)
        self.outage = False                                # 40 s: baza wraca
        self.run_ticks(loop, 6)
        self.assertIs(ix.status()["first_sync"]["ok"], True)
        self.assertEqual(len(self.local_files()), 4)
        # po sukcesie: zadnych dodatkowych pytan do bazy (poza zwyklym cyklem co REFRESH_S)
        n_after = len(self.connects)
        self.run_ticks(loop, 300)
        self.assertEqual(len(self.connects), n_after)

    def test_pusta_baza_nie_zapetla_ponawiania(self):
        loop = self.make_loop()                           # baza dostepna, ale bez ani jednej migawki
        self.assertEqual(loop.tick(), "first")
        pull = ix._LAST["pull"]
        self.assertTrue(pull["ok"])
        self.assertEqual(sorted(pull["missing_in_db"]), sorted(k for k in ix.SNAPSHOT_FILES))
        self.assertIs(ix.status()["first_sync"]["ok"], True)   # baza odpowiedziala: to nie porazka
        n = len(self.connects)
        self.run_ticks(loop, 200)
        self.assertEqual(len(self.connects), n)
        self.assertEqual(self.local_files(), set())

    def test_limit_polaczenia_dluzszy_tylko_do_pierwszego_sukcesu(self):
        """Do pierwszego udanego pobrania kazde polaczenie (meta, lista wlascicieli, tryb rows,
        tresc migawek) dostaje FIRST_SYNC_CONNECT_TIMEOUT_S - o ile pg_db ma parametr `timeout`
        (propozycja spec/pg_db-timeout.diff); bez niego None (domyslne limity pg_db). Po sukcesie
        zwykle cykle jada na domyslnych limitach."""
        supports = "timeout" in inspect.signature(self.pg_db.index_snapshot_meta).parameters
        expected = ix.FIRST_SYNC_CONNECT_TIMEOUT_S if supports else None
        self.seed_all()
        self.timeouts.clear()
        ix.run_once(self.data, lambda: False)                  # pierwsze pobranie
        first = list(self.timeouts)
        self.assertGreaterEqual(len(first), 4)                 # meta, wlasciciele, tryb rows, tresci
        self.assertEqual(first[0], expected)                   # meta: przez pg_db.index_snapshot_meta
        # lista wlascicieli i tryb rows ida przez _connector(pg_db.connect), ktory w tescie MA parametr timeout
        self.assertIn(ix.FIRST_SYNC_CONNECT_TIMEOUT_S, first)
        if supports:                                            # pg_db z parametrem: kazde polaczenie, takze tresc migawek
            self.assertEqual(set(first), {ix.FIRST_SYNC_CONNECT_TIMEOUT_S})
        self.assertIs(ix.status()["first_sync"]["ok"], True)
        self.timeouts.clear()
        ix.run_once(self.data, lambda: False)                  # po sukcesie: zwykly cykl
        self.assertTrue(self.timeouts)
        self.assertEqual(set(self.timeouts), {None})

    def test_zwykly_start_bez_dodatkowych_pytan_do_bazy(self):
        """Pliki lokalne rowne bazie, baza dostepna: ta sama liczba polaczen co goly run_once,
        a po nim zadnych."""
        self.seed_all()
        for k in KEYS:
            (self.data / ix.SNAPSHOT_FILES[k]).write_bytes(_payload(k, 1))

        def reset():
            ix._FIRST_SYNC.update(done=False, ok=None, started_at="", finished_at="", attempts=0,
                                  last_error="", next_retry_at="")
            ix._LAST.clear()
            ix._ROWS_MODE_CACHE.update(value=False, at=0.0)
            import index_authority  # noqa: PLC0415

            index_authority._CACHE.update(at=0.0, value=None, raw={}, error="")
            (self.state_dir / "index-snapshots.json").unlink(missing_ok=True)

        reset()
        self.connects.clear()
        ix.run_once(self.data, lambda: False)
        baseline = len(self.connects)
        self.assertGreater(baseline, 0)

        reset()
        self.connects.clear()
        loop = self.make_loop()
        self.assertEqual(loop.tick(), "first")
        self.assertEqual(len(self.connects), baseline)     # warstwa ponowien nie dolozyla ani jednego zapytania
        self.run_ticks(loop, 300)
        self.assertEqual(len(self.connects), baseline)
        self.assertIs(ix.status()["first_sync"]["ok"], True)


class AuthorityUnknownOnRealDbTests(_RealPG):
    """07.10.2026: lista publikujacych nieznana = "nie wiem" = "nie wolno" (ekran pokazuje baze)."""

    def test_swiezy_komputer_przy_niedostepnej_bazie_ma_lokalny_skan_potem_baza_wygrywa(self):
        self.seed_all()
        rows_before = self.snapshot_rows()
        self.as_machine("TEST-FRESH")
        loop = self.real_decision_loop()
        self.outage = True
        local = self.build_locally("skan swiezego komputera")
        loop.tick()                                       # pierwszy cykl: baza niedostepna, lista nieznana
        self.assertEqual((self.data / "file-index.json").read_bytes(), local)   # jedyne dane, jakie sa
        self.assertEqual(ix._LAST["publish"]["skipped"], "db_unreachable")
        self.assertEqual(ix.publish_changed(self.data, root_alive=True),
                         {"ok": True, "skipped": "authority_unknown"})          # nie publikuje
        self.outage = False                               # baza wraca; w bazie wciaz brak listy (None)
        self.run_ticks(loop, 5)                           # ponowienie pierwszego pobrania
        self.assertIs(ix.status()["first_sync"]["ok"], True)
        self.assertEqual((self.data / "file-index.json").read_bytes(), _payload("file-index"))
        self.assertNotEqual((self.data / "file-index.json").read_bytes(), local)  # stan bazy, nie lokalny skan
        self.assertEqual(ix._LAST["pull"]["authority"], "unknown")
        self.assertEqual(self.snapshot_rows(), rows_before)                      # niczego nie opublikowano

    def test_wlasciciel_z_zapamietana_lista_przy_niedostepnej_bazie_dziala_jak_dzis(self):
        import index_authority  # noqa: PLC0415

        self.seed_all()
        self.as_machine("TEST-OWNER")
        self.set_machines(["TEST-OWNER"])
        self.assertIs(index_authority.may_publish(self.pg_db.connect, force=True), True)   # zapis pliku stanu
        self.assertTrue((self.state_dir / "index-authority.json").is_file())
        self.forget_authority_cache()                    # "restart mostu": pamiec pusta, zostaje plik stanu
        self.outage = True                               # a baza niedostepna
        loop = self.real_decision_loop()
        loop.tick()                                      # pierwszy cykl (baza nie odpowiada)
        local = self.build_locally("nowszy build wlasciciela")
        self.run_ticks(loop, 4)                          # debounce + decyzja z pliku stanu (True)
        self.assertEqual(ix._LAST["why"], "local_build")          # wyzwalacz NIE czeka na baze
        self.assertEqual((self.data / "file-index.json").read_bytes(), local)   # jego nowszy build zostaje
        self.assertIs(index_authority.may_publish(self.pg_db.connect), True)
        self.outage = False                              # powrot bazy
        self.forget_authority_cache()                    # minal TTL (60 s) listy
        self.clock.t += ix.REFRESH_S + 1
        loop.tick()                                      # cykl "interval": pobranie + publikacja
        self.assertEqual(ix._LAST["why"], "interval")
        self.assertEqual(ix._LAST["publish"]["published"], ["file-index"])
        self.assertEqual(self.snapshot_rows()["file-index"][0], hashlib.sha256(local).hexdigest())
        self.assertEqual((self.data / "file-index.json").read_bytes(), local)

    def test_lista_nieznana_odklada_local_build_a_po_poznaniu_listy_baza_wygrywa(self):
        self.seed_all()
        rows_before = self.snapshot_rows()
        self.as_machine("TEST-OTHER")
        loop = self.real_decision_loop()
        loop.tick()                                      # baza dostepna, ale bez listy: pobranie wersji z bazy
        self.assertEqual(ix._LAST["why"], "first")
        self.assertEqual((self.data / "file-index.json").read_bytes(), _payload("file-index"))
        local = self.build_locally("lokalny skan")
        self.run_ticks(loop, 30)                         # lista wciaz nieznana: wyzwalacz odlozony, plik lokalny
        self.assertEqual(ix._LAST["why"], "first")
        self.assertEqual((self.data / "file-index.json").read_bytes(), local)
        self.set_machines(["TEST-OWNER"])                # admin ustawia liste; TEST-OTHER nie jest na niej
        self.forget_authority_cache()
        self.run_ticks(loop, 4)
        self.assertEqual(ix._LAST["why"], "local_build")  # odlozony wyzwalacz ruszyl
        self.assertEqual((self.data / "file-index.json").read_bytes(), _payload("file-index"))
        self.assertEqual(self.snapshot_rows(), rows_before)


if __name__ == "__main__":
    unittest.main()
