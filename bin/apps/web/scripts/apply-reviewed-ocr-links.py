# -*- coding: utf-8 -*-
"""Zapisz przejrzane (OCR + poprawki) skojarzenia material -> produkt prosto do aplikacji.

Wejscie: JSON
  {"links":   {"br-000123": ["tiramisu-czekolada-kakao-deserowe", ...], ...},
   "pending": {"br-000456": ["kandydat-a", "kandydat-b"], ...}}

- "links"   -> status 'auto'    (widoczne od razu w Brandingu; siatka bierze auto|confirmed)
- "pending" -> status 'pending' (tylko przypadki nierozstrzygalne; kolejka Quizu)
Nigdy nie nadpisuje recznych decyzji (confirmed/rejected/skipped) ani innych zrodel.
Na koniec przebudowuje branding-grid-index.json z kazdej zaktualizowanej bazy.

Uzycie: python apply-reviewed-ocr-links.py decisions.json --db <sqlite> [--db <sqlite> ...]
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

SOURCE = "ocr_rapid_reviewed"
GRID_SCRIPT = Path(__file__).resolve().parent / "build-branding-grid-index.py"


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def apply(db: Path, links: dict, pending: dict, valid_products: set[str]) -> dict:
    stats = {"auto": 0, "pending": 0, "skipped_manual": 0, "unknown_product": 0}
    conn = sqlite3.connect(str(db), timeout=60)
    try:
        with conn:
            for status, mapping in (("auto", links), ("pending", pending)):
                for aid, pids in mapping.items():
                    for pid in pids:
                        if pid not in valid_products:
                            stats["unknown_product"] += 1
                            continue
                        row = conn.execute(
                            "SELECT status FROM asset_product_links WHERE asset_id=? AND product_id=?",
                            (aid, pid),
                        ).fetchone()
                        if row and row[0] in ("confirmed", "rejected", "skipped"):
                            stats["skipped_manual"] += 1
                            continue
                        conn.execute(
                            "INSERT INTO asset_product_links "
                            "(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                            "VALUES (?,?,?,?,?,?,?,?) "
                            "ON CONFLICT(asset_id, product_id) DO UPDATE SET "
                            "status=excluded.status, source=excluded.source, score=excluded.score, "
                            "reason=excluded.reason, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
                            (aid, pid, 95.0 if status == "auto" else 60.0, SOURCE, status,
                             "ocr_rapid+ai_review", _now(), "ocr-review"),
                        )
                        stats[status] += 1
    finally:
        conn.close()
    return stats


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("decisions", type=Path)
    ap.add_argument("--db", type=Path, action="append", required=True)
    ap.add_argument("--file-index", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "file-index.json")
    args = ap.parse_args()

    data = json.loads(args.decisions.read_text(encoding="utf-8"))
    links = data.get("links") or {}
    pending = data.get("pending") or {}
    fi = json.loads(args.file_index.read_text(encoding="utf-8"))
    valid = {p["id"] for p in fi.get("products") or [] if p.get("id")}

    for db in args.db:
        st = apply(db, links, pending, valid)
        print(db, json.dumps(st))
        web_data = db.parent.parent / "apps" / "web" / "data"
        grid_script = db.parent.parent / "apps" / "web" / "scripts" / GRID_SCRIPT.name
        dam_py = db.parent.parent / "runtime" / "win" / "python" / "python.exe"
        if grid_script.is_file() and dam_py.is_file():
            subprocess.run(
                [str(dam_py), str(grid_script), "--from-sqlite", str(db),
                 "--src", str(web_data / "branding-index.json"),
                 "--out", str(web_data / "branding-grid-index.json")],
                check=False,
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
