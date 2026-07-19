# -*- coding: utf-8 -*-
"""Uzupelnia background/format_technical — cloud-safe (5 s / plik, bez pelnego pobierania)."""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent
INDEX = WEB / "data" / "branding-index.json"
SEARCH_OUT = WEB / "data" / "branding-search-index.json"

sys.path.insert(0, str(SCRIPTS))
from asset_role_utils import enrich_branding_taxonomy, enrich_raster_backgrounds  # noqa: E402


def _load_build_module():
    path = SCRIPTS / "build-branding-index.py"
    spec = importlib.util.spec_from_file_location("build_branding_index", path)
    if not spec or not spec.loader:
        raise RuntimeError("build-branding-index.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope", choices=["all", "www"], default="www")
    args = parser.parse_args()
    if not INDEX.is_file():
        print("branding-index.json missing")
        return 1
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    assets = idx.get("assets") or []

    def progress(scanned: int, touched: int, skipped: int = 0) -> None:
        print(f"scan {scanned} touched={touched} skipped={skipped}", flush=True)

    scope = None if args.scope == "all" else args.scope
    touched_ids: set[str] = set()
    before_bg = {a["id"]: a.get("background") for a in assets if a.get("id")}

    bg_touched = enrich_raster_backgrounds(assets, scope=scope, on_progress=progress)
    for a in assets:
        aid = a.get("id")
        if not aid:
            continue
        if before_bg.get(aid) != a.get("background"):
            touched_ids.add(aid)
            enrich_branding_taxonomy(a)

    idx["background_detected_at"] = datetime.now(timezone.utc).isoformat()
    idx["background_detected_count"] = sum(1 for a in assets if a.get("background") == "transparent")
    idx["background_detect_scope"] = args.scope
    INDEX.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"index saved touched_ids={len(touched_ids)}", flush=True)

    bbi = _load_build_module()
    search_idx = bbi.build_search_index(assets)
    SEARCH_OUT.write_text(json.dumps(search_idx, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"patch-branding-backgrounds scope={args.scope} bg_touched={bg_touched} "
        f"taxonomy_touched={len(touched_ids)} transparent_total={idx['background_detected_count']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
