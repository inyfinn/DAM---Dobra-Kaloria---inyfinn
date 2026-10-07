# -*- coding: utf-8 -*-
"""07.10.2026: ponowny zapis TEJ SAMEJ sciezki ROOT nie moze podbijac root_generation.

Incydent: swiezy kontekst przegladarki wyslal przy wczytaniu strony POST /machine-config
+ POST /user-device-paths z biezaca sciezka (M:\) - generacja 1 -> 3, asset_sync_runner
porzucil obserwacje (root_gen "1|m:" -> "3|m:"), przepadla lista wstrzymanych usuniec.

Run: python tests/test_root_same_path_no_bump.py  (z bin/apps/desktop)
"""
from __future__ import annotations

import http.client
import json
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

TESTS = Path(__file__).resolve().parent
for _p in (TESTS, TESTS.parent):
    if (_p / "local_bridge.py").is_file() or (_p / "test_repro_5_root_switch_race.py").is_file():
        if str(_p) not in sys.path:
            sys.path.insert(0, str(_p))

import local_bridge as lb  # noqa: E402
from test_repro_5_root_switch_race import RootSwitchRaceBase, _make_root  # noqa: E402


class SamePathDoesNotBumpGenerationTests(RootSwitchRaceBase):
    def _post(self, port: int, path: str, body: dict) -> dict:
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
        conn.request("POST", path, body=json.dumps(body),
                     headers={"Content-Type": "application/json", "Origin": "http://127.0.0.1:8765"})
        r = conn.getresponse()
        data = json.loads(r.read().decode("utf-8"))
        conn.close()
        self.assertEqual(r.status, 200, data)
        return data

    def test_page_load_migration_pair_keeps_generation_and_file(self):
        """Dokladnie para z persistBasePathToBridge (dam-paths.js): oba POST z biezaca sciezka."""
        before_text = self.state_cfg.read_text(encoding="utf-8")
        gen_before = lb._root_generation_baseline("racer")
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), lb.Handler)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            with mock.patch.object(lb.Handler, "_session_user",
                                   return_value={"email": "a@b.pl", "role": "user"}), \
                    mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}) as reset_mem, \
                    mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting") as rw:
                port = httpd.server_address[1]
                r1 = self._post(port, "/machine-config", {"base_path": str(self.old_root)})
                r2 = self._post(port, "/user-device-paths", {
                    "action": "upsert", "device_id": "dev-race", "hostname": "pc-race",
                    "base_path": str(self.old_root)})
        finally:
            httpd.shutdown()
            httpd.server_close()
        self.assertTrue(r1["ok"] and r2["ok"], (r1, r2))
        self.assertFalse(r1.get("changed"))
        self.assertEqual(r1["root_generation"], gen_before)
        self.assertEqual(lb._root_generation_baseline("racer"), gen_before,
                         "zapis tej samej sciezki nie moze podbic generacji")
        self.assertEqual(self.state_cfg.read_text(encoding="utf-8"), before_text,
                         "plik machine-config nie moze byc przepisany")
        reset_mem.assert_not_called()
        rw.assert_not_called()

    def test_case_and_trailing_separator_variants_are_same_path(self):
        gen_before = lb._root_generation_baseline("racer")
        res = lb.write_machine_config(str(self.old_root).upper() + "\\")
        self.assertTrue(res["ok"], res)
        self.assertEqual(res["root_generation"], gen_before)

    def test_real_switch_still_bumps_by_one(self):
        gen_before = lb._root_generation_baseline("racer")
        with mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}):
            there = lb.switch_root(str(_make_root(self.tmp, "Inny")), email="a@b.pl")
            again = lb.switch_root(str(self.tmp / "Inny"), email="a@b.pl")
            back = lb.switch_root(str(self.old_root), email="a@b.pl")
        self.assertEqual(there["root_generation"], gen_before + 1)
        self.assertTrue(there["changed"])
        self.assertEqual(again["root_generation"], gen_before + 1, "to samo drugi raz = bez podbicia")
        self.assertFalse(again["changed"])
        self.assertEqual(back["root_generation"], gen_before + 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
