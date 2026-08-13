"""
Disk thumb cache under {repo}/PAMIEC-PODRECZNA (D: only).

Key = sha256(marketing_relative + mtime + profile). Prefer AVIF q~30, JPEG fallback.
NEVER write cache under X:/ or M:/.

Redis role: thumb-cache key→path (metadata accelerator only).
Fallback when Redis OPEN/down: DISK is source of truth — filesystem lookup by
hash path under PAMIEC-PODRECZNA. Survives bridge restart via disk.
Warm queue role: degrade to no-op / sync generate on demand when circuit OPEN.
"""
from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from pathlib import Path
from typing import Callable, Optional

try:
    import dam_redis
except ImportError:
    dam_redis = None  # type: ignore

try:
    import dam_path_resolve as path_resolve
except ImportError:
    path_resolve = None  # type: ignore

DESKTOP_DIR = Path(__file__).resolve().parent
REPO_ROOT = DESKTOP_DIR.parent.parent
DEFAULT_CACHE_ROOT = REPO_ROOT / "PAMIEC-PODRECZNA"

# Profiles: name → max side px
PROFILES = {
    "grid": 480,
    "card": 720,
    "modal": 1200,
    "poster": 640,
}

_warm_lock = threading.Lock()
_warm_queue: list[dict] = []
_warm_workers_started = False
_warm_consumer_started = False
_warm_last_activity = 0.0
_warm_jobs_done = 0
_warm_local_json_path = ""
_warm_worker_count = max(1, int(os.environ.get("DAM_WARM_WORKERS", "24") or "24"))
_warm_batch_cap = max(1, int(os.environ.get("DAM_WARM_BATCH", "200") or "200"))


def cache_root() -> Path:
    override = (os.environ.get("DAM_CACHE_ROOT") or "").strip()
    root = Path(override) if override else DEFAULT_CACHE_ROOT
    root.mkdir(parents=True, exist_ok=True)
    (root / "thumbs").mkdir(parents=True, exist_ok=True)
    return root


def _mtime(path: str) -> float:
    try:
        return float(os.path.getmtime(path))
    except OSError:
        return 0.0


def thumb_key(
    path: str,
    *,
    email: str = "",
    profile: str = "grid",
    resolve_physical: Optional[Callable[..., str]] = None,
    marketing_relative: Optional[Callable[..., str]] = None,
) -> tuple[str, str, float]:
    """Return (sha256_hex, relative_key, mtime)."""
    physical = path
    if resolve_physical:
        try:
            physical = resolve_physical(path, email) or path
        except Exception:
            physical = path
    rel = ""
    if marketing_relative:
        try:
            rel = marketing_relative(physical, email) or ""
        except Exception:
            rel = ""
    elif path_resolve is not None:
        rel = path_resolve.marketing_relative_key(physical, email=email)
    if not rel:
        rel = Path(physical).name
    mt = _mtime(physical)
    prof = (profile or "grid").strip().lower()
    if prof not in PROFILES:
        prof = "grid"
    material = f"{rel}|{mt:.6f}|{prof}|whitebg-v1".encode("utf-8", errors="replace")
    digest = hashlib.sha256(material).hexdigest()
    return digest, rel, mt


def _flatten_white(im):
    """Przezroczystosc zawsze na biale tlo (AVIF/JPEG). Bez alphy w pliku wyjsciowym."""
    from PIL import Image  # type: ignore

    if im.mode in ("RGBA", "LA"):
        rgba = im.convert("RGBA") if im.mode == "LA" else im
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[-1])
        return bg
    if im.mode == "P" and "transparency" in im.info:
        rgba = im.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[-1])
        return bg
    if im.mode != "RGB":
        return im.convert("RGB")
    return im


def _cache_paths(digest: str) -> tuple[Path, Path]:
    root = cache_root() / "thumbs"
    return root / f"{digest}.avif", root / f"{digest}.jpg"


def _redis_meta_key(digest: str) -> str:
    return "thumb:" + digest


def _store_meta(digest: str, rel_cache: str, content_type: str, profile: str) -> None:
    if dam_redis is None:
        return
    try:
        dam_redis.hset(
            _redis_meta_key(digest),
            {
                "path": rel_cache,
                "ctype": content_type,
                "profile": profile,
                "ts": str(int(time.time())),
            },
            ttl=7 * 24 * 3600,
        )
    except Exception:
        pass


def _encode_thumb(src: str, dest_avif: Path, dest_jpg: Path, max_side: int) -> tuple[Optional[Path], str]:
    """Create AVIF or JPEG thumb. Returns (path, content_type)."""
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        return None, ""

    try:
        with Image.open(src) as im:
            if im.mode in ("CMYK", "P"):
                # P z transparency obsluzy _flatten_white
                if im.mode == "CMYK":
                    im = im.convert("RGB")
            if max(im.size) > max_side:
                im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

            rgb = _flatten_white(im)

            # Prefer AVIF ~q30 — zawsze RGB na bialym tle (bez alphy = bez zielonej maty)
            try:
                dest_avif.parent.mkdir(parents=True, exist_ok=True)
                rgb.save(dest_avif, format="AVIF", quality=30)
                if dest_avif.is_file() and dest_avif.stat().st_size > 0:
                    return dest_avif, "image/avif"
            except Exception:
                pass

            # JPEG fallback
            dest_jpg.parent.mkdir(parents=True, exist_ok=True)
            rgb.save(dest_jpg, format="JPEG", quality=82, optimize=True)
            if dest_jpg.is_file():
                return dest_jpg, "image/jpeg"
    except Exception:
        return None, ""
    return None, ""


def get_or_build_thumb(
    path: str,
    *,
    email: str = "",
    profile: str = "grid",
    resolve_physical: Optional[Callable[..., str]] = None,
    marketing_relative: Optional[Callable[..., str]] = None,
) -> tuple[int, bytes, str, dict]:
    """
    Returns (http_code, body, content_type, meta).
    200 with bytes; 404/422/403 as appropriate.
    """
    prof = (profile or "grid").strip().lower()
    if prof not in PROFILES:
        prof = "grid"
    max_side = PROFILES[prof]

    physical = path
    if resolve_physical:
        try:
            physical = resolve_physical(path, email) or path
        except Exception:
            physical = path
    try:
        if not os.path.isfile(physical):
            return 404, b"", "application/json", {"ok": False, "error": "not_found"}
    except OSError:
        return 404, b"", "application/json", {"ok": False, "error": "not_found"}

    # Safety: refuse writing/serving outside cache for weird paths - source must exist
    digest, rel, mt = thumb_key(
        path,
        email=email,
        profile=prof,
        resolve_physical=resolve_physical,
        marketing_relative=marketing_relative,
    )
    avif_p, jpg_p = _cache_paths(digest)

    hit_path: Optional[Path] = None
    ctype = ""
    if avif_p.is_file():
        hit_path, ctype = avif_p, "image/avif"
    elif jpg_p.is_file():
        hit_path, ctype = jpg_p, "image/jpeg"

    cache_hit = False
    if hit_path is not None:
        cache_hit = True
    else:
        # Watchdog marker: long encode must not look like a hung worker
        try:
            from dam_file_availability import _mark as _avail_mark

            _avail_mark("generating_thumb", digest[:16])
        except Exception:
            pass
        built, ctype = _encode_thumb(physical, avif_p, jpg_p, max_side)
        if built is None:
            return 422, b"", "application/json", {"ok": False, "error": "encode_failed"}
        hit_path = built

    try:
        body = hit_path.read_bytes()
    except OSError:
        return 404, b"", "application/json", {"ok": False, "error": "cache_read_failed"}

    rel_cache = str(hit_path.relative_to(cache_root())).replace("\\", "/")
    _store_meta(digest, rel_cache, ctype, prof)
    meta = {
        "ok": True,
        "digest": digest,
        "profile": prof,
        "cache_hit": cache_hit,
        "cache_path": rel_cache,
        "source_mtime": mt,
        "rel": rel,
        "bytes": len(body),
    }
    return 200, body, ctype, meta


def warm_paths(
    paths: list[str],
    *,
    email: str = "",
    profile: str = "grid",
    resolve_physical: Optional[Callable[..., str]] = None,
    marketing_relative: Optional[Callable[..., str]] = None,
) -> dict:
    """Build thumbs for a list of paths (sync, small batches)."""
    results = []
    t0 = time.time()
    for p in (paths or [])[:40]:
        code, body, ctype, meta = get_or_build_thumb(
            p,
            email=email,
            profile=profile,
            resolve_physical=resolve_physical,
            marketing_relative=marketing_relative,
        )
        results.append(
            {
                "path": p,
                "code": code,
                "cache_hit": bool(meta.get("cache_hit")),
                "digest": meta.get("digest") or "",
                "bytes": len(body) if code == 200 else 0,
                "ctype": ctype,
            }
        )
    return {
        "ok": True,
        "count": len(results),
        "ms": int((time.time() - t0) * 1000),
        "items": results,
        "redis": (dam_redis.status() if dam_redis else {"redis": "down"}),
    }


def digest_for_path(
    path: str,
    *,
    profile: str = "grid",
    email: str = "",
    resolve_physical: Optional[Callable[..., str]] = None,
    marketing_relative: Optional[Callable[..., str]] = None,
) -> str:
    """Public digest helper for idempotent enqueue / verify."""
    digest, _, _ = thumb_key(
        path,
        email=email,
        profile=profile,
        resolve_physical=resolve_physical,
        marketing_relative=marketing_relative,
    )
    return digest


def is_cached_on_disk(
    path: str,
    *,
    profile: str = "grid",
    email: str = "",
    resolve_physical: Optional[Callable[..., str]] = None,
    marketing_relative: Optional[Callable[..., str]] = None,
) -> bool:
    digest = digest_for_path(
        path,
        profile=profile,
        email=email,
        resolve_physical=resolve_physical,
        marketing_relative=marketing_relative,
    )
    avif_p, jpg_p = _cache_paths(digest)
    return avif_p.is_file() or jpg_p.is_file()


def warm_status() -> dict:
    """Snapshot for GET /health warm.* fields."""
    with _warm_lock:
        qlen = len(_warm_queue)
        started = _warm_consumer_started
        last = _warm_last_activity
        done = _warm_jobs_done
        workers = _warm_worker_count
        local_json = _warm_local_json_path
    idle_sec = int(time.time() - last) if last > 0 else 0
    return {
        "consumer_started": started,
        "queue_len": qlen,
        "worker_idle_sec": idle_sec if qlen == 0 else 0,
        "workers": workers,
        "jobs_done": done,
        "paused": os.environ.get("DAM_WARM_PAUSE", "0").strip() == "1",
        "local_json": local_json,
        "encode": "cpu_avif",
    }


def _ensure_warm_workers() -> None:
    """Start fixed-size CPU worker pool (idempotent)."""
    global _warm_workers_started, _warm_consumer_started
    with _warm_lock:
        if _warm_workers_started:
            return
        _warm_workers_started = True
        _warm_consumer_started = True
        for i in range(_warm_worker_count):
            threading.Thread(
                target=_warm_worker_loop,
                name=f"dam-warm-worker-{i}",
                daemon=True,
            ).start()


def dam_warm_boot_consumer(warm_local_json: str) -> None:
    """
    Bridge boot: load warm-local JSON metadata, start dequeue workers only.
    NEVER calls enqueue_warm (K-WARM-4 sole enqueue).
    """
    global _warm_local_json_path, _warm_last_activity
    path = (warm_local_json or "").strip()
    _warm_local_json_path = path
    if path and os.path.isfile(path):
        try:
            json.loads(Path(path).read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"[dam_thumb_cache] warm boot JSON read warning: {exc}")
    else:
        print(f"[dam_thumb_cache] warm boot: local JSON missing ({path or 'unset'})")
    _warm_last_activity = time.time()
    _ensure_warm_workers()
    print(
        f"[dam_thumb_cache] warm consumer started workers={_warm_worker_count} "
        f"boot_enqueue=0 json={path or 'none'}"
    )


def enqueue_warm(paths: list[str], profile: str = "grid", email: str = "") -> dict:
    """Non-blocking warm queue (multi-worker pool)."""
    global _warm_last_activity
    added = 0
    with _warm_lock:
        cap = _warm_batch_cap
        for p in paths or []:
            if added >= cap:
                break
            _warm_queue.append({"path": p, "profile": profile, "email": email})
            added += 1
        qlen = len(_warm_queue)
    _warm_last_activity = time.time()
    _ensure_warm_workers()
    return {"ok": True, "queued": added, "queue_len": qlen}


def _warm_worker_loop() -> None:
    global _warm_last_activity, _warm_jobs_done
    while True:
        if os.environ.get("DAM_WARM_PAUSE", "0").strip() == "1":
            time.sleep(0.5)
            continue
        job: Optional[dict] = None
        with _warm_lock:
            if _warm_queue:
                job = _warm_queue.pop(0)
        if job is None:
            time.sleep(0.25)
            continue
        try:
            get_or_build_thumb(
                job.get("path") or "",
                email=job.get("email") or "",
                profile=job.get("profile") or "grid",
            )
        except Exception:
            pass
        with _warm_lock:
            _warm_jobs_done += 1
        _warm_last_activity = time.time()
