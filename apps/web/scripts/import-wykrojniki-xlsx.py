# -*- coding: utf-8 -*-
"""Import wykrojniki from Kubara Excel into wykrojniki-registry.json."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "data" / "wykrojniki-registry.json"
DEFAULT_XLSX = Path(
    r"X:/Marketing/- POLSKA/01 - PRODUKTY/01 - WYKROJNIKI/opakowania_Kubara_baza_danych.xlsx"
)


def load_rows_xlsx(path: Path) -> list[dict]:
    try:
        import openpyxl  # type: ignore
    except ImportError:
        return []
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h or "").strip().lower() for h in rows[0]]
    out = []
    for row in rows[1:]:
        if not row or not any(row):
            continue
        item = {}
        for i, h in enumerate(headers):
            if not h:
                continue
            item[h] = row[i] if i < len(row) else None
        out.append(item)
    return out


def norm_key(val) -> str:
    return re.sub(r"\s+", " ", str(val or "").strip())


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", default=str(DEFAULT_XLSX))
    args = ap.parse_args()
    path = Path(args.xlsx)
    rows = load_rows_xlsx(path) if path.is_file() else []
    entries = {}
    for i, row in enumerate(rows):
        kod = norm_key(row.get("kod") or row.get("art") or row.get("artykul") or row.get("indeks"))
        if not kod:
            kod = f"row-{i+1}"
        entries[kod] = {
            "kod": kod,
            "nazwa": norm_key(row.get("nazwa") or row.get("name") or ""),
            "drukarnia": norm_key(row.get("drukarnia") or ""),
            "podloze": norm_key(row.get("podłoże") or row.get("podloze") or ""),
            "stacje_kolorow": row.get("stacje kolorów") or row.get("stacje_kolorow"),
            "zapas": row.get("zapas"),
            "status": norm_key(row.get("status") or ""),
            "tag_tier": "low",
            "linked_product_ids": [],
            "source": "xlsx",
        }
    payload = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source_xlsx": str(path).replace("\\", "/"),
        "entries": entries,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} entries={len(entries)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
