# -*- coding: utf-8 -*-
"""Faza 2: scalanie indeksu materialow jak Synology Drive (asset_sync.py).

Atrapa PostgreSQL = SQLite w pamieci, ktory wykonuje TE SAME zapytania SQL modulu
(tlumaczony jest tylko dialekt: %s -> ?, nextval -> MAX(rev)+1, IS DISTINCT FROM ->
IS NOT, blokada doradcza -> no-op). Dzieki temu warunki WHERE upsertu / tombstone /
restore sa naprawde sprawdzane, a nie udawane w Pythonie. Zero polaczen sieciowych.

Komputery w scenariuszach:
  M     - firmowy, M:/ = korzen Marketingu (zloty)
  X     - domowy, X:/Marketing = kopia przez Synology Drive (bywa nieaktualna)
  MAC   - bez folderu Marketing: tylko pobiera
"""
from __future__ import annotations

import sqlite3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asset_sync  # noqa: E402

_SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS dam_assets (
  asset_id TEXT PRIMARY KEY,
  asset_key TEXT NOT NULL,
  path_rel TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  size INTEGER,
  mtime_ms INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  deleted_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT '',
  seen_by_machine TEXT NOT NULL DEFAULT '',
  rev INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS dam_assets_key_idx ON dam_assets (asset_key);
"""


class FakeCursor:
    def __init__(self, db: "FakePG"):
        self.db = db
        self._cur = db.conn.cursor()
        self._rows: list = []

    def execute(self, sql: str, params=()):
        self.db.statements += 1
        if self.db.fail_on is not None and self.db.statements >= self.db.fail_on:
            raise ConnectionError("atrapa: polaczenie zerwane")
        if "CREATE SEQUENCE" in sql:  # PG_DDL -> odpowiednik SQLite
            self.db.conn.executescript(_SQLITE_DDL)
            self._rows = []
            return
        if "pg_advisory_xact_lock" in sql:
            self.db.locks += 1
            self._rows = []
            return
        q = (sql.replace("%s::jsonb", "?").replace("%s", "?")
             .replace("nextval('dam_assets_rev_seq')",
                      "(SELECT COALESCE(MAX(rev), 0) + 1 FROM dam_assets)")
             .replace("IS DISTINCT FROM", "IS NOT"))
        self._cur.execute(q, tuple(params))
        cols = [d[0] for d in (self._cur.description or [])]
        self._rows = [dict(zip(cols, r)) for r in self._cur.fetchall()] if cols else []

    def fetchone(self):
        return self._rows.pop(0) if self._rows else None

    def fetchall(self):
        rows, self._rows = self._rows, []
        return rows


class FakePG:
    def __init__(self):
        self.conn = sqlite3.connect(":memory:", isolation_level="DEFERRED")
        self.statements = 0
        self.locks = 0
        self.fail_on: int | None = None
        assert asset_sync.ensure_schema(self)["ok"]

    def cursor(self):
        return FakeCursor(self)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def row(self, rel: str) -> dict | None:
        aid = asset_sync.id_of(asset_sync.key_of(rel))
        cur = self.conn.execute("SELECT * FROM dam_assets WHERE asset_id=?", (aid,))
        cols = [d[0] for d in cur.description]
        r = cur.fetchone()
        return dict(zip(cols, r)) if r else None


class Machine:
    """Komputer z lokalnym lustrem bazy i (opcjonalnie) dyskiem z Marketingiem."""

    def __init__(self, name: str, root: str | None, disk: dict | None = None):
        self.name = name
        self.root = root
        self.disk: dict[str, tuple[int, int]] = dict(disk or {})  # rel -> (size, mtime_ms)
        self.rows: dict = {}
        self.last_seen: set | None = None
        self.failed: set[str] = set()      # foldery, ktorych odczyt sie nie udal
        self.hidden: set[str] = set()      # pliki niewidoczne mimo wylistowania folderu
        self.clock = 10_000_000
        self.last = None

    def scan(self):
        scan, dirs = {}, {""}
        for rel, (size, mt) in self.disk.items():
            key = asset_sync.key_of(rel)
            if any(key == f or key.startswith(f + "/") for f in self.failed):
                continue
            parts = key.split("/")
            for i in range(1, len(parts)):
                d = "/".join(parts[:i])
                if not any(d == f or d.startswith(f + "/") for f in self.failed):
                    dirs.add(d)
            if rel in self.hidden:
                continue
            aid, entry = asset_sync.scan_entry(f"{self.root}/{rel}", size=size, mtime_ms=mt,
                                               root=self.root, meta={"sku": "6300576"})
            scan[aid] = entry
        return scan, dirs

    def sync(self, pg: FakePG) -> dict:
        self.clock += 1000
        if self.root is None:
            res = asset_sync.sync_cycle(pg, self.rows, machine=self.name)
        else:
            scan, dirs = self.scan()
            res = asset_sync.sync_cycle(
                pg, self.rows, scan=scan, scanned_dirs=dirs, failed_dirs=self.failed,
                last_seen=self.last_seen, scan_time_ms=self.clock, machine=self.name,
                now_ms=self.clock)
        self.rows = res["rows"]
        if res["ok"]:
            self.last_seen = res["next_last_seen"]
        self.last = res
        return res

    def ops(self, kind: str | None = None) -> list:
        ops = (self.last.get("report") or {}).get("ops", [])
        return [o for o in ops if kind is None or o["op"] == kind]

    def live_paths(self) -> set[str]:
        return {e["path"] for e in asset_sync.live_entries(self.rows)}


P = "- POLSKA/1 - PRODUKTY/Klopsiki 6300576"
Q = "- POLSKA/1 - PRODUKTY/Figi z makiem 6300111"


def _folder(prefix: str, n: int, mtime: int = 1_000_000) -> dict:
    return {f"{prefix}/4 - WIZKI/wiz-{i:02d}.png": (1000 + i, mtime) for i in range(n)}


class ScenarioTests(unittest.TestCase):
    def setUp(self):
        self.pg = FakePG()
        base = {**_folder(P, 12), **_folder(Q, 12)}
        self.m = Machine("M-FIRMA", "M:", base)
        self.x = Machine("X-DOM", "X:/Marketing", base)
        self.mac = Machine("MAC", None)

    def _boot(self):
        self.m.sync(self.pg)
        self.x.sync(self.pg)
        self.mac.sync(self.pg)

    def test_add_on_m_visible_on_machine_without_root(self):
        self._boot()
        new = f"{P}/4 - WIZKI/nowa-wizka.png"
        self.m.disk[new] = (5555, 2_000_000)
        self.m.sync(self.pg)
        self.assertEqual([o["reason"] for o in self.m.ops()], ["add"])
        self.mac.sync(self.pg)
        self.assertIn(new, self.mac.live_paths())
        self.assertEqual(len(self.mac.live_paths()), 25)
        entry = next(e for e in asset_sync.live_entries(self.mac.rows) if e["path"] == new)
        self.assertEqual(entry["sku"], "6300576")
        self.assertTrue(entry["id"].startswith("br-0"))

    def test_delete_on_m_tombstone_disappears_elsewhere(self):
        self._boot()
        gone = f"{P}/4 - WIZKI/wiz-03.png"
        del self.m.disk[gone]
        self.m.sync(self.pg)
        self.assertEqual(len(self.m.ops("tombstone")), 1)
        self.assertIsNotNone(self.pg.row(gone)["deleted_at"])
        self.mac.sync(self.pg)
        self.assertNotIn(gone, self.mac.live_paths())
        self.assertEqual(len(self.mac.live_paths()), 23)

    def test_whole_folder_deleted_propagates(self):
        """Folder usuniety w calosci (rodzic wylistowany) to prawdziwe usuniecie."""
        big = {**_folder(P, 12), **_folder(Q, 12)}
        for k in range(8):
            big.update(_folder(f"- POLSKA/1 - PRODUKTY/Inny {k}", 12))
        self.m.disk = dict(big)
        self.m.sync(self.pg)
        for rel in list(self.m.disk):
            if rel.startswith(Q + "/"):
                del self.m.disk[rel]
        self.m.sync(self.pg)
        self.assertEqual(len(self.m.ops("tombstone")), 12)
        self.assertEqual(self.m.last["report"]["blocked"], {})

    def test_stale_x_older_mtime_does_not_revert_m_change(self):
        self._boot()
        f = f"{P}/4 - WIZKI/wiz-01.png"
        self.m.disk[f] = (9999, 3_000_000)          # nowa wersja na M:
        self.m.sync(self.pg)
        self.x.sync(self.pg)                         # X: ma jeszcze stara wersje
        self.assertEqual(self.x.ops(), [])
        self.assertEqual(self.x.last["report"]["stale_ignored"], 1)
        row = self.pg.row(f)
        self.assertEqual((row["size"], row["mtime_ms"], row["updated_by"]),
                         (9999, 3_000_000, "M-FIRMA"))

    def test_stale_x_forced_push_of_older_version_refused_by_db(self):
        """Nawet gdyby X: wyslal starsza wersje (np. stary stan lokalny), baza odmawia."""
        self._boot()
        f = f"{P}/4 - WIZKI/wiz-01.png"
        self.m.disk[f] = (9999, 3_000_000)
        self.m.sync(self.pg)
        aid, entry = asset_sync.scan_entry(f"X:/Marketing/{f}", size=1001, mtime_ms=1_000_000,
                                           root="X:/Marketing")
        op = asset_sync._op("upsert", aid, entry, None, "X-DOM", 1, "change")
        res = asset_sync.push_ops(self.pg, [op], now_ms=1)
        self.assertEqual((res["ok"], res["applied"], res["refused"]), (True, 0, 1))
        self.assertEqual(self.pg.row(f)["mtime_ms"], 3_000_000)

    def test_stale_x_does_not_resurrect_file_deleted_on_m(self):
        self._boot()
        gone = f"{P}/4 - WIZKI/wiz-05.png"
        del self.m.disk[gone]
        self.m.sync(self.pg)
        self.x.sync(self.pg)                         # X: wciaz ma plik (Drive nie dogonil)
        self.assertEqual(self.x.ops(), [])
        self.assertIsNotNone(self.pg.row(gone)["deleted_at"])
        del self.x.disk[gone]                        # Drive dogonil
        self.x.sync(self.pg)
        self.assertEqual(self.x.ops(), [])

    def test_stale_x_does_not_delete_file_it_never_had(self):
        self._boot()
        new = f"{Q}/4 - WIZKI/tylko-na-M.png"
        self.m.disk[new] = (7777, 4_000_000)
        self.m.sync(self.pg)
        self.x.sync(self.pg)                         # X: pliku jeszcze nie ma
        self.assertEqual(self.x.ops("tombstone"), [])
        self.assertIsNone(self.pg.row(new)["deleted_at"])

    def test_unlisted_folder_creates_no_deletions(self):
        self._boot()
        self.m.failed = {asset_sync.key_of(P)}       # odczyt folderu produktu sie nie udal
        self.m.sync(self.pg)
        self.assertEqual(self.m.ops("tombstone"), [])
        self.assertEqual(self.m.last["report"]["skipped_unlisted"], 12)
        self.m.failed = set()                        # po powrocie dysku nic nie zginelo
        self.m.sync(self.pg)
        self.assertEqual(self.m.ops(), [])
        self.assertEqual(len(self.m.live_paths()), 24)

    def test_root_unreadable_creates_no_deletions(self):
        self._boot()
        res = asset_sync.diff_scan_report(self.m.rows, {}, set(), 99_000_000, "M-FIRMA",
                                          last_seen=self.m.last_seen)
        self.assertEqual(res["ops"], [])
        self.assertEqual(len(res["next_last_seen"]), 24)

    def test_subtree_losing_over_20_percent_blocks_its_deletions(self):
        # wieksze drzewo: na poziomie "1 - PRODUKTY" 5 z 120 plikow to tylko 4 %
        for k in range(8):
            self.m.disk.update(_folder(f"- POLSKA/1 - PRODUKTY/Inny {k}", 12))
        self._boot()
        keep_q = f"{Q}/4 - WIZKI/wiz-00.png"
        for i in range(4):                           # 4 z 12 = 33 % - podejrzane
            self.m.hidden.add(f"{P}/4 - WIZKI/wiz-{i:02d}.png")
        del self.m.disk[keep_q]                      # 1 z 12 w innym folderze = 8 % - ok
        self.m.sync(self.pg)
        tomb = self.m.ops("tombstone")
        self.assertEqual([o["path_rel"] for o in tomb], [keep_q])
        blocked = self.m.last["report"]["blocked"]
        self.assertEqual(sum(blocked.values()), 4)
        self.assertTrue(all(asset_sync.key_of(P).startswith(k) for k in blocked))
        for i in range(4):
            self.assertIsNone(self.pg.row(f"{P}/4 - WIZKI/wiz-{i:02d}.png")["deleted_at"])
        self.m.hidden.clear()                        # odczyt wrocil - nic nie zginelo
        self.m.sync(self.pg)
        self.assertEqual(self.m.ops(), [])

    def test_partial_read_like_2026_09_23_blocked_at_root(self):
        """Skan widzi 2 z 24 folderow produktow - usuniecia zablokowane."""
        disk = {}
        for k in range(24):
            disk.update(_folder(f"- POLSKA/1 - PRODUKTY/Produkt {k:02d}", 5))
        m = Machine("M-FIRMA", "M:", disk)
        m.sync(self.pg)
        m.disk = {r: v for r, v in disk.items() if "Produkt 00" in r or "Produkt 01" in r}
        m.sync(self.pg)
        self.assertEqual(m.ops("tombstone"), [])
        self.assertEqual(sum(m.last["report"]["blocked"].values()), 110)
        live = self.pg.conn.execute(
            "SELECT COUNT(1) FROM dam_assets WHERE deleted_at IS NULL").fetchone()[0]
        self.assertEqual(live, 120)
        m.disk = dict(disk)
        m.sync(self.pg)
        self.assertEqual(m.ops(), [])

    def test_restore_file_from_trash_same_mtime(self):
        self._boot()
        f = f"{P}/4 - WIZKI/wiz-07.png"
        saved = self.m.disk.pop(f)
        self.m.sync(self.pg)
        self.mac.sync(self.pg)
        self.assertNotIn(f, self.mac.live_paths())
        self.m.disk[f] = saved                       # przywrocony z Kosza, ten sam mtime
        self.m.sync(self.pg)
        self.assertEqual([o["op"] for o in self.m.ops()], ["restore"])
        self.assertIsNone(self.pg.row(f)["deleted_at"])
        self.mac.sync(self.pg)
        self.assertIn(f, self.mac.live_paths())

    def test_recreated_newer_file_restores(self):
        self._boot()
        f = f"{P}/4 - WIZKI/wiz-08.png"
        del self.x.disk[f]
        self.x.sync(self.pg)
        self.x.disk[f] = (4242, 5_000_000)           # nowy plik pod ta sama nazwa
        self.x.sync(self.pg)
        self.assertEqual([o["reason"] for o in self.x.ops()], ["recreate"])
        row = self.pg.row(f)
        self.assertIsNone(row["deleted_at"])
        self.assertEqual(row["size"], 4242)

    def test_two_machines_change_different_files_in_parallel(self):
        self._boot()
        a, b = f"{P}/4 - WIZKI/wiz-02.png", f"{Q}/4 - WIZKI/wiz-09.png"
        self.m.disk[a] = (111, 6_000_000)
        self.x.disk[b] = (222, 6_000_500)
        self.m.sync(self.pg)
        self.x.sync(self.pg)
        self.assertEqual((self.pg.row(a)["size"], self.pg.row(a)["updated_by"]), (111, "M-FIRMA"))
        self.assertEqual((self.pg.row(b)["size"], self.pg.row(b)["updated_by"]), (222, "X-DOM"))
        self.mac.sync(self.pg)
        sizes = {e["path"]: e["size"] for e in asset_sync.live_entries(self.mac.rows)}
        self.assertEqual((sizes[a], sizes[b]), (111, 222))
        # po dogonieniu przez Drive oba dyski sa rowne - zero operacji
        self.m.disk[b] = self.x.disk[b]
        self.x.disk[a] = self.m.disk[a]
        self.m.sync(self.pg)
        self.x.sync(self.pg)
        self.assertEqual((self.m.ops(), self.x.ops()), ([], []))

    def test_same_mtime_conflict_resolved_by_rev(self):
        """Remis mtime z inna trescia: wygrywa zapis, ktory znal najnowszy rev."""
        self._boot()
        f = f"{P}/4 - WIZKI/wiz-04.png"
        self.m.disk[f] = (3333, 1_000_000)           # ten sam mtime, inny rozmiar
        self.m.sync(self.pg)
        self.assertEqual(self.pg.row(f)["size"], 3333)
        # X: z nieaktualnym stanem (stary rev) probuje zapisac swoja wersje - odmowa
        aid, entry = asset_sync.scan_entry(f"X:/Marketing/{f}", size=4444, mtime_ms=1_000_000,
                                           root="X:/Marketing")
        stale_prev = {**self.x.rows[aid]}
        op = asset_sync._op("upsert", aid, entry, stale_prev, "X-DOM", 1, "change")
        self.assertEqual(asset_sync.push_ops(self.pg, [op], now_ms=1)["refused"], 1)
        self.assertEqual(self.pg.row(f)["size"], 3333)

    def test_idempotent_same_scan_twice(self):
        self._boot()
        self.m.sync(self.pg)
        self.assertEqual(self.m.ops(), [])
        self.x.sync(self.pg)
        self.assertEqual(self.x.ops(), [])
        scan, dirs = self.m.scan()
        again = asset_sync.diff_scan(self.m.rows, scan, dirs, 99_000_000, "M-FIRMA",
                                     last_seen=self.m.last_seen)
        self.assertEqual(again, [])

    def test_first_scan_never_deletes(self):
        self._boot()
        fresh = Machine("NOWY", "M:", {})             # pusty dysk, brak last_seen
        fresh.sync(self.pg)
        self.assertEqual(fresh.ops(), [])
        self.assertEqual(len(self.mac.live_paths()), 24)

    def test_network_error_is_reported_not_raised(self):
        self._boot()
        self.m.disk[f"{P}/4 - WIZKI/nowa.png"] = (1, 7_000_000)
        before = set(self.m.last_seen)
        self.pg.fail_on = self.pg.statements + 2     # zerwanie w trakcie push
        res = self.m.sync(self.pg)
        self.assertFalse(res["ok"])
        self.assertTrue(res["error"])
        self.assertEqual(self.m.last_seen, before)   # last_seen nie ruszony
        self.pg.fail_on = None
        self.m.sync(self.pg)                         # nastepny cykl dosyla
        self.assertTrue(self.m.last["ok"])
        self.assertIsNotNone(self.pg.row(f"{P}/4 - WIZKI/nowa.png"))

    def test_mac_pull_only_never_writes(self):
        self._boot()
        n = self.pg.conn.execute("SELECT MAX(rev) FROM dam_assets").fetchone()[0]
        self.mac.sync(self.pg)
        self.assertIsNone(self.mac.last["push"])
        self.assertEqual(self.pg.conn.execute("SELECT MAX(rev) FROM dam_assets").fetchone()[0], n)


class PureLogicTests(unittest.TestCase):
    def test_dir_key_ignores_drive_and_root(self):
        self.assertEqual(asset_sync.dir_key("X:/Marketing/- POLSKA/A", "X:/Marketing"),
                         asset_sync.dir_key("M:/- POLSKA/A", "M:"))
        self.assertEqual(asset_sync.dir_key("X:/Marketing", "X:/Marketing"), "")

    def test_same_file_same_id_on_m_and_x(self):
        a, _ = asset_sync.scan_entry("M:/- POLSKA/A/b.png", size=1, mtime_ms=1, root="M:")
        b, _ = asset_sync.scan_entry("X:\\Marketing\\- POLSKA\\A\\B.PNG", size=1, mtime_ms=1,
                                     root="X:\\Marketing")
        self.assertEqual(a, b)

    def test_apply_remote_keeps_higher_rev_and_does_not_mutate(self):
        local = {"a": {"asset_id": "a", "rev": 5, "mtime_ms": 9}}
        out = asset_sync.apply_remote(local, [
            {"asset_id": "a", "rev": 3, "mtime_ms": 1},
            {"asset_id": "b", "rev": 4, "meta": '{"sku": "1"}'},
            {"rev": 7},                              # bez id - pominiety
        ])
        self.assertEqual(out["a"]["rev"], 5)
        self.assertEqual(out["b"]["meta"], {"sku": "1"})
        self.assertEqual(set(local), {"a"})

    def test_bad_op_is_programmer_error(self):
        with self.assertRaises(ValueError):
            asset_sync.push_ops(FakePG(), [{"op": "drop", "asset_id": "x"}])

    def test_row_newer_than_scan_not_deleted(self):
        rows = {"a": {"asset_id": "a", "asset_key": "d/a.png", "mtime_ms": 500, "rev": 1}}
        ops = asset_sync.diff_scan(rows, {}, {"", "d"}, 100, "M", last_seen={"a"})
        self.assertEqual(ops, [])


if __name__ == "__main__":
    unittest.main()
