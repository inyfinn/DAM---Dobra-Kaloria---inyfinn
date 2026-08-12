"""
Thin root launcher for DAM.exe (PyInstaller).

Resolves GIT_ROOT = directory containing this executable (or this script in
dev), then starts bundled pythonw on bin\\apps\\desktop\\launch.py.

Portable HARD: prefer bin/runtime/win/python/pythonw.exe only.
System Python only when DAM_ALLOW_SYSTEM_PYTHON=1 (dev).
"""
from __future__ import annotations

import os
import subprocess
import sys
import webbrowser
from pathlib import Path


APP_TITLE = "DAM - Dobra Kaloria - Inyfinn"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)


def _git_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    # Dev: .../bin/apps/desktop/dam_root_launcher.py -> parents[3] = GIT_ROOT
    return Path(__file__).resolve().parents[3]


def _heal_html(root: Path) -> Path:
    return root / "bin" / "apps" / "desktop" / "boot-heal.html"


def _open_heal(root: Path, reason: str) -> None:
    html = _heal_html(root)
    if html.is_file():
        # file:/// with query for reason
        uri = html.resolve().as_uri() + "?reason=" + reason.replace(" ", "%20")
        try:
            webbrowser.open(uri)
            return
        except Exception:
            pass
    _message(_heal_text(reason, root))


def _heal_text(reason: str, root: Path) -> str:
    runtime = root / "bin" / "runtime" / "win" / "python" / "pythonw.exe"
    if reason == "missing_runtime":
        return (
            "Brak silnika w folderze aplikacji.\n\n"
            f"Oczekiwany plik:\n{runtime}\n\n"
            "Skopiuj kompletny folder DAM (z bin\\runtime\\win) albo skontaktuj sie z IT.\n"
            "Nie trzeba instalowac Pythona."
        )
    if reason == "missing_launch":
        return (
            "Uszkodzona instalacja: brak launch.py.\n\n"
            f"Szukano w:\n{root / 'bin' / 'apps' / 'desktop' / 'launch.py'}"
        )
    if reason == "webview2":
        return (
            "Brak Microsoft Edge WebView2 Runtime.\n\n"
            "Pobierz Evergreen Bootstrapper (bez uprawnien admina w wiekszosci firm):\n"
            "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
        )
    return f"Nie udalo sie uruchomic DAM.\nPowod: {reason}"


def _message(text: str) -> None:
    if sys.platform == "win32":
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(0, text, APP_TITLE, 0x40)
            return
        except Exception:
            pass
    print(f"{APP_TITLE}: {text}", file=sys.stderr)


def _find_pythonw(root: Path) -> str | None:
    bundled = root / "bin" / "runtime" / "win" / "python" / "pythonw.exe"
    try:
        if bundled.is_file():
            return str(bundled)
    except OSError:
        pass

    if os.environ.get("DAM_ALLOW_SYSTEM_PYTHON", "").strip() in ("1", "true", "yes"):
        candidates: list[Path] = []
        local = os.environ.get("LocalAppData") or ""
        if local:
            for ver in ("Python314", "Python313", "Python312", "Python311"):
                candidates.append(Path(local) / "Programs" / "Python" / ver / "pythonw.exe")
        for c in (
            Path(r"C:\Python314\pythonw.exe"),
            Path(r"C:\Python313\pythonw.exe"),
            Path(r"C:\Python312\pythonw.exe"),
            Path(r"C:\Python311\pythonw.exe"),
        ):
            candidates.append(c)
        exe = Path(sys.executable)
        if exe.name.lower() in ("python.exe", "pythonw.exe"):
            candidates.insert(0, exe.with_name("pythonw.exe"))
            candidates.insert(1, exe)
        for c in candidates:
            try:
                if c.is_file():
                    return str(c)
            except OSError:
                continue
    return None


def main() -> int:
    root = _git_root()
    launch_py = root / "bin" / "apps" / "desktop" / "launch.py"
    desktop_dir = launch_py.parent
    if not launch_py.is_file():
        _open_heal(root, "missing_launch")
        return 1
    pyw = _find_pythonw(root)
    if not pyw:
        _open_heal(root, "missing_runtime")
        return 1
    try:
        env = os.environ.copy()
        # Ensure bundled site-packages win over any stray PYTHONPATH
        runtime_root = root / "bin" / "runtime" / "win" / "python"
        if runtime_root.is_dir():
            env["DAM_RUNTIME_PYTHON"] = str(runtime_root)
            env.pop("PYTHONHOME", None)
        flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
        subprocess.Popen(
            [pyw, str(launch_py)],
            cwd=str(desktop_dir),
            env=env,
            close_fds=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
            | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)
            | flags,
        )
    except Exception as exc:  # noqa: BLE001
        _message(f"Nie udalo sie uruchomic DAM.\n{exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
