# -*- coding: utf-8 -*-
"""ADR-012 pkt 2: bramka w PostgreSQL (sql/authority_gate.sql) - TYLKO prawdziwy PG.

Baza: dam_eta_test na inyfinn-syno (rola dam_test), przez
bin/scripts/qa/testenv/run_realpg.py (DAM_TEST_PG_DSN). Kazdy test: wlasny schemat
t_<losowy> (realpg.fresh_db), tabela dziennika, wyzwalacze i funkcje tworzone w tym
schemacie. Bez DAM_TEST_PG_DSN testy sa pomijane (skip), nigdy nie lacza sie z produkcja.

Runda 2 (decyzja kierownika 28.09):
- dam_assets: odmowa = pominiecie TEGO wiersza (wyzwalacz RETURN NULL, RETURNING
  nic nie zwraca -> push_ops "refused") + wpis w dam_authority_rejects; reszta
  paczki (INSERT nowych plikow) przechodzi.
- dam_index_snapshots: odmowa = wyjatek "dam_not_authority:" (bez wpisu w dzienniku:
  INSERT przed RAISE jest wycofywany razem z transakcja - test to pokazuje).

Czerwone -> zielone: klasa BaselineWithoutGate pokazuje stan bez bramki (maszyna
spoza listy zapisuje tombstone / migawke mimo listy index_authority).
"""
from __future__ import annotations

import importlib.util
import json
import sqlite3
import sys
import tempfile
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
import asset_sync_runner  # noqa: E402
import index_snapshots  # noqa: E402

GATE_SQL = DESKTOP / "sql" / "authority_gate.sql"
SCRIPT = DESKTOP.parents[1] / "scripts" / "ops" / "enable-index-authority.py"
OWNER = "KRZYSZTOFWI"
OTHER = "KINGAUR"
ROOT = "M:"
REL = "- POLSKA/1 - PRODUKTY/Klopsiki 6300576/4 - WIZKI/wiz-01.png"
NEW_REL = "- POLSKA/1 - PRODUKTY/Klopsiki 6300576/4 - WIZKI/nowy.png"


def _load_script():
    spec = importlib.util.spec_from_file_location("enable_index_authority", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


class _RealPG(unittest.TestCase):
    """Wlasny schemat testowy + polaczenie (RealDictCursor) z search_path na niego."""

    apply_gate = True

    def setUp(self):
        import psycopg2  # noqa: PLC0415
        import psycopg2.extras  # noqa: PLC0415
        import realpg  # noqa: PLC0415

        admin_dsn = realpg.require(self)
        cm = realpg.fresh_db(admin_dsn)
        self.dsn = cm.__enter__()
        self.addCleanup(cm.__exit__, None, None, None)
        self._psycopg2 = psycopg2
        self.pg = psycopg2.connect(self.dsn, cursor_factory=psycopg2.extras.RealDictCursor,
                                   connect_timeout=10)
        self.addCleanup(self.pg.close)
        cur = self.pg.cursor()
        cur.execute("SELECT current_database() AS db, current_schema() AS s")
        row = cur.fetchone()
        self.assertTrue(str(row["db"]).startswith("dam_eta_test"), row)
        self.assertTrue(str(row["s"]).startswith("t_"), row)
        self.schema = row["s"]
        self.pg.commit()
        if self.apply_gate:
            self.install_gate()

    # -- pomocnicy ---------------------------------------------------------
    def connect(self):
        import psycopg2.extras  # noqa: PLC0415

        return self._psycopg2.connect(self.dsn, cursor_factory=psycopg2.extras.RealDictCursor,
                                      connect_timeout=10)

    def install_gate(self):
        cur = self.pg.cursor()
        cur.execute(GATE_SQL.read_text(encoding="utf-8"))
        self.pg.commit()
        # funkcje, wyzwalacze i dziennik powstaly w schemacie testu, nie w public
        cur.execute("SELECT n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
                    "WHERE p.proname = 'dam_authority_gate_assets'")
        # Baza testowa jest wspolna (inne testy / uprzaz e2e maja wlasne schematy z ta sama
        # funkcja) - liczy sie: jest w NASZYM schemacie i nie wyciekla do public.
        found = [r["nspname"] for r in cur.fetchall()]
        self.assertIn(self.schema, found)
        self.assertNotIn("public", found)
        cur.execute("SELECT to_regclass(%s) AS t", (f"{self.schema}.dam_authority_rejects",))
        self.assertIsNotNone(cur.fetchone()["t"])
        self.pg.commit()

    def set_machines(self, machines):
        cur = self.pg.cursor()
        if machines is None:
            cur.execute("DELETE FROM dam_meta WHERE key = 'index_authority'")
        else:
            cur.execute("INSERT INTO dam_meta (key, value) VALUES ('index_authority', %s) "
                        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                        (json.dumps({"machines": machines}),))
        self.pg.commit()

    def publish(self, key: str, built_by: str, payload: bytes = b'{"a": 1}'):
        """Prawdziwy pg_db.publish_index_snapshot (ten sam SQL co w 2.4.5 i dzis)
        na polaczeniu do schematu testu."""
        import hashlib

        import pg_db  # noqa: PLC0415

        with patch.object(pg_db, "connect", self.connect):
            return pg_db.publish_index_snapshot(
                key, payload, sha256=hashlib.sha256(payload).hexdigest(),
                built_at="2026-09-28T10:00:00+00:00", built_by=built_by)

    def snapshot_row(self, key: str):
        cur = self.pg.cursor()
        cur.execute("SELECT built_by, sha256 FROM dam_index_snapshots WHERE store_key = %s", (key,))
        row = cur.fetchone()
        self.pg.commit()
        return row

    def aid(self, rel: str = REL) -> str:
        return asset_sync.id_of(asset_sync.key_of(rel))

    def row(self, rel: str = REL):
        cur = self.pg.cursor()
        cur.execute("SELECT asset_id, size, mtime_ms, deleted_at, rev, meta, updated_by "
                    "FROM dam_assets WHERE asset_id = %s", (self.aid(rel),))
        r = cur.fetchone()
        self.pg.commit()
        return dict(r) if r else None

    def rejects(self):
        cur = self.pg.cursor()
        cur.execute("SELECT table_name, machine, asset_id, reason, hits FROM dam_authority_rejects "
                    "ORDER BY id")
        out = [dict(r) for r in cur.fetchall()]
        self.pg.commit()
        return out

    def upsert(self, machine: str, *, size: int, mtime: int, meta=None, rel: str = REL,
               reason: str = "change"):
        aid, entry = asset_sync.scan_entry(f"{ROOT}/{rel}", size=size, mtime_ms=mtime, root=ROOT,
                                           meta=meta or {"sku": "6300576"})
        prev = self.row(rel)
        op = asset_sync._op(asset_sync.OP_UPSERT, aid, entry, prev, machine, 99_000_000, reason)
        return asset_sync.push_ops(self.pg, [op], now_ms=99_000_000)

    def tombstone_op(self, machine: str, rel: str = REL) -> dict:
        prev = self.row(rel)
        op = asset_sync._op(asset_sync.OP_TOMBSTONE, self.aid(rel), {}, prev, machine,
                            99_000_000, "missing")
        op["mtime_ms"], op["size"] = prev["mtime_ms"], prev["size"]
        op["obs_mtime_ms"], op["obs_size"] = prev["mtime_ms"], prev["size"]
        return op

    def tombstone(self, machine: str, rel: str = REL):
        return asset_sync.push_ops(self.pg, [self.tombstone_op(machine, rel)], now_ms=99_000_000)

    def restore(self, machine: str, rel: str = REL):
        prev = self.row(rel)
        aid, entry = asset_sync.scan_entry(f"{ROOT}/{rel}", size=prev["size"],
                                           mtime_ms=prev["mtime_ms"], root=ROOT,
                                           meta={"sku": "6300576"})
        op = asset_sync._op(asset_sync.OP_RESTORE, aid, entry, prev, machine, 99_000_000,
                            "reappeared")
        return asset_sync.push_ops(self.pg, [op], now_ms=99_000_000)

    def assert_skipped(self, res, reason: str, *, rel: str = REL, machine: str = OTHER):
        """Odmowa bramki dam_assets: bez bledu, wiersz niezastosowany, wpis w dzienniku."""
        self.assertTrue(res["ok"], res)
        self.assertEqual((res["applied"], res["refused"]), (0, 1), res)
        hit = [r for r in self.rejects()
               if (r["table_name"], r["machine"], r["asset_id"], r["reason"])
               == ("dam_assets", machine, self.aid(rel), reason)]
        self.assertEqual(len(hit), 1, self.rejects())

    def seed(self):
        """Wlasciciel dodaje plik (bramka aktywna, wlasciciel przechodzi)."""
        res = self.upsert(OWNER, size=100, mtime=1_000_000, reason="add")
        self.assertEqual((res["ok"], res["applied"]), (True, 1), res)
        return self.row()


# --------------------------------------------------------------------------
# Uprzaz: kazdy swiezy schemat ma dam_meta (poprawka schema.py, runda 2)
# --------------------------------------------------------------------------

class HarnessFreshDb(unittest.TestCase):
    def test_dwa_kolejne_fresh_db_w_jednym_procesie_maja_dam_meta(self):
        import psycopg2  # noqa: PLC0415
        import realpg  # noqa: PLC0415

        admin_dsn = realpg.require(self)
        for _ in range(2):
            with realpg.fresh_db(admin_dsn) as dsn:
                conn = psycopg2.connect(dsn, connect_timeout=10)
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT current_schema(), EXISTS (SELECT 1 FROM pg_tables "
                                "WHERE schemaname = current_schema() AND tablename = 'dam_meta')")
                    schema, has_meta = cur.fetchone()
                    self.assertTrue(schema.startswith("t_"))
                    self.assertTrue(has_meta, f"brak dam_meta w schemacie {schema}")
                finally:
                    conn.close()


# --------------------------------------------------------------------------
# Czerwone: stan bez bramki (to, co ADR-012 naprawia)
# --------------------------------------------------------------------------

class BaselineWithoutGate(_RealPG):
    apply_gate = False

    def test_bez_bramki_maszyna_spoza_listy_usuwa_i_publikuje(self):
        self.set_machines([OWNER])
        self.seed()
        res = self.tombstone(OTHER)
        self.assertEqual((res["ok"], res["applied"]), (True, 1),
                         "bez bramki tombstone spoza listy przechodzi (problem z ADR-012)")
        self.assertIsNotNone(self.row()["deleted_at"])
        self.assertTrue(self.publish("file-index", OTHER)["changed"])
        self.assertEqual(self.snapshot_row("file-index")["built_by"], OTHER)


# --------------------------------------------------------------------------
# dam_index_snapshots (RAISE)
# --------------------------------------------------------------------------

class GateSnapshots(_RealPG):
    def test_spoza_listy_odrzucona_wlasciciel_przyjety(self):
        self.set_machines([OWNER])
        self.assertTrue(self.publish("file-index", OWNER)["changed"])
        with self.assertRaises(self._psycopg2.Error) as cm:
            self.publish("file-index", OTHER, b'{"a": 2}')
        self.assertEqual(cm.exception.pgcode, "P0001")
        self.assertTrue(str(cm.exception.diag.message_primary).startswith("dam_not_authority:"),
                        str(cm.exception))
        self.assertEqual(self.snapshot_row("file-index")["built_by"], OWNER)
        # nowy klucz (INSERT) od maszyny spoza listy tez odrzucony
        with self.assertRaises(self._psycopg2.Error):
            self.publish("campaigns", OTHER)
        self.assertIsNone(self.snapshot_row("campaigns"))
        # dziennika dla migawek nie ma (RAISE wycofuje transakcje) - opisane w SQL
        self.assertEqual([r for r in self.rejects() if r["table_name"] == "dam_index_snapshots"], [])

    def test_wielkosc_liter_bez_znaczenia(self):
        self.set_machines(["krzysztofwi"])
        self.assertTrue(self.publish("file-index", "KRZYSZTOFWI")["changed"])
        self.assertTrue(self.publish("file-index", "KrzysztofWi", b'{"a": 3}')["changed"])

    def test_pusta_lista_i_brak_klucza_wszystko_przechodzi(self):
        self.set_machines([])
        self.assertTrue(self.publish("file-index", OTHER)["changed"])
        self.set_machines(None)
        self.assertTrue(self.publish("file-index", "KTOKOLWIEK", b'{"b": 1}')["changed"])
        cur = self.pg.cursor()
        cur.execute("INSERT INTO dam_meta (key, value) VALUES ('index_authority', 'to nie json') "
                    "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value")
        self.pg.commit()
        self.assertTrue(self.publish("file-index", OTHER, b'{"c": 1}')["changed"])

    def test_publish_changed_odmowa_to_skipped_not_authority(self):
        """Prawdziwy index_snapshots.publish_changed -> prawdziwa baza z bramka:
        nieaktualna pamiec klienta (may_publish None) nie konczy sie petla bledow."""
        self.set_machines([OWNER])
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        data = Path(tmp.name) / "data"
        data.mkdir()
        state = Path(tmp.name) / "state"
        for fname in ("file-index.json", "campaigns.json"):
            (data / fname).write_text(json.dumps({"f": fname, "pad": "x" * 2000}), encoding="utf-8")
        import pg_db  # noqa: PLC0415

        with patch.object(index_snapshots.platform_compat, "user_state_dir", return_value=state), \
             patch.object(pg_db, "connect", self.connect), \
             patch("index_authority.may_publish", return_value=None), \
             patch.object(index_snapshots, "_machine", return_value=OTHER), \
             patch.object(index_snapshots, "_asset_index_mode_is_rows", return_value=True):
            index_snapshots.mark_built_here("file-index", data / "file-index.json")
            index_snapshots.mark_built_here("campaigns", data / "campaigns.json")
            res = index_snapshots.publish_changed(data, root_alive=True)
        self.assertTrue(res["ok"], res)
        # 2.6.0: nieznana lista publikujacych = klient nie publikuje i nie pyta bazy (authority_unknown);
        # wczesniej odmowa przychodzila z bramki w bazie (not_authority). Oba oznaczaja: bez petli bledow.
        self.assertIn(res.get("skipped"), ("not_authority", "authority_unknown"))
        self.assertNotIn("errors", res)
        self.assertEqual(len(res["refused_not_authority"]), 1)
        self.assertIsNone(self.snapshot_row("file-index"))
        self.assertIsNone(self.snapshot_row("campaigns"))


# --------------------------------------------------------------------------
# dam_assets (RETURN NULL + dziennik)
# --------------------------------------------------------------------------

class GateAssets(_RealPG):
    def setUp(self):
        super().setUp()
        self.set_machines([OWNER])
        self.seed()

    def test_spoza_listy_insert_nowego_pliku(self):
        res = self.upsert(OTHER, size=5, mtime=2_000_000, rel=NEW_REL, reason="add")
        self.assertEqual((res["ok"], res["applied"]), (True, 1), res)
        self.assertEqual(self.row(NEW_REL)["updated_by"], OTHER)
        self.assertEqual(self.rejects(), [])

    def test_spoza_listy_scisle_nowszy_mtime(self):
        res = self.upsert(OTHER, size=101, mtime=1_000_001)
        self.assertEqual((res["ok"], res["applied"]), (True, 1), res)
        self.assertEqual(self.row()["mtime_ms"], 1_000_001)
        self.assertEqual(self.rejects(), [])

    def test_spoza_listy_tombstone_pominiety(self):
        before = self.row()
        self.assert_skipped(self.tombstone(OTHER), "usuniecie")
        after = self.row()
        self.assertIsNone(after["deleted_at"])
        self.assertEqual(after["rev"], before["rev"], "pominiety wiersz nie moze dostac nowego rev")

    def test_spoza_listy_przywrocenie_pominiete(self):
        self.assertEqual(self.tombstone(OWNER)["applied"], 1)
        before = self.row()
        self.assert_skipped(self.restore(OTHER), "przywrocenie")
        self.assertEqual(self.row()["deleted_at"], before["deleted_at"])

    def test_spoza_listy_ponowne_utworzenie_na_tombstonie_pominiete(self):
        self.assertEqual(self.tombstone(OWNER)["applied"], 1)
        self.assert_skipped(self.upsert(OTHER, size=100, mtime=5_000_000, reason="recreate"),
                            "przywrocenie")
        self.assertIsNotNone(self.row()["deleted_at"])

    def test_spoza_listy_ten_sam_mtime_zmiana_opisu_pominieta(self):
        self.assert_skipped(self.upsert(OTHER, size=100, mtime=1_000_000,
                                        meta={"sku": "INNY"}, reason="meta"), "mtime_nie_nowszy")
        self.assertEqual(self.row()["meta"]["sku"], "6300576")
        # ten sam mtime, inny rozmiar - tez pominiete (tylko scisle nowszy); ten sam
        # klucz dziennika -> hits = 2, nadal jeden wiersz
        res = self.upsert(OTHER, size=999, mtime=1_000_000)
        self.assertEqual((res["applied"], res["refused"]), (0, 1))
        rows = self.rejects()
        self.assertEqual(len(rows), 1, rows)
        self.assertEqual(rows[0]["hits"], 2)

    def test_powtorki_nie_rozdmuchuja_dziennika(self):
        for _ in range(3):
            self.assertEqual(self.tombstone(OTHER)["refused"], 1)
        rows = self.rejects()
        self.assertEqual([(r["reason"], r["hits"]) for r in rows], [("usuniecie", 3)])

    def test_starszy_mtime_nadal_odmowa_where_bez_dziennika(self):
        """ON CONFLICT ... WHERE falsz nie aktualizuje wiersza, wiec wyzwalacz sie
        nie uruchamia - zwykla odmowa (refused), jak przed bramka, bez wpisu."""
        res = self.upsert(OTHER, size=1, mtime=500)
        self.assertEqual((res["ok"], res["applied"], res["refused"]), (True, 0, 1), res)
        self.assertEqual(self.rejects(), [])

    def test_wlasciciel_wszystko(self):
        self.assertEqual(self.upsert(OWNER, size=100, mtime=1_000_000, meta={"sku": "X"},
                                     reason="meta")["applied"], 1)
        self.assertEqual(self.tombstone(OWNER)["applied"], 1)
        self.assertEqual(self.restore(OWNER)["applied"], 1)
        self.assertIsNone(self.row()["deleted_at"])
        # updated_by z przyrostkiem (repair-dam-assets-collisions.py: "<host>:repair")
        cur = self.pg.cursor()
        cur.execute("UPDATE dam_assets SET deleted_at = 1, updated_by = %s, "
                    "rev = nextval('dam_assets_rev_seq') WHERE asset_id = %s",
                    ("krzysztofwi:repair", self.aid()))
        self.pg.commit()
        self.assertIsNotNone(self.row()["deleted_at"])
        self.assertEqual(self.rejects(), [])

    def test_wycofanie_pusta_lista_znow_pozwala(self):
        self.assert_skipped(self.tombstone(OTHER), "usuniecie")
        self.set_machines([])
        self.assertEqual(self.tombstone(OTHER)["applied"], 1)

    def test_stary_klient_245_paczka_add_i_tombstone(self):
        """2.4.5 (sprzed index_authority): jedna transakcja z INSERT nowego pliku i
        tombstone z warunkiem 'mtime_ms <= znany', COMPUTERNAME w updated_by.
        Add zapisany, tombstone pominiety, wpis w dzienniku, transakcja bez bledu."""
        cur = self.pg.cursor()
        cur.execute(
            "INSERT INTO dam_assets (asset_id, asset_key, path_rel, name, size, mtime_ms, meta, "
            "updated_at, updated_by, seen_by_machine) VALUES (%s, %s, %s, 'nowy.png', 5, 2000000, "
            "'{}'::jsonb, 1, %s, %s) ON CONFLICT (asset_id) DO NOTHING RETURNING rev",
            (self.aid(NEW_REL), asset_sync.key_of(NEW_REL), NEW_REL, OTHER, OTHER))
        self.assertIsNotNone(cur.fetchone())
        cur.execute(
            "UPDATE dam_assets SET deleted_at = %s, updated_at = %s, updated_by = %s, "
            "seen_by_machine = %s, rev = nextval('dam_assets_rev_seq') "
            "WHERE asset_id = %s AND deleted_at IS NULL AND mtime_ms <= %s RETURNING rev",
            (99_000_000, 99_000_000, OTHER, OTHER, self.aid(), 99_000_000))
        self.assertIsNone(cur.fetchone(), "RETURNING zwrocil wiersz - tombstone zastosowany")
        self.assertEqual(cur.rowcount, 0)
        self.pg.commit()
        self.assertIsNotNone(self.row(NEW_REL), "INSERT nowego pliku nie przetrwal")
        self.assertIsNone(self.row()["deleted_at"])
        self.assertEqual([(r["machine"], r["asset_id"], r["reason"]) for r in self.rejects()],
                         [(OTHER, self.aid(), "usuniecie")])

    def test_paczka_push_ops_add_i_tombstone(self):
        """Ta sama paczka przez push_ops (SQL dzisiejszego klienta, sciezka bez
        filtra - np. nieaktualna decyzja may_publish): add zapisany, tombstone
        pominiety (refused), push ok."""
        aid, entry = asset_sync.scan_entry(f"{ROOT}/{NEW_REL}", size=5, mtime_ms=2_000_000,
                                           root=ROOT, meta={"sku": "1"})
        add = asset_sync._op(asset_sync.OP_UPSERT, aid, entry, None, OTHER, 99_000_000, "add")
        res = asset_sync.push_ops(self.pg, [add, self.tombstone_op(OTHER)], now_ms=99_000_000)
        self.assertEqual((res["ok"], res["applied"], res["refused"]), (True, 1, 1), res)
        self.assertEqual([r["applied"] for r in res["results"]], [True, False])
        self.assertIsNotNone(self.row(NEW_REL))
        self.assertIsNone(self.row()["deleted_at"])
        self.assertEqual(len(self.rejects()), 1)


# --------------------------------------------------------------------------
# Skrypt administracyjny: wlaczenie, status, wycofanie (DISABLE TRIGGER), ponowne wlaczenie
# --------------------------------------------------------------------------

class AdminScript(_RealPG):
    apply_gate = False

    def test_wlacz_wycofaj_wlacz(self):
        mod = _load_script()
        self.seed()
        st = mod.status(self.pg)
        self.assertEqual(st["triggers"], {"dam_authority_gate_snapshots": "brak",
                                          "dam_authority_gate_assets": "brak"})
        self.assertIsNone(st["rejects"])
        self.assertFalse(st["gate_active"])

        mod.apply_script(self.pg, mod.enable_script([OWNER]))
        st = mod.status(self.pg)
        self.assertTrue(st["gate_active"], st)
        self.assertEqual(st["machines"], [OWNER])
        self.assertEqual(self.tombstone(OTHER)["refused"], 1)
        self.assertEqual(self.tombstone(OTHER)["refused"], 1)
        st = mod.status(self.pg)
        self.assertEqual((st["rejects"]["wpisy"], st["rejects"]["powtorzenia"]), (1, 2), st["rejects"])
        self.assertEqual(st["rejects"]["wg_maszyny"][0]["machine"], OTHER)

        mod.apply_script(self.pg, mod.rollback_script(st["machines"]))
        st = mod.status(self.pg)
        self.assertFalse(st["gate_active"])
        self.assertEqual(st["machines"], [])
        self.assertEqual(set(st["triggers"].values()), {"wylaczony"})
        self.assertIsNotNone(st["rejects"], "rollback nie moze usuwac dziennika")
        cur = self.pg.cursor()
        cur.execute("SELECT count(*) AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
                    "WHERE p.proname LIKE 'dam_authority_%%' AND n.nspname = %s", (self.schema,))
        self.assertGreaterEqual(cur.fetchone()["n"], 4, "rollback nie moze usuwac funkcji (bez DROP)")
        self.pg.commit()
        # wycofanie: stary i nowy klient znow moga (jak przed zmiana)
        self.assertEqual(self.tombstone(OTHER)["applied"], 1)

        # wyzwalacze wylaczone, ale lista znow ustawiona -> nadal nic nie blokuje
        self.set_machines([OWNER])
        self.assertEqual(self.restore(OTHER)["applied"], 1)

        # ponowne wlaczenie (idempotentne, dziennik zostaje): wyzwalacze wlaczone, blokuje znowu
        mod.apply_script(self.pg, mod.enable_script([OWNER]))
        mod.apply_script(self.pg, mod.enable_script([OWNER]))
        st = mod.status(self.pg)
        self.assertTrue(st["gate_active"])
        self.assertEqual(st["rejects"]["wpisy"], 1)
        self.assertEqual(self.tombstone(OTHER)["refused"], 1)

    def test_guard_i_print_sql(self):
        mod = _load_script()
        self.assertIn("--production", mod.guard_error("dam_eta", production=False))
        self.assertEqual(mod.guard_error("dam_eta", production=True), "")
        self.assertEqual(mod.guard_error("dam_eta_test", production=False), "")
        self.assertEqual(mod.dbname_of("host=x dbname=dam_eta user=u"), "dam_eta")
        self.assertEqual(mod.dbname_of("postgresql://u@h:5433/dam_eta?sslmode=require"), "dam_eta")
        with self.assertRaises(ValueError):
            mod.parse_machines("KRZYSZTOFWI,x';DROP TABLE y;--")
        sql = mod.enable_script(["KRZYSZTOFWI"])
        self.assertIn("CREATE TRIGGER dam_authority_gate_assets", sql)
        self.assertIn("CREATE TABLE IF NOT EXISTS dam_authority_rejects", sql)
        self.assertIn('"machines": ["KRZYSZTOFWI"]', sql)
        rb = mod.rollback_script(["KRZYSZTOFWI"])
        self.assertIn("DISABLE TRIGGER dam_authority_gate_assets", rb)
        self.assertNotRegex(rb, r"(?im)^\s*DROP\s", "rollback bez DROP")
        self.assertEqual(mod.main(["--dsn-env", "BRAK_TAKIEJ_ZMIENNEJ_W5", "--status"]), 2)


# --------------------------------------------------------------------------
# Runner z bramka: pominiete operacje nie zuzywaja obserwacji, bez petli
# --------------------------------------------------------------------------

class RunnerWithGate(_RealPG):
    FOLDER = "- POLSKA/1 - PRODUKTY/Klopsiki 6300576/4 - WIZKI"
    XROOT = "X:/Marketing"

    def setUp(self):
        super().setUp()
        cur = self.pg.cursor()
        cur.execute("INSERT INTO dam_meta (key, value) VALUES ('asset_index_mode', 'rows') "
                    "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value")
        self.pg.commit()
        self.set_machines([OWNER])
        self.disk = {f"{self.FOLDER}/wiz-{i:02d}.png": (1000 + i, 1_000_000) for i in range(12)}
        ops = []
        for rel, (size, mt) in self.disk.items():
            aid, entry = asset_sync.scan_entry(f"{ROOT}/{rel}", size=size, mtime_ms=mt, root=ROOT,
                                               meta={"sku": "6300576"})
            ops.append(asset_sync._op(asset_sync.OP_UPSERT, aid, entry, None, OWNER, 1, "add"))
        self.assertEqual(asset_sync.push_ops(self.pg, ops, now_ms=1)["applied"], 12)
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.work = Path(tmp.name)
        self.data_dir = self.work / "data"
        self.data_dir.mkdir()
        self.db_path = self.work / "dam-local.sqlite"
        p = patch("index_authority._state_path", return_value=self.work / "index-authority.json")
        p.start()
        self.addCleanup(p.stop)

    def _write_scan(self, disk: dict, scan_time: int):
        assets = [{"path": f"{self.XROOT}/{rel}", "size_bytes": s, "mtime_ms": mt, "sku": "6300576"}
                  for rel, (s, mt) in disk.items()]
        (self.data_dir / "branding-index.scan.json").write_text(json.dumps({"assets": assets}),
                                                                encoding="utf-8")
        (self.data_dir / "branding-scan-dirs.json").write_text(json.dumps({
            "version": 1, "scan_time_ms": scan_time, "root": self.XROOT,
            "scanned_dirs": sorted({a for r in disk for a in asset_sync._ancestors(asset_sync.key_of(r))}),
            "failed_dirs": []}), encoding="utf-8")

    def _run(self):
        return asset_sync_runner.run_once(
            self.db_path, self.data_dir, root_alive=True, root_path=self.XROOT,
            machine=OTHER, pg_connect=self.connect, on_index_written=None)

    def _obs(self):
        conn = sqlite3.connect(str(self.db_path))
        try:
            return asset_repo.load_observations(conn)["obs"] or {}
        finally:
            conn.close()

    def _cycle2(self, may_publish):
        gone = f"{self.FOLDER}/wiz-05.png"
        new = f"{self.FOLDER}/nowy.png"
        with patch("index_authority.may_publish", return_value=None):
            self._write_scan(self.disk, 60_000_000)
            res = self._run()
        self.assertTrue(res["ok"], res)
        # plik zniknal (kopia Drive w trakcie), nowy plik dodany
        disk = dict(self.disk)
        del disk[gone]
        disk[new] = (7, 3_000_000)
        self._write_scan(disk, 61_000_000)
        with patch("index_authority.may_publish", side_effect=may_publish):
            res = self._run()
        return res, gone, new, disk

    def test_nieaktualna_decyzja_klienta_pominiete_bez_utraty_obserwacji(self):
        res, gone, new, disk = self._cycle2(lambda *a, force=False, **k: False if force else None)
        self.assertTrue(res["ok"], res)
        self.assertEqual(res.get("not_authority_refused"), 1, res)
        self.assertIs(res.get("authority"), False)
        self.assertEqual((res["push"]["applied"], res["push"]["refused"]), (1, 1), res["push"])
        self.assertIsNone(self.row(gone)["deleted_at"], "tombstone spoza listy przeszedl")
        self.assertEqual(self.row(new)["updated_by"], OTHER, "dozwolone dodanie nie dotarlo")
        self.assertIn(self.aid(gone), self._obs(), "obserwacja zniknietego pliku zgubiona")
        self.assertEqual(res["blocked"].get(asset_sync_runner.NOT_AUTHORITY_BUCKET), 1, res)
        self.assertEqual([(r["reason"], r["hits"]) for r in self.rejects()], [("usuniecie", 1)])
        # cykl 3: decyzja juz False -> sciezka z filtrem; tombstone wstrzymany lokalnie,
        # nic nie idzie do bazy (bez petli: dziennik bez nowych powtorzen)
        self._write_scan(disk, 62_000_000)
        with patch("index_authority.may_publish", return_value=False):
            res3 = self._run()
        self.assertTrue(res3["ok"], res3)
        self.assertEqual(res3["blocked"].get(asset_sync_runner.NOT_AUTHORITY_BUCKET), 1, res3)
        self.assertEqual([(r["reason"], r["hits"]) for r in self.rejects()], [("usuniecie", 1)])
        self.assertIn(self.aid(gone), self._obs())

    def test_stary_klient_bez_klucza_w_pamieci_bez_petli(self):
        """Zachowanie klienta, ktory nie zna index_authority (None zawsze): pominiety
        tombstone zuzywa obserwacje (jak kazda odmowa WHERE) - nastepny cykl juz go
        nie wysyla, wiec nie ma petli; plik zostaje zywy w bazie."""
        res, gone, _new, disk = self._cycle2(lambda *a, **k: None)
        self.assertTrue(res["ok"], res)
        self.assertEqual((res["push"]["applied"], res["push"]["refused"]), (1, 1))
        self.assertNotIn(self.aid(gone), self._obs())
        self._write_scan(disk, 62_000_000)
        with patch("index_authority.may_publish", return_value=None):
            res3 = self._run()
        self.assertTrue(res3["ok"], res3)
        self.assertEqual((res3["push"] or {}).get("refused", 0), 0, res3)
        self.assertEqual([(r["reason"], r["hits"]) for r in self.rejects()], [("usuniecie", 1)])
        self.assertIsNone(self.row(gone)["deleted_at"])


def load_tests(loader, tests, pattern):  # noqa: ARG001
    import os

    print(f"[ADR-012 gate] DAM_TEST_PG_DSN={'ustawione' if os.environ.get('DAM_TEST_PG_DSN') else 'brak (skip)'}")
    return tests


if __name__ == "__main__":
    unittest.main()
