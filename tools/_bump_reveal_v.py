# -*- coding: utf-8 -*-
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1] / "apps" / "web"
pairs = [
    (r"(dam-grid-reveal\.js\?v=)[^\"']+", r"\g<1>i18nboot20260721c"),
    (r"(dam-shell\.js\?v=)[^\"']+", r"\g<1>i18nboot20260721c"),
    (r"(dam-i18n\.js\?v=)[^\"']+", r"\g<1>i18nboot20260721c"),
]
for p in root.glob("*.html"):
    t = p.read_text(encoding="utf-8")
    notes = []
    for pat, repl in pairs:
        t2, n = re.subn(pat, repl, t)
        if n:
            t = t2
            notes.append(str(n))
    if notes:
        p.write_text(t, encoding="utf-8")
        print(p.name, "+".join(notes))
