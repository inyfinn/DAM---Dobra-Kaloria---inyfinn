# -*- coding: utf-8 -*-
"""27.09.2026 (dodatek do Fazy 3 / zadania 2): watch-file-index.py (godzinowy i
wyzwalany zmiana watcher, OSOBNY PROCES od mostu) nigdy nie wolal
index_snapshots.mark_built_here() po swoich buildach - po wprowadzeniu bramki
_is_built_here (poprzednia tura) jego wynik nigdy nie zostalby opublikowany do
wspolnej bazy. Test importuje prawdziwy modul watch-file-index.py (nazwa pliku z
myslnikami - import przez importlib z pelnej sciezki) i sprawdza jego funkcje
pomocnicze w izolacji (bez prawdziwego subprocess/build).
"""
from __future__ import annotations

import importlib.util
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

# DAM_WATCHER_UNDER_TEST: kopia skryptu do testow mutacyjnych (prawdziwy plik zostaje nietkniety)
WATCHER_PATH = Path(
    os.environ.get("DAM_WATCHER_UNDER_TEST") or (DESKTOP.parent / "web" / "scripts" / "watch-file-index.py")
)


def _load_watcher_module():
    spec = importlib.util.spec_from_file_location("dam_watch_file_index_under_test", WATCHER_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


class MarkBuiltHereSafeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.watcher = _load_watcher_module()

    def test_woda_mark_built_here_gdy_ok(self):
        fake_ix = MagicMock()
        fake_ix.mark_built_here.return_value = {"ok": True, "key": "file-index", "sha": "abc"}
        with patch.dict(sys.modules, {"index_snapshots": fake_ix}):
            self.watcher._mark_built_here_safe("file-index", Path("X:/nieistotne/file-index.json"))
        fake_ix.mark_built_here.assert_called_once_with(
            "file-index", Path("X:/nieistotne/file-index.json")
        )

    def test_nie_wywraca_sie_gdy_index_snapshots_brakuje(self):
        with patch.dict(sys.modules, {"index_snapshots": None}):
            # nie powinno rzucic wyjatku
            self.watcher._mark_built_here_safe("file-index", Path("cokolwiek.json"))

    def test_nie_wywraca_sie_gdy_mark_built_here_rzuca(self):
        fake_ix = MagicMock()
        fake_ix.mark_built_here.side_effect = RuntimeError("boom")
        with patch.dict(sys.modules, {"index_snapshots": fake_ix}):
            self.watcher._mark_built_here_safe("file-index", Path("cokolwiek.json"))  # nie wywraca


class RcZeroGateTests(unittest.TestCase):
    """rc==0 + out_dir is None -> oznacz file-index i search-index.
    rc==0 + out_dir podany (fixture) -> NIE oznaczaj (fixture, nie prawdziwy build).
    rc!=0 (w tym rc==3 - odrzucony przez bezpiecznik) -> NIE oznaczaj."""

    @classmethod
    def setUpClass(cls):
        cls.watcher = _load_watcher_module()

    def test_logika_bramki_source(self):
        # Weryfikacja przez odczyt zrodla funkcji - proste i odporne na duza
        # ilosc mockowania (subprocess/lock/index_supervisor) potrzebnego, zeby
        # wykonac cala rebuild_with_lock() od A do Z.
        import inspect

        src = inspect.getsource(self.watcher.rebuild_with_lock)
        self.assertIn("if rc == 0 and out_dir is None and not unchanged:", src)  # + przyrost bez zmian nie oznacza
        self.assertIn('_mark_built_here_safe("file-index"', src)
        self.assertIn('_mark_built_here_safe("search-index"', src)


class BrandingHookWaitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.watcher = _load_watcher_module()

    def test_oznacza_tylko_gdy_pipeline_zwraca_0(self):
        fake_ix = MagicMock()
        fake_ix.mark_built_here.return_value = {"ok": True}
        fake_proc_ok = MagicMock()
        fake_proc_ok.wait.return_value = 0
        fake_proc_fail = MagicMock()
        fake_proc_fail.wait.return_value = 3

        import inspect

        src = inspect.getsource(self.watcher.spawn_branding_pipeline)
        self.assertIn("_wait_and_mark", src)
        self.assertIn('_mark_built_here_safe("branding-search-index"', src)
        self.assertIn("if rc == 0:", src)


if __name__ == "__main__":
    unittest.main()
