# -*- coding: utf-8 -*-
"""Faza 3 (PLAN-jedno-zrodlo-prawdy.md, zadanie 3.4): swiezy komputer bez ROOT musi
dostac metadane produktow z bazy od razu, nie tylko z lokalnie zbudowanego pliku,
i musi wystawiac stan "pierwsza synchronizacja: w toku/gotowa/bledna" zamiast cicho
pokazywac dane z instalatora do 10 minut.

27.09.2026: `meta_store.sync_from_file_index()` byl wolany TYLKO po lokalnym skanie
dysku (local_bridge.py, po build-file-index.py) - komputer bez ROOT nigdy nie robi
lokalnego skanu, wiec meta_products/meta_revisions/... zostawaly puste na zawsze,
mimo ze file-index.json przychodzil swiezy z PostgreSQL (index_snapshots.pull_newer).
"""
from __future__ import annotations

import json
import os
import sqlite3
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
import meta_store  # noqa: E402


class FakeDb:
    def __init__(self):
        self.rows: dict[str, dict] = {}

    def publish_index_snapshot(self, key, raw, *, sha256, built_at, built_by="", item_count=0):
        gen = int(time.time() * 1000) + len(self.rows)
        self.rows[key] = {"raw": raw, "sha256": sha256, "generation": gen,
                          "built_at": built_at, "built_by": built_by, "published_at": built_at}
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


def _write(path: Path, payload: dict) -> bytes:
    raw = json.dumps(payload).encode("utf-8") + b" " * 1100  # > MIN_BYTES
    path.write_bytes(raw)
    return raw


class MetaSyncAfterPullTests(unittest.TestCase):
    """pull_newer("file-index") na komputerze bez ROOT musi zaraz wypelnic FK sqlite."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.server_data = self.base / "server" / "data"
        self.fresh_data = self.base / "fresh-pc" / "data"
        self.server_data.mkdir(parents=True)
        self.fresh_data.mkdir(parents=True)

        self.db = FakeDb()
        self.state_dir = self.base / "state"
        p = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)
        p2 = mock.patch.dict(sys.modules, {"pg_db": self.db})
        p2.start()
        self.addCleanup(p2.stop)

        # meta_store operuje na jego wlasnym DB_PATH - przekieruj na temp plik.
        self.meta_db = self.base / "meta.sqlite"
        p3 = mock.patch.object(meta_store, "DB_PATH", self.meta_db)
        p3.start()
        self.addCleanup(p3.stop)

        ix._FIRST_SYNC.update(done=False, ok=None, started_at="", finished_at="")

    def test_pull_file_index_wypelnia_meta_store(self):
        # "serwer" publikuje file-index z jednym produktem
        _write(self.server_data / "file-index.json", {
            "products": [{"id": "tarta-malinowa", "name": "Tarta malinowa",
                          "display_name": "Tarta malinowa", "revisions": []}]
        })
        ix.publish_changed(self.server_data, root_alive=True)

        # przed pull: FK sqlite jest puste/nie istnieje
        st_before = meta_store.status()
        self.assertFalse(st_before.get("synced"))

        res = ix.pull_newer(self.fresh_data, root_alive=False)
        self.assertEqual([x["key"] for x in res["pulled"]], ["file-index"])

        st_after = meta_store.status()
        self.assertTrue(st_after.get("synced"))
        self.assertEqual(st_after.get("products"), 1)

    def test_first_sync_state_po_run_once(self):
        self.assertFalse(ix.first_sync_state()["done"])
        ix.run_once(self.fresh_data, root_alive_fn=lambda: False)
        state = ix.first_sync_state()
        self.assertTrue(state["done"])
        self.assertTrue(state["finished_at"])


class MetaStoreCorruptionRecoveryTests(unittest.TestCase):
    """meta_store musi odzyskac sie z uszkodzonego lokalnego sqlite (nigdy nie kasuje pliku)."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.db_path = Path(tmp.name) / "meta.sqlite"
        p = mock.patch.object(meta_store, "DB_PATH", self.db_path)
        p.start()
        self.addCleanup(p.stop)

    def test_odzysk_z_uszkodzonego_pliku(self):
        # Zbuduj prawdziwy sqlite, potem popsuj go w srodku (symulacja realnej korupcji).
        conn = sqlite3.connect(str(self.db_path))
        conn.execute("CREATE TABLE t (x INTEGER)")
        for i in range(200):
            conn.execute("INSERT INTO t VALUES (?)", (i,))
        conn.commit()
        conn.close()
        with open(self.db_path, "r+b") as fh:
            fh.seek(50)
            fh.write(b"\xff" * 100)

        conn2 = meta_store._connect()
        try:
            # Polaczenie musi dzialac (schemat pusty, ale funkcjonalny) - nie wyjatek.
            ensure_ok = conn2.execute("SELECT 1").fetchone()
            self.assertEqual(ensure_ok[0], 1)
        finally:
            conn2.close()

        # Oryginalny (uszkodzony) plik NIE zostal skasowany - odlozony z timestampem.
        quarantined = list(self.db_path.parent.glob(f"{self.db_path.name}.corrupt-*.bak"))
        self.assertEqual(len(quarantined), 1)
        # Nowy plik pod oryginalna nazwa jest swiezy i dziala.
        self.assertTrue(self.db_path.is_file())

    def test_sync_po_odzysku_dziala(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.execute("CREATE TABLE t (x INTEGER)")
        conn.commit()
        conn.close()
        with open(self.db_path, "r+b") as fh:
            fh.seek(50)
            fh.write(b"\x00" * 100)

        idx = self.db_path.parent / "file-index.json"
        idx.write_text(json.dumps({"products": [
            {"id": "p1", "name": "P1", "revisions": []},
        ]}), encoding="utf-8")
        res = meta_store.sync_from_file_index(idx)
        self.assertTrue(res.get("ok"), res)
        self.assertEqual(res.get("products"), 1)


if __name__ == "__main__":
    unittest.main()
