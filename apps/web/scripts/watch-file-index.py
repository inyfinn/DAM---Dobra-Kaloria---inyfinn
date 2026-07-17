# -*- coding: utf-8 -*-
"""
Lightweight watcher: every 60s check mtime of DK scan root; rebuild indexes if changed.

Usage:
  python apps/web/scripts/watch-file-index.py
  python apps/web/scripts/watch-file-index.py --interval 60 --root "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK"
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

SCRIPT = Path(__file__).resolve()
BUILD = SCRIPT.parent / "build-file-index.py"
DEFAULT_ROOT = Path(r"D:/Marketing/- POLSKA/01 - PRODUKTY/- DK")


def root_mtime(root: Path) -> float:
    """Best-effort newest mtime under root (top-level dirs only for speed)."""
    latest = root.stat().st_mtime
    try:
        for child in root.iterdir():
            if child.is_dir():
                latest = max(latest, child.stat().st_mtime)
    except OSError:
        pass
    return latest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(DEFAULT_ROOT))
    ap.add_argument("--interval", type=int, default=60)
    args = ap.parse_args()

    root = Path(args.root)
    if not root.exists():
        raise SystemExit(f"Root not found: {root}")

    last = root_mtime(root)
    print(f"[watch] root={root} interval={args.interval}s last_mtime={last:.0f}")

    while True:
        time.sleep(args.interval)
        try:
            current = root_mtime(root)
        except OSError as e:
            print(f"[watch] skip check: {e}")
            continue

        if current <= last:
            print(f"[watch] no change (mtime={current:.0f})")
            continue

        print(f"[watch] change detected {last:.0f} -> {current:.0f}; rebuilding...")
        rc = subprocess.call([sys.executable, str(BUILD), "--root", str(root)])
        if rc == 0:
            last = current
            print("[watch] rebuild OK")
        else:
            print(f"[watch] rebuild failed rc={rc}")


if __name__ == "__main__":
    main()
