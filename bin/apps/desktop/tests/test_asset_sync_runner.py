# -*- coding: utf-8 -*-
"""asset_sync_runner.run_once: wpiecie scalania indeksu (Faza 2) w most, za
znacznikiem dam_meta.asset_index_mode.

PostgreSQL jest tu ZAWSZE atrapa (MagicMock) - run_once() samo nigdy nie
wykonuje prawdziwego SQL na dam_meta/dam_assets, wiec test steruje tylko tym,
co cursor().fetchone() zwraca. Scalanie samo (asset_sync.sync_cycle) jest
podmieniane przez unittest.mock.patch - to jedyna operacja "sieciowa/PG" w
run_once - dzieki temu testy nie zalezaja od realnego Postgresa. Lokalny
magazyn (asset_repo.py, prawdziwy modul - W2 skonczyl przed tym zadaniem)
dziala na prawdziwym pliku SQLite w katalogu tymczasowym, wiec sprawdzamy
naprawde zapisany stan, nie atrape.
"""
from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asset_repo  # noqa: E402
import asset_sync  # noqa: E402
import asset_sync_runner  # noqa: E402


def _pg_mode(mode_value: str | None) -> MagicMock:
    """Atrapa polaczenia PG: cursor().fetchone() -> {"value": mode_value} albo None."""
    pg = MagicMock()
    cur = MagicMock()
    cur.fetchone.return_value = {"value": mode_value} if mode_value is not None else None
    pg.cursor.return_value = cur
    return pg


def _seed_state(db_path: Path, kv: dict[str, str]) -> None:
    conn = sqlite3.connect(str(db_path))
    try:
        asset_repo.ensure_local(conn)
        for k, v in kv.items():
            asset_repo.set_state(conn, k, v)
        conn.commit()
    finally:
        conn.close()


class AssetSyncRunnerTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.db_path = self.root / "dam-local.sqlite"
        self.data_dir = self.root / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Tryb wylaczony
    # ------------------------------------------------------------------
    def test_mode_off_is_noop(self) -> None:
        pg = _pg_mode(None)  # brak wiersza w dam_meta = off
        result = asset_sync_runner.run_once(
            self.db_path, self.data_dir, root_alive=False, root_path="",
            machine="M", pg_connect=lambda: pg, on_index_written=None,
        )
        self.assertEqual(result, {"ok": True, "mode": "off"})
        self.assertFalse(self.db_path.exists(), "tryb off nie moze tworzyc lokalnego magazynu")
        self.assertFalse((self.data_dir / "branding-index.json").exists())
        pg.close.assert_called_once()

    def test_mode_off_with_other_value_is_noop(self) -> None:
        pg = _pg_mode("snapshots")  # inna wartosc niz "rows" = tez off
        result = asset_sync_runner.run_once(
            self.db_path, self.data_dir, root_alive=True, root_path="Z:/Marketing",
            machine="M", pg_connect=lambda: pg, on_index_written=None,
        )
        self.assertEqual(result, {"ok": True, "mode": "off"})
        self.assertFalse(self.db_path.exists())

    # ------------------------------------------------------------------
    # Tryb "rows" bez ROOT: tylko pull
    # ------------------------------------------------------------------
    def test_rows_mode_without_root_pulls_writes_index_and_calls_back(self) -> None:
        pg = _pg_mode("rows")
        row = {
            "asset_id": "a1", "asset_key": "prod/y.png", "path_rel": "prod/y.png",
            "name": "y.png", "size": 10, "mtime_ms": 123, "content_hash": None,
            "meta": {"media_type": "photo"}, "deleted_at": None, "updated_at": 1,
            "updated_by": "M", "seen_by_machine": "M", "rev": 1,
        }
        fake_result = {"ok": True, "rows": {"a1": row}, "pulled": True, "push": None,
                       "next_last_seen": None, "report": None}
        callback = MagicMock()
        with patch.object(asset_sync, "sync_cycle", return_value=fake_result) as sync_cycle:
            result = asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=False, root_path="Z:/Marketing",
                machine="M", pg_connect=lambda: pg, on_index_written=callback,
            )
        sync_cycle.assert_called_once()
        self.assertNotIn("scan", sync_cycle.call_args.kwargs)  # bez ROOT: brak skanu
        self.assertTrue(result["ok"])
        self.assertEqual(result["mode"], "rows")
        self.assertTrue(result["index_written"])

        index_path = self.data_dir / "branding-index.json"
        self.assertTrue(index_path.is_file())
        payload = json.loads(index_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["source"], "rows")
        self.assertEqual(len(payload["assets"]), 1)
        self.assertEqual(payload["assets"][0]["name"], "y.png")

        callback.assert_called_once()
        self.assertEqual(callback.call_args.args[0], str(index_path))

        # lokalny magazyn naprawde zapisany
        conn = sqlite3.connect(str(self.db_path))
        try:
            saved = asset_repo.load_rows(conn)
        finally:
            conn.close()
        self.assertIn("a1", saved)

    # ------------------------------------------------------------------
    # Tryb "rows" z ROOT i nowym manifestem: sync ze skanem
    # ------------------------------------------------------------------
    def test_rows_mode_with_root_and_new_manifest_scans_and_saves_last_seen(self) -> None:
        pg = _pg_mode("rows")
        manifest = {
            "version": 1, "generated_at": "2026-09-23T00:00:00Z", "scan_time_ms": 1000,
            "root": "Z:/Marketing", "scanned_dirs": [""], "failed_dirs": [], "complete": True,
        }
        (self.data_dir / "branding-scan-dirs.json").write_text(
            json.dumps(manifest), encoding="utf-8"
        )
        scan_assets = [{"path": "Z:/Marketing/prod/img.jpg", "size": 5, "mtime_ms": 900}]
        (self.data_dir / "branding-index.scan.json").write_text(
            json.dumps({"assets": scan_assets}), encoding="utf-8"
        )
        # confirmed_dirs z poprzedniej sesji admina - ma zniknac po udanym cyklu
        _seed_state(self.db_path, {"asset_sync_confirmed_dirs": json.dumps(["prod"])})

        aid, entry = asset_sync.scan_entry(
            "Z:/Marketing/prod/img.jpg", size=5, mtime_ms=900, root="Z:/Marketing",
        )
        row = dict(entry, asset_id=aid, deleted_at=None, updated_at=900,
                   updated_by="M", seen_by_machine="M", rev=1, content_hash=None)
        fake_result = {"ok": True, "rows": {aid: row}, "pulled": None, "push": {"ok": True},
                       "next_last_seen": {aid}, "report": {"blocked": {}, "skipped_unlisted": 0,
                                                            "stale_ignored": 0}}
        with patch.object(asset_sync, "sync_cycle", return_value=fake_result) as sync_cycle:
            result = asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=True, root_path="Z:/Marketing",
                machine="M", pg_connect=lambda: pg, on_index_written=None,
            )

        sync_cycle.assert_called_once()
        kwargs = sync_cycle.call_args.kwargs
        self.assertIn("scan", kwargs)
        self.assertIn(aid, kwargs["scan"])
        self.assertEqual(kwargs["scan_time_ms"], 1000)
        self.assertEqual(kwargs["scanned_dirs"], [""])
        self.assertEqual(kwargs.get("confirmed_dirs"), ["prod"])  # z poprzedniej sesji admina

        self.assertTrue(result["ok"])
        self.assertTrue(result["did_scan"])

        conn = sqlite3.connect(str(self.db_path))
        try:
            self.assertEqual(asset_repo.load_last_seen(conn), {aid})
            self.assertEqual(asset_repo.get_state(conn, "asset_sync_last_scan_time_ms"), "1000")
            self.assertEqual(asset_repo.get_state(conn, "asset_sync_confirmed_dirs"), "[]")
        finally:
            conn.close()

    def _manifest_for_index(self, index_path, *, tamper: bool = False) -> dict:
        st = index_path.stat()
        return {"scan_time_ms": 2000, "scanned_dirs": [""], "failed_dirs": [],
                "index_size": st.st_size + (1 if tamper else 0), "index_mtime_ns": st.st_mtime_ns}

    def test_failed_cycle_with_scan_keeps_build_output_for_retry(self) -> None:
        """23.09: nieudany PUSH nadpisal branding-index.json wierszami - skan przepadl."""
        pg = _pg_mode("rows")
        idx = self.data_dir / "branding-index.json"
        idx.write_text(json.dumps({"assets": [{"path": "Z:/Marketing/p/a.jpg", "size": 1, "mtime_ms": 5}]}),
                       encoding="utf-8")
        before = idx.read_bytes()
        (self.data_dir / "branding-scan-dirs.json").write_text(
            json.dumps(self._manifest_for_index(idx)), encoding="utf-8")
        _seed_state(self.db_path, {"asset_sync_last_scan_time_ms": "0"})
        row = {"asset_id": "br-012345678", "asset_key": "p/x.jpg", "path_rel": "p/x.jpg",
               "rev": 7, "mtime_ms": 1}
        fake = {"ok": False, "error": "duplicate key", "rows": {"br-012345678": row},
                "pulled": None, "push": {"ok": False}}
        with patch.object(asset_sync, "sync_cycle", return_value=fake):
            res = asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=True, root_path="Z:/Marketing",
                machine="M", pg_connect=lambda: pg, on_index_written=None,
            )
        self.assertTrue(res["did_scan"])
        self.assertFalse(res["index_written"])
        self.assertEqual(idx.read_bytes(), before)

    def test_index_is_scan_only_when_fingerprint_matches(self) -> None:
        """Bez .scan.json: branding-index.json jest skanem tylko, gdy to plik z buildu."""
        pg = _pg_mode("rows")
        idx = self.data_dir / "branding-index.json"
        idx.write_text(json.dumps({"assets": [{"path": "Z:/Marketing/p/a.jpg", "size": 1, "mtime_ms": 5}]}),
                       encoding="utf-8")
        fake = {"ok": True, "rows": {}, "pulled": None, "push": None, "next_last_seen": set(), "report": {"blocked": {}}}
        for tamper, want_scan in ((False, True), (True, False)):
            (self.data_dir / "branding-scan-dirs.json").write_text(
                json.dumps(self._manifest_for_index(idx, tamper=tamper)), encoding="utf-8")
            _seed_state(self.db_path, {"asset_sync_last_scan_time_ms": "0"})
            with patch.object(asset_sync, "sync_cycle", return_value=fake) as sync_cycle:
                asset_sync_runner.run_once(
                    self.db_path, self.data_dir, root_alive=True, root_path="Z:/Marketing",
                    machine="M", pg_connect=lambda: pg, on_index_written=None,
                )
            self.assertEqual("scan" in sync_cycle.call_args.kwargs, want_scan, f"tamper={tamper}")

    def test_rows_mode_with_root_but_stale_manifest_is_pull_only(self) -> None:
        pg = _pg_mode("rows")
        manifest = {"scan_time_ms": 500, "scanned_dirs": [""], "failed_dirs": []}
        (self.data_dir / "branding-scan-dirs.json").write_text(
            json.dumps(manifest), encoding="utf-8"
        )
        _seed_state(self.db_path, {"asset_sync_last_scan_time_ms": "1000"})  # nowszy niz manifest
        fake_result = {"ok": True, "rows": {}, "pulled": None, "push": None,
                       "next_last_seen": None, "report": None}
        with patch.object(asset_sync, "sync_cycle", return_value=fake_result) as sync_cycle:
            result = asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=True, root_path="Z:/Marketing",
                machine="M", pg_connect=lambda: pg, on_index_written=None,
            )
        self.assertNotIn("scan", sync_cycle.call_args.kwargs)
        self.assertFalse(result["did_scan"])

    # ------------------------------------------------------------------
    # Blad sieci: brak zmian lokalnych
    # ------------------------------------------------------------------
    def test_network_error_on_connect_makes_no_local_changes(self) -> None:
        def _boom():
            raise ConnectionError("brak sieci")

        result = asset_sync_runner.run_once(
            self.db_path, self.data_dir, root_alive=True, root_path="Z:/Marketing",
            machine="M", pg_connect=_boom, on_index_written=None,
        )
        self.assertFalse(result["ok"])
        self.assertIn("brak sieci", result["error"])
        self.assertFalse(self.db_path.exists())
        self.assertFalse((self.data_dir / "branding-index.json").exists())

    def test_network_error_during_mode_lookup_reports_error_not_off(self) -> None:
        """Polaczenie zerwane w trakcie SELECT na dam_meta to blad, nie 'off' -
        cichy fallback na off ukrylby prawdziwa awarie jako 'wszystko OK, wylaczone'."""
        pg = MagicMock()
        pg.cursor.side_effect = RuntimeError("polaczenie zerwane")
        result = asset_sync_runner.run_once(
            self.db_path, self.data_dir, root_alive=False, root_path="",
            machine="M", pg_connect=lambda: pg, on_index_written=None,
        )
        self.assertFalse(result["ok"])
        self.assertIn("polaczenie zerwane", result["error"])
        self.assertFalse(self.db_path.exists())

    def test_sync_cycle_failure_reports_error_without_losing_rows(self) -> None:
        pg = _pg_mode("rows")
        fake_result = {"ok": False, "rows": {}, "error": "push_failed",
                       "pulled": None, "push": None, "next_last_seen": None, "report": None}
        with patch.object(asset_sync, "sync_cycle", return_value=fake_result):
            result = asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=False, root_path="",
                machine="M", pg_connect=lambda: pg, on_index_written=None,
            )
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "push_failed")

    # ------------------------------------------------------------------
    # Pomocnik zgodnosci sygnatury confirmed_dirs
    # ------------------------------------------------------------------
    def test_accepts_confirmed_dirs_helper(self) -> None:
        def without_it(pg, rows, *, machine=""):
            return None

        def with_it(pg, rows, *, machine="", confirmed_dirs=()):
            return None

        def with_kwargs(pg, rows, **kwargs):
            return None

        self.assertFalse(asset_sync_runner._accepts_confirmed_dirs(without_it))
        self.assertTrue(asset_sync_runner._accepts_confirmed_dirs(with_it))
        self.assertTrue(asset_sync_runner._accepts_confirmed_dirs(with_kwargs))
        # dzisiejszy prawdziwy asset_sync.sync_cycle JUZ przyjmuje confirmed_dirs (W2)
        self.assertTrue(asset_sync_runner._accepts_confirmed_dirs(asset_sync.sync_cycle))


if __name__ == "__main__":
    unittest.main()
