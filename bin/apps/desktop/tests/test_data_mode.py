# -*- coding: utf-8 -*-
"""Tryb danych LIVE / LOKALNY (data_mode.py): LOKALNY nie pobiera z bazy i nie scala."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asset_sync_runner  # noqa: E402
import data_mode  # noqa: E402
import index_snapshots  # noqa: E402


class DataModeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        p = patch.object(data_mode, "MODE_FILE", Path(self.tmp.name) / "data-mode.json")
        p.start()
        self.addCleanup(p.stop)

    def test_default_is_live_and_bad_mode_rejected(self) -> None:
        self.assertEqual(data_mode.get_mode(), data_mode.LIVE)
        self.assertFalse(data_mode.set_mode("xyz")["ok"])
        self.assertEqual(data_mode.get_mode(), data_mode.LIVE)

    def test_local_skips_db_pull_and_merge(self) -> None:
        self.assertTrue(data_mode.set_mode("local")["ok"])
        self.assertTrue(data_mode.is_local())

        def boom():
            raise AssertionError("LOKALNY nie moze laczyc sie z baza")

        res = asset_sync_runner.run_once(self.tmp.name, self.tmp.name, root_alive=True, root_path="M:/",
                                         machine="T", pg_connect=boom)
        self.assertEqual(res, {"ok": True, "mode": "local"})
        with patch.dict(sys.modules, {"pg_db": None}):  # import pg_db = blad, gdyby doszlo
            pull = index_snapshots.pull_newer(Path(self.tmp.name), root_alive=True)
        self.assertTrue(pull.get("skipped_local_mode"))

    def test_live_goes_to_db(self) -> None:
        data_mode.set_mode("live")
        called = []

        def conn():
            called.append(1)
            raise OSError("offline")

        res = asset_sync_runner.run_once(self.tmp.name, self.tmp.name, root_alive=True, root_path="M:/",
                                         machine="T", pg_connect=conn)
        self.assertEqual(called, [1])
        self.assertFalse(res["ok"])


if __name__ == "__main__":
    unittest.main()
