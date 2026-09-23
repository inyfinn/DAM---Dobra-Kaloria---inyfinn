# -*- coding: utf-8 -*-
"""
Lokalny test kroku podpisu z workflowu sign-release.yml, BEZ dotykania
prawdziwego klucza (bin/secrets/release-signing-key.pem, ~/.dam) ani
prawdziwego bin/apps/desktop/release-pubkey.json.

Co robi:
1. Generuje TYMCZASOWA pare kluczy Ed25519 (cryptography) w katalogu tymczasowym.
2. Podmienia w pamieci (monkeypatch) release_verify.PUBKEY_PATH na tymczasowy
   plik z przypietym kluczem publicznym z tej pary - sign-release.py i tak
   czyta ta sciezke dynamicznie przy kazdym wywolaniu, wiec to bezpiecznie
   izoluje test od prawdziwego repo.
3. Tworzy falszywy "instalator" = 1 MB losowych bajtow w katalogu tymczasowym.
4. Ustawia DAM_RELEASE_KEY na sciezke do tymczasowego klucza prywatnego
   (dokladnie tak, jak bedzie to robil sign-release.yml: sekret zapisany do
   pliku, sciezka podana w zmiennej srodowiskowej - bo key_path() w
   sign-release.py oczekuje SCIEZKI, nie tresci PEM).
5. Woła cmd_sign(...) i cmd_verify(...) z prawdziwego sign-release.py.
6. Sprawdza reczne: sha256 w .sig zgadza sie z plikiem, wersja sie zgadza,
   podpis weryfikuje sie kluczem publicznym z tymczasowej pary (przez
   release_verify.verify_installer z jawnym public_keys=[...] - bez
   dotykania prawdziwego pliku).
7. Test negatywny: zmodyfikowany plik instalatora NIE przechodzi weryfikacji.

Uruchomienie:
  python bin/scripts/ops/test_sign_release_ci.py
"""
from __future__ import annotations

import base64
import importlib.util
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
OPS_DIR = REPO_ROOT / "bin" / "scripts" / "ops"
DESKTOP_DIR = REPO_ROOT / "bin" / "apps" / "desktop"

sys.path.insert(0, str(DESKTOP_DIR))
import release_verify  # noqa: E402

from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402


def _load_sign_release_module():
    """sign-release.py ma minus w nazwie - trzeba zaladowac przez importlib."""
    spec = importlib.util.spec_from_file_location("sign_release_under_test", OPS_DIR / "sign-release.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class Args:
    def __init__(self, **kw):
        self.__dict__.update(kw)


def main() -> int:
    failures: list[str] = []

    tmp = Path(tempfile.mkdtemp(prefix="dam-sign-release-test-"))
    try:
        # 1. tymczasowa para kluczy Ed25519 (NIE prawdziwy klucz repo)
        priv = Ed25519PrivateKey.generate()
        priv_pem = priv.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        keyfile = tmp / "test-release-signing-key.pem"
        keyfile.write_bytes(priv_pem)

        pub_raw = priv.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
        pub_b64 = base64.b64encode(pub_raw).decode("ascii")

        # 2. tymczasowy plik pubkey (podmieniamy release_verify.PUBKEY_PATH w pamieci)
        fake_pubkey_path = tmp / "test-release-pubkey.json"
        fake_pubkey_path.write_text(
            json.dumps({"keys": [{"ed25519": pub_b64, "note": "TEST-ONLY, nie uzywac"}]}, indent=2),
            encoding="utf-8",
        )
        original_pubkey_path = release_verify.PUBKEY_PATH
        release_verify.PUBKEY_PATH = fake_pubkey_path  # monkeypatch - w pamieci, zaden plik repo nie zmieniony

        # 3. falszywy instalator = 1 MB losowych bajtow
        installer = tmp / "DAM-Setup.exe"
        installer.write_bytes(os.urandom(1024 * 1024))

        # 4. DAM_RELEASE_KEY = sciezka do tymczasowego pliku (jak w workflow)
        os.environ["DAM_RELEASE_KEY"] = str(keyfile)

        sign_release = _load_sign_release_module()

        try:
            # 5. sign + verify przez prawdziwe funkcje sign-release.py
            rc_sign = sign_release.cmd_sign(Args(installer=str(installer), version="v9.9.9"))
            if rc_sign != 0:
                failures.append(f"cmd_sign zwrocil {rc_sign} (oczekiwano 0)")

            sig_path = installer.with_name(installer.name + release_verify.SIG_SUFFIX)
            if not sig_path.is_file():
                failures.append(f"brak pliku .sig: {sig_path}")
            else:
                sig_obj = json.loads(sig_path.read_text(encoding="utf-8"))
                expected_sha = release_verify.file_sha256(installer)
                if sig_obj.get("sha256", "").lower() != expected_sha.lower():
                    failures.append("sha256 w .sig nie zgadza sie z plikiem instalatora")
                if sig_obj.get("version") != "9.9.9":
                    failures.append(f"wersja w .sig = {sig_obj.get('version')!r}, oczekiwano '9.9.9' (bez 'v')")

                rc_verify = sign_release.cmd_verify(Args(installer=str(installer)))
                if rc_verify != 0:
                    failures.append(f"cmd_verify (sign-release.py) zwrocil {rc_verify} (oczekiwano 0)")

                # 6. reczna weryfikacja przez release_verify z jawnym public_keys=[...]
                ok, reason = release_verify.verify_installer(
                    installer, sig_path.read_bytes(), public_keys=[pub_raw]
                )
                if not ok:
                    failures.append(f"reczna weryfikacja (public_keys jawnie) nie przeszla: {reason}")

                # 7. test negatywny: zmieniony plik instalatora -> weryfikacja MUSI odrzucic
                tampered = tmp / "DAM-Setup-tampered.exe"
                data = bytearray(installer.read_bytes())
                data[0] ^= 0xFF
                tampered.write_bytes(bytes(data))
                ok2, reason2 = release_verify.verify_installer(
                    tampered, sig_path.read_bytes(), public_keys=[pub_raw]
                )
                if ok2:
                    failures.append("BLAD KRYTYCZNY: zmodyfikowany plik przeszedl weryfikacje podpisu")
                elif reason2 != "sha256_mismatch":
                    failures.append(f"oczekiwano reason='sha256_mismatch' dla zmienionego pliku, jest '{reason2}'")

                # 8. test negatywny: obcy klucz publiczny -> weryfikacja MUSI odrzucic
                other_priv = Ed25519PrivateKey.generate()
                other_pub_raw = other_priv.public_key().public_bytes(
                    serialization.Encoding.Raw, serialization.PublicFormat.Raw
                )
                ok3, reason3 = release_verify.verify_installer(
                    installer, sig_path.read_bytes(), public_keys=[other_pub_raw]
                )
                if ok3:
                    failures.append("BLAD KRYTYCZNY: podpis przeszedl weryfikacje obcym kluczem publicznym")
        finally:
            release_verify.PUBKEY_PATH = original_pubkey_path
            os.environ.pop("DAM_RELEASE_KEY", None)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if failures:
        print("FAIL:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("OK: sign-release.py sign/verify dziala poprawnie na tymczasowym kluczu testowym")
    print("OK: zmodyfikowany plik i obcy klucz publiczny sa poprawnie odrzucane")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
