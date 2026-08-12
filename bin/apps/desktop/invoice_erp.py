"""
ERP invoice sync contract (bidirectional stub).

Not a live ERP connector. Persists sync direction + last_import / last_export
in apps/web/data/invoice-erp-sync.json and stages export payloads for a future
provider push.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

LoadJson = Callable[[Path, Any], Any]
SaveJson = Callable[[Path, Any], None]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


DEFAULT_SYNC: dict[str, Any] = {
    "version": 1,
    "direction": "bidirectional",
    "modes": {
        "import": "erp_to_dam",
        "export": "dam_to_erp",
    },
    "status": "idle",
    "last_import": None,
    "last_export": None,
    "last_error": None,
    "erp_provider": "stub",
    "invoice_count": 0,
    "exported_count": 0,
    "updated_at": None,
}


def sync_file(web_root: Path) -> Path:
    return web_root / "data" / "invoice-erp-sync.json"


def export_stage_file(web_root: Path) -> Path:
    return web_root / "data" / "invoice-erp-export-last.json"


def default_sync() -> dict[str, Any]:
    return dict(DEFAULT_SYNC)


def load_sync(web_root: Path, load_json: LoadJson) -> dict[str, Any]:
    data = load_json(sync_file(web_root), default_sync())
    if not isinstance(data, dict):
        return default_sync()
    out = default_sync()
    out.update(data)
    if not isinstance(out.get("modes"), dict):
        out["modes"] = dict(DEFAULT_SYNC["modes"])
    return out


def save_sync(web_root: Path, state: dict[str, Any], save_json: SaveJson) -> dict[str, Any]:
    state = dict(state)
    state["updated_at"] = utc_now()
    save_json(sync_file(web_root), state)
    return state


def mark_import(
    web_root: Path,
    *,
    imported: int,
    load_json: LoadJson,
    save_json: SaveJson,
    error: str | None = None,
) -> dict[str, Any]:
    state = load_sync(web_root, load_json)
    now = utc_now()
    state["direction"] = "bidirectional"
    state["last_import"] = now
    state["invoice_count"] = int(imported) if imported is not None else state.get("invoice_count") or 0
    if error:
        state["status"] = "error"
        state["last_error"] = error
    else:
        state["status"] = "ok"
        state["last_error"] = None
    return save_sync(web_root, state, save_json)


def export_invoices(
    web_root: Path,
    invoices: list[dict],
    *,
    load_json: LoadJson,
    save_json: SaveJson,
    dry_run: bool = False,
) -> dict[str, Any]:
    """
    Stub push DAM -> ERP.
    Stages payload to invoice-erp-export-last.json and updates sync state.
    """
    state = load_sync(web_root, load_json)
    now = utc_now()
    payload = {
        "ok": True,
        "mode": "dam_to_erp",
        "provider": state.get("erp_provider") or "stub",
        "dry_run": bool(dry_run),
        "exported_at": now,
        "count": len(invoices),
        "invoices": invoices,
    }
    if not dry_run:
        stage = export_stage_file(web_root)
        stage.parent.mkdir(parents=True, exist_ok=True)
        stage.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        state["last_export"] = now
        state["exported_count"] = len(invoices)
        state["status"] = "ok"
        state["last_error"] = None
        state["direction"] = "bidirectional"
        save_sync(web_root, state, save_json)
    return {
        "ok": True,
        "dry_run": bool(dry_run),
        "exported": len(invoices),
        "exported_at": now,
        "provider": state.get("erp_provider") or "stub",
        "direction": "dam_to_erp",
        "staged": not dry_run,
        "sync": load_sync(web_root, load_json) if not dry_run else state,
    }


def status_payload(web_root: Path, load_json: LoadJson) -> dict[str, Any]:
    state = load_sync(web_root, load_json)
    return {
        "ok": True,
        "direction": state.get("direction") or "bidirectional",
        "modes": state.get("modes") or dict(DEFAULT_SYNC["modes"]),
        "status": state.get("status") or "idle",
        "last_import": state.get("last_import"),
        "last_export": state.get("last_export"),
        "last_error": state.get("last_error"),
        "erp_provider": state.get("erp_provider") or "stub",
        "invoice_count": state.get("invoice_count") or 0,
        "exported_count": state.get("exported_count") or 0,
        "updated_at": state.get("updated_at"),
        "endpoints": {
            "list": "GET /finance/invoices",
            "import": "POST /finance/invoices/import",
            "export": "POST /finance/invoices/export",
            "status": "GET /finance/invoices/erp-status",
        },
        "sync": state,
    }
