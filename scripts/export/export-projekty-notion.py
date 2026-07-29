#!/usr/bin/env python3
"""Eksport na pulpit (dodowy sesja 2) — wrapper wokół export-produkty-baza."""

from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = Path(__file__).resolve().parent / "export-produkty-baza.py"
OUT_DIR = Path.home() / "Desktop" / "dodowy sesja 2"
OUT_MD = OUT_DIR / "DAM-projekty-eksport-notion.md"


def _load():
    spec = importlib.util.spec_from_file_location("export_produkty_baza", MODULE)
    if not spec or not spec.loader:
        raise RuntimeError("brak export-produkty-baza.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    mod = _load()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stats = mod.export_produkty_baza(out_path=OUT_MD)
    print(f"OK: {stats['out']}")
    print(
        "products={products} dk={dk} gc={gc} complete={complete} wizki={wizki} project={project}".format(
            **stats
        )
    )


if __name__ == "__main__":
    main()
