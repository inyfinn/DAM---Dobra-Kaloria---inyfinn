# -*- coding: utf-8 -*-
"""W8 (28.09.2026), zrzuty harnessu A/B/C: na B karta "Logo Dobra Kaloria" pokazywala
stara wersje (ciemne "Logo X"), choc katalog i /thumb-cache mialy nowa (zielona).

Przyczyna: dam-preview-truth.js preferOriginal() na komputerze z ROOT zawsze podmienia
miniature na oryginal z /media - a /media czyta plik z dysku TEGO komputera, ktory na
opoznionej kopii jest starsza wersja. Kontrakt: /media nie oddaje lokalnego pliku
starszego niz wersja w katalogu (409 local_copy_outdated); UI zostaje przy miniaturze
wersji z katalogu. Plik nowszy albo o nieznanej wersji - jak dotad.
"""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import dam_thumb_cache as tc  # noqa: E402
import local_bridge  # noqa: E402

REL = "- POLSKA/04 - MARKETING/Logo/Logo Dobra Kaloria.png"
OLD, NEW = 1_790_172_652, 1_790_431_852


class MediaOutdatedLocalTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.file = Path(tmp.name) / "X" / Path(*REL.split("/"))
        self.file.parent.mkdir(parents=True)
        self.file.write_bytes(b"old copy")
        os.utime(self.file, (OLD, OLD))
        for name in ("_ASSET_MT", "_ASSET_MT_KEY"):
            saved = dict(getattr(tc, name))
            self.addCleanup(lambda n=name, v=saved: (getattr(tc, n).clear(), getattr(tc, n).update(v)))
            getattr(tc, name).clear()

    def test_older_local_copy_is_refused(self):
        tc._ASSET_MT[REL] = float(NEW)
        err = local_bridge._media_local_copy_outdated(str(self.file))
        self.assertIsNotNone(err)
        self.assertEqual(err["error"], "local_copy_outdated")

    def test_same_or_unknown_version_is_served(self):
        self.assertIsNone(local_bridge._media_local_copy_outdated(str(self.file)))
        tc._ASSET_MT[REL] = float(OLD)
        self.assertIsNone(local_bridge._media_local_copy_outdated(str(self.file)))

    def test_route_uses_the_check(self):
        src = (DESKTOP / "local_bridge.py").read_text(encoding="utf-8")
        i = src.index('if parsed.path == "/media":')
        self.assertIn("_media_local_copy_outdated(", src[i:i + 1500])


if __name__ == "__main__":
    unittest.main()
