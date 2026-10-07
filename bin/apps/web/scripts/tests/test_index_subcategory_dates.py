# -*- coding: utf-8 -*-
"""07.10.2026: produkt z nieznanym nawiasem nie moze byc anonimowy.

Zgloszenie wlasciciela: "pracuje nad kulkami z kreatyna, a nie ma ich w projektach".
Byly w spisie, ale jako "Kulki - Arbuz": slownik podkategorii byl biala lista i nawias
"[ z kreatyna ]" dawal pusta etykiete, bez tagu. Do tego 38 z 517 wariantow nie mialo daty
(parse_date znal tylko DD.MM.RRRR), a spis nie mial daty ostatniej zmiany wariantu/produktu,
wiec sort "Modyfikacja: najnowsze" nie mial z czego liczyc.
"""
from __future__ import annotations

import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
BUILD = SCRIPTS / "build-file-index.py"


def _load_builder():
    spec = importlib.util.spec_from_file_location("dam_build_file_index_subcat", BUILD)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {BUILD}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


B = _load_builder()


def _brackets(name: str) -> list[str]:
    return [m.group(1) for m in B.BRACKET_HINT_RE.finditer(name)]


class SubcategoryLabelTest(unittest.TestCase):
    def test_kreatyna_ma_etykiete_i_tag(self):
        name = "ARBUZ — [ z kreatyną ]"
        self.assertEqual(B.subcategory_label_pl(_brackets(name)), ("z kreatyna", "Z kreatyną"))
        display, bracket_tags = B.parse_display_name(name)
        tags = B.extract_tags(["02 - KULKI", name, display], extra_bracket=bracket_tags)
        self.assertIn("kreatyna", tags)
        self.assertIn("kreatyna", B.build_tag_groups(tags)["typ"])

    def test_znane_nawiasy_bez_zmian(self):
        self.assertEqual(B.subcategory_label_pl(["nerkowcowy"]), ("nerkowcowy", "Nerkowcowy"))
        self.assertEqual(B.subcategory_label_pl([" Plant Based "]), ("plant based", "Roślinne"))
        # folder z uszkodzonym bajtem ma wpis w slowniku i ma go zachowac
        self.assertEqual(B.subcategory_label_pl(["niemi�sne"]), ("niemi sne", "Niemięsne"))

    def test_nieznany_nawias_pokazuje_tekst_grafika(self):
        self.assertEqual(B.subcategory_label_pl(["linia fit"]), ("linia fit", "Linia fit"))
        self.assertEqual(B.subcategory_label_pl(["  z   żeń-szeniem "]), ("z zen szeniem", "Z żeń-szeniem"))

    def test_slownik_wygrywa_z_wczesniejszym_nieznanym(self):
        self.assertEqual(B.subcategory_label_pl(["cos nowego", "daktylowy"]), ("daktylowy", "Daktylowy"))

    def test_smieci_nie_staja_sie_etykieta(self):
        self.assertEqual(B.subcategory_label_pl([]), ("", ""))
        self.assertEqual(B.subcategory_label_pl(["12", " "]), ("", ""))
        self.assertEqual(B.subcategory_label_pl(["zły�"]), ("", ""))
        self.assertEqual(B.subcategory_label_pl(["x" * 41]), ("", ""))


class ParseDateTest(unittest.TestCase):
    def test_dotychczasowe_formaty(self):
        self.assertEqual(B.parse_date("DOY - 65 g - 22.09.2026 -  6300861"), "2026-09-22")
        self.assertEqual(B.parse_date("BAT - 18 06 2026 - 6300784.00 - F"), "2026-06-18")

    def test_nowe_formaty_z_prawdziwych_folderow(self):
        cases = {
            "doy_65g_2026_08_31 - 6300808": "2026-08-31",
            "RĘKAW_2026_07_21-6300406.01": "2026-07-21",
            "RĘKAW_2026_07_31_6300798": "2026-07-31",
            "KAR6X - 2026-07-15 - 6300602.01": "2026-07-15",
            "RĘKAW — 2026.08.19 - 6300791": "2026-08-19",
            "RĘKAW - 17_09_2026": "2026-09-17",
            "DOY - 3.07.2026": "2026-07-03",
        }
        for folder, want in cases.items():
            self.assertEqual(B.parse_date(folder), want, folder)

    def test_numer_indeksu_i_bzdury_to_nie_data(self):
        for folder in ("BAT - 6300602.01", "X 2026_13_45 Y", "untitled folder", "KAR6X - 6300817"):
            self.assertIsNone(B.parse_date(folder), folder)


class RevisionMtimeTest(unittest.TestCase):
    def test_wariant_ma_date_najnowszego_pliku(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            B._LIVE_PATH = root / "index-live.json"  # nie pisz postepu do prawdziwego data/
            prod = root / "02 - KULKI" / "ARBUZ — [ z kreatyną ]"
            proj = prod / "DOY - 65 g - 22.09.2026 - 6300861" / "2 - PROJEKT"
            proj.mkdir(parents=True)
            old = proj / "DK-DOY-KREA- ARBUZ 65g - 6300861-F.ai"
            new = proj / "DK-DOY-KREA- ARBUZ 65g - 6300861-FQ.pdf"
            old.write_bytes(b"a")
            new.write_bytes(b"b")
            os.utime(old, (1_790_000_000, 1_790_000_000))
            os.utime(new, (1_791_000_000, 1_791_000_000))
            item = B.scan_product("02 - KULKI", prod, root, "DK")
        self.assertEqual(item["subcategory_label"], "Z kreatyną")
        rev = item["revisions"][0]
        files = [f for fs in rev["files_by_role"].values() for f in fs]
        self.assertEqual(len(files), 2)
        self.assertEqual(rev["mtime"], max(f["mtime"] for f in files))
        self.assertGreater(rev["mtime"], min(f["mtime"] for f in files))


if __name__ == "__main__":
    unittest.main()
