# -*- coding: utf-8 -*-
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1] / "apps" / "web"
js_files = [
    "dam-media-preview.js",
    "dam-assoc-edit.js",
    "dam-viz.js",
    "dam-branding.js",
]
for js in js_files:
    p = root / "assets" / "js" / js
    if not p.exists():
        print(js, "MISSING")
        continue
    r = subprocess.run(
        ["node", "--check", str(p)],
        capture_output=True,
        text=True,
    )
    print(js, "OK" if r.returncode == 0 else r.stderr)

ver = "assocfix20260721g"
pairs = [
    ("dam-assoc-edit.js", ver),
    ("dam-media-preview.js", ver),
    ("dam-viz.js", ver),
    ("dam-branding.js", ver),
    ("dam-viz-modal.css", "assoccopy20260721b"),
]
for name in ["dashboard.html", "branding.html", "explorer.html", "visualizations.html"]:
    p = root / name
    c = p.read_text(encoding="utf-8")
    c2 = c
    for fname, v in pairs:
        c2 = re.sub(
            re.escape(fname) + r"\?v=[^\"]+",
            fname + "?v=" + v,
            c2,
        )
    p.write_text(c2, encoding="utf-8")
    print(name, "changed" if c2 != c else "same")
