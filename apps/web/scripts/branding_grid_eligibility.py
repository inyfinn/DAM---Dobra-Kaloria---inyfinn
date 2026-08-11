#!/usr/bin/env python3
"""Shared predicate: branding grid/head/UI excludes product visualizations."""
from __future__ import annotations

import re
from typing import Any, Mapping

_WIZKI_PATH_RE = re.compile(r"/4\s*-\s*wizki\b", re.IGNORECASE)
_VISUALS_PATH_RE = re.compile(r"/4\s*-\s*visuals\b", re.IGNORECASE)


def is_branding_grid_eligible(asset: Mapping[str, Any] | None) -> bool:
    """Return True when asset may appear in branding-grid-index/head and Branding UI."""
    if not asset or not isinstance(asset, Mapping):
        return False

    role = str(asset.get("asset_role") or "").strip().lower()
    if role == "packshot":
        return False

    src = str(asset.get("source") or "").strip().lower()
    if src in {"wizki", "visuals", "visualization"}:
        return False

    tags = asset.get("tags") or []
    if isinstance(tags, (list, tuple)):
        for tag in tags:
            if str(tag or "").strip().upper() == "WIZKI":
                return False

    path = str(asset.get("path") or "").replace("\\", "/")
    if not path:
        return True
    path_lower = path.lower()
    if _WIZKI_PATH_RE.search(path_lower) or _VISUALS_PATH_RE.search(path_lower):
        return False
    return True
