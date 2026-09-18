# -*- coding: utf-8 -*-
"""Przeplyw auto-aktualizacji DAM bez sieci: sprawdzenie, pobieranie w tle, weryfikacja, instalacja."""
import base64
import hashlib
import io
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app_updates  # noqa: E402
import release_verify  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402

REPO = "https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases/download"
EXE_URL = REPO + "/v2.1.0/DAM-Setup.exe"
SIG_URL = REPO + "/v2.1.0/DAM-Setup.exe.sig"
CONTRACT_KEYS = {
    "ok", "status", "current", "target", "bytes", "total", "pct", "error",
    "installer_ready", "portable", "auto_check",
}


def _sign(key, data: bytes, version: str) -> bytes:
    digest = hashlib.sha256(data).hexdigest()
    raw = key.sign(release_verify.signed_message(version, digest))
    return json.dumps(
        {"v": 1, "version": version, "sha256": digest, "sig": base64.b64encode(raw).decode()}
    ).encode()


class FakeResp:
    def __init__(self, body: bytes, status: int = 200, headers=None, on_read=None):
        self._buf = io.BytesIO(body)
        self.status = status
        self.headers = dict(headers or {})
        self._on_read = on_read

    def read(self, n=-1):
        chunk = self._buf.read(n)
        if self._on_read:
            self._on_read(chunk)
        return chunk

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeGitHub:
    """Zamiennik urlopen: serwuje .exe (z Range), .sig i liste wydan. Notuje naglowki."""

    def __init__(self, exe: bytes, sig: bytes, releases=None, honor_range=True):
        self.exe = exe
        self.sig = sig
        self.releases = releases
        self.honor_range = honor_range
        self.requests = []
        self.on_read = None
        self.fail_with = {}

    def __call__(self, req, timeout=None):
        url = req.full_url
        headers = {k.lower(): v for k, v in req.header_items()}
        self.requests.append((url, headers))
        if url in self.fail_with:
            raise self.fail_with.pop(url)
        if url.endswith("/DAM-Setup.exe.sig"):
            return FakeResp(self.sig)
        if url.endswith("/DAM-Setup.exe"):
            rng = headers.get("range", "")
            if rng and self.honor_range:
                start = int(rng.split("=", 1)[1].rstrip("-"))
                body = self.exe[start:]
                return FakeResp(
                    body,
                    206,
                    {"Content-Range": f"bytes {start}-{len(self.exe) - 1}/{len(self.exe)}",
                     "Content-Length": str(len(body))},
                    self.on_read,
                )
            return FakeResp(self.exe, 200, {"Content-Length": str(len(self.exe))}, self.on_read)
        if "/releases?" in url:
            return FakeResp(json.dumps(self.releases).encode())
        raise AssertionError("nieoczekiwany URL: " + url)


class UpdaterSandbox(unittest.TestCase):
    """Kazdy test ma wlasny katalog data/ i klucz; nic nie dotyka prawdziwego bin/apps/desktop/data."""

    current = "2.0.8"

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.updates = root / "updates"
        vj = root / "version.json"
        vj.write_text(json.dumps({"version": self.current}), encoding="utf-8")
        self.key = Ed25519PrivateKey.generate()
        pub = self.key.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw
        )
        pubfile = root / "release-pubkey.json"
        pubfile.write_text(json.dumps({"keys": [{"ed25519": base64.b64encode(pub).decode()}]}))
        self.exe = os.urandom(3000) + b"MZ-DAM" * 200
        self.sig = _sign(self.key, self.exe, "2.1.0")
        patches = [
            mock.patch.object(app_updates, "INSTALLER_DIR", self.updates),
            mock.patch.object(app_updates, "STATE_PATH", root / "state.json"),
            mock.patch.object(app_updates, "PREFS_PATH", root / "prefs.json"),
            mock.patch.object(app_updates, "VERSION_JSON", vj),
            mock.patch.object(app_updates, "MIN_INSTALLER_BYTES", 1000),
            mock.patch.object(app_updates, "DOWNLOAD_CHUNK_BYTES", 1024),
            mock.patch.object(app_updates, "is_portable_repo", lambda: False),
            mock.patch.object(app_updates, "_TOKEN_CACHE", ""),
            mock.patch.object(release_verify, "PUBKEY_PATH", pubfile),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        app_updates._DL_STATE.update(
            {"status": "idle", "target": "", "bytes": 0, "total": 0, "error": "", "updated_at": 0.0}
        )
        app_updates._DL_THREAD = None
        app_updates._CHECK_THREAD = None
        app_updates._CANCEL.clear()
        app_updates._VERIFY_CACHE.clear()

    def tearDown(self):
        self.tmp.cleanup()

    def release(self, **kw):
        rel = {
            "version": "2.1.0",
            "exe_url": EXE_URL,
            "exe_api_url": "",
            "sig_url": SIG_URL,
            "sig_api_url": "",
            "size": len(self.exe),
            "sha256": hashlib.sha256(self.exe).hexdigest(),
        }
        rel.update(kw)
        return rel

    def releases_payload(self, with_sig=True):
        assets = [
            {"name": "DAM-Setup.exe", "browser_download_url": EXE_URL, "size": len(self.exe),
             "digest": "sha256:" + hashlib.sha256(self.exe).hexdigest(),
             "url": "https://api.github.com/repos/inyfinn/x/releases/assets/1"},
        ]
        if with_sig:
            assets.append({"name": "DAM-Setup.exe.sig", "browser_download_url": SIG_URL,
                           "size": len(self.sig),
                           "url": "https://api.github.com/repos/inyfinn/x/releases/assets/2"})
        return [{"tag_name": "v2.1.0", "draft": False, "prerelease": False, "assets": assets}]

    def run_worker(self, fake, **kw):
        with mock.patch.object(app_updates.urllib.request, "urlopen", fake):
            app_updates._download_worker(self.release(**kw))

    def vdir(self, v="2.1.0"):
        return self.updates / v


class VersionAndAssetTests(UpdaterSandbox):
    def test_version_compare(self):
        self.assertTrue(app_updates.is_newer("2.1.0", "2.0.8"))
        self.assertTrue(app_updates.is_newer("v2.0.9", "2.0.8"))
        self.assertFalse(app_updates.is_newer("2.0.8", "2.0.8"))
        self.assertFalse(app_updates.is_newer("2.0.10", "2.0.8"))  # nie kanoniczna
        self.assertFalse(app_updates.is_newer("1.9.9", "2.0.8"))

    def test_asset_requires_sig_and_reads_digest(self):
        rel = self.releases_payload(with_sig=False)[0]
        self.assertIsNone(app_updates._pick_setup_asset(rel, "DAM-Setup.exe"))
        rel = self.releases_payload()[0]
        picked = app_updates._pick_setup_asset(rel, "DAM-Setup.exe")
        self.assertEqual(picked["size"], len(self.exe))
        self.assertEqual(picked["sha256"], hashlib.sha256(self.exe).hexdigest())

    def test_no_token_still_queries_github(self):
        fake = FakeGitHub(self.exe, self.sig, releases=self.releases_payload())
        with mock.patch.object(app_updates.urllib.request, "urlopen", fake):
            out = app_updates._perform_github_check("")
        self.assertTrue(out["ok"], out)
        self.assertTrue(out["update_available"])
        self.assertEqual(out["latest"], "2.1.0")
        url, headers = fake.requests[0]
        self.assertIn("/releases?", url)
        self.assertNotIn("authorization", headers)
        self.assertEqual(headers["user-agent"], "DAM-Updater/1")

    def test_bad_token_falls_back_to_anonymous(self):
        fake = FakeGitHub(self.exe, self.sig, releases=self.releases_payload())
        url = "https://api.github.com/repos/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases?per_page=15"
        fake.fail_with[url] = urllib.error.HTTPError(url, 401, "bad", {}, None)
        with mock.patch.object(app_updates.urllib.request, "urlopen", fake):
            out = app_updates._perform_github_check("zly-token")
        self.assertTrue(out["update_available"], out)
        self.assertIn("authorization", fake.requests[0][1])
        self.assertNotIn("authorization", fake.requests[1][1])

    def test_unsigned_release_not_offered(self):
        fake = FakeGitHub(self.exe, self.sig, releases=self.releases_payload(with_sig=False))
        with mock.patch.object(app_updates.urllib.request, "urlopen", fake):
            out = app_updates._perform_github_check("")
        self.assertFalse(out["update_available"])
        self.assertEqual(out["error"], "github_no_setup_asset")

    def test_forced_check_starts_background_download(self):
        fake = FakeGitHub(self.exe, self.sig, releases=self.releases_payload())
        with mock.patch.object(app_updates.urllib.request, "urlopen", fake), \
                mock.patch.object(app_updates, "_start_download") as start:
            out = app_updates.check_for_updates(force=True, token="")
        self.assertTrue(out["update_available"])
        start.assert_called_once()
        rel = start.call_args[0][0]
        self.assertEqual(rel["version"], "2.1.0")
        self.assertEqual(rel["size"], len(self.exe))
        self.assertEqual(app_updates.download_status()["status"], "idle")


class DownloadTests(UpdaterSandbox):
    def test_full_download_ready_and_contract(self):
        fake = FakeGitHub(self.exe, self.sig)
        self.run_worker(fake)
        st = app_updates.download_status()
        self.assertEqual(set(st), CONTRACT_KEYS)
        self.assertEqual(st["status"], "ready", st)
        self.assertEqual(st["target"], "2.1.0")
        self.assertEqual(st["current"], "2.0.8")
        self.assertEqual(st["pct"], 100)
        self.assertTrue(st["installer_ready"])
        self.assertTrue((self.vdir() / "DAM-Setup.exe").is_file())
        self.assertFalse((self.vdir() / "DAM-Setup.exe.part").exists())
        self.assertFalse((self.updates / ".download.lock").exists())
        order = [u.rsplit("/", 1)[-1] for u, _h in fake.requests]
        self.assertEqual(order[0], "DAM-Setup.exe.sig")  # najpierw maly .sig
        self.assertTrue(all("authorization" not in h for _u, h in fake.requests))

    def test_digest_mismatch_deletes_and_errors(self):
        self.run_worker(FakeGitHub(self.exe, self.sig), sha256="0" * 64)
        st = app_updates.download_status()
        self.assertEqual(st["status"], "error")
        self.assertEqual(st["error"], "sha256_mismatch")
        self.assertFalse(st["ok"])
        self.assertFalse(self.vdir().exists())

    def test_size_mismatch_deletes(self):
        self.run_worker(FakeGitHub(self.exe, self.sig), size=len(self.exe) + 5)
        self.assertEqual(app_updates.download_status()["error"], "size_mismatch")
        self.assertFalse(self.vdir().exists())

    def test_bad_signature_deletes(self):
        other = Ed25519PrivateKey.generate()
        self.run_worker(FakeGitHub(self.exe, _sign(other, self.exe, "2.1.0")))
        st = app_updates.download_status()
        self.assertEqual(st["status"], "error")
        self.assertTrue(st["error"].startswith("signature_"), st)
        self.assertFalse(self.vdir().exists())

    def test_resume_with_range(self):
        self.vdir().mkdir(parents=True)
        (self.vdir() / "DAM-Setup.exe.part").write_bytes(self.exe[:1500])
        fake = FakeGitHub(self.exe, self.sig)
        self.run_worker(fake)
        exe_reqs = [h for u, h in fake.requests if u.endswith("/DAM-Setup.exe")]
        self.assertEqual(exe_reqs[0].get("range"), "bytes=1500-")
        self.assertEqual((self.vdir() / "DAM-Setup.exe").read_bytes(), self.exe)
        self.assertEqual(app_updates.download_status()["status"], "ready")

    def test_server_ignoring_range_restarts_from_zero(self):
        self.vdir().mkdir(parents=True)
        (self.vdir() / "DAM-Setup.exe.part").write_bytes(b"x" * 1500)
        self.run_worker(FakeGitHub(self.exe, self.sig, honor_range=False))
        self.assertEqual((self.vdir() / "DAM-Setup.exe").read_bytes(), self.exe)

    def test_cancel_keeps_part_for_resume(self):
        fake = FakeGitHub(self.exe, self.sig)
        fake.on_read = lambda chunk: app_updates._CANCEL.set()
        self.run_worker(fake)
        st = app_updates.download_status()
        self.assertEqual(st["status"], "idle")
        part = self.vdir() / "DAM-Setup.exe.part"
        self.assertTrue(part.is_file())
        self.assertLess(part.stat().st_size, len(self.exe))
        self.assertFalse((self.vdir() / "DAM-Setup.exe").exists())

    def test_cancel_action_sets_flag(self):
        st = app_updates.apply_action("cancel")
        self.assertTrue(app_updates._CANCEL.is_set())
        self.assertEqual(set(st), CONTRACT_KEYS)

    def test_network_error_keeps_part(self):
        fake = FakeGitHub(self.exe, self.sig)

        def boom(chunk):
            if chunk:
                raise OSError("siec padla")

        fake.on_read = boom
        self.run_worker(fake)
        st = app_updates.download_status()
        self.assertEqual(st["error"], "download_failed")
        self.assertTrue((self.vdir() / "DAM-Setup.exe.part").is_file())

    def test_second_process_holding_lock_is_respected(self):
        self.updates.mkdir(parents=True)
        (self.updates / ".download.lock").write_text("999")
        fake = FakeGitHub(self.exe, self.sig)
        self.run_worker(fake)
        self.assertEqual(fake.requests, [])

    def test_cache_limit_two_versions(self):
        for v in ("2.0.9", "2.1.0"):
            d = self.vdir(v)
            d.mkdir(parents=True)
            (d / "DAM-Setup.exe").write_bytes(b"x")
            (d / "DAM-Setup.exe.sig").write_bytes(b"x")
        (self.updates / "DAM-Setup.exe").write_bytes(b"legacy")
        self.vdir("2.1.1").mkdir()
        app_updates._enforce_cache_limit("2.1.1")
        self.assertEqual(sorted(app_updates._cached_versions()), ["2.1.0", "2.1.1"])
        self.assertFalse((self.updates / "DAM-Setup.exe").exists())

    def test_portable_never_downloads(self):
        with mock.patch.object(app_updates, "is_portable_repo", lambda: True):
            st = app_updates.download_status()
            self.assertEqual(st["status"], "idle")
            self.assertTrue(st["portable"])
            res = app_updates.apply_action("download")
            self.assertFalse(res["ok"])
            self.assertEqual(res["error"], "portable_skip")
            self.assertFalse(app_updates.apply_action("install")["ok"])


class InstallTests(UpdaterSandbox):
    def _place(self, sig=None):
        d = self.vdir()
        d.mkdir(parents=True)
        (d / "DAM-Setup.exe").write_bytes(self.exe)
        (d / "DAM-Setup.exe.sig").write_bytes(self.sig if sig is None else sig)
        return d / "DAM-Setup.exe"

    def test_install_launches_signed_installer(self):
        exe = self._place()
        with mock.patch.object(app_updates.subprocess, "Popen") as popen:
            res = app_updates.apply_action("install")
        self.assertEqual(res, {"ok": True, "launched": True, "target": "2.1.0"})
        args, kw = popen.call_args
        self.assertEqual(
            args[0],
            [str(exe.resolve()), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/DAMRELAUNCH=1"],
        )
        self.assertIs(kw["stdin"], app_updates.subprocess.DEVNULL)
        self.assertIs(kw["stdout"], app_updates.subprocess.DEVNULL)
        self.assertIs(kw["stderr"], app_updates.subprocess.DEVNULL)
        self.assertTrue(kw["close_fds"])
        if sys.platform == "win32":
            self.assertEqual(kw["creationflags"], 0x08000000 | 0x00000200)
        marker = json.loads((self.updates / "pending_success.json").read_text(encoding="utf-8"))
        self.assertEqual(marker["target_version"], "2.1.0")

    def test_install_refuses_unsigned(self):
        self._place(sig=b"")
        (self.vdir() / "DAM-Setup.exe.sig").unlink()
        app_updates._DL_STATE["target"] = "2.1.0"
        with mock.patch.object(app_updates.subprocess, "Popen") as popen:
            res = app_updates.apply_action("install")
        self.assertFalse(res["ok"])
        self.assertTrue(res["error"].startswith("signature_"), res)
        popen.assert_not_called()
        self.assertFalse((self.vdir() / "DAM-Setup.exe").exists())
        self.assertFalse((self.updates / "pending_success.json").exists())

    def test_install_rechecks_without_cache(self):
        self._place()
        self.assertTrue(app_updates.installer_ready("2.1.0"))  # cache: ok
        exe = self.vdir() / "DAM-Setup.exe"
        st = exe.stat()
        exe.write_bytes(self.exe[:-1] + b"!")  # podmiana, ten sam rozmiar
        os.utime(exe, ns=(st.st_atime_ns, st.st_mtime_ns))
        app_updates._DL_STATE["target"] = "2.1.0"
        with mock.patch.object(app_updates.subprocess, "Popen") as popen:
            res = app_updates.apply_action("install")
        self.assertEqual(res["error"], "signature_sha256_mismatch")
        popen.assert_not_called()

    def test_install_not_ready(self):
        self.assertEqual(app_updates.apply_action("install"), {"ok": False, "error": "not_ready"})

    def test_launch_refuses_path_outside_updates(self):
        other = Path(self.tmp.name) / "2.1.0" / "DAM-Setup.exe"
        other.parent.mkdir()
        other.write_bytes(self.exe)
        res = app_updates._launch_installer(other)
        self.assertEqual(res["error"], "installer_path_forbidden")

    def test_download_action_ignores_foreign_url(self):
        with mock.patch.object(app_updates, "_start_download") as start, \
                mock.patch.object(app_updates.threading, "Thread") as thr:
            app_updates.apply_action("download", "https://evil.example/DAM-Setup.exe")
        start.assert_not_called()  # brak wydania z API -> tylko sprawdzenie w tle
        thr.assert_called_once()


class SuccessMarkerTests(UpdaterSandbox):
    def test_marker_consumed_once(self):
        app_updates.mark_pending_success("2.0.8")
        self.assertEqual(app_updates.consume_success_marker(), {"ok": True, "version": "2.0.8"})
        self.assertEqual(app_updates.consume_success_marker(), {"ok": True, "version": None})

    def test_stale_marker_deleted_silently(self):
        app_updates.mark_pending_success("2.0.7")
        self.assertEqual(app_updates.consume_success_marker(), {"ok": True, "version": None})
        self.assertFalse((self.updates / "pending_success.json").exists())

    def test_fresh_newer_marker_kept_while_installer_runs(self):
        app_updates.mark_pending_success("2.1.0")
        self.assertEqual(app_updates.consume_success_marker()["version"], None)
        self.assertTrue((self.updates / "pending_success.json").exists())

    def test_old_newer_marker_deleted(self):
        path = self.updates / "pending_success.json"
        self.updates.mkdir(parents=True)
        path.write_text(json.dumps({"target_version": "2.1.0", "created_at": time.time() - 3600}))
        self.assertEqual(app_updates.consume_success_marker()["version"], None)
        self.assertFalse(path.exists())

    def test_no_marker(self):
        self.assertEqual(app_updates.consume_success_marker(), {"ok": True, "version": None})


class ScheduleTests(unittest.TestCase):
    def test_first_check_after_20s(self):
        self.assertEqual(app_updates.seconds_until_next_check(100.0, 100.0, None), 20.0)
        self.assertEqual(app_updates.seconds_until_next_check(110.0, 100.0, None), 10.0)
        self.assertEqual(app_updates.seconds_until_next_check(125.0, 100.0, None), 0.0)

    def test_then_every_6h(self):
        self.assertEqual(app_updates.seconds_until_next_check(500.0, 100.0, 500.0), 6 * 3600.0)
        self.assertEqual(app_updates.seconds_until_next_check(500.0 + 6 * 3600, 100.0, 500.0), 0.0)


if __name__ == "__main__":
    unittest.main()
