# -*- coding: utf-8 -*-
"""Scan web UI for U+FFFD; exit 1 if found in panel HTML/JS/i18n."""
from __future__ import annotations

import sys
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
SCAN = [
    WEB / "visualizations.html",
    WEB / "explorer.html",
    WEB / "branding.html",
    WEB / "dashboard.html",
    WEB / "index.html",
    WEB / "i18n" / "pl.json",
    WEB / "assets" / "js" / "dam-i18n.js",
]
SKIP_VENDOR = True


def main() -> int:
    bad = []
    for p in SCAN:
        if not p.is_file():
            continue
        raw = p.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf"):
            raw = raw[3:]
        text = raw.decode("utf-8").rstrip("\x00")
        n = text.count("\ufffd")
        if n:
            bad.append((str(p.relative_to(WEB)), n))
    if bad:
        for rel, n in bad:
            print(f"U+FFFD x{n}: {rel}")
        return 1
    print("scan-utf8-mojibake: OK (no U+FFFD in panel sources)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
