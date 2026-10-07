# -*- coding: utf-8 -*-
"""07.10.2026, dwie drobne zmiany mostu wokol migawek indeksu:

1) przebudowa uruchomiona z mostu (_run_index_rebuild) oznacza "zbudowane tutaj" takze
   search-index - build-file-index.py pisze go w tym samym biegu co file-index, a watcher
   (watch-file-index.py) oznacza oba od dawna;
2) GET /index/snapshots nie oddaje klucza branding-index - tej migawki nie ma juz w bazie
   (tryb rows), a lokalny stan trzymal stara etykiete "z bazy, KINGAUR 24.09".

Run: python tests/test_bridge_search_index_mark_and_snapshot_keys.py  (z bin/apps/desktop)
"""
from __future__ import annotations

import http.client
import inspect
import json
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parent.parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_snapshots  # noqa: E402
import local_bridge as lb  # noqa: E402


class RebuildMarksSearchIndexTests(unittest.TestCase):
    """Ten sam wzorzec co test_branding_rebuild_marks_campaigns.py: _run_index_rebuild
    odpala podproces i nie daje sie uruchomic w tescie od A do Z."""

    def setUp(self):
        self.src = inspect.getsource(lb._run_index_rebuild)

    def test_both_marks_present_file_index_first(self):
        i_file = self.src.index("_mark_built_here('file-index', INDEX_FILE)")
        i_search = self.src.index('_mark_built_here("search-index"')
        self.assertLess(i_file, i_search)

    def test_search_index_mark_only_after_successful_build(self):
        i_ok = self.src.index("if rc == 0:\n            _drop_json_cache(INDEX_FILE)")
        self.assertLess(i_ok, self.src.index('_mark_built_here("search-index"'))

    def test_marked_file_is_the_sibling_of_file_index(self):
        self.assertIn('INDEX_FILE.with_name("search-index.json")', self.src)
        self.assertEqual(lb.INDEX_FILE.with_name("search-index.json").name,
                         index_snapshots.SNAPSHOT_FILES["search-index"])

    def test_bridge_helper_accepts_the_key(self):
        with mock.patch.object(index_snapshots, "mark_built_here", return_value={"ok": True}) as fn:
            self.assertEqual(lb._mark_built_here("search-index", Path("search-index.json")), "ok")
        fn.assert_called_once_with("search-index", Path("search-index.json"))


class SnapshotsRouteKeysTests(unittest.TestCase):
    def test_route_drops_branding_index_and_keeps_the_rest(self):
        entry = {"source": "db", "built_at": "2026-09-24T10:00:00+00:00", "built_by": "KINGAUR",
                 "db_built_at": "2026-09-24T10:00:00+00:00", "db_built_by": "KINGAUR", "pulled_at": ""}
        fake = {"ok": True,
                "keys": {k: dict(entry) for k in ("file-index", "branding-index", "branding-search-index",
                                                  "search-index", "campaigns")},
                "last": {}, "first_sync": {"done": True}}
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), lb.Handler)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            with mock.patch.object(index_snapshots, "status", return_value=fake):
                conn = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1], timeout=10)
                conn.request("GET", "/index/snapshots", headers={"Origin": "http://127.0.0.1:8765"})
                r = conn.getresponse()
                data = json.loads(r.read().decode("utf-8"))
                conn.close()
        finally:
            httpd.shutdown()
            httpd.server_close()
        self.assertEqual(r.status, 200, data)
        self.assertTrue(data["ok"])
        self.assertEqual(sorted(data["keys"]),
                         ["branding-search-index", "campaigns", "file-index", "search-index"])
        self.assertEqual(data["first_sync"], {"done": True})


if __name__ == "__main__":
    unittest.main(verbosity=2)
