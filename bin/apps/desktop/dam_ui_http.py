"""Shared DAM UI HTTP handler: static files + runtime + ensure-services."""
from __future__ import annotations

import http.server
import json
import socket
import socketserver
import sys
from typing import TYPE_CHECKING

from runtime_config import WEB_ROOT, runtime_payload, write_runtime_file

_CLIENT_GONE = (ConnectionAbortedError, ConnectionResetError, BrokenPipeError, TimeoutError, ConnectionError)


def _is_backup_static_path(path: str) -> bool:
    """Refuse HTTP for backup copies sitting under the static web tree."""
    base = (path or "").rsplit("/", 1)[-1].lower()
    if not base:
        return False
    if base.endswith(".sql.gz") or base.endswith(".old"):
        return True
    if "backup" in base:
        return True
    if ".bak-" in base or base.endswith(".bak"):
        return True
    return False


class ThreadingReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    """Concurrent UI GETs so in-tab reload is not blocked by an aborted copyfile.

    Single-thread TCPServer + WinError 10053 during shutil.copyfile left :8765
    unable to finish F5 in an already-open tab; a new browser (fresh sockets)
    still worked. Reload-in-tab is a first-class bug, not "localhost cache".
    """

    allow_reuse_address = True
    daemon_threads = True
    block_on_close = False
    request_queue_size = 64

    def server_bind(self):
        # Windows SO_REUSEADDR allows two processes on :8765. Dual bind split
        # Chrome reload across servers (white document; new browser "worked").
        if sys.platform == "win32":
            self.allow_reuse_address = False
            try:
                self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            except (OSError, AttributeError):
                pass
        super().server_bind()

    def finish_request(self, request, client_address):
        try:
            request.settimeout(45)
        except OSError:
            pass
        super().finish_request(request, client_address)

    def handle_error(self, request, client_address):
        err = sys.exc_info()[1]
        if isinstance(err, _CLIENT_GONE):
            return
        winerr = getattr(err, "winerror", None)
        if isinstance(err, OSError) and winerr in (10053, 10054, 10038, 32):
            return
        super().handle_error(request, client_address)


if TYPE_CHECKING:
    from bridge_supervisor import BridgeSupervisor


def json_bytes(payload: dict) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


class DamUiRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Static UI + /dam-runtime.json + /dam/ensure-services."""

    runtime: dict
    bridge_supervisor: "BridgeSupervisor | None" = None
    cache_control_static: str = "no-store"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def parse_request(self):  # noqa: D102
        """Anty DNS-rebinding: UI (w tym data/*.json z indeksem plikow) tylko dla Host = loopback."""
        if not super().parse_request():
            return False
        host = (self.headers.get("Host") or "").strip().lower()
        if host.startswith("["):
            name = host.split("]", 1)[0] + "]"
        else:
            name = host.rsplit(":", 1)[0] if ":" in host else host
        if name not in ("127.0.0.1", "localhost", "[::1]"):
            self.send_error(403, "host_forbidden")
            return False
        return True

    def end_headers(self):
        path = self.path.split("?", 1)[0]
        if self.cache_control_static == "no-store":
            self.send_header("Cache-Control", "no-store")
        elif path.endswith(
            (
                ".png",
                ".jpg",
                ".jpeg",
                ".webp",
                ".avif",
                ".gif",
                ".svg",
                ".ico",
                ".woff",
                ".woff2",
                ".ttf",
                ".otf",
            )
        ):
            self.send_header("Cache-Control", "private, max-age=3600")
        # Edytowalne pliki (CSS/JS/JSON/HTML) musza byc swieze nawet bez ?v= — inaczej
        # zapomniany token w HTML wysyla przegladarke w godzine twardego cache.
        elif (
            path.endswith(".js")
            or path.endswith(".css")
            or path.endswith(".json")
            or path.endswith(".html")
            or path.endswith(".map")
            or path.endswith("/")
            or path.endswith("sw.js")
        ):
            self.send_header("Cache-Control", "no-cache, max-age=0, must-revalidate")
        elif path.startswith("/assets/") or path.startswith("assets/"):
            self.send_header("Cache-Control", "private, max-age=3600")
        else:
            self.send_header("Cache-Control", "private, max-age=3600")
        super().end_headers()

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except _CLIENT_GONE:
            return
        except OSError as exc:
            if getattr(exc, "winerror", None) in (10053, 10054, 10038, 32):
                return
            raise

    def guess_type(self, path):
        ctype = super().guess_type(path)
        if ctype == "text/html":
            return "text/html; charset=utf-8"
        if ctype in (
            "application/javascript",
            "text/javascript",
            "text/css",
            "application/json",
        ):
            if "charset=" not in ctype:
                return ctype + "; charset=utf-8"
        return ctype

    def do_GET(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        qs = self.path.split("?", 1)[1] if "?" in self.path else ""
        if path == "/dam-runtime.json":
            body = json_bytes(self.runtime)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/dam/ensure-services":
            self._handle_ensure_services()
            return
        # HARD: nie serwuj branding-index.json (~340MB) ani backupow do przegladarki.
        # Slim: branding-grid-head.json / branding-grid-index.json. Admin: ?full=1
        if _is_backup_static_path(path):
            self.send_error(404, "Not Found")
            return
        base = path.rsplit("/", 1)[-1]
        fat_branding = base == "branding-index.json" or (
            base.startswith("branding-index.")
            and base.endswith(".json")
            and "grid" not in base
            and "search" not in base
        )
        if fat_branding and "full=1" not in qs:
            body = json_bytes(
                {
                    "ok": False,
                    "error": "use_branding_grid_index",
                    "hint": "Use data/branding-grid-head.json or branding-grid-index.json",
                }
            )
            self.send_response(403)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path == "/dam/ensure-services":
            self._handle_ensure_services()
            return
        self.send_error(405, "Method Not Allowed")

    def _handle_ensure_services(self) -> None:
        result = {"ok": False, "service": "dam-ui", "bridge": None}
        sup = getattr(self, "bridge_supervisor", None)
        if sup is None:
            result["error"] = "no_supervisor"
        else:
            bridge = sup.ensure_running()
            result["bridge"] = bridge
            result["ok"] = bool(bridge.get("ok"))
        body = json_bytes(result)
        self.send_response(200 if result["ok"] else 503)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def make_handler_class(
    runtime: dict,
    supervisor: "BridgeSupervisor | None",
    *,
    cache_control_static: str = "no-store",
) -> type[DamUiRequestHandler]:
    class Handler(DamUiRequestHandler):
        pass

    Handler.runtime = runtime
    Handler.bridge_supervisor = supervisor
    Handler.cache_control_static = cache_control_static
    return Handler


def prepare_runtime(ui_port: int, bridge_port: int) -> dict:
    write_runtime_file(ui_port, bridge_port)
    return runtime_payload(ui_port, bridge_port)
