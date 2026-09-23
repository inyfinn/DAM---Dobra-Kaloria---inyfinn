# -*- coding: utf-8 -*-
"""Faza 2 "jedno zrodlo prawdy": lokalny magazyn dla scalania indeksu materialow.

Uzupelnienie asset_sync.py (czysta logika scalania) o:
- lokalne lustro wierszy dam_assets + last_seen + rev w SQLite (dam-local.sqlite),
- jednorazowy import zlotego indeksu (branding-index.json) do PostgreSQL paczkami.

Modul NIE laczy sie z PostgreSQL sam - polaczenie (albo atrapa w testach) jest
zawsze przekazywane z zewnatrz, tak jak w asset_sync.py. Kontrakt (nazwy uzywane
przez most W3) opisany w bin/docs/PLAN-jedno-zrodlo-prawdy.md, Faza 2.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Iterable

import asset_sync

_LOCAL_SQL = """
CREATE TABLE IF NOT EXISTS asset_rows (
  asset_id TEXT PRIMARY KEY,
  row_json TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS asset_rows_deleted_idx ON asset_rows (deleted);
CREATE TABLE IF NOT EXISTS asset_sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
"""

# Pola skanera indeksu, ktore NIE trafiaja do meta w dam_assets:
# - path/size/mtime_ms - maja juz wlasne kolumny (path_rel/name/size/mtime_ms),
#   duplikowanie w meta tylko psuloby porownanie "ta sama tresc" w diff_scan;
# - id - stary licznikowy identyfikator (br-000001...) z build-branding-index;
#   nowy stabilny asset_id liczy scan_entry/id_of, stary nie ma tu znaczenia;
# - linked_products - pelne obiekty produktow, wyprowadzalne z linked_product_ids.
# linked_product_ids / folder_linked_product_ids ZOSTAJA: build-branding-index
# wylicza je z kontekstu folderu i nie ma ich w dam_asset_product_links - siatka
# bierze je z indeksu, a baza nadpisuje tylko materialy, ktore w niej sa. 23.09:
# bez nich kopia bez ROOT gubila skojarzenia 2184 materialow. Zmiana samego meta
# nie generuje zapisu (asset_sync._content_differs porownuje rozmiar i skrot).
# "size" w branding-index to ETYKIETA rozmiaru wizki ("L", "S", "XL"), nie bajty -
# zostaje w meta; rozmiar w bajtach tylko z liczbowego pola (patrz _size_bytes).
_SCAN_META_EXCLUDE = {"path", "mtime_ms", "id", "linked_products"}


def ensure_local(conn: sqlite3.Connection) -> None:
    conn.executescript(_LOCAL_SQL)
    try:
        conn.execute("PRAGMA journal_mode=WAL")
    except sqlite3.Error:  # noqa: BLE001 - dysk sieciowy / baza w pamieci: bez WAL
        pass


# --------------------------------------------------------------------------
# Lustro wierszy
# --------------------------------------------------------------------------

def load_rows(conn: sqlite3.Connection) -> dict[str, dict]:
    """asset_id -> wiersz (dict jak asset_sync.normalize_row). Uszkodzony JSON pomijamy."""
    out: dict[str, dict] = {}
    for aid, row_json in conn.execute("SELECT asset_id, row_json FROM asset_rows"):
        try:
            data = json.loads(row_json)
        except (TypeError, ValueError):
            continue
        if not isinstance(data, dict):
            continue
        out[str(aid)] = asset_sync.normalize_row(data)
    return out


def save_rows(conn: sqlite3.Connection, rows: dict[str, dict], *,
              only_ids: Iterable[str] | None = None) -> None:
    """Upsert wierszy (tylko zmienione, gdy only_ids podane) w jednej transakcji."""
    ids = list(only_ids) if only_ids is not None else list(rows.keys())
    ids = [aid for aid in ids if aid in rows]
    if not ids:
        return
    payload = []
    for aid in ids:
        row = rows[aid]
        row_json = json.dumps(row, ensure_ascii=False, sort_keys=True)
        rev = int(row.get("rev") or 0)
        deleted = 1 if row.get("deleted_at") is not None else 0
        payload.append((aid, row_json, rev, deleted))
    with conn:
        conn.executemany(
            "INSERT INTO asset_rows(asset_id, row_json, rev, deleted) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(asset_id) DO UPDATE SET "
            "row_json=excluded.row_json, rev=excluded.rev, deleted=excluded.deleted",
            payload,
        )


# --------------------------------------------------------------------------
# Stan (key/value)
# --------------------------------------------------------------------------

def get_state(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    row = conn.execute(
        "SELECT value FROM asset_sync_state WHERE key=?", (key,)
    ).fetchone()
    return str(row[0]) if row is not None else default


def set_state(conn: sqlite3.Connection, key: str, value: str) -> None:
    with conn:
        conn.execute(
            "INSERT INTO asset_sync_state(key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, str(value)),
        )


def load_last_seen(conn: sqlite3.Connection) -> set[str] | None:
    """None = nigdy nie skanowano (klucz stanu brakuje albo jest uszkodzony)."""
    row = conn.execute(
        "SELECT value FROM asset_sync_state WHERE key='last_seen'"
    ).fetchone()
    if row is None:
        return None
    try:
        data = json.loads(row[0])
    except (TypeError, ValueError):
        return None
    if not isinstance(data, list):
        return None
    return {str(x) for x in data}


def save_last_seen(conn: sqlite3.Connection, ids: Iterable[str]) -> None:
    set_state(conn, "last_seen", json.dumps(sorted(str(i) for i in ids), ensure_ascii=False))


def get_pg_rev(conn: sqlite3.Connection) -> int:
    try:
        return int(get_state(conn, "pg_rev", "0") or 0)
    except (TypeError, ValueError):
        return 0


def set_pg_rev(conn: sqlite3.Connection, rev: int) -> None:
    set_state(conn, "pg_rev", str(int(rev)))


# --------------------------------------------------------------------------
# Skan zlotego indeksu -> wpisy asset_sync
# --------------------------------------------------------------------------

def _size_bytes(asset: dict) -> int | None:
    """Rozmiar pliku w bajtach, jesli indeks go zna (liczba); inaczej None.
    23.09: import padl na "size" = "L" (etykieta wizki) wpisywanej do BIGINT."""
    for key in ("size_bytes", "file_size", "bytes", "size"):
        v = asset.get(key)
        if isinstance(v, bool):
            continue
        if isinstance(v, (int, float)):
            return int(v)
    return None


def taken_from_rows(rows: dict[str, dict]) -> dict[str, str]:
    """asset_id -> asset_key z lustra (tez usuniete) - do rozwiazywania kolizji id."""
    return {aid: str(r.get("asset_key") or "") for aid, r in (rows or {}).items()
            if r.get("asset_key")}


def scan_from_index(index_assets: list[dict], root: str, *,
                    taken: dict[str, str] | None = None) -> dict[str, dict]:
    """Zloty indeks (branding-index.json) -> asset_id -> wpis skanu dla asset_sync.

    Id: stabilne id z indeksu (build-branding-index rozwiazal juz kolizje
    8-cyfrowego skrotu - ok. 8 par na 38 tys. plikow), o ile nie nalezy w bazie
    do innego pliku (`taken`: asset_id -> asset_key z lustra wierszy). Inaczej
    stable_asset_id z tym samym `taken`. 23.09: liczenie id od nowa bez kolizji
    sklejalo dwa pliki w jeden wiersz - 8 plikow znikalo, 8 id wskazywalo inny plik
    niz skojarzenia w bazie.

    Pomija pola liczone z bazy skojarzen - patrz _SCAN_META_EXCLUDE."""
    ids = asset_sync._asset_ids()  # noqa: SLF001 - ten sam modul co build-branding-index
    owner: dict[str, str] = dict(taken or {})
    # Plik znany w bazie zawsze zachowuje swoje id (23.09: build z inna kolejnoscia
    # skanu dal plikowi nowe id -> drugi wiersz z tym samym asset_key, PUSH odrzucony).
    id_by_key: dict[str, str] = {k: aid for aid, k in owner.items()}
    out: dict[str, dict] = {}
    for asset in index_assets or ():
        if not isinstance(asset, dict):
            continue
        path = asset.get("path")
        if not path:
            continue
        key = asset_sync.dir_key(str(path), root)
        cand = str(asset.get("id") or "")
        if key in id_by_key:
            aid = id_by_key[key]
        elif ids.is_stable_id(cand) and owner.get(cand, key) == key:
            aid = cand
        else:
            aid = ids.stable_asset_id(key, owner)
        owner[aid] = key
        id_by_key[key] = aid
        meta = {k: v for k, v in asset.items() if k not in _SCAN_META_EXCLUDE}
        aid, entry = asset_sync.scan_entry(
            str(path), size=_size_bytes(asset), mtime_ms=asset.get("mtime_ms") or 0,
            root=root, meta=meta, asset_id=aid,
        )
        out[aid] = entry
    return out


# --------------------------------------------------------------------------
# Lustro -> lokalny branding-index.json
# --------------------------------------------------------------------------

def live_index(rows: dict[str, dict], root: str) -> list[dict]:
    """Assety (bez usunietych) do zapisu jako branding-index.json, sciezka z
    korzeniem TEGO komputera. Kazdy ma "id", "path", "name" i pola z meta.
    Kolejnosc stabilna po path."""
    entries = asset_sync.live_entries(rows, root)
    entries.sort(key=lambda e: str(e.get("path") or ""))
    return entries


# --------------------------------------------------------------------------
# Jednorazowy import zlotego indeksu do PostgreSQL
# --------------------------------------------------------------------------

_IMPORT_SQL = """
INSERT INTO dam_assets
  (asset_id, asset_key, path_rel, name, size, mtime_ms, content_hash, meta,
   deleted_at, updated_at, updated_by, seen_by_machine, rev)
VALUES %s
ON CONFLICT (asset_id) DO NOTHING
RETURNING asset_id
"""

_IMPORT_TEMPLATE = (
    "(%s, %s, %s, %s, %s, %s, %s, %s::jsonb, NULL, %s, %s, %s, "
    "nextval('dam_assets_rev_seq'))"
)


def import_index_to_pg(pg, index_assets: list[dict], root: str, machine: str, *,
                        batch: int = 1000) -> dict:
    """Jednorazowy import zlotego indeksu do dam_assets. Import NIE nadpisuje
    nowszych wierszy - ON CONFLICT (asset_id) DO NOTHING.

    Zwraca {"inserted", "skipped_existing"} (plus "error", gdy PG odmowilo -
    bledy sieci/bazy sa raportowane, nie rzucane, jak w reszcie modulu)."""
    from psycopg2.extras import execute_values  # noqa: PLC0415 - atrapa w testach

    scan = scan_from_index(index_assets, root)
    total = len(scan)
    inserted = 0
    try:
        asset_sync.ensure_schema(pg)
        now_ms = asset_sync._now_ms()  # noqa: SLF001 - ten sam moment dla calego importu
        updated_by = f"{machine}:import"
        cur = pg.cursor()
        items = list(scan.items())
        for i in range(0, total, max(1, int(batch))):
            chunk = items[i:i + max(1, int(batch))]
            values = []
            for aid, entry in chunk:
                meta_json = json.dumps(entry.get("meta") or {}, ensure_ascii=False, sort_keys=True)
                values.append((
                    aid, entry.get("asset_key") or "", entry.get("path_rel") or "",
                    entry.get("name") or "", entry.get("size"),
                    int(entry.get("mtime_ms") or 0), entry.get("content_hash"),
                    meta_json, now_ms, updated_by, machine,
                ))
            if not values:
                continue
            rows = execute_values(cur, _IMPORT_SQL, values, template=_IMPORT_TEMPLATE,
                                  page_size=len(values), fetch=True)
            inserted += len(rows or [])
        pg.commit()
    except Exception as exc:  # noqa: BLE001 - siec / baza: raport, nie wyjatek
        asset_sync._rollback(pg)  # noqa: SLF001
        return {"inserted": inserted, "skipped_existing": max(0, total - inserted),
                "ok": False, "error": str(exc)[:300]}
    return {"inserted": inserted, "skipped_existing": total - inserted, "ok": True}
