# -*- coding: utf-8 -*-
"""Aktywacja kodem na macOS: pek kluczy zamiast Windows DPAPI.

29.09.2026, DAM 2.4.7 na Macu: "nieprawidlowy email lub haslo". Przyczyny:
  1. DMG zbudowane bez konfiguracji bazy (brak sekretu w CI),
  2. pg_seal._dpapi() dziala tylko na Windows - aktywacja kodem na Macu nie miala
     gdzie zapisac konfiguracji (dpapi_failed),
  3. bez konfiguracji logowanie szlo do lokalnych kont seed.

Brak Maca na stanowisku, wiec testy symuluja sys.platform == "darwin" i narzedzie
/usr/bin/security (FakeSecurity - atrapa podmieniona w pg_seal.subprocess).
Na prawdziwym macOS (CI macos-build.yml) ta sama klasa testow dziala natywnie, a
RealKeychainTests z DAM_REAL_KEYCHAIN_TEST=1 dotyka prawdziwego peku kluczy.

Zadnej sieci, zadnej bazy, zadnego prawdziwego peku kluczy (poza RealKeychainTests).
"""
from __future__ import annotations

import base64
import getpass
import json
import os
import stat
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import pg_seal  # noqa: E402

CODE = "ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2"
CFG = {"host": "h.invalid", "port": 5433, "dbname": "d", "user": "u", "password": "tajne-haslo-bazy"}
NEW_CFG = dict(CFG, password="nowe-haslo-bazy")


class FakeSecurity:
    """Atrapa /usr/bin/security: add/find/delete-generic-password na slowniku w pamieci."""

    def __init__(self, *, add_fails: bool = False):
        self.items: dict[tuple[str, str], str] = {}
        self.calls: list[list[str]] = []
        self.add_fails = add_fails

    @staticmethod
    def _opts(rest: list[str], valued: tuple[str, ...]) -> dict[str, str | bool]:
        out: dict[str, str | bool] = {}
        i = 0
        while i < len(rest):
            tok = rest[i]
            if tok in valued:
                out[tok] = rest[i + 1]
                i += 2
                continue
            out[tok] = True
            i += 1
        return out

    def run(self, argv, **kwargs):
        argv = list(argv)
        self.calls.append(argv)
        cmd, rest = argv[1], argv[2:]
        # Jak prawdziwe security: przy add "-w <haslo>", przy find samo "-w" = wypisz haslo.
        valued = ("-a", "-s", "-w", "-l") if cmd == "add-generic-password" else ("-a", "-s", "-l")
        o = self._opts(rest, valued)
        key = (str(o.get("-a")), str(o.get("-s")))
        if cmd == "add-generic-password":
            if self.add_fails:
                return subprocess.CompletedProcess(
                    argv, 36, "", "security: SecKeychainItemCreateFromContent: User interaction is not allowed.")
            if key in self.items and not o.get("-U"):
                return subprocess.CompletedProcess(argv, 45, "", "The specified item already exists in the keychain.")
            self.items[key] = str(o["-w"])
            return subprocess.CompletedProcess(argv, 0, "", "")
        if cmd == "find-generic-password":
            if key not in self.items:
                return subprocess.CompletedProcess(
                    argv, 44, "", "security: SecKeychainSearchCopyNext: The specified item could not be found.")
            return subprocess.CompletedProcess(argv, 0, self.items[key] + "\n", "")
        if cmd == "delete-generic-password":
            if self.items.pop(key, None) is None:
                return subprocess.CompletedProcess(argv, 44, "", "not found")
            return subprocess.CompletedProcess(argv, 0, "", "")
        return subprocess.CompletedProcess(argv, 1, "", f"nieznane polecenie {cmd}")


def _fake_subprocess(fake: FakeSecurity):
    """Podmiana TYLKO referencji pg_seal.subprocess - reszta procesu testow jej nie widzi."""
    return types.SimpleNamespace(
        run=fake.run,
        DEVNULL=subprocess.DEVNULL,
        CompletedProcess=subprocess.CompletedProcess,
    )


class _DarwinSandbox(unittest.TestCase):
    """sys.platform = darwin, atrapa security, DAM.app (data/) i katalog uzytkownika w tmp."""

    add_fails = False

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        # "Pakiet" (w DAM.app tylko do odczytu) i katalog uzytkownika (~/Library/...).
        self.bundle_data = root / "DAM.app" / "damroot" / "bin" / "apps" / "desktop" / "data"
        self.bundle_data.mkdir(parents=True)
        self.state = root / "Library" / "Application Support" / "DAM" / "state"
        self.fake = FakeSecurity(add_fails=self.add_fails)
        for target, name, value in (
            (sys, "platform", "darwin"),
            (pg_seal, "subprocess", _fake_subprocess(self.fake)),
            # security "istnieje" (atrapa odpowiada zamiast prawdziwego programu)
            (pg_seal, "SECURITY_BIN", sys.executable),
            (pg_seal, "DATA_DIR", self.bundle_data),
            (pg_seal, "SEALED_PATH", self.bundle_data / "pg-config.sealed.json"),
            (pg_seal, "STATE_DIR", self.state),
            (pg_seal, "DPAPI_PATH", self.state / "pg-config.protected"),
            (pg_seal, "CODE_PATH", self.state / "pg-config.code.protected"),
            (pg_seal, "SEALED_USED_PATH", self.state / "pg-config.sealed.used"),
            # tmp udaje domyslny ~/Library/Application Support/DAM/state -> nazwy produkcyjne
            (pg_seal, "_default_macos_state_dir", lambda: self.state),
        ):
            p = mock.patch.object(target, name, value)
            p.start()
            self.addCleanup(p.stop)
        pg_seal._ATTEMPTS.clear()
        self.addCleanup(pg_seal._ATTEMPTS.clear)
        pg_seal._KEYCHAIN_CACHE.clear()
        self.addCleanup(pg_seal._KEYCHAIN_CACHE.clear)
        self.account = getpass.getuser()

    def ship(self, cfg=CFG):
        """Build wklada do DAM.app zapieczetowana konfiguracje (jak instalator Windows)."""
        pg_seal.SEALED_PATH.write_text(json.dumps(pg_seal.seal(cfg, CODE)), encoding="utf-8")

    def keychain(self, service="pl.inyfinn.dam.pgconfig"):
        raw = self.fake.items.get((self.account, service))
        return None if raw is None else json.loads(base64.b64decode(raw).decode("utf-8"))

    def bundle_files(self):
        return sorted(p.name for p in self.bundle_data.iterdir())


class KeychainBackendTests(_DarwinSandbox):
    def test_dpapi_available_na_macos(self):
        self.assertTrue(pg_seal.dpapi_available(), "macOS ma pek kluczy - ochrona dostepna")

    def test_zapis_i_odczyt_przez_pek_kluczy(self):
        self.assertTrue(pg_seal.store_protected(CFG))
        self.assertEqual(self.keychain(), CFG, "konfiguracja ma lezec w peku kluczy")
        pg_seal._KEYCHAIN_CACHE.clear()  # odczyt z "peku", nie z pamieci procesu
        self.assertEqual(pg_seal.load_protected(), CFG)
        self.assertFalse(pg_seal.DPAPI_PATH.exists(), "przy dzialajacym peku zadnego pliku z haslem")

    def test_argumenty_security(self):
        pg_seal.store_protected(CFG)
        add = next(c for c in self.fake.calls if c[1] == "add-generic-password")
        self.assertEqual(add[0], sys.executable)  # SECURITY_BIN, nie "security" z PATH
        self.assertIn("-U", add)
        self.assertEqual(add[add.index("-a") + 1], self.account, "konto = biezacy uzytkownik")
        self.assertEqual(add[add.index("-s") + 1], "pl.inyfinn.dam.pgconfig")
        secret = add[add.index("-w") + 1]
        self.assertEqual(json.loads(base64.b64decode(secret)), CFG, "-w niesie base64 konfiguracji")
        self.assertNotIn(CFG["password"], " ".join(add), "jawne haslo nie moze byc w argumentach")
        find = next(c for c in self.fake.calls if c[1] == "find-generic-password")
        self.assertEqual(find[-1], "-w")

    def test_brak_wpisu_to_none(self):
        self.assertIsNone(pg_seal.load_protected())

    def test_zapas_0600_gdy_pek_nie_przyjmie(self):
        self.fake.add_fails = True
        self.assertTrue(pg_seal.store_protected(CFG), "bez peku zostaje zapas w pliku 0600")
        self.assertTrue(pg_seal.DPAPI_PATH.is_file())
        self.assertEqual(json.loads(pg_seal.DPAPI_PATH.read_text(encoding="utf-8")), CFG)
        if os.name != "nt":  # Windows nie ma bitow rwx dla grupy/innych
            self.assertEqual(stat.S_IMODE(pg_seal.DPAPI_PATH.stat().st_mode), 0o600)
        self.assertEqual(pg_seal.load_protected(), CFG)
        self.assertEqual(self.bundle_files(), [], "nic nie ląduje w DAM.app")

    def test_udany_zapis_do_peku_kasuje_stary_zapas(self):
        self.fake.add_fails = True
        pg_seal.store_protected(CFG)
        self.fake.add_fails = False
        self.assertTrue(pg_seal.store_protected(NEW_CFG))
        self.assertFalse(pg_seal.DPAPI_PATH.exists(), "stary plik zapasowy z haslem skasowany")
        self.assertEqual(pg_seal.load_protected(), NEW_CFG)

    def test_zapas_ma_pierwszenstwo_przed_starszym_wpisem_w_peku(self):
        pg_seal.store_protected(CFG)  # pek dziala
        self.fake.add_fails = True
        pg_seal.store_protected(NEW_CFG)  # pek odmawia -> plik
        self.assertEqual(pg_seal.load_protected(), NEW_CFG, "nowszy zapis nie moze przegrac ze starszym")

    def test_inny_katalog_stanu_nie_rusza_produkcyjnego_wpisu(self):
        """Testy / DAM_STATE_DIR / izolowane instancje nie moga nadpisac prawdziwej aktywacji."""
        other = self.state.parent / "inna-instancja"
        prod = pg_seal._keychain_service(pg_seal.DPAPI_PATH)
        iso = pg_seal._keychain_service(other / "pg-config.protected")
        iso_code = pg_seal._keychain_service(other / "pg-config.code.protected")
        self.assertEqual(prod, "pl.inyfinn.dam.pgconfig")
        self.assertTrue(iso.startswith("pl.inyfinn.dam.pgconfig.") and iso != prod, iso)
        self.assertTrue(iso_code.startswith("pl.inyfinn.dam.pgconfig.code."), iso_code)
        pg_seal.store_protected(CFG)
        self.assertTrue(pg_seal.store_protected(NEW_CFG, other / "pg-config.protected"))
        self.assertEqual(self.keychain(), CFG, "produkcyjny wpis nietkniety")
        self.assertEqual(pg_seal.load_protected(other / "pg-config.protected"), NEW_CFG)

    def test_brak_narzedzia_security_to_zapas_w_pliku(self):
        with mock.patch.object(pg_seal, "_keychain_cli", return_value=None):
            self.assertTrue(pg_seal.store_protected(CFG))
            self.assertEqual(pg_seal.load_protected(), CFG)
        self.assertTrue(pg_seal.DPAPI_PATH.is_file())


class ActivationDarwinTests(_DarwinSandbox):
    def test_aktywacja_kodem_zapisuje_w_peku_i_katalogu_uzytkownika(self):
        self.ship()
        res = pg_seal.activate(CODE)
        self.assertTrue(res.get("ok"), res)
        self.assertEqual(pg_seal.load_protected(), CFG)
        self.assertEqual(self.keychain(), CFG)
        self.assertEqual(self.keychain("pl.inyfinn.dam.pgconfig.code"), {"code": pg_seal.normalize_code(CODE)})
        self.assertTrue(pg_seal.remembered_code_present())
        self.assertTrue(pg_seal.SEALED_USED_PATH.is_file(), "skrot sealed.json w katalogu uzytkownika")
        self.assertEqual(self.bundle_files(), ["pg-config.sealed.json"],
                         "aktywacja nie pisze do DAM.app (pakiet bywa tylko do odczytu)")

    def test_zly_kod(self):
        self.ship()
        res = pg_seal.activate("ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ")
        self.assertEqual(res.get("error"), "code_invalid")
        self.assertEqual(self.fake.items, {})

    def test_aktualizacja_z_nowym_haslem_odswieza_pek(self):
        self.ship(CFG)
        self.assertTrue(pg_seal.activate(CODE)["ok"])
        self.assertFalse(pg_seal.reseal_if_newer(), "ten sam DMG - nic do zrobienia")
        self.ship(NEW_CFG)  # nowy DAM.app z nowym sealed.json (ten sam kod)
        self.assertTrue(pg_seal.reseal_if_newer())
        self.assertEqual(pg_seal.load_protected(), NEW_CFG)

    def test_nieudany_zapis_to_czytelny_blad_macos(self):
        self.ship()
        with mock.patch.object(pg_seal, "_macos_store", return_value=False):
            res = pg_seal.activate(CODE)
        self.assertFalse(res.get("ok"))
        self.assertEqual(res.get("error"), "dpapi_failed")
        self.assertIn("macOS", res.get("hint", ""))


class PgDbActivationDarwinTests(_DarwinSandbox):
    """Koniec do konca w pg_db: sealed w DAM.app -> okno kodu -> kod -> baza skonfigurowana."""

    def setUp(self):
        super().setUp()
        import pg_db

        self.pg_db = pg_db
        desktop = self.bundle_data.parent
        missing = desktop / "brak"
        saved = (pg_db._CONFIG_CACHE, pg_db._LAST_HOST, pg_db._RESEAL_CHECKED, pg_db._AUTH_FAILED)

        def restore():
            (pg_db._CONFIG_CACHE, pg_db._LAST_HOST, pg_db._RESEAL_CHECKED, pg_db._AUTH_FAILED) = saved

        self.addCleanup(restore)
        env = mock.patch.dict(os.environ, {}, clear=False)
        env.start()
        self.addCleanup(env.stop)
        for key in ("DAM_TEST_PG", "DAM_PG_HOST", "DAM_PG_HOSTS", "DAM_PG_PORT", "DAM_PG_DBNAME",
                    "DAM_PG_USER", "DAM_PG_PASSWORD", "DAM_PG_SSLMODE", "DAM_PG_CONFIG"):
            os.environ.pop(key, None)
        for name, value in (
            ("DESKTOP_DIR", desktop),
            ("CONFIG_PATH", self.bundle_data / "pg-config.json"),
            ("ENV_PATH", missing / "dam-connection.env"),
            ("CONFIG_EXAMPLE_PATH", missing / "pg-config.example.json"),
            ("_is_dev_tree", lambda: False),
        ):
            p = mock.patch.object(pg_db, name, value)
            p.start()
            self.addCleanup(p.stop)
        pg_db._CONFIG_CACHE = None
        pg_db._RESEAL_CHECKED = False
        pg_db._AUTH_FAILED = False

    def test_od_okna_kodu_do_skonfigurowanej_bazy(self):
        pg = self.pg_db
        self.ship()
        self.assertFalse(pg.is_configured())
        self.assertTrue(pg.activation_required(), "sealed w DAM.app, brak aktywacji -> okno kodu")
        self.assertEqual(pg.activation_reason(), "not_activated")
        self.assertEqual(pg.login_block_reason(), "not_activated")
        self.assertTrue(pg.activate(CODE).get("ok"))
        self.assertTrue(pg.is_configured())
        self.assertFalse(pg.activation_required())
        self.assertEqual(pg.login_block_reason(), "")
        self.assertEqual(pg._load_config()["password"], CFG["password"])
        self.assertEqual(self.bundle_files(), ["pg-config.sealed.json"])

    def test_dmg_bez_sealed_to_no_config(self):
        """Tak wygladal DMG 2.4.7: ani sealed.json, ani konfiguracji."""
        self.assertFalse(self.pg_db.activation_required())
        self.assertEqual(self.pg_db.login_block_reason(), "no_config")


class StateDirTests(unittest.TestCase):
    def test_macos_katalog_uzytkownika(self):
        with mock.patch.object(sys, "platform", "darwin"), mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DAM_STATE_DIR", None)
            got = pg_seal._activation_state_dir()
        self.assertEqual(got, Path.home() / "Library" / "Application Support" / "DAM" / "state")

    def test_macos_dam_state_dir(self):
        with tempfile.TemporaryDirectory() as td, mock.patch.object(sys, "platform", "darwin"), \
                mock.patch.dict(os.environ, {"DAM_STATE_DIR": td}):
            self.assertEqual(pg_seal._activation_state_dir(), Path(td))

    def test_windows_bez_zmian(self):
        with mock.patch.object(sys, "platform", "win32"), \
                mock.patch.dict(os.environ, {"DAM_STATE_DIR": "X:/nie-uzywac"}):
            self.assertEqual(pg_seal._activation_state_dir(), pg_seal.DATA_DIR)


@unittest.skipUnless(sys.platform == "win32", "sciezki Windows")
class WindowsUnchangedTests(unittest.TestCase):
    def test_sciezki_windows_bez_zmian(self):
        data = pg_seal.DESKTOP_DIR / "data"
        self.assertEqual(pg_seal.DPAPI_PATH, data / "pg-config.dpapi")
        self.assertEqual(pg_seal.CODE_PATH, data / "pg-config.code.dpapi")
        self.assertEqual(pg_seal.SEALED_USED_PATH, data / "pg-config.sealed.used")
        self.assertEqual(pg_seal.SEALED_PATH, data / "pg-config.sealed.json")

    @unittest.skipUnless(pg_seal.dpapi_available(), "DPAPI niedostepne")
    def test_windows_nigdy_nie_wola_security(self):
        def boom(*a, **k):
            raise AssertionError("na Windows nie wolno wolac security")

        with tempfile.TemporaryDirectory() as td, \
                mock.patch.object(pg_seal, "subprocess", types.SimpleNamespace(run=boom)):
            dest = Path(td) / "pg-config.dpapi"
            self.assertTrue(pg_seal.store_protected(CFG, dest))
            self.assertNotIn(b"tajne-haslo-bazy", dest.read_bytes(), "DPAPI = szyfrogram na dysku")
            self.assertEqual(pg_seal.load_protected(dest), CFG)


@unittest.skipUnless(
    sys.platform == "darwin" and os.environ.get("DAM_REAL_KEYCHAIN_TEST") == "1",
    "tylko prawdziwy macOS z DAM_REAL_KEYCHAIN_TEST=1 (CI macos-build.yml)",
)
class RealKeychainTests(unittest.TestCase):
    """Prawdziwe /usr/bin/security na runnerze macOS. Osobna usluga, sprzatana po tescie."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        data = root / "data"
        data.mkdir()
        self.service = f"pl.inyfinn.dam.pgconfig.citest{os.getpid()}"
        for name, value in (
            ("KEYCHAIN_SERVICE", self.service),
            ("DATA_DIR", data),
            ("SEALED_PATH", data / "pg-config.sealed.json"),
            ("STATE_DIR", root / "state"),
            ("DPAPI_PATH", root / "state" / "pg-config.protected"),
            ("CODE_PATH", root / "state" / "pg-config.code.protected"),
            ("SEALED_USED_PATH", root / "state" / "pg-config.sealed.used"),
        ):
            p = mock.patch.object(pg_seal, name, value)
            p.start()
            self.addCleanup(p.stop)
        pg_seal._ATTEMPTS.clear()
        pg_seal._KEYCHAIN_CACHE.clear()
        self.addCleanup(pg_seal._KEYCHAIN_CACHE.clear)
        # Sprzatanie wpisow testowych (dziala, zanim patche zostana zdjete).
        for path in (pg_seal.DPAPI_PATH, pg_seal.CODE_PATH):
            self.addCleanup(pg_seal._keychain_delete, pg_seal._keychain_service(path))

    def test_aktywacja_na_prawdziwym_macos(self):
        self.assertNotEqual(pg_seal._keychain_service(pg_seal.DPAPI_PATH), "pl.inyfinn.dam.pgconfig")
        pg_seal.SEALED_PATH.write_text(json.dumps(pg_seal.seal(CFG, CODE)), encoding="utf-8")
        res = pg_seal.activate(CODE)
        self.assertTrue(res.get("ok"), res)
        pg_seal._KEYCHAIN_CACHE.clear()
        self.assertEqual(pg_seal.load_protected(), CFG)
        in_keychain = pg_seal._keychain_load(pg_seal._keychain_service(pg_seal.DPAPI_PATH)) is not None
        fallback = pg_seal.DPAPI_PATH.is_file()
        print(f"\nREAL macOS: pek kluczy={'TAK' if in_keychain else 'NIE'}, plik zapasowy={'TAK' if fallback else 'NIE'}")
        self.assertTrue(in_keychain or fallback)
        if fallback:
            self.assertEqual(stat.S_IMODE(pg_seal.DPAPI_PATH.stat().st_mode), 0o600)


if __name__ == "__main__":
    unittest.main()
