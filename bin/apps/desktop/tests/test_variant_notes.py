# -*- coding: utf-8 -*-
"""Opisy wariantow: klucz to sam indeks, bez ".00".

Powod: po samym indeksie nikt nie wie, czym rozni sie 6300631 od 6300569.
Notatka ("GRILL", "Zelazo, Magnez, Witamina E") ma sie pokazywac obok indeksu
w eksplorerze i w wyszukiwarce, ale NIE moze zmieniac nazwy folderu na dysku.
"""
from __future__ import annotations

import shutil
import sys
import tempfile
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


class VariantNotePermissionTests(unittest.TestCase):
    """Kto moze zmienic opis.

    Zasada: opis dodaje KAZDY i wchodzi od razu. Dopiero opis zalozony przez
    admina/power_usera jest chroniony - wtedy zmiana zwyklego uzytkownika
    czeka na zatwierdzenie, zamiast po cichu nadpisac decyzje admina.
    """

    def setUp(self):
        self.store = {"notes": {}, "pending": {}}
        self.notified = []
        self.patches = [
            mock.patch.object(lb, "read_variant_notes", side_effect=lambda: self.store),
            mock.patch.object(lb, "_save_variant_notes", side_effect=lambda d: None),
            mock.patch.object(lb, "append_change_log", lambda e: None),
            mock.patch.object(lb, "notify_admins_note_proposal",
                              side_effect=lambda *a: self.notified.append(a)),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def test_regular_user_can_create_note_immediately(self):
        res = lb.upsert_variant_note("6300631", "GRILL", "anna", "user")
        self.assertTrue(res["ok"])
        self.assertFalse(res["pending"])
        self.assertEqual(self.store["notes"]["6300631"]["note"], "GRILL")
        self.assertFalse(self.store["notes"]["6300631"]["protected"])

    def test_note_from_regular_user_is_editable_by_anyone(self):
        lb.upsert_variant_note("6300631", "GRILL", "anna", "user")
        res = lb.upsert_variant_note("6300631", "NA GRILLA", "bartek", "user")
        self.assertFalse(res["pending"])
        self.assertEqual(self.store["notes"]["6300631"]["note"], "NA GRILLA")

    def test_admin_note_is_protected(self):
        lb.upsert_variant_note("6300631", "GRILL", "kw", "admin")
        self.assertTrue(self.store["notes"]["6300631"]["protected"])

    def test_regular_user_edit_of_admin_note_goes_to_pending(self):
        lb.upsert_variant_note("6300631", "GRILL", "kw", "admin")
        res = lb.upsert_variant_note("6300631", "NA GRILLA", "anna", "user")
        self.assertTrue(res["ok"])
        self.assertTrue(res["pending"])
        # Opis na ekranie sie NIE zmienia, dopoki ktos nie zatwierdzi.
        self.assertEqual(self.store["notes"]["6300631"]["note"], "GRILL")
        self.assertEqual(self.store["pending"]["6300631"]["note"], "NA GRILLA")
        self.assertEqual(len(self.notified), 1, "admin musi dostac powiadomienie")

    def test_power_user_overwrites_admin_note_without_approval(self):
        lb.upsert_variant_note("6300631", "GRILL", "kw", "admin")
        res = lb.upsert_variant_note("6300631", "NA GRILLA", "piotr", "power_user")
        self.assertFalse(res["pending"])
        self.assertEqual(self.store["notes"]["6300631"]["note"], "NA GRILLA")

    def test_approving_proposal_applies_it(self):
        lb.upsert_variant_note("6300631", "GRILL", "kw", "admin")
        lb.upsert_variant_note("6300631", "NA GRILLA", "anna", "user")
        res = lb.resolve_variant_note_proposal("6300631", True, "kw")
        self.assertTrue(res["ok"])
        self.assertEqual(self.store["notes"]["6300631"]["note"], "NA GRILLA")
        self.assertNotIn("6300631", self.store["pending"])

    def test_rejecting_proposal_keeps_original(self):
        lb.upsert_variant_note("6300631", "GRILL", "kw", "admin")
        lb.upsert_variant_note("6300631", "NA GRILLA", "anna", "user")
        lb.resolve_variant_note_proposal("6300631", False, "kw")
        self.assertEqual(self.store["notes"]["6300631"]["note"], "GRILL")
        self.assertNotIn("6300631", self.store["pending"])

    def test_resolve_without_proposal_is_rejected(self):
        self.assertFalse(lb.resolve_variant_note_proposal("6300631", True, "kw")["ok"])


class SupportReportTests(unittest.TestCase):
    """Zgloszenie z Ustawien -> Pomoc trafia WYLACZNIE do adminow.

    Chroni przed regresja: lb.create_support_report() woła w srodku
    support_reports.append_report(), ktory zapisuje POPRAWKI.md /
    poprawki.jsonl na dysku pod support_reports.reports_root(). Bez
    podmiany tego katalogu na tymczasowy, KAZDE uruchomienie tego zestawu
    testow dopisywalo smieciowe wpisy (P-000x, autor "anna", tytul "x")
    do PRAWDZIWEGO POPRAWKI.md w korzeniu repo. Wzorzec podmiany wziety
    z test_support_reports_file.py (linie 39-43).
    """

    def setUp(self):
        self.items = []
        self.tmp = Path(tempfile.mkdtemp(prefix="dam-poprawki-test-"))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.patches = [
            mock.patch.object(lb, "append_inbox_item",
                              side_effect=lambda e: (self.items.append(e), e)[1]),
            mock.patch.object(lb, "append_change_log", lambda e: None),
        ]
        if getattr(lb, "support_reports", None) is not None:
            self.patches.append(
                mock.patch.object(lb.support_reports, "reports_root",
                                   side_effect=lambda: self.tmp)
            )
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)

    def test_report_is_addressed_to_admins(self):
        res = lb.create_support_report({"kind": "blad", "title": "Nie dziala eksport"}, "anna", "user")
        self.assertTrue(res["ok"])
        self.assertEqual(self.items[0]["audience"], "admins")
        self.assertIn("Nie dziala eksport", self.items[0]["title"])

    def test_report_carries_version_and_author(self):
        lb.create_support_report({"title": "x", "body": "opis", "page": "explorer.html"}, "anna", "user")
        detail = self.items[0]["detail"]
        self.assertIn("Zglosil: anna", detail)
        self.assertIn("Strona: explorer.html", detail)
        self.assertIn("Wersja:", detail)

    def test_empty_report_is_rejected(self):
        self.assertFalse(lb.create_support_report({}, "anna", "user")["ok"])

    def test_unknown_kind_falls_back_to_inne(self):
        lb.create_support_report({"kind": "cokolwiek", "title": "t"}, "anna", "user")
        self.assertIn("Inne", self.items[0]["title"])
