"""Shared marketing root resolution for DAM index/build scripts.

Order (HARD, 2026-08-03 / 2026-09-10 / 2026-09-17): machine-config base_path
for the *current* Windows user only -> M:/ -> X:/Marketing -> D:/Marketing ->
any other drive where desktop/marketing_discovery finds a Marketing root.

Never return a path that is not a real marketing root. If nothing is
reachable, return None (cache-only). Do not inherit another user's
base_path — a foreign install must not get X:\\Marketing from someone else.

A dead network drive can hang isdir for tens of seconds, so candidates are
checked in parallel with a 2 s limit and the answer is cached briefly
(is_cache_only runs on every thumbnail request in the bridge).
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
from pathlib import Path

REQUIRED_MARKERS = ("- POLSKA", "- EKSPORT", "-- ARCHIWUM --")
# Lenient on purpose (historic rule of this module): "- POLSKA" alone is enough.
LENIENT_MARKERS = ("- POLSKA",)

_DEFAULT_FALLBACKS = (Path("M:/"), Path("X:/Marketing"), Path("D:/Marketing"))
_DESKTOP_DIR = Path(__file__).resolve().parents[2] / "desktop"
_RESOLVE_TTL_SEC = 30.0
_resolve_lock = threading.Lock()
_resolve_cache: dict[tuple, tuple[float, Path | None]] = {}


def _discovery():
    """desktop/marketing_discovery, or None when it cannot be imported."""
    try:
        import marketing_discovery  # type: ignore

        return marketing_discovery
    except ImportError:
        pass
    if _DESKTOP_DIR.is_dir() and str(_DESKTOP_DIR) not in sys.path:
        sys.path.append(str(_DESKTOP_DIR))
    try:
        import marketing_discovery  # type: ignore

        return marketing_discovery
    except ImportError:
        return None


def _looks_like_marketing_root(base: Path) -> bool:
    try:
        if not base.is_dir():
            return False
    except OSError:
        return False
    # Accept if at least - POLSKA exists (minimal), prefer full trio when present.
    try:
        return (base / "- POLSKA").is_dir()
    except OSError:
        return False


def _machine_config_bases() -> list[Path]:
    """Read base_path from desktop machine-config (current Windows user only)."""
    out: list[Path] = []
    user = (os.environ.get("USERNAME") or os.environ.get("USER") or "").strip()
    candidates = [
        _DESKTOP_DIR / "machine-config.json",
        Path(r"P:/DAM/bin/apps/desktop/machine-config.json"),
    ]
    env_cfg = os.environ.get("DAM_MACHINE_CONFIG", "").strip()
    if env_cfg:
        candidates.insert(0, Path(env_cfg))
    for cfg in candidates:
        if not cfg.is_file():
            continue
        try:
            data = json.loads(cfg.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(data, dict):
            continue
        users = data.get("users") if isinstance(data.get("users"), dict) else {}
        entry = users.get(user) if user and isinstance(users.get(user), dict) else None
        # Machine-wide base_path is this install's own default, not another user.
        if not entry and isinstance(data.get("base_path"), str) and data.get("base_path").strip():
            entry = {"base_path": data["base_path"]}
        # HARD: no inheritance from a different Windows user.
        base = str((entry or {}).get("base_path") or "").strip()
        if base:
            out.append(Path(base))
        break
    return out


def _fallback_override() -> list[Path] | None:
    raw = (os.environ.get("DAM_MARKETING_FALLBACKS") or "").strip()
    if raw:
        return [Path(p.strip()) for p in raw.split(os.pathsep) if p.strip()]
    return None


def _fallback_bases() -> list[Path]:
    override = _fallback_override()
    return override if override is not None else list(_DEFAULT_FALLBACKS)


def _key(p: Path) -> str:
    return str(p).replace("\\", "/").rstrip("/").lower()


def _dedupe(paths: list[Path]) -> list[Path]:
    out: list[Path] = []
    seen: set[str] = set()
    for c in paths:
        k = _key(c)
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
    return out


def _resolve_uncached(ordered: list[Path], allow_discovery: bool) -> Path | None:
    md = _discovery()
    if md is None:
        for cand in ordered:
            if _looks_like_marketing_root(cand):
                return cand
        return None
    status = md.check_paths(ordered, required=LENIENT_MARKERS, timeout=md.PER_DRIVE_TIMEOUT_SEC)
    for cand in ordered:
        if (status.get(md.path_key(cand)) or {}).get("ok"):
            return cand
    if not allow_discovery:
        return None
    for root in md.discover_roots(required=LENIENT_MARKERS):
        return root
    return None


def resolve_marketing_base() -> Path | None:
    """Return an existing marketing root, or None (cache-only).

    Never returns a path that does not exist (no phantom M:/).
    Callers that need a disk must check for None before joining paths.
    DAM_MARKETING_FALLBACKS (explicit list) disables drive discovery.
    """
    override = _fallback_override()
    ordered = _dedupe(_machine_config_bases() + (override if override is not None else list(_DEFAULT_FALLBACKS)))
    cache_key = (tuple(_key(p) for p in ordered), override is None)
    now = time.monotonic()
    with _resolve_lock:
        hit = _resolve_cache.get(cache_key)
    if hit and now - hit[0] < _RESOLVE_TTL_SEC:
        return hit[1]
    found = _resolve_uncached(ordered, allow_discovery=override is None)
    with _resolve_lock:
        _resolve_cache.clear()
        _resolve_cache[cache_key] = (now, found)
    return found


def clear_cache() -> None:
    with _resolve_lock:
        _resolve_cache.clear()


def is_cache_only() -> bool:
    """True when no marketing root is reachable — use PAMIEC-PODRECZNA only."""
    return resolve_marketing_base() is None


def marketing_candidates() -> list[Path]:
    """All candidate roots for existence checks (deduped).

    Config and M:/X:/D: first, then roots found on other drives (cached scan).
    """
    raw = _machine_config_bases() + _fallback_bases()
    if _fallback_override() is None:
        md = _discovery()
        if md is not None:
            try:
                raw += md.discover_roots(required=LENIENT_MARKERS)
            except Exception:  # noqa: BLE001
                pass
    return _dedupe(raw)
