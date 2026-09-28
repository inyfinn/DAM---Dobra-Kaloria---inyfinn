# -*- coding: utf-8 -*-
"""Tryb danych TEGO komputera: LIVE (wszystko z bazy) albo LOKALNY (tylko ROOT).

28.09.2026 (wlasciciel): "Trzeba moc przelaczac sie w aplikacji. Tryb LIVE -
wszystko z bazy danych, oraz LOKALNY - dane tylko z ROOT."

  live  - jak dotad: migawki (index_snapshots.pull_newer) i scalanie wierszy
          (asset_sync_runner.run_once) pobieraja katalog z bazy.
  local - pobieranie z bazy i scalanie stoja; build-branding-index.py pisze
          branding-index.json ze skanu ROOT, file-index.json z build-file-index.py.
          Publikacja do bazy dziala jak dotad (bramka wlasciciela w bazie
          decyduje, czy zapis przejdzie).

Ustawienie per komputer, w data/data-mode.json (nie synchronizowane, nie w instalatorze).
Brak pliku / blad odczytu = live.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

LIVE = "live"
LOCAL = "local"
MODES = (LIVE, LOCAL)

MODE_FILE = Path(os.environ.get("DAM_DATA_MODE_FILE")
                 or Path(__file__).resolve().parent / "data" / "data-mode.json")


def get_mode() -> str:
    try:
        mode = str(json.loads(MODE_FILE.read_text(encoding="utf-8")).get("mode") or "")
    except (OSError, ValueError, AttributeError):
        return LIVE
    return mode if mode in MODES else LIVE


def is_local() -> bool:
    return get_mode() == LOCAL


def set_mode(mode: str) -> dict:
    mode = str(mode or "").strip().lower()
    if mode not in MODES:
        return {"ok": False, "error": "bad_mode"}
    MODE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = MODE_FILE.with_name(MODE_FILE.name + f".{os.getpid()}.tmp")
    payload = {"mode": mode, "changed_at": datetime.now(timezone.utc).isoformat()}
    tmp.write_text(json.dumps(payload), encoding="utf-8")
    os.replace(tmp, MODE_FILE)
    return {"ok": True, **payload}
