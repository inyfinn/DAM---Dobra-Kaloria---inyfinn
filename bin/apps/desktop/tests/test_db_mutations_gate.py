# -*- coding: utf-8 -*-
"""F/X/D wymaga zywej bazy; cache plikow nie wystarcza."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DESKTOP))

import dam_db  # noqa: E402


class MutationsGateTest(unittest.TestCase):
    def test_empty_snap_blocks(self):
        self.assertFalse(dam_db.mutations_allowed_from_status({}))
        self.assertFalse(dam_db.mutations_allowed_from_status(None))

    def test_postgres_online_allows(self):
        self.assertTrue(
            dam_db.mutations_allowed_from_status(
                {"ok": True, "online": True, "engine": "postgres", "offline_mode": False}
            )
        )

    def test_local_sqlite_allows(self):
        self.assertTrue(
            dam_db.mutations_allowed_from_status(
                {"ok": True, "online": True, "engine": "sqlite", "offline_mode": False}
            )
        )

    def test_offline_mode_blocks_even_if_sqlite_engine(self):
        self.assertFalse(
            dam_db.mutations_allowed_from_status(
                {
                    "ok": True,
                    "online": False,
                    "engine": "sqlite-offline",
                    "offline_mode": True,
                }
            )
        )

    def test_prefer_sqlite_allows_sqlite_engine(self):
        self.assertTrue(
            dam_db.mutations_allowed_from_status(
                {"ok": True, "engine": "sqlite-offline", "offline_mode": True},
                {"mode": "sqlite"},
            )
        )

    def test_ok_false_blocks(self):
        self.assertFalse(
            dam_db.mutations_allowed_from_status(
                {"ok": False, "online": False, "engine": "postgres"}
            )
        )


if __name__ == "__main__":
    unittest.main()
