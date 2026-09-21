# -*- coding: utf-8 -*-
"""Stary instalator w cache nie moze udawac najnowszej wersji.

Objaw: DAM 2.1.1 uparcie proponowal 2.1.2, choc na GitHubie bylo juz 2.1.5.
Przyczyna: _ready_version() oddawalo KAZDY pobrany i podpisany instalator
nowszy od biezacego, a download_status() promowalo go na "ready". Aplikacja
nigdy nie porownywala go z tym, co faktycznie wisi na GitHubie, wiec w kolko
instalowala "nastepna po kolei" wersje z dnia pierwszego pobrania.
"""
from __future__ import annotations

import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import app_updates as au  # noqa: E402


class ReadyVersionTests(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.dir = Path(self.td.name)
        for v in ("2.1.2",):
            (self.dir / v).mkdir(parents=True, exist_ok=True)
            (self.dir / v / au.DEFAULT_ASSET).write_bytes(b"setup")
        self.p = mock.patch.object(au, "INSTALLER_DIR", self.dir)
        self.p.start()

    def tearDown(self):
        self.p.stop()
        self.td.cleanup()

    def _ctx(self, known_latest: str):
        return (
            mock.patch.object(au, "current_version", return_value="2.1.1"),
            mock.patch.object(au, "installer_ready", side_effect=lambda v=None: True),
            mock.patch.object(au, "known_github_latest", return_value=known_latest),
        )

    def test_stale_cached_installer_is_refused(self):
        a, b, c = self._ctx("2.1.5")
        with a, b, c:
            self.assertEqual(au._ready_version(), "")

    def test_cached_installer_equal_to_latest_is_used(self):
        a, b, c = self._ctx("2.1.2")
        with a, b, c:
            self.assertEqual(au._ready_version(), "2.1.2")

    def test_no_github_knowledge_keeps_old_behaviour(self):
        a, b, c = self._ctx("")
        with a, b, c:
            self.assertEqual(au._ready_version(), "2.1.2")


class InstallActionTests(unittest.TestCase):
    def test_install_downloads_instead_of_running_stale_setup(self):
        calls = []
        with (
            mock.patch.object(au, "_state_target", return_value="2.1.2"),
            mock.patch.object(au, "current_version", return_value="2.1.1"),
            mock.patch.object(au, "installer_path") as ipath,
            mock.patch.object(au, "_cache_is_fresh", return_value=True),
            mock.patch.object(au, "installer_ready", return_value=True),
            mock.patch.object(au, "known_github_latest", return_value="2.1.5"),
            mock.patch.object(au, "_action_download", side_effect=lambda: calls.append("download") or {"ok": True}),
            mock.patch.object(au, "_launch_installer", side_effect=lambda p: calls.append("launch") or {"ok": True}),
        ):
            ipath.return_value = mock.Mock(is_file=lambda: True)
            au._action_install()
        self.assertEqual(calls, ["download"])

    def test_install_runs_setup_when_it_is_the_latest(self):
        calls = []
        with (
            mock.patch.object(au, "_state_target", return_value="2.1.5"),
            mock.patch.object(au, "current_version", return_value="2.1.1"),
            mock.patch.object(au, "installer_path") as ipath,
            mock.patch.object(au, "_cache_is_fresh", return_value=True),
            mock.patch.object(au, "installer_ready", return_value=True),
            mock.patch.object(au, "known_github_latest", return_value="2.1.5"),
            mock.patch.object(au, "_action_download", side_effect=lambda: calls.append("download") or {"ok": True}),
            mock.patch.object(au, "_launch_installer", side_effect=lambda p: calls.append("launch") or {"ok": True}),
        ):
            ipath.return_value = mock.Mock(is_file=lambda: True)
            au._action_install()
        self.assertEqual(calls, ["launch"])


class DownloadActionTests(unittest.TestCase):
    def test_stale_cache_triggers_fresh_github_check(self):
        started = []
        with (
            mock.patch.object(au, "_cache_is_fresh", return_value=False),
            mock.patch.object(au, "_start_download", side_effect=lambda rel: started.append(rel) or {}),
            mock.patch.object(au, "check_for_updates") as chk,
            mock.patch.object(au, "download_status", return_value={"ok": True}),
            mock.patch.object(au, "_set_state_if_quiet"),
            mock.patch("threading.Thread"),
        ):
            au._action_download()
        # Przy nieswiezym cache nie wolno pobierac na podstawie starego wyniku.
        self.assertEqual(started, [])
        chk.assert_not_called()


if __name__ == "__main__":
    unittest.main()
