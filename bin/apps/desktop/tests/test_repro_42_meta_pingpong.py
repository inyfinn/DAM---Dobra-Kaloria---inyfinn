# -*- coding: utf-8 -*-
"""Audyt 4.2 (P0): przepychanka rzeczywiscie roznych metadanych M/X.

Ten sam plik, rozmiar i mtime; M ma folder_editable_files=[a.png, b.ai], X (kopia
niepelna) ma [a.png]. W 2.4.5 kazdy cykl M/X/M/X zmienial wiersz w bazie (rev
rosl w nieskonczonosc) - samo sortowanie list i zdjecie litery dysku tego nie
rozwiazuje, bo listy sa naprawde rozne.

Kontrakt R (DECYZJE.md): pola relacji folderu nie sa porownywane ani wysylane ze
skanu; liczone przy odczycie z katalogu (folder_relations.compute). Fakty idza do
bazy tylko przy zmianie WLASNEJ obserwacji; rozne fakty dwoch komputerow =
konflikt w raporcie, nie nadpisanie.

Baza: atrapa w procesie albo realpg (W1) - patrz test_repro_41_older_copy_tombstone.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import asset_sync  # noqa: E402
import asset_sync_runner  # noqa: E402
from test_repro_41_older_copy_tombstone import (  # noqa: E402
    Client, _WorkDir, backend_name, db_max_rev, db_row, make_db,
)

try:
    import folder_relations  # noqa: E402
except ImportError:  # baseline 2.4.5: modulu nie ma
    folder_relations = None

FOLDER = "- POLSKA/1 - PRODUKTY/Klopsiki 6300576/2 - PROJEKT"
A = f"{FOLDER}/a.png"
B = f"{FOLDER}/b.ai"
FILE_A = (1111, 1_000_000)
FILE_B = (2222, 1_000_000)


def _rel_meta(root: str, editable: list[str], *, sku: str = "6300576", **extra) -> dict:
    """Meta jak z build-branding-index: fakty + relacje folderu widziane z dysku."""
    base = root.rstrip("/")
    files = [{"id": f"br-{i}", "name": n, "path": f"{base}/{FOLDER}/{n}"}
             for i, n in enumerate(editable)]
    meta = {
        "sku": sku,
        "media_type": "image",
        "folder_group_id": asset_sync.key_of(FOLDER),
        "folder_has_editable": any(n.endswith(".ai") for n in editable),
        "folder_editable_files": files,
        "folder_variants": [{"id": "br-a", "name": "a.png", "path": f"{base}/{A}",
                             "label": "Plik", "media_type": "image"}],
    }
    meta.update(extra)
    return meta


class Repro42Tests(unittest.TestCase):
    def setUp(self):
        self.pg = make_db(self)
        self.m = Client("M-FIRMA", "M:", {
            A: (*FILE_A, _rel_meta("M:", ["a.png", "b.ai"])),
            B: (*FILE_B, _rel_meta("M:", ["a.png", "b.ai"], media_type="vector")),
        })
        self.x = Client("X-DOM", "X:/Marketing", {
            A: (*FILE_A, _rel_meta("X:/Marketing", ["a.png"])),     # b.ai jeszcze nie dotarl
        })
        self.c = Client("C-BEZROOT", None)

    def _cycles(self, n: int) -> list[int]:
        """n par cykli M/X; zwraca max(rev) po kazdym cyklu."""
        revs = []
        for _ in range(n):
            for cl in (self.m, self.x):
                cl.sync(self.pg)
                self.assertTrue(cl.last["ok"], cl.last)
                revs.append(db_max_rev(self.pg))
        return revs

    def test_alternating_m_x_converges_zero_writes(self):
        self._cycles(1)                                   # start: M dodaje a.png i b.ai
        start = db_max_rev(self.pg)
        revs = self._cycles(3)                            # M/X/M/X/M/X
        self.assertEqual(revs, [start] * 6, f"rev rosnie co cykl (ping-pong): {revs}")
        self.assertEqual((self.m.applied(), self.x.applied()), (0, 0))
        self.assertIsNone(db_row(self.pg, A)["deleted_at"])
        self.assertIsNone(db_row(self.pg, B)["deleted_at"])  # X nigdy nie widzial b.ai

    def test_repeated_unchanged_observations_zero_writes_same_max_rev(self):
        self._cycles(1)
        start = db_max_rev(self.pg)
        for _ in range(3):
            self.x.sync(self.pg)
            self.assertEqual(self.x.ops(), [])
            self.assertEqual(self.x.applied(), 0)
        self.assertEqual(db_max_rev(self.pg), start)

    def test_differing_facts_are_conflict_not_overwrite(self):
        """Rozne FAKTY (np. OCR/opis z innego file-index) na M i X: bez nadpisywania
        na przemian; konflikt widoczny w raporcie."""
        self.x.disk[A] = (*FILE_A, _rel_meta("X:/Marketing", ["a.png"], ocr_text="stary ocr"))
        self._cycles(1)
        start = db_max_rev(self.pg)
        revs = self._cycles(3)
        self.assertEqual(revs, [start] * 6, f"fakty przepychane na przemian: {revs}")
        self.assertGreaterEqual(int(self.x.last["report"].get("conflicts") or 0), 1)
        self.assertNotIn("ocr_text", db_row(self.pg, A)["meta"])   # opis M zostal

    def test_real_fact_change_passes_and_stale_client_does_not_revert(self):
        self._cycles(1)
        self._cycles(1)                                   # obie strony maja obserwacje
        self.m.disk[A] = (*FILE_A, _rel_meta("M:", ["a.png", "b.ai"], sku="6300999"))
        self.m.sync(self.pg)
        self.assertEqual([o["reason"] for o in self.m.ops()], ["meta"])
        self.assertEqual(db_row(self.pg, A)["meta"]["sku"], "6300999")
        after = db_max_rev(self.pg)
        self.x.sync(self.pg)                              # X ma jeszcze stary opis (bez przebudowy)
        self.assertEqual(self.x.ops(), [], "nieaktualny X cofnal prawdziwa zmiane")
        self.assertEqual(db_row(self.pg, A)["meta"]["sku"], "6300999")
        self.assertEqual(db_max_rev(self.pg), after)
        self.x.disk[A] = (*FILE_A, _rel_meta("X:/Marketing", ["a.png"], sku="6300999"))
        self.x.sync(self.pg)                              # X przebudowal - zgodny, zero zapisow
        self.assertEqual(self.x.ops(), [])
        self.c.sync(self.pg)
        entry = next(e for e in asset_sync.live_entries(self.c.rows) if e["path"] == A)
        self.assertEqual(entry["sku"], "6300999")

    def test_old_client_full_meta_does_not_trigger_new_client_writes(self):
        """Stary klient (2.4.5) wysyla pelne meta ze swoimi relacjami; nowy klient
        nie odpowiada zapisem (relacje nie sa porownywane)."""
        self._cycles(1)
        aid = asset_sync.id_of(asset_sync.key_of(A))
        prev = dict(self.x.rows[aid])
        _, entry = asset_sync.scan_entry(f"X:/Marketing/{A}", size=FILE_A[0], mtime_ms=FILE_A[1],
                                          root="X:/Marketing",
                                          meta=_rel_meta("X:/Marketing", ["a.png", "stary.psd"]))
        old_op = asset_sync._op("upsert", aid, entry, None, "OLD-2.4.5", 1, "meta")
        old_op["base_rev"] = prev["rev"]                  # jak 2.4.5: znany rev, pelne meta
        self.assertEqual(asset_sync.push_ops(self.pg, [old_op], now_ms=1)["applied"], 1)
        after_old = db_max_rev(self.pg)
        for _ in range(2):
            self.m.sync(self.pg)
            self.assertEqual(self.m.ops(), [], "nowy klient odpowiedzial na relacje starego")
        self.assertEqual(db_max_rev(self.pg), after_old)

    def test_meta_held_without_authority_is_retried_later(self):
        """Komputer bez uprawnien: zmiana opisu wstrzymana, ale nie zapomniana -
        po nadaniu uprawnien idzie do bazy (obserwacja nie zostala zuzyta)."""
        self._cycles(2)
        self.m.disk[A] = (*FILE_A, _rel_meta("M:", ["a.png", "b.ai"], sku="6300777"))
        scan, dirs = self.m.scan()
        kw = dict(scan=scan, scanned_dirs=dirs, last_seen=self.m.last_seen,
                  scan_time_ms=self.m.clock + 1000, machine=self.m.name)
        res = asset_sync_runner._sync_cycle_restricted_ops(self.pg, self.m.rows, **kw)
        self.assertTrue(res["ok"])
        self.assertEqual(res["report"]["not_authority_held"], 1)
        self.assertEqual(db_row(self.pg, A)["meta"]["sku"], "6300576")
        self.m.rows, self.m.last_seen = res["rows"], res["next_last_seen"]
        self.m.sync(self.pg)                              # uprawnienia nadane: zwykly cykl
        self.assertEqual([o["reason"] for o in self.m.ops()], ["meta"])
        self.assertEqual(db_row(self.pg, A)["meta"]["sku"], "6300777")

    def test_relations_computed_identical_for_m_and_x_from_catalog(self):
        self.assertIsNotNone(folder_relations, "brak folder_relations.compute (kontrakt R)")
        self._cycles(2)
        rel_m = folder_relations.compute(self.m.rows)
        rel_x = folder_relations.compute(self.x.rows)
        self.c.sync(self.pg)
        rel_c = folder_relations.compute(self.c.rows)
        self.assertEqual(rel_m, rel_x)
        self.assertEqual(rel_m, rel_c)
        aid = asset_sync.id_of(asset_sync.key_of(A))
        self.assertEqual([f["name"] for f in rel_x[aid]["folder_editable_files"]], ["b.ai"])
        self.assertTrue(rel_x[aid]["folder_has_editable"])
        # swiadome usuniecie b.ai na M dociera do list wszystkich
        del self.m.disk[B]
        self.m.sync(self.pg)
        self.x.sync(self.pg)
        self.assertIsNotNone(db_row(self.pg, B)["deleted_at"])
        rel_x2 = folder_relations.compute(self.x.rows)
        self.assertEqual(rel_x2[aid]["folder_editable_files"], [])
        self.assertFalse(rel_x2[aid]["folder_has_editable"])
        self.assertEqual(rel_x2, folder_relations.compute(self.m.rows))


class Runner42Tests(unittest.TestCase):
    """Wpiecie w runner: lokalny branding-index.json X ma relacje z katalogu."""

    ROOT = "X:/Marketing"

    def setUp(self):
        self.pg = make_db(self)
        self.work = _WorkDir()
        self.addCleanup(self.work.cleanup)
        self.data_dir = self.work.path / "data"
        self.data_dir.mkdir()
        self.db_path = self.work.path / "dam-local.sqlite"
        p = patch("index_authority.may_publish", return_value=None)
        p.start()
        self.addCleanup(p.stop)
        m = Client("M-FIRMA", "M:", {
            A: (*FILE_A, _rel_meta("M:", ["a.png", "b.ai"])),
            B: (*FILE_B, _rel_meta("M:", ["a.png", "b.ai"], media_type="vector")),
        })
        m.sync(self.pg)

    def _run(self, scan_time: int):
        (self.data_dir / "branding-index.scan.json").write_text(json.dumps({"assets": [
            dict(_rel_meta(self.ROOT, ["a.png"]), path=f"{self.ROOT}/{A}",
                 size_bytes=FILE_A[0], mtime_ms=FILE_A[1]),
        ]}), encoding="utf-8")
        (self.data_dir / "branding-scan-dirs.json").write_text(json.dumps({
            "version": 1, "scan_time_ms": scan_time, "root": self.ROOT,
            "scanned_dirs": sorted(set(asset_sync._ancestors(asset_sync.key_of(A)))),
            "failed_dirs": []}), encoding="utf-8")
        return asset_sync_runner.run_once(
            self.db_path, self.data_dir, root_alive=True, root_path=self.ROOT,
            machine="X-DOM", pg_connect=lambda: self.pg, on_index_written=None)

    def test_runner_writes_catalog_relations_into_local_index(self):
        start = db_max_rev(self.pg)
        for i in range(3):
            res = self._run(60_000_000 + i)
            self.assertTrue(res["ok"], res)
            self.assertTrue(res["did_scan"])
        self.assertEqual(db_max_rev(self.pg), start, "runner X zapisal relacje do bazy")
        idx = json.loads((self.data_dir / "branding-index.json").read_text(encoding="utf-8"))
        a = next(e for e in idx["assets"] if e["name"] == "a.png")
        self.assertEqual([f["name"] for f in a["folder_editable_files"]], ["b.ai"])
        self.assertEqual(a["folder_editable_files"][0]["path"], f"{self.ROOT}/{B}")
        self.assertTrue(a["folder_has_editable"])


def load_tests(loader, tests, pattern):  # noqa: ARG001
    print(f"[repro 4.2] baza testowa: {backend_name()}")
    return tests


if __name__ == "__main__":
    unittest.main()
