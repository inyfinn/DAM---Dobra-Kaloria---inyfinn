# -*- coding: utf-8 -*-
"""Faza 3 (2026-09-27): miniatury na swiezym komputerze bez ROOT.

Uzytkownik: "Cache niby jest, ale dalej go nie ma - dziala dobrze tylko na komputerze,
na ktorym pracujemy." Przyczyny: (1) klucz miniatury zalezy od mtime oryginalu, a
komputer bez ROOT znal klucze tylko z pierwszego pobrania / 8000 wierszy bazy;
(2) brak pliku lokalnie = 404, choc NAS go ma; (3) publikacja z jednego PC nadpisywala
thumb-rel-index i manifest NAS swoim (mniejszym) widokiem; (4) uzupelnianie bez limitu
czasu na plik i bez pamieci porazek.
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

REL = "- POLSKA/01 - PRODUKTY/a.png"
MT = 1_700_000_000.0


class _Base(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        (self.root / "thumbs").mkdir()
        patches = [
            mock.patch.object(tc, "cache_root", return_value=self.root),
            mock.patch.object(tc.platform_compat, "user_state_dir", return_value=self.root / "state"),
            mock.patch.object(tc, "_marketing_cache_only", return_value=True),
            mock.patch.object(tc, "_store_meta"),
            mock.patch.object(tc, "_schedule_rel_save"),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        (self.root / "state").mkdir()
        for name, val in (("_REL_INDEX", None), ("_REMOTE_DIGESTS", {}), ("_ASSET_MT", {}), ("_ASSET_MT_KEY", {})):
            setattr(tc, name, val)
            self.addCleanup(setattr, tc, name, {} if name != "_REL_INDEX" else None)
        tc._REMOTE_MISS.clear()
        self.addCleanup(tc._REMOTE_MISS.clear)

    def _digest(self, prof="grid"):
        return tc._digest(REL, MT, prof)


class NoRootLookupTests(_Base):
    def test_klucz_z_mtime_w_bazie_trafia_lokalny_plik(self):
        d = self._digest()
        (self.root / "thumbs" / f"{d}.avif").write_bytes(b"AVIF")
        tc._ASSET_MT = {REL: MT}
        with mock.patch.object(tc, "_http_get_bytes") as http:
            code, body, ctype, meta = tc.get_or_build_thumb("X:/Marketing/" + REL, profile="grid")
        self.assertEqual(code, 200)
        self.assertEqual(body, b"AVIF")
        self.assertEqual(meta["digest"], d)
        http.assert_not_called()
        self.assertEqual(tc._load_rel_index()[f"{REL}|grid"]["digest"], d, "klucz ma trafic do indeksu")

    def test_brak_pliku_lokalnie_pobiera_jeden_z_nas(self):
        d = self._digest()
        tc._ASSET_MT = {REL: MT}
        tc._REMOTE_DIGESTS = {d: "avif"}
        with mock.patch.object(tc, "_http_get_bytes", return_value=b"NAS") as http:
            code, body, _ctype, meta = tc.get_or_build_thumb("D:/Marketing/" + REL, profile="grid")
        self.assertEqual(code, 200)
        self.assertEqual(body, b"NAS")
        self.assertEqual(meta["thumb_source"], "remote")
        self.assertEqual(http.call_count, 1)
        self.assertIn(f"/thumbs/{d}.avif", http.call_args[0][0])
        self.assertTrue((self.root / "thumbs" / f"{d}.avif").is_file(), "zapis w pamieci podrecznej")

    def test_digest_z_indeksu_nas_bez_bazy(self):
        tc._REL_INDEX = {f"{REL}|grid": {"digest": "abc123", "mtime": MT}}
        tc._REMOTE_DIGESTS = {"abc123": "jpg"}
        with mock.patch.object(tc, "_http_get_bytes", return_value=b"JPG") as http:
            code, _body, ctype, _meta = tc.get_or_build_thumb("X:/Marketing/" + REL, profile="grid")
        self.assertEqual(code, 200)
        self.assertEqual(ctype, "image/jpeg")
        self.assertIn("/thumbs/abc123.jpg", http.call_args[0][0])

    def test_bez_wczytanego_manifestu_nie_ma_ruchu_sieciowego(self):
        tc._ASSET_MT = {REL: MT}
        with mock.patch.object(tc, "_http_get_bytes") as http:
            code, *_ = tc.get_or_build_thumb("X:/Marketing/" + REL, profile="grid")
        self.assertEqual(code, 404)
        http.assert_not_called()

    def test_404_z_nas_zapamietany_na_chwile(self):
        tc._ASSET_MT = {REL: MT}
        tc._REMOTE_DIGESTS = {"inny": "avif"}  # wczytany, ale bez naszego digestu
        with mock.patch.object(tc, "_http_get_bytes", return_value=None) as http:
            tc.get_or_build_thumb("X:/Marketing/" + REL, profile="grid")
            n = http.call_count
            tc.get_or_build_thumb("X:/Marketing/" + REL, profile="grid")
        self.assertEqual(n, 2, "profil zadany: avif i jpg, profile zapasowe tylko z manifestu")
        self.assertEqual(http.call_count, n, "drugie zapytanie nie idzie do NAS")

    def test_profil_zapasowy_tylko_z_manifestu(self):
        dcard = self._digest("card")
        tc._ASSET_MT = {REL: MT}
        tc._REMOTE_DIGESTS = {dcard: "avif"}

        def fake(url, timeout=0):
            return b"CARD" if dcard in url else None

        with mock.patch.object(tc, "_http_get_bytes", side_effect=fake):
            code, body, _c, meta = tc.get_or_build_thumb("X:/Marketing/" + REL, profile="grid")
        self.assertEqual((code, body), (200, b"CARD"))
        self.assertEqual(meta.get("profile_fallback"), "card")
        self.assertEqual(tc._load_rel_index()[f"{REL}|card"]["digest"], dcard, "zapis pod profilem, ktory naprawde jest")

    def test_normalizacja_klucza_wielkosc_liter(self):
        d = self._digest()
        (self.root / "thumbs" / f"{d}.avif").write_bytes(b"A")
        tc._ASSET_MT = {REL: MT}
        tc._ASSET_MT_KEY = {tc._asset_key(REL): REL}
        code, *_ = tc.get_or_build_thumb("X:/Marketing/" + REL.upper(), profile="grid")
        self.assertEqual(code, 200)


class RemoteIndexRefreshTests(_Base):
    def _manifest(self, gen, rel_count=2):
        return {"generated_at": gen, "rel_count": rel_count, "files": [{"digest": "d1", "ext": "avif", "size": 5}]}

    def test_scala_gdy_nas_nowszy_i_pomija_gdy_ten_sam(self):
        merges = []

        def merge(src):
            merges.append(src)
            tc._load_rel_index().update({"a|grid": {"digest": "d1"}, "b|grid": {"digest": "d2"}})
            return 2

        with mock.patch.object(tc, "load_remote_manifest", return_value=(self._manifest("2026-09-27T10:00:00Z"), "https")), \
                mock.patch.object(tc, "_merge_rel_index_from_remote", side_effect=merge):
            r1 = tc.refresh_remote_index()
            r2 = tc.refresh_remote_index()
        self.assertTrue(r1["merged"])
        self.assertFalse(r2["merged"], "ten sam manifest i pelny indeks -> bez pobierania 8 MB")
        self.assertEqual(merges, ["https"])
        self.assertEqual(tc._REMOTE_DIGESTS, {"d1": "avif"})

    def test_mniejszy_lokalny_indeks_wymusza_scalenie(self):
        (self.root / "state" / tc.REMOTE_INDEX_MARKER).write_text(
            json.dumps({"generated_at": "2026-09-27T10:00:00Z"}), encoding="utf-8")
        with mock.patch.object(tc, "load_remote_manifest", return_value=(self._manifest("2026-09-27T10:00:00Z", 50), "https")), \
                mock.patch.object(tc, "_merge_rel_index_from_remote", return_value=50) as merge:
            r = tc.refresh_remote_index()
        self.assertTrue(r["merged"])
        merge.assert_called_once()

    def test_uszkodzony_lokalny_manifest_nie_blokuje(self):
        (self.root / "manifest.json").write_text("{zepsuty", encoding="utf-8")
        (self.root / "state" / tc.REMOTE_INDEX_MARKER).write_text("{zepsuty", encoding="utf-8")
        with mock.patch.object(tc, "load_remote_manifest", return_value=(self._manifest("2026-09-27T11:00:00Z"), "https")), \
                mock.patch.object(tc, "_merge_rel_index_from_remote", return_value=2) as merge:
            r = tc.refresh_remote_index()
        self.assertTrue(r["merged"])
        merge.assert_called_once()


class PublishIsUnionTests(_Base):
    def test_manifest_to_suma_nas_i_lokalnych(self):
        (self.root / "thumbs" / "lokalny.avif").write_bytes(b"x")
        m = tc.build_local_manifest(publisher="t", extra_files=[
            {"digest": "zdalny", "ext": "avif", "size": 9}, {"digest": "lokalny", "ext": "avif", "size": 1}])
        self.assertEqual(sorted(f["digest"] for f in m["files"]), ["lokalny", "zdalny"])
        self.assertEqual(m["thumb_count"], 2)

    def test_entries_bez_limitu_8000(self):
        tc._REL_INDEX = {f"r{i}|grid": {"digest": f"d{i}", "mtime": 1.0} for i in range(8100)}
        self.assertEqual(len(tc.build_local_manifest(publisher="t")["entries"]), 8100)

    def test_nieczytelny_indeks_nas_nie_nadpisuje_go(self):
        with mock.patch.object(tc, "_load_manifest_https", return_value=({"rel_count": 31935, "files": []}, "https")), \
                mock.patch.object(tc, "_merge_rel_index_from_remote", return_value=0):
            _names, _files, rel_ok = tc._remote_publish_state()
        self.assertFalse(rel_ok)

    def test_publikacja_przez_dysk_nie_kopiuje_indeksu_gdy_nas_nieczytelny(self):
        nas = self.root / "nas"
        nas.mkdir()
        (nas / "thumb-rel-index.json").write_text('{"x|grid": {"digest": "d"}}', encoding="utf-8")
        with mock.patch.object(tc, "nas_cache_path", return_value=nas), \
                mock.patch.object(tc, "_remote_publish_state", return_value=({}, [], False)), \
                mock.patch.object(tc, "_record_publish", return_value=(True, True)), \
                mock.patch.object(tc, "PUBLISH_QUEUE_FILE", self.root / "q.json"):
            res = tc.publish_new_thumbs(publisher="t")
        self.assertFalse(res["ok"])
        self.assertEqual((nas / "thumb-rel-index.json").read_text(encoding="utf-8"), '{"x|grid": {"digest": "d"}}')
        self.assertFalse((nas / "manifest.json").exists())

    def test_do_bazy_tylko_nowe_i_nowsze(self):
        entries = [
            {"rel_profile": "a|grid", "digest": "same", "mtime": 5},
            {"rel_profile": "b|grid", "digest": "nowy", "mtime": 9},
            {"rel_profile": "c|grid", "digest": "starszy", "mtime": 1},
            {"rel_profile": "d|grid", "digest": "brak", "mtime": 1},
        ]
        db = [
            {"store_key": "a|grid", "digest": "same", "mtime": 5},
            {"store_key": "b|grid", "digest": "stary", "mtime": 5},
            {"store_key": "c|grid", "digest": "nowszy", "mtime": 5},
        ]
        out = [e["rel_profile"] for e in tc._entries_newer_than_db(entries, db)]
        self.assertEqual(out, ["b|grid", "d|grid"])


class BackfillTests(_Base):
    def setUp(self):
        super().setUp()
        self.mk = self.root / "Marketing"
        (self.mk / "- POLSKA").mkdir(parents=True)
        from PIL import Image

        Image.new("RGB", (40, 30), (200, 10, 10)).save(self.mk / "- POLSKA" / "ok.png")
        (self.mk / "- POLSKA" / "zly.png").write_bytes(b"to nie png")
        mt_ok = (self.mk / "- POLSKA" / "ok.png").stat().st_mtime
        mt_bad = (self.mk / "- POLSKA" / "zly.png").stat().st_mtime
        self.assets = {"- POLSKA/ok.png": mt_ok, "- POLSKA/zly.png": mt_bad, "- POLSKA/wektor.svg": mt_ok}

        def fake_mtimes():
            tc._ASSET_MT = dict(self.assets)
            return {"ok": True}

        for p in (
            mock.patch.object(tc, "_fill_marketing_root", return_value=self.mk),
            mock.patch.object(tc, "refresh_remote_index", return_value={"ok": True}),
            mock.patch.object(tc, "refresh_asset_mtimes", side_effect=fake_mtimes),
            mock.patch.object(tc, "publish_new_thumbs", return_value={"ok": True, "copied": 1}),
            mock.patch.object(tc, "_is_online_only", return_value=False),
            mock.patch.object(tc, "_drive_letter_alive", return_value=True),
        ):
            p.start()
            self.addCleanup(p.stop)

    def test_buduje_zapamietuje_porazke_i_wznawia(self):
        r1 = tc.run_backfill(workers=1)
        self.assertEqual((r1["built"], r1["failed"], r1["batch"]), (1, 1, 2), r1)
        self.assertIn("- POLSKA/ok.png|grid", tc._load_rel_index())
        state = json.loads((self.root / "state" / tc.BACKFILL_STATE_NAME).read_text(encoding="utf-8"))
        self.assertIn("- POLSKA/zly.png", state["failed"])
        r2 = tc.run_backfill(workers=1)
        self.assertEqual(r2["batch"], 0, "zbudowany jest w indeksie, porazka nie wraca bez zmiany mtime")

    def test_twardy_limit_czasu_na_plik(self):
        def slow(*_a, **_k):
            time.sleep(3)
            return None, ""

        self.assets = {"- POLSKA/ok.png": self.assets["- POLSKA/ok.png"]}
        with mock.patch.object(tc, "_encode_thumb", side_effect=slow):
            t0 = time.monotonic()
            r = tc.run_backfill(workers=1, file_timeout_s=1.0)
        self.assertEqual(r["timeout"], 1)
        self.assertLess(time.monotonic() - t0, 2.5)

    def test_plik_juz_na_nas_to_tylko_klucz(self):
        d = tc._digest("- POLSKA/ok.png", self.assets["- POLSKA/ok.png"], "grid")
        tc._REMOTE_DIGESTS = {d: "avif"}
        self.assets = {"- POLSKA/ok.png": self.assets["- POLSKA/ok.png"]}
        with mock.patch.object(tc, "_encode_thumb") as enc:
            r = tc.run_backfill(workers=1)
        enc.assert_not_called()
        self.assertEqual((r["restored_keys"], r["batch"]), (1, 0))


if __name__ == "__main__":
    unittest.main()
