# -*- coding: utf-8 -*-
"""W8 (28.09.2026), S1 harnessu A/B/C: siatka Branding brala mtime z dysku TEGO komputera.

build-branding-grid-index.py:194-205 (_stamp_disk_mtimes) nadpisywal mtime_ms z katalogu
(branding-index.json zmaterializowany z wierszy PG, "source":"rows") data pliku z lokalnego
dysku. Komputer B z opozniona kopia pokazywal date, kolejnosc i identyfikator materialu
swojej starszej kopii (br-051194795: A 1790431852000, B 1790172652000).

Kontrakt: w trybie rows mtime_ms w siatce = wartosc z katalogu, niezaleznie od dysku.
Stary (legacy) indeks bez mtime_ms moze dostac date z dysku tylko tam, gdzie jej brak.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
BUILD = SCRIPTS / "build-branding-grid-index.py"
CATALOG_MS = 1_790_431_852_000  # V2 z katalogu (A)
DISK_S = 1_790_172_652  # starsza kopia na dysku B


def _asset(path: Path, **extra) -> dict:
    row = {
        "id": "br-051194795",
        "path": str(path),
        "name": path.name,
        "asset_role": "brand_asset",
        "media_type": "image",
    }
    row.update(extra)
    return row


class GridCatalogMtimeTests(unittest.TestCase):
    def _run(self, payload: dict) -> dict:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            src = d / "branding-index.json"
            out = d / "branding-grid-index.json"
            src.write_text(json.dumps(payload), encoding="utf-8")
            r = subprocess.run([sys.executable, str(BUILD), "--src", str(src), "--out", str(out)],
                               capture_output=True, text=True, encoding="utf-8", errors="replace")
            self.assertEqual(r.returncode, 0, r.stderr)
            grid = json.loads(out.read_text(encoding="utf-8"))
            head = json.loads((d / "branding-grid-head.json").read_text(encoding="utf-8"))
            return {"grid": grid, "head": head}

    def _local_file(self, d: Path) -> Path:
        f = d / "Logo Dobra Kaloria.png"
        f.write_bytes(b"\x89PNG old copy")
        os.utime(f, (DISK_S, DISK_S))
        return f

    def test_rows_catalog_mtime_wins_over_local_disk(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            f = self._local_file(Path(tmp))
            res = self._run({"version": 1, "source": "rows", "assets": [_asset(f, mtime_ms=CATALOG_MS)]})
        self.assertEqual(res["grid"]["assets"][0]["mtime_ms"], CATALOG_MS)
        self.assertEqual(res["head"]["assets"][0]["mtime_ms"], CATALOG_MS)

    def test_rows_without_mtime_is_not_filled_from_disk(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            f = self._local_file(Path(tmp))
            res = self._run({"version": 1, "source": "rows", "assets": [_asset(f)]})
        self.assertNotIn("mtime_ms", res["grid"]["assets"][0])

    def test_same_catalog_gives_same_grid_regardless_of_disk(self) -> None:
        """B (starsza kopia) i C (brak pliku) buduja siatke z tego samego katalogu."""
        with tempfile.TemporaryDirectory() as tmp:
            f = self._local_file(Path(tmp))
            on_b = self._run({"version": 1, "source": "rows", "assets": [_asset(f, mtime_ms=CATALOG_MS)]})
        on_c = self._run({"version": 1, "source": "rows",
                          "assets": [_asset(Path("Z:/nie-ma/Logo Dobra Kaloria.png"), mtime_ms=CATALOG_MS)]})
        strip = lambda a: {k: v for k, v in a.items() if k not in ("path",)}  # noqa: E731
        self.assertEqual([strip(a) for a in on_b["grid"]["assets"]], [strip(a) for a in on_c["grid"]["assets"]])

    def test_legacy_index_without_mtime_still_gets_disk_date(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            f = self._local_file(Path(tmp))
            res = self._run({"assets": [_asset(f)]})
        self.assertEqual(res["grid"]["assets"][0]["mtime_ms"], DISK_S * 1000)

    def test_legacy_index_with_mtime_keeps_index_value(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            f = self._local_file(Path(tmp))
            res = self._run({"assets": [_asset(f, mtime_ms=CATALOG_MS)]})
        self.assertEqual(res["grid"]["assets"][0]["mtime_ms"], CATALOG_MS)


if __name__ == "__main__":
    unittest.main()
