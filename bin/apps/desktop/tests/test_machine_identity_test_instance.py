# -*- coding: utf-8 -*-
"""machine_identity: tryb instancji testowej (plan naprawy, sekcja 0 i 8).

Trzy izolowane instancje A/B/C na jednym komputerze i jednym koncie Windows
musza miec rozne machine_id/device_id. DAM_TEST_INSTANCE dziala tylko razem z
DAM_TEST_PG=1; bez tego produkcja liczy tozsamosc dokladnie jak przed zmiana.
"""
from __future__ import annotations

import hashlib
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

DESKTOP_DIR = Path(__file__).resolve().parents[1]
if str(DESKTOP_DIR) not in sys.path:
    sys.path.insert(0, str(DESKTOP_DIR))

import machine_identity as mi  # noqa: E402

_FIXED_PARTS = {
    "machine_guid": "11111111-2222-3333-4444-555555555555",
    "hostname": "krzysztofwi",
    "windows_user": "krzysztof.wieczorek",
    "userdomain": "kubara",
    "volume_serial": "ABCD1234",
    "platform": "win32",
}


def _legacy_machine_id(p: dict) -> str:
    """Wzor sprzed zmiany (kopia 1:1) - dowod, ze produkcja sie nie zmienila."""
    material = "|".join(
        [
            p.get("machine_guid") or "noguid",
            p.get("hostname") or "nohost",
            p.get("userdomain") or "nodomain",
            p.get("windows_user") or "nouser",
            p.get("volume_serial") or "novol",
        ]
    )
    return "dam-mid-" + hashlib.sha256(material.encode("utf-8")).hexdigest()[:32]


def _env(**values: str) -> dict:
    base = {k: v for k, v in os.environ.items() if k not in ("DAM_TEST_PG", "DAM_TEST_INSTANCE")}
    base.update(values)
    return base


class MachineIdentityTestInstance(unittest.TestCase):
    def _parts(self) -> dict:
        with mock.patch.object(mi, "_win_machine_guid", return_value=_FIXED_PARTS["machine_guid"]), \
             mock.patch.object(mi, "_system_volume_serial", return_value=_FIXED_PARTS["volume_serial"]), \
             mock.patch.object(mi.socket, "gethostname", return_value=_FIXED_PARTS["hostname"]), \
             mock.patch.object(mi.getpass, "getuser", return_value=_FIXED_PARTS["windows_user"]):
            return mi.collect_raw_parts()

    def _mid(self, **env: str) -> tuple[str, dict]:
        with mock.patch.dict(os.environ, _env(USERDOMAIN="kubara", **env), clear=True):
            parts = self._parts()
            return mi.compute_machine_id(parts), parts

    def test_production_ignores_instance_without_test_pg(self):
        baseline, parts0 = self._mid()
        with_var, parts1 = self._mid(DAM_TEST_INSTANCE="A")
        self.assertNotIn("test_instance", parts0)
        self.assertNotIn("test_instance", parts1)
        self.assertEqual(baseline, with_var)
        self.assertEqual(baseline, _legacy_machine_id(parts0))

    def test_test_pg_other_than_1_is_production(self):
        baseline, _ = self._mid()
        mid, parts = self._mid(DAM_TEST_PG="true", DAM_TEST_INSTANCE="A")
        self.assertNotIn("test_instance", parts)
        self.assertEqual(baseline, mid)

    def test_test_pg_without_instance_is_production(self):
        baseline, _ = self._mid()
        mid, parts = self._mid(DAM_TEST_PG="1")
        self.assertNotIn("test_instance", parts)
        self.assertEqual(baseline, mid)

    def test_instances_get_distinct_ids(self):
        baseline, _ = self._mid()
        a, pa = self._mid(DAM_TEST_PG="1", DAM_TEST_INSTANCE="A")
        b, _ = self._mid(DAM_TEST_PG="1", DAM_TEST_INSTANCE="B")
        c, _ = self._mid(DAM_TEST_PG="1", DAM_TEST_INSTANCE="C")
        self.assertEqual(pa.get("test_instance"), "a")
        self.assertEqual(len({baseline, a, b, c}), 4)
        self.assertEqual(len({mi.device_id_for_machine(x) for x in (a, b, c)}), 3)
        # stabilne: ta sama instancja = ten sam identyfikator
        a2, _ = self._mid(DAM_TEST_PG="1", DAM_TEST_INSTANCE="a")
        self.assertEqual(a, a2)

    def test_collect_identity_reports_instance_only_in_test_mode(self):
        with mock.patch.dict(os.environ, _env(DAM_TEST_PG="1", DAM_TEST_INSTANCE="B"), clear=True):
            ident = mi.collect_identity()
        self.assertEqual(ident.get("test_instance"), "b")
        with mock.patch.dict(os.environ, _env(DAM_TEST_INSTANCE="B"), clear=True):
            ident = mi.collect_identity()
        self.assertNotIn("test_instance", ident)


if __name__ == "__main__":
    unittest.main()
