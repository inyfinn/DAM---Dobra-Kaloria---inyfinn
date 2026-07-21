# -*- coding: utf-8 -*-
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
TOKEN = "gapship20260721a"

HTML_FILES = [
    "visualizations.html",
    "branding.html",
    "explorer.html",
    "dashboard.html",
]

PATTERNS = [
    (r'dam-media-preview\.js\?v=[^"]+', f"dam-media-preview.js?v={TOKEN}"),
    (r'dam-assoc-edit\.js\?v=[^"]+', f"dam-assoc-edit.js?v={TOKEN}"),
    (r'dam-branding\.css\?v=[^"]+', f"dam-branding.css?v={TOKEN}"),
    (r'dam-viz-modal\.css\?v=[^"]+', f"dam-viz-modal.css?v={TOKEN}"),
    (r'dam-viz\.js\?v=[^"]+', f"dam-viz.js?v={TOKEN}"),
    (r'dam-brand\.css\?v=[^"]+', f"dam-brand.css?v={TOKEN}"),
]


def main() -> None:
    for name in HTML_FILES:
        p = WEB / name
        t = p.read_text(encoding="utf-8")
        n = t
        for pat, repl in PATTERNS:
            n = re.sub(pat, repl, n)
        if n != t:
            p.write_bytes(n.encode("utf-8"))
            print("bumped", name)
        else:
            print("no change", name)

    for rel in ("assets/js/dam-media-preview.js", "assets/js/dam-viz.js"):
        p = WEB / rel
        t = p.read_text(encoding="utf-8")
        n = re.sub(r'dam-viz-modal\.css\?v=[^"]+', f"dam-viz-modal.css?v={TOKEN}", t)
        if n != t:
            p.write_bytes(n.encode("utf-8"))
            print("bumped inject", rel)

    for name in HTML_FILES:
        data = (WEB / name).read_bytes()
        poka = "Pokaż".encode("utf-8") in data
        bad = b"Poka? wszystkie" in data or b"W??cz" in data
        print(name, "PokażOK" if poka else "noPokaż", "CORRUPT" if bad else "clean")


if __name__ == "__main__":
    main()
