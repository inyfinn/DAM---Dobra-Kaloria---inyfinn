# -*- coding: utf-8 -*-
"""06.10.2026, ekran logowania: "czasem pisze zle haslo, choc haslo jest dobre".

Kazda sciezka, ktora zwraca invalid_credentials mimo poprawnego hasla (A5), ma tu test:
  1. bcrypt 5.x odrzuca haslo > 72 bajtow (ValueError) -> poprawne dlugie haslo = "zle haslo",
     a rejestracja takiego hasla konczyla sie wyjatkiem,
  2. haslo z polskimi znakami wpisane na Macu (NFD) vs hash zrobiony na Windows (NFC),
  3. baza lokalna (tryb bez Synology) ma starsze haslo niz Postgres - UI musi to powiedziec,
  4. throttle: poprawne haslo w oknie blokady = too_many_attempts + czas do konca blokady.
Rejestracja (A2): wylacznie do centralnego PostgreSQL, nigdy do lokalnej SQLite.

Bez sieci i bez PostgreSQL: dam_db na tymczasowej SQLite, stan pg_db podmieniony.
"""
from __future__ import annotations

import sqlite3
import sys
import tempfile
import unicodedata
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

try:
    import bcrypt  # noqa: E402
except ImportError:  # pragma: no cover
    bcrypt = None

EMAIL = "jan@kubara.pl"
STRONG = "Mocne-Haslo-Testowe-2026"
PL_PASS = "Zażółć-Gęślą-Jaźń-2026"
LONG_PASS = "Dlugie-haslo-testowe-" + "x" * 70  # > 72 bajty


class _Sandbox(unittest.TestCase):
    pg_configured = False
    synology_allowed = True
    offline = False
    dev_tree = True
    sealed = False

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.db = Path(tmp.name) / "dam-local.sqlite"
        saved = {k: getattr(dam_db, k) for k in ("_OFFLINE_MODE", "_OFFLINE_REASON", "_OFFLINE_SINCE",
                                                  "_INITIALIZED", "_INIT_RESULT")}
        self.addCleanup(lambda: [setattr(dam_db, k, v) for k, v in saved.items()])
        patches = [
            mock.patch.object(dam_db, "db_path", return_value=self.db),
            mock.patch.object(dam_db, "USERS_SEED", Path(tmp.name) / "brak-seed.sqlite"),
            mock.patch.object(auth_store, "init_db", return_value=None),
            mock.patch.object(auth_store, "_current_identity",
                              return_value={"machine_id": "dam-mid-t", "device_id": "dam-dev-t",
                                            "hostname": "h", "windows_user": "u"}),
            mock.patch("machine_identity.write_bound_session", return_value=None),
            mock.patch.object(pg_db, "is_configured", return_value=self.pg_configured),
            mock.patch.object(pg_seal, "sealed_present", return_value=self.sealed),
            mock.patch.object(pg_db, "_is_dev_tree", return_value=self.dev_tree),
            mock.patch.object(dam_db, "synology_allowed", return_value=self.synology_allowed),
            mock.patch.object(pg_db, "connect", side_effect=ConnectionError("brak sieci w tescie")),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        dam_db._OFFLINE_MODE = self.offline
        # tryb offline: nie probuj PG (connect i tak jest zablokowany) - okno ponowien nie minelo
        dam_db._OFFLINE_SINCE = 9e12 if self.offline else 0.0
        auth_store._LOGIN_FAILS.clear()
        self.addCleanup(auth_store._LOGIN_FAILS.clear)
        dam_db._init_sqlite()

    def add_user(self, email=EMAIL, password=STRONG, role="user"):
        conn = dam_db._connect_sqlite()
        conn.execute(
            "INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (email, "Jan", role, auth_store._hash_password(password), "local", "t", "t"),
        )
        conn.commit()
        conn.close()

    def count_users(self) -> int:
        c = sqlite3.connect(str(self.db))
        try:
            return c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        finally:
            c.close()


@unittest.skipIf(bcrypt is None, "bez bcrypt hash idzie przez pbkdf2 - brak limitu 72 bajtow")
class PasswordHashTests(unittest.TestCase):
    def test_long_password_roundtrip(self):
        """bcrypt 5.x: hashpw(>72 B) -> ValueError. Poprawne dlugie haslo nie moze byc 'zle'."""
        h = auth_store._hash_password(LONG_PASS)
        self.assertTrue(auth_store._verify_password(LONG_PASS, h))
        self.assertFalse(auth_store._verify_password("Inne-haslo-zupelnie-2026", h))

    def test_long_password_matches_hash_made_with_old_bcrypt_truncation(self):
        """Hash zrobiony starym bcrypt (3.x/4.x) - ucina do 72 bajtow. Nowy kod musi go przyjac."""
        legacy = bcrypt.hashpw(LONG_PASS.encode("utf-8")[:72], bcrypt.gensalt(rounds=4)).decode()
        self.assertTrue(auth_store._verify_password(LONG_PASS, legacy))

    def test_polish_password_nfd_vs_nfc(self):
        """Mac moze wpisac 'ą' jako a + ogonek (NFD); hash z Windows jest z NFC."""
        nfc = unicodedata.normalize("NFC", PL_PASS)
        nfd = unicodedata.normalize("NFD", PL_PASS)
        self.assertNotEqual(nfc, nfd)
        h = auth_store._hash_password(nfc)
        self.assertTrue(auth_store._verify_password(nfd, h))
        h2 = auth_store._hash_password(nfd)
        self.assertTrue(auth_store._verify_password(nfc, h2))

    def test_php_2y_prefix_and_bytes_hash(self):
        h = bcrypt.hashpw(b"Mocne-Haslo-Testowe-2026", bcrypt.gensalt(rounds=4)).decode()
        h2y = "$2y$" + h[4:]
        self.assertTrue(auth_store._verify_password(STRONG, h2y))
        self.assertTrue(auth_store._verify_password(STRONG, h.encode("utf-8")))

    def test_garbage_hash_is_false_not_exception(self):
        self.assertFalse(auth_store._verify_password(STRONG, "to-nie-jest-hash"))


class LoginOutcomeTests(_Sandbox):
    def test_long_password_account_can_log_in(self):
        self.add_user(password=LONG_PASS)
        res = auth_store.login(EMAIL, LONG_PASS)
        self.assertTrue(res.get("ok"), res)

    def test_wrong_password_in_dev_tree_without_pg_reports_local(self):
        self.add_user()
        res = auth_store.login(EMAIL, "Zupelnie-inne-haslo-1")
        self.assertEqual(res.get("error"), "invalid_credentials", res)
        self.assertEqual(res.get("db_source"), "local", res)

    def test_unknown_account_and_wrong_password_look_identical(self):
        """Bezpieczenstwo: anonim nie odroznia 'brak konta' od 'zle haslo'."""
        self.add_user()
        a = auth_store.login("nie-ma@kubara.pl", "Cokolwiek-12345")
        b = auth_store.login(EMAIL, "Cokolwiek-12345")
        self.assertEqual(a, b)

    def test_throttle_with_correct_password_is_distinct_and_has_retry_after(self):
        self.add_user()
        for _ in range(auth_store._LOGIN_MAX_FAILS):
            self.assertEqual(auth_store.login(EMAIL, "zle-haslo-12345").get("error"), "invalid_credentials")
        res = auth_store.login(EMAIL, STRONG)
        self.assertEqual(res.get("error"), "too_many_attempts", res)
        self.assertGreater(int(res.get("retry_after_s") or 0), 0, res)
        self.assertLessEqual(int(res.get("retry_after_s")), int(auth_store._LOGIN_WINDOW_S))

    def test_weak_but_correct_password_is_password_change_not_invalid(self):
        self.add_user(password="test")
        res = auth_store.login(EMAIL, "test")
        self.assertEqual(res.get("error"), "password_change_required", res)


class LocalCopyWhenSynologyDisabledTests(_Sandbox):
    pg_configured = True
    synology_allowed = False

    def test_wrong_password_reports_local_source(self):
        """Tryb 'tylko lokalna': kopia kont moze miec stare haslo. Odpowiedz musi to zdradzic
        (db_source), zeby UI nie klamalo 'zle haslo' bez wyjasnienia."""
        self.add_user()
        res = auth_store.login(EMAIL, "To-jest-nowsze-haslo-2026")
        self.assertEqual(res.get("error"), "invalid_credentials", res)
        self.assertEqual(res.get("db_source"), "local", res)


class RegistrationPgOfflineTests(_Sandbox):
    pg_configured = True
    offline = True

    def test_central_only_blocks_when_pg_configured_but_offline(self):
        res = auth_store.register_user("nowy@kubara.pl", "Mocne-Haslo-Testowe-2026", "Nowy",
                                       central_only=True)
        self.assertEqual(res.get("error"), "db_offline", res)
        self.assertEqual(self.count_users(), 0, "konto nie moze trafic do lokalnej SQLite")

    def test_registration_status_closed(self):
        self.assertEqual(auth_store.registration_status().get("reason"), "db_offline")


class RegistrationNotActivatedTests(_Sandbox):
    dev_tree = False
    sealed = True

    def test_central_only_blocks_when_installation_not_activated(self):
        res = auth_store.register_user("nowy@kubara.pl", "Mocne-Haslo-Testowe-2026", "Nowy",
                                       central_only=True)
        self.assertEqual(res.get("error"), "not_activated", res)
        self.assertEqual(self.count_users(), 0)


class RegistrationCentralOnlyTests(_Sandbox):
    """A2: rejestracja nigdy do lokalnej SQLite seed."""

    def test_central_only_blocks_without_central_db(self):
        res = auth_store.register_user("nowy@kubara.pl", "Mocne-Haslo-Testowe-2026", "Nowy",
                                       central_only=True)
        self.assertEqual(res.get("error"), "db_not_central", res)
        self.assertEqual(self.count_users(), 0)

    @unittest.skipIf(bcrypt is None, "bez bcrypt brak limitu 72 bajtow")
    def test_register_long_password_does_not_raise(self):
        res = auth_store.register_user("dlugie@kubara.pl", LONG_PASS, "Dlugie")  # lokalnie (admin/dev)
        self.assertTrue(res.get("ok"), res)
        self.assertTrue(auth_store.login("dlugie@kubara.pl", LONG_PASS).get("ok"))

    def test_registration_status_reasons(self):
        self.assertEqual(auth_store.registration_status().get("open"), False)
        self.assertEqual(auth_store.registration_status().get("reason"), "db_not_central")
        self.assertEqual(auth_store.registration_status(public_mode=True).get("reason"), "public_mode")


class RegistrationOpenWhenCentralOnlineTests(_Sandbox):
    pg_configured = True

    def test_open_only_when_pg_live(self):
        # PG skonfigurowany, dozwolony, nie offline -> otwarta
        self.assertEqual(auth_store.registration_status(), {"open": True, "reason": ""})


class BridgeRegisterHandlerTests(unittest.TestCase):
    """A1/A2: handler /auth/register nie ma juz bootstrapu 'pierwsze konto = admin'."""

    @classmethod
    def setUpClass(cls):
        src = (DESKTOP / "local_bridge.py").read_text(encoding="utf-8")
        i = src.index('if parsed.path == "/auth/register":')
        j = src.index('if parsed.path == "/auth/login":')
        cls.block = src[i:j]
        k = src.index('if parsed.path == "/auth/registration-open":')
        cls.open_block = src[k:src.index('if parsed.path == "/auth/identity":')]

    def test_no_bootstrap_admin_over_http(self):
        self.assertNotIn("bootstrap", self.block)
        self.assertNotIn("users_count", self.block)
        self.assertNotIn('requested_role = "admin"', self.block)

    def test_register_is_central_only(self):
        self.assertIn("central_only=True", self.block)

    def test_registration_open_uses_status_not_user_count(self):
        self.assertNotIn("users_count", self.open_block)
        self.assertIn("registration_status", self.open_block)


if __name__ == "__main__":
    unittest.main()
