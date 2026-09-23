# -*- coding: utf-8 -*-
"""Lista materialow z indeksu w BAZIE, nie ze stanu plikow na dysku tego komputera.

22.09.2026 (uzytkownik): "stare brandingowe materialy zamiast nowych. Tak jakby to, co
jest pokazywane, NIE bylo zalezne od bazy danych i indeksu w bazie, tylko od stanu
plikow na ROOT." Tak bylo: branding-search-index.json i file-index.json pochodzily ze
skanu na komputerze, ktory zbudowal instalator (u uzytkownika: skan z 14.09).

Model:
  * komputer Z folderem Marketing po przebudowie skanu publikuje go do bazy
    (tabela dam_index_snapshots, gzip, ~5 MB na trzy pliki);
  * kazdy inny komputer co 10 min sprawdza generacje (bez pobierania tresci) i sciaga
    tylko nowsza; plik lokalny zostaje kopia na czas, gdy bazy nie ma;
  * tresc sciagnieta z bazy nigdy nie jest odsylana z powrotem (pulled_sha).

Zadna funkcja nie rzuca wyjatkiem na zewnatrz.
"""
from __future__ import annotations

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
}
MIN_BYTES = 1024
REFRESH_S = 600.0
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


def _iso_mtime(path: Path) -> str:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
    except OSError:
        return ""


def _machine() -> str:
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
    state = _load_state()
    out: dict[str, Any] = {"ok": True, "published": [], "unchanged": []}
    try:
        db_metas = pg_db.index_snapshot_meta()
    except Exception:  # noqa: BLE001
        db_metas = {}
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
    state = _load_state()
    out: dict[str, Any] = {"ok": True, "pulled": [], "current": [], "missing_in_db": []}
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
            root_alive
            and path.is_file()
            and _iso_mtime(path) > str(meta.get("built_at") or "")
            and not _has_legacy_asset_ids(path)
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
    return {"ok": True, "keys": keys, "last": dict(_LAST)}


def run_once(data_dir: Path, root_alive_fn: Callable[[], bool],
             on_updated: Callable[[str, Path], None] | None = None) -> dict[str, Any]:
    with _LOCK:
        try:
            alive = bool(root_alive_fn())
        except Exception:  # noqa: BLE001
            alive = False
        pub = publish_changed(data_dir, root_alive=alive)
        pull = pull_newer(data_dir, root_alive=alive, on_updated=on_updated)
        _LAST.update(at=datetime.now(timezone.utc).isoformat(), root_alive=alive, publish=pub, pull=pull)
        return dict(_LAST)


def start_watch(data_dir: Path, root_alive_fn: Callable[[], bool],
                on_updated: Callable[[str, Path], None] | None = None) -> dict[str, Any]:
    global _THREAD
    if _THREAD is not None and _THREAD.is_alive():
        return {"ok": True, "started": False}

    def loop() -> None:
        time.sleep(8.0)  # po starcie mostu: najpierw UI, potem siec
        while True:
            res = run_once(data_dir, root_alive_fn, on_updated)
            print("index_snapshots:", {"root": res.get("root_alive"),
                                       "publish": res.get("publish"), "pull": res.get("pull")}, flush=True)
            time.sleep(REFRESH_S)

    _THREAD = threading.Thread(target=loop, daemon=True, name="dam-index-snapshots")
    _THREAD.start()
    return {"ok": True, "started": True}
