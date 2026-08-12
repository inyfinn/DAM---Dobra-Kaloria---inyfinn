# -*- coding: utf-8 -*-
"""
Wspolna baza PostgreSQL (Synology, ADR-009).

Tier 1 (users/device_sessions/audit_log): ZAWSZE zywe zapytania - zero cache.
Tier 2 (dam_kv_store): kazdy dzisiejszy plik JSON z apps/web/data/ = jeden
wiersz JSONB. Zapis idzie tutaj + od razu do lokalnego cache (patrz
local_bridge.py: _load_json/_save_json). Co 30 min watcher odswieza WSZYSTKIE
lokalne cache ze stanu w bazie (patrz _kv_cache_watcher w local_bridge.py).

Config (kolejnosc ladowania):
  1) zmienne DAM_PG_* / apps/desktop/dam-connection.env
  2) apps/desktop/data/pg-config.json (gitignored)
Szablon: pg-config.example.json + dam-connection.env.example.

hosts: priorytet DDNS inyfinn.synology.me, LAN (192.168.x) TYLKO awaryjnie.
connect() zawsze stawia hostname/DDNS przed prywatnymi IP. Port 5433 na routerze.
QuickConnect / :5001 = panel DSM, NIE Postgres.

Jesli baza niedostepna - pg_db.connect() rzuca OperationalError.
Warstwa dam_db.connect() lapie to i wchodzi w tryb OFFLINE (SQLite lokalny
+ hint NAT/CGNAT/DDNS + DATABASE/ z GitHub). To NIE jest ciche udawanie online.
"""
from __future__ import annotations

import ipaddress
import json
import os
import threading
from pathlib import Path
from typing import Any

try:
    import psycopg2
    import psycopg2.extras
except ImportError:  # pragma: no cover - brak psycopg2-binary w requirements
    psycopg2 = None

DESKTOP_DIR = Path(__file__).resolve().parent
CONFIG_PATH = DESKTOP_DIR / "data" / "pg-config.json"
ENV_PATH = DESKTOP_DIR / "dam-connection.env"
CONFIG_EXAMPLE_PATH = DESKTOP_DIR / "pg-config.example.json"
_LOCK = threading.Lock()
_CONFIG_CACHE: dict[str, Any] | None = None
_LAST_HOST: str | None = None


class PgNotConfigured(RuntimeError):
    """Brak apps/desktop/data/pg-config.json i zmiennych DAM_PG_* - patrz pg-config.example.json."""


def _load_dotenv_file(path: Path) -> None:
    """Minimalny loader KEY=VALUE (bez zaleznosci python-dotenv). Nie nadpisuje juz ustawionych env."""
    if not path.is_file():
        return
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = val
    except OSError:
        pass


def _is_private_host(host: str) -> bool:
    """True dla 192.168/10/172.16 - LAN ma byc po DDNS, nie przed."""
    h = (host or "").strip().lower()
    if not h or h in ("localhost", "127.0.0.1", "::1"):
        return True
    try:
        return ipaddress.ip_address(h).is_private
    except ValueError:
        # hostname (inyfinn.synology.me) = nie prywatny -> priorytet DDNS
        return False


def _prefer_ddns_first(hosts: list[str]) -> list[str]:
    public: list[str] = []
    private: list[str] = []
    for h in hosts:
        (private if _is_private_host(h) else public).append(h)
    return public + private


def _hosts_from_cfg(cfg: dict[str, Any]) -> list[str]:
    hosts: list[str] = []
    env_hosts = os.environ.get("DAM_PG_HOSTS", "").strip()
    if env_hosts:
        hosts.extend([h.strip() for h in env_hosts.split(",") if h.strip()])
    raw = cfg.get("hosts")
    if isinstance(raw, list):
        hosts.extend([str(h).strip() for h in raw if str(h).strip()])
    primary = (cfg.get("host") or "").strip()
    if primary:
        hosts.append(primary)
    # unikalne, zachowaj kolejnosc
    seen: set[str] = set()
    out: list[str] = []
    for h in hosts:
        if h not in seen:
            seen.add(h)
            out.append(h)
    return _prefer_ddns_first(out)


def _load_config() -> dict[str, Any]:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return _CONFIG_CACHE
    _load_dotenv_file(ENV_PATH)
    cfg: dict[str, Any] = {}
    if CONFIG_PATH.is_file():
        try:
            cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            cfg = {}
    cfg["host"] = os.environ.get("DAM_PG_HOST", cfg.get("host", ""))
    cfg["port"] = int(os.environ.get("DAM_PG_PORT", cfg.get("port", 5433)))
    cfg["dbname"] = os.environ.get("DAM_PG_DBNAME", cfg.get("dbname", "dam_eta"))
    cfg["user"] = os.environ.get("DAM_PG_USER", cfg.get("user", "dam_eta"))
    cfg["password"] = os.environ.get("DAM_PG_PASSWORD", cfg.get("password", ""))
    cfg["hosts"] = _hosts_from_cfg(cfg)
    if (not cfg.get("hosts") and not cfg.get("host")) or not cfg.get("password"):
        raise PgNotConfigured(
            f"Brak konfiguracji Postgresa. Skopiuj {CONFIG_EXAMPLE_PATH.name} do "
            f"{CONFIG_PATH} (albo dam-connection.env) i wypelnij haslo."
        )
    if not cfg["hosts"]:
        cfg["hosts"] = [cfg["host"]]
    _CONFIG_CACHE = cfg
    return cfg


def reset_config_cache() -> None:
    global _CONFIG_CACHE, _LAST_HOST
    _CONFIG_CACHE = None
    _LAST_HOST = None


def is_configured() -> bool:
    try:
        _load_config()
        return True
    except PgNotConfigured:
        return False


def last_host() -> str | None:
    return _LAST_HOST


def connect():
    """Polaczenie psycopg2: DDNS najpierw, LAN tylko awaryjnie. RealDictCursor."""
    global _LAST_HOST
    if psycopg2 is None:
        raise RuntimeError("psycopg2-binary nie jest zainstalowany (patrz apps/desktop/requirements.txt)")
    cfg = _load_config()
    errors: list[str] = []
    # DDNS/public zawsze przed LAN; sticky last-host tylko gdy to nie LAN
    ordered = _prefer_ddns_first(list(cfg["hosts"]))
    if _LAST_HOST and _LAST_HOST in ordered and not _is_private_host(_LAST_HOST):
        ordered = [_LAST_HOST] + [h for h in ordered if h != _LAST_HOST]
    last_exc: Exception | None = None
    for host in ordered:
        try:
            conn = psycopg2.connect(
                host=host,
                port=cfg["port"],
                dbname=cfg["dbname"],
                user=cfg["user"],
                password=cfg["password"],
                connect_timeout=2,
                cursor_factory=psycopg2.extras.RealDictCursor,
            )
            _LAST_HOST = host
            return conn
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            errors.append(f"{host}:{cfg['port']} -> {exc}")
            continue
    msg = "Postgres niedostepny na zadnym hoscie. " + " | ".join(errors)
    raise psycopg2.OperationalError(msg) if psycopg2 else RuntimeError(msg)


def ping() -> dict[str, Any]:
    try:
        conn = connect()
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
            return {
                "ok": True,
                "configured": True,
                "host": _LAST_HOST,
                "hosts": _load_config().get("hosts"),
            }
        finally:
            conn.close()
    except PgNotConfigured as exc:
        return {"ok": False, "configured": False, "error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "configured": True, "error": str(exc)}


# --------------------------------------------------------------------------
# Tier 2: dam_kv_store - jeden wiersz = jeden dzisiejszy plik JSON
# --------------------------------------------------------------------------

def kv_get(store_key: str, default: Any) -> Any:
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute("SELECT payload FROM dam_kv_store WHERE store_key = %s", (store_key,))
        row = cur.fetchone()
        if not row:
            return default
        return row["payload"]
    finally:
        conn.close()


def _as_jsonb(payload: Any):
    """psycopg2 Json adapter - bezpieczny zapis do kolumny JSONB."""
    return psycopg2.extras.Json(payload)


def kv_set(store_key: str, payload: Any, updated_by: str = "") -> None:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO dam_kv_store (store_key, payload, updated_at, updated_by)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (store_key) DO UPDATE SET
              payload = excluded.payload,
              updated_at = excluded.updated_at,
              updated_by = excluded.updated_by
            """,
            (store_key, _as_jsonb(payload), now, updated_by),
        )
        conn.commit()
    finally:
        conn.close()


def kv_get_for_update(store_key: str, default: Any, cur) -> Any:
    """Do uzycia W TRANSAKCJI (SELECT ... FOR UPDATE) - zapobiega utracie zmian
    gdy dwie decyzje moderacyjne przychodza rownolegle z dwoch stacji."""
    cur.execute("SELECT payload FROM dam_kv_store WHERE store_key = %s FOR UPDATE", (store_key,))
    row = cur.fetchone()
    if not row:
        return default
    return row["payload"]


def kv_set_in_txn(store_key: str, payload: Any, updated_by: str, cur) -> None:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        """
        INSERT INTO dam_kv_store (store_key, payload, updated_at, updated_by)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (store_key) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
        """,
        (store_key, _as_jsonb(payload), now, updated_by),
    )


def kv_all_keys() -> list[str]:
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute("SELECT store_key FROM dam_kv_store ORDER BY store_key")
        return [r["store_key"] for r in cur.fetchall()]
    finally:
        conn.close()
