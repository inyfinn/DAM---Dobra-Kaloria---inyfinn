# -*- coding: utf-8 -*-
"""Testy stabilnych id materialow Brandingu (asset_ids.py + make_asset)."""
from __future__ import annotations

import importlib.util
import random
import string
import sys
import tempfile
import unittest
import unicodedata
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from asset_ids import asset_key, is_stable_id, stable_asset_id  # noqa: E402


def _load_build_branding_index():
    """build-branding-index.py ma myslnik w nazwie - import przez importlib."""
    path = SCRIPTS / "build-branding-index.py"
    spec = importlib.util.spec_from_file_location("build_branding_index_mod_test", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class AssetKeyCrossMountTest(unittest.TestCase):
    def test_same_key_across_mounts_and_slashes(self):
        variants = [
            "M:/- POLSKA/A/b.png",
            "X:/Marketing/- POLSKA/A/b.png",
            "D:\\Marketing\\- POLSKA\\A\\b.png",
            "/Volumes/Marketing/- POLSKA/A/b.png",
        ]
        keys = {asset_key(v) for v in variants}
        self.assertEqual(len(keys), 1, f"oczekiwano jednego klucza, mam: {keys}")

    def test_case_insensitive(self):
        k1 = asset_key("M:/- POLSKA/Folder/Plik.PNG")
        k2 = asset_key("m:/- polska/folder/plik.png")
        self.assertEqual(k1, k2)

    def test_nfc_nfd_equivalent(self):
        nfc = unicodedata.normalize("NFC", "ROŚLINNE")
        nfd = unicodedata.normalize("NFD", "ROŚLINNE")
        self.assertNotEqual(nfc, nfd, "test setup: NFC i NFD powinny byc rozne bajtowo")
        p1 = f"M:/- POLSKA/{nfc}/plik.png"
        p2 = f"M:/- POLSKA/{nfd}/plik.png"
        self.assertEqual(asset_key(p1), asset_key(p2))


class StableAssetIdTest(unittest.TestCase):
    def test_format_matches_pattern(self):
        aid = stable_asset_id("M:/- POLSKA/A/b.png")
        self.assertRegex(aid, r"^br-0\d{8}$")
        self.assertTrue(is_stable_id(aid))

    def test_same_id_across_mounts(self):
        variants = [
            "M:/- POLSKA/A/b.png",
            "X:/Marketing/- POLSKA/A/b.png",
            "D:\\Marketing\\- POLSKA\\A\\b.png",
            "/Volumes/Marketing/- POLSKA/A/b.png",
        ]
        ids = {stable_asset_id(v) for v in variants}
        self.assertEqual(len(ids), 1, f"oczekiwano jednego id, mam: {ids}")

    def test_no_duplicates_for_50000_random_paths(self):
        rng = random.Random(42)
        taken: dict[str, str] = {}
        seen_ids: set[str] = set()
        chars = string.ascii_lowercase + string.digits
        for i in range(50000):
            depth = rng.randint(1, 4)
            parts = [
                "".join(rng.choice(chars) for _ in range(rng.randint(3, 12)))
                for _ in range(depth)
            ]
            path = "M:/- POLSKA/" + "/".join(parts) + f"/plik_{i}.png"
            aid = stable_asset_id(path, taken)
            self.assertNotIn(aid, seen_ids, f"duplikat id {aid} przy path={path}")
            seen_ids.add(aid)
        self.assertEqual(len(seen_ids), 50000)

    def test_collision_resolved_and_stable(self):
        path_x = "M:/- POLSKA/A/kolizja.png"
        aid_x = stable_asset_id(path_x)
        # Symulujemy kolizje: id sciezki X juz "zajete" przez inny klucz.
        taken = {aid_x: "- polska/inny/klucz.png"}
        resolved = stable_asset_id(path_x, taken)
        self.assertNotEqual(resolved, aid_x)
        # Powtarzalnosc: to samo taken (bez modyfikacji) daje ten sam wynik.
        taken2 = {aid_x: "- polska/inny/klucz.png"}
        resolved2 = stable_asset_id(path_x, taken2)
        self.assertEqual(resolved, resolved2)


class MakeAssetStableIdTest(unittest.TestCase):
    def test_make_asset_same_id_regardless_of_call_order(self):
        bbi = _load_build_branding_index()
        with tempfile.TemporaryDirectory() as tmp:
            marketing = Path(tmp)
            polska = marketing / "- POLSKA"
            polska.mkdir(parents=True, exist_ok=True)
            fp_a = polska / "a.pdf"
            fp_b = polska / "b.pdf"
            fp_a.write_bytes(b"%PDF-1.4 fake a")
            fp_b.write_bytes(b"%PDF-1.4 fake b")

            # Swiezy _ID_TAKEN modulowy dla kazdej kolejnosci (jeden przebieg = jeden dict).
            bbi._ID_TAKEN.clear()
            asset_a1 = bbi.make_asset(1, fp_a, "DK", marketing)
            asset_b1 = bbi.make_asset(2, fp_b, "DK", marketing)

            bbi._ID_TAKEN.clear()
            asset_b2 = bbi.make_asset(1, fp_b, "DK", marketing)
            asset_a2 = bbi.make_asset(2, fp_a, "DK", marketing)

            self.assertIsNotNone(asset_a1)
            self.assertIsNotNone(asset_b1)
            self.assertIsNotNone(asset_a2)
            self.assertIsNotNone(asset_b2)
            self.assertEqual(asset_a1["id"], asset_a2["id"])
            self.assertEqual(asset_b1["id"], asset_b2["id"])
            self.assertNotEqual(asset_a1["id"], asset_b1["id"])
            self.assertTrue(is_stable_id(asset_a1["id"]))
            self.assertTrue(is_stable_id(asset_b1["id"]))


if __name__ == "__main__":
    unittest.main()
