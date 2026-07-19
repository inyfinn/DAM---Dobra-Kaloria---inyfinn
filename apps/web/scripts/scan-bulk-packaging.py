# -*- coding: utf-8 -*-
"""Scan bulk packaging PDFs and update bulk-packaging.json."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "data" / "bulk-packaging.json"
BULK_DIRS = [
    Path(r"X:/Marketing/- POLSKA/01 - PRODUKTY/03 - OPAKOWANIA ZBIORCZE"),
    Path(r"X:/Marketing/- POLSKA/01 - PRODUKTY/01 - WYKROJNIKI/kartony_zbiorcze"),
]
FACE_RE = re.compile(r"(\d+)face", re.I)
GRID_RE = re.compile(r"(\d+)x(\d+)", re.I)
KAR_RE = re.compile(r"kar_zbior_\d+_(\d+x\w+)", re.I)


def pack_id(faces: int, grid: str) -> str:
    return f"pak:{faces}f-{grid.lower()}"


def label_for(faces: int, grid: str) -> str:
    parts = grid.lower().split("x")
    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
        return f"{faces}F · {parts[0]}×{parts[1]}"
    return f"{faces}F · {grid}"


def main() -> int:
    data = json.loads(OUT.read_text(encoding="utf-8")) if OUT.is_file() else {"version": 1, "packs": {}}
    packs = data.setdefault("packs", {})
    for root in BULK_DIRS:
        if not root.is_dir():
            continue
        for pdf in root.rglob("*.pdf"):
            name = pdf.name
            path = str(pdf).replace("\\", "/")
            faces = 1
            grid = "1x1"
            fm = FACE_RE.search(name)
            if fm:
                faces = int(fm.group(1))
            gm = GRID_RE.search(name)
            if gm:
                grid = f"{gm.group(1)}x{gm.group(2)}"
            km = KAR_RE.search(name)
            if km:
                grid = km.group(1).lower().replace("mini", "mini")
            pid = pack_id(faces, grid)
            packs[pid] = {
                "label": label_for(faces, grid),
                "grid": grid,
                "faces": faces,
                "units_total": None,
                "type": "tacka" if "karton" in name.lower() else "wykrojnik",
                "tag_tier": "low",
                "source_pdf": path,
                "flat_dimensions_mm": {"w": None, "h": None, "d": None},
                "notes": "",
            }
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} packs={len(packs)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
