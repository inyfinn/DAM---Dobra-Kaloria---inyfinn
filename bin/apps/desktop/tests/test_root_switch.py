# -*- coding: utf-8 -*-
"""Faza 3.1 - przelaczenie ROOT jedna operacja (POST /root/switch).

1) sciezka OK -> machine-config + UDP zapisane, cache mostu wyczyszczone;
2) sciezka nie istnieje / nie jest folderem Marketing -> nic nie zapisane;
3) dysk wisi -> odpowiedz po limicie czasu, nic nie zapisane;
4) przelaczenie w trakcie przebudowy indeksu -> restart watchera czeka na koniec;
5) HTTP: walidacja bez sesji, zapis tylko z sesja; stare /machine-config nie resetuje bazy;
6) dam_path_resolve czyta ROOT z users[USERNAME] (format machine-config od 2026-07).

Run: python -m unittest tests.test_root_switch  (z bin/apps/desktop)
"""
from __future__ import annotations

import http.client
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parent.parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))
_SCRIPTS = DESKTOP.parent / "web" / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.append(str(_SCRIPTS))

import dam_path_resolve  # noqa: E402
import index_supervisor  # noqa: E402
import local_bridge as lb  # noqa: E402
import marketing_discovery  # noqa: E402

REQUIRED = ("-- ARCHIWUM --", "- EKSPORT", "- POLSKA")


def _make_root(parent: Path, name: str = "Marketing", folders=REQUIRED) -> Path:
    root = parent / name
    for f in folders:
        (root / f).mkdir(parents=True, exist_ok=True)
        (root / f / "produkt.txt").write_text("x", encoding="utf-8")
    return root


class RootSwitchBase(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.tmp = Path(self.td.name)
        self.cfg = self.tmp / "machine-config.json"
        self.old_root = _make_root(self.tmp, "Old")
        self.cfg.write_text(
            json.dumps({"users": {"tester": {"base_path": str(self.old_root)}}}), encoding="utf-8"
        )
        self.state_cfg = self.tmp / "state" / "machine-config.json"
        self.patches = [
            mock.patch.object(lb, "MACHINE_CONFIG", self.cfg),
            mock.patch.object(lb, "MACHINE_CONFIG_STATE", self.state_cfg),
            mock.patch.dict(os.environ, {"USERNAME": "tester"}),
            mock.patch.object(lb, "_udp_current_identity",
                              return_value={"device_id": "dev-1", "hostname": "pc-1"}),
            mock.patch.object(lb, "upsert_user_device_path",
                              return_value={"ok": True, "entry": {}}),
            mock.patch.object(lb, "ROOT_SWITCH_PROBE_TIMEOUT_S", 0.5),
            # Prawdziwe reset_scan_memory czysci last_seen w bin/DATABASE - w testach
            # zawsze temp: DB_CANONICAL wskazuje na plik w katalogu tymczasowym.
            mock.patch.object(lb.dam_db, "DB_CANONICAL", self.tmp / "never-real.sqlite"),
            # 07.10.2026: prawdziwe _index_rebuild_running czyta stan ZAINSTALOWANEGO programu.
            # Gdy na tym komputerze trwal akurat skan godzinny, watek restartu watchera z
            # wczesniejszego testu trzymal zamek do konca skanu i kolejne testy dostawaly
            # "pending". Testy, ktore badaja trwajaca przebudowe, podstawiaja wlasna wartosc.
            mock.patch.object(lb, "_index_rebuild_running", return_value=False),
        ]
        for p in self.patches:
            p.start()
        marketing_discovery.clear_cache()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.td.cleanup()

    def cfg_base(self) -> str:
        """Skuteczny ROOT: nowy plik (katalog stanu) wygrywa, stary to zapas."""
        return lb.read_machine_config()["base_path"]

    def legacy_base(self) -> str:
        return json.loads(self.cfg.read_text(encoding="utf-8"))["users"]["tester"]["base_path"]


class SwitchRootTests(RootSwitchBase):
    def test_path_ok_writes_config_udp_and_clears_caches(self):
        new_root = _make_root(self.tmp, "New")
        lb.dam_thumb_cache._DRIVE_ALIVE["Q:"] = (time.monotonic(), False)
        with mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting") as rw, \
                mock.patch("marketing_roots.clear_cache") as mr_clear:
            res = lb.switch_root(str(new_root), email="a@b.pl", label="Dom")
        self.assertTrue(res["ok"], res)
        self.assertTrue(res["root_alive"])
        self.assertEqual(res["reason"], "ok")
        self.assertTrue(res["changed"])
        self.assertIn("checked_at", res)
        self.assertEqual(self.cfg_base(), str(new_root))
        lb.upsert_user_device_path.assert_called_once_with(
            "a@b.pl", "dev-1", str(new_root), hostname="pc-1", label="Dom"
        )
        rw.assert_called_once()
        mr_clear.assert_called()
        self.assertEqual(lb.dam_thumb_cache._DRIVE_ALIVE, {})

    def test_same_root_does_not_restart_watcher(self):
        with mock.patch.object(lb, "_restart_index_watcher_for_root") as rw:
            res = lb.switch_root(str(self.old_root), email="a@b.pl")
        self.assertTrue(res["ok"])
        self.assertFalse(res["changed"])
        self.assertEqual(res["watcher"], "unchanged")
        rw.assert_not_called()

    def test_missing_path_is_not_saved(self):
        res = lb.switch_root(str(self.tmp / "Nope" / "Marketing"), email="a@b.pl")
        self.assertFalse(res["ok"])
        self.assertEqual(res["error"], "root_missing")
        self.assertFalse(res["root_alive"])
        self.assertEqual(self.cfg_base(), str(self.old_root))
        lb.upsert_user_device_path.assert_not_called()

    def test_partial_structure_is_saved_with_warning(self):
        half = _make_root(self.tmp, "Half", folders=("- POLSKA",))
        with mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting"):
            res = lb.switch_root(str(half), email="a@b.pl")
        self.assertTrue(res["ok"], res)
        self.assertTrue(res["root_alive"])
        self.assertEqual(res["warning"], "root_incomplete")
        self.assertEqual(sorted(res["missing"]), sorted(["-- ARCHIWUM --", "- EKSPORT"]))
        self.assertEqual(self.cfg_base(), str(half))

    def test_unrecognized_folder_needs_confirm(self):
        other = self.tmp / "Windows"
        other.mkdir()
        res = lb.switch_root(str(other), email="a@b.pl")
        self.assertFalse(res["ok"])
        self.assertEqual(res["error"], "root_unrecognized")
        self.assertTrue(res["needs_confirm"])
        self.assertEqual(len(res["missing"]), 3)
        self.assertEqual(self.cfg_base(), str(self.old_root))
        with mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting"):
            res2 = lb.switch_root(str(other), email="a@b.pl", confirm=True)
        self.assertTrue(res2["ok"], res2)
        self.assertEqual(res2["warning"], "root_unrecognized")
        self.assertEqual(self.cfg_base(), str(other))

    def test_hanging_drive_answers_within_timeout(self):
        hang = str(self.tmp / "Hang")
        release = threading.Event()
        real_isdir = marketing_discovery._isdir

        def slow_isdir(p):
            if str(p).startswith(hang):
                release.wait(30)
                return True
            return real_isdir(p)

        try:
            with mock.patch.object(marketing_discovery, "_isdir", side_effect=slow_isdir):
                t0 = time.monotonic()
                res = lb.switch_root(hang, email="a@b.pl")
                elapsed = time.monotonic() - t0
        finally:
            release.set()
        self.assertLess(elapsed, 2.0)
        self.assertFalse(res["ok"])
        self.assertEqual(res["error"], "root_timeout")
        self.assertEqual(self.cfg_base(), str(self.old_root))

    def test_validate_only_does_not_write(self):
        new_root = _make_root(self.tmp, "New")
        res = lb.switch_root(str(new_root), write=False)
        self.assertTrue(res["ok"])
        self.assertTrue(res["validated_only"])
        self.assertEqual(self.cfg_base(), str(self.old_root))


class SwitchDuringRebuildTests(RootSwitchBase):
    def test_watcher_restart_waits_for_running_rebuild(self):
        calls = []
        running = {"v": True}
        with mock.patch.object(lb, "ROOT_WATCHER_POLL_S", 0.05), \
                mock.patch.object(lb, "_index_rebuild_running", side_effect=lambda: running["v"]), \
                mock.patch.object(index_supervisor, "_owner", object()), \
                mock.patch.object(index_supervisor, "stop_index_supervisor",
                                  side_effect=lambda: calls.append("stop")), \
                mock.patch.object(index_supervisor, "ensure_index_supervisor",
                                  side_effect=lambda **_k: calls.append("ensure")):
            new_root = _make_root(self.tmp, "New")
            res = lb.switch_root(str(new_root), email="a@b.pl")
            self.assertTrue(res["ok"])
            self.assertEqual(res["watcher"], "deferred")
            self.assertTrue(res["rebuild_running"])
            # machine-config juz nowy - trwajaca przebudowa nie blokuje przelaczenia
            self.assertEqual(self.cfg_base(), str(new_root))
            time.sleep(0.3)
            self.assertEqual(calls, [], "restart w trakcie przebudowy")
            running["v"] = False
            deadline = time.monotonic() + 3.0
            while len(calls) < 2 and time.monotonic() < deadline:
                time.sleep(0.05)
        self.assertEqual(calls, ["stop", "ensure"])

    def test_no_restart_when_watcher_not_owned(self):
        calls = []
        with mock.patch.object(lb, "_index_rebuild_running", return_value=False), \
                mock.patch.object(index_supervisor, "_owner", None), \
                mock.patch.object(index_supervisor, "stop_index_supervisor",
                                  side_effect=lambda: calls.append("stop")):
            self.assertEqual(lb._restart_index_watcher_for_root(), "restarting")
            time.sleep(0.2)
        self.assertEqual(calls, [])


class RootSwitchHttpTests(RootSwitchBase):
    def setUp(self):
        super().setUp()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), lb.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        super().tearDown()

    def _post(self, path, body):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request("POST", path, body=json.dumps(body),
                     headers={"Content-Type": "application/json", "Origin": "http://127.0.0.1:8765"})
        r = conn.getresponse()
        data = json.loads(r.read().decode("utf-8") or "{}")
        conn.close()
        return r.status, data

    def test_missing_path_answers_without_session(self):
        with mock.patch.object(lb.Handler, "_session_user", return_value=None):
            status, data = self._post("/root/switch", {"base_path": str(self.tmp / "Q")})
        self.assertEqual(status, 200)
        self.assertEqual(data["error"], "root_missing")
        self.assertEqual(self.cfg_base(), str(self.old_root))

    def test_valid_path_requires_session(self):
        new_root = _make_root(self.tmp, "New")
        with mock.patch.object(lb.Handler, "_session_user", return_value=None):
            status, data = self._post("/root/switch", {"base_path": str(new_root)})
        self.assertEqual(status, 401)
        self.assertEqual(self.cfg_base(), str(self.old_root))

    def test_valid_path_with_session_switches(self):
        new_root = _make_root(self.tmp, "New")
        user = {"email": "a@b.pl", "role": "user"}
        with mock.patch.object(lb.Handler, "_session_user", return_value=user), \
                mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting"):
            status, data = self._post("/root/switch", {"base_path": str(new_root), "device_id": "dev-9"})
        self.assertEqual(status, 200, data)
        self.assertTrue(data["ok"])
        self.assertEqual(data["base_path"], str(new_root))
        self.assertEqual(data["device_id"], "dev-9")
        self.assertEqual(self.cfg_base(), str(new_root))

    def test_unrecognized_over_http_confirm_flow(self):
        other = self.tmp / "Windows"
        other.mkdir()
        user = {"email": "a@b.pl", "role": "user"}
        with mock.patch.object(lb.Handler, "_session_user", return_value=user), \
                mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting"):
            s1, d1 = self._post("/root/switch", {"base_path": str(other)})
            self.assertEqual(self.cfg_base(), str(self.old_root))
            s2, d2 = self._post("/root/switch", {"base_path": str(other), "confirm": True})
        self.assertEqual((s1, d1["error"], d1["needs_confirm"]), (200, "root_unrecognized", True))
        self.assertTrue(d2["ok"], d2)
        self.assertEqual(self.cfg_base(), str(other))

    def test_partial_root_counts_as_online(self):
        half = _make_root(self.tmp, "Half", folders=("- EKSPORT",))
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request("GET", "/files/status?root=" + str(half).replace("\\", "/"))
        data = json.loads(conn.getresponse().read().decode("utf-8"))
        conn.close()
        self.assertTrue(data["online"], data)
        self.assertIn("- POLSKA", data["missing"])

    def test_legacy_machine_config_still_works_and_keeps_db(self):
        new_root = _make_root(self.tmp, "New")
        user = {"email": "a@b.pl", "role": "user"}
        with mock.patch.object(lb.Handler, "_session_user", return_value=user), \
                mock.patch.object(lb.dam_db, "reset_path_cache") as reset, \
                mock.patch.object(lb.dam_db, "init_db") as init:
            status, data = self._post("/machine-config", {"base_path": str(new_root)})
        self.assertEqual(status, 200, data)
        self.assertEqual(self.cfg_base(), str(new_root))
        reset.assert_not_called()
        init.assert_not_called()

    def test_files_status_reports_timeout_field(self):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request("GET", "/files/status?root=" + str(self.tmp / "Q").replace("\\", "/"))
        r = conn.getresponse()
        data = json.loads(r.read().decode("utf-8"))
        conn.close()
        self.assertFalse(data["online"])
        self.assertFalse(data["exists"])
        self.assertFalse(data["timeout"])


class RootStateTests(RootSwitchBase):
    """Poprawka 4: jedna definicja zywotnosci ROOT (full / partial / none)."""

    def test_three_states(self):
        full = _make_root(self.tmp, "Full")
        half = _make_root(self.tmp, "Half", folders=("- POLSKA",))
        empty_polska = self.tmp / "EmptyPolska"
        for f in REQUIRED:
            (empty_polska / f).mkdir(parents=True)
        self.assertEqual(lb._root_state(str(full))["state"], "full")
        st = lb._root_state(str(half))
        self.assertEqual((st["state"], sorted(st["missing"])), ("partial", sorted(["-- ARCHIWUM --", "- EKSPORT"])))
        self.assertEqual(lb._root_state(str(empty_polska))["state"], "partial")
        self.assertEqual(lb._root_state(str(self.tmp / "Nope"))["state"], "none")
        self.assertEqual(lb._root_state("")["state"], "none")

    def test_hanging_polska_listing_is_bounded(self):
        full = _make_root(self.tmp, "Full")
        release = threading.Event()
        real_iterdir = Path.iterdir

        def slow_iterdir(p):
            if str(p).startswith(str(full)):
                release.wait(30)
            return real_iterdir(p)

        try:
            with mock.patch.object(Path, "iterdir", slow_iterdir):
                t0 = time.monotonic()
                st = lb._root_state(str(full))
                elapsed = time.monotonic() - t0
        finally:
            release.set()
        self.assertLess(elapsed, 2.0)
        self.assertEqual(st["state"], "none")
        self.assertTrue(st["timeout"])

    def test_publication_and_scan_only_from_full(self):
        half = _make_root(self.tmp, "Half", folders=("- POLSKA",))
        self.assertTrue(lb._snapshot_root_alive())  # Old = full
        self.assertEqual(lb._scan_blocked_reason(), "")
        with mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="stopped") as rw:
            res = lb.switch_root(str(half), email="a@b.pl")
        self.assertEqual(res["root_state"], "partial")
        self.assertFalse(res["scan_allowed"])
        rw.assert_called_once_with(scan_allowed=False)
        self.assertFalse(lb._snapshot_root_alive())
        self.assertEqual(lb._scan_blocked_reason(), "root_partial")
        with mock.patch.object(lb, "_run_index_rebuild") as ri,                 mock.patch.object(lb, "_run_branding_rebuild") as rb:
            r1 = lb.start_index_rebuild()
            r2 = lb.start_branding_rebuild()
            time.sleep(0.1)
        ri.assert_not_called()
        rb.assert_not_called()
        self.assertEqual((r1["error"], r2["error"]), ("root_partial", "root_partial"))

    def test_partial_switch_stops_watcher_without_restart(self):
        calls = []
        with mock.patch.object(lb, "_index_rebuild_running", return_value=False), \
                mock.patch.object(index_supervisor, "_owner", object()), \
                mock.patch.object(index_supervisor, "stop_index_supervisor",
                                  side_effect=lambda: calls.append("stop")), \
                mock.patch.object(index_supervisor, "ensure_index_supervisor",
                                  side_effect=lambda **_k: calls.append("ensure")):
            self.assertEqual(lb._restart_index_watcher_for_root(scan_allowed=False), "stopped")
            deadline = time.monotonic() + 2.0
            while not calls and time.monotonic() < deadline:
                time.sleep(0.02)
            time.sleep(0.1)
        self.assertEqual(calls, ["stop"])
        lb._ROOT_WATCHER_STOPPED_BY_SWITCH.clear()


class ScanMemoryAndBuiltHereTests(RootSwitchBase):
    """Poprawka 6: wywolania warunkowe funkcji workera D."""

    def test_reset_scan_memory_called_on_change(self):
        """Sygnatura workera D: (db_path, reason); db_path = dam_db.DB_CANONICAL."""
        import asset_sync_runner

        calls = []

        def fake(db_path, reason):
            calls.append((db_path, reason))
            return {"ok": True, "reason": reason}

        new_root = _make_root(self.tmp, "New")
        fake_db = self.tmp / "dam-local.sqlite"
        with mock.patch.object(asset_sync_runner, "reset_scan_memory", fake, create=True),                 mock.patch.object(lb.dam_db, "DB_CANONICAL", fake_db),                 mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting"):
            res = lb.switch_root(str(new_root), email="a@b.pl")
            same = lb.switch_root(str(new_root), email="a@b.pl")
        self.assertEqual(calls, [(fake_db, "root_switch")])
        self.assertEqual(res["scan_memory"], {"ok": True, "reason": "root_switch"})
        self.assertIsNone(same["scan_memory"])  # bez zmiany ROOT - bez resetu

    def test_reset_scan_memory_single_arg_variant(self):
        import asset_sync_runner

        new_root = _make_root(self.tmp, "New")
        with mock.patch.object(asset_sync_runner, "reset_scan_memory",
                               lambda reason: {"ok": True, "r": reason}, create=True),                 mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting"):
            res = lb.switch_root(str(new_root), email="a@b.pl")
        self.assertEqual(res["scan_memory"], {"ok": True, "r": "root_switch"})

    def test_reset_scan_memory_missing_or_failing(self):
        import asset_sync_runner

        def boom(db_path, reason):
            raise RuntimeError("boom")

        new_root = _make_root(self.tmp, "New")
        with mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting"):
            with mock.patch.object(asset_sync_runner, "reset_scan_memory", None, create=True):
                res = lb.switch_root(str(new_root), email="a@b.pl")
            self.assertTrue(res["ok"])
            self.assertIsNone(res["scan_memory"])
            other = _make_root(self.tmp, "Other")
            with mock.patch.object(asset_sync_runner, "reset_scan_memory", boom, create=True):
                res2 = lb.switch_root(str(other), email="a@b.pl")
        self.assertTrue(res2["ok"])
        self.assertEqual(res2["scan_memory"]["ok"], False)

    def test_mark_built_here_conditional(self):
        import index_snapshots

        with mock.patch.object(index_snapshots, "mark_built_here", create=True) as fn:
            self.assertEqual(lb._mark_built_here("file-index", Path("x.json")), "ok")
        fn.assert_called_once_with("file-index", Path("x.json"))
        with mock.patch.object(index_snapshots, "mark_built_here", None, create=True):
            self.assertEqual(lb._mark_built_here("file-index", Path("x.json")), "missing")


class MachineConfigLocationTests(RootSwitchBase):
    """Poprawka 8 + 7: zapis w katalogu stanu, stary plik jako zapas, jedna regula usera."""

    def test_legacy_file_read_when_state_missing(self):
        self.assertFalse(self.state_cfg.exists())
        self.assertEqual(lb.read_machine_config()["base_path"], str(self.old_root))

    def test_write_goes_to_state_and_wins_legacy_untouched(self):
        new_root = _make_root(self.tmp, "New")
        before = self.cfg.read_bytes()
        lb.write_machine_config(str(new_root))
        self.assertTrue(self.state_cfg.is_file())
        self.assertEqual(lb.read_machine_config()["base_path"], str(new_root))
        self.assertEqual(lb.read_machine_config()["path"], str(self.state_cfg))
        self.assertEqual(self.cfg.read_bytes(), before)

    def test_user_name_case_insensitive_and_no_foreign_root(self):
        self.cfg.write_text(json.dumps({"users": {"TESTER": {"base_path": "E:/Mine"},
                                                  "other": {"base_path": "Z:/Foreign"}}}), encoding="utf-8")
        self.assertEqual(lb.read_machine_config()["base_path"], "E:/Mine")
        self.cfg.write_text(json.dumps({"users": {"other": {"base_path": "Z:/Foreign"}}}), encoding="utf-8")
        self.assertEqual(lb.read_machine_config()["base_path"], "")
        with mock.patch.object(dam_path_resolve, "state_machine_config_path", return_value=None):
            self.assertEqual(dam_path_resolve.machine_config_base(self.cfg), "")

    def test_dam_db_never_takes_other_users_root(self):
        import dam_db

        foreign = _make_root(self.tmp, "Foreign")
        mine = _make_root(self.tmp, "Mine")
        with mock.patch.object(dam_db, "MACHINE_CONFIG", self.cfg), \
                mock.patch.object(dam_path_resolve, "state_machine_config_path", return_value=None):
            self.cfg.write_text(json.dumps({"users": {"other": {"base_path": str(foreign)}}}), encoding="utf-8")
            self.assertIsNone(dam_db._marketing_base_from_config())
            self.cfg.write_text(json.dumps({"users": {"other": {"base_path": str(foreign)},
                                                      "Tester": {"base_path": str(mine)}}}), encoding="utf-8")
            self.assertEqual(dam_db._marketing_base_from_config(), mine)


class IndexAuthorityRouteTests(RootSwitchBase):
    def setUp(self):
        super().setUp()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), lb.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        super().tearDown()

    def _get(self, path):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request("GET", path)
        r = conn.getresponse()
        body = json.loads(r.read().decode("utf-8") or "{}")
        conn.close()
        return r.status, body

    def test_status_when_module_present(self):
        import index_authority

        with mock.patch.object(index_authority, "status",
                               return_value={"ok": True, "may_publish": None}) as st:
            status, body = self._get("/index-authority/status")
        self.assertEqual((status, body["may_publish"]), (200, None))
        st.assert_called_once_with(root_path=str(self.old_root))

    def test_404_when_module_missing(self):
        with mock.patch.dict(sys.modules, {"index_authority": None}):
            status, _ = self._get("/index-authority/status")
        self.assertEqual(status, 404)


class LaunchKillsOnlyOwnProcessesTests(unittest.TestCase):
    """Poprawka 9: _kill_stale_dam_processes filtruje po wlascicielu procesu."""

    def test_powershell_filter_has_owner_check(self):
        import launch

        seen = []

        def fake_run(cmd, **_kw):
            seen.append(cmd[-1])
            return mock.Mock(stdout="", returncode=0)

        with mock.patch.object(launch.sys, "platform", "win32"), \
                mock.patch.object(launch.subprocess, "run", side_effect=fake_run), \
                mock.patch.object(launch, "_kill_listeners_on_dam_ports", return_value=0):
            self.assertEqual(launch._kill_stale_dam_processes(), 0)
        self.assertTrue(seen)
        self.assertIn("GetOwner", seen[0])
        self.assertIn("$env:USERNAME", seen[0])


class PathResolveReadsUserRootTests(unittest.TestCase):
    def test_users_format_root_comes_first(self):
        with tempfile.TemporaryDirectory() as td:
            root = _make_root(Path(td), "Mine")
            cfg = Path(td) / "machine-config.json"
            cfg.write_text(json.dumps({"users": {"tester": {"base_path": str(root)},
                                                  "other": {"base_path": "Z:/Other"}}}),
                           encoding="utf-8")
            with mock.patch.dict(os.environ, {"USERNAME": "tester"}):
                roots = dam_path_resolve.marketing_roots(
                    marketing_candidates=[Path("X:/Marketing")], machine_config_path=cfg
                )
                self.assertEqual(dam_path_resolve.machine_config_base(cfg), str(root))
        self.assertEqual(str(roots[0]).lower(), str(root.resolve()).lower())
        self.assertNotIn("z:\\other", [str(r).lower() for r in roots])

    def test_legacy_top_level_base_path_still_read(self):
        with tempfile.TemporaryDirectory() as td:
            cfg = Path(td) / "machine-config.json"
            cfg.write_text(json.dumps({"base_path": "E:/Marketing"}), encoding="utf-8")
            with mock.patch.dict(os.environ, {"USERNAME": "tester"}):
                self.assertEqual(dam_path_resolve.machine_config_base(cfg), "E:/Marketing")


if __name__ == "__main__":
    unittest.main()
