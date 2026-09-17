# -*- coding: utf-8 -*-
"""
Szyfrowanie sekretow lokalnych (Fernet) dla oauth_integrations.

Klucz lezy w apps/desktop/data/secret.key i jest lokalny dla maszyny:
chroni tokeny OAuth zapisane na dysku, nie jest wspoldzielony ani w repo
(.gitignore: **/*secret*). Utrata klucza = trzeba zalogowac sie ponownie,
nie ma z tego utraty danych produktowych.

Kontrakt (uzywany przez oauth_integrations.py):
  is_available() -> bool     czy da sie szyfrowac (biblioteka + klucz)
  encrypt_str(s) -> str      pusty string gdy sie nie uda
  decrypt_str(e) -> str      pusty string gdy sie nie uda

Zadna z tych funkcji nie rzuca wyjatkiem: brak crypto ma dawac status
"needs_config" w UI, a nie 500 z mostka.
"""
from __future__ import annotations

import os
from pathlib import Path

try:
    from cryptography.fernet import Fernet, InvalidToken
except Exception:  # brak biblioteki w tym runtime
    Fernet = None  # type: ignore[assignment]
    InvalidToken = Exception  # type: ignore[misc,assignment]

DESKTOP_DIR = Path(__file__).resolve().parent
KEY_PATH = Path(os.environ.get("DAM_SECRET_KEY_FILE") or (DESKTOP_DIR / "data" / "secret.key"))

_CACHED: "Fernet | None" = None
_TRIED = False


def _load_or_create_key() -> bytes | None:
    """Wczytaj klucz, a gdy go nie ma - utworz raz i zapisz."""
    if Fernet is None:
        return None
    try:
        if KEY_PATH.exists():
            raw = KEY_PATH.read_bytes().strip()
            if raw:
                return raw
        KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
        key = Fernet.generate_key()
        # zapis atomowy, zeby przerwany start nie zostawil pustego klucza
        tmp = KEY_PATH.with_suffix(KEY_PATH.suffix + ".tmp")
        tmp.write_bytes(key)
        os.replace(tmp, KEY_PATH)
        try:
            os.chmod(KEY_PATH, 0o600)
        except OSError:
            pass  # Windows ACL i tak rzadzi sie inaczej
        return key
    except Exception:
        return None


def _box() -> "Fernet | None":
    global _CACHED, _TRIED
    if _CACHED is not None:
        return _CACHED
    if _TRIED:
        return None
    _TRIED = True
    key = _load_or_create_key()
    if not key or Fernet is None:
        return None
    try:
        _CACHED = Fernet(key)
    except Exception:
        _CACHED = None
    return _CACHED


def is_available() -> bool:
    """True gdy tokeny da sie zapisac zaszyfrowane."""
    return _box() is not None


def encrypt_str(value: str) -> str:
    if not value:
        return ""
    box = _box()
    if box is None:
        return ""
    try:
        return box.encrypt(str(value).encode("utf-8")).decode("ascii")
    except Exception:
        return ""


def decrypt_str(value: str) -> str:
    if not value:
        return ""
    box = _box()
    if box is None:
        return ""
    try:
        return box.decrypt(str(value).encode("ascii")).decode("utf-8")
    except (InvalidToken, Exception):
        # zly klucz albo uszkodzony wpis: traktujemy jak brak tokenu
        return ""
