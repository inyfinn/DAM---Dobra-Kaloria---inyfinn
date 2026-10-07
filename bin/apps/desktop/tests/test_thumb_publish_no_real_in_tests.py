# -*- coding: utf-8 -*-
"""Pod unittest publikacja miniatur nie moze dotknac PRAWDZIWEGO magazynu (W: / SSH / Postgres).

07.10.2026: test petli watch-file-index.py doszedl do dam_thumb_cache.start_publish_after_index()
bez atrapy. Watek publikacji zalozyl <repo>/bin/PAMIEC-PODRECZNA/thumbs i zaczal odpytywac NAS;
proces testow skonczyl sie przed zapisem. Bezpiecznik mial tylko _thumb_publish_authority().
"""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import dam_thumb_cache as tc  # noqa: E402

BLOCKED = {"DAM_ALLOW_REAL_SPAWN_IN_TESTS": ""}
ALLOWED = {"DAM_ALLOW_REAL_SPAWN_IN_TESTS": "1"}


class StartPublishAfterIndexTests(unittest.TestCase):
    def test_bez_zgody_nie_startuje_watku_publikacji(self):
        with mock.patch.dict(os.environ, BLOCKED), \
                mock.patch.object(tc, "publish_new_thumbs") as publish, \
                mock.patch.object(tc.threading, "Thread") as thread:
            res = tc.start_publish_after_index()
        self.assertEqual(res, {"ok": True, "skipped": "unittest"})
        thread.assert_not_called()
        publish.assert_not_called()

    def test_ze_zgoda_startuje_jak_w_programie(self):
        with mock.patch.dict(os.environ, ALLOWED), \
                mock.patch.object(tc, "publish_new_thumbs") as publish, \
                mock.patch.object(tc.threading, "Thread") as thread:
            tc.start_publish_after_index()
            thread.assert_called_once()
            thread.call_args.kwargs["target"]()      # cialo watku
        publish.assert_called_once()


class PublishLockedTests(unittest.TestCase):
    def setUp(self):
        td = tempfile.TemporaryDirectory()
        self.addCleanup(td.cleanup)
        self.root = Path(td.name)
        (self.root / "thumbs").mkdir()

    def test_prawdziwy_magazyn_bez_zgody_jest_pomijany_zanim_cokolwiek_ruszy(self):
        with mock.patch.dict(os.environ, {**BLOCKED, "DAM_NAS_CACHE_PATH": ""}), \
                mock.patch.object(tc, "cache_root") as cache_root, \
                mock.patch.object(tc, "_nas_dir_writable") as writable, \
                mock.patch.object(tc, "_publish_via_ssh") as ssh, \
                mock.patch.object(tc, "_remote_publish_state") as remote, \
                mock.patch.object(tc, "_record_publish") as record:
            self.assertEqual(tc.nas_cache_path(), tc.NAS_CACHE_PATH_DEFAULT)
            res = tc._publish_new_thumbs_locked(publisher="t")
        self.assertEqual(res, {"ok": True, "skipped": "unittest"})
        for touched in (cache_root, writable, ssh, remote, record):
            touched.assert_not_called()              # ani katalogu lokalnego, ani W:, ani SSH, ani bazy

    def test_magazyn_podstawiony_przez_test_dziala_bez_zgody(self):
        """Testy z wlasnym katalogiem magazynu (test_thumb_noroot_remote) maja dzialac jak dotad."""
        nas = self.root / "nas"
        with mock.patch.dict(os.environ, BLOCKED), \
                mock.patch.object(tc, "cache_root", return_value=self.root), \
                mock.patch.object(tc, "nas_cache_path", return_value=nas), \
                mock.patch.object(tc, "_remote_publish_state", return_value=({}, [], False)), \
                mock.patch.object(tc, "_record_publish", return_value=(True, True)) as record, \
                mock.patch.object(tc, "PUBLISH_QUEUE_FILE", self.root / "q.json"):
            res = tc._publish_new_thumbs_locked(publisher="t")
        self.assertNotEqual(res.get("skipped"), "unittest")   # "skipped" bywa tez licznikiem
        record.assert_called_once()

    def test_prawdziwy_magazyn_ze_zgoda_nie_jest_pomijany(self):
        with mock.patch.dict(os.environ, {**ALLOWED, "DAM_NAS_CACHE_PATH": ""}), \
                mock.patch.object(tc, "cache_root", return_value=self.root), \
                mock.patch.object(tc, "_nas_dir_writable", return_value=False), \
                mock.patch.object(tc, "_publish_via_ssh", return_value={"ok": False, "error": "atrapa"}) as ssh, \
                mock.patch.object(tc, "_queue_publish"):
            res = tc._publish_new_thumbs_locked(publisher="t")
        ssh.assert_called_once()
        self.assertNotEqual(res.get("skipped"), "unittest")   # "skipped" bywa tez licznikiem


if __name__ == "__main__":
    unittest.main()
