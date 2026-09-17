"""Podpis wydania: tylko plik podpisany przypietym kluczem i nowszy od biezacej wersji przechodzi."""
import base64
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app_updates  # noqa: E402
import release_verify  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402


def _pub(key):
    return key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)


def _sig(key, path, version):
    digest = release_verify.file_sha256(path)
    raw = key.sign(release_verify.signed_message(version, digest))
    return json.dumps(
        {"v": 1, "version": version, "sha256": digest, "sig": base64.b64encode(raw).decode()}
    ).encode()


class ReleaseVerifyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.exe = Path(self.tmp.name) / "DAM-Setup.exe"
        self.exe.write_bytes(b"MZ" + b"\0" * 4096)
        self.key = Ed25519PrivateKey.generate()
        self.keys = [_pub(self.key)]

    def tearDown(self):
        self.tmp.cleanup()

    def _verify(self, sig, **kw):
        return release_verify.verify_installer(
            self.exe, sig, public_keys=self.keys, parse_version=app_updates.parse_version, **kw
        )

    def test_valid_signature(self):
        self.assertEqual(self._verify(_sig(self.key, self.exe, "2.0.8")), (True, "ok"))

    def test_tampered_file_rejected(self):
        sig = _sig(self.key, self.exe, "2.0.8")
        self.exe.write_bytes(b"MZ" + b"\1" * 4096)
        self.assertEqual(self._verify(sig), (False, "sha256_mismatch"))

    def test_foreign_key_rejected(self):
        other = Ed25519PrivateKey.generate()
        self.assertEqual(self._verify(_sig(other, self.exe, "2.0.8")), (False, "signature_invalid"))

    def test_version_swap_rejected(self):
        body = json.loads(_sig(self.key, self.exe, "2.0.8"))
        body["version"] = "9.9.9"
        self.assertEqual(self._verify(json.dumps(body).encode()), (False, "signature_invalid"))

    def test_downgrade_rejected(self):
        sig = _sig(self.key, self.exe, "2.0.6")
        self.assertEqual(
            self._verify(sig, min_version_exclusive=app_updates.parse_version("2.0.7")),
            (False, "version_not_newer"),
        )

    def test_garbage_signature(self):
        self.assertEqual(self._verify(b"not json"), (False, "sig_malformed"))

    def test_pinned_key_file_is_valid(self):
        self.assertTrue(release_verify.load_public_keys(), "release-pubkey.json musi miec klucz")


class UpdaterUrlTests(unittest.TestCase):
    def test_substring_host_rejected(self):
        self.assertFalse(app_updates._is_setup_download_url("https://evil.example/github.com/DAM-Setup.exe"))
        self.assertFalse(app_updates._is_setup_download_url("http://github.com/a/b/releases/download/v1/DAM-Setup.exe"))
        self.assertTrue(
            app_updates._is_setup_download_url("https://github.com/a/b/releases/download/v2.0.8/DAM-Setup.exe")
        )

    def test_unsigned_release_is_not_an_update(self):
        rel = {
            "assets": [
                {
                    "name": "DAM-Setup.exe",
                    "browser_download_url": "https://github.com/a/b/releases/download/v2.0.8/DAM-Setup.exe",
                    "url": "https://api.github.com/repos/a/b/releases/assets/1",
                }
            ]
        }
        self.assertIsNone(app_updates._pick_setup_asset(rel, "DAM-Setup.exe"))
        rel["assets"].append(
            {
                "name": "DAM-Setup.exe.sig",
                "browser_download_url": "https://github.com/a/b/releases/download/v2.0.8/DAM-Setup.exe.sig",
                "url": "https://api.github.com/repos/a/b/releases/assets/2",
            }
        )
        self.assertTrue(app_updates._pick_setup_asset(rel, "DAM-Setup.exe")["sig_url"])

    def test_launch_refuses_foreign_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake = Path(tmp) / "evil.exe"
            fake.write_bytes(b"MZ")
            res = app_updates._launch_installer(fake)
            self.assertFalse(res["ok"])


if __name__ == "__main__":
    unittest.main()
