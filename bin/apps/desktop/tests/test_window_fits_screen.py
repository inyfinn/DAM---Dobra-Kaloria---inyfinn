# -*- coding: utf-8 -*-
"""Okno startowe nigdy nie jest wieksze niz obszar roboczy ekranu (regula G7, 2026-10-06)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import launch  # noqa: E402


class WindowFitsScreenTests(unittest.TestCase):
    def test_small_screens_get_the_whole_work_area(self):
        # 1920x1080 przy 150% i 125%, 1366x768 - obszar roboczy w pikselach logicznych
        for area in ((1280, 680), (1536, 824), (1366, 728)):
            w, h = launch.fit_window_size(*area)
            self.assertLessEqual(w, area[0], area)
            self.assertLessEqual(h, area[1], area)
            self.assertEqual((w, h), (min(area[0], 1480), area[1]), area)

    def test_large_screens_keep_the_wide_window(self):
        self.assertEqual(launch.fit_window_size(1920, 1040), (1766, 915))
        self.assertEqual(launch.fit_window_size(3840, 2100), (1920, 1200))

    def test_preferred_size_never_exceeds_work_area(self):
        area = launch.work_area_logical()
        w, h = launch.preferred_window_size()
        if area:
            self.assertLessEqual(w, area[2])
            self.assertLessEqual(h, area[3])
        else:
            self.assertEqual((w, h), (1680, 1000))


if __name__ == "__main__":
    unittest.main()
