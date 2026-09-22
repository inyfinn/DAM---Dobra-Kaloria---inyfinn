"""GET /preflight: lista kontrolna pierwszego uruchomienia (wszystko na mockach, bez bazy i dyskow)."""
import http.client
import json
import sys
import tempfile
import threading
import time
import types
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import local_bridge  # noqa: E402
import preflight  # noqa: E402


def fake_pg(activation=False, configured=True, health=None):
    return types.SimpleNamespace(
        activation_required=lambda: activation,
        is_configured=lambda: configured,
        cached_health=lambda: dict(health or {"ok": True}),
    )


def key(p):
    return str(p).replace("/", "\\").rstrip("\\").lower()


class DatabaseCheckTests(unittest.TestCase):
    def test_missing_module_is_warning(self):
        item = preflight.check_database(None)
        self.assertFalse(item["ok"])
        self.assertEqual(item["level"], "warn")
        self.assertFalse(item["blocking"])

    def test_activation_required(self):
        item = preflight.check_database(fake_pg(activation=True, configured=False))
        self.assertEqual((item["ok"], item["level"], item["action"]), (False, "warn", "activate"))
        self.assertIn("kodu aktywacyjnego", item["label"])

    def test_not_configured_is_offline_warning(self):
        item = preflight.check_database(fake_pg(configured=False))
        self.assertEqual((item["ok"], item["level"]), (False, "warn"))
        self.assertIn("offline", item["hint"])

    def test_online(self):
        item = preflight.check_database(fake_pg(health={"ok": True}))
        self.assertTrue(item["ok"])
        self.assertEqual(item["level"], "ok")

    def test_health_pending_is_info(self):
        item = preflight.check_database(fake_pg(health={"ok": False, "error": "health_pending"}))
        self.assertEqual(item["level"], "info")

    def test_offline_never_blocks(self):
        item = preflight.check_database(fake_pg(health={"ok": False, "error": "timeout"}))
        self.assertFalse(item["ok"])
        self.assertFalse(item["blocking"])
        self.assertIn("timeout", item["hint"])


class MarketingCheckTests(unittest.TestCase):
    def run_check(self, saved, statuses=None, found=()):
        calls = {"discover": 0}

        def check_paths(paths):
            return {key(p): (statuses or {}).get(key(p), {"ok": False, "exists": False}) for p in paths}

        def discover():
            calls["discover"] += 1
            return list(found)

        return preflight.check_marketing(saved, check_paths, discover, key), calls

    def test_saved_and_available(self):
        item, calls = self.run_check("X:\\Marketing", {key("X:\\Marketing"): {"ok": True, "exists": True}})
        self.assertTrue(item["ok"])
        self.assertEqual(calls["discover"], 0)

    def test_saved_but_drive_hung(self):
        item, _ = self.run_check("M:\\", {key("M:\\"): {"ok": False, "timeout": True}})
        self.assertEqual((item["ok"], item["level"], item["action"]), (False, "block", "pick_marketing"))
        self.assertIn("nie odpowiada", item["hint"])

    def test_saved_but_missing_folders(self):
        item, _ = self.run_check(
            "D:\\Marketing",
            {key("D:\\Marketing"): {"ok": False, "exists": True, "missing": ["- EKSPORT"]}},
        )
        self.assertTrue(item["blocking"])
        self.assertIn("- EKSPORT", item["hint"])

    def test_detected_but_not_saved(self):
        item, _ = self.run_check("", found=[Path("Q:/Marketing")])
        self.assertTrue(item["blocking"])
        self.assertEqual(item["detected"], [str(Path("Q:/Marketing"))])
        self.assertIn("nie jest zapisany", item["label"])

    def test_nothing_found(self):
        item, _ = self.run_check("")
        self.assertTrue(item["blocking"])
        self.assertEqual(item["detected"], [])
        self.assertEqual(item["action"], "pick_marketing")


class IndexCheckTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "file-index.json"

    def tearDown(self):
        self.tmp.cleanup()

    def test_missing(self):
        item = preflight.check_index(self.path)
        self.assertTrue(item["blocking"])
        self.assertIn("brak", item["label"])

    def test_too_small(self):
        self.path.write_text("{}", encoding="utf-8")
        item = preflight.check_index(self.path)
        self.assertTrue(item["blocking"])
        self.assertIn("pusty", item["label"])

    def test_present(self):
        self.path.write_bytes(b" " * 4096)
        item = preflight.check_index(self.path)
        self.assertTrue(item["ok"])
        self.assertEqual(item["bytes"], 4096)


class WatcherCheckTests(unittest.TestCase):
    def test_dead_with_error(self):
        item = preflight.check_watcher(lambda: {"watcher_ok": False, "last_error": "UnicodeDecodeError"})
        self.assertTrue(item["blocking"])
        self.assertIn("UnicodeDecodeError", item["hint"])

    def test_stale_counts_as_dead(self):
        item = preflight.check_watcher(lambda: {"watcher_ok": True, "stale": True})
        self.assertTrue(item["blocking"])

    def test_awaiting_first_rebuild_is_info(self):
        item = preflight.check_watcher(
            lambda: {"watcher_ok": True, "awaiting_first_rebuild": True, "last_error": "awaiting_first_rebuild"}
        )
        self.assertEqual((item["ok"], item["level"]), (True, "info"))
        self.assertTrue(item["awaiting_first_rebuild"])

    def test_last_run_failed_is_warning(self):
        item = preflight.check_watcher(lambda: {"watcher_ok": True, "last_ok": False, "last_error": "rc=1"})
        self.assertEqual((item["ok"], item["level"]), (True, "warn"))

    def test_alive(self):
        item = preflight.check_watcher(lambda: {"watcher_ok": True, "last_ok": True})
        self.assertEqual(item["level"], "ok")


class WebView2CheckTests(unittest.TestCase):
    def test_skipped_outside_windows(self):
        self.assertIsNone(preflight.check_webview2(lambda h, k: "1.0", platform="linux"))

    def test_found_in_hkcu(self):
        seen = []

        def reader(hive, k):
            seen.append((hive, k))
            return "128.0.2739.42" if hive == "HKCU" else None

        item = preflight.check_webview2(reader, platform="win32")
        self.assertTrue(item["ok"])
        self.assertEqual(item["level"], "info")
        self.assertEqual(item["version"], "128.0.2739.42")
        self.assertTrue(all(k.endswith("\\" + preflight.WEBVIEW2_CLIENT_GUID) for _, k in seen))
        self.assertNotIn("\\\\", seen[0][1])

    def test_missing_is_info_only(self):
        item = preflight.check_webview2(lambda h, k: "0.0.0.0", platform="win32")
        self.assertFalse(item["ok"])
        self.assertFalse(item["blocking"])

    def test_reader_error_is_tolerated(self):
        def boom(h, k):
            raise OSError("denied")

        item = preflight.check_webview2(boom, platform="win32")
        self.assertEqual(item["level"], "info")


class RunChecksTests(unittest.TestCase):
    def test_slow_check_hits_budget(self):
        release = threading.Event()

        def slow():
            release.wait(5)
            return preflight._item("marketing", True, "x")

        started = time.monotonic()
        report = preflight.run_checks([("marketing", slow), ("index", lambda: preflight._item("index", True, "ok"))], budget=0.3)
        release.set()
        self.assertLess(time.monotonic() - started, 1.5)
        slow_item = report["items"][0]
        self.assertEqual((slow_item["id"], slow_item["level"], slow_item.get("timeout")), ("marketing", "warn", True))
        self.assertTrue(report["ok"])

    def test_exception_and_blocking_summary(self):
        def broken():
            raise RuntimeError("kaput")

        report = preflight.run_checks(
            [
                ("database", broken),
                ("index", lambda: preflight._item("index", False, "brak")),
                ("webview2", lambda: None),
            ]
        )
        ids = [i["id"] for i in report["items"]]
        self.assertEqual(ids, ["database", "index"])
        self.assertEqual(report["items"][0]["level"], "warn")
        self.assertEqual(report["blocking"], ["index"])
        self.assertFalse(report["ok"])


class BridgeReportTests(unittest.TestCase):
    """build_preflight_report sklada punkty z mostu; wszystkie zrodla podmienione."""

    def test_report_uses_bridge_sources(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        index = Path(tmp.name) / "file-index.json"
        index.write_bytes(b" " * 2048)
        fake_md = types.SimpleNamespace(
            path_key=key,
            check_paths=mock.Mock(return_value={key("K:\\Marketing"): {"ok": True, "exists": True}}),
            discover_roots=mock.Mock(return_value=[]),
        )
        with mock.patch.dict(sys.modules, {"pg_db": fake_pg(health={"ok": False, "error": "timeout"})}), \
                mock.patch.object(local_bridge, "marketing_discovery", fake_md), \
                mock.patch.object(local_bridge, "read_machine_config", return_value={"base_path": "K:\\Marketing"}), \
                mock.patch.object(local_bridge, "INDEX_FILE", index), \
                mock.patch("index_supervisor.public_status", return_value={"watcher_ok": False, "last_error": "boom"}), \
                mock.patch.object(preflight, "check_webview2", return_value=None):
            report = local_bridge.build_preflight_report()
        by_id = {i["id"]: i for i in report["items"]}
        self.assertEqual(set(by_id), {"database", "marketing", "index", "watcher"})
        self.assertFalse(by_id["database"]["blocking"])
        self.assertTrue(by_id["marketing"]["ok"])
        self.assertTrue(by_id["index"]["ok"])
        # Ten przypadek ma ZDROWY indeks (2048 B) i martwy watcher. Pasek nazywa
        # sie "Pliki moga sie nie wyswietlac" - przy istniejacym indeksie pliki
        # wyswietlaja sie normalnie, wiec to ostrzezenie ("lista moze byc
        # nieaktualna"), a nie blokada. Poprzednia wersja tego testu wymagala
        # blocking=["watcher"] i utrwalala dokladnie ten falszywy czerwony pasek,
        # ktory uzytkownik zglaszal trzykrotnie (2.2.5, 2.2.8, 2.3.0).
        # Blokada zostaje zarezerwowana dla braku indeksu - patrz
        # tests/test_watcher_awaiting_not_error.py::PrawdziwaAwariaTests.
        self.assertEqual(report["blocking"], [])
        self.assertEqual(by_id["watcher"]["level"], "warn")
        self.assertIn("boom", by_id["watcher"]["hint"])
        fake_md.check_paths.assert_called_once()
        self.assertLessEqual(fake_md.check_paths.call_args.kwargs["timeout"], 2.0)
        fake_md.discover_roots.assert_not_called()


class _ServerMixin:
    public = False

    def setUp(self):
        self.patches = [
            mock.patch.object(local_bridge, "PUBLIC_MODE", self.public),
            mock.patch.object(local_bridge, "PUBLIC_HOSTS", {"inyfinn.synology.me"}),
            mock.patch.object(
                local_bridge, "build_preflight_report",
                return_value={"ok": True, "blocking": [], "items": [{"id": "index", "ok": True}]},
            ),
        ]
        for p in self.patches:
            p.start()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), local_bridge.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        for p in self.patches:
            p.stop()

    def _get(self, path, headers):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request("GET", path, headers=headers)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, json.loads(data or b"{}")


class DesktopRouteTests(_ServerMixin, unittest.TestCase):
    public = False

    def test_preflight_without_session(self):
        with mock.patch.object(local_bridge, "resolve_session", return_value={"ok": False}):
            status, data = self._get("/preflight", {"Origin": "http://127.0.0.1:8765"})
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertEqual(data["items"][0]["id"], "index")

    def test_preflight_foreign_origin_rejected(self):
        status, _ = self._get("/preflight", {"Origin": "https://evil.example"})
        self.assertEqual(status, 403)


class PublicRouteTests(_ServerMixin, unittest.TestCase):
    public = True

    def test_preflight_forbidden_even_with_session(self):
        self.assertIn("/preflight", local_bridge.PUBLIC_FORBIDDEN_PATHS)
        for session in ({"ok": False}, {"ok": True, "user": {"email": "a@b.c", "role": "admin"}}):
            with mock.patch.object(local_bridge, "resolve_session", return_value=session):
                # Bez X-Real-IP: blokada IP (ip_guard) nie jest pytana, test nie dotyka bazy.
                status, data = self._get("/preflight", {"Host": "inyfinn.synology.me"})
            self.assertEqual(status, 404)
            self.assertEqual(data.get("error"), "desktop_only")
        local_bridge.build_preflight_report.assert_not_called()


if __name__ == "__main__":
    unittest.main()
