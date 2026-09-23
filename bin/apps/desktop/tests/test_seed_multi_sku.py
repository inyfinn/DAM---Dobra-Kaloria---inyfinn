# -*- coding: utf-8 -*-
"""Regression tests for _disambiguate_sku_products (multi-SKU file -> product pick).

Context (sku60 audit, 2026-09-23): 19 of 60 audited sku_match rows in
asset_product_links pointed a single-flavor file (e.g. a "babka cytrynowa"
visual) at the wrong product - a box/mix product whose OWN folder the file
happened to sit in (e.g. ".../ZESTAW MIX Ciast 1/KARTON_6xMINI_6300719/...").
The old scoring counted distinctive-name-token hits across name+path
combined, so the box product's tokens (matched purely via the folder path)
out-counted the flavor's 1-2 tokens matched in the filename itself.

Fix: if exactly one candidate has a distinctive-token hit inside the
FILENAME, it wins outright. Otherwise (zero candidates, or a tie) fall back
to the original full-blob (name+path) scoring - this preserves the existing,
still-correct behavior for the "miod" style case, where a generic shared
ingredient word ties two legacy/renamed product duplicates and the real
signal is the current product's own folder path.

Uses only small in-memory product/asset fixtures - no real files, no DB.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

WEB_SCRIPTS = DESKTOP.parent / "web" / "scripts"
if str(WEB_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(WEB_SCRIPTS))


def _load_seed_mod():
    import importlib.util

    path = DESKTOP / "scripts" / "seed-asset-product-links.py"
    spec = importlib.util.spec_from_file_location("seed_asset_product_links_test", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class DisambiguateSkuProductsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = _load_seed_mod()
        cls.aa = cls.mod._assoc_adequacy()

    def _norm_blob(self, name: str, path: str) -> str:
        return self.aa._norm(f"{name} {path}")

    def test_single_flavor_file_in_mix_box_folder_wins_by_filename(self):
        """Reproduces br-024217347: babka cytrynowa visual stored inside the
        'ZESTAW MIX Ciast 1' box folder must resolve to babka-cytrynowa, not
        to the box/mix product, even though the box name tokens dominate the
        folder path."""
        products = {
            "babka-cytrynowa-nerkowcowy": {"name": "BABKA CYTRYNOWA \u2014 [ nerkowcowy ]"},
            "mix-zestaw-mix-ciast-1-mixy": {"name": "- MIX - ZESTAW MIX CIAST 1 \u2014 [ mixy ]"},
        }
        name = "DK_mini_babka_cytryn_wiz_2025_02_26_A4_CMYK_6300621.tif"
        path = (
            "M:/-- ARCHIWUM --/01_Opakowania/Projekty/DK/BATONY/NERKOWCOWE/"
            "- MIXY/01 - ZESTAW MIX Ciast 1/KARTON_6xMINI_6300719/"
            "1 - MATERIALY/" + name
        )
        blob = self._norm_blob(name, path)
        cands = {"babka-cytrynowa-nerkowcowy", "mix-zestaw-mix-ciast-1-mixy"}
        chosen = self.mod._disambiguate_sku_products(
            self.aa, blob, cands, products, asset_name=name
        )
        self.assertEqual(chosen, ["babka-cytrynowa-nerkowcowy"])

    def test_two_word_flavor_filename_wins_over_box(self):
        """Reproduces br-090846929: 'sernik_waniliowy' filename (both tokens
        hit) beats the box folder's 3-token path match."""
        products = {
            "sernik-waniliowy-nerkowcowy": {"name": "SERNIK WANILIOWY \u2014 [ nerkowcowy ]"},
            "mix-zestaw-mix-ciast-1-mixy": {"name": "- MIX - ZESTAW MIX CIAST 1 \u2014 [ mixy ]"},
        }
        name = "DK_mini_folia_sernik_waniliowy_6300079_CMYK.tif"
        path = (
            "M:/-- ARCHIWUM --/01_Opakowania/Projekty/DK/BATONY/NERKOWCOWE/"
            "- MIXY/01 - ZESTAW MIX Ciast 1/KARTON_6xMINI_6300719/"
            "1 - MATERIALY/" + name
        )
        blob = self._norm_blob(name, path)
        cands = {"sernik-waniliowy-nerkowcowy", "mix-zestaw-mix-ciast-1-mixy"}
        chosen = self.mod._disambiguate_sku_products(
            self.aa, blob, cands, products, asset_name=name
        )
        self.assertEqual(chosen, ["sernik-waniliowy-nerkowcowy"])

    def test_generic_shared_token_tie_falls_back_to_path_evidence(self):
        """Reproduces br-059067787 ('miod1.tif'): a shared generic ingredient
        word ("miod") ties two legacy/renamed product duplicates in the
        FILENAME, so filename evidence must NOT decide - fall back to full
        blob, where the real, currently-active product folder
        (CORNFLAKES_PEANUTS_HONEY) wins on 4 distinctive-token hits."""
        products = {
            "cornflakes-peanuts-honey-balls-crispy": {
                "name": "CORNFLAKES PEANUTS HONEY \u2014 [ balls_crispy ]"
            },
            "orzeszki-kukurydza-miod-sniadanie": {
                "name": "ORZESZKI KUKURYDZA MIOD \u2014 [ sniadanie ]"
            },
            "orzeszki-miod-sniadanie": {"name": "ORZESZKI MIOD \u2014 [ sniadanie ]"},
        }
        name = "miod1.tif"
        path = (
            "M:/-- ARCHIWUM --/01_Opakowania/Projekty/GC/SNACKS/BALLS_CRISPY/"
            "CORNFLAKES_PEANUTS_HONEY/2025_10_30 GB_DE-6300699.01 - 80 g/"
            "1 - MATERIALY - karta wprowadzenia/" + name
        )
        blob = self._norm_blob(name, path)
        cands = {
            "cornflakes-peanuts-honey-balls-crispy",
            "orzeszki-kukurydza-miod-sniadanie",
            "orzeszki-miod-sniadanie",
        }
        chosen = self.mod._disambiguate_sku_products(
            self.aa, blob, cands, products, asset_name=name
        )
        self.assertEqual(chosen, ["cornflakes-peanuts-honey-balls-crispy"])

    def test_filename_evidence_still_wins_over_unrelated_candidate(self):
        """Reproduces br-038352094 ('cashews_coconut...6300479...'): filename
        token 'coconut' uniquely identifies the product even though the
        other candidate shares the folder location."""
        products = {
            "cashews-coconut-date": {"name": "CASHEWS COCONUT \u2014 [ date ]"},
            "apple-cinnamon-date": {"name": "APPLE CINNAMON \u2014 [ date ]"},
        }
        name = "GC_bar_cashews_coconut_6300479_2024_07_05_GB_AR.ai"
        path = (
            "M:/-- ARCHIWUM --/01_Opakowania/Projekty/GC/BARS/BARS_DATE/"
            "CASHEWS_COCONUT/2024_09_20_GB_AR_6300480/"
            "GC_bar_cashews_coconut_6300479_2024_07_05_GB_AR_Folder/" + name
        )
        blob = self._norm_blob(name, path)
        cands = {"cashews-coconut-date", "apple-cinnamon-date"}
        chosen = self.mod._disambiguate_sku_products(
            self.aa, blob, cands, products, asset_name=name
        )
        self.assertEqual(chosen, ["cashews-coconut-date"])

    def test_three_way_filename_tie_falls_back_to_full_blob(self):
        """Reproduces br-034101973: a 'Proof' file names three flavors at
        once in its filename - all three get a filename hit, so filename
        evidence alone can't decide; full blob (2 hits for mango-lassi via
        both 'mango' and 'lassi') breaks the tie."""
        products = {
            "mango-lassi-nerkowcowy": {"name": "MANGO LASSI \u2014 [ nerkowcowy ]"},
            "matcha-lemon-nerkowcowy": {"name": "MATCHA LEMON \u2014 [ nerkowcowy ]"},
            "rogal-poznanski-nerkowcowy": {"name": "ROGAL POZNANSKI \u2014 [ nerkowcowy ]"},
        }
        name = "Proof - Matcha mango rogal -6300680 - 6300678 - 6300682 - 28.08.2025.ai"
        path = (
            "M:/-- ARCHIWUM --/01_Opakowania/Projekty/DK/BATONY/NERKOWCOWE/"
            "MANGO_LASSI/KARTON_6XMINI - 6300678 - Lidl/3 - DRUK/"
            "PROOF 28.08.2025/" + name
        )
        blob = self._norm_blob(name, path)
        cands = {
            "mango-lassi-nerkowcowy",
            "matcha-lemon-nerkowcowy",
            "rogal-poznanski-nerkowcowy",
        }
        chosen = self.mod._disambiguate_sku_products(
            self.aa, blob, cands, products, asset_name=name
        )
        self.assertEqual(chosen, ["mango-lassi-nerkowcowy"])

    def test_no_evidence_anywhere_stays_ambiguous(self):
        """Two candidates, neither has any distinctive-token hit anywhere ->
        must stay empty (ambiguous), same as before the fix."""
        products = {
            "product-a": {"name": "SOMETHING DISTINCTIVE"},
            "product-b": {"name": "ANOTHER DISTINCT THING"},
        }
        name = "IMG_0001.png"
        path = "M:/random/folder/" + name
        blob = self._norm_blob(name, path)
        cands = {"product-a", "product-b"}
        chosen = self.mod._disambiguate_sku_products(
            self.aa, blob, cands, products, asset_name=name
        )
        self.assertEqual(chosen, [])

    def test_asset_name_defaults_to_empty_string(self):
        """Backward-compat: calling without asset_name must not crash and
        must fall back to pure full-blob scoring."""
        products = {
            "product-a": {"name": "ALPHA WIDGET"},
            "product-b": {"name": "BETA GADGET"},
        }
        name = "alpha_widget_render.png"
        path = "M:/alpha/" + name
        blob = self._norm_blob(name, path)
        cands = {"product-a", "product-b"}
        chosen = self.mod._disambiguate_sku_products(self.aa, blob, cands, products)
        self.assertEqual(chosen, ["product-a"])


if __name__ == "__main__":
    unittest.main()
