# -*- coding: utf-8 -*-
"""Testy: komputer bez folderu Marketing musi tez dostawac z bazy branding-index.json
(zrodlo Brandingu i Wizualizacji), nie tylko file-index/branding-search-index. Przy
tym branding-index.json na zlotej maszynie ma ~362 MB, wiec walidacja "czy plik nie
jest rozdarty" nie moze robic pelnego json.loads() na calosci (kilka GB RAM)."""
from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import tracemalloc
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_snapshots as ix  # noqa: E402


class FakeDb:
    """Minimalna tabela dam_index_snapshots w pamieci (jak w test_index_snapshots.py)."""

    def __init__(self):
        self.rows: dict[str, dict] = {}
        self.fetches = 0

    def publish_index_snapshot(self, key, raw, *, sha256, built_at, built_by="", item_count=0):
        cur = self.rows.get(key)
        if cur and cur["sha256"] == sha256:
            return {"ok": True, "changed": False, "generation": cur["generation"]}
        gen = int(time.time() * 1000) + len(self.rows)
        self.rows[key] = {"raw": raw, "sha256": sha256, "generation": gen, "built_at": built_at,
                          "built_by": built_by, "published_at": built_at, "raw_bytes": len(raw)}
        return {"ok": True, "changed": True, "generation": gen}

    def index_snapshot_meta(self):
        return {k: {kk: v for kk, v in r.items() if kk != "raw"} | {"store_key": k} for k, r in self.rows.items()}

    def fetch_index_snapshot(self, key):
        self.fetches += 1
        r = self.rows.get(key)
        if not r:
            return None
        return {"store_key": key, "generation": r["generation"], "sha256": r["sha256"],
                "built_at": r["built_at"], "built_by": r["built_by"]}, r["raw"]


def _big_json_bytes(target_bytes: int) -> bytes:
    """Poprawny duzy JSON {"assets": [...]}, >~ target_bytes."""
    # kazdy element ~120 bajtow -> licz ile potrzeba
    item = {"id": "A" * 40, "path": "M:/branding/foo/bar/baz/plik-o-dlugiej-nazwie.jpg", "sha": "b" * 64}
    item_json = json.dumps(item, ensure_ascii=False)
    n = max(1, target_bytes // (len(item_json) + 1))
    payload = {"assets": [item for _ in range(n)]}
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return raw


def _write(path: Path, raw: bytes, mtime: float | None = None) -> bytes:
    path.write_bytes(raw)
    if mtime is not None:
        os.utime(path, (mtime, mtime))
    return raw


class SnapshotFilesTests(unittest.TestCase):
    def test_branding_index_w_snapshot_files_i_kolejnosc(self):
        keys = list(ix.SNAPSHOT_FILES.keys())
        self.assertIn("branding-index", keys)
        self.assertEqual(ix.SNAPSHOT_FILES["branding-index"], "branding-index.json")
        self.assertEqual(keys, ["file-index", "branding-index", "branding-search-index"])


class LooksCompleteJsonTests(unittest.TestCase):
    def test_male_pliki_pelny_parse(self):
        self.assertTrue(ix._looks_complete_json(b'{"a": 1}'))
        self.assertFalse(ix._looks_complete_json(b'{"a": '))
        self.assertFalse(ix._looks_complete_json(b'not json at all'))

    def test_duzy_plik_ucieta_koncowka_odrzucona(self):
        raw = _big_json_bytes(200)
        torn = raw[:-5]  # bez koncowego "}...}"
        # wymus tryb "duzy plik" bez generowania >50MB w tym tescie
        with mock.patch.object(ix, "FULL_PARSE_MAX_BYTES", 10):
            self.assertFalse(ix._looks_complete_json(torn))

    def test_duzy_plik_kompletny_akceptowany(self):
        raw = _big_json_bytes(200)
        with mock.patch.object(ix, "FULL_PARSE_MAX_BYTES", 10):
            self.assertTrue(ix._looks_complete_json(raw))


class BrandingSnapshotFlowTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.pc_firmowy = self.base / "pc" / "data"
        self.laptop = self.base / "laptop" / "data"
        for d in (self.pc_firmowy, self.laptop):
            d.mkdir(parents=True)
        self.db = FakeDb()
        self.state_dir = self.base / "state-pc"
        p = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)
        p2 = mock.patch.dict(sys.modules, {"pg_db": self.db})
        p2.start()
        self.addCleanup(p2.stop)

    def _as(self, who: str):
        self.state_dir = self.base / f"state-{who}"

    def test_publikuje_duzy_branding_index_bez_json_loads_calosci(self):
        """publish_changed dla pliku > FULL_PARSE_MAX_BYTES nie robi jednego duzego
        json.loads na calej tresci - mierzymy peak pamieci i patchujemy json.loads tak,
        by rzucal wyjatkiem gdy dostanie > 1 MB danych (czyli cala tresc pliku ~60 MB)."""
        self._as("pc")
        raw = _big_json_bytes(60 * 1024 * 1024)
        self.assertGreater(len(raw), 50 * 1024 * 1024)
        _write(self.pc_firmowy / "branding-index.json", raw)

        real_loads = json.loads

        def guarded_loads(s, *a, **kw):
            size = len(s) if isinstance(s, (bytes, str)) else 0
            if size > 1_000_000:
                raise AssertionError("json.loads() wywolany na duzej tresci - to jest pelen parse >50MB pliku")
            return real_loads(s, *a, **kw)

        with mock.patch.object(json, "loads", side_effect=guarded_loads):
            tracemalloc.start()
            res = ix.publish_changed(self.pc_firmowy, root_alive=True)
            _current, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()

        self.assertTrue(res["ok"], res)
        self.assertIn("branding-index", res["published"])
        self.assertIn("branding-index", self.db.rows)
        self.assertEqual(self.db.rows["branding-index"]["raw"], raw)
        # peak rzedu 1x rozmiaru pliku (read_bytes trzyma jedna kopie) - pelny
        # json.loads zbudowalby dodatkowo drzewo obiektow, typowo kilka razy
        # wiecej niz surowe bajty. 2x daje margines na narzuty bez ukrywania
        # regresji do pelnego parsowania.
        self.assertLess(peak, len(raw) * 2)

    def test_niepelny_skan_nie_trafia_do_bazy(self):
        """23.09: skan widzial 9 produktow zamiast 196 i trafil do bazy. Plik mniejszy
        niz polowa wersji w bazie nie jest publikowany (bez force)."""
        self._as("pc")
        full = _big_json_bytes(40_000)
        _write(self.pc_firmowy / "file-index.json", full)
        res = ix.publish_changed(self.pc_firmowy, root_alive=True)
        self.assertIn("file-index", res["published"])
        small = _big_json_bytes(4_000)
        _write(self.pc_firmowy / "file-index.json", small, mtime=time.time() + 5)
        res2 = ix.publish_changed(self.pc_firmowy, root_alive=True)
        self.assertNotIn("file-index", res2["published"])
        self.assertEqual(res2["refused_shrink"][0]["key"], "file-index")
        self.assertEqual(self.db.rows["file-index"]["raw"], full)
        res3 = ix.publish_changed(self.pc_firmowy, root_alive=True, force=True)
        self.assertIn("file-index", res3["published"])

    def test_pull_sciaga_branding_index_zapisuje_atomowo_i_woła_on_updated(self):
        self._as("pc")
        raw = _big_json_bytes(4000)  # maly plik (> MIN_BYTES) wystarczy do sprawdzenia przeplywu
        _write(self.pc_firmowy / "branding-index.json", raw)
        res_pub = ix.publish_changed(self.pc_firmowy, root_alive=True)
        self.assertIn("branding-index", res_pub["published"])

        self._as("laptop")
        seen: list[tuple[str, Path]] = []
        res = ix.pull_newer(self.laptop, root_alive=False,
                             on_updated=lambda k, p: seen.append((k, p)))
        keys_pulled = [x["key"] for x in res["pulled"]]
        self.assertIn("branding-index", keys_pulled)
        target = self.laptop / "branding-index.json"
        self.assertTrue(target.is_file())
        self.assertEqual(target.read_bytes(), raw)
        self.assertIn("branding-index", [k for k, _p in seen])
        for k, p in seen:
            if k == "branding-index":
                self.assertEqual(p, target)
        # brak plikow tymczasowych po sobie
        leftover = list(self.laptop.glob("*.tmp"))
        self.assertEqual(leftover, [])

    def test_ucietny_plik_odrzucony_przy_pull_bez_zmian_lokalnie(self):
        self._as("pc")
        raw = _big_json_bytes(200)
        torn = raw[:-10]  # bez koncowego nawiasu - "rozdarty" plik
        # wstrzykujemy bezposrednio do bazy z prawidlowym sha rozdartej tresci,
        # symulujac uszkodzony wpis (np. przerwany transfer)
        import hashlib
        sha = hashlib.sha256(torn).hexdigest()
        self.db.rows["branding-index"] = {
            "raw": torn, "sha256": sha, "generation": 1,
            "built_at": "2026-09-20T00:00:00+00:00", "built_by": "pc", "published_at": "",
        }

        self._as("laptop")
        local_raw = b'{"assets": ["stary lokalny plik"]}' + b" " * 1100
        target = self.laptop / "branding-index.json"
        _write(target, local_raw)

        res = ix.pull_newer(self.laptop, root_alive=False)
        self.assertIn("branding-index", res.get("errors", {}))
        self.assertFalse(res["ok"])
        # plik lokalny bez zmian - nie nadpisany rozdarta trescia z bazy
        self.assertEqual(target.read_bytes(), local_raw)

    def test_publish_changed_bez_roota_nic_nie_publikuje(self):
        self._as("laptop")
        raw = _big_json_bytes(200)
        _write(self.laptop / "branding-index.json", raw)
        _write(self.laptop / "file-index.json", raw)
        _write(self.laptop / "branding-search-index.json", raw)
        res = ix.publish_changed(self.laptop, root_alive=False)
        self.assertEqual(res.get("skipped"), "no_marketing_root")
        self.assertEqual(self.db.rows, {})


if __name__ == "__main__":
    unittest.main()
