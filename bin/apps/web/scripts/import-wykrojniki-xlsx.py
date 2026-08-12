# -*- coding: utf-8 -*-
"""Import wykrojniki from Kubara Excel into wykrojniki-registry.json.

Źródło: X:/.../01 - WYKROJNIKI/opakowania_Kubara_baza_danych.xlsx
Arkusz ma sekcje (OWIJKI, KARTONY…) z powtarzanymi nagłówkami w wierszu:
  LP | oznaczenie Kubara | … | asortyment | … | numer indeksu GC / DK | uwagi
Parser szuka wierszy nagłówka (kolumna 'oznaczenie'), nie zakłada wiersza 0.
"""
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

HEADER_MARKERS = ("oznaczenie", "asortyment", "rodzaj opakowania")
SKIP_SECTION_RE = re.compile(
    r"^(owijki|kartony|folie|rękaw|rekaw|a\s*-\s*format|lp\b)",
    re.I,
)
ROW_PLACEHOLDER_RE = re.compile(r"^row[-_]?\d+$", re.I)


def load_rows_xlsx(path: Path) -> list[tuple]:
    try:
        import openpyxl  # type: ignore
    except ImportError:
        return []
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    return list(ws.iter_rows(values_only=True))


def norm_key(val) -> str:
    return re.sub(r"\s+", " ", str(val or "").strip())


def norm_header(val) -> str:
    s = norm_key(val).lower()
    s = (
        s.replace("ł", "l")
        .replace("ó", "o")
        .replace("ą", "a")
        .replace("ę", "e")
        .replace("ś", "s")
        .replace("ć", "c")
        .replace("ń", "n")
        .replace("ź", "z")
        .replace("ż", "z")
    )
    return s


def col_map(headers: list[str]) -> dict[str, int]:
    """Map logical field -> column index from a header row."""
    out: dict[str, int] = {}
    for i, h in enumerate(headers):
        if not h:
            continue
        if "oznaczenie" in h or h in ("kod", "art", "artykul", "indeks"):
            out.setdefault("kod", i)
        elif "asortyment" in h or h in ("nazwa", "name"):
            out.setdefault("nazwa", i)
        elif "rodzaj" in h and "opak" in h:
            out.setdefault("rodzaj", i)
        elif "przeznaczenie" in h:
            out.setdefault("przeznaczenie", i)
        elif "rozmiar" in h:
            out.setdefault("rozmiar", i)
        elif "dostawca" in h or "drukarnia" in h:
            out.setdefault("drukarnia", i)
        elif "podloze" in h or "material" in h:
            out.setdefault("podloze", i)
        elif "kolor" in h:
            out.setdefault("stacje_kolorow", i)
        elif "numer indeksu" in h or ("indeks" in h and ("gc" in h or "dk" in h)):
            out.setdefault("product_index", i)
        elif h == "uwagi" or "uwag" in h:
            out.setdefault("uwagi", i)
        elif h == "status":
            out.setdefault("status", i)
        elif "lp" == h or h.startswith("lp "):
            out.setdefault("lp", i)
    return out


def is_header_row(cells: list[str]) -> bool:
    joined = " | ".join(cells)
    return all(m in joined for m in ("oznaczenie",)) and (
        "asortyment" in joined or "rodzaj" in joined
    )


def cell_at(row: tuple, idx: int | None):
    if idx is None or idx < 0 or idx >= len(row):
        return None
    return row[idx]


def load_existing_links() -> dict[str, list]:
    try:
        prev = json.loads(OUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    links: dict[str, list] = {}
    for key, ent in (prev.get("entries") or {}).items():
        if not isinstance(ent, dict):
            continue
        ids = ent.get("linked_product_ids") or []
        if ids:
            kod = norm_key(ent.get("kod") or key)
            if kod and not ROW_PLACEHOLDER_RE.match(kod):
                links[kod] = list(ids)
    return links


def parse_workbook(rows: list[tuple]) -> dict[str, dict]:
    entries: dict[str, dict] = {}
    cmap: dict[str, int] = {}
    section = ""
    for row in rows:
        if not row or not any(row):
            continue
        cells = [norm_header(c) for c in row]
        raw_cells = [norm_key(c) for c in row]
        first = raw_cells[0] if raw_cells else ""
        # Section title (single prominent label)
        nonempty = [c for c in raw_cells if c]
        if len(nonempty) == 1 and not is_header_row(cells):
            if not SKIP_SECTION_RE.match(nonempty[0]) or "format" not in nonempty[0].lower():
                section = nonempty[0]
            continue
        if is_header_row(cells):
            cmap = col_map(cells)
            continue
        if not cmap or "kod" not in cmap:
            continue
        kod = norm_key(cell_at(row, cmap.get("kod")))
        if not kod or kod.lower() in ("lp", "oznaczenie kubara"):
            continue
        if SKIP_SECTION_RE.match(kod):
            continue
        # junk single-letter codes from broken rows
        if len(kod) < 2:
            continue
        nazwa = norm_key(cell_at(row, cmap.get("nazwa")))
        product_index = norm_key(cell_at(row, cmap.get("product_index")))
        entries[kod] = {
            "kod": kod,
            "nazwa": nazwa,
            "rodzaj": norm_key(cell_at(row, cmap.get("rodzaj"))),
            "przeznaczenie": norm_key(cell_at(row, cmap.get("przeznaczenie"))),
            "rozmiar": norm_key(cell_at(row, cmap.get("rozmiar"))),
            "drukarnia": norm_key(cell_at(row, cmap.get("drukarnia"))),
            "podloze": norm_key(cell_at(row, cmap.get("podloze"))),
            "stacje_kolorow": cell_at(row, cmap.get("stacje_kolorow")),
            "product_index": product_index,
            "uwagi": norm_key(cell_at(row, cmap.get("uwagi"))),
            "status": norm_key(cell_at(row, cmap.get("status"))),
            "section": section,
            "tag_tier": "low",
            "linked_product_ids": [],
            "source": "xlsx",
        }
    return entries


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", default=str(DEFAULT_XLSX))
    args = ap.parse_args()
    path = Path(args.xlsx)
    rows = load_rows_xlsx(path) if path.is_file() else []
    prev_links = load_existing_links()
    entries = parse_workbook(rows) if rows else {}
    for kod, ent in entries.items():
        if kod in prev_links:
            ent["linked_product_ids"] = sorted(set(prev_links[kod]))
    payload = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source_xlsx": str(path).replace("\\", "/"),
        "entry_count": len(entries),
        "entries": entries,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} entries={len(entries)} preserved_links={sum(1 for v in prev_links.values() if v)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
