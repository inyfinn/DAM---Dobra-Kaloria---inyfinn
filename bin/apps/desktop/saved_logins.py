# -*- coding: utf-8 -*-
"""
Zapisane logowania (jak w przegladarce) - lista kont zapisanych NA TYM
komputerze, logowanie jednym kliknieciem, opcjonalne autologowanie.

Magazyn: platform_compat.user_state_dir()/saved-logins.json - CELOWO poza
repo i poza folderem synchronizowanym (D:\\...\\99 - WYMIANA jest zywo
synchronizowany przez Synology Drive na "administratorkubara"; plik z
sekretami logowania nie moze tam lezec - por. bound-session.json, ktore
tam lezy i to jest bledem, patrz raport w tym samym zadaniu).

Haslo NIGDY jawnym tekstem na dysku:
  - Windows: DPAPI (CurrentUser), przez pg_seal._dpapi - ta sama funkcja,
    ktora juz chroni haslo Postgresa.
  - macOS / brak DPAPI: Fernet z secret_box.py (klucz lokalny na maszynie).
  Sekret zapisany jako:
    - czysty base64 (DPAPI)               -> {"secret": "<b64>"}
    - "fernet:<token>" (fallback Fernet)   -> {"secret": "fernet:<token>"}

Zadna funkcja w tym module nie rzuca wyjatkiem na zewnatrz - blad
odczytu/zapisu/deszyfrowania konczy sie bezpieczna wartoscia domyslna
(False / None / pusta lista), nigdy traceback do wolajacego (most HTTP).
"""
from __future__ import annotations

import base64
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STORE_FILENAME = "saved-logins.json"
STORE_VERSION = 1

_LOCK = threading.Lock()


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _store_path() -> Path:
    import platform_compat

    return platform_compat.user_state_dir() / STORE_FILENAME


def _empty_store() -> dict[str, Any]:
    return {"version": STORE_VERSION, "accounts": []}


def _load_store() -> dict[str, Any]:
    path = _store_path()
    try:
        if not path.is_file():
            return _empty_store()
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return _empty_store()
    if not isinstance(raw, dict):
        return _empty_store()
    accounts = raw.get("accounts")
    if not isinstance(accounts, list):
        accounts = []
    out_accounts = []
    for acc in accounts:
        if isinstance(acc, dict) and acc.get("email"):
            out_accounts.append(acc)
    return {"version": STORE_VERSION, "accounts": out_accounts}


def _save_store(store: dict[str, Any]) -> bool:
    """Zapis atomowy tmp+os.replace. False = nie zapisano (wolajacy nic nie zaklada)."""
    path = _store_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        body = json.dumps(store, ensure_ascii=False, indent=2) + "\n"
        tmp = path.with_name(path.name + f".{os.getpid()}.tmp")
        tmp.write_text(body, encoding="utf-8")
        os.replace(tmp, path)
        return True
    except OSError:
        return False


# --- szyfrowanie hasla -------------------------------------------------------


def _dpapi_encrypt(password: str) -> str:
    """'' = DPAPI niedostepne albo blad (wolajacy probuje fallback)."""
    try:
        import pg_seal

        raw = password.encode("utf-8")
        blob = pg_seal._dpapi(raw, protect=True)  # noqa: SLF001 - swiadomy reuse wzorca
        if not blob:
            return ""
        # roundtrip-check jak w pg_seal.store_protected - nie ufaj samemu "ok"
        if pg_seal._dpapi(blob, protect=False) != raw:  # noqa: SLF001
            return ""
        return base64.b64encode(blob).decode("ascii")
    except Exception:
        return ""


def _dpapi_decrypt(secret_b64: str) -> str:
    """'' = nie udalo sie odszyfrowac."""
    try:
        import pg_seal

        blob = base64.b64decode(secret_b64.encode("ascii"), validate=True)
        raw = pg_seal._dpapi(blob, protect=False)  # noqa: SLF001
        if not raw:
            return ""
        return raw.decode("utf-8")
    except Exception:
        return ""


def _fernet_encrypt(password: str) -> str:
    """'' = fallback tez niedostepny."""
    try:
        import secret_box

        token = secret_box.encrypt_str(password)
        return ("fernet:" + token) if token else ""
    except Exception:
        return ""


def _fernet_decrypt(secret: str) -> str:
    try:
        import secret_box

        return secret_box.decrypt_str(secret[len("fernet:"):])
    except Exception:
        return ""


def _encrypt_password(password: str) -> str:
    """Preferuj DPAPI (Windows); fallback Fernet (macOS / brak DPAPI). '' = zaden sposob nie zadzialal."""
    sec = _dpapi_encrypt(password)
    if sec:
        return sec
    return _fernet_encrypt(password)


def _decrypt_password(secret: str) -> str:
    if not secret:
        return ""
    if secret.startswith("fernet:"):
        return _fernet_decrypt(secret)
    return _dpapi_decrypt(secret)


def encryption_available() -> bool:
    """True gdy da sie bezpiecznie zapisac haslo (DPAPI albo Fernet)."""
    try:
        import pg_seal

        if pg_seal.dpapi_available():
            return True
    except Exception:
        pass
    try:
        import secret_box

        return secret_box.is_available()
    except Exception:
        return False


# --- API modulu ---------------------------------------------------------------


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _find(accounts: list[dict], email_n: str) -> dict | None:
    for acc in accounts:
        if _normalize_email(acc.get("email")) == email_n:
            return acc
    return None


def save(email: str, name: str, password: str, autologin: bool = False) -> bool:
    """Zapisz/zaktualizuj konto. False = zapis sie nie udal (np. brak crypto)."""
    email_n = _normalize_email(email)
    if not email_n:
        return False
    secret = _encrypt_password(password or "")
    if not secret:
        return False
    with _LOCK:
        store = _load_store()
        accounts = store["accounts"]
        now = _utc()
        existing = _find(accounts, email_n)
        if existing is not None:
            existing["email"] = email_n
            existing["name"] = str(name or existing.get("name") or "")
            existing["secret"] = secret
            existing["saved_at"] = existing.get("saved_at") or now
            existing["last_used_at"] = now
            existing["unreadable"] = False
        else:
            accounts.append(
                {
                    "email": email_n,
                    "name": str(name or ""),
                    "secret": secret,
                    "autologin": False,
                    "saved_at": now,
                    "last_used_at": now,
                }
            )
        if autologin:
            for acc in accounts:
                acc["autologin"] = _normalize_email(acc.get("email")) == email_n
        return _save_store(store)


def list_public() -> list[dict]:
    """Lista kont bez sekretow - bezpieczna do zwrocenia w HTTP."""
    try:
        store = _load_store()
    except Exception:
        return []
    out = []
    for acc in store.get("accounts") or []:
        if not isinstance(acc, dict) or not acc.get("email"):
            continue
        out.append(
            {
                "email": acc.get("email") or "",
                "name": acc.get("name") or "",
                "autologin": bool(acc.get("autologin")),
                "saved_at": acc.get("saved_at") or "",
                "last_used_at": acc.get("last_used_at") or "",
                "unreadable": bool(acc.get("unreadable")),
            }
        )
    return out


def autologin_email() -> str:
    try:
        for acc in list_public():
            if acc.get("autologin"):
                return str(acc.get("email") or "")
    except Exception:
        pass
    return ""


def password_for(email: str) -> str | None:
    """Odszyfrowane haslo albo None (brak konta / blad deszyfrowania).

    Przy bledzie deszyfrowania oznacza konto jako "unreadable" (nie kasuje go).
    """
    email_n = _normalize_email(email)
    if not email_n:
        return None
    with _LOCK:
        store = _load_store()
        acc = _find(store["accounts"], email_n)
        if acc is None:
            return None
        pw = _decrypt_password(str(acc.get("secret") or ""))
        if not pw:
            if not acc.get("unreadable"):
                acc["unreadable"] = True
                _save_store(store)
            return None
        if acc.get("unreadable"):
            acc["unreadable"] = False
            _save_store(store)
        return pw


def touch(email: str) -> bool:
    email_n = _normalize_email(email)
    if not email_n:
        return False
    with _LOCK:
        store = _load_store()
        acc = _find(store["accounts"], email_n)
        if acc is None:
            return False
        acc["last_used_at"] = _utc()
        return _save_store(store)


def delete(email: str) -> bool:
    email_n = _normalize_email(email)
    if not email_n:
        return False
    with _LOCK:
        store = _load_store()
        before = len(store["accounts"])
        store["accounts"] = [
            a for a in store["accounts"] if _normalize_email(a.get("email")) != email_n
        ]
        if len(store["accounts"]) == before:
            return False
        return _save_store(store)


def set_autologin(email: str, enabled: bool) -> bool:
    """Wlacz autologowanie dla jednego konta (wylacza inne) albo wylacz."""
    email_n = _normalize_email(email)
    if not email_n:
        return False
    with _LOCK:
        store = _load_store()
        acc = _find(store["accounts"], email_n)
        if acc is None:
            return False
        if enabled:
            for a in store["accounts"]:
                a["autologin"] = _normalize_email(a.get("email")) == email_n
        else:
            acc["autologin"] = False
        return _save_store(store)
