# -*- coding: utf-8 -*-
"""Trzy izolowane instancje DAM (A/B/C) na JEDNYM komputerze - plan naprawy, sekcja 0 i 8.

A = wlasciciel katalogu (TEST-A w dam_meta.index_authority), pelny ROOT
    D:\\DAM-lokalne\\testroots\\M (syntetyczny).
B = opozniona kopia D:\\DAM-lokalne\\testroots\\X (braki, starsza wersja).
C = bez ROOT, pusty cache.

Kazda instancja: wlasna kopia drzewa aplikacji (robocopy BEZ /MIR /PURGE), wlasny
DAM_STATE_DIR, SQLite, cache miniatur, konfiguracja, port mostu, DAM_UI_ORIGIN,
COMPUTERNAME=TEST-X, DAM_TEST_INSTANCE (osobny machine_id/device_id), DAM_TEST_PG=1
+ DAM_PG_* do dam_eta_test i PGOPTIONS search_path=<wlasny schemat e2e_*>,public.
Wspolne sa tylko testowe uslugi centralne: schemat e2e_* w dam_eta_test oraz
testowy magazyn podgladow D:\\DAM-lokalne\\testclients\\_central (lokalny serwer HTTP).

Fazy (domyslnie wszystkie po kolei):
  setup     schemat PG + dane startowe, fixture M/X, kopie drzewa, sonda izolacji
  start     serwer podgladow + mosty A/B/C, logowanie
  scenarios scenariusze z tabeli sekcji 8, ktore da sie dzis zautomatyzowac
  stop      zatrzymanie WYLACZNIE wlasnych PID (drzewo procesow) + dowod sprzatania

Nigdy: rola dam_eta, baza dam_eta, %LOCALAPPDATA%\\DAM*, porty 8765/8766, kasowanie
rekurencyjne (stare katalogi testowe sa przenoszone rename do _old).

Uzycie:
  bin\\runtime\\win\\python\\python.exe bin\\scripts\\qa\\e2e\\run_abc.py            (wszystko)
  ... run_abc.py --phase setup|start|scenarios|stop
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
BIN = HERE.parents[2]
REPO = BIN.parent
DESKTOP_SRC = BIN / "apps" / "desktop"
WEB_SRC = BIN / "apps" / "web"
RUNTIME_SRC = BIN / "runtime" / "win" / "python"
GATE_SQL = DESKTOP_SRC / "sql" / "authority_gate.sql"

LOKALNE = Path(r"D:\DAM-lokalne")
TESTCLIENTS = LOKALNE / "testclients"
TESTROOTS = LOKALNE / "testroots"
RUNTIME_DST = TESTCLIENTS / "_runtime" / "python"
CENTRAL = TESTCLIENTS / "_central" / "PAMIEC-PODRECZNA"
SECRETS_DIR = TESTCLIENTS / "_secrets"
STATE_FILE = TESTCLIENTS / "e2e-state.json"
PIDS_FILE = TESTCLIENTS / "pids.json"
PG_SECRET = Path(os.environ.get("DAM_TEST_PG_SECRET") or r"D:\DAM-lokalne\testpg\nas-dam_test.secret")
PG_HOST = os.environ.get("DAM_TEST_PG_HOST", "inyfinn.synology.me")
PG_PORT = int(os.environ.get("DAM_TEST_PG_PORT", "5433"))
PG_DB = "dam_eta_test"
PG_USER = "dam_test"
OUT_BASE = REPO / "work" / "2026-09-28" / "W7"

M_ROOT = TESTROOTS / "M"
X_ROOT = TESTROOTS / "X"
CENTRAL_PORT = 18790
INSTANCES: dict[str, dict[str, Any]] = {
    "A": {"bridge": 18766, "ui": 18776, "root": M_ROOT, "machine": "TEST-A"},
    "B": {"bridge": 18767, "ui": 18777, "root": X_ROOT, "machine": "TEST-B"},
    "C": {"bridge": 18768, "ui": 18778, "root": None, "machine": "TEST-C"},
}
FORBIDDEN_PORTS = {8765, 8766}
ADMIN_EMAIL = "e2e-admin@dam-test.invalid"

sys.path.insert(0, str(HERE))
import fixtures  # noqa: E402

# ----------------------------------------------------------------------------- util


def utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(msg: str) -> None:
    line = f"{datetime.now().strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    try:
        with open(out_dir() / "run.log", "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:  # noqa: BLE001
        pass


_STATE: dict[str, Any] = {}


def load_state() -> dict:
    global _STATE
    if STATE_FILE.is_file():
        _STATE = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return _STATE


def save_state() -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(_STATE, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, STATE_FILE)


def out_dir() -> Path:
    run = _STATE.get("run_id") or "norun"
    d = OUT_BASE / run
    d.mkdir(parents=True, exist_ok=True)
    return d


def write_out(name: str, data: Any) -> Path:
    p = out_dir() / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return p


TIMINGS: list[dict] = []


def timing(step: str, seconds: float, **extra) -> None:
    TIMINGS.append({"step": step, "seconds": round(seconds, 2), **extra})
    log(f"[czas] {step}: {seconds:.1f} s {extra if extra else ''}")


def wait_until(fn: Callable[[], Any], timeout: float, interval: float = 2.0):
    t0 = time.monotonic()
    last = None
    while True:
        try:
            last = fn()
        except Exception as exc:  # noqa: BLE001
            last = {"exception": str(exc)[:300]}
        if last and not (isinstance(last, dict) and "exception" in last):
            return True, time.monotonic() - t0, last
        if time.monotonic() - t0 > timeout:
            return False, time.monotonic() - t0, last
        time.sleep(interval)


def inst_dir(name: str) -> Path:
    return TESTCLIENTS / name


def inst_desktop(name: str) -> Path:
    return inst_dir(name) / "app" / "bin" / "apps" / "desktop"


def inst_web(name: str) -> Path:
    return inst_dir(name) / "app" / "bin" / "apps" / "web"


def _pg_password() -> str:
    return PG_SECRET.read_text(encoding="utf-8").strip()


def schema_name() -> str:
    return _STATE["schema"]


def pg_connect(search_path: bool = True):
    import psycopg2
    import psycopg2.extras

    kw = dict(host=PG_HOST, port=PG_PORT, dbname=PG_DB, user=PG_USER, password=_pg_password(),
              sslmode="require", connect_timeout=15, cursor_factory=psycopg2.extras.RealDictCursor)
    if search_path:
        kw["options"] = f"-csearch_path={schema_name()},public"
    return psycopg2.connect(**kw)


def pg_query(sql: str, args: tuple = ()) -> list[dict]:
    conn = pg_connect()
    try:
        cur = conn.cursor()
        cur.execute(sql, args)
        rows = [dict(r) for r in cur.fetchall()] if cur.description else []
        conn.commit()
        return rows
    finally:
        conn.close()


# ----------------------------------------------------------------------------- HTTP


def http(name: str, method: str, path: str, body: Any = None, token: str | None = None,
         timeout: float = 30.0, raw: bool = False):
    port = INSTANCES[name]["bridge"]
    assert port not in FORBIDDEN_PORTS
    url = f"http://127.0.0.1:{port}{path}"
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = resp.read()
            status = resp.status
            ctype = resp.headers.get("Content-Type", "")
    except urllib.error.HTTPError as exc:
        payload = exc.read()
        status = exc.code
        ctype = exc.headers.get("Content-Type", "") if exc.headers else ""
    if raw:
        return status, payload, ctype
    try:
        return status, json.loads(payload.decode("utf-8") or "null")
    except Exception:  # noqa: BLE001
        return status, {"_raw": payload[:300].decode("utf-8", "replace")}


def token(name: str) -> str:
    return (_STATE.get("tokens") or {}).get(name) or ""


# ----------------------------------------------------------------------------- setup


def _move_aside(path: Path, stamp: str) -> Path | None:
    """Stary katalog instancji -> testclients\\_old\\<nazwa>-<stamp> (rename, bez kasowania)."""
    p = Path(os.path.abspath(path))
    root = Path(os.path.abspath(TESTCLIENTS))
    if p == root or root not in p.parents:
        raise RuntimeError(f"poza {root}: {p}")
    if not p.exists():
        return None
    dest = TESTCLIENTS / "_old" / f"{p.name}-{stamp}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    os.rename(p, dest)
    return dest


def _robocopy(src: Path, dst: Path, xd: list[str], xf: list[str]) -> dict:
    dst.mkdir(parents=True, exist_ok=True)
    cmd = ["robocopy", str(src), str(dst), "/E", "/R:1", "/W:1", "/NFL", "/NDL", "/NJH", "/NP"]
    if xd:
        cmd += ["/XD", *xd]
    if xf:
        cmd += ["/XF", *xf]
    assert "/MIR" not in cmd and "/PURGE" not in cmd
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode >= 8:
        raise RuntimeError(f"robocopy rc={r.returncode}: {r.stdout[-800:]}")
    return {"rc": r.returncode, "summary": r.stdout.strip().splitlines()[-6:]}


APP_XD = ["data", "__pycache__", "tests", "logs", "updates", "_qa", "node_modules", ".pytest_cache",
          "bootstrap"]
APP_XF = ["machine-config.json", "pg-config*.json", "*.env", "*.sqlite", "*.sqlite-*", "*.secret",
          "secret.key", "sealed*.json", "*.dpapi", "dam_pg_root.crt", "bound-session.json",
          "dam-runtime.json", "*.log", "_cp*.txt"]


def _pbkdf2(password: str) -> str:
    salt = secrets.token_hex(16)
    dig = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 390000)
    return "pbkdf2$" + salt + "$" + dig.hex()


def setup_pg() -> dict:
    import psycopg2

    t0 = time.monotonic()
    admin = pg_connect(search_path=False)
    admin.autocommit = True
    cur = admin.cursor()
    cur.execute("SELECT current_database() AS db, current_user AS usr")
    who = dict(cur.fetchone())
    if who["db"] != PG_DB or who["usr"] != PG_USER:
        raise RuntimeError(f"niezgodna baza/rola: {who}")
    cur.execute("SELECT 1 FROM public.dam_test_marker LIMIT 1")
    cur.fetchall()
    cur.execute(f'CREATE SCHEMA "{schema_name()}"')
    admin.close()

    sys.path.insert(0, str(DESKTOP_SRC))
    sys.path.insert(0, str(BIN / "scripts" / "qa" / "testenv"))
    import schema as testenv_schema  # noqa: PLC0415

    conn = pg_connect()
    try:
        res = testenv_schema.apply_schema(conn)
        conn.commit()
        cur = conn.cursor()
        gate = {"exists": GATE_SQL.is_file()}
        if GATE_SQL.is_file():
            sql = GATE_SQL.read_text(encoding="utf-8")
            gate["sha256"] = hashlib.sha256(sql.encode("utf-8")).hexdigest()
            cur.execute(sql)
            conn.commit()
            gate["applied"] = True
        cur.execute(
            "INSERT INTO dam_meta(key, value) VALUES ('asset_index_mode','rows') "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()")
        cur.execute(
            "INSERT INTO dam_meta(key, value) VALUES ('index_authority', %s) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
            (json.dumps({"machines": ["TEST-A"], "updated_by": "run_abc.py", "updated_at": utc()}),))
        pw = secrets.token_urlsafe(18) + "Aa7"
        now = utc()
        cur.execute(
            "INSERT INTO users (email, name, role, password_hash, auth_provider, created_at, updated_at) "
            "VALUES (%s, %s, 'admin', %s, 'local', %s, %s) RETURNING id",
            (ADMIN_EMAIL, "E2E Admin", _pbkdf2(pw), now, now))
        uid = cur.fetchone()["id"]
        conn.commit()
        cur.execute("SELECT key, value FROM dam_meta ORDER BY key")
        meta = [dict(r) for r in cur.fetchall()]
        cur.execute("SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "
                    "JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=%s AND NOT t.tgisinternal",
                    (schema_name(),))
        gate["triggers"] = sorted(r["tgname"] for r in cur.fetchall())
    finally:
        conn.close()
    SECRETS_DIR.mkdir(parents=True, exist_ok=True)
    (SECRETS_DIR / "e2e-admin.secret").write_text(pw, encoding="utf-8")
    out = {"schema": schema_name(), "who": who, "apply_schema_steps": [s.get("step") for s in res["steps"]],
           "gate": gate, "dam_meta": meta, "admin_user_id": uid, "seconds": round(time.monotonic() - t0, 1)}
    timing("setup.pg_schema", time.monotonic() - t0)
    return out


def instance_env(name: str) -> dict[str, str]:
    spec = INSTANCES[name]
    d = inst_dir(name)
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(("DAM_", "PG")) and k not in ("PYTHONPATH", "PYTHONHOME")}
    root = spec["root"]
    allowed = str(root) if root else str(d / "no-root")
    env.update({
        "DAM_TEST_PG": "1",
        "DAM_TEST_INSTANCE": name,
        "COMPUTERNAME": spec["machine"],
        "DAM_PG_HOST": PG_HOST,
        "DAM_PG_PORT": str(PG_PORT),
        "DAM_PG_DBNAME": PG_DB,
        "DAM_PG_USER": PG_USER,
        "DAM_PG_PASSWORD": _pg_password(),
        "DAM_PG_SSLMODE": "require",
        "PGOPTIONS": f"-csearch_path={schema_name()},public",
        "DAM_STATE_DIR": str(d / "state"),
        "DAM_CACHE_ROOT": str(d / "cache" / "PAMIEC-PODRECZNA"),
        "DAM_BRIDGE_PORT": str(spec["bridge"]),
        "DAM_UI_ORIGIN": f"http://127.0.0.1:{spec['ui']}",
        "DAM_WEB_ROOT": str(inst_web(name)),
        "DAM_NAS_CACHE_PATH": str(CENTRAL),
        "DAM_NAS_CACHE_URL": f"http://127.0.0.1:{CENTRAL_PORT}",
        "DAM_NAS_SSH_HOST": "dam-e2e-no-ssh.invalid",
        "DAM_NAS_SSH_DEST": "/nonexistent/dam-e2e",
        "DAM_MARKETING_FALLBACKS": str(d / "no-fallback-root"),
        # marketing_roots.py:94-100 czyta tez P:/DAM/bin/apps/desktop/machine-config.json,
        # gdy brak wpisu lokalnego - jawny plik instancji wylacza ten zapas.
        "DAM_MACHINE_CONFIG": str(d / "state" / "machine-config.json"),
        "DAM_REPORTS_ROOT": str(d / "reports"),
        "DAM_E2E_DESKTOP": str(inst_desktop(name)),
        "DAM_E2E_ALLOWED_ROOTS": allowed,
        "LOCALAPPDATA": str(d / "localappdata"),
        "APPDATA": str(d / "appdata"),
        "TEMP": str(d / "tmp"),
        "TMP": str(d / "tmp"),
        "USERPROFILE": str(d / "home"),
        "HOME": str(d / "home"),
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONIOENCODING": "utf-8",
    })
    return env


def write_machine_config(name: str, base: Path | None) -> None:
    user = (os.environ.get("USERNAME") or "default").strip()
    p = inst_dir(name) / "state" / "machine-config.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    if base is None:
        return
    payload = {"users": {user: {"base_path": str(base), "updated_at": utc(), "root_generation": 1}}}
    p.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def setup_instances(stamp: str) -> dict:
    t0 = time.monotonic()
    report: dict[str, Any] = {"moved_aside": {}, "copies": {}}
    for name in INSTANCES:
        moved = _move_aside(inst_dir(name), stamp)
        if moved:
            report["moved_aside"][name] = str(moved)
    if not (RUNTIME_DST / "python.exe").is_file():
        report["runtime"] = _robocopy(RUNTIME_SRC, RUNTIME_DST, ["__pycache__"], [])
    CENTRAL.mkdir(parents=True, exist_ok=True)
    (CENTRAL / "thumbs").mkdir(parents=True, exist_ok=True)
    for name in INSTANCES:
        d = inst_dir(name)
        for sub in ("state", "cache", "localappdata", "appdata", "tmp", "home", "logs", "reports", "launcher"):
            (d / sub).mkdir(parents=True, exist_ok=True)
        app_bin = d / "app" / "bin"
        report["copies"][name] = {
            "desktop": _robocopy(DESKTOP_SRC, app_bin / "apps" / "desktop", APP_XD, APP_XF),
            "web": _robocopy(WEB_SRC, app_bin / "apps" / "web", APP_XD, APP_XF),
        }
        # Puste katalogi danych (pusty cache) - nic z produkcyjnego apps/web/data.
        (app_bin / "apps" / "desktop" / "data").mkdir(parents=True, exist_ok=True)
        (app_bin / "apps" / "web" / "data").mkdir(parents=True, exist_ok=True)
        (app_bin / "DATABASE").mkdir(parents=True, exist_ok=True)
        (app_bin / "apps" / "desktop" / "data" / "update-prefs.json").write_text(
            json.dumps({"auto_check": False, "notify_on_startup": False}), encoding="utf-8")
        for f in ("instance_launcher.py", "isolation_probe.py"):
            shutil.copy2(HERE / f, d / "launcher" / f)
        write_machine_config(name, INSTANCES[name]["root"])
    timing("setup.copy_instances", time.monotonic() - t0)
    return report


def setup_fixtures(stamp: str) -> dict:
    t0 = time.monotonic()
    moved = {"M": str(fixtures.move_aside(M_ROOT, stamp) or ""), "X": str(fixtures.move_aside(X_ROOT, stamp) or "")}
    base_ts = time.time() - 2 * 86400
    m = fixtures.build_m(M_ROOT, base_ts)
    x = fixtures.build_x(M_ROOT, X_ROOT)
    timing("setup.fixtures", time.monotonic() - t0)
    return {"moved_aside": moved, "m_files": len(m), "x": x}


# ----------------------------------------------------------------------------- izolacja


def _norm(p: str) -> str:
    return os.path.normcase(os.path.abspath(p)) if p else ""


def _inside(p: str, base: Path) -> bool:
    if not p:
        return True
    np_, nb = _norm(p), _norm(str(base))
    return np_ == nb or np_.startswith(nb + os.sep)


def isolation_check() -> dict:
    t0 = time.monotonic()
    real_lad = os.environ.get("LOCALAPPDATA") or ""
    forbidden = {
        "LOCALAPPDATA\\DAM (profil roboczy)": Path(real_lad) / "DAM" if real_lad else None,
        "LOCALAPPDATA\\Programs\\DAM (instalacja)": Path(real_lad) / "Programs" / "DAM" if real_lad else None,
        "repo": REPO,
        "M:\\ (produkcja)": Path("M:/"),
        "X:\\Marketing (produkcja)": Path("X:/Marketing"),
        "D:\\Marketing (produkcja)": Path("D:/Marketing"),
    }
    allowed_shared = {"_central (testowy magazyn podgladow)": CENTRAL}
    result: dict[str, Any] = {"ok": True, "instances": {}}
    for name in INSTANCES:
        env = instance_env(name)
        r = subprocess.run([str(RUNTIME_DST / "python.exe"), "-u", str(inst_dir(name) / "launcher" / "isolation_probe.py")],
                           cwd=str(inst_desktop(name)), env=env, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=180)
        line = next((ln for ln in r.stdout.splitlines() if ln.startswith("E2E_PROBE_JSON:")), "")
        if not line:
            result["ok"] = False
            result["instances"][name] = {"ok": False, "error": "probe_failed", "rc": r.returncode,
                                         "stderr": r.stderr[-2000:], "stdout": r.stdout[-1000:]}
            continue
        probe = json.loads(line[len("E2E_PROBE_JSON:"):])
        violations = []
        rows = []
        mine = inst_dir(name)
        for key, path in probe["paths"].items():
            inside = _inside(path, mine)
            shared = next((lbl for lbl, b in allowed_shared.items() if _inside(path, b)), "")
            hits = [lbl for lbl, b in forbidden.items() if b is not None and path and _inside(path, b)]
            ok = (inside or bool(shared)) and not hits
            if key.startswith("dam_db.resolve_marketing_root") or key.startswith("marketing_roots.resolve"):
                want = str(INSTANCES[name]["root"] or "")
                ok = (not path and not want) or (bool(want) and _norm(path) == _norm(want))
            rows.append({"key": key, "path": path, "source": probe["sources"].get(key, ""),
                         "inside_instance": inside, "shared_test_service": shared, "forbidden_hits": hits, "ok": ok})
            if not ok:
                violations.append(key)
        pg = probe.get("pg") or {}
        live = pg.get("live") or {}
        pg_ok = (pg.get("test_mode") is True and pg.get("host") == PG_HOST and pg.get("dbname") == PG_DB
                 and pg.get("user") == PG_USER and live.get("db") == PG_DB and live.get("usr") == PG_USER
                 and live.get("sch") == schema_name())
        if not pg_ok:
            violations.append("pg")
        ident = probe.get("identity") or {}
        machine_ok = probe.get("index_authority.current_machine") == INSTANCES[name]["machine"] \
            and probe.get("local_bridge._asset_sync_machine") == INSTANCES[name]["machine"]
        if not machine_ok:
            violations.append("machine_name")
        if probe.get("local_bridge.PORT") != INSTANCES[name]["bridge"] or probe.get("local_bridge.PUBLIC_MODE"):
            violations.append("port_or_public_mode")
        if probe.get("app_updates.is_portable_repo"):
            violations.append("portable_repo_true (zrzut PG + git sync)")
        if probe.get("nas_ssh_host") != "dam-e2e-no-ssh.invalid" or not str(probe.get("nas_cache_url", "")).startswith("http://127.0.0.1:"):
            violations.append("nas_cache_not_test")
        if probe.get("errors"):
            violations.append("probe_errors")
        result["instances"][name] = {"ok": not violations, "violations": violations, "paths": rows, "pg": pg,
                                     "identity": ident, "errors": probe.get("errors"),
                                     "nas_cache_url": probe.get("nas_cache_url"), "nas_ssh_host": probe.get("nas_ssh_host"),
                                     "machine": probe.get("index_authority.current_machine"),
                                     "candidates_before_launcher": probe.get("local_bridge.MARKETING_CANDIDATES (przed zawezeniem przez launcher)")}
        if violations:
            result["ok"] = False
    mids = {n: (result["instances"][n].get("identity") or {}).get("machine_id") for n in INSTANCES}
    result["distinct_machine_ids"] = len(set(mids.values())) == len(INSTANCES) and all(mids.values())
    result["machine_ids"] = mids
    if not result["distinct_machine_ids"]:
        result["ok"] = False
    timing("isolation_check", time.monotonic() - t0)
    return result


# ----------------------------------------------------------------------------- start / stop


def _port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def start_all() -> dict:
    t0 = time.monotonic()
    pids: list[dict] = []
    for port in [CENTRAL_PORT] + [s["bridge"] for s in INSTANCES.values()]:
        if not _port_free(port):
            raise RuntimeError(f"port {port} zajety - nie startuje")
    flags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) | getattr(subprocess, "CREATE_NO_WINDOW", 0)
    central_log = open(TESTCLIENTS / "_central" / "http.log", "a", encoding="utf-8")
    p = subprocess.Popen([str(RUNTIME_DST / "python.exe"), "-m", "http.server", str(CENTRAL_PORT),
                          "--bind", "127.0.0.1", "--directory", str(CENTRAL)],
                         cwd=str(CENTRAL), stdout=central_log, stderr=subprocess.STDOUT, creationflags=flags)
    pids.append({"role": "central-thumbs-http", "pid": p.pid, "port": CENTRAL_PORT, "started_at": utc()})
    for name, spec in INSTANCES.items():
        env = instance_env(name)
        lg = open(inst_dir(name) / "logs" / "bridge.log", "a", encoding="utf-8")
        lg.write(f"\n==== start {utc()} run {_STATE.get('run_id')} ====\n")
        lg.flush()
        p = subprocess.Popen([str(RUNTIME_DST / "python.exe"), "-u", str(inst_dir(name) / "launcher" / "instance_launcher.py")],
                             cwd=str(inst_desktop(name)), env=env, stdout=lg, stderr=subprocess.STDOUT, creationflags=flags)
        pids.append({"role": f"bridge-{name}", "pid": p.pid, "port": spec["bridge"], "started_at": utc()})
    _STATE["pids"] = pids
    save_state()
    prev = {}
    if PIDS_FILE.is_file():
        try:
            prev = json.loads(PIDS_FILE.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            prev = {}
    PIDS_FILE.write_text(json.dumps({"owner": "W7 run_abc.py", "run_id": _STATE["run_id"], "processes": pids,
                                     "previous_file_content": prev if prev.get("owner") != "W7 run_abc.py" else prev.get("previous_file_content")},
                                    ensure_ascii=False, indent=2), encoding="utf-8")
    health = {}
    for name in INSTANCES:
        ok, secs, last = wait_until(lambda n=name: (lambda r: r[1] if r[0] == 200 and r[1].get("ok") else None)(http(n, "GET", "/health", timeout=5)), 120, 1.0)
        health[name] = {"ok": ok, "seconds": round(secs, 1), "port": (last or {}).get("port") if isinstance(last, dict) else None}
        timing(f"start.health.{name}", secs, ok=ok)
    pw = (SECRETS_DIR / "e2e-admin.secret").read_text(encoding="utf-8").strip()
    tokens, logins = {}, {}
    for name in INSTANCES:
        st, res = http(name, "POST", "/auth/login", {"email": ADMIN_EMAIL, "password": pw}, timeout=60)
        tokens[name] = res.get("token") if isinstance(res, dict) else None
        logins[name] = {"status": st, "ok": bool(isinstance(res, dict) and res.get("ok")),
                        "device_id": res.get("device_id") if isinstance(res, dict) else None,
                        "machine_id": res.get("machine_id") if isinstance(res, dict) else None,
                        "error": res.get("error") if isinstance(res, dict) else None}
    _STATE["tokens"] = tokens
    save_state()
    # Izolacja w dzialajacym procesie: wykrywanie ROOT nie moze zwracac produkcji,
    # machine-config z katalogu stanu instancji, port wlasny.
    runtime_iso = {}
    prod = {_norm(x) for x in ("M:/", "X:/Marketing", "D:/Marketing")}
    for name in INSTANCES:
        _, det = http(name, "GET", "/detect-marketing-bases", timeout=30)
        _, mc = http(name, "GET", "/machine-config")
        valid = [str(v) for v in (det.get("valid") or [])] if isinstance(det, dict) else []
        want = str(INSTANCES[name]["root"] or "")
        leak = [v for v in valid if _norm(v) in prod or not _inside(v, TESTROOTS)]
        ok = not leak and _inside(str(mc.get("path") or ""), inst_dir(name)) and             (_norm(str(mc.get("base_path") or "")) == _norm(want) if want else not mc.get("base_path"))
        runtime_iso[name] = {"ok": ok, "detect_valid": valid, "production_leak": leak,
                             "machine_config": {k: mc.get(k) for k in ("base_path", "root_generation", "path")}}
    timing("start.all", time.monotonic() - t0)
    return {"pids": pids, "health": health, "logins": logins, "runtime_isolation": runtime_iso,
            "runtime_isolation_ok": all(v["ok"] for v in runtime_iso.values()),
            "distinct_device_ids": len({v["device_id"] for v in logins.values()}) == len(INSTANCES)}


def _list_test_processes() -> list[dict]:
    ps = ("Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like 'D:\\DAM-lokalne\\testclients\\*' "
          "-or $_.CommandLine -like '*DAM-lokalne\\testclients*' } | "
          "Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Depth 3")
    r = subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=60)
    txt = (r.stdout or "").strip()
    if not txt:
        return []
    data = json.loads(txt)
    items = data if isinstance(data, list) else [data]
    me = os.getpid()
    out = []
    for it in items:
        cl = str(it.get("CommandLine") or "")
        if int(it.get("ProcessId") or 0) == me or "Get-CimInstance Win32_Process" in cl:
            continue
        out.append(it)
    return out


def _mine(proc: dict) -> bool:
    txt = (str(proc.get("ExecutablePath") or "") + " " + str(proc.get("CommandLine") or "")).lower()
    marks = [str(inst_dir(n)).lower() + "\\" for n in INSTANCES] + [str(TESTCLIENTS / "_runtime").lower(), str(TESTCLIENTS / "_central").lower()]
    return any(m in txt for m in marks)


def stop_all() -> dict:
    t0 = time.monotonic()
    before = _list_test_processes()
    killed = []
    for rec in _STATE.get("pids") or []:
        pid = int(rec["pid"])
        r = subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        killed.append({"pid": pid, "role": rec["role"], "rc": r.returncode, "out": (r.stdout or r.stderr).strip()[-300:]})
    time.sleep(3)
    after = _list_test_processes()
    mine_left = [p for p in after if _mine(p)]
    # Sieroty (potomkowie mostu, ktorych rodzic juz nie zyl w chwili taskkill /T): tylko z NASZYCH katalogow.
    orphans_killed = []
    for p in mine_left:
        pid = int(p.get("ProcessId") or 0)
        r = subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        orphans_killed.append({"pid": pid, "name": p.get("Name"), "rc": r.returncode})
    if orphans_killed:
        time.sleep(2)
        after = _list_test_processes()
        mine_left = [p for p in after if _mine(p)]
    ports = {port: _port_free(port) for port in [CENTRAL_PORT] + [s["bridge"] for s in INSTANCES.values()]}
    res = {"before": before, "taskkill": killed, "orphans_killed": orphans_killed, "after_all_testclients": after,
           "after_mine": mine_left, "ports_free": ports, "clean": not mine_left and all(ports.values()),
           "not_mine_untouched": [p for p in after if not _mine(p)]}
    _STATE["stopped_at"] = utc()
    save_state()
    timing("stop.all", time.monotonic() - t0)
    return res


# ----------------------------------------------------------------------------- katalog / porownania

LOCAL_KEYS = {"local_available", "available", "exists_locally", "file_url", "thumb_url", "open_url",
              "availability", "local_path", "physical_path"}


def _roots_norm() -> list[str]:
    return [str(M_ROOT).replace("\\", "/").lower(), str(X_ROOT).replace("\\", "/").lower()]


def _strip_root(s: str) -> str:
    t = s.replace("\\", "/")
    low = t.lower()
    for r in _roots_norm():
        if low.startswith(r + "/"):
            return t[len(r) + 1:]
    if t.startswith("/- ") or t.startswith("/-- "):
        return t[1:]
    return t


def canonical(v: Any, key: str = "") -> Any:
    if isinstance(v, dict):
        return {k: canonical(x, k) for k, x in sorted(v.items()) if k not in LOCAL_KEYS}
    if isinstance(v, list):
        return [canonical(x, key) for x in v]
    if isinstance(v, str):
        return _strip_root(v)
    return v


def pg_catalog() -> dict[str, dict]:
    rows = pg_query("SELECT asset_id, asset_key, path_rel, name, size, mtime_ms, deleted_at, rev, updated_by, "
                    "seen_by_machine, meta FROM dam_assets")
    return {r["asset_id"]: r for r in rows}


def pg_max_rev() -> int:
    r = pg_query("SELECT coalesce(max(rev),0) AS m FROM dam_assets")
    return int(r[0]["m"])


def instance_catalog(name: str) -> dict:
    """Katalog instancji z tras mostu, z ktorych korzysta panel Branding:
    /branding-index?full=1 (pelny indeks = katalog po scaleniu wierszy) oraz
    /branding-grid-index (siatka kart; z definicji bez wizek produktowych)."""
    out: dict[str, Any] = {"grid": {}, "full": {}, "grid_meta": {}, "grid_order": []}
    st, grid = http(name, "GET", "/branding-grid-index", timeout=60)
    assets = grid.get("assets") if isinstance(grid, dict) else None
    out["grid_status"] = st
    out["grid_ok"] = isinstance(assets, list)
    if isinstance(assets, list):
        out["grid_meta"] = {k: grid.get(k) for k in ("generation_id", "generated_at", "count", "links_from_sqlite")}
        out["grid_order"] = [a.get("id") for a in assets if isinstance(a, dict)]
        for a in assets:
            if isinstance(a, dict) and a.get("id"):
                out["grid"][a["id"]] = a
    else:
        out["grid_error"] = grid.get("error") if isinstance(grid, dict) else str(grid)[:200]
    st2, full = http(name, "GET", "/branding-index?full=1", timeout=120)
    fassets = full.get("assets") if isinstance(full, dict) else None
    out["full_status"] = st2
    out["full_ok"] = isinstance(fassets, list)
    out["full_meta"] = {k: full.get(k) for k in ("version", "source", "generated_at")} if isinstance(full, dict) else {}
    if isinstance(fassets, list):
        for a in fassets:
            if isinstance(a, dict) and a.get("id"):
                out["full"][a["id"]] = a
    return out


def _entry_diff(a: Any, b: Any) -> list[str]:
    if isinstance(a, dict) and isinstance(b, dict):
        return [k for k in sorted(set(a) | set(b)) if a.get(k) != b.get(k)]
    return [] if a == b else ["<wpis>"]


def compare_catalogs(cats: dict[str, dict], pg: dict[str, dict]) -> dict:
    """sync_ok: pelny katalog kazdej instancji = zywe wiersze bazy (ID + mtime) i te same
    ID w siatce na kazdej instancji. canonical_ok: te same wartosci kanoniczne (po
    odcieciu ROOT i pol lokalnych) w pelnym wpisie i w siatce oraz ta sama kolejnosc."""
    live = {aid for aid, r in pg.items() if r.get("deleted_at") is None}
    names = list(cats)
    res: dict[str, Any] = {"pg_live": len(live), "pg_deleted": len(pg) - len(live), "per_instance": {},
                           "field_diffs": [], "grid_id_sets_equal": True, "grid_order_equal": True}
    sync_ok = True
    for name, cat in cats.items():
        ids = set(cat.get("full") or {})
        missing = sorted(live - ids)
        extra = sorted(ids - live)
        mtime_mismatch = [{"id": aid, "instance": cat["full"][aid].get("mtime_ms"), "pg": pg[aid]["mtime_ms"]}
                          for aid in sorted(ids & live)
                          if int(cat["full"][aid].get("mtime_ms") or -1) != int(pg[aid]["mtime_ms"])]
        grid_ids = set(cat.get("grid") or {})
        grid_not_live = sorted(grid_ids - live)
        iok = bool(cat.get("full_ok") and cat.get("grid_ok") and not missing and not extra and not mtime_mismatch
                   and not grid_not_live)
        res["per_instance"][name] = {"full_count": len(ids), "grid_count": len(grid_ids),
                                     "full_source": (cat.get("full_meta") or {}).get("source"),
                                     "missing_vs_pg": missing, "extra_vs_pg": extra, "mtime_mismatch": mtime_mismatch,
                                     "grid_not_live": grid_not_live, "ok": iok}
        sync_ok = sync_ok and iok
    ref_grid = set(cats[names[0]].get("grid") or {})
    for n in names[1:]:
        if set(cats[n].get("grid") or {}) != ref_grid:
            res["grid_id_sets_equal"] = False
    sync_ok = sync_ok and res["grid_id_sets_equal"]
    for aid in sorted(live):
        for src in ("full", "grid"):
            vals = {n: canonical((cats[n].get(src) or {}).get(aid)) for n in names}
            ref = vals[names[0]]
            for n in names[1:]:
                if vals[n] != ref:
                    diffk = _entry_diff(ref, vals[n])
                    a, b = ref if isinstance(ref, dict) else {}, vals[n] if isinstance(vals[n], dict) else {}
                    res["field_diffs"].append({"id": aid, "name": (pg.get(aid) or {}).get("name"), "src": src,
                                               "vs": f"{names[0]}~{n}", "fields": diffk,
                                               names[0]: {k: a.get(k) for k in diffk[:6]},
                                               n: {k: b.get(k) for k in diffk[:6]}})
    orders = {n: cats[n].get("grid_order") or [] for n in names}
    if any(orders[n] != orders[names[0]] for n in names[1:]):
        res["grid_order_equal"] = False
        res["grid_orders"] = orders
    res["full_canonical_equal"] = not any(d["src"] == "full" for d in res["field_diffs"])
    res["canonical_equal"] = not res["field_diffs"] and res["grid_order_equal"]
    # sync_ok: katalog (pelny indeks) zgodny z baza i identyczny kanonicznie na A/B/C.
    # Rozbieznosci wylacznie w siatce (np. mtime z dysku) nie blokuja czekania - raport.
    res["sync_ok"] = sync_ok and res["full_canonical_equal"]
    res["ok"] = res["sync_ok"] and res["canonical_equal"]
    return res


def converge(label: str, timeout: float = 150.0, want: Callable[[dict, dict], bool] | None = None) -> dict:
    """Czekaj az A/B/C pokaza ten sam katalog co baza (ID + mtime w pelnym indeksie, te same
    ID w siatce); mierz czas per instancja. Rozbieznosci wartosci kanonicznych sa
    raportowane (canonical_ok), ale nie wydluzaja czekania."""
    t0 = time.monotonic()
    first_ok: dict[str, float] = {}
    last_cmp: dict = {}
    cats: dict = {}
    extra_ok = False
    while True:
        pg = pg_catalog()
        live = {aid for aid, r in pg.items() if r.get("deleted_at") is None}
        cats = {n: instance_catalog(n) for n in INSTANCES}
        last_cmp = compare_catalogs(cats, pg)
        for n in INSTANCES:
            if n not in first_ok and live and last_cmp["per_instance"][n]["ok"]:
                first_ok[n] = time.monotonic() - t0
        extra_ok = bool(want(cats, pg)) if want else True
        if (last_cmp["sync_ok"] and extra_ok) or time.monotonic() - t0 > timeout:
            break
        time.sleep(3)
    elapsed = time.monotonic() - t0
    timing(f"converge.{label}", elapsed, per_instance={k: round(v, 1) for k, v in first_ok.items()},
           sync_ok=last_cmp.get("sync_ok"), canonical_ok=last_cmp.get("canonical_equal"))
    write_out(f"diffs/{label}.json", {"compare": last_cmp, "first_ok_s": first_ok, "pg_max_rev": pg_max_rev(),
                                      "want_ok": extra_ok})
    return {"ok": bool(last_cmp.get("sync_ok")) and extra_ok, "sync_ok": bool(last_cmp.get("sync_ok")),
            "canonical_ok": bool(last_cmp.get("canonical_equal")), "want_ok": extra_ok,
            "compare": last_cmp, "first_ok_s": first_ok, "elapsed": elapsed, "cats": cats}


def rebuild(name: str, label: str, timeout: float = 300.0) -> dict:
    """POST /branding/rebuild (admin) -> skan ROOT -> kick asset_sync; czekaj na koniec cyklu scalania."""
    t0 = time.monotonic()
    started = None
    for _ in range(60):
        st, res = http(name, "POST", "/branding/rebuild", {}, token=token(name), timeout=30)
        if isinstance(res, dict) and res.get("started"):
            started = res
            break
        if isinstance(res, dict) and res.get("running"):
            time.sleep(3)  # inny bieg (watcher) - poczekaj i odpal wlasny
            continue
        started = {"status": st, **(res if isinstance(res, dict) else {})}
        break
    if not (isinstance(started, dict) and started.get("started")):
        timing(f"rebuild.{label}.{name}", time.monotonic() - t0, ok=False)
        return {"ok": False, "start": started}
    lock_retries = 0
    while True:
        ok, secs, st = wait_until(lambda: (lambda r: r[1] if isinstance(r[1], dict) and not r[1].get("running")
                                           and r[1].get("last_finished") else None)(http(name, "GET", "/branding/status")),
                                  timeout, 2.0)
        # Rywalizacja o blokade z publikacja siatki (SlimGridPublisher) w tym samym moscie:
        # bieg konczy sie "lock_held" bez skanu - ponow (rejestrowane w wyniku).
        if ok and (st or {}).get("last_error") == "lock_held" and lock_retries < 20:
            lock_retries += 1
            time.sleep(3)
            http(name, "POST", "/branding/rebuild", {}, token=token(name), timeout=30)
            continue
        break
    fin = (st or {}).get("last_finished") or ""
    t_build = time.monotonic() - t0

    def _synced():
        s, a = http(name, "GET", "/asset-sync/status")
        if isinstance(a, dict) and (a.get("last_run") or "") > fin:
            return a
        return None

    ok2, secs2, sync = wait_until(_synced, 120, 2.0) if (st or {}).get("last_ok") else (False, 0.0, None)
    timing(f"rebuild.{label}.{name}", time.monotonic() - t0, build_s=round(t_build, 1),
           build_ok=bool(st and st.get("last_ok")), sync_ok=ok2)
    _, blocked = http(name, "GET", "/asset-sync/blocked")
    return {"ok": ok and bool(st and st.get("last_ok")) and ok2, "status": {k: (st or {}).get(k) for k in
            ("last_ok", "last_error", "last_finished", "stage", "slim_last_error")}, "asset_sync": sync,
            "blocked": blocked, "lock_held_retries": lock_retries, "seconds": round(time.monotonic() - t0, 1)}


def id_for_rel(rel: str) -> str | None:
    rel_l = rel.replace("\\", "/").lower()
    for aid, r in pg_catalog().items():
        if str(r.get("path_rel") or "").lower() == rel_l:
            return aid
    return None


# ----------------------------------------------------------------------------- scenariusze

RESULTS: list[dict] = []


def result(row: str, name: str, required: str, ok: bool | None, evidence: dict, note: str = "") -> None:
    status = "NIE WYKONANO" if ok is None else ("PASS" if ok else "FAIL")
    RESULTS.append({"row": row, "test": name, "required": required, "result": status, "note": note,
                    "evidence": evidence})
    log(f"[wynik] {row} {name}: {status} {note}")


def sc_first_start() -> None:
    log("S1: pierwszy start - skan A, potem B, konwergencja A/B/C")
    a = rebuild("A", "s1")
    conv1 = converge("s1_after_A")
    b = rebuild("B", "s1")
    rev_before_b = None
    conv2 = converge("s1_after_B")
    pg = pg_catalog()
    ids = sorted(aid for aid, r in pg.items() if r.get("deleted_at") is None)
    ev = {"rebuild_A": a, "rebuild_B": b, "pg_live_ids": ids, "pg_max_rev": pg_max_rev(),
          "per_instance": conv2["compare"]["per_instance"], "field_diffs": conv2["compare"]["field_diffs"][:40],
          "grid_order_equal": conv2["compare"].get("grid_order_equal"), "grid_orders": conv2["compare"].get("grid_orders"),
          "sync_ok": conv2["sync_ok"], "canonical_ok": conv2["canonical_ok"],
          "first_ok_s": conv2["first_ok_s"],
          "updated_by": sorted({str(r.get("updated_by")) for r in pg.values()})}
    _STATE["s1_ids"] = ids
    save_state()
    result("S1", "Pierwszy start A/B/C", "Identyczne zestawy assetow i metadane dla wspolnej rewizji",
           bool(a["ok"] and conv2["sync_ok"] and conv2["canonical_ok"] and len(ids) > 0), ev,
           f"live={len(ids)} rev={ev['pg_max_rev']} rev_before_b={rev_before_b}")


def sc_c_without_root() -> None:
    log("S2: C bez ROOT - katalog, skojarzenia, podglady, otwieranie lokalne")
    ev: dict[str, Any] = {}
    cats = {n: instance_catalog(n) for n in INSTANCES}
    pg = pg_catalog()
    live = {aid for aid, r in pg.items() if r.get("deleted_at") is None}
    ev["catalog_C_equals_pg"] = set(cats["C"]["full"]) == live
    # skojarzenie z A -> widoczne na C
    fig = id_for_rel(fixtures.FILES[0].rel)
    ev["assoc_asset"] = fig
    pid = "e2e-produkt-figa"
    st, res = http("A", "POST", "/branding/asset-associations",
                   {"asset_id": fig, "folder_group_id": "", "linked_product_ids": [pid], "linked_variant_ids": ["6300101.01"]},
                   token=token("A"))
    ev["assoc_post_A"] = {"status": st, "res": res}

    def _c_links():
        s, r = http("C", "GET", "/branding/asset-links?ids=" + urllib.parse.quote(fig or ""))
        txt = json.dumps(r, ensure_ascii=False)
        return r if pid in txt else None

    t0 = time.monotonic()
    ok_l, secs_l, links_c = wait_until(_c_links, 120, 3.0)
    timing("s2.assoc_A_to_C", secs_l, ok=ok_l)
    ev["assoc_on_C"] = {"ok": ok_l, "seconds": round(secs_l, 1), "links": links_c}

    def _b_links():
        s, r = http("B", "GET", "/branding/asset-links?ids=" + urllib.parse.quote(fig or ""))
        return r if pid in json.dumps(r, ensure_ascii=False) else None

    ok_lb, secs_lb, links_b = wait_until(_b_links, 120, 3.0)
    timing("s2.assoc_A_to_B", secs_lb + secs_l, ok=ok_lb)
    ev["assoc_on_B"] = {"ok": ok_lb, "seconds_after_C": round(secs_lb, 1), "links": links_b}
    # podglad: A buduje i publikuje do testowego magazynu, C pobiera bez ROOT
    png_ids = [aid for aid in sorted(live) if str(pg[aid]["name"]).lower().endswith(".png")]
    a_paths = [cats["A"]["full"][aid].get("path") for aid in png_ids if aid in cats["A"]["full"]]
    st_w, warm = http("A", "POST", "/thumb-cache/warm", {"paths": a_paths, "profile": "grid"}, token=token("A"), timeout=120)
    ev["warm_A"] = {"status": st_w, "res": warm if not isinstance(warm, dict) else {k: warm.get(k) for k in list(warm)[:8]}}
    got_a = {}
    for aid in png_ids[:4]:
        p = cats["A"]["full"].get(aid, {}).get("path")
        s, body, ct = http("A", "GET", "/thumb-cache?profile=grid&path=" + urllib.parse.quote(p or ""), raw=True, timeout=60)
        got_a[aid] = {"status": s, "bytes": len(body), "ctype": ct, "sha": hashlib.sha256(body).hexdigest()[:16]}
    ev["thumbs_A"] = got_a
    st_p, pub = http("A", "POST", "/thumb-cache/publish", {}, token=token("A"), timeout=180)
    ev["publish_A"] = {"status": st_p, "res": pub}
    central_files = sorted(p.name for p in (CENTRAL / "thumbs").glob("*") if p.is_file())
    ev["central_thumb_files"] = len(central_files)
    target = png_ids[0] if png_ids else None
    c_path = cats["C"]["full"].get(target, {}).get("path") if target else None
    ev["thumb_target"] = {"id": target, "C_path": c_path}

    def _c_thumb():
        s, body, ct = http("C", "GET", "/thumb-cache?profile=grid&path=" + urllib.parse.quote(c_path or ""), raw=True, timeout=30)
        if s == 200 and len(body) > 100 and "image" in ct:
            return {"status": s, "bytes": len(body), "ctype": ct, "sha": hashlib.sha256(body).hexdigest()[:16], "body": body}
        return None

    ok_t, secs_t, th = wait_until(_c_thumb, 660, 10.0)
    timing("s2.thumb_A_to_C", secs_t, ok=ok_t)
    img_ok = False
    if ok_t and th:
        try:
            import io
            from PIL import Image

            im = Image.open(io.BytesIO(th["body"]))
            im.load()
            img_ok = im.size[0] > 0 and im.size[1] > 0
            th["size"] = im.size
            th["format"] = im.format
            (out_dir() / "screens").mkdir(exist_ok=True)
            ext = "avif" if "avif" in th["ctype"] else "jpg"
            (out_dir() / "screens" / f"C-thumb-{target}.{ext}").write_bytes(th["body"])
        except Exception as exc:  # noqa: BLE001
            th["decode_error"] = str(exc)[:200]
        th.pop("body", None)
    ev["thumb_on_C"] = {"ok": ok_t, "seconds": round(secs_t, 1), "decoded": img_ok, "info": th if isinstance(th, dict) else None,
                        "same_bytes_as_A": bool(th and target in got_a and got_a[target]["sha"] == th.get("sha"))}
    # otwieranie lokalne na C: jasno niedostepne
    s_m, body_m, ct_m = http("C", "GET", "/media?path=" + urllib.parse.quote(c_path or ""), raw=True, timeout=30)
    ev["media_on_C"] = {"status": s_m, "ctype": ct_m, "body": body_m[:300].decode("utf-8", "replace") if "json" in ct_m else f"{len(body_m)} B"}
    s_fs, fs = http("C", "GET", "/files/status")
    ev["files_status_C"] = fs
    s_ma, body_ma, ct_ma = http("A", "GET", "/media?path=" + urllib.parse.quote(cats["A"]["full"].get(target, {}).get("path") or ""), raw=True, timeout=30)
    ev["media_on_A"] = {"status": s_ma, "bytes": len(body_ma), "ctype": ct_ma}
    ok_all = bool(ev["catalog_C_equals_pg"] and ok_l and ok_lb and ok_t and img_ok and s_m != 200)
    result("S2", "C bez ROOT", "Katalog, skojarzenia i gotowe podglady dzialaja; lokalne otwieranie jasno niedostepne",
           ok_all, ev, f"assoc {secs_l:.0f}s, podglad {secs_t:.0f}s, /media C={s_m}")


def sc_v2_vs_vanishing_v1() -> None:
    log("S3: M/V2 kontra znikajaca lokalna V1 na B")
    fid = id_for_rel(fixtures.V_FILE)
    before = pg_catalog().get(fid) or {}
    v2_ts = fixtures.write_v2(M_ROOT)
    ra = rebuild("A", "s3_v2")
    after_a = pg_catalog().get(fid) or {}
    conv = converge("s3_after_A_v2", want=lambda cats, pg: all(
        int((c["full"].get(fid) or {}).get("mtime_ms") or 0) == int(pg[fid]["mtime_ms"]) for c in cats.values()))
    removed = fixtures.remove_file(X_ROOT, fixtures.V_FILE) or not (X_ROOT / fixtures.V_FILE).exists()
    rb = rebuild("B", "s3_vanish")
    after_b = pg_catalog().get(fid) or {}
    conv2 = converge("s3_after_B_vanish")
    ok = bool(rb.get("ok") and after_b and after_b.get("deleted_at") is None and int(after_b["mtime_ms"]) == int(after_a.get("mtime_ms") or -1)
              and int(after_a.get("mtime_ms") or 0) > int(before.get("mtime_ms") or 0) and removed and conv2["ok"]
              and all(fid in c["full"] for c in conv2["cats"].values()))
    ev = {"asset_id": fid, "v1": {k: before.get(k) for k in ("mtime_ms", "rev", "updated_by", "deleted_at")},
          "v2_written_ts": v2_ts, "after_A": {k: after_a.get(k) for k in ("mtime_ms", "rev", "updated_by", "deleted_at")},
          "removed_on_X": removed, "rebuild_B": rb,
          "after_B": {k: after_b.get(k) for k in ("mtime_ms", "rev", "updated_by", "deleted_at")},
          "full_mtime": {n: (c["full"].get(fid) or {}).get("mtime_ms") for n, c in conv2["cats"].items()},
          "grid_mtime": {n: (c["grid"].get(fid) or {}).get("mtime_ms") for n, c in conv2["cats"].items()}}
    result("S3", "M/V2 kontra znikajaca lokalna V1", "Nowszy centralny material pozostaje aktywny", ok, ev)


def sc_variant_lists() -> None:
    log("S4: rozne listy wariantow M/X - naprzemienne przebudowy")
    folder = fixtures.VARIANT_FOLDER.lower()

    def folder_state():
        pg = pg_catalog()
        return {aid: {"rev": r["rev"], "updated_by": r["updated_by"]} for aid, r in pg.items()
                if str(r["path_rel"]).lower().startswith(folder + "/")}

    seq = []
    base = {"max_rev": pg_max_rev(), "folder": folder_state()}
    for i, n in enumerate(["A", "B", "A", "B"]):
        rb = rebuild(n, f"s4_{i}")
        seq.append({"step": f"{i}:{n}", "rebuild_ok": rb["ok"], "max_rev": pg_max_rev(), "folder": folder_state(),
                    "blocked": rb.get("blocked")})
    revs = [s["max_rev"] for s in seq]
    stable = all(s["folder"] == base["folder"] for s in seq)
    conv = converge("s4_after")
    fe = {}
    for n, c in conv["cats"].items():
        for aid, a in c["full"].items():
            if str(a.get("path") or "").replace("\\", "/").lower().find(folder) >= 0 and str(a.get("name", "")).endswith(".png"):
                fe.setdefault(n, {})[aid] = [f.get("name") for f in (a.get("folder_editable_files") or [])]
    same_fe = len({json.dumps(v, sort_keys=True) for v in fe.values()}) == 1 and bool(fe)
    ok = stable and revs == [base["max_rev"]] * len(revs) and same_fe and conv["ok"]
    result("S4", "Rozne listy wariantow M/X", "Brak naprzemiennego nadpisywania; niezmienione obserwacje nie zwiekszaja rewizji",
           ok, {"base": base, "sequence": seq, "folder_editable_files": fe, "compare_ok": conv["ok"]},
           f"max_rev po krokach {revs} (start {base['max_rev']})")


def sc_missing_on_b() -> None:
    log("S6: pliki brakujace na B (nigdy nie skopiowane + zniknely lokalnie) nie usuwaja globalnie")
    vid = id_for_rel(fixtures.VANISH_ON_X)
    nid = id_for_rel(fixtures.NEVER_ON_X)
    removed = fixtures.remove_file(X_ROOT, fixtures.VANISH_ON_X) or not (X_ROOT / fixtures.VANISH_ON_X).exists()
    rb = rebuild("B", "s6")
    pg = pg_catalog()
    conv = converge("s6_after_B")
    ok = bool(rb.get("ok") and removed and vid and nid and pg[vid]["deleted_at"] is None and pg[nid]["deleted_at"] is None
              and conv["ok"] and all(vid in c["full"] and nid in c["full"] for c in conv["cats"].values()))
    result("S6", "Pliki brakujace lokalnie na B", "Brak falszywych globalnych usuniec", ok,
           {"vanished_id": vid, "never_copied_id": nid, "removed_on_X": removed, "rebuild_B": rb,
            "pg": {x: {k: pg[x].get(k) for k in ("deleted_at", "rev", "updated_by")} for x in (vid, nid) if x}})


def sc_real_delete_by_a() -> None:
    log("S6b: prawdziwe usuniecie na M (wlasciciel katalogu) rozchodzi sie do B i C")
    did = id_for_rel(fixtures.REAL_DELETE_ON_M)
    removed = fixtures.remove_file(M_ROOT, fixtures.REAL_DELETE_ON_M) or not (M_ROOT / fixtures.REAL_DELETE_ON_M).exists()
    ra = rebuild("A", "s6b")
    pg = pg_catalog()
    conv = converge("s6b_after_A", want=lambda cats, pg_: all(did not in c["full"] and did not in c["grid"] for c in cats.values()))
    ok = bool(ra.get("ok") and removed and did and pg[did]["deleted_at"] is not None and conv["ok"])
    result("S6b", "Prawdziwe usuniecie (A = wlasciciel)", "Usuniecie potwierdzone i rozchodzi sie do klientow", ok,
           {"id": did, "removed_on_M": removed, "rebuild_A": ra,
            "pg": {k: pg.get(did, {}).get(k) for k in ("deleted_at", "rev", "updated_by")},
            "first_ok_s": conv["first_ok_s"], "in_full": {n: did in c["full"] for n, c in conv["cats"].items()},
            "in_grid": {n: did in c["grid"] for n, c in conv["cats"].items()}})


def sc_root_switch() -> None:
    log("S5: przelaczenie ROOT A: M -> X, nakladajace sie przelaczenia, powrot")
    ev: dict[str, Any] = {}
    deleted_before = sum(1 for r in pg_catalog().values() if r.get("deleted_at") is not None)
    rev0 = pg_max_rev()
    _, mc0 = http("A", "GET", "/machine-config")
    t0 = time.monotonic()
    st, sw = http("A", "POST", "/root/switch", {"base_path": str(X_ROOT), "confirm": True}, token=token("A"), timeout=60)
    t_sw = time.monotonic() - t0
    _, mc1 = http("A", "GET", "/machine-config")
    timing("s5.switch_M_to_X", t_sw)
    ev["switch_to_X"] = {"status": st, "res": sw, "machine_config_after": mc1, "before": mc0}
    ev["rev_after_switch"] = pg_max_rev()
    ra = rebuild("A", "s5_on_X")
    deleted_after = sum(1 for r in pg_catalog().values() if r.get("deleted_at") is not None)
    ev["rebuild_A_on_X"] = ra
    ev["deleted_before_after"] = [deleted_before, deleted_after]
    conv = converge("s5_A_on_X")
    # dwa nakladajace sie przelaczenia
    box: dict[str, Any] = {}

    def _sw(label, path):
        box[label] = http("A", "POST", "/root/switch", {"base_path": str(path), "confirm": True}, token=token("A"), timeout=60)

    th = [threading.Thread(target=_sw, args=("to_M", M_ROOT)), threading.Thread(target=_sw, args=("to_X", X_ROOT))]
    for t in th:
        t.start()
    for t in th:
        t.join()
    _, mc2 = http("A", "GET", "/machine-config")
    oks = {k: v[1] for k, v in box.items() if isinstance(v[1], dict) and v[1].get("ok")}
    best = max(oks.items(), key=lambda kv: int(kv[1].get("root_generation") or 0)) if oks else None
    overlap_ok = bool(best) and str(mc2.get("base_path", "")).lower() == str(best[1].get("base_path", "")).lower() \
        and int(mc2.get("root_generation") or -1) == int(best[1].get("root_generation") or -2)
    ev["overlap"] = {"responses": {k: v[1] for k, v in box.items()}, "machine_config_final": mc2, "winner": best[0] if best else None,
                     "backend_matches_last_ok_response": overlap_ok}
    # powrot na M
    st3, sw3 = http("A", "POST", "/root/switch", {"base_path": str(M_ROOT), "confirm": True}, token=token("A"), timeout=60)
    _, mc3 = http("A", "GET", "/machine-config")
    ra2 = rebuild("A", "s5_back_on_M")
    conv2 = converge("s5_back_on_M")
    ev["back_to_M"] = {"res": sw3, "machine_config": mc3, "rebuild": ra2}
    ok = bool(sw.get("ok") and str(mc1.get("base_path", "")).lower() == str(X_ROOT).lower()
              and int(mc1.get("root_generation") or 0) > int(mc0.get("root_generation") or 0)
              and ev["rev_after_switch"] == rev0 and deleted_after == deleted_before and conv["ok"] and overlap_ok
              and str(mc3.get("base_path", "")).lower() == str(M_ROOT).lower() and conv2["ok"])
    result("S5", "ROOT A -> B i dwa nakladajace sie przelaczenia",
           "Zgodny backend/UI (tu: odpowiedz vs /machine-config); zmiana ROOT nie zmienia katalogu", ok, ev,
           f"switch {t_sw:.2f}s, usuniete {deleted_before}->{deleted_after}, rev {rev0}->{ev['rev_after_switch']}")


def sc_gate() -> None:
    log("S7: bramka w bazie - stary klient B probuje tombstone / migawke")
    ev: dict[str, Any] = {"gate_sql_exists": GATE_SQL.is_file()}
    if not GATE_SQL.is_file():
        result("S7", "B probuje tombstone -> odrzucone", "Odrzucenie przez baze", None, ev,
               "brak bin/apps/desktop/sql/authority_gate.sql - hak zostawiony")
        return
    import psycopg2

    pg = pg_catalog()
    target = next(aid for aid, r in sorted(pg.items()) if r.get("deleted_at") is None)
    now_ms = int(time.time() * 1000)

    def attempt(sql: str, args: tuple, commit: bool) -> dict:
        conn = pg_connect()
        try:
            cur = conn.cursor()
            cur.execute(sql, args)
            n = cur.rowcount
            if commit:
                conn.commit()
            else:
                conn.rollback()
            return {"rejected": False, "rowcount": n}
        except psycopg2.Error as exc:
            conn.rollback()
            return {"rejected": True, "sqlstate": exc.pgcode, "message": str(exc).splitlines()[0][:300]}
        finally:
            conn.close()

    upd = ("UPDATE dam_assets SET deleted_at=%s, updated_at=%s, updated_by=%s, rev=nextval('dam_assets_rev_seq') "
           "WHERE asset_id=%s AND deleted_at IS NULL")
    ev["tombstone_by_TEST-B"] = attempt(upd, (now_ms, now_ms, "TEST-B:old-client", target), commit=True)
    ev["tombstone_by_TEST-A (kontrola, ROLLBACK)"] = attempt(upd, (now_ms, now_ms, "TEST-A:e2e-control", target), commit=False)
    snap = ("INSERT INTO dam_index_snapshots(store_key, generation, sha256, payload_gz, raw_bytes, item_count, built_at, built_by, published_at) "
            "VALUES ('e2e-probe', 1, 'x', %s, 0, 0, %s, %s, %s) ON CONFLICT (store_key) DO UPDATE SET built_by=EXCLUDED.built_by")
    ev["snapshot_by_TEST-B"] = attempt(snap, (psycopg2.Binary(b"x"), utc(), "TEST-B", utc()), commit=True)
    after = pg_catalog().get(target) or {}
    ev["target"] = target
    ev["target_after"] = {k: after.get(k) for k in ("deleted_at", "rev", "updated_by")}
    try:
        ev["rejects_log"] = pg_query("SELECT * FROM dam_authority_rejects ORDER BY 1 DESC LIMIT 5")
    except Exception as exc:  # noqa: BLE001
        ev["rejects_log"] = f"brak tabeli: {str(exc)[:120]}"
    b_rej = ev["tombstone_by_TEST-B"]
    b_blocked = b_rej.get("rejected") or b_rej.get("rowcount") == 0
    ok = bool(b_blocked and after.get("deleted_at") is None and ev["snapshot_by_TEST-B"].get("rejected")
              and not ev["tombstone_by_TEST-A (kontrola, ROLLBACK)"].get("rejected"))
    result("S7", "B (stary klient) probuje tombstone / migawke -> odrzucone", "Bramka w bazie odrzuca, wlasciciel przechodzi",
           ok, ev)


def sc_viz_file_index() -> None:
    log("S8: panel Wizualizacji - /file-index?fields=viz_latest na A/B/C")
    out = {}
    for n in INSTANCES:
        st, res = http(n, "GET", "/file-index?fields=viz_latest", timeout=60)
        out[n] = {"status": st, "canon": canonical(res) if st == 200 else res}
    def _items(n):
        c = out[n]["canon"] if out[n]["status"] == 200 else {}
        return json.dumps((c or {}).get("viz_latest"), sort_keys=True)

    pair = {f"A~{n}": (out["A"]["status"] == 200 and out[n]["status"] == 200 and _items("A") == _items(n)) for n in ("B", "C")}
    same = all(pair.values())
    write_out("diffs/s8_viz_latest.json", out)
    _, snaps = http("C", "GET", "/index/snapshots")
    meta = pg_query("SELECT store_key, generation, built_by, built_at, published_at FROM dam_index_snapshots ORDER BY store_key")
    probe = pg_query("SELECT to_regclass('public.dam_index_snapshots')::text AS public_tbl, "
                     "to_regclass('dam_index_snapshots')::text AS search_path_tbl")
    result("S8", "Wizualizacje: viz_latest A/B/C", "Ten sam wycinek wizualizacji na kazdej instancji", bool(same),
           {"status": {n: v["status"] for n, v in out.items()}, "pairs_equal": pair,
            "C_body": out["C"]["canon"] if out["C"]["status"] != 200 else None, "db_snapshots": meta,
            "to_regclass": probe, "snapshots_C": snaps},
           "pelne dane w diffs/s8_viz_latest.json")


# ----------------------------------------------------------------------------- main


def phase_setup() -> None:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    _STATE.clear()
    _STATE.update({"run_id": stamp, "schema": f"e2e_{stamp.lower()}", "created_at": utc(),
                   "repo_head": subprocess.run(["git", "-C", str(REPO), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip(),
                   "repo_dirty": subprocess.run(["git", "-C", str(REPO), "status", "--porcelain", "--", "bin/apps"],
                                                capture_output=True, text=True).stdout.strip().splitlines()})
    save_state()
    log(f"run {stamp} schemat {schema_name()}")
    rep = {"pg": setup_pg(), "fixtures": setup_fixtures(stamp), "instances": setup_instances(stamp)}
    write_out("setup.json", rep)
    iso = isolation_check()
    write_out("isolation-check.json", iso)
    _STATE["isolation_ok"] = iso["ok"]
    save_state()
    if not iso["ok"]:
        log("IZOLACJA NIEZALICZONA - przerywam przed startem instancji (patrz isolation-check.json)")
        raise SystemExit(3)
    log("izolacja OK")


def phase_start() -> None:
    if not _STATE.get("isolation_ok"):
        raise SystemExit("brak zaliczonej sondy izolacji - najpierw --phase setup")
    rep = start_all()
    write_out("start.json", rep)
    if not rep.get("runtime_isolation_ok"):
        log("IZOLACJA W DZIALAJACYM PROCESIE NIEZALICZONA - zatrzymuje instancje (start.json)")
        phase_stop()
        raise SystemExit(4)


def phase_scenarios(only: list[str] | None) -> None:
    order = [("S1", sc_first_start), ("S2", sc_c_without_root), ("S3", sc_v2_vs_vanishing_v1),
             ("S4", sc_variant_lists), ("S6", sc_missing_on_b), ("S6b", sc_real_delete_by_a),
             ("S5", sc_root_switch), ("S7", sc_gate), ("S8", sc_viz_file_index)]
    prev = []
    rp = out_dir() / "results.json"
    if rp.is_file() and only:
        prev = [r for r in json.loads(rp.read_text(encoding="utf-8")) if r["row"] not in only]
    for key, fn in order:
        if only and key not in only:
            continue
        try:
            fn()
        except Exception as exc:  # noqa: BLE001
            result(key, fn.__name__, "-", False, {"exception": traceback.format_exc()[-3000:]}, f"wyjatek: {exc}")
        write_out("results.json", prev + RESULTS)
        write_out("timings.json", TIMINGS)
    write_out("results.json", prev + RESULTS)


PLAYWRIGHT_CANDIDATES = [
    Path(os.environ.get("LOCALAPPDATA") or "") / "npm-cache" / "_npx" / "705bc6b22212b352" / "node_modules" / "playwright",
    Path(os.environ.get("LOCALAPPDATA") or "") / "npm-cache" / "_npx" / "e41f203b7505f1fb" / "node_modules" / "playwright",
]


def phase_screens() -> None:
    """Opcjonalne zrzuty Branding/Wizualizacje per instancja. Statyczny serwer UI na porcie
    instancji (PID dopisany do wlasnych procesow), dam-runtime.json wskazuje most instancji,
    zadania do 8765/8766 sa w przegladarce przerywane."""
    pw = next((p for p in PLAYWRIGHT_CANDIDATES if (p / "package.json").is_file()), None)
    if pw is None or shutil.which("node") is None:
        write_out("screens-skip.json", {"skipped": True, "reason": "brak playwright-cli / modulu playwright lub node"})
        log("zrzuty pominiete: brak playwright/node")
        return
    t0 = time.monotonic()
    flags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) | getattr(subprocess, "CREATE_NO_WINDOW", 0)
    pids = list(_STATE.get("pids") or [])
    cfg_inst = []
    for name, spec in INSTANCES.items():
        if not _port_free(spec["ui"]):
            raise RuntimeError(f"port UI {spec['ui']} zajety")
        web = inst_web(name)
        (web / "data" / "dam-runtime.json").write_text(json.dumps({
            "app": "dam-eta", "host": "127.0.0.1", "ui_port": spec["ui"], "bridge_port": spec["bridge"],
            "ui_origin": f"http://127.0.0.1:{spec['ui']}", "bridge": f"http://127.0.0.1:{spec['bridge']}",
            "e2e_instance": name}, indent=2), encoding="utf-8")
        lg = open(inst_dir(name) / "logs" / "ui-http.log", "a", encoding="utf-8")
        p = subprocess.Popen([str(RUNTIME_DST / "python.exe"), "-m", "http.server", str(spec["ui"]), "--bind", "127.0.0.1",
                              "--directory", str(web)], cwd=str(web), stdout=lg, stderr=subprocess.STDOUT, creationflags=flags)
        pids.append({"role": f"ui-http-{name}", "pid": p.pid, "port": spec["ui"], "started_at": utc()})
        cfg_inst.append({"name": name, "ui": f"http://127.0.0.1:{spec['ui']}", "bridge": f"http://127.0.0.1:{spec['bridge']}",
                         "token": token(name), "user": {"email": ADMIN_EMAIL, "name": "E2E Admin", "role": "admin"}})
    _STATE["pids"] = pids
    save_state()
    data = json.loads(PIDS_FILE.read_text(encoding="utf-8")) if PIDS_FILE.is_file() else {}
    data["processes"] = pids
    PIDS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    time.sleep(1.5)
    shots = out_dir() / "screens"
    shots.mkdir(parents=True, exist_ok=True)
    cfg = {"playwright": str(pw), "out": str(shots), "instances": cfg_inst}
    cfg_path = inst_dir("A") / "tmp" / "screens-config.json"
    cfg_path.write_text(json.dumps(cfg), encoding="utf-8")
    r = subprocess.run(["node", str(HERE / "screens.cjs"), str(cfg_path)], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=600)
    os.remove(cfg_path)
    write_out("screens-run.json", {"rc": r.returncode, "stdout": r.stdout[-2000:], "stderr": r.stderr[-3000:], "playwright": str(pw)})
    timing("screens", time.monotonic() - t0, rc=r.returncode)


def phase_stop() -> None:
    rep = stop_all()
    write_out("cleanup-proof.json", rep)
    for n in INSTANCES:
        src = inst_dir(n) / "logs" / "bridge.log"
        if src.is_file():
            shutil.copy2(src, out_dir() / f"bridge-{n}.log")
    log(f"sprzatanie: clean={rep['clean']} pozostale moje={len(rep['after_mine'])}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", default="all", choices=["all", "setup", "start", "scenarios", "screens", "stop"])
    ap.add_argument("--only", default="", help="np. S1,S2")
    args = ap.parse_args()
    only = [x.strip() for x in args.only.split(",") if x.strip()] or None
    if args.phase in ("all", "setup"):
        phase_setup()
    else:
        load_state()
        tp = out_dir() / "timings.json"
        if tp.is_file():
            TIMINGS.extend(json.loads(tp.read_text(encoding="utf-8")))
    try:
        if args.phase in ("all", "start"):
            phase_start()
        if args.phase in ("all", "scenarios"):
            phase_scenarios(only)
        if args.phase in ("all", "screens"):
            try:
                phase_screens()
            except Exception as exc:  # noqa: BLE001 - zrzuty sa opcjonalne
                write_out("screens-error.json", {"error": traceback.format_exc()[-3000:]})
                log(f"zrzuty: blad {exc}")
    finally:
        write_out("timings.json", TIMINGS)
        if args.phase == "all":
            phase_stop()
            write_out("timings.json", TIMINGS)
    if args.phase == "stop":
        phase_stop()
        write_out("timings.json", TIMINGS)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
