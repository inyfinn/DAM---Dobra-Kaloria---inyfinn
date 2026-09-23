# -*- coding: utf-8 -*-
"""Pliki w tle (BRIEF-235 diagnoza E): klient ma sam dociagac miniatury bez restartu.

Bylo: watek start_db_index_watch co 10 min dociagal z bazy SAM SPIS (klucz -> digest),
ale nigdy pliki digest.avif/.jpg - komputer bez folderu Marketing widzial nowy klucz
w indeksie, ale nadal serwowal 404, dopoki ktos recznie nie zrestartowal mostu.
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

import dam_thumb_cache as tc  # noqa: E402


class FetchMissingIndexFilesTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        p1 = mock.patch.object(tc, "cache_root", return_value=self.root)
        p1.start()
        self.addCleanup(p1.stop)
        tc._REL_INDEX = None
        self.addCleanup(setattr, tc, "_REL_INDEX", None)
        (self.root / "thumbs").mkdir(parents=True, exist_ok=True)
        # SYNC_STATUS_FILE jest stala policzona przy imporcie (LOCALAPPDATA) - nie
        # wolno w niej pisac podczas testow. Podmien na plik w tempdir.
        p2 = mock.patch.object(tc, "SYNC_STATUS_FILE", self.root / "state" / "cache-sync-status.json")
        p2.start()
        self.addCleanup(p2.stop)

    def test_pobiera_tylko_brakujace_najpierw_avif_potem_jpg(self):
        have = "a" * 64
        avif_ok = "b" * 64
        jpg_fallback = "c" * 64
        fail = "d" * 64
        # `have` jest juz lokalnie -> nie wolno go pobierac ponownie.
        (self.root / "thumbs" / f"{have}.avif").write_bytes(b"local")
        (self.root / "thumb-rel-index.json").write_text(
            json.dumps(
                {
                    "a.png|grid": {"digest": have, "mtime": 1.0},
                    "b.png|grid": {"digest": avif_ok, "mtime": 1.0},
                    "c.png|grid": {"digest": jpg_fallback, "mtime": 1.0},
                    "d.png|grid": {"digest": fail, "mtime": 1.0},
                }
            ),
            encoding="utf-8",
        )

        calls: list[tuple[str, str, str]] = []

        def fake_fetch(digest: str, ext: str, source: str):
            calls.append((digest, ext, source))
            if digest == have:
                raise AssertionError("juz jest lokalnie - nie wolno pobierac ponownie")
            if digest == avif_ok:
                return b"avif-bytes" if ext == "avif" else None
            if digest == jpg_fallback:
                return None if ext == "avif" else b"jpg-bytes"
            return None  # fail: zawsze pusto

        with mock.patch.object(tc, "_fetch_remote_thumb", side_effect=fake_fetch):
            res = tc._fetch_missing_index_files()

        self.assertEqual(res["pending"], 3)
        self.assertEqual(res["copied"], 2)
        self.assertEqual(res["failed"], 1)
        self.assertTrue((self.root / "thumbs" / f"{avif_ok}.avif").is_file())
        self.assertTrue((self.root / "thumbs" / f"{jpg_fallback}.jpg").is_file())
        self.assertFalse((self.root / "thumbs" / f"{fail}.avif").is_file())
        self.assertFalse((self.root / "thumbs" / f"{fail}.jpg").is_file())
        for digest in (avif_ok, jpg_fallback, fail):
            exts = [ext for d, ext, _src in calls if d == digest]
            self.assertEqual(exts[0], "avif", "avif zawsze probowany przed jpg")

    def test_bez_brakujacych_nic_nie_pobiera(self):
        digest = "e" * 64
        (self.root / "thumbs" / f"{digest}.avif").write_bytes(b"local")
        (self.root / "thumb-rel-index.json").write_text(
            json.dumps({"e.png|grid": {"digest": digest, "mtime": 1.0}}), encoding="utf-8"
        )
        with mock.patch.object(tc, "_fetch_remote_thumb") as fake:
            res = tc._fetch_missing_index_files()
        fake.assert_not_called()
        self.assertEqual(res, {"ok": True, "pending": 0, "copied": 0, "failed": 0})

    def test_bledy_nie_sa_chowane_trafiaja_do_sync_status(self):
        fail = "f" * 64
        (self.root / "thumb-rel-index.json").write_text(
            json.dumps({"f.png|grid": {"digest": fail, "mtime": 1.0}}), encoding="utf-8"
        )
        with mock.patch.object(tc, "_fetch_remote_thumb", return_value=None):
            tc._fetch_missing_index_files()
        status = tc.sync_status()
        self.assertEqual(status.get("bg_missing_pending"), 1)
        self.assertEqual(status.get("bg_missing_failed"), 1)
        self.assertIn("1", status.get("error", ""))


class DbIndexWatchLoopWiringTests(unittest.TestCase):
    """Diagnoza E: jeden watek robi spis (merge) + pliki (fetch) + manifest NAS (cache
    download), pierwsza petla od razu przy starcie - nie trzeci osobny watek."""

    def test_start_db_index_watch_woła_wszystkie_trzy_kroki(self):
        tc._DB_INDEX_THREAD = None
        self.addCleanup(setattr, tc, "_DB_INDEX_THREAD", None)
        calls: list[str] = []

        def fake_merge():
            calls.append("merge")
            return {"ok": True}

        def fake_fetch():
            calls.append("fetch")
            return {"ok": True, "pending": 0}

        def fake_download(force=False):
            calls.append("download")
            return {"ok": True}

        def fake_sleep(_s):
            # SystemExit w watku konczy go po cichu (threading.excepthook ignoruje SystemExit) -
            # jedna iteracja wystarcza do sprawdzenia kolejnosci krokow.
            raise SystemExit

        p1 = mock.patch.object(tc, "merge_rel_index_from_db", side_effect=fake_merge)
        p2 = mock.patch.object(tc, "_fetch_missing_index_files", side_effect=fake_fetch)
        p3 = mock.patch.object(tc, "start_cache_download", side_effect=fake_download)
        p4 = mock.patch.object(tc.time, "sleep", side_effect=fake_sleep)
        for p in (p1, p2, p3, p4):
            p.start()
            self.addCleanup(p.stop)

        res = tc.start_db_index_watch()
        self.assertTrue(res.get("started"))
        tc._DB_INDEX_THREAD.join(timeout=5)
        self.assertFalse(tc._DB_INDEX_THREAD.is_alive(), "watek mial sie zatrzymac po pierwszej iteracji")
        self.assertEqual(calls, ["merge", "fetch", "download"])


if __name__ == "__main__":
    unittest.main()
