# -*- coding: utf-8 -*-
"""07.10.2026 (audyt publikacji, zator Z1): wlasciciel katalogu cofal wlasny swiezy
indeks do starszej wersji z bazy ok. 8 s po zbudowaniu (search-index,
branding-search-index) i potem go nie publikowal.

Trzy przyczyny, trzy grupy testow (atrapa bazy jak w test_index_snapshots.py):
  * pull_newer nadpisywal plik, ktory nie mial JESZCZE znacznika mark_built_here
    (znacznik dopisuje inny proces po fakcie) - OwnerPendingBuildTests;
  * martwy, pusty plik blokady stanu kosztowal 5 s przy kazdym zapisie - StateLockTests;
  * wynik cyklu szedl tylko na print (most pod pythonw gubi stdout) - CycleLogTests.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import time
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
for _p in (str(DESKTOP), str(DESKTOP / "tests")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import index_authority as ia  # noqa: E402
import index_snapshots as ix  # noqa: E402
from test_index_snapshots import FakeDb, _write  # noqa: E402

KEY = "search-index"
FNAME = "search-index.json"


class _Db(FakeDb):
    def connect(self):  # pull_newer czyta atrybut pg_db.connect; may_publish jest podmienione
        raise OSError("atrapa: brak sieci")


class _Base(unittest.TestCase):
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
        self.db = _Db()
        p = mock.patch.dict(sys.modules, {"pg_db": self.db})
        p.start()
        self.addCleanup(p.stop)

    def _authority(self, value):
        p = mock.patch.object(ia, "may_publish", return_value=value)
        p.start()
        self.addCleanup(p.stop)


class OwnerPendingBuildTests(_Base):
    def _db_has_old_build(self) -> bytes:
        built_at = datetime.fromtimestamp(time.time() - 86400, tz=timezone.utc).isoformat()
        raw = json.dumps({"skan": "stary, z bazy"}).encode("utf-8") + b" " * 1100
        self.db.rows[KEY] = {"raw": raw, "sha256": hashlib.sha256(raw).hexdigest(), "generation": 1,
                             "built_at": built_at, "built_by": "KRZYSZTOFWI", "published_at": built_at}
        return raw

    def _first_sync(self) -> bytes:
        """Pusty stan + plik z paczki instalatora -> pierwsza synchronizacja bierze baze."""
        db_raw = self._db_has_old_build()
        _write(self.data / FNAME, {"skan": "z paczki instalatora"})
        res = ix.pull_newer(self.data, root_alive=True)
        self.assertEqual([x["key"] for x in res["pulled"]], [KEY], res)
        self.assertEqual((self.data / FNAME).read_bytes(), db_raw)
        return db_raw

    def test_pusty_stan_i_plik_z_paczki_pobiera_z_bazy(self):
        self._authority(True)
        self._first_sync()

    def test_wlasciciel_nie_cofa_swiezego_builda_i_publikuje_go_po_znaczniku(self):
        self._authority(True)
        self._first_sync()
        # Lokalny build przepisal plik; znacznik mark_built_here jeszcze nie doszedl.
        fresh = _write(self.data / FNAME, {"skan": "swiezy lokalny build", "produkty": 190})
        res = ix.pull_newer(self.data, root_alive=True)
        self.assertEqual(res["pulled"], [], res)
        self.assertEqual(res.get("pending_local_build"), [KEY])
        self.assertEqual((self.data / FNAME).read_bytes(), fresh)
        # Bez znacznika nadal nic nie wychodzi do bazy.
        pub = ix.publish_changed(self.data, root_alive=True)
        self.assertEqual(pub["published"], [])
        self.assertIn(KEY, pub.get("refused_not_built_here", []))
        # Znacznik (z procesu watch-file-index.py) -> nastepny cykl publikuje NOWA tresc.
        self.assertTrue(ix.mark_built_here(KEY, self.data / FNAME)["ok"])
        res = ix.pull_newer(self.data, root_alive=True)
        self.assertEqual(res["pulled"], [], res)
        pub = ix.publish_changed(self.data, root_alive=True)
        self.assertEqual(pub["published"], [KEY], pub)
        self.assertEqual(self.db.rows[KEY]["raw"], fresh)

    def test_komputer_spoza_listy_zawsze_pobiera(self):
        self._authority(False)
        db_raw = self._first_sync()
        _write(self.data / FNAME, {"skan": "lokalny skan opoznionej kopii", "produkty": 12})
        res = ix.pull_newer(self.data, root_alive=True)
        self.assertEqual([x["key"] for x in res["pulled"]], [KEY], res)
        self.assertEqual((self.data / FNAME).read_bytes(), db_raw)

    def test_bez_folderu_marketing_zawsze_pobiera(self):
        self._authority(True)
        db_raw = self._first_sync()
        _write(self.data / FNAME, {"skan": "zmieniony bez ROOT", "produkty": 3})
        res = ix.pull_newer(self.data, root_alive=False)
        self.assertEqual([x["key"] for x in res["pulled"]], [KEY], res)
        self.assertEqual((self.data / FNAME).read_bytes(), db_raw)

    def test_zmieniony_i_nieoznaczony_ponad_limit_wraca_do_bazy(self):
        self._authority(True)
        db_raw = self._first_sync()
        old = time.time() - ix.PENDING_BUILD_HOLD_S - 60
        _write(self.data / FNAME, {"skan": "skrypt naprawczy, nigdy nieoznaczony"}, mtime=old)
        res = ix.pull_newer(self.data, root_alive=True)
        self.assertEqual([x["key"] for x in res["pulled"]], [KEY], res)
        self.assertEqual((self.data / FNAME).read_bytes(), db_raw)

    def test_plik_zgodny_z_baza_tez_jest_znanym_stanem(self):
        """Stan bez pobrania/publikacji/znacznika (np. odtworzony po uszkodzeniu pliku
        stanu), ale plik byl widziany jako ZGODNY z baza: build po tym tez czeka na
        znacznik, nie jest cofany (recenzja 07.10)."""
        self._authority(True)
        db_raw = self._db_has_old_build()
        (self.data / FNAME).write_bytes(db_raw)
        res = ix.pull_newer(self.data, root_alive=True)
        self.assertEqual((res["pulled"], res["current"]), ([], [KEY]), res)
        fresh = _write(self.data / FNAME, {"skan": "pierwszy build po zgodnosci", "produkty": 191})
        res = ix.pull_newer(self.data, root_alive=True)
        self.assertEqual(res["pulled"], [], res)
        self.assertEqual(res.get("pending_local_build"), [KEY])
        self.assertEqual((self.data / FNAME).read_bytes(), fresh)

    def test_znacznik_dopisany_w_trakcie_dlugiej_wysylki_nie_ginie(self):
        """Publikacja trzyma blokade stanu przez cala wysylke; mark_built_here z procesu
        watch-file-index.py po 5 s pisze bez blokady. Zapis stanu na koncu publikacji nie
        moze skasowac tego znacznika - inaczej plik czeka 30 min i wraca do wersji z bazy
        (recenzja 07.10)."""
        self._authority(True)
        _write(self.data / "file-index.json", {"lista": "nowy produkt"})
        search = _write(self.data / FNAME, {"szukaj": "nowy produkt"})
        self.assertTrue(ix.mark_built_here("file-index", self.data / "file-index.json")["ok"])
        real_publish = self.db.publish_index_snapshot

        def slow_publish(key, raw, **kw):
            # w trakcie wysylki file-index drugi proces dopisuje znacznik search-index
            with mock.patch.object(ix, "_STATE_LOCK_TIMEOUT_S", 0.05):
                self.assertTrue(ix.mark_built_here(KEY, self.data / FNAME)["ok"])
            return real_publish(key, raw, **kw)

        with mock.patch.object(self.db, "publish_index_snapshot", slow_publish):
            pub = ix.publish_changed(self.data, root_alive=True)
        self.assertEqual(pub["published"], ["file-index"], pub)
        self.assertEqual(ix._load_state()[KEY].get("built_here_sha"), hashlib.sha256(search).hexdigest())
        self.assertEqual(ix.publish_changed(self.data, root_alive=True)["published"], [KEY])


class StateLockTests(_Base):
    def _lock(self) -> Path:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        return ix._state_lock_path()

    def test_pusty_stary_plik_blokady_nie_opoznia_i_jest_przejmowany(self):
        lock = self._lock()
        lock.write_bytes(b"")  # stary format, jak martwy plik z 06.10.2026
        hour_ago = time.time() - 3600
        os.utime(lock, (hour_ago, hour_ago))
        t0 = time.monotonic()
        with ix._state_lock() as held:
            waited = time.monotonic() - t0
            self.assertTrue(held)
            self.assertTrue(lock.read_text(encoding="utf-8").startswith(f"{os.getpid()}:"))
        self.assertLess(waited, 1.0)
        self.assertFalse(lock.exists())

    def test_blokada_po_martwym_procesie_jest_przejmowana(self):
        lock = self._lock()
        lock.write_text("424242:1:0", encoding="utf-8")
        t0 = time.monotonic()
        with mock.patch.object(ix, "_pid_alive", return_value=False), ix._state_lock() as held:
            self.assertTrue(held)
        self.assertLess(time.monotonic() - t0, 1.0)
        self.assertFalse(lock.exists())

    def test_zywa_blokada_innego_procesu_jest_respektowana(self):
        lock = self._lock()
        lock.write_text("424242:1:0", encoding="utf-8")
        with mock.patch.object(ix, "_pid_alive", return_value=True), \
                mock.patch.object(ix, "_STATE_LOCK_TIMEOUT_S", 0.3), ix._state_lock() as held:
            self.assertFalse(held)
            self.assertEqual(lock.read_text(encoding="utf-8"), "424242:1:0")
        self.assertEqual(lock.read_text(encoding="utf-8"), "424242:1:0")  # cudzej nie kasujemy

    def test_zwolnienie_ponawia_gdy_plik_blokady_chwilowo_zajety(self):
        """Windows: unlink pada, gdy czekajacy proces akurat czyta plik blokady. Bez
        ponowienia blokada zostawala i przez 60 s kazdy zapis stanu czekal 5 s."""
        lock = self._lock()
        real, calls = Path.unlink, []

        def flaky(path, *a, **kw):
            calls.append(path)
            if len(calls) == 1:
                raise PermissionError("plik zajety przez inny proces")
            return real(path, *a, **kw)

        with mock.patch.object(Path, "unlink", flaky):
            with ix._state_lock() as held:
                self.assertTrue(held)
        self.assertEqual(len(calls), 2)
        self.assertFalse(lock.exists())

    def test_zapis_stanu_ponawia_gdy_plik_stanu_chwilowo_zajety(self):
        self._lock()
        real, calls = os.replace, []

        def flaky(src, dst):
            calls.append(dst)
            if len(calls) == 1:
                raise PermissionError("stan czytany przez inny proces")
            return real(src, dst)

        with mock.patch.object(ix.os, "replace", flaky):
            ix._save_state({"file-index": {"built_here_sha": "abc"}})
        self.assertEqual(ix._load_state(), {"file-index": {"built_here_sha": "abc"}})


class CycleLogTests(_Base):
    def test_wynik_cyklu_trafia_do_pliku_z_limitem_rozmiaru(self):
        self._authority(True)  # bez tego wynik zalezy od pamieci index_authority zostawionej przez inny modul testow
        _write(self.data / "file-index.json", {"v": 1})
        ix.mark_built_here("file-index", self.data / "file-index.json")
        ix.run_once(self.data, lambda: True, why="test")
        log = self.state_dir / "logs" / "index-snapshots.log"
        text = log.read_text(encoding="utf-8")
        self.assertIn('"why": "test"', text)
        self.assertIn('"published": ["file-index"]', text)
        with mock.patch.object(ix, "LOG_MAX_BYTES", 10):
            ix._log("po rotacji")
        self.assertIn('"why": "test"', log.with_name(log.name + ".1").read_text(encoding="utf-8"))
        self.assertEqual(len(log.read_text(encoding="utf-8").splitlines()), 1)


if __name__ == "__main__":
    unittest.main()
