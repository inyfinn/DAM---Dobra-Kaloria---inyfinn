# -*- coding: utf-8 -*-
"""W8 (28.09.2026), S1 A/B/C: /branding/mtimes zwracal date pliku z dysku TEGO komputera.

dam-branding.js (ensureBrandingMtimesReady forceDisk, sort "najnowsze") nadpisuje tym
mtime_ms kart. Na B (opozniona kopia) karta dostawala date starszej wersji mimo katalogu
z nowsza. Kontrakt: wartosc z katalogu (branding-index) wygrywa; dysk tylko uzupelnia brak.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlparse

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import branding_asset_routes as bar  # noqa: E402

CATALOG_MS = 1_790_431_852_000
DISK_S = 1_790_172_652


class _Handler:
    def __init__(self):
        self.out = None

    def _json(self, code, payload):
        self.out = (code, payload)


class BrandingMtimesCatalogTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        d = Path(tmp.name)
        (d / "data").mkdir()
        self.file = d / "Logo.png"
        self.file.write_bytes(b"x")
        os.utime(self.file, (DISK_S, DISK_S))
        idx = d / "data" / "branding-index.json"
        idx.write_text(json.dumps({"version": 1, "source": "rows", "assets": [
            {"id": "br-1", "path": str(self.file), "name": "Logo.png", "mtime_ms": CATALOG_MS},
            {"id": "br-2", "path": str(self.file), "name": "Logo.png"},
        ]}), encoding="utf-8")
        saved = dict(bar._CTX)
        self.addCleanup(lambda: (bar._CTX.clear(), bar._CTX.update(saved)))
        bar._CTX.clear()
        bar._CTX.update(web_root=str(d), branding_index_file=str(idx))

    def _get(self, ids):
        h = _Handler()
        self.assertTrue(bar.handle_get(h, urlparse("/branding/mtimes?ids=" + ids)))
        return {a["id"]: a for a in h.out[1]["assets"]}

    def test_catalog_mtime_wins_over_disk(self):
        rows = self._get("br-1")
        self.assertEqual(rows["br-1"]["mtime_ms"], CATALOG_MS)

    def test_disk_only_fills_missing_catalog_mtime(self):
        rows = self._get("br-2")
        self.assertEqual(rows["br-2"]["mtime_ms"], DISK_S * 1000)


if __name__ == "__main__":
    unittest.main()
