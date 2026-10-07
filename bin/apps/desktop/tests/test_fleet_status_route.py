# -*- coding: utf-8 -*-
"""ETAP 0: trasy mostu /fleet/* i znacznik katalogu w /health, /index/status, plus kick po zmianie ROOT.

Prawdziwy ThreadingHTTPServer na 127.0.0.1:0 (jak test_branding_assoc_scope). Czesc bez bazy: bramka
sesji i roli (401/403/200), brak tras w PUBLIC_ANON_PATHS, /health bez IO. Czesc na prawdziwym PG
(skip bez DAM_TEST_PG_DSN): decyzje admina trafiaja do bazy i do audit_log, odczyt floty."""
from __future__ import annotations

import http.client
import json
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
DESKTOP = HERE.parent
for _p in (str(DESKTOP), str(HERE)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import fleet_heartbeat as fh  # noqa: E402
import index_snapshots  # noqa: E402
import local_bridge  # noqa: E402
import pg_db  # noqa: E402

ADMIN = {"email": "admin@test.local", "role": "admin"}
USER = {"email": "jan@test.local", "role": "user"}


class _Server(unittest.TestCase):
    user: dict | None = ADMIN

    def setUp(self):
        self.patches = []
        self._patch(local_bridge, "PUBLIC_MODE", False)
        self._patch(local_bridge.Handler, "_session_user", return_value=self.user)
        self.audit = self._patch(local_bridge, "append_audit", return_value={"ok": True})
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), local_bridge.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.addCleanup(self._stop)

    def _stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        for p in reversed(self.patches):
            p.stop()

    def _patch(self, target, attr, *new, **kwargs):
        p = mock.patch.object(target, attr, *new, **kwargs)
        m = p.start()
        self.patches.append(p)
        return m

    def req(self, method, path, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=20)
        hdrs = {"Host": "127.0.0.1"}
        payload = json.dumps(body).encode() if body is not None else None
        if payload is not None:
            hdrs["Content-Type"] = "application/json"
        conn.request(method, path, body=payload, headers=hdrs)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, json.loads(data or b"{}")


FLEET_POST = ("/fleet/m-decision", "/fleet/m-share", "/fleet/m-register")


class AnonymousTests(_Server):
    user = None

    def test_bez_sesji_401(self):
        self.assertEqual(self.req("GET", "/fleet/status")[0], 401)
        for path in FLEET_POST:
            with self.subTest(path=path):
                self.assertEqual(self.req("POST", path, {"machine": "x"})[0], 401)


class UserRoleTests(_Server):
    user = USER

    def test_rola_uzytkownika_403_i_baza_nietknieta(self):
        with mock.patch.object(fh, "admin_status") as status, mock.patch.object(fh, "m_decision") as dec:
            self.assertEqual(self.req("GET", "/fleet/status")[0], 403)
            for path in FLEET_POST:
                with self.subTest(path=path):
                    code, body = self.req("POST", path, {"machine": "x", "state": "approved"})
                    self.assertEqual((code, body["error"]), (403, "admin_required"))
            status.assert_not_called()
            dec.assert_not_called()
        self.audit.assert_not_called()


class AdminWiringTests(_Server):
    user = ADMIN

    def test_status_200_z_odpowiedzia_modulu(self):
        with mock.patch.object(fh, "admin_status", return_value={"computers": [], "now": "x"}) as status:
            code, body = self.req("GET", "/fleet/status")
        self.assertEqual((code, body["ok"], body["now"]), (200, True, "x"))
        status.assert_called_once()

    def test_status_blad_bazy_to_ok_false_nie_500(self):
        with mock.patch.object(fh, "admin_status", side_effect=OSError("baza nie odpowiada")):
            code, body = self.req("GET", "/fleet/status")
        self.assertEqual((code, body["ok"]), (200, False))
        self.assertIn("baza nie odpowiada", body["error"])

    def test_decyzja_przekazuje_email_admina_i_zapisuje_audyt(self):
        ok = {"ok": True, "row": {"machine": "test-a", "drive": "M:", "state": "approved"}}
        with mock.patch.object(fh, "m_decision", return_value=ok) as dec:
            code, body = self.req("POST", "/fleet/m-decision", {"machine": "TEST-A", "drive": "M:", "state": "approved", "note": "ok"})
        self.assertEqual((code, body["ok"]), (200, True))
        kw = dec.call_args.kwargs
        self.assertEqual((kw["machine"], kw["drive"], kw["state"], kw["note"], kw["by"]), ("TEST-A", "M:", "approved", "ok", ADMIN["email"]))
        entry = self.audit.call_args.args[0]
        self.assertEqual((entry["action"], entry["user"]), ("fleet.m_decision", ADMIN["email"]))

    def test_udzial_i_rejestracja_maja_wlasne_akcje_audytu(self):
        with mock.patch.object(fh, "m_share", return_value={"ok": True, "shares": ["//a/b"]}):
            self.req("POST", "/fleet/m-share", {"action": "add", "share": "//a/b"})
        with mock.patch.object(fh, "m_register", return_value={"ok": True, "row": {}, "shares": ["//a/b"]}):
            self.req("POST", "/fleet/m-register", {"machine": "test-a", "drive": "M:"})
        self.assertEqual([c.args[0]["action"] for c in self.audit.call_args_list], ["fleet.m_share", "fleet.m_register"])

    def test_odmowa_modulu_nie_trafia_do_audytu(self):
        with mock.patch.object(fh, "m_decision", return_value={"ok": False, "error": "not_found"}):
            code, body = self.req("POST", "/fleet/m-decision", {"machine": "nie-ma", "drive": "M:", "state": "approved"})
        self.assertEqual((code, body["error"]), (200, "not_found"))
        self.audit.assert_not_called()

    def test_zadna_trasa_floty_nie_jest_publiczna(self):
        self.assertEqual([p for p in local_bridge.PUBLIC_ANON_PATHS if p.startswith("/fleet")], [])


class HealthAndStatusTests(_Server):
    def test_health_bierze_znacznik_z_pamieci_bez_io(self):
        with mock.patch.object(index_snapshots, "cached_catalog_id", return_value={"catalog_id": "3fa1c9e", "catalog_source": "db"}), \
                mock.patch.object(index_snapshots, "catalog_info", side_effect=AssertionError("/health nie moze liczyc katalogu")):
            code, body = self.req("GET", "/health")
        self.assertEqual(code, 200)
        self.assertEqual((body["catalog_id"], body["catalog_source"]), ("3fa1c9e", "db"))

    def test_health_dziala_gdy_znacznik_rzuca_wyjatek(self):
        with mock.patch.object(index_snapshots, "cached_catalog_id", side_effect=RuntimeError("padl")):
            code, body = self.req("GET", "/health")
        self.assertEqual((code, body["ok"]), (200, True))
        self.assertNotIn("catalog_id", body)  # brak pola = stary most dla ekranow, nie blad

    def test_index_status_niesie_katalog_a_wyjatek_daje_pusty_slownik(self):
        info = {"kind": "snapshot", "id": "3fa1c9e", "complete": True}
        with mock.patch.object(index_snapshots, "catalog_info", return_value=info):
            self.assertEqual(local_bridge._catalog_payload(), info)
        with mock.patch.object(index_snapshots, "catalog_info", side_effect=RuntimeError("padl")):
            self.assertEqual(local_bridge._catalog_payload(), {})
        with mock.patch.object(local_bridge, "_catalog_payload", return_value=info):
            self.assertEqual(local_bridge.index_status()["catalog"], info)

    def test_index_snapshots_status_niesie_katalog(self):
        code, body = self.req("GET", "/index/snapshots")
        self.assertEqual(code, 200)
        self.assertIn("catalog", body)


class RootSwitchKickTests(unittest.TestCase):
    """Zmiana ROOT (kazda z trzech drog zapisu przechodzi przez _apply_root_switch_effects) = tetno od razu."""

    def test_kick_tylko_gdy_sciezka_sie_zmienila(self):
        with mock.patch.object(local_bridge, "_restart_index_watcher_for_root", return_value="restarted"), \
                mock.patch.object(local_bridge, "_reset_scan_memory", return_value={}), \
                mock.patch.object(fh, "kick") as kick:
            res = local_bridge._apply_root_switch_effects("M:\\", "D:\\Marketing", root_state="full")
            self.assertTrue(res["changed"])
            self.assertEqual(kick.call_count, 1)
            res = local_bridge._apply_root_switch_effects("D:\\Marketing", "d:\\marketing", root_state="full")
            self.assertFalse(res["changed"])
            self.assertEqual(kick.call_count, 1)

    def test_blad_kick_nie_psuje_przelaczenia(self):
        with mock.patch.object(local_bridge, "_restart_index_watcher_for_root", return_value="restarted"), \
                mock.patch.object(local_bridge, "_reset_scan_memory", return_value={}), \
                mock.patch.object(fh, "kick", side_effect=RuntimeError("padl")):
            self.assertTrue(local_bridge._apply_root_switch_effects("M:\\", "D:\\Marketing")["changed"])

    def test_fleet_info_nie_laczy_sie_z_baza_i_nie_rzuca(self):
        with mock.patch.object(local_bridge, "read_machine_config", return_value={"base_path": ""}):
            info = local_bridge._fleet_info()
        self.assertEqual((info["base_path"], info["root_state"]), ("", "none"))
        self.assertIn("windows_user", info)
        self.assertIsInstance(info["asset_status"], dict)


class AssetStatusFieldsTests(unittest.TestCase):
    """Pola raportu cyklu, ktore tetno zapisuje w bazie, docieraja do asset_sync_status() (kopiowane tylko gdy sa)."""

    def run_cycle(self, report):
        import asset_sync_runner  # noqa: PLC0415

        saved = dict(local_bridge._asset_sync_state)
        self.addCleanup(lambda: (local_bridge._asset_sync_state.clear(), local_bridge._asset_sync_state.update(saved)))
        with mock.patch.object(asset_sync_runner, "run_once", return_value=report),                 mock.patch.object(local_bridge, "dam_db", mock.Mock(DB_CANONICAL="x.sqlite")),                 mock.patch.object(local_bridge, "_snapshot_root_alive", return_value=False),                 mock.patch.object(local_bridge, "_asset_sync_root_path", return_value=""):
            local_bridge.run_asset_sync_once()
        return local_bridge.asset_sync_status()

    def test_pola_etapu_1a_trafiaja_do_statusu(self):
        st = self.run_cycle({"ok": True, "mode": "rows", "assets_max_rev": 77, "missing_marked": 3, "holds": 1, "witness_tripped": False})
        self.assertEqual((st["assets_max_rev"], st["missing_marked"], st["holds"], st["witness_tripped"]), (77, 3, 1, False))

    def test_raport_bez_tych_pol_nie_dopisuje_niczego(self):
        local_bridge._asset_sync_state.pop("assets_max_rev", None)
        st = self.run_cycle({"ok": True, "mode": "rows"})
        self.assertNotIn("assets_max_rev", st)
        self.assertNotIn("holds", st)


class RealPgRouteTests(unittest.TestCase):
    """Trasy admina na prawdziwym PostgreSQL: pg_db.connect() wskazuje schemat testowy."""

    def setUp(self):
        import psycopg2  # noqa: PLC0415
        import psycopg2.extras  # noqa: PLC0415
        import realpg  # noqa: PLC0415

        admin_dsn = realpg.require(self)
        cm = realpg.fresh_db(admin_dsn)
        self.dsn = cm.__enter__()
        self.addCleanup(cm.__exit__, None, None, None)
        self._pg2 = psycopg2
        self.pg = psycopg2.connect(self.dsn, cursor_factory=psycopg2.extras.RealDictCursor, connect_timeout=10)
        self.addCleanup(self.pg.close)
        cur = self.pg.cursor()
        cur.execute((DESKTOP / "sql" / "fleet.sql").read_text(encoding="utf-8"))
        self.pg.commit()

        def connect():
            return psycopg2.connect(self.dsn, cursor_factory=psycopg2.extras.RealDictCursor, connect_timeout=10)

        self.srv = _Server("setUp")
        self.srv.user = ADMIN
        self.srv.setUp()
        self.addCleanup(self.srv._stop)
        p = mock.patch.object(pg_db, "connect", connect)
        p.start()
        self.addCleanup(p.stop)

    def q(self, sql, args=None):
        cur = self.pg.cursor()
        cur.execute(sql, args)
        rows = cur.fetchall() if cur.description else []
        self.pg.commit()
        return rows

    def test_rejestracja_decyzja_i_odczyt_floty_przez_most(self):
        srv = self.srv
        self.q("INSERT INTO dam_client_heartbeat (machine, machine_name, app_version, root_drive, root_share, root_kind) "
               "VALUES ('test-a', 'TEST-A', '2.6.1', 'M:', '//192.0.2.10/marketing', 'remote')")
        code, body = srv.req("POST", "/fleet/m-register", {"machine": "TEST-A", "drive": "M:"})
        self.assertEqual((code, body["ok"], body["shares"]), (200, True, ["//192.0.2.10/marketing"]))
        self.assertTrue(self.q("SELECT dam_is_m_computer('TEST-A') AS v")[0]["v"])
        self.assertEqual(srv.audit.call_args.args[0]["action"], "fleet.m_register")

        code, body = srv.req("POST", "/fleet/m-decision", {"machine": "test-a", "drive": "M:", "state": "revoked"})
        self.assertEqual((code, body["ok"], body["row"]["state"]), (200, True, "revoked"))
        self.assertFalse(self.q("SELECT dam_is_m_computer('test-a:m1') AS v")[0]["v"])

        code, body = srv.req("POST", "/fleet/m-share", {"action": "add", "share": "//Nazwa/Marketing"})
        self.assertEqual(body["shares"], ["//192.0.2.10/marketing", "//nazwa/marketing"])

        code, body = srv.req("GET", "/fleet/status")
        self.assertEqual((code, body["ok"]), (200, True))
        self.assertEqual([c["machine"] for c in body["computers"]], ["test-a"])
        self.assertEqual(body["computers"][0]["m_row"]["state"], "revoked")
        self.assertEqual(body["m_shares"], ["//192.0.2.10/marketing", "//nazwa/marketing"])
        self.assertEqual([c.args[0]["action"] for c in srv.audit.call_args_list], ["fleet.m_register", "fleet.m_decision", "fleet.m_share"])


if __name__ == "__main__":
    unittest.main()
