# -*- coding: utf-8 -*-
"""ETAP 0: tetno komputerow i rejestr komputerow z M: - TYLKO prawdziwy PostgreSQL (sql/fleet.sql).

Baza: dam_eta_test (rola dam_test_kw) przez DAM_TEST_PG_DSN; kazdy test ma wlasny schemat t_<losowy>
(realpg.fresh_db), w nim schemat aplikacji i - gdy test tego chce - sql/fleet.sql. Bez DAM_TEST_PG_DSN
testy sa pomijane. Produkcji (dam_eta) nic tu nie dotyka.

Uruchomienie:  python -B C:\\Users\\<ja>\\.claude\\mcp\\dam-pg\\test_dsn.py -- python -m unittest tests.test_fleet_heartbeat_realpg
"""
from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
DESKTOP = HERE.parent
for _p in (str(DESKTOP), str(HERE)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import fleet_heartbeat as fh  # noqa: E402
import index_snapshots  # noqa: E402
import m_computers as mc  # noqa: E402

FLEET_SQL = DESKTOP / "sql" / "fleet.sql"
SHARE = "//192.0.2.10/marketing"
OTHER_SHARE = "//192.0.2.99/marketing"
CATALOG = {"kind": "snapshot", "id": "3fa1c9e", "gen": None, "built_at": "2026-10-07T06:37:01+00:00",
           "built_by": "KRZYSZTOFWI", "source": "db", "pulled_at": "2026-10-07T07:00:00+00:00"}


def _info(root="M:\\", **extra):
    return lambda: {"windows_user": "jan", "base_path": root, "root_state": "full", "data_mode": "live",
                    "asset_status": extra}


class _RealPG(unittest.TestCase):
    apply_fleet = True

    def setUp(self):
        import psycopg2  # noqa: PLC0415
        import psycopg2.extras  # noqa: PLC0415
        import realpg  # noqa: PLC0415

        admin_dsn = realpg.require(self)
        cm = realpg.fresh_db(admin_dsn)
        self.dsn = cm.__enter__()
        self.addCleanup(cm.__exit__, None, None, None)
        self._psycopg2 = psycopg2
        self.pg = psycopg2.connect(self.dsn, cursor_factory=psycopg2.extras.RealDictCursor, connect_timeout=10)
        self.addCleanup(self.pg.close)
        cur = self.pg.cursor()
        cur.execute("SELECT current_database() AS db, current_schema() AS s")
        row = cur.fetchone()
        self.assertTrue(str(row["db"]).startswith("dam_eta_test"), row)
        self.assertTrue(str(row["s"]).startswith("t_"), row)
        self.schema = row["s"]
        self.pg.commit()
        if self.apply_fleet:
            self.install_fleet()
        # stan klienta w pamieci i na dysku nie przecieka miedzy testami
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        for patcher in (
            mock.patch.object(mc, "_state_path", return_value=Path(tmp.name) / "m-computers.json"),
            mock.patch("index_authority.current_machine", return_value="TEST-A"),
            mock.patch("index_snapshots.catalog_info", return_value=dict(CATALOG)),
            mock.patch.object(fh, "_app_version", return_value="2.6.1"),
            mock.patch.object(fh, "_dam_user", return_value="jan@example.test"),
            mock.patch.object(fh, "_snapshot_error", return_value=""),
            mock.patch.object(mc, "root_info", side_effect=self._root_info),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        mc.reset_cache()
        self.addCleanup(mc.reset_cache)
        old = dict(fh._STATE)
        self.addCleanup(lambda: (fh._STATE.clear(), fh._STATE.update(old)))
        fh._STATE.update(status="", beats=0, last_beat_at="", last_ok_at="", last_error="", started_at=None)
        self.shares_by_root = {"M:\\": SHARE}

    def _root_info(self, root):
        if not root:
            return {"kind": "none", "drive": "", "share": ""}
        return {"kind": "remote", "drive": root[:2].upper(), "share": self.shares_by_root.get(root, "")}

    # -- pomocnicy ---------------------------------------------------------
    def connect(self):
        import psycopg2.extras  # noqa: PLC0415

        return self._psycopg2.connect(self.dsn, cursor_factory=psycopg2.extras.RealDictCursor, connect_timeout=10)

    def install_fleet(self):
        cur = self.pg.cursor()
        cur.execute(FLEET_SQL.read_text(encoding="utf-8"))
        self.pg.commit()

    def q(self, sql, args=None):
        cur = self.pg.cursor()
        cur.execute(sql, args)
        rows = cur.fetchall() if cur.description else []
        self.pg.commit()
        return rows

    def one(self, sql, args=None):
        rows = self.q(sql, args)
        return rows[0] if rows else None

    def set_shares(self, *shares):
        self.q("INSERT INTO dam_meta (key, value) VALUES ('m_shares', %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
               (json.dumps({"shares": list(shares)}),))

    def beat(self, machine="TEST-A", root="M:\\", **extra):
        with mock.patch("index_authority.current_machine", return_value=machine):
            return fh.beat(_info(root, **extra), self.connect)

    def hb(self, machine="test-a"):
        return self.one("SELECT * FROM dam_client_heartbeat WHERE machine = %s", (machine,))

    def m_row(self, machine="test-a", drive="M:"):
        return self.one("SELECT * FROM dam_m_computers WHERE machine = %s AND drive = %s", (machine, drive))

    def is_m(self, who):
        return self.one("SELECT dam_is_m_computer(%s) AS v", (who,))["v"]


class DdlTests(_RealPG):
    apply_fleet = False

    def test_ddl_dwa_razy_z_rzedu_i_nazwy_bez_schematu(self):
        self.install_fleet()
        self.install_fleet()  # idempotentny
        for name in ("dam_client_heartbeat", "dam_m_computers"):
            self.assertIsNotNone(self.one("SELECT to_regclass(%s) AS t", (name,))["t"])  # bez kwalifikacji, przez search_path
        self.assertIsNotNone(self.one("SELECT to_regprocedure('dam_is_m_computer(text)') AS t")["t"])
        found = [r["nspname"] for r in self.q(
            "SELECT n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = 'dam_is_m_computer'")]
        self.assertIn(self.schema, found)
        self.assertNotIn("public", found)

    def test_checki_nazwy_komputera_i_udzialu(self):
        self.install_fleet()
        bad = [
            "INSERT INTO dam_client_heartbeat (machine) VALUES ('TEST-A')",  # wielkie litery
            "INSERT INTO dam_client_heartbeat (machine) VALUES ('')",
            "INSERT INTO dam_m_computers (machine, drive) VALUES ('test-a:m1', 'M:')",  # dwukropek
            "INSERT INTO dam_m_computers (machine, drive) VALUES ('Test-A', 'M:')",
            "INSERT INTO dam_m_computers (machine, drive, share) VALUES ('test-a', 'M:', '\\\\serwer\\marketing')",  # backslash
            "INSERT INTO dam_m_computers (machine, drive, share) VALUES ('test-a', 'M:', '//serwer/marketing/')",  # koncowy /
            "INSERT INTO dam_m_computers (machine, drive, share) VALUES ('test-a', 'M:', '//SERWER/m')",  # wielkie litery
            "INSERT INTO dam_m_computers (machine, drive, state) VALUES ('test-a', 'M:', 'zatwierdzone')",
            "INSERT INTO dam_m_computers (machine, drive, source) VALUES ('test-a', 'M:', 'ktos')",
        ]
        for sql in bad:
            with self.subTest(sql=sql):
                cur = self.pg.cursor()
                with self.assertRaises(self._psycopg2.errors.CheckViolation):
                    cur.execute(sql)
                self.pg.rollback()
        self.q("INSERT INTO dam_m_computers (machine, drive, share) VALUES ('test-a', 'M:', %s)", (SHARE,))  # poprawny wiersz przechodzi


class NoTablesTests(_RealPG):
    """Program bez fleet.sql dziala jak 2.6.0: tetno po cichu pomija zapis."""

    apply_fleet = False

    def test_bez_tabel_brak_wyjatkow_i_jedna_linia_w_logu(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            results = [self.beat() for _ in range(4)]
        for res in results:
            self.assertEqual((res["ok"], res["status"]), (True, "no_tables"))
        self.assertEqual(buf.getvalue().count("fleet_heartbeat:"), 1)  # jedno ostrzezenie, nie co cykl
        self.assertIn("fleet.sql", buf.getvalue())
        self.assertIsNone(self.one("SELECT to_regclass('dam_client_heartbeat') AS t")["t"])  # klient niczego nie utworzyl
        self.assertIsNone(self.one("SELECT to_regclass('dam_m_computers') AS t")["t"])
        self.assertIsNone(self.one("SELECT to_regprocedure('dam_is_m_computer(text)') AS t")["t"])

    def test_bez_tabel_admin_status_mowi_o_brakach(self):
        out = fh.admin_status(self.connect)
        self.assertEqual(out["tables"], {"heartbeat": False, "m_computers": False})
        self.assertEqual((out["computers"], out["m_computers"]), ([], []))

    def test_bez_tabel_rola_to_kopia_bez_wyjatku(self):
        r = mc.role_for_root(self.connect, "M:\\")
        self.assertEqual((r["role"], r["state"]), ("copy", "none"))

    def test_tabele_pojawiaja_sie_pozniej_tetno_zaczyna_pisac(self):
        self.assertEqual(self.beat()["status"], "no_tables")
        self.install_fleet()
        self.assertEqual(self.beat()["status"], "ok")
        self.assertEqual(self.hb()["machine_name"], "TEST-A")


class HeartbeatTests(_RealPG):
    def test_pierwsze_tetno_zapisuje_wszystkie_pola(self):
        res = self.beat(assets_max_rev=77, missing_marked=3, holds=1, witness_tripped=False)
        self.assertEqual((res["ok"], res["status"]), (True, "ok"))
        row = self.hb()
        self.assertEqual((row["machine_name"], row["windows_user"], row["dam_user"]), ("TEST-A", "jan", "jan@example.test"))
        self.assertEqual((row["app_version"], row["proto"], row["platform"], row["data_mode"]), ("2.6.1", 1, sys.platform, "live"))
        self.assertEqual((row["catalog_kind"], row["catalog_id"], row["catalog_source"], row["catalog_built_at"]),
                         ("snapshot", "3fa1c9e", "db", "2026-10-07T06:37:01+00:00"))
        self.assertIsNone(row["catalog_gen"])
        self.assertEqual((row["assets_rev"], row["missing_marked"], row["holds"], row["witness_tripped"]), (77, 3, 1, False))
        self.assertEqual((row["root_kind"], row["root_drive"], row["root_share"], row["root_state"]), ("remote", "M:", SHARE, "full"))
        self.assertEqual((row["m_role"], row["m_state"]), ("copy", "none"))
        self.assertIsNotNone(row["started_at"])
        self.assertEqual(row["last_error"], "")

    def test_drugie_tetno_zmienia_seen_at_nie_first_seen_at_i_started_at(self):
        self.beat()
        first = self.hb()
        self.q("UPDATE dam_client_heartbeat SET seen_at = now() - interval '1 hour', app_version = 'stara'")
        self.beat()
        second = self.hb()
        self.assertEqual(second["app_version"], "2.6.1")
        self.assertGreater(second["seen_at"], first["seen_at"] - __import__("datetime").timedelta(seconds=1))
        self.assertEqual(second["first_seen_at"], first["first_seen_at"])
        self.assertEqual(second["started_at"], first["started_at"])
        self.assertEqual(self.one("SELECT count(*) AS n FROM dam_client_heartbeat")["n"], 1)

    def test_czas_z_zegara_bazy_a_przesuniecie_liczone_w_sql(self):
        with mock.patch.dict(os.environ, {"DAM_TEST_PG": "1", "DAM_TEST_CLOCK_SKEW_S": "7200"}):
            self.beat()
        row = self.hb()
        self.assertAlmostEqual(row["clock_skew_s"], 7200.0, delta=10.0)  # klient o 2 h do przodu wzgledem bazy
        age = self.one("SELECT extract(epoch FROM now() - seen_at) AS s FROM dam_client_heartbeat")["s"]
        self.assertLess(abs(float(age)), 15)  # seen_at z bazy, bez przesuniecia klienta

    def test_bez_przesuniecia_zegar_zgodny(self):
        self.beat()
        self.assertLess(abs(self.hb()["clock_skew_s"]), 30.0)

    def test_dwa_komputery_dwa_wiersze_i_wersje(self):
        self.beat("TEST-A")
        with mock.patch.object(fh, "_app_version", return_value="2.5.9"):
            self.beat("TEST-B", root="")
        rows = {r["machine"]: r for r in self.q("SELECT * FROM dam_client_heartbeat")}
        self.assertEqual(set(rows), {"test-a", "test-b"})
        self.assertEqual(rows["test-b"]["app_version"], "2.5.9")
        self.assertEqual((rows["test-b"]["root_kind"], rows["test-b"]["root_drive"], rows["test-b"]["m_role"]), ("none", "", "copy"))

    def test_wylacznik_w_bazie(self):
        self.beat()
        self.q("UPDATE dam_client_heartbeat SET app_version = 'zamrozona'")
        self.q("INSERT INTO dam_meta (key, value) VALUES ('fleet_heartbeat', 'off')")
        buf = io.StringIO()
        with redirect_stdout(buf):
            res = self.beat()
        self.assertEqual((res["ok"], res["status"]), (True, "off"))
        self.assertEqual(self.hb()["app_version"], "zamrozona")  # nie zapisano
        self.q("UPDATE dam_meta SET value = 'on' WHERE key = 'fleet_heartbeat'")
        self.assertEqual(self.beat()["status"], "ok")
        self.assertEqual(self.hb()["app_version"], "2.6.1")

    def test_blad_rejestru_m_nie_zabija_tetna(self):
        self.set_shares(SHARE)
        bad = "INSERT INTO dam_m_computers (machine, drive, share, state, source) VALUES (%(machine)s, %(drive)s, %(share)s, 'zle', 'auto')"
        with mock.patch.object(fh, "_SELF_REPORT_SQL", bad):
            res = self.beat()
        self.assertEqual((res["ok"], res["status"]), (True, "ok"))
        row = self.hb()
        self.assertIn("rejestr M:", row["last_error"])
        self.assertEqual((row["m_role"], row["m_state"]), ("copy", "none"))
        self.assertIsNone(self.m_row())

    def test_blad_zapisu_trafia_do_last_error_nastepnego_tetna(self):
        self.beat()
        fh._STATE["last_error"] = "poprzednie tetno padlo"
        self.beat()
        self.assertEqual(self.hb()["last_error"], "poprzednie tetno padlo")
        self.beat()
        self.assertEqual(self.hb()["last_error"], "")  # po udanym tetnie czyste


class MRegistryTests(_RealPG):
    def test_samozgloszenie_pending_potem_decyzja_admina(self):
        self.set_shares(SHARE)
        self.beat()
        row = self.m_row()
        self.assertEqual((row["state"], row["source"], row["share"], row["decided_by"]), ("pending", "auto", SHARE, ""))
        self.assertEqual((self.hb()["m_role"], self.hb()["m_state"]), ("copy", "pending"))
        self.assertFalse(self.is_m("TEST-A:m1"))
        res = fh.m_decision(self.connect, machine="TEST-A", drive="m:", state="approved", note=None, by="admin@example.test")
        self.assertTrue(res["ok"], res)
        row = self.m_row()
        self.assertEqual((row["state"], row["decided_by"]), ("approved", "admin@example.test"))
        self.assertIsNotNone(row["decided_at"])
        for who in ("TEST-A", "test-a:m1", "TEST-A:repair", "  Test-A "):
            with self.subTest(who=who):
                self.assertTrue(self.is_m(who))
        self.beat()
        self.assertEqual((self.hb()["m_role"], self.hb()["m_state"]), ("m", "approved"))
        self.assertEqual(mc.role_for_root(self.connect, "M:\\", force=True)["role"], "m")

    def test_ponowne_zgloszenie_z_tym_samym_udzialem_nie_rusza_zatwierdzenia(self):
        self.set_shares(SHARE)
        self.beat()
        fh.m_decision(self.connect, machine="test-a", drive="M:", state="approved", note="ok", by="admin@example.test")
        before = self.m_row()
        self.beat()
        self.beat()
        after = self.m_row()
        self.assertEqual((after["state"], after["decided_at"], after["decided_by"], after["note"], after["requested_at"]),
                         ("approved", before["decided_at"], "admin@example.test", "ok", before["requested_at"]))

    def test_zmiana_udzialu_wraca_do_pending_i_zeruje_decyzje(self):
        self.set_shares(SHARE, OTHER_SHARE)
        self.beat()
        fh.m_decision(self.connect, machine="test-a", drive="M:", state="approved", note=None, by="admin@example.test")
        self.shares_by_root["M:\\"] = OTHER_SHARE  # litera M: przemapowana na inny udzial
        self.beat()
        row = self.m_row()
        self.assertEqual((row["state"], row["share"], row["decided_by"]), ("pending", OTHER_SHARE, ""))
        self.assertIsNone(row["decided_at"])
        self.assertFalse(self.is_m("TEST-A"))
        self.assertEqual(self.hb()["m_role"], "copy")

    def test_wiersz_admina_nie_jest_ruszany_przez_klienta(self):
        self.set_shares(SHARE)
        self.q("INSERT INTO dam_m_computers (machine, drive, share, state, source, decided_by) "
               "VALUES ('test-a', 'M:', %s, 'approved', 'admin', 'admin@example.test')", ("//reczny/wpis",))
        self.beat()
        row = self.m_row()
        self.assertEqual((row["state"], row["share"], row["source"]), ("approved", "//reczny/wpis", "admin"))
        self.assertEqual(self.hb()["m_role"], "m")  # admin wie lepiej niz wykrywanie

    def test_odwolane_dziala_od_nastepnego_zapisu_bez_cache(self):
        self.set_shares(SHARE)
        self.beat()
        fh.m_decision(self.connect, machine="test-a", drive="M:", state="approved", note=None, by="a@x")
        cur = self.pg.cursor()
        cur.execute("SELECT dam_is_m_computer('TEST-A') AS v")
        self.assertTrue(cur.fetchone()["v"])
        cur.execute("UPDATE dam_m_computers SET state = 'revoked' WHERE machine = 'test-a'")
        cur.execute("SELECT dam_is_m_computer('TEST-A') AS v")  # ta sama sesja, zaraz po UPDATE
        self.assertFalse(cur.fetchone()["v"])
        self.pg.commit()
        self.beat()
        self.assertEqual((self.hb()["m_role"], self.hb()["m_state"]), ("copy", "revoked"))

    def test_kopia_zadeklarowana_blednie_jako_m_nie_dostaje_roli(self):
        """N7: B ma ten sam udzial co A w konfiguracji ROOT, ale nikt jej nie zatwierdzil."""
        self.set_shares(SHARE)
        self.beat("TEST-A")
        self.beat("TEST-B")
        fh.m_decision(self.connect, machine="test-a", drive="M:", state="approved", note=None, by="a@x")
        self.beat("TEST-B")
        self.assertEqual((self.hb("test-b")["m_role"], self.hb("test-b")["m_state"]), ("copy", "pending"))
        self.assertFalse(self.is_m("TEST-B"))
        self.assertTrue(self.is_m("TEST-A"))

    def test_stary_klient_bez_tetna_nie_dziedziczy_zatwierdzenia(self):
        """S16: zatwierdzenie pary A nie rozlewa sie na D (stara wersja, brak wiersza)."""
        self.set_shares(SHARE)
        self.beat("TEST-A")
        fh.m_decision(self.connect, machine="test-a", drive="M:", state="approved", note=None, by="a@x")
        self.assertFalse(self.is_m("TEST-D"))
        self.assertFalse(self.is_m("TEST-D:m1"))
        self.assertFalse(self.is_m(""))
        self.assertFalse(self.is_m(None))
        self.assertIsNone(self.hb("test-d"))

    def test_udzial_spoza_listy_nie_zglasza_sie(self):
        self.set_shares(OTHER_SHARE)
        self.beat()
        self.assertIsNone(self.m_row())
        self.assertEqual((self.hb()["m_role"], self.hb()["m_state"]), ("copy", "none"))

    def test_pusta_lista_i_brak_klucza_nic_nie_zglaszaja(self):
        self.beat()
        self.assertIsNone(self.m_row())
        self.set_shares()
        self.beat()
        self.assertIsNone(self.m_row())

    def test_zmiana_root_to_inna_para(self):
        self.set_shares(SHARE)
        self.beat()
        fh.m_decision(self.connect, machine="test-a", drive="M:", state="approved", note=None, by="a@x")
        self.shares_by_root["D:\\"] = "d:/dam/root"
        self.beat(root="D:\\")  # przelaczenie ROOT z M: na D:
        row = self.hb()
        self.assertEqual((row["m_role"], row["m_state"], row["root_drive"]), ("copy", "none", "D:"))
        self.assertEqual(mc.role_for_root(self.connect, "D:\\", force=True)["role"], "copy")
        self.assertEqual(mc.role_for_root(self.connect, "M:\\", force=True)["role"], "m")  # M: nadal zatwierdzone

    def test_role_for_root_pending_revoked_none(self):
        self.assertEqual(mc.role_for_root(self.connect, "M:\\", force=True)["state"], "none")
        self.q("INSERT INTO dam_m_computers (machine, drive, share) VALUES ('test-a', 'M:', %s)", (SHARE,))
        r = mc.role_for_root(self.connect, "M:\\", force=True)
        self.assertEqual((r["role"], r["state"], r["stale"]), ("copy", "pending", False))
        self.q("UPDATE dam_m_computers SET state = 'revoked'")
        self.assertEqual(mc.role_for_root(self.connect, "M:\\", force=True)["state"], "revoked")


class AdminTests(_RealPG):
    def _sessions(self, *hosts):
        self.q("INSERT INTO users (email, name, password_hash, created_at, updated_at) VALUES ('u@example.test', 'U', 'x', 'dzis', 'dzis')")
        uid = self.one("SELECT id FROM users WHERE email = 'u@example.test'")["id"]
        for i, (host, revoked) in enumerate(hosts):
            self.q("INSERT INTO device_sessions (user_id, device_id, hostname, windows_user, token_hash, created_at, last_seen_at, revoked) "
                   "VALUES (%s, %s, %s, 'jan', %s, 'wczoraj', '2026-10-06T10:00:00', %s)", (uid, f"dev{i}", host, f"tok{i}", revoked))

    def test_lista_floty_i_komputery_bez_tetna(self):
        self.set_shares(SHARE)
        self.beat("TEST-A")
        with mock.patch.object(fh, "_app_version", return_value="2.5.9"):
            self.beat("TEST-B")
        self._sessions(("TEST-A", False), ("TEST-D", False), ("TEST-OLD", True))
        out = fh.admin_status(self.connect)
        self.assertEqual(out["tables"], {"heartbeat": True, "m_computers": True})
        self.assertEqual([c["machine"] for c in out["computers"]], ["test-a", "test-b"])
        self.assertTrue(all(c["online"] and c["age_s"] < 60 for c in out["computers"]))
        self.assertEqual(out["latest_app_version"], "2.6.1")
        self.assertEqual([m["machine"] for m in out["no_heartbeat"]], ["test-d"])  # TEST-A ma tetno, TEST-OLD sesja wygasla
        self.assertEqual(out["m_shares"], [SHARE])
        self.assertEqual(sorted(m["machine"] for m in out["m_computers"]), ["test-a", "test-b"])
        self.assertEqual(out["computers"][0]["m_row"]["state"], "pending")
        self.assertIn("now", out)
        json.dumps(out)  # odpowiedz da sie zserializowac

    def test_wiek_z_zegara_bazy_i_stan_offline(self):
        self.beat()
        self.q("UPDATE dam_client_heartbeat SET seen_at = now() - interval '2 hours'")
        c = fh.admin_status(self.connect)["computers"][0]
        self.assertFalse(c["online"])
        self.assertAlmostEqual(c["age_s"], 7200, delta=30)

    def test_zatwierdzony_bez_podpisu_jest_oznaczony(self):
        self.q("INSERT INTO dam_m_computers (machine, drive, share, state, source, decided_by) "
               "VALUES ('test-a', 'M:', %s, 'approved', 'admin', '')", (SHARE,))
        self.assertTrue(fh.admin_status(self.connect)["m_computers"][0]["unsigned"])

    def test_katalog_w_bazie(self):
        keys = index_snapshots.CATALOG_KEYS
        for k in keys:
            self.q("INSERT INTO dam_index_snapshots (store_key, generation, sha256, payload_gz, built_at, built_by, published_at) "
                   "VALUES (%s, 1, %s, ''::bytea, '2026-10-07T06:00:00+00:00', 'KRZYSZTOFWI', 'x')", (k, "sha-" + k))
        cat = fh.admin_status(self.connect)["db_catalog"]
        self.assertEqual(cat["id"], index_snapshots.catalog_id_from_shas({k: "sha-" + k for k in keys}))
        self.assertEqual((cat["built_at"], cat["built_by"]), ("2026-10-07T06:00:00+00:00", "KRZYSZTOFWI"))

    def test_m_share_dodaj_usun_bez_duplikatow(self):
        r = fh.m_share(self.connect, action="add", share="\\\\Serwer\\Marketing\\", by="a@x")
        self.assertEqual(r["shares"], ["//serwer/marketing"])
        fh.m_share(self.connect, action="add", share="//SERWER/marketing", by="a@x")
        r = fh.m_share(self.connect, action="add", share="//inny/m", by="a@x")
        self.assertEqual(r["shares"], ["//serwer/marketing", "//inny/m"])
        r = fh.m_share(self.connect, action="remove", share="//serwer/Marketing/", by="a@x")
        self.assertEqual(r["shares"], ["//inny/m"])
        doc = json.loads(self.one("SELECT value FROM dam_meta WHERE key = 'm_shares'")["value"])
        self.assertEqual((doc["shares"], doc["updated_by"]), (["//inny/m"], "a@x"))
        self.assertFalse(fh.m_share(self.connect, action="add", share="", by="a@x")["ok"])
        self.assertFalse(fh.m_share(self.connect, action="zmien", share="//x/y", by="a@x")["ok"])

    def test_m_register_dopisuje_udzial_z_tetna_i_zatwierdza(self):
        self.beat()  # lista pusta: nic sie jeszcze nie zglosilo
        self.assertIsNone(self.m_row())
        r = fh.m_register(self.connect, machine="TEST-A", drive="M:", by="admin@example.test")
        self.assertTrue(r["ok"], r)
        self.assertEqual(r["shares"], [SHARE])
        row = self.m_row()
        self.assertEqual((row["state"], row["source"], row["share"], row["decided_by"]), ("approved", "auto", SHARE, "admin@example.test"))
        self.assertTrue(self.is_m("TEST-A"))
        self.assertEqual(fh.m_register(self.connect, machine="TEST-A", drive="M:", by="a@x")["shares"], [SHARE])  # bez duplikatu
        self.beat()
        self.assertEqual((self.hb()["m_role"], self.hb()["m_state"]), ("m", "approved"))

    def test_m_register_bez_tetna_albo_bez_udzialu(self):
        self.assertEqual(fh.m_register(self.connect, machine="TEST-X", drive="M:", by="a@x")["error"], "no_heartbeat")
        self.beat(root="")
        self.assertEqual(fh.m_register(self.connect, machine="TEST-A", drive="", by="a@x")["error"], "no_share")

    def test_m_decision_walidacja(self):
        self.assertEqual(fh.m_decision(self.connect, machine="test-a", drive="M:", state="pending", note=None, by="a@x")["error"], "bad_state")
        self.assertEqual(fh.m_decision(self.connect, machine="", drive="M:", state="approved", note=None, by="a@x")["error"], "machine_required")
        self.assertEqual(fh.m_decision(self.connect, machine="nie-ma", drive="M:", state="approved", note=None, by="a@x")["error"], "not_found")


class StartTests(_RealPG):
    def test_watek_robi_tetno_i_nie_dubluje_sie(self):
        """Prawdziwy watek z krotkim rytmem: wiersz pojawia sie bez recznego wolania beat()."""
        import time

        self.addCleanup(fh.stop)
        with mock.patch.dict(os.environ, {"DAM_HEARTBEAT_S": "5"}):
            res = fh.start(_info("M:\\"), self.connect)
            self.assertTrue(res["started"])
            deadline = time.monotonic() + 20
            while time.monotonic() < deadline and not self.hb():
                time.sleep(0.2)
            self.assertIsNotNone(self.hb(), "tetno nie zapisalo wiersza w 20 s")
            self.assertTrue(fh.local_state()["thread_alive"])
            self.assertEqual(fh.start(_info("M:\\"), self.connect)["started"], False)  # drugi raz: nie dubluje watku
        fh.stop()
        self.assertFalse(fh.local_state()["thread_alive"])


if __name__ == "__main__":
    unittest.main()
