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
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import platform_compat

# klucz w bazie -> nazwa pliku w web/data
SNAPSHOT_FILES = {
    "branding-search-index": "branding-search-index.json",
    "file-index": "file-index.json",
}
MIN_BYTES = 1024
REFRESH_S = 600.0

_LOCK = threading.Lock()
_THREAD: threading.Thread | None = None
_LAST: dict[str, Any] = {}


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
    for key, fname in SNAPSHOT_FILES.items():
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
        try:
            raw = path.read_bytes()
            json.loads(raw.decode("utf-8"))  # nie wysylamy rozdartego pliku
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
        if root_alive and path.is_file() and _iso_mtime(path) > str(meta.get("built_at") or ""):
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
            json.loads(raw.decode("utf-8"))
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
