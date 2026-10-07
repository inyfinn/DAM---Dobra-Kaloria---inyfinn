# -*- coding: utf-8 -*-
"""Bridge: revision folder → viz_latest path; file-index routes.

07.10.2026: dwie warstwy.
- KOD (zawsze): te same asercje co dotad, ale na danych tymczasowych - folder rewizji
  musi dac dokladnie plik wizki z indeksu, takze przez _coerce_media_target.
- DANE TEGO KOMPUTERA: zywy file-index i dysk. Pomijane z podanym powodem, gdy indeks
  nie ma rewizji probnych albo ich wizki leza na dysku, ktorego tu nie ma (indeks z
  innego komputera ma sciezki X:/). Test zalezny od cudzego dysku nie blokuje zestawu.

Run: python tests/test_viz_index_thumb_routes.py  (z bin/apps/desktop)
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

import local_bridge as lb  # noqa: E402

INDEX = lb.WEB_ROOT / "data" / "file-index.json"

REVISION_FOLDERS = {
    "6300782.00": (
        "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK/01 - BATONY/"
        "CYNAMONKA — [ nerkowcowy ]/MINI - 18 06 2026 - 6300782.00 - F"
    ),
    "6300784.00": (
        "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK/01 - BATONY/"
        "CIASTO ŚLIWKOWE — [ nerkowcowy ]/MINI - 18 06 2026 - 6300784.00 - F"
    ),
    "6900001.00": (
        "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK/07 - DATESY/"
        "LEMON CHEESECAKE - [ daktyle ]/DOY - LEMON CHEESECAKE 100 g - 04.08.2026 - BEZ INDEKSU"
    ),
    "6300728.00": (
        "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK/02 - KULKI/"
        "BANOFFEE KAKAO — [ deserowe ]/DOY - 65 g - 24.03.2026 - 6300728.00"
    ),
}


class RevisionFolderToVizCodeTests(unittest.TestCase):
    """Kod mostu na danych tymczasowych: te same ksztalty folderow co REVISION_FOLDERS
    (sufiks " - F", "BEZ INDEKSU" bez numeru w nazwie, indeks na koncu nazwy)."""

    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        root = Path(self.td.name).resolve()
        self.folders: dict[str, str] = {}
        self.expected: dict[str, str] = {}
        rows = []
        for idx, live_folder in REVISION_FOLDERS.items():
            product, revision = live_folder.split("/")[-2:]
            rev = root / product / revision
            viz = rev / "4 - WIZKI" / f"DK-{idx}-FRONT-S.png"
            viz.parent.mkdir(parents=True)
            viz.write_bytes(b"png")
            self.folders[idx] = str(rev)
            self.expected[idx] = str(viz)
            rows.append({"index": idx, "index_base": idx.split(".")[0],
                         "path": str(viz), "revision_path": str(rev)})
        self.fi = {"viz_latest": rows}
        real_load = lb._load_json
        self.patch = mock.patch.object(
            lb, "_load_json",
            side_effect=lambda p, d=None: self.fi if Path(p) == lb.INDEX_FILE else real_load(p, d))
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.td.cleanup()

    def test_resolve_revision_folder_to_viz_file(self):
        for idx, folder in self.folders.items():
            resolved = lb._lookup_viz_path_from_index(folder, self.fi)
            self.assertTrue(resolved, f"lookup failed for folder {idx}")
            self.assertEqual(lb.normalize_path(resolved), lb.normalize_path(self.expected[idx]))

    def test_coerce_media_target_accepts_revision_folder(self):
        for idx, folder in self.folders.items():
            got = lb._coerce_media_target(folder)
            self.assertEqual(lb.normalize_path(got), lb.normalize_path(self.expected[idx]), idx)


class LiveIndexOnThisComputerTests(unittest.TestCase):
    """Zywy indeks + dysk tego komputera. Gdy danych probnych tu nie ma - pominiecie z powodem."""

    @classmethod
    def setUpClass(cls):
        if not INDEX.is_file():
            raise unittest.SkipTest(f"brak zywego indeksu: {INDEX}")
        cls.data = json.loads(INDEX.read_text(encoding="utf-8"))
        by_index = {str(r.get("index") or ""): str(r.get("path") or "")
                    for r in (cls.data.get("viz_latest") or []) if isinstance(r, dict)}
        cls.viz = {idx: by_index.get(idx, "") for idx in REVISION_FOLDERS}
        not_in_index = [idx for idx, vp in cls.viz.items() if not vp]
        if not_in_index:
            raise unittest.SkipTest(
                "zywy indeks nie ma viz_latest dla rewizji probnych: " + ", ".join(not_in_index))
        not_on_disk = [f"{idx} ({vp[:3]})" for idx, vp in cls.viz.items()
                       if not Path(lb.normalize_path(vp)).is_file()]
        if not_on_disk:
            raise unittest.SkipTest(
                "wizki rewizji probnych nie leza na dysku tego komputera "
                "(indeks z innego ROOT): " + ", ".join(not_on_disk))

    def test_file_index_has_viz_latest_for_probe_ids(self):
        self.assertGreaterEqual(len(self.data.get("viz_latest") or []), 400)
        for idx, vp in self.viz.items():
            self.assertTrue(Path(lb.normalize_path(vp)).is_file(), f"viz file missing on disk: {idx}")

    def test_resolve_revision_folder_to_viz_file(self):
        fi = lb._load_json(INDEX, {})
        for idx, folder in REVISION_FOLDERS.items():
            resolved = lb._lookup_viz_path_from_index(folder, fi)
            self.assertTrue(resolved, f"lookup failed for folder {idx}")
            self.assertEqual(lb.normalize_path(resolved), lb.normalize_path(self.viz[idx]))

    def test_coerce_media_target_accepts_revision_folder(self):
        for idx, folder in REVISION_FOLDERS.items():
            got = lb._coerce_media_target(folder)
            self.assertEqual(lb.normalize_path(got), lb.normalize_path(self.viz[idx]))

    def test_warm_viz_thumbs_from_index_smoke(self):
        if not lb.dam_thumb_cache:
            self.skipTest("brak modulu dam_thumb_cache")
        out = lb._warm_viz_thumbs_from_index(limit=4)
        self.assertIs(out.get("ok"), True)
        self.assertGreaterEqual(int(out.get("queued") or out.get("count") or 0), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
