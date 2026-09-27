# -*- coding: utf-8 -*-
"""27.09.2026, incydent: zlota aplikacja pokazywala 0 materialow na karcie
produktu. branding-index.json mial "version": 2 (legacy skan build-branding-index.py)
mimo trybu rows - miedzy cyklami asset_sync_runner cos nadpisalo plik zewnetrznie
i runner go nie odbudowal, bo `changed` bylo False w tym cyklu (zero NOWYCH
wierszy). Napraw: runner sprawdza (tanio, bez pelnego json.loads) czy plik
"wyglada" na wynik scalania - jesli nie, odbudowuje go NIEZALEZNIE od `changed`.
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


def _pg_mode(mode_value: str):
    from unittest.mock import MagicMock

    pg = MagicMock()
    cur = MagicMock()
    cur.fetchone.return_value = {"value": mode_value}
    pg.cursor.return_value = cur
    return pg


class IndexLooksLikeRowsTests(unittest.TestCase):
    def test_rozpoznaje_plik_z_wierszy(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        p = Path(tmp.name) / "branding-index.json"
        p.write_text(json.dumps({"version": 1, "generated_at": 1, "source": "rows",
                                 "assets": []}), encoding="utf-8")
        self.assertTrue(asset_sync_runner._index_looks_like_rows(p))

    def test_odrzuca_legacy_skan_v2(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        p = Path(tmp.name) / "branding-index.json"
        p.write_text(json.dumps({"version": 2, "built_at": "x", "marketing_root": "X:/",
                                 "asset_count": 1, "assets": []}), encoding="utf-8")
        self.assertFalse(asset_sync_runner._index_looks_like_rows(p))

    def test_brak_pliku_false(self):
        self.assertFalse(asset_sync_runner._index_looks_like_rows(Path("nie-istnieje.json")))

    def test_duzy_plik_wyglada_na_wiersze_bez_pelnego_parse(self):
        """Nie parsuje calosci - plik 5 MB z odpowiednim naglowkiem tez rozpoznany,
        bez zawieszania sie na wielkosci (branding-index.json bywa >300 MB)."""
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        p = Path(tmp.name) / "branding-index.json"
        big_assets = [{"id": f"br-{i:08d}", "junk": "x" * 200} for i in range(20000)]
        p.write_text(json.dumps({"version": 1, "generated_at": 1, "source": "rows",
                                 "assets": big_assets}), encoding="utf-8")
        self.assertGreater(p.stat().st_size, 3_000_000)
        self.assertTrue(asset_sync_runner._index_looks_like_rows(p))


class RunOnceRebuildsWrongVersionTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.db_path = self.root / "dam-local.sqlite"
        self.data_dir = self.root / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def test_plik_v2_odbudowany_mimo_changed_false(self):
        pg = _pg_mode("rows")
        idx = self.data_dir / "branding-index.json"
        # Legacy v2 (jak build-branding-index.py) - "wersja ze skanu", incydent.
        idx.write_text(json.dumps({
            "version": 2, "built_at": "2026-09-27T20:44:09", "marketing_root": "X:/Marketing",
            "asset_count": 1, "assets": [{"id": "br-legacy001", "junk": True}],
        }), encoding="utf-8")

        row = {"asset_id": "br-000000001", "asset_key": "p/a.jpg", "path_rel": "p/a.jpg",
               "name": "a.jpg", "size": 1, "mtime_ms": 1, "content_hash": None,
               "meta": {}, "deleted_at": None, "updated_at": 1, "updated_by": "M",
               "seen_by_machine": "M", "rev": 1}
        # rows == to, co juz jest lokalnie (symulacja "changed=False" - zero nowych
        # operacji w tym cyklu, ale plik na dysku jest zly).
        fake_result = {"ok": True, "rows": {"br-000000001": row}, "pulled": None,
                       "push": None, "next_last_seen": None, "report": None}
        with patch.object(asset_sync, "sync_cycle", return_value=fake_result):
            result = asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=False, root_path="",
                machine="M", pg_connect=lambda: pg, on_index_written=None,
            )

        self.assertTrue(result["ok"])
        self.assertTrue(result["index_rebuilt_wrong_version"])
        self.assertTrue(result["index_written"])
        payload = json.loads(idx.read_text(encoding="utf-8"))
        self.assertEqual(payload["version"], 1)
        self.assertEqual(payload["source"], "rows")
        self.assertIn("br-000000001", {a["id"] for a in payload["assets"]})

    def test_plik_v2_odbudowany_nawet_gdy_naprawde_changed_false(self):
        """Wersja bardziej rygorystyczna od testu wyzej: wiersz jest JUZ zapisany
        lokalnie (asset_repo), wiec ten cykl naprawde nie ma zadnej NOWEJ operacji
        (changed_ids puste) - a mimo to zly-wersji plik ma zostac odbudowany."""
        import sqlite3
        import asset_repo

        pg = _pg_mode("rows")
        idx = self.data_dir / "branding-index.json"
        idx.write_text(json.dumps({
            "version": 2, "built_at": "x", "marketing_root": "X:/", "asset_count": 1,
            "assets": [{"id": "br-legacy001"}],
        }), encoding="utf-8")

        row = {"asset_id": "br-000000001", "asset_key": "p/a.jpg", "path_rel": "p/a.jpg",
               "name": "a.jpg", "size": 1, "mtime_ms": 1, "content_hash": None,
               "meta": {}, "deleted_at": None, "updated_at": 1, "updated_by": "M",
               "seen_by_machine": "M", "rev": 1}
        conn = sqlite3.connect(str(self.db_path))
        try:
            asset_repo.ensure_local(conn)
            asset_repo.save_rows(conn, {"br-000000001": row})
            conn.commit()
        finally:
            conn.close()

        fake_result = {"ok": True, "rows": {"br-000000001": row}, "pulled": None,
                       "push": None, "next_last_seen": None, "report": None}
        with patch.object(asset_sync, "sync_cycle", return_value=fake_result):
            result = asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=False, root_path="",
                machine="M", pg_connect=lambda: pg, on_index_written=None,
            )

        self.assertTrue(result["index_rebuilt_wrong_version"])
        self.assertTrue(result["index_written"])
        payload = json.loads(idx.read_text(encoding="utf-8"))
        self.assertEqual(payload["version"], 1)
        self.assertEqual(payload["source"], "rows")

    def test_plik_juz_z_wierszy_nie_jest_zbedne_przepisywany(self):
        pg = _pg_mode("rows")
        idx = self.data_dir / "branding-index.json"
        idx.write_text(json.dumps({"version": 1, "generated_at": 1, "source": "rows",
                                   "assets": []}), encoding="utf-8")
        before = idx.read_bytes()
        fake_result = {"ok": True, "rows": {}, "pulled": None, "push": None,
                       "next_last_seen": None, "report": None}
        with patch.object(asset_sync, "sync_cycle", return_value=fake_result):
            result = asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=False, root_path="",
                machine="M", pg_connect=lambda: pg, on_index_written=None,
            )
        self.assertFalse(result["index_rebuilt_wrong_version"])
        self.assertFalse(result.get("index_written", False))
        self.assertEqual(idx.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
