# -*- coding: utf-8 -*-
"""Mapowanie drzewa Marketing na ~200 segmentow (chunki indeksacji / OCR / enrich)."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

TARGET_SEGMENT_COUNT = 200
SPLIT_IF_FILES_ABOVE = 60
MERGE_IF_FILES_BELOW = 8

RASTER_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp", ".gif", ".bmp", ".psd", ".psb"}
VIDEO_EXT = {".mp4", ".mov", ".webm", ".avi"}
MEDIA_EXT = RASTER_EXT | VIDEO_EXT

SKIP_PATH_MARKERS = (
    "/gotowe/",
    "/gotowe\\",
    "/99_inne/",
    "/99_inne\\",
    "/wymiana/",
    "/wymiana\\",
    "/__macosx/",
    "/node_modules/",
)

POLSKA_SECTIONS: tuple[tuple[str, str], ...] = (
    ("branding", "- BRANDING i MARKA -"),
    ("firmowe", "02 - FIRMOWE MATERIAŁY"),
    ("graficzne", "03 - MATERIAŁY GRAFICZNE"),
    ("procesy", "04 - PROCESY"),
    ("social", "05 - SOCIAL MEDIA"),
    ("www", "06 - STRONY WWW - INTERNET"),
    ("ecommerce", "07 - E-COMMERCE"),
    ("kampanie", "08 - KAMAPANIE"),
)

LEGACY_TOP_FOLDERS = (
    "05_Materiały graficzne e-commerce",
    "06_Materiały graficzne social media",
    "07_Materiały graficzne strony www",
    "08_Materiały graficzne kampanie",
    "04_Materiały firmowe",
    "03_Materiały produktowe",
)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.lower()).strip()


def resolve_marketing_base() -> Path:
    for candidate in (Path(r"X:/Marketing"), Path(r"D:/Marketing")):
        if (candidate / "- POLSKA").is_dir():
            return candidate
    return Path(r"X:/Marketing")


def should_skip_path(path: str) -> bool:
    low = path.replace("\\", "/").lower()
    return any(m.lower() in low for m in SKIP_PATH_MARKERS)


def is_media_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in MEDIA_EXT


@dataclass
class FolderStats:
    path: Path
    direct_media: int = 0
    subtree_media: int = 0
    subtree_raster: int = 0


@dataclass
class MarketingSegment:
    id: str
    path: str
    root_type: str  # polska | legacy
    section: str
    label: str
    file_count: int = 0
    raster_count: int = 0
    status: str = "pending"
    enriched_at: str = ""
    ocr_done: int = 0
    linked_count: int = 0
    notes: str = ""


def _ancestors_up_to(root: Path, leaf: Path) -> Iterator[Path]:
    cur = leaf
    root_res = root.resolve()
    while True:
        yield cur
        if cur.resolve() == root_res:
            break
        if cur.parent == cur:
            break
        cur = cur.parent


def collect_folder_stats(scan_root: Path) -> dict[str, FolderStats]:
    scan_root = scan_root.resolve()
    stats: dict[str, FolderStats] = {}
    if not scan_root.is_dir():
        return stats

    for fp in scan_root.rglob("*"):
        if not is_media_file(fp):
            continue
        path_str = str(fp).replace("\\", "/")
        if should_skip_path(path_str):
            continue
        is_raster = fp.suffix.lower() in RASTER_EXT
        for folder in _ancestors_up_to(scan_root, fp.parent):
            key = str(folder).replace("\\", "/")
            row = stats.setdefault(key, FolderStats(path=folder))
            row.subtree_media += 1
            if is_raster:
                row.subtree_raster += 1
            if folder == fp.parent:
                row.direct_media += 1
    return stats


def _child_dirs_with_media(folder: Path, stats: dict[str, FolderStats]) -> list[str]:
    out: list[str] = []
    try:
        for child in sorted(folder.iterdir()):
            if not child.is_dir():
                continue
            key = str(child).replace("\\", "/")
            if should_skip_path(key):
                continue
            if stats.get(key, FolderStats(child)).subtree_media > 0:
                out.append(key)
    except OSError:
        pass
    return out


def _initial_roots(marketing: Path) -> list[tuple[str, str, Path]]:
    polska = marketing / "- POLSKA"
    legacy = marketing / "-- ARCHIWUM --"
    roots: list[tuple[str, str, Path]] = []
    for section_key, folder_name in POLSKA_SECTIONS:
        root = polska / folder_name
        if root.is_dir():
            roots.append(("polska", section_key, root))
    if legacy.is_dir():
        added = False
        for name in LEGACY_TOP_FOLDERS:
            sub = legacy / name
            if sub.is_dir():
                roots.append(("legacy", norm(name), sub))
                added = True
        if not added:
            roots.append(("legacy", "archiwum", legacy))
    return roots


def _adjust_to_target(keys: list[str], stats: dict[str, FolderStats], target: int) -> list[str]:
    paths = sorted(set(keys))

    for _ in range(500):
        if len(paths) >= target:
            break
        best: tuple[int, str, list[str]] | None = None
        for key in paths:
            row = stats.get(key)
            if not row or row.subtree_media <= SPLIT_IF_FILES_ABOVE:
                continue
            children = _child_dirs_with_media(Path(key), stats)
            if len(children) < 2:
                continue
            score = row.subtree_media
            if best is None or score > best[0]:
                best = (score, key, children)
        if not best:
            break
        _score, key, children = best
        paths.remove(key)
        paths.extend(children)

    for _ in range(800):
        if len(paths) <= target:
            break
        by_parent: dict[str, list[str]] = {}
        for key in paths:
            parent = str(Path(key).parent).replace("\\", "/")
            by_parent.setdefault(parent, []).append(key)
        merged = False
        for parent, kids in sorted(by_parent.items(), key=lambda x: len(x[1]), reverse=True):
            if len(kids) < 2:
                continue
            total = sum((stats.get(k) or FolderStats(Path(k))).subtree_media for k in kids)
            if total <= SPLIT_IF_FILES_ABOVE or all(
                (stats.get(k) or FolderStats(Path(k))).subtree_media <= MERGE_IF_FILES_BELOW for k in kids
            ):
                for k in kids:
                    paths.remove(k)
                if parent in stats and stats[parent].subtree_media > 0 and parent not in paths:
                    paths.append(parent)
                merged = True
                break
        if not merged:
            smallest: tuple[int, str, list[str]] | None = None
            for parent, kids in by_parent.items():
                if len(kids) < 2 or parent not in stats:
                    continue
                total = stats[parent].subtree_media
                if smallest is None or total < smallest[0]:
                    smallest = (total, parent, kids)
            if smallest:
                _total, parent, kids = smallest
                for k in kids:
                    if k in paths:
                        paths.remove(k)
                if parent not in paths:
                    paths.append(parent)
                merged = True
            if not merged:
                break

    return sorted(set(paths))


def build_all_segments(target: int = TARGET_SEGMENT_COUNT) -> list[MarketingSegment]:
    marketing = resolve_marketing_base()
    initial = _initial_roots(marketing)
    polska_roots = [r for r in initial if r[0] == "polska"]
    legacy_roots = [r for r in initial if r[0] == "legacy"]
    polska_target = max(80, int(target * 0.7)) if legacy_roots else target
    legacy_target = target - polska_target if legacy_roots else 0

    def build_for_roots(roots: list[tuple[str, str, Path]], seg_target: int) -> list[MarketingSegment]:
        if not roots or seg_target <= 0:
            return []
        per_root_target = max(8, seg_target // max(len(roots), 1))
        all_keys: list[str] = []
        meta: dict[str, tuple[str, str]] = {}
        combined_stats: dict[str, FolderStats] = {}

        for root_type, section, root in roots:
            stats = collect_folder_stats(root)
            if not stats:
                continue
            root_key = str(root).replace("\\", "/")
            combined_stats.update(stats)
            section_keys = _adjust_to_target([root_key], stats, per_root_target)
            for key in section_keys:
                all_keys.append(key)
                meta[key] = (root_type, section)

        all_keys = _adjust_to_target(all_keys, combined_stats, seg_target)
        out: list[MarketingSegment] = []
        for key in all_keys:
            root_type, section = meta.get(key, ("polska", "unknown"))
            row = combined_stats.get(key) or FolderStats(path=Path(key))
            if row.subtree_media <= 0:
                local = collect_folder_stats(Path(key))
                row = local.get(key, row)
            out.append(
                MarketingSegment(
                    id="",
                    path=key.replace("\\", "/"),
                    root_type=root_type,
                    section=section,
                    label=Path(key).name or section,
                    file_count=row.subtree_media,
                    raster_count=row.subtree_raster,
                )
            )
        return out

    segments = build_for_roots(polska_roots, polska_target) + build_for_roots(legacy_roots, legacy_target)
    segments.sort(key=lambda s: (s.root_type, s.section, s.path))
    for i, seg in enumerate(segments, start=1):
        seg.id = f"seg-{i:03d}"
    return segments


def segment_matches_asset(segment_path: str, asset_path: str) -> bool:
    sp = segment_path.replace("\\", "/").rstrip("/").lower()
    ap = asset_path.replace("\\", "/").lower()
    return ap == sp or ap.startswith(sp + "/")
