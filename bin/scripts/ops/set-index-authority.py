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
    ap.add_argument("--allow-unknown", action="store_true",
                     help="Pozwol zapisac nazwy, ktorych nie ma w dam_assets.updated_by "
                          "ani dam_index_snapshots.built_by (literowka w nazwie komputera "
                          "inaczej cicho zablokowalaby publikacje na zawsze)")
    args = ap.parse_args()

    machines = [m.strip() for m in args.machines.split(",") if m.strip()]
    if not machines:
        print("Blad: --machines puste po rozbiciu po przecinku.")
        return 2

    import pg_db  # noqa: PLC0415 - import po ustawieniu sys.path
    import index_authority  # noqa: PLC0415 - ta sama definicja "znanej maszyny" co status()

    pg = pg_db.connect()
    try:
        cur = pg.cursor()
        cur.execute("SELECT value FROM dam_meta WHERE key = %s", (MODE_KEY,))
        row = cur.fetchone()
        current_raw = (row.get("value") if hasattr(row, "get") else row[0]) if row else None
        print("Biezaca wartosc dam_meta['index_authority']:")
        print(current_raw if current_raw else "(brak klucza)")

        if not args.allow_unknown:
            # Wlasne, OSOBNE polaczenie - _known_machines_and_last_publish zamyka
            # (pg.close()) polaczenie, ktore dostaje; nie wolno mu dac tego samego
            # `pg`, ktorego main() uzywa pozniej do zapisu.
            known, _last_built = index_authority._known_machines_and_last_publish(pg_db.connect)
            if known:  # zapytanie sie udalo - inaczej nie ma jak sprawdzic, nie blokuj na slepo
                unknown = [m for m in machines if m.strip().casefold() not in known]
                if unknown:
                    print(f"\nBlad: nieznane komputery (nie widziane w dam_assets.updated_by "
                          f"ani dam_index_snapshots.built_by): {unknown}")
                    print("Uzyj --allow-unknown, jesli to naprawde nowy komputer.")
                    return 4
            else:
                print("\nUwaga: nie udalo sie sprawdzic znanych maszyn (offline?) - "
                      "kontynuuje bez tej walidacji.")

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
