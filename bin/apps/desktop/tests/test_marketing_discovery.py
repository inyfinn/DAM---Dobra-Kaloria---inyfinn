# -*- coding: utf-8 -*-
"""WP2: Marketing root under any drive letter, never blocking on a dead drive."""
from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
SCRIPTS = DESKTOP.parent / "web" / "scripts"
for _p in (DESKTOP, SCRIPTS):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import dam_path_resolve  # noqa: E402
import marketing_discovery as md  # noqa: E402
import marketing_roots  # noqa: E402

TRIO = ("-- ARCHIWUM --", "- EKSPORT", "- POLSKA")
TYPES = {"C": md.DRIVE_FIXED, "D": md.DRIVE_FIXED, "E": 5, "G": md.DRIVE_REMOVABLE,
         "M": md.DRIVE_REMOTE, "X": md.DRIVE_REMOTE, "Z": md.DRIVE_REMOTE}


def _norm(p: str) -> str:
    return str(p).replace("\\", "/").rstrip("/").lower()


def _tree(*roots: str, folders=TRIO) -> set[str]:
    out = set()
    for r in roots:
        out.add(_norm(r))
        for f in folders:
            out.add(_norm(r.rstrip("/") + "/" + f))
    return out


class FakeDrives:
    """Replaces GetLogicalDrives / GetDriveTypeW / isdir. Letter Z hangs."""

    def __init__(self, letters: str, dirs: set[str], hang_letter: str = "Z", hang_sec: float = 30.0):
        self.letters = letters
        self.dirs = dirs
        self.hang_letter = hang_letter
        self.hang_sec = hang_sec
        self.isdir_calls: list[str] = []
        self._release = threading.Event()

    def mask(self) -> int:
        return sum(1 << (ord(L) - ord("A")) for L in self.letters)

    def drive_type(self, root: str) -> int:
        return TYPES.get(root[0].upper(), 0)

    def isdir(self, path: str) -> bool:
        key = _norm(path)
        self.isdir_calls.append(key)
        if key.startswith(self.hang_letter.lower() + ":"):
            # Simulated dead SMB share: blocks like a real isdir would.
            self._release.wait(self.hang_sec)
            return False
        return key in self.dirs

    def patches(self):
        return [
            mock.patch.object(md, "_get_logical_drives", self.mask),
            mock.patch.object(md, "_get_drive_type", self.drive_type),
            mock.patch.object(md, "_isdir", self.isdir),
        ]

    def release(self):
        self._release.set()


class DiscoveryTestBase(unittest.TestCase):
    letters = "CDEMXZ"
    dirs: set[str] = set()

    def setUp(self):
        md.clear_cache()
        marketing_roots.clear_cache()
        self.fake = FakeDrives(self.letters, self.dirs)
        self._patches = self.fake.patches()
        for p in self._patches:
            p.start()

    def tearDown(self):
        for p in reversed(self._patches):
            p.stop()
        self.fake.release()
        md.clear_cache()
        marketing_roots.clear_cache()
        # let released probe threads leave the in-flight set
        deadline = time.monotonic() + 2
        while md._inflight and time.monotonic() < deadline:
            time.sleep(0.01)


class DiscoverRootsTests(DiscoveryTestBase):
    dirs = (
        _tree("C:/Marketing")             # home copy on C:
        | _tree("D:/Marketing")           # mirror on D:
        | _tree("M:/")                    # share root
        | _tree("X:/Marketing")
        | _tree("E:/Marketing")           # CD-ROM: must be skipped
        | _tree("C:/", folders=("- POLSKA",))  # partial tree: not a root
    )

    def test_hung_letter_does_not_block_and_is_left_out(self):
        t0 = time.monotonic()
        roots = md.discover_roots()
        elapsed = time.monotonic() - t0
        self.assertLess(elapsed, 4.0)
        keys = [_norm(r) for r in roots]
        self.assertFalse(any(k.startswith("z:") for k in keys))
        # Order: M:\ -> X:\Marketing -> D:\Marketing -> other detected
        self.assertEqual(keys, ["m:", "x:/marketing", "d:/marketing", "c:/marketing"])

    def test_cdrom_is_never_touched(self):
        md.discover_roots()
        self.assertFalse(any(c.startswith("e:") for c in self.fake.isdir_calls))

    def test_hung_letter_reported_as_timeout(self):
        entries = md.probe_drives()
        z = [e for e in entries if e["letter"] == "Z"]
        self.assertEqual(len(z), 2)
        self.assertTrue(all(e["timeout"] and not e["ok"] for e in z))
        c_root = next(e for e in entries if _norm(e["path"]) == "c:")
        self.assertTrue(c_root["exists"])
        self.assertFalse(c_root["ok"])
        self.assertEqual(c_root["missing"], ["-- ARCHIWUM --", "- EKSPORT"])

    def test_result_is_cached(self):
        md.discover_roots()
        # wait for Z to finish being in flight is not needed: cache must answer anyway
        calls = len(self.fake.isdir_calls)
        with mock.patch.object(md, "CACHE_TTL_SEC", 60.0):
            md.discover_roots()
        self.assertEqual(len(self.fake.isdir_calls), calls)

    def test_second_call_does_not_stack_threads_on_hung_letter(self):
        md.discover_roots(use_cache=False)
        before = sum(1 for c in self.fake.isdir_calls if c.startswith("z:"))
        t0 = time.monotonic()
        md.discover_roots(use_cache=False)
        self.assertLess(time.monotonic() - t0, 4.0)
        after = sum(1 for c in self.fake.isdir_calls if c.startswith("z:"))
        self.assertEqual(before, after)

    def test_lenient_marker_accepts_polska_only(self):
        roots = md.discover_roots(required=("- POLSKA",))
        self.assertIn("c:", [_norm(r) for r in roots])


class NonWindowsTests(unittest.TestCase):
    def test_no_drives_outside_windows(self):
        with mock.patch.object(md.sys, "platform", "linux"):
            self.assertEqual(md.logical_drive_letters(), [])


class CandidateOrderTests(unittest.TestCase):
    def test_user_config_first_then_preferred_then_detected(self):
        got = md.ordered_candidates(
            [Path("E:/Moje/Marketing")],
            [Path("G:/Marketing"), Path("D:/Marketing"), Path("C:/Marketing")],
        )
        self.assertEqual(
            [_norm(p) for p in got],
            ["e:/moje/marketing", "m:", "x:/marketing", "d:/marketing", "c:/marketing", "g:/marketing"],
        )

    def test_dam_path_resolve_reads_live_candidates(self):
        # temp dirs: resolve() would turn a real mapped letter into its UNC path
        old = dam_path_resolve.current_marketing_candidates()
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            live, explicit = Path(a).resolve(), Path(b).resolve()
            try:
                dam_path_resolve.set_marketing_candidates([live])
                roots = dam_path_resolve.marketing_roots()
                self.assertIn(_norm(live), [_norm(r) for r in roots])
                # explicit argument still wins
                roots = dam_path_resolve.marketing_roots(marketing_candidates=[explicit])
                self.assertEqual([_norm(r) for r in roots], [_norm(explicit)])
            finally:
                dam_path_resolve.set_marketing_candidates(old)


class MarketingRootsScriptTests(DiscoveryTestBase):
    letters = "CGMZ"
    dirs = _tree("G:/Marketing", folders=("- POLSKA",))

    def setUp(self):
        super().setUp()
        self._env = mock.patch.dict(os.environ, {"DAM_MARKETING_FALLBACKS": ""})
        self._env.start()
        self._cfg = mock.patch.object(marketing_roots, "_machine_config_bases", return_value=[])
        self._cfg.start()

    def tearDown(self):
        self._cfg.stop()
        self._env.stop()
        super().tearDown()

    def test_finds_root_under_unusual_letter_without_hanging(self):
        t0 = time.monotonic()
        base = marketing_roots.resolve_marketing_base()
        self.assertLess(time.monotonic() - t0, 4.0)
        self.assertEqual(_norm(base), "g:/marketing")
        self.assertFalse(marketing_roots.is_cache_only())
        self.assertIn("g:/marketing", [_norm(p) for p in marketing_roots.marketing_candidates()])

    def test_explicit_fallbacks_disable_discovery(self):
        with mock.patch.dict(os.environ, {"DAM_MARKETING_FALLBACKS": "Q:/Nope"}):
            marketing_roots.clear_cache()
            self.assertIsNone(marketing_roots.resolve_marketing_base())


class NoForeignUserInheritanceTests(unittest.TestCase):
    def _cfg(self, payload: dict) -> list[Path]:
        with tempfile.TemporaryDirectory() as td:
            cfg = Path(td) / "machine-config.json"
            cfg.write_text(json.dumps(payload), encoding="utf-8")
            with mock.patch.dict(os.environ, {"DAM_MACHINE_CONFIG": str(cfg), "USERNAME": "anna"}):
                return marketing_roots._machine_config_bases()

    def test_other_windows_user_path_is_not_inherited(self):
        self.assertEqual(self._cfg({"users": {"krzysztof": {"base_path": "X:/Marketing"}}}), [])

    def test_own_user_path_is_used(self):
        got = self._cfg({"users": {"anna": {"base_path": "E:/Marketing"}}})
        self.assertEqual([_norm(p) for p in got], ["e:/marketing"])

    def test_invalid_config_is_ignored(self):
        with tempfile.TemporaryDirectory() as td:
            cfg = Path(td) / "machine-config.json"
            cfg.write_bytes(b"\x81\x81")
            with mock.patch.dict(os.environ, {"DAM_MACHINE_CONFIG": str(cfg), "USERNAME": "anna"}):
                self.assertEqual(marketing_roots._machine_config_bases(), [])


class BridgeDetectTests(DiscoveryTestBase):
    letters = "CDMXZ"
    dirs = _tree("C:/Marketing") | _tree("X:/Marketing")

    @classmethod
    def setUpClass(cls):
        import local_bridge

        cls.lb = local_bridge

    def setUp(self):
        super().setUp()
        self._old = self.lb.MARKETING_CANDIDATES
        self._old_dpr = dam_path_resolve.current_marketing_candidates()

    def tearDown(self):
        self.lb.MARKETING_CANDIDATES = self._old
        dam_path_resolve.set_marketing_candidates(self._old_dpr)
        super().tearDown()

    def test_detect_lists_preferred_and_detected_within_budget(self):
        t0 = time.monotonic()
        res = self.lb.detect_marketing_bases()
        self.assertLess(time.monotonic() - t0, 4.0)
        paths = [_norm(c["path"]) for c in res["candidates"]]
        self.assertEqual(paths, ["m:", "x:/marketing", "d:/marketing", "c:/marketing"])
        self.assertEqual([_norm(p) for p in res["valid"]], ["x:/marketing", "c:/marketing"])
        self.assertEqual(_norm(res["recommended"]), "x:/marketing")
        # detected root joins the live candidate list used for path rebasing
        self.assertIn("c:/marketing", [_norm(p) for p in self.lb.MARKETING_CANDIDATES])
        self.assertIn(
            "c:/marketing",
            [_norm(p) for p in dam_path_resolve.current_marketing_candidates()],
        )
        self.assertIn("C:/Marketing/", self.lb.marketing_root_prefixes())

    def test_logo_variants_cover_detected_root(self):
        self.lb.detect_marketing_bases()
        got = self.lb._logo_drive_variants("X:/Marketing/- POLSKA/a.png")
        self.assertIn("C:/Marketing/- POLSKA/a.png", got)
        self.assertIn("M:/- POLSKA/a.png", got)


if __name__ == "__main__":
    unittest.main()
