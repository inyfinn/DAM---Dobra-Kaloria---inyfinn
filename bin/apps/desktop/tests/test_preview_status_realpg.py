# -*- coding: utf-8 -*-
"""Plan naprawy etap 4 pkt 4 - test raportu pokrycia (preview-coverage.py) na
PRAWDZIWYM PostgreSQL: baza dam_eta_test na inyfinn-syno (rola dam_test),
przez bin/scripts/qa/testenv/run_realpg.py (DAM_TEST_PG_DSN). Kazdy test:
wlasny schemat t_<losowy> (realpg.fresh_db) ze schematem aplikacji
(dam_assets, dam_thumb_cache_index tworzone przez schema.apply_schema -
dokladnie te tabele, ktorych preview-coverage.py naprawde czyta). Bez
DAM_TEST_PG_DSN testy sa pomijane (skip), nigdy nie lacza sie z produkcja.

Ten test NIE laczy sie z produkcyjna baza i nie jest wolany przez
preview-coverage.py sam - orchestrator uruchamia realny skrypt na produkcji
oddzielnie (patrz RAPORT.md, W6)."""
from __future__ import annotations

import importlib.util
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
DESKTOP = HERE.parent
WEB_SCRIPTS = DESKTOP.parents[0] / "web" / "scripts"
for _p in (str(DESKTOP), str(HERE), str(WEB_SCRIPTS)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import preview_status as ps  # noqa: E402
from asset_ids import asset_key  # noqa: E402

SCRIPT_PATH = DESKTOP.parents[1] / "scripts" / "ops" / "preview-coverage.py"


def _load_coverage_script():
    spec = importlib.util.spec_from_file_location("preview_coverage_ops", SCRIPT_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


class _RealPG(unittest.TestCase):
    def setUp(self):
        import psycopg2
        import psycopg2.extras
        import realpg

        admin_dsn = realpg.require(self)
        cm = realpg.fresh_db(admin_dsn)
        self.dsn = cm.__enter__()
        self.addCleanup(cm.__exit__, None, None, None)
        self.pg = psycopg2.connect(self.dsn, cursor_factory=psycopg2.extras.RealDictCursor,
                                    connect_timeout=10)
        self.addCleanup(self.pg.close)
        cur = self.pg.cursor()
        cur.execute("SELECT current_database() AS db, current_schema() AS s")
        row = cur.fetchone()
        self.assertTrue(str(row["db"]).startswith("dam_eta_test"), row)
        self.assertTrue(str(row["s"]).startswith("t_"), row)
        self.pg.commit()

    def connect(self):
        import psycopg2
        import psycopg2.extras

        return psycopg2.connect(self.dsn, cursor_factory=psycopg2.extras.RealDictCursor,
                                 connect_timeout=10)

    def insert_asset(self, asset_id: str, path_rel: str, *, mtime_ms: int, size: int = 100,
                      name: str = ""):
        cur = self.pg.cursor()
        cur.execute(
            "INSERT INTO dam_assets (asset_id, asset_key, path_rel, name, size, mtime_ms, "
            "updated_at, updated_by, seen_by_machine) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (asset_id, asset_key(path_rel), path_rel, name or Path(path_rel).name, size, mtime_ms,
             int(time.time() * 1000), "TEST", "TEST"),
        )
        self.pg.commit()

    def insert_thumb_index(self, store_key: str, *, digest: str, mtime: float):
        cur = self.pg.cursor()
        cur.execute(
            "INSERT INTO dam_thumb_cache_index (store_key, digest, mtime, publisher, published_at) "
            "VALUES (%s, %s, %s, %s, %s)",
            (store_key, digest, mtime, "TEST", "2026-09-28T00:00:00Z"),
        )
        self.pg.commit()


class CoverageScriptRealPGTests(_RealPG):
    """schema.apply_schema (wolane przez realpg.fresh_db) tworzy dam_assets
    (asset_sync.ensure_schema) i dam_thumb_cache_index (pg_db._ensure_kv_index)
    - te DWIE tabele, ktore preview-coverage.py naprawde odczytuje."""

    def setUp(self):
        super().setUp()
        self.mod = _load_coverage_script()

    def test_fetch_assets_tylko_zywe_wiersze(self):
        self.insert_asset("a1", "- POLSKA/x/zywy.png", mtime_ms=1_000)
        self.insert_asset("a2", "- POLSKA/x/usuniety.png", mtime_ms=1_000)
        cur = self.pg.cursor()
        cur.execute("UPDATE dam_assets SET deleted_at = %s WHERE asset_id = %s", (2_000, "a2"))
        self.pg.commit()
        assets = self.mod.fetch_assets(self.pg)
        self.assertEqual([a.asset_id for a in assets], ["a1"])

    def test_fetch_thumb_index_laczy_kolizje_po_asset_key_najnowszy_mtime(self):
        """Dwa surowe 'rel' rozne litera dysku/wielkoscia liter, ten sam
        asset_key - raport ma wziac WIEKSZY (nowszy) mtime, nie pierwszy z brzegu."""
        self.insert_thumb_index("M:/- polska/x/a.png|grid", digest="stary", mtime=10.0)
        self.insert_thumb_index("x:/marketing/- POLSKA/x/A.PNG|grid", digest="nowy", mtime=20.0)
        idx = self.mod.fetch_thumb_index(self.pg)
        key = f"{asset_key('- polska/x/a.png')}|grid"
        self.assertIn(key, idx)
        self.assertEqual(idx[key].digest, "nowy")
        self.assertEqual(idx[key].mtime, 20.0)

    def test_raport_pelny_ready_pending_unsupported_failed(self):
        # ready: index mtime (sek) * 1000 >= mtime_ms
        self.insert_asset("ready1", "- POLSKA/1/gotowy.png", mtime_ms=5_000)
        self.insert_thumb_index(f"{'- POLSKA/1/gotowy.png'}|grid", digest="gotowy-digest", mtime=5.0)
        # pending: brak wpisu
        self.insert_asset("pending1", "- POLSKA/1/brak.png", mtime_ms=5_000)
        # pending: wpis STARSZY niz plik (plan etap 4 p.3 - nie wolno pokazac jako ready)
        self.insert_asset("stale1", "- POLSKA/1/przestarzaly.png", mtime_ms=9_000)
        self.insert_thumb_index("- POLSKA/1/przestarzaly.png|grid", digest="stary-digest", mtime=1.0)
        # unsupported: rozszerzenie spoza FILL_SUPPORTED_EXT
        self.insert_asset("unsup1", "- POLSKA/1/wykrojnik.ai", mtime_ms=5_000)

        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        state_dir = Path(tmp.name)
        import dam_thumb_cache as tc

        with patch.object(tc.platform_compat, "user_state_dir", return_value=state_dir):
            # failed: porazka zapisana DOKLADNIE dla biezacej wersji (mtime_ms=5000)
            tc.record_preview_failure(asset_key("- POLSKA/1/zepsuty.png"), mtime_ms=5_000,
                                       profile="grid", reason="encode_failed")
            self.insert_asset("failed1", "- POLSKA/1/zepsuty.png", mtime_ms=5_000)

            report = self.mod.build_report(self.pg, profile="grid", top_n=10)

        self.assertEqual(report["total"], 5)
        self.assertEqual(report["counts"], {"ready": 1, "pending": 2, "failed": 1, "unsupported": 1})
        self.assertEqual(report["by_extension"][".png"], {"ready": 1, "pending": 2, "failed": 1})
        self.assertEqual(report["by_extension"][".ai"], {"unsupported": 1})
        self.assertTrue(report["local_failures_available"])
        self.assertEqual(report["local_failures_rows"], 1)
        folders = {row["folder"]: row["count"] for row in report["top_missing_folders"]}
        self.assertEqual(folders.get("- POLSKA/1"), 3)  # pending1 + stale1 + failed1

    def test_stara_porazka_innej_wersji_nie_blokuje_nowej_proby(self):
        """Plik zmienil sie po nieudanej probie: porazka zapisana dla starego
        mtime_ms nie moze wiecznie oznaczac nowej wersji jako 'failed'."""
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        state_dir = Path(tmp.name)
        import dam_thumb_cache as tc

        with patch.object(tc.platform_compat, "user_state_dir", return_value=state_dir):
            tc.record_preview_failure(asset_key("- POLSKA/2/zmieniony.png"), mtime_ms=1_000,
                                       profile="grid", reason="encode_failed")
            self.insert_asset("changed1", "- POLSKA/2/zmieniony.png", mtime_ms=2_000)
            report = self.mod.build_report(self.pg, profile="grid", top_n=10)
        self.assertEqual(report["counts"], {"pending": 1})


def load_tests(loader, tests, pattern):  # noqa: ARG001
    import os

    print(f"[preview_status realpg] DAM_TEST_PG_DSN={'ustawione' if os.environ.get('DAM_TEST_PG_DSN') else 'brak (skip)'}")
    return tests


if __name__ == "__main__":
    unittest.main()
