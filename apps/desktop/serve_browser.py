"""
DAM ETA - tryb przegladarki (dev): UI + lokalny bridge razem.

Zwykly `python -m http.server 8765` NIE startuje mostu -> "Pliki offline".
Uzyj tego skryptu albo skrotu pulpitu DAM ETA (launch.py).

  python apps/desktop/serve_browser.py
"""
from __future__ import annotations

import http.server
import socketserver
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = DESKTOP_DIR.parent / "web"
LOCAL_BRIDGE = DESKTOP_DIR / "local_bridge.py"
HOST = "127.0.0.1"
UI_PORT = 8765
BRIDGE_PORT = 8766


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def start_bridge() -> subprocess.Popen:
    return subprocess.Popen(
        [sys.executable, str(LOCAL_BRIDGE)],
        cwd=str(DESKTOP_DIR),
        env={**dict(**__import__("os").environ), "DAM_BRIDGE_PORT": str(BRIDGE_PORT)},
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )


def main() -> None:
    if not WEB_ROOT.is_dir():
        print(f"Brak UI: {WEB_ROOT}")
        raise SystemExit(1)
    if not LOCAL_BRIDGE.is_file():
        print(f"Brak bridge: {LOCAL_BRIDGE}")
        raise SystemExit(1)

    bridge = start_bridge()
    time.sleep(0.4)

    handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(  # noqa: E731
        *a, directory=str(WEB_ROOT), **k
    )
    httpd = ReusableTCPServer((HOST, UI_PORT), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    url = f"http://{HOST}:{UI_PORT}/dashboard.html"
    print(f"DAM UI     {url}")
    print(f"DAM bridge http://{HOST}:{BRIDGE_PORT}/health")
    print("Ctrl+C aby zatrzymac.")
    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        while True:
            if bridge.poll() is not None:
                print("Bridge padl - restart...")
                bridge = start_bridge()
            time.sleep(2)
    except KeyboardInterrupt:
        print("Stop.")
    finally:
        httpd.shutdown()
        if bridge.poll() is None:
            bridge.terminate()


if __name__ == "__main__":
    main()
