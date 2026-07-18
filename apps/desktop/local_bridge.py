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
  GET  /folder-images?path=...  lista obrazow w folderze Marketing (picker miniatury)
  POST /viz-flag  demo/hidden/manual -> apps/web/data/viz-flags.json
  POST /thumb-override  wybor miniatury -> apps/web/data/thumb-overrides.json
  POST /audit    {"action","user","path","detail",...}
  GET  /audit?limit=100
  GET  /index/status  mtime file-index + postgres
  POST /index/rebuild  przebudowa indeksu + miniatur (async)
  POST /rename-revision-prefix  Faza 4: propozycja/natychmiastowa zmiana typu (prefiks folderu)
  GET  /tag-proposals  lista kolejki moderacji (auto-apply po 72h liczony lazily)
  POST /tag-proposals/decide  zatwierdz/odrzuc/wybierz inny typ (admin/power_user)
  GET/POST /carrier-types  wlasne typy nosnikow (dodaj/usun + reassign historii)
  POST /viz-request  Faza 5/6: "Zglos zapotrzebowanie" wielokanalowe (mail/Teams/Asana stub + w aplikacji)
  GET  /inbox-items  lista wpisow panelu (viz-request i inne, tagi + read flag)
  POST /inbox-items/mark-read  {"id"} -> oznacz przeczytane
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


TAG_PROPOSALS_FILE = WEB_ROOT / "data" / "tag-proposals.json"
CARRIER_TYPES_FILE = WEB_ROOT / "data" / "carrier-types.json"
ASSIGNMENT_LOG_FILE = WEB_ROOT / "data" / "carrier-assignment-log.json"
PROPOSAL_TTL_HOURS = 72

# Znane kody nosnikow (do wykrycia i ZAMIANY istniejacego prefiksu, nie doklejania
# drugiego przed pierwszym - "FOLIA - ..." -> "DOY - ...", nie "DOY - FOLIA - ...").
KNOWN_CARRIER_CODES = (
    "KAR6X", "DOY6X", "ETY-BUT", "ETY-SLO", "DOY", "KAR", "MINI", "BAT", "BAR",
    "BIGPAK", "TUBA", "FOLIA", "FOL", "FOIL", "SASZ", "REKAW", "SLEEVE", "OBW",
    "ETY", "SHOT", "WIZKA",
)

# Etykiety PL / warianty nazw folderow (najdluzsze pierwsze) - rename DOYPACK -> BAT
KNOWN_CARRIER_PREFIXES = (
    "DOYPACK 6X MINI",
    "DOYPACK 6x MINI",
    "KARTON 6X MINI",
    "KARTON 6x MINI",
    "MINI BATON",
    "ETYKIETA BUTELKA",
    "ETYKIETA SLOIK",
    "ETYKIETA SŁOIK",
    "BIGPAK",
    "DOYPACK",
    "KARTON",
    "BATON",
    "FOLIA",
    "REKAW",
    "RĘKAW",
    "SASZETKA",
    "OBWOLUTA",
    "WIZUALIZACJE",
    "WIZKA",
    "TUBA",
    "SHOT",
    "ETYKIETA",
) + KNOWN_CARRIER_CODES

# Mapowanie kodu API (BAT/DOY) -> prefiks folderu na dysku
CARRIER_FOLDER_PREFIX = {
    "BAT": "BATON",
    "BAR": "BATON",
    "MINI": "MINI BATON",
    "DOY": "DOYPACK",
    "DOY6X": "DOYPACK 6x MINI",
    "KAR": "KARTON",
    "KAR6X": "KARTON 6x MINI",
    "FOL": "FOLIA",
    "FOIL": "FOLIA",
    "FOLIA": "FOLIA",
    "REKAW": "REKAW",
    "SLEEVE": "REKAW",
    "SASZ": "SASZETKA",
    "OBW": "OBWOLUTA",
    "ETY": "ETYKIETA",
    "ETY-BUT": "ETYKIETA BUTELKA",
    "ETY-SLO": "ETYKIETA SŁOIK",
    "WIZKA": "WIZUALIZACJE",
    "NONE": "",
}


def _load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def _save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_tag_proposals() -> dict:
    return _load_json(TAG_PROPOSALS_FILE, {"proposals": []})


def save_tag_proposals(data: dict) -> None:
    _save_json(TAG_PROPOSALS_FILE, data)


def append_assignment_log(revision_path: str, carrier_code: str, actor: str) -> None:
    log = _load_json(ASSIGNMENT_LOG_FILE, {"entries": []})
    log["entries"].append({
        "ts": utc_now(),
        "revision_path": revision_path,
        "carrier_code": carrier_code,
        "actor": actor,
    })
    _save_json(ASSIGNMENT_LOG_FILE, log)


def _match_carrier_prefix(name):
    """Zwraca (matched_head, rest_with_separator). rest zaczyna sie od ' - ' gdy bylo."""
    head = name.split(" - ")[0].strip()
    rest = name[len(head):]
    head_upper = head.upper()
    for code in sorted(KNOWN_CARRIER_PREFIXES, key=lambda s: -len(s)):
        cu = code.upper()
        if head_upper == cu or head_upper.startswith(cu + " "):
            return head, rest
    return None, name


def rename_revision_prefix_on_disk(revision_path: str, new_code: str) -> dict:
    """Zamienia WYLACZNIE prefiks folderu rewizji na dysku (2026-07-18, P6/P7).
    "FOLIA - 20.09.2024 - 6300488.00" -> "DOYPACK - 20.09.2024 - 6300488.00".
    "DOYPACK 6x MINI - ..." -> "BATON - ..." (naprawa blednego nosnika).
    NONE / BRAK TYPU: usuwa prefiks (zostaje data/indeks).
    Nigdy nie dotyka niczego innego (jezyki/gramatura/data zostaja bez zmian)."""
    p = Path(normalize_path(revision_path))
    if not p.is_dir():
        return {"ok": False, "error": "revision_not_found", "path": str(p)}
    parent = p.parent
    name = p.name
    matched_known, rest = _match_carrier_prefix(name)
    new_code_clean = (new_code or "").strip().upper()
    if not new_code_clean:
        return {"ok": False, "error": "new_code_required"}

    if new_code_clean in ("NONE", "BRAK", "BRAK_TYPU", "__NONE__"):
        if matched_known is None:
            return {
                "ok": True,
                "old_path": str(p),
                "new_path": str(p),
                "old_name": name,
                "new_name": name,
                "noop": True,
            }
        new_name = rest.lstrip(" -").strip() if rest else ""
        if not new_name:
            return {"ok": False, "error": "cannot_strip_to_empty_name"}
    else:
        folder_prefix = CARRIER_FOLDER_PREFIX.get(new_code_clean, new_code_clean)
        if matched_known is not None:
            tail = rest if rest.startswith(" - ") else ((" - " + rest.lstrip(" -")) if rest else "")
            new_name = folder_prefix + tail
        else:
            sep = "" if name.startswith(" - ") else " - "
            new_name = folder_prefix + sep + name

    dest = parent / new_name
    if dest.exists() and dest != p:
        return {"ok": False, "error": "target_exists", "target": str(dest)}
    try:
        p.rename(dest)
    except OSError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "old_path": str(p), "new_path": str(dest), "old_name": name, "new_name": new_name}


def create_or_apply_tag_proposal(payload: dict) -> dict:
    """Faza 4 (P5/P7): kazda rola moze PROPONOWAC typ. Admin/power_user z wlaczonym
    trybem edycji -> zmiana natychmiastowa. Zwykly user (albo bez trybu edycji)
    -> zapis do kolejki moderacji, auto-apply po 72h bez decyzji."""
    revision_path = (payload.get("revision_path") or "").strip()
    new_code = (payload.get("new_carrier_code") or "").strip().upper()
    role = (payload.get("role") or "user").strip()
    admin_mode = bool(payload.get("admin_mode"))
    submitted_by = (payload.get("user_email") or payload.get("user_name") or "anonim").strip()
    current_value = (payload.get("current_carrier_code") or "").strip().upper()

    if not revision_path:
        return {"ok": False, "error": "revision_path_and_new_carrier_code_required"}
    if not new_code:
        return {"ok": False, "error": "revision_path_and_new_carrier_code_required"}
    # NONE = jawne "BRAK TYPU" (dozwolone)

    can_apply_immediately = role in ("admin", "power_user") and admin_mode
    if can_apply_immediately:
        result = rename_revision_prefix_on_disk(revision_path, new_code)
        if result.get("ok"):
            append_audit({
                "action": "rename_revision_prefix",
                "path": result["new_path"],
                "detail": f"{current_value or '?'} -> {new_code}",
                "user": submitted_by,
            })
            append_assignment_log(result["new_path"], new_code, submitted_by)
        return {"ok": result.get("ok", False), "applied": True, "immediate": True, **result}

    data = load_tag_proposals()
    proposals = data.setdefault("proposals", [])
    now = datetime.now(timezone.utc)
    expires = now.timestamp() + PROPOSAL_TTL_HOURS * 3600
    proposal_id = f"prop_{int(now.timestamp() * 1000)}"
    entry = {
        "id": proposal_id,
        "field": "carrier",
        "revision_path": revision_path,
        "product_id": payload.get("product_id") or "",
        "product_name": payload.get("product_name") or "",
        "current_value": current_value,
        "proposed_value": new_code,
        "status": "pending",
        "submitted_by": submitted_by,
        "submitted_at": now.isoformat(timespec="seconds"),
        "expires_at": datetime.fromtimestamp(expires, tz=timezone.utc).isoformat(timespec="seconds"),
        "decided_by": None,
        "decided_at": None,
    }
    proposals.append(entry)
    save_tag_proposals(data)
    append_audit({
        "action": "tag_proposal_submitted",
        "path": revision_path,
        "detail": f"{current_value or '?'} -> {new_code} (pending)",
        "user": submitted_by,
    })
    return {"ok": True, "applied": False, "immediate": False, "proposal": entry}


def auto_apply_expired_proposals() -> int:
    """Wywolywane lazily na GET /tag-proposals - 72h bez decyzji = auto-apply (P7)."""
    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    now = datetime.now(timezone.utc)
    changed = 0
    for entry in proposals:
        if entry.get("status") != "pending":
            continue
        try:
            expires_at = datetime.fromisoformat(entry["expires_at"])
        except (KeyError, ValueError):
            continue
        if now < expires_at:
            continue
        result = rename_revision_prefix_on_disk(entry["revision_path"], entry["proposed_value"])
        entry["status"] = "auto_applied" if result.get("ok") else "auto_apply_failed"
        entry["decided_by"] = "system_72h"
        entry["decided_at"] = now.isoformat(timespec="seconds")
        if result.get("ok"):
            append_assignment_log(result["new_path"], entry["proposed_value"], "system_72h")
            append_audit({
                "action": "tag_proposal_auto_applied",
                "path": result["new_path"],
                "detail": f"{entry.get('current_value') or '?'} -> {entry['proposed_value']}",
                "user": entry.get("submitted_by"),
            })
        changed += 1
    if changed:
        save_tag_proposals(data)
    return changed


def decide_tag_proposal(payload: dict) -> dict:
    proposal_id = (payload.get("proposal_id") or "").strip()
    decision = (payload.get("decision") or "").strip()  # approve | reject | pick_other
    decided_by = (payload.get("decided_by") or "moderator").strip()
    override_value = (payload.get("new_value") or "").strip().upper()

    if not proposal_id or decision not in ("approve", "reject", "pick_other"):
        return {"ok": False, "error": "proposal_id_and_valid_decision_required"}

    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    entry = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not entry:
        return {"ok": False, "error": "proposal_not_found"}
    if entry.get("status") != "pending":
        return {"ok": False, "error": "proposal_already_decided", "status": entry.get("status")}

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if decision == "reject":
        entry["status"] = "rejected"
        entry["decided_by"] = decided_by
        entry["decided_at"] = now
        save_tag_proposals(data)
        append_audit({"action": "tag_proposal_rejected", "path": entry["revision_path"], "user": decided_by})
        return {"ok": True, "proposal": entry}

    final_value = override_value if decision == "pick_other" and override_value else entry["proposed_value"]
    result = rename_revision_prefix_on_disk(entry["revision_path"], final_value)
    entry["status"] = "approved" if result.get("ok") else "approve_failed"
    entry["decided_by"] = decided_by
    entry["decided_at"] = now
    entry["final_value"] = final_value
    save_tag_proposals(data)
    if result.get("ok"):
        append_assignment_log(result["new_path"], final_value, decided_by)
        append_audit({
            "action": "tag_proposal_approved",
            "path": result["new_path"],
            "detail": f"{entry.get('current_value') or '?'} -> {final_value}",
            "user": decided_by,
        })
    return {"ok": result.get("ok", False), "proposal": entry, **{k: v for k, v in result.items() if k != "ok"}}


def manage_carrier_type(payload: dict) -> dict:
    """Dodaj/usun wlasny typ (Faza 4, warstwa nad naming-dictionary.json).
    Usuniecie wymaga replacement (kod docelowy albo None=wyczysc) - historia
    przypisan w carrier-assignment-log.json pozwala pozniej zbiorczo naprawic."""
    action = (payload.get("action") or "").strip()
    code = (payload.get("code") or "").strip().upper()
    data = _load_json(CARRIER_TYPES_FILE, {"custom_types": {}, "deleted_types": {}})
    data.setdefault("custom_types", {})
    data.setdefault("deleted_types", {})

    if action == "add":
        label_pl = (payload.get("label_pl") or code).strip()
        if not code:
            return {"ok": False, "error": "code_required"}
        data["custom_types"][code] = {"label_pl": label_pl, "added_at": utc_now(), "added_by": payload.get("actor") or ""}
        data["deleted_types"].pop(code, None)
        _save_json(CARRIER_TYPES_FILE, data)
        append_audit({"action": "carrier_type_added", "detail": f"{code}: {label_pl}", "user": payload.get("actor") or ""})
        return {"ok": True, "custom_types": data["custom_types"]}

    if action == "delete":
        if not code:
            return {"ok": False, "error": "code_required"}
        replacement = (payload.get("replacement") or "").strip().upper() or None
        data["custom_types"].pop(code, None)
        data["deleted_types"][code] = {
            "replacement": replacement,
            "deleted_at": utc_now(),
            "deleted_by": payload.get("actor") or "",
        }
        _save_json(CARRIER_TYPES_FILE, data)
        # Zbiorcze przepisanie historycznych przypisan (jesli wskazano replacement)
        reassigned = 0
        if replacement:
            log = _load_json(ASSIGNMENT_LOG_FILE, {"entries": []})
            for e in log.get("entries") or []:
                if e.get("carrier_code") == code:
                    rev = e.get("revision_path") or ""
                    if rev and Path(normalize_path(rev)).is_dir():
                        res = rename_revision_prefix_on_disk(rev, replacement)
                        if res.get("ok"):
                            reassigned += 1
        append_audit({
            "action": "carrier_type_deleted",
            "detail": f"{code} -> {replacement or 'brak (wyczyszczone)'} ({reassigned} przepisanych)",
            "user": payload.get("actor") or "",
        })
        return {"ok": True, "deleted": code, "replacement": replacement, "reassigned_count": reassigned}

    return {"ok": False, "error": "unknown_action"}


NOTIFICATION_GROUPS_FILE = WEB_ROOT / "data" / "notification-groups.json"
INBOX_ITEMS_FILE = WEB_ROOT / "data" / "inbox-items.json"


def load_notification_group(name: str) -> list[dict]:
    data = _load_json(NOTIFICATION_GROUPS_FILE, {})
    return data.get(name) or []


def append_inbox_item(entry: dict) -> dict:
    """Wpis 'w aplikacji' - ZAWSZE tworzony niezaleznie od wybranych kanalow
    zewnetrznych (Faza 6, P10). apps/web/data/inbox-items.json, tagi = zrodlo."""
    data = _load_json(INBOX_ITEMS_FILE, {"items": []})
    data.setdefault("items", [])
    entry = dict(entry)
    entry.setdefault("id", f"inbox_{int(datetime.now(timezone.utc).timestamp() * 1000)}")
    entry.setdefault("created_at", utc_now())
    entry.setdefault("read", False)
    data["items"].insert(0, entry)
    data["items"] = data["items"][:500]  # nie rosnij w nieskonczonosc
    _save_json(INBOX_ITEMS_FILE, data)
    return entry


def create_viz_request(payload: dict) -> dict:
    """Faza 5/6 (P10): "Zglos zapotrzebowanie" - wielokanalowe zgloszenie.
    Email/Teams/Asana to na razie STUBY (ADR-005) - logujemy intencje w audit +
    inbox, gotowe do podlaczenia realnych credentiali. Wpis w panelu ZAWSZE."""
    product_name = payload.get("product_name") or "Produkt"
    lang_full = payload.get("lang_full") or payload.get("lang") or ""
    index = payload.get("index") or ""
    channels = payload.get("channels") or {}
    requested_by = payload.get("requested_by") or "anonim"

    human_desc = (
        f"Prosze o wykonanie wizualizacji na {product_name}"
        + (f" ({lang_full})" if lang_full else "")
        + (f" - indeks {index}" if index else "")
        + f". Zglosil: {requested_by}."
    )
    folder_link = payload.get("path") or ""
    detail_lines = [human_desc]
    if folder_link:
        detail_lines.append(f"Folder: {folder_link}")
    if payload.get("brand"):
        detail_lines.append(f"Marka: {payload.get('brand')}")
    if payload.get("category"):
        detail_lines.append(f"Kategoria: {payload.get('category')}")
    if payload.get("carrier_label"):
        detail_lines.append(f"Typ: {payload.get('carrier_label')}")
    full_detail = "\n".join(detail_lines)

    channels_sent: list[str] = []
    tags = ["wizualizacja", "zgloszenie"]

    if channels.get("email"):
        recipients = [g.get("email") for g in load_notification_group("grafik") if g.get("email")]
        append_audit({
            "action": "viz_request_email_stub",
            "detail": f"TO: {', '.join(recipients)} | {human_desc}",
            "user": requested_by,
        })
        channels_sent.append("email")
        tags.append("mail")
    if channels.get("teams"):
        append_audit({"action": "viz_request_teams_stub", "detail": human_desc, "user": requested_by})
        channels_sent.append("teams")
        tags.append("teams")
    if channels.get("asana"):
        append_audit({"action": "viz_request_asana_stub", "detail": full_detail, "user": requested_by})
        channels_sent.append("asana")
        tags.append("asana")
    if channels.get("app") or not channels_sent:
        channels_sent.append("app")
        tags.append("prywatna")

    inbox_entry = append_inbox_item({
        "type": "viz_request",
        "title": f"Zgloszenie wizualizacji: {product_name}",
        "detail": full_detail,
        "tags": sorted(set(tags)),
        "requested_by": requested_by,
        "product_id": payload.get("product_id"),
        "path": folder_link,
    })
    append_audit({
        "action": "viz_request_created",
        "detail": human_desc,
        "user": requested_by,
        "path": folder_link,
    })
    return {"ok": True, "channels_sent": channels_sent, "inbox_item": inbox_entry}


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
    overrides_file.parent.mkdir(parents=True, exist_ok=True)
    # Cofniecie wyboru miniatury (admin)
    if entry.get("clear"):
        data.pop(pid, None)
        overrides_file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return {"ok": True, "product_id": pid, "cleared": True, "store": str(overrides_file)}
    row = {
        "path": (entry.get("path") or "").strip(),
        "file": (entry.get("file") or "").strip(),
        "thumb_url": (entry.get("thumb_url") or "").strip(),
        "updated_at": utc_now(),
    }
    data[pid] = row
    overrides_file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"ok": True, "product_id": pid, "entry": row, "store": str(overrides_file)}


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff"}


def list_folder_images(path: str) -> dict:
    """Lista obrazow w folderze Marketing (do pickera miniatury w przegladarce)."""
    target = Path(normalize_path(path or ""))
    if not target.exists():
        return {"ok": False, "error": "path_not_found", "path": str(target), "files": []}
    if target.is_file():
        target = target.parent
    if not target.is_dir():
        return {"ok": False, "error": "not_a_directory", "path": str(target), "files": []}
    if not _is_under_marketing(target):
        return {"ok": False, "error": "path_outside_marketing", "path": str(target), "files": []}
    files: list[dict] = []
    try:
        for child in sorted(target.iterdir(), key=lambda p: p.name.lower()):
            if not child.is_file():
                continue
            if child.suffix.lower() not in IMAGE_EXTS:
                continue
            files.append(
                {
                    "name": child.name,
                    "path": str(child).replace("\\", "/"),
                    "ext": child.suffix.lower().lstrip("."),
                    "size": child.stat().st_size,
                }
            )
            if len(files) >= 200:
                break
    except OSError as exc:
        return {"ok": False, "error": str(exc), "path": str(target), "files": []}
    return {"ok": True, "path": str(target).replace("\\", "/"), "files": files}


def read_viz_flags() -> dict:
    flags_file = WEB_ROOT / "data" / "viz-flags.json"
    default = {"demo": {}, "hidden": {}, "manual": [], "updated_at": ""}
    if not flags_file.exists():
        return default
    try:
        raw = json.loads(flags_file.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            return default
        return {
            "demo": raw.get("demo") if isinstance(raw.get("demo"), dict) else {},
            "hidden": raw.get("hidden") if isinstance(raw.get("hidden"), dict) else {},
            "manual": raw.get("manual") if isinstance(raw.get("manual"), list) else [],
            "updated_at": raw.get("updated_at") or "",
        }
    except json.JSONDecodeError:
        return default


def write_viz_flags(payload: dict) -> dict:
    """Zapis flag demo/hidden/manual tylko do apps/web/data."""
    flags_file = WEB_ROOT / "data" / "viz-flags.json"
    current = read_viz_flags()
    action = (payload.get("action") or "").strip().lower()
    if isinstance(payload.get("flags"), dict):
        incoming = payload["flags"]
        current["demo"] = incoming.get("demo") if isinstance(incoming.get("demo"), dict) else current["demo"]
        current["hidden"] = incoming.get("hidden") if isinstance(incoming.get("hidden"), dict) else current["hidden"]
        if isinstance(incoming.get("manual"), list):
            current["manual"] = incoming["manual"]
    elif action in ("demo", "hidden"):
        key = (payload.get("key") or "").strip()
        if key:
            bucket = current.setdefault(action, {})
            if payload.get("value"):
                bucket[key] = True
            else:
                bucket.pop(key, None)
    elif action == "manual":
        entry = payload.get("entry")
        if isinstance(entry, dict) and entry.get("path"):
            current.setdefault("manual", []).append(entry)
    current["updated_at"] = utc_now()
    flags_file.parent.mkdir(parents=True, exist_ok=True)
    flags_file.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"ok": True, "flags": current, "store": str(flags_file)}


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
        if parsed.path == "/folder-images":
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            if not path:
                self._json(400, {"ok": False, "error": "path_required", "files": []})
                return
            self._json(200, list_folder_images(path))
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
        if parsed.path == "/tag-proposals":
            auto_apply_expired_proposals()
            self._json(200, load_tag_proposals())
            return
        if parsed.path == "/carrier-types":
            self._json(200, _load_json(CARRIER_TYPES_FILE, {"custom_types": {}, "deleted_types": {}}))
            return
        if parsed.path == "/inbox-items":
            self._json(200, _load_json(INBOX_ITEMS_FILE, {"items": []}))
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
        if parsed.path == "/viz-flag":
            self._json(200, write_viz_flags(data if isinstance(data, dict) else {}))
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
        if parsed.path == "/rename-revision-prefix":
            result = create_or_apply_tag_proposal(data if isinstance(data, dict) else {})
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/tag-proposals/decide":
            result = decide_tag_proposal(data if isinstance(data, dict) else {})
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/carrier-types":
            result = manage_carrier_type(data if isinstance(data, dict) else {})
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/viz-request":
            result = create_viz_request(data if isinstance(data, dict) else {})
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/inbox-items/mark-read":
            item_id = (data.get("id") or "").strip()
            store = _load_json(INBOX_ITEMS_FILE, {"items": []})
            for it in store.get("items") or []:
                if it.get("id") == item_id:
                    it["read"] = True
            _save_json(INBOX_ITEMS_FILE, store)
            self._json(200, {"ok": True})
            return
        self._json(404, {"ok": False, "error": "not_found"})


def _tag_proposal_watcher() -> None:
    """Faza 4 (plan: "cron/watcher co ~15 min") - auto-apply propozycji po 72h
    NIEZALEZNIE od tego czy ktos otworzyl panel moderacji (lazy check w GET
    /tag-proposals zostaje jako dodatkowa siec bezpieczenstwa)."""
    while True:
        try:
            n = auto_apply_expired_proposals()
            if n:
                print(f"tag-proposals watcher: auto-applied {n}")
        except Exception as exc:
            print("tag-proposals watcher error:", exc)
        time.sleep(15 * 60)


def main() -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        if dam_db is not None:
            print("sqlite:", dam_db.init_db())
        auth_init_db()
        seed_owner_from_env()
    except Exception as exc:
        print("auth/db seed:", exc)
    threading.Thread(target=_tag_proposal_watcher, daemon=True).start()
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
