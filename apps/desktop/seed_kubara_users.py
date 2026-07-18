"""
Seed kont Kubara w SQLite repo (ADR-007): apps/desktop/data/dam-local.sqlite.
Haslo wspolne: test. Bez wysylki maili.
"""
from __future__ import annotations

import sys
from pathlib import Path

DESKTOP = Path(__file__).resolve().parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

from auth_store import _connect, _hash_password, _utc, init_db  # noqa: E402

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

PASSWORD = "test"


def main() -> int:
    init_db()
    ph = _hash_password(PASSWORD)
    now = _utc()
    created = 0
    updated = 0
    with _connect() as conn:
        for email, name, role in USERS:
            email_n = email.strip().lower()
            row = conn.execute(
                "SELECT id FROM users WHERE email = ? COLLATE NOCASE", (email_n,)
            ).fetchone()
            if row:
                conn.execute(
                    """
                    UPDATE users
                    SET name = ?, role = ?, password_hash = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (name, role, ph, now, row["id"]),
                )
                updated += 1
            else:
                conn.execute(
                    """
                    INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'local', ?, ?)
                    """,
                    (email_n, name, role, ph, now, now),
                )
                created += 1
        conn.commit()
        total = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    print(f"OK created={created} updated={updated} total_users={total} password=test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
