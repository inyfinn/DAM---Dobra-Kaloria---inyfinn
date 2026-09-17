"""Audyt 2026-09-17: Host (DNS rebinding), cross-site, bramki logowania, blokada plikow wykonywalnych."""
import http.client
import json
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import local_bridge  # noqa: E402


class BridgeSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), local_bridge.Handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def _req(self, method, path, headers=None, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        hdrs = dict(headers or {})
        payload = json.dumps(body).encode() if body is not None else None
        if payload is not None:
            hdrs.setdefault("Content-Type", "application/json")
        conn.request(method, path, body=payload, headers=hdrs)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, data

    def test_foreign_host_rejected(self):
        status, _ = self._req("GET", "/auth/identity", {"Host": "evil.example:8766"})
        self.assertEqual(status, 403)

    def test_loopback_host_allowed(self):
        status, _ = self._req("GET", "/auth/registration-open")
        self.assertEqual(status, 200)
        status, _ = self._req("GET", "/auth/registration-open", {"Host": "localhost:%d" % self.port})
        self.assertEqual(status, 200)

    def test_cross_site_fetch_rejected(self):
        status, _ = self._req("GET", "/auth/registration-open", {"Sec-Fetch-Site": "cross-site"})
        self.assertEqual(status, 403)

    def test_foreign_origin_rejected(self):
        status, _ = self._req("GET", "/auth/registration-open", {"Origin": "https://evil.example"})
        self.assertEqual(status, 403)

    def test_open_and_reveal_need_login(self):
        with mock.patch.object(local_bridge, "open_in_default_app") as opened, mock.patch.object(
            local_bridge, "reveal_in_explorer"
        ) as revealed:
            for path in ("/open", "/reveal"):
                status, _ = self._req("POST", path, body={"path": "D:/Marketing/x.pdf"})
                self.assertEqual(status, 401, path)
            opened.assert_not_called()
            revealed.assert_not_called()

    def test_telemetry_and_selftest_need_login(self):
        for path in ("/telemetry/tail", "/debug/self-test"):
            status, _ = self._req("GET", path)
            self.assertEqual(status, 401, path)

    def test_rehydrate_without_session_id_refused(self):
        status, data = self._req("POST", "/auth/rehydrate", body={"machine_id": "x"})
        self.assertEqual(status, 200)
        self.assertFalse(json.loads(data)["ok"])

    def test_wrong_activation_code(self):
        status, data = self._req("POST", "/db/activate", body={"code": "AAAAA-AAAAA-AAAAA-AAAAA-AAAAA"})
        self.assertEqual(status, 400)
        self.assertFalse(json.loads(data)["ok"])


class OpenBlocklistTests(unittest.TestCase):
    def test_executable_blocked_before_startfile(self):
        with mock.patch.object(local_bridge.os.path, "exists", return_value=True), mock.patch.object(
            local_bridge, "_is_under_marketing", return_value=True
        ), mock.patch.object(local_bridge.os.path, "isfile", return_value=True), mock.patch.object(
            local_bridge.os, "startfile", create=True
        ) as startfile:
            for name in ("D:/Marketing/x.bat", "D:/Marketing/x.LNK", "D:/Marketing/faktura.pdf.exe"):
                res = local_bridge.open_in_default_app(name)
                self.assertEqual(res.get("error"), "file_type_blocked", name)
            startfile.assert_not_called()
            self.assertTrue(local_bridge.open_in_default_app("D:/Marketing/x.pdf").get("ok"))
            startfile.assert_called_once()


if __name__ == "__main__":
    unittest.main()
