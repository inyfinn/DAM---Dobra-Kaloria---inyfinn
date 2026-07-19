# -*- coding: utf-8 -*-
"""Merge branding-recognition into branding-index linked products/tags."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
INDEX = WEB / "data" / "branding-index.json"
REC = WEB / "data" / "branding-recognition.json"
FILE_INDEX = WEB / "data" / "file-index.json"
SKU_RE = re.compile(r"6300\d{3}(?:\.\d{2})?")


def sku_to_products(file_index: dict) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for p in file_index.get("products") or []:
        pid = p.get("id")
        if not pid:
            continue
        for idx in p.get("indexes") or []:
            out.setdefault(str(idx), []).append(pid)
            out.setdefault(str(idx).split(".")[0], []).append(pid)
    return out


def main() -> int:
    if not INDEX.is_file():
        return 1
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    rec = json.loads(REC.read_text(encoding="utf-8")) if REC.is_file() else {"assets": {}}
    file_index = json.loads(FILE_INDEX.read_text(encoding="utf-8")) if FILE_INDEX.is_file() else {}
    sku_map = sku_to_products(file_index)
    by_id = {a["id"]: a for a in idx.get("assets") or [] if a.get("id")}
    for aid, block in (rec.get("assets") or {}).items():
        asset = by_id.get(aid)
        if not asset:
            continue
        ocr = block.get("ocr_text") or ""
        asset["ocr_text"] = ocr
        tags = list(block.get("appearance_tags") or [])
        for m in SKU_RE.findall(ocr + " " + asset.get("name", "")):
            for pid in sku_map.get(m, []):
                if pid not in (asset.get("linked_product_ids") or []):
                    asset.setdefault("linked_product_ids", []).append(pid)
        asset["appearance_tags"] = tags
        blob = asset.get("search_blob") or ""
        asset["search_blob"] = (blob + " " + ocr.lower()).strip()
    idx["linked_at"] = datetime.now(timezone.utc).isoformat()
    INDEX.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"linked branding-index assets={len(by_id)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
