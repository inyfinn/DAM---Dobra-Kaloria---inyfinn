"""
DAM ETA local bridge (Windows).
Opens Explorer with /select and appends audit log entries.

Port: 8766 (UI static server stays on 8765).
CORS: allows http://127.0.0.1:8765

Endpoints:
  GET  /health
  POST /reveal   {"path": "M:\\\\...\\\\file.png"}  -> explorer /select
  POST /rename-index {"folder","from_index","to_index","dry_run?"} -> rename index in folder tree
  POST /synology-share {"path": "..."} -> Synology Drive "Uzyskaj lacze" / Get link
  POST /validate-base {"path": "X:\\\\Marketing"} -> checks 3 root folders
  GET  /detect-marketing-bases -> kandydaci na tym komputerze (X:/D:/M:)
  GET/POST /machine-config -> baza Marketing dla tej maszyny (plik JSON)
  POST /auth/register|login  lokalne konta (bcrypt) + sesja urzadzenia
  GET  /auth/me  Authorization: Bearer <token>
  GET  /files/status?root=...  czy ROOT plikow online
  POST /audit    {"action","user","path","detail",...}
  GET  /audit?limit=100
  GET  /index/status  mtime file-index + postgres
  POST /index/rebuild  przebudowa indeksu + miniatur (async)
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from auth_store import (
    init_db as auth_init_db,
    list_users,
    login as auth_login,
    register_user,
    resolve_session,
    seed_owner_from_env,
)

try:
    import dam_db
except ImportError:
    dam_db = None  # type: ignore

HOST = "127.0.0.1"
PORT = int(os.environ.get("DAM_BRIDGE_PORT", "8766"))
DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = Path(os.environ.get("DAM_WEB_ROOT", str(DESKTOP_DIR.parent / "web")))
AUDIT_FILE = WEB_ROOT / "data" / "audit-log.jsonl"
INDEX_FILE = WEB_ROOT / "data" / "file-index.json"
BUILD_INDEX = WEB_ROOT / "scripts" / "build-file-index.py"
MACHINE_CONFIG = DESKTOP_DIR / "machine-config.json"
SYNOLOGY_SCRIPT = DESKTOP_DIR / "synology_get_link.ps1"
REQUIRED_ROOT_FOLDERS = ("-- ARCHIWUM --", "- EKSPORT", "- POLSKA")
CORS_ORIGIN = os.environ.get("DAM_UI_ORIGIN", "http://127.0.0.1:8765")
# Kolejnosc: ten komputer (X:) -> staging D: -> legacy root M:
MARKETING_CANDIDATES = (
    Path("X:/Marketing"),
    Path("D:/Marketing"),
    Path("M:/"),
)

_index_lock = threading.Lock()
_index_state: dict = {
    "running": False,
    "last_started": "",
    "last_finished": "",
    "last_ok": None,
    "last_error": "",
    "last_rc": None,
}


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


def detect_marketing_bases() -> dict:
    """Wykryj dostepne rooty Marketing na TYM komputerze."""
    found: list[dict] = []
    for candidate in MARKETING_CANDIDATES:
        try:
            exists = candidate.exists() and candidate.is_dir()
        except OSError:
            exists = False
        if not exists:
            found.append(
                {
                    "path": str(candidate),
                    "ok": False,
                    "exists": False,
                    "missing": list(REQUIRED_ROOT_FOLDERS),
                }
            )
            continue
        info = validate_base(str(candidate))
        found.append(
            {
                "path": str(candidate),
                "ok": bool(info.get("ok")),
                "exists": True,
                "missing": info.get("missing") or [],
            }
        )
    recommended = next((x["path"] for x in found if x.get("ok")), None)
    return {
        "ok": True,
        "candidates": found,
        "recommended": recommended,
        "required": list(REQUIRED_ROOT_FOLDERS),
    }


def _windows_username() -> str:
    return (os.environ.get("USERNAME") or os.environ.get("USER") or "default").strip() or "default"


def _normalize_base_path(base_path: str) -> str:
    win = normalize_path(base_path).strip()
    if re.match(r"^[A-Za-z]:\\?$", win):
        return win[0].upper() + ":\\"
    return win.rstrip("\\")


def read_machine_config() -> dict:
    """Preferencja Marketing dla biezacego konta Windows (nie globalna stala)."""
    user = _windows_username()
    if not MACHINE_CONFIG.is_file():
        return {"ok": True, "user": user, "base_path": "", "path": str(MACHINE_CONFIG)}
    try:
        data = json.loads(MACHINE_CONFIG.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    users = data.get("users") if isinstance(data.get("users"), dict) else {}
    entry = users.get(user) if isinstance(users.get(user), dict) else None
    # Migracja starego formatu {base_path: ...} -> biezacy user
    if not entry and data.get("base_path"):
        entry = {"base_path": data.get("base_path"), "updated_at": data.get("updated_at") or ""}
    return {
        "ok": True,
        "user": user,
        "base_path": str((entry or {}).get("base_path") or "").strip(),
        "updated_at": (entry or {}).get("updated_at") or "",
        "path": str(MACHINE_CONFIG),
    }


def write_machine_config(base_path: str) -> dict:
    """Zapis tylko dla biezacego konta Windows - nie nadpisuje innych userow."""
    user = _windows_username()
    stored = _normalize_base_path(base_path)
    data: dict = {}
    if MACHINE_CONFIG.is_file():
        try:
            data = json.loads(MACHINE_CONFIG.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            data = {}
    users = data.get("users") if isinstance(data.get("users"), dict) else {}
    users[user] = {"base_path": stored, "updated_at": utc_now()}
    payload = {"users": users}
    MACHINE_CONFIG.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if dam_db is not None:
        try:
            dam_db.reset_path_cache()
            dam_db.init_db()
        except Exception:  # noqa: BLE001
            pass
    return {
        "ok": True,
        "user": user,
        "base_path": stored,
        "updated_at": users[user]["updated_at"],
        "path": str(MACHINE_CONFIG),
        "db": dam_db.status() if dam_db else None,
    }


def append_audit(entry: dict) -> dict:
    """Zapis do SQLite (glowny) + opcjonalny mirror JSONL."""
    stores: list[str] = []
    row = {
        "ts": entry.get("ts") or utc_now(),
        "action": entry.get("action") or "unknown",
        "user": entry.get("user") or "anonymous",
        "path": entry.get("path") or "",
        "local_path": entry.get("local_path") or "",
        "detail": entry.get("detail") or "",
        "meta": entry.get("meta") or {},
    }
    if dam_db is not None:
        res = dam_db.append_audit(row)
        if res.get("ok"):
            stores.append("sqlite")
            row = res.get("entry") or row
    try:
        AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with AUDIT_FILE.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
        stores.append("jsonl")
    except OSError:
        pass
    return {"ok": bool(stores), "entry": row, "stores": stores}


def read_audit(limit: int = 100) -> list:
    if dam_db is not None:
        res = dam_db.read_audit(limit)
        if res.get("ok") and res.get("items"):
            return list(res["items"])
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


def index_status() -> dict:
    mtime = None
    size = 0
    if INDEX_FILE.is_file():
        st = INDEX_FILE.stat()
        mtime = st.st_mtime
        size = st.st_size
    db = dam_db.status() if dam_db else {"ok": False, "error": "dam_db_missing"}
    with _index_lock:
        state = dict(_index_state)
    return {
        "ok": True,
        "index_path": str(INDEX_FILE),
        "mtime": mtime,
        "mtime_iso": datetime.fromtimestamp(mtime, timezone.utc).isoformat() if mtime else "",
        "size": size,
        "rebuild": state,
        "database": db,
    }


def _run_index_rebuild() -> None:
    global _index_state
    with _index_lock:
        if _index_state["running"]:
            return
        _index_state["running"] = True
        _index_state["last_started"] = utc_now()
        _index_state["last_error"] = ""
    try:
        if not BUILD_INDEX.is_file():
            raise FileNotFoundError(str(BUILD_INDEX))
        rc = subprocess.call([sys.executable, str(BUILD_INDEX)])
        with _index_lock:
            _index_state["last_rc"] = rc
            _index_state["last_ok"] = rc == 0
            _index_state["last_finished"] = utc_now()
            if rc != 0:
                _index_state["last_error"] = f"build_rc_{rc}"
        append_audit(
            {
                "action": "index_rebuild",
                "user": "system",
                "detail": "ok" if rc == 0 else f"rc={rc}",
                "meta": {"rc": rc},
            }
        )
    except Exception as exc:  # noqa: BLE001
        with _index_lock:
            _index_state["last_ok"] = False
            _index_state["last_error"] = str(exc)
            _index_state["last_finished"] = utc_now()
    finally:
        with _index_lock:
            _index_state["running"] = False


def start_index_rebuild() -> dict:
    with _index_lock:
        if _index_state["running"]:
            return {"ok": True, "started": False, "running": True, "rebuild": dict(_index_state)}
    threading.Thread(target=_run_index_rebuild, daemon=True).start()
    # Daj watkowi chwile na ustawienie flagi
    time.sleep(0.05)
    return {"ok": True, "started": True, "running": True, "rebuild": index_status()["rebuild"]}


_INDEX_RE = re.compile(r"^(FOL\d+|\d{5,9})(\.\d{2})?$", re.IGNORECASE)


def _is_under_marketing(path: Path) -> bool:
    try:
        resolved = path.resolve()
    except OSError:
        return False
    candidates = list(MARKETING_CANDIDATES)
    cfg = MACHINE_CONFIG
    if cfg.is_file():
        try:
            data = json.loads(cfg.read_text(encoding="utf-8"))
            base = (data.get("base_path") or data.get("path") or "").strip()
            if base:
                candidates.insert(0, Path(base))
        except (OSError, json.JSONDecodeError):
            pass
    for root in candidates:
        try:
            resolved.relative_to(root.resolve())
            return True
        except (ValueError, OSError):
            continue
    return False


def rename_index_in_folder(
    folder: str,
    from_index: str,
    to_index: str,
    dry_run: bool = False,
) -> dict:
    """Rename occurrences of an index inside one revision folder (files + dirs)."""
    from_index = (from_index or "").strip()
    to_index = (to_index or "").strip()
    if not from_index or not to_index:
        return {"ok": False, "error": "from_and_to_required"}
    if from_index == to_index:
        return {"ok": False, "error": "same_index"}
    if not _INDEX_RE.match(from_index) or not _INDEX_RE.match(to_index):
        return {"ok": False, "error": "invalid_index_format"}

    root = Path(normalize_path(folder))
    if not root.is_dir():
        return {"ok": False, "error": "folder_not_found", "path": str(root)}
    if not _is_under_marketing(root):
        return {"ok": False, "error": "path_outside_marketing", "path": str(root)}

    renamed: list[dict] = []
    errors: list[dict] = []

    # Bottom-up: files first, then directories (so parent rename sees already-fixed children)
    all_paths = sorted(root.rglob("*"), key=lambda p: len(p.parts), reverse=True)
    # Include the revision folder itself last (shallowest rename among parents)
    targets = [p for p in all_paths if from_index in p.name]
    if from_index in root.name:
        targets.append(root)

    for path in targets:
        new_name = path.name.replace(from_index, to_index)
        if new_name == path.name:
            continue
        dest = path.with_name(new_name)
        entry = {"from": str(path), "to": str(dest)}
        if dry_run:
            renamed.append(entry)
            continue
        try:
            if dest.exists():
                errors.append({**entry, "error": "target_exists"})
                continue
            path.rename(dest)
            renamed.append(entry)
        except OSError as exc:
            errors.append({**entry, "error": str(exc)})

    append_audit(
        {
            "action": "rename_index",
            "path": str(root),
            "detail": f"{from_index} -> {to_index}",
            "renamed_count": len(renamed),
            "error_count": len(errors),
            "dry_run": bool(dry_run),
        }
    )
    return {
        "ok": len(errors) == 0,
        "folder": str(root),
        "from_index": from_index,
        "to_index": to_index,
        "dry_run": bool(dry_run),
        "renamed": renamed,
        "errors": errors,
    }


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


def append_thumb_override(product_id: str, entry: dict) -> dict:
    """Zapis wyboru miniatury w repo (apps/web/data) - nigdy na Marketing."""
    pid = (product_id or "").strip()
    if not pid:
        return {"ok": False, "error": "product_id_required"}
    overrides_file = WEB_ROOT / "data" / "thumb-overrides.json"
    data: dict = {}
    if overrides_file.exists():
        try:
            raw = json.loads(overrides_file.read_text(encoding="utf-8"))
            data = raw if isinstance(raw, dict) else {}
        except json.JSONDecodeError:
            data = {}
    row = {
        "path": (entry.get("path") or "").strip(),
        "file": (entry.get("file") or "").strip(),
        "thumb_url": (entry.get("thumb_url") or "").strip(),
        "updated_at": utc_now(),
    }
    data[pid] = row
    overrides_file.parent.mkdir(parents=True, exist_ok=True)
    overrides_file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"ok": True, "product_id": pid, "entry": row, "store": str(overrides_file)}


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
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

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

    def _bearer(self) -> str:
        auth = self.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            return auth[7:].strip()
        return ""

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._json(200, {"ok": True, "service": "dam-local-bridge", "port": PORT})
            return
        if parsed.path == "/detect-marketing-bases":
            self._json(200, detect_marketing_bases())
            return
        if parsed.path == "/machine-config":
            self._json(200, read_machine_config())
            return
        if parsed.path == "/auth/identity":
            try:
                from machine_identity import collect_identity, write_identity_runtime

                ident = collect_identity()
                write_identity_runtime(ident)
                self._json(200, ident)
            except Exception as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/auth/me":
            qs = parse_qs(parsed.query)
            device_id = (qs.get("device_id") or [""])[0]
            machine_id = (qs.get("machine_id") or [""])[0]
            res = resolve_session(self._bearer(), device_id, machine_id)
            self._json(200 if res.get("ok") else 401, res)
            return
        if parsed.path == "/auth/users":
            # lista kont (bez hasel) - tylko gdy sesja admina
            me = resolve_session(self._bearer())
            if not me.get("ok") or (me.get("user") or {}).get("role") != "admin":
                self._json(403, {"ok": False, "error": "admin_required"})
                return
            self._json(200, {"ok": True, "users": list_users()})
            return
        if parsed.path == "/files/status":
            qs = parse_qs(parsed.query)
            root = (qs.get("root") or [""])[0].strip()
            if not root:
                self._json(400, {"ok": False, "online": False, "error": "root_required"})
                return
            info = validate_base(root)
            online = bool(info.get("ok"))
            # Dodatkowy probe: czy da sie listowac POLSKA
            probe_ok = False
            if online:
                try:
                    polska = Path(normalize_path(root)) / "- POLSKA"
                    probe_ok = polska.is_dir() and any(polska.iterdir())
                except OSError:
                    probe_ok = False
            self._json(
                200,
                {
                    "ok": True,
                    "online": online and probe_ok,
                    "root": info.get("path") or root,
                    "missing": info.get("missing") or [],
                    "probe": "list_-POLSKA",
                    "probe_ok": probe_ok,
                },
            )
            return
        if parsed.path == "/audit":
            qs = parse_qs(parsed.query)
            limit = int((qs.get("limit") or ["100"])[0])
            self._json(200, {"ok": True, "items": read_audit(max(1, min(limit, 500)))})
            return
        if parsed.path == "/index/status":
            self._json(200, index_status())
            return
        if parsed.path in ("/db/status", "/pg/status"):
            # /pg/status zostawiony jako alias (stary klient) - zawsze SQLite
            self._json(200, dam_db.status() if dam_db else {"ok": False, "error": "dam_db_missing"})
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
        if parsed.path == "/machine-config":
            path = (data.get("base_path") or data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "base_path_required"})
                return
            self._json(200, write_machine_config(path))
            return
        if parsed.path == "/auth/register":
            self._json(
                200,
                register_user(
                    data.get("email") or "",
                    data.get("password") or "",
                    data.get("name") or "",
                    data.get("role") or "user",
                ),
            )
            return
        if parsed.path == "/auth/login":
            self._json(
                200,
                auth_login(
                    data.get("email") or "",
                    data.get("password") or "",
                    data.get("device_id") or "",
                    data.get("machine_id") or "",
                ),
            )
            return
        if parsed.path == "/audit":
            self._json(200, append_audit(data if isinstance(data, dict) else {}))
            return
        if parsed.path == "/index/rebuild":
            self._json(200, start_index_rebuild())
            return
        if parsed.path == "/carrier-override":
            path = (data.get("path") or "").strip()
            entry = data.get("entry") or {}
            if not path or not isinstance(entry, dict):
                self._json(400, {"ok": False, "error": "path_and_entry_required"})
                return
            self._json(200, append_carrier_override(path, entry))
            return
        if parsed.path == "/thumb-override":
            pid = (data.get("product_id") or "").strip()
            if not pid:
                self._json(400, {"ok": False, "error": "product_id_required"})
                return
            self._json(200, append_thumb_override(pid, data if isinstance(data, dict) else {}))
            return
        if parsed.path == "/rename-index":
            folder = (data.get("folder") or data.get("path") or "").strip()
            from_index = (data.get("from_index") or "").strip()
            to_index = (data.get("to_index") or "").strip()
            dry_run = bool(data.get("dry_run"))
            if not folder or not from_index or not to_index:
                self._json(400, {"ok": False, "error": "folder_from_to_required"})
                return
            result = rename_index_in_folder(folder, from_index, to_index, dry_run=dry_run)
            self._json(200 if result.get("ok") else 400, result)
            return
        self._json(404, {"ok": False, "error": "not_found"})


def main() -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        if dam_db is not None:
            print("sqlite:", dam_db.init_db())
        auth_init_db()
        seed_owner_from_env()
    except Exception as exc:
        print("auth/db seed:", exc)
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
