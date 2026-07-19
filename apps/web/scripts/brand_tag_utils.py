# -*- coding: utf-8 -*-
"""Wspolne mapowanie tagow wygladu / produktu dla branding-index."""
from __future__ import annotations

import re
import unicodedata
from typing import Any

# tag_wyswietlany -> wzorce w znormalizowanym tekscie (nazwa, sciezka, OCR)
APPEARANCE_VOCAB: list[tuple[str, tuple[str, ...]]] = [
    ("proteina", ("proteina", "protein", "batony nowa proteina")),
    ("baton", ("baton", "batony", "mini baton", "mini batonow", "6 mini baton")),
    ("karmel", ("karmel", "karmelu", "caramel", "karmelowy")),
    ("banoffee", ("banoffee", "banofee", "banofe")),
    ("lemon cheesecake", ("lemon cheesecake", "lemon_cheesecake", "lemoncheesecake")),
    ("indeks glikemiczny", ("indeks glikemiczny", "niski indeks", "niski indeks glikemiczny", "ig 36", "ig36")),
    ("super cena", ("super cena", "supercena", "na start")),
    ("deserowe", ("deserowe", "deser", "desery")),
    ("mini", ("mini", "6x mini", "6 min", "karton 6", "6x1", "6 x 1")),
    ("mct", ("mct", "oleju mct")),
    ("bez cukru", ("bez cukru", "0% dodatku cukru", "0 dodatku cukru")),
    ("wysoka zawartosc bialka", ("wysoka zawartosc bialka", "wysoka zawartosc białka", "białko", "bialko")),
    ("datesy", ("datesy", "dates", "daktyle")),
    ("kulki", ("kulki", "kulka", "balls")),
    ("doypack", ("doypack", "doy")),
    ("funkcjonalny", ("funkcjonalny", "funkcjonalne")),
    ("e-commerce", ("e-commerce", "ecommerce", "sklep online")),
    ("na sklep", ("na sklep", "strony www", "strona dobra kaloria", "slidery na glowna", "slidery kategorie")),
    ("social media", ("social media", "social", "meta", "facebook", "instagram")),
    ("google ads", ("google ads", "google", "ads")),
    ("baner", ("baner", "banner")),
    ("slidery", ("slider", "slidery", "web_hero_slider", "web_banner")),
    ("desktop", ("desktop", "1920x600", "1920 x 600")),
    ("tablet", ("tablet", "992x600", "992 x 600")),
    ("mobile", ("mobile", "576x600", "576 x 600")),
    ("kampania", ("kampania", "kampanie")),
    ("mix", ("mix", "mixy", "zestaw")),
    ("prezent", ("prezent", "prezentowy")),
    ("boost", ("boost", "boosty", "magnez", "cynk", "witamina")),
    ("folia", ("folia", "fol000")),
    ("sypkie", ("sypkie", "sypki", "proszek")),
    ("tuba", ("tuba", "tubka")),
    ("burger", ("burger", "buraczany")),
    ("nuggets", ("nuggets", "nugget", "gc nuggets")),
    ("tiramisu", ("tiramisu",)),
    ("banan", ("banan", "bananowy")),
    ("czekolada", ("czekolada", "czekoladowy", "kakao")),
    ("wanilia", ("wanilia", "waniliowy")),
    ("truskawka", ("truskawka", "truskawkowy")),
    ("orzech", ("orzech", "orzechowy", "orzeszki")),
    ("kokos", ("kokos", "kokosowy")),
    ("ig", ("ig 36", "ig36", "indeks 36")),
    ("karton", ("karton", "6x1", "6 x 1", "multipack")),
    ("logo", ("logo", "logotyp", "brandbook", "favicon", "znak firmowy")),
]

TOKEN_SPLIT = re.compile(r"[^a-z0-9ąćęłńóśźż]+", re.IGNORECASE)
DIM_PAIR_RE = re.compile(r"(\d{3,4})\s*[x×]\s*(\d{3,4})", re.IGNORECASE)

# Slidery sklepu Dobra Kaloria (breakpointy WWW)
SLIDER_DEVICE_SIZES: dict[tuple[int, int], str] = {
    (1920, 600): "Desktop",
    (992, 600): "Tablet",
    (576, 600): "Mobile",
}

SHOP_SLIDER_PATH_MARKERS = (
    "06 - strony www",
    "strona dobra kaloria",
    "slidery na glowna",
    "slidery kategorie",
    "slidery na glown",
)

SHOP_SLIDER_ROLE_MARKERS = (
    "web_hero_slider",
    "web_banner",
)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.lower()).strip()


def title_tag(label: str) -> str:
    """Etykieta ludzka jak w produktach (pierwsza litera slowa)."""
    parts = re.split(r"(\s+)", (label or "").strip())
    out: list[str] = []
    for p in parts:
        if p.isspace():
            out.append(p)
        elif p.isupper() and len(p) <= 4:
            out.append(p)
        else:
            out.append(p[:1].upper() + p[1:].lower() if p else p)
    return "".join(out).strip()


def extract_appearance_from_text(text: str) -> list[str]:
    n = norm(text)
    if not n:
        return []
    found: list[str] = []
    seen: set[str] = set()
    for label, patterns in APPEARANCE_VOCAB:
        key = norm(label)
        if key in seen:
            continue
        for pat in patterns:
            if norm(pat) in n:
                found.append(title_tag(label))
                seen.add(key)
                break
    return found


def product_tags_by_id(file_index: dict) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for p in file_index.get("products") or []:
        pid = p.get("id")
        if not pid:
            continue
        tags: list[str] = []
        for t in p.get("tags") or []:
            if t:
                tags.append(title_tag(str(t)))
        groups = p.get("tag_groups") or {}
        for group_tags in groups.values():
            for t in group_tags or []:
                if t:
                    tags.append(title_tag(str(t)))
        name = p.get("display_name") or p.get("name") or ""
        tags.extend(extract_appearance_from_text(name))
        dedup: list[str] = []
        seen: set[str] = set()
        for t in tags:
            k = norm(t)
            if not k or k in seen:
                continue
            seen.add(k)
            dedup.append(t)
        out[pid] = dedup
    return out


def product_path_tokens(file_index: dict) -> list[tuple[str, list[str]]]:
    """Dopasowanie po fragmencie sciezki folderu produktu."""
    pmap = product_tags_by_id(file_index)
    rows: list[tuple[str, list[str]]] = []
    for p in file_index.get("products") or []:
        pid = p.get("id")
        path = p.get("path") or p.get("rel") or ""
        if not pid or not path:
            continue
        folder = path.replace("\\", "/").split("/")[-1]
        if folder:
            rows.append((norm(folder), pmap.get(pid, [])))
    rows.sort(key=lambda x: len(x[0]), reverse=True)
    return rows


_PATH_TOKEN_CACHE: dict[int, list[tuple[str, list[str]]]] = {}


def cached_path_tokens(file_index: dict) -> list[tuple[str, list[str]]]:
    key = id(file_index)
    if key not in _PATH_TOKEN_CACHE:
        _PATH_TOKEN_CACHE[key] = product_path_tokens(file_index)
    return _PATH_TOKEN_CACHE[key]


def match_products_by_path(asset_path: str, file_index: dict) -> list[str]:
    npath = norm(asset_path.replace("\\", "/"))
    matched: list[str] = []
    seen: set[str] = set()
    for folder_norm, tags in cached_path_tokens(file_index):
        if len(folder_norm) < 8:
            continue
        if folder_norm in npath:
            for t in tags:
                k = norm(t)
                if k not in seen:
                    seen.add(k)
                    matched.append(t)
    return matched


def merge_tags(*groups: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for group in groups:
        for t in group or []:
            label = title_tag(str(t).strip())
            k = norm(label)
            if not k or k in seen:
                continue
            seen.add(k)
            out.append(label)
    return out


def parse_dimensions(text: str) -> tuple[int, int] | None:
    m = DIM_PAIR_RE.search(text or "")
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def slider_device_from_size(w: int, h: int) -> str | None:
    for (pw, ph), label in SLIDER_DEVICE_SIZES.items():
        if abs(w - pw) <= 2 and abs(h - ph) <= 2:
            return label
    return None


def extract_placement_tags(asset: dict[str, Any]) -> list[str]:
    """Slidery sklepu WWW: Slidery, Na sklep, Desktop/Tablet/Mobile."""
    name = asset.get("name") or ""
    path = asset.get("path") or ""
    role = str(asset.get("asset_role") or "")
    dims_field = str(asset.get("dimensions_px") or "")
    blob = norm(f"{name} {path} {role} {dims_field}")
    tags: list[str] = []

    is_shop_context = any(marker in blob for marker in SHOP_SLIDER_PATH_MARKERS)
    is_slider_name = "slider" in blob or "slidery" in blob
    is_slider_role = any(marker in blob for marker in SHOP_SLIDER_ROLE_MARKERS)

    wh = parse_dimensions(dims_field) or parse_dimensions(name) or parse_dimensions(path)
    device = slider_device_from_size(wh[0], wh[1]) if wh else None

    if is_shop_context or is_slider_name or is_slider_role or device:
        if is_shop_context or is_slider_role or (device and wh and wh[1] == 600):
            tags.append("Na sklep")
        if is_slider_name or is_slider_role or device:
            tags.append("Slidery")

    if "desktop" in blob and not device:
        device = "Desktop"
    elif "tablet" in blob and not device:
        device = "Tablet"
    elif "mobile" in blob and not device:
        device = "Mobile"

    if device:
        tags.append(device)

    return tags


def enrich_asset_tags(
    asset: dict[str, Any],
    product_map: dict[str, list[str]],
    file_index: dict,
    ocr_text: str = "",
) -> None:
    """Uzupelnia appearance_tags + search_blob na miejscu."""
    linked = list(asset.get("linked_product_ids") or [])
    from_products: list[str] = []
    for pid in linked:
        from_products.extend(product_map.get(pid, []))

    text_blob = " ".join(
        [
            asset.get("name") or "",
            asset.get("path") or "",
            ocr_text or asset.get("ocr_text") or "",
            " ".join(from_products),
        ]
    )
    from_text = extract_appearance_from_text(text_blob)
    from_path = match_products_by_path(asset.get("path") or "", file_index)
    from_placement = extract_placement_tags(asset)

    appearance = merge_tags(from_products, from_text, from_path, from_placement)
    # Stale etykiety (np. stary „Slider”) — dedupe synonimów
    deduped: list[str] = []
    seen_norm: set[str] = set()
    has_slidery = any(norm(t) in ("slidery", "slider") for t in appearance)
    for t in appearance:
        k = norm(t)
        if has_slidery and k == "slider":
            continue
        if k in seen_norm:
            continue
        seen_norm.add(k)
        deduped.append(t)
    appearance = deduped
    asset["appearance_tags"] = appearance

    extra = " ".join(norm(t) for t in appearance)
    blob = asset.get("search_blob") or ""
    if extra and extra not in blob:
        asset["search_blob"] = (blob + " " + extra).strip()


def enrich_all_assets(
    assets: list[dict[str, Any]],
    file_index: dict,
    recognition: dict | None = None,
) -> int:
    product_map = product_tags_by_id(file_index)
    rec_assets = (recognition or {}).get("assets") or {}
    touched = 0
    for a in assets:
        block = rec_assets.get(a.get("id") or "", {})
        ocr = block.get("ocr_text") or a.get("ocr_text") or ""
        if ocr and not a.get("ocr_text"):
            a["ocr_text"] = ocr
        before = len(a.get("appearance_tags") or [])
        enrich_asset_tags(a, product_map, file_index, ocr_text=ocr)
        if len(a.get("appearance_tags") or []) != before:
            touched += 1
    return touched
