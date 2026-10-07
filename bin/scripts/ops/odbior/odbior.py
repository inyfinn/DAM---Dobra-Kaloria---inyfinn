# -*- coding: utf-8 -*-
"""Test odbioru DAM: "komputer, ktory nigdy nie mial DAM, widzi to samo co wlasciciel".

Wariant C (gotowy): swieza instalacja bez ROOT. Drzewo programu i DANE STARTOWE sa kopia
paczki instalatora danej wersji (katalog staging z build-installer.ps1), nie pustym data/.
Uruchamiany jest PRAWDZIWY PROGRAM (okno pywebview/WebView2 przez launch.main()) jako
odizolowana instancja; zrzuty wylacznie przez CDP tego okna - nigdy przegladarka
(decyzja wlasciciela 07.10.2026). Instancja laczy sie z prawdziwa baza, ale kazda sesja jest
tylko do odczytu; pisze wylacznie logowanie konta testowego (opcja --login).
Wynik: WERDYKT.md + zrzuty + dzienniki w <repo>\\work\\<data>\\odbior\\<przebieg>\\.

Okno testowe (--okno-testowe): to samo okno, ale z kodu kopii roboczej (--kod), z danymi
zainstalowanego programu i ROOT = M:, bez przegladania dysku, bez zapisu do bazy i z mostem
odrzucajacym zadania zmieniajace - dla recenzentow ekranow (dostaja adres CDP).

Warianty A i B (ROOT wzorcowy i nieaktualna kopia): --wariant AB --przygotuj buduje fixtury
i drzewa instancji pod work\\; uruchomienie wymaga bazy, do ktorej wolno pisac (--baza test),
i czeka na decyzje kierownika - patrz SKILL.md skilla dam-odbior.

Opiera sie na bin\\scripts\\qa\\e2e (run_abc.py, instance_launcher.py, fixtures.py).
Nigdy: porty 8765/8766, %LOCALAPPDATA%\\DAM*, prawdziwy M:, kasowanie rekurencyjne.

Uzycie:
  python odbior.py --wariant C --wersja 2.5.8 --login
  python odbior.py --wariant C --paczka <katalog z bin\\> --czas 180 --bez-okna
  python odbior.py --okno-testowe --kod <kopia robocza z bin\\> --login
  python odbior.py --stop <katalog przebiegu>
  python odbior.py --wariant AB --przygotuj
  python odbior.py --samotest
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
E2E = HERE.parents[1] / "qa" / "e2e"
PORTS = {"A": (18766, 18776), "B": (18767, 18777), "C": (18768, 18778), "W": (18769, 18779)}  # most, UI
CDP_PORTS = {"C": 19333, "W": 19334}  # nigdy 9333 (okno uzytkownika)
# --host-rules: okno testowe fizycznie nie moze wyslac nic do DAM uzytkownika (8765/8766), takze zanim
# podlaczy sie CDP. Sprawdzone sonda na atrapie 18999: bez reguly zadanie dochodzi, z regula "Failed to fetch".
WEBVIEW_ARGS = ("--disable-features=ElasticOverscroll,CalculateNativeWinOcclusion "
                "--disable-backgrounding-occluded-windows --disable-renderer-backgrounding "
                '--host-rules="MAP 127.0.0.1:8765 127.0.0.1:9, MAP 127.0.0.1:8766 127.0.0.1:9, '
                'MAP localhost:8765 127.0.0.1:9, MAP localhost:8766 127.0.0.1:9"')
NEVER_KILL = ("\\dam-build\\", "\\staging\\dam-install", "\\programs\\dam\\")
FORBIDDEN_PORTS = {8765, 8766}
BELOW_NORMAL = 0x00004000
FLAGS = (getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) | getattr(subprocess, "CREATE_NO_WINDOW", 0)
         | BELOW_NORMAL)
DATA_FILES = ["file-index.json", "search-index.json", "campaigns.json", "branding-search-index.json",
              "branding-index.json", "branding-grid-index.json", "branding-grid-head.json"]
SNAPSHOT_KEY = {"file-index.json": "file-index", "search-index.json": "search-index",
                "campaigns.json": "campaigns", "branding-search-index.json": "branding-search-index"}
POINTS = [5, 15, 30, 60, 180]
# Spis katalogu, ktorego instalator od 2.6.0 nie wozi (DAM-Setup.iss, build-installer.ps1 $catalogIndexFiles).
CATALOG_FILES = ["file-index.json", "search-index.json", "campaigns.json", "branding-grid-index.json",
                 "branding-grid-head.json", "branding-search-index.json", "branding-index.json"]


def utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log(msg: str) -> None:
    line = f"{datetime.now().strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    if OUT:
        with open(OUT / "przebieg.log", "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


OUT: Path | None = None


def repo_root() -> Path:
    env = os.environ.get("DAM_ODBIOR_REPO")
    if env:
        return Path(env)
    for p in HERE.parents:
        if (p / ".git").is_dir():  # worktree ma .git jako PLIK - szukamy glownego repo
            return p
    raise SystemExit("nie znalazlem glownego repo (.git) - ustaw DAM_ODBIOR_REPO")


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def write_json(name: str, data: Any) -> Path:
    p = OUT / name
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return p


def port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def robocopy(src: Path, dst: Path, xd: tuple[str, ...] = ("__pycache__",), xf: tuple[str, ...] = ()) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    cmd = ["robocopy", str(src), str(dst), "/E", "/R:1", "/W:1", "/MT:16", "/NFL", "/NDL", "/NJH", "/NJS", "/NP",
           "/XD", *xd]
    if xf:
        cmd += ["/XF", *xf]
    assert "/MIR" not in cmd and "/PURGE" not in cmd
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode >= 8:
        raise RuntimeError(f"robocopy rc={r.returncode}: {r.stdout[-600:]}")


def find_package(version: str | None, explicit: str | None) -> Path:
    if explicit:
        p = Path(explicit)
    else:
        base = Path(os.environ.get("LOCALAPPDATA") or "") / "DAM-build" / "staging"
        pat = f"DAM-install-{version}-*" if version else "DAM-install-*"
        found = sorted(d for d in base.glob(pat) if (d / "bin" / "apps" / "web" / "version.json").is_file())
        if not found:
            raise SystemExit(f"brak paczki {pat} w {base} - zbuduj instalator albo podaj --paczka")
        p = found[-1]
    if not (p / "bin" / "apps" / "desktop" / "local_bridge.py").is_file():
        raise SystemExit(f"to nie jest katalog paczki (brak bin\\apps\\desktop): {p}")
    return p


def file_index_summary(p: Path) -> dict:
    data = json.loads(p.read_text(encoding="utf-8"))
    ids = sorted(str(x.get("id") or "") for x in data.get("products") or [])
    return {"generated_at": data.get("generated_at"), "products": len(ids), "ids": ids,
            "ids_sha": hashlib.sha256("\n".join(ids).encode()).hexdigest()[:16]}


def describe_data(data_dir: Path, thumbs_dir: Path | None = None) -> dict:
    out: dict[str, Any] = {"dir": str(data_dir), "files": {}}
    for name in DATA_FILES:
        f = data_dir / name
        if not f.is_file():
            continue
        st = f.stat()
        rec = {"size": st.st_size, "mtime": datetime.fromtimestamp(st.st_mtime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
        if st.st_size < 120_000_000:
            rec["sha256"] = sha256_file(f)
        if name == "file-index.json":
            try:
                rec.update(file_index_summary(f))
            except Exception as exc:  # noqa: BLE001
                rec["error"] = str(exc)[:120]
        out["files"][name] = rec
    if thumbs_dir and thumbs_dir.is_dir():
        out["thumbs"] = sum(1 for _ in os.scandir(thumbs_dir))
    return out


# ----------------------------------------------------------------------------- instancja C


class Instance:
    def __init__(self, name: str, base: Path):
        self.name = name
        self.dir = base / name
        self.bin = self.dir / "app" / "bin"
        self.desktop = self.bin / "apps" / "desktop"
        self.web = self.bin / "apps" / "web"
        self.python = self.bin / "runtime" / "win" / "python" / "python.exe"
        self.bridge_port, self.ui_port = PORTS[name]
        self.bridge = f"http://127.0.0.1:{self.bridge_port}"
        self.ui = f"http://127.0.0.1:{self.ui_port}"
        self.procs: list[dict] = []
        self.test_pg: dict | None = None

    def prepare_from_package(self, pkg: Path, without_catalog: bool = False, without_seed: bool = False) -> dict:
        """without_catalog: paczka BEZ spisu katalogu (instalator 2.6.0) - plikow spisu po prostu nie kopiujemy."""
        t0 = time.monotonic()
        for sub in ("apps/desktop", "apps/web", "scripts", "DATABASE", "PAMIEC-PODRECZNA", "runtime/win/python"):
            src = pkg / "bin" / Path(sub)
            if src.is_dir():
                robocopy(src, self.bin / Path(sub), ("__pycache__", "tests", "node_modules"),
                         tuple(CATALOG_FILES) if without_catalog and sub == "apps/web"
                         else (("users-seed.sqlite",) if without_seed and sub == "DATABASE" else ()))
        # "no-root" celowo NIE powstaje: komputer bez ROOT nie ma zadnego folderu do "wykrycia"
        for sub in ("state", "localappdata", "appdata", "tmp", "home", "logs", "reports", "launcher"):
            (self.dir / sub).mkdir(parents=True, exist_ok=True)
        (self.dir / "launcher" / "launcher_odbior.py").write_bytes((HERE / "launcher_odbior.py").read_bytes())
        if (self.dir / "app" / ".git").exists():  # program uznalby sie za drzewo deweloperskie (kopie bazy, git)
            raise RuntimeError("instancja nie moze zawierac .git")
        # Jedyne odstepstwo od paczki: bez sprawdzania aktualizacji (baner zaslania zrzuty).
        (self.desktop / "data").mkdir(parents=True, exist_ok=True)
        (self.desktop / "data" / "update-prefs.json").write_text(
            json.dumps({"auto_check": False, "notify_on_startup": False}), encoding="utf-8")
        return {"seconds": round(time.monotonic() - t0, 1)}

    def overlay_code(self, tree: Path) -> None:
        """Kod z kopii roboczej na wierzch drzewa z paczki (bez danych, konfiguracji i sekretow)."""
        skip = ["robocopy", "/E", "/R:1", "/W:1", "/MT:16", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"]
        for sub, xd in (("apps/desktop", ["data", "__pycache__", "tests"]),
                        ("apps/web", ["data", "node_modules", "__pycache__"]), ("scripts", ["__pycache__"])):
            src = tree / "bin" / Path(sub)
            if not src.is_dir():
                continue
            cmd = [skip[0], str(src), str(self.bin / Path(sub)), *skip[1:], "/XD", *xd,
                   "/XF", "machine-config.json", "pg-config*", "*.env", "*.sqlite", "*.sqlite-*", "*.secret", "*.log"]
            r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
            if r.returncode >= 8:
                raise RuntimeError(f"robocopy kod rc={r.returncode}: {r.stdout[-400:]}")

    def overlay_owner_data(self, owner_bin: Path) -> dict:
        """Dane zainstalowanego programu (tylko odczyt zrodla): spisy, wiersze, miniatury."""
        t0 = time.monotonic()
        cmd = ["robocopy", str(owner_bin / "apps" / "web" / "data"), str(self.web / "data"), "/E", "/R:1", "/W:1",
               "/MT:16", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/XD", "webview2-profile", "updates", "logs",
               "/XF", "dam-runtime.json", "dam-identity.json", "*.tmp", "*.lock"]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode >= 8:
            raise RuntimeError(f"robocopy dane rc={r.returncode}: {r.stdout[-400:]}")
        robocopy(owner_bin / "PAMIEC-PODRECZNA", self.bin / "PAMIEC-PODRECZNA")
        copied = []
        for name in ("dam-local.sqlite",):  # kopia spojna (backup API), nie kopiowanie pliku w uzyciu
            src = owner_bin / "DATABASE" / name
            if src.is_file():
                dst = self.bin / "DATABASE" / name
                dst.parent.mkdir(parents=True, exist_ok=True)
                a = sqlite3.connect(f"file:{src.as_posix()}?mode=ro", uri=True, timeout=10)
                b = sqlite3.connect(str(dst))
                try:
                    a.backup(b)
                finally:
                    a.close()
                    b.close()
                copied.append(name)
        return {"seconds": round(time.monotonic() - t0, 1), "sqlite": copied}

    def env(self, *, auth_rw: bool, t0: float, root: str = "", review: bool = False,
            keep: bool = False, blank: bool = False) -> dict[str, str]:
        d = self.dir
        env = {k: v for k, v in os.environ.items()
               if not k.startswith(("DAM_", "PG", "ODBIOR_")) and k not in ("PYTHONPATH", "PYTHONHOME")}
        user = f"odbior-{self.name.lower()}"
        env.update({
            # wlasna tozsamosc: machine_identity.py liczy machine_id m.in. z uzytkownika Windows
            "COMPUTERNAME": f"ODBIOR-{self.name}", "USERNAME": user, "USER": user, "LOGNAME": user,
            # baza: konfiguracja z paczki (sealed + autocode), KAZDA sesja tylko do odczytu
            "PGOPTIONS": "-c default_transaction_read_only=on", "PGAPPNAME": f"dam-odbior-{self.name}",
            "ODBIOR_AUTH_RW": "1" if auth_rw else "0", "ODBIOR_T0": repr(t0),
            "ODBIOR_SQL_LOG": str(OUT / "sql-zapisy.jsonl"),
            "DAM_STATE_DIR": str(d / "state"), "DAM_BRIDGE_PORT": str(self.bridge_port),
            "DAM_UI_ORIGIN": self.ui, "DAM_WEB_ROOT": str(self.web),
            # podglady: pobieranie z serwera przez HTTPS jak w programie; zadnej drogi zapisu
            "DAM_NAS_CACHE_PATH": str(d / "no-nas"), "DAM_NAS_SSH_HOST": "dam-odbior-no-ssh.invalid",
            "DAM_NAS_SSH_DEST": "/nonexistent/dam-odbior",
            "DAM_MARKETING_FALLBACKS": str(d / "no-fallback-root"),
            "DAM_MACHINE_CONFIG": str(d / "state" / "machine-config.json"),
            "DAM_REPORTS_ROOT": str(d / "reports"), "DAM_E2E_DESKTOP": str(self.desktop),
            "DAM_E2E_ALLOWED_ROOTS": root or str(d / "no-root"),
            "ODBIOR_BRIDGE_LOG": str(d / "logs" / "bridge.log"), "ODBIOR_OKNO_LOG": str(d / "logs" / "okno.log"),
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS": WEBVIEW_ARGS, "DAM_NO_SPLASH": "1",
            "ODBIOR_OWNER_PID": "" if keep else str(os.getpid()),
            "ODBIOR_START_BLANK": "1" if blank else "0",
            "ODBIOR_FLAGS_DIR": str(OUT / "przelaczniki"),
            # katalogi uzytkownika instancji: launcher wstawia je w moscie/UI/dbref, okno zostaje na prawdziwych
            "ODBIOR_DIR_LOCALAPPDATA": str(d / "localappdata"), "ODBIOR_DIR_APPDATA": str(d / "appdata"),
            "ODBIOR_DIR_TEMP": str(d / "tmp"), "ODBIOR_DIR_TMP": str(d / "tmp"),
            "ODBIOR_DIR_USERPROFILE": str(d / "home"), "ODBIOR_DIR_HOME": str(d / "home"),
            "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1",
        })
        if review:  # okno dla recenzentow na prawdziwym ROOT: nic nie przeglada i nic nie zmienia
            env.update({"ODBIOR_NO_SCAN": "1", "ODBIOR_HTTP_READONLY": "1"})
        if self.test_pg:  # pusta baza: schemat testowy w dam_eta_test (run_abc.setup_pg), haslo tylko w srodowisku
            env.pop("PGOPTIONS", None)
            env.update({"DAM_TEST_PG": "1", "DAM_PG_HOST": self.test_pg["host"], "DAM_PG_PORT": str(self.test_pg["port"]),
                        "DAM_PG_DBNAME": self.test_pg["dbname"], "DAM_PG_USER": self.test_pg["user"],
                        "DAM_PG_PASSWORD": self.test_pg["password"], "DAM_PG_SSLMODE": "require",
                        "PGOPTIONS": f"-csearch_path={self.test_pg['schema']},public", "ODBIOR_AUTH_RW": "0"})
        return env

    def launcher(self) -> str:
        return str(self.dir / "launcher" / "launcher_odbior.py")

    def dbref(self, env: dict, ask: dict | None = None) -> dict:
        t0 = time.monotonic()
        r = subprocess.run([str(self.python), "-u", self.launcher(), "dbref", json.dumps(ask or {})],
                           cwd=str(self.desktop), env=env, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=180, creationflags=BELOW_NORMAL)
        try:
            out = json.loads(r.stdout[r.stdout.index("{"):])
        except Exception:  # noqa: BLE001
            out = {"ok": False, "error": (r.stderr or r.stdout)[-600:]}
        out["seconds"] = round(time.monotonic() - t0, 2)
        return out

    def start(self, mode: str, env: dict, *args: str) -> None:
        lg = open(self.dir / "logs" / f"{mode}.log", "a", encoding="utf-8")
        lg.write(f"\n==== start {utc()} ====\n")
        lg.flush()
        p = subprocess.Popen([str(self.python), "-u", self.launcher(), mode, *args], cwd=str(self.desktop),
                             env=env, stdout=lg, stderr=subprocess.STDOUT, creationflags=FLAGS)
        self.procs.append({"role": f"{mode}-{self.name}", "pid": p.pid, "started_at": utc()})

    def get(self, path: str, timeout: float = 4.0) -> tuple[int, Any, float]:
        assert self.bridge_port not in FORBIDDEN_PORTS
        t0 = time.monotonic()
        try:
            with urllib.request.urlopen(self.bridge + path, timeout=timeout) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8") or "null"), time.monotonic() - t0
        except urllib.error.HTTPError as exc:
            return exc.code, None, time.monotonic() - t0
        except Exception as exc:  # noqa: BLE001
            return 0, {"error": str(exc)[:120]}, time.monotonic() - t0


def offscreen_xy() -> tuple[int, int]:
    """Miejsce poza wszystkimi monitorami: okno jest pokazane (nie zminimalizowane), ale nie zaslania pracy."""
    import ctypes

    gm = ctypes.windll.user32.GetSystemMetrics
    return gm(76) + gm(78) + 200, gm(77) + 100  # SM_XVIRTUALSCREEN + SM_CXVIRTUALSCREEN, SM_YVIRTUALSCREEN


def window_state(pids: set[int]) -> dict:
    """Okno pierwszego planu (czyje) i okna instancji (prostokat, zminimalizowane?). Bez tytulow cudzych okien."""
    import ctypes
    from ctypes import wintypes

    u = ctypes.windll.user32
    pid = wintypes.DWORD(0)
    fg = u.GetForegroundWindow()
    u.GetWindowThreadProcessId(fg, ctypes.byref(pid))
    out: dict[str, Any] = {"foreground_pid": int(pid.value), "foreground_is_instance": int(pid.value) in pids, "windows": []}

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def each(hwnd, _l):
        wp = wintypes.DWORD(0)
        u.GetWindowThreadProcessId(hwnd, ctypes.byref(wp))
        if int(wp.value) in pids and u.IsWindowVisible(hwnd):
            rc = wintypes.RECT()
            u.GetWindowRect(hwnd, ctypes.byref(rc))
            buf = ctypes.create_unicode_buffer(200)
            u.GetWindowTextW(hwnd, buf, 200)
            if rc.right - rc.left > 300:
                out["windows"].append({"pid": int(wp.value), "title": buf.value, "minimized": bool(u.IsIconic(hwnd)),
                                       "rect": [rc.left, rc.top, rc.right, rc.bottom]})
        return True

    u.EnumWindows(each, 0)
    return out


def list_own_processes(marker: Path) -> list[dict]:
    """Procesy, ktorych sciezka programu lub polecenie zawiera katalog TEGO przebiegu (pelna sciezka pod
    work\\<data>\\odbior\\). Nigdy po nazwie procesu."""
    ps = ("$m = $env:ODBIOR_MARK; Get-CimInstance Win32_Process | Where-Object { "
          "($_.ExecutablePath -and $_.ExecutablePath.Contains($m)) -or ($_.CommandLine -and $_.CommandLine.Contains($m)) } | "
          "Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Depth 3")
    env = dict(os.environ, ODBIOR_MARK=str(marker))
    r = subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=90, env=env)
    txt = (r.stdout or "").strip()
    if not txt:
        return []
    data = json.loads(txt)
    items = data if isinstance(data, list) else [data]
    out = []
    for it in items:
        cmd = str(it.get("CommandLine") or "")
        if int(it["ProcessId"]) == os.getpid() or "Get-CimInstance Win32_Process" in cmd:
            continue
        full = (str(it.get("ExecutablePath") or "") + " " + cmd).lower()
        out.append({"pid": int(it["ProcessId"]), "name": it.get("Name"), "cmd": cmd[:200],
                    "protected": any(mark in full.replace(str(marker).lower(), "") for mark in NEVER_KILL)})
    return out


def stop(instances: list[Instance], marker: Path) -> dict:
    """Zamyka WYLACZNIE procesy z katalogu tego przebiegu. Zapisany PID jest zamykany tylko wtedy, gdy
    proces o tym numerze nadal ma w poleceniu katalog przebiegu (Windows szybko uzywa numerow ponownie).
    Nigdy: DAM-build, staging instalatora, instalacja uzytkownika, procesy innych sesji."""
    marker_s = str(marker).lower()
    if "\\odbior\\" not in marker_s + "\\" or len(marker.parts) < 5:
        raise RuntimeError(f"odmowa sprzatania: {marker} nie jest katalogiem przebiegu odbioru")
    mine = {p["pid"]: p for p in list_own_processes(marker)}
    killed, skipped = [], []
    for inst in instances:
        for rec in inst.procs:
            pid = int(rec["pid"])
            if pid not in mine or mine[pid]["protected"]:
                skipped.append({**rec, "why": "PID nie nalezy juz do tego przebiegu" if pid not in mine else "chroniony"})
                continue
            r = subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, text=True,
                               encoding="utf-8", errors="replace")
            killed.append({**rec, "rc": r.returncode})
    time.sleep(2)
    left = [p for p in list_own_processes(marker) if not p["protected"]]
    for p in left:  # sieroty po oknie i moscie (WebView2, procesy potomne): tylko z katalogu tego przebiegu
        subprocess.run(["taskkill", "/PID", str(p["pid"]), "/F"], capture_output=True)
    if left:
        time.sleep(2)
    after = list_own_processes(marker)
    ports = {p: port_free(p) for inst in instances for p in (inst.bridge_port, inst.ui_port)}
    return {"killed": killed, "skipped": skipped, "orphans": left, "left_after": after, "ports_free": ports,
            "clean": not after and all(ports.values())}


# ----------------------------------------------------------------------------- os czasu


class Sampler(threading.Thread):
    def __init__(self, inst: Instance, t0: float, duration: float):
        super().__init__(daemon=True, name="odbior-sampler")
        self.inst, self.t0, self.duration = inst, t0, duration
        self.samples: list[dict] = []
        self.stop_flag = threading.Event()
        self._seen: dict[str, tuple[int, int]] = {}
        self.thumbs_dir = inst.bin / "PAMIEC-PODRECZNA" / "thumbs"
        self.t_health: float | None = None

    def _files(self) -> dict:
        out = {}
        for name in DATA_FILES:
            f = self.inst.web / "data" / name
            try:
                st = f.stat()
            except OSError:
                continue
            key = (st.st_size, st.st_mtime_ns)
            if self._seen.get(name) == key:
                continue
            rec: dict[str, Any] = {"size": st.st_size}
            try:
                if st.st_size < 120_000_000:
                    rec["sha256"] = sha256_file(f)
                if name == "file-index.json":
                    s = file_index_summary(f)
                    rec.update({k: s[k] for k in ("generated_at", "products", "ids_sha")})
                self._seen[name] = key
            except Exception as exc:  # noqa: BLE001 - plik w trakcie podmiany: nastepna probka
                rec["error"] = str(exc)[:80]
            out[name] = rec
        return out

    def _rows(self) -> dict | None:
        for db in self.inst.dir.rglob("dam-local.sqlite"):
            try:
                conn = sqlite3.connect(f"file:{db.as_posix()}?mode=ro", uri=True, timeout=0.3)
                try:
                    live, total = conn.execute(
                        "SELECT COALESCE(SUM(deleted = 0), 0), COUNT(*) FROM asset_rows").fetchone()
                    return {"live": int(live), "total": int(total)}
                finally:
                    conn.close()
            except sqlite3.Error:
                continue
        return None

    def _wait_bridge(self) -> None:
        """Pierwsza odpowiedz /health z dokladnoscia ~0,2 s (osobno od probek co 1 s)."""
        while not self.stop_flag.is_set() and time.time() - self.t0 < self.duration:
            try:
                with socket.create_connection(("127.0.0.1", self.inst.bridge_port), timeout=0.2):
                    pass
                if self.inst.get("/health", 2)[0] == 200:
                    self.t_health = round(time.time() - self.t0, 1)
                    return
            except OSError:
                pass
            time.sleep(0.2)

    def run(self) -> None:
        n = 0
        self._wait_bridge()
        while not self.stop_flag.is_set():
            t = time.time() - self.t0
            if t > self.duration:
                break
            rec: dict[str, Any] = {"t": round(t, 1)}
            files = self._files()
            if files:
                rec["files"] = files
            st, health, dt = self.inst.get("/health", 3)
            rec["health"] = {"status": st, "ms": round(dt * 1000)}
            if n % 2 == 0:
                st, snap, _ = self.inst.get("/index/snapshots", 3)
                if isinstance(snap, dict) and snap.get("keys"):
                    rec["snap"] = {k: {x: v.get(x) for x in ("source", "generation", "built_at", "built_by")}
                                   for k, v in snap["keys"].items() if isinstance(v, dict)}
                st, sync, _ = self.inst.get("/asset-sync/status", 3)
                if isinstance(sync, dict):
                    rec["sync"] = {k: sync.get(k) for k in ("mode", "ok", "last_ok", "pulled", "rev", "error", "phase")
                                   if k in sync}
            if n % 5 == 0:
                try:
                    rec["thumbs"] = sum(1 for _ in os.scandir(self.thumbs_dir))
                except OSError:
                    pass
                rows = self._rows()
                if rows:
                    rec["rows"] = rows
            self.samples.append(rec)
            with open(OUT / "os-czasu.jsonl", "a", encoding="utf-8") as fh:
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n += 1
            time.sleep(1.0 if t < 60 else 2.0)


def converged(samples: list[dict], want_fi: str | None, want_rows: int | None, pkg_grid: str | None) -> bool:
    """Lista = baza, wiersze pobrane, siatka przebudowana, a liczba miniatur stoi od 30 s."""
    if not samples:
        return False
    fi = first_t(samples, lambda s: s["files"]["file-index.json"]["sha256"] == want_fi) is not None
    rows = first_t(samples, lambda s: s["rows"]["live"] >= (want_rows or 10 ** 9)) is not None
    grid = first_t(samples, lambda s: s["files"]["branding-grid-index.json"]["sha256"] != pkg_grid) is not None
    th = [(s["t"], s["thumbs"]) for s in samples if "thumbs" in s]
    stable = len(th) > 2 and th[-1][1] == next((v for t, v in th if t >= th[-1][0] - 30), None)
    return fi and rows and grid and stable


def first_t(samples: list[dict], pred) -> float | None:
    for s in samples:
        try:
            if pred(s):
                return s["t"]
        except Exception:  # noqa: BLE001
            continue
    return None


def last_value(samples: list[dict], key: str):
    for s in reversed(samples):
        if key in s:
            return s[key]
    return None


# ----------------------------------------------------------------------------- konto i ekrany


def find_playwright() -> Path | None:
    base = Path(os.environ.get("LOCALAPPDATA") or "") / "npm-cache" / "_npx"
    for p in sorted(base.glob("*/node_modules/playwright/package.json")):
        return p.parent
    return None


def load_account(explicit: str | None, repo: Path) -> dict | None:
    """Konto testowe: plik konto.json wskazany w work\\<data>\\auth_test.py (KONTO = Path(r"...")).
    Hasla nie logujemy i nie zapisujemy - idzie tylko w zmiennej srodowiskowej procesu przegladarki."""
    path = Path(explicit) if explicit else None
    helper = None
    for cand in sorted(repo.glob("work/*/auth_test.py"), reverse=True):
        helper = cand
        if not path:
            m = re.search(r'KONTO\s*=\s*Path\(r"([^"]+)"\)', cand.read_text(encoding="utf-8"))
            path = Path(m.group(1)) if m else None
        break
    if not path or not path.is_file():
        return None
    acc = json.loads(path.read_text(encoding="utf-8"))
    shared = {}
    if helper and (helper.parent / "auth-test.json").is_file():
        ls = json.loads((helper.parent / "auth-test.json").read_text(encoding="utf-8")).get("ls") or {}
        shared = {"device_id": ls.get("dam_device_id")}
    return {"email": acc["email"], "password": acc["password"], "shared_device_id": shared.get("device_id"),
            "source": str(path)}


def session_of(ref: dict, device_id: str | None) -> dict | None:
    return next((s for s in ref.get("sessions") or [] if s.get("device_id") == device_id), None)


# ----------------------------------------------------------------------------- werdykt


def md_table(head: list[str], rows: list[list[Any]]) -> str:
    esc = lambda v: str(v if v is not None else "-").replace("|", "\\|").replace("\n", " ")  # noqa: E731
    return "\n".join(["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
                     + ["| " + " | ".join(esc(c) for c in r) + " |" for r in rows])


def read_sql_log(path: Path) -> list[dict]:
    out = []
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            try:
                out.append(json.loads(line))
            except ValueError:
                continue
    return out


def sql_summary(path: Path) -> tuple[list[list], list[list], list[list], int]:
    """(odrzucone przez serwer, wykonane, pominiete "utworz jesli nie ma", liczba wszystkich)."""
    groups: dict[str, dict[tuple, dict]] = {"blocked": {}, "done": {}, "skipped": {}}
    rows = read_sql_log(path)
    for r in rows:
        which = "skipped" if r.get("skipped") else ("blocked" if r.get("error") else "done")
        key = (r.get("kind"), r.get("table"), r.get("site"), (r.get("error") or "")[:70])
        d = groups[which].setdefault(key, {"n": 0, "first": r.get("t"), "sql": r.get("sql", "")[:110]})
        d["n"] += 1
    fmt = lambda dd: [[k[0], k[1], v["n"], v["first"], k[2], v["sql"], k[3]]  # noqa: E731
                      for k, v in sorted(dd.items(), key=lambda kv: kv[1]["first"] or 0)]
    return fmt(groups["blocked"]), fmt(groups["done"]), fmt(groups["skipped"]), len(rows)


def verdict_c(ctx: dict) -> str:
    pkg, ref0, ref1, samples, screens = ctx["package"], ctx["ref_before"], ctx["ref_after"], ctx["samples"], ctx["screens"]
    owner, final = ctx["owner"], ctx["final"]
    pfi = pkg["files"].get("file-index.json", {})
    snaps = ref1.get("snapshots") or ref0.get("snapshots") or {}
    dbfi = ref1.get("file_index") or ref0.get("file_index") or {}
    L: list[str] = []
    A = L.append
    A(f"# Werdykt testu odbioru - wariant C (swieza instalacja bez ROOT), DAM {ctx['version']}")
    A("")
    A(f"Przebieg: `{ctx['run_id']}`, {ctx['started']} - {utc()}. Paczka: `{ctx['package_dir']}`.")
    A(f"Instancja: most {ctx['bridge']}, UI {ctx['ui']}, komputer ODBIOR-C, urzadzenie `{ctx.get('device_id') or '?'}`.")
    A(f"Baza: `{ref0.get('db')}` jako `{ref0.get('usr')}`, sesje tylko do odczytu "
      f"(`default_transaction_read_only = {ref0.get('read_only')}`), logowanie: {'tak, konto testowe' if ctx['login'] else 'nie'}.")
    A("")

    # --- czasy zgodnosci
    def eq_t(fname: str) -> float | None:
        want = (snaps.get(SNAPSHOT_KEY[fname]) or {}).get("sha256")
        return first_t(samples, lambda s: s["files"][fname]["sha256"] == want) if want else None

    t_health = ctx.get("t_health")
    t_fi, t_si, t_ca, t_bs = (eq_t(n) for n in ("file-index.json", "search-index.json", "campaigns.json",
                                                "branding-search-index.json"))
    db_live = (ref1.get("assets") or {}).get("live")
    t_rows = first_t(samples, lambda s: s["rows"]["live"] >= (ref0.get("assets") or {}).get("live", 10 ** 9))
    rows_last = last_value(samples, "rows") or {}
    pkg_grid = pkg["files"].get("branding-grid-index.json", {}).get("sha256")
    t_grid = first_t(samples, lambda s: s["files"]["branding-grid-index.json"]["sha256"] != pkg_grid)
    thumbs0 = pkg.get("thumbs")
    thumbs_last = last_value(samples, "thumbs")
    t_thumbs = None
    prev = None
    for s in samples:
        if "thumbs" in s:
            if s["thumbs"] != prev:
                t_thumbs, prev = s["t"], s["thumbs"]
    fin_fi = final["files"].get("file-index.json", {})
    own_fi = owner.get("files", {}).get("file-index.json", {})
    list_equal = bool(dbfi.get("ids")) and fin_fi.get("ids") == dbfi.get("ids")

    A("## 1. Pomiar: po jakim czasie od startu mostu instancja ma to samo co baza")
    A("")
    A(f"Dowody tej tabeli (przebieg `{ctx['run_id']}`): os czasu `os-czasu.jsonl` (probki co 1-2 s: skroty plikow, liczba "
      "miniatur, wiersze), wzorzec `baza-przed.json` i `baza-po.json`, stan paczki `paczka.json`, stan koncowy "
      "`instancja-koniec.json`, program wlasciciela `wlasciciel.json`, log mostu `C\\logs\\bridge.log`.")
    A("")
    A(md_table(["Co", "W paczce (start)", "W bazie (wzorzec)", "Zgodne po", "Stan na koncu"], [
        ["most odpowiada na /health", "-", "-", f"{t_health} s" if t_health is not None else "NIE", "-"],
        ["lista produktow (file-index.json)",
         f"{pfi.get('products')} produktow, z {pfi.get('generated_at')}",
         f"{dbfi.get('products')} produktow, z {dbfi.get('generated_at')}, skrot {str((snaps.get('file-index') or {}).get('sha256'))[:12]}",
         f"{t_fi} s" if t_fi is not None else "NIE w czasie testu",
         f"{fin_fi.get('products')} produktow, skrot {str(fin_fi.get('sha256'))[:12]}, lista {'identyczna' if list_equal else 'ROZNA'}"],
        ["wyszukiwarka (search-index.json)", str(pkg["files"].get("search-index.json", {}).get("sha256"))[:12],
         str((snaps.get("search-index") or {}).get("sha256"))[:12], f"{t_si} s" if t_si is not None else "NIE w czasie testu",
         str(final["files"].get("search-index.json", {}).get("sha256"))[:12]],
        ["kampanie (campaigns.json)", str(pkg["files"].get("campaigns.json", {}).get("sha256"))[:12],
         str((snaps.get("campaigns") or {}).get("sha256"))[:12], f"{t_ca} s" if t_ca is not None else "NIE w czasie testu",
         str(final["files"].get("campaigns.json", {}).get("sha256"))[:12]],
        ["wyszukiwarka materialow (branding-search-index.json)",
         str(pkg["files"].get("branding-search-index.json", {}).get("sha256"))[:12],
         str((snaps.get("branding-search-index") or {}).get("sha256"))[:12],
         f"{t_bs} s" if t_bs is not None else "NIE w czasie testu",
         str(final["files"].get("branding-search-index.json", {}).get("sha256"))[:12]],
        ["wiersze materialow (lokalna kopia dam_assets)", "0", f"{db_live} zywych, rev {(ref1.get('assets') or {}).get('max_rev')}",
         f"{t_rows} s" if t_rows is not None else "NIE w czasie testu", f"{rows_last.get('live')} zywych / {rows_last.get('total')} wszystkich"],
        ["siatka materialow (branding-grid-index.json)",
         f"{pkg['files'].get('branding-grid-index.json', {}).get('size')} B",
         f"u wlasciciela {owner.get('files', {}).get('branding-grid-index.json', {}).get('size')} B",
         f"pierwsza przebudowa po {t_grid} s" if t_grid is not None else "NIE przebudowana w czasie testu",
         f"{final['files'].get('branding-grid-index.json', {}).get('size')} B, skrot "
         f"{'jak u wlasciciela' if final['files'].get('branding-grid-index.json', {}).get('sha256') == owner.get('files', {}).get('branding-grid-index.json', {}).get('sha256') else 'inny niz u wlasciciela'}"],
        ["miniatury (pliki w pamieci podrecznej)", thumbs0, f"spis w bazie {ref1.get('thumb_index_rows')}, u wlasciciela {owner.get('thumbs')}",
         f"ostatnia zmiana liczby po {t_thumbs} s" if t_thumbs is not None else "-", thumbs_last],
    ]))
    A("")
    A(f"Czas testu: ekrany {ctx['duration']} s, dane do {ctx.get('data_until')} s od startu programu. Odczyt wzorca z bazy przed startem (z aktywacja konfiguracji z paczki): "
      f"{ref0.get('seconds')} s. Wlasciciel (zainstalowany program na tym komputerze, tylko odczyt plikow): lista "
      f"{own_fi.get('products')} produktow z {own_fi.get('generated_at')}.")
    A("")

    # --- ekrany
    A("## 2. Okno programu: Pulpit i Projekty w czasie")
    A("")
    shots = (screens or {}).get("shots") or []
    stale_unmarked = []
    rows = []
    for s in shots:
        i = s.get("info") or {}
        fi = i.get("file_index_in_page") or {}
        from_pkg = bool(fi) and fi.get("generated_at") == pfi.get("generated_at") and pfi.get("generated_at") != dbfi.get("generated_at")
        labels = "; ".join((i.get("index_source_labels") or []) + ([i["status_projects"]] if i.get("status_projects") else []))
        said = " ".join(i.get("source_lines") or []) + " " + labels
        marked = bool(re.search(r"paczk|instalator|nieaktualn|pobieran|aktualizuj", said, re.I))
        if from_pkg and not marked:
            stale_unmarked.append(s)
        page = Path((i.get("url") or "").split("?")[0]).name or "-"
        nav = s.get("navigation") or {}
        rows.append([f"{s.get('planned_s')} s ({s.get('actual_s')})", s.get("name"), Path(s.get("file") or "-").name, page,
                     f"{i.get('loaded_at_s')} s" if i.get("loaded_at_s") is not None else "-",
                     f"{fi.get('products')} z {fi.get('generated_at')}" if fi else (i.get("error") or "brak listy w stronie"),
                     "Z PACZKI" if from_pkg else ("z bazy" if fi and fi.get("generated_at") == dbfi.get("generated_at") else "-"),
                     len(fi.get("kreatyna") or []) if fi else "-", i.get("project_cards"),
                     f"{i.get('thumbs_loaded')}/{i.get('thumbs_total')}", labels[:110] or "-",
                     f"tresc po {nav.get('content_ready_after_s')} s" if nav else "-",
                     f"{s.get('shot_ms')}/{s.get('info_ms')}"])
    lg = (screens or {}).get("login") or {}
    win = ctx.get("window") or {}
    if rows:
        A(md_table(["Sekunda (faktyczna)", "Zrzut", "Plik", "Strona", "Strona wczytana w", "Lista w stronie", "Zrodlo",
                    "Kulki z kreatyna", "Karty projektow", "Miniatury zaladowane", "Co ekran mowi o zrodle",
                    "Wejscie na ekran", "Zrzut/odczyt ms"], rows))
        A("")
        A(f"Zebrane w OKNIE PROGRAMU przez CDP ({(screens or {}).get('cdp')}), nie w przegladarce. CDP odpowiada po "
          f"{(screens or {}).get('cdp_connected_s')} s, pierwsza strona po {(screens or {}).get('first_page_s')} s. "
          f"Logowanie: formularz widoczny po {lg.get('form_visible_s')} s, wyslany po {lg.get('submitted_s')} s, Pulpit po "
          f"{lg.get('dashboard_s')} s (ok={lg.get('ok')}{', blad: ' + str(lg.get('error')) if lg.get('error') else ''}).")
        A(f"\"okno\" = to, co bylo widac w tej sekundzie bez dotykania; \"po-wejsciu\" = po przejsciu na ten ekran. "
          f"Klatki na sekunde w oknie: {[(f.get('label'), f.get('frames_per_s')) for f in (screens or {}).get('fps') or []]} "
          "(okolo 60 = okno nie jest dlawione; okolo 1 = pomiar falszywy).")
        A(f"Okno: {win.get('windows')}; zminimalizowane: {any(w.get('minimized') for w in win.get('windows') or [])}; "
          f"okno pierwszego planu nalezalo do instancji w {sum(1 for f in ctx.get('focus') or [] if f.get('foreground_is_instance'))} "
          f"z {len(ctx.get('focus') or [])} probek (0 = nie zabralo fokusu). Zadania przerwane do DAM uzytkownika "
          f"(8765/8766): {(screens or {}).get('blocked_production_requests') or 0}. Odpowiedzi z bledem: {(screens or {}).get('failed_responses') or 'brak'}.")
    else:
        A("Zrzutow nie zrobiono (" + str((screens or {}).get("error") or "--bez-okna albo brak modulu playwright") + ").")
    A("")
    if stale_unmarked:
        A(f"**Okno pokazalo dane z paczki bez oznaczenia** ({len(stale_unmarked)} zrzutow), pierwszy: "
          f"`{Path(stale_unmarked[0]['file']).name}` w {stale_unmarked[0].get('actual_s')} s, ostatni: "
          f"`{Path(stale_unmarked[-1]['file']).name}` w {stale_unmarked[-1].get('actual_s')} s - lista z "
          f"{pfi.get('generated_at')} ({pfi.get('products')} produktow), a ekran nie mowi, ze to dane z instalatora.")
        A("")
    A("### Ogledziny zrzutow")
    A("")
    A("DO UZUPELNIENIA przez uruchamiajacego: otworz kazdy zrzut (narzedzie Read) i opisz, co widac. Liczby wyzej pochodza z DOM, nie z obrazu.")
    A("")

    # --- warunki z rozdzialu 11
    c7_data = t_fi is not None and list_equal
    c7 = "SPELNIONY" if c7_data and not stale_unmarked and shots else ("NIESPELNIONY" if (not c7_data or stale_unmarked) else "JESZCZE NIE")
    c7_ev = (f"lista zgodna z baza po {t_fi} s; " if c7_data else "lista NIE zgodna z baza w czasie testu; ") + \
            (f"przedtem {len(stale_unmarked)} zrzutow z danymi z paczki bez oznaczenia" if stale_unmarked
             else ("zaden zrzut nie pokazal danych z paczki bez oznaczenia" if shots else "brak zrzutow - ekrany niesprawdzone"))
    need_ab = "wymaga instancji A i B oraz bazy, do ktorej wolno pisac (decyzja kierownika) - patrz --wariant AB"
    A("## 3. Warunki z rozdzialu 11 projektu synchronizacji")
    A("")
    A(md_table(["#", "Warunek", "Wynik", "Dowod"], [
        [1, "A, B i C pokazuja ten sam numer wersji i te sama liste", "JESZCZE NIE",
         "program tej wersji nie pokazuje numeru wersji katalogu na ekranach; czesc C (lista = baza): " + ("tak" if list_equal else "nie") + "; A i B: " + need_ab],
        [2, "Podlaczenie B nie usuwa ani nie ukrywa niczego; nowy plik B u wszystkich z oznaczeniem", "JESZCZE NIE", need_ab],
        [3, "Usuniecie pliku w A znika u wszystkich w 3 minuty", "JESZCZE NIE", need_ab],
        [4, "Usuniecie pliku w B niczego nie zmienia, dopoki A nie potwierdzi", "JESZCZE NIE", need_ab],
        [5, "Odlaczenie dysku A w trakcie pracy niczego nie usuwa", "JESZCZE NIE", need_ab],
        [6, "Przeniesienie folderu w A zachowuje skojarzenia", "JESZCZE NIE", need_ab],
        [7, "C po instalacji i zalogowaniu widzi to samo co A, bez ROOT", c7, c7_ev + " (wzorzec = baza i program wlasciciela)"],
    ]))
    A("")

    # --- zapisy
    blocked, done, skipped_ddl, total = sql_summary(OUT / "sql-zapisy.jsonl")
    A("## 4. Co swieza instalacja probuje zapisac do bazy sama z siebie")
    A("")
    A(f"Dziennik `sql-zapisy.jsonl`: {total} polecen innych niz czysty odczyt. Polecenia nieudane (serwer odrzucil, sesja tylko do odczytu):")
    A("")
    A(md_table(["Polecenie", "Tabela", "Ile razy", "Pierwszy raz (s)", "Miejsce w kodzie", "Poczatek polecenia", "Odpowiedz serwera"], blocked)
      if blocked else "Brak - instancja nie probowala niczego zapisac.")
    A("")
    objs = ref1.get("objects") or {}
    missing = [k for k, v in objs.items() if not v]
    A("Polecenia \"utworz, jesli nie ma\" (tabela, indeks, sekwencja, kolumna), ktore program wysyla przy kazdym starcie. "
      "Test ich NIE wysyla (w sesji tylko do odczytu serwer by je odrzucil i program przerwalby cykl, czego na prawdziwym "
      f"komputerze nie ma). Sprawdzone odczytem po tescie: {len(objs) - len(missing)} z {len(objs)} obiektow istnieje w bazie"
      + (f"; BRAK: {missing} - dla nich pominiecie NIE bylo rownowazne" if missing
         else ", wiec na prawdziwym komputerze te polecenia nic nie zmieniaja") + ".")
    A("")
    A(md_table(["Polecenie", "Tabela", "Ile razy", "Pierwszy raz (s)", "Miejsce w kodzie", "Poczatek polecenia", ""], skipped_ddl)
      if skipped_ddl else "Brak.")
    A("")
    A("Polecenia wykonane (tylko polaczenia logowania maja prawo zapisu):")
    A("")
    A(md_table(["Polecenie", "Tabela", "Ile razy", "Pierwszy raz (s)", "Miejsce w kodzie", "Poczatek polecenia", ""], done)
      if done else "Brak.")
    A("")

    # --- sesje
    A("## 5. Dowod, ze test nie naruszyl cudzej sesji ani katalogu")
    A("")
    sd = ctx.get("shared_device_id")
    s0, s1, s2 = (session_of(r, sd) for r in (ref0, ctx.get("ref_login") or {}, ref1))
    if sd:
        A(md_table(["Chwila", "Wiersz urzadzenia ze wspolnego tokenu", "Skrot skrotu tokenu", "Odwolany"], [
            ["przed startem", "jest" if s0 else "BRAK", (s0 or {}).get("token_hash_sha256"), (s0 or {}).get("revoked")],
            ["po logowaniu instancji", "jest" if s1 else ("-" if not ctx["login"] else "BRAK"), (s1 or {}).get("token_hash_sha256"), (s1 or {}).get("revoked")],
            ["po tescie", "jest" if s2 else "BRAK", (s2 or {}).get("token_hash_sha256"), (s2 or {}).get("revoked")],
        ]))
        same = bool(s0 and s2) and s0["token_hash_sha256"] == s2["token_hash_sha256"]
        A("")
        A(f"Token wspolnej sesji testowej: {'BEZ ZMIAN' if same else 'ZMIENIONY albo brak wiersza - sprawdz'}.")
    own = [s for s in (ref1.get("sessions") or []) if s.get("hostname") and s.get("windows_user", "").startswith("odbior-")]
    A(f"Wiersze sesji instancji testowej po tescie: {[{k: s[k] for k in ('device_id', 'revoked', 'windows_user')} for s in own] or 'brak'}.")
    A(f"Katalog w bazie przed/po: dam_assets rev {(ref0.get('assets') or {}).get('max_rev')} -> {(ref1.get('assets') or {}).get('max_rev')}, "
      f"generacja listy produktow {(ref0.get('snapshots') or {}).get('file-index', {}).get('generation')} -> "
      f"{(ref1.get('snapshots') or {}).get('file-index', {}).get('generation')} (zmiany pochodza od wlasciciela katalogu; "
      f"instancja testowa nie ma prawa zapisu).")
    A("")
    A("## 6. Sprzatanie")
    A("")
    cl = ctx.get("cleanup") or {}
    A(f"Procesy zatrzymane: {len(cl.get('killed') or [])}, sieroty dobite: {len(cl.get('orphans') or [])}, "
      f"zostalo: {len(cl.get('left_after') or [])}, porty wolne: {cl.get('ports_free')}. Czysto: **{cl.get('clean')}**.")
    A(f"Pliki zostaja jako dowod: `{OUT}` (instancja z kopia paczki i miniaturami: `{OUT / 'C'}`).")
    A("")
    A("## 7. Czego ten przebieg NIE sprawdzil")
    A("")
    A("- Instalatora (Setup.exe) i czystego Windows: instancja to kopia katalogu paczki uruchomiona na komputerze wlasciciela.")
    A("- Aktywacji w sieci, ktora blokuje port bazy; pracy bez internetu.")
    A("- Warunkow 1-6 (instancje A i B) - czekaja na baze testowa.")
    A("- Zachowania po kliknieciach uzytkownika: test tylko otwiera Pulpit i Projekty.")
    A("- Zapisow, ktore swieza instalacja robi PO zalogowaniu poza logowaniem - sa zablokowane i wypisane w sekcji 4, wiec ich skutkow nie widac.")
    return "\n".join(L) + "\n"


# ----------------------------------------------------------------------------- wariant C


def setup_empty_test_db() -> dict:
    """Pusty katalog w bazie testowej: nowy schemat odbior_* w dam_eta_test (rola z DAM_TEST_PG_USER),
    tabele i bramka wlasciciela jak w run_abc.setup_pg, jedno konto admina. Wymaga zmiennych z
    C:\\Users\\...\\.claude\\mcp\\dam-pg\\test_dsn.py -- <polecenie> (haslo tylko w srodowisku)."""
    need = ("DAM_TEST_PG_HOST", "DAM_TEST_PG_PORT", "DAM_TEST_PG_USER", "DAM_TEST_PG_PASSWORD")
    missing = [k for k in need if not os.environ.get(k)]
    if missing:
        raise SystemExit("--baza pusta: brak " + ", ".join(missing) + " - uruchom przez test_dsn.py -- python odbior.py ...")
    sys.path.insert(0, str(E2E))
    import run_abc as R  # noqa: PLC0415

    schema = "odbior_" + datetime.now().strftime("%Y%m%d_%H%M%S")
    R.SECRETS_DIR, R.OUT_BASE = OUT / "_sekrety", OUT
    R._STATE.update({"run_id": "baza-testowa", "schema": schema})  # noqa: SLF001
    R.save_state = lambda: None
    rep_ = R.setup_pg()
    write_json("baza-testowa.json", {k: rep_[k] for k in ("schema", "who", "gate", "admin_user_id", "seconds")})
    return {"host": R.PG_HOST, "port": R.PG_PORT, "dbname": R.PG_DB, "user": R.PG_USER,
            "password": os.environ["DAM_TEST_PG_PASSWORD"], "schema": schema, "email": R.ADMIN_EMAIL,
            "admin_password": (R.SECRETS_DIR / "e2e-admin.secret").read_text(encoding="utf-8").strip()}


def out_base(repo: Path) -> Path:
    return Path(os.environ.get("DAM_ODBIOR_OUT") or (repo / "work" / datetime.now().strftime("%Y-%m-%d") / "odbior"))


def run_c(args) -> int:
    """Wariant C (swieza instalacja z paczki) albo okno testowe (--okno-testowe: kod z --kod, ROOT M:)."""
    global OUT
    repo = repo_root()
    review = bool(args.okno_testowe)
    name = "W" if review else "C"
    pkg = find_package(args.wersja, args.paczka)
    version = json.loads((pkg / "bin" / "apps" / "web" / "version.json").read_text(encoding="utf-8")).get("version")
    if review and args.kod:
        version = json.loads((Path(args.kod) / "bin" / "apps" / "web" / "version.json").read_text(encoding="utf-8")).get("version")
    run_id = f"{'OKNO' if review else 'C'}-{version}-{datetime.now().strftime('%H%M%S')}"
    OUT = out_base(repo) / run_id
    OUT.mkdir(parents=True, exist_ok=True)
    started = utc()
    inst = Instance(name, OUT)
    cdp_port = args.cdp or CDP_PORTS[name]
    for port in (inst.bridge_port, inst.ui_port, cdp_port):
        if port in FORBIDDEN_PORTS or port == 9333 or not port_free(port):
            raise SystemExit(f"port {port} zajety albo zakazany - inny przebieg jeszcze dziala? (--stop <katalog>)")
    log(f"przebieg {run_id}; paczka {pkg}")
    package = describe_data(pkg / "bin" / "apps" / "web" / "data", pkg / "bin" / "PAMIEC-PODRECZNA" / "thumbs")
    write_json("paczka.json", package)
    prep = inst.prepare_from_package(pkg, without_catalog=bool(args.bez_spisu), without_seed=bool(args.bez_kont_startowych))
    log(f"instancja skopiowana z paczki w {prep['seconds']} s" + (" (BEZ spisu katalogu)" if args.bez_spisu else ""))
    if args.kod and not review:
        inst.overlay_code(Path(args.kod))
        version = json.loads((Path(args.kod) / "bin" / "apps" / "web" / "version.json").read_text(encoding="utf-8")).get("version")
        log(f"kod z kopii roboczej: {args.kod} (wersja w plikach: {version})")
    if args.bez_spisu:
        package = describe_data(inst.web / "data", inst.bin / "PAMIEC-PODRECZNA" / "thumbs")
        write_json("paczka.json", package)
    owner_base = Path(os.environ.get("LOCALAPPDATA") or "") / "Programs" / "DAM" / "bin"
    root = ""
    if review:
        if args.kod:
            inst.overlay_code(Path(args.kod))
            log(f"kod z kopii roboczej: {args.kod}")
        log(f"dane wlasciciela skopiowane: {inst.overlay_owner_data(owner_base)}")
        root = args.root
        user = f"odbior-{name.lower()}"
        (inst.dir / "state" / "machine-config.json").write_text(json.dumps(
            {"users": {user: {"base_path": root, "updated_at": utc(), "root_generation": 1}}}, indent=2), encoding="utf-8")

    (OUT / "przelaczniki").mkdir(exist_ok=True)
    for name in [x.strip().upper() for x in (args.start_z or "").split(",") if x.strip()]:
        (OUT / "przelaczniki" / name).write_text(utc(), encoding="utf-8")
        log(f"przelacznik na starcie: {name}")
    if args.baza == "pusta":
        inst.test_pg = setup_empty_test_db()
        log(f"pusta baza testowa: schemat {inst.test_pg['schema']} w {inst.test_pg['dbname']} (rola {inst.test_pg['user']})")
    account = load_account(args.konto, repo) if args.login and not inst.test_pg else None
    if inst.test_pg and args.login:  # konto admina schematu testowego (jednorazowe, z run_abc.setup_pg)
        account = {"email": inst.test_pg["email"], "password": inst.test_pg["admin_password"], "shared_device_id": None}
    if args.login and not account:
        raise SystemExit("--login: nie znalazlem pliku konto.json (work\\<data>\\auth_test.py -> KONTO) - podaj --konto")
    ask = {"file_index": True}
    if account:
        ask["email"] = account["email"]
    env0 = inst.env(auth_rw=False, t0=time.time(), root=root, review=review)
    ref0 = inst.dbref(env0, ask)
    write_json("baza-przed.json", ref0)
    if not ref0.get("ok") or (ref0.get("read_only") != "on" and not inst.test_pg):
        log(f"STOP: brak polaczenia tylko do odczytu z baza: {ref0.get('error') or ref0.get('read_only')}")
        return 2
    if inst.test_pg and ref0.get("db") != inst.test_pg["dbname"]:
        log(f"STOP: tryb pustej bazy, a polaczenie trafilo do {ref0.get('db')}")
        return 2
    log(f"baza: {ref0.get('db')} tylko do odczytu, lista produktow {ref0.get('file_index', {}).get('products')}, "
        f"wiersze {ref0.get('assets', {}).get('live')}")
    shared = account.get("shared_device_id") if account else None
    if account and shared and not session_of(ref0, shared):
        log(f"STOP: wiersz wspolnej sesji testowej ({shared}) nie istnieje w device_sessions - nie loguje sie")
        return 3

    pw = None if args.bez_okna else find_playwright()
    x, y = (120, 80) if args.okno_widoczne else offscreen_xy()
    t0 = time.time()
    env = inst.env(auth_rw=bool(account), t0=t0, root=root, review=review, keep=bool(args.zostaw),
                   blank=bool(pw) and not args.bez_okna and not args.cdp_od)
    data_until = max(args.czas, args.czas_danych)
    sampler = Sampler(inst, t0, data_until + 30)
    screens: dict[str, Any] = {}
    node = None
    ref_login: dict = {}
    rc = 0
    cleanup: dict = {}
    focus: list[dict] = []
    window: dict = {}
    leave = False
    try:
        if args.bez_okna:
            inst.start("bridge", env)
            inst.start("ui", env, str(inst.ui_port), str(inst.bridge_port))
            screens = {"error": "--bez-okna: sam most i serwer UI, bez ekranu"}
        else:
            inst.start("okno", env, str(inst.ui_port), str(inst.bridge_port), str(cdp_port), str(x), str(y))
        sampler.start()
        log(f"program uruchomiony (t0); ekrany {args.czas} s, dane do {data_until} s; CDP http://127.0.0.1:{cdp_port}")
        if pw and not args.bez_okna:
            cfg = {"playwright": str(pw), "out": str(OUT / "ekrany"), "cdp": f"http://127.0.0.1:{cdp_port}",
                   "t0_ms": int(t0 * 1000), "points": [p for p in POINTS if p <= args.czas], "login": bool(account),
                   "keep_session": bool(args.zostaw), "connect_delay_s": args.cdp_od,
                   "start_url": "" if args.cdp_od else inst.ui + "/dashboard.html"}
            cfg_path = OUT / "ekrany-config.json"
            cfg_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
            nenv = dict(os.environ)
            if account:  # haslo tylko w srodowisku procesu sterujacego oknem, nigdy na dysku
                nenv["ODBIOR_EMAIL"], nenv["ODBIOR_PASSWORD"] = account["email"], account["password"]
            node = subprocess.Popen(["node", str(HERE / "ekrany_okno.cjs"), str(cfg_path)], env=nenv,
                                    stdout=open(OUT / "ekrany.log", "w", encoding="utf-8"), stderr=subprocess.STDOUT,
                                    creationflags=FLAGS)
        elif not args.bez_okna:
            screens = {"error": "brak modulu playwright w npm-cache (potrzebny tylko do polaczenia CDP)"}
        checked = False
        want_fi = ((ref0.get("snapshots") or {}).get("file-index") or {}).get("sha256")
        want_rows = (ref0.get("assets") or {}).get("live")
        pkg_grid = package["files"].get("branding-grid-index.json", {}).get("sha256")
        while True:
            time.sleep(1)
            t = time.time() - t0
            if not args.bez_okna and t < 62 and (not focus or t - focus[-1]["t"] >= 5):
                st = window_state({x["pid"] for x in list_own_processes(OUT)})
                st["t"] = round(t, 1)
                window = st if st["windows"] else window
                focus.append(st)
            if account and shared and not checked and (OUT / "ekrany" / "ekrany.json").is_file():
                try:
                    lg = json.loads((OUT / "ekrany" / "ekrany.json").read_text(encoding="utf-8")).get("login") or {}
                except ValueError:
                    lg = {}
                if "ok" in lg:
                    checked = True
                    ref_login = inst.dbref(env0, {"email": account["email"]})
                    write_json("baza-po-logowaniu.json", ref_login)
                    a, b = session_of(ref0, shared), session_of(ref_login, shared)
                    if not b or a["token_hash_sha256"] != b["token_hash_sha256"]:
                        log("STOP: token wspolnej sesji testowej zmienil sie po logowaniu instancji - przerywam")
                        rc = 3
                        break
                    log("logowanie instancji nie zmienilo tokenu wspolnej sesji testowej")
            node_done = node is None or node.poll() is not None
            if args.zostaw and node_done and t >= min(args.czas, 20):
                break
            if t >= args.czas + 6 and node_done and (t >= data_until or converged(sampler.samples, want_fi, want_rows, pkg_grid)):
                break
            if t > data_until + 90:
                break
        data_until = round(time.time() - t0)
        leave = bool(args.zostaw) and rc == 0
    finally:
        if leave:
            write_json("fokus.json", focus)
            write_json("okno.json", {"cdp": f"http://127.0.0.1:{cdp_port}", "ui": inst.ui, "bridge": inst.bridge,
                                     "procs": inst.procs, "run_dir": str(OUT), "started": started})
            log(f"OKNO ZOSTAJE: CDP http://127.0.0.1:{cdp_port} ; zatrzymanie: python odbior.py --stop \"{OUT}\"")
            return 0
        sampler.stop_flag.set()
        if node and node.poll() is None:
            subprocess.run(["taskkill", "/PID", str(node.pid), "/T", "/F"], capture_output=True)
        skipped = sorted({o for r in read_sql_log(OUT / "sql-zapisy.jsonl") if r.get("skipped")
                          for o in r.get("objects") or []})
        ref1 = inst.dbref(env0, {**ask, "objects": skipped, "databases": True})
        write_json("baza-po.json", ref1)
        cleanup = stop([inst], OUT)
        write_json("sprzatanie.json", cleanup)
        log(f"sprzatanie: czysto={cleanup['clean']}")
    if (OUT / "ekrany" / "ekrany.json").is_file():
        screens = json.loads((OUT / "ekrany" / "ekrany.json").read_text(encoding="utf-8"))
    write_json("fokus.json", focus)
    final = describe_data(inst.web / "data", inst.bin / "PAMIEC-PODRECZNA" / "thumbs")
    write_json("instancja-koniec.json", final)
    owner = describe_data(owner_base / "apps" / "web" / "data", owner_base / "PAMIEC-PODRECZNA" / "thumbs") \
        if owner_base.is_dir() else {"files": {}}
    write_json("wlasciciel.json", owner)
    ctx = {"version": version, "run_id": run_id, "started": started, "package_dir": str(pkg), "package": package,
           "ref_before": ref0, "ref_login": ref_login, "ref_after": ref1, "samples": sampler.samples, "screens": screens,
           "owner": owner, "final": final, "login": bool(account), "shared_device_id": shared,
           "device_id": ((screens.get("login") or {}).get("device") or {}).get("device_id"),
           "bridge": inst.bridge, "ui": inst.ui, "duration": args.czas, "data_until": data_until, "cleanup": cleanup,
           "t_health": sampler.t_health, "focus": focus, "window": window}
    (OUT / "WERDYKT.md").write_text(verdict_c(ctx), encoding="utf-8")
    log(f"WERDYKT: {OUT / 'WERDYKT.md'}")
    return rc if rc else (0 if cleanup.get("clean") else 5)


def stop_run(run_dir: str) -> int:
    """Zatrzymaj okno zostawione przez --zostaw (tylko procesy z katalogu tego przebiegu)."""
    global OUT
    OUT = Path(run_dir)
    meta = json.loads((OUT / "okno.json").read_text(encoding="utf-8")) if (OUT / "okno.json").is_file() else {}
    name = "W" if (OUT / "W").is_dir() else "C"
    inst = Instance(name, OUT)
    inst.procs = meta.get("procs") or []
    pw = find_playwright()
    if pw and meta.get("cdp"):  # jedna sesja na przebieg, zawsze zamknieta: wylogowanie w oknie przed zatrzymaniem
        cfg_path = OUT / "wyloguj-config.json"
        cfg_path.write_text(json.dumps({"playwright": str(pw), "out": str(OUT / "ekrany"), "cdp": meta["cdp"],
                                        "t0_ms": int(time.time() * 1000), "only_logout": True,
                                        "connect_timeout_s": 10}), encoding="utf-8")
        r = subprocess.run(["node", str(HERE / "ekrany_okno.cjs"), str(cfg_path)], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=60)
        log(f"wylogowanie w oknie: {(r.stdout or r.stderr).strip()[-200:]}")
    rep_ = stop([inst], OUT)
    write_json("sprzatanie.json", rep_)
    log(f"zatrzymane: czysto={rep_['clean']}")
    return 0 if rep_["clean"] else 5


# ----------------------------------------------------------------------------- warianty A i B (przygotowanie)


def prepare_ab(args) -> int:
    """Fixtury i drzewa instancji A (ROOT wzorcowy) i B (nieaktualna kopia) pod work\\. Bez bazy, bez startu."""
    global OUT
    repo = repo_root()
    run_id = f"AB-{datetime.now().strftime('%H%M%S')}"
    OUT = Path(os.environ.get("DAM_ODBIOR_OUT") or (repo / "work" / datetime.now().strftime("%Y-%m-%d") / "odbior")) / run_id
    OUT.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(E2E))
    import fixtures as F  # noqa: PLC0415

    F.TESTROOTS = OUT / "fixtury"  # _guard pilnuje, zeby nic nie powstalo poza tym katalogiem
    m_root, x_root = F.TESTROOTS / "M", F.TESTROOTS / "X"
    m = F.build_m(m_root, time.time() - 2 * 86400)
    x = F.build_x(m_root, x_root)
    # rozdzial 11: B "ma jeden wlasny nowy plik"
    own = f"{F.GRAF}/Baner Figa z makiem/Baner Figa z makiem 600x600 (tylko B).png"
    F._png(F._guard(x_root / own), (30, 30, 160), "Tylko B")  # noqa: SLF001
    report = {"m_root": str(m_root), "x_root": str(x_root), "m_files": len(m), "x_copied": len(x["copied"]),
              "x_missing": x["skipped"], "x_older": list(x["older"]), "x_own_new_file": own, "instances": {}}
    if args.wersja or args.paczka:
        pkg = find_package(args.wersja, args.paczka)
        for name, root in (("A", m_root), ("B", x_root)):
            inst = Instance(name, OUT)
            inst.prepare_from_package(pkg)
            user = f"odbior-{name.lower()}"
            (inst.dir / "state" / "machine-config.json").write_text(json.dumps(
                {"users": {user: {"base_path": str(root), "updated_at": utc(), "root_generation": 1}}},
                ensure_ascii=False, indent=2), encoding="utf-8")
            report["instances"][name] = {"dir": str(inst.dir), "root": str(root), "ports": PORTS[name]}
    report["next"] = ("uruchomienie A/B wymaga bazy z prawem zapisu: python odbior.py --wariant AB --baza test "
                      "(po decyzji kierownika i z haslem roli dam_test w DAM_TEST_PG_SECRET)")
    write_json("przygotowanie-ab.json", report)
    log(f"fixtury A/B gotowe: {OUT}")
    return 0


def _subst_mount(target: Path) -> str:
    """Podpina katalog pod pierwsza wolna litere dysku (subst). Zwraca litere. Plikow nie przenosi."""
    for letter in "QRKLNOJ":
        if os.path.exists(f"{letter}:\\"):
            continue
        r = subprocess.run(["subst", f"{letter}:", str(target)], capture_output=True, text=True)
        if r.returncode == 0 and os.path.isdir(f"{letter}:\\"):
            log(f"fixtury podpiete jako litera {letter} -> {target}")
            return letter
    raise SystemExit("brak wolnej litery dysku dla fixtur (subst)")


def _subst_unmount(letter: str) -> None:
    r = subprocess.run(["subst", f"{letter}:", "/D"], capture_output=True, text=True)
    log(f"litera {letter}: odpieta (rc={r.returncode})")


def run_ab(args) -> int:
    """Pelny przebieg A/B/C na bazie testowej = run_abc.py z katalogami przeniesionymi pod work.
    Haslo roli testowej tylko w srodowisku (test_dsn.py -- ...) albo z pliku DAM_TEST_PG_SECRET."""
    global OUT
    secret = Path(os.environ.get("DAM_TEST_PG_SECRET") or "D:/DAM-lokalne/testpg/nas-dam_test.secret")
    if args.baza != "test" or not (os.environ.get("DAM_TEST_PG_PASSWORD") or secret.is_file()):
        print("Wariant AB zapisuje do bazy, wiec idzie tylko na bazie testowej dam_eta_test:")
        print("  python <profil>/.claude/mcp/dam-pg/test_dsn.py -- python odbior.py --wariant AB --baza test")
        print("Bez tego uruchom --przygotuj (fixtury i drzewa instancji, bez bazy).")
        return 2
    repo = repo_root()
    OUT = out_base(repo) / f"ABC-{datetime.now().strftime('%H%M%S')}"
    OUT.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(E2E))
    import fixtures as F  # noqa: PLC0415
    import run_abc as R  # noqa: PLC0415

    R.LOKALNE = OUT
    # Fixtury leza w work\ (zasada wlasciciela), ale instancje widza je przez tymczasowa litere dysku:
    # sciezka ROOT bez 'Marketing' i bez drugiego '- POLSKA' (klucze plikow i podgladow licza sie od tych
    # segmentow - przy fixturach pod D:\Marketing\- POLSKA\...\work S3 i S6b padaly, diagnoza 07.10.2026).
    fix_dir = OUT / "fixtury"
    fix_dir.mkdir(parents=True, exist_ok=True)
    # Litera wskazuje katalog przebiegu, a ROOT-y leza w jej podkatalogu: bezpieczniki run_abc
    # (_inside) nie obsluguja bazy bedacej korzeniem dysku.
    subst_letter = _subst_mount(OUT)
    R.TESTCLIENTS, R.TESTROOTS = OUT / "instancje", Path(f"{subst_letter}:/fixtury")
    R.RUNTIME_DST, R.CENTRAL = R.TESTCLIENTS / "_runtime" / "python", R.TESTCLIENTS / "_central" / "PAMIEC-PODRECZNA"
    R.SECRETS_DIR, R.STATE_FILE, R.PIDS_FILE = R.TESTCLIENTS / "_secrets", R.TESTCLIENTS / "e2e-state.json", R.TESTCLIENTS / "pids.json"
    R.M_ROOT, R.X_ROOT, R.OUT_BASE, R.PG_SECRET = R.TESTROOTS / "M", R.TESTROOTS / "X", OUT / "wynik", secret
    R.INSTANCES["A"]["root"], R.INSTANCES["B"]["root"] = R.M_ROOT, R.X_ROOT
    F.TESTROOTS = R.TESTROOTS
    if not (R.RUNTIME_SRC / "python.exe").is_file():  # kopia robocza bez runtime: wez z najnowszej paczki
        R.RUNTIME_SRC = find_package(args.wersja, args.paczka) / "bin" / "runtime" / "win" / "python"
    # run_abc pilnuje, zeby instancje nie siegaly do D:/Marketing; katalog przebiegu lezy pod repo w D:/Marketing,
    # wiec sciezki WEWNATRZ katalogu przebiegu nie sa "produkcja" (reszta D:/Marketing nadal zakazana).
    orig_inside = R._inside  # noqa: SLF001

    def inside(path: str, base: Path) -> bool:
        if R._norm(str(base)) == R._norm("D:/Marketing") and orig_inside(path, OUT):  # noqa: SLF001
            return False
        return orig_inside(path, base)

    R._inside = inside  # noqa: SLF001
    marker = R.TESTCLIENTS
    R._list_test_processes = lambda: [  # noqa: SLF001 - oryginal szuka D:/DAM-lokalne
        {"ProcessId": x["pid"], "Name": x["name"], "CommandLine": x["cmd"], "ExecutablePath": ""} for x in list_own_processes(marker)]
    R.phase_screens = lambda: log("zrzuty run_abc pominiete: uruchamialy przegladarke (zakaz wlasciciela 07.10.2026)")
    sys.argv = [sys.argv[0], "--phase", "all"]
    try:
        return R.main()
    finally:
        _subst_unmount(subst_letter)


def selftest() -> int:
    """Jedno szybkie sprawdzenie logiki, ktora decyduje o werdykcie: klasyfikacja polecen SQL."""
    sys.path.insert(0, str(HERE))
    os.environ.setdefault("DAM_E2E_DESKTOP", str(HERE))
    import launcher_odbior as lo  # noqa: PLC0415

    cases = {"SELECT 1": "", "  select * from dam_assets": "", "SHOW x": "", "SET default_transaction_read_only = off": "",
             "INSERT INTO device_sessions (a) VALUES (1)": "INSERT", "UPDATE dam_kv_store SET x=1": "UPDATE",
             "CREATE INDEX IF NOT EXISTS i ON t (a)": "CREATE", "WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x": "INSERT",
             "WITH x AS (SELECT 1) SELECT * FROM x": "", "SELECT nextval('dam_assets_rev_seq')": "SELECT+NEXTVAL",
             "-- c\nDELETE FROM t": "DELETE", "SELECT * FROM t FOR UPDATE": "SELECT+FOR UPDATE"}
    bad = {q: (lo.classify(q), want) for q, want in cases.items() if lo.classify(q) != want}
    ddl = [("CREATE INDEX IF NOT EXISTS i ON t (a)", ["i"]),
           ("CREATE SEQUENCE IF NOT EXISTS s; CREATE TABLE IF NOT EXISTS t (a TEXT); CREATE INDEX IF NOT EXISTS t_i ON t (a);",
            ["s", "t", "t_i"]),
           ("ALTER TABLE dam_assets ADD COLUMN IF NOT EXISTS x INT, ADD COLUMN IF NOT EXISTS y TEXT",
            ["dam_assets.x", "dam_assets.y"]),
           ("CREATE TABLE t (a int)", None), ("CREATE INDEX IF NOT EXISTS i ON t (a); INSERT INTO t VALUES (1)", None),
           ("CREATE OR REPLACE FUNCTION f() RETURNS trigger AS $$ BEGIN RETURN NEW; END $$ LANGUAGE plpgsql", ["fn:f"]),
           ("CREATE TABLE IF NOT EXISTS t (a int); CREATE OR REPLACE FUNCTION f() RETURNS trigger AS $$ BEGIN "
            "INSERT INTO h VALUES (1); RETURN NEW; END; $$ LANGUAGE plpgsql; DROP TRIGGER IF EXISTS tr ON t; "
            "CREATE TRIGGER tr AFTER UPDATE ON t FOR EACH ROW EXECUTE FUNCTION f();", ["t", "fn:f", "trg:tr@t"]),
           ("DROP TABLE t", None), ("CREATE TRIGGER tr AFTER UPDATE ON t FOR EACH ROW EXECUTE FUNCTION f(); DELETE FROM t", None)]
    bad.update({q: (lo.idempotent_ddl(q), want) for q, want in ddl if lo.idempotent_ddl(q) != want})
    samples = [{"t": 1.0, "files": {"file-index.json": {"sha256": "a"}}}, {"t": 9.0, "files": {"file-index.json": {"sha256": "b"}}}]
    assert first_t(samples, lambda s: s["files"]["file-index.json"]["sha256"] == "b") == 9.0
    assert first_t(samples, lambda s: s["rows"]["live"] > 0) is None
    print("SAMOTEST", "OK" if not bad else f"BLAD {bad}")
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Test odbioru DAM (skill dam-odbior)")
    ap.add_argument("--wariant", default="C", choices=["C", "AB"])
    ap.add_argument("--wersja", help="wersja paczki, np. 2.5.8 (najnowszy katalog staging tej wersji)")
    ap.add_argument("--paczka", help="katalog paczki instalatora (zawiera bin\\)")
    ap.add_argument("--czas", type=int, default=180, help="ile sekund od startu mostu trwa pomiar")
    ap.add_argument("--login", action="store_true", help="zaloguj konto testowe (jedyny zapis do bazy)")
    ap.add_argument("--konto", help="plik konto.json; domyslnie z work\\<data>\\auth_test.py")
    ap.add_argument("--czas-danych", type=int, default=420, help="do ktorej sekundy mierzyc dane (konczy wczesniej, gdy zgodne)")
    ap.add_argument("--bez-okna", action="store_true", help="sam most i serwer UI: pomiar danych bez ekranu")
    ap.add_argument("--okno-widoczne", action="store_true", help="okno na ekranie zamiast poza nim (do ogledzin recznych)")
    ap.add_argument("--cdp", type=int, default=0, help="port CDP okna (domyslnie 19333 dla C, 19334 dla okna testowego)")
    ap.add_argument("--cdp-od", type=int, default=0, help="proba kontrolna: podlacz CDP dopiero po N s, okno startuje samo jak u uzytkownika")
    ap.add_argument("--start-z", default="", help="przelaczniki ustawione przed startem okna: BAZA-WYLACZONA, SPIS-WSTRZYMANY, SPIS-BLAD (po przecinku)")
    ap.add_argument("--przelacz", help="zmien przelacznik dzialajacego okna: NAZWA=on|off (z --przebieg)")
    ap.add_argument("--przebieg", help="katalog przebiegu dla --przelacz")
    ap.add_argument("--zostaw", action="store_true", help="nie zamykaj okna po zrzutach (zatrzymanie: --stop)")
    ap.add_argument("--stop", help="katalog przebiegu z oknem zostawionym przez --zostaw")
    ap.add_argument("--okno-testowe", action="store_true", help="okno dla recenzentow: dane wlasciciela, ROOT z --root, tylko odczyt")
    ap.add_argument("--kod", help="kod z kopii roboczej (katalog z bin, np. work/<data>/wt-260) nalozony na paczke")
    ap.add_argument("--bez-spisu", action="store_true", help="paczka bez spisu katalogu (instalator od 2.6.0)")
    ap.add_argument("--bez-kont-startowych", action="store_true", help="paczka bez bin/DATABASE/users-seed.sqlite (czy logowanie z baza go potrzebuje)")
    ap.add_argument("--root", default="M:\\", help="okno testowe: ROOT instancji (tylko odczyt)")
    ap.add_argument("--przygotuj", action="store_true", help="AB: tylko fixtury i drzewa instancji, bez bazy")
    ap.add_argument("--baza", default="", help="AB: 'test' = baza dam_eta_test; C: 'pusta' = pusty schemat testowy (przez test_dsn.py)")
    ap.add_argument("--samotest", action="store_true")
    args = ap.parse_args()
    if args.samotest:
        return selftest()
    if args.stop:
        return stop_run(args.stop)
    if args.przelacz:
        name, _, state = args.przelacz.partition("=")
        flag = Path(args.przebieg or "") / "przelaczniki" / name.strip().upper()
        if not args.przebieg or not flag.parent.is_dir() or state not in ("on", "off"):
            raise SystemExit("uzycie: --przelacz NAZWA=on|off --przebieg <katalog przebiegu z oknem>")
        if state == "on":
            flag.write_text(utc(), encoding="utf-8")
        elif flag.is_file():
            flag.unlink()  # pojedynczy wlasny plik-znacznik
        print(f"{flag.name}: {state}; aktywne: {sorted(x.name for x in flag.parent.iterdir())}")
        return 0
    if args.wariant == "C" or args.okno_testowe:
        return run_c(args)
    return prepare_ab(args) if args.przygotuj else run_ab(args)


def _trace_exit() -> None:
    """Harness bywal zamykany z zewnatrz bez sladu (07.10.2026). Kazde wyjscie, ktore Python widzi
    (koniec, wyjatek, sygnal), zostawia wpis w przebieg.log; brak wpisu = TerminateProcess z zewnatrz."""
    import atexit
    import faulthandler
    import signal

    def bye() -> None:
        if OUT:
            log(f"harness: wyjscie pid={os.getpid()}")

    def on_signal(num, _frame) -> None:
        if OUT:
            log(f"harness: sygnal {num} pid={os.getpid()}")
        raise SystemExit(128 + int(num))

    atexit.register(bye)
    for name in ("SIGINT", "SIGTERM", "SIGBREAK"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), on_signal)
    faulthandler.enable()


if __name__ == "__main__":
    _trace_exit()
    raise SystemExit(main())
