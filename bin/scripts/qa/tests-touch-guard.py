# -*- coding: utf-8 -*-
"""Straznik: zaden test w bin/apps/desktop/tests nie moze zapisac do prawdziwych
lokalnych baz SQLite. Powod: 27.09.2026 test_index_snapshots*.py wolal (posrednio,
przez index_snapshots.pull_newer -> meta_store.sync_from_file_index) prawdziwy
bin/apps/desktop/data/dam-local.sqlite - meta_sync_state.source wskazywal na plik
w Temp, meta_products wyzerowane. Naprawione (zadanie 1: usunieto wywolanie), ten
skrypt ma to wykryc, gdyby wrocilo.

Dwa pliki, dwie rozne metody porownania:

  A. bin/apps/desktop/data/dam-local.sqlite (meta_store.DB_PATH) - zlota aplikacja
     pisze tu TYLKO recznie (POST /meta-store/sync) albo po pelnym, recznym
     rebuildzie indeksu plikow (local_bridge.py ~1668). W oknie czasu testow
     (dziesiatki sekund) to sie praktycznie nie zdarza - porownujemy PELNE
     (rozmiar, mtime, sha256) przed/po. Kolizja z prawdziwym rebuildem admina
     w tym samym oknie da falszywy alarm - akceptowalne (rzadkie, i wtedy
     najwazniejsze pytanie brzmi "co dokladnie sie zmienilo", nie "czy cos sie
     zmienilo").

  B. bin/DATABASE/dam-local.sqlite (dam_db kanoniczny plik) - zlota aplikacja
     pisze tu CIAGLE w tle, nawet gdy silnikiem jest Postgres (mirror uzytkownikow
     co ~60 s, audit_log, migracja SQLite miedzy sciezkami) - PELNE porownanie
     bajtow dawaloby falszywy alarm na kazdym uruchomieniu. Sprawdzamy wyzej
     wypoziomowany sygnal: czy tabela meta_sync_state (jesli istnieje) ma
     source wskazujace na katalog tymczasowy (Temp/tmp) - to jest jedyny
     wiarygodny odcisk testu, ktory pisal do zlej bazy.

Uzycie:
    python tests-touch-guard.py [--python <sciezka do interpretera>]

Kod wyjscia 0 = OK, 1 = wykryto zapis testow do prawdziwej bazy (albo blad).
"""
from __future__ import annotations

import argparse
import hashlib
import sqlite3
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FILE_A = REPO_ROOT / "apps" / "desktop" / "data" / "dam-local.sqlite"
FILE_B = REPO_ROOT / "DATABASE" / "dam-local.sqlite"
TESTS_DIR = REPO_ROOT / "apps" / "desktop" / "tests"


def _sig_a(path: Path) -> tuple[int, float, str] | None:
    if not path.is_file():
        return None
    st = path.stat()
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return (st.st_size, st.st_mtime, h.hexdigest())


def _meta_sync_source(path: Path) -> str | None:
    """meta_sync_state.source z pliku B, jesli tabela istnieje. None gdy brak
    pliku/tabeli/wiersza - to NIE jest sygnal bledu samo w sobie."""
    if not path.is_file():
        return None
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=3)
    except sqlite3.OperationalError:
        return None
    try:
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='meta_sync_state'"
        )
        if not cur.fetchone():
            return None
        row = conn.execute("SELECT source FROM meta_sync_state WHERE id = 1").fetchone()
        return str(row[0]) if row else None
    except sqlite3.DatabaseError:
        return None
    finally:
        conn.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--python", default=None, help="Interpreter do uruchomienia testow (domyslnie ten sam co ten skrypt)")
    args = ap.parse_args()

    before_a = _sig_a(FILE_A)
    before_b_source = _meta_sync_source(FILE_B)

    py = args.python or sys.executable
    proc = subprocess.run(
        [py, "-m", "unittest", "discover", "-s", str(TESTS_DIR), "-p", "test_*.py"],
        cwd=str(REPO_ROOT / "apps" / "desktop"),
        capture_output=True,
        text=True,
    )
    print(proc.stdout[-4000:])
    print(proc.stderr[-4000:])

    after_a = _sig_a(FILE_A)
    after_b_source = _meta_sync_source(FILE_B)

    problems: list[str] = []

    if before_a != after_a:
        problems.append(
            f"PLIK A zmieniony przez testy: {FILE_A}\n  przed={before_a}\n  po={after_a}"
        )

    def _looks_temp(s: str | None) -> bool:
        if not s:
            return False
        low = s.lower()
        return "temp" in low or "\\tmp" in low or "/tmp" in low

    if _looks_temp(after_b_source) and after_b_source != before_b_source:
        problems.append(
            f"PLIK B: meta_sync_state.source po testach wskazuje na katalog tymczasowy: {after_b_source!r}"
        )

    if proc.returncode != 0:
        problems.append(f"Zestaw testow zakonczyl sie kodem {proc.returncode} (patrz output powyzej)")

    if problems:
        print("\n=== TESTS-TOUCH-GUARD: PROBLEM ===")
        for p in problems:
            print("-", p)
        return 1

    print("\n=== TESTS-TOUCH-GUARD: OK ===")
    print(f"Plik A ({FILE_A}) niezmieniony: {before_a is not None}")
    print(f"Plik B meta_sync_state.source przed/po: {before_b_source!r} / {after_b_source!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
