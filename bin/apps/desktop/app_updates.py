# -*- coding: utf-8 -*-
"""Sprawdzanie aktualizacji DAM z GitHub Releases.

Powiadomienie tylko gdy latest > current i jest prawdziwy DAM-Setup.exe.
Repo prywatne wymaga tokenu z lokalnych sekretow (nigdy w JS / logach).
Harmonogram: codziennie o 09:00 czasu lokalnego, nie co 5 godzin.
"""
from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = DESKTOP_DIR.parent / "web"
CONTENT_ROOT = DESKTOP_DIR.parent.parent
GIT_ROOT = CONTENT_ROOT.parent
VERSION_JSON = WEB_ROOT / "version.json"
STATE_PATH = DESKTOP_DIR / "data" / "update-check-state.json"
PREFS_PATH = DESKTOP_DIR / "data" / "update-prefs.json"
INSTALLER_DIR = DESKTOP_DIR / "data" / "updates"

DEFAULT_REPO = "inyfinn/DAM---Dobra-Kaloria---inyfinn"
DEFAULT_ASSET = "DAM-Setup.exe"
SIG_SUFFIX = ".sig"
MAX_SIG_BYTES = 8192
DAILY_CHECK_HOUR = 9
DAILY_CHECK_MINUTE = 0
TOKEN_KEYS = ("GITHUB_TOKEN", "GH_TOKEN", "DAM_GITHUB_TOKEN")
MIN_INSTALLER_BYTES = 1_000_000

_LOCK = threading.Lock()
_SCHEDULER_STARTED = False
_DL_LOCK = threading.Lock()
_DL_STATE: dict[str, Any] = {
    "status": "idle",
    "path": "",
    "error": "",
    "bytes": 0,
}
_TOKEN_CACHE: str | None = None


def _strip_v(raw: str) -> str:
    return re.sub(r"^[vV]", "", str(raw or "").strip())


_CANONICAL_PRODUCT_VER = re.compile(r"^\d\.\d\.\d$")


def is_canonical_product_version(raw: str) -> bool:
    """DAM display: jedna cyfra na slot (1.8.8). Nie semver 6.0.12 / 1.0.74."""
    return bool(_CANONICAL_PRODUCT_VER.match(_strip_v(raw)))


def version_to_int(raw: str) -> int:
    v = _strip_v(raw)
    if not is_canonical_product_version(v):
        return -1
    return int(v.replace(".", ""), 10)


def parse_version(raw: str) -> tuple[int, ...]:
    parts = re.findall(r"\d+", _strip_v(raw))
    return tuple(int(p) for p in parts) if parts else (0,)


def _cmp_version(a_raw: str, b_raw: str) -> int:
    ai = version_to_int(a_raw)
    bi = version_to_int(b_raw)
    if ai >= 0 and bi >= 0:
        if ai > bi:
            return 1
        if ai < bi:
            return -1
        return 0
    if ai < 0 and bi >= 0:
        return -1
    if bi < 0 and ai >= 0:
        return 1
    a = parse_version(a_raw)
    b = parse_version(b_raw)
    n = max(len(a), len(b))
    a = a + (0,) * (n - len(a))
    b = b + (0,) * (n - len(b))
    if a > b:
        return 1
    if a < b:
        return -1
    return 0


def is_newer(latest: str, current: str) -> bool:
    """True tylko gdy latest jest sciśle nowszy od current (kanoniczny licznik kropkowy)."""
    if not is_canonical_product_version(latest):
        return False
    return _cmp_version(latest, current) > 0


def is_stale_older(remote: str, current: str) -> bool:
    """True gdy remote jest starszy lub legacy tag (6.0.12, 1.0.74 przy 1.8.x)."""
    if not remote or not current:
        return False
    if not is_canonical_product_version(remote) and is_canonical_product_version(current):
        return True
    return _cmp_version(remote, current) < 0


def _parse_version(raw: str) -> tuple[int, ...]:
    return parse_version(raw)


def _load_json(path: Path, default: dict[str, Any]) -> dict[str, Any]:
    try:
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return {**default, **data}
    except Exception:
        pass
    return dict(default)


def _save_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_dotenv_file(path: Path) -> None:
    """KEY=VALUE bez nadpisywania juz ustawionych env. Nie loguje wartosci."""
    if not path.is_file():
        return
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = val
    except OSError:
        pass


def _token_from_mapping(data: Any) -> str:
    if not isinstance(data, dict):
        return ""
    for key in TOKEN_KEYS:
        val = data.get(key) or data.get(key.lower())
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def _load_secret_files() -> None:
    sibling_env = (DESKTOP_DIR / "data" / "pg-config.json").with_name("pg-config.env")
    for path in (
        CONTENT_ROOT / ".env",
        DESKTOP_DIR / "dam-connection.env",
        DESKTOP_DIR / "data" / ".env",
        sibling_env,
        DESKTOP_DIR / "data" / "pg-config.env",
    ):
        _load_dotenv_file(path)


def _token_from_gh_cli() -> str:
    """Lokalny keyring `gh` (to samo konto co git). Nigdy nie loguje stdout."""
    try:
        import subprocess

        proc = subprocess.run(
            ["gh", "auth", "token"],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        val = (proc.stdout or "").strip()
        if proc.returncode == 0 and val:
            return val
    except Exception:
        pass
    return ""


def _resolve_github_token() -> str:
    global _TOKEN_CACHE
    if _TOKEN_CACHE is not None:
        return _TOKEN_CACHE
    _load_secret_files()
    found = ""
    for key in TOKEN_KEYS:
        val = (os.environ.get(key) or "").strip()
        if val:
            found = val
            break
    if not found:
        try:
            # Przez pg_db: po aktywacji konfiguracja lezy pod DPAPI, nie w jawnym JSON.
            import pg_db

            found = _token_from_mapping(pg_db.raw_config_mapping())
        except Exception:
            found = ""
    if not found:
        found = _token_from_gh_cli()
    _TOKEN_CACHE = found
    return found


def load_update_config() -> dict[str, Any]:
    cfg = {
        "github_repo": DEFAULT_REPO,
        "asset_name": DEFAULT_ASSET,
        "check_hour_local": DAILY_CHECK_HOUR,
    }
    try:
        if VERSION_JSON.is_file():
            vj = json.loads(VERSION_JSON.read_text(encoding="utf-8"))
            upd = vj.get("updates") if isinstance(vj, dict) else None
            if isinstance(upd, dict):
                cfg.update({k: v for k, v in upd.items() if v not in (None, "")})
    except Exception:
        pass
    return cfg


def current_version() -> str:
    try:
        if VERSION_JSON.is_file():
            vj = json.loads(VERSION_JSON.read_text(encoding="utf-8"))
            if isinstance(vj, dict) and vj.get("version"):
                return str(vj["version"])
    except Exception:
        pass
    return "0.0.0"


def load_prefs() -> dict[str, Any]:
    return _load_json(PREFS_PATH, {"auto_check": True, "notify_on_startup": True})


def save_prefs(payload: dict[str, Any] | None) -> dict[str, Any]:
    prefs = load_prefs()
    if isinstance(payload, dict):
        if "auto_check" in payload:
            prefs["auto_check"] = bool(payload["auto_check"])
        if "notify_on_startup" in payload:
            prefs["notify_on_startup"] = bool(payload["notify_on_startup"])
    _save_json(PREFS_PATH, prefs)
    return prefs


def is_portable_repo() -> bool:
    """DAM.exe + bin/ w jednym GIT_ROOT — bez instalatora, restart DAM.exe."""
    try:
        return (GIT_ROOT / ".git").is_dir() or (GIT_ROOT / ".git").is_file()
    except OSError:
        return False


def installer_path() -> Path:
    return INSTALLER_DIR / DEFAULT_ASSET


def sig_path() -> Path:
    return INSTALLER_DIR / (DEFAULT_ASSET + SIG_SUFFIX)


_VERIFY_CACHE: dict[str, Any] = {"key": None, "ok": False, "reason": ""}


def verify_downloaded_installer(*, use_cache: bool = True) -> tuple[bool, str]:
    """Podpis Ed25519 wydania (release_verify). Bez waznego podpisu instalator NIE rusza.

    Cache po (mtime, size) obu plikow - status w UI nie liczy SHA-256 z ~90 MB co sekunde.
    Start instalatora zawsze woła z use_cache=False (plik mogl zostac podmieniony).
    """
    exe, sig = installer_path(), sig_path()
    try:
        if not exe.is_file() or exe.stat().st_size < MIN_INSTALLER_BYTES:
            return False, "installer_missing"
        if not sig.is_file():
            return False, "signature_missing"
        es, ss = exe.stat(), sig.stat()
        key = (es.st_mtime_ns, es.st_size, ss.st_mtime_ns, ss.st_size)
        if use_cache and _VERIFY_CACHE.get("key") == key:
            return bool(_VERIFY_CACHE["ok"]), str(_VERIFY_CACHE["reason"])
        import release_verify

        ok, reason = release_verify.verify_installer(
            exe,
            sig.read_bytes(),
            min_version_exclusive=parse_version(current_version()),
            parse_version=parse_version,
        )
        _VERIFY_CACHE.update({"key": key, "ok": ok, "reason": reason})
        return ok, reason
    except Exception:  # noqa: BLE001
        return False, "verify_error"


def _discard_download() -> None:
    for path in (installer_path(), sig_path()):
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def installer_ready() -> bool:
    ok, _reason = verify_downloaded_installer()
    return ok


_GITHUB_HOSTS = ("github.com", "api.github.com", "objects.githubusercontent.com")


def _is_github_https(url: str) -> bool:
    """Host z listy, nie podciag: 'https://evil.example/github.com/x.exe' odpada."""
    try:
        parsed = urllib.parse.urlparse(str(url or "").strip())
    except ValueError:
        return False
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and host in _GITHUB_HOSTS


def _is_setup_download_url(url: str, asset_name: str = DEFAULT_ASSET) -> bool:
    u = str(url or "").strip()
    name = str(asset_name or DEFAULT_ASSET)
    if not _is_github_https(u):
        return False
    path = urllib.parse.urlparse(u).path
    return path.endswith("/" + name) and name.lower().endswith(".exe")


def next_daily_run_at(now: datetime, last_check_ts: float | None) -> datetime:
    """Kiedy odpalic auto-check (czas lokalny).

    - last check wczoraj (albo brak) i now >= 09:00 -> natychmiast
    - last check wczoraj i now < 09:00 -> dzisiaj 09:00
    - last check dzisiaj -> jutro 09:00
    """
    today_nine = now.replace(
        hour=DAILY_CHECK_HOUR,
        minute=DAILY_CHECK_MINUTE,
        second=0,
        microsecond=0,
    )
    last_date = None
    if last_check_ts:
        try:
            last_date = datetime.fromtimestamp(float(last_check_ts)).date()
        except (OSError, OverflowError, ValueError, TypeError):
            last_date = None
    if last_date is None or last_date < now.date():
        if now >= today_nine:
            return now
        return today_nine
    tomorrow = now.date() + timedelta(days=1)
    return datetime.combine(tomorrow, today_nine.time())


def seconds_until_next_daily_check(
    now: datetime | None = None,
    last_check_ts: float | None = None,
) -> float:
    current = now or datetime.now()
    nxt = next_daily_run_at(current, last_check_ts)
    delay = (nxt - current).total_seconds()
    return 0.0 if delay < 1.0 else delay


def _empty_result(error: str = "") -> dict[str, Any]:
    cur = current_version()
    out: dict[str, Any] = {
        "ok": not bool(error),
        "current": cur,
        "latest": cur,
        "update_available": False,
        "download_url": "",
        "release_notes": "",
        "published_at": "",
        "checked_at": time.time(),
        "portable": is_portable_repo(),
        "update_mode": "restart_exe" if is_portable_repo() else "installer",
        "installer_ready": installer_ready(),
        "auth_configured": bool(_resolve_github_token()),
    }
    if error:
        out["ok"] = False
        out["error"] = error
    return out


def _git_origin_version() -> str:
    """Wersja z origin/main:bin/apps/web/version.json. Pusty string gdy brak gita."""
    if not is_portable_repo():
        return ""
    try:
        import subprocess

        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
        proc = subprocess.run(
            ["git", "-C", str(GIT_ROOT), "show", "origin/main:bin/apps/web/version.json"],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
            creationflags=flags,
        )
        if proc.returncode != 0:
            return ""
        data = json.loads(proc.stdout or "{}")
        return str((data or {}).get("version") or "")
    except Exception:
        return ""


def _consider_remote(ver: str, current: str) -> str:
    """Jedna linia produktu: ignoruj leftover starszy (1.0.x przy 1.7.x)."""
    cand = _strip_v(ver)
    if not cand:
        return ""
    if is_stale_older(cand, current):
        return ""
    return cand


def _pick_product_latest(current: str, github_raw: str, git_raw: str) -> tuple[str, str]:
    latest = current
    source = "installed"
    for ver, src in ((git_raw, "git"), (github_raw, "github")):
        cand = _consider_remote(ver, current)
        if not cand:
            continue
        if is_newer(cand, latest):
            latest = cand
            source = src
        elif _cmp_version(cand, latest) == 0 and source == "installed":
            source = src
    return latest, source


def _public_result(data: dict[str, Any]) -> dict[str, Any]:
    """Jedna wersja produktu. Stary tag GitHub (1.0.74) nie wygrywa z 1.7.x."""
    cur = current_version()
    github_raw = _strip_v(str(data.get("latest") or ""))
    git_ver = _git_origin_version() if is_portable_repo() else ""
    latest, latest_source = _pick_product_latest(cur, github_raw, git_ver)
    url = str(data.get("download_url") or "")
    err = str(data.get("error") or "")
    ok = bool(data.get("ok", True)) and not err
    newer = is_newer(latest, cur)
    setup_ok = _is_setup_download_url(url) and latest_source == "github" and newer
    out = {
        "ok": ok,
        "current": cur,
        "latest": latest or cur,
        "github_latest": latest if latest_source == "github" else latest,
        "git_latest": _consider_remote(git_ver, cur),
        "latest_source": latest_source,
        "update_available": bool(ok and newer and setup_ok),
        "download_url": url if setup_ok else "",
        "release_notes": str(data.get("release_notes") or "")[:4000],
        "published_at": str(data.get("published_at") or ""),
        "checked_at": data.get("checked_at") or time.time(),
        "portable": is_portable_repo(),
        "update_mode": "restart_exe" if is_portable_repo() else "installer",
        "installer_ready": installer_ready(),
        "auth_configured": bool(_resolve_github_token()),
    }
    if err:
        out["ok"] = False
        out["error"] = err
        out["update_available"] = False
        out["download_url"] = ""
    if setup_ok and data.get("asset_api_url"):
        out["asset_api_url"] = str(data.get("asset_api_url") or "")
    if setup_ok:
        out["sig_url"] = str(data.get("sig_url") or "")
        out["sig_api_url"] = str(data.get("sig_api_url") or "")
        if not _is_github_https(out["sig_url"]) and not _is_github_https(out["sig_api_url"]):
            out["update_available"] = False
            out["download_url"] = ""
            out["error"] = out.get("error") or "release_unsigned"
    return out


def _persist_attempt(out: dict[str, Any]) -> None:
    state = _load_json(STATE_PATH, {})
    keep_keys = (
        "ok",
        "current",
        "latest",
        "update_available",
        "download_url",
        "asset_api_url",
        "sig_url",
        "sig_api_url",
        "error",
        "published_at",
    )
    last_result = {k: out[k] for k in keep_keys if k in out}
    nxt = next_daily_run_at(datetime.now(), float(out.get("checked_at") or time.time()))
    state.update(
        {
            "last_check": out.get("checked_at") or time.time(),
            "next_run": nxt.isoformat(timespec="seconds"),
            "last_result": last_result,
        }
    )
    _save_json(STATE_PATH, state)


def _github_headers(token: str, *, download: bool = False) -> dict[str, str]:
    headers = {
        "Accept": "application/octet-stream" if download else "application/vnd.github+json",
        "User-Agent": "DAM-Dobra-Kaloria-Updater",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _github_get_json(url: str, token: str) -> Any:
    req = urllib.request.Request(url, headers=_github_headers(token))
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raise
    except TimeoutError as exc:
        raise TimeoutError("github_timeout") from exc
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("github_malformed") from exc


def _pick_setup_asset(rel: dict[str, Any], asset_name: str) -> dict[str, str] | None:
    assets = rel.get("assets") if isinstance(rel.get("assets"), list) else []
    sig_url = sig_api = ""
    for asset in assets:
        if isinstance(asset, dict) and str(asset.get("name") or "") == asset_name + SIG_SUFFIX:
            sig_url = str(asset.get("browser_download_url") or "")
            sig_api = str(asset.get("url") or "")
            break
    if not _is_github_https(sig_url):
        # Wydanie bez podpisu Ed25519 nie jest aktualizacja - patrz release_verify.py.
        return None
    for asset in assets:
        if not isinstance(asset, dict):
            continue
        if str(asset.get("name") or "") != asset_name:
            continue
        url = str(asset.get("browser_download_url") or "")
        api = str(asset.get("url") or "")
        if not _is_setup_download_url(url, asset_name):
            continue
        return {
            "download_url": url,
            "asset_api_url": api,
            "sig_url": sig_url,
            "sig_api_url": sig_api,
        }
    return None


def _select_release(
    releases: list[Any], asset_name: str
) -> tuple[dict[str, Any], dict[str, str]] | None:
    stable: list[tuple[dict[str, Any], dict[str, str]]] = []
    pre: list[tuple[dict[str, Any], dict[str, str]]] = []
    for rel in releases:
        if not isinstance(rel, dict) or rel.get("draft"):
            continue
        tag = _strip_v(str(rel.get("tag_name") or rel.get("name") or ""))
        if not is_canonical_product_version(tag):
            continue
        asset = _pick_setup_asset(rel, asset_name)
        if not asset:
            continue
        if rel.get("prerelease"):
            pre.append((rel, asset))
        else:
            stable.append((rel, asset))
    def _semver_key(item: tuple[dict[str, Any], dict[str, str]]) -> tuple[int, ...]:
        rel, _asset = item
        return parse_version(str(rel.get("tag_name") or rel.get("name") or ""))

    if stable:
        return max(stable, key=_semver_key)
    if pre:
        return max(pre, key=_semver_key)
    return None


def _perform_github_check(token: str) -> dict[str, Any]:
    out = _empty_result()
    if not token:
        out["ok"] = False
        out["error"] = "github_auth_missing"
        out["auth_configured"] = False
        return out
    cfg = load_update_config()
    repo = str(cfg.get("github_repo") or DEFAULT_REPO)
    asset_name = str(cfg.get("asset_name") or DEFAULT_ASSET)
    url = f"https://api.github.com/repos/{repo}/releases?per_page=15"
    try:
        payload = _github_get_json(url, token)
    except urllib.error.HTTPError as exc:
        out["ok"] = False
        out["error"] = f"github_http_{exc.code}"
        return out
    except TimeoutError:
        out["ok"] = False
        out["error"] = "github_timeout"
        return out
    except ValueError:
        out["ok"] = False
        out["error"] = "github_malformed"
        return out
    except Exception:
        out["ok"] = False
        out["error"] = "github_error"
        return out

    if not isinstance(payload, list):
        out["ok"] = False
        out["error"] = "github_malformed"
        return out

    picked = _select_release(payload, asset_name)
    if not picked:
        out["ok"] = False
        out["error"] = "github_no_setup_asset"
        return out

    rel, asset = picked
    tag = _strip_v(str(rel.get("tag_name") or rel.get("name") or ""))
    out["latest"] = tag or out["current"]
    out["release_notes"] = str(rel.get("body") or "")[:4000]
    out["published_at"] = str(rel.get("published_at") or "")
    out["download_url"] = asset["download_url"]
    out["asset_api_url"] = asset.get("asset_api_url") or ""
    out["sig_url"] = asset.get("sig_url") or ""
    out["sig_api_url"] = asset.get("sig_api_url") or ""
    out["ok"] = True
    return _public_result(out)


def check_for_updates(force: bool = False, *, token: str | None = None) -> dict[str, Any]:
    """force=True tylko z Ustawien albo dziennego schedulera.

    Bez force: zwroc cache (przefiltrowany). Nigdy nie udawaj update.
    token= None -> sekret z plikow; token="" -> test galezi bez auth.
    """
    if not force:
        state = _load_json(STATE_PATH, {})
        last = state.get("last_result") if isinstance(state.get("last_result"), dict) else {}
        if last:
            cached = _public_result({**last, "checked_at": state.get("last_check") or time.time()})
            cached["from_cache"] = True
            return cached
        empty = _empty_result()
        empty["from_cache"] = True
        return empty

    tok = _resolve_github_token() if token is None else str(token or "")
    out = _perform_github_check(tok)
    _persist_attempt(out)
    return out


def download_status() -> dict[str, Any]:
    with _DL_LOCK:
        st = dict(_DL_STATE)
    st["installer_ready"] = installer_ready()
    st["path"] = str(installer_path()) if installer_ready() or st.get("path") else st.get("path") or ""
    st["ok"] = st.get("status") not in ("error",)
    st["portable"] = is_portable_repo()
    return st


def _download_file(url: str, token: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    download = "api.github.com" in url.lower() and "/releases/assets/" in url.lower()
    req = urllib.request.Request(url, headers=_github_headers(token, download=download))
    with urllib.request.urlopen(req, timeout=120) as resp, tmp.open("wb") as fh:
        total = 0
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            fh.write(chunk)
            total += len(chunk)
            with _DL_LOCK:
                _DL_STATE["bytes"] = total
    if tmp.stat().st_size < MIN_INSTALLER_BYTES:
        tmp.unlink(missing_ok=True)
        raise OSError("installer_too_small")
    tmp.replace(dest)


def _download_signature(url: str, token: str, dest: Path) -> None:
    if not _is_github_https(url):
        raise OSError("bad_signature_url")
    dest.parent.mkdir(parents=True, exist_ok=True)
    download = "api.github.com" in url.lower() and "/releases/assets/" in url.lower()
    req = urllib.request.Request(url, headers=_github_headers(token, download=download))
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read(MAX_SIG_BYTES + 1)
    if not data or len(data) > MAX_SIG_BYTES:
        raise OSError("signature_size")
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(data)
    tmp.replace(dest)


def _download_worker(url: str, sig_url: str = "") -> None:
    token = _resolve_github_token()
    dest = installer_path()
    try:
        _download_signature(sig_url, token, sig_path())
        _download_file(url, token, dest)
        ok, reason = verify_downloaded_installer(use_cache=False)
        if not ok:
            # Niepodpisany / podmieniony plik nie zostaje na dysku ani sekundy dluzej.
            _discard_download()
            with _DL_LOCK:
                _DL_STATE.update(
                    {"status": "error", "error": "signature_" + reason, "path": "", "bytes": 0}
                )
            return
        with _DL_LOCK:
            _DL_STATE.update(
                {
                    "status": "ready",
                    "path": str(dest),
                    "error": "",
                    "bytes": dest.stat().st_size,
                }
            )
    except Exception as exc:  # noqa: BLE001
        with _DL_LOCK:
            _DL_STATE.update({"status": "error", "error": "download_failed", "path": ""})
        _ = str(exc)


def start_background_download(download_url: str = "") -> dict[str, Any]:
    if is_portable_repo():
        return {"ok": False, "error": "portable_skip", "portable": True, "status": "idle"}
    chk = check_for_updates(force=False)
    if not chk.get("update_available"):
        return {"ok": False, "error": "no_update", "update_available": False, "status": "idle"}
    url = str(chk.get("asset_api_url") or chk.get("download_url") or download_url or "").strip()
    if not url:
        return {"ok": False, "error": "missing_download_url", "status": "idle"}
    if not _is_github_https(url) or (
        url.startswith("https://github.com/") and not _is_setup_download_url(url)
    ):
        return {"ok": False, "error": "bad_download_url", "status": "idle"}
    sig_url = str(chk.get("sig_api_url") or chk.get("sig_url") or "").strip()
    if not _is_github_https(sig_url):
        return {"ok": False, "error": "release_unsigned", "status": "idle"}
    if installer_ready():
        with _DL_LOCK:
            _DL_STATE.update({"status": "ready", "path": str(installer_path()), "error": ""})
        return download_status()
    with _DL_LOCK:
        if _DL_STATE.get("status") == "downloading":
            return dict(_DL_STATE)
        _DL_STATE.update({"status": "downloading", "path": "", "error": "", "bytes": 0})
    t = threading.Thread(
        target=_download_worker, args=(url, sig_url), name="dam-update-dl", daemon=True
    )
    t.start()
    return download_status()


def _launch_installer(path: Path) -> dict[str, Any]:
    import subprocess
    import sys

    if not path.is_file():
        return {"ok": False, "error": "installer_missing"}
    # Swiezo liczone (bez cache): katalog data/updates jest zapisywalny dla usera,
    # wiec plik mogl zostac podmieniony miedzy pobraniem a kliknieciem "Zainstaluj".
    if path.resolve() != installer_path().resolve():
        return {"ok": False, "error": "installer_path_forbidden"}
    ok, reason = verify_downloaded_installer(use_cache=False)
    if not ok:
        _discard_download()
        return {"ok": False, "error": "signature_" + reason}
    args = [str(path), "/VERYSILENT", "/NORESTART"]
    try:
        if sys.platform == "win32":
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
            subprocess.Popen(args, creationflags=flags)
        else:
            subprocess.Popen([str(path)])
        return {"ok": True, "path": str(path), "launched": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "launch_failed", "detail": type(exc).__name__}


def install_downloaded(download_url: str = "") -> dict[str, Any]:
    if is_portable_repo():
        return {"ok": False, "error": "portable_skip", "portable": True}
    chk = check_for_updates(force=False)
    if not chk.get("update_available") and not installer_ready():
        return {"ok": False, "error": "no_update", "update_available": False}
    if installer_ready():
        return _launch_installer(installer_path())
    started = start_background_download(download_url)
    if not started.get("ok") and started.get("status") != "downloading":
        return started
    return {"ok": True, "status": "downloading", "error": "wait_for_download"}


def download_and_launch_installer(download_url: str) -> dict[str, Any]:
    """Kompatybilnosc: pobierz w tle; jesli plik juz jest, odpal instalator."""
    if is_portable_repo():
        return {"ok": False, "error": "portable_skip", "portable": True}
    if installer_ready():
        return _launch_installer(installer_path())
    return start_background_download(download_url)


def check_on_startup() -> dict[str, Any]:
    """Zachowane API: nie wymusza GitHub przed 09:00 i nie gdy juz sprawdzono dzis."""
    try:
        state = _load_json(STATE_PATH, {})
        delay = seconds_until_next_daily_check(datetime.now(), state.get("last_check"))
        if delay > 0:
            cached = check_for_updates(force=False)
            cached["deferred"] = True
            return cached
        return check_for_updates(force=True)
    except Exception as exc:  # noqa: BLE001
        out = _empty_result("github_error")
        out["ok"] = False
        _ = str(exc)
        return out


def _scheduler_loop() -> None:
    while True:
        prefs = load_prefs()
        state = _load_json(STATE_PATH, {})
        delay = seconds_until_next_daily_check(datetime.now(), state.get("last_check"))
        if delay > 0:
            time.sleep(min(delay, 60.0))
            continue
        if not prefs.get("auto_check", True):
            time.sleep(60.0)
            continue
        try:
            check_for_updates(force=True)
        except Exception:
            try:
                _persist_attempt(_empty_result("github_error"))
            except Exception:
                pass
        time.sleep(2.0)


def ensure_scheduler_started() -> None:
    """Jeden watek na proces. Dwa procesy nie dubluja GitHub: cache z dzisiaj wygrywa."""
    global _SCHEDULER_STARTED
    with _LOCK:
        if _SCHEDULER_STARTED:
            return
        t = threading.Thread(target=_scheduler_loop, name="dam-update-check", daemon=True)
        t.start()
        _SCHEDULER_STARTED = True
