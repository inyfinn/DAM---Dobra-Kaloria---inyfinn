#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ponownie wzbogaca branding-index.json o folder_variants / linked_products (bez pelnego skanu X:)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from brand_folder_context import enrich_folder_groups  # noqa: E402

DATA = SCRIPTS.parent / "data"


def main() -> int:
    file_index = json.loads((DATA / "file-index.json").read_text(encoding="utf-8"))
    index_path = DATA / "branding-index.json"
    data = json.loads(index_path.read_text(encoding="utf-8"))
    assets = data.get("assets") or []
    print(f"Enriching {len(assets)} assets…")
    enrich_folder_groups(assets, file_index)
    index_path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Saved {index_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
