# -*- coding: utf-8 -*-
"""Jedna reguła wykluczeń: katalogi techniczne, które NIE są materiałami marki.

Używana w jednym miejscu kodu przez: skan `build-branding-index.py` (przycinanie drzewa i `make_asset`),
budowę siatki `build-branding-grid-index.py`, wyszukiwarkę materiałów (`build_search_index`) i
`/branding/live-www-scan` (`branding_asset_routes.py`). Lustro w JS: `isBrandingScopeExcluded`
w `dam-branding.js` (ta sama tabela przypadków: `tests/branding_scope_cases.json`).

Co wypada (reguła po SEGMENTACH ścieżki, nie po podciągu; niezależna od litery dysku, wielkości liter i
rodzaju myślnika w nazwie folderu):
  1. każdy segment `_robocze` (w całym drzewie),
  2. w firmowym drzewie `PREZENTACJE`: pliki-śmieci (`~$*` = blokada otwartej prezentacji PowerPointa, `._*`,
     `Thumbs.db`, `.DS_Store`, `desktop.ini`), które inaczej stałyby się "prezentacją" albo wariantem karty,
  3. w drzewie `PREZENTACJE`: CAŁY folder `— SZABLON AI - skrypt` (program "Stwórz prezentację": WORK z kopiami
     wersji, src, dist, build i logami, `pliki programu`, `skill-prezentacje`, instrukcje i skrypty instalacji to
     pliki programu, nie materiały marki), a także każdy segment `pliki programu` i `skill-prezentacje`
     gdziekolwiek pod PREZENTACJE.

Inne foldery PREZENTACJE (np. materiały produktowe "KULKI z kreatyną\\Elementy") zostają.

Drugie pytanie tej samej warstwy: `is_presentation_tree_path` - czy plik leży w firmowym drzewie prezentacji
`02 - FIRMOWE MATERIAŁY\\PREZENTACJE`. Tylko tam skan bierze też pliki prezentacji (.pptx .ppt .key .odp); karty
Brandingu liczy z nich lustro w JS (`isPresentationTreePath`, tabela `tests/presentation_tree_cases.json`).
"""
from __future__ import annotations

import re
import unicodedata

# Kreski spotykane w nazwie folderu: em dash (U+2014), en dash, minus, łącznik, nierozdzielający łącznik itd.
_DASHES = dict.fromkeys(map(ord, "‐‑‒–—―−"), "-")
_SPLIT = re.compile(r"[\\/]+")
_SZABLON_AI = re.compile(r"^[-\s]*szablon ai[\s-]*skrypt$")

_PROGRAM_DIRS = frozenset({"pliki programu", "skill-prezentacje"})
_COMPANY_DIR = "02 - firmowe materiały"
_PRESENTATIONS_DIR = "prezentacje"
_JUNK_NAMES = frozenset({"thumbs.db", ".ds_store", "desktop.ini"})


def _is_junk_name(seg: str) -> bool:
    return seg.startswith("~$") or seg.startswith("._") or seg in _JUNK_NAMES


def _seg(s: str) -> str:
    s = unicodedata.normalize("NFC", s).translate(_DASHES)
    return re.sub(r"\s+", " ", s).strip().casefold()


def is_excluded_path(path: str | None) -> bool:
    """True, gdy plik albo folder o tej ścieżce leży pod katalogiem technicznym (patrz moduł)."""
    if not path:
        return False
    parts = [_seg(p) for p in _SPLIT.split(str(path)) if p]
    if "_robocze" in parts:
        return True
    if parts and _is_junk_name(parts[-1]) and presentation_tail(path):
        return True  # smieci tylko w firmowym drzewie PREZENTACJE; poza nim zachowanie bez zmian
    try:
        start = parts.index("prezentacje") + 1
    except ValueError:
        return False
    tail = parts[start:]
    for seg in tail:
        if seg in _PROGRAM_DIRS or _SZABLON_AI.match(seg):
            return True
    return False


def presentation_tail(path: str | None) -> list[str] | None:
    """Znormalizowane segmenty pod `02 - FIRMOWE MATERIAŁY\\PREZENTACJE` albo None (plik poza tym drzewem).
    Kotwicą jest PARA segmentów (firmowe materiały + prezentacje), więc `-- ARCHIWUM --\\...\\Prezentacje` zostaje poza
    regułą kart prezentacji; litera dysku, wielkość liter i rodzaj myślnika nie mają znaczenia."""
    if not path:
        return None
    parts = [_seg(p) for p in _SPLIT.split(str(path)) if p]
    for i in range(len(parts) - 1):
        if parts[i] == _COMPANY_DIR and parts[i + 1] == _PRESENTATIONS_DIR:
            return parts[i + 2 :]
    return None


def is_presentation_tree_path(path: str | None) -> bool:
    """True, gdy plik leży w firmowym drzewie PREZENTACJE i nie wypadł z Brandingu (`is_excluded_path`)."""
    tail = presentation_tail(path)
    return bool(tail) and not is_excluded_path(path)


def is_excluded_dir(path) -> bool:
    """Do `scan_walker.walk_files(exclude_dir=...)`: folder wykluczony jest nieodwiedzany i trafia do
    `failed_dirs` ("nie wiemy, co tam jest"), więc istniejące wiersze pod nim NIE dostają znacznika usunięcia."""
    return is_excluded_path(str(path))
