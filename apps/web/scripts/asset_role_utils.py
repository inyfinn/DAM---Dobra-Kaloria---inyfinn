# -*- coding: utf-8 -*-
"""Taksonomia branding: media_type (auto), asset_role (folder), format_technical (auto)."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

WEB = Path(__file__).resolve().parents[1]
MAPPING_FILE = WEB / "data" / "dam-asset-role-mapping.json"

VIDEO_EXT = {".mp4", ".mov", ".webm", ".avi", ".mkv"}
VECTOR_EXT = {".ai", ".eps", ".svg"}
RASTER_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp", ".gif", ".bmp"}
SOURCE_EXT = {".psd", ".psb", ".indd"}
DOC_EXT = {".pdf", ".docx", ".xlsx"}

PRIVATE_LABEL_MARKERS = ("ALDI", "BIEDRONKA", "LIDL", "- MARKI WŁASNE", "- MARKI WLASNE")

WIZKI_RE = re.compile(
    r"-(ENFACE|FRONT|BACK|TYŁ|TYL)-?(XL|L|S(?:-SKLEP)?)\.(png|jpe?g)$",
    re.IGNORECASE,
)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.lower()).strip()


def media_type_for(ext: str) -> str:
    """Zamknieta lista IPTC: image | vector | video | source | document."""
    e = (ext or "").lower()
    if e in VIDEO_EXT:
        return "video"
    if e in VECTOR_EXT:
        return "vector"
    if e in SOURCE_EXT:
        return "source"
    if e in DOC_EXT:
        return "document"
    if e in RASTER_EXT:
        return "image"
    return "image"


def legacy_media_type(mt: str) -> str:
    if mt == "raster":
        return "image"
    return mt or "image"


def format_technical_for(asset: dict[str, Any]) -> list[str]:
    """Cechy produkcyjne pliku (PL slugi w indeksie, etykiety w UI)."""
    out: list[str] = []
    name = asset.get("name") or ""
    ext = Path(name).suffix.lower()
    mt = legacy_media_type(asset.get("media_type") or media_type_for(ext))
    if mt == "image":
        out.append("raster")
    bg = asset.get("background")
    if bg == "transparent":
        out.append("transparent")
    elif bg == "white":
        out.append("white")
    if ext in {".psd", ".psb"}:
        out.append("editable")
    return out


def _load_rules() -> list[dict]:
    if not MAPPING_FILE.is_file():
        return []
    data = json.loads(MAPPING_FILE.read_text(encoding="utf-8"))
    return list(data.get("rules") or [])


def _path_matches(path_u: str, folder_hint: str) -> bool:
    fh = norm(folder_hint.replace("-", " "))
    pu = norm(path_u.replace("-", " "))
    return fh in pu or norm(folder_hint) in norm(path_u)


def _file_matches(name_u: str, pattern: str | None) -> bool:
    if not pattern or pattern == "*":
        return True
    parts = [p.strip() for p in pattern.split("|") if p.strip()]
    for part in parts:
        if part.startswith("*."):
            if name_u.endswith(part[1:].lower()):
                return True
        elif "*" in part:
            rx = "^" + re.escape(part).replace(r"\*", ".*") + "$"
            if re.search(rx, name_u, re.I):
                return True
        elif part.upper() in name_u:
            return True
    return False


def infer_asset_role(path: str, name: str = "", media_type: str | None = None) -> str | None:
    path_u = (path or "").replace("\\", "/").upper()
    name_u = (name or Path(path).name).upper()
    # private label first (mina filtrow marki)
    for marker in PRIVATE_LABEL_MARKERS:
        if marker in path_u or marker in name_u:
            return "private_label_artwork"
    if WIZKI_RE.search(name or "") or "/4 - WIZKI" in path_u or "/WIZKI/" in path_u:
        return "packshot"
    for rule in _load_rules():
        folder = rule.get("folder") or ""
        if folder and not _path_matches(path_u, folder):
            continue
        fp = rule.get("file_pattern")
        if fp and not _file_matches(name_u, fp):
            continue
        role = rule.get("asset_role")
        if role:
            return str(role)
    mt = legacy_media_type(media_type or "")
    if mt == "video":
        return "social_video"
    return None


def enrich_branding_taxonomy(asset: dict[str, Any]) -> None:
    """Uzupelnia media_type, asset_role, format_technical na miejscy (bez nadpisywania recznych)."""
    name = asset.get("name") or ""
    ext = Path(name).suffix
    asset["media_type"] = media_type_for(ext)
    if not asset.get("asset_role"):
        inferred = infer_asset_role(asset.get("path") or "", name, asset.get("media_type"))
        if inferred:
            asset["asset_role"] = inferred
    asset["format_technical"] = format_technical_for(asset)
    # search_blob rozszerz o role (PL w UI, kod w indeksie)
    role = asset.get("asset_role") or ""
    fmt = " ".join(asset.get("format_technical") or [])
    extra = norm(f"{role} {fmt} {asset.get('media_type') or ''}")
    blob = asset.get("search_blob") or ""
    if extra and extra not in blob:
        asset["search_blob"] = (blob + " " + extra).strip()


def enrich_all_branding_taxonomy(assets: list[dict[str, Any]]) -> int:
    touched = 0
    for a in assets:
        before = (a.get("asset_role"), a.get("media_type"), tuple(a.get("format_technical") or []))
        enrich_branding_taxonomy(a)
        after = (a.get("asset_role"), a.get("media_type"), tuple(a.get("format_technical") or []))
        if before != after:
            touched += 1
    return touched
