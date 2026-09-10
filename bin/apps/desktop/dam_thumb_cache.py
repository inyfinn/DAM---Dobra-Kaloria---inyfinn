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
import io
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import tempfile
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

MAX_THUMB_BYTES = 70 * 1024
AVIF_QUALITY_STEPS = (30, 24, 18, 12, 8, 5)

_warm_lock = threading.Lock()
_warm_queue: list[dict] = []
_warm_workers_started = False
_warm_consumer_started = False
_warm_last_activity = 0.0
_warm_jobs_done = 0
_warm_local_json_path = ""
_warm_worker_count = max(1, int(os.environ.get("DAM_WARM_WORKERS", "24") or "24"))
_warm_batch_cap = max(1, int(os.environ.get("DAM_WARM_BATCH", "200") or "200"))
_REL_INDEX_LOCK = threading.Lock()
_REL_INDEX: dict[str, dict] | None = None
# Indeks rel|profile -> digest: pozwala trafic w cache BEZ mtime oryginalu.
# Istniejace pliki thumbs/{sha256}.avif zostaja; nowy indeks ich nie rusza.


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


def _rgb_bitmap(im):
    """Detach a display-only RGB bitmap from source layers, profiles and metadata."""
    from PIL import Image  # type: ignore

    flattened = _flatten_white(im)
    rgb = Image.new("RGB", flattened.size, (255, 255, 255))
    rgb.paste(flattened)
    return rgb


def _save_avif_capped(rgb, dest_avif: Path, max_bytes: int = MAX_THUMB_BYTES) -> bool:
    """Save metadata-free RGB AVIF, reducing quality/size until the hard cap is met."""
    from PIL import Image  # type: ignore

    dest_avif.parent.mkdir(parents=True, exist_ok=True)
    base = _rgb_bitmap(rgb)
    side_steps = (max(base.size), 960, 720, 560, 480, 400, 320, 256, 192, 160)
    seen: set[tuple[int, int]] = set()
    for max_side in side_steps:
        candidate = base.copy()
        if max(candidate.size) > max_side:
            candidate.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        if candidate.size in seen:
            continue
        seen.add(candidate.size)
        for quality in AVIF_QUALITY_STEPS:
            tmp = dest_avif.with_suffix(dest_avif.suffix + ".tmp")
            try:
                candidate.save(tmp, format="AVIF", quality=quality)
                if tmp.stat().st_size <= max_bytes:
                    os.replace(tmp, dest_avif)
                    return True
            finally:
                try:
                    tmp.unlink(missing_ok=True)
                except OSError:
                    pass
    return False


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


def _find_pdftoppm() -> Optional[str]:
    """Poppler pdftoppm — PATH or bundled under bin/runtime."""
    for name in ("pdftoppm", "pdftoppm.exe"):
        hit = shutil.which(name)
        if hit:
            return hit
    runtime = REPO_ROOT / "runtime"
    for rel in (
        "win/poppler/Library/bin/pdftoppm.exe",
        "win/tools/poppler/pdftoppm.exe",
    ):
        p = runtime / rel
        if p.is_file():
            return str(p)
    return None


def raster_pdf_first_page_jpeg(src: str, *, max_side: int = 2400) -> Optional[bytes]:
    """Raster first PDF page to JPEG via pdftoppm (Poppler)."""
    if Path(src).suffix.lower() != ".pdf":
        return None
    exe = _find_pdftoppm()
    if not exe:
        return None
    try:
        if not os.path.isfile(src):
            return None
    except OSError:
        return None
    scale = max(64, min(int(max_side), 4096))
    try:
        with tempfile.TemporaryDirectory(prefix="dam-pdf-") as td:
            out_prefix = str(Path(td) / "page")
            proc = subprocess.run(
                [
                    exe,
                    "-jpeg",
                    "-singlefile",
                    "-f",
                    "1",
                    "-l",
                    "1",
                    "-scale-to",
                    str(scale),
                    src,
                    out_prefix,
                ],
                capture_output=True,
                timeout=90,
                check=False,
            )
            if proc.returncode != 0:
                return None
            jpg = Path(out_prefix + ".jpg")
            if not jpg.is_file() or jpg.stat().st_size == 0:
                return None
            return jpg.read_bytes()
    except Exception:
        return None


def _encode_thumb(src: str, dest_avif: Path, dest_jpg: Path, max_side: int) -> tuple[Optional[Path], str]:
    """Create a display-only RGB thumb capped at 70 KiB. Returns (path, content_type)."""
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        return None, ""

    open_target: str | io.BytesIO = src
    if Path(src).suffix.lower() == ".pdf":
        pdf_jpg = raster_pdf_first_page_jpeg(src, max_side=max(max_side, 480))
        if not pdf_jpg:
            return None, ""
        open_target = io.BytesIO(pdf_jpg)

    try:
        with Image.open(open_target) as im:
            if im.mode in ("CMYK", "P"):
                # P z transparency obsluzy _flatten_white
                if im.mode == "CMYK":
                    im = im.convert("RGB")
            if max(im.size) > max_side:
                im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

            rgb = _rgb_bitmap(im)

            # AVIF is a flattened RGB bitmap only: no layers, spot/extra channels,
            # source ICC profile, EXIF or other source metadata.
            try:
                if _save_avif_capped(rgb, dest_avif):
                    return dest_avif, "image/avif"
            except Exception:
                pass

            # JPEG fallback follows the same cap and metadata-free RGB rule.
            dest_jpg.parent.mkdir(parents=True, exist_ok=True)
            for side in (max(rgb.size), 720, 560, 480, 400, 320, 256, 192):
                candidate = rgb.copy()
                if max(candidate.size) > side:
                    candidate.thumbnail((side, side), Image.Resampling.LANCZOS)
                for quality in (70, 55, 42, 30, 20):
                    candidate.save(dest_jpg, format="JPEG", quality=quality, optimize=True)
                    if dest_jpg.stat().st_size <= MAX_THUMB_BYTES:
                        return dest_jpg, "image/jpeg"
            dest_jpg.unlink(missing_ok=True)
    except Exception:
        return None, ""
    return None, ""


def _rel_index_path() -> Path:
    return cache_root() / "thumb-rel-index.json"


def _rel_index_key(rel: str, profile: str) -> str:
    return f"{rel}|{profile}"


def _rel_from_logical(path: str) -> str:
    """Klucz wzgledny bez stat/resolve - nie tyka dysku sieciowego."""
    s = (path or "").strip().replace("\\", "/")
    low = s.lower()
    marker = "/marketing/"
    idx = low.find(marker)
    if idx >= 0:
        return s[idx + len(marker) :].lstrip("/")
    if len(s) >= 3 and s[1] == ":" and s[2] == "/":
        return s[3:].lstrip("/")
    return s.lstrip("/")


def _load_rel_index() -> dict[str, dict]:
    global _REL_INDEX
    with _REL_INDEX_LOCK:
        if _REL_INDEX is not None:
            return _REL_INDEX
        data: dict[str, dict] = {}
        p = _rel_index_path()
        if p.is_file():
            try:
                raw = json.loads(p.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    data = {str(k): v for k, v in raw.items() if isinstance(v, dict)}
            except (OSError, json.JSONDecodeError):
                data = {}
        _REL_INDEX = data
        return data


def _save_rel_index() -> None:
    with _REL_INDEX_LOCK:
        payload = dict(_REL_INDEX or {})
    tmp = _rel_index_path().with_suffix(".json.tmp")
    try:
        tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        os.replace(tmp, _rel_index_path())
    except OSError:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass


def _remember_rel(rel: str, profile: str, digest: str, mtime: float) -> None:
    if not rel or not digest:
        return
    idx = _load_rel_index()
    key = _rel_index_key(rel, profile)
    with _REL_INDEX_LOCK:
        idx[key] = {"digest": digest, "mtime": float(mtime or 0.0)}
        _REL_INDEX = idx
    _save_rel_index()


def _lookup_by_rel(rel: str, profile: str) -> tuple[Optional[Path], str, str]:
    """Zwraca (plik, ctype, digest) gdy cache istnieje dla rel|profile."""
    idx = _load_rel_index()
    row = idx.get(_rel_index_key(rel, profile))
    if not isinstance(row, dict):
        return None, "", ""
    digest = str(row.get("digest") or "")
    if not digest:
        return None, "", ""
    avif_p, jpg_p = _cache_paths(digest)
    if avif_p.is_file():
        return avif_p, "image/avif", digest
    if jpg_p.is_file():
        return jpg_p, "image/jpeg", digest
    return None, "", digest


def _drive_letter_alive(path: str) -> bool:
    """Szybki test litery dysku bez wchodzenia w udzial sieciowy."""
    s = (path or "").replace("/", "\\")
    if len(s) >= 2 and s[1] == ":":
        root = s[:2] + "\\"
        try:
            return os.path.isdir(root)
        except OSError:
            return False
    return True


def _mtime_quick(path: str, timeout_s: float = 0.08) -> float | None:
    """mtime oryginalu z twardym timeoutem. None = dysk nie odpowiada."""
    if not path or not _drive_letter_alive(path):
        return None
    box: dict = {}

    def _worker() -> None:
        try:
            box["mt"] = float(os.path.getmtime(path))
        except OSError:
            box["mt"] = None

    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    t.join(timeout=max(0.02, timeout_s))
    if "mt" not in box:
        return None
    return box["mt"]


def _marketing_cache_only() -> bool:
    """No reachable marketing root → do not touch original disk."""
    try:
        scripts = Path(__file__).resolve().parent.parent / "web" / "scripts"
        if str(scripts) not in sys.path:
            sys.path.insert(0, str(scripts))
        import marketing_roots  # type: ignore

        return bool(marketing_roots.is_cache_only())
    except Exception:
        return False


def _serve_cached(
    hit_path: Path,
    ctype: str,
    digest: str,
    prof: str,
    rel: str,
    mt: float,
    source: str,
) -> tuple[int, bytes, str, dict]:
    try:
        body = hit_path.read_bytes()
    except OSError:
        return 404, b"", "application/json", {"ok": False, "error": "cache_read_failed"}
    rel_cache = str(hit_path.relative_to(cache_root())).replace("\\", "/")
    _store_meta(digest, rel_cache, ctype, prof)
    # Cache hit with mt=0 must not stamp the index (would hide source changes).
    if source != "cache" or mt > 0:
        _remember_rel(rel, prof, digest, mt)
    meta = {
        "ok": True,
        "digest": digest,
        "profile": prof,
        "cache_hit": source == "cache",
        "cache_path": rel_cache,
        "source_mtime": mt,
        "rel": rel,
        "bytes": len(body),
        "thumb_source": source,
    }
    return 200, body, ctype, meta


def _revalidate_thumb(
    path: str,
    *,
    email: str,
    profile: str,
    resolve_physical: Optional[Callable[..., str]],
    marketing_relative: Optional[Callable[..., str]],
    known_digest: str,
    lookup_rel: str = "",
) -> None:
    """Po odpowiedzi: jesli mtime oryginalu sie zmienil, przebuduj cache.

    HARD: update the SAME rel|profile key that get_or_build_thumb uses
    for lookup (_rel_from_logical), not only thumb_key's relative path.
    """
    try:
        if _marketing_cache_only():
            return
        physical = path
        if resolve_physical:
            try:
                physical = resolve_physical(path, email) or path
            except Exception:
                physical = path
        mt = _mtime_quick(physical, timeout_s=0.4)
        if mt is None:
            return
        idx = _load_rel_index()
        key_rel = lookup_rel or _rel_from_logical(path)
        row = idx.get(_rel_index_key(key_rel, profile)) if key_rel else None
        stored_mt = float((row or {}).get("mtime") or 0.0)
        stored_digest = str((row or {}).get("digest") or known_digest or "")
        if stored_mt and abs(stored_mt - float(mt)) < 0.0005 and stored_digest == known_digest:
            return
        digest, rel_key, _ = thumb_key(
            path,
            email=email,
            profile=profile,
            resolve_physical=resolve_physical,
            marketing_relative=marketing_relative,
        )
        if digest == stored_digest and stored_mt and abs(stored_mt - float(mt)) < 0.0005:
            return
        if digest == known_digest and stored_mt and abs(stored_mt - float(mt)) < 0.0005:
            return
        avif_p, jpg_p = _cache_paths(digest)
        built, _ctype = _encode_thumb(physical, avif_p, jpg_p, PROFILES.get(profile, 480))
        if built is not None:
            if key_rel:
                _remember_rel(key_rel, profile, digest, mt)
            if rel_key and rel_key != key_rel:
                _remember_rel(rel_key, profile, digest, mt)
    except Exception:
        return


def get_or_build_thumb(
    path: str,
    *,
    email: str = "",
    profile: str = "grid",
    resolve_physical: Optional[Callable[..., str]] = None,
    marketing_relative: Optional[Callable[..., str]] = None,
) -> tuple[int, bytes, str, dict]:
    """
    Cache-first: najpierw indeks rel|profile, potem oryginal.
    Returns (http_code, body, content_type, meta).
    """
    prof = (profile or "grid").strip().lower()
    if prof not in PROFILES:
        prof = "grid"
    max_side = PROFILES[prof]
    rel = _rel_from_logical(path)
    cache_only = _marketing_cache_only()

    cached_path, cached_ctype, cached_digest = _lookup_by_rel(rel, prof)
    if cached_path is not None:
        if not cache_only:
            threading.Thread(
                target=_revalidate_thumb,
                kwargs={
                    "path": path,
                    "email": email,
                    "profile": prof,
                    "resolve_physical": resolve_physical,
                    "marketing_relative": marketing_relative,
                    "known_digest": cached_digest,
                    "lookup_rel": rel,
                },
                daemon=True,
                name="dam-thumb-revalidate",
            ).start()
        return _serve_cached(cached_path, cached_ctype, cached_digest, prof, rel, 0.0, "cache")

    if cache_only:
        return 404, b"", "application/json", {
            "ok": False,
            "error": "not_found",
            "thumb_source": "cache",
            "cache_only": True,
        }

    physical = path
    root_missing = not _drive_letter_alive(path)
    if not root_missing and resolve_physical:
        try:
            physical = resolve_physical(path, email) or path
        except Exception:
            physical = path
        root_missing = not _drive_letter_alive(physical)

    if root_missing:
        return 404, b"", "application/json", {
            "ok": False,
            "error": "not_found",
            "thumb_source": "cache",
            "cache_only": True,
        }

    mt = _mtime_quick(physical)
    if mt is None:
        return 404, b"", "application/json", {
            "ok": False,
            "error": "not_found",
            "thumb_source": "cache",
            "cache_only": True,
        }

    digest, rel2, mt2 = thumb_key(
        path,
        email=email,
        profile=prof,
        resolve_physical=resolve_physical,
        marketing_relative=marketing_relative,
    )
    logical = _rel_from_logical(path)
    if rel2:
        rel = rel2
    if logical and logical != rel:
        _remember_rel(logical, prof, digest, mt2)
    avif_p, jpg_p = _cache_paths(digest)
    if avif_p.is_file():
        return _serve_cached(avif_p, "image/avif", digest, prof, rel, mt2, "cache")
    if jpg_p.is_file():
        return _serve_cached(jpg_p, "image/jpeg", digest, prof, rel, mt2, "cache")

    try:
        from dam_file_availability import _mark as _avail_mark

        _avail_mark("generating_thumb", digest[:16])
    except Exception:
        pass
    built, ctype = _encode_thumb(physical, avif_p, jpg_p, max_side)
    if built is None:
        return 422, b"", "application/json", {"ok": False, "error": "encode_failed"}
    return _serve_cached(built, ctype, digest, prof, rel, mt2, "original")


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
