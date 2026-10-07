# -*- coding: utf-8 -*-
"""Etap 1a (spec 3.6, 9.1): wykrywanie przeniesien folderow - asset_sync_m.detect_pairs. Czysta logika, bez bazy."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import asset_sync  # noqa: E402
import asset_sync_m  # noqa: E402


def _file(rel: str, mtime: int = 1000) -> tuple[str, dict]:
    aid, entry = asset_sync.scan_entry(f"M:/{rel}", size=1, mtime_ms=mtime, root="M:", meta={})
    return aid, {**entry, "asset_id": aid, "deleted_at": None, "rev": 1, "origin": "m"}


class PairTests(unittest.TestCase):
    def _case(self, old_dir: str, new_dir: str, names: list[str], *, new_mtimes=None, old_mtime=1000, gone=None):
        """Zwraca (absent, rows_lustra): stare pliki zniknely (gone = najwyzszy zniknity folder), nowe sa w lustrze."""
        absent, rows = [], {}
        for i, n in enumerate(names):
            aid, row = _file(f"{old_dir}/{n}", old_mtime)
            absent.append({"asset_id": aid, "asset_key": row["asset_key"], "mtime_ms": old_mtime,
                           "gone": old_dir if gone is None else gone})
            rows[aid] = row
        for i, n in enumerate(names):
            aid, row = _file(f"{new_dir}/{n}", (new_mtimes or {}).get(i, old_mtime))
            rows[aid] = row
        return absent, rows

    NAMES = ["a.png", "b.png", "c.png", "d.png", "e.png"]

    def test_przemianowanie_folderu(self):
        absent, rows = self._case("- POLSKA/Stary", "- POLSKA/Nowy", self.NAMES)
        res = asset_sync_m.detect_pairs(absent, rows)
        self.assertEqual([(p["from"], p["to"], p["matched"], p["cross_tree"]) for p in res["pairs"]],
                         [("- polska/stary", "- polska/nowy", 5, False)])
        self.assertEqual(len(res["map"]), 5)
        old_id = absent[0]["asset_id"]
        self.assertEqual(res["map"][old_id], asset_sync.id_of("- polska/nowy/a.png"))

    def test_przeniesienie_w_inne_miejsce_i_miedzy_drzewami(self):
        absent, rows = self._case("- POLSKA/Napoje/Stary", "-- ARCHIWUM --/Wymiana/Stary", self.NAMES)
        res = asset_sync_m.detect_pairs(absent, rows)
        self.assertEqual(len(res["pairs"]), 1)
        self.assertTrue(res["pairs"][0]["cross_tree"], "pary miedzy drzewami sa oznaczone do przegladu")

    def test_20_procent_plikow_ze_zmieniona_data_nadal_daje_pare(self):
        absent, rows = self._case("- POLSKA/Stary", "- POLSKA/Nowy", self.NAMES, new_mtimes={0: 5555})
        res = asset_sync_m.detect_pairs(absent, rows)
        self.assertEqual((len(res["pairs"]), res["pairs"][0]["same_mtime"], len(res["map"])), (1, 4, 5),
                         "plik ze zmieniona data tez jest dopasowany po sciezce i nazwie")

    def test_60_procent_zmienionych_nie_daje_pary(self):
        absent, rows = self._case("- POLSKA/Stary", "- POLSKA/Nowy", self.NAMES, new_mtimes={0: 1, 1: 2, 2: 3})
        self.assertEqual(asset_sync_m.detect_pairs(absent, rows), {"map": {}, "pairs": []})

    def test_stary_folder_istnieje_to_kopia_nie_przeniesienie(self):
        absent, rows = self._case("- POLSKA/Stary", "- POLSKA/Nowy", self.NAMES, gone="")   # znikly tylko pliki
        self.assertEqual(asset_sync_m.detect_pairs(absent, rows), {"map": {}, "pairs": []})

    def test_grupa_dwoch_plikow_nie_tworzy_pary(self):
        absent, rows = self._case("- POLSKA/Stary", "- POLSKA/Nowy", self.NAMES[:2])
        self.assertEqual(asset_sync_m.detect_pairs(absent, rows), {"map": {}, "pairs": []})

    def test_kopia_czesci_folderu_gdzie_indziej_nie_wygrywa_z_prawdziwym_celem(self):
        names = ["a.png", "b.png", "c.png", "d.png", "e.png", "f.png"]
        absent, rows = self._case("- POLSKA/Stary", "- POLSKA/Cel", names)
        for n in names[:3]:                                  # pol. plikow tez w innym folderze
            aid, row = _file(f"- POLSKA/Kopia/{n}")
            rows[aid] = row
        res = asset_sync_m.detect_pairs(absent, rows)
        self.assertEqual([(p["to"], p["matched"]) for p in res["pairs"]], [("- polska/cel", 6)])

    def test_cel_z_mniej_niz_90_procent_plikow_nie_jest_para(self):
        names = ["a.png", "b.png", "c.png", "d.png", "e.png", "f.png"]
        absent, rows = self._case("- POLSKA/Stary", "- POLSKA/Cel", names)
        for n in names[4:]:                                  # w celu brakuje 2 z 6 (67 %)
            rows.pop(asset_sync.id_of(f"- polska/cel/{n}"))
        self.assertEqual(asset_sync_m.detect_pairs(absent, rows), {"map": {}, "pairs": []})

    def test_glebokie_sciezki_wzgledne_sa_zachowane(self):
        names = ["x/a.png", "x/b.png", "y/c.png"]
        absent, rows = self._case("- POLSKA/Stary", "- POLSKA/Nowy", names)
        res = asset_sync_m.detect_pairs(absent, rows)
        self.assertEqual(len(res["map"]), 3)

    def test_wykluczone_id_nie_moga_byc_celem(self):
        absent, rows = self._case("- POLSKA/Stary", "- POLSKA/Nowy", self.NAMES)
        excl = {asset_sync.id_of(f"- polska/nowy/{n}") for n in self.NAMES}
        self.assertEqual(asset_sync_m.detect_pairs(absent, rows, exclude_ids=excl)["pairs"], [])


if __name__ == "__main__":
    unittest.main()
