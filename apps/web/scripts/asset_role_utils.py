# -*- coding: utf-8 -*-
"""Taksonomia branding: media_type (auto), asset_role (folder), format_technical (auto)."""
from __future__ import annotations

import concurrent.futures
import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Callable

WEB = Path(__file__).resolve().parents[1]
MAPPING_FILE = WEB / "data" / "dam-asset-role-mapping.json"

FILE_ACCESS_TIMEOUT = 5.0
MAX_RASTER_PROBE_BYTES = 20 * 1024 * 1024
_PNG_SIG = b"\x89PNG\r\n\x1a\n"

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


_ALPHA_EXTS = {".png", ".webp", ".gif", ".tif", ".tiff"}
_OPAQUE_RASTER_EXTS = {".jpg", ".jpeg", ".bmp"}


def _run_with_timeout(fn, timeout: float = FILE_ACCESS_TIMEOUT, default=None):
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        fut = pool.submit(fn)
        try:
            return fut.result(timeout=timeout)
        except (concurrent.futures.TimeoutError, OSError, PermissionError, ValueError):
            return default


def _read_file_prefix(path: Path, n: int = 65536) -> bytes | None:
    def _read() -> bytes:
        with open(path, "rb") as f:
            return f.read(n)

    return _run_with_timeout(_read, default=None)


def _png_header_has_alpha(data: bytes) -> bool | None:
    """True/False z naglowka PNG (bez pelnego pobierania). None = nie wiadomo."""
    if not data.startswith(_PNG_SIG):
        return None
    pos = 8
    limit = min(len(data), 262144)
    color_type = None
    while pos + 8 <= limit:
        length = int.from_bytes(data[pos : pos + 4], "big")
        chunk = data[pos + 4 : pos + 8]
        pos += 8
        if pos + length + 4 > limit:
            return None
        payload = data[pos : pos + length]
        pos += length + 4
        if chunk == b"IHDR" and len(payload) >= 10:
            color_type = payload[9]
            if color_type in (4, 6):
                return True
        elif chunk == b"tRNS":
            return True
        elif chunk == b"IDAT":
            if color_type in (0, 2):
                return False
            return None
    return None


def _pil_alpha_has_transparency(path: Path, *, alpha_threshold: int = 250) -> bool | None:
    def _probe() -> bool:
        from PIL import Image

        with Image.open(path) as im:
            if im.mode in ("RGBA", "LA"):
                rgba = im
            elif im.mode == "P" and "transparency" in im.info:
                rgba = im.convert("RGBA")
            else:
                rgba = im.convert("RGBA")
            if rgba.mode != "RGBA":
                rgba = rgba.convert("RGBA")
            lo, _hi = rgba.getchannel("A").getextrema()
            return lo < alpha_threshold

    return _run_with_timeout(_probe, default=None)


def image_has_transparent_pixels(path: str | None, *, alpha_threshold: int = 250) -> bool:
    """True gdy raster ma przezroczyste piksele. Cloud-safe: max 5 s, bez duzych plikow."""
    if not path:
        return False
    p = Path(path)
    if p.suffix.lower() not in _ALPHA_EXTS:
        return False

    def _exists() -> bool:
        return p.is_file()

    if not _run_with_timeout(_exists, default=False):
        return False

    size = _run_with_timeout(lambda: p.stat().st_size, default=None)
    if size is None or size > MAX_RASTER_PROBE_BYTES:
        return False

    if p.suffix.lower() == ".png":
        prefix = _read_file_prefix(p)
        if prefix:
            header = _png_header_has_alpha(prefix)
            if header is False:
                return False
            if header is True:
                return True

    pil = _pil_alpha_has_transparency(p, alpha_threshold=alpha_threshold)
    return bool(pil)


def detect_raster_background(path: str | None, name: str = "") -> str | None:
    """transparent | white | None — na podstawie pikseli, nie samego rozszerzenia."""
    ext = Path(name or path or "").suffix.lower()
    if ext in _OPAQUE_RASTER_EXTS:
        return "white"
    if image_has_transparent_pixels(path):
        return "transparent"
    return None


def enrich_raster_backgrounds(
    assets: list[dict[str, Any]],
    *,
    scope: str | None = None,
    on_progress: Callable[[int, int, int], None] | None = None,
) -> int:
    """Uzupelnia background dla rasterow bez wizki-nazwy (np. slidery PNG)."""
    touched = 0
    scanned = 0
    skipped = 0
    for asset in assets:
        if asset.get("background") or asset.get("perspective"):
            continue
        name = asset.get("name") or ""
        ext = Path(name).suffix.lower()
        mt = legacy_media_type(asset.get("media_type") or media_type_for(ext))
        if mt != "image" or ext not in _ALPHA_EXTS:
            continue
        if scope == "www":
            path_u = (asset.get("path") or "").upper()
            if not (
                "06 - STRONY WWW" in path_u
                or "07 - E-COMMERCE" in path_u
                or "/SLIDERY/" in path_u
            ):
                continue
        scanned += 1
        bg = detect_raster_background(asset.get("path") or "", name)
        if on_progress and scanned % 25 == 0:
            on_progress(scanned, touched, skipped)
        if bg:
            asset["background"] = bg
            touched += 1
        elif ext == ".png":
            skipped += 1
    if on_progress:
        on_progress(scanned, touched, skipped)
    return touched


def _tiff_has_layers(path: str | None) -> bool:
    """TIFF z warstwami (Photoshop) — jak w ZARZADZANIE WARSTWAMI PS: layers=true."""
    if not path:
        return False
    p = Path(path)

    def _probe() -> bool:
        from PIL import Image

        with Image.open(p) as im:
            if getattr(im, "n_frames", 1) > 1:
                return True
            tag = im.tag_v2.get(34377) if hasattr(im, "tag_v2") else None
            if tag:
                return True
        return False

    result = _run_with_timeout(_probe, default=None)
    return bool(result)


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
    elif ext in {".tif", ".tiff"} and _tiff_has_layers(asset.get("path") or ""):
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
    bg = asset.get("background") or ""
    if bg == "transparent":
        extra = norm(
            extra
            + " transparent przezroczyste przezroczyste tlo bez tla tlo usuniete tlo usnięte alpha png bez tła"
        )
    elif bg == "white":
        extra = norm(extra + " white biale tlo białe tło jpg")
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
