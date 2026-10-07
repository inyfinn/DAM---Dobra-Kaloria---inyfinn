# -*- coding: utf-8 -*-
"""07.10.2026: POST /machine-config (i /user-device-paths biezacego urzadzenia) nie zapisuje
sciezki ROOT, ktorej folderu NA PEWNO nie ma. "Na pewno" = dysk odpowiada, kotwica sciezki
(korzen dysku / udzial / punkt montowania) istnieje, a folderu brak. Dysk, ktory nie
odpowiada albo ktorego nie widac, to "nie wiem" - zapis jak dotad.

Run: python tests/test_machine_config_missing_folder.py  (z bin/apps/desktop)
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
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import local_bridge as lb  # noqa: E402
from test_repro_5_root_switch_race import RootSwitchRaceBase, _make_root  # noqa: E402

MISSING = {"state": "none", "exists": False, "timeout": False, "missing": [], "root": ""}


class DefinitelyMissingRuleTests(unittest.TestCase):
    """Sama regula, bez dysku: sonda kotwicy podstawiona."""

    def _check(self, stored: str, *, anchor_exists: bool, anchor_timeout: bool = False,
               rs: dict | None = None) -> tuple[bool, list[str]]:
        probed: list[str] = []

        def fake_probe(path, timeout=None):
            probed.append(path)
            return {"ok": False, "exists": anchor_exists, "missing": [], "timeout": anchor_timeout}

        with mock.patch.object(lb, "_probe_root", side_effect=fake_probe):
            return lb._root_definitely_missing(stored, dict(rs or MISSING)), probed

    def test_folder_missing_on_live_drive_is_definite(self):
        got, probed = self._check("M:\\Markting", anchor_exists=True)
        self.assertTrue(got)
        self.assertEqual(probed, ["M:\\"])

    def test_drive_not_visible_is_unknown(self):
        self.assertFalse(self._check("X:\\Marketing", anchor_exists=False)[0])

    def test_drive_root_itself_is_unknown_without_probe(self):
        got, probed = self._check("M:\\", anchor_exists=True)
        self.assertFalse(got)
        self.assertEqual(probed, [])

    def test_hanging_drive_is_unknown(self):
        hanging = dict(MISSING, timeout=True)
        self.assertFalse(self._check("M:\\Marketing", anchor_exists=True, rs=hanging)[0])
        self.assertFalse(self._check("M:\\Marketing", anchor_exists=False, anchor_timeout=True)[0])

    def test_existing_folder_is_not_missing(self):
        self.assertFalse(self._check("M:\\Marketing", anchor_exists=True, rs=dict(MISSING, exists=True))[0])

    def test_unc_share_is_the_anchor(self):
        got, probed = self._check("\\\\nas\\udzial\\Marketing", anchor_exists=True)
        self.assertTrue(got)
        self.assertEqual(probed, ["\\\\nas\\udzial\\"])
        self.assertFalse(self._check("\\\\nas\\udzial", anchor_exists=True)[0])

    def test_posix_mount_point_is_the_anchor(self):
        got, probed = self._check("/Volumes/Marketing/- POLSKA", anchor_exists=True)
        self.assertTrue(got)
        self.assertEqual(probed, ["/Volumes/Marketing"])
        # Niezamontowany udzial na Macu = "nie wiem", nie "brak folderu".
        self.assertFalse(self._check("/Volumes/Marketing", anchor_exists=True)[0])
        self.assertFalse(self._check("/Volumes/Marketing/- POLSKA", anchor_exists=False)[0])


class HttpWritePathsRejectMissingFolderTests(RootSwitchRaceBase):
    def setUp(self):
        super().setUp()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), lb.Handler)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.port = self.httpd.server_address[1]
        self.session = mock.patch.object(lb.Handler, "_session_user",
                                         return_value={"email": "a@b.pl", "role": "user"})
        self.session.start()

    def tearDown(self):
        self.session.stop()
        self.httpd.shutdown()
        self.httpd.server_close()
        super().tearDown()

    def _post(self, path: str, body: dict) -> tuple[int, dict]:
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request("POST", path, body=json.dumps(body),
                     headers={"Content-Type": "application/json", "Origin": "http://127.0.0.1:8765"})
        r = conn.getresponse()
        data = json.loads(r.read().decode("utf-8"))
        conn.close()
        return r.status, data

    def test_machine_config_rejects_folder_that_is_not_there(self):
        before = self.state_cfg.read_text(encoding="utf-8")
        gen = lb._root_generation_baseline("racer")
        with mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}) as reset_mem:
            status, data = self._post("/machine-config", {"base_path": str(self.tmp / "NieMaTakiego")})
        self.assertEqual(status, 200, data)
        self.assertFalse(data["ok"], data)
        self.assertEqual(data["error"], "root_missing")
        self.assertTrue(data.get("hint"))
        self.assertEqual(self.state_cfg.read_text(encoding="utf-8"), before)
        self.assertEqual(lb._root_generation_baseline("racer"), gen)
        reset_mem.assert_not_called()
        lb.upsert_user_device_path.assert_not_called()

    def test_machine_config_still_saves_existing_folder(self):
        new_root = _make_root(self.tmp, "Jest")
        with mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}):
            status, data = self._post("/machine-config", {"base_path": str(new_root)})
        self.assertEqual(status, 200, data)
        self.assertTrue(data["ok"], data)
        self.assertEqual(self.cfg_entry()["base_path"], str(new_root))

    def test_machine_config_saves_when_drive_does_not_answer(self):
        """Dysk sieciowy chwilowo niedostepny: sonda wisi -> zapis jak przed zmiana."""
        target = str(self.tmp / "ChwilowoNiedostepny")
        hanging = {"state": "none", "exists": False, "timeout": True,
                   "missing": list(lb.REQUIRED_ROOT_FOLDERS), "root": lb._normalize_base_path(target)}
        with mock.patch.object(lb, "_root_state", return_value=hanging), \
                mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}):
            status, data = self._post("/machine-config", {"base_path": target})
        self.assertEqual(status, 200, data)
        self.assertTrue(data["ok"], data)
        self.assertEqual(self.cfg_entry()["base_path"], lb._normalize_base_path(target))

    def test_user_device_paths_current_device_rejects_missing_folder(self):
        before = self.state_cfg.read_text(encoding="utf-8")
        status, data = self._post("/user-device-paths", {
            "action": "upsert", "device_id": "dev-race", "hostname": "pc-race",
            "base_path": str(self.tmp / "NieMaTakiego")})
        self.assertEqual(status, 400, data)
        self.assertEqual(data["error"], "root_missing")
        self.assertEqual(self.state_cfg.read_text(encoding="utf-8"), before)
        lb.upsert_user_device_path.assert_not_called()

    def test_user_device_paths_other_device_is_not_probed(self):
        """Sciezka innego komputera: tego dysku tu nie ma i nie musi byc."""
        with mock.patch.object(lb, "_root_state") as probe:
            status, data = self._post("/user-device-paths", {
                "action": "upsert", "device_id": "dev-inny", "hostname": "pc-dom",
                "base_path": "X:\\Marketing"})
        self.assertEqual(status, 200, data)
        probe.assert_not_called()
        lb.upsert_user_device_path.assert_called_once()


if __name__ == "__main__":
    unittest.main(verbosity=2)
