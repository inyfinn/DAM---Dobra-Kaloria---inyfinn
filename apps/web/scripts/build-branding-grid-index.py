#!/usr/bin/env python3
"""Build branding-grid-index.json (slim) from branding-index.json via ijson stream."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

try:
    import ijson  # type: ignore
except ImportError:
    print("ERROR: pip install ijson (build machine)", file=sys.stderr)
    raise SystemExit(2)

from branding_grid_eligibility import is_branding_grid_eligible

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
    "source",
)

# Controlled taxonomy (dam-asset-role-mapping.json) + legacy aliases www/social/campaign/brandbook.
# Explicitly excluded from head: empty role, product_element, product_photo, document/source roles.
HEAD_ROLES = frozenset(
    {
        # brand / brandbook
        "brand_asset",
        "icon",
        "brandbook",
        # www
        "web_banner",
        "web_bundle_tile",
        "web_hero_slider",
        "web_product_tile",
        "ecommerce_ad",
        "www",
        # social
        "social_asset",
        "social_video",
        "social",
        # campaign / POS / outdoor / private-label KV
        "key_visual",
        "pos_material",
        "outdoor_material",
        "private_label_artwork",
        "campaign",
    }
)
HEAD_ROLE_PRIORITY = {
    "web_hero_slider": 0,
    "key_visual": 1,
    "campaign": 1,
    "web_banner": 2,
    "www": 2,
    "web_bundle_tile": 3,
    "ecommerce_ad": 4,
    "social_asset": 5,
    "social": 5,
    "social_video": 6,
    "pos_material": 7,
    "outdoor_material": 8,
    "web_product_tile": 9,
    "private_label_artwork": 10,
    "brand_asset": 11,
    "brandbook": 11,
    "icon": 12,
}
HEAD_LIMIT = 800
HEAD_MEDIA = frozenset({"image", "raster", "vector", "video"})


def slim_asset(a: dict) -> dict:
    row = {k: a.get(k) for k in SLIM_KEYS if k in a and a.get(k) is not None}
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
    tags = row.get("tags")
    if isinstance(tags, list) and len(tags) > 24:
        row["tags"] = tags[:24]
    return row


def _is_head_graphic(row: dict) -> bool:
    mt = str(row.get("media_type") or "").lower()
    role = str(row.get("asset_role") or "").lower()
    if mt in HEAD_MEDIA:
        return True
    if role == "social_video" and mt == "video":
        return True
    name = str(row.get("name") or row.get("path") or "")
    return bool(
        name.lower().endswith(
            (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".mp4", ".mov", ".webm")
        )
    )


def _sqlite_link_revision(db_path: Path) -> str:
    if not db_path.is_file():
        return "0"
    try:
        import sqlite3

        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*), COALESCE(MAX(rowid), 0) FROM asset_product_links "
            "WHERE status IN ('auto','confirmed')"
        )
        row = cur.fetchone()
        conn.close()
        if not row:
            return "0"
        return f"{int(row[0] or 0)}:{int(row[1] or 0)}"
    except Exception:
        return "0"


def compute_generation_id(src: Path, sqlite_path: Path | None) -> str:
    st = src.stat()
    link_rev = _sqlite_link_revision(sqlite_path) if sqlite_path else "0"
    raw = f"{int(st.st_mtime)}:{int(st.st_size)}:{link_rev}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _atomic_write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


def _build_head_assets(full_assets: list[dict]) -> list[dict]:
    candidates: list[dict] = []
    seen: set[str] = set()
    for row in full_assets:
        role = str(row.get("asset_role") or "").lower()
        if not role or role not in HEAD_ROLES:
            continue
        if not _is_head_graphic(row):
            continue
        aid = str(row.get("id") or "")
        if not aid or aid in seen:
            continue
        seen.add(aid)
        candidates.append(row)
    candidates.sort(
        key=lambda r: (
            HEAD_ROLE_PRIORITY.get(str(r.get("asset_role") or "").lower(), 99),
            str(r.get("id") or ""),
        )
    )
    return candidates[:HEAD_LIMIT]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=None, help="Full branding-index.json")
    ap.add_argument("--out", type=Path, default=None, help="Output branding-grid-index.json")
    ap.add_argument(
        "--from-sqlite",
        type=Path,
        default=None,
        help="Optional dam-local.sqlite for asset_product_links",
    )
    args = ap.parse_args()

    here = Path(__file__).resolve()
    web_root = here.parents[1]
    src = args.src or (web_root / "data" / "branding-index.json")
    out = args.out or (web_root / "data" / "branding-grid-index.json")
    head_out = out.parent / "branding-grid-head.json"

    if not src.is_file():
        print(f"ERROR: missing {src}", file=sys.stderr)
        return 1

    t0 = time.time()
    assets: list[dict] = []
    with src.open("rb") as f:
        for a in ijson.items(f, "assets.item"):
            if not isinstance(a, dict):
                continue
            if not is_branding_grid_eligible(a):
                continue
            assets.append(slim_asset(a))

    links_from_sqlite = False
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
            links_from_sqlite = True
        except Exception as exc:  # noqa: BLE001
            print(f"WARN sqlite: {exc}", file=sys.stderr)

    generation_id = compute_generation_id(src, args.from_sqlite)
    generated = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    payload = {
        "version": 1,
        "generated_at": generated,
        "generation_id": generation_id,
        "count": len(assets),
        "slim": True,
        "partial": False,
        "links_from_sqlite": links_from_sqlite,
        "assets": assets,
    }
    head_assets = _build_head_assets(assets)
    head_payload = {
        "version": 1,
        "generated_at": generated,
        "generation_id": generation_id,
        "count": len(assets),
        "head_count": len(head_assets),
        "slim": True,
        "partial": True,
        "links_from_sqlite": links_from_sqlite,
        "assets": head_assets,
    }

    bak = out.with_suffix(out.suffix + f".bak-{int(time.time())}")
    if out.is_file():
        out.replace(bak)
    _atomic_write_json(out, payload)
    _atomic_write_json(head_out, head_payload)

    elapsed = time.time() - t0
    size_mb = out.stat().st_size / (1024 * 1024)
    head_mb = head_out.stat().st_size / (1024 * 1024)
    print(
        json.dumps(
            {
                "ok": True,
                "out": str(out),
                "head": str(head_out),
                "generation_id": generation_id,
                "count": len(assets),
                "head_count": len(head_assets),
                "size_mb": round(size_mb, 2),
                "head_mb": round(head_mb, 3),
                "elapsed_s": round(elapsed, 1),
                "links_from_sqlite": links_from_sqlite,
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
