# -*- coding: utf-8 -*-
"""Kontekst folderu branding: warianty, edytowalny, archiwum, produkty z tekstu."""
from __future__ import annotations

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
    ("lato", ("lato 202", "wakacje", "summer")),
    ("święta", ("swieta", "boze narodzenie", "mikolaj", "choinka")),
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


def variant_stem(name: str) -> str:
    stem = Path(name).stem
    stem = DIM_SUFFIX_RE.sub("", stem).strip()
    stem = re.sub(r"\s*[-–—]\s*\d+\s*$", "", stem).strip()
    stem = re.sub(r"\s+slider\s*$", "", stem, flags=re.IGNORECASE).strip()
    return stem


def variant_device_label(name: str, dims_field: str = "") -> str:
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


FOLDER_PRODUCT_HINTS: dict[str, list[str]] = {
    "back to school": ["orzech-czekolada-daktylowy", "chrupiacy-orzech-daktylowy"],
}


def folder_product_hints(path: str) -> list[str]:
    parts = [norm(p) for p in path.replace("\\", "/").split("/") if p]
    found: list[str] = []
    seen: set[str] = set()
    for part in parts:
        for key, pids in FOLDER_PRODUCT_HINTS.items():
            if key in part:
                for pid in pids:
                    if pid not in seen:
                        seen.add(pid)
                        found.append(pid)
    return found


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
    seen: set[str] = set()
    for pid in product_ids:
        if not pid or pid in seen:
            continue
        seen.add(pid)
        p = products_by_id.get(pid) or {}
        out.append(
            {
                "id": pid,
                "display_name": (p.get("display_name") or p.get("name") or pid).split("—")[0].strip(),
                "thumb_url": resolve_viz_thumb(pid, file_index),
            }
        )
    return out


def enrich_folder_groups(assets: list[dict[str, Any]], file_index: dict) -> None:
    """Grupuje pliki w folderze: warianty, edytowalny, wspolne skojarzenia produktow."""
    by_dir: dict[str, list[dict[str, Any]]] = {}
    for a in assets:
        path = a.get("path") or ""
        if not path:
            continue
        by_dir.setdefault(folder_dir(path).lower(), []).append(a)

    for dir_key, group in by_dir.items():
        editable = any(Path(a.get("name") or "").suffix.lower() in EDITABLE_EXT for a in group)
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

        group_product_ids: list[str] = []
        for a in group:
            for pid in a.get("linked_product_ids") or []:
                if pid not in group_product_ids:
                    group_product_ids.append(pid)
        for pid in match_products_by_display_names(folder_blob, file_index):
            if pid not in group_product_ids:
                group_product_ids.append(pid)
        for pid in folder_product_hints(group[0].get("path") or ""):
            if pid not in group_product_ids:
                group_product_ids.append(pid)

        stems: dict[str, list[dict[str, Any]]] = {}
        for a in group:
            name = a.get("name") or ""
            ext = Path(name).suffix.lower()
            if ext not in RASTER_PREVIEW_EXT and ext not in {".mp4", ".mov", ".webm"}:
                continue
            stems.setdefault(norm(variant_stem(name)), []).append(a)

        for a in group:
            path = a.get("path") or ""
            gid = dir_key
            a["folder_group_id"] = gid
            a["folder_has_editable"] = editable
            if legacy_tags:
                a["appearance_tags"] = merge_tags(a.get("appearance_tags") or [], legacy_tags)
            if theme_tags:
                a["appearance_tags"] = merge_tags(a.get("appearance_tags") or [], theme_tags)
            if editable:
                tags = list(a.get("appearance_tags") or [])
                if not any(norm(t) == "edytowalny" for t in tags):
                    tags.append("Edytowalny")
                a["appearance_tags"] = tags
                fmt = list(a.get("format_technical") or [])
                if "editable" not in fmt:
                    fmt.append("editable")
                a["format_technical"] = fmt

            linked = list(a.get("linked_product_ids") or [])
            for pid in group_product_ids:
                if pid not in linked:
                    linked.append(pid)
            a["linked_product_ids"] = linked
            a["folder_linked_product_ids"] = group_product_ids
            a["linked_products"] = build_linked_product_meta(group_product_ids, file_index)

            stem_key = norm(variant_stem(a.get("name") or ""))
            siblings = stems.get(stem_key, [a])
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
