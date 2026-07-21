# -*- coding: utf-8 -*-
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1] / "apps" / "web"
ver = "assocfix20260721h"
repls = [
    (r'dam-assoc-edit\.js\?v=[^\"]+', f"dam-assoc-edit.js?v={ver}"),
    (r'dam-media-preview\.js\?v=[^\"]+', f"dam-media-preview.js?v={ver}"),
    (r'dam-viz\.js\?v=[^\"]+', f"dam-viz.js?v={ver}"),
    (r'dam-branding\.js\?v=[^\"]+', f"dam-branding.js?v={ver}"),
    (r'dam-explorer\.js\?v=[^\"]+', f"dam-explorer.js?v={ver}"),
    (r'dam-i18n\.js\?v=[^\"]+', f"dam-i18n.js?v={ver}"),
    (r'dam-brand\.css\?v=[^\"]+', f"dam-brand.css?v={ver}"),
    (r'dam-branding\.css\?v=[^\"]+', f"dam-branding.css?v={ver}"),
    (r'dam-viz-modal\.css\?v=[^\"]+', f"dam-viz-modal.css?v={ver}"),
]
for name in [
    "dashboard.html",
    "branding.html",
    "explorer.html",
    "visualizations.html",
    "index.html",
    "settings.html",
]:
    p = root / name
    if not p.exists():
        continue
    c = p.read_text(encoding="utf-8")
    c2 = c
    for pat, rep in repls:
        c2 = re.sub(pat, rep, c2)
    if c2 != c:
        p.write_text(c2, encoding="utf-8")
        print(name, "updated")
    else:
        print(name, "no-match-or-same")
print("done", ver)
