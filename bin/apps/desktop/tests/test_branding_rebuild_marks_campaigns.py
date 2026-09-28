# -*- coding: utf-8 -*-
"""Faza 3, plan nastepnej partii pkt 5 (POSTEP PRAC.md sekcja 3/6): campaigns.json
jest budowany przez build-branding-index.py w tym samym biegu co
branding-search-index.json, ale po udanym rebuildzie most oznaczal
mark_built_here() tylko dla branding-search-index. Skutek: campaigns.json
nigdy nie dostawal built_here_sha, wiec asset_sync/publish_changed nigdy nie
uznawal go za "zbudowany tutaj" i plik nie szedl do bazy.

Test 1 (czerwony przed poprawka): zrodlo _run_branding_rebuild musi wywolywac
_mark_built_here("campaigns", ...) obok _mark_built_here("branding-search-index", ...).
Test 2: funkcjonalnie, z zamockowanym subprocess.call (rc=0) i prawdziwym
index_snapshots na tymczasowym stanie, campaigns.json faktycznie dostaje
built_here_sha po udanym biegu.
"""
from __future__ import annotations

import inspect
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parent.parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import local_bridge  # noqa: E402
# branding_publish robi "from rebuild_lock import acquire_lock" - gdyby pierwszy
# import wypadl w trakcie mock.patch("rebuild_lock.acquire_lock") ponizej, podrobka
# zostalaby w module na stale i psula inne testy (28.09: test_slim_publish_...).
import branding_publish  # noqa: E402,F401


class RunBrandingRebuildMarksCampaignsSourceTests(unittest.TestCase):
    """Kontrola zrodla - proste i odporne na duza ilosc mockowania (lock,
    subprocess, branding_publish) potrzebnego, zeby wykonac _run_branding_rebuild
    od A do Z (patrz test_watch_file_index_mark_built_here.py, ten sam wzorzec)."""

    def test_oznacza_campaigns_po_branding_search_index(self):
        src = inspect.getsource(local_bridge._run_branding_rebuild)
        self.assertIn('_mark_built_here("branding-search-index"', src)
        self.assertIn('_mark_built_here("campaigns"', src)
        # campaigns oznaczane PO udanym stage 3 (cache_invalidate / last_ok=True),
        # nie przed - build-branding-index.py musi sie najpierw skonczyc rc=0.
        idx_ok = src.index('_branding_rebuild_state["last_ok"] = True')
        idx_campaigns = src.index('_mark_built_here("campaigns"')
        self.assertLess(idx_ok, idx_campaigns)


class RunBrandingRebuildFunctionalTests(unittest.TestCase):
    """Udany rebuild (subprocess.call zamockowany na rc=0) musi zostawic
    built_here_sha dla campaigns w stanie index_snapshots."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmp_path = Path(self._tmp.name)

        import index_snapshots

        self.index_snapshots = index_snapshots
        state_dir = self.tmp_path / "state"
        state_dir.mkdir(parents=True, exist_ok=True)
        self._state_patch = mock.patch.object(
            index_snapshots.platform_compat, "user_state_dir", side_effect=lambda: state_dir
        )
        self._state_patch.start()
        self.addCleanup(self._state_patch.stop)

        data_dir = self.tmp_path / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        self.campaigns_path = data_dir / "campaigns.json"
        self.campaigns_path.write_text('{"version":1,"campaigns":[]}', encoding="utf-8")
        self.search_index_path = data_dir / "branding-search-index.json"
        self.search_index_path.write_text("{}", encoding="utf-8")

    def test_udany_build_oznacza_campaigns_built_here(self):
        patches = [
            mock.patch.object(local_bridge, "WEB_ROOT", self.tmp_path),
            mock.patch.object(local_bridge, "BUILD_BRANDING_INDEX", self.tmp_path / "build-branding-index.py"),
            mock.patch.object(local_bridge, "BUILD_BRANDING_GRID_INDEX", self.tmp_path / "does-not-exist.py"),
            mock.patch("subprocess.call", return_value=0),
            mock.patch("branding_publish.resolve_script_python", return_value=sys.executable),
            mock.patch.object(local_bridge, "_invalidate_branding_data_caches", lambda: None),
            mock.patch.object(local_bridge, "_write_branding_status", lambda *a, **k: None),
            mock.patch.object(local_bridge, "_append_rebuild_log", lambda *a, **k: None),
            mock.patch.object(local_bridge, "_kick_asset_sync_after_branding_rebuild", lambda: None),
        ]
        (self.tmp_path / "build-branding-index.py").write_text("", encoding="utf-8")

        class _FakeLock:
            def update(self, **_kw):
                pass

            def release(self):
                pass

        with mock.patch("rebuild_lock.acquire_lock", return_value=(_FakeLock(), {})):
            for p in patches:
                p.start()
            try:
                local_bridge._run_branding_rebuild()
            finally:
                for p in patches:
                    p.stop()

        with local_bridge._branding_rebuild_lock:
            self.assertTrue(local_bridge._branding_rebuild_state.get("last_ok"))

        state = self.index_snapshots._load_state()
        self.assertIn("built_here_sha", state.get("campaigns", {}))
        self.assertIn("built_here_sha", state.get("branding-search-index", {}))


if __name__ == "__main__":
    unittest.main()
