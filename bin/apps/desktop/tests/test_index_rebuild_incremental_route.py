"""POST /index/rebuild z product_path = przyrost (--only-product + --merge-into), bez sciezki = pelny skan.
Klik F/X/D i 'Dodaj produkt' wolaly pelny skan M: (27-54 min) po kazdej zmianie (test okna 06.10.2026)."""
import sys
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import local_bridge as lb  # noqa: E402


class IndexBuildArgvTests(unittest.TestCase):
    def test_full_scan_without_products(self):
        argv = lb._index_build_argv(None)
        self.assertNotIn("--only-product", argv)
        self.assertNotIn("--merge-into", argv)
        self.assertTrue(any(str(a).endswith("build-file-index.py") for a in argv))

    def test_incremental_with_products(self):
        p1 = r"M:\- POLSKA\01 - PRODUKTY\- DK\09 - TEST\TEST CLAUDE — [ test ] - D"
        argv = lb._index_build_argv([p1, "X:\\inny"])
        self.assertEqual(argv.count("--only-product"), 2)
        self.assertEqual(argv[argv.index("--only-product") + 1], p1)
        self.assertEqual(argv[argv.index("--merge-into") + 1], str(lb.INDEX_FILE))

    def test_start_passes_products_to_thread(self):
        seen = {}

        class FakeThread:
            def __init__(self, target=None, args=(), daemon=None):
                seen["target"], seen["args"] = target, args

            def start(self):
                pass

        with mock.patch.object(lb.threading, "Thread", FakeThread), \
                mock.patch.object(lb, "_scan_blocked_reason", lambda: ""), \
                mock.patch.object(lb, "index_status", lambda: {"rebuild": {}}), \
                mock.patch.object(lb.time, "sleep", lambda *_: None):
            lb._index_state["running"] = False
            out = lb.start_index_rebuild(only_products=["M:\\a"])
            self.assertTrue(out["ok"])
            self.assertEqual(seen["args"], (["M:\\a"],))
            lb.start_index_rebuild()
            self.assertEqual(seen["args"], (None,))


if __name__ == "__main__":
    unittest.main()
