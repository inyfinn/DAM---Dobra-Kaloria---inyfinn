"""
Thin root launcher for DAM.exe (PyInstaller).

Resolves GIT_ROOT = directory containing this executable (or this script in
dev), then starts bundled pythonw on bin\\apps\\desktop\\launch.py.

Portable HARD: prefer bin/runtime/win/python/pythonw.exe only.
System Python only when DAM_ALLOW_SYSTEM_PYTHON=1 (dev).

Stderr is never discarded: child output goes to launch-error.log
(%LOCALAPPDATA%\\DAM\\ or GIT_ROOT\\bin\\apps\\desktop\\logs).
Missing site-packages -> heal page + MessageBox, not a silent click.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path


APP_TITLE = "DAM - Dobra Kaloria - Inyfinn"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
PROBE_MODULES = "webview,bcrypt,psycopg2,PIL,ijson"


def _git_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    # Dev: .../bin/apps/desktop/dam_root_launcher.py -> parents[3] = GIT_ROOT
    return Path(__file__).resolve().parents[3]


def _heal_html(root: Path) -> Path:
    return root / "bin" / "apps" / "desktop" / "boot-heal.html"


def _launch_log_path(root: Path) -> Path:
    local = os.environ.get("LOCALAPPDATA") or os.environ.get("LocalAppData") or ""
    if local:
        dest = Path(local) / "DAM"
        try:
            dest.mkdir(parents=True, exist_ok=True)
            return dest / "launch-error.log"
        except OSError:
            pass
    dest = root / "bin" / "apps" / "desktop" / "logs"
    dest.mkdir(parents=True, exist_ok=True)
    return dest / "launch-error.log"


def _append_log(log_path: Path, text: str) -> None:
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8", errors="replace") as fh:
            fh.write(text)
            if not text.endswith("\n"):
                fh.write("\n")
    except OSError:
        pass


def _open_heal(root: Path, reason: str) -> None:
    html = _heal_html(root)
    if html.is_file():
        uri = html.resolve().as_uri() + "?reason=" + reason.replace(" ", "%20")
        try:
            webbrowser.open(uri)
            return
        except Exception:
            pass
    _message(_heal_text(reason, root))


def _fail_visible(root: Path, reason: str, extra: str = "") -> None:
    _open_heal(root, reason)
    text = _heal_text(reason, root)
    if extra:
        text = text + "\n\n" + extra
    _message(text)


def _heal_text(reason: str, root: Path) -> str:
    runtime = root / "bin" / "runtime" / "win" / "python" / "pythonw.exe"
    log_path = _launch_log_path(root)
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
    if reason == "missing_modules":
        return (
            "Silnik Pythona jest, ale brakuje bibliotek (webview / bcrypt / PostgreSQL).\n"
            "Instalacja jest niepelna - zainstaluj DAM ponownie z DAM-Setup.exe.\n\n"
            f"Szczegoly:\n{log_path}"
        )
    if reason == "launch_exit":
        return (
            "DAM zamknal sie zaraz po starcie.\n\n"
            f"Log:\n{log_path}"
        )
    if reason == "webview2":
        return (
            "Brak Microsoft Edge WebView2 Runtime.\n\n"
            "Pobierz Evergreen Bootstrapper (bez uprawnien admina w wiekszosci firm):\n"
            "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
        )
    return f"Nie udalo sie uruchomic DAM.\nPowod: {reason}\nLog: {log_path}"


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


def _probe_runtime_imports(pyw: str, log_path: Path) -> bool:
    py = Path(pyw).with_name("python.exe")
    exe = str(py) if py.is_file() else pyw
    flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
    try:
        result = subprocess.run(
            [exe, "-c", f"import {PROBE_MODULES}"],
            capture_output=True,
            text=True,
            timeout=25,
            creationflags=flags,
        )
    except Exception as exc:  # noqa: BLE001
        _append_log(log_path, f"probe exception: {exc}\n")
        return False
    if result.returncode == 0:
        return True
    body = (result.stderr or result.stdout or "").strip()
    if not body:
        body = f"import {PROBE_MODULES} exit {result.returncode}"
    _append_log(log_path, f"import {PROBE_MODULES} failed:\n{body}\n")
    return False


def main() -> int:
    root = _git_root()
    launch_py = root / "bin" / "apps" / "desktop" / "launch.py"
    desktop_dir = launch_py.parent
    log_path = _launch_log_path(root)
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    _append_log(log_path, f"\n--- launch {stamp} ---\n")
    if not launch_py.is_file():
        _fail_visible(root, "missing_launch")
        return 1
    pyw = _find_pythonw(root)
    if not pyw:
        _fail_visible(root, "missing_runtime")
        return 1
    if not _probe_runtime_imports(pyw, log_path):
        extra = ""
        try:
            extra = log_path.read_text(encoding="utf-8", errors="replace")[-1200:]
        except OSError:
            extra = str(log_path)
        _fail_visible(root, "missing_modules", extra)
        return 1
    try:
        env = os.environ.copy()
        runtime_root = root / "bin" / "runtime" / "win" / "python"
        if runtime_root.is_dir():
            env["DAM_RUNTIME_PYTHON"] = str(runtime_root)
            env.pop("PYTHONHOME", None)
        flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
        log_f = log_path.open("a", encoding="utf-8", errors="replace")
        log_f.write(f"starting {pyw} {launch_py}\n")
        log_f.flush()
        proc = subprocess.Popen(
            [pyw, str(launch_py)],
            cwd=str(desktop_dir),
            env=env,
            close_fds=False,
            stdin=subprocess.DEVNULL,
            stdout=log_f,
            stderr=log_f,
            creationflags=getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
            | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)
            | flags,
        )
    except Exception as exc:  # noqa: BLE001
        _append_log(log_path, f"Popen failed: {exc}\n")
        _fail_visible(root, "launch_exit", str(exc))
        return 1
    try:
        rc = proc.wait(timeout=2.0)
        extra = f"exit {rc}\n"
        try:
            extra += log_path.read_text(encoding="utf-8", errors="replace")[-1200:]
        except OSError:
            extra += str(log_path)
        _append_log(log_path, f"child exited immediately: {rc}\n")
        _fail_visible(root, "launch_exit", extra)
        return 1
    except subprocess.TimeoutExpired:
        return 0
    finally:
        try:
            log_f.close()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
