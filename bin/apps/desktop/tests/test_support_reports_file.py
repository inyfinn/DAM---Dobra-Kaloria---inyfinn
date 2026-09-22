# -*- coding: utf-8 -*-
"""Zgloszenie poprawki musi wyladowac W PLIKU, ze statusem "nowe".

Zgloszenie uzytkownika 2026-09-22:
  "Zglaszanie poprawek nie dziala. nawet nie wiadomo, gdzie to sie wysyla.
   Najlepiej jakby poprawki kolejno zapisywaly sie do pliku."
  "a poprawki zatwierdzam ja, jako administrator, czy je wprowadzamy."

Stad dwa twarde wymagania sprawdzane nizej:
  1. wpis ladu je w POPRAWKI.md oraz poprawki.jsonl, numerowany kolejno,
  2. status nowego wpisu to ZAWSZE "nowe" - zgloszenie nie jest poleceniem.
"""
from __future__ import annotations

import base64
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import support_reports  # noqa: E402

# najmniejszy poprawny PNG (1x1)
PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
PNG_DATA_URL = "data:image/png;base64," + base64.b64encode(PNG_1PX).decode("ascii")


class ReportFileTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="dam-poprawki-"))
        self._orig_root = support_reports.reports_root
        support_reports.reports_root = lambda: self.tmp  # type: ignore[assignment]

    def tearDown(self):
        support_reports.reports_root = self._orig_root  # type: ignore[assignment]
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _md(self) -> str:
        return (self.tmp / support_reports.MD_NAME).read_text(encoding="utf-8")

    def _rows(self) -> list[dict]:
        path = self.tmp / support_reports.JSONL_NAME
        if not path.exists():
            return []
        return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]

    def test_creates_markdown_and_jsonl(self):
        res = support_reports.append_report(
            {"kind": "blad", "title": "Test.", "body": "Gdzie to trafia?", "page": "help.html"},
            actor="kw", role="admin", version="2.2.9", kind_label="Błąd / usterka",
        )
        self.assertTrue(res["ok"], res)
        self.assertTrue((self.tmp / support_reports.MD_NAME).is_file())
        self.assertTrue((self.tmp / support_reports.JSONL_NAME).is_file())
        self.assertEqual(res["id"], "P-0001")
        # UI ma pokazac uzytkownikowi, GDZIE to poszlo
        self.assertTrue(res["file"].endswith(support_reports.MD_NAME), res["file"])

    def test_new_report_is_never_pre_approved(self):
        """Najwazniejsza asercja: zgloszenie != zgoda na wprowadzenie."""
        support_reports.append_report(
            {"title": "cokolwiek", "body": "x", "status": "zatwierdzone"},
            actor="kw", role="admin",
        )
        rows = self._rows()
        self.assertEqual(rows[0]["status"], support_reports.STATUS_NEW)
        self.assertIn("**Status:** nowe", self._md())

    def test_ids_increment_and_survive_restart(self):
        for _ in range(3):
            support_reports.append_report({"title": "x", "body": "y"}, actor="kw")
        self.assertEqual([r["id"] for r in self._rows()], ["P-0001", "P-0002", "P-0003"])
        # nowy "proces": numer czytany z pliku, nie z licznika w pamieci
        res = support_reports.append_report({"title": "po restarcie", "body": "y"}, actor="kw")
        self.assertEqual(res["id"], "P-0004")

    def test_screenshot_saved_next_to_report(self):
        res = support_reports.append_report(
            {"title": "ze zrzutem", "body": "patrz obrazek", "shots": [PNG_DATA_URL]},
            actor="kw",
        )
        self.assertEqual(res["shots_saved"], 1)
        shot = self.tmp / support_reports.SHOTS_DIRNAME / "P-0001-1.png"
        self.assertTrue(shot.is_file())
        self.assertEqual(shot.read_bytes(), PNG_1PX)
        self.assertIn("P-0001-1.png", self._md())

    def test_rejects_non_image_payload(self):
        """Nie zapisujemy czegokolwiek, co ktos wklei jako data: URL."""
        bad = [
            "data:text/html;base64," + base64.b64encode(b"<script>x</script>").decode(),
            "data:image/svg+xml;base64," + base64.b64encode(b"<svg onload=x>").decode(),
            "nie-data-url",
            "data:image/png;base64,@@@niepoprawny@@@",
        ]
        res = support_reports.append_report({"title": "t", "body": "b", "shots": bad}, actor="kw")
        self.assertEqual(res["shots_saved"], 0)
        self.assertFalse((self.tmp / support_reports.SHOTS_DIRNAME).exists())

    def test_shot_count_capped(self):
        many = [PNG_DATA_URL] * (support_reports.MAX_SHOTS + 4)
        res = support_reports.append_report({"title": "t", "body": "b", "shots": many}, actor="kw")
        self.assertEqual(res["shots_saved"], support_reports.MAX_SHOTS)

    def test_empty_body_still_recorded(self):
        """Most waliduje tresc wczesniej; tu wpis ma byc czytelny mimo braku opisu."""
        support_reports.append_report({"title": "sam tytul", "body": ""}, actor="kw")
        self.assertIn("_(bez opisu)_", self._md())

    def test_header_written_once(self):
        for _ in range(3):
            support_reports.append_report({"title": "x", "body": "y"}, actor="kw")
        self.assertEqual(self._md().count("# Poprawki zgłoszone w DAM"), 1)

    def test_md_records_who_and_where(self):
        support_reports.append_report(
            {"title": "t", "body": "b", "page": "explorer.html"},
            actor="kw", role="admin", version="2.2.9", kind_label="Błąd / usterka",
        )
        md = self._md()
        for needle in ("kw", "admin", "explorer.html", "2.2.9", "Błąd / usterka"):
            self.assertIn(needle, md, "brak w POPRAWKI.md: " + needle)


class StatusVocabularyTests(unittest.TestCase):
    def test_statuses_documented_in_header(self):
        for st in support_reports.STATUSES:
            self.assertIn("`%s`" % st, support_reports.MD_HEADER,
                          "status %s nieopisany w naglowku pliku" % st)


if __name__ == "__main__":
    unittest.main()
