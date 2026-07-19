# -*- coding: utf-8 -*-
"""Build branding-index.json from Marketing roots + product WIZKI (read-only)."""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "data" / "branding-index.json"
SEARCH_OUT = WEB / "data" / "branding-search-index.json"
CAMPAIGNS_OUT = WEB / "data" / "campaigns.json"
STATUS_FILE = WEB / "data" / "branding-build-status.json"
FILE_INDEX_PATH = WEB / "data" / "file-index.json"
CATALOG_PATH = WEB / "data" / "product-catalog.json"

ARCHIVE_MARKERS = ("-- ARCHIWUM --", "00 - ARCHIWUM", "/ARCHIWUM/", "\\ARCHIWUM\\")

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
    for candidate in (Path(r"X:/Marketing"), Path(r"D:/Marketing")):
        if (candidate / "- POLSKA").is_dir():
            return candidate
    return Path(r"X:/Marketing")


def is_archive_path(path: str) -> bool:
    up = path.replace("\\", "/").upper()
    return any(m.upper() in up for m in ARCHIVE_MARKERS)


def is_wizki_path(path: str) -> bool:
    return bool(WIZKI_FOLDER_RE.search(path.replace("\\", "/")))


from asset_role_utils import enrich_branding_taxonomy, media_type_for  # noqa: E402
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


def build_tags(
    archived: bool,
    wiz: dict,
    channels: list[str],
    source: str,
) -> list[str]:
    tags: list[str] = []
    if archived:
        tags.append("ARCHIWUM")
    if source == "wizki":
        tags.append("WIZKI")
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
    if archived and not include_archive:
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
    tags = build_tags(archived, wiz, channels, source)
    camp = parse_campaign(fp, marketing) if source == "marketing" else None
    mt = media_type_for(ext)
    blob_parts = [name, path, brand, mt, source] + tags
    if wiz.get("perspective"):
        blob_parts.append(wiz["perspective"])
    if wiz.get("size"):
        blob_parts.append(wiz["size"])
    asset = {
        "id": f"br-{aid:06d}",
        "path": path,
        "name": name,
        "brand": brand,
        "media_type": mt,
        "source": source,
        "perspective": wiz.get("perspective"),
        "size": wiz.get("size"),
        "background": wiz.get("background"),
        "sku": sku_m.group(1) if sku_m else None,
        "campaign_id": camp,
        "channels": channels,
        "dimensions_px": f"{dims.group(1)}x{dims.group(2)}" if dims else None,
        "tags": tags,
        "is_archive": archived,
        "linked_product_ids": [],
        "appearance_tags": [],
        "ocr_text": "",
        "search_blob": norm(" ".join(blob_parts)),
    }
    enrich_branding_taxonomy(asset)
    return asset


def scan_marketing_roots(marketing: Path, include_archive: bool = False) -> list[dict]:
    polska = marketing / "- POLSKA"
    eksport = marketing / "- EKSPORT"
    roots = [
        ("DK", polska / "- BRANDING i MARKA -"),
        ("DK", polska / "03 - MATERIAŁY GRAFICZNE"),
        ("DK", polska / "05 - SOCIAL MEDIA"),
        ("DK", polska / "06 - STRONY WWW - INTERNET"),
        ("DK", polska / "07 - E-COMMERCE"),
        ("DK", polska / "08 - KAMAPANIE"),
    ]
    if (eksport / "- BRANDING i MARKA -").is_dir():
        roots.append(("GC", eksport / "- BRANDING i MARKA -"))
    assets: list[dict] = []
    aid = 0
    seen: set[str] = set()
    for brand, root in roots:
        if not root.is_dir():
            continue
        for fp in root.rglob("*"):
            if not fp.is_file():
                continue
            path_key = str(fp).replace("\\", "/").lower()
            if path_key in seen:
                continue
            row = make_asset(aid + 1, fp, brand, marketing, source="marketing", include_archive=include_archive)
            if not row:
                continue
            aid += 1
            seen.add(path_key)
            assets.append(row)
    return assets


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
        for fp in products_root.rglob("*"):
            if not fp.is_file():
                continue
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


def dedupe_by_path(marketing_assets: list[dict], wizki_assets: list[dict]) -> list[dict]:
    """Marketing scan wins; WIZKI only if path not already indexed."""
    seen = {a["path"].lower() for a in marketing_assets}
    out = list(marketing_assets)
    next_id = len(out) + 1
    for a in wizki_assets:
        key = a["path"].lower()
        if key in seen:
            continue
        a = dict(a)
        a["id"] = f"br-{next_id:06d}"
        next_id += 1
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
    marketing = resolve_marketing_base()
    marketing_assets = scan_marketing_roots(marketing, include_archive=args.include_archive)
    wizki_assets = scan_wizki_products(marketing, include_archive=args.include_archive)
    assets = dedupe_by_path(marketing_assets, wizki_assets)

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
    print(
        f"Wrote {OUT} assets={len(assets)} wizki={len(wizki_assets)} "
        f"perspective={with_persp} linked={with_link} elapsed={time.time()-t0:.1f}s"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
