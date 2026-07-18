# -*- coding: utf-8 -*-
"""Przebuduj miniatury viz wg aktualnego pick_thumb_file (FRONT-S > SKLEP/XL).

Czyta file-index.json, nadpisuje thumbs + viz_latest. Nie skanuje Marketingu od zera.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WEB = ROOT / "apps" / "web"
SCRIPT = Path(__file__).resolve().parent / "build-file-index.py"

_spec = importlib.util.spec_from_file_location("build_file_index", SCRIPT)
_mod = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(_mod)

pick_thumb_file = _mod.pick_thumb_file
write_web_thumb = _mod.write_web_thumb
safe_thumb_stem = _mod.safe_thumb_stem
collect_viz_latest = _mod.collect_viz_latest
THUMBS_DIR = _mod.THUMBS_DIR


def main() -> int:
    fi_path = WEB / "data" / "file-index.json"
    data = json.loads(fi_path.read_text(encoding="utf-8"))
    products = data.get("products") or []
    overrides_path = WEB / "data" / "thumb-overrides.json"
    overrides: dict = {}
    if overrides_path.is_file():
        try:
            overrides = json.loads(overrides_path.read_text(encoding="utf-8")) or {}
        except json.JSONDecodeError:
            overrides = {}

    old_viz = data.get("viz_latest") or []
    forced = 0
    for v in old_viz:
        fn = (v.get("file") or "").upper()
        if "SKLEP" in fn or "-XL" in fn or "_XL" in fn:
            stem = safe_thumb_stem(
                v.get("product_id") or "x",
                v.get("index_base") or "pending",
                v.get("lang") or "pl",
            )
            tp = THUMBS_DIR / stem
            if tp.is_file():
                tp.unlink()
                forced += 1

    viz = collect_viz_latest(products, THUMBS_DIR)

    for v in viz:
        key = v.get("product_id") or ""
        ov = overrides.get(key) if isinstance(overrides, dict) else None
        if not isinstance(ov, dict):
            continue
        src = ov.get("path") or ""
        if not src:
            continue
        sp = Path(src)
        if not sp.is_file():
            continue
        stem = safe_thumb_stem(key, v.get("index_base") or "pending", v.get("lang") or "pl")
        dest = THUMBS_DIR / stem
        try:
            write_web_thumb(sp, dest)
            v["path"] = str(sp).replace("\\", "/")
            v["file"] = sp.name
            v["thumb_url"] = f"data/thumbs/{stem}?v={int(sp.stat().st_mtime)}"
        except OSError as exc:
            print(f"override skip {key}: {exc}")

    data["viz_latest"] = viz
    fi_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    for v in viz:
        if "malina" in (v.get("product_id") or "").lower():
            print("MALINA file=", v.get("file"), "thumb=", v.get("thumb_url"))
            break
    print(f"OK viz={len(viz)} forced_unlink={forced}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
