# -*- coding: utf-8 -*-
"""Uzupelnia appearance_tags w branding-index z produktow, nazw plikow i OCR."""
from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent
INDEX = WEB / "data" / "branding-index.json"
SEARCH_OUT = WEB / "data" / "branding-search-index.json"
REC = WEB / "data" / "branding-recognition.json"
FILE_INDEX = WEB / "data" / "file-index.json"

sys.path.insert(0, str(SCRIPTS))
from brand_tag_utils import enrich_all_assets  # noqa: E402


def _load_build_module():
    path = SCRIPTS / "build-branding-index.py"
    spec = importlib.util.spec_from_file_location("build_branding_index", path)
    if not spec or not spec.loader:
        raise RuntimeError("build-branding-index.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    if not INDEX.is_file():
        print("branding-index.json missing")
        return 1
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    file_index = json.loads(FILE_INDEX.read_text(encoding="utf-8")) if FILE_INDEX.is_file() else {}
    rec = json.loads(REC.read_text(encoding="utf-8")) if REC.is_file() else {}
    assets = idx.get("assets") or []
    touched = enrich_all_assets(assets, file_index, rec)
    try:
        from asset_role_utils import enrich_all_branding_taxonomy

        enrich_all_branding_taxonomy(assets)
    except Exception as exc2:
        print(f"warn: taxonomy enrich skipped: {exc2}")
    idx["tags_enriched_at"] = datetime.now(timezone.utc).isoformat()
    idx["appearance_tag_count"] = sum(1 for a in assets if a.get("appearance_tags"))
    INDEX.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")

    bbi = _load_build_module()
    search_idx = bbi.build_search_index(assets)
    for a in assets:
        for t in a.get("appearance_tags") or []:
            key = t
            search_idx.setdefault("by_tag", {}).setdefault(key, []).append(a["id"])
    search_idx["by_tag"] = {k: sorted(set(v)) for k, v in search_idx.get("by_tag", {}).items()}
    SEARCH_OUT.write_text(json.dumps(search_idx, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"enrich-branding-tags touched={touched} with_appearance={idx['appearance_tag_count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
