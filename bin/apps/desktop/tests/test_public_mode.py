"""Tryb publiczny mostu (NAS za nginx /dam-api/) + blokada IP: 3 bledy w 999 min = blok do odblokowania przez admina."""
import http.client
import json
import sqlite3
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import ip_guard  # noqa: E402
import local_bridge  # noqa: E402

OFFICE = "89.25.208.179"
STRANGER = "203.0.113.7"


class PublicModeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        db = str(Path(self.tmp.name) / "guard.sqlite")

        def connect():
            c = sqlite3.connect(db)
            c.row_factory = sqlite3.Row
            return c

        ip_guard._connect_override = connect
        ip_guard._use_pg_override = lambda: False
        ip_guard._SCHEMA_READY = False
        self.login_result = {"ok": False, "error": "invalid_credentials"}
        self.patches = [
            mock.patch.object(local_bridge, "PUBLIC_MODE", True),
            mock.patch.object(local_bridge, "PUBLIC_HOSTS", {"inyfinn.synology.me"}),
            mock.patch.object(local_bridge, "auth_login", side_effect=lambda *a, **k: dict(self.login_result)),
            mock.patch.object(local_bridge, "resolve_session", return_value={"ok": False, "error": "no_token"}),
        ]
        for p in self.patches:
            p.start()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), local_bridge.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        for p in self.patches:
            p.stop()
        ip_guard._connect_override = None
        ip_guard._use_pg_override = None
        ip_guard._SCHEMA_READY = False
        self.tmp.cleanup()

    def _req(self, method, path, ip=STRANGER, body=None, host="inyfinn.synology.me"):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        hdrs = {"Host": host, "X-Real-IP": ip}
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

    def test_public_host_allowed_foreign_rejected(self):
        self.assertEqual(self._req("GET", "/health")[0], 200)
        self.assertEqual(self._req("GET", "/health", host="evil.example")[0], 403)

    def test_health_is_minimal_for_anonymous(self):
        status, data = self._req("GET", "/health")
        self.assertEqual(set(data.keys()), {"ok", "service"})

    def test_everything_else_needs_session(self):
        for path in ("/machine-config", "/db/kv?key=program-instructions", "/folder-browse?path=x", "/thumb-cache/status"):
            self.assertEqual(self._req("GET", path)[0], 401, path)

    def test_desktop_only_paths_are_gone(self):
        for path in ("/telemetry/tail", "/auth/identity", "/debug/self-test"):
            self.assertEqual(self._req("GET", path)[0], 404, path)
        for path in ("/open", "/reveal", "/pick-folder", "/auth/rehydrate", "/db/activate"):
            self.assertEqual(self._req("POST", path, body={"path": "x"})[0], 404, path)

    def test_three_failures_block_ip_until_admin_unblocks(self):
        body = {"email": "a@kubara.pl", "password": "zle"}
        s1, d1 = self._req("POST", "/auth/login", body=body)
        self.assertEqual((d1["error"], d1["attempts_left"]), ("invalid_credentials", 2))
        self._req("POST", "/auth/login", body=body)
        s3, d3 = self._req("POST", "/auth/login", body=body)
        self.assertEqual(d3["error"], "ip_blocked")
        # zablokowany adres nie dostaje juz nic - nawet z poprawnym haslem
        self.login_result = {"ok": True, "token": "t"}
        status, data = self._req("POST", "/auth/login", body=body)
        self.assertEqual((status, data["error"]), (403, "ip_blocked"))
        self.assertEqual(self._req("GET", "/health")[0], 403)
        # inny adres dziala normalnie
        self.assertTrue(self._req("POST", "/auth/login", ip="198.51.100.9", body=body)[1]["ok"])
        self.assertEqual([b["ip"] for b in ip_guard.list_blocks()], [STRANGER])
        self.assertTrue(ip_guard.unblock(STRANGER))
        self.assertTrue(self._req("POST", "/auth/login", body=body)[1]["ok"])

    def test_office_ip_is_never_blocked(self):
        body = {"email": "a@kubara.pl", "password": "zle"}
        for _ in range(6):
            status, data = self._req("POST", "/auth/login", ip=OFFICE, body=body)
            self.assertEqual(data["error"], "invalid_credentials")
        self.assertEqual(ip_guard.list_blocks(), [])

    def test_success_resets_typo_counter(self):
        bad = {"email": "a@kubara.pl", "password": "zle"}
        self._req("POST", "/auth/login", body=bad)
        self._req("POST", "/auth/login", body=bad)
        self.login_result = {"ok": True, "token": "t"}
        self._req("POST", "/auth/login", body=bad)
        self.login_result = {"ok": False, "error": "invalid_credentials"}
        self.assertEqual(self._req("POST", "/auth/login", body=bad)[1]["attempts_left"], 2)

    def test_garbage_ip_header_is_ignored(self):
        self.assertEqual(ip_guard.normalize_ip("1.2.3.4, 5.6.7.8"), "1.2.3.4")
        self.assertEqual(ip_guard.normalize_ip("'; DROP TABLE x;--"), "")
        self.assertEqual(ip_guard.normalize_ip("::ffff:89.25.208.179"), OFFICE)


if __name__ == "__main__":
    unittest.main()
