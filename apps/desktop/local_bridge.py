"""
DAM ETA local bridge (Windows).
Opens Explorer with /select and appends audit log entries.

Port: 8766 (UI static server stays on 8765).
CORS: allows http://127.0.0.1:8765

Endpoints:
  GET  /health
  POST /reveal   {"path": "M:\\\\...\\\\file.png"}  -> explorer /select
  POST /synology-share {"path": "..."} -> Synology Drive "Uzyskaj lacze" / Get link
  POST /validate-base {"path": "D:\\\\Marketing"} -> checks 3 root folders
  POST /audit    {"action","user","path","detail",...}
  GET  /audit?limit=100
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HOST = "127.0.0.1"
PORT = 8766
DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = Path(__file__).resolve().parents[1] / "web"
AUDIT_FILE = WEB_ROOT / "data" / "audit-log.jsonl"
SYNOLOGY_SCRIPT = DESKTOP_DIR / "synology_get_link.ps1"
REQUIRED_ROOT_FOLDERS = ("-- ARCHIWUM --", "- EKSPORT", "- POLSKA")
CORS_ORIGIN = "http://127.0.0.1:8765"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_path(p: str) -> str:
    return str(Path(p)).replace("/", "\\")


def is_probably_file(p: str) -> bool:
    name = Path(p).name
    return "." in name and not name.startswith(".")


def reveal_in_explorer(target: str) -> dict:
    target = normalize_path(target)
    if not os.path.exists(target):
        return {"ok": False, "error": "path_not_found", "path": target}

    # File: open parent and SELECT the file. Folder: open the folder.
    if os.path.isfile(target) or is_probably_file(target):
        cmd = f'explorer /select,"{target}"'
    else:
        cmd = f'explorer "{target}"'

    try:
        subprocess.Popen(cmd, shell=True)
        return {"ok": True, "path": target, "command": "select" if os.path.isfile(target) else "open"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "path": target}


def invoke_synology_share(target: str) -> dict:
    """Open Synology Drive Client share dialog (context menu: Uzyskaj lacze / Get link)."""
    target = normalize_path(target)
    if not os.path.exists(target):
        return {"ok": False, "error": "path_not_found", "path": target}
    if not os.path.isfile(target):
        return {"ok": False, "error": "not_a_file", "path": target}
    if not SYNOLOGY_SCRIPT.is_file():
        return {"ok": False, "error": "script_missing", "path": str(SYNOLOGY_SCRIPT)}

    cmd = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(SYNOLOGY_SCRIPT),
        "-FilePath",
        target,
    ]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=45,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout", "path": target}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "path": target}

    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()
    # Script prints one JSON object; take the last non-empty line.
    payload = None
    for line in reversed(stdout.splitlines()):
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
            break
        except json.JSONDecodeError:
            continue

    if isinstance(payload, dict):
        payload.setdefault("path", target)
        if payload.get("ok"):
            return payload
        return {
            "ok": False,
            "error": payload.get("error") or "synology_invoke_failed",
            "path": target,
            "raw": payload,
            "stderr": stderr or None,
        }

    return {
        "ok": False,
        "error": "invalid_script_output",
        "path": target,
        "exit_code": proc.returncode,
        "stdout": stdout[:500],
        "stderr": stderr[:500] if stderr else None,
    }


def validate_base(path: str) -> dict:
    base = Path(normalize_path(path))
    if not base.exists() or not base.is_dir():
        return {"ok": False, "error": "not_a_directory", "path": str(base)}
    missing = [name for name in REQUIRED_ROOT_FOLDERS if not (base / name).is_dir()]
    return {
        "ok": len(missing) == 0,
        "path": str(base),
        "missing": missing,
        "required": list(REQUIRED_ROOT_FOLDERS),
    }


def append_audit(entry: dict) -> dict:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "ts": entry.get("ts") or utc_now(),
        "action": entry.get("action") or "unknown",
        "user": entry.get("user") or "anonymous",
        "path": entry.get("path") or "",
        "local_path": entry.get("local_path") or "",
        "detail": entry.get("detail") or "",
        "meta": entry.get("meta") or {},
    }
    with AUDIT_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    return {"ok": True, "entry": row}


def read_audit(limit: int = 100) -> list:
    if not AUDIT_FILE.exists():
        return []
    lines = AUDIT_FILE.read_text(encoding="utf-8").splitlines()
    rows = []
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
        if len(rows) >= limit:
            break
    return rows


def append_carrier_override(path_key: str, entry: dict) -> dict:
    overrides_file = WEB_ROOT / "data" / "carrier-overrides.json"
    data = {"overrides": {}}
    if overrides_file.exists():
        try:
            data = json.loads(overrides_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {"overrides": {}}
    if "overrides" not in data or not isinstance(data["overrides"], dict):
        data["overrides"] = {}
    data["overrides"][path_key] = entry
    # also key by index if present in folder/path
    m = re.search(r"(\d{7}(?:\.\d+)?)", path_key)
    if m:
        data["overrides"][m.group(1)] = entry
    data["updated_at"] = utc_now()
    overrides_file.parent.mkdir(parents=True, exist_ok=True)
    overrides_file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"ok": True, "path": path_key, "entry": entry}


def serve_media(path: str) -> tuple[int, bytes, str]:
    target = normalize_path(path)
    if not os.path.isfile(target):
        return 404, b"", "application/json"
    ext = Path(target).suffix.lower()
    mime = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".tif": "image/tiff",
        ".tiff": "image/tiff",
        ".svg": "image/svg+xml",
    }.get(ext, "application/octet-stream")
    # TIFF often unsupported in browsers - still serve; client may fallback
    with open(target, "rb") as fh:
        return 200, fh.read(), mime


def media_meta(path: str) -> dict:
    """Read width/height/mode/colorspace/size for a local image (PIL)."""
    target = normalize_path(path)
    if not os.path.isfile(target):
        return {"ok": False, "error": "not_found", "path": target}
    size_bytes = os.path.getsize(target)
    out: dict = {
        "ok": True,
        "path": target,
        "size_bytes": size_bytes,
        "ext": Path(target).suffix.lower().lstrip("."),
        "width": None,
        "height": None,
        "mode": None,
        "colorspace": None,
        "dpi": None,
        "format": None,
    }
    try:
        from PIL import Image  # type: ignore

        with Image.open(target) as im:
            out["width"], out["height"] = im.size
            out["mode"] = im.mode
            out["format"] = im.format
            dpi = im.info.get("dpi")
            if dpi:
                out["dpi"] = dpi
            # Heuristic color space
            mode = (im.mode or "").upper()
            if mode in ("CMYK",):
                out["colorspace"] = "CMYK"
            elif mode in ("RGB", "RGBA", "P", "LA", "L"):
                out["colorspace"] = "RGB" if mode != "L" else "Grayscale"
                if mode in ("RGBA", "LA") or (mode == "P" and "transparency" in im.info):
                    out["has_alpha"] = True
            else:
                out["colorspace"] = mode or "unknown"
            if "icc_profile" in im.info:
                out["has_icc"] = True
    except Exception as exc:  # noqa: BLE001
        out["pil_error"] = str(exc)
    return out


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[dam-bridge]", fmt % args)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", CORS_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, payload: dict | list):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _bytes(self, code: int, body: bytes, content_type: str):
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "private, max-age=60")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._json(200, {"ok": True, "service": "dam-local-bridge", "port": PORT})
            return
        if parsed.path == "/audit":
            qs = parse_qs(parsed.query)
            limit = int((qs.get("limit") or ["100"])[0])
            self._json(200, {"ok": True, "items": read_audit(max(1, min(limit, 500)))})
            return
        if parsed.path == "/media":
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            code, body, ctype = serve_media(path)
            if code != 200:
                self._json(404, {"ok": False, "error": "not_found", "path": path})
                return
            self._bytes(200, body, ctype)
            return
        if parsed.path == "/media-meta":
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, media_meta(path))
            return
        self._json(404, {"ok": False, "error": "not_found"})

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "invalid_json"})
            return

        parsed = urlparse(self.path)
        if parsed.path == "/reveal":
            path = (data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, reveal_in_explorer(path))
            return
        if parsed.path == "/synology-share":
            path = (data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, invoke_synology_share(path))
            return
        if parsed.path == "/validate-base":
            path = (data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, validate_base(path))
            return
        if parsed.path == "/audit":
            self._json(200, append_audit(data if isinstance(data, dict) else {}))
            return
        if parsed.path == "/carrier-override":
            path = (data.get("path") or "").strip()
            entry = data.get("entry") or {}
            if not path or not isinstance(entry, dict):
                self._json(400, {"ok": False, "error": "path_and_entry_required"})
                return
            self._json(200, append_carrier_override(path, entry))
            return
        self._json(404, {"ok": False, "error": "not_found"})


def main() -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"DAM local bridge http://{HOST}:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
