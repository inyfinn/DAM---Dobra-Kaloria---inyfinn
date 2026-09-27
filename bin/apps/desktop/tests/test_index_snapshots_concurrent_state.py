# -*- coding: utf-8 -*-
"""27.09.2026 (dodatek do zadania 2): most (local_bridge.py, publish_changed/
pull_newer) i OSOBNY PROCES bin/apps/web/scripts/watch-file-index.py
(mark_built_here po udanym buildzie) pisza do TEGO SAMEGO pliku stanu
(index-snapshots.json). Bez blokady miedzyprocesowej dwa rownolegle
load-modify-save moga zgubic nawzajem swoje pola (most kasuje built_here_sha,
ktory watcher wlasnie dopisal, albo odwrotnie).

Test symuluje dwa "procesy" jako dwa niezalezne watki wolajace na przemian
mark_built_here() i _save_state() na tym samym pliku - real threading, nie
mock, zeby naprawde wymusic przeplatanie."""
from __future__ import annotations

import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_snapshots as ix  # noqa: E402


class ConcurrentStateWriteTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.state_dir = Path(tmp.name)
        p = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)

    def test_dwa_watki_na_przemian_zapisuja_zadne_pole_nie_ginie(self):
        """Watek "most" ciagle dopisuje pole 'pulled_sha' do klucza 'file-index'.
        Watek "watcher" ciagle woła mark_built_here (dopisuje 'built_here_sha').
        Po N rundach obie wartosci musza byc te OSTATNIE zapisane przez kazdy
        watek - zaden zapis nie moze zniknac pod zapisem drugiego watku."""
        rounds = 40
        errors: list[str] = []

        def most_watek():
            try:
                for i in range(rounds):
                    with ix._state_lock():
                        state = ix._load_state()
                        entry = state.setdefault("file-index", {})
                        entry["pulled_sha"] = f"most-{i}"
                        ix._save_state(state)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"most: {exc}")

        def watcher_watek(tmp_dir: Path):
            try:
                for i in range(rounds):
                    f = tmp_dir / f"file-index-{i}.json"
                    f.write_bytes(f'{{"v": {i}}}'.encode() + b" " * 1100)
                    res = ix.mark_built_here("file-index", f)
                    if not res.get("ok"):
                        errors.append(f"watcher mark_built_here failed: {res}")
            except Exception as exc:  # noqa: BLE001
                errors.append(f"watcher: {exc}")

        with tempfile.TemporaryDirectory() as td:
            tmp_dir = Path(td)
            t1 = threading.Thread(target=most_watek)
            t2 = threading.Thread(target=watcher_watek, args=(tmp_dir,))
            t1.start()
            t2.start()
            t1.join(timeout=30)
            t2.join(timeout=30)

        self.assertEqual(errors, [])
        final = ix._load_state()
        entry = final.get("file-index") or {}
        # Watek "most" pisal pulled_sha az do "most-{rounds-1}" - to pole
        # MUSI przetrwac, niezaleznie od tego, ile razy watcher zapisal miedzyczasie.
        self.assertEqual(entry.get("pulled_sha"), f"most-{rounds - 1}")
        # built_here_sha MUSI byc obecne (watcher zdazyl zapisac cos) - dokladna
        # wartosc zalezy od przeplatania, ale pole nie moze byc puste/brakujace.
        self.assertTrue(entry.get("built_here_sha"))

    def test_brak_lockfile_po_zakonczeniu(self):
        ix.mark_built_here("file-index", Path(__file__))  # dowolny istniejacy plik
        self.assertFalse(ix._state_lock_path().exists())


if __name__ == "__main__":
    unittest.main()
