# -*- coding: utf-8 -*-
"""Build branding-index.json from Marketing roots + product WIZKI (read-only)."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from asset_ids import asset_key, stable_asset_id  # noqa: E402
from scan_walker import walk_files  # noqa: E402

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "data" / "branding-index.json"
SEARCH_OUT = WEB / "data" / "branding-search-index.json"
CAMPAIGNS_OUT = WEB / "data" / "campaigns.json"
STATUS_FILE = WEB / "data" / "branding-build-status.json"
FILE_INDEX_PATH = WEB / "data" / "file-index.json"
CATALOG_PATH = WEB / "data" / "product-catalog.json"
SCAN_DIRS_OUT = WEB / "data" / "branding-scan-dirs.json"

# Foldery faktycznie wylistowane / nieprzeczytane (bledy IO) w biezacym
# przebiegu skanu - klucze asset_key (patrz scan_walker.py). Scalane ze
# wszystkich przejsc (marketing, wizki, elementy produktow), zapisywane
# do branding-scan-dirs.json, zeby merge indeksu (asset_sync) mogl
# odroznic "plik usuniety" od "folder nieprzeczytany".
_SCANNED_DIRS: set[str] = set()
_FAILED_DIRS: set[str] = set()


def _walk(root: Path) -> list[Path]:
    """rglob("*") + fp.is_file() zastapione walk_files: dodatkowo zbiera
    scanned/failed dirs do modulowych zbiorow (patrz SCAN_DIRS_OUT)."""
    files, scanned, failed = walk_files(root)
    _SCANNED_DIRS.update(scanned)
    _FAILED_DIRS.update(failed)
    return files

ARCHIVE_MARKERS = ("-- ARCHIWUM --", "00 - ARCHIWUM", "/ARCHIWUM/", "\\ARCHIWUM\\")
LEGACY_ARCHIVE_ROOT = "-- ARCHIWUM --"

WIZKI_RE = re.compile(
    r"-(ENFACE|FRONT|BACK|TYŁ|TYL)-?(XL|L|S(?:-SKLEP)?)\.(png|jpe?g)$",
    re.IGNORECASE,
)
WIZKI_FOLDER_RE = re.compile(r"/4\s*-\s*(?:WIZKI|VISUALS)/", re.IGNORECASE)
SKU_RE = re.compile(r"(6300\d{3}(?:\.\d{2})?)")
DIM_RE = re.compile(r"(\d{3,4})\s*[x×]\s*(\d{3,4})", re.IGNORECASE)

VIDEO_EXT = {".mp4", ".mov", ".webm", ".avi"}
VECTOR_EXT = {".ai", ".eps", ".svg"}
RASTER_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".psd", ".webp", ".gif", ".bmp"}
DOC_EXT = {".pdf", ".docx", ".xlsx"}
SCAN_EXT = VIDEO_EXT | VECTOR_EXT | RASTER_EXT | DOC_EXT | {".psd", ".psb", ".indd"}
WIZKI_EXT = {".png", ".jpg", ".jpeg", ".webp"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.lower()).strip()


def resolve_marketing_base() -> Path:
    """machine-config / M: > X:/Marketing > D:/Marketing (parity build-file-index)."""
    from marketing_roots import resolve_marketing_base as _resolve

    return _resolve()


def is_archive_path(path: str) -> bool:
    up = path.replace("\\", "/").upper()
    return any(m.upper() in up for m in ARCHIVE_MARKERS)


def is_wizki_path(path: str) -> bool:
    return bool(WIZKI_FOLDER_RE.search(path.replace("\\", "/")))


from asset_role_utils import (  # noqa: E402
    apply_background_scan_cache,
    detect_raster_background,
    enrich_branding_taxonomy,
    load_background_scan_cache,
    media_type_for,
)

# Trwaly cache pixel-scanu (patch-branding-backgrounds.py): path -> transparent|white|none.
# Rebuild nie gubi wynikow skanu i nie powtarza wolnego IO na NFS X:.
_BG_SCAN_CACHE = load_background_scan_cache()

# Stabilne id (asset_ids.stable_asset_id): id -> klucz sciezki, jeden slownik
# na caly przebieg builda - rozwiazuje rzadkie kolizje hashu w obrebie indeksu.
_ID_TAKEN: dict[str, str] = {}
# Klucz sciezki -> id z bazy: plik znany w bazie zawsze zachowuje swoje id.
_ID_BY_KEY: dict[str, str] = {}
LOCAL_DB = WEB.parents[1] / "DATABASE" / "dam-local.sqlite"


def asset_id_for(path: str) -> str:
    """Id z bazy, jesli plik tam jest; inaczej stable_asset_id z kolizjami wobec bazy."""
    known = _ID_BY_KEY.get(asset_key(path))
    if known:
        _ID_TAKEN[known] = asset_key(path)
        return known
    return stable_asset_id(path, _ID_TAKEN)


def seed_id_taken_from_rows(db_path: Path = LOCAL_DB) -> int:
    """Kolizje id rozstrzyga baza (dam_assets, lokalne lustro asset_rows), nie
    kolejnosc os.scandir - inaczej inny komputer z ROOT moglby dac parze plikow
    z tym samym skrotem id na odwrot i skojarzenia wskazalyby nie ten plik."""
    if not db_path.is_file():
        return 0
    import sqlite3
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        try:
            got = conn.execute("SELECT asset_id, row_json FROM asset_rows").fetchall()
        finally:
            conn.close()
    except sqlite3.Error:
        return 0
    n = 0
    for aid, row_json in got:
        try:
            key = str(json.loads(row_json).get("asset_key") or "")
        except (TypeError, ValueError, AttributeError):
            continue
        if key:
            _ID_TAKEN[str(aid)] = key
            _ID_BY_KEY[key] = str(aid)
            n += 1
    return n


def normalize_perspective_token(raw: str) -> str:
    token = (raw or "").upper().replace("TYŁ", "TYL")
    if token in ("TYL", "TYL-ENFACE", "TYL_ENFACE"):
        return "TYL_ENFACE"
    if token in ("ENFACE", "FRONT", "BACK"):
        return token
    return token


def parse_wizki(name: str) -> dict:
    m = WIZKI_RE.search(name)
    if not m:
        return {}
    persp = normalize_perspective_token(m.group(1))
    size = m.group(2).upper().replace("-SKLEP", "_SKLEP")
    ext = m.group(3).lower()
    bg = "transparent" if ext == "png" else "white"
    return {"perspective": persp, "size": size, "background": bg}


def parse_channels(path: str) -> list[str]:
    up = path.replace("\\", "/").upper()
    channels: list[str] = []
    if "05 - SOCIAL" in up or "/SOCIAL MEDIA" in up:
        channels.extend(["instagram", "meta"])
    if "06 - STRONY WWW" in up or "SLIDERY" in up:
        channels.append("www")
    if "07 - E-COMMERCE" in up or "E-COMMERCE" in up:
        channels.append("www")
        if "GOOGLE" in up:
            channels.append("google")
        if "META" in up or "FACEBOOK" in up:
            channels.append("meta")
    if "08 - KAMAPANIE" in up:
        if "META" in up or "FACEBOOK" in up:
            channels.append("meta")
        if "GOOGLE" in up or "ADS" in up:
            channels.append("google")
        if "INSTAGRAM" in up or "/IG" in up or " REELS" in up:
            channels.append("instagram")
        if "WWW" in up or "SKLEP" in up or "SLIDER" in up:
            channels.append("www")
    return sorted(set(channels))


def parse_campaign(path: Path, marketing: Path) -> str | None:
    rel = str(path).replace("\\", "/")
    upper = rel.upper()
    marker = "/08 - KAMAPANIE/"
    if marker not in upper:
        return None
    parts = rel.split("/08 - KAMAPANIE/")
    if len(parts) < 2:
        parts = rel.split("/08 - KAMAPANIE/")
    if len(parts) < 2:
        return None
    tail = parts[1].strip("/").split("/")
    if not tail:
        return None
    year = tail[0]
    name = tail[1] if len(tail) > 1 else year
    return f"{year}-{norm(name)[:40]}"


def is_legacy_root_archive(path: str) -> bool:
    up = path.replace("\\", "/").upper()
    return f"/{LEGACY_ARCHIVE_ROOT}/" in up or up.startswith(f"X:/MARKETING/{LEGACY_ARCHIVE_ROOT}/")


def is_polska_marketing_root(path: str) -> bool:
    up = path.replace("\\", "/").upper()
    return "/- POLSKA/" in up or up.startswith("X:/MARKETING/- POLSKA/")


def file_overlap_key(fp: Path) -> str:
    """Semantic fingerprint: campaign stem + dimensions (handles BACK vs Back, jpg vs png)."""
    from brand_folder_context import variant_stem
    from brand_tag_utils import parse_dimensions

    name = fp.name
    stem = norm(variant_stem(name))
    wh = parse_dimensions(name)
    if stem and wh:
        return f"{stem}:{wh[0]}x{wh[1]}"
    try:
        size = fp.stat().st_size
    except OSError:
        size = -1
    return f"{norm(name)}:{size}"


def build_tags(
    archived: bool,
    wiz: dict,
    channels: list[str],
    source: str,
    path: str = "",
) -> list[str]:
    tags: list[str] = []
    if archived:
        tags.append("ARCHIWUM")
    if is_legacy_root_archive(path):
        tags.extend(["Archiwum", "Stara struktura"])
    path_up = (path or "").replace("\\", "/").upper()
    if "04 - DRUKOWANE MATERIA" in path_up or "/DRUKOWANE MATERIA" in path_up:
        tags.append("Drukowane")
    if source == "wizki":
        tags.append("WIZKI")
    if source == "product_element":
        tags.append("Elementy")
    if wiz.get("perspective"):
        tags.append(wiz["perspective"])
    if wiz.get("size"):
        tags.append(wiz["size"])
    if wiz.get("background") == "transparent":
        tags.append("PNG")
    elif wiz.get("background") == "white":
        tags.append("JPG")
    for ch in channels:
        if ch not in tags:
            tags.append(ch)
    return tags


def make_asset(
    aid: int,
    fp: Path,
    brand: str,
    marketing: Path,
    *,
    source: str = "marketing",
    include_archive: bool = False,
) -> dict | None:
    path = str(fp).replace("\\", "/")
    archived = is_archive_path(path)
    if archived and not include_archive and not is_legacy_root_archive(path):
        return None
    ext = fp.suffix.lower()
    allowed = WIZKI_EXT if source == "wizki" else SCAN_EXT
    if ext not in allowed:
        return None
    name = fp.name
    wiz = parse_wizki(name)
    sku_m = SKU_RE.search(name) or SKU_RE.search(path)
    dims = DIM_RE.search(name)
    channels = parse_channels(path)
    tags = build_tags(archived, wiz, channels, source, path=path)
    camp = parse_campaign(fp, marketing) if source == "marketing" else None
    mt = media_type_for(ext)
    bg = wiz.get("background")
    if not bg and mt == "image":
        cached = _BG_SCAN_CACHE.get(path.lower())
        if cached in ("transparent", "white"):
            bg = cached
        elif cached == "none":
            bg = None  # skan juz byl: brak przezroczystosci, nie powtarzaj IO
        elif is_legacy_root_archive(path) or source == "product_element":
            # Legacy ARCHIWUM + product Links/ELEMENTY: pomin pixel-scan tła
            # (PIL na X: NFS wisi na TIFF 50–120 MB). Tło: patch-backgrounds.
            bg = None
        else:
            bg = detect_raster_background(str(fp), name)
    blob_parts = [name, path, brand, mt, source] + tags
    if wiz.get("perspective"):
        blob_parts.append(wiz["perspective"])
    if wiz.get("size"):
        blob_parts.append(wiz["size"])
    mtime_iso = None
    mtime_ms = None
    try:
        st = fp.stat()
        mtime_ms = int(st.st_mtime * 1000)
        mtime_iso = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
    except OSError:
        pass
    asset = {
        "id": asset_id_for(path),
        "path": path,
        "name": name,
        "brand": brand,
        "media_type": mt,
        "source": source,
        "perspective": wiz.get("perspective"),
        "size": wiz.get("size"),
        "background": bg,
        "sku": sku_m.group(1) if sku_m else None,
        "campaign_id": camp,
        "channels": channels,
        "dimensions_px": f"{dims.group(1)}x{dims.group(2)}" if dims else None,
        "tags": tags,
        "is_archive": archived,
        "linked_product_ids": [],
        "linked_variant_ids": [],
        "linked_product_id": None,
        "mtime": mtime_iso,
        "mtime_ms": mtime_ms,
        "appearance_tags": [],
        "ocr_text": "",
        "search_blob": norm(" ".join(blob_parts)),
    }
    enrich_branding_taxonomy(asset)
    return asset


def scan_marketing_roots(
    marketing: Path,
    include_archive: bool = False,
) -> tuple[list[dict], dict[str, int]]:
    """Scan - POLSKA (priority) then -- ARCHIWUM --; legacy skipped when file overlaps POLSKA."""
    polska = marketing / "- POLSKA"
    eksport = marketing / "- EKSPORT"
    primary_roots: list[tuple[str, Path]] = [
        ("DK", polska / "- BRANDING i MARKA -"),
        ("DK", polska / "02 - FIRMOWE MATERIAŁY"),
        ("DK", polska / "03 - MATERIAŁY GRAFICZNE"),
        ("DK", polska / "04 - PROCESY"),
        ("DK", polska / "05 - SOCIAL MEDIA"),
        ("DK", polska / "06 - STRONY WWW - INTERNET"),
        ("DK", polska / "07 - E-COMMERCE"),
        ("DK", polska / "08 - KAMAPANIE"),
    ]
    if (eksport / "- BRANDING i MARKA -").is_dir():
        primary_roots.append(("GC", eksport / "- BRANDING i MARKA -"))

    legacy_root = marketing / LEGACY_ARCHIVE_ROOT

    assets: list[dict] = []
    aid = 0
    seen_paths: set[str] = set()
    polska_overlap_keys: set[str] = set()
    stats = {
        "primary_scanned": 0,
        "legacy_scanned": 0,
        "legacy_skipped_overlap": 0,
        "legacy_indexed": 0,
    }

    def ingest_file(fp: Path, brand: str, *, from_legacy: bool) -> None:
        nonlocal aid
        path_key = str(fp).replace("\\", "/").lower()
        if path_key in seen_paths:
            return
        if from_legacy:
            stats["legacy_scanned"] += 1
            overlap_key = file_overlap_key(fp)
            if overlap_key in polska_overlap_keys:
                stats["legacy_skipped_overlap"] += 1
                return
        else:
            stats["primary_scanned"] += 1

        row = make_asset(aid + 1, fp, brand, marketing, source="marketing", include_archive=include_archive)
        if not row:
            return
        aid += 1
        seen_paths.add(path_key)
        if not from_legacy and is_polska_marketing_root(row["path"]):
            polska_overlap_keys.add(file_overlap_key(fp))
        if from_legacy:
            stats["legacy_indexed"] += 1
        assets.append(row)

    for brand, root in primary_roots:
        if not root.is_dir():
            continue
        print(f"scan primary: {root}", flush=True)
        for fp in _walk(root):
            ingest_file(fp, brand, from_legacy=False)
            if stats["primary_scanned"] and stats["primary_scanned"] % 500 == 0:
                print(f"  primary_scanned={stats['primary_scanned']} indexed={aid}", flush=True)

    if legacy_root.is_dir():
        print(f"scan legacy: {legacy_root}", flush=True)
        for fp in _walk(legacy_root):
            ingest_file(fp, "DK", from_legacy=True)
            if stats["legacy_scanned"] and stats["legacy_scanned"] % 500 == 0:
                print(
                    f"  legacy_scanned={stats['legacy_scanned']}"
                    f" indexed={stats['legacy_indexed']}"
                    f" skip_overlap={stats['legacy_skipped_overlap']}",
                    flush=True,
                )

    return assets, stats


def scan_wizki_products(marketing: Path, include_archive: bool = False) -> list[dict]:
    """Product pack shots from 01 - PRODUKTY / 4 - WIZKI (PL) and 4 - VISUALS (export)."""
    scan_roots_dirs = [
        marketing / "- POLSKA" / "01 - PRODUKTY",
        marketing / "- EKSPORT" / "01 - PRODUCTS",
    ]
    assets: list[dict] = []
    aid = 0
    seen: set[str] = set()
    for products_root in scan_roots_dirs:
        if not products_root.is_dir():
            continue
        for fp in _walk(products_root):
            path = str(fp).replace("\\", "/")
            if not is_wizki_path(path):
                continue
            path_key = path.lower()
            if path_key in seen:
                continue
            brand = "GC" if "/- EKSPORT/" in path.upper() or "/01 - PRODUCTS/" in path.upper() else "DK"
            row = make_asset(aid + 1, fp, brand, marketing, source="wizki", include_archive=include_archive)
            if not row:
                continue
            aid += 1
            seen.add(path_key)
            assets.append(row)
    return assets


def scan_product_element_assets(marketing: Path, include_archive: bool = False) -> list[dict]:
    """Links + MATERIALY/ELEMENTY (+ skladniki) spod 01 - PRODUKTY / PRODUCTS.

    Handoff A3 / pkt 35: product-folder elementy nie byly w branding-index
    (tylko packshoty WIZKI). Indeksujemy je jako source=product_element.
    """
    from brand_element_assoc import is_product_element_path

    scan_roots_dirs = [
        marketing / "- POLSKA" / "01 - PRODUKTY",
        marketing / "- EKSPORT" / "01 - PRODUCTS",
    ]
    assets: list[dict] = []
    aid = 0
    seen: set[str] = set()
    for products_root in scan_roots_dirs:
        if not products_root.is_dir():
            continue
        for fp in _walk(products_root):
            path = str(fp).replace("\\", "/")
            if not is_product_element_path(path):
                continue
            path_key = path.lower()
            if path_key in seen:
                continue
            brand = "GC" if "/- EKSPORT/" in path.upper() or "/01 - PRODUCTS/" in path.upper() else "DK"
            row = make_asset(
                aid + 1,
                fp,
                brand,
                marketing,
                source="product_element",
                include_archive=include_archive,
            )
            if not row:
                continue
            row["asset_role"] = "product_element"
            if "Elementy" not in (row.get("tags") or []):
                row.setdefault("tags", []).append("Elementy")
            aid += 1
            seen.add(path_key)
            assets.append(row)
    return assets


def dedupe_by_path(*groups: list[dict]) -> list[dict]:
    """Pierwsza grupa wygrywa; kolejne tylko gdy path jeszcze nie zindeksowany."""
    if not groups:
        return []
    # Klucz jak w stable_asset_id: ten sam plik w NFC/NFD lub przez inna litere dysku
    # to jeden wpis (inaczej dwa wpisy dostalyby to samo stabilne id).
    out = []
    seen: set[str] = set()
    for a in groups[0]:
        key = asset_key(a.get("path") or "")
        if a.get("path") and key in seen:
            continue
        seen.add(key)
        out.append(a)
    for group in groups[1:]:
        for a in group:
            key = asset_key(a.get("path") or "") if a.get("path") else ""
            if not key or key in seen:
                continue
            # id juz stabilne (z path) z make_asset - nie przenumerowywac.
            out.append(a)
            seen.add(key)
    return out


def sku_to_products(file_index: dict) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for p in file_index.get("products") or []:
        pid = p.get("id")
        if not pid:
            continue
        for idx in p.get("indexes") or []:
            key = str(idx)
            out.setdefault(key, []).append(pid)
            out.setdefault(key.split(".")[0], []).append(pid)
    return out


def catalog_index_map(catalog: dict) -> dict[str, str]:
    out: dict[str, str] = {}
    for pid, entry in (catalog.get("products") or {}).items():
        idx = entry.get("index_primary")
        if not idx:
            continue
        out[str(idx)] = pid
        out[str(idx).split(".")[0]] = pid
    return out


def attach_product_links(
    assets: list[dict],
    sku_map: dict[str, list[str]],
    catalog_map: dict[str, str],
) -> None:
    for a in assets:
        linked: list[str] = []
        sku = a.get("sku")
        if sku:
            for key in (sku, sku.split(".")[0]):
                for pid in sku_map.get(key, []):
                    if pid not in linked:
                        linked.append(pid)
                cat_pid = catalog_map.get(key)
                if cat_pid and cat_pid not in linked:
                    linked.append(cat_pid)
        a["linked_product_ids"] = linked
        if linked:
            a["search_blob"] = norm((a.get("search_blob") or "") + " " + " ".join(linked))


def build_search_index(assets: list[dict]) -> dict:
    by_tag: dict[str, list[str]] = {}
    by_appearance: dict[str, list[str]] = {}
    campaigns: dict[str, list[str]] = {}
    for a in assets:
        aid = a["id"]
        for t in a.get("tags") or []:
            by_tag.setdefault(t, []).append(aid)
        for t in a.get("appearance_tags") or []:
            by_tag.setdefault(t, []).append(aid)
            by_appearance.setdefault(t, []).append(aid)
        for ch in a.get("channels") or []:
            by_tag.setdefault(ch, []).append(aid)
        if a.get("perspective"):
            by_tag.setdefault(a["perspective"], []).append(aid)
        if a.get("size"):
            by_tag.setdefault(a["size"], []).append(aid)
        if a.get("asset_role"):
            by_tag.setdefault(a["asset_role"], []).append(aid)
        if a.get("media_type"):
            by_tag.setdefault(a["media_type"], []).append(aid)
        for ft in a.get("format_technical") or []:
            by_tag.setdefault(ft, []).append(aid)
        if a.get("campaign_id"):
            campaigns.setdefault(a["campaign_id"], []).append(aid)
    return {
        "by_tag": {k: sorted(set(v)) for k, v in by_tag.items()},
        "by_appearance": {k: sorted(set(v)) for k, v in by_appearance.items()},
        "campaigns": campaigns,
        "entries": [
            {"id": a["id"], "search_blob": a.get("search_blob") or "", "path": a.get("path")}
            for a in assets
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--include-archive", action="store_true")
    args = ap.parse_args()
    t0 = time.time()
    t0_ms = int(t0 * 1000)
    _SCANNED_DIRS.clear()
    _FAILED_DIRS.clear()
    print(f"id z bazy (asset_rows): {seed_id_taken_from_rows()}", flush=True)
    marketing = resolve_marketing_base()
    marketing_assets, scan_stats = scan_marketing_roots(marketing, include_archive=args.include_archive)
    print(
        "marketing scan:"
        f" primary={scan_stats['primary_scanned']}"
        f" legacy_scanned={scan_stats['legacy_scanned']}"
        f" legacy_skipped_overlap={scan_stats['legacy_skipped_overlap']}"
        f" legacy_indexed={scan_stats['legacy_indexed']}"
    )
    wizki_assets = scan_wizki_products(marketing, include_archive=args.include_archive)
    print(f"wizki scan: {len(wizki_assets)}", flush=True)
    element_assets = scan_product_element_assets(marketing, include_archive=args.include_archive)
    print(f"product element scan (Links/ELEMENTY): {len(element_assets)}", flush=True)
    assets = dedupe_by_path(marketing_assets, wizki_assets, element_assets)

    file_index = json.loads(FILE_INDEX_PATH.read_text(encoding="utf-8")) if FILE_INDEX_PATH.is_file() else {}
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8")) if CATALOG_PATH.is_file() else {}
    attach_product_links(assets, sku_to_products(file_index), catalog_index_map(catalog))

    overrides_path = WEB / "data" / "branding-metadata-overrides.json"
    if overrides_path.is_file():
        try:
            ov = json.loads(overrides_path.read_text(encoding="utf-8"))
            by_id = {a["id"]: a for a in assets}
            for aid, patch in (ov.get("assets") or {}).items():
                if aid not in by_id or not isinstance(patch, dict):
                    continue
                for key, val in patch.items():
                    if val is not None:
                        by_id[aid][key] = val
        except Exception as exc:
            print(f"warn: branding overrides skipped: {exc}")

    try:
        from brand_tag_utils import enrich_all_assets

        rec_path = WEB / "data" / "branding-recognition.json"
        rec = json.loads(rec_path.read_text(encoding="utf-8")) if rec_path.is_file() else {}
        enrich_all_assets(assets, file_index, rec)
    except Exception as exc:
        print(f"warn: appearance tag enrich skipped: {exc}")

    try:
        from brand_folder_context import enrich_folder_groups, apply_branding_assoc_overrides

        enrich_folder_groups(assets, file_index)
        apply_branding_assoc_overrides(assets, file_index)
    except Exception as exc:
        print(f"warn: folder context enrich skipped: {exc}")

    try:
        from brand_element_assoc import enrich_element_associations

        el_stats = enrich_element_associations(assets)
        print(
            "element assoc:"
            f" tagged={el_stats['tagged']}"
            f" product_paths={el_stats['product_element_paths']}"
            f" owoce={el_stats['with_owoce']}"
            f" skladniki={el_stats['with_skladniki']}",
            flush=True,
        )
    except Exception as exc:
        print(f"warn: element assoc enrich skipped: {exc}")

    carried = apply_background_scan_cache(assets, _BG_SCAN_CACHE)
    if carried:
        print(f"background scan cache carry-over: {carried} assets")

    with_persp = sum(1 for a in assets if a.get("perspective"))
    with_link = sum(1 for a in assets if a.get("linked_product_ids"))

    payload = {
        "version": 2,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "marketing_root": str(marketing).replace("\\", "/"),
        "asset_count": len(assets),
        "wizki_count": len(wizki_assets),
        "perspective_count": with_persp,
        "linked_product_count": with_link,
        "assets": assets,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    search_idx = build_search_index(assets)
    SEARCH_OUT.write_text(
        json.dumps(search_idx, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    camp_list = []
    for cid, aids in sorted((search_idx.get("campaigns") or {}).items()):
        camp_list.append(
            {
                "id": cid,
                "nazwa": cid,
                "rok": int(cid[:4]) if cid[:4].isdigit() else None,
                "asset_ids": aids,
                "asset_count": len(aids),
            }
        )
    CAMPAIGNS_OUT.write_text(
        json.dumps({"version": 1, "campaigns": camp_list}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    STATUS_FILE.write_text(
        json.dumps(
            {
                "ok": True,
                "built_at": payload["built_at"],
                "asset_count": len(assets),
                "wizki_count": len(wizki_assets),
                "perspective_count": with_persp,
                "linked_product_count": with_link,
                "elapsed_sec": round(time.time() - t0, 2),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    scan_dirs_payload = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scan_time_ms": t0_ms,
        "root": str(marketing).replace("\\", "/"),
        "scanned_dirs": sorted(_SCANNED_DIRS),
        "failed_dirs": sorted(_FAILED_DIRS),
        "complete": not _FAILED_DIRS,
        # Odcisk pliku skanu: w trybie "rows" most nadpisuje branding-index.json wynikiem
        # scalania - runner uzywa pliku jako skanu tylko, gdy rozmiar i czas zapisu
        # zgadzaja sie z tym odciskiem (asset_sync_runner._read_scan).
        "index_size": OUT.stat().st_size if OUT.is_file() else 0,
        "index_mtime_ns": OUT.stat().st_mtime_ns if OUT.is_file() else 0,
    }
    SCAN_DIRS_OUT.parent.mkdir(parents=True, exist_ok=True)
    scan_dirs_tmp = SCAN_DIRS_OUT.with_suffix(SCAN_DIRS_OUT.suffix + f".{os.getpid()}.tmp")
    scan_dirs_tmp.write_text(
        json.dumps(scan_dirs_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(scan_dirs_tmp, SCAN_DIRS_OUT)
    if _FAILED_DIRS:
        print(f"warn: {len(_FAILED_DIRS)} folder(y) nieprzeczytane (patrz {SCAN_DIRS_OUT})")

    print(
        f"Wrote {OUT} assets={len(assets)} wizki={len(wizki_assets)} "
        f"perspective={with_persp} linked={with_link} elapsed={time.time()-t0:.1f}s"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
