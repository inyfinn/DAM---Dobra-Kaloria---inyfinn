# -*- coding: utf-8 -*-
"""Etap 3 - czysta instalacja: pg_db nie ma prawa skopiowac jawnego pg-config.json
z INNEJ instalacji (%LOCALAPPDATA%\\Programs\\DAM) w drzewie bez .git.

Nigdy nie startuje prawdziwego mostu, nie dotyka produkcyjnej bazy/sieci -
wylacznie tymczasowe katalogi + monkeypatch modulu pg_db.
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


def _write_ready_config(path: Path, password: str = "secret-from-other-install") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"host": "inyfinn.synology.me", "password": password}),
        encoding="utf-8",
    )


class PgConfigCandidatesTests(unittest.TestCase):
    """_pg_config_candidates() musi zmieniac zbior sciezek wedlug _is_dev_tree()."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.own_desktop_dir = Path(self._tmp.name) / "own-install" / "bin" / "apps" / "desktop"
        self.own_desktop_dir.mkdir(parents=True, exist_ok=True)
        self.foreign_localappdata = Path(self._tmp.name) / "foreign-localappdata"
        self.foreign_localappdata.mkdir(parents=True, exist_ok=True)

        self._patches = [
            mock.patch.object(pg_db, "DESKTOP_DIR", self.own_desktop_dir),
            mock.patch.object(pg_db, "CONFIG_PATH", self.own_desktop_dir / "data" / "pg-config.json"),
            mock.patch.dict(
                "os.environ",
                {"LOCALAPPDATA": str(self.foreign_localappdata)},
                clear=False,
            ),
        ]
        for p in self._patches:
            p.start()
            self.addCleanup(p.stop)
        # DAM_PG_CONFIG must not leak between tests / from the real environment.
        import os

        os.environ.pop("DAM_PG_CONFIG", None)

    def _foreign_install_desktop_dir(self) -> Path:
        return self.foreign_localappdata / "Programs" / "DAM" / "bin" / "apps" / "desktop"

    def test_installed_copy_excludes_foreign_localappdata_paths(self):
        """_is_dev_tree()==False -> zero sciezek pod %LOCALAPPDATA%\\Programs\\DAM."""
        with mock.patch.object(pg_db, "_is_dev_tree", return_value=False):
            candidates = pg_db._pg_config_candidates()
        foreign_root = self._foreign_install_desktop_dir()
        for c in candidates:
            self.assertFalse(
                str(c).startswith(str(foreign_root)),
                f"installed copy must not consider foreign install path: {c}",
            )

    def test_dev_tree_includes_foreign_localappdata_paths(self):
        """_is_dev_tree()==True (maszyna budujaca) -> foreign install paths WOLNO rozwazac."""
        with mock.patch.object(pg_db, "_is_dev_tree", return_value=True):
            candidates = pg_db._pg_config_candidates()
        foreign_root = self._foreign_install_desktop_dir()
        self.assertTrue(
            any(str(c).startswith(str(foreign_root)) for c in candidates),
            "dev tree should still be able to bootstrap from an already-installed copy",
        )

    def test_own_dir_sources_present_regardless_of_dev_tree(self):
        for dev_tree in (True, False):
            with mock.patch.object(pg_db, "_is_dev_tree", return_value=dev_tree):
                candidates = pg_db._pg_config_candidates()
            self.assertIn(self.own_desktop_dir / "pg-config.json", candidates)
            self.assertIn(self.own_desktop_dir / "data" / "pg-config.json", candidates)
            self.assertIn(self.own_desktop_dir / "data" / "pg-config.json.off", candidates)
            self.assertIn(self.own_desktop_dir / "data" / "pg-config.bundled.json", candidates)

    def test_env_dam_pg_config_always_first_regardless_of_dev_tree(self):
        import os

        env_path = Path(self._tmp.name) / "explicit-env-config.json"
        os.environ["DAM_PG_CONFIG"] = str(env_path)
        self.addCleanup(lambda: os.environ.pop("DAM_PG_CONFIG", None))
        for dev_tree in (True, False):
            with mock.patch.object(pg_db, "_is_dev_tree", return_value=dev_tree):
                candidates = pg_db._pg_config_candidates()
            self.assertEqual(candidates[0], env_path)


class EnsurePgConfigReadyTests(unittest.TestCase):
    """ensure_pg_config_ready() end-to-end: instalowana kopia nie kopiuje cudzego hasla."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.own_desktop_dir = Path(self._tmp.name) / "own-install" / "bin" / "apps" / "desktop"
        self.own_desktop_dir.mkdir(parents=True, exist_ok=True)
        self.foreign_localappdata = Path(self._tmp.name) / "foreign-localappdata"
        self.foreign_localappdata.mkdir(parents=True, exist_ok=True)

        own_config_path = self.own_desktop_dir / "data" / "pg-config.json"
        self._patches = [
            mock.patch.object(pg_db, "DESKTOP_DIR", self.own_desktop_dir),
            mock.patch.object(pg_db, "CONFIG_PATH", own_config_path),
            mock.patch.object(pg_db, "CONFIG_EXAMPLE_PATH", self.own_desktop_dir / "pg-config.example.json"),
            mock.patch.object(pg_db, "pg_seal", None),
            mock.patch.dict(
                "os.environ",
                {"LOCALAPPDATA": str(self.foreign_localappdata)},
                clear=False,
            ),
        ]
        for p in self._patches:
            p.start()
            self.addCleanup(p.stop)
        import os

        os.environ.pop("DAM_PG_CONFIG", None)
        self.own_config_path = own_config_path

    def _foreign_install_desktop_dir(self) -> Path:
        return self.foreign_localappdata / "Programs" / "DAM" / "bin" / "apps" / "desktop"

    def test_installed_copy_does_not_adopt_foreign_password(self):
        foreign_cfg = self._foreign_install_desktop_dir() / "data" / "pg-config.json"
        _write_ready_config(foreign_cfg, password="stranger-password")

        with mock.patch.object(pg_db, "_is_dev_tree", return_value=False):
            pg_db.ensure_pg_config_ready()

        self.assertFalse(
            self.own_config_path.is_file(),
            "installed copy must not have copied a foreign install's plaintext pg-config.json",
        )

    def test_dev_tree_may_bootstrap_from_foreign_install(self):
        foreign_cfg = self._foreign_install_desktop_dir() / "data" / "pg-config.json"
        _write_ready_config(foreign_cfg, password="dev-machine-bootstrap-password")

        with mock.patch.object(pg_db, "_is_dev_tree", return_value=True):
            pg_db.ensure_pg_config_ready()

        self.assertTrue(self.own_config_path.is_file())
        written = json.loads(self.own_config_path.read_text(encoding="utf-8"))
        self.assertEqual(written.get("password"), "dev-machine-bootstrap-password")

    def test_own_dir_off_file_still_used_when_installed(self):
        own_off = self.own_desktop_dir / "data" / "pg-config.json.off"
        _write_ready_config(own_off, password="own-install-off-password")

        with mock.patch.object(pg_db, "_is_dev_tree", return_value=False):
            pg_db.ensure_pg_config_ready()

        self.assertTrue(self.own_config_path.is_file())
        written = json.loads(self.own_config_path.read_text(encoding="utf-8"))
        self.assertEqual(written.get("password"), "own-install-off-password")

    def test_env_dam_pg_config_used_on_installed_copy(self):
        import os

        env_cfg = Path(self._tmp.name) / "explicit-env-config.json"
        _write_ready_config(env_cfg, password="env-explicit-password")
        os.environ["DAM_PG_CONFIG"] = str(env_cfg)
        self.addCleanup(lambda: os.environ.pop("DAM_PG_CONFIG", None))

        with mock.patch.object(pg_db, "_is_dev_tree", return_value=False):
            pg_db.ensure_pg_config_ready()

        self.assertTrue(self.own_config_path.is_file())
        written = json.loads(self.own_config_path.read_text(encoding="utf-8"))
        self.assertEqual(written.get("password"), "env-explicit-password")


if __name__ == "__main__":
    unittest.main()
