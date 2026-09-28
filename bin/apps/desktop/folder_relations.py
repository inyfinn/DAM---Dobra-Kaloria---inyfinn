# -*- coding: utf-8 -*-
"""Kontrakt R (partia 28.09, W2): relacje folderu liczone ze WSPOLNEGO katalogu.

Pola relacji (RELATION_FIELDS) opisuja material przez jego sasiadow w folderze
(lista wariantow, pliki edytowalne obok, "czy folder ma edytowalny", klucz
grupy). Skaner build-branding-index liczy je z tego, co akurat lezy na dysku
TEGO komputera - kopia niepelna (Synology Drive w trakcie, pliki tylko w
chmurze) daje inna liste niz pelny NAS. Dopoki kazdy komputer wysylal swoja
liste, M i X nadpisywaly sie na przemian (audyt 4.2, ping-pong rev).

Zasada:
- skan klienta NIE jest zrodlem tych pol: asset_sync ich nie porownuje i przy
  wysylce przenosi je bez zmian z wiersza bazy (stary klient ich nie traci);
- przy odczycie liczymy je tutaj, jedna funkcja compute(rows), z wierszy
  katalogu (lustro dam_assets po pull) - ta sama rewizja katalogu daje ten sam
  wynik na kazdym komputerze, z ROOT i bez;
- swiadome usuniecie pliku (tombstone) znika z list wszystkich, bo liczymy tylko
  z zywych wierszy; reczne nadpisania wariantow (branding-associations-
  overrides.json, linked_variant_ids) sa stosowane po wyliczeniu, jak w
  build-branding-index (apply_branding_assoc_overrides).

Reguly etykiet/grupowania sa te same co w buildzie - import tylko do odczytu z
bin/apps/web/scripts/brand_folder_context.py. Sciezki w wyniku sa WZGLEDNE
(path_rel); sciezke z ROOT tego komputera sklada apply_to_entries.

Pomiar, ktory uzasadnia liste pol: work/2026-09-28/W2/RAPORT.md.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Callable, Iterable

RELATION_FIELDS: tuple[str, ...] = (
    "folder_variants",
    "folder_editable_files",
    "folder_has_editable",
    "folder_group_id",
)

_bfc: Any = None


def _ctx() -> Any:
    """brand_folder_context z apps/web/scripts (ten sam uklad w repo i instalacji)."""
    global _bfc
    if _bfc is None:
        scripts = Path(__file__).resolve().parent.parent / "web" / "scripts"
        if str(scripts) not in sys.path:
            sys.path.insert(0, str(scripts))
        import brand_folder_context  # noqa: PLC0415

        _bfc = brand_folder_context
    return _bfc


def _parent(key: str) -> str:
    return key.rsplit("/", 1)[0] if "/" in key else ""


def _suffix(name: str) -> str:
    return Path(name or "").suffix.lower()


def _live(rows: dict) -> list[tuple[str, dict]]:
    out = []
    for aid, r in (rows or {}).items():
        if not isinstance(r, dict) or r.get("deleted_at") is not None:
            continue
        out.append((str(aid), r))
    return out


def _pseudo(aid: str, r: dict) -> dict:
    """Wiersz katalogu -> ksztalt assetu, ktory rozumieja funkcje buildu."""
    meta = r.get("meta") if isinstance(r.get("meta"), dict) else {}
    rel = str(r.get("path_rel") or r.get("asset_key") or "")
    name = str(r.get("name") or rel.rsplit("/", 1)[-1])
    return {
        "id": aid,
        "name": name,
        # Wiodacy "/" jak w sciezce bezwzglednej: znaczniki folderow w buildzie
        # ("/gotowe", "/wymiana/") dzialaja tez dla folderu najwyzszego poziomu.
        "path": "/" + rel,
        "path_rel": rel,
        "dimensions_px": str(meta.get("dimensions_px") or ""),
        "media_type": str(meta.get("media_type") or ""),
    }


def _variant(s: dict, label: str) -> dict:
    return {
        "id": s["id"],
        "name": s["name"],
        "path": s["path_rel"],
        "label": label,
        "media_type": s["media_type"],
    }


def compute(rows: dict, overrides: dict | None = None) -> dict[str, dict]:
    """asset_id -> {pole relacji: wartosc} dla kazdego zywego wiersza katalogu.

    rows      asset_id -> wiersz (asset_sync.normalize_row: asset_key, path_rel,
              name, meta, deleted_at). Tombstony sa pomijane.
    overrides zawartosc branding-associations-overrides.json (opcjonalnie) -
              reczne linked_variant_ids (assets / folder_groups).
    Wynik jest deterministyczny: nie zalezy od kolejnosci wierszy ani od ROOT."""
    bfc = _ctx()
    editable_ext = bfc.EDITABLE_EXT
    by_dir: dict[str, list[dict]] = {}
    for aid, r in _live(rows):
        key = str(r.get("asset_key") or "")
        by_dir.setdefault(_parent(key), []).append(_pseudo(aid, r))

    out: dict[str, dict] = {}
    order = {"Desktop": 0, "Tablet": 1, "Mobile": 2}
    for dir_key, group in by_dir.items():
        # Kolejnosc wejscia deterministyczna - build bierze group[0] jako probke
        # sciezki folderu, a os.scandir daje rozna kolejnosc na roznych dyskach.
        group.sort(key=lambda a: (a["name"].casefold(), a["path_rel"], a["id"]))
        editable = [a for a in group if _suffix(a["name"]) in editable_ext]
        editable_files = [{"id": a["id"], "name": a["name"], "path": a["path_rel"]} for a in editable]
        stems = bfc.build_folder_stems(group, dir_key)
        labels = {a["id"]: bfc.variant_device_label(a["name"], a["dimensions_px"]) for a in group}
        for a in group:
            stem_key = bfc.norm(bfc.variant_stem(a["name"]))
            siblings = stems.get(stem_key)
            if not siblings and len(stems) == 1:
                siblings = next(iter(stems.values()))
            if not siblings:
                siblings = [a]
            variants: list[dict] = []
            seen: set[str] = set()
            for s in siblings:
                if not s["id"] or s["id"] in seen:
                    continue
                seen.add(s["id"])
                variants.append(_variant(s, labels.get(s["id"]) or
                                         bfc.variant_device_label(s["name"], s["dimensions_px"])))
            variants.sort(key=lambda v: (order.get(v["label"], 9), v["label"],
                                         v["name"].casefold(), v["path"]))
            out[a["id"]] = {
                "folder_group_id": dir_key,
                "folder_has_editable": bool(editable),
                "folder_editable_files": [dict(e) for e in editable_files],
                "folder_variants": variants,
            }
    if overrides:
        _apply_variant_overrides(out, rows, overrides)
    return out


def _apply_variant_overrides(out: dict[str, dict], rows: dict, overrides: dict) -> None:
    """Reczne warianty (linked_variant_ids) - ta sama regula co build
    (apply_branding_assoc_overrides): zastepuja wyliczona liste, gdy choc jeden
    wskazany material istnieje w katalogu."""
    if not isinstance(overrides, dict):
        return
    live = {aid: _pseudo(aid, r) for aid, r in _live(rows)}

    def variants_for(vids: Iterable[str]) -> list[dict]:
        vs = []
        for vid in vids:
            va = live.get(vid)
            if va is None:
                continue
            vs.append(_variant(va, va["name"] or "Plik"))
        return vs

    def vids_of(patch: Any) -> list[str]:
        if not isinstance(patch, dict):
            return []
        return [str(x).strip() for x in (patch.get("linked_variant_ids") or []) if str(x).strip()]

    for aid, patch in (overrides.get("assets") or {}).items():
        if aid in out:
            vs = variants_for(vids_of(patch))
            if vs:
                out[aid]["folder_variants"] = vs
    for group_key, patch in (overrides.get("folder_groups") or {}).items():
        group = str(group_key or "").strip().lower()
        vs = variants_for(vids_of(patch)) if group else []
        if not vs:
            continue
        for rel in out.values():
            if str(rel.get("folder_group_id") or "").strip().lower() == group:
                rel["folder_variants"] = [dict(v) for v in vs]


def apply_to_entries(entries: list[dict], rows: dict, root: str | None,
                     overrides: dict | None = None, *,
                     local_path: Callable[[str, str | None], str] | None = None) -> int:
    """Nadpisuje pola relacji we wpisach lokalnego branding-index.json wynikiem
    compute(rows) - sciezki wzgledne skladane z ROOT tego komputera (ta sama
    regula co asset_sync.live_entries). Zwraca liczbe uzupelnionych wpisow."""
    if local_path is None:
        import asset_sync  # noqa: PLC0415

        local_path = asset_sync.local_path
    rel = compute(rows, overrides)
    n = 0
    for e in entries:
        got = rel.get(str(e.get("id") or ""))
        if got is None:
            continue
        e["folder_group_id"] = got["folder_group_id"]
        e["folder_has_editable"] = got["folder_has_editable"]
        e["folder_editable_files"] = [dict(f, path=local_path(f["path"], root))
                                      for f in got["folder_editable_files"]]
        e["folder_variants"] = [dict(v, path=local_path(v["path"], root))
                                for v in got["folder_variants"]]
        n += 1
    return n
