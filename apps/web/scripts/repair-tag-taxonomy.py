"""
Przelicz tagi / tag_groups (Smak vs Typ vs Opakowanie) na istniejacym
file-index.json + search-index.json - bez pelnego rescanu dysku.

Zrodlo prawdy: build-file-index.py (FLAVOR / PRODUCT / PACKAGING / CARRIER_TO_TAG).
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
FILE_INDEX = DATA / "file-index.json"
SEARCH_INDEX = DATA / "search-index.json"
BUILDER = Path(__file__).resolve().parent / "build-file-index.py"

_spec = importlib.util.spec_from_file_location("dam_build_file_index", BUILDER)
_mod = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(_mod)

CARRIER_TO_TAG = _mod.CARRIER_TO_TAG
build_tag_groups = _mod.build_tag_groups
extract_tags = _mod.extract_tags
merge_global_tag_groups = _mod.merge_global_tag_groups
norm = _mod.norm


def carrier_tag(raw: str | None) -> str | None:
    if not raw:
        return None
    key = str(raw).strip().upper()
    if key in CARRIER_TO_TAG:
        return CARRIER_TO_TAG[key]
    n = norm(raw).upper().replace(" ", "")
    return CARRIER_TO_TAG.get(n)


def retag_product(p: dict) -> dict:
    parts = [
        p.get("category") or "",
        p.get("name") or "",
        p.get("display_name") or "",
    ]
    for r in p.get("revisions") or []:
        parts.append(r.get("folder") or "")
        ctag = carrier_tag(r.get("carrier"))
        if ctag:
            parts.append(ctag)
        # surowy kod nosnika tez (BAT, MINI…) - extract_tags zmapuje
        if r.get("carrier"):
            parts.append(str(r["carrier"]))
    tags = extract_tags(parts)
    p["tags"] = tags
    p["tag_groups"] = build_tag_groups(tags)
    return p


def main() -> int:
    fi = json.loads(FILE_INDEX.read_text(encoding="utf-8"))
    si = json.loads(SEARCH_INDEX.read_text(encoding="utf-8"))
    products = fi.get("products") or []
    for p in products:
        retag_product(p)

    global_tg = merge_global_tag_groups(products, cap=32)
    # Autor z enrich - zachowaj jesli byl
    prev = fi.get("tag_groups") or si.get("tag_groups") or {}
    if prev.get("autor"):
        global_tg["autor"] = list(prev["autor"])[:24]
        global_tg["osoba"] = list(prev.get("osoba") or prev["autor"])[:24]

    fi["tag_groups"] = global_tg
    si["tag_groups"] = global_tg

    by_id = {p.get("id"): p for p in products}
    for e in si.get("entries") or []:
        p = by_id.get(e.get("id"))
        if not p:
            continue
        e["tags"] = p.get("tags") or []
        e["tag_groups"] = p.get("tag_groups") or {}

    FILE_INDEX.write_text(json.dumps(fi, ensure_ascii=False, indent=2), encoding="utf-8")
    SEARCH_INDEX.write_text(json.dumps(si, ensure_ascii=False, indent=2), encoding="utf-8")

    print("OK typ:", global_tg.get("typ"))
    print("OK smak (sample):", (global_tg.get("smak") or [])[:12])
    print("OK opakowanie:", global_tg.get("opakowanie"))
    print("muffin in typ?", "muffin" in (global_tg.get("typ") or []))
    print("muffin in smak?", "muffin" in (global_tg.get("smak") or []))
    print("mini baton in typ?", "mini baton" in (global_tg.get("typ") or []))
    print("bat in typ?", "bat" in (global_tg.get("typ") or []))
    print("products", len(products))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
