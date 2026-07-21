# -*- coding: utf-8 -*-
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1] / "apps" / "web"
pairs = [
    (r"(dam-shell-boot\.css\?v=)[^\"']+", r"\g<1>shellboot20260721a"),
    (r"(dam-shell\.js\?v=)[^\"']+", r"\g<1>i18nboot20260721d"),
]
for p in root.glob("*.html"):
    t = p.read_text(encoding="utf-8")
    changed = False
    for pat, repl in pairs:
        t2, n = re.subn(pat, repl, t)
        if n:
            t = t2
            changed = True
    if changed:
        p.write_text(t, encoding="utf-8")
        print("ok", p.name)
