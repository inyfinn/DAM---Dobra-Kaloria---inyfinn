# -*- coding: utf-8 -*-
"""Single cross-process index supervisor (bridge-owned).

Owns product file-index watcher for both launch.py and serve_browser.py.
Uses O_EXCL supervisor lock so duplicates become no-ops.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any

from rebuild_lock import (
    DATA_DIR,
    acquire_lock,
    lock_is_stale,
    mark_cancel_requested,
    read_lock,
    status_from_lock,
)

DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = DESKTOP_DIR.parent / "web"
WATCH_SCRIPT = WEB_ROOT / "scripts" / "watch-file-index.py"
SUPERVISOR_LOCK = DATA_DIR / "index-supervisor.lock.json"
WATCHER_STATUS = DATA_DIR / "index-watcher-status.json"
WATCHER_LOG = DATA_DIR / "index-watcher.log"
PRODUCT_REBUILD_LOCK = DATA_DIR / "index-rebuild.lock.json"
CONTROL_FILE = DATA_DIR / "index-control.json"
INDEX_FILE = WEB_ROOT / "data" / "file-index.json"
WEB_INDEX = INDEX_FILE
BRANDING_HEAD = WEB_ROOT / "data" / "branding-grid-head.json"
LIVE_FILE = DATA_DIR / "index-live.json"
SNAPSHOT_FILE = DATA_DIR / "index-run-snapshot.json"
COMPARE_SNAPSHOT_FILE = DATA_DIR / "index-compare-snapshot.json"
COMPARE_SNAPSHOT_PREV = DATA_DIR / "index-compare-snapshot.json.prev"
REPORT_FILE = DATA_DIR / "index-last-report.json"
REBUILD_LOG_FILE = DATA_DIR / "index-rebuild.log"
MAX_LOG_BYTES = 2_000_000
MAX_NEW_ITEMS = 300
REPORT_ITEM_CAP = 150
REPORT_LIST_CAP = 50
COMPARE_SCHEMA_VERSION = 2
_LIVE_KEYS = ("current_path", "current_label", "products_done", "products_total")
_CAT_RE = re.compile(r"\[([A-Za-z]{1,8})\]\s+(.+?):\s+products so far\s+(\d+)")
_ARCH_RE = re.compile(r"\[archive\][^\n:]*:\s+(.+)$")
_SKIP_ROOT_RE = re.compile(r"skip missing root \[([A-Za-z]{1,8})\]:\s+(.+)$")
_SKIP_CAT_RE = re.compile(r"skip cat\s+(.+?):")
HOURLY_SEC_DEFAULT = float(os.environ.get("DAM_INDEX_HOURLY_SEC", "3600") or "3600")
FIRST_DELAY_SEC_DEFAULT = float(os.environ.get("DAM_INDEX_FIRST_DELAY_SEC", "20") or "20")

CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)


def index_builder_env(base: dict[str, str] | None = None) -> dict[str, str]:
    """Every spawn of build-file-index / watch-file-index must set this."""
    env = dict(base if base is not None else os.environ)
    env["DAM_INDEX_LIVE_FILE"] = str(LIVE_FILE)
    return env


_state_lock = threading.Lock()
_owner: "IndexSupervisor | None" = None


def _utc() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _rotate_log_if_needed(path: Path) -> None:
    try:
        if path.is_file() and path.stat().st_size > MAX_LOG_BYTES:
            bak = path.with_suffix(path.suffix + ".1")
            if bak.is_file():
                bak.unlink()
            path.replace(bak)
    except OSError:
        pass


def write_watcher_status(payload: dict[str, Any], *, preserve_last: bool = True) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    body = dict(payload)
    if preserve_last:
        prev = read_watcher_status()
        for key in (
            "last_ok",
            "last_rc",
            "last_error",
            "last_started",
            "last_finished",
            "last_duration_sec",
            "current_path",
            "current_label",
            "products_done",
            "products_total",
        ):
            if key not in body and key in prev and prev.get(key) is not None:
                body[key] = prev.get(key)
    # Explicit run state: null last_ok = no successful rebuild yet (not a green success).
    if body.get("last_ok") is None and "awaiting_first_rebuild" not in body:
        body["awaiting_first_rebuild"] = True
    elif body.get("last_ok") is True:
        body["awaiting_first_rebuild"] = False
    body["updated_at"] = _utc()
    text = json.dumps(body, ensure_ascii=False, indent=2) + "\n"
    tmp = WATCHER_STATUS.with_name(WATCHER_STATUS.name + f".{os.getpid()}.tmp")
    try:
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, WATCHER_STATUS)
    except OSError:
        # Windows race with concurrent readers/writers: best-effort direct write
        try:
            WATCHER_STATUS.write_text(text, encoding="utf-8")
        except OSError:
            pass
        try:
            if tmp.is_file():
                tmp.unlink()
        except OSError:
            pass


def read_watcher_status() -> dict[str, Any]:
    if not WATCHER_STATUS.is_file():
        return {"ok": False, "watcher_ok": False, "error": "no_status"}
    try:
        data = json.loads(WATCHER_STATUS.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {"ok": False, "watcher_ok": False}
    except (OSError, json.JSONDecodeError) as exc:
        return {"ok": False, "watcher_ok": False, "error": str(exc)}


def supervisor_lock_status() -> dict[str, Any]:
    return status_from_lock(SUPERVISOR_LOCK, ttl_sec=120)


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + f".{os.getpid()}.tmp")
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    try:
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, path)
    except OSError:
        try:
            path.write_text(text, encoding="utf-8")
        except OSError:
            pass
        try:
            if tmp.is_file():
                tmp.unlink()
        except OSError:
            pass


def read_control() -> dict[str, Any]:
    if not CONTROL_FILE.is_file():
        return {}
    try:
        data = json.loads(CONTROL_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def write_control(payload: dict[str, Any]) -> None:
    body = dict(payload)
    body["updated_at"] = _utc()
    _write_json_atomic(CONTROL_FILE, body)


def read_live() -> dict[str, Any]:
    if not LIVE_FILE.is_file():
        return {}
    try:
        data = json.loads(LIVE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def write_live(payload: dict[str, Any]) -> None:
    body = dict(payload)
    body["updated_at"] = _utc()
    _write_json_atomic(LIVE_FILE, body)


def read_run_snapshot() -> dict[str, Any]:
    if not SNAPSHOT_FILE.is_file():
        return {}
    try:
        data = json.loads(SNAPSHOT_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def parse_builder_live_line(line: str) -> dict[str, Any] | None:
    raw = str(line or "").strip()
    if not raw:
        return None
    m = _CAT_RE.search(raw)
    if m:
        brand, cat, n = m.group(1), m.group(2).strip(), int(m.group(3))
        return {
            "current_brand": brand,
            "current_cat": cat,
            "current_label": f"{brand} · {cat}",
            "products_done": n,
        }
    m = _ARCH_RE.search(raw)
    if m:
        name = m.group(1).strip()
        if name:
            return {"current_label": name, "current_path": name}
    m = _SKIP_ROOT_RE.search(raw)
    if m:
        brand, path = m.group(1), m.group(2).strip()
        return {
            "current_brand": brand,
            "current_label": f"{brand} · brak rootu",
            "current_path": path,
        }
    m = _SKIP_CAT_RE.search(raw)
    if m:
        cat = m.group(1).strip()
        return {"current_label": cat, "current_cat": cat}
    return None


def resolve_live_path(live: dict[str, Any], snap: dict[str, Any] | None = None) -> str:
    existing = str(live.get("current_path") or "").strip()
    if existing and (":" in existing or existing.startswith("/") or existing.startswith("\\\\")):
        return existing
    brand = str(live.get("current_brand") or "").strip()
    cat = str(live.get("current_cat") or "").strip()
    roots = (snap or {}).get("roots") if isinstance((snap or {}).get("roots"), list) else []
    if not roots:
        idx = _load_web_index()
        roots = []
        for r in idx.get("roots") or []:
            if isinstance(r, dict) and r.get("path"):
                roots.append({"brand": r.get("brand") or "", "path": r.get("path")})
    if brand and cat:
        for r in roots:
            if str(r.get("brand") or "") == brand and r.get("path"):
                return str(Path(str(r["path"])) / cat)
    return existing or cat


def merge_live_into_watcher_status(live: dict[str, Any], *, snap: dict[str, Any] | None = None) -> None:
    if not live:
        return
    snap = snap or read_run_snapshot()
    path = resolve_live_path(live, snap)
    label = str(live.get("current_label") or "").strip()
    body = dict(read_watcher_status())
    if path:
        body["current_path"] = path
    if label:
        body["current_label"] = label
        body["current_item"] = label
        body["current_name"] = str(live.get("current_cat") or label)
    if live.get("products_done") is not None:
        body["products_done"] = live.get("products_done")
    if live.get("products_total") is not None:
        body["products_total"] = live.get("products_total")
    write_watcher_status(body)
    lv = dict(read_live())
    lv["running"] = True
    if path:
        lv["current_path"] = path
        lv["current_item"] = path
    if label:
        lv["current_label"] = label
        lv["current_name"] = str(live.get("current_cat") or label)
        if not lv.get("current_item"):
            lv["current_item"] = label
    if live.get("products_done") is not None:
        lv["products_done"] = live.get("products_done")
    if live.get("products_total") is not None:
        lv["products_total"] = live.get("products_total")
    elif lv.get("products_total") is None and snap:
        lv["products_total"] = snap.get("product_count")
    write_live(lv)


def _tail_new_lines(path: Path, pos: int) -> tuple[int, list[str]]:
    if not path.is_file():
        return pos, []
    try:
        size = path.stat().st_size
    except OSError:
        return pos, []
    if size < pos:
        pos = 0
    try:
        with path.open("r", encoding="utf-8", errors="replace") as fh:
            fh.seek(pos)
            chunk = fh.read()
            new_pos = fh.tell()
    except OSError:
        return pos, []
    if not chunk:
        return new_pos, []
    return new_pos, chunk.splitlines()


def mark_run_start() -> dict[str, Any]:
    return begin_run_snapshot()


def finalize_run_report(*, cancelled: bool, rc: int) -> dict[str, Any]:
    return complete_run_report(ok=(int(rc) == 0), cancelled=bool(cancelled), rc=int(rc))


def read_last_report() -> dict[str, Any]:
    return read_report()


def _hydrate_report_counts(data: dict[str, Any]) -> dict[str, Any]:
    """Never serve a blank 'nothing' when counts exist. Do not json.loads file-index here."""
    if not isinstance(data, dict):
        data = {"ok": False, "items": []}
    items = data.get("items") if isinstance(data.get("items"), list) else []
    data["items"] = items
    added = int(data.get("added") or 0)
    changed = int(data.get("changed") or 0)
    after = int(data.get("product_count_after") or 0)
    before = int(data.get("product_count_before") or 0)
    scanned = int(data.get("scanned") or after or before or 0)
    data["scanned"] = scanned
    data["added"] = added
    data["changed"] = changed
    unchanged = int(data.get("unchanged") or max(0, scanned - added - changed))
    data["unchanged"] = unchanged
    data["empty"] = scanned <= 0 and len(items) == 0
    if not isinstance(data.get("counts"), dict):
        data["counts"] = {
            "new": int(data.get("added") or 0),
            "updated": int(data.get("changed") or 0),
            "unchanged": unchanged,
            "removed": int(data.get("removed") or 0),
            "elements_scanned": scanned,
            "files_scanned": int(data.get("files_after") or data.get("files_before") or 0),
            "branding_materials": int(data.get("branding_scanned") or 0),
        }
    for key in ("new_items", "updated_items", "removed_items", "warnings"):
        if not isinstance(data.get(key), list):
            data[key] = []
    if "comparison_ok" not in data:
        data["comparison_ok"] = bool(data.get("ok")) and not bool(data.get("cancelled"))
    if "mode" not in data:
        data["mode"] = "full"
    return data


def read_report() -> dict[str, Any]:
    if not REPORT_FILE.is_file():
        ctrl = read_control()
        items = ctrl.get("last_run_new")
        if isinstance(items, list):
            return _hydrate_report_counts(
                {
                    "ok": True,
                    "items": items,
                    "finished_at": str(ctrl.get("last_run_at") or ""),
                    "from_control": True,
                    "added": int(ctrl.get("last_run_added") or 0),
                    "changed": int(ctrl.get("last_run_changed") or 0),
                }
            )
        return _hydrate_report_counts({"ok": True, "items": [], "finished_at": ""})
    try:
        data = json.loads(REPORT_FILE.read_text(encoding="utf-8"))
        return _hydrate_report_counts(data if isinstance(data, dict) else {"ok": False, "items": []})
    except (OSError, json.JSONDecodeError):
        return _hydrate_report_counts({"ok": False, "items": []})


def _norm_key(path: str) -> str:
    raw = str(path or "").replace("\\", "/").strip()
    if len(raw) >= 2 and raw[1] == ":":
        raw = raw[0].upper() + raw[1:]
    if raw.endswith("/") and len(raw) > 3:
        raw = raw.rstrip("/")
    return raw


def _content_sig(entry: dict[str, Any]) -> str:
    """mtime+size; reuse an existing hash when the indexer already stored one."""
    digest = entry.get("hash") or entry.get("sha256") or entry.get("digest")
    if digest:
        return f"h:{digest}"
    try:
        size = int(entry.get("size") or 0)
    except (TypeError, ValueError):
        size = 0
    mtime = str(entry.get("mtime") or entry.get("mtime_ms") or "")
    return f"s:{size}:m:{mtime}"


def _iter_index_file_entries(idx: dict[str, Any]):
    for prod in idx.get("products") or []:
        if not isinstance(prod, dict):
            continue
        for rev in prod.get("revisions") or []:
            if not isinstance(rev, dict):
                continue
            for lst in (rev.get("files_by_role") or {}).values():
                for ent in lst or []:
                    if isinstance(ent, dict) and ent.get("path"):
                        yield ent
            for ent in rev.get("wizki") or []:
                if isinstance(ent, dict) and ent.get("path"):
                    yield ent


def _file_snapshot_map(idx: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Unique files from file-index.json. Key = normalized path (not product id)."""
    out: dict[str, dict[str, Any]] = {}
    for ent in _iter_index_file_entries(idx):
        key = _norm_key(str(ent.get("path") or ""))
        if not key:
            continue
        name = str(ent.get("name") or Path(key).name)
        try:
            size = int(ent.get("size") or 0)
        except (TypeError, ValueError):
            size = 0
        out[key] = {
            "key": key,
            "name": name,
            "path": key,
            "kind": "file",
            "size": size,
            "mtime": str(ent.get("mtime") or ""),
            "sig": _content_sig(ent),
        }
    return out


def _index_snapshot_map(idx: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for prod in idx.get("products") or []:
        if not isinstance(prod, dict):
            continue
        pid = str(prod.get("id") or prod.get("path") or "")
        if not pid:
            continue
        indexes = prod.get("indexes") or []
        seen: set[str] = set()
        for rev in prod.get("revisions") or []:
            if not isinstance(rev, dict):
                continue
            for lst in (rev.get("files_by_role") or {}).values():
                for ent in lst or []:
                    if isinstance(ent, dict) and ent.get("path"):
                        seen.add(_norm_key(str(ent["path"])))
            for ent in rev.get("wizki") or []:
                if isinstance(ent, dict) and ent.get("path"):
                    seen.add(_norm_key(str(ent["path"])))
        out[pid] = {
            "id": pid,
            "name": prod.get("display_name") or prod.get("name") or pid,
            "path": prod.get("path") or "",
            "category": prod.get("category") or "",
            "revision_count": int(prod.get("revision_count") or len(prod.get("revisions") or [])),
            "indexes": [str(x) for x in indexes],
            "files": len(seen),
        }
    return out


def _attach_product_sigs(
    prod_map: dict[str, dict[str, Any]], file_map: dict[str, dict[str, Any]]
) -> None:
    for prod in prod_map.values():
        ppath = _norm_key(str(prod.get("path") or ""))
        bits = [
            f"{k}:{file_map[k].get('sig')}"
            for k in file_map
            if ppath and (k == ppath or k.startswith(ppath + "/"))
        ]
        blob = "|".join(sorted(bits)) if bits else f"files:{prod.get('files')}"
        prod["sig"] = hashlib.sha256(blob.encode("utf-8", errors="replace")).hexdigest()[:16]


def _branding_snapshot_map() -> dict[str, dict[str, Any]]:
    """Slim branding-grid-head only (never fat branding-index.json)."""
    if not BRANDING_HEAD.is_file():
        return {}
    try:
        data = json.loads(BRANDING_HEAD.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    assets = data.get("assets") if isinstance(data, dict) else []
    out: dict[str, dict[str, Any]] = {}
    if not isinstance(assets, list):
        return out
    for asset in assets:
        if not isinstance(asset, dict):
            continue
        aid = str(asset.get("id") or asset.get("path") or "")
        if not aid:
            continue
        tags = asset.get("tags") or []
        tag_list = [str(t) for t in tags] if isinstance(tags, list) else []
        name = asset.get("name") or aid
        path = asset.get("path") or ""
        role = asset.get("asset_role") or ""
        entry = {
            "id": aid,
            "name": name,
            "path": path,
            "category": role or asset.get("source") or "",
            "role": role,
            "tags": tag_list,
            "size": asset.get("size") or 0,
            "mtime": asset.get("mtime") or asset.get("mtime_ms") or "",
            "hash": asset.get("hash") or asset.get("digest") or "",
        }
        entry["sig"] = _content_sig(entry) if (entry["size"] or entry["mtime"] or entry["hash"]) else (
            f"n:{name}|p:{_norm_key(str(path))}|r:{role}|t:{','.join(tag_list)}"
        )
        out[aid] = entry
    return out


def _entry_changed(old: dict[str, Any], cur: dict[str, Any], *, source: str) -> bool:
    if old.get("sig") and cur.get("sig"):
        return str(old.get("sig")) != str(cur.get("sig"))
    if source == "branding":
        return (
            str(old.get("name") or "") != str(cur.get("name") or "")
            or str(old.get("path") or "") != str(cur.get("path") or "")
            or str(old.get("role") or "") != str(cur.get("role") or "")
            or list(old.get("tags") or []) != list(cur.get("tags") or [])
        )
    return (
        int(old.get("revision_count") or 0) != int(cur.get("revision_count") or 0)
        or list(old.get("indexes") or []) != list(cur.get("indexes") or [])
        or int(old.get("files") or 0) != int(cur.get("files") or 0)
        or str(old.get("path") or "") != str(cur.get("path") or "")
        or str(old.get("name") or "") != str(cur.get("name") or "")
    )


def _diff_maps(
    old_map: dict[str, Any],
    now_map: dict[str, Any],
    *,
    source: str,
    cap: int,
) -> tuple[list[dict[str, Any]], int, int, int]:
    items: list[dict[str, Any]] = []
    added = 0
    changed = 0
    for pid, cur in now_map.items():
        if not isinstance(cur, dict):
            continue
        old = old_map.get(pid) if isinstance(old_map.get(pid), dict) else None
        kind = ""
        if old is None:
            kind = "added"
            added += 1
        elif _entry_changed(old, cur, source=source):
            kind = "changed"
            changed += 1
        if not kind:
            continue
        if len(items) < cap:
            items.append(
                {
                    "id": pid,
                    "kind": kind,
                    "name": cur.get("name") or pid,
                    "label": cur.get("name") or pid,
                    "path": cur.get("path") or "",
                    "category": cur.get("category") or "",
                    "source": source,
                }
            )
    for pid, old in old_map.items():
        if pid in now_map or not isinstance(old, dict):
            continue
        if len(items) < cap:
            items.append(
                {
                    "id": pid,
                    "kind": "removed",
                    "name": old.get("name") or pid,
                    "label": old.get("name") or pid,
                    "path": old.get("path") or "",
                    "category": old.get("category") or "",
                    "source": source,
                }
            )
    unchanged = max(0, len(now_map) - added - changed)
    return items, added, changed, unchanged


def _list_item(key: str, entry: dict[str, Any], *, kind: str) -> dict[str, Any]:
    return {
        "key": key,
        "name": str(entry.get("name") or Path(str(entry.get("path") or key)).name or key),
        "path": str(entry.get("path") or key),
        "kind": kind,
    }


def _diff_signature_maps(
    old_map: dict[str, Any],
    now_map: dict[str, Any],
    *,
    item_kind: str,
    cap: int = REPORT_LIST_CAP,
) -> dict[str, Any]:
    """NEW / UPDATED / UNCHANGED / REMOVED by stable key + content signature."""
    new_n = updated_n = 0
    new_items: list[dict[str, Any]] = []
    updated_items: list[dict[str, Any]] = []
    removed_items: list[dict[str, Any]] = []
    for key, cur in now_map.items():
        if not isinstance(cur, dict):
            continue
        old = old_map.get(key) if isinstance(old_map.get(key), dict) else None
        if old is None:
            new_n += 1
            if len(new_items) < cap:
                new_items.append(_list_item(key, cur, kind=item_kind))
        elif str(old.get("sig") or _content_sig(old)) != str(cur.get("sig") or _content_sig(cur)):
            updated_n += 1
            if len(updated_items) < cap:
                updated_items.append(_list_item(key, cur, kind=item_kind))
    removed_n = 0
    for key, old in old_map.items():
        if key in now_map or not isinstance(old, dict):
            continue
        removed_n += 1
        if len(removed_items) < cap:
            removed_items.append(_list_item(key, old, kind=item_kind))
    unchanged_n = max(0, len(now_map) - new_n - updated_n)
    return {
        "new": new_n,
        "updated": updated_n,
        "unchanged": unchanged_n,
        "removed": removed_n,
        "new_items": new_items,
        "updated_items": updated_items,
        "removed_items": removed_items,
        "new_items_truncated": new_n > cap,
        "updated_items_truncated": updated_n > cap,
        "removed_items_truncated": removed_n > cap,
    }


def _load_web_index() -> dict[str, Any]:
    if not WEB_INDEX.is_file():
        return {}
    try:
        data = json.loads(WEB_INDEX.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _load_json_dict(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _validate_compare_snapshot(body: dict[str, Any] | None) -> tuple[bool, str]:
    """Reject half-written / empty maps so we never invent all-new or all-unchanged."""
    if not isinstance(body, dict) or not body:
        return False, "snapshot_missing"
    files = body.get("files")
    products = body.get("products")
    if not isinstance(files, dict):
        if isinstance(products, dict) and products:
            return False, "snapshot_legacy_no_files"
        return False, "snapshot_missing_files"
    n = len(files)
    stated = body.get("file_count")
    try:
        stated_n = int(stated) if stated is not None else n
    except (TypeError, ValueError):
        return False, "snapshot_file_count_invalid"
    if stated_n != n:
        return False, "snapshot_file_count_mismatch"
    prod_n = len(products) if isinstance(products, dict) else 0
    if n == 0 and prod_n > 0:
        return False, "snapshot_files_empty_but_products_present"
    schema = body.get("schema_version")
    if schema is not None:
        try:
            if int(schema) < 2:
                return False, "snapshot_schema_too_old"
        except (TypeError, ValueError):
            return False, "snapshot_schema_invalid"
    return True, ""


def _read_compare_baseline() -> tuple[dict[str, Any] | None, str]:
    """Prefer this-run snapshot; fall back to last-good compare file, then .prev."""
    last_reason = "snapshot_missing"
    for path, label in (
        (SNAPSHOT_FILE, "run_snapshot"),
        (COMPARE_SNAPSHOT_FILE, "compare_snapshot"),
        (COMPARE_SNAPSHOT_PREV, "compare_snapshot_prev"),
    ):
        if not path.is_file():
            continue
        body = _load_json_dict(path)
        if body is None:
            last_reason = f"{label}_corrupt"
            continue
        ok, reason = _validate_compare_snapshot(body)
        if ok:
            return body, label
        last_reason = reason
    return None, last_reason


def _persist_compare_snapshot(
    *,
    files: dict[str, Any],
    products: dict[str, Any],
    branding: dict[str, Any],
) -> None:
    payload = {
        "schema_version": COMPARE_SCHEMA_VERSION,
        "written_at": _utc(),
        "files": files,
        "file_count": len(files),
        "products": products,
        "product_count": len(products),
        "branding": branding,
        "branding_count": len(branding),
    }
    if COMPARE_SNAPSHOT_FILE.is_file():
        try:
            existing = COMPARE_SNAPSHOT_FILE.read_bytes()
            if existing:
                prev_tmp = COMPARE_SNAPSHOT_PREV.with_name(
                    COMPARE_SNAPSHOT_PREV.name + f".{os.getpid()}.tmp"
                )
                prev_tmp.write_bytes(existing)
                os.replace(prev_tmp, COMPARE_SNAPSHOT_PREV)
        except OSError:
            try:
                if "prev_tmp" in locals() and prev_tmp.is_file():
                    prev_tmp.unlink()
            except OSError:
                pass
    _write_json_atomic(COMPARE_SNAPSHOT_FILE, payload)


def _append_run_log_line(payload: dict[str, Any]) -> None:
    _rotate_log_if_needed(REBUILD_LOG_FILE)
    try:
        REBUILD_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        line = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        with REBUILD_LOG_FILE.open("a", encoding="utf-8", errors="replace") as fh:
            fh.write(line + "\n")
        _rotate_log_if_needed(REBUILD_LOG_FILE)
    except OSError:
        pass


def _duration_ms(started_at: str, started_mono: float | None, finished_at: str) -> int:
    if started_mono:
        return max(0, int((time.time() - float(started_mono)) * 1000))
    try:
        from datetime import datetime

        a = datetime.fromisoformat(str(started_at).replace("Z", "+00:00"))
        b = datetime.fromisoformat(str(finished_at).replace("Z", "+00:00"))
        return max(0, int((b - a).total_seconds() * 1000))
    except Exception:
        return 0


def begin_run_snapshot() -> dict[str, Any]:
    idx = _load_web_index()
    prev = _index_snapshot_map(idx)
    files = _file_snapshot_map(idx)
    _attach_product_sigs(prev, files)
    nprod = len(prev)
    nfiles = len(files)
    branding = _branding_snapshot_map()
    snap = {
        "schema_version": COMPARE_SCHEMA_VERSION,
        "started_at": _utc(),
        "started_mono": time.time(),
        "products": prev,
        "product_count": nprod,
        "files": files,
        "file_count": nfiles,
        "branding": branding,
        "branding_count": len(branding),
    }
    try:
        if WEB_INDEX.is_file():
            snap["mtime"] = WEB_INDEX.stat().st_mtime
    except OSError:
        snap["mtime"] = None
    roots: list[dict[str, Any]] = []
    for r in idx.get("roots") or []:
        if isinstance(r, dict) and r.get("path"):
            roots.append({"brand": r.get("brand") or "", "path": r.get("path")})
    snap["roots"] = roots
    _write_json_atomic(SNAPSHOT_FILE, snap)
    write_live(
        {
            "running": True,
            "current_item": "",
            "current_name": "",
            "current_path": "",
            "current_label": "",
            "products_done": 0,
            "products_total": nprod,
        }
    )
    ctrl = read_control()
    ctrl["run_started_at"] = snap["started_at"]
    write_control(ctrl)
    return snap


def complete_run_report(*, ok: bool = True, cancelled: bool = False, rc: int | None = None) -> dict[str, Any]:
    """Write index-last-report.json.

    Contract (additive; keep legacy flat keys the current UI already reads):
      counts: {new, updated, unchanged, removed, elements_scanned, files_scanned, branding_materials}
        new/updated/unchanged/removed = unique product files (path key, sig = hash or mtime+size)
        elements_scanned = logical products in file-index
        files_scanned = unique files in file-index
        branding_materials = branding-grid-head assets
      new_items / updated_items / removed_items: up to 50 x {key, name, path, kind}
      *_items_truncated: true when the matching counts.* exceeds 50
      started_at, finished_at, duration_ms, mode (full|incremental), comparison_ok, warnings[]
    Legacy: added/changed/unchanged/scanned/items/product_*/branding_*/files_before/files_after
    comparison_ok is true only when a valid previous snapshot existed and was compared.
    Zero changes + comparison_ok means verified match, not a failed compare.
    """
    warnings: list[str] = []
    prev_body, baseline_src = _read_compare_baseline()
    prev_ok, prev_reason = _validate_compare_snapshot(prev_body)
    if not prev_ok:
        warnings.append(f"nie udało się porównać: {prev_reason}")
        prev_body = prev_body if isinstance(prev_body, dict) else {}

    old_map = prev_body.get("products") if isinstance(prev_body.get("products"), dict) else {}
    old_brand = prev_body.get("branding") if isinstance(prev_body.get("branding"), dict) else {}
    old_files = prev_body.get("files") if isinstance(prev_body.get("files"), dict) else {}

    idx = _load_web_index()
    now_map = _index_snapshot_map(idx)
    now_files = _file_snapshot_map(idx)
    _attach_product_sigs(now_map, now_files)
    now_brand = _branding_snapshot_map()

    if prev_ok:
        brand_cap = min(MAX_NEW_ITEMS, 80)
        brand_items, b_added, b_changed, b_unchanged = _diff_maps(
            old_brand, now_brand, source="branding", cap=brand_cap
        )
        prod_items, p_added, p_changed, p_unchanged = _diff_maps(
            old_map, now_map, source="product", cap=max(0, MAX_NEW_ITEMS - len(brand_items))
        )
        items = brand_items + prod_items
        file_diff = _diff_signature_maps(old_files, now_files, item_kind="file", cap=REPORT_LIST_CAP)
        brand_diff = _diff_signature_maps(old_brand, now_brand, item_kind="branding", cap=REPORT_LIST_CAP)
    else:
        # Invalid baseline must not become "all new" or "all unchanged" as a verified result.
        brand_items, prod_items, items = [], [], []
        b_added = b_changed = 0
        b_unchanged = len(now_brand)
        p_added = p_changed = 0
        p_unchanged = len(now_map)
        file_diff = {
            "new": 0,
            "updated": 0,
            "unchanged": 0,
            "removed": 0,
            "new_items": [],
            "updated_items": [],
            "removed_items": [],
            "new_items_truncated": False,
            "updated_items_truncated": False,
            "removed_items_truncated": False,
        }
        brand_diff = {"removed": 0}

    files_after = len(now_files)
    files_before = len(old_files) if old_files else int(prev_body.get("file_count") or 0)
    scanned = len(now_map)
    added = p_added + b_added
    changed = p_changed + b_changed
    unchanged = p_unchanged
    p_removed = sum(1 for k in old_map if k not in now_map)
    b_removed = int(brand_diff["removed"])

    rebuild_ok = (rc is None or int(rc) == 0) and not cancelled
    comparison_ok = bool(prev_ok) and bool(now_files or now_map) and rebuild_ok
    if not rebuild_ok and rc is not None and int(rc) != 0 and not cancelled:
        warnings.append(f"nie udało się porównać: rebuild rc={rc} (indeks nie został przebudowany)")
        comparison_ok = False
    if cancelled:
        warnings.append("run cancelled")
        comparison_ok = False
    if prev_ok and not now_files and scanned > 0:
        warnings.append("nie udało się porównać: bieżący file-index nie ma plików")
        comparison_ok = False
    if comparison_ok:
        warnings = [w for w in warnings if not w.startswith("nie udało się porównać")]

    finished_at = _utc()
    started_at = str(prev_body.get("started_at") or "")
    duration_ms = _duration_ms(started_at, prev_body.get("started_mono"), finished_at)
    mode = "full"

    counts = {
        "new": int(file_diff["new"]),
        "updated": int(file_diff["updated"]),
        "unchanged": int(file_diff["unchanged"]),
        "removed": int(file_diff["removed"]),
        "elements_scanned": scanned,
        "files_scanned": files_after,
        "branding_materials": len(now_brand),
    }
    report = {
        "ok": bool(ok) and not cancelled,
        "cancelled": bool(cancelled),
        "rc": rc,
        "finished_at": finished_at,
        "generated_at": finished_at,
        "started_at": started_at,
        "duration_ms": duration_ms,
        "mode": mode,
        "comparison_ok": comparison_ok,
        "comparison_source": baseline_src if prev_ok else prev_reason,
        "warnings": warnings,
        "items": items,
        "added": added,
        "changed": changed,
        "unchanged": unchanged,
        "removed": counts["removed"],
        "scanned": scanned,
        "empty": scanned <= 0 and len(items) == 0,
        "product_count_before": int(prev_body.get("product_count") or len(old_map)),
        "product_count_after": scanned,
        "files_before": files_before,
        "files_after": files_after,
        "branding_added": b_added,
        "branding_changed": b_changed,
        "branding_unchanged": b_unchanged,
        "branding_removed": b_removed,
        "branding_scanned": len(now_brand),
        "product_added": p_added,
        "product_changed": p_changed,
        "product_unchanged": p_unchanged,
        "product_removed": p_removed,
        "counts": counts,
        "new_items": file_diff["new_items"],
        "updated_items": file_diff["updated_items"],
        "removed_items": file_diff["removed_items"],
        "new_items_truncated": bool(file_diff["new_items_truncated"]),
        "updated_items_truncated": bool(file_diff["updated_items_truncated"]),
        "removed_items_truncated": bool(file_diff["removed_items_truncated"]),
    }
    _write_json_atomic(REPORT_FILE, report)
    if now_files or now_map:
        try:
            _persist_compare_snapshot(files=now_files, products=now_map, branding=now_brand)
            snap_keep = _load_json_dict(SNAPSHOT_FILE) or {}
            snap_keep.update(
                {
                    "schema_version": COMPARE_SCHEMA_VERSION,
                    "files": now_files,
                    "file_count": len(now_files),
                    "products": now_map,
                    "product_count": len(now_map),
                    "branding": now_brand,
                    "branding_count": len(now_brand),
                }
            )
            _write_json_atomic(SNAPSHOT_FILE, snap_keep)
        except OSError as exc:
            warnings.append(f"compare_snapshot_write_failed: {exc}")
            report["warnings"] = warnings
            _write_json_atomic(REPORT_FILE, report)
    _append_run_log_line(
        {
            "ts": finished_at,
            "event": "index_run",
            "mode": mode,
            "duration_ms": duration_ms,
            "rc": rc,
            "comparison_ok": comparison_ok,
            "counts": counts,
        }
    )
    live = read_live()
    live["running"] = False
    live["current_item"] = ""
    live["current_label"] = ""
    live["current_path"] = ""
    live["current_name"] = ""
    live.pop("products_done", None)
    live.pop("products_total", None)
    write_live(live)
    ctrl = read_control()
    ctrl["last_run_at"] = report["finished_at"]
    ctrl["last_run_new"] = items
    ctrl["last_run_new_count"] = len(items)
    ctrl["last_run_added"] = report["added"]
    ctrl["last_run_changed"] = report["changed"]
    ctrl["last_run_unchanged"] = unchanged
    ctrl["last_run_scanned"] = scanned
    ctrl["last_run_removed"] = counts["removed"]
    ctrl["last_run_comparison_ok"] = comparison_ok
    write_control(ctrl)
    return report


def merge_branding_into_report() -> dict[str, Any]:
    """After branding-grid rebuild: merge head delta into the last file-index report."""
    prev_body = read_run_snapshot()
    old_brand = prev_body.get("branding") if isinstance(prev_body.get("branding"), dict) else {}
    now_brand = _branding_snapshot_map()
    brand_items, b_added, b_changed, b_unchanged = _diff_maps(
        old_brand, now_brand, source="branding", cap=80
    )
    report = read_report()
    existing = [
        it
        for it in (report.get("items") or [])
        if isinstance(it, dict) and it.get("source") != "branding"
    ]
    items = (brand_items + existing)[:MAX_NEW_ITEMS]
    p_added = int(report.get("product_added") or 0)
    p_changed = int(report.get("product_changed") or 0)
    report["items"] = items
    report["branding_added"] = b_added
    report["branding_changed"] = b_changed
    report["branding_unchanged"] = b_unchanged
    report["branding_removed"] = sum(1 for k in old_brand if k not in now_brand)
    report["branding_scanned"] = len(now_brand)
    report["added"] = p_added + b_added
    report["changed"] = p_changed + b_changed
    scanned = int(report.get("scanned") or report.get("product_count_after") or 0)
    report["scanned"] = scanned
    report["empty"] = scanned <= 0 and len(items) == 0
    report["branding_merged_at"] = _utc()
    counts = report.get("counts") if isinstance(report.get("counts"), dict) else {}
    counts["branding_materials"] = len(now_brand)
    report["counts"] = counts
    _write_json_atomic(REPORT_FILE, report)
    ctrl = read_control()
    ctrl["last_run_new"] = items
    ctrl["last_run_new_count"] = len(items)
    ctrl["last_run_added"] = report["added"]
    ctrl["last_run_changed"] = report["changed"]
    write_control(ctrl)
    return report


def _parse_iso(ts: str):
    if not ts:
        return None
    try:
        from datetime import datetime

        return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except Exception:
        return None


def is_snoozed() -> bool:
    until = str(read_control().get("snooze_until") or "")
    dt = _parse_iso(until)
    if dt is None:
        return False
    try:
        from datetime import datetime

        now = datetime.now().astimezone()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=now.tzinfo)
        return now < dt
    except Exception:
        return False


def snooze_until_end_of_day() -> dict[str, Any]:
    from datetime import datetime

    now = datetime.now().astimezone()
    eod = now.replace(hour=23, minute=59, second=59, microsecond=0)
    body = read_control()
    body["snooze_until"] = eod.isoformat()
    body["snooze_set_at"] = now.isoformat()
    body["cancel_requested"] = False
    write_control(body)
    return {
        "ok": True,
        "snoozed": True,
        "snooze_until": body["snooze_until"],
        "control_path": str(CONTROL_FILE),
    }


def clear_snooze() -> dict[str, Any]:
    body = read_control()
    body["snooze_until"] = ""
    write_control(body)
    return {"ok": True, "snoozed": False, "control_path": str(CONTROL_FILE)}


def peek_cancel() -> bool:
    return bool(read_control().get("cancel_requested"))


def consume_cancel() -> bool:
    body = read_control()
    hit = bool(body.get("cancel_requested"))
    if hit:
        body["cancel_requested"] = False
        body["cancel_consumed_at"] = _utc()
        write_control(body)
    return hit


def request_cancel() -> dict[str, Any]:
    body = read_control()
    body["cancel_requested"] = True
    body["cancel_at"] = _utc()
    write_control(body)
    killed = terminate_rebuild_child()
    try:
        mark_cancel_requested(PRODUCT_REBUILD_LOCK)
    except Exception:
        pass
    return {
        "ok": True,
        "cancel_requested": True,
        "control_path": str(CONTROL_FILE),
        **killed,
    }


def _terminate_pid(pid: int) -> bool:
    pid = int(pid or 0)
    if pid <= 0:
        return False
    try:
        if sys.platform == "win32":
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/T", "/F"],
                capture_output=True,
                timeout=8,
                creationflags=flags,
                check=False,
            )
            return True
        os.kill(pid, 15)
        return True
    except Exception:
        return False


def terminate_rebuild_child() -> dict[str, Any]:
    lock = read_lock(PRODUCT_REBUILD_LOCK)
    child = int(lock.get("child_pid") or 0)
    killed = False
    if child:
        killed = _terminate_pid(child)
    return {"child_pid": child, "killed": killed}


def read_run_snapshot() -> dict[str, Any]:
    try:
        if SNAPSHOT_FILE.is_file():
            data = json.loads(SNAPSHOT_FILE.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        pass
    return {}


def _tail_new_lines(path: Path, pos: int) -> tuple[int, list[str]]:
    try:
        size = path.stat().st_size if path.is_file() else 0
        if size < pos:
            pos = 0
        if size <= pos:
            return pos, []
        with path.open("r", encoding="utf-8", errors="replace") as fh:
            fh.seek(pos)
            chunk = fh.read()
            new_pos = fh.tell()
        lines = [ln.strip() for ln in chunk.splitlines() if ln.strip()]
        return new_pos, lines
    except OSError:
        return pos, []


def parse_builder_live_line(line: str) -> dict[str, Any] | None:
    raw = str(line or "").strip()
    if not raw:
        return None
    if raw.startswith("[live] "):
        parts = raw[7:].split("|")
        product = (parts[0] if parts else "").strip()
        slot = (parts[1] if len(parts) > 1 else "").strip()
        fname = (parts[2] if len(parts) > 2 else "").strip()
        path = (parts[3] if len(parts) > 3 else "").strip()
        bits = [bit for bit in (product, slot, fname) if bit]
        label = " / ".join(bits)
        return {
            "current_name": fname or slot or product,
            "current_path": path,
            "current_label": label,
            "current_item": label,
        }
    match = _CAT_RE.search(raw)
    if match:
        cat = match.group(2).strip()
        done = int(match.group(3))
        return {
            "current_name": cat,
            "current_label": cat,
            "current_item": cat,
            "products_done": done,
        }
    return None


def merge_live_into_watcher_status(live: dict[str, Any], *, snap: dict[str, Any] | None = None) -> None:
    if not isinstance(live, dict) or not live:
        return
    prev = read_live()
    body = dict(prev)
    for key, val in live.items():
        if val not in (None, ""):
            body[key] = val
    body["running"] = True
    if snap:
        if not body.get("products_total"):
            body["products_total"] = snap.get("product_count")
        if not body.get("files_total"):
            body["files_total"] = snap.get("file_count")
    write_live(body)
    status = read_watcher_status()
    label = str(body.get("current_item") or body.get("current_label") or "")
    status["current_name"] = body.get("current_name") or ""
    status["current_path"] = body.get("current_path") or ""
    status["current_item"] = label
    status["progress_message"] = label or status.get("progress_message") or "Indeksowanie"
    write_watcher_status(status)


def wait_rebuild_proc(
    proc: subprocess.Popen,
    *,
    lock_handle=None,
    on_tick=None,
    poll_sec: float = 0.4,
    log_file: Path | None = None,
) -> int:
    """Wait for build-file-index; stop on cancel flag or lock.cancel_requested."""
    from rebuild_lock import lock_cancel_requested

    log_path = Path(log_file) if log_file else WATCHER_LOG
    pos = 0
    try:
        if log_path.is_file():
            pos = log_path.stat().st_size
    except OSError:
        pos = 0
    snap = read_run_snapshot()

    while True:
        rc = proc.poll()
        if rc is not None:
            return int(rc)
        if peek_cancel() or lock_cancel_requested(PRODUCT_REBUILD_LOCK):
            try:
                proc.terminate()
            except Exception:
                pass
            _terminate_pid(int(getattr(proc, "pid", 0) or 0))
            try:
                proc.wait(timeout=8)
            except Exception:
                pass
            consume_cancel()
            return 130
        if callable(on_tick):
            try:
                on_tick()
            except Exception:
                pass
        try:
            pos, lines = _tail_new_lines(log_path, pos)
            live = None
            for line in lines:
                parsed = parse_builder_live_line(line)
                if parsed:
                    live = parsed
            if live:
                merge_live_into_watcher_status(live, snap=snap)
        except Exception:
            pass
        if lock_handle is not None:
            try:
                lock_handle.update(heartbeat_at=_utc())
            except Exception:
                pass
        time.sleep(max(0.2, float(poll_sec)))


def public_control() -> dict[str, Any]:
    body = read_control()
    snoozed = is_snoozed()
    return {
        "control_path": str(CONTROL_FILE),
        "cancel_requested": bool(body.get("cancel_requested")),
        "snoozed": snoozed,
        "snooze_until": str(body.get("snooze_until") or ""),
        "updated_at": body.get("updated_at") or "",
    }


def _progress_from_watcher(w: dict[str, Any], rebuild: dict[str, Any]) -> dict[str, Any]:
    running = bool((rebuild.get("held")) or str(w.get("stage") or "").endswith(":building") or str(w.get("stage") or "") == "building")
    started = str(w.get("last_started") or (rebuild.get("lock") or {}).get("started_at") or "")
    elapsed = w.get("elapsed_sec")
    eta = w.get("eta_sec")
    remaining = w.get("remaining_sec")
    kind = w.get("rebuild_kind") or w.get("kind") or ""
    last_dur = w.get("last_duration_sec")
    if running and started and elapsed is None:
        dt = _parse_iso(started)
        if dt is not None:
            try:
                from datetime import datetime

                now = datetime.now().astimezone()
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=now.tzinfo)
                elapsed = max(0, int((now - dt).total_seconds()))
            except Exception:
                elapsed = None
        if last_dur and elapsed is not None:
            try:
                remaining = max(0, int(float(last_dur) - float(elapsed)))
                eta = remaining
            except (TypeError, ValueError):
                pass
    pct = None
    if running and last_dur:
        try:
            pct = max(1, min(99, int(100.0 * float(elapsed or 0) / float(last_dur))))
        except (TypeError, ValueError, ZeroDivisionError):
            pct = None
    live = read_live()
    current_name = str(live.get("current_name") or w.get("current_name") or "")
    current_path = str(live.get("current_path") or w.get("current_path") or "")
    current_label = str(
        live.get("current_label") or live.get("current_item") or w.get("current_item") or ""
    )
    if not current_label:
        current_label = current_name or current_path
    return {
        "running": running,
        "kind": kind or ("hourly" if "hourly" in str(w.get("stage") or "") else ""),
        "stage": w.get("stage") or "",
        "started_at": started,
        "elapsed_sec": elapsed,
        "eta_sec": eta,
        "remaining_sec": remaining if remaining is not None else eta,
        "pct": pct,
        "last_duration_sec": last_dur,
        "message": current_label or w.get("progress_message") or "",
        "current_item": current_label,
        "current_name": current_name,
        "current_path": current_path,
        "current_label": current_label,
        "products_done": live.get("products_done"),
        "products_total": live.get("products_total"),
        "files_done": live.get("files_done"),
        "files_total": live.get("files_total"),
    }


class IndexSupervisor:
    """Owns watch-file-index subprocess + status/log files."""

    def __init__(
        self,
        *,
        interval: float = 2.0,
        depth: int = 5,
        roots: list[str] | None = None,
        hourly_sec: float | None = None,
        first_delay_sec: float | None = None,
    ) -> None:
        self.interval = float(interval)
        self.depth = max(1, int(depth))
        self.roots = list(roots or [])
        self.hourly_sec = float(hourly_sec if hourly_sec is not None else HOURLY_SEC_DEFAULT)
        self.first_delay_sec = float(
            first_delay_sec if first_delay_sec is not None else FIRST_DELAY_SEC_DEFAULT
        )
        self._proc: subprocess.Popen | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock_handle = None
        self._owned = False

    def try_become_owner(self) -> dict[str, Any]:
        handle, meta = acquire_lock(
            SUPERVISOR_LOCK,
            stage="supervising",
            ttl_sec=120,
            extra={"owner": "index_supervisor", "role": "bridge"},
        )
        if handle is None:
            return {"ok": True, "owned": False, "reason": "another_owner", **meta}
        self._lock_handle = handle
        self._owned = True
        write_watcher_status(
            {
                "ok": True,
                "watcher_ok": False,
                "stage": "owner_acquired",
                "supervisor_pid": os.getpid(),
                "recovered_stale": meta.get("recovered_stale"),
            }
        )
        return {"ok": True, "owned": True, **meta}

    def start(self) -> dict[str, Any]:
        own = self.try_become_owner()
        if not own.get("owned"):
            return own
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True, name="dam-index-supervisor")
        self._thread.start()
        return {"ok": True, "owned": True, "started": True}

    def _spawn_watcher(self) -> subprocess.Popen | None:
        if not WATCH_SCRIPT.is_file():
            write_watcher_status(
                {
                    "ok": False,
                    "watcher_ok": False,
                    "error": f"missing_watch_script:{WATCH_SCRIPT}",
                    "last_error": f"missing_watch_script:{WATCH_SCRIPT}",
                }
            )
            return None
        _rotate_log_if_needed(WATCHER_LOG)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        log_f = open(WATCHER_LOG, "a", encoding="utf-8", errors="replace")
        try:
            from branding_publish import resolve_script_python

            watcher_py = resolve_script_python(require_ijson=False)
        except Exception:
            watcher_py = sys.executable
            exe = Path(sys.executable)
            if exe.name.lower() == "pythonw.exe":
                sibling = exe.with_name("python.exe")
                if sibling.is_file():
                    watcher_py = str(sibling)
        cmd = [
            watcher_py,
            str(WATCH_SCRIPT),
            "--interval",
            str(self.interval),
            "--depth",
            str(self.depth),
            "--status-file",
            str(WATCHER_STATUS),
            "--lock-file",
            str(PRODUCT_REBUILD_LOCK),
            "--control-file",
            str(CONTROL_FILE),
            "--hourly",
            str(self.hourly_sec),
            "--first-delay",
            str(self.first_delay_sec),
            "--no-initial",
        ]
        for r in self.roots:
            cmd.extend(["--root", r])
        flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
        try:
            spawn_env = index_builder_env()
            proc = subprocess.Popen(
                cmd,
                cwd=str(WEB_ROOT.parent.parent),
                creationflags=flags,
                stdin=subprocess.DEVNULL,
                stdout=log_f,
                stderr=subprocess.STDOUT,
                env=spawn_env,
            )
        except Exception as exc:  # noqa: BLE001
            try:
                log_f.close()
            except Exception:
                pass
            write_watcher_status(
                {
                    "ok": False,
                    "watcher_ok": False,
                    "error": f"spawn_failed:{exc}",
                    "last_error": str(exc),
                    "last_ok": False,
                }
            )
            return None
        # keep log handle alive via proc (best-effort); close on stop
        setattr(proc, "_dam_log_f", log_f)
        write_watcher_status(
            {
                "ok": True,
                "watcher_ok": True,
                "stage": "watcher_spawned",
                "watcher_pid": proc.pid,
                "supervisor_pid": os.getpid(),
                "log": str(WATCHER_LOG),
            }
        )
        return proc

    def _loop(self) -> None:
        while not self._stop.is_set():
            # heartbeat supervisor lock
            if self._lock_handle is not None:
                try:
                    self._lock_handle.update(stage="supervising", heartbeat_at=_utc())
                except Exception:
                    pass
            alive = self._proc is not None and self._proc.poll() is None
            if not alive:
                if self._proc is not None:
                    rc = self._proc.poll()
                    write_watcher_status(
                        {
                            "ok": False,
                            "watcher_ok": False,
                            "last_ok": False,
                            "last_rc": rc,
                            "last_error": f"watcher_exited_rc_{rc}",
                            "stage": "restarting",
                        }
                    )
                    log_f = getattr(self._proc, "_dam_log_f", None)
                    if log_f:
                        try:
                            log_f.close()
                        except Exception:
                            pass
                self._proc = self._spawn_watcher()
            self._stop.wait(2.5)

    def stop(self) -> None:
        self._stop.set()
        if self._proc and self._proc.poll() is None:
            try:
                self._proc.terminate()
            except Exception:
                pass
        log_f = getattr(self._proc, "_dam_log_f", None) if self._proc else None
        if log_f:
            try:
                log_f.close()
            except Exception:
                pass
        if self._lock_handle is not None:
            try:
                self._lock_handle.release()
            except Exception:
                pass
            self._lock_handle = None
        self._owned = False


def ensure_index_supervisor(*, interval: float = 2.0, depth: int = 5) -> dict[str, Any]:
    """Idempotent: start supervisor if this process can own the lock."""
    global _owner
    with _state_lock:
        # Another process already owns?
        st = supervisor_lock_status()
        if st.get("held") and int((st.get("lock") or {}).get("pid") or 0) != os.getpid():
            return {
                "ok": True,
                "owned": False,
                "reason": "other_process",
                "lock": st.get("lock"),
                "watcher": read_watcher_status(),
            }
        if _owner is not None and _owner._owned:
            return {
                "ok": True,
                "owned": True,
                "started": False,
                "watcher": read_watcher_status(),
            }
        sup = IndexSupervisor(interval=interval, depth=depth)
        result = sup.start()
        if result.get("owned"):
            _owner = sup
        return {**result, "watcher": read_watcher_status()}


def stop_index_supervisor() -> None:
    global _owner
    with _state_lock:
        if _owner is not None:
            _owner.stop()
            _owner = None


def public_status() -> dict[str, Any]:
    w = read_watcher_status()
    lock = supervisor_lock_status()
    rebuild = status_from_lock(PRODUCT_REBUILD_LOCK, ttl_sec=3600)
    last_ok = w.get("last_ok")
    awaiting = last_ok is None
    control = public_control()
    progress = _progress_from_watcher(w, rebuild)
    report = read_report()
    items = report.get("items") if isinstance(report.get("items"), list) else []
    if not items and isinstance(control.get("last_run_new"), list):
        items = list(control.get("last_run_new") or [])
    # watcher_ok = process alive; index_run_ok = last rebuild succeeded (no false green).
    return {
        "ok": True,
        "watcher_ok": bool(w.get("watcher_ok")),
        "index_run_ok": last_ok is True,
        "awaiting_first_rebuild": awaiting,
        "watcher": w,
        "supervisor": lock,
        "rebuild_lock": rebuild,
        "last_ok": last_ok,
        "last_error": w.get("last_error") or w.get("error") or (
            "awaiting_first_rebuild" if awaiting else ""
        ),
        "last_rc": w.get("last_rc"),
        "stale": bool(lock.get("stale") or rebuild.get("stale")),
        "log": str(WATCHER_LOG),
        "progress": progress,
        "control": control,
        "control_path": str(CONTROL_FILE),
        "snoozed": bool(control.get("snoozed")),
        "snooze_until": control.get("snooze_until") or "",
        "cancelable": bool(progress.get("running") or rebuild.get("held")),
        "hourly_sec": HOURLY_SEC_DEFAULT,
        "hourly_pending": bool(w.get("hourly_pending")) and not bool(control.get("snoozed")),
        "current_path": progress.get("current_path") or w.get("current_path") or "",
        "current_label": progress.get("current_label") or w.get("current_label") or "",
        "current_name": progress.get("current_name") or w.get("current_name") or "",
        "current_item": progress.get("current_item") or w.get("current_item") or "",
        "products_done": progress.get("products_done"),
        "products_total": progress.get("products_total"),
        "last_report": report if isinstance(report, dict) else {"ok": True, "items": items},
        "new_items": items,
    }
