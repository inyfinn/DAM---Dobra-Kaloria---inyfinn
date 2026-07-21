# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "apps" / "web" / "branding.html"
c = p.read_text(encoding="utf-8")
# Known corrupted tip near category hint
bad = "Nie widzisz swojego pliku? SprawdĹş, czy masz zaznaczonÄ… dobrÄ… kategoriÄ™. Ewentualnie naciĹ›nij PokaĹĽ wszystko."
good = "Nie widzisz swojego pliku? Sprawdź, czy masz zaznaczoną dobrą kategorię. Ewentualnie naciśnij Pokaż wszystko."
# Also try unicode-escape variants that may already be partially fixed
variants = [
    bad,
    "Nie widzisz swojego pliku? Sprawd\u0139\u0161, czy masz zaznaczon\u00c4\u2026 dobr\u00c4\u2026 kategori\u00c4\u2122. Ewentualnie naci\u0139\u015bnij Poka\u0139\u017d wszystko.",
]
fixed = 0
if bad in c:
    c = c.replace(bad, good)
    fixed += 1
# Broader replace of common mojibake tokens remaining
repls = [
    ("SprawdĹş", "Sprawdź"),
    ("zaznaczonÄ…", "zaznaczoną"),
    ("dobrÄ…", "dobrą"),
    ("kategoriÄ™", "kategorię"),
    ("naciĹ›nij", "naciśnij"),
    ("PokaĹĽ wszystko", "Pokaż wszystko"),
]
for a, b in repls:
    if a in c:
        c = c.replace(a, b)
        fixed += 1
        print("fixed token", a)
p.write_text(c, encoding="utf-8")
print("total fixes", fixed)
