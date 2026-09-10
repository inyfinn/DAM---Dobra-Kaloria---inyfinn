# -*- coding: utf-8 -*-
"""Bridge: revision folder → viz_latest path; file-index routes."""
from __future__ import annotations

import json
import sys
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import local_bridge as lb  # noqa: E402

INDEX = lb.WEB_ROOT / "data" / "file-index.json"

REVISION_FOLDERS = {
    "6300782.00": (
        "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK/01 - BATONY/"
        "CYNAMONKA — [ nerkowcowy ]/MINI - 18 06 2026 - 6300782.00 - F"
    ),
    "6300784.00": (
        "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK/01 - BATONY/"
        "CIASTO ŚLIWKOWE — [ nerkowcowy ]/MINI - 18 06 2026 - 6300784.00 - F"
    ),
    "6900001.00": (
        "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK/07 - DATESY/"
        "LEMON CHEESECAKE - [ daktyle ]/DOY - LEMON CHEESECAKE 100 g - 04.08.2026 - BEZ INDEKSU"
    ),
    "6300728.00": (
        "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK/02 - KULKI/"
        "BANOFFEE KAKAO — [ deserowe ]/DOY - 65 g - 24.03.2026 - 6300728.00"
    ),
}


def _viz_path_for_index(idx: str) -> str:
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    for row in data.get("viz_latest") or []:
        if str(row.get("index") or "") == idx:
            return str(row.get("path") or "")
    return ""


def test_file_index_has_viz_latest_for_probe_ids():
    assert INDEX.is_file(), "live file-index missing"
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    viz = data.get("viz_latest") or []
    assert len(viz) >= 400
    for idx in REVISION_FOLDERS:
        vp = _viz_path_for_index(idx)
        assert vp, f"missing viz_latest.path for {idx}"
        assert Path(lb.normalize_path(vp)).is_file(), f"viz file missing on disk: {idx}"


def test_resolve_revision_folder_to_viz_file():
    fi = lb._load_json(INDEX, {})
    for idx, folder in REVISION_FOLDERS.items():
        expected = _viz_path_for_index(idx)
        resolved = lb._lookup_viz_path_from_index(folder, fi)
        assert resolved, f"lookup failed for folder {idx}"
        assert lb.normalize_path(resolved) == lb.normalize_path(expected)


def test_coerce_media_target_accepts_revision_folder():
    for idx, folder in REVISION_FOLDERS.items():
        expected = _viz_path_for_index(idx)
        got = lb._coerce_media_target(folder)
        assert lb.normalize_path(got) == lb.normalize_path(expected)


def test_warm_viz_thumbs_from_index_smoke():
    if not lb.dam_thumb_cache:
        return
    out = lb._warm_viz_thumbs_from_index(limit=4)
    assert out.get("ok") is True
    n = int(out.get("queued") or out.get("count") or 0)
    assert n >= 1


if __name__ == "__main__":
    test_file_index_has_viz_latest_for_probe_ids()
    test_resolve_revision_folder_to_viz_file()
    test_coerce_media_target_accepts_revision_folder()
    test_warm_viz_thumbs_from_index_smoke()
    print("OK viz index thumb routes")
