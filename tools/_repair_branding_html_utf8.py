# -*- coding: utf-8 -*-
"""Restore branding.html UTF-8 from git HEAD and bump brandComposer20260721a."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
TOKEN = "brandComposer20260721a"
HTML = WEB / "branding.html"

# Known-good PL strings for branding chrome (UTF-8).
FIXES: list[tuple[str, str]] = [
    (
        'data-dam-tip="Pokaż liczby dopasowań obok tagów (domyślnie wyłączone)"',
        'data-dam-tip="Pokaż liczby dopasowań obok tagów (domyślnie wyłączone)"',
    ),
]

REPLACEMENTS = [
    ("Poka? liczby dopasowa? obok tagï¿½w (domy?lnie wy??czone)", "Pokaż liczby dopasowań obok tagów (domyślnie wyłączone)"),
    ("PokaÅ¼ wszystko", "Pokaż wszystko"),
    ("PokaÅ¼ archiwum", "Pokaż archiwum"),
    ("Priorytet uÅ¼ycia", "Priorytet użycia"),
    ("Sortowanie wynikï¿½w", "Sortowanie wyników"),
    ("odÅwieÅ¼ branding-index.json", "odśwież branding-index.json"),
    ("grafikÄ w kafelku", "grafikę w kafelku"),
    ("powyÅ¼ej 100% powiÄksza", "powyżej 100% powiększa"),
    ("PodglÄd startuje", "Podgląd startuje"),
    ("Skala kafelkï¿½w branding", "Skala kafelków branding"),
    ("preferencjÄ", "preferencję"),
    ("Åadowanie indeksuâ¦", "Ładowanie indeksu…"),
    ("Wrï¿½? do przegl?dania", "Wróć do przeglądania"),
    ("podpowiedÅº", "podpowiedź"),
    ("SprawdÅº, czy masz zaznaczonÄ dobrÄ kategoriÄ.", "Sprawdź, czy masz zaznaczoną dobrą kategorię."),
    ("naciÅnij PokaÅ¼ wszystko", "naciśnij Pokaż wszystko"),
    ("Poka? wszystko", "Pokaż wszystko"),
    ("W??cz", "Włącz"),
    ("Wy??cz", "Wyłącz"),
]


def main() -> None:
    subprocess.run(["git", "checkout", "HEAD", "--", str(HTML)], cwd=ROOT, check=True)
    text = HTML.read_text(encoding="utf-8")
    for old, new in REPLACEMENTS:
        if old in text:
            text = text.replace(old, new)
    for old in ("gapship20260721a", "minusGlobal20260721a", "uiHard20260721j"):
        text = text.replace(old, TOKEN)
    patterns = [
        r"dam-media-preview\.js\?v=[^\"']+",
        r"dam-assoc-edit\.js\?v=[^\"']+",
        r"dam-branding\.js\?v=[^\"']+",
        r"dam-branding\.css\?v=[^\"']+",
        r"dam-brand\.css\?v=[^\"']+",
    ]
    for pat in patterns:
        text = re.sub(pat, lambda m: m.group(0).split("=")[0] + "=" + TOKEN, text)
    HTML.write_bytes(text.encode("utf-8"))
    data = HTML.read_bytes()
    bad = b"Poka?" in data or b"W??cz" in data or b"\xef\xbf\xbd" in data
    good = b"Poka\xc5\xbc wszystko" in data
    print("branding.html restored+bumped", "good=", good, "bad=", bad, "token=", TOKEN in text)


if __name__ == "__main__":
    main()
