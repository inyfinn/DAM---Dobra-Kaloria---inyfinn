# -*- coding: utf-8 -*-
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1] / "apps" / "web"
for p in root.glob("*.html"):
    t = p.read_text(encoding="utf-8")
    t2, n1 = re.subn(r"(dam-grid-reveal\.js\?v=)[^\"']+", r"\g<1>i18nboot20260721e", t)
    t2, n2 = re.subn(r"(dam-app\.css\?v=)[^\"']+", r"\g<1>pagesub20260721b", t2)
    if n1 or n2:
        p.write_bytes(t2.encode("utf-8"))
        print(p.name, n1, n2)
