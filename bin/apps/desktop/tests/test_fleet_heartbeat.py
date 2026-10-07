# -*- coding: utf-8 -*-
"""ETAP 0: tetno komputerow - czysta logika (fleet_heartbeat.py), bez bazy.

SQL (UPSERT, samozgloszenie, odczyt floty, brak tabel) jest w test_fleet_heartbeat_realpg.py na
prawdziwym PostgreSQL. Tu: rytm i odstepy (Pace), budowa wiersza, przelaczniki srodowiskowe,
zachowanie przy bazie, ktora nie odpowiada, i brak spamu w logu."""
from __future__ import annotations

import io
import os
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import fleet_heartbeat as fh  # noqa: E402

INFO = {"windows_user": "jan", "base_path": "M:\\", "root_state": "full", "data_mode": "live",
        "asset_status": {"assets_max_rev": 1234, "missing_marked": 5, "holds": 2, "witness_tripped": False}}
RINFO = {"kind": "remote", "drive": "M:", "share": "//a/marketing"}
ROLE = {"role": "m", "state": "approved"}
CATALOG = {"kind": "snapshot", "id": "3fa1c9e", "gen": None, "built_at": "2026-10-07T06:37:01+00:00",
           "source": "db", "pulled_at": "2026-10-07T07:00:00+00:00"}


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


class PaceTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()

    def test_pierwsze_tetno_po_opoznieniu_nie_od_razu(self):
        pace = fh.Pace(300, clock=self.clock)
        self.assertFalse(pace.due())
        self.clock.t += fh.FIRST_DELAY_S - 1
        self.assertFalse(pace.due())
        self.clock.t += 1
        self.assertTrue(pace.due())

    def test_krotki_rytm_skraca_pierwsze_opoznienie(self):
        pace = fh.Pace(10, clock=self.clock)  # harness: DAM_HEARTBEAT_S=10
        self.clock.t += 10
        self.assertTrue(pace.due())

    def test_po_sukcesie_nastepne_za_interwal(self):
        pace = fh.Pace(300, clock=self.clock)
        self.clock.t += 20
        pace.done(True)
        self.clock.t += 299
        self.assertFalse(pace.due())
        self.clock.t += 1
        self.assertTrue(pace.due())

    def test_po_bledzie_nie_czesciej_niz_co_60_s(self):
        pace = fh.Pace(10, clock=self.clock)
        self.clock.t += 10
        pace.done(False)
        self.clock.t += 59
        self.assertFalse(pace.due())
        pace.kick()  # kick nie omija odstepu po bledzie
        self.assertFalse(pace.due())
        self.clock.t += 1
        self.assertTrue(pace.due())

    def test_kick_przed_pierwszym_tetnem_nic_nie_przyspiesza(self):
        pace = fh.Pace(300, clock=self.clock)
        pace.kick()
        self.assertFalse(pace.due())  # pierwsze zaplanowane i tak za <= 20 s, a most jeszcze startuje

    def test_kick_najwyzej_raz_na_20_s(self):
        pace = fh.Pace(300, clock=self.clock)
        self.clock.t += 20
        pace.done(True)
        pace.kick()
        self.clock.t += fh.KICK_MIN_S - 1
        self.assertFalse(pace.due())
        self.clock.t += 1
        self.assertTrue(pace.due())
        pace.done(True)
        self.assertFalse(pace.kicked)  # tetno zjada zalegly kick

    def test_wiele_kickow_to_jedno_tetno(self):
        pace = fh.Pace(300, clock=self.clock)
        self.clock.t += 20
        pace.done(True)
        for _ in range(5):
            pace.kick()
        self.clock.t += 25
        self.assertTrue(pace.due())
        pace.done(True)
        self.assertFalse(pace.due())


class EnvTests(unittest.TestCase):
    def test_interwal_domyslny_i_z_env(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DAM_HEARTBEAT_S", None)
            self.assertEqual(fh.interval_s(), 300.0)
        with mock.patch.dict(os.environ, {"DAM_HEARTBEAT_S": "10"}):
            self.assertEqual(fh.interval_s(), 10.0)
        with mock.patch.dict(os.environ, {"DAM_HEARTBEAT_S": "1"}):
            self.assertEqual(fh.interval_s(), fh.MIN_INTERVAL_S)
        with mock.patch.dict(os.environ, {"DAM_HEARTBEAT_S": "cos"}):
            self.assertEqual(fh.interval_s(), 300.0)

    def test_zero_wylacza_tetno_lokalnie(self):
        with mock.patch.dict(os.environ, {"DAM_HEARTBEAT_S": "0"}):
            self.assertEqual(fh.interval_s(), 0.0)
            with mock.patch.object(fh, "_THREAD", None):
                res = fh.start(lambda: {})
                self.assertEqual((res["started"], res["reason"]), (False, "disabled"))
                self.assertIsNone(fh._THREAD)

    def test_przesuniecie_zegara_tylko_w_trybie_testowym(self):
        with mock.patch.dict(os.environ, {"DAM_TEST_CLOCK_SKEW_S": "7200"}):
            os.environ.pop("DAM_TEST_PG", None)
            self.assertEqual(fh._clock_skew_test_s(), 0.0)
            os.environ["DAM_TEST_PG"] = "1"
            self.assertEqual(fh._clock_skew_test_s(), 7200.0)
            os.environ["DAM_TEST_CLOCK_SKEW_S"] = "to nie liczba"
            self.assertEqual(fh._clock_skew_test_s(), 0.0)


class BuildRowTests(unittest.TestCase):
    def build(self, **over):
        kw = dict(machine_name="KRZYSZTOFWI", rinfo=RINFO, role=ROLE, catalog=CATALOG, app_version="2.6.1",
                  dam_user="jan@x.pl", last_error="")
        kw.update(over)
        return fh.build_row(INFO, **kw)

    def test_wszystkie_kolumny_upsertu_sa_obecne(self):
        row = self.build()
        self.assertEqual(set(row) - {"machine"}, set(fh._ROW_COLS))
        self.assertEqual(row["machine"], "krzysztofwi")
        self.assertEqual(row["machine_name"], "KRZYSZTOFWI")
        self.assertEqual((row["root_drive"], row["root_share"], row["m_role"], row["m_state"]), ("M:", "//a/marketing", "m", "approved"))
        self.assertEqual((row["assets_rev"], row["missing_marked"], row["holds"], row["witness_tripped"]), (1234, 5, 2, False))
        self.assertEqual((row["proto"], row["app_version"], row["catalog_id"]), (1, "2.6.1", "3fa1c9e"))

    def test_kolumny_not_null_nigdy_none(self):
        row = fh.build_row({}, machine_name="X", rinfo={}, role={}, catalog={}, app_version="", dam_user="", last_error="")
        nullable = {"catalog_gen", "assets_rev", "missing_marked", "holds", "witness_tripped"}
        self.assertEqual([k for k, v in row.items() if v is None and k not in nullable], [])
        self.assertEqual((row["root_kind"], row["root_state"], row["m_role"], row["m_state"]), ("none", "none", "copy", "none"))
        self.assertTrue(all(row[k] is None for k in nullable))  # pola etapu 1a/3 do czasu, az je ktos dostarczy

    def test_last_error_obciety_do_300(self):
        self.assertEqual(len(self.build(last_error="x" * 1000)["last_error"]), 300)

    def test_pola_etapu_1a_tylko_gdy_poprawny_typ(self):
        info = dict(INFO, asset_status={"assets_max_rev": "17", "missing_marked": "nie", "holds": True, "witness_tripped": 1})
        row = fh.build_row(info, machine_name="X", rinfo=RINFO, role=ROLE, catalog=CATALOG, app_version="", dam_user="", last_error="")
        self.assertEqual((row["assets_rev"], row["missing_marked"], row["holds"], row["witness_tripped"]), (17, None, None, None))

    def test_numer_kompletu_z_etapu_3(self):
        row = self.build(catalog={**CATALOG, "kind": "generation", "id": "42", "gen": 42})
        self.assertEqual((row["catalog_kind"], row["catalog_id"], row["catalog_gen"]), ("generation", "42", 42))


class HelpersTests(unittest.TestCase):
    def test_parse_shares_normalizuje_i_odrzuca_smieci(self):
        raw = '{"shares": ["\\\\\\\\Serwer\\\\Marketing\\\\", "//serwer/marketing", "", 5, "//inny/m"], "updated_by": "x"}'
        self.assertEqual(fh._parse_shares(raw), ["//serwer/marketing", "5", "//inny/m"])
        self.assertEqual(fh._parse_shares("nie json"), [])
        self.assertEqual(fh._parse_shares('{"shares": "a"}'), [])
        self.assertEqual(fh._parse_shares(None), [])

    def test_klucz_wersji(self):
        self.assertEqual(fh._version_key("2.6.10"), (2, 6, 10))
        self.assertGreater(fh._version_key("2.6.10"), fh._version_key("2.6.9"))  # liczbowo, nie tekstowo
        self.assertIsNone(fh._version_key("dev"))
        self.assertIsNone(fh._version_key(""))


class BeatWithoutDatabaseTests(unittest.TestCase):
    """Baza po prostu nie odpowiada: tetno nie rzuca, loguje JEDNA linie przy zmianie stanu, nie co cykl."""

    def setUp(self):
        old = dict(fh._STATE)
        self.addCleanup(lambda: (fh._STATE.clear(), fh._STATE.update(old)))
        fh._STATE.update(status="", beats=0, last_beat_at="", last_ok_at="", last_error="", started_at=None)
        p = mock.patch("index_authority.current_machine", return_value="TEST-A")
        p.start()
        self.addCleanup(p.stop)

    def down(self):
        raise OSError("baza nie odpowiada")

    def test_blad_polaczenia_nie_rzuca_i_jest_zapisany(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            res = fh.beat(lambda: INFO, self.down)
        self.assertFalse(res["ok"])
        self.assertEqual(res["status"], "error")
        self.assertIn("baza nie odpowiada", fh.local_state()["last_error"])
        self.assertEqual(buf.getvalue().count("fleet_heartbeat:"), 1)

    def test_powtarzajacy_sie_blad_loguje_raz(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            for _ in range(5):
                fh.beat(lambda: INFO, self.down)
        self.assertEqual(buf.getvalue().count("fleet_heartbeat:"), 1)
        self.assertEqual(fh.local_state()["beats"], 5)

    def test_wyjatek_w_get_info_tez_nie_rzuca(self):
        def boom():
            raise RuntimeError("get_info padl")

        with redirect_stdout(io.StringIO()):
            res = fh.beat(boom, self.down)
        self.assertFalse(res["ok"])
        self.assertIn("get_info padl", res["error"])

    def test_brak_nazwy_komputera_pomija_tetno(self):
        with mock.patch("index_authority.current_machine", return_value=""), redirect_stdout(io.StringIO()):
            res = fh.beat(lambda: INFO, mock.Mock(side_effect=AssertionError("nie wolno laczyc sie bez nazwy")))
        self.assertEqual((res["ok"], res["status"]), (True, "no_machine"))


if __name__ == "__main__":
    unittest.main()
