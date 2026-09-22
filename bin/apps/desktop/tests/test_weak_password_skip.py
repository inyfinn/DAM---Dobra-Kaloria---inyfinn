# -*- coding: utf-8 -*-
"""Slabe haslo da sie pominac - okno "Ustaw nowe haslo" nie moze byc pulapka.

Objaw 2026-09-22: po zalogowaniu wyskakiwalo "Ustaw nowe haslo" BEZ przycisku
pominiecia, mimo ze changelog 2.1.2 obiecywal "BETA: mozna pominac zmiane
slabego hasla".

Lancuch byl przerwany w DWOCH miejscach:
  1. auth_store.login() zwracalo {"error": "password_change_required"} BEZ
     klucza can_skip. Frontend robi pcr.canSkip = !!bdata.can_skip, wiec
     !!undefined = False i przycisk "Pomin" nigdy sie nie renderowal.
  2. local_bridge.py:9592 wolal auth_login() z czterema argumentami i GUBIL
     przyslane przez UI skip_password_change - wiec nawet wymuszony skip
     nie mial jak zadzialac.

Parametr allow_weak_password istnial w login() od poczatku. Brakowalo okablowania.
"""
from __future__ import annotations

import inspect
import re
import sys
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import auth_store  # noqa: E402


class LoginSignatureTests(unittest.TestCase):
    def test_login_accepts_allow_weak_password(self):
        sig = inspect.signature(auth_store.login)
        self.assertIn("allow_weak_password", sig.parameters)
        self.assertIs(sig.parameters["allow_weak_password"].default, False)


class CanSkipContractTests(unittest.TestCase):
    """UI renderuje "Pomin" wylacznie gdy backend przysle can_skip."""

    def test_password_change_required_carries_can_skip(self):
        src = inspect.getsource(auth_store.login)
        idx = src.find('"password_change_required"')
        self.assertGreater(idx, -1, "nie znalazlem zwrotu password_change_required")
        okno = src[max(0, idx - 400): idx + 400]
        self.assertIn(
            "can_skip",
            okno,
            "Zwrot password_change_required bez can_skip - frontend zrobi "
            "!!undefined i NIE pokaze przycisku Pomin (regresja z 2.2.5)",
        )


class BridgeWiringTests(unittest.TestCase):
    """Most musi przekazac skip_password_change z UI do login()."""

    def test_bridge_forwards_skip_flag(self):
        src = (DESKTOP / "local_bridge.py").read_text(encoding="utf-8", errors="replace")
        idx = src.find('if parsed.path == "/auth/login":')
        self.assertGreater(idx, -1, "nie znalazlem trasy /auth/login")
        blok = src[idx: idx + 700]
        self.assertIn(
            "skip_password_change",
            blok,
            "Trasa /auth/login gubi skip_password_change przyslane przez UI",
        )
        self.assertIn(
            "allow_weak_password",
            blok,
            "skip_password_change nie jest przekazywane jako allow_weak_password",
        )

    def test_frontend_sends_the_flag(self):
        """Druga strona kontraktu - gdyby UI przestalo wysylac, test tez ma paść."""
        js = DESKTOP.parent / "web" / "assets" / "js" / "dam-api.js"
        if not js.is_file():
            self.skipTest("brak dam-api.js")
        text = js.read_text(encoding="utf-8", errors="replace")
        self.assertIn("skip_password_change", text)
        self.assertRegex(text, r"can_skip")


if __name__ == "__main__":
    unittest.main()
