# -*- coding: utf-8 -*-
"""Naprawa dam_assets po imporcie 23.09 (faza 2) - kolizje id i zapis sciezek.

Import 2.3.9 liczyl id od nowa (bez rozwiazywania kolizji 8-cyfrowego skrotu),
wiec 8 par plikow skleilo sie w jeden wiersz: 8 plikow nie trafilo do bazy, a pod
8 id (tymi, na ktore wskazuja skojarzenia) lezal inny plik. Do tego path_rel/name
byly w NFC, choc plik na dysku ma NFD (37 nazw).

Skrypt porownuje wiersze w PG ze zlotym branding-index.json (id z indeksu,
asset_repo.scan_from_index) i:
  - poprawia wiersze, ktorych asset_key / path_rel / name nie zgadzaja sie z indeksem,
  - dopisuje brakujace wiersze,
  - z --meta: poprawia meta rozne od indeksu (23.09: skojarzenia z kontekstu
    folderu byly wycinane z meta, kopia bez ROOT gubila je dla 2184 materialow).
Najpierw aktualizacje (zwalniaja unikalny asset_key), potem wstawienia - jedna
transakcja pod ta sama blokada co asset_sync. Kazda zmiana dostaje nowy rev, wiec
pozostale komputery pobiora ja w zwyklym cyklu.
Kopia zmienianych wierszy trafia do --backup-dir PRZED zapisem.
Domyslnie tylko liczy; --apply zapisuje.
"""
from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import time
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", required=True, help="bin zlotej aplikacji")
    ap.add_argument("--root", required=True, help="korzen uzyty przy imporcie, np. X:/Marketing")
    ap.add_argument("--backup-dir", default=str(Path(os.environ.get("LOCALAPPDATA", ".")) / "DAM-repair"))
    ap.add_argument("--meta", action="store_true",
                    help="popraw tez meta rozna od indeksu (np. skojarzenia z folderow)")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    app = Path(a.app)
    sys.path.insert(0, str(app / "apps/desktop"))
    import asset_repo
    import asset_sync
    import pg_db

    idx = json.loads((app / "apps/web/data/branding-index.json").read_text(encoding="utf-8"))
    assets = [x for x in (idx.get("assets") or []) if isinstance(x, dict) and x.get("path")]
    root = a.root.rstrip("/\\")

    pg = pg_db.connect()
    pulled = asset_sync.pull_since(pg, 0)
    if not pulled["ok"]:
        print("BLAD pull:", pulled.get("error"))
        return 3
    rows = asset_sync.apply_remote({}, pulled["rows"])
    # Id rozstrzygane wzgledem bazy jak w runnerze (bez tego nowy build z inna
    # kolejnoscia skanu przepialby id miedzy plikami z kolizja).
    scan = asset_repo.scan_from_index(
        assets, root, taken=asset_repo.taken_from_rows(rows) if a.meta else None)

    fields = ("asset_key", "path_rel", "name")
    updates = [aid for aid, e in scan.items()
               if aid in rows and (any((rows[aid].get(f) or "") != (e.get(f) or "") for f in fields)
                                   or (a.meta and (rows[aid].get("meta") or {}) != (e.get("meta") or {})))]
    inserts = [aid for aid in scan if aid not in rows]
    extra = [aid for aid, r in rows.items() if aid not in scan and r.get("deleted_at") is None]
    key_moves = [aid for aid in updates if rows[aid].get("asset_key") != scan[aid]["asset_key"]]
    print(f"indeks {len(scan)} | baza {len(rows)} | do poprawy {len(updates)} "
          f"(w tym inny plik pod id: {len(key_moves)}) | brakujace {len(inserts)} | "
          f"w bazie, nie w indeksie: {len(extra)}")
    for aid in key_moves:
        print(f"  {aid}: {rows[aid].get('name')} -> {scan[aid].get('name')}")
    for aid in inserts[:20]:
        print(f"  + {aid}: {scan[aid].get('name')}")
    if not a.apply or not (updates or inserts):
        print("dry-run: nic nie zapisano" if not a.apply else "nic do zmiany")
        return 0

    bdir = Path(a.backup_dir)
    bdir.mkdir(parents=True, exist_ok=True)
    bfile = bdir / f"dam_assets-before-repair-{time.strftime('%Y%m%d-%H%M%S')}.json"
    bfile.write_text(json.dumps({aid: rows[aid] for aid in updates}, ensure_ascii=False, indent=1),
                     encoding="utf-8")
    if bfile.stat().st_size <= 2:
        print("BLAD: kopia pusta", bfile)
        return 4
    print(f"kopia: {bfile} ({bfile.stat().st_size} B)")

    machine = socket.gethostname()
    now_ms = int(time.time() * 1000)
    cur = pg.cursor()
    try:
        cur.execute("SELECT pg_advisory_xact_lock(%s)", (asset_sync.ADVISORY_LOCK_KEY,))
        for aid in updates:
            e = scan[aid]
            cur.execute(
                "UPDATE dam_assets SET asset_key=%s, path_rel=%s, name=%s, size=%s, mtime_ms=%s, "
                "meta=%s::jsonb, deleted_at=NULL, updated_at=%s, updated_by=%s, seen_by_machine=%s, "
                "rev=nextval('dam_assets_rev_seq') WHERE asset_id=%s",
                (e["asset_key"], e["path_rel"], e["name"], e.get("size"), int(e.get("mtime_ms") or 0),
                 json.dumps(e.get("meta") or {}, ensure_ascii=False, sort_keys=True),
                 now_ms, f"{machine}:repair", machine, aid))
        for aid in inserts:
            e = scan[aid]
            cur.execute(
                "INSERT INTO dam_assets (asset_id, asset_key, path_rel, name, size, mtime_ms, "
                "content_hash, meta, deleted_at, updated_at, updated_by, seen_by_machine, rev) "
                "VALUES (%s,%s,%s,%s,%s,%s,NULL,%s::jsonb,NULL,%s,%s,%s,nextval('dam_assets_rev_seq'))",
                (aid, e["asset_key"], e["path_rel"], e["name"], e.get("size"),
                 int(e.get("mtime_ms") or 0),
                 json.dumps(e.get("meta") or {}, ensure_ascii=False, sort_keys=True),
                 now_ms, f"{machine}:repair", machine))
        pg.commit()
    except Exception as exc:  # noqa: BLE001
        pg.rollback()
        print("BLAD, wycofano:", exc)
        return 5
    cur.execute("SELECT count(*) AS n FROM dam_assets WHERE deleted_at IS NULL")
    print("zapisano; zywych wierszy w bazie:", cur.fetchone()["n"])
    pg.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
