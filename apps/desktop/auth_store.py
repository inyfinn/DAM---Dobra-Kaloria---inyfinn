"""
Lokalna baza kont DAM (SQLite).

Hasla: bcrypt (jednokierunkowy hash - nie da sie odtworzyc hasla z bazy).
Sesja: machine_id + device_id + session_id + token.
  - machine_id pochodzi z OS (MachineGuid + host + Windows user) - nie z przegladarki
  - token bez wygasania na TEJ maszynie; na innym PC / innym koncie Windows = mismatch
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

try:
    import bcrypt  # type: ignore
except ImportError:  # pragma: no cover
    bcrypt = None

DESKTOP_DIR = Path(__file__).resolve().parent
DATA_DIR = DESKTOP_DIR / "data"
# ADR-007: SQLite TYLKO w repo (apps/desktop/data/dam-local.sqlite) via dam_db
DB_PATH = DATA_DIR / "dam-local.sqlite"
DB_PATH_LEGACY = DATA_DIR / "dam-auth.sqlite"
_LOCK = threading.Lock()

# Konto wlasciciela (seed przy pierwszym starcie)
OWNER_EMAIL = "krzysztof.wieczorek@kubara.pl"
OWNER_NAME = "Krzysztof Wieczorek"
OWNER_ROLE = "admin"


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _db_file() -> Path:
    try:
        from dam_db import db_path

        return db_path()
    except Exception:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if DB_PATH.is_file():
            return DB_PATH
        if DB_PATH_LEGACY.is_file():
            return DB_PATH_LEGACY
        return DB_PATH


def _connect() -> sqlite3.Connection:
    try:
        from dam_db import connect as dam_connect

        return dam_connect()
    except Exception:
        path = _db_file()
        conn = sqlite3.connect(str(path), check_same_thread=False, timeout=60)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute("PRAGMA busy_timeout = 60000")
        return conn


def _hash_password(password: str) -> str:
    if bcrypt is None:
        # Fallback PBKDF2 gdy brak bcrypt (i tak nie plaintext)
        salt = secrets.token_hex(16)
        dig = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 390000)
        return "pbkdf2$" + salt + "$" + dig.hex()
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _verify_password(password: str, stored: str) -> bool:
    if not stored:
        return False
    if stored.startswith("pbkdf2$"):
        _, salt, hexdig = stored.split("$", 2)
        dig = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 390000)
        return secrets.compare_digest(dig.hex(), hexdig)
    if bcrypt is None:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored.encode("utf-8"))
    except ValueError:
        return False


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def init_db() -> None:
    """Auth + audit w jednej SQLite (ADR-007)."""
    try:
        from dam_db import init_db as dam_init

        dam_init()
        return
    except Exception:
        pass
    with _LOCK:
        conn = _connect()
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
                  token_hash TEXT NOT NULL UNIQUE,
                  created_at TEXT NOT NULL,
                  last_seen_at TEXT NOT NULL,
                  revoked INTEGER NOT NULL DEFAULT 0,
                  FOREIGN KEY(user_id) REFERENCES users(id),
                  UNIQUE(user_id, device_id)
                );
                """
            )
            conn.commit()
        finally:
            conn.close()


def ensure_owner_account(password: str) -> dict:
    """Utworz / zaktualizuj konto wlasciciela (haslo tylko jesli konto nowe lub force)."""
    init_db()
    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT id, email, name, role FROM users WHERE email = ? COLLATE NOCASE",
                (OWNER_EMAIL,),
            ).fetchone()
            now = _utc()
            if row:
                return {
                    "ok": True,
                    "created": False,
                    "user": {
                        "id": row["id"],
                        "email": row["email"],
                        "name": row["name"],
                        "role": row["role"],
                        "auth_provider": "local",
                    },
                }
            ph = _hash_password(password)
            cur = conn.execute(
                """
                INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'local', ?, ?)
                """,
                (OWNER_EMAIL, OWNER_NAME, OWNER_ROLE, ph, now, now),
            )
            conn.commit()
            return {
                "ok": True,
                "created": True,
                "user": {
                    "id": cur.lastrowid,
                    "email": OWNER_EMAIL,
                    "name": OWNER_NAME,
                    "role": OWNER_ROLE,
                    "auth_provider": "local",
                },
            }
        finally:
            conn.close()


def register_user(email: str, password: str, name: str = "", role: str = "user") -> dict:
    init_db()
    email_n = (email or "").strip().lower()
    if not email_n or "@" not in email_n:
        return {"ok": False, "error": "invalid_email"}
    # Lokalne konta testowe: min 4 (np. "test"). Produkcja: Entra/LDAP.
    if not password or len(password) < 4:
        return {"ok": False, "error": "password_too_short"}
    display = (name or email_n.split("@")[0]).strip()
    role_n = role if role in ("admin", "power_user", "user") else "user"
    with _LOCK:
        conn = _connect()
        try:
            exists = conn.execute(
                "SELECT id FROM users WHERE email = ? COLLATE NOCASE", (email_n,)
            ).fetchone()
            if exists:
                return {"ok": False, "error": "email_taken"}
            now = _utc()
            cur = conn.execute(
                """
                INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'local', ?, ?)
                """,
                (email_n, display, role_n, _hash_password(password), now, now),
            )
            conn.commit()
            return {
                "ok": True,
                "user": {
                    "id": cur.lastrowid,
                    "email": email_n,
                    "name": display,
                    "role": role_n,
                    "auth_provider": "local",
                },
            }
        finally:
            conn.close()


def _current_identity() -> dict:
    try:
        from machine_identity import collect_identity

        return collect_identity()
    except Exception:
        return {
            "machine_id": "",
            "device_id": "",
            "hostname": "",
            "windows_user": "",
        }


def login(
    email: str,
    password: str,
    device_id: str = "",
    machine_id: str = "",
) -> dict:
    init_db()
    email_n = (email or "").strip().lower()
    identity = _current_identity()
    mid = (machine_id or identity.get("machine_id") or "").strip()
    if not mid:
        return {"ok": False, "error": "machine_id_required"}
    # device_id ZAWSZE z maszyny - nie ufaj losowemu ID z localStorage innego PC
    device = (identity.get("device_id") or "").strip() or (device_id or "").strip()
    if not device:
        device = "dam-dev-" + mid.replace("dam-mid-", "")
    session_id = ""
    try:
        from machine_identity import new_session_id, write_bound_session

        session_id = new_session_id()
    except Exception:
        session_id = "dam-sid-" + secrets.token_urlsafe(24)

    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT * FROM users WHERE email = ? COLLATE NOCASE", (email_n,)
            ).fetchone()
            if not row or not _verify_password(password, row["password_hash"]):
                return {"ok": False, "error": "invalid_credentials"}
            token = secrets.token_urlsafe(48)
            now = _utc()
            hostname = str(identity.get("hostname") or "")
            win_user = str(identity.get("windows_user") or "")
            conn.execute(
                """
                INSERT INTO device_sessions (
                  user_id, device_id, machine_id, session_id, windows_user, hostname,
                  token_hash, created_at, last_seen_at, revoked
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                ON CONFLICT(user_id, device_id) DO UPDATE SET
                  token_hash = excluded.token_hash,
                  machine_id = excluded.machine_id,
                  session_id = excluded.session_id,
                  windows_user = excluded.windows_user,
                  hostname = excluded.hostname,
                  last_seen_at = excluded.last_seen_at,
                  revoked = 0
                """,
                (
                    row["id"],
                    device,
                    mid,
                    session_id,
                    win_user,
                    hostname,
                    _hash_token(token),
                    now,
                    now,
                ),
            )
            conn.commit()
            try:
                from machine_identity import write_bound_session

                write_bound_session(
                    {
                        "machine_id": mid,
                        "device_id": device,
                        "session_id": session_id,
                        "windows_user": win_user,
                        "hostname": hostname,
                        "user_email": row["email"],
                        "user_id": row["id"],
                        "bound_at": now,
                    }
                )
            except Exception:
                pass
            return {
                "ok": True,
                "token": token,
                "device_id": device,
                "machine_id": mid,
                "session_id": session_id,
                "user": {
                    "id": row["id"],
                    "email": row["email"],
                    "name": row["name"],
                    "role": row["role"],
                    "auth_provider": row["auth_provider"],
                },
            }
        finally:
            conn.close()


def resolve_session(
    token: str,
    device_id: str = "",
    machine_id: str = "",
) -> dict:
    init_db()
    token = (token or "").strip()
    if not token:
        return {"ok": False, "error": "no_token"}
    identity = _current_identity()
    cur_mid = (machine_id or identity.get("machine_id") or "").strip()
    cur_dev = (device_id or identity.get("device_id") or "").strip()
    th = _hash_token(token)
    with _LOCK:
        conn = _connect()
        try:
            row = conn.execute(
                """
                SELECT u.id, u.email, u.name, u.role, u.auth_provider,
                       s.device_id, s.machine_id, s.session_id, s.windows_user, s.hostname, s.revoked
                FROM device_sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token_hash = ?
                """,
                (th,),
            ).fetchone()
            if not row or row["revoked"]:
                return {"ok": False, "error": "invalid_session"}
            stored_mid = (row["machine_id"] or "").strip()
            stored_dev = (row["device_id"] or "").strip()
            if cur_mid and stored_mid and stored_mid != cur_mid:
                return {"ok": False, "error": "machine_mismatch"}
            if cur_dev and stored_dev and stored_dev != cur_dev:
                return {"ok": False, "error": "device_mismatch"}
            # Gdy stara sesja bez machine_id - dopisz biezace (jednorazowa migracja)
            if cur_mid and not stored_mid:
                conn.execute(
                    """
                    UPDATE device_sessions
                    SET machine_id = ?, windows_user = ?, hostname = ?, last_seen_at = ?
                    WHERE token_hash = ?
                    """,
                    (
                        cur_mid,
                        str(identity.get("windows_user") or ""),
                        str(identity.get("hostname") or ""),
                        _utc(),
                        th,
                    ),
                )
            else:
                conn.execute(
                    "UPDATE device_sessions SET last_seen_at = ? WHERE token_hash = ?",
                    (_utc(), th),
                )
            conn.commit()
            return {
                "ok": True,
                "device_id": stored_dev or cur_dev,
                "machine_id": stored_mid or cur_mid,
                "session_id": row["session_id"] or "",
                "user": {
                    "id": row["id"],
                    "email": row["email"],
                    "name": row["name"],
                    "role": row["role"],
                    "auth_provider": row["auth_provider"],
                },
            }
        finally:
            conn.close()


def list_users() -> list[dict]:
    init_db()
    with _LOCK:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT id, email, name, role, auth_provider, created_at FROM users ORDER BY id"
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def seed_owner_from_env() -> dict:
    """Haslo wlasciciela z env DAM_OWNER_PASSWORD albo argumentu przy bootstrap."""
    pw = os.environ.get("DAM_OWNER_PASSWORD", "").strip()
    if not pw:
        # Bootstrap tylko gdy brak konta - haslo musi byc podane zewnetrznie przy seed
        init_db()
        with _LOCK:
            conn = _connect()
            try:
                row = conn.execute(
                    "SELECT id FROM users WHERE email = ? COLLATE NOCASE", (OWNER_EMAIL,)
                ).fetchone()
                if row:
                    return {"ok": True, "created": False, "skipped_password": True}
            finally:
                conn.close()
        return {"ok": False, "error": "DAM_OWNER_PASSWORD not set"}
    return ensure_owner_account(pw)


if __name__ == "__main__":
    import sys

    pw = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DAM_OWNER_PASSWORD", "")
    if not pw:
        print("Usage: python auth_store.py <password>")
        raise SystemExit(2)
    print(json.dumps(ensure_owner_account(pw), ensure_ascii=False, indent=2))
