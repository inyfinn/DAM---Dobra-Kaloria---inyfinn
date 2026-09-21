# -*- coding: utf-8 -*-
"""
Konfiguracja Postgres bez jawnego hasla w instalatorze i na dysku.

Problem (audyt 2026-09-17): build wklejal data/pg-config.json z haslem do
DAM-Setup.exe. Kazdy, kto pobral instalator, mial haslo do bazy na Synology.

Teraz:
  * Instalator wozi TYLKO data/pg-config.sealed.json - szyfrogram Fernet, klucz
    z scrypt(kod aktywacyjny). Kod administrator przekazuje uzytkownikowi poza
    aplikacja (rozmowa, SMS). Sam instalator jest bezuzyteczny dla obcego.
  * Po aktywacji konfiguracja lezy w data/pg-config.dpapi zaszyfrowana Windows
    DPAPI (konto Windows tego uzytkownika). Inny uzytkownik tego PC, kopia dysku
    ani backup folderu nie odczytaja hasla.
  * Jawny data/pg-config.json zostaje wylacznie w drzewie deweloperskim (repo
    z .git, gitignored) jako zrodlo dla builda. W instalacji jest migrowany do
    DPAPI i kasowany.

Zadna funkcja nie rzuca wyjatkiem na zewnatrz.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import sys
import threading
import time
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
DATA_DIR = DESKTOP_DIR / "data"
SEALED_PATH = DATA_DIR / "pg-config.sealed.json"
DPAPI_PATH = DATA_DIR / "pg-config.dpapi"
_ENTROPY = b"DAM-pg-config-v1"

SCRYPT_N = 2**15
SCRYPT_R = 8
SCRYPT_P = 1
MIN_CODE_LEN = 16

_ATTEMPT_LOCK = threading.Lock()
_ATTEMPTS: list[float] = []
MAX_ATTEMPTS_PER_WINDOW = 5
ATTEMPT_WINDOW_S = 60.0


def normalize_code(code: str) -> str:
    """Kod dyktuje sie przez telefon: spacje, myslniki i wielkosc liter nie maja znaczenia."""
    return "".join(ch for ch in str(code or "").upper() if ch.isalnum())


def generate_code() -> str:
    """25 znakow base32 (~125 bitow) w grupach po 5: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # bez 0/O/1/I
    raw = "".join(secrets.choice(alphabet) for _ in range(25))
    return "-".join(raw[i : i + 5] for i in range(0, 25, 5))


def _derive_key(code: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    raw = hashlib.scrypt(
        normalize_code(code).encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=32, maxmem=128 * 1024 * 1024
    )
    return base64.urlsafe_b64encode(raw)


def seal(config: dict[str, Any], code: str) -> dict[str, Any]:
    from cryptography.fernet import Fernet

    if len(normalize_code(code)) < MIN_CODE_LEN:
        raise ValueError(f"kod aktywacyjny za krotki (min {MIN_CODE_LEN} znakow alfanumerycznych)")
    salt = secrets.token_bytes(16)
    key = _derive_key(code, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
    token = Fernet(key).encrypt(json.dumps(config, ensure_ascii=False).encode("utf-8"))
    return {
        "v": 1,
        "kdf": "scrypt",
        "n": SCRYPT_N,
        "r": SCRYPT_R,
        "p": SCRYPT_P,
        "salt": base64.b64encode(salt).decode("ascii"),
        "token": token.decode("ascii"),
    }


def unseal(sealed: dict[str, Any], code: str) -> dict[str, Any] | None:
    try:
        from cryptography.fernet import Fernet

        if int(sealed.get("v") or 0) != 1 or sealed.get("kdf") != "scrypt":
            return None
        n, r, p = int(sealed["n"]), int(sealed["r"]), int(sealed["p"])
        # Plik pochodzi z instalatora: nie pozwol mu zamowic gigabajtow pamieci.
        if not (2**14 <= n <= 2**17 and r == 8 and 1 <= p <= 2):
            return None
        salt = base64.b64decode(str(sealed["salt"]), validate=True)
        key = _derive_key(code, salt, n, r, p)
        raw = Fernet(key).decrypt(str(sealed["token"]).encode("ascii"))
        cfg = json.loads(raw.decode("utf-8"))
        return cfg if isinstance(cfg, dict) else None
    except Exception:
        return None


# --- Windows DPAPI (CurrentUser) -------------------------------------------------


def _dpapi(data: bytes, *, protect: bool) -> bytes | None:
    if sys.platform != "win32":
        return None
    try:
        import ctypes
        from ctypes import wintypes

        class Blob(ctypes.Structure):
            _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

        def blob(raw: bytes) -> Blob:
            buf = ctypes.create_string_buffer(raw, len(raw))
            return Blob(len(raw), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))

        crypt32 = ctypes.windll.crypt32
        kernel32 = ctypes.windll.kernel32
        src, ent, out = blob(data), blob(_ENTROPY), Blob()
        flags = 0x1  # CRYPTPROTECT_UI_FORBIDDEN
        fn = crypt32.CryptProtectData if protect else crypt32.CryptUnprotectData
        if protect:
            ok = fn(ctypes.byref(src), None, ctypes.byref(ent), None, None, flags, ctypes.byref(out))
        else:
            ok = fn(ctypes.byref(src), None, ctypes.byref(ent), None, None, flags, ctypes.byref(out))
        if not ok:
            return None
        try:
            return ctypes.string_at(out.pbData, out.cbData)
        finally:
            kernel32.LocalFree(out.pbData)
    except Exception:
        return None


def dpapi_available() -> bool:
    probe = _dpapi(b"dam", protect=True)
    return bool(probe) and _dpapi(probe, protect=False) == b"dam"


def store_protected(config: dict[str, Any], path: Path | None = None) -> bool:
    """Zapis konfiguracji pod DPAPI. False = nie zapisano (wolajacy NIE kasuje zrodla)."""
    dest = path or DPAPI_PATH
    try:
        raw = json.dumps(config, ensure_ascii=False).encode("utf-8")
        blob = _dpapi(raw, protect=True)
        if not blob or _dpapi(blob, protect=False) != raw:
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + f".{os.getpid()}.tmp")
        tmp.write_bytes(blob)
        os.replace(tmp, dest)
        return True
    except Exception:
        return False


def load_protected(path: Path | None = None) -> dict[str, Any] | None:
    src = path or DPAPI_PATH
    try:
        if not src.is_file():
            return None
        raw = _dpapi(src.read_bytes(), protect=False)
        if not raw:
            return None
        cfg = json.loads(raw.decode("utf-8"))
        return cfg if isinstance(cfg, dict) else None
    except Exception:
        return None


def sealed_present() -> bool:
    try:
        return SEALED_PATH.is_file() and SEALED_PATH.stat().st_size > 0
    except OSError:
        return False


def _throttled() -> bool:
    now = time.time()
    with _ATTEMPT_LOCK:
        _ATTEMPTS[:] = [t for t in _ATTEMPTS if now - t < ATTEMPT_WINDOW_S]
        if len(_ATTEMPTS) >= MAX_ATTEMPTS_PER_WINDOW:
            return True
        _ATTEMPTS.append(now)
        return False


def activate(code: str) -> dict[str, Any]:
    """Kod aktywacyjny -> konfiguracja pod DPAPI. Bez sieci, bez logowania."""
    if _throttled():
        return {"ok": False, "error": "too_many_attempts", "hint": "Odczekaj minutę i spróbuj ponownie."}
    if len(normalize_code(code)) < MIN_CODE_LEN:
        return {"ok": False, "error": "code_invalid", "hint": "Kod aktywacyjny jest niepoprawny."}
    try:
        sealed = json.loads(SEALED_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"ok": False, "error": "sealed_missing", "hint": "Brak pliku konfiguracji w instalacji."}
    # unseal() lyka kazdy wyjatek, wiec brak biblioteki wygladalby jak zly kod.
    # 20.09.2026: Smart App Control zablokowal cryptography/_rust.pyd i uzytkownik
    # dostawal "Kod aktywacyjny jest niepoprawny" przy poprawnym kodzie.
    try:
        from cryptography.fernet import Fernet  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "error": "crypto_unavailable",
            "hint": "Windows zablokował bibliotekę szyfrującą (Smart App Control). "
                    "Kod jest poprawny - odblokuj plik w Zabezpieczeniach Windows.",
            "detail": str(exc)[:200],
        }
    cfg = unseal(sealed if isinstance(sealed, dict) else {}, code)
    if not cfg or not cfg.get("password"):
        return {"ok": False, "error": "code_invalid", "hint": "Kod aktywacyjny jest niepoprawny."}
    if not store_protected(cfg):
        return {"ok": False, "error": "dpapi_failed", "hint": "Nie udało się zapisać konfiguracji (DPAPI)."}
    return {"ok": True}
