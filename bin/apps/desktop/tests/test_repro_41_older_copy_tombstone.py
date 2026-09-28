# -*- coding: utf-8 -*-
"""Audyt 4.1 (P0): starsza lokalna kopia usuwa nowsza wersje V2 (tombstone).

Scenariusz z planu naprawy: M i X widzialy V1; M wysyla V2; na X lokalna V1
znika (Synology Drive w trakcie podmiany); X pobiera V2 z bazy i robi diff.
W 2.4.5 X wysylal tombstone i V2 byla oznaczana jako usunieta - last_seen byl
samym zbiorem id, a SQL usuwal kazda wersje z mtime <= "znany" (czyli V2 z pull).

Kontrakty (work/kierownicy/2026-09-28b/DECYZJE.md): O - obserwacja wersji,
T - tombstone tylko DOKLADNIE zaobserwowanej wersji, G - generacja ROOT.

Baza: domyslnie atrapa w procesie (FakePG z test_asset_sync.py: SQLite wykonuje
TE SAME zapytania SQL modulu). Prawdziwy testowy PostgreSQL tylko przez
tests/realpg.py (W1), gdy modul istnieje i ustawiono DAM_TEST_PG_DSN - zadnego
domyslnego hosta, zadnego zapisu konfiguracji polaczenia. Decyzja wlasciciela
28.09: brak testowej bazy - integracja z prawdziwym PG NIEWYKONANA.

Pliki tymczasowe runnera: w D:\\DAM-lokalne\\testclients\\W2 (gdy istnieje) albo
DAM_W2_TEST_DIR; sprzatane pojedynczo (bez rekurencyjnego kasowania).
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import asset_repo  # noqa: E402
import asset_sync  # noqa: E402
import asset_sync_runner  # noqa: E402
from test_asset_sync import FakePG  # noqa: E402


# --------------------------------------------------------------------------
# Baza: atrapa albo realpg (W1)
# --------------------------------------------------------------------------

class _FakeDB(FakePG):
    """FakePG + dam_meta (znacznik trybu dla runnera) + close() jak polaczenie."""

    def __init__(self):
        super().__init__()
        self.conn.execute("CREATE TABLE IF NOT EXISTS dam_meta (key TEXT PRIMARY KEY, value TEXT)")
        self.conn.execute("INSERT OR REPLACE INTO dam_meta(key, value) VALUES ('asset_index_mode', 'rows')")
        self.conn.commit()

    def close(self):  # run_once zamyka polaczenie po cyklu - atrapa zyje dalej
        pass


def backend_name() -> str:
    try:
        import realpg  # noqa: F401, PLC0415 - W1: tests/realpg.py
    except ImportError:
        return "fake"
    return "realpg" if os.environ.get("DAM_TEST_PG_DSN") else "fake"


def make_db(test_case: unittest.TestCase):
    """Nowa, pusta baza na test. realpg (W1): require(test_case) zwraca DSN albo
    pomija test; fresh_db(dsn) to menedzer kontekstu z osobna baza na test.
    Schemat zaklada kod aplikacji (ensure_schema). Bez realpg: atrapa w procesie."""
    if backend_name() == "realpg":
        import psycopg2  # noqa: PLC0415
        import psycopg2.extras  # noqa: PLC0415
        import realpg  # noqa: PLC0415

        admin_dsn = realpg.require(test_case)
        cm = realpg.fresh_db(admin_dsn)
        test_dsn = cm.__enter__()
        test_case.addCleanup(cm.__exit__, None, None, None)
        got = psycopg2.connect(test_dsn, cursor_factory=psycopg2.extras.RealDictCursor)
        test_case.addCleanup(got.close)
        assert asset_sync.ensure_schema(got)["ok"]
        cur = got.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS dam_meta (key TEXT PRIMARY KEY, value TEXT)")
        cur.execute("INSERT INTO dam_meta(key, value) VALUES ('asset_index_mode', 'rows') "
                    "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value")
        got.commit()
        return _NoClose(got)
    return _FakeDB()


class _NoClose:
    """run_once zamyka polaczenie po cyklu - w tescie to samo polaczenie sluzy
    kolejnym cyklom, zamyka je dopiero addCleanup."""

    def __init__(self, conn):
        self._conn = conn

    def close(self):
        pass

    def __getattr__(self, name):
        return getattr(self._conn, name)


def db_row(pg, rel: str) -> dict | None:
    aid = asset_sync.id_of(asset_sync.key_of(rel))
    cur = pg.cursor()
    cur.execute("SELECT asset_id, size, mtime_ms, deleted_at, rev, meta, updated_by "
                "FROM dam_assets WHERE asset_id = %s", (aid,))
    row = cur.fetchone()
    pg.commit()
    if row is None:
        return None
    row = dict(row)
    if isinstance(row.get("meta"), (str, bytes)):
        row["meta"] = json.loads(row["meta"])
    return row


def db_max_rev(pg) -> int:
    cur = pg.cursor()
    cur.execute("SELECT COALESCE(MAX(rev), 0) AS m FROM dam_assets")
    row = cur.fetchone()
    pg.commit()
    return int(row["m"] if hasattr(row, "keys") else row[0])


# --------------------------------------------------------------------------
# Klient z dyskiem (jak Machine w test_asset_sync, meta per plik)
# --------------------------------------------------------------------------

class Client:
    """Komputer z lokalnym lustrem bazy i dyskiem: rel -> (size, mtime_ms, meta)."""

    def __init__(self, name: str, root: str | None, disk: dict | None = None):
        self.name = name
        self.root = root
        self.disk: dict[str, tuple] = dict(disk or {})
        self.rows: dict = {}
        self.last_seen = None
        self.failed: set[str] = set()
        self.clock = 50_000_000
        self.last: dict | None = None

    def scan(self):
        scan, dirs = {}, {""}
        for rel, spec in self.disk.items():
            size, mt = spec[0], spec[1]
            meta = dict(spec[2]) if len(spec) > 2 else {"sku": "6300576"}
            key = asset_sync.key_of(rel)
            if any(key == f or key.startswith(f + "/") for f in self.failed):
                continue
            parts = key.split("/")
            for i in range(1, len(parts)):
                d = "/".join(parts[:i])
                if not any(d == f or d.startswith(f + "/") for f in self.failed):
                    dirs.add(d)
            aid, entry = asset_sync.scan_entry(f"{self.root}/{rel}", size=size, mtime_ms=mt,
                                               root=self.root, meta=meta)
            scan[aid] = entry
        return scan, dirs

    def sync(self, pg) -> dict:
        self.clock += 1000
        if self.root is None:
            res = asset_sync.sync_cycle(pg, self.rows, machine=self.name)
        else:
            scan, dirs = self.scan()
            res = asset_sync.sync_cycle(
                pg, self.rows, scan=scan, scanned_dirs=dirs, failed_dirs=self.failed,
                last_seen=self.last_seen, scan_time_ms=self.clock, machine=self.name,
                now_ms=self.clock)
        self.rows = res["rows"]
        if res["ok"]:
            self.last_seen = res["next_last_seen"]
        self.last = res
        return res

    def ops(self, kind: str | None = None) -> list:
        ops = ((self.last or {}).get("report") or {}).get("ops", [])
        return [o for o in ops if kind is None or o["op"] == kind]

    def applied(self) -> int:
        return int(((self.last or {}).get("push") or {}).get("applied") or 0)

    def live(self) -> set[str]:
        return {e["path"] for e in asset_sync.live_entries(self.rows)}


FOLDER = "- POLSKA/1 - PRODUKTY/Klopsiki 6300576/4 - WIZKI"
F = f"{FOLDER}/wiz-05.png"
V1 = (1005, 1_000_000)
V2 = (2222, 2_000_000)


def _disk() -> dict:
    d = {f"{FOLDER}/wiz-{i:02d}.png": (1000 + i, 1_000_000) for i in range(12)}
    for k in range(4):
        d.update({f"- POLSKA/1 - PRODUKTY/Inny {k}/4 - WIZKI/wiz-{i:02d}.png": (1000 + i, 1_000_000)
                  for i in range(12)})
    return d


# --------------------------------------------------------------------------
# Katalog roboczy testu (bez rekurencyjnego kasowania)
# --------------------------------------------------------------------------

def _test_base() -> str | None:
    env = os.environ.get("DAM_W2_TEST_DIR")
    if env:
        return env
    d = Path(r"D:\DAM-lokalne\testclients\W2")
    return str(d) if d.is_dir() else None


class _WorkDir:
    def __init__(self):
        self.path = Path(tempfile.mkdtemp(prefix="w2-", dir=_test_base()))

    def cleanup(self):
        for p in sorted(self.path.rglob("*"), key=lambda x: len(x.parts), reverse=True):
            try:
                if p.is_file():
                    p.unlink()
                else:
                    p.rmdir()
            except OSError:
                pass
        try:
            self.path.rmdir()
        except OSError:
            pass


# --------------------------------------------------------------------------
# Testy
# --------------------------------------------------------------------------

class Repro41Tests(unittest.TestCase):
    def setUp(self):
        self.pg = make_db(self)
        self.m = Client("M-FIRMA", "M:", _disk())
        self.x = Client("X-DOM", "X:/Marketing", _disk())
        self.c = Client("C-BEZROOT", None)
        self.m.sync(self.pg)
        self.x.sync(self.pg)          # M i X widzialy V1

    def test_older_local_copy_does_not_tombstone_newer_v2(self):
        """Rdzen audytu 4.1: V2 z M zostaje aktywna, gdy na X znika V1."""
        self.m.disk[F] = V2
        self.m.sync(self.pg)
        self.assertEqual(db_row(self.pg, F)["mtime_ms"], V2[1])
        del self.x.disk[F]            # Drive podmienia plik: V1 zniknela, V2 jeszcze nie ma
        self.assertGreater(self.x.clock + 1000, V2[1])   # skan X pozniej niz zapis V2
        self.x.sync(self.pg)
        row = db_row(self.pg, F)
        self.assertEqual(self.x.ops("tombstone"), [], "X wyslal tombstone dla V2")
        self.assertIsNone(row["deleted_at"], "V2 oznaczona jako usunieta przez starsza kopie")
        self.assertEqual((row["size"], row["mtime_ms"]), V2)
        # Drive dogania: V2 na X - zero operacji, V2 dalej aktywna
        self.x.disk[F] = V2
        self.x.sync(self.pg)
        self.assertEqual(self.x.ops(), [])
        self.c.sync(self.pg)
        self.assertIn(F, self.c.live())

    def test_tombstone_sql_requires_exact_observed_version(self):
        """SQL (kontrakt T): tombstone niesie wersje zaobserwowana; baza z inna
        wersja (V2 zapisana miedzy pull a push) odmawia."""
        self.m.disk[F] = V2
        self.m.sync(self.pg)
        self.x.sync(self.pg)                         # X pobral V2 do lustra (nadal ma V1 na dysku)
        aid = asset_sync.id_of(asset_sync.key_of(F))
        prev = self.x.rows[aid]
        self.assertEqual(prev["mtime_ms"], V2[1])
        op = asset_sync._op(asset_sync.OP_TOMBSTONE, aid, {}, prev, "X-DOM", 99_000_000, "missing")
        op["obs_mtime_ms"], op["obs_size"] = V1[1], V1[0]   # X widzial na dysku V1
        res = asset_sync.push_ops(self.pg, [op], now_ms=1)
        self.assertEqual((res["ok"], res["applied"], res["refused"]), (True, 0, 1))
        self.assertIsNone(db_row(self.pg, F)["deleted_at"])

    def test_old_copy_does_not_resurrect_tombstone(self):
        """V1 znika na X (V2 z M), M usuwa V2, stara V1 wraca na X: bez wskrzeszenia."""
        self.m.disk[F] = V2
        self.m.sync(self.pg)
        del self.x.disk[F]
        self.x.sync(self.pg)
        del self.m.disk[F]                           # prawdziwe usuniecie V2 na M
        self.m.sync(self.pg)
        self.assertIsNotNone(db_row(self.pg, F)["deleted_at"])
        self.x.disk[F] = V1                          # stara kopia wraca (np. z kosza Drive)
        self.x.sync(self.pg)
        self.assertEqual([o["op"] for o in self.x.ops()], [], "stara V1 wskrzesila usuniety plik")
        self.assertIsNotNone(db_row(self.pg, F)["deleted_at"])

    def test_unreachable_share_and_failed_dirs_delete_nothing(self):
        before = db_max_rev(self.pg)
        self.x.failed = {asset_sync.key_of(FOLDER)}     # folder nie wylistowany
        self.x.sync(self.pg)
        self.assertEqual(self.x.ops("tombstone"), [])
        # udzial odlaczony: pusty skan, nic nie wylistowane
        res = asset_sync.sync_cycle(self.pg, self.x.rows, scan={}, scanned_dirs=set(),
                                    last_seen=self.x.last_seen, scan_time_ms=99_000_000,
                                    machine="X-DOM", now_ms=99_000_000)
        self.assertTrue(res["ok"])
        self.assertEqual([o for o in res["report"]["ops"] if o["op"] == "tombstone"], [])
        self.assertEqual(db_max_rev(self.pg), before)

    def test_real_delete_of_observed_version_reaches_second_client(self):
        del self.m.disk[F]
        self.m.clock = 90_000_000
        self.m.sync(self.pg)
        self.assertEqual(len(self.m.ops("tombstone")), 1)
        self.assertIsNotNone(db_row(self.pg, F)["deleted_at"])
        self.c.sync(self.pg)
        self.assertNotIn(F, self.c.live())
        self.x.sync(self.pg)                          # X ma jeszcze plik - nie wskrzesza
        self.assertEqual(self.x.ops(), [])
        self.assertNotIn(F, self.x.live())


class Migration41Tests(unittest.TestCase):
    """v1 -> v2: stan 2.4.5 (last_seen = lista id) + plik zniknal z dysku.
    Pierwszy cykl nowego kodu nic nie usuwa i nie wysyla samego opisu."""

    ROOT = "X:/Marketing"

    def setUp(self):
        self.pg = make_db(self)
        self.work = _WorkDir()
        self.addCleanup(self.work.cleanup)
        self.data_dir = self.work.path / "data"
        self.data_dir.mkdir()
        self.db_path = self.work.path / "dam-local.sqlite"
        p = patch("index_authority.may_publish", return_value=None)
        p.start()
        self.addCleanup(p.stop)
        # M publikuje katalog (ten sam dysk)
        self.m = Client("M-FIRMA", "M:", _disk())
        self.m.sync(self.pg)
        # Stan X z 2.4.5: lustro wierszy + last_seen v1 (wszystkie id)
        conn = sqlite3.connect(str(self.db_path))
        try:
            asset_repo.ensure_local(conn)
            rows = asset_sync.apply_remote({}, asset_sync.pull_since(self.pg, 0)["rows"])
            asset_repo.save_rows(conn, rows)
            asset_repo.save_last_seen(conn, list(rows))
            asset_repo.set_state(conn, "asset_sync_last_scan_time_ms", "1")
        finally:
            conn.close()

    def _write_scan(self, disk: dict, scan_time: int, *, root: str | None = None, meta=None):
        assets = [{"path": f"{self.ROOT}/{rel}", "size_bytes": s, "mtime_ms": mt,
                   **(meta or {"sku": "6300576"})} for rel, (s, mt) in disk.items()]
        (self.data_dir / "branding-index.scan.json").write_text(
            json.dumps({"assets": assets}), encoding="utf-8")
        (self.data_dir / "branding-scan-dirs.json").write_text(json.dumps({
            "version": 1, "scan_time_ms": scan_time, "root": root or self.ROOT,
            "scanned_dirs": sorted({a for r in disk
                                    for a in asset_sync._ancestors(asset_sync.key_of(r))}),
            "failed_dirs": []}), encoding="utf-8")

    def _run(self):
        return asset_sync_runner.run_once(
            self.db_path, self.data_dir, root_alive=True, root_path=self.ROOT,
            machine="X-DOM", pg_connect=lambda: self.pg, on_index_written=None)

    def test_v1_to_v2_first_cycle_deletes_nothing_and_sends_no_meta(self):
        disk = _disk()
        del disk[F]                                    # plik zniknal lokalnie
        before = db_max_rev(self.pg)
        self._write_scan(disk, 60_000_000, meta={"sku": "INNY-OPIS"})  # inne fakty niz w bazie
        res = self._run()
        self.assertTrue(res["ok"], res)
        self.assertTrue(res["did_scan"])
        self.assertIsNone(db_row(self.pg, F)["deleted_at"], "migracja v1->v2 usunela plik")
        self.assertEqual(db_max_rev(self.pg), before, "pierwszy cykl po migracji zapisal do bazy")
        conn = sqlite3.connect(str(self.db_path))
        try:
            v2 = json.loads(asset_repo.get_state(conn, "last_seen_v2"))
            v1 = json.loads(asset_repo.get_state(conn, "last_seen"))
        finally:
            conn.close()
        self.assertEqual(sorted(v2["obs"]), sorted(v1))   # stary klucz nadal pisany (2.4.5)
        aid = next(iter(k for k in v2["obs"] if v2["obs"][k].get("mtime_ms")))
        self.assertIn("desc", v2["obs"][aid])

    def test_manifest_from_other_root_is_not_a_scan(self):
        """Kontrakt G: manifest z innym ROOT (skan sprzed przelaczenia) = nie skan."""
        disk = _disk()
        del disk[F]
        self._write_scan(disk, 60_000_000, root="M:/")
        res = self._run()
        self.assertTrue(res["ok"], res)
        self.assertFalse(res["did_scan"])
        self.assertTrue(res.get("manifest_root_mismatch"))

    def test_root_generation_change_drops_observations_for_one_cycle(self):
        """Obserwacje v2 z innym ROOT: pierwszy skan jak po reset_scan_memory."""
        disk = _disk()
        self._write_scan(disk, 60_000_000)
        self.assertTrue(self._run()["ok"])             # obserwacje v2 na X:/Marketing
        del disk[F]
        self._write_scan(disk, 61_000_000)
        with patch.object(asset_sync_runner, "current_root_gen", return_value="7|x:/marketing",
                          create=True):
            res = self._run()
        self.assertTrue(res["ok"], res)
        self.assertTrue(res.get("root_gen_changed"))
        self.assertIsNone(db_row(self.pg, F)["deleted_at"])
        # nastepny cykl w tej samej generacji: obserwacja jest, usuniecie przechodzi
        disk2 = dict(disk)
        disk2[F] = V1
        self._write_scan(disk2, 62_000_000)
        with patch.object(asset_sync_runner, "current_root_gen", return_value="7|x:/marketing",
                          create=True):
            self.assertTrue(self._run()["ok"])
        self._write_scan(disk, 63_000_000)
        with patch.object(asset_sync_runner, "current_root_gen", return_value="7|x:/marketing",
                          create=True):
            self.assertTrue(self._run()["ok"])
        self.assertIsNotNone(db_row(self.pg, F)["deleted_at"])

    def test_rollback_to_245_and_back_treats_v2_as_stale(self):
        """Powrot do 2.4.5 (pisze tylko last_seen) i ponowna aktualizacja: stare
        obserwacje v2 nie sa uzywane - pierwszy cykl jak migracja (nic nie usuwa)."""
        self._write_scan(_disk(), 60_000_000)
        self.assertTrue(self._run()["ok"])
        conn = sqlite3.connect(str(self.db_path))
        try:
            self.assertEqual(asset_repo.load_observations(conn)["source"], "v2")
            ids = sorted(json.loads(asset_repo.get_state(conn, "last_seen")))
            asset_repo.set_state(conn, "last_seen", json.dumps(ids[:-1]))  # zapis 2.4.5
            self.assertEqual(asset_repo.load_observations(conn)["source"], "v1")
        finally:
            conn.close()
        disk = _disk()
        del disk[F]
        self._write_scan(disk, 61_000_000)
        res = self._run()
        self.assertTrue(res["ok"], res)
        self.assertEqual(res.get("observations"), "v1")
        self.assertIsNone(db_row(self.pg, F)["deleted_at"])

    def test_reset_scan_memory_clears_v1_and_v2(self):
        self._write_scan(_disk(), 60_000_000)
        self.assertTrue(self._run()["ok"])
        self.assertTrue(asset_sync_runner.reset_scan_memory(self.db_path, "test")["ok"])
        conn = sqlite3.connect(str(self.db_path))
        try:
            self.assertEqual(asset_repo.get_state(conn, "last_seen_v2", "BRAK"), "BRAK")
            self.assertIsNone(asset_repo.load_last_seen(conn))
        finally:
            conn.close()


def load_tests(loader, tests, pattern):  # noqa: ARG001 - wydruk backendu w dowodzie
    print(f"[repro 4.1] baza testowa: {backend_name()}")
    return tests


if __name__ == "__main__":
    unittest.main()
