#!/usr/bin/env python3
"""Build branding-grid-index.json (slim) from branding-index.json via ijson stream."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

try:
    import ijson  # type: ignore
except ImportError:
    print("ERROR: pip install ijson (build machine)", file=sys.stderr)
    raise SystemExit(2)

# folder_group_id / mtime: omit from slim (JS derives group from path; mtime via /branding/asset)
SLIM_KEYS = (
    "id",
    "path",
    "name",
    "tags",
    "asset_role",
    "media_type",
    "linked_product_ids",
    "is_archive",
    "sku",
)

HEAD_ROLES = frozenset({"packshot", "www", "social", "campaign", "brandbook"})
HEAD_LIMIT = 800
# Instant head: tylko gotowe grafiki (nie PDF/DOC z pustym asset_role).
HEAD_MEDIA = frozenset({"image", "raster", "vector"})


def _slim_linked(products):
    out = []
    if not isinstance(products, list):
        return out
    for p in products:
        if not isinstance(p, dict):
            continue
        pid = p.get("id") or p.get("product_id")
        if not pid:
            continue
        out.append(
            {
                "id": pid,
                "name": p.get("name") or p.get("title") or "",
                "sku": p.get("sku") or "",
            }
        )
    return out


def slim_asset(a: dict) -> dict:
    row = {k: a.get(k) for k in SLIM_KEYS if k in a and a.get(k) is not None}
    # Prefer ids only on grid; full linked_products loaded via /branding/asset
    ids = row.get("linked_product_ids")
    if not ids and isinstance(a.get("linked_products"), list):
        ids = []
        for p in a["linked_products"]:
            if isinstance(p, dict) and (p.get("id") or p.get("product_id")):
                ids.append(p.get("id") or p.get("product_id"))
            elif isinstance(p, str):
                ids.append(p)
        if ids:
            row["linked_product_ids"] = ids
    # Cap tags to keep JSON small
    tags = row.get("tags")
    if isinstance(tags, list) and len(tags) > 24:
        row["tags"] = tags[:24]
    return row


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--src",
        type=Path,
        default=None,
        help="Full branding-index.json",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output branding-grid-index.json",
    )
    ap.add_argument(
        "--from-sqlite",
        type=Path,
        default=None,
        help="Optional dam-local.sqlite to refresh linked_product_ids from asset_product_links",
    )
    args = ap.parse_args()

    here = Path(__file__).resolve()
    web_root = here.parents[1]  # .../apps/web
    src = args.src or (web_root / "data" / "branding-index.json")
    out = args.out or (web_root / "data" / "branding-grid-index.json")

    if not src.is_file():
        print(f"ERROR: missing {src}", file=sys.stderr)
        return 1

    t0 = time.time()
    assets: list[dict] = []
    meta: dict = {"version": 1, "source": "branding-index.json"}
    with src.open("rb") as f:
        parser = ijson.parse(f)
        # Collect top-level scalars then assets via items restart — simpler: items only
    with src.open("rb") as f:
        for a in ijson.items(f, "assets.item"):
            if isinstance(a, dict):
                assets.append(slim_asset(a))

    if args.from_sqlite and args.from_sqlite.is_file():
        try:
            import sqlite3

            conn = sqlite3.connect(str(args.from_sqlite))
            cur = conn.cursor()
            cur.execute(
                "SELECT asset_id, product_id FROM asset_product_links "
                "WHERE status IN ('auto','confirmed') ORDER BY asset_id, product_id"
            )
            by_asset: dict[str, list[str]] = {}
            for aid, pid in cur.fetchall():
                by_asset.setdefault(str(aid), []).append(str(pid))
            conn.close()
            for row in assets:
                aid = str(row.get("id") or "")
                if aid in by_asset:
                    row["linked_product_ids"] = by_asset[aid]
            meta["links_from_sqlite"] = True
        except Exception as exc:  # noqa: BLE001
            print(f"WARN sqlite: {exc}", file=sys.stderr)

    generated = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    payload = {
        "version": meta.get("version", 1),
        "generated_at": generated,
        "count": len(assets),
        "slim": True,
        "partial": False,
        "assets": assets,
    }
    # Instant head: priority roles + graphic media only (never empty-role PDF dump).
    def _is_head_graphic(row: dict) -> bool:
        mt = str(row.get("media_type") or "").lower()
        if mt in HEAD_MEDIA:
            return True
        name = str(row.get("name") or row.get("path") or "")
        return bool(
            name.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"))
        )

    head_assets: list[dict] = []
    seen: set[str] = set()
    for row in assets:
        role = str(row.get("asset_role") or "").lower()
        if role not in HEAD_ROLES:
            continue
        if not _is_head_graphic(row):
            continue
        aid = str(row.get("id") or "")
        if aid and aid not in seen:
            seen.add(aid)
            head_assets.append(row)
            if len(head_assets) >= HEAD_LIMIT:
                break
    if len(head_assets) < HEAD_LIMIT:
        for row in assets:
            if not _is_head_graphic(row):
                continue
            aid = str(row.get("id") or "")
            if not aid or aid in seen:
                continue
            seen.add(aid)
            head_assets.append(row)
            if len(head_assets) >= HEAD_LIMIT:
                break
    head_payload = {
        "version": payload["version"],
        "generated_at": generated,
        "count": len(assets),
        "head_count": len(head_assets),
        "slim": True,
        "partial": True,
        "assets": head_assets,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    bak = out.with_suffix(out.suffix + f".bak-{int(time.time())}")
    if out.is_file():
        out.replace(bak)
    tmp = out.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    tmp.replace(out)
    head_out = out.parent / "branding-grid-head.json"
    with head_out.open("w", encoding="utf-8") as f:
        json.dump(head_payload, f, ensure_ascii=False, separators=(",", ":"))
    elapsed = time.time() - t0
    size_mb = out.stat().st_size / (1024 * 1024)
    head_mb = head_out.stat().st_size / (1024 * 1024)
    print(
        json.dumps(
            {
                "ok": True,
                "out": str(out),
                "head": str(head_out),
                "count": len(assets),
                "head_count": len(head_assets),
                "size_mb": round(size_mb, 2),
                "head_mb": round(head_mb, 3),
                "elapsed_s": round(elapsed, 1),
                "links_from_sqlite": bool(meta.get("links_from_sqlite")),
            },
            ensure_ascii=False,
        )
    )
    if size_mb >= 40:
        print("WARN: size_mb >= 40", file=sys.stderr)
        return 3
    if size_mb >= 25:
        print("NOTE: size_mb >= 25 (soft); Instant uses head first", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
