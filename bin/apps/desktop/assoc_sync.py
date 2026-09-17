# -*- coding: utf-8 -*-
"""Synchronizacja skojarzen asset<->produkt: Postgres (Synology) = baza glowna,
lokalny SQLite = zrzut do pracy offline (ADR-011).

Zasady:
- Kazdy zapis do lokalnej tabeli asset_product_links oznacza wiersz jako dirty=1
  (triggery SQLite - dziala dla mostka, Quizu, skryptow OCR, seedow).
- Cykl: najpierw PULL (zmiany z Postgresa po numerze rev), potem PUSH (dirty).
- Konflikt: wygrywa nowszy updated_at. Decyzja reczna (confirmed/rejected/skipped)
  nigdy nie jest nadpisywana przez automat (auto/pending), a sama nadpisuje automat.
- dirty=2 to znacznik techniczny "zapisane przez PULL" - nie wraca do Postgresa.
"""
from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Callable

MANUAL = ("confirmed", "rejected", "skipped")
_PUSH_BATCH = 500
_PULL_BATCH = 2000
_INTERVAL_S = 20.0

_LOCAL_SQL = """
CREATE TABLE IF NOT EXISTS assoc_sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS asset_product_links_dirty_idx
  ON asset_product_links (dirty);
CREATE TRIGGER IF NOT EXISTS asset_product_links_dirty_ins
AFTER INSERT ON asset_product_links WHEN NEW.dirty = 0
BEGIN
  UPDATE asset_product_links SET dirty = 1
  WHERE asset_id = NEW.asset_id AND product_id = NEW.product_id;
END;
CREATE TRIGGER IF NOT EXISTS asset_product_links_dirty_upd
AFTER UPDATE ON asset_product_links WHEN NEW.dirty = OLD.dirty AND NEW.dirty = 0
BEGIN
  UPDATE asset_product_links SET dirty = 1
  WHERE asset_id = NEW.asset_id AND product_id = NEW.product_id;
END;
"""

_PG_SQL = """
CREATE SEQUENCE IF NOT EXISTS dam_asset_product_links_rev_seq;
CREATE TABLE IF NOT EXISTS dam_asset_product_links (
  asset_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  score DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  rev BIGINT NOT NULL DEFAULT nextval('dam_asset_product_links_rev_seq'),
  PRIMARY KEY (asset_id, product_id)
);
CREATE INDEX IF NOT EXISTS dam_asset_product_links_rev_idx
  ON dam_asset_product_links (rev);
"""

_PG_UPSERT = """
INSERT INTO dam_asset_product_links AS t
  (asset_id, product_id, score, source, status, reason, updated_at, updated_by)
VALUES %s
ON CONFLICT (asset_id, product_id) DO UPDATE SET
  score = EXCLUDED.score, source = EXCLUDED.source, status = EXCLUDED.status,
  reason = EXCLUDED.reason, updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by,
  rev = nextval('dam_asset_product_links_rev_seq')
WHERE (t.status, t.score, t.source, t.reason, t.updated_at)
      IS DISTINCT FROM
      (EXCLUDED.status, EXCLUDED.score, EXCLUDED.source, EXCLUDED.reason, EXCLUDED.updated_at)
  AND (
    (EXCLUDED.status IN ('confirmed','rejected','skipped')
       AND t.status NOT IN ('confirmed','rejected','skipped'))
    OR (t.updated_at <= EXCLUDED.updated_at
       AND NOT (t.status IN ('confirmed','rejected','skipped')
                AND EXCLUDED.status NOT IN ('confirmed','rejected','skipped')))
  )
"""

_lock = threading.Lock()
_wake = threading.Event()
_thread: threading.Thread | None = None
_state: dict[str, Any] = {"ok": None, "error": "", "last_run": 0.0, "pushed": 0, "pulled": 0}


def ensure_local(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(asset_product_links)").fetchall()}
    if "dirty" not in cols:
        conn.execute("ALTER TABLE asset_product_links ADD COLUMN dirty INTEGER NOT NULL DEFAULT 0")
    conn.executescript(_LOCAL_SQL)


def _get_state(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    row = conn.execute("SELECT value FROM assoc_sync_state WHERE key=?", (key,)).fetchone()
    return str(row[0]) if row else default


def _set_state(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO assoc_sync_state(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )


def _open_local(db_path: Path) -> sqlite3.Connection:
    import assoc_repo

    conn = assoc_repo.connect(db_path)  # ensure_schema -> ensure_local
    if _get_state(conn, "initialized") != "1":
        # Pierwsza synchronizacja: wszystko, co juz jest lokalnie, idzie do bazy glownej.
        conn.execute("UPDATE asset_product_links SET dirty = 1 WHERE dirty <> 1")
        _set_state(conn, "initialized", "1")
        conn.commit()
    return conn


def _pull(local: sqlite3.Connection, pg) -> int:
    last_rev = int(_get_state(local, "pg_rev", "0") or 0)
    applied = 0
    cur = pg.cursor()
    while True:
        cur.execute(
            "SELECT asset_id, product_id, score, source, status, reason, updated_at, updated_by, rev "
            "FROM dam_asset_product_links WHERE rev > %s ORDER BY rev LIMIT %s",
            (last_rev, _PULL_BATCH),
        )
        rows = cur.fetchall()
        if not rows:
            break
        for r in rows:
            last_rev = max(last_rev, int(r["rev"]))
            mine = local.execute(
                "SELECT status, updated_at, dirty FROM asset_product_links "
                "WHERE asset_id=? AND product_id=?",
                (r["asset_id"], r["product_id"]),
            ).fetchone()
            if mine is not None:
                m_status, m_at, m_dirty = str(mine[0]), str(mine[1] or ""), int(mine[2] or 0)
                if m_status in MANUAL and r["status"] not in MANUAL:
                    if m_dirty != 1:
                        local.execute(
                            "UPDATE asset_product_links SET dirty=1 WHERE asset_id=? AND product_id=?",
                            (r["asset_id"], r["product_id"]),
                        )
                    continue
                remote_manual_wins = r["status"] in MANUAL and m_status not in MANUAL
                if m_dirty == 1 and m_at > str(r["updated_at"] or "") and not remote_manual_wins:
                    continue
            local.execute(
                "INSERT INTO asset_product_links"
                "(asset_id, product_id, score, source, status, reason, updated_at, updated_by, dirty) "
                "VALUES(?,?,?,?,?,?,?,?,2) "
                "ON CONFLICT(asset_id, product_id) DO UPDATE SET "
                "score=excluded.score, source=excluded.source, status=excluded.status, "
                "reason=excluded.reason, updated_at=excluded.updated_at, "
                "updated_by=excluded.updated_by, dirty=2",
                (r["asset_id"], r["product_id"], r["score"], r["source"], r["status"],
                 r["reason"], r["updated_at"], r["updated_by"]),
            )
            applied += 1
        local.execute("UPDATE asset_product_links SET dirty=0 WHERE dirty=2")
        _set_state(local, "pg_rev", str(last_rev))
        local.commit()
        if len(rows) < _PULL_BATCH:
            break
    return applied


def _push(local: sqlite3.Connection, pg) -> int:
    import psycopg2.extras

    pushed = 0
    while True:
        rows = local.execute(
            "SELECT asset_id, product_id, score, source, status, reason, updated_at, updated_by "
            "FROM asset_product_links WHERE dirty=1 LIMIT ?",
            (_PUSH_BATCH,),
        ).fetchall()
        if not rows:
            break
        values = [tuple(r) for r in rows]
        cur = pg.cursor()
        psycopg2.extras.execute_values(cur, _PG_UPSERT, values, page_size=_PUSH_BATCH)
        pg.commit()
        local.executemany(
            "UPDATE asset_product_links SET dirty=0 "
            "WHERE asset_id=? AND product_id=? AND updated_at=? AND dirty=1",
            [(v[0], v[1], v[6]) for v in values],
        )
        local.commit()
        pushed += len(values)
        if len(rows) < _PUSH_BATCH:
            break
    return pushed


def sync_once(db_path: Path) -> dict[str, Any]:
    """Jeden pelny cykl PULL+PUSH. Rzuca wyjatek, gdy Postgres niedostepny."""
    import pg_db

    pg = pg_db.connect()
    try:
        pg.cursor().execute(_PG_SQL)
        pg.commit()
        local = _open_local(Path(db_path))
        try:
            pulled = _pull(local, pg)
            pushed = _push(local, pg)
            pending_local = local.execute(
                "SELECT COUNT(1) FROM asset_product_links WHERE dirty=1"
            ).fetchone()[0]
        finally:
            local.close()
    finally:
        pg.close()
    return {"ok": True, "pulled": pulled, "pushed": pushed, "dirty_left": int(pending_local)}


def status() -> dict[str, Any]:
    with _lock:
        return dict(_state)


def kick() -> None:
    """Obudz watek synchronizacji zaraz po lokalnym zapisie."""
    _wake.set()


def start(db_path: Path, on_pulled: Callable[[], None] | None = None) -> bool:
    global _thread
    with _lock:
        if _thread is not None and _thread.is_alive():
            return False

        def _loop() -> None:
            import pg_db

            while True:
                _wake.wait(_INTERVAL_S)
                _wake.clear()
                time.sleep(1.0)  # zbierz kilka szybkich zapisow w jeden cykl
                try:
                    if not pg_db.is_configured():
                        continue
                    res = sync_once(db_path)
                    with _lock:
                        _state.update(ok=True, error="", last_run=time.time(),
                                      pushed=_state["pushed"] + res["pushed"],
                                      pulled=_state["pulled"] + res["pulled"],
                                      dirty_left=res["dirty_left"])
                    if res["pulled"] and on_pulled:
                        on_pulled()
                except Exception as exc:  # noqa: BLE001 - offline to normalny stan
                    with _lock:
                        _state.update(ok=False, error=str(exc)[:300], last_run=time.time())

        _thread = threading.Thread(target=_loop, name="dam-assoc-sync", daemon=True)
        _thread.start()
        _wake.set()
        return True


if __name__ == "__main__":
    import argparse
    import json
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    ap = argparse.ArgumentParser(description="Jednorazowa synchronizacja skojarzen z Postgresem.")
    ap.add_argument("--db", action="append", required=True, help="sciezka do dam-local.sqlite (mozna kilka)")
    args = ap.parse_args()
    for db in args.db:
        print(db, json.dumps(sync_once(Path(db))))
