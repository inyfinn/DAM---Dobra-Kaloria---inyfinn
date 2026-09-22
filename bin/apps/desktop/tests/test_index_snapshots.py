# -*- coding: utf-8 -*-
"""Lista materialow z indeksu w bazie (dam_index_snapshots).

22.09.2026: komputer bez folderu Marketing pokazywal skan z 14.09 wgrany instalatorem,
choc PC firmowy mial swiezy. Komputer z folderem publikuje skan, reszta go pobiera.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import time
import types
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_snapshots as ix  # noqa: E402


class FakeDb:
    """Minimalna tabela dam_index_snapshots w pamieci."""

    def __init__(self):
        self.rows: dict[str, dict] = {}
        self.fetches = 0

    def publish_index_snapshot(self, key, raw, *, sha256, built_at, built_by="", item_count=0):
        cur = self.rows.get(key)
        if cur and cur["sha256"] == sha256:
            return {"ok": True, "changed": False, "generation": cur["generation"]}
        gen = int(time.time() * 1000) + len(self.rows)
        self.rows[key] = {"raw": raw, "sha256": sha256, "generation": gen, "built_at": built_at,
                          "built_by": built_by, "published_at": built_at}
        return {"ok": True, "changed": True, "generation": gen}

    def index_snapshot_meta(self):
        return {k: {kk: v for kk, v in r.items() if kk != "raw"} | {"store_key": k} for k, r in self.rows.items()}

    def fetch_index_snapshot(self, key):
        self.fetches += 1
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


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.pc_firmowy = self.base / "pc" / "data"
        self.laptop = self.base / "laptop" / "data"
        for d in (self.pc_firmowy, self.laptop):
            d.mkdir(parents=True)
        self.db = FakeDb()
        self.state_dir = self.base / "state-pc"
        p = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)
        p2 = mock.patch.dict(sys.modules, {"pg_db": self.db})
        p2.start()
        self.addCleanup(p2.stop)

    def _as(self, who: str):
        self.state_dir = self.base / f"state-{who}"

    def test_pc_z_folderem_publikuje_laptop_pobiera(self):
        self._as("pc")
        fresh = _write(self.pc_firmowy / "branding-search-index.json", {"skan": "22.09"})
        res = ix.publish_changed(self.pc_firmowy, root_alive=True)
        self.assertEqual(res["published"], ["branding-search-index"])

        self._as("laptop")
        _write(self.laptop / "branding-search-index.json", {"skan": "14.09"}, mtime=time.time() - 8 * 86400)
        seen = []
        res = ix.pull_newer(self.laptop, root_alive=False, on_updated=lambda k, p: seen.append(k))
        self.assertEqual([x["key"] for x in res["pulled"]], ["branding-search-index"])
        self.assertEqual((self.laptop / "branding-search-index.json").read_bytes(), fresh)
        self.assertEqual(seen, ["branding-search-index"])
        st = ix.status()["keys"]["branding-search-index"]
        self.assertEqual(st["source"], "db")

    def test_bez_folderu_nie_publikuje(self):
        self._as("laptop")
        _write(self.laptop / "file-index.json", {"stary": True})
        res = ix.publish_changed(self.laptop, root_alive=False)
        self.assertEqual(res.get("skipped"), "no_marketing_root")
        self.assertEqual(self.db.rows, {})

    def test_pobrany_skan_nie_wraca_do_bazy(self):
        self._as("pc")
        _write(self.pc_firmowy / "file-index.json", {"v": 1})
        ix.publish_changed(self.pc_firmowy, root_alive=True)
        gen = self.db.rows["file-index"]["generation"]
        self._as("laptop")
        ix.pull_newer(self.laptop, root_alive=False)
        # laptop dostaje folder Marketing, ale plik jest tylko kopia z bazy
        res = ix.publish_changed(self.laptop, root_alive=True)
        self.assertEqual(res["published"], [])
        self.assertEqual(self.db.rows["file-index"]["generation"], gen)

    def test_druga_proba_nie_pobiera_ponownie(self):
        self._as("pc")
        _write(self.pc_firmowy / "file-index.json", {"v": 2})
        ix.publish_changed(self.pc_firmowy, root_alive=True)
        self._as("laptop")
        ix.pull_newer(self.laptop, root_alive=False)
        ix.pull_newer(self.laptop, root_alive=False)
        self.assertEqual(self.db.fetches, 1)

    def test_komputer_z_folderem_nie_bierze_starszego(self):
        self._as("pc")
        _write(self.pc_firmowy / "file-index.json", {"v": "z bazy"}, mtime=time.time() - 3600)
        ix.publish_changed(self.pc_firmowy, root_alive=True)
        self._as("pc2")
        pc2 = self.base / "pc2" / "data"
        pc2.mkdir(parents=True)
        mine = _write(pc2 / "file-index.json", {"v": "swiezy lokalny"})
        res = ix.pull_newer(pc2, root_alive=True)
        self.assertEqual(res["pulled"], [])
        self.assertEqual((pc2 / "file-index.json").read_bytes(), mine)

    def test_rozdarty_plik_nie_idzie_do_bazy(self):
        self._as("pc")
        (self.pc_firmowy / "file-index.json").write_bytes(b'{"urwany": ' + b"x" * 2000)
        res = ix.publish_changed(self.pc_firmowy, root_alive=True)
        self.assertFalse(res["ok"])
        self.assertEqual(self.db.rows, {})


if __name__ == "__main__":
    unittest.main()
