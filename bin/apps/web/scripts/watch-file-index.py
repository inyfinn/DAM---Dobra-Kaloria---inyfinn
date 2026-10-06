# -*- coding: utf-8 -*-
"""
Watcher: szybkie odswiezanie indeksu + miniatur po zmianie wizualizacji na dysku.

Wspoldzielony O_EXCL lock z recznym POST /index/rebuild.
Status + log sterowane przez index_supervisor (bridge owner).

Po udanym file-index: hook branding (scripts/ops/rebuild-branding-pipeline.py) —
jeden watcher, bez drugiego demona.

Od 06.10.2026 zmiana w folderze produktu NIE przebudowuje juz calego ROOT (26-54 min na M:):
watcher zapamietuje mtime per folder produktu (product_snapshot), po 5 s ciszy (ChangeTracker)
wola build-file-index.py --only-product <folder> --merge-into file-index.json tylko dla
zmienionych produktow. Pelny skan zostaje dla pierwszego uruchomienia, braku/uszkodzenia
indeksu (kod 5 buildera), zbyt wielu zmian naraz (--incremental-max) i rzadkiego przebiegu
awaryjnego (--hourly, domyslnie 6 h, liczony od ostatniego PELNEGO skanu).

Usage:
  python apps/web/scripts/watch-file-index.py
  python apps/web/scripts/watch-file-index.py --interval 5 --no-initial
  python apps/web/scripts/watch-file-index.py --root C:/tmp/fixture --once
"""
from __future__ import annotations

import argparse
import itertools
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

SCRIPT = Path(__file__).resolve()
BUILD = SCRIPT.parent / "build-file-index.py"
DESKTOP_DATA = SCRIPT.parents[2] / "desktop" / "data"


def _state_dir() -> Path:
    """Ten sam kontrakt co rebuild_lock.resolve_state_dir (tu bez importu z desktop/).

    Stan biezacego uruchomienia nie moze lezec w repo: drzewo jest lustrzane przez
    Synology Drive, ktory podmienia plik w trakcie zapisu i rodzi kopie *_Conflict.
    """
    raw = (os.environ.get("DAM_STATE_DIR") or "").strip()
    if raw:
        cand = Path(raw)
    else:
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or ""
        if not base:
            return DESKTOP_DATA
        cand = Path(base) / "DAM" / "state"
    try:
        cand.mkdir(parents=True, exist_ok=True)
        probe = cand / ".write-probe"
        probe.write_text("1", encoding="utf-8")
        probe.unlink()
    except OSError:
        return DESKTOP_DATA
    return cand


STATE_DIR = _state_dir()
DEFAULT_STATUS = STATE_DIR / "index-watcher-status.json"
DEFAULT_LOCK = STATE_DIR / "index-rebuild.lock.json"
# Kod wyjscia build-file-index.py: przyrost niemozliwy (brak/uszkodzony indeks, inne rooty)
NEEDS_FULL_RC = 5
HOURLY_DEFAULT_SEC = 21600.0  # przebieg awaryjny co 6 h (patrz --hourly)
DEBOUNCE_DEFAULT_SEC = 5.0
INCREMENTAL_MAX_DEFAULT = 40
BIN_ROOT = SCRIPT.parents[3]
BRANDING_PIPELINE = BIN_ROOT / "scripts" / "ops" / "rebuild-branding-pipeline.py"
WEB_DATA = SCRIPT.parents[1] / "data"

# Ensure sibling marketing_roots import works when cwd differs
if str(SCRIPT.parent) not in sys.path:
    sys.path.insert(0, str(SCRIPT.parent))
# Desktop helpers (rebuild_lock, index_snapshots) for shared lock / mark_built_here
_DESKTOP = SCRIPT.parents[2] / "desktop"
if _DESKTOP.is_dir() and str(_DESKTOP) not in sys.path:
    sys.path.insert(0, str(_DESKTOP))


def _mark_built_here_safe(key: str, path: Path) -> None:
    """PLAN Faza 3, zadanie 3.4/3.6 (27.09.2026): most (local_bridge.py) oznacza
    built_here_sha TYLKO po buildach, ktore SAM uruchamia - ten watcher (godzinowy
    i wyzwalany zmiana na dysku) buduje NIEZALEZNIE i nigdy nie oznaczal swoich
    plikow. Bez tego index_snapshots.publish_changed odrzucalby KAZDY wynik tego
    watchera jako "not_built_here" - caly mechanizm publikacji migawek by ucichl.

    Import warunkowy (desktop/ moze byc niedostepny w fixture/testach spoza repo);
    wyjatek NIGDY nie wywraca watchera - to tylko oznaczenie, nie krok krytyczny."""
    try:
        import index_snapshots

        res = index_snapshots.mark_built_here(key, path)
        if not res.get("ok"):
            print(f"[watch] mark_built_here({key}) skip: {res}")
    except Exception as exc:  # noqa: BLE001
        print(f"[watch] mark_built_here({key}) error: {exc}")


def resolve_marketing_base() -> Path:
    from marketing_roots import resolve_marketing_base as _resolve

    return _resolve()


def _script_python() -> str:
    """Prefer pythonw.exe — console python.exe flashes a CMD window on spawn."""
    try:
        from branding_publish import resolve_script_python

        return resolve_script_python(require_ijson=False)
    except Exception:
        exe = Path(sys.executable)
        pyw = exe.with_name("pythonw.exe")
        if pyw.is_file():
            return str(pyw)
        return str(exe)


def watch_product_roots(base: Path) -> list[Path]:
    roots = [
        base / "- POLSKA" / "01 - PRODUKTY" / "- DK",
        base / "- EKSPORT" / "01 - PRODUCTS" / "- GC",
    ]
    return [r for r in roots if r.is_dir()]


def _builder_env() -> dict[str, str]:
    """Same DAM_INDEX_LIVE_FILE contract as index_supervisor / bridge rebuild."""
    try:
        from index_supervisor import index_builder_env

        return index_builder_env()
    except Exception:
        env = os.environ.copy()
        live = STATE_DIR / "index-live.json"
        raw = (env.get("DAM_INDEX_LIVE_FILE") or "").strip()
        if not raw or raw in {".", "./", ".\\"}:
            env["DAM_INDEX_LIVE_FILE"] = str(live)
        return env


def watch_branding_roots(base: Path) -> list[Path]:
    """Full branding scan set from build-branding-index.scan_marketing_roots.

    Any new file under these trees (image, video, svg, vector, doc — whatever
    branding already indexes) must trigger the branding pipeline immediately.
    Product DK/GC trees stay on watch_product_roots (file-index + branding hook).
    """
    polska = base / "- POLSKA"
    eksport = base / "- EKSPORT"
    roots = [
        polska / "- BRANDING i MARKA -",
        polska / "02 - FIRMOWE MATERIAŁY",
        polska / "02 - FIRMOWE MATERIALY",
        polska / "03 - MATERIAŁY GRAFICZNE",
        polska / "03 - MATERIALY GRAFICZNE",
        polska / "04 - PROCESY",
        polska / "05 - SOCIAL MEDIA",
        polska / "06 - STRONY WWW - INTERNET",
        polska / "07 - E-COMMERCE",
        polska / "08 - KAMAPANIE",
        eksport / "- BRANDING i MARKA -",
    ]
    out: list[Path] = []
    seen: set[str] = set()
    for r in roots:
        if not r.is_dir():
            continue
        try:
            key = str(r.resolve()).lower()
        except OSError:
            key = str(r).lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def tree_mtime(root: Path, max_depth: int = 5) -> float:
    """Najnowszy mtime do max_depth (0=root). Szybkie, bez walku calego dysku.

    depth 5 od -DK: kat→produkt→wariant→4-WIZKI→INTERNET-PREZENTACJE-RGB.
    depth 3 konczylo na folderze wariantu i nie widzialo nowych plikow w WIZKI.
    """
    latest = 0.0
    try:
        latest = root.stat().st_mtime
    except OSError:
        return 0.0

    def walk(p: Path, depth: int) -> None:
        nonlocal latest
        if depth > max_depth:
            return
        try:
            children = list(p.iterdir())
        except OSError:
            return
        for child in children:
            try:
                st = child.stat()
            except OSError:
                continue
            if st.st_mtime > latest:
                latest = st.st_mtime
            name_u = child.name.upper()
            if child.is_dir() and (
                depth < max_depth
                or "WIZ" in name_u
                or "VISUAL" in name_u
                or "DRUK" in name_u
                or "BRAND" in name_u
            ):
                walk(child, depth + 1)

    walk(root, 0)
    return latest


def _replace_with_retry(tmp, target, attempts: int = 8, delay: float = 0.03) -> bool:
    """os.replace z ponowieniami. Windows: PermissionError, gdy ktos czyta cel w tej chwili.
    False = nie udalo sie (tmp usuniety); NIGDY nie zapisujemy celu nieatomowo, bo dwa takie
    zapisy naraz zostawialy poprawny JSON z ogonem starszej wersji ('Extra data')."""
    import os as _os
    import time as _time

    for i in range(attempts):
        try:
            _os.replace(tmp, target)
            return True
        except OSError:
            if i + 1 < attempts:
                _time.sleep(delay * (i + 1))
    try:
        _os.unlink(tmp)
    except OSError:
        pass
    return False


def roots_mtime(roots: list[Path], max_depth: int = 5) -> float:
    return max((tree_mtime(r, max_depth=max_depth) for r in roots), default=0.0)


def _subdirs(path: str) -> list[str]:
    """Podkatalogi `path`. BLAD LISTOWANIA = wyjatek OSError (nie pusta lista): snapshot z dziurami
    (odmontowany dysk, zerwane SMB) wygladalby jak 'wszystkie produkty zniknely' i wyzwolilby
    pelny skan; petla glowna lapie OSError i po prostu pomija ten takt."""
    with os.scandir(path) as it:
        return [e.path for e in it if e.is_dir()]


def _subtree_mtime(top: str, start_depth: int, max_depth: int) -> float:
    """Najnowszy mtime drzewa `top` (lezy na glebokosci `start_depth` od rootu) do max_depth.

    Te same granice co tree_mtime (wpisy do poziomu max_depth+1), ale przez os.scandir:
    mtime wpisu pochodzi z samego listowania katalogu (na Windows bez dodatkowego zapytania
    na kazdy plik) - na SMB to polowa ruchu sieciowego co Path.iterdir()+stat()."""
    try:
        latest = os.stat(top).st_mtime
    except OSError:
        return 0.0
    stack = [(top, start_depth)]
    while stack:
        p, depth = stack.pop()
        if depth > max_depth:
            continue
        try:
            with os.scandir(p) as it:
                entries = list(it)
        except OSError:
            continue
        for e in entries:
            try:
                st = e.stat()
                is_dir = e.is_dir()
            except OSError:
                continue
            if st.st_mtime > latest:
                latest = st.st_mtime
            if is_dir and depth < max_depth:
                stack.append((e.path, depth + 1))
    return latest


def product_snapshot(roots: list[Path], max_depth: int = 5) -> dict[str, float]:
    """{folder produktu -> najnowszy mtime jego drzewa do max_depth}.

    Folder produktu = poziom 2 od rootu (root/kategoria/produkt); folder '— ARCHIWUM' kategorii
    tez jest takim kluczem (builder zamienia go na przebudowe kategorii). Na SMB plik gleboko
    w produkcie NIE podnosi mtime folderu produktu, dlatego przechodzimy do max_depth jak dotad,
    ale ZAPISUJEMY, ktory produkt sie zmienil. Dodany/zmieniony/usuniety produkt = inny
    wpis albo jego brak."""
    snap: dict[str, float] = {}
    for root in roots:
        for cat in _subdirs(os.fspath(root)):
            for prod in _subdirs(cat):
                snap[prod] = _subtree_mtime(prod, 2, max_depth)
    return snap


def snapshot_with_retry(roots: list[Path], max_depth: int = 5, attempts: int = 3, delay: float = 2.0) -> dict[str, float]:
    """product_snapshot z ponowieniami (start watchera: SMB bywa chwilowo niedostepne)."""
    last: OSError | None = None
    for _ in range(max(1, attempts)):
        try:
            return product_snapshot(roots, max_depth=max_depth)
        except OSError as exc:
            last = exc
            time.sleep(delay)
    assert last is not None
    raise last


def diff_snapshots(old: dict[str, float], new: dict[str, float]) -> list[str]:
    """Foldery produktow, ktorych mtime sie zmienil, ktore doszly albo zniknely (posortowane)."""
    return sorted(k for k in set(old) | set(new) if old.get(k) != new.get(k))


class ChangeTracker:
    """Debounce: zmiana jest 'gotowa' dopiero po `debounce_sec` ciszy (rename daje kilka skokow mtime
    w ciagu sekund; duze kopiowanie - dlugi ciag). Baza = snapshot z chwili WYKRYCIA (przed buildem),
    wiec zmiany z czasu buildu nie gina (stary kod bral mtime PO buildzie)."""

    def __init__(self, baseline: dict[str, float], debounce_sec: float = DEBOUNCE_DEFAULT_SEC) -> None:
        self.baseline = dict(baseline)
        self.debounce = float(debounce_sec)
        self._pending: dict[str, float] | None = None
        self._quiet_since = 0.0

    @property
    def pending(self) -> bool:
        return self._pending is not None

    def observe(self, snapshot: dict[str, float], now: float) -> list[str] | None:
        if snapshot == self.baseline:
            self._pending = None
            return None
        if self._pending is None or snapshot != self._pending:
            self._pending = dict(snapshot)
            self._quiet_since = now
        if now - self._quiet_since >= self.debounce:
            return diff_snapshots(self.baseline, snapshot)
        return None

    def mark_built(self, snapshot: dict[str, float]) -> None:
        self.baseline = dict(snapshot)
        self._pending = None


def plan_rebuild(changed: list[str], max_incremental: int = INCREMENTAL_MAX_DEFAULT) -> str:
    """'incremental' dla 1..max_incremental zmienionych produktow, inaczej 'full'
    (0 = przyrost wylaczony). Wiele naraz = np. kopiowanie calej kategorii; pelny skan jest wtedy
    tanszy niz dziesiatki osobnych skanow produktow + scalanie."""
    if max_incremental > 0 and 0 < len(changed) <= max_incremental:
        return "incremental"
    return "full"


def build_command(
    py: str,
    root_args: list[str] | None,
    out_dir: Path | None,
    only_products: list[str] | None = None,
    merge_into: Path | None = None,
) -> list[str]:
    cmd = [py, "-u", str(BUILD)]
    for r in root_args or []:
        cmd.extend(["--root", r])
    if out_dir is not None:
        cmd.extend(["--out-dir", str(out_dir)])
    for p in only_products or []:
        cmd.extend(["--only-product", str(p)])
    if merge_into is not None:
        cmd.extend(["--merge-into", str(merge_into)])
    return cmd


def _read_status(path: Path) -> dict:
    """Read the status JSON without ever raising.

    ValueError covers JSONDecodeError and UnicodeDecodeError (Synology Drive copy
    with byte 0x81 killed the watcher once). A file that stays unreadable after one
    retry is moved to <name>.corrupt so the loop continues from an empty dict.
    Separate process from index_supervisor, hence a local copy of the helper.
    """
    for attempt in (0, 1):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except OSError:
            return {}
        except ValueError:
            if attempt == 0:
                time.sleep(0.05)
                continue
            try:
                os.replace(path, path.with_name(path.name + ".corrupt"))
                print(f"[watch] corrupt status moved to {path.name}.corrupt")
            except OSError:
                pass
            return {}
        return data if isinstance(data, dict) else {}
    return {}


_LOCAL_STATUS_LOCK = threading.RLock()
_LOCAL_TMP_SEQ = itertools.count()


def _status_lock():
    """Ta sama blokada co index_supervisor.write_watcher_status: w tym procesie plik statusu pisza
    dwa watki (petla glowna + "dam-index-live"). 05.10.2026 (W11): wspolna nazwa "<plik>.<pid>.tmp"
    dawala poprawny JSON z ogonem starszej wersji (index-watcher-status.json.corrupt)."""
    try:
        import index_supervisor

        return index_supervisor.STATUS_WRITE_LOCK
    except Exception:  # noqa: BLE001
        return _LOCAL_STATUS_LOCK


def _write_status(path: Path, payload: dict, *, preserve_last: bool = True) -> None:
    with _status_lock():
        _write_status_locked(path, payload, preserve_last=preserve_last)


def _write_status_locked(path: Path, payload: dict, *, preserve_last: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = dict(payload)
    if preserve_last and path.is_file():
        prev = _read_status(path)
        if isinstance(prev, dict):
            for key in (
                "last_ok",
                "last_rc",
                "last_error",
                "last_started",
                "last_finished",
                "last_duration_sec",
                "last_incremental_sec",
                "last_incremental_products",
            ):
                if key not in body and prev.get(key) is not None:
                    body[key] = prev.get(key)
    if body.get("last_ok") is None:
        body["awaiting_first_rebuild"] = True
    elif body.get("last_ok") is True:
        body["awaiting_first_rebuild"] = False
    body["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    tmp = path.with_name(f"{path.name}.{os.getpid()}.{threading.get_ident()}.{next(_LOCAL_TMP_SEQ)}.tmp")
    try:
        tmp.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except OSError:
        return
    _replace_with_retry(tmp, path)


def spawn_branding_pipeline(*, status_file: Path | None = None) -> None:
    """Fire-and-forget branding fat+grid (same lock as POST /branding/rebuild)."""
    # 29.09.2026: trzecia sierota rebuild-branding-pipeline.py po przebiegu testow -
    # testy importuja ten modul. Pod unittest prawdziwej przebudowy nie odpalamy
    # (ten sam bezpiecznik co index_supervisor._real_spawn_blocked_in_tests).
    if "unittest" in sys.modules and os.environ.get("DAM_ALLOW_REAL_SPAWN_IN_TESTS", "").strip() != "1":
        print("[watch] branding hook skip: test_spawn_blocked")
        return
    if not BRANDING_PIPELINE.is_file():
        print(f"[watch] branding hook skip: missing {BRANDING_PIPELINE}")
        return
    try:
        py = _script_python()
        try:
            from branding_publish import resolve_script_python

            py = resolve_script_python(require_ijson=True)
        except RuntimeError as exc:
            print(f"[watch] branding hook FAIL ijson: {exc}")
            if status_file is not None:
                _write_status(
                    status_file,
                    {
                        "ok": False,
                        "watcher_ok": True,
                        "branding_hook_error": str(exc),
                        "stage": "branding_hook_failed",
                    },
                )
            return
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        proc = subprocess.Popen(
            [py, str(BRANDING_PIPELINE)],
            cwd=str(BIN_ROOT),
            creationflags=flags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print(f"[watch] branding hook spawned pid={proc.pid} via {py}")
        if status_file is not None:
            _write_status(
                status_file,
                {
                    "ok": True,
                    "watcher_ok": True,
                    "branding_hook_pid": proc.pid,
                    "branding_hook_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "stage": "branding_hook_spawned",
                },
            )

        def _wait_and_mark(p: subprocess.Popen) -> None:
            # rebuild-branding-pipeline.py zwraca 0 TYLKO gdy fat (build-branding-index.py,
            # ktory pisze branding-search-index.json bezwarunkowo - patrz jego glowny
            # zapis) I grid (build-branding-grid-index.py) obie sie udaly - kazdy
            # blad czesciowy propaguje sie jako rc != 0 (sprawdzone w tym skrypcie).
            try:
                rc = p.wait(timeout=1800)
            except Exception as exc:  # noqa: BLE001
                print(f"[watch] branding hook wait error: {exc}")
                return
            if rc == 0:
                _mark_built_here_safe("branding-search-index", WEB_DATA / "branding-search-index.json")
                # Ten sam fat build pisze campaigns.json - bez znacznika plik nigdy nie
                # trafialby do bazy (refused_not_built_here). Jak w local_bridge 28.09.
                _mark_built_here_safe("campaigns", WEB_DATA / "campaigns.json")
            else:
                print(f"[watch] branding hook finished rc={rc} - nie oznaczam built_here")

        threading.Thread(target=_wait_and_mark, args=(proc,), daemon=True,
                          name="dam-branding-hook-wait").start()
    except Exception as exc:  # noqa: BLE001
        print(f"[watch] branding hook spawn error: {exc}")


def _publish_cache_after_index() -> None:
    try:
        import dam_thumb_cache

        dam_thumb_cache.start_publish_after_index()
        print("[watch] cache publish queued")
    except Exception as exc:  # noqa: BLE001
        print(f"[watch] cache publish skip: {exc}")


def rebuild_with_lock(
    *,
    lock_file: Path,
    status_file: Path,
    root_args: list[str] | None = None,
    out_dir: Path | None = None,
    stage_prefix: str = "product",
    branding_hook: bool = True,
    last_duration_sec: float | None = None,
    only_products: list[str] | None = None,
) -> int:
    """Acquire shared lock, then run build-file-index. No scan before lock.

    only_products: tryb przyrostowy (--only-product ... --merge-into file-index.json) - jedna
    blokada, jeden build; czas przyrostu NIE nadpisuje last_duration_sec pelnego skanu."""
    try:
        from rebuild_lock import acquire_lock
    except ImportError:
        acquire_lock = None  # type: ignore
    try:
        import index_supervisor as idx_sup
    except ImportError:
        idx_sup = None  # type: ignore

    if idx_sup is not None:
        try:
            idx_sup.begin_run_snapshot()
        except Exception:
            pass
    handle = None
    if acquire_lock is not None:
        handle, meta = acquire_lock(
            lock_file,
            stage=f"{stage_prefix}:starting",
            ttl_sec=3600,
            extra={"owner": "watch-file-index"},
        )
        if handle is None:
            _write_status(
                status_file,
                {
                    "ok": False,
                    "watcher_ok": True,
                    "last_skip": "lock_held",
                    "lock": meta.get("lock"),
                    "stage": "skipped_lock_held",
                },
            )
            print("[watch] skip rebuild: lock held")
            return 2
    else:
        lock_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(str(lock_file), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, b'{"pid":%d}' % os.getpid())
            os.close(fd)
        except FileExistsError:
            print("[watch] skip rebuild: lock held (fallback)")
            return 2

    py = _script_python()
    incremental = bool(only_products)
    merge_into = ((out_dir / "file-index.json") if out_dir is not None else (WEB_DATA / "file-index.json")) if incremental else None
    cmd = build_command(py, root_args, out_dir, only_products=only_products, merge_into=merge_into)

    started_ts = time.time()
    started_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    kind = "hourly" if stage_prefix == "hourly" else ("watch" if stage_prefix == "product" else stage_prefix)
    if incremental:
        kind = "incremental"
        # Orientacyjny czas: ~10 s stalych (wczytanie/zapis indeksu, wzbogacanie) + ~12 s na produkt.
        # NIE bierzemy last_duration_sec pelnego skanu (54 min), bo pasek stalby na 1%.
        last_duration_sec_eta = 10 + 12 * len(only_products or [])
    else:
        last_duration_sec_eta = last_duration_sec
    msg_building = (
        "Indeksowanie ROOT" if stage_prefix == "hourly"
        else (f"Indeksowanie zmienionych produktow ({len(only_products or [])})" if incremental else "Indeksowanie")
    )
    dur_fields = {} if incremental else {"last_duration_sec": last_duration_sec}

    def _tick() -> None:
        elapsed = int(time.time() - started_ts)
        eta = None
        remaining = None
        if last_duration_sec_eta:
            remaining = max(0, int(float(last_duration_sec_eta) - elapsed))
            eta = remaining
        pct = None
        if last_duration_sec_eta:
            try:
                pct = max(1, min(99, int(100.0 * elapsed / float(last_duration_sec_eta))))
            except (TypeError, ValueError, ZeroDivisionError):
                pct = None
        _write_status(
            status_file,
            {
                "ok": True,
                "watcher_ok": True,
                "stage": f"{stage_prefix}:building",
                "rebuild_kind": kind,
                "kind": kind,
                "last_started": started_iso,
                "elapsed_sec": elapsed,
                "eta_sec": eta,
                "remaining_sec": remaining,
                "progress_pct": pct,
                **dur_fields,
                "progress_message": msg_building,
                "hourly_pending": False,
                "current_item": (idx_sup.read_live() if idx_sup is not None else {}).get("current_item") or "",
                "current_name": (idx_sup.read_live() if idx_sup is not None else {}).get("current_name") or "",
                "current_path": (idx_sup.read_live() if idx_sup is not None else {}).get("current_path") or "",
                "current_label": (idx_sup.read_live() if idx_sup is not None else {}).get("current_label") or "",
                "products_done": (idx_sup.read_live() if idx_sup is not None else {}).get("products_done"),
                "products_total": (idx_sup.read_live() if idx_sup is not None else {}).get("products_total"),
            },
        )

    _write_status(
        status_file,
        {
            "ok": True,
            "watcher_ok": True,
            "stage": f"{stage_prefix}:building",
            "rebuild_kind": kind,
            "kind": kind,
            "last_started": started_iso,
            "elapsed_sec": 0,
            "eta_sec": int(last_duration_sec_eta) if last_duration_sec_eta else None,
            "remaining_sec": int(last_duration_sec_eta) if last_duration_sec_eta else None,
            **dur_fields,
            "progress_message": msg_building,
            "hourly_pending": False,
        },
    )
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(BIN_ROOT),
            creationflags=flags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env=_builder_env(),
        )
    except Exception as exc:  # noqa: BLE001
        _write_status(
            status_file,
            {
                "ok": False,
                "watcher_ok": True,
                "last_ok": False,
                "last_rc": None,
                "last_error": str(exc),
                "stage": f"{stage_prefix}:error",
            },
        )
        if handle is not None:
            handle.release()
        return 1

    if handle is not None:
        try:
            handle.update(stage=f"{stage_prefix}:building", child_pid=proc.pid)
        except Exception:
            pass

    snap = {}
    try:
        if idx_sup is not None:
            snap = idx_sup.read_run_snapshot()
    except Exception:
        snap = {}

    def _read_builder_stdout() -> None:
        if proc.stdout is None:
            return
        for line in proc.stdout:
            try:
                print(line, end="" if str(line).endswith("\n") else "\n")
            except Exception:
                pass
            if idx_sup is None:
                continue
            try:
                parsed = idx_sup.parse_builder_live_line(line)
            except Exception:
                parsed = None
            if parsed:
                try:
                    idx_sup.merge_live_into_watcher_status(parsed, snap=snap)
                except Exception:
                    pass

    threading.Thread(target=_read_builder_stdout, daemon=True, name="dam-index-live").start()

    if idx_sup is not None:
        rc = idx_sup.wait_rebuild_proc(proc, lock_handle=handle, on_tick=_tick)
    else:
        rc = int(proc.wait())

    duration = int(time.time() - started_ts)
    cancelled = rc == 130
    needs_full = incremental and rc == NEEDS_FULL_RC
    if needs_full:
        # Nie jest to porazka: wolajacy (rebuild_changed) zaraz zrobi pelny skan. Bez last_ok=False,
        # zeby pulpit nie mrugnal "aktualizacja nie dziala" miedzy przyrostem a pelnym skanem.
        _write_status(
            status_file,
            {
                "ok": True,
                "watcher_ok": True,
                "stage": f"{stage_prefix}:fallback_full",
                "rebuild_kind": kind,
                "progress_message": "Przyrost niemozliwy - pelny skan",
            },
        )
    else:
        done_fields = (
            {"last_incremental_sec": duration, "last_incremental_products": len(only_products or [])}
            if incremental
            else {"last_duration_sec": duration if rc == 0 else last_duration_sec}
        )
        _write_status(
            status_file,
            {
                "ok": rc == 0,
                "watcher_ok": True,
                "last_ok": rc == 0,
                "last_rc": rc,
                "last_error": "cancelled" if cancelled else ("" if rc == 0 else f"build_rc_{rc}"),
                "last_finished": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                **done_fields,
                "elapsed_sec": duration,
                "eta_sec": 0,
                "remaining_sec": 0,
                "stage": "cancelled" if cancelled else (f"{stage_prefix}:idle" if rc == 0 else f"{stage_prefix}:error"),
                "rebuild_kind": kind,
            },
        )
    if rc == 0 and not incremental and out_dir is None:
        _mark_full_scan_done(status_file)
    if handle is not None:
        handle.release()
    if idx_sup is not None and not needs_full:
        try:
            idx_sup.complete_run_report(ok=(rc == 0), cancelled=cancelled, rc=rc)
        except Exception:
            pass
    if rc == 0 and out_dir is None:
        # Build odrzucony przez bezpiecznik (rejected.json) konczy sie rc != 0 -
        # NIE jest oznaczany. out_dir!=None = fixture/test, nie prawdziwy build
        # w apps/web/data - nie oznaczamy cudzej/testowej sciezki jako "built_here"
        # dla globalnego klucza produkcyjnego.
        _mark_built_here_safe("file-index", WEB_DATA / "file-index.json")
        _mark_built_here_safe("search-index", WEB_DATA / "search-index.json")
    # 29.09.2026: build do --out-dir (fixture/test) NIE rusza zywego stanu: przebudowa
    # Brandingu nie zna --out-dir (skanowala prawdziwy ROOT i pisala do apps/web/data),
    # publikacja miniatur tez dotyczy zywego cache. Tak test "fixture keeps live hashes"
    # zostawial sierote rebuild-branding-pipeline.py.
    if rc == 0 and branding_hook and out_dir is None:
        spawn_branding_pipeline(status_file=status_file)
    if rc == 0 and out_dir is None:
        _publish_cache_after_index()
    return int(rc)


def rebuild_changed(
    changed: list[str],
    *,
    lock_file: Path,
    status_file: Path,
    root_args: list[str] | None = None,
    out_dir: Path | None = None,
    branding_hook: bool = True,
    last_duration_sec: float | None = None,
    max_incremental: int = INCREMENTAL_MAX_DEFAULT,
) -> tuple[int, str]:
    """Przebuduj zmienione produkty: przyrostowo, a gdy to niemozliwe (kod 5) albo zmian za duzo - pelnym skanem.
    Zwraca (rc, 'incremental' | 'full'). rc 2 = blokada zajeta (nic nie wystartowalo)."""
    common = dict(
        lock_file=lock_file,
        status_file=status_file,
        root_args=root_args,
        out_dir=out_dir,
        branding_hook=branding_hook,
    )
    if plan_rebuild(changed, max_incremental) == "full":
        return rebuild_with_lock(**common, last_duration_sec=last_duration_sec), "full"
    rc = rebuild_with_lock(**common, last_duration_sec=last_duration_sec, only_products=list(changed))
    if rc == NEEDS_FULL_RC:
        print("[watch] przyrost niemozliwy (rc=5) - pelny skan ROOT")
        return rebuild_with_lock(**common, last_duration_sec=last_duration_sec), "full"
    return rc, "incremental"


def _last_full_file(status_file: Path) -> Path:
    return status_file.with_name("index-last-full.json")


def _mark_full_scan_done(status_file: Path) -> None:
    """Zapisz moment ostatniego udanego PELNEGO skanu (osobny plik: supervisor przepisuje status
    watchera bez znajomosci tego klucza). Po restarcie aplikacji przebieg awaryjny liczy sie od niego,
    a nie od startu - inaczej kazde uruchomienie programu = 30-54 min pelnego skanu po 20 s."""
    try:
        _last_full_file(status_file).write_text(json.dumps({"finished_epoch": time.time()}), encoding="utf-8")
    except OSError:
        pass


def read_last_full_epoch(status_file: Path, index_file: Path) -> float:
    """Epoka ostatniego pelnego skanu albo 0.0 (brak zapisu / brak indeksu = zrob pelny skan jak dotad)."""
    try:
        if not index_file.is_file() or index_file.stat().st_size < 1024:
            return 0.0
        data = json.loads(_last_full_file(status_file).read_text(encoding="utf-8"))
        return float(data.get("finished_epoch") or 0.0)
    except (OSError, ValueError, TypeError):
        return 0.0


def _baseline_file(status_file: Path) -> Path:
    return status_file.with_name("index-product-snapshot.json")


def _roots_key(roots: list[Path]) -> list[str]:
    return [str(r).replace("\\", "/").rstrip("/").casefold() for r in roots]


def save_baseline(status_file: Path, roots: list[Path], snapshot: dict[str, float]) -> None:
    """Zapisz snapshot, dla ktorego indeks jest aktualny. Po restarcie aplikacji roznica wzgledem niego =
    produkty zmienione, gdy watcher nie dzialal (przebudowa przyrostowa zamiast pelnego skanu na starcie)."""
    body = {"roots": _roots_key(roots), "saved_epoch": time.time(), "snapshot": snapshot}
    target = _baseline_file(status_file)
    tmp = target.with_name(target.name + f".{os.getpid()}.tmp")
    try:
        tmp.write_text(json.dumps(body, ensure_ascii=False), encoding="utf-8")
    except OSError:
        return
    _replace_with_retry(tmp, target)


def load_baseline(status_file: Path, roots: list[Path], index_file: Path) -> dict[str, float] | None:
    """Zapisany snapshot albo None (brak/uszkodzony/inne rooty/brak indeksu = zacznij od biezacego)."""
    try:
        if not index_file.is_file() or index_file.stat().st_size < 1024:
            return None
        data = json.loads(_baseline_file(status_file).read_text(encoding="utf-8"))
        if data.get("roots") != _roots_key(roots) or not isinstance(data.get("snapshot"), dict):
            return None
        return {str(k): float(v) for k, v in data["snapshot"].items()}
    except (OSError, ValueError, TypeError, AttributeError):
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=float, default=2.0, help="Sekundy miedzy checkami")
    ap.add_argument(
        "--depth",
        type=int,
        default=5,
        help="Glebokosc mtime (DK→kat→produkt→wariant→WIZKI→RGB); bylo 3 i nie siegalo WIZKI",
    )
    ap.add_argument("--once", action="store_true", help="Jeden rebuild i wyjscie")
    ap.add_argument("--no-initial", action="store_true", help="Nie rob initial rebuild przy starcie")
    ap.add_argument("--root", action="append", default=[], help="Fixture/test root (moze byc wielokrotnie)")
    ap.add_argument("--status-file", type=Path, default=DEFAULT_STATUS)
    ap.add_argument("--lock-file", type=Path, default=DEFAULT_LOCK)
    ap.add_argument(
        "--control-file",
        type=Path,
        default=STATE_DIR / "index-control.json",
        help="Cancel/snooze JSON (apps/desktop/data/index-control.json)",
    )
    ap.add_argument(
        "--hourly",
        type=float,
        default=float(os.environ.get("DAM_INDEX_HOURLY_SEC", str(int(HOURLY_DEFAULT_SEC))) or HOURLY_DEFAULT_SEC),
        help="Przebieg awaryjny: PELNY skan ROOT co N sekund od ostatniego pelnego skanu "
        "(0 = wylacz). Domyslnie 21600 (6 h); zwykle zmiany obsluguje tryb przyrostowy.",
    )
    ap.add_argument(
        "--debounce",
        type=float,
        default=float(os.environ.get("DAM_INDEX_DEBOUNCE_SEC", str(DEBOUNCE_DEFAULT_SEC)) or DEBOUNCE_DEFAULT_SEC),
        help="Sekundy ciszy po ostatniej zmianie mtime, zanim ruszy przebudowa (rename = kilka skokow).",
    )
    ap.add_argument(
        "--incremental-max",
        type=int,
        default=INCREMENTAL_MAX_DEFAULT,
        help="Maks. liczba zmienionych produktow obslugiwana przyrostowo; wiecej = pelny skan. 0 = bez przyrostu.",
    )
    ap.add_argument(
        "--first-delay",
        type=float,
        default=float(os.environ.get("DAM_INDEX_FIRST_DELAY_SEC", "20") or "20"),
        help="Opoznienie pierwszego pelnego skanu (user moze kliknac Nie dzisiaj).",
    )
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Przekaz do build-file-index --out-dir (OBOWIAZKOWE przy --root fixture)",
    )
    ap.add_argument(
        "--no-incremental",
        action="store_true",
        help="Awaryjnie: kazda zmiana produktu = pelny skan ROOT (zachowanie sprzed 06.10.2026)",
    )
    ap.add_argument(
        "--no-branding-hook",
        action="store_true",
        help="Nie odpalaj rebuild-branding-pipeline po file-index",
    )
    args = ap.parse_args()

    if args.root and not args.out_dir:
        raise SystemExit(
            "HARD: --root (fixture) wymaga --out-dir, aby nie nadpisac live file-index.json"
        )

    _write_status(
        args.status_file,
        {
            "ok": True,
            "watcher_ok": True,
            "stage": "starting",
            "pid": os.getpid(),
        },
    )

    try:
        import marketing_roots  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        _write_status(
            args.status_file,
            {
                "ok": False,
                "watcher_ok": False,
                "last_ok": False,
                "last_error": f"import_marketing_roots:{exc}",
                "stage": "import_failed",
            },
        )
        raise SystemExit(f"Brak marketing_roots: {exc}")

    branding_hook = not args.no_branding_hook and not args.out_dir
    branding_roots: list[Path] = []

    if args.root:
        roots = [Path(r) for r in args.root]
        roots = [r for r in roots if r.is_dir()]
        base = roots[0] if roots else Path(".")
        root_args = [str(r) for r in roots]
        product_roots = roots
    else:
        base = resolve_marketing_base()
        product_roots = watch_product_roots(base)
        branding_roots = watch_branding_roots(base)
        root_args = None

    if not product_roots and not args.root:
        _write_status(
            args.status_file,
            {
                "ok": False,
                "watcher_ok": False,
                "last_ok": False,
                "last_error": f"no_roots_under:{base}",
                "stage": "no_roots",
            },
        )
        raise SystemExit(f"Brak rootow produktow pod {base}")

    depth = max(1, int(args.depth))
    print(
        f"[watch] base={base} product_roots={len(product_roots)} "
        f"branding_roots={len(branding_roots)} interval={args.interval}s depth={depth}"
    )
    for r in product_roots:
        print(f"[watch]   product {r}")
    for r in branding_roots:
        print(f"[watch]   branding {r}")

    if args.once:
        raise SystemExit(
            rebuild_with_lock(
                lock_file=args.lock_file,
                status_file=args.status_file,
                root_args=root_args,
                out_dir=args.out_dir,
                branding_hook=branding_hook,
            )
        )

    # Przebieg awaryjny liczymy od ostatniego PELNEGO skanu sprzed restartu: bez tego kazdy start
    # programu = pelny skan 20 s po starcie, mimo swiezego indeksu.
    index_file = (args.out_dir / "file-index.json") if args.out_dir else (WEB_DATA / "file-index.json")
    seed_last_full = read_last_full_epoch(args.status_file, index_file) if args.no_initial else 0.0
    # Baza zmian = snapshot PRZED buildem: to, co zmieni sie w trakcie (30+ min pelnego skanu), wyjdzie
    # jako roznica po nim i zostanie przebudowane przyrostowo.
    saved_baseline = (
        load_baseline(args.status_file, product_roots, index_file) if (args.no_initial and product_roots) else None
    )
    try:
        start_snap = (
            saved_baseline
            if saved_baseline is not None
            else (snapshot_with_retry(product_roots, max_depth=depth) if product_roots else {})
        )
    except OSError as exc:
        _write_status(
            args.status_file,
            {"ok": False, "watcher_ok": False, "last_error": f"snapshot_failed:{exc}", "stage": "snapshot_failed"},
        )
        raise SystemExit(f"Nie moge wylistowac rootow produktow: {exc}")
    tracker = ChangeTracker(start_snap, args.debounce)
    if saved_baseline is not None:
        print(f"[watch] baza zmian z poprzedniej sesji: {len(saved_baseline)} produktow (zmiany z czasu przerwy -> przyrost)")
    last_branding = roots_mtime(branding_roots, max_depth=depth) if branding_roots else 0.0
    if not args.no_initial:
        print("[watch] initial rebuild...")
        rc = rebuild_with_lock(
            lock_file=args.lock_file,
            status_file=args.status_file,
            root_args=root_args,
            out_dir=args.out_dir,
            branding_hook=branding_hook,
        )
        if rc == 0:
            last_branding = (
                roots_mtime(branding_roots, max_depth=depth) if branding_roots else last_branding
            )
            if product_roots:
                save_baseline(args.status_file, product_roots, tracker.baseline)
            print("[watch] initial OK")
        else:
            print(f"[watch] initial rebuild failed rc={rc} - dalej monitoruje")
    else:
        print("[watch] --no-initial: monitor only")
        _write_status(
            args.status_file,
            {
                "ok": True,
                "watcher_ok": True,
                "stage": "monitoring",
                "pid": os.getpid(),
                "hourly_sec": float(args.hourly),
                "first_delay_sec": float(args.first_delay),
                "control_file": str(args.control_file),
                "hourly_pending": seed_last_full <= 0,
            },
        )

    try:
        import index_supervisor as idx_sup
    except ImportError:
        idx_sup = None  # type: ignore

    loop_started = time.time()
    retry_after = 0.0
    last_hourly = seed_last_full
    if last_hourly > 0:
        print(
            f"[watch] ostatni pelny skan {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(last_hourly))} "
            f"- nastepny przebieg awaryjny po {float(args.hourly) / 3600.0:.1f} h od niego"
        )
    last_duration = None
    try:
        prev = _read_status(args.status_file)
        if prev.get("last_duration_sec"):
            last_duration = float(prev.get("last_duration_sec"))
    except (TypeError, ValueError):
        last_duration = None

    while True:
        time.sleep(max(1.0, float(args.interval)))
        snoozed = False
        if idx_sup is not None:
            try:
                snoozed = bool(idx_sup.is_snoozed())
            except Exception:
                snoozed = False
        hourly_sec = float(args.hourly or 0)
        due_hourly = False
        if hourly_sec > 0 and not snoozed:
            now = time.time()
            if last_hourly <= 0:
                due_hourly = (now - loop_started) >= max(0.0, float(args.first_delay))
            else:
                due_hourly = (now - last_hourly) >= hourly_sec and (now - loop_started) >= max(
                    0.0, float(args.first_delay)
                )
        if due_hourly:
            print("[watch] hourly full ROOT scan...")
            _write_status(
                args.status_file,
                {
                    "ok": True,
                    "watcher_ok": True,
                    "stage": "hourly:queued",
                    "rebuild_kind": "hourly",
                    "kind": "hourly",
                    "pid": os.getpid(),
                },
            )
            try:
                pre_snap = product_snapshot(product_roots, max_depth=depth) if product_roots else {}
            except OSError as exc:
                print(f"[watch] snapshot przed pelnym skanem nieudany ({exc}) - baza z konca skanu")
                pre_snap = None
            rc = rebuild_with_lock(
                lock_file=args.lock_file,
                status_file=args.status_file,
                root_args=root_args,
                out_dir=args.out_dir,
                stage_prefix="hourly",
                branding_hook=branding_hook,
                last_duration_sec=last_duration,
            )
            # rc==2 (blokada zajeta, np. reczny /index/rebuild z mostu = tez pelny skan) liczy sie jak
            # wykonany przebieg: nie powtarzamy go co 2 s, nastepny za --hourly.
            last_hourly = time.time()
            if rc == 0:
                try:
                    st = _read_status(args.status_file)
                    if st.get("last_duration_sec"):
                        last_duration = float(st.get("last_duration_sec"))
                except (TypeError, ValueError):
                    pass
                if pre_snap is None and product_roots:
                    try:
                        pre_snap = product_snapshot(product_roots, max_depth=depth)
                    except OSError:
                        pre_snap = None
                if pre_snap is not None:
                    tracker.mark_built(pre_snap)
                    if product_roots:
                        save_baseline(args.status_file, product_roots, pre_snap)
                last_branding = (
                    roots_mtime(branding_roots, max_depth=depth) if branding_roots else last_branding
                )
                print("[watch] hourly OK")
            elif rc == 130:
                print("[watch] hourly cancelled")
            else:
                print(f"[watch] hourly failed rc={rc}")
            continue
        if snoozed:
            _write_status(
                args.status_file,
                {
                    "ok": True,
                    "watcher_ok": True,
                    "stage": "snoozed",
                    "pid": os.getpid(),
                    "snoozed": True,
                },
            )
            continue
        try:
            cur_snap = product_snapshot(product_roots, max_depth=depth) if product_roots else {}
            cur_branding = roots_mtime(branding_roots, max_depth=depth) if branding_roots else 0.0
        except OSError as e:
            print(f"[watch] skip: {e}")
            continue
        now = time.time()
        changed = tracker.observe(cur_snap, now) if product_roots else None
        branding_changed = bool(branding_roots) and cur_branding > last_branding
        if changed is not None and now >= retry_after:
            shown = ", ".join(Path(c).name for c in changed[:3]) + (" ..." if len(changed) > 3 else "")
            print(f"[watch] product change: {len(changed)} folder(s) [{shown}]; rebuild...")
            rc, rb_kind = rebuild_changed(
                changed,
                lock_file=args.lock_file,
                status_file=args.status_file,
                root_args=root_args,
                out_dir=args.out_dir,
                branding_hook=branding_hook,
                last_duration_sec=last_duration,
                max_incremental=0 if args.no_incremental else args.incremental_max,
            )
            if rc == 0:
                tracker.mark_built(cur_snap)
                save_baseline(args.status_file, product_roots, cur_snap)
                last_branding = cur_branding
                print(f"[watch] rebuild OK ({rb_kind})")
            else:
                # blokada zajeta (2): ponow za chwile; blad buildu: nie mielimy w petli co 2 s
                retry_after = time.time() + (10.0 if rc == 2 else 60.0)
                print(f"[watch] rebuild failed rc={rc} ({rb_kind}); ponowie po {retry_after - time.time():.0f} s")
        elif branding_changed and not tracker.pending:
            print(
                f"[watch] branding change {last_branding:.0f} -> {cur_branding:.0f}; "
                "branding pipeline only..."
            )
            if branding_hook:
                spawn_branding_pipeline(status_file=args.status_file)
            last_branding = cur_branding


if __name__ == "__main__":
    main()
