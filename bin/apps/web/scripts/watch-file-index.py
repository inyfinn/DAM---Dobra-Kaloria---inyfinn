# -*- coding: utf-8 -*-
"""
Watcher: szybkie odswiezanie indeksu + miniatur po zmianie wizualizacji na dysku.

Wspoldzielony O_EXCL lock z recznym POST /index/rebuild.
Status + log sterowane przez index_supervisor (bridge owner).

Po udanym file-index: hook branding (scripts/ops/rebuild-branding-pipeline.py) —
jeden watcher, bez drugiego demona.

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
import threading
import time
from pathlib import Path

SCRIPT = Path(__file__).resolve()
BUILD = SCRIPT.parent / "build-file-index.py"
DESKTOP_DATA = SCRIPT.parents[2] / "desktop" / "data"
DEFAULT_STATUS = DESKTOP_DATA / "index-watcher-status.json"
DEFAULT_LOCK = DESKTOP_DATA / "index-rebuild.lock.json"
BIN_ROOT = SCRIPT.parents[3]
BRANDING_PIPELINE = BIN_ROOT / "scripts" / "ops" / "rebuild-branding-pipeline.py"

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


def _script_python() -> str:
    """Prefer pythonw.exe — console python.exe flashes a CMD window on spawn."""
    try:
        from branding_publish import resolve_script_python

        return resolve_script_python(require_ijson=False)
    except Exception:
        exe = Path(sys.executable)
        pyw = exe.with_name("pythonw.exe")
        if pyw.is_file():
            return str(pyw)
        return str(exe)


def watch_product_roots(base: Path) -> list[Path]:
    roots = [
        base / "- POLSKA" / "01 - PRODUKTY" / "- DK",
        base / "- EKSPORT" / "01 - PRODUCTS" / "- GC",
    ]
    return [r for r in roots if r.is_dir()]


def _builder_env() -> dict[str, str]:
    """Same DAM_INDEX_LIVE_FILE contract as index_supervisor / bridge rebuild."""
    try:
        from index_supervisor import index_builder_env

        return index_builder_env()
    except Exception:
        env = os.environ.copy()
        live = DESKTOP_DATA / "index-live.json"
        raw = (env.get("DAM_INDEX_LIVE_FILE") or "").strip()
        if not raw or raw in {".", "./", ".\\"}:
            env["DAM_INDEX_LIVE_FILE"] = str(live)
        return env


def watch_branding_roots(base: Path) -> list[Path]:
    """Full branding scan set from build-branding-index.scan_marketing_roots.

    Any new file under these trees (image, video, svg, vector, doc — whatever
    branding already indexes) must trigger the branding pipeline immediately.
    Product DK/GC trees stay on watch_product_roots (file-index + branding hook).
    """
    polska = base / "- POLSKA"
    eksport = base / "- EKSPORT"
    roots = [
        polska / "- BRANDING i MARKA -",
        polska / "02 - FIRMOWE MATERIAŁY",
        polska / "02 - FIRMOWE MATERIALY",
        polska / "03 - MATERIAŁY GRAFICZNE",
        polska / "03 - MATERIALY GRAFICZNE",
        polska / "04 - PROCESY",
        polska / "05 - SOCIAL MEDIA",
        polska / "06 - STRONY WWW - INTERNET",
        polska / "07 - E-COMMERCE",
        polska / "08 - KAMAPANIE",
        eksport / "- BRANDING i MARKA -",
    ]
    out: list[Path] = []
    seen: set[str] = set()
    for r in roots:
        if not r.is_dir():
            continue
        try:
            key = str(r.resolve()).lower()
        except OSError:
            key = str(r).lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def tree_mtime(root: Path, max_depth: int = 5) -> float:
    """Najnowszy mtime do max_depth (0=root). Szybkie, bez walku calego dysku.

    depth 5 od -DK: kat→produkt→wariant→4-WIZKI→INTERNET-PREZENTACJE-RGB.
    depth 3 konczylo na folderze wariantu i nie widzialo nowych plikow w WIZKI.
    """
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
                depth < max_depth
                or "WIZ" in name_u
                or "VISUAL" in name_u
                or "DRUK" in name_u
                or "BRAND" in name_u
            ):
                walk(child, depth + 1)

    walk(root, 0)
    return latest


def roots_mtime(roots: list[Path], max_depth: int = 5) -> float:
    return max((tree_mtime(r, max_depth=max_depth) for r in roots), default=0.0)


def _read_status(path: Path) -> dict:
    """Read the status JSON without ever raising.

    ValueError covers JSONDecodeError and UnicodeDecodeError (Synology Drive copy
    with byte 0x81 killed the watcher once). A file that stays unreadable after one
    retry is moved to <name>.corrupt so the loop continues from an empty dict.
    Separate process from index_supervisor, hence a local copy of the helper.
    """
    for attempt in (0, 1):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except OSError:
            return {}
        except ValueError:
            if attempt == 0:
                time.sleep(0.05)
                continue
            try:
                os.replace(path, path.with_name(path.name + ".corrupt"))
                print(f"[watch] corrupt status moved to {path.name}.corrupt")
            except OSError:
                pass
            return {}
        return data if isinstance(data, dict) else {}
    return {}


def _write_status(path: Path, payload: dict, *, preserve_last: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = dict(payload)
    if preserve_last and path.is_file():
        prev = _read_status(path)
        if isinstance(prev, dict):
            for key in ("last_ok", "last_rc", "last_error", "last_started", "last_finished", "last_duration_sec"):
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


def spawn_branding_pipeline(*, status_file: Path | None = None) -> None:
    """Fire-and-forget branding fat+grid (same lock as POST /branding/rebuild)."""
    if not BRANDING_PIPELINE.is_file():
        print(f"[watch] branding hook skip: missing {BRANDING_PIPELINE}")
        return
    try:
        py = _script_python()
        try:
            from branding_publish import resolve_script_python

            py = resolve_script_python(require_ijson=True)
        except RuntimeError as exc:
            print(f"[watch] branding hook FAIL ijson: {exc}")
            if status_file is not None:
                _write_status(
                    status_file,
                    {
                        "ok": False,
                        "watcher_ok": True,
                        "branding_hook_error": str(exc),
                        "stage": "branding_hook_failed",
                    },
                )
            return
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        proc = subprocess.Popen(
            [py, str(BRANDING_PIPELINE)],
            cwd=str(BIN_ROOT),
            creationflags=flags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print(f"[watch] branding hook spawned pid={proc.pid} via {py}")
        if status_file is not None:
            _write_status(
                status_file,
                {
                    "ok": True,
                    "watcher_ok": True,
                    "branding_hook_pid": proc.pid,
                    "branding_hook_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "stage": "branding_hook_spawned",
                },
            )
    except Exception as exc:  # noqa: BLE001
        print(f"[watch] branding hook spawn error: {exc}")


def _publish_cache_after_index() -> None:
    try:
        import dam_thumb_cache

        dam_thumb_cache.start_publish_after_index()
        print("[watch] cache publish queued")
    except Exception as exc:  # noqa: BLE001
        print(f"[watch] cache publish skip: {exc}")


def rebuild_with_lock(
    *,
    lock_file: Path,
    status_file: Path,
    root_args: list[str] | None = None,
    out_dir: Path | None = None,
    stage_prefix: str = "product",
    branding_hook: bool = True,
    last_duration_sec: float | None = None,
) -> int:
    """Acquire shared lock, then run build-file-index. No scan before lock."""
    try:
        from rebuild_lock import acquire_lock
    except ImportError:
        acquire_lock = None  # type: ignore
    try:
        import index_supervisor as idx_sup
    except ImportError:
        idx_sup = None  # type: ignore

    if idx_sup is not None:
        try:
            idx_sup.begin_run_snapshot()
        except Exception:
            pass
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
        lock_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(str(lock_file), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, b'{"pid":%d}' % os.getpid())
            os.close(fd)
        except FileExistsError:
            print("[watch] skip rebuild: lock held (fallback)")
            return 2

    py = _script_python()
    cmd = [py, "-u", str(BUILD)]
    for r in root_args or []:
        cmd.extend(["--root", r])
    if out_dir is not None:
        cmd.extend(["--out-dir", str(out_dir)])

    started_ts = time.time()
    started_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    kind = "hourly" if stage_prefix == "hourly" else ("watch" if stage_prefix == "product" else stage_prefix)

    def _tick() -> None:
        elapsed = int(time.time() - started_ts)
        eta = None
        remaining = None
        if last_duration_sec:
            remaining = max(0, int(float(last_duration_sec) - elapsed))
            eta = remaining
        pct = None
        if last_duration_sec:
            try:
                pct = max(1, min(99, int(100.0 * elapsed / float(last_duration_sec))))
            except (TypeError, ValueError, ZeroDivisionError):
                pct = None
        _write_status(
            status_file,
            {
                "ok": True,
                "watcher_ok": True,
                "stage": f"{stage_prefix}:building",
                "rebuild_kind": kind,
                "kind": kind,
                "last_started": started_iso,
                "elapsed_sec": elapsed,
                "eta_sec": eta,
                "remaining_sec": remaining,
                "progress_pct": pct,
                "last_duration_sec": last_duration_sec,
                "progress_message": "Indeksowanie ROOT" if stage_prefix == "hourly" else "Indeksowanie",
                "hourly_pending": False,
                "current_item": (idx_sup.read_live() if idx_sup is not None else {}).get("current_item") or "",
                "current_name": (idx_sup.read_live() if idx_sup is not None else {}).get("current_name") or "",
                "current_path": (idx_sup.read_live() if idx_sup is not None else {}).get("current_path") or "",
                "current_label": (idx_sup.read_live() if idx_sup is not None else {}).get("current_label") or "",
                "products_done": (idx_sup.read_live() if idx_sup is not None else {}).get("products_done"),
                "products_total": (idx_sup.read_live() if idx_sup is not None else {}).get("products_total"),
            },
        )

    _write_status(
        status_file,
        {
            "ok": True,
            "watcher_ok": True,
            "stage": f"{stage_prefix}:building",
            "rebuild_kind": kind,
            "kind": kind,
            "last_started": started_iso,
            "elapsed_sec": 0,
            "eta_sec": int(last_duration_sec) if last_duration_sec else None,
            "remaining_sec": int(last_duration_sec) if last_duration_sec else None,
            "last_duration_sec": last_duration_sec,
            "progress_message": "Indeksowanie ROOT" if stage_prefix == "hourly" else "Indeksowanie",
            "hourly_pending": False,
        },
    )
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(BIN_ROOT),
            creationflags=flags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env=_builder_env(),
        )
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

    if handle is not None:
        try:
            handle.update(stage=f"{stage_prefix}:building", child_pid=proc.pid)
        except Exception:
            pass

    snap = {}
    try:
        if idx_sup is not None:
            snap = idx_sup.read_run_snapshot()
    except Exception:
        snap = {}

    def _read_builder_stdout() -> None:
        if proc.stdout is None:
            return
        for line in proc.stdout:
            try:
                print(line, end="" if str(line).endswith("\n") else "\n")
            except Exception:
                pass
            if idx_sup is None:
                continue
            try:
                parsed = idx_sup.parse_builder_live_line(line)
            except Exception:
                parsed = None
            if parsed:
                try:
                    idx_sup.merge_live_into_watcher_status(parsed, snap=snap)
                except Exception:
                    pass

    threading.Thread(target=_read_builder_stdout, daemon=True, name="dam-index-live").start()

    if idx_sup is not None:
        rc = idx_sup.wait_rebuild_proc(proc, lock_handle=handle, on_tick=_tick)
    else:
        rc = int(proc.wait())

    duration = int(time.time() - started_ts)
    cancelled = rc == 130
    _write_status(
        status_file,
        {
            "ok": rc == 0,
            "watcher_ok": True,
            "last_ok": rc == 0,
            "last_rc": rc,
            "last_error": "cancelled" if cancelled else ("" if rc == 0 else f"build_rc_{rc}"),
            "last_finished": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "last_duration_sec": duration if rc == 0 else last_duration_sec,
            "elapsed_sec": duration,
            "eta_sec": 0,
            "remaining_sec": 0,
            "stage": "cancelled" if cancelled else (f"{stage_prefix}:idle" if rc == 0 else f"{stage_prefix}:error"),
            "rebuild_kind": kind,
        },
    )
    if handle is not None:
        handle.release()
    if idx_sup is not None:
        try:
            idx_sup.complete_run_report(ok=(rc == 0), cancelled=cancelled, rc=rc)
        except Exception:
            pass
    if rc == 0 and branding_hook:
        spawn_branding_pipeline(status_file=status_file)
    if rc == 0:
        _publish_cache_after_index()
    return int(rc)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=float, default=2.0, help="Sekundy miedzy checkami")
    ap.add_argument(
        "--depth",
        type=int,
        default=5,
        help="Glebokosc mtime (DK→kat→produkt→wariant→WIZKI→RGB); bylo 3 i nie siegalo WIZKI",
    )
    ap.add_argument("--once", action="store_true", help="Jeden rebuild i wyjscie")
    ap.add_argument("--no-initial", action="store_true", help="Nie rob initial rebuild przy starcie")
    ap.add_argument("--root", action="append", default=[], help="Fixture/test root (moze byc wielokrotnie)")
    ap.add_argument("--status-file", type=Path, default=DEFAULT_STATUS)
    ap.add_argument("--lock-file", type=Path, default=DEFAULT_LOCK)
    ap.add_argument(
        "--control-file",
        type=Path,
        default=DESKTOP_DATA / "index-control.json",
        help="Cancel/snooze JSON (apps/desktop/data/index-control.json)",
    )
    ap.add_argument(
        "--hourly",
        type=float,
        default=float(os.environ.get("DAM_INDEX_HOURLY_SEC", "3600") or "3600"),
        help="Pelny skan ROOT co N sekund (0 = wylacz). Domyslnie 3600.",
    )
    ap.add_argument(
        "--first-delay",
        type=float,
        default=float(os.environ.get("DAM_INDEX_FIRST_DELAY_SEC", "20") or "20"),
        help="Opoznienie pierwszego pelnego skanu (user moze kliknac Nie dzisiaj).",
    )
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Przekaz do build-file-index --out-dir (OBOWIAZKOWE przy --root fixture)",
    )
    ap.add_argument(
        "--no-branding-hook",
        action="store_true",
        help="Nie odpalaj rebuild-branding-pipeline po file-index",
    )
    args = ap.parse_args()

    if args.root and not args.out_dir:
        raise SystemExit(
            "HARD: --root (fixture) wymaga --out-dir, aby nie nadpisac live file-index.json"
        )

    _write_status(
        args.status_file,
        {
            "ok": True,
            "watcher_ok": True,
            "stage": "starting",
            "pid": os.getpid(),
        },
    )

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

    branding_hook = not args.no_branding_hook
    branding_roots: list[Path] = []

    if args.root:
        roots = [Path(r) for r in args.root]
        roots = [r for r in roots if r.is_dir()]
        base = roots[0] if roots else Path(".")
        root_args = [str(r) for r in roots]
        product_roots = roots
    else:
        base = resolve_marketing_base()
        product_roots = watch_product_roots(base)
        branding_roots = watch_branding_roots(base)
        root_args = None

    if not product_roots and not args.root:
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

    depth = max(1, int(args.depth))
    print(
        f"[watch] base={base} product_roots={len(product_roots)} "
        f"branding_roots={len(branding_roots)} interval={args.interval}s depth={depth}"
    )
    for r in product_roots:
        print(f"[watch]   product {r}")
    for r in branding_roots:
        print(f"[watch]   branding {r}")

    if args.once:
        raise SystemExit(
            rebuild_with_lock(
                lock_file=args.lock_file,
                status_file=args.status_file,
                root_args=root_args,
                out_dir=args.out_dir,
                branding_hook=branding_hook,
            )
        )

    last_product = roots_mtime(product_roots, max_depth=depth) if product_roots else 0.0
    last_branding = roots_mtime(branding_roots, max_depth=depth) if branding_roots else 0.0
    if not args.no_initial:
        print("[watch] initial rebuild...")
        rc = rebuild_with_lock(
            lock_file=args.lock_file,
            status_file=args.status_file,
            root_args=root_args,
            out_dir=args.out_dir,
            branding_hook=branding_hook,
        )
        if rc == 0:
            last_product = (
                roots_mtime(product_roots, max_depth=depth) if product_roots else last_product
            )
            last_branding = (
                roots_mtime(branding_roots, max_depth=depth) if branding_roots else last_branding
            )
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
                "hourly_sec": float(args.hourly),
                "first_delay_sec": float(args.first_delay),
                "control_file": str(args.control_file),
                "hourly_pending": True,
            },
        )

    try:
        import index_supervisor as idx_sup
    except ImportError:
        idx_sup = None  # type: ignore

    loop_started = time.time()
    last_hourly = 0.0
    last_duration = None
    try:
        prev = _read_status(args.status_file)
        if prev.get("last_duration_sec"):
            last_duration = float(prev.get("last_duration_sec"))
    except (TypeError, ValueError):
        last_duration = None

    while True:
        time.sleep(max(1.0, float(args.interval)))
        snoozed = False
        if idx_sup is not None:
            try:
                snoozed = bool(idx_sup.is_snoozed())
            except Exception:
                snoozed = False
        hourly_sec = float(args.hourly or 0)
        due_hourly = False
        if hourly_sec > 0 and not snoozed:
            now = time.time()
            if last_hourly <= 0:
                due_hourly = (now - loop_started) >= max(0.0, float(args.first_delay))
            else:
                due_hourly = (now - last_hourly) >= hourly_sec
        if due_hourly:
            print("[watch] hourly full ROOT scan...")
            _write_status(
                args.status_file,
                {
                    "ok": True,
                    "watcher_ok": True,
                    "stage": "hourly:queued",
                    "rebuild_kind": "hourly",
                    "kind": "hourly",
                    "pid": os.getpid(),
                },
            )
            rc = rebuild_with_lock(
                lock_file=args.lock_file,
                status_file=args.status_file,
                root_args=root_args,
                out_dir=args.out_dir,
                stage_prefix="hourly",
                branding_hook=branding_hook,
                last_duration_sec=last_duration,
            )
            last_hourly = time.time()
            if rc == 0:
                try:
                    st = _read_status(args.status_file)
                    if st.get("last_duration_sec"):
                        last_duration = float(st.get("last_duration_sec"))
                except (TypeError, ValueError):
                    pass
                last_product = (
                    roots_mtime(product_roots, max_depth=depth) if product_roots else last_product
                )
                last_branding = (
                    roots_mtime(branding_roots, max_depth=depth) if branding_roots else last_branding
                )
                print("[watch] hourly OK")
            elif rc == 130:
                print("[watch] hourly cancelled")
            else:
                print(f"[watch] hourly failed rc={rc}")
            continue
        if snoozed:
            _write_status(
                args.status_file,
                {
                    "ok": True,
                    "watcher_ok": True,
                    "stage": "snoozed",
                    "pid": os.getpid(),
                    "snoozed": True,
                },
            )
            continue
        try:
            cur_product = roots_mtime(product_roots, max_depth=depth) if product_roots else 0.0
            cur_branding = roots_mtime(branding_roots, max_depth=depth) if branding_roots else 0.0
        except OSError as e:
            print(f"[watch] skip: {e}")
            continue
        product_changed = bool(product_roots) and cur_product > last_product
        branding_changed = bool(branding_roots) and cur_branding > last_branding
        if not product_changed and not branding_changed:
            continue
        if product_changed:
            print(f"[watch] product change {last_product:.0f} -> {cur_product:.0f}; rebuild...")
            rc = rebuild_with_lock(
                lock_file=args.lock_file,
                status_file=args.status_file,
                root_args=root_args,
                out_dir=args.out_dir,
                branding_hook=branding_hook,
                last_duration_sec=last_duration,
            )
            if rc == 0:
                last_product = cur_product
                last_branding = cur_branding
                print("[watch] rebuild OK")
            else:
                print(f"[watch] rebuild failed rc={rc}")
        elif branding_changed:
            print(
                f"[watch] branding change {last_branding:.0f} -> {cur_branding:.0f}; "
                "branding pipeline only..."
            )
            if branding_hook:
                spawn_branding_pipeline(status_file=args.status_file)
            last_branding = cur_branding


if __name__ == "__main__":
    main()
