# -*- coding: utf-8 -*-
"""07.10.2026 (audyt publikacji, zator Z6): platform_compat.user_state_dir() przy kazdym
wywolaniu zapisywal i kasowal sonde ".write-probe" o STALEJ nazwie. Drugi watek/proces
dostawal FileNotFoundError i funkcja oddawala katalog zapasowy (apps/desktop/data) -
stan synchronizacji zyl w dwoch katalogach naraz (2 watki: 30,7 % blednych wynikow).
"""
from __future__ import annotations

import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import platform_compat as pc  # noqa: E402

THREADS, CALLS = 8, 200


class UserStateDirRaceTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.primary = Path(tmp.name) / "state"
        p = mock.patch.dict(os.environ, {"DAM_STATE_DIR": str(self.primary)})
        p.start()
        self.addCleanup(p.stop)
        p = mock.patch.dict(pc._STATE_DIR_OK, clear=True)
        p.start()
        self.addCleanup(p.stop)

    def _hammer(self, before_call=lambda: None) -> set:
        got: list[set] = [set() for _ in range(THREADS)]
        start = threading.Barrier(THREADS)

        def work(i: int) -> None:
            start.wait()
            for _ in range(CALLS):
                before_call()
                got[i].add(pc.user_state_dir())

        threads = [threading.Thread(target=work, args=(i,)) for i in range(THREADS)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=60)
        return set().union(*got)

    def test_osiem_watkow_zawsze_ten_sam_katalog_podstawowy(self):
        self.assertEqual(self._hammer(), {self.primary})
        self.assertEqual([p.name for p in self.primary.iterdir()], [])  # sondy posprzatane

    def test_sonda_przy_kazdym_wywolaniu_tez_sie_nie_sciga(self):
        """Bez pamieci wyniku (czyszczonej przed kazdym wywolaniem) liczy sie sama sonda:
        unikalna nazwa = nikt nie kasuje cudzego pliku."""
        self.assertEqual(self._hammer(before_call=pc._STATE_DIR_OK.clear), {self.primary})

    def test_porazka_nie_jest_zapamietywana(self):
        self.primary.parent.mkdir(parents=True, exist_ok=True)
        self.primary.write_text("to plik, nie katalog", encoding="utf-8")
        self.assertEqual(pc.user_state_dir(), pc._DATA_DIR_FALLBACK)
        self.primary.unlink()
        self.assertEqual(pc.user_state_dir(), self.primary)

    def test_katalog_skasowany_w_trakcie_pracy_jest_zakladany_od_nowa(self):
        self.assertEqual(pc.user_state_dir(), self.primary)
        self.primary.rmdir()  # pusty katalog z tego testu
        self.assertEqual(pc.user_state_dir(), self.primary)
        self.assertTrue(self.primary.is_dir())


if __name__ == "__main__":
    unittest.main()
