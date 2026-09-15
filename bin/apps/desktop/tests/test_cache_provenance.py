# -*- coding: utf-8 -*-
"""Cache provenance compare: empty/download, remote newer/delta, match/noop."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DESKTOP))

import dam_db  # noqa: E402
import dam_thumb_cache as cache  # noqa: E402


class DecideActionTest(unittest.TestCase):
    def test_empty_local_downloads(self):
        remote = {
            "generated_at": "2026-09-15T08:00:00Z",
            "file_count": 12937,
            "total_bytes": 102921212,
            "last_mtime": "2026-09-15T07:50:00Z",
            "source": "synology",
        }
        local = {"file_count": 0, "total_bytes": 0, "last_mtime": ""}
        self.assertEqual(cache.decide_cache_action(remote, local, None), "download")

    def test_remote_more_files_is_delta(self):
        remote = {"file_count": 13000, "total_bytes": 110000000, "last_mtime": "2026-09-15T09:00:00Z"}
        local = {"file_count": 12900, "total_bytes": 100000000, "last_mtime": "2026-09-14T09:00:00Z"}
        self.assertEqual(cache.decide_cache_action(remote, local, {}), "delta")

    def test_match_is_noop(self):
        remote = {
            "file_count": 100,
            "total_bytes": 5000,
            "last_mtime": "2026-09-15T09:00:00Z",
            "generated_at": "2026-09-15T09:00:00Z",
        }
        local = {
            "file_count": 100,
            "total_bytes": 5000,
            "last_mtime": "2026-09-15T09:00:00Z",
        }
        db = {"synced_at": "2026-09-15T09:00:00Z", "file_count": 100}
        self.assertEqual(cache.decide_cache_action(remote, local, db), "noop")

    def test_local_ahead_is_noop(self):
        remote = {"file_count": 100, "total_bytes": 1000, "last_mtime": "2026-09-14T00:00:00Z"}
        local = {"file_count": 120, "total_bytes": 1500, "last_mtime": "2026-09-15T00:00:00Z"}
        self.assertEqual(cache.decide_cache_action(remote, local, None), "noop")

    def test_missing_remote_empty_local_blocked(self):
        self.assertEqual(cache.decide_cache_action(None, {"file_count": 0}, None), "blocked")

    def test_missing_remote_with_local_noop(self):
        self.assertEqual(cache.decide_cache_action(None, {"file_count": 10}, None), "noop")


class KvLocalTest(unittest.TestCase):
    def test_kv_roundtrip_does_not_create_second_db(self):
        key = "thumb-cache-manifest-test"
        prev = dam_db.kv_local_get(key, None)
        payload = {
            "generated_at": "2026-09-15T10:00:00Z",
            "file_count": 3,
            "total_bytes": 99,
            "last_mtime": "2026-09-15T09:59:00Z",
            "source": "synology",
            "synced_at": "2026-09-15T10:00:00Z",
        }
        try:
            dam_db.kv_local_set(key, payload, updated_by="test")
            got = dam_db.kv_local_get(key, {})
            self.assertEqual(got.get("file_count"), 3)
            self.assertEqual(got.get("synced_at"), "2026-09-15T10:00:00Z")
            self.assertEqual(got.get("source"), "synology")
            self.assertEqual(dam_db.THUMB_CACHE_MANIFEST_KEY, "thumb-cache-manifest")
            self.assertTrue(dam_db.db_path().is_file())
        finally:
            if prev is None:
                conn = dam_db._connect_sqlite()
                try:
                    conn.execute("DELETE FROM dam_kv_local WHERE store_key = ?", (key,))
                    conn.commit()
                finally:
                    conn.close()
            else:
                dam_db.kv_local_set(key, prev, updated_by="test-restore")


class ManifestWriteTest(unittest.TestCase):
    def test_local_manifest_schema(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "thumbs").mkdir()
            (root / "thumbs" / "abc.avif").write_bytes(b"avif")
            old = cache.DEFAULT_CACHE_ROOT
            try:
                cache.DEFAULT_CACHE_ROOT = root  # type: ignore[misc]
                payload = cache.provenance_payload(source="local")
                path = cache.write_local_manifest(payload)
                data = cache._read_json_file(path)
            finally:
                cache.DEFAULT_CACHE_ROOT = old  # type: ignore[misc]
            for key in ("generated_at", "file_count", "total_bytes", "last_mtime", "source"):
                self.assertIn(key, data)
            self.assertGreaterEqual(int(data["file_count"]), 1)


if __name__ == "__main__":
    unittest.main()
