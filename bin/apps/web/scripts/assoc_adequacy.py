# -*- coding: utf-8 -*-
"""Adekwatnosc skojarzen branding <-> produkt (OCR + indeks, nie keyword-only).

HARD 2026-08-03 (rev3): adekwatnosc = dopasowanie tresci OCR / nazwy / path do
produktow z file-index (SKU, frazy linii, synonimy). ZAKAZ hardcodowanych list
odrzucajacych tokeny owocow (np. WEAK_FLAVOR_TOKENS + 'porzeczka').
Samotny krotki token jest za slaby - chyba ze OCR / blob jasno opisuje linie
produktu (wielowyrazowa fraza, SKU, albo wiele niezaleznych sygnalow).

rev3: ultra-generyczne frazy kategorii/marki (plant based, vegan, bio, natural,
good calories) NIE moga same dawac 90+ ani bic specyficznej linii produktu.
Wymagaja silniejszego sygnalu (SKU, wielowyrazowa nazwa, path line, token id).
"""
from __future__ import annotations

import re
from typing import Iterable

SKU_RE = re.compile(r"(?:6300|6900)\d{3}(?:\.\d{2})?")
_NON_ALNUM = re.compile(r"[^a-z0-9\s\-]+")
_WS = re.compile(r"\s+")
_LEADING_CAT_NUM = re.compile(r"^\d{1,3}\s+")

# Stopwords / szum - nie sa "banem smaku"; tylko filtr budowania fraz.
_STOP = frozenset(
    {
        "a",
        "an",
        "the",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "for",
        "with",
        "i",
        "z",
        "w",
        "na",
        "do",
        "od",
        "po",
        "ze",
        "za",
        "oraz",
        "mix",
        "g",
        "kg",
        "ml",
        "pc",
        "pcs",
        "szt",
        "pack",
        "jpg",
        "png",
        "pdf",
        "rgb",
        "cmyk",
    }
)

# Tokeny czeste w wielu liniach GC/DK - same nie buduja multi_token match.
_GENERIC_PRODUCT_TOKENS = frozenset(
    {
        "cashews",
        "nerkowiec",
        "nerkowcowy",
        "cake",
        "ciasto",
        "bars",
        "bar",
        "baton",
        "batony",
        "mini",
        "date",
        "dates",
        "pack",
        "protein",
        "proteina",
        "delight",
        "good",
        "calories",
        "dobra",
        "kaloria",
        "plant",
        "based",
        "vegan",
        "bio",
        "natural",
        "organic",
        "raw",
        "bites",
        "sugar",
        "added",
        "balls",  # kategoria GC - sama za slaba bez smaku; "balls plant based" wymaga pary
    }
)

# Ultra-generyczne frazy kategorii / claimow / marki - same NIE daja 90+.
_ULTRA_GENERIC_PHRASES = frozenset(
    {
        "plant based",
        "plantbased",
        "good calories",
        "dobra kaloria",
        "no added sugar",
        "bez cukru",
        "0 cukru",
        "zero cukru",
        "gluten free",
        "bez glutenu",
        "high protein",
        "wysokobialkowe",
        "organic",
        "bio",
        "vegan",
        "natural",
        "naturalne",
        # wspolne korzenie Marketing (2026-08-04: generic_plus_path:01 produkty+karmel)
        "01 produkty",
        "01 products",
        "02 branding",
        "03 plant based",
    }
)

_ULTRA_GENERIC_TOKENS = frozenset(
    {
        "plant",
        "based",
        "vegan",
        "bio",
        "natural",
        "naturalne",
        "organic",
        "good",
        "calories",
        "dobra",
        "kaloria",
        "sugar",
        "added",
        "gluten",
        "free",
        "protein",
        "delight",
        "bites",
        "bars",
        "mini",
        "pack",
        "raw",
        "sztuk",
        "szt",
        # szum sciezki dysku (nie linia produktu)
        "produkty",
        "products",
        "marketing",
        "eksport",
        "polska",
        "folder",
        "projekt",
        "project",
        "wizki",
        "visuals",
    }
)


def _fold(text: str) -> str:
    t = (text or "").lower()
    for a, b in (
        ("ą", "a"),
        ("ć", "c"),
        ("ę", "e"),
        ("ł", "l"),
        ("ń", "n"),
        ("ó", "o"),
        ("ś", "s"),
        ("ź", "z"),
        ("ż", "z"),
        ("ä", "a"),
        ("ö", "o"),
        ("ü", "u"),
        ("ß", "ss"),
    ):
        t = t.replace(a, b)
    return t


def _norm(text: str) -> str:
    t = _fold(text)
    t = t.replace("_", " ").replace("/", " ").replace("\\", " ").replace(".", " ")
    t = _NON_ALNUM.sub(" ", t)
    return _WS.sub(" ", t).strip()


def extract_skus(*parts: str) -> set[str]:
    blob = " ".join(parts)
    out: set[str] = set()
    for m in SKU_RE.findall(blob):
        out.add(m.split(".")[0])
    return out


def _tokens(text: str) -> list[str]:
    return [t for t in _norm(text).split() if len(t) >= 3 and t not in _STOP]


def _is_ultra_generic_phrase(phrase: str) -> bool:
    """True gdy fraza to tylko kategoria/claim/marka - bez sygnalu linii produktu."""
    ph = _norm(phrase)
    ph = _LEADING_CAT_NUM.sub("", ph).strip()
    if not ph or len(ph) < 3:
        return True
    if ph in _ULTRA_GENERIC_PHRASES:
        return True
    # zlaczone plantbased
    compact = ph.replace(" ", "")
    if compact in _ULTRA_GENERIC_PHRASES:
        return True
    toks = [t for t in ph.split() if t and t not in _STOP]
    if not toks:
        return True
    # wszystkie tokeny ultra-generyczne / product-generic
    if all(t in _ULTRA_GENERIC_TOKENS or t in _GENERIC_PRODUCT_TOKENS for t in toks):
        return True
    return False


def _distinctive_tokens(product_id: str, product_name: str) -> list[str]:
    """Tokeny charakterystyczne dla linii (nie kategoria/marka/claim)."""
    out: list[str] = []
    seen: set[str] = set()
    for src in (product_id.replace("-", " "), product_name):
        for t in _tokens(src):
            if t in _STOP or t in _ULTRA_GENERIC_TOKENS or t in _GENERIC_PRODUCT_TOKENS:
                continue
            if len(t) < 4:
                continue
            if t in seen:
                continue
            seen.add(t)
            out.append(t)
    return out


def _phrases_from_product(product_id: str, product_name: str, product_path: str) -> list[str]:
    """Wielowyrazowe / charakterystyczne frazy linii produktu (bez listy owocow)."""
    phrases: list[str] = []
    pid = _norm(product_id.replace("-", " "))
    if pid:
        phrases.append(pid)
    name = _norm(product_name)
    if name:
        phrases.append(name)
        toks = _tokens(name)
        # bigrams / trigrams z nazwy
        for n in (3, 2):
            for i in range(0, max(0, len(toks) - n + 1)):
                phrases.append(" ".join(toks[i : i + n]))
    # segment folderu produktu (ostatnie 2-3 poziomy)
    raw_parts = re.split(r"[\\/]+", product_path or "")
    cat_toks: list[str] = []
    for seg in raw_parts[-4:]:
        sn = _norm(seg)
        sn_bare = _LEADING_CAT_NUM.sub("", sn).strip()
        # HARD 2026-08-04: "01 - PRODUKTY" / "02 - BRANDING" wspolne dla tysiecy
        # assetow - NIE buduj z tego frazy (generic_plus_path false positive).
        if not sn or len(sn) < 6:
            continue
        if _is_ultra_generic_phrase(sn) or _is_ultra_generic_phrase(sn_bare):
            continue
        if sn_bare in ("produkty", "products", "branding", "wizualizacje", "visuals"):
            continue
        phrases.append(sn)
        st = _tokens(sn)
        if len(st) >= 2:
            phrases.append(" ".join(st[:4]))
        # tokeny kategorii z folderow typu "02 - KULKI" (bez ultra-generic)
        for t in st:
            if t in _STOP or t in _ULTRA_GENERIC_TOKENS or t in _GENERIC_PRODUCT_TOKENS:
                continue
            if len(t) >= 4 and t not in cat_toks:
                cat_toks.append(t)
    # Cross: kategoria folderu x smak/nazwa (np. kulki limonka, balls lime)
    flavor = _distinctive_tokens(product_id, product_name)
    for c in cat_toks[:4]:
        for f in flavor[:6]:
            if c == f:
                continue
            phrases.append(f"{c} {f}")
            phrases.append(f"{f} {c}")
    # uniq zachowujac kolejnosc, najdluzsze pierwsze; odfiltruj ultra-generic
    seen: set[str] = set()
    out: list[str] = []
    for p in sorted(phrases, key=lambda x: (-len(x), x)):
        if p in seen or len(p) < 5:
            continue
        if _is_ultra_generic_phrase(p):
            continue
        seen.add(p)
        out.append(p)
    return out


def _synonym_phrases(product_id: str, associations: dict | None) -> list[str]:
    if not associations:
        return []
    block = (associations.get("products") or {}).get(product_id) or {}
    out: list[str] = []
    for key in ("terms", "dishes", "ingredients"):
        for term in block.get(key) or []:
            n = _norm(str(term))
            if n and len(n) >= 4 and not _is_ultra_generic_phrase(n):
                out.append(n)
    return out


def _phrase_non_generic_token_count(phrase: str) -> int:
    return sum(
        1
        for t in _tokens(phrase)
        if t not in _ULTRA_GENERIC_TOKENS and t not in _GENERIC_PRODUCT_TOKENS
    )


def score_product_link(
    *,
    asset_name: str,
    asset_path: str,
    ocr_text: str,
    product_id: str,
    product_name: str,
    product_path: str,
    product_indexes: Iterable[str] | None = None,
    associations: dict | None = None,
) -> tuple[int, str]:
    """Zwraca (score, reason). score < 50 = odrzucic jako nieadekwatne.

    Ranking:
      100 SKU w OCR/nazwie/path assetu zgadza sie z indeksem produktu
       90 mocna fraza linii (2+ tokeny, nie ultra-generic) z nazwy/folderu w OCR
       75 synonim / term z product-associations (wielowyrazowy) w OCR
       70 generyczna kategoria (plant based) + wyrazisty token linii produktu w OCR
       60 kilka niezaleznych tokenow linii (nie pojedynczy samotny token)
       45 jeden mocny token wieloznakowy z id/nazwy (>=6) + drugi sygnal
       38 sama ultra-generyczna fraza kategorii/marki - za malo do top-rank
       25 sam jeden krotki token / szum - za malo (nie ban owocow - brak kontekstu)
    """
    indexes = [str(x).split(".")[0] for x in (product_indexes or []) if x]
    asset_blob = _norm(f"{asset_name} {asset_path} {ocr_text}")
    ocr_blob = _norm(ocr_text)
    name_path_blob = _norm(f"{asset_name} {asset_path}")
    skus = extract_skus(asset_name, asset_path, ocr_text)
    prod_skus = set(indexes) | extract_skus(product_path, product_name)

    if skus & prod_skus:
        return 100, "sku_match"
    # HARD 2026-08-04: plik z innym indeksem (np. 6900001) nie wolno
    # skojarzyc z produktem 6900002 mimo wspolnej frazy "DATESY".
    if skus and prod_skus and not (skus & prod_skus):
        return 10, f"sku_conflict:{','.join(sorted(skus)[:3])}!={','.join(sorted(prod_skus)[:3])}"

    # HARD 2026-08-05: zakaz cross linii kulki <-> baton/minibaton bez SKU/OCR zgodnego
    asset_line = _norm(f"{asset_name} {asset_path}")
    prod_line = _norm(f"{product_id} {product_name} {product_path}")
    asset_is_kulki = any(t in asset_line for t in ("kulki", "balls", "/kulki/", " kulka"))
    asset_is_baton = any(t in asset_line for t in ("baton", "minibaton", "mini-baton", "mini baton"))
    prod_is_kulki = any(t in prod_line for t in ("kulki", "balls", "-balls-", "balls-"))
    prod_is_baton = any(
        t in prod_line for t in ("baton", "minibaton", "mini-baton", "mini baton", "mix-6x-mini")
    )
    if (asset_is_kulki and prod_is_baton and not asset_is_baton) or (
        asset_is_baton and prod_is_kulki and not asset_is_kulki
    ):
        ocr_n = _norm(ocr_text)
        # pozwol tylko gdy OCR jasno wskazuje produkt (SKU juz obsluzone wyzej)
        if not (ocr_n and (product_id.replace("-", " ")[:12] in ocr_n or _norm(product_name)[:16] in ocr_n)):
            return 5, "cross_line_kulki_baton"

    phrases = _phrases_from_product(product_id, product_name, product_path)
    syns = _synonym_phrases(product_id, associations)

    # Preferuj OCR gdy jest; inaczej nazwa/path assetu
    primary = ocr_blob if len(ocr_blob) >= 8 else asset_blob
    secondary = asset_blob

    def _hit(phrase: str, blob: str) -> bool:
        if len(phrase) < 5:
            return False
        return phrase in blob

    # Bonus: charakterystyczne tokeny id produktu (nie generyczne) obecne w OCR
    id_toks = _distinctive_tokens(product_id, product_name)
    # balls jest w _GENERIC_PRODUCT_TOKENS (kategoria), ale dla id *-balls-* / balls-*
    # traktuj "balls"/"kulki" jako sygnal linii gdy w id produktu
    id_raw = _tokens(product_id.replace("-", " "))
    for extra in ("balls", "kulki", "burger", "baton", "batony"):
        if extra in id_raw and extra not in id_toks:
            # burger/balls w ID = sygnal linii przy parze z claimem; nie same
            id_toks.append(extra)
    distinctive_hits = [t for t in id_toks if t in primary or t in name_path_blob]
    brand_boost = 0
    if distinctive_hits:
        brand_boost = min(8, 3 * len(distinctive_hits))
    path_l = _norm(product_path)
    if "good calories" in primary and ("eksport" in path_l or " - gc" in path_l or "/gc/" in path_l.replace(" ", "/")):
        brand_boost += 3
    if "dobra kaloria" in primary and ("polska" in path_l or " - dk" in path_l):
        brand_boost += 3

    strong_hits: list[str] = []
    generic_only_hits: list[str] = []
    for ph in phrases:
        is_multi = " " in ph or len(ph) >= 12
        if not is_multi:
            continue
        if not (_hit(ph, primary) or _hit(ph, secondary)):
            continue
        # frazy z _phrases_from_product juz bez ultra-generic; mimo to licz specificity
        if _phrase_non_generic_token_count(ph) >= 1:
            strong_hits.append(ph)
        else:
            generic_only_hits.append(ph)

    # Takze wykryj ultra-generic claim w OCR vs produkt majacy go w nazwie/path
    # (gdy odfiltrowany z phrases) - tylko jako slab sygnal + distinctive
    prod_blob_for_generic = _norm(f"{product_id.replace('-', ' ')} {product_name} {product_path}")
    for gph in _ULTRA_GENERIC_PHRASES:
        if " " not in gph and len(gph) < 6:
            continue
        if _hit(gph, primary) and gph in prod_blob_for_generic:
            generic_only_hits.append(gph)

    if strong_hits:
        # Preferuj frazy z wieksza liczba tokenow nietypowych / dluzsze
        strong_hits.sort(key=lambda h: (-_phrase_non_generic_token_count(h), -len(h), h))
        ocr_strong = [h for h in strong_hits if ocr_blob and _hit(h, ocr_blob)]
        path_strong = [h for h in strong_hits if not (ocr_blob and _hit(h, ocr_blob))]
        bonus = min(8, max(0, len(ocr_strong) - 1) * 4)
        if ocr_strong:
            return min(99, 90 + bonus + brand_boost), f"ocr_line_phrase:{ocr_strong[0][:40]}"
        return min(95, 85 + brand_boost), f"path_line_phrase:{path_strong[0][:40]}"

    syn_hits = [s for s in syns if (" " in s or len(s) >= 10) and (_hit(s, primary) or _hit(s, secondary))]
    if syn_hits:
        return 75, f"assoc_phrase:{syn_hits[0][:40]}"

    # Generyczna kategoria/claim + wyrazisty token linii produktu w OCR/path assetu
    if generic_only_hits and distinctive_hits:
        # Wymagaj distinctive w OCR (nie tylko w nazwie pliku marketingowego ogolnego)
        ocr_distinct = [t for t in distinctive_hits if ocr_blob and t in ocr_blob]
        asset_distinct = [t for t in distinctive_hits if t in name_path_blob]
        if ocr_distinct:
            return min(78, 70 + brand_boost), f"generic_plus_line:{generic_only_hits[0][:24]}+{ocr_distinct[0]}"
        # Samotny smak (karmel) + wspolny folder Marketing ≠ adekwatnosc linii produktu.
        # Wymagaj >=2 wyrazistych tokenow w nazwie/path assetu (np. datesy+karmel).
        if len(asset_distinct) >= 2 and all(len(t) >= 5 for t in asset_distinct[:2]):
            return (
                min(68, 62 + brand_boost),
                f"generic_plus_path:{generic_only_hits[0][:24]}+{'+'.join(asset_distinct[:2])}",
            )

    if generic_only_hits and not distinctive_hits:
        return 38, f"generic_category_only:{generic_only_hits[0][:40]}"

    # Token overlap: wiele tokenow z id/nazwy produktu (>=3 znakow) obecnych w blob
    prod_toks = set(_tokens(f"{product_id.replace('-', ' ')} {product_name}"))
    # usun bardzo generyczne
    prod_toks = {
        t
        for t in prod_toks
        if t not in {"mix", "mini", "pack", "doy", "gc", "dk"}
        and t not in _GENERIC_PRODUCT_TOKENS
        and t not in _ULTRA_GENERIC_TOKENS
    }
    asset_toks = set(_tokens(primary if primary else secondary))
    shared = sorted(prod_toks & asset_toks, key=len, reverse=True)

    if len(shared) >= 2:
        return 60, f"multi_token:{'+'.join(shared[:3])}"

    if len(shared) == 1 and len(shared[0]) >= 6:
        # jeden dlugi token - wymagaj drugiego sygnalu (SKU partial, brand folder, syn short)
        tok = shared[0]
        extra = False
        if any(s in primary or s in secondary for s in syns if len(s) >= 4):
            extra = True
        if any(idx[-4:] in asset_blob for idx in indexes if len(idx) >= 4):
            extra = True
        # drugi token z path produktu
        path_toks = set(_tokens(product_path)) - {tok} - _ULTRA_GENERIC_TOKENS - _GENERIC_PRODUCT_TOKENS
        if path_toks & asset_toks:
            extra = True
        # kategoria folderu (kulki) + smak w asset name/OCR
        if path_toks & set(_tokens(name_path_blob)):
            extra = True
        if extra:
            return 55, f"token_plus_context:{tok}"
        return 35, f"single_token_insufficient:{tok}"

    if shared:
        return 25, f"weak_single_token:{shared[0]}"

    return 15, "no_signal"


def filter_adequate_product_ids(
    candidates: list[str],
    *,
    asset_name: str,
    asset_path: str,
    ocr_text: str,
    products_by_id: dict,
    min_score: int = 50,
    associations: dict | None = None,
) -> list[str]:
    scored: list[tuple[int, str]] = []
    for pid in candidates:
        p = products_by_id.get(pid) or {}
        score, _reason = score_product_link(
            asset_name=asset_name,
            asset_path=asset_path,
            ocr_text=ocr_text,
            product_id=pid,
            product_name=str(p.get("name") or p.get("display_name") or ""),
            product_path=str(p.get("path") or ""),
            product_indexes=p.get("indexes") or [],
            associations=associations,
        )
        if score >= min_score:
            scored.append((score, pid))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [pid for _s, pid in scored]


def rank_products_from_ocr(
    *,
    ocr_text: str,
    asset_name: str,
    asset_path: str,
    products: list[dict],
    associations: dict | None = None,
    min_score: int = 50,
    limit: int = 8,
) -> list[tuple[str, int, str]]:
    """Skanuje produkty file-index pod OCR (nie tylko kandydatow z nazwy pliku)."""
    out: list[tuple[str, int, str]] = []
    if not (ocr_text or "").strip() and not asset_name:
        return out
    for p in products:
        pid = p.get("id")
        if not pid:
            continue
        score, reason = score_product_link(
            asset_name=asset_name,
            asset_path=asset_path,
            ocr_text=ocr_text,
            product_id=str(pid),
            product_name=str(p.get("name") or p.get("display_name") or ""),
            product_path=str(p.get("path") or ""),
            product_indexes=p.get("indexes") or [],
            associations=associations,
        )
        if score >= min_score:
            out.append((str(pid), score, reason))
    out.sort(key=lambda x: (-x[1], x[0]))
    return out[:limit]
