# -*- coding: utf-8 -*-
"""rebuild_lock: PID-reuse must not make a dead owner's lock look alive.

Regression for the 2026-09-23 branding grid publish getting stuck for hours
(671 coalesced reschedules) with lock_last_error=lock_held_reschedule even
though the process that had written the lock was long gone. Windows reused
its PID for an unrelated live process, so the plain "is this PID alive"
check kept reporting the lock as held until the multi-hour TTL fallback
finally caught it. See rebuild_lock._process_start_ticks docstring.
"""
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

DESKTOP_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DESKTOP_DIR))

import rebuild_lock  # noqa: E402


class LockPidReuseTest(unittest.TestCase):
    def test_live_pid_with_mismatched_start_time_is_stale(self):
        """Same PID as a currently-live process, but recorded proc_start
        does not match that process' real creation time -> must be
        considered stale immediately (PID was recycled), not held."""
        if os.name != "nt":
            self.skipTest("proc_start verification is Windows-only")

        own_pid = os.getpid()
        real_start = rebuild_lock._process_start_ticks(own_pid)
        self.assertIsNotNone(real_start, "expected to read our own process start time")

        payload = {
            "pid": own_pid,
            "proc_start": int(real_start) + 1,  # deliberately wrong -> "different" process
            "heartbeat_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        # Fresh heartbeat, huge TTL: only the proc_start mismatch should flag it stale.
        self.assertTrue(rebuild_lock.lock_is_stale(payload, ttl_sec=7200.0))

    def test_live_pid_with_matching_start_time_is_not_stale(self):
        """Genuine still-running owner (matching proc_start, fresh heartbeat)
        must not be treated as stale."""
        if os.name != "nt":
            self.skipTest("proc_start verification is Windows-only")

        own_pid = os.getpid()
        real_start = rebuild_lock._process_start_ticks(own_pid)
        self.assertIsNotNone(real_start)

        payload = {
            "pid": own_pid,
            "proc_start": real_start,
            "heartbeat_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        self.assertFalse(rebuild_lock.lock_is_stale(payload, ttl_sec=7200.0))

    def test_acquire_lock_records_proc_start(self):
        lock_path = DESKTOP_DIR / "data" / "._test_rebuild_lock_proc_start.lock.json"
        if lock_path.exists():
            lock_path.unlink()
        try:
            handle, meta = rebuild_lock.acquire_lock(lock_path, ttl_sec=60.0)
            self.assertIsNotNone(handle)
            self.assertTrue(meta.get("ok"))
            if os.name == "nt":
                self.assertIn("proc_start", handle.payload)
            handle.release()
            self.assertFalse(lock_path.exists())
        finally:
            if lock_path.exists():
                lock_path.unlink()

    def test_dead_pid_is_still_stale_without_proc_start(self):
        """Backward compatibility: a lock payload written before this fix
        (no proc_start key) must still fall back to the old dead-pid check."""
        payload = {
            "pid": 999999,  # exceedingly unlikely to be a live PID
            "heartbeat_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        self.assertTrue(rebuild_lock.lock_is_stale(payload, ttl_sec=7200.0))


class StateDirProbeTest(unittest.TestCase):
    """07.10.2026 (audyt publikacji, Z6): sonda zapisu miala stala nazwe ".write-probe" - dwa procesy
    kasowaly ja sobie nawzajem i resolve_state_dir() oddawal katalog zapasowy (blokada w dwoch miejscach)."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.state = Path(tmp.name) / "state"
        p = mock.patch.dict(os.environ, {"DAM_STATE_DIR": str(self.state)})
        p.start()
        self.addCleanup(p.stop)

    def test_eight_threads_always_get_the_primary_dir(self):
        got: list = []
        start = threading.Barrier(8)

        def work():
            start.wait()
            for _ in range(200):
                got.append(rebuild_lock.resolve_state_dir())

        threads = [threading.Thread(target=work) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=60)
        self.assertEqual(len(got), 1600)
        self.assertEqual(set(got), {self.state})
        self.assertEqual([p.name for p in self.state.iterdir()], [])  # sondy posprzatane

    def test_failed_probe_cleanup_does_not_fall_back(self):
        with mock.patch.object(Path, "unlink", side_effect=PermissionError("inny proces")):
            self.assertEqual(rebuild_lock.resolve_state_dir(), self.state)
        left = [p.name for p in self.state.iterdir()]
        self.assertEqual(len(left), 1)
        self.assertTrue(left[0].startswith(f".write-probe-{os.getpid()}-"), left[0])

    def test_unwritable_dir_still_falls_back_to_data_dir(self):
        with mock.patch.object(Path, "write_text", side_effect=PermissionError("tylko odczyt")):
            self.assertEqual(rebuild_lock.resolve_state_dir(), rebuild_lock.DATA_DIR)


if __name__ == "__main__":
    unittest.main()
