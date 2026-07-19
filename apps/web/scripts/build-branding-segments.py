#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Buduje manifest ~200 segmentow Marketing (chunki do OCR/enrich)."""
from __future__ import annotations

import json
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from brand_marketing_segments import TARGET_SEGMENT_COUNT, build_all_segments  # noqa: E402

WEB = SCRIPTS.parent
OUT = WEB / "data" / "branding-segments.json"


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=TARGET_SEGMENT_COUNT)
    args = ap.parse_args()

    segments = build_all_segments(target=args.target)
    polska = sum(1 for s in segments if s.root_type == "polska")
    legacy = sum(1 for s in segments if s.root_type == "legacy")
    total_files = sum(s.file_count for s in segments)

    payload = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "target_count": args.target,
        "segment_count": len(segments),
        "stats": {
            "polska_segments": polska,
            "legacy_segments": legacy,
            "total_media_files": total_files,
        },
        "segments": [asdict(s) for s in segments],
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(segments)} segments -> {OUT}")
    print(f"  POLSKA: {polska}, legacy: {legacy}, media files in segments: {total_files}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
