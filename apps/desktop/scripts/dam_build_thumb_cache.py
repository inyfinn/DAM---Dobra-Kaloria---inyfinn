#!/usr/bin/env python3
"""
Build PAMIEC-PODRECZNA/thumbs from file-index + branding-index.

1. Warm all indexed image paths when Marketing disk is readable (AVIF/JPEG via dam_thumb_cache).
2. Migrate legacy apps/web/data/thumbs/*.jpg into PAMIEC when source path is known.
3. Export guest static cache (data/thumbs digest files + guest-cache-manifest.json).

Usage:
  python apps/desktop/scripts/dam_build_thumb_cache.py
  python apps/desktop/scripts/dam_build_thumb_cache.py --warm --export-guest
  python apps/desktop/scripts/dam_build_thumb_cache.py --migrate-legacy-only
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

DESKTOP_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = DESKTOP_DIR.parent.parent
WEB_DATA = REPO_ROOT / "apps" / "web" / "data"
DEFAULT_FILE_INDEX = WEB_DATA / "file-index.json"
DEFAULT_BRANDING_INDEX = WEB_DATA / "branding-index.json"
DEFAULT_LEGACY_THUMBS = WEB_DATA / "thumbs"
DEFAULT_CACHE_ROOT = REPO_ROOT / "PAMIEC-PODRECZNA" / "thumbs"
DEFAULT_MANIFEST = WEB_DATA / "guest-cache-manifest.json"

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".psd", ".webp", ".gif", ".bmp", ".avif"}

sys.path.insert(0, str(DESKTOP_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    import dam_thumb_cache as thumb_cache
except ImportError:
    thumb_cache = None  # type: ignore

try:
    from dam_warm_inventory import paths_from_branding_index, paths_from_file_index
except ImportError:
    paths_from_branding_index = None  # type: ignore
    paths_from_file_index = None  # type: ignore

try:
    from dam_guest_cache_export import export_guest_cache
except ImportError:
    export_guest_cache = None  # type: ignore


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def norm_key(path: str) -> str:
    return str(path or "").replace("\\", "/").strip().lower()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def collect_index_paths(file_index: Path, branding_index: Path) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    buckets: list[dict[str, set[str]]] = []
    if paths_from_file_index and file_index.is_file():
        buckets.append(paths_from_file_index(file_index))
    if paths_from_branding_index and branding_index.is_file():
        buckets.append(paths_from_branding_index(branding_index))
    for bucket in buckets:
        for variants in bucket.values():
            for p in variants:
                key = norm_key(p)
                if key and key not in seen:
                    seen.add(key)
                    out.append(p)
    out.sort(key=lambda x: norm_key(x))
    return out


def parse_mtime(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        return None
    try:
        if "T" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
        return float(s)
    except (ValueError, TypeError, OSError):
        return None


def walk_viz_paths(obj: Any, out: list[dict]) -> None:
    if isinstance(obj, dict):
        path = obj.get("path")
        if isinstance(path, str) and Path(path).suffix.lower() in IMAGE_EXT:
            out.append(
                {
                    "path": path,
                    "mtime": parse_mtime(obj.get("mtime")),
                    "thumb_url": str(obj.get("thumb_url") or ""),
                }
            )
        for v in obj.values():
            walk_viz_paths(v, out)
    elif isinstance(obj, list):
        for item in obj:
            walk_viz_paths(item, out)


def legacy_thumb_map(file_index: Path) -> dict[str, dict]:
    """Map legacy thumb basename (no query) -> {path, mtime}."""
    if not file_index.is_file():
        return {}
    data = load_json(file_index)
    rows: list[dict] = []
    walk_viz_paths(data, rows)
    out: dict[str, dict] = {}
    for row in rows:
        thumb = row.get("thumb_url") or ""
        if "data/thumbs/" not in thumb:
            continue
        base = thumb.split("data/thumbs/", 1)[-1].split("?", 1)[0].strip()
        if not base:
            continue
        if base not in out:
            out[base] = {"path": row["path"], "mtime": row.get("mtime")}
    return out


def warm_all(paths: list[str], profiles: list[str], verbose: bool) -> dict:
    stats = {"total": len(paths), "built": 0, "cached": 0, "failed": 0, "skipped": 0}
    if thumb_cache is None:
        stats["error"] = "dam_thumb_cache_missing"
        return stats
    t0 = time.time()
    for i, path in enumerate(paths):
        try:
            if not os.path.isfile(path):
                stats["skipped"] += 1
                continue
        except OSError:
            stats["skipped"] += 1
            continue
        for profile in profiles:
            code, _body, _ctype, meta = thumb_cache.get_or_build_thumb(path, profile=profile)
            if code == 200:
                if meta.get("cache_hit"):
                    stats["cached"] += 1
                else:
                    stats["built"] += 1
            else:
                stats["failed"] += 1
        if verbose and (i + 1) % 200 == 0:
            print(f"[warm] {i + 1}/{len(paths)} built={stats['built']} cached={stats['cached']}", file=sys.stderr)
    stats["ms"] = int((time.time() - t0) * 1000)
    return stats


def migrate_legacy_thumbs(
    legacy_dir: Path,
    cache_root: Path,
    file_index: Path,
    profiles: list[str],
    verbose: bool,
) -> dict:
    stats = {"legacy_files": 0, "copied": 0, "skipped": 0, "no_map": 0}
    if not legacy_dir.is_dir():
        return stats
    mapping = legacy_thumb_map(file_index)
    cache_root.mkdir(parents=True, exist_ok=True)
    for fn in sorted(legacy_dir.iterdir()):
        if not fn.is_file():
            continue
        if fn.suffix.lower() not in (".jpg", ".jpeg", ".avif", ".webp"):
            continue
        stats["legacy_files"] += 1
        info = mapping.get(fn.name)
        if not info or not info.get("path"):
            stats["no_map"] += 1
            continue
        src_path = str(info["path"])
        mtime = info.get("mtime")
        for profile in profiles:
            if thumb_cache is None:
                continue
            digest = thumb_cache.digest_for_path(
                src_path,
                profile=profile,
                mtime_override=mtime,
            )
            dest = cache_root / f"{digest}.jpg"
            if dest.is_file() and dest.stat().st_size > 0:
                stats["skipped"] += 1
                continue
            try:
                shutil.copy2(fn, dest)
                stats["copied"] += 1
                if verbose:
                    print(f"[migrate] {fn.name} -> {dest.name}", file=sys.stderr)
            except OSError as exc:
                if verbose:
                    print(f"[warn] migrate copy failed {fn.name}: {exc}", file=sys.stderr)
    return stats


def main() -> int:
    ap = argparse.ArgumentParser(description="DAM: build PAMIEC-PODRECZNA/thumbs + guest export")
    ap.add_argument("--file-index", type=Path, default=DEFAULT_FILE_INDEX)
    ap.add_argument("--branding-index", type=Path, default=DEFAULT_BRANDING_INDEX)
    ap.add_argument("--legacy-thumbs", type=Path, default=DEFAULT_LEGACY_THUMBS)
    ap.add_argument("--cache-root", type=Path, default=DEFAULT_CACHE_ROOT)
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument("--static-thumbs", type=Path, default=DEFAULT_LEGACY_THUMBS)
    ap.add_argument("--profiles", default="grid,card")
    ap.add_argument("--warm", action="store_true", help="Encode thumbs from Marketing source files")
    ap.add_argument("--migrate-legacy", action="store_true", help="Copy legacy data/thumbs into PAMIEC by digest")
    ap.add_argument("--migrate-legacy-only", action="store_true")
    ap.add_argument("--export-guest", action="store_true", help="Copy digest thumbs + write guest-cache-manifest.json")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    profiles = [p.strip().lower() for p in args.profiles.split(",") if p.strip()] or ["grid", "card"]

    if thumb_cache is None:
        print("[error] dam_thumb_cache import failed", file=sys.stderr)
        return 2

    do_warm = args.warm or (not args.migrate_legacy_only and not args.export_guest)
    do_migrate = args.migrate_legacy or args.migrate_legacy_only
    do_export = args.export_guest or (not args.migrate_legacy_only)

    report: dict[str, Any] = {
        "generated_at": utc_now(),
        "cache_root": str(args.cache_root),
    }

    if do_migrate or args.migrate_legacy_only:
        report["migrate"] = migrate_legacy_thumbs(
            args.legacy_thumbs,
            args.cache_root,
            args.file_index,
            profiles,
            args.verbose,
        )
        print(f"[migrate] legacy={report['migrate'].get('legacy_files')} copied={report['migrate'].get('copied')}")

    if do_warm and not args.migrate_legacy_only:
        paths = collect_index_paths(args.file_index, args.branding_index)
        if args.limit > 0:
            paths = paths[: args.limit]
        report["paths_total"] = len(paths)
        report["warm"] = warm_all(paths, profiles, args.verbose)
        print(
            f"[warm] paths={report['paths_total']} built={report['warm'].get('built')} "
            f"cached={report['warm'].get('cached')} failed={report['warm'].get('failed')} "
            f"skipped={report['warm'].get('skipped')}"
        )

    if do_export and export_guest_cache is not None:
        manifest = export_guest_cache(
            file_index=args.file_index,
            branding_index=args.branding_index,
            static_thumbs=args.static_thumbs,
            manifest_path=args.manifest,
            cache_root=args.cache_root,
            profiles=profiles,
            warm=False,
            limit=args.limit,
            verbose=args.verbose,
        )
        st = manifest.get("stats") or {}
        report["export"] = st
        print(
            f"[export] with_thumb={st.get('paths_with_thumb')} copied={st.get('thumbs_copied')} "
            f"missing={st.get('missing')} manifest={args.manifest}"
        )

    save_json(args.cache_root.parent / "thumb-build-report.json", report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
