"""Edytor skojarzen zapisuje PELNY zestaw produktow dla pliku.
Odznaczony produkt (confirmed albo auto) ma zostac 'rejected' - wczesniej zostawal
'confirmed' w SQLite i Postgresie, wiec inne komputery dalej go widzialy."""
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import assoc_repo  # noqa: E402


class ReplaceConfirmedTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "t.sqlite"
        c = assoc_repo.connect(self.db)
        c.executemany(
            "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by)"
            " VALUES(?,?,?,?,?,?,?,?)",
            [
                ("br-1", "a", 100, "manual", "confirmed", "", "t", "u"),
                ("br-1", "b", 100, "manual", "confirmed", "", "t", "u"),
                ("br-1", "c", 80, "ocr", "auto", "", "t", "ocr"),
                ("br-2", "a", 100, "manual", "confirmed", "", "t", "u"),
            ],
        )
        c.commit()
        c.close()

    def tearDown(self):
        self.tmp.cleanup()

    def status(self, asset):
        c = sqlite3.connect(self.db)
        rows = dict(c.execute("select product_id, status from asset_product_links where asset_id=?", (asset,)).fetchall())
        c.close()
        return rows

    def save(self, pids, replace):
        return assoc_repo.upsert_confirmed_links(
            "br-1", pids, db_path=self.db, mirror=False, schedule_publish=False, replace_confirmed=replace
        )

    def test_editor_removes_unticked(self):
        self.assertTrue(self.save(["a"], True)["ok"])
        self.assertEqual(self.status("br-1"), {"a": "confirmed", "b": "rejected", "c": "rejected"})
        self.assertEqual(self.status("br-2"), {"a": "confirmed"}, "inny plik nietkniety")

    def test_editor_clears_all(self):
        self.save([], True)
        self.assertEqual(set(self.status("br-1").values()), {"rejected"})

    def test_quiz_keeps_old_behaviour(self):
        self.save(["a"], False)
        self.assertEqual(self.status("br-1"), {"a": "confirmed", "b": "confirmed", "c": "auto"})


if __name__ == "__main__":
    unittest.main()
