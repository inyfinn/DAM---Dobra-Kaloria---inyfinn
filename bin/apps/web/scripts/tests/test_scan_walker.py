# -*- coding: utf-8 -*-
"""Testy scan_walker.walk_files: pliki jak rglob, ale z rozroznieniem
scanned_dirs (wylistowane bez bledu) vs failed_dirs (blad IO / wykluczone)."""
from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parents[1]
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from asset_ids import asset_key  # noqa: E402
from scan_walker import walk_files  # noqa: E402


def _load_build_branding_index():
    """build-branding-index.py ma myslnik w nazwie - import przez importlib."""
    path = SCRIPTS / "build-branding-index.py"
    spec = importlib.util.spec_from_file_location("build_branding_index_mod_test_walker", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _make_tree(base: Path) -> dict[str, Path]:
    """Drzewo testowe pod '- POLSKA/...' (wymagane przez asset_key, zeby klucze
    byly deterministyczne niezaleznie od tego, gdzie system polozyl tempdir)."""
    polska = base / "- POLSKA"
    branding = polska / "- BRANDING i MARKA -"
    sub_a = branding / "Logo"
    sub_b = branding / "Kolory"
    locked = branding / "Zablokowany"
    archive = polska / "-- ARCHIWUM --"
    for d in (sub_a, sub_b, locked, archive):
        d.mkdir(parents=True, exist_ok=True)
    (sub_a / "logo.png").write_bytes(b"a")
    (sub_a / "logo.ai").write_bytes(b"a")
    (sub_b / "paleta.pdf").write_bytes(b"b")
    (locked / "sekret.psd").write_bytes(b"c")
    (archive / "stary.png").write_bytes(b"d")
    return {
        "polska": polska,
        "branding": branding,
        "sub_a": sub_a,
        "sub_b": sub_b,
        "locked": locked,
        "archive": archive,
    }


class WalkFilesMatchesRglobTest(unittest.TestCase):
    def test_same_files_as_rglob_on_readable_tree(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = _make_tree(Path(tmp))
            root = paths["branding"]

            old_way = sorted(str(p) for p in root.rglob("*") if p.is_file())
            files, scanned, failed = walk_files(root)
            new_way = sorted(str(p) for p in files)

            self.assertEqual(old_way, new_way)
            self.assertEqual(failed, set())

    def test_scanned_dirs_contains_all_readable_folders(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = _make_tree(Path(tmp))
            root = paths["branding"]
            _files, scanned, _failed = walk_files(root)

            expected_keys = {
                asset_key(str(paths["branding"])),
                asset_key(str(paths["sub_a"])),
                asset_key(str(paths["sub_b"])),
                asset_key(str(paths["locked"])),
            }
            self.assertEqual(expected_keys, scanned)


class WalkFilesPermissionErrorTest(unittest.TestCase):
    def test_unreadable_dir_goes_to_failed_and_its_children_are_skipped(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = _make_tree(Path(tmp))
            root = paths["branding"]
            locked = paths["locked"]
            # Podfolder pod "locked", zeby udowodnic, ze po bledzie NIC pod
            # nim nie trafia do scanned_dirs (nie mozna poznac jego dzieci).
            hidden_child = locked / "nie_zobaczymy_tego"
            hidden_child.mkdir()
            (hidden_child / "plik.png").write_bytes(b"x")

            real_scandir = __import__("os").scandir

            def fake_scandir(path="."):
                if str(path) == str(locked):
                    raise PermissionError(13, "Access is denied", str(locked))
                return real_scandir(path)

            with mock.patch("scan_walker.os.scandir", side_effect=fake_scandir):
                files, scanned, failed = walk_files(root)

            locked_key = asset_key(str(locked))
            hidden_key = asset_key(str(hidden_child))
            self.assertIn(locked_key, failed)
            self.assertNotIn(locked_key, scanned)
            self.assertNotIn(hidden_key, scanned)
            self.assertNotIn(hidden_key, failed)
            file_names = {p.name for p in files}
            self.assertNotIn("sekret.psd", file_names)
            self.assertNotIn("plik.png", file_names)
            # Reszta drzewa (poza locked) nadal wylistowana normalnie.
            self.assertIn("logo.png", file_names)
            self.assertIn("paleta.pdf", file_names)


class WalkFilesExcludeDirTest(unittest.TestCase):
    def test_exclude_dir_goes_to_failed_dirs_not_scanned(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = _make_tree(Path(tmp))
            root = paths["polska"]
            archive = paths["archive"]

            def exclude_archive(p: Path) -> bool:
                return p == archive

            files, scanned, failed = walk_files(root, exclude_dir=exclude_archive)

            archive_key = asset_key(str(archive))
            self.assertIn(archive_key, failed)
            self.assertNotIn(archive_key, scanned)
            file_names = {p.name for p in files}
            self.assertNotIn("stary.png", file_names)
            self.assertIn("logo.png", file_names)

    def test_root_itself_is_never_passed_to_exclude_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = _make_tree(Path(tmp))
            root = paths["branding"]
            seen: list[Path] = []

            def recording_exclude(p: Path) -> bool:
                seen.append(p)
                return False

            walk_files(root, exclude_dir=recording_exclude)
            self.assertNotIn(root, seen)


class WalkFilesSymlinkTest(unittest.TestCase):
    def test_does_not_follow_symlinked_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = _make_tree(Path(tmp))
            root = paths["branding"]
            link = root / "link_to_sub_b"
            try:
                link.symlink_to(paths["sub_b"], target_is_directory=True)
            except (OSError, NotImplementedError):
                self.skipTest("brak uprawnien do tworzenia symlinkow na tym systemie")

            files, scanned, _failed = walk_files(root)
            link_key = asset_key(str(link))
            self.assertNotIn(link_key, scanned)
            # Plik spod symlinku nie powinien pojawic sie dwa razy (raz z
            # sub_b, raz przez link) - i sam link (jako "plik" typu symlink)
            # tez nie powinien wejsc do listy plikow.
            names_from_link = [p for p in files if str(p).startswith(str(link))]
            self.assertEqual(names_from_link, [])


class BuildBrandingIndexManifestTest(unittest.TestCase):
    def test_scan_marketing_roots_accumulates_scan_dirs_and_manifest_shape(self):
        bbi = _load_build_branding_index()
        with tempfile.TemporaryDirectory() as tmp:
            marketing = Path(tmp)
            paths = _make_tree(marketing)
            # scan_marketing_roots oczekuje konkretnych podfolderow w - POLSKA;
            # "- BRANDING i MARKA -" jest jednym z primary_roots.
            bbi._SCANNED_DIRS.clear()
            bbi._FAILED_DIRS.clear()
            assets, stats = bbi.scan_marketing_roots(marketing)

            self.assertGreater(stats["primary_scanned"], 0)
            self.assertGreater(len(bbi._SCANNED_DIRS), 0)
            branding_key = asset_key(str(paths["branding"]))
            self.assertIn(branding_key, bbi._SCANNED_DIRS)
            # Zawartosc indeksu (nie tylko dirs) dziala tak samo jak wczesniej:
            names = {a["name"] for a in assets}
            self.assertIn("logo.ai", names)
            self.assertIn("paleta.pdf", names)


if __name__ == "__main__":
    unittest.main()
