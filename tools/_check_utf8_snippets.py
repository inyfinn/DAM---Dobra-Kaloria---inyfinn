# -*- coding: utf-8 -*-
from pathlib import Path

files = [
    Path(__file__).resolve().parents[1] / "apps" / "web" / "visualizations.html",
    Path(__file__).resolve().parents[1] / "apps" / "web" / "branding.html",
]
needles = [
    "Pokaż wszystkie",
    "Filtr języka",
    "Skala kafelków",
    "Włącz:",
    "niemięsa",
    "Shift+Plus",
    "Pokaż wszystko",
    "Wyczyść filtry",
]
for p in files:
    c = p.read_text(encoding="utf-8")
    print("==", p.name)
    for s in needles:
        print(" ", "OK" if s in c else "--", s)
    j = c.find("vizShowAll")
    if j >= 0:
        print("  snippet:", c[j - 80 : j + 60].encode("unicode_escape").decode())
    j2 = c.find("damBrandingSearch")
    if j2 >= 0:
        print("  search:", c[j2 : j2 + 220].encode("unicode_escape").decode())
