# -*- coding: utf-8 -*-
"""Dopisane po korekcie wlasciciela 2026-09-28 (przekazanej przez orkiestratora):
zero lokalnego testowego PostgreSQL, zero polaczen zapisu do produkcji z testow.
Ten plik pilnuje dwoch rzeczy na PRAWDZIWYCH plikach konfiguracyjnych tej
instalacji (nie kopiach):

1. Zaden test/operacja pg_db w trybie testowym (DAM_TEST_PG=1) nie dotyka
   (nie czyta tresci, a przede wszystkim NIE ZAPISUJE) pg-config.json,
   pg-config.json.off, pg-config.dpapi, pg-config.code.dpapi,
   pg-config.sealed.json ani dam-connection.env - sha256 kazdego z istniejacych
   plikow jest identyczny przed i po. Haslo/tresc pliku nigdy nie trafia do
   asercji ani do stdout - tylko skrot.
2. Bez flagi testowej (produkcyjna sciezka _load_config()) kod nadal wskazuje
   hosty z prawdziwej, zapisanej konfiguracji (nigdy localhost jako domyslny
   host) - dokladnie te same wartosci, co w pliku na dysku."""
from __future__ import annotations

import hashlib
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import pg_db  # noqa: E402

_WATCHED_NAMES = (
    "pg-config.json",
    "pg-config.json.off",
    "pg-config.bundled.json",
    "pg-config.dpapi",
    "pg-config.code.dpapi",
    "pg-config.sealed.json",
)


def _watched_paths() -> list[Path]:
    data_dir = pg_db.DESKTOP_DIR / "data"
    out = [data_dir / name for name in _WATCHED_NAMES]
    out.append(pg_db.DESKTOP_DIR / "pg-config.json")
    out.append(pg_db.ENV_PATH)
    return out


def _sha_snapshot() -> dict[str, str | None]:
    snap: dict[str, str | None] = {}
    for p in _watched_paths():
        if p.is_file():
            snap[str(p)] = hashlib.sha256(p.read_bytes()).hexdigest()
        else:
            snap[str(p)] = None
    return snap


class ConfigFilesUntouchedByTestModeTests(unittest.TestCase):
    def setUp(self):
        self.before = _sha_snapshot()
        self._env_patch = mock.patch.dict("os.environ", {}, clear=False)
        self._env_patch.start()
        self.addCleanup(self._env_patch.stop)
        import os

        for key in (
            "DAM_TEST_PG",
            "DAM_PG_HOST",
            "DAM_PG_HOSTS",
            "DAM_PG_PORT",
            "DAM_PG_DBNAME",
            "DAM_PG_USER",
            "DAM_PG_PASSWORD",
            "DAM_PG_SSLMODE",
        ):
            os.environ.pop(key, None)
        pg_db.reset_config_cache()
        self.addCleanup(pg_db.reset_config_cache)

    def test_test_mode_battery_does_not_write_config_files(self):
        import os

        # Bateria operacji, ktore w trybie testowym dotykalyby konfiguracji,
        # gdyby bramka test-mode miala jakikolwiek fallback do plikow.
        os.environ["DAM_TEST_PG"] = "1"
        os.environ["DAM_PG_HOST"] = "127.0.0.1"
        os.environ["DAM_PG_PORT"] = "55433"
        os.environ["DAM_PG_PASSWORD"] = "haslo-tylko-w-env-tego-testu"

        cfg = pg_db._load_config()
        self.assertTrue(cfg.get("_test_mode"))
        pg_db._primary_host(cfg)

        # connect() z fake psycopg2, zeby nie dotykac sieci - interesuje nas
        # wylacznie to, czy PO DRODZE cokolwiek zapisalo plik konfiguracji.
        # Patchujemy caly `pg_db.psycopg2` (nie .connect na sys.modules), bo
        # test_asset_repo.py (poza zakresem tej partii) potrafi w zaleznosci
        # od kolejnosci importow calego zestawu podmienic sys.modules["psycopg2"]
        # na pusty modul bez .connect - patrz test_pg_db_isolation.py,
        # _fake_psycopg2_module, i SUITE-START.md w work/2026-09-28/W1/.
        fake_conn = mock.MagicMock()
        fake_cursor = mock.MagicMock()
        fake_cursor.fetchall.return_value = [{"?column?": 1}]
        fake_conn.cursor.return_value = fake_cursor
        fake_psycopg2 = mock.MagicMock(name="fake_psycopg2_module")
        fake_psycopg2.connect = mock.MagicMock(return_value=fake_conn)
        fake_psycopg2.extras.RealDictCursor = object()
        fake_psycopg2.OperationalError = RuntimeError
        with mock.patch.object(pg_db, "psycopg2", fake_psycopg2):
            pg_db.connect()

        pg_db.reset_config_cache()
        # is_configured() w trybie testowym woloby ensure_pg_config_ready(),
        # ktore w normalnym (produkcyjnym) trybie MOZE dopisac plik - upewniamy
        # sie, ze w trybie testowym tego nie robi (bo _load_config w tym trybie
        # nigdy nie schodzi do _read_stored_config/ensure_pg_config_ready).
        try:
            pg_db._load_config()
        except pg_db.PgNotConfigured:
            pass

        after = _sha_snapshot()
        self.assertEqual(
            self.before,
            after,
            "tryb testowy pg_db nie moze zmienic zadnego pliku konfiguracji aplikacji",
        )


class ProductionPathUnchangedHostsTests(unittest.TestCase):
    """Bez DAM_TEST_PG i bez loopbacku, _load_config() ma nadal wskazywac
    prawdziwe hosty zapisane na dysku - nigdy localhost jako domyslny."""

    def setUp(self):
        self._env_patch = mock.patch.dict("os.environ", {}, clear=False)
        self._env_patch.start()
        self.addCleanup(self._env_patch.stop)
        import os

        for key in (
            "DAM_TEST_PG",
            "DAM_PG_HOST",
            "DAM_PG_HOSTS",
            "DAM_PG_PORT",
            "DAM_PG_DBNAME",
            "DAM_PG_USER",
            "DAM_PG_PASSWORD",
            "DAM_PG_SSLMODE",
        ):
            os.environ.pop(key, None)
        pg_db.reset_config_cache()
        self.addCleanup(pg_db.reset_config_cache)

    def test_production_hosts_match_file_on_disk_and_are_never_localhost(self):
        cfg_path = pg_db.DESKTOP_DIR / "data" / "pg-config.json"
        if not cfg_path.is_file():
            self.skipTest("brak pg-config.json na tej stacji - nie da sie porownac z prawdziwym plikiem")
        on_disk = json.loads(cfg_path.read_text(encoding="utf-8"))
        expected_host = str(on_disk.get("host") or "").strip()
        if not expected_host:
            self.skipTest("pg-config.json bez pola host - nic do porownania")

        cfg = pg_db._load_config()
        self.assertFalse(cfg.get("_test_mode"))
        self.assertIn(expected_host, cfg.get("hosts") or [])
        for h in cfg.get("hosts") or []:
            self.assertNotIn(
                h.strip().lower(),
                ("127.0.0.1", "localhost", "::1"),
                "produkcyjna sciezka nigdy nie ma prawa wstawic localhost jako hosta",
            )


if __name__ == "__main__":
    unittest.main()
