# -*- coding: utf-8 -*-
"""Kontekst folderu branding: warianty, edytowalny, archiwum, produkty z tekstu."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from brand_tag_utils import (
    merge_tags,
    norm,
    parse_dimensions,
    slider_device_from_size,
    title_tag,
)

LEGACY_ARCHIVE_MARKER = "-- archiwum --"
EDITABLE_EXT = {".psd", ".psb", ".ai", ".eps", ".indd", ".xd", ".fig"}
RASTER_PREVIEW_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff", ".bmp"}

# Stara struktura Marketing (-- ARCHIWUM -- u root) -> tagi skojarzeniowe
LEGACY_FOLDER_TAGS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("01_opakowania", ("Opakowania",)),
    ("02_materialy marketingowe", ("Materiały marketingowe",)),
    ("03_materialy graficzne", ("Materiały graficzne",)),
    ("04_dokumenty", ("Dokumenty",)),
    ("05_materialy graficzne e-commerce", ("E-commerce", "Na sklep")),
    ("05_materialy graficzne e commerce", ("E-commerce", "Na sklep")),
    ("06_materialy firmowe", ("Materiały firmowe",)),
    ("07_kampanie", ("Kampanie",)),
    ("08_procesy", ("Procesy",)),
    ("09 przepisy", ("Przepisy",)),
    ("10 strona www", ("Strony WWW", "Na sklep")),
    ("99_inne", ("Inne",)),
    ("wymiana", ("Wymiana",)),
)

THEME_VOCAB: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("szkoła", ("back to school", "back-to-school", "dobrystart", "dobry start", "szkola")),
    ("nowy rok", ("postanowienia", "noworoczne", "nowy rok", "sylwester")),
    ("lato", ("lato 202", "wakacje", "summer")),
    ("święta", ("swieta", "boze narodzenie", "mikolaj", "choinka", "swietuj z nami")),
    ("wielkanoc", ("wielkanoc", "wielkanocn", "zdrowych swiat", "wielkanoc 202")),
)

DIM_SUFFIX_RE = re.compile(
    r"\s*[-–—]?\s*(\d{3,4}\s*[x×]\s*\d{3,4})\s*[_\.]?\s*$",
    re.IGNORECASE,
)
DEVICE_WORD_RE = re.compile(r"\b(desktop|tablet|mobile)\b", re.IGNORECASE)


def is_legacy_marketing_archive(path: str) -> bool:
    up = path.replace("\\", "/").upper()
    return "/-- ARCHIWUM --/" in up or up.startswith("X:/MARKETING/-- ARCHIWUM --/")


def extract_legacy_archive_tags(path: str) -> list[str]:
    if not is_legacy_marketing_archive(path):
        return []
    tags = ["Archiwum", "Stara struktura"]
    parts = [norm(p) for p in path.replace("\\", "/").split("/") if p]
    for part in parts:
        for marker, labels in LEGACY_FOLDER_TAGS:
            if marker in part:
                tags.extend(labels)
    return tags


def extract_theme_tags(text: str) -> list[str]:
    n = norm(text)
    if not n:
        return []
    found: list[str] = []
    seen: set[str] = set()
    for label, patterns in THEME_VOCAB:
        key = norm(label)
        if key in seen:
            continue
        for pat in patterns:
            if norm(pat) in n:
                found.append(title_tag(label))
                seen.add(key)
                break
    return found


SLIDER_DEVICE_INLINE_RE = re.compile(
    r"\s*[-–—]\s*slider\s*[-–—]\s*(desktop|tablet|mobile)\b",
    re.IGNORECASE,
)
VARIANT_PAREN_INDEX_RE = re.compile(r"\s*\(\d+\)\s*$")
VARIANT_TRAILING_INDEX_RE = re.compile(r"[\s_-]+\d+$")


def variant_stem(name: str) -> str:
    stem = Path(name).stem
    stem = DIM_SUFFIX_RE.sub("", stem).strip()
    stem = SLIDER_DEVICE_INLINE_RE.sub("", stem).strip()
    stem = re.sub(r"\s*[-–—]\s*(desktop|tablet|mobile)\s*$", "", stem, flags=re.IGNORECASE).strip()
    stem = VARIANT_PAREN_INDEX_RE.sub("", stem).strip()
    stem = VARIANT_TRAILING_INDEX_RE.sub("", stem).strip()
    stem = re.sub(r"\s*[-–—]\s*\d+\s*$", "", stem).strip()
    stem = re.sub(r"\s+slider\s*$", "", stem, flags=re.IGNORECASE).strip()
    stem = re.sub(r"\s*[-–—]\s*slider\s*$", "", stem, flags=re.IGNORECASE).strip()
    return stem.strip(" -–—")


def variant_device_label(name: str, dims_field: str = "") -> str:
    stem = Path(name or "").stem
    paren = re.search(r"\((\d+)\)\s*$", stem)
    if paren:
        slot = int(paren.group(1))
        if slot == 1:
            return "Desktop"
        if slot == 2:
            return "Tablet"
        if slot == 3:
            return "Mobile"
        return f"Wariant {slot}"
    wh = parse_dimensions(dims_field) or parse_dimensions(name)
    if wh:
        device = slider_device_from_size(wh[0], wh[1])
        if device:
            return device
    m = DEVICE_WORD_RE.search(name or "")
    if m:
        return title_tag(m.group(1))
    if wh:
        w, h = wh
        if h == 600:
            if w >= 1800:
                return "Desktop"
            if w >= 900:
                return "Tablet"
            if w <= 600:
                return "Mobile"
        return f"{w}×{h}"
    ext = Path(name).suffix.lower()
    if ext in EDITABLE_EXT:
        return "Źródło"
    return "Plik"


def folder_campaign_key(path: str) -> str:
    p = (path or "").replace("\\", "/").rstrip("/")
    if not p:
        return ""
    return norm(p.rsplit("/", 1)[-1])


MERGE_EXCLUDE_MARKERS = (
    "/gotowe",
    "/99_inne",
    "/wymiana/",
    "grafiki pojedynczych produkt",
    "grafiki_flagi",
    "pack-short",
    "en_plant-based",
    "en_bars_date",
    "social-media-icons",
)

CAMPAIGN_FOLDER_MARKERS = (
    "slidery",
    "slider",
    "baner",
    "banner",
    "kampan",
    "08 - kampanie",
    "08 - kamapanie",
    "06 - strony www",
    "02 - slidery",
    "05 - social",
    "07 - e-commerce",
    "03 - materialy graficzne",
    "02 - firmowe",
    "04 - procesy",
    "09 przepisy",
    "05_materialy graficzne e-commerce",
    "06_materialy firmowe",
    "03_materialy graficzne",
    "07_kampanie",
    "10 strona www",
    "grafiki do zestaw",
    "back to school",
    "postanowienia",
    "newsletter",
    "reels",
    "story",
    "facebook",
    "instagram",
)


def _raster_names_from_group(group: list[dict[str, Any]]) -> list[str]:
    names: list[str] = []
    for a in group:
        name = a.get("name") or ""
        ext = Path(name).suffix.lower()
        if ext in RASTER_PREVIEW_EXT or ext in {".mp4", ".mov", ".webm"}:
            names.append(name)
    return names


def looks_like_device_variant_set(names: list[str]) -> bool:
    labels: set[str] = set()
    for name in names:
        label = variant_device_label(name)
        if label in ("Desktop", "Tablet", "Mobile"):
            labels.add(label)
    return len(labels) >= 2


def looks_like_single_stem_variants(names: list[str]) -> bool:
    if len(names) < 2:
        return False
    stems = {norm(variant_stem(n)) for n in names if n}
    if len(stems) != 1:
        return False
    only = next(iter(stems))
    return bool(only) and not _is_noise_stem(only)


def should_merge_folder_rasters(
    path: str,
    raster_count: int,
    raster_names: list[str] | None = None,
) -> bool:
    if raster_count < 2:
        return False
    pu = (path or "").replace("\\", "/").upper()
    pn = norm(path or "")
    names = raster_names or []

    excluded = any(m in pu or m in pn for m in MERGE_EXCLUDE_MARKERS)
    if excluded:
        if names and looks_like_device_variant_set(names) and raster_count <= 6:
            return True
        if names and looks_like_single_stem_variants(names) and raster_count <= 4:
            return True
        return False

    if any(m in pu or m in pn for m in CAMPAIGN_FOLDER_MARKERS):
        return raster_count <= 12

    if names:
        if looks_like_device_variant_set(names) and raster_count <= 8:
            return True
        if looks_like_single_stem_variants(names) and raster_count <= 8:
            return True

    return False


def build_folder_stems(group: list[dict[str, Any]], dir_key: str) -> dict[str, list[dict[str, Any]]]:
    """Grupuje rastery w folderze; przy roznych stemach scala pliki kampanii w jeden zestaw."""
    stems: dict[str, list[dict[str, Any]]] = {}
    raster_assets: list[dict[str, Any]] = []
    for a in group:
        name = a.get("name") or ""
        ext = Path(name).suffix.lower()
        if ext not in RASTER_PREVIEW_EXT and ext not in {".mp4", ".mov", ".webm"}:
            continue
        raster_assets.append(a)
        stems.setdefault(norm(variant_stem(name)), []).append(a)

    raster_names = [a.get("name") or "" for a in raster_assets]
    if should_merge_folder_rasters(
        group[0].get("path") or dir_key,
        len(raster_assets),
        raster_names,
    ):
        stem_keys = list(stems.keys())
        if len(stem_keys) > 1:
            merge_key = folder_campaign_key(group[0].get("path") or dir_key) or stem_keys[0]
            return {merge_key: raster_assets}
    return stems


FOLDER_PRODUCT_HINTS: dict[str, list[str]] = {
    "back to school": ["orzech-czekolada-daktylowy", "chrupiacy-orzech-daktylowy"],
    "postanowienia": ["mix-6x-mini-batoniki-mixy"],
    "postanowienia noworoczne": ["mix-6x-mini-batoniki-mixy"],
    "swietuj z nami": ["nuggets-niemiesne"],
    "i miejsce": ["nuggets-niemiesne"],
    "a moze deserek": [
        "tarta-malinowa-nerkowcowy",
        "muffin-jagodowy-nerkowcowy",
        "sernik-waniliowy-nerkowcowy",
        "daktyl-wisnia-raw",
        "jab-ko-cynamon-daktylowy",
    ],
    "banoffee": ["banoffee-kakao-deserowe"],
    "tiramisu": ["tiramisu-czekolada-kakao-deserowe"],
    "falafel": ["falafel-niemiesne"],
    "rogal poznanski": ["rogal-poznanski-nerkowcowy"],
    "babka cytrynowa": ["babka-cytrynowa-nerkowcowy"],
    "kielbaski wegierskie": ["kielbaska-wegierska-niemiesne"],
    "kielbaska-wegierska": ["kielbaska-wegierska-niemiesne"],
    "kielbaski": ["kielbaska-wegierska-niemiesne", "kielbaska-klasyczna-niemiesne"],
    "rolada i parowki": ["parowka-roslinna-niemiesne", "roladka-wo-owa-niemiesne"],
    "rolada": ["parowka-roslinna-niemiesne", "roladka-wo-owa-niemiesne"],
    "parowki": ["parowka-roslinna-niemiesne"],
    "grill-dostawa": ["kielbasa-grill-niemiesne", "mix-na-grill-slaska-kaszanka-niemiesne"],
    "slidery-dostawa-grill": ["kielbasa-grill-niemiesne", "mix-na-grill-slaska-kaszanka-niemiesne"],
    "promocja niemiesa": ["falafel-niemiesne", "nuggets-niemiesne", "burger-klasyczny-niemiesne"],
    "dzien bez miesa": ["falafel-niemiesne", "burger-klasyczny-niemiesne", "nuggets-niemiesne"],
    "swieta 2025": ["mix-tuba-30-szt-xmas-mixy", "mix-kalendarz-adwentowy-mixy"],
    "super prezent": ["mix-6x-mini-batoniki-mixy", "mix-zestaw-makowiec-x-rogal-x-piernik-mixy"],
    "ksiazka": ["mix-6x-mini-batoniki-mixy"],
    "do zadan specjalnych": ["mix-6x-mini-batoniki-mixy"],
    "black friday": ["mix-6x-mini-batoniki-mixy"],
    "sprobuj naszych nowosci": ["falafel-niemiesne", "nuggets-niemiesne", "rogal-poznanski-nerkowcowy"],
    "chipotle": ["kielbaska-chipotle-cheddar-niemiesne"],
    "kaszanka": ["mix-na-grill-slaska-kaszanka-niemiesne"],
    "hot dogi z wegierskiej": ["kielbaska-wegierska-niemiesne"],
    "dpd pickup": ["mix-6x-mini-batoniki-mixy"],
    "dpd pick up": ["mix-6x-mini-batoniki-mixy"],
    "zdrowych swiat": ["mix-6x-mini-batoniki-mixy"],
    "wielkanoc 202": ["mix-6x-mini-batoniki-mixy"],
    "swiateczne pysz": ["mix-6x-mini-batoniki-mixy"],
    "pysznosci wysylka": ["mix-6x-mini-batoniki-mixy"],
    "paczek rozany": ["paczek-rozany-nerkowcowy", "mix-6x-mini-batoniki-mixy"],
    "czarna porzeczka": ["ciasto-porzeczkowe-nerkowcowy", "mix-6x-mini-batoniki-mixy"],
    "mini batoniki": ["mix-6x-mini-batoniki-mixy"],
    "mini baton": ["mix-6x-mini-batoniki-mixy"],
}

DATE_PRODUCT_RE = re.compile(r"\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}")
YEAR_STEM_RE = re.compile(r"^20\d{2}$")
MAX_FOLDER_PRODUCTS = 8


def _is_noise_stem(stem: str) -> bool:
    if not stem:
        return True
    if stem.isdigit():
        return True
    if YEAR_STEM_RE.fullmatch(stem):
        return True
    if re.fullmatch(r"\d{3,4}", stem):
        return True
    return False


def _is_revision_product(pid: str, display: str = "") -> bool:
    if DATE_PRODUCT_RE.search(pid or ""):
        return True
    if re.search(r"\d{4}\s*0{2,3}\b", display or ""):
        return True
    return False


ASSOC_SKIP_TOKENS = frozenset(
    {
        "niemiesne",
        "mixy",
        "deserowe",
        "nerkowcowy",
        "plant",
        "based",
        "roslinna",
        "funkcjonalny",
        "proteinowy",
        "sniadaniowe",
        "sniadanie",
    }
)


def folder_product_hints(path: str) -> list[str]:
    blob = norm(path or "")
    found: list[str] = []
    seen: set[str] = set()
    for key, pids in sorted(FOLDER_PRODUCT_HINTS.items(), key=lambda x: len(x[0]), reverse=True):
        if key in blob:
            for pid in pids:
                if pid not in seen:
                    seen.add(pid)
                    found.append(pid)
    return found


def stem_key(word: str) -> str:
    w = norm(word)
    if len(w) >= 8:
        return w[:7]
    if len(w) >= 5:
        return w[:5]
    return w


def _association_file() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "product-associations.json"


def load_association_reverse() -> dict[str, list[str]]:
    path = _association_file()
    if not path.is_file():
        return {}
    import json

    assoc = json.loads(path.read_text(encoding="utf-8"))
    rev: dict[str, list[str]] = {norm(k): list(v) for k, v in (assoc.get("reverse") or {}).items() if k}
    for pid, block in (assoc.get("products") or {}).items():
        if not isinstance(block, dict):
            continue
        for key in ("terms", "dishes", "ingredients"):
            for term in block.get(key) or []:
                t = norm(term)
                if not t:
                    continue
                rev.setdefault(t, [])
                if pid not in rev[t]:
                    rev[t].append(pid)
    return {k: sorted(set(v)) for k, v in rev.items()}


_ASSOC_REVERSE_CACHE: dict[str, list[str]] | None = None


def cached_association_reverse() -> dict[str, list[str]]:
    global _ASSOC_REVERSE_CACHE
    if _ASSOC_REVERSE_CACHE is None:
        _ASSOC_REVERSE_CACHE = load_association_reverse()
    return _ASSOC_REVERSE_CACHE


def match_products_by_associations(text: str) -> list[str]:
    n = norm(text)
    if not n:
        return []
    rev = cached_association_reverse()
    matched: list[str] = []
    seen: set[str] = set()
    for term, pids in sorted(rev.items(), key=lambda x: len(x[0]), reverse=True):
        if len(term) < 4:
            continue
        if term in n:
            for pid in pids:
                if pid not in seen:
                    seen.add(pid)
                    matched.append(pid)
    return matched


def build_product_stem_index(file_index: dict) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    seen_pairs: set[tuple[str, str]] = set()
    products_by_id = {p.get("id"): p for p in file_index.get("products") or [] if p.get("id")}
    for p in file_index.get("products") or []:
        pid = p.get("id")
        if not pid or _is_revision_product(pid, p.get("display_name") or p.get("name") or ""):
            continue
        tokens: set[str] = set()
        for part in pid.split("-"):
            if len(part) >= 4 and part not in ASSOC_SKIP_TOKENS:
                tokens.add(stem_key(part))
        display = norm((p.get("display_name") or p.get("name") or "").split("—")[0].split("[")[0])
        for word in re.findall(r"[a-z0-9]{4,}", display):
            if word not in ASSOC_SKIP_TOKENS:
                tokens.add(stem_key(word))
        folder = norm((p.get("path") or "").replace("\\", "/").split("/")[-1].split("—")[0])
        for word in re.findall(r"[a-z0-9]{4,}", folder):
            if word not in ASSOC_SKIP_TOKENS:
                tokens.add(stem_key(word))
        for tok in tokens:
            if _is_noise_stem(tok):
                continue
            pair = (tok, pid)
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                rows.append(pair)
    rows.sort(key=lambda x: len(x[0]), reverse=True)
    return rows


_PRODUCT_STEM_CACHE: dict[int, list[tuple[str, str]]] = {}


def cached_product_stem_index(file_index: dict) -> list[tuple[str, str]]:
    key = id(file_index)
    if key not in _PRODUCT_STEM_CACHE:
        _PRODUCT_STEM_CACHE[key] = build_product_stem_index(file_index)
    return _PRODUCT_STEM_CACHE[key]


def match_products_by_stems(text: str, file_index: dict) -> list[str]:
    n = norm(text)
    if not n:
        return []
    blob_stems = {stem_key(w) for w in re.findall(r"[a-z0-9]{4,}", n) if not _is_noise_stem(stem_key(w))}
    matched: list[str] = []
    seen: set[str] = set()
    for stem, pid in cached_product_stem_index(file_index):
        if len(stem) < 6:
            continue
        if stem in blob_stems and pid not in seen:
            seen.add(pid)
            matched.append(pid)
    return matched


def resolve_folder_products(folder_blob: str, path: str, file_index: dict) -> list[str]:
    """Laczy wszystkie strategie dopasowania produktow dla folderu kampanii."""
    found: list[str] = []
    seen: set[str] = set()
    products_by_id = {p.get("id"): p for p in file_index.get("products") or [] if p.get("id")}

    def add(pid: str) -> None:
        if not pid or pid in seen:
            return
        prod = products_by_id.get(pid) or {}
        display = prod.get("display_name") or prod.get("name") or ""
        if _is_revision_product(pid, display):
            return
        seen.add(pid)
        found.append(pid)

    hint_ids = folder_product_hints(path)
    if hint_ids:
        for pid in hint_ids:
            add(pid)
        return found[:MAX_FOLDER_PRODUCTS]

    for pid in match_products_by_associations(folder_blob):
        add(pid)
    for pid in match_products_by_display_names(folder_blob, file_index):
        add(pid)
    for pid in match_products_by_stems(folder_blob, file_index):
        add(pid)
        if len(found) >= MAX_FOLDER_PRODUCTS:
            break
    return found[:MAX_FOLDER_PRODUCTS]


def _sanitize_product_id(pid: str, file_index: dict) -> bool:
    if not pid:
        return False
    prod = next((p for p in file_index.get("products") or [] if p.get("id") == pid), None)
    display = (prod or {}).get("display_name") or (prod or {}).get("name") or ""
    return not _is_revision_product(pid, display)


def _filter_product_ids(product_ids: list[str], file_index: dict) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for pid in product_ids:
        if pid in seen or not _sanitize_product_id(pid, file_index):
            continue
        seen.add(pid)
        out.append(pid)
    return out


def folder_dir(path: str) -> str:
    p = (path or "").replace("\\", "/")
    if "/" not in p:
        return p
    return p.rsplit("/", 1)[0]


def build_product_name_index(file_index: dict) -> list[tuple[str, str, str]]:
    """(normalized phrase, product_id, display_name) posortowane po dlugosci frazy malejaco."""
    rows: list[tuple[str, str, str]] = []
    for p in file_index.get("products") or []:
        pid = p.get("id")
        if not pid:
            continue
        display = (p.get("display_name") or p.get("name") or "").strip()
        if not display:
            continue
        phrase = norm(display.split("—")[0].split("[")[0])
        if len(phrase) < 6:
            continue
        rows.append((phrase, pid, display))
        folder = (p.get("path") or "").replace("\\", "/").split("/")[-1]
        folder_phrase = norm(folder.split("—")[0].split("[")[0])
        if len(folder_phrase) >= 6 and folder_phrase != phrase:
            rows.append((folder_phrase, pid, display))
    rows.sort(key=lambda x: len(x[0]), reverse=True)
    return rows


_PRODUCT_NAME_CACHE: dict[int, list[tuple[str, str, str]]] = {}


def cached_product_name_index(file_index: dict) -> list[tuple[str, str, str]]:
    key = id(file_index)
    if key not in _PRODUCT_NAME_CACHE:
        _PRODUCT_NAME_CACHE[key] = build_product_name_index(file_index)
    return _PRODUCT_NAME_CACHE[key]


def match_products_by_display_names(text: str, file_index: dict) -> list[str]:
    n = norm(text)
    if not n:
        return []
    matched: list[str] = []
    seen: set[str] = set()
    for phrase, pid, _display in cached_product_name_index(file_index):
        if phrase in n and pid not in seen:
            seen.add(pid)
            matched.append(pid)
    return matched


def resolve_viz_thumb(product_id: str, file_index: dict) -> str:
    for row in file_index.get("viz_latest") or []:
        if row.get("product_id") == product_id and row.get("thumb_url"):
            return str(row["thumb_url"])
    return ""


def build_linked_product_meta(product_ids: list[str], file_index: dict) -> list[dict[str, str]]:
    products_by_id = {p.get("id"): p for p in file_index.get("products") or [] if p.get("id")}
    out: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    seen_labels: set[str] = set()
    for pid in product_ids:
        if not pid or pid in seen_ids:
            continue
        p = products_by_id.get(pid) or {}
        display = (p.get("display_name") or p.get("name") or pid).split("—")[0].strip()
        label_key = norm(display)
        if label_key in seen_labels:
            continue
        seen_ids.add(pid)
        seen_labels.add(label_key)
        out.append(
            {
                "id": pid,
                "display_name": display,
                "thumb_url": resolve_viz_thumb(pid, file_index),
            }
        )
    return out


_SKU_INDEX_RE = re.compile(r"(6300\d{3}(?:\.\d{2})?)")
_variant_to_product_cache: dict[str, str] | None = None
_variant_to_product_cache_id: int | None = None


def build_variant_to_product_map(file_index: dict) -> dict[str, str]:
    """Mapa indeks wariantu (6300684.01) → product_id. Jedno źródło prawdy z file-index."""
    global _variant_to_product_cache, _variant_to_product_cache_id
    cache_id = id(file_index)
    if _variant_to_product_cache is not None and _variant_to_product_cache_id == cache_id:
        return _variant_to_product_cache
    out: dict[str, str] = {}
    for p in file_index.get("products") or []:
        pid = p.get("id") or ""
        if not pid:
            continue
        for rev in p.get("revisions") or []:
            idx = str(rev.get("index") or "").strip()
            if idx:
                out[idx] = pid
            base = str(rev.get("index_base") or "").strip()
            if base and base not in out:
                out[base] = pid
        for idx in p.get("indexes") or []:
            key = str(idx).strip()
            if key and key not in out:
                out[key] = pid
    _variant_to_product_cache = out
    _variant_to_product_cache_id = cache_id
    return out


def extract_variant_ids_from_asset(asset: dict[str, Any]) -> list[str]:
    blob = " ".join(
        [
            str(asset.get("sku") or ""),
            str(asset.get("name") or ""),
            str(asset.get("path") or ""),
            str(asset.get("ocr_text") or ""),
        ]
    )
    found: list[str] = []
    seen: set[str] = set()
    for m in _SKU_INDEX_RE.finditer(blob):
        idx = m.group(1)
        if idx not in seen:
            seen.add(idx)
            found.append(idx)
    return found


def apply_global_product_links(asset: dict[str, Any], file_index: dict) -> None:
    """
    linked_variant_ids = indeksy SKU na materiale.
    linked_product_id = ZAWSZE wyliczane z wariantu (mapa variant→product).
    Nie wypełniać linked_product_id ręcznie niezależnie od wariantu.
    """
    vmap = build_variant_to_product_map(file_index)
    variants = extract_variant_ids_from_asset(asset)
    # Zachowaj istniejące linked_product_ids jako kandydatów rodziny
    product_ids = list(asset.get("linked_product_ids") or [])
    for vid in variants:
        pid = vmap.get(vid) or vmap.get(vid.split(".")[0] if "." in vid else "")
        if pid and pid not in product_ids:
            product_ids.append(pid)
    # Jeśli mamy product_ids bez wariantu — zostaw; product_id = pierwszy
    derived = ""
    for vid in variants:
        derived = vmap.get(vid) or ""
        if derived:
            break
    if not derived and product_ids:
        derived = product_ids[0]
    if derived and derived not in product_ids:
        product_ids.insert(0, derived)
    asset["linked_variant_ids"] = variants
    asset["linked_product_id"] = derived or None
    if product_ids:
        asset["linked_product_ids"] = product_ids[:8]
        if not asset.get("linked_products"):
            asset["linked_products"] = build_linked_product_meta(product_ids[:8], file_index)


def enrich_folder_groups(assets: list[dict[str, Any]], file_index: dict) -> None:
    """Grupuje pliki w folderze: warianty, edytowalny, wspolne skojarzenia produktow."""
    by_dir: dict[str, list[dict[str, Any]]] = {}
    for a in assets:
        path = a.get("path") or ""
        if not path:
            continue
        by_dir.setdefault(folder_dir(path).lower(), []).append(a)

    for dir_key, group in by_dir.items():
        editable_assets = [
            a
            for a in group
            if Path(a.get("name") or "").suffix.lower() in EDITABLE_EXT
        ]
        editable = bool(editable_assets)
        folder_editable_files = [
            {
                "id": a.get("id") or "",
                "name": a.get("name") or "",
                "path": a.get("path") or "",
            }
            for a in editable_assets
        ]
        folder_blob = " ".join(
            [
                dir_key,
                " ".join(a.get("name") or "" for a in group),
                " ".join(a.get("ocr_text") or "" for a in group),
                " ".join(" ".join(a.get("appearance_tags") or []) for a in group),
            ]
        )
        theme_tags = extract_theme_tags(folder_blob)
        legacy_tags = extract_legacy_archive_tags(group[0].get("path") or "")

        folder_path = group[0].get("path") or ""
        path_hints = folder_product_hints(folder_path)
        if path_hints:
            group_product_ids = list(path_hints)[:MAX_FOLDER_PRODUCTS]
        else:
            group_product_ids = []
            for a in group:
                for pid in _filter_product_ids(a.get("linked_product_ids") or [], file_index):
                    if pid not in group_product_ids:
                        group_product_ids.append(pid)
            for pid in resolve_folder_products(folder_blob, folder_path, file_index):
                if pid not in group_product_ids:
                    group_product_ids.append(pid)
            group_product_ids = group_product_ids[:MAX_FOLDER_PRODUCTS]

        stems = build_folder_stems(group, dir_key)

        for a in group:
            path = a.get("path") or ""
            gid = dir_key
            a["folder_group_id"] = gid
            a["folder_has_editable"] = editable
            a["folder_editable_files"] = folder_editable_files
            if legacy_tags:
                a["appearance_tags"] = merge_tags(a.get("appearance_tags") or [], legacy_tags)
            if theme_tags:
                a["appearance_tags"] = merge_tags(a.get("appearance_tags") or [], theme_tags)
            tags = [t for t in (a.get("appearance_tags") or []) if norm(t) != "edytowalny"]
            a["appearance_tags"] = tags
            ext = Path(a.get("name") or "").suffix.lower()
            fmt = [f for f in (a.get("format_technical") or []) if f != "editable"]
            if ext in EDITABLE_EXT and "editable" not in fmt:
                fmt.append("editable")
            elif ext not in EDITABLE_EXT:
                fmt = [f for f in fmt if f != "editable"]
            a["format_technical"] = fmt

            # HARD: zakaz sibling spray w SLIDERY / KATEGORIE GLOWNE / mixed folders.
            # Path hint = folder-level product (OK). Bez path hint: tylko per-plik
            # (name+OCR+SKU), NIE kopiuj group_product_ids na siblings.
            path_u = (path or "").upper().replace("\\", "/")
            mixed_depth = (
                "/SLIDERY/" in path_u
                or "/KATEGORIE" in path_u
                or "/KATEGORIE G" in path_u
                or path_u.count("/") >= 6
            )
            if path_hints and not mixed_depth:
                linked = list(group_product_ids)
                a["linked_product_ids"] = linked[:MAX_FOLDER_PRODUCTS]
                a["folder_linked_product_ids"] = list(group_product_ids)
                a["linked_products"] = build_linked_product_meta(group_product_ids, file_index)
            elif path_hints and mixed_depth:
                # Folder hint OK for self, but do not spray sibling group blob.
                own = _filter_product_ids(list(a.get("linked_product_ids") or []), file_index)
                for pid in path_hints:
                    if pid not in own:
                        own.append(pid)
                linked = own[:MAX_FOLDER_PRODUCTS]
                a["linked_product_ids"] = linked
                a["folder_linked_product_ids"] = list(path_hints)[:MAX_FOLDER_PRODUCTS]
                a["linked_products"] = build_linked_product_meta(linked, file_index)
            else:
                linked = _filter_product_ids(list(a.get("linked_product_ids") or []), file_index)
                linked = linked[:MAX_FOLDER_PRODUCTS]
                a["linked_product_ids"] = linked
                a["folder_linked_product_ids"] = list(linked)
                a["linked_products"] = build_linked_product_meta(linked, file_index)
            apply_global_product_links(a, file_index)

            stem_key = norm(variant_stem(a.get("name") or ""))
            siblings = stems.get(stem_key)
            if not siblings and len(stems) == 1:
                siblings = next(iter(stems.values()))
            if not siblings:
                siblings = [a]
            variants: list[dict[str, str]] = []
            seen_ids: set[str] = set()
            for s in siblings:
                sid = s.get("id") or ""
                if not sid or sid in seen_ids:
                    continue
                seen_ids.add(sid)
                variants.append(
                    {
                        "id": sid,
                        "name": s.get("name") or "",
                        "path": s.get("path") or "",
                        "label": variant_device_label(s.get("name") or "", s.get("dimensions_px") or ""),
                        "media_type": s.get("media_type") or "",
                    }
                )
            order = {"Desktop": 0, "Tablet": 1, "Mobile": 2}
            variants.sort(key=lambda v: (order.get(v["label"], 9), v["label"]))
            a["folder_variants"] = variants

            extra = " ".join(norm(t) for t in (a.get("appearance_tags") or []))
            blob = a.get("search_blob") or ""
            if extra:
                a["search_blob"] = (blob + " " + extra).strip()


def apply_branding_assoc_overrides(assets: list[dict[str, Any]], file_index: dict) -> None:
    """Reczne skojarzenia z branding-associations-overrides.json (po enrich_folder_groups)."""
    from pathlib import Path

    ov_path = Path(__file__).resolve().parent.parent / "data" / "branding-associations-overrides.json"
    if not ov_path.is_file():
        return
    try:
        ov = json.loads(ov_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    if not isinstance(ov, dict):
        return

    assets_by_id = {a.get("id"): a for a in assets if a.get("id")}

    def apply_patch(a: dict[str, Any], pids: list[str], vids: list[str] | None) -> None:
        if pids:
            a["linked_product_ids"] = list(pids)
            a["folder_linked_product_ids"] = list(pids)
            a["linked_products"] = build_linked_product_meta(pids, file_index)
            if pids:
                a["linked_product_id"] = pids[0]
        if vids:
            a["linked_variant_ids"] = list(vids)
            variants: list[dict[str, str]] = []
            for vid in vids:
                va = assets_by_id.get(vid)
                if not va:
                    continue
                variants.append(
                    {
                        "id": vid,
                        "name": va.get("name") or vid,
                        "path": va.get("path") or "",
                        "label": va.get("name") or "Plik",
                        "media_type": va.get("media_type") or "",
                    }
                )
            if variants:
                a["folder_variants"] = variants

    for aid, patch in (ov.get("assets") or {}).items():
        target = assets_by_id.get(aid)
        if not target or not isinstance(patch, dict):
            continue
        pids = [str(x).strip() for x in (patch.get("linked_product_ids") or []) if str(x).strip()]
        vids = [str(x).strip() for x in (patch.get("linked_variant_ids") or []) if str(x).strip()]
        apply_patch(target, pids, vids)

    for group_key, patch in (ov.get("folder_groups") or {}).items():
        if not isinstance(patch, dict):
            continue
        group = str(group_key or "").strip().lower()
        if not group:
            continue
        pids = [str(x).strip() for x in (patch.get("linked_product_ids") or []) if str(x).strip()]
        vids = [str(x).strip() for x in (patch.get("linked_variant_ids") or []) if str(x).strip()]
        for a in assets:
            if str(a.get("folder_group_id") or "").strip().lower() == group:
                apply_patch(a, pids, vids)
