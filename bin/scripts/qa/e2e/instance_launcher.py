# -*- coding: utf-8 -*-
"""Start mostu DAM (local_bridge.main) jako izolowanej instancji testowej A/B/C.

Kopiowany przez run_abc.py do <instancja>\\launcher\\ i uruchamiany interpreterem
z D:\\DAM-lokalne\\testclients\\_runtime - proces nie czyta niczego z repo.

Jedyna ingerencja: zawezenie kandydatow ROOT Marketing (M:\\, X:\\Marketing,
D:\\Marketing + wykrywanie liter dysku) do katalogow tej instancji. Produkcja
nie ma na to zmiennej srodowiskowej (local_bridge.py:374-380 MARKETING_CANDIDATES,
marketing_discovery.py:29-35 PREFERRED_CANDIDATES + discover_roots,
dam_path_resolve.py:19-25 DEFAULT_MARKETING_CANDIDATES) - bez tego instancja C
"bez ROOT" znalazlaby prawdziwy M:\\ / X:\\Marketing / D:\\Marketing tego PC
(automatyczny fallback do danych produkcyjnych, plan sekcja 0). Skrypty potomne
(watch-file-index, build-branding-index) dostaja to samo przez
DAM_MARKETING_FALLBACKS (marketing_roots.py:126-131).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> None:
    desktop = Path(os.environ["DAM_E2E_DESKTOP"]).resolve()
    if str(desktop) not in sys.path:
        sys.path.insert(0, str(desktop))
    os.chdir(str(desktop))
    allowed = [Path(p) for p in os.environ.get("DAM_E2E_ALLOWED_ROOTS", "").split(os.pathsep) if p.strip()]

    import marketing_discovery as md

    md.PREFERRED_CANDIDATES = tuple(allowed)

    def _discover_roots(*_a, **_k):
        return [p for p in allowed if p.is_dir()]

    def _probe_drives(*_a, required=md.REQUIRED_ROOT_FOLDERS, **_k):
        # /detect-marketing-bases (local_bridge.py:719) wola probe_drives wprost - bez
        # tej podmiany instancja C pokazywala w UI "Uzyj D:\\Marketing / M:\\" (produkcja).
        out = []
        for p in allowed:
            missing = [r for r in required if not (p / r).is_dir()]
            out.append({"path": str(p), "ok": p.is_dir() and not missing, "exists": p.is_dir(),
                        "missing": missing, "timeout": False})
        return out

    md.discover_roots = _discover_roots  # type: ignore[assignment]
    md.probe_drives = _probe_drives  # type: ignore[assignment]
    md.logical_drive_letters = lambda: []  # type: ignore[assignment]

    import dam_path_resolve

    dam_path_resolve.set_marketing_candidates(allowed)

    import local_bridge

    local_bridge.MARKETING_CANDIDATES = tuple(allowed)
    print(
        "[e2e] instancja", os.environ.get("DAM_TEST_INSTANCE"),
        "port", local_bridge.PORT, "desktop", local_bridge.DESKTOP_DIR,
        "candidates", [str(p) for p in allowed], flush=True,
    )
    local_bridge.main()


if __name__ == "__main__":
    main()
