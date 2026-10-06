"""local_tree_stats / local_thumb_stats sa pamietane (TTL), bo GET /thumb-cache/sync/status
odpytywany co 8 s z kazdej strony robil pelny skan cache (py-spy 06.10.2026: 86 % CPU mostu)."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import dam_thumb_cache as tc  # noqa: E402


class ThumbStatsMemoTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        root = Path(self.tmp.name)
        (root / "thumbs").mkdir()
        (root / "thumbs" / "a.jpg").write_bytes(b"x")
        self.root_patch = mock.patch.object(tc, "cache_root", lambda: root)
        self.root_patch.start()
        tc.invalidate_local_stats()

    def tearDown(self):
        self.root_patch.stop()
        tc.invalidate_local_stats()
        self.tmp.cleanup()

    def test_second_call_within_ttl_does_not_walk_disk(self):
        with mock.patch.object(tc.os, "walk", wraps=os.walk) as walk:
            first = tc.local_tree_stats()
            second = tc.local_tree_stats()
        self.assertEqual(first["file_count"], 1)
        self.assertEqual(first["file_count"], second["file_count"])
        self.assertEqual(walk.call_count, 1)

    def test_fresh_and_set_sync_invalidate(self):
        self.assertEqual(tc.local_thumb_stats()["files"], 1)
        (Path(self.tmp.name) / "thumbs" / "b.jpg").write_bytes(b"y")
        self.assertEqual(tc.local_thumb_stats()["files"], 1, "w TTL stara liczba")
        self.assertEqual(tc.local_thumb_stats(fresh=True)["files"], 2)
        (Path(self.tmp.name) / "thumbs" / "c.jpg").write_bytes(b"z")
        with mock.patch.object(tc, "_persist_sync_state"):
            tc._set_sync(phase="idle")
        self.assertEqual(tc.local_thumb_stats()["files"], 3, "_set_sync czysci pamiec")

    def test_returned_dict_is_a_copy(self):
        tc.local_tree_stats()["file_count"] = 999
        self.assertEqual(tc.local_tree_stats()["file_count"], 1)


if __name__ == "__main__":
    unittest.main()
