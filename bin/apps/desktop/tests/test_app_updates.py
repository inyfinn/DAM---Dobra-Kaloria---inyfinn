# -*- coding: utf-8 -*-
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app_updates import (
    _pick_product_latest,
    is_canonical_product_version,
    is_newer,
    is_stale_older,
)


class AppUpdatesCompareTest(unittest.TestCase):
    def test_stale_github_104_ignored_against_179(self):
        self.assertTrue(is_stale_older("1.0.74", "1.7.9"))
        self.assertFalse(is_newer("1.0.74", "1.7.9"))
        latest, source = _pick_product_latest("1.7.9", "1.0.74", "1.7.9")
        self.assertEqual(latest, "1.7.9")
        self.assertIn(source, ("installed", "git"))

    def test_legacy_6012_ignored_against_188(self):
        self.assertFalse(is_canonical_product_version("6.0.12"))
        self.assertTrue(is_stale_older("6.0.12", "1.8.8"))
        self.assertFalse(is_newer("6.0.12", "1.8.8"))
        latest, source = _pick_product_latest("1.8.8", "6.0.12", "")
        self.assertEqual(latest, "1.8.8")

    def test_newer_same_line(self):
        latest, source = _pick_product_latest("1.7.9", "1.8.0", "")
        self.assertEqual(latest, "1.8.0")
        self.assertEqual(source, "github")
        self.assertTrue(is_newer("1.8.0", "1.7.9"))

    def test_equal_is_current(self):
        latest, source = _pick_product_latest("1.7.9", "1.7.9", "1.7.9")
        self.assertEqual(latest, "1.7.9")


if __name__ == "__main__":
    unittest.main()
