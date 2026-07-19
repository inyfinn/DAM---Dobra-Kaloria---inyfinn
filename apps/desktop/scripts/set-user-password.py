"""Ustaw haslo jednego uzytkownika (produkcja / handover)."""
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

from auth_store import set_user_password  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description="Ustaw haslo konta DAM")
    p.add_argument("--email", required=True)
    p.add_argument("--password", default="")
    args = p.parse_args()
    password = args.password or getpass.getpass("Nowe haslo: ")
    res = set_user_password(args.email, password)
    if not res.get("ok"):
        print(f"FAIL {res.get('error')}", file=sys.stderr)
        return 1
    print(f"OK password updated for {res.get('email')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
