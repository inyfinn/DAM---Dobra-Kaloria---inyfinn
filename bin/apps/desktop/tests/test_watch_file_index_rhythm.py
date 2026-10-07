# -*- coding: utf-8 -*-
"""07.10.2026: zmiana w folderze produktu ma trafic do spisu w < 30 s (mediana byla 3,4 min).

Sam przyrost trwal 2-3 s; czas zjadala petla wykrywania watch-file-index.py:
- przeglad 8 katalogow brandingu (76 s na M:) w KAZDYM obiegu -> wlasny rytm i watek (BrandingHook),
- gotowosc zmiany dopiero po drugim pelnym obiegu -> ponowny pomiar tylko zmienionych produktow (settle),
- hak brandingu po kazdym przyroscie, bez debounce, zmiana gubiona przy kodzie 3 -> zbieranie + powtorka,
- czekanie na potok najwyzej 1800 s -> do konca procesu (znacznik "zbudowane tutaj" po kodzie 0),
- pelny skan z powodu zmian nie przesuwal przebiegu awaryjnego,
- log bez czasu.

Bez dysku sieciowego i bez procesow potomnych: katalog tymczasowy, zegar i builder podstawione.
"""
from __future__ import annotations

import contextlib
import importlib.util
import io
import os
import re
import sys
import tempfile
import threading
import time as real_time
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
T0 = 1_780_000_000.0


def _load_watcher_module():
    spec = importlib.util.spec_from_file_location("dam_watch_file_index_rhythm_under_test", WATCHER_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


def _touch(path: Path, mtime: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"x")
    os.utime(path, (mtime, mtime))


def _flatten_dir_mtimes(root: Path) -> None:
    """Jednolity stary mtime katalogom: katalog utworzony 'teraz' przykrylby sztuczny mtime pliku."""
    for d in sorted(root.rglob("*"), key=lambda p: -len(p.parts)):
        if d.is_dir():
            os.utime(d, (T0, T0))
    os.utime(root, (T0, T0))


def _product_file(root: Path, cat: str, prod: str) -> Path:
    return root / cat / prod / "DOY - X - 6300901.00" / "4 - WIZKI" / "INTERNET-RGB" / f"{prod}-FRONT-S.png"


def _make_root(root: Path) -> Path:
    """root/01 - BATONY/{A,B}, root/02 - KULKI/C - plik w 4 - WIZKI/RGB (glebokosc 5)."""
    for cat, prod in (("01 - BATONY", "A"), ("01 - BATONY", "B"), ("02 - KULKI", "C")):
        _touch(_product_file(root, cat, prod), T0)
    _flatten_dir_mtimes(root)
    return root


class FakeClock:
    """Podmiana modulu `time` w watcherze: sleep przesuwa zegar zamiast czekac."""

    def __init__(self, start: float = T0 + 10_000.0) -> None:
        self.now = start
        self.sleeps: list[float] = []
        self.on_sleep = lambda clock, sec: None

    def time(self) -> float:
        return self.now

    def sleep(self, sec: float) -> None:
        self.sleeps.append(sec)
        self.now += sec
        self.on_sleep(self, sec)

    def __getattr__(self, name):  # strftime, gmtime, localtime - prawdziwe
        return getattr(real_time, name)


class _TmpTree(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = _load_watcher_module()

    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.tmp = Path(self._td.name)
        self.addCleanup(self._td.cleanup)


class RootsMtimeTests(_TmpTree):
    def test_granice_jak_dawny_tree_mtime_wpisy_do_poziomu_depth_plus_1(self):
        """roots_mtime przeszedl z Path.iterdir()+stat() na os.scandir - zasieg ma zostac ten sam."""
        root = self.tmp / "BRANDING"
        _touch(root / "a" / "b" / "plik.png", T0)          # poziom 3
        _touch(root / "a" / "b" / "c" / "gleboko.png", T0)  # poziom 4
        _flatten_dir_mtimes(root)
        self.assertEqual(self.w.roots_mtime([root], max_depth=2), T0)
        os.utime(root / "a" / "b" / "c" / "gleboko.png", (T0 + 900, T0 + 900))
        self.assertEqual(self.w.roots_mtime([root], max_depth=2), T0)       # poziom 4 poza zasiegiem
        self.assertEqual(self.w.roots_mtime([root], max_depth=3), T0 + 900)
        os.utime(root / "a" / "b" / "plik.png", (T0 + 500, T0 + 500))
        self.assertEqual(self.w.roots_mtime([root], max_depth=2), T0 + 500)  # poziom 3 = depth+1
        self.assertEqual(self.w.roots_mtime([self.tmp / "nie-ma"], max_depth=2), 0.0)
        self.assertEqual(self.w.roots_mtime([], max_depth=2), 0.0)


class SettleTests(_TmpTree):
    """Debounce bez drugiego pelnego obiegu: cisza + ponowny pomiar TYLKO zmienionego produktu."""

    def setUp(self):
        super().setUp()
        self.root = _make_root(self.tmp / "DK")
        self.b = str(self.root / "01 - BATONY" / "B")
        self.b_file = _product_file(self.root, "01 - BATONY", "B")
        self.clock = FakeClock()
        p = patch.object(self.w, "time", self.clock)
        p.start()
        self.addCleanup(p.stop)

    def _snap(self):
        return self.w.product_snapshot([self.root], max_depth=5)

    def test_ustabilizowana_zmiana_jest_gotowa_po_czasie_ciszy_bez_drugiej_migawki(self):
        tracker = self.w.ChangeTracker(self._snap(), debounce_sec=5.0)
        os.utime(self.b_file, (T0 + 900, T0 + 900))
        snap = self._snap()
        with patch.object(self.w, "product_snapshot") as full_snapshot:
            ready = self.w.settle(tracker, snap, self.clock.time(), max_depth=5)
        self.assertEqual(ready, [self.b])
        self.assertEqual(self.clock.sleeps, [5.0])   # jedna cisza, nie caly obieg
        full_snapshot.assert_not_called()

    def test_zmiana_w_czasie_ciszy_odracza_do_nastepnego_obiegu(self):
        tracker = self.w.ChangeTracker(self._snap(), debounce_sec=5.0)
        os.utime(self.b_file, (T0 + 900, T0 + 900))
        self.clock.on_sleep = lambda clock, sec: os.utime(self.b_file, (T0 + 950, T0 + 950))  # kopiowanie trwa
        snap = self._snap()
        self.assertIsNone(self.w.settle(tracker, snap, self.clock.time(), max_depth=5))
        self.assertEqual(snap[self.b], T0 + 950)     # migawka poprawiona ponownym pomiarem
        self.clock.on_sleep = lambda clock, sec: None
        self.clock.sleep(2.0)                        # nastepny obieg: produkt juz cichy
        self.assertEqual(self.w.settle(tracker, self._snap(), self.clock.time(), max_depth=5), [self.b])

    def test_brak_zmian_nie_czeka(self):
        tracker = self.w.ChangeTracker(self._snap(), debounce_sec=5.0)
        self.assertIsNone(self.w.settle(tracker, self._snap(), self.clock.time(), max_depth=5))
        self.assertEqual(self.clock.sleeps, [])

    def test_usuniety_produkt_jest_gotowy_bez_pomiaru_a_zerwany_dysk_to_wyjatek(self):
        tracker = self.w.ChangeTracker(self._snap(), debounce_sec=5.0)
        os.replace(self.root / "01 - BATONY" / "B", self.tmp / "poza-rootem-B")
        self.assertEqual(self.w.settle(tracker, self._snap(), self.clock.time(), max_depth=5), [self.b])
        # zerwany dysk w czasie ciszy: kategoria nie da sie wylistowac -> OSError, a nie "produkt usuniety"
        snap = {str(self.tmp / "nie-ma-kategorii" / "X"): T0}
        with self.assertRaises(OSError):
            self.w.remeasure(snap, list(snap), 5)
        self.assertEqual(len(snap), 1)

    def test_remeasure_wyrzuca_produkt_ktorego_nie_ma_juz_w_kategorii(self):
        snap = self._snap()
        os.replace(self.root / "01 - BATONY" / "B", self.tmp / "poza-rootem-B")
        os.utime(_product_file(self.root, "01 - BATONY", "A"), (T0 + 700, T0 + 700))
        a = str(self.root / "01 - BATONY" / "A")
        self.w.remeasure(snap, [a, self.b], 5)
        self.assertNotIn(self.b, snap)
        self.assertEqual(snap[a], T0 + 700)


class BrandingHookTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = _load_watcher_module()

    def setUp(self):
        self.spawned: list = []  # on_done kolejnych uruchomien potoku
        self.reports: list = []  # pola branding_hook_* zapisywane do statusu

    def _spawn(self, on_done):
        self.spawned.append(on_done)
        return True

    def _hook(self, **kw):
        return self.w.BrandingHook(self._spawn, report=self.reports.append, **kw)

    def test_katalogi_brandingu_przegladane_wg_wlasnego_rytmu(self):
        hook = self._hook(roots=[Path("M:/branding")], interval=300.0, delay=90.0)
        mtimes = [100.0]
        with patch.object(self.w, "roots_mtime", side_effect=lambda roots, max_depth: mtimes[0]) as scan, \
                contextlib.redirect_stdout(io.StringIO()):
            for t in range(0, 300, 5):          # 60 taktow watku = 5 min
                hook.tick(float(t))
            self.assertEqual(scan.call_count, 1)  # tylko przeglad bazowy
            mtimes[0] = 200.0                     # zmiana w katalogach brandingu
            hook.tick(299.0)
            self.assertEqual(scan.call_count, 1)
            self.assertFalse(hook.tick(300.0))    # drugi przeglad: zmiana zauwazona, potok jeszcze nie
            self.assertEqual(scan.call_count, 2)
            self.assertFalse(hook.tick(389.0))
            self.assertTrue(hook.tick(390.0))     # 90 s zbierania zgloszen
        self.assertEqual(len(self.spawned), 1)

    def test_pierwszy_przeglad_to_baza_a_niedostepny_dysk_nie_wyzwala(self):
        hook = self._hook(roots=[Path("M:/branding")], interval=10.0, delay=0.0)
        with patch.object(self.w, "roots_mtime", side_effect=[500.0, 0.0, 500.0]):
            for t in (0.0, 10.0, 20.0):
                self.assertFalse(hook.tick(t))
        self.assertEqual(self.spawned, [])

    def test_zgloszenia_zbierane_w_jedno_uruchomienie(self):
        hook = self._hook(delay=90.0)
        for t in (0.0, 3.0, 40.0, 89.0):         # przyrosty produktow co chwile
            hook.request(t)
            self.assertFalse(hook.tick(t))
        self.assertTrue(hook.tick(90.0))          # liczone od PIERWSZEGO zgloszenia - bez glodzenia
        self.assertFalse(hook.tick(500.0))
        self.assertEqual(len(self.spawned), 1)

    def test_zgloszenie_w_trakcie_potoku_daje_jeden_przebieg_po_jego_koncu(self):
        hook = self._hook(delay=90.0)
        hook.request(0.0)
        self.assertTrue(hook.tick(90.0))
        hook.request(100.0)
        hook.request(700.0)
        self.assertFalse(hook.tick(1500.0))       # potok trwa 21-56 min: nie startujemy drugiego obok
        self.spawned[0](0)                        # koniec potoku, kod 0
        self.assertTrue(hook.tick(1505.0))
        self.spawned[1](0)
        self.assertFalse(hook.tick(9000.0))       # jedna powtorka, nie petla
        self.assertEqual(len(self.spawned), 2)

    def test_kod_3_blokada_zajeta_powtarza_po_odstepie_zamiast_gubic_zmiane(self):
        hook = self._hook(delay=90.0)
        hook.request(0.0)
        self.assertTrue(hook.tick(90.0))
        self.spawned[0](self.w.BRANDING_BUSY_RC)  # blokade trzyma np. most
        retry = self.w.BRANDING_BUSY_RETRY_SEC
        self.assertFalse(hook.tick(95.0))
        self.assertFalse(hook.tick(95.0 + retry - 1))
        self.assertTrue(hook.tick(95.0 + retry))
        self.spawned[1](0)
        self.assertFalse(hook.tick(95.0 + 10 * retry))
        self.assertEqual(len(self.spawned), 2)

    def test_zawieszony_potok_nie_blokuje_brandingu_na_zawsze(self):
        hook = self._hook(delay=0.0)
        hook.request(0.0)
        self.assertTrue(hook.tick(0.0))            # ten potok nigdy nie zglosi konca
        hook.request(10.0)
        stuck = self.w.BRANDING_STUCK_SEC
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertFalse(hook.tick(stuck - 1))
            self.assertTrue(hook.tick(stuck))
        self.assertEqual(len(self.spawned), 2)

    def test_potok_ktory_nie_wystartowal_jest_ponawiany_jak_blad(self):
        hook = self.w.BrandingHook(lambda on_done: False, delay=0.0)
        retry = self.w.BRANDING_FAIL_RETRY_SEC
        with contextlib.redirect_stdout(io.StringIO()):
            hook.request(0.0)
            self.assertFalse(hook.tick(0.0))          # start nieudany: zgloszenie nie moze zginac
            hook._spawn = self._spawn
            self.assertFalse(hook.tick(5.0))           # powtorka dopiero po odstepie
            self.assertFalse(hook.tick(5.0 + retry - 1))
            self.assertTrue(hook.tick(5.0 + retry))
        self.assertEqual(len(self.spawned), 1)

    def _fail_three_times(self, rc):
        hook = self._hook(delay=0.0)
        retry = self.w.BRANDING_FAIL_RETRY_SEC
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            hook.request(0.0)
            self.assertTrue(hook.tick(0.0))
            t = 0.0
            for attempt in (1, 2):
                self.spawned[-1](rc)                   # potok skonczyl sie bledem
                t += 5.0
                self.assertFalse(hook.tick(t))         # nie od razu
                self.assertFalse(hook.tick(t + retry - 1))
                t += retry
                self.assertTrue(hook.tick(t), attempt)  # powtorka po 300 s
            self.assertEqual(self.reports, [])         # jeszcze nie stan bledu
            self.spawned[-1](rc)                       # trzecia nieudana proba
            self.assertFalse(hook.tick(t + 10 * retry))  # koniec prob - nie petla
        self.assertEqual(len(self.spawned), self.w.BRANDING_MAX_TRIES)
        self.assertEqual(self.reports[-1]["branding_hook_state"], "failed")
        self.assertEqual(self.reports[-1]["branding_hook_rc"], rc)
        self.assertIn("3 nieudane proby", self.reports[-1]["branding_hook_error"])
        self.assertIn("rezygnuje", out.getvalue())
        return hook, t + 10 * retry

    def test_kod_1_blad_potoku_powtarza_po_odstepie_najwyzej_3_proby_potem_stan_bledu(self):
        hook, t = self._fail_three_times(1)
        hook.request(t + 1)                            # kolejna niezalezna zmiana: licznik od nowa
        self.assertTrue(hook.tick(t + 1))
        self.spawned[-1](0)
        self.assertEqual(self.reports[-1], {"branding_hook_state": "ok", "branding_hook_rc": 0, "branding_hook_error": ""})

    def test_rc_none_po_bledzie_czekania_tez_powtarza(self):
        self._fail_three_times(None)

    def test_koniec_starego_potoku_nie_zeruje_stanu_nowego(self):
        """N2: po BRANDING_STUCK_SEC rusza kolejny potok; stary, konczac sie pozniej, nie moze go 'zakonczyc'."""
        hook = self._hook(delay=0.0)
        stuck = self.w.BRANDING_STUCK_SEC
        with contextlib.redirect_stdout(io.StringIO()):
            hook.request(0.0)
            self.assertTrue(hook.tick(0.0))            # potok 1 (zawisl)
            hook.request(10.0)
            self.assertTrue(hook.tick(stuck))          # potok 2
            self.spawned[0](0)                         # potok 1 jednak sie skonczyl
            hook.request(stuck + 10)
            self.assertFalse(hook.tick(stuck + 20))    # potok 2 nadal trwa - nie startujemy trzeciego obok
            self.spawned[1](0)
            self.assertTrue(hook.tick(stuck + 30))
        self.assertEqual(len(self.spawned), 3)


class BrandingWaitTests(unittest.TestCase):
    """_wait_and_mark: czeka do konca procesu (bez 1800 s) i oznacza 'zbudowane tutaj' po kodzie 0."""

    @classmethod
    def setUpClass(cls):
        cls.w = _load_watcher_module()

    def _run(self, rc: int):
        proc = MagicMock()
        proc.pid = 4242
        proc.wait.return_value = rc
        fake_ix = MagicMock()
        fake_ix.mark_built_here.return_value = {"ok": True}
        fake_bp = MagicMock()
        fake_bp.resolve_script_python.return_value = "py"
        done: list = []
        finished = threading.Event()

        def on_done(code):
            done.append(code)
            finished.set()

        # Popen podstawiony PRZED zdjeciem bezpiecznika testowego: zaden prawdziwy potok nie rusza.
        with patch.object(self.w.subprocess, "Popen", return_value=proc) as popen, \
                patch.dict(sys.modules, {"index_snapshots": fake_ix, "branding_publish": fake_bp}), \
                patch.dict(os.environ, {"DAM_ALLOW_REAL_SPAWN_IN_TESTS": "1"}), \
                contextlib.redirect_stdout(io.StringIO()):
            started = self.w.spawn_branding_pipeline(on_done=on_done)
            self.assertTrue(finished.wait(10))
        self.assertTrue(started)
        popen.assert_called_once()
        proc.wait.assert_called_once_with()  # bez timeout: skan brandingu trwa 21-56 min
        return done, [c.args[0] for c in fake_ix.mark_built_here.call_args_list]

    def test_kod_0_oznacza_oba_indeksy_i_zglasza_koniec(self):
        done, marked = self._run(0)
        self.assertEqual(done, [0])
        self.assertEqual(marked, ["branding-search-index", "campaigns"])

    def test_kod_3_nie_oznacza_ale_zglasza_koniec(self):
        done, marked = self._run(3)
        self.assertEqual(done, [3])
        self.assertEqual(marked, [])

    def test_start_potoku_dopisuje_pola_haka_i_nie_zmienia_stage(self):
        """S3: watek brandingu nadpisywal caly status (stage "branding_hook_spawned") takze w trakcie
        przebudowy produktow - pulpit gubil postep, bo bieg rozpoznaje po stage."""
        import json

        with tempfile.TemporaryDirectory() as td:
            status = Path(td) / "status.json"
            status.write_text(json.dumps({"stage": "product:building", "rebuild_kind": "incremental",
                                          "progress_pct": 40, "last_ok": True}), encoding="utf-8")
            proc = MagicMock()
            proc.pid = 4242
            proc.wait.return_value = 0
            fake_bp = MagicMock()
            fake_bp.resolve_script_python.return_value = "py"
            finished = threading.Event()
            with patch.object(self.w.subprocess, "Popen", return_value=proc), \
                    patch.dict(sys.modules, {"index_snapshots": MagicMock(), "branding_publish": fake_bp,
                                             "index_supervisor": None}), \
                    patch.dict(os.environ, {"DAM_ALLOW_REAL_SPAWN_IN_TESTS": "1"}), \
                    contextlib.redirect_stdout(io.StringIO()):
                self.assertTrue(self.w.spawn_branding_pipeline(status_file=status, on_done=lambda rc: finished.set()))
                self.assertTrue(finished.wait(10))
                st = json.loads(status.read_text(encoding="utf-8"))
                self.assertEqual((st["stage"], st["rebuild_kind"], st["progress_pct"]),
                                 ("product:building", "incremental", 40))
                self.assertEqual((st["branding_hook_pid"], st["branding_hook_state"]), (4242, "running"))
                # petla glowna pisze caly status od nowa - pola haka maja to przezyc
                self.w._write_status(status, {"ok": True, "stage": "product:idle"})
                st = json.loads(status.read_text(encoding="utf-8"))
                self.assertEqual((st["stage"], st["branding_hook_pid"]), ("product:idle", 4242))

    def test_pod_unittest_bez_zgody_potok_nie_startuje(self):
        with patch.object(self.w.subprocess, "Popen") as popen, contextlib.redirect_stdout(io.StringIO()):
            self.assertFalse(self.w.spawn_branding_pipeline())
        popen.assert_not_called()


class ScanPaceTests(unittest.TestCase):
    """B2: 8 watkow z przerwa 2 s = odczyty dysku sieciowego przez ok. 70% czasu na kazdym komputerze."""

    @classmethod
    def setUpClass(cls):
        cls.w = _load_watcher_module()

    def test_przerwa_to_dwukrotnosc_ostatniej_migawki_a_czas_od_jej_konca_sie_liczy(self):
        pace = self.w.ScanPace(workers=4, slow_sec=30.0)
        self.assertEqual(pace.pause(2.0, 50.0), 2.0)       # przed pierwsza migawka: sam --interval
        pace.record(6.0, 100.0)
        self.assertEqual(pace.pause(2.0, 100.0), 12.0)     # migawki najwyzej 1/3 czasu
        self.assertEqual(pace.pause(2.0, 107.0), 5.0)      # 7 s ciszy/przebudowy juz minelo
        self.assertEqual(pace.pause(2.0, 130.0), 2.0)      # nigdy ponizej --interval
        pace.record(0.4, 200.0)
        self.assertEqual(pace.pause(2.0, 200.0), 2.0)      # szybki dysk lokalny: jak dotad

    def test_blad_albo_wolna_migawka_to_jeden_watek_a_czyste_migawki_przywracaja(self):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            pace = self.w.ScanPace(workers=4, slow_sec=30.0)
            pace.record(5.0, 10.0, errors=1)
            self.assertEqual(pace.workers, 1)
            for i in range(self.w.SNAPSHOT_RECOVER_ROUNDS - 1):
                pace.record(5.0, 20.0 + i)
            self.assertEqual(pace.workers, 1)              # za wczesnie
            pace.record(5.0, 30.0)
            self.assertEqual(pace.workers, 2)
            for i in range(self.w.SNAPSHOT_RECOVER_ROUNDS):
                pace.record(5.0, 40.0 + i)
            self.assertEqual(pace.workers, 4)
            for i in range(3 * self.w.SNAPSHOT_RECOVER_ROUNDS):
                pace.record(5.0, 60.0 + i)
            self.assertEqual(pace.workers, 4)              # nie ponad ustawienie
            pace.record(31.0, 100.0)                       # migawka ponad limit czasu
            self.assertEqual(pace.workers, 1)
            pace.backoff("x")
            self.assertEqual(pace.workers, 1)
        self.assertEqual(out.getvalue().count("do 1 watku"), 2)  # log tylko przy zejsciu, nie co obieg

    def test_domyslnie_4_watki_a_smiec_w_zmiennej_nie_wywraca_importu(self):
        with patch.dict(os.environ):
            os.environ.pop("DAM_INDEX_SNAPSHOT_WORKERS", None)
            self.assertEqual(_load_watcher_module().SNAPSHOT_WORKERS, 4)
            for raw, want in (("osiem", 4), ("", 4), ("inf", 4), ("nan", 4), ("2", 2), ("0", 1), ("99", 16)):
                os.environ["DAM_INDEX_SNAPSHOT_WORKERS"] = raw
                self.assertEqual(_load_watcher_module().SNAPSHOT_WORKERS, want, raw)
            os.environ["DAM_INDEX_DEBOUNCE_SEC"] = "kwadrans"
            self.assertEqual(self.w._env_num("DAM_INDEX_DEBOUNCE_SEC", 15.0), 15.0)

    def test_migawka_uzywa_podanej_liczby_watkow(self):
        seen: list[int] = []
        real = self.w.ThreadPoolExecutor

        def pool(max_workers=None):
            seen.append(max_workers)
            return real(max_workers=max_workers)

        with tempfile.TemporaryDirectory() as td, patch.object(self.w, "ThreadPoolExecutor", side_effect=pool):
            root = _make_root(Path(td) / "DK")
            self.w.product_snapshot([root], max_depth=5, workers=1)
            self.w.product_snapshot([root], max_depth=5)
        self.assertEqual(seen, [1, self.w.SNAPSHOT_WORKERS])


class _FailingRead:
    """Podmiana os.stat / os.scandir w watcherze: wskazane sciezki 'chwilowo nieczytelne' (zerwane SMB)."""

    def __init__(self, w):
        self.w = w
        self.stat_fail: set[str] = set()
        self.scandir_fail: set[str] = set()
        self._stat, self._scandir = os.stat, os.scandir

    def stat(self, path, *a, **kw):
        if os.fspath(path) in self.stat_fail:
            raise OSError(64, "The specified network name is no longer available", os.fspath(path))
        return self._stat(path, *a, **kw)

    def scandir(self, path="."):
        if os.fspath(path) in self.scandir_fail:
            raise OSError(64, "The specified network name is no longer available", os.fspath(path))
        return self._scandir(path)

    def __enter__(self):
        self._p = [patch.object(self.w.os, "stat", side_effect=self.stat),
                   patch.object(self.w.os, "scandir", side_effect=self.scandir)]
        for p in self._p:
            p.start()
        return self

    def __exit__(self, *exc):
        for p in self._p:
            p.stop()


class ReadErrorTests(_TmpTree):
    """B3: chwilowo nieczytelny folder produktu dawal mtime 0.0 = 'zmiana' -> --only-product -> builder
    (not prod_dir.is_dir()) USUWAL produkt ze spisu, a komputer-wlasciciel to publikowal."""

    def setUp(self):
        super().setUp()
        self.root = _make_root(self.tmp / "DK")
        self.b = str(self.root / "01 - BATONY" / "B")
        self.b_file = _product_file(self.root, "01 - BATONY", "B")
        self.clock = FakeClock()
        p = patch.object(self.w, "time", self.clock)
        p.start()
        self.addCleanup(p.stop)

    def test_nieczytelny_produkt_zachowuje_poprzednia_wartosc_i_trafia_na_liste(self):
        base = self.w.product_snapshot([self.root], max_depth=5)
        for kind in ("stat_fail", "scandir_fail"):
            with _FailingRead(self.w) as io_fail:
                getattr(io_fail, kind).add(self.b)
                bad: set[str] = set()
                snap = self.w.product_snapshot([self.root], max_depth=5, prev=base, unreadable=bad)
                self.assertEqual(snap, base, kind)             # brak roznicy = brak przebudowy
                self.assertEqual(bad, {self.b}, kind)
                fresh = self.w.product_snapshot([self.root], max_depth=5)
                self.assertNotIn(self.b, fresh, kind)          # bez `prev`: wpisu nie ma, NIGDY 0.0
                self.assertNotIn(0.0, fresh.values(), kind)

    def test_blad_glebiej_w_produkcie_nie_wylacza_go_z_odswiezania(self):
        with _FailingRead(self.w) as io_fail:
            io_fail.scandir_fail.add(str(self.b_file.parent))   # trwale niedostepny podfolder
            bad: set[str] = set()
            snap = self.w.product_snapshot([self.root], max_depth=5, unreadable=bad)
        self.assertIn(self.b, snap)
        self.assertEqual(bad, set())

    def test_produkt_nieczytelny_w_czasie_ciszy_nie_jest_gotowy_a_po_powrocie_dysku_tak(self):
        tracker = self.w.ChangeTracker(self.w.product_snapshot([self.root], max_depth=5), debounce_sec=5.0)
        os.utime(self.b_file, (T0 + 900, T0 + 900))
        with _FailingRead(self.w) as io_fail:
            self.clock.on_sleep = lambda clock, sec: io_fail.stat_fail.add(self.b)   # dysk znika w czasie ciszy
            bad: set[str] = set()
            snap = self.w.product_snapshot([self.root], max_depth=5, prev=tracker.seen, unreadable=bad)
            self.assertIsNone(self.w.settle(tracker, snap, self.clock.time(), max_depth=5, unreadable=bad))
            self.assertEqual(bad, {self.b})
            # kolejny obieg, folder nadal nieczytelny: nadal nic (dawniej: gotowy do przebudowy)
            self.clock.on_sleep = lambda clock, sec: None
            self.clock.sleep(20.0)
            bad = set()
            snap = self.w.product_snapshot([self.root], max_depth=5, prev=tracker.seen, unreadable=bad)
            self.assertIsNone(self.w.settle(tracker, snap, self.clock.time(), max_depth=5, unreadable=bad))
        self.clock.sleep(2.0)                                   # dysk wrocil
        bad = set()
        snap = self.w.product_snapshot([self.root], max_depth=5, prev=tracker.seen, unreadable=bad)
        self.assertEqual(self.w.settle(tracker, snap, self.clock.time(), max_depth=5, unreadable=bad), [self.b])
        self.assertEqual(bad, set())


class QuietLimitTests(unittest.TestCase):
    """S2: cisza 15 s (5 s trafialo na plik w polowie zapisu) i gorny limit czekania."""

    @classmethod
    def setUpClass(cls):
        cls.w = _load_watcher_module()

    def test_domyslna_cisza_15_s_i_limit_5_minut(self):
        tr = self.w.ChangeTracker({"p/A": 1.0})
        self.assertEqual((tr.debounce, tr.max_wait), (15.0, 300.0))
        self.assertIsNone(tr.observe({"p/A": 2.0}, 100.0))
        self.assertIsNone(tr.observe({"p/A": 2.0}, 114.0))
        self.assertEqual(tr.observe({"p/A": 2.0}, 115.0), ["p/A"])

    def test_produkt_zmieniany_bez_konca_idzie_do_przebudowy_po_limicie(self):
        tr = self.w.ChangeTracker({"p/A": 1.0, "p/B": 1.0}, debounce_sec=15.0, max_wait_sec=300.0)
        t, val = 1000.0, 1.0
        while t < 1000.0 + 290.0:                          # zapis co 10 s: ciszy 15 s nie ma nigdy
            val += 1.0
            self.assertIsNone(tr.observe({"p/A": val, "p/B": 1.0}, t), t)
            t += 10.0
        val += 1.0
        self.assertEqual(tr.observe({"p/A": val, "p/B": 1.0}, 1300.0), ["p/A"])
        tr.mark_built({"p/A": val, "p/B": 1.0}, keys=["p/A"])
        self.assertIsNone(tr.observe({"p/A": val + 1, "p/B": 1.0}, 1310.0))   # nowa zmiana: limit od nowa
        self.assertIsNone(tr.observe({"p/A": val + 2, "p/B": 1.0}, 1320.0))

    def test_limit_0_wylacza_gorna_granice(self):
        tr = self.w.ChangeTracker({"p/A": 1.0}, debounce_sec=15.0, max_wait_sec=0.0)
        for i in range(100):
            self.assertIsNone(tr.observe({"p/A": 2.0 + i}, 1000.0 + 10.0 * i))


class LogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = _load_watcher_module()

    def test_linia_logu_ma_znacznik_czasu_utc(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.w._log("[watch] product change: 1 folder(s) [B]; rebuild...")
        self.assertRegex(out.getvalue(), r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ \[watch\] product change: 1 folder")

    def test_nazwa_spoza_kodowania_konsoli_nie_wywraca_watchera(self):
        raw = io.BytesIO()
        cp1250 = io.TextIOWrapper(raw, encoding="cp1250", errors="strict")  # tak pisze watcher do logu
        with contextlib.redirect_stdout(cp1250):
            self.w._log("[watch] product change: 1 folder(s) [BATON → Ж]; rebuild...")
        cp1250.flush()
        self.assertIn(b"[BATON \\u2192 \\u0416]", raw.getvalue())

    def test_zaden_komunikat_watchera_nie_idzie_golym_print(self):
        src = WATCHER_PATH.read_text(encoding="utf-8")
        self.assertIsNone(re.search(r'print\(\s*f?"\[watch\]', src))


class StateDirProbeTests(_TmpTree):
    """Sonda zapisu katalogu stanu: nazwa unikalna, a nieudane sprzatanie nie spycha do katalogu zapasowego."""

    def test_sonda_ma_unikalna_nazwe_i_blad_kasowania_nie_zmienia_katalogu(self):
        state = self.tmp / "state"
        with patch.dict(os.environ, {"DAM_STATE_DIR": str(state)}), \
                patch.object(Path, "unlink", side_effect=PermissionError("inny proces")):
            self.assertEqual(self.w._state_dir(), state)
        left = [p.name for p in state.iterdir()]
        self.assertEqual(len(left), 1)
        self.assertRegex(left[0], rf"^\.write-probe-{os.getpid()}-[0-9a-f]{{8}}$")


class _Stop(Exception):
    pass


class _LoopBase(_TmpTree):
    """Cala petla main() na katalogu tymczasowym: zegar podstawiony, builder to atrapa."""

    def setUp(self):
        super().setUp()
        self.base = self.tmp / "Marketing"
        self.dk = _make_root(self.base / "- POLSKA" / "01 - PRODUKTY" / "- DK")
        self.branding_root = self.base / "- POLSKA" / "04 - PROCESY"
        self.branding_root.mkdir(parents=True)
        self.data = self.tmp / "data"
        self.data.mkdir()
        self.index = self.data / "file-index.json"
        self.index.write_bytes(b"x" * 2048)
        self.b = str(self.dk / "01 - BATONY" / "B")
        self.b_file = _product_file(self.dk, "01 - BATONY", "B")
        self.clock = FakeClock()
        self.calls: list[dict] = []
        self.rcs: list[int] = []
        self.rc_for = None  # rc_for(kw) -> kod buildu
        self.unchanged_for = None  # unchanged_for(kw) -> czy indekser wypisal MERGE_UNCHANGED
        self.snap_cost = 0.0  # ile sekund 'trwa' jedna migawka
        self.finished: list[dict] = []
        self.finish_result = None  # co zwraca _finish_run (raport przebiegu)
        self.io_fail = None
        self.snapshots = 0
        self.log = io.StringIO()

    def _rebuild(self, **kw):
        self.calls.append({"stage": kw.get("stage_prefix", "product"), "only": kw.get("only_products"),
                           "at": self.clock.now, "snapshots": self.snapshots,
                           "begin": kw.get("begin_run", True), "end": kw.get("end_run", True),
                           "hook": kw.get("branding_hook")})
        if self.unchanged_for is not None and kw.get("result") is not None:
            kw["result"]["unchanged"] = bool(self.unchanged_for(kw))
        if self.rc_for is not None:
            return self.rc_for(kw)
        return self.rcs.pop(0) if self.rcs else 0

    def _run(self, on_round, rounds: int, *extra_args: str):
        """on_round(n) przed n-tym obiegiem petli (n od 1); po `rounds` obiegach petla jest przerywana."""
        w = self.w
        seen = [0]

        def on_sleep(clock, sec):
            if sec == 5.0:      # cisza w settle (--debounce 5); kazdy inny sleep = przerwa miedzy obiegami
                return
            seen[0] += 1
            if seen[0] > rounds:
                raise _Stop()
            on_round(seen[0])

        self.clock.on_sleep = on_sleep
        real_snapshot = w.product_snapshot

        def counting_snapshot(*a, **kw):
            self.snapshots += 1
            self.clock.now += self.snap_cost
            return real_snapshot(*a, **kw)

        self.io_fail = _FailingRead(w)

        argv = ["watch-file-index.py", "--no-initial", "--interval", "2", "--debounce", "5",
                "--hourly", "21600", "--first-delay", "20", "--review", "0",
                "--status-file", str(self.tmp / "status.json"), "--lock-file", str(self.tmp / "lock.json"),
                *extra_args]
        with patch.object(sys, "argv", argv), \
                patch.object(w, "time", self.clock), \
                patch.object(w, "resolve_marketing_base", return_value=self.base), \
                patch.object(w, "WEB_DATA", self.data), \
                patch.object(w, "rebuild_with_lock", side_effect=self._rebuild), \
                patch.object(w, "product_snapshot", side_effect=counting_snapshot), \
                patch.object(w, "roots_mtime") as self.roots_scan, \
                patch.object(w, "_start_branding_watch") as self.start_watch, \
                patch.object(w, "_snoozed", return_value=False), \
                patch.object(w, "_BRANDING_HOOK", None), \
                patch.object(w, "_finish_run", create=True,
                             side_effect=lambda **kw: (self.finished.append(kw), self.finish_result)[1]), \
                self.io_fail, \
                contextlib.redirect_stdout(self.log):
            with self.assertRaises(_Stop):
                w.main()

    def _add_products(self, total: int) -> list[str]:
        """Dopelnij drzewo do `total` produktow (3 juz sa); zwraca posortowane sciezki wszystkich."""
        for i in range(total - 3):
            _touch(_product_file(self.dk, "03 - PRZEGLAD", f"P{i:02d}"), T0)
        _flatten_dir_mtimes(self.dk)
        return sorted(str(p) for cat in self.dk.iterdir() for p in cat.iterdir())

    def _change_b_before_round_1(self, n):
        if n == 1:
            os.utime(self.b_file, (T0 + 900, T0 + 900))


class MainLoopTests(_LoopBase):
    def test_zmiana_daje_przebudowe_po_czasie_ciszy_bez_drugiego_pelnego_obiegu(self):
        os.utime(self.index, (self.clock.now - 3600, self.clock.now - 3600))  # pelny skan godzine temu
        self._run(self._change_b_before_round_1, 2)
        self.assertEqual([(c["stage"], c["only"]) for c in self.calls], [("product", [self.b])])
        # migawki: 1 na starcie + 1 w obiegu, w ktorym zmiana zostala zauwazona - bez czekania na kolejna
        self.assertEqual(self.calls[0]["snapshots"], 2)
        self.assertEqual(self.clock.sleeps[:2], [2.0, 5.0])  # obieg, cisza -> build
        self.assertRegex(self.log.getvalue(), r"(?m)^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ \[watch\] product change: 1 folder")

    def test_obieg_produktow_nie_przeglada_brandingu_a_hak_dostaje_wlasny_rytm(self):
        os.utime(self.index, (self.clock.now - 3600, self.clock.now - 3600))
        self._run(self._change_b_before_round_1, 6, "--branding-interval", "120", "--branding-delay", "75")
        self.assertEqual(len(self.calls), 1)
        self.roots_scan.assert_not_called()      # 6 obiegow i przebudowa: ani jednego przegladu brandingu
        self.start_watch.assert_called_once()
        hook = self.start_watch.call_args.args[0]
        self.assertIsInstance(hook, self.w.BrandingHook)
        self.assertEqual((hook.interval, hook.delay, hook.roots), (120.0, 75.0, [self.branding_root]))

    def test_domyslny_rytm_brandingu_to_5_minut(self):
        os.utime(self.index, (self.clock.now - 3600, self.clock.now - 3600))
        self._run(lambda n: None, 1)
        hook = self.start_watch.call_args.args[0]
        self.assertEqual((hook.interval, hook.delay), (300.0, 90.0))
        self.assertEqual(self.calls, [])

    def test_kod_5_daje_pelny_skan_ktory_przesuwa_przebieg_awaryjny(self):
        """Pelny skan sprzed 5 h; zmiana -> przyrost kod 5 -> pelny skan. Przebieg awaryjny (6 h) ma sie
        liczyc od TEGO skanu: po 2 h jeszcze nie, po kolejnych 5 h tak."""
        os.utime(self.index, (self.clock.now - 5 * 3600, self.clock.now - 5 * 3600))
        self.rcs = [5, 0]

        def on_round(n):
            self._change_b_before_round_1(n)
            if n == 2:
                self.clock.now += 2 * 3600
            if n == 3:
                self.clock.now += 5 * 3600

        self._run(on_round, 3)
        self.assertEqual([(c["stage"], c["only"]) for c in self.calls],
                         [("product", [self.b]), ("product", None), ("hourly", None)])
        full_at, hourly_at = self.calls[1]["at"], self.calls[2]["at"]
        self.assertGreaterEqual(hourly_at - full_at, 6 * 3600)

    def test_przerwa_miedzy_obiegami_rosnie_z_czasem_migawki(self):
        """B2 w petli: migawka 6 s -> 12 s przerwy (dawniej stale 2 s = dysk pod odczytem 75% czasu)."""
        os.utime(self.index, (self.clock.now - 3600, self.clock.now - 3600))
        self.snap_cost = 6.0
        self._run(lambda n: None, 3)
        self.assertEqual(self.clock.sleeps[:4], [2.0, 12.0, 12.0, 12.0])
        self.assertEqual(self.calls, [])

    def test_nieczytelny_folder_produktu_nie_idzie_do_przebudowy(self):
        """B3 w petli: stat folderu produktu pada (produkt istnieje) - zadnej przebudowy, spis bez zmian."""
        os.utime(self.index, (self.clock.now - 3600, self.clock.now - 3600))

        def on_round(n):
            if n == 1:
                self.io_fail.stat_fail.add(self.b)      # zerwane SMB na folderze produktu B
            if n == 5:
                self.io_fail.stat_fail.clear()          # dysk wrocil, nic sie nie zmienilo

        self._run(on_round, 7)
        self.assertEqual(self.calls, [])
        out = self.log.getvalue()
        self.assertEqual(out.count("nieczytelne foldery produktow: 1 [B]"), 1)   # raz, nie co obieg
        self.assertIn("do 1 watku", out)                                          # blad odczytu = wycofanie watkow
        self.assertNotIn("product change", out)

    def test_trujacy_produkt_ma_wlasna_zwloke_limit_prob_i_nie_wstrzymuje_innych(self):
        """S1 w petli: B zawsze pada. Zmiana w C nie czeka na B; B ma 3 proby, potem raport i spokoj."""
        os.utime(self.index, (self.clock.now - 3600, self.clock.now - 3600))
        c = str(self.dk / "02 - KULKI" / "C")
        c_file = _product_file(self.dk, "02 - KULKI", "C")
        self.rc_for = lambda kw: 1 if self.b in (kw.get("only_products") or []) else 0

        def on_round(n):
            if n == 1:
                os.utime(self.b_file, (T0 + 900, T0 + 900))
            if n == 2:
                os.utime(c_file, (T0 + 950, T0 + 950))
            if n in (4, 6, 8, 10):
                self.clock.now += self.w.PRODUCT_RETRY_SEC + 1

        self._run(on_round, 12)
        only = [call["only"] for call in self.calls]
        self.assertEqual(only, [[self.b], [c], [self.b], [self.b]])
        self.assertLess(self.calls[1]["at"] - self.calls[0]["at"], 30.0)   # C nie czekalo na zwloke B
        self.assertGreaterEqual(self.calls[2]["at"] - self.calls[0]["at"], self.w.PRODUCT_RETRY_SEC)
        self.assertIn("1 produkt(ow) po 3 nieudanych przebudowach [B]", self.log.getvalue())
        import json

        st = json.loads((self.tmp / "status.json").read_text(encoding="utf-8"))
        self.assertEqual(st["index_failed_products"], [self.b])

    def test_kod_6_folder_nieosiagalny_ponawia_po_zwloce_bez_liczenia_prob_i_bez_pelnego_skanu(self):
        """Builder (kod 6) nie dosiegnal folderu: to stan dysku. Ta sama zmiana wraca po zwloce tyle razy,
        ile trzeba; produkt nie jest spisywany na straty po 3 probach, a liczba watkow spada do 1."""
        os.utime(self.index, (self.clock.now - 3600, self.clock.now - 3600))
        answers = [6, 6, 6, 6, 0]
        self.rc_for = lambda kw: answers.pop(0)

        def on_round(n):
            if n == 1:
                os.utime(self.b_file, (T0 + 900, T0 + 900))
            if n in (3, 5, 7, 9):
                self.clock.now += 61

        self._run(on_round, 11)
        self.assertEqual([(c["stage"], c["only"]) for c in self.calls], [("product", [self.b])] * 5)
        gaps = [b["at"] - a["at"] for a, b in zip(self.calls, self.calls[1:])]
        self.assertTrue(all(g >= 60 for g in gaps), gaps)
        out = self.log.getvalue()
        self.assertNotIn("nieudanych przebudowach", out)
        self.assertNotIn("pelny skan ROOT", out)
        self.assertIn("builder: folder nieosiagalny (kod 6) - schodze z 4 do 1 watku", out)
        self.assertIn("rebuild OK (przyrost; 1 produktow przyrostowo)", out)
        import json

        st = json.loads((self.tmp / "status.json").read_text(encoding="utf-8"))
        self.assertTrue(st["index_unreachable_at"])
        self.assertNotIn("index_failed_products", st)

    def test_falszywy_alarm_bez_zmian_w_spisie_nie_publikuje_i_nie_wraca(self):
        """Zmiana daty bez zmiany tresci (falszywy alarm): indekser odpowiada MERGE_UNCHANGED. Produkt jest
        'zbudowany' (baza zmian sie przesuwa - alarm nie wraca co obieg), ale publikacji miniatur nie ma."""
        os.utime(self.index, (self.clock.now - 3600, self.clock.now - 3600))
        self.unchanged_for = lambda kw: True
        self._run(self._change_b_before_round_1, 5)
        self.assertEqual([c["only"] for c in self.calls], [[self.b]])              # raz, nie co obieg
        self.assertEqual([(f["report"], f["publish"]) for f in self.finished], [(True, False)])
        self.assertIn("bez zmian w spisie - nic nie zapisano", self.log.getvalue())


class HourlyReviewTests(_LoopBase):
    """Decyzja wlasciciela 07.10.2026: indeks co godzine. Przeglad godzinny = wszystkie produkty przez
    przebudowe przyrostowa w paczkach, z wykrywaniem zmian miedzy paczkami; pelny skan zostaje co 6 h."""

    REVIEW = ("--review", "3600", "--first-delay", "0")

    def setUp(self):
        super().setUp()
        self.prods = self._add_products(95)
        os.utime(self.index, (self.clock.now - 3700, self.clock.now - 3700))   # pelny skan ponad godzine temu

    def _status(self) -> dict:
        import json

        return json.loads((self.tmp / "status.json").read_text(encoding="utf-8"))

    def test_przeglad_dzieli_95_produktow_na_paczki_przyrostowe_i_zamyka_sie_raz(self):
        self._run(lambda n: None, 8, *self.REVIEW)
        self.assertEqual([c["stage"] for c in self.calls], ["review"] * 3)      # zadnego pelnego skanu
        self.assertEqual([len(c["only"]) for c in self.calls], [40, 40, 15])
        self.assertEqual([p for c in self.calls for p in c["only"]], self.prods)
        # jedna migawka przebiegu na poczatku; raport i publikacja miniatur raz, na koncu
        self.assertEqual([(c["begin"], c["end"]) for c in self.calls], [(True, False), (False, False), (False, False)])
        reports = [f for f in self.finished if f["report"]]
        self.assertEqual(len(reports), 1)
        self.assertEqual((reports[0]["mode"], reports[0]["publish"], reports[0]["ok"]), ("review", True, True))
        self.assertIs(self.finished[-1], reports[0])
        self.assertEqual([f["publish"] for f in self.finished[:-1]], [False] * 3)
        # paczki w kolejnych obiegach petli - miedzy nimi jest migawka (wykrywanie zmian)
        self.assertEqual([c["snapshots"] for c in self.calls], [2, 3, 4])
        out = self.log.getvalue()
        self.assertIn("przeglad godzinny: 95 produktow w 3 paczkach", out)
        self.assertIn("przeglad godzinny OK: 95/95 produktow, 3 paczek, 0 nieudanych, 0 pominietych, zmian w spisie 0", out)
        st = self._status()
        self.assertEqual((st["last_review_products"], st["last_review_failed"], st["last_review_skipped"]), (95, 0, 0))
        self.assertGreater(self.w.read_last_review_epoch(self.tmp / "status.json"), 0)
        # plik index-last-full.json zalozyl dopiero przeglad (bez finished_epoch): po restarcie programu
        # ostatni pelny skan to nadal czas indeksu, a nie 0 = 'pelny skan 20 s po starcie'
        self.assertTrue((self.tmp / "index-last-full.json").is_file())
        self.assertEqual(self.w.read_last_full_epoch(self.tmp / "status.json", self.index), self.index.stat().st_mtime)

    def test_zmiana_wykryta_miedzy_paczkami_jest_budowana_przed_kolejna_paczka_przegladu(self):
        def on_round(n):
            if n == 2:                                   # przeglad trwa: paczka 1 juz poszla
                os.utime(self.b_file, (T0 + 900, T0 + 900))

        self._run(on_round, 6, *self.REVIEW)
        self.assertEqual([c["stage"] for c in self.calls], ["review", "product", "review", "review"])
        self.assertEqual(self.calls[1]["only"], [self.b])
        self.assertEqual([len(c["only"]) for c in self.calls], [40, 1, 40, 15])
        # zmiana w trakcie przegladu nie otwiera wlasnego raportu, ale miniatury publikuje od razu
        self.assertEqual((self.calls[1]["begin"], self.calls[1]["end"]), (False, False))
        self.assertEqual([(f["report"], f["publish"]) for f in self.finished],
                         [(False, False), (False, True), (False, False), (False, False), (True, True)])

    def test_blad_jednej_paczki_nie_zatrzymuje_przegladu(self):
        bad = self.prods[50]
        self.rc_for = lambda kw: 1 if bad in (kw.get("only_products") or []) else 0
        self._run(lambda n: None, 8, *self.REVIEW)
        self.assertTrue(all(c["stage"] == "review" for c in self.calls))
        ok = {p for c in self.calls for p in c["only"] if bad not in c["only"]}
        self.assertEqual(ok, set(self.prods) - {bad})        # trzecia paczka i reszta drugiej zbudowane
        self.assertIn([bad], [c["only"] for c in self.calls])  # blad zostal przy jednym produkcie
        self.assertIn("przeglad godzinny OK: 94/95 produktow, 3 paczek, 1 nieudanych", self.log.getvalue())
        st = self._status()
        self.assertEqual((st["last_review_products"], st["last_review_failed"]), (94, 1))
        self.assertEqual(st["index_failed_products"], [bad])
        self.assertFalse([f for f in self.finished if f["report"]][0]["ok"])

    def test_nieczytelny_folder_produktu_jest_w_przegladzie_pomijany_a_nie_usuwany(self):
        def on_round(n):
            if n == 1:
                self.io_fail.stat_fail.add(self.b)       # zerwane SMB na folderze produktu B

        self._run(on_round, 8, *self.REVIEW)
        built = [p for c in self.calls for p in c["only"]]
        self.assertNotIn(self.b, built)                  # --only-product nieczytelnego folderu = usuniecie ze spisu
        self.assertEqual(sorted(built), [p for p in self.prods if p != self.b])
        self.assertIn("przeglad godzinny OK: 94/95 produktow, 3 paczek, 0 nieudanych, 1 pominietych", self.log.getvalue())
        self.assertEqual(self._status()["last_review_skipped"], 1)

    def test_przeglad_liczy_sie_od_ostatniego_pelnego_skanu_albo_przegladu(self):
        os.utime(self.index, (self.clock.now - 1800, self.clock.now - 1800))   # pelny skan pol godziny temu

        def on_round(n):
            if n in (4, 12):
                self.clock.now += 1801

        self._run(on_round, 16, *self.REVIEW)
        firsts = [c for c in self.calls if c["begin"]]
        self.assertEqual(len(firsts), 1)                 # po 30 min nic; po godzinie jeden przeglad; po kolejnych
        self.assertEqual(firsts[0]["snapshots"], 5)      # 30 min od JEGO konca - jeszcze nie
        self.assertEqual(len(self.calls), 3)

    def test_kod_5_w_przegladzie_konczy_sie_pelnym_skanem_ktory_zamyka_przeglad(self):
        self.rcs = [5, 0]
        self._run(lambda n: None, 6, *self.REVIEW)
        self.assertEqual([(c["stage"], c["only"] is None) for c in self.calls], [("review", False), ("product", True)])
        self.assertIn("przeglad godzinny zastapiony pelnym skanem", self.log.getvalue())
        self.assertEqual(len(self.calls), 2)             # pelny skan zamknal przeglad: nastepny za godzine

    def test_blokada_zajeta_ponawia_te_sama_paczke(self):
        self.rcs = [2]

        def on_round(n):
            if n == 2:
                self.clock.now += 11

        self._run(on_round, 8, *self.REVIEW)
        self.assertEqual([len(c["only"]) for c in self.calls], [40, 40, 40, 15])
        self.assertEqual(self.calls[0]["only"], self.calls[1]["only"])
        self.assertIn("przeglad godzinny OK: 95/95", self.log.getvalue())

    def test_przeglad_bez_zmian_w_spisie_nie_uruchamia_potoku_brandingu_a_ze_zmianami_raz(self):
        """Potok brandingu trwa 21-56 min i czyta dziesiatki GB: przeglad godzinny nie moze go budzic co godzine.
        Zgloszenie do haka jest jedno, na koncu, i tylko gdy raport przegladu pokazal zmiany w spisie."""
        for counts, wanted in (({"new": 0, "updated": 0, "removed": 0, "unchanged": 900}, False),
                               ({"new": 0, "updated": 2, "removed": 0, "unchanged": 898}, True)):
            self.calls.clear()
            self.finish_result = {"ok": True, "counts": counts}
            os.utime(self.index, (self.clock.now - 3700, self.clock.now - 3700))
            last_full = self.tmp / "index-last-full.json"
            if last_full.exists():
                last_full.unlink()                       # drugi przebieg petli: przeglad znow po czasie
            self._run(lambda n: None, 5, *self.REVIEW)
            self.assertEqual([c["hook"] for c in self.calls], [False, False, False], counts)   # paczki: bez haka
            hook = self.start_watch.call_args.args[0]
            self.assertEqual(hook._due is not None, wanted, counts)
            self.assertEqual(self._status()["last_review_changes"], counts["updated"])
        self.assertIn("zmian w spisie 2", self.log.getvalue())

    def test_przeglad_w_ktorym_zadna_paczka_nie_zmienila_spisu_nie_publikuje_miniatur(self):
        """Brak zmian = brak publikacji: indekser na kazda paczke odpowiedzial MERGE_UNCHANGED."""
        self.unchanged_for = lambda kw: True
        self._run(lambda n: None, 5, *self.REVIEW)
        self.assertEqual(len(self.calls), 3)
        self.assertEqual([f["publish"] for f in self.finished], [False] * 4)      # 3 paczki + zamkniecie
        self.assertTrue(self.finished[-1]["report"])                                # raport jest: "bez zmian"
        self.assertIn("przeglad godzinny OK: 95/95 produktow", self.log.getvalue())
        st = self._status()
        self.assertEqual((st["last_review_products"], st["last_review_changes"]), (95, 0))

    def test_przeglad_w_ktorym_jedna_paczka_zmienila_spis_publikuje_raz(self):
        self.unchanged_for = lambda kw: self.prods[50] not in (kw.get("only_products") or [])
        self._run(lambda n: None, 5, *self.REVIEW)
        self.assertEqual([f["publish"] for f in self.finished], [False, False, False, True])

    def test_udany_pelny_skan_awaryjny_przesuwa_przeglad_godzinny(self):
        """Pelny skan obejmuje wszystkie produkty: przeglad liczy sie od niego, nie rusza zaraz po nim."""
        os.utime(self.index, (self.clock.now - 7 * 3600, self.clock.now - 7 * 3600))   # i skan 6 h, i przeglad sa po czasie
        self._run(lambda n: None, 5, *self.REVIEW)
        self.assertEqual([(c["stage"], c["only"]) for c in self.calls], [("hourly", None)])
        self.assertNotIn("przeglad godzinny:", self.log.getvalue())

    def test_kod_6_w_przegladzie_ponawia_paczke_a_po_trzech_razach_ja_pomija(self):
        bad = self.prods[50]
        self.rc_for = lambda kw: 6 if bad in (kw.get("only_products") or []) else 0

        def on_round(n):
            if n in (3, 4):
                self.clock.now += 61

        self._run(on_round, 8, *self.REVIEW)
        self.assertEqual([len(c["only"]) for c in self.calls], [40, 40, 40, 40, 15])   # paczka 2 trzy razy, cala
        self.assertTrue(all(c["stage"] == "review" for c in self.calls))
        out = self.log.getvalue()
        self.assertIn("przeglad godzinny OK: 55/95 produktow, 3 paczek, 0 nieudanych, 40 pominietych", out)
        st = self._status()
        self.assertEqual((st["last_review_failed"], st["last_review_skipped"], st["index_failed_products"]), (0, 40, []))

    def test_review_0_i_wylaczony_przyrost_nie_robia_przegladu(self):
        for extra in (("--review", "0", "--first-delay", "0"), (*self.REVIEW, "--no-incremental")):
            self.calls.clear()
            self._run(lambda n: None, 4, *extra)
            self.assertEqual(self.calls, [], extra)


if __name__ == "__main__":
    unittest.main()
