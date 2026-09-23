# -*- coding: utf-8 -*-
"""Test scalania indeksu (asset_sync) na PRAWDZIWYM PostgreSQL - bez sladu w bazie.

Atrapa w tests/test_asset_sync.py to SQLite; ten test sprawdza te same zapytania na
serwerze produkcyjnym (Synology): pg_advisory_xact_lock, nextval, IS DISTINCT FROM,
ON CONFLICT ... WHERE. Wszystko dzieje sie w JEDNEJ transakcji w schemacie
dam_p2_test: commit() jest wylaczony, na koniec ROLLBACK - schemat, tabela i
sekwencja znikaja razem z transakcja (DDL w PostgreSQL jest transakcyjne).

Uzycie (z folderu apps/desktop zlotej aplikacji, zeby pg_db mial konfiguracje):
  python pg_asset_sync_live_test.py --desktop <sciezka do bin/apps/desktop z asset_sync.py>
"""
from __future__ import annotations

import argparse
import sys
import time


class NoCommit:
    """Polaczenie, ktore nigdy nie zatwierdza - rollback na koncu testu."""

    def __init__(self, conn):
        self._c = conn

    def cursor(self):
        return self._c.cursor()

    def commit(self):
        pass

    def rollback(self):
        # asset_sync wola rollback po bledzie - w tescie blad ma byc widoczny, nie cichy
        raise RuntimeError("asset_sync zrobil rollback - blad SQL na prawdziwym PG")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--desktop", required=True)
    a = ap.parse_args()
    sys.path.insert(0, a.desktop)
    import pg_db  # konfiguracja polaczenia ze zlotej aplikacji
    import asset_sync as s

    raw = pg_db.connect()
    pg = NoCommit(raw)
    cur = raw.cursor()
    cur.execute("CREATE SCHEMA dam_p2_test")
    cur.execute("SET LOCAL search_path TO dam_p2_test")
    checks: list[tuple[str, bool, str]] = []

    def check(name, ok, detail=""):
        checks.append((name, bool(ok), str(detail)))

    try:
        check("ensure_schema", s.ensure_schema(pg)["ok"])
        root_m = "M:/"
        t0 = int(time.time() * 1000)

        def scan(files, root):
            out = {}
            for rel, mt in files.items():
                aid, e = s.scan_entry(root + rel, size=100, mtime_ms=mt, root=root.rstrip("/"))
                out[aid] = e
            return out

        base = {f"- POLSKA/T/dir/f{i:02d}.png": t0 - 100000 for i in range(12)}
        dirs = {"", "- polska", "- polska/t", "- polska/t/dir"}

        # 1. M: pierwszy skan - wszystko dodane, zero usuniec
        r1 = s.sync_cycle(pg, {}, scan=scan(base, root_m), scanned_dirs=dirs, last_seen=None,
                          scan_time_ms=t0, machine="M")
        rows = r1["rows"]
        live = [x for x in rows.values() if x.get("deleted_at") is None]
        check("M pierwszy skan: 12 plikow w bazie", len(live) == 12, len(live))
        seen = r1["next_last_seen"]

        # 2. X: nieaktualna kopia (starszy mtime f00) - nie cofa
        stale = dict(base)
        stale["- POLSKA/T/dir/f00.png"] = t0 - 900000
        r2 = s.sync_cycle(pg, rows, scan=scan(stale, "X:/Marketing/"), scanned_dirs=dirs, last_seen=None,
                          scan_time_ms=t0 + 10, machine="X")
        aid0 = s.id_of(s.key_of("M:/- POLSKA/T/dir/f00.png"))
        check("X starszy mtime nie nadpisuje", r2["rows"][aid0]["mtime_ms"] == t0 - 100000, r2["rows"][aid0]["mtime_ms"])

        # 3. M: nowsza wersja f01 -> upsert
        newer = dict(base)
        newer["- POLSKA/T/dir/f01.png"] = t0 + 5000
        r3 = s.sync_cycle(pg, r2["rows"], scan=scan(newer, root_m), scanned_dirs=dirs, last_seen=seen,
                          scan_time_ms=t0 + 6000, machine="M")
        aid1 = s.id_of(s.key_of("M:/- POLSKA/T/dir/f01.png"))
        check("M nowsza wersja trafia do bazy", r3["rows"][aid1]["mtime_ms"] == t0 + 5000)
        seen = r3["next_last_seen"]

        # 4. M: usuniecie jednego pliku (1/12 < 20%) -> tombstone
        minus1 = dict(newer)
        del minus1["- POLSKA/T/dir/f02.png"]
        r4 = s.sync_cycle(pg, r3["rows"], scan=scan(minus1, root_m), scanned_dirs=dirs, last_seen=seen,
                          scan_time_ms=t0 + 7000, machine="M")
        aid2 = s.id_of(s.key_of("M:/- POLSKA/T/dir/f02.png"))
        check("M usuniecie -> tombstone", r4["rows"][aid2].get("deleted_at") is not None)
        seen = r4["next_last_seen"]

        # 5. Niepelny odczyt: widac 2 z 11 -> bezpiecznik, zero usuniec
        two = {k: v for i, (k, v) in enumerate(minus1.items()) if i < 2}
        r5 = s.sync_cycle(pg, r4["rows"], scan=scan(two, root_m), scanned_dirs=dirs, last_seen=seen,
                          scan_time_ms=t0 + 8000, machine="M")
        live5 = [x for x in r5["rows"].values() if x.get("deleted_at") is None]
        check("niepelny odczyt zablokowany", len(live5) == 11 and r5["report"]["blocked"], (len(live5), r5["report"]["blocked"]))

        # 6. Folder nieczytelny (failed_dirs) -> zero usuniec
        r6 = s.sync_cycle(pg, r5["rows"], scan={}, scanned_dirs={"", "- polska"}, failed_dirs={"- polska/t"},
                          last_seen=seen, scan_time_ms=t0 + 9000, machine="M")
        live6 = [x for x in r6["rows"].values() if x.get("deleted_at") is None]
        check("folder nieczytelny nie usuwa", len(live6) == 11, len(live6))

        # 7. Mac bez ROOT: pull od zera widzi 11 zywych
        r7 = s.sync_cycle(pg, {}, machine="Mac")
        live7 = [x for x in r7["rows"].values() if x.get("deleted_at") is None]
        check("komputer bez ROOT widzi 11", len(live7) == 11, len(live7))

        # 8. rev rosnie i pull_since(max) jest pusty
        p = s.pull_since(pg, s.max_rev(r7["rows"]))
        check("pull_since(max) pusty", p["ok"] and not p["rows"], len(p["rows"]))
    finally:
        raw.rollback()
        cur2 = raw.cursor()
        cur2.execute("SELECT to_regnamespace('dam_p2_test') AS n")
        left = cur2.fetchone()
        raw.rollback()
        raw.close()

    for name, ok, detail in checks:
        print(("OK   " if ok else "BLAD ") + name + (f"  [{detail}]" if detail and not ok else ""))
    gone = left is None or (left.get("n") if isinstance(left, dict) else left[0]) is None
    print("schemat testowy po ROLLBACK:", "brak (czysto)" if gone else "ZOSTAL")
    return 0 if all(ok for _, ok, _ in checks) and gone else 1


if __name__ == "__main__":
    raise SystemExit(main())
