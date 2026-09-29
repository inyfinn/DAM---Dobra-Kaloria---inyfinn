# -*- coding: utf-8 -*-
"""29.09.2026 (wlasciciel): bez kodu aktywacyjnego - instalator wozi kod
(pg-config.autocode obok pg-config.sealed.json), pierwszy start aktywuje sie sam."""
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

import pg_seal  # noqa: E402

CFG = {"host": "db.example", "port": 5433, "dbname": "dam_eta", "user": "u", "password": "tajne-haslo"}
CODE = "ABCD-EFGH-IJKL-MNOP"


class AutoActivate(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        d = Path(self.td.name)
        self.sealed = d / "pg-config.sealed.json"
        self.auto = d / "pg-config.autocode"
        self.store: dict[str, dict] = {}
        patches = {
            "SEALED_PATH": self.sealed,
            "AUTOCODE_PATH": self.auto,
            "DPAPI_PATH": d / "pg-config.dpapi",
            "CODE_PATH": d / "pg-config.code.dpapi",
            "SEALED_USED_PATH": d / "pg-config.sealed.used",
        }
        for name, value in patches.items():
            p = mock.patch.object(pg_seal, name, value)
            p.start()
            self.addCleanup(p.stop)
        # ochrona (DPAPI / pek kluczy) podmieniona na pamiec - test nie dotyka systemu
        def _store(cfg, path=None):
            self.store[str(path or pg_seal.DPAPI_PATH)] = dict(cfg)
            return True

        def _load(path=None):
            return self.store.get(str(path or pg_seal.DPAPI_PATH))

        for name, fn in (("store_protected", _store), ("load_protected", _load)):
            p = mock.patch.object(pg_seal, name, side_effect=fn)
            p.start()
            self.addCleanup(p.stop)
        p = mock.patch.object(pg_seal, "_throttled", return_value=False)
        p.start()
        self.addCleanup(p.stop)
        self.addCleanup(self.td.cleanup)
        self.sealed.write_text(json.dumps(pg_seal.seal(CFG, CODE)), encoding="utf-8")

    def test_activates_itself_with_bundled_code(self):
        self.auto.write_text(CODE, encoding="utf-8")
        res = pg_seal.auto_activate()
        self.assertTrue(res.get("ok"), res)
        self.assertEqual(self.store[str(pg_seal.DPAPI_PATH)]["password"], "tajne-haslo")

    def test_without_bundled_code_asks_nothing_and_does_nothing(self):
        res = pg_seal.auto_activate()
        self.assertFalse(res.get("ok"))
        self.assertEqual(res.get("error"), "no_bundled_code")
        self.assertNotIn(str(pg_seal.DPAPI_PATH), self.store)

    def test_already_active_is_left_alone(self):
        self.store[str(pg_seal.DPAPI_PATH)] = {"password": "juz-jest"}
        self.auto.write_text(CODE, encoding="utf-8")
        self.assertEqual(pg_seal.auto_activate().get("skipped"), "already_active")
        self.assertEqual(self.store[str(pg_seal.DPAPI_PATH)]["password"], "juz-jest")

    def test_update_with_new_password_uses_bundled_code(self):
        self.auto.write_text(CODE, encoding="utf-8")
        self.assertTrue(pg_seal.auto_activate().get("ok"))
        new = dict(CFG, password="nowe-haslo")
        self.sealed.write_text(json.dumps(pg_seal.seal(new, CODE)), encoding="utf-8")
        self.store.pop(str(pg_seal.CODE_PATH), None)  # starsza aktywacja bez zapamietanego kodu
        self.assertTrue(pg_seal.reseal_if_newer())
        self.assertEqual(self.store[str(pg_seal.DPAPI_PATH)]["password"], "nowe-haslo")


if __name__ == "__main__":
    unittest.main()
