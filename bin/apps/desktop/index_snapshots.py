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

# Faza 2 (bin/docs/PLAN-jedno-zrodlo-prawdy.md): gdy asset_sync_runner.py ma
# wlaczony tryb "rows" (dam_meta.asset_index_mode = "rows"), branding-index.json
# jest budowany przez scalanie (dam_assets), nie przez snapshoty - publikacja i
# pobieranie TEGO jednego klucza przez ten modul musza sie wtedy wylaczyc, zeby
# swiezy wynik scalania nie zostal nadpisany starszym snapshotem (albo odwrotnie).
ROWS_MODE_SKIP_KEY = "branding-index"
_ROWS_MODE_CACHE_TTL_S = 600.0  # tania funkcja: co najwyzej raz na 10 min pyta baze
_ROWS_MODE_CACHE: dict[str, Any] = {"value": False, "at": 0.0}

_LOCK = threading.Lock()
_THREAD: threading.Thread | None = None
_LAST: dict[str, Any] = {}
# Faza 3 (PLAN-jedno-zrodlo-prawdy.md, zadanie 3.4): stan pierwszej synchronizacji
# po starcie procesu, do wystawienia w /health / banerze UI "pobieram dane".
_FIRST_SYNC: dict[str, Any] = {"done": False, "ok": None, "started_at": "", "finished_at": ""}


def is_not_authority_error(err: Any) -> bool:
    """Odmowa bramki ADR-012 (wyzwalacz w bazie), nie blad sieci/bazy."""
    return NOT_AUTHORITY_MARK in str(err or "")


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


def _asset_index_mode_is_rows(*, force: bool = False) -> bool:
    """dam_meta.asset_index_mode == "rows"? Cache 10 min - nie pytamy bazy na kazdy plik.

    Blad polaczenia / brak tabeli = False (bezpieczny domyslny: snapshoty dzialaja
    dalej jak dzisiaj, dokladnie tak samo jak w asset_sync_runner._get_mode)."""
    now = time.monotonic()
    if not force and (now - float(_ROWS_MODE_CACHE.get("at") or 0.0)) < _ROWS_MODE_CACHE_TTL_S:
        return bool(_ROWS_MODE_CACHE.get("value"))
    value = False
    try:
        import pg_db

        pg = pg_db.connect()
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
    bez dodatkowej zaleznosci. Timeout: nie blokuj watku HTTP w nieskonczonosc -
    po uplywie czasu piszemy i tak (rzadka kolizja jest tansza niz zawieszony most;
    martwy plik blokady po padniete procesie tez nie ma prawa wisiec na zawsze)."""
    lock_path = _state_lock_path()
    try:
        lock_path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    deadline = time.monotonic() + _STATE_LOCK_TIMEOUT_S
    fd = None
    while True:
        try:
            fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            break
        except FileExistsError:
            if time.monotonic() >= deadline:
                break  # zrezygnuj z blokady po timeout - zapisz i tak
            time.sleep(0.05)
        except OSError:
            break  # np. brak dostepu do katalogu - zapisz bez blokady
    try:
        yield
    finally:
        if fd is not None:
            try:
                os.close(fd)
            except OSError:
                pass
            try:
                lock_path.unlink()
            except OSError:
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
        os.replace(tmp, p)
    except OSError:
        pass


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
    # zmiany wspolnego katalogu w bazie - patrz index_authority.py. None (brak
    # klucza / blad odczytu) = zachowanie jak przed tym modulem (dozwolone).
    try:
        import index_authority

        allowed = index_authority.may_publish(pg_db.connect)
    except Exception:  # noqa: BLE001
        allowed = None
    if allowed is False:
        return {"ok": True, "skipped": "not_authority"}
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
                    break
                out["ok"] = False
                out.setdefault("errors", {})[key] = str(exc)[:300]
                continue
            entry["published_sha"] = sha
            entry["generation"] = res.get("generation")
            (out["published"] if res.get("changed") else out["unchanged"]).append(key)
        _save_state(state)
    return out


def pull_newer(
    data_dir: Path,
    *,
    root_alive: bool,
    on_updated: Callable[[str, Path], None] | None = None,
) -> dict[str, Any]:
    """Sciagnij z bazy nowsza generacje skanu. Komputer z folderem jest zrodlem - nie
    nadpisujemy mu swiezszego lokalnego skanu starszym z bazy."""
    try:
        import pg_db

        metas = pg_db.index_snapshot_meta()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:300]}
    out: dict[str, Any] = {"ok": True, "pulled": [], "current": [], "missing_in_db": []}
    # ADR-012 pkt 3: "lokalny nowszy plik wygrywa" tylko dla wlasciciela katalogu
    # (may_publish True) albo gdy listy nie ma (None = jak dotad). Komputer spoza
    # listy zawsze bierze wersje z bazy - jego ROOT bywa opozniona kopia Drive.
    try:
        import index_authority

        authority = index_authority.may_publish(pg_db.connect)
    except Exception:  # noqa: BLE001
        authority = None
    local_may_win = authority is not False
    if not local_may_win:
        out["authority"] = False
    # Blokada miedzyprocesowa: most i watch-file-index.py (mark_built_here) pisza
    # do tego samego pliku stanu - patrz _state_lock().
    with _state_lock():
        state = _load_state()
        for key, fname in SNAPSHOT_FILES.items():
            if key == ROWS_MODE_SKIP_KEY and _asset_index_mode_is_rows():
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
            t0 = time.monotonic()
            try:
                got = pg_db.fetch_index_snapshot(key)
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
        _save_state(state)
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
    return {"ok": True, "keys": keys, "last": dict(_LAST), "first_sync": dict(_FIRST_SYNC)}


def first_sync_state() -> dict[str, Any]:
    """Do banera UI "pobieram dane" / /health: czy pierwszy cykl po starcie procesu
    juz sie skonczyl, i czy sie udal. Zanim sie skonczy: done=False - UI ma wtedy
    pokazac stan ladowania zamiast danych z instalatora/pustych list (PLAN Faza 3)."""
    return dict(_FIRST_SYNC)


def run_once(data_dir: Path, root_alive_fn: Callable[[], bool],
             on_updated: Callable[[str, Path], None] | None = None) -> dict[str, Any]:
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
        pull = pull_newer(data_dir, root_alive=alive, on_updated=on_updated)
        pub = publish_changed(data_dir, root_alive=alive)
        _LAST.update(at=datetime.now(timezone.utc).isoformat(), root_alive=alive, publish=pub, pull=pull)
        if is_first:
            _FIRST_SYNC.update(
                done=True,
                ok=bool(pull.get("ok")),
                finished_at=datetime.now(timezone.utc).isoformat(),
            )
        return dict(_LAST)


def start_watch(data_dir: Path, root_alive_fn: Callable[[], bool],
                on_updated: Callable[[str, Path], None] | None = None) -> dict[str, Any]:
    global _THREAD
    if _THREAD is not None and _THREAD.is_alive():
        return {"ok": True, "started": False}

    def loop() -> None:
        time.sleep(8.0)  # po starcie mostu: najpierw UI, potem siec
        # ADR-012 pkt 4: co LIGHT_CHECK_S tylko generacje (bez payload); pelny cykl
        # przy zmianie w bazie albo co REFRESH_S jak dotad. Bez LightWatch (import
        # sie nie udal) - dawna petla co REFRESH_S.
        try:
            from asset_sync_runner import LightWatch

            watch = LightWatch(REFRESH_S, generations_signature)
        except Exception:  # noqa: BLE001
            watch = None
        while True:
            if watch is None or watch.due():
                try:
                    res = run_once(data_dir, root_alive_fn, on_updated)
                except Exception as exc:  # noqa: BLE001 - watek nie moze umrzec
                    res = {"error": str(exc)[:300]}
                if watch is not None:
                    watch.done()
                print("index_snapshots:", {"why": getattr(watch, "reason", "interval"),
                                           "root": res.get("root_alive"),
                                           "publish": res.get("publish"), "pull": res.get("pull")},
                      flush=True)
            time.sleep(LIGHT_CHECK_S if watch is not None else REFRESH_S)

    _THREAD = threading.Thread(target=loop, daemon=True, name="dam-index-snapshots")
    _THREAD.start()
    return {"ok": True, "started": True}
