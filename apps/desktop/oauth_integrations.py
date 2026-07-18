# -*- coding: utf-8 -*-
"""
Integracje OAuth: Asana + Microsoft (Teams / Outlook via Graph).

Tokeny trzymane ZASZYFROWANE (secret_box / Fernet) w
apps/desktop/data/oauth-tokens.json (gitignored).

Konfiguracja client_id/secret: dam-connection.env / env:
  DAM_ASANA_CLIENT_ID, DAM_ASANA_CLIENT_SECRET
  DAM_MS_CLIENT_ID, DAM_MS_CLIENT_SECRET
  DAM_OAUTH_REDIRECT (domyslnie http://127.0.0.1:8766/oauth/callback)

Bez credentials: status "needs_config" + instrukcja - nie udajemy zalogowania.
"""
from __future__ import annotations

import json
import os
import secrets
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from secret_box import decrypt_str, encrypt_str, is_available as crypto_ok

DESKTOP_DIR = Path(__file__).resolve().parent
TOKENS_PATH = DESKTOP_DIR / "data" / "oauth-tokens.json"
ENV_PATH = DESKTOP_DIR / "dam-connection.env"

PROVIDERS = ("asana", "microsoft")  # microsoft = Teams + Outlook (Graph)


def _load_dotenv() -> None:
    if not ENV_PATH.is_file():
        return
    try:
        for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip().strip("'").strip('"')
            if k and k not in os.environ:
                os.environ[k] = v
    except OSError:
        pass


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _load_store() -> dict[str, Any]:
    if not TOKENS_PATH.is_file():
        return {"providers": {}, "pending": {}}
    try:
        return json.loads(TOKENS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"providers": {}, "pending": {}}


def _save_store(data: dict[str, Any]) -> None:
    TOKENS_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKENS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def provider_config(name: str) -> dict[str, str]:
    _load_dotenv()
    name = (name or "").strip().lower()
    redirect = os.environ.get("DAM_OAUTH_REDIRECT", "http://127.0.0.1:8766/oauth/callback")
    if name == "asana":
        return {
            "client_id": os.environ.get("DAM_ASANA_CLIENT_ID", "").strip(),
            "client_secret": os.environ.get("DAM_ASANA_CLIENT_SECRET", "").strip(),
            "redirect_uri": redirect,
            "auth_url": "https://app.asana.com/-/oauth_authorize",
            "token_url": "https://app.asana.com/-/oauth_token",
            "scope": "default",
        }
    if name == "microsoft":
        # Teams + Outlook (Mail.Read) + User.Read - Graph
        return {
            "client_id": os.environ.get("DAM_MS_CLIENT_ID", "").strip(),
            "client_secret": os.environ.get("DAM_MS_CLIENT_SECRET", "").strip(),
            "redirect_uri": redirect,
            "auth_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            "scope": "openid profile offline_access User.Read Mail.Read ChannelMessage.Read.All",
        }
    return {}


def status() -> dict[str, Any]:
    store = _load_store()
    providers = store.get("providers") or {}
    out = {}
    for name in PROVIDERS:
        cfg = provider_config(name)
        entry = providers.get(name) or {}
        configured = bool(cfg.get("client_id") and cfg.get("client_secret"))
        connected = bool(entry.get("access_token_enc"))
        out[name] = {
            "configured": configured,
            "connected": connected,
            "crypto_ok": crypto_ok(),
            "email": entry.get("email") or "",
            "connected_at": entry.get("connected_at") or "",
            "label": "Asana" if name == "asana" else "Microsoft (Teams + Outlook)",
            "hint": (
                ""
                if configured
                else (
                    "Uzupelnij DAM_ASANA_CLIENT_ID/SECRET w dam-connection.env"
                    if name == "asana"
                    else "Uzupelnij DAM_MS_CLIENT_ID/SECRET (Azure App Registration) w dam-connection.env"
                )
            ),
        }
    return {"ok": True, "providers": out, "crypto_ok": crypto_ok()}


def start_login(provider: str, user_email: str = "") -> dict[str, Any]:
    provider = (provider or "").strip().lower()
    if provider not in PROVIDERS:
        return {"ok": False, "error": "unknown_provider"}
    if not crypto_ok():
        return {"ok": False, "error": "cryptography_missing", "hint": "pip install cryptography"}
    cfg = provider_config(provider)
    if not cfg.get("client_id") or not cfg.get("client_secret"):
        return {
            "ok": False,
            "error": "needs_config",
            "hint": status()["providers"][provider]["hint"],
        }
    state = secrets.token_urlsafe(24)
    store = _load_store()
    store.setdefault("pending", {})[state] = {
        "provider": provider,
        "user_email": user_email,
        "created_at": _utc(),
    }
    _save_store(store)
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": cfg["redirect_uri"],
        "response_type": "code",
        "state": state,
        "scope": cfg["scope"],
    }
    if provider == "microsoft":
        params["response_mode"] = "query"
    url = cfg["auth_url"] + "?" + urllib.parse.urlencode(params)
    return {"ok": True, "authorize_url": url, "state": state, "provider": provider}


def complete_callback(code: str, state: str) -> dict[str, Any]:
    """Wymiana code->token. Wymaga sieci + credentials. Zapisuje ciphertext."""
    import urllib.request

    code = (code or "").strip()
    state = (state or "").strip()
    if not code or not state:
        return {"ok": False, "error": "code_and_state_required"}
    store = _load_store()
    pending = (store.get("pending") or {}).pop(state, None)
    if not pending:
        return {"ok": False, "error": "invalid_or_expired_state"}
    provider = pending.get("provider") or ""
    cfg = provider_config(provider)
    if not cfg.get("client_id"):
        return {"ok": False, "error": "needs_config"}

    data = urllib.parse.urlencode(
        {
            "grant_type": "authorization_code",
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "redirect_uri": cfg["redirect_uri"],
            "code": code,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        cfg["token_url"],
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        _save_store(store)
        return {"ok": False, "error": "token_exchange_failed", "detail": str(exc)[:300]}

    access = body.get("access_token") or ""
    refresh = body.get("refresh_token") or ""
    if not access:
        _save_store(store)
        return {"ok": False, "error": "no_access_token", "detail": str(body)[:300]}

    store.setdefault("providers", {})[provider] = {
        "access_token_enc": encrypt_str(access),
        "refresh_token_enc": encrypt_str(refresh) if refresh else "",
        "token_type": body.get("token_type") or "Bearer",
        "expires_in": body.get("expires_in"),
        "scope": body.get("scope") or cfg.get("scope"),
        "email": pending.get("user_email") or "",
        "connected_at": _utc(),
    }
    _save_store(store)
    return {"ok": True, "provider": provider, "connected": True}


def disconnect(provider: str) -> dict[str, Any]:
    provider = (provider or "").strip().lower()
    store = _load_store()
    if provider in (store.get("providers") or {}):
        del store["providers"][provider]
        _save_store(store)
    return {"ok": True, "provider": provider, "connected": False}


def get_access_token(provider: str) -> str | None:
    """Zwraca odszyfrowany access_token albo None (dla przyszlych sync jobow)."""
    store = _load_store()
    entry = (store.get("providers") or {}).get(provider) or {}
    enc = entry.get("access_token_enc") or ""
    if not enc:
        return None
    try:
        return decrypt_str(enc)
    except Exception:
        return None
