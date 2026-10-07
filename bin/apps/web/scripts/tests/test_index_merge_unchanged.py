# -*- coding: utf-8 -*-
"""Przyrost (--only-product --merge-into), ktory niczego nie zmienil, NIE zapisuje spisu.

07.10.2026: kazdy przyrost zapisywal file-index.json i search-index.json z nowym "generated_at".
Publikacja migawek porownuje sha256 calego pliku (index_snapshots.publish_changed), wiec przeglad godzinny
i kazdy falszywy alarm obserwatora rozsylaly caly spis do wszystkich komputerow mimo braku zmian.
"""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

# DAM_BUILDER_UNDER_TEST: kopia indeksera (dowod "test pada na starym kodzie" bez podmiany prawdziwego pliku)
_SPEC = importlib.util.spec_from_file_location(
    "build_file_index_merge_unchanged",
    os.environ.get("DAM_BUILDER_UNDER_TEST") or (Path(__file__).resolve().parents[1] / "build-file-index.py"))
bfi = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(bfi)

OLD = 1_780_000_000.0


def _viz(root: Path, cat: str, prod: str, name: str = "") -> Path:
    return root / cat / prod / "DOY - X - 6300901.00" / "4 - WIZKI" / "INTERNET-RGB" / (name or f"{prod}-FRONT-S.png")


def _sig(path: Path) -> tuple[str, int]:
    return hashlib.sha256(path.read_bytes()).hexdigest(), path.stat().st_mtime_ns


class MergeUnchangedTests(unittest.TestCase):
    def setUp(self):
        td = tempfile.TemporaryDirectory()
        self.addCleanup(td.cleanup)
        self.tmp = Path(td.name)
        self.root = self.tmp / "DK"
        self.out = self.tmp / "out"
        for cat, prod in (("01 - BATONY", "A"), ("01 - BATONY", "B"), ("02 - KULKI", "C")):
            f = _viz(self.root, cat, prod)
            f.parent.mkdir(parents=True)
            f.write_bytes(b"x")
            os.utime(f, (OLD, OLD))
        self.fi, self.si = self.out / "file-index.json", self.out / "search-index.json"
        self.prod_a = str(self.root / "01 - BATONY" / "A")
        # bez spaceru po prawdziwym folderze Marketing (atrapa bywa zakladana pod D:\\Marketing\\...)
        patches = [mock.patch.object(bfi, "marketing_root_for", return_value=self.tmp / "brak-marketingu"),
                   mock.patch.object(bfi, "_LIVE_PATH", self.tmp / "index-live.json")]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        # main() przestawia OUT / SEARCH_OUT / THUMBS_DIR modulu (--out-dir) - po tescie wracaja
        saved = (bfi.OUT, bfi.SEARCH_OUT, bfi.THUMBS_DIR)
        self.addCleanup(lambda: [setattr(bfi, k, v) for k, v in zip(("OUT", "SEARCH_OUT", "THUMBS_DIR"), saved)])
        self.assertIn("Wrote", self._run())           # pelny skan atrapy = baza scalania
        self.assertTrue(self.fi.is_file() and self.si.is_file())

    def _run(self, *only: str) -> str:
        argv = ["--root", str(self.root), "--out-dir", str(self.out)]
        for prod in only:
            argv += ["--only-product", prod]
        if only:
            argv += ["--merge-into", str(self.fi)]
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            bfi.main(argv)                            # kod 0 = zwykly powrot (bez SystemExit)
        return buf.getvalue()

    def _leftovers(self) -> list[str]:
        return sorted(p.name for p in self.out.iterdir() if ".tmp" in p.name)

    def test_przyrost_bez_zmian_nie_dotyka_plikow_spisu(self):
        before = (_sig(self.fi), _sig(self.si))
        stamp = json.loads(self.fi.read_text(encoding="utf-8"))["generated_at"]
        time.sleep(1.1)                               # generated_at ma dokladnosc sekundy: ma byc INNY niz w spisie
        out = self._run(self.prod_a)
        self.assertIn("MERGE_UNCHANGED", out)
        self.assertNotIn("Wrote", out)
        self.assertEqual((_sig(self.fi), _sig(self.si)), before)      # ten sam skrot i ta sama data pliku
        self.assertEqual(json.loads(self.fi.read_text(encoding="utf-8"))["generated_at"], stamp)
        self.assertEqual(self._leftovers(), [])                       # pliki robocze posprzatane
        self.assertEqual((bfi.OUT, bfi.SEARCH_OUT), (self.fi, self.si))

    def test_caly_przeglad_wszystkich_produktow_bez_zmian_tez_nic_nie_zapisuje(self):
        before = (_sig(self.fi), _sig(self.si))
        time.sleep(1.1)
        prods = [str(p) for cat in sorted(self.root.iterdir()) for p in sorted(cat.iterdir())]
        self.assertEqual(len(prods), 3)
        self.assertIn("MERGE_UNCHANGED", self._run(*prods))
        self.assertEqual((_sig(self.fi), _sig(self.si)), before)

    def test_przyrost_ze_zmiana_zapisuje_jak_dotad(self):
        before = (_sig(self.fi), _sig(self.si))
        stamp = json.loads(self.fi.read_text(encoding="utf-8"))["generated_at"]
        time.sleep(1.1)
        new = _viz(self.root, "01 - BATONY", "A", "A-BACK-S.png")
        new.write_bytes(b"nowy plik")
        out = self._run(self.prod_a)
        self.assertNotIn("MERGE_UNCHANGED", out)
        self.assertIn(f"Wrote {self.fi}", out)
        self.assertNotEqual(_sig(self.fi)[0], before[0][0])
        self.assertNotEqual(_sig(self.si)[1], before[1][1])           # oba pliki z jednego biegu
        doc = json.loads(self.fi.read_text(encoding="utf-8"))
        self.assertNotEqual(doc["generated_at"], stamp)
        self.assertEqual(json.loads(self.si.read_text(encoding="utf-8"))["generated_at"], doc["generated_at"])
        self.assertIn("A-BACK-S.png", self.fi.read_text(encoding="utf-8"))
        self.assertEqual(doc["product_count"], 3)
        self.assertEqual(self._leftovers(), [])
        # i znow bez zmian: stan po zapisie jest stabilny
        after = (_sig(self.fi), _sig(self.si))
        self.assertIn("MERGE_UNCHANGED", self._run(self.prod_a))
        self.assertEqual((_sig(self.fi), _sig(self.si)), after)

    def test_usuniety_produkt_to_zmiana_a_nie_brak_zmian(self):
        gone = self.root / "02 - KULKI" / "C"
        os.replace(gone, self.tmp / "poza-rootem-C")
        out = self._run(str(gone))
        self.assertNotIn("MERGE_UNCHANGED", out)
        self.assertEqual(json.loads(self.fi.read_text(encoding="utf-8"))["product_count"], 2)

    def test_porownanie_pomija_tylko_pola_czasu(self):
        a, b = self.tmp / "a.json", self.tmp / "b.json"
        a.write_text(json.dumps({"generated_at": "1", "elapsed_sec": 0.2, "products": [{"id": 1}]}), encoding="utf-8")
        b.write_text(json.dumps({"elapsed_sec": 9.9, "products": [{"id": 1}], "generated_at": "2"}), encoding="utf-8")
        self.assertTrue(bfi._same_ignoring_time(a, b))
        b.write_text(json.dumps({"generated_at": "1", "elapsed_sec": 0.2, "products": [{"id": 2}]}), encoding="utf-8")
        self.assertFalse(bfi._same_ignoring_time(a, b))
        b.write_text("{urwany", encoding="utf-8")
        self.assertFalse(bfi._same_ignoring_time(a, b))               # nieczytelny spis = zapisz
        self.assertFalse(bfi._same_ignoring_time(a, self.tmp / "nie-ma.json"))


if __name__ == "__main__":
    unittest.main()
