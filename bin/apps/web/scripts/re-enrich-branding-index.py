#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ponownie wzbogaca branding-index.json: folder_variants, linked_products, mtime, linked_product_id."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from asset_role_utils import apply_background_scan_cache  # noqa: E402
from brand_folder_context import (  # noqa: E402
    apply_branding_assoc_overrides,
    apply_global_product_links,
    enrich_folder_groups,
    build_variant_to_product_map,
)

DATA = SCRIPTS.parent / "data"


def stamp_mtime(assets: list[dict]) -> tuple[int, int]:
    ok = 0
    miss = 0
    for a in assets:
        path = a.get("path") or ""
        if not path:
            miss += 1
            continue
        # Prefer lokalny X: / mapowanie — Path jak w bridge
        p = Path(path)
        if not p.is_file():
            # mtime już było — zostaw
            if a.get("mtime_ms"):
                ok += 1
            else:
                miss += 1
            continue
        try:
            st = p.stat()
            a["mtime_ms"] = int(st.st_mtime * 1000)
            a["mtime"] = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
            ok += 1
        except OSError:
            miss += 1
    return ok, miss


def main() -> int:
    file_index = json.loads((DATA / "file-index.json").read_text(encoding="utf-8"))
    index_path = DATA / "branding-index.json"
    data = json.loads(index_path.read_text(encoding="utf-8"))
    assets = data.get("assets") or []
    print(f"Enriching {len(assets)} assets…")
    build_variant_to_product_map(file_index)  # warm cache
    enrich_folder_groups(assets, file_index)
    apply_branding_assoc_overrides(assets, file_index)
    carried = apply_background_scan_cache(assets)
    if carried:
        print(f"background scan cache carry-over: {carried}")
    # apply_global already inside enrich; ensure orphans too
    for a in assets:
        apply_global_product_links(a, file_index)
    print("Stamping mtime from disk…")
    ok, miss = stamp_mtime(assets)
    print(f"mtime ok={ok} miss={miss}")
    with_family = sum(1 for a in assets if a.get("linked_product_id"))
    with_var = sum(1 for a in assets if a.get("linked_variant_ids"))
    print(f"linked_product_id={with_family} linked_variant_ids={with_var}")
    index_path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Saved {index_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
