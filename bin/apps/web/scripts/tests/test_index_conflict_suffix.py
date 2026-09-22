# -*- coding: utf-8 -*-
"""parse_index: sufiks kopii konfliktowej Synology nie moze udawac indeksu.

Zmierzone na zywej bazie 2026-09-22: wariant produktu mial index_code 165957.00,
wyciagniety ze znacznika czasu w nazwie "..._KRZYSZTOFWI_lip-16-165957-2026".
W repo lezalo wtedy 68 plikow z takim sufiksem, wiec kazda przebudowa indeksu
dokladala kolejne falszywe numery.
"""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
BUILD = SCRIPTS / "build-file-index.py"


def _load_builder():
    spec = importlib.util.spec_from_file_location("dam_build_file_index", BUILD)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {BUILD}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class ConflictSuffixTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.mod = _load_builder()

    def test_timestamp_in_conflict_suffix_is_not_an_index(self) -> None:
        name = "MINI - 18.10.2022 - GB_0000000_KRZYSZTOFWI_lip-16-165957-2026"
        _base, _rev, full = self.mod.parse_index(name)
        self.assertNotEqual(full, "165957.00", "znacznik czasu zostal wziety za indeks")

    def test_conflict_copy_of_file_yields_no_index(self) -> None:
        name = "local_bridge_INYFINN_wrz-20-025033-2026_Conflict.py"
        self.assertEqual(self.mod.parse_index(name), (None, None, None))

    def test_real_indexes_still_parse(self) -> None:
        cases = {
            "MINI - 19.09.2025 - 6300682.00": "6300682.00",
            "DOY - 23.06.2026 - 6300760": "6300760.00",
            "CYNAMONKA - 6300744.01 - F": "6300744.01",
        }
        for name, expected in cases.items():
            with self.subTest(name=name):
                self.assertEqual(self.mod.parse_index(name)[2], expected)

    def test_placeholder_still_rejected(self) -> None:
        self.assertEqual(
            self.mod.parse_index("KAR - 28.02.2026 - 6300XXX.00"), (None, None, None)
        )

    def test_strip_conflict_suffix_keeps_clean_names(self) -> None:
        clean = "MINI - 19.09.2025 - 6300682.00"
        self.assertEqual(self.mod.strip_conflict_suffix(clean), clean)


if __name__ == "__main__":
    unittest.main()
