# -*- coding: utf-8 -*-
"""Migracja powiazan w PostgreSQL (dam_asset_product_links) na stabilne id materialow.

Kolejnosc (domyslnie --dry-run, tylko liczy):
  1. kopia tabeli: dam_asset_product_links_bak_<czas> (CREATE TABLE AS), kontrola liczby wierszy,
  2. usuniecie wierszy o starych id (br-NNNNNN, M-XXXNNNNNN-MM-RR),
  3. wyslanie wszystkich wierszy ze zmigrowanej lokalnej bazy (--db) jako nowych,
  4. znacznik dam_meta.asset_id_epoch = stable-1 - kazdy komputer przy nastepnej
     synchronizacji czysci u siebie stare wiersze i pobiera wszystko od nowa (assoc_sync).
"""
from __future__ import annotations

import argparse
import re
import sqlite3
import sys
import time
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DESKTOP))

LEGACY_RE = re.compile(r"^(br-\d{6}|M-[A-Z]+\d{6}-\d{2}-\d{2})$")
STABLE_RE = re.compile(r"^br-0\d{8}$")
EPOCH = "stable-1"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", type=Path, required=True, help="zmigrowana dam-local.sqlite (zloty stan)")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    import pg_db
    import psycopg2.extras

    local = sqlite3.connect(str(args.db))
    rows = local.execute(
        "select asset_id, product_id, score, source, status, reason, updated_at, updated_by from asset_product_links"
    ).fetchall()
    stable = [r for r in rows if STABLE_RE.match(r[0] or "")]
    other = [r for r in rows if not STABLE_RE.match(r[0] or "")]
    print(f"lokalnie: {len(rows)} wierszy, stabilne {len(stable)}, inne (zostaja lokalnie) {len(other)}")

    pg = pg_db.connect()
    try:
        cur = pg.cursor()
        cur.execute("select asset_id from dam_asset_product_links")
        ids = [r["asset_id"] for r in cur.fetchall()]
        legacy = sum(1 for a in ids if LEGACY_RE.match(a or ""))
        print(f"PG: {len(ids)} wierszy, stare id {legacy}, stabilne {sum(1 for a in ids if STABLE_RE.match(a or ''))}")
        if not args.apply:
            print("dry-run: nic nie zapisano")
            return 0

        bak = "dam_asset_product_links_bak_" + time.strftime("%Y%m%d_%H%M%S")
        cur.execute(f"create table {bak} as select * from dam_asset_product_links")
        cur.execute(f"select count(1) as n from {bak}")
        n_bak = int(cur.fetchone()["n"])
        if n_bak != len(ids):
            pg.rollback()
            print(f"BLAD: kopia {n_bak} != {len(ids)}", file=sys.stderr)
            return 2
        pg.commit()
        print(f"kopia: {bak} ({n_bak} wierszy)")

        cur.execute(
            "delete from dam_asset_product_links where asset_id ~ %s",
            (r"^(br-[0-9]{6}|M-[A-Z]+[0-9]{6}-[0-9]{2}-[0-9]{2})$",),
        )
        print(f"usuniete stare: {cur.rowcount}")
        if stable:
            psycopg2.extras.execute_values(
                cur,
                "insert into dam_asset_product_links as t "
                "(asset_id, product_id, score, source, status, reason, updated_at, updated_by) values %s "
                "on conflict (asset_id, product_id) do update set score=excluded.score, source=excluded.source, "
                "status=excluded.status, reason=excluded.reason, updated_at=excluded.updated_at, "
                "updated_by=excluded.updated_by, rev=nextval('dam_asset_product_links_rev_seq')",
                [tuple(r) for r in stable],
                page_size=500,
            )
        cur.execute(
            "create table if not exists dam_meta (key text primary key, value text not null default '', "
            "updated_at timestamptz not null default now())"
        )
        cur.execute(
            "insert into dam_meta(key, value) values('asset_id_epoch', %s) "
            "on conflict(key) do update set value=excluded.value, updated_at=now()",
            (EPOCH,),
        )
        pg.commit()
        cur.execute("select count(1) as n from dam_asset_product_links")
        print(f"PG po migracji: {int(cur.fetchone()['n'])} wierszy, epoka {EPOCH}")
    finally:
        pg.close()
    # Lokalnie: wszystko juz jest w PG - bez ponownego wysylania, pobranie od biezacego rev.
    local.execute(
        "insert into assoc_sync_state(key, value) values('asset_id_epoch', ?) "
        "on conflict(key) do update set value=excluded.value",
        (EPOCH,),
    )
    local.execute("update asset_product_links set dirty=0")
    local.execute(
        "insert into assoc_sync_state(key, value) values('pg_rev', '0') on conflict(key) do update set value='0'"
    )
    local.commit()
    local.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
