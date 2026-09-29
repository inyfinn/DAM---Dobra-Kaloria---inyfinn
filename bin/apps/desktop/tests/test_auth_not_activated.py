# -*- coding: utf-8 -*-
"""Nieaktywowana instalacja NIE loguje do lokalnych kont seed.

29.09.2026, DAM 2.4.7 na Macu: DMG bez konfiguracji bazy, login szedl do lokalnej
SQLite i konczyl sie "nieprawidlowy email lub haslo" - uzytkownik szukal bledu w
swoim hasle, a brakowalo aktywacji. Teraz login zwraca error="not_activated",
a UI (dam-api.js) pokazuje komunikat i okno kodu aktywacyjnego.

Bez sieci i bez PostgreSQL: dam_db na tymczasowej SQLite, stan pg_db podmieniony.
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import auth_store  # noqa: E402
import dam_db  # noqa: E402
import pg_db  # noqa: E402
import pg_seal  # noqa: E402

EMAIL = "seed@kubara.pl"
STRONG = "Mocne-Haslo-Testowe-2026"
MSG = "Aplikacja nie jest aktywowana - wpisz kod aktywacyjny od administratora."


class _LocalSqliteLogin(unittest.TestCase):
    """Lokalna SQLite z kontem (tak wyglada instalacja bez bazy) + brak konfiguracji PG."""

    sealed_present = True
    dev_tree = False

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        db = Path(tmp.name) / "dam-local.sqlite"
        saved = {k: getattr(dam_db, k) for k in ("_OFFLINE_MODE", "_OFFLINE_REASON", "_OFFLINE_SINCE",
                                                  "_INITIALIZED", "_INIT_RESULT")}
        self.addCleanup(lambda: [setattr(dam_db, k, v) for k, v in saved.items()])
        for p in (
            mock.patch.object(dam_db, "db_path", return_value=db),
            mock.patch.object(dam_db, "USERS_SEED", Path(tmp.name) / "brak-seed.sqlite"),
            mock.patch.object(auth_store, "init_db", return_value=None),
            mock.patch.object(auth_store, "_current_identity",
                              return_value={"machine_id": "dam-mid-t", "device_id": "dam-dev-t",
                                            "hostname": "h", "windows_user": "u"}),
            mock.patch("machine_identity.write_bound_session", return_value=None),
            # brak konfiguracji bazy (DMG 2.4.7 / swieza instalacja przed kodem)
            mock.patch.object(pg_db, "is_configured", return_value=False),
            mock.patch.object(pg_seal, "sealed_present", return_value=self.sealed_present),
            mock.patch.object(pg_db, "_is_dev_tree", return_value=self.dev_tree),
            mock.patch.object(pg_db, "connect", side_effect=AssertionError("zadnego PostgreSQL w tescie")),
        ):
            p.start()
            self.addCleanup(p.stop)
        dam_db._OFFLINE_MODE = False
        auth_store._LOGIN_FAILS.clear()
        self.addCleanup(auth_store._LOGIN_FAILS.clear)
        conn = dam_db._connect_sqlite()
        dam_db._init_sqlite()
        conn.execute(
            "INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (EMAIL, "Seed", "admin", auth_store._hash_password(STRONG), "local", "t", "t"),
        )
        conn.commit()
        conn.close()


class NotActivatedLoginTests(_LocalSqliteLogin):
    """Instalacja z sealed.json, kodu jeszcze nie wpisano."""

    def test_login_zwraca_not_activated_zamiast_logowac_do_seed(self):
        res = auth_store.login(EMAIL, STRONG)
        self.assertFalse(res.get("ok"), res)
        self.assertNotIn("token", res, "nieaktywowana instalacja nie moze wydac sesji z lokalnej SQLite")
        self.assertEqual(res.get("error"), "not_activated", res)
        self.assertTrue(res.get("activation_available"))
        self.assertEqual(res.get("message"), MSG)

    def test_zle_haslo_tez_not_activated_a_nie_invalid_credentials(self):
        res = auth_store.login(EMAIL, "cokolwiek-innego-123")
        self.assertEqual(res.get("error"), "not_activated", res)

    def test_zmiana_hasla_tez_zablokowana(self):
        res = auth_store.change_password(EMAIL, STRONG, "Inne-Mocne-Haslo-2026")
        self.assertEqual(res.get("error"), "not_activated", res)


class NoConfigInstalledCopyTests(_LocalSqliteLogin):
    """DMG 2.4.7: ani sealed.json, ani konfiguracji - kod nic nie da, mowimy to wprost."""

    sealed_present = False

    def test_no_config(self):
        res = auth_store.login(EMAIL, STRONG)
        self.assertEqual(res.get("error"), "not_activated", res)
        self.assertEqual(res.get("reason"), "no_config")
        self.assertFalse(res.get("activation_available"))
        self.assertIn("Aplikacja nie jest aktywowana", res.get("message", ""))
        self.assertNotIn("token", res)


class DevTreeUnchangedTests(_LocalSqliteLogin):
    """Drzewo deweloperskie (repo z .git) bez konfiguracji bazy: SQLite jak dotad."""

    sealed_present = False
    dev_tree = True

    def test_dev_tree_loguje_do_sqlite_jak_dotad(self):
        res = auth_store.login(EMAIL, STRONG)
        self.assertTrue(res.get("ok"), res)
        self.assertTrue(res.get("token"))

    def test_dev_tree_zle_haslo_to_invalid_credentials(self):
        res = auth_store.login(EMAIL, "zle-haslo-123456")
        self.assertEqual(res.get("error"), "invalid_credentials")


class ConfiguredUnchangedTests(unittest.TestCase):
    def test_skonfigurowana_baza_nie_blokuje(self):
        with mock.patch.object(pg_db, "is_configured", return_value=True):
            self.assertEqual(pg_db.login_block_reason(), "")
            self.assertIsNone(auth_store._activation_block())


class UiMapsNotActivatedTests(unittest.TestCase):
    def test_dam_api_mapuje_not_activated(self):
        js = (DESKTOP.parent / "web" / "assets" / "js" / "dam-api.js").read_text(encoding="utf-8")
        self.assertIn('"not_activated"', js)
        self.assertIn(MSG, js)
        self.assertIn("DamActivation.show", js)

    def test_okno_kodu_wystawione_dla_dam_api(self):
        js = (DESKTOP.parent / "web" / "assets" / "js" / "dam-activation.js").read_text(encoding="utf-8")
        self.assertIn("window.DamActivation", js)


if __name__ == "__main__":
    unittest.main()
