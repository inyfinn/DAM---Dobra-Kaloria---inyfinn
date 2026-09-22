# -*- coding: utf-8 -*-
"""Start aplikacji nie moze udawac awarii indeksu.

Objaw 2026-09-22: przy KAZDYM uruchomieniu DAM pulpit pokazywal czerwony pasek
"Aktualizacja indeksu nie dziala - proces odswiezajacy liste plikow zatrzymal sie",
mimo ze indeks wlasnie sie budowal.

Zmierzone na DZIALAJACEJ aplikacji (2.2.7, most na 8766):
    GET /preflight -> {"ok": true, "blocking": [], ...}
    watcher: ok=True level=info blocking=False "Trwa pierwsze budowanie indeksu"
    12 probek co 3 s - ANI RAZU blocking. Backend byl zdrowy.

Czyli pasek pochodzil z PRZEJSCIOWEGO stanu tuz po starcie: pliki stanu sa
wtedy jeszcze z poprzedniego uruchomienia (martwe pidy, przeterminowane zamki),
wiec alive = watcher_ok and not stale wychodzilo False. UI odpytywalo ponownie
dopiero po 20 s, wiec blad byl widoczny przy kazdym starcie.

Zasada poprawki: jesli przebudowa REALNIE sie posuwa (progress.running), to nie
jest awaria, tylko start - niezaleznie od tego, co mowia pliki stanu.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import preflight  # noqa: E402


def _status(**kw):
    base = {
        "watcher_ok": False,
        "stale": True,
        "awaiting_first_rebuild": True,
        "last_error": "",
        "progress": {},
    }
    base.update(kw)
    return lambda: base


class StartupIsNotFailureTests(unittest.TestCase):
    def test_progress_running_is_not_an_error(self):
        """Stan z poprzedniego uruchomienia + zywy postep = info, nie czerwony blad."""
        item = preflight.check_watcher(
            _status(progress={"running": True, "products_done": 14, "products_total": 196})
        )
        self.assertTrue(item["ok"], "postep trwa, a preflight zglasza awarie")
        self.assertFalse(item["blocking"], "to nie moze blokowac pulpitu")
        self.assertEqual(item["level"], "info")

    def test_progress_shows_counters(self):
        item = preflight.check_watcher(
            _status(progress={"running": True, "products_done": 14, "products_total": 196})
        )
        self.assertIn("14/196", item["label"])

    def test_really_dead_watcher_still_reports_error(self):
        """Brak postepu i martwy watcher NADAL ma dawac czerwony pasek."""
        item = preflight.check_watcher(_status(progress={"running": False}))
        self.assertFalse(item["ok"])
        self.assertTrue(item["blocking"])
        self.assertIn("nie dzia", item["label"])

    def test_missing_progress_key_still_reports_error(self):
        item = preflight.check_watcher(_status())
        self.assertFalse(item["ok"])
        self.assertTrue(item["blocking"])

    def test_healthy_watcher_unaffected(self):
        item = preflight.check_watcher(
            _status(watcher_ok=True, stale=False, awaiting_first_rebuild=False, last_ok=True)
        )
        self.assertTrue(item["ok"])
        self.assertFalse(item["blocking"])


class UiBackoffTests(unittest.TestCase):
    """UI musi ponawiac SZYBKO, inaczej migniecie startowe wisi 20 s."""

    def test_recheck_starts_fast(self):
        js = DESKTOP.parent / "web" / "assets" / "js" / "dam-preflight.js"
        if not js.is_file():
            self.skipTest("brak dam-preflight.js")
        text = js.read_text(encoding="utf-8", errors="replace")
        self.assertIn("RECHECK_STEPS_MS", text, "brak progresywnego ponawiania")
        self.assertIn("2000", text, "pierwsze ponowienie musi byc szybkie (2 s)")
        self.assertIn("_recheckStep", text)


if __name__ == "__main__":
    unittest.main()
