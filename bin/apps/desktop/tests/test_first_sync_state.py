# -*- coding: utf-8 -*-
"""Stan pierwszej synchronizacji po starcie procesu (index_snapshots._FIRST_SYNC),
do banera UI "pobieram dane" / /health. Przeniesione z usunietego
test_first_run_meta_sync.py (27.09.2026, zadanie 1 - wycofanie zmiany meta_store
zostawilo first_sync bez zmian, patrz raport)."""
from __future__ import annotations

import json
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_snapshots as ix  # noqa: E402


class FakeDb:
    def __init__(self):
        self.rows: dict[str, dict] = {}

    def publish_index_snapshot(self, key, raw, *, sha256, built_at, built_by="", item_count=0):
        gen = int(time.time() * 1000) + len(self.rows)
        self.rows[key] = {"raw": raw, "sha256": sha256, "generation": gen,
                          "built_at": built_at, "built_by": built_by, "published_at": built_at}
        return {"ok": True, "changed": True, "generation": gen}

    def index_snapshot_meta(self):
        return {k: {kk: v for kk, v in r.items() if kk != "raw"} | {"store_key": k}
                for k, r in self.rows.items()}

    def fetch_index_snapshot(self, key):
        r = self.rows.get(key)
        if not r:
            return None
        return {"store_key": key, "generation": r["generation"], "sha256": r["sha256"],
                "built_at": r["built_at"], "built_by": r["built_by"]}, r["raw"]


class FirstSyncStateTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.data_dir = self.base / "data"
        self.data_dir.mkdir(parents=True)

        self.db = FakeDb()
        self.state_dir = self.base / "state"
        p = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)
        p2 = mock.patch.dict(sys.modules, {"pg_db": self.db})
        p2.start()
        self.addCleanup(p2.stop)

        ix._FIRST_SYNC.update(done=False, ok=None, started_at="", finished_at="")

    def test_first_sync_state_po_run_once(self):
        self.assertFalse(ix.first_sync_state()["done"])
        ix.run_once(self.data_dir, root_alive_fn=lambda: False)
        state = ix.first_sync_state()
        self.assertTrue(state["done"])
        self.assertTrue(state["finished_at"])

    def test_status_niesie_first_sync(self):
        ix.run_once(self.data_dir, root_alive_fn=lambda: False)
        st = ix.status()
        self.assertIn("first_sync", st)
        self.assertTrue(st["first_sync"]["done"])

    def test_druga_synchronizacja_nie_nadpisuje_started_at(self):
        ix.run_once(self.data_dir, root_alive_fn=lambda: False)
        first_started = ix.first_sync_state()["started_at"]
        ix.run_once(self.data_dir, root_alive_fn=lambda: False)
        self.assertEqual(ix.first_sync_state()["started_at"], first_started)


if __name__ == "__main__":
    unittest.main()
