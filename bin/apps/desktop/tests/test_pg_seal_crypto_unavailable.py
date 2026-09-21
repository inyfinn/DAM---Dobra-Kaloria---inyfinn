# -*- coding: utf-8 -*-
"""activate() nie moze mylic braku biblioteki z blednym kodem.

20.09.2026: Smart App Control zablokowal cryptography/_rust.pyd w czystym Windows 11.
unseal() lyka kazdy wyjatek i zwraca None, wiec uzytkownik z POPRAWNYM kodem widzial
"Kod aktywacyjny jest niepoprawny" i szukal problemu tam, gdzie go nie bylo.
"""
from __future__ import annotations

import builtins
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

CODE = "ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2"


class ActivateErrorsTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        data = Path(self._tmp.name)
        sealed = pg_seal.seal({"host": "h", "port": 5433, "dbname": "d", "user": "u", "password": "tajne"}, CODE)
        (data / "pg-config.sealed.json").write_text(json.dumps(sealed), encoding="utf-8")
        for name, value in (
            ("DATA_DIR", data),
            ("SEALED_PATH", data / "pg-config.sealed.json"),
            ("DPAPI_PATH", data / "pg-config.dpapi"),
        ):
            p = mock.patch.object(pg_seal, name, value)
            p.start()
            self.addCleanup(p.stop)
        pg_seal._ATTEMPTS.clear()
        self.addCleanup(pg_seal._ATTEMPTS.clear)

    def test_poprawny_kod_aktywuje(self):
        self.assertTrue(pg_seal.activate(CODE).get("ok"))

    def test_zly_kod_to_code_invalid(self):
        res = pg_seal.activate("ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ")
        self.assertFalse(res.get("ok"))
        self.assertEqual(res.get("error"), "code_invalid")

    def test_zablokowana_biblioteka_to_nie_code_invalid(self):
        real_import = builtins.__import__

        def blocked(name, *args, **kwargs):
            if name.startswith("cryptography"):
                raise ImportError("DLL load failed while importing _rust: "
                                  "Zasady kontroli aplikacji zablokowaly ten plik.")
            return real_import(name, *args, **kwargs)

        with mock.patch.object(builtins, "__import__", blocked):
            res = pg_seal.activate(CODE)
        self.assertFalse(res.get("ok"))
        self.assertEqual(res.get("error"), "crypto_unavailable",
                         "brak biblioteki nie moze byc raportowany jako bledny kod")
        self.assertIn("_rust", res.get("detail", ""))


if __name__ == "__main__":
    unittest.main()
