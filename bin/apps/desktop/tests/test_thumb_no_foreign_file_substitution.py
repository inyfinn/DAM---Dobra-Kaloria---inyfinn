# -*- coding: utf-8 -*-
"""07.10.2026: /thumb-cache i /media nie moga oddac INNEGO pliku niz ten, o ktory pytano.

Przyczyna: _resolve_viz_image_for_thumb dla nieistniejacej sciezki wolal
_lookup_viz_path_from_index, ktory dopasowuje po samym numerze indeksu rewizji
(6300728.00 gdziekolwiek w sciezce) i zwraca wizke tej rewizji. Dla folderu rewizji to
zamierzone; dla sciezki do konkretnego pliku dawalo miniature cudzego pliku.

Run: python tests/test_thumb_no_foreign_file_substitution.py  (z bin/apps/desktop)
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parent.parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import local_bridge as lb  # noqa: E402


class NoForeignFileSubstitutionTests(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.product = Path(self.td.name).resolve() / "BANOFFEE KAKAO"
        self.rev = self.product / "DOY - 65 g - 24.03.2026 - 6300728.00"
        self.viz = self.rev / "4 - WIZKI" / "FRONT-S.png"
        self.viz.parent.mkdir(parents=True)
        self.viz.write_bytes(b"png")
        (self.rev / "2 - PROJECT").mkdir()
        fi = {"viz_latest": [{"index": "6300728.00", "index_base": "6300728",
                              "path": str(self.viz), "revision_path": str(self.rev)}]}
        real_load = lb._load_json
        self.patch = mock.patch.object(
            lb, "_load_json",
            side_effect=lambda p, d=None: fi if Path(p) == lb.INDEX_FILE else real_load(p, d))
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.td.cleanup()

    def _same(self, got: str, want: Path) -> bool:
        return lb.normalize_path(got).lower() == lb.normalize_path(str(want)).lower()

    def test_revision_folder_still_gives_its_viz(self):
        self.assertTrue(self._same(lb._resolve_viz_image_for_thumb(str(self.rev)), self.viz))

    def test_existing_file_gives_itself(self):
        self.assertTrue(self._same(lb._resolve_viz_image_for_thumb(str(self.viz)), self.viz))

    def test_missing_image_in_same_revision_does_not_get_the_viz(self):
        missing = self.viz.with_name("FRONT-L-stara.png")
        got = lb._resolve_viz_image_for_thumb(str(missing))
        self.assertFalse(self._same(got, self.viz), got)
        self.assertFalse(Path(got).is_file(), got)

    def test_missing_project_file_does_not_get_the_viz(self):
        missing = self.rev / "2 - PROJECT" / "projekt.ai"
        got = lb._resolve_viz_image_for_thumb(str(missing))
        self.assertFalse(self._same(got, self.viz), got)

    def test_media_route_target_follows_the_same_rule(self):
        missing = self.viz.with_name("INNA.png")
        self.assertFalse(self._same(lb._coerce_media_target(str(missing)), self.viz))

    def test_same_file_name_in_renamed_revision_folder_still_resolves(self):
        """Indeks ma stara nazwe folderu rewizji (inna data), plik ten sam - to nie podmiana."""
        old = self.product / "DOY - 65 g - 20.03.2026 - 6300728.00" / "4 - WIZKI" / "FRONT-S.png"
        self.assertTrue(self._same(lb._resolve_viz_image_for_thumb(str(old)), self.viz))


if __name__ == "__main__":
    unittest.main(verbosity=2)
