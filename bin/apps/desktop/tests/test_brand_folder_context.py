# -*- coding: utf-8 -*-
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "web" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from brand_folder_context import (  # noqa: E402
    apply_global_product_links,
    enrich_folder_groups,
    extract_theme_tags,
    is_legacy_marketing_archive,
    should_merge_folder_rasters,
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
        self.assertTrue(raster.get("folder_has_editable"))
        self.assertNotIn("Edytowalny", raster.get("appearance_tags") or [])
        self.assertEqual(len(raster.get("folder_variants") or []), 3)
        labels = [v["label"] for v in raster["folder_variants"]]
        self.assertEqual(labels, ["Desktop", "Tablet", "Mobile"])
        linked = raster.get("folder_linked_product_ids") or []
        self.assertIn("orzech-czekolada-daktylowy", linked)
        self.assertIn("chrupiacy-orzech-daktylowy", linked)

    def test_legacy_archive_tags(self):
        path = r"X:/Marketing/-- ARCHIWUM --/05_Materiały graficzne e-commerce/foo.jpg"
        self.assertTrue(is_legacy_marketing_archive(path))

    def test_a_moze_deserek_variants(self):
        folder = r"X:/Marketing/- POLSKA/06 - STRONY WWW/A Moze Deserek"
        assets = [
            {
                "id": "br-d1",
                "name": "SLIDER a może deserek (1).tif",
                "path": folder + "/SLIDER a może deserek (1).tif",
                "linked_product_ids": [],
                "appearance_tags": [],
                "format_technical": ["raster"],
            },
            {
                "id": "br-d2",
                "name": "SLIDER a może deserek (2).tif",
                "path": folder + "/SLIDER a może deserek (2).tif",
                "linked_product_ids": [],
                "appearance_tags": [],
                "format_technical": ["raster"],
            },
            {
                "id": "br-d3",
                "name": "SLIDER a może deserek (3).tif",
                "path": folder + "/SLIDER a może deserek (3).tif",
                "linked_product_ids": [],
                "appearance_tags": [],
                "format_technical": ["raster"],
            },
        ]
        enrich_folder_groups(assets, {"products": [], "viz_latest": []})
        self.assertEqual(len(assets[0].get("folder_variants") or []), 3)
        labels = [v["label"] for v in assets[0]["folder_variants"]]
        self.assertEqual(labels, ["Desktop", "Tablet", "Mobile"])
        self.assertFalse(assets[0].get("folder_has_editable"))
        self.assertNotIn("Edytowalny", assets[0].get("appearance_tags") or [])
        self.assertNotIn("editable", assets[0].get("format_technical") or [])

    def test_editable_only_with_source_in_folder(self):
        folder = r"X:/Marketing/- POLSKA/08 - KAMAPANIE/GRILL/ADMETRICS"
        assets = [
            {
                "id": "br-jpg",
                "name": "ADMETRICS 320 x240.jpg",
                "path": folder + "/ADMETRICS 320 x240.jpg",
                "appearance_tags": ["Edytowalny"],
                "format_technical": ["raster", "editable"],
            },
            {
                "id": "br-psd",
                "name": "ADMETRICS - 2026.psd",
                "path": folder + "/ADMETRICS - 2026.psd",
                "appearance_tags": [],
                "format_technical": ["raster", "editable"],
            },
        ]
        enrich_folder_groups(assets, {"products": [], "viz_latest": []})
        jpg = assets[0]
        psd = assets[1]
        self.assertTrue(jpg.get("folder_has_editable"))
        self.assertNotIn("Edytowalny", jpg.get("appearance_tags") or [])
        self.assertNotIn("editable", jpg.get("format_technical") or [])
        self.assertIn("editable", psd.get("format_technical") or [])

    def test_variant_stem(self):
        self.assertEqual(variant_stem("Back to school - 992 x 600.jpg"), "Back to school")
        self.assertEqual(variant_device_label("Back to school - 992 x 600.jpg"), "Tablet")
        self.assertEqual(
            variant_stem("POSTANOWIENIA noworoczne - SLIDER - DESKTOP - 1920 x 600.jpg"),
            "POSTANOWIENIA noworoczne",
        )
        self.assertEqual(
            variant_stem("SLIDER a może deserek (2).tif"),
            "SLIDER a może deserek",
        )
        self.assertEqual(variant_device_label("SLIDER a może deserek (2).tif"), "Tablet")

    def test_postanowienia_slider_variants(self):
        folder = r"X:/Marketing/- POLSKA/06 - STRONY WWW/Postanowienia Noworoczne"
        assets = [
            {
                "id": "br-p1",
                "name": "POSTANOWIENIA noworoczne - SLIDER - DESKTOP - 1920 x 600.jpg",
                "path": folder + "/POSTANOWIENIA noworoczne - SLIDER - DESKTOP - 1920 x 600.jpg",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
            {
                "id": "br-p2",
                "name": "POSTANOWIENIA noworoczne - SLIDER - TABLET - 992 x 600.jpg",
                "path": folder + "/POSTANOWIENIA noworoczne - SLIDER - TABLET - 992 x 600.jpg",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
            {
                "id": "br-p3",
                "name": "POSTANOWIENIA noworoczne - SLIDER - MOBILE - 576 x 600.jpg",
                "path": folder + "/POSTANOWIENIA noworoczne - SLIDER - MOBILE - 576 x 600.jpg",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
            {
                "id": "br-p4",
                "name": "POSTANOWIENIA NOWOROCZNE - SLIDER.psd",
                "path": folder + "/POSTANOWIENIA NOWOROCZNE - SLIDER.psd",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
        ]
        file_index = {
            "products": [
                {"id": "mix-6x-mini-batoniki-mixy", "display_name": "MINI BATONIKI", "path": "x/MINI"},
            ],
            "viz_latest": [],
        }
        enrich_folder_groups(assets, file_index)
        raster = assets[0]
        self.assertEqual(len(raster.get("folder_variants") or []), 3)
        self.assertIn("mix-6x-mini-batoniki-mixy", raster.get("folder_linked_product_ids") or [])
        self.assertTrue(raster.get("folder_editable_files"))

    def test_kielbaski_slider_products(self):
        folder = r"X:/Marketing/- POLSKA/06 - STRONY WWW/KIELBASKI"
        assets = [
            {
                "id": "br-k1",
                "name": "KIEŁBASKI PROMO  - SLIDER - DESKTOP - 1920 x 600.jpg",
                "path": folder + "/KIEŁBASKI PROMO  - SLIDER - DESKTOP - 1920 x 600.jpg",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
            {
                "id": "br-k2",
                "name": "KIEŁBASKI PROMO - SLIDER -  MOBILE - 576 x 600_.jpg",
                "path": folder + "/KIEŁBASKI PROMO - SLIDER -  MOBILE - 576 x 600_.jpg",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
        ]
        file_index = {
            "products": [
                {"id": "kielbaska-wegierska-niemiesne", "display_name": "KIELBASKA WEGIERSKA", "path": "x/KIELBASKA"},
                {"id": "kielbaska-klasyczna-niemiesne", "display_name": "KIELBASKA KLASYCZNA", "path": "x/KIELBASKA"},
            ],
            "viz_latest": [],
        }
        enrich_folder_groups(assets, file_index)
        linked = assets[0].get("folder_linked_product_ids") or []
        self.assertIn("kielbaska-wegierska-niemiesne", linked)

    def test_a_moze_deserek_products(self):
        folder = (
            r"X:/Marketing/- POLSKA/06 - STRONY WWW - INTERNET/01 - Strona Dobra Kaloria/"
            r"06 - SLIDERY NA GŁÓWNĄ/A Moze Deserek"
        )
        assets = [
            {
                "id": "br-d1",
                "name": "SLIDER a może deserek (1).tif",
                "path": folder + "/SLIDER a może deserek (1).tif",
                "linked_product_ids": [],
                "appearance_tags": ["Deserowe"],
            },
        ]
        file_index = {
            "products": [
                {"id": "tarta-malinowa-nerkowcowy", "display_name": "TARTA MALINOWA", "path": "x/TARTA"},
                {"id": "muffin-jagodowy-nerkowcowy", "display_name": "MUFFIN JAGODOWY", "path": "x/MUFFIN"},
                {"id": "sernik-waniliowy-nerkowcowy", "display_name": "SERNIK WANILIOWY", "path": "x/SERNIK"},
                {"id": "daktyl-wisnia-raw", "display_name": "DAKTYL WIŚNIA", "path": "x/KULKI"},
                {"id": "jab-ko-cynamon-daktylowy", "display_name": "JABŁKO CYNAMON", "path": "x/JABLKO"},
                {"id": "banoffee-kakao-deserowe", "display_name": "BANOFFEE KAKAO", "path": "x/BANOFFEE"},
                {"id": "tiramisu-czekolada-kakao-deserowe", "display_name": "TIRAMISU", "path": "x/TIRAMISU"},
            ],
            "viz_latest": [],
        }
        enrich_folder_groups(assets, file_index)
        linked = assets[0].get("folder_linked_product_ids") or []
        self.assertIn("tarta-malinowa-nerkowcowy", linked)
        self.assertIn("muffin-jagodowy-nerkowcowy", linked)
        self.assertIn("sernik-waniliowy-nerkowcowy", linked)
        self.assertIn("daktyl-wisnia-raw", linked)
        self.assertIn("jab-ko-cynamon-daktylowy", linked)
        self.assertNotIn("banoffee-kakao-deserowe", linked)
        self.assertNotIn("tiramisu-czekolada-kakao-deserowe", linked)

    def test_dpd_wielkanoc_mini_batoniki(self):
        folder = (
            r"X:/Marketing/- POLSKA/06 - STRONY WWW - INTERNET/01 - Strona Dobra Kaloria/"
            r"06 - SLIDERY NA GŁÓWNĄ/DPD PICKUP/DPD Pickup - Świąteczne pyszności wysyłka 0 zł"
        )
        assets = [
            {
                "id": "br-dpd1",
                "name": "DPD - ZDROWYCH ŚWIĄT wielkanoc 2026 - SLIDER - DESKTOP - 1920 x 600.jpg",
                "path": folder + "/DPD - ZDROWYCH ŚWIĄT wielkanoc 2026 - SLIDER - DESKTOP - 1920 x 600.jpg",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
            {
                "id": "br-dpd2",
                "name": "DPD - ZDROWYCH ŚWIĄT wielkanoc 2026 - SLIDER - TABLET - 992 x 600.jpg",
                "path": folder + "/DPD - ZDROWYCH ŚWIĄT wielkanoc 2026 - SLIDER - TABLET - 992 x 600.jpg",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
            {
                "id": "br-dpd3",
                "name": "DPD - ZDROWYCH ŚWIĄT wielkanoc 2026 - SLIDER - MOBILE - 576 x 600.jpg",
                "path": folder + "/DPD - ZDROWYCH ŚWIĄT wielkanoc 2026 - SLIDER - MOBILE - 576 x 600.jpg",
                "linked_product_ids": [],
                "appearance_tags": [],
            },
        ]
        file_index = {
            "products": [
                {
                    "id": "mix-6x-mini-batoniki-mixy",
                    "display_name": "MIX 6X MINI BATONIKI",
                    "path": "x/MIX 6X MINI BATONIKI",
                },
            ],
            "viz_latest": [
                {
                    "product_id": "mix-6x-mini-batoniki-mixy",
                    "thumb_url": "data/thumbs/mix-6x-mini-batoniki-mixy.jpg",
                }
            ],
        }
        enrich_folder_groups(assets, file_index)
        linked = assets[0].get("folder_linked_product_ids") or []
        self.assertIn("mix-6x-mini-batoniki-mixy", linked)
        self.assertIn("Wielkanoc", assets[0].get("appearance_tags") or [])
        self.assertEqual(len(assets[0].get("folder_variants") or []), 3)

    def test_gotowe_bulk_not_merged(self):
        path = r"X:/Marketing/- POLSKA/06 - STRONY WWW/02 - slidery/gotowe"
        names = [f"product-{i}.jpg" for i in range(10)]
        self.assertFalse(should_merge_folder_rasters(path, len(names), names))

    def test_social_campaign_merges_device_triple(self):
        path = r"X:/Marketing/- POLSKA/05 - SOCIAL MEDIA/Post FB"
        names = [
            "promo - 1920 x 1080.jpg",
            "promo - 1080 x 1080.jpg",
            "promo - 1080 x 1920.jpg",
        ]
        self.assertTrue(should_merge_folder_rasters(path, len(names), names))

    def test_linked_product_id_derived_from_variant(self):
        file_index = {
            "products": [
                {
                    "id": "babka-cytrynowa-nerkowcowy",
                    "display_name": "BABKA CYTRYNOWA",
                    "indexes": ["6300684.01"],
                    "revisions": [{"index": "6300684.01", "index_base": "6300684"}],
                }
            ],
            "viz_latest": [],
        }
        asset = {
            "sku": "6300684.01",
            "name": "Babka cytrynowa slider.jpg",
            "path": r"X:/Marketing/- POLSKA/06 - STRONY WWW/Babka Cytrynowa/Babka cytrynowa slider.jpg",
            "linked_product_ids": [],
        }
        apply_global_product_links(asset, file_index)
        self.assertEqual(asset.get("linked_variant_ids"), ["6300684.01"])
        self.assertEqual(asset.get("linked_product_id"), "babka-cytrynowa-nerkowcowy")
        self.assertIn("babka-cytrynowa-nerkowcowy", asset.get("linked_product_ids") or [])


if __name__ == "__main__":
    unittest.main()
