# -*- coding: utf-8 -*-
"""Wypelnianie pamieci na komputerze z folderem Marketing (BRIEF-235 diagnoza F).

22.09.2026 (kierownik): enqueue_warm leci dzis wylacznie z UI (K-WARM-4), wiec
pamiec podreczna rosnie tylko dla tego, co ktos akurat obejrzal - 20% z 179
brakujacych sciezek w Brandingu nie ma klucza NIGDZIE, nawet na PC z dyskiem X:.
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import dam_thumb_cache as tc  # noqa: E402


class FillIsArchiveTests(unittest.TestCase):
    def test_rozpoznaje_archiwum_jak_branding(self):
        self.assertTrue(tc._fill_is_archive("X:/Marketing/-- ARCHIWUM --/foo/bar.png"))
        self.assertTrue(tc._fill_is_archive(r"X:\Marketing\-- ARCHIWUM --\foo\bar.png"))
        self.assertFalse(tc._fill_is_archive("X:/Marketing/- POLSKA/foo/bar.png"))


class FillDoesNotStartWithoutRootTests(unittest.TestCase):
    def setUp(self):
        tc._FILL_THREAD = None
        self.addCleanup(setattr, tc, "_FILL_THREAD", None)

    def test_nie_startuje_watku_bez_marketing_root(self):
        with mock.patch.object(tc, "_fill_marketing_root", return_value=None):
            res = tc.start_marketing_fill_watch()
        self.assertTrue(res.get("ok"))
        self.assertFalse(res.get("started"))
        self.assertEqual(res.get("reason"), "no_marketing_root")
        self.assertIsNone(tc._FILL_THREAD)

    def test_startuje_watek_gdy_root_dostepny(self):
        with mock.patch.object(tc, "_fill_marketing_root", return_value=Path("X:/Marketing")):
            # Nie chcemy prawdziwej petli w tym tescie - podmien loop body na noop szybki.
            with mock.patch.object(tc, "_fill_run_once", return_value={"ok": True, "queued": 0}), mock.patch.object(
                tc.time, "sleep", side_effect=SystemExit
            ):
                res = tc.start_marketing_fill_watch()
        self.assertTrue(res.get("started"))
        self.assertIsNotNone(tc._FILL_THREAD)


class FillRunOnceTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        p1 = mock.patch.object(tc, "cache_root", return_value=self.root)
        p1.start()
        self.addCleanup(p1.stop)
        tc._REL_INDEX = None
        self.addCleanup(setattr, tc, "_REL_INDEX", None)
        (self.root / "thumbs").mkdir(parents=True, exist_ok=True)
        # publish_new_thumbs prawdziwie dotyka W:/SSH/Postgres - w tescie liczy sie
        # tylko ILE razy i KIEDY fill go wola, nie jego wlasna implementacja.
        self._publish = mock.patch.object(tc, "publish_new_thumbs", return_value={"ok": True})
        self.publish_mock = self._publish.start()
        self.addCleanup(self._publish.stop)
        p2 = mock.patch.object(tc, "_fill_marketing_root", return_value=Path("X:/Marketing"))
        p2.start()
        self.addCleanup(p2.stop)
        # Watek NIE moze naprawde spac 3 s na paczke w unittescie.
        p3 = mock.patch.object(tc.time, "sleep", return_value=None)
        p3.start()
        self.addCleanup(p3.stop)
        tc._fill_state = {"phase": "idle", "queued": 0, "done": 0, "last_run": "", "error": ""}
        # Reset: gdyby inny test w tym samym procesie niedawno wolal warm_paths (UI),
        # _fill_yield_to_ui bezcelowo pruilby az do FILL_UI_YIELD_MAX_WAIT_S.
        tc._UI_WARM_AT = 0.0

    def _seed_grid(self, rel: str) -> None:
        idx_path = self.root / "thumb-rel-index.json"
        data = {}
        if idx_path.is_file():
            data = json.loads(idx_path.read_text(encoding="utf-8"))
        data[f"{rel}|grid"] = {"digest": "z" * 64, "mtime": 1.0}
        idx_path.write_text(json.dumps(data), encoding="utf-8")

    def test_wybiera_tylko_brakujace_grid_i_card(self):
        # a.png ma juz grid (pomin), b.png nie ma grid (wez), c.svg - nieobslugiwane
        # rozszerzenie (pomin bez wzgledu na indeks).
        self._seed_grid("a.png")
        plain = ["X:/Marketing/a.png", "X:/Marketing/b.png", "X:/Marketing/c.svg"]
        viz = {"X:/Marketing/b.png"}  # b.png jest tez wizualizacja -> chce card

        enqueued: list[tuple[tuple[str, ...], str]] = []

        def fake_enqueue(paths, profile="grid", email=""):
            enqueued.append((tuple(paths), profile))
            return {"ok": True, "queued": len(paths)}

        with mock.patch.object(tc, "_fill_candidate_paths", return_value=(plain, viz)), mock.patch.object(
            tc, "enqueue_warm", side_effect=fake_enqueue
        ):
            res = tc._fill_run_once()

        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("queued"), 2)  # b.png|grid + b.png|card
        flat = {(paths, profile) for paths, profile in enqueued}
        self.assertIn((("X:/Marketing/b.png",), "grid"), flat)
        self.assertIn((("X:/Marketing/b.png",), "card"), flat)
        for paths, _profile in enqueued:
            self.assertNotIn("X:/Marketing/a.png", paths, "a.png ma juz grid - nie wolno go znow kolejkowac")
            self.assertFalse(any(p.endswith(".svg") for p in paths), "svg nie jest wspierany przez _encode_thumb")
        self.publish_mock.assert_called_once()

    def test_brak_kandydatow_nie_wola_enqueue(self):
        self._seed_grid("a.png")
        with mock.patch.object(tc, "_fill_candidate_paths", return_value=(["X:/Marketing/a.png"], set())), mock.patch.object(
            tc, "enqueue_warm"
        ) as fake_enqueue:
            res = tc._fill_run_once()
        fake_enqueue.assert_not_called()
        self.assertEqual(res, {"ok": True, "queued": 0, "done": 0})
        self.publish_mock.assert_not_called()

    def test_nie_startuje_gdy_root_znika_w_trakcie(self):
        with mock.patch.object(tc, "_fill_marketing_root", return_value=None):
            res = tc._fill_run_once()
        self.assertFalse(res.get("ok"))
        self.assertEqual(res.get("reason"), "no_marketing_root")


if __name__ == "__main__":
    unittest.main()
