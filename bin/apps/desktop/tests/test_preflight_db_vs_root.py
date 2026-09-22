# -*- coding: utf-8 -*-
"""Baza i folder Marketing to dwie osobne sprawy.

22.09.2026 (uzytkownik): "Baza danych a ROOT to dwie osobne funkcje. Jakim cudem gdy nie
ma root, to nie ma tez bazy synology?" W kodzie baza nie zalezala od folderu, ale pasek
"Pliki moga sie nie wyswietlac" pokazywal odrzucone haslo do bazy pod brakiem folderu.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import preflight  # noqa: E402


class FakePg:
    def __init__(self, *, auth_failed=False, ok=True, err=""):
        self._auth, self._ok, self._err = auth_failed, ok, err

    def last_auth_failed(self):
        return self._auth

    def activation_required(self):
        return self._auth

    def is_configured(self):
        return True

    def cached_health(self):
        return {"ok": self._ok, "error": self._err}


def _report(marketing_ok=False, index_ok=True, watcher_level="warn"):
    items = [
        preflight.check_database(FakePg()),
        preflight._item("marketing", marketing_ok, "Zapisany folder Marketing jest niedostępny: X:\\Marketing",
                        "Folder jest niedostępny.", action="pick_marketing"),
        preflight._item("index", index_ok, "Indeks plików: 9.1 MB"),
        preflight._item("watcher", True, "Ostatnie odświeżenie indeksu nie powiodło się",
                        "Błąd: watcher_exited_rc_1", level=watcher_level),
    ]
    blocking = [i["id"] for i in items if i["blocking"]]
    return {"ok": not blocking, "blocking": blocking, "items": items}


class DatabaseItemTests(unittest.TestCase):
    def test_odrzucone_haslo_to_osobna_przyczyna(self):
        it = preflight.check_database(FakePg(auth_failed=True))
        self.assertEqual(it["group"], "database")
        self.assertEqual(it["db_problem"], "auth_failed")
        self.assertEqual(it["action"], "activate")
        self.assertIn("hasło", it["label"])

    def test_brak_sieci_to_unreachable(self):
        it = preflight.check_database(FakePg(ok=False, err="timeout expired"))
        self.assertEqual(it["db_problem"], "unreachable")
        self.assertFalse(it["blocking"])

    def test_baza_ok_niezaleznie_od_folderu(self):
        rep = preflight.soften_without_root(_report(marketing_ok=False), cache_thumbs=14000)
        db = [i for i in rep["items"] if i["id"] == "database"][0]
        self.assertTrue(db["ok"])


class RootWithoutAlarmTests(unittest.TestCase):
    def test_brak_folderu_przy_pamieci_to_informacja(self):
        rep = preflight.soften_without_root(_report(), cache_thumbs=14000)
        mk = [i for i in rep["items"] if i["id"] == "marketing"][0]
        self.assertEqual(mk["level"], "info")
        self.assertFalse(mk["blocking"])
        self.assertEqual(mk["group"], "files")
        self.assertEqual(rep["blocking"], [])
        self.assertTrue(rep["ok"])

    def test_watcher_bez_folderu_to_informacja(self):
        rep = preflight.soften_without_root(_report(), cache_thumbs=14000)
        wt = [i for i in rep["items"] if i["id"] == "watcher"][0]
        self.assertEqual(wt["level"], "info")

    def test_pusta_pamiec_zostaje_alarmem(self):
        rep = preflight.soften_without_root(_report(), cache_thumbs=0)
        self.assertIn("marketing", rep["blocking"])

    def test_brak_indeksu_zostaje_alarmem(self):
        rep = preflight.soften_without_root(_report(index_ok=False), cache_thumbs=14000)
        self.assertIn("marketing", rep["blocking"])


if __name__ == "__main__":
    unittest.main()
