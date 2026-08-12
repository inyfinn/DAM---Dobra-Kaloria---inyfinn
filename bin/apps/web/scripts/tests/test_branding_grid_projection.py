# -*- coding: utf-8 -*-
"""Projection tests for branding grid eligibility and atomic bundle."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))

from branding_grid_eligibility import is_branding_grid_eligible  # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "build_branding_grid_index",
    SCRIPTS / "build-branding-grid-index.py",
)
_grid_mod = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_grid_mod)

_build_head_assets = _grid_mod._build_head_assets
_compute_generation_id = _grid_mod.compute_generation_id
_is_head_graphic = _grid_mod._is_head_graphic
_slim_asset = _grid_mod.slim_asset
HEAD_ROLES = _grid_mod.HEAD_ROLES
HEAD_ROLE_PRIORITY = _grid_mod.HEAD_ROLE_PRIORITY


class BrandingGridEligibilityTest(unittest.TestCase):
    def test_rejects_packshot_role(self):
        self.assertFalse(is_branding_grid_eligible({"asset_role": "packshot", "path": "M:/x.jpg"}))

    def test_rejects_wizki_source(self):
        self.assertFalse(is_branding_grid_eligible({"source": "wizki", "path": "M:/campaign/a.jpg"}))

    def test_rejects_wizki_tag(self):
        self.assertFalse(
            is_branding_grid_eligible({"tags": ["WIZKI", "JPG"], "path": "M:/campaign/a.jpg"})
        )

    def test_rejects_wizki_path(self):
        self.assertFalse(
            is_branding_grid_eligible(
                {"path": "M:/Marketing/- POLSKA/01 - PRODUKTY/foo/4 - WIZKI/a.jpg"}
            )
        )

    def test_accepts_www_asset(self):
        self.assertTrue(
            is_branding_grid_eligible(
                {
                    "asset_role": "web_banner",
                    "media_type": "image",
                    "path": "M:/Marketing/- POLSKA/06 - STRONY WWW/banner.jpg",
                }
            )
        )

    def test_head_roles_include_live_taxonomy_aliases(self):
        for role in (
            "brand_asset",
            "social_asset",
            "social_video",
            "web_banner",
            "web_hero_slider",
            "key_visual",
            "ecommerce_ad",
            "www",
            "social",
            "campaign",
            "brandbook",
        ):
            self.assertIn(role, HEAD_ROLES)
        self.assertNotIn("", HEAD_ROLES)
        self.assertNotIn("product_element", HEAD_ROLES)
        self.assertNotIn("product_photo", HEAD_ROLES)
        self.assertNotIn("packshot", HEAD_ROLES)


class BrandingGridBundleTest(unittest.TestCase):
    def test_head_subset_same_generation_fixture(self):
        full_assets = [
            _slim_asset(
                {
                    "id": "br-www-1",
                    "asset_role": "web_banner",
                    "media_type": "image",
                    "path": "M:/www/a.jpg",
                    "name": "a.jpg",
                }
            ),
            _slim_asset(
                {
                    "id": "br-pack-1",
                    "asset_role": "packshot",
                    "media_type": "image",
                    "path": "M:/wizki/a.jpg",
                    "name": "a.jpg",
                    "source": "wizki",
                }
            ),
            _slim_asset(
                {
                    "id": "br-camp-1",
                    "asset_role": "key_visual",
                    "media_type": "image",
                    "path": "M:/camp/b.jpg",
                    "name": "b.jpg",
                }
            ),
            _slim_asset(
                {
                    "id": "br-brand-1",
                    "asset_role": "brand_asset",
                    "media_type": "vector",
                    "path": "M:/logo/c.svg",
                    "name": "c.svg",
                }
            ),
        ]
        eligible = [a for a in full_assets if is_branding_grid_eligible(a)]
        head = _build_head_assets(eligible)
        self.assertEqual(len(eligible), 3)
        self.assertGreaterEqual(len(head), 2)
        self.assertTrue(all(is_branding_grid_eligible(a) for a in eligible))
        self.assertTrue(all(is_branding_grid_eligible(a) for a in head))
        head_ids = {a["id"] for a in head}
        full_ids = {a["id"] for a in eligible}
        self.assertTrue(head_ids.issubset(full_ids))
        self.assertNotIn("br-pack-1", head_ids)

        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "branding-index.json"
            src.write_text(json.dumps({"assets": []}), encoding="utf-8")
            gen = _compute_generation_id(src, None)
            self.assertTrue(gen)

    def test_head_non_empty_for_live_role_aliases(self):
        fixture = [
            _slim_asset(
                {
                    "id": "br-social-1",
                    "asset_role": "social_asset",
                    "media_type": "image",
                    "path": "M:/social/a.jpg",
                    "name": "a.jpg",
                }
            ),
            _slim_asset(
                {
                    "id": "br-brand-2",
                    "asset_role": "brand_asset",
                    "media_type": "vector",
                    "path": "M:/brand/b.svg",
                    "name": "b.svg",
                }
            ),
            _slim_asset(
                {
                    "id": "br-web-1",
                    "asset_role": "web_hero_slider",
                    "media_type": "image",
                    "path": "M:/www/slider.jpg",
                    "name": "slider.jpg",
                }
            ),
            _slim_asset(
                {
                    "id": "br-empty-role",
                    "asset_role": "",
                    "media_type": "image",
                    "path": "M:/misc/x.jpg",
                    "name": "x.jpg",
                }
            ),
            _slim_asset(
                {
                    "id": "br-element",
                    "asset_role": "product_element",
                    "media_type": "image",
                    "path": "M:/prod/element.png",
                    "name": "element.png",
                }
            ),
        ]
        eligible = [a for a in fixture if is_branding_grid_eligible(a)]
        head = _build_head_assets(eligible)
        self.assertGreater(len(head), 0)
        self.assertTrue(all(a.get("asset_role") in HEAD_ROLES for a in head))
        head_ids = {a["id"] for a in head}
        self.assertNotIn("br-empty-role", head_ids)
        self.assertNotIn("br-element", head_ids)
        self.assertIn("br-web-1", head_ids)
        self.assertEqual(head[0]["id"], "br-web-1")

    def test_head_same_generation_id_meta(self):
        generation_id = "395b62542b94c15a"
        full_assets = [
            _slim_asset(
                {
                    "id": "br-1",
                    "asset_role": "social_asset",
                    "media_type": "image",
                    "path": "M:/s/a.jpg",
                    "name": "a.jpg",
                }
            )
        ]
        eligible = [a for a in full_assets if is_branding_grid_eligible(a)]
        head = _build_head_assets(eligible)
        full_payload = {
            "generation_id": generation_id,
            "count": len(eligible),
            "assets": eligible,
        }
        head_payload = {
            "generation_id": generation_id,
            "count": len(eligible),
            "head_count": len(head),
            "assets": head,
        }
        self.assertEqual(full_payload["generation_id"], head_payload["generation_id"])
        self.assertEqual(head_payload["head_count"], len(head))
        self.assertTrue({a["id"] for a in head}.issubset({a["id"] for a in eligible}))

    def test_packshot_head_rejected(self):
        pack = {
            "id": "br-p1",
            "asset_role": "packshot",
            "media_type": "image",
            "path": "M:/x.jpg",
            "name": "x.jpg",
        }
        self.assertFalse(is_branding_grid_eligible(pack))
        head = _build_head_assets([pack])
        self.assertEqual(head, [])

    def test_head_requires_graphic_media(self):
        row = {
            "id": "br-doc",
            "asset_role": "web_banner",
            "media_type": "document",
            "path": "M:/x.pdf",
            "name": "x.pdf",
        }
        self.assertFalse(_is_head_graphic(row))

    def test_social_video_counts_as_head_graphic(self):
        row = {
            "id": "br-vid",
            "asset_role": "social_video",
            "media_type": "video",
            "path": "M:/social/clip.mp4",
            "name": "clip.mp4",
        }
        self.assertTrue(_is_head_graphic(row))
        self.assertIn("social_video", HEAD_ROLES)
        head = _build_head_assets([row])
        self.assertEqual(len(head), 1)


if __name__ == "__main__":
    unittest.main()
