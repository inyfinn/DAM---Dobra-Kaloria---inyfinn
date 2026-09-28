# -*- coding: utf-8 -*-
"""W8 (28.09.2026), W7 znalezisko 8: [WinError 5] przy os.replace(lock.json.tmp -> lock.json).

Na Windows os.replace odmawia (PermissionError), gdy ktos akurat czyta plik docelowy
(SlimGridPublisher / status czyta blokade w trakcie heartbeatu pelnego rebuildu). Wyjatek z
LockHandle.update przerywal bieg. Kontrakt: chwilowa odmowa -> kilka krotkich ponowien;
tmp unikalny per proces/watek (dwa zapisy nie depcza sobie wspolnego .tmp).
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

import rebuild_lock  # noqa: E402


class WriteAtomicRetryTests(unittest.TestCase):
    def test_transient_permission_error_is_retried(self):
        real = os.replace
        fails = {"n": 2}

        def flaky(src, dst):
            if fails["n"] > 0:
                fails["n"] -= 1
                raise PermissionError(5, "Odmowa dostepu (WinError 5)")
            return real(src, dst)

        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "branding-rebuild.lock.json"
            with mock.patch.object(rebuild_lock.os, "replace", side_effect=flaky), \
                    mock.patch.object(rebuild_lock.time, "sleep"):
                rebuild_lock._write_atomic(p, {"stage": "branding:fat"})
            self.assertEqual(json.loads(p.read_text(encoding="utf-8"))["stage"], "branding:fat")
            self.assertEqual([x.name for x in Path(tmp).iterdir()], [p.name], "bez osieroconych .tmp")

    def test_tmp_name_is_unique_per_writer(self):
        seen = []
        real = os.replace

        def spy(src, dst):
            seen.append(Path(src).name)
            return real(src, dst)

        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "x.lock.json"
            with mock.patch.object(rebuild_lock.os, "replace", side_effect=spy):
                rebuild_lock._write_atomic(p, {"a": 1})
        self.assertNotEqual(seen[0], "x.lock.json.tmp")
        self.assertIn(str(os.getpid()), seen[0])


if __name__ == "__main__":
    unittest.main()
