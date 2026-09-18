# -*- coding: utf-8 -*-
"""Skojarzone produkty per wariant materialu (plik = wlasne asset_id).

1) POST /branding/asset-associations: nowy kontrakt `scope` (file|all) +
   `asset_ids` - petla po assoc_repo.upsert_confirmed_links per plik, bez
   rozlewania na folder; stary kontrakt (bez scope) bez zmian.
2) GET /branding/asset-links: odczyt per plik (SQLite confirmed/auto + mirror).

Prawdziwy ThreadingHTTPServer na 127.0.0.1:0 (jak test_clean_install_bridge_routes).
assoc_repo.upsert_confirmed_links i zapis grubego indeksu sa mockami; SQLite i
mirror to pliki tymczasowe - zero dotykania produkcyjnej bazy.
"""
from __future__ import annotations

import http.client
import json
import sqlite3
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parent.parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import assoc_repo  # noqa: E402
import branding_asset_routes  # noqa: E402
import local_bridge  # noqa: E402

ADMIN = {"email": "admin@test.local", "role": "admin"}


class _BridgeCase(unittest.TestCase):
    user: dict | None = ADMIN

    def setUp(self):
        self.patches = []
        self.tmp = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.tmp.name)
        self.overrides = self.tmp_path / "overrides.json"
        self.overrides.write_text(
            json.dumps(
                {
                    "version": 1,
                    "assets": {
                        "br-2": {
                            "linked_product_ids": ["old"],
                            "linked_variant_ids": ["vx"],
                            "updated_at": "2026-01-01T00:00:00Z",
                        }
                    },
                    "folder_groups": {},
                }
            ),
            encoding="utf-8",
        )
        self._patch(local_bridge, "PUBLIC_MODE", False)
        self._patch(local_bridge, "BRANDING_ASSOC_OVERRIDES_FILE", self.overrides)
        self._patch(local_bridge.Handler, "_session_user", return_value=self.user)
        self.enqueue = self._patch(local_bridge, "_enqueue_assoc_index_patch")
        self.upsert = self._patch(
            assoc_repo,
            "upsert_confirmed_links",
            side_effect=lambda aid, pids, **kw: {"ok": True, "asset_id": aid, "linked_product_ids": pids},
        )
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), local_bridge.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        for p in reversed(self.patches):
            p.stop()
        self.tmp.cleanup()

    def _patch(self, target, attr, *new, **kwargs):
        p = mock.patch.object(target, attr, *new, **kwargs)
        m = p.start()
        self.patches.append(p)
        return m

    def _req(self, method, path, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        hdrs = {"Host": "127.0.0.1"}
        payload = json.dumps(body).encode() if body is not None else None
        if payload is not None:
            hdrs["Content-Type"] = "application/json"
        conn.request(method, path, body=payload, headers=hdrs)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, json.loads(data or b"{}")

    def calls_by_asset(self):
        return {c.args[0]: c for c in self.upsert.call_args_list}


class ScopedSaveTests(_BridgeCase):
    def test_scope_all_writes_same_products_to_every_file(self):
        status, data = self._req(
            "POST",
            "/branding/asset-associations",
            {
                "asset_id": "br-1",
                "asset_ids": ["br-1", "br-2", "br-3", "br-2", ""],
                "scope": "all",
                "folder_group_id": "x:/marketing/folder",
                "linked_product_ids": ["p1", "p2"],
                "linked_variant_ids": ["v1"],
            },
        )
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertEqual(data["scope"], "all")
        self.assertEqual(data["asset_ids"], ["br-1", "br-2", "br-3"])
        self.assertEqual(data["saved"], 3)
        self.assertEqual(data["failed"], 0)
        self.assertEqual([r["asset_id"] for r in data["results"]], ["br-1", "br-2", "br-3"])
        calls = self.calls_by_asset()
        self.assertEqual(sorted(calls), ["br-1", "br-2", "br-3"])
        for aid, call in calls.items():
            self.assertEqual(call.args[1], ["p1", "p2"], aid)
            # Bez rozlewania na folder: zadnego folder_groups w mirrorze.
            self.assertEqual(call.kwargs["folder_group_id"], "", aid)
            self.assertEqual(call.kwargs["source"], "manual")
            self.assertEqual(call.kwargs["updated_by"], ADMIN["email"])
        # Warianty: plik glowny z zadania, pozostale zachowuja swoje z mirrora.
        self.assertEqual(calls["br-1"].kwargs["variant_ids"], ["v1"])
        self.assertEqual(calls["br-2"].kwargs["variant_ids"], ["vx"])
        self.assertEqual(calls["br-3"].kwargs["variant_ids"], ["v1"])
        for c in self.enqueue.call_args_list:
            self.assertFalse(c.kwargs.get("spray_group", True))

    def test_scope_file_touches_only_selected_file(self):
        status, data = self._req(
            "POST",
            "/branding/asset-associations",
            {
                "asset_id": "br-2",
                "asset_ids": ["br-1", "br-2", "br-3"],
                "scope": "file",
                "folder_group_id": "x:/marketing/folder",
                "linked_product_ids": ["p9"],
                "linked_variant_ids": [],
            },
        )
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertEqual(data["asset_ids"], ["br-2"])
        self.assertEqual(self.upsert.call_count, 1)
        call = self.upsert.call_args
        self.assertEqual(call.args[:2], ("br-2", ["p9"]))
        self.assertEqual(call.kwargs["folder_group_id"], "")
        self.enqueue.assert_called_once()
        self.assertFalse(self.enqueue.call_args.kwargs["spray_group"])

    def test_legacy_payload_keeps_old_contract(self):
        status, data = self._req(
            "POST",
            "/branding/asset-associations",
            {
                "asset_id": "br-1",
                "folder_group_id": "X:/Marketing/Folder",
                "linked_product_ids": ["p1"],
                "linked_variant_ids": ["v1"],
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(
            data,
            {"ok": True, "asset_id": "br-1", "linked_product_ids": ["p1"], "linked_variant_ids": ["v1"]},
        )
        self.assertEqual(self.upsert.call_count, 1)
        self.assertEqual(self.upsert.call_args.kwargs["folder_group_id"], "x:/marketing/folder")
        self.assertTrue(self.enqueue.call_args.kwargs["spray_group"])

    def test_partial_failure_reports_per_asset(self):
        def fake(aid, pids, **kw):
            if aid == "br-2":
                return {"ok": False, "error": "db_locked"}
            return {"ok": True}

        self.upsert.side_effect = fake
        status, data = self._req(
            "POST",
            "/branding/asset-associations",
            {"asset_id": "br-1", "asset_ids": ["br-2", "br-3"], "scope": "all", "linked_product_ids": ["p1"]},
        )
        self.assertEqual(status, 200)
        self.assertFalse(data["ok"])
        self.assertEqual(data["error"], "partial_failure")
        self.assertEqual((data["saved"], data["failed"]), (2, 1))
        bad = [r for r in data["results"] if not r["ok"]]
        self.assertEqual(bad, [{"asset_id": "br-2", "ok": False, "error": "db_locked"}])

    def test_all_failed_is_400(self):
        self.upsert.side_effect = lambda aid, pids, **kw: {"ok": False, "error": "db_locked"}
        status, data = self._req(
            "POST",
            "/branding/asset-associations",
            {"asset_id": "br-1", "scope": "file", "linked_product_ids": ["p1"]},
        )
        self.assertEqual(status, 400)
        self.assertEqual(data["error"], "db_locked")

    def test_asset_ids_without_scope_means_all(self):
        status, data = self._req(
            "POST",
            "/branding/asset-associations",
            {"asset_ids": ["br-5", "br-6"], "linked_product_ids": ["p1"]},
        )
        self.assertEqual(status, 200)
        self.assertEqual(data["scope"], "all")
        self.assertEqual(data["asset_id"], "br-5")
        self.assertEqual(sorted(self.calls_by_asset()), ["br-5", "br-6"])

    def test_bad_requests(self):
        cases = [
            ({"asset_id": "br-1", "scope": "folder"}, "invalid_scope"),
            ({"asset_id": "br-1", "asset_ids": "br-2"}, "asset_ids_invalid"),
            ({"scope": "all", "asset_ids": []}, "asset_id_required"),
            (
                {"asset_id": "br-0", "scope": "all", "asset_ids": ["b%d" % i for i in range(600)]},
                "too_many_assets",
            ),
        ]
        for body, err in cases:
            status, data = self._req("POST", "/branding/asset-associations", body)
            self.assertEqual(status, 400, body)
            self.assertEqual(data["error"], err, body)
        self.upsert.assert_not_called()


class ScopedSaveAuthTests(_BridgeCase):
    user = {"email": "viewer@test.local", "role": "user"}

    def test_user_role_forbidden(self):
        status, data = self._req(
            "POST",
            "/branding/asset-associations",
            {"asset_id": "br-1", "asset_ids": ["br-2"], "scope": "all", "linked_product_ids": ["p1"]},
        )
        self.assertEqual(status, 403)
        self.assertEqual(data["error"], "forbidden")
        self.upsert.assert_not_called()


class ScopedSaveLoginTests(_BridgeCase):
    user = None

    def test_login_required(self):
        status, data = self._req(
            "POST",
            "/branding/asset-associations",
            {"asset_id": "br-1", "scope": "file", "linked_product_ids": ["p1"]},
        )
        self.assertEqual(status, 401)
        self.assertEqual(data["error"], "login_required")
        self.upsert.assert_not_called()


class FatIndexSprayTests(unittest.TestCase):
    def _assets(self):
        return [
            {"id": "a", "folder_group_id": "g", "linked_product_ids": ["x"]},
            {"id": "b", "folder_group_id": "g", "linked_product_ids": ["y"]},
        ]

    def test_no_spray_keeps_sibling(self):
        assets = self._assets()
        by_id = {a["id"]: a for a in assets}
        local_bridge._apply_assoc_patch_to_index(
            {"asset_id": "a", "folder_group_id": "", "linked_product_ids": ["p"], "spray_group": False},
            assets,
            by_id,
            {"products": []},
        )
        self.assertEqual(by_id["a"]["linked_product_ids"], ["p"])
        self.assertEqual(by_id["b"]["linked_product_ids"], ["y"])

    def test_legacy_patch_still_sprays(self):
        assets = self._assets()
        by_id = {a["id"]: a for a in assets}
        local_bridge._apply_assoc_patch_to_index(
            {"asset_id": "a", "folder_group_id": "", "linked_product_ids": ["p"]},
            assets,
            by_id,
            {"products": []},
        )
        self.assertEqual(by_id["b"]["linked_product_ids"], ["p"])


class AssetLinksGetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name) / "dir with spaces"
        root.mkdir()
        self.db = root / "links.sqlite"
        conn = sqlite3.connect(str(self.db))
        conn.execute(
            "CREATE TABLE asset_product_links (asset_id TEXT, product_id TEXT, score REAL, source TEXT,"
            " status TEXT, reason TEXT, updated_at TEXT, updated_by TEXT, PRIMARY KEY(asset_id, product_id))"
        )
        rows = [
            # br-a: mirror nowszy (usuniety produkt 'gone' zostaje confirmed w SQLite)
            ("br-a", "keep", 100, "confirmed", "2026-09-18T10:00:00Z"),
            ("br-a", "gone", 100, "confirmed", "2026-09-01T10:00:00Z"),
            # br-b: SQLite nowszy niz mirror (np. zmiana z innej maszyny)
            ("br-b", "fresh", 100, "confirmed", "2026-09-18 12:00:00+00"),
            ("br-b", "auto1", 40, "auto", "2026-09-18T12:00:00Z"),
            ("br-b", "pend", 90, "pending", "2026-09-18T12:00:00Z"),
            # br-c: tylko odrzucone
            ("br-c", "rej", 10, "rejected", "2026-09-18T12:00:00Z"),
        ]
        for aid, pid, score, status, ts in rows:
            conn.execute(
                "INSERT INTO asset_product_links VALUES(?,?,?,?,?,?,?,?)",
                (aid, pid, score, "manual", status, "", ts, "t"),
            )
        conn.commit()
        conn.close()
        self.ov_file = root / "overrides.json"
        self.ov_file.write_text(
            json.dumps(
                {
                    "assets": {
                        "br-a": {"linked_product_ids": ["keep"], "updated_at": "2026-09-18T10:00:05Z"},
                        "br-b": {"linked_product_ids": ["stale"], "updated_at": "2026-09-10T00:00:00Z"},
                        "br-d": {"linked_product_ids": ["only-ov"], "updated_at": "2026-09-10T00:00:00Z"},
                    }
                }
            ),
            encoding="utf-8",
        )
        # Swieza instalacja: branding-index.json = atrapa, prawdziwe dane w siatce.
        data_dir = root / "data"
        data_dir.mkdir()
        self.fat = data_dir / "branding-index.json"
        self.fat.write_text(
            json.dumps({"assets": [], "note": "slim-only-installer-use-branding-grid-head"}),
            encoding="utf-8",
        )
        (data_dir / "branding-grid-index.json").write_text(
            json.dumps(
                {
                    "version": 1,
                    "slim": True,
                    "assets": [
                        {"id": "br-a", "path": "M:/x/a.png", "name": "a.png", "linked_product_ids": ["gone"]},
                        {"id": "br-b", "path": "M:/x/b.png", "name": "b.png", "linked_product_ids": ["grid-old"]},
                        {"id": "br-c", "path": "M:/x/c.png", "name": "c.png", "linked_product_ids": ["grid-c"]},
                    ],
                }
            ),
            encoding="utf-8",
        )
        self.ctx = mock.patch.dict(
            branding_asset_routes._CTX,
            {
                "web_root": root,
                "branding_index_file": self.fat,
                "sqlite_path": self.db,
                "assoc_overrides_file": self.ov_file,
                "load_json": None,
            },
        )
        self.ctx.start()
        self.pm = mock.patch.object(local_bridge, "PUBLIC_MODE", False)
        self.pm.start()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), local_bridge.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.pm.stop()
        self.ctx.stop()
        self.tmp.cleanup()

    def _get(self, path):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request("GET", path, headers={"Host": "127.0.0.1"})
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, json.loads(data or b"{}")

    def test_links_per_file(self):
        status, data = self._get("/branding/asset-links?ids=br-a,br-b,br-c,br-d,br-e")
        self.assertEqual(status, 200)
        links = data["links"]
        self.assertEqual(links["br-a"]["product_ids"], ["keep"])
        self.assertEqual(links["br-a"]["source"], "override")
        self.assertEqual(links["br-b"]["product_ids"], ["fresh", "auto1"])
        self.assertEqual(links["br-b"]["source"], "sqlite")
        self.assertEqual(links["br-c"], {"product_ids": [], "source": "none", "updated_at": ""})
        self.assertEqual(links["br-d"]["product_ids"], ["only-ov"])
        self.assertEqual(links["br-e"]["product_ids"], [])

    def test_single_id_param_and_errors(self):
        status, data = self._get("/branding/asset-links?id=br-b")
        self.assertEqual(status, 200)
        self.assertEqual(list(data["links"]), ["br-b"])
        status, data = self._get("/branding/asset-links")
        self.assertEqual((status, data["error"]), (400, "id_required"))
        many = ",".join("b%d" % i for i in range(250))
        status, data = self._get("/branding/asset-links?ids=" + many)
        self.assertEqual((status, data["error"]), (400, "too_many_ids"))

    def test_read_is_read_only(self):
        before = self.db.stat().st_mtime_ns
        self._get("/branding/asset-links?ids=br-a")
        self._get("/branding/asset?id=br-b")
        self._get("/branding-for-product?product_id=fresh")
        self.assertEqual(self.db.stat().st_mtime_ns, before)

    # P3a: atrapa branding-index.json -> /branding/asset z siatki + skojarzenia z SQLite.
    def test_asset_falls_back_to_grid_with_sqlite_links(self):
        status, data = self._get("/branding/asset?id=br-b")
        self.assertEqual(status, 200)
        asset = data["asset"]
        self.assertEqual(asset["path"], "M:/x/b.png")
        self.assertEqual(asset["linked_product_ids"], ["fresh", "auto1"])
        self.assertEqual([p["id"] for p in asset["linked_products"]], ["fresh", "auto1"])
        self.assertEqual(asset["links_source"], "sqlite")

    def test_asset_multi_ids_and_missing(self):
        status, data = self._get("/branding/asset?ids=br-a,br-c,nope")
        self.assertEqual(status, 200)
        by_id = {a["id"]: a for a in data["assets"]}
        self.assertEqual(by_id["br-a"]["linked_product_ids"], ["keep"])  # mirror nowszy
        self.assertEqual(by_id["br-c"]["linked_product_ids"], ["grid-c"])  # brak w bazie: siatka
        self.assertEqual(data["missing"], ["nope"])
        status, data = self._get("/branding/asset?id=nope")
        self.assertEqual((status, data["error"]), (404, "not_found"))

    def test_real_fat_index_still_preferred(self):
        self.fat.write_text(
            json.dumps({"assets": [{"id": "br-b", "path": "M:/fat/b.png", "name": "b.png"}]}),
            encoding="utf-8",
        )
        status, data = self._get("/branding/asset?id=br-b")
        self.assertEqual(status, 200)
        self.assertEqual(data["asset"]["path"], "M:/fat/b.png")

    # P3b: produkt -> zasoby z asset_product_links (confirmed/auto) + mirror.
    def test_branding_for_product(self):
        status, data = self._get("/branding-for-product?product_id=fresh&tokens=6300539&limit=400&v=2.1.0")
        self.assertEqual(status, 200)
        self.assertEqual([a["id"] for a in data["assets"]], ["br-b"])
        self.assertEqual(data["assets"][0]["path"], "M:/x/b.png")
        # auto tez sie liczy
        status, data = self._get("/branding-for-product?product_id=auto1")
        self.assertEqual([a["id"] for a in data["assets"]], ["br-b"])
        # 'gone' jest confirmed w SQLite, ale mirror br-a (nowszy) go usunal
        status, data = self._get("/branding-for-product?product_id=gone")
        self.assertEqual(data["assets"], [])
        # tylko w mirrorze (br-d brak w siatce -> missing)
        status, data = self._get("/branding-for-product?product_id=only-ov")
        self.assertEqual((data["assets"], data["missing"]), ([], 1))
        # pending / rejected nie sa skojarzeniem
        for pid in ("pend", "rej"):
            status, data = self._get("/branding-for-product?product_id=" + pid)
            self.assertEqual(data["assets"], [], pid)
        status, data = self._get("/branding-for-product?product_id=")
        self.assertEqual((status, data["error"]), (400, "product_id_required"))


if __name__ == "__main__":
    unittest.main()
