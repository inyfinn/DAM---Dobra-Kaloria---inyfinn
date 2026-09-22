# -*- coding: utf-8 -*-
"""Po aktywacji kodem baza ma probowac ponownie OD RAZU, nie po _OFFLINE_RETRY_SEC.

22.09.2026: dam_db.py ma wlasny, niezalezny od pg_db licznik odstepu miedzy probami
polaczenia z Postgres (2 min). Aktywacja naprawiala haslo w pg_db, ale ten licznik o tym
nie wiedzial - po udanej aktywacji uzytkownik dalej widzial "Zapis wstrzymany - baza"
do 2 minut, mimo ze /db/activate zwrocilo {"ok": true}.
"""
from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import dam_db  # noqa: E402


class ForceRetryTests(unittest.TestCase):
    def setUp(self):
        self._mode, self._since, self._reason = dam_db._OFFLINE_MODE, dam_db._OFFLINE_SINCE, dam_db._OFFLINE_REASON
        self.addCleanup(self._restore)

    def _restore(self):
        dam_db._OFFLINE_MODE, dam_db._OFFLINE_SINCE, dam_db._OFFLINE_REASON = self._mode, self._since, self._reason

    def test_zeruje_okno_tylko_gdy_offline(self):
        dam_db._enter_offline("password authentication failed")
        dam_db._OFFLINE_SINCE = time.time()  # jakby przed chwila padlo
        with mock.patch.object(dam_db, "synology_allowed", return_value=True), \
                mock.patch.object(dam_db, "pg_configured", return_value=True):
            self.assertFalse(dam_db._should_try_postgres(), "przed force_retry_now() ma czekac na okno")
            dam_db.force_retry_now()
            self.assertTrue(dam_db._should_try_postgres(), "po force_retry_now() ma probowac natychmiast")

    def test_online_nie_rusza_flagi(self):
        dam_db._leave_offline()
        dam_db.force_retry_now()  # nie ma co zerowac - nie offline
        self.assertFalse(dam_db._OFFLINE_MODE)


if __name__ == "__main__":
    unittest.main()
