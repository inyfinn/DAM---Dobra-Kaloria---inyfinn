# -*- coding: utf-8 -*-
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1] / "apps" / "web"
for p in root.glob("*.html"):
    t = p.read_text(encoding="utf-8")
    t2, n = re.subn(r"(dam-grid-reveal\.js\?v=)[^\"']+", r"\g<1>i18nboot20260721e", t)
    if n:
        p.write_text(t2, encoding="utf-8")
        print(p.name)
