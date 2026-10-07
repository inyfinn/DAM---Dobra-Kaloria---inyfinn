# -*- coding: utf-8 -*-
"""Pamiec sondy tla (branding-background-scan.json): klucz bez litery dysku, stare wpisy,
zapis wyniku sondy, brak zapisu przy bledzie odczytu, pamiec regul roli."""
from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parents[1]
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import asset_role_utils as aru  # noqa: E402

# PNG z samym naglowkiem IHDR (typ 6 = RGBA) / IHDR (typ 2 = RGB) + IDAT: tyle czyta _png_header_has_alpha
_SIG = b"\x89PNG\r\n\x1a\n"


def _ihdr(color_type: int) -> bytes:
    return (13).to_bytes(4, "big") + b"IHDR" + bytes(9) + bytes([color_type]) + bytes(3) + bytes(4)


PNG_ALPHA = _SIG + _ihdr(6)
PNG_OPAQUE = _SIG + _ihdr(2) + (0).to_bytes(4, "big") + b"IDAT" + bytes(4)


def _load_build():
    spec = importlib.util.spec_from_file_location("bbi_test_bg_cache", SCRIPTS / "build-branding-index.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class KeyTest(unittest.TestCase):
    def test_same_key_for_any_drive_and_marketing_prefix(self):
        keys = {
            aru._scan_cache_key(p)
            for p in (
                "X:/Marketing/- POLSKA/a.png",
                "M:/- POLSKA/a.png",
                "D:\\Marketing\\- POLSKA\\a.png",
                "x:/marketing/- polska/a.png",  # stary klucz z pliku pamieci
            )
        }
        self.assertEqual(keys, {"- polska/a.png"})


class CacheTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        p = mock.patch.object(aru, "BACKGROUND_SCAN_CACHE", self.tmp / "scan.json")
        p.start()
        self.addCleanup(p.stop)

    def _probe_stub(self, result):
        calls = []

        def _stub(path, **_kw):
            calls.append(path)
            return result

        return mock.patch.object(aru, "_probe_alpha", _stub), calls

    def test_old_entry_hits_without_rebuilding_file(self):
        (self.tmp / "scan.json").write_text(
            json.dumps({"version": 1, "results": {"x:/marketing/- polska/a.png": "transparent"}}), encoding="utf-8"
        )
        cache = aru.load_background_scan_cache()
        patcher, calls = self._probe_stub(False)
        with patcher:
            bg, new = aru.probe_background_cached(cache, "M:/- POLSKA/a.png", "a.png", "1|2")
        self.assertEqual((bg, new, calls), ("transparent", False, []))

    def test_old_none_is_reprobed_not_trusted(self):
        # dawna sonda zapisywala blad odczytu jako none (8 z 86 starych none to blad: pliki sa przezroczyste)
        cache = {"- polska/a.png": "none"}
        patcher, calls = self._probe_stub(True)
        with patcher:
            bg, new = aru.probe_background_cached(cache, "M:/- POLSKA/a.png", "a.png", "1|2")
        self.assertEqual((bg, new, len(calls), cache), ("transparent", True, 1, {"- polska/a.png": "transparent@1|2"}))

    def test_probe_result_saved_and_read_next_run(self):
        cache = aru.load_background_scan_cache()
        patcher, calls = self._probe_stub(True)
        with patcher:
            bg, new = aru.probe_background_cached(cache, "M:/- POLSKA/a.png", "a.png", "10|20")
        self.assertEqual((bg, new, len(calls)), ("transparent", True, 1))
        aru.save_background_scan_cache(cache)

        cache2 = aru.load_background_scan_cache()  # kolejny bieg
        patcher, calls = self._probe_stub(False)
        with patcher:
            self.assertEqual(aru.probe_background_cached(cache2, "D:/Marketing/- POLSKA/a.png", "a.png", "10|20"), ("transparent", False))
            self.assertEqual(calls, [])
            # plik podmieniony (inny mtime/rozmiar): stary wynik nie obowiazuje, sonda idzie jeszcze raz
            self.assertEqual(aru.probe_background_cached(cache2, "M:/- POLSKA/a.png", "a.png", "11|20"), (None, True))
            self.assertEqual(len(calls), 1)

    def test_opaque_result_cached_as_none(self):
        cache = {}
        patcher, calls = self._probe_stub(False)
        with patcher:
            self.assertEqual(aru.probe_background_cached(cache, "M:/- POLSKA/b.png", "b.png", "1|1"), (None, True))
            self.assertEqual(aru.probe_background_cached(cache, "M:/- POLSKA/b.png", "b.png", "1|1"), (None, False))
        self.assertEqual((len(calls), cache), (1, {"- polska/b.png": "none@1|1"}))

    def test_read_error_not_saved(self):
        cache = {}
        patcher, calls = self._probe_stub(None)  # None = nie dalo sie przeczytac
        with patcher:
            self.assertEqual(aru.probe_background_cached(cache, "M:/- POLSKA/c.png", "c.png", "1|1"), (None, False))
        self.assertEqual((len(calls), cache), (1, {}))

    def test_real_probe_distinguishes_opaque_from_unreadable(self):
        alpha, opaque = self.tmp / "alpha.png", self.tmp / "opaque.png"
        alpha.write_bytes(PNG_ALPHA)
        opaque.write_bytes(PNG_OPAQUE)
        self.assertEqual(aru.probe_raster_background(str(alpha), "alpha.png"), "transparent")
        self.assertEqual(aru.probe_raster_background(str(opaque), "opaque.png"), "none")
        self.assertIsNone(aru.probe_raster_background(str(self.tmp / "brak.png"), "brak.png"))
        self.assertIsNone(aru.detect_raster_background(str(opaque), "opaque.png"))  # wynik jak dawniej


class BuildIntegrationTest(unittest.TestCase):
    def test_make_asset_second_run_does_not_probe(self):
        tmp = Path(tempfile.mkdtemp())
        with mock.patch.object(aru, "BACKGROUND_SCAN_CACHE", tmp / "scan.json"):
            mod = _load_build()
            mod._BG_SCAN_CACHE.clear()
            mod._BG_UNSAVED = 0
            fp = tmp / "- POLSKA" / "06 - STRONY WWW - INTERNET" / "slider.png"
            fp.parent.mkdir(parents=True)
            fp.write_bytes(PNG_ALPHA)
            probes = []
            real = aru._probe_alpha

            def counting(path, **kw):
                probes.append(path)
                return real(path, **kw)

            with mock.patch.object(aru, "_probe_alpha", counting):
                a1 = mod.make_asset(1, fp, "DK", tmp, source="marketing")
                self.assertEqual((a1["background"], len(probes), mod._BG_UNSAVED), ("transparent", 1, 1))
                mod.persist_background_cache()
                self.assertEqual(mod._BG_UNSAVED, 0)

                mod._BG_SCAN_CACHE.clear()
                mod._BG_SCAN_CACHE.update(aru.load_background_scan_cache())  # kolejny bieg
                a2 = mod.make_asset(1, fp, "DK", tmp, source="marketing")
                self.assertEqual((a2["background"], len(probes), mod._BG_UNSAVED), ("transparent", 1, 0))

    def test_unreadable_file_not_saved(self):
        tmp = Path(tempfile.mkdtemp())
        with mock.patch.object(aru, "BACKGROUND_SCAN_CACHE", tmp / "scan.json"):
            mod = _load_build()
            mod._BG_SCAN_CACHE.clear()
            mod._BG_UNSAVED = 0
            fp = tmp / "- POLSKA" / "06 - STRONY WWW - INTERNET" / "x.png"
            fp.parent.mkdir(parents=True)
            fp.write_bytes(PNG_ALPHA)
            with mock.patch.object(aru, "_probe_alpha", lambda *_a, **_k: None):
                a = mod.make_asset(1, fp, "DK", tmp, source="marketing")
            self.assertEqual((a["background"], mod._BG_SCAN_CACHE, mod._BG_UNSAVED), (None, {}, 0))


class FlushAndPatchPathTest(unittest.TestCase):
    def test_flush_every_n_new_results(self):
        tmp = Path(tempfile.mkdtemp())
        with mock.patch.object(aru, "BACKGROUND_SCAN_CACHE", tmp / "scan.json"):
            mod = _load_build()
            mod._BG_SCAN_CACHE.clear()
            mod._BG_UNSAVED = 0
            with mock.patch.object(mod, "_BG_FLUSH_EVERY", 2):
                mod._BG_SCAN_CACHE["- polska/a.png"] = "transparent@1|1"
                mod._bg_result_added()
                self.assertFalse((tmp / "scan.json").exists())
                mod._bg_result_added()
            self.assertEqual(list(aru.load_background_scan_cache()), ["- polska/a.png"])
            self.assertEqual(mod._BG_UNSAVED, 0)

    def test_enrich_raster_backgrounds_skips_unreadable(self):
        tmp = Path(tempfile.mkdtemp())
        ok, bad = tmp / "ok.png", tmp / "bad.png"
        ok.write_bytes(PNG_ALPHA)
        assets = [
            {"path": str(ok), "name": "ok.png", "media_type": "image"},
            {"path": str(bad), "name": "bad.png", "media_type": "image"},  # pliku nie ma
        ]
        cache: dict[str, str] = {}
        aru.enrich_raster_backgrounds(assets, scan_cache=cache)
        self.assertEqual(assets[0].get("background"), "transparent")
        self.assertEqual(list(cache.values()), ["transparent"])  # blad odczytu nie trafil do pamieci


try:
    import PIL.Image as _PILImage
except ImportError:  # pragma: no cover
    _PILImage = None


class TiffLayersCacheTest(unittest.TestCase):
    def _stub(self, result):
        calls = []

        def _s(path):
            calls.append(path)
            return result

        return mock.patch.object(aru, "_probe_tiff_layers", _s), calls

    def test_three_states_layers_flat_unreadable(self):
        cache = {}
        for result, expect_has, expect_cache in ((True, True, "layers@1|1"), (False, False, "flat@1|1"), (None, False, None)):
            cache.clear()
            patcher, calls = self._stub(result)
            with patcher:
                has, new = aru.tiff_layers_cached(cache, "M:/- POLSKA/p/a.tif", "1|1")
            self.assertEqual((has, len(calls)), (expect_has, 1))
            self.assertEqual(cache.get("tiff:- polska/p/a.tif"), expect_cache)  # blad/timeout: bez wpisu
            self.assertEqual(new, expect_cache is not None)

    def test_second_run_from_cache_and_changed_file_reprobed(self):
        cache = {"tiff:- polska/p/a.tif": "layers@5|9"}
        patcher, calls = self._stub(False)
        with patcher:
            self.assertEqual(aru.tiff_layers_cached(cache, "D:/Marketing/- POLSKA/p/a.tif", "5|9"), (True, False))
            self.assertEqual(calls, [])
            self.assertEqual(aru.tiff_layers_cached(cache, "M:/- POLSKA/p/a.tif", "6|9"), (False, True))  # plik podmieniony
            self.assertEqual(len(calls), 1)

    def test_tiff_keys_survive_load_and_make_asset_uses_cache(self):
        tmp = Path(tempfile.mkdtemp())
        with mock.patch.object(aru, "BACKGROUND_SCAN_CACHE", tmp / "scan.json"):
            aru.save_background_scan_cache({"tiff:- polska/p/a.tif": "flat@1|2", "x:/marketing/- polska/b.png": "none"})
            self.assertEqual(
                aru.load_background_scan_cache(), {"tiff:- polska/p/a.tif": "flat@1|2", "- polska/b.png": "none"}
            )
            mod = _load_build()
            mod._BG_SCAN_CACHE.clear()
            mod._BG_UNSAVED = 0
            fp = tmp / "- POLSKA" / "01 - PRODUKTY" / "links" / "a.tif"
            fp.parent.mkdir(parents=True)
            fp.write_bytes(b"II*\x00")
            calls = []
            with mock.patch.object(aru, "_probe_tiff_layers", lambda path: calls.append(path) or True):
                a1 = mod.make_asset(1, fp, "DK", tmp, source="product_element")
                self.assertEqual((a1["format_technical"], len(calls), mod._BG_UNSAVED), (["raster", "editable"], 1, 1))
                a2 = mod.make_asset(1, fp, "DK", tmp, source="product_element")  # ten sam plik: z pamieci
                self.assertEqual((a2["format_technical"], len(calls), mod._BG_UNSAVED), (["raster", "editable"], 1, 1))

    @unittest.skipUnless(_PILImage is not None, "brak PIL")
    def test_real_probe_flat_multiframe_missing(self):
        tmp = Path(tempfile.mkdtemp())
        flat, multi = tmp / "flat.tif", tmp / "multi.tif"
        a = _PILImage.new("RGB", (4, 4), (255, 0, 0))
        a.save(flat)
        a.save(multi, save_all=True, append_images=[_PILImage.new("RGB", (4, 4), (0, 255, 0))])
        self.assertIs(aru._probe_tiff_layers(str(flat)), False)
        self.assertIs(aru._probe_tiff_layers(str(multi)), True)
        junk = tmp / "junk.tif"
        junk.write_bytes(b"to nie jest TIFF")
        self.assertIs(aru._probe_tiff_layers(str(junk)), False)  # nierozpoznawalny plik: wynik staly, nie "blad odczytu"
        self.assertIsNone(aru._probe_tiff_layers(str(tmp / "brak.tif")))
        self.assertIs(aru._tiff_has_layers(str(tmp / "brak.tif")), False)  # wynik jak dotad


class NormCacheTest(unittest.TestCase):
    def test_cached_norm_same_as_plain(self):
        for s in ("", "- POLSKA/\u2014 Zażółć gęślą jaźń", "  A   B ", "M:/- POLSKA/06 - STRONY WWW/SLIDERY/x.png"):
            self.assertEqual(aru.norm(s), aru.norm.__wrapped__(s))
            self.assertEqual(aru.norm(s), aru.norm(s))


class OrphanLimitTest(unittest.TestCase):
    def test_no_new_probe_when_four_timed_out_reads_still_run(self):
        release = threading.Event()
        started = []

        def hang():
            started.append(1)
            release.wait(10)
            return "ok"

        with mock.patch.object(aru, "_ORPHANS", 0):
            for _ in range(aru.MAX_ORPHAN_PROBES):
                self.assertEqual(aru._run_with_timeout(hang, timeout=0.05, default="DEF"), "DEF")
            self.assertEqual(aru._ORPHANS, aru.MAX_ORPHAN_PROBES)
            before = len(started)
            self.assertEqual(aru._run_with_timeout(hang, timeout=0.05, default="DEF"), "DEF")
            self.assertEqual(len(started), before)  # piaty odczyt w ogole nie wystartowal
            release.set()
            for _ in range(100):  # osierocone watki koncza i zwalniaja miejsca
                if aru._ORPHANS == 0:
                    break
                time.sleep(0.02)
            self.assertEqual(aru._ORPHANS, 0)
            self.assertEqual(aru._run_with_timeout(lambda: "fresh", timeout=1, default="DEF"), "fresh")


class RulesCacheTest(unittest.TestCase):
    def test_rules_cached_and_refreshed_on_mtime(self):
        tmp = Path(tempfile.mkdtemp())
        f = tmp / "rules.json"
        f.write_text(json.dumps({"rules": [{"asset_role": "a"}]}), encoding="utf-8")
        os.utime(f, ns=(1_000_000_000, 1_000_000_000))
        with mock.patch.object(aru, "MAPPING_FILE", f), mock.patch.object(aru, "_RULES_CACHE", None):
            self.assertEqual(aru._load_rules(), [{"asset_role": "a"}])
            f.write_text(json.dumps({"rules": [{"asset_role": "b"}]}), encoding="utf-8")
            os.utime(f, ns=(1_000_000_000, 1_000_000_000))  # ta sama data: z pamieci, bez czytania
            self.assertEqual(aru._load_rules(), [{"asset_role": "a"}])
            os.utime(f, ns=(2_000_000_000, 2_000_000_000))  # zmiana daty: odswiezenie
            self.assertEqual(aru._load_rules(), [{"asset_role": "b"}])

    def test_missing_rules_file_gives_empty_list(self):
        with mock.patch.object(aru, "MAPPING_FILE", Path(tempfile.mkdtemp()) / "nie-ma.json"):
            self.assertEqual(aru._load_rules(), [])


if __name__ == "__main__":
    unittest.main()
