# -*- coding: utf-8 -*-
"""07.10.2026 (zasada wlasciciela: ekran pokazuje stan bazy, nie to, co ma ten komputer):

1. Lista publikujacych NIEZNANA (index_authority.may_publish() == None: brak klucza albo nieudany
   odczyt bez zapamietanej wartosci) = "nie wiem" = "nie wolno": komputer nie publikuje, a lokalny
   build nie przeslania wersji z bazy; wyzwalacz local_build jest ODKLADANY do chwili, gdy lista
   bedzie znana (nie pomijany).
2. Zapamietana wartosc listy (plik stanu index-authority.json) przezywa restart procesu przy
   niedostepnej bazie: wlasciciel dziala jak dotad.
3. Swiezy komputer (brak plikow spisu) startuje pierwszy cykl po START_DELAY_FRESH_S, nie po START_DELAY_S.

Zachowanie na prawdziwej bazie: test_index_snapshots_first_sync_realpg.py (AuthorityUnknownOnRealDbTests).
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_authority as ia  # noqa: E402
import index_snapshots as ix  # noqa: E402


class _Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def _big(path: Path, tag: str = "x") -> None:
    path.write_text(json.dumps({"tag": tag}) + " " * 1200, encoding="utf-8")


class StartupDelayTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.data = Path(tmp.name)

    def test_swiezy_komputer_bez_plikow_startuje_szybko(self):
        self.assertFalse(ix._catalog_files_present(self.data))
        self.assertEqual(ix._startup_delay_s(self.data), ix.START_DELAY_FRESH_S)
        self.assertLess(ix.START_DELAY_FRESH_S, ix.START_DELAY_S)
        self.assertEqual((ix.START_DELAY_FRESH_S, ix.START_DELAY_S), (2.0, 8.0))

    def test_gdy_pliki_sa_bez_zmian(self):
        _big(self.data / "file-index.json")
        _big(self.data / "search-index.json")
        self.assertTrue(ix._catalog_files_present(self.data))
        self.assertEqual(ix._startup_delay_s(self.data), ix.START_DELAY_S)

    def test_brak_jednego_z_dwoch_plikow_albo_pusty_plik_to_swiezy_start(self):
        _big(self.data / "file-index.json")
        self.assertEqual(ix._startup_delay_s(self.data), ix.START_DELAY_FRESH_S)   # brak search-index
        (self.data / "search-index.json").write_text("{}", encoding="utf-8")        # < MIN_BYTES
        self.assertEqual(ix._startup_delay_s(self.data), ix.START_DELAY_FRESH_S)

    def test_petla_czeka_wyliczone_opoznienie(self):
        with mock.patch.object(ix.time, "sleep") as sleep:
            ix._initial_wait(self.data)
            _big(self.data / "file-index.json")
            _big(self.data / "search-index.json")
            ix._initial_wait(self.data)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [2.0, 8.0])


class LocalBuildDeferredTests(unittest.TestCase):
    """SnapshotLoop: lista nieznana odklada local_build, a nie gubi go."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.data = self.base / "data"
        self.data.mkdir()
        self.state_dir = self.base / "state"
        p = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)
        self.fi = self.data / "file-index.json"
        _big(self.fi, "start")
        self.clock = _Clock()
        self.runs: list[str] = []

    def _loop(self, decisions):
        it = iter(decisions)
        last = {"v": None}

        def decide():
            try:
                last["v"] = next(it)
            except StopIteration:
                pass
            return last["v"]

        p = mock.patch.object(ix, "_authority_decision", side_effect=decide)
        p.start()
        self.addCleanup(p.stop)
        return ix.SnapshotLoop(self.data, run_cycle=lambda why: self.runs.append(why),
                               remote_watch=None, clock=self.clock)

    def _build_locally(self, tag):
        _big(self.fi, tag)
        ix.mark_built_here("file-index", self.fi)

    def test_nieznana_lista_odklada_local_build_do_chwili_gdy_lista_bedzie_znana(self):
        loop = self._loop([None] * 4 + [False])
        loop.tick()                                   # start: pierwszy cykl
        self.runs.clear()
        self._build_locally("nowy")
        loop.tick()                                   # wykryte, debounce
        for _ in range(4):                            # lista nieznana: cisza, zmiana ZOSTAJE oczekujaca
            self.clock.t += ix.LOCAL_DEBOUNCE_S + 0.1
            loop.tick()
        self.assertEqual(self.runs, [])
        self.assertTrue(loop.local.due())             # oczekuje, nie zostala zjedzona
        self.clock.t += ix.LOCAL_CHECK_S
        loop.tick()                                   # lista znana (False): odlozony local_build rusza
        self.assertEqual(self.runs, ["local_build"])
        self.clock.t += ix.LOCAL_DEBOUNCE_S + 0.1
        loop.tick()
        self.assertEqual(self.runs, ["local_build"])  # i tylko raz

    def test_znany_wlasciciel_bez_zmian(self):
        loop = self._loop([True])
        loop.tick()
        self.runs.clear()
        self._build_locally("nowy")
        loop.tick()
        self.clock.t += ix.LOCAL_DEBOUNCE_S + 0.1
        loop.tick()
        self.assertEqual(self.runs, ["local_build"])

    def test_pelny_cykl_w_miedzyczasie_zamyka_oczekujaca_zmiane(self):
        loop = self._loop([None])
        loop.tick()
        self.runs.clear()
        self._build_locally("nowy")
        loop.tick()
        self.clock.t += ix.REFRESH_S + 1              # zwykly cykl co REFRESH_S (pobranie z bazy)
        loop.tick()
        self.assertEqual(self.runs, ["interval"])
        self.assertFalse(loop.local.due())


class AuthorityUnknownRulesTests(unittest.TestCase):
    """pull_newer / publish_changed na wejsciu may_publish() == None (bez bazy: patch decyzji)."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.data = self.base / "data"
        self.data.mkdir()
        self.state_dir = self.base / "state"
        p = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)

    def test_publikacja_przy_nieznanej_liscie_nie_laczy_sie_z_baza(self):
        with mock.patch.object(ia, "may_publish", return_value=None), \
                mock.patch.dict(sys.modules, {"pg_db": mock.MagicMock()}) as _:
            res = ix.publish_changed(self.data, root_alive=True)
            pg = sys.modules["pg_db"]
            self.assertEqual(res, {"ok": True, "skipped": "authority_unknown"})
            pg.index_snapshot_meta.assert_not_called()
            pg.publish_index_snapshot.assert_not_called()

    def test_blad_odczytu_listy_to_to_samo_co_brak_listy(self):
        pg = mock.MagicMock()
        with mock.patch.object(ia, "may_publish", side_effect=RuntimeError("siec")), \
                mock.patch.dict(sys.modules, {"pg_db": pg}):
            res = ix.publish_changed(self.data, root_alive=True)
        self.assertEqual(res["skipped"], "authority_unknown")

    def test_force_admina_omija_regule_nieznanej_listy(self):
        with mock.patch.object(ia, "may_publish", return_value=None), \
                mock.patch.dict(sys.modules, {"pg_db": mock.MagicMock()}):
            res = ix.publish_changed(self.data, root_alive=True, force=True)
        self.assertNotEqual(res.get("skipped"), "authority_unknown")


class PersistedListSurvivesRestartTests(unittest.TestCase):
    """Wlasciciel (KRZYSZTOFWI): zapamietana lista z pliku stanu obowiazuje po restarcie mostu
    przy niedostepnej bazie - jego nowsze buildy NIE czekaja na baze."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.state_dir = Path(tmp.name) / "state"
        p = mock.patch.object(ia.platform_compat if hasattr(ia, "platform_compat") else ix.platform_compat,
                              "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)
        self.addCleanup(lambda: ia._CACHE.update(at=0.0, value=None, raw={}, error=""))
        ia._CACHE.update(at=0.0, value=None, raw={}, error="")

    def _restart(self):
        """Nowy proces: pamiec podreczna listy pusta, zostaje tylko plik stanu."""
        ia._CACHE.update(at=0.0, value=None, raw={}, error="")

    def test_zapamietane_true_przezywa_restart_przy_niedostepnej_bazie(self):
        with mock.patch.object(ia, "current_machine", return_value="KRZYSZTOFWI"), \
                mock.patch.object(ia, "_read_raw", return_value={"machines": ["KRZYSZTOFWI"]}):
            self.assertIs(ia.may_publish(lambda: None, force=True), True)   # zapis pliku stanu
        self.assertTrue((self.state_dir / "index-authority.json").is_file())
        self._restart()
        with mock.patch.object(ia, "_read_raw", return_value=None):         # baza niedostepna
            self.assertIs(ia.may_publish(lambda: None), True)
            self.assertEqual(ia._CACHE["error"], "read_failed_kept_last_known")

    def test_zapamietane_false_tez_przezywa(self):
        with mock.patch.object(ia, "current_machine", return_value="INNY"), \
                mock.patch.object(ia, "_read_raw", return_value={"machines": ["KRZYSZTOFWI"]}):
            self.assertIs(ia.may_publish(lambda: None, force=True), False)
        self._restart()
        with mock.patch.object(ia, "_read_raw", return_value=None):
            self.assertIs(ia.may_publish(lambda: None), False)

    def test_bez_zapamietanej_wartosci_i_bez_bazy_to_none(self):
        with mock.patch.object(ia, "_read_raw", return_value=None):
            self.assertIsNone(ia.may_publish(lambda: None))
            self.assertEqual(ia._CACHE["error"], "read_failed")

    def test_brak_klucza_w_bazie_nie_zapisuje_pliku_stanu(self):
        """Pusta lista = "nikt nie skonfigurowal" (None), bez zapamietywania - komputer czeka."""
        with mock.patch.object(ia, "_read_raw", return_value={}):
            self.assertIsNone(ia.may_publish(lambda: None, force=True))
        self.assertFalse((self.state_dir / "index-authority.json").exists())


if __name__ == "__main__":
    unittest.main()
