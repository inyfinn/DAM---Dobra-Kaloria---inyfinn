# -*- coding: utf-8 -*-
"""Find the Marketing share under any drive letter, without ever hanging.

People map the share as ``M:\\`` (the share root itself), some as ``X:\\Marketing``,
and at home without VPN the tree lives locally, e.g. ``D:\\Marketing``. This module
probes every fixed, remote and removable drive for ``L:\\`` and ``L:\\Marketing``.

A dead network drive can block ``os.path.isdir`` for tens of seconds, so every
letter is probed in its own daemon thread and the caller waits at most
``per_drive_timeout`` (2 s) for all of them together, never longer than
``timeout`` (3 s). A letter whose previous probe is still stuck is skipped instead
of piling up more threads. Results are cached in memory for 60 s.

Order of candidates (HARD): user config (callers add it first) -> M:\\ ->
X:\\Marketing -> D:\\Marketing -> other detected roots.
"""
from __future__ import annotations

import os
import sys
import threading
import time
from pathlib import Path
from typing import Iterable, Sequence

REQUIRED_ROOT_FOLDERS: tuple[str, ...] = ("-- ARCHIWUM --", "- EKSPORT", "- POLSKA")
PREFERRED_CANDIDATES: tuple[Path, ...] = (
    Path("M:/"),
    Path("X:/Marketing"),
    Path("D:/Marketing"),
)

DRIVE_REMOVABLE = 2
DRIVE_FIXED = 3
DRIVE_REMOTE = 4
PROBED_DRIVE_TYPES = frozenset({DRIVE_REMOVABLE, DRIVE_FIXED, DRIVE_REMOTE})

PER_DRIVE_TIMEOUT_SEC = 2.0
TOTAL_TIMEOUT_SEC = 3.0
CACHE_TTL_SEC = 60.0

_lock = threading.Lock()
_cache: dict[tuple[str, ...], tuple[float, list[dict]]] = {}
_inflight: set[str] = set()


# ---------------------------------------------------------------- OS access
# Thin wrappers so tests can replace them.

def _get_logical_drives() -> int:
    if sys.platform != "win32":
        return 0
    import ctypes

    return int(ctypes.windll.kernel32.GetLogicalDrives())


def _get_drive_type(root: str) -> int:
    if sys.platform != "win32":
        return 0
    import ctypes

    return int(ctypes.windll.kernel32.GetDriveTypeW(ctypes.c_wchar_p(root)))


def _isdir(path: str) -> bool:
    return os.path.isdir(path)


def logical_drive_letters() -> list[str]:
    """Drive letters present on this machine (A-Z); empty outside Windows."""
    try:
        mask = _get_logical_drives()
    except Exception:  # noqa: BLE001
        return []
    return [chr(ord("A") + i) for i in range(26) if mask & (1 << i)]


# ---------------------------------------------------------------- helpers

def path_key(path: Path | str) -> str:
    return str(path).replace("\\", "/").rstrip("/").lower()


def candidate_paths(letter: str) -> list[Path]:
    letter = letter.upper()
    return [Path(f"{letter}:/"), Path(f"{letter}:/Marketing")]


def check_root(path: Path | str, required: Sequence[str] = REQUIRED_ROOT_FOLDERS) -> dict:
    """Blocking check of one directory. Returns {path, exists, ok, missing}."""
    p = str(path)
    try:
        exists = _isdir(p)
    except OSError:
        exists = False
    if not exists:
        return {"path": p, "exists": False, "ok": False, "missing": list(required)}
    missing = []
    for name in required:
        try:
            if not _isdir(os.path.join(p, name)):
                missing.append(name)
        except OSError:
            missing.append(name)
    return {"path": p, "exists": True, "ok": not missing, "missing": missing}


def _probe_letter(letter: str, required: Sequence[str]) -> list[dict]:
    try:
        dtype = _get_drive_type(f"{letter}:\\")
    except Exception:  # noqa: BLE001
        return []
    if dtype not in PROBED_DRIVE_TYPES:
        return []
    return [check_root(c, required) for c in candidate_paths(letter)]


def _run_parallel(jobs: dict[str, "callable"], wait_sec: float) -> tuple[dict[str, object], list[str]]:
    """Run each job in a daemon thread; return (results, timed_out_keys).

    Keys already in flight from an earlier call are reported as timed out
    without starting a second thread for them.
    """
    results: dict[str, object] = {}
    done = threading.Event()
    pending: set[str] = set()
    state_lock = threading.Lock()

    def runner(key: str, fn) -> None:
        try:
            value = fn()
        except Exception:  # noqa: BLE001
            value = None
        with state_lock:
            results[key] = value
            pending.discard(key)
            if not pending:
                done.set()
        with _lock:
            _inflight.discard(key)

    skipped: list[str] = []
    to_start: list[tuple[str, object]] = []
    with _lock:
        for key, fn in jobs.items():
            if key in _inflight:
                skipped.append(key)
                continue
            _inflight.add(key)
            to_start.append((key, fn))
    with state_lock:
        pending.update(k for k, _ in to_start)
        if not pending:
            done.set()
    for key, fn in to_start:
        threading.Thread(target=runner, args=(key, fn), daemon=True, name=f"dam-drive-probe-{key}").start()
    done.wait(max(0.0, wait_sec))
    with state_lock:
        timed_out = sorted(pending) + skipped
        return dict(results), timed_out


def sort_key(path: Path | str) -> tuple[int, str]:
    key = path_key(path)
    for i, pref in enumerate(PREFERRED_CANDIDATES):
        if key == path_key(pref):
            return (i, key)
    return (len(PREFERRED_CANDIDATES), key)


# ---------------------------------------------------------------- public API

def probe_drives(
    *,
    required: Sequence[str] = REQUIRED_ROOT_FOLDERS,
    per_drive_timeout: float = PER_DRIVE_TIMEOUT_SEC,
    timeout: float = TOTAL_TIMEOUT_SEC,
    use_cache: bool = True,
) -> list[dict]:
    """Status of every probed candidate path, sorted in candidate order.

    Each entry: {path, letter, exists, ok, missing, timeout}. A hung letter is
    reported once per candidate path with ``timeout: True`` and ``ok: False``.
    """
    req = tuple(required)
    now = time.monotonic()
    if use_cache:
        with _lock:
            hit = _cache.get(req)
        if hit and now - hit[0] < CACHE_TTL_SEC:
            return [dict(x) for x in hit[1]]
    letters = logical_drive_letters()
    jobs = {L: (lambda L=L: _probe_letter(L, req)) for L in letters}
    wait = min(float(per_drive_timeout), float(timeout))
    results, timed_out = _run_parallel(jobs, wait)
    entries: list[dict] = []
    for letter in letters:
        if letter in timed_out:
            for c in candidate_paths(letter):
                entries.append(
                    {"path": str(c), "letter": letter, "exists": False, "ok": False,
                     "missing": list(req), "timeout": True}
                )
            continue
        for item in results.get(letter) or []:
            entries.append({**item, "letter": letter, "timeout": False})
    entries.sort(key=lambda e: sort_key(e["path"]))
    # Hung letters are not cached as final: retry them on the next call.
    if not timed_out:
        with _lock:
            _cache[req] = (now, [dict(x) for x in entries])
    else:
        with _lock:
            _cache[req] = (now - CACHE_TTL_SEC + 10.0, [dict(x) for x in entries])
    return entries


def discover_roots(
    *,
    required: Sequence[str] = REQUIRED_ROOT_FOLDERS,
    per_drive_timeout: float = PER_DRIVE_TIMEOUT_SEC,
    timeout: float = TOTAL_TIMEOUT_SEC,
    use_cache: bool = True,
) -> list[Path]:
    """Valid Marketing roots on this machine, in candidate order."""
    return [
        Path(e["path"])
        for e in probe_drives(
            required=required,
            per_drive_timeout=per_drive_timeout,
            timeout=timeout,
            use_cache=use_cache,
        )
        if e.get("ok")
    ]


def check_paths(
    paths: Iterable[Path | str],
    *,
    required: Sequence[str] = REQUIRED_ROOT_FOLDERS,
    timeout: float = PER_DRIVE_TIMEOUT_SEC,
) -> dict[str, dict]:
    """check_root for arbitrary paths in parallel, bounded by ``timeout``.

    Returns {path_key: status}; a path that did not answer in time gets
    ``{"ok": False, "exists": False, "timeout": True}``.
    """
    uniq: dict[str, str] = {}
    for p in paths:
        if p:
            uniq.setdefault("path:" + path_key(p), str(p))
    req = tuple(required)
    jobs = {k: (lambda p=p: check_root(p, req)) for k, p in uniq.items()}
    results, timed_out = _run_parallel(jobs, timeout)
    out: dict[str, dict] = {}
    for k, p in uniq.items():
        if k in timed_out or not isinstance(results.get(k), dict):
            out[k[5:]] = {"path": p, "exists": False, "ok": False, "missing": list(req), "timeout": True}
        else:
            out[k[5:]] = {**results[k], "timeout": False}
    return out


def ordered_candidates(
    user_bases: Iterable[Path | str] = (),
    discovered: Iterable[Path | str] = (),
) -> list[Path]:
    """User config first, then M:\\, X:\\Marketing, D:\\Marketing, then the rest."""
    out: list[Path] = []
    seen: set[str] = set()
    extra = sorted((Path(str(d)) for d in discovered if d), key=sort_key)
    for p in list(user_bases) + list(PREFERRED_CANDIDATES) + extra:
        if not p:
            continue
        key = path_key(p)
        if key in seen:
            continue
        seen.add(key)
        out.append(Path(str(p)))
    return out


def refresh_in_background(**kwargs) -> threading.Thread:
    """Warm the cache without blocking the caller."""
    t = threading.Thread(
        target=lambda: probe_drives(use_cache=False, **kwargs),
        daemon=True,
        name="dam-marketing-discovery",
    )
    t.start()
    return t


def clear_cache() -> None:
    with _lock:
        _cache.clear()
