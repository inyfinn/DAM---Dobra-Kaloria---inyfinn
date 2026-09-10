# -*- coding: utf-8 -*-
"""Tymczasowy serwer samego UI na 8765 (bridge zostaje na 8766)."""
from __future__ import annotations

import http.server
import socketserver
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parent.parent / "web"
HOST = "127.0.0.1"
PORT = 8765


class ThreadingReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True
    block_on_close = False


def main() -> None:
    handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(  # noqa: E731
        *a, directory=str(WEB_ROOT), **k
    )
    httpd = ThreadingReusableTCPServer((HOST, PORT), handler)
    print(f"DAM UI http://{HOST}:{PORT}/dashboard.html", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
