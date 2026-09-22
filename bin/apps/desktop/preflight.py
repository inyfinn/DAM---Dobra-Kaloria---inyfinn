"""Preflight: szybka lista kontrolna pierwszego uruchomienia (GET /preflight).

Kazdy punkt to {id, ok, level, blocking, label, hint, action}. ``level``:
``ok`` | ``warn`` (program dziala, ale czegos brakuje) | ``block`` (uzytkownik
zobaczy pusty widok) | ``info``. Punkty biegna rownolegle w watkach; caly raport
ma twardy limit czasu (``TOTAL_BUDGET_SEC``), wiec zawieszony dysk sieciowy albo
wolny DPAPI nigdy nie blokuje zadania dluzej niz ok. 2,5 s.

Modul nie laczy sie z baza (tylko ``pg_db.cached_health()``) i nie czyta
zawartosci duzych plikow (indeks: tylko ``stat``).
"""
from __future__ import annotations

import sys
import threading
import time
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence

TOTAL_BUDGET_SEC = 2.5
DRIVE_CHECK_TIMEOUT_SEC = 1.5
MIN_INDEX_BYTES = 1024
BLOCKING_IDS = frozenset({"marketing", "index", "watcher"})
WEBVIEW2_CLIENT_GUID = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
WEBVIEW2_KEYS = (
    ("HKLM", "\\".join(("SOFTWARE", "WOW6432Node", "Microsoft", "EdgeUpdate", "Clients", WEBVIEW2_CLIENT_GUID))),
    ("HKLM", "\\".join(("SOFTWARE", "Microsoft", "EdgeUpdate", "Clients", WEBVIEW2_CLIENT_GUID))),
    ("HKCU", "\\".join(("Software", "Microsoft", "EdgeUpdate", "Clients", WEBVIEW2_CLIENT_GUID))),
)


def _item(
    item_id: str,
    ok: bool,
    label: str,
    hint: str = "",
    *,
    level: str | None = None,
    action: str = "",
    **extra: Any,
) -> dict[str, Any]:
    lvl = level or ("ok" if ok else ("block" if item_id in BLOCKING_IDS else "warn"))
    out = {
        "id": item_id,
        "ok": bool(ok),
        "level": lvl,
        "blocking": lvl == "block",
        "label": label,
        "hint": hint,
        "action": action,
    }
    out.update(extra)
    return out


# ------------------------------------------------------------------ baza


def check_database(pg: Any) -> dict[str, Any]:
    """Baza: brak bazy to ostrzezenie (dziala tryb SQLite offline), nie blokada.

    Baza NIE zalezy od folderu Marketing. 2026-09-22: odrzucone haslo lezalo w tym
    samym pasku co brak folderu ("Pliki moga sie nie wyswietlac"), wiec wygladalo
    na "nie ma ROOT = nie ma bazy". Stad group="database" i prawdziwa przyczyna
    (db_problem) - UI rysuje osobny komunikat."""
    base = {"group": "database"}
    if pg is None:
        return _item(
            "database", False, "Baza: moduł niedostępny",
            "Program działa w trybie offline (lokalny SQLite).", **base,
        )
    auth_failed = bool(getattr(pg, "last_auth_failed", lambda: False)())
    if auth_failed and pg.is_configured():
        return _item(
            "database", False, "Baza Synology odrzuciła zapisane hasło",
            "Hasło do bazy zmieniło się, a ta instalacja ma stare. Wpisz kod aktywacyjny - "
            "okno otworzy się samo. Do tego czasu zmiany zapisują się lokalnie.",
            action="activate", db_problem="auth_failed", **base,
        )
    if pg.activation_required():
        return _item(
            "database", False, "Baza: wymaga kodu aktywacyjnego",
            "Wpisz kod aktywacyjny od administratora na ekranie logowania. "
            "Do tego czasu program działa w trybie offline.",
            action="activate", db_problem="not_activated", **base,
        )
    if not pg.is_configured():
        return _item(
            "database", False, "Baza: nieskonfigurowana",
            "Program działa w trybie offline (lokalny SQLite). "
            "Zainstaluj DAM ponownie z DAM-Setup.exe albo poproś administratora o konfigurację.",
            db_problem="not_configured", **base,
        )
    health = pg.cached_health() or {}
    if health.get("ok"):
        return _item("database", True, "Baza: połączona", "", **base)
    err = str(health.get("error") or "")
    if err == "health_pending":
        return _item(
            "database", True, "Baza: trwa sprawdzanie połączenia",
            "Wynik pojawi się za kilka sekund.", level="info", **base,
        )
    return _item(
        "database", False, "Baza Synology nie odpowiada (tryb offline)",
        "Sprawdź internet albo VPN. Zmiany zapisują się lokalnie i trafią do bazy po odzyskaniu "
        "połączenia." + (f" Szczegóły: {err}" if err else ""),
        action="retry", db_problem="unreachable", **base,
    )


# ------------------------------------------------------------ Marketing


def check_marketing(
    saved_base: str,
    check_paths: Callable[[Iterable[str]], dict[str, dict]],
    discover: Callable[[], Sequence[Path | str]],
    path_key: Callable[[Path | str], str],
) -> dict[str, Any]:
    """Folder Marketing: zapisany i dostepny / wykryty, ale niezapisany / brak."""
    saved = (saved_base or "").strip()
    if saved:
        status = check_paths([saved]).get(path_key(saved)) or {}
        if status.get("ok"):
            return _item("marketing", True, "Folder Marketing: " + saved, "", path=saved)
        if status.get("timeout"):
            why = "Dysk nie odpowiada (sieć lub VPN)."
        elif status.get("exists"):
            why = "Brakuje folderów: " + ", ".join(status.get("missing") or []) + "."
        else:
            why = "Folder jest niedostępny. Podłącz dysk sieciowy albo VPN."
        return _item(
            "marketing", False, "Zapisany folder Marketing jest niedostępny: " + saved,
            why + " Możesz też wskazać inny folder.",
            action="pick_marketing", path=saved,
        )
    found = [str(p) for p in (discover() or [])]
    if found:
        return _item(
            "marketing", False, "Wykryto folder Marketing, ale nie jest zapisany",
            "Wykryto: " + ", ".join(found) + ". Zapisz go dla tego komputera.",
            action="pick_marketing", detected=found,
        )
    return _item(
        "marketing", False, "Nie znaleziono folderu Marketing",
        "Podłącz dysk z folderem Marketing (musi zawierać -- ARCHIWUM --, - EKSPORT, - POLSKA) "
        "albo wskaż go ręcznie.",
        action="pick_marketing", detected=[],
    )


# --------------------------------------------------------------- indeks


def check_index(index_file: Path) -> dict[str, Any]:
    try:
        size = Path(index_file).stat().st_size
    except OSError:
        size = -1
    if size > MIN_INDEX_BYTES:
        return _item(
            "index", True, "Indeks plików: %.1f MB" % (size / (1024 * 1024)), "", bytes=size
        )
    label = "Indeks plików: brak" if size < 0 else "Indeks plików jest pusty"
    return _item(
        "index", False, label,
        "Indeks buduje się w tle po wybraniu folderu Marketing. Poczekaj kilka minut "
        "i spróbuj ponownie.",
        action="retry", bytes=max(size, 0),
    )


# -------------------------------------------------------------- watcher


def _index_usable(index_file: Path | None) -> bool:
    """Czy na dysku lezy indeks, z ktorego UI realnie czyta pliki."""
    if index_file is None:
        return False
    try:
        return Path(index_file).stat().st_size > MIN_INDEX_BYTES
    except OSError:
        return False


def check_watcher(
    status_fn: Callable[[], dict[str, Any]],
    index_file: Path | None = None,
) -> dict[str, Any]:
    st = status_fn() or {}
    alive = bool(st.get("watcher_ok")) and not bool(st.get("stale"))
    awaiting = bool(st.get("awaiting_first_rebuild"))
    err = str(st.get("last_error") or "")
    extra = {"awaiting_first_rebuild": awaiting, "last_error": err}
    # Pasek nazywa sie "Pliki moga sie nie wyswietlac". Gdy indeks LEZY NA DYSKU
    # i jest niepusty, pliki wyswietlaja sie normalnie - martwy watcher znaczy
    # wtedy tylko "lista moze byc nieaktualna". Blokada jest zarezerwowana dla
    # sytuacji, w ktorej indeksu nie ma i faktycznie nie bedzie czego pokazac.
    have_index = _index_usable(index_file)

    # POSTEP BIJE PLIKI STANU. Przez pierwsze sekundy po starcie pliki stanu sa
    # jeszcze z POPRZEDNIEGO uruchomienia (martwe pidy, przeterminowane zamki),
    # wiec alive wychodzilo False i pulpit dostawal czerwony pasek "Aktualizacja
    # indeksu nie dziala" - mimo ze indeks wlasnie sie budowal. UI odpytywal
    # ponownie dopiero po 20 s, wiec uzytkownik widzial blad przy KAZDYM starcie
    # i slusznie uznal, ze problem jest staly.
    # Jesli przebudowa realnie posuwa sie naprzod, to nie jest awaria, tylko start.
    progress = st.get("progress") if isinstance(st.get("progress"), dict) else {}
    working = bool(progress.get("running"))
    if not alive and working:
        done = progress.get("products_done")
        total = progress.get("products_total")
        postep = f" ({done}/{total})" if isinstance(done, int) and isinstance(total, int) and total else ""
        return _item(
            "watcher", True, "Trwa budowanie indeksu" + postep,
            "Pliki pojawia sie po jego zakonczeniu.", level="info", **extra,
        )

    # "Czekam na pierwsza przebudowe" (last_ok is None) to NIE awaria - to stan
    # poczatkowy. Miedzy cyklicznymi przebudowami watcher_ok chwilowo spada, a
    # last_ok pozostaje None, bo zadna przebudowa jeszcze sie nie ZAKONCZYLA w
    # tej instalacji. Razem dawalo to czerwony pasek przy zdrowym indeksie
    # 9,4 MB i dzialajacej przebudowie godzinowej. Ze to nie blad, wiedzial juz
    # autor poprzedniej wersji - wycinal "awaiting_first_rebuild" z TEKSTU
    # bledu, ale nie z decyzji o blokadzie.
    #
    # UWAGA na druga strone: samo "awaiting" nie moze uciszac wszystkiego, bo
    # na naprawde zepsutej instalacji watcher nigdy nie wystartowal i last_ok
    # tez jest None. Dlatego cisza wymaga DOWODU, ze jest z czego czytac
    # (indeks na dysku) albo ze ktos pracuje (zywy watcher).
    if awaiting and (have_index or alive):
        return _item(
            "watcher", True,
            "Trwa pierwsze budowanie indeksu" if not have_index else "Indeks czeka na pierwsze odświeżenie",
            "Pliki pojawią się po jego zakończeniu."
            if not have_index
            else "Lista plików działa na dotychczasowym indeksie.",
            level="info", **extra,
        )
    if not alive:
        # Indeks jest - pliki sie wyswietlaja, tylko lista moze byc nieswieza.
        if have_index:
            return _item(
                "watcher", True, "Lista plików może być nieaktualna",
                "Proces odświeżający zatrzymał się, ale zapisany indeks działa."
                + (f" Ostatni błąd: {err}." if err and err != "awaiting_first_rebuild" else "")
                + " Kliknij Odśwież z dysku albo uruchom DAM ponownie.",
                level="warn", action="retry", **extra,
            )
        return _item(
            "watcher", False, "Aktualizacja indeksu nie działa",
            "Proces odświeżający listę plików zatrzymał się."
            + (f" Ostatni błąd: {err}." if err and err != "awaiting_first_rebuild" else "")
            + " Zamknij i uruchom DAM ponownie.",
            action="retry", **extra,
        )
    if st.get("last_ok") is False and err:
        return _item(
            "watcher", True, "Ostatnie odświeżenie indeksu nie powiodło się",
            "Błąd: " + err, level="warn", **extra,
        )
    return _item("watcher", True, "Aktualizacja indeksu działa", "", **extra)


# -------------------------------------------------------------- WebView2


def _winreg_reader(hive: str, key: str) -> str | None:
    import winreg  # noqa: PLC0415 - tylko Windows

    root = winreg.HKEY_LOCAL_MACHINE if hive == "HKLM" else winreg.HKEY_CURRENT_USER
    try:
        with winreg.OpenKey(root, key) as h:
            value, _ = winreg.QueryValueEx(h, "pv")
    except OSError:
        return None
    return str(value or "")


def check_webview2(
    reg_reader: Callable[[str, str], str | None] | None = None,
    platform: str | None = None,
) -> dict[str, Any] | None:
    """Tylko informacyjnie. Poza Windows zwraca None (punkt pomijany)."""
    if (platform or sys.platform) != "win32":
        return None
    reader = reg_reader or _winreg_reader
    for hive, key in WEBVIEW2_KEYS:
        try:
            version = reader(hive, key)
        except Exception:  # noqa: BLE001
            version = None
        if version and version != "0.0.0.0":
            return _item(
                "webview2", True, "WebView2: " + version, "", level="info", version=version
            )
    return _item(
        "webview2", False, "WebView2: nie znaleziono w rejestrze",
        "Okno programu wymaga Microsoft Edge WebView2 Runtime. Jeśli okno się nie otwiera, "
        "zainstaluj Evergreen Bootstrapper od Microsoft.",
        level="info",
    )


# ---------------------------------------------------------------- raport

_TIMEOUT_LABELS = {
    "database": "Baza: sprawdzanie trwa zbyt długo",
    "marketing": "Folder Marketing: sprawdzanie trwa zbyt długo",
    "index": "Indeks plików: sprawdzanie trwa zbyt długo",
    "watcher": "Aktualizacja indeksu: sprawdzanie trwa zbyt długo",
    "webview2": "WebView2: sprawdzanie trwa zbyt długo",
}
_ERROR_LABEL = "Nie udało się sprawdzić punktu: {cid}"


def soften_without_root(report: dict[str, Any], cache_thumbs: int) -> dict[str, Any]:
    """Brak folderu Marketing przy dzialajacej pamieci podrecznej to NIE awaria.

    2026-09-22: uzytkownik bez podlaczonego X: widzial czerwony pasek "Pliki moga sie
    nie wyswietlac", choc miniatury, lista i baza dzialaly. Folder Marketing jest
    potrzebny do oryginalow, przycisku Folder i skanowania dysku - nie do przegladania.
    Indeks, ktory bez folderu nie moze sie odswiezyc, tez nie jest wtedy bledem."""
    items = report.get("items") or []
    by_id = {i.get("id"): i for i in items if isinstance(i, dict)}
    for it in items:
        if isinstance(it, dict) and it.get("id") != "database":
            it.setdefault("group", "files")
    mk = by_id.get("marketing")
    if not mk or mk.get("ok"):
        return report
    idx = by_id.get("index") or {}
    have_index = bool(idx.get("ok"))
    if cache_thumbs > 0 and have_index:
        why = str(mk.get("hint") or "")
        mk.update(
            level="info",
            blocking=False,
            label="Pracujesz bez folderu Marketing - miniatury z pamięci podręcznej",
            hint=(
                f"Lista materiałów, {cache_thumbs} miniatur i baza działają. Otwieranie oryginałów, "
                "przycisk Folder i skanowanie dysku wymagają folderu Marketing. " + why
            ).strip(),
        )
        wt = by_id.get("watcher")
        if wt and wt.get("level") in ("warn", "block"):
            wt.update(
                ok=True,
                level="info",
                blocking=False,
                label="Indeks nie odświeża się bez folderu Marketing",
                hint="Pokazuję ostatni zapisany indeks.",
            )
    blocking = [i["id"] for i in items if isinstance(i, dict) and i.get("blocking")]
    report["blocking"] = blocking
    report["ok"] = not blocking
    return report


def run_checks(
    checks: Sequence[tuple[str, Callable[[], dict[str, Any] | None]]],
    budget: float = TOTAL_BUDGET_SEC,
) -> dict[str, Any]:
    """Uruchom punkty rownolegle; po ``budget`` s niegotowe punkty = ostrzezenie."""
    started = time.monotonic()
    results: dict[str, Any] = {}
    lock = threading.Lock()

    def runner(cid: str, fn: Callable[[], dict[str, Any] | None]) -> None:
        try:
            res: Any = fn()
        except Exception as exc:  # noqa: BLE001
            res = _item(cid, False, _ERROR_LABEL.format(cid=cid), str(exc), level="warn", action="retry")
        with lock:
            results[cid] = res

    threads = []
    for cid, fn in checks:
        t = threading.Thread(target=runner, args=(cid, fn), daemon=True, name=f"dam-preflight-{cid}")
        t.start()
        threads.append(t)
    deadline = started + float(budget)
    for t in threads:
        t.join(max(0.0, deadline - time.monotonic()))

    items: list[dict[str, Any]] = []
    with lock:
        snapshot = dict(results)
    for cid, _fn in checks:
        if cid not in snapshot:
            items.append(
                _item(
                    cid, False, _TIMEOUT_LABELS.get(cid, cid),
                    "Sprawdzenie nie zmieściło się w limicie czasu. Spróbuj ponownie.",
                    level="warn", action="retry", timeout=True,
                )
            )
            continue
        res = snapshot[cid]
        if res is not None:
            items.append(res)
    blocking = [i["id"] for i in items if i.get("blocking")]
    return {
        "ok": not blocking,
        "blocking": blocking,
        "items": items,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
    }
