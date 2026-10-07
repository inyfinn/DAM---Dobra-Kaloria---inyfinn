# -*- coding: utf-8 -*-
"""Lista materialow z indeksu w BAZIE, nie ze stanu plikow na dysku tego komputera.

22.09.2026 (uzytkownik): "stare brandingowe materialy zamiast nowych. Tak jakby to, co
jest pokazywane, NIE bylo zalezne od bazy danych i indeksu w bazie, tylko od stanu
plikow na ROOT." Tak bylo: branding-search-index.json i file-index.json pochodzily ze
skanu na komputerze, ktory zbudowal instalator (u uzytkownika: skan z 14.09).

Model:
  * komputer Z folderem Marketing po przebudowie skanu publikuje go do bazy
    (tabela dam_index_snapshots, gzip, ~5 MB na trzy pliki);
  * kazdy inny komputer co 30 s sprawdza generacje (bez pobierania tresci; ADR-012
    pkt 4, dawniej co 10 min) i sciaga tylko nowsza; plik lokalny zostaje kopia na
    czas, gdy bazy nie ma;
  * tresc sciagnieta z bazy nigdy nie jest odsylana z powrotem (pulled_sha).

Zadna funkcja nie rzuca wyjatkiem na zewnatrz.
"""
from __future__ import annotations

import contextlib
import hashlib
import json
import os
import re
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import platform_compat

# klucz w bazie -> nazwa pliku w web/data
# Kolejnosc ma znaczenie: pull_newer idzie po tym slowniku po kolei. Chcemy
# najpierw sciagnac branding-index.json (surowe dane brandingu/wizualizacji),
# potem branding-search-index.json - to on wyzwala w local_bridge przebudowe
# siatki (_schedule_slim_grid_publish), a siatka czyta z branding-index.
# Gdyby search-index przyszedl pierwszy, siatka zbudowalaby sie ze starego
# branding-index i trzeba by czekac na kolejny cykl (10 min).
SNAPSHOT_FILES = {
    "file-index": "file-index.json",
    "branding-index": "branding-index.json",
    "branding-search-index": "branding-search-index.json",
    # Faza 3, zadanie 3.6 (27.09.2026): dopisane po ustaleniu, ze OBA sa w calosci
    # generowane przez build (zero recznej edycji w aplikacji - sprawdzone grepem
    # po local_bridge.py: campaigns.json nie ma POST route, tylko wpis w cache
    # invalidation po rebuildzie brandingu; search-index.json pisze WYLACZNIE
    # build-file-index.py, w tym samym biegu co file-index.json). Bez tego oba
    # zostawaly zamrozone na stanie maszyny budujacej instalator na zawsze
    # (DAM-Setup.iss onlyifdoesntexist, brak innego mechanizmu odswiezania).
    "search-index": "search-index.json",
    "campaigns": "campaigns.json",
}
MIN_BYTES = 1024
# Pelny cykl (pull_newer + publish_changed) co najmniej raz na REFRESH_S; miedzy nimi
# ADR-012 pkt 4: co LIGHT_CHECK_S tani odczyt generacji (index_snapshot_meta, bez
# payload) - pelny cykl od razu, gdy w bazie jest nowa generacja.
REFRESH_S = 600.0
LIGHT_CHECK_S = 30.0
# W8 28.09.2026 (W7 znalezisko 5, S8): swiezy LOKALNY build (mark_built_here albo nowy
# plik migawki na dysku) -> pelny cykl po krotkim debounce, nie po 600 s. Podpis to
# tylko plik stanu (built_here_sha) i stat() kilku lokalnych plikow w web/data.
LOCAL_CHECK_S = 2.0
LOCAL_DEBOUNCE_S = 2.0
# Przedrostek komunikatu bramki w bazie (bin/apps/desktop/sql/authority_gate.sql).
NOT_AUTHORITY_MARK = "dam_not_authority:"
# Publikacja odmawia pliku mniejszego niz 80% wersji w bazie (niepelny skan; 23.09
# branding-index spadl z 265 do 151 MB = 57% - prog 50% by go przepuscil).
SHRINK_GUARD = 0.8
# Powyzej tego rozmiaru nie robimy pelnego json.loads() na calej tresci -
# branding-index.json na zlotej maszynie ma ~362 MB, a json.loads kopii w
# pamieci (bytes -> str -> drzewo obiektow) to kilka GB RAM. Zamiast tego
# sprawdzamy tanio, czy plik "wyglada" na kompletny JSON (patrz
# _looks_complete_json nizej).
FULL_PARSE_MAX_BYTES = 50 * 1024 * 1024
# 07.10.2026 (audyt publikacji, Z1): wlasciciel nie cofa pobraniem z bazy pliku, ktory
# zmienil sie lokalnie i czeka na znacznik mark_built_here (dopisuje go INNY proces,
# sekundy do minut po zapisie pliku). Dluzej niz tyle nie czekamy - wraca wersja z bazy.
PENDING_BUILD_HOLD_S = 1800.0
# Log cykli (most pod pythonw gubi stdout): jeden plik + jedna kopia .1.
LOG_MAX_BYTES = 1_000_000
# 07.10.2026 (instalator nie pakuje spisu - katalog zawsze z bazy): do PIERWSZEGO udanego pobrania
# ponawiamy co FIRST_SYNC_RETRY_S przez FIRST_SYNC_FAST_FOR_S, potem odstep rosnie (0,5 s na sekunde)
# do FIRST_SYNC_RETRY_MAX_S; po pierwszym sukcesie obowiazuje zwykly rytm (LIGHT_CHECK_S / REFRESH_S).
# Ponowienie to samo pobranie (pull_newer), bez publikacji i bez nakladania sie na trwajacy cykl.
FIRST_SYNC_RETRY_S = 5.0
FIRST_SYNC_FAST_FOR_S = 60.0
FIRST_SYNC_RETRY_MAX_S = 30.0
FIRST_SYNC_TICK_S = 1.0
# Limit POLACZENIA w probach pierwszego pobrania (pg_db: 5 s do pierwszego sukcesu, potem 1 s - po
# sukcesie meta kazde kolejne polaczenie w tym samym cyklu, w tym pobranie 5,6 MB, ma 1 s, a libpq
# i tak podnosi wartosci < 2 s do 2 s). Pomiar 07.10 z tego komputera (siec firmowa): polaczenie
# 75-163 ms, DNS 1 ms z cache, zimny start Windows i lacze domowe do zmierzenia osobno. 15 s =
# ponad 90x mediany: wolne lacze nie moze dawac porazki, a koszt to tylko dluzsze trwanie JEDNEJ
# nieudanej proby w watku migawek (UI i logowanie zostaja przy 5 s).
FIRST_SYNC_CONNECT_TIMEOUT_S = 15.0
# Opoznienie pierwszego cyklu po starcie mostu ("najpierw UI, potem siec"). Swiezy komputer bez plikow
# spisu nie ma co pokazywac, wiec pierwsze pobranie rusza szybko; gdy pliki sa, bez zmian.
START_DELAY_S = 8.0
START_DELAY_FRESH_S = 2.0

# Faza 2 (bin/docs/PLAN-jedno-zrodlo-prawdy.md): gdy asset_sync_runner.py ma
# wlaczony tryb "rows" (dam_meta.asset_index_mode = "rows"), branding-index.json
# jest budowany przez scalanie (dam_assets), nie przez snapshoty - publikacja i
# pobieranie TEGO jednego klucza przez ten modul musza sie wtedy wylaczyc, zeby
# swiezy wynik scalania nie zostal nadpisany starszym snapshotem (albo odwrotnie).
ROWS_MODE_SKIP_KEY = "branding-index"
_ROWS_MODE_CACHE_TTL_S = 600.0  # tania funkcja: co najwyzej raz na 10 min pyta baze
_ROWS_MODE_CACHE: dict[str, Any] = {"value": False, "at": 0.0}

_LOCK = threading.Lock()
_LOCK_CATALOG = threading.Lock()
_THREAD: threading.Thread | None = None
_LAST: dict[str, Any] = {}
# Faza 3 (PLAN-jedno-zrodlo-prawdy.md, zadanie 3.4): stan pierwszej synchronizacji
# po starcie procesu, do wystawienia w /health / banerze UI "pobieram dane".
_FIRST_SYNC: dict[str, Any] = {"done": False, "ok": None, "started_at": "", "finished_at": "",
                               "attempts": 0, "last_error": "", "next_retry_at": ""}
# ETAP 0 (07.10.2026): znacznik katalogu = to, co ekran pokazuje jako "wersja katalogu". Cztery pliki, ktore
# razem sa spisem: lista produktow, jej wyszukiwarka, wyszukiwarka materialow, kampanie. Kolejnosc stala.
# branding-index (surowe wiersze, setki MB) NIE wchodzi: jego stan ma w etapie 3 wlasny numer.
CATALOG_KEYS = ("file-index", "search-index", "branding-search-index", "campaigns")
_DATA_DIR: Path | None = None  # katalog plikow migawek zapamietany przy starcie (catalog_info() bez argumentu)
_CATALOG_CACHE: dict[str, str] = {"catalog_id": "", "catalog_source": ""}  # dla /health: zero IO w zapytaniu


def is_not_authority_error(err: Any) -> bool:
    """Odmowa bramki ADR-012 (wyzwalacz w bazie), nie blad sieci/bazy."""
    return NOT_AUTHORITY_MARK in str(err or "")


def _pg_timeout_kwargs(fn: Callable[..., Any], timeout: float | None) -> dict[str, float]:
    """{"timeout": N}, gdy funkcja pg_db ma jawny parametr `timeout` (limit polaczenia), inaczej {}.
    Pierwsze pobranie dostaje dluzszy limit, a pg_db sprzed tej zmiany dziala jak dotad."""
    if not timeout:
        return {}
    try:
        import inspect

        return {"timeout": float(timeout)} if "timeout" in inspect.signature(fn).parameters else {}
    except (TypeError, ValueError):
        return {}


def _connector(pg_db: Any, timeout: float | None) -> Callable[[], Any]:
    kw = _pg_timeout_kwargs(pg_db.connect, timeout)
    return (lambda: pg_db.connect(**kw)) if kw else pg_db.connect


def generations_signature() -> tuple | None:
    """Tani odcisk stanu migawek w bazie: (klucz, generacja, sha256) bez payload.
    None = odczyt sie nie udal (siec) - wolajacy czeka na zwykly cykl REFRESH_S."""
    try:
        import pg_db

        metas = pg_db.index_snapshot_meta()
    except Exception:  # noqa: BLE001
        return None
    return tuple(sorted((str(k), str((m or {}).get("generation")), str((m or {}).get("sha256")))
                        for k, m in (metas or {}).items()))


def _asset_index_mode_is_rows(*, force: bool = False, connect_timeout: float | None = None) -> bool:
    """dam_meta.asset_index_mode == "rows"? Cache 10 min - nie pytamy bazy na kazdy plik.

    Blad polaczenia / brak tabeli = False (bezpieczny domyslny: snapshoty dzialaja
    dalej jak dzisiaj, dokladnie tak samo jak w asset_sync_runner._get_mode)."""
    now = time.monotonic()
    if not force and (now - float(_ROWS_MODE_CACHE.get("at") or 0.0)) < _ROWS_MODE_CACHE_TTL_S:
        return bool(_ROWS_MODE_CACHE.get("value"))
    value = False
    try:
        import pg_db

        pg = _connector(pg_db, connect_timeout)()
        try:
            cur = pg.cursor()
            cur.execute("SELECT value FROM dam_meta WHERE key = %s", ("asset_index_mode",))
            row = cur.fetchone()
            raw = None
            if row:
                raw = row.get("value") if hasattr(row, "get") else row[0]
            value = str(raw or "") == "rows"
        finally:
            pg.close()
    except Exception:  # noqa: BLE001 - offline / brak tabeli = tryb wylaczony (bezpieczny)
        value = False
    _ROWS_MODE_CACHE.update(value=value, at=now)
    return value


def _state_path() -> Path:
    return platform_compat.user_state_dir() / "index-snapshots.json"


def _state_lock_path() -> Path:
    return _state_path().with_suffix(".json.lock")


_STATE_LOCK_TIMEOUT_S = 5.0
# Blokada starsza niz tyle (albo z martwym pid) jest przejmowana. 06.10.2026 pusty plik
# blokady po padnietym procesie wisial dobe i kazdy zapis stanu kosztowal 5 s czekania.
_STATE_LOCK_STALE_S = 60.0


def _pid_alive(pid: int) -> bool:
    try:
        import rebuild_lock

        return rebuild_lock._pid_alive(pid)
    except Exception:  # noqa: BLE001 - nie wiemy = traktuj jak zywy (wiek i tak go zwolni)
        return True


def _lock_is_stale(lock_path: Path) -> bool:
    """Przeterminowana (mtime) albo po martwym procesie. Pusty plik (stary format albo
    wlasnie tworzony przez inny proces) oceniamy tylko po wieku."""
    try:
        if abs(time.time() - lock_path.stat().st_mtime) > _STATE_LOCK_STALE_S:
            return True
        pid = int(lock_path.read_text(encoding="utf-8").split(":")[0] or 0)
    except (OSError, ValueError):
        return False
    return bool(pid) and pid != os.getpid() and not _pid_alive(pid)


def _take_over_lock(lock_path: Path, token: str) -> bool:
    """Nadpisz przeterminowana blokade wlasna (tmp + replace). Niczego nie kasuje."""
    tmp = lock_path.with_name(lock_path.name + f".{os.getpid()}.{threading.get_ident()}.tmp")
    try:
        tmp.write_text(token, encoding="utf-8")
        os.replace(tmp, lock_path)
        # ponytail: dwoch przejmujacych naraz rozstrzyga "czyj zapis zostal po 50 ms";
        # okno istnieje tylko przy przeterminowanej blokadzie. Gdyby kolizje sie
        # zdarzaly: blokada systemowa (msvcrt.locking / fcntl) na otwartym pliku.
        time.sleep(0.05)
        return lock_path.read_text(encoding="utf-8") == token
    except OSError:
        try:
            tmp.unlink()  # wlasny plik tymczasowy, gdy replace sie nie udal
        except OSError:
            pass
        return False


@contextlib.contextmanager
def _state_lock():
    """Blokada MIEDZYPROCESOWA na czas odczyt-modyfikacja-zapis stanu
    (index-snapshots.json). Watek-lokalny _LOCK ponizej nie wystarcza: most
    (local_bridge.py, publish_changed/pull_newer) i OSOBNY PROCES
    bin/apps/web/scripts/watch-file-index.py (mark_built_here po udanym buildzie)
    pisza do TEGO SAMEGO pliku - bez blokady miedzy procesami dwa rownolegle
    load-modify-save mogly by zgubic nawzajem swoje pola (klasyczny lost update:
    most zapisuje pulled_sha ze stanu sprzed chwili, kasujac built_here_sha, ktory
    watcher wlasnie dopisal, i odwrotnie).

    Prosty plik-znacznik (O_CREAT|O_EXCL) - dziala identycznie na Windows/Linux,
    bez dodatkowej zaleznosci. W pliku "pid:watek:czas" - po tym poznajemy wlasna
    blokade przy zwalnianiu i martwego wlasciciela przy czekaniu (_lock_is_stale).
    Timeout: nie blokuj watku HTTP w nieskonczonosc - po uplywie czasu piszemy i tak
    (rzadka kolizja jest tansza niz zawieszony most). Oddaje True, gdy blokada jest nasza."""
    lock_path = _state_lock_path()
    try:
        lock_path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    token = f"{os.getpid()}:{threading.get_ident()}:{time.time():.6f}"
    deadline = time.monotonic() + _STATE_LOCK_TIMEOUT_S
    held = False
    while True:
        try:
            fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            try:
                os.write(fd, token.encode("utf-8"))
            finally:
                os.close(fd)  # zamkniety uchwyt: przeterminowana blokade da sie przejac
            held = True
            break
        except FileExistsError:
            if _lock_is_stale(lock_path) and _take_over_lock(lock_path, token):
                held = True
                break
            if time.monotonic() >= deadline:
                break  # zrezygnuj z blokady po timeout - zapisz i tak
            time.sleep(0.05)
        except OSError:
            break  # np. brak dostepu do katalogu - zapisz bez blokady
    try:
        yield held
    finally:
        # Windows: unlink pada (PermissionError), gdy czekajacy proces akurat czyta ten
        # plik w _lock_is_stale. Bez ponowienia blokada zostawala na 60 s (pomiar 07.10).
        for _ in range(40 if held else 0):
            try:
                # tylko wlasna: ktos mogl ja przejac, gdy trzymalismy ponad 60 s
                if lock_path.read_text(encoding="utf-8") == token:
                    lock_path.unlink()
                break
            except FileNotFoundError:
                break
            except OSError:
                time.sleep(0.01)


def _log_path() -> Path:
    return platform_compat.user_state_dir() / "logs" / "index-snapshots.log"


def _log(text: str, data: Any = None) -> None:
    """Dziennik cykli w katalogu stanu (wzor: dam_file_availability._mark). Nigdy nie rzuca."""
    try:
        if data is not None:
            text = f"{text} {json.dumps(data, ensure_ascii=False, default=str)}"
        target = _log_path()
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            if target.stat().st_size > LOG_MAX_BYTES:
                os.replace(target, target.with_name(target.name + ".1"))
        except OSError:
            pass
        ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with open(target, "a", encoding="utf-8") as fh:
            fh.write(f"{ts} {text}\n")
    except Exception:  # noqa: BLE001
        pass


def _load_state() -> dict[str, Any]:
    try:
        raw = json.loads(_state_path().read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_state(state: dict[str, Any]) -> None:
    p = _state_path()
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_name(p.name + f".{os.getpid()}.tmp")
        tmp.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
        for attempt in range(20):
            try:
                os.replace(tmp, p)
                break
            except PermissionError:
                # Windows: ktos wlasnie czyta stan (status(), local_signature() czytaja
                # bez blokady co 2 s) - bez ponowienia zapis ginal po cichu.
                if attempt == 19:
                    raise
                time.sleep(0.01)
    except OSError:
        pass


def _save_cycle_state(state: dict[str, Any]) -> None:
    """Zapis stanu na koncu pull_newer / publish_changed. Oba trzymaja blokade przez
    cala siec (pobranie / wysylka), a czekajacy mark_built_here po 5 s pisze bez
    blokady. built_here_sha ustawia TYLKO mark_built_here, wiec wartosc z dysku jest
    nie starsza niz nasza kopia sprzed cyklu - bierzemy ja, zamiast kasowac swiezy
    znacznik (bez niego plik czeka PENDING_BUILD_HOLD_S i wraca do wersji z bazy)."""
    for key, on_disk in _load_state().items():
        mark = on_disk.get("built_here_sha") if isinstance(on_disk, dict) else None
        entry = state.setdefault(key, {})
        if mark and isinstance(entry, dict):
            entry["built_here_sha"] = mark
    _save_state(state)


def _file_sig(path: Path) -> tuple[int, int] | None:
    try:
        st = path.stat()
        return st.st_size, int(st.st_mtime)
    except OSError:
        return None


def _sha256_cached(path: Path, entry: dict[str, Any]) -> str:
    """sha256 45 MB pliku kosztuje ~0,2 s - liczymy tylko gdy zmienil sie rozmiar/mtime."""
    sig = _file_sig(path)
    if sig is None:
        return ""
    if entry.get("local_sig") == list(sig) and entry.get("local_sha"):
        return str(entry["local_sha"])
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    sha = h.hexdigest()
    entry["local_sig"] = list(sig)
    entry["local_sha"] = sha
    return sha


def _is_built_here(entry: dict[str, Any], sha: str) -> bool:
    """True gdy TEN plik (po sha256) zostal naprawde zbudowany lokalnym skanem na
    tym komputerze - patrz mark_built_here(). Plik wgrany instalatorem (mtime
    maszyny budujacej, ale ZERO lokalnego builda na tym komputerze) albo pobrany
    z bazy nigdy nie dostaje built_here_sha, wiec nigdy nie wygra z baza jako
    "lokalny, wiec swiezy" (PLAN Faza 3, zadanie 3.4, incydent instalatora).

    Zgodnosc wstecz: komputer po aktualizacji z wersji sprzed tej zmiany ma w
    stanie tylko published_sha/source (bez built_here_sha) - jesli sha pliku wciaz
    zgadza sie z tym, co ten komputer juz kiedys opublikowal jako "local", liczymy
    to jak zbudowane tutaj (inaczej zloty komputer przestalby publikowac az do
    nastepnego skanu)."""
    built_here = entry.get("built_here_sha")
    if built_here:
        return sha == built_here
    return bool(sha) and sha == entry.get("published_sha") and entry.get("source") == "local"


def _pending_local_build(entry: dict[str, Any], sha: str, path: Path) -> bool:
    """Plik zmienil sie lokalnie od ostatniego znanego stanu (pobranie / publikacja /
    znacznik / zgodnosc z baza = synced_sha) i jest swiezy (mtime w oknie
    PENDING_BUILD_HOLD_S) = lokalny build, ktory czeka na mark_built_here. Pusty stan
    (pierwsza synchronizacja, plik z paczki instalatora) to NIE jest oczekujacy build -
    wtedy wygrywa baza."""
    known = {entry.get(k) for k in ("pulled_sha", "published_sha", "built_here_sha", "synced_sha")}
    known -= {None, ""}
    if not sha or not known or sha in known:
        return False
    try:
        return abs(time.time() - path.stat().st_mtime) <= PENDING_BUILD_HOLD_S
    except OSError:
        return False


def mark_built_here(key: str, path: Path | str) -> dict[str, Any]:
    """Wolane przez most PO UDANYM lokalnym buildzie (file-index / branding-search-index;
    branding-index w trybie rows i tak nie jest publikowany, patrz ROWS_MODE_SKIP_KEY).
    Zapisuje sha256 pliku jako "ten komputer naprawde to zbudowal" - publish_changed
    i regula "lokalny nowszy wygrywa" w pull_newer ufaja plikowi TYLKO gdy jego sha
    zgadza sie z tym zapisem (patrz _is_built_here)."""
    if key not in SNAPSHOT_FILES:
        return {"ok": False, "error": "unknown_key"}
    p = Path(path)
    with _state_lock():
        state = _load_state()
        entry = state.setdefault(key, {})
        sha = _sha256_cached(p, entry)
        if not sha:
            return {"ok": False, "error": "file_missing_or_unreadable"}
        entry["built_here_sha"] = sha
        _save_state(state)
    return {"ok": True, "key": key, "sha": sha}


def _iso_mtime(path: Path) -> str:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
    except OSError:
        return ""


def _machine() -> str:
    """Deleguje do index_authority.current_machine() - jedna funkcja nazwy maszyny
    dla index_snapshots/index_authority/asset_sync_runner (Faza 3, zadanie 3.3).
    Falback inline gdyby import kiedykolwiek sie nie udal - nie ma powodu, ale
    ta funkcja nigdy nie moze rzucic wyjatku (wolana z kodu publikujacego)."""
    try:
        import index_authority

        return index_authority.current_machine()
    except Exception:  # noqa: BLE001
        return (os.environ.get("COMPUTERNAME") or os.environ.get("HOSTNAME") or "").strip()


_LEGACY_ID_RE = re.compile(rb'"id"\s*:\s*"br-\d{6}"')


def _has_legacy_asset_ids(path: Path) -> bool:
    """Lokalny indeks sprzed 2.3.6 (id z licznika skanu, br-NNNNNN) przegrywa z baza
    nawet gdy jest nowszy - jego id nie pasuja do powiazan w bazie. Czyta tylko
    pierwsze 256 KB (pliki branding-* zaczynaja sie od listy assets)."""
    try:
        with path.open("rb") as fh:
            head = fh.read(256 * 1024)
    except OSError:
        return False
    return bool(_LEGACY_ID_RE.search(head))


def _looks_complete_json(raw: bytes) -> bool:
    """Waliduje, ze raw to prawdopodobnie caly (nie rozdarty) JSON-obiekt, bez
    kosztu pelnego json.loads() na duzych plikach.

    Male pliki (<= FULL_PARSE_MAX_BYTES): pelny json.loads jak dotad - to
    najpewniejsza walidacja i dla ~5 MB kosztuje ulamek sekundy.

    Duze pliki (np. branding-index.json ~362 MB na zlotej maszynie): pelny
    json.loads zaladowalby cala tresc jako str + zbudowal drzewo obiektow w
    pamieci - to kilka GB RAM na jeden plik, co na komputerze bez folderu
    Marketing (slabszy sprzet) moze zwiesic proces. Zamiast tego sprawdzamy
    tanio: po obcieciu bialych znakow pierwszy bajt to "{", ostatni to "}",
    a poczatek i koniec pliku da sie zdekodowac jako UTF-8. Dekodujemy tylko
    koncowki (po 64 KB) z errors="ignore", bo przy obcinaniu do stalej liczby
    bajtow mozna trafic w srodek wielobajtowego znaku UTF-8 - "ignore"
    zjada niepelny bajt zamiast rzucac wyjatkiem, a i tak liczy sie tylko to,
    czy dekodowanie w ogole sie udaje (brak UnicodeDecodeError na calosci).
    To nie jest pelna walidacja skladni JSON w srodku pliku - tylko szybki
    test "czy plik nie jest ewidentnie rozdarty w polowie zapisu".
    """
    if len(raw) <= FULL_PARSE_MAX_BYTES:
        try:
            json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            return False
        return True
    trimmed = raw.strip()
    if not trimmed or trimmed[:1] != b"{" or trimmed[-1:] != b"}":
        return False
    # decode(errors="ignore") nie rzuca wyjatku nawet na przecietym bajcie
    # wielobajtowego znaku UTF-8 na granicy wycinka - liczy sie tylko to,
    # ze samo dekodowanie sie wykona (nie ma tu innej gwarancji do sprawdzenia).
    head = trimmed[:65536]
    tail = trimmed[-65536:]
    head.decode("utf-8", errors="ignore")
    tail.decode("utf-8", errors="ignore")
    return True


def publish_changed(data_dir: Path, *, root_alive: bool, force: bool = False) -> dict[str, Any]:
    """Wyslij do bazy skan zbudowany NA TYM komputerze (tylko przy dostepnym folderze Marketing)."""
    if not root_alive:
        return {"ok": True, "skipped": "no_marketing_root"}
    try:
        import pg_db
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"pg_db: {exc}"}
    # Faza 3 (decyzja kierownika 27.09.2026): ROOT lokalny nie daje prawa do
    # zmiany wspolnego katalogu w bazie - patrz index_authority.py. 07.10.2026 (zasada wlasciciela:
    # ekran pokazuje stan bazy): None (brak klucza / blad odczytu bez zapamietanej wartosci) =
    # "nie wiem" = "nie wolno". Wyjatek: force (reczne "Wyslij indeks do bazy" przez admina).
    try:
        import index_authority

        allowed = index_authority.may_publish(pg_db.connect)
    except Exception:  # noqa: BLE001
        allowed = None
    if allowed is False:
        return {"ok": True, "skipped": "not_authority"}
    if allowed is None and not force:
        return {"ok": True, "skipped": "authority_unknown"}
    out: dict[str, Any] = {"ok": True, "published": [], "unchanged": []}
    try:
        db_metas = pg_db.index_snapshot_meta()
    except Exception:  # noqa: BLE001
        db_metas = {}
    # Blokada miedzyprocesowa: most i watch-file-index.py (mark_built_here) pisza
    # do tego samego pliku stanu - patrz _state_lock().
    with _state_lock():
        state = _load_state()
        for key, fname in SNAPSHOT_FILES.items():
            if key == ROWS_MODE_SKIP_KEY and _asset_index_mode_is_rows():
                out.setdefault("skipped_rows_mode", []).append(key)
                continue
            path = Path(data_dir) / fname
            if not path.is_file() or path.stat().st_size < MIN_BYTES:
                continue
            entry = state.setdefault(key, {})
            sha = _sha256_cached(path, entry)
            if not sha:
                continue
            # PLAN Faza 3, zadanie 3.4: publikujemy TYLKO plik, ktory ten komputer
            # naprawde zbudowal (mark_built_here) - inaczej plik z instalatora albo
            # pobrany z bazy wraca do bazy jako "swiezy" (incydent 27.09).
            if not force and not _is_built_here(entry, sha):
                out.setdefault("refused_not_built_here", []).append(key)
                continue
            if not force and sha in (entry.get("pulled_sha"), entry.get("published_sha")):
                out["unchanged"].append(key)
                continue
            # Bezpiecznik 2026-09-23: niepelny skan (9 produktow zamiast 196) zostal tu
            # opublikowany i wszystkie komputery bez ROOT dostaly okrojony indeks. Plik
            # mniejszy niz 80% wersji w bazie nie idzie do bazy bez force.
            db_bytes = int((db_metas.get(key) or {}).get("raw_bytes") or 0)
            if not force and db_bytes and path.stat().st_size < db_bytes * SHRINK_GUARD:
                out.setdefault("refused_shrink", []).append(
                    {"key": key, "local_bytes": path.stat().st_size, "db_bytes": db_bytes}
                )
                continue
            try:
                raw = path.read_bytes()
                if not _looks_complete_json(raw):  # nie wysylamy rozdartego pliku
                    raise ValueError("nie wyglada na kompletny JSON")
                res = pg_db.publish_index_snapshot(
                    key, raw, sha256=sha, built_at=_iso_mtime(path), built_by=_machine()
                )
            except Exception as exc:  # noqa: BLE001
                if is_not_authority_error(exc):
                    # ADR-012: bramka w bazie odrzucila (lista index_authority nas nie
                    # obejmuje, a lokalna pamiec may_publish byla nieaktualna). To nie
                    # jest blad sieci: odswiez decyzje i nie wysylaj kolejnych kluczy
                    # (branding-index to setki MB - kazdy i tak zostalby odrzucony).
                    out["skipped"] = "not_authority"
                    out.setdefault("refused_not_authority", []).append(key)
                    try:
                        import index_authority

                        index_authority.may_publish(pg_db.connect, force=True)
                    except Exception:  # noqa: BLE001
                        pass
                    print(f"index_snapshots: {key} odrzucony przez baze (not_authority)", flush=True)
                    _log(f"{key} odrzucony przez baze (not_authority)")
                    break
                out["ok"] = False
                out.setdefault("errors", {})[key] = str(exc)[:300]
                continue
            entry["published_sha"] = sha
            entry["generation"] = res.get("generation")
            (out["published"] if res.get("changed") else out["unchanged"]).append(key)
        _save_cycle_state(state)
    return out


def pull_newer(
    data_dir: Path,
    *,
    root_alive: bool,
    on_updated: Callable[[str, Path], None] | None = None,
    connect_timeout: float | None = None,
) -> dict[str, Any]:
    """Sciagnij z bazy nowsza generacje skanu. Komputer z folderem jest zrodlem - nie
    nadpisujemy mu swiezszego lokalnego skanu starszym z bazy.

    connect_timeout (proby pierwszego pobrania): limit KAZDEGO polaczenia w tym pobraniu
    (meta, lista wlascicieli, tresc migawek), gdy pg_db przyjmuje parametr `timeout`."""
    try:
        import data_mode

        if data_mode.is_local():
            return {"ok": True, "pulled": [], "current": [], "missing_in_db": [], "skipped_local_mode": True}
    except ImportError:
        pass
    try:
        import pg_db

        metas = pg_db.index_snapshot_meta(**_pg_timeout_kwargs(pg_db.index_snapshot_meta, connect_timeout))
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:300]}
    out: dict[str, Any] = {"ok": True, "pulled": [], "current": [], "missing_in_db": []}
    # ADR-012 pkt 3: "lokalny nowszy plik wygrywa" tylko dla wlasciciela katalogu
    # (may_publish True). Komputer spoza listy zawsze bierze wersje z bazy - jego ROOT bywa
    # opozniona kopia Drive. 07.10.2026: lista nieznana (None) tez = wersja z bazy ("nie wiem" =
    # "nie wolno": ekran pokazuje stan bazy, nie to, co ma ten komputer); zapamietana wartosc listy
    # (index_authority: plik stanu) obowiazuje jak dotad, wiec wlasciciel przy chwilowo
    # niedostepnej bazie dalej wygrywa lokalnym buildem.
    try:
        import index_authority

        authority = index_authority.may_publish(_connector(pg_db, connect_timeout))
    except Exception:  # noqa: BLE001
        authority = None
    local_may_win = authority is True
    if not local_may_win:
        out["authority"] = False if authority is False else "unknown"
    # Blokada miedzyprocesowa: most i watch-file-index.py (mark_built_here) pisza
    # do tego samego pliku stanu - patrz _state_lock().
    with _state_lock():
        state = _load_state()
        for key, fname in SNAPSHOT_FILES.items():
            if key == ROWS_MODE_SKIP_KEY and _asset_index_mode_is_rows(connect_timeout=connect_timeout):
                out.setdefault("skipped_rows_mode", []).append(key)
                continue
            meta = metas.get(key)
            if not meta:
                out["missing_in_db"].append(key)
                continue
            path = Path(data_dir) / fname
            entry = state.setdefault(key, {})
            local_sha = _sha256_cached(path, entry) if path.is_file() else ""
            entry["db"] = {k: meta.get(k) for k in ("generation", "built_at", "built_by", "published_at", "sha256")}
            if local_sha and local_sha == meta.get("sha256"):
                entry["source"] = "db" if entry.get("pulled_sha") == local_sha else entry.get("source") or "local"
                entry["synced_sha"] = local_sha  # znany stan dla _pending_local_build
                out["current"].append(key)
                continue
            if (
                local_may_win
                and root_alive
                and path.is_file()
                and _iso_mtime(path) > str(meta.get("built_at") or "")
                and not _has_legacy_asset_ids(path)
                and _is_built_here(entry, local_sha)
            ):
                out["current"].append(key)
                entry["source"] = "local"
                continue
            if local_may_win and root_alive and _pending_local_build(entry, local_sha, path):
                out.setdefault("pending_local_build", []).append(key)
                continue
            t0 = time.monotonic()
            try:
                got = pg_db.fetch_index_snapshot(key, **_pg_timeout_kwargs(pg_db.fetch_index_snapshot, connect_timeout))
                if not got:
                    continue
                m2, raw = got
                if hashlib.sha256(raw).hexdigest() != m2.get("sha256"):
                    raise ValueError("sha256_mismatch")
                if not _looks_complete_json(raw):
                    raise ValueError("nie wyglada na kompletny JSON")
                path.parent.mkdir(parents=True, exist_ok=True)
                tmp = path.with_name(path.name + f".{os.getpid()}.db.tmp")
                tmp.write_bytes(raw)
                os.replace(tmp, path)
            except Exception as exc:  # noqa: BLE001
                out["ok"] = False
                out.setdefault("errors", {})[key] = str(exc)[:300]
                continue
            sha = m2.get("sha256") or ""
            entry.update(pulled_sha=sha, local_sha=sha, local_sig=list(_file_sig(path) or ()), source="db",
                         pulled_at=datetime.now(timezone.utc).isoformat(), generation=m2.get("generation"))
            out["pulled"].append({"key": key, "ms": int((time.monotonic() - t0) * 1000), "bytes": len(raw)})
            if on_updated is not None:
                try:
                    on_updated(key, path)
                except Exception:  # noqa: BLE001
                    pass
        _save_cycle_state(state)
    return out


def status() -> dict[str, Any]:
    """Dla UI: skad jest indeks i z kiedy."""
    state = _load_state()
    keys = {}
    for key in SNAPSHOT_FILES:
        e = state.get(key) or {}
        db = e.get("db") or {}
        keys[key] = {
            "source": e.get("source") or "local",
            "built_at": db.get("built_at") if e.get("source") == "db" else "",
            "built_by": db.get("built_by") if e.get("source") == "db" else "",
            "db_built_at": db.get("built_at") or "",
            "db_built_by": db.get("built_by") or "",
            "pulled_at": e.get("pulled_at") or "",
        }
    try:
        catalog = catalog_info()
    except Exception:  # noqa: BLE001 - znacznik jest dodatkiem, nie moze zepsuc statusu
        catalog = {}
    return {"ok": True, "keys": keys, "last": dict(_LAST), "first_sync": dict(_FIRST_SYNC), "catalog": catalog}


def first_sync_state() -> dict[str, Any]:
    """Do banera UI "pobieram dane" / /health: czy pierwszy cykl po starcie procesu
    juz sie skonczyl, i czy sie udal. Zanim sie skonczy: done=False - UI ma wtedy
    pokazac stan ladowania zamiast danych z instalatora/pustych list (PLAN Faza 3)."""
    return dict(_FIRST_SYNC)


def catalog_id_from_shas(shas: dict[str, str]) -> str:
    """Znacznik katalogu: 7 znakow skrotu czterech sum plikow (CATALOG_KEYS, stala kolejnosc).
    Dwa komputery z tym samym znacznikiem maja te same cztery pliki co do bajta. Brak ktorejkolwiek
    sumy = '' (katalog niekompletny: swieza instalacja bez spisu, albo suma jeszcze nieliczona)."""
    if not all(str(shas.get(k) or "") for k in CATALOG_KEYS):
        return ""
    raw = "\n".join(f"{k}={shas[k]}" for k in CATALOG_KEYS)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:7]


def catalog_info(data_dir: Path | str | None = None) -> dict[str, Any]:
    """Znacznik katalogu TEGO komputera do ekranow, /index/status, /index/snapshots i tetna.

    Sumy bierze ze stanu migawek (local_sha), gdy local_sig zgadza sie ze stat() pliku; plik zmieniony od
    ostatniego liczenia sumy = `pending` (sume policzy najblizszy cykl migawek, tu nie hashujemy 45 MB).
    id/db_id puste = katalog niekompletny. source: db = wszystkie cztery pliki rowne wersji w bazie,
    local = zadna, mixed = czesc; '' gdy nie ma zadnego pliku z suma. Tylko pamiec i 4x stat() - tanie.
    Etap 3 podmienia TYLKO to wyliczenie (kind=generation, id=numer kompletu); pola zostaja."""
    root = Path(data_dir) if data_dir else _DATA_DIR
    state = _load_state()
    parts: dict[str, Any] = {}
    shas: dict[str, str] = {}
    db_shas: dict[str, str] = {}
    pending = False
    for key in CATALOG_KEYS:
        entry = state.get(key) or {}
        db = entry.get("db") or {}
        path = root / SNAPSHOT_FILES[key] if root else None
        sig = _file_sig(path) if path else None
        sha = ""
        if sig is not None:
            if entry.get("local_sig") == list(sig) and entry.get("local_sha"):
                sha = str(entry["local_sha"])
            else:
                pending = True
        db_sha = str(db.get("sha256") or "")
        shas[key], db_shas[key] = sha, db_sha
        same = bool(sha) and sha == db_sha
        if same:
            built_at, built_by = str(db.get("built_at") or ""), str(db.get("built_by") or "")
        else:
            built_at = _iso_mtime(path) if sig is not None and path else ""
            built_by = _machine() if sha and _is_built_here(entry, sha) else ""
        parts[key] = {"sha": sha[:7], "built_at": built_at, "built_by": built_by, "pending": sha == "" and sig is not None,
                      "source": "" if not sha else ("db" if same else "local"), "pulled_at": str(entry.get("pulled_at") or "")}
    have = [k for k in CATALOG_KEYS if shas[k]]
    if not have:
        source = ""
    elif all(shas[k] == db_shas[k] for k in CATALOG_KEYS):
        source = "db"
    elif not any(shas[k] == db_shas[k] for k in have):
        source = "local"
    else:
        source = "mixed"
    head = parts["file-index"]
    return {
        "kind": "snapshot", "id": catalog_id_from_shas(shas), "gen": None,
        "built_at": head["built_at"], "built_by": head["built_by"], "source": source,
        "complete": len(have) == len(CATALOG_KEYS), "pending": pending,
        "db_id": catalog_id_from_shas(db_shas),
        "pulled_at": max((p["pulled_at"] for p in parts.values()), default=""),
        "parts": parts,
    }


def refresh_catalog_cache() -> bool:
    """Odswiez pamiec podreczna znacznika dla /health (zero IO w zapytaniu: W11). True = id sie zmienil."""
    try:
        info = catalog_info()
        new = {"catalog_id": str(info.get("id") or ""), "catalog_source": str(info.get("source") or "")}
    except Exception:  # noqa: BLE001
        return False
    with _LOCK_CATALOG:
        changed = new["catalog_id"] != _CATALOG_CACHE["catalog_id"]
        _CATALOG_CACHE.update(new)
    return changed


def cached_catalog_id() -> dict[str, str]:
    with _LOCK_CATALOG:
        return dict(_CATALOG_CACHE)


def _after_cycle(data_dir: Path) -> None:
    """Koniec cyklu migawek: zapamietaj katalog plikow, odswiez znacznik; zmiana = tetno floty od reki
    (admin widzi nowy katalog tego komputera bez czekania pelnego rytmu). Nigdy nie rzuca."""
    global _DATA_DIR
    _DATA_DIR = Path(data_dir)
    if refresh_catalog_cache():
        try:
            import fleet_heartbeat  # noqa: PLC0415

            fleet_heartbeat.kick()
        except Exception:  # noqa: BLE001
            pass


def _note_first_sync(pull: dict[str, Any]) -> None:
    """Zapis wyniku proby pobrania w stanie pierwszej synchronizacji (wolac pod _LOCK).
    `done` = pierwsza proba sie zakonczyla (udana lub nie), `ok` = wynik OSTATNIEJ proby do
    pierwszego sukcesu; po sukcesie stan sie nie zmienia (pozniejsze porazki to zwykly rytm)."""
    _FIRST_SYNC["attempts"] = int(_FIRST_SYNC.get("attempts") or 0) + 1
    if _FIRST_SYNC.get("ok") is True:
        return
    ok = bool(pull.get("ok"))
    err = "" if ok else str(pull.get("error") or pull.get("errors") or "nieznany blad")[:300]
    _FIRST_SYNC.update(done=True, ok=ok, last_error=err, finished_at=datetime.now(timezone.utc).isoformat())
    if ok:
        _FIRST_SYNC["next_retry_at"] = ""


def run_once(data_dir: Path, root_alive_fn: Callable[[], bool],
             on_updated: Callable[[str, Path], None] | None = None, *, why: str = "") -> dict[str, Any]:
    with _LOCK:
        is_first = not _FIRST_SYNC["done"]
        if is_first and not _FIRST_SYNC["started_at"]:
            _FIRST_SYNC["started_at"] = datetime.now(timezone.utc).isoformat()
        try:
            alive = bool(root_alive_fn())
        except Exception:  # noqa: BLE001
            alive = False
        # PLAN Faza 3, zadanie 3.4: najpierw pobierz (zeby lokalny plik z instalatora
        # zdazyl sie zastapic wersja z bazy PRZED ewentualna publikacja), potem publikuj.
        first_try = _FIRST_SYNC.get("ok") is not True  # do pierwszego sukcesu dluzszy limit polaczenia
        pull = pull_newer(data_dir, root_alive=alive, on_updated=on_updated,
                          connect_timeout=FIRST_SYNC_CONNECT_TIMEOUT_S if first_try else None)
        if not pull.get("ok") and pull.get("error") and not pull.get("errors"):
            # Baza nieosiagalna (meta nie odczytane): publikacja polaczylaby sie jeszcze dwa razy
            # (meta + lista wlascicieli, kazde z limitem polaczenia) i tak bez skutku.
            pub = {"ok": True, "skipped": "db_unreachable"}
        else:
            pub = publish_changed(data_dir, root_alive=alive)
        _LAST.update(at=datetime.now(timezone.utc).isoformat(), why=why, root_alive=alive, publish=pub, pull=pull)
        _log("cykl", {"why": why, "root": alive, "pull": pull, "publish": pub})
        _note_first_sync(pull)
        _after_cycle(data_dir)
        return dict(_LAST)


def retry_first_pull(data_dir: Path, root_alive_fn: Callable[[], bool],
                     on_updated: Callable[[str, Path], None] | None = None) -> bool | None:
    """Ponowienie PIERWSZEGO pobrania z bazy: samo pull_newer, bez publikacji. None = trwa inny
    cykl (run_once / ponowienie z innego watku) - nic nie robimy i nie liczymy proby; True = pobranie
    sie udalo (takze pusta baza: baza odpowiedziala); False = porazka. Po kazdej probie zmienia sie
    `last.at` w /index/snapshots (UI po tym widzi, ze most zyje i probuje)."""
    if not _LOCK.acquire(blocking=False):
        return None
    try:
        if _FIRST_SYNC.get("ok") is True:
            return True
        try:
            alive = bool(root_alive_fn())
        except Exception:  # noqa: BLE001
            alive = False
        pull = pull_newer(data_dir, root_alive=alive, on_updated=on_updated,
                          connect_timeout=FIRST_SYNC_CONNECT_TIMEOUT_S)
        _LAST.update(at=datetime.now(timezone.utc).isoformat(), why="first_sync_retry", root_alive=alive,
                     publish={"ok": True, "skipped": "first_sync_retry"}, pull=pull)
        _log("ponowienie pierwszego pobrania", {"root": alive, "pull": pull})
        _note_first_sync(pull)
        _after_cycle(data_dir)
        return bool(pull.get("ok"))
    finally:
        _LOCK.release()


def first_sync_delay(elapsed_s: float) -> float:
    """Odstep miedzy probami pierwszego pobrania: FIRST_SYNC_RETRY_S przez pierwsza minute od
    porazki, potem rosnie 0,5 s na sekunde do FIRST_SYNC_RETRY_MAX_S."""
    if elapsed_s < FIRST_SYNC_FAST_FOR_S:
        return FIRST_SYNC_RETRY_S
    return min(FIRST_SYNC_RETRY_MAX_S, FIRST_SYNC_RETRY_S + (elapsed_s - FIRST_SYNC_FAST_FOR_S) * 0.5)


class FirstSyncRetry:
    """Harmonogram ponowien pierwszego pobrania (testowalny bez watku). Aktywny od porazki pierwszego
    cyklu (`_FIRST_SYNC.done` i `ok is False`) do pierwszego sukcesu; `attempt` zwraca True/False/None
    (patrz retry_first_pull)."""

    def __init__(self, attempt: Callable[[], bool | None], *, clock: Callable[[], float] = time.monotonic):
        self.attempt = attempt
        self.clock = clock
        self._since: float | None = None
        self._next_at = 0.0
        self.tries = 0

    @staticmethod
    def pending() -> bool:
        return bool(_FIRST_SYNC.get("done")) and _FIRST_SYNC.get("ok") is False

    def _arm(self, now: float) -> None:
        self._since = now
        self._set_next(now + first_sync_delay(0.0))

    def _set_next(self, at: float) -> None:
        self._next_at = at
        eta = datetime.now(timezone.utc).timestamp() + max(0.0, at - self.clock())
        _FIRST_SYNC["next_retry_at"] = datetime.fromtimestamp(eta, tz=timezone.utc).isoformat()

    def cycle_finished(self) -> None:
        """Wolane po kazdym pelnym cyklu: porazka pierwszego pobrania uzbraja odliczanie od teraz."""
        if self.pending():
            self._arm(self.clock())
        else:
            self._since = None

    def due(self) -> bool:
        if not self.pending():
            self._since = None
            return False
        now = self.clock()
        if self._since is None:
            self._arm(now)
        return now >= self._next_at

    def run(self) -> bool | None:
        try:
            res = self.attempt()
        except Exception as exc:  # noqa: BLE001 - blad proby to porazka, nie petla co sekunde
            _log(f"ponowienie pierwszego pobrania: wyjatek {str(exc)[:300]}")
            res = False
        now = self.clock()
        if res is None:  # trwa inny cykl: sprawdzimy za chwile, proby nie liczymy
            self._set_next(now + FIRST_SYNC_TICK_S)
            return None
        self.tries += 1
        if res:
            self._since = None
            return True
        self._set_next(now + first_sync_delay(now - (self._since if self._since is not None else now)))
        return False


def local_signature(data_dir: Path) -> tuple:
    """Odcisk LOKALNEGO stanu migawek: built_here_sha z pliku stanu (mark_built_here,
    takze z procesu watch-file-index.py) + (rozmiar, mtime) plikow w web/data.
    Bez branding-index (w trybie rows przepisywany przez scalanie, setki MB)."""
    state = _load_state()
    out = []
    for key, fname in SNAPSHOT_FILES.items():
        if key == ROWS_MODE_SKIP_KEY:
            continue
        built = str((state.get(key) or {}).get("built_here_sha") or "")
        out.append((key, built, _file_sig(Path(data_dir) / fname)))
    return tuple(out)


def _authority_decision() -> bool | None:
    """index_authority.may_publish() (cache 60 s). Blad importu/odczytu = None.
    Proces testow (unittest w sys.modules): None bez polaczenia - testy podmieniaja."""
    if "unittest" in sys.modules:
        return None
    try:
        import index_authority
        import pg_db

        return index_authority.may_publish(pg_db.connect)
    except Exception:  # noqa: BLE001
        return None


class LocalBuildWatch:
    """Nowy lokalny build -> due() po LOCAL_DEBOUNCE_S spokoju (kilka plikow jednego
    builda = jeden cykl). Stan poczatkowy jest bazowy (start nie wyzwala)."""

    def __init__(self, sig_fn: Callable[[], Any], *, debounce_s: float = LOCAL_DEBOUNCE_S,
                 clock: Callable[[], float] = time.monotonic):
        self.sig_fn = sig_fn
        self.debounce_s = float(debounce_s)
        self.clock = clock
        self.seen = self._sig()
        self._pending: Any = None
        self._pending_since = 0.0

    def _sig(self) -> Any:
        try:
            return self.sig_fn()
        except Exception:  # noqa: BLE001
            return None

    def due(self) -> bool:
        sig = self._sig()
        if sig is None or sig == self.seen:
            self._pending = None
            return False
        now = self.clock()
        if sig != self._pending:
            self._pending, self._pending_since = sig, now
            return False
        return now - self._pending_since >= self.debounce_s

    def done(self) -> None:
        self.seen = self._sig()
        self._pending = None


class SnapshotLoop:
    """Jeden krok petli watku migawek (testowalny bez watku i bez sieci).

    remote_watch = LightWatch (ADR-012 pkt 4: co LIGHT_CHECK_S generacje w bazie, pelny
    cykl przy zmianie albo co REFRESH_S) albo None (dawna petla co REFRESH_S).
    Lokalny build: cykl od razu po debounce, gdy lista wlascicieli istnieje -
    wlasciciel (True) publikuje, klient (False) wraca do wersji z bazy. None = jak dotad."""

    def __init__(self, data_dir: Path, *, run_cycle: Callable[[str], Any], remote_watch: Any,
                 clock: Callable[[], float] = time.monotonic, first_retry: FirstSyncRetry | None = None):
        self.run_cycle = run_cycle
        self.remote_watch = remote_watch
        self.clock = clock
        self.first_retry = first_retry  # ponawianie pierwszego pobrania (None = jak dotad)
        self.local = LocalBuildWatch(lambda: local_signature(data_dir), clock=clock)
        self._next_remote = 0.0
        self._last_full: float | None = None

    def tick(self) -> str:
        why = ""
        now = self.clock()
        if self.first_retry is not None and self.first_retry.due():
            self.first_retry.run()  # samo pobranie, bez publikacji; nie nachodzi na trwajacy cykl (_LOCK)
        if self.local.due():
            if _authority_decision() is not None:
                why = "local_build"
            # None = lista publikujacych nieznana: zmiana lokalna ZOSTAJE oczekujaca (due() dalej prawdziwe)
            # do chwili, gdy lista bedzie znana (cache listy 60 s ogranicza pytania do bazy); pelny cykl
            # w miedzyczasie i tak ja zamyka (finally nizej) pobraniem wersji z bazy.
        if not why and now >= self._next_remote:
            self._next_remote = now + LIGHT_CHECK_S
            if self.remote_watch is not None:
                if self.remote_watch.due():
                    why = str(getattr(self.remote_watch, "reason", "") or "remote")
            elif self._last_full is None:
                why = "first"
            elif now - self._last_full >= REFRESH_S:
                why = "interval"
        if why:
            try:
                self.run_cycle(why)
            finally:
                self._last_full = self.clock()
                if self.remote_watch is not None:
                    self.remote_watch.done()
                self.local.done()
                if self.first_retry is not None:
                    self.first_retry.cycle_finished()
        return why


def _catalog_files_present(data_dir: Path) -> bool:
    """Czy sa lokalne pliki spisu (lista i wyszukiwarka produktow, niepuste)."""
    for key in ("file-index", "search-index"):
        sig = _file_sig(Path(data_dir) / SNAPSHOT_FILES[key])
        if sig is None or sig[0] < MIN_BYTES:
            return False
    return True


def _startup_delay_s(data_dir: Path) -> float:
    return START_DELAY_S if _catalog_files_present(data_dir) else START_DELAY_FRESH_S


def _initial_wait(data_dir: Path) -> None:
    time.sleep(_startup_delay_s(data_dir))


def _cycle_safe(data_dir: Path, root_alive_fn: Callable[[], bool],
                on_updated: Callable[[str, Path], None] | None, why: str) -> dict[str, Any]:
    """run_once bez wyjatku na zewnatrz. Wyjatek tez zmienia `last.at` (UI widzi, ze most zyje i probuje)."""
    try:
        return run_once(data_dir, root_alive_fn, on_updated, why=why)
    except Exception as exc:  # noqa: BLE001 - watek nie moze umrzec
        err = str(exc)[:300]
        _LAST.update(at=datetime.now(timezone.utc).isoformat(), why=why, error=err)
        _log(f"cykl blad why={why}: {err}")
        with _LOCK:  # wyjatek pierwszego cyklu = porazka pierwszego pobrania: wlacza ponawianie
            _note_first_sync({"ok": False, "error": err})
        return {"error": err}


def start_watch(data_dir: Path, root_alive_fn: Callable[[], bool],
                on_updated: Callable[[str, Path], None] | None = None) -> dict[str, Any]:
    global _THREAD
    if _THREAD is not None and _THREAD.is_alive():
        return {"ok": True, "started": False}

    def cycle(why: str) -> None:
        res = _cycle_safe(data_dir, root_alive_fn, on_updated, why)
        print("index_snapshots:", {"why": why, "root": res.get("root_alive"),
                                   "publish": res.get("publish"), "pull": res.get("pull")},
              flush=True)

    def loop() -> None:
        _after_cycle(data_dir)  # znacznik katalogu od startu (z plikow i stanu; bez sieci), przed pierwszym cyklem
        _initial_wait(data_dir)  # po starcie mostu: najpierw UI, potem siec (swiezy komputer: szybciej)
        # ADR-012 pkt 4: co LIGHT_CHECK_S tylko generacje (bez payload); pelny cykl
        # przy zmianie w bazie albo co REFRESH_S jak dotad. Bez LightWatch (import
        # sie nie udal) - dawna petla co REFRESH_S. W8: plus lokalny build (SnapshotLoop).
        try:
            from asset_sync_runner import LightWatch

            watch = LightWatch(REFRESH_S, generations_signature)
        except Exception:  # noqa: BLE001
            watch = None
        retry = FirstSyncRetry(lambda: retry_first_pull(data_dir, root_alive_fn, on_updated))
        stepper = SnapshotLoop(data_dir, run_cycle=cycle, remote_watch=watch, first_retry=retry)
        while True:
            try:
                stepper.tick()
            except Exception as exc:  # noqa: BLE001 - watek nie moze umrzec
                print("index_snapshots: tick error", str(exc)[:300], flush=True)
                _log(f"tick error {str(exc)[:300]}")
            # do pierwszego udanego pobrania sprawdzamy co sekunde (ponowienia co 5 s), potem jak dotad
            time.sleep(FIRST_SYNC_TICK_S if retry.pending() else LOCAL_CHECK_S)

    _THREAD = threading.Thread(target=loop, daemon=True, name="dam-index-snapshots")
    _THREAD.start()
    return {"ok": True, "started": True}
