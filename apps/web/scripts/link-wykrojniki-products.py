# -*- coding: utf-8 -*-
"""Link wykrojnik PDFs to products by kod + nazwa + .01 variants."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
REGISTRY = WEB / "data" / "wykrojniki-registry.json"
INDEX = WEB / "data" / "file-index.json"
WYK_ROOT = Path(r"X:/Marketing/- POLSKA/01 - PRODUKTY/01 - WYKROJNIKI")

KOD_RE = re.compile(r"(?:ARTYKUL[:\s]+)?(\d{5,9}(?:\.\d{2})?)", re.I)
PDF_RE = re.compile(r"fol_jedn_|kar_zbior_|fol_|kar_", re.I)


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def product_index_map(file_index: dict) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for p in file_index.get("products") or []:
        pid = p.get("id")
        if not pid:
            continue
        for idx in p.get("indexes") or []:
            base = str(idx).split(".")[0]
            out.setdefault(base, []).append(pid)
            out.setdefault(str(idx), []).append(pid)
        name = (p.get("display_name") or p.get("name") or "").lower()
        if name:
            out.setdefault(name[:40], []).append(pid)
    return out


def main() -> int:
    registry = load_json(REGISTRY, {"entries": {}})
    file_index = load_json(INDEX, {"products": []})
    idx_map = product_index_map(file_index)
    entries = registry.setdefault("entries", {})
    if WYK_ROOT.is_dir():
        for pdf in WYK_ROOT.rglob("*.pdf"):
            if not PDF_RE.search(pdf.name):
                continue
            text = pdf.stem + " " + str(pdf)
            km = KOD_RE.search(text)
            kod = km.group(1) if km else pdf.stem
            base = kod.split(".")[0]
            linked = list(dict.fromkeys((idx_map.get(kod) or []) + (idx_map.get(base) or [])))
            key = kod
            block = entries.setdefault(
                key,
                {"kod": kod, "pdf_path": str(pdf).replace("\\", "/"), "linked_product_ids": []},
            )
            block["pdf_path"] = str(pdf).replace("\\", "/")
            block["linked_product_ids"] = sorted(set((block.get("linked_product_ids") or []) + linked))
            block["link_rule"] = "ARTYKUL:KOD+nazwa+.01"
    registry["updated_at"] = datetime.now(timezone.utc).isoformat()
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {REGISTRY}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
