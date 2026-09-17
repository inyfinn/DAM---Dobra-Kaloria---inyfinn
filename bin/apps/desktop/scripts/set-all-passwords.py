"""Ustaw to samo haslo dla wszystkich kont seed Kubara (przed oddaniem klientowi).

Wymaga zmiennej srodowiskowej DAM_SEED_PASSWORD (min. 8 znakow).
Nie wypisuje hasla na stdout.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

from auth_store import set_user_password  # noqa: E402
from seed_kubara_users import USERS  # noqa: E402

MIN_LEN = 10


def main() -> int:
    password = (os.environ.get("DAM_SEED_PASSWORD") or "").strip()
    if len(password) < MIN_LEN:
        print(
            f"FAIL: ustaw DAM_SEED_PASSWORD (min {MIN_LEN} znakow). "
            "Przyklad: $env:DAM_SEED_PASSWORD='........'; python apps/desktop/scripts/set-all-passwords.py",
            file=sys.stderr,
        )
        return 2
    ok = 0
    fail = 0
    for email, _name, _role in USERS:
        res = set_user_password(email, password)
        if res.get("ok"):
            ok += 1
            print(f"OK {email}")
        else:
            fail += 1
            print(f"FAIL {email} {res.get('error')}", file=sys.stderr)
    print(f"Done ok={ok} fail={fail} (haslo nie jest wypisywane)")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
