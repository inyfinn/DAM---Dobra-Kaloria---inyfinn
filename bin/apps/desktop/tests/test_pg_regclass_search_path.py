# -*- coding: utf-8 -*-
"""W8 (28.09.2026), S8 A/B/C: pg_db.index_snapshot_meta i fetch_thumb_cache_rows
sprawdzaly tabele przez to_regclass('public.X'). W izolowanym schemacie (search_path =
e2e_*, public) tabela istnieje, ale nie w public -> meta migawek zawsze pusta -> komputer
bez ROOT nigdy nie dostawal file-index (404 file_index_missing), spis miniatur z bazy pusty.

Kontrakt: to_regclass bez kwalifikacji schematu (rozwiazanie przez search_path; na
produkcji jest tylko public, wiec wynik identyczny).
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import pg_db  # noqa: E402


class _Cur:
    """Udaje schemat e2e: tabela jest widoczna tylko przez search_path."""

    def __init__(self, log):
        self.log = log
        self._rows = []

    def execute(self, sql, args=None):
        self.log.append(sql)
        if "to_regclass" in sql:
            self._rows = [{"t": None if "public." in sql else "dam_x"}]
        elif "FROM dam_index_snapshots" in sql:
            self._rows = [{"store_key": "file-index", "generation": 1, "sha256": "s", "raw_bytes": 2000,
                           "item_count": 1, "built_at": "b", "built_by": "TEST-A", "published_at": "p"}]
        elif "FROM dam_thumb_cache_index" in sql:
            self._rows = [{"store_key": "a|grid", "digest": "d", "mtime": 1.0, "published_at": "p"}]
        else:
            self._rows = []

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)


class _Conn:
    def __init__(self, log):
        self.log = log

    def cursor(self):
        return _Cur(self.log)

    def close(self):
        pass


class RegclassSearchPathTests(unittest.TestCase):
    def setUp(self):
        self.log: list[str] = []
        p = mock.patch.object(pg_db, "connect", side_effect=lambda *a, **k: _Conn(self.log))
        p.start()
        self.addCleanup(p.stop)

    def test_snapshot_meta_visible_in_isolated_schema(self):
        self.assertIn("file-index", pg_db.index_snapshot_meta())
        self.assertFalse(any("public." in s for s in self.log), self.log)

    def test_thumb_rows_visible_in_isolated_schema(self):
        self.assertEqual(len(pg_db.fetch_thumb_cache_rows()), 1)
        self.assertFalse(any("public." in s for s in self.log), self.log)


if __name__ == "__main__":
    unittest.main()
