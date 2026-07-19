# -*- coding: utf-8 -*-
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "web" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from brand_tag_utils import enrich_asset_tags, extract_folder_segment_tags  # noqa: E402


class BrandTagUtilsTest(unittest.TestCase):
    def test_folder_slidery_segment_tags(self):
        path = r"X:/Marketing/- POLSKA/06 - STRONY WWW/02 - SLIDERY KATEGORIE/foo.png"
        tags = extract_folder_segment_tags(path)
        self.assertIn("Slidery", tags)
        self.assertIn("Na sklep", tags)

    def test_ecommerce_slidery_subfolder(self):
        asset = {
            "name": "INDEKS GLIKEMICZNY - BANER - DESKTOP - 1920x600.jpg",
            "path": r"X:/Marketing/- POLSKA/07 - E-COMMERCE/02 - KAMPANIE/SLIDERY/INDEKS.jpg",
            "appearance_tags": [],
            "search_blob": "",
        }
        enrich_asset_tags(asset, {}, {})
        appearance = [t.lower() for t in asset.get("appearance_tags") or []]
        self.assertIn("slidery", appearance)
        self.assertIn("na sklep", appearance)


if __name__ == "__main__":
    unittest.main()
