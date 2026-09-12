"""Branding asset + assoc HTTP helpers for local_bridge (portable module)."""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs

# Injected by local_bridge on register
_CTX: dict[str, Any] = {}

# Quiz UX: prefer browser-previewable rasters/vectors before TIF/PSD/source.
_PREVIEW_EXTS = frozenset({".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"})
_QUEUE_ITEM_LIMIT = 200
# Distinct asset candidates (asset_id + max_score only). ~10k rows is cheap;
# previewability is decided via in-memory fat dict, not per-row disk I/O.
_QUEUE_CANDIDATE_LIMIT = 12000


def configure(**kwargs: Any) -> None:
    _CTX.update(kwargs)


def _web_root() -> Path:
    return Path(_CTX["web_root"])


def _branding_index_file() -> Path:
    return Path(_CTX["branding_index_file"])


def _grid_index_file() -> Path:
    return _web_root() / "data" / "branding-grid-index.json"


def _ensure_grid_index() -> Path:
    """First-run: index z head, jesli Setup wgral tylko head. Zero krokow uzytkownika."""
    index = _grid_index_file()
    try:
        if index.is_file() and index.stat().st_size >= 1000:
            return index
        head = _web_root() / "data" / "branding-grid-head.json"
        if head.is_file() and head.stat().st_size >= 1000:
            index.parent.mkdir(parents=True, exist_ok=True)
            index.write_bytes(head.read_bytes())
    except OSError:
        pass
    return index


def _load_json(path: Path, default: Any) -> Any:
    fn = _CTX.get("load_json")
    if callable(fn):
        return fn(path, default)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _sqlite_path() -> Path | None:
    p = _CTX.get("sqlite_path")
    return Path(p) if p else None


def _assets_by_id() -> dict[str, dict]:
    cache = _CTX.setdefault("_by_id_cache", {"mtime": -1.0, "map": {}})
    path = _branding_index_file()
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return {}
    if cache["mtime"] == mtime and cache["map"]:
        return cache["map"]
    data = _load_json(path, None)
    m: dict[str, dict] = {}
    if isinstance(data, dict):
        for a in data.get("assets") or []:
            if isinstance(a, dict) and a.get("id"):
                m[str(a["id"])] = a
    cache["mtime"] = mtime
    cache["map"] = m
    return m


def is_previewable_asset(asset: dict | None) -> bool:
    """True for png/jpg/jpeg/webp/gif/svg (name/path). TIF/PSD/source stay in queue later."""
    if not isinstance(asset, dict):
        return False
    name = str(asset.get("name") or "")
    path = str(asset.get("path") or "")
    ext = Path(name or path).suffix.lower()
    if ext in _PREVIEW_EXTS:
        return True
    # media_type alone is insufficient (TIF often media_type=image).
    return False


def build_assoc_queue_items(
    link_rows: list[dict],
    assets_by_id: dict[str, dict],
    *,
    item_limit: int = _QUEUE_ITEM_LIMIT,
    candidate_limit: int = _QUEUE_CANDIDATE_LIMIT,
) -> list[dict]:
    """Group pending/auto links into DISTINCT assets; previewable first, then by score.

    ``link_rows`` must already contain *all* suggestions for candidate assets
    (do not pre-LIMIT to 200 link rows — that truncates suggestions).
    Ranking uses max score per asset among the provided rows.
    """
    by_asset: dict[str, list[dict]] = {}
    max_score: dict[str, float] = {}
    for row in link_rows:
        aid = str(row.get("asset_id") or "")
        if not aid:
            continue
        by_asset.setdefault(aid, []).append(row)
        try:
            sc = float(row.get("score") if row.get("score") is not None else 0.0)
        except (TypeError, ValueError):
            sc = 0.0
        if sc >= max_score.get(aid, float("-inf")):
            max_score[aid] = sc

    # Bound candidate universe by score before preview split (deterministic).
    ranked_all = sorted(
        by_asset.keys(),
        key=lambda aid: (-max_score.get(aid, 0.0), aid),
    )[: max(1, int(candidate_limit))]

    previewable: list[str] = []
    deferred: list[str] = []
    for aid in ranked_all:
        if is_previewable_asset(assets_by_id.get(aid)):
            previewable.append(aid)
        else:
            deferred.append(aid)

    ordered_ids = (previewable + deferred)[: max(0, int(item_limit))]
    items: list[dict] = []
    for aid in ordered_ids:
        links = sorted(
            by_asset.get(aid) or [],
            key=lambda r: (
                -float(r.get("score") if r.get("score") is not None else 0.0),
                str(r.get("product_id") or ""),
            ),
        )
        a = assets_by_id.get(aid) or {"id": aid}
        item: dict[str, Any] = {
            "asset_id": aid,
            "name": a.get("name") or aid,
            "path": a.get("path") or "",
            "suggestions": links,
        }
        if a.get("media_type") is not None and str(a.get("media_type") or "") != "":
            item["media_type"] = a.get("media_type")
        if a.get("thumb_url") is not None and str(a.get("thumb_url") or "") != "":
            item["thumb_url"] = a.get("thumb_url")
        items.append(item)
    return items


def fetch_assoc_queue_link_rows(
    conn: sqlite3.Connection,
    *,
    candidate_limit: int = _QUEUE_CANDIDATE_LIMIT,
) -> list[dict]:
    """Load all pending/auto suggestions for top distinct assets by max score."""
    cur = conn.cursor()
    cur.execute(
        "SELECT asset_id, MAX(COALESCE(score, 0)) AS max_score "
        "FROM asset_product_links "
        "WHERE status IN ('pending', 'auto') "
        "GROUP BY asset_id "
        "ORDER BY max_score DESC, asset_id ASC "
        "LIMIT ?",
        (int(candidate_limit),),
    )
    asset_ids = [str(r[0]) for r in cur.fetchall() if r and r[0]]
    if not asset_ids:
        return []
    placeholders = ",".join("?" for _ in asset_ids)
    cur.execute(
        "SELECT asset_id, product_id, score, source, status, reason, updated_at "
        f"FROM asset_product_links WHERE status IN ('pending', 'auto') "
        f"AND asset_id IN ({placeholders}) "
        "ORDER BY COALESCE(score, 0) DESC, asset_id ASC, product_id ASC",
        asset_ids,
    )
    return [dict(r) for r in cur.fetchall()]


def handle_get(handler: Any, parsed: Any) -> bool:
    """Return True if request handled."""
    path = parsed.path
    qs = parse_qs(parsed.query or "")

    if path == "/branding-grid-index":
        data = _load_json(_ensure_grid_index(), None)
        if not isinstance(data, dict):
            handler._json(404, {"ok": False, "error": "branding_grid_index_missing"})
            return True
        handler._json(200, {"ok": True, **data})
        return True

    if path == "/branding-grid-head":
        head = _web_root() / "data" / "branding-grid-head.json"
        data = _load_json(head, None)
        if not isinstance(data, dict):
            handler._json(404, {"ok": False, "error": "branding_grid_head_missing"})
            return True
        handler._json(200, {"ok": True, **data})
        return True

    if path == "/branding/asset":
        ids = []
        if qs.get("id"):
            ids = [qs["id"][0]]
        elif qs.get("ids"):
            raw = qs["ids"][0]
            ids = [x.strip() for x in raw.split(",") if x.strip()]
        if not ids:
            handler._json(400, {"ok": False, "error": "id_required"})
            return True
        by_id = _assets_by_id()
        if len(ids) == 1:
            a = by_id.get(ids[0])
            if not a:
                handler._json(404, {"ok": False, "error": "not_found", "id": ids[0]})
                return True
            handler._json(200, {"ok": True, "asset": a})
            return True
        assets = [by_id[i] for i in ids if i in by_id]
        handler._json(200, {"ok": True, "assets": assets, "missing": [i for i in ids if i not in by_id]})
        return True

    if path == "/assoc/queue":
        if _CTX.get("require_admin") and not _CTX["require_admin"](handler):
            return True
        db = _sqlite_path()
        counts: dict[str, Any] = {}
        schema_error = ""
        try:
            import assoc_repo

            st = assoc_repo.status_counts(db)
            counts = st.get("counts") or {}
            schema_error = st.get("schema_error") or ""
            if not st.get("ok") and schema_error:
                handler._json(
                    200,
                    {
                        "ok": False,
                        "items": [],
                        "counts": counts,
                        "schema_error": schema_error,
                        "error": schema_error,
                    },
                )
                return True
        except Exception as exc:  # noqa: BLE001
            schema_error = str(exc)
        if not db or not db.is_file():
            handler._json(
                200,
                {
                    "ok": False,
                    "items": [],
                    "counts": counts,
                    "schema_error": schema_error or "sqlite_missing",
                    "error": "sqlite_missing",
                },
            )
            return True
        try:
            conn = sqlite3.connect(str(db))
            conn.row_factory = sqlite3.Row
            # Quiz: pending + auto. Distinct assets (max 200), previewable first;
            # all suggestions per asset (not LIMIT 200 link-rows before group).
            rows = fetch_assoc_queue_link_rows(conn)
            conn.close()
            by_id = _assets_by_id()
            items = build_assoc_queue_items(rows, by_id)
            handler._json(
                200,
                {
                    "ok": True,
                    "items": items,
                    "counts": counts,
                    "schema_error": schema_error,
                    "pending_count": int(counts.get("pending") or 0)
                    + int(counts.get("auto") or 0),
                    "queue_statuses": ["pending", "auto"],
                    "source": "sqlite",
                    "grid_fallback": False,
                },
            )
        except sqlite3.OperationalError as exc:
            handler._json(
                200,
                {
                    "ok": False,
                    "items": [],
                    "counts": counts,
                    "schema_error": str(exc),
                    "error": str(exc),
                },
            )
        return True

    return False


def handle_post(handler: Any, parsed: Any, body: dict) -> bool:
    if parsed.path != "/assoc/decide":
        return False
    if _CTX.get("require_admin") and not _CTX["require_admin"](handler):
        return True
    decide = _CTX.get("assoc_decide")
    if callable(decide):
        result = decide(handler, body if isinstance(body, dict) else {})
        code = 200 if result.get("ok") else 400
        if result.get("error") == "sqlite_missing":
            code = 500
        handler._json(code, result)
        return True
    # Fallback legacy path via assoc_repo
    try:
        import assoc_repo

        result = assoc_repo.decide_quiz(
            str((body or {}).get("asset_id") or ""),
            str((body or {}).get("action") or ""),
            list((body or {}).get("product_ids") or []),
            db_path=_sqlite_path(),
            updated_by=str((body or {}).get("user") or "quiz"),
            schedule_publish=True,
        )
        # Ensure mirror_override from CTX still runs on confirm if repo mirror used path
        if result.get("ok") and str((body or {}).get("action") or "") == "confirm":
            mirror = _CTX.get("mirror_override")
            if callable(mirror):
                try:
                    mirror(str(body.get("asset_id") or ""), [str(p) for p in (body.get("product_ids") or [])])
                except Exception:
                    pass
        code = 200 if result.get("ok") else 400
        handler._json(code, result)
        return True
    except Exception as exc:  # noqa: BLE001
        handler._json(500, {"ok": False, "error": str(exc)})
        return True
