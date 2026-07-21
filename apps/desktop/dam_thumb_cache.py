"""
Disk thumb cache under {repo}/PAMIEC-PODRECZNA (D: only).

Key = sha256(marketing_relative + mtime + profile). Prefer AVIF q~35, JPEG fallback.
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
_warm_running = False


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
    material = f"{rel}|{mt:.6f}|{prof}".encode("utf-8", errors="replace")
    digest = hashlib.sha256(material).hexdigest()
    return digest, rel, mt


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
                im = im.convert("RGB")
            elif im.mode in ("RGBA", "LA"):
                # Keep alpha for AVIF; flatten for JPEG later
                pass
            elif im.mode != "RGB":
                im = im.convert("RGB")
            if max(im.size) > max_side:
                im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

            # Prefer AVIF ~q35
            try:
                rgba_or_rgb = im
                if rgba_or_rgb.mode not in ("RGB", "RGBA"):
                    rgba_or_rgb = rgba_or_rgb.convert("RGBA" if "A" in im.getbands() else "RGB")
                dest_avif.parent.mkdir(parents=True, exist_ok=True)
                rgba_or_rgb.save(dest_avif, format="AVIF", quality=35)
                if dest_avif.is_file() and dest_avif.stat().st_size > 0:
                    return dest_avif, "image/avif"
            except Exception:
                pass

            # JPEG fallback
            rgb = im
            if rgb.mode in ("RGBA", "LA"):
                bg = Image.new("RGB", rgb.size, (255, 255, 255))
                if rgb.mode == "LA":
                    rgb = rgb.convert("RGBA")
                bg.paste(rgb, mask=rgb.split()[-1])
                rgb = bg
            elif rgb.mode != "RGB":
                rgb = rgb.convert("RGB")
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


def enqueue_warm(paths: list[str], profile: str = "grid", email: str = "") -> dict:
    """Non-blocking warm queue (daemon thread)."""
    global _warm_running
    with _warm_lock:
        for p in paths or []:
            _warm_queue.append({"path": p, "profile": profile, "email": email})
        if not _warm_running:
            _warm_running = True
            threading.Thread(target=_warm_worker, daemon=True).start()
    return {"ok": True, "queued": len(paths or []), "queue_len": len(_warm_queue)}


def _warm_worker() -> None:
    global _warm_running
    while True:
        with _warm_lock:
            if not _warm_queue:
                _warm_running = False
                return
            job = _warm_queue.pop(0)
        try:
            get_or_build_thumb(
                job.get("path") or "",
                email=job.get("email") or "",
                profile=job.get("profile") or "grid",
            )
        except Exception:
            pass
