#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Przetwarza jeden segment Marketing: OCR -> recognition -> enrich folder groups."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from brand_folder_context import (  # noqa: E402
    enrich_folder_groups,
    match_products_by_associations,
    resolve_folder_products,
)
from brand_marketing_segments import segment_matches_asset  # noqa: E402

WEB = SCRIPTS.parent
DATA = WEB / "data"
INDEX_PATH = DATA / "branding-index.json"
SEGMENTS_PATH = DATA / "branding-segments.json"
REC_PATH = DATA / "branding-recognition.json"
STATUS_PATH = DATA / "branding-segment-status.json"
FILE_INDEX_PATH = DATA / "file-index.json"

OCR_RASTER_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"}


def ocr_image(path: Path) -> tuple[str, float]:
    try:
        from rapidocr_onnxruntime import RapidOCR  # type: ignore

        engine = RapidOCR()
        result, _ = engine(str(path))
        if not result:
            return "", 0.0
        text = " ".join(row[1] for row in result if len(row) > 1)
        conf = sum(float(row[2]) for row in result if len(row) > 2) / max(len(result), 1)
        return text, conf
    except Exception:
        return "", 0.0


def load_json(path: Path, default: dict | None = None) -> dict:
    if not path.is_file():
        return default or {}
    return json.loads(path.read_text(encoding="utf-8"))


def find_segment(manifest: dict, segment_id: str | None, path_prefix: str | None) -> dict | None:
    segments = manifest.get("segments") or []
    if segment_id:
        for s in segments:
            if s.get("id") == segment_id:
                return s
    if path_prefix:
        low = path_prefix.replace("\\", "/").lower()
        for s in segments:
            sp = (s.get("path") or "").lower()
            if low in sp or sp.startswith(low):
                return s
    return None


def link_products_from_text(text: str, file_index: dict) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for pid in match_products_by_associations(text):
        if pid not in seen:
            seen.add(pid)
            found.append(pid)
    for pid in resolve_folder_products(text, text, file_index):
        if pid not in seen:
            seen.add(pid)
            found.append(pid)
    return found


def process_segment(
    segment: dict,
    *,
    ocr_limit: int = 30,
    skip_ocr: bool = False,
) -> dict:
    import brand_folder_context as bfc

    bfc._ASSOC_REVERSE_CACHE = None  # noqa: SLF001

    file_index = load_json(FILE_INDEX_PATH)
    index_data = load_json(INDEX_PATH)
    assets: list[dict] = index_data.get("assets") or []
    seg_path = segment.get("path") or ""

    seg_assets = [a for a in assets if segment_matches_asset(seg_path, a.get("path") or "")]
    rec = load_json(REC_PATH, {"assets": {}})
    store = rec.setdefault("assets", {})

    ocr_done = 0
    linked_from_ocr = 0

    if not skip_ocr:
        for a in seg_assets:
            if ocr_done >= ocr_limit:
                break
            aid = a.get("id") or ""
            fp = Path(a.get("path") or "")
            if not aid or not fp.is_file():
                continue
            if fp.suffix.lower() not in OCR_RASTER_EXT:
                continue
            existing = store.get(aid) or {}
            if existing.get("ocr_text") or a.get("ocr_text"):
                continue
            text, conf = ocr_image(fp)
            from brand_tag_utils import extract_appearance_from_text

            appearance = extract_appearance_from_text(text + " " + (a.get("name") or "")) if text else []
            ocr_products = link_products_from_text(text + " " + (a.get("name") or ""), file_index) if text else []
            merged_linked = list(a.get("linked_product_ids") or [])
            for pid in ocr_products:
                if pid not in merged_linked:
                    merged_linked.append(pid)
            store[aid] = {
                "ocr_text": text,
                "ocr_confidence": conf,
                "appearance_tags": appearance,
                "linked_product_ids": merged_linked,
                "link_source": "ocr" if text else "none",
                "mtime": fp.stat().st_mtime,
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }
            if text:
                a["ocr_text"] = text
                a["linked_product_ids"] = merged_linked
                linked_from_ocr += len(ocr_products)
            ocr_done += 1

    from brand_tag_utils import enrich_all_assets

    enrich_all_assets(seg_assets, file_index, rec)
    enrich_folder_groups(assets, file_index)

    linked_count = sum(1 for a in seg_assets if a.get("linked_product_ids"))
    rec["updated_at"] = datetime.now(timezone.utc).isoformat()
    REC_PATH.write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
    INDEX_PATH.write_text(json.dumps(index_data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    segment["status"] = "done"
    segment["enriched_at"] = datetime.now(timezone.utc).isoformat()
    segment["ocr_done"] = ocr_done
    segment["linked_count"] = linked_count

    return {
        "segment_id": segment.get("id"),
        "path": seg_path,
        "assets_in_segment": len(seg_assets),
        "ocr_processed": ocr_done,
        "linked_from_ocr": linked_from_ocr,
        "assets_with_products": linked_count,
    }


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser(description="Process one branding segment (OCR + enrich)")
    ap.add_argument("--segment", help="Segment id, e.g. seg-042")
    ap.add_argument("--path", help="Path prefix to find segment (folder path)")
    ap.add_argument("--ocr-limit", type=int, default=30)
    ap.add_argument("--skip-ocr", action="store_true")
    ap.add_argument("--next-pending", action="store_true", help="Process first pending segment")
    ap.add_argument("--batch", type=int, default=0, help="Process N pending segments")
    args = ap.parse_args()

    manifest = load_json(SEGMENTS_PATH)
    if not manifest.get("segments"):
        print("branding-segments.json missing - run build-branding-segments.py first", file=sys.stderr)
        return 1

    targets: list[dict] = []
    if args.next_pending or args.batch:
        pending = [s for s in manifest["segments"] if s.get("status", "pending") == "pending"]
        if args.batch:
            targets = pending[: args.batch]
        elif pending:
            targets = [pending[0]]
    else:
        seg = find_segment(manifest, args.segment, args.path)
        if not seg:
            print("Segment not found", file=sys.stderr)
            return 1
        targets = [seg]

    if not targets:
        print("No segments to process")
        return 0

    results = []
    for seg in targets:
        seg["status"] = "processing"
        print(f"Processing {seg.get('id')} {seg.get('path')}")
        try:
            summary = process_segment(seg, ocr_limit=args.ocr_limit, skip_ocr=args.skip_ocr)
            results.append(summary)
            print(json.dumps(summary, ensure_ascii=False))
        except Exception as exc:
            seg["status"] = "error"
            seg["notes"] = str(exc)
            print(f"ERROR {seg.get('id')}: {exc}", file=sys.stderr)

    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    SEGMENTS_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    STATUS_PATH.write_text(
        json.dumps({"ok": True, "processed": results, "at": datetime.now(timezone.utc).isoformat()}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
