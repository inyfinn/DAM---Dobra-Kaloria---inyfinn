"""Dodaje skojarzenia wskazane przez uzytkownika (2026-09-18):
   br-004028 "Burgery - CZ SK.psd" (M-SLI504028-01-00)
     -> burger-plant-based (6300514.00), burger-chicken-plant-based (6300579.00)
Ta sama sciezka zapisu co edytor w aplikacji (assoc_repo.upsert_confirmed_links),
potem jeden cykl synchronizacji z Postgresem na prywatnym NAS (assoc_sync.sync_once).
Przed zapisem: kopia lokalnej bazy SQLite (zasada 6)."""
import shutil
import sqlite3
import sys
import time
from pathlib import Path

DESKTOP = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(DESKTOP))
import assoc_repo  # noqa: E402
import assoc_sync  # noqa: E402

DB = DESKTOP.parent.parent / "DATABASE" / "dam-local.sqlite"
ASSET = "br-004028"
PRODUCTS = ["burger-plant-based", "burger-chicken-plant-based"]

backup = DB.with_name(f"dam-local.sqlite.pre-burger-links-{time.strftime('%Y%m%d-%H%M%S')}.bak")
src = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
dst = sqlite3.connect(str(backup))
src.backup(dst)
dst.close(); src.close()
print("kopia:", backup.name, backup.stat().st_size, "B")
assert backup.stat().st_size > 0

res = assoc_repo.upsert_confirmed_links(
    ASSET, PRODUCTS, db_path=DB, source="manual", reason="user_chat_2026-09-18",
    updated_by="krzysztof.wieczorek@kubara.pl", schedule_publish=False,
)
print("zapis lokalny:", {k: res.get(k) for k in ("ok", "asset_id", "linked_product_ids")})

c = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
print("lokalnie:", c.execute("select product_id, status, dirty from asset_product_links where asset_id=?", (ASSET,)).fetchall())
c.close()

print("synchronizacja z NAS:", assoc_sync.sync_once(DB))

import json, psycopg2  # noqa: E402
cfg = json.loads((DESKTOP / "data" / "pg-config.json").read_text(encoding="utf-8-sig"))
pg = psycopg2.connect(host=cfg["host"], port=cfg["port"], dbname=cfg["dbname"], user=cfg["user"], password=cfg["password"], sslmode=cfg.get("sslmode", "require"), connect_timeout=10)
cur = pg.cursor()
cur.execute("select product_id, status, source, updated_by from dam_asset_product_links where asset_id=%s", (ASSET,))
print("Postgres NAS:", cur.fetchall())
