# -*- coding: utf-8 -*-
"""Launcher instancji testu odbioru (odbior.py). Kopiowany do <instancja>\\launcher\\.

Tryby (argv[1]; bez argumentu = bridge, bo tak uruchamia go nadzorca mostu z okna):
  okno    PRAWDZIWY PROGRAM: launch.main() (okno pywebview/WebView2 + serwer UI + nadzorca mostu)
          jako odizolowana instancja z portem CDP. Jedyna droga do zrzutow ekranu
          (decyzja wlasciciela 07.10.2026: DAM-u nie otwieramy w przegladarce).
  bridge  most DAM, jak instance_launcher.py (zawezone kandydaty ROOT), plus dziennik zapisow
          do bazy i wyjatek zapisu dla logowania
  ui      sam serwer UI (dam_ui_http) - tylko do pomiaru danych bez ekranu (--bez-okna)
  dbref   jednorazowy odczyt stanu wzorcowego z bazy (JSON na stdout)

Co tryb "okno" zmienia WYLACZNIE w procesie tej instancji (plikow programu nie rusza):
  - blokada jednego uruchomienia: wlasna nazwa mutexu (inaczej launch.py pokazalby okno
    uzytkownika i wyszedl, a gdyby okna nie znalazl - zabilby procesy na 8765/8766);
  - wylaczone: _kill_stale_dam_processes, _kill_listeners_on_dam_ports, takeover_stale_services,
    stop_stale_service, _focus_existing_window (zadna z nich nie moze dotknac DAM uzytkownika);
  - porty z argumentow, bez przeskoku na sasiednie;
  - most startuje przez ten launcher (LOCAL_BRIDGE), wiec ma dziennik SQL i sesje tylko do odczytu;
  - bez planszy startowej, ikony w zasobniku, harmonogramu aktualizacji, straznika F5
    (straznik szuka okna po tytule i reagowalby na F5 w oknie uzytkownika) i okienek MessageBox;
  - okno bez aktywacji (focus=False) i w podanym miejscu (poza ekranem), port CDP z argumentu.

Baza: instancja laczy sie z ta sama baza co program, ale KAZDA sesja jest tylko do odczytu
(PGOPTIONS=-c default_transaction_read_only=on ustawia harness; serwer odrzuca kazdy zapis
niezaleznie od kodu programu). Jedyny wyjatek, wlaczany przez ODBIOR_AUTH_RW=1: polaczenia
auth_store (logowanie, last_seen, wylogowanie) - decyzja kierownika 07.10.2026.

Dziennik (ODBIOR_SQL_LOG, JSONL): kazde polecenie SQL inne niz czysty odczyt - czas od startu,
tabela, poczatek polecenia BEZ parametrow, miejsce w kodzie, czy serwer je odrzucil.
"""
from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
import traceback
from pathlib import Path

DESKTOP = Path(os.environ["DAM_E2E_DESKTOP"]).resolve()
T0 = float(os.environ.get("ODBIOR_T0") or time.time())
SQL_LOG = os.environ.get("ODBIOR_SQL_LOG") or ""
READ_ONLY = "default_transaction_read_only=on" in (os.environ.get("PGOPTIONS") or "")
_LOCK = threading.Lock()
_READ_ONLY_HEAD = {"SELECT", "SHOW", "SET", "BEGIN", "COMMIT", "ROLLBACK", "START", "END", "FETCH",
                   "CLOSE", "DECLARE", "EXPLAIN", "RESET", "LISTEN", "UNLISTEN", "DISCARD"}
_WRITE_IN_SELECT = re.compile(r"\b(nextval|setval|pg_advisory_lock|pg_advisory_xact_lock|FOR\s+UPDATE|"
                              r"INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b", re.I)
_TABLE = re.compile(r"\b(?:INTO|UPDATE|FROM|TABLE(?:\s+IF\s+NOT\s+EXISTS)?|INDEX(?:\s+IF\s+NOT\s+EXISTS)?"
                    r"|ON)\s+([A-Za-z_][\w.\"]*)", re.I)


_IDEMPOTENT = re.compile(
    r"^\s*(CREATE\s+(UNIQUE\s+)?(TABLE|INDEX|SEQUENCE)\s+IF\s+NOT\s+EXISTS\b"
    r"|ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?\S+\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b)", re.I)
_OBJ = re.compile(r"(?:TABLE|INDEX|SEQUENCE)\s+IF\s+NOT\s+EXISTS\s+([\w.\"]+)", re.I)
_COL = re.compile(r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([\w.\"]+)(.*)", re.I | re.S)


def _strip(sql: str) -> str:
    return re.sub(r"--[^\n]*|/\*.*?\*/", " ", sql, flags=re.S)


_BODY = re.compile(r"\$(\w*)\$.*?\$\1\$", re.S)
_FN = re.compile(r"^\s*CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([\w.\"]+)", re.I)
_TRG_DROP = re.compile(r"^\s*DROP\s+TRIGGER\s+IF\s+EXISTS\s+(\w+)\s+ON\s+([\w.\"]+)", re.I)
_TRG_NEW = re.compile(r"^\s*CREATE\s+TRIGGER\s+(\w+)\b.*?\bON\s+([\w.\"]+)", re.I | re.S)


def idempotent_ddl(sql: str) -> list[str] | None:
    """Lista obiektow, gdy CALE polecenie to powtarzalne "upewnij sie, ze schemat jest": utworz, jesli
    nie ma (tabela, indeks, sekwencja, kolumna), CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS +
    CREATE TRIGGER. Program wysyla je przy kazdym starcie (pg_db._ensure_kv_index, assoc_sync._ensure_pg);
    w sesji tylko do odczytu serwer je odrzuca i program przerywa cykl - czego na prawdziwym komputerze
    nie ma. Dlatego instancja testowa ich NIE WYSYLA, a harness po tescie sprawdza odczytem, ze kazdy
    obiekt istnieje. Dla funkcji i wyzwalaczy "istnieje" nie znaczy "ma te sama tresc" - prawdziwy program
    by je nadpisal; to jest wypisane w werdykcie jako zapis, ktory program robi przy kazdym starcie."""
    parts = [x for x in _BODY.sub("$tresc$", _strip(sql)).split(";") if x.strip()]
    if not parts:
        return None
    objs: list[str] = []
    for x in parts:
        x = x.strip()
        m = _COL.match(x) if _IDEMPOTENT.match(x) and x.upper().startswith("ALTER") else None
        if m:
            table = m.group(1).strip('"')
            objs += [f"{table}.{c}" for c in
                     re.findall(r"ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)", m.group(2), re.I)]
        elif _IDEMPOTENT.match(x):
            objs += [o.strip('"') for o in _OBJ.findall(x)]
        elif _FN.match(x):
            objs.append("fn:" + _FN.match(x).group(1).strip('"'))
        elif _TRG_DROP.match(x):
            continue  # para z CREATE TRIGGER nizej
        elif _TRG_NEW.match(x):
            t = _TRG_NEW.match(x)
            objs.append(f"trg:{t.group(1)}@{t.group(2).strip(chr(34))}")
        else:
            return None
    return objs


def _sql_text(cur, query) -> str:
    try:
        if isinstance(query, bytes):
            return query.decode("utf-8", "replace")
        if hasattr(query, "as_string"):
            return query.as_string(cur)
        return str(query)
    except Exception:  # noqa: BLE001
        return repr(query)[:300]


def classify(sql: str) -> str:
    """'' dla czystego odczytu, inaczej slowo kluczowe polecenia zapisujacego."""
    s = _strip(sql).strip()
    head = (s.split(None, 1)[0] if s else "").upper().rstrip(";")
    if head == "WITH":
        m = re.search(r"\b(INSERT|UPDATE|DELETE)\b", s, re.I)
        return m.group(1).upper() if m else ""
    if head in _READ_ONLY_HEAD:
        m = _WRITE_IN_SELECT.search(s) if head == "SELECT" else None
        return ("SELECT+" + re.sub(r"\s+", " ", m.group(1)).upper()) if m else ""
    return head or "?"


def _site() -> str:
    out = []
    for fr in traceback.extract_stack(limit=18)[:-3]:
        name = Path(fr.filename).name
        if name == Path(__file__).name or "psycopg2" in fr.filename.replace("\\", "/"):
            continue
        if Path(fr.filename).suffix == ".py" and "Lib" not in Path(fr.filename).parts:
            out.append(f"{name}:{fr.lineno} {fr.name}")
    return " < ".join(reversed(out[-3:]))


def _log(rec: dict) -> None:
    if not SQL_LOG:
        return
    with _LOCK:
        with open(SQL_LOG, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")


def _run(cur, fn, query, *args, **kwargs):
    kind = classify(_sql_text(cur, query))
    if not kind:
        return fn(cur, query, *args, **kwargs)
    text = re.sub(r"\s+", " ", _sql_text(cur, query)).strip()
    m = _TABLE.search(text)
    rec = {"t": round(time.time() - T0, 2), "kind": kind, "table": (m.group(1).strip('"') if m else ""),
           "sql": text[:220], "thread": threading.current_thread().name, "site": _site(),
           "blocked": False, "error": ""}
    objs = idempotent_ddl(_sql_text(cur, query)) if READ_ONLY else None  # w bazie testowej schemat ma powstac
    if objs is not None:
        rec.update({"kind": "CREATE-IF-NOT-EXISTS", "skipped": True, "objects": objs})
        _log(rec)
        return None
    try:
        res = fn(cur, query, *args, **kwargs)
        _log(rec)
        return res
    except Exception as exc:  # noqa: BLE001
        msg = str(exc).strip().splitlines()[0] if str(exc).strip() else type(exc).__name__
        rec["blocked"] = "read-only" in msg
        rec["error"] = msg[:200]
        _log(rec)
        raise


def install_sql_log() -> None:
    import psycopg2
    import psycopg2.extensions
    import psycopg2.extras

    def make(base):
        class LogCursor(base):  # type: ignore[misc, valid-type]
            def execute(self, query, vars=None):  # noqa: A002
                return _run(self, base.execute, query, vars)

            def executemany(self, query, vars_list):
                return _run(self, base.executemany, query, vars_list)

            def copy_expert(self, sql, file, *a, **k):
                return _run(self, base.copy_expert, sql, file, *a, **k)

        LogCursor.__name__ = "Log" + base.__name__
        return LogCursor

    plain = make(psycopg2.extensions.cursor)
    psycopg2.extras.RealDictCursor = make(psycopg2.extras.RealDictCursor)
    psycopg2.extras.DictCursor = make(psycopg2.extras.DictCursor)
    orig_connect = psycopg2.connect

    def connect(*a, **k):
        k.setdefault("cursor_factory", plain)
        return orig_connect(*a, **k)

    psycopg2.connect = connect


def install_auth_rw() -> None:
    """Tylko logowanie pisze do bazy: polaczenia auth_store dostaja sesje zapisujaca."""
    import auth_store

    orig = auth_store._connect  # noqa: SLF001

    def connect_rw():
        conn = orig()
        if type(conn).__module__.startswith("psycopg2"):
            cur = conn.cursor()
            cur.execute("SET default_transaction_read_only = off")
            cur.close()
            conn.commit()
        return conn

    auth_store._connect = connect_rw  # noqa: SLF001


def _apply_dirs() -> None:
    """Most, serwer UI i odczyt wzorca pracuja na katalogach uzytkownika INSTANCJI (ODBIOR_DIR_*).
    Okno programu zostaje na prawdziwych: WebView2 startujacy pierwszy raz w pustych, podmienionych
    katalogach uzytkownika nie wystawia portu CDP (sonda 07.10.2026). Stan programu i tak idzie do
    DAM_STATE_DIR instancji, a profil WebView2 do jej data\\webview2-profile."""
    for key in ("LOCALAPPDATA", "APPDATA", "TEMP", "TMP", "USERPROFILE", "HOME"):
        val = os.environ.get("ODBIOR_DIR_" + key)
        if val:
            os.environ[key] = val


def _prep_path() -> None:
    if str(DESKTOP) not in sys.path:
        sys.path.insert(0, str(DESKTOP))
    os.chdir(str(DESKTOP))


def _restrict_roots() -> None:
    """Jak instance_launcher.main(): kandydaci ROOT tylko z DAM_E2E_ALLOWED_ROOTS (nigdy prawdziwy
    M:/D:\\Marketing, chyba ze harness sam go tam wpisal)."""
    allowed = [Path(x) for x in os.environ.get("DAM_E2E_ALLOWED_ROOTS", "").split(os.pathsep) if x.strip()]
    import marketing_discovery as md

    md.PREFERRED_CANDIDATES = tuple(allowed)
    md.discover_roots = lambda *_a, **_k: [x for x in allowed if x.is_dir()]  # type: ignore[assignment]

    def _probe_drives(*_a, required=md.REQUIRED_ROOT_FOLDERS, **_k):
        out = []
        for x in allowed:
            if not x.is_dir():
                continue  # komputer bez ROOT: zadnego "wykryto folder" na ekranie
            missing = [r for r in required if not (x / r).is_dir()]
            out.append({"path": str(x), "ok": not missing, "exists": True, "missing": missing, "timeout": False})
        return out

    md.probe_drives = _probe_drives  # type: ignore[assignment]
    md.logical_drive_letters = lambda: []  # type: ignore[assignment]
    import dam_path_resolve

    dam_path_resolve.set_marketing_candidates(allowed)
    import local_bridge

    local_bridge.MARKETING_CANDIDATES = tuple(allowed)


# Okno dla recenzentow na prawdziwym ROOT (ODBIOR_HTTP_READONLY=1): przepuszczane sa tylko zadania POST,
# ktore zmieniaja co najwyzej stan TEJ instancji (sesja, ustawienia, lokalny spis, tryb danych). Reszta = 403:
# wszystko, co pisze na ROOT (/explorer/*, /rename-*, /branding/copy-visual, /change-log/undo), wychodzi na
# zewnatrz (/integrations/*, /finance/invoices/push, /synology-share, /support-report, /viz-request,
# /app-update/apply) albo otwiera okna na pulpicie wlasciciela (/open, /reveal, /pick-folder).
_POST_OK = ("/auth/", "/telemetry/", "/thumb-cache/warm", "/thumb-cache/sync/start", "/user-prefs",
            "/user-device-paths", "/machine-config", "/root/switch", "/validate-base", "/index/rebuild",
            "/index/cancel", "/index/snooze", "/data-mode", "/db/reconnect", "/db/refresh",
            "/inbox-items/mark-read", "/file-availability", "/app-update/success", "/app-update/prefs")


def install_http_readonly() -> None:
    import local_bridge

    orig = local_bridge.Handler.do_POST

    def do_POST(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        if not path.startswith(_POST_OK):
            _log({"t": round(time.time() - T0, 2), "kind": "HTTP-POST-ODRZUCONY", "table": path, "sql": "",
                  "thread": threading.current_thread().name, "site": "okno tylko do odczytu", "blocked": True,
                  "error": "odbior_readonly"})
            body = json.dumps({"ok": False, "error": "odbior_readonly",
                               "message": "Okno testowe: tylko odczyt."}).encode("utf-8")
            self.send_response(403)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            try:
                self._cors()  # type: ignore[attr-defined]
            except Exception:  # noqa: BLE001
                self.send_header("Access-Control-Allow-Origin", os.environ.get("DAM_UI_ORIGIN", "*"))
            self.end_headers()
            self.wfile.write(body)
            return
        return orig(self)

    local_bridge.Handler.do_POST = do_POST


SWITCHES = ("BAZA-WYLACZONA", "SPIS-WSTRZYMANY", "SPIS-BLAD")


def _switch(name: str) -> bool:
    d = os.environ.get("ODBIOR_FLAGS_DIR") or ""
    return bool(d) and os.path.exists(os.path.join(d, name))


def install_switches() -> None:
    """Przelaczniki okna testowego = pliki w ODBIOR_FLAGS_DIR, zmieniane w trakcie pracy okna (bez restartu):
      BAZA-WYLACZONA   kazde polaczenie z baza konczy sie bledem "Connection refused" (komputer bez sieci do bazy)
      SPIS-WSTRZYMANY  pobieranie spisu i wierszy materialow czeka (ekran "Pobieram katalog z bazy" stoi do zdjecia)
      SPIS-BLAD        pobranie spisu i wierszy konczy sie bledem, logowanie i reszta dzialaja
    Dziala w procesie mostu tej instancji; niczego nie zmienia w bazie ani w sieci."""
    import psycopg2

    orig_connect = psycopg2.connect

    def connect(*a, **k):
        if _switch("BAZA-WYLACZONA"):
            time.sleep(1.0)
            raise psycopg2.OperationalError(
                "connection to server failed: Connection refused (okno testowe: przelacznik BAZA-WYLACZONA)")
        return orig_connect(*a, **k)

    psycopg2.connect = connect

    def gate(fn):
        def wrapped(*a, **k):
            while _switch("SPIS-WSTRZYMANY"):
                time.sleep(0.5)
            if _switch("SPIS-BLAD"):
                raise RuntimeError("okno testowe: przelacznik SPIS-BLAD - pobranie z bazy wylaczone")
            return fn(*a, **k)

        return wrapped

    import asset_sync
    import pg_db

    pg_db.index_snapshot_meta = gate(pg_db.index_snapshot_meta)
    pg_db.fetch_index_snapshot = gate(pg_db.fetch_index_snapshot)
    asset_sync.pull_since = gate(asset_sync.pull_since)


def install_no_scan() -> None:
    """Okno dla recenzentow na prawdziwym ROOT: instancja NIE przeglada dysku (zadnego obciazenia M:)."""
    import index_supervisor

    index_supervisor.ensure_index_supervisor = lambda *a, **k: {  # type: ignore[assignment]
        "ok": True, "owned": False, "started": False, "reason": "odbior_no_scan"}
    import asset_sync_runner

    orig_run_once = asset_sync_runner.run_once

    def run_once(*a, **k):  # materialy: tylko pobieranie wierszy z bazy, bez przegladania ROOT
        k["root_alive"] = False
        return orig_run_once(*a, **k)

    asset_sync_runner.run_once = run_once
    try:
        import dam_thumb_cache

        dam_thumb_cache.start_marketing_fill_watch = lambda *a, **k: {  # type: ignore[assignment]
            "ok": True, "started": False, "reason": "odbior_no_scan", "running": None}
    except Exception:  # noqa: BLE001
        pass


def main_bridge() -> None:
    _apply_dirs()
    _prep_path()
    log_path = os.environ.get("ODBIOR_BRIDGE_LOG")
    if log_path:  # nadzorca mostu z okna wysyla stdout do DEVNULL - zachowaj log w katalogu przebiegu
        fh = open(log_path, "a", encoding="utf-8", buffering=1)
        sys.stdout = sys.stderr = fh
    install_sql_log()
    if os.environ.get("ODBIOR_AUTH_RW") == "1":
        install_auth_rw()
    print("[odbior] most: PGOPTIONS=%r auth_rw=%s komputer=%s uzytkownik=%s" % (
        os.environ.get("PGOPTIONS"), os.environ.get("ODBIOR_AUTH_RW"),
        os.environ.get("COMPUTERNAME"), os.environ.get("USERNAME")), flush=True)
    _restrict_roots()
    import local_bridge

    if os.environ.get("ODBIOR_HTTP_READONLY") == "1":
        install_http_readonly()
    if os.environ.get("ODBIOR_NO_SCAN") == "1":
        install_no_scan()
    if os.environ.get("ODBIOR_FLAGS_DIR"):
        install_switches()
    print("[odbior] most port", local_bridge.PORT, "desktop", local_bridge.DESKTOP_DIR,
          "kandydaci ROOT", [str(x) for x in local_bridge.MARKETING_CANDIDATES], flush=True)
    local_bridge.main()


def main_okno() -> None:
    """Prawdziwy program jako odizolowana instancja. argv: ui_port bridge_port cdp_port x y"""
    _prep_path()
    ui_port, bridge_port, cdp_port, x, y = (int(v) for v in sys.argv[2:7])
    tag = f"{os.environ.get('COMPUTERNAME', 'ODBIOR')}_{bridge_port}"
    log_path = Path(os.environ.get("ODBIOR_OKNO_LOG") or (DESKTOP / "data" / "okno.log"))

    def note(*a) -> None:
        with open(log_path, "a", encoding="utf-8") as fh:
            fh.write(f"{time.time() - T0:8.2f} " + " ".join(str(v) for v in a) + "\n")

    os.environ["DAM_NO_SPLASH"] = "1"
    import bridge_supervisor
    import launch

    launch.MUTEX_NAME = f"Local\\DAM_ODBIOR_{tag}"
    launch._kill_stale_dam_processes = lambda: 0  # noqa: SLF001
    launch._kill_listeners_on_dam_ports = lambda: 0  # noqa: SLF001
    launch._focus_existing_window = lambda: False  # noqa: SLF001
    launch.start_hard_reset_watchdog = lambda api: None
    launch.schedule_relaunch = lambda: None
    launch.apply_native_window_icon = lambda icon_path: None  # szuka okna po tytule - trafilby w okno uzytkownika
    launch.win_message = lambda title, text, icon=0x10: note("MessageBox (pominiety):", title, "|", text)
    launch.DEFAULT_UI_PORT, launch.DEFAULT_BRIDGE_PORT = ui_port, bridge_port
    launch.pick_free_port = lambda preferred: int(preferred)
    bridge_supervisor.takeover_stale_services = lambda *a, **k: {"ok": True, "skipped": "odbior"}
    bridge_supervisor.stop_stale_service = lambda *a, **k: {"ok": False, "error": "odbior_no_kill", "pids": []}
    bridge_supervisor.LOCAL_BRIDGE = Path(__file__).resolve()
    for mod, name in (("dam_tray", "start_tray"), ("app_updates", "ensure_scheduler_started")):
        try:
            setattr(__import__(mod), name, lambda *a, **k: None)
        except Exception as exc:  # noqa: BLE001
            note("pominiecie", mod, name, "nieudane:", exc)

    import webview

    webview.settings["REMOTE_DEBUGGING_PORT"] = cdp_port
    orig_create = webview.create_window

    def create_window(*a, **k):
        k.update({"focus": False, "x": x, "y": y})
        if os.environ.get("ODBIOR_START_BLANK") == "1":
            # Okno startuje na pustej stronie; pierwsze wejscie na strone programu robi sterownik CDP,
            # gdy ma juz zalozony nasluch. Podlaczanie CDP w trakcie pierwszego ladowania strony
            # zbieglo sie 2 razy z ekranem "Nie udalo sie uruchomic aplikacji" (07.10.2026).
            start = a[1] if len(a) > 1 else k.pop("url", "")
            a = a[:1]
            k["html"] = "<!doctype html><title>DAM</title><body style='background:#f7f7f7'></body>"
            note("start_url (wejdzie sterownik CDP):", start)
        note("create_window", {kk: k[kk] for kk in ("width", "height", "x", "y", "focus") if kk in k})
        return orig_create(*a, **k)

    webview.create_window = create_window

    def _keep_restored() -> None:
        """Zminimalizowane okno falszuje pomiary (strona dostaje ~1 klatke/s). Gdy cos je zminimalizuje
        (np. Win+D wlasciciela), przywroc BEZ aktywacji i zapisz godzine - to tez dowod, kiedy sie to dzieje."""
        import ctypes
        from ctypes import wintypes

        u = ctypes.windll.user32
        me = os.getpid()
        found: list[int] = []

        @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        def each(hwnd, _l):
            wp = wintypes.DWORD(0)
            u.GetWindowThreadProcessId(hwnd, ctypes.byref(wp))
            if int(wp.value) == me and u.IsWindowVisible(hwnd) and u.IsIconic(hwnd):
                found.append(hwnd)
            return True

        while True:
            time.sleep(2)
            del found[:]
            try:
                u.EnumWindows(each, 0)
                for hwnd in found:
                    u.ShowWindow(hwnd, 4)  # SW_SHOWNOACTIVATE
                    note("okno bylo zminimalizowane - przywrocone bez aktywacji", time.strftime("%H:%M:%S"))
            except Exception as exc:  # noqa: BLE001
                note("straznik minimalizacji:", exc)

    threading.Thread(target=_keep_restored, daemon=True, name="odbior-okno-widoczne").start()
    note("okno: start", {"ui": ui_port, "most": bridge_port, "cdp": cdp_port, "mutex": launch.MUTEX_NAME})
    owner = int(os.environ.get("ODBIOR_OWNER_PID") or 0)
    if owner:  # harness zniknal (zabity, awaria) -> okno zamyka sie samo, zeby nie zostala sierota
        import rebuild_lock

        def _watch_owner() -> None:
            while rebuild_lock._pid_alive(owner):  # noqa: SLF001 - OpenProcess, niczego nie zabija
                time.sleep(5)
            note("wlasciciel", owner, "nie zyje - zamykam okno")
            for w in list(getattr(webview, "windows", []) or []):
                try:
                    w.destroy()
                except Exception:  # noqa: BLE001
                    pass
            time.sleep(8)
            os._exit(0)

        threading.Thread(target=_watch_owner, daemon=True, name="odbior-owner").start()
    launch.main()


def main_ui() -> None:
    _apply_dirs()
    _prep_path()
    ui_port, bridge_port = int(sys.argv[2]), int(sys.argv[3])
    import dam_ui_http
    import runtime_config

    runtime_config.write_runtime_file(ui_port, bridge_port)
    dam_ui_http.DamUiRequestHandler.runtime = runtime_config.runtime_payload(ui_port, bridge_port)
    httpd = dam_ui_http.ThreadingReusableTCPServer(("127.0.0.1", ui_port), dam_ui_http.DamUiRequestHandler)
    print(f"[odbior] UI http://127.0.0.1:{ui_port} -> most {bridge_port}", flush=True)
    httpd.serve_forever()


def main_dbref() -> None:
    """Stan wzorcowy z bazy. argv[2] = JSON {"email":..., "device_id":...} albo pominiete."""
    import hashlib

    _apply_dirs()
    _prep_path()
    import pg_db

    ask = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    out: dict = {"ok": True, "taken_at": time.time()}
    conn = None
    for attempt in range(4):  # pierwsze uzycie paczki: aktywacja z kodu z instalatora bywa gotowa dopiero za 2. razem
        try:
            pg_db.ensure_pg_config_ready()
            conn = pg_db.connect()
            break
        except Exception as exc:  # noqa: BLE001
            out.setdefault("connect_errors", []).append(f"{type(exc).__name__}: {str(exc)[:160]}")
            pg_db.reset_config_cache()
            time.sleep(2)
    if conn is None:
        out["ok"] = False
        out["error"] = "; ".join(out.get("connect_errors") or [])
        sys.stdout.write(json.dumps(out, ensure_ascii=False))
        return
    try:
        cur = conn.cursor()
        cur.execute("SHOW default_transaction_read_only")
        out["read_only"] = list(cur.fetchone().values())[0]
        cur.execute("SELECT current_database() AS db, current_user AS usr")
        out.update(dict(cur.fetchone()))
        def table(name: str) -> bool:
            cur.execute("SELECT to_regclass(%s) AS r", (name,))
            return bool(cur.fetchone()["r"])

        out["snapshots"], out["assets"], out["thumb_index_rows"], out["index_authority"] = {}, {}, None, None
        if table("dam_index_snapshots"):
            cur.execute("SELECT store_key, generation, sha256, raw_bytes, item_count, built_at, built_by, "
                        "published_at FROM dam_index_snapshots ORDER BY store_key")
            out["snapshots"] = {r["store_key"]: dict(r) for r in cur.fetchall()}
        if table("dam_assets"):
            cur.execute("SELECT count(*) FILTER (WHERE deleted_at IS NULL) AS live, "
                        "count(*) FILTER (WHERE deleted_at IS NOT NULL) AS dead, max(rev) AS max_rev FROM dam_assets")
            out["assets"] = dict(cur.fetchone())
        if table("dam_thumb_cache_index"):
            cur.execute("SELECT count(*) AS n FROM dam_thumb_cache_index")
            out["thumb_index_rows"] = cur.fetchone()["n"]
        if table("dam_meta"):
            cur.execute("SELECT value FROM dam_meta WHERE key = 'index_authority'")
            row = cur.fetchone()
            out["index_authority"] = row["value"] if row else None
        if ask.get("email"):
            cur.execute("SELECT s.device_id, s.token_hash, s.revoked, s.last_seen_at, s.hostname, s.windows_user "
                        "FROM device_sessions s JOIN users u ON u.id = s.user_id "
                        "WHERE LOWER(u.email) = LOWER(%s) ORDER BY s.device_id", (ask["email"],))
            out["sessions"] = [{
                "device_id": r["device_id"], "revoked": bool(r["revoked"]), "last_seen_at": r["last_seen_at"],
                "hostname": r["hostname"], "windows_user": r["windows_user"],
                # skrot skrotu: pozwala stwierdzic zmiane tokenu bez wypisywania token_hash
                "token_hash_sha256": hashlib.sha256(str(r["token_hash"] or "").encode()).hexdigest()[:16],
            } for r in cur.fetchall()]
        if ask.get("objects"):
            found = {}
            for name in ask["objects"]:
                if name.startswith("fn:"):
                    cur.execute("SELECT to_regproc(%s) AS r", (name[3:],))
                    found[name] = bool(cur.fetchone()["r"])
                elif name.startswith("trg:"):
                    cur.execute("SELECT 1 AS x FROM pg_trigger WHERE tgname = %s AND NOT tgisinternal LIMIT 1",
                                (name[4:].split("@")[0],))
                    found[name] = bool(cur.fetchone())
                elif "." in name and not name.startswith("public."):
                    table, col = name.rsplit(".", 1)
                    cur.execute("SELECT 1 AS x FROM information_schema.columns WHERE table_name = %s "
                                "AND column_name = %s LIMIT 1", (table.split(".")[-1], col))
                    found[name] = bool(cur.fetchone())
                else:
                    cur.execute("SELECT to_regclass(%s) AS r", (name,))
                    found[name] = bool(cur.fetchone()["r"])
            out["objects"] = found
        if ask.get("databases"):
            cur.execute("SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY 1")
            out["databases"] = [r["datname"] for r in cur.fetchall()]
            cur.execute("SELECT rolname FROM pg_roles WHERE rolname LIKE 'dam%%' ORDER BY 1")
            out["roles"] = [r["rolname"] for r in cur.fetchall()]
    finally:
        conn.close()
    if ask.get("file_index"):
        got = pg_db.fetch_index_snapshot("file-index")
        if got:
            meta, raw = got
            data = json.loads(raw.decode("utf-8"))
            ids = sorted(str(p.get("id") or "") for p in data.get("products") or [])
            out["file_index"] = {"generation": meta["generation"], "sha256_raw": hashlib.sha256(raw).hexdigest(),
                                 "generated_at": data.get("generated_at"), "products": len(ids), "ids": ids}
    sys.stdout.write(json.dumps(out, ensure_ascii=False, default=str))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "bridge"
    {"bridge": main_bridge, "ui": main_ui, "dbref": main_dbref, "okno": main_okno}[mode]()
