# -*- coding: utf-8 -*-
"""Worker A cache-bust: viz/modal ownership assets -> compA20260721a."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
TOKEN = "compA20260721a"

HTML_FILES = [
    "visualizations.html",
    "explorer.html",
    "dashboard.html",
]

PATTERNS = [
    (r"dam-viz\.js\?v=[^\"']+", f"dam-viz.js?v={TOKEN}"),
    (r"dam-media-preview\.js\?v=[^\"']+", f"dam-media-preview.js?v={TOKEN}"),
    (r"dam-assoc-edit\.js\?v=[^\"']+", f"dam-assoc-edit.js?v={TOKEN}"),
    (r"dam-viz-modal\.css\?v=[^\"']+", f"dam-viz-modal.css?v={TOKEN}"),
    (r"dam-branding\.css\?v=[^\"']+", f"dam-branding.css?v={TOKEN}"),
]

INJECT_FILES = [
    WEB / "assets/js/dam-viz.js",
    WEB / "assets/js/dam-media-preview.js",
]

DICT = WEB / "data/naming-dictionary.json"


def bump_html() -> None:
    for name in HTML_FILES:
        p = WEB / name
        text = p.read_text(encoding="utf-8")
        new = text
        for pat, repl in PATTERNS:
            new = re.sub(pat, repl, new)
        if new != text:
            p.write_bytes(new.encode("utf-8"))
            print("bumped html", name)


def bump_inject() -> None:
    pat = re.compile(r"dam-viz-modal\.css\?v=[^\"']+")
    repl = f"dam-viz-modal.css?v={TOKEN}"
    for p in INJECT_FILES:
        text = p.read_text(encoding="utf-8")
        new = pat.sub(repl, text)
        if new != text:
            p.write_bytes(new.encode("utf-8"))
            print("bumped inject", p.name)


def fix_naming_dictionary() -> None:
    data = json.loads(DICT.read_text(encoding="utf-8"))
    langs = data.setdefault("languages", {})
    langs["uk"] = "Wielka Brytania"
    if "ua" not in langs:
        langs["ua"] = "Ukraina"
    aliases = data.setdefault("lang_aliases", {})
    aliases["uk"] = "gb"
    aliases["ua"] = "ua"
    DICT.write_bytes(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))
    print("fixed naming-dictionary uk/gb/ua")


def verify_utf8_html() -> None:
    for name in HTML_FILES:
        data = (WEB / name).read_bytes()
        ok = "Pokaż".encode("utf-8") in data
        bad = b"Poka? wszystkie" in data or b"W??cz" in data
        print(name, "PokażOK" if ok else "noPokaż", "CORRUPT" if bad else "clean")


def main() -> None:
    fix_naming_dictionary()
    bump_html()
    bump_inject()
    verify_utf8_html()


if __name__ == "__main__":
    main()
