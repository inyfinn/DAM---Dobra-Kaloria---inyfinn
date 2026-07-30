#!/usr/bin/env python3
"""Eksport guest-snapshot.json + digest thumbs (Python - bez limitu PS ConvertFrom-Json)."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
WEB_DATA = REPO_ROOT / "apps" / "web" / "data"
VERSION_FILE = REPO_ROOT / "apps" / "web" / "version.json"

STORE_NAMES = (
    "program-instructions",
    "naming-dictionary",
    "product-aliases",
    "thumb-overrides",
    "viz-flags",
    "carrier-types",
)

DIGEST_RE = re.compile(r"^[a-f0-9]{64}\.(avif|jpe?g)$", re.I)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json(path: Path):
    if not path.is_file():
        return None
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return None
    return json.loads(raw)


def app_version() -> str:
    try:
        data = load_json(VERSION_FILE) or {}
        return str(data.get("version") or "")
    except Exception:
        return ""


def copy_digest_thumbs(src: Path, dst: Path) -> int:
    if not src.is_dir():
        return 0
    dst.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in src.iterdir():
        if f.is_file() and DIGEST_RE.match(f.name):
            shutil.copy2(f, dst / f.name)
            n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dest", type=Path, default=WEB_DATA, help="Katalog docelowy (np. W:/web/Panel-DAM/data)")
    ap.add_argument("--skip-thumb-build", action="store_true", help="Nie uruchamiaj dam_build_thumb_cache")
    args = ap.parse_args()

    dest = args.dest.resolve()
    dest.mkdir(parents=True, exist_ok=True)

    if not args.skip_thumb_build:
        import subprocess

        build = REPO_ROOT / "apps" / "desktop" / "scripts" / "dam_build_thumb_cache.py"
        if build.is_file():
            print("[snapshot] sync thumbs + manifest...")
            subprocess.run(
                [sys.executable, str(build), "--migrate-legacy", "--export-guest"],
                cwd=str(REPO_ROOT),
                check=False,
            )

    fi = load_json(WEB_DATA / "file-index.json")
    bi = load_json(WEB_DATA / "branding-index.json")
    manifest = load_json(WEB_DATA / "guest-cache-manifest.json")

    stores = {}
    for name in STORE_NAMES:
        obj = load_json(WEB_DATA / f"{name}.json")
        if obj is not None:
            stores[name] = obj

    snapshot = {
        "version": "1",
        "exported_at": utc_now(),
        "app_version": app_version(),
        "mode": "guest_readonly",
        "note_pl": (
            "Snapshot metadanych + cache PAMIEC-PODRECZNA/thumbs (statyczne data/thumbs/{digest}). "
            "Zrodlo prawdy na zywo: Postgres + dysk Marketing (instalator)."
        ),
        "file_index": fi,
        "branding_index": bi,
        "kv_stores": stores,
        "thumbs_path": "data/thumbs/",
        "thumb_manifest": manifest,
    }

    out_path = dest / "guest-snapshot.json"
    out_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[snapshot] OK: {out_path}")

    src_thumbs = WEB_DATA / "thumbs"
    if dest != WEB_DATA.resolve():
        dst_thumbs = dest / "thumbs"
        n = copy_digest_thumbs(src_thumbs, dst_thumbs)
        print(f"[snapshot] digest thumbs copied: {n} -> {dst_thumbs}")
        mf_src = WEB_DATA / "guest-cache-manifest.json"
        if mf_src.is_file():
            shutil.copy2(mf_src, dest / "guest-cache-manifest.json")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
