# -*- coding: utf-8 -*-
"""S19 (user 07.10.2026): w zestawach Dobra Kaloria tryb ciemny = tryb jasny, zmieniaja sie tylko kolory.

Regula stylu DK z warunkiem ':not([data-theme="dark"])' dziala tylko w jasnym. Kazdy odstep, rozmiar,
obrys albo tlo wpisane pod takim selektorem rozjezdza oba motywy: w 2.5.5-2.5.8 bylo ich 547 i tresc
w ciemnym zaczynala sie 12-24 px gdzie indziej niz w jasnym ("ciemny przesuwa sie do gory").
Reguly DK pisz bez warunku motywu, a kolory bierz ze zmiennych --dam-* (dam-theme.js: DK_PACKS / DK_CTRL).
Sam KOLOR pod html[data-dam-style="dk"][data-theme="dark"] jest dozwolony.

Run (z bin/apps/desktop): python -m unittest tests.test_dk_theme_parity
"""
import re
import unittest
from pathlib import Path

CSS = Path(__file__).resolve().parents[2] / "web" / "assets" / "css"
LIGHT_ONLY = ':not([data-theme="dark"])'


class DkThemeParityTests(unittest.TestCase):
    def test_no_light_only_dk_rules(self):
        bad = []
        for name in ("dam-dk-components.css", "dam-theme-dk.css", "dam-tokens.css"):
            text = re.sub(r"/\*.*?\*/", "", (CSS / name).read_text(encoding="utf-8"), flags=re.S)
            for m in re.finditer(r"([^{}]+)\{", text):
                sel = m.group(1)
                if 'data-dam-style="dk"' in sel and LIGHT_ONLY in sel:
                    bad.append(f"{name}: {' '.join(sel.split())[:140]}")
        lista = " | ".join(bad[:20])
        self.assertFalse(
            bad,
            f"{len(bad)} regul DK tylko dla jasnego (S19) - usun warunek motywu, kolor wez ze zmiennej --dam-*: {lista}",
        )


if __name__ == "__main__":
    unittest.main()
