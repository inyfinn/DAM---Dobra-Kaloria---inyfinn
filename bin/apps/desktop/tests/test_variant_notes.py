# -*- coding: utf-8 -*-
"""Opisy wariantow: klucz to sam indeks, bez ".00".

Powod: po samym indeksie nikt nie wie, czym rozni sie 6300631 od 6300569.
Notatka ("GRILL", "Zelazo, Magnez, Witamina E") ma sie pokazywac obok indeksu
w eksplorerze i w wyszukiwarce, ale NIE moze zmieniac nazwy folderu na dysku.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import local_bridge as lb  # noqa: E402


class VariantNoteKeyTests(unittest.TestCase):
    def test_strips_dot_zero_suffix(self):
        self.assertEqual(lb.variant_note_key("6300631.00"), "6300631")
        self.assertEqual(lb.variant_note_key("6300631"), "6300631")

    def test_same_key_for_both_forms(self):
        self.assertEqual(lb.variant_note_key("6300631.00"), lb.variant_note_key("6300631"))

    def test_extracts_index_from_folder_name(self):
        self.assertEqual(lb.variant_note_key("RĘKAW - 25.05.2026 - 6300755"), "6300755")
        self.assertEqual(lb.variant_note_key("01.04.2025 - 6300631.00"), "6300631")

    def test_full_path_resolves_to_index(self):
        self.assertEqual(
            lb.variant_note_key(r"D:/Marketing/.../BURGER/29.04.2024 - 6300473.00"),
            "6300473",
        )


class VariantNoteStoreTests(unittest.TestCase):
    def setUp(self):
        self.saved = {}
        self.store = {"notes": {}}
        self.patches = [
            mock.patch.object(lb, "read_variant_notes", side_effect=lambda: self.store),
            mock.patch.object(lb, "_save_json", side_effect=lambda p, d: self.saved.update({str(p): d})),
            mock.patch.object(lb, "append_change_log", lambda entry: None),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def test_writes_note_under_bare_index(self):
        res = lb.upsert_variant_note("6300631.00", "GRILL", "kw")
        self.assertTrue(res["ok"])
        self.assertEqual(res["index"], "6300631")
        self.assertEqual(self.store["notes"]["6300631"]["note"], "GRILL")

    def test_empty_note_removes_entry(self):
        lb.upsert_variant_note("6300631", "GRILL", "kw")
        lb.upsert_variant_note("6300631", "   ", "kw")
        self.assertNotIn("6300631", self.store["notes"])

    def test_note_is_trimmed_and_capped(self):
        lb.upsert_variant_note("6300569", "  Żelazo,   Magnez,\tWitamina E  ", "kw")
        self.assertEqual(self.store["notes"]["6300569"]["note"], "Żelazo, Magnez, Witamina E")
        lb.upsert_variant_note("6300473", "x" * 500, "kw")
        self.assertEqual(len(self.store["notes"]["6300473"]["note"]), lb.VARIANT_NOTE_MAX)

    def test_missing_index_is_rejected(self):
        self.assertFalse(lb.upsert_variant_note("", "GRILL")["ok"])

    def test_store_key_is_registered_for_db_mirror(self):
        # Bez wpisu w KV_STORE_KEYS notatki zostalyby tylko w JSON, poza baza.
        self.assertIn("variant-notes", lb.KV_STORE_KEYS)


if __name__ == "__main__":
    unittest.main()
