# -*- coding: utf-8 -*-
"""Sprawdzanie aktualizacji DAM z GitHub Releases (jak Inyfinn Photo Resizer)."""
from __future__ import annotations

import json
import re
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = DESKTOP_DIR.parent / "web"
VERSION_JSON = WEB_ROOT / "version.json"
STATE_PATH = DESKTOP_DIR / "data" / "update-check-state.json"
PREFS_PATH = DESKTOP_DIR / "data" / "update-prefs.json"

DEFAULT_REPO = "inyfinn/DAM---Dobra-Kaloria---inyfinn"
DEFAULT_ASSET = "DAM-Setup.exe"
CHECK_INTERVAL_SEC = 5 * 3600
_STARTUP_DELAY_SEC = 60

_LOCK = threading.Lock()
_SCHEDULER_STARTED = False


def _parse_version(raw: str) -> tuple[int, ...]:
    parts = re.findall(r"\d+", str(raw or "0"))
    return tuple(int(p) for p in parts) if parts else (0,)


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


def load_update_config() -> dict[str, Any]:
    cfg = {
        "github_repo": DEFAULT_REPO,
        "asset_name": DEFAULT_ASSET,
        "check_interval_hours": 5,
    }
    try:
        if VERSION_JSON.is_file():
            vj = json.loads(VERSION_JSON.read_text(encoding="utf-8"))
            upd = vj.get("updates") if isinstance(vj, dict) else None
            if isinstance(upd, dict):
                cfg.update({k: v for k, v in upd.items() if v})
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


def _github_latest(repo: str) -> dict[str, Any]:
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "DAM-Dobra-Kaloria-Updater",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def check_for_updates(force: bool = False) -> dict[str, Any]:
    cfg = load_update_config()
    repo = str(cfg.get("github_repo") or DEFAULT_REPO)
    asset_name = str(cfg.get("asset_name") or DEFAULT_ASSET)
    cur = current_version()
    out: dict[str, Any] = {
        "ok": True,
        "current": cur,
        "latest": cur,
        "update_available": False,
        "download_url": "",
        "release_notes": "",
        "published_at": "",
        "checked_at": time.time(),
    }
    try:
        rel = _github_latest(repo)
        tag = str(rel.get("tag_name") or rel.get("name") or "").lstrip("vV")
        out["latest"] = tag or cur
        out["release_notes"] = str(rel.get("body") or "")[:4000]
        out["published_at"] = str(rel.get("published_at") or "")
        assets = rel.get("assets") if isinstance(rel.get("assets"), list) else []
        for asset in assets:
            if not isinstance(asset, dict):
                continue
            if str(asset.get("name") or "") == asset_name:
                out["download_url"] = str(asset.get("browser_download_url") or "")
                break
        if not out["download_url"]:
            html_url = str(rel.get("html_url") or "")
            if html_url:
                out["download_url"] = html_url
        out["update_available"] = _parse_version(out["latest"]) > _parse_version(cur)
    except urllib.error.HTTPError as exc:
        out["ok"] = False
        out["error"] = f"github_http_{exc.code}"
    except Exception as exc:  # noqa: BLE001
        out["ok"] = False
        out["error"] = str(exc)

    if out["ok"] or force:
        state = _load_json(STATE_PATH, {})
        state.update(
            {
                "last_check": out["checked_at"],
                "last_result": {
                    k: out[k]
                    for k in (
                        "current",
                        "latest",
                        "update_available",
                        "download_url",
                        "error",
                    )
                    if k in out
                },
            }
        )
        _save_json(STATE_PATH, state)
    return out


def download_and_launch_installer(download_url: str) -> dict[str, Any]:
    import subprocess
    import sys

    if not download_url:
        return {"ok": False, "error": "missing_download_url"}
    tmp = DESKTOP_DIR / "data" / "updates"
    tmp.mkdir(parents=True, exist_ok=True)
    target = tmp / DEFAULT_ASSET
    try:
        req = urllib.request.Request(download_url, headers={"User-Agent": "DAM-Dobra-Kaloria-Updater"})
        with urllib.request.urlopen(req, timeout=120) as resp, target.open("wb") as fh:
            while True:
                chunk = resp.read(1024 * 256)
                if not chunk:
                    break
                fh.write(chunk)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}

    try:
        if sys.platform == "win32":
            subprocess.Popen([str(target)], shell=True)
        else:
            subprocess.Popen([str(target)])
        return {"ok": True, "path": str(target)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def _scheduler_loop() -> None:
    time.sleep(_STARTUP_DELAY_SEC)
    while True:
        prefs = load_prefs()
        if prefs.get("auto_check", True):
            try:
                check_for_updates()
            except Exception:
                pass
        time.sleep(CHECK_INTERVAL_SEC)


def ensure_scheduler_started() -> None:
    global _SCHEDULER_STARTED
    with _LOCK:
        if _SCHEDULER_STARTED:
            return
        t = threading.Thread(target=_scheduler_loop, name="dam-update-check", daemon=True)
        t.start()
        _SCHEDULER_STARTED = True
