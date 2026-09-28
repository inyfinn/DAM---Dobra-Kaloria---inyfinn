# -*- coding: utf-8 -*-
"""W8 (28.09.2026), W7 znalezisko 5 + S8: wlasciciel katalogu publikowal migawki tylko co
REFRESH_S = 600 s (LightWatch patrzy tylko na baze). Swiezy lokalny build file-index /
branding-search-index / campaigns (mark_built_here - w moscie albo w osobnym procesie
watch-file-index.py) nie wyzwalal publikacji; komputer spoza listy wlascicieli (B), ktorego
watcher nadpisal file-index wlasnym niepelnym skanem, pokazywal go do nastepnego cyklu.

Kontrakt: zmiana lokalnego builda (built_here_sha albo podpis pliku migawki) -> po krotkim
debounce pelny cykl (pull + publish) - tylko gdy index_authority.may_publish() jest True
(wlasciciel publikuje) albo False (klient od razu wraca do wersji z bazy). None (brak listy
wlascicieli) = zachowanie jak dotad (cykl co REFRESH_S).
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

import index_snapshots as ix  # noqa: E402


class _Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


class LocalBuildTriggerTests(unittest.TestCase):
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
        self.fi.write_text(json.dumps({"products": [1]}) + " " * 1100, encoding="utf-8")
        self.clock = _Clock()
        self.runs: list[str] = []

    def _loop(self, authority):
        auth = mock.patch.object(ix, "_authority_decision", return_value=authority)
        auth.start()
        self.addCleanup(auth.stop)
        return ix.SnapshotLoop(self.data, run_cycle=lambda why: self.runs.append(why),
                               remote_watch=None, clock=self.clock)

    def _build_locally(self, text):
        self.fi.write_text(json.dumps({"products": [text]}) + " " * 1100, encoding="utf-8")
        ix.mark_built_here("file-index", self.fi)

    def test_no_trigger_without_local_change(self):
        loop = self._loop(True)
        loop.tick()  # pierwszy cykl (start) - jak dotad
        self.runs.clear()
        for _ in range(5):
            self.clock.t += ix.LOCAL_CHECK_S
            loop.tick()
        self.assertEqual(self.runs, [])

    def test_authority_publishes_soon_after_local_build(self):
        loop = self._loop(True)
        loop.tick()
        self.runs.clear()
        self._build_locally("nowy")
        loop.tick()  # wykryte, debounce
        self.assertEqual(self.runs, [])
        self.clock.t += ix.LOCAL_DEBOUNCE_S + 0.1
        loop.tick()
        self.assertEqual(self.runs, ["local_build"])
        # po cyklu nowy stan jest bazowy - brak petli
        self.clock.t += ix.LOCAL_DEBOUNCE_S + 0.1
        loop.tick()
        self.assertEqual(self.runs, ["local_build"])

    def test_non_authority_restores_db_version_soon(self):
        loop = self._loop(False)
        loop.tick()
        self.runs.clear()
        # watcher B nadpisuje file-index wlasnym skanem (bez zmiany sha builda tez sie liczy)
        self.fi.write_text(json.dumps({"products": ["B"]}) + " " * 1200, encoding="utf-8")
        loop.tick()
        self.clock.t += ix.LOCAL_DEBOUNCE_S + 0.1
        loop.tick()
        self.assertEqual(self.runs, ["local_build"])

    def test_no_authority_list_keeps_old_timing(self):
        loop = self._loop(None)
        loop.tick()
        self.runs.clear()
        self._build_locally("nowy")
        for _ in range(3):
            self.clock.t += ix.LOCAL_DEBOUNCE_S + 0.1
            loop.tick()
        self.assertEqual(self.runs, [])

    def test_branding_index_rows_file_does_not_trigger(self):
        """branding-index.json (setki MB, w trybie rows przepisywany przez scalanie) nie
        jest czescia podpisu - inaczej kazdy cykl scalania liczylby sha 360 MB."""
        loop = self._loop(True)
        loop.tick()
        self.runs.clear()
        (self.data / "branding-index.json").write_text("{}" + " " * 2000, encoding="utf-8")
        for _ in range(3):
            self.clock.t += ix.LOCAL_DEBOUNCE_S + 0.1
            loop.tick()
        self.assertEqual(self.runs, [])

    def test_remote_interval_still_runs(self):
        loop = self._loop(True)
        loop.tick()
        self.assertEqual(self.runs, ["first"])
        self.clock.t += ix.REFRESH_S + 1
        loop.tick()
        self.assertEqual(self.runs, ["first", "interval"])


if __name__ == "__main__":
    unittest.main()
