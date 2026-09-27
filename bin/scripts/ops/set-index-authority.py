# -*- coding: utf-8 -*-
"""Ustaw dam_meta['index_authority'] - lista komputerow, ktore smia publikowac
migawki indeksu i kasowac materialy we wspolnej bazie (patrz
bin/apps/desktop/index_authority.py, PLAN-jedno-zrodlo-prawdy.md Faza 3).

BEZ --apply NIC NIE ZAPISUJE. Zawsze najpierw wypisuje biezaca wartosc klucza
(przed ewentualnym --apply), zeby bylo widac, co sie nadpisuje.

Uzycie:
    python set-index-authority.py --machines INYFINN,KRZYSZTOFWI --dry-run
    python set-index-authority.py --machines INYFINN,KRZYSZTOFWI --apply

Ten skrypt jest read+write na dam_meta (jeden wiersz, jeden klucz) - poza tym
NIC innego w bazie nie dotyka. Kierownik uruchamia go recznie po przyjeciu
pracy; agent NIE wywoluje go z --apply.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parents[2] / "apps" / "desktop"
if str(DESKTOP_DIR) not in sys.path:
    sys.path.insert(0, str(DESKTOP_DIR))

MODE_KEY = "index_authority"


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--machines", required=True,
                     help="Lista COMPUTERNAME oddzielona przecinkami, np. INYFINN,KRZYSZTOFWI")
    ap.add_argument("--apply", action="store_true", help="Naprawde zapisz do bazy (domyslnie: nie)")
    ap.add_argument("--dry-run", action="store_true", help="Jawne 'nie zapisuj' (domyslne zachowanie)")
    args = ap.parse_args()

    machines = [m.strip() for m in args.machines.split(",") if m.strip()]
    if not machines:
        print("Blad: --machines puste po rozbiciu po przecinku.")
        return 2

    import pg_db  # noqa: PLC0415 - import po ustawieniu sys.path

    pg = pg_db.connect()
    try:
        cur = pg.cursor()
        cur.execute("SELECT value FROM dam_meta WHERE key = %s", (MODE_KEY,))
        row = cur.fetchone()
        current_raw = (row.get("value") if hasattr(row, "get") else row[0]) if row else None
        print("Biezaca wartosc dam_meta['index_authority']:")
        print(current_raw if current_raw else "(brak klucza)")

        new_value = {
            "machines": machines,
            "updated_at": _utc(),
            "updated_by": "set-index-authority.py",
        }
        print("\nNowa wartosc (do zapisu tylko z --apply):")
        print(json.dumps(new_value, ensure_ascii=False, indent=2))

        if not args.apply:
            print("\n--apply nie podane - NIC nie zostalo zapisane (dry-run).")
            return 0

        cur.execute(
            """
            INSERT INTO dam_meta (key, value) VALUES (%s, %s)
            ON CONFLICT (key) DO UPDATE SET value = excluded.value
            """,
            (MODE_KEY, json.dumps(new_value, ensure_ascii=False)),
        )
        pg.commit()
        print("\nZapisano.")
        return 0
    finally:
        pg.close()


if __name__ == "__main__":
    raise SystemExit(main())
