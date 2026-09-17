# -*- coding: utf-8 -*-
"""WP1: a corrupt watcher status file must never kill the watcher or the supervisor."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_supervisor as isup  # noqa: E402

WATCH_SCRIPT = DESKTOP.parent / "web" / "scripts" / "watch-file-index.py"
# Invalid UTF-8, like the Synology Drive copy that killed the watcher (byte 0x81).
BAD_BYTES = b'{"last_ok": true, "x": "\x81\x81"}'


def _load_watch_module():
    spec = importlib.util.spec_from_file_location("dam_watch_file_index_under_test", WATCH_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class WatcherScriptCorruptStatusTests(unittest.TestCase):
    def setUp(self):
        self.watch = _load_watch_module()
        self.td = tempfile.TemporaryDirectory()
        self.status = Path(self.td.name) / "index-watcher-status.json"

    def tearDown(self):
        self.td.cleanup()

    def test_invalid_utf8_status_is_quarantined_and_rewritten(self):
        self.status.write_bytes(BAD_BYTES)
        corrupt = self.status.with_name(self.status.name + ".corrupt")
        corrupt.write_bytes(b"older corrupt copy")
        with mock.patch("builtins.print"):
            self.watch._write_status(self.status, {"ok": True, "stage": "idle"})
        self.assertEqual(corrupt.read_bytes(), BAD_BYTES)
        body = json.loads(self.status.read_text(encoding="utf-8"))
        self.assertEqual(body["stage"], "idle")
        self.assertTrue(body["awaiting_first_rebuild"])
        self.assertNotIn("last_ok", body)

    def test_invalid_json_status_reads_as_empty(self):
        self.status.write_text("{not json", encoding="utf-8")
        with mock.patch("builtins.print"):
            self.assertEqual(self.watch._read_status(self.status), {})
        self.assertFalse(self.status.exists())

    def test_valid_status_keeps_last_fields(self):
        self.status.write_text(json.dumps({"last_ok": True, "last_rc": 0}), encoding="utf-8")
        self.watch._write_status(self.status, {"stage": "idle"})
        body = json.loads(self.status.read_text(encoding="utf-8"))
        self.assertIs(body["last_ok"], True)
        self.assertFalse(body["awaiting_first_rebuild"])
        self.assertFalse(self.status.with_name(self.status.name + ".corrupt").exists())


class SupervisorCorruptFilesTests(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        d = Path(self.td.name)
        self.patches = [
            mock.patch.object(isup, "DATA_DIR", d),
            mock.patch.object(isup, "WATCHER_STATUS", d / "index-watcher-status.json"),
            mock.patch.object(isup, "CONTROL_FILE", d / "index-control.json"),
            mock.patch.object(isup, "LIVE_FILE", d / "index-live.json"),
            mock.patch.object(isup, "SNAPSHOT_FILE", d / "index-run-snapshot.json"),
            mock.patch.object(isup, "REPORT_FILE", d / "index-last-report.json"),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.td.cleanup()

    def test_read_watcher_status_quarantines_invalid_utf8(self):
        isup.WATCHER_STATUS.write_bytes(BAD_BYTES)
        st = isup.read_watcher_status()
        self.assertFalse(st["ok"])
        self.assertTrue(st["error"].startswith("corrupt:"))
        self.assertTrue(isup.WATCHER_STATUS.with_name("index-watcher-status.json.corrupt").is_file())
        isup.write_watcher_status({"ok": True, "stage": "idle"})
        body = json.loads(isup.WATCHER_STATUS.read_text(encoding="utf-8"))
        self.assertEqual(body["stage"], "idle")

    def test_other_readers_never_raise(self):
        for path in (isup.CONTROL_FILE, isup.LIVE_FILE, isup.SNAPSHOT_FILE, isup.REPORT_FILE):
            path.write_bytes(BAD_BYTES)
        self.assertEqual(isup.read_control(), {})
        self.assertEqual(isup.read_live(), {})
        self.assertEqual(isup.read_run_snapshot(), {})
        self.assertEqual(isup.read_report()["items"], [])
        self.assertTrue(isup.CONTROL_FILE.with_name("index-control.json.corrupt").is_file())
        # public_status composes all readers; must still answer
        with mock.patch.object(isup, "SUPERVISOR_LOCK", Path(self.td.name) / "sup.lock.json"), \
                mock.patch.object(isup, "PRODUCT_REBUILD_LOCK", Path(self.td.name) / "rb.lock.json"):
            self.assertTrue(isup.public_status()["ok"])

    def test_rebuild_lock_reader_survives_invalid_utf8(self):
        import rebuild_lock

        lock = Path(self.td.name) / "x.lock.json"
        lock.write_bytes(BAD_BYTES)
        self.assertEqual(rebuild_lock._read_json(lock), {})


class _DeadProc:
    pid = 4242

    def poll(self):
        return 1


class SupervisorRestartBackoffTests(unittest.TestCase):
    def test_backoff_grows_and_is_capped(self):
        self.assertEqual(isup.restart_backoff_sec(0), 0.0)
        self.assertEqual(isup.restart_backoff_sec(1), 5.0)
        self.assertEqual(isup.restart_backoff_sec(2), 10.0)
        self.assertEqual(isup.restart_backoff_sec(3), 20.0)
        self.assertEqual(isup.restart_backoff_sec(50), isup.RESTART_BACKOFF_MAX_SEC)

    def test_crashing_watcher_is_not_respawned_in_a_tight_loop(self):
        sup = isup.IndexSupervisor()
        spawns: list[float] = []

        def fake_spawn():
            spawns.append(now[0])
            return _DeadProc()

        now = [1000.0]
        with mock.patch.object(sup, "_spawn_watcher", side_effect=fake_spawn), \
                mock.patch.object(isup, "write_watcher_status"):
            # Simulate 120 s of supervisor ticks while the watcher dies instantly.
            for _ in range(int(120 / isup.LOOP_TICK_SEC)):
                sup._tick(now[0])
                now[0] += isup.LOOP_TICK_SEC
        # Without backoff this would be ~24 spawns; with 5/10/20/40 s it is at most 6.
        self.assertLessEqual(len(spawns), 6)
        self.assertGreaterEqual(len(spawns), 3)
        gaps = [b - a for a, b in zip(spawns, spawns[1:])]
        self.assertEqual(gaps, sorted(gaps))

    def test_healthy_watcher_restarts_immediately(self):
        sup = isup.IndexSupervisor()
        sup._failures = 4
        sup._proc = _DeadProc()
        sup._spawned_at = 0.0
        with mock.patch.object(sup, "_spawn_watcher", return_value=_DeadProc()) as spawn, \
                mock.patch.object(isup, "write_watcher_status"):
            sup._tick(isup.RESTART_STABLE_SEC + 1)
        spawn.assert_called_once()
        self.assertEqual(sup._failures, 0)


if __name__ == "__main__":
    unittest.main()
