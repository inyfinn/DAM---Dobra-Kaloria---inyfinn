# -*- coding: utf-8 -*-
"""
Watcher: szybkie odswiezanie indeksu + miniatur po zmianie wizualizacji na dysku.

Domyslnie: X:/Marketing (DK+GC), interwal 5s, skan mtime do 3 poziomow
(kategoria / produkt / wariant) - wystarczy by wykryc nowy plik w 4 - WIZKI.

Usage:
  python apps/web/scripts/watch-file-index.py
  python apps/web/scripts/watch-file-index.py --interval 5
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

SCRIPT = Path(__file__).resolve()
BUILD = SCRIPT.parent / "build-file-index.py"


def resolve_marketing_base() -> Path:
    for candidate in (Path(r"X:/Marketing"), Path(r"D:/Marketing")):
        if (candidate / "- POLSKA").is_dir():
            return candidate
    return Path(r"X:/Marketing")


def watch_roots(base: Path) -> list[Path]:
    roots = [
        base / "- POLSKA" / "01 - PRODUKTY" / "- DK",
        base / "- EKSPORT" / "01 - PRODUCTS" / "- GC",
    ]
    return [r for r in roots if r.is_dir()]


def tree_mtime(root: Path, max_depth: int = 3) -> float:
    """Najnowszy mtime do max_depth (0=root). Szybkie, bez walku calego dysku."""
    latest = 0.0
    try:
        latest = root.stat().st_mtime
    except OSError:
        return 0.0

    def walk(p: Path, depth: int) -> None:
        nonlocal latest
        if depth > max_depth:
            return
        try:
            children = list(p.iterdir())
        except OSError:
            return
        for child in children:
            try:
                st = child.stat()
            except OSError:
                continue
            if st.st_mtime > latest:
                latest = st.st_mtime
            # WIZKI / VISUALS - jeden poziom glebiej nawet na limicie
            name_u = child.name.upper()
            if child.is_dir() and (
                depth < max_depth
                or "WIZ" in name_u
                or "VISUAL" in name_u
            ):
                walk(child, depth + 1)

    walk(root, 0)
    return latest


def roots_mtime(roots: list[Path]) -> float:
    return max((tree_mtime(r) for r in roots), default=0.0)


def rebuild() -> int:
    return subprocess.call([sys.executable, str(BUILD)])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=float, default=5.0, help="Sekundy miedzy checkami")
    ap.add_argument("--depth", type=int, default=3)
    ap.add_argument("--once", action="store_true", help="Jeden rebuild i wyjscie")
    args = ap.parse_args()

    base = resolve_marketing_base()
    roots = watch_roots(base)
    if not roots:
        raise SystemExit(f"Brak rootow produktow pod {base}")

    print(f"[watch] base={base} roots={len(roots)} interval={args.interval}s")
    for r in roots:
        print(f"[watch]   {r}")

    if args.once:
        raise SystemExit(rebuild())

    last = roots_mtime(roots)
    # Pierwszy przebieg: upewnij sie ze indeks jest swiezy
    print("[watch] initial rebuild...")
    if rebuild() == 0:
        last = roots_mtime(roots)
        print("[watch] initial OK")
    else:
        print("[watch] initial rebuild failed - dalej monitoruje")

    while True:
        time.sleep(max(1.0, float(args.interval)))
        try:
            current = roots_mtime(roots)
        except OSError as e:
            print(f"[watch] skip: {e}")
            continue
        if current <= last:
            continue
        print(f"[watch] change {last:.0f} -> {current:.0f}; rebuild...")
        rc = rebuild()
        if rc == 0:
            last = current
            print("[watch] rebuild OK")
        else:
            print(f"[watch] rebuild failed rc={rc}")


if __name__ == "__main__":
    main()
