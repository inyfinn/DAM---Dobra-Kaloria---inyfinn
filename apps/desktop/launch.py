"""
DAM ETA desktop launcher (Inyfinn-style).
Starts:
  - static UI on :8765
  - local bridge on :8766 (reveal in Explorer + audit log)
Opens pywebview when available.
"""
from __future__ import annotations

import http.server
import socketserver
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "web"
PORT = 8765
HOST = "127.0.0.1"
BRIDGE = Path(__file__).resolve().parent / "local_bridge.py"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print("[dam-web]", fmt % args)


def start_bridge() -> subprocess.Popen | None:
    if not BRIDGE.exists():
        print("[dam] local_bridge.py missing - reveal-in-explorer disabled")
        return None
    return subprocess.Popen(
        [sys.executable, str(BRIDGE)],
        cwd=str(BRIDGE.parent),
    )


def main() -> None:
    if not ROOT.exists():
        raise SystemExit(f"Missing UI folder: {ROOT}")

    bridge_proc = start_bridge()
    httpd = socketserver.TCPServer((HOST, PORT), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    url = f"http://{HOST}:{PORT}/signin.html"
    print(f"DAM ETA UI at {url}")
    print(f"Local bridge (reveal/audit) at http://{HOST}:8766")
    try:
        import webview  # type: ignore

        webview.create_window("DAM ETA", url, width=1280, height=840)
        webview.start()
    except Exception:
        webbrowser.open(url)
        print("pywebview unavailable - opened system browser. Ctrl+C to stop.")
        try:
            thread.join()
        except KeyboardInterrupt:
            pass
    finally:
        httpd.shutdown()
        if bridge_proc and bridge_proc.poll() is None:
            bridge_proc.terminate()


if __name__ == "__main__":
    main()
