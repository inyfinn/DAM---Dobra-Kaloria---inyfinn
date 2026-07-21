# -*- coding: utf-8 -*-
"""WORKER B: repair PL chrome UTF-8 (latin-1 read -> pairs -> utf-8 write)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"

# Import PAIRS from sibling script
sys.path.insert(0, str(ROOT / "tools"))
from _fix_qmark_chrome_pl import PAIRS  # noqa: E402

EXTRA: list[tuple[str, str]] = [
    ("Odswiez z dysku", "Odśwież z dysku"),
    ("zindeksowac archiwum", "zindeksować archiwum"),
    ("Wyczysc lokalne ustawienia", "Wyczyść lokalne ustawienia"),
    ("2�12", "2×12"),
    ("tag�w", "tagów"),
]

TARGETS = [
    WEB / "visualizations.html",
    WEB / "branding.html",
    WEB / "explorer.html",
    WEB / "dashboard.html",
    WEB / "settings.html",
    WEB / "assets" / "js" / "dam-explorer.js",
]


def read_loose(p: Path) -> str:
    raw = p.read_bytes()
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


def main() -> None:
    pairs = EXTRA + PAIRS
    for p in TARGETS:
        if not p.is_file():
            continue
        text = read_loose(p)
        n = 0
        for old, new in pairs:
            if old in text:
                c = text.count(old)
                text = text.replace(old, new)
                n += c
        if n:
            p.write_bytes(text.encode("utf-8"))
            bad = text.count("Poka?") + text.count("W??cz") + text.count("Wy??cz")
            print(f"{p.name}: {n} repl, bad_q={bad}, fffd={text.count(chr(0xFFFD))}")
        else:
            print(f"{p.name}: skip")


if __name__ == "__main__":
    main()
