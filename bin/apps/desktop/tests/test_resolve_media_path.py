# -*- coding: utf-8 -*-
"""Regression: marketing basename drift + product revision rename resolve."""
from __future__ import annotations

import sys
import tempfile
import threading
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

    # Twardy limit: _coerce_media_target robi fuzzy-skan udzialu M:. Gdy udzial
    # jest wolny/uspiony, skan idzie minutami i CALY zestaw testow wisi
    # (zmierzone 2026-09-22: 610 s na tym jednym tescie). Test integracyjny
    # nie moze blokowac zestawu - po limicie robimy skipTest, nie czekamy.
    RESOLVE_TIMEOUT_S = 20.0

    def test_kulki_live_resolve(self) -> None:
        box: dict = {}

        def _work() -> None:
            try:
                box["hit"] = lb._coerce_media_target(self.INDEXED)
            except Exception as exc:  # noqa: BLE001
                box["exc"] = exc

        th = threading.Thread(target=_work, daemon=True, name="kulki-resolve")
        th.start()
        th.join(self.RESOLVE_TIMEOUT_S)
        if th.is_alive():
            # Watek jest daemon - nie zatrzyma wyjscia z interpretera.
            self.skipTest(
                "resolve kulki.png przekroczyl %.0f s (udzial M: wolny)" % self.RESOLVE_TIMEOUT_S
            )
        if "exc" in box:
            raise box["exc"]
        hit = box.get("hit") or ""
        if not hit or not Path(hit).is_file():
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
    """Sciezka z indeksu (litera D:) musi trafic na ZYWY udzial (litera X:).

    Wczesniej klasa miala zahardkodowana jedna rewizje Cynamonki. Gdy tej
    jednej rewizji nie bylo na X:, wszystkie trzy testy szly w skipTest i
    nie dawaly zadnego dowodu. Teraz szukamy DOWOLNEJ rewizji na X:, ktora
    ma niepusty folder "1 - MATERIALY/ELEMENTY" - jesli maszyna ma zywy X:,
    test sie wykona; jesli nie ma, skip mowi dlaczego (z liczbami).
    """

    X_BATONY = Path("X:/Marketing/- POLSKA/01 - PRODUKTY/- DK/01 - BATONY")
    _probe: tuple | None = None

    @classmethod
    def _live_pair(cls) -> tuple:
        """(rewizja_X, elementy_X, powod_skipu). Skanuje tylko 2 poziomy - ~0,05 s."""
        if cls._probe is not None:
            return cls._probe
        revs = 0
        if not cls.X_BATONY.is_dir():
            cls._probe = (None, None, "brak %s (dysk X: nie jest podlaczony)" % cls.X_BATONY)
            return cls._probe
        try:
            for prod in cls.X_BATONY.iterdir():
                if not prod.is_dir():
                    continue
                for rev in prod.iterdir():
                    if not rev.is_dir():
                        continue
                    revs += 1
                    for slot in rev.iterdir():
                        if not (slot.is_dir() and slot.name.lower().startswith("1 - materia")):
                            continue
                        for el in slot.iterdir():
                            if not (el.is_dir() and el.name.lower() == "elementy"):
                                continue
                            if any(f.is_file() for f in el.iterdir()):
                                cls._probe = (rev, el, "")
                                return cls._probe
        except OSError as exc:
            cls._probe = (None, None, "blad odczytu X:: %s" % exc)
            return cls._probe
        cls._probe = (
            None,
            None,
            "X: przeszukany (%d rewizji), zadna nie ma niepustego ELEMENTY" % revs,
        )
        return cls._probe

    def _live_rev(self) -> tuple:
        rev, el, why = self._live_pair()
        if rev is None or el is None:
            self.skipTest(why)
        indexed_rev = str(rev).replace("\\", "/").replace("X:", "D:", 1)
        indexed_el = str(el).replace("\\", "/").replace("X:", "D:", 1)
        # Dowod ma sens tylko wtedy, gdy blizniak na D: NIE istnieje - inaczej
        # resolve zwroci D: i nie sprawdzimy rebase'u litery.
        if Path(indexed_rev.replace("/", "\\")).exists():
            self.skipTest("blizniak na D: istnieje - rebase litery nieweryfikowalny: %s" % indexed_rev)
        return rev, el, indexed_rev, indexed_el

    def test_resolve_physical_path_rebases_directory(self):
        import dam_path_resolve as dpr

        rev, _el, indexed_rev, _ = self._live_rev()
        hit = dpr.resolve_physical_path(indexed_rev)
        self.assertTrue(Path(hit).is_dir(), hit)
        self.assertTrue(str(hit).upper().startswith("X:"), hit)
        self.assertFalse(Path(dpr._norm(indexed_rev)).exists())

    def test_list_folder_images_d_drive_not_path_not_found(self):
        _rev, _el, indexed_rev, indexed_el = self._live_rev()
        res = lb.list_folder_images(indexed_rev)
        self.assertTrue(res.get("ok"), res)
        self.assertNotEqual(res.get("error"), "path_not_found")
        el = lb.list_folder_images(indexed_el)
        self.assertTrue(el.get("ok"), el)
        names = {f.get("name") for f in (el.get("files") or [])}
        self.assertTrue(names, el)

    def test_remap_revision_live_paths_fills_elements(self):
        _rev, _el, indexed_rev, _ = self._live_rev()
        rev = {"path": indexed_rev, "files_by_role": {"elements": []}}
        lb._remap_revision_live_paths(rev)
        els = rev.get("files_by_role", {}).get("elements") or []
        self.assertTrue(els)
        self.assertIn("ELEMENTY", str(els[0].get("path") or "").upper())
        self.assertTrue(str(rev.get("path") or "").upper().startswith("X:"))


if __name__ == "__main__":
    unittest.main()
