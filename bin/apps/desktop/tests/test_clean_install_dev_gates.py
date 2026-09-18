# -*- coding: utf-8 -*-
"""Etap 3 - zadania deweloperskie (ssh syno + git, godzinowy zrzut Postgresa z
tabela users) musza dzialac tylko w drzewie z .git (app_updates.is_portable_repo()).

Zero prawdziwego mostu, zero prawdziwej bazy, zero prawdziwego ssh/git - same
mocki na app_updates.is_portable_repo / pg_db / dam_sync.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import app_updates  # noqa: E402
import local_bridge  # noqa: E402
import dam_db  # noqa: E402


class PgBackupWatcherGateTests(unittest.TestCase):
    """local_bridge._pg_backup_watcher: godzinowy zrzut z tabela users - dev-tree-only."""

    def test_skips_entirely_on_installed_copy(self):
        with mock.patch.object(app_updates, "is_portable_repo", return_value=False):
            with mock.patch.object(local_bridge, "app_updates", app_updates):
                with mock.patch.object(local_bridge, "run_hourly_pg_backup") as m_backup:
                    with mock.patch.object(local_bridge, "_pg_backup_git_sync") as m_git:
                        with mock.patch.object(local_bridge, "_pg_backup_log") as m_log:
                            local_bridge._pg_backup_watcher()  # must return immediately, no loop
        m_backup.assert_not_called()
        m_git.assert_not_called()
        self.assertTrue(
            any("not_dev_tree" in str(call.args) for call in m_log.call_args_list),
            "expected a skip log mentioning not_dev_tree",
        )

    def test_app_updates_missing_also_skips(self):
        with mock.patch.object(local_bridge, "app_updates", None):
            with mock.patch.object(local_bridge, "run_hourly_pg_backup") as m_backup:
                local_bridge._pg_backup_watcher()
        m_backup.assert_not_called()


class RunHourlyPgBackupGateTests(unittest.TestCase):
    """Manualne 'Uruchom teraz' (Zadania w tle) tez nie moze zrzucac users na kliencie."""

    def test_returns_error_without_touching_pg_on_installed_copy(self):
        with mock.patch.object(app_updates, "is_portable_repo", return_value=False):
            with mock.patch.object(local_bridge, "app_updates", app_updates):
                result = local_bridge.run_hourly_pg_backup()
        self.assertFalse(result.get("ok"))
        self.assertEqual(result.get("error"), "not_dev_tree")

    def test_proceeds_to_pg_db_import_on_dev_tree(self):
        """Na drzewie dev funkcja idzie dalej - liczy sie, ze NIE zwraca
        not_dev_tree. Health wymuszony na 'niedostepny', zeby test NIGDY nie
        polaczyl sie z prawdziwa produkcyjna baza / nie zrobil realnego
        COPY users."""
        import pg_db

        with mock.patch.object(app_updates, "is_portable_repo", return_value=True):
            with mock.patch.object(local_bridge, "app_updates", app_updates):
                with mock.patch.object(
                    pg_db, "cached_health", return_value={"ok": False, "error": "test_forced_down"}
                ):
                    with mock.patch.object(pg_db, "ping_live", return_value={"ok": False}):
                        with mock.patch("time.sleep"):
                            result = local_bridge.run_hourly_pg_backup()
        self.assertNotEqual(result.get("error"), "not_dev_tree")
        self.assertEqual(result.get("error"), "health_pending")


class StartBgJobHiddenGateTests(unittest.TestCase):
    """db-git-sync (schtask 'Kopia zrzutow bazy do gita') - ssh+git, dev-tree-only."""

    def test_db_git_sync_blocked_on_installed_copy(self):
        with mock.patch.object(app_updates, "is_portable_repo", return_value=False):
            with mock.patch.object(local_bridge, "app_updates", app_updates):
                with mock.patch("subprocess.Popen") as m_popen:
                    result = local_bridge._start_bg_job_hidden("db-git-sync")
        self.assertFalse(result.get("ok"))
        self.assertEqual(result.get("error"), "not_dev_tree")
        m_popen.assert_not_called()

    def test_db_git_sync_allowed_on_dev_tree_reaches_wrapper_check(self):
        # Never actually spawn PowerShell/the wrapper here - just prove the
        # portability gate let execution past the not_dev_tree refusal.
        with mock.patch.object(app_updates, "is_portable_repo", return_value=True):
            with mock.patch.object(local_bridge, "app_updates", app_updates):
                with mock.patch("subprocess.Popen") as m_popen:
                    result = local_bridge._start_bg_job_hidden("db-git-sync")
        self.assertNotEqual(result.get("error"), "not_dev_tree")
        # Either the wrapper file was found and Popen was invoked, or it
        # reported missing_wrapper - both are fine; not_dev_tree is what we
        # are actually testing for.

    def test_other_job_ids_unaffected_by_the_gate(self):
        with mock.patch.object(app_updates, "is_portable_repo", return_value=False):
            with mock.patch.object(local_bridge, "app_updates", app_updates):
                with mock.patch("subprocess.Popen") as m_popen:
                    result = local_bridge._start_bg_job_hidden("panel-dam-sync")
        self.assertNotEqual(result.get("error"), "not_dev_tree")


class PullDatabaseDumpNowGateTests(unittest.TestCase):
    """dam_db.pull_database_dump_now(): ssh+git dump-pull, dev-tree-only.
    Offline fallback (lokalny dump juz na dysku) nadal liczy sie jako ok."""

    def test_installed_copy_skips_without_local_dump(self):
        # is_portable_repo()==False -> early return, before dam_sync is even
        # imported - nothing to spawn, nothing to mock-and-assert-not-called
        # beyond the absence of any exception / ssh / git side effect.
        with mock.patch.object(app_updates, "is_portable_repo", return_value=False):
            with mock.patch("dam_db.latest_database_dump", return_value=None):
                result = dam_db.pull_database_dump_now()
        self.assertFalse(result.get("ok"))
        self.assertTrue(result.get("skipped"))
        self.assertEqual(result.get("error"), "not_dev_tree")

    def test_installed_copy_keeps_local_dump_as_ok(self):
        fake_dump = Path("dam_eta_2026-09-18_00.sql.gz")
        with mock.patch.object(app_updates, "is_portable_repo", return_value=False):
            with mock.patch("dam_db.latest_database_dump", return_value=fake_dump):
                result = dam_db.pull_database_dump_now()
        self.assertTrue(result.get("ok"))
        self.assertTrue(result.get("skipped"))
        self.assertEqual(result.get("note"), "local_retained")

    def test_dev_tree_still_calls_run_sync_blocking(self):
        with mock.patch.object(app_updates, "is_portable_repo", return_value=True):
            with mock.patch("dam_db.latest_database_dump", return_value=None):
                with mock.patch(
                    "dam_sync.run_sync_blocking", return_value={"ok": True}
                ) as m_sync:
                    dam_db.pull_database_dump_now()
        m_sync.assert_called_once()


if __name__ == "__main__":
    unittest.main()
