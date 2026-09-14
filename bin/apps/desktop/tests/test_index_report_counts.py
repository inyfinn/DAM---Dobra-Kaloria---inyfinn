# -*- coding: utf-8 -*-
"""Index report must keep counts even when rc != 0 (never blank 'Nic nowego')."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_supervisor as idx


class DiffMapsTests(unittest.TestCase):
    def test_diff_added_changed_unchanged(self):
        old = {
            "a": {"name": "A", "revision_count": 1, "indexes": ["1"], "files": 2, "path": "", "category": ""},
            "b": {"name": "B", "revision_count": 1, "indexes": ["2"], "files": 1, "path": "", "category": ""},
        }
        now = {
            "a": {"name": "A", "revision_count": 1, "indexes": ["1"], "files": 2, "path": "", "category": ""},
            "b": {"name": "B", "revision_count": 2, "indexes": ["2"], "files": 3, "path": "", "category": "BATONY"},
            "c": {"name": "Tuba", "revision_count": 1, "indexes": ["3"], "files": 4, "path": "", "category": "www"},
        }
        items, added, changed, unchanged = idx._diff_maps(old, now, source="product", cap=50)
        kinds = {it["id"]: it["kind"] for it in items}
        self.assertEqual(added, 1)
        self.assertEqual(changed, 1)
        self.assertEqual(unchanged, 1)
        self.assertEqual(kinds.get("c"), "added")
        self.assertEqual(kinds.get("b"), "changed")
        self.assertNotIn("a", kinds)

    def test_hydrate_uses_before_when_after_zero(self):
        data = idx._hydrate_report_counts(
            {
                "ok": False,
                "items": [],
                "added": 0,
                "changed": 0,
                "product_count_before": 193,
                "product_count_after": 0,
            }
        )
        self.assertEqual(data["scanned"], 193)
        self.assertEqual(data["unchanged"], 193)
        self.assertFalse(data["empty"])


if __name__ == "__main__":
    unittest.main()
