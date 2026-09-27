# -*- coding: utf-8 -*-
"""Faza 3, decyzja kierownika 27.09.2026: ROOT lokalny nie daje prawa do zmiany
wspolnego katalogu w bazie. index_authority.may_publish() decyduje, kto smie
publikowac migawki indeksu i kasowac materialy; brak klucza / blad odczytu
musi zachowywac sie DOKLADNIE jak przed tym modulem (nikt nie jest blokowany).
"""
from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_authority as ia  # noqa: E402


class _FakePg:
    """Atrapa polaczenia PG z jednym wierszem dam_meta['index_authority']."""

    def __init__(self, value: dict | None, *, raise_on_execute: bool = False):
        self._value = value
        self._raise = raise_on_execute
        self.closed = False

    def cursor(self):
        return self

    def execute(self, sql, params=None):
        if self._raise:
            raise RuntimeError("siec padla")
        self._last_key = params[0] if params else None

    def fetchone(self):
        if self._value is None:
            return None
        return {"value": json.dumps(self._value, ensure_ascii=False)}

    def close(self):
        self.closed = True


class MayPublishTests(unittest.TestCase):
    def setUp(self):
        ia._CACHE.update(at=0.0, value=None, raw={}, error="")
        self._env_patch = mock.patch.dict(os.environ, {"COMPUTERNAME": "INYFINN", "HOSTNAME": ""})
        self._env_patch.start()
        self.addCleanup(self._env_patch.stop)

    def test_brak_klucza_daje_none(self):
        pg = _FakePg(None)
        self.assertIsNone(ia.may_publish(lambda: pg, force=True))

    def test_maszyna_na_liscie_daje_true(self):
        pg = _FakePg({"machines": ["INYFINN", "KRZYSZTOFWI"]})
        self.assertTrue(ia.may_publish(lambda: pg, force=True))

    def test_maszyna_spoza_listy_daje_false(self):
        pg = _FakePg({"machines": ["KRZYSZTOFWI", "KINGAUR"]})
        self.assertFalse(ia.may_publish(lambda: pg, force=True))

    def test_pusta_lista_maszyn_jak_brak_klucza(self):
        pg = _FakePg({"machines": []})
        self.assertIsNone(ia.may_publish(lambda: pg, force=True))

    def test_blad_polaczenia_daje_none(self):
        def boom():
            raise ConnectionError("brak sieci")

        self.assertIsNone(ia.may_publish(boom, force=True))

    def test_blad_zapytania_daje_none(self):
        pg = _FakePg({"machines": ["INYFINN"]}, raise_on_execute=True)
        self.assertIsNone(ia.may_publish(lambda: pg, force=True))

    def test_cache_nie_pyta_bazy_w_oknie_60s(self):
        calls = {"n": 0}

        def connect():
            calls["n"] += 1
            return _FakePg({"machines": ["KRZYSZTOFWI"]})

        self.assertFalse(ia.may_publish(connect, force=True))
        self.assertFalse(ia.may_publish(connect))  # bez force = z cache
        self.assertEqual(calls["n"], 1)

    def test_status_niesie_liste_i_wynik(self):
        pg = _FakePg({"machines": ["INYFINN"], "updated_at": "x", "updated_by": "kierownik"})
        st = ia.status(lambda: pg, root_path="")
        self.assertEqual(st["machine"], "INYFINN")
        self.assertTrue(st["may_publish"])
        self.assertEqual(st["machines"], ["INYFINN"])
        self.assertEqual(st["updated_by"], "kierownik")
        self.assertEqual(st["warning"], "")

    def test_status_ostrzega_gdy_klucz_nieustawiony(self):
        pg = _FakePg(None)
        st = ia.status(lambda: pg)
        self.assertIsNone(st["may_publish"])
        self.assertIn("nie ustawiony", st["warning"])


if __name__ == "__main__":
    unittest.main()
