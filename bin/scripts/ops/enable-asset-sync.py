# -*- coding: utf-8 -*-
"""Wlaczenie fazy 2 (scalanie indeksu jak Synology Drive) - jednorazowo, na zlotym komputerze.

1. PG: tabela dam_assets + import zlotego branding-index.json paczkami
   (ON CONFLICT DO NOTHING - import niczego nie nadpisuje).
2. Lokalnie (SQLite zlotej aplikacji): lustro wierszy z bazy, last_seen = wszystkie
   zaimportowane id (pierwszy skan fazy 2 moze juz wykrywac usuniecia), rev, czas skanu.
3. dam_meta.asset_index_mode = "rows" - wszystkie komputery z 2.3.9+ przechodza na
   wiersze; snapshot branding-index przestaje byc publikowany.
Domyslnie --dry-run (tylko liczy). Uzycie z folderu apps/desktop zlotej aplikacji:
  python enable-asset-sync.py --app <bin zlotej aplikacji> --root M:/ [--apply]
"""
from __future__ import annotations

import argparse
import json
import socket
import sqlite3
import sys
import time
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", required=True, help="bin zlotej aplikacji")
    ap.add_argument("--root", required=True, help="korzen Marketingu na tym komputerze, np. M:/")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    app = Path(a.app)
    sys.path.insert(0, str(app / "apps/desktop"))
    import asset_repo
    import asset_sync
    import pg_db

    data = app / "apps/web/data"
    idx = json.loads((data / "branding-index.json").read_text(encoding="utf-8"))
    assets = [x for x in (idx.get("assets") or []) if isinstance(x, dict) and x.get("path")]
    root = a.root.rstrip("/\\")
    ids = set(asset_repo.scan_from_index(assets, root))
    manifest_path = data / "branding-scan-dirs.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else {}
    print(f"indeks: {len(assets)} assetow, {len(ids)} unikalnych id; manifest: {'jest' if manifest else 'brak'}")
    if not a.apply:
        print("dry-run: nic nie zapisano")
        return 0

    machine = socket.gethostname()
    pg = pg_db.connect()
    rep = asset_repo.import_index_to_pg(pg, assets, root, machine)
    print("import:", {k: v for k, v in rep.items() if k != "error"}, rep.get("error", ""))
    if rep.get("error"):
        return 2
    pulled = asset_sync.pull_since(pg, 0)
    if not pulled["ok"]:
        print("BLAD pull:", pulled.get("error"))
        return 3
    rows = asset_sync.apply_remote({}, pulled["rows"])
    live = {k for k, v in rows.items() if v.get("deleted_at") is None}
    print(f"w bazie: {len(rows)} wierszy, zywych {len(live)}, max rev {asset_sync.max_rev(rows)}")

    db = app / "DATABASE/dam-local.sqlite"
    conn = sqlite3.connect(str(db))
    asset_repo.ensure_local(conn)
    asset_repo.save_rows(conn, rows)
    asset_repo.save_last_seen(conn, ids & live)
    asset_repo.set_pg_rev(conn, asset_sync.max_rev(rows))
    asset_repo.set_state(conn, "asset_sync_last_scan_time_ms",
                         str(int(manifest.get("scan_time_ms") or time.time() * 1000)))
    conn.close()
    print(f"lokalnie: lustro {len(rows)}, last_seen {len(ids & live)}")

    cur = pg.cursor()
    cur.execute("insert into dam_meta(key, value) values('asset_index_mode','rows') "
                "on conflict(key) do update set value=excluded.value, updated_at=now()")
    pg.commit()
    cur.execute("select value from dam_meta where key='asset_index_mode'")
    print("dam_meta.asset_index_mode =", cur.fetchone()["value"])
    pg.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
