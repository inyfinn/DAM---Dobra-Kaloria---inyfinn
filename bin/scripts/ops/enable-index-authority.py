# -*- coding: utf-8 -*-
"""ADR-012: wlacz / wycofaj bramke "jeden wlasciciel wspolnego katalogu" w PostgreSQL.

Wlaczenie (jedna transakcja):
  1. bin/apps/desktop/sql/authority_gate.sql (tabela dam_authority_rejects, funkcje +
     wyzwalacze dam_authority_gate_snapshots / dam_authority_gate_assets; idempotentny),
  2. dam_meta['index_authority'] = {"machines": [...], "updated_at", "updated_by"}.
  dam_assets: odmowa = pominiecie wiersza (RETURN NULL) + wpis w dam_authority_rejects;
  dam_index_snapshots: odmowa = wyjatek "dam_not_authority:" (bez wpisu - rollback).

Wycofanie (--rollback, jedna transakcja, bez DROP):
  1. dam_meta['index_authority'].machines = [] (bramka i klient jak przed zmiana),
  2. ALTER TABLE ... DISABLE TRIGGER dam_authority_gate_* (gdy istnieja).
  dam_authority_rejects zostaje (dziennik; --status pokazuje podsumowanie).
  Ponowne wlaczenie = zwykle wywolanie bez --rollback (plik SQL tworzy wyzwalacze od nowa).

BEZ --apply NIC NIE ZAPISUJE (dry-run: stan + SQL, ktory zostalby wykonany).

Polaczenie: tylko z DSN w zmiennej srodowiskowej (--dsn-env NAZWA). Zadnej
konfiguracji aplikacji (pg-config.json, *.dpapi) ten skrypt nie czyta ani nie pisze.
Baza `dam_eta` (produkcja) wymaga jawnego --production.

Dla produkcji przez SSH/psql (bez Pythona na serwerze):
  python enable-index-authority.py --machines KRZYSZTOFWI --print-sql > enable.sql
  python enable-index-authority.py --rollback --print-sql > rollback.sql
  psql ... -v ON_ERROR_STOP=1 -f enable.sql

Uzycie:
  python enable-index-authority.py --dsn-env DAM_TEST_PG_DSN --status
  python enable-index-authority.py --dsn-env DAM_TEST_PG_DSN --machines KRZYSZTOFWI            (dry-run)
  python enable-index-authority.py --dsn-env DAM_TEST_PG_DSN --machines KRZYSZTOFWI --apply
  python enable-index-authority.py --dsn-env DAM_TEST_PG_DSN --rollback --apply
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
GATE_SQL_PATH = HERE.parents[1] / "apps" / "desktop" / "sql" / "authority_gate.sql"
MODE_KEY = "index_authority"
PRODUCTION_DBNAMES = {"dam_eta"}
TRIGGERS = (
    ("dam_index_snapshots", "dam_authority_gate_snapshots"),
    ("dam_assets", "dam_authority_gate_assets"),
)
_MACHINE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$")


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_machines(raw: str) -> list[str]:
    """'A, b ,C' -> ['A', 'b', 'C']. Nazwa tylko [A-Za-z0-9._-] (COMPUTERNAME) -
    nic, co mogloby rozbic literal SQL w --print-sql."""
    machines = [m.strip() for m in str(raw or "").split(",") if m.strip()]
    bad = [m for m in machines if not _MACHINE_RE.match(m)]
    if bad:
        raise ValueError(f"niedozwolona nazwa komputera: {bad}")
    return machines


def authority_value(machines: list[str], *, note: str = "") -> str:
    value: dict[str, Any] = {
        "machines": list(machines),
        "updated_at": _utc(),
        "updated_by": "enable-index-authority.py" + (f" {note}" if note else ""),
    }
    return json.dumps(value, ensure_ascii=False)


def _sql_literal(text: str) -> str:
    return "'" + str(text).replace("'", "''") + "'"


def _upsert_meta_sql(value_json: str) -> str:
    return (
        "INSERT INTO dam_meta (key, value) VALUES "
        f"({_sql_literal(MODE_KEY)}, {_sql_literal(value_json)})\n"
        "  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"
    )


def _disable_triggers_sql() -> str:
    lines = ["DO $rb$", "BEGIN"]
    for table, trig in TRIGGERS:
        lines.append(
            f"  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = '{trig}' "
            f"AND tgrelid = to_regclass('{table}')) THEN\n"
            f"    ALTER TABLE {table} DISABLE TRIGGER {trig};\n"
            "  END IF;"
        )
    lines += ["END", "$rb$;"]
    return "\n".join(lines)


def enable_script(machines: list[str]) -> str:
    """Pelny skrypt wlaczenia (dla psql i dla --apply - ten sam tekst)."""
    if not machines:
        raise ValueError("--machines puste - do wylaczenia sluzy --rollback")
    gate = GATE_SQL_PATH.read_text(encoding="utf-8")
    return "\n".join([
        "-- enable-index-authority.py: wlaczenie bramki ADR-012",
        "BEGIN;",
        "SET LOCAL lock_timeout = '15s';",
        gate.rstrip(),
        _upsert_meta_sql(authority_value(machines)),
        "COMMIT;",
        "",
    ])


def rollback_script(previous: list[str] | None = None) -> str:
    note = "--rollback" + (f" (bylo: {','.join(previous)})" if previous else "")
    return "\n".join([
        "-- enable-index-authority.py --rollback: wycofanie bramki ADR-012 (bez DROP)",
        "BEGIN;",
        "SET LOCAL lock_timeout = '15s';",
        _upsert_meta_sql(authority_value([], note=note)),
        _disable_triggers_sql(),
        "COMMIT;",
        "",
    ])


def dbname_of(dsn: str) -> str:
    try:
        from psycopg2.extensions import parse_dsn  # noqa: PLC0415

        return str(parse_dsn(dsn).get("dbname") or "")
    except Exception:  # noqa: BLE001 - brak psycopg2 / zly DSN: prosty odczyt
        m = re.search(r"(?:^|\s)dbname=('?)([^'\s]+)\1", dsn)
        if m:
            return m.group(2)
        m = re.search(r"^postgres(?:ql)?://[^/]+/([^?]+)", dsn)
        return m.group(1) if m else ""


def guard_error(dbname: str, *, production: bool) -> str:
    if not dbname:
        return "nie da sie ustalic dbname z DSN - odmowa"
    if dbname in PRODUCTION_DBNAMES and not production:
        return f"baza '{dbname}' to produkcja - wymagany jawny --production"
    return ""


def status(conn) -> dict[str, Any]:
    cur = conn.cursor()
    cur.execute("SELECT current_database() AS db, current_user AS usr")
    row = cur.fetchone()
    db = row["db"] if hasattr(row, "keys") else row[0]
    usr = row["usr"] if hasattr(row, "keys") else row[1]
    cur.execute("SELECT to_regclass('dam_meta') AS t")
    row = cur.fetchone()
    has_meta = bool(row["t"] if hasattr(row, "keys") else row[0])
    raw = None
    if has_meta:
        cur.execute("SELECT value FROM dam_meta WHERE key = %s", (MODE_KEY,))
        row = cur.fetchone()
        raw = (row["value"] if hasattr(row, "keys") else row[0]) if row else None
    triggers = {}
    for table, trig in TRIGGERS:
        cur.execute(
            "SELECT tgenabled FROM pg_trigger WHERE tgname = %s AND tgrelid = to_regclass(%s)",
            (trig, table),
        )
        row = cur.fetchone()
        val = (row["tgenabled"] if hasattr(row, "keys") else row[0]) if row else None
        if isinstance(val, bytes):
            val = val.decode("ascii", "replace")
        triggers[trig] = "brak" if val is None else ("wylaczony" if val == "D" else "wlaczony")
    rejects: dict[str, Any] | None = None
    cur.execute("SELECT to_regclass('dam_authority_rejects') AS t")
    row = cur.fetchone()
    if row and (row["t"] if hasattr(row, "keys") else row[0]):
        cur.execute(
            "SELECT count(*) AS n, coalesce(sum(hits), 0) AS hits, "
            "count(*) FILTER (WHERE last_at > now() - interval '24 hours') AS n24, "
            "max(last_at)::text AS last FROM dam_authority_rejects")
        r = cur.fetchone()
        g = (lambda k, i: r[k] if hasattr(r, "keys") else r[i])
        rejects = {"wpisy": int(g("n", 0)), "powtorzenia": int(g("hits", 1)),
                   "wpisy_24h": int(g("n24", 2)), "ostatnia": g("last", 3)}
        cur.execute(
            "SELECT machine, reason, count(*) AS n, sum(hits) AS hits FROM dam_authority_rejects "
            "GROUP BY machine, reason ORDER BY sum(hits) DESC LIMIT 10")
        rejects["wg_maszyny"] = [
            {"machine": x["machine"] if hasattr(x, "keys") else x[0],
             "reason": x["reason"] if hasattr(x, "keys") else x[1],
             "wpisy": int(x["n"] if hasattr(x, "keys") else x[2]),
             "powtorzenia": int(x["hits"] if hasattr(x, "keys") else x[3])}
            for x in cur.fetchall()]
    machines: list[str] = []
    if raw:
        try:
            data = json.loads(raw)
            if isinstance(data, dict) and isinstance(data.get("machines"), list):
                machines = [str(m) for m in data["machines"]]
        except ValueError:
            pass
    conn.rollback()
    return {"db": db, "user": usr, "index_authority_raw": raw, "machines": machines,
            "triggers": triggers, "rejects": rejects,
            "gate_active": bool(machines) and all(v == "wlaczony" for v in triggers.values())}


def apply_script(conn, script: str) -> None:
    """Skrypt ma wlasne BEGIN/COMMIT - wykonujemy go w autocommit, jak psql -f."""
    prev = conn.autocommit
    conn.autocommit = True
    try:
        cur = conn.cursor()
        try:
            cur.execute(script)
        except Exception:
            try:
                cur.execute("ROLLBACK")
            except Exception:  # noqa: BLE001
                pass
            raise
    finally:
        conn.autocommit = prev


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dsn-env", default="", help="nazwa zmiennej srodowiskowej z DSN PostgreSQL")
    ap.add_argument("--machines", default="", help="lista COMPUTERNAME po przecinku, np. KRZYSZTOFWI")
    ap.add_argument("--rollback", action="store_true", help="machines=[] + DISABLE TRIGGER (bez DROP)")
    ap.add_argument("--status", action="store_true", help="tylko pokaz stan bramki")
    ap.add_argument("--print-sql", action="store_true", help="wypisz SQL do wykonania przez psql i wyjdz")
    ap.add_argument("--apply", action="store_true", help="naprawde wykonaj (domyslnie dry-run)")
    ap.add_argument("--production", action="store_true", help="zgoda na baze produkcyjna dam_eta")
    args = ap.parse_args(argv)

    if args.rollback and args.machines:
        print("Blad: --rollback i --machines wykluczaja sie.")
        return 2
    try:
        machines = parse_machines(args.machines)
    except ValueError as exc:
        print(f"Blad: {exc}")
        return 2
    if not (args.rollback or args.status) and not machines:
        print("Blad: podaj --machines (wlaczenie), --rollback albo --status.")
        return 2

    if args.print_sql:
        sys.stdout.write(rollback_script() if args.rollback else enable_script(machines))
        return 0

    env_name = args.dsn_env.strip()
    dsn = os.environ.get(env_name, "").strip() if env_name else ""
    if not dsn:
        print("Blad: brak DSN - podaj --dsn-env NAZWA_ZMIENNEJ (zmienna musi byc ustawiona).")
        return 2
    dbname = dbname_of(dsn)
    err = guard_error(dbname, production=args.production)
    if err:
        print(f"Odmowa: {err}")
        return 3

    import psycopg2  # noqa: PLC0415
    import psycopg2.extras  # noqa: PLC0415

    conn = psycopg2.connect(dsn, connect_timeout=15, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        before = status(conn)
        err = guard_error(str(before["db"]), production=args.production)
        if err:
            print(f"Odmowa (po polaczeniu): {err}")
            return 3
        print("Stan przed:", json.dumps(before, ensure_ascii=False, indent=2))
        if args.status:
            return 0
        script = rollback_script(before["machines"]) if args.rollback else enable_script(machines)
        if not args.apply:
            print("\n--apply nie podane - NIC nie zapisano. SQL, ktory zostalby wykonany:\n")
            print(script)
            return 0
        apply_script(conn, script)
        after = status(conn)
        print("Stan po:", json.dumps(after, ensure_ascii=False, indent=2))
        ok = (not after["gate_active"]) if args.rollback else after["gate_active"]
        return 0 if ok else 5
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
