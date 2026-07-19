#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Weryfikacja regresji linkow produktow dla znanych kampanii brandingowych."""
from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))

from brand_folder_context import enrich_folder_groups  # noqa: E402

DATA = SCRIPTS.parent / "data"
FILE_INDEX = json.loads((DATA / "file-index.json").read_text(encoding="utf-8"))

FIXTURES: list[dict] = [
    {
        "name": "A Może Deserek",
        "folder": (
            r"X:/Marketing/- POLSKA/06 - STRONY WWW - INTERNET/01 - Strona Dobra Kaloria/"
            r"06 - SLIDERY NA GŁÓWNĄ/A Moze Deserek"
        ),
        "must": [
            "tarta-malinowa-nerkowcowy",
            "muffin-jagodowy-nerkowcowy",
            "sernik-waniliowy-nerkowcowy",
            "daktyl-wisnia-raw",
            "jab-ko-cynamon-daktylowy",
        ],
        "must_not": ["banoffee-kakao-deserowe", "tiramisu-czekolada-kakao-deserowe"],
    },
    {
        "name": "DPD Wielkanoc",
        "folder": (
            r"X:/Marketing/- POLSKA/06 - STRONY WWW - INTERNET/01 - Strona Dobra Kaloria/"
            r"06 - SLIDERY NA GŁÓWNĄ/DPD PICKUP/DPD Pickup - Świąteczne pyszności wysyłka 0 zł"
        ),
        "must": ["mix-6x-mini-batoniki-mixy"],
        "must_not": [],
    },
    {
        "name": "Back To School",
        "folder": r"X:/Marketing/- POLSKA/06 - STRONY WWW - INTERNET/01 - Strona Dobra Kaloria/06 - SLIDERY NA GŁÓWNĄ/Back To School",
        "must": ["orzech-czekolada-daktylowy", "chrupiacy-orzech-daktylowy"],
        "must_not": [],
    },
]


def run_fixture(spec: dict) -> list[str]:
    errors: list[str] = []
    assets = [
        {
            "id": "fixture-1",
            "name": "fixture.tif",
            "path": spec["folder"] + "/fixture.tif",
            "linked_product_ids": [],
            "appearance_tags": spec.get("tags") or [],
        }
    ]
    import brand_folder_context as bfc

    bfc._ASSOC_REVERSE_CACHE = None  # noqa: SLF001
    enrich_folder_groups(assets, FILE_INDEX)
    linked = assets[0].get("folder_linked_product_ids") or []
    for pid in spec.get("must") or []:
        if pid not in linked:
            errors.append(f"{spec['name']}: brak {pid} (ma: {linked})")
    for pid in spec.get("must_not") or []:
        if pid in linked:
            errors.append(f"{spec['name']}: blednie przypisano {pid}")
    return errors


def check_live_index(spec: dict, asset_id: str) -> list[str]:
    errors: list[str] = []
    index_path = DATA / "branding-index.json"
    if not index_path.is_file():
        return errors
    assets = json.loads(index_path.read_text(encoding="utf-8")).get("assets") or []
    asset = next((a for a in assets if a.get("id") == asset_id), None)
    if not asset:
        errors.append(f"{spec['name']}: brak asset {asset_id} w branding-index.json")
        return errors
    linked = [p.get("id") for p in (asset.get("linked_products") or []) if p.get("id")]
    if not linked:
        linked = asset.get("linked_product_ids") or asset.get("folder_linked_product_ids") or []
    for pid in spec.get("must") or []:
        if pid not in linked:
            errors.append(f"{spec['name']} [{asset_id}]: brak {pid} (ma: {linked})")
    for pid in spec.get("must_not") or []:
        if pid in linked:
            errors.append(f"{spec['name']} [{asset_id}]: blednie przypisano {pid}")
    return errors


LIVE_ASSET_IDS: dict[str, str] = {
    "A Może Deserek": "br-004013",
    "DPD Wielkanoc": "br-004105",
}


def main() -> int:
    all_errors: list[str] = []
    for spec in FIXTURES:
        all_errors.extend(run_fixture(spec))
        live_id = LIVE_ASSET_IDS.get(spec["name"])
        if live_id:
            all_errors.extend(check_live_index(spec, live_id))
    if all_errors:
        print("FAIL:")
        for e in all_errors:
            print(" ", e)
        return 1
    print(f"OK: {len(FIXTURES)} fixture(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
