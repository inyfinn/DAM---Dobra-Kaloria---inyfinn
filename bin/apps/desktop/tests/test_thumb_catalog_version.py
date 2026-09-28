# -*- coding: utf-8 -*-
"""W8 (28.09.2026), zrzuty W7: B i C pokazywaly miniature V1 (Ulotka Mus niebieska), choc
katalog mowil V2 (czerwona). Trzy przyczyny:

(a) publish_new_thumbs publikowal z KAZDEGO komputera z ROOT, takze z opoznionej kopii (B)
    - do centralnego magazynu i dam_thumb_cache_index trafialy miniatury V1;
(b) _backfill_jobs pomijal kazda sciezke, ktora ma JAKIKOLWIEK wpis w indeksie rel|profil
    - po zmianie wersji nikt nie budowal V2 (tylko rewalidacja przy ogladaniu na PC z ROOT);
(c) get_or_build_thumb serwowal wpis indeksu starszy niz wersja w katalogu (flaga stale
    tylko w meta), a profil zapasowy i kandydaci bez ROOT tez nie patrzyli na wersje.

Kontrakt: miniatura starsza niz wersja z katalogu (_ASSET_MT) nigdy nie jest serwowana jako
aktualna; zamiast niej wersja z katalogu (lokalnie albo z magazynu centralnego) albo 404
ze stanem "pending" (UI: "Podglad wkrotce"). Bez IO na oryginale w tej sciezce.
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import dam_thumb_cache as tc  # noqa: E402

REL = "- POLSKA/04 - MARKETING/Ulotka Mus.png"
V1 = 1_790_000_000.0
V2 = 1_790_604_010.0


class _Base(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        (self.root / "thumbs").mkdir()
        (self.root / "state").mkdir()
        self.cache_only = True
        patches = [
            mock.patch.object(tc, "cache_root", return_value=self.root),
            mock.patch.object(tc.platform_compat, "user_state_dir", return_value=self.root / "state"),
            mock.patch.object(tc, "_marketing_cache_only", side_effect=lambda: self.cache_only),
            mock.patch.object(tc, "_store_meta"),
            mock.patch.object(tc, "_schedule_rel_save"),
            mock.patch.object(tc, "_save_rel_index"),
            mock.patch.object(tc.threading, "Thread"),  # zadnej rewalidacji w tle w testach
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        for name, val in (("_REL_INDEX", None), ("_REMOTE_DIGESTS", {}), ("_ASSET_MT", {}), ("_ASSET_MT_KEY", {})):
            setattr(tc, name, val)
            self.addCleanup(setattr, tc, name, {} if name != "_REL_INDEX" else None)
        tc._REMOTE_MISS.clear()
        self.addCleanup(tc._REMOTE_MISS.clear)

    def _put(self, mt, prof="grid", body=b"V1"):
        d = tc._digest(REL, mt, prof)
        (self.root / "thumbs" / f"{d}.avif").write_bytes(body)
        return d

    def _index(self, mt, prof="grid"):
        d = tc._digest(REL, mt, prof)
        idx = tc._load_rel_index()
        idx[f"{REL}|{prof}"] = {"digest": d, "mtime": mt}
        return d


class StaleNeverServedTests(_Base):
    def test_old_version_is_not_served_when_catalog_is_newer(self):
        self._put(V1)
        self._index(V1)
        tc._ASSET_MT = {REL: V2}
        with mock.patch.object(tc, "_http_get_bytes", return_value=None):
            code, body, _ct, meta = tc.get_or_build_thumb("- " + REL[2:], profile="grid")
        self.assertNotEqual(body, b"V1", "stara wersja podana jako aktualna")
        self.assertEqual(code, 404)
        self.assertEqual(meta.get("state"), "pending")

    def test_catalog_version_served_when_present_locally(self):
        self._put(V1)
        self._index(V1)
        self._put(V2, body=b"V2")
        tc._ASSET_MT = {REL: V2}
        code, body, _ct, _meta = tc.get_or_build_thumb(REL, profile="grid")
        self.assertEqual((code, body), (200, b"V2"))

    def test_catalog_version_fetched_from_central_store(self):
        self._put(V1)
        self._index(V1)
        tc._ASSET_MT = {REL: V2}
        d2 = tc._digest(REL, V2, "grid")
        tc._REMOTE_DIGESTS = {d2: "avif"}
        with mock.patch.object(tc, "_http_get_bytes", return_value=b"V2-NAS"):
            code, body, _ct, _meta = tc.get_or_build_thumb(REL, profile="grid")
        self.assertEqual((code, body), (200, b"V2-NAS"))

    def test_same_version_still_served_from_cache(self):
        self._put(V2, body=b"V2")
        self._index(V2)
        tc._ASSET_MT = {REL: V2}
        code, body, _ct, meta = tc.get_or_build_thumb(REL, profile="grid")
        self.assertEqual((code, body), (200, b"V2"))
        self.assertTrue(meta.get("cache_hit"))

    def test_unknown_catalog_version_keeps_old_behaviour(self):
        self._put(V1)
        self._index(V1)
        code, body, _ct, _meta = tc.get_or_build_thumb(REL, profile="grid")
        self.assertEqual((code, body), (200, b"V1"))

    def test_profile_fallback_skips_outdated_version(self):
        self._put(V1, prof="card")
        self._index(V1, prof="card")
        tc._ASSET_MT = {REL: V2}
        with mock.patch.object(tc, "_http_get_bytes", return_value=None):
            code, body, _ct, _meta = tc.get_or_build_thumb(REL, profile="grid")
        self.assertNotEqual(body, b"V1")
        self.assertEqual(code, 404)

    def test_root_machine_with_outdated_local_copy_does_not_serve_it(self):
        """B: ROOT jest, ale plik na dysku to V1 (opozniona kopia). Bez stat na oryginale
        w sciezce cache - i nawet po nim: V1 nie jest serwowane jako aktualne."""
        self.cache_only = False
        self._put(V1)
        self._index(V1)
        tc._ASSET_MT = {REL: V2}
        with mock.patch.object(tc, "_http_get_bytes", return_value=None), \
                mock.patch.object(tc, "_mtime_quick", return_value=V1), \
                mock.patch.object(tc, "_drive_letter_alive", return_value=True):
            code, body, _ct, _meta = tc.get_or_build_thumb("D:/Marketing/" + REL, profile="grid")
        self.assertNotEqual(body, b"V1")


class PublishGateTests(_Base):
    def test_non_authority_does_not_publish(self):
        with mock.patch.object(tc, "_thumb_publish_authority", return_value=False), \
                mock.patch.object(tc, "_publish_new_thumbs_locked") as inner:
            res = tc.publish_new_thumbs()
        inner.assert_not_called()
        self.assertEqual(res.get("skipped"), "not_authority")

    def test_authority_and_no_list_publish(self):
        for decision in (True, None):
            with mock.patch.object(tc, "_thumb_publish_authority", return_value=decision), \
                    mock.patch.object(tc, "_publish_new_thumbs_locked", return_value={"ok": True}) as inner:
                tc.publish_new_thumbs()
            inner.assert_called_once()


class BackfillNewVersionTests(_Base):
    def test_outdated_index_entry_is_rebuilt_first(self):
        other = "- POLSKA/04 - MARKETING/Aaa nowy.png"
        tc._ASSET_MT = {REL: V2, other: V1}
        self._index(V1)  # stara wersja w indeksie
        with mock.patch.object(tc, "_find_pdftoppm", return_value="x"):
            jobs, _restored = tc._backfill_jobs("grid", {})
        self.assertIn(REL, jobs)
        self.assertEqual(jobs[0], REL, "nowa wersja przed brakami bez zadnej wersji")

    def test_current_index_entry_is_skipped(self):
        tc._ASSET_MT = {REL: V2}
        self._index(V2)
        with mock.patch.object(tc, "_find_pdftoppm", return_value="x"):
            jobs, _restored = tc._backfill_jobs("grid", {})
        self.assertNotIn(REL, jobs)


class CatalogChangedKickTests(_Base):
    def test_kick_refreshes_versions_and_backfills_only_on_authority(self):
        for decision, want_backfill in ((True, True), (False, False), (None, False)):
            with mock.patch.object(tc, "refresh_asset_mtimes", return_value={"ok": True}) as ram, \
                    mock.patch.object(tc, "merge_rel_index_from_db", return_value={"ok": True}) as merge, \
                    mock.patch.object(tc, "_thumb_publish_authority", return_value=decision), \
                    mock.patch.object(tc, "_fill_marketing_root", return_value=self.root), \
                    mock.patch.object(tc, "run_backfill", return_value={"ok": True}) as bf:
                tc._catalog_changed_once()
            ram.assert_called_once()
            merge.assert_called_once()
            self.assertEqual(bf.called, want_backfill, decision)


class RelKeyFromForeignRootTests(unittest.TestCase):
    """file-index z migawki wlasciciela niesie JEGO sciezki absolutne. Klucz miniatury
    (rel) musi byc ten sam niezaleznie od tego, jak nazywa sie ROOT wlasciciela."""

    def test_same_rel_for_any_root_layout(self):
        want = "- POLSKA/01 - PRODUKTY/a.png"
        for p in ("M:/- POLSKA/01 - PRODUKTY/a.png",
                  "X:/Marketing/- POLSKA/01 - PRODUKTY/a.png",
                  "D:\\DAM-lokalne\\testroots\\M\\- POLSKA\\01 - PRODUKTY\\a.png",
                  "E:/Projekty/DK/- POLSKA/01 - PRODUKTY/a.png",
                  "- POLSKA/01 - PRODUKTY/a.png",
                  "/- POLSKA/01 - PRODUKTY/a.png"):
            self.assertEqual(tc._rel_from_logical(p), want, p)
        self.assertEqual(tc._rel_from_logical("Z:/x/-- ARCHIWUM --/b.png"), "-- ARCHIWUM --/b.png")


class DbIndexLightCheckTests(unittest.TestCase):
    """Klient dociaga spis miniatur z bazy przy zmianie tabeli (co DB_INDEX_LIGHT_S),
    nie dopiero po DB_INDEX_REFRESH_S = 600 s."""

    def test_changed_signature_triggers_merge_before_refresh_interval(self):
        tc._DB_INDEX_THREAD = None
        self.addCleanup(setattr, tc, "_DB_INDEX_THREAD", None)
        calls: list[str] = []
        sleeps: list[float] = []
        sigs = iter([(1, "a"), (2, "b")])

        def fake_sleep(s):
            sleeps.append(s)
            if len(sleeps) >= 3:
                raise SystemExit

        patches = [
            mock.patch.object(tc, "merge_rel_index_from_db", side_effect=lambda: calls.append("merge") or {"ok": True}),
            mock.patch.object(tc, "_fetch_missing_index_files", return_value={"ok": True}),
            mock.patch.object(tc, "start_cache_download", return_value={"ok": True}),
            mock.patch.object(tc, "_thumb_index_signature", side_effect=lambda: next(sigs)),
            mock.patch.object(tc.time, "sleep", side_effect=fake_sleep),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        tc.start_db_index_watch()
        tc._DB_INDEX_THREAD.join(timeout=5)
        # start (merge), 1. odcisk (1,"a") != None -> merge, 2. odcisk (2,"b") zmiana -> merge
        self.assertEqual(calls, ["merge", "merge", "merge"])
        self.assertTrue(all(s <= 60 for s in sleeps), sleeps)


if __name__ == "__main__":
    unittest.main()
