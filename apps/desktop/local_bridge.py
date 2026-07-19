"""
DAM ETA local bridge (Windows).
Opens Explorer with /select and appends audit log entries.

Port: 8766 (UI static server stays on 8765).
CORS: allows http://127.0.0.1:8765

Endpoints:
  GET  /health
  POST /reveal   {"path": "M:\\\\...\\\\file.png"}  -> explorer /select
  POST /rename-index {"folder","from_index","to_index","dry_run?"} -> rename index in folder tree
  POST /lifecycle-status {"scope":"product|variant","status":"aktualne|nieaktualne|demo|clear","path",...}
                         -> suffix - F/- X/- D, archiwum, historia previous_name/path
  POST /synology-share {"path": "..."} -> Synology Drive "Uzyskaj lacze" / Get link
  POST /validate-base {"path": "X:\\\\Marketing"} -> checks 3 root folders
  GET  /detect-marketing-bases -> kandydaci na tym komputerze (X:/D:/M:)
  GET/POST /machine-config -> baza Marketing dla tej maszyny (plik JSON)
  POST /auth/register|login  lokalne konta (bcrypt) + sesja urzadzenia
  GET  /auth/me  Authorization: Bearer <token>
  GET  /files/status?root=...  czy ROOT plikow online
  GET  /folder-images?path=...  lista obrazow w folderze Marketing (picker miniatury)
  GET  /folder-browse?path=...&mode=assets  foldery + pliki (AI/PDF/PNG...) do wskazania ELEMENTY
  POST /elements-link  reczne powiazanie folderu/plikow Elementy -> apps/web/data/elements-overrides.json
  POST /viz-flag  demo/hidden/manual -> apps/web/data/viz-flags.json
  POST /thumb-override  wybor miniatury -> apps/web/data/thumb-overrides.json
  POST /audit    {"action","user","path","detail",...}
  GET  /audit?limit=100
  GET  /index/status  mtime file-index + postgres
  POST /index/rebuild  przebudowa indeksu + miniatur (async)
  POST /rename-revision-prefix  kazdy zalogowany: kolejka JSON (tag-proposals).
                                 Natychmiastowy zapis dysku TYLKO sesja admin + admin_mode.
  GET  /tag-proposals  lista kolejki (po TTL: eskalacja do inbox, BEZ auto-zapisu)
  POST /tag-proposals/decide  zatwierdz/odrzuc/pick_other - TYLKO sesja admin
  GET/POST /carrier-types  wlasne typy nosnikow (dodaj/usun + reassign historii)
  GET  /program-instructions  newralgiczne reguly programu (KV + lokalny cache)
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
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from auth_store import (
    init_db as auth_init_db,
    list_users,
    login as auth_login,
    logout as auth_logout,
    register_user,
    rehydrate_session as auth_rehydrate,
    resolve_session,
    seed_owner_from_env,
    users_count,
)

try:
    import oauth_integrations
except ImportError:
    oauth_integrations = None  # type: ignore

try:
    import dam_db
except ImportError:
    dam_db = None  # type: ignore

try:
    import lifecycle_status as lifecycle_status_mod
except ImportError:
    lifecycle_status_mod = None  # type: ignore

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
        # #region agent log
        try:
            with open(
                Path(__file__).resolve().parents[2] / "debug-a78fa0.log",
                "a",
                encoding="utf-8",
            ) as _f:
                _f.write(
                    json.dumps(
                        {
                            "sessionId": "a78fa0",
                            "hypothesisId": "B",
                            "location": "local_bridge.py:reveal_in_explorer",
                            "message": "path_not_found",
                            "data": {"path_tail": target[-80:], "exists": False},
                            "timestamp": int(time.time() * 1000),
                            "runId": "pre-fix",
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        return {"ok": False, "error": "path_not_found", "path": target}
    if not _is_under_marketing(Path(target)):
        # #region agent log
        try:
            with open(
                Path(__file__).resolve().parents[2] / "debug-a78fa0.log",
                "a",
                encoding="utf-8",
            ) as _f:
                _f.write(
                    json.dumps(
                        {
                            "sessionId": "a78fa0",
                            "hypothesisId": "B",
                            "location": "local_bridge.py:reveal_in_explorer",
                            "message": "path_outside_marketing",
                            "data": {
                                "path_tail": target[-80:],
                                "drive": target[:3],
                                "is_documents": "Dokumenty" in target or "Documents" in target,
                            },
                            "timestamp": int(time.time() * 1000),
                            "runId": "pre-fix",
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        return {"ok": False, "error": "path_outside_marketing", "path": target}

    # Bez shell=True (unikaj injection przez cudzyslowy w sciezce).
    # WAŻNE: ["/select," + path] ze spacjami = Windows otwiera Dokumenty.
    # Poprawnie: osobny argument sciezki po "/select,".
    # Foldery typu "6300084.00" maja kropke - NIE wolno traktowac ich jako plik.
    _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
    if os.path.isfile(target):
        args = ["explorer", "/select,", target]
        mode = "select"
    elif os.path.isdir(target):
        args = ["explorer", target]
        mode = "open"
    elif is_probably_file(target):
        args = ["explorer", "/select,", target]
        mode = "select"
    else:
        args = ["explorer", target]
        mode = "open"

    try:
        # #region agent log
        try:
            with open(
                Path(__file__).resolve().parents[2] / "debug-a78fa0.log",
                "a",
                encoding="utf-8",
            ) as _f:
                _f.write(
                    json.dumps(
                        {
                            "sessionId": "a78fa0",
                            "hypothesisId": "E",
                            "location": "local_bridge.py:reveal_in_explorer",
                            "message": "launching explorer",
                            "data": {
                                "mode": mode,
                                "path_tail": target[-90:],
                                "drive": target[:3],
                                "is_dir": os.path.isdir(target),
                                "is_file": os.path.isfile(target),
                                "args_len": len(args),
                                "select_split": mode == "select" and len(args) == 3,
                                "creationflags": int(_no_win),
                            },
                            "timestamp": int(time.time() * 1000),
                            "runId": "post-fix",
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        subprocess.Popen(
            args,
            shell=False,
            creationflags=_no_win,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return {"ok": True, "path": target, "command": mode}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "path": target}


def invoke_synology_share(target: str) -> dict:
    """Open Synology Drive Client share dialog (context menu: Uzyskaj lacze / Get link)."""
    target = normalize_path(target)
    if not os.path.exists(target):
        return {"ok": False, "error": "path_not_found", "path": target}
    if not _is_under_marketing(Path(target)):
        return {"ok": False, "error": "path_outside_marketing", "path": target}
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
        _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=45,
            check=False,
            creationflags=_no_win,
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
        _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        rc = subprocess.call(
            [sys.executable, str(BUILD_INDEX)],
            creationflags=_no_win,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
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
        if rc == 0:
            try:
                import meta_store

                meta_store.sync_from_file_index()
            except Exception as meta_exc:  # noqa: BLE001
                append_audit(
                    {
                        "action": "meta_sync",
                        "user": "system",
                        "detail": str(meta_exc),
                        "meta": {},
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
    if not dry_run and renamed and len(errors) == 0:
        path_renames = []
        for item in renamed:
            old_p = Path(normalize_path(item.get("from") or ""))
            new_p = Path(normalize_path(item.get("to") or ""))
            path_renames.append(
                {
                    "old_path": item.get("from"),
                    "new_path": item.get("to"),
                    "old_name": old_p.name,
                    "new_name": new_p.name,
                }
            )
        new_folder = str(root)
        for item in renamed:
            if normalize_path(item.get("from") or "") == normalize_path(folder):
                new_folder = item.get("to") or new_folder
                break
        append_change_log(
            {
                "action": "rename_index",
                "category": "index",
                "index_from": from_index,
                "index_to": to_index,
                "folder": new_folder,
                "path_renames": path_renames,
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
    data = _load_json(overrides_file, {"overrides": {}})
    if "overrides" not in data or not isinstance(data["overrides"], dict):
        data["overrides"] = {}
    data["overrides"][path_key] = entry
    m = re.search(r"(\d{7}(?:\.\d+)?)", path_key)
    if m:
        data["overrides"][m.group(1)] = entry
    data["updated_at"] = utc_now()
    _save_json(overrides_file, data)
    return {"ok": True, "path": path_key, "entry": entry}


ELEMENTS_LINK_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".tif", ".tiff",
    ".ai", ".psd", ".indd", ".pdf", ".zip", ".rar", ".7z",
    ".svg", ".eps", ".pptx", ".ppt",
}


def _count_elements_files(target: Path) -> int:
    """Policz pliki elementow w folderze (max 2 poziomy w dol)."""
    if target.is_file():
        return 1 if target.suffix.lower() in ELEMENTS_LINK_EXTS else 0
    if not target.is_dir():
        return 0
    n = 0
    try:
        for child in target.iterdir():
            if child.is_file() and child.suffix.lower() in ELEMENTS_LINK_EXTS:
                n += 1
            elif child.is_dir():
                try:
                    for nested in child.iterdir():
                        if nested.is_file() and nested.suffix.lower() in ELEMENTS_LINK_EXTS:
                            n += 1
                        if n >= 500:
                            return n
                except OSError:
                    pass
            if n >= 500:
                return n
    except OSError:
        return n
    return n


def upsert_elements_link(payload: dict) -> dict:
    """Reczne powiazanie Elementy/skladniki: folder lub plik wskazany przez usera/admina."""
    store = WEB_ROOT / "data" / "elements-overrides.json"
    data = _load_json(store, {"links": {}, "updated_at": ""})
    if "links" not in data or not isinstance(data["links"], dict):
        data["links"] = {}
    action = (payload.get("action") or "link").strip().lower()
    rev_key = (payload.get("revision_path") or payload.get("path_key") or "").strip().replace("\\", "/")
    index_key = (payload.get("index") or "").strip()
    if action == "unlink":
        if not rev_key and not index_key:
            return {"ok": False, "error": "revision_path_or_index_required"}
        removed = False
        if rev_key and rev_key in data["links"]:
            data["links"].pop(rev_key, None)
            removed = True
        if index_key and index_key in data["links"]:
            data["links"].pop(index_key, None)
            removed = True
        # usun tez wpisy wskazujace ten sam folder (gdy klucz indeksowy)
        if rev_key:
            for k, v in list(data["links"].items()):
                if isinstance(v, dict) and str(v.get("revision_path") or "").replace("\\", "/") == rev_key:
                    data["links"].pop(k, None)
                    removed = True
        data["updated_at"] = utc_now()
        _save_json(store, data)
        return {"ok": True, "action": "unlink", "removed": removed, "links": data["links"]}

    target_raw = (payload.get("target_path") or payload.get("path") or "").strip()
    if not rev_key or not target_raw:
        return {"ok": False, "error": "revision_path_and_target_required"}
    target = Path(normalize_path(target_raw))
    if not target.exists():
        return {"ok": False, "error": "path_not_found", "path": str(target)}
    if not _is_under_marketing(target if target.is_dir() else target.parent):
        return {"ok": False, "error": "path_outside_marketing", "path": str(target)}
    kind = "folder" if target.is_dir() else "file"
    folder_path = target if target.is_dir() else target.parent
    file_count = _count_elements_files(target if target.is_dir() else folder_path)
    entry = {
        "path": str(target).replace("\\", "/"),
        "folder": str(folder_path).replace("\\", "/"),
        "kind": kind,
        "file_count": file_count,
        "revision_path": rev_key,
        "index": index_key,
        "product_id": (payload.get("product_id") or "").strip(),
        "linked_by": (payload.get("linked_by") or "user").strip() or "user",
        "linked_at": utc_now(),
        "note": (payload.get("note") or "").strip(),
    }
    data["links"][rev_key] = entry
    if index_key:
        data["links"][index_key] = entry
    data["updated_at"] = utc_now()
    _save_json(store, data)
    return {"ok": True, "action": "link", "entry": entry, "store": str(store)}


def list_folder_browse(path: str, mode: str = "assets") -> dict:
    """Lista folderow + plikow (nie tylko obrazow) do wskazania ELEMENTY w przegladarce."""
    target = Path(normalize_path(path or ""))
    if not target.exists():
        return {"ok": False, "error": "path_not_found", "path": str(target), "files": [], "folders": []}
    if target.is_file():
        target = target.parent
    if not target.is_dir():
        return {"ok": False, "error": "not_a_directory", "path": str(target), "files": [], "folders": []}
    if not _is_under_marketing(target):
        return {"ok": False, "error": "path_outside_marketing", "path": str(target), "files": [], "folders": []}
    exts = ELEMENTS_LINK_EXTS if (mode or "assets") == "assets" else IMAGE_EXTS
    files: list[dict] = []
    folders: list[dict] = []
    try:
        for child in sorted(target.iterdir(), key=lambda p: p.name.lower()):
            if child.is_dir():
                if len(folders) < 200:
                    folders.append({"name": child.name, "path": str(child).replace("\\", "/")})
                continue
            if not child.is_file():
                continue
            if child.suffix.lower() not in exts:
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
        return {"ok": False, "error": str(exc), "path": str(target), "files": [], "folders": []}
    parent = target.parent
    parent_ok = str(parent) != str(target) and _is_under_marketing(parent)
    return {
        "ok": True,
        "path": str(target).replace("\\", "/"),
        "files": files,
        "folders": folders,
        "file_count": _count_elements_files(target),
        "parent": str(parent).replace("\\", "/") if parent_ok else "",
        "mode": mode or "assets",
    }


TAG_PROPOSALS_FILE = WEB_ROOT / "data" / "tag-proposals.json"
CARRIER_TYPES_FILE = WEB_ROOT / "data" / "carrier-types.json"
ASSIGNMENT_LOG_FILE = WEB_ROOT / "data" / "carrier-assignment-log.json"
CHANGE_LOG_FILE = WEB_ROOT / "data" / "change-log.json"
LIFECYCLE_STORE_FILE = WEB_ROOT / "data" / "lifecycle-status.json"
PRODUCT_STATUS_FILE = WEB_ROOT / "data" / "product-status.json"
PROPOSAL_TTL_HOURS = 72


def mirror_lifecycle_to_product_status(result: dict, payload: dict) -> None:
    """Dopisz status do product-status.json (revisions + products) po FS change."""
    data = _load_json(PRODUCT_STATUS_FILE, {"updated_at": "", "revisions": {}, "products": {}})
    data.setdefault("revisions", {})
    data.setdefault("products", {})
    status = result.get("status") or "clear"
    letter = result.get("letter")
    note = f"Lifecycle {letter or 'clear'}"
    scope = (result.get("scope") or payload.get("scope") or "").lower()
    if scope == "variant":
        keys = [
            result.get("final_variant_path") or "",
            payload.get("path") or "",
            payload.get("revision_index") or payload.get("index") or "",
        ]
        for key in keys:
            key = str(key or "").strip()
            if not key:
                continue
            data["revisions"][key] = {"status": status, "note": note, "letter": letter}
    else:
        pid = str(payload.get("product_id") or "").strip()
        ppath = result.get("final_product_path") or payload.get("path") or ""
        if pid:
            data["products"][pid] = {
                "status": status,
                "note": note,
                "letter": letter,
                "path": ppath,
            }
        if ppath:
            data["products"][ppath] = {
                "status": status,
                "note": note,
                "letter": letter,
                "path": ppath,
            }
    data["updated_at"] = utc_now()
    _save_json(PRODUCT_STATUS_FILE, data)

# Slot folderow w rewizji - tu rename'ujemy AI/PDF/wizki (Fala D).
_REVISION_FILE_SLOT_HINTS = (
    "PROJEKT", "PROJECT", "DRUK", "PRINT", "WIZKI", "WIZUAL", "VISUAL", "PAKIET",
)
_FILE_DATE_RE = re.compile(r"(?:_|-)(20\d{2})(?:_|-)(\d{2})(?:_|-)(\d{2})")
_FILE_INDEX_RE = re.compile(r"(6300\d{3})(?:\.(\d{2}))?")
_FILE_BRAND_RE = re.compile(r"^(DK|GC)[_-]", re.I)
_FILE_ROLE_RE = re.compile(r"[_-](F|FQ|PREV|PREVIEW)$", re.I)
_FILE_LANG_RE = re.compile(r"[_-]([A-Za-z]{2}(?:[_-][A-Za-z]{2})+)$")
_FILE_CARRIER_TOKENS = sorted(
    {
        "DOY6X", "KAR6X", "DOYPACK", "KARTON", "BATON", "FOLIA", "REKAW", "SASZETKA",
        "DOY", "KAR", "BAT", "BAR", "MINI", "FOL", "FOIL", "SASZ", "TUBA", "ETY",
        "SHOT", "OBW", "SLEEVE",
    },
    key=len,
    reverse=True,
)

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

# Mapowanie kodu API (BAT/DOY) -> prefiks folderu na dysku.
# ZRODLO PRAWDY: apps/web/data/naming-dictionary.json (policy + carriers[].short)
# + kopia w Postgres dam_kv_store / naming-dictionary. Pelne DOYPACK/BATON w UI;
# na dysku zawsze skrot (DOY/BAT/FOL). Stare foldery z pelnym prefiksem
# wykrywa KNOWN_CARRIER_PREFIXES przy rename.
NAMING_DICTIONARY_FILE = WEB_ROOT / "data" / "naming-dictionary.json"
APP_SETTINGS_FILE = WEB_ROOT / "data" / "app-settings.json"
PROGRAM_INSTRUCTIONS_FILE = WEB_ROOT / "data" / "program-instructions.json"
PRODUCT_CATALOG_FILE = WEB_ROOT / "data" / "product-catalog.json"
PRODUCT_PRICES_CACHE_FILE = WEB_ROOT / "data" / "product-prices-cache.json"
BULK_PACKAGING_FILE = WEB_ROOT / "data" / "bulk-packaging.json"
SHOP_CATEGORIES_FILE = WEB_ROOT / "data" / "shop-categories.json"
BRANDING_INDEX_FILE = WEB_ROOT / "data" / "branding-index.json"
BRANDING_STATUS_FILE = WEB_ROOT / "data" / "branding-build-status.json"
BRANDING_RECOGNIZE_STATUS_FILE = WEB_ROOT / "data" / "branding-recognize-status.json"
WYKROJNIKI_REGISTRY_FILE = WEB_ROOT / "data" / "wykrojniki-registry.json"
BUILD_BRANDING_INDEX = WEB_ROOT / "scripts" / "build-branding-index.py"
FETCH_PRODUCT_PRICES = WEB_ROOT / "scripts" / "fetch-product-prices.py"
IMPORT_WYKROJNIKI = WEB_ROOT / "scripts" / "import-wykrojniki-xlsx.py"
ENRICH_BRANDING_RECOGNIZE = WEB_ROOT / "scripts" / "enrich-branding-recognize.py"

_CARRIER_FOLDER_PREFIX_FALLBACK = {
    "BAT": "BAT",
    "BAR": "BAT",
    "MINI": "MINI",
    "DOY": "DOY",
    "DOY6X": "DOY6X",
    "KAR": "KAR",
    "KAR6X": "KAR6X",
    "FOL": "FOL",
    "FOIL": "FOL",
    "FOLIA": "FOL",
    "REKAW": "REKAW",
    "SLEEVE": "REKAW",
    "SASZ": "SASZ",
    "OBW": "OBW",
    "ETY": "ETY",
    "ETY-BUT": "ETY-BUT",
    "ETY-SLO": "ETY-SLO",
    "TUBA": "TUBA",
    "SHOT": "SHOT",
    "BIGPAK": "BIGPAK",
    "WIZKA": "WIZKA",
    "NONE": "",
}


def load_carrier_folder_prefix(dict_data: dict | None = None) -> dict[str, str]:
    """Prefiks folderu z naming-dictionary.policy + carriers[].short|label_pl."""
    data = dict_data
    if data is None:
        try:
            if NAMING_DICTIONARY_FILE.is_file():
                data = json.loads(NAMING_DICTIONARY_FILE.read_text(encoding="utf-8"))
            else:
                data = {}
        except (OSError, json.JSONDecodeError):
            data = {}
    policy = (data or {}).get("policy") or {}
    use_short = str(policy.get("carrier_prefix_on_disk") or "short").lower() == "short"
    out = dict(_CARRIER_FOLDER_PREFIX_FALLBACK)
    for code, meta in ((data or {}).get("carriers") or {}).items():
        if not isinstance(meta, dict):
            continue
        code_u = str(code).strip().upper()
        short = str(meta.get("short") or code_u).strip().upper()
        label = str(meta.get("label_pl") or code_u).strip()
        prefix = short if use_short else label
        out[code_u] = prefix
        for alias in meta.get("aliases") or []:
            a = str(alias).strip().upper()
            if a:
                out[a] = prefix
    out["NONE"] = ""
    return out


CARRIER_FOLDER_PREFIX = load_carrier_folder_prefix()


def reload_naming_policy_from_disk() -> dict:
    """Odswiez CARRIER_FOLDER_PREFIX po pull KV / zapisie slownika."""
    global CARRIER_FOLDER_PREFIX
    CARRIER_FOLDER_PREFIX = load_carrier_folder_prefix()
    return {
        "ok": True,
        "prefix_sample": {
            "DOY": CARRIER_FOLDER_PREFIX.get("DOY"),
            "FOLIA": CARRIER_FOLDER_PREFIX.get("FOLIA"),
            "BAT": CARRIER_FOLDER_PREFIX.get("BAT"),
        },
    }


# Tier 2 (ADR-009): te pliki JSON sa wspolne w Postgres dam_kv_store.
# Lokalny plik = cache (odswiezany natychmiast po wlasnym zapisie + co 30 min).
KV_STORE_KEYS = frozenset({
    "product-aliases",
    "product-name-pl",
    "product-people",
    "naming-dictionary",
    "app-settings",
    "program-instructions",
    "tag-proposals",
    "carrier-types",
    "carrier-assignment-log",
    "change-log",
    "lifecycle-status",
    "product-status",
    "notification-groups",
    "inbox-items",
    "carrier-overrides",
    "elements-overrides",
    "viz-flags",
    "thumb-overrides",
})


def _path_to_store_key(path: Path) -> str | None:
    name = path.name
    if not name.endswith(".json"):
        return None
    key = name[:-5]
    return key if key in KV_STORE_KEYS else None


def _pg_available() -> bool:
    try:
        import pg_db

        return pg_db.is_configured()
    except Exception:
        return False


def _load_json(path: Path, default):
    """Czytaj lokalny cache. (Prawda jest w PG - watcher odswieza co 30 min.)"""
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def _save_json(path: Path, data) -> None:
    """Zapis lokalnego cache + (gdy PG skonfigurowany) upsert do dam_kv_store
    z SELECT ... FOR UPDATE - chroni przed utrata rownoleglych decyzji moderacji."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    store_key = _path_to_store_key(path)
    if not store_key or not _pg_available():
        return
    try:
        import pg_db

        conn = pg_db.connect()
        try:
            cur = conn.cursor()
            # Blokada wiersza - druga stacja poczeka zanim nadpisze
            pg_db.kv_get_for_update(store_key, None, cur)
            pg_db.kv_set_in_txn(store_key, data, updated_by="local_bridge", cur=cur)
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        print(f"kv_store save warning ({store_key}):", exc)


def _pull_kv_cache_from_postgres() -> int:
    """Pobierz wszystkie Tier-2 stores z PG i nadpisz lokalne pliki cache. Zwraca liczbe."""
    if not _pg_available():
        return 0
    try:
        import pg_db
    except Exception:
        return 0
    n = 0
    try:
        keys = pg_db.kv_all_keys()
    except Exception as exc:
        print("kv_cache pull error (list):", exc)
        return 0
    for store_key in keys:
        if store_key not in KV_STORE_KEYS:
            continue
        try:
            payload = pg_db.kv_get(store_key, None)
            if payload is None:
                continue
            # Nie cofaj lokalnego seedu do starszej wersji z PG
            if store_key in ("naming-dictionary", "program-instructions") and isinstance(
                payload, dict
            ):
                local_path = WEB_ROOT / "data" / f"{store_key}.json"
                local = _load_json(local_path, {})
                local_ver = int((local or {}).get("version") or 0)
                remote_ver = int(payload.get("version") or 0)
                if local_ver > remote_ver:
                    continue
                # program-instructions: wiecej instrukcji lokalnie = nowszy seed
                if store_key == "program-instructions":
                    local_n = len((local or {}).get("instructions") or [])
                    remote_n = len(payload.get("instructions") or [])
                    if local_n > remote_n and local_ver >= remote_ver:
                        continue
            path = WEB_ROOT / "data" / f"{store_key}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            n += 1
        except Exception as exc:
            print(f"kv_cache pull error ({store_key}):", exc)
    if n:
        reload_naming_policy_from_disk()
    return n


def _seed_naming_policy_to_postgres() -> None:
    """Wypchnij naming-dictionary + app-settings + program-instructions do dam_kv_store."""
    naming: dict = {}
    if NAMING_DICTIONARY_FILE.is_file():
        try:
            naming = json.loads(NAMING_DICTIONARY_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            naming = {}
    policy = naming.get("policy") or {}

    instructions: dict = {}
    if PROGRAM_INSTRUCTIONS_FILE.is_file():
        try:
            instructions = json.loads(PROGRAM_INSTRUCTIONS_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            instructions = {}

    instr_list = instructions.get("instructions") if isinstance(instructions, dict) else []
    critical_ids = [
        i.get("id")
        for i in (instr_list or [])
        if isinstance(i, dict) and i.get("priority") == "critical" and i.get("id")
    ]

    app_settings = {
        "version": 2,
        "naming": {
            "source_kv": "naming-dictionary",
            "carrier_display_in_ui": policy.get("carrier_display_in_ui") or "label_pl",
            "carrier_prefix_on_disk": policy.get("carrier_prefix_on_disk") or "short",
            "description_pl": policy.get("description_pl") or "",
            "dictionary_version": naming.get("version"),
        },
        "instructions": {
            "source_kv": "program-instructions",
            "version": instructions.get("version") if instructions else 0,
            "count": len(instr_list or []),
            "critical_ids": critical_ids,
            "settings_anchor": "settings.html#damProgramInstructions",
        },
        "updated_at": policy.get("updated_at")
        or (instructions.get("updated_at") if instructions else "")
        or "",
    }
    _save_json(APP_SETTINGS_FILE, app_settings)
    if naming:
        _save_json(NAMING_DICTIONARY_FILE, naming)
    if instructions:
        _save_json(PROGRAM_INSTRUCTIONS_FILE, instructions)
    # Historia operacji / statusow / slownik EN->PL - tez do KV
    name_pl_file = WEB_ROOT / "data" / "product-name-pl.json"
    people_file = WEB_ROOT / "data" / "product-people.json"
    for path in (
        CHANGE_LOG_FILE,
        LIFECYCLE_STORE_FILE,
        PRODUCT_STATUS_FILE,
        name_pl_file,
        people_file,
    ):
        if path.is_file():
            try:
                _save_json(path, _load_json(path, {}))
            except Exception as exc:  # noqa: BLE001
                print(f"kv seed skip {path.name}:", exc)
    reload_naming_policy_from_disk()
    print(
        "program policy seeded:",
        f"ui={app_settings['naming']['carrier_display_in_ui']}",
        f"disk={app_settings['naming']['carrier_prefix_on_disk']}",
        f"instructions={app_settings['instructions']['count']}",
        f"critical={len(critical_ids)}",
        f"DOY->{CARRIER_FOLDER_PREFIX.get('DOY')}",
    )


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


def get_last_assignment(revision_path: str) -> dict | None:
    """Ostatnie zatwierdzone przypisanie typu dla sciezki (lub poprzedniej nazwy folderu)."""
    log = _load_json(ASSIGNMENT_LOG_FILE, {"entries": []})
    needle = normalize_path(revision_path).lower()
    parent = str(Path(normalize_path(revision_path)).parent).lower()
    last = None
    for e in log.get("entries") or []:
        rp = normalize_path(e.get("revision_path") or "").lower()
        if rp == needle or (rp.startswith(parent + "\\") or rp.startswith(parent + "/")):
            # Match exact path or same product folder (folder rename changes leaf)
            if rp == needle or Path(rp).parent.as_posix().lower() == Path(needle).parent.as_posix().lower():
                last = e
    return last


def append_change_log(entry: dict) -> dict:
    """Fala E: chronologiczny change-log (rename folder/plikow) z before/after."""
    data = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    data.setdefault("entries", [])
    data.setdefault("redo", [])
    row = {
        "id": f"chg_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "ts": utc_now(),
        **entry,
    }
    data["entries"].append(row)
    # Nowa akcja kasuje galaz redo
    data["redo"] = []
    _save_json(CHANGE_LOG_FILE, data)
    return row


def load_change_log(limit: int = 50) -> dict:
    data = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    entries = list(data.get("entries") or [])
    redo = list(data.get("redo") or [])
    return {
        "ok": True,
        "entries": entries[-max(1, min(limit, 200)) :],
        "redo": redo[-max(1, min(limit, 50)) :],
        "can_undo": bool(entries),
        "can_redo": bool(redo),
    }


def _extract_index_from_folder(folder_name: str) -> str:
    m = _FILE_INDEX_RE.search(folder_name or "")
    if not m:
        return ""
    base = m.group(1)
    rev = m.group(2) or "00"
    return f"{base}.{rev}"


def build_carrier_filename(name: str, carrier_code: str, index: str) -> str | None:
    """GC_balls_cocoa-lime_2024_07_05_GB_AR.ai
    -> GC-DOY-balls_cocoa-lime - GB_AR - 6300489.00.ai
    (Fala D: wstaw kod nosnika, usun date, doklej indeks)."""
    if "." not in name:
        return None
    stem, ext = name.rsplit(".", 1)
    bm = _FILE_BRAND_RE.match(stem)
    if not bm:
        return None
    brand = bm.group(1).upper()
    rest = stem[bm.end() :]

    rest_u = rest.upper()
    for tok in _FILE_CARRIER_TOKENS:
        if rest_u.startswith(tok + "_") or rest_u.startswith(tok + "-"):
            rest = rest[len(tok) + 1 :]
            break

    rest = _FILE_DATE_RE.sub("", rest)

    role = ""
    rm = _FILE_ROLE_RE.search(rest)
    if rm:
        role = rm.group(1)
        rest = rest[: rm.start()]

    file_index = (index or "").strip()
    im = _FILE_INDEX_RE.search(rest)
    if im:
        if not file_index:
            file_index = f"{im.group(1)}.{im.group(2) or '00'}"
        # Usun indeks z srodka/konca (z poprzedzajacym separatorem jesli jest)
        start = im.start()
        if start > 0 and rest[start - 1] in "_-":
            start -= 1
        rest = rest[:start] + rest[im.end() :]

    lang = ""
    lm = _FILE_LANG_RE.search(rest)
    if lm:
        lang = lm.group(1).replace("-", "_")
        rest = rest[: lm.start()]

    product = rest.strip("_- ")
    product = re.sub(r"[_-]{2,}", "_", product)
    if not product:
        product = "produkt"

    code = (carrier_code or "").strip().upper()
    if code in ("NONE", "BRAK", "BRAK_TYPU", "__NONE__", ""):
        mid = f"{brand}-{product}"
    else:
        mid = f"{brand}-{code}-{product}"

    parts = [mid]
    if lang:
        parts.append(lang)
    if file_index:
        if "." not in file_index:
            file_index = f"{file_index}.00"
        idx_bit = file_index + (f"_{role}" if role else "")
        parts.append(idx_bit)
    elif role:
        parts.append(role)

    return " - ".join(parts) + "." + ext


def _iter_revision_files(revision_dir: Path):
    """Pliki w slotach PROJEKT/DRUK/WIZKI (1 poziom + pliki w root rewizji)."""
    if not revision_dir.is_dir():
        return
    try:
        children = list(revision_dir.iterdir())
    except OSError:
        return
    for child in children:
        if child.is_file():
            yield child
            continue
        if not child.is_dir():
            continue
        name_u = child.name.upper()
        if not any(h in name_u for h in _REVISION_FILE_SLOT_HINTS):
            continue
        try:
            for f in child.iterdir():
                if f.is_file():
                    yield f
        except OSError:
            continue


def rename_revision_files_on_disk(
    revision_path: str,
    new_code: str,
    *,
    dry_run: bool = False,
) -> dict:
    """Fala D: rename AI/PDF/PNG w drzewie rewizji wg reguly brand-carrier-product - lang - index."""
    p = Path(normalize_path(revision_path))
    if not p.is_dir():
        return {"ok": False, "error": "revision_not_found", "renames": []}
    index = _extract_index_from_folder(p.name)
    planned: list[dict] = []
    for f in _iter_revision_files(p):
        new_name = build_carrier_filename(f.name, new_code, index)
        if not new_name or new_name == f.name:
            continue
        dest = f.parent / new_name
        planned.append({
            "old_path": str(f),
            "new_path": str(dest),
            "old_name": f.name,
            "new_name": new_name,
        })

    if dry_run:
        return {"ok": True, "dry_run": True, "renames": planned, "count": len(planned)}

    done = []
    errors = []
    for item in planned:
        src = Path(item["old_path"])
        dest = Path(item["new_path"])
        if dest.exists() and dest != src:
            errors.append({"path": str(src), "error": "target_exists", "target": str(dest)})
            continue
        try:
            src.rename(dest)
            done.append(item)
        except OSError as exc:
            errors.append({"path": str(src), "error": str(exc)})
    return {
        "ok": len(errors) == 0,
        "dry_run": False,
        "renames": done,
        "errors": errors,
        "count": len(done),
    }


def _apply_path_renames_forward(path_renames: list) -> list:
    """Ponow: old_path -> new_path (kolejnosc jak przy apply)."""
    reverses = []
    for pr in path_renames or []:
        src = Path(normalize_path(pr.get("old_path") or ""))
        dest = Path(normalize_path(pr.get("new_path") or ""))
        if not src.exists():
            reverses.append({"ok": False, "error": "missing", "from": str(src), "to": str(dest)})
            continue
        if dest.exists():
            reverses.append({"ok": False, "error": "target_exists", "from": str(src), "to": str(dest)})
            continue
        try:
            src.rename(dest)
            reverses.append({"ok": True, "from": str(src), "to": str(dest)})
        except OSError as exc:
            reverses.append({"ok": False, "error": str(exc), "from": str(src), "to": str(dest)})
    return reverses


def _apply_path_renames_reverse(path_renames: list) -> list:
    """Cofnij: new_path -> old_path (odwrotna kolejnosc)."""
    reverses = []
    for pr in reversed(path_renames or []):
        src = Path(normalize_path(pr.get("new_path") or ""))
        dest = Path(normalize_path(pr.get("old_path") or ""))
        if not src.exists():
            reverses.append({"ok": False, "error": "missing", "from": str(src), "to": str(dest)})
            continue
        if dest.exists():
            reverses.append({"ok": False, "error": "target_exists", "from": str(src), "to": str(dest)})
            continue
        try:
            src.rename(dest)
            reverses.append({"ok": True, "from": str(src), "to": str(dest)})
        except OSError as exc:
            reverses.append({"ok": False, "error": str(exc), "from": str(src), "to": str(dest)})
    return reverses


def undo_last_change(actor: str = "") -> dict:
    """Cofnij ostatni wpis change-log (rename folder + pliki) na dysku."""
    data = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    entries = data.get("entries") or []
    if not entries:
        return {"ok": False, "error": "nothing_to_undo"}
    entry = entries.pop()
    data["redo"] = data.get("redo") or []
    data["redo"].append(entry)

    reverses = []
    action = str(entry.get("action") or "")
    path_renames = entry.get("path_renames") or []

    if action == "rename_index" or path_renames:
        reverses = _apply_path_renames_reverse(path_renames)
    else:
        # Najpierw pliki (new->old), potem folder
        for fr in reversed(entry.get("file_renames") or []):
            src = Path(normalize_path(fr.get("new_path") or ""))
            dest = Path(normalize_path(fr.get("old_path") or ""))
            if src.is_file() and not dest.exists():
                try:
                    src.rename(dest)
                    reverses.append({"ok": True, "from": str(src), "to": str(dest)})
                except OSError as exc:
                    reverses.append({"ok": False, "error": str(exc), "from": str(src)})
            else:
                reverses.append({"ok": False, "error": "missing_or_exists", "from": str(src), "to": str(dest)})

        folder = entry.get("folder_rename") or {}
        if folder.get("new_path") and folder.get("old_path"):
            src = Path(normalize_path(folder["new_path"]))
            dest = Path(normalize_path(folder["old_path"]))
            if src.is_dir() and not dest.exists():
                try:
                    src.rename(dest)
                    reverses.append({"ok": True, "from": str(src), "to": str(dest), "kind": "folder"})
                except OSError as exc:
                    reverses.append({"ok": False, "error": str(exc), "kind": "folder"})

    folder = entry.get("folder_rename") or {}
    _save_json(CHANGE_LOG_FILE, data)
    undo_path = (
        folder.get("old_path")
        or entry.get("folder")
        or (path_renames[0].get("old_path") if path_renames else "")
        or ""
    )
    append_audit({
        "action": "change_log_undo",
        "path": undo_path,
        "detail": entry.get("id") or "",
        "user": actor or "system",
    })
    return {"ok": True, "undone": entry, "reverses": reverses}


def redo_last_change(actor: str = "") -> dict:
    """Ponow ostatnio cofniety wpis change-log."""
    data = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    redo = data.get("redo") or []
    if not redo:
        return {"ok": False, "error": "nothing_to_redo"}
    entry = redo.pop()
    reverses = []
    action = str(entry.get("action") or "")
    path_renames = entry.get("path_renames") or []

    if action == "rename_index" or path_renames:
        reverses = _apply_path_renames_forward(path_renames)
    else:
        folder = entry.get("folder_rename") or {}
        if folder.get("old_path") and folder.get("new_path"):
            src = Path(normalize_path(folder["old_path"]))
            dest = Path(normalize_path(folder["new_path"]))
            if src.is_dir() and not dest.exists():
                try:
                    src.rename(dest)
                    reverses.append({"ok": True, "from": str(src), "to": str(dest), "kind": "folder"})
                except OSError as exc:
                    reverses.append({"ok": False, "error": str(exc), "kind": "folder"})
        base = Path(normalize_path(folder.get("new_path") or folder.get("old_path") or ""))
        for fr in entry.get("file_renames") or []:
            old_name = fr.get("old_name") or Path(fr.get("old_path") or "").name
            new_name = fr.get("new_name") or Path(fr.get("new_path") or "").name
            found = None
            if base.is_dir():
                for f in _iter_revision_files(base):
                    if f.name == old_name:
                        found = f
                        break
            if found:
                dest = found.parent / new_name
                try:
                    if not dest.exists():
                        found.rename(dest)
                        reverses.append({"ok": True, "from": str(found), "to": str(dest)})
                except OSError as exc:
                    reverses.append({"ok": False, "error": str(exc)})

    folder = entry.get("folder_rename") or {}
    data.setdefault("entries", []).append(entry)
    data["redo"] = redo
    _save_json(CHANGE_LOG_FILE, data)
    redo_path = folder.get("new_path") or entry.get("folder") or ""
    append_audit({
        "action": "change_log_redo",
        "path": redo_path,
        "detail": entry.get("id") or "",
        "user": actor or "system",
    })
    return {"ok": True, "redone": entry, "reverses": reverses}


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


def rename_revision_prefix_on_disk(
    revision_path: str,
    new_code: str,
    *,
    rename_files: bool = True,
    dry_run_files: bool = False,
) -> dict:
    """Zamienia prefiks folderu rewizji na dysku (2026-07-18, P6/P7) + opcjonalnie
    pliki AI/PDF/wizki (Fala D). Folder: jezyki/gramatura/data bez zmian."""
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
                "file_renames": [],
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

    file_result = {"renames": [], "count": 0}
    if rename_files:
        file_result = rename_revision_files_on_disk(
            str(dest), new_code_clean, dry_run=dry_run_files
        )

    return {
        "ok": True,
        "old_path": str(p),
        "new_path": str(dest),
        "old_name": name,
        "new_name": new_name,
        "file_renames": file_result.get("renames") or [],
        "file_rename_count": file_result.get("count") or 0,
        "file_rename_errors": file_result.get("errors") or [],
        "carrier_guessed": False,
    }


def create_or_apply_tag_proposal(
    payload: dict,
    *,
    session_role: str = "user",
    session_email: str = "",
    admin_mode: bool = False,
) -> dict:
    """Propose -> admin apply (ADR-009 / memory §86).

    Kazdy zalogowany pisze TYLKO do kolejki JSON (tag-proposals + inbox).
    Natychmiastowy zapis na dysk / kanoniczna baza: wylacznie sesja role=admin
    z wlaczonym trybem admina. Body.role / body.admin_mode SA IGNOROWANE
    (anti-spoof) - privilege bierze sie z sesji Bearer.
    """
    revision_path = (payload.get("revision_path") or "").strip()
    new_code = (payload.get("new_carrier_code") or "").strip().upper()
    role = (session_role or "user").strip().lower()
    submitted_by = (
        session_email
        or (payload.get("user_email") or payload.get("user_name") or "anonim")
    ).strip()
    current_value = (payload.get("current_carrier_code") or "").strip().upper()

    if not revision_path:
        return {"ok": False, "error": "revision_path_and_new_carrier_code_required"}
    if not new_code:
        return {"ok": False, "error": "revision_path_and_new_carrier_code_required"}
    # NONE = jawne "BRAK TYPU" (dozwolone)

    can_apply_immediately = role == "admin" and bool(admin_mode)
    if can_apply_immediately:
        rename_files = bool(payload.get("rename_files", True))
        result = rename_revision_prefix_on_disk(
            revision_path, new_code, rename_files=rename_files
        )
        if result.get("ok"):
            append_audit({
                "action": "rename_revision_prefix",
                "path": result["new_path"],
                "detail": f"{current_value or '?'} -> {new_code}"
                + (f" (+{result.get('file_rename_count', 0)} plikow)" if rename_files else ""),
                "user": submitted_by,
            })
            append_assignment_log(result["new_path"], new_code, submitted_by)
        append_change_log({
            "action": "rename_carrier",
            "category": "carrier",
                "actor": submitted_by,
                "carrier_from": current_value,
                "carrier_to": new_code,
                "folder_rename": {
                    "old_path": result.get("old_path"),
                    "new_path": result.get("new_path"),
                    "old_name": result.get("old_name"),
                    "new_name": result.get("new_name"),
                },
                "file_renames": result.get("file_renames") or [],
                "product_id": payload.get("product_id") or "",
                "product_name": payload.get("product_name") or "",
            })
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
    # Tymczasowa kolejka <-> inbox: admin widzi zapotrzebowanie od razu
    append_inbox_item({
        "type": "tag_proposal",
        "title": f"Propozycja typu: {current_value or '?'} -> {new_code}",
        "detail": (
            f"{entry.get('product_name') or revision_path}\n"
            f"Zglosil: {submitted_by}\n"
            f"Sciezka: {revision_path}\n"
            f"proposal_id: {proposal_id}"
        ),
        "tags": ["moderacja", "tag", "propozycja"],
        "requested_by": submitted_by,
        "product_id": entry.get("product_id") or "",
        "path": revision_path,
        "proposal_id": proposal_id,
        "read": False,
    })
    return {"ok": True, "applied": False, "immediate": False, "proposal": entry}


def escalate_expired_proposals() -> int:
    """Po TTL NIE zapisujemy na dysk automatycznie (tylko admin apply).
    Eskalacja: flaga + wpis inbox dla admina."""
    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    now = datetime.now(timezone.utc)
    changed = 0
    for entry in proposals:
        if entry.get("status") != "pending":
            continue
        if entry.get("escalated_at"):
            continue
        try:
            expires_at = datetime.fromisoformat(entry["expires_at"])
        except (KeyError, ValueError):
            continue
        if now < expires_at:
            continue
        entry["escalated_at"] = now.isoformat(timespec="seconds")
        append_inbox_item({
            "type": "tag_proposal_expired",
            "title": f"Propozycja wygasla - decyzja admina: {entry.get('proposed_value')}",
            "detail": (
                f"{entry.get('product_name') or entry.get('revision_path')}\n"
                f"Zglosil: {entry.get('submitted_by')}\n"
                f"proposal_id: {entry.get('id')}\n"
                "System NIE zastosowal zmiany automatycznie - zatwierdz w Ustawieniach."
            ),
            "tags": ["moderacja", "tag", "wygaslo"],
            "requested_by": entry.get("submitted_by") or "system",
            "product_id": entry.get("product_id") or "",
            "path": entry.get("revision_path") or "",
            "proposal_id": entry.get("id"),
            "read": False,
        })
        append_audit({
            "action": "tag_proposal_escalated",
            "path": entry.get("revision_path") or "",
            "detail": f"TTL minął, czeka na admina: {entry.get('id')}",
            "user": "system",
        })
        changed += 1
    if changed:
        save_tag_proposals(data)
    return changed


def auto_apply_expired_proposals() -> int:
    """Kompatybilnosc nazwy - teraz tylko eskalacja do inbox (bez auto-zapisu)."""
    return escalate_expired_proposals()


def decide_tag_proposal(payload: dict, *, decided_by: str = "") -> dict:
    proposal_id = (payload.get("proposal_id") or "").strip()
    decision = (payload.get("decision") or "").strip()  # approve | reject | pick_other
    decided_by = (decided_by or payload.get("decided_by") or "admin").strip()
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
        append_change_log({
            "action": "rename_carrier_approved",
            "category": "carrier",
            "actor": decided_by,
            "proposal_id": proposal_id,
            "carrier_from": entry.get("current_value") or "",
            "carrier_to": final_value,
            "folder_rename": {
                "old_path": result.get("old_path"),
                "new_path": result.get("new_path"),
                "old_name": result.get("old_name"),
                "new_name": result.get("new_name"),
            },
            "file_renames": result.get("file_renames") or [],
            "product_id": entry.get("product_id") or "",
            "product_name": entry.get("product_name") or "",
        })
    return {"ok": result.get("ok", False), "proposal": entry, **{k: v for k, v in result.items() if k != "ok"}}


def reopen_tag_proposal(payload: dict, *, actor: str = "") -> dict:
    """Wroc decyzje do kolejki (pending) - bez zmian na dysku."""
    proposal_id = (payload.get("proposal_id") or "").strip()
    actor = (actor or payload.get("actor") or "admin").strip()
    if not proposal_id:
        return {"ok": False, "error": "proposal_id_required"}
    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    entry = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not entry:
        return {"ok": False, "error": "proposal_not_found"}
    st = str(entry.get("status") or "")
    if st == "pending":
        return {"ok": True, "proposal": entry, "note": "already_pending"}
    if st not in ("rejected", "approved", "approve_failed", "undone", "awaiting_admin"):
        return {"ok": False, "error": "cannot_reopen_status", "status": st}
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    entry["status"] = "pending"
    entry["reopened_at"] = now
    entry["reopened_by"] = actor
    entry["reopen_from"] = st
    for key in ("decided_by", "decided_at", "final_value"):
        entry.pop(key, None)
    save_tag_proposals(data)
    append_audit({
        "action": "tag_proposal_reopened",
        "path": entry.get("revision_path") or "",
        "detail": proposal_id,
        "user": actor,
    })
    return {"ok": True, "proposal": entry}



def _short_actor(s: str) -> str:
    v = (s or "").strip()
    if "@" in v:
        return v.split("@", 1)[0]
    return v or "?"


def _folder_rename_summary(entry: dict) -> str:
    fr = entry.get("folder_rename") or {}
    old_n = Path(normalize_path(fr.get("old_path") or "")).name
    new_n = Path(normalize_path(fr.get("new_path") or "")).name
    if old_n and new_n and old_n != new_n:
        return f"{old_n} -> {new_n}"
    action = str(entry.get("action") or entry.get("category") or "zmiana")
    return action


def _path_probe(path: str) -> dict:
    pth = Path(normalize_path(path or ""))
    if not path:
        return {"path": "", "exists": False, "kind": "unknown"}
    if pth.exists():
        return {"path": str(pth), "exists": True, "kind": "dir" if pth.is_dir() else "file"}
    return {
        "path": str(pth),
        "exists": False,
        "kind": "missing",
        "hint": "Sciezka nie istnieje na dysku (usunieta albo przeniesiona poza DAM).",
    }


def build_change_timeline_for_proposal(proposal_id: str) -> dict:
    """Przebieg change-log + audit dla sciezki propozycji (konflikty / kolejne zmiany)."""
    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    entry = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not entry:
        return {"ok": False, "error": "proposal_not_found"}

    rev = normalize_path(entry.get("revision_path") or "")
    rev_l = rev.lower()
    parent_l = Path(rev).parent.as_posix().lower() if rev else ""

    clog = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    entries = list(clog.get("entries") or [])
    redo = list(clog.get("redo") or [])

    own_idx = -1
    for i, e in enumerate(entries):
        if str(e.get("proposal_id") or "") == proposal_id:
            own_idx = i

    timeline = []
    for i, e in enumerate(entries):
        fr = e.get("folder_rename") or {}
        new_p = normalize_path(fr.get("new_path") or e.get("folder") or "")
        old_p = normalize_path(fr.get("old_path") or "")
        related = str(e.get("proposal_id") or "") == proposal_id
        if not related and rev_l:
            for cand in (new_p, old_p, e.get("folder") or ""):
                cl = normalize_path(cand).lower()
                if cl == rev_l or (parent_l and (cl.startswith(parent_l + "/") or cl.startswith(parent_l + "\\"))):
                    related = True
                    break
        if not related and own_idx >= 0 and i > own_idx:
            related = True
        if not related:
            continue
        probe = _path_probe(new_p or old_p or rev)
        timeline.append({
            "id": e.get("id") or "",
            "ts": e.get("ts") or "",
            "actor": _short_actor(e.get("actor") or e.get("user") or ""),
            "proposal_id": e.get("proposal_id") or "",
            "action": e.get("action") or e.get("category") or "",
            "summary": _folder_rename_summary(e),
            "is_this": str(e.get("proposal_id") or "") == proposal_id,
            "is_after": own_idx >= 0 and i > own_idx,
            "disk": probe,
        })

    audit_hits = []
    try:
        for row in read_audit(80):
            ap = normalize_path(row.get("path") or "").lower()
            if not ap or not rev_l:
                continue
            if ap != rev_l and not (parent_l and (ap.startswith(parent_l + "/") or ap.startswith(parent_l + "\\"))):
                continue
            act = str(row.get("action") or "")
            if (
                act in (
                    "change_log_undo",
                    "change_log_redo",
                    "tag_proposal_approved",
                    "tag_proposal_rejected",
                    "tag_proposal_reopened",
                    "tag_proposal_undone",
                    "tag_proposal_cancel_undo",
                )
                or "delete" in act
                or "remove" in act
                or "rename" in act
            ):
                audit_hits.append({
                    "ts": row.get("ts") or row.get("at") or "",
                    "actor": _short_actor(row.get("user") or row.get("actor") or ""),
                    "action": act,
                    "detail": row.get("detail") or "",
                    "path": row.get("path") or "",
                })
    except Exception:
        pass

    last = entries[-1] if entries else None
    can_undo_now = bool(last) and str(last.get("proposal_id") or "") == proposal_id
    current_disk = _path_probe(rev)
    return {
        "ok": True,
        "proposal_id": proposal_id,
        "can_undo_now": can_undo_now,
        "current_disk": current_disk,
        "timeline": timeline,
        "audit": audit_hits[:12],
        "redo_available": [
            {
                "id": r.get("id") or "",
                "ts": r.get("ts") or "",
                "proposal_id": r.get("proposal_id") or "",
                "summary": _folder_rename_summary(r),
                "actor": _short_actor(r.get("actor") or r.get("user") or ""),
            }
            for r in redo[-10:]
        ],
    }


def undo_tag_proposal(payload: dict, *, actor: str = "") -> dict:
    """Cofnij zatwierdzona zmiane typu na dysku (gdy to ostatni change-log).
    Po sukcesie: status=undone + undo_grace_until (+30s).
    Przy konflikcie: pelny przebieg change-log (timeline)."""
    proposal_id = (payload.get("proposal_id") or "").strip()
    actor = (actor or payload.get("actor") or "admin").strip()
    if not proposal_id:
        return {"ok": False, "error": "proposal_id_required"}
    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    entry = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not entry:
        return {"ok": False, "error": "proposal_not_found"}
    st = str(entry.get("status") or "")
    if st == "rejected":
        return {
            "ok": False,
            "error": "rejected_no_disk_change",
            "hint": (
                "Ta decyzja to odrzucenie - na dysku nic nie zmieniono. "
                "Uzyj \"Wroc do kolejki\", jesli chcesz zdecydowac ponownie."
            ),
            "timeline": build_change_timeline_for_proposal(proposal_id).get("timeline") or [],
        }
    if st not in ("approved", "approve_failed"):
        return {"ok": False, "error": "nothing_to_undo_on_disk", "status": st}

    clog = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    entries = list(clog.get("entries") or [])
    if not entries:
        now = datetime.now(timezone.utc)
        grace = (now + timedelta(seconds=30)).isoformat(timespec="seconds")
        entry["status"] = "undone"
        entry["undone_at"] = now.isoformat(timespec="seconds")
        entry["undone_by"] = actor
        entry["undo_grace_until"] = grace
        entry["disk_undo"] = False
        entry["undo_hint"] = "Brak wpisu change-log - tylko status, bez cofniecia na dysku."
        save_tag_proposals(data)
        append_audit({
            "action": "tag_proposal_undone",
            "path": entry.get("revision_path") or "",
            "detail": proposal_id + "|no_changelog",
            "user": actor,
        })
        return {
            "ok": True,
            "proposal": entry,
            "disk_undo": False,
            "grace_seconds": 30,
            "undo_grace_until": grace,
            "hint": entry["undo_hint"],
            "timeline": build_change_timeline_for_proposal(proposal_id).get("timeline") or [],
        }

    last = entries[-1]
    if str(last.get("proposal_id") or "") != proposal_id:
        report = build_change_timeline_for_proposal(proposal_id)
        return {
            "ok": False,
            "error": "not_last_change",
            "hint": (
                "Po tej zmianie nastapily kolejne na dysku. "
                "Najpierw cofnij nowsze (Cofnij ostatnia / przebieg ponizej), "
                "albo ponow po cofnieciu. Program nie cofnie w srodek historii."
            ),
            "last_proposal_id": last.get("proposal_id") or "",
            "last_change_id": last.get("id") or "",
            "last_summary": _folder_rename_summary(last),
            "last_actor": _short_actor(last.get("actor") or last.get("user") or ""),
            "last_ts": last.get("ts") or "",
            "timeline": report.get("timeline") or [],
            "audit": report.get("audit") or [],
            "current_disk": report.get("current_disk") or {},
            "redo_available": report.get("redo_available") or [],
        }

    fr = last.get("folder_rename") or {}
    expected_new = normalize_path(fr.get("new_path") or "")
    probe = _path_probe(expected_new or entry.get("revision_path") or "")
    if expected_new and not probe.get("exists"):
        report = build_change_timeline_for_proposal(proposal_id)
        return {
            "ok": False,
            "error": "path_missing",
            "hint": (
                "Nie mozna cofnac rename: folder/plik z tej zmiany nie istnieje na dysku. "
                "Ktos mogl go usunac albo przeniesc poza logi DAM. "
                "Ponizej przebieg zmian i wskazowki z audytu."
            ),
            "current_disk": probe,
            "timeline": report.get("timeline") or [],
            "audit": report.get("audit") or [],
        }

    disk = undo_last_change(actor)
    if not disk.get("ok"):
        report = build_change_timeline_for_proposal(proposal_id)
        disk["timeline"] = report.get("timeline") or []
        disk["audit"] = report.get("audit") or []
        disk["current_disk"] = probe
        return disk

    reverses = disk.get("reverses") or []
    failed = [r for r in reverses if not r.get("ok")]
    if failed:
        report = build_change_timeline_for_proposal(proposal_id)
        return {
            "ok": False,
            "error": "partial_undo_failed",
            "hint": (
                "Cofniecie na dysku nie powiodlo sie w calosci "
                "(brak pliku, konflikt nazw albo reczna zmiana po drodze)."
            ),
            "reverses": reverses,
            "timeline": report.get("timeline") or [],
            "audit": report.get("audit") or [],
            "current_disk": probe,
        }

    now = datetime.now(timezone.utc)
    grace = (now + timedelta(seconds=30)).isoformat(timespec="seconds")
    entry["status"] = "undone"
    entry["undone_at"] = now.isoformat(timespec="seconds")
    entry["undone_by"] = actor
    entry["undo_grace_until"] = grace
    entry["undo_change_id"] = (disk.get("undone") or {}).get("id") or ""
    entry["disk_undo"] = True
    for key in ("decided_by", "decided_at", "final_value"):
        if key in entry and f"prev_{key}" not in entry:
            entry[f"prev_{key}"] = entry.get(key)
    save_tag_proposals(data)
    append_audit({
        "action": "tag_proposal_undone",
        "path": entry.get("revision_path") or "",
        "detail": proposal_id,
        "user": actor,
    })
    return {
        "ok": True,
        "proposal": entry,
        "disk_undo": True,
        "grace_seconds": 30,
        "undo_grace_until": grace,
        "undone": disk.get("undone"),
        "reverses": reverses,
        "hint": "Cofnieto na dysku. Masz 30 s na Anuluj cofniecie (Ponow).",
        "redo_available": build_change_timeline_for_proposal(proposal_id).get("redo_available") or [],
    }


def cancel_undo_tag_proposal(payload: dict, *, actor: str = "") -> dict:
    """W ciagu 30 s po cofnieciu: ponow zmiane na dysku i przywroc status approved."""
    proposal_id = (payload.get("proposal_id") or "").strip()
    actor = (actor or payload.get("actor") or "admin").strip()
    if not proposal_id:
        return {"ok": False, "error": "proposal_id_required"}
    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    entry = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not entry:
        return {"ok": False, "error": "proposal_not_found"}
    if str(entry.get("status") or "") != "undone":
        return {"ok": False, "error": "not_in_undo_grace", "status": entry.get("status")}

    grace_raw = str(entry.get("undo_grace_until") or "")
    try:
        grace_dt = datetime.fromisoformat(grace_raw.replace("Z", "+00:00"))
        if grace_dt.tzinfo is None:
            grace_dt = grace_dt.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > grace_dt:
            return {
                "ok": False,
                "error": "grace_expired",
                "hint": "Minelo 30 s. Uzyj Ponow na pasku Historii (ostatnio wycofane), jesli nadal w redo.",
            }
    except ValueError:
        pass

    clog = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    redo = list(clog.get("redo") or [])
    want = str(entry.get("undo_change_id") or "")
    if entry.get("disk_undo") and redo:
        top = redo[-1]
        if want and str(top.get("id") or "") != want:
            return {
                "ok": False,
                "error": "redo_mismatch",
                "hint": "Na stosie redo jest inna zmiana. Sprawdz \"Ostatnio wycofane\" na pasku Historii.",
                "redo_top": top.get("id") or "",
            }
        redone = redo_last_change(actor)
        if not redone.get("ok"):
            return redone
    elif entry.get("disk_undo"):
        return {"ok": False, "error": "nothing_to_redo", "hint": "Brak wpisu na stosie redo."}

    entry["status"] = "approved"
    if entry.get("prev_decided_by"):
        entry["decided_by"] = entry.pop("prev_decided_by")
    if entry.get("prev_decided_at"):
        entry["decided_at"] = entry.pop("prev_decided_at")
    if "prev_final_value" in entry:
        entry["final_value"] = entry.pop("prev_final_value")
    for k in ("undone_at", "undone_by", "undo_grace_until", "undo_change_id", "disk_undo", "undo_hint"):
        entry.pop(k, None)
    entry["cancel_undo_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    entry["cancel_undo_by"] = actor
    save_tag_proposals(data)
    append_audit({
        "action": "tag_proposal_cancel_undo",
        "path": entry.get("revision_path") or "",
        "detail": proposal_id,
        "user": actor,
    })
    return {"ok": True, "proposal": entry, "hint": "Anulowano cofniecie - zmiana znow obowiazuje."}


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
    data = _load_json(overrides_file, {})
    if not isinstance(data, dict):
        data = {}
    if entry.get("clear"):
        data.pop(pid, None)
        _save_json(overrides_file, data)
        return {"ok": True, "product_id": pid, "cleared": True, "store": str(overrides_file)}
    row = {
        "path": (entry.get("path") or "").strip(),
        "file": (entry.get("file") or "").strip(),
        "thumb_url": (entry.get("thumb_url") or "").strip(),
        "updated_at": utc_now(),
    }
    data[pid] = row
    _save_json(overrides_file, data)
    return {"ok": True, "product_id": pid, "entry": row, "store": str(overrides_file)}


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff"}


def list_folder_images(path: str) -> dict:
    """Lista obrazow + podfolderow w folderze Marketing (picker miniatury/parowania w przegladarce).
    Zwraca rowniez `parent` (jesli wciaz pod Marketing) - admin moze nawigowac
    w gore/w dol, zeby wskazac folder wizualizacji INNEGO jezyka/wariantu (parowanie, 2026-07-18)."""
    target = Path(normalize_path(path or ""))
    if not target.exists():
        return {"ok": False, "error": "path_not_found", "path": str(target), "files": [], "folders": []}
    if target.is_file():
        target = target.parent
    if not target.is_dir():
        return {"ok": False, "error": "not_a_directory", "path": str(target), "files": [], "folders": []}
    if not _is_under_marketing(target):
        return {"ok": False, "error": "path_outside_marketing", "path": str(target), "files": [], "folders": []}
    files: list[dict] = []
    folders: list[dict] = []
    try:
        for child in sorted(target.iterdir(), key=lambda p: p.name.lower()):
            if child.is_dir():
                if len(folders) < 200:
                    folders.append({"name": child.name, "path": str(child).replace("\\", "/")})
                continue
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
        return {"ok": False, "error": str(exc), "path": str(target), "files": [], "folders": []}
    parent = target.parent
    parent_ok = str(parent) != str(target) and _is_under_marketing(parent)
    return {
        "ok": True,
        "path": str(target).replace("\\", "/"),
        "files": files,
        "folders": folders,
        "parent": str(parent).replace("\\", "/") if parent_ok else "",
    }


def read_viz_flags() -> dict:
    flags_file = WEB_ROOT / "data" / "viz-flags.json"
    default = {"demo": {}, "hidden": {}, "manual": [], "updated_at": ""}
    raw = _load_json(flags_file, default)
    if not isinstance(raw, dict):
        return default
    return {
        "demo": raw.get("demo") if isinstance(raw.get("demo"), dict) else {},
        "hidden": raw.get("hidden") if isinstance(raw.get("hidden"), dict) else {},
        "manual": raw.get("manual") if isinstance(raw.get("manual"), list) else [],
        "updated_at": raw.get("updated_at") or "",
    }


def write_viz_flags(payload: dict) -> dict:
    """Zapis flag demo/hidden/manual tylko do apps/web/data (+ PG Tier 2)."""
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
    _save_json(flags_file, current)
    return {"ok": True, "flags": current, "store": str(flags_file)}


_MEDIA_MAX_BYTES = 40 * 1024 * 1024  # 40 MB - anty DoS przez odczyt ogromnych plikow


def serve_media(path: str) -> tuple[int, bytes, str]:
    target = normalize_path(path)
    if not os.path.isfile(target):
        return 404, b"", "application/json"
    if not _is_under_marketing(Path(target)):
        return 403, b"", "application/json"
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
    }.get(ext)
    if not mime:
        return 415, b"", "application/json"
    try:
        if os.path.getsize(target) > _MEDIA_MAX_BYTES:
            return 413, b"", "application/json"
    except OSError:
        return 404, b"", "application/json"
    # TIFF often unsupported in browsers - still serve; client may fallback
    with open(target, "rb") as fh:
        return 200, fh.read(), mime


def media_meta(path: str) -> dict:
    """Read width/height/mode/colorspace/size for a local image (PIL)."""
    target = normalize_path(path)
    if not os.path.isfile(target):
        return {"ok": False, "error": "not_found", "path": target}
    if not _is_under_marketing(Path(target)):
        return {"ok": False, "error": "path_outside_marketing", "path": target}
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

    def _origin_ok(self) -> bool:
        """CORS: tylko UI origin (albo brak Origin = same-origin / narzedzia lokalne)."""
        origin = (self.headers.get("Origin") or "").strip()
        if not origin:
            return True
        return origin.rstrip("/") == CORS_ORIGIN.rstrip("/")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", CORS_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Vary", "Origin")

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
        if not self._origin_ok():
            self.send_response(403)
            self.end_headers()
            return
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _bearer(self) -> str:
        auth = self.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            return auth[7:].strip()
        return ""

    def _session_user(self) -> dict | None:
        """User z Bearer tokena (Postgres/SQLite). None = brak / niewazna sesja."""
        res = resolve_session(self._bearer())
        if not res.get("ok"):
            return None
        user = res.get("user") or {}
        if not user.get("email") and not user.get("role"):
            return None
        return user

    def _require_login(self) -> dict | None:
        user = self._session_user()
        if not user:
            self._json(
                401,
                {
                    "ok": False,
                    "error": "login_required",
                    "hint": "Zaloguj sie - zgłoszenia i zapis wymagają sesji.",
                },
            )
            return None
        return user

    def _require_admin(self) -> dict | None:
        user = self._require_login()
        if user is None:
            return None
        if (user.get("role") or "").strip().lower() != "admin":
            self._json(
                403,
                {
                    "ok": False,
                    "error": "admin_required",
                    "hint": (
                        "Tylko admin zatwierdza zmiany w bazie / na dysku. "
                        "Użytkownik może tylko zgłosić propozycję (JSON w kolejce)."
                    ),
                },
            )
            return None
        return user

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        # OAuth callback moze przyjsc z Origin zewnetrznego IdP - nie blokuj.
        if parsed.path != "/oauth/callback" and not self._origin_ok():
            self._json(403, {"ok": False, "error": "origin_forbidden"})
            return
        if parsed.path == "/health":
            self._json(200, {"ok": True, "service": "dam-local-bridge", "port": PORT})
            return
        if parsed.path == "/detect-marketing-bases":
            # Lokalny most 127.0.0.1 - status dysku bez Bearer (UI pyta przed / bez sesji)
            self._json(200, detect_marketing_bases())
            return
        if parsed.path == "/machine-config":
            self._json(200, read_machine_config())
            return
        if parsed.path == "/auth/registration-open":
            # Publiczny (localhost): czy UI moze pokazac "Utworz konto".
            n = users_count()
            self._json(200, {"ok": True, "open": n == 0, "users": n})
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
            # Status ROOT plikow - bez loginu (pill "Pliki online/offline")
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
            if self._require_login() is None:
                return
            qs = parse_qs(parsed.query)
            limit = int((qs.get("limit") or ["100"])[0])
            self._json(200, {"ok": True, "items": read_audit(max(1, min(limit, 500)))})
            return
        if parsed.path == "/index/status":
            self._json(200, index_status())
            return
        if parsed.path == "/meta/status":
            try:
                import meta_store

                self._json(200, meta_store.status())
            except Exception as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/folder-images":
            # Odczyt lokalny Marketing (jail) - img/fetch bez Bearer
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            if not path:
                self._json(400, {"ok": False, "error": "path_required", "files": []})
                return
            self._json(200, list_folder_images(path))
            return
        if parsed.path == "/folder-browse":
            # Odczyt lokalny Marketing (jail) - picker bez Bearer
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            mode = (qs.get("mode") or ["assets"])[0]
            if not path:
                self._json(400, {"ok": False, "error": "path_required", "files": [], "folders": []})
                return
            self._json(200, list_folder_browse(path, mode=mode))
            return
        if parsed.path in ("/db/status", "/pg/status"):
            # Pill "Baza online/offline" - bez Bearera (localhost)
            self._json(200, dam_db.status() if dam_db else {"ok": False, "error": "dam_db_missing"})
            return
        if parsed.path == "/db/prefer":
            if not dam_db:
                self._json(500, {"ok": False, "error": "dam_db_missing"})
                return
            self._json(200, {"ok": True, "prefer": dam_db.load_prefer()})
            return
        if parsed.path == "/media":
            # Miniatury w <img src> nie moga wyslac Authorization - localhost + jail Marketing
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            code, body, ctype = serve_media(path)
            if code != 200:
                err = {
                    403: "path_outside_marketing",
                    413: "file_too_large",
                    415: "unsupported_media",
                }.get(code, "not_found")
                self._json(code if code in (403, 413, 415) else 404, {"ok": False, "error": err, "path": path})
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
            if self._require_login() is None:
                return
            auto_apply_expired_proposals()
            self._json(200, load_tag_proposals())
            return
        if parsed.path == "/change-log":
            if self._require_login() is None:
                return
            qs = parse_qs(parsed.query)
            limit = int((qs.get("limit") or ["40"])[0])
            self._json(200, load_change_log(limit))
            return
        if parsed.path == "/program-instructions":
            data = _load_json(PROGRAM_INSTRUCTIONS_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "program_instructions_missing"})
                return
            qs = parse_qs(parsed.query)
            cat = (qs.get("category") or [""])[0].strip().lower()
            pri = (qs.get("priority") or [""])[0].strip().lower()
            items = list(data.get("instructions") or [])
            if cat:
                items = [i for i in items if str((i or {}).get("category") or "").lower() == cat]
            if pri:
                items = [i for i in items if str((i or {}).get("priority") or "").lower() == pri]
            self._json(
                200,
                {
                    "ok": True,
                    "version": data.get("version"),
                    "updated_at": data.get("updated_at"),
                    "title_pl": data.get("title_pl"),
                    "description_pl": data.get("description_pl"),
                    "source_of_truth": data.get("source_of_truth"),
                    "count": len(items),
                    "instructions": items,
                },
            )
            return
        if parsed.path == "/lifecycle-status":
            if self._require_login() is None:
                return
            if lifecycle_status_mod is None:
                self._json(500, {"ok": False, "error": "lifecycle_module_missing"})
                return
            store = lifecycle_status_mod.load_lifecycle_store(LIFECYCLE_STORE_FILE)
            self._json(200, {"ok": True, **store})
            return
        if parsed.path == "/lifecycle-reconcile":
            # Odswiez (pull) lub boot (mtime) - dysk -> program; boot moze przeniesc X do archiwum
            user = self._require_login()
            if user is None:
                return
            if lifecycle_status_mod is None:
                self._json(500, {"ok": False, "error": "lifecycle_module_missing"})
                return
            qs = parse_qs(parsed.query)
            mode = ((qs.get("mode") or ["pull"])[0] or "pull").strip().lower()
            pid_filter = ((qs.get("product_id") or [""])[0] or "").strip() or None
            actor = (user.get("email") or user.get("name") or "reconcile") if isinstance(user, dict) else "reconcile"
            if mode in ("boot", "startup", "mtime"):
                result = lifecycle_status_mod.reconcile_lifecycle_on_boot(
                    store_path=LIFECYCLE_STORE_FILE,
                    file_index_path=INDEX_FILE,
                    actor=str(actor),
                    product_id_filter=pid_filter,
                    enforce_moves=True,
                    append_change_log=append_change_log,
                )
            else:
                result = lifecycle_status_mod.pull_lifecycle_from_disk(
                    store_path=LIFECYCLE_STORE_FILE,
                    file_index_path=INDEX_FILE,
                    actor=str(actor),
                    product_id_filter=pid_filter,
                )
            # nie zwracaj calego store w body (duzy) - UI i tak przeladuje
            body = {k: v for k, v in result.items() if k != "store"}
            body["ok"] = bool(result.get("ok"))
            self._json(200 if body.get("ok") else 400, body)
            return
        if parsed.path == "/tag-proposals/timeline":
            if self._require_login() is None:
                return
            qs = parse_qs(parsed.query)
            pid = (qs.get("proposal_id") or [""])[0].strip()
            result = build_change_timeline_for_proposal(pid)
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/carrier-assignment":
            if self._require_login() is None:
                return
            # Discrepancy: dysk vs ostatnie zatwierdzenie
            qs = parse_qs(parsed.query)
            rev = (qs.get("path") or qs.get("revision_path") or [""])[0].strip()
            disk = (qs.get("disk_carrier") or [""])[0].strip().upper()
            last = get_last_assignment(rev) if rev else None
            assigned = ((last or {}).get("carrier_code") or "").strip().upper()
            discrepancy = bool(assigned and disk and assigned != disk and assigned not in ("NONE", "BRAK"))
            self._json(200, {
                "ok": True,
                "revision_path": rev,
                "disk_carrier": disk,
                "assigned_carrier": assigned,
                "discrepancy": discrepancy,
                "last": last,
                "tip": (
                    f"Wczesniej zatwierdzono {assigned}, na dysku jest {disk}."
                    if discrepancy
                    else ""
                ),
            })
            return
        if parsed.path == "/carrier-types":
            if self._require_login() is None:
                return
            self._json(200, _load_json(CARRIER_TYPES_FILE, {"custom_types": {}, "deleted_types": {}}))
            return
        if parsed.path == "/inbox-items":
            if self._require_login() is None:
                return
            self._json(200, _load_json(INBOX_ITEMS_FILE, {"items": []}))
            return
        if parsed.path == "/integrations/status":
            if self._require_login() is None:
                return
            if oauth_integrations is None:
                self._json(500, {"ok": False, "error": "oauth_module_missing"})
                return
            self._json(200, oauth_integrations.status())
            return
        if parsed.path == "/notification-groups":
            if self._require_login() is None:
                return
            groups = _load_json(NOTIFICATION_GROUPS_FILE, {})
            # Nie zwracaj meta-kluczy typu _readme jako grupy
            clean = {
                k: v
                for k, v in (groups or {}).items()
                if isinstance(v, list) and not str(k).startswith("_")
            }
            self._json(200, {"ok": True, "groups": clean})
            return
        if parsed.path == "/oauth/callback":
            # Redirect z Asana / Microsoft - wymiana code, potem HTML z komunikatem
            import html as _html

            if oauth_integrations is None:
                self._json(500, {"ok": False, "error": "oauth_module_missing"})
                return
            qs = parse_qs(parsed.query)
            code = (qs.get("code") or [""])[0]
            state = (qs.get("state") or [""])[0]
            err = (qs.get("error") or [""])[0]
            ui_origin = (CORS_ORIGIN or "http://127.0.0.1:8765").rstrip("/")
            settings_url = ui_origin + "/settings.html"
            settings_hash = settings_url + "#damIntegrations"
            if err:
                safe_err = _html.escape(str(err)[:500])
                safe_settings = _html.escape(settings_url)
                page = (
                    "<!doctype html><meta charset=utf-8><title>OAuth</title>"
                    f"<h1>Logowanie przerwane</h1><p>{safe_err}</p>"
                    f'<p><a href="{safe_settings}">Wroc do Ustawien</a></p>'
                )
                self._bytes(400, page.encode("utf-8"), "text/html; charset=utf-8")
                return
            result = oauth_integrations.complete_callback(code, state)
            ok = result.get("ok")
            safe_provider = _html.escape(str(result.get("provider") or "")[:120])
            safe_msg = _html.escape(str(result.get("error") or "OK")[:500])
            safe_hash = _html.escape(settings_hash)
            page = (
                "<!doctype html><meta charset=utf-8><title>OAuth</title>"
                f"<h1>{'Polaczono' if ok else 'Blad OAuth'}</h1>"
                f"<p>{safe_provider} - {safe_msg}</p>"
                f'<p><a href="{safe_hash}">'
                "Wroc do Ustawien / Integracje</a></p>"
                f"<script>setTimeout(function(){{location.href={json.dumps(settings_hash)}}},1500)</script>"
            )
            self._bytes(200 if ok else 400, page.encode("utf-8"), "text/html; charset=utf-8")
            return
        if parsed.path == "/product-catalog":
            data = _load_json(PRODUCT_CATALOG_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "product_catalog_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/product-price":
            qs = parse_qs(parsed.query)
            product_id = (qs.get("product_id") or [""])[0].strip()
            if not product_id:
                self._json(400, {"ok": False, "error": "product_id_required"})
                return
            cache = _load_json(PRODUCT_PRICES_CACHE_FILE, {"products": {}})
            hit = (cache.get("products") or {}).get(product_id)
            if not hit and FETCH_PRODUCT_PRICES.is_file():
                try:
                    _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
                    subprocess.call(
                        [sys.executable, str(FETCH_PRODUCT_PRICES), "--product-id", product_id],
                        creationflags=_no_win,
                    )
                    cache = _load_json(PRODUCT_PRICES_CACHE_FILE, {"products": {}})
                    hit = (cache.get("products") or {}).get(product_id)
                except OSError:
                    pass
            if not hit:
                self._json(404, {"ok": False, "error": "price_not_found", "product_id": product_id})
                return
            self._json(200, {"ok": True, "product_id": product_id, **hit})
            return
        if parsed.path == "/bulk-packaging":
            data = _load_json(BULK_PACKAGING_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "bulk_packaging_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/shop-categories":
            data = _load_json(SHOP_CATEGORIES_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "shop_categories_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/branding-index":
            data = _load_json(BRANDING_INDEX_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "branding_index_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path in ("/branding/status", "/branding/recognize/status"):
            status_file = BRANDING_RECOGNIZE_STATUS_FILE if "recognize" in parsed.path else BRANDING_STATUS_FILE
            data = _load_json(status_file, {"ok": False, "state": "unknown"})
            self._json(200, data if isinstance(data, dict) else {"ok": False})
            return
        if parsed.path == "/wykrojniki-registry":
            data = _load_json(WYKROJNIKI_REGISTRY_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "wykrojniki_registry_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        self._json(404, {"ok": False, "error": "not_found"})

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        # Limit body (anty DoS) - 2 MB wystarczy na JSON mostu
        if length > 2 * 1024 * 1024:
            self._json(413, {"ok": False, "error": "payload_too_large"})
            return
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "invalid_json"})
            return

        parsed = urlparse(self.path)
        if parsed.path != "/oauth/callback" and not self._origin_ok():
            self._json(403, {"ok": False, "error": "origin_forbidden"})
            return
        if parsed.path == "/reveal":
            # #region agent log
            try:
                _user = self._session_user() or {}
                _dbg = {
                    "sessionId": "a78fa0",
                    "hypothesisId": "A",
                    "location": "local_bridge.py:/reveal",
                    "message": "reveal request",
                    "data": {
                        "has_bearer": bool(self._bearer()),
                        "path_len": len((data.get("path") or "").strip()),
                        "user_email": str(_user.get("email") or "")[:80],
                    },
                    "timestamp": int(time.time() * 1000),
                    "runId": "post-fix",
                }
                with open(
                    Path(__file__).resolve().parents[2] / "debug-a78fa0.log",
                    "a",
                    encoding="utf-8",
                ) as _f:
                    _f.write(json.dumps(_dbg, ensure_ascii=False) + "\n")
            except Exception:
                pass
            # #endregion
            # Lokalny most 127.0.0.1: otwarcie folderu w Marketing (jail) bez Bearer.
            path = (data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, reveal_in_explorer(path))
            return
        if parsed.path == "/synology-share":
            if self._require_login() is None:
                return
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
            # Zapis sciezki Marketing tylko dla zalogowanego uzytkownika
            if self._require_login() is None:
                return
            path = (data.get("base_path") or data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "base_path_required"})
                return
            self._json(200, write_machine_config(path))
            return
        if parsed.path == "/meta/sync":
            if self._require_admin() is None:
                return
            try:
                import meta_store

                self._json(200, meta_store.sync_from_file_index())
            except Exception as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/auth/logout":
            res = auth_logout(self._bearer())
            self._json(200 if res.get("ok") else 401, res)
            return
        if parsed.path == "/auth/register":
            # Bootstrap: pierwsze konto w systemie (zawsze role=admin).
            # Potem: tylko admin moze zakladac konta (wczesniej kazdy lokalny mogl).
            admin = self._session_user()
            is_admin = bool(admin and (admin.get("role") or "") == "admin")
            bootstrap = users_count() == 0
            if not bootstrap and not is_admin:
                self._json(
                    403,
                    {
                        "ok": False,
                        "error": "admin_required",
                        "hint": "Nowe konta zaklada tylko administrator.",
                    },
                )
                return
            requested_role = (data.get("role") or "user").strip().lower()
            if bootstrap:
                requested_role = "admin"
            elif not is_admin:
                requested_role = "user"
            if requested_role not in ("admin", "power_user", "user"):
                requested_role = "user"
            self._json(
                200,
                register_user(
                    data.get("email") or "",
                    data.get("password") or "",
                    data.get("name") or "",
                    requested_role,
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
        if parsed.path == "/auth/rehydrate":
            payload = data if isinstance(data, dict) else {}
            self._json(
                200,
                auth_rehydrate(
                    payload.get("session_id") or "",
                    payload.get("device_id") or "",
                    payload.get("machine_id") or "",
                ),
            )
            return
        if parsed.path == "/audit":
            user = self._require_login()
            if user is None:
                return
            payload = data if isinstance(data, dict) else {}
            payload.setdefault("user", user.get("email") or user.get("name") or "")
            self._json(200, append_audit(payload))
            return
        if parsed.path == "/index/rebuild":
            # Odswiez liste z dysku: kazda zalogowana sesja (nie tylko admin).
            if self._require_login() is None:
                return
            self._json(200, start_index_rebuild())
            return
        if parsed.path == "/branding/rebuild":
            if self._require_login() is None:
                return
            if not BUILD_BRANDING_INDEX.is_file():
                self._json(500, {"ok": False, "error": "build_branding_missing"})
                return
            try:
                _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
                rc = subprocess.call(
                    [sys.executable, str(BUILD_BRANDING_INDEX)],
                    creationflags=_no_win,
                )
                self._json(200, {"ok": rc == 0, "rc": rc})
            except OSError as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/branding/recognize":
            if self._require_admin() is None:
                return
            if not ENRICH_BRANDING_RECOGNIZE.is_file():
                self._json(500, {"ok": False, "error": "recognize_script_missing"})
                return
            try:
                _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
                rc = subprocess.call(
                    [sys.executable, str(ENRICH_BRANDING_RECOGNIZE)],
                    creationflags=_no_win,
                )
                self._json(200, {"ok": rc == 0, "rc": rc})
            except OSError as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/wykrojniki/reimport":
            if self._require_admin() is None:
                return
            if not IMPORT_WYKROJNIKI.is_file():
                self._json(500, {"ok": False, "error": "import_script_missing"})
                return
            try:
                _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
                rc = subprocess.call(
                    [sys.executable, str(IMPORT_WYKROJNIKI)],
                    creationflags=_no_win,
                )
                self._json(200, {"ok": rc == 0, "rc": rc})
            except OSError as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/product-catalog/update":
            if self._require_admin() is None:
                return
            product_id = (data.get("product_id") or "").strip()
            patch = data.get("patch") or data.get("entry") or {}
            if not product_id or not isinstance(patch, dict):
                self._json(400, {"ok": False, "error": "product_id_and_patch_required"})
                return
            catalog = _load_json(PRODUCT_CATALOG_FILE, {"version": 1, "products": {}})
            products = catalog.setdefault("products", {})
            base = products.get(product_id) if isinstance(products.get(product_id), dict) else {}
            products[product_id] = {**base, **patch}
            catalog["updated_at"] = utc_now()
            PRODUCT_CATALOG_FILE.write_text(
                json.dumps(catalog, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            self._json(200, {"ok": True, "product_id": product_id})
            return
        if parsed.path == "/carrier-override":
            if self._require_admin() is None:
                return
            path = (data.get("path") or "").strip()
            entry = data.get("entry") or {}
            if not path or not isinstance(entry, dict):
                self._json(400, {"ok": False, "error": "path_and_entry_required"})
                return
            self._json(200, append_carrier_override(path, entry))
            return
        if parsed.path == "/elements-link":
            if self._require_admin() is None:
                return
            result = upsert_elements_link(data if isinstance(data, dict) else {})
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/thumb-override":
            if self._require_admin() is None:
                return
            pid = (data.get("product_id") or "").strip()
            if not pid:
                self._json(400, {"ok": False, "error": "product_id_required"})
                return
            self._json(200, append_thumb_override(pid, data if isinstance(data, dict) else {}))
            return
        if parsed.path == "/viz-flag":
            if self._require_admin() is None:
                return
            self._json(200, write_viz_flags(data if isinstance(data, dict) else {}))
            return
        if parsed.path == "/rename-index":
            if self._require_admin() is None:
                return
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
        if parsed.path == "/lifecycle-status":
            user = self._require_admin()
            if user is None:
                return
            if lifecycle_status_mod is None:
                self._json(500, {"ok": False, "error": "lifecycle_module_missing"})
                return
            payload = data if isinstance(data, dict) else {}
            result = lifecycle_status_mod.apply_lifecycle_status(
                scope=str(payload.get("scope") or ""),
                status=str(payload.get("status") or ""),
                path=str(payload.get("path") or payload.get("folder") or ""),
                product_path=str(payload.get("product_path") or ""),
                product_id=str(payload.get("product_id") or ""),
                revision_index=str(payload.get("revision_index") or payload.get("index") or ""),
                actor=(user.get("email") or user.get("name") or ""),
                dry_run=bool(payload.get("dry_run")),
                store_path=LIFECYCLE_STORE_FILE,
                append_change_log=append_change_log,
            )
            # Po sukcesie: wypchnij lifecycle + mirror product-status do PG (KV)
            if result.get("ok") and not result.get("dry_run"):
                try:
                    store = lifecycle_status_mod.load_lifecycle_store(LIFECYCLE_STORE_FILE)
                    _save_json(LIFECYCLE_STORE_FILE, store)
                except Exception:  # noqa: BLE001
                    pass
                try:
                    mirror_lifecycle_to_product_status(result, payload)
                except Exception:  # noqa: BLE001
                    pass
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/lifecycle-force":
            # Stosuj zmiany: PROGRAM -> dysk (FORCE)
            user = self._require_admin()
            if user is None:
                return
            if lifecycle_status_mod is None:
                self._json(500, {"ok": False, "error": "lifecycle_module_missing"})
                return
            payload = data if isinstance(data, dict) else {}
            pid_filter = str(payload.get("product_id") or "").strip() or None
            dry_run = bool(payload.get("dry_run"))
            result = lifecycle_status_mod.force_apply_program_to_disk(
                store_path=LIFECYCLE_STORE_FILE,
                file_index_path=INDEX_FILE,
                actor=(user.get("email") or user.get("name") or "force"),
                product_id_filter=pid_filter,
                dry_run=dry_run,
                append_change_log=append_change_log,
            )
            body = {k: v for k, v in result.items() if k != "store"}
            self._json(200 if body.get("ok") else 400, body)
            return
        if parsed.path == "/rename-revision-prefix":
            user = self._require_login()
            if user is None:
                return
            # admin_mode z body tylko jako UX flag - privilege i tak z sesji
            admin_mode = bool(data.get("admin_mode")) and (user.get("role") or "") == "admin"
            result = create_or_apply_tag_proposal(
                data if isinstance(data, dict) else {},
                session_role=(user.get("role") or "user"),
                session_email=(user.get("email") or user.get("name") or ""),
                admin_mode=admin_mode,
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/rename-revision-files":
            # Dry-run wolny dla zalogowanych; apply tylko admin
            user = self._require_login()
            if user is None:
                return
            rev = (data.get("revision_path") or "").strip()
            code = (data.get("new_carrier_code") or "").strip()
            dry = bool(data.get("dry_run", True))
            if not rev or not code:
                self._json(400, {"ok": False, "error": "revision_path_and_new_carrier_code_required"})
                return
            if not dry and (user.get("role") or "") != "admin":
                self._json(403, {"ok": False, "error": "admin_required", "hint": "Apply rename plików = tylko admin."})
                return
            self._json(200, rename_revision_files_on_disk(rev, code, dry_run=dry))
            return
        if parsed.path == "/change-log/undo":
            user = self._require_admin()
            if user is None:
                return
            actor = (user.get("email") or data.get("actor") or "").strip()
            self._json(200, undo_last_change(actor))
            return
        if parsed.path == "/change-log/redo":
            user = self._require_admin()
            if user is None:
                return
            actor = (user.get("email") or data.get("actor") or "").strip()
            self._json(200, redo_last_change(actor))
            return
        if parsed.path == "/tag-proposals/decide":
            user = self._require_admin()
            if user is None:
                return
            result = decide_tag_proposal(
                data if isinstance(data, dict) else {},
                decided_by=(user.get("email") or user.get("name") or "admin"),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/tag-proposals/reopen":
            user = self._require_admin()
            if user is None:
                return
            result = reopen_tag_proposal(
                data if isinstance(data, dict) else {},
                actor=(user.get("email") or user.get("name") or "admin"),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/tag-proposals/undo":
            user = self._require_admin()
            if user is None:
                return
            result = undo_tag_proposal(
                data if isinstance(data, dict) else {},
                actor=(user.get("email") or user.get("name") or "admin"),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/tag-proposals/cancel-undo":
            user = self._require_admin()
            if user is None:
                return
            result = cancel_undo_tag_proposal(
                data if isinstance(data, dict) else {},
                actor=(user.get("email") or user.get("name") or "admin"),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/tag-proposals/timeline":
            user = self._require_admin()
            if user is None:
                return
            pid = ""
            if isinstance(data, dict):
                pid = (data.get("proposal_id") or "").strip()
            if not pid:
                qs = parse_qs(parsed.query or "")
                pid = (qs.get("proposal_id") or [""])[0].strip()
            result = build_change_timeline_for_proposal(pid)
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/carrier-types":
            if self._require_admin() is None:
                return
            result = manage_carrier_type(data if isinstance(data, dict) else {})
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/viz-request":
            user = self._require_login()
            if user is None:
                return
            payload = data if isinstance(data, dict) else {}
            payload["requested_by"] = user.get("email") or user.get("name") or payload.get("requested_by") or ""
            result = create_viz_request(payload)
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/inbox-items/mark-read":
            if self._require_login() is None:
                return
            item_id = (data.get("id") or "").strip()
            store = _load_json(INBOX_ITEMS_FILE, {"items": []})
            for it in store.get("items") or []:
                if it.get("id") == item_id:
                    it["read"] = True
            _save_json(INBOX_ITEMS_FILE, store)
            self._json(200, {"ok": True})
            return
        if parsed.path == "/integrations/connect":
            user = self._require_login()
            if user is None:
                return
            if oauth_integrations is None:
                self._json(500, {"ok": False, "error": "oauth_module_missing"})
                return
            provider = (data.get("provider") or "").strip().lower()
            result = oauth_integrations.start_login(
                provider, user_email=(user.get("email") or "")
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/integrations/disconnect":
            user = self._require_admin()
            if user is None:
                return
            if oauth_integrations is None:
                self._json(500, {"ok": False, "error": "oauth_module_missing"})
                return
            provider = (data.get("provider") or "").strip().lower()
            self._json(200, oauth_integrations.disconnect(provider))
            return
        if parsed.path == "/notification-groups":
            if self._require_login() is None:
                return
            incoming = data.get("groups") if isinstance(data.get("groups"), dict) else data
            if not isinstance(incoming, dict):
                self._json(400, {"ok": False, "error": "invalid_groups"})
                return
            current = _load_json(NOTIFICATION_GROUPS_FILE, {})
            if not isinstance(current, dict):
                current = {}
            # Zachowaj _readme i inne meta; aktualizuj tylko listy odbiorców
            for key, val in incoming.items():
                if str(key).startswith("_"):
                    continue
                if not isinstance(val, list):
                    continue
                cleaned = []
                for item in val:
                    if isinstance(item, dict):
                        email = str(item.get("email") or "").strip()
                        name = str(item.get("name") or "").strip()
                        if email and "@" in email:
                            cleaned.append({"name": name or email, "email": email})
                    elif isinstance(item, str) and "@" in item:
                        cleaned.append({"name": item, "email": item.strip()})
                current[key] = cleaned
            if "_readme" not in current:
                current["_readme"] = (
                    "Grupy odbiorcow powiadomien. Edytuj w Ustawieniach DAM "
                    "lub w tym pliku - kod NIE trzeba zmieniac."
                )
            _save_json(NOTIFICATION_GROUPS_FILE, current)
            clean = {
                k: v
                for k, v in current.items()
                if isinstance(v, list) and not str(k).startswith("_")
            }
            self._json(200, {"ok": True, "groups": clean})
            return
        if parsed.path in ("/db/reconnect", "/db/refresh"):
            if self._require_admin() is None:
                return
            if not dam_db:
                self._json(500, {"ok": False, "error": "dam_db_missing"})
                return
            pull_dump = bool(data.get("pull_dump") or data.get("github") or False)
            self._json(200, dam_db.force_reconnect(pull_dump=pull_dump))
            return
        if parsed.path == "/db/prefer":
            if self._require_admin() is None:
                return
            if not dam_db:
                self._json(500, {"ok": False, "error": "dam_db_missing"})
                return
            prefer = dam_db.save_prefer(data if isinstance(data, dict) else {})
            status = dam_db.force_reconnect(pull_dump=False)
            status["prefer"] = prefer
            self._json(200, status)
            return
        self._json(404, {"ok": False, "error": "not_found"})


def _tag_proposal_watcher() -> None:
    """Co ~15 min: eskalacja wygaslych propozycji do inbox (BEZ auto-zapisu na dysk)."""
    while True:
        try:
            n = escalate_expired_proposals()
            if n:
                print(f"tag-proposals watcher: escalated {n} to inbox (awaiting admin)")
        except Exception as exc:
            print("tag-proposals watcher error:", exc)
        time.sleep(15 * 60)


def _kv_cache_watcher() -> None:
    """ADR-009: co 5 min (gdy program/bridge dziala) pobierz wszystkie Tier-2
    stores z Postgresa do lokalnego cache. Tier 1 (auth/sesje) jest ZAWSZE zywe
    - bez cache. Pierwszy pull zaraz po starcie."""
    first = True
    while True:
        if not first:
            time.sleep(5 * 60)
        first = False
        try:
            n = _pull_kv_cache_from_postgres()
            if n:
                print(f"kv_cache watcher: refreshed {n} stores from postgres")
        except Exception as exc:
            print("kv_cache watcher error:", exc)


def main() -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        if dam_db is not None:
            print("db:", dam_db.init_db())
        auth_init_db()
        seed_owner_from_env()
    except Exception as exc:
        print("auth/db seed:", exc)
    try:
        _seed_naming_policy_to_postgres()
    except Exception as exc:
        print("naming policy seed:", exc)
    threading.Thread(target=_tag_proposal_watcher, daemon=True).start()
    threading.Thread(target=_kv_cache_watcher, daemon=True).start()
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
