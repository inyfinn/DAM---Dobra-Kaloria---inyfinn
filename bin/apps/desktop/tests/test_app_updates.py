# -*- coding: utf-8 -*-
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app_updates import _pick_product_latest, is_newer, is_stale_older


class AppUpdatesCompareTest(unittest.TestCase):
    def test_stale_github_104_ignored_against_179(self):
        self.assertTrue(is_stale_older("1.0.74", "1.7.9"))
        self.assertFalse(is_newer("1.0.74", "1.7.9"))
        latest, source = _pick_product_latest("1.7.9", "1.0.74", "1.7.9")
        self.assertEqual(latest, "1.7.9")
        self.assertIn(source, ("installed", "git"))

    def test_newer_same_line(self):
        latest, source = _pick_product_latest("1.7.9", "1.7.10", "")
        self.assertEqual(latest, "1.7.10")
        self.assertEqual(source, "github")
        self.assertTrue(is_newer("1.7.10", "1.7.9"))

    def test_equal_is_current(self):
        latest, source = _pick_product_latest("1.7.9", "1.7.9", "1.7.9")
        self.assertEqual(latest, "1.7.9")


if __name__ == "__main__":
    unittest.main()
