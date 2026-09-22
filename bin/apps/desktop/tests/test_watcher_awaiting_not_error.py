# -*- coding: utf-8 -*-
"""Zdrowy indeks nie moze dawac paska "Pliki moga sie nie wyswietlac".

Objaw 2026-09-22 (trzecie zgloszenie tego samego przez uzytkownika):
    "Pliki moga sie nie wyswietlac: 1 problem
     Aktualizacja indeksu nie dziala
     Proces odswiezajacy liste plikow zatrzymal sie."

ZMIERZONE NA DZIALAJACEJ APLIKACJI (2.2.8, most 8766), a nie zgadniete:

    GET /preflight -> watcher: ok=False level=block blocking=True
                      extra: awaiting_first_rebuild=True,
                             last_error='awaiting_first_rebuild'
    GET /index/status -> size=9367548 (9,4 MB, zbudowany tego samego dnia)
                         watcher_ok=True  stale=False  rebuild_running=True
                         progress: hourly:building, pct=1, eta_sec=933
                         last_ok=None

Czyli: indeks byl ZDROWY, przebudowa godzinowa DZIALALA, a pasek twierdzil,
ze proces sie zatrzymal i pliki moga sie nie wyswietlac.

Dwie przyczyny, obie w kolejnosci warunkow check_watcher():

1. last_ok is None -> awaiting_first_rebuild=True. To znaczy tylko tyle, ze
   ZADNA przebudowa jeszcze sie nie ZAKONCZYLA w tej instalacji - normalny
   stan, gdy indeks jest swiezy i nie bylo czego przebudowywac. Warunek
   "awaiting" byl sprawdzany PO "not alive", wiec miedzy cyklicznymi
   przebudowami (gdy watcher_ok chwilowo spada) wygrywal czerwony blad.
   Autor poprzedniej wersji juz wiedzial, ze to nie blad - wycinal
   "awaiting_first_rebuild" z TEKSTU, ale nie z decyzji o blokadzie.

2. Pasek nazywa sie "Pliki moga sie nie wyswietlac". Gdy plik indeksu lezy
   na dysku i jest niepusty, pliki wyswietlaja sie normalnie. Martwy watcher
   znaczy wtedy "lista moze byc nieaktualna" - ostrzezenie, nie blokada.
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import preflight  # noqa: E402


def _status(**kw):
    base = {
        "watcher_ok": True,
        "stale": False,
        "awaiting_first_rebuild": False,
        "last_ok": True,
        "last_error": "",
        "progress": {},
    }
    base.update(kw)
    return lambda: base


class _IndexFile:
    """Prawdziwy plik na dysku - _index_usable robi stat(), nie ufa flagom."""

    def __init__(self, size: int):
        self.tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
        self.tmp.write(b"x" * size)
        self.tmp.close()
        self.path = Path(self.tmp.name)

    def cleanup(self):
        try:
            self.path.unlink()
        except OSError:
            pass


class ZdrowyIndeksTests(unittest.TestCase):
    """Stan zmierzony na zywej aplikacji nie moze blokowac pulpitu."""

    def setUp(self):
        self.big = _IndexFile(preflight.MIN_INDEX_BYTES + 5000)
        self.addCleanup(self.big.cleanup)

    def test_zmierzony_stan_z_aplikacji_nie_blokuje(self):
        """awaiting_first_rebuild + zdrowy indeks 9,4 MB = zadnej blokady."""
        item = preflight.check_watcher(
            _status(awaiting_first_rebuild=True, last_ok=None,
                    last_error="awaiting_first_rebuild"),
            self.big.path,
        )
        self.assertTrue(item["ok"], "zdrowy indeks zglaszany jako awaria")
        self.assertFalse(item["blocking"], "to NIE moze blokowac pulpitu")
        self.assertEqual(item["level"], "info")
        self.assertNotIn("nie działa", item["label"])

    def test_awaiting_wygrywa_z_chwilowo_martwym_watcherem(self):
        """Miedzy przebudowami watcher_ok spada - to nadal nie jest awaria."""
        item = preflight.check_watcher(
            _status(watcher_ok=False, stale=True,
                    awaiting_first_rebuild=True, last_ok=None),
            self.big.path,
        )
        self.assertFalse(item["blocking"])
        self.assertEqual(item["level"], "info")

    def test_martwy_watcher_przy_zdrowym_indeksie_to_ostrzezenie(self):
        """Indeks jest -> pliki sie wyswietlaja. Lista tylko moze byc nieswieza."""
        item = preflight.check_watcher(
            _status(watcher_ok=False, stale=True, last_ok=False,
                    last_error="rc=1"),
            self.big.path,
        )
        self.assertFalse(item["blocking"], "jest indeks, wiec nie wolno blokowac")
        self.assertEqual(item["level"], "warn")
        self.assertIn("nieaktualna", item["label"])
        self.assertIn("rc=1", item["hint"], "prawdziwy blad ma byc nadal widoczny")


class PrawdziwaAwariaTests(unittest.TestCase):
    """Bez indeksu pasek MUSI zostac czerwony - inaczej ukrylibysmy awarie."""

    def test_martwy_watcher_bez_indeksu_nadal_blokuje(self):
        item = preflight.check_watcher(
            _status(watcher_ok=False, stale=True, last_ok=False, last_error="rc=1"),
            None,
        )
        self.assertFalse(item["ok"])
        self.assertTrue(item["blocking"])
        self.assertIn("nie działa", item["label"])

    def test_pusty_indeks_liczy_sie_jak_brak(self):
        small = _IndexFile(10)
        self.addCleanup(small.cleanup)
        item = preflight.check_watcher(
            _status(watcher_ok=False, stale=True, last_ok=False), small.path
        )
        self.assertTrue(item["blocking"], "10-bajtowy plik to nie jest indeks")

    def test_nieistniejaca_sciezka_liczy_sie_jak_brak(self):
        item = preflight.check_watcher(
            _status(watcher_ok=False, stale=True, last_ok=False),
            Path("Z:/na-pewno/nie/ma/file-index.json"),
        )
        self.assertTrue(item["blocking"])

    def test_postep_przebudowy_nadal_daje_info(self):
        """Regresja z 2.2.8 - zywy postep bije pliki stanu."""
        item = preflight.check_watcher(
            _status(watcher_ok=False, stale=True,
                    progress={"running": True, "products_done": 14, "products_total": 196}),
            None,
        )
        self.assertFalse(item["blocking"])
        self.assertIn("14/196", item["label"])

    def test_zdrowy_watcher_bez_zmian(self):
        item = preflight.check_watcher(_status(), self.__class__ and None)
        self.assertTrue(item["ok"])
        self.assertFalse(item["blocking"])
        self.assertEqual(item["label"], "Aktualizacja indeksu działa")


class ZgodnoscWsteczna(unittest.TestCase):
    def test_index_file_jest_opcjonalny(self):
        """Stare wywolanie z jednym argumentem musi dalej dzialac."""
        item = preflight.check_watcher(_status())
        self.assertTrue(item["ok"])


if __name__ == "__main__":
    unittest.main()
