# -*- coding: utf-8 -*-
"""2026-09-23: 5 nadpisan skojarzen + ponowny seed SKU/OCR po poprawce reguly (worker B).

Nadpisania (branding-associations-overrides.json, zlota aplikacja i repo):
  br-003871 -> br-098834226  kulki.png, ten sam folder co w nadpisaniu (malina, czarna porzeczka)
  br-004028 -> br-041707833  "Burgery - CZ SK.psd" - zgodne z recznym potwierdzeniem z 18.09
  br-003206 -> br-021593195  Falafel_zdjecieHiress...grill... (falafel)
  M-IMG203347-02-26 usuniete - duplikat br-003871 (te same produkty, brak pliku)
  br-000001 usuniete - pusty wpis bez produktow
Seed: _disambiguate_sku_products wybiera produkt z NAZWY pliku przed folderem - 19 plikow
pojedynczych smakow nie jest juz przypietych do zestawow.

Kolejnosc: kopie -> nadpisania -> obie bazy SQLite (usun auto SKU/OCR i override, seed od
nowa) -> PostgreSQL (kopia tabeli, usun te same zrodla, wgraj z zlotej bazy).
Uzycie: python apply-2026-09-23-overrides-reseed.py [--apply]
"""
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

REPO_BIN = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_BIN / "apps/web/scripts"))
from asset_ids import asset_key  # noqa: E402
APP_BIN = Path(r"C:\Users\krzysztof.wieczorek\AppData\Local\DAM-nowy-uzytkownik\bin")
STAMP = time.strftime("%Y%m%d-%H%M%S")
REMAP = {
    "br-003871": "br-098834226",
    "br-004028": "br-041707833",
    "br-003206": "br-021593195",
    # folder goodcalories en_balls_crunchy/v1: baner_balls_crunchy.png (ten sam co w migracji);
    # wpis wrocil pod starym kluczem - most nadpisal plik stara trescia z pamieci.
    "M-BAN334104-99-00": "br-059743320",
}
DROP = {"M-IMG203347-02-26", "br-000001"}
SOURCES = ("strong_sku_ocr", "override")


def backup(p: Path) -> Path:
    b = p.with_name(p.name + ".pre-reseed-" + STAMP)
    shutil.copy2(p, b)
    assert b.stat().st_size > 0, b
    return b


def fix_overrides(path: Path, apply: bool) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    assets = data.get("assets") or {}
    out, rep = {}, {"przepiete": [], "usuniete": [], "bez_zmian": 0}
    for key, entry in assets.items():
        if key in DROP:
            rep["usuniete"].append(key)
            continue
        new = REMAP.get(key, key)
        if new != key:
            rep["przepiete"].append(f"{key}->{new}")
        e = dict(entry or {})
        if e.get("folder_group_id"):
            e["folder_group_id"] = asset_key(e["folder_group_id"])
        e["linked_variant_ids"] = [REMAP.get(v, v) for v in (e.get("linked_variant_ids") or [])
                                   if v not in DROP and not v.startswith("63")]
        if new in out:  # dwa wpisy na ten sam plik - scal produkty
            merged = list(dict.fromkeys((out[new].get("linked_product_ids") or []) + (e.get("linked_product_ids") or [])))
            out[new]["linked_product_ids"] = merged
        else:
            out[new] = e
        if new == key:
            rep["bez_zmian"] += 1
    if apply:
        backup(path)
        data["assets"] = out
        data["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)
    return rep


def reseed_sqlite(db: Path, apply: bool) -> dict:
    conn = sqlite3.connect(str(db))
    before = conn.execute(
        "select count(1) from asset_product_links where (source=? and status='auto') or source=?", SOURCES
    ).fetchone()[0]
    rep = {"db": str(db), "usuniete_do_seeda": before}
    if apply:
        b = db.with_name(db.name + ".pre-reseed-" + STAMP)
        dst = sqlite3.connect(str(b))
        conn.backup(dst)
        dst.close()
        assert b.stat().st_size > 0
        with conn:
            conn.execute("delete from asset_product_links where source=? and status='auto'", (SOURCES[0],))
            conn.execute("delete from asset_product_links where source=?", (SOURCES[1],))
    conn.close()
    if apply:
        seed = APP_BIN / "apps/desktop/scripts/seed-asset-product-links.py"
        py = APP_BIN / "runtime/win/python/python.exe"
        r = subprocess.run([str(py), str(seed), "--db", str(db), "--strong-only", "--apply",
                            "--report", str(db.with_name("seed-" + STAMP + ".json"))],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            raise SystemExit(f"seed nieudany dla {db}: {r.stdout[-800:]} {r.stderr[-800:]}")
        c2 = sqlite3.connect(str(db))
        rep["po_seedzie"] = c2.execute(
            "select count(1) from asset_product_links where source in (?,?)", SOURCES).fetchone()[0]
        c2.close()
    return rep


def sync_pg(golden_db: Path, apply: bool) -> dict:
    sys.path.insert(0, str(APP_BIN / "apps/desktop"))
    import pg_db
    import psycopg2.extras

    local = sqlite3.connect(str(golden_db))
    rows = local.execute(
        "select asset_id, product_id, score, source, status, reason, updated_at, updated_by "
        "from asset_product_links where source in (?,?)", SOURCES).fetchall()
    pg = pg_db.connect()
    cur = pg.cursor()
    cur.execute("select count(1) as n from dam_asset_product_links where (source=%s and status='auto') or source=%s", SOURCES)
    rep = {"pg_do_zastapienia": int(cur.fetchone()["n"]), "z_zlotej_bazy": len(rows)}
    if apply:
        bak = "dam_asset_product_links_bak_" + STAMP.replace("-", "_")
        cur.execute(f"create table {bak} as select * from dam_asset_product_links")
        cur.execute(f"select count(1) as n from {bak}")
        rep["kopia"] = f"{bak} ({int(cur.fetchone()['n'])})"
        cur.execute("delete from dam_asset_product_links where source=%s and status='auto'", (SOURCES[0],))
        cur.execute("delete from dam_asset_product_links where source=%s", (SOURCES[1],))
        psycopg2.extras.execute_values(
            cur,
            "insert into dam_asset_product_links as t (asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
            "values %s on conflict (asset_id, product_id) do update set score=excluded.score, source=excluded.source, "
            "status=case when t.status in ('confirmed','rejected','skipped') then t.status else excluded.status end, "
            "reason=excluded.reason, updated_at=excluded.updated_at, updated_by=excluded.updated_by, "
            "rev=nextval('dam_asset_product_links_rev_seq')",
            [tuple(r) for r in rows], page_size=500)
        pg.commit()
        cur.execute("select count(1) as n from dam_asset_product_links")
        rep["pg_po"] = int(cur.fetchone()["n"])
        local.execute("update asset_product_links set dirty=0 where source in (?,?)", SOURCES)
        local.commit()
    pg.close()
    local.close()
    return rep


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    # seed zlotej aplikacji musi miec poprawiona regule z repo
    if a.apply:
        shutil.copy2(REPO_BIN / "apps/desktop/scripts/seed-asset-product-links.py",
                     APP_BIN / "apps/desktop/scripts/seed-asset-product-links.py")
    for p in (APP_BIN / "apps/web/data/branding-associations-overrides.json",
              REPO_BIN / "apps/web/data/branding-associations-overrides.json"):
        print("nadpisania", p.parent.parent.parent.parent.name, fix_overrides(p, a.apply), flush=True)
    for db in (APP_BIN / "DATABASE/dam-local.sqlite", REPO_BIN / "DATABASE/dam-local.sqlite"):
        print("sqlite", reseed_sqlite(db, a.apply), flush=True)
    print("pg", sync_pg(APP_BIN / "DATABASE/dam-local.sqlite", a.apply), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
