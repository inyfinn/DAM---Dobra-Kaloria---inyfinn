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
import tarfile
import threading
import time
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Optional

import platform_compat

try:
    import dam_redis
except ImportError:
    dam_redis = None  # type: ignore

try:
    import dam_path_resolve as path_resolve
except ImportError:
    path_resolve = None  # type: ignore


def _no_window_flags() -> int:
    """Ukryj konsolę ssh/pdftoppm — bez CREATE_NO_WINDOW Windows pokazuje CMD."""
    if sys.platform != "win32":
        return 0
    return int(getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000))


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


# v2: whole-second mtime. Synology Drive placeholders report whole seconds while the
# machine that built a thumb may have seen fractions, so v1 keys never matched across PCs.
KEY_VERSION = "whitebg-v2"
LEGACY_KEY_VERSION = "whitebg-v1"


def _digest(rel: str, mt: float, prof: str, version: str = KEY_VERSION) -> str:
    if version == LEGACY_KEY_VERSION:
        material = f"{rel}|{mt:.6f}|{prof}|{LEGACY_KEY_VERSION}"
    else:
        material = f"{rel}|{int(mt)}|{prof}|{KEY_VERSION}"
    return hashlib.sha256(material.encode("utf-8", errors="replace")).hexdigest()


def _physical_and_rel(
    path: str,
    email: str,
    resolve_physical: Optional[Callable[..., str]],
    marketing_relative: Optional[Callable[..., str]],
) -> tuple[str, str]:
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
    return physical, rel


def _norm_profile(profile: str) -> str:
    prof = (profile or "grid").strip().lower()
    return prof if prof in PROFILES else "grid"


def _is_online_only(physical: str) -> bool:
    try:
        from dam_file_availability import is_online_only
    except Exception:
        return False
    try:
        return bool(is_online_only(physical))
    except Exception:
        return False


def thumb_key(
    path: str,
    *,
    email: str = "",
    profile: str = "grid",
    resolve_physical: Optional[Callable[..., str]] = None,
    marketing_relative: Optional[Callable[..., str]] = None,
    version: str = KEY_VERSION,
) -> tuple[str, str, float]:
    """Return (sha256_hex, relative_key, mtime)."""
    physical, rel = _physical_and_rel(path, email, resolve_physical, marketing_relative)
    mt = _mtime(physical)
    return _digest(rel, mt, _norm_profile(profile), version), rel, mt


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
                creationflags=_no_window_flags(),
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
        bundled = p.with_name("thumb-rel-index.bundled.json")
        if bundled.is_file():
            try:
                extra = json.loads(bundled.read_text(encoding="utf-8"))
                if isinstance(extra, dict):
                    for k, v in extra.items():
                        if isinstance(v, dict):
                            data.setdefault(str(k), v)
            except (OSError, json.JSONDecodeError):
                pass
        _REL_INDEX = data
        return data


_REL_INDEX_WRITE_LOCK = threading.Lock()


def _save_rel_index() -> None:
    # Warm workers save concurrently; one shared tmp file without a lock lost entries.
    with _REL_INDEX_WRITE_LOCK:
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
        physical, rel_key = _physical_and_rel(path, email, resolve_physical, marketing_relative)
        mt = _mtime_quick(physical, timeout_s=0.4)
        if mt is None:
            return
        idx = _load_rel_index()
        key_rel = lookup_rel or _rel_from_logical(path)
        row = idx.get(_rel_index_key(key_rel, profile)) if key_rel else None
        stored_mt = float((row or {}).get("mtime") or 0.0)
        if stored_mt and int(stored_mt) == int(mt):
            return
        if _is_online_only(physical):
            # Rebuilding would download the original; the cached thumb stays the placeholder.
            return
        digest = _digest(rel_key, mt, profile)
        if digest == known_digest:
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


def _existing_thumb(digest: str) -> tuple[Optional[Path], str]:
    avif_p, jpg_p = _cache_paths(digest)
    if avif_p.is_file():
        return avif_p, "image/avif"
    if jpg_p.is_file():
        return jpg_p, "image/jpeg"
    return None, ""


def lookup_cached(
    path: str,
    *,
    email: str = "",
    profile: str = "grid",
    resolve_physical: Optional[Callable[..., str]] = None,
    marketing_relative: Optional[Callable[..., str]] = None,
) -> tuple[Optional[Path], str, str, str, float]:
    """Find an existing thumb without ever opening the original.

    Returns (thumb_file, content_type, digest, rel, source_mtime); thumb_file None on miss.
    Order: rel index, v2 key (whole-second mtime), legacy v1 key (exact mtime).
    """
    prof = _norm_profile(profile)
    logical = _rel_from_logical(path)
    hit, ctype, digest = _lookup_by_rel(logical, prof)
    if hit is not None:
        return hit, ctype, digest, logical, 0.0
    if _marketing_cache_only() or not _drive_letter_alive(path):
        return None, "", "", logical, 0.0
    physical, rel = _physical_and_rel(path, email, resolve_physical, marketing_relative)
    if not _drive_letter_alive(physical):
        return None, "", "", rel, 0.0
    mt = _mtime_quick(physical)
    if mt is None:
        return None, "", "", rel, 0.0
    for version in (KEY_VERSION, LEGACY_KEY_VERSION):
        digest = _digest(rel, mt, prof, version)
        hit, ctype = _existing_thumb(digest)
        if hit is not None:
            if logical and logical != rel:
                _remember_rel(logical, prof, digest, mt)
            return hit, ctype, digest, rel, mt
    return None, "", "", rel, mt


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

    miss = (404, b"", "application/json", {
        "ok": False,
        "error": "not_found",
        "thumb_source": "cache",
        "cache_only": True,
    })
    if not _drive_letter_alive(path):
        return miss
    physical, rel2 = _physical_and_rel(path, email, resolve_physical, marketing_relative)
    if not _drive_letter_alive(physical):
        return miss
    mt2 = _mtime_quick(physical)
    if mt2 is None:
        return miss
    if rel2:
        rel = rel2
    logical = _rel_from_logical(path)
    for version in (KEY_VERSION, LEGACY_KEY_VERSION):
        found_digest = _digest(rel, mt2, prof, version)
        hit, hit_ctype = _existing_thumb(found_digest)
        if hit is not None:
            if logical and logical != rel:
                _remember_rel(logical, prof, found_digest, mt2)
            return _serve_cached(hit, hit_ctype, found_digest, prof, rel, mt2, "cache")

    if _is_online_only(physical):
        # Never build from a cloud placeholder: reading it downloads the whole file.
        return 404, b"", "application/json", {
            "ok": False,
            "error": "online_only",
            "state": "online_only",
            "thumb_source": "cache",
        }

    digest = _digest(rel, mt2, prof)
    if logical and logical != rel:
        _remember_rel(logical, prof, digest, mt2)
    avif_p, jpg_p = _cache_paths(digest)

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
    hit, _ctype, _digest_hex, _rel, _mt = lookup_cached(
        path,
        profile=profile,
        email=email,
        resolve_physical=resolve_physical,
        marketing_relative=marketing_relative,
    )
    return hit is not None


PREVIEW_PROFILE_ORDER = ("modal", "card", "grid")
ORIGINAL_FAST_BUDGET_S = 0.1


def _readable_within(physical: str, budget_s: float) -> bool:
    """True when the first bytes of a local file arrive within budget (never call on placeholders)."""
    box: dict = {}

    def _worker() -> None:
        try:
            with open(physical, "rb") as fh:
                fh.read(64 * 1024)
            box["ok"] = True
        except OSError:
            box["ok"] = False

    t = threading.Thread(target=_worker, daemon=True, name="dam-original-probe")
    t.start()
    t.join(timeout=max(0.01, budget_s))
    return bool(box.get("ok"))


def media_preview_gate(
    path: str,
    *,
    email: str = "",
    resolve_physical: Optional[Callable[..., str]] = None,
    budget_s: float = ORIGINAL_FAST_BUDGET_S,
) -> Optional[tuple[int, bytes, str, dict]]:
    """Cache-first gate for image previews served from /media.

    Returns None when the original is local and readable within budget (serve it),
    otherwise the best cached thumb. Cloud placeholders are never opened.
    """
    physical, _rel = _physical_and_rel(path, email, resolve_physical, None)
    online_only = _is_online_only(physical)
    if not online_only and os.path.isfile(physical) and _readable_within(physical, budget_s):
        return None
    for prof in PREVIEW_PROFILE_ORDER:
        hit, ctype, digest, rel, mt = lookup_cached(physical or path, email=email, profile=prof)
        if hit is not None:
            code, body, out_ctype, meta = _serve_cached(hit, ctype, digest, prof, rel, mt, "cache")
            meta["online_only"] = online_only
            return code, body, out_ctype, meta
    if online_only:
        return 404, b"", "application/json", {
            "ok": False,
            "error": "online_only",
            "state": "online_only",
            "path": path,
        }
    return None


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


# ---------------------------------------------------------------------------
# NAS seed download + publish (not in Windows installer).
# SoT: /volume1/web/Panel-DAM/bin/PAMIEC-PODRECZNA  (never a pre-git sidecar).
# HTTPS: https://inyfinn.synology.me/Panel-DAM/bin/PAMIEC-PODRECZNA/
# W:     W:\web\Panel-DAM\bin\PAMIEC-PODRECZNA
# Local: {REPO_ROOT}/PAMIEC-PODRECZNA  (bin/PAMIEC-PODRECZNA). Never X: or M:.
# SSH:   syno-ddns (same host as .cursor/ops/synology/sync-pamiec-podreczna.py).
# ---------------------------------------------------------------------------
import socket
import urllib.error
import urllib.request

NAS_CACHE_URL_DEFAULT = "https://inyfinn.synology.me/Panel-DAM/bin/PAMIEC-PODRECZNA"
NAS_CACHE_PATH_DEFAULT = Path(r"W:\web\Panel-DAM\bin\PAMIEC-PODRECZNA")
NAS_CACHE_SSH_DEST = "/volume1/web/Panel-DAM/bin/PAMIEC-PODRECZNA"
NAS_SSH_HOST_DEFAULT = "syno-ddns"
SEED_THUMB_HINT = 329
LOW_LOCAL_THUMBS = 80
MANIFEST_NAME = "manifest.json"
PACK_NAME = "cache-pack.tar"
FILES_TSV_NAME = "files.tsv"
PROVENANCE_SKIP = frozenset(
    {
        MANIFEST_NAME,
        PACK_NAME,
        "cache-pack.meta.json",
        FILES_TSV_NAME,
        ".dam-write-probe",
    }
)
# Stan pobierania NIE moze lezec w drzewie repo. bin/apps/desktop/data jest
# synchronizowane przez Synology Drive, ktore trzyma plik otwarty - zmierzone
# 21.09.2026: 132 z 200 zapisow atomowych przechodzi, reszta leci
# PermissionError [WinError 5] i _write_json_atomic polyka go po cichu.
# Efekt: pasek postepu stoi albo znika, a uzytkownik widzi "nie pobiera sie".
# Ta sama choroba co status watchera indeksu naprawiony w 2.1.6.
SYNC_STATUS_FILE = platform_compat.user_state_dir() / "cache-sync-status.json"
PUBLISH_QUEUE_FILE = DESKTOP_DIR / "data" / "cache-publish-queue.json"

_sync_lock = threading.Lock()
_sync_state: dict = {
    "running": False,
    "phase": "idle",
    "done": 0,
    "total": 0,
    "copied": 0,
    "skipped": 0,
    "error": "",
    "source": "",
    "started_at": "",
    "finished_at": "",
    "eta_sec": None,
    "message": "",
}
_sync_thread_started = False
_publish_lock = threading.Lock()


def nas_cache_url() -> str:
    return (os.environ.get("DAM_NAS_CACHE_URL") or NAS_CACHE_URL_DEFAULT).rstrip("/")


def nas_cache_path() -> Path:
    override = (os.environ.get("DAM_NAS_CACHE_PATH") or "").strip()
    return Path(override) if override else NAS_CACHE_PATH_DEFAULT


def nas_ssh_host() -> str:
    return (os.environ.get("DAM_NAS_SSH_HOST") or NAS_SSH_HOST_DEFAULT).strip() or NAS_SSH_HOST_DEFAULT


def nas_ssh_dest() -> str:
    return (os.environ.get("DAM_NAS_SSH_DEST") or NAS_CACHE_SSH_DEST).rstrip("/")


def _utc_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _mtime_ts(val) -> float:
    if val is None or val == "":
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    text = str(val).strip()
    try:
        return float(text)
    except (TypeError, ValueError):
        pass
    iso = text
    if iso.endswith("Z"):
        iso = iso[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(iso).timestamp()
    except ValueError:
        return 0.0


def _unix_to_iso(ts: float) -> str:
    if not ts:
        return ""
    try:
        return datetime.fromtimestamp(float(ts), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except (OSError, OverflowError, ValueError):
        return ""


def local_tree_stats() -> dict:
    """Folder scan used to decide fetch. Skips pack/manifest sidecars."""
    root = cache_root()
    file_count = 0
    total_bytes = 0
    last_unix = 0.0
    try:
        for dirpath, _dirnames, filenames in os.walk(root):
            for name in filenames:
                if name in PROVENANCE_SKIP:
                    continue
                full = Path(dirpath) / name
                try:
                    st = full.stat()
                except OSError:
                    continue
                file_count += 1
                total_bytes += int(st.st_size)
                if st.st_mtime > last_unix:
                    last_unix = float(st.st_mtime)
    except OSError:
        pass
    generated = _utc_iso()
    return {
        "generated_at": generated,
        "file_count": file_count,
        "total_bytes": total_bytes,
        "last_mtime": _unix_to_iso(last_unix) or generated,
        "last_mtime_unix": last_unix,
        "root": str(root),
    }


def provenance_payload(*, source: str, synced_at: str | None = None) -> dict:
    stats = local_tree_stats()
    out = {
        "generated_at": stats["generated_at"],
        "file_count": stats["file_count"],
        "total_bytes": stats["total_bytes"],
        "last_mtime": stats["last_mtime"],
        "last_mtime_unix": stats["last_mtime_unix"],
        "source": source,
    }
    if synced_at:
        out["synced_at"] = synced_at
    return out


def local_manifest_path() -> Path:
    return cache_root() / MANIFEST_NAME


def write_local_manifest(payload: dict) -> Path:
    disk = {
        "generated_at": payload.get("generated_at") or _utc_iso(),
        "file_count": int(payload.get("file_count") or 0),
        "total_bytes": int(payload.get("total_bytes") or 0),
        "last_mtime": payload.get("last_mtime") or "",
        "source": payload.get("source") or "local",
    }
    if payload.get("last_mtime_unix") is not None:
        disk["last_mtime_unix"] = payload.get("last_mtime_unix")
    _write_json_atomic(local_manifest_path(), disk)
    return local_manifest_path()


def persist_cache_state(*, source: str, synced: bool = True) -> dict:
    now = _utc_iso()
    payload = provenance_payload(source=source, synced_at=now if synced else None)
    write_local_manifest(payload)
    try:
        import dam_db

        dam_db.kv_local_set(
            dam_db.THUMB_CACHE_MANIFEST_KEY,
            payload,
            updated_by="dam-cache",
        )
    except Exception:
        pass
    try:
        import pg_db

        public_mode = False
        try:
            import local_bridge

            public_mode = bool(getattr(local_bridge, "PUBLIC_MODE", False))
        except Exception:
            public_mode = False
        # Boot-time manifest push (ensure_boot_sync -> start_cache_download):
        # opisuje LOKALNY stan cache tej maszyny w chwili startu. Zainstalowana
        # kopia i most publiczny (moze serwowac przestarzala kopie panelu) nie
        # moga nadpisywac tym baze przy kazdym starcie - patrz
        # pg_db.should_seed_kv_from_local. Jawna publikacja nowych miniatur
        # (_record_publish / publish_new_thumbs) to inna sciezka i zostaje.
        if pg_db.should_seed_kv_from_local("thumb-cache-manifest", public_mode=public_mode):
            pg_db.upsert_thumb_cache_manifest(payload, updated_by="dam-cache")
    except Exception:
        pass
    return payload


def read_db_cache_state() -> dict:
    try:
        import dam_db

        data = dam_db.kv_local_get(dam_db.THUMB_CACHE_MANIFEST_KEY, {})
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def decide_cache_action(
    remote: dict | None,
    local: dict | None,
    db: dict | None = None,
) -> str:
    """Synology is SoT. empty→download, remote newer→delta, match→noop."""
    local = local or {}
    local_n = int(local.get("file_count") or 0)
    local_b = int(local.get("total_bytes") or 0)
    if remote is None:
        return "blocked" if local_n == 0 else "noop"
    remote_n = int(remote.get("file_count") or 0)
    remote_b = int(remote.get("total_bytes") or 0)
    if local_n == 0:
        return "download"

    # Licz miniatury, nie cale drzewo. NAS trzyma obok nich cache-pack.tar,
    # files.tsv i manifest.json, ktorych lokalnie celowo nie zapisujemy
    # (PROVENANCE_SKIP), wiec file_count ZAWSZE jest wiekszy o te kilka
    # pozycji. Na porownaniu drzew "delta" nigdy sie nie konczyla i kompletny
    # cache pobieralby sie w kolko. Zmierzone: drzewo 14361 vs 14360,
    # miniatury 14353 vs 14353 - zgodne co do sztuki.
    remote_thumbs = _manifest_files(remote)
    db_synced = _mtime_ts((db or {}).get("synced_at") or (db or {}).get("generated_at"))
    remote_gen = _mtime_ts(remote.get("generated_at"))

    if remote_thumbs:
        # Brakuje sztuk -> dociagnij.
        if int(local_thumb_stats().get("files") or 0) < len(remote_thumbs):
            return "delta"
        # Tyle samo sztuk: o zmianie TRESCI mowi tylko data wygenerowania
        # manifestu. NIE porownujemy last_mtime drzewa - NAS przepakowuje
        # cache-pack.tar przy kazdej publikacji, wiec drzewo jest tam zawsze
        # "nowsze" i kazdy start ciagnalby 115 MB bez potrzeby.
        if db_synced and remote_gen > db_synced + 1.0:
            return "delta"
        return "noop"

    if remote_n > local_n or remote_b > local_b:
        return "delta"
    remote_mt = _mtime_ts(remote.get("last_mtime_unix") or remote.get("last_mtime"))
    local_mt = _mtime_ts(local.get("last_mtime_unix") or local.get("last_mtime"))
    if remote_mt > local_mt + 1.0:
        return "delta"
    if db_synced and remote_gen > db_synced + 1.0 and remote_n >= local_n:
        return "delta"
    return "noop"


def _ssh_run(host: str, remote: str, stdin: bytes | None = None) -> subprocess.CompletedProcess[bytes]:
    cmd = [
        "ssh",
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=5",
        host,
        remote,
    ]
    return subprocess.run(
        cmd,
        input=stdin,
        capture_output=True,
        creationflags=_no_window_flags(),
    )


def ssh_reachable() -> bool:
    try:
        proc = _ssh_run(nas_ssh_host(), "true")
        return proc.returncode == 0
    except OSError:
        return False


def _walk_tree_sizes(root: Path) -> dict[str, int]:
    files: dict[str, int] = {}
    if not root.is_dir():
        return files
    for dirpath, _dirnames, filenames in os.walk(root):
        for name in filenames:
            if name in PROVENANCE_SKIP:
                continue
            full = Path(dirpath) / name
            rel = full.relative_to(root).as_posix()
            try:
                files[rel] = int(full.stat().st_size)
            except OSError:
                continue
    return files


def _walk_remote_ssh() -> dict[str, int]:
    dest = nas_ssh_dest()
    script = (
        f"DEST={dest!r}\n"
        "if [ ! -d \"$DEST\" ]; then exit 0; fi\n"
        "find \"$DEST\" -type f -printf '%s\\t%P\\n'\n"
    )
    proc = _ssh_run(nas_ssh_host(), "sh -s", stdin=script.encode("utf-8"))
    if proc.returncode != 0:
        return {}
    files: dict[str, int] = {}
    text = (proc.stdout or b"").decode("utf-8", "replace")
    for line in text.splitlines():
        if not line.strip() or "\t" not in line:
            continue
        size_s, rel = line.split("\t", 1)
        name = Path(rel.replace("\\", "/")).name
        if name in PROVENANCE_SKIP:
            continue
        try:
            files[rel.replace("\\", "/")] = int(size_s)
        except ValueError:
            continue
    return files


def _safe_extract_tar(tf: tarfile.TarFile, dest: Path) -> int:
    """Rozpakowuje nadpisujac - Synology jest zrodlem prawdy dla miniatur."""
    dest_r = dest.resolve()
    extracted = 0
    last = 0.0
    for member in tf:
        name = (member.name or "").replace("\\", "/").lstrip("/")
        if not name or name.endswith("/"):
            continue
        if Path(name).name in PROVENANCE_SKIP:
            continue
        target = (dest / name).resolve()
        if not str(target).startswith(str(dest_r)):
            continue
        tf.extract(member, dest)
        extracted += 1
        if time.time() - last >= 0.4:
            last = time.time()
            _set_sync(
                running=True,
                phase="extract",
                done=extracted,
                message=f"Rozpakowuje pamiec podreczna ({extracted})",
            )
    return extracted


def _pull_ssh_rels(rels: list[str]) -> int:
    if not rels:
        return 0
    dest = nas_ssh_dest()
    local = cache_root()
    local.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(
        [
            "ssh",
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=5",
            nas_ssh_host(),
            f"tar -cf - -C {dest!r} -T -",
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=_no_window_flags(),
    )
    assert proc.stdin is not None
    proc.stdin.write("\n".join(rels).encode("utf-8"))
    proc.stdin.close()
    extracted = 0
    assert proc.stdout is not None
    with tarfile.open(fileobj=proc.stdout, mode="r|") as tf:
        extracted = _safe_extract_tar(tf, local)
    stderr = proc.stderr.read() if proc.stderr else b""
    code = proc.wait()
    if code != 0 and extracted == 0:
        raise RuntimeError(
            (stderr or b"").decode("utf-8", "replace").strip() or f"ssh tar rc={code}"
        )
    return extracted


def _pull_ssh_full() -> int:
    dest = nas_ssh_dest()
    local = cache_root()
    local.mkdir(parents=True, exist_ok=True)
    excludes = " ".join(f"--exclude={name}" for name in sorted(PROVENANCE_SKIP))
    proc = subprocess.Popen(
        [
            "ssh",
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=5",
            nas_ssh_host(),
            f"tar -cf - -C {dest!r} {excludes} .",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=_no_window_flags(),
    )
    extracted = 0
    assert proc.stdout is not None
    with tarfile.open(fileobj=proc.stdout, mode="r|") as tf:
        extracted = _safe_extract_tar(tf, local)
    stderr = proc.stderr.read() if proc.stderr else b""
    code = proc.wait()
    if code != 0 and extracted == 0:
        raise RuntimeError(
            (stderr or b"").decode("utf-8", "replace").strip() or f"ssh tar rc={code}"
        )
    return extracted


def _copy_missing_from_dir(src: Path) -> int:
    if not src.is_dir():
        return 0
    dest_root = cache_root()
    copied = 0
    remote = _walk_tree_sizes(src)
    local = _walk_tree_sizes(dest_root)
    # Rozmiar inny niz na NAS-ie = nadpisujemy. Synology jest zrodlem prawdy.
    todo = [rel for rel, size in remote.items() if local.get(rel) != size]
    total = len(todo)
    last = 0.0
    for i, rel in enumerate(todo, 1):
        src_f = src / Path(*rel.split("/"))
        dest_f = dest_root / Path(*rel.split("/"))
        if _copy_path_atomic(src_f, dest_f):
            copied += 1
        if time.time() - last >= 0.4:
            last = time.time()
            _set_sync(
                running=True,
                phase="download",
                done=i,
                total=total,
                copied=copied,
                pct=int(100 * i / total) if total else 0,
                source="nas_file",
                message=f"Pobieram pamiec podreczna ({i}/{total})",
            )
    return copied


def _pull_https_pack() -> int:
    """Pobiera cache-pack.tar strumieniowo na dysk, potem rozpakowuje.

    Bylo: _http_get_bytes wciagal cale 115 MB do RAM jednym resp.read(), bez
    zadnego postepu i bez wznawiania. Uzytkownik widzial zamrozony pasek, a
    zerwane polaczenie kasowalo cala prace. Serwer oddaje 206 z Content-Range
    (sprawdzone 21.09.2026), wiec wznawiamy od miejsca przerwania.
    """
    url = nas_cache_url() + "/" + PACK_NAME
    dest = cache_root()
    dest.mkdir(parents=True, exist_ok=True)
    tmp = dest / (PACK_NAME + ".part")

    total_bytes = 0
    got = 0
    try:
        got = tmp.stat().st_size if tmp.is_file() else 0
    except OSError:
        got = 0

    for attempt in range(3):
        try:
            headers = {"User-Agent": "DAM-ETA-cache-sync/1"}
            if got > 0:
                headers["Range"] = f"bytes={got}-"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120.0, context=_ssl_ctx()) as resp:
                status = int(getattr(resp, "status", 200) or 200)
                if got > 0 and status != 206:
                    got = 0  # serwer zignorowal Range - zaczynamy od zera
                clen = resp.headers.get("Content-Length")
                total_bytes = got + (int(clen) if clen and clen.isdigit() else 0)
                mode = "ab" if got > 0 else "wb"
                last = 0.0
                with open(tmp, mode) as fh:
                    while True:
                        chunk = resp.read(1024 * 1024)
                        if not chunk:
                            break
                        fh.write(chunk)
                        got += len(chunk)
                        if time.time() - last >= 0.4:
                            last = time.time()
                            pct = int(100 * got / total_bytes) if total_bytes else 0
                            _set_sync(
                                running=True,
                                phase="download",
                                pct=min(99, pct),
                                bytes_done=got,
                                bytes_total=total_bytes,
                                message=(
                                    "Pobieram pamiec podreczna "
                                    f"({got / 1048576:.0f}/{total_bytes / 1048576:.0f} MB)"
                                ),
                            )
            break
        except (urllib.error.URLError, OSError, TimeoutError, ValueError) as exc:
            if attempt == 2:
                _set_sync(message=f"Pobieranie przerwane: {exc}")
                return 0
            time.sleep(1.0 * (attempt + 1))
            try:
                got = tmp.stat().st_size if tmp.is_file() else 0
            except OSError:
                got = 0

    if not tmp.is_file() or tmp.stat().st_size == 0:
        return 0

    _set_sync(running=True, phase="extract", pct=99, message="Rozpakowuje pamiec podreczna")
    try:
        with tarfile.open(tmp, mode="r:*") as tf:
            extracted = _safe_extract_tar(tf, dest)
    except (tarfile.TarError, OSError) as exc:
        # Niekompletna albo uszkodzona paczka: skasuj, nastepny przebieg pobierze od nowa.
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        _set_sync(message=f"Paczka uszkodzona: {exc}")
        return 0
    try:
        tmp.unlink(missing_ok=True)
    except OSError:
        pass
    return extracted


def _load_remote_files_tsv(source: str) -> dict[str, int]:
    text = ""
    if source == "https":
        raw = _http_get_bytes(nas_cache_url() + "/" + FILES_TSV_NAME, timeout=60.0)
        if raw:
            text = raw.decode("utf-8", "replace")
    else:
        p = nas_cache_path() / FILES_TSV_NAME
        if p.is_file():
            try:
                text = p.read_text(encoding="utf-8")
            except OSError:
                text = ""
    files: dict[str, int] = {}
    for line in text.splitlines():
        if not line.strip() or "\t" not in line:
            continue
        size_s, rel = line.split("\t", 1)
        name = Path(rel.replace("\\", "/")).name
        if name in PROVENANCE_SKIP:
            continue
        try:
            files[rel.replace("\\", "/")] = int(size_s)
        except ValueError:
            continue
    return files


def _http_get_to_file(url: str, dest: Path, timeout: float = 60.0) -> bool:
    body = _http_get_bytes(url, timeout=timeout)
    if not body:
        return False
    return _copy_bytes_atomic(dest, body)


def _write_json_atomic(path: Path, payload: dict) -> bool:
    """Zapis atomowy z ponowieniem. Zwraca True, gdy plik naprawde powstal.

    os.replace na Windows leci PermissionError, gdy ktos trzyma plik otwarty
    (Synology Drive, antywirus, indeksator). Pojedyncza proba gubila co trzeci
    zapis statusu - stad wrazenie, ze pobieranie stoi.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + f".{os.getpid()}.tmp")
    try:
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except OSError:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        return False
    for attempt in range(4):
        try:
            os.replace(tmp, path)
            return True
        except OSError:
            if attempt < 3:
                time.sleep(0.05 * (attempt + 1))
    try:
        tmp.unlink(missing_ok=True)
    except OSError:
        pass
    return False


def _read_json_file(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def local_thumb_stats() -> dict:
    thumbs = cache_root() / "thumbs"
    avif_n = 0
    jpg_n = 0
    try:
        if thumbs.is_dir():
            for p in thumbs.iterdir():
                if not p.is_file():
                    continue
                suf = p.suffix.lower()
                if suf == ".avif":
                    avif_n += 1
                elif suf in (".jpg", ".jpeg"):
                    jpg_n += 1
    except OSError:
        pass
    return {
        "root": str(cache_root()),
        "thumbs_dir": str(thumbs),
        "avif": avif_n,
        "jpg": jpg_n,
        "files": avif_n + jpg_n,
    }


def _persist_sync_state() -> None:
    with _sync_lock:
        snap = dict(_sync_state)
    snap["updated_at"] = _utc_iso()
    _write_json_atomic(SYNC_STATUS_FILE, snap)


def _set_sync(**fields) -> None:
    with _sync_lock:
        _sync_state.update(fields)
    _persist_sync_state()


_remote_cache: dict = {"at": 0.0, "manifest": None, "source": ""}
REMOTE_MANIFEST_TTL_SEC = 120.0


def _cached_remote_manifest() -> dict | None:
    """Manifest z Synology z krotkim TTL - sync_status() jest odpytywany w petli."""
    now = time.time()
    if now - float(_remote_cache.get("at") or 0.0) < REMOTE_MANIFEST_TTL_SEC:
        return _remote_cache.get("manifest")
    manifest, source = load_remote_manifest()
    _remote_cache["at"] = now
    _remote_cache["manifest"] = manifest
    _remote_cache["source"] = source
    return manifest


def _needs_download(tree: dict, db_state: dict) -> bool:
    return decide_cache_action(_cached_remote_manifest(), tree, db_state) != "noop"


def sync_status() -> dict:
    disk = _read_json_file(SYNC_STATUS_FILE)
    with _sync_lock:
        live = dict(_sync_state)
    out = {**disk, **live}
    stats = local_thumb_stats()
    nas_p = nas_cache_path()
    nas_ok = False
    try:
        nas_ok = nas_p.is_dir()
    except OSError:
        nas_ok = False
    tree = local_tree_stats()
    db_state = read_db_cache_state()
    out.update(
        {
            "ok": True,
            "local": stats,
            "tree": tree,
            "db": db_state,
            "nas_url": nas_cache_url(),
            "nas_path": str(nas_p),
            "nas_ssh_dest": nas_ssh_dest(),
            "nas_writable": False,
            "nas_present": nas_ok,
            # Bylo: file_count == 0, czyli UI startowalo pobieranie WYLACZNIE przy
            # zupelnie pustym cache. Kto mial 5000 z 14361 miniatur, nie dostawal
            # juz nigdy brakujacych - stad "masa cache po prostu sie nie pobiera".
            # Teraz pyta o to samo, co run_cache_download: czy Synology ma wiecej.
            "needs_download": _needs_download(tree, db_state),
            "remote": _cached_remote_manifest(),
            "seed_hint": SEED_THUMB_HINT,
        }
    )
    if nas_ok:
        try:
            probe = nas_p / ".dam-write-probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            out["nas_writable"] = True
        except OSError:
            out["nas_writable"] = False
    q = _read_json_file(PUBLISH_QUEUE_FILE)
    pending = q.get("pending") if isinstance(q.get("pending"), list) else []
    out["publish_queue"] = len(pending)
    return out


_ssl_ctx_cache: list = []


def _ssl_ctx():
    """Jeden kontekst SSL na proces.

    Budowanie go per zadanie wczytuje z dysku caly pakiet certyfikatow: 74 ms
    na miniature przy 16 watkach, przy pobraniu trwajacym 18 ms. 410 miniatur
    schodzi z 30.2 s do ~2 s. SSLContext jest bezpieczny watkowo.
    """
    if _ssl_ctx_cache:
        return _ssl_ctx_cache[0]
    ctx = None
    try:
        import ssl

        try:
            import certifi  # type: ignore

            ctx = ssl.create_default_context(cafile=certifi.where())
        except Exception:
            ctx = ssl.create_default_context()
    except Exception:
        ctx = None
    _ssl_ctx_cache.append(ctx)
    return ctx


def _http_get_bytes(url: str, timeout: float = 25.0) -> bytes | None:
    ctx = _ssl_ctx()
    req = urllib.request.Request(url, headers={"User-Agent": "DAM-ETA-cache-sync/1"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            status = int(getattr(resp, "status", 200) or 200)
            if status >= 400:
                return None
            return resp.read()
    except (urllib.error.URLError, OSError, TimeoutError, ValueError):
        return None


def _load_manifest_https() -> tuple[dict | None, str]:
    url = nas_cache_url() + "/manifest.json"
    raw = _http_get_bytes(url)
    if not raw:
        return None, "https_fail"
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, "https_bad_json"
    if not isinstance(data, dict):
        return None, "https_bad_json"
    return data, "https"


def _load_manifest_nas_file() -> tuple[dict | None, str]:
    p = nas_cache_path() / "manifest.json"
    if not p.is_file():
        return None, "nas_missing"
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data, "nas_file"
    except (OSError, json.JSONDecodeError):
        return None, "nas_bad_json"
    return None, "nas_bad_json"


def _remote_stats_from_ssh() -> dict | None:
    dest = nas_ssh_dest()
    script = (
        f"DEST={dest!r}\n"
        "if [ ! -d \"$DEST\" ]; then echo MISSING; exit 0; fi\n"
        "n=$(find \"$DEST\" -type f "
        "! -name manifest.json ! -name cache-pack.tar "
        "! -name cache-pack.meta.json ! -name files.tsv "
        "! -name .dam-write-probe | wc -l)\n"
        "b=$(find \"$DEST\" -type f "
        "! -name manifest.json ! -name cache-pack.tar "
        "! -name cache-pack.meta.json ! -name files.tsv "
        "! -name .dam-write-probe -printf '%s\\n' | awk '{s+=$1} END {print s+0}')\n"
        "mt=$(find \"$DEST\" -type f "
        "! -name manifest.json ! -name cache-pack.tar "
        "! -name cache-pack.meta.json ! -name files.tsv "
        "! -name .dam-write-probe -printf '%T@\\n' | sort -n | tail -1)\n"
        "echo \"$n $b ${mt:-0}\"\n"
    )
    proc = _ssh_run(nas_ssh_host(), "sh -s", stdin=script.encode("utf-8"))
    if proc.returncode != 0:
        return None
    text = (proc.stdout or b"").decode("utf-8", "replace").strip()
    if not text or text.startswith("MISSING"):
        return None
    parts = text.split()
    if len(parts) < 3:
        return None
    last_unix = float(parts[2])
    return {
        "generated_at": _utc_iso(),
        "file_count": int(float(parts[0])),
        "total_bytes": int(float(parts[1])),
        "last_mtime": _unix_to_iso(last_unix),
        "last_mtime_unix": last_unix,
        "source": "synology",
    }


def load_remote_manifest(*, allow_ssh: bool = False) -> tuple[dict | None, str]:
    data, src = _load_manifest_https()
    if data:
        return data, src
    data2, src2 = _load_manifest_nas_file()
    if data2:
        return data2, src2
    if allow_ssh and ssh_reachable():
        ssh_stats = _remote_stats_from_ssh()
        if ssh_stats:
            return ssh_stats, "ssh"
    return None, src if src != "https_fail" else src2


def _manifest_files(manifest: dict) -> list[dict]:
    files = manifest.get("files")
    if isinstance(files, list) and files:
        out = []
        for item in files:
            if isinstance(item, dict) and item.get("digest"):
                out.append(item)
            elif isinstance(item, str) and item:
                out.append({"digest": item, "ext": "avif"})
        return out
    thumbs = manifest.get("thumbs")
    if isinstance(thumbs, dict):
        out = []
        for digest, meta in thumbs.items():
            row = {"digest": str(digest), "ext": "avif"}
            if isinstance(meta, dict):
                row.update({k: meta.get(k) for k in ("ext", "size", "rel") if k in meta})
            out.append(row)
        return out
    return []


def _copy_bytes_atomic(dest: Path, body: bytes) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    try:
        tmp.write_bytes(body)
        os.replace(tmp, dest)
        return True
    except OSError:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        return False


def _copy_path_atomic(src: Path, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    try:
        shutil.copy2(src, tmp)
        os.replace(tmp, dest)
        return True
    except OSError:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        return False


def _fetch_remote_thumb(digest: str, ext: str, source: str) -> bytes | None:
    name = f"{digest}.{ext.lstrip('.')}"
    if source == "https":
        return _http_get_bytes(nas_cache_url() + "/thumbs/" + name)
    p = nas_cache_path() / "thumbs" / name
    try:
        if p.is_file():
            return p.read_bytes()
    except OSError:
        return None
    return None


def _merge_rel_index_from_remote(source: str) -> None:
    remote_idx: dict = {}
    if source == "https":
        raw = _http_get_bytes(nas_cache_url() + "/thumb-rel-index.json", timeout=40.0)
        if raw:
            try:
                parsed = json.loads(raw.decode("utf-8"))
                if isinstance(parsed, dict):
                    remote_idx = parsed
            except (UnicodeDecodeError, json.JSONDecodeError):
                remote_idx = {}
    else:
        p = nas_cache_path() / "thumb-rel-index.json"
        if p.is_file():
            try:
                parsed = json.loads(p.read_text(encoding="utf-8"))
                if isinstance(parsed, dict):
                    remote_idx = parsed
            except (OSError, json.JSONDecodeError):
                remote_idx = {}
    if not remote_idx:
        return
    global _REL_INDEX
    local = _load_rel_index()
    changed = False
    with _REL_INDEX_LOCK:
        for key, row in remote_idx.items():
            if not isinstance(row, dict):
                continue
            if key not in local:
                local[key] = row
                changed = True
                continue
            try:
                remote_mt = float(row.get("mtime") or 0.0)
                local_mt = float((local.get(key) or {}).get("mtime") or 0.0)
            except (TypeError, ValueError):
                continue
            if remote_mt > local_mt:
                local[key] = row
                changed = True
        _REL_INDEX = local
    if changed:
        _save_rel_index()


DOWNLOAD_WORKERS = 16


def _download_listed_thumbs(
    manifest: dict, source: str, *, force: bool = False
) -> tuple[int, int, int]:
    """Pobiera miniatury z Synology rownolegle. Synology jest zrodlem prawdy.

    Nadpisujemy lokalny plik, gdy jego rozmiar nie zgadza sie z manifestem
    (albo przy force). Zgodny rozmiar pomijamy - inaczej kazdy start ciagnalby
    116 MB od nowa bez powodu.

    Sekwencyjnie bylo 18 ms/plik = 4.3 min na 14361 miniatur (zmierzone
    21.09.2026 na laczu do inyfinn.synology.me). 16 watkow schodzi do ~0.5 min.
    """
    files = _manifest_files(manifest)
    if not files:
        return 0, 0, 0
    local_thumbs = cache_root() / "thumbs"
    local_thumbs.mkdir(parents=True, exist_ok=True)
    fetch_src = "https" if source == "https" else "nas_file"

    # Jeden skan katalogu zamiast stat() na kazdy wpis manifestu. Przy 14353
    # miniaturach osobne staty (nawet na 16 watkach) zajmowaly 33 s, czyli
    # dluzej niz pobranie calej paczki. Skan to ulamek sekundy.
    have: dict[str, int] = {}
    try:
        with os.scandir(local_thumbs) as it:
            for entry in it:
                if entry.is_file():
                    try:
                        have[entry.name] = entry.stat().st_size
                    except OSError:
                        pass
    except OSError:
        pass

    if not force:
        pending = []
        for item in files:
            digest = str(item.get("digest") or "").strip().lower()
            ext = str(item.get("ext") or "avif").lstrip(".").lower() or "avif"
            want = int(item.get("size") or 0)
            got = have.get(f"{digest}.{ext}")
            if got is not None and got > 0 and (want <= 0 or got == want):
                continue
            pending.append(item)
        skipped_upfront = len(files) - len(pending)
        files = pending
    else:
        skipped_upfront = 0

    total = len(files)
    if total == 0:
        return 0, skipped_upfront, skipped_upfront

    counters = {"done": 0, "copied": 0, "skipped": skipped_upfront, "failed": 0}
    lock = threading.Lock()
    t0 = time.time()
    last_report = [0.0]

    def _one(item: dict) -> None:
        # Lista jest juz przefiltrowana (albo force=True), wiec tu tylko pobieramy
        # i nadpisujemy - Synology jest zrodlem prawdy.
        digest = str(item.get("digest") or "").strip().lower()
        ext = str(item.get("ext") or "avif").lstrip(".").lower() or "avif"
        outcome = "failed"
        if digest:
            body = _fetch_remote_thumb(digest, ext, fetch_src)
            if body and _copy_bytes_atomic(local_thumbs / f"{digest}.{ext}", body):
                outcome = "copied"
        with lock:
            counters["done"] += 1
            if outcome != "failed":
                counters[outcome] += 1
            else:
                counters["failed"] += 1
            done = counters["done"]
            snapshot = dict(counters)
            # Status na dysk najwyzej co 0.4 s. 14361 zapisow po jednym na plik
            # dusilo pobieranie i wchodzilo w konflikt z Synology Drive.
            due = (time.time() - last_report[0]) >= 0.4 or done == total
            if due:
                last_report[0] = time.time()
        if not due:
            return
        elapsed = max(0.2, time.time() - t0)
        rate = done / elapsed
        remain = max(0, total - done)
        _set_sync(
            running=True,
            phase="download",
            done=done,
            total=total,
            copied=snapshot["copied"],
            skipped=snapshot["skipped"],
            failed=snapshot["failed"],
            pct=int(100 * done / total) if total else 0,
            eta_sec=int(remain / rate) if rate > 0 else None,
            source=source,
            message=f"Pobieram brakujace miniatury ({done}/{total})",
        )

    with ThreadPoolExecutor(max_workers=DOWNLOAD_WORKERS, thread_name_prefix="dam-thumb") as ex:
        list(ex.map(_one, files))

    if counters["failed"]:
        # Nie chowamy tego. Wczesniej nieudane pobranie liczylo sie jak zrobione
        # i uzytkownik nie mial skad wiedziec, ze brakuje mu miniatur.
        _set_sync(
            failed=counters["failed"],
            error=f"nie pobrano {counters['failed']} z {total} miniatur",
        )
    return counters["copied"], counters["skipped"], total


def _download_https_file_index(source: str) -> int:
    remote = _load_remote_files_tsv(source)
    if not remote:
        return 0
    local = _walk_tree_sizes(cache_root())
    copied = 0
    missing = [rel for rel, size in remote.items() if local.get(rel) != size]
    total = len(missing)
    for i, rel in enumerate(missing, 1):
        dest = cache_root() / Path(*rel.split("/"))
        url = nas_cache_url() + "/" + rel
        if source == "https":
            ok = _http_get_to_file(url, dest)
        else:
            src = nas_cache_path() / Path(*rel.split("/"))
            ok = src.is_file() and _copy_path_atomic(src, dest)
        if ok:
            copied += 1
        _set_sync(
            running=True,
            phase="download",
            done=i,
            total=total,
            copied=copied,
            source=source,
            message=f"Pobieram pamiec podreczna ({i}/{total})",
        )
    return copied


def _fetch_cache_tree(
    *, action: str, source: str, manifest: dict | None, force: bool = False
) -> tuple[int, str]:
    """Return (copied, used_source). Never writes X:/ or M:.

    Kolejnosc zrodel zmieniona 21.09.2026 po pomiarze na tym samym NAS-ie:

        cache-pack.tar przez HTTPS   22.1 s  (115 MB, 14 360 miniatur)
        kopiowanie z W:\\           148.9 s  (to samo, 6.7x wolniej)

    W: to RaiDrive po WebDAV - kazdy z 14 tysiecy plikow to osobna operacja
    sieciowa, a _copy_missing_from_dir nie raportuje postepu, wiec pasek stal
    nieruchomo przez ~2.5 minuty. Stad "pobiera w chuj wolno albo wcale".
    Paczka idzie pierwsza, W: zostaje jako zapas, gdy HTTPS nie odpowiada.
    """
    # Delta = brakuje kilku sztuk. Ciaganie calej paczki 115 MB dla pieciu
    # miniatur nie ma sensu; _download_listed_thumbs bierze tylko te, ktorych
    # rozmiar nie zgadza sie z manifestem, i robi to na 16 watkach.
    if action == "delta" and manifest and _manifest_files(manifest):
        copied, _skipped, _total = _download_listed_thumbs(
            manifest, source or "https", force=force
        )
        if copied:
            return copied, "https-files"

    packed = _pull_https_pack()
    if packed:
        return packed, "https-pack"
    if nas_cache_path().is_dir():
        copied = _copy_missing_from_dir(nas_cache_path())
        if copied or action == "delta":
            return copied, "nas_file"
        if action == "download" and copied == 0 and local_tree_stats()["file_count"] > 0:
            return 0, "nas_file"
    if ssh_reachable():
        if action == "download":
            return _pull_ssh_full(), "ssh"
        remote = _walk_remote_ssh()
        local = _walk_tree_sizes(cache_root())
        missing = sorted(rel for rel, size in remote.items() if local.get(rel) != size)
        return _pull_ssh_rels(missing), "ssh"
    listed = _download_https_file_index("https" if source == "https" else source)
    if listed:
        return listed, "https-files"
    if manifest:
        copied, _skipped, _total = _download_listed_thumbs(
            manifest, source or "https", force=force
        )
        return copied, source or "https"
    return 0, source or ""


def run_cache_download(*, force: bool = False) -> dict:
    """Compare local folder + SQLite vs Synology manifest, then fetch if needed."""
    local = local_tree_stats()
    db_state = read_db_cache_state()
    manifest, source = load_remote_manifest(allow_ssh=True)
    action = "download" if force else decide_cache_action(manifest, local, db_state)
    if action == "noop":
        persisted = persist_cache_state(source=source or "local", synced=True)
        _set_sync(
            running=False,
            phase="idle",
            message="match",
            done=local["file_count"],
            total=int((manifest or {}).get("file_count") or local["file_count"]),
            error="",
            source=source,
            action="noop",
        )
        return {
            "ok": True,
            "started": False,
            "reason": "match",
            "action": "noop",
            "local": local_thumb_stats(),
            "tree": persisted,
            "remote": manifest,
            "source": source,
        }
    if action == "blocked":
        # Manifest missing (HTTPS 404 until NAS write). Still try SSH / W: / pack.
        action = "download"

    total = int((manifest or {}).get("file_count") or 0)
    _set_sync(
        running=True,
        phase="download",
        done=0,
        total=total,
        copied=0,
        skipped=0,
        error="",
        source=source,
        action=action,
        started_at=_utc_iso(),
        finished_at="",
        eta_sec=None,
        message="Pobieram pamiec podreczna",
    )
    used_source = source
    copied = 0
    try:
        copied, used_source = _fetch_cache_tree(
            action=action,
            source=source,
            manifest=manifest,
            force=force,
        )
        try:
            _merge_rel_index_from_remote("https" if used_source.startswith("https") else "nas_file")
        except Exception:
            pass
        persisted = persist_cache_state(source=used_source or "synology", synced=True)
        after = local_tree_stats()
        _remote_cache["at"] = 0.0  # policz needs_download na swiezo po pobraniu
        _set_sync(
            running=False,
            phase="idle",
            pct=100,
            done=after["file_count"],
            total=int((manifest or {}).get("file_count") or after["file_count"]),
            copied=copied,
            skipped=max(0, after["file_count"] - copied),
            finished_at=_utc_iso(),
            eta_sec=0,
            message="Gotowe",
            error="",
            source=used_source,
            action=action,
        )
        return {
            "ok": True,
            "started": True,
            "action": action,
            "copied": copied,
            "skipped": max(0, after["file_count"] - copied),
            "total": after["file_count"],
            "source": used_source,
            "local": local_thumb_stats(),
            "tree": persisted,
            "remote": manifest,
        }
    except Exception as exc:  # noqa: BLE001
        _set_sync(
            running=False,
            phase="error",
            error=str(exc),
            message="Blad pobierania",
            source=used_source,
            action=action,
        )
        return {"ok": False, "error": str(exc), "action": action, "source": used_source}


def start_cache_download(*, force: bool = False) -> dict:
    global _sync_thread_started
    with _sync_lock:
        if _sync_state.get("running"):
            return {"ok": True, "started": False, "running": True, "sync": dict(_sync_state)}
    local = local_tree_stats()
    db_state = read_db_cache_state()
    manifest, source = load_remote_manifest()
    action = "download" if force else decide_cache_action(manifest, local, db_state)
    if action == "noop":
        persist_cache_state(source=source or "local", synced=True)
        return {
            "ok": True,
            "started": False,
            "reason": "match",
            "action": "noop",
            "local": local_thumb_stats(),
            "tree": local,
            "remote": manifest,
        }
    if action == "blocked":
        action = "download"

    def _worker() -> None:
        global _sync_thread_started
        try:
            run_cache_download(force=force)
        except Exception as exc:  # noqa: BLE001
            _set_sync(running=False, phase="error", error=str(exc), message="Blad pobierania")
        finally:
            _sync_thread_started = False

    with _sync_lock:
        _sync_state["running"] = True
        _sync_state["phase"] = "download"
        _sync_state["action"] = action
        _sync_thread_started = True
    threading.Thread(target=_worker, daemon=True, name="dam-cache-download").start()
    return {
        "ok": True,
        "started": True,
        "running": True,
        "action": action,
        "local": local_thumb_stats(),
        "tree": local,
        "remote": manifest,
    }


def ensure_boot_sync() -> dict:
    """Bridge boot: compare folder + SQLite vs Synology, fetch when needed."""
    return start_cache_download(force=False)


def _publisher_name() -> str:
    try:
        return socket.gethostname() or "dam-pc"
    except OSError:
        return "dam-pc"


def build_local_manifest(*, publisher: str = "") -> dict:
    stats = local_thumb_stats()
    thumbs = cache_root() / "thumbs"
    files: list[dict] = []
    try:
        if thumbs.is_dir():
            for p in sorted(thumbs.iterdir(), key=lambda x: x.name):
                if not p.is_file():
                    continue
                suf = p.suffix.lower()
                if suf not in (".avif", ".jpg", ".jpeg"):
                    continue
                try:
                    size = int(p.stat().st_size)
                except OSError:
                    size = 0
                files.append(
                    {
                        "digest": p.stem,
                        "ext": suf.lstrip("."),
                        "size": size,
                    }
                )
    except OSError:
        pass
    idx = _load_rel_index()
    entries = []
    for key, row in idx.items():
        if not isinstance(row, dict):
            continue
        digest = str(row.get("digest") or "")
        if not digest:
            continue
        try:
            mt = float(row.get("mtime") or 0.0)
        except (TypeError, ValueError):
            mt = 0.0
        size = 0
        avif_p, jpg_p = _cache_paths(digest)
        hit = avif_p if avif_p.is_file() else jpg_p if jpg_p.is_file() else None
        if hit is not None:
            try:
                size = int(hit.stat().st_size)
            except OSError:
                size = 0
        entries.append(
            {
                "rel_profile": key,
                "digest": digest,
                "mtime": mt,
                "size": size,
            }
        )
    tree = local_tree_stats()
    return {
        "version": 1,
        "generated_at": tree["generated_at"],
        "file_count": tree["file_count"],
        "total_bytes": tree["total_bytes"],
        "last_mtime": tree["last_mtime"],
        "last_mtime_unix": tree["last_mtime_unix"],
        "source": "local",
        "publisher": publisher or _publisher_name(),
        "thumb_count": stats["avif"] + stats["jpg"],
        "avif": stats["avif"],
        "jpg": stats["jpg"],
        "files": files,
        "rel_index": "thumb-rel-index.json",
        "rel_count": len(entries),
        "entries": entries[:8000],
    }


def _queue_publish(items: list[dict]) -> None:
    q = _read_json_file(PUBLISH_QUEUE_FILE)
    pending = q.get("pending") if isinstance(q.get("pending"), list) else []
    seen = {str(x.get("digest")) for x in pending if isinstance(x, dict)}
    for it in items:
        d = str(it.get("digest") or "")
        if d and d not in seen:
            pending.append(it)
            seen.add(d)
    _write_json_atomic(
        PUBLISH_QUEUE_FILE,
        {"pending": pending, "updated_at": _utc_iso()},
    )


def _nas_dir_writable(root: Path) -> bool:
    try:
        root.mkdir(parents=True, exist_ok=True)
        (root / "thumbs").mkdir(parents=True, exist_ok=True)
        probe = root / ".dam-write-probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True
    except OSError:
        return False


def _publish_via_ssh(files: list[Path], publisher: str) -> dict:
    """Wyslij brakujace miniatury przez SSH - tym samym kanalem, ktorym juz pobieramy.

    Bez tego publikacja dziala wylacznie na maszynie z zamapowanym dyskiem W:
    (RaiDrive). Na kazdej innej kolejka rosla w nieskonczonosc, a realny upload
    robilo zewnetrzne zadanie Harmonogramu Windows wskazujace na repo dewelopera.
    """
    host = nas_ssh_host()
    dest = nas_ssh_dest()
    remote = _walk_remote_ssh()
    send: list[tuple[Path, str]] = []
    skipped = 0
    for p in files:
        rel = "thumbs/" + p.name
        try:
            size = int(p.stat().st_size)
        except OSError:
            continue
        if remote.get(rel) == size:
            skipped += 1
            continue
        send.append((p, rel))
    manifest = build_local_manifest(publisher=publisher)
    slim = {k: v for k, v in manifest.items() if k != "entries"}
    extras: list[tuple[str, bytes]] = [
        ("manifest.json", json.dumps(slim, ensure_ascii=False, indent=2).encode("utf-8"))
    ]
    try:
        rel_index = _rel_index_path()
        if rel_index.is_file():
            extras.append(("thumb-rel-index.json", rel_index.read_bytes()))
    except OSError:
        pass
    try:
        proc = subprocess.Popen(
            [
                "ssh",
                "-o",
                "BatchMode=yes",
                "-o",
                "ConnectTimeout=5",
                host,
                f"mkdir -p {dest!r} && tar -xf - -C {dest!r}",
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=_no_window_flags(),
        )
    except OSError as exc:
        return {"ok": False, "error": f"ssh_spawn:{exc}", "copied": 0, "skipped": skipped}
    try:
        with tarfile.open(fileobj=proc.stdin, mode="w|", format=tarfile.PAX_FORMAT) as tar:
            for src, rel in send:
                tar.add(src, arcname=rel, recursive=False)
            for name, payload in extras:
                info = tarfile.TarInfo(name)
                info.size = len(payload)
                info.mtime = int(time.time())
                tar.addfile(info, io.BytesIO(payload))
    except (OSError, tarfile.TarError) as exc:
        proc.kill()
        proc.communicate()
        return {"ok": False, "error": f"ssh_tar:{exc}", "copied": 0, "skipped": skipped}
    _out, err = proc.communicate()
    if proc.returncode != 0:
        detail = (err or b"").decode("utf-8", "replace").strip()[:200]
        return {"ok": False, "error": f"ssh_tar_rc{proc.returncode}:{detail}", "copied": 0, "skipped": skipped}
    pack = _refresh_remote_sidecars(host, dest)
    return {"ok": True, "copied": len(send), "skipped": skipped, "manifest": manifest, "pack": pack}


def _refresh_remote_sidecars(host: str, dest: str) -> str:
    """Odswiez files.tsv i cache-pack.tar na NAS.

    Z tych dwoch plikow swieza instalacja bez SSH pobiera miniatury po HTTPS
    (_pull_https_pack, _download_https_file_index). Bez odswiezenia nowe
    miniatury nigdy nie trafilyby na obcy komputer przy pierwszym starcie.
    """
    skip = (
        "! -name manifest.json ! -name cache-pack.tar "
        "! -name cache-pack.meta.json ! -name files.tsv "
        "! -name files.tsv.tmp ! -name cache-pack.tar.tmp "
        "! -name thumb-rel-index.json ! -name .dam-write-probe"
    )
    script = (
        f"DEST={dest!r}\n"
        "set -e\n"
        "cd \"$DEST\"\n"
        f"find . -type f {skip} -printf '%s\\t%P\\n' > files.tsv.tmp\n"
        "mv -f files.tsv.tmp files.tsv\n"
        "n=$(wc -l < files.tsv | tr -d ' ')\n"
        "b=$(awk -F'\\t' '{s+=$1} END {print s+0}' files.tsv)\n"
        "need=1\n"
        "if [ -f cache-pack.meta.json ] && [ -f cache-pack.tar ]; then\n"
        "  oldn=$(sed -n 's/.*\"file_count\"[[:space:]]*:[[:space:]]*\\([0-9]*\\).*/\\1/p' cache-pack.meta.json | head -1)\n"
        "  oldb=$(sed -n 's/.*\"total_bytes\"[[:space:]]*:[[:space:]]*\\([0-9]*\\).*/\\1/p' cache-pack.meta.json | head -1)\n"
        "  if [ \"$oldn\" = \"$n\" ] && [ \"$oldb\" = \"$b\" ]; then need=0; fi\n"
        "fi\n"
        "if [ \"$need\" = 1 ]; then\n"
        "  tar -cf cache-pack.tar.tmp --exclude=cache-pack.tar --exclude=cache-pack.tar.tmp "
        "--exclude=cache-pack.meta.json --exclude=manifest.json --exclude=files.tsv "
        "--exclude=files.tsv.tmp --exclude=thumb-rel-index.json --exclude=.dam-write-probe .\n"
        "  mv -f cache-pack.tar.tmp cache-pack.tar\n"
        "  printf '{\"file_count\": %s, \"total_bytes\": %s, \"generated_at\": \"%s\"}\\n' "
        "\"$n\" \"$b\" \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > cache-pack.meta.json\n"
        "  echo PACK_REFRESHED\n"
        "else\n"
        "  echo PACK_OK\n"
        "fi\n"
    )
    try:
        proc = _ssh_run(host, "sh -s", stdin=script.encode("utf-8"))
    except OSError as exc:
        return f"error:{exc}"
    if proc.returncode != 0:
        return "error:" + (proc.stderr or b"").decode("utf-8", "replace").strip()[:200]
    lines = (proc.stdout or b"").decode("utf-8", "replace").strip().splitlines()
    return lines[-1] if lines else "unknown"


def _record_publish(manifest: dict, publisher: str, nas_display: str) -> tuple[bool, bool]:
    """Zapisz slad publikacji w Postgresie i w lokalnym stanie cache."""
    kv_ok = False
    table_ok = False
    try:
        import pg_db

        kv_ok = bool(
            pg_db.upsert_thumb_cache_manifest(
                {
                    "version": 1,
                    "nas_url": nas_cache_url() + "/",
                    "nas_path": nas_display,
                    "thumb_count": manifest["thumb_count"],
                    "avif": manifest.get("avif"),
                    "publisher": publisher,
                    "published_at": manifest["generated_at"],
                    "rel_count": manifest.get("rel_count") or 0,
                },
                updated_by=publisher,
            )
        )
        table_ok = bool(pg_db.upsert_thumb_cache_rows(manifest.get("entries") or [], publisher=publisher))
    except Exception:  # noqa: BLE001
        kv_ok = False
        table_ok = False
    persist_cache_state(source="local", synced=True)
    return kv_ok, table_ok


def publish_new_thumbs(*, publisher: str = "") -> dict:
    """Copy local thumbs missing on NAS. Use SSH when W: is absent."""
    with _publish_lock:
        return _publish_new_thumbs_locked(publisher=publisher or _publisher_name())


def _publish_new_thumbs_locked(*, publisher: str) -> dict:
    local_thumbs = cache_root() / "thumbs"
    nas_root = nas_cache_path()
    queued_only = False
    if not _nas_dir_writable(nas_root):
        queued_only = True
    files: list[Path] = []
    try:
        if local_thumbs.is_dir():
            files = [
                p
                for p in local_thumbs.iterdir()
                if p.is_file() and p.suffix.lower() in (".avif", ".jpg", ".jpeg")
            ]
    except OSError:
        files = []
    copied = 0
    skipped = 0
    queued: list[dict] = []
    if queued_only:
        res = _publish_via_ssh(files, publisher)
        if res.get("ok"):
            _write_json_atomic(PUBLISH_QUEUE_FILE, {"pending": [], "updated_at": _utc_iso()})
            manifest = res.get("manifest") or build_local_manifest(publisher=publisher)
            kv_ok, table_ok = _record_publish(manifest, publisher, nas_ssh_dest())
            return {
                "ok": True,
                "transport": "ssh",
                "copied": int(res.get("copied") or 0),
                "skipped": int(res.get("skipped") or 0),
                "queued": 0,
                "nas_path": nas_ssh_dest(),
                "publisher": publisher,
                "kv": kv_ok,
                "table": table_ok,
                "thumb_count": manifest["thumb_count"],
            }
        for p in files:
            queued.append({"digest": p.stem, "ext": p.suffix.lstrip("."), "src": str(p)})
        _queue_publish(queued)
        return {
            "ok": False,
            "error": str(res.get("error") or "nas_not_writable"),
            "queued": len(queued),
            "nas_path": str(nas_root),
            "copied": 0,
        }
    nas_thumbs = nas_root / "thumbs"
    try:
        nas_thumbs.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        _queue_publish([{"digest": p.stem, "ext": p.suffix.lstrip("."), "src": str(p)} for p in files])
        return {"ok": False, "error": f"nas_mkdir:{exc}", "queued": len(files)}
    q = _read_json_file(PUBLISH_QUEUE_FILE)
    pending = q.get("pending") if isinstance(q.get("pending"), list) else []
    extra_src = []
    for item in pending:
        if not isinstance(item, dict):
            continue
        src = Path(str(item.get("src") or ""))
        if src.is_file():
            extra_src.append(src)
    seen_names = set()
    work = []
    for p in list(files) + extra_src:
        if p.name in seen_names:
            continue
        seen_names.add(p.name)
        work.append(p)
    for p in work:
        dest = nas_thumbs / p.name
        try:
            if dest.is_file() and dest.stat().st_size > 0:
                skipped += 1
                continue
        except OSError:
            pass
        if _copy_path_atomic(p, dest):
            copied += 1
        else:
            queued.append({"digest": p.stem, "ext": p.suffix.lstrip("."), "src": str(p)})
    if queued:
        _queue_publish(queued)
    else:
        _write_json_atomic(PUBLISH_QUEUE_FILE, {"pending": [], "updated_at": _utc_iso()})
    manifest = build_local_manifest(publisher=publisher)
    try:
        (nas_root / "manifest.json").write_text(
            json.dumps({k: v for k, v in manifest.items() if k != "entries"}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        return {
            "ok": False,
            "error": f"manifest_write:{exc}",
            "copied": copied,
            "skipped": skipped,
            "nas_path": str(nas_root),
        }
    try:
        shutil.copy2(_rel_index_path(), nas_root / "thumb-rel-index.json")
    except OSError:
        pass
    kv_ok, table_ok = _record_publish(manifest, publisher, str(nas_root).replace("/", "\\"))
    return {
        "ok": True,
        "transport": "drive",
        "copied": copied,
        "skipped": skipped,
        "queued": len(queued),
        "nas_path": str(nas_root),
        "publisher": publisher,
        "kv": kv_ok,
        "table": table_ok,
        "thumb_count": manifest["thumb_count"],
    }


def start_publish_after_index() -> dict:
    def _worker() -> None:
        try:
            publish_new_thumbs()
        except Exception:
            pass

    threading.Thread(target=_worker, daemon=True, name="dam-cache-publish").start()
