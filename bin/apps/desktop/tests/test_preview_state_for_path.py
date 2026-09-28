# -*- coding: utf-8 -*-
"""dam_thumb_cache.preview_state_for_path - stan karty bez podgladu (etap 4)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import dam_thumb_cache as tc  # noqa: E402


class PreviewStateForPath(unittest.TestCase):
    def _run(self, path, *, index=None, failures=None, mtime_s=0.0):
        rel = tc._rel_from_logical(path)
        with mock.patch.object(tc, "_load_rel_index", return_value=index or {}), \
                mock.patch.object(tc, "load_preview_failures", return_value=failures or {}), \
                mock.patch.object(tc, "_asset_mtime_for", return_value=mtime_s):
            return tc.preview_state_for_path(path, "grid"), rel

    def test_unsupported_format(self):
        st, _ = self._run("- POLSKA/Produkt/logo.ai")
        self.assertEqual(st["state"], "unsupported")

    def test_pending_without_index(self):
        st, _ = self._run("- POLSKA/Produkt/wizka.png", mtime_s=100.0)
        self.assertEqual(st["state"], "pending")

    def test_ready_with_current_index(self):
        path = "- POLSKA/Produkt/wizka.png"
        rel = tc._rel_from_logical(path)
        idx = {tc._rel_index_key(rel, "grid"): {"digest": "abc", "mtime": 200.0}}
        st, _ = self._run(path, index=idx, mtime_s=150.0)
        self.assertEqual((st["state"], st["digest"]), ("ready", "abc"))

    def test_stale_index_is_pending(self):
        path = "- POLSKA/Produkt/wizka.png"
        rel = tc._rel_from_logical(path)
        idx = {tc._rel_index_key(rel, "grid"): {"digest": "abc", "mtime": 100.0}}
        st, _ = self._run(path, index=idx, mtime_s=300.0)
        self.assertEqual(st["state"], "pending")

    def test_failed_for_this_version(self):
        path = "- POLSKA/Produkt/wizka.png"
        rel = tc._rel_from_logical(path)
        key = f"{tc._asset_key(rel)}|grid"
        fails = {key: {"mtime_ms": 300000, "reason": "encode_failed", "at": "x"}}
        st, _ = self._run(path, failures=fails, mtime_s=300.0)
        self.assertEqual((st["state"], st["reason"]), ("failed", "encode_failed"))


if __name__ == "__main__":
    unittest.main()
