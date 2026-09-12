"""Shared runtime ports and paths for DAM desktop app."""
from __future__ import annotations

import json
import os
import socket
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = DESKTOP_DIR.parent / "web"
# Layout: GIT_ROOT (DAM.exe + .git) / bin = CONTENT_ROOT (apps, THEME, runtime, …)
# Primary 2026-08-05+: D:\\...\\DAM---Dobra-Kaloria---inyfinn (nie P:\\DAM).
CONTENT_ROOT = DESKTOP_DIR.parent.parent
GIT_ROOT = CONTENT_ROOT.parent
# Back-compat alias: content tree (not .git location after bin/ layout)
REPO_ROOT = CONTENT_ROOT
DEFAULT_UI_PORT = 8765
DEFAULT_BRIDGE_PORT = 8766
HOST = "127.0.0.1"
APP_TITLE = "DAM - Dobra Kaloria - Inyfinn"
APP_VERSION = "5.0.204"  # sync z apps/web/version.json + dam-version.js
MUTEX_NAME = "Global\\DAM_DOBRA_KALORIA_INYFINN_SINGLE_INSTANCE"


def pick_free_port(preferred: int) -> int:
    for port in (preferred, preferred + 1, preferred + 2, preferred + 10, 0):
        candidate = port if port else 0
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((HOST, candidate))
                return int(sock.getsockname()[1])
            except OSError:
                continue
    raise RuntimeError("No free TCP port for DAM runtime")


def runtime_payload(ui_port: int, bridge_port: int) -> dict:
    origin = f"http://{HOST}:{ui_port}"
    identity: dict = {}
    try:
        from machine_identity import collect_identity

        identity = collect_identity()
    except Exception:
        identity = {}
    return {
        "app": "dam-eta",
        "host": HOST,
        "ui_port": ui_port,
        "bridge_port": bridge_port,
        "ui_origin": origin,
        "bridge": f"http://{HOST}:{bridge_port}",
        "start_url": f"{origin}/dashboard.html",
        "machine_id": identity.get("machine_id") or "",
        "device_id": identity.get("device_id") or "",
        "windows_user": identity.get("windows_user") or "",
        "hostname": identity.get("hostname") or "",
    }


def write_runtime_file(ui_port: int, bridge_port: int) -> Path:
    path = WEB_ROOT / "data" / "dam-runtime.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(runtime_payload(ui_port, bridge_port), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return path


def env_for_bridge(ui_port: int, bridge_port: int) -> dict:
    origin = f"http://{HOST}:{ui_port}"
    env = os.environ.copy()
    env["DAM_BRIDGE_PORT"] = str(bridge_port)
    env["DAM_UI_ORIGIN"] = origin
    env["DAM_WEB_ROOT"] = str(WEB_ROOT)
    env["PYTHONUTF8"] = "1"
    return env

