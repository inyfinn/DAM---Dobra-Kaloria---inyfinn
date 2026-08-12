# -*- coding: utf-8 -*-
"""
Jednorazowa naprawa: foldery wariantu z pelnym DOYPACK/BATON/... -> skrot DOY/BAT/...
Zrodlo prawdy: change-log.json (rename_carrier z new_name zaczynajacym sie od pelnej nazwy)
oraz skan Marketing gdy trzeba.

UI programu nadal pokazuje pelne nazwy (DOYPACK). Skrot tylko na dysku.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "desktop"))

from local_bridge import (  # noqa: E402
    CHANGE_LOG_FILE,
    rename_revision_prefix_on_disk,
)

# Pelny prefiks folderu (bledny po starym mapowaniu) -> kod API do rename na skrot
LONG_TO_CODE = {
    "DOYPACK 6X MINI": "DOY6X",
    "DOYPACK 6x MINI": "DOY6X",
    "KARTON 6X MINI": "KAR6X",
    "KARTON 6x MINI": "KAR6X",
    "MINI BATON": "MINI",
    "ETYKIETA BUTELKA": "ETY-BUT",
    "ETYKIETA SŁOIK": "ETY-SLO",
    "ETYKIETA SLOIK": "ETY-SLO",
    "DOYPACK": "DOY",
    "BATON": "BAT",
    "KARTON": "KAR",
    "FOLIA": "FOL",
    "SASZETKA": "SASZ",
    "OBWOLUTA": "OBW",
    "WIZUALIZACJE": "WIZKA",
}


def _load_change_log() -> dict:
    if not CHANGE_LOG_FILE.is_file():
        return {"entries": [], "redo": []}
    return json.loads(CHANGE_LOG_FILE.read_text(encoding="utf-8"))


def _save_change_log(data: dict) -> None:
    CHANGE_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CHANGE_LOG_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def paths_from_change_log() -> list[tuple[str, str]]:
    """[(revision_path, code), ...] z zapisanych rename_carrier."""
    data = _load_change_log()
    out: list[tuple[str, str]] = []
    for e in data.get("entries") or []:
        if e.get("action") != "rename_carrier":
            continue
        fr = e.get("folder_rename") or {}
        new_path = fr.get("new_path") or ""
        new_name = fr.get("new_name") or Path(new_path).name
        code = (e.get("carrier_to") or "").strip().upper()
        head = new_name.split(" - ")[0].strip()
        if not code:
            code = LONG_TO_CODE.get(head) or LONG_TO_CODE.get(head.upper()) or ""
        if not new_path or not code:
            continue
        # Napraw tylko gdy folder nadal ma PELNY prefiks
        if head.upper() in {k.upper() for k in LONG_TO_CODE} or head in LONG_TO_CODE:
            out.append((new_path, code))
    return out


def main() -> int:
    dry = "--apply" not in sys.argv
    jobs = paths_from_change_log()
    # dedupe by path
    seen = set()
    uniq = []
    for path, code in jobs:
        key = path.replace("/", "\\").lower()
        if key in seen:
            continue
        seen.add(key)
        uniq.append((path, code))

    print(f"Z change-log: {len(uniq)} folderow do naprawy (dry_run={dry})")
    results = []
    for path, code in uniq:
        p = Path(path)
        if not p.is_dir():
            print(f"  SKIP (brak): {path}")
            results.append({"ok": False, "error": "missing", "path": path})
            continue
        head = p.name.split(" - ")[0]
        print(f"  {head} -> {code}: {p.name}")
        if dry:
            continue
        res = rename_revision_prefix_on_disk(str(p), code, rename_files=False)
        results.append(res)
        print(f"    -> {res.get('ok')} {res.get('new_name') or res.get('error')}")

        if res.get("ok") and not res.get("noop"):
            data = _load_change_log()
            entry = {
                "id": "chg_" + str(int(datetime.now(timezone.utc).timestamp() * 1000)),
                "ts": datetime.now(timezone.utc).isoformat(),
                "action": "rename_carrier",
                "category": "carrier",
                "actor": "system:fix_doypack_folder_prefixes",
                "carrier_from": head,
                "carrier_to": code,
                "folder_rename": {
                    "old_path": res.get("old_path"),
                    "new_path": res.get("new_path"),
                    "old_name": res.get("old_name"),
                    "new_name": res.get("new_name"),
                },
                "file_renames": [],
                "note": "Naprawa: pelny prefiks folderu -> skrot (UI nadal pelna nazwa)",
            }
            data.setdefault("entries", []).insert(0, entry)
            _save_change_log(data)

    if dry:
        print("\nDry-run. Uruchom z --apply aby wykonac rename.")
    else:
        ok = sum(1 for r in results if r.get("ok"))
        print(f"\nGotowe: {ok}/{len(results)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
