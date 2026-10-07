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
indeksu (kod 5 buildera) i rzadkiego przebiegu awaryjnego (--hourly, domyslnie 6 h, liczony
od ostatniego PELNEGO skanu).

Od 07.10.2026 (zmiana -> spis w < 30 s zamiast mediany 3,4 min):
- obieg produktow nie przeglada juz katalogow brandingu (76 s na M: w KAZDYM obiegu); branding
  ma wlasny rytm i watek (BrandingHook, --branding-interval / --branding-delay),
- cisza po zmianie jest sprawdzana ponownym pomiarem TYLKO zmienionych produktow (settle),
  bez czekania na kolejny pelny obieg,
- wiecej zmian niz --incremental-max idzie kolejnymi paczkami przyrostowymi, nie pelnym skanem,
- kazda linia [watch] ma znacznik czasu UTC (_log).

Po przegladzie zmiany (07.10.2026):
- nieczytelny folder produktu to BLAD ODCZYTU, nie zmiana: nie idzie do przebudowy (builder usunalby
  produkt ze spisu), a liczba watkow migawki spada do 1 (ScanPace),
- przerwa miedzy migawkami = max(--interval, 2 x czas ostatniej migawki); domyslnie 4 watki,
- cisza 15 s (--debounce) i limit czekania na produkt zmieniany bez konca (--debounce-max, 5 min),
- paczka z bledem jest dzielona na pol (izolacja produktu), kolejne paczki ida dalej; raport przebiegu
  i publikacja miniatur raz na serie paczek,
- hak brandingu: blad potoku = powtorka (najwyzej 3 proby), pola branding_hook_* w statusie osobno.

Przeglad godzinny (decyzja wlasciciela 07.10.2026: "indeks co godzine, tak bedzie najbezpieczniej"):
co --review sekund (domyslnie 3600) WSZYSTKIE produkty ida przez przebudowe przyrostowa w paczkach po
--incremental-max, ta sama droga co zmiany. Jedna paczka na obieg petli: miedzy paczkami petla robi
migawke, wiec zmiana zapisana w trakcie przegladu jest budowana przed kolejna paczka. Ciezki pelny skan
(z folderem marketingu) zostaje co --hourly (6 h) i po kodzie 5. Status i log mowia, ktory rodzaj
przebiegu trwa: rebuild_mode = incremental (przyrost) / review (przeglad godzinny) / full (pelny skan).

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
from concurrent.futures import ThreadPoolExecutor
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
        # 07.10.2026 (audyt publikacji, Z6): stala nazwa ".write-probe" - drugi proces kasowal sonde
        # pierwszemu i watcher ladowal w katalogu zapasowym (stan w dwoch miejscach). Wzor: platform_compat.
        probe = cand / f".write-probe-{os.getpid()}-{os.urandom(4).hex()}"
        probe.write_text("1", encoding="utf-8")
    except OSError:
        return DESKTOP_DATA
    try:
        probe.unlink()
    except OSError:
        pass  # zapis sie udal = katalog jest zapisywalny; sprzatanie nie decyduje
    return cand


def _env_num(name: str, default: float) -> float:
    """Liczba ze zmiennej srodowiskowej. Smiec ("osiem", "", inf) = wartosc domyslna: literowka
    w ustawieniu nie moze wywrocic importu watchera (N1)."""
    try:
        val = float((os.environ.get(name) or "").strip() or default)
    except ValueError:
        return float(default)
    return val if val == val and abs(val) != float("inf") else float(default)


STATE_DIR = _state_dir()
DEFAULT_STATUS = STATE_DIR / "index-watcher-status.json"
DEFAULT_LOCK = STATE_DIR / "index-rebuild.lock.json"
# Kod wyjscia build-file-index.py: przyrost niemozliwy (brak/uszkodzony indeks, inne rooty)
NEEDS_FULL_RC = 5
# Kod wyjscia build-file-index.py: folder produktu / kategorii NIEOSIAGALNY (blad odczytu, nie brak folderu).
# Builder nic nie zapisal. To nie kod 5 (bez pelnego skanu) i nie wina produktu (bez liczenia prob):
# jak blad odczytu migawki - 1 watek i ta sama paczka po zwloce.
UNREACHABLE_RC = 6
HOURLY_DEFAULT_SEC = 21600.0  # przebieg awaryjny co 6 h (patrz --hourly)
REVIEW_DEFAULT_SEC = 3600.0  # przeglad godzinny: wszystkie produkty przyrostowo (patrz --review)
DEBOUNCE_DEFAULT_SEC = 15.0  # 5 s trafialo na plik w polowie kopiowania albo zapisu PSD
DEBOUNCE_MAX_DEFAULT_SEC = 300.0  # produkt zmieniany bez konca: po tylu sekundach przebudowa mimo zmian
INCREMENTAL_MAX_DEFAULT = 40
BATCH_MAX_FAILED_BUILDS = 12  # tyle nieudanych buildow w serii wolno wydac na dzielenie paczek na pol
PRODUCT_MAX_TRIES = 3  # tyle nieudanych przebudow produktu; potem czeka na kolejna zmiane albo przeglad
PRODUCT_RETRY_SEC = 60.0
BRANDING_INTERVAL_DEFAULT_SEC = 300.0  # przeglad katalogow brandingu: wlasny rytm, nie co obieg produktow
BRANDING_DELAY_DEFAULT_SEC = 90.0  # zbieranie zgloszen w jedno uruchomienie potoku brandingu
BRANDING_BUSY_RC = 3  # rebuild-branding-pipeline.py: blokada brandingu zajeta
BRANDING_BUSY_RETRY_SEC = 300.0
BRANDING_FAIL_RETRY_SEC = 300.0  # potok skonczyl sie bledem (kod spoza 0 i 3) albo nie wystartowal
BRANDING_MAX_TRIES = 3  # tyle prob po bledzie, potem log i stan bledu w statusie
BRANDING_STUCK_SEC = 7200.0  # = TTL blokady potoku: po tym czasie zawieszony potok nie wstrzymuje kolejnych
# Migawka produktow: poddrzewa mierzone rownolegle (czas to opoznienia SMB, nie CPU). Pomiar M:
# 07.10.2026, 184 produkty: 1 watek 15-18 s, 4 watki 5-7 s, 8 watkow 4,1 s. Domyslnie 4: watcher dziala
# na KAZDYM komputerze z M:, 8 rownoleglych odczytow przez ok. 70% czasu obciazalo dysk wszystkim.
# 1 = po kolei jak dawniej. Po bledzie odczytu albo migawce dluzszej niz SNAPSHOT_SLOW_SEC watcher
# sam schodzi do 1 watku (ScanPace).
SNAPSHOT_WORKERS = max(1, min(16, int(_env_num("DAM_INDEX_SNAPSHOT_WORKERS", 4))))
SNAPSHOT_SLOW_SEC = _env_num("DAM_INDEX_SNAPSHOT_SLOW_SEC", 30.0)
SNAPSHOT_RECOVER_ROUNDS = 5  # tyle czystych migawek, zanim liczba watkow znow sie podwoi
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


def _log(msg: str) -> None:
    """Linia logu watchera ze znacznikiem czasu UTC (jak last_started w statusie i index_run).
    07.10.2026: log bez czasu nie pozwalal odtworzyc, kiedy watcher zobaczyl zmiane. Linie buildera
    ([live] ...) przechodza bez prefiksu: index_supervisor.parse_builder_live_line czyta je od poczatku."""
    line = f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} {msg}"
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        # stdout watchera to plik w kodowaniu systemu (cp1250): nazwa folderu spoza niego nie moze wywrocic petli
        print(line.encode("ascii", "backslashreplace").decode("ascii"), flush=True)


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
            _log(f"[watch] mark_built_here({key}) skip: {res}")
    except Exception as exc:  # noqa: BLE001
        _log(f"[watch] mark_built_here({key}) error: {exc}")


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


def _subdirs(path: str) -> list[str]:
    """Podkatalogi `path`. BLAD LISTOWANIA = wyjatek OSError (nie pusta lista): snapshot z dziurami
    (odmontowany dysk, zerwane SMB) wygladalby jak 'wszystkie produkty zniknely' i wyzwolilby
    pelny skan; petla glowna lapie OSError i po prostu pomija ten takt."""
    with os.scandir(path) as it:
        return [e.path for e in it if e.is_dir()]


def _measure(top: str, start_depth: int, max_depth: int) -> tuple[float, bool]:
    """(najnowszy mtime drzewa `top` do max_depth, czy folder `top` dalo sie odczytac).
    `top` lezy na glebokosci `start_depth` od rootu. False = stat albo listowanie SAMEGO `top` padlo
    (chwilowy blad SMB): wynik nie nadaje sie do porownan. Bledy glebiej sa pomijane jak dotad -
    trwale niedostepny podfolder nie moze na zawsze wylaczyc produktu z odswiezania.

    Wpisy do poziomu max_depth+1 (depth 5 od -DK: kat, produkt, wariant, 4-WIZKI,
    INTERNET-PREZENTACJE-RGB; depth 3 konczylo na wariancie i nie widzialo plikow w WIZKI), przez os.scandir:
    mtime wpisu pochodzi z samego listowania katalogu (na Windows bez dodatkowego zapytania
    na kazdy plik) - na SMB to polowa ruchu sieciowego co Path.iterdir()+stat()."""
    try:
        latest = os.stat(top).st_mtime
    except OSError:
        return 0.0, False
    readable = True
    stack = [(top, start_depth)]
    while stack:
        p, depth = stack.pop()
        if depth > max_depth:
            continue
        try:
            with os.scandir(p) as it:
                entries = list(it)
        except OSError:
            if p == top:
                readable = False
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
    return latest, readable


def _subtree_mtime(top: str, start_depth: int, max_depth: int) -> float:
    """Sam mtime (katalogi brandingu: 0.0 = niedostepne, baza sie nie cofa)."""
    return _measure(top, start_depth, max_depth)[0]


def roots_mtime(roots: list[Path], max_depth: int = 5) -> float:
    """Najnowszy mtime drzew `roots` do max_depth (0=root). Te same granice co dawny tree_mtime
    (Path.iterdir()+stat()+is_dir(): 14 971 wpisow brandingu = 76 s na M:), przez os.scandir: 10 s."""
    return max((_subtree_mtime(os.fspath(r), 0, max_depth) for r in roots), default=0.0)


def product_snapshot(
    roots: list[Path],
    max_depth: int = 5,
    *,
    prev: dict[str, float] | None = None,
    unreadable: set[str] | None = None,
    workers: int | None = None,
) -> dict[str, float]:
    """{folder produktu -> najnowszy mtime jego drzewa do max_depth}.

    Folder produktu = poziom 2 od rootu (root/kategoria/produkt); folder '— ARCHIWUM' kategorii
    tez jest takim kluczem (builder zamienia go na przebudowe kategorii). Na SMB plik gleboko
    w produkcie NIE podnosi mtime folderu produktu, dlatego przechodzimy do max_depth jak dotad,
    ale ZAPISUJEMY, ktory produkt sie zmienil. Dodany/zmieniony/usuniety produkt = inny
    wpis albo jego brak.

    Folder produktu, ktorego nie dalo sie odczytac (B3, 07.10.2026), NIE dostaje mtime 0.0: taki wpis
    wygladal jak zmiana, szedl do `--only-product`, a builder usuwal produkt ze spisu. Zostaje wartosc
    z `prev` (brak roznicy = brak przebudowy) albo wpisu nie ma; sciezka trafia do `unreadable`."""
    prods = [prod for root in roots for cat in _subdirs(os.fspath(root)) for prod in _subdirs(cat)]
    with ThreadPoolExecutor(max_workers=max(1, int(workers or SNAPSHOT_WORKERS))) as pool:
        measured = list(pool.map(lambda p: _measure(p, 2, max_depth), prods))
    snap: dict[str, float] = {}
    for prod, (mtime, readable) in zip(prods, measured):
        if readable:
            snap[prod] = mtime
            continue
        if unreadable is not None:
            unreadable.add(prod)
        if prev is not None and prod in prev:
            snap[prod] = prev[prod]
    return snap


def remeasure(
    snapshot: dict[str, float], keys: list[str], max_depth: int = 5, unreadable: set[str] | None = None
) -> None:
    """Zmierz ponownie TYLKO produkty `keys` i popraw migawke w miejscu (bez pelnego obiegu).
    Kategoria jest listowana jak w product_snapshot: blad listowania = OSError (zerwany dysk nie moze
    wygladac jak 'produkt usuniety'); produkt, ktorego nie ma juz w kategorii, wypada z migawki.
    Produkt, ktory JEST w kategorii, ale nie daje sie odczytac, zostaje bez zmian i trafia do `unreadable`."""
    by_cat: dict[str, list[str]] = {}
    for key in keys:
        by_cat.setdefault(os.path.dirname(key), []).append(key)
    for cat, prods in by_cat.items():
        present = set(_subdirs(cat))
        for prod in prods:
            if prod not in present:
                snapshot.pop(prod, None)
                continue
            mtime, readable = _measure(prod, 2, max_depth)
            if readable:
                snapshot[prod] = mtime
            elif unreadable is not None:
                unreadable.add(prod)


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


class ScanPace:
    """Tempo migawek produktow (B2, 07.10.2026). 8 watkow z przerwa 2 s = rownolegle odczyty dysku
    sieciowego przez ok. 70% czasu, na kazdym komputerze z M:.
    - przerwa = max(--interval, 2 x czas ostatniej migawki): migawki zajmuja najwyzej 1/3 czasu,
      a czas ciszy i przebudowy liczy sie do przerwy,
    - blad odczytu albo migawka dluzsza niz `slow_sec` = 1 watek (dysk jest zajety albo sie dusi);
      po SNAPSHOT_RECOVER_ROUNDS czystych migawkach liczba watkow sie podwaja, do `max_workers`."""

    def __init__(self, workers: int = SNAPSHOT_WORKERS, slow_sec: float = SNAPSHOT_SLOW_SEC) -> None:
        self.max_workers = max(1, int(workers))
        self.workers = self.max_workers
        self.slow_sec = float(slow_sec)
        self.last_sec = 0.0
        self.ended = 0.0
        self._clean = 0

    def backoff(self, why: str) -> None:
        if self.workers > 1:
            _log(f"[watch] migawka: {why} - schodze z {self.workers} do 1 watku")
        self.workers = 1
        self._clean = 0

    def record(self, duration: float, now: float, errors: int = 0) -> None:
        self.last_sec = max(0.0, float(duration))
        self.ended = now
        if errors:
            self.backoff(f"{errors} blad(ow) odczytu")
        elif self.last_sec > self.slow_sec:
            self.backoff(f"trwala {self.last_sec:.0f} s (limit {self.slow_sec:.0f} s)")
        elif self.workers < self.max_workers:
            self._clean += 1
            if self._clean >= SNAPSHOT_RECOVER_ROUNDS:
                self.workers = min(self.max_workers, self.workers * 2)
                self._clean = 0

    def pause(self, interval: float, now: float) -> float:
        return max(float(interval), 2.0 * self.last_sec - max(0.0, now - self.ended))


def diff_snapshots(old: dict[str, float], new: dict[str, float]) -> list[str]:
    """Foldery produktow, ktorych mtime sie zmienil, ktore doszly albo zniknely (posortowane)."""
    return sorted(k for k in set(old) | set(new) if old.get(k) != new.get(k))


class ChangeTracker:
    """Debounce PER PRODUKT: zmiana produktu jest 'gotowa' po `debounce_sec` ciszy W TYM produkcie
    (rename daje kilka skokow mtime w ciagu sekund; duze kopiowanie - dlugi ciag). Zmiany w innych
    produktach (ktos pracuje na M:) nie resetuja cudzego okna - stary, globalny debounce przy migawce
    trwajacej 14-22 s na SMB dawal 111-764 s od kliku F/X/D do przebudowy (pomiar 06.10.2026).
    Baza = snapshot z chwili WYKRYCIA (przed buildem), wiec zmiany z czasu buildu nie gina.
    Produkt zmieniany bez konca (dlugie kopiowanie, automat zapisujacy co chwile) jest gotowy po
    `max_wait_sec` od pierwszej zauwazonej zmiany - inaczej nie trafilby do spisu nigdy (0 = bez limitu)."""

    def __init__(
        self,
        baseline: dict[str, float],
        debounce_sec: float = DEBOUNCE_DEFAULT_SEC,
        max_wait_sec: float = DEBOUNCE_MAX_DEFAULT_SEC,
    ) -> None:
        self.baseline = dict(baseline)
        self.debounce = float(debounce_sec)
        self.max_wait = float(max_wait_sec)
        self._pending: dict[str, float] | None = None
        self._changed_at: dict[str, float] = {}
        self._first_at: dict[str, float] = {}

    @property
    def seen(self) -> dict[str, float]:
        """Ostatnio widziany stan (oczekujaca migawka albo baza) - wartosc dla nieczytelnego produktu."""
        return self._pending if self._pending is not None else self.baseline

    @property
    def pending(self) -> bool:
        return self._pending is not None

    def observe(self, snapshot: dict[str, float], now: float) -> list[str] | None:
        if snapshot == self.baseline:
            self._pending = None
            self._changed_at = {}
            self._first_at = {}
            return None
        prev = self._pending if self._pending is not None else self.baseline
        for k in set(prev) | set(snapshot):
            if prev.get(k) != snapshot.get(k):
                self._changed_at[k] = now
        self._pending = dict(snapshot)
        changed = diff_snapshots(self.baseline, snapshot)
        self._first_at = {k: self._first_at.get(k, now) for k in changed}
        ready = [
            k
            for k in changed
            if now - self._changed_at.get(k, now) >= self.debounce
            or (self.max_wait > 0 and now - self._first_at[k] >= self.max_wait)
        ]
        return ready or None

    def mark_built(self, snapshot: dict[str, float], keys: list[str] | None = None) -> None:
        """Po buildzie: cala migawka (pelny skan) albo tylko zbudowane produkty `keys` (przyrost) -
        reszta zmian czeka dalej na swoja cisze."""
        if keys is None:
            self.baseline = dict(snapshot)
            self._pending = None
            self._changed_at = {}
            self._first_at = {}
            return
        for k in keys:
            if k in snapshot:
                self.baseline[k] = snapshot[k]
            else:
                self.baseline.pop(k, None)
            self._changed_at.pop(k, None)
            self._first_at.pop(k, None)
        if self._pending is not None and self._pending == self.baseline:
            self._pending = None


def settle(
    tracker: ChangeTracker,
    snapshot: dict[str, float],
    now: float,
    *,
    max_depth: int = 5,
    unreadable: set[str] | None = None,
) -> list[str] | None:
    """Debounce bez drugiego pelnego obiegu. Tracker uznaje zmiane za gotowa dopiero przy kolejnej
    obserwacji po czasie ciszy; kolejna obserwacja z pelnej migawki = caly obieg (07.10.2026: 85 s).
    Tu: odczekaj czas ciszy, zmierz ponownie TYLKO swiezo zmienione produkty (remeasure) i zapytaj
    tracker jeszcze raz. Produkt, ktory w tym czasie znow sie zmienil, czeka na nastepny obieg.
    OSError z remeasure = dysk zniknal: wolajacy pomija takt jak przy migawce.
    Produkt z `unreadable` (folder chwilowo nieczytelny, B3) nie jest gotowy w tym obiegu nigdy:
    przebudowa `--only-product` nieczytelnego folderu usuwa produkt ze spisu."""
    skip = unreadable if unreadable is not None else set()
    ready = tracker.observe(snapshot, now)
    waiting = [k for k in diff_snapshots(tracker.baseline, snapshot) if k not in (ready or ()) and k not in skip]
    if waiting:
        time.sleep(tracker.debounce)
        # usuniete produkty (brak w migawce) znamy z pelnego listowania - nie ma czego mierzyc
        remeasure(snapshot, [k for k in waiting if k in snapshot], max_depth, skip)
        ready = tracker.observe(snapshot, time.time())
    ready = [k for k in ready or [] if k not in skip]
    return ready or None


def plan_rebuild(changed: list[str], max_incremental: int = INCREMENTAL_MAX_DEFAULT) -> list[list[str]]:
    """Paczki przyrostowe po najwyzej `max_incremental` produktow. [] = pelny skan (brak listy zmian
    albo przyrost wylaczony: max_incremental 0). 07.10.2026: 41 zmian naraz dawalo pelny skan
    29,6 min z zamrozonym wykrywaniem, a przyrost 23 produktow trwa 5,9 s."""
    if max_incremental <= 0:
        return []
    return [changed[i : i + max_incremental] for i in range(0, len(changed), max_incremental)]


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
                _log(f"[watch] corrupt status moved to {path.name}.corrupt")
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
                "last_incremental_batches",
                "last_incremental_failed",
                "last_incremental_changed",
                "last_review_at",
                "last_review_sec",
                "last_review_products",
                "last_review_failed",
                "last_review_skipped",
                "last_review_changes",
                "index_failed_products",
                "index_failed_at",
                "index_unreachable_at",
                "branding_hook_pid",
                "branding_hook_at",
                "branding_hook_state",
                "branding_hook_rc",
                "branding_hook_error",
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


def _merge_status(path: Path, fields: dict) -> None:
    """Dopisz pola do statusu BEZ ruszania reszty (stage, kind, postep). S3, 07.10.2026: watek brandingu
    zapisywal caly status ze stage "branding_hook_spawned" w dowolnej chwili, takze w trakcie przebudowy
    produktow, a index_supervisor._progress_from_watcher rozpoznaje bieg po stage."""
    with _status_lock():
        body = _read_status(path)
        body.update(fields)
        _write_status_locked(path, body, preserve_last=False)


class BrandingHook:
    """Potok brandingu we WLASNYM rytmie (watek "dam-branding-watch"): obieg produktow na niego nie czeka.

    - katalogi brandingu przegladane co `interval` s (07.10.2026: przeglad w kazdym obiegu petli
      glownej wydluzal obieg z 2 s do 85 s),
    - zgloszenia (zmiana w katalogach brandingu, udana przebudowa produktow) zbierane przez `delay` s
      w JEDNO uruchomienie; liczone od pierwszego zgloszenia, wiec ciagla praca nie glodzi potoku,
    - zgloszenie z czasu trwania potoku = jeden przebieg po jego zakonczeniu; kod 3 (blokade trzyma
      ktos inny, np. most) = powtorka za BRANDING_BUSY_RETRY_SEC. Dawniej 23 z 33 uruchomien konczylo
      sie kodem 3 i zmiana przepadala,
    - kazdy inny kod niz 0 i 3 (blad potoku, rc=None po bledzie czekania, nieudany start) = powtorka za
      BRANDING_FAIL_RETRY_SEC, najwyzej BRANDING_MAX_TRIES prob; potem log i stan bledu w statusie.
      Bez tego zmiana ginela: mtime katalogow juz przesuniete, wiec nic nie ponawialo do kolejnej
      niezaleznej zmiany albo skanu awaryjnego (do 6 h),
    - kazde uruchomienie ma numer: koniec STAREGO potoku (uznanego za zawieszony po BRANDING_STUCK_SEC)
      nie zeruje stanu nowego.
    request() i koniec potoku przychodza z innych watkow niz tick(), stad blokada."""

    def __init__(
        self,
        spawn,
        *,
        roots: list[Path] | None = None,
        depth: int = 5,
        interval: float = BRANDING_INTERVAL_DEFAULT_SEC,
        delay: float = BRANDING_DELAY_DEFAULT_SEC,
        report=None,
    ) -> None:
        self._spawn = spawn  # spawn(on_done) -> bool (czy proces wystartowal); on_done(rc) po jego koncu
        self._report = report  # report(pola): pola branding_hook_* do statusu, bez zmiany stage
        self.roots = list(roots or [])
        self.depth = int(depth)
        self.interval = float(interval)
        self.delay = float(delay)
        self._lock = threading.Lock()
        self._due: float | None = None  # kiedy ma ruszyc potok; None = nic do zrobienia
        self._running = False
        self._started = 0.0
        self._run_id = 0
        self._retry: float | None = None  # powtorka po tylu sekundach (ustawia koniec potoku, liczy tick)
        self._fails = 0
        self._last_mtime: float | None = None
        self._next_scan = 0.0

    def request(self, now: float) -> None:
        with self._lock:
            if self._due is None:
                self._due = now + self.delay

    def _tell(self, fields: dict) -> None:
        if self._report is None:
            return
        try:
            self._report(fields)
        except Exception as exc:  # noqa: BLE001
            _log(f"[watch] branding hook: zapis statusu nieudany: {exc}")

    def _done(self, rc: int | None, run_id: int | None = None) -> None:
        gave_up = False
        tries = 0
        with self._lock:
            if run_id is not None and run_id != self._run_id:
                return  # koniec starego potoku: biegnie juz nastepny
            self._running = False
            if rc == 0:
                self._fails = 0
            elif rc == BRANDING_BUSY_RC:
                self._retry = BRANDING_BUSY_RETRY_SEC
            else:
                self._fails += 1
                tries = self._fails
                if tries < BRANDING_MAX_TRIES:
                    self._retry = BRANDING_FAIL_RETRY_SEC
                else:
                    self._fails = 0
                    gave_up = True
        if rc == 0:
            self._tell({"branding_hook_state": "ok", "branding_hook_rc": 0, "branding_hook_error": ""})
        elif gave_up:
            msg = f"potok brandingu: {BRANDING_MAX_TRIES} nieudane proby (ostatni kod {rc})"
            _log(f"[watch] branding hook: {msg} - rezygnuje do kolejnego zgloszenia")
            self._tell({"branding_hook_state": "failed", "branding_hook_rc": rc, "branding_hook_error": msg})
        elif rc != BRANDING_BUSY_RC:
            _log(
                f"[watch] branding hook: potok nieudany (kod {rc}), proba {tries}/{BRANDING_MAX_TRIES}"
                f" - powtorka za {BRANDING_FAIL_RETRY_SEC:.0f} s"
            )

    def tick(self, now: float) -> bool:
        """Jeden takt watku brandingu. True = potok wystartowal."""
        if self.roots and now >= self._next_scan:
            self._next_scan = now + self.interval
            cur = roots_mtime(self.roots, max_depth=self.depth)
            if self._last_mtime is not None and cur > self._last_mtime:
                _log(f"[watch] branding change {self._last_mtime:.0f} -> {cur:.0f}")
                self.request(now)
            # pierwszy przeglad = baza; 0.0 (dysk niedostepny) jej nie cofa
            self._last_mtime = max(cur, self._last_mtime or 0.0)
        with self._lock:
            if self._retry is not None:
                # ponytail: powtorka co staly odstep zamiast czytania cudzej blokady; gdy 5 min
                # zwloki po cudzym przebiegu bedzie za duzo - czytac branding-rebuild.lock.json
                self._due = now + self._retry
                self._retry = None
            if self._running and now - self._started >= BRANDING_STUCK_SEC:
                # czekamy do konca procesu (znacznik), ale zawieszony potok nie moze zablokowac brandingu na zawsze
                _log(f"[watch] branding hook: potok trwa ponad {BRANDING_STUCK_SEC:.0f} s - dopuszczam kolejny")
                self._running = False
            if self._running or self._due is None or now < self._due:
                return False
            self._due = None
            self._running = True
            self._started = now
            self._run_id += 1
            run_id = self._run_id
        started = False
        try:
            started = bool(self._spawn(lambda rc, _id=run_id: self._done(rc, _id)))
        finally:
            if not started:
                self._done(None, run_id)  # nieudany start = blad potoku: powtorka, najwyzej 3 proby
        return started


_BRANDING_HOOK: BrandingHook | None = None  # ustawia main(); None (--once, testy) = start od razu


def _snoozed() -> bool:
    try:
        import index_supervisor

        return bool(index_supervisor.is_snoozed())
    except Exception:  # noqa: BLE001
        return False


def _branding_loop(hook: BrandingHook, pause: float = 5.0) -> None:
    while True:
        try:
            if not _snoozed():
                hook.tick(time.time())
        except Exception as exc:  # noqa: BLE001
            _log(f"[watch] branding watch error: {exc}")
        time.sleep(pause)


def _start_branding_watch(hook: BrandingHook) -> None:
    threading.Thread(target=_branding_loop, args=(hook,), daemon=True, name="dam-branding-watch").start()


def spawn_branding_pipeline(*, status_file: Path | None = None, on_done=None) -> bool:
    """Uruchom potok brandingu fat+grid (ta sama blokada co POST /branding/rebuild).
    True = proces wystartowal; on_done(rc) wola watek czekajacy na jego koniec."""
    # 29.09.2026: trzecia sierota rebuild-branding-pipeline.py po przebiegu testow -
    # testy importuja ten modul. Pod unittest prawdziwej przebudowy nie odpalamy
    # (ten sam bezpiecznik co index_supervisor._real_spawn_blocked_in_tests).
    if "unittest" in sys.modules and os.environ.get("DAM_ALLOW_REAL_SPAWN_IN_TESTS", "").strip() != "1":
        _log("[watch] branding hook skip: test_spawn_blocked")
        return False
    if not BRANDING_PIPELINE.is_file():
        _log(f"[watch] branding hook skip: missing {BRANDING_PIPELINE}")
        return False
    try:
        py = _script_python()
        try:
            from branding_publish import resolve_script_python

            py = resolve_script_python(require_ijson=True)
        except RuntimeError as exc:
            _log(f"[watch] branding hook FAIL ijson: {exc}")
            if status_file is not None:
                _merge_status(status_file, {"branding_hook_state": "failed", "branding_hook_error": str(exc)})
            return False
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        proc = subprocess.Popen(
            [py, str(BRANDING_PIPELINE)],
            cwd=str(BIN_ROOT),
            creationflags=flags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        _log(f"[watch] branding hook spawned pid={proc.pid} via {py}")
        if status_file is not None:
            _merge_status(
                status_file,
                {
                    "branding_hook_pid": proc.pid,
                    "branding_hook_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "branding_hook_state": "running",
                    "branding_hook_error": "",
                },
            )

        def _wait_and_mark(p: subprocess.Popen) -> None:
            # rebuild-branding-pipeline.py zwraca 0 TYLKO gdy fat (build-branding-index.py,
            # ktory pisze branding-search-index.json bezwarunkowo - patrz jego glowny
            # zapis) I grid (build-branding-grid-index.py) obie sie udaly - kazdy
            # blad czesciowy propaguje sie jako rc != 0 (sprawdzone w tym skrypcie).
            # Bez limitu czasu: skan trwa 21-56 min, a limit 1800 s konczyl czekanie przed koncem
            # i branding-search-index / campaigns nie dostawaly znacznika (07.10.2026).
            rc = None
            try:
                rc = p.wait()
            except Exception as exc:  # noqa: BLE001
                _log(f"[watch] branding hook wait error: {exc}")
            if rc == 0:
                _mark_built_here_safe("branding-search-index", WEB_DATA / "branding-search-index.json")
                # Ten sam fat build pisze campaigns.json - bez znacznika plik nigdy nie
                # trafialby do bazy (refused_not_built_here). Jak w local_bridge 28.09.
                _mark_built_here_safe("campaigns", WEB_DATA / "campaigns.json")
                _log("[watch] branding hook finished rc=0 - oznaczone built_here")
            else:
                _log(f"[watch] branding hook finished rc={rc} - nie oznaczam built_here")
            if on_done is not None:
                on_done(rc)

        threading.Thread(target=_wait_and_mark, args=(proc,), daemon=True,
                          name="dam-branding-hook-wait").start()
        return True
    except Exception as exc:  # noqa: BLE001
        _log(f"[watch] branding hook spawn error: {exc}")
        return False


def _publish_cache_after_index() -> None:
    # Pod unittest prawdziwej publikacji nie odpalamy (ten sam bezpiecznik co spawn_branding_pipeline):
    # 07.10.2026 test petli doszedl tu bez atrapy i watek publikacji zaczal odpytywac magazyn na NAS.
    if "unittest" in sys.modules and os.environ.get("DAM_ALLOW_REAL_SPAWN_IN_TESTS", "").strip() != "1":
        _log("[watch] cache publish skip: test_spawn_blocked")
        return
    try:
        import dam_thumb_cache

        dam_thumb_cache.start_publish_after_index()
        _log("[watch] cache publish queued")
    except Exception as exc:  # noqa: BLE001
        _log(f"[watch] cache publish skip: {exc}")


def _finish_run(*, report: bool, publish: bool, ok: bool, rc: int | None, mode: str) -> dict | None:
    """Zamkniecie przebiegu: raport (index-last-report.json) i publikacja miniatur - RAZ na serie paczek
    (S4: kazda paczka przepisywala 6,8 MB migawki przebiegu i kolejkowala publikacje miniatur).
    Zwraca raport (liczniki zmian w spisie) albo None, gdy go nie bylo."""
    result = None
    if report:
        try:
            import index_supervisor as idx_sup
        except ImportError:
            idx_sup = None  # type: ignore
        if idx_sup is not None:
            try:
                result = idx_sup.complete_run_report(ok=ok, cancelled=(rc == 130), rc=rc, mode=mode)
            except Exception:
                pass
    if publish:
        _publish_cache_after_index()
    return result if isinstance(result, dict) else None


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
    begin_run: bool = True,
    end_run: bool = True,
    result: dict | None = None,
) -> int:
    """Acquire shared lock, then run build-file-index. No scan before lock.

    only_products: tryb przyrostowy (--only-product ... --merge-into file-index.json) - jedna
    blokada, jeden build; czas przyrostu NIE nadpisuje last_duration_sec pelnego skanu.
    begin_run / end_run: pierwsza i ostatnia paczka serii (migawka przebiegu na poczatku, raport
    i publikacja miniatur na koncu); srodkowe paczki ida z False / False.
    result: slownik, do ktorego trafia result["unchanged"] = True, gdy indekser wypisal MERGE_UNCHANGED
    (przyrost niczego nie zmienil i NIE zapisal spisu): wtedy nie ma znacznika 'zbudowane tutaj',
    zgloszenia do haka brandingu ani publikacji miniatur - brak zmian = brak publikacji."""
    try:
        from rebuild_lock import acquire_lock
    except ImportError:
        acquire_lock = None  # type: ignore
    try:
        import index_supervisor as idx_sup
    except ImportError:
        idx_sup = None  # type: ignore

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
            _log("[watch] skip rebuild: lock held")
            return 2
    else:
        lock_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(str(lock_file), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, b'{"pid":%d}' % os.getpid())
            os.close(fd)
        except FileExistsError:
            _log("[watch] skip rebuild: lock held (fallback)")
            return 2

    # Migawka przebiegu dopiero PO zdobyciu blokady i raz na serie paczek: dawniej 6,8 MB
    # index-run-snapshot.json szlo na dysk przy kazdej paczce i przy kazdej probie z zajeta blokada.
    if idx_sup is not None and begin_run:
        try:
            idx_sup.begin_run_snapshot()
        except Exception:
            pass

    py = _script_python()
    incremental = bool(only_products)
    merge_into = ((out_dir / "file-index.json") if out_dir is not None else (WEB_DATA / "file-index.json")) if incremental else None
    cmd = build_command(py, root_args, out_dir, only_products=only_products, merge_into=merge_into)

    started_ts = time.time()
    started_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    kind = "hourly" if stage_prefix == "hourly" else ("watch" if stage_prefix == "product" else stage_prefix)
    mode = "full"  # rodzaj przebiegu w statusie, logu i raporcie: full | incremental | review
    if incremental:
        mode = "review" if stage_prefix == "review" else "incremental"
        kind = mode
        # Orientacyjny czas: ~10 s stalych (wczytanie/zapis indeksu, wzbogacanie) + ~12 s na produkt.
        # NIE bierzemy last_duration_sec pelnego skanu (54 min), bo pasek stalby na 1%.
        last_duration_sec_eta = 10 + 12 * len(only_products or [])
    else:
        last_duration_sec_eta = last_duration_sec
    msg_building = (
        "Indeksowanie ROOT" if stage_prefix == "hourly"
        else (f"Indeksowanie zmienionych produktow ({len(only_products or [])})" if incremental else "Indeksowanie")
    )
    if mode == "review":
        msg_building = f"Przeglad godzinny ({len(only_products or [])} produktow)"
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
                "rebuild_mode": mode,
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
            "rebuild_mode": mode,
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

    seen = {"unchanged": False}

    def _read_builder_stdout() -> None:
        if proc.stdout is None:
            return
        for line in proc.stdout:
            if str(line).startswith("MERGE_UNCHANGED"):
                seen["unchanged"] = True
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

    reader = threading.Thread(target=_read_builder_stdout, daemon=True, name="dam-index-live")
    reader.start()

    if idx_sup is not None:
        rc = idx_sup.wait_rebuild_proc(proc, lock_handle=handle, on_tick=_tick)
    else:
        rc = int(proc.wait())

    reader.join(timeout=5.0)  # koniec procesu = koniec potoku: ostatnie linie (MERGE_UNCHANGED) sa juz przeczytane
    unchanged = incremental and rc == 0 and seen["unchanged"]
    if result is not None:
        result["unchanged"] = unchanged
    duration = int(time.time() - started_ts)
    cancelled = rc == 130
    needs_full = incremental and rc == NEEDS_FULL_RC
    if incremental and rc == UNREACHABLE_RC:
        # Chwilowy blad dysku, nie porazka przebudowy: bez last_ok=False (pulpit nie ma mrugac
        # "aktualizacja nie dziala" przy kazdym zerwaniu SMB); wolajacy ponowi paczke po zwloce.
        _write_status(
            status_file,
            {
                "ok": True,
                "watcher_ok": True,
                "stage": f"{stage_prefix}:unreachable",
                "rebuild_kind": kind,
                "rebuild_mode": mode,
                "progress_message": "Folder produktu chwilowo nieosiagalny - ponowie za chwile",
            },
        )
    elif needs_full:
        # Nie jest to porazka: wolajacy (rebuild_changed) zaraz zrobi pelny skan. Bez last_ok=False,
        # zeby pulpit nie mrugnal "aktualizacja nie dziala" miedzy przyrostem a pelnym skanem.
        _write_status(
            status_file,
            {
                "ok": True,
                "watcher_ok": True,
                "stage": f"{stage_prefix}:fallback_full",
                "rebuild_kind": kind,
                "rebuild_mode": mode,
                "progress_message": "Przyrost niemozliwy - pelny skan",
            },
        )
    else:
        # czas i liczbe produktow przyrostu zapisuje rebuild_changed: raz, dla calej serii paczek
        done_fields = {} if incremental else {"last_duration_sec": duration if rc == 0 else last_duration_sec}
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
                "index_unchanged": unchanged,
                "rebuild_kind": kind,
                "rebuild_mode": mode,
            },
        )
    if rc == 0 and not incremental and out_dir is None:
        _mark_full_scan_done(status_file)
    if handle is not None:
        handle.release()
    if end_run and not needs_full:
        _finish_run(report=True, publish=False, ok=(rc == 0), rc=rc, mode=mode)
    if rc == 0 and out_dir is None and not unchanged:
        # Przyrost bez zmian (MERGE_UNCHANGED) nie zapisal spisu: znacznik zostaje, jaki byl - plik pobrany
        # z bazy nie moze przez sam przeglad stac sie 'zbudowanym tutaj'.
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
    if rc == 0 and branding_hook and out_dir is None and not unchanged:
        if _BRANDING_HOOK is not None:
            _BRANDING_HOOK.request(time.time())  # debounce + powtorka: watek brandingu
        else:
            spawn_branding_pipeline(status_file=status_file)
    if rc == 0 and out_dir is None and end_run and not unchanged:
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
    stage_prefix: str = "product",
    begin_run: bool = True,
    end_run: bool = True,
    publish: bool = True,
    info: dict | None = None,
) -> tuple[int, str, list[str]]:
    """Przebuduj zmienione produkty przyrostowo, paczkami po najwyzej `max_incremental`; pelny skan
    tylko gdy builder zwroci kod 5 (przyrost niemozliwy) albo przyrost jest wylaczony.
    Zwraca (rc, 'incremental' | 'full', produkty zbudowane przyrostowo). rc 0 = wszystko zbudowane;
    rc 2 = blokada zajeta, rc 130 = anulowano, rc 6 = folder nieosiagalny (reszta serii nie ruszyla,
    nic nie jest dzielone - to stan dysku, nie wina produktu); inny rc = kod pierwszej nieudanej
    paczki, a nieudane produkty to `changed` minus zbudowane.

    Paczka z bledem (S1, 07.10.2026) nie zatrzymuje nastepnych: jest dzielona na pol, az blad zostanie
    przy jednym produkcie; dawniej jeden trujacy produkt blokowal wszystkie paczki po nim w kazdej probie.
    Na dzielenie wolno wydac BATCH_MAX_FAILED_BUILDS nieudanych buildow (blad calego buildera nie moze
    zamienic 40 produktow w 79 buildow).

    begin_run / end_run / publish: seria paczek ma JEDNA migawke przebiegu, JEDEN raport i JEDNA publikacje
    miniatur (S4); przeglad godzinny sklada serie z kilku wywolan i zamyka ja sam (_finish_run).
    info["changed_builds"]: ile paczek NAPRAWDE zmienilo spis (indekser nie wypisal MERGE_UNCHANGED).
    Zbudowane bez zmian tez sa w `built` (stan potwierdzony), ale publikacji miniatur nie budza."""
    common = dict(
        lock_file=lock_file,
        status_file=status_file,
        root_args=root_args,
        out_dir=out_dir,
        branding_hook=branding_hook,
        last_duration_sec=last_duration_sec,
    )
    started = time.time()
    queue = plan_rebuild(changed, max_incremental)
    need_full = not queue  # przyrost wylaczony
    built: list[str] = []
    builds = failed_builds = first_err = stop_rc = changed_builds = 0
    while queue:
        batch = queue.pop(0)
        outcome: dict = {}
        rc = rebuild_with_lock(
            **common,
            stage_prefix=stage_prefix,
            only_products=batch,
            begin_run=begin_run and builds == 0,
            end_run=False,
            result=outcome,
        )
        if rc == 2:
            stop_rc = rc
            break
        builds += 1
        if rc == 0:
            built += batch
            changed_builds += not outcome.get("unchanged")
        elif rc == NEEDS_FULL_RC:
            need_full = True
            break
        elif rc in (130, UNREACHABLE_RC):
            stop_rc = rc
            break
        else:
            first_err = first_err or rc
            failed_builds += 1
            if len(batch) > 1 and failed_builds < BATCH_MAX_FAILED_BUILDS:
                mid = len(batch) // 2
                queue[:0] = [batch[:mid], batch[mid:]]
                _log(f"[watch] paczka {len(batch)} produktow nieudana (rc={rc}) - dziele na pol")
            else:
                shown = ", ".join(Path(p).name for p in batch[:3]) + (" ..." if len(batch) > 3 else "")
                _log(f"[watch] przebudowa nieudana (rc={rc}): [{shown}]")
    if need_full:
        _log("[watch] przyrost niemozliwy (rc=5) - pelny skan ROOT" if builds else "[watch] przyrost wylaczony - pelny skan ROOT")
        return rebuild_with_lock(**common, begin_run=begin_run and builds == 0), "full", built
    rc = stop_rc or first_err
    if info is not None:
        info["changed_builds"] = changed_builds
    if builds:
        failed = len(changed) - len(built)
        if end_run:
            _merge_status(
                status_file,
                {
                    "last_incremental_sec": int(time.time() - started),
                    "last_incremental_products": len(built),
                    "last_incremental_batches": builds,
                    "last_incremental_failed": failed,
                    "last_incremental_changed": changed_builds,
                },
            )
        _finish_run(
            report=end_run,
            publish=publish and changed_builds > 0 and out_dir is None,
            ok=(rc == 0),
            rc=rc,
            mode="review" if stage_prefix == "review" else "incremental",
        )
    return rc, "incremental", built


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


def _mark_review_done(status_file: Path) -> None:
    """Zapisz moment ostatniego przegladu godzinnego (ten sam plik co pelny skan, osobny klucz):
    po restarcie programu przeglad liczy sie od niego, nie od startu."""
    target = _last_full_file(status_file)
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    data["review_epoch"] = time.time()
    try:
        target.write_text(json.dumps(data), encoding="utf-8")
    except OSError:
        pass


def read_last_review_epoch(status_file: Path) -> float:
    try:
        data = json.loads(_last_full_file(status_file).read_text(encoding="utf-8"))
        return float(data.get("review_epoch") or 0.0)
    except (OSError, ValueError, TypeError, AttributeError):
        return 0.0


def read_last_full_epoch(status_file: Path, index_file: Path) -> float:
    """Epoka ostatniego pelnego skanu albo 0.0 (brak indeksu = zrob pelny skan jak dotad).
    Brak zapisu przy zdrowym indeksie (pierwszy start po aktualizacji 2.5.4) = czas modyfikacji
    indeksu: 06.10.2026 kazdy komputer po instalacji dostawal 30-50 min pelnego skanu 4 min po starcie."""
    try:
        if not index_file.is_file() or index_file.stat().st_size < 1024:
            return 0.0
        last_full = _last_full_file(status_file)
        if not last_full.is_file():
            return float(index_file.stat().st_mtime)
        data = json.loads(last_full.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not data.get("finished_epoch"):
            # plik zalozony przez przeglad godzinny (sam review_epoch) na komputerze, ktory nie mial jeszcze
            # zapisu pelnego skanu: to nadal 'brak zapisu przy zdrowym indeksie', a nie 'pelnego skanu nie bylo'
            # (0.0 = pelny skan 20 s po kazdym starcie programu)
            return float(index_file.stat().st_mtime)
        return float(data["finished_epoch"])
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
        default=_env_num("DAM_INDEX_HOURLY_SEC", HOURLY_DEFAULT_SEC),
        help="Przebieg awaryjny: PELNY skan ROOT co N sekund od ostatniego pelnego skanu "
        "(0 = wylacz). Domyslnie 21600 (6 h); zwykle zmiany obsluguje tryb przyrostowy.",
    )
    ap.add_argument(
        "--review",
        type=float,
        default=_env_num("DAM_INDEX_REVIEW_SEC", REVIEW_DEFAULT_SEC),
        help="Przeglad godzinny: co N sekund od ostatniego przegladu albo pelnego skanu wszystkie produkty "
        "ida przez przebudowe przyrostowa w paczkach, z wykrywaniem zmian miedzy paczkami (0 = wylacz).",
    )
    ap.add_argument(
        "--debounce",
        type=float,
        default=_env_num("DAM_INDEX_DEBOUNCE_SEC", DEBOUNCE_DEFAULT_SEC),
        help="Sekundy ciszy po ostatniej zmianie mtime, zanim ruszy przebudowa (rename = kilka skokow).",
    )
    ap.add_argument(
        "--debounce-max",
        type=float,
        default=_env_num("DAM_INDEX_DEBOUNCE_MAX_SEC", DEBOUNCE_MAX_DEFAULT_SEC),
        help="Gorny limit czekania na cisze: produkt zmieniany bez konca jest przebudowywany po tylu "
        "sekundach od pierwszej zmiany (0 = bez limitu).",
    )
    ap.add_argument(
        "--incremental-max",
        type=int,
        default=INCREMENTAL_MAX_DEFAULT,
        help="Wielkosc paczki przyrostowej; wiecej zmian = kolejne paczki. 0 = bez przyrostu (pelny skan).",
    )
    ap.add_argument(
        "--branding-interval",
        type=float,
        default=_env_num("DAM_BRANDING_INTERVAL_SEC", BRANDING_INTERVAL_DEFAULT_SEC),
        help="Co ile sekund przegladac katalogi brandingu (osobny watek, niezaleznie od obiegu produktow).",
    )
    ap.add_argument(
        "--branding-delay",
        type=float,
        default=_env_num("DAM_BRANDING_DELAY_SEC", BRANDING_DELAY_DEFAULT_SEC),
        help="Sekundy zbierania zgloszen (zmiana brandingu, przebudowa produktow) przed startem potoku brandingu.",
    )
    ap.add_argument(
        "--first-delay",
        type=float,
        default=_env_num("DAM_INDEX_FIRST_DELAY_SEC", 20.0),
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
    _log(
        f"[watch] base={base} product_roots={len(product_roots)} "
        f"branding_roots={len(branding_roots)} interval={args.interval}s depth={depth}"
    )
    for r in product_roots:
        _log(f"[watch]   product {r}")
    for r in branding_roots:
        _log(f"[watch]   branding {r}")

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
    tracker = ChangeTracker(start_snap, args.debounce, args.debounce_max)
    if saved_baseline is not None:
        _log(f"[watch] baza zmian z poprzedniej sesji: {len(saved_baseline)} produktow (zmiany z czasu przerwy -> przyrost)")
    if branding_hook:
        global _BRANDING_HOOK
        _BRANDING_HOOK = BrandingHook(
            lambda on_done: spawn_branding_pipeline(status_file=args.status_file, on_done=on_done),
            roots=branding_roots,
            depth=depth,
            interval=args.branding_interval,
            delay=args.branding_delay,
            report=lambda fields: _merge_status(args.status_file, fields),
        )
        _start_branding_watch(_BRANDING_HOOK)
    if not args.no_initial:
        _log("[watch] initial rebuild...")
        rc = rebuild_with_lock(
            lock_file=args.lock_file,
            status_file=args.status_file,
            root_args=root_args,
            out_dir=args.out_dir,
            branding_hook=branding_hook,
        )
        if rc == 0:
            seed_last_full = time.time()  # inaczej przebieg awaryjny ruszal 20 s po skanie startowym
            if product_roots:
                save_baseline(args.status_file, product_roots, tracker.baseline)
            _log("[watch] initial OK")
        else:
            _log(f"[watch] initial rebuild failed rc={rc} - dalej monitoruje")
    else:
        _log("[watch] --no-initial: monitor only")
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

    loop_started = time.time()
    retry_after = 0.0
    hold: dict[str, float] = {}  # produkt -> nie wczesniej niz (po nieudanej przebudowie)
    tries: dict[str, int] = {}  # produkt -> ile nieudanych przebudow z rzedu
    pace = ScanPace()
    seen_unreadable: set[str] = set()
    last_hourly = seed_last_full
    review: dict | None = None  # trwajacy przeglad godzinny (kolejka paczek i licznik)
    review_sec = float(args.review or 0)
    if args.no_incremental or args.incremental_max <= 0:
        review_sec = 0.0  # przeglad idzie droga przyrostowa; bez niej zostaje pelny skan awaryjny
    # liczony od ostatniego udanego przegladu ALBO pelnego skanu; 0 = indeksu jeszcze nie ma (pelny skan)
    last_review = max(seed_last_full, read_last_review_epoch(args.status_file)) if seed_last_full > 0 else 0.0
    if review_sec > 0 and last_review > 0:
        _log(
            f"[watch] ostatni przeglad produktow {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(last_review))} "
            f"- nastepny przeglad godzinny po {review_sec / 60.0:.0f} min od niego"
        )
    if last_hourly > 0:
        _log(
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
        time.sleep(max(1.0, pace.pause(args.interval, time.time())))
        snoozed = _snoozed()
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
            _log(f"[watch] pelny skan ROOT (awaryjny, co {hourly_sec / 3600.0:.1f} h)...")
            _write_status(
                args.status_file,
                {
                    "ok": True,
                    "watcher_ok": True,
                    "stage": "hourly:queued",
                    "rebuild_kind": "hourly",
                    "rebuild_mode": "full",
                    "kind": "hourly",
                    "pid": os.getpid(),
                },
            )
            try:
                pre_snap = (
                    product_snapshot(product_roots, max_depth=depth, prev=tracker.seen, workers=pace.workers)
                    if product_roots
                    else {}
                )
            except OSError as exc:
                _log(f"[watch] snapshot przed pelnym skanem nieudany ({exc}) - baza z konca skanu")
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
                        pre_snap = product_snapshot(
                            product_roots, max_depth=depth, prev=tracker.seen, workers=pace.workers
                        )
                    except OSError:
                        pre_snap = None
                if pre_snap is not None:
                    tracker.mark_built(pre_snap)
                    if product_roots:
                        save_baseline(args.status_file, product_roots, pre_snap)
                tries.clear()
                hold.clear()
                last_review = last_hourly  # pelny skan obejmuje wszystkie produkty
                review = None
                _log("[watch] pelny skan OK")
            elif rc == 130:
                _log("[watch] pelny skan anulowany")
            else:
                _log(f"[watch] pelny skan nieudany rc={rc}")
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
        unreadable: set[str] = set()
        t0 = time.time()
        try:
            cur_snap = (
                product_snapshot(
                    product_roots, max_depth=depth, prev=tracker.seen, unreadable=unreadable, workers=pace.workers
                )
                if product_roots
                else {}
            )
            pace.record(time.time() - t0, time.time(), errors=len(unreadable))
            measured = len(unreadable)
            changed = (
                settle(tracker, cur_snap, time.time(), max_depth=depth, unreadable=unreadable)
                if product_roots
                else None
            )
            if len(unreadable) > measured:
                pace.backoff("blad odczytu przy ponownym pomiarze")
        except OSError as e:
            pace.backoff(f"blad odczytu ({e})")
            _log(f"[watch] skip: {e}")
            continue
        if unreadable != seen_unreadable:
            if unreadable:
                shown = ", ".join(sorted(Path(c).name for c in unreadable)[:3]) + (" ..." if len(unreadable) > 3 else "")
                _log(
                    f"[watch] nieczytelne foldery produktow: {len(unreadable)} [{shown}] - blad odczytu, "
                    "pomijam je w tym obiegu (bez przebudowy)"
                )
            seen_unreadable = set(unreadable)
        common = dict(
            lock_file=args.lock_file,
            status_file=args.status_file,
            root_args=root_args,
            out_dir=args.out_dir,
            branding_hook=branding_hook,
            last_duration_sec=last_duration,
        )
        now = time.time()
        changed = [c for c in changed or [] if hold.get(c, 0.0) <= now]
        if changed and now >= retry_after:
            shown = ", ".join(Path(c).name for c in changed[:3]) + (" ..." if len(changed) > 3 else "")
            _log(f"[watch] product change: {len(changed)} folder(s) [{shown}]; przyrost...")
            # w trakcie przegladu godzinnego zmiana nie otwiera wlasnego raportu: zamknie go przeglad
            in_review = review is not None and review["begun"]
            info: dict = {}
            rc, rb_kind, built = rebuild_changed(
                changed,
                **common,
                max_incremental=0 if args.no_incremental else args.incremental_max,
                begin_run=not in_review,
                end_run=not in_review,
                info=info,
            )
            if rc == 0 and rb_kind == "full":
                tracker.mark_built(cur_snap)
                # kazdy udany pelny skan przesuwa przebieg awaryjny (dawniej tylko galaz hourly: pelny skan
                # z 18:08 nie powstrzymal awaryjnego o 21:20 zamiast po 6 h) i przeglad godzinny
                last_hourly = last_review = time.time()
                review = None
                tries.clear()
                hold.clear()
            elif built:
                # przyrost: baza przesuwa sie tylko dla zbudowanych produktow; reszta czeka na swoja cisze
                tracker.mark_built(cur_snap, keys=built)
            done = set(built)
            for c in done:
                tries.pop(c, None)
                hold.pop(c, None)
            # nieudane produkty: kazdy ma wlasna zwloke i limit prob - nie wstrzymuja zmian w innych produktach
            failed = (
                [c for c in changed if c not in done]
                if (rb_kind == "incremental" and rc not in (0, 2, UNREACHABLE_RC, 130))
                else []
            )
            given_up: list[str] = []
            for c in failed:
                tries[c] = tries.get(c, 0) + 1
                if tries[c] >= PRODUCT_MAX_TRIES:
                    given_up.append(c)
                else:
                    hold[c] = time.time() + PRODUCT_RETRY_SEC
            if given_up:
                for c in given_up:
                    tries.pop(c, None)
                # baza przesunieta = watcher nie probuje dalej; produkt wroci przy kolejnej zmianie albo przegladzie
                tracker.mark_built(cur_snap, keys=given_up)
                shown = ", ".join(Path(c).name for c in given_up[:3]) + (" ..." if len(given_up) > 3 else "")
                _log(
                    f"[watch] {len(given_up)} produkt(ow) po {PRODUCT_MAX_TRIES} nieudanych przebudowach [{shown}] "
                    "- czekaja na kolejna zmiane albo przeglad"
                )
                _merge_status(
                    args.status_file,
                    {
                        "index_failed_products": [str(c) for c in given_up],
                        "index_failed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    },
                )
            if rc == 0 or built or given_up:
                save_baseline(args.status_file, product_roots, tracker.baseline)
            if rc == 0:
                what = "pelny skan" if rb_kind == "full" else "przyrost"
                same = "; bez zmian w spisie - nic nie zapisano" if (rb_kind != "full" and not info.get("changed_builds", 1)) else ""
                _log(f"[watch] rebuild OK ({what}; {len(built)} produktow przyrostowo{same})")
            elif failed:
                _log(
                    f"[watch] przyrost: {len(built)} zbudowanych, {len(failed)} nieudanych (rc={rc}); "
                    f"nieudane ponowie po {PRODUCT_RETRY_SEC:.0f} s, najwyzej {PRODUCT_MAX_TRIES} proby"
                )
            else:
                if rc == UNREACHABLE_RC:
                    # builder nie dosiegnal folderu: blad odczytu jak w migawce - mniej watkow, bez liczenia prob
                    pace.backoff("builder: folder nieosiagalny (kod 6)")
                    _merge_status(
                        args.status_file,
                        {"index_unreachable_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
                    )
                # blokada zajeta (2): ponow za chwile; kod 6 i blad pelnego skanu: nie mielimy w petli co 2 s
                retry_after = time.time() + (10.0 if rc == 2 else 60.0)
                _log(f"[watch] rebuild failed rc={rc} ({rb_kind}); ponowie po {retry_after - time.time():.0f} s")

        # --- przeglad godzinny: jedna paczka na obieg, zawsze PO zmianach z tego obiegu ---
        now = time.time()
        if (
            review is None
            and review_sec > 0
            and product_roots
            and last_review > 0
            and now - last_review >= review_sec
            and now - loop_started >= max(0.0, float(args.first_delay))
        ):
            prods = sorted(cur_snap)
            queue = plan_rebuild(prods, args.incremental_max)
            review = {
                "queue": queue,
                "batches": len(queue),
                "done": 0,
                "total": len(prods),
                "built": 0,
                "failed": [],
                "skipped": 0,
                "unreachable": 0,
                "changed": 0,
                "begun": False,
                "started": now,
            }
            _log(f"[watch] przeglad godzinny: {len(prods)} produktow w {len(queue)} paczkach (przyrostowo)...")
        if review is None or now < retry_after:
            continue
        if review["queue"]:
            batch_all = review["queue"].pop(0)
            # produkt, ktorego folderu nie dalo sie teraz odczytac albo ktory zniknal z migawki, jest POMIJANY:
            # przebudowa `--only-product` nieczytelnego folderu usunelaby go ze spisu (usuniecie obsluzy zmiana)
            batch = [p for p in batch_all if p in cur_snap and p not in unreadable]
            if batch:
                # bez zgloszenia do haka brandingu przy kazdej paczce: przeglad bez zmian nie moze co godzine
                # uruchamiac potoku brandingu (21-56 min, dziesiatki GB odczytu) - zgloszenie jest na koncu
                info = {}
                rc, rb_kind, built = rebuild_changed(
                    batch,
                    **{**common, "branding_hook": False},
                    max_incremental=args.incremental_max,
                    stage_prefix="review",
                    begin_run=not review["begun"],
                    end_run=False,
                    publish=False,
                    info=info,
                )
                review["changed"] += int(info.get("changed_builds", 1))
                if rc == 2:
                    review["queue"].insert(0, batch_all)  # blokada zajeta: ta sama paczka za chwile
                    retry_after = time.time() + 10.0
                    continue
                review["begun"] = True
                if rc == UNREACHABLE_RC:
                    pace.backoff("builder: folder nieosiagalny (kod 6)")
                    review["unreachable"] += 1
                    if review["unreachable"] < PRODUCT_MAX_TRIES:
                        review["queue"].insert(0, batch_all)  # ta sama paczka po zwloce
                        retry_after = time.time() + PRODUCT_RETRY_SEC
                        _log(
                            f"[watch] przeglad godzinny: folder nieosiagalny (kod 6), proba "
                            f"{review['unreachable']}/{PRODUCT_MAX_TRIES} - paczka ponownie za {PRODUCT_RETRY_SEC:.0f} s"
                        )
                        continue
                    # trzy razy z rzedu: paczka POMINIETA w tym przegladzie (nie usunieta, nie 'nieudana')
                    _log(f"[watch] przeglad godzinny: paczka {len(batch)} produktow nieosiagalna - pomijam")
                    batch = []
                    built = []
                review["unreachable"] = 0
                if rb_kind == "full" or rc == 130:
                    # kod 5 = pelny skan zamiast przegladu (zamknal raport sam) albo anulowanie przez uzytkownika
                    if rb_kind == "full" and rc == 0:
                        tracker.mark_built(cur_snap)
                        last_hourly = time.time()
                        tries.clear()
                        hold.clear()
                        save_baseline(args.status_file, product_roots, tracker.baseline)
                        _log("[watch] przeglad godzinny zastapiony pelnym skanem (przyrost niemozliwy) - pelny skan OK")
                    else:
                        if rb_kind != "full":
                            _finish_run(report=True, publish=False, ok=False, rc=rc, mode="review")
                        _log(
                            f"[watch] przeglad godzinny przerwany ({rb_kind}, rc={rc}); "
                            f"nastepny za {review_sec / 60.0:.0f} min"
                        )
                    last_review = time.time()
                    review = None
                    continue
                done = set(built)
                if built:
                    tracker.mark_built(cur_snap, keys=built)
                    save_baseline(args.status_file, product_roots, tracker.baseline)
                    for c in built:
                        tries.pop(c, None)
                        hold.pop(c, None)
                review["built"] += len(built)
                review["failed"] += [p for p in batch if p not in done]  # blad paczki nie zatrzymuje przegladu
            review["skipped"] += len(batch_all) - len(batch)
            review["done"] += 1
            _log(
                f"[watch] przeglad godzinny: paczka {review['done']}/{review['batches']} "
                f"({len(batch)} produktow, razem {review['built']}/{review['total']})"
            )
        if not review["queue"]:
            failed = review["failed"]
            took = int(time.time() - review["started"])
            run_report = None
            if review["begun"]:
                run_report = _finish_run(
                    report=True,
                    publish=review["changed"] > 0 and args.out_dir is None,  # przeglad bez zmian = bez publikacji
                    ok=not failed,
                    rc=1 if failed else 0,
                    mode="review",
                )
            # ile plikow produktow przeglad faktycznie zmienil w spisie (rozjazd, ktorego wykrywanie nie zlapalo)
            counts = (run_report or {}).get("counts") or {}
            drift = sum(int(counts.get(k) or 0) for k in ("new", "updated", "removed"))
            if drift and branding_hook and _BRANDING_HOOK is not None:
                _BRANDING_HOOK.request(time.time())  # branding tylko wtedy, gdy spis produktow sie zmienil
            stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            fields = {
                "last_review_at": stamp,
                "last_review_sec": took,
                "last_review_products": review["built"],
                "last_review_failed": len(failed),
                "last_review_skipped": review["skipped"],
                "last_review_changes": drift,
                "index_failed_products": [str(p) for p in failed],
            }
            if failed:
                fields["index_failed_at"] = stamp
            _merge_status(args.status_file, fields)
            _mark_review_done(args.status_file)
            last_review = time.time()
            shown = (" [" + ", ".join(Path(p).name for p in failed[:3]) + (" ..." if len(failed) > 3 else "") + "]") if failed else ""
            _log(
                f"[watch] przeglad godzinny OK: {review['built']}/{review['total']} produktow, "
                f"{review['batches']} paczek, {len(failed)} nieudanych{shown}, {review['skipped']} pominietych, "
                f"zmian w spisie {drift}, {took} s"
            )
            review = None

if __name__ == "__main__":
    main()
