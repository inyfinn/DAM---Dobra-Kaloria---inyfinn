# -*- coding: utf-8 -*-
"""Sentinel "--run" dla zamrozonej .app: Windows bez zmian, macOS bez odpalania GUI.

Po co ten test istnieje:
w zamrozonej aplikacji sys.executable to BINARKA APLIKACJI, nie interpreter
Pythona. Kazdy spawn [sys.executable, skrypt] uruchamial wiec na macOS CALE GUI
od nowa z ignorowanym argumentem (most nie wstawal, procesy sie mnozyly).
Most idzie teraz przez sentinel shima: [exe, "--run", <cel z bialej listy>, ...].

To jedyny dowod, jaki mamy BEZ Maca, wiec pilnuje trzech rzeczy naraz:
1. tryb NIEZAMROZONY (Windows + uruchomienie ze zrodel) daje polecenie
   IDENTYCZNE co do znaku z tym sprzed zmiany - to jest nienaruszalne,
2. tryb zamrozony daje sentinel z celem z bialej listy i zachowanymi
   argumentami skryptu w poprawnej kolejnosci,
3. rozluznienie bramki bezpieczenstwa (cel liczony od korzenia bin payloadu,
   a nie od bin/apps/desktop) NIE otwiera wykonania dowolnego pliku .py.

Objaw, przed ktorym chroni: albo martwy most i mnozace sie procesy na macOS,
albo - po niechlujnej poprawce - zmiana zachowania na Windows (np. podmiana
python.exe na pythonw.exe zabralaby stdout przekierowany do logu indeksu)
lub skrypt odpalony z cudzymi argumentami, bo argparse dostal ["--run", ...].
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import dam_mac_shim as shim  # noqa: E402
import local_bridge as lb  # noqa: E402


class _Frozen:
    """Udaje zamrozona aplikacje: sys.frozen + sys.executable = binarka .app."""

    EXE = "/Applications/DAM.app/Contents/MacOS/DAM"

    def __enter__(self):
        self._had = hasattr(sys, "frozen")
        self._old = getattr(sys, "frozen", None)
        self._exe = sys.executable
        sys.frozen = True  # type: ignore[attr-defined]
        sys.executable = self.EXE
        return self

    def __exit__(self, *_exc):
        sys.executable = self._exe
        if self._had:
            sys.frozen = self._old  # type: ignore[attr-defined]
        else:
            del sys.frozen  # type: ignore[attr-defined]
        return False


# (nazwa celu, stala ze sciezka skryptu, flagi interpretera, argumenty skryptu)
SPAWNS = (
    ("index", lb.BUILD_INDEX, ("-u",), ()),
    ("project-costs", lb.BUILD_PROJECT_COSTS, (), ()),
    ("product-prices", lb.FETCH_PRODUCT_PRICES, (), ("--product-id", "6300783")),
    ("branding-recognize", lb.ENRICH_BRANDING_RECOGNIZE, (), ()),
    ("wykrojniki-import", lb.IMPORT_WYKROJNIKI, (), ()),
    ("wykrojniki-link", lb.LINK_WYKROJNIKI, (), ()),
    (
        "db-backup-sync",
        DESKTOP / "scripts" / "sync-database-backups-to-git.py",
        (),
        ("--from-bridge", "--skip-pull", "--no-commit", "--quiet"),
    ),
)


class NotFrozenIsByteIdenticalTests(unittest.TestCase):
    """Windows i tryb zrodlowy: polecenie MUSI byc takie samo jak przed zmiana."""

    def test_all_seven_spawns_unchanged(self) -> None:
        self.assertFalse(lb._frozen_app(), "test ma sens tylko w trybie niezamrozonym")
        # Prawa strona to DOSLOWNIE listy sprzed zmiany (local_bridge.py:1541,
        # 4146, 9187, 9796, 9882, 9907, 11030 w wersji z commitu f081276e).
        expected = [
            [sys.executable, "-u", str(lb.BUILD_INDEX)],
            [sys.executable, str(lb.BUILD_PROJECT_COSTS)],
            [sys.executable, str(lb.FETCH_PRODUCT_PRICES), "--product-id", "6300783"],
            [sys.executable, str(lb.ENRICH_BRANDING_RECOGNIZE)],
            [sys.executable, str(lb.IMPORT_WYKROJNIKI)],
            [sys.executable, str(lb.LINK_WYKROJNIKI)],
            [
                sys.executable,
                str(DESKTOP / "scripts" / "sync-database-backups-to-git.py"),
                "--from-bridge",
                "--skip-pull",
                "--no-commit",
                "--quiet",
            ],
        ]
        for (name, script, flags, args), want in zip(SPAWNS, expected):
            with self.subTest(cel=name):
                got = lb._payload_script_cmd(script, name, *args, python_flags=flags)
                self.assertEqual(got, want)

    def test_interpreter_is_not_swapped_for_pythonw(self) -> None:
        # bridge_supervisor podmienia python.exe na pythonw.exe; TU tego nie wolno,
        # bo przebudowa indeksu pisze stdout do pliku logu.
        cmd = lb._payload_script_cmd(lb.BUILD_INDEX, "index", python_flags=("-u",))
        self.assertEqual(cmd[0], sys.executable)
        self.assertNotIn("pythonw", Path(cmd[0]).name.lower())


class FrozenUsesSentinelTests(unittest.TestCase):
    def test_all_seven_go_through_sentinel_with_args(self) -> None:
        with _Frozen() as fr:
            self.assertTrue(lb._frozen_app())
            for name, script, flags, args in SPAWNS:
                with self.subTest(cel=name):
                    cmd = lb._payload_script_cmd(script, name, *args, python_flags=flags)
                    self.assertEqual(cmd[:3], [fr.EXE, "--run", name])
                    # Argumenty skryptu w ORYGINALNEJ kolejnosci, nic nie zgubione.
                    self.assertEqual(cmd[3:], list(args))
                    # Zadna sciezka skryptu nie moze zostac w poleceniu - shim
                    # przyjmuje wylacznie nazwe z bialej listy.
                    self.assertNotIn(str(script), cmd)
                    # Flagi interpretera nie maja do kogo trafic w .app.
                    for flag in flags:
                        self.assertNotIn(flag, cmd)

    def test_product_id_pair_stays_together(self) -> None:
        with _Frozen():
            cmd = lb._payload_script_cmd(
                lb.FETCH_PRODUCT_PRICES, "product-prices", "--product-id", "6300783"
            )
            self.assertEqual(cmd[-2:], ["--product-id", "6300783"])

    def test_every_spawn_name_is_whitelisted(self) -> None:
        for name, _script, _f, _a in SPAWNS:
            self.assertIn(name, shim.RUNNABLE, f"brak celu {name!r} w RUNNABLE")

    def test_whitelist_points_at_the_same_files(self) -> None:
        """Nazwa celu musi wskazywac DOKLADNIE ten skrypt, ktory most odpala."""
        bin_root = shim._payload_bin_root(DESKTOP)
        for name, script, _f, _a in SPAWNS:
            with self.subTest(cel=name):
                target = (bin_root / shim.RUNNABLE[name]).resolve()
                self.assertEqual(target, Path(script).resolve())
                self.assertTrue(target.is_file(), target)

    def test_bridge_entry_still_resolves(self) -> None:
        import bridge_supervisor

        bin_root = shim._payload_bin_root(DESKTOP)
        target = (bin_root / shim.RUNNABLE["bridge"]).resolve()
        self.assertEqual(target, bridge_supervisor.LOCAL_BRIDGE.resolve())

    def test_bridge_supervisor_command_unchanged_when_not_frozen(self) -> None:
        import bridge_supervisor

        cmd = bridge_supervisor.payload_script_cmd(bridge_supervisor.LOCAL_BRIDGE, run_name="bridge")
        self.assertEqual(cmd[-1], str(bridge_supervisor.LOCAL_BRIDGE))
        self.assertEqual(len(cmd), 2)


class ShimRunGuardTests(unittest.TestCase):
    """Sztuczny payload: <tmp>/bin/apps/... - shim nie dotyka prawdziwego drzewa."""

    def setUp(self) -> None:
        self._td = tempfile.TemporaryDirectory()
        root = Path(self._td.name)
        self.bin_root = root / "bin"
        self.desktop = self.bin_root / "apps" / "desktop"
        self.desktop.mkdir(parents=True)
        (self.bin_root / "apps" / "web" / "scripts").mkdir(parents=True)
        (self.desktop / "scripts").mkdir()
        self.argv_out = root / "argv.json"
        self.marker = root / "evil-ran.txt"

        probe = (
            "import json, os, sys\n"
            "with open(os.environ['DAM_TEST_ARGV_OUT'], 'w', encoding='utf-8') as fh:\n"
            "    fh.write(json.dumps(sys.argv))\n"
        )
        for rel in shim.RUNNABLE.values():
            p = self.bin_root / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(probe, encoding="utf-8")

        # Plik POZA payloadem - nie wolno go uruchomic zadna sciezka.
        self.evil = root.parent / ("evil_%s.py" % root.name)
        self.evil.write_text(
            "import os\nopen(os.environ['DAM_TEST_MARKER'], 'w').write('ran')\n",
            encoding="utf-8",
        )
        os.environ["DAM_TEST_ARGV_OUT"] = str(self.argv_out)
        os.environ["DAM_TEST_MARKER"] = str(self.marker)
        self._argv = list(sys.argv)

    def tearDown(self) -> None:
        sys.argv = self._argv
        os.environ.pop("DAM_TEST_ARGV_OUT", None)
        os.environ.pop("DAM_TEST_MARKER", None)
        try:
            self.evil.unlink()
        except OSError:
            pass
        self._td.cleanup()

    def _argv_seen(self) -> list:
        return json.loads(self.argv_out.read_text(encoding="utf-8"))

    def test_script_sees_its_own_argv(self) -> None:
        for name, _script, _f, args in SPAWNS:
            with self.subTest(cel=name):
                rc = shim._run_payload_script(self.desktop, name, list(args))
                self.assertEqual(rc, 0)
                seen = self._argv_seen()
                self.assertEqual(
                    seen[0], str((self.bin_root / shim.RUNNABLE[name]).resolve())
                )
                self.assertEqual(seen[1:], list(args))
                self.assertNotIn("--run", seen)

    def test_sys_argv_is_restored_after_run(self) -> None:
        before = list(sys.argv)
        shim._run_payload_script(self.desktop, "product-prices", ["--product-id", "1"])
        self.assertEqual(sys.argv, before)

    def test_unknown_target_returns_2(self) -> None:
        rc = shim._run_payload_script(self.desktop, "nie-ma-takiego-celu", [])
        self.assertEqual(rc, 2)
        self.assertFalse(self.marker.exists())

    def test_relative_escape_is_rejected(self) -> None:
        rel = os.path.relpath(self.evil, self.bin_root)  # ..\..\evil_xxx.py
        self.assertTrue(rel.startswith(".."), rel)
        with mock.patch.dict(shim.RUNNABLE, {"zlo": rel}, clear=False):
            rc = shim._run_payload_script(self.desktop, "zlo", [])
        self.assertEqual(rc, 2)
        self.assertFalse(self.marker.exists(), "plik spoza payloadu ZOSTAL uruchomiony")

    def test_absolute_path_is_rejected(self) -> None:
        with mock.patch.dict(shim.RUNNABLE, {"zlo": str(self.evil)}, clear=False):
            rc = shim._run_payload_script(self.desktop, "zlo", [])
        self.assertEqual(rc, 2)
        self.assertFalse(self.marker.exists(), "plik spoza payloadu ZOSTAL uruchomiony")

    def test_sibling_prefix_dir_is_rejected(self) -> None:
        """'bin-kopia' zaczyna sie tak samo jak 'bin' - stary startswith by to przepuscil."""
        twin = self.bin_root.parent / (self.bin_root.name + "-kopia")
        (twin / "apps").mkdir(parents=True)
        (twin / "apps" / "x.py").write_text(
            "import os\nopen(os.environ['DAM_TEST_MARKER'], 'w').write('ran')\n",
            encoding="utf-8",
        )
        with mock.patch.dict(shim.RUNNABLE, {"zlo": "../bin-kopia/apps/x.py"}, clear=False):
            rc = shim._run_payload_script(self.desktop, "zlo", [])
        self.assertEqual(rc, 2)
        self.assertFalse(self.marker.exists())

    def test_non_py_target_is_rejected(self) -> None:
        (self.desktop / "evil.sh").write_text("echo hi", encoding="utf-8")
        with mock.patch.dict(shim.RUNNABLE, {"zlo": "apps/desktop/evil.sh"}, clear=False):
            rc = shim._run_payload_script(self.desktop, "zlo", [])
        self.assertEqual(rc, 2)

    def test_missing_file_returns_2(self) -> None:
        with mock.patch.dict(shim.RUNNABLE, {"zlo": "apps/desktop/nie_ma.py"}, clear=False):
            rc = shim._run_payload_script(self.desktop, "zlo", [])
        self.assertEqual(rc, 2)


class ShimMainGateTests(unittest.TestCase):
    """Bramka anty-rekurencyjna: nieznany argument NIGDY nie wraca cicho do GUI."""

    def setUp(self) -> None:
        self._td = tempfile.TemporaryDirectory()
        self.root = Path(self._td.name)
        (self.root / "bin" / "apps" / "desktop").mkdir(parents=True)
        self._argv = list(sys.argv)
        self._env = os.environ.get("DAM_GIT_ROOT")
        self._path = list(sys.path)

    def tearDown(self) -> None:
        sys.argv = self._argv
        sys.path[:] = self._path
        if self._env is None:
            os.environ.pop("DAM_GIT_ROOT", None)
        else:
            os.environ["DAM_GIT_ROOT"] = self._env
        self._td.cleanup()

    def _main(self, *args: str) -> int:
        sys.argv = ["DAM", *args]
        with mock.patch.object(shim, "_payload_root", return_value=self.root):
            return shim.main()

    def test_unknown_run_target_exits_2(self) -> None:
        self.assertEqual(self._main("--run", "nie-ma-takiego-celu"), 2)

    def test_run_without_target_exits_2(self) -> None:
        self.assertEqual(self._main("--run"), 2)

    def test_unknown_argument_exits_2(self) -> None:
        self.assertEqual(self._main("--cokolwiek"), 2)

    def test_run_forwards_trailing_args(self) -> None:
        with mock.patch.object(shim, "_run_payload_script", return_value=0) as spy:
            self._main("--run", "product-prices", "--product-id", "6300783")
        _desktop, name, passed = spy.call_args[0]
        self.assertEqual(name, "product-prices")
        self.assertEqual(passed, ["--product-id", "6300783"])


if __name__ == "__main__":
    unittest.main()
