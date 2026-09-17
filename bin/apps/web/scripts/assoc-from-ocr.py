# -*- coding: utf-8 -*-
"""Pipeline: OCR (OLMOCR2) -> sugestie produktow -> branding-recognition (+ opcjonalny apply).

Nie nadpisuje recznych override z branding-associations-overrides.json.
Nie wymysla product id - tylko z file-index.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from assoc_adequacy import extract_skus, filter_adequate_product_ids, rank_products_from_ocr  # noqa: E402
from dam_olmocr2 import ocr_file, status as olmocr_status  # noqa: E402

FILE_INDEX = WEB / "data" / "file-index.json"
BRANDING_INDEX = WEB / "data" / "branding-index.json"
REC_OUT = WEB / "data" / "branding-recognition.json"
ASSOC_JSON = WEB / "data" / "product-associations.json"
OVERRIDES = WEB / "data" / "branding-associations-overrides.json"
STATUS = WEB / "data" / "branding-ocr-assoc-status.json"


def _load_json(path: Path, default):
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _override_locked_ids() -> set[str]:
    ov = _load_json(OVERRIDES, {})
    locked: set[str] = set()
    for aid in (ov.get("assets") or {}):
        locked.add(str(aid))
    # folder group variants listed in overrides
    for patch in (ov.get("assets") or {}).values():
        for vid in patch.get("linked_variant_ids") or []:
            locked.add(str(vid))
    for patch in (ov.get("folder_groups") or {}).values():
        for vid in patch.get("linked_variant_ids") or []:
            locked.add(str(vid))
    return locked


def _sku_map(file_index: dict) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for p in file_index.get("products") or []:
        pid = p.get("id")
        if not pid:
            continue
        for idx in p.get("indexes") or []:
            base = str(idx).split(".")[0]
            out.setdefault(base, []).append(pid)
            out.setdefault(str(idx), []).append(pid)
    return out


def _candidates_from_text(
    text: str,
    asset_name: str,
    sku_map: dict[str, list[str]],
    associations: dict,
    products_by_id: dict,
) -> list[str]:
    blob = f"{text} {asset_name}"
    cands: list[str] = []
    for sku in extract_skus(blob):
        for pid in sku_map.get(sku, []):
            if pid not in cands:
                cands.append(pid)
    # reverse map z product-associations (frazy, nie samotne litery)
    rev = associations.get("reverse") or {}
    low = blob.lower()
    for term, pids in rev.items():
        t = str(term).lower().strip()
        if len(t) < 4:
            continue
        if t in low:
            for pid in pids or []:
                if pid in products_by_id and pid not in cands:
                    cands.append(pid)
    return cands


def suggest_products(
    text: str,
    asset: dict,
    *,
    file_index: dict,
    associations: dict,
    fallback_path: str = "",
) -> list[dict]:
    """Ranking produktow dla tekstu OCR (bez zapisu czegokolwiek)."""
    products = file_index.get("products") or []
    products_by_id = {p.get("id"): p for p in products if p.get("id")}
    sku_map = _sku_map(file_index)
    ranked = rank_products_from_ocr(
        ocr_text=text,
        asset_name=str(asset.get("name") or ""),
        asset_path=str(asset.get("path") or fallback_path),
        products=products,
        associations=associations,
        min_score=50,
        limit=8,
    )
    extra = _candidates_from_text(
        text, str(asset.get("name") or ""), sku_map, associations, products_by_id
    )
    for pid in extra:
        if not any(r[0] == pid for r in ranked):
            from assoc_adequacy import score_product_link

            p = products_by_id.get(pid) or {}
            sc, reason = score_product_link(
                asset_name=str(asset.get("name") or ""),
                asset_path=str(asset.get("path") or ""),
                ocr_text=text,
                product_id=pid,
                product_name=str(p.get("name") or p.get("display_name") or ""),
                product_path=str(p.get("path") or ""),
                product_indexes=p.get("indexes") or [],
                associations=associations,
            )
            if sc >= 50:
                ranked.append((pid, sc, reason))
    ranked.sort(key=lambda x: (-x[1], x[0]))
    return [{"product_id": pid, "score": sc, "reason": reason} for pid, sc, reason in ranked[:8]]


def process_asset(
    asset: dict,
    *,
    file_index: dict,
    associations: dict,
    locked: set[str],
    engine: str,
    apply_links: bool,
) -> dict:
    aid = str(asset.get("id") or "")
    path = Path(str(asset.get("path") or ""))
    # Resolve M: from X:/Marketing style paths via machine base
    if not path.is_file():
        # try M: remap
        s = str(path).replace("\\", "/")
        for prefix in ("X:/Marketing/", "x:/marketing/", "D:/Marketing/", "d:/marketing/"):
            if s.lower().startswith(prefix.lower()):
                alt = Path("M:/" + s[len(prefix) :])
                if alt.is_file():
                    path = alt
                    break
    result: dict = {
        "id": aid,
        "name": asset.get("name"),
        "path": str(path),
        "locked_override": aid in locked,
        "ocr_text": "",
        "engine": engine,
        "suggestions": [],
        "applied": False,
    }
    if not path.is_file():
        result["error"] = "file_missing"
        return result

    if engine == "olmocr2":
        ocr = ocr_file(path)
        text = str(ocr.get("text") or "")
        result["ocr_meta"] = {k: ocr.get(k) for k in ("ok", "chars", "error", "engine", "python")}
    else:
        try:
            from rapidocr_onnxruntime import RapidOCR  # type: ignore

            engine_r = RapidOCR()
            rows, _ = engine_r(str(path))
            text = " ".join(row[1] for row in (rows or []) if len(row) > 1)
            result["ocr_meta"] = {"ok": bool(text), "chars": len(text), "engine": "rapidocr"}
        except Exception as exc:
            text = ""
            result["ocr_meta"] = {"ok": False, "error": str(exc), "engine": "rapidocr"}

    result["ocr_text"] = text
    result["suggestions"] = suggest_products(
        text, asset, file_index=file_index, associations=associations, fallback_path=str(path)
    )

    # Zapisz do recognition zawsze
    rec = _load_json(REC_OUT, {"assets": {}})
    store = rec.setdefault("assets", {})
    suggested_ids = [s["product_id"] for s in result["suggestions"]]
    store[aid] = {
        "ocr_text": text,
        "ocr_confidence": 0.9 if text and engine == "olmocr2" else (0.7 if text else 0.0),
        "ocr_engine": engine,
        "suggested_product_ids": suggested_ids,
        "suggestions": result["suggestions"],
        "linked_product_ids": list(asset.get("linked_product_ids") or []),
        "link_source": "ocr_olmocr2" if engine == "olmocr2" else "ocr",
        "override_locked": aid in locked,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    rec["updated_at"] = datetime.now(timezone.utc).isoformat()
    REC_OUT.write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")

    if apply_links and aid not in locked and suggested_ids:
        # patch branding-index in-place for this asset only
        idx = _load_json(BRANDING_INDEX, {})
        for a in idx.get("assets") or []:
            if a.get("id") == aid:
                a["linked_product_ids"] = suggested_ids[:4]
                a["ocr_text"] = text
                a["link_source"] = store[aid]["link_source"]
                break
        idx["ocr_assoc_at"] = datetime.now(timezone.utc).isoformat()
        BRANDING_INDEX.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
        result["applied"] = True
    elif aid in locked:
        result["skipped_reason"] = "manual_override"

    return result


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--asset-id", action="append", default=[], help="M-SHOP404317-02-26")
    ap.add_argument("--path", action="append", default=[], help="Bezposrednia sciezka obrazu")
    ap.add_argument("--engine", choices=("olmocr2", "rapid"), default="olmocr2")
    ap.add_argument("--apply", action="store_true", help="Zapisz linki (z szacunkiem override)")
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--missing-sku-only", action="store_true")
    ap.add_argument("--status", action="store_true")
    args = ap.parse_args()

    if args.status:
        print(json.dumps(olmocr_status(), ensure_ascii=False, indent=2))
        return 0

    file_index = _load_json(FILE_INDEX, {})
    associations = _load_json(ASSOC_JSON, {})
    locked = _override_locked_ids()
    branding = _load_json(BRANDING_INDEX, {})
    assets_by_id = {a.get("id"): a for a in (branding.get("assets") or []) if a.get("id")}

    targets: list[dict] = []
    for aid in args.asset_id:
        a = assets_by_id.get(aid)
        if a:
            targets.append(a)
        else:
            targets.append({"id": aid, "name": aid, "path": "", "linked_product_ids": []})
    for p in args.path:
        targets.append(
            {
                "id": Path(p).stem[:80],
                "name": Path(p).name,
                "path": p,
                "linked_product_ids": [],
            }
        )

    if not targets:
        # default sample: assets without sku in name, prefer graphics
        picked = 0
        for a in branding.get("assets") or []:
            if picked >= args.limit:
                break
            name = str(a.get("name") or "")
            if a.get("media_type") not in (None, "image"):
                continue
            if args.missing_sku_only and extract_skus(name, str(a.get("path") or "")):
                continue
            path = Path(str(a.get("path") or ""))
            if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            targets.append(a)
            picked += 1

    STATUS.write_text(
        json.dumps({"ok": True, "state": "running", "total": len(targets)}, ensure_ascii=False),
        encoding="utf-8",
    )
    results = []
    for a in targets:
        print(f"OCR {a.get('id')} ...", flush=True)
        r = process_asset(
            a,
            file_index=file_index,
            associations=associations,
            locked=locked,
            engine=args.engine,
            apply_links=args.apply,
        )
        results.append(r)
        print(json.dumps({k: r.get(k) for k in ("id", "locked_override", "suggestions", "ocr_meta", "skipped_reason")}, ensure_ascii=False), flush=True)

    out = {
        "ok": True,
        "state": "done",
        "engine": args.engine,
        "count": len(results),
        "results": results,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
    STATUS.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"done count={len(results)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
