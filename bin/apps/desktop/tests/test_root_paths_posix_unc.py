# -*- coding: utf-8 -*-
r"""Usterka 5 (28.09.2026), plan etap 2 / 4.3 - ROOT nie moze zmienic rodziny
separatorow sciezki.

`_normalize_base_path()` (local_bridge.py) kiedys robilo bezwarunkowo
`str(Path(p)).replace("/", "\\")` (przez `normalize_path`): dla POSIX
(`/Volumes/Marketing` - macOS, `/mnt/x`, `/media/x` - Linux) dawalo to
`\Volumes\Marketing`, ktore juz nie jest prawidlowa sciezka na zadnym systemie.
UNC (`\\serwer\udzial`, `//serwer/udzial`) musi zachowac podwojny prefiks.

Run: python -m unittest tests.test_root_paths_posix_unc  (z bin/apps/desktop)
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parent.parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import dam_path_resolve  # noqa: E402
import local_bridge as lb  # noqa: E402


class NormalizeBasePathPosixTests(unittest.TestCase):
    """POSIX (macOS/Linux mount) zostaje POSIX - nigdy \\Volumes\\..."""

    def test_macos_volumes_untouched(self):
        self.assertEqual(lb._normalize_base_path("/Volumes/Marketing"), "/Volumes/Marketing")

    def test_macos_volumes_trailing_slash_stripped(self):
        self.assertEqual(lb._normalize_base_path("/Volumes/Marketing/"), "/Volumes/Marketing")

    def test_linux_mnt_untouched(self):
        self.assertEqual(lb._normalize_base_path("/mnt/x/Marketing"), "/mnt/x/Marketing")

    def test_linux_media_untouched(self):
        self.assertEqual(lb._normalize_base_path("/media/x/Marketing"), "/media/x/Marketing")

    def test_posix_duplicate_slashes_collapsed(self):
        self.assertEqual(lb._normalize_base_path("/Volumes//Marketing///"), "/Volumes/Marketing")

    def test_posix_never_gains_backslash(self):
        for raw in ("/Volumes/Marketing", "/mnt/x", "/media/x/Marketing"):
            out = lb._normalize_base_path(raw)
            self.assertNotIn("\\", out, f"{raw!r} -> {out!r} nie moze miec backslasha")
            self.assertTrue(out.startswith("/"), f"{raw!r} -> {out!r} musi zostac POSIX")


class NormalizeBasePathUncTests(unittest.TestCase):
    """UNC zachowuje podwojny prefiks, niezaleznie od separatora wejsciowego."""

    def test_backslash_unc_untouched(self):
        self.assertEqual(lb._normalize_base_path(r"\\serwer\udzial\Marketing"), r"\\serwer\udzial\Marketing")

    def test_forward_slash_unc_becomes_canonical_backslash_unc(self):
        self.assertEqual(lb._normalize_base_path("//serwer/udzial/Marketing"), r"\\serwer\udzial\Marketing")

    def test_unc_trailing_separator_stripped(self):
        self.assertEqual(lb._normalize_base_path(r"\\serwer\udzial\Marketing\\"), r"\\serwer\udzial\Marketing")

    def test_unc_keeps_double_prefix_not_single(self):
        out = lb._normalize_base_path(r"\\serwer\udzial")
        self.assertTrue(out.startswith("\\\\"), f"UNC musi zaczynac sie od dwoch backslashy, jest {out!r}")
        self.assertFalse(out.startswith("\\\\\\"), f"UNC nie moze miec trzech+ backslashy, jest {out!r}")


class NormalizeBasePathWindowsUnchangedTests(unittest.TestCase):
    """Zwykle dyski Windows - zachowanie identyczne jak przed naprawa."""

    def test_drive_letter_only(self):
        self.assertEqual(lb._normalize_base_path("M:"), "M:\\")
        self.assertEqual(lb._normalize_base_path("m:\\"), "M:\\")

    def test_drive_path_forward_slashes(self):
        self.assertEqual(lb._normalize_base_path("D:/Marketing"), "D:\\Marketing")

    def test_drive_path_trailing_backslash_stripped(self):
        self.assertEqual(lb._normalize_base_path("X:\\Marketing\\"), "X:\\Marketing")

    def test_empty_and_blank(self):
        self.assertEqual(lb._normalize_base_path(""), "")
        self.assertEqual(lb._normalize_base_path("   "), "")


class SwitchRootPreservesPosixAndUncTests(unittest.TestCase):
    """Cala operacja switch_root() (nie tylko _normalize_base_path w izolacji)
    zapisuje POSIX/UNC bez zmiany rodziny separatorow - 'sprawdz frontend,
    backend i otwieranie plikow, nie tylko walidator' (plan, etap 2)."""

    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.tmp = Path(self.td.name)
        self.state_cfg = self.tmp / "state" / "machine-config.json"
        import os
        from unittest import mock

        self.patches = [
            mock.patch.object(lb, "MACHINE_CONFIG", self.tmp / "machine-config.json"),
            mock.patch.object(lb, "MACHINE_CONFIG_STATE", self.state_cfg),
            mock.patch.object(lb, "_root_state", side_effect=self._fake_root_state),
            mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting"),
            mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}),
            mock.patch.object(lb, "_udp_current_identity", return_value={"device_id": "", "hostname": ""}),
            mock.patch.dict(os.environ, {"USERNAME": "posixunctester"}),
            # Wlasny, izolowany wpis w pamieci procesu - inne pliki testowe
            # (test_root_switch.py) uzywaja USERNAME="tester" i moglyby
            # zanieczyscic _ROOT_GENERATION_MEMORY, gdyby ten sam klucz.
            mock.patch.dict(lb._ROOT_GENERATION_MEMORY, {}, clear=True),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        from unittest import mock  # noqa: F401

        for p in reversed(self.patches):
            p.stop()
        self.td.cleanup()

    @staticmethod
    def _fake_root_state(base_path, timeout=None):
        # Sonda prawdziwego folderu nie ma tu sensu (POSIX/UNC nie istnieje na
        # tej maszynie testowej) - udajemy "full", zeby przetestowac WYLACZNIE
        # normalizacje i zapis.
        return {"state": "full", "missing": [], "exists": True, "timeout": False,
                "root": lb._normalize_base_path(base_path), "listable": True}

    def test_switch_root_posix_stays_posix_in_config(self):
        res = lb.switch_root("/Volumes/Marketing")
        self.assertTrue(res["ok"], res)
        self.assertEqual(res["base_path"], "/Volumes/Marketing")
        saved = json.loads(self.state_cfg.read_text(encoding="utf-8"))
        entry = next(iter(saved["users"].values()))
        self.assertEqual(entry["base_path"], "/Volumes/Marketing")
        self.assertNotIn("\\", entry["base_path"])

    def test_switch_root_unc_stays_unc_in_config(self):
        res = lb.switch_root("//serwer/udzial/Marketing")
        self.assertTrue(res["ok"], res)
        self.assertEqual(res["base_path"], r"\\serwer\udzial\Marketing")
        saved = json.loads(self.state_cfg.read_text(encoding="utf-8"))
        entry = next(iter(saved["users"].values()))
        self.assertEqual(entry["base_path"], r"\\serwer\udzial\Marketing")


class CurrentRootGenerationGetterTests(unittest.TestCase):
    """dam_path_resolve.current_root_generation() - getter dla W2 (asset_sync_runner)."""

    def setUp(self):
        import os
        from unittest import mock

        self.td = tempfile.TemporaryDirectory()
        self.tmp = Path(self.td.name)
        self.cfg = self.tmp / "machine-config.json"
        self._env_patch = mock.patch.dict(os.environ, {"USERNAME": "gentester"})
        self._env_patch.start()

    def tearDown(self):
        self._env_patch.stop()
        self.td.cleanup()

    def test_missing_file_is_generation_zero(self):
        self.assertEqual(dam_path_resolve.current_root_generation(self.cfg), 0)

    def test_missing_field_is_generation_zero(self):
        self.cfg.write_text(json.dumps({"users": {"gentester": {"base_path": "X:\\Marketing"}}}), encoding="utf-8")
        self.assertEqual(dam_path_resolve.current_root_generation(self.cfg), 0)

    def test_reads_generation_field(self):
        self.cfg.write_text(
            json.dumps({"users": {"gentester": {"base_path": "X:\\Marketing", "root_generation": 7}}}),
            encoding="utf-8",
        )
        self.assertEqual(dam_path_resolve.current_root_generation(self.cfg), 7)

    def test_empty_base_path_entry_ignored_like_no_entry(self):
        # Wpis bez base_path (np. usera wyczyszczono) = jakby go nie bylo -
        # spojnie z read_machine_config()/machine_config_base().
        self.cfg.write_text(
            json.dumps({"users": {"gentester": {"base_path": "", "root_generation": 5}}}),
            encoding="utf-8",
        )
        self.assertEqual(dam_path_resolve.current_root_generation(self.cfg), 0)


if __name__ == "__main__":
    unittest.main()
