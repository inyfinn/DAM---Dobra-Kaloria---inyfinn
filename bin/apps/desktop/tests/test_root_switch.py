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
        self.patches = [
            mock.patch.object(lb, "MACHINE_CONFIG", self.cfg),
            mock.patch.dict(os.environ, {"USERNAME": "tester"}),
            mock.patch.object(lb, "_udp_current_identity",
                              return_value={"device_id": "dev-1", "hostname": "pc-1"}),
            mock.patch.object(lb, "upsert_user_device_path",
                              return_value={"ok": True, "entry": {}}),
            mock.patch.object(lb, "ROOT_SWITCH_PROBE_TIMEOUT_S", 0.5),
        ]
        for p in self.patches:
            p.start()
        marketing_discovery.clear_cache()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.td.cleanup()

    def cfg_base(self) -> str:
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

    def test_folder_without_marketing_tree_is_not_saved(self):
        half = _make_root(self.tmp, "Half", folders=("- POLSKA",))
        res = lb.switch_root(str(half), email="a@b.pl")
        self.assertFalse(res["ok"])
        self.assertEqual(res["error"], "root_incomplete")
        self.assertEqual(sorted(res["missing"]), sorted(["-- ARCHIWUM --", "- EKSPORT"]))
        self.assertEqual(self.cfg_base(), str(self.old_root))

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
