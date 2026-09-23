# -*- coding: utf-8 -*-
"""Profil zapasowy dla /thumb-cache (BRIEF-235 diagnoza C).

22.09.2026 (kierownik, zmierzone na zywej aplikacji): Hero prosi o profil `modal`;
w indeksie sa 2 klucze modal wobec 6874 grid i 6397 card -> /thumb-cache?profile=modal
zwraca 404 -> "Brak podgladu", mimo ze ta sama sciezka MA miniature w innym profilu.
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

import dam_thumb_cache as tc  # noqa: E402


class ProfileFallbackTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        p1 = mock.patch.object(tc, "cache_root", return_value=self.root)
        p1.start()
        self.addCleanup(p1.stop)
        tc._REL_INDEX = None
        self.addCleanup(setattr, tc, "_REL_INDEX", None)
        (self.root / "thumbs").mkdir(parents=True, exist_ok=True)

    def _seed(self, rel: str, profile: str, digest: str) -> None:
        idx_path = self.root / "thumb-rel-index.json"
        data = {}
        if idx_path.is_file():
            data = json.loads(idx_path.read_text(encoding="utf-8"))
        data[f"{rel}|{profile}"] = {"digest": digest, "mtime": 0.0}
        idx_path.write_text(json.dumps(data), encoding="utf-8")
        (self.root / "thumbs" / f"{digest}.avif").write_bytes(b"\x00\x00\x00 ftypavif-fake")

    def test_modal_spada_do_grid_gdy_cache_only(self):
        digest = "g" * 64
        self._seed("foo/bar.png", "grid", digest)
        with mock.patch.object(tc, "_marketing_cache_only", return_value=True):
            code, _body, _ctype, meta = tc.get_or_build_thumb(
                "X:/Marketing/foo/bar.png", profile="modal"
            )
        self.assertEqual(code, 200)
        self.assertEqual(meta.get("digest"), digest)
        self.assertEqual(meta.get("profile_fallback"), "grid")
        # profil w meta zostaje = to, o co poprosil klient (modal), nie "grid".
        self.assertEqual(meta.get("profile"), "modal")

    def test_nie_zapisuje_falszywego_klucza_w_indeksie(self):
        digest = "h" * 64
        self._seed("foo/baz.png", "grid", digest)
        with mock.patch.object(tc, "_marketing_cache_only", return_value=True):
            tc.get_or_build_thumb("X:/Marketing/foo/baz.png", profile="modal")
        idx = json.loads((self.root / "thumb-rel-index.json").read_text(encoding="utf-8"))
        self.assertNotIn(
            "foo/baz.png|modal", idx, "fallback nie moze zaklamac indeksu: rel|modal -> digest z grid"
        )
        self.assertEqual(idx["foo/baz.png|grid"]["digest"], digest)

    def test_grid_pomija_brakujacy_card_i_bierze_modal(self):
        """Kolejnosc dla profilu grid: card -> modal. Card brakuje, modal jest."""
        digest = "m" * 64
        self._seed("foo/qux.png", "modal", digest)
        with mock.patch.object(tc, "_marketing_cache_only", return_value=True):
            code, _body, _ctype, meta = tc.get_or_build_thumb(
                "X:/Marketing/foo/qux.png", profile="grid"
            )
        self.assertEqual(code, 200)
        self.assertEqual(meta.get("profile_fallback"), "modal")

    def test_brak_kazdego_profilu_zostaje_404(self):
        with mock.patch.object(tc, "_marketing_cache_only", return_value=True):
            code, _body, _ctype, meta = tc.get_or_build_thumb(
                "X:/Marketing/nope.png", profile="modal"
            )
        self.assertEqual(code, 404)
        self.assertNotIn("profile_fallback", meta)

    def test_lancuchy_zgodne_z_brief(self):
        self.assertEqual(tc.PROFILE_FALLBACK_CHAIN["modal"], ("card", "grid"))
        self.assertEqual(tc.PROFILE_FALLBACK_CHAIN["card"], ("modal", "grid"))
        self.assertEqual(tc.PROFILE_FALLBACK_CHAIN["grid"], ("card", "modal"))
        self.assertEqual(tc.PROFILE_FALLBACK_CHAIN["poster"], ("card", "grid"))


if __name__ == "__main__":
    unittest.main()
