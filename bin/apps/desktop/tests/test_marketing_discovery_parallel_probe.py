# -*- coding: utf-8 -*-
"""Dwa zapytania o ten sam folder naraz: drugie czeka na wynik pierwszej sondy,
a nie dostaje od razu "dysk nie odpowiada" (falszywy alarm "Pliki offline", 07.10.2026)."""
import sys
import threading
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import marketing_discovery as md  # noqa: E402


class ParallelProbeTests(unittest.TestCase):
    def test_drugi_pytajacy_dostaje_wynik_pierwszej_sondy(self):
        calls = []

        def slow():
            calls.append(1)
            time.sleep(0.3)
            return "wynik"

        out = {}

        def ask(name):
            out[name] = md._run_parallel({"klucz-test-rownolegly": slow}, 3.0)

        a = threading.Thread(target=ask, args=("a",))
        b = threading.Thread(target=ask, args=("b",))
        a.start(); time.sleep(0.05); b.start(); a.join(5); b.join(5)
        self.assertEqual(len(calls), 1, "dysk sondowany raz")
        for name in ("a", "b"):
            results, timed_out = out[name]
            self.assertEqual(timed_out, [], name)
            self.assertEqual(results.get("klucz-test-rownolegly"), "wynik", name)

    def test_limit_czasu_nadal_zglasza_brak_odpowiedzi(self):
        ev = threading.Event()
        try:
            results, timed_out = md._run_parallel({"klucz-test-wiszacy": lambda: ev.wait(5)}, 0.2)
            self.assertEqual(timed_out, ["klucz-test-wiszacy"])
        finally:
            ev.set()


if __name__ == "__main__":
    unittest.main()
