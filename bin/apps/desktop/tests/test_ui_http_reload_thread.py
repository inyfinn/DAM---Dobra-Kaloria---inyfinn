# -*- coding: utf-8 -*-
"""UI HTTP server must be threaded so in-tab reload is not stalled by abort."""
from __future__ import annotations

import inspect
import socketserver
import sys
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

from dam_ui_http import DamUiRequestHandler, ThreadingReusableTCPServer  # noqa: E402


class ThreadingUiServerTests(unittest.TestCase):
    def test_ui_server_is_threaded(self):
        self.assertTrue(issubclass(ThreadingReusableTCPServer, socketserver.ThreadingMixIn))
        self.assertTrue(issubclass(ThreadingReusableTCPServer, socketserver.TCPServer))
        self.assertTrue(ThreadingReusableTCPServer.daemon_threads)

    def test_copyfile_swallows_client_abort(self):
        src = inspect.getsource(DamUiRequestHandler.copyfile)
        self.assertIn("10053", src)
        self.assertIn("_CLIENT_GONE", src)

    def test_windows_bind_is_exclusive(self):
        src = inspect.getsource(ThreadingReusableTCPServer.server_bind)
        self.assertIn("SO_EXCLUSIVEADDRUSE", src)


if __name__ == "__main__":
    unittest.main()
