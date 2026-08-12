"""Shared marketing root resolution for DAM index/build scripts.

Order (HARD, 2026-08-03): machine-config base_path for current user ->
M:/ (source PC Synology mount with - POLSKA/- EKSPORT/-- ARCHIWUM --) ->
X:/Marketing -> D:/Marketing.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

REQUIRED_MARKERS = ("- POLSKA", "- EKSPORT", "-- ARCHIWUM --")


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
    """Read base_path from desktop machine-config (per Windows user)."""
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
        if not entry and isinstance(data.get("base_path"), str) and data.get("base_path").strip():
            entry = {"base_path": data["base_path"]}
        if not entry:
            # Any user entry that looks valid (scripts run under service accounts)
            for ent in users.values():
                if isinstance(ent, dict) and str(ent.get("base_path") or "").strip():
                    entry = ent
                    break
        base = str((entry or {}).get("base_path") or "").strip()
        if base:
            out.append(Path(base))
        break
    return out


def resolve_marketing_base() -> Path:
    """Prefer configured / M: root over legacy X:/Marketing."""
    ordered: list[Path] = []
    ordered.extend(_machine_config_bases())
    ordered.extend(
        [
            Path("M:/"),
            Path("X:/Marketing"),
            Path("D:/Marketing"),
        ]
    )
    seen: set[str] = set()
    for cand in ordered:
        key = str(cand).replace("\\", "/").rstrip("/").lower()
        if key in seen:
            continue
        seen.add(key)
        if _looks_like_marketing_root(cand):
            return cand
    return Path("M:/")


def marketing_candidates() -> list[Path]:
    """All candidate roots for existence checks (deduped)."""
    raw = _machine_config_bases() + [Path("M:/"), Path("X:/Marketing"), Path("D:/Marketing")]
    out: list[Path] = []
    seen: set[str] = set()
    for c in raw:
        key = str(c).replace("\\", "/").rstrip("/").lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out
