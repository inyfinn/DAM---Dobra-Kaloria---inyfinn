# -*- coding: utf-8 -*-
"""Etap 1a (spec 9.1): czysta logika roli "komputer z M:" w asset_sync.diff_scan_report - bez bazy.

Role: "m" = komputer z M: w trybie on (dane z M: sa wzorcem); "copy" = reguly sprzed etapu 1a. Rola "copy" musi dawac
DOKLADNIE ten sam wynik co wersja 2.6.0 (test porownawczy z `git show 259091ed:...asset_sync.py`)."""
from __future__ import annotations

import importlib.util
import random
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
DESKTOP = HERE.parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import asset_sync  # noqa: E402

REF_2_6_0 = "259091ed"
ROOT = "M:"


def _row(rel: str, mtime: int, *, size: int | None = 10, origin=None, master_mtime=None, deleted=None, rev=5,
         meta=None) -> tuple[str, dict]:
    aid, entry = asset_sync.scan_entry(f"{ROOT}/{rel}", size=size, mtime_ms=mtime, root=ROOT,
                                       meta=meta if meta is not None else {"sku": "1"})
    row = {**entry, "asset_id": aid, "deleted_at": deleted, "updated_at": 1, "updated_by": "M",
           "seen_by_machine": "M", "rev": rev, "origin": origin, "master_mtime": master_mtime}
    return aid, row


def _scan_of(rel: str, mtime: int, *, size: int | None = 10, meta=None) -> tuple[str, dict]:
    return asset_sync.scan_entry(f"{ROOT}/{rel}", size=size, mtime_ms=mtime, root=ROOT,
                                 meta=meta if meta is not None else {"sku": "1"})


def _dirs(*rels: str) -> set[str]:
    out = {""}
    for r in rels:
        out.update(asset_sync._ancestors(asset_sync.key_of(f"{ROOT}/{r}")))
    return out


def _report_m(rows: dict, scan: dict, dirs, *, scan_time=1_000_000, failed=(), last_seen=None):
    return asset_sync.diff_scan_report(rows, scan, dirs, scan_time, "M-FIRMA", last_seen=last_seen,
                                       failed_dirs=failed, root_gen="g", role="m", scan_db_ms=scan_time + 7)


P = "- POLSKA/A"


class RoleMTests(unittest.TestCase):
    def test_starsza_data_to_zmiana(self):
        aid, row = _row(f"{P}/a.png", 2000, origin="m", master_mtime=2000)
        scan = dict([_scan_of(f"{P}/a.png", 1500)])
        rep = _report_m({aid: row}, scan, _dirs(f"{P}/a.png"))
        self.assertEqual([(o["op"], o["reason"], o["role"]) for o in rep["ops"]], [("upsert", "change", "m")])
        self.assertEqual(rep["ops"][0]["master_mtime"], 1500)
        self.assertEqual(rep["ops"][0]["scan_db_ms"], 1_000_007)

    def test_ta_sama_wersja_bez_operacji_i_stempel_tylko_gdy_nie_m(self):
        a1, r1 = _row(f"{P}/a.png", 2000)                              # sprzed 1a
        a2, r2 = _row(f"{P}/b.png", 2000, origin="copy")               # tylko z kopii
        a3, r3 = _row(f"{P}/c.png", 2000, origin="m", master_mtime=2000)
        scan = dict([_scan_of(f"{P}/{n}.png", 2000) for n in "abc"])
        rep = _report_m({a1: r1, a2: r2, a3: r3}, scan, _dirs(f"{P}/a.png"))
        self.assertEqual(rep["ops"], [])
        self.assertEqual(sorted(s[0] for s in rep["stamp"]), sorted([a1, a2]))
        self.assertEqual(rep["stamp"][0][1:], (2000, 10))

    def test_plik_ze_znacznikiem_wraca_przy_kazdej_dacie(self):
        aid, row = _row(f"{P}/a.png", 5000, origin="m", master_mtime=5000, deleted=900)
        for mt in (1000, 5000, 9000):
            rep = _report_m({aid: row}, dict([_scan_of(f"{P}/a.png", mt)]), _dirs(f"{P}/a.png"))
            self.assertEqual([(o["reason"], o["role"]) for o in rep["ops"]], [("returned", "m")], mt)

    def test_missing_tylko_origin_m_z_wylistowanym_przodkiem(self):
        a_m, r_m = _row(f"{P}/m.png", 100, origin="m", master_mtime=100)
        a_c, r_c = _row(f"{P}/c.png", 100, origin="copy")
        a_o, r_o = _row(f"{P}/o.png", 100)                              # sprzed 1a: NIE (decyzja P1)
        a_f, r_f = _row("- POLSKA/B/f.png", 100, origin="m", master_mtime=100)   # folder z bledem
        a_u, r_u = _row("- POLSKA/C/u.png", 100, origin="m", master_mtime=100)   # caly folder C zniknal
        a_d, r_d = _row(f"{P}/d.png", 100, origin="m", master_mtime=100, deleted=5)
        rows = {a_m: r_m, a_c: r_c, a_o: r_o, a_f: r_f, a_u: r_u, a_d: r_d}
        dirs = _dirs(f"{P}/x.png")        # '', '- polska', '- polska/a'
        failed = {asset_sync.key_of(f"{ROOT}/- POLSKA/B")}
        rep = _report_m(rows, {}, dirs, failed=failed)
        # B jest "failed": szukanie przodka konczy sie przed '- polska'. C nie ma w ogole (rodzic wylistowany).
        self.assertEqual(rep["missing"], sorted([a_m, a_u]))
        self.assertEqual(rep["blocked"], {})
        # nic nie wylistowane (brak skanu folderow): zadnych kandydatow
        self.assertEqual(_report_m(rows, {}, set(), failed=failed)["missing"], [])

    def test_data_z_przyszlosci_przycieta_a_surowa_w_master_mtime(self):
        future = 1_000_000 + asset_sync.FUTURE_MS + 60_000
        aid, entry = _scan_of(f"{P}/f.png", future)
        rep = _report_m({}, {aid: entry}, _dirs(f"{P}/f.png"))
        op = rep["ops"][0]
        self.assertEqual((op["mtime_ms"], op["master_mtime"], op["future_clipped"]), (1_000_000, future, True))
        self.assertEqual(rep["future_clipped"], 1)
        # drugi skan tego samego pliku: wiersz ma master_mtime = surowa data, wiec nic nie jest przepisywane
        row = {**entry, "asset_id": aid, "deleted_at": None, "rev": 9, "origin": "m", "master_mtime": future,
               "mtime_ms": 1_000_000, "updated_at": 1, "updated_by": "M", "seen_by_machine": "M"}
        rep2 = _report_m({aid: row}, {aid: entry}, _dirs(f"{P}/f.png"), scan_time=1_100_000)
        self.assertEqual(rep2["ops"], [])
        self.assertEqual(rep2["stamp"], [])

    def test_pusty_rozmiar_nie_jest_roznica(self):
        aid, row = _row(f"{P}/a.png", 3000, size=None, origin="m", master_mtime=3000)
        rep = _report_m({aid: row}, dict([_scan_of(f"{P}/a.png", 3000, size=4444)]), _dirs(f"{P}/a.png"))
        self.assertEqual(rep["ops"], [])
        aid2, row2 = _row(f"{P}/b.png", 3000, size=4444, origin="m", master_mtime=3000)
        rep2 = _report_m({aid2: row2}, dict([_scan_of(f"{P}/b.png", 3000, size=None)]), _dirs(f"{P}/b.png"))
        self.assertEqual(rep2["ops"], [])
        aid3, row3 = _row(f"{P}/c.png", 3000, size=1, origin="m", master_mtime=3000)
        rep3 = _report_m({aid3: row3}, dict([_scan_of(f"{P}/c.png", 3000, size=2)]), _dirs(f"{P}/c.png"))
        self.assertEqual([o["reason"] for o in rep3["ops"]], ["change"])

    def test_nowy_plik_to_add(self):
        aid, entry = _scan_of(f"{P}/n.png", 77)
        rep = _report_m({}, {aid: entry}, _dirs(f"{P}/n.png"))
        self.assertEqual([(o["reason"], o["base_rev"]) for o in rep["ops"]], [("add", 0)])


class RoleCopyTests(unittest.TestCase):
    def test_kopia_w_trybie_on_pomija_daty_z_przyszlosci(self):
        future = 1_000_000 + asset_sync.FUTURE_MS + 1
        aid, entry = _scan_of(f"{P}/f.png", future)
        rep = asset_sync.diff_scan_report({}, {aid: entry}, _dirs(f"{P}/f.png"), 1_000_000, "X", skip_future=True)
        self.assertEqual((rep["ops"], rep["future_skipped"]), ([], 1))
        rep = asset_sync.diff_scan_report({}, {aid: entry}, _dirs(f"{P}/f.png"), 1_000_000, "X")
        self.assertEqual(len(rep["ops"]), 1, "bez skip_future (off / shadow) zachowanie jak dotad")

    def test_pusty_rozmiar_po_stronie_bazy_nie_daje_zmiany(self):
        aid, row = _row(f"{P}/a.png", 3000, size=None)
        rep = asset_sync.diff_scan_report({aid: row}, dict([_scan_of(f"{P}/a.png", 3000, size=4444)]),
                                          _dirs(f"{P}/a.png"), 1_000_000, "X", last_seen={}, root_gen="g")
        self.assertEqual(rep["ops"], [])


def _load_old():
    try:
        src = subprocess.run(["git", "-C", str(DESKTOP), "show", f"{REF_2_6_0}:bin/apps/desktop/asset_sync.py"],
                             capture_output=True, timeout=60, check=True).stdout
    except Exception:  # noqa: BLE001 - brak gita / obiektu: porownanie pominiete
        return None
    path = HERE / "_asset_sync_2_6_0.tmp.py"
    return src, path


class ZgodnoscZ260(unittest.TestCase):
    """Rola "copy" (takze tryby off i shadow) = dokladnie wynik wersji 2.6.0, poza jednym swiadomym wyjatkiem:
    pusty rozmiar nie jest roznica (scenariusze maja zawsze znane rozmiary)."""

    @classmethod
    def setUpClass(cls):
        got = _load_old()
        if got is None:
            raise unittest.SkipTest(f"brak {REF_2_6_0} w repo - porownanie z 2.6.0 pominiete")
        src, _ = got
        spec = importlib.util.spec_from_loader("asset_sync_v260", loader=None)
        cls.old = importlib.util.module_from_spec(spec)
        cls.old.__file__ = str(DESKTOP / "asset_sync.py")
        exec(compile(src, "asset_sync_v260", "exec"), cls.old.__dict__)  # noqa: S102 - kod z wlasnego repo

    def _scenario(self, rnd: random.Random):
        rows, scan, last = {}, {}, {}
        for i in range(60):
            rel = f"- POLSKA/D{i % 6}/f{i}.png"
            mt = rnd.choice([1000, 2000, 3000])
            sz = rnd.choice([10, 20])
            aid, row = _row(rel, mt, size=sz, rev=rnd.randint(1, 50), deleted=rnd.choice([None, None, None, 400]),
                            meta={"sku": rnd.choice(["1", "2"])})
            if rnd.random() < 0.9:
                rows[aid] = row
            if rnd.random() < 0.75:
                s_mt = rnd.choice([mt, mt, mt + 500, mt - 500])
                s_sz = rnd.choice([sz, sz, sz + 1])
                _a, entry = _scan_of(rel, s_mt, size=s_sz, meta={"sku": rnd.choice(["1", "1", "2"])})
                scan[aid] = entry
            if rnd.random() < 0.7:
                last[aid] = {"mtime_ms": rnd.choice([mt, mt + 5]), "size": rnd.choice([sz, sz + 1]),
                             "hash": None, "root_gen": "g", "desc": rnd.choice(["x", "y"]), "rev": None}
        dirs = {""} | {asset_sync.key_of(f"{ROOT}/- POLSKA/D{k}") for k in range(5)} | {"- polska"}
        failed = {asset_sync.key_of(f"{ROOT}/- POLSKA/D5")}
        return rows, scan, dirs, failed, last

    def test_losowe_scenariusze_daja_te_same_operacje(self):
        rnd = random.Random(260)
        for n in range(40):
            rows, scan, dirs, failed, last = self._scenario(rnd)
            kw = dict(last_seen=last if n % 5 else None, failed_dirs=failed, root_gen="g")
            old = self.old.diff_scan_report(rows, scan, dirs, 5000, "M-FIRMA", **kw)
            new = asset_sync.diff_scan_report(rows, scan, dirs, 5000, "M-FIRMA", role="copy", **kw)
            for k in ("ops", "blocked", "skipped_unlisted", "stale_ignored", "meta_held", "conflicts",
                      "tombstone_version_mismatch", "unobserved_missing", "next_last_seen"):
                self.assertEqual(old[k], new[k], f"scenariusz {n}, pole {k}")

    def test_nowe_instrukcje_zostawiaja_stare_bez_zmian(self):
        for name in ("_SQL_UPSERT", "_SQL_TOMBSTONE", "_SQL_RESTORE", "_SQL_PULL"):
            self.assertEqual(getattr(self.old, name), getattr(asset_sync, name), name)


class NormalizeRowTests(unittest.TestCase):
    def test_pola_etapu_1a_sa_zachowane_gdy_sa_w_wierszu(self):
        base = {"asset_id": "a", "asset_key": "k", "path_rel": "k", "name": "k", "size": None, "mtime_ms": 1,
                "content_hash": None, "meta": {}, "deleted_at": None, "updated_at": 1, "updated_by": "x",
                "seen_by_machine": "x", "rev": 3}
        plain = asset_sync.normalize_row(base)
        self.assertNotIn("origin", plain)
        full = asset_sync.normalize_row({**base, "origin": "m", "master_mtime": "77", "delete_batch": "c-1-x",
                                         "author_by": None, "author_mtime": None, "master_size": None,
                                         "author_size": None})
        self.assertEqual((full["origin"], full["master_mtime"], full["delete_batch"]), ("m", 77, "c-1-x"))


if __name__ == "__main__":
    unittest.main()
