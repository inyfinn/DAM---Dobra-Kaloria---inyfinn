"""Recompress only oversized DAM cache AVIF files through the canonical encoder."""
from __future__ import annotations

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONTENT_ROOT = HERE.parents[2]
DESKTOP = CONTENT_ROOT / "apps" / "desktop"
sys.path.insert(0, str(DESKTOP))

import dam_thumb_cache as tc  # noqa: E402
from PIL import Image  # noqa: E402

THUMBS = CONTENT_ROOT / "PAMIEC-PODRECZNA" / "thumbs"
REPORT = HERE / "recompress-oversized-cache-5.0.192.json"
NAMED = {
    "00d9abadfe2eac6ac2746a70ee9cd4cb516a03c119e8225fae44c6899a251a38.avif",
    "00a0a162c190f13e0c0859e86b56f5715907879a574782a75579a1effbb72f7e.avif",
}


def census() -> dict:
    files = [p for p in THUMBS.iterdir() if p.is_file()]
    fat = [p for p in files if p.stat().st_size > tc.MAX_THUMB_BYTES]
    return {
        "files": len(files),
        "over_cap": len(fat),
        "total_bytes": sum(p.stat().st_size for p in files),
        "over_cap_bytes": sum(p.stat().st_size for p in fat),
        "max_bytes": max((p.stat().st_size for p in files), default=0),
        "named": {p.name: p.stat().st_size for p in files if p.name in NAMED},
    }


def recompress(path: Path) -> dict:
    before = path.stat().st_size
    try:
        with Image.open(path) as opened:
            opened.load()
            ok = tc._save_avif_capped(opened, path)
        after = path.stat().st_size if path.is_file() else 0
        if not ok or after > tc.MAX_THUMB_BYTES:
            return {"file": path.name, "before": before, "after": after, "error": "cap_not_met"}
        return {"file": path.name, "before": before, "after": after}
    except Exception as exc:  # noqa: BLE001
        return {"file": path.name, "before": before, "after": path.stat().st_size, "error": repr(exc)}


def main() -> int:
    started = time.time()
    before = census()
    targets = [p for p in THUMBS.iterdir() if p.is_file() and p.stat().st_size > tc.MAX_THUMB_BYTES]
    results = []
    workers = max(1, min(24, os.cpu_count() or 4))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(recompress, path): path for path in targets}
        for done, future in enumerate(as_completed(futures), 1):
            results.append(future.result())
            if done % 250 == 0 or done == len(futures):
                print(f"[recompress] {done}/{len(futures)}", flush=True)
    after = census()
    failures = [row for row in results if row.get("error")]
    payload = {
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "elapsed_s": round(time.time() - started, 3),
        "cap_bytes": tc.MAX_THUMB_BYTES,
        "workers": workers,
        "before": before,
        "after": after,
        "processed": len(results),
        "failures": failures,
    }
    REPORT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2), flush=True)
    return 0 if after["over_cap"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
