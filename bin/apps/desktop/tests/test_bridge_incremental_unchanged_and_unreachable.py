# -*- coding: utf-8 -*-
"""07.10.2026: przyrost uruchomiony z mostu (klik F/X/D, "Dodaj produkt").

- indekser wypisal MERGE_UNCHANGED (kod 0, spisu nie zapisal): bez znacznikow "zbudowane
  tutaj", bez brandingu, bez publikacji miniatur; stan dla strony = sukces + unchanged;
- spis sie zmienil (kod 0 bez tej linii): wszystko jak dotad;
- kod 6 (folder chwilowo nieosiagalny): czytelny blad, bez znacznikow, bez pelnego skanu;
- kod 5 (przyrost niemozliwy): jeden pelny skan, jak dotad.
Wyjscie indeksera podstawione - zaden podproces nie startuje.

Run: python tests/test_bridge_incremental_unchanged_and_unreachable.py  (z bin/apps/desktop)
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parent.parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_supervisor  # noqa: E402
import local_bridge as lb  # noqa: E402
import rebuild_lock  # noqa: E402


class _FakeProc:
    pid = 4242

    def __init__(self, rc: int):
        self.rc = rc

    def wait(self, *a, **k):
        return self.rc


class IncrementalResultTests(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.tmp = Path(self.td.name)
        self.log = self.tmp / "index-rebuild.log"
        # Stary bieg w tym samym logu: jego MERGE_UNCHANGED nie moze sie liczyc do nowego.
        self.log.write_text("MERGE_UNCHANGED: stary bieg\n", encoding="utf-8")
        self.calls: list[str] = []
        self.full_scan = mock.Mock()
        self.state_before = dict(lb._index_state)
        lb._index_state["running"] = False

    def tearDown(self):
        lb._index_state.clear()
        lb._index_state.update(self.state_before)
        self.td.cleanup()

    def _run(self, rc: int, output: str, only=("M:/produkt",)) -> dict:
        def fake_popen(argv, **kw):
            kw["stdout"].write(output)
            kw["stdout"].flush()
            return _FakeProc(rc)

        def mark(key, path):
            self.calls.append("mark:" + key)
            return "ok"

        real = lb._run_index_rebuild
        thumb = mock.Mock()
        thumb.start_publish_after_index.side_effect = lambda: self.calls.append("publish") or {"started": True}
        with mock.patch.object(lb, "INDEX_REBUILD_LOG_FILE", self.log), \
                mock.patch.object(lb, "INDEX_REBUILD_LOCK_FILE", self.tmp / "lock.json"), \
                mock.patch.object(rebuild_lock, "acquire_lock", return_value=(mock.Mock(), {})), \
                mock.patch.object(lb.subprocess, "Popen", side_effect=fake_popen), \
                mock.patch.object(index_supervisor, "wait_rebuild_proc", side_effect=lambda p, **k: p.rc), \
                mock.patch.object(index_supervisor, "begin_run_snapshot"), \
                mock.patch.object(index_supervisor, "complete_run_report"), \
                mock.patch.object(index_supervisor, "read_watcher_status_for_merge", return_value={}), \
                mock.patch.object(index_supervisor, "write_watcher_status"), \
                mock.patch.object(index_supervisor, "index_builder_env", return_value={}), \
                mock.patch.object(lb, "append_audit"), \
                mock.patch.object(lb, "_append_rebuild_log"), \
                mock.patch.object(lb, "_drop_json_cache"), \
                mock.patch.object(lb, "_mark_built_here", side_effect=mark), \
                mock.patch.object(lb, "start_branding_rebuild",
                                  side_effect=lambda: self.calls.append("branding") or {}), \
                mock.patch.object(lb, "_warm_viz_thumbs_from_index",
                                  side_effect=lambda **k: self.calls.append("warm") or {}), \
                mock.patch.object(lb, "dam_thumb_cache", thumb), \
                mock.patch.dict(sys.modules, {"meta_store": mock.Mock()}), \
                mock.patch.object(lb, "_run_index_rebuild", self.full_scan):
            real(list(only) if only else None)
            for _ in range(40):  # pelny skan po kodzie 5 startuje w osobnym watku
                if self.full_scan.called:
                    break
                import time
                time.sleep(0.01)
        return dict(lb._index_state)

    def test_unchanged_marks_nothing_and_reports_success(self):
        st = self._run(0, "[scan] produkt\nMERGE_UNCHANGED: wynik przyrostu identyczny ze spisem\n")
        self.assertEqual(self.calls, [])
        self.assertIs(st["last_ok"], True)
        self.assertIs(st["unchanged"], True)
        self.assertEqual(st["last_error"], "")
        self.assertEqual(st["stage"], "idle")
        self.assertFalse(st["running"])
        self.full_scan.assert_not_called()

    def test_changed_index_does_everything_as_before(self):
        st = self._run(0, "[scan] produkt\nMERGED 1 produkt\n")
        self.assertEqual(self.calls, ["mark:file-index", "mark:search-index", "branding", "warm", "publish"])
        self.assertIs(st["last_ok"], True)
        self.assertIs(st["unchanged"], False)
        self.full_scan.assert_not_called()

    def test_old_marker_from_previous_run_does_not_count(self):
        st = self._run(0, "[scan] produkt\n")
        self.assertIs(st["unchanged"], False)
        self.assertIn("mark:file-index", self.calls)

    def test_full_scan_ignores_the_marker(self):
        st = self._run(0, "MERGE_UNCHANGED: nie dotyczy pelnego skanu\n", only=())
        self.assertIs(st["unchanged"], False)
        self.assertIn("mark:file-index", self.calls)

    def test_code_6_gives_readable_error_without_marks_or_full_scan(self):
        st = self._run(6, "MERGE_UNREACHABLE: M:/produkt\n")
        self.assertEqual(self.calls, [])
        self.assertIs(st["last_ok"], False)
        self.assertEqual(st["last_rc"], 6)
        self.assertEqual(st["last_error"], "folder_unreachable")
        self.assertEqual(st["last_message"], "Folder jest chwilowo niedostępny - spróbuj ponownie za chwilę")
        self.assertIs(st["unchanged"], False)
        self.full_scan.assert_not_called()

    def test_code_5_still_escalates_to_one_full_scan(self):
        st = self._run(5, "przyrost niemozliwy\n")
        self.assertEqual(self.calls, [])
        self.assertEqual(st["last_error"], "build_rc_5")
        self.assertEqual(st["last_message"], "")
        self.full_scan.assert_called_once_with()

    def test_next_run_clears_previous_message_and_flag(self):
        self._run(6, "MERGE_UNREACHABLE: M:/produkt\n")
        st = self._run(0, "MERGED\n")
        self.assertEqual(st["last_message"], "")
        self.assertEqual(st["last_error"], "")

    def test_status_route_payload_carries_the_new_fields(self):
        self._run(0, "MERGE_UNCHANGED: bez zmian\n")
        with mock.patch.object(index_supervisor, "public_status", return_value={}):
            rb = lb.index_status()["rebuild"]
        self.assertIs(rb["unchanged"], True)
        self.assertIs(rb["last_ok"], True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
