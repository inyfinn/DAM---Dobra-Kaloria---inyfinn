# -*- coding: utf-8 -*-
"""W8 (28.09.2026), W7 znalezisko 2: swieza instancja w trybie rows - pierwszy
"Odswiez branding" konczyl sie grid_build_rc_1.

build-branding-index.py w trybie rows NIE pisze branding-index.json (pisze go scalanie
asset_sync_runner). Na swiezej instancji pliku jeszcze nie ma, Stage 2 (siatka z
branding-index.json) konczyl sie rc=1 (ERROR: missing), bieg szedl do except -
bez mark_built_here i bez _kick_asset_sync_after_branding_rebuild, wiec skan trafial
do bazy dopiero z cyklu startowego asset_sync (albo po 600 s).

Kontrakt: brak branding-index.json = Stage 2 pominiety (siatke zbuduje publikacja po
zapisie indeksu przez scalanie), bieg udany, scalanie wyzwolone od razu.
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

import local_bridge  # noqa: E402
import branding_publish  # noqa: E402,F401


class FreshRowsRebuildTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.tmp = Path(tmp.name)
        (self.tmp / "data").mkdir()
        (self.tmp / "build-branding-index.py").write_text("", encoding="utf-8")
        (self.tmp / "build-branding-grid-index.py").write_text("", encoding="utf-8")
        import index_snapshots

        st = mock.patch.object(index_snapshots.platform_compat, "user_state_dir",
                               side_effect=lambda: self.tmp / "state")
        st.start()
        self.addCleanup(st.stop)

    def test_first_rebuild_without_branding_index_succeeds_and_kicks_sync(self):
        calls: list[list[str]] = []

        def fake_call(cmd, **_kw):
            calls.append([str(c) for c in cmd])
            # skrypt siatki bez branding-index.json konczy sie rc=1 (ERROR: missing)
            if any("build-branding-grid-index" in str(c) for c in cmd):
                return 0 if (self.tmp / "data" / "branding-index.json").is_file() else 1
            return 0

        kicked = []

        class _FakeLock:
            def update(self, **_kw):
                pass

            def release(self):
                pass

        patches = [
            mock.patch.object(local_bridge, "WEB_ROOT", self.tmp),
            mock.patch.object(local_bridge, "BRANDING_INDEX_FILE", self.tmp / "data" / "branding-index.json"),
            mock.patch.object(local_bridge, "BUILD_BRANDING_INDEX", self.tmp / "build-branding-index.py"),
            mock.patch.object(local_bridge, "BUILD_BRANDING_GRID_INDEX", self.tmp / "build-branding-grid-index.py"),
            mock.patch.object(local_bridge, "_grid_from_sqlite_argv",
                              lambda: [sys.executable, str(self.tmp / "build-branding-grid-index.py")]),
            mock.patch("subprocess.call", side_effect=fake_call),
            mock.patch("branding_publish.resolve_script_python", return_value=sys.executable),
            mock.patch.object(local_bridge, "_invalidate_branding_data_caches", lambda: None),
            mock.patch.object(local_bridge, "_write_branding_status", lambda *a, **k: None),
            mock.patch.object(local_bridge, "_append_rebuild_log", lambda *a, **k: None),
            mock.patch.object(local_bridge, "_kick_asset_sync_after_branding_rebuild", lambda: kicked.append(1)),
        ]
        with mock.patch("rebuild_lock.acquire_lock", return_value=(_FakeLock(), {})):
            for p in patches:
                p.start()
            try:
                local_bridge._run_branding_rebuild()
            finally:
                for p in patches:
                    p.stop()
        with local_bridge._branding_rebuild_lock:
            state = dict(local_bridge._branding_rebuild_state)
        self.assertTrue(state.get("last_ok"), state.get("last_error"))
        self.assertEqual(kicked, [1], "scalanie ma ruszyc od razu po skanie")
        self.assertFalse(any("build-branding-grid-index" in " ".join(c) for c in calls),
                         "siatka bez branding-index.json nie ma sensu - pominieta")


if __name__ == "__main__":
    unittest.main()
