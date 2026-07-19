# -*- coding: utf-8 -*-
"""Merge product-associations into search-index.json."""
from __future__ import annotations

import json
import unicodedata
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
ASSOC_FILE = WEB / "data" / "product-associations.json"
SEARCH_FILE = WEB / "data" / "search-index.json"
BULK_FILE = WEB / "data" / "bulk-packaging.json"
CATALOG_FILE = WEB / "data" / "product-catalog.json"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()


def build_reverse(assoc: dict) -> dict:
    rev = dict(assoc.get("reverse") or {})
    for pid, block in (assoc.get("products") or {}).items():
        if not isinstance(block, dict):
            continue
        for key in ("terms", "dishes", "ingredients"):
            for term in block.get(key) or []:
                t = norm(term)
                if not t:
                    continue
                rev.setdefault(t, [])
                if pid not in rev[t]:
                    rev[t].append(pid)
    return {k: sorted(set(v)) for k, v in rev.items()}


def main() -> int:
    if not SEARCH_FILE.is_file():
        print("search-index.json missing - run build-file-index first")
        return 1
    search = json.loads(SEARCH_FILE.read_text(encoding="utf-8"))
    assoc = json.loads(ASSOC_FILE.read_text(encoding="utf-8")) if ASSOC_FILE.is_file() else {}
    bulk = json.loads(BULK_FILE.read_text(encoding="utf-8")) if BULK_FILE.is_file() else {}
    catalog = json.loads(CATALOG_FILE.read_text(encoding="utf-8")) if CATALOG_FILE.is_file() else {}
    reverse = build_reverse(assoc)
    packs = bulk.get("packs") or {}
    for pack in packs.values():
        label = norm((pack or {}).get("label", "").replace("×", "x"))
        grid = norm((pack or {}).get("grid", ""))
        for tok in label.split():
            if tok:
                reverse.setdefault(tok, [])
        if grid:
            reverse.setdefault(grid, [])
    for entry in (catalog.get("products") or {}).values():
        ref = (entry or {}).get("bulk_packaging_ref")
        if ref and ref in packs:
            lbl = norm(packs[ref].get("label", "").replace("×", "x"))
            for tok in lbl.split():
                if tok and tok not in reverse:
                    reverse[tok] = []
    by_id = {e["id"]: e for e in search.get("entries") or [] if e.get("id")}
    for pid, block in (assoc.get("products") or {}).items():
        entry = by_id.get(pid)
        if not entry:
            continue
        extra = []
        for key in ("terms", "dishes", "ingredients"):
            extra.extend(block.get(key) or [])
        blob = entry.get("search_blob") or ""
        add = " ".join(norm(x) for x in extra if x)
        if add and add not in blob:
            entry["search_blob"] = (blob + " " + add).strip()
    search["association_reverse"] = reverse
    SEARCH_FILE.write_text(json.dumps(search, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"enriched search-index association_reverse keys={len(reverse)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
