# -*- coding: utf-8 -*-
"""macOS launcher: same HTTP UI (:8765) + bridge (:8766) as Windows.

Default next slice: pywebview cocoa wrapping bin/apps/web.
Fallback: Safari/Chrome at http://127.0.0.1:8765 (python -m / this module).
No .dmg / codesign here.
"""
from __future__ import annotations

import sys
import threading
import time
import webbrowser
from pathlib import Path

_DESKTOP = Path(__file__).resolve().parent
if str(_DESKTOP) not in sys.path:
    sys.path.insert(0, str(_DESKTOP))

from bridge_supervisor import BridgeSupervisor, LOCAL_BRIDGE
from dam_ui_http import ThreadingReusableTCPServer, make_handler_class, prepare_runtime
from runtime_config import APP_TITLE, DEFAULT_BRIDGE_PORT, DEFAULT_UI_PORT, HOST, WEB_ROOT


def _start_http(ui_port: int, bridge_port: int):
    supervisor = BridgeSupervisor(ui_port, bridge_port)
    boot = supervisor.ensure_running()
    if not boot.get("ok"):
        print(f"Bridge nie wstal: {boot}")
    supervisor.start_supervisor_thread()
    runtime = prepare_runtime(ui_port, bridge_port)
    Handler = make_handler_class(runtime, supervisor, cache_control_static="dev")
    httpd = ThreadingReusableTCPServer((HOST, ui_port), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, supervisor


def main() -> None:
    if not WEB_ROOT.is_dir():
        print(f"Brak UI: {WEB_ROOT}")
        raise SystemExit(1)
    if not LOCAL_BRIDGE.is_file():
        print(f"Brak bridge: {LOCAL_BRIDGE}")
        raise SystemExit(1)

    ui_port = DEFAULT_UI_PORT
    bridge_port = DEFAULT_BRIDGE_PORT
    httpd, supervisor = _start_http(ui_port, bridge_port)
    url = f"http://{HOST}:{ui_port}/dashboard.html"
    print(f"DAM UI     {url}")
    print(f"DAM bridge http://{HOST}:{bridge_port}/health")

    try:
        import webview  # type: ignore

        window = webview.create_window(APP_TITLE, url, width=1440, height=900, text_select=True)
        try:
            webview.start(gui="cocoa", debug=False)
        except Exception:
            webview.start(debug=False)
        return
    except ImportError:
        print("Brak pywebview — otwieram przegladarke. pip install pywebview")
        try:
            webbrowser.open(url)
        except Exception:
            pass
    except Exception as exc:
        print(f"pywebview cocoa skip: {exc}")
        try:
            webbrowser.open(url)
        except Exception:
            pass

    try:
        while True:
            time.sleep(2)
    except KeyboardInterrupt:
        pass
    finally:
        try:
            supervisor.stop()
        except Exception:
            pass
        try:
            httpd.shutdown()
        except Exception:
            pass


if __name__ == "__main__":
    main()
