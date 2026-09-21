"""Audyt 2026-09-17: slabe haslo (dawne 'test' kont seed) nie daje sesji; zmiana hasla; limit prob.

Test dziala WYLACZNIE na tymczasowym SQLite w pamieci procesu - nigdy na bazie Synology.
"""
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import auth_store  # noqa: E402

SCHEMA = """
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', password_hash TEXT NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'local', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE device_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, device_id TEXT NOT NULL,
  machine_id TEXT NOT NULL DEFAULT '', session_id TEXT NOT NULL DEFAULT '',
  windows_user TEXT NOT NULL DEFAULT '', hostname TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id, device_id));
"""


class PasswordPolicyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = str(Path(self.tmp.name) / "t.sqlite")
        conn = sqlite3.connect(self.db)
        conn.executescript(SCHEMA)
        conn.commit()
        conn.close()

        def connect():
            c = sqlite3.connect(self.db)
            c.row_factory = sqlite3.Row
            return c

        import machine_identity

        self.patches = [
            mock.patch.object(auth_store, "_use_pg", return_value=False),
            mock.patch.object(auth_store, "init_db", return_value=None),
            mock.patch.object(auth_store, "_connect", side_effect=connect),
            mock.patch.object(
                auth_store,
                "_current_identity",
                return_value={"machine_id": "m-test", "device_id": "d-test", "hostname": "h", "windows_user": "u"},
            ),
            mock.patch.object(machine_identity, "write_bound_session", return_value=None),
        ]
        for p in self.patches:
            p.start()
        auth_store._LOGIN_FAILS.clear()
        self._connect = connect

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def _insert_legacy_user(self, email, password):
        c = self._connect()
        c.execute(
            "INSERT INTO users (email, name, role, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (email, "X", "admin", auth_store._hash_password(password), "t", "t"),
        )
        c.commit()
        c.close()

    def test_policy(self):
        self.assertEqual(auth_store.password_policy_error("test"), "password_too_short")
        self.assertEqual(auth_store.password_policy_error("1234567890"), "password_too_weak")
        self.assertEqual(auth_store.password_policy_error("aaaaaaaaaaaa"), "password_too_weak")
        self.assertEqual(auth_store.password_policy_error("jan.kowalski", "jan.kowalski@kubara.pl"), "password_too_weak")
        self.assertEqual(auth_store.password_policy_error("zielony-rower-42"), "")

    def test_register_rejects_weak(self):
        self.assertEqual(auth_store.register_user("a@kubara.pl", "test")["error"], "password_too_short")
        self.assertTrue(auth_store.register_user("a@kubara.pl", "zielony-rower-42")["ok"])

    def test_legacy_test_password_gets_no_session(self):
        self._insert_legacy_user("admin@kubara.pl", "test")
        res = auth_store.login("admin@kubara.pl", "test")
        self.assertFalse(res["ok"])
        self.assertEqual(res["error"], "password_change_required")
        self.assertNotIn("token", res)
        c = self._connect()
        self.assertEqual(c.execute("SELECT COUNT(*) FROM device_sessions").fetchone()[0], 0)
        c.close()

    def test_beta_skip_gives_session_only_when_allowed(self):
        self._insert_legacy_user("admin@kubara.pl", "test")
        self.assertEqual(auth_store.login("admin@kubara.pl", "test")["error"], "password_change_required")
        res = auth_store.login("admin@kubara.pl", "test", allow_weak_password=True)
        self.assertTrue(res["ok"])
        self.assertTrue(res["token"])
        self.assertEqual(
            auth_store.login("admin@kubara.pl", "zle", allow_weak_password=True)["error"], "invalid_credentials"
        )

    def test_change_password_then_login(self):
        self._insert_legacy_user("admin@kubara.pl", "test")
        self.assertEqual(
            auth_store.change_password("admin@kubara.pl", "zle", "zielony-rower-42")["error"], "invalid_credentials"
        )
        self.assertEqual(
            auth_store.change_password("admin@kubara.pl", "test", "testtest")["error"], "password_too_short"
        )
        self.assertTrue(auth_store.change_password("admin@kubara.pl", "test", "zielony-rower-42")["ok"])
        self.assertEqual(auth_store.login("admin@kubara.pl", "test")["error"], "invalid_credentials")
        ok = auth_store.login("admin@kubara.pl", "zielony-rower-42")
        self.assertTrue(ok["ok"])
        self.assertTrue(ok["token"])

    def test_login_throttle(self):
        self._insert_legacy_user("admin@kubara.pl", "zielony-rower-42")
        for _ in range(auth_store._LOGIN_MAX_FAILS):
            self.assertEqual(auth_store.login("admin@kubara.pl", "zgaduje")["error"], "invalid_credentials")
        self.assertEqual(auth_store.login("admin@kubara.pl", "zielony-rower-42")["error"], "too_many_attempts")


if __name__ == "__main__":
    unittest.main()
