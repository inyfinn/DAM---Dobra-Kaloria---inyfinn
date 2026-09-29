# -*- coding: utf-8 -*-
"""Kolejka polaczen serwerow HTTP (29.09.2026): domyslne 5 odrzucalo polaczenia przy
siatce z dziesiatkami miniatur (WinError 10061 -> zepsute obrazki w Wizualizacjach)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))


class HttpBacklog(unittest.TestCase):
    def test_bridge_server_backlog(self):
        import local_bridge as lb

        self.assertGreaterEqual(lb.BridgeHTTPServer.request_queue_size, 128)
        self.assertTrue(lb.BridgeHTTPServer.daemon_threads)
        src = Path(lb.__file__).read_text(encoding="utf-8")
        self.assertIn("httpd = BridgeHTTPServer((HOST, PORT), Handler)", src)

    def test_ui_server_backlog(self):
        import dam_ui_http

        self.assertGreaterEqual(dam_ui_http.ThreadingReusableTCPServer.request_queue_size, 64)


if __name__ == "__main__":
    unittest.main()
