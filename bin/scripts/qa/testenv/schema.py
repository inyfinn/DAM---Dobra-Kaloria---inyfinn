# -*- coding: utf-8 -*-
"""Naklada schemat aplikacji DAM na baze PostgreSQL, uzywajac WYLACZNIE
wlasnych funkcji/stalych DDL aplikacji (zero rekonstrukcji z pamieci) - patrz
kroki W1 (3) w DECYZJE 2026-09-28b.

STAN 2026-09-28 (korekta wlasciciela przekazana przez orkiestratora): zero
testowej bazy PostgreSQL gdziekolwiek na tym etapie. Ten skrypt NIE ZOSTAL
URUCHOMIONY na zadnej bazie - jest przygotowany do uzycia wylacznie wtedy, gdy
ktos rowniez jawnie ustawi DAM_TEST_PG_DSN (patrz bin/apps/desktop/tests/realpg.py)
na jakims innym, wskazanym przez wlasciciela, izolowanym serwerze testowym.

Zrodla DDL (cytowane, nie przepisane z pamieci):
  - bin/apps/desktop/pg_schema.sql
    -> users, device_sessions, audit_log, dam_kv_store, dam_kv_merge_review,
       dam_thumb_cache_index (linie 10-93). To JEDYNE miejsce, ktore tworzy
       'users'/'device_sessions'/'audit_log'/'dam_kv_store' dla PostgreSQL -
       dam_db.py:664 mowi wprost "Schemat jest tworzony przez pg_schema.sql
       na NAS - tu tylko ping + status", wiec kod aplikacji CELOWO tych tabel
       sam nie tworzy.
  - bin/apps/desktop/asset_sync.py:487-503 (PG_DDL) + asset_sync.py:562
    (ensure_schema(pg) -> cur.execute(PG_DDL); conn.commit()) -> dam_assets,
    dam_assets_rev_seq.
  - bin/apps/desktop/assoc_sync.py:59-116 (_PG_SQL) + assoc_sync.py:176
    (_ensure_pg(pg) -> pg.cursor().execute(_PG_SQL)) -> dam_asset_product_links,
    dam_assoc_history (+trigger dam_assoc_log_change), dam_meta.
  - bin/apps/desktop/pg_db.py:489-539 (_ensure_kv_index(conn)) -> index na
    dam_kv_store, dam_kv_merge_review (jesli brak), dam_thumb_cache_index
    (jesli brak) + ich indeksy.
  - bin/apps/desktop/pg_db.py:1151-1163 (_SNAPSHOT_DDL, uzywane inline w
    publish_index_snapshot) -> dam_index_snapshots.
  - bin/apps/desktop/ip_guard.py:104-117 (_ensure_schema(conn)) ->
    auth_login_failures, auth_ip_blocks (throttling logowania, tez przez
    dam_db.connect() -> moze trafic do PG).

`dam_test_marker` NIE jest tabela aplikacji - to bezpiecznik izolacji z
pg_db.py (connect() w trybie testowym wymaga w niej co najmniej zerowego
wyniku SELECT). Tworzona tu na koncu, tylko na bazie testowej.
"""
from __future__ import annotations

import sys
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parents[3] / "apps" / "desktop"
if str(DESKTOP_DIR) not in sys.path:
    sys.path.insert(0, str(DESKTOP_DIR))

_PG_SCHEMA_SQL_PATH = DESKTOP_DIR / "pg_schema.sql"


def apply_schema(conn) -> dict:
    """Naklada caly schemat aplikacji na polaczenie `conn` (psycopg2, juz
    otwarte do bazy TESTOWEJ - wywolujacy odpowiada za to, ze to nie jest
    produkcja). Idempotentne (same IF NOT EXISTS / OR REPLACE co w zrodle).
    Zwraca slownik z lista krokow i ewentualnymi bledami."""
    steps: list[dict] = []

    # 1) pg_schema.sql - jedyne zrodlo users/device_sessions/audit_log/dam_kv_store.
    sql_text = _PG_SCHEMA_SQL_PATH.read_text(encoding="utf-8")
    cur = conn.cursor()
    try:
        cur.execute(sql_text)
        conn.commit()
        steps.append({"step": "pg_schema.sql", "ok": True})
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        steps.append({"step": "pg_schema.sql", "ok": False, "error": str(exc)})
        raise

    # 2) asset_sync.ensure_schema(pg) - funkcja aplikacji, nie przepisane DDL.
    #    Uwaga: ta funkcja lapie wyjatki SAMA i zwraca {"ok": False, "error": ...}
    #    zamiast rzucac (asset_sync.py:744-746 - "offline/brak uprawnien to
    #    normalny stan") - sprawdzamy wiec zwrocony slownik, nie wyjatek.
    import asset_sync

    res = asset_sync.ensure_schema(conn)
    steps.append({"step": "asset_sync.ensure_schema", **res})
    if not res.get("ok"):
        raise RuntimeError(f"asset_sync.ensure_schema failed: {res.get('error')}")

    # 3) assoc_sync._ensure_pg(pg) - funkcja aplikacji (prywatna, ale realna).
    import assoc_sync

    try:
        assoc_sync._ensure_pg(conn)
        steps.append({"step": "assoc_sync._ensure_pg", "ok": True})
    except Exception as exc:  # noqa: BLE001
        steps.append({"step": "assoc_sync._ensure_pg", "ok": False, "error": str(exc)})
        raise

    # 4) pg_db._ensure_kv_index(conn) - funkcja aplikacji.
    import pg_db as _pg_db

    try:
        _pg_db._ensure_kv_index(conn)
        steps.append({"step": "pg_db._ensure_kv_index", "ok": True})
    except Exception as exc:  # noqa: BLE001
        steps.append({"step": "pg_db._ensure_kv_index", "ok": False, "error": str(exc)})
        raise

    # 5) pg_db._SNAPSHOT_DDL - stala aplikacji (cytat, plik:linia w docstringu
    #    modulu), wykonywana normalnie tylko inline w publish_index_snapshot().
    try:
        cur = conn.cursor()
        cur.execute(_pg_db._SNAPSHOT_DDL)
        conn.commit()
        steps.append({"step": "pg_db._SNAPSHOT_DDL (dam_index_snapshots)", "ok": True})
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        steps.append({"step": "pg_db._SNAPSHOT_DDL (dam_index_snapshots)", "ok": False, "error": str(exc)})
        raise

    # 6) auth_login_failures / auth_ip_blocks (ip_guard.py:104-117,
    #    _ensure_schema(conn)) - CELOWO NIE wolamy tej funkcji wprost: jej
    #    zapytania ida przez _exec()/_use_pg() (ip_guard.py:37-46, 60-65),
    #    ktore czytaja GLOBALNY stan dam_db.use_postgres(), a nie typ
    #    przekazanego `conn` - wywolanie w izolacji mogloby po cichu odpalic
    #    skladnie SQLite na polaczeniu PG (albo odwrotnie), gdyby globalny stan
    #    procesu nie zgadzal sie z `conn`. Zamiast tego wykonujemy DOKLADNIE te
    #    same dwa CREATE TABLE (cytat 1:1, PG-owa galaz _exec dla _use_pg()==True
    #    uzywa zwyklego .execute() bez konwersji placeholderow, wiec tresc SQL
    #    jest identyczna).
    cur = conn.cursor()
    try:
        cur.execute(
            "CREATE TABLE IF NOT EXISTS auth_login_failures ("
            "ip TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', ts DOUBLE PRECISION NOT NULL)"
        )
        cur.execute("CREATE INDEX IF NOT EXISTS auth_login_failures_ip_idx ON auth_login_failures (ip, ts)")
        cur.execute(
            "CREATE TABLE IF NOT EXISTS auth_ip_blocks ("
            "ip TEXT PRIMARY KEY, blocked_at DOUBLE PRECISION NOT NULL, "
            "reason TEXT NOT NULL DEFAULT '', last_email TEXT NOT NULL DEFAULT '')"
        )
        conn.commit()
        steps.append({"step": "ip_guard tables (cytat ip_guard.py:104-117)", "ok": True})
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        steps.append({"step": "ip_guard tables (cytat ip_guard.py:104-117)", "ok": False, "error": str(exc)})
        raise

    return {"ok": True, "steps": steps}


def list_tables(conn) -> list[str]:
    cur = conn.cursor()
    cur.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'public' ORDER BY table_name"
    )
    return [r[0] if not isinstance(r, dict) else r.get("table_name") for r in cur.fetchall()]


if __name__ == "__main__":
    print(
        "Ten skrypt NIE laczy sie z niczym samodzielnie (brak domyslnego hosta). "
        "Uzyj apply_schema(conn) z wlasnym polaczeniem do bazy TESTOWEJ "
        "(host loopback, DAM_TEST_PG=1) - patrz bin/apps/desktop/tests/realpg.py."
    )
