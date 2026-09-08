#!/usr/bin/env python3
"""
QA / dev-only: generate a synthetic Marketing tree from the committed
file-index.json so the DAM app runs end-to-end WITHOUT the real Marketing
drive (thumbnails render, files show "online", search finds files).

Why: PAMIEC-PODRECZNA (thumb cache) and the Marketing drive are gitignored /
Windows-only, so a cloud/Linux checkout has no image files. This script rebases
every ``D:\\Marketing\\...`` index path onto a local Linux base and writes a
labelled placeholder PNG there, then points machine-config.json at that base.

Idempotent. Nothing here is committed except this script; generated images live
outside git (default base under $HOME).

Usage:
    python bin/scripts/qa/gen-test-marketing.py [--base /path] [--limit N]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BIN_ROOT = HERE.parent.parent                      # .../bin
WEB_DATA = BIN_ROOT / "apps" / "web" / "data"
INDEX = WEB_DATA / "file-index.json"
MACHINE_CONFIG = BIN_ROOT / "apps" / "desktop" / "machine-config.json"

DRIVE_RE = re.compile(r"^[A-Za-z]:[\\/](?:Marketing[\\/])?", re.IGNORECASE)
RASTER_EXT = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}
PATH_KEY_RE = re.compile(r"path|file|thumb|cover|src", re.IGNORECASE)

# Distinct-ish tile colours by brand so the grid looks real, not uniform.
BRAND_BG = {"DK": (34, 130, 68), "GC": (196, 92, 30)}
DEFAULT_BG = (70, 66, 85)


def collect_paths(node, out: set) -> None:
    if node is None:
        return
    if isinstance(node, str):
        return
    if isinstance(node, list):
        for v in node:
            collect_paths(v, out)
        return
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, str):
                if PATH_KEY_RE.search(k) and DRIVE_RE.match(v.replace("/", "\\")):
                    if Path(v.replace("\\", "/")).suffix.lower() in RASTER_EXT:
                        out.add(v)
            else:
                collect_paths(v, out)


def rel_of(win_path: str) -> str:
    p = win_path.replace("\\", "/")
    p = DRIVE_RE.sub("", win_path).replace("\\", "/")
    return p.lstrip("/")


def brand_of(rel: str) -> str:
    up = rel.upper()
    if "/- DK/" in up or up.startswith("- POLSKA"):
        return "DK"
    if "/- GC/" in up or up.startswith("- EKSPORT"):
        return "GC"
    return ""


def label_for(rel: str) -> str:
    stem = Path(rel).stem
    return stem[:38]


def make_placeholder(dst: Path, label: str, bg) -> None:
    from PIL import Image, ImageDraw

    w = h = 512
    im = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(im)
    # simple frame
    d.rectangle([8, 8, w - 8, h - 8], outline=(255, 255, 255), width=3)
    # wrap label across lines
    words = label.replace("-", " ").split()
    lines, cur = [], ""
    for wd in words:
        if len(cur) + len(wd) + 1 > 16:
            lines.append(cur)
            cur = wd
        else:
            cur = (cur + " " + wd).strip()
    if cur:
        lines.append(cur)
    lines = lines[:6] or [label[:16]]
    y = h // 2 - len(lines) * 16
    for ln in lines:
        d.text((28, y), ln, fill=(255, 255, 255))
        y += 30
    d.text((28, h - 40), "DAM TEST", fill=(230, 230, 230))
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, format="PNG")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.environ.get("DAM_TEST_MARKETING")
                    or str(Path.home() / "dam-test-marketing"))
    ap.add_argument("--limit", type=int, default=0, help="cap files (0 = all)")
    args = ap.parse_args()

    base = Path(args.base)
    if not INDEX.is_file():
        print(f"FAIL: index not found: {INDEX}", file=sys.stderr)
        return 2
    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        print("FAIL: Pillow required (pip install Pillow)", file=sys.stderr)
        return 2

    data = json.loads(INDEX.read_text(encoding="utf-8"))
    paths: set = set()
    collect_paths(data.get("viz_latest"), paths)
    collect_paths(data.get("products"), paths)
    all_paths = sorted(paths)
    if args.limit:
        all_paths = all_paths[: args.limit]

    # root markers so validate-base passes
    for marker in ("- POLSKA", "- EKSPORT", "-- ARCHIWUM --"):
        (base / marker).mkdir(parents=True, exist_ok=True)

    made = skipped = 0
    for i, win in enumerate(all_paths):
        rel = rel_of(win)
        if not rel:
            continue
        dst = base / rel
        if dst.is_file() and dst.stat().st_size > 0:
            skipped += 1
            continue
        bg = BRAND_BG.get(brand_of(rel), DEFAULT_BG)
        try:
            make_placeholder(dst, label_for(rel), bg)
            made += 1
        except Exception as exc:
            print(f"WARN {rel}: {exc}", file=sys.stderr)
        if made and made % 1000 == 0:
            print(f"  ... {made} generated")

    # point the bridge at this base
    MACHINE_CONFIG.write_text(
        json.dumps({"base_path": str(base), "source": "gen-test-marketing"},
                   ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"OK base={base}")
    print(f"   files made={made} skipped={skipped} total={len(all_paths)}")
    print(f"   machine-config -> {MACHINE_CONFIG}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
