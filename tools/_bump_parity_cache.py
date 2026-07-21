# -*- coding: utf-8 -*-
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "apps" / "web"
NEW = "parity20260721a"
files = ["explorer.html", "branding.html", "visualizations.html", "dashboard.html"]
for name in files:
    p = ROOT / name
    raw = p.read_bytes()
    t = raw.decode("utf-8", errors="surrogateescape")
    t2 = t.replace("vizmod20260721a", NEW)
    t2 = re.sub(r"dam-branding\.css\?v=[^\"']+", "dam-branding.css?v=" + NEW, t2)
    t2 = re.sub(r"dam-media-preview\.js\?v=[^\"']+", "dam-media-preview.js?v=" + NEW, t2)
    if t2 != t:
        p.write_bytes(t2.encode("utf-8", errors="surrogateescape"))
        print("bumped", name)
    else:
        print("unchanged", name)
