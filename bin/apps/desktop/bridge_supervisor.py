"""Local bridge (8766) supervisor - shared by launch.py and serve_browser.py."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import tempfile
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from runtime_config import APP_VERSION, CONTENT_ROOT, DESKTOP_DIR, HOST, env_for_bridge

LOCAL_BRIDGE = DESKTOP_DIR / "local_bridge.py"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)

# Log bledow startu mostu POZA bundlem .app - zapis do wnetrza podpisanej
# aplikacji uniewaznia pieczec podpisu, a w /Applications zwykle nie ma praw.
if sys.platform == "darwin":
    _LOG_DIR = Path.home() / "Library" / "Logs" / "DAM"
else:
    _LOG_DIR = DESKTOP_DIR / "data"
try:
    _LOG_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    _LOG_DIR = Path(tempfile.gettempdir())
BRIDGE_STDERR_LOG = _LOG_DIR / "bridge-stderr.log"
# Kroki przejmowania starego mostu / serwera UI trafiaja do tego samego logu,
# co stderr mostu - jedno miejsce do diagnozy "czemu loguje sie do starej bazy".
TAKEOVER_LOG = BRIDGE_STDERR_LOG


def _silent_python() -> str:
    exe = Path(sys.executable)
    if exe.name.lower() == "python.exe":
        pw = exe.with_name("pythonw.exe")
        if pw.is_file():
            return str(pw)
    return str(exe)


def is_frozen() -> bool:
    """PyInstaller: sys.executable to binarka aplikacji, NIE interpreter."""
    return bool(getattr(sys, "frozen", False))


def payload_script_cmd(script: Path, run_name: str | None = None) -> list[str]:
    """Polecenie uruchamiajace skrypt payloadu - dziala tez w zamrozonej .app.

    Windows: dam_root_launcher.py re-exec-uje w bin/runtime/win/python/pythonw.exe,
    wiec sys.executable jest PRAWDZIWYM interpreterem i [exe, skrypt] dziala.

    macOS (.app): DAM-macos.spec zamraza cienki shim, ktory odpala kod przez
    runpy W TYM SAMYM PROCESIE - zadnego interpretera na dysku nie ma.
    sys.executable to DAM.app/Contents/MacOS/DAM, wiec [exe, skrypt] uruchamialo
    CALA APLIKACJE OD NOWA z ignorowanym argumentem, a nie skrypt. Most na 8766
    nigdy nie wstawal, a supervise() respawnowal kolejne kopie co 2,5 s.

    W trybie zamrozonym uzywamy wiec sentinela shima: [exe, "--run", <cel>],
    gdzie <cel> to nazwa z bialej listy dam_mac_shim.RUNNABLE (nie sciezka).
    """
    if not is_frozen():
        return [_silent_python(), str(script)]
    name = run_name or script.stem.replace("_", "-")
    return [str(sys.executable), "--run", name]


def bridge_health(port: int, timeout: float = 2.5) -> dict | None:
    url = f"http://{HOST}:{int(port)}/health"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            raw = resp.read()
            if not raw:
                return None
            data = json.loads(raw.decode("utf-8", errors="replace"))
            return data if isinstance(data, dict) else None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


def is_bridge_up(port: int, timeout: float = 2.5) -> bool:
    data = bridge_health(port, timeout=timeout)
    return bool(data and data.get("ok") is not False)


# ---------------------------------------------------------------------------
# Tozsamosc uslug + przejmowanie mostu / serwera UI innej wersji (29.09.2026)
#
# Objaw (Mac, DAM.app 2.4.7 -> 2.4.9): po podmianie aplikacji logowanie nadal
# mowilo "Nieprawidlowy email lub haslo". Stary most 2.4.7 (bez konfiguracji
# bazy, logowanie do seed SQLite) zyl w tle po zamknieciu starego okna, a nowy
# ensure_running() widzial "cos odpowiada na /health" i to UZYWAL. Na Windows
# instalator ubija stare procesy; na macOS instalatora nie ma, wiec aplikacja
# sama musi przejac porty. Zasada: nowa aplikacja NIGDY nie rozmawia z mostem /
# serwerem UI innej wersji albo innego katalogu instalacji. Jesli nie da sie go
# zatrzymac - jawny komunikat zamiast cichego uzycia.
# ---------------------------------------------------------------------------

INSTALL_ROOT = CONTENT_ROOT
UI_HEALTH_PATH = "/__dam_ui_health"
SHUTDOWN_PATH = "/__dam_shutdown"
CONTROL_TOKEN_HEADER = "X-DAM-Control-Token"
STALE_BRIDGE_ERROR = "stale_bridge_running"
STALE_MESSAGE = (
    "Działa starsza wersja DAM w tle - zamknij ją w Monitorze aktywności / "
    "Menedżerze zadań albo uruchom komputer ponownie."
)
FOREIGN_PORT_ERROR = "port_busy_foreign"
TAKEOVER_RETRY_S = 30.0
PORT_FREE_TIMEOUT_S = 10.0


def _takeover_log(msg: str) -> None:
    line = (
        time.strftime("%Y-%m-%d %H:%M:%S")
        + f" [supervisor pid={os.getpid()} v{APP_VERSION}] "
        + msg
        + "\n"
    )
    try:
        with open(TAKEOVER_LOG, "a", encoding="utf-8") as fh:
            fh.write(line)
    except OSError:
        pass


def norm_root(path: object) -> str:
    """Porownywalna postac sciezki instalacji (realpath + wielkosc liter na Windows)."""
    raw = str(path or "").strip()
    if not raw:
        return ""
    try:
        raw = os.path.realpath(raw)
    except (OSError, ValueError):
        pass
    return os.path.normcase(os.path.normpath(raw))


def local_identity() -> dict:
    """To, co most i serwer UI tej instalacji mowia o sobie (/health, /__dam_ui_health)."""
    return {"app_version": APP_VERSION, "pid": os.getpid(), "root": str(INSTALL_ROOT)}


def _brief(data: dict | None) -> dict:
    if not isinstance(data, dict):
        return {}
    keys = ("service", "app_version", "api_version", "pid", "root", "port", "app", "legacy", "foreign")
    return {k: data.get(k) for k in keys if k in data}


def _identity_verdict(data: dict, own_pids: tuple = ()) -> tuple[str, str]:
    pid = data.get("pid")
    if isinstance(pid, int) and pid in set(own_pids or ()):
        return "current", "own_child"
    ver = str(data.get("app_version") or "").strip()
    if not ver:
        return "stale", "brak app_version (wersja sprzed 2.4.9)"
    if ver != APP_VERSION:
        return "stale", f"app_version {ver} != {APP_VERSION}"
    root = data.get("root")
    if root and norm_root(root) != norm_root(INSTALL_ROOT):
        return "stale", f"root {root} != {INSTALL_ROOT}"
    return "current", "same_version_same_root"


def classify_bridge_health(health: dict | None, own_pids: tuple = ()) -> tuple[str, str]:
    """down | current | stale | foreign (+ powod). foreign = nie nasz most -> nie ruszamy."""
    if not isinstance(health, dict) or health.get("ok") is False:
        return "down", "no_health"
    service = health.get("service")
    if service != "dam-local-bridge" and not (service is None and "api_version" in health):
        return "foreign", f"service={service!r}"
    return _identity_verdict(health, own_pids)


def _http_get_json(port: int, path: str, timeout: float) -> tuple[bool, dict | None]:
    """(czy cokolwiek odpowiedzialo po HTTP, JSON-slownik albo None)."""
    url = f"http://{HOST}:{int(port)}{path}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError:
        return True, None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return False, None
    try:
        data = json.loads(raw.decode("utf-8", errors="replace"))
    except (json.JSONDecodeError, ValueError):
        return True, None
    return True, data if isinstance(data, dict) else None


def ui_health(port: int, timeout: float = 2.5) -> dict | None:
    """Tozsamosc serwera UI na porcie. None = nic nie odpowiada.

    Serwery UI sprzed 2.4.9 nie maja /__dam_ui_health - rozpoznajemy je po
    /dam-runtime.json z "app": "dam-eta" (legacy). Cos innego = foreign.
    """
    answered, data = _http_get_json(port, UI_HEALTH_PATH, timeout)
    if data and data.get("service") == "dam-ui":
        return data
    answered2, rt = _http_get_json(port, "/dam-runtime.json", timeout)
    if rt and rt.get("app") == "dam-eta":
        return {"legacy": True, "app": "dam-eta", "ui_port": rt.get("ui_port")}
    if answered or answered2:
        return {"foreign": True}
    return None


def classify_ui_health(probe: dict | None, own_pids: tuple = ()) -> tuple[str, str]:
    if not isinstance(probe, dict):
        return "down", "no_answer"
    if probe.get("foreign"):
        return "foreign", "nie serwer UI DAM"
    if probe.get("legacy"):
        return "stale", "serwer UI sprzed 2.4.9 (brak /__dam_ui_health)"
    return _identity_verdict(probe, own_pids)


# --- token sterujacy (lagodne zatrzymanie mostu tej instalacji) ---------------


def control_token_path() -> Path:
    """Plik tokenu w katalogu stanu uzytkownika, osobny dla kazdego katalogu instalacji."""
    try:
        from platform_compat import user_state_dir

        base = Path(user_state_dir())
    except Exception:  # noqa: BLE001
        base = _LOG_DIR
    digest = hashlib.sha256(norm_root(INSTALL_ROOT).encode("utf-8")).hexdigest()[:12]
    return base / f"bridge-control-{digest}.token"


def write_control_token() -> str:
    """Most po zajeciu portu zapisuje swiezy token (0600). Pusty napis = brak tokenu."""
    token = secrets.token_urlsafe(32)
    path = control_token_path()
    tmp = path.with_name(path.name + ".tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(token)
        os.replace(str(tmp), str(path))
    except OSError:
        return ""
    return token


def read_control_token() -> str:
    try:
        return control_token_path().read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def control_token_matches(expected: str, given: str) -> bool:
    expected = str(expected or "")
    given = str(given or "")
    if not expected or not given:
        return False
    return hmac.compare_digest(expected.encode("utf-8"), given.encode("utf-8"))


def request_graceful_shutdown(port: int, token: str, timeout: float = 3.0) -> bool:
    if not token:
        return False
    req = urllib.request.Request(
        f"http://{HOST}:{int(port)}{SHUTDOWN_PATH}",
        data=b"{}",
        method="POST",
        headers={"Content-Type": "application/json", CONTROL_TOKEN_HEADER: token},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace") or "{}")
        return bool(isinstance(data, dict) and data.get("ok"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return False


# --- procesy: kto slucha na porcie, czy to DAM, zatrzymanie -----------------

_WIN_NO_WINDOW = {"creationflags": CREATE_NO_WINDOW} if sys.platform == "win32" else {}

_DAM_CMD_MARKERS = (
    "local_bridge.py",
    "serve_browser.py",
    "dam_macos.py",
    "dam_root_launcher",
    ".app/contents/macos/dam",
    "dam-appw.exe",
    "engine_launcher",
)


def is_dam_command_line(cmd: str | None) -> bool:
    """Tylko procesy DAM (most, launcher, shim .app). Nigdy obce programy."""
    low = str(cmd or "").lower().replace("\\", "/")
    if not low.strip():
        return False
    if any(m in low for m in _DAM_CMD_MARKERS):
        return True
    return "apps/desktop/" in low and ("launch.py" in low or "__main__.py" in low)


def _port_bind_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        if sys.platform == "win32":
            try:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            except (OSError, AttributeError):
                pass
        try:
            sock.bind((HOST, int(port)))
            return True
        except OSError:
            return False


def port_is_free(port: int) -> bool:
    """Szybka sciezka: da sie zbindowac = nikt nie slucha (bez sondy HTTP)."""
    return _port_bind_free(port)


def listening_pids(port: int) -> list[int] | None:
    """PID-y nasluchujace na porcie TCP. None = narzedzie niedostepne."""
    port = int(port)
    try:
        if sys.platform == "win32":
            # netstat: stan "LISTENING" jest lokalizowany (PL: NASLUCHIWANIE), wiec
            # rozpoznajemy nasluch po obcym adresie 0.0.0.0:0 / [::]:0.
            out = subprocess.run(
                ["netstat", "-ano", "-p", "TCP"],
                capture_output=True,
                timeout=10,
                **_WIN_NO_WINDOW,
            ).stdout.decode("utf-8", errors="replace")
            pids: set[int] = set()
            for line in out.splitlines():
                parts = line.split()
                if len(parts) < 5 or parts[0].upper() != "TCP":
                    continue
                local, foreign, pid = parts[1], parts[2], parts[-1]
                if not local.endswith(f":{port}") or foreign not in ("0.0.0.0:0", "[::]:0"):
                    continue
                if pid.isdigit() and int(pid) > 0:
                    pids.add(int(pid))
            return sorted(pids)
        lsof = shutil.which("lsof") or ("/usr/sbin/lsof" if Path("/usr/sbin/lsof").exists() else "")
        if not lsof:
            return None
        proc = subprocess.run(
            [lsof, "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
            capture_output=True,
            timeout=10,
        )
        return sorted({int(x) for x in proc.stdout.decode().split() if x.strip().isdigit()})
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def process_command_line(pid: int) -> str | None:
    """Linia polecen procesu BIEZACEGO uzytkownika; None = nieznany albo cudzy."""
    pid = int(pid)
    try:
        if sys.platform == "win32":
            root = os.environ.get("SystemRoot", r"C:\Windows")
            ps = str(Path(root) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe")
            script = (
                "[Console]::OutputEncoding=[Text.Encoding]::UTF8;"
                f"$p=Get-CimInstance Win32_Process -Filter 'ProcessId={pid}' -ErrorAction SilentlyContinue;"
                "if($p){"
                "$o=(Invoke-CimMethod -InputObject $p -MethodName GetOwner -ErrorAction SilentlyContinue).User;"
                "if($o -eq $env:USERNAME){[string]$p.ExecutablePath+' '+[string]$p.CommandLine}}"
            )
            proc = subprocess.run(
                [ps, "-NoProfile", "-NonInteractive", "-Command", script],
                capture_output=True,
                timeout=20,
                **_WIN_NO_WINDOW,
            )
            text = proc.stdout.decode("utf-8", errors="replace").strip()
            return text or None
        proc = subprocess.run(
            ["ps", "-ww", "-o", "uid=,args=", "-p", str(pid)],
            capture_output=True,
            timeout=10,
        )
        line = proc.stdout.decode("utf-8", errors="replace").strip()
        m = re.match(r"^\s*(\d+)\s+(.*)$", line)
        if not m:
            return None
        if hasattr(os, "getuid") and int(m.group(1)) != os.getuid():
            return None
        return m.group(2)
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def _pid_alive(pid: int) -> bool:
    pid = int(pid)
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes

            k32 = ctypes.windll.kernel32
            k32.OpenProcess.restype = wintypes.HANDLE
            handle = k32.OpenProcess(0x1000, False, pid)  # QUERY_LIMITED_INFORMATION
            if not handle:
                return False
            try:
                code = wintypes.DWORD()
                if not k32.GetExitCodeProcess(handle, ctypes.byref(code)):
                    return False
                return code.value == 259  # STILL_ACTIVE
            finally:
                k32.CloseHandle(handle)
        except Exception:  # noqa: BLE001
            return False
    try:
        # Wlasne dziecko-zombie: zbierz, zeby nie wygladalo na zywe.
        os.waitpid(pid, os.WNOHANG)
    except (ChildProcessError, OSError):
        pass
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False
    return True


def _wait_dead(pid: int, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not _pid_alive(pid):
            return True
        time.sleep(0.15)
    return not _pid_alive(pid)


def terminate_pid(pid: int, timeout: float = 5.0) -> bool:
    """Zatrzymaj proces: macOS SIGTERM -> czekaj -> SIGKILL; Windows taskkill /T /F."""
    pid = int(pid)
    if pid in (os.getpid(), os.getppid()) or pid <= 0:
        return False
    if sys.platform == "win32":
        try:
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/T", "/F"],
                capture_output=True,
                timeout=15,
                **_WIN_NO_WINDOW,
            )
        except (OSError, subprocess.SubprocessError):
            pass
        return _wait_dead(pid, timeout)
    import signal

    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return True
    except OSError:
        return False
    if _wait_dead(pid, timeout):
        return True
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        return True
    except OSError:
        return False
    return _wait_dead(pid, 3.0)


def wait_port_free(port: int, timeout: float = PORT_FREE_TIMEOUT_S) -> bool:
    """Czekaj, az nikt nie nasluchuje (TIME_WAIT po sondzie HTTP nie blokuje)."""
    deadline = time.monotonic() + max(0.1, timeout)
    while True:
        if _port_bind_free(port):
            return True
        pids = listening_pids(port)
        if pids is not None and not pids:
            return True
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.25)


def stop_stale_service(
    port: int,
    *,
    kind: str,
    health: dict | None,
    own_pids: tuple = (),
    wait_s: float = PORT_FREE_TIMEOUT_S,
) -> dict:
    """Zatrzymaj stary most / serwer UI na porcie. Kazdy krok idzie do logu mostu.

    1. most z tokenem tej instalacji: POST /__dam_shutdown (tylko 127.0.0.1 + token),
    2. inaczej (mosty sprzed 2.4.9 nie maja endpointu): PID nasluchujacego procesu,
       tylko gdy linia polecen to DAM i proces nalezy do biezacego uzytkownika,
    3. czekaj na zwolnienie portu (~10 s).
    """
    port = int(port)
    _takeover_log(f"{kind}:{port} stary/obcej wersji -> przejmuje ({_brief(health)})")
    if kind == "bridge":
        token = read_control_token()
        if token:
            if request_graceful_shutdown(port, token):
                _takeover_log(f"{kind}:{port} POST {SHUTDOWN_PATH} przyjety, czekam na port")
                if wait_port_free(port, wait_s):
                    _takeover_log(f"{kind}:{port} zwolniony (lagodne zatrzymanie)")
                    return {"ok": True, "method": "graceful", "pids": []}
                _takeover_log(f"{kind}:{port} lagodne zatrzymanie nie zwolnilo portu - PID")
            else:
                _takeover_log(f"{kind}:{port} {SHUTDOWN_PATH} odrzucony/brak - PID")
    pids = listening_pids(port)
    if not pids:
        hp = (health or {}).get("pid")
        pids = [hp] if isinstance(hp, int) and hp > 0 else []
    _takeover_log(f"{kind}:{port} nasluchujace PID: {pids}")
    excluded = {os.getpid(), os.getppid(), *[int(p) for p in (own_pids or ()) if p]}
    killed: list[int] = []
    refused: list[str] = []
    for pid in pids:
        if pid in excluded:
            refused.append(f"{pid}:self")
            _takeover_log(f"{kind}:{port} PID {pid} to ten proces/rodzic - pomijam")
            continue
        cmd = process_command_line(pid)
        if not is_dam_command_line(cmd):
            refused.append(f"{pid}:not_dam")
            _takeover_log(f"{kind}:{port} PID {pid} to nie DAM albo cudzy ({(cmd or '?')[:160]}) - nie ruszam")
            continue
        _takeover_log(f"{kind}:{port} zatrzymuje PID {pid} ({cmd[:160]})")
        if terminate_pid(pid):
            killed.append(pid)
            _takeover_log(f"{kind}:{port} PID {pid} zatrzymany")
        else:
            refused.append(f"{pid}:kill_failed")
            _takeover_log(f"{kind}:{port} PID {pid} NIE dal sie zatrzymac")
    if not killed:
        _takeover_log(f"{kind}:{port} przejecie NIEUDANE ({refused or 'brak PID'})")
        return {"ok": False, "error": "kill_failed" if refused else "pid_unknown", "pids": [], "refused": refused}
    if not wait_port_free(port, wait_s):
        _takeover_log(f"{kind}:{port} port nadal zajety po {wait_s:.0f} s")
        return {"ok": False, "error": "port_still_busy", "pids": killed, "refused": refused}
    _takeover_log(f"{kind}:{port} zwolniony (PID {killed})")
    return {"ok": True, "method": "pid", "pids": killed, "refused": refused}


def takeover_stale_services(ui_port: int, bridge_port: int, own_pids: tuple = ()) -> dict:
    """Przy starcie aplikacji: zwolnij porty zajete przez DAM innej wersji / instalacji.

    Najpierw UI (stary proces okna ma nadzorce, ktory co 2,5 s wskrzeszalby stary
    most), potem most. Ta sama wersja i ten sam katalog = zostaw (ponowne uzycie).
    """
    result: dict = {"ok": True}
    for kind, port in (("ui", int(ui_port)), ("bridge", int(bridge_port))):
        entry: dict = {"verdict": "down", "ok": True}
        if not port_is_free(port):
            if kind == "ui":
                probe = ui_health(port)
                verdict, reason = classify_ui_health(probe, own_pids)
            else:
                probe = bridge_health(port)
                verdict, reason = classify_bridge_health(probe, own_pids)
            entry.update(verdict=verdict, reason=reason, health=_brief(probe))
            if verdict == "stale":
                stop = stop_stale_service(port, kind=kind, health=probe or {}, own_pids=own_pids)
                entry.update(ok=bool(stop.get("ok")), stop=stop)
        if entry.get("verdict") == "foreign":
            _takeover_log(f"{kind}:{port} zajety przez program spoza DAM - nie ruszam")
        result[kind] = entry
        if not entry.get("ok"):
            result["ok"] = False
    if not result["ok"]:
        result["error"] = STALE_BRIDGE_ERROR
        result["message"] = STALE_MESSAGE
    return result


class BridgeSupervisor:
    """Start and keep local_bridge.py alive."""

    def __init__(self, ui_port: int, bridge_port: int) -> None:
        self.ui_port = int(ui_port)
        self.bridge_port = int(bridge_port)
        self._proc: subprocess.Popen | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self.last_error = ""
        # Przejecie starego mostu: ostatnia proba + jej blad (bez mielenia co 2,5 s).
        self._last_takeover_ts = 0.0
        self._last_takeover_error: dict | None = None

    def _own_pids(self) -> tuple:
        proc = self._proc
        if proc is not None and proc.poll() is None:
            return (int(proc.pid),)
        return ()

    def _verdict(self, health: dict | None) -> tuple[str, str]:
        return classify_bridge_health(health, own_pids=self._own_pids())

    def _foreign_error(self, health: dict | None, reason: str) -> dict:
        return {
            "ok": False,
            "started": False,
            "port": self.bridge_port,
            "error": FOREIGN_PORT_ERROR,
            "message": f"Port {self.bridge_port} zajmuje inny program niż DAM - zamknij go albo uruchom komputer ponownie.",
            "reason": reason,
            "stale_health": _brief(health),
        }

    def _takeover_locked(self, health: dict | None, reason: str) -> dict | None:
        """Zatrzymaj stary most (wywolywac pod self._lock). None = port wolny, startuj swoj."""
        now = time.monotonic()
        if self._last_takeover_error is not None and now - self._last_takeover_ts < TAKEOVER_RETRY_S:
            return dict(self._last_takeover_error)
        _takeover_log(f"bridge:{self.bridge_port} ensure_running: stary most (stale) - {reason}")
        stop = stop_stale_service(
            self.bridge_port, kind="bridge", health=health or {}, own_pids=self._own_pids()
        )
        self._last_takeover_ts = now
        if stop.get("ok"):
            self._last_takeover_error = None
            return None
        err = {
            "ok": False,
            "started": False,
            "port": self.bridge_port,
            "error": STALE_BRIDGE_ERROR,
            "message": STALE_MESSAGE,
            "reason": reason,
            "stale_health": _brief(health),
            "stop": stop,
        }
        self._last_takeover_error = err
        self.last_error = f"{STALE_BRIDGE_ERROR}: {reason}"
        return dict(err)

    def start(self) -> subprocess.Popen | None:
        if not LOCAL_BRIDGE.is_file():
            # Nie polykaj powodu - inaczej UI mowi tylko "most niedostepny".
            self.last_error = f"brak pliku mostu: {LOCAL_BRIDGE}"
            return None
        flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
        cmd = payload_script_cmd(LOCAL_BRIDGE, run_name="bridge")
        # stderr do pliku, nie do DEVNULL: gdy most padnie przy imporcie
        # (brakujace kolo arm64, brak praw zapisu), to jedyny slad dla diagnozy.
        try:
            err = open(BRIDGE_STDERR_LOG, "ab", buffering=0)
        except OSError:
            err = subprocess.DEVNULL
        try:
            return subprocess.Popen(
                cmd,
                cwd=str(DESKTOP_DIR),
                env=env_for_bridge(self.ui_port, self.bridge_port),
                creationflags=flags,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=err,
            )
        except OSError as exc:
            self.last_error = f"spawn mostu nieudany ({cmd[0]}): {exc}"
            return None

    def ensure_running(self, wait_s: float = 12.0) -> dict:
        """Idempotent: nasz most (ta wersja, ten katalog) -> noop; stary -> przejecie;
        brak -> spawn i czekanie. Nigdy nie uzywa po cichu mostu innej wersji."""
        health = bridge_health(self.bridge_port)
        verdict, _reason = self._verdict(health)
        if verdict == "current":
            return {"ok": True, "started": False, "port": self.bridge_port, "health": health}

        with self._lock:
            health = bridge_health(self.bridge_port)
            verdict, reason = self._verdict(health)
            if verdict == "current":
                return {"ok": True, "started": False, "port": self.bridge_port, "health": health}
            if verdict == "foreign":
                return self._foreign_error(health, reason)
            if verdict == "stale":
                err = self._takeover_locked(health, reason)
                if err is not None:
                    return err

            alive = self._proc is not None and self._proc.poll() is None
            if not alive:
                try:
                    self._proc = self.start()
                except Exception as exc:
                    return {
                        "ok": False,
                        "started": False,
                        "port": self.bridge_port,
                        "error": str(exc),
                    }

            last_verdict, last_reason, last_health = "down", "", None
            deadline = time.monotonic() + max(1.0, wait_s)
            while time.monotonic() < deadline:
                h = bridge_health(self.bridge_port, timeout=1.5)
                last_verdict, last_reason = self._verdict(h)
                last_health = h
                if last_verdict == "current":
                    return {
                        "ok": True,
                        "started": True,
                        "port": self.bridge_port,
                        "health": h,
                    }
                if self._proc and self._proc.poll() is not None and last_verdict == "down":
                    try:
                        self._proc = self.start()
                    except Exception as exc:
                        return {
                            "ok": False,
                            "started": False,
                            "port": self.bridge_port,
                            "error": str(exc),
                        }
                time.sleep(0.35)

        if last_verdict == "stale":
            # Stary most wrocil w trakcie (np. wskrzeszony przez stary nadzorce).
            _takeover_log(f"bridge:{self.bridge_port} po starcie nadal odpowiada stary most: {last_reason}")
            return {
                "ok": False,
                "started": True,
                "port": self.bridge_port,
                "error": STALE_BRIDGE_ERROR,
                "message": STALE_MESSAGE,
                "reason": last_reason,
                "stale_health": _brief(last_health),
            }
        return {
            "ok": False,
            "started": True,
            "port": self.bridge_port,
            "error": "bridge_start_timeout",
        }

    def supervise(self, interval_s: float = 2.5) -> None:
        while not self._stop.is_set():
            self._stop.wait(interval_s)
            if self._stop.is_set():
                break
            health = bridge_health(self.bridge_port, timeout=1.5)
            verdict, _reason = self._verdict(health)
            if verdict in ("current", "foreign"):
                continue
            if verdict == "stale":
                # Przejecie (z limitem prob w _takeover_locked) + wlasny most.
                try:
                    self.ensure_running()
                except Exception:
                    pass
                continue
            with self._lock:
                if self._proc is None or self._proc.poll() is not None:
                    try:
                        self._proc = self.start()
                    except Exception:
                        pass

    def start_supervisor_thread(self, interval_s: float = 2.5) -> threading.Thread:
        thread = threading.Thread(
            target=self.supervise,
            args=(interval_s,),
            daemon=True,
            name="dam-bridge-supervisor",
        )
        thread.start()
        return thread

    def stop(self) -> None:
        self._stop.set()
        if self._proc and self._proc.poll() is None:
            try:
                self._proc.terminate()
            except Exception:
                pass
