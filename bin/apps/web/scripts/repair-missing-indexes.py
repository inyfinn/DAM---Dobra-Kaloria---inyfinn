# -*- coding: utf-8 -*-
"""Napraw puste / noid indeksy w file-index.json bez pelnego rescanu dysku."""
from __future__ import annotations

import importlib.util
import json
import re
import shutil
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
INDEX = WEB / "data" / "file-index.json"


def _load_parse():
    path = Path(__file__).with_name("build-file-index.py")
    spec = importlib.util.spec_from_file_location("dam_build_file_index", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod.parse_index, mod.infer_index_from_files


def resolve_rev_index(parse_index, infer_index_from_files, rev: dict):
    old = rev.get("index_base")
    if old and str(old).lower() not in ("noid", "pending", ""):
        return None
    blob_parts = [
        rev.get("folder") or "",
        rev.get("path") or "",
        rev.get("rel") or "",
    ]
    for f in rev.get("wizki") or []:
        blob_parts.append(f.get("name") or "")
        blob_parts.append(f.get("path") or "")
    blob = " ".join(blob_parts)
    base, revn, full = parse_index(blob)
    if not full:
        base, revn, full = infer_index_from_files(rev.get("wizki") or [])
    if not full:
        return None
    return base, revn or "00", full


def main() -> int:
    parse_index, infer_index_from_files = _load_parse()
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    fixed_revs = 0
    for p in data.get("products") or []:
        for r in p.get("revisions") or []:
            resolved = resolve_rev_index(parse_index, infer_index_from_files, r)
            if not resolved:
                continue
            base, revn, full = resolved
            r["index_base"] = base
            r["index_rev"] = revn
            r["index"] = full
            fixed_revs += 1
        bases = sorted(
            {
                rr.get("index_base")
                for rr in (p.get("revisions") or [])
                if rr.get("index_base") and str(rr.get("index_base")).lower() not in ("noid", "pending")
            }
        )
        indexes = sorted({rr.get("index") for rr in (p.get("revisions") or []) if rr.get("index")})
        p["index_bases"] = list(bases)
        p["indexes"] = list(indexes)

    fixed_viz = 0
    renamed = 0
    by_id = {p.get("id"): p for p in (data.get("products") or [])}
    for v in data.get("viz_latest") or []:
        ib = v.get("index_base")
        if ib and str(ib).lower() not in ("noid", "pending"):
            continue
        blob = " ".join(
            [
                v.get("revision_folder") or "",
                v.get("path") or "",
                v.get("file") or "",
                v.get("rel") or "",
            ]
        )
        base, revn, full = parse_index(blob)
        if not full:
            p = by_id.get(v.get("product_id")) or {}
            for r in p.get("revisions") or []:
                if r.get("index_base") and str(r.get("index_base")).lower() not in ("noid", "pending"):
                    base = r["index_base"]
                    revn = r.get("index_rev") or "00"
                    full = r.get("index") or f"{base}.00"
                    break
        if not full:
            continue
        v["index_base"] = base
        v["index"] = full
        fixed_viz += 1
        thumb = v.get("thumb_url") or ""
        m = re.search(r"(data/thumbs/[^?]+)", thumb)
        if m:
            old_path = WEB / Path(m.group(1))
            if old_path.is_file() and "__noid_" in old_path.name:
                new_name = old_path.name.replace("__noid_", f"__{base}_")
                new_path = old_path.with_name(new_name)
                if not new_path.exists():
                    shutil.copy2(old_path, new_path)
                    renamed += 1
                v["thumb_url"] = thumb.replace(old_path.name, new_name)

    INDEX.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"fixed revisions: {fixed_revs}")
    print(f"fixed viz_latest: {fixed_viz}")
    print(f"renamed thumbs: {renamed}")
    for v in data.get("viz_latest") or []:
        if v.get("product_id") == "daktyl-limonka-raw":
            print("limonka:", v.get("index_base"), v.get("thumb_url"))
            break
    still = sum(
        1
        for v in (data.get("viz_latest") or [])
        if not v.get("index_base") or str(v.get("index_base")).lower() in ("noid", "pending")
    )
    print(f"viz still without real index: {still}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
