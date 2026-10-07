# -*- coding: utf-8 -*-
"""Chodzenie po dysku dla skanerow Brandingu - z jawnym rozroznieniem
"folder wylistowany w calosci" vs "folder nieprzeczytany" (blad IO).

Problem, ktory to rozwiazuje: Path.rglob("*") po cichu polyka bledy
(PermissionError, timeout sieci na X:) - katalog, ktorego nie dalo sie
wylistowac, po prostu znika z wynikow, tak samo jak katalog naprawde pusty.
Przy scalaniu indeksu (asset_sync) nie da sie wtedy odroznic "plik zostal
usuniety" od "nie udalo nam sie go zobaczyc" - a to dwie zupelnie rozne
decyzje (usunac z indeksu vs zostawic bez zmian).

`walk_files` zwraca oddzielnie:
  - liste plikow (jak rglob),
  - `scanned_dirs`: klucze (asset_ids.asset_key) folderow faktycznie
    wylistowanych przez os.scandir bez bledu,
  - `failed_dirs`: klucze folderow, ktorych NIE dalo sie wylistowac
    (PermissionError/OSError/timeout) ORAZ folderow swiadomie pominietych
    przez `exclude_dir` (np. archiwum przy include_archive=False).

Foldery wykluczone przez `exclude_dir` traktujemy jak nieprzeczytane
(failed_dirs), nie jak trzecia, osobna kategorie: dla scalania indeksu
liczy sie wylacznie "wiemy, co tu jest" vs "nie wiemy" - a pominiety
katalog to z punktu widzenia merge'a dokladnie "nie wiemy, co tam jest
teraz" (mogl przybyc/zniknac plik, a my i tak go nie zobaczylismy).

Symlinki: NIE podazamy za nimi (ani plik, ani katalog) - identycznie jak
Path.rglob w praktyce tu dzialal (bez explicit follow), i zeby uniknac
petli/podwojnego liczenia przy skrotach na sieciowych dyskach.
"""
from __future__ import annotations

import os
import re
import sys
import unicodedata
from pathlib import Path
from typing import Callable

SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from asset_ids import asset_key  # noqa: E402

IncludeFn = Callable[[Path], bool]
ExcludeDirFn = Callable[[Path], bool]


def _default_include(_p: Path) -> bool:
    return True


def _default_exclude_dir(_p: Path) -> bool:
    return False


def walk_files(
    root: Path,
    *,
    include: IncludeFn = _default_include,
    exclude_dir: ExcludeDirFn = _default_exclude_dir,
) -> tuple[list[Path], set[str], set[str]]:
    """Rekurencyjnie chodzi po `root` przez os.scandir (bez podazania za symlinkami).

    Zwraca (files, scanned_dirs, failed_dirs):
      - files: sciezki plikow, dla ktorych include(fp) zwrocilo True (domyslnie
        wszystkie pliki - jak Path.rglob("*") + fp.is_file()).
      - scanned_dirs / failed_dirs: KLUCZE asset_key() folderow (nie sciezki).
        Folder trafia do scanned_dirs tylko gdy os.scandir go wylistowal bez
        bledu. Blad (PermissionError, OSError, timeout sieci) -> failed_dirs,
        a jego zawartosc nigdy nie jest odwiedzana (nie mozna poznac dzieci
        katalogu, ktorego nie dalo sie otworzyc) - wiec nic pod nim nie
        pojawia sie ani w scanned_dirs, ani w files.
      - Folder pominiety celowo przez `exclude_dir` (root sam w sobie nigdy
        nie jest sprawdzany przez exclude_dir) trafia do failed_dirs - patrz
        docstring modulu: dla scalania to ta sama kategoria "nie wiemy".

    `root` samo w sobie: jesli da sie je zeskanowac, jego klucz trafia do
    scanned_dirs (tak jak kazdy inny folder).
    """
    files: list[Path] = []
    scanned_dirs: set[str] = set()
    failed_dirs: set[str] = set()
    _walk_dir(Path(root), include, exclude_dir, files, scanned_dirs, failed_dirs, is_root=True)
    return files, scanned_dirs, failed_dirs


# --------------------------------------------------------------------------
# Sonda pojedynczego pliku (etap 1a, spec 3.1)
# --------------------------------------------------------------------------

PROBE_PRESENT = "jest"
PROBE_ABSENT = "nie_ma"
PROBE_UNREACHABLE = "nieosiagalny"

# Trzy foldery glowne Marketingu (REQUIRED_ROOT_FOLDERS w local_bridge.py). Brak ktoregokolwiek na
# swiezym listowaniu korzenia = dysk nie jest tym, za co go bierzemy: "nieosiagalny", nigdy "nie ma".
REQUIRED_TOP = ("- POLSKA", "-- ARCHIWUM --", "- EKSPORT")


def _norm_name(name: str) -> str:
    """Nazwa do porownan: NFC i bez wielkosci liter - tak jak klucz wiersza (asset_ids.asset_key)."""
    return unicodedata.normalize("NFC", str(name)).casefold()


def _listing(path: str, cache: dict) -> tuple[str, dict]:
    """('ok', {nazwa_znormalizowana: nazwa_z_dysku}) | ('gone', {}) | ('error', {}). Pamiec podreczna
    `cache` dotyczy JEDNEGO przebiegu sondy: kazdy przebieg listuje foldery od nowa (wynik skanu nie
    jest dowodem), a ten sam folder w ramach przebiegu tylko raz."""
    hit = cache.get(path)
    if hit is not None:
        return hit
    try:
        with os.scandir(path) as it:
            res: tuple[str, dict] = ("ok", {_norm_name(e.name): e.name for e in it})
    except (FileNotFoundError, NotADirectoryError):
        res = ("gone", {})
    except OSError:
        res = ("error", {})
    cache[path] = res
    return res


def probe_file(root: str | Path, rel: str, cache: dict | None = None, *,
               required_top: tuple[str, ...] = REQUIRED_TOP) -> dict:
    """Czy plik `rel` (sciezka wzgledem `root`, np. '- POLSKA/A/b.png') jest na dysku?

    Zwraca {"state", "gone", "empty_parent", "reason"}:
      state  PROBE_PRESENT   - swieze listowanie folderu nadrzednego zawiera nazwe pliku
             PROBE_ABSENT    - najblizszy istniejacy przodek wylistowany bez bledu, nie zawiera
                               nastepnego ogniwa sciezki, a os.stat tego ogniwa mowi "nie ma takiego
                               pliku" (FileNotFoundError / NotADirectoryError)
             PROBE_UNREACHABLE - kazdy inny blad listowania lub stat, pusty korzen, brak ktoregos
                               z trzech folderow glownych, listowanie niezgodne ze stat
      gone   dla "nie ma": sciezka wzgledna NAJWYZSZEGO folderu, ktory zniknal ('' = zniknal sam plik)
      empty_parent  najblizszy istniejacy przodek jest pusty (wstrzymanie folderu, spec 3.3)
    "Nieosiagalny" nigdy nie prowadzi do oznaczenia braku pliku."""
    cache = {} if cache is None else cache
    out = {"state": PROBE_UNREACHABLE, "gone": "", "empty_parent": False, "reason": ""}
    root_s = str(root)
    st, names = _listing(root_s, cache)
    if st != "ok" or not names:
        out["reason"] = "root_empty" if st == "ok" else f"root_{st}"
        return out
    for top in required_top:
        if _norm_name(top) not in names:
            out["reason"] = f"missing_top:{top}"
            return out
    parts = [x for x in re.split(r"[\\/]+", str(rel or "")) if x]
    if not parts:
        out["reason"] = "empty_rel"
        return out
    cur, cur_names = root_s, names
    for i, comp in enumerate(parts):
        last = i == len(parts) - 1
        real = cur_names.get(_norm_name(comp))
        if real is not None:
            if last:
                out["state"] = PROBE_PRESENT
                return out
            nxt = os.path.join(cur, real)
            st, nn = _listing(nxt, cache)
            if st != "ok":   # jest na liscie rodzica, a nie da sie go otworzyc: nie wiemy
                out["reason"] = f"listing_{st}"
                return out
            cur, cur_names = nxt, nn
            continue
        try:
            os.stat(os.path.join(cur, comp))
        except (FileNotFoundError, NotADirectoryError):
            out["state"] = PROBE_ABSENT
            out["gone"] = "" if last else "/".join(parts[: i + 1])
            out["empty_parent"] = not cur_names
            return out
        except OSError:
            out["reason"] = "stat_error"
            return out
        out["reason"] = "stat_ok_not_listed"   # listowanie mowi "nie ma", stat "jest": nie ufamy zadnemu
        return out
    return out


def _walk_dir(
    dir_path: Path,
    include: IncludeFn,
    exclude_dir: ExcludeDirFn,
    files: list[Path],
    scanned_dirs: set[str],
    failed_dirs: set[str],
    *,
    is_root: bool,
) -> None:
    dir_key = asset_key(str(dir_path))
    if not is_root and exclude_dir(dir_path):
        failed_dirs.add(dir_key)
        return
    try:
        entries = list(os.scandir(dir_path))
    except OSError:
        failed_dirs.add(dir_key)
        return

    scanned_dirs.add(dir_key)
    for entry in entries:
        try:
            is_symlink = entry.is_symlink()
        except OSError:
            # Nie umiemy nawet stwierdzic, co to jest - pomijamy wpis,
            # ale nie psujemy calego skanu folderu nadrzednego.
            continue
        if is_symlink:
            continue  # nie podazamy za symlinkami (plik ani katalog)
        try:
            is_dir = entry.is_dir(follow_symlinks=False)
        except OSError:
            continue
        if is_dir:
            _walk_dir(
                Path(entry.path),
                include,
                exclude_dir,
                files,
                scanned_dirs,
                failed_dirs,
                is_root=False,
            )
            continue
        try:
            is_file = entry.is_file(follow_symlinks=False)
        except OSError:
            is_file = False
        if not is_file:
            continue
        fp = Path(entry.path)
        if include(fp):
            files.append(fp)
