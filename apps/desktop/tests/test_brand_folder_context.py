# -*- coding: utf-8 -*-
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "web" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from brand_folder_context import (  # noqa: E402
    enrich_folder_groups,
    extract_theme_tags,
    is_legacy_marketing_archive,
    variant_device_label,
    variant_stem,
)


class BrandFolderContextTest(unittest.TestCase):
    def test_back_to_school_variants(self):
        folder = r"X:/Marketing/- POLSKA/06 - STRONY WWW/Back To School"
        assets = [
            {
                "id": "br-001",
                "name": "Back to school - 1920 x 600.jpg",
                "path": folder + "/Back to school - 1920 x 600.jpg",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
            {
                "id": "br-002",
                "name": "Back to school - 992 x 600.jpg",
                "path": folder + "/Back to school - 992 x 600.jpg",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
            {
                "id": "br-003",
                "name": "Back to school - 576 x 600_.jpg",
                "path": folder + "/Back to school - 576 x 600_.jpg",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
            {
                "id": "br-004",
                "name": "Back to school -10 - Slider.psd",
                "path": folder + "/Back to school -10 - Slider.psd",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
        ]
        file_index = {
            "products": [
                {"id": "orzech-czekolada-daktylowy", "display_name": "ORZECH CZEKOLADA", "path": "x/ORZECH CZEKOLADA"},
                {"id": "chrupiacy-orzech-daktylowy", "display_name": "CHRUPIĄCY ORZECH", "path": "x/CHRUPIĄCY ORZECH"},
            ],
            "viz_latest": [],
        }
        enrich_folder_groups(assets, file_index)
        raster = assets[1]
        self.assertIn("Szkoła", raster.get("appearance_tags") or [])
        self.assertIn("Edytowalny", raster.get("appearance_tags") or [])
        self.assertEqual(len(raster.get("folder_variants") or []), 3)
        labels = [v["label"] for v in raster["folder_variants"]]
        self.assertEqual(labels, ["Desktop", "Tablet", "Mobile"])
        linked = raster.get("folder_linked_product_ids") or []
        self.assertIn("orzech-czekolada-daktylowy", linked)
        self.assertIn("chrupiacy-orzech-daktylowy", linked)

    def test_legacy_archive_tags(self):
        path = r"X:/Marketing/-- ARCHIWUM --/05_Materiały graficzne e-commerce/foo.jpg"
        self.assertTrue(is_legacy_marketing_archive(path))

    def test_variant_stem(self):
        self.assertEqual(variant_stem("Back to school - 992 x 600.jpg"), "Back to school")
        self.assertEqual(variant_device_label("Back to school - 992 x 600.jpg"), "Tablet")


if __name__ == "__main__":
    unittest.main()
