# -*- coding: utf-8 -*-
"""Faza 2 "jedno zrodlo prawdy": lokalny magazyn (asset_repo.py).

Atrapa PostgreSQL: FakePG z test_asset_sync.py (SQLite wykonujace te same
zapytania SQL co modul). Atrapa psycopg2.extras.execute_values: wstrzykniety
modul w sys.modules (psycopg2 nie musi byc zainstalowany w srodowisku testow) -
wykonuje po jednym execute() na wiersz na tym samym FakeCursor, wiec warunki
ON CONFLICT / RETURNING sa naprawde sprawdzane przez SQLite, nie udawane w
Pythonie. Zero polaczen sieciowych i prawdziwego PostgreSQL/SQLite na dysku.
"""
from __future__ import annotations

import sqlite3
import sys
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asset_sync  # noqa: E402
import asset_repo  # noqa: E402
from test_asset_sync import FakePG  # noqa: E402


def _install_fake_psycopg2() -> None:
    """execute_values atrapa: rozwija template per wiersz i wykonuje na FakeCursor."""
    if "psycopg2" not in sys.modules:
        sys.modules["psycopg2"] = types.ModuleType("psycopg2")
    extras = types.ModuleType("psycopg2.extras")

    def execute_values(cur, sql, argslist, template=None, page_size=100, fetch=False):
        results = []
        single_sql = sql.replace("VALUES %s", "VALUES " + template) if template else sql
        for row in argslist:
            cur.execute(single_sql, row)
            if fetch:
                r = cur.fetchone()
                if r is not None:
                    results.append(r)
        return results if fetch else None

    extras.execute_values = execute_values
    sys.modules["psycopg2.extras"] = extras
    sys.modules["psycopg2"].extras = extras


_install_fake_psycopg2()


P = "- POLSKA/1 - PRODUKTY/Klopsiki 6300576"
Q = "- POLSKA/1 - PRODUKTY/Figi z makiem 6300111"


def _index_assets(prefix: str, n: int, *, root: str, mtime: int = 1_000_000) -> list[dict]:
    """Wpisy jak z branding-index.json - z polami, ktore MAJA byc pominiete w meta."""
    out = []
    for i in range(n):
        rel = f"{prefix}/4 - WIZKI/wiz-{i:02d}.png"
        out.append({
            "path": f"{root}/{rel}",
            "size": 1000 + i,
            "mtime_ms": mtime,
            "id": f"br-{i:06d}",                      # stary licznikowy id - ma zniknac
            "sku": "6300576",
            "media_type": "wizka",
            "linked_product_ids": ["p1", "p2"],        # liczone z bazy - ma zniknac
            "linked_products": [{"id": "p1"}],         # liczone z bazy - ma zniknac
            "folder_linked_product_ids": ["p1"],       # liczone z bazy - ma zniknac
        })
    return out


class RoundtripTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        asset_repo.ensure_local(self.conn)

    def test_rows_roundtrip_and_only_ids_partial_save(self):
        row_a = {"asset_id": "a", "asset_key": "k/a.png", "path_rel": "k/a.png",
                 "name": "a.png", "size": 1, "mtime_ms": 10, "content_hash": None,
                 "meta": {"sku": "1"}, "deleted_at": None, "updated_at": 5,
                 "updated_by": "M", "seen_by_machine": "M", "rev": 3}
        rows = {"a": dict(row_a)}
        asset_repo.save_rows(self.conn, rows)
        loaded = asset_repo.load_rows(self.conn)
        self.assertEqual(loaded, {"a": asset_sync.normalize_row(row_a)})

        # only_ids: dopisujemy "b" w pamieci, ale zapisujemy tylko "a" - "b" nie trafia do bazy.
        rows["a"]["rev"] = 4
        rows["b"] = {"asset_id": "b", "asset_key": "k/b.png", "rev": 1}
        asset_repo.save_rows(self.conn, rows, only_ids=["a"])
        loaded2 = asset_repo.load_rows(self.conn)
        self.assertEqual(set(loaded2), {"a"})
        self.assertEqual(loaded2["a"]["rev"], 4)

        # Teraz zapisujemy "b" tez.
        asset_repo.save_rows(self.conn, rows, only_ids=["b"])
        loaded3 = asset_repo.load_rows(self.conn)
        self.assertEqual(set(loaded3), {"a", "b"})

    def test_state_roundtrip(self):
        self.assertEqual(asset_repo.get_state(self.conn, "missing", "def"), "def")
        asset_repo.set_state(self.conn, "k", "v1")
        self.assertEqual(asset_repo.get_state(self.conn, "k"), "v1")
        asset_repo.set_state(self.conn, "k", "v2")   # upsert nadpisuje
        self.assertEqual(asset_repo.get_state(self.conn, "k"), "v2")

    def test_last_seen_none_vs_empty_list(self):
        self.assertIsNone(asset_repo.load_last_seen(self.conn))   # nigdy nie skanowano
        asset_repo.save_last_seen(self.conn, [])
        seen = asset_repo.load_last_seen(self.conn)
        self.assertIsNotNone(seen)                                 # skan byl, nic nie widzial
        self.assertEqual(seen, set())
        asset_repo.save_last_seen(self.conn, ["x", "y", "x"])
        self.assertEqual(asset_repo.load_last_seen(self.conn), {"x", "y"})

    def test_pg_rev_roundtrip_default_zero(self):
        self.assertEqual(asset_repo.get_pg_rev(self.conn), 0)
        asset_repo.set_pg_rev(self.conn, 42)
        self.assertEqual(asset_repo.get_pg_rev(self.conn), 42)


class ImportAndLiveIndexTests(unittest.TestCase):
    def setUp(self):
        self.pg = FakePG()
        self.root = "M:/Marketing"
        self.assets = _index_assets(P, 12, root=self.root) + _index_assets(Q, 12, root=self.root)

    def test_scan_from_index_keeps_folder_links_strips_heavy_objects(self):
        """Skojarzenia z kontekstu folderu nie sa w bazie - kopia bez ROOT ich potrzebuje."""
        scan = asset_repo.scan_from_index(self.assets, self.root)
        self.assertEqual(len(scan), 24)
        for entry in scan.values():
            self.assertEqual(entry["meta"]["linked_product_ids"], ["p1", "p2"])
            self.assertEqual(entry["meta"]["folder_linked_product_ids"], ["p1"])
            self.assertNotIn("linked_products", entry["meta"])
            self.assertNotIn("id", entry["meta"])
            self.assertNotIn("path", entry["meta"])
            self.assertNotIn("mtime_ms", entry["meta"])
            self.assertEqual(entry["meta"]["sku"], "6300576")

    def test_size_label_stays_in_meta_and_bytes_are_numeric_or_none(self):
        """23.09: "size" w branding-index to etykieta wizki ("L") - import do BIGINT padal."""
        assets = [dict(self.assets[0], size="L"), dict(self.assets[1], size=1234)]
        scan = asset_repo.scan_from_index(assets, self.root)
        by_label = {e["meta"].get("size"): e for e in scan.values()}
        self.assertIsNone(by_label["L"]["size"])
        self.assertEqual(by_label[1234]["size"], 1234)

    def test_colliding_ids_from_index_are_kept_not_merged(self):
        """23.09: 8 par plikow z tym samym 8-cyfrowym skrotem - build nadal drugiemu
        przesuniete id, a scan_from_index liczyl od nowa i sklejal je w jeden wiersz."""
        a = dict(self.assets[0], id="br-000000001")
        b = dict(self.assets[1], id="br-000000002")
        scan = asset_repo.scan_from_index([a, b], self.root)
        self.assertEqual(set(scan), {"br-000000001", "br-000000002"})
        self.assertEqual(scan["br-000000001"]["name"], "wiz-00.png")
        self.assertEqual(scan["br-000000002"]["name"], "wiz-01.png")

    def test_index_id_owned_by_other_file_in_rows_is_reassigned(self):
        a = dict(self.assets[0], id="br-000000001")
        taken = {"br-000000001": "- polska/inny/plik.png"}
        scan = asset_repo.scan_from_index([a], self.root, taken=taken)
        (aid,) = scan
        self.assertNotEqual(aid, "br-000000001")
        self.assertEqual(scan[aid]["name"], "wiz-00.png")

    def test_file_known_in_rows_keeps_row_id_over_index_id(self):
        """23.09: nowy build dal plikowi inne id niz w bazie -> duplikat asset_key w PG."""
        a = dict(self.assets[0], id="br-000000009")
        key = asset_sync.dir_key(a["path"], self.root)
        scan = asset_repo.scan_from_index([a], self.root, taken={"br-000000001": key})
        self.assertEqual(list(scan), ["br-000000001"])

    def test_path_outside_root_is_stored_without_drive_letter(self):
        """23.09: indeks z M:/ i korzen X:/Marketing -> path_rel "M:/..." i sciezki M:/M:/."""
        scan = asset_repo.scan_from_index(
            [{"path": f"M:/{P}/a.png", "mtime_ms": 1}], "X:/Marketing")
        (entry,) = scan.values()
        self.assertEqual(entry["path_rel"], f"{P}/a.png")
        (live,) = asset_repo.live_index({"x": dict(entry, asset_id="x", rev=1)}, "M:")
        self.assertEqual(live["path"], f"M:/{P}/a.png")

    def test_nfd_path_kept_as_on_disk_key_in_nfc(self):
        import unicodedata
        nfd = unicodedata.normalize("NFD", f"{self.root}/{P}/cień.tif")
        scan = asset_repo.scan_from_index([{"path": nfd, "mtime_ms": 1}], self.root)
        (entry,) = scan.values()
        self.assertEqual(entry["path_rel"], nfd[len(self.root) + 1:])
        self.assertEqual(entry["asset_key"], unicodedata.normalize("NFC", entry["asset_key"]))

    def test_live_index_keeps_size_label(self):
        scan = asset_repo.scan_from_index([dict(self.assets[0], size="S_SKLEP")], self.root)
        rows = {aid: dict(e, rev=1) for aid, e in scan.items()}
        (entry,) = asset_repo.live_index(rows, self.root)
        self.assertEqual(entry["size"], "S_SKLEP")

    def test_import_then_scan_again_is_consistent_zero_ops(self):
        scan = asset_repo.scan_from_index(self.assets, self.root)
        res = asset_repo.import_index_to_pg(self.pg, self.assets, self.root, "M-FIRMA", batch=5)
        self.assertTrue(res["ok"])
        self.assertEqual(res["inserted"], 24)
        self.assertEqual(res["skipped_existing"], 0)

        pulled = asset_sync.pull_since(self.pg, 0)
        self.assertTrue(pulled["ok"])
        prev_rows = asset_sync.apply_remote({}, pulled["rows"])
        self.assertEqual(len(prev_rows), 24)

        ops = asset_sync.diff_scan(prev_rows, scan, {""}, 99_000_000, "M-FIRMA",
                                   last_seen=set(scan.keys()))
        self.assertEqual(ops, [])

    def test_import_in_batches_on_conflict_do_nothing(self):
        res1 = asset_repo.import_index_to_pg(self.pg, self.assets, self.root, "M-FIRMA", batch=7)
        self.assertEqual((res1["inserted"], res1["skipped_existing"]), (24, 0))

        # Drugi import tych samych danych: ON CONFLICT DO NOTHING - nic sie nie zmienia,
        # nawet gdyby "nowe" dane mialy inna tresc (import nigdy nie nadpisuje).
        changed = [dict(a, size=999999) for a in self.assets]
        res2 = asset_repo.import_index_to_pg(self.pg, changed, self.root, "X-DOM", batch=7)
        self.assertEqual((res2["inserted"], res2["skipped_existing"]), (0, 24))

        f = f"{P}/4 - WIZKI/wiz-00.png"
        self.assertEqual(self.pg.row(f)["size"], 1000)          # nie 999999
        self.assertEqual(self.pg.row(f)["updated_by"], "M-FIRMA:import")

    def test_import_does_not_overwrite_a_newer_row_written_after_import(self):
        asset_repo.import_index_to_pg(self.pg, self.assets, self.root, "M-FIRMA", batch=100)
        f = f"{P}/4 - WIZKI/wiz-01.png"
        aid, entry = asset_sync.scan_entry(f"{self.root}/{f}", size=42, mtime_ms=5_000_000,
                                            root=self.root)
        op = asset_sync._op("upsert", aid, entry, None, "M-FIRMA", 1, "change")
        push = asset_sync.push_ops(self.pg, [op], now_ms=1)
        self.assertEqual(push["applied"], 1)

        # Ponowny import (np. innym batchem) nie cofa nowszej wersji.
        res = asset_repo.import_index_to_pg(self.pg, self.assets, self.root, "M-FIRMA", batch=3)
        self.assertEqual(res["inserted"], 0)
        self.assertEqual(self.pg.row(f)["size"], 42)
        self.assertEqual(self.pg.row(f)["mtime_ms"], 5_000_000)

    def test_live_index_reproduces_assets_with_other_root(self):
        asset_repo.import_index_to_pg(self.pg, self.assets, self.root, "M-FIRMA", batch=100)
        pulled = asset_sync.pull_since(self.pg, 0)
        rows = asset_sync.apply_remote({}, pulled["rows"])

        live_m = asset_repo.live_index(rows, "M:/Marketing")
        live_x = asset_repo.live_index(rows, "X:/Marketing")
        self.assertEqual(len(live_m), 24)
        self.assertEqual(len(live_x), 24)

        rel = f"{P}/4 - WIZKI/wiz-00.png"
        entry_m = next(e for e in live_m if e["path"] == f"M:/Marketing/{rel}")
        entry_x = next(e for e in live_x if e["path"] == f"X:/Marketing/{rel}")
        self.assertEqual(entry_m["id"], entry_x["id"])           # ten sam stabilny id
        self.assertEqual(entry_m["sku"], "6300576")
        self.assertEqual(entry_x["sku"], "6300576")
        self.assertEqual(entry_m["name"], "wiz-00.png")

        # Kolejnosc stabilna po path w obu przypadkach.
        self.assertEqual([e["path"] for e in live_m], sorted(e["path"] for e in live_m))
        self.assertEqual([e["path"] for e in live_x], sorted(e["path"] for e in live_x))


if __name__ == "__main__":
    unittest.main()
