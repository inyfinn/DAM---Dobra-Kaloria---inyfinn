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
- Historia: kazda zmiana wiersza w Postgresie (trigger) i kazda przegrana wersja
  (konflikt) trafia do dam_assoc_history. Admin moze przywrocic dowolna wersje.
  Historia trzymana 30 dni, nierozwiazane konflikty 90 dni.
- Kopia lokalnej bazy raz dziennie w DATABASE/backups, 30 dni.
"""
from __future__ import annotations

import json
import re
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

MANUAL = ("confirmed", "rejected", "skipped")
FIELDS = ("status", "score", "source", "reason", "updated_at", "updated_by")
HISTORY_DAYS = 30
OPEN_CONFLICT_DAYS = 90
BACKUP_DAYS = 30
_PUSH_BATCH = 500
_PULL_BATCH = 2000
_INTERVAL_S = 20.0
_HOUSEKEEP_S = 3600.0

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
CREATE TABLE IF NOT EXISTS dam_assoc_history (
  id BIGSERIAL PRIMARY KEY,
  asset_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  kept JSONB,
  lost JSONB,
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT NOT NULL DEFAULT '',
  resolution TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS dam_assoc_history_created_idx
  ON dam_assoc_history (created_at DESC);
CREATE INDEX IF NOT EXISTS dam_assoc_history_open_idx
  ON dam_assoc_history (kind, resolved_at);
CREATE OR REPLACE FUNCTION dam_assoc_log_change() RETURNS trigger AS $$
BEGIN
  IF (OLD.status, OLD.score, OLD.source, OLD.reason)
     IS DISTINCT FROM (NEW.status, NEW.score, NEW.source, NEW.reason) THEN
    INSERT INTO dam_assoc_history (asset_id, product_id, kind, kept, lost, actor)
    VALUES (
      NEW.asset_id, NEW.product_id, 'change',
      jsonb_build_object('status', NEW.status, 'score', NEW.score, 'source', NEW.source,
        'reason', NEW.reason, 'updated_at', NEW.updated_at, 'updated_by', NEW.updated_by),
      jsonb_build_object('status', OLD.status, 'score', OLD.score, 'source', OLD.source,
        'reason', OLD.reason, 'updated_at', OLD.updated_at, 'updated_by', OLD.updated_by),
      NEW.updated_by
    );
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS dam_assoc_history_trg ON dam_asset_product_links;
CREATE TRIGGER dam_assoc_history_trg
  AFTER UPDATE ON dam_asset_product_links
  FOR EACH ROW EXECUTE PROCEDURE dam_assoc_log_change();
CREATE TABLE IF NOT EXISTS dam_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

# Stare formaty asset_id sprzed migracji na stabilne id (br-0########).
# Zrodlo prawdy: bin/apps/web/scripts/asset_ids.py::is_stable_id (inny katalog - nie
# importujemy, tylko powielamy regex, zeby nie ciagnac zaleznosci web -> desktop).
_LEGACY_ID_PATTERNS = (
    re.compile(r"^br-\d{6}$"),                     # np. br-010745
    re.compile(r"^M-[A-Z]+\d{6}-\d{2}-\d{2}$"),    # np. M-SHOP405510-03-26
)


def _is_legacy_asset_id(asset_id: Any) -> bool:
    s = str(asset_id or "")
    return any(p.match(s) for p in _LEGACY_ID_PATTERNS)


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
RETURNING asset_id, product_id
"""

_lock = threading.Lock()
_wake = threading.Event()
_thread: threading.Thread | None = None
_pg_ready = False
_state: dict[str, Any] = {"ok": None, "error": "", "last_run": 0.0, "pushed": 0, "pulled": 0,
                          "conflicts": 0}


def utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def ensure_local(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(asset_product_links)").fetchall()}
    if "dirty" not in cols:
        conn.execute("ALTER TABLE asset_product_links ADD COLUMN dirty INTEGER NOT NULL DEFAULT 0")
    conn.executescript(_LOCAL_SQL)


def _ensure_pg(pg) -> None:
    global _pg_ready
    if _pg_ready:
        return
    pg.cursor().execute(_PG_SQL)
    pg.commit()
    _pg_ready = True


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


def _server_epoch(pg) -> str:
    """Znacznik epoki migracji asset_id z PG (dam_meta.asset_id_epoch); '' = brak/nieustawiony."""
    cur = pg.cursor()
    cur.execute("SELECT value FROM dam_meta WHERE key='asset_id_epoch'")
    row = cur.fetchone()
    if not row:
        return ""
    return str(row["value"] or "")


def _apply_epoch(local: sqlite3.Connection, server_epoch: str, db_path: Path) -> dict[str, Any] | None:
    """Gdy PG ogloszil nowa epoke asset_id, wyczysc lokalne wiersze o starych id i
    wymus pelny re-pull. Reczne decyzje (dirty, status manualny) trafiaja najpierw
    do pliku <db>.epoch-<epoka>-lost-manual.json, zeby nic nie zniknelo po cichu."""
    if not server_epoch:
        return None
    if _get_state(local, "asset_id_epoch") == server_epoch:
        return None
    rows = local.execute(
        "SELECT asset_id, product_id, score, source, status, reason, updated_at, updated_by, dirty "
        "FROM asset_product_links"
    ).fetchall()
    legacy = [r for r in rows if _is_legacy_asset_id(r["asset_id"])]
    saved_manual: list[dict[str, Any]] = []
    for r in legacy:
        if str(r["status"]) in MANUAL and int(r["dirty"] or 0) == 1:
            entry = _version(r)
            entry["asset_id"] = r["asset_id"]
            entry["product_id"] = r["product_id"]
            saved_manual.append(entry)
    if saved_manual:
        out_path = Path(db_path).with_name(Path(db_path).name + f".epoch-{server_epoch}-lost-manual.json")
        out_path.write_text(json.dumps(saved_manual, ensure_ascii=False, indent=2), encoding="utf-8")
    for r in legacy:
        local.execute(
            "DELETE FROM asset_product_links WHERE asset_id=? AND product_id=?",
            (r["asset_id"], r["product_id"]),
        )
    _set_state(local, "pg_rev", "0")
    _set_state(local, "asset_id_epoch", server_epoch)
    local.commit()
    return {"epoch": server_epoch, "removed_legacy": len(legacy), "saved_manual": len(saved_manual)}


def _server_reconcile(pg) -> str:
    """dam_meta.assoc_reconcile - zmieniany po twardym usunieciu wierszy w PG (np.
    ponowne zasianie skojarzen). '' = brak."""
    cur = pg.cursor()
    cur.execute("SELECT value FROM dam_meta WHERE key='assoc_reconcile'")
    row = cur.fetchone()
    return str(row["value"] or "") if row else ""


def _apply_reconcile(local: sqlite3.Connection, pg, tag: str, db_path: Path) -> dict[str, Any] | None:
    """PULL przenosi tylko wstawienia i zmiany - twarde DELETE w PG nigdy nie docieralo
    do innych komputerow (23.09: kopia bez ROOT trzymala 96 skojarzen skasowanych przy
    ponownym zasianiu, np. TUBA <-> ciasto porzeczkowe). Przy nowym znaczniku: usun
    lokalne wiersze, ktorych nie ma w PG, poza niewyslanymi zmianami (dirty=1) - te
    PUSH wysle. Usuwane wiersze ida najpierw do <db>.reconcile-<znacznik>.json."""
    if not tag or _get_state(local, "assoc_reconcile") == tag:
        return None
    cur = pg.cursor()
    cur.execute("SELECT asset_id, product_id FROM dam_asset_product_links")
    remote = {(str(r["asset_id"]), str(r["product_id"])) for r in cur.fetchall()}
    rows = local.execute(
        "SELECT asset_id, product_id, score, source, status, reason, updated_at, updated_by, dirty "
        "FROM asset_product_links"
    ).fetchall()
    missing = [r for r in rows if (str(r["asset_id"]), str(r["product_id"])) not in remote
               and int(r["dirty"] or 0) != 1]
    # Reczna decyzja (confirmed/rejected/skipped) nigdy nie znika przez automat -
    # ponowne zasianie w PG jej nie odtwarza, wiec wraca do PG przez PUSH (dirty=1).
    manual = [r for r in missing if str(r["status"]) in MANUAL]
    if manual:
        local.executemany(
            "UPDATE asset_product_links SET dirty=1 WHERE asset_id=? AND product_id=?",
            [(r["asset_id"], r["product_id"]) for r in manual],
        )
    gone = [r for r in missing if str(r["status"]) not in MANUAL]
    if gone:
        safe_tag = re.sub(r"[^A-Za-z0-9_.-]", "_", tag)[:60]
        out_path = Path(db_path).with_name(Path(db_path).name + f".reconcile-{safe_tag}.json")
        out_path.write_text(json.dumps(
            [dict(_version(r), asset_id=r["asset_id"], product_id=r["product_id"]) for r in gone],
            ensure_ascii=False, indent=1), encoding="utf-8")
        local.executemany(
            "DELETE FROM asset_product_links WHERE asset_id=? AND product_id=? AND dirty<>1",
            [(r["asset_id"], r["product_id"]) for r in gone],
        )
    _set_state(local, "assoc_reconcile", tag)
    local.commit()
    return {"tag": tag, "removed": len(gone), "kept_manual": len(manual)}


def _version(row: Any) -> dict[str, Any]:
    return {k: row[k] for k in FIELDS}


def _same_content(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return all(a.get(k) == b.get(k) for k in ("status", "score", "source", "reason"))


def _log_conflict(pg, asset_id: str, product_id: str, kept: dict, lost: dict, note: str, actor: str) -> None:
    import psycopg2.extras

    pg.cursor().execute(
        "INSERT INTO dam_assoc_history (asset_id, product_id, kind, kept, lost, note, actor) "
        "VALUES (%s, %s, 'conflict', %s, %s, %s, %s)",
        (asset_id, product_id, psycopg2.extras.Json(kept), psycopg2.extras.Json(lost), note, actor),
    )


def _pull(local: sqlite3.Connection, pg) -> tuple[int, int]:
    last_rev = int(_get_state(local, "pg_rev", "0") or 0)
    applied = conflicts = 0
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
                "SELECT status, score, source, reason, updated_at, updated_by, dirty "
                "FROM asset_product_links WHERE asset_id=? AND product_id=?",
                (r["asset_id"], r["product_id"]),
            ).fetchone()
            if mine is not None and int(mine["dirty"] or 0) == 1:
                m_status, m_at = str(mine["status"]), str(mine["updated_at"] or "")
                remote_manual_wins = r["status"] in MANUAL and m_status not in MANUAL
                if m_status in MANUAL and r["status"] not in MANUAL:
                    continue  # reczna decyzja offline wygrywa z automatem - PUSH ja wysle
                if m_at > str(r["updated_at"] or "") and not remote_manual_wins:
                    continue  # lokalna zmiana nowsza - PUSH ja wysle
                lost = _version(mine)
                if not _same_content(lost, _version(r)):
                    # Lokalna zmiana offline przegrywa z nowsza - zapisz ja do przegladu.
                    _log_conflict(pg, r["asset_id"], r["product_id"], _version(r), lost,
                                  "offline_change_older", str(mine["updated_by"] or ""))
                    conflicts += 1
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
        pg.commit()
        local.execute("UPDATE asset_product_links SET dirty=0 WHERE dirty=2")
        _set_state(local, "pg_rev", str(last_rev))
        local.commit()
        if len(rows) < _PULL_BATCH:
            break
    return applied, conflicts


def _split_legacy(rows: list) -> tuple[list, list]:
    """Rozdziel wiersze na (do wyslania, stare-id) - stare id nigdy nie wracaja do PG."""
    ok, legacy = [], []
    for r in rows:
        (legacy if _is_legacy_asset_id(r["asset_id"]) else ok).append(r)
    return ok, legacy


def _push(local: sqlite3.Connection, pg, server_epoch: str = "") -> tuple[int, int]:
    import psycopg2.extras

    pushed = conflicts = 0
    while True:
        rows = local.execute(
            "SELECT asset_id, product_id, score, source, status, reason, updated_at, updated_by "
            "FROM asset_product_links WHERE dirty=1 LIMIT ?",
            (_PUSH_BATCH,),
        ).fetchall()
        if not rows:
            break
        if server_epoch:
            # Filtr bezpieczenstwa: gdyby jakis stary-id wiersz wciaz mial dirty=1
            # (np. epoka zastosowana wczesniej), nie wysylaj go do PG.
            rows, legacy = _split_legacy(rows)
            if legacy:
                local.executemany(
                    "UPDATE asset_product_links SET dirty=0 WHERE asset_id=? AND product_id=?",
                    [(r["asset_id"], r["product_id"]) for r in legacy],
                )
                local.commit()
            if not rows:
                continue
        values = [tuple(r) for r in rows]
        cur = pg.cursor()
        applied = psycopg2.extras.execute_values(
            cur, _PG_UPSERT, values, page_size=_PUSH_BATCH, fetch=True
        )
        applied_keys = {(a["asset_id"], a["product_id"]) for a in applied}
        refused = [r for r in rows if (r["asset_id"], r["product_id"]) not in applied_keys]
        for r in refused:
            cur.execute(
                "SELECT status, score, source, reason, updated_at, updated_by "
                "FROM dam_asset_product_links WHERE asset_id=%s AND product_id=%s",
                (r["asset_id"], r["product_id"]),
            )
            current = cur.fetchone()
            if current is None:
                continue
            kept, lost = _version(current), _version(r)
            if _same_content(kept, lost):
                continue
            note = ("auto_vs_manual" if kept["status"] in MANUAL and lost["status"] not in MANUAL
                    else "older_than_server")
            _log_conflict(pg, r["asset_id"], r["product_id"], kept, lost, note,
                          str(r["updated_by"] or ""))
            conflicts += 1
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
    return pushed, conflicts


def sync_once(db_path: Path) -> dict[str, Any]:
    """Jeden pelny cykl PULL+PUSH. Rzuca wyjatek, gdy Postgres niedostepny."""
    import pg_db

    pg = pg_db.connect()
    try:
        _ensure_pg(pg)
        local = _open_local(Path(db_path))
        try:
            server_epoch = _server_epoch(pg)
            epoch_result = _apply_epoch(local, server_epoch, Path(db_path))
            reconcile_result = _apply_reconcile(local, pg, _server_reconcile(pg), Path(db_path))
            pulled, c1 = _pull(local, pg)
            pushed, c2 = _push(local, pg, server_epoch)
            pending_local = local.execute(
                "SELECT COUNT(1) FROM asset_product_links WHERE dirty=1"
            ).fetchone()[0]
        finally:
            local.close()
    finally:
        pg.close()
    result = {"ok": True, "pulled": pulled, "pushed": pushed, "conflicts": c1 + c2,
              "dirty_left": int(pending_local)}
    if epoch_result:
        result["epoch"] = epoch_result
    if reconcile_result:
        result["reconcile"] = reconcile_result
    return result


# --------------------------------------------------------------------------
# Historia i konflikty (panel admina)
# --------------------------------------------------------------------------

def _iso(v: Any) -> str:
    if isinstance(v, datetime):
        return v.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return str(v or "")


def history(*, kind: str = "conflict", open_only: bool = True, asset_id: str = "",
            limit: int = 100, offset: int = 0) -> dict[str, Any]:
    import pg_db

    where, args = [], []
    if kind in ("conflict", "change"):
        where.append("kind = %s")
        args.append(kind)
    if open_only:
        where.append("resolved_at IS NULL")
    if asset_id:
        where.append("asset_id = %s")
        args.append(asset_id)
    sql_where = ("WHERE " + " AND ".join(where)) if where else ""
    pg = pg_db.connect()
    try:
        _ensure_pg(pg)
        cur = pg.cursor()
        cur.execute(f"SELECT COUNT(1) AS n FROM dam_assoc_history {sql_where}", args)
        total = int(cur.fetchone()["n"])
        cur.execute(
            "SELECT COUNT(1) AS n FROM dam_assoc_history WHERE kind='conflict' AND resolved_at IS NULL"
        )
        open_conflicts = int(cur.fetchone()["n"])
        cur.execute(
            "SELECT id, asset_id, product_id, kind, kept, lost, note, actor, created_at, "
            "resolved_at, resolved_by, resolution FROM dam_assoc_history "
            f"{sql_where} ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s",
            [*args, max(1, min(int(limit), 500)), max(0, int(offset))],
        )
        items = []
        for r in cur.fetchall():
            item = dict(r)
            item["created_at"] = _iso(item["created_at"])
            item["resolved_at"] = _iso(item["resolved_at"]) if item["resolved_at"] else ""
            items.append(item)
    finally:
        pg.close()
    return {"ok": True, "items": items, "total": total, "open_conflicts": open_conflicts,
            "retention_days": HISTORY_DAYS}


def restore(history_id: int, which: str, actor: str) -> dict[str, Any]:
    """Zapisz wybrana wersje (lost = odrzucona/poprzednia, kept = obecna) jako aktualna."""
    import pg_db

    if which not in ("lost", "kept"):
        return {"ok": False, "error": "bad_version"}
    pg = pg_db.connect()
    try:
        _ensure_pg(pg)
        cur = pg.cursor()
        cur.execute("SELECT * FROM dam_assoc_history WHERE id=%s FOR UPDATE", (int(history_id),))
        h = cur.fetchone()
        if not h:
            return {"ok": False, "error": "not_found"}
        ver = h[which]
        if isinstance(ver, str):
            ver = json.loads(ver)
        if not isinstance(ver, dict) or not ver.get("status"):
            return {"ok": False, "error": "no_version"}
        who = f"restore:{actor or 'admin'}"
        cur.execute(
            "INSERT INTO dam_asset_product_links AS t "
            "(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT (asset_id, product_id) DO UPDATE SET "
            "score=EXCLUDED.score, source=EXCLUDED.source, status=EXCLUDED.status, "
            "reason=EXCLUDED.reason, updated_at=EXCLUDED.updated_at, updated_by=EXCLUDED.updated_by, "
            "rev=nextval('dam_asset_product_links_rev_seq')",
            (h["asset_id"], h["product_id"], ver.get("score"), ver.get("source") or "",
             ver["status"], ver.get("reason") or "", utc_now(), who),
        )
        cur.execute(
            "UPDATE dam_assoc_history SET resolved_at=now(), resolved_by=%s, resolution=%s "
            "WHERE id=%s",
            (actor or "admin", "restored_" + which, int(history_id)),
        )
        pg.commit()
    finally:
        pg.close()
    kick()
    return {"ok": True, "id": int(history_id), "asset_id": h["asset_id"],
            "product_id": h["product_id"], "status": ver["status"]}


def resolve(history_id: int, actor: str) -> dict[str, Any]:
    """Zaakceptuj wybor programu (konflikt znika z listy otwartych)."""
    import pg_db

    pg = pg_db.connect()
    try:
        cur = pg.cursor()
        cur.execute(
            "UPDATE dam_assoc_history SET resolved_at=now(), resolved_by=%s, resolution='accepted' "
            "WHERE id=%s AND resolved_at IS NULL",
            (actor or "admin", int(history_id)),
        )
        n = cur.rowcount
        pg.commit()
    finally:
        pg.close()
    return {"ok": True, "id": int(history_id), "updated": n}


def _housekeep_pg() -> None:
    import pg_db

    pg = pg_db.connect()
    try:
        _ensure_pg(pg)
        cur = pg.cursor()
        cur.execute(
            "DELETE FROM dam_assoc_history WHERE "
            "(created_at < now() - make_interval(days => %s) "
            "  AND (kind <> 'conflict' OR resolved_at IS NOT NULL)) "
            "OR created_at < now() - make_interval(days => %s)",
            (HISTORY_DAYS, OPEN_CONFLICT_DAYS),
        )
        pg.commit()
    finally:
        pg.close()


def backup_local(db_path: Path, *, keep_days: int = BACKUP_DAYS) -> Path | None:
    """Kopia lokalnej bazy raz dziennie (sqlite backup API - bezpieczne przy pracy mostka)."""
    db_path = Path(db_path)
    if not db_path.is_file():
        return None
    folder = db_path.parent / "backups"
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"{db_path.stem}-{time.strftime('%Y%m%d')}.sqlite"
    made = None
    if not target.exists():
        tmp = target.with_suffix(".tmp")
        src = sqlite3.connect(str(db_path), timeout=60)
        dst = sqlite3.connect(str(tmp))
        try:
            src.backup(dst)
        finally:
            dst.close()
            src.close()
        tmp.replace(target)
        made = target
    cutoff = time.time() - keep_days * 86400
    for old in folder.glob(f"{db_path.stem}-*.sqlite"):
        # tylko nasze pliki z data w nazwie
        stamp = old.stem[len(db_path.stem) + 1:]
        if len(stamp) == 8 and stamp.isdigit() and old.stat().st_mtime < cutoff:
            old.unlink()
    return made


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

            last_housekeep = 0.0
            while True:
                _wake.wait(_INTERVAL_S)
                _wake.clear()
                time.sleep(1.0)  # zbierz kilka szybkich zapisow w jeden cykl
                if time.time() - last_housekeep > _HOUSEKEEP_S:
                    try:
                        backup_local(db_path)
                    except Exception as exc:  # noqa: BLE001
                        print("assoc backup:", exc)
                try:
                    if not pg_db.is_configured():
                        continue
                    res = sync_once(db_path)
                    if time.time() - last_housekeep > _HOUSEKEEP_S:
                        _housekeep_pg()
                        last_housekeep = time.time()
                    with _lock:
                        _state.update(ok=True, error="", last_run=time.time(),
                                      pushed=_state["pushed"] + res["pushed"],
                                      pulled=_state["pulled"] + res["pulled"],
                                      conflicts=_state["conflicts"] + res["conflicts"],
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
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    ap = argparse.ArgumentParser(description="Jednorazowa synchronizacja skojarzen z Postgresem.")
    ap.add_argument("--db", action="append", required=True, help="sciezka do dam-local.sqlite (mozna kilka)")
    args = ap.parse_args()
    for db in args.db:
        print(db, json.dumps(sync_once(Path(db))))
