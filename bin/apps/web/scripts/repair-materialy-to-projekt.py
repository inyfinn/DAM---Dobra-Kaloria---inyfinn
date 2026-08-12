# -*- coding: utf-8 -*-
"""Naprawa migracji: pliki projektowe (.ai/.psd/.indd/.pdf) czasem zostaly w
"1 - MATERIALY"/"1 - MATERIALS" gdy "2 - PROJEKT"/"2 - PROJECT" jest pusty
(blad skryptu migracyjnego). Dziala dla DK i GC (2026-07-18, wg wytycznych usera).

ZASADY (KRYTYCZNE - nie zgadywac, nie kasowac):
- To jest oficjalna struktura produkcyjna - ZERO usuwania plikow.
- Jesli "2 - PROJEKT"/"2 - PROJECT" ma JUZ jakiekolwiek pliki -> NIE RUSZAMY GO.
- Jesli PROJEKT jest PUSTY -> szukamy TYLKO w TYM SAMYM folderze wariantu,
  w slocie "1 - MATERIALY"/"1 - MATERIALS" (nigdzie indziej - zaden inny
  produkt, zaden inny wariant).
- Jesli nie znajdziemy .ai/.psd/.indd/.pdf w MATERIALY -> zostawiamy w spokoju.
  Checklista i tak oznaczy wariant jako "brakuje projektu" - to jest OK,
  to jest prawda o stanie danych, nie zgadujemy czegos, czego nie ma.
- DRUK/PRINT slot jest tylko RAPORTOWANY informacyjnie (osobna sekcja) - NIGDY
  automatycznie przenoszony do PROJEKT w --apply (plik do druku ma swoje
  miejsce, przenoszenie go zmienia semantyke checklisty; wymaga recznej decyzji).
- Domyslnie DRY-RUN (zero zmian na dysku). Uzyj --apply do wykonania przeniesienia
  (tylko z MATERIALY -> PROJEKT) + wpis audit log.

Uzycie:
    python apps/web/scripts/repair-materialy-to-projekt.py                # dry-run, obie marki
    python apps/web/scripts/repair-materialy-to-projekt.py --brand GC     # dry-run, tylko GC
    python apps/web/scripts/repair-materialy-to-projekt.py --apply        # wykonaj przeniesienie
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
FILE_INDEX = WEB / "data" / "file-index.json"
DRYRUN_OUT = WEB / "data" / "materialy-to-projekt-dryrun.json"
AUDIT_LOG = WEB / "data" / "audit-log.jsonl"

PROJECT_FILE_EXT = {".ai", ".psd", ".indd", ".pdf"}


def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def slot_kind(folder_name: str) -> str | None:
    n = norm(folder_name)
    if not n:
        return None
    if "materia" in n:
        return "materialy"
    if "projekt" in n or "project" in n:
        return "projekt"
    if "druk" in n or "print" in n:
        return "druk"
    return None


def is_project_file(name: str) -> bool:
    return Path(name).suffix.lower() in PROJECT_FILE_EXT


def scan_variant(rev_path: Path) -> dict | None:
    """Zwraca kandydata (dict) jesli PROJEKT jest pusty a MATERIALY ma pliki projektowe."""
    try:
        subdirs = {d.name: d for d in rev_path.iterdir() if d.is_dir()}
    except (PermissionError, OSError):
        return None

    projekt_dir = None
    materialy_dir = None
    druk_dir = None
    for name, d in subdirs.items():
        kind = slot_kind(name)
        if kind == "projekt" and projekt_dir is None:
            projekt_dir = d
        elif kind == "materialy" and materialy_dir is None:
            materialy_dir = d
        elif kind == "druk" and druk_dir is None:
            druk_dir = d

    if projekt_dir is None:
        return None  # brak slotu PROJEKT w tym wariancie - nic do naprawy

    try:
        projekt_has_files = any(f.is_file() for f in projekt_dir.iterdir())
    except (PermissionError, OSError):
        return None
    if projekt_has_files:
        return None  # PROJEKT juz ma pliki - NIE RUSZAMY

    candidate_files: list[dict] = []
    if materialy_dir is not None:
        try:
            for f in materialy_dir.iterdir():
                if f.is_file() and is_project_file(f.name):
                    candidate_files.append({"name": f.name, "path": str(f).replace("\\", "/"), "from_slot": materialy_dir.name})
                elif f.is_dir():
                    # Jeden poziom w glab (np. "...Folder do druku") - user zglosil,
                    # ze migracja czasem zagniezdzila pliki projektowe w podfolderze
                    # MATERIALY zamiast wlozyc je prosto do PROJEKT.
                    try:
                        for nested in f.iterdir():
                            if nested.is_file() and is_project_file(nested.name):
                                candidate_files.append({
                                    "name": nested.name,
                                    "path": str(nested).replace("\\", "/"),
                                    "from_slot": materialy_dir.name + "/" + f.name,
                                })
                    except (PermissionError, OSError):
                        pass
        except (PermissionError, OSError):
            pass

    druk_info = None
    if druk_dir is not None:
        try:
            druk_files = [f.name for f in druk_dir.iterdir() if f.is_file() and is_project_file(f.name)]
            if druk_files:
                druk_info = {"slot": druk_dir.name, "files": druk_files}
        except (PermissionError, OSError):
            pass

    if not candidate_files and not druk_info:
        return None  # PROJEKT pusty, ale nic do przeniesienia - zostaw, checklist oznaczy brak

    return {
        "revision_path": str(rev_path).replace("\\", "/"),
        "projekt_slot": projekt_dir.name,
        "materialy_candidates": candidate_files,
        "druk_info_only": druk_info,
    }


def iter_revision_dirs(brand_filter: str | None):
    data = json.loads(FILE_INDEX.read_text(encoding="utf-8"))
    for p in data.get("products") or []:
        if brand_filter and p.get("brand") != brand_filter:
            continue
        for r in p.get("revisions") or []:
            path = r.get("path")
            if path:
                yield Path(path), p.get("brand"), p.get("name")


def write_audit(entries: list[dict]) -> None:
    with AUDIT_LOG.open("a", encoding="utf-8") as fh:
        for e in entries:
            fh.write(json.dumps(e, ensure_ascii=False) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--brand", default="", choices=["DK", "GC", ""], help="Ogranicz do marki (domyslnie obie)")
    ap.add_argument("--apply", action="store_true", help="Wykonaj realne przeniesienie MATERIALY -> PROJEKT")
    args = ap.parse_args()

    brand_filter = args.brand or None
    candidates = []
    seen_paths = set()
    for rev_path, brand, product_name in iter_revision_dirs(brand_filter):
        key = str(rev_path)
        if key in seen_paths:
            continue
        seen_paths.add(key)
        if not rev_path.exists():
            continue
        cand = scan_variant(rev_path)
        if cand:
            cand["brand"] = brand
            cand["product_name"] = product_name
            candidates.append(cand)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "brand_filter": brand_filter or "DK+GC",
        "total_candidates": len(candidates),
        "with_movable_files": sum(1 for c in candidates if c["materialy_candidates"]),
        "empty_no_source_found": sum(1 for c in candidates if not c["materialy_candidates"] and not c["druk_info_only"]),
        "druk_only_flagged": sum(1 for c in candidates if not c["materialy_candidates"] and c["druk_info_only"]),
        "candidates": candidates,
    }
    DRYRUN_OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Dry-run report: {DRYRUN_OUT}")
    print(f"  kandydatow z plikami do przeniesienia: {report['with_movable_files']}")
    print(f"  PROJEKT pusty, DRUK ma pliki (tylko flagowane, NIE przenoszone): {report['druk_only_flagged']}")
    print(f"  PROJEKT pusty, nic do przeniesienia (checklist oznaczy brak): {report['empty_no_source_found']}")

    if not args.apply:
        print("\nDRY-RUN tylko. Uzyj --apply aby wykonac przeniesienie MATERIALY -> PROJEKT.")
        return 0

    audit_entries = []
    moved = 0
    for cand in candidates:
        if not cand["materialy_candidates"]:
            continue
        rev_path = Path(cand["revision_path"])
        projekt_dir = rev_path / cand["projekt_slot"]
        for f in cand["materialy_candidates"]:
            src = Path(f["path"])
            if not src.is_file():
                continue
            dest = projekt_dir / src.name
            if dest.exists():
                continue  # nigdy nie nadpisuj
            shutil.move(str(src), str(dest))
            moved += 1
            audit_entries.append({
                "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "action": "materialy_to_projekt_move",
                "brand": cand.get("brand"),
                "product_name": cand.get("product_name"),
                "revision": str(rev_path),
                "file": src.name,
                "from": str(src),
                "to": str(dest),
            })
    if audit_entries:
        write_audit(audit_entries)
    print(f"\nAPPLY: przeniesiono {moved} plikow. Audit log: {AUDIT_LOG}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
