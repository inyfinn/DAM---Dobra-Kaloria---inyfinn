# -*- coding: utf-8 -*-
"""Faza 3, zadanie 3.4 (27.09.2026): pamiec skanu (last_seen) nie ma klucza ROOT.
Po przelaczeniu ROOT na opozniona kopie, plik obecny w NOWYM ROOT a nieobecny w
last_seen STAREGO wygladalby jak "pojawil sie" i mogl przywrocic material, ktory
inny komputer uznal za usuniety gdzie indziej. asset_sync_runner.reset_scan_memory()
czysci last_seen + czas ostatniego skanu; lustro wierszy (asset_rows) i rev
zostaja. Po resecie pierwszy skan = jak pierwszy skan swiezego komputera (na
atrapie PG, tak jak test_asset_sync.py).
"""
from __future__ import annotations

import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asset_repo  # noqa: E402
import asset_sync  # noqa: E402
import asset_sync_runner  # noqa: E402


class ResetScanMemoryTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.db_path = Path(self._tmp.name) / "dam-local.sqlite"

    def _seed(self) -> None:
        conn = sqlite3.connect(str(self.db_path))
        try:
            asset_repo.ensure_local(conn)
            asset_repo.save_rows(conn, {
                "a1": {"asset_id": "a1", "asset_key": "p/a.jpg", "rev": 5, "mtime_ms": 10,
                       "deleted_at": None},
            })
            asset_repo.save_last_seen(conn, {"a1"})
            asset_repo.set_state(conn, "asset_sync_last_scan_time_ms", "123456")
            asset_repo.set_pg_rev(conn, 5) if hasattr(asset_repo, "set_pg_rev") else None
            conn.commit()
        finally:
            conn.close()

    def test_czysci_last_seen_i_czas_skanu_zostawia_wiersze(self):
        self._seed()
        res = asset_sync_runner.reset_scan_memory(self.db_path, reason="root_switch")
        self.assertTrue(res["ok"], res)

        conn = sqlite3.connect(str(self.db_path))
        try:
            self.assertIsNone(asset_repo.load_last_seen(conn))
            self.assertEqual(asset_repo.get_state(conn, "asset_sync_last_scan_time_ms"), "0")
            # lustro wierszy NIETKNIETE
            rows = asset_repo.load_rows(conn)
            self.assertIn("a1", rows)
            self.assertEqual(rows["a1"]["rev"], 5)
        finally:
            conn.close()

    def test_po_resecie_pierwszy_skan_nic_nie_usuwa_i_nic_nie_przywraca(self):
        """Symulacja: stary ROOT mial plik 'a1' (last_seen={'a1'}). Baza ma TAKZE
        tombstonowany 'a2' (usuniety gdzie indziej). Po zmianie ROOT na kopie,
        ktora ma TYLKO 'a3' (nie 'a1', nie 'a2') i resecie last_seen - skan nie
        usuwa 'a1' (nie byl scanowany jako brakujacy z last_seen skasowanym) ani
        nie przywraca 'a2' (last_seen=None wylacza "reappeared")."""
        prev_rows = {
            "a1": asset_sync.normalize_row({"asset_id": "a1", "asset_key": "p/a.jpg",
                                             "rev": 1, "mtime_ms": 10, "deleted_at": None}),
            "a2": asset_sync.normalize_row({"asset_id": "a2", "asset_key": "p/b.jpg",
                                             "rev": 2, "mtime_ms": 10, "deleted_at": 999}),
        }
        self._seed()
        asset_sync_runner.reset_scan_memory(self.db_path, reason="root_switch")

        conn = sqlite3.connect(str(self.db_path))
        try:
            last_seen = asset_repo.load_last_seen(conn)
        finally:
            conn.close()
        self.assertIsNone(last_seen)

        scan = {"a3": {"asset_key": "p/c.jpg", "path_rel": "p/c.jpg", "name": "c.jpg",
                       "size": 1, "mtime_ms": 20, "meta": {}}}
        report = asset_sync.diff_scan_report(
            prev_rows, scan, scanned_dirs=[""], scan_time_ms=1000, machine="ME",
            last_seen=last_seen,  # None - jak pierwszy skan swiezego komputera
        )
        ops_by_asset = {op["asset_id"]: op for op in report["ops"]}
        self.assertNotIn("a1", ops_by_asset)  # nic nie usuwa (last_seen=None -> zero tombstonow)
        self.assertNotIn("a2", ops_by_asset)  # nic nie przywraca (zero "reappeared")
        self.assertIn("a3", ops_by_asset)     # nowy plik nadal sie dodaje
        self.assertEqual(ops_by_asset["a3"]["op"], asset_sync.OP_UPSERT)

    def test_blad_bazy_zwraca_ok_false_nie_wyjatek(self):
        res = asset_sync_runner.reset_scan_memory(Path("Z:/nie-istnieje/nigdzie/dam.sqlite"), reason="x")
        # sqlite3.connect tworzy plik nawet w nieistniejacym katalogu -> OSError na connect
        self.assertFalse(res["ok"])
        self.assertIn("error", res)


if __name__ == "__main__":
    unittest.main()
