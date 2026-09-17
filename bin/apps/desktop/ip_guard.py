# -*- coding: utf-8 -*-
"""
Blokada IP po nieudanych logowaniach (jak Auto Block w Synology DSM).

Regula uzytkownika (2026-09-17): 3 bledne logowania z jednego IP w ciagu 999 minut
= IP zablokowane NA STALE. Odblokowuje tylko administrator. Biuro wychodzi jednym
adresem (89.25.208.179), wiec jest na bialej liscie - inaczej trzy literowki
jednej osoby odcielyby cala firme.

Dziala w trybie publicznym mostu (NAS za nginx: prawdziwy adres klienta w X-Real-IP).
W trybie pulpitowym klient to zawsze 127.0.0.1 - tam zostaje limit prob per konto
w auth_store. Stan lezy w bazie (Postgres albo SQLite), zeby przezyl restart mostu
i zeby admin mogl odblokowac z dowolnego komputera.

Zasada bezpieczenstwa: blad tego modulu NIE moze wylaczyc logowania wszystkim
(fail-open z logiem), ale zapisany blok zawsze obowiazuje.
"""
from __future__ import annotations

import ipaddress
import os
import threading
import time
from typing import Any, Callable

MAX_FAILURES = 3
WINDOW_S = 999 * 60
DEFAULT_ALLOWLIST = ("89.25.208.179",)

_LOCK = threading.Lock()
_SCHEMA_READY = False

_connect_override: Callable[[], Any] | None = None
_use_pg_override: Callable[[], bool] | None = None


def _use_pg() -> bool:
    if _use_pg_override is not None:
        return bool(_use_pg_override())
    try:
        from dam_db import use_postgres

        return bool(use_postgres())
    except Exception:
        return False


def _connect():
    if _connect_override is not None:
        return _connect_override()
    from dam_db import connect as dam_connect

    return dam_connect()


def _q(sql: str) -> str:
    return sql.replace("?", "%s") if _use_pg() else sql


def _exec(conn, sql: str, params: tuple = ()):
    if _use_pg():
        cur = conn.cursor()
        cur.execute(_q(sql), params)
        return cur
    return conn.execute(sql, params)


def normalize_ip(raw: str) -> str:
    """'' gdy to nie jest adres IP (nie ufamy smieciom z naglowka)."""
    val = str(raw or "").split(",")[0].strip()
    if val.startswith("[") and "]" in val:
        val = val[1 : val.index("]")]
    try:
        ip = ipaddress.ip_address(val)
    except ValueError:
        return ""
    if getattr(ip, "ipv4_mapped", None):
        ip = ip.ipv4_mapped
    return str(ip)


def allowlist() -> set[str]:
    out = {normalize_ip(x) for x in DEFAULT_ALLOWLIST}
    for item in (os.environ.get("DAM_IP_ALLOWLIST") or "").split(","):
        ip = normalize_ip(item)
        if ip:
            out.add(ip)
    out.discard("")
    return out


def is_exempt(ip: str) -> bool:
    n = normalize_ip(ip)
    if not n:
        return True  # brak wiarygodnego IP (tryb pulpitowy) - ten modul nie decyduje
    try:
        if ipaddress.ip_address(n).is_loopback:
            return True
    except ValueError:
        return True
    return n in allowlist()


def _ensure_schema(conn) -> None:
    global _SCHEMA_READY
    if _SCHEMA_READY:
        return
    _exec(
        conn,
        "CREATE TABLE IF NOT EXISTS auth_login_failures ("
        "ip TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', ts DOUBLE PRECISION NOT NULL)",
    )
    _exec(conn, "CREATE INDEX IF NOT EXISTS auth_login_failures_ip_idx ON auth_login_failures (ip, ts)")
    _exec(
        conn,
        "CREATE TABLE IF NOT EXISTS auth_ip_blocks ("
        "ip TEXT PRIMARY KEY, blocked_at DOUBLE PRECISION NOT NULL, "
        "reason TEXT NOT NULL DEFAULT '', last_email TEXT NOT NULL DEFAULT '')",
    )
    conn.commit()
    _SCHEMA_READY = True


def is_blocked(ip: str) -> bool:
    if is_exempt(ip):
        return False
    n = normalize_ip(ip)
    try:
        with _LOCK:
            conn = _connect()
            try:
                _ensure_schema(conn)
                row = _exec(conn, "SELECT 1 FROM auth_ip_blocks WHERE ip = ?", (n,)).fetchone()
                return row is not None
            finally:
                conn.close()
    except Exception as exc:  # noqa: BLE001
        print(f"[ip-guard] is_blocked error: {type(exc).__name__}")
        return False


def record_failure(ip: str, email: str = "") -> dict[str, Any]:
    """Zapisz nieudana probe. Zwraca {'blocked': bool, 'remaining': int}."""
    if is_exempt(ip):
        return {"blocked": False, "remaining": MAX_FAILURES, "exempt": True}
    n = normalize_ip(ip)
    now = time.time()
    try:
        with _LOCK:
            conn = _connect()
            try:
                _ensure_schema(conn)
                _exec(
                    conn,
                    "INSERT INTO auth_login_failures (ip, email, ts) VALUES (?, ?, ?)",
                    (n, str(email or "")[:200].lower(), now),
                )
                row = _exec(
                    conn,
                    "SELECT COUNT(*) AS n FROM auth_login_failures WHERE ip = ? AND ts >= ?",
                    (n, now - WINDOW_S),
                ).fetchone()
                count = int(row["n"] if hasattr(row, "keys") else row[0])
                blocked = count >= MAX_FAILURES
                if blocked:
                    exists = _exec(conn, "SELECT 1 FROM auth_ip_blocks WHERE ip = ?", (n,)).fetchone()
                    if exists is None:
                        _exec(
                            conn,
                            "INSERT INTO auth_ip_blocks (ip, blocked_at, reason, last_email) VALUES (?, ?, ?, ?)",
                            (n, now, f"{count} nieudanych logowan w {WINDOW_S // 60} min", str(email or "")[:200].lower()),
                        )
                # porzadek: stare wpisy poza oknem nie sa juz potrzebne
                _exec(conn, "DELETE FROM auth_login_failures WHERE ts < ?", (now - WINDOW_S,))
                conn.commit()
                return {"blocked": blocked, "remaining": max(0, MAX_FAILURES - count)}
            finally:
                conn.close()
    except Exception as exc:  # noqa: BLE001
        print(f"[ip-guard] record_failure error: {type(exc).__name__}")
        return {"blocked": False, "remaining": MAX_FAILURES, "error": True}


def record_success(ip: str) -> None:
    """Udane logowanie zeruje licznik literowek tego IP (blokady NIE zdejmuje)."""
    if is_exempt(ip):
        return
    n = normalize_ip(ip)
    try:
        with _LOCK:
            conn = _connect()
            try:
                _ensure_schema(conn)
                _exec(conn, "DELETE FROM auth_login_failures WHERE ip = ?", (n,))
                conn.commit()
            finally:
                conn.close()
    except Exception as exc:  # noqa: BLE001
        print(f"[ip-guard] record_success error: {type(exc).__name__}")


def list_blocks() -> list[dict[str, Any]]:
    try:
        with _LOCK:
            conn = _connect()
            try:
                _ensure_schema(conn)
                rows = _exec(
                    conn, "SELECT ip, blocked_at, reason, last_email FROM auth_ip_blocks ORDER BY blocked_at DESC"
                ).fetchall()
                out = []
                for r in rows:
                    keyed = hasattr(r, "keys")
                    out.append(
                        {
                            "ip": r["ip"] if keyed else r[0],
                            "blocked_at": float(r["blocked_at"] if keyed else r[1]),
                            "reason": r["reason"] if keyed else r[2],
                            "last_email": r["last_email"] if keyed else r[3],
                        }
                    )
                return out
            finally:
                conn.close()
    except Exception as exc:  # noqa: BLE001
        print(f"[ip-guard] list_blocks error: {type(exc).__name__}")
        return []


def unblock(ip: str) -> bool:
    n = normalize_ip(ip)
    if not n:
        return False
    try:
        with _LOCK:
            conn = _connect()
            try:
                _ensure_schema(conn)
                _exec(conn, "DELETE FROM auth_ip_blocks WHERE ip = ?", (n,))
                _exec(conn, "DELETE FROM auth_login_failures WHERE ip = ?", (n,))
                conn.commit()
                return True
            finally:
                conn.close()
    except Exception as exc:  # noqa: BLE001
        print(f"[ip-guard] unblock error: {type(exc).__name__}")
        return False
