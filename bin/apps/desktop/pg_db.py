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
Instalator wgrywa data/pg-config.json. Uzytkownik nic nie kopiuje.

hosts: priorytet DDNS inyfinn.synology.me, LAN (192.168.x) TYLKO awaryjnie.
connect() uzywa JEDNEGO hosta z konfiguracji (krotki timeout).
Ping HTTP czyta zapamietany wynik watku zdrowia - nigdy nie czeka na NAS.

Jesli baza niedostepna - pg_db.connect() rzuca OperationalError.
Warstwa dam_db lapie to: przegladanie zostaje, zapis jest wstrzymany.
"""
from __future__ import annotations

import ipaddress
import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import psycopg2
    import psycopg2.extras
except ImportError:  # pragma: no cover - brak psycopg2-binary w requirements
    psycopg2 = None

try:
    import pg_seal
except Exception:  # pragma: no cover - modul musi byc w instalatorze
    pg_seal = None  # type: ignore[assignment]

DESKTOP_DIR = Path(__file__).resolve().parent
CONFIG_PATH = DESKTOP_DIR / "data" / "pg-config.json"
ENV_PATH = DESKTOP_DIR / "dam-connection.env"
CONFIG_EXAMPLE_PATH = DESKTOP_DIR / "pg-config.example.json"
_LOCK = threading.Lock()
_CONFIG_CACHE: dict[str, Any] | None = None
_LAST_HOST: str | None = None
_CONNECT_TIMEOUT_S = 1
_HEALTH_INTERVAL_S = 5.0
_HEALTH: dict[str, Any] = {
    "ok": False,
    "configured": False,
    "host": None,
    "error": "health_pending",
    "checked_at": 0.0,
    "latency_ms": 0.0,
}
_HEALTH_THREAD: threading.Thread | None = None
_INDEX_READY = False


class PgNotConfigured(RuntimeError):
    """Brak wgranego pg-config.json (instalator powinien to zrobic sam)."""


class StaleKvVersion(Exception):
    """Zapis odrzucony: w bazie updated_at jest nowszy niz wersja wolajacego."""

    def __init__(self, store_key: str, current_updated_at: str):
        self.store_key = store_key
        self.current_updated_at = current_updated_at
        super().__init__(f"stale_version:{store_key}")


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
    seen: set[str] = set()
    out: list[str] = []
    for h in hosts:
        if h not in seen:
            seen.add(h)
            out.append(h)
    return _prefer_ddns_first(out)


def _is_dev_tree() -> bool:
    """Repo z .git = maszyna budujaca: jawny pg-config.json (gitignored) jest zrodlem builda."""
    try:
        git = DESKTOP_DIR.parent.parent.parent / ".git"
        return git.is_dir() or git.is_file()
    except OSError:
        return False


def _plaintext_copies() -> list[Path]:
    return [
        CONFIG_PATH,
        DESKTOP_DIR / "pg-config.json",
        DESKTOP_DIR / "data" / "pg-config.json.off",
        DESKTOP_DIR / "data" / "pg-config.bundled.json",
    ]


def _migrate_plaintext_to_dpapi(cfg: dict[str, Any]) -> None:
    """Instalacja uzytkownika: haslo nie lezy jawnie na dysku. Kasuj dopiero po udanym DPAPI."""
    if pg_seal is None or _is_dev_tree() or not cfg.get("password"):
        return
    if not pg_seal.store_protected(cfg):
        return
    for path in _plaintext_copies():
        try:
            if path.is_file() and _pg_config_looks_ready(path):
                path.unlink()
        except OSError:
            continue


def _read_stored_config() -> dict[str, Any]:
    """Jawny plik (dev / stara instalacja) albo konfiguracja pod DPAPI (po aktywacji)."""
    cfg: dict[str, Any] = {}
    if CONFIG_PATH.is_file():
        try:
            loaded = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            cfg = loaded if isinstance(loaded, dict) else {}
        except (OSError, ValueError):
            cfg = {}
    if cfg.get("password"):
        _migrate_plaintext_to_dpapi(cfg)
        return cfg
    if pg_seal is not None:
        prot = pg_seal.load_protected()
        if prot:
            return prot
    return cfg


def raw_config_mapping() -> dict[str, Any]:
    """Dla modulow, ktore trzymaja sekrety obok (np. token GitHub aktualizatora)."""
    try:
        return dict(_read_stored_config())
    except Exception:
        return {}


def activation_required() -> bool:
    """True = instalacja ma zapieczetowana konfiguracje i czeka na kod aktywacyjny."""
    if pg_seal is None or not pg_seal.sealed_present():
        return False
    return not is_configured()


def activate(code: str) -> dict[str, Any]:
    if pg_seal is None:
        return {"ok": False, "error": "pg_seal_missing"}
    res = pg_seal.activate(code)
    if res.get("ok"):
        reset_config_cache()
    return res


def _load_config() -> dict[str, Any]:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return _CONFIG_CACHE
    _load_dotenv_file(ENV_PATH)
    cfg = _read_stored_config()
    cfg["host"] = os.environ.get("DAM_PG_HOST", cfg.get("host", ""))
    cfg["port"] = int(os.environ.get("DAM_PG_PORT", cfg.get("port", 5433)))
    cfg["dbname"] = os.environ.get("DAM_PG_DBNAME", cfg.get("dbname", "dam_eta"))
    cfg["user"] = os.environ.get("DAM_PG_USER", cfg.get("user", "dam_eta"))
    cfg["password"] = os.environ.get("DAM_PG_PASSWORD", cfg.get("password", ""))
    # TLS do Synology (self-signed server.crt). require = szyfr bez weryfikacji CA.
    # verify-full tylko gdy dam_pg_root.crt jest w data/.
    allowed_ssl = {
        "disable",
        "allow",
        "prefer",
        "require",
        "verify-ca",
        "verify-full",
    }
    sslmode = str(
        os.environ.get("DAM_PG_SSLMODE", cfg.get("sslmode", "require")) or "require"
    ).strip().lower()
    if sslmode not in allowed_ssl:
        sslmode = "require"
    cfg["sslmode"] = sslmode
    root_crt = cfg.get("sslrootcert") or ""
    if not root_crt:
        cand = DESKTOP_DIR / "data" / "dam_pg_root.crt"
        if cand.is_file():
            root_crt = str(cand)
    cfg["sslrootcert"] = str(root_crt or "")
    cfg["hosts"] = _hosts_from_cfg(cfg)
    if (not cfg.get("hosts") and not cfg.get("host")) or not cfg.get("password"):
        raise PgNotConfigured("Baza Synology nie jest skonfigurowana.")
    if not cfg["hosts"]:
        cfg["hosts"] = [cfg["host"]]
    _CONFIG_CACHE = cfg
    return cfg


def reset_config_cache() -> None:
    global _CONFIG_CACHE, _LAST_HOST
    _CONFIG_CACHE = None
    _LAST_HOST = None


def _pg_config_looks_ready(path: Path) -> bool:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            return False
        pw = str(raw.get("password") or "")
        hosts = raw.get("hosts") or raw.get("host")
        return bool(pw) and bool(hosts)
    except Exception:
        return False


def _pg_config_candidates() -> list[Path]:
    """Staged Setup file, bundled copy, then installed Programs\\DAM (dummy user never copies)."""
    local = os.environ.get("LOCALAPPDATA") or ""
    install_desktop = Path(local) / "Programs" / "DAM" / "bin" / "apps" / "desktop"
    env_path = (os.environ.get("DAM_PG_CONFIG") or "").strip()
    out: list[Path] = []
    if env_path:
        out.append(Path(env_path))
    out.extend(
        [
            DESKTOP_DIR / "pg-config.json",
            DESKTOP_DIR / "data" / "pg-config.json",
            DESKTOP_DIR / "data" / "pg-config.json.off",
            DESKTOP_DIR / "data" / "pg-config.bundled.json",
            install_desktop / "data" / "pg-config.json",
            install_desktop / "pg-config.json",
            install_desktop / "data" / "pg-config.json.off",
            install_desktop / "data" / "pg-config.bundled.json",
        ]
    )
    return out


def ensure_pg_config_example_in_data() -> None:
    """First-run: szablon example zostaje w data/ (IT). Live = pg-config.json z Setupu."""
    dest = DESKTOP_DIR / "data" / "pg-config.example.json"
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.is_file() or not CONFIG_EXAMPLE_PATH.is_file():
            return
        dest.write_bytes(CONFIG_EXAMPLE_PATH.read_bytes())
    except OSError:
        return


def ensure_pg_config_ready() -> None:
    """First-run: wgraj passworded pg-config z drzewa Setupu. Zero krokow uzytkownika."""
    dest = CONFIG_PATH
    try:
        if pg_seal is not None and pg_seal.load_protected():
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.is_file() and _pg_config_looks_ready(dest):
            return
        dest_res = dest.resolve() if dest.exists() else dest
        for src in _pg_config_candidates():
            try:
                if not src.is_file() or not _pg_config_looks_ready(src):
                    continue
                if src.resolve() == dest_res:
                    continue
                dest.write_bytes(src.read_bytes())
                reset_config_cache()
                return
            except OSError:
                continue
    except OSError:
        pass
    ensure_pg_config_example_in_data()


def is_configured() -> bool:
    ensure_pg_config_ready()
    try:
        _load_config()
        return True
    except PgNotConfigured:
        return False


def last_host() -> str | None:
    return _LAST_HOST


def _primary_host(cfg: dict[str, Any]) -> str:
    """Jeden host: sticky publiczny, inaczej pierwszy po sortowaniu DDNS."""
    ordered = _prefer_ddns_first(list(cfg.get("hosts") or []))
    if _LAST_HOST and _LAST_HOST in ordered and not _is_private_host(_LAST_HOST):
        return _LAST_HOST
    if ordered:
        return ordered[0]
    return str(cfg.get("host") or "").strip()


def connect():
    """Polaczenie psycopg2 do JEDNEGO hosta, krotki timeout, TLS (sslmode)."""
    global _LAST_HOST
    if psycopg2 is None:
        raise RuntimeError("psycopg2-binary nie jest zainstalowany (patrz apps/desktop/requirements.txt)")
    cfg = _load_config()
    host = _primary_host(cfg)
    if not host:
        raise PgNotConfigured("Brak hosta Postgres w konfiguracji.")
    kwargs: dict[str, Any] = {
        "host": host,
        "port": cfg["port"],
        "dbname": cfg["dbname"],
        "user": cfg["user"],
        "password": cfg["password"],
        "connect_timeout": _CONNECT_TIMEOUT_S,
        "cursor_factory": psycopg2.extras.RealDictCursor,
        "sslmode": cfg.get("sslmode") or "require",
    }
    root = (cfg.get("sslrootcert") or "").strip()
    if root and Path(root).is_file() and kwargs["sslmode"] in ("verify-ca", "verify-full"):
        kwargs["sslrootcert"] = root
    try:
        conn = psycopg2.connect(**kwargs)
        _LAST_HOST = host
        return conn
    except Exception as exc:  # noqa: BLE001
        msg = (
            f"Postgres niedostepny {host}:{cfg['port']} "
            f"sslmode={kwargs.get('sslmode')} -> {exc}"
        )
        raise psycopg2.OperationalError(msg) if psycopg2 else RuntimeError(msg)


def _set_health(**kwargs: Any) -> None:
    with _LOCK:
        _HEALTH.update(kwargs)
        _HEALTH["checked_at"] = time.time()


def cached_health() -> dict[str, Any]:
    """Ostatni wynik watku zdrowia. Nigdy nie nawiazuje polaczenia."""
    _ensure_health_thread()
    with _LOCK:
        snap = dict(_HEALTH)
    snap["host"] = snap.get("host") or _LAST_HOST
    return snap


def _ensure_kv_index(conn) -> None:
    global _INDEX_READY
    if _INDEX_READY:
        return
    try:
        cur = conn.cursor()
        cur.execute(
            "CREATE INDEX IF NOT EXISTS dam_kv_store_updated_at_idx "
            "ON dam_kv_store (updated_at)"
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS dam_kv_merge_review (
              id BIGSERIAL PRIMARY KEY,
              store_key TEXT NOT NULL,
              field TEXT NOT NULL DEFAULT '',
              item_key TEXT NOT NULL DEFAULT '',
              kept JSONB,
              overwritten JSONB,
              updated_by TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS dam_kv_merge_review_store_idx "
            "ON dam_kv_merge_review (store_key, created_at DESC)"
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS dam_thumb_cache_index (
              store_key TEXT PRIMARY KEY,
              digest TEXT NOT NULL,
              mtime DOUBLE PRECISION,
              size_bytes BIGINT,
              publisher TEXT NOT NULL DEFAULT '',
              published_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS dam_thumb_cache_index_digest_idx "
            "ON dam_thumb_cache_index (digest)"
        )
        conn.commit()
        _INDEX_READY = True
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass


def _probe_once() -> None:
    t0 = time.time()
    try:
        if not is_configured():
            _set_health(
                ok=False,
                configured=False,
                host=None,
                error="not_configured",
                latency_ms=round((time.time() - t0) * 1000, 1),
            )
            return
        conn = connect()
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
            _ensure_kv_index(conn)
            _set_health(
                ok=True,
                configured=True,
                host=_LAST_HOST,
                error=None,
                latency_ms=round((time.time() - t0) * 1000, 1),
            )
        finally:
            conn.close()
    except PgNotConfigured as exc:
        _set_health(
            ok=False,
            configured=False,
            host=None,
            error=str(exc),
            latency_ms=round((time.time() - t0) * 1000, 1),
        )
    except Exception as exc:  # noqa: BLE001
        _set_health(
            ok=False,
            configured=True,
            host=_LAST_HOST,
            error=str(exc),
            latency_ms=round((time.time() - t0) * 1000, 1),
        )


def _health_loop() -> None:
    while True:
        try:
            _probe_once()
        except Exception as exc:  # noqa: BLE001
            _set_health(ok=False, error=str(exc))
        time.sleep(_HEALTH_INTERVAL_S)


def _ensure_health_thread() -> None:
    global _HEALTH_THREAD
    with _LOCK:
        if _HEALTH_THREAD is not None and _HEALTH_THREAD.is_alive():
            return
        _HEALTH_THREAD = threading.Thread(
            target=_health_loop, name="dam-pg-health", daemon=True
        )
        _HEALTH_THREAD.start()


def ping() -> dict[str, Any]:
    """Szybki status z cache watku. Nie czeka na connect()."""
    snap = cached_health()
    out = {
        "ok": bool(snap.get("ok")),
        "configured": bool(snap.get("configured")),
        "host": snap.get("host"),
        "latency_ms": snap.get("latency_ms"),
        "error": snap.get("error"),
    }
    try:
        cfg = _load_config()
        out["hosts"] = [_primary_host(cfg)]
        out["sslmode"] = cfg.get("sslmode") or "require"
    except Exception:
        out["hosts"] = []
        out["sslmode"] = None
    return out


def ping_live() -> dict[str, Any]:
    """Jednorazowy probe (watek zdrowia / testy). Nie uzywac na sciezce HTTP."""
    _probe_once()
    return ping()


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


def kv_get_meta(store_key: str) -> dict[str, Any] | None:
    """Metadane wiersza bez pelnego payloadu (albo z payloadem gdy potrzeba)."""
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT store_key, payload, updated_at, updated_by "
            "FROM dam_kv_store WHERE store_key = %s",
            (store_key,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def _as_jsonb(payload: Any):
    """psycopg2 Json adapter - bezpieczny zapis do kolumny JSONB."""
    return psycopg2.extras.Json(payload)


def kv_set(store_key: str, payload: Any, updated_by: str = "", expected_updated_at: str | None = None) -> str:
    conn = connect()
    try:
        cur = conn.cursor()
        kv_get_for_update(store_key, None, cur)
        now = kv_set_in_txn(
            store_key,
            payload,
            updated_by,
            cur,
            expected_updated_at=expected_updated_at,
        )
        conn.commit()
        return now
    finally:
        conn.close()


def kv_get_for_update(store_key: str, default: Any, cur, *, with_meta: bool = False) -> Any:
    """Do uzycia W TRANSAKCJI (SELECT ... FOR UPDATE) - zapobiega utracie zmian
    gdy dwie decyzje moderacyjne przychodza rownolegle z dwoch stacji."""
    cur.execute(
        "SELECT payload, updated_at, updated_by FROM dam_kv_store "
        "WHERE store_key = %s FOR UPDATE",
        (store_key,),
    )
    row = cur.fetchone()
    if not row:
        return (default, "", "") if with_meta else default
    if with_meta:
        return row["payload"], str(row.get("updated_at") or ""), str(row.get("updated_by") or "")
    return row["payload"]


def kv_set_in_txn(
    store_key: str,
    payload: Any,
    updated_by: str,
    cur,
    expected_updated_at: str | None = None,
) -> str:
    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "SELECT updated_at FROM dam_kv_store WHERE store_key = %s FOR UPDATE",
        (store_key,),
    )
    row = cur.fetchone()
    expected = (expected_updated_at or "").strip()
    if not expected:
        print(f"kv_write_without_version store_key={store_key}")
    elif row is not None:
        current = str(row.get("updated_at") or "")
        if current and current > expected:
            raise StaleKvVersion(store_key, current)
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
    return now


def kv_all_keys() -> list[str]:
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute("SELECT store_key FROM dam_kv_store ORDER BY store_key")
        return [r["store_key"] for r in cur.fetchall()]
    finally:
        conn.close()


def kv_changes_since(since: str, *, limit: int = 200) -> dict[str, Any]:
    """Tani SELECT bez payload. since = znacznik TEXT (ISO)."""
    now = datetime.now(timezone.utc).isoformat()
    marker = (since or "").strip()
    conn = connect()
    try:
        cur = conn.cursor()
        if marker:
            cur.execute(
                """
                SELECT store_key, updated_at, updated_by
                FROM dam_kv_store
                WHERE updated_at > %s
                ORDER BY updated_at ASC
                LIMIT %s
                """,
                (marker, max(1, min(int(limit), 500))),
            )
        else:
            cur.execute(
                """
                SELECT store_key, updated_at, updated_by
                FROM dam_kv_store
                ORDER BY updated_at ASC
                LIMIT %s
                """,
                (max(1, min(int(limit), 500)),),
            )
        rows = [
            {
                "store_key": r["store_key"],
                "updated_at": r["updated_at"],
                "updated_by": r.get("updated_by") or "",
            }
            for r in cur.fetchall()
        ]
        return {"ok": True, "now": now, "changed": rows}
    finally:
        conn.close()


# --------------------------------------------------------------------------
# Scalanie dokumentow wspoldzielonych (wymaganie: nie kasowac cudzej pracy)
# --------------------------------------------------------------------------
# Droga B: odczyt + nalozenie zmiany + zapis w JEDNEJ transakcji (FOR UPDATE).
# Zbiory = suma. Pola jednowartosciowe = ostatni zapis, poprzednia wartosc
# idzie do dam_kv_merge_review (przeglad czlowieka). /db/kv zostaje przy 409.

_LIST_ID_KEYS: dict[str, dict[str, tuple[str, ...]]] = {
    "tag-proposals": {"proposals": ("id",)},
    "change-log": {"entries": ("id",), "redo": ("id",)},
    "carrier-assignment-log": {"entries": ("ts", "revision_path", "carrier_code")},
    "lifecycle-status": {"history": ("id",)},
    "inbox-items": {"items": ("id",)},
    "program-instructions": {"instructions": ("id",)},
    "product-aliases": {"groups": ("canonical_id",)},
    "viz-flags": {"manual": ("path",)},
}

_MAP_FIELDS: dict[str, tuple[str, ...]] = {
    "product-status": ("products", "revisions"),
    "lifecycle-status": ("products", "revisions"),
    "product-people": ("by_id", "by_id_prefix", "by_index", "people"),
    "product-name-pl": ("names",),
    "carrier-overrides": ("overrides",),
    "carrier-types": ("custom_types", "deleted_types"),
    "viz-flags": ("demo", "hidden"),
    "elements-overrides": ("links",),
}


def _item_identity(item: Any, keys: tuple[str, ...] | None) -> tuple:
    if not isinstance(item, dict):
        return ("s", str(item))
    if keys:
        return tuple(str(item.get(k) or "") for k in keys)
    if item.get("id"):
        return ("id", str(item.get("id")))
    return ("j", json.dumps(item, sort_keys=True, ensure_ascii=False, default=str))


def _values_differ(a: Any, b: Any) -> bool:
    try:
        return json.dumps(a, sort_keys=True, default=str) != json.dumps(b, sort_keys=True, default=str)
    except TypeError:
        return a != b


def _merge_list(current: list, incoming: list, id_keys: tuple[str, ...] | None) -> tuple[list, list]:
    """Suma list. Przy tym samym id rozne ciala -> incoming wygrywa, current do review."""
    review: list[dict[str, Any]] = []
    by_id: dict[tuple, Any] = {}
    order: list[tuple] = []
    for src_name, seq in (("current", current or []), ("incoming", incoming or [])):
        if not isinstance(seq, list):
            continue
        for item in seq:
            ident = _item_identity(item, id_keys)
            if ident not in by_id:
                by_id[ident] = item
                order.append(ident)
            elif _values_differ(by_id[ident], item) and src_name == "incoming":
                review.append(
                    {
                        "kind": "list_conflict",
                        "kept": item,
                        "overwritten": by_id[ident],
                        "id": ident,
                    }
                )
                by_id[ident] = item
    return [by_id[i] for i in order], review


def _merge_map(current: dict, incoming: dict, *, field: str) -> tuple[dict, list]:
    """Suma kluczy. Ten sam klucz, rozna wartosc -> incoming (ostatni), current do review."""
    review: list[dict[str, Any]] = []
    out = dict(current) if isinstance(current, dict) else {}
    inc = incoming if isinstance(incoming, dict) else {}
    for k, v in inc.items():
        key = str(k)
        if key not in out:
            out[key] = v
            continue
        if not _values_differ(out[key], v):
            continue
        if isinstance(out[key], list) and isinstance(v, list):
            merged, rev = _merge_list(out[key], v, None)
            out[key] = merged
            for r in rev:
                r["field"] = f"{field}.{key}"
            review.extend(rev)
        elif isinstance(out[key], dict) and isinstance(v, dict):
            nested, rev = _merge_map(out[key], v, field=f"{field}.{key}")
            out[key] = nested
            review.extend(rev)
        else:
            review.append(
                {
                    "kind": "scalar_conflict",
                    "field": f"{field}.{key}",
                    "item_key": key,
                    "kept": v,
                    "overwritten": out[key],
                }
            )
            out[key] = v
    return out, review


def merge_shared_document(store_key: str, current: Any, incoming: Any) -> dict[str, Any]:
    """Dwustronne scalenie pelnego dokumentu. Brak klucza w incoming NIE kasuje current."""
    added: list[str] = []
    kept: list[str] = []
    review: list[dict[str, Any]] = []
    if not isinstance(current, dict):
        current = {}
    if not isinstance(incoming, dict):
        incoming = {}
    out = dict(current)
    map_fields = set(_MAP_FIELDS.get(store_key) or ())
    list_ids = _LIST_ID_KEYS.get(store_key) or {}

    for field, inc_val in incoming.items():
        if field not in out:
            out[field] = inc_val
            added.append(str(field))
            continue
        cur_val = out[field]
        if field in list_ids or (isinstance(cur_val, list) and isinstance(inc_val, list)):
            merged, rev = _merge_list(cur_val if isinstance(cur_val, list) else [], inc_val if isinstance(inc_val, list) else [], list_ids.get(field))
            before_n = len(cur_val) if isinstance(cur_val, list) else 0
            out[field] = merged
            if len(merged) > before_n:
                added.append(f"{field}+{len(merged) - before_n}")
            for r in rev:
                r["field"] = field
            review.extend(rev)
        elif field in map_fields or (isinstance(cur_val, dict) and isinstance(inc_val, dict) and field != "source_of_truth"):
            before_keys = set(cur_val) if isinstance(cur_val, dict) else set()
            merged, rev = _merge_map(cur_val if isinstance(cur_val, dict) else {}, inc_val if isinstance(inc_val, dict) else {}, field=field)
            out[field] = merged
            new_keys = set(merged) - before_keys
            added.extend(f"{field}.{k}" for k in sorted(new_keys))
            kept.extend(f"{field}.{k}" for k in sorted(before_keys))
            review.extend(rev)
        elif _values_differ(cur_val, inc_val):
            review.append(
                {
                    "kind": "scalar_conflict",
                    "field": field,
                    "item_key": field,
                    "kept": inc_val,
                    "overwritten": cur_val,
                }
            )
            out[field] = inc_val
    return {
        "payload": out,
        "added": added,
        "kept": kept,
        "review": review,
    }


def _apply_change_to_payload(store_key: str, current: Any, change: dict) -> dict[str, Any]:
    """Nalozenie delty na dokument. change.op: upsert_map | append_list | set_scalar | merge_document."""
    if not isinstance(current, dict):
        current = {}
    op = str((change or {}).get("op") or "merge_document").strip()
    if op == "merge_document":
        return merge_shared_document(store_key, current, change.get("payload") if isinstance(change.get("payload"), dict) else change)
    out = dict(current)
    review: list[dict[str, Any]] = []
    added: list[str] = []
    field = str(change.get("field") or "").strip()
    if op == "upsert_map":
        entries = change.get("entries") if isinstance(change.get("entries"), dict) else {}
        bucket = out.get(field) if isinstance(out.get(field), dict) else {}
        merged, rev = _merge_map(bucket, entries, field=field)
        new_keys = set(merged) - set(bucket)
        out[field] = merged
        added.extend(f"{field}.{k}" for k in sorted(new_keys))
        review.extend(rev)
    elif op == "append_list":
        items = change.get("items") if isinstance(change.get("items"), list) else []
        id_keys = change.get("id_keys")
        keys = tuple(id_keys) if isinstance(id_keys, (list, tuple)) else (_LIST_ID_KEYS.get(store_key) or {}).get(field)
        bucket = out.get(field) if isinstance(out.get(field), list) else []
        merged, rev = _merge_list(bucket, items, keys)
        out[field] = merged
        if len(merged) > len(bucket):
            added.append(f"{field}+{len(merged) - len(bucket)}")
        for r in rev:
            r["field"] = field
        review.extend(rev)
    elif op == "set_scalar":
        value = change.get("value")
        prev = out.get(field)
        if field in out and _values_differ(prev, value):
            review.append(
                {
                    "kind": "scalar_conflict",
                    "field": field,
                    "item_key": field,
                    "kept": value,
                    "overwritten": prev,
                }
            )
        elif field not in out:
            added.append(field)
        out[field] = value
    else:
        return merge_shared_document(store_key, current, change if isinstance(change, dict) else {})
    return {"payload": out, "added": added, "kept": [], "review": review}


def _record_review(cur, store_key: str, review: list[dict[str, Any]], updated_by: str) -> None:
    if not review:
        return
    now = datetime.now(timezone.utc).isoformat()
    for row in review:
        print(
            "kv_merge_review",
            store_key,
            row.get("field") or "",
            row.get("item_key") or "",
            "overwritten_present",
            flush=True,
        )
        try:
            cur.execute(
                """
                INSERT INTO dam_kv_merge_review
                  (store_key, field, item_key, kept, overwritten, updated_by, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    store_key,
                    str(row.get("field") or ""),
                    str(row.get("item_key") or ""),
                    _as_jsonb(row.get("kept")),
                    _as_jsonb(row.get("overwritten")),
                    updated_by or "",
                    now,
                ),
            )
        except Exception as exc:  # noqa: BLE001
            print("kv_merge_review insert warning:", exc)


def kv_apply_change(
    store_key: str,
    change: dict,
    *,
    updated_by: str = "",
) -> dict[str, Any]:
    """Odczyt FOR UPDATE + scalenie + zapis w jednej transakcji. Bez 409.

    change: {op, field, entries|items|value|payload}. Zwraca liczby i przeglad.
    """
    key = str(store_key or "").strip()
    if not key:
        return {"ok": False, "error": "store_key_required"}
    if not isinstance(change, dict):
        return {"ok": False, "error": "change_required"}
    conn = connect()
    try:
        cur = conn.cursor()
        current, prev_ts, prev_by = kv_get_for_update(key, {}, cur, with_meta=True)
        if current is None:
            current = {}
        merged = _apply_change_to_payload(key, current, change)
        payload = merged["payload"]
        now = kv_set_in_txn(key, payload, updated_by or "kv_merge", cur, expected_updated_at=None)
        _record_review(cur, key, merged.get("review") or [], updated_by or "kv_merge")
        conn.commit()
        after_n = _payload_counts(payload)
        before_n = _payload_counts(current if isinstance(current, dict) else {})
        return {
            "ok": True,
            "store_key": key,
            "updated_at": now,
            "added": merged.get("added") or [],
            "review": merged.get("review") or [],
            "review_count": len(merged.get("review") or []),
            "counts_before": before_n,
            "counts_after": after_n,
            "previous_updated_at": prev_ts,
            "previous_updated_by": prev_by,
            "payload": payload,
        }
    except Exception as exc:  # noqa: BLE001
        try:
            conn.rollback()
        except Exception:
            pass
        return {"ok": False, "error": str(exc), "store_key": key}
    finally:
        conn.close()


def _payload_counts(payload: dict) -> dict[str, int]:
    out: dict[str, int] = {}
    for k, v in (payload or {}).items():
        if isinstance(v, dict):
            out[k] = len(v)
        elif isinstance(v, list):
            out[k] = len(v)
    return out


def kv_merge_review_recent(store_key: str = "", *, limit: int = 20) -> list[dict[str, Any]]:
    conn = connect()
    try:
        cur = conn.cursor()
        if store_key:
            cur.execute(
                """
                SELECT store_key, field, item_key, kept, overwritten, updated_by, created_at
                FROM dam_kv_merge_review
                WHERE store_key = %s
                ORDER BY id DESC
                LIMIT %s
                """,
                (store_key, max(1, min(int(limit), 100))),
            )
        else:
            cur.execute(
                """
                SELECT store_key, field, item_key, kept, overwritten, updated_by, created_at
                FROM dam_kv_merge_review
                ORDER BY id DESC
                LIMIT %s
                """,
                (max(1, min(int(limit), 100)),),
            )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


THUMB_CACHE_MANIFEST_KEY = "thumb-cache-manifest"


def upsert_thumb_cache_manifest(payload: Any, updated_by: str = "") -> bool:
    """Tiny JSONB pointer to NAS cache. Never store file-index here."""
    try:
        kv_set(THUMB_CACHE_MANIFEST_KEY, payload, updated_by=updated_by or "dam-cache")
        return True
    except Exception:
        return False


def upsert_thumb_cache_rows(entries: list, *, publisher: str = "") -> bool:
    if not entries:
        return True
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS dam_thumb_cache_index (
              store_key TEXT PRIMARY KEY,
              digest TEXT NOT NULL,
              mtime DOUBLE PRECISION,
              size_bytes BIGINT,
              publisher TEXT NOT NULL DEFAULT '',
              published_at TEXT NOT NULL
            )
            """
        )
        for row in entries:
            if not isinstance(row, dict):
                continue
            key = str(row.get("rel_profile") or row.get("store_key") or "").strip()
            digest = str(row.get("digest") or "").strip()
            if not key or not digest:
                continue
            try:
                mt = float(row.get("mtime") or 0.0)
            except (TypeError, ValueError):
                mt = 0.0
            try:
                size = int(row.get("size") or row.get("size_bytes") or 0)
            except (TypeError, ValueError):
                size = 0
            cur.execute(
                """
                INSERT INTO dam_thumb_cache_index
                  (store_key, digest, mtime, size_bytes, publisher, published_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (store_key) DO UPDATE SET
                  digest = EXCLUDED.digest,
                  mtime = EXCLUDED.mtime,
                  size_bytes = EXCLUDED.size_bytes,
                  publisher = EXCLUDED.publisher,
                  published_at = EXCLUDED.published_at
                """,
                (key, digest, mt, size, publisher or "", now),
            )
        conn.commit()
        return True
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        return False
    finally:
        conn.close()


_ensure_health_thread()
