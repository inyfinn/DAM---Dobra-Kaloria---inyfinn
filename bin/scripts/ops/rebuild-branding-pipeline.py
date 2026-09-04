# -*- coding: utf-8 -*-
"""One-shot branding fat + grid rebuild (helper for watch-file-index / ops).

Not an always-on daemon. Called after product file-index rebuild or when
marketing materials roots change. Uses branding O_EXCL lock + resolve_script_python
(python.exe with bundled ijson — never bare pythonw without ijson).
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

SCRIPT = Path(__file__).resolve()
BIN_ROOT = SCRIPT.parents[2]
DESKTOP = BIN_ROOT / "apps" / "desktop"
WEB = BIN_ROOT / "apps" / "web"
BUILD_FAT = WEB / "scripts" / "build-branding-index.py"
BUILD_GRID = WEB / "scripts" / "build-branding-grid-index.py"
LOCK_FILE = DESKTOP / "data" / "branding-rebuild.lock.json"

if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))


def main() -> int:
    ap = argparse.ArgumentParser(description="Rebuild branding-index + branding-grid-index")
    ap.add_argument("--skip-fat", action="store_true", help="Only slim grid from existing fat")
    args = ap.parse_args()

    from branding_publish import (  # noqa: WPS433
        canonical_sqlite_path,
        grid_from_sqlite_argv,
        resolve_script_python,
    )
    from rebuild_lock import acquire_lock

    try:
        py = resolve_script_python(require_ijson=True)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    handle, meta = acquire_lock(
        LOCK_FILE,
        stage="branding:ops_pipeline",
        ttl_sec=7200,
        extra={"owner": "rebuild-branding-pipeline", "mode": "full"},
    )
    if handle is None:
        print(f"skip lock_held meta={meta}", file=sys.stderr)
        return 3

    _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
    try:
        if not args.skip_fat:
            if not BUILD_FAT.is_file():
                print(f"ERROR: missing {BUILD_FAT}", file=sys.stderr)
                return 1
            handle.update(stage="branding:fat")
            print(f"[branding-pipeline] fat via {py}")
            rc = subprocess.call([py, str(BUILD_FAT)], creationflags=_no_win)
            if rc != 0:
                print(f"ERROR: fat_build_rc_{rc}", file=sys.stderr)
                return rc

        if not BUILD_GRID.is_file():
            print(f"ERROR: missing {BUILD_GRID}", file=sys.stderr)
            return 1
        handle.update(stage="branding:grid_from_sqlite")
        db = canonical_sqlite_path(desktop_dir=DESKTOP)
        cmd = grid_from_sqlite_argv(BUILD_GRID, db, python_exe=py)
        print(f"[branding-pipeline] grid {' '.join(cmd)}")
        rc2 = subprocess.call(cmd, creationflags=_no_win, cwd=str(BUILD_GRID.parent))
        if rc2 != 0:
            print(f"ERROR: grid_build_rc_{rc2}", file=sys.stderr)
            return rc2
        print(
            {
                "ok": True,
                "finished": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "pid": os.getpid(),
                "python": py,
            }
        )
        return 0
    finally:
        try:
            handle.release()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
