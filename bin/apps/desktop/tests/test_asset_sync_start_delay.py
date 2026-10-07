# -*- coding: utf-8 -*-
"""07.10.2026: swieza instalacja nie czeka 15 s na pierwszy cykl dam-asset-sync.

Watek po starcie mostu czekal zawsze 15 s ("najpierw UI, potem siec"). Gdy komputer nie
ma jeszcze lokalnego katalogu materialow (brak siatki albo pusta lokalna tabela wierszy),
nie ma czego pokazac - start od razu. W pozostalych przypadkach 15 s jak dotad.

Run: python tests/test_asset_sync_start_delay.py  (z bin/apps/desktop)
"""
from __future__ import annotations

import inspect
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parent.parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import asset_repo  # noqa: E402
import local_bridge as lb  # noqa: E402


class AssetSyncStartDelayTests(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.tmp = Path(self.td.name)
        self.grid = self.tmp / "branding-grid-index.json"
        self.db = self.tmp / "dam-local.sqlite"
        self.patches = [
            mock.patch.object(lb, "BRANDING_INDEX_FILE", self.tmp / "branding-index.json"),
            mock.patch.object(lb.dam_db, "DB_CANONICAL", self.db),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.td.cleanup()

    def _grid(self, size: int = 4096) -> None:
        self.grid.write_bytes(b"x" * size)

    def _rows(self, n: int) -> None:
        conn = sqlite3.connect(str(self.db))
        try:
            asset_repo.ensure_local(conn)
            for i in range(n):
                conn.execute("INSERT INTO asset_rows (asset_id, row_json) VALUES (?, '{}')", (f"a{i}",))
            conn.commit()
        finally:
            conn.close()

    def test_no_grid_starts_at_once(self):
        self._rows(3)
        self.assertEqual(lb._asset_sync_start_delay_s(), 0.0)

    def test_empty_shell_grid_starts_at_once(self):
        self._grid(size=20)
        self._rows(3)
        self.assertEqual(lb._asset_sync_start_delay_s(), 0.0)

    def test_grid_but_no_local_database_starts_at_once(self):
        self._grid()
        self.assertEqual(lb._asset_sync_start_delay_s(), 0.0)

    def test_grid_but_database_without_rows_table_starts_at_once(self):
        self._grid()
        sqlite3.connect(str(self.db)).close()  # plik istnieje, tabeli asset_rows brak
        self.assertEqual(lb._asset_sync_start_delay_s(), 0.0)

    def test_grid_and_empty_rows_table_starts_at_once(self):
        self._grid()
        self._rows(0)
        self.assertEqual(lb._asset_sync_start_delay_s(), 0.0)

    def test_computer_with_local_catalog_waits_as_before(self):
        self._grid()
        self._rows(1)
        self.assertEqual(lb._asset_sync_start_delay_s(), 15.0)

    def test_unreadable_database_waits_as_before(self):
        self._grid()
        self._rows(1)
        with mock.patch("sqlite3.connect", side_effect=sqlite3.OperationalError("database is locked")):
            self.assertEqual(lb._asset_sync_start_delay_s(), 15.0)

    def test_check_does_not_create_or_touch_the_database(self):
        self._grid()
        self.assertEqual(lb._asset_sync_start_delay_s(), 0.0)
        self.assertFalse(self.db.exists(), "sprawdzenie nie moze zalozyc pustej bazy")

    def test_loop_uses_the_rule_instead_of_fixed_wait(self):
        """Petli nie da sie uruchomic w tescie (zostalby zywy watek wolajacy prawdziwa
        synchronizacje) - jak w test_branding_rebuild_marks_campaigns.py sprawdzamy zrodlo."""
        src = inspect.getsource(lb.start_asset_sync_watch)
        self.assertIn("start_delay = _asset_sync_start_delay_s()", src)
        self.assertIn("if start_delay > 0:", src)
        self.assertIn("_asset_sync_wake.wait(start_delay)", src)
        self.assertNotIn("wait(15.0)", src)


if __name__ == "__main__":
    unittest.main(verbosity=2)
