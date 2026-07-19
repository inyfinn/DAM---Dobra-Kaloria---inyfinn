# -*- coding: utf-8 -*-
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "web" / "scripts"
sys.path.insert(0, str(SCRIPTS))

_spec = importlib.util.spec_from_file_location(
    "build_branding_index",
    SCRIPTS / "build-branding-index.py",
)
_mod = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_mod)

file_overlap_key = _mod.file_overlap_key
is_polska_marketing_root = _mod.is_polska_marketing_root
scan_marketing_roots = _mod.scan_marketing_roots


class BuildBrandingDedupeTest(unittest.TestCase):
    def test_overlap_key_uses_stem_and_dimensions(self):
        with tempfile.TemporaryDirectory() as tmp:
            fp = Path(tmp) / "Back to school - 992 x 600.jpg"
            fp.write_bytes(b"abc123")
            key = file_overlap_key(fp)
            self.assertEqual(key, "back to school:992x600")

    def test_overlap_key_matches_legacy_name_variant(self):
        with tempfile.TemporaryDirectory() as tmp:
            polska = Path(tmp) / "Back to school -  992 x 600.jpg"
            legacy = Path(tmp) / "BACK to School -992 x 600.png"
            polska.write_bytes(b"a")
            legacy.write_bytes(b"b")
            self.assertEqual(file_overlap_key(polska), file_overlap_key(legacy))

    def test_polska_path_detection(self):
        self.assertTrue(is_polska_marketing_root(r"X:/Marketing/- POLSKA/07 - E-COMMERCE/foo.jpg"))
        self.assertFalse(is_polska_marketing_root(r"X:/Marketing/-- ARCHIWUM --/foo.jpg"))

    def test_legacy_skipped_when_polska_has_same_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            marketing = Path(tmp)
            polska = marketing / "- POLSKA" / "07 - E-COMMERCE"
            legacy = marketing / "-- ARCHIWUM --" / "05_Materiały graficzne e-commerce"
            polska.mkdir(parents=True)
            legacy.mkdir(parents=True)
            payload = b"same-bytes-content"
            polska_file = polska / "slider - 992 x 600.jpg"
            legacy_file = legacy / "SLIDER -992 x 600.png"
            polska_file.write_bytes(payload)
            legacy_file.write_bytes(payload)

            assets, stats = scan_marketing_roots(marketing)
            paths = {a["path"].replace("\\", "/") for a in assets}
            self.assertEqual(stats["legacy_skipped_overlap"], 1)
            self.assertEqual(stats["legacy_indexed"], 0)
            self.assertTrue(any("/- POLSKA/" in p for p in paths))
            self.assertFalse(any("/-- ARCHIWUM --/" in p for p in paths))

    def test_legacy_kept_when_unique(self):
        with tempfile.TemporaryDirectory() as tmp:
            marketing = Path(tmp)
            polska = marketing / "- POLSKA" / "07 - E-COMMERCE"
            legacy = marketing / "-- ARCHIWUM --" / "09 PRZEPISY"
            polska.mkdir(parents=True)
            legacy.mkdir(parents=True)
            (polska / "only-polska.jpg").write_bytes(b"a")
            (legacy / "only-legacy.jpg").write_bytes(b"b")

            assets, stats = scan_marketing_roots(marketing)
            paths = {a["path"].replace("\\", "/") for a in assets}
            self.assertEqual(stats["legacy_indexed"], 1)
            self.assertTrue(any("/-- ARCHIWUM --/" in p for p in paths))
            legacy_asset = next(a for a in assets if "-- ARCHIWUM --" in a["path"])
            self.assertIn("Archiwum", legacy_asset.get("tags") or [])


if __name__ == "__main__":
    unittest.main()
