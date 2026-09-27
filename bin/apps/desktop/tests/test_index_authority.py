# -*- coding: utf-8 -*-
"""Faza 3, decyzja kierownika 27.09.2026 (utwardzona 27.09.2026, zadanie 3.3):
ROOT lokalny nie daje prawa do zmiany wspolnego katalogu w bazie.
index_authority.may_publish() decyduje, kto smie publikowac migawki indeksu i
kasowac materialy; brak klucza / blad odczytu BEZ wczesniejszej znanej wartosci
musi zachowywac sie DOKLADNIE jak przed tym modulem (nikt nie jest blokowany).
Porownanie nazw maszyn jest bez wzgledu na wielkosc liter. Blad odczytu PO
wczesniejszym udanym odczycie zostawia OSTATNIA znana wartosc (przetrwac restart
procesu - plik stanu, nie cache w pamieci).
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_authority as ia  # noqa: E402


class _FakePg:
    """Atrapa polaczenia PG. dam_meta['index_authority'] ma jedna wartosc (query_value);
    dam_assets.updated_by / dam_index_snapshots.built_by sa opcjonalne (dla status())."""

    def __init__(self, value: dict | None, *, raise_on_execute: bool = False,
                 known_machines: list[str] | None = None,
                 last_built: list[tuple[str, str]] | None = None):
        self._value = value
        self._raise = raise_on_execute
        self._known_machines = known_machines or []
        self._last_built = last_built or []
        self._last_sql = ""
        self.closed = False

    def cursor(self):
        return self

    def execute(self, sql, params=None):
        if self._raise:
            raise RuntimeError("siec padla")
        self._last_sql = sql
        self._last_key = params[0] if params else None

    def fetchone(self):
        if self._value is None:
            return None
        return {"value": json.dumps(self._value, ensure_ascii=False)}

    def fetchall(self):
        if "dam_assets" in self._last_sql:
            return [{"updated_by": m} for m in self._known_machines]
        if "dam_index_snapshots" in self._last_sql:
            return [{"built_by": m, "built_at": at} for m, at in self._last_built]
        return []

    def close(self):
        self.closed = True


class MayPublishTests(unittest.TestCase):
    def setUp(self):
        ia._CACHE.update(at=0.0, value=None, raw={}, error="")
        self._env_patch = mock.patch.dict(os.environ, {"COMPUTERNAME": "INYFINN", "HOSTNAME": ""})
        self._env_patch.start()
        self.addCleanup(self._env_patch.stop)
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self._state_file = Path(self._tmp.name) / "index-authority.json"
        p = mock.patch.object(ia, "_state_path", return_value=self._state_file)
        p.start()
        self.addCleanup(p.stop)

    def test_brak_klucza_daje_none(self):
        pg = _FakePg(None)
        self.assertIsNone(ia.may_publish(lambda: pg, force=True))

    def test_maszyna_na_liscie_daje_true(self):
        pg = _FakePg({"machines": ["INYFINN", "KRZYSZTOFWI"]})
        self.assertTrue(ia.may_publish(lambda: pg, force=True))

    def test_maszyna_spoza_listy_daje_false(self):
        pg = _FakePg({"machines": ["KRZYSZTOFWI", "KINGAUR"]})
        self.assertFalse(ia.may_publish(lambda: pg, force=True))

    def test_porownanie_bez_wzgledu_na_wielkosc_liter(self):
        pg = _FakePg({"machines": ["inyfinn"]})  # baza ma male litery, COMPUTERNAME=INYFINN
        self.assertTrue(ia.may_publish(lambda: pg, force=True))

    def test_pusta_lista_maszyn_jak_brak_klucza(self):
        pg = _FakePg({"machines": []})
        self.assertIsNone(ia.may_publish(lambda: pg, force=True))

    def test_blad_polaczenia_bez_wczesniejszej_wartosci_daje_none(self):
        def boom():
            raise ConnectionError("brak sieci")

        self.assertIsNone(ia.may_publish(boom, force=True))

    def test_blad_zapytania_bez_wczesniejszej_wartosci_daje_none(self):
        pg = _FakePg({"machines": ["INYFINN"]}, raise_on_execute=True)
        self.assertIsNone(ia.may_publish(lambda: pg, force=True))

    def test_blad_odczytu_po_znanej_wartosci_zostaje_ostatnia_znana(self):
        pg_ok = _FakePg({"machines": ["KRZYSZTOFWI"]})  # INYFINN NIE na liscie -> False
        self.assertFalse(ia.may_publish(lambda: pg_ok, force=True))

        def boom():
            raise ConnectionError("siec padla teraz")

        # Blad PO znanej wartosci -> zostaje False, NIE None.
        self.assertFalse(ia.may_publish(boom, force=True))

    def test_ostatnia_znana_wartosc_przetrwa_restart_procesu(self):
        """Restart procesu = nowy _CACHE w pamieci (globalny stan modulu zerowany),
        ale plik stanu na dysku zostaje - to jest ten "restart" tutaj."""
        pg_ok = _FakePg({"machines": ["KRZYSZTOFWI"]})
        self.assertFalse(ia.may_publish(lambda: pg_ok, force=True))

        # symulacja restartu procesu: wyczysc TYLKO cache w pamieci
        ia._CACHE.update(at=0.0, value=None, raw={}, error="")

        def boom():
            raise ConnectionError("siec padla po restarcie")

        self.assertFalse(ia.may_publish(boom, force=True))

    def test_cache_nie_pyta_bazy_w_oknie_60s(self):
        calls = {"n": 0}

        def connect():
            calls["n"] += 1
            return _FakePg({"machines": ["KRZYSZTOFWI"]})

        self.assertFalse(ia.may_publish(connect, force=True))
        self.assertFalse(ia.may_publish(connect))  # bez force = z cache
        self.assertEqual(calls["n"], 1)

    def test_status_niesie_liste_i_wynik(self):
        pg = _FakePg({"machines": ["INYFINN"], "updated_at": "x", "updated_by": "kierownik"},
                      known_machines=["INYFINN"], last_built=[("INYFINN", ia._utc())])
        st = ia.status(lambda: pg, root_path="")
        self.assertEqual(st["machine"], "INYFINN")
        self.assertTrue(st["may_publish"])
        self.assertEqual(st["machines"], ["INYFINN"])
        self.assertEqual(st["updated_by"], "kierownik")
        self.assertEqual(st["warning"], "")
        self.assertEqual(st["warnings"], [])

    def test_status_ostrzega_gdy_klucz_nieustawiony(self):
        pg = _FakePg(None)
        st = ia.status(lambda: pg)
        self.assertIsNone(st["may_publish"])
        self.assertIn("nie ustawiony", st["warning"])

    def test_status_ostrzega_o_nieznanym_komputerze_na_liscie(self):
        pg = _FakePg({"machines": ["INYFINN", "DUCH"]},
                      known_machines=["INYFINN"], last_built=[("INYFINN", ia._utc())])
        st = ia.status(lambda: pg)
        self.assertTrue(any("DUCH" in w and "Nieznany" in w for w in st["warnings"]))

    def test_status_ostrzega_o_starej_publikacji(self):
        stary = "2020-01-01T00:00:00+00:00"
        pg = _FakePg({"machines": ["INYFINN"]}, known_machines=["INYFINN"],
                      last_built=[("INYFINN", stary)])
        st = ia.status(lambda: pg)
        self.assertTrue(any("24h" in w or "ponad" in w for w in st["warnings"]))


if __name__ == "__main__":
    unittest.main()
