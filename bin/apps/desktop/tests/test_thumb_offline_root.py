# -*- coding: utf-8 -*-
"""Miniatury bez folderu Marketing: szybko i z indeksu w bazie.

22.09.2026 (uzytkownik): "pamiec podreczna za dlugo sie laduje, dopiero po 5 sekundach
cos widac. I stare materialy zamiast nowych - jakby to, co pokazywane, nie zalezalo od
bazy danych i indeksu w bazie, tylko od stanu plikow na ROOT."

Przyczyny: (1) os.path.isdir("X:\\") na odlaczonym dysku czekal na timeout SMB przy
kazdej miniaturze; (2) baza miala spis miniatur (dam_thumb_cache_index), ktorego nikt
nie czytal - bez folderu brakujace wpisy w lokalnym indeksie = pusty kafelek.
"""
from __future__ import annotations

import json
import sys
import tempfile
import time
import types
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import dam_thumb_cache as tc  # noqa: E402


class DriveProbeTests(unittest.TestCase):
    def setUp(self):
        tc._DRIVE_ALIVE.clear()
        self.addCleanup(tc._DRIVE_ALIVE.clear)

    def test_zawieszony_dysk_nie_blokuje(self):
        def hang(_p):
            time.sleep(3)
            return True

        with mock.patch.object(tc.os.path, "isdir", side_effect=hang):
            t0 = time.monotonic()
            alive = tc._drive_letter_alive(r"Q:\Marketing\a.png")
            first = time.monotonic() - t0
            t1 = time.monotonic()
            alive2 = tc._drive_letter_alive(r"Q:\Marketing\b.png")
            second = time.monotonic() - t1
        self.assertFalse(alive)
        self.assertLess(first, 0.5)
        self.assertFalse(alive2)
        self.assertLess(second, 0.02, "drugi odczyt ma isc z pamieci, bez sondy")

    def test_zywy_dysk(self):
        with mock.patch.object(tc.os.path, "isdir", return_value=True):
            self.assertTrue(tc._drive_letter_alive(r"R:\x.png"))

    def test_sciezka_bez_litery(self):
        self.assertTrue(tc._drive_letter_alive("/Volumes/Marketing/x.png"))


class DbIndexMergeTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        p1 = mock.patch.object(tc, "cache_root", return_value=self.root)
        p2 = mock.patch.object(tc.platform_compat, "user_state_dir", return_value=self.root / "state")
        for p in (p1, p2):
            p.start()
            self.addCleanup(p.stop)
        tc._REL_INDEX = None
        self.addCleanup(setattr, tc, "_REL_INDEX", None)
        (self.root / "thumb-rel-index.json").write_text(json.dumps({
            "stare/a.png|grid": {"digest": "aaa", "mtime": 100.0},
            "stare/b.png|grid": {"digest": "bbb", "mtime": 500.0},
        }), encoding="utf-8")

    def _fake_pg(self, rows):
        calls = []

        def fetch(since=None):
            calls.append(since)
            return [r for r in rows if not since or r["published_at"] > since]

        return types.SimpleNamespace(fetch_thumb_cache_rows=fetch), calls

    def test_dodaje_nowe_i_aktualizuje_nowsze(self):
        rows = [
            {"store_key": "nowe/c.png|grid", "digest": "ccc", "mtime": 10.0, "published_at": "2026-09-22T17:06:08Z"},
            {"store_key": "stare/a.png|grid", "digest": "a2", "mtime": 200.0, "published_at": "2026-09-22T17:06:08Z"},
            {"store_key": "stare/b.png|grid", "digest": "b-starszy", "mtime": 10.0, "published_at": "2026-09-22T17:06:08Z"},
        ]
        fake, calls = self._fake_pg(rows)
        with mock.patch.dict(sys.modules, {"pg_db": fake}):
            res = tc.merge_rel_index_from_db()
        self.assertTrue(res["ok"])
        self.assertEqual((res["added"], res["updated"]), (1, 1))
        idx = json.loads((self.root / "thumb-rel-index.json").read_text(encoding="utf-8"))
        self.assertEqual(idx["nowe/c.png|grid"]["digest"], "ccc")
        self.assertEqual(idx["stare/a.png|grid"]["digest"], "a2")
        self.assertEqual(idx["stare/b.png|grid"]["digest"], "bbb", "starszy wpis z bazy nie nadpisuje nowszego")

    def test_drugie_pobranie_jest_przyrostowe(self):
        rows = [{"store_key": "x.png|grid", "digest": "x", "mtime": 1.0, "published_at": "2026-09-22T17:06:08Z"}]
        fake, calls = self._fake_pg(rows)
        with mock.patch.dict(sys.modules, {"pg_db": fake}):
            tc.merge_rel_index_from_db()
            res = tc.merge_rel_index_from_db()
        self.assertEqual(calls, [None, "2026-09-22T17:06:08Z"])
        self.assertEqual(res["rows"], 0)

    def test_lookup_trafia_po_scaleniu_bez_dysku(self):
        digest = "d" * 64
        avif, _jpg = tc._cache_paths(digest)
        avif.parent.mkdir(parents=True, exist_ok=True)
        avif.write_bytes(b"\x00\x00\x00 ftypavif")
        rows = [{"store_key": "- POLSKA/nowy.png|grid", "digest": digest, "mtime": 1.0, "published_at": "2026-09-22T17:00:00Z"}]
        fake, _ = self._fake_pg(rows)
        with mock.patch.dict(sys.modules, {"pg_db": fake}):
            tc.merge_rel_index_from_db()
        hit, ctype, got = tc._lookup_by_rel("- POLSKA/nowy.png", "grid")
        self.assertEqual(got, digest)
        self.assertEqual(ctype, "image/avif")
        self.assertIsNotNone(hit)


if __name__ == "__main__":
    unittest.main()
