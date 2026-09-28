# -*- coding: utf-8 -*-
"""ADR-012 (28.09.2026), klient - testy na atrapach (bez sieci, bez bazy).

pkt 3: index_snapshots.pull_newer - regula "lokalny nowszy plik wygrywa" tylko,
       gdy index_authority.may_publish() jest True albo None (brak klucza = jak dotad).
       False -> zawsze wersja z bazy.
pkt 2 (klient): odmowa bramki migawek ("dam_not_authority:") to "skipped:
       not_authority", nie blad sieci (publish_changed). dam_assets (runda 2): bramka
       pomija wiersz (RETURN NULL) - run_once nie zuzywa obserwacji pominietych operacji.
pkt 4: LightWatch - pelny cykl tylko przy zmianie max(rev)/generacji albo co interwal.
Filtr _is_allowed_without_authority: "change" przy tym samym mtime (inny rozmiar)
       jest wstrzymany - bramka w bazie przepuszcza tylko mtime scisle nowszy.
"""
from __future__ import annotations

import json
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
for _p in (str(DESKTOP), str(DESKTOP / "tests")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import asset_sync  # noqa: E402
import asset_sync_runner  # noqa: E402
import index_authority as ia  # noqa: E402
import index_snapshots as ix  # noqa: E402
from test_index_snapshots import FakeDb, _write  # noqa: E402
from test_index_authority_asset_sync import _pg_two_keys  # noqa: E402


class _GateFakeDb(FakeDb):
    """FakeDb + bramka: publikacja odrzucana jak przez wyzwalacz w bazie."""

    def __init__(self, reject: bool = True, message: str = "dam_not_authority: migawka x od KINGAUR"):
        super().__init__()
        self.reject = reject
        self.message = message
        self.attempts: list[str] = []

    def connect(self):  # index_authority.may_publish(pg_db.connect, ...) - nieuzywane (patch)
        raise OSError("atrapa: brak sieci")

    def publish_index_snapshot(self, key, raw, **kw):
        self.attempts.append(key)
        if self.reject:
            raise RuntimeError(self.message)
        return super().publish_index_snapshot(key, raw, **kw)


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
        p = mock.patch.object(ia, "_state_path", return_value=self.base / "index-authority.json")
        p.start()
        self.addCleanup(p.stop)

    def _use_db(self, db):
        p = mock.patch.dict(sys.modules, {"pg_db": db})
        p.start()
        self.addCleanup(p.stop)

    def _authority(self, value):
        p = mock.patch.object(ia, "may_publish", return_value=value)
        m = p.start()
        self.addCleanup(p.stop)
        return m


class PullNewerAuthorityTests(_Base):
    """Na tym komputerze: plik zbudowany TU (mark_built_here), nowszy niz baza, ROOT zyje."""

    def _prepare(self):
        db = _GateFakeDb(reject=False)
        self._use_db(db)
        import hashlib
        from datetime import datetime, timezone

        built_at = datetime.fromtimestamp(time.time() - 86400, tz=timezone.utc).isoformat()
        db_raw = json.dumps({"skan": "z bazy"}).encode("utf-8") + b" " * 1100
        db.rows["file-index"] = {"raw": db_raw, "sha256": hashlib.sha256(db_raw).hexdigest(),
                                 "generation": 1, "built_at": built_at,
                                 "built_by": "KRZYSZTOFWI", "published_at": built_at}
        local = _write(self.data / "file-index.json", {"skan": "lokalny, nowszy"})
        self.assertGreater(ix._iso_mtime(self.data / "file-index.json"), built_at)
        ix.mark_built_here("file-index", self.data / "file-index.json")
        return db, db_raw, local

    def test_spoza_listy_zawsze_bierze_wersje_z_bazy(self):
        db, db_raw, _local = self._prepare()
        self._authority(False)
        res = ix.pull_newer(self.data, root_alive=True)
        self.assertEqual([x["key"] for x in res["pulled"]], ["file-index"], res)
        self.assertIs(res.get("authority"), False)
        self.assertEqual((self.data / "file-index.json").read_bytes(), db_raw)

    def test_wlasciciel_zachowuje_lokalny_nowszy(self):
        _db, _db_raw, local = self._prepare()
        self._authority(True)
        res = ix.pull_newer(self.data, root_alive=True)
        self.assertEqual(res["pulled"], [])
        self.assertIn("file-index", res["current"])
        self.assertEqual((self.data / "file-index.json").read_bytes(), local)

    def test_brak_klucza_jak_dotad_lokalny_nowszy_wygrywa(self):
        _db, _db_raw, local = self._prepare()
        self._authority(None)
        res = ix.pull_newer(self.data, root_alive=True)
        self.assertEqual(res["pulled"], [])
        self.assertEqual((self.data / "file-index.json").read_bytes(), local)


class PublishNotAuthorityTests(_Base):
    def _two_built_files(self):
        for key, fname in (("file-index", "file-index.json"), ("campaigns", "campaigns.json")):
            _write(self.data / fname, {"k": key})
            ix.mark_built_here(key, self.data / fname)

    def test_odmowa_bramki_to_skipped_not_authority_a_nie_blad(self):
        db = _GateFakeDb(reject=True)
        self._use_db(db)
        self._two_built_files()
        m = self._authority(None)  # nieaktualna pamiec klienta: "wolno"
        res = ix.publish_changed(self.data, root_alive=True)
        self.assertTrue(res["ok"], res)
        self.assertEqual(res.get("skipped"), "not_authority")
        self.assertNotIn("errors", res)
        self.assertEqual(len(db.attempts), 1, "po pierwszej odmowie nie wysyla kolejnych kluczy")
        self.assertEqual(res["refused_not_authority"], db.attempts)
        self.assertTrue(any(c.kwargs.get("force") for c in m.call_args_list),
                        "decyzja may_publish nie zostala odswiezona po odmowie")

    def test_inny_blad_bazy_nadal_jest_bledem(self):
        db = _GateFakeDb(reject=True, message="could not connect to server")
        self._use_db(db)
        self._two_built_files()
        self._authority(None)
        res = ix.publish_changed(self.data, root_alive=True)
        self.assertFalse(res["ok"])
        self.assertNotIn("skipped", res)
        self.assertEqual(len(res["errors"]), 2)

    def test_is_not_authority_error(self):
        self.assertTrue(ix.is_not_authority_error(RuntimeError("dam_not_authority: x")))
        self.assertFalse(ix.is_not_authority_error("timeout"))
        self.assertFalse(ix.is_not_authority_error(None))


class LightWatchTests(unittest.TestCase):
    def _watch(self, values):
        self.now = 0.0
        it = iter(values)

        def probe():
            v = next(it)
            if isinstance(v, Exception):
                raise v
            return v

        return asset_sync_runner.LightWatch(600.0, probe, clock=lambda: self.now)

    def test_pierwszy_cykl_potem_tylko_przy_zmianie(self):
        w = self._watch([5, 5, 5, 7, None, OSError("siec"), 7, 7])
        self.assertTrue(w.due())
        self.assertEqual(w.reason, "first")
        w.done()
        self.now = 30.0
        self.assertFalse(w.due())
        self.assertEqual(w.reason, "unchanged")
        self.now = 60.0
        self.assertFalse(w.due())
        self.now = 90.0
        self.assertTrue(w.due())
        self.assertEqual(w.reason, "remote_changed")
        w.done()
        self.now = 120.0
        self.assertFalse(w.due())
        self.assertEqual(w.reason, "probe_failed")
        self.now = 150.0
        self.assertFalse(w.due())  # wyjatek z probe = jak blad odczytu
        self.now = 90.0 + 600.0
        self.assertTrue(w.due())
        self.assertEqual(w.reason, "interval")
        w.done()
        self.now += 30.0
        self.assertFalse(w.due())

    def test_done_z_przetworzonym_stanem(self):
        """done(max_rev lustra po cyklu): wlasny zapis w trakcie cyklu nie wyzwala
        kolejnego pelnego cyklu; bez argumentu - wartosc sprzed cyklu."""
        w = self._watch([5, 9, 9])
        self.assertTrue(w.due())
        w.done(9)  # cykl pobral/wyslal az do rev 9
        self.now = 30.0
        self.assertFalse(w.due())
        self.now = 60.0
        self.assertFalse(w.due())

    def test_generations_signature(self):
        db = FakeDb()
        db.rows["a"] = {"raw": b"", "sha256": "s1", "generation": 1, "built_at": "", "built_by": "",
                        "published_at": ""}
        with mock.patch.dict(sys.modules, {"pg_db": db}):
            sig1 = ix.generations_signature()
            db.rows["a"]["generation"] = 2
            sig2 = ix.generations_signature()
        self.assertNotEqual(sig1, sig2)
        with mock.patch.dict(sys.modules, {"pg_db": object()}):
            self.assertIsNone(ix.generations_signature())

    def test_remote_max_rev(self):
        class _Cur:
            def execute(self, *_a):
                pass

            def fetchone(self):
                return {"m": 42}

        class _Pg:
            def cursor(self):
                return _Cur()

            def rollback(self):
                pass

            def close(self):
                pass

        self.assertEqual(asset_sync_runner.remote_max_rev(lambda: _Pg()), 42)

        def boom():
            raise OSError("siec")

        self.assertIsNone(asset_sync_runner.remote_max_rev(boom))


class RestrictedFilterTests(unittest.TestCase):
    def _op(self, reason, mtime, base):
        return {"op": "upsert", "reason": reason, "asset_id": "a", "mtime_ms": mtime, "base_mtime_ms": base}

    def test_change_tylko_scisle_nowszy(self):
        f = asset_sync_runner._is_allowed_without_authority
        self.assertTrue(f(self._op("change", 2, 1)))
        self.assertFalse(f(self._op("change", 1, 1)), "ten sam mtime (inny rozmiar) - bramka odrzuci")
        self.assertFalse(f(self._op("change", 0, 1)))
        self.assertTrue(f(self._op("add", 1, 0)))
        self.assertFalse(f(self._op("meta", 2, 1)))
        self.assertFalse(f({"op": "tombstone", "reason": "missing", "asset_id": "a"}))


class RunOnceGateSkipTests(unittest.TestCase):
    """Runda 2: bramka w bazie POMIJA operacje (RETURN NULL -> push_ops "refused").
    run_once przy nieaktualnej decyzji klienta: odswieza may_publish i - gdy False -
    nie zuzywa obserwacji pominietych operacji (bez petli, bez utraty)."""

    OBS_A2 = {"mtime_ms": 7, "size": 3, "hash": None, "desc": "d", "rev": 4}

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.db_path = self.root / "dam-local.sqlite"
        self.data_dir = self.root / "data"
        self.data_dir.mkdir()
        p = mock.patch.object(ia, "_state_path", return_value=self.root / "index-authority.json")
        p.start()
        self.addCleanup(p.stop)
        manifest = {"version": 1, "scan_time_ms": 1000, "root": "Z:/Marketing",
                    "scanned_dirs": [""], "failed_dirs": []}
        (self.data_dir / "branding-scan-dirs.json").write_text(json.dumps(manifest), encoding="utf-8")
        (self.data_dir / "branding-index.scan.json").write_text(
            json.dumps({"assets": [{"path": "Z:/Marketing/p/a.jpg", "size": 1, "mtime_ms": 5}]}),
            encoding="utf-8")
        import asset_repo
        import sqlite3

        conn = sqlite3.connect(str(self.db_path))
        try:
            asset_repo.ensure_local(conn)
            asset_repo.save_observations(conn, {"a2": dict(self.OBS_A2)},
                                         asset_sync_runner.current_root_gen("Z:/Marketing"))
            conn.commit()
        finally:
            conn.close()

    def _result(self, refused_op: dict):
        """Wynik sync_cycle: add a1 zapisany, druga operacja pominieta przez baze;
        next_last_seen jak po udanym cyklu (a2 "zuzyte": brak albo nowa obserwacja)."""
        return {"ok": True, "rows": {}, "pulled": None,
                "push": {"ok": True, "applied": 1, "refused": 1, "results": [
                    {"asset_id": "a1", "op": "upsert", "applied": True, "rev": 9},
                    {"asset_id": refused_op["asset_id"], "op": refused_op["op"], "applied": False,
                     "rev": None}]},
                "report": {"blocked": {}, "ops": [
                    {"op": "upsert", "reason": "add", "asset_id": "a1", "mtime_ms": 5, "base_mtime_ms": 0},
                    refused_op]},
                "next_last_seen": {"a1": {"mtime_ms": 5, "size": 1, "desc": "x", "rev": 9}}}

    def _run(self, result, may_publish):
        self.scan_time = getattr(self, "scan_time", 1000) + 1000  # kazdy przebieg = nowy skan
        manifest = {"version": 1, "scan_time_ms": self.scan_time, "root": "Z:/Marketing",
                    "scanned_dirs": [""], "failed_dirs": []}
        (self.data_dir / "branding-scan-dirs.json").write_text(json.dumps(manifest), encoding="utf-8")
        pg = _pg_two_keys("rows", None)
        with mock.patch.object(ia, "may_publish", side_effect=may_publish) as mp,              mock.patch.object(asset_sync, "sync_cycle", return_value=result),              mock.patch.object(asset_sync_runner, "_sync_cycle_restricted_ops") as restricted:
            res = asset_sync_runner.run_once(
                self.db_path, self.data_dir, root_alive=True, root_path="Z:/Marketing",
                machine="KINGAUR", pg_connect=lambda: pg, on_index_written=None)
        restricted.assert_not_called()
        self.assertTrue(res.get("did_scan"), res)
        import asset_repo
        import sqlite3

        conn = sqlite3.connect(str(self.db_path))
        try:
            obs = asset_repo.load_observations(conn)["obs"] or {}
        finally:
            conn.close()
        return res, obs, mp

    @staticmethod
    def _stale_then_false(*_a, force=False, **_k):
        return False if force else None

    def test_pominiety_tombstone_zachowuje_obserwacje(self):
        tomb = {"op": "tombstone", "reason": "missing", "asset_id": "a2", "mtime_ms": 7, "base_mtime_ms": 7}
        res, obs, mp = self._run(self._result(tomb), self._stale_then_false)
        self.assertTrue(res["ok"], res)
        self.assertEqual(res.get("not_authority_refused"), 1)
        self.assertIs(res.get("authority"), False)
        self.assertEqual(obs.get("a2"), self.OBS_A2, "obserwacja zniknietego pliku zgubiona")
        self.assertIn("a1", obs)
        self.assertEqual(res["blocked"].get(asset_sync_runner.NOT_AUTHORITY_BUCKET), 1)
        self.assertTrue(any(c.kwargs.get("force") for c in mp.call_args_list))

    def test_pominiety_restore_i_meta_nie_zuzywaja_obserwacji(self):
        for op in ({"op": "restore", "reason": "reappeared", "asset_id": "a2"},
                   {"op": "upsert", "reason": "meta", "asset_id": "a2", "mtime_ms": 7, "base_mtime_ms": 7},
                   {"op": "upsert", "reason": "recreate", "asset_id": "a2", "mtime_ms": 8, "base_mtime_ms": 7}):
            with self.subTest(reason=op["reason"]):
                result = self._result(op)
                result["next_last_seen"]["a2"] = {"mtime_ms": 7, "size": 3, "desc": "NOWY", "rev": 99}
                res, obs, _mp = self._run(result, self._stale_then_false)
                self.assertTrue(res["ok"], res)
                self.assertEqual(obs.get("a2"), self.OBS_A2, op)

    def test_klucza_nadal_brak_zachowanie_jak_dotad(self):
        """force=True dalej None (klucza w bazie nie ma) - zwykla odmowa WHERE,
        obserwacje jak po kazdym cyklu (bez zmian wzgledem sprzed ADR-012)."""
        tomb = {"op": "tombstone", "reason": "missing", "asset_id": "a2", "mtime_ms": 7, "base_mtime_ms": 7}
        res, obs, _mp = self._run(self._result(tomb), lambda *a, **k: None)
        self.assertTrue(res["ok"])
        self.assertNotIn("not_authority_refused", res)
        self.assertNotIn("a2", obs)

    def test_odrzucony_add_nie_odswieza_decyzji(self):
        add2 = {"op": "upsert", "reason": "add", "asset_id": "a2", "mtime_ms": 7, "base_mtime_ms": 0}
        res, _obs, mp = self._run(self._result(add2), self._stale_then_false)
        self.assertTrue(res["ok"])
        self.assertFalse(any(c.kwargs.get("force") for c in mp.call_args_list))
        self.assertNotIn("not_authority_refused", res)


if __name__ == "__main__":
    unittest.main()
