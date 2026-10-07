# -*- coding: utf-8 -*-
"""Folder chwilowo nieosiagalny (blad sieci) nie moze byc traktowany jak usuniety."""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

_SPEC = importlib.util.spec_from_file_location(
    "build_file_index_unreach", Path(__file__).resolve().parents[1] / "build-file-index.py")
bfi = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(bfi)


class DirStateTests(unittest.TestCase):
    def test_katalog_plik_i_brak(self):
        with tempfile.TemporaryDirectory() as td:
            d = Path(td)
            (d / "plik.txt").write_text("x", encoding="utf-8")
            self.assertEqual(bfi._dir_state(d), "dir")
            self.assertEqual(bfi._dir_state(d / "plik.txt"), "absent")
            self.assertEqual(bfi._dir_state(d / "nie-ma"), "absent")

    def test_blad_sieci_to_nieosiagalny_a_nie_brak(self):
        for exc in (PermissionError(13, "odmowa"), OSError(64, "siec niedostepna"), TimeoutError()):
            with mock.patch.object(bfi.os, "stat", side_effect=exc):
                self.assertEqual(bfi._dir_state(Path("M:/x")), "unreachable")
                with self.assertRaises(bfi.MergeUnreachable):
                    bfi._dir_exists_or_raise(Path("M:/x"))

    def test_brak_nie_rzuca(self):
        with mock.patch.object(bfi.os, "stat", side_effect=FileNotFoundError()):
            self.assertFalse(bfi._dir_exists_or_raise(Path("M:/x")))

    def test_kod_wyjscia_rozny_od_pelnego_skanu(self):
        self.assertEqual(bfi.UNREACHABLE_RC, 6)
        self.assertNotEqual(bfi.UNREACHABLE_RC, bfi.NEEDS_FULL_RC)


if __name__ == "__main__":
    unittest.main()
