"""
Device-scoped Marketing path resolution for DAM bridge.

Roots = user-device-paths (current device) + MARKETING_CANDIDATES + machine-config.
Never invent Synology as the reason a path failed - that is UI / file-availability.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Callable, Optional, Sequence

# Default candidates when bridge has not injected its list yet.
DEFAULT_MARKETING_CANDIDATES: tuple[Path, ...] = (
    Path("X:/Marketing"),
    Path("D:/Marketing"),
    Path("M:/"),
)


def _norm(p: str | Path) -> str:
    s = str(p or "").strip().replace("/", "\\")
    while "\\\\" in s:
        s = s.replace("\\\\", "\\")
    return s


def marketing_roots(
    *,
    email: str = "",
    resolve_base_path: Optional[Callable[[str], dict]] = None,
    marketing_candidates: Sequence[Path] = DEFAULT_MARKETING_CANDIDATES,
    machine_config_path: Optional[Path] = None,
) -> list[Path]:
    """Ordered unique roots: UDP current → machine-config → candidates."""
    roots: list[Path] = []
    seen: set[str] = set()

    def add(p: Path | str | None) -> None:
        if not p:
            return
        try:
            rp = Path(str(p)).resolve()
        except OSError:
            rp = Path(str(p))
        key = str(rp).lower()
        if key in seen:
            return
        seen.add(key)
        roots.append(rp)

    if resolve_base_path and email:
        try:
            info = resolve_base_path(email) or {}
            add(info.get("base_path") or "")
        except Exception:
            pass

    if machine_config_path and machine_config_path.is_file():
        try:
            import json

            data = json.loads(machine_config_path.read_text(encoding="utf-8"))
            add((data.get("base_path") or data.get("path") or "").strip())
        except (OSError, ValueError, TypeError):
            pass

    for c in marketing_candidates:
        add(c)
    return roots


def is_under_marketing(
    path: Path | str,
    *,
    email: str = "",
    resolve_base_path: Optional[Callable[[str], dict]] = None,
    marketing_candidates: Sequence[Path] = DEFAULT_MARKETING_CANDIDATES,
    machine_config_path: Optional[Path] = None,
) -> bool:
    try:
        resolved = Path(path).resolve()
    except OSError:
        return False
    for root in marketing_roots(
        email=email,
        resolve_base_path=resolve_base_path,
        marketing_candidates=marketing_candidates,
        machine_config_path=machine_config_path,
    ):
        try:
            resolved.relative_to(root)
            return True
        except (ValueError, OSError):
            continue
    return False


def marketing_relative_key(
    path: Path | str,
    *,
    email: str = "",
    resolve_base_path: Optional[Callable[[str], dict]] = None,
    marketing_candidates: Sequence[Path] = DEFAULT_MARKETING_CANDIDATES,
    machine_config_path: Optional[Path] = None,
) -> str:
    """Relative key under Marketing root (forward slashes, lower drive-agnostic)."""
    try:
        resolved = Path(path).resolve()
    except OSError:
        resolved = Path(_norm(path))
    for root in marketing_roots(
        email=email,
        resolve_base_path=resolve_base_path,
        marketing_candidates=marketing_candidates,
        machine_config_path=machine_config_path,
    ):
        try:
            rel = resolved.relative_to(root)
            return str(rel).replace("\\", "/").lstrip("/")
        except (ValueError, OSError):
            continue
    # Fallback: basename chain without drive
    s = _norm(resolved)
    if len(s) >= 2 and s[1] == ":":
        s = s[2:]
    return s.replace("\\", "/").lstrip("/")


def resolve_physical_path(
    path: str,
    email: str = "",
    *,
    normalize_path: Optional[Callable[[str], str]] = None,
    resolve_base_path: Optional[Callable[[str], dict]] = None,
    marketing_candidates: Sequence[Path] = DEFAULT_MARKETING_CANDIDATES,
    machine_config_path: Optional[Path] = None,
    fuzzy_resolve: Optional[Callable[[str], Optional[str]]] = None,
) -> str:
    """
    Resolve user/index path to a physical file path on the current device.

    1) normalize
    2) if file exists → return
    3) rebase relative key onto each marketing root
    4) optional fuzzy_resolve (bridge rename drift)
    """
    raw = (path or "").strip()
    if not raw:
        return ""
    if normalize_path:
        target = normalize_path(raw)
    else:
        target = os.path.normpath(raw.replace("/", "\\"))

    try:
        if os.path.isfile(target):
            return target
    except OSError:
        pass

    rel = marketing_relative_key(
        target,
        email=email,
        resolve_base_path=resolve_base_path,
        marketing_candidates=marketing_candidates,
        machine_config_path=machine_config_path,
    )
    if rel:
        for root in marketing_roots(
            email=email,
            resolve_base_path=resolve_base_path,
            marketing_candidates=marketing_candidates,
            machine_config_path=machine_config_path,
        ):
            cand = root / Path(rel.replace("/", os.sep))
            try:
                if cand.is_file():
                    return str(cand)
            except OSError:
                continue

    if fuzzy_resolve:
        try:
            hit = fuzzy_resolve(target)
            if hit:
                return hit
        except Exception:
            pass
    return target
