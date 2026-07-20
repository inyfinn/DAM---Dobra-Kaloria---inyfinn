# -*- coding: utf-8 -*-
"""Skojarzenia ELEMENTY: skladniki / owoce / owocki (nie tag kanoniczny).

Brief usability 2026-07-20 pkt 35 + handoff A3:
- LINKS produktu (`2 - PROJEKT/Links`) = surowe elementy
- `1 - MATERIALY/ELEMENTY` = gotowe elementy
- Wyszukiwanie brandingu: skojarzenia \"skladniki\" / \"owoce\" / \"owocki\"
  (search_blob), bez nowego facetu globalnego.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any

# Terminy skojarzeniowe (UI: ELEMENT_ASSOC_RE w dam-media-preview.js)
ASSOC_SKLADNIKI = "skladniki"
ASSOC_OWOCE = "owoce"
ASSOC_OWOCKI = "owocki"
ALL_ASSOC_TERMS = (ASSOC_SKLADNIKI, ASSOC_OWOCE, ASSOC_OWOCKI)

# Owoce / owocki (nazwa pliku lub fragment sciezki)
FRUIT_TOKENS: tuple[str, ...] = (
    "owoc",
    "owoce",
    "owock",
    "cytryn",
    "malin",
    "jagod",
    "porzeczk",
    "wisni",
    "wisnia",
    "banan",
    "jablk",
    "jabko",
    "mango",
    "daktyl",
    "dates",
    "rodzyn",
    "zurawin",
    "gruszk",
    "ananas",
    "arbuz",
    "winogron",
    "sliwk",
    "truskawk",
    "brzoskwin",
    "morel",
    "kiwi",
    "pomarancz",
    "grejpfrut",
    "limon",
    "yuzu",
)

# Skladniki nieowocowe (orzechy, ziarna, przyprawy) - tylko skladniki
INGREDIENT_TOKENS: tuple[str, ...] = (
    "skladnik",
    "nerkow",
    "orzech",
    "migdal",
    "kokos",
    "kakao",
    "cynamon",
    "wanili",
    "czekolad",
    "karmel",
    "sezam",
    "siemie",
    "chia",
    "owies",
    "miod",
    "melasa",
    "lisc",
    "liscie",
    "galaz",
    "kwiat",
    "tekstur",
)

_LINKS_PROJ_RE = re.compile(
    r"(?:/|\\)2\s*-\s*projekt(?:/|\\)links(?:/|\\|$)",
    re.IGNORECASE,
)
_LINKS_ANY_RE = re.compile(r"(?:/|\\)links(?:/|\\|$)", re.IGNORECASE)
_ELEMENTY_MAT_RE = re.compile(
    r"(?:/|\\)1\s*-\s*materia[^/\\]*(?:/|\\)elementy?(?:/|\\|$)",
    re.IGNORECASE,
)
_SKLADNIKI_DIR_RE = re.compile(
    r"(?:/|\\)sk[lł]adniki?(?:/|\\|$)",
    re.IGNORECASE,
)
_PRODUCTS_ROOT_RE = re.compile(
    r"(?:/|\\)01\s*-\s*(?:produkty|products)(?:/|\\)",
    re.IGNORECASE,
)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.lower()).strip()


def path_slash(path: str) -> str:
    return (path or "").replace("\\", "/")


def is_under_products_tree(path: str) -> bool:
    return bool(_PRODUCTS_ROOT_RE.search(path_slash(path)))


def is_product_links_path(path: str) -> bool:
    """Surowe Links pod rewizja produktu (2 - PROJEKT/Links)."""
    p = path_slash(path)
    if not is_under_products_tree(p):
        return False
    return bool(_LINKS_PROJ_RE.search(p))


def is_materialy_elementy_path(path: str) -> bool:
    p = path_slash(path)
    if not is_under_products_tree(p):
        return False
    return bool(_ELEMENTY_MAT_RE.search(p))


def is_skladniki_folder_path(path: str) -> bool:
    p = path_slash(path)
    return bool(_SKLADNIKI_DIR_RE.search(p))


def is_product_element_path(path: str) -> bool:
    """Plik z drzewa produktu kwalifikujacy sie do indeksu ELEMENTY."""
    return (
        is_product_links_path(path)
        or is_materialy_elementy_path(path)
        or (is_under_products_tree(path) and is_skladniki_folder_path(path))
    )


def is_any_links_or_elementy_path(path: str) -> bool:
    """Links/ELEMENTY takze poza 01-PRODUKTY (POS, teczki) - do tagowania search_blob."""
    p = path_slash(path)
    if _LINKS_ANY_RE.search(p):
        return True
    if _ELEMENTY_MAT_RE.search(p):
        return True
    if is_skladniki_folder_path(p):
        return True
    return False


def _blob_has_token(blob: str, token: str) -> bool:
    return token in blob


def classify_element_assoc_terms(name: str, path: str) -> list[str]:
    """Zwraca terminy skojarzeniowe do search_blob (bez appearance_tags)."""
    blob = norm(f"{name or ''} {path or ''}")
    if not blob:
        return []

    in_element_slot = is_any_links_or_elementy_path(path) or is_product_element_path(path)
    fruit_hit = any(_blob_has_token(blob, t) for t in FRUIT_TOKENS)
    ing_hit = any(_blob_has_token(blob, t) for t in INGREDIENT_TOKENS)

    if not in_element_slot and not fruit_hit and not ing_hit:
        return []

    terms: list[str] = []
    # Skladniki: slot elementow albo rozpoznany skladnik/owoc
    if in_element_slot or fruit_hit or ing_hit:
        terms.append(ASSOC_SKLADNIKI)
    if fruit_hit:
        terms.append(ASSOC_OWOCE)
        terms.append(ASSOC_OWOCKI)
    return terms


def ensure_assoc_in_search_blob(asset: dict[str, Any], terms: list[str]) -> bool:
    """Dopisz terminy do search_blob. Zwraca True gdy zmieniono."""
    if not terms:
        return False
    blob = norm(asset.get("search_blob") or "")
    name = asset.get("name") or ""
    path = asset.get("path") or ""
    if not blob:
        blob = norm(f"{name} {path}")
    missing = [t for t in terms if t not in blob]
    if not missing:
        return False
    asset["search_blob"] = (blob + " " + " ".join(missing)).strip()
    return True


def enrich_element_associations(assets: list[dict[str, Any]]) -> dict[str, int]:
    """Oznacz assety ELEMENTY termiami skladniki/owoce/owocki w search_blob."""
    stats = {
        "scanned": 0,
        "tagged": 0,
        "product_element_paths": 0,
        "with_owoce": 0,
        "with_skladniki": 0,
    }
    for a in assets:
        stats["scanned"] += 1
        path = a.get("path") or ""
        name = a.get("name") or ""
        if is_product_element_path(path) or (a.get("source") == "product_element"):
            stats["product_element_paths"] += 1
        terms = classify_element_assoc_terms(name, path)
        # Jawny source z indeksera produktu zawsze dostaje skladniki
        if a.get("source") == "product_element" and ASSOC_SKLADNIKI not in terms:
            terms = [ASSOC_SKLADNIKI] + [t for t in terms if t != ASSOC_SKLADNIKI]
        if not terms:
            continue
        if ensure_assoc_in_search_blob(a, terms):
            stats["tagged"] += 1
        blob = norm(a.get("search_blob") or "")
        if ASSOC_OWOCE in blob:
            stats["with_owoce"] += 1
        if ASSOC_SKLADNIKI in blob:
            stats["with_skladniki"] += 1
    return stats
