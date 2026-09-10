"""Shared marketing root resolution for DAM index/build scripts.

Order (HARD, 2026-08-03 / 2026-09-10): machine-config base_path for the
*current* Windows user only -> M:/ -> X:/Marketing -> D:/Marketing.

Never return a path that is not a real marketing root. If nothing is
reachable, return None (cache-only). Do not inherit another user's
base_path — a foreign install must not get X:\\Marketing from someone else.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

REQUIRED_MARKERS = ("- POLSKA", "- EKSPORT", "-- ARCHIWUM --")

_DEFAULT_FALLBACKS = (Path("M:/"), Path("X:/Marketing"), Path("D:/Marketing"))


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
        Path(__file__).resolve().parents[2] / "desktop" / "machine-config.json",
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
        except (OSError, json.JSONDecodeError):
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


def _fallback_bases() -> list[Path]:
    raw = (os.environ.get("DAM_MARKETING_FALLBACKS") or "").strip()
    if raw:
        return [Path(p.strip()) for p in raw.split(os.pathsep) if p.strip()]
    return list(_DEFAULT_FALLBACKS)


def resolve_marketing_base() -> Path | None:
    """Return an existing marketing root, or None (cache-only).

    Never returns a path that does not exist (no phantom M:/).
    Callers that need a disk must check for None before joining paths.
    On this machine D:/Marketing stays valid, so index scripts keep working.
    """
    ordered: list[Path] = []
    ordered.extend(_machine_config_bases())
    ordered.extend(_fallback_bases())
    seen: set[str] = set()
    for cand in ordered:
        key = str(cand).replace("\\", "/").rstrip("/").lower()
        if key in seen:
            continue
        seen.add(key)
        if _looks_like_marketing_root(cand):
            return cand
    return None


def is_cache_only() -> bool:
    """True when no marketing root is reachable — use PAMIEC-PODRECZNA only."""
    return resolve_marketing_base() is None


def marketing_candidates() -> list[Path]:
    """All candidate roots for existence checks (deduped)."""
    raw = _machine_config_bases() + _fallback_bases()
    out: list[Path] = []
    seen: set[str] = set()
    for c in raw:
        key = str(c).replace("\\", "/").rstrip("/").lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out
