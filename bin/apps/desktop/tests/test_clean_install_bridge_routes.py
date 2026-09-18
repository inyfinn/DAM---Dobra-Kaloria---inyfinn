# -*- coding: utf-8 -*-
"""Etap 3 - trasy /app-update/* mostu:
1) w PUBLIC_MODE (most na NAS) musza byc niedostepne (desktop_only, 404) -
   publiczny NAS nigdy nie moze pobrac/uruchomic instalatora Windows;
2) POST /app-update/apply musi isc przez app_updates.apply_action(...), gdy
   ten kontrakt istnieje (wpiety przez innego wykonawce), z fallbackiem na
   stary kod, gdy jeszcze nie istnieje;
3) GET /app-update/success musi wolac app_updates.consume_success_marker().

Prawdziwy serwer HTTP na 127.0.0.1 (jak w test_public_mode.py), ale
app_updates jest mockiem - zero prawdziwego GitHuba / pobierania / instalatora.
"""
from __future__ import annotations

import http.client
import json
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parent.parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import local_bridge  # noqa: E402


REQUIRED_PUBLIC_FORBIDDEN = {
    "/app-update/apply",
    "/app-update/check",
    "/app-update/status",
    "/app-update/prefs",
    "/app-update/success",
}


class PublicForbiddenPathsTests(unittest.TestCase):
    def test_all_app_update_paths_are_public_forbidden(self):
        self.assertTrue(REQUIRED_PUBLIC_FORBIDDEN.issubset(local_bridge.PUBLIC_FORBIDDEN_PATHS))

    def test_dead_entries_removed(self):
        self.assertNotIn("/app-update/install", local_bridge.PUBLIC_FORBIDDEN_PATHS)
        self.assertNotIn("/app-update/download", local_bridge.PUBLIC_FORBIDDEN_PATHS)


class _BridgeServerCase(unittest.TestCase):
    """Wspolna infrastruktura: prawdziwy ThreadingHTTPServer na losowym porcie."""

    def setUp(self):
        self.patches = []
        self.httpd = None

    def _start(self):
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), local_bridge.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        if self.httpd is not None:
            self.httpd.shutdown()
            self.httpd.server_close()
        for p in reversed(self.patches):
            p.stop()

    def _patch(self, *args, **kwargs):
        p = mock.patch(*args, **kwargs) if isinstance(args[0], str) else mock.patch.object(*args, **kwargs)
        p.start()
        self.patches.append(p)
        return p

    def _req(self, method, path, body=None, host="127.0.0.1"):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        hdrs = {"Host": host}
        payload = json.dumps(body).encode() if body is not None else None
        if payload is not None:
            hdrs["Content-Type"] = "application/json"
        conn.request(method, path, body=payload, headers=hdrs)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        try:
            return resp.status, json.loads(data)
        except ValueError:
            return resp.status, {}


class PublicModeBlocksAppUpdateTests(_BridgeServerCase):
    def setUp(self):
        super().setUp()
        self._patch(local_bridge, "PUBLIC_MODE", True)
        self._patch(local_bridge, "PUBLIC_HOSTS", {"127.0.0.1"})
        self._patch(local_bridge, "resolve_session", return_value={"ok": False, "error": "no_token"})
        self._start()

    def test_get_routes_blocked(self):
        for path in ("/app-update/check", "/app-update/status", "/app-update/prefs", "/app-update/success"):
            status, data = self._req("GET", path)
            self.assertEqual(status, 404, path)
            self.assertEqual(data.get("error"), "desktop_only", path)

    def test_post_apply_blocked(self):
        status, data = self._req("POST", "/app-update/apply", body={"action": "install"})
        self.assertEqual(status, 404)
        self.assertEqual(data.get("error"), "desktop_only")


class AppUpdateApplyWiringTests(_BridgeServerCase):
    """Tryb desktop (nie public) - most lokalny bez wymogu sesji na tych trasach."""

    def setUp(self):
        super().setUp()
        self._patch(local_bridge, "PUBLIC_MODE", False)
        self._start()

    def test_apply_action_used_when_contract_present(self):
        fake = mock.Mock()
        fake.apply_action.return_value = {"ok": True, "via": "apply_action", "action": "install"}
        self._patch(local_bridge, "app_updates", fake)

        status, data = self._req("POST", "/app-update/apply", body={"action": "install", "download_url": "u"})
        self.assertEqual(status, 200)
        self.assertEqual(data, {"ok": True, "via": "apply_action", "action": "install"})
        fake.apply_action.assert_called_once_with("install", "u")

    def test_fallback_used_when_contract_absent(self):
        fake = mock.Mock(spec=["install_downloaded", "start_background_download", "download_and_launch_installer"])
        fake.install_downloaded.return_value = {"ok": True, "via": "fallback"}
        self._patch(local_bridge, "app_updates", fake)

        status, data = self._req("POST", "/app-update/apply", body={"action": "install", "download_url": "u"})
        self.assertEqual(status, 200)
        self.assertEqual(data, {"ok": True, "via": "fallback"})
        fake.install_downloaded.assert_called_once_with("u")
        fake.apply_action.assert_not_called() if hasattr(fake, "apply_action") else None

    def test_success_endpoint_uses_consume_success_marker_when_present(self):
        fake = mock.Mock()
        fake.consume_success_marker.return_value = {"ok": True, "version": "2.1.0"}
        self._patch(local_bridge, "app_updates", fake)

        status, data = self._req("GET", "/app-update/success")
        self.assertEqual(status, 200)
        self.assertEqual(data, {"ok": True, "version": "2.1.0"})

    def test_success_endpoint_falls_back_when_marker_fn_absent(self):
        fake = mock.Mock(spec=["check_for_updates"])  # no consume_success_marker
        self._patch(local_bridge, "app_updates", fake)

        status, data = self._req("GET", "/app-update/success")
        self.assertEqual(status, 200)
        self.assertEqual(data, {"ok": True, "version": None})


if __name__ == "__main__":
    unittest.main()
