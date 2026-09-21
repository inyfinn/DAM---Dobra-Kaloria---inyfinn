# -*- coding: utf-8 -*-
"""macOS .app entry point: cienki shim, ktory uruchamia NIEZAMROZONY kod z pakietu.

Dlaczego shim, a nie zamrozenie calej aplikacji:
moduly licza sciezki wzgledem wlasnego pliku - runtime_config.py:9-14 wylicza
WEB_ROOT = DESKTOP_DIR.parent / "web", CONTENT_ROOT, GIT_ROOT; podobnie
dam_thumb_cache.py:49, pg_db.py:46-48, pg_seal.py:34-37, machine_identity.py:32-35,
app_updates.py:30-37. Po zamrozeniu __file__ jest sciezka syntetyczna bez realnego
rodzenstwa na dysku, wiec WEB_ROOT.is_dir() zwraca False i dam_macos.py:40-42 konczy
komunikatem "Brak UI".

Ten sam wzorzec dziala juz na Windows: bin/tooling/build/DAM.spec zamraza wylacznie
dam_root_launcher.py, a prawdziwy kod zostaje zwyklymi plikami .py obok.

Uklad w pakiecie (z DAM-macos.spec, datas):
    DAM.app/Contents/.../damroot/bin/apps/desktop/*.py
    DAM.app/Contents/.../damroot/bin/apps/web/**
    DAM.app/Contents/.../damroot/bin/PAMIEC-PODRECZNA/**   (opcjonalnie, cache miniatur)

GIT_ROOT = <damroot>, bo CONTENT_ROOT = GIT_ROOT/bin.

Uruchomienie testowe bez GUI:   DAM.app/Contents/MacOS/DAM --selftest
"""
from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path

PAYLOAD_DIR_NAME = "damroot"


def _payload_root() -> Path:
    """Katalog z niezamrozonym drzewem aplikacji."""
    base = getattr(sys, "_MEIPASS", None)
    if base:
        candidate = Path(base) / PAYLOAD_DIR_NAME
        if candidate.is_dir():
            return candidate
    # Uruchomienie z repo (dev): ten plik lezy w bin/apps/desktop/
    return Path(__file__).resolve().parents[3]


def _prepare_env(root: Path) -> Path:
    desktop = root / "bin" / "apps" / "desktop"
    os.environ.setdefault("DAM_GIT_ROOT", str(root))
    if str(desktop) not in sys.path:
        sys.path.insert(0, str(desktop))
    return desktop


def _selftest(root: Path, desktop: Path) -> int:
    """Wykrywa blad ukladu sciezek BEZ Maca - w logu CI."""
    problems: list[str] = []
    checks: list[tuple[str, bool, str]] = []

    main_py = desktop / "__main__.py"
    checks.append(("__main__.py", main_py.is_file(), str(main_py)))

    try:
        import runtime_config  # type: ignore

        web_ok = runtime_config.WEB_ROOT.is_dir()
        checks.append(("WEB_ROOT", web_ok, str(runtime_config.WEB_ROOT)))
        checks.append(
            ("CONTENT_ROOT", runtime_config.CONTENT_ROOT.is_dir(), str(runtime_config.CONTENT_ROOT))
        )
    except Exception as exc:  # noqa: BLE001
        problems.append(f"import runtime_config: {type(exc).__name__}: {exc}")

    try:
        from bridge_supervisor import LOCAL_BRIDGE  # type: ignore

        checks.append(("local_bridge.py", LOCAL_BRIDGE.is_file(), str(LOCAL_BRIDGE)))
    except Exception as exc:  # noqa: BLE001
        problems.append(f"import bridge_supervisor: {type(exc).__name__}: {exc}")

    try:
        import pg_db  # type: ignore

        cands = [str(p) for p in pg_db._pg_config_candidates()]  # noqa: SLF001
        checks.append(("pg-config kandydaci", bool(cands), " | ".join(cands[:3]) or "brak"))
    except Exception as exc:  # noqa: BLE001
        problems.append(f"pg_db candidates: {type(exc).__name__}: {exc}")

    # Biblioteki, ktore musza byc zamrozone przez hiddenimports w .spec
    for mod in ("webview", "bcrypt", "psycopg2", "PIL", "cryptography", "openpyxl", "ijson"):
        try:
            __import__(mod)
            checks.append((f"import {mod}", True, "ok"))
        except Exception as exc:  # noqa: BLE001
            checks.append((f"import {mod}", False, f"{type(exc).__name__}: {exc}"))

    print(f"payload root: {root}")
    for name, ok, detail in checks:
        print(f"[{'OK ' if ok else 'BLAD'}] {name}: {detail}")
        if not ok:
            problems.append(f"{name}: {detail}")

    for p in problems:
        print(f"PROBLEM: {p}", file=sys.stderr)
    print(f"selftest: {'PASS' if not problems else f'FAIL ({len(problems)})'}")
    return 0 if not problems else 1


def main() -> int:
    root = _payload_root()
    desktop = _prepare_env(root)

    if "--selftest" in sys.argv[1:]:
        return _selftest(root, desktop)

    main_py = desktop / "__main__.py"
    if not main_py.is_file():
        print(f"Brak {main_py}", file=sys.stderr)
        return 1
    runpy.run_path(str(main_py), run_name="__main__")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
