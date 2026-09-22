# -*- coding: utf-8 -*-
"""Aktualizacja z nowym haslem do bazy odswieza konfiguracje sama.

22.09.2026: instalator 2.3.3 przywiozl nowy pg-config.sealed.json, ale DPAPI trzymalo
haslo z pierwszej aktywacji (21.09) i nikt go nie odswiezal. Baza odpowiadala
"password authentication failed", aplikacja przechodzila w tryb offline, a baner
wrzucal to pod "Pliki moga sie nie wyswietlac" razem z brakiem folderu Marketing.
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import pg_db  # noqa: E402
import pg_seal  # noqa: E402

CODE = "ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2"
OLD = {"host": "h", "port": 5433, "dbname": "d", "user": "u", "password": "stare"}
NEW = dict(OLD, password="nowe")


@unittest.skipUnless(pg_seal.dpapi_available(), "DPAPI tylko na Windows")
class ResealTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.data = Path(tmp.name)
        for name, value in (
            ("DATA_DIR", self.data),
            ("SEALED_PATH", self.data / "pg-config.sealed.json"),
            ("DPAPI_PATH", self.data / "pg-config.dpapi"),
            ("CODE_PATH", self.data / "pg-config.code.dpapi"),
            ("SEALED_USED_PATH", self.data / "pg-config.sealed.used"),
        ):
            p = mock.patch.object(pg_seal, name, value)
            p.start()
            self.addCleanup(p.stop)
        pg_seal._ATTEMPTS.clear()
        self.addCleanup(pg_seal._ATTEMPTS.clear)

    def _ship(self, cfg):
        """Instalator wgrywa nowy sealed.json (tym samym kodem aktywacyjnym)."""
        pg_seal.SEALED_PATH.write_text(json.dumps(pg_seal.seal(cfg, CODE)), encoding="utf-8")

    def test_aktualizacja_z_nowym_haslem_odswieza_dpapi(self):
        self._ship(OLD)
        self.assertTrue(pg_seal.activate(CODE)["ok"])
        self.assertEqual(pg_seal.load_protected()["password"], "stare")
        self._ship(NEW)
        self.assertTrue(pg_seal.reseal_if_newer())
        self.assertEqual(pg_seal.load_protected()["password"], "nowe")

    def test_ten_sam_instalator_nic_nie_robi(self):
        self._ship(OLD)
        pg_seal.activate(CODE)
        self.assertFalse(pg_seal.reseal_if_newer())
        self.assertFalse(pg_seal.reseal_if_newer(force=True))

    def test_stara_aktywacja_bez_kodu_nie_zgaduje(self):
        """Instalacje sprzed 2.3.4 nie maja zapamietanego kodu - wtedy okno kodu, nie cisza."""
        self._ship(OLD)
        self.assertTrue(pg_seal.store_protected(OLD))
        self._ship(NEW)
        self.assertFalse(pg_seal.reseal_if_newer())
        self.assertEqual(pg_seal.load_protected()["password"], "stare")


class AuthFailedStateTests(unittest.TestCase):
    """Odrzucone haslo to inny stan niz brak sieci - UI ma poprosic o kod."""

    def setUp(self):
        self._saved = pg_db._AUTH_FAILED
        self.addCleanup(setattr, pg_db, "_AUTH_FAILED", self._saved)

    def test_rozpoznaje_odrzucone_haslo(self):
        err = Exception('connection to server at "inyfinn.synology.me" failed: FATAL:  '
                        'password authentication failed for user "dam_eta"')
        self.assertTrue(pg_db._is_auth_error(err))
        self.assertFalse(pg_db._is_auth_error(Exception("timeout expired")))

    def test_activation_required_przy_odrzuconym_hasle(self):
        with mock.patch.object(pg_seal, "sealed_present", return_value=True), \
                mock.patch.object(pg_db, "is_configured", return_value=True):
            pg_db._AUTH_FAILED = False
            self.assertFalse(pg_db.activation_required())
            self.assertEqual(pg_db.activation_reason(), "")
            pg_db._AUTH_FAILED = True
            self.assertTrue(pg_db.activation_required())
            self.assertEqual(pg_db.activation_reason(), "auth_failed")


if __name__ == "__main__":
    unittest.main()
