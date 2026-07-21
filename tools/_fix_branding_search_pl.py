# -*- coding: utf-8 -*-
"""Fix mojibake in branding.html search placeholder + tip (UTF-8)."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
html = root / "apps" / "web" / "branding.html"
pl = root / "apps" / "web" / "i18n" / "pl.json"

text = html.read_text(encoding="utf-8")
old = (
    'placeholder="Np. burger, grill, proteina, slider niemiÄ™sa, film lato 2026?" '
    'autocomplete="off" aria-label="Szukaj w branding" '
    'data-dam-tip="Szuka po znaczeniu (tagi, skojarzenia produktĂłw, nazwy kampanii) - nie po Ĺ›cieĹĽce folderu"'
)
new = (
    'placeholder="Np. burger, grill, proteina, slider niemięsa, film lato 2026?" '
    'autocomplete="off" aria-label="Szukaj w branding" '
    'data-i18n-placeholder="branding.search_placeholder" '
    'data-i18n-tip="branding.search_tip" '
    'data-dam-tip="Szuka po znaczeniu (tagi, skojarzenia produktów, nazwy kampanii) - nie po ścieżce folderu"'
)
if old not in text:
    # try already-partial
    import re

    text2, n = re.subn(
        r'(id="damBrandingSearch"[^>]*placeholder=")([^"]*)(")',
        r'\1Np. burger, grill, proteina, slider niemięsa, film lato 2026?\3',
        text,
        count=1,
    )
    text3, n2 = re.subn(
        r'(id="damBrandingSearch"[^>]*data-dam-tip=")([^"]*)(")',
        r'\1Szuka po znaczeniu (tagi, skojarzenia produktów, nazwy kampanii) - nie po ścieżce folderu\3',
        text2,
        count=1,
    )
    if 'data-i18n-placeholder="branding.search_placeholder"' not in text3:
        text3 = text3.replace(
            'id="damBrandingSearch"',
            'id="damBrandingSearch" data-i18n-placeholder="branding.search_placeholder" data-i18n-tip="branding.search_tip"',
            1,
        )
    html.write_text(text3, encoding="utf-8")
    print("branding.html patched via regex", n, n2)
else:
    html.write_text(text.replace(old, new), encoding="utf-8")
    print("branding.html patched verbatim")

# i18n keys
import json

data = json.loads(pl.read_text(encoding="utf-8"))
data["branding.search_placeholder"] = "Np. burger, grill, proteina, slider niemięsa, film lato 2026?"
data["branding.search_tip"] = (
    "Szuka po znaczeniu (tagi, skojarzenia produktów, nazwy kampanii) - nie po ścieżce folderu"
)
pl.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("pl.json keys ok")
