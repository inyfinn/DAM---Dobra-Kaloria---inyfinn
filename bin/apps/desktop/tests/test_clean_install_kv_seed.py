# -*- coding: utf-8 -*-
"""Etap 3 - startowe seedowanie KV/polityki programu do Postgresa musi zostac
wylacznie w drzewie deweloperskim (.git), z jednym wyjatkiem: swiezy wiersz
w dam_kv_store, ktory jeszcze nie istnieje (nic do nadpisania).

PUBLIC_MODE (most na NAS, moze serwowac przestarzala kopie Panel-DAM) i kazda
zainstalowana kopia (brak .git) licza sie tak samo - zero automatycznego
zapisu build-time snapshotu web/data do bazy przy starcie.

Zero prawdziwego mostu, zero prawdziwej bazy - wylacznie mock pg_db.kv_get_meta
i monkeypatch pg_db._is_dev_tree.
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import pg_db  # noqa: E402


class ShouldSeedKvFromLocalTests(unittest.TestCase):
    """pg_db.should_seed_kv_from_local - rdzen logiki, uzywany przez local_bridge
    (_seed_kv_push_allowed) i dam_thumb_cache (persist_cache_state)."""

    def test_public_mode_blocks_write_even_in_dev_tree(self):
        # (a) PUBLIC_MODE bez zapisu - nawet gdyby ktos odpalil most publiczny
        # z drzewa .git (np. na maszynie budujacej), NAS moze serwowac stara
        # kopie panelu, wiec public_mode zawsze wygrywa.
        with mock.patch.object(pg_db, "_is_dev_tree", return_value=True), mock.patch.object(
            pg_db, "kv_get_meta", return_value={"store_key": "app-settings", "payload": {}}
        ):
            self.assertFalse(
                pg_db.should_seed_kv_from_local("app-settings", public_mode=True)
            )

    def test_public_mode_still_allows_bootstrap_when_row_missing(self):
        with mock.patch.object(pg_db, "_is_dev_tree", return_value=False), mock.patch.object(
            pg_db, "kv_get_meta", return_value=None
        ):
            self.assertTrue(
                pg_db.should_seed_kv_from_local("app-settings", public_mode=True)
            )

    def test_installed_copy_blocks_write_when_row_exists(self):
        # (b) kopia zainstalowana (brak .git) bez zapisu, gdy wiersz juz istnieje.
        with mock.patch.object(pg_db, "_is_dev_tree", return_value=False), mock.patch.object(
            pg_db, "kv_get_meta", return_value={"store_key": "program-instructions", "payload": {}}
        ):
            self.assertFalse(
                pg_db.should_seed_kv_from_local("program-instructions", public_mode=False)
            )

    def test_installed_copy_allows_bootstrap_when_row_missing(self):
        with mock.patch.object(pg_db, "_is_dev_tree", return_value=False), mock.patch.object(
            pg_db, "kv_get_meta", return_value=None
        ):
            self.assertTrue(
                pg_db.should_seed_kv_from_local("program-instructions", public_mode=False)
            )

    def test_dev_tree_behaves_as_before_row_exists_or_not(self):
        # (c) drzewo dev - zachowanie jak dotad: zawsze wolno (row exists albo nie).
        with mock.patch.object(pg_db, "_is_dev_tree", return_value=True):
            with mock.patch.object(pg_db, "kv_get_meta", return_value={"store_key": "x", "payload": {}}):
                self.assertTrue(
                    pg_db.should_seed_kv_from_local("app-settings", public_mode=False)
                )
            with mock.patch.object(pg_db, "kv_get_meta", return_value=None):
                self.assertTrue(
                    pg_db.should_seed_kv_from_local("app-settings", public_mode=False)
                )

    def test_db_unreachable_never_guesses_a_write(self):
        """Baza niedostepna w trakcie sprawdzania -> bezpieczny domyslny brak zapisu."""
        with mock.patch.object(pg_db, "_is_dev_tree", return_value=False), mock.patch.object(
            pg_db, "kv_get_meta", side_effect=RuntimeError("db down")
        ):
            self.assertFalse(
                pg_db.should_seed_kv_from_local("app-settings", public_mode=False)
            )


class LocalBridgeSeedWiringTests(unittest.TestCase):
    """_seed_kv_push_allowed w local_bridge.py musi przekazac wlasny PUBLIC_MODE
    do pg_db.should_seed_kv_from_local (bez duplikowania logiki decyzyjnej)."""

    def setUp(self):
        sys.path.insert(0, str(DESKTOP))
        import local_bridge  # noqa: E402

        self.local_bridge = local_bridge

    def test_forwards_own_public_mode_flag(self):
        calls = []

        def fake_should_seed(store_key, *, public_mode=False):
            calls.append((store_key, public_mode))
            return False

        with mock.patch.object(self.local_bridge, "PUBLIC_MODE", True):
            with mock.patch.object(pg_db, "should_seed_kv_from_local", side_effect=fake_should_seed):
                with mock.patch.dict(sys.modules, {"pg_db": pg_db}):
                    allowed = self.local_bridge._seed_kv_push_allowed("app-settings")
        self.assertFalse(allowed)
        self.assertEqual(calls, [("app-settings", True)])

    def test_seed_function_skips_pg_push_when_not_allowed(self):
        """_seed_naming_policy_to_postgres() nie wola _save_json z push_to_pg=True
        gdy _seed_kv_push_allowed zwraca False dla kazdego klucza (np. instalacja).

        Wykonywany na plikach w tymczasowym katalogu (mock.patch.object na
        module-level Path stalych) - zero dotkniecia prawdziwych
        apps/web/data/*.json tego repo."""
        recorded_push_flags = []
        real_save_json = self.local_bridge._save_json

        def spy_save_json(path, data, *, expected_updated_at=None, updated_by="local_bridge", push_to_pg=True):
            recorded_push_flags.append((path.name, push_to_pg))
            return real_save_json(
                path,
                data,
                expected_updated_at=expected_updated_at,
                updated_by=updated_by,
                push_to_pg=False,  # never touch Postgres for real in this test
            )

        with tempfile.TemporaryDirectory() as td:
            tmp_web_root = Path(td) / "web"
            tmp_data = tmp_web_root / "data"
            tmp_data.mkdir(parents=True, exist_ok=True)
            naming_file = tmp_data / "naming-dictionary.json"
            instructions_file = tmp_data / "program-instructions.json"
            app_settings_file = tmp_data / "app-settings.json"
            naming_file.write_text(json.dumps({"policy": {}}), encoding="utf-8")
            instructions_file.write_text(json.dumps({"instructions": []}), encoding="utf-8")

            patches = [
                mock.patch.object(self.local_bridge, "WEB_ROOT", tmp_web_root),
                mock.patch.object(self.local_bridge, "APP_SETTINGS_FILE", app_settings_file),
                mock.patch.object(self.local_bridge, "NAMING_DICTIONARY_FILE", naming_file),
                mock.patch.object(self.local_bridge, "PROGRAM_INSTRUCTIONS_FILE", instructions_file),
                mock.patch.object(self.local_bridge, "CHANGE_LOG_FILE", tmp_data / "change-log.json"),
                mock.patch.object(self.local_bridge, "LIFECYCLE_STORE_FILE", tmp_data / "lifecycle-status.json"),
                mock.patch.object(self.local_bridge, "PRODUCT_STATUS_FILE", tmp_data / "product-status.json"),
                mock.patch.object(self.local_bridge, "_seed_kv_push_allowed", return_value=False),
                mock.patch.object(self.local_bridge, "_save_json", side_effect=spy_save_json),
            ]
            for p in patches:
                p.start()
            try:
                try:
                    self.local_bridge._seed_naming_policy_to_postgres()
                except Exception as exc:  # noqa: BLE001
                    self.fail(f"_seed_naming_policy_to_postgres raised: {exc}")
            finally:
                for p in reversed(patches):
                    p.stop()

        self.assertTrue(recorded_push_flags, "expected at least one _save_json call")
        for name, push_to_pg in recorded_push_flags:
            self.assertFalse(push_to_pg, f"{name} must not push to pg when seeding is disallowed")


if __name__ == "__main__":
    unittest.main()
