# -*- coding: utf-8 -*-
"""Link wykrojnik registry entries to DAM products.

Strategie (kolejno, merge):
1. Kolejka ręczna: wykrojnik-mapping-queue.json (pending + resolved z product_id)
2. Pole product_index z XLSX (numer indeksu GC/DK) → indexes w file-index
3. PDF w folderze WYKROJNIKI: nazwa zawiera kod Kubara (owijka_0001, fol_jedn_…)
   + ewentualny ARTYKUL/indeks numeryczny w nazwie
4. Luźne dopasowanie nazwa/asortyment → display_name produktu (tylko gdy jednoznaczne)
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
REGISTRY = WEB / "data" / "wykrojniki-registry.json"
INDEX = WEB / "data" / "file-index.json"
QUEUE = WEB / "data" / "wykrojnik-mapping-queue.json"
WYK_ROOT = Path(r"X:/Marketing/- POLSKA/01 - PRODUKTY/01 - WYKROJNIKI")

KOD_RE = re.compile(r"(?:ARTYKUL[:\s]+)?(\d{5,9}(?:\.\d{2})?)", re.I)
ROW_PLACEHOLDER_RE = re.compile(r"^row[-_]?\d+$", re.I)


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def product_maps(file_index: dict) -> tuple[dict[str, list[str]], dict[str, list[str]], dict[str, str]]:
    by_index: dict[str, list[str]] = {}
    by_name: dict[str, list[str]] = {}
    labels: dict[str, str] = {}
    for p in file_index.get("products") or []:
        pid = p.get("id")
        if not pid:
            continue
        label = (p.get("display_name") or p.get("name") or pid).strip()
        labels[pid] = label
        for idx in p.get("indexes") or []:
            s = str(idx).strip()
            if not s:
                continue
            base = s.split(".")[0]
            by_index.setdefault(s, []).append(pid)
            by_index.setdefault(base, []).append(pid)
        for base in p.get("index_bases") or []:
            b = str(base).strip()
            if b:
                by_index.setdefault(b, []).append(pid)
        name = label.lower()
        if name:
            by_name.setdefault(name, []).append(pid)
            # short token key for fuzzy-ish equality
            compact = re.sub(r"[^a-z0-9]+", " ", name).strip()
            if compact:
                by_name.setdefault(compact, []).append(pid)
    return by_index, by_name, labels


def uniq(ids: list[str]) -> list[str]:
    return sorted(set(x for x in ids if x))


def apply_queue(entries: dict, queue: dict) -> int:
    n = 0
    for bucket in ("pending", "resolved"):
        for it in queue.get(bucket) or []:
            if not isinstance(it, dict):
                continue
            kod = str(it.get("wykrojnik_kod") or it.get("kod") or "").strip()
            pid = str(it.get("product_id") or "").strip()
            if not kod or not pid or ROW_PLACEHOLDER_RE.match(kod):
                continue
            block = entries.setdefault(
                kod,
                {
                    "kod": kod,
                    "nazwa": "",
                    "linked_product_ids": [],
                    "source": "queue",
                },
            )
            before = set(block.get("linked_product_ids") or [])
            block["linked_product_ids"] = uniq(list(before) + [pid])
            if pid not in before:
                n += 1
                block["link_rule"] = "manual_queue"
    return n


def link_by_index(entries: dict, by_index: dict[str, list[str]]) -> int:
    n = 0
    for ent in entries.values():
        idx = str(ent.get("product_index") or "").strip()
        if not idx:
            continue
        # may contain multiple tokens
        tokens = re.findall(r"\d{5,9}(?:\.\d{2})?", idx) or [idx]
        found: list[str] = []
        for t in tokens:
            found.extend(by_index.get(t) or [])
            found.extend(by_index.get(t.split(".")[0]) or [])
        if not found:
            continue
        before = set(ent.get("linked_product_ids") or [])
        ent["linked_product_ids"] = uniq(list(before) + found)
        if set(ent["linked_product_ids"]) - before:
            n += 1
            ent["link_rule"] = (ent.get("link_rule") or "") + "+product_index"
    return n


def link_by_pdfs(entries: dict, by_index: dict[str, list[str]]) -> int:
    if not WYK_ROOT.is_dir():
        return 0
    n = 0
    kod_keys = sorted(entries.keys(), key=len, reverse=True)
    for pdf in WYK_ROOT.rglob("*.pdf"):
        stem = pdf.stem.lower()
        text = pdf.stem + " " + str(pdf)
        matched_kod = None
        for kod in kod_keys:
            if ROW_PLACEHOLDER_RE.match(kod):
                continue
            if kod.lower() in stem:
                matched_kod = kod
                break
        if not matched_kod:
            continue
        block = entries[matched_kod]
        block["pdf_path"] = str(pdf).replace("\\", "/")
        linked = list(block.get("linked_product_ids") or [])
        km = KOD_RE.search(text)
        if km:
            kod_num = km.group(1)
            linked.extend(by_index.get(kod_num) or [])
            linked.extend(by_index.get(kod_num.split(".")[0]) or [])
        before = set(block.get("linked_product_ids") or [])
        block["linked_product_ids"] = uniq(linked)
        if set(block["linked_product_ids"]) - before:
            n += 1
            block["link_rule"] = (block.get("link_rule") or "") + "+pdf"
    return n


def link_by_name(entries: dict, by_name: dict[str, list[str]]) -> int:
    n = 0
    for ent in entries.values():
        if ent.get("linked_product_ids"):
            continue
        nazwa = str(ent.get("nazwa") or "").strip().lower()
        if len(nazwa) < 4:
            continue
        compact = re.sub(r"[^a-z0-9]+", " ", nazwa).strip()
        candidates = by_name.get(nazwa) or by_name.get(compact) or []
        # unique product only
        uniq_ids = uniq(candidates)
        if len(uniq_ids) != 1:
            continue
        ent["linked_product_ids"] = uniq_ids
        ent["link_rule"] = "name_exact"
        n += 1
    return n


def main() -> int:
    registry = load_json(REGISTRY, {"entries": {}})
    file_index = load_json(INDEX, {"products": []})
    queue = load_json(QUEUE, {"pending": [], "resolved": []})
    by_index, by_name, _labels = product_maps(file_index)
    entries = registry.setdefault("entries", {})
    # drop pure row-N garbage from display logic later; keep file clean of empty placeholders
    stats = {
        "queue": apply_queue(entries, queue),
        "index": link_by_index(entries, by_index),
        "pdf": link_by_pdfs(entries, by_index),
        "name": link_by_name(entries, by_name),
    }
    linked = sum(1 for e in entries.values() if e.get("linked_product_ids"))
    registry["updated_at"] = datetime.now(timezone.utc).isoformat()
    registry["link_stats"] = {**stats, "linked_entries": linked, "total_entries": len(entries)}
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {REGISTRY} linked={linked} stats={stats}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
