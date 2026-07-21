# -*- coding: utf-8 -*-
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "apps" / "web"
for name in ("inbox.html", "branding.html"):
    p = root / name
    b = p.read_bytes()
    text = b.decode("utf-8", errors="replace")
    print("===", name, "===")
    print("U+FFFD count:", text.count("\ufffd"))
    # subtitle lines
    for line in text.splitlines():
        if "dam-page-sub" in line or "header__subtitle" in line:
            print("LINE:", line.strip()[:220])
            raw = line.encode("utf-8")
            print("has a-ogonek C4 85:", b"\xc4\x85" in raw or "ą" in line)
            print("has l-stroke C5 82:", b"\xc5\x82" in raw or "ł" in line)
            print("has s-acute C5 9B:", b"\xc5\x9b" in raw or "ś" in line)
