# -*- coding: utf-8 -*-
"""Sonda izolacji instancji testowej (plan naprawy, sekcja 0).

Uruchamiana przez run_abc.py tym samym interpreterem, katalogiem i srodowiskiem
co most danej instancji, PRZED startem mostu. Importuje moduly aplikacji z KOPII
drzewa instancji i wypisuje (JSON na stdout), dokad naprawde rozwiazuja sie
sciezki stanu/danych/cache/konfiguracji oraz konfiguracja PostgreSQL. Nie
startuje watkow mostu (local_bridge jest tylko importowany, main() nie jest
wolane). Walidacja (czy wszystko lezy w katalogu instancji) jest po stronie
run_abc.py.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def _s(p) -> str:
    try:
        return str(Path(p).resolve()) if p else ""
    except Exception:  # noqa: BLE001
        return str(p or "")


def main() -> None:
    desktop = Path(os.environ["DAM_E2E_DESKTOP"]).resolve()
    sys.path.insert(0, str(desktop))
    os.chdir(str(desktop))
    out: dict = {"desktop": str(desktop), "paths": {}, "sources": {}, "errors": {}}
    P = out["paths"]
    S = out["sources"]

    def rec(key: str, fn, source: str) -> None:
        try:
            P[key] = _s(fn())
            S[key] = source
        except Exception as exc:  # noqa: BLE001
            out["errors"][key] = f"{type(exc).__name__}: {exc}"[:300]

    import platform_compat
    rec("platform_compat.user_state_dir", platform_compat.user_state_dir, "env DAM_STATE_DIR")
    import rebuild_lock
    rec("rebuild_lock.STATE_DIR", lambda: rebuild_lock.STATE_DIR, "env DAM_STATE_DIR")
    rec("rebuild_lock.DATA_DIR", lambda: rebuild_lock.DATA_DIR, "kopia drzewa (DESKTOP_DIR/data)")
    import runtime_config
    rec("runtime_config.DATA_ROOT", lambda: runtime_config.DATA_ROOT, "kopia drzewa (CONTENT_ROOT gdy zapisywalny)")
    rec("runtime_config.runtime_file_path", runtime_config.runtime_file_path, "kopia drzewa (WEB_ROOT/data)")
    import dam_db
    rec("dam_db.DB_CANONICAL (sqlite)", lambda: dam_db.DB_CANONICAL, "kopia drzewa (DATA_ROOT/DATABASE)")
    rec("dam_db.db_path()", dam_db.db_path, "kopia drzewa")
    rec("dam_db.DATA_DIR", lambda: dam_db.DATA_DIR, "kopia drzewa (DESKTOP_DIR/data)")
    rec("dam_db.PREFER_PATH", lambda: dam_db.PREFER_PATH, "kopia drzewa")
    rec("dam_db.resolve_marketing_root()", lambda: dam_db.resolve_marketing_root() or "", "machine-config (env DAM_STATE_DIR)")
    import machine_identity
    rec("machine_identity.BOUND_SESSION", lambda: machine_identity.BOUND_SESSION, "env DAM_STATE_DIR")
    rec("machine_identity.IDENTITY_RUNTIME", lambda: machine_identity.IDENTITY_RUNTIME, "kopia drzewa (WEB_ROOT/data)")
    ident = machine_identity.collect_identity()
    out["identity"] = {k: ident.get(k) for k in ("machine_id", "device_id", "hostname", "test_instance")}
    import dam_thumb_cache as tc
    rec("dam_thumb_cache.cache_root()", tc.cache_root, "env DAM_CACHE_ROOT")
    rec("dam_thumb_cache.SYNC_STATUS_FILE", lambda: tc.SYNC_STATUS_FILE, "env DAM_STATE_DIR")
    rec("dam_thumb_cache.PUBLISH_QUEUE_FILE", lambda: tc.PUBLISH_QUEUE_FILE, "kopia drzewa (DESKTOP_DIR/data)")
    rec("dam_thumb_cache.rel_index", tc._rel_index_path, "env DAM_CACHE_ROOT")
    rec("dam_thumb_cache.db_index_marker", tc._db_index_marker_path, "env DAM_STATE_DIR")
    rec("dam_thumb_cache.nas_cache_path() [centralny magazyn testowy]", tc.nas_cache_path, "env DAM_NAS_CACHE_PATH")
    out["nas_cache_url"] = tc.nas_cache_url()
    out["nas_ssh_host"] = tc.nas_ssh_host()
    import index_authority
    rec("index_authority state", index_authority._state_path, "env DAM_STATE_DIR")
    out["index_authority.current_machine"] = index_authority.current_machine()
    import index_snapshots
    rec("index_snapshots state", index_snapshots._state_path, "env DAM_STATE_DIR")
    import saved_logins
    rec("saved_logins store", saved_logins._store_path, "env DAM_STATE_DIR")
    import dam_path_resolve
    rec("dam_path_resolve.state_machine_config_path", dam_path_resolve.state_machine_config_path, "env DAM_STATE_DIR")
    import index_supervisor
    rec("index_supervisor.WATCHER_LOG", lambda: index_supervisor.WATCHER_LOG, "env DAM_STATE_DIR")
    rec("index_supervisor.INDEX_FILE", lambda: index_supervisor.INDEX_FILE, "kopia drzewa")
    import app_updates
    rec("app_updates.INSTALLER_DIR", lambda: app_updates.INSTALLER_DIR, "kopia drzewa")
    out["app_updates.is_portable_repo"] = app_updates.is_portable_repo()
    import dam_debug
    rec("dam_debug.LOG_DIR", lambda: dam_debug.LOG_DIR, "kopia drzewa")
    import support_reports
    rec("support_reports.reports_root()", support_reports.reports_root, "kopia drzewa (repo_root zapisywalny)")
    import oauth_integrations
    rec("oauth_integrations.TOKENS_PATH", lambda: oauth_integrations.TOKENS_PATH, "kopia drzewa")
    try:
        import dam_file_availability as dfa
        rec("dam_file_availability log", getattr(dfa, "_mark_path", None) or getattr(dfa, "_log_path"), "env DAM_STATE_DIR")
    except Exception as exc:  # noqa: BLE001
        out["errors"]["dam_file_availability"] = str(exc)[:200]
    # webview profile (launch.py:873) - okna pulpitu nie uruchamiamy; sciezka wg kopii drzewa
    P["launch.webview_profile (nie uruchamiany)"] = _s(desktop / "data" / "webview2-profile")
    S["launch.webview_profile (nie uruchamiany)"] = "kopia drzewa (DESKTOP_DIR/data)"

    sys.path.insert(0, str(desktop.parent / "web" / "scripts"))
    import marketing_roots
    rec("marketing_roots.resolve_marketing_base() [skrypty potomne]", lambda: marketing_roots.resolve_marketing_base() or "", "machine-config + env DAM_MARKETING_FALLBACKS")

    import local_bridge as lb
    rec("local_bridge.WEB_ROOT", lambda: lb.WEB_ROOT, "env DAM_WEB_ROOT / kopia drzewa")
    rec("local_bridge.INDEX_FILE", lambda: lb.INDEX_FILE, "kopia drzewa (WEB_ROOT/data)")
    rec("local_bridge.AUDIT_FILE", lambda: lb.AUDIT_FILE, "kopia drzewa")
    rec("local_bridge.MACHINE_CONFIG (stara lokalizacja)", lambda: lb.MACHINE_CONFIG, "kopia drzewa")
    rec("local_bridge._machine_config_state_path()", lb._machine_config_state_path, "env DAM_STATE_DIR")
    rec("local_bridge.USER_DEVICE_PATHS_FILE", lambda: lb.USER_DEVICE_PATHS_FILE, "kopia drzewa")
    rec("local_bridge.BRANDING_REBUILD_LOCK_FILE", lambda: lb.BRANDING_REBUILD_LOCK_FILE, "kopia drzewa")
    rec("local_bridge.DATABASE (zrzut PG godzinowy)", lambda: lb.DESKTOP_DIR.parent.parent / "DATABASE", "kopia drzewa")
    out["local_bridge.PORT"] = lb.PORT
    out["local_bridge.CORS_ORIGIN"] = lb.CORS_ORIGIN
    out["local_bridge.PUBLIC_MODE"] = lb.PUBLIC_MODE
    out["local_bridge.MARKETING_CANDIDATES (przed zawezeniem przez launcher)"] = [str(c) for c in lb.MARKETING_CANDIDATES]
    out["local_bridge._asset_sync_machine"] = lb._asset_sync_machine()

    import pg_db
    cfg = pg_db._load_config()
    out["pg"] = {
        "test_mode": bool(cfg.get("_test_mode")),
        "host": cfg.get("host"), "hosts": cfg.get("hosts"), "port": cfg.get("port"),
        "dbname": cfg.get("dbname"), "user": cfg.get("user"), "sslmode": cfg.get("sslmode"),
    }
    try:
        conn = pg_db.connect()
        try:
            cur = conn.cursor()
            cur.execute("SELECT current_database() AS db, current_user AS usr, current_schema() AS sch")
            row = cur.fetchone()
            out["pg"]["live"] = dict(row)
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001
        out["pg"]["live_error"] = str(exc)[:300]
    print("E2E_PROBE_JSON:" + json.dumps(out, ensure_ascii=True), flush=True)


if __name__ == "__main__":
    main()
