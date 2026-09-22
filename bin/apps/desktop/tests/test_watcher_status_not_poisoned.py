# -*- coding: utf-8 -*-
"""Rozdarty plik statusu nie moze zostac ZAPISANY jako trwaly blad.

Objaw z 2.1.5: pulpit pokazywal "Aktualizacja indeksu nie dziala" po kazdym
starcie DAM. Przyczyna nie byla padnieta usluga, tylko czytaj-zmien-zapisz:
read_watcher_status() na nieczytelnym pliku zwracalo koperte
{"ok": false, "watcher_ok": false, "error": "corrupt:UnicodeDecodeError"},
a merge_live_into_watcher_status() zapisywalo ja z powrotem jako prawdziwy
status. Od tej chwili blad siedzial na dysku i przezywal restart.
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

import index_supervisor as isup  # noqa: E402

# Bajt 0x81 - dokladnie to, co zostawia po sobie kopia Synology Drive.
BAD_BYTES = b'{"last_ok": true, "note": "\x81\x81"}'


class WatcherStatusPoisonTests(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        d = Path(self.td.name)
        self.status = d / "index-watcher-status.json"
        self.patches = [
            mock.patch.object(isup, "WATCHER_STATUS", self.status),
            mock.patch.object(isup, "LIVE_FILE", d / "index-live.json"),
            mock.patch.object(isup, "SNAPSHOT_FILE", d / "index-run-snapshot.json"),
            mock.patch.object(isup, "CONTROL_FILE", d / "index-control.json"),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.td.cleanup()

    def _on_disk(self) -> dict:
        return json.loads(self.status.read_text(encoding="utf-8"))

    def test_read_marks_error_envelope(self):
        self.status.write_bytes(BAD_BYTES)
        st = isup.read_watcher_status()
        self.assertTrue(st.get("_read_error"))
        self.assertFalse(st.get("watcher_ok"))
        # Wariant do scalania oddaje pusty dict, a nie koperte bledu.
        self.assertEqual(isup.read_watcher_status_for_merge(), {})

    def test_merge_live_never_writes_read_error(self):
        self.status.write_bytes(BAD_BYTES)
        isup.merge_live_into_watcher_status(
            {"current_label": "GC / 05 - DRINKS", "products_done": 183}
        )
        body = self._on_disk()
        self.assertNotIn("_read_error", body)
        self.assertNotEqual(body.get("error"), "corrupt:UnicodeDecodeError")
        self.assertFalse(body.get("error"))
        self.assertEqual(body.get("current_item"), "GC / 05 - DRINKS")

    def test_write_strips_envelope_even_if_handed_in(self):
        isup.write_watcher_status(
            {
                "_read_error": True,
                "ok": False,
                "watcher_ok": False,
                "error": "corrupt:UnicodeDecodeError",
                "stage": "monitoring",
            },
            preserve_last=False,
        )
        body = self._on_disk()
        self.assertNotIn("_read_error", body)
        self.assertNotIn("error", body)
        self.assertNotIn("watcher_ok", body)
        self.assertEqual(body.get("stage"), "monitoring")

    def test_missing_status_is_not_persisted_as_dead_watcher(self):
        self.assertFalse(self.status.exists())
        isup.merge_live_into_watcher_status({"current_label": "start"})
        body = self._on_disk()
        self.assertNotEqual(body.get("error"), "no_status")
        self.assertNotIn("_read_error", body)


class PublicStatusSelfHealTests(unittest.TestCase):
    """Zywy proces wygrywa z zapisanym na dysku watcher_ok=false."""

    def test_live_supervisor_clears_stale_dead_flag(self):
        with (
            mock.patch.object(isup, "read_watcher_status", return_value={"watcher_ok": False, "last_ok": True}),
            mock.patch.object(isup, "supervisor_lock_status", return_value={"held": True, "stale": False, "pid_alive": True, "lock": {}}),
            mock.patch.object(isup, "status_from_lock", return_value={"held": False, "stale": False, "lock": {}}),
            mock.patch.object(isup, "read_report", return_value={}),
            mock.patch.object(isup, "public_control", return_value={}),
        ):
            self.assertTrue(isup.public_status()["watcher_ok"])

    def test_stale_supervisor_lock_does_not_poison_live_rebuild(self):
        """Martwy nadzorca + ZYWY robotnik przebudowy = brak paska bledu.

        Objaw 2026-09-22: index-supervisor.lock.json trzymal pid 53876, ktory juz
        nie istnial (heartbeat starszy o 258 s przy ttl 120 s), a index-rebuild.lock
        mial zywy pid 3268 z heartbeatem sprzed sekundy i postep 182/194 produktow.
        public_status() liczylo wtedy stale = lock.stale or rebuild.stale, wiec
        przeterminowany zamek nadzorcy sam zapalal "Aktualizacja indeksu nie dziala"
        mimo trwajacej przebudowy.
        """
        with (
            mock.patch.object(isup, "read_watcher_status", return_value={"watcher_ok": True, "last_ok": True}),
            mock.patch.object(isup, "supervisor_lock_status", return_value={"held": False, "stale": True, "pid_alive": False, "lock": {}}),
            mock.patch.object(isup, "status_from_lock", return_value={"held": True, "stale": False, "pid_alive": True, "lock": {}}),
            mock.patch.object(isup, "read_report", return_value={}),
            mock.patch.object(isup, "public_control", return_value={}),
        ):
            self.assertFalse(isup.public_status()["stale"])

    def test_stale_rebuild_lock_still_counts(self):
        """Przeterminowany zamek PRZEBUDOWY nadal oznacza stale - wtedy nikt nie pracuje."""
        with (
            mock.patch.object(isup, "read_watcher_status", return_value={"watcher_ok": True, "last_ok": True}),
            mock.patch.object(isup, "supervisor_lock_status", return_value={"held": False, "stale": False, "pid_alive": False, "lock": {}}),
            mock.patch.object(isup, "status_from_lock", return_value={"held": False, "stale": True, "pid_alive": False, "lock": {}}),
            mock.patch.object(isup, "read_report", return_value={}),
            mock.patch.object(isup, "public_control", return_value={}),
        ):
            self.assertTrue(isup.public_status()["stale"])

    def test_stale_supervisor_without_live_rebuild_still_counts(self):
        """Martwy nadzorca i BRAK zywej przebudowy = pasek bledu ma prawo sie zapalic."""
        with (
            mock.patch.object(isup, "read_watcher_status", return_value={"watcher_ok": True, "last_ok": True}),
            mock.patch.object(isup, "supervisor_lock_status", return_value={"held": False, "stale": True, "pid_alive": False, "lock": {}}),
            mock.patch.object(isup, "status_from_lock", return_value={"held": False, "stale": False, "pid_alive": False, "lock": {}}),
            mock.patch.object(isup, "read_report", return_value={}),
            mock.patch.object(isup, "public_control", return_value={}),
        ):
            self.assertTrue(isup.public_status()["stale"])

    def test_dead_supervisor_keeps_dead_flag(self):
        with (
            mock.patch.object(isup, "read_watcher_status", return_value={"watcher_ok": False, "last_ok": True}),
            mock.patch.object(isup, "supervisor_lock_status", return_value={"held": False, "stale": True, "pid_alive": False, "lock": {}}),
            mock.patch.object(isup, "status_from_lock", return_value={"held": False, "stale": False, "lock": {}}),
            mock.patch.object(isup, "read_report", return_value={}),
            mock.patch.object(isup, "public_control", return_value={}),
        ):
            self.assertFalse(isup.public_status()["watcher_ok"])


if __name__ == "__main__":
    unittest.main()
