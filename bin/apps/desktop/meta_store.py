# -*- coding: utf-8 -*-
"""
Metadata/DB FK - produkty, rewizje, pliki, tagi, osoby.

Zrodlo prawdy do sync: apps/web/data/file-index.json
Tabele w lokalnym SQLite (dam-local.sqlite) - ten sam plik co auth.
UI Geex nadal czyta JSON; FK = spojnosc / audit / przyszly odczyt z SQL.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = DESKTOP_DIR.parent / "web"
FILE_INDEX = WEB_ROOT / "data" / "file-index.json"
DB_PATH = DESKTOP_DIR / "data" / "dam-local.sqlite"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS meta_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  root_key TEXT NOT NULL DEFAULT '',
  subcategory_slug TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  folder TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  index_code TEXT NOT NULL DEFAULT '',
  UNIQUE(product_id, path),
  FOREIGN KEY(product_id) REFERENCES meta_products(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS meta_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  revision_path TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  UNIQUE(path),
  FOREIGN KEY(product_id) REFERENCES meta_products(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS meta_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS meta_product_tags (
  product_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (product_id, tag_id),
  FOREIGN KEY(product_id) REFERENCES meta_products(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES meta_tags(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS meta_persons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS meta_product_persons (
  product_id TEXT NOT NULL,
  person_id INTEGER NOT NULL,
  PRIMARY KEY (product_id, person_id),
  FOREIGN KEY(product_id) REFERENCES meta_products(id) ON DELETE CASCADE,
  FOREIGN KEY(person_id) REFERENCES meta_persons(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS meta_sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  synced_at TEXT NOT NULL,
  product_count INTEGER NOT NULL DEFAULT 0,
  revision_count INTEGER NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  tag_count INTEGER NOT NULL DEFAULT 0,
  person_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS meta_revisions_product_idx ON meta_revisions(product_id);
CREATE INDEX IF NOT EXISTS meta_files_product_idx ON meta_files(product_id);
CREATE INDEX IF NOT EXISTS meta_files_role_idx ON meta_files(role);
"""


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure_schema(conn: sqlite3.Connection | None = None) -> None:
    own = conn is None
    if own:
        conn = _connect()
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        if own:
            conn.close()


def _slug_tag(raw: str) -> str:
    return (raw or "").strip().lower().replace(" ", "-")[:120]


def sync_from_file_index(index_path: Path | None = None) -> dict[str, Any]:
    """Import file-index.json -> tabele FK (replace sync)."""
    path = index_path or FILE_INDEX
    if not path.is_file():
        return {"ok": False, "error": "file_index_missing", "path": str(path)}

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"ok": False, "error": str(exc)}

    products = data.get("products") or []
    if not isinstance(products, list):
        return {"ok": False, "error": "products_not_list"}

    now = _utc()
    conn = _connect()
    try:
        ensure_schema(conn)
        # Pelny resync: czysc tabele zalezne, potem produkty
        conn.executescript(
            """
            DELETE FROM meta_product_persons;
            DELETE FROM meta_product_tags;
            DELETE FROM meta_files;
            DELETE FROM meta_revisions;
            DELETE FROM meta_products;
            DELETE FROM meta_tags;
            DELETE FROM meta_persons;
            """
        )

        tag_cache: dict[str, int] = {}
        person_cache: dict[str, int] = {}
        rev_n = 0
        file_n = 0

        for prod in products:
            if not isinstance(prod, dict):
                continue
            pid = str(prod.get("id") or "").strip()
            if not pid:
                continue
            conn.execute(
                """
                INSERT INTO meta_products
                  (id, name, display_name, brand, category, path, root_key, subcategory_slug, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pid,
                    str(prod.get("name") or ""),
                    str(prod.get("display_name") or prod.get("name") or ""),
                    str(prod.get("brand") or ""),
                    str(prod.get("category") or ""),
                    str(prod.get("path") or ""),
                    str(prod.get("root_key") or ""),
                    str(prod.get("subcategory_slug") or ""),
                    now,
                ),
            )

            # Tagi + osoby
            groups = prod.get("tag_groups") if isinstance(prod.get("tag_groups"), dict) else {}
            flat_tags = prod.get("tags") if isinstance(prod.get("tags"), list) else []
            for t in flat_tags:
                label = str(t or "").strip()
                if not label:
                    continue
                slug = _slug_tag(label)
                if slug not in tag_cache:
                    conn.execute(
                        "INSERT INTO meta_tags (slug, label, group_name) VALUES (?, ?, '') "
                        "ON CONFLICT(slug) DO UPDATE SET label=excluded.label",
                        (slug, label),
                    )
                    tag_cache[slug] = int(
                        conn.execute("SELECT id FROM meta_tags WHERE slug = ?", (slug,)).fetchone()[0]
                    )
                conn.execute(
                    "INSERT OR IGNORE INTO meta_product_tags (product_id, tag_id) VALUES (?, ?)",
                    (pid, tag_cache[slug]),
                )

            for group_name, vals in groups.items():
                if not isinstance(vals, list):
                    continue
                g = str(group_name or "").strip().lower()
                for v in vals:
                    label = str(v or "").strip()
                    if not label:
                        continue
                    if g in ("osoba", "autor", "person", "people"):
                        key = label.lower()
                        if key not in person_cache:
                            conn.execute(
                                "INSERT OR IGNORE INTO meta_persons (name) VALUES (?)",
                                (label,),
                            )
                            person_cache[key] = int(
                                conn.execute(
                                    "SELECT id FROM meta_persons WHERE name = ? COLLATE NOCASE",
                                    (label,),
                                ).fetchone()[0]
                            )
                        conn.execute(
                            "INSERT OR IGNORE INTO meta_product_persons (product_id, person_id) VALUES (?, ?)",
                            (pid, person_cache[key]),
                        )
                    else:
                        slug = _slug_tag(label)
                        if slug not in tag_cache:
                            conn.execute(
                                "INSERT INTO meta_tags (slug, label, group_name) VALUES (?, ?, ?) "
                                "ON CONFLICT(slug) DO UPDATE SET group_name=excluded.group_name",
                                (slug, label, g),
                            )
                            tag_cache[slug] = int(
                                conn.execute("SELECT id FROM meta_tags WHERE slug = ?", (slug,)).fetchone()[0]
                            )
                        else:
                            conn.execute(
                                "UPDATE meta_tags SET group_name = ? WHERE id = ? AND (group_name = '' OR group_name IS NULL)",
                                (g, tag_cache[slug]),
                            )
                        conn.execute(
                            "INSERT OR IGNORE INTO meta_product_tags (product_id, tag_id) VALUES (?, ?)",
                            (pid, tag_cache[slug]),
                        )

            for rev in prod.get("revisions") or []:
                if not isinstance(rev, dict):
                    continue
                rpath = str(rev.get("path") or "")
                conn.execute(
                    """
                    INSERT OR IGNORE INTO meta_revisions (product_id, folder, path, index_code)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        pid,
                        str(rev.get("folder") or ""),
                        rpath,
                        str(rev.get("index") or rev.get("index_code") or ""),
                    ),
                )
                rev_n += 1
                files_by_role = rev.get("files_by_role") if isinstance(rev.get("files_by_role"), dict) else {}
                for role, files in files_by_role.items():
                    if not isinstance(files, list):
                        continue
                    for f in files:
                        if isinstance(f, str):
                            fpath, fname = f, Path(f).name
                        elif isinstance(f, dict):
                            fpath = str(f.get("path") or "")
                            fname = str(f.get("name") or Path(fpath).name)
                        else:
                            continue
                        if not fpath:
                            continue
                        conn.execute(
                            """
                            INSERT OR IGNORE INTO meta_files
                              (product_id, revision_path, path, role, name)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                            (pid, rpath, fpath, str(role or ""), fname),
                        )
                        file_n += 1

        prod_n = conn.execute("SELECT COUNT(*) FROM meta_products").fetchone()[0]
        tag_n = conn.execute("SELECT COUNT(*) FROM meta_tags").fetchone()[0]
        person_n = conn.execute("SELECT COUNT(*) FROM meta_persons").fetchone()[0]
        rev_n = conn.execute("SELECT COUNT(*) FROM meta_revisions").fetchone()[0]
        file_n = conn.execute("SELECT COUNT(*) FROM meta_files").fetchone()[0]

        conn.execute("DELETE FROM meta_sync_state")
        conn.execute(
            """
            INSERT INTO meta_sync_state
              (id, synced_at, product_count, revision_count, file_count, tag_count, person_count, source)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?)
            """,
            (now, prod_n, rev_n, file_n, tag_n, person_n, str(path)),
        )
        conn.commit()
        return {
            "ok": True,
            "synced_at": now,
            "products": prod_n,
            "revisions": rev_n,
            "files": file_n,
            "tags": tag_n,
            "persons": person_n,
            "source": str(path),
        }
    finally:
        conn.close()


def status() -> dict[str, Any]:
    ensure_schema()
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM meta_sync_state WHERE id = 1").fetchone()
        if not row:
            return {
                "ok": True,
                "synced": False,
                "products": 0,
                "revisions": 0,
                "files": 0,
                "tags": 0,
                "persons": 0,
                "hint": "Uruchom sync (admin) albo przebuduj indeks plikow.",
            }
        return {
            "ok": True,
            "synced": True,
            "synced_at": row["synced_at"],
            "products": row["product_count"],
            "revisions": row["revision_count"],
            "files": row["file_count"],
            "tags": row["tag_count"],
            "persons": row["person_count"],
            "source": row["source"],
        }
    finally:
        conn.close()


if __name__ == "__main__":
    print(json.dumps(sync_from_file_index(), ensure_ascii=False, indent=2))
