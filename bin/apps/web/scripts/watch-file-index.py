# -*- coding: utf-8 -*-
"""
Watcher: szybkie odswiezanie indeksu + miniatur po zmianie wizualizacji na dysku.

Wspoldzielony O_EXCL lock z recznym POST /index/rebuild.
Status + log sterowane przez index_supervisor (bridge owner).

Usage:
  python apps/web/scripts/watch-file-index.py
  python apps/web/scripts/watch-file-index.py --interval 5 --no-initial
  python apps/web/scripts/watch-file-index.py --root C:/tmp/fixture --once
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

SCRIPT = Path(__file__).resolve()
BUILD = SCRIPT.parent / "build-file-index.py"
DESKTOP_DATA = SCRIPT.parents[2] / "desktop" / "data"
DEFAULT_STATUS = DESKTOP_DATA / "index-watcher-status.json"
DEFAULT_LOCK = DESKTOP_DATA / "index-rebuild.lock.json"

# Ensure sibling marketing_roots import works when cwd differs
if str(SCRIPT.parent) not in sys.path:
    sys.path.insert(0, str(SCRIPT.parent))
# Desktop helpers (rebuild_lock) for shared lock
_DESKTOP = SCRIPT.parents[2] / "desktop"
if _DESKTOP.is_dir() and str(_DESKTOP) not in sys.path:
    sys.path.insert(0, str(_DESKTOP))


def resolve_marketing_base() -> Path:
    from marketing_roots import resolve_marketing_base as _resolve

    return _resolve()


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
            name_u = child.name.upper()
            if child.is_dir() and (
                depth < max_depth or "WIZ" in name_u or "VISUAL" in name_u
            ):
                walk(child, depth + 1)

    walk(root, 0)
    return latest


def roots_mtime(roots: list[Path]) -> float:
    return max((tree_mtime(r) for r in roots), default=0.0)


def _write_status(path: Path, payload: dict, *, preserve_last: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = dict(payload)
    if preserve_last and path.is_file():
        try:
            prev = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            prev = {}
        if isinstance(prev, dict):
            for key in ("last_ok", "last_rc", "last_error", "last_started", "last_finished"):
                if key not in body and prev.get(key) is not None:
                    body[key] = prev.get(key)
    if body.get("last_ok") is None:
        body["awaiting_first_rebuild"] = True
    elif body.get("last_ok") is True:
        body["awaiting_first_rebuild"] = False
    body["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    tmp = path.with_name(path.name + f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    try:
        os.replace(tmp, path)
    except OSError:
        path.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        try:
            tmp.unlink()
        except OSError:
            pass


def rebuild_with_lock(
    *,
    lock_file: Path,
    status_file: Path,
    root_args: list[str] | None = None,
    out_dir: Path | None = None,
    stage_prefix: str = "product",
) -> int:
    """Acquire shared lock, then run build-file-index. No scan before lock."""
    try:
        from rebuild_lock import acquire_lock
    except ImportError:
        # Minimal fallback O_EXCL
        acquire_lock = None  # type: ignore

    handle = None
    if acquire_lock is not None:
        handle, meta = acquire_lock(
            lock_file,
            stage=f"{stage_prefix}:starting",
            ttl_sec=3600,
            extra={"owner": "watch-file-index"},
        )
        if handle is None:
            _write_status(
                status_file,
                {
                    "ok": False,
                    "watcher_ok": True,
                    "last_skip": "lock_held",
                    "lock": meta.get("lock"),
                    "stage": "skipped_lock_held",
                },
            )
            print("[watch] skip rebuild: lock held")
            return 2
    else:
        # Extremely defensive fallback
        lock_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(str(lock_file), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, b'{"pid":%d}' % os.getpid())
            os.close(fd)
        except FileExistsError:
            print("[watch] skip rebuild: lock held (fallback)")
            return 2

    cmd = [sys.executable, str(BUILD)]
    for r in root_args or []:
        cmd.extend(["--root", r])
    if out_dir is not None:
        cmd.extend(["--out-dir", str(out_dir)])

    _write_status(
        status_file,
        {
            "ok": True,
            "watcher_ok": True,
            "stage": f"{stage_prefix}:building",
            "last_started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    )
    if handle is not None:
        handle.update(stage=f"{stage_prefix}:building")

    try:
        rc = subprocess.call(cmd)
    except Exception as exc:  # noqa: BLE001
        _write_status(
            status_file,
            {
                "ok": False,
                "watcher_ok": True,
                "last_ok": False,
                "last_rc": None,
                "last_error": str(exc),
                "stage": f"{stage_prefix}:error",
            },
        )
        if handle is not None:
            handle.release()
        return 1

    _write_status(
        status_file,
        {
            "ok": rc == 0,
            "watcher_ok": True,
            "last_ok": rc == 0,
            "last_rc": rc,
            "last_error": "" if rc == 0 else f"build_rc_{rc}",
            "last_finished": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "stage": f"{stage_prefix}:idle",
        },
    )
    if handle is not None:
        handle.release()
    return int(rc)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=float, default=5.0, help="Sekundy miedzy checkami")
    ap.add_argument("--depth", type=int, default=3)
    ap.add_argument("--once", action="store_true", help="Jeden rebuild i wyjscie")
    ap.add_argument("--no-initial", action="store_true", help="Nie rob initial rebuild przy starcie")
    ap.add_argument("--root", action="append", default=[], help="Fixture/test root (moze byc wielokrotnie)")
    ap.add_argument("--status-file", type=Path, default=DEFAULT_STATUS)
    ap.add_argument("--lock-file", type=Path, default=DEFAULT_LOCK)
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Przekaz do build-file-index --out-dir (OBOWIAZKOWE przy --root fixture)",
    )
    args = ap.parse_args()

    if args.root and not args.out_dir:
        raise SystemExit(
            "HARD: --root (fixture) wymaga --out-dir, aby nie nadpisac live file-index.json"
        )

    # Status BEFORE any Marketing scan (preserve prior last_ok/rc — no false reset)
    _write_status(
        args.status_file,
        {
            "ok": True,
            "watcher_ok": True,
            "stage": "starting",
            "pid": os.getpid(),
        },
    )

    # Verify marketing_roots import early (surfaces ModuleNotFoundError in status)
    try:
        import marketing_roots  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        _write_status(
            args.status_file,
            {
                "ok": False,
                "watcher_ok": False,
                "last_ok": False,
                "last_error": f"import_marketing_roots:{exc}",
                "stage": "import_failed",
            },
        )
        raise SystemExit(f"Brak marketing_roots: {exc}")

    if args.root:
        roots = [Path(r) for r in args.root]
        roots = [r for r in roots if r.is_dir()]
        base = roots[0] if roots else Path(".")
        root_args = [str(r) for r in roots]
    else:
        base = resolve_marketing_base()
        roots = watch_roots(base)
        root_args = None  # build-file-index uses its own dual roots

    if not roots:
        _write_status(
            args.status_file,
            {
                "ok": False,
                "watcher_ok": False,
                "last_ok": False,
                "last_error": f"no_roots_under:{base}",
                "stage": "no_roots",
            },
        )
        raise SystemExit(f"Brak rootow produktow pod {base}")

    print(f"[watch] base={base} roots={len(roots)} interval={args.interval}s")
    for r in roots:
        print(f"[watch]   {r}")

    if args.once:
        raise SystemExit(
            rebuild_with_lock(
                lock_file=args.lock_file,
                status_file=args.status_file,
                root_args=root_args,
                out_dir=args.out_dir,
            )
        )

    last = roots_mtime(roots)
    if not args.no_initial:
        print("[watch] initial rebuild...")
        rc = rebuild_with_lock(
            lock_file=args.lock_file,
            status_file=args.status_file,
            root_args=root_args,
            out_dir=args.out_dir,
        )
        if rc == 0:
            last = roots_mtime(roots)
            print("[watch] initial OK")
        else:
            print(f"[watch] initial rebuild failed rc={rc} - dalej monitoruje")
    else:
        print("[watch] --no-initial: monitor only")
        _write_status(
            args.status_file,
            {
                "ok": True,
                "watcher_ok": True,
                "stage": "monitoring",
                "pid": os.getpid(),
            },
        )

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
        rc = rebuild_with_lock(
            lock_file=args.lock_file,
            status_file=args.status_file,
            root_args=root_args,
            out_dir=args.out_dir,
        )
        if rc == 0:
            last = current
            print("[watch] rebuild OK")
        else:
            print(f"[watch] rebuild failed rc={rc}")


if __name__ == "__main__":
    main()
