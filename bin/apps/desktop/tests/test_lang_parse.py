# -*- coding: utf-8 -*-
import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "web" / "scripts"
sys.path.insert(0, str(SCRIPTS))

spec = importlib.util.spec_from_file_location("build_file_index", SCRIPTS / "build-file-index.py")
bfi = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bfi)


class LangParseTest(unittest.TestCase):
    def test_pl_ua_folder_not_english(self):
        folder = "BAT - 35 g - 15.05.2026 – 6300763 - PL UA"
        self.assertEqual(bfi.parse_folder_langs(folder), ["pl", "ua"])
        self.assertEqual(
            bfi.parse_langs_from_text("DK-BAT-DAKT-JABLKO-CYNAMON-PL-UA-6300763-FRONT-L.jpg"),
            ["pl", "ua"],
        )
        self.assertNotIn("en", bfi.parse_folder_langs(folder))

    def test_ua_never_canonicalizes_to_en(self):
        self.assertEqual(bfi.canonicalize_lang_code("UA"), "ua")
        self.assertEqual(bfi.canonicalize_lang_code("uk"), "en")


if __name__ == "__main__":
    unittest.main()
