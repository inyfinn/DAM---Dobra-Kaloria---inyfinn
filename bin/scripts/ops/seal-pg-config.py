# -*- coding: utf-8 -*-
"""
Zapieczetuj pg-config.json do instalatora (para do apps/desktop/pg_seal.py).

  python seal-pg-config.py --in <pg-config.json> --out <pg-config.sealed.json>

Kod aktywacyjny: zmienna DAM_ACTIVATION_CODE albo plik
%USERPROFILE%/.dam/activation-code.txt (tworzony przy pierwszym uzyciu).
Kod przekazujesz uzytkownikom POZA aplikacja. Nie trafia do repo ani do instalatora.
Zmiana kodu = nowy build; juz aktywowane komputery dzialaja dalej (maja DPAPI).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "apps" / "desktop"))

import pg_seal  # noqa: E402


def code_file() -> Path:
    return Path(os.environ.get("USERPROFILE") or Path.home()) / ".dam" / "activation-code.txt"


def resolve_code() -> tuple[str, str]:
    env = (os.environ.get("DAM_ACTIVATION_CODE") or "").strip()
    if env:
        return env, "DAM_ACTIVATION_CODE"
    path = code_file()
    if path.is_file():
        code = path.read_text(encoding="utf-8").strip()
        if code:
            return code, str(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    code = pg_seal.generate_code()
    path.write_text(code + "\n", encoding="utf-8")
    return code, f"{path} (NOWY)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", dest="dst", required=True)
    args = ap.parse_args()
    cfg = json.loads(Path(args.src).read_text(encoding="utf-8-sig"))
    if not isinstance(cfg, dict) or not cfg.get("password"):
        print("FAIL: zrodlowy pg-config nie ma hasla", file=sys.stderr)
        return 2
    code, origin = resolve_code()
    sealed = pg_seal.seal(cfg, code)
    if pg_seal.unseal(sealed, code) != cfg:
        print("FAIL: kontrola odszyfrowania nie przeszla", file=sys.stderr)
        return 3
    out = Path(args.dst)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(sealed, indent=2) + "\n", encoding="utf-8")
    if str(cfg["password"]) in out.read_text(encoding="utf-8"):
        out.unlink()
        print("FAIL: haslo widoczne w pliku wynikowym", file=sys.stderr)
        return 4
    # Kodu nie wypisujemy (logi builda bywaja w chmurze) - tylko skad pochodzi.
    print(f"OK sealed -> {out}  (kod aktywacyjny: {origin})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
