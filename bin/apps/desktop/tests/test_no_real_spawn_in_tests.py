# -*- coding: utf-8 -*-
"""Pod unittest nadzorca nie moze uruchomic prawdziwego watch-file-index.py
(28.09.2026: dwie sieroty rebuild-branding-pipeline.py po przebiegu testow)."""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_supervisor as isup  # noqa: E402


class NoRealSpawnInTests(unittest.TestCase):
    def test_spawn_watcher_refuses_under_unittest(self):
        with tempfile.TemporaryDirectory() as td, \
                mock.patch.object(isup, "WATCHER_STATUS", Path(td) / "st.json"), \
                mock.patch.object(isup, "DATA_DIR", Path(td)), \
                mock.patch.dict(os.environ, {"DAM_ALLOW_REAL_SPAWN_IN_TESTS": ""}), \
                mock.patch.object(isup.subprocess, "Popen") as popen:
            sup = isup.IndexSupervisor()
            self.assertIsNone(sup._spawn_watcher())
            popen.assert_not_called()
            self.assertEqual(isup.read_watcher_status().get("error"), "test_spawn_blocked")

    def test_explicit_opt_in_allows(self):
        with mock.patch.dict(os.environ, {"DAM_ALLOW_REAL_SPAWN_IN_TESTS": "1"}):
            self.assertFalse(isup._real_spawn_blocked_in_tests())


if __name__ == "__main__":
    unittest.main()
