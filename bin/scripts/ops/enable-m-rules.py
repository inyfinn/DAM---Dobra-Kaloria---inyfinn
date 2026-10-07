# -*- coding: utf-8 -*-
"""Etap 1a nowej synchronizacji: instalacja i przelaczanie regul "komputer z M:" w PostgreSQL (K2, K3, K5, K6a).

Struktury zmienia WYLACZNIE ten skrypt (konto z prawem zmiany struktury) - klient programu nie robi nigdy
CREATE / ALTER / DROP. Kolejnosc (kazdy krok osobnym wywolaniem, kazdy z --status przed i po):

  1. --install --apply        m_columns.sql (11 kolumn + 2 indeksy + ograniczenie NOT VALID), potem m_rules.sql
                              (funkcje, wyzwalacz dam_assets_rules, klucz dam_meta['m_rules'] = tryb "off").
                              Wymaga wczesniej: authority_gate.sql i fleet.sql (etap 0: dam_is_m_computer).
                              Odmawia, gdy ich brakuje - nie dopuszcza do blednej kolejnosci.
  2. --mode shadow --apply    dopiero gdy KRZYSZTOFWI pracuje na nowym kliencie i jest zatwierdzony jako komputer z M:.
     --mode on --apply        po uzgodnieniu katalogu (reconcile-catalog-with-m.py) i akceptacji raportu.
     --mode off --apply       natychmiastowy powrot do starych regul (dziala tez bez wiersza i przy zepsutym JSON).
  3. --validate --apply       05: zatwierdzenie ograniczenia origin dla calej tabeli (po K6).
  --rollback --apply          03: stary wyzwalacz ADR-012 z powrotem, nowy zdjety, tryb off. Bez DROP funkcji i kolumn.

BEZ --apply NIC NIE ZAPISUJE (dry-run: stan + SQL, ktory zostalby wykonany). --print-sql wypisuje skrypt dla psql.
Baza `dam_eta` (produkcja) wymaga jawnego --production. Polaczenie: --dsn-env NAZWA (zmienna z DSN)."""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
SQL_DIR = HERE.parents[1] / "apps" / "desktop" / "sql"
MODES = ("off", "shadow", "on")
COLUMNS = ("origin", "master_seen_ms", "master_mtime", "master_size", "missing_since_ms", "checked_ms",
           "delete_batch", "author_mtime", "author_size", "author_by", "author_seen_ms")


def _helpers():
    """dbname_of / guard_error / apply_script z enable-index-authority.py (jedna definicja zasad dla obu skryptow)."""
    spec = importlib.util.spec_from_file_location("enable_index_authority", HERE / "enable-index-authority.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def _g(row: Any, key: str, idx: int = 0) -> Any:
    return row[key] if hasattr(row, "keys") else row[idx]


def read_rules(cur) -> tuple[str | None, dict]:
    cur.execute("SELECT to_regclass('dam_meta') AS t")
    if not _g(cur.fetchone(), "t"):
        return None, {}
    cur.execute("SELECT value FROM dam_meta WHERE key = 'm_rules'")
    row = cur.fetchone()
    raw = _g(row, "value") if row else None
    try:
        data = json.loads(raw) if raw else {}
    except ValueError:
        data = {}
    return raw, data if isinstance(data, dict) else {}


def status(conn) -> dict[str, Any]:
    cur = conn.cursor()
    cur.execute("SELECT current_database() AS db, current_user AS usr")
    r = cur.fetchone()
    out: dict[str, Any] = {"db": _g(r, "db"), "user": _g(r, "usr", 1)}
    cur.execute("SELECT count(*) AS n FROM information_schema.columns WHERE table_schema = current_schema() "
                "AND table_name = 'dam_assets' AND column_name = ANY(%s)", (list(COLUMNS),))
    out["columns"] = f"{int(_g(cur.fetchone(), 'n'))}/{len(COLUMNS)}"
    for key, fn in (("fn_dam_assets_rules", "dam_assets_rules()"), ("fn_dam_is_m_computer", "dam_is_m_computer(text)"),
                    ("fn_dam_authority_machines", "dam_authority_machines()")):
        cur.execute("SELECT to_regprocedure(%s) IS NOT NULL AS ok", (fn,))
        out[key] = bool(_g(cur.fetchone(), "ok"))
    cur.execute("SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = to_regclass('dam_assets') AND NOT tgisinternal")
    out["triggers"] = {_g(t, "tgname"): ("wylaczony" if str(_g(t, "tgenabled", 1)) in ("D", "b'D'") else "wlaczony")
                       for t in cur.fetchall()}
    raw, rules = read_rules(cur)
    out["m_rules_raw"] = raw
    out["mode"] = rules.get("mode", "off") if rules else "off"
    cur.execute("SELECT to_regclass('dam_m_computers') AS t")
    if _g(cur.fetchone(), "t"):
        cur.execute("SELECT machine, drive, state, source FROM dam_m_computers ORDER BY machine, drive")
        out["m_computers"] = [{"machine": _g(x, "machine"), "drive": _g(x, "drive", 1), "state": _g(x, "state", 2),
                               "source": _g(x, "source", 3)} for x in cur.fetchall()]
    conn.rollback()
    out["installed"] = (out["columns"] == f"{len(COLUMNS)}/{len(COLUMNS)}" and out["fn_dam_assets_rules"]
                        and "dam_assets_rules" in out["triggers"])
    return out


def mode_script(mode: str, current: dict) -> str:
    cfg = {"mode": mode, "proto": 1, "confirm_ms": 90000, "hold_ms": 900000,
           "batch_max_files": 1000, "batch_max_share": 0.02}
    cfg.update({k: v for k, v in current.items() if k != "mode" and k in cfg})
    cfg["updated_at"] = datetime.now(timezone.utc).isoformat()
    cfg["updated_by"] = "enable-m-rules.py"
    val = json.dumps(cfg, ensure_ascii=False).replace("'", "''")
    return ("BEGIN;\nSET LOCAL lock_timeout = '5s';\n"
            f"INSERT INTO dam_meta (key, value) VALUES ('m_rules', '{val}')\n"
            f"  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;\nCOMMIT;\n")


def plan(args, st: dict | None) -> tuple[str, list[str]]:
    """(skrypt do wykonania, lista odmow). Odmowa = przerwanie przed jakimkolwiek zapisem."""
    refusals: list[str] = []
    if args.rollback:
        return _sql("m_rules_rollback.sql"), refusals
    if args.validate:
        if st is not None and not st["installed"]:
            refusals.append("kolumny / wyzwalacz etapu 1a nie sa zainstalowane - najpierw --install")
        return _sql("m_validate.sql"), refusals
    if args.install:
        if st is not None:
            for key, what in (("fn_dam_authority_machines", "authority_gate.sql (enable-index-authority.py)"),
                              ("fn_dam_is_m_computer", "fleet.sql (etap 0: dam_is_m_computer)")):
                if not st[key]:
                    refusals.append(f"brak {what} - zla kolejnosc instalacji")
        return _sql("m_columns.sql") + "\n" + _sql("m_rules.sql"), refusals
    if args.mode:
        if st is not None and not st["installed"]:
            refusals.append("kolumny / wyzwalacz etapu 1a nie sa zainstalowane - najpierw --install")
        if st is not None and args.mode != "off" and not any(c["state"] == "approved" for c in st.get("m_computers", [])):
            refusals.append("brak zatwierdzonego komputera z M: w dam_m_computers - najpierw zatwierdz komputer (etap 0)")
        try:
            current = json.loads((st or {}).get("m_rules_raw") or "{}")
        except ValueError:
            current = {}
        return mode_script(args.mode, current if isinstance(current, dict) else {}), refusals
    return "", ["podaj --status, --install, --mode, --validate albo --rollback"]


def main(argv: list[str] | None = None, *, connect=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dsn-env", default="")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--install", action="store_true")
    ap.add_argument("--mode", choices=MODES)
    ap.add_argument("--validate", action="store_true")
    ap.add_argument("--rollback", action="store_true")
    ap.add_argument("--print-sql", action="store_true")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--production", action="store_true")
    args = ap.parse_args(argv)
    if sum(bool(x) for x in (args.status, args.install, args.mode, args.validate, args.rollback)) != 1:
        print("Blad: podaj dokladnie jedno z --status, --install, --mode, --validate, --rollback.")
        return 2
    if args.print_sql:
        script, _ref = plan(args, None)
        sys.stdout.write(script)
        return 0
    h = _helpers()
    if connect is None:
        dsn = os.environ.get(args.dsn_env.strip(), "").strip() if args.dsn_env.strip() else ""
        if not dsn:
            print("Blad: brak DSN - podaj --dsn-env NAZWA_ZMIENNEJ (zmienna musi byc ustawiona).")
            return 2
        err = h.guard_error(h.dbname_of(dsn), production=args.production)
        if err:
            print(f"Odmowa: {err}")
            return 3

        def connect():
            import psycopg2  # noqa: PLC0415
            import psycopg2.extras  # noqa: PLC0415

            return psycopg2.connect(dsn, connect_timeout=15, cursor_factory=psycopg2.extras.RealDictCursor)
    conn = connect()
    try:
        before = status(conn)
        err = h.guard_error(str(before["db"]), production=args.production)
        if err:
            print(f"Odmowa (po polaczeniu): {err}")
            return 3
        print("Stan przed:", json.dumps(before, ensure_ascii=False, indent=2, default=str))
        if args.status:
            return 0
        script, refusals = plan(args, before)
        if refusals:
            print("Odmowa:", "; ".join(refusals))
            return 3
        if not args.apply:
            print("\n--apply nie podane - NIC nie zapisano. SQL, ktory zostalby wykonany:\n")
            print(script)
            return 0
        h.apply_script(conn, script)
        after = status(conn)
        print("Stan po:", json.dumps(after, ensure_ascii=False, indent=2, default=str))
        if args.install:
            return 0 if after["installed"] else 5
        if args.mode:
            return 0 if after["mode"] == args.mode else 5
        if args.rollback:
            return 0 if (after["mode"] == "off" and "dam_assets_rules" not in after["triggers"]) else 5
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
