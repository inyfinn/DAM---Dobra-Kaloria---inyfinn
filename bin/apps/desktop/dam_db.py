# -*- coding: utf-8 -*-
"""
Baza DAM - Tier 1 (users / device_sessions / audit_log).

Preferencja (ADR-009): PostgreSQL na Synology (priorytet DDNS
inyfinn.synology.me:5433, LAN tylko awaryjnie).

Gdy PG skonfigurowany ale NIEDOSTEPNY (NAT/CGNAT/ISP/firewall/DDNS):
  -> tryb OFFLINE: lokalny SQLite (dam-local.sqlite) + komunikat pomocy.
  To NIE jest ciche udawanie, ze "wszystko OK online" - status ma
  offline_mode=true i hint o NAT/DDNS/GitHub DATABASE/.

ZAKAZ: tworzenie / zapis katalogow na Marketing (np. X:\\Marketing\\.dam-eta)
bez osobnego, jawnego polecenia uzytkownika.
"""
from __future__ import annotations

import json
import shutil
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
DATA_DIR = DESKTOP_DIR / "data"
DB_CANONICAL = DATA_DIR / "dam-local.sqlite"
DB_LEGACY_AUTH = DATA_DIR / "dam-auth.sqlite"
_LEGACY_MARKETING_REL = Path(".dam-eta") / "dam-shared.sqlite"
MACHINE_CONFIG = DESKTOP_DIR / "machine-config.json"
PREFER_PATH = DATA_DIR / "db-prefer.json"
CONTENT_ROOT = DESKTOP_DIR.parent.parent
GIT_ROOT = CONTENT_ROOT.parent
REPO_DATABASE = CONTENT_ROOT / "DATABASE"
SYNC_SCRIPT = DESKTOP_DIR / "scripts" / "sync-database-backups-to-git.py"
_LOCK = threading.Lock()
_INITIALIZED = False
_INIT_RESULT: dict[str, Any] | None = None
_STATUS_CACHE: dict[str, Any] | None = None
_STATUS_CACHE_TS = 0.0
_STATUS_CACHE_TTL = 30.0
_MIRROR_LAST_TS = 0.0
_MIRROR_INTERVAL_SEC = 600.0
_RESOLVED_PATH: Path | None = None
_OFFLINE_MODE = False
_OFFLINE_REASON = ""
_OFFLINE_SINCE = 0.0
# Co tyle sekund w trybie offline proboj znowu DDNS/Postgres (nie zostawaj offline na zawsze).
_OFFLINE_RETRY_SEC = 120.0
_OFFLINE_HINT = (
    "Postgres (Synology) niedostępny. Sprawdź: (1) czy DDNS inyfinn.synology.me "
    "działa, (2) czy router ma port forwarding TCP 5433, (3) czy ISP nie dał "
    "CGNAT / nie zamknął NAT przy zmiennym IP - wtedy DDNS może wskazywać "
    "zły adres mimo poprawnej konfiguracji serwera. "
    "Aplikacja działa w trybie OFFLINE na lokalnym SQLite "
    "(apps/desktop/data/dam-local.sqlite). "
    "Backup/dump: folder DATABASE/ w repo (GitHub) oraz "
    "X:/Marketing/- POLSKA/99 - WYMIANA/Krzysztof/CURSOR/Database DAM."
)
_DEFAULT_PREFER: dict[str, Any] = {
    "mode": "auto",  # auto | postgres | sqlite — Synology gdy dostepny
    "sources": {"synology": True, "github": True, "local": True},
}


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def pg_configured() -> bool:
    """True gdy jest config PG (nie sprawdza czy serwer odpowiada)."""
    try:
        import pg_db

        return pg_db.is_configured()
    except Exception:
        return False


def load_prefer() -> dict[str, Any]:
    """Preferencje zrodel bazy (Synology / GitHub dump / lokalny SQLite)."""
    data = dict(_DEFAULT_PREFER)
    data["sources"] = dict(_DEFAULT_PREFER["sources"])
    try:
        if PREFER_PATH.is_file():
            raw = json.loads(PREFER_PATH.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                mode = str(raw.get("mode") or "auto").strip().lower()
                if mode in ("auto", "postgres", "sqlite"):
                    data["mode"] = mode
                src = raw.get("sources") if isinstance(raw.get("sources"), dict) else {}
                for key in ("synology", "github", "local"):
                    if key in src:
                        data["sources"][key] = bool(src[key])
    except Exception as exc:  # noqa: BLE001
        print("dam_db load_prefer warning:", exc)
    # Lokalna zawsze dostepna jako awaria - nie da sie wylaczyc calkiem.
    data["sources"]["local"] = True
    return data


def save_prefer(payload: dict[str, Any] | None) -> dict[str, Any]:
    """Zapisz preferencje i uniewaznij cache init (nastepne status/reconnect je zastosuje)."""
    global _INITIALIZED
    current = load_prefer()
    if isinstance(payload, dict):
        mode = str(payload.get("mode") or current["mode"]).strip().lower()
        if mode in ("auto", "postgres", "sqlite"):
            current["mode"] = mode
        src_in = payload.get("sources") if isinstance(payload.get("sources"), dict) else {}
        for key in ("synology", "github", "local"):
            if key in src_in:
                current["sources"][key] = bool(src_in[key])
    current["sources"]["local"] = True
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PREFER_PATH.write_text(
        json.dumps(current, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    _INITIALIZED = False
    return current


def synology_allowed() -> bool:
    pref = load_prefer()
    if pref["mode"] == "sqlite":
        return False
    return bool(pref["sources"].get("synology", True))


def is_offline() -> bool:
    return _OFFLINE_MODE


def offline_reason() -> str:
    return _OFFLINE_REASON


def use_postgres() -> bool:
    """True gdy mamy uzywac zywego PG (dozwolony, skonfigurowany i NIE offline)."""
    return synology_allowed() and pg_configured() and not _OFFLINE_MODE


def engine_name() -> str:
    if use_postgres():
        return "postgres"
    if _OFFLINE_MODE:
        return "sqlite-offline"
    return "sqlite"


def _enter_offline(reason: str) -> None:
    global _OFFLINE_MODE, _OFFLINE_REASON, _OFFLINE_SINCE
    was = _OFFLINE_MODE
    _OFFLINE_MODE = True
    _OFFLINE_REASON = (reason or "")[:500]
    if not was:
        _OFFLINE_SINCE = time.time()
        print("dam_db OFFLINE:", _OFFLINE_HINT)
        print("dam_db OFFLINE detail:", _OFFLINE_REASON)


def _leave_offline() -> None:
    global _OFFLINE_MODE, _OFFLINE_REASON, _OFFLINE_SINCE
    if _OFFLINE_MODE:
        print("dam_db: powrot do Postgres (online)")
    _OFFLINE_MODE = False
    _OFFLINE_REASON = ""
    _OFFLINE_SINCE = 0.0


def _should_try_postgres() -> bool:
    """Online: zawsze. Offline: retry co _OFFLINE_RETRY_SEC (DDNS moze wrocic)."""
    if not synology_allowed() or not pg_configured():
        return False
    if not _OFFLINE_MODE:
        return True
    return (time.time() - _OFFLINE_SINCE) >= _OFFLINE_RETRY_SEC


def latest_database_dump() -> Path | None:
    """Najnowszy dam_eta_*.sql.gz z DATABASE/ w repo (kopia z GitHub / sync)."""
    if not REPO_DATABASE.is_dir():
        return None
    files = sorted(REPO_DATABASE.glob("dam_eta_*.sql.gz"))
    return files[-1] if files else None


def _marketing_base_from_config() -> Path | None:
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
    """Sciezka lokalnego SQLite (cache / sciezka odwrotu). Nie uzywana gdy engine=postgres."""
    global _RESOLVED_PATH
    if _RESOLVED_PATH is not None:
        return _RESOLVED_PATH
    _migrate_into_repo()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _RESOLVED_PATH = DB_CANONICAL
    return _RESOLVED_PATH


def reset_path_cache() -> None:
    global _RESOLVED_PATH, _INITIALIZED, _INIT_RESULT, _STATUS_CACHE, _STATUS_CACHE_TS
    _RESOLVED_PATH = None
    _INITIALIZED = False
    _INIT_RESULT = None
    _STATUS_CACHE = None
    _STATUS_CACHE_TS = 0.0


def _connect_sqlite() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False, timeout=60)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA busy_timeout = 60000")
    return conn


def connect():
    """Polaczenie: Postgres (DDNS najpierw) albo SQLite. Przy padnieciu PG -> offline SQLite."""
    global _OFFLINE_SINCE
    if _should_try_postgres():
        try:
            import pg_db

            conn = pg_db.connect()
            _leave_offline()
            return conn
        except Exception as exc:  # noqa: BLE001
            _enter_offline(str(exc))
            # Odswiez timer retry - nie spamuj DDNS co request
            _OFFLINE_SINCE = time.time()
    return _connect_sqlite()


def _init_sqlite() -> dict[str, Any]:
    conn = _connect_sqlite()
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
            CREATE TABLE IF NOT EXISTS asset_product_links (
              asset_id TEXT NOT NULL,
              product_id TEXT NOT NULL,
              score REAL,
              source TEXT NOT NULL DEFAULT 'refilter',
              status TEXT NOT NULL DEFAULT 'pending',
              reason TEXT NOT NULL DEFAULT '',
              updated_at TEXT NOT NULL DEFAULT '',
              updated_by TEXT NOT NULL DEFAULT '',
              PRIMARY KEY (asset_id, product_id)
            );
            CREATE INDEX IF NOT EXISTS asset_product_links_status_idx
              ON asset_product_links (status, score DESC);
            CREATE TABLE IF NOT EXISTS dam_kv_local (
              store_key TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              updated_by TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON audit_log (ts DESC);
            CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (username);
            CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
            """
        )
        cols = {r[1] for r in conn.execute("PRAGMA table_info(device_sessions)").fetchall()}
        for name, sql in [
            ("machine_id", "ALTER TABLE device_sessions ADD COLUMN machine_id TEXT NOT NULL DEFAULT ''"),
            ("session_id", "ALTER TABLE device_sessions ADD COLUMN session_id TEXT NOT NULL DEFAULT ''"),
            ("windows_user", "ALTER TABLE device_sessions ADD COLUMN windows_user TEXT NOT NULL DEFAULT ''"),
            ("hostname", "ALTER TABLE device_sessions ADD COLUMN hostname TEXT NOT NULL DEFAULT ''"),
        ]:
            if name not in cols:
                conn.execute(sql)
        conn.commit()
        path = db_path()
        dump = latest_database_dump()
        return {
            "ok": True,
            "path": str(path),
            "engine": "sqlite-offline" if _OFFLINE_MODE else "sqlite",
            "shared": False,
            "location": "repo",
            "offline_mode": _OFFLINE_MODE,
            "offline_reason": _OFFLINE_REASON,
            "offline_hint": _OFFLINE_HINT if _OFFLINE_MODE else "",
            "github_dump": str(dump) if dump else None,
        }
    finally:
        conn.close()


def _mirror_pg_users_to_sqlite() -> None:
    """Gdy PG online - odswiez lokalny SQLite jako zapas offline (best-effort)."""
    try:
        import pg_db

        pg = pg_db.connect()
        try:
            cur = pg.cursor()
            cur.execute(
                "SELECT email, name, role, password_hash, auth_provider, created_at, updated_at FROM users"
            )
            users = cur.fetchall()
        finally:
            pg.close()
        if not users:
            return
        sq = _connect_sqlite()
        try:
            # upewnij schemat
            sq.executescript(
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
                """
            )
            for u in users:
                sq.execute(
                    """
                    INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET
                      name=excluded.name, role=excluded.role,
                      password_hash=excluded.password_hash, updated_at=excluded.updated_at
                    """,
                    (
                        u["email"], u["name"], u["role"], u["password_hash"],
                        u["auth_provider"], u["created_at"], u["updated_at"],
                    ),
                )
            sq.commit()
        finally:
            sq.close()
    except Exception as exc:  # noqa: BLE001
        print("dam_db mirror to sqlite warning:", exc)


def _init_postgres() -> dict[str, Any]:
    """Schemat jest tworzony przez pg_schema.sql na NAS - tu tylko ping + status."""
    import pg_db

    conn = pg_db.connect()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) AS n FROM users")
        users = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM audit_log")
        audits = cur.fetchone()["n"]
        host = pg_db.last_host() or "inyfinn.synology.me"
        _leave_offline()
        return {
            "ok": True,
            "path": f"postgres://{host}:5433/dam_eta",
            "engine": "postgres",
            "shared": True,
            "location": "synology",
            "host": host,
            "users": users,
            "audit_rows": audits,
            "offline_mode": False,
        }
    finally:
        conn.close()


def init_db(*, force: bool = False) -> dict[str, Any]:
    global _INITIALIZED, _INIT_RESULT, _MIRROR_LAST_TS
    with _LOCK:
        if _INITIALIZED and _INIT_RESULT and not force:
            return dict(_INIT_RESULT)
        if synology_allowed() and pg_configured():
            try:
                result = _init_postgres()
                now = time.time()
                if now - _MIRROR_LAST_TS >= _MIRROR_INTERVAL_SEC:
                    try:
                        _mirror_pg_users_to_sqlite()
                    except Exception:
                        pass
                    _MIRROR_LAST_TS = now
            except Exception as exc:  # noqa: BLE001
                _enter_offline(str(exc))
                result = _init_sqlite()
        else:
            if not synology_allowed() and pg_configured():
                # Swiadomie lokalnie - nie traktuj jako awarii sieci.
                _leave_offline()
            result = _init_sqlite()
        _INITIALIZED = True
        _INIT_RESULT = dict(result)
        return dict(_INIT_RESULT)


def _sources_payload(active_engine: str, dump: Path | None) -> dict[str, Any]:
    pref = load_prefer()
    dump_mtime = None
    if dump and dump.is_file():
        try:
            dump_mtime = datetime.fromtimestamp(dump.stat().st_mtime, timezone.utc).isoformat()
        except OSError:
            dump_mtime = None
    syn_cfg = pg_configured()
    syn_on = bool(pref["sources"].get("synology", True)) and pref["mode"] != "sqlite"
    return {
        "prefer": pref,
        "priority": ["synology", "github", "local"],
        "sources": {
            "synology": {
                "id": "synology",
                "label": "Synology (Postgres)",
                "enabled": syn_on,
                "configured": syn_cfg,
                "available": syn_cfg,
                "active": active_engine == "postgres",
                "detail": "inyfinn.synology.me:5433" if syn_cfg else "Brak pg-config",
            },
            "github": {
                "id": "github",
                "label": "GitHub (DATABASE/)",
                "enabled": bool(pref["sources"].get("github", True)),
                "configured": bool(dump),
                "available": bool(dump),
                "active": False,
                "detail": str(dump.name) if dump else "Brak dam_eta_*.sql.gz w DATABASE/",
                "mtime": dump_mtime,
                "note": "Kopia zapasowa (dump). Nie jest silnikiem live - odśwież pobiera najnowszy dump.",
            },
            "local": {
                "id": "local",
                "label": "Lokalna (SQLite)",
                "enabled": True,
                "configured": True,
                "available": True,
                "active": active_engine in ("sqlite", "sqlite-offline"),
                "detail": str(db_path()),
            },
        },
    }


def force_reconnect(*, pull_dump: bool = False) -> dict[str, Any]:
    """Natychmiastowe ponowne polaczenie (bez czekania 120s) + opcjonalny sync dumpa."""
    global _INITIALIZED, _OFFLINE_SINCE, _INIT_RESULT, _STATUS_CACHE, _STATUS_CACHE_TS
    with _LOCK:
        _INITIALIZED = False
        _INIT_RESULT = None
        _STATUS_CACHE = None
        _STATUS_CACHE_TS = 0.0
        _OFFLINE_SINCE = 0.0
        if synology_allowed() and pg_configured():
            _leave_offline()
    dump_sync: dict[str, Any] = {"ok": False, "skipped": True}
    if pull_dump and load_prefer()["sources"].get("github", True):
        dump_sync = pull_database_dump_now()
    info = status()
    info["reconnect"] = True
    info["dump_sync"] = dump_sync
    return info


def pull_database_dump_now() -> dict[str, Any]:
    """Wymus pobranie dumpa z NAS do DATABASE/ (ten sam skrypt co sync godzinowy).

    Sukces = po probie istnieje lokalny dam_eta_*.sql.gz (offline fallback).
    Gdy SSH/NAS pada, zachowany lokalny dump nadal liczy sie jako ok.
    """
    before = latest_database_dump()
    result: dict[str, Any] = {"ok": False}

    try:
        from dam_sync import run_sync_blocking

        result = run_sync_blocking(push=False, no_commit=True)
    except ImportError:
        import subprocess
        import sys
        from pathlib import Path

        if not SYNC_SCRIPT.is_file():
            result = {"ok": False, "error": "sync_script_missing", "path": str(SYNC_SCRIPT)}
        else:
            py_exe = sys.executable
            if sys.platform == "win32":
                pyw = Path(py_exe).with_name("pythonw.exe")
                if pyw.is_file():
                    py_exe = str(pyw)
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
            try:
                proc = subprocess.run(
                    [py_exe, str(SYNC_SCRIPT), "--no-commit", "--quiet"],
                    cwd=str(GIT_ROOT),
                    capture_output=True,
                    text=True,
                    timeout=120,
                    check=False,
                    creationflags=flags,
                )
                result = {
                    "ok": proc.returncode == 0,
                    "exit_code": proc.returncode,
                    "stdout": (proc.stdout or "")[-800:],
                    "stderr": (proc.stderr or "")[-400:],
                }
            except subprocess.TimeoutExpired:
                result = {"ok": False, "error": "timeout"}
            except Exception as exc:  # noqa: BLE001
                result = {"ok": False, "error": str(exc)}

    dump = latest_database_dump()
    if dump:
        result["dump"] = str(dump)
        sync_failed = bool(result.get("error")) or result.get("exit_code", 0) not in (0, None)
        result["ok"] = True
        if sync_failed and before:
            result["skipped"] = True
            result["note"] = "local_retained"
        elif sync_failed and not before:
            result["note"] = "local_created_despite_sync_warn"
        return result

    if before:
        return {
            "ok": True,
            "skipped": True,
            "dump": str(before),
            "note": "local_retained_after_sync_fail",
            "sync_error": result.get("error") or result.get("stderr"),
        }

    return {
        **result,
        "ok": False,
        "error": result.get("error") or "no_local_dump",
        "hint": "Brak dam_eta_*.sql.gz w DATABASE/. Uruchom sync-database-backups-to-git.py lub backup na Synology.",
    }


def ping() -> dict[str, Any]:
    """Lekki test polaczenia (bez COUNT, bez pelnego init_db przy kazdym poll)."""
    t0 = time.time()
    try:
        if _should_try_postgres():
            import pg_db

            pg = pg_db.ping()
            latency = round((time.time() - t0) * 1000, 1)
            if pg.get("ok"):
                _leave_offline()
                return {
                    "ok": True,
                    "engine": "postgres",
                    "host": pg_db.last_host(),
                    "latency_ms": latency,
                    "offline_mode": False,
                }
            raise RuntimeError("postgres_ping_failed")
        conn = _connect_sqlite()
        try:
            conn.execute("SELECT 1").fetchone()
        finally:
            conn.close()
        engine = "sqlite-offline" if _OFFLINE_MODE else "sqlite"
        return {
            "ok": True,
            "engine": engine,
            "latency_ms": round((time.time() - t0) * 1000, 1),
            "offline_mode": _OFFLINE_MODE,
            "path": str(db_path()),
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "engine": engine_name(),
            "error": str(exc),
            "latency_ms": round((time.time() - t0) * 1000, 1),
            "offline_mode": _OFFLINE_MODE,
        }


def status_light() -> dict[str, Any]:
    """Cache pelnego status() na STATUS_CACHE_TTL (pollery indeksu)."""
    global _STATUS_CACHE, _STATUS_CACHE_TS
    now = time.time()
    if _STATUS_CACHE and (now - _STATUS_CACHE_TS) < _STATUS_CACHE_TTL:
        return dict(_STATUS_CACHE)
    full = status()
    _STATUS_CACHE = dict(full)
    _STATUS_CACHE_TS = now
    return dict(full)


def status() -> dict[str, Any]:
    try:
        info = init_db()
        dump = latest_database_dump()
        engine = str(info.get("engine") or engine_name())
        base = {
            "offline_mode": bool(info.get("offline_mode") or _OFFLINE_MODE),
            "offline_reason": info.get("offline_reason") or _OFFLINE_REASON,
            "offline_hint": info.get("offline_hint") or (_OFFLINE_HINT if _OFFLINE_MODE else ""),
            "github_dump": info.get("github_dump") or (str(dump) if dump else None),
            "docker_required": False,
            **_sources_payload(engine, dump),
        }
        online = engine == "postgres" or (
            engine in ("sqlite", "sqlite-offline") and not (engine == "sqlite-offline" and synology_allowed())
        )
        # Pill: online gdy aktywny silnik dziala; offline tylko gdy chcielismy Synology a padlo.
        if engine == "postgres":
            online = True
            label = "Baza online"
        elif _OFFLINE_MODE and synology_allowed():
            online = False
            label = "Baza offline"
        else:
            online = True
            label = "Baza lokalna"
        base["online"] = online
        base["label"] = label
        if info.get("engine") == "postgres":
            return {
                **base,
                "ok": True,
                "engine": "postgres",
                "path": info.get("path"),
                "shared": True,
                "location": "synology",
                "host": info.get("host"),
                "wal": False,
                "users": info.get("users", 0),
                "audit_rows": info.get("audit_rows", 0),
            }
        path = db_path()
        with _LOCK:
            conn = _connect_sqlite()
            try:
                users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
                audits = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
                mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
            finally:
                conn.close()
        return {
            **base,
            "ok": True,
            "engine": info.get("engine") or "sqlite",
            "path": str(path),
            "shared": False,
            "location": "repo",
            "wal": str(mode).lower() == "wal",
            "users": users,
            "audit_rows": audits,
        }
    except Exception as exc:  # noqa: BLE001
        dump = latest_database_dump()
        return {
            "ok": False,
            "engine": engine_name(),
            "error": str(exc),
            "path": str(db_path()),
            "shared": False,
            "location": "repo",
            "offline_mode": _OFFLINE_MODE,
            "offline_hint": _OFFLINE_HINT if _OFFLINE_MODE else "",
            "online": False,
            "label": "Baza offline",
            **_sources_payload(engine_name(), dump),
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
            if use_postgres():
                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO audit_log (ts, action, username, path, local_path, detail, meta_json)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
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
                row["id"] = cur.fetchone()["id"]
                conn.commit()
            else:
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
    return {
        "ok": True,
        "entry": row,
        "store": engine_name(),
        "path": "postgres" if use_postgres() else str(db_path()),
    }


def read_audit(limit: int = 100) -> dict[str, Any]:
    init_db()
    lim = max(1, min(int(limit), 500))
    with _LOCK:
        conn = connect()
        try:
            if use_postgres():
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT id, ts, action, username, path, local_path, detail, meta_json
                    FROM audit_log
                    ORDER BY id DESC
                    LIMIT %s
                    """,
                    (lim,),
                )
                rows = cur.fetchall()
            else:
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
        except (json.JSONDecodeError, TypeError, KeyError):
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
    return {
        "ok": True,
        "items": items,
        "store": engine_name(),
        "path": "postgres" if use_postgres() else str(db_path()),
    }
