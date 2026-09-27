# -*- coding: utf-8 -*-
"""Faza 3, decyzja kierownika 27.09.2026 (utwardzona 27.09.2026, zadanie 3.3):
komputer bez uprawnien (index_authority) smie wyslac TYLKO dodanie pliku, ktorego
w bazie nie ma (reason="add"), i zmiane z mtime scisle nowszym na zywym wierszu
(reason="change"). Tombstone, restore, recreate (ponowne utworzenie NA WIERSZU Z
TOMBSTONEM) i sama zmiana opisu (meta, ten sam mtime) trafiaja do potwierdzenia.
Sprawdza (1) filtr operacji w asset_sync_runner._sync_cycle_restricted_ops
(zlozony z publicznych funkcji asset_sync.py - ten plik nie jest zmieniany) i
(2) ze run_once() rozroznia sciezke publish/no-publish po wyniku
index_authority.may_publish().
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asset_sync  # noqa: E402
import asset_sync_runner  # noqa: E402
import index_authority as ia  # noqa: E402


class _DispatchPg:
    """Atrapa PG: dam_meta['asset_index_mode'] i dam_meta['index_authority'] maja
    NIEZALEZNE wartosci (w przeciwienstwie do _pg_mode() w test_asset_sync_runner.py,
    ktory zwraca jedna statyczna wartosc dla kazdego zapytania - to wystarczalo,
    dopoki byl tylko jeden klucz w dam_meta odczytywany przez run_once)."""

    def __init__(self, values: dict[str, str]):
        self._values = values
        self._last_key = None

    def cursor(self):
        return self

    def execute(self, sql, params=None):
        self._last_key = params[0] if params else None

    def fetchone(self):
        val = self._values.get(self._last_key)
        return {"value": val} if val is not None else None

    def fetchall(self):
        return []

    def close(self):
        pass


class SyncCycleRestrictedOpsTests(unittest.TestCase):
    """Filtr operacji sam w sobie, bez run_once/manifestu naokolo."""

    def setUp(self):
        # index_authority._save_persisted() pisalby do prawdziwego katalogu stanu
        # uzytkownika przy kazdym udanym odczycie - w tych testach nie odczytujemy
        # klucza wcale (patchujemy pull_since/diff_scan_report/push_ops bezposrednio),
        # ale dla porzadku izolujemy i ten plik (Faza 3, zadanie 1 - zero prawdziwych
        # zapisow z testow).
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        p = patch.object(ia, "_state_path", return_value=Path(tmp.name) / "index-authority.json")
        p.start()
        self.addCleanup(p.stop)

    def test_tylko_add_i_change_ida_dalej_reszta_wstrzymana(self):
        pg = object()
        fake_report = {
            "ops": [
                {"op": "upsert", "reason": "add", "asset_id": "a1"},       # nowy plik - idzie
                {"op": "upsert", "reason": "change", "asset_id": "a2"},    # mtime nowszy - idzie
                {"op": "upsert", "reason": "meta", "asset_id": "a3"},      # sam opis - wstrzymane
                {"op": "upsert", "reason": "recreate", "asset_id": "a4"},  # tombstone+nowszy - wstrzymane
                {"op": "restore", "reason": "reappeared", "asset_id": "a5"},  # wstrzymane
                {"op": "tombstone", "reason": "missing", "asset_id": "a6"},   # wstrzymane
            ],
            "blocked": {"jakis/folder": 2},
            "next_last_seen": {"a1", "a2"},
            "skipped_unlisted": 0,
            "stale_ignored": 0,
        }
        with patch.object(asset_sync, "pull_since", return_value={"ok": True, "rows": []}), \
             patch.object(asset_sync, "apply_remote", side_effect=lambda rows, remote: dict(rows)), \
             patch.object(asset_sync, "max_rev", return_value=0), \
             patch.object(asset_sync, "diff_scan_report", return_value=fake_report), \
             patch.object(asset_sync, "push_ops", return_value={"ok": True, "applied": 2, "refused": 0}) as push_ops:
            out = asset_sync_runner._sync_cycle_restricted_ops(
                pg, {}, scan={"a1": {}}, scanned_dirs=[""], scan_time_ms=1, machine="ME",
            )

        pushed_ops = push_ops.call_args.args[1]
        pushed_ids = {op["asset_id"] for op in pushed_ops}
        self.assertEqual(pushed_ids, {"a1", "a2"})  # tylko add/change

        blocked = out["report"]["blocked"]
        self.assertEqual(blocked["jakis/folder"], 2)  # bezpiecznik 20% zostaje nietkniety
        self.assertEqual(blocked[asset_sync_runner.NOT_AUTHORITY_BUCKET], 4)  # a3,a4,a5,a6
        self.assertEqual(out["report"]["not_authority_held"], 4)
        self.assertTrue(out["ok"])

    def test_brak_skanu_zachowuje_sie_jak_sync_cycle(self):
        pg = object()
        with patch.object(asset_sync, "pull_since", return_value={"ok": True, "rows": []}), \
             patch.object(asset_sync, "apply_remote", side_effect=lambda rows, remote: dict(rows)), \
             patch.object(asset_sync, "max_rev", return_value=0):
            out = asset_sync_runner._sync_cycle_restricted_ops(pg, {"x": 1}, scan=None)
        self.assertIsNone(out["report"])
        self.assertIsNone(out["push"])
        self.assertTrue(out["ok"])


def _pg_two_keys(asset_index_mode: str | None, index_authority: dict | None) -> _DispatchPg:
    values: dict[str, str] = {}
    if asset_index_mode is not None:
        values["asset_index_mode"] = asset_index_mode
    if index_authority is not None:
        values["index_authority"] = json.dumps(index_authority, ensure_ascii=False)
    return _DispatchPg(values)


class RunOnceRoutingTests(unittest.TestCase):
    """run_once() musi wolac _sync_cycle_restricted_ops TYLKO gdy authority == False
    i jest skan; w kazdym innym przypadku (brak klucza, maszyna uprawniona, brak
    skanu) zachowuje sie jak dzis (asset_sync.sync_cycle)."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.db_path = self.root / "dam-local.sqlite"
        self.data_dir = self.root / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)

        state_tmp = tempfile.TemporaryDirectory()
        self.addCleanup(state_tmp.cleanup)
        p = patch.object(ia, "_state_path", return_value=Path(state_tmp.name) / "index-authority.json")
        p.start()
        self.addCleanup(p.stop)

        ia._CACHE.update(at=0.0, value=None, raw={}, error="")
        import os
        self._env = patch.dict(os.environ, {"COMPUTERNAME": "ME", "HOSTNAME": ""})
        self._env.start()
        self.addCleanup(self._env.stop)

    def _write_manifest_and_scan(self):
        manifest = {"version": 1, "scan_time_ms": 1000, "root": "Z:/Marketing",
                    "scanned_dirs": [""], "failed_dirs": [], "complete": True}
        (self.data_dir / "branding-scan-dirs.json").write_text(json.dumps(manifest), encoding="utf-8")
        (self.data_dir / "branding-index.scan.json").write_text(
            json.dumps({"assets": [{"path": "Z:/Marketing/p/a.jpg", "size": 1, "mtime_ms": 5}]}),
            encoding="utf-8",
        )

    def test_maszyna_spoza_listy_uzywa_filtru_ograniczonego(self):
        pg = _pg_two_keys("rows", {"machines": ["INNY"]})
        self._write_manifest_and_scan()
        fake = {"ok": True, "rows": {}, "push": None, "pulled": None,
                "next_last_seen": set(), "report": {"blocked": {}}}
        with patch.object(asset_sync, "sync_cycle") as sync_cycle, \
             patch.object(asset_sync_runner, "_sync_cycle_restricted_ops", return_value=fake) as restricted:
            result = asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=True, root_path="Z:/Marketing",
                machine="ME", pg_connect=lambda: pg, on_index_written=None,
            )
        sync_cycle.assert_not_called()
        restricted.assert_called_once()
        self.assertEqual(result["mode"], "rows")
        self.assertFalse(self._authority_flag(result))

    def test_maszyna_na_liscie_case_insensitive_uzywa_zwyklego_sync_cycle(self):
        # "me" w bazie, COMPUTERNAME="ME" - porownanie ma byc bez wzgledu na wielkosc liter.
        pg = _pg_two_keys("rows", {"machines": ["me", "inny"]})
        self._write_manifest_and_scan()
        fake = {"ok": True, "rows": {}, "push": None, "pulled": None,
                "next_last_seen": set(), "report": {"blocked": {}}}
        with patch.object(asset_sync, "sync_cycle", return_value=fake) as sync_cycle, \
             patch.object(asset_sync_runner, "_sync_cycle_restricted_ops") as restricted:
            asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=True, root_path="Z:/Marketing",
                machine="ME", pg_connect=lambda: pg, on_index_written=None,
            )
        sync_cycle.assert_called_once()
        restricted.assert_not_called()

    def test_brak_klucza_authority_uzywa_zwyklego_sync_cycle(self):
        pg = _pg_two_keys("rows", None)  # klucz index_authority nie istnieje
        self._write_manifest_and_scan()
        fake = {"ok": True, "rows": {}, "push": None, "pulled": None,
                "next_last_seen": set(), "report": {"blocked": {}}}
        with patch.object(asset_sync, "sync_cycle", return_value=fake) as sync_cycle, \
             patch.object(asset_sync_runner, "_sync_cycle_restricted_ops") as restricted:
            asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=True, root_path="Z:/Marketing",
                machine="ME", pg_connect=lambda: pg, on_index_written=None,
            )
        sync_cycle.assert_called_once()
        restricted.assert_not_called()

    @staticmethod
    def _authority_flag(result: dict) -> bool | None:
        return result.get("authority")


if __name__ == "__main__":
    unittest.main()
