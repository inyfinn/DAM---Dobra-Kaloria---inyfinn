# -*- coding: utf-8 -*-
"""Regression: marketing basename drift + product revision rename resolve."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import local_bridge as lb  # noqa: E402


class MarketingBasenameDriftTests(unittest.TestCase):
    def setUp(self) -> None:
        self._td = tempfile.TemporaryDirectory()
        self.root = Path(self._td.name)
        self.slider_dir = self.root / "02 - SLIDERY  KATEGORIE GLOWNE"
        self.nested = self.slider_dir / "SUCHE" / "gotowe"
        self.nested.mkdir(parents=True)
        self.file = self.nested / "kulki.png"
        self.file.write_bytes(b"\x89PNG\r\n")

    def tearDown(self) -> None:
        self._td.cleanup()

    def _under_marketing(self, _p: Path) -> bool:
        return True

    def test_nested_basename_resolves(self) -> None:
        indexed = str(self.slider_dir / "kulki.png")
        orig = lb._is_under_marketing
        try:
            lb._is_under_marketing = self._under_marketing  # type: ignore[assignment]
            hit = lb._resolve_marketing_basename_drift(indexed)
            self.assertIsNotNone(hit)
            self.assertEqual(Path(hit).resolve(), self.file.resolve())
            coerced = lb._coerce_media_target(indexed)
            self.assertEqual(Path(coerced).resolve(), self.file.resolve())
        finally:
            lb._is_under_marketing = orig  # type: ignore[assignment]

    def test_prefers_suche_gotowe_over_other_hit(self) -> None:
        other = self.slider_dir / "archive" / "kulki.png"
        other.parent.mkdir(parents=True)
        other.write_bytes(b"\x89PNG\r\n")
        indexed = str(self.slider_dir / "kulki.png")
        orig = lb._is_under_marketing
        try:
            lb._is_under_marketing = self._under_marketing  # type: ignore[assignment]
            hit = lb._resolve_marketing_basename_drift(indexed)
            self.assertIsNotNone(hit)
            self.assertEqual(Path(hit).resolve(), self.file.resolve())
        finally:
            lb._is_under_marketing = orig  # type: ignore[assignment]

    def test_ambiguous_equal_score_returns_none(self) -> None:
        # Fresh tree without SUCHE/gotowe from setUp
        with tempfile.TemporaryDirectory() as td:
            slider = Path(td) / "02 - SLIDERY"
            a = slider / "a" / "kulki.png"
            b = slider / "b" / "kulki.png"
            a.parent.mkdir(parents=True)
            b.parent.mkdir(parents=True)
            a.write_bytes(b"\x89PNG\r\n")
            b.write_bytes(b"\x89PNG\r\n")
            indexed = str(slider / "kulki.png")
            orig = lb._is_under_marketing
            try:
                lb._is_under_marketing = self._under_marketing  # type: ignore[assignment]
                hit = lb._resolve_marketing_basename_drift(indexed)
                self.assertIsNone(hit)
            finally:
                lb._is_under_marketing = orig  # type: ignore[assignment]


class ProductRevisionDriftTests(unittest.TestCase):
    def setUp(self) -> None:
        self._td = tempfile.TemporaryDirectory()
        self.root = Path(self._td.name)
        self.product_dir = self.root / "01 - PRODUKTY" / "Batony" / "6300785"
        old_rev = self.product_dir / "KAR6X - 20.05.2026 - 6300785.00 - F"
        new_rev = self.product_dir / "KAR6X - 20.05.2026  - PL EN - 6300785.00 - F"
        slot = new_rev / "1 - MATERIAŁY" / "ELEMENTY"
        slot.mkdir(parents=True)
        self.file = slot / "hero.png"
        self.file.write_bytes(b"\x89PNG\r\n")
        self.indexed = str(old_rev / "1 - MATERIAŁY" / "ELEMENTY" / "hero.png")

    def tearDown(self) -> None:
        self._td.cleanup()

    def test_revision_rename_still_resolves(self) -> None:
        orig = lb._is_under_marketing
        try:
            lb._is_under_marketing = lambda _p: True  # type: ignore[assignment]
            hit = lb._resolve_missing_media_path(self.indexed)
            self.assertIsNotNone(hit)
            self.assertEqual(Path(hit).resolve(), self.file.resolve())
        finally:
            lb._is_under_marketing = orig  # type: ignore[assignment]


class KulkiIntegrationTests(unittest.TestCase):
    """Live M: drive — skip when marketing file absent."""

    INDEXED = (
        "M:/- POLSKA/06 - STRONY WWW - INTERNET/01 - Strona Dobra Kaloria/"
        "02 - SLIDERY  KATEGORIE GŁÓWNE/kulki.png"
    )
    EXPECT_SUFFIX = Path("SUCHE") / "gotowe" / "kulki.png"

    def test_kulki_live_resolve(self) -> None:
        hit = lb._coerce_media_target(self.INDEXED)
        if not Path(hit).is_file():
            self.skipTest("kulki.png not on this machine")
        self.assertTrue(str(hit).replace("/", "\\").endswith(str(self.EXPECT_SUFFIX).replace("/", "\\")))
        self.assertFalse(Path(lb.normalize_path(self.INDEXED)).is_file())



class ThumbCacheTimeoutTests(unittest.TestCase):
    def test_timeout_returns_504(self) -> None:
        def _slow(*_a, **_k):
            import time
            time.sleep(5)
            return 200, b"x", "image/jpeg", {"ok": True, "cache_hit": False}

        class Fake:
            get_or_build_thumb = staticmethod(_slow)

        orig = lb.dam_thumb_cache
        try:
            lb.dam_thumb_cache = Fake()  # type: ignore[assignment]
            code, body, ctype, meta = lb._thumb_cache_with_timeout(
                "M:/fake/kulki.png", profile="modal", timeout_s=0.3
            )
            self.assertEqual(code, 504)
            self.assertEqual(meta.get("error"), "thumb_timeout")
            self.assertEqual(ctype, "application/json")
            self.assertEqual(body, b"")
        finally:
            lb.dam_thumb_cache = orig


class DirDriveRebaseTests(unittest.TestCase):
    """Indexed D:/Marketing dirs must resolve onto live X: (ELEMENTY picker)."""

    INDEXED_REV = (
        "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK/01 - BATONY/"
        "CYNAMONKA — [ nerkowcowy ]/KAR6X - 20.05.2026  - PL EN - 6300783.00 - F"
    )
    INDEXED_EL = INDEXED_REV + "/1 - MATERIAŁY/ELEMENTY"

    def test_resolve_physical_path_rebases_directory(self):
        import dam_path_resolve as dpr

        x_twin = Path("X:" + self.INDEXED_REV[1:].replace("/", "\\"))
        if not x_twin.is_dir():
            self.skipTest("Cynamonka ELEMENTY revision missing on X:")
        hit = dpr.resolve_physical_path(self.INDEXED_REV)
        self.assertTrue(Path(hit).is_dir(), hit)
        self.assertTrue(str(hit).upper().startswith("X:"), hit)
        self.assertFalse(Path(dpr._norm(self.INDEXED_REV)).exists())

    def test_list_folder_images_d_drive_not_path_not_found(self):
        if not Path(self.INDEXED_EL.replace("/", "\\").replace("D:", "X:", 1)).is_dir():
            self.skipTest("Cynamonka ELEMENTY missing on X:")
        res = lb.list_folder_images(self.INDEXED_REV)
        self.assertTrue(res.get("ok"), res)
        self.assertNotEqual(res.get("error"), "path_not_found")
        el = lb.list_folder_images(self.INDEXED_EL)
        self.assertTrue(el.get("ok"), el)
        names = {f.get("name") for f in (el.get("files") or [])}
        self.assertTrue(names, el)
        self.assertTrue(any("CYNAMON" in n.upper() for n in names), names)

    def test_remap_revision_live_paths_fills_elements(self):
        rev = {"path": self.INDEXED_REV, "files_by_role": {"elements": []}}
        if not Path(self.INDEXED_EL.replace("/", "\\").replace("D:", "X:", 1)).is_dir():
            self.skipTest("Cynamonka ELEMENTY missing on X:")
        lb._remap_revision_live_paths(rev)
        els = rev.get("files_by_role", {}).get("elements") or []
        self.assertTrue(els)
        self.assertIn("ELEMENTY", str(els[0].get("path") or "").upper())
        self.assertTrue(str(rev.get("path") or "").upper().startswith("X:"))


if __name__ == "__main__":
    unittest.main()
