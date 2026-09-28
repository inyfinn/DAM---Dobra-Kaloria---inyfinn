# -*- coding: utf-8 -*-
"""Usterka 5 (DECYZJE.md 28.09.2026, plan etap 2) - dwa nakladajace sie
przelaczenia ROOT (X wolne, pozniejsze M szybkie) nie moga skonczyc sie
UI=M i backendem=X. Kontrakt G: `root_generation` w tym samym wpisie co
`base_path` w machine-config.json; podbijane przy KAZDYM udanym zapisie przez
ktorykolwiek z trzech szlakow (`/root/switch`, `/machine-config`,
`/user-device-paths` biezacego urzadzenia); porownaj-i-zapisz - starsze
zakonczenie zwraca `stale_request` i NIC nie zapisuje.

Run: python tests/test_repro_5_root_switch_race.py  (z bin/apps/desktop)
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parent.parent
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))
_SCRIPTS = DESKTOP.parent / "web" / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.append(str(_SCRIPTS))

import local_bridge as lb  # noqa: E402
import marketing_discovery  # noqa: E402

REQUIRED = ("-- ARCHIWUM --", "- EKSPORT", "- POLSKA")


def _make_root(parent: Path, name: str) -> Path:
    root = parent / name
    for f in REQUIRED:
        (root / f).mkdir(parents=True, exist_ok=True)
        (root / f / "produkt.txt").write_text("x", encoding="utf-8")
    return root


class RootSwitchRaceBase(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.tmp = Path(self.td.name)
        self.state_cfg = self.tmp / "state" / "machine-config.json"
        self.old_root = _make_root(self.tmp, "Old")
        self.state_cfg.parent.mkdir(parents=True, exist_ok=True)
        self.state_cfg.write_text(
            json.dumps({"users": {"racer": {"base_path": str(self.old_root), "root_generation": 1}}}),
            encoding="utf-8",
        )
        self.patches = [
            mock.patch.object(lb, "MACHINE_CONFIG", self.tmp / "machine-config-legacy.json"),
            mock.patch.object(lb, "MACHINE_CONFIG_STATE", self.state_cfg),
            mock.patch.dict(os.environ, {"USERNAME": "racer"}),
            # Klucz w pamieci procesu wlasny dla tej klasy testow - inne pliki
            # (test_root_switch.py: USERNAME="tester") nie moga zaniecz. tego licznika.
            mock.patch.dict(lb._ROOT_GENERATION_MEMORY, {}, clear=True),
            mock.patch.object(lb, "_udp_current_identity",
                              return_value={"device_id": "dev-race", "hostname": "pc-race"}),
            mock.patch.object(lb, "upsert_user_device_path", return_value={"ok": True, "entry": {}}),
            mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting"),
            mock.patch.object(lb.dam_db, "DB_CANONICAL", self.tmp / "never-real.sqlite"),
        ]
        for p in self.patches:
            p.start()
        marketing_discovery.clear_cache()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.td.cleanup()

    def cfg_entry(self) -> dict:
        data = json.loads(self.state_cfg.read_text(encoding="utf-8"))
        return data["users"]["racer"]


class OverlappingSwitchesConvergeTests(RootSwitchRaceBase):
    """Rdzen usterki 5: X wystartowal pierwszy ale odpowiada po probierzu
    (wolny dysk sieciowy), M wystartowal pozniej i odpowiada od razu -
    backend NIE MOZE zostac na X."""

    def test_slow_first_fast_second_backend_and_result_agree_on_newer(self):
        root_x = _make_root(self.tmp, "X")
        root_m = _make_root(self.tmp, "M")

        # Symuluj: X zaczyna sonde (przechwytuje generacje bazowa), CZEKA (jak
        # prawdziwy dysk sieciowy), W MIEDZYCZASIE M robi PELNE przelaczenie
        # (rowniez zaczynajac od tej samej generacji bazowej - obaj czytali
        # "aktualny" stan PRZED zadnym z dwoch zapisow), a dopiero POTEM X
        # probuje dokonczyc swoj zapis.
        real_root_state = lb._root_state

        release_x = threading.Event()
        x_probe_started = threading.Event()

        def slow_root_state(base_path, timeout=None):
            if str(base_path) == str(root_x):
                x_probe_started.set()
                release_x.wait(5)
            return real_root_state(base_path, timeout)

        results = {}

        def run_x():
            results["x"] = lb.switch_root(str(root_x), email="a@b.pl")

        with mock.patch.object(lb, "_root_state", side_effect=slow_root_state):
            tx = threading.Thread(target=run_x, name="switch-x")
            tx.start()
            self.assertTrue(x_probe_started.wait(2.0), "X powinien wejsc w sonde zanim M zacznie")

            # M startuje PO X, ale jego sonda jest natychmiastowa - konczy sie
            # (i zapisuje) zanim X zwolni swoja.
            results["m"] = lb.switch_root(str(root_m), email="a@b.pl")

            release_x.set()
            tx.join(5)

        self.assertTrue(results["m"]["ok"], results["m"])
        self.assertEqual(results["m"]["base_path"], str(root_m))

        # X musi PRZEGRAC: albo jawny stale_request, albo (gdyby harmonogram
        # watkow ulozyl sie inaczej) after all X was actually first - w kazdym
        # razie WYNIK i PLIK musza sie zgadzac - nigdy "UI=M / plik=X".
        final = self.cfg_entry()
        winner_path = results["m"]["base_path"] if results["x"].get("error") == "stale_request" else results["x"]["base_path"]
        self.assertEqual(
            final["base_path"], winner_path,
            "backend (plik machine-config) musi zgadzac sie z tym, co switch_root() faktycznie zwrocil jako wygrywajace",
        )
        # Test odtwarza DOKLADNIE scenariusz usterki: X zaczal sondowac pierwszy
        # (wolny), M zaczal i skonczyl PO NIM ale szybciej - X MUSI przegrac.
        self.assertEqual(results["x"]["error"], "stale_request", results["x"])
        self.assertEqual(final["base_path"], str(root_m), "plik na dysku musi zostac na M, nie na X")
        self.assertFalse(Path(final["base_path"]) == root_x)

    def test_stale_completion_does_not_touch_udp_or_scan_reset(self):
        """Przegrany zapis nie ma efektow ubocznych - te juz wykonal zwyciezca."""
        root_x = _make_root(self.tmp, "X2")
        root_m = _make_root(self.tmp, "M2")
        real_root_state = lb._root_state
        release_x = threading.Event()
        x_probe_started = threading.Event()

        def slow_root_state(base_path, timeout=None):
            if str(base_path) == str(root_x):
                x_probe_started.set()
                release_x.wait(5)
            return real_root_state(base_path, timeout)

        with mock.patch.object(lb, "_root_state", side_effect=slow_root_state), \
                mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}) as reset_mem:
            results = {}

            def run_x():
                results["x"] = lb.switch_root(str(root_x), email="a@b.pl", device_id="dev-x")

            tx = threading.Thread(target=run_x)
            tx.start()
            self.assertTrue(x_probe_started.wait(2.0))
            results["m"] = lb.switch_root(str(root_m), email="a@b.pl", device_id="dev-m")
            release_x.set()
            tx.join(5)

        self.assertEqual(results["x"]["error"], "stale_request")
        # reset_scan_memory: dokladnie RAZ (dla M, zwyciezcy) - stale X go NIE wola.
        self.assertEqual(reset_mem.call_count, 1, reset_mem.call_args_list)
        lb.upsert_user_device_path.assert_called_once_with(
            "a@b.pl", "dev-m", str(root_m), hostname="pc-race", label=None
        )


class GenerationCasTests(RootSwitchRaceBase):
    """write_machine_config(expected_generation=...) - porownaj-i-zapisz."""

    def test_write_bumps_generation_each_success(self):
        root_a = _make_root(self.tmp, "A")
        root_b = _make_root(self.tmp, "B")
        with mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}):
            r1 = lb.switch_root(str(root_a), email="a@b.pl")
            r2 = lb.switch_root(str(root_b), email="a@b.pl")
        self.assertTrue(r1["ok"] and r2["ok"], (r1, r2))
        self.assertIsInstance(r1["root_generation"], int)
        self.assertEqual(r2["root_generation"], r1["root_generation"] + 1)
        self.assertEqual(self.cfg_entry()["root_generation"], r2["root_generation"])

    def test_stale_write_rejected_and_leaves_file_untouched(self):
        root_a = _make_root(self.tmp, "A3")
        current = lb._root_generation_baseline("racer")
        # Zapis "z przyszlosci" (od razu podbija plik) - potem proba zapisu z
        # PRZESTARZALA generacja (current, teraz juz nieaktualna) musi przegrac.
        with mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}):
            ok_write = lb.write_machine_config(str(root_a))
        self.assertTrue(ok_write["ok"])
        before = json.loads(self.state_cfg.read_text(encoding="utf-8"))

        stale = lb.write_machine_config(str(self.tmp / "Nieuzywany"), expected_generation=current)
        self.assertFalse(stale["ok"])
        self.assertEqual(stale["error"], "stale_request")
        self.assertEqual(stale["root_generation"], ok_write["root_generation"])
        after = json.loads(self.state_cfg.read_text(encoding="utf-8"))
        self.assertEqual(before, after, "odrzucony zapis nie moze zmienic pliku")

    def test_memory_protects_against_legacy_overwrite_resetting_field(self):
        """DECYZJE.md 7.8: stara wersja aplikacji moze przepisac caly plik bez
        pola root_generation (wraca do 0 na dysku) - pamiec procesu nie moze
        pozwolic cofnac licznika i oszukac CAS kolejnego zapisu."""
        root_a = _make_root(self.tmp, "A4")
        with mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}):
            first = lb.write_machine_config(str(root_a))
        self.assertGreaterEqual(first["root_generation"], 2)

        # "Stara wersja" nadpisuje caly plik bez root_generation.
        self.state_cfg.write_text(
            json.dumps({"users": {"racer": {"base_path": str(root_a)}}}), encoding="utf-8"
        )
        self.assertEqual(lb._entry_generation(lb._read_machine_config_file(self.state_cfg)), 0)

        with mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}):
            second = lb.write_machine_config(str(root_a))
        self.assertGreater(
            second["root_generation"], first["root_generation"],
            "pamiec procesu musi utrzymac licznik rosnacy mimo cofniecia w pliku",
        )


class ThreeWritePathsResetConsistentlyTests(RootSwitchRaceBase):
    """DECYZJE.md 7 (uwagi prowadzacego): wszystkie TRZY drogi zapisu ROOT
    (/root/switch, /machine-config, /user-device-paths biezacego urzadzenia)
    musza resetowac pamiec skanu i restartowac watcher SPOJNIE - przed
    naprawa `/machine-config` tylko pisal plik."""

    def test_machine_config_http_path_resets_scan_memory_and_restarts_watcher(self):
        import http.client
        from http.server import ThreadingHTTPServer

        new_root = _make_root(self.tmp, "ViaMachineConfig")
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), lb.Handler)
        port = httpd.server_address[1]
        t = threading.Thread(target=httpd.serve_forever, daemon=True)
        t.start()
        try:
            with mock.patch.object(lb.Handler, "_session_user",
                                    return_value={"email": "a@b.pl", "role": "user"}), \
                    mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}) as reset_mem, \
                    mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting") as rw:
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
                conn.request(
                    "POST", "/machine-config",
                    body=json.dumps({"base_path": str(new_root)}),
                    headers={"Content-Type": "application/json", "Origin": "http://127.0.0.1:8765"},
                )
                r = conn.getresponse()
                data = json.loads(r.read().decode("utf-8"))
                conn.close()
        finally:
            httpd.shutdown()
            httpd.server_close()

        self.assertEqual(r.status, 200, data)
        self.assertTrue(data["ok"], data)
        self.assertEqual(self.cfg_entry()["base_path"], str(new_root))
        # To jest DOKLADNIE naprawa usterki: kiedys /machine-config nie wolal
        # ani jednego, ani drugiego.
        reset_mem.assert_called_once()
        rw.assert_called_once_with(scan_allowed=True)
        self.assertTrue(data.get("changed"))
        self.assertIn("root_generation", data)

    def test_user_device_paths_current_device_resets_scan_memory_and_restarts_watcher(self):
        import http.client
        from http.server import ThreadingHTTPServer

        new_root = _make_root(self.tmp, "ViaUdp")
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), lb.Handler)
        port = httpd.server_address[1]
        t = threading.Thread(target=httpd.serve_forever, daemon=True)
        t.start()
        try:
            with mock.patch.object(lb.Handler, "_session_user",
                                    return_value={"email": "a@b.pl", "role": "user"}), \
                    mock.patch.object(lb, "_reset_scan_memory", return_value={"ok": True}) as reset_mem, \
                    mock.patch.object(lb, "_restart_index_watcher_for_root", return_value="restarting") as rw:
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
                conn.request(
                    "POST", "/user-device-paths",
                    body=json.dumps({
                        "action": "upsert", "device_id": "dev-race", "hostname": "pc-race",
                        "base_path": str(new_root),
                    }),
                    headers={"Content-Type": "application/json", "Origin": "http://127.0.0.1:8765"},
                )
                r = conn.getresponse()
                data = json.loads(r.read().decode("utf-8"))
                conn.close()
        finally:
            httpd.shutdown()
            httpd.server_close()

        self.assertEqual(r.status, 200, data)
        self.assertTrue(data["ok"], data)
        self.assertEqual(self.cfg_entry()["base_path"], str(new_root))
        reset_mem.assert_called_once()
        rw.assert_called_once_with(scan_allowed=True)


class FileAvailabilityGenerationCacheKeyTests(RootSwitchRaceBase):
    """Kontrakt G: klucz cache dostepnosci zawiera generacje ROOT."""

    def test_cache_key_changes_with_generation(self):
        try:
            import dam_file_availability
        except ImportError:
            self.skipTest("dam_file_availability niedostepny")
        k0 = dam_file_availability._sha_key(r"X:\Marketing\a.png", 0)
        k1 = dam_file_availability._sha_key(r"X:\Marketing\a.png", 1)
        self.assertNotEqual(k0, k1, "ta sama sciezka, inna generacja -> inny klucz cache")
        self.assertEqual(
            dam_file_availability._sha_key(r"X:\Marketing\a.png", 1),
            dam_file_availability._sha_key(r"X:\Marketing\a.png", 1),
            "ten sam wsad -> ten sam klucz (deterministyczny)",
        )

    def test_missing_label_when_root_set_is_the_contract_label(self):
        try:
            import dam_file_availability
        except ImportError:
            self.skipTest("dam_file_availability niedostepny")
        out = dam_file_availability.classify_path(
            str(self.tmp / "nie-istnieje.png"),
            resolve_physical=lambda p, e="": p,
            has_marketing_root=True,
        )
        self.assertEqual(out["state"], "missing")
        self.assertEqual(out["label_pl"], "Oryginał jeszcze niedostępny na tym komputerze")


if __name__ == "__main__":
    unittest.main()
