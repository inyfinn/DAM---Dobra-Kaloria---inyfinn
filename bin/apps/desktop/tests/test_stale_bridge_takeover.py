# -*- coding: utf-8 -*-
"""29.09.2026 (Mac, 2.4.7 -> 2.4.9): nowa aplikacja uzywala mostu STAREJ wersji.

Objaw: po podmianie DAM.app 2.4.7 na 2.4.9 logowanie nadal mowilo "Nieprawidlowy
email lub haslo". Stary most (bez konfiguracji bazy, logowanie do seed SQLite) zyl
w tle po zamknieciu starego okna, a BridgeSupervisor.ensure_running() widzial
"cos odpowiada na /health" i to uzywal - bez sprawdzenia wersji.

Kontrakt pilnowany tutaj:
- most / serwer UI innej wersji albo innego katalogu instalacji = "stale" -> przejecie,
- ta sama wersja i ten sam katalog = ponowne uzycie (bez zabijania),
- zabijanie tylko procesow DAM (linia polecen), nigdy siebie ani obcych,
- nie da sie zatrzymac -> jawny blad "stale_bridge_running" z komunikatem dla uzytkownika,
- most: /health zwraca app_version/pid/root, /__dam_shutdown tylko z loopback + token.

Zadnych prawdziwych portow 8765/8766 i zadnego zabijania czegokolwiek poza wlasnym
procesem-atrapa uruchomionym w tym tescie.
"""
from __future__ import annotations

import http.client
import http.server
import importlib.util
import json
import os
import socket
import subprocess
import sys
import tempfile
import textwrap
import threading
import time
import types
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import bridge_supervisor as bs  # noqa: E402
import runtime_config  # noqa: E402

REAL_PORTS = (8765, 8766)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        port = int(s.getsockname()[1])
    assert port not in REAL_PORTS
    return port


class _FakeServer:
    """Mini serwer HTTP w procesie testu: udaje most albo serwer UI."""

    def __init__(self, routes: dict[str, tuple[int, dict | None]] | None = None):
        self.routes = routes_ref = dict(routes or {})

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *_a):
                pass

            def _answer(self):
                path = self.path.split("?", 1)[0]
                code, payload = routes_ref.get(path, (404, {"ok": False, "error": "not_found"}))
                body = json.dumps(payload).encode("utf-8") if payload is not None else b"<html>x</html>"
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):  # noqa: N802
                self._answer()

            def do_POST(self):  # noqa: N802
                length = int(self.headers.get("Content-Length") or 0)
                if length:
                    self.rfile.read(length)
                self._answer()

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.port = int(self.httpd.server_address[1])
        assert self.port not in REAL_PORTS
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def close(self):
        try:
            self.httpd.shutdown()
        finally:
            self.httpd.server_close()


def _old_bridge_health(port: int) -> dict:
    # Most 2.4.7: brak app_version / pid / root.
    return {"ok": True, "service": "dam-local-bridge", "port": port, "api_version": 10}


def _current_bridge_health(port: int, **over) -> dict:
    ident = bs.local_identity()
    data = {
        "ok": True,
        "service": "dam-local-bridge",
        "port": port,
        "api_version": 11,
        "app_version": ident["app_version"],
        "pid": 424242,
        "root": ident["root"],
    }
    data.update(over)
    return data


class _LogToTemp(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.log_path = Path(self._td.name) / "bridge-stderr.log"
        p1 = mock.patch.object(bs, "TAKEOVER_LOG", self.log_path)
        p2 = mock.patch.object(bs, "control_token_path", lambda: Path(self._td.name) / "ctl.token")
        p1.start()
        p2.start()
        self.addCleanup(p1.stop)
        self.addCleanup(p2.stop)
        self.addCleanup(self._td.cleanup)

    def log_text(self) -> str:
        try:
            return self.log_path.read_text(encoding="utf-8")
        except OSError:
            return ""


class ClassifyTests(unittest.TestCase):
    def test_old_bridge_without_app_version_is_stale(self):
        verdict, reason = bs.classify_bridge_health(_old_bridge_health(1))
        self.assertEqual(verdict, "stale")
        self.assertIn("app_version", reason)

    def test_same_version_same_root_is_current(self):
        verdict, _ = bs.classify_bridge_health(_current_bridge_health(1))
        self.assertEqual(verdict, "current")

    def test_other_version_is_stale(self):
        verdict, reason = bs.classify_bridge_health(_current_bridge_health(1, app_version="2.4.7"))
        self.assertEqual(verdict, "stale")
        self.assertIn("2.4.7", reason)

    def test_other_install_root_is_stale(self):
        verdict, reason = bs.classify_bridge_health(
            _current_bridge_health(1, root="/Volumes/DAM 2.4.7/DAM.app/damroot/bin")
        )
        self.assertEqual(verdict, "stale")
        self.assertIn("root", reason)

    def test_foreign_service_is_not_killed(self):
        verdict, _ = bs.classify_bridge_health({"ok": True, "service": "cos-innego"})
        self.assertEqual(verdict, "foreign")

    def test_own_child_is_always_current(self):
        h = _current_bridge_health(1, root="/inny/katalog", pid=777)
        verdict, _ = bs.classify_bridge_health(h, own_pids=(777,))
        self.assertEqual(verdict, "current")

    def test_nothing_answering_is_down(self):
        self.assertEqual(bs.classify_bridge_health(None)[0], "down")


class SupervisorDecisionTests(_LogToTemp):
    def test_old_bridge_triggers_takeover_and_own_start(self):
        """Stary most (bez app_version) -> przejecie -> wlasny most tej wersji."""
        old = _FakeServer()
        port = old.port
        old.routes["/health"] = (200, _old_bridge_health(port))
        state = {"new": None}

        def fake_stop(p, *, kind, health, log=None, **_kw):
            self.assertEqual(p, port)
            self.assertEqual(kind, "bridge")
            old.close()  # "zatrzymany"
            return {"ok": True, "method": "pid", "pids": [111]}

        def fake_start(sup_self):
            # "nasz" most: ta sama wersja i katalog, na zwolnionym porcie
            new = http.server.ThreadingHTTPServer
            routes = {"/health": (200, _current_bridge_health(port))}

            class H(http.server.BaseHTTPRequestHandler):
                def log_message(self, *_a):
                    pass

                def do_GET(self):  # noqa: N802
                    body = json.dumps(routes["/health"][1]).encode()
                    self.send_response(200)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)

            srv = new(("127.0.0.1", port), H)
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            state["new"] = srv
            return None

        sup = bs.BridgeSupervisor(_free_port(), port)
        try:
            with mock.patch.object(bs, "stop_stale_service", side_effect=fake_stop) as stop, \
                    mock.patch.object(bs.BridgeSupervisor, "start", fake_start):
                res = sup.ensure_running(wait_s=5)
            stop.assert_called_once()
            self.assertTrue(res.get("ok"), res)
            self.assertTrue(res.get("started"), res)
            self.assertEqual((res.get("health") or {}).get("app_version"), runtime_config.APP_VERSION)
            self.assertIn("stale", self.log_text())
        finally:
            if state["new"] is not None:
                state["new"].shutdown()
                state["new"].server_close()

    def test_same_version_bridge_is_reused(self):
        srv = _FakeServer()
        srv.routes["/health"] = (200, _current_bridge_health(srv.port))
        try:
            sup = bs.BridgeSupervisor(_free_port(), srv.port)
            with mock.patch.object(bs, "stop_stale_service") as stop, \
                    mock.patch.object(bs.BridgeSupervisor, "start") as start:
                res = sup.ensure_running(wait_s=2)
            stop.assert_not_called()
            start.assert_not_called()
            self.assertTrue(res["ok"])
            self.assertFalse(res["started"])
        finally:
            srv.close()

    def test_takeover_failure_is_explicit_error_not_silent_reuse(self):
        srv = _FakeServer()
        srv.routes["/health"] = (200, _old_bridge_health(srv.port))
        try:
            sup = bs.BridgeSupervisor(_free_port(), srv.port)
            with mock.patch.object(bs, "stop_stale_service",
                                   return_value={"ok": False, "error": "kill_failed"}), \
                    mock.patch.object(bs.BridgeSupervisor, "start") as start:
                res = sup.ensure_running(wait_s=2)
            start.assert_not_called()
            self.assertFalse(res["ok"])
            self.assertEqual(res["error"], bs.STALE_BRIDGE_ERROR)
            self.assertIn("starsza wersja DAM", res["message"])
            self.assertIn("Monitorze aktywności", res["message"])
        finally:
            srv.close()


class StopStaleServiceTests(_LogToTemp):
    def _patch(self, **kw):
        patches = [mock.patch.object(bs, k, v) for k, v in kw.items()]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def test_kill_by_pid_for_old_bridge_mocked(self):
        term = mock.Mock(return_value=True)
        self._patch(
            listening_pids=mock.Mock(return_value=[12345]),
            process_command_line=mock.Mock(
                return_value=r'"C:\Users\x\AppData\Local\Programs\DAM\bin\runtime\win\python\pythonw.exe" '
                r'"C:\Users\x\AppData\Local\Programs\DAM\bin\apps\desktop\local_bridge.py"'
            ),
            terminate_pid=term,
            wait_port_free=mock.Mock(return_value=True),
            request_graceful_shutdown=mock.Mock(return_value=False),
        )
        res = bs.stop_stale_service(50001, kind="bridge", health=_old_bridge_health(50001))
        self.assertTrue(res["ok"], res)
        term.assert_called_once_with(12345)
        self.assertIn("12345", self.log_text())

    def test_mac_frozen_bridge_cmdline_is_dam(self):
        self.assertTrue(bs.is_dam_command_line("/Applications/DAM.app/Contents/MacOS/DAM --run bridge"))
        self.assertTrue(bs.is_dam_command_line(
            "/Library/Frameworks/Python.framework/python3 /Users/k/DAM/bin/apps/desktop/__main__.py"))
        self.assertFalse(bs.is_dam_command_line("/Applications/Safari.app/Contents/MacOS/Safari"))
        self.assertFalse(bs.is_dam_command_line(r"C:\Program Files\nginx\nginx.exe"))
        self.assertFalse(bs.is_dam_command_line(""))

    def test_non_dam_process_is_never_killed(self):
        term = mock.Mock(return_value=True)
        self._patch(
            listening_pids=mock.Mock(return_value=[4321]),
            process_command_line=mock.Mock(return_value=r"C:\Program Files\Google\Chrome\chrome.exe"),
            terminate_pid=term,
            wait_port_free=mock.Mock(return_value=False),
            request_graceful_shutdown=mock.Mock(return_value=False),
        )
        res = bs.stop_stale_service(50002, kind="bridge", health=_old_bridge_health(50002))
        term.assert_not_called()
        self.assertFalse(res["ok"])

    def test_own_process_is_never_killed(self):
        term = mock.Mock(return_value=True)
        self._patch(
            listening_pids=mock.Mock(return_value=[os.getpid()]),
            process_command_line=mock.Mock(return_value="python local_bridge.py"),
            terminate_pid=term,
            wait_port_free=mock.Mock(return_value=False),
            request_graceful_shutdown=mock.Mock(return_value=False),
        )
        res = bs.stop_stale_service(50003, kind="bridge", health=_old_bridge_health(50003))
        term.assert_not_called()
        self.assertFalse(res["ok"])

    def test_graceful_shutdown_with_token_skips_kill(self):
        bs.control_token_path().write_text("tok-123", encoding="utf-8")
        graceful = mock.Mock(return_value=True)
        term = mock.Mock(return_value=True)
        self._patch(
            request_graceful_shutdown=graceful,
            terminate_pid=term,
            wait_port_free=mock.Mock(return_value=True),
            listening_pids=mock.Mock(return_value=[999]),
            process_command_line=mock.Mock(return_value="python local_bridge.py"),
        )
        res = bs.stop_stale_service(
            50004, kind="bridge", health=_current_bridge_health(50004, app_version="2.4.8")
        )
        self.assertTrue(res["ok"])
        self.assertEqual(res["method"], "graceful")
        graceful.assert_called_once()
        self.assertEqual(graceful.call_args[0][1], "tok-123")
        term.assert_not_called()


class RealDummyChildKillTest(_LogToTemp):
    """Prawdziwa sciezka listening_pids -> linia polecen -> kill, ale WYLACZNIE na
    wlasnym procesie-atrapie (skrypt o nazwie local_bridge.py w katalogu tymczasowym,
    wolny port != 8765/8766). Straznik: terminate_pid na innym pid = blad testu."""

    def test_old_dummy_bridge_is_stopped_by_pid(self):
        port = _free_port()
        script_dir = Path(self._td.name) / "old" / "bin" / "apps" / "desktop"
        script_dir.mkdir(parents=True)
        script = script_dir / "local_bridge.py"
        script.write_text(textwrap.dedent(f"""
            import json, http.server
            class H(http.server.BaseHTTPRequestHandler):
                def log_message(self, *a): pass
                def do_GET(self):
                    body = json.dumps({{"ok": True, "service": "dam-local-bridge", "api_version": 10}}).encode()
                    self.send_response(200)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
            http.server.HTTPServer(("127.0.0.1", {port}), H).serve_forever()
        """), encoding="utf-8")
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
        child = subprocess.Popen([sys.executable, str(script)], creationflags=flags,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.addCleanup(lambda: child.poll() is None and child.kill())
        deadline = time.monotonic() + 15
        health = None
        while time.monotonic() < deadline and health is None:
            health = bs.bridge_health(port, timeout=1.0)
            if health is None:
                time.sleep(0.2)
        self.assertIsNotNone(health, "atrapa mostu nie wstala")
        self.assertEqual(bs.classify_bridge_health(health)[0], "stale")

        real_terminate = bs.terminate_pid

        def guarded_terminate(pid, *a, **kw):
            if int(pid) != child.pid:
                raise AssertionError(f"proba zabicia obcego procesu pid={pid} (atrapa={child.pid})")
            return real_terminate(pid, *a, **kw)

        with mock.patch.object(bs, "terminate_pid", side_effect=guarded_terminate):
            res = bs.stop_stale_service(port, kind="bridge", health=health)
        self.assertTrue(res["ok"], res)
        self.assertEqual(res["pids"], [child.pid])
        child.wait(timeout=10)
        self.assertIsNone(bs.bridge_health(port, timeout=1.0))


class UiIdentityTests(_LogToTemp):
    def test_ui_health_endpoint_reports_identity(self):
        import dam_ui_http

        Handler = dam_ui_http.make_handler_class({"app": "dam-eta"}, None)
        httpd = dam_ui_http.ThreadingReusableTCPServer(("127.0.0.1", 0), Handler)
        port = httpd.server_address[1]
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
            conn.request("GET", bs.UI_HEALTH_PATH)
            resp = conn.getresponse()
            data = json.loads(resp.read())
            conn.close()
            self.assertEqual(resp.status, 200)
            self.assertEqual(data["app_version"], runtime_config.APP_VERSION)
            self.assertEqual(data["pid"], os.getpid())
            self.assertEqual(data["service"], "dam-ui")
            self.assertTrue(data["root"])
            probe = bs.ui_health(port, timeout=2)
            self.assertEqual(bs.classify_ui_health(probe)[0], "current")
        finally:
            httpd.shutdown()
            httpd.server_close()

    def test_runtime_json_carries_app_version(self):
        import dam_ui_http

        with mock.patch.object(dam_ui_http, "write_runtime_file"), \
                mock.patch.object(dam_ui_http, "runtime_payload", return_value={"app": "dam-eta"}):
            rt = dam_ui_http.prepare_runtime(1, 2)
        self.assertEqual(rt["app_version"], runtime_config.APP_VERSION)

    def test_legacy_ui_server_is_stale(self):
        srv = _FakeServer({"/dam-runtime.json": (200, {"app": "dam-eta", "ui_port": 8765})})
        try:
            probe = bs.ui_health(srv.port, timeout=2)
            self.assertEqual(bs.classify_ui_health(probe)[0], "stale")
        finally:
            srv.close()

    def test_foreign_ui_server_is_foreign(self):
        srv = _FakeServer({"/": (200, None)})
        try:
            probe = bs.ui_health(srv.port, timeout=2)
            self.assertEqual(bs.classify_ui_health(probe)[0], "foreign")
        finally:
            srv.close()

    def test_ensure_services_propagates_stale_error(self):
        import dam_ui_http

        sup = mock.Mock()
        sup.ensure_running.return_value = {
            "ok": False, "error": bs.STALE_BRIDGE_ERROR, "message": bs.STALE_MESSAGE}
        Handler = dam_ui_http.make_handler_class({}, sup)
        httpd = dam_ui_http.ThreadingReusableTCPServer(("127.0.0.1", 0), Handler)
        port = httpd.server_address[1]
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
            conn.request("POST", "/dam/ensure-services")
            resp = conn.getresponse()
            data = json.loads(resp.read())
            conn.close()
            self.assertEqual(resp.status, 503)
            self.assertEqual(data["error"], bs.STALE_BRIDGE_ERROR)
            self.assertIn("starsza wersja DAM", data["message"])
        finally:
            httpd.shutdown()
            httpd.server_close()


class TakeoverOrderTests(_LogToTemp):
    def test_ui_first_then_bridge_and_failure_message(self):
        calls = []

        def fake_stop(port, *, kind, health, **_kw):
            calls.append(kind)
            return {"ok": kind == "ui"}

        with mock.patch.object(bs, "ui_health", return_value={"legacy": True, "app": "dam-eta"}), \
                mock.patch.object(bs, "bridge_health", return_value=_old_bridge_health(1)), \
                mock.patch.object(bs, "port_is_free", return_value=False), \
                mock.patch.object(bs, "stop_stale_service", side_effect=fake_stop):
            res = bs.takeover_stale_services(50010, 50011)
        self.assertEqual(calls, ["ui", "bridge"])
        self.assertFalse(res["ok"])
        self.assertEqual(res["error"], bs.STALE_BRIDGE_ERROR)
        self.assertIn("starsza wersja DAM", res["message"])

    def test_free_ports_skip_http_probes(self):
        with mock.patch.object(bs, "port_is_free", return_value=True), \
                mock.patch.object(bs, "ui_health") as uih, \
                mock.patch.object(bs, "bridge_health") as bh:
            res = bs.takeover_stale_services(50012, 50013)
        uih.assert_not_called()
        bh.assert_not_called()
        self.assertTrue(res["ok"])


class MacEntryTests(unittest.TestCase):
    def _load_main(self):
        spec = importlib.util.spec_from_file_location("dam_desktop_main_t", DESKTOP / "__main__.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_mac_takes_over_before_ui_start(self):
        order = []
        fake_mac = types.ModuleType("dam_macos")
        fake_mac.main = lambda: order.append("mac_main")
        mod = self._load_main()
        with mock.patch.object(sys, "platform", "darwin"), \
                mock.patch.dict(sys.modules, {"dam_macos": fake_mac}), \
                mock.patch.object(bs, "takeover_stale_services",
                                  side_effect=lambda *a, **k: order.append("takeover") or {"ok": True}):
            mod.main()
        self.assertEqual(order, ["takeover", "mac_main"])

    def test_mac_ui_port_blocked_shows_message_and_exits(self):
        fake_mac = types.ModuleType("dam_macos")
        fake_mac.main = mock.Mock()
        mod = self._load_main()
        res = {"ok": False, "error": bs.STALE_BRIDGE_ERROR, "message": bs.STALE_MESSAGE,
               "ui": {"verdict": "stale", "ok": False}, "bridge": {"verdict": "down", "ok": True}}
        with mock.patch.object(sys, "platform", "darwin"), \
                mock.patch.dict(sys.modules, {"dam_macos": fake_mac}), \
                mock.patch.object(bs, "takeover_stale_services", return_value=res), \
                mock.patch.object(mod, "_alert") as alert:
            with self.assertRaises(SystemExit):
                mod.main()
        alert.assert_called_once()
        self.assertIn("starsza wersja DAM", alert.call_args[0][0])
        fake_mac.main.assert_not_called()


class BridgeEndpointsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import local_bridge

        cls.lb = local_bridge
        cls.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), local_bridge.Handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def _req(self, method, path, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=20)
        conn.request(method, path, body=b"{}" if method == "POST" else None, headers=headers or {})
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, json.loads(data or b"{}")

    def test_health_reports_version_pid_root(self):
        code, data = self._req("GET", "/health")
        self.assertEqual(code, 200)
        self.assertEqual(data["app_version"], runtime_config.APP_VERSION)
        self.assertEqual(data["pid"], os.getpid())
        self.assertEqual(bs.norm_root(data["root"]), bs.norm_root(bs.local_identity()["root"]))
        self.assertTrue(data.get("control"))

    def test_shutdown_requires_token(self):
        with mock.patch.object(self.lb, "_CONTROL_TOKEN", "sekret-1"), \
                mock.patch.object(self.lb, "_schedule_control_shutdown") as sched:
            code, _ = self._req("POST", bs.SHUTDOWN_PATH)
            self.assertEqual(code, 403)
            code, _ = self._req("POST", bs.SHUTDOWN_PATH, {bs.CONTROL_TOKEN_HEADER: "zly"})
            self.assertEqual(code, 403)
            sched.assert_not_called()

    def test_shutdown_refuses_browser_origin(self):
        with mock.patch.object(self.lb, "_CONTROL_TOKEN", "sekret-1"), \
                mock.patch.object(self.lb, "_schedule_control_shutdown") as sched:
            code, _ = self._req("POST", bs.SHUTDOWN_PATH, {
                bs.CONTROL_TOKEN_HEADER: "sekret-1", "Origin": "http://127.0.0.1:8765"})
            self.assertEqual(code, 403)
            sched.assert_not_called()

    def test_shutdown_refused_without_bridge_token(self):
        with mock.patch.object(self.lb, "_CONTROL_TOKEN", ""), \
                mock.patch.object(self.lb, "_schedule_control_shutdown") as sched:
            code, _ = self._req("POST", bs.SHUTDOWN_PATH, {bs.CONTROL_TOKEN_HEADER: ""})
            self.assertEqual(code, 403)
            sched.assert_not_called()

    def test_shutdown_with_token_is_accepted(self):
        with mock.patch.object(self.lb, "_CONTROL_TOKEN", "sekret-1"), \
                mock.patch.object(self.lb, "_schedule_control_shutdown") as sched:
            code, data = self._req("POST", bs.SHUTDOWN_PATH, {bs.CONTROL_TOKEN_HEADER: "sekret-1"})
            self.assertEqual(code, 200)
            self.assertTrue(data["ok"])
            self.assertEqual(data["pid"], os.getpid())
            sched.assert_called_once()

    def test_shutdown_disabled_in_public_mode(self):
        with mock.patch.object(self.lb, "_CONTROL_TOKEN", "sekret-1"), \
                mock.patch.object(self.lb, "PUBLIC_MODE", True), \
                mock.patch.object(self.lb, "_schedule_control_shutdown") as sched:
            code, _ = self._req("POST", bs.SHUTDOWN_PATH, {bs.CONTROL_TOKEN_HEADER: "sekret-1"})
            self.assertIn(code, (403, 404))
            sched.assert_not_called()


if __name__ == "__main__":
    unittest.main()
