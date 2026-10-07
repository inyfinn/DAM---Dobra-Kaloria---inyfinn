# -*- coding: utf-8 -*-
"""06.10.2026: watch-file-index.py wykrywa KTORE produkty sie zmienily i przebudowuje tylko je
(build-file-index.py --only-product ... --merge-into ...), zamiast pelnego skanu ROOT po
kazdym mtime pod katalogiem produktow (26-54 min CPU na M:).

Testy bez procesow potomnych: zadnego prawdziwego buildera ani watchera (Popen podstawiony),
bez wolania prawdziwego index_supervisor / index_snapshots (modul podmieniony).
"""
from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

DESKTOP = Path(__file__).resolve().parents[1]
# Stan (statusy, blokady) NIE do prawdziwego LOCALAPPDATA/DAM/state zainstalowanej aplikacji.
os.environ.setdefault(
    "DAM_STATE_DIR", str(DESKTOP.parents[2] / "work" / "2026-10-06" / "suite-state")
)
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

# DAM_WATCHER_UNDER_TEST: kopia skryptu do testow mutacyjnych (prawdziwy plik zostaje nietkniety)
WATCHER_PATH = Path(
    os.environ.get("DAM_WATCHER_UNDER_TEST") or (DESKTOP.parent / "web" / "scripts" / "watch-file-index.py")
)


def _load_watcher_module():
    spec = importlib.util.spec_from_file_location("dam_watch_file_index_incr_under_test", WATCHER_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


def _touch(path: Path, mtime: float, data: bytes = b"x") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    os.utime(path, (mtime, mtime))


def _make_root(base: Path, t0: float = 1_780_000_000.0) -> Path:
    """DK/01 - BATONY/{A,B}, DK/02 - KULKI/C - kazdy z wariantem i plikiem w 4 - WIZKI/RGB (glebokosc 5)."""
    root = base / "DK"
    for cat, prod in (("01 - BATONY", "A"), ("01 - BATONY", "B"), ("02 - KULKI", "C")):
        _touch(root / cat / prod / "DOY - X - 6300901.00" / "4 - WIZKI" / "INTERNET-RGB" / f"{prod}-FRONT-S.png", t0)
    _flatten_dir_mtimes(root, t0)
    return root


def _flatten_dir_mtimes(root: Path, t0: float = 1_780_000_000.0) -> None:
    """Jednolity stary mtime katalogom, zeby test nie zalezal od zegara FS (katalog 'teraz' przykrylby
    kazdy sztuczny mtime pliku w max-mtime poddrzewa)."""
    for d in sorted(root.rglob("*"), key=lambda p: -len(p.parts)):
        if d.is_dir():
            os.utime(d, (t0, t0))
    os.utime(root, (t0, t0))


class ProductSnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = _load_watcher_module()

    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.base = Path(self._td.name)
        self.root = _make_root(self.base)

    def tearDown(self):
        self._td.cleanup()

    def _snap(self):
        return self.w.product_snapshot([self.root], max_depth=5)

    def _p(self, cat, prod):
        return str(self.root / cat / prod)

    def test_d_zmiana_gleboko_w_B_zwraca_dokladnie_B(self):
        before = self._snap()
        self.assertEqual(
            sorted(before),
            sorted([self._p("01 - BATONY", "A"), self._p("01 - BATONY", "B"), self._p("02 - KULKI", "C")]),
        )
        deep = self.root / "01 - BATONY" / "B" / "DOY - X - 6300901.00" / "4 - WIZKI" / "INTERNET-RGB"
        os.utime(deep / "B-FRONT-S.png", (1_780_000_900.0, 1_780_000_900.0))  # plik na glebokosci 5
        after = self._snap()
        self.assertEqual(self.w.diff_snapshots(before, after), [self._p("01 - BATONY", "B")])

    def test_odmontowany_root_to_wyjatek_a_nie_pusty_snapshot(self):
        """Pusty snapshot = 'wszystkie produkty zniknely' = pelny skan. Blad listowania ma przerwac takt."""
        gone = self.base / "nie-ma-takiego-roota"
        with self.assertRaises(OSError):
            self.w.product_snapshot([gone], 5)
        with self.assertRaises(OSError):
            self.w.snapshot_with_retry([gone], 5, attempts=2, delay=0.0)
        self.assertEqual(sorted(self.w.snapshot_with_retry([self.root], 5, attempts=2, delay=0.0)), sorted(self._snap()))

    def test_d_brak_zmian_to_pusty_diff(self):
        self.assertEqual(self.w.diff_snapshots(self._snap(), self._snap()), [])

    def test_d_rename_produktu_daje_stara_i_nowa_sciezke(self):
        before = self._snap()
        os.replace(self.root / "01 - BATONY" / "B", self.root / "01 - BATONY" / "B - F")
        changed = self.w.diff_snapshots(before, self._snap())
        self.assertEqual(sorted(changed), sorted([self._p("01 - BATONY", "B"), self._p("01 - BATONY", "B - F")]))

    def test_d_nowy_i_usuniety_produkt(self):
        before = self._snap()
        _touch(self.root / "02 - KULKI" / "D" / "DOY - X - 6300905.00" / "4 - WIZKI" / "D.png", 1_780_000_000.0)
        os.replace(self.root / "02 - KULKI" / "C", self.base / "poza-rootem-C")
        changed = self.w.diff_snapshots(before, self._snap())
        self.assertEqual(sorted(changed), sorted([self._p("02 - KULKI", "D"), self._p("02 - KULKI", "C")]))

    def test_d_zmiana_w_archiwum_kategorii_jest_osobnym_kluczem_folderu_archiwum(self):
        _touch(self.root / "01 - BATONY" / "\u2014 ARCHIWUM" / "A - X" / "V" / "4 - WIZKI" / "f.png", 1_780_000_000.0)
        _flatten_dir_mtimes(self.root)
        before = self._snap()
        os.utime(self.root / "01 - BATONY" / "\u2014 ARCHIWUM" / "A - X" / "V" / "4 - WIZKI" / "f.png",
                 (1_780_000_800.0, 1_780_000_800.0))
        changed = self.w.diff_snapshots(before, self._snap())
        # klucz = folder "produktu" pod kategoria, tu: sam folder archiwum (builder zamieni na kategorie)
        self.assertEqual(changed, [self._p("01 - BATONY", "\u2014 ARCHIWUM")])


class ChangeTrackerDebounceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = _load_watcher_module()

    def test_e_debounce_czeka_na_cisze_i_resetuje_przy_kolejnej_zmianie(self):
        base = {"p/A": 1.0, "p/B": 1.0}
        tr = self.w.ChangeTracker(base, debounce_sec=5.0)
        s1 = {"p/A": 1.0, "p/B": 2.0}
        self.assertIsNone(tr.observe(base, 0.0))            # brak zmian
        self.assertIsNone(tr.observe(s1, 1.0))               # pierwsza zmiana -> start okna ciszy
        self.assertTrue(tr.pending)
        s2 = {"p/A": 3.0, "p/B": 2.0}
        self.assertIsNone(tr.observe(s2, 4.0))               # skok w A: A liczy cisze od 4.0, B dalej od 1.0
        self.assertEqual(tr.observe(s2, 8.9), ["p/B"])       # B cicho 7.9 s -> gotowe; A 4.9 s < 5 czeka
        got = tr.observe(s2, 9.0)                            # A 5.0 s ciszy -> oba
        self.assertEqual(got, ["p/A", "p/B"])                # diff wzgledem bazy (obie zmienily sie)

    def test_e_zmiany_w_innych_produktach_nie_resetuja_cudzej_ciszy(self):
        """Ktos pracuje na M: (inny produkt zmienia sie co migawke) - klik F/X/D w produkcie A i tak
        wychodzi po debounce (pomiar 06.10.2026: globalny reset dawal 111-764 s)."""
        tr = self.w.ChangeTracker({"p/A": 1.0, "p/X": 1.0}, debounce_sec=5.0)
        tr.observe({"p/A": 2.0, "p/X": 2.0}, 0.0)
        for t in (2.0, 4.0, 6.0):
            got = tr.observe({"p/A": 2.0, "p/X": 10.0 + t}, t)  # X skacze co takt
            self.assertEqual(got, ["p/A"] if t >= 5.0 else None, f"t={t}")
        tr.mark_built({"p/A": 2.0, "p/X": 16.0}, keys=["p/A"])  # przyrost: tylko A zbudowane
        self.assertEqual(tr.baseline["p/A"], 2.0)
        self.assertEqual(tr.baseline["p/X"], 1.0)              # X nadal czeka na swoja cisze
        self.assertEqual(tr.observe({"p/A": 2.0, "p/X": 16.0}, 12.0), ["p/X"])

    def test_e_po_mark_built_baza_sie_przesuwa_i_nie_ma_powtorki(self):
        base = {"p/A": 1.0}
        tr = self.w.ChangeTracker(base, debounce_sec=2.0)
        s1 = {"p/A": 2.0}
        tr.observe(s1, 0.0)
        self.assertEqual(tr.observe(s1, 2.0), ["p/A"])
        tr.mark_built(s1)
        self.assertIsNone(tr.observe(s1, 10.0))
        self.assertFalse(tr.pending)

    def test_e_zmiana_cofnieta_do_bazy_czysci_oczekiwanie(self):
        base = {"p/A": 1.0}
        tr = self.w.ChangeTracker(base, debounce_sec=2.0)
        tr.observe({"p/A": 2.0}, 0.0)
        self.assertTrue(tr.pending)
        self.assertIsNone(tr.observe(base, 1.0))
        self.assertFalse(tr.pending)

    def test_zmiana_w_trakcie_budowy_zostaje_wykryta_po_mark_built_ze_starym_snapshotem(self):
        """Baza = snapshot z chwili wykrycia (PRZED buildem), nie po nim - zmiany z czasu
        buildu nie moga zginac (stary kod bral mtime po buildzie)."""
        tr = self.w.ChangeTracker({"p/A": 1.0}, debounce_sec=0.0)
        detected = {"p/A": 2.0}
        tr.observe(detected, 0.0)
        self.assertEqual(tr.observe(detected, 0.0), ["p/A"])
        tr.mark_built(detected)
        during_build = {"p/A": 2.0, "p/B": 5.0}
        tr.observe(during_build, 1.0)
        self.assertEqual(tr.observe(during_build, 1.0), ["p/B"])


class BaselinePersistenceTests(unittest.TestCase):
    """Zmiany z czasu, gdy watcher nie dzialal, wychodza po starcie jako roznica (przyrost),
    a nie jako pelny skan 20 s po kazdym uruchomieniu programu."""

    @classmethod
    def setUpClass(cls):
        cls.w = _load_watcher_module()

    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.tmp = Path(self._td.name)
        self.status = self.tmp / "status.json"
        self.index = self.tmp / "file-index.json"
        self.index.write_bytes(b"x" * 2048)

    def tearDown(self):
        self._td.cleanup()

    def test_zapis_i_odczyt_oraz_zgodnosc_rootow(self):
        w = self.w
        snap = {"a": 1.0, "b": 2.5}
        w.save_baseline(self.status, [Path("M:/x/DK")], snap)
        self.assertEqual(w.load_baseline(self.status, [Path("M:/x/DK")], self.index), snap)
        self.assertIsNone(w.load_baseline(self.status, [Path("M:/inny/DK")], self.index))
        self.index.write_bytes(b"x")  # indeks zbyt maly = traktuj jak brak
        self.assertIsNone(w.load_baseline(self.status, [Path("M:/x/DK")], self.index))

    def test_uszkodzony_albo_brakujacy_plik_to_none(self):
        w = self.w
        self.assertIsNone(w.load_baseline(self.status, [Path("M:/x/DK")], self.index))
        (self.tmp / "index-product-snapshot.json").write_text("{ nie json", encoding="utf-8")
        self.assertIsNone(w.load_baseline(self.status, [Path("M:/x/DK")], self.index))

    def test_zmiana_w_czasie_przerwy_daje_diff_po_restarcie(self):
        w = self.w
        root = _make_root(self.tmp)
        w.save_baseline(self.status, [root], w.product_snapshot([root], 5))
        # "aplikacja wylaczona": ktos zmienia plik w produkcie B
        deep = root / "01 - BATONY" / "B" / "DOY - X - 6300901.00" / "4 - WIZKI" / "INTERNET-RGB" / "B-FRONT-S.png"
        os.utime(deep, (1_780_000_900.0, 1_780_000_900.0))
        # start: baza z dysku, nie biezacy snapshot
        loaded = w.load_baseline(self.status, [root], self.index)
        tr = w.ChangeTracker(loaded, debounce_sec=5.0)
        cur = w.product_snapshot([root], 5)
        self.assertIsNone(tr.observe(cur, 0.0))
        self.assertEqual(tr.observe(cur, 5.0), [str(root / "01 - BATONY" / "B")])

    def test_ostatni_pelny_skan_zapisany_i_wymaga_indeksu(self):
        w = self.w
        # brak zapisu + zdrowy indeks (pierwszy start po aktualizacji) = mtime indeksu, nie pelny skan
        self.assertAlmostEqual(
            w.read_last_full_epoch(self.status, self.index), self.index.stat().st_mtime, delta=1.0
        )
        w._mark_full_scan_done(self.status)
        self.assertGreater(w.read_last_full_epoch(self.status, self.index), 1_700_000_000.0)
        self.index.unlink()
        self.assertEqual(w.read_last_full_epoch(self.status, self.index), 0.0)


class PlanAndCommandTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = _load_watcher_module()

    def test_plan_paczki_po_40_zamiast_pelnego_skanu(self):
        """07.10.2026: 41 zmian naraz = pelny skan 29,6 min. Teraz kolejne paczki przyrostowe;
        [] (pelny skan) tylko bez listy zmian albo przy wylaczonym przyroscie."""
        w = self.w
        self.assertEqual(w.plan_rebuild(["a"], max_incremental=40), [["a"]])
        for n, sizes in ((40, [40]), (41, [40, 1]), (95, [40, 40, 15])):
            changed = [str(i) for i in range(n)]
            batches = w.plan_rebuild(changed, max_incremental=40)
            self.assertEqual([len(b) for b in batches], sizes, n)
            self.assertEqual([p for b in batches for p in b], changed, n)  # nic nie ginie, kolejnosc zostaje
        self.assertEqual(w.plan_rebuild([], max_incremental=40), [])
        self.assertEqual(w.plan_rebuild(["a"], max_incremental=0), [])  # 0 = przyrost wylaczony

    def test_build_command_pelny_nie_ma_flag_przyrostu(self):
        cmd = self.w.build_command("py", ["R1"], None)
        self.assertNotIn("--only-product", cmd)
        self.assertNotIn("--merge-into", cmd)
        self.assertEqual(cmd[-2:], ["--root", "R1"])

    def test_build_command_przyrost(self):
        cmd = self.w.build_command("py", None, Path("OUT"), only_products=["P1", "P2"],
                                   merge_into=Path("OUT") / "file-index.json")
        idx = [i for i, a in enumerate(cmd) if a == "--only-product"]
        self.assertEqual([cmd[i + 1] for i in idx], ["P1", "P2"])
        self.assertEqual(cmd[cmd.index("--merge-into") + 1], str(Path("OUT") / "file-index.json"))
        self.assertEqual(cmd[cmd.index("--out-dir") + 1], str(Path("OUT")))


class FakeProc:
    def __init__(self, rc: int = 0, out: str = ""):
        self.pid = 4242
        self.stdout = io.StringIO(out)
        self._rc = rc

    def poll(self):
        return self._rc

    def wait(self, timeout=None):
        return self._rc


class RebuildChangedTests(unittest.TestCase):
    """rebuild_changed: przyrost z awaryjnym pelnym skanem, bez prawdziwych procesow."""

    @classmethod
    def setUpClass(cls):
        cls.w = _load_watcher_module()

    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.tmp = Path(self._td.name)
        self.status = self.tmp / "status.json"
        self.lock = self.tmp / "lock.json"
        self.cmds: list[list[str]] = []
        self.rcs: list[int] = []
        self.rc_for = None  # rc_for(cmd) -> kod buildu
        self.out_for = None  # out_for(cmd) -> stdout indeksera
        self.fake_ix = MagicMock()
        self.fake_ix.mark_built_here.return_value = {"ok": True}
        self.fake_cache = MagicMock()
        self.patches = [
            patch.dict(sys.modules, {"index_supervisor": None, "index_snapshots": self.fake_ix,
                                     "dam_thumb_cache": self.fake_cache}),
            patch.object(self.w.subprocess, "Popen", side_effect=self._popen),
            # atrapy powyzej sa bezpieczne: zdejmujemy bezpiecznik 'pod unittest nie publikuj miniatur'
            patch.dict(os.environ, {"DAM_ALLOW_REAL_SPAWN_IN_TESTS": "1"}),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self._td.cleanup()

    def _popen(self, cmd, **kw):
        self.cmds.append([str(c) for c in cmd])
        out = self.out_for(self.cmds[-1]) if self.out_for is not None else ""
        if self.rc_for is not None:
            return FakeProc(self.rc_for(self.cmds[-1]), out)
        return FakeProc(self.rcs.pop(0) if self.rcs else 0, out)

    def _call(self, changed, **kw):
        base = dict(lock_file=self.lock, status_file=self.status, root_args=None, out_dir=None,
                    branding_hook=False, last_duration_sec=3262.0, max_incremental=40)
        base.update(kw)
        return self.w.rebuild_changed(changed, **base)

    def test_przyrost_wola_builder_z_only_product_i_merge_into_i_oznacza_built_here(self):
        self.status.write_text(json.dumps({"last_duration_sec": 3262.0, "last_ok": True}), encoding="utf-8")
        self.rcs = [0]
        rc, kind, built = self._call(["M:/x/DK/01/B"])
        self.assertEqual((rc, kind, built), (0, "incremental", ["M:/x/DK/01/B"]))
        self.assertEqual(len(self.cmds), 1)
        cmd = self.cmds[0]
        self.assertIn("--only-product", cmd)
        self.assertEqual(cmd[cmd.index("--only-product") + 1], "M:/x/DK/01/B")
        self.assertEqual(Path(cmd[cmd.index("--merge-into") + 1]).name, "file-index.json")
        # publikacja do innych komputerow: oba pliki oznaczone jako zbudowane tu
        keys = [c.args[0] for c in self.fake_ix.mark_built_here.call_args_list]
        self.assertEqual(keys, ["file-index", "search-index"])
        self.fake_cache.start_publish_after_index.assert_called_once()
        # status: pelny czas ostatniego pelnego skanu NIE jest nadpisany czasem przyrostu
        st = json.loads(self.status.read_text(encoding="utf-8"))
        self.assertEqual(st["last_duration_sec"], 3262.0)
        self.assertEqual(st["rebuild_kind"], "incremental")
        self.assertTrue(st["last_ok"])
        self.assertEqual(st["last_incremental_products"], 1)

    def test_kod_5_buildera_wywoluje_pelny_skan_w_zastepstwie(self):
        self.rcs = [5, 0]
        rc, kind, built = self._call(["M:/x/DK/01/B"])
        self.assertEqual((rc, kind, built), (0, "full", []))
        self.assertEqual(len(self.cmds), 2)
        self.assertIn("--only-product", self.cmds[0])
        self.assertNotIn("--only-product", self.cmds[1])
        self.assertNotIn("--merge-into", self.cmds[1])

    def _only(self, cmd):
        return [cmd[i + 1] for i, a in enumerate(cmd) if a == "--only-product"]

    def test_41_i_95_zmian_to_paczki_przyrostowe_a_nie_pelny_skan(self):
        for n, sizes in ((41, [40, 1]), (95, [40, 40, 15])):
            self.cmds.clear()
            changed = [f"p{i}" for i in range(n)]
            rc, kind, built = self._call(changed)
            self.assertEqual((rc, kind, built), (0, "incremental", changed), n)
            self.assertEqual([len(self._only(c)) for c in self.cmds], sizes, n)  # zaden build bez --only-product
            self.assertTrue(all("--merge-into" in c for c in self.cmds), n)

    def test_wylaczony_przyrost_to_pelny_skan(self):
        self.rcs = [0]
        rc, kind, built = self._call(["p1"], max_incremental=0)
        self.assertEqual((rc, kind, built), (0, "full", []))
        self.assertNotIn("--only-product", self.cmds[0])

    def test_kod_5_w_drugiej_paczce_konczy_pelnym_skanem(self):
        self.rcs = [0, 5, 0]
        changed = [f"p{i}" for i in range(95)]
        rc, kind, built = self._call(changed)
        self.assertEqual((rc, kind), (0, "full"))
        self.assertEqual(built, changed[:40])
        self.assertEqual([len(self._only(c)) for c in self.cmds], [40, 40, 0])  # trzeciej paczki nie ma, jest pelny

    def test_trujacy_produkt_jest_izolowany_a_reszta_paczek_zbudowana(self):
        """S1: dawniej blad drugiej paczki konczyl serie - trzecia paczka nie ruszala w zadnej probie."""
        self.rc_for = lambda cmd: 1 if "p50" in self._only(cmd) else 0
        changed = [f"p{i}" for i in range(95)]
        rc, kind, built = self._call(changed)
        self.assertEqual((rc, kind), (1, "incremental"))
        self.assertEqual(sorted(built), sorted(p for p in changed if p != "p50"))
        self.assertTrue(all(self._only(c) for c in self.cmds))          # bez pelnego skanu
        self.assertIn(["p50"], [self._only(c) for c in self.cmds])      # blad zostal przy jednym produkcie
        self.assertLessEqual(len(self.cmds), 3 + 2 * 6)                 # 3 paczki + dzielenie 40 -> 1
        st = json.loads(self.status.read_text(encoding="utf-8"))
        self.assertEqual((st["last_incremental_products"], st["last_incremental_failed"]), (94, 1))

    def test_blad_calego_buildera_nie_mnozy_buildow_ale_probuje_kazdej_paczki(self):
        self.rc_for = lambda cmd: 1
        changed = [f"p{i}" for i in range(95)]
        rc, kind, built = self._call(changed)
        self.assertEqual((rc, kind, built), (1, "incremental", []))
        tried = {p for c in self.cmds for p in self._only(c)}
        self.assertEqual(tried, set(changed))                           # trzecia paczka tez dostala probe
        self.assertLessEqual(len(self.cmds), self.w.BATCH_MAX_FAILED_BUILDS + 6)
        self.fake_cache.start_publish_after_index.assert_not_called()
        self.fake_ix.mark_built_here.assert_not_called()

    def test_blokada_zajeta_w_srodku_serii_konczy_serie_bez_dzielenia(self):
        self.rcs = [0]
        changed = [f"p{i}" for i in range(95)]
        real = self.w.rebuild_with_lock
        calls = []

        def second_is_locked(**kw):
            calls.append(kw)
            return 2 if len(calls) == 2 else real(**kw)

        with patch.object(self.w, "rebuild_with_lock", side_effect=second_is_locked):
            rc, kind, built = self._call(changed)
        self.assertEqual((rc, kind, built), (2, "incremental", changed[:40]))
        self.assertEqual(len(calls), 2)

    def test_seria_paczek_ma_jedna_publikacje_miniatur_i_status_calej_serii(self):
        """S4: kazda paczka kolejkowala publikacje miniatur, a last_incremental_* opisywalo ostatnia paczke."""
        changed = [f"p{i}" for i in range(95)]
        rc, kind, built = self._call(changed)
        self.assertEqual((rc, kind, built), (0, "incremental", changed))
        self.fake_cache.start_publish_after_index.assert_called_once()
        st = json.loads(self.status.read_text(encoding="utf-8"))
        self.assertEqual((st["last_incremental_products"], st["last_incremental_batches"],
                          st["last_incremental_failed"]), (95, 3, 0))
        self.assertEqual((st["rebuild_kind"], st["rebuild_mode"]), ("incremental", "incremental"))

    def test_seria_paczek_ma_jedna_migawke_przebiegu_i_jeden_raport(self):
        """S4: kazda paczka przepisywala 6,8 MB index-run-snapshot.json i pisala osobny raport."""
        sup = MagicMock()
        sup.STATUS_WRITE_LOCK = threading.RLock()
        sup.read_live.return_value = {}
        sup.read_run_snapshot.return_value = {}
        sup.parse_builder_live_line.return_value = None
        sup.wait_rebuild_proc.side_effect = lambda proc, **kw: proc.wait()
        changed = [f"p{i}" for i in range(95)]
        with patch.dict(sys.modules, {"index_supervisor": sup}):
            rc, kind, built = self._call(changed)
        self.assertEqual((rc, len(built), len(self.cmds)), (0, 95, 3))
        self.assertEqual(sup.begin_run_snapshot.call_count, 1)
        self.assertEqual(sup.complete_run_report.call_count, 1)
        self.assertEqual(sup.complete_run_report.call_args.kwargs["mode"], "incremental")
        # ta sama droga wolana jako przeglad godzinny: raport ma mowic 'review', nie 'incremental'
        with patch.dict(sys.modules, {"index_supervisor": sup}):
            self._call(["p1"], stage_prefix="review")
        self.assertEqual(sup.complete_run_report.call_args.kwargs["mode"], "review")

    def test_kod_6_folder_nieosiagalny_konczy_serie_bez_dzielenia_i_bez_pelnego_skanu(self):
        """Kod 6 buildera = folder nieosiagalny (blad odczytu). Nie kod 5: pelny skan nic by nie dal."""
        self.status.write_text(json.dumps({"last_ok": True, "last_error": ""}), encoding="utf-8")
        self.rcs = [0, 6]
        changed = [f"p{i}" for i in range(95)]
        rc, kind, built = self._call(changed)
        self.assertEqual((rc, kind, built), (self.w.UNREACHABLE_RC, "incremental", changed[:40]))
        self.assertEqual([len(self._only(c)) for c in self.cmds], [40, 40])   # bez polowek, bez trzeciej, bez pelnego
        st = json.loads(self.status.read_text(encoding="utf-8"))
        self.assertEqual(st["stage"], "product:unreachable")
        self.assertTrue(st["last_ok"])                  # to nie porazka przebudowy: pulpit nie pokazuje bledu
        self.assertEqual(st["last_error"], "")

    UNCHANGED = "products=3 viz=3 elapsed=0.2s\nMERGE_UNCHANGED: wynik przyrostu identyczny ze spisem\n"

    def test_merge_unchanged_nie_oznacza_zbudowane_tutaj_nie_budzi_brandingu_ani_publikacji(self):
        """Brak zmian = brak publikacji: indekser nie zapisal spisu (MERGE_UNCHANGED, kod 0). Znacznik
        'zbudowane tutaj' zostaje, jaki byl (plik z bazy nie staje sie lokalnym), hak brandingu i publikacja
        miniatur nie ruszaja - takze przy falszywym alarmie obserwatora."""
        self.out_for = lambda cmd: self.UNCHANGED
        hook = MagicMock()
        info: dict = {}
        with patch.object(self.w, "_BRANDING_HOOK", hook), patch.object(self.w, "spawn_branding_pipeline") as spawn:
            rc, kind, built = self._call(["M:/x/DK/01/B"], branding_hook=True, info=info)
        self.assertEqual((rc, kind, built), (0, "incremental", ["M:/x/DK/01/B"]))   # stan potwierdzony
        self.assertEqual(info, {"changed_builds": 0})
        self.fake_ix.mark_built_here.assert_not_called()
        self.fake_cache.start_publish_after_index.assert_not_called()
        hook.request.assert_not_called()
        spawn.assert_not_called()
        st = json.loads(self.status.read_text(encoding="utf-8"))
        self.assertEqual((st["last_ok"], st["index_unchanged"], st["last_incremental_changed"]), (True, True, 0))

    def test_seria_w_ktorej_jedna_paczka_zmienila_spis_publikuje_raz_i_oznacza_tylko_ja(self):
        self.out_for = lambda cmd: "" if "p50" in self._only(cmd) else self.UNCHANGED
        info: dict = {}
        rc, _kind, built = self._call([f"p{i}" for i in range(95)], info=info)
        self.assertEqual((rc, len(built), info), (0, 95, {"changed_builds": 1}))
        self.assertEqual([c.args[0] for c in self.fake_ix.mark_built_here.call_args_list], ["file-index", "search-index"])
        self.fake_cache.start_publish_after_index.assert_called_once()

    def test_status_mowi_ktory_rodzaj_przebiegu_trwal(self):
        """Raport i status mialy na sztywno jeden rodzaj; teraz: incremental / review / full."""
        for kw, want in (
            (dict(), ("incremental", "incremental", "product:idle")),
            (dict(stage_prefix="review"), ("review", "review", "review:idle")),
            (dict(max_incremental=0), ("watch", "full", "product:idle")),
        ):
            self.cmds.clear()
            rc, _kind, _built = self._call(["M:/x/DK/01/B"], **kw)
            self.assertEqual(rc, 0, kw)
            st = json.loads(self.status.read_text(encoding="utf-8"))
            self.assertEqual((st["rebuild_kind"], st["rebuild_mode"], st["stage"]), want, kw)
            # przeglad godzinny idzie droga przyrostowa (bez pelnego skanu z folderem marketingu)
            self.assertEqual("--only-product" in self.cmds[0], want[1] != "full", kw)

    def test_publikacja_miniatur_pod_unittest_bez_zgody_nie_rusza(self):
        """Test, ktory dojdzie do publikacji bez atrapy, nie moze laczyc sie z magazynem na NAS."""
        with patch.dict(os.environ, {"DAM_ALLOW_REAL_SPAWN_IN_TESTS": ""}):
            self.w._publish_cache_after_index()
        self.fake_cache.start_publish_after_index.assert_not_called()

    def test_udany_build_zglasza_branding_do_haka_zamiast_startowac_potok(self):
        """Hak z debounce i powtorka (BrandingHook) zamiast potoku po kazdym przyroscie 1 pliku."""
        hook = MagicMock()
        with patch.object(self.w, "_BRANDING_HOOK", hook), \
                patch.object(self.w, "spawn_branding_pipeline") as spawn:
            rc, _kind, _built = self._call(["M:/x/DK/01/B"], branding_hook=True)
        self.assertEqual(rc, 0)
        hook.request.assert_called_once()
        spawn.assert_not_called()

    def test_blad_buildera_nie_oznacza_built_here_i_nie_robi_pelnego_skanu(self):
        self.rcs = [1]
        rc, kind, built = self._call(["M:/x/DK/01/B"])
        self.assertEqual((rc, kind, built), (1, "incremental", []))
        self.assertEqual(len(self.cmds), 1)
        self.fake_ix.mark_built_here.assert_not_called()

    def test_odrzucenie_przez_bezpiecznik_rc3_nie_uruchamia_pelnego_skanu(self):
        self.rcs = [3]
        rc, kind, _built = self._call(["M:/x/DK/01/B"])
        self.assertEqual((rc, kind), (3, "incremental"))
        self.assertEqual(len(self.cmds), 1)

    def test_lock_zajety_nic_nie_startuje(self):
        from rebuild_lock import acquire_lock

        handle, _meta = acquire_lock(self.lock, stage="manual:building", ttl_sec=600, extra={"owner": "test"})
        self.assertIsNotNone(handle)
        try:
            self.rcs = [0]
            rc, _kind, built = self._call(["M:/x/DK/01/B"])
            self.assertEqual((rc, built), (2, []))
            self.assertEqual(self.cmds, [])
        finally:
            handle.release()


if __name__ == "__main__":
    unittest.main()
