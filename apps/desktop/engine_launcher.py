"""
Internal engine entry (dam-appw.exe). Must be started by Go bootstrap with handshake env.
Direct double-click without handshake -> exit 17 before any mutex.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

APP_TITLE = "DAM - Dobra Kaloria - Inyfinn"
EXIT_BYPASS = 17
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)


def _git_root() -> Path:
    env_root = os.environ.get("DAM_GIT_ROOT", "").strip()
    if env_root:
        p = Path(env_root)
        if p.is_dir():
            return p.resolve()
    if getattr(sys, "frozen", False):
        # .../bin/runtime/win/dam-app/dam-appw.exe -> GIT_ROOT = parents[4]
        return Path(sys.executable).resolve().parents[4]
    return Path(__file__).resolve().parents[3]


def _load_ipc() -> dict:
    root = _git_root()
    path = root / "bin" / "apps" / "desktop" / "ipc_names.json"
    if not path.is_file():
        path = root / "apps" / "desktop" / "ipc_names.json"
    if path.is_file():
        import json

        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "env_handshake_pipe": "DAM_HANDSHAKE_PIPE",
        "env_handshake_nonce": "DAM_HANDSHAKE_NONCE",
        "exit_bypass_without_handshake": EXIT_BYPASS,
    }


def _message(text: str) -> None:
    if sys.platform == "win32":
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(0, text, APP_TITLE, 0x40)
            return
        except Exception:
            pass
    print(f"{APP_TITLE}: {text}", file=sys.stderr)


def _verify_handshake(ipc: dict) -> None:
    pipe_key = str(ipc.get("env_handshake_pipe") or "DAM_HANDSHAKE_PIPE")
    nonce_key = str(ipc.get("env_handshake_nonce") or "DAM_HANDSHAKE_NONCE")
    pipe = os.environ.get(pipe_key, "").strip()
    nonce = os.environ.get(nonce_key, "").strip()
    if not pipe or not nonce:
        _message(
            "Nie uruchamiaj silnika bezposrednio.\n\n"
            "Uzyj skrotu DAM.exe na pulpicie."
        )
        raise SystemExit(int(ipc.get("exit_bypass_without_handshake") or EXIT_BYPASS))
    if sys.platform == "win32":
        try:
            import ctypes

            kernel32 = ctypes.windll.kernel32
            GENERIC_WRITE = 0x40000000
            OPEN_EXISTING = 3
            INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value
            handle = kernel32.CreateFileW(
                pipe,
                GENERIC_WRITE,
                0,
                None,
                OPEN_EXISTING,
                0,
                None,
            )
            if handle == INVALID_HANDLE_VALUE or handle is None:
                raise OSError("pipe open failed")
            try:
                payload = b"OK\n"
                written = ctypes.c_uint32(0)
                ok = kernel32.WriteFile(
                    handle,
                    payload,
                    len(payload),
                    ctypes.byref(written),
                    None,
                )
                if not ok:
                    raise OSError("pipe write failed")
            finally:
                kernel32.CloseHandle(handle)
        except Exception as exc:
            _message(f"Handshake nieudany: {exc}")
            raise SystemExit(1) from exc


def _find_pythonw(root: Path) -> str | None:
    bundled = root / "bin" / "runtime" / "win" / "python" / "pythonw.exe"
    if bundled.is_file():
        return str(bundled)
    return None


def main() -> int:
    ipc = _load_ipc()
    _verify_handshake(ipc)
    root = _git_root()
    launch_py = root / "bin" / "apps" / "desktop" / "launch.py"
    if not launch_py.is_file():
        _message(f"Brak launch.py:\n{launch_py}")
        return 1
    pyw = _find_pythonw(root)
    if not pyw:
        _message(
            "Brak silnika w folderze aplikacji.\n\n"
            f"Oczekiwany:\n{root / 'bin' / 'runtime' / 'win' / 'python' / 'pythonw.exe'}"
        )
        return 1
    env = os.environ.copy()
    env["DAM_GIT_ROOT"] = str(root)
    env["DAM_ENGINE_LAUNCHED"] = "1"
    runtime_root = root / "bin" / "runtime" / "win" / "python"
    if runtime_root.is_dir():
        env["DAM_RUNTIME_PYTHON"] = str(runtime_root)
        env.pop("PYTHONHOME", None)
    flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
    subprocess.Popen(
        [pyw, str(launch_py)],
        cwd=str(launch_py.parent),
        env=env,
        close_fds=True,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
        | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)
        | flags,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
