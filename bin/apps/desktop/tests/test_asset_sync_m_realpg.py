# -*- coding: utf-8 -*-
"""Etap 1a (spec 9.2): klient "komputer z M:" (asset_sync / asset_sync_m / asset_sync_runner) na PRAWDZIWYM
PostgreSQL - baza testowa dam_eta_test przez bin/scripts/qa/testenv/run_realpg.py (DAM_TEST_PG_DSN).
Bez zmiennej testy sa pomijane. Zadnej atrapy bazy. Dysk to prawdziwy folder tymczasowy (trzy foldery glowne
Marketingu), wiec sondy pliku (scan_walker.probe_file) chodza po prawdziwym systemie plikow.

Schemat testowy: jeden na modul (authority_gate.sql + fleet.sql + m_columns.sql + m_rules.sql), tabele czyszczone
przed kazdym testem. Hasla ani DSN nie sa nigdzie wypisywane."""
from __future__ import annotations

import json
import os
import random
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
DESKTOP = HERE.parent
for _p in (str(DESKTOP), str(HERE)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import asset_repo  # noqa: E402
import asset_sync  # noqa: E402
import asset_sync_m  # noqa: E402
import asset_sync_runner  # noqa: E402

SQL = DESKTOP / "sql"
OWNER = "TEST-M"      # komputer z M:, zatwierdzony i na liscie index_authority
SECOND = "TEST-M2"    # drugi komputer z M:, zatwierdzony, ale spoza listy index_authority
COPY = "TEST-C"       # kopia
TOPS = ("- POLSKA", "-- ARCHIWUM --", "- EKSPORT")
REF_2_6_0 = "259091ed"

_ST: dict = {"cm": None, "dsn": None, "error": ""}


def _run_script(dsn: str, sql: str) -> None:
    import psycopg2  # noqa: PLC0415

    conn = psycopg2.connect(dsn, connect_timeout=15)
    conn.autocommit = True
    try:
        conn.cursor().execute(sql)
    finally:
        conn.close()


def setUpModule():
    dsn = os.environ.get("DAM_TEST_PG_DSN", "").strip()
    if not dsn:
        return
    import realpg  # noqa: PLC0415

    cm = realpg.fresh_db(dsn)
    _ST["dsn"] = cm.__enter__()
    _ST["cm"] = cm
    for name in ("authority_gate.sql", "fleet.sql", "m_columns.sql", "m_rules.sql"):
        _run_script(_ST["dsn"], (SQL / name).read_text(encoding="utf-8"))


def tearDownModule():
    cm = _ST.get("cm")
    if cm is not None:
        cm.__exit__(None, None, None)
        _ST["cm"] = _ST["dsn"] = None


def aid_of(rel: str) -> str:
    return asset_sync.id_of(asset_sync.key_of(rel))


class Disk:
    """Dysk M: w folderze tymczasowym: trzy foldery glowne + pliki z ustawialna data."""

    def __init__(self, base: Path):
        self.root = base / "Marketing"
        for top in TOPS:
            (self.root / top).mkdir(parents=True)

    def put(self, rel: str, mtime_s: int = 1_700_000_000, data: bytes = b"x") -> None:
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        os.utime(p, (mtime_s, mtime_s))

    def rm(self, rel: str) -> None:
        (self.root / rel).unlink()

    def mv(self, a: str, b: str) -> None:
        (self.root / b).parent.mkdir(parents=True, exist_ok=True)
        os.rename(self.root / a, self.root / b)

    def scan(self):
        root = str(self.root)
        scan: dict = {}
        dirs: set[str] = set()
        for dirpath, _dn, filenames in os.walk(root):
            dirs.add(asset_sync.dir_key(dirpath, root))
            for fn in filenames:
                full = os.path.join(dirpath, fn)
                st = os.stat(full)
                aid, entry = asset_sync.scan_entry(full, size=st.st_size, mtime_ms=int(st.st_mtime * 1000),
                                                   root=root, meta={"sku": "1"})
                scan[aid] = entry
        return scan, dirs


class Comp:
    """Jeden komputer: lustro wierszy + obserwacje + dysk."""

    def __init__(self, t: "Base", name: str, disk: Disk | None, role: str, mode: str):
        self.t, self.name, self.disk, self.role, self.mode = t, name, disk, role, mode
        self.rows: dict = {}
        self.last_seen = None
        self.failed: set[str] = set()

    @property
    def writer(self):
        return None if self.mode == "off" else asset_sync_m.writer_of(self.name, self.role)

    def sync(self, scan_time: int | None = None) -> dict:
        scan, dirs = self.disk.scan() if self.disk is not None else (None, ())
        st = int(time.time() * 1000) if scan_time is None else scan_time
        kw: dict = dict(scan=scan, scanned_dirs=dirs, failed_dirs=self.failed, last_seen=self.last_seen,
                        scan_time_ms=st, machine=self.name, root_gen="g")
        if self.mode != "off":
            off = asset_sync_m.db_clock_offset(self.t.pg)[0] if self.role == "m" else 0
            kw.update(role=self.role, m_mode=self.mode, writer=self.writer, scan_db_ms=st + off,
                      pull_sql=asset_sync._SQL_PULL_M)
        if self.role == "copy" and self.mode == "on":
            res = asset_sync_runner._sync_cycle_restricted_ops(self.t.pg, self.rows, **kw)
        else:
            res = asset_sync.sync_cycle(self.t.pg, self.rows, **kw)
        self.t.assertTrue(res["ok"], res)
        self.rows = res["rows"]
        self.last_seen = res["next_last_seen"]
        return res

    def pull(self) -> None:
        r = asset_sync.pull_since(self.t.pg, asset_sync.max_rev(self.rows),
                                  sql=None if self.mode == "off" else asset_sync._SQL_PULL_M)
        self.t.assertTrue(r["ok"], r)
        self.rows = asset_sync.apply_remote(self.rows, r["rows"])

    def confirm(self, *, apply: bool = True, probe=None, cfg: dict | None = None, **kw) -> dict:
        rep = asset_sync_m.confirm_pass(self.t.pg, self.rows, root=str(self.disk.root), machine=self.name,
                                        cfg=cfg or self.t.cfg, apply=apply, probe=probe, **kw)
        self.pull()
        return rep


class Base(unittest.TestCase):
    cfg: dict

    def setUp(self):
        if not _ST["dsn"]:
            self.skipTest("brak DAM_TEST_PG_DSN - test na prawdziwym PostgreSQL pominiety "
                          "(uruchom przez bin/scripts/qa/testenv/run_realpg.py albo test_dsn.py)")
        import psycopg2  # noqa: PLC0415
        import psycopg2.extras  # noqa: PLC0415

        self.pg = psycopg2.connect(_ST["dsn"], cursor_factory=psycopg2.extras.RealDictCursor, connect_timeout=15)
        self.addCleanup(self.pg.close)
        cur = self.pg.cursor()
        cur.execute("SELECT current_database() AS db, current_schema() AS s")
        r = cur.fetchone()
        self.assertTrue(str(r["db"]).startswith("dam_eta_test") and str(r["s"]).startswith("t_"), dict(r))
        for t in ("dam_assets", "dam_asset_product_links", "dam_authority_rejects", "dam_m_computers"):
            cur.execute(f"DELETE FROM {t}")
        cur.execute("DELETE FROM dam_meta WHERE key IN ('m_rules','m_witness','m_catalog_count','index_authority')")
        self.pg.commit()
        asset_sync_m.reset_caches()
        import index_authority  # noqa: PLC0415

        pp = patch.object(index_authority, "_state_path", side_effect=lambda: self.tmp / "index-authority.json")
        pp.start()
        self.addCleanup(pp.stop)
        saved_cache = dict(index_authority._CACHE)
        index_authority._CACHE.update(at=0.0, value=None, raw={}, error="")
        self.addCleanup(lambda: (index_authority._CACHE.clear(), index_authority._CACHE.update(saved_cache)))
        # odstep ponownego zajecia pliku (M4) liczy sie od M3 (checked_ms = teraz): w testach ulamek sekundy
        for name in ("LEASE_MS", "SHADOW_RECHECK_MS"):
            pp = patch.object(asset_sync_m, name, 50)
            pp.start()
            self.addCleanup(pp.stop)
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.tmp = Path(tmp.name)
        self.disk = Disk(self.tmp)
        self.approve(OWNER)
        self.approve(SECOND)
        self.set_meta("index_authority", json.dumps({"machines": [OWNER]}))
        self.rules("on")

    # ---------------------------------------------------------------- ustawienia
    def set_meta(self, key: str, value: str | None) -> None:
        cur = self.pg.cursor()
        if value is None:
            cur.execute("DELETE FROM dam_meta WHERE key = %s", (key,))
        else:
            cur.execute("INSERT INTO dam_meta (key, value) VALUES (%s, %s) "
                        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", (key, value))
        self.pg.commit()

    def rules(self, mode: str, **kw) -> None:
        self.cfg = {"mode": mode, "proto": 1, "confirm_ms": 100, "hold_ms": 1500,
                    "batch_max_files": 1000, "batch_max_share": 1}
        self.cfg.update(kw)
        self.set_meta("m_rules", json.dumps(self.cfg))

    def approve(self, machine: str, state: str = "approved") -> None:
        cur = self.pg.cursor()
        cur.execute("INSERT INTO dam_m_computers (machine, drive, share, state, source) VALUES (%s, 'M:', "
                    "'//192.168.82.36/marketing', %s, 'admin') ON CONFLICT (machine, drive) "
                    "DO UPDATE SET state = EXCLUDED.state", (machine.lower(), state))
        self.pg.commit()

    def m(self, name: str = OWNER, mode: str = "on", disk: Disk | None = None) -> Comp:
        return Comp(self, name, disk or self.disk, "m", mode)

    def copy(self, name: str = COPY, mode: str = "on", disk: Disk | None = None) -> Comp:
        return Comp(self, name, disk, "copy", mode)

    # ---------------------------------------------------------------- odczyty
    def row(self, rel: str) -> dict | None:
        cur = self.pg.cursor()
        cur.execute("SELECT * FROM dam_assets WHERE asset_id = %s", (aid_of(rel),))
        r = cur.fetchone()
        self.pg.rollback()
        return dict(r) if r else None

    def q(self, sql: str, params=None) -> list[dict]:
        cur = self.pg.cursor()
        cur.execute(sql, params)
        out = [dict(r) for r in cur.fetchall()]
        self.pg.rollback()
        return out

    def rejects(self) -> list[str]:
        return [r["reason"] for r in self.q("SELECT reason FROM dam_authority_rejects ORDER BY reason")]

    @staticmethod
    def settle(ms: int = 250) -> None:
        time.sleep(ms / 1000)

    def wait_release(self, rep: dict) -> None:
        """Czeka (zegar BAZY) do godziny zwolnienia najpozniejszego wstrzymanego folderu: testy nie zaleza od tempa sieci."""
        rel = max(h["release_at"] for h in rep["holds"])
        time.sleep(max(0.0, (rel - self.now_db()) / 1000) + 0.3)

    def now_db(self) -> int:
        return int(self.q("SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint AS t")[0]["t"])


F = "- POLSKA/1 - PRODUKTY/Alfa"


# ===================================================================================================
# push_ops: izolacja operacji (spec 6), K1
# ===================================================================================================

class PushOpsIsolation(Base):
    def setUp(self):
        super().setUp()
        self.rules("off")

    def _ops(self, n=5, override=None):
        ops = []
        for i in range(n):
            aid, entry = asset_sync.scan_entry(f"M:/{F}/p{i}.png", size=1, mtime_ms=1000 + i, root="M:",
                                               meta={"sku": "1"})
            ops.append(asset_sync._op(asset_sync.OP_UPSERT, aid, entry, None, OWNER, 1, "add"))
        for i, ch in (override or {}).items():
            ops[i].update(ch)
        return ops

    def test_zla_nazwa_nie_wycofuje_paczki(self):
        ops = self._ops(5, {2: {"name": "zly\x00znak.png"}})
        res = asset_sync.push_ops(self.pg, ops, now_ms=1)
        self.assertTrue(res["ok"], res)
        self.assertEqual((res["applied"], res["failed"], res["refused"]), (4, 1, 0))
        self.assertEqual([e["asset_id"] for e in res["errors"]], [ops[2]["asset_id"]])
        self.assertEqual(res["errors"][0]["error"], "bad_value")
        self.assertEqual(len(self.q("SELECT 1 FROM dam_assets")), 4)

    def test_kolizja_klucza_to_zla_operacja_nie_blad_paczki(self):
        ops = self._ops(3)
        dup = dict(ops[1])
        dup["asset_id"] = "br-099999999"            # inny asset_id, ten sam asset_key
        res = asset_sync.push_ops(self.pg, [ops[0], ops[1], dup, ops[2]], now_ms=1)
        self.assertTrue(res["ok"], res)
        self.assertEqual((res["applied"], res["failed"]), (3, 1))
        self.assertEqual(res["errors"][0]["error"], "key_collision")
        self.assertEqual(len(self.q("SELECT 1 FROM dam_assets")), 3)

    def test_zerwane_polaczenie_raport_tylko_zatwierdzone(self):
        import psycopg2  # noqa: PLC0415

        real_pg = self.pg
        counter = {"n": 0, "fail_at": 0}

        class Cur:
            def __init__(self, cur):
                self._c = cur

            def execute(self, sql, params=None):
                if counter["fail_at"] and "INSERT INTO dam_assets" in sql:
                    counter["n"] += 1
                    if counter["n"] >= counter["fail_at"]:
                        raise psycopg2.OperationalError("zerwane")
                return self._c.execute(sql, params)

            def __getattr__(self, k):
                return getattr(self._c, k)

        class Flaky:
            def cursor(self):
                return Cur(real_pg.cursor())

            def commit(self):
                real_pg.commit()

            def rollback(self):
                real_pg.rollback()

        counter["fail_at"] = 4
        with patch.object(asset_sync, "PUSH_COMMIT_EVERY", 2):
            res = asset_sync.push_ops(Flaky(), self._ops(5), now_ms=1)
        self.assertFalse(res["ok"])
        self.assertEqual(res["applied"], 2, "raport tylko z zatwierdzonych paczek")
        self.assertEqual(len(self.q("SELECT 1 FROM dam_assets")), 2)

    def test_stary_klient_2_6_0_dodaje_i_usuwa_we_wszystkich_trybach(self):
        try:
            src = subprocess.run(["git", "-C", str(DESKTOP), "show", f"{REF_2_6_0}:bin/apps/desktop/asset_sync.py"],
                                 capture_output=True, timeout=60, check=True).stdout
        except Exception:  # noqa: BLE001
            self.skipTest("brak commita 2.6.0 w repo")
        import importlib.util  # noqa: PLC0415

        spec = importlib.util.spec_from_loader("asset_sync_v260_pg", loader=None)
        old = importlib.util.module_from_spec(spec)
        old.__file__ = str(DESKTOP / "asset_sync.py")
        exec(compile(src, "asset_sync_v260_pg", "exec"), old.__dict__)  # noqa: S102
        self.set_meta("index_authority", None)       # pusta lista = bramka starego typu wylaczona
        for mode in ("off", "shadow", "on"):
            self.rules(mode)
            ids = []
            for i in range(2):
                aid, entry = old.scan_entry(f"M:/{F}/{mode}{i}.png", size=1, mtime_ms=5000, root="M:",
                                            meta={"sku": "1"})
                ids.append((aid, entry))
            ops = [old._op(old.OP_UPSERT, a, e, None, "OLDPC", 1, "add") for a, e in ids]
            res = old.push_ops(self.pg, ops, now_ms=1)
            self.assertEqual(res["applied"], 2, (mode, res))
            tomb = old._op(old.OP_TOMBSTONE, ids[0][0], {}, {"mtime_ms": 5000, "size": 1, "rev": 1}, "OLDPC",
                           10 ** 13, "missing")
            tomb.update(mtime_ms=5000, size=1, obs_mtime_ms=5000, obs_size=1)
            res = old.push_ops(self.pg, [tomb], now_ms=2)
            if mode == "on":     # stary klient jest dla bazy kopia: dodaje, ale nie usuwa
                self.assertEqual(res["refused"], 1, (mode, res))
                self.assertIn("usuniecie", self.rejects())
            else:
                self.assertEqual(res["applied"], 1, (mode, res))


# ===================================================================================================
# Reguly komputera z M: (tryb on): S10-S13, S28, P1, P5
# ===================================================================================================

class MRulesFlow(Base):
    def test_nowy_plik_ma_origin_m_i_zegar_bazy(self):                                          # S10
        self.disk.put(f"{F}/a.png")
        a = self.m()
        a.sync()
        r = self.row(f"{F}/a.png")
        self.assertEqual(r["origin"], "m")
        self.assertIsNotNone(r["master_seen_ms"])
        self.assertAlmostEqual(r["master_seen_ms"], self.q("SELECT (extract(epoch FROM clock_timestamp())*1000)::bigint AS t")[0]["t"],
                               delta=60000)
        b = self.copy(disk=None, mode="on")
        b.pull()
        self.assertEqual(b.rows[aid_of(f"{F}/a.png")]["origin"], "m")

    def test_starsza_data_z_dysku_wygrywa(self):                                                # S11
        self.disk.put(f"{F}/a.png", 1_700_000_500)
        a = self.m()
        a.sync()
        self.disk.put(f"{F}/a.png", 1_700_000_100)
        res = a.sync()
        self.assertEqual(res["push"]["applied"], 1, res["push"])
        r = self.row(f"{F}/a.png")
        self.assertEqual((r["mtime_ms"], r["master_mtime"]), (1_700_000_100_000, 1_700_000_100_000))
        self.assertEqual(a.rows[aid_of(f"{F}/a.png")]["mtime_ms"], 1_700_000_100_000)

    def test_pelne_usuniecie_dwa_sprawdzenia_i_powrot_pliku(self):                              # S12, S13
        for n in "abc":
            self.disk.put(f"{F}/{n}.png")
        a = self.m()
        a.sync()
        self.disk.rm(f"{F}/b.png")
        res = a.sync()
        self.assertEqual(res["m"]["marked"], 1)
        r = self.row(f"{F}/b.png")
        self.assertIsNone(r["deleted_at"], "pierwsze sprawdzenie nic nie usuwa")
        self.assertIsNotNone(r["missing_since_ms"])
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE deleted_at IS NOT NULL")[0]["n"], 0)
        self.settle()
        rep = a.confirm()
        self.assertTrue(rep["ok"], rep)
        self.assertEqual(rep["deleted"], 1, rep)
        r = self.row(f"{F}/b.png")
        self.assertIsNotNone(r["deleted_at"])
        self.assertTrue(r["delete_batch"].startswith("c-"), r["delete_batch"])
        self.assertEqual(rep["last_batch"], r["delete_batch"])
        self.assertIsNotNone(a.rows[aid_of(f"{F}/b.png")]["deleted_at"], "lustro dostalo znacznik")
        # plik wraca ze STARSZA data: znacznik zdjety bez wzgledu na date
        self.disk.put(f"{F}/b.png", 1_600_000_000)
        a.sync()
        r = self.row(f"{F}/b.png")
        self.assertIsNone(r["deleted_at"])
        self.assertIsNone(r["delete_batch"])
        self.assertEqual(r["mtime_ms"], 1_600_000_000_000)

    def test_plik_wraca_przed_drugim_sprawdzeniem_zdejmuje_oznaczenie(self):
        for n in "ab":
            self.disk.put(f"{F}/{n}.png")
        a = self.m()
        a.sync()
        self.disk.rm(f"{F}/a.png")
        a.sync()
        self.assertIsNotNone(self.row(f"{F}/a.png")["missing_since_ms"])
        self.disk.put(f"{F}/a.png")                               # wrocil (ta sama wersja)
        res = a.sync()
        self.assertEqual(res["push"]["applied"], 0, "ta sama wersja: zadnej operacji")
        self.settle()
        rep = a.confirm()                                          # drugie sprawdzenie: sonda "jest" -> M5
        self.assertEqual((rep["deleted"], rep["present"]), (0, 1), rep)
        r = self.row(f"{F}/a.png")
        self.assertIsNone(r["missing_since_ms"])
        self.assertIsNone(r["deleted_at"])

    def test_wiersz_sprzed_1a_nie_jest_oznaczany_ani_usuwany_ale_stemplowany(self):             # S28, P1
        self.rules("off")
        self.disk.put(f"{F}/jest.png")
        old = self.copy(mode="off", disk=self.disk)
        old.name = "OLDPC"
        old.sync()
        aid_ghost, entry = asset_sync.scan_entry(f"M:/{F}/widmo.png", size=10, mtime_ms=1234, root="M:",
                                                 meta={"sku": "1"})
        self.assertEqual(asset_sync.push_ops(
            self.pg, [asset_sync._op(asset_sync.OP_UPSERT, aid_ghost, entry, None, "OLDPC", 1, "add")],
            now_ms=1)["applied"], 1)
        self.assertIsNone(self.row(f"{F}/jest.png")["origin"], "wiersz sprzed 1a")
        rev_before = self.row(f"{F}/jest.png")["rev"]
        self.rules("on")
        a = self.m()
        a.pull()
        res = a.sync()
        self.assertEqual(res["m"]["marked"], 0, "widmo sprzed 1a nie jest oznaczane w zwyklej pracy")
        r = self.row(f"{F}/jest.png")
        self.assertEqual(r["origin"], "m")
        self.assertEqual(r["rev"], rev_before, "stempel wiersza sprzed 1a nie podbija numeru zmiany")
        self.assertEqual(a.rows[aid_of(f"{F}/jest.png")]["origin"], "m", "lustro zapisalo origin lokalnie")
        self.settle()
        res2 = a.sync()                                          # kolejny cykl: nic do stemplowania
        self.assertEqual(res2["m"]["stamped"], 0, res2["m"])
        ghost = self.row(f"{F}/widmo.png")
        self.assertIsNone(ghost["origin"])
        self.assertIsNone(ghost["missing_since_ms"])
        self.assertIsNone(ghost["deleted_at"])
        rep = a.confirm()
        self.assertEqual(rep["marked"], 0)

    def test_stempel_wiersza_copy_podbija_rev_i_inne_komputery_to_widza(self):                  # P5, S20
        self.disk.put(f"{F}/b-wlasny.png", 1_700_000_000)
        bdisk = Disk(self.tmp / "B")
        bdisk.put(f"{F}/b-wlasny.png", 1_700_000_000)
        b = self.copy(disk=bdisk)
        b.sync()
        r = self.row(f"{F}/b-wlasny.png")
        self.assertEqual((r["origin"], r["author_by"]), ("copy", COPY.lower()))
        rev0 = r["rev"]
        c = self.copy("TEST-C2", disk=None)
        c.pull()
        self.assertEqual(c.rows[aid_of(f"{F}/b-wlasny.png")]["origin"], "copy")
        a = self.m()
        a.sync()                                               # plik pojawil sie na M:
        r = self.row(f"{F}/b-wlasny.png")
        self.assertEqual(r["origin"], "m")
        self.assertGreater(r["rev"], rev0, "copy -> m = nowy numer zmiany")
        c.pull()
        self.assertEqual(c.rows[aid_of(f"{F}/b-wlasny.png")]["origin"], "m")

    def test_kopia_nowsza_data_na_wierszu_m_zostawia_dane_i_zapisuje_autora(self):               # S19
        self.disk.put(f"{F}/a.png", 1_700_000_000)
        a = self.m()
        a.sync()
        bdisk = Disk(self.tmp / "B")
        bdisk.put(f"{F}/a.png", 1_700_009_000)
        b = self.copy(disk=bdisk)
        b.pull()
        res = b.sync()
        self.assertTrue(res["ok"])
        r = self.row(f"{F}/a.png")
        self.assertEqual((r["mtime_ms"], r["origin"]), (1_700_000_000_000, "m"), "dane z M: bez zmian")
        self.assertEqual((r["author_by"], r["author_mtime"]), (COPY.lower(), 1_700_009_000_000))

    def test_kopia_nie_usuwa_nawet_z_listy_index_authority(self):                                # S21
        self.set_meta("index_authority", json.dumps({"machines": [OWNER, COPY]}))
        self.disk.put(f"{F}/a.png")
        a = self.m()
        a.sync()
        bdisk = Disk(self.tmp / "B")                          # kopia: pusty dysk
        b = self.copy(disk=bdisk)
        b.pull()
        b.sync()
        b.sync()
        r = self.row(f"{F}/a.png")
        self.assertIsNone(r["deleted_at"])
        self.assertIsNone(r["missing_since_ms"])

    def test_baza_odrzuca_przestawiony_zegar_klienta(self):
        """Zegar klienta o dobe w przod i w tyl nie zmienia tego, co wolno usunac: czasy liczy baza."""
        real = time.time
        for shift in (86400, -86400):
            with patch.object(asset_sync_m.time, "time", lambda s=shift: real() + s):
                off, _rtt = asset_sync_m.db_clock_offset(self.pg)
            self.assertAlmostEqual(off, -shift * 1000, delta=5000)
        self.disk.put(f"{F}/a.png")
        a = self.m()
        a.sync(scan_time=int(real() * 1000) + 86400000)       # skan "z przyszlosci" wg zegara klienta
        self.assertEqual(self.row(f"{F}/a.png")["origin"], "m")


# ===================================================================================================
# Wstrzymanie, kanarki, swiadek, hamulec, pary, cofanie
# ===================================================================================================

class MConfirm(Base):
    def _filler(self, n: int = 80) -> None:
        """Duzy, nietykany folder: foldery wyzszego rzedu (np. '- polska') nie przekraczaja 20 % oznaczonych."""
        for i in range(n):
            self.disk.put(f"- POLSKA/1 - PRODUKTY/Wypelniacz/w{i}.png", 1_600_000_000)

    def _catalog(self, folders: int = 8, per: int = 4) -> list[str]:
        self._filler()
        rels = []
        for d in range(folders):
            for i in range(per):
                rel = f"- POLSKA/1 - PRODUKTY/P{d}/f{i}.png"
                self.disk.put(rel, 1_700_000_000 + d)
                rels.append(rel)
        return rels

    def test_wstrzymanie_folderu_pliki_wracaja_przed_hold(self):                                # S14
        self.rules("on", hold_ms=5000)
        self._filler()
        for i in range(12):
            self.disk.put(f"{F}/f{i}.png")
        for i in range(8):
            self.disk.put(f"- POLSKA/1 - PRODUKTY/Beta/g{i}.png")
        a = self.m()
        a.sync()
        for i in range(6):
            self.disk.rm(f"{F}/f{i}.png")
        a.sync()
        self.settle()
        rep = a.confirm()
        self.assertEqual(rep["deleted"], 0, rep)
        self.assertEqual(rep["held"], 6, rep)
        self.assertEqual([(h["folder"], h["gone"]) for h in rep["holds"]], [("- polska/1 - produkty/alfa", 6)])
        self.assertGreater(rep["holds"][0]["release_at"], 0)
        for i in range(6):                                    # wracaja przed hold_ms
            self.disk.put(f"{F}/f{i}.png")
        a.sync()
        self.settle()
        rep = a.confirm()
        self.assertEqual((rep["deleted"], rep["present"]), (0, 6), rep)
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE missing_since_ms IS NOT NULL")[0]["n"], 0)
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE deleted_at IS NOT NULL")[0]["n"], 0)

    def test_wstrzymanie_potem_partia_i_cofniecie(self):                                        # S15
        self.rules("on", hold_ms=5000)
        self._filler()
        for i in range(12):
            self.disk.put(f"{F}/f{i}.png")
        for i in range(8):
            self.disk.put(f"- POLSKA/1 - PRODUKTY/Beta/g{i}.png")
        a = self.m()
        a.sync()
        for i in range(6):
            self.disk.rm(f"{F}/f{i}.png")
        a.sync()
        self.settle()
        rep = a.confirm()
        self.assertEqual((rep["deleted"], rep["held"]), (0, 6), rep)
        self.wait_release(rep)                                # hold_ms = 5000
        rep = a.confirm()
        self.assertEqual(rep["deleted"], 6, rep)
        batch = rep["last_batch"]
        self.assertEqual(len(self.q("SELECT 1 FROM dam_assets WHERE delete_batch = %s", (batch,))), 6)
        self.assertEqual([b["batch"] for b in asset_sync_m.list_batches(self.pg)], [batch])
        ids = asset_sync_m.undo_batch(self.pg, a.writer, batch)
        self.assertEqual(len(ids), 6)
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE deleted_at IS NOT NULL")[0]["n"], 0)
        self.assertEqual(asset_sync_m.undo_batch(self.pg, a.writer, batch), [], "drugie cofniecie: nic do roboty")
        a.pull()
        a.sync()                                              # pliki nadal nie istnieja na dysku
        self.settle()
        rep = a.confirm()
        self.assertEqual((rep["deleted"], rep["marked"]), (0, 0), "po cofnieciu nie znikaja ponownie")

    def test_pusty_folder_jest_wstrzymany(self):                                                # S16
        self.rules("on", hold_ms=5000)
        self._filler()
        for i in range(3):
            self.disk.put(f"{F}/f{i}.png")
        self.disk.put("- POLSKA/1 - PRODUKTY/Beta/g.png")
        a = self.m()
        a.sync()
        for i in range(3):
            self.disk.rm(f"{F}/f{i}.png")                     # folder zostaje, ale jest pusty
        a.sync()
        self.settle()
        rep = a.confirm()
        self.assertEqual((rep["deleted"], rep["held"]), (0, 3), rep)
        self.wait_release(rep)
        self.assertEqual(a.confirm()["deleted"], 3)

    def test_dysk_niedostepny_na_poczatku_zero_usuniec_oznaczenia_zostaja(self):                # S17
        rels = self._catalog()
        a = self.m()
        a.sync()
        self.disk.rm(rels[0])
        a.sync()
        self.settle()
        gone = self.tmp / "Marketing-nieosiagalny"
        os.rename(self.disk.root, gone)
        try:
            rep = a.confirm()
        finally:
            os.rename(gone, self.disk.root)
        self.assertFalse(rep["ok"])
        self.assertEqual(rep["error"], "disk_unavailable", rep)
        self.assertEqual(rep["deleted"], 0)
        self.assertIsNotNone(self.row(rels[0])["missing_since_ms"], "oznaczenie zostaje")
        # przebieg skanu przy niedostepnym dysku: zadnych oznaczen (brak wylistowanych folderow)
        res = asset_sync.sync_cycle(self.pg, a.rows, scan={}, scanned_dirs=set(), scan_time_ms=int(time.time() * 1000),
                                    machine=OWNER, root_gen="g", role="m", m_mode="on", writer=a.writer,
                                    scan_db_ms=int(time.time() * 1000), pull_sql=asset_sync._SQL_PULL_M)
        self.assertEqual(res["m"]["marked"], 0)

    def test_nieosiagalny_nie_jest_nie_ma(self):
        rels = self._catalog(4, 4)
        a = self.m()
        a.sync()
        self.disk.rm(rels[0])
        a.sync()
        self.settle()
        calls = {"n": 0}
        real = asset_sync_m._probe_fn(str(self.disk.root), None)

        def probe(rel, cache=None):
            calls["n"] += 1
            if rel.lower().endswith("f0.png") and "p0" in rel.lower():
                return {"state": "nieosiagalny", "gone": "", "empty_parent": False, "reason": "siec"}
            return real(rel, cache)

        rep = a.confirm(probe=probe)
        self.assertEqual((rep["deleted"], rep["unreachable"]), (0, 1), rep)
        self.assertIsNone(self.row(rels[0])["deleted_at"])
        self.assertIsNotNone(self.row(rels[0])["missing_since_ms"])

    def test_dysk_znika_w_polowie_przebiegu_cofa_partie_w_toku(self):                          # S27, P2
        rels = self._catalog(10, 4)
        a = self.m()
        a.sync()
        for d in range(9):
            self.disk.rm(rels[d * 4])                          # po jednym pliku z 9 folderow (bez wstrzymania)
        a.sync()
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE missing_since_ms IS NOT NULL")[0]["n"], 9)
        self.settle()
        real = asset_sync_m._probe_fn(str(self.disk.root), None)
        n = {"i": 0, "dead": False}

        def probe(rel, cache=None):
            n["i"] += 1
            # 20 kanarkow poczatkowych + 9 sond plikow + 20 kanarkow przed 1. paczka (4 znaczniki) przechodza;
            # przed 2. paczka udzial "znika": transakcja w toku wycofana, 1. paczka cofnieta instrukcja M8
            if n["dead"] or n["i"] > 50:
                n["dead"] = True
                return {"state": "nieosiagalny", "gone": "", "empty_parent": False, "reason": "udzial zniknal"}
            return real(rel, cache)

        with patch.object(asset_sync_m, "DELETE_COMMIT_EVERY", 4):
            rep = a.confirm(probe=probe)
        self.assertFalse(rep["ok"], rep)
        self.assertEqual(rep["error"], "disk_unavailable")
        self.assertEqual((rep["deleted"], rep["undone"]), (0, 4), rep)
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE deleted_at IS NOT NULL")[0]["n"], 0,
                         "zero znacznikow po porazce kanarkow (cofniete M8)")

    def test_kanarki_co_N_sond_przerywaja_przebieg_bez_usuniec(self):
        rels = self._catalog(8, 4)
        a = self.m()
        a.sync()
        for d in range(8):
            self.disk.rm(rels[d * 4])
        a.sync()
        self.settle()
        real = asset_sync_m._probe_fn(str(self.disk.root), None)
        st = {"n": 0}

        def probe(rel, cache=None):
            st["n"] += 1
            if st["n"] > 12:                                    # kanarki poczatkowe przeszly, potem dysk pada
                return {"state": "nieosiagalny", "gone": "", "empty_parent": False, "reason": ""}
            return real(rel, cache)

        with patch.object(asset_sync_m, "CANARY_EVERY", 5):
            rep = a.confirm(probe=probe)
        self.assertEqual((rep["ok"], rep["error"], rep["deleted"]), (False, "disk_unavailable", 0), rep)

    def test_hamulec_klient_tnie_partie_do_batch_max_files(self):                               # P3, S29
        rels = self._catalog(10, 4)
        self.rules("on", batch_max_files=3)
        a = self.m()
        a.sync()
        for d in range(8):
            self.disk.rm(rels[d * 4])
        a.sync()
        self.settle()
        rep = a.confirm()
        self.assertEqual((rep["deleted"], rep["deferred_by_cap"]), (3, 5), rep)
        first = rep["last_batch"]
        rep2 = a.confirm()
        self.assertEqual(rep2["deleted"], 3, rep2)
        self.assertNotEqual(rep2["last_batch"], first)
        counts = self.q("SELECT delete_batch, count(*) AS n FROM dam_assets WHERE delete_batch IS NOT NULL "
                        "GROUP BY 1 ORDER BY 1")
        self.assertTrue(all(c["n"] <= 3 for c in counts), counts)

    def test_swiadek_trzy_zgodne_serie_potem_partia_w(self):                                    # S18b, P4, O1
        rels = self._catalog(10, 4)                            # 40 plikow, 8 zniknie = 20 % > 5 %
        a = self.m()
        a.sync()
        for d in range(8):
            self.disk.rm(rels[d * 4])
        a.sync()
        self.settle()
        with patch.object(asset_sync_m, "WITNESS_MIN", 5), patch.object(asset_sync_m, "WITNESS_GAP_MS", 0):
            r1 = a.confirm()
            self.assertTrue(r1["witness_tripped"])
            self.assertEqual((r1["witness"]["series"], r1["deleted"]), (1, 0), r1)
            r2 = a.confirm()
            self.assertEqual((r2["witness"]["series"], r2["deleted"]), (2, 0), r2)
            r3 = a.confirm()
            self.assertEqual(r3["witness"]["series"], 3, r3)
            self.assertEqual(r3["deleted"], 8, r3)
            self.assertTrue(r3["last_batch"].startswith("w-"), r3["last_batch"])
        self.assertEqual(len(self.q("SELECT 1 FROM dam_assets WHERE delete_batch LIKE 'w-%'")), 8)

    def test_swiadek_zmiana_zbioru_zaczyna_licznik_od_nowa(self):                               # S18c, P4
        rels = self._catalog(10, 4)
        a = self.m()
        a.sync()
        for d in range(8):
            self.disk.rm(rels[d * 4])
        a.sync()
        self.settle()
        with patch.object(asset_sync_m, "WITNESS_MIN", 5), patch.object(asset_sync_m, "WITNESS_GAP_MS", 0):
            self.assertEqual(a.confirm()["witness"]["series"], 1)
            self.assertEqual(a.confirm()["witness"]["series"], 2)
            self.disk.put(rels[0], 1_700_000_000)              # jeden plik wraca miedzy seriami
            r3 = a.confirm()
            self.assertEqual((r3["witness"]["series"], r3["deleted"]), (1, 0), r3)
            self.assertEqual(r3["present"], 1)
            self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE deleted_at IS NOT NULL")[0]["n"], 0)

    def test_swiadek_konczy_gdy_oznaczonych_ponizej_progu(self):
        rels = self._catalog(10, 4)
        a = self.m()
        a.sync()
        for d in range(8):
            self.disk.rm(rels[d * 4])
        a.sync()
        self.settle()
        with patch.object(asset_sync_m, "WITNESS_MIN", 5), patch.object(asset_sync_m, "WITNESS_GAP_MS", 0):
            a.confirm()
            self.assertIsNotNone(self.q("SELECT 1 FROM dam_meta WHERE key = 'm_witness'") or None)
            for d in range(8):                                  # wszystkie wracaja
                self.disk.put(rels[d * 4], 1_700_000_000 + d)
            a.confirm()                                         # seria: "jest" -> oznaczenia zdjete (M5)
            self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE missing_since_ms IS NOT NULL")[0]["n"], 0)
            a.confirm()                                         # marked == 0 -> M14
        self.assertEqual(self.q("SELECT 1 FROM dam_meta WHERE key = 'm_witness'"), [])

    def test_pary_folderow_przenosza_skojarzenia(self):                                         # S22
        self._filler()
        for i in range(4):
            self.disk.put(f"- POLSKA/Stary/f{i}.png", 1_700_000_000 + i)
        for i in range(8):
            self.disk.put(f"- POLSKA/Inny/g{i}.png")
        a = self.m()
        a.sync()
        cur = self.pg.cursor()
        for i in range(4):
            cur.execute("INSERT INTO dam_asset_product_links (asset_id, product_id, score, source, status, reason, "
                        "updated_at, updated_by) VALUES (%s, 'P-1', 1, 'auto', 'ok', '', 'x', 'x')",
                        (aid_of(f"- POLSKA/Stary/f{i}.png"),))
        self.pg.commit()
        self.disk.mv("- POLSKA/Stary", "- POLSKA/Nowy")
        a.sync()
        self.settle()
        rep = a.confirm()
        self.assertEqual(rep["deleted"], 4, rep)
        self.assertEqual([(p["from"], p["to"], p["matched"]) for p in rep["pairs"]],
                         [("- polska/stary", "- polska/nowy", 4)])
        self.assertEqual(rep["moved_links"], 4)
        links = self.q("SELECT asset_id FROM dam_asset_product_links ORDER BY asset_id")
        self.assertEqual(len(links), 8, "stare skojarzenia zostaja przy znacznikach, nowe doszly")
        new_ids = {aid_of(f"- POLSKA/Nowy/f{i}.png") for i in range(4)}
        self.assertTrue(new_ids <= {r["asset_id"] for r in links})

    def test_tryb_shadow_zapisuje_stempel_i_oznaczenie_ale_nie_usuwa(self):
        for n in "abc":
            self.disk.put(f"{F}/{n}.png")
        self.rules("shadow")
        a = self.m(SECOND, mode="shadow")        # spoza listy index_authority: stare usuniecie odrzuca baza
        a.sync()
        self.assertIsNone(self.row(f"{F}/a.png")["origin"], "nowy wiersz shadow ma origin puste, nie copy")
        a.sync()
        self.assertEqual(self.row(f"{F}/a.png")["origin"], "m", "stempel w kolejnym skanie")
        self.disk.rm(f"{F}/a.png")
        res = a.sync()
        self.assertEqual(res["m"]["marked"], 1)
        self.settle()
        rep = a.confirm(apply=False, cfg=self.cfg)
        self.assertEqual((rep["deleted"], rep["would_delete"]), (0, 1), rep)
        self.assertIsNone(self.row(f"{F}/a.png")["deleted_at"])
        r = self.row(f"{F}/a.png")
        self.assertGreater(r["checked_ms"], r["missing_since_ms"] - 1, "dzierzawa sondy zapisana")
        with patch.object(asset_sync_m, "SHADOW_RECHECK_MS", 21_600_000):
            rep2 = a.confirm(apply=False, cfg=self.cfg)
        self.assertEqual(rep2["claimed"], 0, "w shadow plik nie jest sondowany co minute (6 h)")


# ===================================================================================================
# Przelacznik, gotowosc bazy, runner
# ===================================================================================================

class MSwitchAndRunner(Base):
    def test_zly_json_i_nienumeryczne_wartosci_to_tryb_off_bez_wyjatku(self):
        self.set_meta("m_rules", "{zepsuty")
        self.assertEqual(asset_sync_m.read_rules(self.pg)["mode"], "off")
        self.set_meta("m_rules", json.dumps({"mode": "on", "confirm_ms": "abc", "hold_ms": -5}))
        cfg = asset_sync_m.read_rules(self.pg)
        self.assertEqual((cfg["mode"], cfg["confirm_ms"], cfg["hold_ms"]), ("on", 90000, 900000))
        self.set_meta("m_rules", None)
        self.assertEqual(asset_sync_m.read_rules(self.pg)["mode"], "off")
        a = self.m()
        self.disk.put(f"{F}/a.png")
        self.set_meta("m_rules", "{zepsuty")
        a.mode = "off"
        a.sync()                                                # baza traktuje jak off: zapis przechodzi
        self.assertIsNone(self.row(f"{F}/a.png")["origin"])

    def test_kolumny_i_funkcja_sa_wykryte(self):
        self.assertTrue(asset_sync_m.columns_ready(self.pg))

    def _scan_files(self, data_dir: Path, scan_time: int, root: Path):
        assets = []
        for dirpath, _dn, files in os.walk(root):
            for fn in files:
                full = os.path.join(dirpath, fn)
                st = os.stat(full)
                assets.append({"path": full.replace("\\", "/"), "size_bytes": st.st_size,
                               "mtime_ms": int(st.st_mtime * 1000), "sku": "1"})
        (data_dir / "branding-index.scan.json").write_text(json.dumps({"assets": assets}), encoding="utf-8")
        dirs = sorted({asset_sync.dir_key(dp, str(root)) for dp, _d, _f in os.walk(root)})
        (data_dir / "branding-scan-dirs.json").write_text(json.dumps({
            "version": 1, "scan_time_ms": scan_time, "root": str(root).replace("\\", "/"),
            "scanned_dirs": dirs, "failed_dirs": []}), encoding="utf-8")

    def test_run_once_i_confirm_tick_od_poczatku_do_cofniecia(self):                            # K1 + K4
        self.set_meta("asset_index_mode", "rows")
        for n in "abcd":
            self.disk.put(f"{F}/{n}.png")
        data_dir = self.tmp / "data"
        data_dir.mkdir()
        db_path = self.tmp / "dam-local.sqlite"
        connect = lambda: __import__("psycopg2").connect(  # noqa: E731
            _ST["dsn"], cursor_factory=__import__("psycopg2.extras", fromlist=["x"]).RealDictCursor)
        kw = dict(root_alive=True, root_path=str(self.disk.root), machine=OWNER, pg_connect=connect)
        with patch.object(asset_sync_m, "resolve_role", return_value="m"), \
                patch("index_authority.may_publish", return_value=True):
            t0 = int(time.time() * 1000)
            self._scan_files(data_dir, t0, self.disk.root)
            rep = asset_sync_runner.run_once(db_path, data_dir, on_index_written=None, **kw)
            self.assertTrue(rep["ok"], rep)
            self.assertEqual((rep["role"], rep["m_mode"]), ("m", "on"))
            self.assertEqual(self.row(f"{F}/a.png")["origin"], "m")
            self.disk.rm(f"{F}/c.png")
            self._scan_files(data_dir, t0 + 5000, self.disk.root)
            rep = asset_sync_runner.run_once(db_path, data_dir, on_index_written=None, **kw)
            self.assertTrue(rep["ok"], rep)
            self.assertEqual(rep["missing_marked_new"], 1, rep)
            self.assertEqual(rep["assets_max_rev"], rep["max_rev"])
            self.assertEqual(rep["blocked"], {})
            self.assertIsNone(self.row(f"{F}/c.png")["deleted_at"])
            self.settle()
            tick = asset_sync_runner.confirm_tick(db_path, data_dir, **kw)
            self.assertTrue(tick["ok"], tick)
            self.assertEqual(tick["deleted"], 1, tick)
            batch = tick["last_batch"]
            lst = asset_sync_runner.list_batches(connect)
            self.assertEqual([(b["batch"], b["files"]) for b in lst["items"]], [(batch, 1)])
            self.assertEqual(asset_sync_runner.undo_batch(connect, machine=OWNER, root_path=str(self.disk.root),
                                                          batch="zly nazwa!")["error"], "bad_batch")
            res = asset_sync_runner.undo_batch(connect, machine=OWNER, root_path=str(self.disk.root), batch=batch)
            self.assertEqual((res["ok"], res["restored"]), (True, 1), res)
            self.assertIsNone(self.row(f"{F}/c.png")["deleted_at"])
        # kopia: tylko pobiera / dodaje, cofniecie niedostepne
        with patch.object(asset_sync_m, "resolve_role", return_value="copy"):
            res = asset_sync_runner.undo_batch(connect, machine=COPY, root_path=str(self.disk.root), batch=batch)
            self.assertEqual(res["error"], "not_m_computer")
            self.assertEqual(asset_sync_runner.confirm_tick(db_path, data_dir, **kw)["skipped"], "copy")
        self.rules("off")
        self.assertEqual(asset_sync_runner.undo_batch(connect, machine=OWNER, root_path=str(self.disk.root),
                                                      batch=batch)["error"], "rules_off")
        self.assertEqual(asset_sync_runner.confirm_tick(db_path, data_dir, **kw)["skipped"], "mode_off")
        self.assertEqual(asset_sync_runner.list_batches(connect), {"ok": True, "items": []})

    def test_kopia_w_trybie_on_idzie_sciezka_ograniczona_takze_z_listy_authority(self):
        self.set_meta("asset_index_mode", "rows")
        self.set_meta("index_authority", json.dumps({"machines": [OWNER, COPY]}))
        bdisk = Disk(self.tmp / "B")
        bdisk.put(f"{F}/k.png")
        data_dir = self.tmp / "dataB"
        data_dir.mkdir()
        connect = lambda: __import__("psycopg2").connect(  # noqa: E731
            _ST["dsn"], cursor_factory=__import__("psycopg2.extras", fromlist=["x"]).RealDictCursor)
        self._scan_files(data_dir, int(time.time() * 1000), bdisk.root)
        with patch.object(asset_sync_m, "resolve_role", return_value="copy"), \
                patch("index_authority.may_publish", return_value=True), \
                patch.object(asset_sync_runner, "_sync_cycle_restricted_ops",
                             wraps=asset_sync_runner._sync_cycle_restricted_ops) as restricted:
            rep = asset_sync_runner.run_once(self.tmp / "b.sqlite", data_dir, root_alive=True,
                                             root_path=str(bdisk.root), machine=COPY, pg_connect=connect)
        self.assertTrue(rep["ok"], rep)
        restricted.assert_called_once()
        self.assertEqual(self.row(f"{F}/k.png")["origin"], "copy")

    def test_brak_kolumn_w_bazie_klient_dziala_jak_2_6_0_bez_wyjatkow(self):
        import psycopg2  # noqa: PLC0415
        import realpg  # noqa: PLC0415

        with realpg.fresh_db(os.environ["DAM_TEST_PG_DSN"]) as dsn2:     # schemat BEZ m_columns / m_rules
            _run_script(dsn2, (SQL / "authority_gate.sql").read_text(encoding="utf-8"))
            conn = psycopg2.connect(dsn2)
            conn.autocommit = True
            conn.cursor().execute("INSERT INTO dam_meta (key, value) VALUES ('asset_index_mode', 'rows'), "
                                  "('m_rules', '{\"mode\": \"on\"}')")
            conn.close()
            import psycopg2.extras  # noqa: PLC0415

            pg = psycopg2.connect(dsn2, cursor_factory=psycopg2.extras.RealDictCursor)
            try:
                self.assertFalse(asset_sync_m.columns_ready(pg))
                self.assertFalse(asset_sync_m.columns_ready(pg), "drugi raz: z pamieci, nadal bez wyjatku")
            finally:
                pg.close()
            self.disk.put(f"{F}/a.png")
            data_dir = self.tmp / "dataN"
            data_dir.mkdir()
            self._scan_files(data_dir, int(time.time() * 1000), self.disk.root)
            connect = lambda: psycopg2.connect(dsn2, cursor_factory=psycopg2.extras.RealDictCursor)  # noqa: E731
            asset_sync_m.reset_caches()
            with patch.object(asset_sync_m, "resolve_role", return_value="m"):
                for _ in range(2):
                    rep = asset_sync_runner.run_once(self.tmp / "n.sqlite", data_dir, root_alive=True,
                                                     root_path=str(self.disk.root), machine=OWNER, pg_connect=connect)
                    self.assertTrue(rep["ok"], rep)
                    self.assertTrue(rep["m_columns_missing"])
                    self.assertEqual((rep["role"], rep["m_mode"]), ("copy", "off"))
            pg = connect()
            try:
                cur = pg.cursor()
                cur.execute("SELECT count(*) AS n FROM dam_assets")
                self.assertEqual(cur.fetchone()["n"], 1, "dziala jak 2.6.0: plik dodany starymi instrukcjami")
            finally:
                pg.close()


# ===================================================================================================
# Narzedzie uzgodnienia (K6): bin/scripts/ops/reconcile-catalog-with-m.py
# ===================================================================================================

def _load_reconcile():
    import importlib.util  # noqa: PLC0415

    path = DESKTOP.parent.parent / "scripts" / "ops" / "reconcile-catalog-with-m.py"
    spec = importlib.util.spec_from_file_location("reconcile_catalog_with_m", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class Reconcile(Base):
    FILL = "- POLSKA/1 - PRODUKTY/Wypelniacz"

    def setUp(self):
        super().setUp()
        self.rc = _load_reconcile()
        self.work = self.tmp / "uzgodnienie"
        self.connect = lambda: __import__("psycopg2").connect(  # noqa: E731
            _ST["dsn"], cursor_factory=__import__("psycopg2.extras", fromlist=["x"]).RealDictCursor)
        pp = patch.object(asset_sync_m, "resolve_role", return_value="m")
        pp.start()
        self.addCleanup(pp.stop)
        pp = patch("index_authority.may_publish", return_value=True)
        pp.start()
        self.addCleanup(pp.stop)
        self._seed()

    def _old_add(self, rels, mtime=1_700_000_000_000):
        ops = []
        for rel in rels:
            aid, entry = asset_sync.scan_entry(f"M:/{rel}", size=3, mtime_ms=mtime, root="M:", meta={"sku": "1"})
            ops.append(asset_sync._op(asset_sync.OP_UPSERT, aid, entry, None, "OLDPC", 1, "add"))
        self.assertEqual(asset_sync.push_ops(self.pg, ops, now_ms=1)["applied"], len(ops))

    def _seed(self):
        """Katalog sprzed 1a (origin puste): 30 plikow na dysku, 3 widma, folder Stary (4 pliki), ktory przeniesiono
        do Nowy (4 pliki na dysku), oraz jeden wpis 'copy'."""
        self.rules("off")
        self.present = [f"{self.FILL}/w{i}.png" for i in range(30)]
        for rel in self.present:
            self.disk.put(rel, 1_700_000_000)
        self.ghosts = [f"- POLSKA/1 - PRODUKTY/Alfa/g{i}.png" for i in range(3)]
        self.old_dir = [f"- POLSKA/Stary/f{i}.png" for i in range(4)]
        self.new_dir = [f"- POLSKA/Nowy/f{i}.png" for i in range(4)]
        for rel in self.new_dir:
            self.disk.put(rel, 1_700_000_000)
        self._old_add(self.present + self.ghosts + self.old_dir + self.new_dir)
        cur = self.pg.cursor()
        for rel in self.old_dir:
            cur.execute("INSERT INTO dam_asset_product_links (asset_id, product_id, score, source, status, reason, "
                        "updated_at, updated_by) VALUES (%s, 'P-1', 1, 'auto', 'ok', '', 'x', 'x')", (aid_of(rel),))
        self.pg.commit()
        self.rules("on")
        # wpis "tylko z kopii" (origin copy): kopia dodala plik, ktorego nie ma na M:
        bdisk = Disk(self.tmp / "B")
        bdisk.put(f"{self.FILL}/tylko-kopia.png")
        b = self.copy(disk=bdisk)
        b.sync()
        self.assertEqual(self.row(f"{self.FILL}/tylko-kopia.png")["origin"], "copy")
        self.snapshot0 = self._snapshot()

    def _snapshot(self):
        return (self.q("SELECT asset_id, rev, origin, deleted_at, missing_since_ms, master_seen_ms, delete_batch "
                       "FROM dam_assets ORDER BY asset_id"),
                self.q("SELECT asset_id, product_id FROM dam_asset_product_links ORDER BY 1, 2"),
                self.q("SELECT key FROM dam_meta WHERE key NOT IN ('m_rules','index_authority') ORDER BY key"))

    def run_main(self, *flags, probe=None):
        import contextlib  # noqa: PLC0415
        import io  # noqa: PLC0415

        sink = io.StringIO()
        with contextlib.redirect_stdout(sink):
            code = self.rc.main([*flags, "--root", str(self.disk.root), "--machine", OWNER,
                                 "--work-dir", str(self.work)], pg_connect=self.connect, probe=probe)
        self.out = sink.getvalue()
        return code

    def test_dry_run_nic_nie_zapisuje_i_raportuje(self):
        self.assertEqual(self.run_main("--dry-run"), 0, self.out)
        self.assertEqual(self._snapshot(), self.snapshot0, "dry-run zmienil baze")
        rep = json.loads(next(self.work.glob("dry-run-*[0-9].json")).read_text(encoding="utf-8"))
        self.assertEqual((rep["probed"], rep["present"], rep["absent"], rep["unreachable"]), (41, 34, 7, 0))
        self.assertEqual(rep["to_stamp"], 34)
        self.assertEqual(rep["to_mark"], 7)
        self.assertEqual([(p["from"], p["to"], p["matched"]) for p in rep["pairs"]],
                         [("- polska/stary", "- polska/nowy", 4)])
        self.assertEqual((rep["links_to_move"], rep["links_on_ghosts"]), (4, 4))
        self.assertEqual(len(rep["sample_absent"]), 7)
        self.assertNotIn(f"{self.FILL}/tylko-kopia.png".lower(), [s.lower() for s in rep["sample_absent"]])

    def test_mark_confirm_undo_krok_po_kroku(self):
        self.assertEqual(self.run_main("--mark"), 0, self.out)
        self.assertEqual(len(self.q("SELECT asset_id FROM dam_assets WHERE missing_since_ms IS NOT NULL")), 7)
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE origin = 'm'")[0]["n"], 34)
        before = {r["asset_id"]: r["rev"] for r in self.snapshot0[0]}
        after = {r["asset_id"]: r["rev"] for r in self._snapshot()[0]}
        self.assertEqual(before, after, "--mark nie nadaje nowych numerow zmian")
        self.assertEqual(self.run_main("--confirm"), 3, "przerwa 15 minut: odmowa")
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE deleted_at IS NOT NULL")[0]["n"], 0)
        self.assertEqual(self.run_main("--confirm", "--min-gap-min", "0"), 0, self.out)
        rep = json.loads(next(self.work.glob("confirm-*.json")).read_text(encoding="utf-8"))
        self.assertEqual((rep["absent"], rep["deleted"], rep["moved_links"]), (7, 7, 4), rep)
        batch = rep["batch"]
        self.assertTrue(batch.startswith("r-"))
        self.assertEqual(len(self.q("SELECT 1 FROM dam_assets WHERE delete_batch = %s", (batch,))), 7)
        self.assertIsNone(self.row(f"{self.FILL}/tylko-kopia.png")["deleted_at"], "wiersze 'tylko z kopii' nietkniete")
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_asset_product_links")[0]["n"], 8)
        self.assertEqual(len(self.q("SELECT value FROM dam_meta WHERE key = 'm_catalog_count'")), 1)
        self.assertEqual(self.run_main("--undo", batch), 0, self.out)
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE deleted_at IS NOT NULL")[0]["n"], 0)

    def test_zwykla_praca_nie_ruszy_widm_sprzed_1a(self):
        a = self.m()
        a.pull()
        a.sync()
        a.sync()
        self.settle()
        rep = a.confirm()
        self.assertEqual((rep["deleted"], rep["marked"]), (0, 0), rep)
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE deleted_at IS NOT NULL")[0]["n"], 0)

    def test_confirm_dysk_znika_w_polowie_zero_znacznikow_oznaczenia_zachowane(self):          # S27
        self.assertEqual(self.run_main("--mark"), 0, self.out)
        marked_before = self.q("SELECT count(*) AS n FROM dam_assets WHERE missing_since_ms IS NOT NULL")[0]["n"]
        calls = {"n": 0}
        real = asset_sync_m.run_canaries

        def flaky(pool, probe, **kw):
            calls["n"] += 1
            res = real(pool, probe, **kw)
            if calls["n"] >= 3:                       # poczatek i pierwsza paczka przechodza, druga nie
                res["passed"] = False
            return res

        with patch.object(asset_sync_m, "run_canaries", flaky), patch.object(asset_sync_m, "DELETE_COMMIT_EVERY", 3):
            code = self.run_main("--confirm", "--min-gap-min", "0")
        self.assertEqual(code, 4, self.out)
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE delete_batch LIKE 'r-%'")[0]["n"], 0,
                         "zero wierszy z partia r-...")
        self.assertEqual(self.q("SELECT count(*) AS n FROM dam_assets WHERE deleted_at IS NOT NULL")[0]["n"], 0)
        self.assertIn("dysk M: przestal odpowiadac", self.out)
        self.assertGreater(marked_before, 0)

    def test_odmowa_gdy_nieosiagalnych_ponad_1_procent(self):
        real = asset_sync_m._probe_fn(str(self.disk.root), None)
        n = {"i": 0}

        def probe(rel, cache=None):
            n["i"] += 1
            if n["i"] % 10 == 0:
                return {"state": "nieosiagalny", "gone": "", "empty_parent": False, "reason": "siec"}
            return real(rel, cache)

        self.assertEqual(self.run_main("--mark", probe=probe), 4, self.out)
        self.assertEqual(self._snapshot(), self.snapshot0, "odmowa przed jakimkolwiek zapisem")

    def test_mark_wymaga_trybu_on_i_roli_m(self):
        self.rules("shadow")
        self.assertEqual(self.run_main("--mark"), 3)
        self.rules("on")
        with patch.object(asset_sync_m, "resolve_role", return_value="copy"):
            self.assertEqual(self.run_main("--mark"), 3)
        self.assertEqual(self._snapshot(), self.snapshot0)

    def test_backup_tworzy_tabele_kopii_i_zrzut_z_suma(self):
        # tabele kopii powstaja w schemacie testu i znikaja razem z nim (realpg.fresh_db)
        self.assertEqual(self.run_main("--backup"), 0, self.out)
        self.assertEqual(self.run_main("--backup"), 3, "druga kopia tego samego dnia: odmowa, nic nie nadpisuje")
        day = time.strftime("%Y%m%d")
        n = self.q(f"SELECT count(*) AS n FROM dam_assets_bak_{day}")[0]["n"]
        self.assertEqual(n, self.q("SELECT count(*) AS n FROM dam_assets")[0]["n"])
        self.assertTrue((self.work / f"dam_assets_bak_{day}.jsonl.gz.sha256").is_file())

    def test_m_validate_zatwierdza_ograniczenie_origin(self):
        _run_script(_ST["dsn"], (SQL / "m_validate.sql").read_text(encoding="utf-8"))
        self.assertTrue(self.q("SELECT convalidated FROM pg_constraint WHERE conname = 'dam_assets_origin_chk' "
                               "AND conrelid = to_regclass('dam_assets')")[0]["convalidated"])


class EnableScript(Base):
    """bin/scripts/ops/enable-m-rules.py: instalacja i przelacznik (struktury zmienia tylko ten skrypt)."""

    def setUp(self):
        super().setUp()
        import importlib.util  # noqa: PLC0415

        path = DESKTOP.parent.parent / "scripts" / "ops" / "enable-m-rules.py"
        spec = importlib.util.spec_from_file_location("enable_m_rules", path)
        self.mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.mod)
        self.connect = lambda: __import__("psycopg2").connect(  # noqa: E731
            _ST["dsn"], cursor_factory=__import__("psycopg2.extras", fromlist=["x"]).RealDictCursor)

    def run_main(self, *argv):
        import contextlib  # noqa: PLC0415
        import io  # noqa: PLC0415

        sink = io.StringIO()
        with contextlib.redirect_stdout(sink):
            code = self.mod.main(list(argv), connect=self.connect)
        self.out = sink.getvalue()
        return code

    def test_status_i_przelaczanie_trybu_z_zachowaniem_ustawien(self):
        self.assertEqual(self.run_main("--status"), 0)
        self.assertIn('"columns": "11/11"', self.out)
        self.assertEqual(self.run_main("--mode", "shadow"), 0)         # bez --apply nic nie zapisuje
        self.assertEqual(asset_sync_m.read_rules(self.pg)["mode"], "on")
        self.rules("on", batch_max_files=7)
        self.assertEqual(self.run_main("--mode", "shadow", "--apply"), 0, self.out)
        cfg = asset_sync_m.read_rules(self.pg)
        self.assertEqual((cfg["mode"], cfg["batch_max_files"]), ("shadow", 7), "ustawienia zostaja")
        self.assertEqual(self.run_main("--mode", "off", "--apply"), 0, self.out)
        self.assertEqual(asset_sync_m.read_rules(self.pg)["mode"], "off")

    def test_odmowa_trybu_bez_zatwierdzonego_komputera_z_M(self):
        cur = self.pg.cursor()
        cur.execute("DELETE FROM dam_m_computers")
        self.pg.commit()
        self.assertEqual(self.run_main("--mode", "on", "--apply"), 3)
        self.assertIn("zatwierdzonego komputera z M:", self.out)
        self.assertEqual(asset_sync_m.read_rules(self.pg)["mode"], "on", "odmowa przed zapisem (stan z setUp)")

    def test_print_sql_i_walidacja_argumentow(self):
        import contextlib  # noqa: PLC0415
        import io  # noqa: PLC0415

        sink = io.StringIO()
        with contextlib.redirect_stdout(sink):
            self.assertEqual(self.mod.main(["--install", "--print-sql"]), 0)
            self.assertEqual(self.mod.main(["--status", "--install"]), 2)
            self.assertEqual(self.mod.main(["--status"]), 2, "brak DSN")
        text = sink.getvalue()
        self.assertIn("ADD COLUMN IF NOT EXISTS origin", text)
        self.assertIn("CREATE TRIGGER dam_assets_rules", text)

    def test_ponowne_wlaczenie_bramki_nie_zaklada_drugiego_wyzwalacza(self):
        """authority_gate.sql nalozony ponownie przy dzialajacym dam_assets_rules zostawia jeden wyzwalacz."""
        _run_script(_ST["dsn"], (SQL / "authority_gate.sql").read_text(encoding="utf-8"))
        names = {r["tgname"] for r in self.q("SELECT tgname FROM pg_trigger WHERE tgrelid = to_regclass('dam_assets') "
                                              "AND NOT tgisinternal")}
        self.assertIn("dam_assets_rules", names)
        self.assertNotIn("dam_authority_gate_assets", names)


class CanariesAndPool(unittest.TestCase):
    """Czysta logika kanarkow (bez bazy)."""

    def test_losowanie_z_wielu_galezi_i_progi(self):
        cands = [(f"id{b}-{i}", f"- POLSKA/G{b}/H/f{i}.png", f"- polska/g{b}/h/f{i}.png")
                 for b in range(12) for i in range(10)]
        pool = asset_sync_m.CanaryPool(cands, random.Random(1))
        picks = pool.draw(20)
        self.assertEqual(len(picks), 20)
        self.assertGreaterEqual(len({rel.split("/")[1] for _a, rel in picks}), 5)
        self.assertEqual(len(set(picks)), 20)
        ok = lambda rel, cache=None: {"state": "jest"}  # noqa: E731
        self.assertTrue(asset_sync_m.run_canaries(pool, ok)["passed"])
        flaky = iter(["jest"] * 18 + ["nie_ma"] * 2)
        self.assertTrue(asset_sync_m.run_canaries(pool, lambda r, c=None: {"state": next(flaky)})["passed"])
        flaky = iter(["jest"] * 17 + ["nieosiagalny"] * 3)
        res = asset_sync_m.run_canaries(pool, lambda r, c=None: {"state": next(flaky)})
        self.assertFalse(res["passed"], res)
        flaky = iter(["jest"] * 19 + ["nieosiagalny"])
        self.assertFalse(asset_sync_m.run_canaries(pool, lambda r, c=None: {"state": next(flaky)}, need=20)["passed"])
        self.assertFalse(asset_sync_m.run_canaries(asset_sync_m.CanaryPool([]), ok)["passed"], "brak kanarkow = porazka")


if __name__ == "__main__":
    unittest.main()
