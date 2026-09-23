"""Zapisane logowania (saved_logins.py): magazyn zawsze w tempfile, NIGDY na
prawdziwym katalogu stanu uzytkownika. Sprawdza: zapis/odczyt, brak hasla
jawnym tekstem na dysku, list_public() bez sekretow, jedno autologin naraz,
delete, uszkodzony sekret -> saved_login_unreadable bez wyjatku, fallback
Fernet gdy DPAPI niedostepne (symulacja platformy bez DPAPI).
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import saved_logins  # noqa: E402

SECRET_PASSWORD = "zielony-rower-42-TAJNE"


class SavedLoginsTestBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state_dir = Path(self.tmp.name)
        self.patches = [
            mock.patch("platform_compat.user_state_dir", return_value=self.state_dir),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def _store_file(self) -> Path:
        return self.state_dir / saved_logins.STORE_FILENAME


class SavedLoginsRoundtripTests(SavedLoginsTestBase):
    """Sciezka domyslna: cokolwiek dziala na tej maszynie (DPAPI na Windows, Fernet gdzie indziej)."""

    def test_save_and_password_for_roundtrip(self):
        ok = saved_logins.save("User@Kubara.pl", "Jan Kowalski", SECRET_PASSWORD, autologin=False)
        self.assertTrue(ok)
        self.assertEqual(saved_logins.password_for("user@kubara.pl"), SECRET_PASSWORD)
        # Case-insensitive email match.
        self.assertEqual(saved_logins.password_for("USER@KUBARA.PL"), SECRET_PASSWORD)

    def test_password_never_written_in_plaintext_to_disk(self):
        saved_logins.save("a@kubara.pl", "A", SECRET_PASSWORD, autologin=False)
        raw = self._store_file().read_bytes()
        self.assertNotIn(SECRET_PASSWORD.encode("utf-8"), raw)
        # Rowniez czesciowo (na wypadek encodowania per-znak) - szukamy calego ciagu.
        parsed = json.loads(raw.decode("utf-8"))
        for acc in parsed["accounts"]:
            self.assertNotEqual(acc.get("secret"), SECRET_PASSWORD)

    def test_list_public_has_no_secrets(self):
        saved_logins.save("a@kubara.pl", "A", SECRET_PASSWORD, autologin=True)
        rows = saved_logins.list_public()
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertNotIn("secret", row)
        self.assertEqual(row["email"], "a@kubara.pl")
        self.assertEqual(row["name"], "A")
        self.assertTrue(row["autologin"])
        self.assertIn("saved_at", row)
        self.assertIn("last_used_at", row)

    def test_atomic_write_leaves_no_tmp_file_behind(self):
        saved_logins.save("a@kubara.pl", "A", SECRET_PASSWORD)
        tmp_leftovers = list(self.state_dir.glob("*.tmp"))
        self.assertEqual(tmp_leftovers, [])

    def test_only_one_account_can_have_autologin(self):
        saved_logins.save("a@kubara.pl", "A", SECRET_PASSWORD, autologin=True)
        saved_logins.save("b@kubara.pl", "B", SECRET_PASSWORD, autologin=True)
        rows = {r["email"]: r for r in saved_logins.list_public()}
        self.assertTrue(rows["b@kubara.pl"]["autologin"])
        self.assertFalse(rows["a@kubara.pl"]["autologin"])
        self.assertEqual(saved_logins.autologin_email(), "b@kubara.pl")

        self.assertTrue(saved_logins.set_autologin("a@kubara.pl", True))
        rows = {r["email"]: r for r in saved_logins.list_public()}
        self.assertTrue(rows["a@kubara.pl"]["autologin"])
        self.assertFalse(rows["b@kubara.pl"]["autologin"])

        self.assertTrue(saved_logins.set_autologin("a@kubara.pl", False))
        self.assertEqual(saved_logins.autologin_email(), "")

    def test_set_autologin_unknown_account_fails_quietly(self):
        self.assertFalse(saved_logins.set_autologin("nope@kubara.pl", True))

    def test_touch_updates_last_used_at(self):
        saved_logins.save("a@kubara.pl", "A", SECRET_PASSWORD)
        before = saved_logins.list_public()[0]["last_used_at"]
        with mock.patch.object(saved_logins, "_utc", return_value="2099-01-01T00:00:00+00:00"):
            self.assertTrue(saved_logins.touch("a@kubara.pl"))
        after = saved_logins.list_public()[0]["last_used_at"]
        self.assertEqual(after, "2099-01-01T00:00:00+00:00")
        self.assertNotEqual(before, after)

    def test_touch_unknown_account_returns_false(self):
        self.assertFalse(saved_logins.touch("nope@kubara.pl"))

    def test_delete_removes_account(self):
        saved_logins.save("a@kubara.pl", "A", SECRET_PASSWORD)
        saved_logins.save("b@kubara.pl", "B", SECRET_PASSWORD)
        self.assertTrue(saved_logins.delete("a@kubara.pl"))
        emails = [r["email"] for r in saved_logins.list_public()]
        self.assertEqual(emails, ["b@kubara.pl"])
        self.assertFalse(saved_logins.delete("a@kubara.pl"))  # juz go nie ma

    def test_password_for_unknown_account_returns_none(self):
        self.assertIsNone(saved_logins.password_for("ghost@kubara.pl"))

    def test_save_rejects_empty_email(self):
        self.assertFalse(saved_logins.save("", "A", SECRET_PASSWORD))
        self.assertEqual(saved_logins.list_public(), [])

    def test_list_public_survives_missing_store_file(self):
        # Zaden save() jeszcze sie nie odbyl - plik nie istnieje.
        self.assertEqual(saved_logins.list_public(), [])
        self.assertEqual(saved_logins.autologin_email(), "")

    def test_list_public_survives_corrupt_store_file(self):
        self._store_file().parent.mkdir(parents=True, exist_ok=True)
        self._store_file().write_text("{not json", encoding="utf-8")
        self.assertEqual(saved_logins.list_public(), [])


class SavedLoginsCorruptSecretTests(SavedLoginsTestBase):
    def test_corrupt_secret_returns_none_not_exception(self):
        saved_logins.save("a@kubara.pl", "A", SECRET_PASSWORD)
        store = json.loads(self._store_file().read_text(encoding="utf-8"))
        store["accounts"][0]["secret"] = "totally-not-a-valid-secret"
        self._store_file().write_text(json.dumps(store), encoding="utf-8")

        try:
            pw = saved_logins.password_for("a@kubara.pl")
        except Exception as exc:  # pragma: no cover - test powinien nigdy tu nie trafic
            self.fail(f"password_for rzucilo wyjatkiem zamiast zwrocic None: {exc!r}")
        self.assertIsNone(pw)

        # Konto oznaczone jako nieczytelne, ale NIE usuniete.
        rows = {r["email"]: r for r in saved_logins.list_public()}
        self.assertIn("a@kubara.pl", rows)
        self.assertTrue(rows["a@kubara.pl"].get("unreadable"))


class SavedLoginsNoDpapiFallbackTests(SavedLoginsTestBase):
    """Symulacja maszyny bez DPAPI (np. macOS) - musi uzyc Fernet (secret_box)."""

    def setUp(self):
        super().setUp()
        self.dpapi_patches = [
            mock.patch.object(saved_logins, "_dpapi_encrypt", return_value=""),
            mock.patch.object(saved_logins, "_dpapi_decrypt", return_value=""),
        ]
        for p in self.dpapi_patches:
            p.start()

    def tearDown(self):
        for p in self.dpapi_patches:
            p.stop()
        super().tearDown()

    def test_fallback_fernet_roundtrip_without_dpapi(self):
        ok = saved_logins.save("a@kubara.pl", "A", SECRET_PASSWORD)
        self.assertTrue(ok)
        store = json.loads(self._store_file().read_text(encoding="utf-8"))
        secret = store["accounts"][0]["secret"]
        self.assertTrue(secret.startswith("fernet:"))
        self.assertEqual(saved_logins.password_for("a@kubara.pl"), SECRET_PASSWORD)

    def test_encryption_available_reports_fernet_when_no_dpapi(self):
        with mock.patch("pg_seal.dpapi_available", return_value=False):
            self.assertTrue(saved_logins.encryption_available())

    def test_save_fails_closed_when_neither_dpapi_nor_fernet_available(self):
        with mock.patch("secret_box.encrypt_str", return_value=""):
            ok = saved_logins.save("a@kubara.pl", "A", SECRET_PASSWORD)
        self.assertFalse(ok)
        self.assertEqual(saved_logins.list_public(), [])


if __name__ == "__main__":
    unittest.main()
