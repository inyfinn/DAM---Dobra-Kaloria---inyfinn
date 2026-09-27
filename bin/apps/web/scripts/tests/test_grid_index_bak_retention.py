# -*- coding: utf-8 -*-
"""_prune_old_baks: branding-grid-index.json.bak-<epoch> nie moze rosnac bez konca.

Zmierzone 2026-09-27: build-branding-grid-index.py:289-291 robi out.replace(bak)
przy kazdej publikacji i nigdy nie sprzata. W repo narosly 245 takich plikow
(~25 MB kazdy), a 30 minut po posprzataniu powstalo juz 5 nowych. Retencja:
najwyzej 2 najnowsze kopie obok pliku wyjsciowego, starsze kasowane pojedynczo
(Path.unlink), bez ruszania plikow o podobnej, ale niedokladnie pasujacej nazwie.
"""
from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
BUILD = SCRIPTS / "build-branding-grid-index.py"


def _load_builder():
    spec = importlib.util.spec_from_file_location("dam_build_branding_grid_index", BUILD)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {BUILD}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class PruneOldBaksTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.mod = _load_builder()

    def test_keeps_only_two_newest_bak_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            out = d / "branding-grid-index.json"
            out.write_text("{}", encoding="utf-8")
            epochs = [1000, 1001, 1002, 1003, 1004]
            for e in epochs:
                (d / f"branding-grid-index.json.bak-{e}").write_text("x", encoding="utf-8")

            removed = self.mod._prune_old_baks(out, keep=2)

            self.assertEqual(removed, 3)
            remaining = sorted(p.name for p in d.glob("branding-grid-index.json.bak-*"))
            self.assertEqual(
                remaining,
                ["branding-grid-index.json.bak-1003", "branding-grid-index.json.bak-1004"],
            )

    def test_does_not_touch_similarly_named_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            out = d / "branding-grid-index.json"
            out.write_text("{}", encoding="utf-8")
            for e in (2000, 2001, 2002):
                (d / f"branding-grid-index.json.bak-{e}").write_text("x", encoding="utf-8")
            near_miss_1 = d / "branding-grid-index.json.bak-abc"
            near_miss_2 = d / "branding-grid-index.json.backup"
            near_miss_1.write_text("keep me", encoding="utf-8")
            near_miss_2.write_text("keep me too", encoding="utf-8")

            removed = self.mod._prune_old_baks(out, keep=2)

            self.assertEqual(removed, 1)
            self.assertTrue(near_miss_1.is_file(), "plik .bak-abc (nie-cyfrowy sufiks) nie moze zniknac")
            self.assertTrue(near_miss_2.is_file(), "plik .backup nie moze zniknac")

    def test_fewer_than_keep_removes_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            out = d / "branding-grid-index.json"
            out.write_text("{}", encoding="utf-8")
            (d / "branding-grid-index.json.bak-3000").write_text("x", encoding="utf-8")

            removed = self.mod._prune_old_baks(out, keep=2)

            self.assertEqual(removed, 0)
            self.assertTrue((d / "branding-grid-index.json.bak-3000").is_file())


if __name__ == "__main__":
    unittest.main()
