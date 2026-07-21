"""
DAM Redis client — metadata TTL + warm queues + production circuit breaker.

Env: DAM_REDIS_URL=redis://127.0.0.1:6379/0

Docker Desktop is OPTIONAL. Connection refused at startup (no Docker, colleague PC)
behaves the same as Redis crashing mid-flight: circuit OPEN immediately (or after
first refuse), degrade to role fallbacks, background probes until Redis appears.
Bridge must serve UI without `docker compose up`.

================================================================================
CIRCUIT BREAKER (HARD)
================================================================================
CLOSED     — normal Redis traffic; consecutive errors counted
OPEN       — after N=3 consecutive errors (or refuse at startup): full bypass;
             NO connect attempt on each HTTP request (that would slow the UI)
HALF-OPEN  — after cooldown (~12s), background probe allows ONE try;
             success → CLOSED; fail → stay OPEN, reset cooldown
Background health probe: daemon thread every ~12s — NOT per request.
Automatic recovery without restarting the bridge.

================================================================================
FALLBACK MATRIX PER REDIS ROLE (HARD)
================================================================================
| Role                 | Redis TTL | Fallback when Redis down/OPEN                         | Survives restart? |
|----------------------|-----------|-------------------------------------------------------|-------------------|
| file-availability    | 30s       | in-memory process cache OR recompute probe            | No (OK-recompute) |
| thumb-cache key→path | metadata  | DISK is SoT (PAMIEC-PODRECZNA lookup by hash path)    | Yes via disk      |
| dry-run FORCE        | 8s        | in-memory only; on miss re-run dry-run (no disk)      | No (OK)           |
| warm queue           | —         | no-op / sync generate on demand; tiny RAM queue OK    | No (OK)           |

Never pretend RAM fallback survives bridge restart for durable roles — those use disk.
"""
from __future__ import annotations

import os
import threading
import time
from enum import Enum
from typing import Any, Optional

DAM_REDIS_URL = os.environ.get("DAM_REDIS_URL", "redis://127.0.0.1:6379/0").strip()

# Circuit breaker knobs
ERROR_THRESHOLD = int(os.environ.get("DAM_REDIS_CB_ERRORS", "3"))
COOLDOWN_S = float(os.environ.get("DAM_REDIS_CB_COOLDOWN", "12"))
PROBE_INTERVAL_S = float(os.environ.get("DAM_REDIS_PROBE_INTERVAL", "12"))

# Role TTLs (documentation + helpers)
TTL_FILE_AVAILABILITY = 30
TTL_DRY_RUN_FORCE = 8
TTL_THUMB_META = 7 * 24 * 3600


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


_client = None
_client_lock = threading.Lock()
_cb_lock = threading.Lock()
_circuit: CircuitState = CircuitState.CLOSED
_consec_errors = 0
_opened_at = 0.0
_half_open_probe_allowed = False
_probe_thread_started = False
_probe_stop = threading.Event()

# Process-local fallback (avail / dry-run / warm meta). NOT durable across restart.
_mem: dict[str, tuple[float, Any]] = {}
_mem_lock = threading.Lock()
_MEM_MAX = 2048

# Role tags for callers (optional second arg / prefix convention)
ROLE_AVAIL = "avail"
ROLE_THUMB = "thumb"
ROLE_DRY_RUN = "dryrun"
ROLE_WARM = "warm"


def _try_import_redis():
    try:
        import redis  # type: ignore

        return redis
    except ImportError:
        return None


def _set_open(reason: str = "") -> None:
    global _circuit, _opened_at, _half_open_probe_allowed, _consec_errors
    with _cb_lock:
        _circuit = CircuitState.OPEN
        _opened_at = time.time()
        _half_open_probe_allowed = False
        _consec_errors = ERROR_THRESHOLD
    if reason:
        print(f"[dam_redis] circuit OPEN ({reason})")


def _set_closed() -> None:
    global _circuit, _consec_errors, _half_open_probe_allowed
    with _cb_lock:
        was = _circuit
        _circuit = CircuitState.CLOSED
        _consec_errors = 0
        _half_open_probe_allowed = False
    if was != CircuitState.CLOSED:
        print("[dam_redis] circuit CLOSED (Redis recovered)")


def _record_success() -> None:
    global _consec_errors
    with _cb_lock:
        _consec_errors = 0
        if _circuit in (CircuitState.HALF_OPEN, CircuitState.OPEN):
            _circuit = CircuitState.CLOSED
            _half_open_probe_allowed = False
            print("[dam_redis] circuit CLOSED (probe/request OK)")


def _record_failure(reason: str = "error") -> None:
    global _consec_errors, _circuit, _opened_at, _half_open_probe_allowed
    with _cb_lock:
        if _circuit == CircuitState.HALF_OPEN:
            _circuit = CircuitState.OPEN
            _opened_at = time.time()
            _half_open_probe_allowed = False
            _consec_errors = ERROR_THRESHOLD
            print(f"[dam_redis] circuit OPEN again (half-open fail: {reason})")
            return
        _consec_errors += 1
        if _consec_errors >= ERROR_THRESHOLD:
            _circuit = CircuitState.OPEN
            _opened_at = time.time()
            _half_open_probe_allowed = False
            print(f"[dam_redis] circuit OPEN after {_consec_errors} errors ({reason})")


def circuit_state() -> str:
    with _cb_lock:
        return _circuit.value


def _may_use_redis() -> bool:
    """Per-request gate: True ONLY when CLOSED. HALF-OPEN is probe-thread only."""
    with _cb_lock:
        return _circuit == CircuitState.CLOSED


def _drop_client() -> None:
    global _client
    with _client_lock:
        _client = None


def reset_client() -> None:
    """Drop cached client (recovery / tests)."""
    _drop_client()


def _get_client():
    """Create client object only — does not ping. Callers must respect circuit."""
    global _client
    with _client_lock:
        if _client is not None:
            return _client
        redis_mod = _try_import_redis()
        if redis_mod is None:
            return None
        try:
            _client = redis_mod.Redis.from_url(
                DAM_REDIS_URL,
                socket_connect_timeout=0.35,
                socket_timeout=0.6,
                decode_responses=True,
            )
        except Exception:
            _client = None
        return _client


def _raw_ping() -> bool:
    """Direct PING (for probe / half-open). Does not consult circuit for skip."""
    client = _get_client()
    if client is None:
        return False
    try:
        return bool(client.ping())
    except Exception:
        _drop_client()
        return False


def _probe_once() -> bool:
    """Background probe only. OPEN→HALF-OPEN after cooldown; one PING; success→CLOSED."""
    global _circuit, _half_open_probe_allowed
    with _cb_lock:
        if _circuit == CircuitState.CLOSED:
            # Periodic liveness while closed
            pass
        elif _circuit == CircuitState.OPEN:
            if (time.time() - _opened_at) < COOLDOWN_S:
                return False
            _circuit = CircuitState.HALF_OPEN
            _half_open_probe_allowed = True
        elif _circuit == CircuitState.HALF_OPEN:
            # Only one in-flight probe
            if not _half_open_probe_allowed:
                return False
            _half_open_probe_allowed = False

    ok = _raw_ping()
    if ok:
        _record_success()
        return True
    _record_failure("probe")
    return False


def _probe_loop() -> None:
    while not _probe_stop.is_set():
        try:
            _probe_once()
        except Exception as exc:  # noqa: BLE001
            print("[dam_redis] probe loop:", exc)
        _probe_stop.wait(PROBE_INTERVAL_S)


def start_background_probe() -> None:
    """Idempotent: start daemon probe thread (call once at bridge startup)."""
    global _probe_thread_started
    with _cb_lock:
        if _probe_thread_started:
            return
        _probe_thread_started = True
    t = threading.Thread(target=_probe_loop, name="dam-redis-probe", daemon=True)
    t.start()


def bootstrap() -> dict:
    """
    Call at bridge startup.
    Try connect once; refuse → OPEN + start probe. Never raise / crash UI.
    """
    start_background_probe()
    redis_mod = _try_import_redis()
    if redis_mod is None:
        _set_open("redis_package_missing")
        return status()
    if _raw_ping():
        _set_closed()
    else:
        _set_open("connection_refused_or_unreachable")
    return status()


def ping(force: bool = False) -> bool:
    """
    True when Redis is usable.
    When circuit OPEN: returns False immediately (no connect) unless force=True
    (force used only by /health detail or tests — still one attempt).
    """
    if force:
        return _probe_once() if circuit_state() != CircuitState.CLOSED else _raw_ping()
    if not _may_use_redis():
        return False
    ok = _raw_ping()
    if ok:
        _record_success()
    else:
        _record_failure("ping")
    return ok


def status() -> dict:
    """For GET /health: redis ok|down + circuit state."""
    redis_mod = _try_import_redis()
    st = circuit_state()
    if redis_mod is None:
        return {
            "redis": "down",
            "circuit": st,
            "reason": "redis_package_missing",
            "url": DAM_REDIS_URL,
            "docker_optional": True,
        }
    # Do NOT force connect when OPEN — report open/down from circuit
    if st == CircuitState.OPEN:
        return {
            "redis": "open",
            "circuit": st,
            "reason": "circuit_open_bypass",
            "url": DAM_REDIS_URL,
            "docker_optional": True,
            "cooldown_s": COOLDOWN_S,
            "probe_interval_s": PROBE_INTERVAL_S,
        }
    if st == CircuitState.HALF_OPEN:
        return {
            "redis": "half_open",
            "circuit": st,
            "url": DAM_REDIS_URL,
            "docker_optional": True,
        }
    # CLOSED — light check without hammering: use last known via quick ping if allowed
    ok = False
    if _may_use_redis():
        ok = _raw_ping()
        if ok:
            _record_success()
        else:
            _record_failure("health")
    return {
        "redis": "ok" if ok else "down",
        "circuit": circuit_state(),
        "url": DAM_REDIS_URL,
        "docker_optional": True,
        "reason": None if ok else "unreachable",
    }


def _mem_get(key: str) -> Optional[Any]:
    with _mem_lock:
        item = _mem.get(key)
        if not item:
            return None
        exp, val = item
        if exp and exp < time.time():
            _mem.pop(key, None)
            return None
        return val


def _mem_set(key: str, value: Any, ttl: Optional[int]) -> None:
    exp = (time.time() + ttl) if ttl else 0.0
    with _mem_lock:
        if len(_mem) >= _MEM_MAX:
            now = time.time()
            dead = [k for k, (e, _) in _mem.items() if e and e < now]
            for k in dead:
                _mem.pop(k, None)
            if len(_mem) >= _MEM_MAX:
                for k in list(_mem.keys())[: _MEM_MAX // 2]:
                    _mem.pop(k, None)
        _mem[key] = (exp, value)


def get(key: str) -> Optional[str]:
    """GET with circuit gate. Fallback: process memory (avail/dry-run roles)."""
    if _may_use_redis():
        client = _get_client()
        if client is not None:
            try:
                val = client.get(key)
                _record_success()
                if val is not None:
                    return str(val)
            except Exception:
                _drop_client()
                _record_failure("get")
    mem = _mem_get(key)
    if mem is None:
        return None
    return str(mem) if not isinstance(mem, str) else mem


def set(key: str, value: str, ttl: Optional[int] = None) -> bool:
    """
    SET with optional EX.
    Always mirrors to process memory (avail / dry-run fallback).
    Returns True only if Redis write succeeded (CLOSED path).
    """
    _mem_set(key, value, ttl)
    if not _may_use_redis():
        return False
    client = _get_client()
    if client is None:
        _record_failure("set_no_client")
        return False
    try:
        if ttl and ttl > 0:
            client.set(key, value, ex=int(ttl))
        else:
            client.set(key, value)
        _record_success()
        return True
    except Exception:
        _drop_client()
        _record_failure("set")
        return False


def hset(key: str, mapping: dict, ttl: Optional[int] = None) -> bool:
    """HSET mapping; TTL on whole hash when provided. Mirrors to process memory."""
    import json

    flat = {
        str(k): (v if isinstance(v, str) else json.dumps(v, ensure_ascii=False))
        for k, v in (mapping or {}).items()
    }
    _mem_set(key, flat, ttl)
    if not _may_use_redis():
        return False
    client = _get_client()
    if client is None:
        _record_failure("hset_no_client")
        return False
    try:
        if flat:
            client.hset(key, mapping=flat)
        if ttl and ttl > 0:
            client.expire(key, int(ttl))
        _record_success()
        return True
    except Exception:
        _drop_client()
        _record_failure("hset")
        return False


def hgetall(key: str) -> dict:
    if _may_use_redis():
        client = _get_client()
        if client is not None:
            try:
                data = client.hgetall(key)
                _record_success()
                if data:
                    return dict(data)
            except Exception:
                _drop_client()
                _record_failure("hgetall")
    mem = _mem_get(key)
    if isinstance(mem, dict):
        return dict(mem)
    return {}


def delete(key: str) -> None:
    with _mem_lock:
        _mem.pop(key, None)
    if not _may_use_redis():
        return
    client = _get_client()
    if client is None:
        return
    try:
        client.delete(key)
        _record_success()
    except Exception:
        _drop_client()
        _record_failure("delete")


def fallback_matrix() -> list[dict]:
    """Expose matrix for /health or docs."""
    return [
        {
            "role": "file-availability",
            "ttl_s": TTL_FILE_AVAILABILITY,
            "fallback": "in-memory process cache OR recompute probe",
            "survives_restart": False,
        },
        {
            "role": "thumb-cache key→path",
            "ttl_s": TTL_THUMB_META,
            "fallback": "disk PAMIEC-PODRECZNA filesystem lookup by hash (SoT)",
            "survives_restart": True,
        },
        {
            "role": "dry-run FORCE",
            "ttl_s": TTL_DRY_RUN_FORCE,
            "fallback": "in-memory only; miss → re-run dry-run (no disk)",
            "survives_restart": False,
        },
        {
            "role": "warm queue",
            "ttl_s": None,
            "fallback": "no-op / sync generate on demand; tiny RAM queue OK",
            "survives_restart": False,
        },
    ]
