#!/usr/bin/env python3
"""Contract test: ipc_names.json matches Go defaults and runtime_config."""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
IPC_PATH = REPO / "apps" / "desktop" / "ipc_names.json"

REQUIRED_KEYS = {
    "aumid",
    "mutex_bootstrap",
    "mutex_engine",
    "env_handshake_pipe",
    "env_handshake_nonce",
    "exit_bypass_without_handshake",
    "engine_exe_name",
    "runtime_python_rel",
}


def main() -> int:
    if not IPC_PATH.is_file():
        print(f"FAIL missing {IPC_PATH}")
        return 1
    data = json.loads(IPC_PATH.read_text(encoding="utf-8"))
    missing = REQUIRED_KEYS - set(data.keys())
    if missing:
        print(f"FAIL missing keys: {sorted(missing)}")
        return 1
    if data.get("aumid") != "Inyfinn.DAM.DobraKaloria.1":
        print("FAIL aumid mismatch")
        return 1
    if int(data.get("exit_bypass_without_handshake", 0)) != 17:
        print("FAIL exit code must be 17")
        return 1
    if not str(data.get("mutex_bootstrap", "")).startswith("Local\\"):
        print("FAIL mutex_bootstrap must use Local\\ prefix")
        return 1
    print("PASS ipc_names contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
