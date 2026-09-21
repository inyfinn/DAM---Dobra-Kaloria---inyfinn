"""
File availability states for Marketing paths (Win32 cloud recall aware).

States:
  local         - file bytes present locally
  sync_pending  - legacy state, no longer produced (probing a placeholder downloaded it)
  online_only   - cloud placeholder, detected from attributes only; never opened
  missing       - path not found under Marketing roots
  root_unset    - no Marketing base for current device

Redis role: file-availability — TTL 30s when circuit CLOSED.
Fallback (OPEN/down): in-memory process cache OR recompute probe.
Does NOT survive bridge restart (OK — cheap recompute).

Progress markers (watchdog): probe_wait / recall_pending / probe_done written to
agents/shared/handoff-preview-cache.md so long Win32 recall is not a false kill.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

try:
    import dam_redis
except ImportError:
    dam_redis = None  # type: ignore

try:
    import dam_path_resolve as path_resolve
except ImportError:
    path_resolve = None  # type: ignore

AVAIL_TTL = 30
PROBE_TIMEOUT_S = 5.0

_HANDOFF = Path(__file__).resolve().parent.parent.parent / "agents" / "shared" / "handoff-preview-cache.md"


def _mark(tag: str, detail: str = "") -> None:
    """Append heartbeat for orchestrator watchdog (do not interrupt on probe_wait)."""
    try:
        ts = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
        line = f"- `{ts}` `{tag}` {detail}\n".rstrip() + "\n"
        _HANDOFF.parent.mkdir(parents=True, exist_ok=True)
        with open(_HANDOFF, "a", encoding="utf-8") as fh:
            fh.write(line)
    except Exception:
        pass

# Win32 FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS / RECALL_ON_OPEN (cloud placeholders)
_FILE_ATTRIBUTE_RECALL_ON_OPEN = 0x00040000
_FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS = 0x00400000
_FILE_ATTRIBUTE_OFFLINE = 0x00001000
_FILE_ATTRIBUTE_PINNED = 0x00080000
_FILE_ATTRIBUTE_UNPINNED = 0x00100000


def _sha_key(path: str) -> str:
    h = hashlib.sha256((path or "").strip().lower().encode("utf-8", errors="replace")).hexdigest()
    return "avail:" + h


def _win32_attrs(path: str) -> Optional[int]:
    if os.name != "nt":
        return None
    try:
        import ctypes

        GetFileAttributesW = ctypes.windll.kernel32.GetFileAttributesW  # type: ignore[attr-defined]
        GetFileAttributesW.argtypes = [ctypes.c_wchar_p]
        GetFileAttributesW.restype = ctypes.c_uint32
        attrs = GetFileAttributesW(path)
        if attrs == 0xFFFFFFFF:
            return None
        return int(attrs)
    except Exception:
        return None


def is_online_only(path: str) -> bool:
    """Cloud placeholder (Synology Drive / OneDrive on-demand) whose bytes are not on this disk.

    Attributes only: opening or reading a placeholder makes the sync client download it.
    """
    attrs = _win32_attrs(path)
    if attrs is None:
        return False
    if attrs & (_FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS | _FILE_ATTRIBUTE_RECALL_ON_OPEN):
        return True
    return bool(attrs & _FILE_ATTRIBUTE_OFFLINE) and not bool(attrs & _FILE_ATTRIBUTE_PINNED)


def _probe_readable(path: str, timeout_s: float = PROBE_TIMEOUT_S) -> bool:
    """Try to read a few bytes within timeout (detects stuck cloud recall)."""
    _mark("probe_wait", path[-80:])
    deadline = time.time() + max(0.2, float(timeout_s))
    try:
        with open(path, "rb") as fh:
            while time.time() < deadline:
                chunk = fh.read(4096)
                if chunk:
                    _mark("probe_done", "readable")
                    return True
                if not chunk:
                    _mark("probe_done", "empty_ok")
                    return True
    except OSError:
        _mark("probe_done", "os_error")
        return False
    except Exception:
        _mark("probe_done", "error")
        return False
    _mark("recall_pending", "timeout")
    return False


def classify_path(
    path: str,
    *,
    email: str = "",
    resolve_physical: Optional[Callable[..., str]] = None,
    has_marketing_root: Optional[bool] = None,
) -> dict:
    """Return availability JSON for one path."""
    raw = (path or "").strip()
    if has_marketing_root is False:
        return {
            "ok": True,
            "path": raw,
            "state": "root_unset",
            "label_pl": "Ustaw sciezke Marketing w ustawieniach dysku",
            "cta": "settings.html#damDisk",
            "treat_as_local": False,
        }
    if not raw:
        return {
            "ok": True,
            "path": "",
            "state": "missing",
            "label_pl": "Brak sciezki pliku",
            "treat_as_local": False,
        }

    cache_key = _sha_key(raw)
    if dam_redis is not None:
        cached = dam_redis.get(cache_key)
        if cached:
            try:
                data = json.loads(cached)
                if isinstance(data, dict) and data.get("state"):
                    data["cached"] = True
                    return data
            except (ValueError, TypeError):
                pass

    physical = raw
    if resolve_physical:
        try:
            physical = resolve_physical(raw, email) or raw
        except Exception:
            physical = raw
    elif path_resolve is not None:
        physical = path_resolve.resolve_physical_path(raw, email)

    exists = False
    try:
        exists = os.path.isfile(physical)
    except OSError:
        exists = False

    if not exists:
        out = {
            "ok": True,
            "path": raw,
            "resolved": physical,
            "state": "missing",
            "label_pl": "Plik niedostepny lokalnie",
            "treat_as_local": False,
            "cached": False,
        }
        _store(cache_key, out)
        return out

    if is_online_only(physical):
        out = {
            "ok": True,
            "path": raw,
            "resolved": physical,
            "state": "online_only",
            "label_pl": "Element z dysku dostepny tylko online - Synology",
            "treat_as_local": False,
            "cached": False,
        }
        _store(cache_key, out)
        return out

    # Normal local file
    readable = _probe_readable(physical, min(2.0, PROBE_TIMEOUT_S))
    if not readable:
        out = {
            "ok": True,
            "path": raw,
            "resolved": physical,
            "state": "online_only",
            "label_pl": "Element z dysku dostepny tylko online - Synology",
            "treat_as_local": False,
            "cached": False,
        }
        _store(cache_key, out)
        return out

    out = {
        "ok": True,
        "path": raw,
        "resolved": physical,
        "state": "local",
        "label_pl": "Dostepny lokalnie",
        "treat_as_local": True,
        "cached": False,
    }
    _store(cache_key, out)
    return out


def _store(key: str, payload: dict) -> None:
    if dam_redis is None:
        return
    try:
        slim = {k: v for k, v in payload.items() if k != "cached"}
        dam_redis.set(key, json.dumps(slim, ensure_ascii=False), ttl=AVAIL_TTL)
    except Exception:
        pass


def classify_batch(
    paths: list[str],
    *,
    email: str = "",
    resolve_physical: Optional[Callable[..., str]] = None,
    has_marketing_root: Optional[bool] = None,
) -> dict:
    items = []
    for p in paths or []:
        items.append(
            classify_path(
                p,
                email=email,
                resolve_physical=resolve_physical,
                has_marketing_root=has_marketing_root,
            )
        )
    return {"ok": True, "count": len(items), "items": items}
