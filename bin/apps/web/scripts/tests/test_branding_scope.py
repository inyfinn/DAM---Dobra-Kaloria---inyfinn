# -*- coding: utf-8 -*-
"""Wspolna regula wykluczen katalogow technicznych (branding_scope.py): tabela przypadkow, skan, siatka, wyszukiwarka,
live-www-scan. Te same przypadki sprawdza lustro w JS (test_branding_scope_parity.js)."""
from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parents[1]
DESKTOP = SCRIPTS.parents[1] / "desktop"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import branding_scope as bs  # noqa: E402
from scan_walker import walk_files  # noqa: E402

CASES = json.loads((Path(__file__).parent / "branding_scope_cases.json").read_text(encoding="utf-8"))["cases"]
TREE_CASES = json.loads((Path(__file__).parent / "presentation_tree_cases.json").read_text(encoding="utf-8"))["cases"]
POLSKA = "- POLSKA/02 - FIRMOWE MATERIAŁY/PREZENTACJE"
SZABLON = "— SZABLON AI - skrypt"


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class RuleTableTest(unittest.TestCase):
    def test_all_cases(self):
        for c in CASES:
            with self.subTest(path=c["path"], note=c.get("note")):
                self.assertEqual(bs.is_excluded_path(c["path"]), c["excluded"])

    def test_none_is_not_excluded(self):
        self.assertFalse(bs.is_excluded_path(None))

    def test_whole_program_folder_is_excluded_but_sibling_presentations_stay(self):
        pres = f"{POLSKA}"
        self.assertTrue(bs.is_excluded_path(f"{pres}/{SZABLON}/DK - szablon prezentacji.pptx"))
        self.assertTrue(bs.is_excluded_path(f"{pres}/{SZABLON}"))
        self.assertFalse(bs.is_excluded_path(f"{pres}/DK - szablon prezentacji.pptx"))
        self.assertFalse(bs.is_excluded_path(f"{pres}/DATESY/DOBRA KALORIA - DATESY.pptx"))

    def test_same_verdict_for_every_drive_letter(self):
        tail = f"{POLSKA}/{SZABLON}/WORK/poprzednie/x.png"
        for prefix in ("X:/Marketing/", "M:/", "D:\\Marketing\\", "//nas/share/Marketing/", "/Volumes/M/"):
            self.assertTrue(bs.is_excluded_path(prefix + tail.replace("/", os.sep if "\\" in prefix else "/")), prefix)


class PresentationTreeTest(unittest.TestCase):
    """Wspolna tabela z lustrem JS (test_branding_presentations.js): kiedy plik lezy w firmowym drzewie PREZENTACJE."""

    def test_all_cases(self):
        for c in TREE_CASES:
            with self.subTest(path=c["path"], note=c.get("note")):
                self.assertEqual(bs.is_presentation_tree_path(c["path"]), c["in_tree"])

    def test_none_is_not_in_tree(self):
        self.assertFalse(bs.is_presentation_tree_path(None))


class ScanTreeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        pres = self.tmp / "- POLSKA" / "02 - FIRMOWE MATERIAŁY" / "PREZENTACJE"
        self.keep = pres / "24.09.2026 - KULKI z kreatyną" / "Elementy" / "arbuz.png"
        self.dropped = [
            pres / SZABLON / "WORK" / "poprzednie" / "v1" / "apple.png",
            pres / SZABLON / "pliki programu" / "app" / "apple.png",
            pres / SZABLON / "szablon.png",
            pres / SZABLON / "DK - szablon prezentacji.pptx",
            pres / "06.10.2026 - strategia" / "_robocze" / "qa" / "s1.png",
        ]
        for p in [self.keep, *self.dropped]:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b"x")
        self.root = self.tmp / "- POLSKA" / "02 - FIRMOWE MATERIAŁY"

    def test_walk_prunes_excluded_dirs_and_reports_them_as_failed(self):
        files, scanned, failed = walk_files(self.root, exclude_dir=bs.is_excluded_dir)
        names = {p.name for p in files}
        self.assertEqual(names, {"arbuz.png"})
        # pominiete foldery trafiaja do failed_dirs: wiersze pod nimi NIE dostana znacznika usuniecia;
        # folder programu jest odcinany od razu (bez schodzenia do WORK / pliki programu)
        self.assertTrue(any(k.endswith("szablon ai - skrypt") for k in failed), failed)
        self.assertFalse(any(k.endswith("/work") for k in failed), failed)
        self.assertTrue(any(k.endswith("/_robocze") for k in failed), failed)
        self.assertTrue(all(bs.is_excluded_path(k) for k in failed))
        self.assertFalse(any(bs.is_excluded_path(k) for k in scanned))

    def test_make_asset_and_search_index_skip_excluded(self):
        mod = _load("bbi_scope_test", SCRIPTS / "build-branding-index.py")
        for p in self.dropped:
            self.assertIsNone(mod.make_asset(1, p, "DK", self.tmp, source="marketing"))
        kept = mod.make_asset(1, self.keep, "DK", self.tmp, source="marketing")
        self.assertIsNotNone(kept)
        bad = {"id": "br-1", "path": str(self.dropped[0]).replace("\\", "/"), "name": "apple.png", "tags": [], "search_blob": "apple"}
        idx = mod.build_search_index([kept, bad])
        self.assertEqual([e["id"] for e in idx["entries"]], [kept["id"]])

    def test_full_scan_marks_excluded_dirs_but_stays_complete(self):
        mod = _load("bbi_scope_test2", SCRIPTS / "build-branding-index.py")
        mod._walk(self.root)
        self.assertTrue(mod._EXCLUDED_DIRS)
        self.assertEqual(mod._FAILED_DIRS - mod._EXCLUDED_DIRS, set())  # "complete" = brak prawdziwych bledow


class PresentationScanTest(unittest.TestCase):
    """Skan bierze pliki prezentacji (.pptx .ppt .key .odp) TYLKO w drzewie PREZENTACJE, jako media_type document."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.mod = _load("bbi_pres_test", SCRIPTS / "build-branding-index.py")
        pres = self.tmp / "- POLSKA" / "02 - FIRMOWE MATERIAŁY" / "PREZENTACJE"
        self.in_tree = [pres / "DATESY" / "DOBRA KALORIA - DATESY.pptx", pres / "onlien.pptx", pres / "DATESY" / "stara.ppt",
                        pres / "A" / "wersja.key", pres / "A" / "wersja.odp"]
        self.outside = [self.tmp / "- POLSKA" / "08 - KAMAPANIE" / "2026" / "prezentacja.pptx",
                        self.tmp / "-- ARCHIWUM --" / "99_Inne" / "SOLAR" / "Prezentacje" / "stara.pptx"]
        self.dropped = [pres / "06.10.2026 - strategia" / "_robocze" / "szkic.pptx", pres / SZABLON / "DK - szablon prezentacji.pptx",
                        pres / "DATESY" / "~$DOBRA KALORIA - DATESY.pptx", pres / "DATESY" / "._slajd.png"]
        for p in [*self.in_tree, *self.outside, *self.dropped]:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b"x")

    def test_media_type_is_document(self):
        for ext in (".pptx", ".ppt", ".key", ".odp"):
            self.assertEqual(self.mod.media_type_for(ext), "document", ext)

    def test_presentations_in_tree_are_indexed_as_documents(self):
        for p in self.in_tree:
            row = self.mod.make_asset(1, p, "DK", self.tmp, source="marketing")
            self.assertIsNotNone(row, p.name)
            self.assertEqual(row["media_type"], "document")
            self.assertEqual(row["name"], p.name)
            self.assertTrue(row["mtime_ms"])

    def test_presentations_outside_tree_and_in_technical_dirs_are_not_indexed(self):
        for p in [*self.outside, *self.dropped]:
            self.assertIsNone(self.mod.make_asset(1, p, "DK", self.tmp, source="marketing"), str(p))

    def test_other_extensions_unchanged(self):
        docx = self.tmp / "- POLSKA" / "08 - KAMAPANIE" / "x.docx"
        txt = self.tmp / "- POLSKA" / "02 - FIRMOWE MATERIAŁY" / "PREZENTACJE" / "DATESY" / "notatki.txt"
        for p in (docx, txt):
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b"x")
        self.assertIsNotNone(self.mod.make_asset(1, docx, "DK", self.tmp, source="marketing"))
        self.assertIsNone(self.mod.make_asset(1, txt, "DK", self.tmp, source="marketing"))


class LiveWwwScanTest(unittest.TestCase):
    def test_live_scan_skips_robocze_and_technical_dirs(self):
        sys.path.insert(0, str(DESKTOP))
        try:
            import branding_asset_routes as bar
        finally:
            sys.path.remove(str(DESKTOP))
        tmp = Path(tempfile.mkdtemp())
        ok = tmp / "slider" / "nowy.png"
        bad = tmp / "slider" / "_robocze" / "szkic.png"
        for p in (ok, bad):
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b"x")
            os.utime(p, (time.time(), time.time()))
        with mock.patch.object(bar, "_www_scan_roots", lambda: [tmp]):
            names = [a["name"] for a in bar._live_www_scan(28)]
        self.assertEqual(names, ["nowy.png"])


class RowsStayTest(unittest.TestCase):
    """Wiersze, ktore juz sa w bazie pod katalogami technicznymi, NIE dostaja znacznika usuniecia: katalog jest w
    failed_dirs ("nie wiemy, co tam jest"), a nie "wylistowany i pusty"."""

    def _report(self, failed):
        sys.path.insert(0, str(DESKTOP))
        try:
            import asset_sync
        finally:
            sys.path.remove(str(DESKTOP))
        parent = "- polska/02 - firmowe materiały/prezentacje/— szablon ai - skrypt"
        key = parent + "/work/poprzednie/v1/apple.png"
        rows = {"br-1": {"asset_id": "br-1", "asset_key": key, "path_rel": key, "name": "apple.png", "mtime_ms": 100,
                         "size": 5, "deleted_at": None, "rev": 1, "meta": {}}}
        seen = {"br-1": {"mtime_ms": 100, "size": 5, "hash": None, "root_gen": "g", "desc": "x", "rev": 1}}
        listed = ["", "- polska", "- polska/02 - firmowe materiały", "- polska/02 - firmowe materiały/prezentacje", parent]
        return asset_sync.diff_scan_report(rows, {}, listed, 10**13, "TEST", last_seen=seen, failed_dirs=failed, root_gen="g")

    def test_excluded_dir_in_failed_dirs_keeps_rows(self):
        parent = "- polska/02 - firmowe materiały/prezentacje/— szablon ai - skrypt"
        rep = self._report([parent + "/work"])
        self.assertEqual(rep["ops"], [])
        self.assertEqual(rep["skipped_unlisted"], 1)

    def test_control_without_failed_dirs_would_tombstone(self):
        rep = self._report([])
        self.assertEqual([op["op"] for op in rep["ops"]], ["tombstone"])


@unittest.skipUnless(importlib.util.find_spec("ijson"), "brak ijson")
class GridBuilderTest(unittest.TestCase):
    def test_grid_skips_excluded_rows(self):
        tmp = Path(tempfile.mkdtemp())
        pres = "M:/- POLSKA/02 - FIRMOWE MATERIAŁY/PREZENTACJE"
        assets = [
            {"id": "br-001", "path": f"{pres}/24.09.2026 - KULKI z kreatyną/Elementy/arbuz.png", "name": "arbuz.png", "media_type": "image", "asset_role": "brand_asset", "mtime_ms": 5},
            {"id": "br-002", "path": f"{pres}/{SZABLON}/WORK/poprzednie/v1/apple.png", "name": "apple.png", "media_type": "image", "asset_role": "brand_asset", "mtime_ms": 6},
            {"id": "br-003", "path": f"{pres}/06.10.2026 - strategia/_robocze/s1.png", "name": "s1.png", "media_type": "image", "asset_role": "brand_asset", "mtime_ms": 7},
            {"id": "br-004", "path": f"{pres}/06.10.2026 - strategia/DK_co_dalej_update.pptx", "name": "DK_co_dalej_update.pptx", "media_type": "document", "mtime_ms": 8},
            {"id": "br-005", "path": f"{pres}/{SZABLON}/DK - szablon prezentacji.pptx", "name": "DK - szablon prezentacji.pptx", "media_type": "document", "mtime_ms": 9},
        ]
        src = tmp / "branding-index.json"
        src.write_text(json.dumps({"version": 1, "source": "rows", "assets": assets}, ensure_ascii=False), encoding="utf-8")
        out = tmp / "branding-grid-index.json"
        import subprocess

        rc = subprocess.call([sys.executable, str(SCRIPTS / "build-branding-grid-index.py"), "--src", str(src), "--out", str(out)])
        self.assertIn(rc, (0, 3))
        got = json.loads(out.read_text(encoding="utf-8"))
        self.assertEqual([a["id"] for a in got["assets"]], ["br-001", "br-004"])
        pptx = [a for a in got["assets"] if a["id"] == "br-004"][0]
        self.assertEqual((pptx["media_type"], pptx["mtime_ms"]), ("document", 8))


if __name__ == "__main__":
    unittest.main()
