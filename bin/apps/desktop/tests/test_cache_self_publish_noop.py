"""decide_cache_action: manifest opublikowany przez TEN komputer = noop (nie sciagamy wlasnej paczki).
06.10.2026: wlasciciel cache (KRZYSZTOFWI) po kazdej publikacji sciagal z NAS 343 MB, bo manifest
mial generated_at nowszy niz lokalne synced_at."""
import sys
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import dam_thumb_cache as tc  # noqa: E402

LOCAL = {"file_count": 62540, "total_bytes": 696_278_096}
DB_OLD = {"synced_at": "2026-10-06T14:00:00Z", "file_count": 62348}


def remote(publisher):
    return {"file_count": 62348, "total_bytes": 336_281_047, "generated_at": "2026-10-06T15:22:56Z",
            "publisher": publisher, "thumb_count": 62531, "files": []}


class SelfPublishNoopTests(unittest.TestCase):
    def test_own_manifest_is_noop_even_if_newer(self):
        with mock.patch.object(tc, "_publisher_name", lambda: "KRZYSZTOFWI"):
            self.assertEqual(tc.decide_cache_action(remote("KRZYSZTOFWI"), LOCAL, DB_OLD), "noop")
            self.assertEqual(tc.decide_cache_action(remote("krzysztofwi"), LOCAL, DB_OLD), "noop")

    def test_foreign_manifest_with_more_thumbs_still_delta(self):
        r = remote("KRZYSZTOFWI")
        r["files"] = [{"digest": "a", "ext": "avif"}, {"digest": "b", "ext": "avif"}]
        with mock.patch.object(tc, "_publisher_name", lambda: "KINGAUR"), \
                mock.patch.object(tc, "_manifest_files", lambda m: m.get("files") or []), \
                mock.patch.object(tc, "local_thumb_stats", lambda fresh=False: {"files": 1}):
            self.assertEqual(tc.decide_cache_action(r, LOCAL, DB_OLD), "delta")
            # ta sama sytuacja, ale manifest nasz wlasny -> noop
            with mock.patch.object(tc, "_publisher_name", lambda: "KRZYSZTOFWI"):
                self.assertEqual(tc.decide_cache_action(r, LOCAL, DB_OLD), "noop")

    def test_empty_local_downloads_regardless_of_publisher(self):
        with mock.patch.object(tc, "_publisher_name", lambda: "KRZYSZTOFWI"):
            self.assertEqual(tc.decide_cache_action(remote("KRZYSZTOFWI"), {"file_count": 0}, {}), "download")


if __name__ == "__main__":
    unittest.main()
