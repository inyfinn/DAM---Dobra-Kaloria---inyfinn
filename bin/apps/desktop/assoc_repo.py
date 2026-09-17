# -*- coding: utf-8 -*-
"""Unified SQLite SoT for asset_product_links + override mirror (ADR-010)."""
from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Callable

DESKTOP_DIR = Path(__file__).resolve().parent
DATA_DIR = DESKTOP_DIR / "data"
WEB_ROOT = DESKTOP_DIR.parent / "web"
try:
    from dam_db import DB_CANONICAL as DEFAULT_DB
except Exception:  # pragma: no cover
    DEFAULT_DB = DATA_DIR.parent.parent / "DATABASE" / "dam-local.sqlite"
DEFAULT_OVERRIDES = WEB_ROOT / "data" / "branding-associations-overrides.json"

_SCHEMA_SQL = """
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
"""

_publish_lock = threading.Lock()
_publish_timer: threading.Timer | None = None
_publish_cb: Callable[[], None] | None = None


def utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA_SQL)
    import assoc_sync

    assoc_sync.ensure_local(conn)


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    path = Path(db_path or DEFAULT_DB)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=60)
    conn.row_factory = sqlite3.Row
    ensure_schema(conn)
    return conn


def status_counts(db_path: Path | None = None) -> dict[str, Any]:
    """Return assoc status counts; never mask schema errors as empty queue."""
    path = Path(db_path or DEFAULT_DB)
    out: dict[str, Any] = {
        "ok": True,
        "db": str(path),
        "exists": path.is_file(),
        "counts": {},
        "schema_error": "",
        "total": 0,
    }
    if not path.is_file():
        out["ok"] = False
        out["schema_error"] = "sqlite_missing"
        return out
    try:
        conn = connect(path)
        try:
            rows = conn.execute(
                "SELECT status, COUNT(1) AS n FROM asset_product_links GROUP BY status"
            ).fetchall()
            counts = {str(r["status"]): int(r["n"]) for r in rows}
            out["counts"] = counts
            out["total"] = sum(counts.values())
            # Probe required columns
            cols = {
                r[1]
                for r in conn.execute("PRAGMA table_info(asset_product_links)").fetchall()
            }
            required = {"asset_id", "product_id", "status", "score", "source"}
            missing = sorted(required - cols)
            if missing:
                out["ok"] = False
                out["schema_error"] = "missing_columns:" + ",".join(missing)
        finally:
            conn.close()
    except sqlite3.Error as exc:
        out["ok"] = False
        out["schema_error"] = str(exc)
    try:
        import assoc_sync

        out["sync"] = assoc_sync.status()
    except Exception:
        pass
    return out


def mirror_override(
    asset_id: str,
    product_ids: list[str],
    *,
    overrides_path: Path | None = None,
    variant_ids: list[str] | None = None,
    folder_group_id: str = "",
    updated_by: str = "assoc_repo",
) -> dict[str, Any]:
    """Compatibility mirror: JSON override file only (not SoT)."""
    path = Path(overrides_path or DEFAULT_OVERRIDES)
    aid = str(asset_id or "").strip()
    if not aid:
        return {"ok": False, "error": "asset_id_required"}
    try:
        if path.is_file():
            ov = json.loads(path.read_text(encoding="utf-8"))
        else:
            ov = {}
    except (OSError, json.JSONDecodeError):
        ov = {}
    if not isinstance(ov, dict):
        ov = {}
    ov.setdefault("version", 1)
    ov.setdefault("assets", {})
    ov.setdefault("folder_groups", {})
    pids = [str(x).strip() for x in (product_ids or []) if str(x).strip()]
    vids = [str(x).strip() for x in (variant_ids or []) if str(x).strip()]
    entry = {
        "linked_product_ids": pids,
        "linked_variant_ids": vids,
        "folder_group_id": str(folder_group_id or "").strip().lower(),
        "updated_by": updated_by,
        "updated_at": utc_now(),
    }
    ov["assets"][aid] = entry
    group = entry["folder_group_id"]
    if group:
        ov["folder_groups"][group] = {
            "linked_product_ids": pids,
            "linked_variant_ids": vids,
            "updated_by": updated_by,
            "updated_at": utc_now(),
        }
    ov["updated_at"] = utc_now()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(ov, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)
    return {"ok": True, "asset_id": aid, "linked_product_ids": pids, "path": str(path)}


def upsert_confirmed_links(
    asset_id: str,
    product_ids: list[str],
    *,
    db_path: Path | None = None,
    source: str = "manual",
    reason: str = "editor_confirm",
    updated_by: str = "user",
    reject_other_pending: bool = True,
    mirror: bool = True,
    overrides_path: Path | None = None,
    variant_ids: list[str] | None = None,
    folder_group_id: str = "",
    schedule_publish: bool = True,
) -> dict[str, Any]:
    """Single write path for quiz confirm + manual editor."""
    aid = str(asset_id or "").strip()
    pids = [str(x).strip() for x in (product_ids or []) if str(x).strip()]
    if not aid:
        return {"ok": False, "error": "asset_id_required"}
    now = utc_now()
    conn = connect(db_path)
    try:
        cur = conn.cursor()
        if reject_other_pending:
            if pids:
                cur.execute(
                    "UPDATE asset_product_links SET status='rejected', updated_at=?, updated_by=? "
                    "WHERE asset_id=? AND status='pending' AND product_id NOT IN ({})".format(
                        ",".join("?" for _ in pids)
                    ),
                    (now, updated_by, aid, *pids),
                )
            else:
                cur.execute(
                    "UPDATE asset_product_links SET status='rejected', updated_at=?, updated_by=? "
                    "WHERE asset_id=? AND status='pending'",
                    (now, updated_by, aid),
                )
        for pid in pids:
            cur.execute(
                "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                "VALUES(?,?,?,?,?,?,?,?) "
                "ON CONFLICT(asset_id, product_id) DO UPDATE SET "
                "status='confirmed', source=excluded.source, score=100, reason=excluded.reason, "
                "updated_at=excluded.updated_at, updated_by=excluded.updated_by",
                (aid, pid, 100.0, source, "confirmed", reason, now, updated_by),
            )
        conn.commit()
    finally:
        conn.close()

    mirror_result = None
    if mirror:
        mirror_result = mirror_override(
            aid,
            pids,
            overrides_path=overrides_path,
            variant_ids=variant_ids,
            folder_group_id=folder_group_id,
            updated_by=updated_by,
        )
    if schedule_publish:
        schedule_slim_publish()
    return {
        "ok": True,
        "asset_id": aid,
        "linked_product_ids": pids,
        "mirror": mirror_result,
    }


def decide_quiz(
    asset_id: str,
    action: str,
    product_ids: list[str] | None = None,
    *,
    db_path: Path | None = None,
    updated_by: str = "quiz",
    schedule_publish: bool = True,
) -> dict[str, Any]:
    aid = str(asset_id or "").strip()
    act = str(action or "").strip().lower()
    if not aid or act not in ("confirm", "reject", "skip"):
        return {"ok": False, "error": "bad_request"}
    now = utc_now()
    if act == "confirm":
        return upsert_confirmed_links(
            aid,
            list(product_ids or []),
            db_path=db_path,
            source="quiz",
            reason="quiz_confirm",
            updated_by=updated_by,
            reject_other_pending=True,
            mirror=True,
            schedule_publish=schedule_publish,
        )
    conn = connect(db_path)
    try:
        status = "skipped" if act == "skip" else "rejected"
        conn.execute(
            "UPDATE asset_product_links SET status=?, updated_at=?, updated_by=? "
            "WHERE asset_id=? AND status='pending'",
            (status, now, updated_by, aid),
        )
        conn.commit()
    finally:
        conn.close()
    if schedule_publish:
        schedule_slim_publish()
    return {"ok": True, "asset_id": aid, "action": act}


def set_slim_publish_callback(cb: Callable[[], None] | None) -> None:
    global _publish_cb
    _publish_cb = cb


def schedule_slim_publish(delay_sec: float = 2.0) -> None:
    """Debounced slim grid publish (no fat rebuild)."""
    global _publish_timer
    try:
        import assoc_sync

        assoc_sync.kick()  # kazdy lokalny zapis leci tez do bazy glownej
    except Exception:
        pass
    with _publish_lock:
        if _publish_timer is not None:
            try:
                _publish_timer.cancel()
            except Exception:
                pass

        def _run() -> None:
            cb = _publish_cb
            if cb:
                try:
                    cb()
                except Exception as exc:  # noqa: BLE001
                    print("assoc slim publish:", exc)

        _publish_timer = threading.Timer(max(0.2, float(delay_sec)), _run)
        _publish_timer.daemon = True
        _publish_timer.start()
