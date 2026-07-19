# -*- coding: utf-8 -*-
"""Build branding-index.json from Marketing roots (read-only)."""
from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "data" / "branding-index.json"
SEARCH_OUT = WEB / "data" / "branding-search-index.json"
STATUS_FILE = WEB / "data" / "branding-build-status.json"

ARCHIVE_MARKERS = ("-- ARCHIWUM --", "00 - ARCHIWUM", "/ARCHIWUM/", "\\ARCHIWUM\\")

WIZKI_RE = re.compile(
    r"-(ENFACE|FRONT|BACK|TYŁ|TYL)-?(XL|L|S(?:-SKLEP)?)\.(png|jpe?g)$",
    re.IGNORECASE,
)
SKU_RE = re.compile(r"(6300\d{3}(?:\.\d{2})?)")
DIM_RE = re.compile(r"(\d{3,4})\s*[x×]\s*(\d{3,4})", re.IGNORECASE)
FACE_RE = re.compile(r"(\d+)face", re.IGNORECASE)

VIDEO_EXT = {".mp4", ".mov", ".webm", ".avi"}
VECTOR_EXT = {".ai", ".eps", ".svg"}
RASTER_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".psd"}
DOC_EXT = {".pdf", ".docx", ".xlsx"}


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


def media_type_for(ext: str) -> str:
    e = ext.lower()
    if e in VIDEO_EXT:
        return "video"
    if e in VECTOR_EXT:
        return "vector"
    if e in RASTER_EXT:
        return "raster"
    if e in {".psd", ".psb", ".indd"}:
        return "source"
    if e in DOC_EXT:
        return "document"
    return "raster"


def parse_wizki(name: str) -> dict:
    m = WIZKI_RE.search(name)
    if not m:
        return {}
    persp = m.group(1).upper().replace("TYŁ", "TYL_ENFACE").replace("TYL", "TYL_ENFACE")
    if persp == "BACK" and "ENFACE" not in name.upper():
        pass
    size = m.group(2).upper().replace("-SKLEP", "_SKLEP")
    ext = m.group(3).lower()
    bg = "transparent" if ext == "png" else "white"
    return {"perspective": persp, "size": size, "background": bg}


def parse_campaign(path: Path, marketing: Path) -> str | None:
    rel = str(path).replace("\\", "/")
    marker = "/08 - KAMAPANIE/"
    if marker not in rel.upper().replace("KAMAPANIE", "KAMAPANIE"):
        marker2 = "/08 - KAMAPANIE/"
        if marker2 not in rel:
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


def scan_roots(marketing: Path, include_archive: bool = False) -> list[dict]:
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
    for brand, root in roots:
        if not root.is_dir():
            continue
        for fp in root.rglob("*"):
            if not fp.is_file():
                continue
            path = str(fp).replace("\\", "/")
            archived = is_archive_path(path)
            if archived and not include_archive:
                continue
            ext = fp.suffix.lower()
            if ext not in VIDEO_EXT | VECTOR_EXT | RASTER_EXT | DOC_EXT | {".psd", ".psb", ".indd"}:
                continue
            aid += 1
            name = fp.name
            wiz = parse_wizki(name)
            sku_m = SKU_RE.search(name) or SKU_RE.search(path)
            dims = DIM_RE.search(name)
            tags = []
            if archived:
                tags.append("ARCHIWUM")
            if wiz.get("perspective"):
                tags.append(wiz["perspective"])
            if wiz.get("size"):
                tags.append(wiz["size"])
            camp = parse_campaign(fp, marketing)
            mt = media_type_for(ext)
            assets.append(
                {
                    "id": f"br-{aid:06d}",
                    "path": path,
                    "name": name,
                    "brand": brand,
                    "media_type": mt,
                    "perspective": wiz.get("perspective"),
                    "size": wiz.get("size"),
                    "background": wiz.get("background"),
                    "sku": sku_m.group(1) if sku_m else None,
                    "campaign_id": camp,
                    "dimensions_px": f"{dims.group(1)}x{dims.group(2)}" if dims else None,
                    "tags": tags,
                    "is_archive": archived,
                    "linked_product_ids": [],
                    "appearance_tags": [],
                    "ocr_text": "",
                    "search_blob": norm(" ".join([name, path, brand, mt] + tags)),
                }
            )
    return assets


def build_search_index(assets: list[dict]) -> dict:
    by_tag: dict[str, list[str]] = {}
    campaigns: dict[str, list[str]] = {}
    for a in assets:
        aid = a["id"]
        for t in a.get("tags") or []:
            by_tag.setdefault(t, []).append(aid)
        if a.get("campaign_id"):
            campaigns.setdefault(a["campaign_id"], []).append(aid)
        blob = a.get("search_blob") or ""
        for tok in blob.split():
            if len(tok) >= 3:
                by_tag.setdefault(tok, []).append(aid)
    return {
        "by_tag": {k: sorted(set(v)) for k, v in by_tag.items()},
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
    assets = scan_roots(marketing, include_archive=args.include_archive)
    payload = {
        "version": 1,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "marketing_root": str(marketing).replace("\\", "/"),
        "asset_count": len(assets),
        "assets": assets,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    SEARCH_OUT.write_text(
        json.dumps(build_search_index(assets), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    STATUS_FILE.write_text(
        json.dumps(
            {
                "ok": True,
                "built_at": payload["built_at"],
                "asset_count": len(assets),
                "elapsed_sec": round(time.time() - t0, 2),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {OUT} assets={len(assets)} elapsed={time.time()-t0:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
