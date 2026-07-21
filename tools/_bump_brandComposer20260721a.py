# -*- coding: utf-8 -*-
"""Unified cache-bust token brandComposer20260721a (UTF-8 write_bytes only)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
TOKEN = "brandComposer20260721a"

HTML_FILES = [
    "visualizations.html",
    "branding.html",
    "explorer.html",
    "dashboard.html",
    "index.html",
]

OLD_TOKENS = (
    "gapship20260721a",
    "minusGlobal20260721a",
    "uiHard20260721j",
    "assocfix20260721h",
    "20260721ukGb1",
)

PATTERNS = [
    (r"dam-media-preview\.js\?v=[^\"']+", f"dam-media-preview.js?v={TOKEN}"),
    (r"dam-assoc-edit\.js\?v=[^\"']+", f"dam-assoc-edit.js?v={TOKEN}"),
    (r"dam-branding\.js\?v=[^\"']+", f"dam-branding.js?v={TOKEN}"),
    (r"dam-branding\.css\?v=[^\"']+", f"dam-branding.css?v={TOKEN}"),
    (r"dam-viz-modal\.css\?v=[^\"']+", f"dam-viz-modal.css?v={TOKEN}"),
    (r"dam-viz\.js\?v=[^\"']+", f"dam-viz.js?v={TOKEN}"),
    (r"dam-brand\.css\?v=[^\"']+", f"dam-brand.css?v={TOKEN}"),
]


def main() -> None:
    for name in HTML_FILES:
        p = WEB / name
        if not p.is_file():
            continue
        t = p.read_text(encoding="utf-8")
        n = t
        for old in OLD_TOKENS:
            n = n.replace(old, TOKEN)
        for pat, repl in PATTERNS:
            n = re.sub(pat, repl, n)
        if n != t:
            p.write_bytes(n.encode("utf-8"))
            print("bumped", name)

    for rel in ("assets/js/dam-media-preview.js", "assets/js/dam-viz.js"):
        p = WEB / rel
        t = p.read_text(encoding="utf-8")
        n = t
        for old in OLD_TOKENS:
            n = n.replace(old, TOKEN)
        n = re.sub(
            r'dam-viz-modal\.css\?v=[^"\']+',
            f"dam-viz-modal.css?v={TOKEN}",
            n,
        )
        if n != t:
            p.write_bytes(n.encode("utf-8"))
            print("bumped inject", rel)

    for name in HTML_FILES:
        data = (WEB / name).read_bytes()
        bad = b"Poka? wszystkie" in data or b"W??cz" in data
        good = b"Poka\xc5\xbc" in data or name == "index.html"
        print(name, "token", TOKEN in data.decode("utf-8", errors="replace"), "utf8", not bad, "polish", good)


if __name__ == "__main__":
    main()
