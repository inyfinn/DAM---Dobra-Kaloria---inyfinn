# -*- coding: utf-8 -*-
"""Etap 4 planu naprawy: preview_status.py (klasyfikacja stanu podgladu) i
integracja z dam_thumb_cache (record_preview_failure, flaga "stale" w
get_or_build_thumb). Wylacznie atrapy/fixture'y - bez PostgreSQL, bez sieci,
bez dysku poza tymczasowym katalogiem testu.
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
import preview_status as ps  # noqa: E402

SUPPORTED = tc.FILL_SUPPORTED_EXT


class ClassifyAssetTests(unittest.TestCase):
    def _asset(self, **kw) -> ps.AssetRow:
        base = dict(asset_id="a1", path_rel="- POLSKA/x/plik.png", mtime_ms=10_000, size=100, name="plik.png")
        base.update(kw)
        return ps.AssetRow(**base)

    def test_unsupported_wygrywa_przed_wszystkim_innym(self):
        """Rozszerzenie spoza listy = unsupported, nawet gdyby (nielogicznie)
        istnial wpis w indeksie i porazka dla tej samej wersji."""
        asset = self._asset(path_rel="- POLSKA/x/wykrojnik.ai", name="wykrojnik.ai", mtime_ms=5000)
        status = ps.classify_asset(
            asset, profile="grid",
            index_entry=ps.ThumbIndexEntry(digest="deadbeef", mtime=5.0),
            failure=ps.FailureRecord(mtime_ms=5000, reason="cokolwiek"),
            supported_extensions=SUPPORTED,
        )
        self.assertEqual(status.state, ps.STATE_UNSUPPORTED)
        self.assertIn(".ai", status.reason)

    def test_ready_gdy_wpis_rowny_biezacej_wersji(self):
        asset = self._asset(mtime_ms=10_000)  # 10.000 s w indeksie
        status = ps.classify_asset(
            asset, profile="grid",
            index_entry=ps.ThumbIndexEntry(digest="abc123", mtime=10.0),
            failure=None, supported_extensions=SUPPORTED,
        )
        self.assertEqual(status.state, ps.STATE_READY)
        self.assertEqual(status.digest, "abc123")

    def test_ready_gdy_wpis_nowszy_niz_wersja(self):
        asset = self._asset(mtime_ms=10_000)
        status = ps.classify_asset(
            asset, profile="grid",
            index_entry=ps.ThumbIndexEntry(digest="abc123", mtime=11.0),
            failure=None, supported_extensions=SUPPORTED,
        )
        self.assertEqual(status.state, ps.STATE_READY)

    def test_pending_gdy_wpis_starszy_niz_biezaca_wersja_pliku(self):
        """Plan etap 4 p.3: stary wpis w indeksie NIE moze udawac aktualnego."""
        asset = self._asset(mtime_ms=20_000)
        status = ps.classify_asset(
            asset, profile="grid",
            index_entry=ps.ThumbIndexEntry(digest="stary-digest", mtime=10.0),
            failure=None, supported_extensions=SUPPORTED,
        )
        self.assertEqual(status.state, ps.STATE_PENDING)
        self.assertIn("starszy", status.reason)

    def test_pending_gdy_brak_wpisu_i_brak_porazki(self):
        asset = self._asset()
        status = ps.classify_asset(
            asset, profile="grid", index_entry=None, failure=None,
            supported_extensions=SUPPORTED,
        )
        self.assertEqual(status.state, ps.STATE_PENDING)

    def test_failed_gdy_porazka_dla_tej_samej_wersji(self):
        asset = self._asset(mtime_ms=30_000)
        status = ps.classify_asset(
            asset, profile="grid", index_entry=None,
            failure=ps.FailureRecord(mtime_ms=30_000, reason="encode_failed"),
            supported_extensions=SUPPORTED,
        )
        self.assertEqual(status.state, ps.STATE_FAILED)
        self.assertEqual(status.reason, "encode_failed")

    def test_pending_gdy_porazka_dotyczy_innej_wersji(self):
        """Plik zmienil sie po nieudanej probie - nowa wersja jeszcze nie byla
        probowana, wiec to pending, nie wieczny failed starej wersji."""
        asset = self._asset(mtime_ms=40_000)
        status = ps.classify_asset(
            asset, profile="grid", index_entry=None,
            failure=ps.FailureRecord(mtime_ms=39_000, reason="encode_failed"),
            supported_extensions=SUPPORTED,
        )
        self.assertEqual(status.state, ps.STATE_PENDING)

    def test_failed_gdy_index_starszy_i_porazka_pasuje(self):
        """Wpis w indeksie jest (starsza wersja), ale ma nizszy priorytet niz
        rozpoznanie, ze BIEZACA wersja ma zapisana porazke."""
        asset = self._asset(mtime_ms=50_000)
        status = ps.classify_asset(
            asset, profile="grid",
            index_entry=ps.ThumbIndexEntry(digest="stary", mtime=10.0),
            failure=ps.FailureRecord(mtime_ms=50_000, reason="timeout"),
            supported_extensions=SUPPORTED,
        )
        self.assertEqual(status.state, ps.STATE_FAILED)


class AssetRowTests(unittest.TestCase):
    def test_extension_z_name_ma_pierwszenstwo(self):
        row = ps.AssetRow(asset_id="a", path_rel="x/y.tmp", mtime_ms=0, name="realny.png")
        self.assertEqual(row.extension, ".png")

    def test_extension_bez_name_z_path_rel(self):
        row = ps.AssetRow(asset_id="a", path_rel="x/y/plik.PSD", mtime_ms=0)
        self.assertEqual(row.extension, ".psd")

    def test_folder_korzen_i_zagniezdzony(self):
        self.assertEqual(ps.AssetRow(asset_id="a", path_rel="plik.png", mtime_ms=0).folder, "(korzen)")
        self.assertEqual(
            ps.AssetRow(asset_id="a", path_rel="- POLSKA/x/y/plik.png", mtime_ms=0).folder,
            "- POLSKA/x/y",
        )


class CoverageReportTests(unittest.TestCase):
    def test_liczniki_rozszerzenia_i_top_foldery(self):
        assets = [
            ps.AssetRow(asset_id="ready1", path_rel="f1/a.png", mtime_ms=100, name="a.png"),
            ps.AssetRow(asset_id="pending1", path_rel="f1/b.png", mtime_ms=100, name="b.png"),
            ps.AssetRow(asset_id="pending2", path_rel="f2/c.jpg", mtime_ms=100, name="c.jpg"),
            ps.AssetRow(asset_id="failed1", path_rel="f2/d.jpg", mtime_ms=100, name="d.jpg"),
            ps.AssetRow(asset_id="unsupported1", path_rel="f3/e.ai", mtime_ms=100, name="e.ai"),
        ]
        index_by_asset = {"ready1": ps.ThumbIndexEntry(digest="d1", mtime=1.0)}  # 1000 ms >= 100
        failures_by_asset = {"failed1": ps.FailureRecord(mtime_ms=100, reason="encode_failed")}
        report, statuses = ps.build_coverage_report(
            assets, profile="grid", index_by_asset=index_by_asset,
            failures_by_asset=failures_by_asset, supported_extensions=SUPPORTED,
        )
        self.assertEqual(report.total, 5)
        self.assertEqual(report.counts, {"ready": 1, "pending": 2, "failed": 1, "unsupported": 1})
        self.assertEqual(report.by_extension[".png"], {"ready": 1, "pending": 1})
        self.assertEqual(report.by_extension[".jpg"], {"pending": 1, "failed": 1})
        self.assertEqual(report.by_extension[".ai"], {"unsupported": 1})
        # top_missing_folders liczy tylko pending+failed: f2 ma 2, f1 ma 1, f3 (unsupported) 0
        folders = dict(report.top_missing_folders)
        self.assertEqual(folders.get("f2"), 2)
        self.assertEqual(folders.get("f1"), 1)
        self.assertNotIn("f3", folders)
        self.assertEqual(len(statuses), 5)
        d = report.to_dict()
        self.assertEqual(d["total"], 5)
        self.assertEqual(d["top_missing_folders"][0], {"folder": "f2", "count": 2})


class SupportedExtensionSourceOfTruthTests(unittest.TestCase):
    """dam_thumb_cache.FILL_SUPPORTED_EXT (dam_thumb_cache.py ok. linii 3253) jest
    jedynym zrodlem prawdy o formatach, ktore _encode_thumb faktycznie umie
    zbudowac (PIL + PDF przez pdftoppm). Ten test pilnuje, ze znane
    "niepodglądalne" formaty (SVG/AI/EPS) NIE wpadna tam kiedys przez pomylke,
    a znane rastrowe formaty tam sa - gdyby dam_thumb_cache.py sie zmienil bez
    zaktualizowania preview_status.py, ten test to wychwyci."""

    def test_svg_ai_eps_sa_niepodgladalne(self):
        for ext in (".svg", ".ai", ".eps"):
            self.assertFalse(ps.is_supported_extension(ext, SUPPORTED), ext)

    def test_typowe_rastry_i_pdf_sa_obslugiwane(self):
        for ext in (".png", ".jpg", ".jpeg", ".psd", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".avif", ".pdf"):
            self.assertTrue(ps.is_supported_extension(ext, SUPPORTED), ext)

    def test_is_supported_extension_przyjmuje_pelna_nazwe(self):
        self.assertTrue(ps.is_supported_extension("cokolwiek/plik.PNG", SUPPORTED))
        self.assertFalse(ps.is_supported_extension("cokolwiek/wykrojnik.AI", SUPPORTED))


class PreviewFailuresPersistenceTests(unittest.TestCase):
    """dam_thumb_cache.record_preview_failure / load_preview_failures: zapis w
    katalogu stanu (przekierowanym na tymczasowy folder testu), limit rozmiaru,
    normalizacja klucza asset_key."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.state_dir = Path(tmp.name)
        p = mock.patch.object(tc.platform_compat, "user_state_dir", return_value=self.state_dir)
        p.start()
        self.addCleanup(p.stop)

    def test_zapis_i_odczyt_roundtrip(self):
        tc.record_preview_failure("- polska/x/a.png", mtime_ms=12345, profile="grid", reason="encode_failed")
        entries = tc.load_preview_failures()
        self.assertIn("- polska/x/a.png|grid", entries)
        row = entries["- polska/x/a.png|grid"]
        self.assertEqual(row["mtime_ms"], 12345)
        self.assertEqual(row["reason"], "encode_failed")
        self.assertEqual(row["profile"], "grid")

    def test_nowszy_wpis_nadpisuje_ten_sam_klucz(self):
        tc.record_preview_failure("- polska/x/a.png", mtime_ms=1, profile="grid", reason="stary")
        tc.record_preview_failure("- polska/x/a.png", mtime_ms=2, profile="grid", reason="nowy")
        entries = tc.load_preview_failures()
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries["- polska/x/a.png|grid"]["mtime_ms"], 2)
        self.assertEqual(entries["- polska/x/a.png|grid"]["reason"], "nowy")

    def test_pusty_path_key_jest_ignorowany(self):
        tc.record_preview_failure("", mtime_ms=1, profile="grid", reason="x")
        self.assertEqual(tc.load_preview_failures(), {})

    def test_limit_wpisow_odrzuca_najstarsze(self):
        orig_cap = tc.PREVIEW_FAILURES_CAP
        tc.PREVIEW_FAILURES_CAP = 3
        self.addCleanup(setattr, tc, "PREVIEW_FAILURES_CAP", orig_cap)
        for i in range(5):
            tc.record_preview_failure(f"rel-{i}", mtime_ms=i, profile="grid", reason="x")
        entries = tc.load_preview_failures()
        self.assertEqual(len(entries), 3)
        # najnowsze 3 (rel-2, rel-3, rel-4) zostaja
        self.assertIn("rel-4|grid", entries)
        self.assertNotIn("rel-0|grid", entries)


class GetOrBuildThumbFailureRecordingTests(unittest.TestCase):
    """encode_failed w get_or_build_thumb (dam_thumb_cache.py) musi zostawic
    slad w preview-failures.json - to jest jedyne miejsce, gdzie synchroniczna
    proba budowy z oryginalu konczy sie porazka i user dostaje 422."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.cache_dir = Path(tmp.name) / "cache"
        self.state_dir = Path(tmp.name) / "state"
        p1 = mock.patch.object(tc, "cache_root", return_value=self.cache_dir)
        p1.start()
        self.addCleanup(p1.stop)
        p2 = mock.patch.object(tc.platform_compat, "user_state_dir", return_value=self.state_dir)
        p2.start()
        self.addCleanup(p2.stop)
        tc._REL_INDEX = None
        self.addCleanup(setattr, tc, "_REL_INDEX", None)
        (self.cache_dir / "thumbs").mkdir(parents=True, exist_ok=True)

        self.src = Path(tmp.name) / "zle.png"
        self.src.write_bytes(b"to nie jest prawdziwy PNG")  # PIL.Image.open() sie wywali

    def test_encode_failed_zapisuje_porazke(self):
        with mock.patch.object(tc, "_marketing_cache_only", return_value=False), \
             mock.patch.object(tc, "_drive_letter_alive", return_value=True), \
             mock.patch.object(tc, "_is_online_only", return_value=False):
            code, _body, _ctype, meta = tc.get_or_build_thumb(str(self.src), profile="grid")
        self.assertEqual(code, 422)
        self.assertEqual(meta.get("error"), "encode_failed")
        entries = tc.load_preview_failures()
        self.assertEqual(len(entries), 1)
        row = next(iter(entries.values()))
        self.assertEqual(row["reason"], "encode_failed")
        self.assertEqual(row["profile"], "grid")
        self.assertGreater(row["mtime_ms"], 0)


class StaleMetaFlagTests(unittest.TestCase):
    """Plan etap 4 p.3: cache-first w get_or_build_thumb serwuje natychmiast
    (celowo, bez stat() na dysku sieciowym - patrz komentarz przy wywolaniu),
    ale musi OZNACZYC odpowiedz jako stale, gdy dam_assets (w pamieci,
    _ASSET_MT) juz wie o nowszej wersji pliku niz ta zapisana w indeksie."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.cache_dir = Path(tmp.name)
        p1 = mock.patch.object(tc, "cache_root", return_value=self.cache_dir)
        p1.start()
        self.addCleanup(p1.stop)
        tc._REL_INDEX = None
        self.addCleanup(setattr, tc, "_REL_INDEX", None)
        (self.cache_dir / "thumbs").mkdir(parents=True, exist_ok=True)
        orig_mt, orig_key = dict(tc._ASSET_MT), dict(tc._ASSET_MT_KEY)
        self.addCleanup(lambda: (tc._ASSET_MT.clear(), tc._ASSET_MT.update(orig_mt)))
        self.addCleanup(lambda: (tc._ASSET_MT_KEY.clear(), tc._ASSET_MT_KEY.update(orig_key)))
        tc._ASSET_MT.clear()
        tc._ASSET_MT_KEY.clear()

    def _seed_index(self, rel: str, profile: str, digest: str, mtime: float) -> None:
        idx_path = self.cache_dir / "thumb-rel-index.json"
        data = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.is_file() else {}
        data[f"{rel}|{profile}"] = {"digest": digest, "mtime": mtime}
        idx_path.write_text(json.dumps(data), encoding="utf-8")
        (self.cache_dir / "thumbs" / f"{digest}.avif").write_bytes(b"fake-avif-bytes")

    def test_flaga_stale_gdy_baza_zna_nowsza_wersje(self):
        """W8 28.09.2026: stara wersja nie jest juz serwowana z flaga (zrzuty W7: B i C
        pokazywaly V1 dla V2) - 404 ze stanem pending, UI pokazuje "Podglad wkrotce".
        Pelny kontrakt: tests/test_thumb_catalog_version.py."""
        rel = "- polska/x/plik.png"
        self._seed_index(rel, "grid", "olddigest", mtime=100.0)
        tc._ASSET_MT[rel] = 200.0  # dam_assets zna nowsza wersje (200 s) niz indeks (100 s)
        with mock.patch.object(tc, "_marketing_cache_only", return_value=True), \
                mock.patch.object(tc, "_http_get_bytes", return_value=None):
            code, body, _ctype, meta = tc.get_or_build_thumb(f"D:/Marketing/{rel}", profile="grid")
        self.assertEqual(code, 404)
        self.assertNotEqual(body, b"fake-avif-bytes")
        self.assertTrue(meta.get("stale"))
        self.assertEqual(meta.get("state"), "pending")

    def test_brak_flagi_stale_gdy_wersje_sie_zgadzaja(self):
        rel = "- polska/x/plik2.png"
        self._seed_index(rel, "grid", "digest2", mtime=100.0)
        tc._ASSET_MT[rel] = 100.0
        with mock.patch.object(tc, "_marketing_cache_only", return_value=True):
            code, _body, _ctype, meta = tc.get_or_build_thumb(f"D:/Marketing/{rel}", profile="grid")
        self.assertEqual(code, 200)
        self.assertNotIn("stale", meta)

    def test_brak_flagi_gdy_wersja_asset_nieznana(self):
        rel = "- polska/x/plik3.png"
        self._seed_index(rel, "grid", "digest3", mtime=100.0)
        # _ASSET_MT pusty - dam_assets nigdy nie zostal odswiezony na tym komputerze
        with mock.patch.object(tc, "_marketing_cache_only", return_value=True):
            code, _body, _ctype, meta = tc.get_or_build_thumb(f"D:/Marketing/{rel}", profile="grid")
        self.assertEqual(code, 200)
        self.assertNotIn("stale", meta)


if __name__ == "__main__":
    unittest.main()
