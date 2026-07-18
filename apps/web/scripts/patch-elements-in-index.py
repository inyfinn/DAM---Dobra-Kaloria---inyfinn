# -*- coding: utf-8 -*-
"""Patch: doloz pliki z MATERIALY/ELEMENTY (i skladniki) do file-index.json
bez pelnego rebuildu. Aktualizuje tez rewizje z niepelna lista."""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "data" / "file-index.json"
SCAN_EXT = {
    ".ai", ".psd", ".indd", ".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff",
    ".webp", ".zip", ".rar", ".7z", ".pptx", ".ppt", ".docx", ".doc", ".key",
    ".svg", ".eps",
}


def norm(s: str) -> str:
    return (
        (s or "")
        .lower()
        .replace("ł", "l")
        .replace("ą", "a")
        .replace("ę", "e")
        .replace("ó", "o")
        .replace("ś", "s")
        .replace("ć", "c")
        .replace("ń", "n")
        .replace("ź", "z")
        .replace("ż", "z")
    )


def is_elements_dir(name: str) -> bool:
    n = norm(name)
    return (
        "elementy" in n
        or "elements" in n
        or "skladniki" in n
        or "ingredients" in n
        or n == "element"
        or n.startswith("element ")
    )


def file_entry(f: Path, root: Path) -> dict:
    return {
        "name": f.name,
        "path": str(f).replace("\\", "/"),
        "rel": str(f.relative_to(root)).replace("\\", "/") if root in f.parents or f == root else str(f).replace("\\", "/"),
        "ext": f.suffix.lower().lstrip("."),
        "size": f.stat().st_size,
        "mtime": datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds"),
        "lang": None,
        "layer": "elements",
    }


def collect_from_elements_dir(el_dir: Path, root: Path) -> list[dict]:
    out: list[dict] = []
    try:
        for f in el_dir.iterdir():
            if f.is_file() and f.suffix.lower() in SCAN_EXT:
                out.append(file_entry(f, root))
            elif f.is_dir():
                try:
                    for nested in f.iterdir():
                        if nested.is_file() and nested.suffix.lower() in SCAN_EXT:
                            out.append(file_entry(nested, root))
                except OSError:
                    pass
    except OSError:
        pass
    return out


def find_elements(rev_path: Path) -> list[dict]:
    out: list[dict] = []
    if not rev_path.is_dir():
        return out
    root = rev_path
    for p in rev_path.parents:
        if p.name.lower() == "marketing" or p.name.startswith("Marketing"):
            root = p
            break
    try:
        for sub in rev_path.iterdir():
            if not sub.is_dir():
                continue
            if is_elements_dir(sub.name):
                out.extend(collect_from_elements_dir(sub, root))
                continue
            try:
                for nested in sub.iterdir():
                    if nested.is_dir() and is_elements_dir(nested.name):
                        out.extend(collect_from_elements_dir(nested, root))
            except OSError:
                pass
    except OSError:
        return out
    # dedupe po path
    seen: set[str] = set()
    uniq: list[dict] = []
    for e in out:
        key = e.get("path") or e.get("name") or ""
        if key in seen:
            continue
        seen.add(key)
        uniq.append(e)
    return uniq


def main() -> int:
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    products = data.get("products") or []
    patched = 0
    files_added = 0
    for prod in products:
        for rev in prod.get("revisions") or []:
            path = Path(rev.get("path") or "")
            if not path.is_dir():
                continue
            found = find_elements(path)
            if not found:
                continue
            fbr = rev.setdefault("files_by_role", {})
            existing = fbr.get("elements") or []
            # aktualizuj gdy brak albo gdy znaleziono wiecej plikow
            if existing and len(existing) >= len(found):
                continue
            before = len(existing)
            fbr["elements"] = found
            slots = rev.setdefault("slots", [])
            if not any(is_elements_dir(x) or "elementy" in norm(x) or "skladniki" in norm(x) for x in slots):
                slots.append("1 - MATERIAŁY/ELEMENTY")
            patched += 1
            files_added += max(0, len(found) - before)
    INDEX.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"patched_revisions={patched} files_added={files_added}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
