# -*- coding: utf-8 -*-
"""
Baza DAM (SQLite, WAL) - TYLKO w repozytorium.

Kanon: apps/desktop/data/dam-local.sqlite
Legacy: apps/desktop/data/dam-auth.sqlite (migracja jednorazowa)

ZAKAZ: tworzenie / zapis katalogow na Marketing (np. X:\\Marketing\\.dam-eta)
bez osobnego, jawnego polecenia uzytkownika. Marketing = zrodlo plikow (read/scan),
nie miejsce na metadata aplikacji.
"""
from __future__ import annotations

import json
import shutil
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
DATA_DIR = DESKTOP_DIR / "data"
DB_CANONICAL = DATA_DIR / "dam-local.sqlite"
DB_LEGACY_AUTH = DATA_DIR / "dam-auth.sqlite"
# Stary blad ADR-007 - tylko do jednorazowej migracji DO repo, nigdy jako cel zapisu
_LEGACY_MARKETING_REL = Path(".dam-eta") / "dam-shared.sqlite"
MACHINE_CONFIG = DESKTOP_DIR / "machine-config.json"
_LOCK = threading.Lock()
_INITIALIZED = False
_RESOLVED_PATH: Path | None = None


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _marketing_base_from_config() -> Path | None:
    """Odczyt base_path Marketing (tylko do migracji starego .dam-eta -> repo)."""
    if not MACHINE_CONFIG.is_file():
        return None
    try:
        data = json.loads(MACHINE_CONFIG.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    users = data.get("users") or {}
    import getpass

    me = (getpass.getuser() or "").strip().lower()
    entry = None
    if me and isinstance(users, dict):
        for k, v in users.items():
            if str(k).strip().lower() == me:
                entry = v
                break
    if entry is None and isinstance(users, dict) and users:
        entry = next(iter(users.values()))
    base = ""
    if isinstance(entry, dict):
        base = str(entry.get("base_path") or "").strip()
    if not base:
        base = str(data.get("base_path") or "").strip()
    if not base:
        return None
    p = Path(base)
    try:
        if p.is_dir():
            return p
    except OSError:
        return None
    return None


def _copy_if_newer_or_missing(src: Path, dst: Path) -> bool:
    """Skopiuj src -> dst gdy dst brakuje albo src jest wiekszy/nowszy. Zwraca True gdy skopiowano."""
    if not src.is_file() or src.stat().st_size <= 0:
        return False
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if not dst.is_file() or dst.stat().st_size == 0:
            shutil.copy2(src, dst)
            return True
        if src.stat().st_mtime > dst.stat().st_mtime or src.stat().st_size > dst.stat().st_size:
            shutil.copy2(src, dst)
            return True
    except OSError:
        return False
    return False


def _migrate_into_repo() -> None:
    """
    Jednorazowo sciagnij dane do apps/desktop/data:
    1) legacy dam-auth.sqlite
    2) stary blad: {Marketing}/.dam-eta/dam-shared.sqlite
    Nie tworzy nic na Marketing.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if DB_LEGACY_AUTH.is_file() and (
        not DB_CANONICAL.is_file() or DB_CANONICAL.stat().st_size == 0
    ):
        try:
            shutil.copy2(DB_LEGACY_AUTH, DB_CANONICAL)
        except OSError:
            pass

    base = _marketing_base_from_config()
    if base is None:
        return
    legacy_shared = base / _LEGACY_MARKETING_REL
    _copy_if_newer_or_missing(legacy_shared, DB_CANONICAL)


def db_path() -> Path:
    """Zawsze baza w repo (apps/desktop/data)."""
    global _RESOLVED_PATH
    if _RESOLVED_PATH is not None:
        return _RESOLVED_PATH

    _migrate_into_repo()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _RESOLVED_PATH = DB_CANONICAL
    return _RESOLVED_PATH


def reset_path_cache() -> None:
    """Po zmianie konfiguracji - przelicz sciezke bazy."""
    global _RESOLVED_PATH, _INITIALIZED
    _RESOLVED_PATH = None
    _INITIALIZED = False


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False, timeout=60)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA busy_timeout = 60000")
    return conn


def init_db() -> dict[str, Any]:
    """Schemat: auth + audit_log. Idempotentne."""
    global _INITIALIZED
    with _LOCK:
        conn = connect()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                  name TEXT NOT NULL,
                  role TEXT NOT NULL DEFAULT 'user',
                  password_hash TEXT NOT NULL,
                  auth_provider TEXT NOT NULL DEFAULT 'local',
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS device_sessions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  device_id TEXT NOT NULL,
                  machine_id TEXT NOT NULL DEFAULT '',
                  session_id TEXT NOT NULL DEFAULT '',
                  windows_user TEXT NOT NULL DEFAULT '',
                  hostname TEXT NOT NULL DEFAULT '',
                  token_hash TEXT NOT NULL UNIQUE,
                  created_at TEXT NOT NULL,
                  last_seen_at TEXT NOT NULL,
                  revoked INTEGER NOT NULL DEFAULT 0,
                  FOREIGN KEY(user_id) REFERENCES users(id),
                  UNIQUE(user_id, device_id)
                );
                CREATE TABLE IF NOT EXISTS audit_log (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  ts TEXT NOT NULL,
                  action TEXT NOT NULL,
                  username TEXT NOT NULL DEFAULT 'anonymous',
                  path TEXT NOT NULL DEFAULT '',
                  local_path TEXT NOT NULL DEFAULT '',
                  detail TEXT NOT NULL DEFAULT '',
                  meta_json TEXT NOT NULL DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON audit_log (ts DESC);
                CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (username);
                CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
                """
            )
            _migrate_device_session_columns(conn)
            conn.commit()
            _INITIALIZED = True
            path = db_path()
            return {
                "ok": True,
                "path": str(path),
                "engine": "sqlite",
                "shared": False,
                "location": "repo",
            }
        finally:
            conn.close()


def _migrate_device_session_columns(conn: sqlite3.Connection) -> None:
    """Idempotentne ALTER dla starszych baz bez machine_id / session_id."""
    cols = {
        r[1]
        for r in conn.execute("PRAGMA table_info(device_sessions)").fetchall()
    }
    alters = [
        ("machine_id", "ALTER TABLE device_sessions ADD COLUMN machine_id TEXT NOT NULL DEFAULT ''"),
        ("session_id", "ALTER TABLE device_sessions ADD COLUMN session_id TEXT NOT NULL DEFAULT ''"),
        ("windows_user", "ALTER TABLE device_sessions ADD COLUMN windows_user TEXT NOT NULL DEFAULT ''"),
        ("hostname", "ALTER TABLE device_sessions ADD COLUMN hostname TEXT NOT NULL DEFAULT ''"),
    ]
    for name, sql in alters:
        if name not in cols:
            conn.execute(sql)


def status() -> dict[str, Any]:
    path = db_path()
    try:
        init_db()
        with _LOCK:
            conn = connect()
            try:
                users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
                audits = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
                mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
            finally:
                conn.close()
        return {
            "ok": True,
            "engine": "sqlite",
            "path": str(path),
            "shared": False,
            "location": "repo",
            "wal": str(mode).lower() == "wal",
            "users": users,
            "audit_rows": audits,
            "docker_required": False,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "engine": "sqlite",
            "error": str(exc),
            "path": str(path),
            "shared": False,
            "location": "repo",
        }


def append_audit(entry: dict) -> dict[str, Any]:
    init_db()
    row = {
        "ts": entry.get("ts") or _utc(),
        "action": entry.get("action") or "unknown",
        "user": entry.get("user") or "anonymous",
        "path": entry.get("path") or "",
        "local_path": entry.get("local_path") or "",
        "detail": entry.get("detail") or "",
        "meta": entry.get("meta") or {},
    }
    meta_json = json.dumps(row["meta"], ensure_ascii=False)
    with _LOCK:
        conn = connect()
        try:
            cur = conn.execute(
                """
                INSERT INTO audit_log (ts, action, username, path, local_path, detail, meta_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["ts"],
                    row["action"],
                    row["user"],
                    row["path"],
                    row["local_path"],
                    row["detail"],
                    meta_json,
                ),
            )
            conn.commit()
            row["id"] = cur.lastrowid
        finally:
            conn.close()
    return {"ok": True, "entry": row, "store": "sqlite", "path": str(db_path())}


def read_audit(limit: int = 100) -> dict[str, Any]:
    init_db()
    lim = max(1, min(int(limit), 500))
    with _LOCK:
        conn = connect()
        try:
            rows = conn.execute(
                """
                SELECT id, ts, action, username, path, local_path, detail, meta_json
                FROM audit_log
                ORDER BY id DESC
                LIMIT ?
                """,
                (lim,),
            ).fetchall()
        finally:
            conn.close()
    items = []
    for r in rows:
        meta = {}
        try:
            meta = json.loads(r["meta_json"] or "{}")
        except json.JSONDecodeError:
            meta = {}
        items.append(
            {
                "id": r["id"],
                "ts": r["ts"],
                "action": r["action"],
                "user": r["username"],
                "path": r["path"],
                "local_path": r["local_path"],
                "detail": r["detail"],
                "meta": meta,
            }
        )
    return {"ok": True, "items": items, "store": "sqlite", "path": str(db_path())}
