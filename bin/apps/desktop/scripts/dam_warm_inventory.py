#!/usr/bin/env python3
"""C-WARM inventory + enqueue + verify CLI (A∪B union, CPU AVIF warm)."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

DESKTOP_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = DESKTOP_DIR.parent.parent
WEB_ROOT = REPO_ROOT / "apps" / "web"
DEFAULT_FILE_INDEX = WEB_ROOT / "data" / "file-index.json"
DEFAULT_BRANDING_INDEX = WEB_ROOT / "data" / "branding-index.json"
DEFAULT_MACHINE_CONFIG = DESKTOP_DIR / "machine-config.json"
DEFAULT_CACHE_ROOT = REPO_ROOT / "PAMIEC-PODRECZNA" / "thumbs"
BRIDGE = os.environ.get("DAM_BRIDGE_URL", "http://127.0.0.1:8766").rstrip("/")

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".psd", ".webp", ".gif", ".bmp", ".avif"}

sys.path.insert(0, str(DESKTOP_DIR))

try:
    import dam_thumb_cache as thumb_cache
except ImportError:
    thumb_cache = None  # type: ignore

try:
    import dam_file_availability as file_avail
except ImportError:
    file_avail = None  # type: ignore


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def norm_path(p: str) -> str:
    return str(Path(p)).replace("/", "\\")


def is_image_path(p: str) -> bool:
    return Path(p).suffix.lower() in IMAGE_EXT


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def walk_dict_paths(obj: Any, out: dict[str, set[str]]) -> None:
    if isinstance(obj, dict):
        p = obj.get("path")
        if isinstance(p, str) and is_image_path(p):
            key = norm_path(p).lower()
            out.setdefault(key, set()).add(norm_path(p))
        for v in obj.values():
            walk_dict_paths(v, out)
    elif isinstance(obj, list):
        for item in obj:
            walk_dict_paths(item, out)


def paths_from_file_index(path: Path) -> dict[str, set[str]]:
    if not path.is_file():
        return {}
    data = load_json(path)
    out: dict[str, set[str]] = {}
    walk_dict_paths(data, out)
    return out


def paths_from_branding_index(path: Path) -> dict[str, set[str]]:
    if not path.is_file():
        return {}
    data = load_json(path)
    out: dict[str, set[str]] = {}
    assets = data.get("assets") if isinstance(data, dict) else None
    if isinstance(assets, list):
        for a in assets:
            if not isinstance(a, dict):
                continue
            p = a.get("path")
            if isinstance(p, str) and is_image_path(p):
                key = norm_path(p).lower()
                out.setdefault(key, set()).add(norm_path(p))
    else:
        walk_dict_paths(data, out)
    return out


def marketing_roots(machine_config: Path, walk_roots: list[str]) -> list[Path]:
    roots: list[Path] = []
    seen: set[str] = set()
    for wr in walk_roots or []:
        p = Path(wr)
        if p.is_dir():
            key = str(p.resolve()).lower()
            if key not in seen:
                seen.add(key)
                roots.append(p)
    if machine_config.is_file():
        try:
            mc = load_json(machine_config)
            users = mc.get("users") if isinstance(mc, dict) else {}
            if isinstance(users, dict):
                for u in users.values():
                    if isinstance(u, dict):
                        bp = (u.get("base_path") or "").strip()
                        if bp:
                            p = Path(bp)
                            if p.is_dir():
                                key = str(p.resolve()).lower()
                                if key not in seen:
                                    seen.add(key)
                                    roots.append(p)
            bp = (mc.get("base_path") or "").strip() if isinstance(mc, dict) else ""
            if bp:
                p = Path(bp)
                if p.is_dir():
                    key = str(p.resolve()).lower()
                    if key not in seen:
                        seen.add(key)
                        roots.append(p)
        except Exception:
            pass
    for cand in (Path("X:/Marketing"), Path("D:/Marketing")):
        if cand.is_dir():
            key = str(cand.resolve()).lower()
            if key not in seen:
                seen.add(key)
                roots.append(cand)
    return roots


def walk_marketing_roots(roots: list[Path]) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    for root in roots:
        try:
            for dirpath, _dirnames, filenames in os.walk(root):
                for fn in filenames:
                    if Path(fn).suffix.lower() not in IMAGE_EXT:
                        continue
                    full = norm_path(os.path.join(dirpath, fn))
                    key = full.lower()
                    out.setdefault(key, set()).add(full)
        except OSError as exc:
            print(f"[warn] walk skip root {root}: {exc}", file=sys.stderr)
    return out


def build_inventory(
    *,
    file_index: Path,
    branding_index: Path,
    walk_roots: list[str],
    machine_config: Path,
) -> dict:
    merged: dict[str, dict] = {}
    for src, bucket in (
        ("file-index", paths_from_file_index(file_index)),
        ("branding-index", paths_from_branding_index(branding_index)),
        ("walk", walk_marketing_roots(marketing_roots(machine_config, walk_roots))),
    ):
        for _key, variants in bucket.items():
            for p in variants:
                entry = merged.setdefault(p.lower(), {"path": p, "sources": []})
                if src not in entry["sources"]:
                    entry["sources"].append(src)
    paths = sorted(merged.values(), key=lambda x: x["path"].lower())
    return {
        "generated_at": utc_now(),
        "inventory_total": len(paths),
        "paths": paths,
        "sources": {
            "file_index": str(file_index),
            "branding_index": str(branding_index),
            "walk_roots": [str(r) for r in marketing_roots(machine_config, walk_roots)],
        },
    }


def _fast_win32_attrs(path: str) -> Optional[int]:
    if os.name != "nt":
        return None
    try:
        import ctypes

        GetFileAttributesW = ctypes.windll.kernel32.GetFileAttributesW  # type: ignore[attr-defined]
        GetFileAttributesW.argtypes = [ctypes.c_wchar_p]
        GetFileAttributesW.restype = ctypes.c_uint32
        attrs = GetFileAttributesW(path)
        if attrs == 0xFFFFFFFF:
            return None
        return int(attrs)
    except Exception:
        return None


def _quick_readable(path: str, timeout_s: float = 0.35) -> bool:
    deadline = time.time() + timeout_s
    try:
        with open(path, "rb") as fh:
            while time.time() < deadline:
                if fh.read(4096):
                    return True
                return True
    except OSError:
        return False
    except Exception:
        return False
    return False


def classify_local(path: str) -> tuple[bool, str]:
    """Return (is_local_eligible, skip_reason). Fast path for 48k+ inventory."""
    try:
        if not os.path.isfile(path):
            return False, "missing"
    except PermissionError:
        return False, "permission_denied"
    except OSError:
        return False, "online_only"

    attrs = _fast_win32_attrs(path)
    if attrs is not None:
        offline = bool(attrs & 0x00001000) and not bool(attrs & 0x00080000)
        recall = bool(attrs & (0x00400000 | 0x00040000))
        if offline or recall:
            if _quick_readable(path, 0.35):
                return True, ""
            return False, "online_only"

    return True, ""


def filter_local_inventory(inv: dict, workers: int = 32) -> tuple[dict, dict]:
    local_paths: list[dict] = []
    skips: list[dict] = []
    items: list[dict] = []
    for item in inv.get("paths") or []:
        if isinstance(item, dict) and isinstance(item.get("path"), str) and item.get("path").strip():
            items.append(item)
    total = len(items)

    def _one(item: dict) -> tuple[dict, Optional[dict]]:
        p = norm_path(str(item.get("path")))
        sources = item.get("sources") or []
        if "walk" in sources:
            return {"path": p, "sources": sources}, None
        ok, reason = classify_local(p)
        if ok:
            return {"path": p, "sources": sources}, None
        return {}, {"path": p, "reason": reason or "skip"}

    done = 0
    with ThreadPoolExecutor(max_workers=max(4, workers)) as pool:
        futures = [pool.submit(_one, item) for item in items]
        for fut in as_completed(futures):
            loc, skip = fut.result()
            if loc:
                local_paths.append(loc)
            if skip:
                skips.append(skip)
            done += 1
            if done % 5000 == 0:
                print(f"[C-WARM] filter progress {done}/{total}", file=sys.stderr)
    local_doc = {
        "generated_at": utc_now(),
        "inventory_total": total,
        "local_count": len(local_paths),
        "skip_count": len(skips),
        "paths": local_paths,
    }
    skip_doc = {
        "generated_at": utc_now(),
        "skip_count": len(skips),
        "skips": skips,
    }
    return local_doc, skip_doc


def http_json(method: str, url: str, body: Optional[dict] = None, timeout: float = 30.0) -> dict:
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def enqueue_batches(
    local_doc: dict,
    *,
    profiles: list[str],
    batch_size: int,
    async_mode: bool,
) -> dict:
    paths = [str(x.get("path")) for x in (local_doc.get("paths") or []) if x.get("path")]
    skip_already = 0
    enqueued_total = 0
    for profile in profiles:
        pending: list[str] = []
        for p in paths:
            if thumb_cache is not None and thumb_cache.is_cached_on_disk(p, profile=profile):
                skip_already += 1
                continue
            pending.append(p)
        for i in range(0, len(pending), batch_size):
            batch = pending[i : i + batch_size]
            if not batch:
                continue
            payload = {"paths": batch, "profile": profile, "async": async_mode}
            try:
                resp = http_json("POST", f"{BRIDGE}/thumb-cache/warm", payload)
            except urllib.error.URLError as exc:
                print(f"[error] enqueue failed profile={profile}: {exc}", file=sys.stderr)
                return {
                    "ok": False,
                    "enqueued_total": enqueued_total,
                    "skip_already_cached": skip_already,
                    "error": str(exc),
                }
            enqueued_total += int(resp.get("queued") or len(batch))
            print(
                f"[C-WARM] enqueued_batch={len(batch)} profile={profile} "
                f"queue_len={resp.get('queue_len')} skipped_cached={skip_already}"
            )
    return {"ok": True, "enqueued_total": enqueued_total, "skip_already_cached": skip_already}


def queue_idle(timeout_sec: int) -> dict:
    try:
        health = http_json("GET", f"{BRIDGE}/health", timeout=10)
    except urllib.error.URLError as exc:
        return {"ok": False, "error": str(exc), "queue_drained": 0}
    warm = health.get("warm") or {}
    qlen = int(warm.get("queue_len") or 0)
    idle = int(warm.get("worker_idle_sec") or 0)
    drained = qlen == 0 and idle >= timeout_sec
    return {
        "ok": True,
        "queue_len": qlen,
        "worker_idle_sec": idle,
        "queue_drained": 1 if drained else 0,
        "redis_circuit": (health.get("redis") or {}).get("circuit"),
    }


def verify_avif(local_doc: dict, *, cache_root: Path, profiles: list[str]) -> dict:
    paths = [str(x.get("path")) for x in (local_doc.get("paths") or []) if x.get("path")]
    eligible = len(paths) * len(profiles)
    avif_ok = 0
    jpg_fallback = 0
    missing = 0
    sample_avif: list[str] = []
    for p in paths:
        for profile in profiles:
            digest = ""
            if thumb_cache is not None:
                digest = thumb_cache.digest_for_path(p, profile=profile)
            else:
                digest = p
            avif_p = cache_root / f"{digest}.avif"
            jpg_p = cache_root / f"{digest}.jpg"
            if avif_p.is_file() and avif_p.stat().st_size > 0:
                avif_ok += 1
                if len(sample_avif) < 20:
                    sample_avif.append(str(avif_p))
            elif jpg_p.is_file() and jpg_p.stat().st_size > 0:
                jpg_fallback += 1
            else:
                missing += 1
    avif_pct = (avif_ok / eligible * 100.0) if eligible else 0.0
    jpg_pct_of_avif = (jpg_fallback / avif_ok * 100.0) if avif_ok else 0.0
    pass_gate = avif_pct >= 85.0 and (jpg_fallback == 0 or jpg_pct_of_avif <= 5.0)
    return {
        "eligible": eligible,
        "avif_ok": avif_ok,
        "jpg_fallback": jpg_fallback,
        "missing": missing,
        "avif_pct": round(avif_pct, 2),
        "jpg_pct_of_avif_ok": round(jpg_pct_of_avif, 2),
        "pass": pass_gate,
        "sample_avif": sample_avif[:20],
    }


def monitor_drain(timeout_sec: int, poll_interval_min: int, max_polls: int) -> int:
    for poll in range(1, max_polls + 1):
        st = queue_idle(timeout_sec)
        print(
            f"[C-WARM] monitor poll={poll} queue_len={st.get('queue_len')} "
            f"idle_sec={st.get('worker_idle_sec')} drained={st.get('queue_drained')}"
        )
        if st.get("queue_drained"):
            return 0
        if poll < max_polls:
            time.sleep(max(1, poll_interval_min) * 60)
    return 3


def main() -> int:
    ap = argparse.ArgumentParser(description="DAM C-WARM inventory/enqueue/verify")
    ap.add_argument("--out", type=Path, help="Output JSON path")
    ap.add_argument("--in", dest="in_path", type=Path, help="Input inventory JSON")
    ap.add_argument("--local", type=Path, help="warm-local JSON for enqueue/verify")
    ap.add_argument("--file-index", action="store_true")
    ap.add_argument("--branding-index", action="store_true")
    ap.add_argument("--walk-roots", action="append", default=[])
    ap.add_argument("--machine-config", type=Path, default=DEFAULT_MACHINE_CONFIG)
    ap.add_argument("--filter-local", action="store_true")
    ap.add_argument("--skip-log", type=Path)
    ap.add_argument("--enqueue", action="store_true")
    ap.add_argument("--profiles", default="grid,card")
    ap.add_argument("--async", dest="async_mode", action="store_true")
    ap.add_argument("--batch-size", type=int, default=200)
    ap.add_argument("--verify-avif", action="store_true")
    ap.add_argument("--cache-root", type=Path, default=DEFAULT_CACHE_ROOT)
    ap.add_argument("--queue-idle", action="store_true")
    ap.add_argument("--timeout", type=int, default=30)
    ap.add_argument("--monitor", action="store_true", help="Poll drain every 15 min, cap 96")
    ap.add_argument("--missing-out", type=Path, help="Reserved delta re-enqueue output")
    args = ap.parse_args()

    profiles = [p.strip().lower() for p in args.profiles.split(",") if p.strip()]

    if args.queue_idle:
        st = queue_idle(args.timeout)
        print(json.dumps(st, ensure_ascii=False, indent=2))
        return 0 if st.get("queue_drained") else 1

    if args.monitor:
        return monitor_drain(args.timeout, poll_interval_min=15, max_polls=96)

    if args.verify_avif:
        if not args.local or not args.local.is_file():
            print("verify-avif requires --local PATH", file=sys.stderr)
            return 2
        local_doc = load_json(args.local)
        result = verify_avif(local_doc, cache_root=args.cache_root, profiles=profiles)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("pass") else 1

    if args.enqueue:
        if not args.local or not args.local.is_file():
            print("enqueue requires --local PATH", file=sys.stderr)
            return 2
        local_doc = load_json(args.local)
        result = enqueue_batches(
            local_doc,
            profiles=profiles,
            batch_size=args.batch_size,
            async_mode=args.async_mode,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("ok") else 1

    if args.filter_local:
        if not args.in_path or not args.in_path.is_file():
            print("filter-local requires --in PATH", file=sys.stderr)
            return 2
        inv = load_json(args.in_path)
        local_doc, skip_doc = filter_local_inventory(inv)
        if args.out:
            save_json(args.out, local_doc)
        if args.skip_log:
            save_json(args.skip_log, skip_doc)
        print(
            f"[C-WARM] K-WARM-1 local_count={local_doc['local_count']} "
            f"skip_count={local_doc['skip_count']} total={local_doc['inventory_total']}"
        )
        return 0

    # K-WARM-0 inventory (default: file-index + branding-index + walk roots)
    use_file = args.file_index or (
        not args.filter_local and not args.enqueue and not args.verify_avif and not args.queue_idle
    )
    use_branding = args.branding_index or use_file
    inv = build_inventory(
        file_index=DEFAULT_FILE_INDEX if use_file else Path("__missing__"),
        branding_index=DEFAULT_BRANDING_INDEX if use_branding else Path("__missing__"),
        walk_roots=args.walk_roots if args.walk_roots else (["X:\\Marketing"] if use_file else []),
        machine_config=args.machine_config,
    )
    if inv["inventory_total"] <= 0:
        print("[C-WARM] K-WARM-0 inventory_total=0", file=sys.stderr)
        return 2
    if args.out:
        save_json(args.out, inv)
    print(f"[C-WARM] K-WARM-0 inventory_total={inv['inventory_total']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
