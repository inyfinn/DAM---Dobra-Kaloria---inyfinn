# -*- coding: utf-8 -*-
"""Bulk-replace leftover Geex English chrome with Polish defaults in HTML."""
from pathlib import Path
import re

web = Path(r"P:/DAM/apps/web")
replacements = [
    (r">Customizer<", ">Dostosuj wyglad<"),
    (r">Layout Types<", ">Kierunek tekstu<"),
    (r">Mode Type<", ">Motyw<"),
    (r">Navbar Type<", ">Nawigacja<"),
    (r'placeholder="Search"', 'placeholder="Szukaj..."'),
    (r">Profile<", ">Profil<"),
    (r">Settings<", ">Ustawienia<"),
    (r">Billing<", ">Rozliczenia<"),
    (r">Activity<", ">Aktywnosc<"),
    (r">Help<", ">Pomoc<"),
    (r">Logout<", ">Wyloguj<"),
    (r">Edit<", ">Edytuj<"),
    (r">Delete<", ">Usun<"),
    (r"© 2024 All Rights Reserved", "© 2026 ETA Innovations"),
    (r"uil-arrow-up-left\"></i>Logout", 'uil-arrow-up-left"></i>Wyloguj'),
]

for p in web.glob("*.html"):
    html = p.read_text(encoding="utf-8")
    orig = html
    for a, b in replacements:
        html = re.sub(a, b, html)
    # bump dam-shell cache
    html = re.sub(r"dam-shell\.js\?v=[^\"]+", "dam-shell.js?v=20260717pl", html)
    html = re.sub(r'src="\./assets/js/dam-shell\.js"', 'src="./assets/js/dam-shell.js?v=20260717pl"', html)
    if html != orig:
        p.write_text(html, encoding="utf-8")
        print("updated", p.name)
    else:
        print("skip", p.name)
print("done")
