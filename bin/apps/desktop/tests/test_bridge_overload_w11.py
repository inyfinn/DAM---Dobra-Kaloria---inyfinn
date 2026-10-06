# -*- coding: utf-8 -*-
"""W11 (05.10.2026): most po ~3 h mial 20 139 watkow, 133 tys. uchwytow i 15-20 GB, a /health nie
odpowiadal 40 s. Testy pilnuja przyczyn: watek na kazde zapytanie porzucany po timeoucie,
brak limitu watkow serwera, /health liczone w watku zapytania (SQLite), rownolegle parsowanie
tego samego wielkiego JSON-a, dwa watki piszace plik statusu pod ta sama nazwa .tmp.

Wylacznie atrapy: bez sieci zewnetrznej, bez prawdziwych procesow, bez prawdziwej bazy."""
from __future__ import annotations

import http.client
import importlib.util
import json
import os
import queue
import socket
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import dam_daemon_pool as dpool  # noqa: E402
import dam_thumb_cache as tc  # noqa: E402
import index_supervisor as isup  # noqa: E402
import local_bridge as lb  # noqa: E402

WATCH_SCRIPT = DESKTOP.parent / "web" / "scripts" / "watch-file-index.py"


def fire(fn, n: int, workers: int = 40) -> None:
    """n wywolan fn(i) z <= workers rownoleglych 'handlerow'; wraca, gdy wszystkie wroca."""
    idx = iter(range(n))
    lock = threading.Lock()

    def runner() -> None:
        while True:
            with lock:
                i = next(idx, None)
            if i is None:
                return
            fn(i)

    ts = [threading.Thread(target=runner) for _ in range(workers)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()


class ThumbBuildPoolTests(unittest.TestCase):
    def setUp(self):
        self.release = threading.Event()
        self.addCleanup(self.release.set)
        self.base = threading.active_count()

    def _blocked(self, *_a, **_k):
        self.release.wait(30)
        return 200, b"x", "image/jpeg", {"ok": True}

    def test_thread_growth_bounded_under_200_blocked_requests(self):
        codes: list[int] = []
        with mock.patch.object(tc, "get_or_build_thumb", self._blocked):
            fire(lambda i: codes.append(lb._thumb_cache_with_timeout(f"M:/w11/a{i}.png", timeout_s=0.2)[0]), 200)
            grown = threading.active_count() - self.base
        self.assertEqual(len(codes), 200)
        self.assertEqual(set(codes), {504})
        self.assertLessEqual(grown, lb.THUMB_BUILD_WORKERS + 2, f"watki urosly o {grown}")

    def test_same_path_builds_once_and_every_waiter_gets_the_result(self):
        calls: list[int] = []

        def build(*_a, **_k):
            calls.append(1)
            self.release.wait(30)
            return 200, b"x", "image/jpeg", {"ok": True}

        results: list[int] = []
        with mock.patch.object(tc, "get_or_build_thumb", build):
            ts = [
                threading.Thread(
                    target=lambda: results.append(lb._thumb_cache_with_timeout("M:/w11/same.png", timeout_s=5)[0])
                )
                for _ in range(100)
            ]
            for t in ts:
                t.start()
            time.sleep(0.4)
            self.release.set()
            for t in ts:
                t.join()
        self.assertEqual(len(calls), 1, "jedna budowa na sciezke")
        self.assertEqual(results.count(200), 100)

    def test_waiter_timeout_does_not_orphan_the_running_build(self):
        calls: list[int] = []

        def build(*_a, **_k):
            calls.append(1)
            self.release.wait(30)
            return 200, b"x", "image/jpeg", {"ok": True}

        with mock.patch.object(tc, "get_or_build_thumb", build):
            first = lb._thumb_cache_with_timeout("M:/w11/late.png", timeout_s=0.2)
            self.assertEqual(first[0], 504)
            out: list[int] = []
            t = threading.Thread(target=lambda: out.append(lb._thumb_cache_with_timeout("M:/w11/late.png", timeout_s=5)[0]))
            t.start()
            time.sleep(0.2)
            self.release.set()
            t.join()
        self.assertEqual(out, [200])
        self.assertEqual(len(calls), 1, "drugie zapytanie dolaczylo do trwajacej budowy")

    def test_cache_hits_are_served_even_when_every_build_worker_is_stuck(self):
        ok = (200, b"thumb", "image/avif", {"ok": True, "cache_hit": True})

        def lookup(rel, _prof):
            hit = (Path("C:/fake/t.avif"), "image/avif", "dg")
            return hit if "cached" in rel else (None, "", "")

        with mock.patch.object(tc, "get_or_build_thumb", self._blocked), \
                mock.patch.object(tc, "_marketing_cache_only", return_value=False), \
                mock.patch.object(tc, "_lookup_by_rel", side_effect=lookup), \
                mock.patch.object(tc, "_load_rel_index", return_value={}), \
                mock.patch.object(tc, "_outdated", return_value=False), \
                mock.patch.object(tc, "_serve_cached", return_value=ok), \
                mock.patch.object(tc, "_revalidate_thumb", lambda **_k: None):
            fire(lambda i: lb._thumb_cache_with_timeout(f"M:/w11/miss{i}.png", timeout_s=0.2), lb.THUMB_BUILD_WORKERS + 6)
            t0 = time.perf_counter()
            code = lb._thumb_cache_with_timeout("M:/w11/cached.png", timeout_s=0.5)[0]
            dt = time.perf_counter() - t0
        self.assertEqual(code, 200)
        self.assertLess(dt, 0.3, "trafienie w cache czekalo w kolejce za zablokowanymi budowami")

    def test_build_error_is_500_not_a_hang(self):
        def boom(*_a, **_k):
            raise RuntimeError("zepsute")

        with mock.patch.object(tc, "get_or_build_thumb", boom):
            code, _b, _c, meta = lb._thumb_cache_with_timeout("M:/w11/err.png", timeout_s=2)
        self.assertEqual(code, 500)
        self.assertEqual(meta["error"], "thumb_build_failed")


class ProbePoolTests(unittest.TestCase):
    def setUp(self):
        self.release = threading.Event()
        self.addCleanup(self.release.set)
        self.base = threading.active_count()

    def test_mtime_quick_stuck_stat_does_not_spawn_a_thread_per_call(self):
        def stuck(_p):
            self.release.wait(30)
            return 1.0

        results: list = []
        with mock.patch.object(tc, "_drive_letter_alive", return_value=True), \
                mock.patch.object(os.path, "getmtime", stuck):
            fire(lambda i: results.append(tc._mtime_quick(f"M:/w11/p{i}.png", timeout_s=0.05)), 200)
            grown = threading.active_count() - self.base
        self.assertEqual(results.count(None), 200)
        self.assertLessEqual(grown, 24 + 2, f"watki urosly o {grown}")

    def test_backfill_encode_timeouts_do_not_leak_a_thread_each(self):
        def stuck(*_a, **_k):
            self.release.wait(30)
            return (None, "")

        timed_out: list[bool] = []
        with mock.patch.object(tc, "_encode_thumb", stuck), \
                mock.patch.object(tc, "_cache_paths", return_value=(Path("a.avif"), Path("a.jpg"))):
            fire(lambda i: timed_out.append(tc._encode_with_timeout(f"M:/w11/e{i}.png", "d", 480, 1.0)[2]), 24, workers=24)
            grown = threading.active_count() - self.base
        self.assertEqual(timed_out, [True] * 24)
        self.assertLessEqual(grown, 4 + 2, f"watki urosly o {grown}")

    def test_revalidate_is_bounded_and_deduplicated(self):
        started: list[str] = []

        def stuck_revalidate(**kw):
            started.append(kw["lookup_rel"])
            self.release.wait(30)

        hit = (Path("C:/fake/thumb.avif"), "image/avif", "digest-1")
        ok = (200, b"x", "image/avif", {"ok": True})
        with mock.patch.object(tc, "_marketing_cache_only", return_value=False), \
                mock.patch.object(tc, "_lookup_by_rel", return_value=hit), \
                mock.patch.object(tc, "_load_rel_index", return_value={}), \
                mock.patch.object(tc, "_outdated", return_value=False), \
                mock.patch.object(tc, "_serve_cached", return_value=ok), \
                mock.patch.object(tc, "_revalidate_thumb", stuck_revalidate):
            fire(lambda i: tc.get_or_build_thumb(f"M:/w11/r{i % 50}.png", profile="grid"), 200)
            grown = threading.active_count() - self.base
            self.release.set()
            deadline = time.time() + 5
            while tc._REVAL_POOL.stats()["inflight"] and time.time() < deadline:
                time.sleep(0.05)
        self.assertLessEqual(grown, 2 + 2, f"watki urosly o {grown}")
        self.assertEqual(len(started), len(set(started)), "to samo odswiezenie nie startuje dwa razy naraz")
        self.assertLessEqual(len(started), 50)


class DaemonPoolUnitTests(unittest.TestCase):
    def test_queued_work_is_cancelled_when_the_only_waiter_times_out(self):
        pool = dpool.DaemonPool(workers=1, queue_max=8, name="t-cancel")
        gate = threading.Event()
        self.addCleanup(gate.set)
        ran: list[str] = []

        def work(tag):
            ran.append(tag)
            gate.wait(10)

        t = threading.Thread(target=lambda: pool.run_once("busy", 5, work, "busy"))
        t.start()
        time.sleep(0.1)
        with self.assertRaises(dpool.FutureTimeout):
            pool.run_once("queued", 0.1, work, "queued")
        gate.set()
        t.join()
        time.sleep(0.2)
        self.assertEqual(ran, ["busy"], "zadanie, na ktore nikt nie czeka i ktore nie ruszylo, jest anulowane")

    def test_full_queue_raises_instead_of_growing(self):
        pool = dpool.DaemonPool(workers=1, queue_max=2, name="t-full")
        gate = threading.Event()
        self.addCleanup(gate.set)
        for _ in range(3):
            pool.submit(gate.wait, 10)
        time.sleep(0.1)
        with self.assertRaises(queue.Full):
            for _ in range(5):
                pool.call(0.05, gate.wait, 10)

    def test_fire_once_ignores_same_key_while_running(self):
        pool = dpool.DaemonPool(workers=2, queue_max=8, name="t-fire")
        gate = threading.Event()
        self.addCleanup(gate.set)
        n: list[int] = []

        def work():
            n.append(1)
            gate.wait(10)

        self.assertTrue(pool.fire_once("k", work))
        time.sleep(0.05)
        self.assertFalse(pool.fire_once("k", work))
        self.assertEqual(len(n), 1)


class HealthLatencyTests(unittest.TestCase):
    """/health musi odpowiadac z pamieci, nawet gdy SQLite (timeout=60 s) i pliki watchera stoja."""

    def setUp(self):
        import assoc_repo

        self.release = threading.Event()
        self.addCleanup(self.release.set)

        def slow_counts(*_a, **_k):
            self.release.wait(10)
            return {"ok": True, "counts": {}, "schema_error": "", "total": 0}

        def slow_status():
            self.release.wait(10)
            return {"ok": True, "watcher_ok": True}

        self.assoc_bg = lb._BgValue(
            lambda: lb._assoc_status_payload(), 5.0, "t-health-assoc",
            {"ok": True, "counts": {}, "schema_error": "", "total": 0, "pending": True},
        )
        self.watch_bg = lb._BgValue(
            lambda: lb._watcher_status_payload(), 2.0, "t-health-watcher",
            {"ok": True, "watcher_ok": False, "pending": True},
        )
        patches = [
            mock.patch.object(assoc_repo, "status_counts", slow_counts),
            mock.patch.object(isup, "public_status", slow_status),
            mock.patch.object(lb, "_HEALTH_ASSOC", self.assoc_bg),
            mock.patch.object(lb, "_HEALTH_WATCHER", self.watch_bg),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self.assoc_bg.stop)
        self.addCleanup(self.watch_bg.stop)
        self.httpd = lb.BridgeHTTPServer(("127.0.0.1", 0), lb.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.addCleanup(self.httpd.server_close)
        self.addCleanup(self.httpd.shutdown)

    def _get(self) -> tuple[int, dict, float]:
        t0 = time.perf_counter()
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request("GET", "/health")
        resp = conn.getresponse()
        body = resp.read()
        dt = time.perf_counter() - t0
        conn.close()
        return resp.status, json.loads(body), dt

    def test_health_answers_under_100ms_while_sqlite_and_watcher_are_stuck(self):
        times = []
        for _ in range(6):
            status, data, dt = self._get()
            times.append(dt)
            self.assertEqual(status, 200)
            self.assertTrue(data["ok"])
            self.assertIn("http", data)
        self.assertLess(max(times), 0.1, f"czasy /health: {[round(t, 3) for t in times]}")

    def test_health_serves_cached_values_once_background_refresh_finishes(self):
        self._get()
        self.release.set()
        deadline = time.time() + 5
        data = {}
        while time.time() < deadline:
            _s, data, _dt = self._get()
            if not data["assoc"].get("pending") and data["watcher_ok"]:
                break
            time.sleep(0.1)
        self.assertFalse(data["assoc"].get("pending"))
        self.assertTrue(data["watcher_ok"])
        self.assertIsNotNone(data["health_cache_age_s"]["assoc"])


class _GateHandler(BaseHTTPRequestHandler):
    gate: threading.Event

    def do_GET(self):  # noqa: N802
        if self.path.startswith("/health"):
            body = b"alive"
        else:
            self.gate.wait(10)
            body = b"slow"
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_a):
        pass


class HandlerThreadCapTests(unittest.TestCase):
    def setUp(self):
        self.gate = threading.Event()
        self.addCleanup(self.gate.set)
        handler = type("H", (_GateHandler,), {"gate": self.gate})

        class Small(lb.BridgeHTTPServer):
            max_handler_threads = 4
            health_reserve = 2

        self.base = threading.active_count()
        self.httpd = Small(("127.0.0.1", 0), handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.addCleanup(self.httpd.server_close)
        self.addCleanup(self.httpd.shutdown)

    def _raw(self, path: str, read: bool = True) -> tuple[bytes, socket.socket]:
        s = socket.create_connection(("127.0.0.1", self.port), timeout=3)
        s.sendall(f"GET {path} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n".encode())
        data = s.recv(4096) if read else b""
        return data, s

    def test_over_the_cap_gets_503_retry_after_fast_and_threads_stay_bounded(self):
        held = [self._raw("/slow", read=False)[1] for _ in range(4)]
        for h in held:
            self.addCleanup(h.close)
        time.sleep(0.3)
        t0 = time.perf_counter()
        data, s = self._raw("/slow")
        s.close()
        self.assertLess(time.perf_counter() - t0, 0.5)
        self.assertTrue(data.startswith(b"HTTP/1.1 503"), data[:60])
        self.assertIn(b"Retry-After: 1", data)
        # zalew 100 polaczen ponad limit: wszystkie 503, a watkow nie przybywa
        rejected = 0
        for _ in range(100):
            d, sk = self._raw("/slow")
            sk.close()
            rejected += d.startswith(b"HTTP/1.1 503")
        self.assertEqual(rejected, 100)
        grown = threading.active_count() - self.base
        self.assertLessEqual(grown, 4 + 1 + 2, f"watki urosly o {grown}")
        # /health przechodzi na rezerwie mimo calkowicie zajetych miejscach
        d, sk = self._raw("/health")
        sk.close()
        self.assertTrue(d.startswith(b"HTTP/1.0 200") or d.startswith(b"HTTP/1.1 200"), d[:60])
        self.gate.set()
        for h in held:
            h.close()

    def test_real_bridge_server_keeps_backlog_and_cap_defaults(self):
        self.assertGreaterEqual(lb.BridgeHTTPServer.request_queue_size, 128)
        self.assertTrue(lb.BridgeHTTPServer.daemon_threads)
        self.assertGreaterEqual(lb.BridgeHTTPServer.max_handler_threads, 32)


class JsonSingleFlightTests(unittest.TestCase):
    def test_cold_cache_parses_a_big_file_once_not_once_per_request(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "big.json"
            p.write_text(json.dumps({"assets": list(range(1000))}), encoding="utf-8")
            real = json.loads
            parses: list[int] = []

            def slow_loads(s, *a, **k):
                parses.append(1)
                time.sleep(0.3)
                return real(s, *a, **k)

            out: list = []
            with mock.patch.object(lb.json, "loads", slow_loads):
                fire(lambda i: out.append(lb._load_json(p, None)), 8, workers=8)
        self.assertEqual(len(out), 8)
        self.assertEqual(len(parses), 1, f"rownolegle parsowania: {len(parses)}")
        self.assertTrue(all(o is out[0] for o in out))


class BigJsonStreamingTests(unittest.TestCase):
    """/branding-index?full=1 i /branding-search-index leca bajtami z dysku, bez json.loads."""

    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.addCleanup(self.td.cleanup)
        self.httpd = lb.BridgeHTTPServer(("127.0.0.1", 0), lb.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.addCleanup(self.httpd.server_close)
        self.addCleanup(self.httpd.shutdown)

    def _get(self, path: str) -> tuple[int, bytes, dict]:
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request("GET", path)
        r = conn.getresponse()
        body = r.read()
        hdrs = dict(r.getheaders())
        conn.close()
        return r.status, body, hdrs

    def test_search_index_and_full_index_are_streamed_without_parsing(self):
        cases = {
            "compact": '{"a":[1,2],"b":"zażółć"}',
            "indented": '{\n  "a": [1, 2],\n  "b": "zażółć"\n}\n',
        }
        for name, text in cases.items():
            f = Path(self.td.name) / f"{name}.json"
            f.write_text(text, encoding="utf-8")
            for route, attr in (("/branding-search-index", "BRANDING_SEARCH_INDEX_FILE"), ("/branding-index?full=1", "BRANDING_INDEX_FILE")):
                with mock.patch.object(lb, attr, f), mock.patch.object(
                    lb, "_load_json", side_effect=AssertionError("parsowanie wielkiego JSON-a w watku zapytania")
                ):
                    status, body, hdrs = self._get(route)
                self.assertEqual(status, 200, (name, route))
                self.assertEqual(int(hdrs["Content-Length"]), len(body), (name, route))
                self.assertEqual(json.loads(body), {"ok": True, "a": [1, 2], "b": "zażółć"}, (name, route))

    def test_empty_object_and_truncated_file(self):
        empty = Path(self.td.name) / "empty.json"
        empty.write_text("{ }", encoding="utf-8")
        with mock.patch.object(lb, "BRANDING_SEARCH_INDEX_FILE", empty):
            status, body, _h = self._get("/branding-search-index")
        self.assertEqual((status, json.loads(body)), (200, {"ok": True}))
        cut = Path(self.td.name) / "cut.json"
        cut.write_text('{"a":[1,2', encoding="utf-8")
        with mock.patch.object(lb, "BRANDING_SEARCH_INDEX_FILE", cut):
            status, body, _h = self._get("/branding-search-index")
        self.assertEqual(status, 404)  # obciety plik = jak dotad (nie smiec z 200)
        self.assertEqual(json.loads(body)["error"], "branding_search_index_missing")


def _load_watch_module():
    spec = importlib.util.spec_from_file_location("dam_watch_file_index_w11", WATCH_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


class StatusFileWritersTests(unittest.TestCase):
    """Dwa watki jednego procesu (petla glowna watchera i "dam-index-live") pisza index-watcher-status.json."""

    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.addCleanup(self.td.cleanup)
        self.dir = Path(self.td.name)
        self.status = self.dir / "index-watcher-status.json"
        p = mock.patch.object(isup, "WATCHER_STATUS", self.status)
        p.start()
        self.addCleanup(p.stop)
        self.watch = _load_watch_module()

    def _hammer(self, writers: list, iterations: int = 40):
        stop = threading.Event()
        bad: list[str] = []
        reads = [0]

        def reader():
            while not stop.is_set():
                try:
                    raw = self.status.read_bytes()
                except OSError:
                    continue  # Windows: plik chwilowo w podmianie
                reads[0] += 1
                try:
                    json.loads(raw.decode("utf-8"))
                except ValueError as exc:
                    bad.append(f"{type(exc).__name__}: {str(exc)[:60]}")

        rt = threading.Thread(target=reader)
        rt.start()
        ts = [threading.Thread(target=lambda w=w: [w(i) for i in range(iterations)]) for w in writers]
        for t in ts:
            t.start()
        for t in ts:
            t.join()
        stop.set()
        rt.join()
        return bad, reads[0]

    def test_two_threads_two_writers_never_leave_an_invalid_file(self):
        big = "A" * 30000
        small = "b"

        def w_sup_big(i):
            isup.write_watcher_status({"ok": True, "stage": "x", "blob": big}, preserve_last=False)

        def w_watch_small(i):
            self.watch._write_status(self.status, {"ok": True, "stage": "y", "blob": small}, preserve_last=False)

        bad, reads = self._hammer([w_sup_big, w_sup_big, w_watch_small, w_watch_small])
        self.assertGreater(reads, 0)
        self.assertEqual(bad, [], f"niepoprawny JSON widziany {len(bad)}x z {reads} odczytow: {bad[:2]}")
        json.loads(self.status.read_text(encoding="utf-8"))
        self.assertEqual(sorted(p.name for p in self.dir.glob("*.tmp")), [], "zostaly pliki .tmp")
        self.assertFalse(self.status.with_name(self.status.name + ".corrupt").exists())

    def test_atomic_helper_alone_is_safe_from_many_threads(self):
        """Pliki control/live (bez wspolnej blokady): sama nazwa .tmp musi byc unikalna per zapis."""
        target = self.dir / "index-live.json"
        big = "A" * 30000
        bad: list[str] = []
        stop = threading.Event()

        def reader():
            while not stop.is_set():
                try:
                    raw = target.read_bytes()
                except OSError:
                    continue
                try:
                    json.loads(raw.decode("utf-8"))
                except ValueError as exc:
                    bad.append(str(exc)[:40])

        rt = threading.Thread(target=reader)
        rt.start()
        ts = [
            threading.Thread(
                target=lambda k=k: [isup._write_json_atomic(target, {"k": k, "blob": big if k % 2 else "b"}) for _ in range(40)]
            )
            for k in range(4)
        ]
        for t in ts:
            t.start()
        for t in ts:
            t.join()
        stop.set()
        rt.join()
        self.assertEqual(bad, [], f"niepoprawny JSON {len(bad)}x")
        self.assertEqual(sorted(p.name for p in self.dir.glob("*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
