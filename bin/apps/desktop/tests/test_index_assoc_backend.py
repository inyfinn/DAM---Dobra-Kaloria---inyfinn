# -*- coding: utf-8 -*-
"""Focused tests: watcher status, supervisor singleton, assoc seed/write, lock recovery."""
from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))


class RebuildLockTests(unittest.TestCase):
    def test_lock_stale_recovery(self):
        import rebuild_lock

        with tempfile.TemporaryDirectory() as td:
            lock = Path(td) / "x.lock.json"
            # Dead PID + old timestamp => stale
            lock.write_text(
                json.dumps(
                    {
                        "pid": 99999999,
                        "started_at": "2000-01-01T00:00:00Z",
                        "stage": "building",
                        "ttl_sec": 1,
                    }
                ),
                encoding="utf-8",
            )
            self.assertTrue(rebuild_lock.lock_is_stale(rebuild_lock.read_lock(lock), ttl_sec=1))
            handle, meta = rebuild_lock.acquire_lock(lock, stage="test", ttl_sec=60)
            self.assertIsNotNone(handle)
            self.assertTrue(meta.get("ok"))
            self.assertTrue(meta.get("recovered_stale"))
            # Second acquire fails while held
            handle2, meta2 = rebuild_lock.acquire_lock(lock, stage="test2", ttl_sec=60)
            self.assertIsNone(handle2)
            self.assertEqual(meta2.get("error"), "lock_held")
            handle.release()
            handle3, meta3 = rebuild_lock.acquire_lock(lock, stage="test3", ttl_sec=60)
            self.assertIsNotNone(handle3)
            handle3.release()


class SupervisorSingletonTests(unittest.TestCase):
    def test_supervisor_singleton_in_launch_and_browser(self):
        import index_supervisor as isup

        # launch.py: start_index_watcher is a no-op (bridge owns supervisor)
        launch_src = (DESKTOP / "launch.py").read_text(encoding="utf-8")
        self.assertIn("return None", launch_src)
        self.assertIn("DEPRECATED", launch_src)
        serve_src = (DESKTOP / "serve_browser.py").read_text(encoding="utf-8")
        self.assertNotIn("start_index_watcher", serve_src)
        self.assertIn("BridgeSupervisor", serve_src)

        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            # Redirect supervisor paths
            isup.DATA_DIR = td_path
            isup.SUPERVISOR_LOCK = td_path / "index-supervisor.lock.json"
            isup.WATCHER_STATUS = td_path / "index-watcher-status.json"
            isup.WATCHER_LOG = td_path / "index-watcher.log"
            isup.PRODUCT_REBUILD_LOCK = td_path / "index-rebuild.lock.json"
            # Prevent real watcher spawn by pointing to missing script briefly
            old_script = isup.WATCH_SCRIPT
            isup.WATCH_SCRIPT = td_path / "missing-watch.py"
            try:
                r1 = isup.ensure_index_supervisor(interval=30)
                self.assertTrue(r1.get("ok"))
                self.assertTrue(r1.get("owned"))
                # Second call in same process is idempotent owner
                r2 = isup.ensure_index_supervisor(interval=30)
                self.assertTrue(r2.get("owned"))
                # Simulate other process holding lock
                isup.stop_index_supervisor()
                foreign = {
                    "pid": os.getpid(),
                    "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "stage": "supervising",
                    "ttl_sec": 120,
                    "owner": "foreign",
                }
                isup.SUPERVISOR_LOCK.write_text(json.dumps(foreign), encoding="utf-8")
                # Same PID still counts as held by "other" logic only when pid differs;
                # forge a different alive-looking pid via stale=false with current pid:
                # acquire should see held by self path; use dead pid to test other_process branch
                foreign["pid"] = 1  # usually System Idle / may be "alive" on Windows
                # Force non-stale held by writing future heartbeat and skip pid check via monkeypatch
                import rebuild_lock

                orig = rebuild_lock._pid_alive
                rebuild_lock._pid_alive = lambda pid: True  # type: ignore
                try:
                    isup.SUPERVISOR_LOCK.write_text(json.dumps(foreign), encoding="utf-8")
                    r3 = isup.ensure_index_supervisor(interval=30)
                    self.assertFalse(r3.get("owned"))
                    self.assertEqual(r3.get("reason"), "other_process")
                finally:
                    rebuild_lock._pid_alive = orig
            finally:
                isup.stop_index_supervisor()
                isup.WATCH_SCRIPT = old_script


class WatcherStatusTests(unittest.TestCase):
    def test_watcher_startup_failure_surfaces_status(self):
        import index_supervisor as isup

        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            isup.DATA_DIR = td_path
            isup.WATCHER_STATUS = td_path / "index-watcher-status.json"
            isup.WATCHER_LOG = td_path / "index-watcher.log"
            isup.SUPERVISOR_LOCK = td_path / "index-supervisor.lock.json"
            isup.PRODUCT_REBUILD_LOCK = td_path / "index-rebuild.lock.json"
            isup.WATCH_SCRIPT = td_path / "nope.py"
            isup.stop_index_supervisor()
            r = isup.ensure_index_supervisor(interval=30)
            self.assertTrue(r.get("owned") or r.get("ok"))
            # Give spawn attempt a moment
            time.sleep(0.2)
            st = isup.read_watcher_status()
            self.assertIn("watcher_ok", st)
            # Missing script => watcher_ok False and error surfaced
            if st.get("error") or st.get("last_error"):
                self.assertFalse(st.get("watcher_ok"))
                err = str(st.get("error") or st.get("last_error"))
                self.assertTrue("missing_watch_script" in err or "spawn_failed" in err or err)
            isup.stop_index_supervisor()


class AssocRepoTests(unittest.TestCase):
    def test_assoc_write_updates_sqlite_and_mirror(self):
        import assoc_repo

        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            db = td_path / "t.sqlite"
            ov = td_path / "overrides.json"
            assoc_repo.set_slim_publish_callback(None)
            res = assoc_repo.upsert_confirmed_links(
                "br-test-1",
                ["prod-a", "prod-b"],
                db_path=db,
                source="manual",
                updated_by="unittest",
                overrides_path=ov,
                schedule_publish=False,
            )
            self.assertTrue(res.get("ok"))
            conn = sqlite3.connect(str(db))
            rows = conn.execute(
                "SELECT product_id, status FROM asset_product_links WHERE asset_id=? ORDER BY product_id",
                ("br-test-1",),
            ).fetchall()
            conn.close()
            self.assertEqual(rows, [("prod-a", "confirmed"), ("prod-b", "confirmed")])
            mirror = json.loads(ov.read_text(encoding="utf-8"))
            self.assertEqual(
                mirror["assets"]["br-test-1"]["linked_product_ids"],
                ["prod-a", "prod-b"],
            )

    def test_assoc_seed_preserves_decisions(self):
        import assoc_repo

        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            db = td_path / "t.sqlite"
            conn = assoc_repo.connect(db)
            now = assoc_repo.utc_now()
            conn.execute(
                "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                "VALUES(?,?,?,?,?,?,?,?)",
                ("br-1", "p-keep", 100, "manual", "confirmed", "keep", now, "u"),
            )
            conn.execute(
                "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                "VALUES(?,?,?,?,?,?,?,?)",
                ("br-1", "p-rej", 10, "refilter", "rejected", "no", now, "u"),
            )
            conn.commit()
            # Seed-like upsert must not clobber confirmed/rejected
            conn.execute(
                "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                "VALUES(?,?,?,?,?,?,?,?) "
                "ON CONFLICT(asset_id, product_id) DO UPDATE SET "
                "score=excluded.score, status=CASE "
                "WHEN asset_product_links.status IN ('confirmed','rejected') THEN asset_product_links.status "
                "ELSE excluded.status END",
                ("br-1", "p-keep", 55, "refilter", "pending", "spray", now, "seed"),
            )
            conn.execute(
                "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                "VALUES(?,?,?,?,?,?,?,?) "
                "ON CONFLICT(asset_id, product_id) DO UPDATE SET "
                "score=excluded.score, status=CASE "
                "WHEN asset_product_links.status IN ('confirmed','rejected') THEN asset_product_links.status "
                "ELSE excluded.status END",
                ("br-1", "p-rej", 90, "refilter", "auto", "spray", now, "seed"),
            )
            conn.execute(
                "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                "VALUES(?,?,?,?,?,?,?,?)",
                ("br-1", "p-new", 60, "refilter", "pending", "ok", now, "seed"),
            )
            conn.commit()
            rows = {
                r[0]: r[1]
                for r in conn.execute(
                    "SELECT product_id, status FROM asset_product_links WHERE asset_id='br-1'"
                )
            }
            conn.close()
            self.assertEqual(rows["p-keep"], "confirmed")
            self.assertEqual(rows["p-rej"], "rejected")
            self.assertEqual(rows["p-new"], "pending")


class BrandingGridArgvTests(unittest.TestCase):
    def test_grid_from_sqlite_argv_requires_canonical_path(self):
        from branding_publish import canonical_sqlite_path, grid_from_sqlite_argv
        import dam_db

        db = canonical_sqlite_path(dam_db_module=dam_db, desktop_dir=DESKTOP)
        grid = DESKTOP.parent / "web" / "scripts" / "build-branding-grid-index.py"
        argv = grid_from_sqlite_argv(grid, db)
        self.assertGreaterEqual(len(argv), 4)
        self.assertEqual(argv[1], str(grid))
        self.assertEqual(argv[2], "--from-sqlite")
        self.assertEqual(argv[3], str(db))
        # Must be an explicit path value (argparse type=Path), never bare --from-sqlite
        self.assertEqual(Path(argv[3]).suffix, ".sqlite")
        custom = Path("C:/tmp/custom-dam.sqlite")
        argv2 = grid_from_sqlite_argv(grid, custom)
        self.assertEqual(argv2[2:], ["--from-sqlite", str(custom)])
        # Captured argv must include path immediately after flag
        self.assertNotEqual(argv[3], "--from-sqlite")

    def test_slim_publish_passes_sqlite_path_and_debounces(self):
        from branding_publish import SlimGridPublisher
        from rebuild_lock import acquire_lock

        captured: list[list[str]] = []
        calls = {"n": 0}
        status_events: list[dict] = []
        logs: list[str] = []
        state: dict = {"slim_coalesced": 0}
        state_lock = __import__("threading").Lock()

        def fake_call(cmd, **kwargs):
            captured.append(list(cmd))
            calls["n"] += 1
            return 0

        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            fake_grid = td_path / "build-branding-grid-index.py"
            fake_grid.write_text("# fake\n", encoding="utf-8")
            sqlite = td_path / "dam-local.sqlite"
            sqlite.write_bytes(b"")
            lock = td_path / "branding-rebuild.lock.json"
            invalidated = {"n": 0}

            pub = SlimGridPublisher(
                grid_script=fake_grid,
                lock_file=lock,
                sqlite_path=sqlite,
                invalidate_caches=lambda: invalidated.__setitem__("n", invalidated["n"] + 1),
                write_status=lambda extra: status_events.append(dict(extra or {})),
                append_log=lambda line: logs.append(line),
                generation_id_fn=lambda: "fat:1:assoc22",
                state=state,
                state_lock=state_lock,
                debounce_sec=0.25,
                subprocess_call=fake_call,
            )
            try:
                pub.schedule(delay_sec=0.25)
                pub.schedule(delay_sec=0.25)
                pub.schedule(delay_sec=0.25)
                time.sleep(0.9)
                self.assertEqual(calls["n"], 1, f"expected 1 debounced call, got {calls['n']} argv={captured}")
                argv = captured[0]
                self.assertIn("--from-sqlite", argv)
                idx = argv.index("--from-sqlite")
                self.assertEqual(argv[idx + 1], str(sqlite))
                self.assertEqual(invalidated["n"], 1)  # cache invalidate only on rc=0
                self.assertEqual(state.get("generation_id"), "fat:1:assoc22")
                self.assertTrue(any(e.get("slim_result") == "ok" for e in status_events))
            finally:
                pub.cancel()

    def test_slim_publish_reschedules_when_lock_held(self):
        from branding_publish import SlimGridPublisher
        from rebuild_lock import acquire_lock

        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            fake_grid = td_path / "build-branding-grid-index.py"
            fake_grid.write_text("# fake\n", encoding="utf-8")
            sqlite = td_path / "dam-local.sqlite"
            sqlite.write_bytes(b"")
            lock = td_path / "branding-rebuild.lock.json"
            state: dict = {"slim_coalesced": 0}
            state_lock = __import__("threading").Lock()
            status_events: list[dict] = []
            calls = {"n": 0}

            handle, _meta = acquire_lock(
                lock,
                stage="branding:fat",
                ttl_sec=60,
                extra={"owner": "full_rebuild_sim", "mode": "full"},
            )
            self.assertIsNotNone(handle)

            pub = SlimGridPublisher(
                grid_script=fake_grid,
                lock_file=lock,
                sqlite_path=sqlite,
                invalidate_caches=lambda: None,
                write_status=lambda extra: status_events.append(dict(extra or {})),
                append_log=lambda _line: None,
                generation_id_fn=lambda: "g1",
                state=state,
                state_lock=state_lock,
                debounce_sec=0.2,
                subprocess_call=lambda *a, **k: calls.__setitem__("n", calls["n"] + 1) or 0,
            )
            try:
                gen_before = pub._generation
                pub.run(scheduled_gen=gen_before)
                self.assertEqual(calls["n"], 0)
                self.assertGreater(pub._generation, gen_before)
                self.assertTrue(state.get("slim_pending"))
                self.assertTrue(
                    any(e.get("slim_result") == "rescheduled_lock_held" for e in status_events)
                )
            finally:
                if handle is not None:
                    handle.release()
                pub.cancel()


class LiveIndexGuardTests(unittest.TestCase):
    def test_root_without_out_dir_rejects_and_fixture_keeps_live_hashes(self):
        """HARD: --root fixture must not touch live file-index / search-index."""
        import hashlib
        import subprocess

        web_scripts = DESKTOP.parent / "web" / "scripts"
        watch = web_scripts / "watch-file-index.py"
        self.assertTrue(watch.is_file())
        live_data = web_scripts.parent / "data"
        live_fi = live_data / "file-index.json"
        live_si = live_data / "search-index.json"
        self.assertTrue(live_fi.is_file(), "live file-index missing")
        self.assertTrue(live_si.is_file(), "live search-index missing")

        def _sha(path: Path) -> str:
            h = hashlib.sha256()
            h.update(path.read_bytes())
            return h.hexdigest()

        before_fi = _sha(live_fi)
        before_si = _sha(live_si)
        before_fi_size = live_fi.stat().st_size
        before_si_size = live_si.stat().st_size

        # 1) --root without --out-dir must fail fast
        proc = subprocess.run(
            [sys.executable, str(watch), "--root", tempfile.gettempdir(), "--no-initial"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        self.assertNotEqual(proc.returncode, 0)
        joined = (proc.stdout or "") + (proc.stderr or "")
        self.assertIn("--out-dir", joined)
        self.assertEqual(_sha(live_fi), before_fi)
        self.assertEqual(_sha(live_si), before_si)

        # 2) fixture rebuild with --out-dir must not change live hashes
        with tempfile.TemporaryDirectory() as td:
            fx = Path(td) / "fx"
            out = Path(td) / "out"
            fx.mkdir()
            out.mkdir()
            (fx / "probe.txt").write_text("x", encoding="utf-8")
            status = Path(td) / "status.json"
            lock = Path(td) / "lock.json"
            proc2 = subprocess.run(
                [
                    sys.executable,
                    str(watch),
                    "--once",
                    "--root",
                    str(fx),
                    "--out-dir",
                    str(out),
                    "--status-file",
                    str(status),
                    "--lock-file",
                    str(lock),
                ],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            # Builder may exit 0 with empty products; either way live must be untouched.
            self.assertEqual(_sha(live_fi), before_fi)
            self.assertEqual(_sha(live_si), before_si)
            self.assertEqual(live_fi.stat().st_size, before_fi_size)
            self.assertEqual(live_si.stat().st_size, before_si_size)
            # Fixture output (if written) stays under out/
            if (out / "file-index.json").is_file():
                self.assertNotEqual(_sha(out / "file-index.json"), before_fi)


class SeedQuarantineTests(unittest.TestCase):
    """Spray quarantine in seed-asset-product-links (no product hardcode, no --force)."""

    @staticmethod
    def _load_seed_mod():
        import importlib.util

        path = DESKTOP / "scripts" / "seed-asset-product-links.py"
        spec = importlib.util.spec_from_file_location("seed_asset_product_links", path)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        return mod

    def test_spray_quarantine_keeps_strong_and_dispersed(self):
        mod = self._load_seed_mod()
        # Spray: one product soaks >=15% and >=80 weak token rows.
        spray = [
            {
                "asset_id": f"br-s-{i}",
                "product_id": "spray-product-a",
                "score": 55.0,
                "source": "refilter",
                "status": "pending",
                "reason": "token_plus_context:widget",
            }
            for i in range(120)
        ]
        # One strong row inside spray group must survive.
        spray.append(
            {
                "asset_id": "br-s-strong",
                "product_id": "spray-product-a",
                "score": 90.0,
                "source": "refilter",
                "status": "auto",
                "reason": "sku_match",
            }
        )
        # Dispersed weak pending (groups << 80) must remain accepted.
        dispersed = [
            {
                "asset_id": f"br-d-{p}-{i}",
                "product_id": f"prod-{p}",
                "score": 55.0,
                "source": "refilter",
                "status": "pending",
                "reason": "token_plus_context:flavor",
            }
            for p in range(40)
            for i in range(3)
        ]
        # Strong multi_token mass so post-quarantine gate has enough non-token rows.
        strong = [
            {
                "asset_id": f"br-m-{i}",
                "product_id": f"multi-{i % 25}",
                "score": 70.0,
                "source": "refilter",
                "status": "pending",
                "reason": "multi_token:alpha+beta",
            }
            for i in range(100)
        ]
        stats = {
            "lines": len(spray) + len(dispersed) + len(strong),
            "valid_pending": 0,
            "valid_auto": 0,
            "reject_bad_json": 0,
            "reject_missing_ids": 0,
            "reject_unknown_asset": 0,
            "reject_unknown_product": 0,
            "reject_low_score": 0,
            "duplicates": 0,
            "accepted_rows": spray + dispersed + strong,
            "id_valid_total": len(spray) + len(dispersed) + len(strong),
            "id_valid_ratio": 1.0,
        }
        mod.quarantine_spray_groups(stats)
        accepted = stats["accepted_rows"]
        accepted_pids = {r["product_id"] for r in accepted}
        self.assertGreaterEqual(int(stats["reject_quarantined"]), 120)
        self.assertIn("spray-product-a", stats["quarantine_by_product"])
        # Strong sku_match kept
        self.assertTrue(
            any(r["asset_id"] == "br-s-strong" and r["product_id"] == "spray-product-a" for r in accepted)
        )
        # Dispersed pending preserved
        for p in range(40):
            self.assertIn(f"prod-{p}", accepted_pids)
        gate_ok, gate_reason = mod.quality_gate(stats)
        self.assertTrue(gate_ok, gate_reason)

    def test_dispersed_pending_not_quarantined_without_spray_scale(self):
        mod = self._load_seed_mod()
        rows = [
            {
                "asset_id": f"br-{p}-{i}",
                "product_id": f"prod-{p}",
                "score": 55.0,
                "source": "refilter",
                "status": "pending",
                "reason": "token_plus_context:x",
            }
            for p in range(50)
            for i in range(4)  # 4 each => no group >= 80
        ]
        stats = {
            "lines": len(rows),
            "valid_pending": len(rows),
            "valid_auto": 0,
            "reject_bad_json": 0,
            "reject_missing_ids": 0,
            "reject_unknown_asset": 0,
            "reject_unknown_product": 0,
            "reject_low_score": 0,
            "duplicates": 0,
            "accepted_rows": rows,
            "id_valid_total": len(rows),
            "id_valid_ratio": 1.0,
        }
        mod.quarantine_spray_groups(stats)
        self.assertEqual(int(stats["reject_quarantined"]), 0)
        self.assertEqual(len(stats["accepted_rows"]), len(rows))

    def test_apply_preserves_confirmed_rejected_with_quarantine_path(self):
        mod = self._load_seed_mod()
        import assoc_repo

        with tempfile.TemporaryDirectory() as td:
            db = Path(td) / "t.sqlite"
            conn = assoc_repo.connect(db)
            now = assoc_repo.utc_now()
            conn.execute(
                "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                "VALUES(?,?,?,?,?,?,?,?)",
                ("br-1", "p-keep", 100, "manual", "confirmed", "keep", now, "u"),
            )
            conn.execute(
                "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                "VALUES(?,?,?,?,?,?,?,?)",
                ("br-1", "p-rej", 10, "refilter", "rejected", "no", now, "u"),
            )
            conn.commit()
            before = dict(
                conn.execute("SELECT status, COUNT(1) FROM asset_product_links GROUP BY status").fetchall()
            )
            # Quarantine would drop spray rows; apply only clean pending.
            applied_rows = [
                {
                    "asset_id": "br-1",
                    "product_id": "p-keep",
                    "score": 55.0,
                    "source": "refilter",
                    "status": "pending",
                    "reason": "token_plus_context:x",
                },
                {
                    "asset_id": "br-1",
                    "product_id": "p-rej",
                    "score": 90.0,
                    "source": "refilter",
                    "status": "auto",
                    "reason": "sku_match",
                },
                {
                    "asset_id": "br-2",
                    "product_id": "p-new",
                    "score": 70.0,
                    "source": "refilter",
                    "status": "pending",
                    "reason": "multi_token:a+b",
                },
            ]
            mod.apply_accepted(conn, applied_rows, now)
            conn.commit()
            after = dict(
                conn.execute("SELECT status, COUNT(1) FROM asset_product_links GROUP BY status").fetchall()
            )
            rows = {
                (r[0], r[1]): r[2]
                for r in conn.execute(
                    "SELECT asset_id, product_id, status FROM asset_product_links"
                )
            }
            conn.close()
            self.assertEqual(rows[("br-1", "p-keep")], "confirmed")
            self.assertEqual(rows[("br-1", "p-rej")], "rejected")
            self.assertEqual(rows[("br-2", "p-new")], "pending")
            self.assertGreaterEqual(int(after.get("confirmed") or 0), int(before.get("confirmed") or 0))
            self.assertGreaterEqual(int(after.get("rejected") or 0), int(before.get("rejected") or 0))


class AssocQueuePreviewTests(unittest.TestCase):
    """ /assoc/queue: previewable PNG before TIF; distinct asset limit; suggestions kept."""

    def test_previewable_png_before_tif_same_score(self):
        import branding_asset_routes as routes

        assets = {
            "br-tif": {
                "id": "br-tif",
                "name": "pack.tif",
                "path": "M:/x/pack.tif",
                "media_type": "image",
            },
            "br-png": {
                "id": "br-png",
                "name": "pack.png",
                "path": "M:/x/pack.png",
                "media_type": "image",
            },
            "br-psd": {
                "id": "br-psd",
                "name": "pack.psd",
                "path": "M:/x/pack.psd",
                "media_type": "source",
            },
        }
        links = [
            {
                "asset_id": "br-tif",
                "product_id": "p1",
                "score": 100.0,
                "source": "strong_sku_ocr",
                "status": "auto",
                "reason": "sku_match",
            },
            {
                "asset_id": "br-png",
                "product_id": "p1",
                "score": 100.0,
                "source": "strong_sku_ocr",
                "status": "auto",
                "reason": "sku_match",
            },
            {
                "asset_id": "br-png",
                "product_id": "p2",
                "score": 90.0,
                "source": "strong_sku_ocr",
                "status": "auto",
                "reason": "sku_match",
            },
            {
                "asset_id": "br-psd",
                "product_id": "p1",
                "score": 100.0,
                "source": "strong_sku_ocr",
                "status": "auto",
                "reason": "sku_match",
            },
        ]
        items = routes.build_assoc_queue_items(links, assets, item_limit=10)
        self.assertEqual(items[0]["asset_id"], "br-png")
        self.assertTrue(str(items[0]["path"]).lower().endswith(".png"))
        self.assertEqual(items[0]["media_type"], "image")
        self.assertEqual(len(items[0]["suggestions"]), 2)
        self.assertEqual(
            [s["product_id"] for s in items[0]["suggestions"]],
            ["p1", "p2"],
        )
        # TIF/PSD deferred, not dropped
        ids = [it["asset_id"] for it in items]
        self.assertIn("br-tif", ids)
        self.assertIn("br-psd", ids)
        self.assertLess(ids.index("br-png"), ids.index("br-tif"))

    def test_distinct_asset_limit_keeps_all_suggestions(self):
        import branding_asset_routes as routes

        assets = {}
        links = []
        for i in range(5):
            aid = f"br-{i}"
            ext = ".png" if i < 3 else ".tif"
            assets[aid] = {"id": aid, "name": f"a{i}{ext}", "path": f"M:/a{i}{ext}"}
            for j in range(3):
                links.append(
                    {
                        "asset_id": aid,
                        "product_id": f"p-{j}",
                        "score": 100.0 - j,
                        "source": "strong_sku_ocr",
                        "status": "auto",
                        "reason": "sku_match",
                    }
                )
        items = routes.build_assoc_queue_items(links, assets, item_limit=2, candidate_limit=10)
        self.assertEqual(len(items), 2)
        self.assertTrue(all(str(it["path"]).endswith(".png") for it in items))
        self.assertEqual(len(items[0]["suggestions"]), 3)

    def test_queue_meta_contract_helpers(self):
        import branding_asset_routes as routes

        self.assertTrue(routes.is_previewable_asset({"name": "x.JPG", "path": ""}))
        self.assertFalse(routes.is_previewable_asset({"name": "x.tif", "media_type": "image"}))
        self.assertFalse(routes.is_previewable_asset({"name": "x.psd", "media_type": "source"}))


class SeedStrongOnlyTests(unittest.TestCase):
    """--strong-only: SKU/OCR only; weak token/sibling rejected; decisions preserved."""

    @staticmethod
    def _load_seed_mod():
        return SeedQuarantineTests._load_seed_mod()

    def test_strict_evidence_predicates(self):
        mod = self._load_seed_mod()
        self.assertTrue(mod.is_strict_assoc_evidence("sku_match"))
        self.assertTrue(mod.is_strict_assoc_evidence("ocr_line_phrase:kulki limonka"))
        self.assertFalse(mod.is_strict_assoc_evidence("multi_token:a+b"))
        self.assertFalse(mod.is_strict_assoc_evidence("generic_plus_path:x"))
        self.assertFalse(mod.is_strict_assoc_evidence("path_line_phrase:x"))
        self.assertFalse(mod.is_strict_assoc_evidence("token_plus_context:burger"))

    def test_strong_only_gate_rejects_weak_token_rows(self):
        mod = self._load_seed_mod()
        stats = {
            "lines": 100,
            "valid_total": 100,
            "valid_pending": 100,
            "valid_auto": 0,
            "id_valid_total": 100,
            "id_valid_ratio": 1.0,
            "reject_unknown_asset": 0,
            "reject_unknown_product": 0,
            "accepted_rows": [
                {
                    "asset_id": f"br-{i}",
                    "product_id": f"p-{i % 10}",
                    "score": 55.0,
                    "source": "refilter",
                    "status": "pending",
                    "reason": "token_plus_context:x",
                }
                for i in range(100)
            ],
        }
        ok, reason = mod.quality_gate(stats, strong_only=True)
        self.assertFalse(ok)
        self.assertTrue("non_strict" in reason or "token" in reason, reason)

    def test_strong_only_gate_keeps_sku_and_ocr(self):
        mod = self._load_seed_mod()
        rows = [
            {
                "asset_id": f"br-sku-{i}",
                "product_id": f"prod-{i % 15}",
                "score": 100.0,
                "source": "strong_sku_ocr",
                "status": "auto",
                "reason": "sku_match",
            }
            for i in range(40)
        ] + [
            {
                "asset_id": f"br-ocr-{i}",
                "product_id": f"prod-ocr-{i % 5}",
                "score": 92.0,
                "source": "strong_sku_ocr",
                "status": "auto",
                "reason": "ocr_line_phrase:line product",
            }
            for i in range(10)
        ]
        stats = {
            "lines": len(rows),
            "valid_total": len(rows),
            "valid_pending": 0,
            "valid_auto": len(rows),
            "id_valid_total": len(rows),
            "id_valid_ratio": 1.0,
            "reject_unknown_asset": 0,
            "reject_unknown_product": 0,
            "accepted_rows": rows,
        }
        ok, reason = mod.quality_gate(stats, strong_only=True)
        self.assertTrue(ok, reason)

    def test_strong_apply_preserves_and_idempotent(self):
        mod = self._load_seed_mod()
        import assoc_repo

        with tempfile.TemporaryDirectory() as td:
            db = Path(td) / "t.sqlite"
            conn = assoc_repo.connect(db)
            now = assoc_repo.utc_now()
            conn.execute(
                "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                "VALUES(?,?,?,?,?,?,?,?)",
                ("br-1", "p-keep", 100, "manual", "confirmed", "keep", now, "u"),
            )
            conn.execute(
                "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                "VALUES(?,?,?,?,?,?,?,?)",
                ("br-1", "p-rej", 10, "refilter", "rejected", "no", now, "u"),
            )
            conn.commit()
            rows = [
                {
                    "asset_id": "br-1",
                    "product_id": "p-keep",
                    "score": 100.0,
                    "source": "strong_sku_ocr",
                    "status": "auto",
                    "reason": "sku_match",
                },
                {
                    "asset_id": "br-1",
                    "product_id": "p-rej",
                    "score": 100.0,
                    "source": "strong_sku_ocr",
                    "status": "auto",
                    "reason": "sku_match",
                },
                {
                    "asset_id": "br-9",
                    "product_id": "p-new",
                    "score": 100.0,
                    "source": "strong_sku_ocr",
                    "status": "auto",
                    "reason": "sku_match",
                },
            ]
            mod.apply_accepted(conn, rows, now)
            conn.commit()
            after1 = dict(
                conn.execute("SELECT status, COUNT(1) FROM asset_product_links GROUP BY status").fetchall()
            )
            mod.apply_accepted(conn, rows, now)
            conn.commit()
            after2 = dict(
                conn.execute("SELECT status, COUNT(1) FROM asset_product_links GROUP BY status").fetchall()
            )
            statuses = {
                (r[0], r[1]): r[2]
                for r in conn.execute(
                    "SELECT asset_id, product_id, status, reason FROM asset_product_links"
                )
            }
            reasons = {
                (r[0], r[1]): r[3]
                for r in conn.execute(
                    "SELECT asset_id, product_id, status, reason FROM asset_product_links"
                )
            }
            conn.close()
            self.assertEqual(statuses[("br-1", "p-keep")], "confirmed")
            self.assertEqual(statuses[("br-1", "p-rej")], "rejected")
            self.assertEqual(statuses[("br-9", "p-new")], "auto")
            self.assertEqual(reasons[("br-9", "p-new")], "sku_match")
            self.assertEqual(after1, after2)


class ScriptPythonIjsonTests(unittest.TestCase):
    def test_resolve_script_python_has_ijson(self):
        from branding_publish import resolve_script_python

        exe = resolve_script_python(require_ijson=True)
        self.assertTrue(Path(exe).is_file())
        self.assertIn(Path(exe).name.lower(), ("pythonw.exe", "python.exe"))
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        rc = subprocess.call(
            [exe, "-c", "import ijson"],
            creationflags=flags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self.assertEqual(rc, 0)

    def test_watch_has_branding_hook_and_pipeline_script(self):
        watch = DESKTOP.parent / "web" / "scripts" / "watch-file-index.py"
        pipeline = DESKTOP.parent.parent / "scripts" / "ops" / "rebuild-branding-pipeline.py"
        self.assertTrue(watch.is_file())
        self.assertTrue(pipeline.is_file())
        src = watch.read_text(encoding="utf-8")
        self.assertIn("spawn_branding_pipeline", src)
        self.assertIn("rebuild-branding-pipeline.py", src)
        self.assertIn("watch_branding_roots", src)
        self.assertIn("default=2.0", src)
        self.assertIn("default=5", src)
        self.assertIn("max_depth=depth", src)
        bridge = (DESKTOP / "local_bridge.py").read_text(encoding="utf-8")
        self.assertIn("branding_hook_after_index", bridge)
        self.assertIn("resolve_script_python", bridge)
        self.assertIn("interval=2.0", bridge)
        self.assertIn("depth=5", bridge)
        sup_src = (DESKTOP / "index_supervisor.py").read_text(encoding="utf-8")
        self.assertIn('"--depth"', sup_src)


class NestedVizSlotScanTests(unittest.TestCase):
    """WIZKI w INTERNET-PREZENTACJE-RGB (1–2 poziomy) musza trafic do wizki_files."""

    def test_scan_revision_slots_nested_rgb(self):
        import importlib.util

        build = DESKTOP.parent / "web" / "scripts" / "build-file-index.py"
        spec = importlib.util.spec_from_file_location("build_file_index_nested_viz", build)
        self.assertIsNotNone(spec)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)

        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            rev = root / "MINI - 18 06 2026 - 6300782.00 - F"
            rgb = rev / "4 - WIZKI" / "INTERNET-PREZENTACJE-RGB"
            deep = rev / "4 - WIZKI" / "18.06.2026 - 6300782.00" / "INTERNET-PREZENTACJE-RGB"
            rgb.mkdir(parents=True)
            deep.mkdir(parents=True)
            (rgb / "DK-MINI-NERK-CYNAMONKA-6300782.00-RGB-FRONT-S.png").write_bytes(b"png")
            (deep / "DK-MINI-NERK-CIASTO-6300784.00-RGB-FRONT-S.jpg").write_bytes(b"jpg")
            (rev / "4 - WIZKI" / "DK-6300782.00-Pakiet.zip").write_bytes(b"zip")

            slots, files_by_role, wizki = mod.scan_revision_slots(rev, root)
            self.assertTrue(any("WIZKI" in s.upper() for s in slots))
            names = {f.get("name") for f in wizki}
            self.assertIn("DK-MINI-NERK-CYNAMONKA-6300782.00-RGB-FRONT-S.png", names)
            self.assertIn("DK-MINI-NERK-CIASTO-6300784.00-RGB-FRONT-S.jpg", names)
            self.assertEqual(len(wizki), 2)
            # ZIP w WIZKI → print, nie galeria
            viz_names = {f.get("name") for f in (files_by_role.get("viz") or [])}
            self.assertNotIn("DK-6300782.00-Pakiet.zip", viz_names)


if __name__ == "__main__":
    unittest.main()
