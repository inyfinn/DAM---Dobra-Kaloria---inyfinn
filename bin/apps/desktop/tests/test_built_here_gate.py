# -*- coding: utf-8 -*-
"""PLAN Faza 3, zadanie 3.4 (incydent instalatora, 27.09.2026): swiezy komputer z
ROOT trzymal plik file-index.json wgrany INSTALATOREM (mtime maszyny budujacej,
nowszy niz built_at w bazie) i publikowal GO do bazy dla wszystkich - bo pull_newer
uznawal "lokalny nowszy = swiezy" bez sprawdzenia, czy TEN komputer go w ogole
zbudowal. index_snapshots.mark_built_here() + _is_built_here() to naprawiaja:
publikacja i regula "lokalny wygrywa" dzialaja TYLKO dla pliku, ktory ten proces
sam oznaczyl jako zbudowany lokalnie.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_snapshots as ix  # noqa: E402


class FakeDb:
    def __init__(self):
        self.rows: dict[str, dict] = {}

    def publish_index_snapshot(self, key, raw, *, sha256, built_at, built_by="", item_count=0):
        gen = int(time.time() * 1000) + len(self.rows)
        self.rows[key] = {"raw": raw, "sha256": sha256, "generation": gen,
                          "built_at": built_at, "built_by": built_by, "published_at": built_at,
                          "raw_bytes": len(raw)}
        return {"ok": True, "changed": True, "generation": gen}

    def index_snapshot_meta(self):
        return {k: {kk: v for kk, v in r.items() if kk != "raw"} | {"store_key": k}
                for k, r in self.rows.items()}

    def fetch_index_snapshot(self, key):
        r = self.rows.get(key)
        if not r:
            return None
        return {"store_key": key, "generation": r["generation"], "sha256": r["sha256"],
                "built_at": r["built_at"], "built_by": r["built_by"]}, r["raw"]


def _write(path: Path, payload: dict, mtime: float | None = None) -> bytes:
    raw = json.dumps(payload).encode("utf-8") + b" " * 1100  # > MIN_BYTES
    path.write_bytes(raw)
    if mtime is not None:
        os.utime(path, (mtime, mtime))
    return raw


class BuiltHereGateTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.server = self.base / "server" / "data"
        self.fresh = self.base / "fresh-pc" / "data"
        self.server.mkdir(parents=True)
        self.fresh.mkdir(parents=True)

        self.db = FakeDb()
        self.state_dir = self.base / "state-server"  # domyslnie: maszyna "server"
        p = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)
        p2 = mock.patch.dict(sys.modules, {"pg_db": self.db})
        p2.start()
        self.addCleanup(p2.stop)

    def _as(self, who: str) -> None:
        """Kazda symulowana maszyna ma WLASNY katalog stanu (index-snapshots.json) -
        tak jak w produkcji (platform_compat.user_state_dir() per komputer). Bez
        tego dwie 'maszyny' w jednym tescie dzielilyby ten sam stan, w tym
        built_here_sha - i test niczego by nie sprawdzal."""
        self.state_dir = self.base / f"state-{who}"

    # ------------------------------------------------------------------
    # Incydent instalatora: plik "z instalatora" nigdy nie wychodzi z powrotem
    # ------------------------------------------------------------------
    def test_plik_z_instalatora_nie_jest_publikowany_i_zostaje_zastapiony(self):
        # Serwer (osobny stan) publikuje prawdziwa, zbudowana wersje.
        self._as("server")
        _write(self.server / "file-index.json", {"v": "prawdziwa z serwera"})
        ix.mark_built_here("file-index", self.server / "file-index.json")
        ix.publish_changed(self.server, root_alive=True)
        self.assertIn("file-index", self.db.rows)

        # Swiezy komputer (WLASNY, pusty stan - jak swiezy install): plik "z
        # instalatora" (mtime NOWSZY niz built_at w bazie, bo maszyna budujaca
        # instalator miala go u siebie pozniej), ale ten proces NIGDY nie wywolal
        # mark_built_here dla niego.
        self._as("fresh")
        future = time.time() + 3600
        _write(self.fresh / "file-index.json", {"v": "z instalatora, stara tresc"}, mtime=future)

        pull = ix.pull_newer(self.fresh, root_alive=True)
        # Stara regula wziela by lokalny plik za "swiezy" (nowszy mtime) - nowa
        # regula wymaga _is_built_here, ktorego tu nie ma -> pobiera z bazy.
        self.assertEqual([x["key"] for x in pull["pulled"]], ["file-index"])
        self.assertIn(b"prawdziwa z serwera", (self.fresh / "file-index.json").read_bytes())

        # I nawet gdyby ktos teraz wywolal publish_changed na tym komputerze -
        # plik pochodzi z bazy (pulled_sha), wiec _is_built_here dalej False.
        pub = ix.publish_changed(self.fresh, root_alive=True)
        self.assertEqual(pub.get("published"), [])
        self.assertIn("file-index", pub.get("refused_not_built_here", []))

    def test_po_udanym_buildzie_komputer_publikuje(self):
        self._as_pc()
        _write(self.server / "file-index.json", {"v": 1})
        ix.mark_built_here("file-index", self.server / "file-index.json")
        res = ix.publish_changed(self.server, root_alive=True)
        self.assertEqual(res["published"], ["file-index"])

    def test_komputer_po_aktualizacji_bez_built_here_sha_ale_z_published_sha_publikuje_dalej(self):
        """Zgodnosc wstecz: stan z wersji SPRZED tej zmiany (tylko published_sha +
        source=local, bez built_here_sha) nadal ma prawo publikowac ten sam plik -
        inaczej zloty komputer przestalby publikowac az do nastepnego skanu."""
        self._as_pc()
        _write(self.server / "file-index.json", {"v": "stabilna wersja"})
        sha = ix._sha256_cached(self.server / "file-index.json", {})

        # Symulacja stanu SPRZED tej zmiany: published_sha i source, bez built_here_sha.
        state = {"file-index": {"published_sha": sha, "source": "local"}}
        (self.state_dir).mkdir(parents=True, exist_ok=True)
        (self.state_dir / "index-snapshots.json").write_text(json.dumps(state), encoding="utf-8")

        res = ix.publish_changed(self.server, root_alive=True)
        self.assertIn("file-index", res.get("unchanged", []) + res.get("published", []))
        self.assertNotIn("file-index", res.get("refused_not_built_here", []))

    def test_bezpiecznik_80_procent_dziala_mimo_built_here(self):
        self._as_pc()
        _write(self.server / "file-index.json", {"v": "x" * 2000})
        ix.mark_built_here("file-index", self.server / "file-index.json")
        ix.publish_changed(self.server, root_alive=True)  # baza ma duzy plik

        # Ten sam komputer buduje DUZO mniejszy plik (niepelny skan) i oznacza go
        # jako built_here - bezpiecznik 80% ma go i tak zablokowac.
        _write(self.server / "file-index.json", {"v": "y"})
        ix.mark_built_here("file-index", self.server / "file-index.json")
        res = ix.publish_changed(self.server, root_alive=True)
        self.assertTrue(any(r["key"] == "file-index" for r in res.get("refused_shrink", [])))

    def _as_pc(self):
        self.state_dir = self.base / "state-pc"


if __name__ == "__main__":
    unittest.main()
