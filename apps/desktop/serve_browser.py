"""
DAM ETA - tryb przegladarki (dev): UI + lokalny bridge razem.

Zwykly `python -m http.server 8765` NIE startuje mostu -> "Pliki offline".
Uzyj tego skryptu albo skrotu pulpitu DAM ETA (launch.py).

  python apps/desktop/serve_browser.py
"""
from __future__ import annotations

import socketserver
import sys
import threading
import time
import webbrowser

from bridge_supervisor import BridgeSupervisor, LOCAL_BRIDGE
from dam_ui_http import make_handler_class, prepare_runtime
from runtime_config import DEFAULT_BRIDGE_PORT, DEFAULT_UI_PORT, HOST, WEB_ROOT

DESKTOP_DIR = LOCAL_BRIDGE.parent


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def main() -> None:
    if not WEB_ROOT.is_dir():
        print(f"Brak UI: {WEB_ROOT}")
        raise SystemExit(1)
    if not LOCAL_BRIDGE.is_file():
        print(f"Brak bridge: {LOCAL_BRIDGE}")
        raise SystemExit(1)

    try:
        from launch import _kill_stale_dam_processes

        killed = _kill_stale_dam_processes()
        if killed:
            print(f"Wyczyszczono stare procesy DAM: {killed}")
            time.sleep(0.5)
    except Exception:
        pass

    ui_port = DEFAULT_UI_PORT
    bridge_port = DEFAULT_BRIDGE_PORT
    supervisor = BridgeSupervisor(ui_port, bridge_port)
    boot = supervisor.ensure_running()
    if not boot.get("ok"):
        print(f"Bridge nie wstal: {boot}")
    supervisor.start_supervisor_thread()

    runtime = prepare_runtime(ui_port, bridge_port)
    Handler = make_handler_class(runtime, supervisor, cache_control_static="dev")
    httpd = ReusableTCPServer((HOST, ui_port), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    url = f"http://{HOST}:{ui_port}/dashboard.html"
    print(f"DAM UI     {url}")
    print(f"DAM bridge http://{HOST}:{bridge_port}/health")
    print(f"Auto-start mostu: POST/GET {url.replace('dashboard.html', 'dam/ensure-services')}")
    print("Ctrl+C aby zatrzymac.")
    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        while True:
            time.sleep(2)
    except KeyboardInterrupt:
        print("Stop.")
    finally:
        supervisor.stop()
        httpd.shutdown()


if __name__ == "__main__":
    main()
