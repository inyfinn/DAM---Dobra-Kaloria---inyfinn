# -*- coding: utf-8 -*-
"""
Weryfikacja podpisu wydania DAM (Ed25519) przed uruchomieniem instalatora.

Dlaczego nie samo SHA-256 z GitHuba: kto podmieni DAM-Setup.exe w wydaniu,
podmieni tez plik z suma. Podpis robi sie kluczem prywatnym, ktory lezy TYLKO
na maszynie budujacej (poza repo). Aplikacja zna wylacznie klucze publiczne
z release-pubkey.json, wiec przejecie konta GitHub nie wystarcza do wgrania
kodu na komputery uzytkownikow.

Format DAM-Setup.exe.sig (JSON):
  {"v": 1, "version": "2.0.8", "sha256": "<hex>", "sig": "<base64>"}
Podpisywana wiadomosc: b"DAM-RELEASE-V1\n<version>\n<sha256 hex lower>\n"

Zadna funkcja nie rzuca: wynik to (ok, reason).
"""
from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
PUBKEY_PATH = DESKTOP_DIR / "release-pubkey.json"
SIG_SUFFIX = ".sig"
MAX_SIG_BYTES = 8192


def signed_message(version: str, sha256_hex: str) -> bytes:
    return f"DAM-RELEASE-V1\n{version.strip()}\n{sha256_hex.strip().lower()}\n".encode("utf-8")


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def load_public_keys(path: Path | None = None) -> list[bytes]:
    try:
        raw = json.loads((path or PUBKEY_PATH).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    keys = raw.get("keys") if isinstance(raw, dict) else None
    out: list[bytes] = []
    for item in keys if isinstance(keys, list) else []:
        val = item.get("ed25519") if isinstance(item, dict) else item
        try:
            key = base64.b64decode(str(val or ""), validate=True)
        except (ValueError, TypeError):
            continue
        if len(key) == 32:
            out.append(key)
    return out


def parse_sig(data: bytes) -> dict[str, Any] | None:
    if not data or len(data) > MAX_SIG_BYTES:
        return None
    try:
        obj = json.loads(data.decode("utf-8-sig"))
    except (ValueError, UnicodeDecodeError):
        return None
    if not isinstance(obj, dict) or int(obj.get("v") or 0) != 1:
        return None
    if not all(isinstance(obj.get(k), str) and obj.get(k) for k in ("version", "sha256", "sig")):
        return None
    return obj


def verify_installer(
    installer: Path,
    sig_data: bytes,
    *,
    min_version_exclusive: tuple[int, ...] | None = None,
    parse_version=None,
    public_keys: list[bytes] | None = None,
) -> tuple[bool, str]:
    """True tylko gdy plik ma sume z podpisu, a podpis zgadza sie z przypietym kluczem.

    min_version_exclusive: gdy podane, wersja z podpisu musi byc nowsza (anty-downgrade:
    stary, prawdziwie podpisany instalator z luka nie przejdzie jako "aktualizacja").
    """
    try:
        from cryptography.exceptions import InvalidSignature
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    except Exception:
        return False, "crypto_missing"
    keys = public_keys if public_keys is not None else load_public_keys()
    if not keys:
        return False, "no_pinned_key"
    sig = parse_sig(sig_data)
    if sig is None:
        return False, "sig_malformed"
    try:
        raw_sig = base64.b64decode(sig["sig"], validate=True)
    except (ValueError, TypeError):
        return False, "sig_malformed"
    try:
        if not installer.is_file():
            return False, "installer_missing"
        actual = file_sha256(installer)
    except OSError:
        return False, "installer_unreadable"
    if actual.lower() != sig["sha256"].strip().lower():
        return False, "sha256_mismatch"
    if min_version_exclusive is not None and parse_version is not None:
        try:
            if tuple(parse_version(sig["version"])) <= tuple(min_version_exclusive):
                return False, "version_not_newer"
        except Exception:
            return False, "version_malformed"
    msg = signed_message(sig["version"], actual)
    for key in keys:
        try:
            Ed25519PublicKey.from_public_bytes(key).verify(raw_sig, msg)
            return True, "ok"
        except InvalidSignature:
            continue
        except Exception:
            continue
    return False, "signature_invalid"
