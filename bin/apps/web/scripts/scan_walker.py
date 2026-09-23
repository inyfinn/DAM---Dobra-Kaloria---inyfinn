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
import sys
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
