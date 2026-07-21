# -*- coding: utf-8 -*-
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "apps" / "web"
NEW = "showall20260721g"
files = ["explorer.html", "branding.html", "visualizations.html", "dashboard.html"]
patterns = [
    (r"dam-brand\.css\?v=[^\"']+", "dam-brand.css?v=" + NEW),
    (r"dam-branding\.css\?v=[^\"']+", "dam-branding.css?v=" + NEW),
    (r"dam-viz-modal\.css\?v=[^\"']+", "dam-viz-modal.css?v=" + NEW),
    (r"dam-media-preview\.js\?v=[^\"']+", "dam-media-preview.js?v=" + NEW),
    (r"dam-viz\.js\?v=[^\"']+", "dam-viz.js?v=" + NEW),
]
for name in files:
    p = ROOT / name
    if not p.exists():
        print("missing", name)
        continue
    raw = p.read_bytes()
    t = raw.decode("utf-8", errors="surrogateescape")
    t2 = t
    for pat, repl in patterns:
        t2 = re.sub(pat, repl, t2)
    if t2 != t:
        p.write_bytes(t2.encode("utf-8", errors="surrogateescape"))
        print("bumped", name)
    else:
        print("unchanged", name)
