#!/usr/bin/env python3
"""Eksport statycznego cache miniaturek dla trybu goscia (Panel-DAM / offline).

Czyta sciezki z file-index + branding-index, buduje lub kopiuje miniatury z
PAMIEC-PODRECZNA/thumbs do apps/web/data/thumbs/ i generuje guest-cache-manifest.json.
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
DEFAULT_STATIC_THUMBS = WEB_DATA / "thumbs"
DEFAULT_MANIFEST = WEB_DATA / "guest-cache-manifest.json"
DEFAULT_CACHE_ROOT = REPO_ROOT / "PAMIEC-PODRECZNA" / "thumbs"

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".psd", ".webp", ".gif", ".bmp", ".avif"}

sys.path.insert(0, str(DESKTOP_DIR))

try:
    import dam_thumb_cache as thumb_cache
except ImportError:
    thumb_cache = None  # type: ignore

# Reuse inventory walkers from C-WARM
sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from dam_warm_inventory import (
        build_inventory,
        filter_local_inventory,
        paths_from_branding_index,
        paths_from_file_index,
    )
except ImportError:
    build_inventory = None  # type: ignore
    filter_local_inventory = None  # type: ignore
    paths_from_branding_index = None  # type: ignore
    paths_from_file_index = None  # type: ignore


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def norm_key(path: str) -> str:
    return str(path or "").replace("\\", "/").strip().lower()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def app_version() -> str:
    try:
        vj = load_json(REPO_ROOT / "apps" / "web" / "version.json")
        return str(vj.get("version") or "")
    except Exception:
        return ""


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


def cache_file_for_digest(digest: str, cache_root: Path) -> Optional[Path]:
    avif = cache_root / f"{digest}.avif"
    jpg = cache_root / f"{digest}.jpg"
    if avif.is_file() and avif.stat().st_size > 0:
        return avif
    if jpg.is_file() and jpg.stat().st_size > 0:
        return jpg
    return None


def warm_path(path: str, profile: str) -> tuple[bool, str, str]:
    """Build thumb on disk if source exists. Returns (ok, digest, rel_static_url)."""
    if thumb_cache is None:
        return False, "", ""
    code, _body, _ctype, meta = thumb_cache.get_or_build_thumb(path, profile=profile)
    if code != 200:
        return False, meta.get("digest") or "", ""
    digest = str(meta.get("digest") or "")
    rel_cache = str(meta.get("cache_path") or "")
    if not digest:
        return False, "", ""
    ext = ".avif" if rel_cache.endswith(".avif") else ".jpg"
    return True, digest, f"data/thumbs/{digest}{ext}"


def export_guest_cache(
    *,
    file_index: Path,
    branding_index: Path,
    static_thumbs: Path,
    manifest_path: Path,
    cache_root: Path,
    profiles: list[str],
    warm: bool,
    limit: int,
    verbose: bool,
) -> dict:
    paths = collect_index_paths(file_index, branding_index)
    if limit > 0:
        paths = paths[:limit]

    static_thumbs.mkdir(parents=True, exist_ok=True)
    entries: dict[str, dict[str, str]] = {}
    stats = {
        "paths_total": len(paths),
        "paths_with_thumb": 0,
        "thumbs_copied": 0,
        "thumbs_warmed": 0,
        "missing": 0,
    }
    copied_digests: set[str] = set()

    t0 = time.time()
    for i, path in enumerate(paths):
        key = norm_key(path)
        prof_map: dict[str, str] = {}
        for profile in profiles:
            digest = ""
            static_url = ""
            if warm and thumb_cache is not None:
                ok, digest, static_url = warm_path(path, profile)
                if ok:
                    stats["thumbs_warmed"] += 1
            elif thumb_cache is not None:
                digest = thumb_cache.digest_for_path(path, profile=profile)
                src = cache_file_for_digest(digest, cache_root)
                if src is not None:
                    ext = src.suffix.lower()
                    static_url = f"data/thumbs/{digest}{ext}"
            if not static_url and digest:
                src = cache_file_for_digest(digest, cache_root)
                if src is not None:
                    ext = src.suffix.lower()
                    static_url = f"data/thumbs/{digest}{ext}"

            if static_url and digest:
                dest = static_thumbs / f"{digest}{Path(static_url).suffix}"
                src_file = cache_file_for_digest(digest, cache_root)
                if src_file is not None and digest not in copied_digests:
                    try:
                        shutil.copy2(src_file, dest)
                        copied_digests.add(digest)
                        stats["thumbs_copied"] += 1
                    except OSError as exc:
                        if verbose:
                            print(f"[warn] copy failed {digest}: {exc}", file=sys.stderr)
                elif dest.is_file():
                    copied_digests.add(digest)
                if dest.is_file():
                    prof_map[profile] = static_url

        if prof_map:
            entries[key] = prof_map
            stats["paths_with_thumb"] += 1
        else:
            stats["missing"] += 1

        if verbose and (i + 1) % 500 == 0:
            print(f"[guest-cache] progress {i + 1}/{len(paths)}", file=sys.stderr)

    manifest = {
        "version": "1",
        "generated_at": utc_now(),
        "app_version": app_version(),
        "mode": "guest_static_thumbs",
        "profiles": profiles,
        "base_url": "data/thumbs/",
        "entries": entries,
        "stats": stats,
        "ms": int((time.time() - t0) * 1000),
    }
    save_json(manifest_path, manifest)
    return manifest


def main() -> int:
    ap = argparse.ArgumentParser(description="DAM guest static thumb cache export")
    ap.add_argument("--file-index", type=Path, default=DEFAULT_FILE_INDEX)
    ap.add_argument("--branding-index", type=Path, default=DEFAULT_BRANDING_INDEX)
    ap.add_argument("--static-thumbs", type=Path, default=DEFAULT_STATIC_THUMBS)
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument("--cache-root", type=Path, default=DEFAULT_CACHE_ROOT)
    ap.add_argument("--profiles", default="grid,card")
    ap.add_argument("--warm", action="store_true", help="Build missing thumbs via dam_thumb_cache (needs Marketing)")
    ap.add_argument("--limit", type=int, default=0, help="Max paths (0=all; use e.g. 50 for smoke)")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    profiles = [p.strip().lower() for p in args.profiles.split(",") if p.strip()]
    if not profiles:
        profiles = ["grid", "card"]

    if thumb_cache is None:
        print("[error] dam_thumb_cache import failed", file=sys.stderr)
        return 2

    manifest = export_guest_cache(
        file_index=args.file_index,
        branding_index=args.branding_index,
        static_thumbs=args.static_thumbs,
        manifest_path=args.manifest,
        cache_root=args.cache_root,
        profiles=profiles,
        warm=args.warm,
        limit=args.limit,
        verbose=args.verbose,
    )
    st = manifest.get("stats") or {}
    print(
        f"[guest-cache] paths={st.get('paths_total')} with_thumb={st.get('paths_with_thumb')} "
        f"copied={st.get('thumbs_copied')} warmed={st.get('thumbs_warmed')} missing={st.get('missing')}"
    )
    print(f"[guest-cache] manifest -> {args.manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
