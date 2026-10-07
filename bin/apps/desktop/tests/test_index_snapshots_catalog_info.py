# -*- coding: utf-8 -*-
"""ETAP 0: znacznik katalogu (index_snapshots.catalog_info) - "wersja katalogu" na ekranach, w /health,
/index/status i w tetnie. Czysta logika na plikach tymczasowych i pliku stanu migawek (bez bazy)."""
from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import index_snapshots as ix  # noqa: E402


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class CatalogInfoTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.data = self.base / "data"
        self.data.mkdir()
        self.state_dir = self.base / "state"
        self.state_dir.mkdir()
        p = mock.patch.object(ix.platform_compat, "user_state_dir", side_effect=lambda: self.state_dir)
        p.start()
        self.addCleanup(p.stop)
        self.state: dict = {}
        self.old_data_dir = ix._DATA_DIR
        self.addCleanup(setattr, ix, "_DATA_DIR", self.old_data_dir)
        ix._DATA_DIR = None

    def put(self, key: str, content: str, *, db_content: str | None = "same", built_at="2026-10-07T06:00:00+00:00"):
        """Plik migawki + wpis stanu (local_sig/local_sha jak po cyklu); db_content: 'same' = baza ma ten plik,
        None = brak wpisu bazy, inny tekst = baza ma inna wersje."""
        path = self.data / ix.SNAPSHOT_FILES[key]
        path.write_text(content, encoding="utf-8")
        entry = {"local_sig": list(ix._file_sig(path)), "local_sha": _sha(content), "pulled_at": "2026-10-07T07:00:00+00:00"}
        if db_content is not None:
            dbc = content if db_content == "same" else db_content
            entry["db"] = {"sha256": _sha(dbc), "built_at": built_at, "built_by": "KRZYSZTOFWI", "generation": 1}
        self.state[key] = entry
        (self.state_dir / "index-snapshots.json").write_text(json.dumps(self.state), encoding="utf-8")

    def put_all(self, **kw):
        for key in ix.CATALOG_KEYS:
            self.put(key, f"zawartosc {key}", **kw)

    def test_swieza_instalacja_bez_plikow(self):
        info = ix.catalog_info(self.data)
        self.assertFalse(info["complete"])
        self.assertEqual((info["id"], info["db_id"], info["source"], info["kind"]), ("", "", "", "snapshot"))
        self.assertFalse(info["pending"])
        self.assertIsNone(info["gen"])

    def test_wszystkie_cztery_zgodne_z_baza(self):
        self.put_all()
        info = ix.catalog_info(self.data)
        self.assertTrue(info["complete"])
        self.assertEqual(info["source"], "db")
        self.assertEqual(len(info["id"]), 7)
        self.assertEqual(info["id"], info["db_id"])
        self.assertEqual(info["built_at"], "2026-10-07T06:00:00+00:00")
        self.assertEqual(info["built_by"], "KRZYSZTOFWI")
        self.assertEqual(set(info["parts"]), set(ix.CATALOG_KEYS))
        self.assertEqual(info["parts"]["file-index"]["sha"], _sha("zawartosc file-index")[:7])

    def test_formula_id_i_stala_kolejnosc(self):
        self.put_all()
        shas = {k: _sha(f"zawartosc {k}") for k in ix.CATALOG_KEYS}
        raw = "\n".join(f"{k}={shas[k]}" for k in ("file-index", "search-index", "branding-search-index", "campaigns"))
        self.assertEqual(ix.catalog_info(self.data)["id"], hashlib.sha256(raw.encode()).hexdigest()[:7])
        shuffled = dict(reversed(list(shas.items())))
        self.assertEqual(ix.catalog_id_from_shas(shuffled), ix.catalog_id_from_shas(shas))  # kolejnosc kluczy w slowniku bez znaczenia

    def test_ten_sam_komplet_ten_sam_id_inny_plik_inny_id(self):
        self.put_all()
        first = ix.catalog_info(self.data)["id"]
        self.assertEqual(ix.catalog_info(self.data)["id"], first)
        self.put("campaigns", "inne kampanie")
        self.assertNotEqual(ix.catalog_info(self.data)["id"], first)

    def test_brak_jednego_pliku_to_niekompletny(self):
        self.put_all()
        (self.data / ix.SNAPSHOT_FILES["campaigns"]).unlink()
        info = ix.catalog_info(self.data)
        self.assertFalse(info["complete"])
        self.assertEqual(info["id"], "")
        self.assertEqual(info["source"], "mixed")  # trzy zgodne z baza, jednego brak

    def test_zrodlo_local_gdy_zaden_plik_nie_zgadza_sie_z_baza(self):
        self.put_all(db_content="cos innego")
        info = ix.catalog_info(self.data)
        self.assertEqual(info["source"], "local")
        self.assertNotEqual(info["id"], info["db_id"])

    def test_zrodlo_local_gdy_baza_nigdy_nie_odpowiedziala(self):
        self.put_all(db_content=None)
        info = ix.catalog_info(self.data)
        self.assertEqual((info["source"], info["db_id"]), ("local", ""))
        self.assertTrue(info["complete"])

    def test_zrodlo_mixed_gdy_czesc_zgodna(self):
        self.put_all()
        self.put("campaigns", "kampanie lokalne", db_content="kampanie z bazy")
        info = ix.catalog_info(self.data)
        self.assertEqual(info["source"], "mixed")
        self.assertNotEqual(info["id"], info["db_id"])

    def test_plik_zmieniony_po_policzeniu_sumy_to_pending(self):
        self.put_all()
        path = self.data / ix.SNAPSHOT_FILES["search-index"]
        path.write_text("zmieniony po cyklu, inny rozmiar", encoding="utf-8")  # local_sig juz nie zgodny ze stat()
        info = ix.catalog_info(self.data)
        self.assertTrue(info["pending"])
        self.assertTrue(info["parts"]["search-index"]["pending"])
        self.assertEqual(info["id"], "")  # nie zgadujemy sumy pliku, ktorego nie policzono

    def test_data_dir_z_pamieci_gdy_bez_argumentu(self):
        self.put_all()
        ix._DATA_DIR = self.data
        self.assertTrue(ix.catalog_info()["complete"])

    def test_status_niesie_katalog(self):
        self.put_all()
        ix._DATA_DIR = self.data
        st = ix.status()
        self.assertEqual(st["catalog"]["id"], ix.catalog_info(self.data)["id"])

    def test_pamiec_dla_health_odswiezana_i_kick_przy_zmianie(self):
        self.put_all()
        ix._DATA_DIR = self.data
        old = dict(ix._CATALOG_CACHE)
        self.addCleanup(lambda: (ix._CATALOG_CACHE.clear(), ix._CATALOG_CACHE.update(old)))
        ix._CATALOG_CACHE.update(catalog_id="", catalog_source="")
        with mock.patch("fleet_heartbeat.kick") as kick:
            ix._after_cycle(self.data)
            self.assertEqual(kick.call_count, 1)  # id sie zmienil ('' -> 7 znakow): tetno od reki
            self.assertEqual(ix.cached_catalog_id()["catalog_id"], ix.catalog_info(self.data)["id"])
            self.assertEqual(ix.cached_catalog_id()["catalog_source"], "db")
            ix._after_cycle(self.data)
            self.assertEqual(kick.call_count, 1)  # bez zmiany - bez tetna


if __name__ == "__main__":
    unittest.main()
