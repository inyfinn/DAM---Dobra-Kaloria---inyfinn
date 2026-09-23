# -*- coding: utf-8 -*-
"""Epoka migracji asset_id (stare id -> stabilne br-0########, ADR-011 follow-up).

Gdy PG oglasza nowa epoke (dam_meta.asset_id_epoch), kazdy komputer z lokalnymi
wierszami o starych id ma je sam wyczyscic i pobrac skojarzenia z PG od nowa -
bez recznej roboty. Reczne decyzje (confirmed/rejected/skipped, dirty=1) o starym
id nie znikaja po cichu - trafiaja najpierw do pliku *.epoch-<epoka>-lost-manual.json.
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import assoc_repo  # noqa: E402
import assoc_sync  # noqa: E402


def _insert(conn, rows):
    conn.executemany(
        "INSERT INTO asset_product_links"
        "(asset_id, product_id, score, source, status, reason, updated_at, updated_by, dirty) "
        "VALUES(?,?,?,?,?,?,?,?,?)",
        rows,
    )
    conn.commit()


def _all_rows(conn):
    return {
        (r["asset_id"], r["product_id"]): dict(r)
        for r in conn.execute(
            "SELECT asset_id, product_id, score, source, status, reason, updated_at, "
            "updated_by, dirty FROM asset_product_links"
        ).fetchall()
    }


class IsLegacyAssetIdTests(unittest.TestCase):
    def test_legacy_patterns_match(self):
        self.assertTrue(assoc_sync._is_legacy_asset_id("br-010745"))
        self.assertTrue(assoc_sync._is_legacy_asset_id("M-SHOP405510-03-26"))

    def test_stable_id_does_not_match(self):
        self.assertFalse(assoc_sync._is_legacy_asset_id("br-012345678"))
        self.assertFalse(assoc_sync._is_legacy_asset_id(""))
        self.assertFalse(assoc_sync._is_legacy_asset_id(None))


class ApplyEpochTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "t.sqlite"
        self.conn = assoc_repo.connect(self.db)

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def test_no_server_epoch_changes_nothing(self):
        _insert(self.conn, [
            ("br-010745", "p1", 80, "ocr", "auto", "", "t", "ocr", 1),
        ])
        before = _all_rows(self.conn)
        result = assoc_sync._apply_epoch(self.conn, "", self.db)
        self.assertIsNone(result)
        self.assertEqual(_all_rows(self.conn), before)
        self.assertEqual(assoc_sync._get_state(self.conn, "asset_id_epoch"), "")

    def test_new_epoch_removes_legacy_keeps_stable_and_saves_manual(self):
        _insert(self.conn, [
            ("br-010745", "p1", 80, "ocr", "auto", "", "t1", "ocr", 1),
            ("br-010746", "p2", 60, "ocr", "pending", "", "t2", "ocr", 1),
            ("M-SHOP405510-03-26", "p3", 50, "ocr", "auto", "", "t3", "ocr", 1),
            # reczna decyzja o starym id, dirty=1 - musi trafic do pliku lost-manual
            ("br-010747", "p4", 100, "manual", "confirmed", "", "t4", "user", 1),
            # nowe, stabilne id - maja zostac nietkniete
            ("br-012345678", "p5", 100, "manual", "confirmed", "", "t5", "user", 1),
            ("br-012345679", "p6", 90, "ocr", "auto", "", "t6", "ocr", 0),
        ])
        assoc_sync._set_state(self.conn, "pg_rev", "999")
        self.conn.commit()

        result = assoc_sync._apply_epoch(self.conn, "stable-1", self.db)

        self.assertEqual(result["epoch"], "stable-1")
        self.assertEqual(result["removed_legacy"], 4)
        self.assertEqual(result["saved_manual"], 1)

        remaining = _all_rows(self.conn)
        self.assertEqual(set(remaining.keys()), {("br-012345678", "p5"), ("br-012345679", "p6")})

        self.assertEqual(assoc_sync._get_state(self.conn, "pg_rev"), "0")
        self.assertEqual(assoc_sync._get_state(self.conn, "asset_id_epoch"), "stable-1")

        lost_path = Path(str(self.db) + ".epoch-stable-1-lost-manual.json")
        self.assertTrue(lost_path.is_file())
        saved = json.loads(lost_path.read_text(encoding="utf-8"))
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]["asset_id"], "br-010747")
        self.assertEqual(saved[0]["product_id"], "p4")
        self.assertEqual(saved[0]["status"], "confirmed")

    def test_second_call_same_epoch_is_noop(self):
        _insert(self.conn, [
            ("br-010745", "p1", 80, "ocr", "auto", "", "t1", "ocr", 1),
            ("br-012345678", "p5", 100, "manual", "confirmed", "", "t5", "user", 1),
        ])
        first = assoc_sync._apply_epoch(self.conn, "stable-1", self.db)
        self.assertIsNotNone(first)

        # Symuluj kolejny cykl: cos nowego lokalnie, ale epoka sie nie zmienila.
        _insert(self.conn, [
            ("br-012345680", "p7", 70, "ocr", "auto", "", "t7", "ocr", 1),
        ])
        before = _all_rows(self.conn)
        second = assoc_sync._apply_epoch(self.conn, "stable-1", self.db)
        self.assertIsNone(second)
        self.assertEqual(_all_rows(self.conn), before)


class SplitLegacyForPushTests(unittest.TestCase):
    """Filtr bezpieczenstwa w _push: stare id nigdy nie leca do PG."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "t.sqlite"
        self.conn = assoc_repo.connect(self.db)

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def test_split_legacy_separates_old_and_new(self):
        _insert(self.conn, [
            ("br-010745", "p1", 80, "ocr", "auto", "", "t1", "ocr", 1),
            ("M-SHOP405510-03-26", "p2", 50, "ocr", "auto", "", "t2", "ocr", 1),
            ("br-012345678", "p3", 100, "manual", "confirmed", "", "t3", "user", 1),
        ])
        rows = self.conn.execute(
            "SELECT asset_id, product_id, score, source, status, reason, updated_at, updated_by "
            "FROM asset_product_links WHERE dirty=1"
        ).fetchall()
        ok, legacy = assoc_sync._split_legacy(rows)
        self.assertEqual([r["asset_id"] for r in ok], ["br-012345678"])
        self.assertEqual(
            sorted(r["asset_id"] for r in legacy),
            ["M-SHOP405510-03-26", "br-010745"],
        )


class _KeysPG:
    """Atrapa PG: dam_meta.assoc_reconcile + lista kluczy dam_asset_product_links."""

    def __init__(self, tag, keys):
        self.tag, self.keys, self._rows = tag, keys, []

    def cursor(self):
        return self

    def execute(self, sql, params=None):
        if "dam_meta" in sql:
            self._rows = [{"value": self.tag}] if self.tag else []
        else:
            self._rows = [{"asset_id": a, "product_id": p} for a, p in self.keys]

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)


class ApplyReconcileTests(unittest.TestCase):
    """23.09: twarde DELETE w PG (ponowne zasianie) nie docieralo do innych komputerow."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "t.sqlite"
        self.conn = assoc_repo.connect(self.db)
        _insert(self.conn, [
            ("br-012345678", "tuba", 80, "ocr", "auto", "", "t1", "ocr", 0),     # skasowany w PG
            ("br-012345678", "ciasto", 80, "ocr", "auto", "", "t1", "ocr", 0),   # jest w PG
            ("br-087654321", "figa", 100, "manual", "confirmed", "", "t2", "u", 1),  # niewyslany
        ])
        self.conn.execute("UPDATE asset_product_links SET dirty=0 WHERE product_id<>'figa'")
        self.conn.commit()

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def test_removes_rows_missing_in_pg_keeps_unpushed(self):
        pg = _KeysPG("reseed-1", [("br-012345678", "ciasto")])
        tag = assoc_sync._server_reconcile(pg)
        res = assoc_sync._apply_reconcile(self.conn, pg, tag, self.db)
        self.assertEqual(res, {"tag": "reseed-1", "removed": 1, "kept_manual": 0})
        self.assertEqual(set(_all_rows(self.conn)),
                         {("br-012345678", "ciasto"), ("br-087654321", "figa")})
        saved = json.loads(Path(str(self.db) + ".reconcile-reseed-1.json").read_text(encoding="utf-8"))
        self.assertEqual([(r["asset_id"], r["product_id"]) for r in saved], [("br-012345678", "tuba")])

    def test_manual_decision_missing_in_pg_is_kept_and_pushed_back(self):
        _insert(self.conn, [("br-022222222", "kulki", 100, "manual", "rejected", "", "t3", "u", 0)])
        self.conn.execute("UPDATE asset_product_links SET dirty=0 WHERE product_id='kulki'")
        self.conn.commit()
        pg = _KeysPG("reseed-2", [("br-012345678", "ciasto")])
        res = assoc_sync._apply_reconcile(self.conn, pg, "reseed-2", self.db)
        self.assertEqual(res["kept_manual"], 1)
        rows = _all_rows(self.conn)
        self.assertIn(("br-022222222", "kulki"), rows)
        self.assertEqual(rows[("br-022222222", "kulki")]["dirty"], 1)   # wraca do PG
        self.assertNotIn(("br-012345678", "tuba"), rows)                # automat znika

    def test_same_tag_twice_and_no_tag_are_noop(self):
        pg = _KeysPG("reseed-1", [])
        assoc_sync._apply_reconcile(self.conn, pg, "reseed-1", self.db)
        before = _all_rows(self.conn)
        _insert(self.conn, [("br-011111111", "nowy", 1, "ocr", "auto", "", "t", "ocr", 2)])
        self.assertIsNone(assoc_sync._apply_reconcile(self.conn, pg, "reseed-1", self.db))
        self.assertIsNone(assoc_sync._apply_reconcile(self.conn, _KeysPG("", []), "", self.db))
        self.assertEqual(len(_all_rows(self.conn)), len(before) + 1)


if __name__ == "__main__":
    unittest.main()
