# -*- coding: utf-8 -*-
"""
Copy GC visualizations from G: into matching D: GC product folders (4 - VISUALS).
NEVER overwrites existing files.

Usage:
  python apps/web/scripts/sync-gc-viz-from-g.py
  python apps/web/scripts/sync-gc-viz-from-g.py --dry-run
"""
from __future__ import annotations

import argparse
import re
import shutil
from datetime import datetime
from pathlib import Path

G_ROOT = Path(r"G:/Sprzedaż Marketing/GC WIZUALIZACJE")
GC_ROOT = Path(r"D:/Marketing/- EKSPORT/01 - PRODUCTS/- GC")
INDEX_RE = re.compile(r"(?<!\d)(\d{6,8})(?:\.(\d{2}))?(?!\d)")
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".gif"}


def find_indexes(name: str) -> list[tuple[str, str | None]]:
    out = []
    for m in INDEX_RE.finditer(name):
        out.append((m.group(1), m.group(2)))
    return out


def build_gc_revision_map(gc_root: Path) -> dict[str, list[Path]]:
    """Map index_base -> list of revision dirs that contain 4 - VISUALS (or create target)."""
    mapping: dict[str, list[Path]] = {}
    if not gc_root.exists():
        return mapping
    for cat in gc_root.iterdir():
        if not cat.is_dir():
            continue
        try:
            products = list(cat.iterdir())
        except OSError:
            continue
        for prod in products:
            if not prod.is_dir():
                continue
            try:
                revs = list(prod.iterdir())
            except OSError:
                continue
            for rev in revs:
                if not rev.is_dir():
                    continue
                idxs = find_indexes(rev.name)
                if not idxs:
                    continue
                visuals = None
                try:
                    for sub in rev.iterdir():
                        if sub.is_dir() and ("visual" in sub.name.lower() or sub.name.strip().startswith("4")):
                            visuals = sub
                            break
                except OSError:
                    continue
                if visuals is None:
                    visuals = rev / "4 - VISUALS"
                for base, _rev in idxs:
                    mapping.setdefault(base, []).append(visuals)
    return mapping


def ensure_dir(path: Path, dry: bool) -> None:
    if dry:
        return
    path.mkdir(parents=True, exist_ok=True)


def copy_never_overwrite(src: Path, dest_dir: Path, dry: bool) -> str:
    dest = dest_dir / src.name
    if dest.exists():
        return "skip_exists"
    if dry:
        return "would_copy"
    ensure_dir(dest_dir, dry=False)
    shutil.copy2(src, dest)
    return "copied"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--g-root", default=str(G_ROOT))
    ap.add_argument("--gc-root", default=str(GC_ROOT))
    args = ap.parse_args()

    g_root = Path(args.g_root)
    gc_root = Path(args.gc_root)
    if not g_root.exists():
        raise SystemExit(f"G root missing: {g_root}")
    if not gc_root.exists():
        raise SystemExit(f"GC root missing: {gc_root}")

    rev_map = build_gc_revision_map(gc_root)
    print(f"GC revision targets indexed: {len(rev_map)} bases")

    stats = {"copied": 0, "skip_exists": 0, "would_copy": 0, "no_target": 0, "scanned": 0}
    log_lines = [f"# sync-gc-viz-from-g {datetime.now().isoformat(timespec='seconds')} dry={args.dry_run}"]

    for path in g_root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in IMG_EXT:
            continue
        if path.name.startswith("."):
            continue
        stats["scanned"] += 1
        idxs = find_indexes(path.name)
        if not idxs:
            continue
        matched = False
        for base, _r in idxs:
            targets = rev_map.get(base) or []
            if not targets:
                continue
            matched = True
            for dest_dir in targets:
                status = copy_never_overwrite(path, dest_dir, args.dry_run)
                stats[status] = stats.get(status, 0) + 1
                log_lines.append(f"{status}\t{base}\t{path}\t->\t{dest_dir / path.name}")
        if not matched:
            stats["no_target"] += 1
            log_lines.append(f"no_target\t{path.name}")

    print("stats", stats)
    out_log = Path(__file__).resolve().parents[1] / "data" / "sync-gc-viz-log.txt"
    out_log.parent.mkdir(parents=True, exist_ok=True)
    out_log.write_text("\n".join(log_lines) + "\n", encoding="utf-8")
    print("log", out_log)


if __name__ == "__main__":
    main()
