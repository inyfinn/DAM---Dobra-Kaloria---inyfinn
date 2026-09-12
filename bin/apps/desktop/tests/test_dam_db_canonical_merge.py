# -*- coding: utf-8 -*-
"""Merge SQLite: pełna baza (users/size) wygrywa z nowszą pustą kopią. Kanon = bin/DATABASE."""
from __future__ import annotations

import sqlite3
import sys
import tempfile
import time
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DESKTOP))

import dam_db  # noqa: E402


def _make_users_db(path: Path, n_users: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, name TEXT)"
        )
        for i in range(n_users):
            conn.execute(
                "INSERT INTO users(email, name) VALUES (?, ?)",
                (f"u{i}@example.com", f"User {i}"),
            )
        conn.commit()
    finally:
        conn.close()


class CanonicalPathTest(unittest.TestCase):
    def test_canonical_is_bin_database_not_marketing_root(self):
        self.assertEqual(dam_db.canonical_db_dir(), dam_db.REPO_DATABASE)
        self.assertEqual(
            dam_db.canonical_db_path(),
            dam_db.REPO_DATABASE / "dam-local.sqlite",
        )
        fake_root = Path("D:/Marketing")
        self.assertNotEqual(dam_db.canonical_db_dir(), fake_root / "DATABASE")

    def test_sqlite_location_label_install_vs_repo(self):
        install = Path(r"C:\Users\xpret\AppData\Local\Programs\DAM\bin\DATABASE\dam-local.sqlite")
        self.assertEqual(dam_db.sqlite_location_label(install), "install")
        self.assertEqual(
            dam_db.sqlite_location_label(Path(r"D:\proj\bin\DATABASE\dam-local.sqlite")),
            "repo",
        )


class MergePrefersCompleteTest(unittest.TestCase):
    def test_newer_empty_loses_to_18_user_db(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            empty = root / "empty.sqlite"
            full = root / "full.sqlite"
            _make_users_db(empty, 0)
            _make_users_db(full, 18)
            # empty is newer
            time.sleep(0.05)
            empty.touch()
            empty_score = dam_db._source_score(empty)
            full_score = dam_db._source_score(full)
            self.assertGreater(full_score, empty_score)
            best = dam_db._pick_best_sqlite([empty, full], root / "target.sqlite")
            self.assertEqual(best.resolve(), full.resolve())

    def test_incomplete_small_file(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "tiny.sqlite"
            _make_users_db(p, 0)
            self.assertTrue(dam_db._is_incomplete_db(p))


if __name__ == "__main__":
    unittest.main()
