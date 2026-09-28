# -*- coding: utf-8 -*-
"""Izolacja testowa pg_db (DECYZJE 2026-09-28b, sekcja W1, pkt B3.3 "Wersja 2").

Cel: pokazac, ze
1) dzisiejszy (bazowy) mechanizm wyboru hosta (`_hosts_from_cfg` +
   `_prefer_ddns_first`, niezmieniony w tej poprawce - dalej uzywany na
   produkcyjnej sciezce) posortowalby DDNS z zapisanej konfiguracji PRZED
   hostem loopback nawet gdy ktos ustawil `DAM_PG_HOST=127.0.0.1` (CZERWONY -
   to jest dokladnie błąd, ktoremu ta partia zapobiega),
2) po dodaniu bramki test-mode (`DAM_TEST_PG=1` lub host loopback) w
   `_load_config`/`_primary_host`, `connect()` idzie WYLACZNIE do
   `DAM_PG_HOST`, ignorujac zapisana konfiguracje, `hosts` z pliku i sticky
   `_LAST_HOST` (ZIELONY),
3) bez flagi i bez loopbacku zachowanie produkcyjne jest identyczne jak przed
   zmiana (ta sama scieszka kodu, zero nowych warunkow na jej starcie),
4) tryb testowy bez `DAM_PG_PASSWORD` w env odmawia (PgNotConfigured) - zero
   fallbacku na DPAPI/pg-config.json/dam-connection.env.

Zero sieci, zero prawdziwego Postgresa - czysty monkeypatch modulu pg_db."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import pg_db  # noqa: E402


def _fake_psycopg2_module(*, connect_return):
    """Namiastka modulu psycopg2 z dokladnie tym, czego uzywa pg_db.connect()
    (.connect, .extras.RealDictCursor, .OperationalError) - niezalezna od
    stanu prawdziwego sys.modules["psycopg2"], ktory inny plik testowy
    (test_asset_repo.py, poza zakresem tej partii) potrafi podmienic na pusty
    modul bez .connect w zaleznosci od kolejnosci importow calego zestawu."""
    fake = mock.MagicMock(name="fake_psycopg2_module")
    fake.connect = mock.MagicMock(return_value=connect_return)
    fake.extras = mock.MagicMock()
    fake.extras.RealDictCursor = object()
    fake.OperationalError = RuntimeError
    fake.Binary = lambda x: x
    return fake


class BaselineDdnsBeforeLoopbackTests(unittest.TestCase):
    """CZERWONY: surowa pula kandydatow (bez bramki test-mode) faworyzuje DDNS.

    `_hosts_from_cfg` i `_prefer_ddns_first` sa DOKLADNIE tymi samymi funkcjami,
    ktore dzisiejszy (bazowy) `_load_config`/`_primary_host` uzywa na jedynej
    sciezce kodu - nie ma tu osobnej "starej" implementacji do podmiany. Ten
    test demonstruje realny blad: gdyby nie bramka test-mode dodana w tej
    partii, `DAM_PG_HOST=127.0.0.1` ustawione obok zapisanej konfiguracji z
    DDNS w `hosts` skonczyloby sie polaczeniem do DDNS (produkcji), nie do
    127.0.0.1 (testu)."""

    def setUp(self):
        self._env_patch = mock.patch.dict("os.environ", {}, clear=False)
        self._env_patch.start()
        self.addCleanup(self._env_patch.stop)
        import os

        for key in ("DAM_PG_HOSTS",):
            os.environ.pop(key, None)

    def test_raw_pool_prefers_ddns_over_loopback(self):
        # Stan sprzed poprawki: pg-config.json na stacji ma zapisany DDNS,
        # a ktos (test albo dam-connection.env) ustawil host na 127.0.0.1.
        cfg = {"host": "127.0.0.1", "hosts": ["inyfinn.synology.me"]}
        pool = pg_db._hosts_from_cfg(cfg)
        self.assertEqual(
            pool[0],
            "inyfinn.synology.me",
            "to jest sam blad: bez bramki test-mode DDNS wygrywa z loopbackiem",
        )
        self.assertIn("127.0.0.1", pool)


class TestModeGateTests(unittest.TestCase):
    """ZIELONY: bramka DAM_TEST_PG=1 / host loopback wymusza WYLACZNIE DAM_PG_HOST."""

    def setUp(self):
        self._env_patch = mock.patch.dict("os.environ", {}, clear=False)
        self._env_patch.start()
        self.addCleanup(self._env_patch.stop)
        import os

        for key in (
            "DAM_TEST_PG",
            "DAM_PG_HOST",
            "DAM_PG_HOSTS",
            "DAM_PG_PORT",
            "DAM_PG_DBNAME",
            "DAM_PG_USER",
            "DAM_PG_PASSWORD",
            "DAM_PG_SSLMODE",
        ):
            os.environ.pop(key, None)
        pg_db.reset_config_cache()
        self.addCleanup(pg_db.reset_config_cache)

        # Symulacja: stacja MA zapisana produkcyjna konfiguracje (DDNS + realne
        # haslo). Tryb testowy nie ma prawa jej nawet dotknac.
        self._stored_patch = mock.patch.object(
            pg_db,
            "_read_stored_config",
            return_value={
                "host": "inyfinn.synology.me",
                "hosts": ["inyfinn.synology.me", "192.168.1.50"],
                "password": "prawdziwe-haslo-produkcyjne",
            },
        )
        self._stored_patch.start()
        self.addCleanup(self._stored_patch.stop)
        # DPAPI/dotenv tez nie moga wejsc do gry w trybie testowym.
        self._pg_seal_patch = mock.patch.object(pg_db, "pg_seal", None)
        self._pg_seal_patch.start()
        self.addCleanup(self._pg_seal_patch.stop)

    def test_dam_test_pg_flag_forces_single_env_host(self):
        import os

        os.environ["DAM_TEST_PG"] = "1"
        os.environ["DAM_PG_HOST"] = "127.0.0.1"
        os.environ["DAM_PG_PORT"] = "55433"
        os.environ["DAM_PG_PASSWORD"] = "test-haslo"

        cfg = pg_db._load_config()

        self.assertTrue(cfg.get("_test_mode"))
        self.assertEqual(cfg["hosts"], ["127.0.0.1"])
        self.assertEqual(cfg["password"], "test-haslo")
        self.assertNotEqual(cfg["password"], "prawdziwe-haslo-produkcyjne")
        self.assertEqual(pg_db._primary_host(cfg), "127.0.0.1")

    def test_loopback_host_alone_triggers_test_mode_without_flag(self):
        import os

        os.environ["DAM_PG_HOST"] = "127.0.0.1"
        os.environ["DAM_PG_PASSWORD"] = "test-haslo-2"
        self.assertNotIn("DAM_TEST_PG", os.environ)

        cfg = pg_db._load_config()

        self.assertTrue(cfg.get("_test_mode"))
        self.assertEqual(cfg["hosts"], ["127.0.0.1"])

    def test_sticky_last_host_ignored_in_test_mode(self):
        import os

        os.environ["DAM_TEST_PG"] = "1"
        os.environ["DAM_PG_HOST"] = "127.0.0.1"
        os.environ["DAM_PG_PASSWORD"] = "test-haslo-3"
        cfg = pg_db._load_config()

        with mock.patch.object(pg_db, "_LAST_HOST", "inyfinn.synology.me"):
            self.assertEqual(pg_db._primary_host(cfg), "127.0.0.1")

    def test_missing_password_env_refuses_without_dpapi_fallback(self):
        import os

        os.environ["DAM_TEST_PG"] = "1"
        os.environ["DAM_PG_HOST"] = "127.0.0.1"
        # DAM_PG_PASSWORD celowo brakuje - stored config MA haslo, ale w trybie
        # testowym nie wolno po nie siegnac.
        with self.assertRaises(pg_db.PgNotConfigured):
            pg_db._load_config()

    def test_missing_host_env_refuses(self):
        import os

        os.environ["DAM_TEST_PG"] = "1"
        os.environ["DAM_PG_PASSWORD"] = "test-haslo-4"
        with self.assertRaises(pg_db.PgNotConfigured):
            pg_db._load_config()

    def test_plain_dam_pg_host_non_loopback_does_not_trigger_test_mode(self):
        """Samo DAM_PG_HOST na realny adres (np. z dam-connection.env realnego
        uzytkownika) NIE ma wchodzic w tryb testowy - inaczej zwykla stacja z
        recznie ustawionym LAN-owym hostem straciłaby haslo/DPAPI."""
        import os

        os.environ["DAM_PG_HOST"] = "192.168.1.50"
        # Brak DAM_PG_PASSWORD w env - produkcyjna sciezka MA prawo wziac je z
        # _read_stored_config (zmockowane wyzej), tryb testowy by to zabronil.
        cfg = pg_db._load_config()
        self.assertFalse(cfg.get("_test_mode"))
        self.assertEqual(cfg["password"], "prawdziwe-haslo-produkcyjne")


class ConnectMarkerGateTests(unittest.TestCase):
    """connect() w trybie testowym odrzuca polaczenie bez dam_test_marker,
    PRZED oddaniem go wywolujacemu (zero szansy na zapis)."""

    def setUp(self):
        self._env_patch = mock.patch.dict("os.environ", {}, clear=False)
        self._env_patch.start()
        self.addCleanup(self._env_patch.stop)
        import os

        os.environ["DAM_TEST_PG"] = "1"
        os.environ["DAM_PG_HOST"] = "127.0.0.1"
        os.environ["DAM_PG_PORT"] = "55433"
        os.environ["DAM_PG_PASSWORD"] = "test-haslo"
        os.environ.pop("DAM_PG_HOSTS", None)
        pg_db.reset_config_cache()
        self.addCleanup(pg_db.reset_config_cache)

    def test_connect_raises_when_marker_table_missing(self):
        fake_conn = mock.MagicMock()
        fake_cursor = mock.MagicMock()
        fake_cursor.execute.side_effect = Exception('relation "dam_test_marker" does not exist')
        fake_conn.cursor.return_value = fake_cursor

        # Patchujemy CALY modul psycopg2 uzywany przez pg_db (nie tylko
        # .connect na obiekcie, ktory realnie jest w sys.modules["psycopg2"]).
        # Powod: `bin/apps/desktop/tests/test_asset_repo.py` (poza zakresem
        # zapisu tej partii) potrafi - w zaleznosci od kolejnosci importow w
        # calym zestawie testow (unittest discover, alfabetycznie) - podmienic
        # sys.modules["psycopg2"] na PUSTY types.ModuleType BEZ .connect,
        # zanim jakikolwiek modul zdazy zaimportowac prawdziwy sterownik.
        # Patchowanie na poziomie `pg_db.psycopg2` (nie globalnego psycopg2)
        # jest odporne na to zanieczyszczenie z innego pliku.
        fake_psycopg2 = _fake_psycopg2_module(connect_return=fake_conn)
        with mock.patch.object(pg_db, "psycopg2", fake_psycopg2):
            with self.assertRaises(pg_db.PgNotConfigured):
                pg_db.connect()

        fake_conn.close.assert_called_once()

    def test_connect_succeeds_when_marker_present(self):
        fake_conn = mock.MagicMock()
        fake_cursor = mock.MagicMock()
        fake_cursor.execute.return_value = None
        fake_cursor.fetchall.return_value = [{"?column?": 1}]
        fake_conn.cursor.return_value = fake_cursor

        fake_psycopg2 = _fake_psycopg2_module(connect_return=fake_conn)
        with mock.patch.object(pg_db, "psycopg2", fake_psycopg2):
            conn = pg_db.connect()

        self.assertIs(conn, fake_conn)
        fake_conn.close.assert_not_called()


if __name__ == "__main__":
    unittest.main()
