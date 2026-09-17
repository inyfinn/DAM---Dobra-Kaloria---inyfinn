# -*- coding: utf-8 -*-
"""
Podpis wydania DAM (Ed25519). Para do apps/desktop/release_verify.py.

Klucz prywatny: %USERPROFILE%\\.dam\\release-signing-key.pem (albo DAM_RELEASE_KEY).
NIGDY w repo, NIGDY w folderze synchronizowanym (Synology Drive / Dropbox).
Utrata klucza = trzeba wydac wersje z nowym kluczem publicznym instalowana recznie.

  python sign-release.py init                      # utworz klucz (raz), przypnij publiczny
  python sign-release.py sign <DAM-Setup.exe> --version 2.0.8
  python sign-release.py verify <DAM-Setup.exe>    # sprawdz istniejacy .sig

Wynik `sign`: plik <DAM-Setup.exe>.sig - wgraj go do wydania GitHub RAZEM z instalatorem.
Bez niego aplikacje odrzuca aktualizacje.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DESKTOP_DIR = HERE.parent.parent / "apps" / "desktop"
sys.path.insert(0, str(DESKTOP_DIR))

import release_verify  # noqa: E402

from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402


def key_path() -> Path:
    env = (os.environ.get("DAM_RELEASE_KEY") or "").strip()
    if env:
        return Path(env)
    return Path(os.environ.get("USERPROFILE") or Path.home()) / ".dam" / "release-signing-key.pem"


def load_private() -> Ed25519PrivateKey:
    path = key_path()
    if not path.is_file():
        raise SystemExit(f"FAIL: brak klucza prywatnego: {path}\nUruchom najpierw: sign-release.py init")
    key = serialization.load_pem_private_key(path.read_bytes(), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise SystemExit("FAIL: klucz nie jest Ed25519")
    return key


def public_b64(key: Ed25519PrivateKey) -> str:
    raw = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return base64.b64encode(raw).decode("ascii")


def pin_public(pub: str, note: str) -> bool:
    path = release_verify.PUBKEY_PATH
    data: dict = {"keys": []}
    if path.is_file():
        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict) and isinstance(loaded.get("keys"), list):
                data = loaded
        except ValueError:
            pass
    for item in data["keys"]:
        if isinstance(item, dict) and item.get("ed25519") == pub:
            return False
    data["keys"].append({"ed25519": pub, "note": note})
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return True


def cmd_init(_args: argparse.Namespace) -> int:
    path = key_path()
    if path.is_file():
        key = load_private()
        print(f"Klucz juz istnieje: {path}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        key = Ed25519PrivateKey.generate()
        pem = key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        path.write_bytes(pem)
        print(f"Utworzono klucz prywatny: {path}")
        print("Zrob kopie na nosniku offline. Nie wrzucaj do repo ani do chmury.")
    pub = public_b64(key)
    added = pin_public(pub, note=f"build {os.environ.get('COMPUTERNAME', '')}".strip())
    print(f"Klucz publiczny: {pub}")
    print(("Przypieto w " if added else "Byl juz przypiety w ") + str(release_verify.PUBKEY_PATH))
    return 0


def cmd_sign(args: argparse.Namespace) -> int:
    installer = Path(args.installer)
    if not installer.is_file():
        raise SystemExit(f"FAIL: brak pliku {installer}")
    version = str(args.version or "").strip().lstrip("vV")
    if not version:
        raise SystemExit("FAIL: podaj --version")
    key = load_private()
    digest = release_verify.file_sha256(installer)
    sig = key.sign(release_verify.signed_message(version, digest))
    body = {"v": 1, "version": version, "sha256": digest, "sig": base64.b64encode(sig).decode("ascii")}
    out = installer.with_name(installer.name + release_verify.SIG_SUFFIX)
    out.write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    ok, reason = release_verify.verify_installer(installer, out.read_bytes())
    if not ok:
        raise SystemExit(
            f"FAIL: podpis nie przechodzi weryfikacji ({reason}). "
            "Klucz publiczny z tej maszyny nie jest przypiety w release-pubkey.json?"
        )
    print(f"OK {out}  (wersja {version}, sha256 {digest})")
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    installer = Path(args.installer)
    sig = installer.with_name(installer.name + release_verify.SIG_SUFFIX)
    if not sig.is_file():
        raise SystemExit(f"FAIL: brak {sig}")
    ok, reason = release_verify.verify_installer(installer, sig.read_bytes())
    print(("OK " if ok else "FAIL ") + reason)
    return 0 if ok else 1


def main() -> int:
    p = argparse.ArgumentParser(description="Podpis wydania DAM (Ed25519)")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init").set_defaults(fn=cmd_init)
    s = sub.add_parser("sign")
    s.add_argument("installer")
    s.add_argument("--version", required=True)
    s.set_defaults(fn=cmd_sign)
    v = sub.add_parser("verify")
    v.add_argument("installer")
    v.set_defaults(fn=cmd_verify)
    args = p.parse_args()
    return int(args.fn(args))


if __name__ == "__main__":
    raise SystemExit(main())
