# -*- coding: utf-8 -*-
import sys

sys.path.insert(
    0,
    r"d:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\bin\apps\desktop",
)
import pg_db  # noqa: E402

conn = pg_db.connect()
cur = conn.cursor()
cur.execute(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1"
)
rows = cur.fetchall()
tables = []
for r in rows:
    if isinstance(r, dict):
        tables.append(list(r.values())[0])
    else:
        tables.append(r[0])
print("tables", tables)
for t in tables:
    low = str(t).lower()
    if any(x in low for x in ("ocr", "assoc", "link", "tag", "embed", "kv")):
        print("interesting", t)
if "asset_product_links" in tables:
    cur.execute("SELECT COUNT(*) AS n FROM asset_product_links")
    print("asset_product_links count", cur.fetchone())
    cur.execute(
        "SELECT asset_id, product_id, source, status, reason "
        "FROM asset_product_links WHERE asset_id IN ('br-006226','br-006246')"
    )
    print("5061 links", cur.fetchall())
conn.close()
