#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Incremental enrich: product Links/ELEMENTY + skojarzenia skladniki/owoce/owocki.

Nie wipe'uje indeksu - doklada brakujace product_element i taguje search_blob.
Uruchomienie:
  python apps/web/scripts/enrich-branding-element-assoc.py
"""
from __future__ import annotations

import importlib.util
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from asset_ids import stable_asset_id  # noqa: E402

WEB = SCRIPTS.parent
DATA = WEB / "data"
INDEX_PATH = DATA / "branding-index.json"
SEARCH_PATH = DATA / "branding-search-index.json"
FILE_INDEX_PATH = DATA / "file-index.json"
CATALOG_PATH = DATA / "product-catalog.json"


def _load_build_branding_index():
    path = SCRIPTS / "build-branding-index.py"
    spec = importlib.util.spec_from_file_location("build_branding_index_mod", path)
    if not spec or not spec.loader:
        raise RuntimeError(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _taken_ids(assets: list[dict]) -> dict[str, str]:
    """id -> klucz sciezki, do stable_asset_id (rozwiazuje kolizje w obrebie indeksu)."""
    from asset_ids import asset_key

    taken: dict[str, str] = {}
    for a in assets:
        aid = a.get("id")
        path = a.get("path")
        if aid and path:
            taken.setdefault(str(aid), asset_key(path))
    return taken


def _link_new_elements(new_assets: list[dict], file_index: dict, catalog: dict) -> None:
    """Link product_element po SKU ze sciezki rewizji.

    NIE uzywamy match_products_by_associations na nazwie pliku (cytryna→babka
    na kazdym produkcie). Fallback: display name z folderu produktu w sciezce.
    """
    from brand_folder_context import (
        build_linked_product_meta,
        match_products_by_display_names,
    )

    sku_map: dict[str, list[str]] = {}
    for p in file_index.get("products") or []:
        pid = p.get("id")
        if not pid:
            continue
        for idx in p.get("indexes") or []:
            key = str(idx)
            sku_map.setdefault(key, []).append(pid)
            sku_map.setdefault(key.split(".")[0], []).append(pid)
    cat_map: dict[str, str] = {}
    for pid, entry in (catalog.get("products") or {}).items():
        idx = entry.get("index_primary")
        if not idx:
            continue
        cat_map[str(idx)] = pid
        cat_map[str(idx).split(".")[0]] = pid

    for a in new_assets:
        linked: list[str] = []
        sku = a.get("sku")
        if sku:
            for key in (sku, str(sku).split(".")[0]):
                for pid in sku_map.get(key, []):
                    if pid not in linked:
                        linked.append(pid)
                cat_pid = cat_map.get(key)
                if cat_pid and cat_pid not in linked:
                    linked.append(cat_pid)
        if not linked:
            # Sam folder produktu w sciezce (bez nazwy pliku) - unikamy false-positive
            path = (a.get("path") or "").replace("\\", "/")
            folder_blob = "/".join(path.split("/")[:-1])
            for pid in match_products_by_display_names(folder_blob, file_index):
                if pid not in linked:
                    linked.append(pid)
        a["linked_product_ids"] = linked[:4]
        a["linked_variant_ids"] = [sku] if sku else []
        if linked:
            a["linked_product_id"] = linked[0]
            a["linked_products"] = build_linked_product_meta(linked[:4], file_index)
        else:
            a["linked_product_id"] = None
            a["linked_products"] = []


def main() -> int:
    t0 = time.time()
    if not INDEX_PATH.is_file():
        print(f"FAIL: missing {INDEX_PATH}")
        return 1

    print("Loading branding-index…", flush=True)
    data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    assets: list[dict] = data.get("assets") or []
    before = len(assets)
    seen = {(a.get("path") or "").lower() for a in assets if a.get("path")}

    from brand_element_assoc import enrich_element_associations

    bbi = _load_build_branding_index()
    marketing = bbi.resolve_marketing_base()
    print(f"Scanning product Links/ELEMENTY under {marketing}…", flush=True)
    scanned = bbi.scan_product_element_assets(marketing, include_archive=False)
    print(f"disk product_element files: {len(scanned)}", flush=True)

    id_taken = _taken_ids(assets)
    new_assets: list[dict] = []
    for row in scanned:
        key = (row.get("path") or "").lower()
        if not key or key in seen:
            continue
        row = dict(row)
        row["id"] = stable_asset_id(row.get("path") or "", id_taken)
        new_assets.append(row)
        seen.add(key)

    print(f"new product_element to merge: {len(new_assets)}", flush=True)

    file_index = json.loads(FILE_INDEX_PATH.read_text(encoding="utf-8")) if FILE_INDEX_PATH.is_file() else {}
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8")) if CATALOG_PATH.is_file() else {}
    if new_assets:
        _link_new_elements(new_assets, file_index, catalog)
        assets.extend(new_assets)

    print("Tagging skladniki/owoce/owocki on search_blob…", flush=True)
    el_stats = enrich_element_associations(assets)

    data["assets"] = assets
    data["asset_count"] = len(assets)
    data["product_element_enriched_at"] = datetime.now(timezone.utc).isoformat()
    data["product_element_count"] = sum(
        1 for a in assets if a.get("source") == "product_element" or a.get("asset_role") == "product_element"
    )
    data["element_assoc_stats"] = el_stats

    print(f"Writing {INDEX_PATH} ({before} -> {len(assets)})…", flush=True)
    INDEX_PATH.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print("Rebuilding branding-search-index…", flush=True)
    search_idx = bbi.build_search_index(assets)
    SEARCH_PATH.write_text(
        json.dumps(search_idx, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # Sample proof: babka
    babka = "babka-cytrynowa-nerkowcowy"
    babka_els = [
        a
        for a in assets
        if a.get("source") == "product_element"
        and any((lp or {}).get("id") == babka for lp in (a.get("linked_products") or []))
    ]
    # also linked_product_ids
    if not babka_els:
        babka_els = [
            a
            for a in assets
            if a.get("source") == "product_element"
            and babka in (a.get("linked_product_ids") or [])
        ]
    print(
        "DONE"
        f" elapsed={time.time() - t0:.1f}s"
        f" added={len(new_assets)}"
        f" tagged={el_stats['tagged']}"
        f" owoce_blob={el_stats['with_owoce']}"
        f" skladniki_blob={el_stats['with_skladniki']}"
        f" babka_product_elements={len(babka_els)}",
        flush=True,
    )
    for a in babka_els[:8]:
        print(f"  sample {a.get('id')} {a.get('name')} | {(a.get('path') or '')[-80:]}", flush=True)
    return 0


if __name__ == "__main__":
    # unikaj martwego importu helpera - linkowanie inline
    raise SystemExit(main())
