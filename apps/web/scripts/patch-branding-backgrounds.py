# -*- coding: utf-8 -*-
"""Uzupelnia background/format_technical — cloud-safe (5 s / plik, bez pelnego pobierania).

Tryby:
  --scope www              (domyslnie) tylko assety WWW/E-COMMERCE/SLIDERY
  --all                    wszystkie rastery (PNG/WebP/GIF/TIFF + JPG/BMP -> white)
  --limit-seconds N        budzet czasu skanu (NFS X: bywa wolny); przerwanie bezpieczne
  --limit-count N          budzet liczby plikow czytanych z dysku w tym przebiegu

Wyniki skanu trafiaja trwale do data/branding-background-scan.json (cache) oraz do
branding-index.json (zapis atomowy). Rebuild indeksu odtwarza background z cache
(apply_background_scan_cache w build-branding-index.py).
"""
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
from asset_role_utils import (  # noqa: E402
    atomic_write_json,
    enrich_branding_taxonomy,
    enrich_raster_backgrounds,
    load_background_scan_cache,
    save_background_scan_cache,
)


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
    parser.add_argument("--all", dest="scan_all", action="store_true", help="alias --scope all")
    parser.add_argument("--limit-seconds", type=float, default=None)
    parser.add_argument("--limit-count", type=int, default=None)
    parser.add_argument("--no-cache", action="store_true", help="ignoruj/nadpisz cache skanu")
    args = parser.parse_args()
    if args.scan_all:
        args.scope = "all"
    if not INDEX.is_file():
        print("branding-index.json missing")
        return 1
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    assets = idx.get("assets") or []

    scan_cache = {} if args.no_cache else load_background_scan_cache()
    cache_before = len(scan_cache)

    def progress(scanned: int, touched: int, skipped: int = 0) -> None:
        print(f"scan {scanned} touched={touched} skipped={skipped}", flush=True)
        # checkpoint co ~500 plikow: przerwany/ubity skan nie traci wynikow
        if scanned and scanned % 500 == 0:
            save_background_scan_cache(scan_cache)

    scope = None if args.scope == "all" else args.scope
    touched_ids: set[str] = set()
    before_bg = {a["id"]: a.get("background") for a in assets if a.get("id")}

    bg_touched = enrich_raster_backgrounds(
        assets,
        scope=scope,
        on_progress=progress,
        limit_seconds=args.limit_seconds,
        limit_count=args.limit_count,
        scan_cache=scan_cache,
        include_opaque=args.scope == "all",
    )
    for a in assets:
        aid = a.get("id")
        if not aid:
            continue
        if before_bg.get(aid) != a.get("background"):
            touched_ids.add(aid)
            enrich_branding_taxonomy(a)

    save_background_scan_cache(scan_cache)
    print(f"scan cache: {cache_before} -> {len(scan_cache)} wpisow", flush=True)

    idx["background_detected_at"] = datetime.now(timezone.utc).isoformat()
    idx["background_detected_count"] = sum(1 for a in assets if a.get("background") == "transparent")
    idx["background_detect_scope"] = args.scope
    atomic_write_json(INDEX, idx)
    print(f"index saved touched_ids={len(touched_ids)}", flush=True)

    bbi = _load_build_module()
    search_idx = bbi.build_search_index(assets)
    atomic_write_json(SEARCH_OUT, search_idx)
    print(
        f"patch-branding-backgrounds scope={args.scope} bg_touched={bg_touched} "
        f"taxonomy_touched={len(touched_ids)} transparent_total={idx['background_detected_count']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
