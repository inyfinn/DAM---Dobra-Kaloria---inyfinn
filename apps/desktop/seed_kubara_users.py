"""
Seed kont Kubara (ADR-007 / ADR-009).

Haslo: TYLKO z env DAM_SEED_PASSWORD (min. 8 znakow).
Bez DAM_SEED_PASSWORD skrypt odmawia - zakaz domyslnego "test" na produkcji.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

DESKTOP = Path(__file__).resolve().parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

from auth_store import (  # noqa: E402
    _connect,
    _utc,
    _use_pg,
    init_db,
    register_user,
    set_user_password,
)

USERS = [
    ("agata.karon@kubara.pl", "Agata Karon", "user"),
    ("andzelika.borowicz@kubara.pl", "Andzelika Borowicz", "user"),
    ("anna.polanska@kubara.pl", "Anna Polanska", "user"),
    ("beata.scibik@kubara.pl", "Beata Scibik", "user"),
    ("dagmara.bartnik@kubara.pl", "Dagmara Bartnik", "user"),
    ("ewa.prazmowska@kubara.pl", "Ewa Prazmowska", "user"),
    ("justyna.zroslak@kubara.pl", "Justyna Zroslak", "user"),
    ("karolina.kubara@kubara.pl", "Karolina Kubara", "power_user"),
    ("krzysztof.wieczorek@kubara.pl", "Krzysztof Wieczorek", "admin"),
    ("maciej.labus@kubara.pl", "Maciej Labus", "user"),
    ("magazyn.detal@kubara.pl", "Magazyn Detal", "user"),
    ("malgorzata.oleksiak@kubara.pl", "Malgorzata Oleksiak", "user"),
    ("marek.milek@kubara.pl", "Marek Milek", "user"),
    ("marek.paluszewski@kubara.pl", "Marek Paluszewski", "user"),
    ("marta.zasepa@kubara.pl", "Marta Zasepa", "user"),
    ("ryszard.domagala@kubara.pl", "Ryszard Domagala", "user"),
    ("sylwia.zarychta@kubara.pl", "Sylwia Zarychta", "user"),
    ("szymon.ryngwelski@kubara.pl", "Szymon Ryngwelski", "user"),
]

MIN_PASSWORD_LEN = 8


def _upsert_role_name(email: str, name: str, role: str) -> None:
    """Aktualizuj name/role po seedzie (haslo osobno)."""
    email_n = email.strip().lower()
    now = _utc()
    conn = _connect()
    try:
        if _use_pg():
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE users
                SET name = %s, role = %s, updated_at = %s
                WHERE LOWER(email) = LOWER(%s)
                """,
                (name, role, now, email_n),
            )
            conn.commit()
        else:
            conn.execute(
                """
                UPDATE users
                SET name = ?, role = ?, updated_at = ?
                WHERE email = ? COLLATE NOCASE
                """,
                (name, role, now, email_n),
            )
            conn.commit()
    finally:
        conn.close()


def main() -> int:
    password = (os.environ.get("DAM_SEED_PASSWORD") or "").strip()
    if len(password) < MIN_PASSWORD_LEN:
        print(
            f"FAIL: ustaw DAM_SEED_PASSWORD (min {MIN_PASSWORD_LEN} znakow). "
            "Przyklad PowerShell:\n"
            "  $env:DAM_SEED_PASSWORD='........'\n"
            "  python apps/desktop/seed_kubara_users.py",
            file=sys.stderr,
        )
        return 2
    if password.lower() in ("test", "password", "12345678", "admin", "dam"):
        print(
            "FAIL: haslo zbyt slabe / zabronione. Uzyj silnego hasla handover.",
            file=sys.stderr,
        )
        return 2

    init_db()
    created = 0
    updated = 0
    for email, name, role in USERS:
        res = set_user_password(email, password)
        if res.get("ok"):
            _upsert_role_name(email, name, role)
            updated += 1
            continue
        if res.get("error") == "user_not_found":
            reg = register_user(email, password, name, role)
            if not reg.get("ok"):
                print(f"FAIL create {email} {reg.get('error')}", file=sys.stderr)
                return 1
            _upsert_role_name(email, name, role)
            created += 1
            continue
        print(f"FAIL {email} {res.get('error')}", file=sys.stderr)
        return 1

    print(f"OK created={created} updated={updated} (haslo nie wypisane)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
