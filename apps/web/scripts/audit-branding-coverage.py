# -*- coding: utf-8 -*-
"""Audyt pokrycia branding-index vs dysk X:\\Marketing (POLSKA + -- ARCHIWUM --)."""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MARKETING = Path("X:/Marketing")
POLSKA = MARKETING / "- POLSKA"
LEGACY = MARKETING / "-- ARCHIWUM --"
INDEX_PATH = DATA / "branding-index.json"

RASTER_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff", ".bmp"}
INDEXABLE_EXT = RASTER_EXT | {".psd", ".psb", ".ai", ".eps", ".svg", ".pdf", ".mp4", ".mov", ".webm"}

POLSKA_SCAN = [
    POLSKA / "- BRANDING i MARKA -",
    POLSKA / "02 - FIRMOWE MATERIAŁY",
    POLSKA / "03 - MATERIAŁY GRAFICZNE",
    POLSKA / "04 - PROCESY",
    POLSKA / "05 - SOCIAL MEDIA",
    POLSKA / "06 - STRONY WWW - INTERNET",
    POLSKA / "07 - E-COMMERCE",
    POLSKA / "08 - KAMAPANIE",
]


def norm_path(p: str) -> str:
    return p.replace("\\", "/").lower()


def load_index() -> dict:
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


def scan_disk(roots: list[Path]) -> dict[str, Path]:
    out: dict[str, Path] = {}
    for root in roots:
        if not root.is_dir():
            continue
        for fp in root.rglob("*"):
            if not fp.is_file():
                continue
            if fp.suffix.lower() not in INDEXABLE_EXT:
                continue
            out[norm_path(str(fp))] = fp
    return out


def main() -> int:
    if not INDEX_PATH.is_file():
        print("Brak branding-index.json", file=sys.stderr)
        return 1

    index = load_index()
    assets = index.get("assets") or []
    indexed = {norm_path(a.get("path") or ""): a for a in assets if a.get("path")}

    polska_disk = scan_disk(POLSKA_SCAN)
    legacy_disk = scan_disk([LEGACY]) if LEGACY.is_dir() else {}

    missing_polska = [p for p in polska_disk if p not in indexed]
    missing_legacy = [p for p in legacy_disk if p not in indexed]

    by_dir: dict[str, list[dict]] = defaultdict(list)
    for a in assets:
        path = (a.get("path") or "").replace("\\", "/")
        if not path:
            continue
        d = path.rsplit("/", 1)[0].lower()
        ext = Path(a.get("name") or "").suffix.lower()
        if ext in RASTER_EXT:
            by_dir[d].append(a)

    weak_variants: list[tuple[str, int, int]] = []
    weak_products: list[tuple[str, int]] = []
    for d, items in by_dir.items():
        if len(items) < 2:
            continue
        multi = sum(1 for x in items if len(x.get("folder_variants") or []) >= 2)
        if multi == 0:
            if any(
                k in d
                for k in (
                    "slidery",
                    "back to school",
                    "postanowienia",
                    "kampan",
                    "baner",
                    "05 - social",
                    "07 - e-commerce",
                    "09 przepisy",
                )
            ):
                weak_variants.append((d, len(items), multi))
        if not any(x.get("linked_products") for x in items):
            if any(k in d for k in ("back to school", "postanowienia", "kielbask", "deserek", "rolada")):
                weak_products.append((d, len(items)))

    legacy_tagged = sum(
        1
        for a in assets
        if "Stara struktura" in (a.get("appearance_tags") or []) or "Stara struktura" in (a.get("tags") or [])
    )

    print("=== AUDYT BRANDING INDEX ===")
    print(f"Indeks: {len(assets)} assetow")
    print(f"POLSKA na dysku (skan): {len(polska_disk)} | brak w indeksie: {len(missing_polska)}")
    print(f"Legacy na dysku: {len(legacy_disk)} | brak w indeksie: {len(missing_legacy)}")
    print(f"Legacy z tagiem Stara struktura: {legacy_tagged}")
    print(f"Z 2+ wariantami: {sum(1 for a in assets if len(a.get('folder_variants') or []) >= 2)}")
    print(f"Ze skojarzonymi produktami: {sum(1 for a in assets if a.get('linked_products'))}")

    if missing_polska[:8]:
        print("\nPrzykladowe braki POLSKA:")
        for p in missing_polska[:8]:
            print(" ", polska_disk[p])

    if weak_variants[:10]:
        print("\nFoldery kampanii bez grup wariantow (top 10):")
        for d, n, _ in sorted(weak_variants, key=lambda x: -x[1])[:10]:
            print(f"  {n} plikow | {d[-100:]}")

    if weak_products[:8]:
        print("\nFoldery z oczekiwanymi produktami, brak linkow:")
        for d, n in weak_products[:8]:
            print(f"  {n} plikow | {d[-100:]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
