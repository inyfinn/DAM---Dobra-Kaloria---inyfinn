# -*- coding: utf-8 -*-
"""Kontrakt _remap_revision_live_paths BEZ zaleznosci od liter dyskow.

Po co ten test istnieje:
test_resolve_media_path.py::test_remap_revision_live_paths_fills_elements
sprawdza to samo, ale na ZYWYM dysku X: - na maszynie bez X: robi skipTest,
czyli nie daje zadnego dowodu. Ten plik buduje sztuczne drzewo w katalogu
tymczasowym i podmienia dam_path_resolve.resolve_physical_path na atrape,
wiec wykonuje sie na KAZDEJ maszynie (praca: M:/D:, dom: X:, CI: bez dyskow).

Objaw, przed ktorym chroni:
indeks zapisuje litere dysku maszyny, ktora go zbudowal. Na innej maszynie
rev["path"] nie istnieje, picker ELEMENTY dostawal path_not_found i pokazywal
pusta liste plikow rewizji. Funkcja ma przepisac sciezke na zywa litere i
uzupelnic files_by_role["elements"], nie rzucajac wyjatkiem i nie kasujac
danych, gdy czegos brakuje.
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import local_bridge as lb  # noqa: E402


class _FakeResolver:
    """Atrapa dam_path_resolve: mapa 'sciezka z indeksu' -> 'sciezka zywa'.

    Nieznana sciezka wraca bez zmian - tak samo zachowuje sie prawdziwy
    resolve_physical_path, gdy nie znajdzie zywego odpowiednika.
    """

    def __init__(self, mapping: dict[str, str]) -> None:
        self.mapping = mapping
        self.calls: list[str] = []

    def resolve_physical_path(self, path: str, *_a, **_k) -> str:
        self.calls.append(path)
        key = str(path).replace("/", "\\")
        return self.mapping.get(key, str(path))


class RemapRevisionLivePathsTests(unittest.TestCase):
    def setUp(self) -> None:
        self._td = tempfile.TemporaryDirectory()
        self.root = Path(self._td.name)

        # "indeksowana" rewizja - katalog, ktory NIE istnieje na tej maszynie
        self.indexed_rev = self.root / "INDEKS" / "PRODUKT" / "KAR6X - 6300783.00 - F"

        # "zywa" rewizja - istnieje, z polskim znakiem w nazwie slotu
        self.live_rev = self.root / "ZYWY" / "PRODUKT" / "KAR6X - 6300783.00 - F"
        self.elementy = self.live_rev / "1 - MATERIAŁY" / "ELEMENTY"
        self.elementy.mkdir(parents=True)
        (self.elementy / "CYNAMONKA_front.png").write_bytes(b"\x89PNG\r\n")
        (self.elementy / "notatka.txt").write_text("nie obrazek", encoding="utf-8")

        self.fake = _FakeResolver({str(self.indexed_rev): str(self.live_rev)})
        self._orig_dpr = lb.dam_path_resolve
        self._orig_under = lb._is_under_marketing
        lb.dam_path_resolve = self.fake  # type: ignore[assignment]
        lb._is_under_marketing = lambda _p: True  # type: ignore[assignment]

    def tearDown(self) -> None:
        lb.dam_path_resolve = self._orig_dpr  # type: ignore[assignment]
        lb._is_under_marketing = self._orig_under  # type: ignore[assignment]
        self._td.cleanup()

    @staticmethod
    def _slash(p) -> str:
        return str(p).replace("\\", "/")

    def test_rebases_path_and_fills_elements(self) -> None:
        rev = {"path": str(self.indexed_rev), "files_by_role": {"elements": []}}
        self.assertIsNone(lb._remap_revision_live_paths(rev))  # mutuje w miejscu
        self.assertEqual(rev["path"], self._slash(self.live_rev))
        els = rev["files_by_role"]["elements"]
        self.assertTrue(els)
        self.assertIn("ELEMENTY", str(els[0].get("path") or "").upper())
        names = {f.get("name") for f in els}
        self.assertIn("CYNAMONKA_front.png", names)
        # listing filtruje po rozszerzeniach obrazow - .txt nie moze wejsc
        self.assertNotIn("notatka.txt", names)

    def test_idempotent(self) -> None:
        rev = {"path": str(self.indexed_rev), "files_by_role": {"elements": []}}
        lb._remap_revision_live_paths(rev)
        first = {"path": rev["path"], "els": list(rev["files_by_role"]["elements"])}
        lb._remap_revision_live_paths(rev)
        self.assertEqual(rev["path"], first["path"])
        self.assertEqual(rev["files_by_role"]["elements"], first["els"])

    def test_path_already_live_stays_unchanged(self) -> None:
        rev = {"path": str(self.live_rev), "files_by_role": {"elements": []}}
        lb._remap_revision_live_paths(rev)
        self.assertEqual(rev["path"], self._slash(self.live_rev))
        self.assertTrue(rev["files_by_role"]["elements"])

    def test_missing_elementy_dir_keeps_rev_intact(self) -> None:
        bare = self.root / "ZYWY" / "PRODUKT" / "REWIZJA-BEZ-MATERIALOW"
        bare.mkdir(parents=True)
        self.fake.mapping[str(self.indexed_rev)] = str(bare)
        rev = {
            "path": str(self.indexed_rev),
            "files_by_role": {"elements": [{"name": "stary.png", "path": "X:/stary.png"}]},
        }
        lb._remap_revision_live_paths(rev)
        self.assertEqual(rev["path"], self._slash(bare))
        # stare dane zostaja - lepiej stare niz wyczyszczone
        self.assertEqual(rev["files_by_role"]["elements"][0]["name"], "stary.png")

    def test_empty_elementy_dir_keeps_previous_elements(self) -> None:
        empty_rev = self.root / "ZYWY" / "PUSTA"
        (empty_rev / "1 - MATERIAŁY" / "ELEMENTY").mkdir(parents=True)
        self.fake.mapping[str(self.indexed_rev)] = str(empty_rev)
        rev = {
            "path": str(self.indexed_rev),
            "files_by_role": {"elements": [{"name": "stary.png"}]},
        }
        lb._remap_revision_live_paths(rev)
        self.assertEqual(rev["files_by_role"]["elements"], [{"name": "stary.png"}])

    def test_target_dir_does_not_exist_after_rebase(self) -> None:
        ghost = self.root / "NIE-MA-TEGO"
        self.fake.mapping[str(self.indexed_rev)] = str(ghost)
        rev = {"path": str(self.indexed_rev), "files_by_role": {"elements": []}}
        lb._remap_revision_live_paths(rev)
        self.assertEqual(rev["path"], self._slash(ghost))
        self.assertEqual(rev["files_by_role"]["elements"], [])

    def test_rev_without_path(self) -> None:
        rev = {"files_by_role": {"elements": []}}
        lb._remap_revision_live_paths(rev)
        self.assertEqual(rev, {"files_by_role": {"elements": []}})
        self.assertEqual(self.fake.calls, [])

    def test_rev_with_empty_path(self) -> None:
        rev = {"path": "  ", "files_by_role": {"elements": []}}
        lb._remap_revision_live_paths(rev)
        self.assertEqual(rev["path"], "  ")

    def test_rev_without_files_by_role_gets_one(self) -> None:
        rev = {"path": str(self.indexed_rev)}
        lb._remap_revision_live_paths(rev)
        self.assertTrue(rev.get("files_by_role", {}).get("elements"))

    def test_files_by_role_not_a_dict_is_replaced(self) -> None:
        rev = {"path": str(self.indexed_rev), "files_by_role": "smiec"}
        lb._remap_revision_live_paths(rev)
        self.assertIsInstance(rev["files_by_role"], dict)
        self.assertTrue(rev["files_by_role"]["elements"])

    def test_non_dict_input_does_not_raise(self) -> None:
        for junk in (None, "abc", 7, ["a"]):
            lb._remap_revision_live_paths(junk)  # type: ignore[arg-type]

    def test_resolver_exception_does_not_propagate(self) -> None:
        class Boom:
            @staticmethod
            def resolve_physical_path(*_a, **_k):
                raise RuntimeError("resolver padl")

        lb.dam_path_resolve = Boom()  # type: ignore[assignment]
        rev = {"path": str(self.indexed_rev), "files_by_role": {"elements": []}}
        lb._remap_revision_live_paths(rev)
        self.assertEqual(rev["files_by_role"]["elements"], [])


if __name__ == "__main__":
    unittest.main()
