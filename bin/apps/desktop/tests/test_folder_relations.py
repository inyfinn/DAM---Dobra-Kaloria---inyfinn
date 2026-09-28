# -*- coding: utf-8 -*-
"""Kontrakt R: folder_relations.compute(rows) - relacje folderu z katalogu.

Zgodnosc z buildem: te same etykiety, grupowanie i kolejnosc wariantow co
brand_folder_context.enrich_folder_groups (build-branding-index), ale z wierszy
katalogu zamiast z dysku jednego komputera. Bez bazy i bez plikow.
"""
from __future__ import annotations

import copy
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asset_repo  # noqa: E402
import asset_sync  # noqa: E402

try:
    import folder_relations  # noqa: E402
except ImportError:  # baseline 2.4.5
    folder_relations = None

ROOT = "D:/Marketing"
SLIDER = "- POLSKA/06 - STRONY WWW/02 - SLIDERY/Baner lato"
MIX = "- POLSKA/1 - PRODUKTY/Klopsiki 6300576/4 - WIZKI"


def _assets() -> list[dict]:
    names = {
        SLIDER: ["baner (1).png", "baner (2).png", "baner (3).png", "baner.psd"],
        MIX: ["klopsiki_front.png", "klopsiki_front.tif", "etykieta.ai", "zdjecie.jpg"],
    }
    out = []
    for folder, files in names.items():
        for i, n in enumerate(files):
            path = f"{ROOT}/{folder}/{n}"
            key = asset_sync.dir_key(path, ROOT)
            out.append({"id": asset_sync.id_of(key), "path": path, "name": n,
                        "mtime_ms": 1000 + i, "size_bytes": 10 + i,
                        "media_type": "image", "dimensions_px": ""})
    return out


def _rows(assets: list[dict]) -> dict:
    scan = asset_repo.scan_from_index(assets, ROOT)
    return {aid: dict(e, asset_id=aid, rev=i + 1, deleted_at=None)
            for i, (aid, e) in enumerate(scan.items())}


class FolderRelationsTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(folder_relations, "brak folder_relations (kontrakt R)")

    def test_parity_with_build_enrich_folder_groups(self):
        bfc = folder_relations._ctx()
        built = copy.deepcopy(_assets())
        bfc.enrich_folder_groups(built, {})
        rel = folder_relations.compute(_rows(_assets()))
        for a in built:
            got = rel[a["id"]]
            self.assertEqual(got["folder_group_id"], a["folder_group_id"], a["name"])
            self.assertEqual(got["folder_has_editable"], a["folder_has_editable"], a["name"])
            self.assertEqual(sorted(f["id"] for f in got["folder_editable_files"]),
                             sorted(f["id"] for f in a["folder_editable_files"]), a["name"])
            want = [(v["id"], v["name"], v["label"]) for v in a["folder_variants"]]
            have = [(v["id"], v["name"], v["label"]) for v in got["folder_variants"]]
            self.assertEqual(have, want, a["name"])
            for v in got["folder_variants"]:
                self.assertFalse(v["path"].startswith(ROOT), "sciezka w katalogu ma byc wzgledna")

    def test_slider_labels_in_device_order(self):
        rel = folder_relations.compute(_rows(_assets()))
        aid = asset_sync.id_of(asset_sync.key_of(f"{SLIDER}/baner (2).png"))
        self.assertEqual([v["label"] for v in rel[aid]["folder_variants"]],
                         ["Desktop", "Tablet", "Mobile"])

    def test_result_does_not_depend_on_row_order(self):
        rows = _rows(_assets())
        items = list(rows.items())
        random.Random(7).shuffle(items)
        self.assertEqual(folder_relations.compute(dict(items)), folder_relations.compute(rows))

    def test_tombstoned_rows_are_excluded(self):
        rows = _rows(_assets())
        ai = asset_sync.id_of(asset_sync.key_of(f"{MIX}/etykieta.ai"))
        rows[ai] = dict(rows[ai], deleted_at=123)
        rel = folder_relations.compute(rows)
        self.assertNotIn(ai, rel)
        other = asset_sync.id_of(asset_sync.key_of(f"{MIX}/zdjecie.jpg"))
        self.assertEqual(rel[other]["folder_editable_files"], [])
        self.assertFalse(rel[other]["folder_has_editable"])

    def test_manual_variant_override_is_kept(self):
        rows = _rows(_assets())
        target = asset_sync.id_of(asset_sync.key_of(f"{MIX}/zdjecie.jpg"))
        chosen = asset_sync.id_of(asset_sync.key_of(f"{SLIDER}/baner (1).png"))
        ov = {"assets": {target: {"linked_variant_ids": [chosen, "br-nie-istnieje"]}}}
        rel = folder_relations.compute(rows, ov)
        self.assertEqual([v["id"] for v in rel[target]["folder_variants"]], [chosen])
        # pusty/nieistniejacy wybor nie kasuje wyliczonej listy
        rel2 = folder_relations.compute(rows, {"assets": {target: {"linked_variant_ids": ["br-x"]}}})
        self.assertEqual(rel2[target]["folder_variants"],
                         folder_relations.compute(rows)[target]["folder_variants"])

    def test_apply_to_entries_uses_local_root(self):
        rows = _rows(_assets())
        for root in ("X:/Marketing", "M:"):
            entries = asset_repo.live_index(rows, root)
            n = folder_relations.apply_to_entries(entries, rows, root)
            self.assertEqual(n, len(entries))
            e = next(x for x in entries if x["name"] == "baner.psd")
            self.assertTrue(all(v["path"].startswith(root + "/") for v in e["folder_variants"]))
            self.assertEqual(e["folder_editable_files"][0]["path"], f"{root}/{SLIDER}/baner.psd")

    def test_relation_fields_contract(self):
        self.assertEqual(set(folder_relations.RELATION_FIELDS), {
            "folder_variants", "folder_editable_files", "folder_has_editable", "folder_group_id"})
        self.assertEqual(asset_sync.RELATION_FIELDS, frozenset(folder_relations.RELATION_FIELDS))


if __name__ == "__main__":
    unittest.main()
