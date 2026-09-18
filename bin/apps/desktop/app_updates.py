# -*- coding: utf-8 -*-
"""Aktualizacje DAM z GitHub Releases (repo publiczne, token opcjonalny).

Przeplyw (logika przeniesiona z Inyfinn Photo Resizer, bez Qt - watki):
- sprawdzenie ok. 20 s po starcie harmonogramu, potem co 6 h (prefs auto_check),
- nowsze wydanie z DAM-Setup.exe ORAZ DAM-Setup.exe.sig -> pobieranie w tle:
  najpierw .sig (maly), potem instalator do .part ze wznawianiem (HTTP Range),
  kontrola rozmiaru z API, SHA-256 z pola `digest` (gdy jest) i podpisu Ed25519,
- gotowy instalator lezy w data/updates/<wersja>/ (najwyzej 2 wersje),
- instalacja tylko na zadanie uzytkownika: ponowna weryfikacja podpisu bez cache,
  znacznik pending_success.json, cichy instalator z /DAMRELAUNCH=1 (Inno uruchamia DAM).
W drzewie gita (is_portable_repo) nic nie pobieramy i nic nie instalujemy.
Token GitHub nigdy nie trafia do JS ani logow.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
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
PART_SUFFIX = ".part"
MAX_SIG_BYTES = 8192
TOKEN_KEYS = ("GITHUB_TOKEN", "GH_TOKEN", "DAM_GITHUB_TOKEN")
MIN_INSTALLER_BYTES = 1_000_000
USER_AGENT = "DAM-Updater/1"

FIRST_CHECK_DELAY_SEC = 20.0
CHECK_INTERVAL_SEC = 6 * 3600.0
MAX_CACHED_VERSIONS = 2
DOWNLOAD_CHUNK_BYTES = 256 * 1024
PROGRESS_WRITE_INTERVAL_SEC = 0.5
LOCK_STALE_SEC = 120.0
STATUS_STALE_SEC = 120.0
# Znacznik nowszej wersji mlodszy niz to = instalator moze jeszcze pracowac, nie kasuj.
MARKER_GRACE_SEC = 600.0
INSTALLER_ARGS = ("/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/DAMRELAUNCH=1")

_LOCK = threading.Lock()
_SCHEDULER_STARTED = False
_DL_LOCK = threading.Lock()
_DL_STATE: dict[str, Any] = {
    "status": "idle",
    "target": "",
    "bytes": 0,
    "total": 0,
    "error": "",
    "updated_at": 0.0,
}
_DL_THREAD: threading.Thread | None = None
_CHECK_THREAD: threading.Thread | None = None
_CANCEL = threading.Event()
_LAST_STATUS_WRITE = 0.0
_TOKEN_CACHE: str | None = None


class _IntegrityError(Exception):
    """Plik niezgodny z wydaniem - kasujemy go (nie zostawiamy do wznowienia)."""


# --------------------------------------------------------------------------- wersje


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


# --------------------------------------------------------------------------- pliki / sekrety


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
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


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
    for path in (
        CONTENT_ROOT / ".env",
        DESKTOP_DIR / "dam-connection.env",
        DESKTOP_DIR / "data" / ".env",
        DESKTOP_DIR / "data" / "pg-config.env",
    ):
        _load_dotenv_file(path)


def _token_from_gh_cli() -> str:
    """Lokalny keyring `gh` (to samo konto co git). Nigdy nie loguje stdout."""
    try:
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
        proc = subprocess.run(
            ["gh", "auth", "token"],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
            creationflags=flags,
        )
        val = (proc.stdout or "").strip()
        if proc.returncode == 0 and val:
            return val
    except Exception:
        pass
    return ""


def _resolve_github_token() -> str:
    """Opcjonalny token (repo jest publiczne). Pusty string = zapytania anonimowe."""
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
    cfg: dict[str, Any] = {
        "github_repo": DEFAULT_REPO,
        "asset_name": DEFAULT_ASSET,
        "first_check_delay_sec": int(FIRST_CHECK_DELAY_SEC),
        "check_interval_hours": int(CHECK_INTERVAL_SEC // 3600),
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
    """DAM.exe + bin/ w jednym GIT_ROOT - bez instalatora, restart DAM.exe."""
    try:
        return (GIT_ROOT / ".git").is_dir() or (GIT_ROOT / ".git").is_file()
    except OSError:
        return False


# --------------------------------------------------------------------------- cache wersji


def version_dir(version: str) -> Path:
    """data/updates/<wersja>. Tylko kanoniczna wersja (bez ../ i innych sztuczek)."""
    v = _strip_v(version)
    if not is_canonical_product_version(v):
        raise ValueError("bad_version")
    return INSTALLER_DIR / v


def _cached_versions() -> list[str]:
    """Wersje z folderami w cache, od najnowszej."""
    out: list[str] = []
    try:
        for child in INSTALLER_DIR.iterdir():
            if child.is_dir() and is_canonical_product_version(child.name):
                out.append(child.name)
    except OSError:
        return []
    out.sort(key=version_to_int, reverse=True)
    return out


def _state_target() -> str:
    with _DL_LOCK:
        return str(_DL_STATE.get("target") or "")


def _default_version() -> str:
    tgt = _state_target()
    if tgt:
        return tgt
    cur = current_version()
    for v in _cached_versions():
        if is_newer(v, cur) and (version_dir(v) / DEFAULT_ASSET).is_file():
            return v
    return ""


def installer_path(version: str | None = None) -> Path:
    v = _strip_v(version) if version else _default_version()
    if not v or not is_canonical_product_version(v):
        return INSTALLER_DIR / DEFAULT_ASSET  # stara, plaska sciezka: nigdy nie uruchamiana
    return version_dir(v) / DEFAULT_ASSET


def sig_path(version: str | None = None) -> Path:
    exe = installer_path(version)
    return exe.with_name(exe.name + SIG_SUFFIX)


def _part_path(version: str) -> Path:
    exe = installer_path(version)
    return exe.with_name(exe.name + PART_SUFFIX)


def _remove_version_dir(version: str) -> None:
    """Kasuje tylko znane pliki updatera i pusty folder (bez rekurencji)."""
    try:
        folder = version_dir(version)
    except ValueError:
        return
    for name in (
        DEFAULT_ASSET,
        DEFAULT_ASSET + SIG_SUFFIX,
        DEFAULT_ASSET + PART_SUFFIX,
        DEFAULT_ASSET + SIG_SUFFIX + PART_SUFFIX,
    ):
        try:
            (folder / name).unlink(missing_ok=True)
        except OSError:
            pass
    try:
        folder.rmdir()
    except OSError:
        pass
    _VERIFY_CACHE.pop(str(folder), None)


def _remove_legacy_flat_files() -> None:
    for name in (DEFAULT_ASSET, DEFAULT_ASSET + SIG_SUFFIX, DEFAULT_ASSET + PART_SUFFIX):
        try:
            (INSTALLER_DIR / name).unlink(missing_ok=True)
        except OSError:
            pass


def _enforce_cache_limit(keep: str) -> None:
    """Najwyzej MAX_CACHED_VERSIONS folderow; `keep` zostaje zawsze."""
    keep = _strip_v(keep)
    others = [v for v in _cached_versions() if v != keep]
    room = MAX_CACHED_VERSIONS - (1 if keep else 0)
    for v in others[max(room, 0):]:
        _remove_version_dir(v)
    _remove_legacy_flat_files()


# --------------------------------------------------------------------------- weryfikacja

_VERIFY_CACHE: dict[str, Any] = {}


def verify_downloaded_installer(
    version: str | None = None, *, use_cache: bool = True
) -> tuple[bool, str]:
    """Podpis Ed25519 wydania (release_verify). Bez waznego podpisu instalator NIE rusza.

    Cache po (mtime, size) obu plikow - status w UI nie liczy SHA-256 z ~90 MB co sekunde.
    Start instalatora zawsze woła z use_cache=False (plik mogl zostac podmieniony).
    Wersja w podpisie musi byc rowna nazwie folderu (brak mieszania wersji w cache).
    """
    v = _strip_v(version) if version else _default_version()
    if not v or not is_canonical_product_version(v):
        return False, "installer_missing"
    exe, sig = installer_path(v), sig_path(v)
    try:
        if not exe.is_file() or exe.stat().st_size < MIN_INSTALLER_BYTES:
            return False, "installer_missing"
        if not sig.is_file():
            return False, "signature_missing"
        es, ss = exe.stat(), sig.stat()
        key = (es.st_mtime_ns, es.st_size, ss.st_mtime_ns, ss.st_size)
        ckey = str(exe.parent)
        cached = _VERIFY_CACHE.get(ckey)
        if use_cache and cached and cached[0] == key:
            return bool(cached[1]), str(cached[2])
        import release_verify

        sig_bytes = sig.read_bytes()
        ok, reason = release_verify.verify_installer(
            exe,
            sig_bytes,
            min_version_exclusive=parse_version(current_version()),
            parse_version=parse_version,
        )
        if ok:
            parsed = release_verify.parse_sig(sig_bytes) or {}
            if _strip_v(str(parsed.get("version") or "")) != v:
                ok, reason = False, "version_mismatch"
        _VERIFY_CACHE[ckey] = (key, ok, reason)
        return ok, reason
    except Exception:  # noqa: BLE001
        return False, "verify_error"


def installer_ready(version: str | None = None) -> bool:
    ok, _reason = verify_downloaded_installer(version)
    return ok


def _ready_version() -> str:
    """Najnowsza wersja z cache, nowsza od biezacej i z poprawnym podpisem."""
    cur = current_version()
    for v in _cached_versions():
        if is_newer(v, cur) and installer_ready(v):
            return v
    return ""


# --------------------------------------------------------------------------- URL


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


def _is_api_asset_url(url: str) -> bool:
    low = str(url or "").lower()
    return "api.github.com" in low and "/releases/assets/" in low


# --------------------------------------------------------------------------- harmonogram


def seconds_until_next_check(
    now: float, started_at: float, last_check_at: float | None
) -> float:
    """Czysta funkcja harmonogramu (zegar monotoniczny procesu).

    - jeszcze nie sprawdzano w tym procesie -> started_at + 20 s
    - potem -> ostatnie sprawdzenie + 6 h
    """
    if last_check_at is None:
        due = float(started_at) + FIRST_CHECK_DELAY_SEC
    else:
        due = float(last_check_at) + CHECK_INTERVAL_SEC
    return max(0.0, due - float(now))


# --------------------------------------------------------------------------- sprawdzanie


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
        "installer_ready": bool(_ready_version()) if not is_portable_repo() else False,
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
    portable = is_portable_repo()
    out = {
        "ok": ok,
        "current": cur,
        "latest": latest or cur,
        "github_latest": latest,
        "git_latest": _consider_remote(git_ver, cur),
        "latest_source": latest_source,
        "update_available": bool(ok and newer and setup_ok),
        "download_url": url if setup_ok else "",
        "release_notes": str(data.get("release_notes") or "")[:4000],
        "published_at": str(data.get("published_at") or ""),
        "checked_at": data.get("checked_at") or time.time(),
        "portable": portable,
        "update_mode": "restart_exe" if portable else "installer",
        "installer_ready": bool(_ready_version()) if not portable else False,
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
        try:
            out["size"] = int(data.get("size") or 0)
        except (TypeError, ValueError):
            out["size"] = 0
        sha = str(data.get("sha256") or "").strip().lower()
        out["sha256"] = sha if re.fullmatch(r"[0-9a-f]{64}", sha) else ""
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
        "size",
        "sha256",
        "error",
        "published_at",
    )
    last_result = {k: out[k] for k in keep_keys if k in out}
    checked = float(out.get("checked_at") or time.time())
    state.pop("next_run", None)
    state.update(
        {
            "last_check": checked,
            "next_check_after": checked + CHECK_INTERVAL_SEC,
            "last_result": last_result,
        }
    )
    _save_json(STATE_PATH, state)


def _github_headers(token: str, *, download: bool = False) -> dict[str, str]:
    headers = {
        "Accept": "application/octet-stream" if download else "application/vnd.github+json",
        "User-Agent": USER_AGENT,
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
    except TimeoutError as exc:
        raise TimeoutError("github_timeout") from exc
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("github_malformed") from exc


def _digest_sha256(asset: dict[str, Any]) -> str:
    digest = str(asset.get("digest") or "").strip()
    if digest.lower().startswith("sha256:"):
        val = digest.split(":", 1)[1].strip().lower()
        if re.fullmatch(r"[0-9a-f]{64}", val):
            return val
    return ""


def _pick_setup_asset(rel: dict[str, Any], asset_name: str) -> dict[str, Any] | None:
    """Wydanie jest aktualizacja tylko gdy ma OBA pliki: instalator i .sig."""
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
        try:
            size = int(asset.get("size") or 0)
        except (TypeError, ValueError):
            size = 0
        return {
            "download_url": url,
            "asset_api_url": api,
            "sig_url": sig_url,
            "sig_api_url": sig_api,
            "size": size,
            "sha256": _digest_sha256(asset),
        }
    return None


def _select_release(
    releases: list[Any], asset_name: str
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    stable: list[tuple[dict[str, Any], dict[str, Any]]] = []
    pre: list[tuple[dict[str, Any], dict[str, Any]]] = []
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

    def _semver_key(item: tuple[dict[str, Any], dict[str, Any]]) -> tuple[int, ...]:
        rel, _asset = item
        return parse_version(str(rel.get("tag_name") or rel.get("name") or ""))

    if stable:
        return max(stable, key=_semver_key)
    if pre:
        return max(pre, key=_semver_key)
    return None


def _perform_github_check(token: str) -> dict[str, Any]:
    """Repo publiczne: token opcjonalny. Zly token (401/403) -> ponow anonimowo."""
    out = _empty_result()
    cfg = load_update_config()
    repo = str(cfg.get("github_repo") or DEFAULT_REPO)
    asset_name = str(cfg.get("asset_name") or DEFAULT_ASSET)
    url = f"https://api.github.com/repos/{repo}/releases?per_page=15"
    try:
        try:
            payload = _github_get_json(url, token)
        except urllib.error.HTTPError as exc:
            if token and exc.code in (401, 403):
                payload = _github_get_json(url, "")
            else:
                raise
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
    out.update(asset)
    out["ok"] = True
    return _public_result(out)


def check_for_updates(
    force: bool = False, *, token: str | None = None, auto_download: bool = True
) -> dict[str, Any]:
    """force=True: harmonogram, Ustawienia, /app-update/check?force=1.

    Bez force: zwroc cache (przefiltrowany). Nigdy nie udawaj update.
    token=None -> sekret z plikow (moze byc pusty); token="" -> anonimowo.
    Nowsze podpisane wydanie + auto_download -> pobieranie w tle startuje samo.
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

    portable = is_portable_repo()
    if not portable:
        _set_state_if_quiet(status="checking", error="")
    try:
        tok = _resolve_github_token() if token is None else str(token or "")
        out = _perform_github_check(tok)
        _persist_attempt(out)
    finally:
        if not portable:
            _set_state_if_quiet(expect="checking", status="idle")
    if not portable and auto_download and out.get("update_available"):
        rel = _release_from_result(out)
        if rel:
            _start_download(rel)
    return out


# --------------------------------------------------------------------------- stan pobierania


def _status_file() -> Path:
    return INSTALLER_DIR / "download-status.json"


def _lock_file() -> Path:
    return INSTALLER_DIR / ".download.lock"


def _cancel_file() -> Path:
    return INSTALLER_DIR / ".cancel"


def _marker_path() -> Path:
    return INSTALLER_DIR / "pending_success.json"


def _write_status_file(snap: dict[str, Any]) -> None:
    """Stan dzielony miedzy procesami (launch.py i mostek maja wlasne harmonogramy)."""
    global _LAST_STATUS_WRITE
    try:
        payload = {k: snap.get(k) for k in ("status", "target", "bytes", "total", "error", "updated_at")}
        payload["pid"] = os.getpid()
        _save_json(_status_file(), payload)
        _LAST_STATUS_WRITE = time.monotonic()
    except Exception:
        pass


def _set_state(*, persist: bool = True, **kw: Any) -> None:
    with _DL_LOCK:
        _DL_STATE.update(kw)
        _DL_STATE["updated_at"] = time.time()
        snap = dict(_DL_STATE)
    if persist:
        _write_status_file(snap)


def _set_state_if_quiet(*, expect: str | None = None, **kw: Any) -> None:
    """Nie nadpisuj trwajacego pobierania statusem 'checking'/'idle'."""
    with _DL_LOCK:
        cur = str(_DL_STATE.get("status") or "idle")
    if expect is not None and cur != expect:
        return
    if expect is None and cur in ("downloading", "verifying"):
        return
    _set_state(**kw)


def _set_progress(received: int, total: int, *, force: bool = False) -> None:
    with _DL_LOCK:
        _DL_STATE["bytes"] = int(received)
        _DL_STATE["total"] = int(total)
        _DL_STATE["updated_at"] = time.time()
        snap = dict(_DL_STATE)
    if force or time.monotonic() - _LAST_STATUS_WRITE >= PROGRESS_WRITE_INTERVAL_SEC:
        _write_status_file(snap)
        _touch_lock()


def _read_status_file() -> dict[str, Any] | None:
    try:
        data = json.loads(_status_file().read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def download_status() -> dict[str, Any]:
    """KONTRAKT dla UI (GET /app-update/status) - dokladnie te klucze."""
    cur = current_version()
    portable = is_portable_repo()
    try:
        auto_check = bool(load_prefs().get("auto_check", True))
    except Exception:
        auto_check = True
    out: dict[str, Any] = {
        "ok": True,
        "status": "idle",
        "current": cur,
        "target": "",
        "bytes": 0,
        "total": 0,
        "pct": 0,
        "error": "",
        "installer_ready": False,
        "portable": portable,
        "auto_check": auto_check,
    }
    if portable:
        return out
    with _DL_LOCK:
        st = dict(_DL_STATE)
    shared = _read_status_file()
    if (
        shared
        and int(shared.get("pid") or 0) != os.getpid()
        and float(shared.get("updated_at") or 0) > float(st.get("updated_at") or 0)
    ):
        st = dict(shared)
        if (
            str(st.get("status")) in ("checking", "downloading", "verifying")
            and time.time() - float(st.get("updated_at") or 0) > STATUS_STALE_SEC
        ):
            st = {"status": "idle"}  # proces, ktory pobieral, juz nie zyje
    status = str(st.get("status") or "idle")
    if status not in ("idle", "checking", "downloading", "verifying", "ready", "error"):
        status = "idle"
    target = _strip_v(str(st.get("target") or ""))
    nbytes = int(st.get("bytes") or 0)
    total = int(st.get("total") or 0)
    error = str(st.get("error") or "")
    ready_v = ""
    if status in ("idle", "ready"):
        ready_v = _ready_version()
        if ready_v:
            status, target = "ready", ready_v
            try:
                nbytes = total = installer_path(ready_v).stat().st_size
            except OSError:
                pass
        elif status == "ready":
            status, target, nbytes, total = "idle", "", 0, 0
        if status == "idle":
            error = ""
    pct = int(nbytes * 100 / total) if total > 0 else 0
    out.update(
        {
            "ok": status != "error",
            "status": status,
            "target": target if status != "idle" else "",
            "bytes": nbytes if status != "idle" else 0,
            "total": total if status != "idle" else 0,
            "pct": max(0, min(100, pct)) if status != "idle" else 0,
            "error": error if status == "error" else "",
            "installer_ready": bool(ready_v),
        }
    )
    return out


# --------------------------------------------------------------------------- pobieranie


def _acquire_lock() -> bool:
    """Blokada miedzyprocesowa (O_EXCL). Martwa blokada (brak heartbeatu) jest przejmowana."""
    path = _lock_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    for _ in range(2):
        try:
            fd = os.open(str(path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            try:
                os.write(fd, str(os.getpid()).encode("ascii"))
            finally:
                os.close(fd)
            return True
        except FileExistsError:
            try:
                age = time.time() - path.stat().st_mtime
            except OSError:
                continue
            if age <= LOCK_STALE_SEC:
                return False
            try:
                path.unlink(missing_ok=True)
            except OSError:
                return False
        except OSError:
            return False
    return False


def _touch_lock() -> None:
    try:
        os.utime(str(_lock_file()), None)
    except OSError:
        pass


def _release_lock() -> None:
    try:
        _lock_file().unlink(missing_ok=True)
    except OSError:
        pass


def _cancel_requested() -> bool:
    if _CANCEL.is_set():
        return True
    try:
        return _cancel_file().is_file()
    except OSError:
        return False


def _release_from_result(chk: dict[str, Any]) -> dict[str, Any] | None:
    """Tylko dane z odpowiedzi API (nigdy URL podany z UI)."""
    if not chk.get("update_available"):
        return None
    v = _strip_v(str(chk.get("latest") or ""))
    if not is_newer(v, current_version()):
        return None
    exe_url = str(chk.get("download_url") or "")
    sig_url = str(chk.get("sig_url") or "")
    if not _is_setup_download_url(exe_url) or not _is_github_https(sig_url):
        return None
    api = str(chk.get("asset_api_url") or "")
    sig_api = str(chk.get("sig_api_url") or "")
    try:
        size = int(chk.get("size") or 0)
    except (TypeError, ValueError):
        size = 0
    return {
        "version": v,
        "exe_url": exe_url,
        "exe_api_url": api if _is_github_https(api) else "",
        "sig_url": sig_url,
        "sig_api_url": sig_api if _is_github_https(sig_api) else "",
        "size": max(size, 0),
        "sha256": str(chk.get("sha256") or "").lower(),
    }


def _candidates(public_url: str, api_url: str, token: str) -> list[tuple[str, str]]:
    """Najpierw publiczny URL bez tokenu; API z tokenem tylko jako zapas."""
    out: list[tuple[str, str]] = []
    if _is_github_https(public_url):
        out.append((public_url, ""))
    if token and _is_github_https(api_url):
        out.append((api_url, token))
    return out


def _download_signature(release: dict[str, Any], token: str, dest: Path) -> None:
    last_exc: Exception | None = None
    for url, tok in _candidates(release.get("sig_url", ""), release.get("sig_api_url", ""), token):
        req = urllib.request.Request(
            url, headers=_github_headers(tok, download=_is_api_asset_url(url))
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read(MAX_SIG_BYTES + 1)
        except urllib.error.HTTPError as exc:
            last_exc = exc
            continue
        if not data or len(data) > MAX_SIG_BYTES:
            raise _IntegrityError("signature_size")
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + PART_SUFFIX)
        tmp.write_bytes(data)
        tmp.replace(dest)
        return
    raise last_exc or OSError("bad_signature_url")


def _stream_to_part(url: str, token: str, part: Path, size: int) -> bool:
    """Jedno zadanie HTTP; dopisuje do .part (Range). False = anulowano."""
    existing = part.stat().st_size if part.is_file() else 0
    headers = _github_headers(token, download=_is_api_asset_url(url))
    if existing > 0:
        headers["Range"] = f"bytes={existing}-"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        code = getattr(resp, "status", None) or 200
        total = size
        if code == 206:
            content_range = str(resp.headers.get("Content-Range") or "")
            tail = content_range.rsplit("/", 1)[-1] if "/" in content_range else ""
            if tail.isdigit():
                total = int(tail)
        else:
            existing = 0  # serwer zignorowal Range: zaczynamy od zera
            length = str(resp.headers.get("Content-Length") or "")
            if not total and length.isdigit():
                total = int(length)
        received = existing
        _set_progress(received, total or received, force=True)
        with part.open("ab" if existing > 0 else "wb") as fh:
            while True:
                if _cancel_requested():
                    _set_progress(received, total or received, force=True)
                    return False
                chunk = resp.read(DOWNLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                fh.write(chunk)
                received += len(chunk)
                _set_progress(received, total or received)
    _set_progress(received, total or received, force=True)
    return True


def _download_installer_part(release: dict[str, Any], token: str, part: Path) -> bool:
    size = int(release.get("size") or 0)
    existing = part.stat().st_size if part.is_file() else 0
    if size and existing > size:
        part.unlink(missing_ok=True)
        existing = 0
    if size and existing == size:
        _set_progress(existing, size, force=True)
        return True
    last_exc: Exception | None = None
    for url, tok in _candidates(release.get("exe_url", ""), release.get("exe_api_url", ""), token):
        for _attempt in range(2):
            try:
                return _stream_to_part(url, tok, part, size)
            except urllib.error.HTTPError as exc:
                last_exc = exc
                if exc.code == 416 and part.is_file():
                    part.unlink(missing_ok=True)  # zly zakres: od nowa, raz
                    continue
                break
    raise last_exc or OSError("bad_download_url")


def _download_worker(release: dict[str, Any]) -> None:
    import release_verify

    v = str(release["version"])
    if not _acquire_lock():
        # Drugi proces juz pobiera - jego stan widac przez download-status.json.
        _set_state(persist=False, status="idle", target="", bytes=0, total=0, error="")
        return
    try:
        try:
            _cancel_file().unlink(missing_ok=True)
        except OSError:
            pass
        _set_state(status="downloading", target=v, error="")
        folder = version_dir(v)
        folder.mkdir(parents=True, exist_ok=True)
        exe, sig, part = installer_path(v), sig_path(v), _part_path(v)
        if exe.is_file() and verify_downloaded_installer(v, use_cache=False)[0]:
            _set_state(status="ready", target=v, error="")
            _enforce_cache_limit(v)
            return
        token = _resolve_github_token()
        _download_signature(release, token, sig)
        if _cancel_requested() or not _download_installer_part(release, token, part):
            _set_state(status="idle", target="", bytes=0, total=0, error="")
            return
        _set_state(status="verifying")
        _touch_lock()
        actual = part.stat().st_size
        size = int(release.get("size") or 0)
        if size and actual != size:
            raise _IntegrityError("size_mismatch")
        if actual < MIN_INSTALLER_BYTES:
            raise _IntegrityError("installer_too_small")
        want = str(release.get("sha256") or "")
        if want and release_verify.file_sha256(part).lower() != want:
            raise _IntegrityError("sha256_mismatch")
        _touch_lock()
        part.replace(exe)
        ok, reason = verify_downloaded_installer(v, use_cache=False)
        if not ok:
            raise _IntegrityError("signature_" + reason)
        _set_state(status="ready", target=v, bytes=actual, total=actual, error="")
        _enforce_cache_limit(v)
    except _IntegrityError as exc:
        # Podmieniony / uszkodzony plik nie zostaje na dysku ani sekundy dluzej.
        _remove_version_dir(v)
        _set_state(status="error", target=v, bytes=0, total=0, error=str(exc))
    except Exception:  # noqa: BLE001
        # Siec / dysk: .part zostaje do wznowienia przy nastepnej probie.
        _set_state(status="error", target=v, error="download_failed")
    finally:
        _release_lock()


def _start_download(release: dict[str, Any]) -> dict[str, Any]:
    global _DL_THREAD
    if is_portable_repo():
        return download_status()
    v = str(release.get("version") or "")
    if not is_newer(v, current_version()):
        return download_status()
    with _DL_LOCK:
        running = _DL_THREAD is not None and _DL_THREAD.is_alive()
    if running:
        return download_status()
    if installer_ready(v):
        _set_state(status="ready", target=v, error="")
        return download_status()
    _CANCEL.clear()
    # persist=False: plik stanu dzielonego zapisuje dopiero watek po zdobyciu blokady.
    _set_state(
        persist=False, status="downloading", target=v, bytes=0, total=int(release.get("size") or 0), error=""
    )
    t = threading.Thread(target=_download_worker, args=(release,), name="dam-update-dl", daemon=True)
    with _DL_LOCK:
        _DL_THREAD = t
    t.start()
    return download_status()


def _background_check() -> None:
    try:
        check_for_updates(force=True)
    except Exception:
        _set_state_if_quiet(status="idle")


def _action_download() -> dict[str, Any]:
    global _CHECK_THREAD
    rel = _release_from_result(check_for_updates(force=False))
    if rel:
        return _start_download(rel)
    with _DL_LOCK:
        busy = _CHECK_THREAD is not None and _CHECK_THREAD.is_alive()
    if not busy:
        _set_state_if_quiet(status="checking", error="")
        t = threading.Thread(target=_background_check, name="dam-update-check-now", daemon=True)
        with _DL_LOCK:
            _CHECK_THREAD = t
        t.start()
    return download_status()


def _action_cancel() -> dict[str, Any]:
    _CANCEL.set()
    shared = _read_status_file() or {}
    if str(shared.get("status")) in ("downloading", "verifying") and int(shared.get("pid") or 0) != os.getpid():
        try:
            _cancel_file().parent.mkdir(parents=True, exist_ok=True)
            _cancel_file().write_text("1", encoding="utf-8")
        except OSError:
            pass
    return download_status()


# --------------------------------------------------------------------------- instalacja


def mark_pending_success(target_version: str) -> None:
    _save_json(_marker_path(), {"target_version": _strip_v(target_version), "created_at": time.time()})


def consume_success_marker() -> dict[str, Any]:
    """{"ok": True, "version": "2.1.0"} dokladnie raz po udanej aktualizacji, inaczej version None.

    Znacznik z inna wersja jest kasowany po cichu. Wyjatek: znacznik NOWSZEJ wersji mlodszy
    niz MARKER_GRACE_SEC (instalator wlasnie pracuje, stary proces jeszcze zyje) zostaje.
    """
    path = _marker_path()
    if not path.is_file():
        return {"ok": True, "version": None}
    target = ""
    created = 0.0
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            target = _strip_v(str(data.get("target_version") or ""))
            created = float(data.get("created_at") or 0)
    except Exception:
        target = ""
    cur = current_version()
    if target and is_newer(target, cur):
        stamp = created or path.stat().st_mtime
        if time.time() - stamp < MARKER_GRACE_SEC:
            return {"ok": True, "version": None}
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass
    if target and target == _strip_v(cur):
        return {"ok": True, "version": target}
    return {"ok": True, "version": None}


def _launch_installer(path: Path) -> dict[str, Any]:
    """Uruchamia TYLKO data/updates/<wersja>/DAM-Setup.exe z waznym podpisem (bez cache)."""
    try:
        resolved = Path(path).resolve()
        root = INSTALLER_DIR.resolve()
    except OSError:
        return {"ok": False, "error": "installer_path_forbidden"}
    v = resolved.parent.name
    if (
        resolved.name != DEFAULT_ASSET
        or resolved.parent.parent != root
        or not is_canonical_product_version(v)
    ):
        return {"ok": False, "error": "installer_path_forbidden"}
    if not resolved.is_file():
        return {"ok": False, "error": "installer_missing"}
    if not is_newer(v, current_version()):
        return {"ok": False, "error": "version_not_newer"}
    # Swiezo liczone (bez cache): katalog data/updates jest zapisywalny dla usera,
    # wiec plik mogl zostac podmieniony miedzy pobraniem a kliknieciem "Zainstaluj".
    ok, reason = verify_downloaded_installer(v, use_cache=False)
    if not ok:
        _remove_version_dir(v)
        _set_state(status="error", target=v, bytes=0, total=0, error="signature_" + reason)
        return {"ok": False, "error": "signature_" + reason}
    mark_pending_success(v)
    args = [str(resolved), *INSTALLER_ARGS]
    try:
        flags = 0
        if sys.platform == "win32":
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) | getattr(
                subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200
            )
        subprocess.Popen(
            args,
            cwd=str(resolved.parent),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=flags,
            close_fds=True,
        )
    except Exception as exc:  # noqa: BLE001
        try:
            _marker_path().unlink(missing_ok=True)
        except OSError:
            pass
        return {"ok": False, "error": "launch_failed", "detail": type(exc).__name__}
    return {"ok": True, "launched": True, "target": v}


def _action_install() -> dict[str, Any]:
    v = ""
    tgt = _state_target()
    if tgt and is_newer(tgt, current_version()) and installer_path(tgt).is_file():
        v = tgt
    if not v:
        v = _ready_version()
    if not v:
        return {"ok": False, "error": "not_ready"}
    return _launch_installer(installer_path(v))


def apply_action(action: str, download_url: str = "") -> dict[str, Any]:
    """KONTRAKT dla mostka (POST /app-update/apply).

    download -> pobieranie w tle (URL zawsze z odpowiedzi GitHub API, `download_url`
                z UI jest ignorowany - zgodnosc wsteczna),
    install / apply -> ponowna weryfikacja podpisu, znacznik, cichy instalator,
    cancel -> przerwij pobieranie (.part zostaje do wznowienia), zwraca status.
    """
    _ = download_url
    act = str(action or "").strip().lower()
    if act == "cancel":
        return _action_cancel()
    if act not in ("download", "install", "apply"):
        return {"ok": False, "error": "unknown_action"}
    if is_portable_repo():
        return {"ok": False, "error": "portable_skip", "portable": True, "status": "idle"}
    if act == "download":
        return _action_download()
    return _action_install()


# Zgodnosc wsteczna ze starszymi wywolaniami mostka.
def start_background_download(download_url: str = "") -> dict[str, Any]:
    return apply_action("download", download_url)


def install_downloaded(download_url: str = "") -> dict[str, Any]:
    return apply_action("install", download_url)


def download_and_launch_installer(download_url: str = "") -> dict[str, Any]:
    if not is_portable_repo() and _ready_version():
        return apply_action("install", download_url)
    return apply_action("download", download_url)


# --------------------------------------------------------------------------- watek harmonogramu


def _scheduler_loop() -> None:
    started = time.monotonic()
    last_check: float | None = None
    while True:
        delay = seconds_until_next_check(time.monotonic(), started, last_check)
        if delay > 0:
            time.sleep(min(delay, 30.0))
            continue
        if not load_prefs().get("auto_check", True):
            time.sleep(60.0)
            continue
        last_check = time.monotonic()
        try:
            check_for_updates(force=True)
        except Exception:
            try:
                _persist_attempt(_empty_result("github_error"))
            except Exception:
                pass


def ensure_scheduler_started() -> None:
    """Jeden watek na proces. Dwa procesy nie pobieraja naraz: blokada .download.lock."""
    global _SCHEDULER_STARTED
    with _LOCK:
        if _SCHEDULER_STARTED:
            return
        t = threading.Thread(target=_scheduler_loop, name="dam-update-check", daemon=True)
        t.start()
        _SCHEDULER_STARTED = True
