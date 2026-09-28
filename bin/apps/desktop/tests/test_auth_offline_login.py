# -*- coding: utf-8 -*-
"""W8 (28.09.2026), zgloszenie wlasciciela na instalacji 2.4.6: przy logowaniu
"Most DAM niedostepny (port 8766) (Failed to fetch)".

bridge-stderr.log: POST /auth/login -> auth_store.login -> sqlite3.OperationalError:
no such table: device_sessions. Lancuch:
  1. pierwsze polaczenie PG nie zdazylo (pg_db._CONNECT_TIMEOUT_S = 1) -> dam_db offline,
  2. logowanie poszlo do lokalnej SQLite (konta seed, "haslo za slabe"),
  3. SQLite swiezej instalacji nie ma device_sessions (init_db zapamietal wynik z PG albo
     mirror zakladal tylko tabele users) -> wyjatek w watku HTTP -> zerwane polaczenie ->
     UI pokazuje mylace "Most niedostepny".

Testy nigdy nie lacza sie z zadnym PostgreSQL: psycopg2.connect i stan dam_db sa podmienione.
"""
from __future__ import annotations

import sqlite3
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import auth_store  # noqa: E402
import dam_db  # noqa: E402
import pg_db  # noqa: E402


def _tables(path: Path) -> set[str]:
    c = sqlite3.connect(str(path))
    try:
        return {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    finally:
        c.close()


class _DamDbSandbox(unittest.TestCase):
    """dam_db na pustym, tymczasowym pliku SQLite; stan offline przywracany po tescie."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.db = Path(tmp.name) / "dam-local.sqlite"
        saved = {k: getattr(dam_db, k) for k in ("_OFFLINE_MODE", "_OFFLINE_REASON", "_OFFLINE_SINCE",
                                                  "_INITIALIZED", "_INIT_RESULT")}
        saved_sch = set(getattr(dam_db, "_SQLITE_SCHEMA_READY", set()) or set())

        def restore():
            for k, v in saved.items():
                setattr(dam_db, k, v)
            if hasattr(dam_db, "_SQLITE_SCHEMA_READY"):
                dam_db._SQLITE_SCHEMA_READY.clear()
                dam_db._SQLITE_SCHEMA_READY.update(saved_sch)

        self.addCleanup(restore)
        for p in (
            mock.patch.object(dam_db, "db_path", return_value=self.db),
            mock.patch.object(dam_db, "USERS_SEED", Path(tmp.name) / "brak-seed.sqlite"),
        ):
            p.start()
            self.addCleanup(p.stop)


class FreshSqliteSchemaTests(_DamDbSandbox):
    def test_fresh_empty_sqlite_connection_has_device_sessions(self):
        """Swieza, pusta baza: pierwsze polaczenie SQLite (np. zapas offline po init z PG)
        musi miec tabele logowania - bez init_db() w tym procesie."""
        conn = dam_db._connect_sqlite()
        conn.close()
        self.assertTrue({"users", "device_sessions", "audit_log"} <= _tables(self.db))

    def test_mirror_of_pg_users_keeps_full_schema(self):
        """Mirror kont z PG do SQLite zakladal tylko tabele users."""
        class _Cur:
            def execute(self, *a, **k):
                pass

            def fetchall(self):
                return [{"email": "a@b.pl", "name": "A", "role": "admin", "password_hash": "x",
                         "auth_provider": "local", "created_at": "t", "updated_at": "t"}]

        class _Pg:
            def cursor(self):
                return _Cur()

            def close(self):
                pass

        with mock.patch.object(pg_db, "connect", return_value=_Pg()):
            dam_db._mirror_pg_users_to_sqlite()
        self.assertIn("device_sessions", _tables(self.db))


class OfflineLoginTests(_DamDbSandbox):
    def setUp(self):
        super().setUp()
        for p in (
            mock.patch.object(auth_store, "init_db", return_value=None),
            mock.patch.object(auth_store, "_current_identity",
                              return_value={"machine_id": "m-t", "device_id": "d-t", "hostname": "h",
                                            "windows_user": "u"}),
            mock.patch.object(dam_db, "synology_allowed", return_value=True),
            mock.patch.object(dam_db, "pg_configured", return_value=True),
            # zaden prawdziwy PG: proba polaczenia zawsze pada
            mock.patch.object(pg_db, "connect", side_effect=RuntimeError("Postgres niedostepny (test)")),
        ):
            p.start()
            self.addCleanup(p.stop)
        auth_store._LOGIN_FAILS.clear()
        # konto seed ze slabym haslem w lokalnej SQLite (tak wyglada instalacja 2.4.6)
        conn = dam_db._connect_sqlite()
        dam_db._init_sqlite()
        conn.execute("INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at) "
                     "VALUES (?,?,?,?,?,?,?)",
                     ("seed@kubara.pl", "Seed", "admin", auth_store._hash_password("test"), "local", "t", "t"))
        conn.commit()
        conn.close()
        dam_db._enter_offline("Postgres niedostepny (test)")

    def test_login_offline_with_pg_configured_returns_db_offline(self):
        res = auth_store.login("seed@kubara.pl", "test")
        self.assertEqual(res.get("error"), "db_offline", res)
        self.assertFalse(res.get("ok"))
        self.assertIn("Baza chwilowo niedostępna", res.get("message", ""))

    def test_login_offline_never_raises(self):
        try:
            auth_store.login("seed@kubara.pl", "cokolwiek-dlugie-haslo")
        except Exception as exc:  # noqa: BLE001
            self.fail(f"login rzucil wyjatek zamiast bledu JSON: {exc!r}")


class PgTimeoutTests(unittest.TestCase):
    def _kwargs(self, last_host):
        seen = {}

        class _Conn:
            def close(self):
                pass

        def fake_connect(**kw):
            seen.update(kw)
            return _Conn()

        cfg = {"host": "h.invalid", "hosts": ["h.invalid"], "port": 5433, "dbname": "x", "user": "u",
               "password": "p", "sslmode": "require"}
        import types

        fake_pg = types.SimpleNamespace(connect=fake_connect, OperationalError=RuntimeError,
                                        extras=types.SimpleNamespace(RealDictCursor=object))
        with mock.patch.object(pg_db, "_load_config", return_value=cfg), \
                mock.patch.object(pg_db, "_primary_host", return_value="h.invalid"), \
                mock.patch.object(pg_db, "_LAST_HOST", last_host), \
                mock.patch.object(pg_db, "psycopg2", fake_pg):
            pg_db.connect()
        return seen

    def test_first_connection_gets_longer_timeout(self):
        self.assertGreaterEqual(self._kwargs(None)["connect_timeout"], 5)

    def test_steady_state_timeout_stays_short(self):
        self.assertLessEqual(self._kwargs("h.invalid")["connect_timeout"], 2)


class QuickReturnFromOfflineTests(unittest.TestCase):
    def setUp(self):
        saved = (dam_db._OFFLINE_MODE, dam_db._OFFLINE_SINCE, dict(pg_db._HEALTH))

        def restore():
            dam_db._OFFLINE_MODE, dam_db._OFFLINE_SINCE = saved[0], saved[1]
            pg_db._HEALTH.clear()
            pg_db._HEALTH.update(saved[2])

        self.addCleanup(restore)
        for p in (mock.patch.object(dam_db, "synology_allowed", return_value=True),
                  mock.patch.object(dam_db, "pg_configured", return_value=True)):
            p.start()
            self.addCleanup(p.stop)

    def test_retry_window_is_short(self):
        self.assertLessEqual(dam_db._OFFLINE_RETRY_SEC, 30.0)

    def test_health_ok_after_going_offline_retries_immediately(self):
        dam_db._OFFLINE_MODE = True
        dam_db._OFFLINE_SINCE = time.time()
        pg_db._HEALTH.update(ok=True, checked_at=time.time() + 1)
        self.assertTrue(dam_db._should_try_postgres())

    def test_offline_without_health_waits_for_window(self):
        dam_db._OFFLINE_MODE = True
        dam_db._OFFLINE_SINCE = time.time()
        pg_db._HEALTH.update(ok=False, checked_at=time.time() + 1)
        self.assertFalse(dam_db._should_try_postgres())


class BridgeLoginNeverDropsConnectionTests(unittest.TestCase):
    """Trasa /auth/login: wyjatek w auth_login -> JSON 500, nie zerwane polaczenie."""

    def test_exception_becomes_json_error(self):
        import local_bridge

        with mock.patch.object(local_bridge, "auth_login",
                               side_effect=sqlite3.OperationalError("no such table: device_sessions")):
            res = local_bridge._auth_login_safe("a@b.pl", "x", "", "", allow_weak_password=False)
        self.assertEqual(res.get("error"), "login_failed")
        self.assertIn("device_sessions", res.get("detail", ""))

    def test_routes_use_safe_wrapper(self):
        src = (DESKTOP / "local_bridge.py").read_text(encoding="utf-8", errors="replace")
        for route in ('if parsed.path == "/auth/login":', 'if parsed.path == "/auth/saved/login":'):
            idx = src.find(route)
            self.assertGreater(idx, -1, route)
            nxt = src.find("if parsed.path ==", idx + len(route))
            blok = src[idx:nxt]
            self.assertIn("_auth_login_safe(", blok, route)
            self.assertNotIn(" auth_login(", blok, route)


class UiShowsDbOfflineTests(unittest.TestCase):
    def test_dam_api_maps_db_offline_and_login_failed(self):
        js = (DESKTOP.parent / "web" / "assets" / "js" / "dam-api.js").read_text(encoding="utf-8")
        self.assertIn('"db_offline"', js)
        self.assertIn("Baza chwilowo niedostępna", js)
        self.assertIn('"login_failed"', js)


if __name__ == "__main__":
    unittest.main()
