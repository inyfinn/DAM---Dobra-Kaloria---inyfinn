# -*- coding: utf-8 -*-
"""
Konta DAM - Tier 1 (users / device_sessions).

Preferencja: PostgreSQL na Synology (ADR-009) gdy skonfigurowany pg-config.json.
Bez configu: SQLite lokalny (ADR-007).

Hasla: bcrypt. Sesja: machine_id + device_id + session_id + token.
Gdy PG skonfigurowany a niedostepny - jasny blad (bez cichego fallbacku na SQLite).
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import bcrypt  # type: ignore
except ImportError:  # pragma: no cover
    bcrypt = None

DESKTOP_DIR = Path(__file__).resolve().parent
DATA_DIR = DESKTOP_DIR / "data"


def _db_path() -> Path:
    from dam_db import db_path

    return db_path()


DB_PATH = _db_path()  # legacy alias; prefer db_path() at runtime
DB_PATH_LEGACY = DATA_DIR / "dam-auth.sqlite"
_LOCK = threading.Lock()

OWNER_EMAIL = "krzysztof.wieczorek@kubara.pl"
OWNER_NAME = "Krzysztof Wieczorek"
OWNER_ROLE = "admin"


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _use_pg() -> bool:
    try:
        from dam_db import use_postgres

        return use_postgres()
    except Exception:
        return False


def _connect():
    from dam_db import connect as dam_connect

    return dam_connect()


def _hash_password(password: str) -> str:
    if bcrypt is None:
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


MIN_PASSWORD_LEN = 10
# Hasla, ktore byly w publicznym repo / komunikatach commitow albo sa oczywiste.
_WEAK_PASSWORDS = frozenset(
    {
        "test", "test1234", "testtest", "password", "haslo", "haslo123", "12345678", "1234567890",
        "qwerty", "qwertyuiop", "admin", "admin123", "dam", "damdam", "kubara", "kubara123",
        "dobrakaloria", "goodcalories", "inyfinn", "zaq12wsx", "zaq1@wsx",
    }
)


def password_policy_error(password: str, email: str = "") -> str:
    """'' = haslo przechodzi. Inaczej kod bledu dla UI."""
    pw = str(password or "")
    if len(pw) < MIN_PASSWORD_LEN:
        return "password_too_short"
    low = pw.strip().lower()
    local = (email or "").split("@")[0].strip().lower()
    if low in _WEAK_PASSWORDS or (local and low == local) or len(set(low)) < 4:
        return "password_too_weak"
    return ""


_LOGIN_LOCK = threading.Lock()
_LOGIN_FAILS: dict[str, list[float]] = {}
_LOGIN_MAX_FAILS = 8
_LOGIN_WINDOW_S = 300.0


def _login_throttled(email_n: str) -> bool:
    now = time.time()
    with _LOGIN_LOCK:
        fails = [t for t in _LOGIN_FAILS.get(email_n, []) if now - t < _LOGIN_WINDOW_S]
        _LOGIN_FAILS[email_n] = fails
        return len(fails) >= _LOGIN_MAX_FAILS


def _login_failed(email_n: str) -> None:
    with _LOGIN_LOCK:
        _LOGIN_FAILS.setdefault(email_n, []).append(time.time())
        if len(_LOGIN_FAILS) > 2000:  # nie rosnij bez konca przy zgadywaniu emaili
            _LOGIN_FAILS.clear()


def _login_ok(email_n: str) -> None:
    with _LOGIN_LOCK:
        _LOGIN_FAILS.pop(email_n, None)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _row_get(row, key, default=None):
    if row is None:
        return default
    try:
        return row[key]
    except (KeyError, IndexError, TypeError):
        return default


def init_db() -> None:
    from dam_db import init_db as dam_init

    dam_init()


def ensure_owner_account(password: str) -> dict:
    init_db()
    with _LOCK:
        conn = _connect()
        try:
            if _use_pg():
                cur = conn.cursor()
                cur.execute(
                    "SELECT id, email, name, role FROM users WHERE LOWER(email) = LOWER(%s)",
                    (OWNER_EMAIL,),
                )
                row = cur.fetchone()
            else:
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
            if _use_pg():
                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, 'local', %s, %s)
                    RETURNING id
                    """,
                    (OWNER_EMAIL, OWNER_NAME, OWNER_ROLE, ph, now, now),
                )
                new_id = cur.fetchone()["id"]
                conn.commit()
            else:
                cur = conn.execute(
                    """
                    INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'local', ?, ?)
                    """,
                    (OWNER_EMAIL, OWNER_NAME, OWNER_ROLE, ph, now, now),
                )
                conn.commit()
                new_id = cur.lastrowid
            return {
                "ok": True,
                "created": True,
                "user": {
                    "id": new_id,
                    "email": OWNER_EMAIL,
                    "name": OWNER_NAME,
                    "role": OWNER_ROLE,
                    "auth_provider": "local",
                },
            }
        finally:
            conn.close()


def users_count() -> int:
    """Liczba kont - do bootstrapu pierwszej rejestracji."""
    init_db()
    conn = _connect()
    try:
        if _use_pg():
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) AS c FROM users")
            row = cur.fetchone()
            return int((row or {}).get("c") or 0)
        row = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()
        return int(row["c"] if row else 0)
    except Exception:
        return 0
    finally:
        conn.close()


def set_user_password(email: str, new_password: str) -> dict:
    """Ustaw haslo konta (skrypty go-live / admin ops). Polityka: password_policy_error."""
    init_db()
    email_n = (email or "").strip().lower()
    if not email_n or "@" not in email_n:
        return {"ok": False, "error": "invalid_email"}
    policy = password_policy_error(new_password, email_n)
    if policy:
        return {"ok": False, "error": policy}
    with _LOCK:
        conn = _connect()
        try:
            ph = _hash_password(new_password)
            now = _utc()
            if _use_pg():
                cur = conn.cursor()
                cur.execute(
                    """
                    UPDATE users
                    SET password_hash = %s, updated_at = %s
                    WHERE LOWER(email) = LOWER(%s)
                    RETURNING id, email
                    """,
                    (ph, now, email_n),
                )
                row = cur.fetchone()
                conn.commit()
            else:
                cur = conn.execute(
                    """
                    UPDATE users
                    SET password_hash = ?, updated_at = ?
                    WHERE email = ? COLLATE NOCASE
                    """,
                    (ph, now, email_n),
                )
                conn.commit()
                if cur.rowcount <= 0:
                    row = None
                else:
                    row = conn.execute(
                        "SELECT id, email FROM users WHERE email = ? COLLATE NOCASE",
                        (email_n,),
                    ).fetchone()
            if not row:
                return {"ok": False, "error": "user_not_found"}
            return {"ok": True, "email": row["email"], "id": row["id"]}
        finally:
            conn.close()


def register_user(email: str, password: str, name: str = "", role: str = "user") -> dict:
    init_db()
    email_n = (email or "").strip().lower()
    if not email_n or "@" not in email_n:
        return {"ok": False, "error": "invalid_email"}
    policy = password_policy_error(password, email_n)
    if policy:
        return {"ok": False, "error": policy}
    display = (name or email_n.split("@")[0]).strip()
    role_n = role if role in ("admin", "power_user", "user") else "user"
    with _LOCK:
        conn = _connect()
        try:
            if _use_pg():
                cur = conn.cursor()
                cur.execute(
                    "SELECT id FROM users WHERE LOWER(email) = LOWER(%s)", (email_n,)
                )
                exists = cur.fetchone()
            else:
                exists = conn.execute(
                    "SELECT id FROM users WHERE email = ? COLLATE NOCASE", (email_n,)
                ).fetchone()
            if exists:
                return {"ok": False, "error": "email_taken"}
            now = _utc()
            ph = _hash_password(password)
            if _use_pg():
                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, 'local', %s, %s)
                    RETURNING id
                    """,
                    (email_n, display, role_n, ph, now, now),
                )
                new_id = cur.fetchone()["id"]
                conn.commit()
            else:
                cur = conn.execute(
                    """
                    INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'local', ?, ?)
                    """,
                    (email_n, display, role_n, ph, now, now),
                )
                conn.commit()
                new_id = cur.lastrowid
            return {
                "ok": True,
                "user": {
                    "id": new_id,
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


# BETA (decyzja wlasciciela 2026-09-19): ekran zmiany slabego hasla mozna pominac.
# Ustaw False, gdy aplikacja wyjdzie z BETY - wtedy zmiana hasla znowu jest obowiazkowa.
APP_BETA = True


def login(
    email: str,
    password: str,
    device_id: str = "",
    machine_id: str = "",
    *,
    allow_weak_password: bool = False,
) -> dict:
    init_db()
    email_n = (email or "").strip().lower()
    identity = _current_identity()
    mid = (machine_id or identity.get("machine_id") or "").strip()
    if not mid:
        return {"ok": False, "error": "machine_id_required"}
    device = (identity.get("device_id") or "").strip() or (device_id or "").strip()
    if not device:
        device = "dam-dev-" + mid.replace("dam-mid-", "")
    try:
        from machine_identity import new_session_id

        session_id = new_session_id()
    except Exception:
        session_id = "dam-sid-" + secrets.token_urlsafe(24)

    with _LOCK:
        conn = _connect()
        try:
            if _use_pg():
                cur = conn.cursor()
                cur.execute(
                    "SELECT * FROM users WHERE LOWER(email) = LOWER(%s)", (email_n,)
                )
                row = cur.fetchone()
            else:
                row = conn.execute(
                    "SELECT * FROM users WHERE email = ? COLLATE NOCASE", (email_n,)
                ).fetchone()
            if _login_throttled(email_n):
                return {"ok": False, "error": "too_many_attempts"}
            if not row or not _verify_password(password, row["password_hash"]):
                _login_failed(email_n)
                return {"ok": False, "error": "invalid_credentials"}
            _login_ok(email_n)
            # Audyt 2026-09-17: konta seed mialy haslo "test" znane z publicznego repo.
            # Poprawne, ale slabe haslo NIE daje sesji - tylko prawo do zmiany hasla.
            if password_policy_error(password, email_n) and not allow_weak_password:
                return {"ok": False, "error": "password_change_required", "email": email_n}
            token = secrets.token_urlsafe(48)
            now = _utc()
            hostname = str(identity.get("hostname") or "")
            win_user = str(identity.get("windows_user") or "")
            th = _hash_token(token)
            if _use_pg():
                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO device_sessions (
                      user_id, device_id, machine_id, session_id, windows_user, hostname,
                      token_hash, created_at, last_seen_at, revoked
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, false)
                    ON CONFLICT (user_id, device_id) DO UPDATE SET
                      token_hash = EXCLUDED.token_hash,
                      machine_id = EXCLUDED.machine_id,
                      session_id = EXCLUDED.session_id,
                      windows_user = EXCLUDED.windows_user,
                      hostname = EXCLUDED.hostname,
                      last_seen_at = EXCLUDED.last_seen_at,
                      revoked = false
                    """,
                    (row["id"], device, mid, session_id, win_user, hostname, th, now, now),
                )
                conn.commit()
            else:
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
                    (row["id"], device, mid, session_id, win_user, hostname, th, now, now),
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


def change_password(email: str, old_password: str, new_password: str) -> dict:
    """Zmiana hasla przez wlasciciela konta (stare haslo jako dowod). Uniewaznia sesje konta."""
    init_db()
    email_n = (email or "").strip().lower()
    if not email_n or "@" not in email_n:
        return {"ok": False, "error": "invalid_email"}
    policy = password_policy_error(new_password, email_n)
    if policy:
        return {"ok": False, "error": policy}
    if new_password == old_password:
        return {"ok": False, "error": "password_unchanged"}
    if _login_throttled(email_n):
        return {"ok": False, "error": "too_many_attempts"}
    with _LOCK:
        conn = _connect()
        try:
            if _use_pg():
                cur = conn.cursor()
                cur.execute("SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER(%s)", (email_n,))
                row = cur.fetchone()
            else:
                row = conn.execute(
                    "SELECT id, password_hash FROM users WHERE email = ? COLLATE NOCASE", (email_n,)
                ).fetchone()
            if not row or not _verify_password(old_password or "", row["password_hash"]):
                _login_failed(email_n)
                return {"ok": False, "error": "invalid_credentials"}
            ph = _hash_password(new_password)
            now = _utc()
            if _use_pg():
                cur = conn.cursor()
                cur.execute(
                    "UPDATE users SET password_hash = %s, updated_at = %s WHERE id = %s",
                    (ph, now, row["id"]),
                )
                cur.execute("UPDATE device_sessions SET revoked = true WHERE user_id = %s", (row["id"],))
            else:
                conn.execute(
                    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                    (ph, now, row["id"]),
                )
                conn.execute("UPDATE device_sessions SET revoked = 1 WHERE user_id = ?", (row["id"],))
            conn.commit()
            _login_ok(email_n)
            return {"ok": True, "email": email_n}
        finally:
            conn.close()


def rehydrate_session(
    session_id: str = "",
    device_id: str = "",
    machine_id: str = "",
) -> dict:
    """
    Odswiez Bearer token bez hasla, gdy bound-session.json + machine_id
    zgadzaja sie z lokalnym wiazaniem (desktop: sesja = urzadzenie).
    """
    init_db()
    identity = _current_identity()
    # Audyt 2026-09-17: tozsamosc maszyny liczy most, nie wolajacy. Naglowek moze ja
    # najwyzej potwierdzic - inaczej kazdy, kto zna machine_id, odnawia cudza sesje.
    cur_mid = str(identity.get("machine_id") or "").strip()
    cur_dev = str(identity.get("device_id") or "").strip()
    if not cur_mid:
        return {"ok": False, "error": "machine_id_required"}
    # machine_id / device_id od wolajacego sa ignorowane (UI bywa przed /auth/identity
    # i wysyla tymczasowe "dev_pending_*"); liczy sie wylacznie tozsamosc lokalna.

    bound = None
    try:
        from machine_identity import read_bound_session

        bound = read_bound_session()
    except Exception:
        bound = None
    if not isinstance(bound, dict):
        return {"ok": False, "error": "no_bound_session"}

    bound_mid = str(bound.get("machine_id") or "").strip()
    bound_dev = str(bound.get("device_id") or "").strip()
    bound_sid = str(bound.get("session_id") or "").strip()
    bound_uid = None
    if bound.get("user_id") is not None:
        try:
            bound_uid = int(bound.get("user_id"))
        except (TypeError, ValueError):
            bound_uid = None
    if not cur_dev and bound_dev:
        cur_dev = bound_dev

    if bound_mid and bound_mid != cur_mid:
        return {"ok": False, "error": "machine_mismatch"}
    # session_id to sekret dzielony tylko przez UI (localStorage) i bound-session.json.
    # Bez niego odnowienie bez hasla bylo dostepne dla kazdego, kto siegnal do :8766
    # (inne konto Windows na tym PC, strona z DNS rebinding).
    sid = (session_id or "").strip()
    if not sid:
        return {"ok": False, "error": "session_id_required"}
    if not bound_sid or not secrets.compare_digest(sid.encode("utf-8"), bound_sid.encode("utf-8")):
        return {"ok": False, "error": "invalid_session"}

    with _LOCK:
        conn = _connect()
        try:
            row = None
            if _use_pg():
                cur = conn.cursor()
                if sid:
                    cur.execute(
                        """
                        SELECT s.user_id, s.device_id, s.machine_id, s.session_id, s.revoked,
                               u.id, u.email, u.name, u.role, u.auth_provider
                        FROM device_sessions s
                        JOIN users u ON u.id = s.user_id
                        WHERE s.session_id = %s
                        ORDER BY s.last_seen_at DESC NULLS LAST
                        LIMIT 1
                        """,
                        (sid,),
                    )
                    row = cur.fetchone()
                if not row and bound_uid is not None and cur_dev:
                    cur.execute(
                        """
                        SELECT s.user_id, s.device_id, s.machine_id, s.session_id, s.revoked,
                               u.id, u.email, u.name, u.role, u.auth_provider
                        FROM device_sessions s
                        JOIN users u ON u.id = s.user_id
                        WHERE s.user_id = %s AND s.device_id = %s AND s.revoked = false
                        ORDER BY s.last_seen_at DESC NULLS LAST
                        LIMIT 1
                        """,
                        (bound_uid, cur_dev),
                    )
                    row = cur.fetchone()
            else:
                if sid:
                    row = conn.execute(
                        """
                        SELECT s.user_id, s.device_id, s.machine_id, s.session_id, s.revoked,
                               u.id, u.email, u.name, u.role, u.auth_provider
                        FROM device_sessions s
                        JOIN users u ON u.id = s.user_id
                        WHERE s.session_id = ?
                        ORDER BY s.last_seen_at DESC
                        LIMIT 1
                        """,
                        (sid,),
                    ).fetchone()
                if not row and bound_uid is not None and cur_dev:
                    row = conn.execute(
                        """
                        SELECT s.user_id, s.device_id, s.machine_id, s.session_id, s.revoked,
                               u.id, u.email, u.name, u.role, u.auth_provider
                        FROM device_sessions s
                        JOIN users u ON u.id = s.user_id
                        WHERE s.user_id = ? AND s.device_id = ? AND s.revoked = 0
                        ORDER BY s.last_seen_at DESC
                        LIMIT 1
                        """,
                        (bound_uid, cur_dev),
                    ).fetchone()
            if not row or row["revoked"]:
                return {"ok": False, "error": "invalid_session"}
            stored_mid = (row["machine_id"] or "").strip()
            stored_dev = (row["device_id"] or "").strip()
            if stored_mid and stored_mid != cur_mid:
                return {"ok": False, "error": "machine_mismatch"}
            if cur_dev and stored_dev and stored_dev != cur_dev:
                return {"ok": False, "error": "device_mismatch"}

            token = secrets.token_urlsafe(48)
            th = _hash_token(token)
            now = _utc()
            hostname = str(identity.get("hostname") or "")
            win_user = str(identity.get("windows_user") or "")
            out_sid = (row["session_id"] or sid or "").strip()
            if not out_sid:
                try:
                    from machine_identity import new_session_id

                    out_sid = new_session_id()
                except Exception:
                    out_sid = "dam-sid-" + secrets.token_urlsafe(24)

            if _use_pg():
                cur = conn.cursor()
                cur.execute(
                    """
                    UPDATE device_sessions
                    SET token_hash = %s, machine_id = %s, session_id = %s,
                        windows_user = %s, hostname = %s, last_seen_at = %s, revoked = false
                    WHERE user_id = %s AND device_id = %s
                    """,
                    (
                        th,
                        cur_mid,
                        out_sid,
                        win_user,
                        hostname,
                        now,
                        row["user_id"],
                        stored_dev or cur_dev,
                    ),
                )
                conn.commit()
            else:
                conn.execute(
                    """
                    UPDATE device_sessions
                    SET token_hash = ?, machine_id = ?, session_id = ?,
                        windows_user = ?, hostname = ?, last_seen_at = ?, revoked = 0
                    WHERE user_id = ? AND device_id = ?
                    """,
                    (
                        th,
                        cur_mid,
                        out_sid,
                        win_user,
                        hostname,
                        now,
                        row["user_id"],
                        stored_dev or cur_dev,
                    ),
                )
                conn.commit()

            out_dev = stored_dev or cur_dev
            try:
                from machine_identity import write_bound_session

                write_bound_session(
                    {
                        "machine_id": cur_mid,
                        "device_id": out_dev,
                        "session_id": out_sid,
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
                "device_id": out_dev,
                "machine_id": cur_mid,
                "session_id": out_sid,
                "user": {
                    "id": row["id"],
                    "email": row["email"],
                    "name": row["name"],
                    "role": row["role"],
                    "auth_provider": row["auth_provider"],
                },
                "rehydrated": True,
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
            if _use_pg():
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT u.id, u.email, u.name, u.role, u.auth_provider,
                           s.device_id, s.machine_id, s.session_id, s.windows_user, s.hostname, s.revoked
                    FROM device_sessions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.token_hash = %s
                    """,
                    (th,),
                )
                row = cur.fetchone()
            else:
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
            if cur_mid and not stored_mid:
                if _use_pg():
                    cur = conn.cursor()
                    cur.execute(
                        """
                        UPDATE device_sessions
                        SET machine_id = %s, windows_user = %s, hostname = %s, last_seen_at = %s
                        WHERE token_hash = %s
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
                if _use_pg():
                    cur = conn.cursor()
                    cur.execute(
                        "UPDATE device_sessions SET last_seen_at = %s WHERE token_hash = %s",
                        (_utc(), th),
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


def logout(token: str) -> dict:
    """Uniewaznij sesje (Bearer) + skasuj bound-session (bez rehydrate po wylogowaniu)."""
    init_db()
    token = (token or "").strip()
    revoked = False
    if token:
        th = _hash_token(token)
        with _LOCK:
            conn = _connect()
            try:
                if _use_pg():
                    cur = conn.cursor()
                    cur.execute(
                        "UPDATE device_sessions SET revoked = true, last_seen_at = %s WHERE token_hash = %s",
                        (_utc(), th),
                    )
                    n = cur.rowcount or 0
                    conn.commit()
                else:
                    cur = conn.execute(
                        "UPDATE device_sessions SET revoked = 1, last_seen_at = ? WHERE token_hash = ?",
                        (_utc(), th),
                    )
                    n = cur.rowcount or 0
                    conn.commit()
                revoked = int(n) > 0
            finally:
                conn.close()
    try:
        from machine_identity import clear_bound_session

        clear_bound_session()
    except Exception:
        pass
    if not token:
        return {"ok": True, "revoked": False, "bound_cleared": True}
    return {"ok": True, "revoked": revoked, "bound_cleared": True}


def list_users() -> list[dict]:
    init_db()
    with _LOCK:
        conn = _connect()
        try:
            if _use_pg():
                cur = conn.cursor()
                cur.execute(
                    "SELECT id, email, name, role, auth_provider, created_at FROM users ORDER BY id"
                )
                rows = cur.fetchall()
                return [dict(r) for r in rows]
            rows = conn.execute(
                "SELECT id, email, name, role, auth_provider, created_at FROM users ORDER BY id"
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def seed_owner_from_env() -> dict:
    pw = os.environ.get("DAM_OWNER_PASSWORD", "").strip()
    if not pw:
        init_db()
        with _LOCK:
            conn = _connect()
            try:
                if _use_pg():
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT id FROM users WHERE LOWER(email) = LOWER(%s)",
                        (OWNER_EMAIL,),
                    )
                    row = cur.fetchone()
                else:
                    row = conn.execute(
                        "SELECT id FROM users WHERE email = ? COLLATE NOCASE",
                        (OWNER_EMAIL,),
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
