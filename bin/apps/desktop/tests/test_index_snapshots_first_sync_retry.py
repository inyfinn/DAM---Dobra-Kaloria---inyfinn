# -*- coding: utf-8 -*-
"""07.10.2026 (instalator nie pakuje spisu): ponawianie PIERWSZEGO pobrania katalogu z bazy.

Ten plik: logika bez bazy (harmonogram, stan, nie-nakladanie sie na cykl, limit polaczenia, last.at).
Zachowanie na prawdziwej bazie dam_eta_test: test_index_snapshots_first_sync_realpg.py.
"""
from __future__ import annotations

import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_snapshots as ix  # noqa: E402


class _Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def _reset_first_sync(**kw):
    ix._FIRST_SYNC.update(done=False, ok=None, started_at="", finished_at="", attempts=0,
                          last_error="", next_retry_at="")
    ix._FIRST_SYNC.update(kw)
    ix._LAST.clear()


class FirstSyncDelayTests(unittest.TestCase):
    def test_pierwsza_minuta_co_5_s(self):
        for elapsed in (0.0, 4.9, 30.0, 59.9):
            self.assertEqual(ix.first_sync_delay(elapsed), 5.0)

    def test_po_minucie_rosnie_do_30_s_i_tam_zostaje(self):
        self.assertEqual(ix.first_sync_delay(60.0), 5.0)
        self.assertEqual(ix.first_sync_delay(70.0), 10.0)
        self.assertEqual(ix.first_sync_delay(110.0), 30.0)
        self.assertEqual(ix.first_sync_delay(10_000.0), 30.0)
        prev = 0.0
        for elapsed in range(0, 400, 5):
            d = ix.first_sync_delay(float(elapsed))
            self.assertGreaterEqual(d, prev)  # nie maleje
            prev = d


class FirstSyncRetryScheduleTests(unittest.TestCase):
    def setUp(self):
        _reset_first_sync(done=True, ok=False)
        self.clock = _Clock()
        self.calls: list[float] = []
        self.results: list = []

        def attempt():
            self.calls.append(self.clock.t)
            return self.results.pop(0) if self.results else False

        self.retry = ix.FirstSyncRetry(attempt, clock=self.clock)

    def tearDown(self):
        _reset_first_sync()

    def _run_ticks(self, seconds: int):
        for _ in range(seconds):
            self.clock.t += 1.0
            if self.retry.due():
                self.retry.run()

    def test_nieaktywne_dopoki_pierwszy_cykl_sie_nie_skonczyl(self):
        _reset_first_sync()  # done=False
        self.assertFalse(self.retry.pending())
        self._run_ticks(30)
        self.assertEqual(self.calls, [])

    def test_nieaktywne_po_sukcesie_pierwszego_cyklu(self):
        _reset_first_sync(done=True, ok=True)
        self._run_ticks(60)
        self.assertEqual(self.calls, [])

    def test_pierwsze_ponowienie_5_s_po_porazce_cyklu(self):
        self.retry.cycle_finished()  # porazka pierwszego cyklu o t=1000
        self._run_ticks(4)
        self.assertEqual(self.calls, [])
        self._run_ticks(1)
        self.assertEqual(self.calls, [1005.0])

    def test_kolejne_proby_co_5_s_przez_minute_potem_rzadziej(self):
        self.retry.cycle_finished()
        self._run_ticks(180)
        gaps = [b - a for a, b in zip(self.calls, self.calls[1:])]
        self.assertTrue(all(g >= 5.0 for g in gaps), gaps)
        self.assertEqual(set(gaps[:10]), {5.0})                 # pierwsza minuta: co 5 s
        self.assertGreater(max(gaps), 5.0)                      # potem odstep rosnie
        self.assertLessEqual(max(gaps), 30.0 + 1.0)             # i nie przekracza 30 s (+ ziarno ticka)
        self.assertEqual(self.calls, sorted(self.calls))

    def test_sukces_konczy_ponawianie(self):
        self.results = [False, True]
        self.retry.cycle_finished()
        self._run_ticks(10)
        self.assertEqual(len(self.calls), 2)
        ix._FIRST_SYNC["ok"] = True  # retry_first_pull ustawia to przez _note_first_sync
        self._run_ticks(300)
        self.assertEqual(len(self.calls), 2)

    def test_zajety_cykl_nie_liczy_sie_jako_proba_i_wraca_za_sekunde(self):
        self.results = [None, None, False]
        self.retry.cycle_finished()
        self._run_ticks(5)    # t=1005: pierwsza proba -> None (zajety)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(self.retry.tries, 0)
        self._run_ticks(1)    # +1 s: znowu None
        self._run_ticks(1)    # +1 s: porazka
        self.assertEqual(len(self.calls), 3)
        self.assertEqual(self.retry.tries, 1)

    def test_wyjatek_proby_to_porazka_a_nie_petla_co_sekunde(self):
        def boom():
            self.calls.append(self.clock.t)
            raise RuntimeError("x")

        self.retry = ix.FirstSyncRetry(boom, clock=self.clock)
        self.retry.cycle_finished()
        self._run_ticks(20)
        self.assertLessEqual(len(self.calls), 4)  # t=1005, 1010, 1015, 1020

    def test_next_retry_at_w_stanie_dla_loadera(self):
        self.retry.cycle_finished()
        self.assertTrue(ix._FIRST_SYNC["next_retry_at"])


class RetryFirstPullTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.data = self.base / "data"
        self.data.mkdir()
        self.state_dir = self.base / "state"
        p = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)
        _reset_first_sync(done=True, ok=False)
        self.addCleanup(_reset_first_sync)

    def test_nie_nachodzi_na_trwajacy_cykl(self):
        with mock.patch.object(ix, "pull_newer") as pull:
            self.assertTrue(ix._LOCK.acquire(blocking=False))  # "trwa" run_once
            try:
                res = ix.retry_first_pull(self.data, lambda: False)
            finally:
                ix._LOCK.release()
            self.assertIsNone(res)
            pull.assert_not_called()
            self.assertEqual(ix._FIRST_SYNC["attempts"], 0)

    def test_nie_nachodzi_na_cykl_z_innego_watku(self):
        started, release = threading.Event(), threading.Event()

        def long_cycle():
            with ix._LOCK:
                started.set()
                release.wait(5)

        th = threading.Thread(target=long_cycle)
        th.start()
        self.assertTrue(started.wait(2))
        try:
            with mock.patch.object(ix, "pull_newer") as pull:
                self.assertIsNone(ix.retry_first_pull(self.data, lambda: False))
                pull.assert_not_called()
        finally:
            release.set()
            th.join(5)

    def test_ponowienie_nie_publikuje(self):
        with mock.patch.object(ix, "pull_newer", return_value={"ok": True, "pulled": [], "current": [],
                                                                "missing_in_db": ["file-index"]}) as pull, \
                mock.patch.object(ix, "publish_changed") as pub:
            self.assertTrue(ix.retry_first_pull(self.data, lambda: True))
            pull.assert_called_once()
            pub.assert_not_called()
        self.assertEqual(ix._LAST["publish"], {"ok": True, "skipped": "first_sync_retry"})
        self.assertEqual(ix._LAST["why"], "first_sync_retry")

    def test_ponowienie_uzywa_dluzszego_limitu_polaczenia(self):
        with mock.patch.object(ix, "pull_newer", return_value={"ok": False, "error": "x"}) as pull:
            self.assertFalse(ix.retry_first_pull(self.data, lambda: False))
        self.assertEqual(pull.call_args.kwargs["connect_timeout"], ix.FIRST_SYNC_CONNECT_TIMEOUT_S)
        self.assertGreaterEqual(ix.FIRST_SYNC_CONNECT_TIMEOUT_S, 10.0)

    def test_last_at_zmienia_sie_po_kazdej_probie(self):
        seen = []
        with mock.patch.object(ix, "pull_newer", return_value={"ok": False, "error": "polaczenie"}):
            for _ in range(3):
                time.sleep(0.03)  # zegar systemowy Windows ma ziarno ~15 ms; w programie proby dziela sekundy
                ix.retry_first_pull(self.data, lambda: False)
                seen.append(ix.status()["last"]["at"])
        self.assertEqual(len(set(seen)), 3, seen)
        self.assertEqual(ix.status()["first_sync"]["attempts"], 3)
        self.assertEqual(ix.status()["first_sync"]["last_error"], "polaczenie")

    def test_ok_przechodzi_z_false_na_true_i_juz_nie_wraca(self):
        with mock.patch.object(ix, "pull_newer", return_value={"ok": True, "pulled": [], "current": [],
                                                                "missing_in_db": []}):
            ix.retry_first_pull(self.data, lambda: False)
        self.assertIs(ix.status()["first_sync"]["ok"], True)
        self.assertEqual(ix.status()["first_sync"]["next_retry_at"], "")
        with mock.patch.object(ix, "pull_newer", return_value={"ok": False, "error": "pozniej"}) as pull:
            self.assertTrue(ix.retry_first_pull(self.data, lambda: False))  # juz zrobione: bez zapytania
            pull.assert_not_called()
        ix._note_first_sync({"ok": False, "error": "pozniejsza porazka zwyklego cyklu"})
        self.assertIs(ix.status()["first_sync"]["ok"], True)


class CycleSafeTests(unittest.TestCase):
    def tearDown(self):
        _reset_first_sync()

    def test_wyjatek_cyklu_tez_zmienia_last_at(self):
        _reset_first_sync()
        before = ix.status()["last"].get("at", "")
        with mock.patch.object(ix, "run_once", side_effect=RuntimeError("boom")):
            res = ix._cycle_safe(Path("."), lambda: False, None, "first")
        self.assertIn("boom", res["error"])
        after = ix.status()["last"]
        self.assertNotEqual(after.get("at", ""), before)
        self.assertIn("boom", after["error"])

    def test_wyjatek_pierwszego_cyklu_wlacza_ponawianie(self):
        _reset_first_sync()
        with mock.patch.object(ix, "run_once", side_effect=RuntimeError("boom")):
            ix._cycle_safe(Path("."), lambda: False, None, "first")
        self.assertTrue(ix.FirstSyncRetry.pending())
        self.assertTrue(ix._FIRST_SYNC["last_error"])


class PgTimeoutKwargsTests(unittest.TestCase):
    def test_przekazuje_timeout_tylko_gdy_funkcja_go_ma(self):
        def with_timeout(*, timeout=None):
            return timeout

        def without_timeout():
            return None

        self.assertEqual(ix._pg_timeout_kwargs(with_timeout, 15.0), {"timeout": 15.0})
        self.assertEqual(ix._pg_timeout_kwargs(without_timeout, 15.0), {})
        self.assertEqual(ix._pg_timeout_kwargs(with_timeout, None), {})

    def test_connector_dopina_timeout(self):
        calls = []

        class Pg:
            @staticmethod
            def connect(*, timeout=None):
                calls.append(timeout)
                return "conn"

        self.assertEqual(ix._connector(Pg, 15.0)(), "conn")
        self.assertEqual(calls, [15.0])

        class PgOld:
            @staticmethod
            def connect():
                calls.append("old")
                return "conn"

        self.assertEqual(ix._connector(PgOld, 15.0)(), "conn")
        self.assertEqual(calls[-1], "old")


class SnapshotLoopRetryWiringTests(unittest.TestCase):
    """SnapshotLoop: ponowienie dziala miedzy cyklami i nie budzi cyklu publikacji."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.data = self.base / "data"
        self.data.mkdir()
        self.state_dir = self.base / "state"
        p = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)
        _reset_first_sync()
        self.addCleanup(_reset_first_sync)
        self.clock = _Clock()
        self.runs: list[str] = []
        self.attempts = 0

    def _cycle(self, why):
        self.runs.append(why)
        ix._FIRST_SYNC.update(done=True, ok=False)  # pierwszy cykl nie dostal bazy

    def _attempt(self):
        self.attempts += 1
        ix._FIRST_SYNC["ok"] = True
        return True

    def test_ponowienie_po_porazce_pierwszego_cyklu_nie_uruchamia_cyklu_publikacji(self):
        retry = ix.FirstSyncRetry(self._attempt, clock=self.clock)
        loop = ix.SnapshotLoop(self.data, run_cycle=self._cycle, remote_watch=None, clock=self.clock,
                               first_retry=retry)
        self.assertEqual(loop.tick(), "first")
        for _ in range(8):
            self.clock.t += 1.0
            loop.tick()
        self.assertEqual(self.runs, ["first"])   # zadnego dodatkowego cyklu (publikacji)
        self.assertEqual(self.attempts, 1)       # jedno ponowienie, po 5 s

    def test_bez_first_retry_jak_dotad(self):
        loop = ix.SnapshotLoop(self.data, run_cycle=self._cycle, remote_watch=None, clock=self.clock)
        self.assertEqual(loop.tick(), "first")
        for _ in range(20):
            self.clock.t += 1.0
            loop.tick()
        self.assertEqual(self.runs, ["first"])


if __name__ == "__main__":
    unittest.main()
