# -*- coding: utf-8 -*-
"""Uruchamiane bundlowanym Pythonem DAM (bin/runtime/win/python) - ma dekoder AVIF,
ktorego nie ma venv PACKAGING-CHECKER (silnik OCR).

Dla listy assetow: znajdz miniature w PAMIEC-PODRECZNA/thumbs (szybko, bez pelnego
pliku zrodlowego), zdekoduj AVIF->PNG do cache. Brak miniatury (~48% grafik brandingu
- cache jest budowany na biezaco przy przegladaniu, nie z gory dla wszystkiego) =
None, wtedy caller uzywa pelnej sciezki na dysku Marketing.

Wejscie (stdin): JSON [{"id","path"}, ...]
Wyjscie (stdout): JSON {asset_id: png_path_or_null}
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "desktop"))
import dam_thumb_cache as tc  # noqa: E402
from PIL import Image  # noqa: E402

CACHE_DIR = Path(__file__).resolve().parents[2] / "desktop" / "data" / ".ocr-thumb-cache"


def main() -> int:
    items = json.load(sys.stdin)
    thumbs = tc.cache_root() / "thumbs"
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    out: dict[str, str | None] = {}
    for it in items:
        aid, path = str(it["id"]), str(it["path"])
        png_out = CACHE_DIR / f"{aid}.png"
        if png_out.is_file():
            out[aid] = str(png_out)
            continue
        digest = tc.digest_for_path(path, profile="grid")
        src = None
        for ext in ("avif", "jpg", "jpeg"):
            cand = thumbs / f"{digest}.{ext}"
            if cand.is_file():
                src = cand
                break
        if src is None:
            out[aid] = None
            continue
        try:
            with Image.open(src) as im:
                im.convert("RGB").save(png_out, format="PNG")
            out[aid] = str(png_out)
        except Exception:  # noqa: BLE001
            out[aid] = None
    json.dump(out, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
