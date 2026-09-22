# -*- coding: utf-8 -*-
"""Drzewo aplikacji tylko do odczytu nie moze zabijac importu mostu.

Objaw 2026-09-22 (macOS): uzytkownik uruchamia DAM.app PROSTO Z ZAMONTOWANEGO .dmg.
Obraz UDZO jest tylko do odczytu, a lancuch importu mostu konczyl sie zapisem
do wnetrza bundla:

    import local_bridge
      -> import auth_store                     (twardy import, bez try)
        -> auth_store.py:37  DB_PATH = _db_path()      PRZY IMPORCIE
          -> dam_db.db_path() -> _migrate_into_repo()
            -> _migrate_sqlite_canonical()
              -> REPO_DATABASE.mkdir(...)      BEZ try/except
                -> OSError: [Errno 30] Read-only file system

Most ginal przy imporcie, zanim zajal port 8766, wiec UI pokazywalo
"Most DAM niedostepny (port 8766)".

Ten test nie wymaga Maca - katalog tylko do odczytu robimy na kazdym systemie.
"""
from __future__ import annotations

import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import runtime_config as rc  # noqa: E402


class WritableProbeTests(unittest.TestCase):
    def test_writable_dir_is_detected(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertTrue(rc._dir_is_writable(Path(td)))

    def test_probe_leaves_no_rubbish(self):
        with tempfile.TemporaryDirectory() as td:
            rc._dir_is_writable(Path(td))
            self.assertEqual(list(Path(td).iterdir()), [])

    @unittest.skipIf(os.name == "nt", "Windows ignoruje bit 'tylko do odczytu' na katalogach")
    def test_readonly_dir_is_detected(self):
        with tempfile.TemporaryDirectory() as td:
            ro = Path(td) / "ro"
            ro.mkdir()
            os.chmod(ro, stat.S_IRUSR | stat.S_IXUSR)
            try:
                self.assertFalse(rc._dir_is_writable(ro))
            finally:
                os.chmod(ro, stat.S_IRWXU)

    def test_nonexistent_unwritable_parent_is_detected(self):
        """Sciezka, ktorej nie da sie utworzyc, tez musi wyjsc jako niezapisywalna."""
        bad = Path(tempfile.gettempdir()) / "dam-probe-file"
        bad.write_text("x", encoding="utf-8")
        try:
            self.assertFalse(rc._dir_is_writable(bad / "pod-plikiem"))
        finally:
            bad.unlink()


class UserDataRootTests(unittest.TestCase):
    def test_user_data_root_is_outside_app_tree(self):
        root = rc._user_data_root()
        self.assertNotIn(str(rc.CONTENT_ROOT), str(root))
        self.assertTrue(str(root).endswith("DAM"))

    def test_platform_specific_location(self):
        root = str(rc._user_data_root())
        if os.name == "nt":
            self.assertIn("DAM", root)
        elif sys.platform == "darwin":
            self.assertIn("Library", root)
            self.assertIn("Application Support", root)


class RuntimeFileFallbackTests(unittest.TestCase):
    def test_runtime_file_stays_next_to_ui_when_writable(self):
        if not rc.CONTENT_ROOT_WRITABLE:
            self.skipTest("drzewo nie jest zapisywalne w tym srodowisku")
        self.assertIn("web", str(rc.runtime_file_path()))
        self.assertIn(str(rc.WEB_ROOT), str(rc.runtime_file_path()))


class DbPathTests(unittest.TestCase):
    def test_database_dir_follows_data_root(self):
        """REPO_DATABASE musi siedziec w DATA_ROOT, nie na sztywno w bundlu."""
        import dam_db

        self.assertTrue(
            str(dam_db.REPO_DATABASE).startswith(str(rc.DATA_ROOT)),
            f"REPO_DATABASE={dam_db.REPO_DATABASE} poza DATA_ROOT={rc.DATA_ROOT}",
        )

    def test_migration_survives_readonly_target(self):
        """_migrate_sqlite_canonical NIE moze rzucic, gdy katalog jest do odczytu.

        To jest ten warunek, ktorego brak zabijal import auth_store na .dmg.
        """
        import dam_db

        with tempfile.TemporaryDirectory() as td:
            bad = Path(td) / "plik-nie-katalog"
            bad.write_text("x", encoding="utf-8")
            orig = dam_db.REPO_DATABASE
            try:
                dam_db.REPO_DATABASE = bad / "DATABASE"
                dam_db._migrate_sqlite_canonical()  # nie moze rzucic
            finally:
                dam_db.REPO_DATABASE = orig


if __name__ == "__main__":
    unittest.main()
