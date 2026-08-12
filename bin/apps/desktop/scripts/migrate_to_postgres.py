# -*- coding: utf-8 -*-
"""
Jednorazowa migracja lokalnych danych do Postgresa na Synology (ADR-009).

Kopiuje:
  1) users / device_sessions / audit_log z apps/desktop/data/dam-local.sqlite
  2) 10 plikow JSON z apps/web/data/ (Tier 2, patrz pg_schema.sql: dam_kv_store)

Domyslnie DRY-RUN (tylko raport, zero zapisu). Uzyj --apply do wykonania.
Idempotentne: mozna uruchomic wielokrotnie (ON CONFLICT DO UPDATE / upsert po
emailu dla userow) - NIE duplikuje wierszy przy ponownym starcie.

Uzycie:
  python apps/desktop/scripts/migrate_to_postgres.py            # raport
  python apps/desktop/scripts/migrate_to_postgres.py --apply    # wykonanie
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = DESKTOP_DIR.parent.parent
WEB_DATA = REPO_ROOT / "apps" / "web" / "data"
sys.path.insert(0, str(DESKTOP_DIR))

import pg_db  # noqa: E402

JSON_STORES = [
    "product-aliases",
    "naming-dictionary",
    "tag-proposals",
    "carrier-types",
    "carrier-assignment-log",
    "notification-groups",
    "inbox-items",
    "carrier-overrides",
    "viz-flags",
    "thumb-overrides",
]


def migrate_sqlite_auth(apply: bool) -> dict:
    import sqlite3

    db_path = DESKTOP_DIR / "data" / "dam-local.sqlite"
    report = {"users": 0, "device_sessions": 0, "audit_log": 0, "skipped": not db_path.is_file()}
    if not db_path.is_file():
        print(f"[auth] {db_path} nie istnieje - pomijam (brak lokalnej bazy do migracji).")
        return report

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    users = conn.execute("SELECT * FROM users").fetchall()
    sessions = conn.execute("SELECT * FROM device_sessions").fetchall()
    audits = conn.execute("SELECT * FROM audit_log").fetchall()
    conn.close()

    print(f"[auth] SQLite: {len(users)} users, {len(sessions)} device_sessions, {len(audits)} audit_log")
    report["users"] = len(users)
    report["device_sessions"] = len(sessions)
    report["audit_log"] = len(audits)
    if not apply:
        return report

    pg = pg_db.connect()
    try:
        cur = pg.cursor()
        email_to_pg_id: dict[str, int] = {}
        for u in users:
            cur.execute(
                """
                INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (email) DO UPDATE SET
                  name = excluded.name, role = excluded.role,
                  password_hash = excluded.password_hash, updated_at = excluded.updated_at
                RETURNING id
                """,
                (
                    u["email"], u["name"], u["role"], u["password_hash"],
                    u["auth_provider"], u["created_at"], u["updated_at"],
                ),
            )
            email_to_pg_id[u["email"].lower()] = cur.fetchone()["id"]

        for s in sessions:
            src_user = next((u for u in users if u["id"] == s["user_id"]), None)
            if not src_user:
                continue
            pg_user_id = email_to_pg_id.get(src_user["email"].lower())
            if not pg_user_id:
                continue
            cur.execute(
                """
                INSERT INTO device_sessions (
                  user_id, device_id, machine_id, session_id, windows_user, hostname,
                  token_hash, created_at, last_seen_at, revoked
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, device_id) DO UPDATE SET
                  token_hash = excluded.token_hash, machine_id = excluded.machine_id,
                  session_id = excluded.session_id, windows_user = excluded.windows_user,
                  hostname = excluded.hostname, last_seen_at = excluded.last_seen_at,
                  revoked = excluded.revoked
                """,
                (
                    pg_user_id, s["device_id"], s["machine_id"] or "", s["session_id"] or "",
                    s["windows_user"] or "", s["hostname"] or "", s["token_hash"],
                    s["created_at"], s["last_seen_at"], bool(s["revoked"]),
                ),
            )

        for a in audits:
            cur.execute(
                """
                INSERT INTO audit_log (ts, action, username, path, local_path, detail, meta_json)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (a["ts"], a["action"], a["username"], a["path"], a["local_path"], a["detail"], a["meta_json"]),
            )
        pg.commit()
        print(f"[auth] Zapisano do Postgresa: {len(users)} users, {len(sessions)} sessions, {len(audits)} audit_log")
    finally:
        pg.close()
    return report


def migrate_json_stores(apply: bool) -> dict:
    report = {}
    for store_key in JSON_STORES:
        path = WEB_DATA / f"{store_key}.json"
        if not path.is_file():
            print(f"[kv] {store_key}: plik nie istnieje ({path.name}) - pomijam")
            report[store_key] = "missing"
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            print(f"[kv] {store_key}: BLAD JSON - {exc}")
            report[store_key] = f"json_error: {exc}"
            continue
        size = len(json.dumps(payload))
        print(f"[kv] {store_key}: {size} bajtow z {path.name}" + (" -> zapis do Postgresa" if apply else " (dry-run)"))
        report[store_key] = size
        if apply:
            pg_db.kv_set(store_key, payload, updated_by="migrate_to_postgres.py")
    return report


def main() -> None:
    apply = "--apply" in sys.argv
    print("=== Migracja do Postgresa (Synology, ADR-009) ===")
    print(f"Tryb: {'APPLY (zapis)' if apply else 'DRY-RUN (tylko raport)'}")
    print()

    ping = pg_db.ping()
    if not ping.get("ok"):
        print(f"BLAD: brak polaczenia z Postgresem - {ping.get('error')}")
        sys.exit(1)
    print("Polaczenie z Postgresem: OK")
    print()

    auth_report = migrate_sqlite_auth(apply)
    print()
    kv_report = migrate_json_stores(apply)
    print()
    print("=== Podsumowanie ===")
    print(json.dumps({"auth": auth_report, "kv_stores": kv_report}, ensure_ascii=False, indent=2))
    if not apply:
        print()
        print("To byl DRY-RUN. Uruchom z --apply, aby faktycznie zapisac do Postgresa.")


if __name__ == "__main__":
    main()
