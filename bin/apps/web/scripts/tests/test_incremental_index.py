# -*- coding: utf-8 -*-
"""06.10.2026: tryb przyrostowy build-file-index.py (--only-product + --merge-into).

Zmiana w JEDNYM folderze produktu ma przebudowac tylko ten produkt i wlac wynik do
istniejacego file-index.json / search-index.json (a nie skanowac cale ROOT: 26-54 min na M:).

Testy dzialaja w procesie (main(argv)), na malej fixturze w work/2026-10-06/W-indeks/fixture
(3 produkty + archiwum kategorii), bez sieci i bez procesow potomnych.
UWAGA: fixture lezy pod D:\\Marketing\\..., wiec build z --root wywiedzialby marketing_root =
D:\\Marketing\\- POLSKA i przeszedl rglob po calym udziale. Dlatego collect_marketing_folders
jest tu zawsze podstawiony atrapa (assert w setUp).
"""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
import shutil
import sys
import time
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
BUILD = Path(os.environ.get("DAM_TEST_BUILDER") or (SCRIPTS / "build-file-index.py"))  # env: tylko do testow mutacyjnych
REPO = Path(__file__).resolve().parents[5]
FIXTURE_BASE = REPO / "work" / "2026-10-06" / "W-indeks" / "fixture" / "incremental"


def _load_builder():
    spec = importlib.util.spec_from_file_location("dam_build_file_index_incr", BUILD)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {BUILD}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


CAT1 = "01 - BATONY"
CAT2 = "02 - KULKI"
ARCH = "\u2014 ARCHIWUM"
PROD_A = "ALFA - [ daktylowy ]"
PROD_B = "BETA - [ daktylowy ]"
PROD_C = "GAMMA - [ kulki ]"
ARCH_A = "ALFA - [ daktylowy ] - X"  # wariant archiwalny PROD_A (laczy sie z zywym produktem)
ARCH_Z = "ZETA - [ daktylowy ] - X"  # tylko archiwum (brak zywego produktu)


def _write(path: Path, data: bytes = b"x", mtime: float = 1_780_000_000.0) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    os.utime(path, (mtime, mtime))


def _variant(prod_dir: Path, label: str, index: str, extra_viz: str | None = None) -> None:
    var = prod_dir / f"DOY - {label} 100 g - 01.03.2026 - {index}.00"
    _write(var / "2 - PROJEKT" / f"DK-DOY-{label} - 2026_03_01.pdf")
    _write(var / "4 - WIZKI" / f"DOYPACK - {label} - 1200x1200 - {index} - 2026_03_01 - FRONT-S.png")
    if extra_viz:
        _write(var / "4 - WIZKI" / extra_viz, mtime=1_780_000_100.0)


def build_fixture(root: Path) -> None:
    """Idempotentnie (nadpisuje te same pliki z ustalonym mtime)."""
    _variant(root / CAT1 / PROD_A, "ALFA", "6300901")
    _variant(root / CAT1 / PROD_B, "BETA", "6300902")
    _variant(root / CAT2 / PROD_C, "GAMMA", "6300903")
    _variant(root / CAT1 / ARCH / ARCH_A, "ALFA", "6300901")
    # inny rewizja w archiwum, zeby merge_category_archive cos dolaczyl
    var = root / CAT1 / ARCH / ARCH_A / "DOY - ALFA 100 g - 01.01.2025 - 6300901.00"
    _write(var / "4 - WIZKI" / "DOYPACK - ALFA - 1200x1200 - 6300901 - 2025_01_01 - FRONT-S.png")
    _variant(root / CAT1 / ARCH / ARCH_Z, "ZETA", "6300904")


def _park(path: Path) -> None:
    """Odloz katalog poza ROOT fixtury (bez kasowania; unikalna nazwa przy kolizji)."""
    parked = FIXTURE_BASE / "_parked"
    parked.mkdir(parents=True, exist_ok=True)
    dest = parked / path.name
    if dest.exists():
        dest = parked / f"{path.name}-{time.time_ns()}"
    os.replace(path, dest)


def heal_fixture(root: Path) -> None:
    """Po tescie/przerwanym tescie: cofnij przemianowania i przeniesienia, usun pliki _tmp_*."""
    renamed = root / CAT1 / (PROD_B + " - F")
    if renamed.is_dir() and not (root / CAT1 / PROD_B).exists():
        os.replace(renamed, root / CAT1 / PROD_B)
    parked_c = FIXTURE_BASE / "_parked" / PROD_C
    if parked_c.is_dir() and not (root / CAT2 / PROD_C).exists():
        os.replace(parked_c, root / CAT2 / PROD_C)
    parked_a = FIXTURE_BASE / "_parked" / PROD_A
    if parked_a.is_dir() and not (root / CAT1 / PROD_A).exists():
        os.replace(parked_a, root / CAT1 / PROD_A)
    delta = root / CAT2 / "DELTA - [ kulki ]"
    if delta.is_dir():
        _park(delta)
    for f in list(root.rglob("_tmp_*")):
        if f.is_file():
            f.unlink()


def canonical(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    data.pop("generated_at", None)
    data.pop("elapsed_sec", None)
    return data


class IncrementalIndexTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.mod = _load_builder()
        cls.root = FIXTURE_BASE / "DK"
        FIXTURE_BASE.mkdir(parents=True, exist_ok=True)
        (FIXTURE_BASE / "_parked").mkdir(exist_ok=True)

    def setUp(self) -> None:
        heal_fixture(self.root)
        build_fixture(self.root)
        mod = self.mod
        # hermetycznosc: zadnych danych z prawdziwego apps/web/data poza slownikiem nazw
        (FIXTURE_BASE / "none").mkdir(exist_ok=True)
        none = FIXTURE_BASE / "none"
        mod.PRODUCT_ALIASES_PATH = none / "aliases.json"
        mod.LANG_OVERRIDES_PATH = none / "lang.json"
        mod.PRODUCT_CATALOG_PATH = none / "catalog.json"
        mod.BULK_PACKAGING_PATH = none / "bulk.json"
        mod._LIVE_PATH = FIXTURE_BASE / "index-live.json"
        # NIGDY rglob po D:\Marketing\- POLSKA (patrz docstring)
        self.marketing_walks = 0

        def _no_walk(marketing_root):
            self.marketing_walks += 1
            return []

        mod.collect_marketing_folders = _no_walk
        self.scanned: list[str] = []
        real_scan_product = mod.scan_product

        def _counting_scan_product(cat_name, product_dir, root, brand):
            self.scanned.append(str(product_dir).replace("\\", "/"))
            return real_scan_product(cat_name, product_dir, root, brand)

        mod.scan_product = _counting_scan_product
        self._real_scan_product = real_scan_product

    def tearDown(self) -> None:
        self.mod.scan_product = self._real_scan_product
        heal_fixture(self.root)

    # ---- pomocnicze -------------------------------------------------
    def _run(self, *argv: str) -> int:
        buf = io.StringIO()
        err = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(err):
                self.mod.main(list(argv))
        except SystemExit as exc:
            code = exc.code
            return 0 if code in (None, 0) else int(code)
        return 0

    def _full(self, out: Path) -> None:
        rc = self._run("--root", str(self.root), "--brand", "DK", "--out-dir", str(out))
        self.assertEqual(rc, 0)

    def _seed(self, name: str) -> tuple[Path, Path]:
        """Pelny build -> out_base, kopia do out_inc (baza do merge)."""
        base = FIXTURE_BASE / f"{name}-base"
        inc = FIXTURE_BASE / f"{name}-inc"
        self._full(base)
        inc.mkdir(parents=True, exist_ok=True)
        for fn in ("file-index.json", "search-index.json", "index-marketing-folders.json"):
            shutil.copyfile(base / fn, inc / fn)
        self.scanned.clear()
        return base, inc

    def _merge(self, inc: Path, *only: Path) -> int:
        argv = ["--root", str(self.root), "--brand", "DK", "--out-dir", str(inc)]
        for p in only:
            argv += ["--only-product", str(p)]
        argv += ["--merge-into", str(inc / "file-index.json")]
        return self._run(*argv)

    def _assert_equals_full(self, inc: Path, name: str) -> None:
        full = FIXTURE_BASE / f"{name}-full"
        self._full(full)
        self.assertEqual(canonical(inc / "file-index.json"), canonical(full / "file-index.json"))
        self.assertEqual(canonical(inc / "search-index.json"), canonical(full / "search-index.json"))

    # ---- (a) zmiana pliku w produkcie B ------------------------------
    def test_a_zmiana_pliku_w_B_przebudowuje_tylko_B_i_rowna_sie_pelnemu(self) -> None:
        _base, inc = self._seed("a")
        b = self.root / CAT1 / PROD_B
        _write(b / "DOY - BETA 100 g - 01.03.2026 - 6300902.00" / "4 - WIZKI"
               / "_tmp_DOYPACK - BETA - FRONT-L.png", b"yy", mtime=1_780_000_500.0)
        self.assertEqual(self._merge(inc, b), 0)
        # tylko B zeskanowane (zywe). Archiwum A/Z NIE zostalo przeskanowane jako produkt.
        self.assertEqual(self.scanned, [str(b).replace("\\", "/")])
        self._assert_equals_full(inc, "a")
        # i faktycznie zawiera nowy plik
        idx = json.loads((inc / "file-index.json").read_text(encoding="utf-8"))
        beta = [p for p in idx["products"] if p["name"] == PROD_B][0]
        names = [w["name"] for r in beta["revisions"] for w in r["wizki"]]
        self.assertTrue(any(n.endswith("FRONT-L.png") for n in names))

    # ---- (b) przemianowanie B -> "B - F" ------------------------------
    def test_b_rename_B_usuwa_stara_sciezke_i_dodaje_nowa(self) -> None:
        _base, inc = self._seed("b")
        old = self.root / CAT1 / PROD_B
        new = self.root / CAT1 / (PROD_B + " - F")
        os.replace(old, new)
        self.assertEqual(self._merge(inc, old, new), 0)
        self.assertEqual(self.scanned, [str(new).replace("\\", "/")])
        idx = json.loads((inc / "file-index.json").read_text(encoding="utf-8"))
        names = [p["name"] for p in idx["products"]]
        self.assertNotIn(PROD_B, names)
        self.assertIn(PROD_B + " - F", names)
        self._assert_equals_full(inc, "b")

    # ---- (c) usuniecie C (przeniesienie poza ROOT = to samo dla indeksu) ---
    def test_c_usuniecie_C_wycina_produkt(self) -> None:
        _base, inc = self._seed("c")
        c = self.root / CAT2 / PROD_C
        os.replace(c, FIXTURE_BASE / "_parked" / PROD_C)
        self.assertEqual(self._merge(inc, c), 0)
        self.assertEqual(self.scanned, [])
        idx = json.loads((inc / "file-index.json").read_text(encoding="utf-8"))
        self.assertNotIn(PROD_C, [p["name"] for p in idx["products"]])
        self._assert_equals_full(inc, "c")

    # ---- dopisanie nowego produktu + glebokie wejscie w sciezke -------
    def test_nowy_produkt_i_sciezka_gleboko_w_produkcie(self) -> None:
        _base, inc = self._seed("n")
        d = self.root / CAT2 / "DELTA - [ kulki ]"
        _variant(d, "DELTA", "6300905")
        deep = d / "DOY - DELTA 100 g - 01.03.2026 - 6300905.00" / "4 - WIZKI"
        self.assertEqual(self._merge(inc, deep), 0)  # plik/folder glebiej -> jednostka = produkt
        self.assertEqual(self.scanned, [str(d).replace("\\", "/")])
        self._assert_equals_full(inc, "n")

    # ---- archiwum ----------------------------------------------------
    def test_zmiana_w_archiwum_przebudowuje_kategorie_i_rowna_sie_pelnemu(self) -> None:
        _base, inc = self._seed("arch")
        arch_prod = self.root / CAT1 / ARCH / ARCH_A
        _write(arch_prod / "DOY - ALFA 100 g - 01.01.2025 - 6300901.00" / "4 - WIZKI"
               / "_tmp_DOYPACK - ALFA - FRONT-L.png", b"zz", mtime=1_780_000_700.0)
        self.assertEqual(self._merge(inc, arch_prod), 0)
        # kategoria CAT1 w calosci (A, B + archiwalne ZETA); CAT2 (C) nietknieta
        self.assertNotIn(str(self.root / CAT2 / PROD_C).replace("\\", "/"), self.scanned)
        self.assertIn(str(self.root / CAT1 / PROD_A).replace("\\", "/"), self.scanned)
        self._assert_equals_full(inc, "arch")

    def test_zmiana_zywego_produktu_z_archiwum_zachowuje_dolaczone_warianty(self) -> None:
        _base, inc = self._seed("archlive")
        a = self.root / CAT1 / PROD_A
        _write(a / "DOY - ALFA 100 g - 01.03.2026 - 6300901.00" / "2 - PROJEKT" / "_tmp_nowy.pdf", b"n", mtime=1_780_000_900.0)
        self.assertEqual(self._merge(inc, a), 0)
        idx = json.loads((inc / "file-index.json").read_text(encoding="utf-8"))
        alfa = [p for p in idx["products"] if p["name"] == PROD_A][0]
        self.assertTrue(any(r.get("in_archive") for r in alfa["revisions"]), "wariant z archiwum zgubiony")
        self._assert_equals_full(inc, "archlive")

    def test_usuniecie_i_powrot_zywego_produktu_z_archiwalnym_odpowiednikiem_przebudowuje_kategorie(self) -> None:
        """Bez zywego ALFA wrapper z archiwum staje sie produktem tylko-archiwalnym (i odwrotnie):
        sama zmiana ALFA to za malo, trzeba przebudowac kategorie."""
        _base, inc = self._seed("escal")
        a = self.root / CAT1 / PROD_A
        _park(a)
        self.assertEqual(self._merge(inc, a), 0)
        idx = json.loads((inc / "file-index.json").read_text(encoding="utf-8"))
        self.assertTrue(any(p.get("archive_only") and p["name"] == ARCH_A for p in idx["products"]))
        self._assert_equals_full(inc, "escal")
        os.replace(FIXTURE_BASE / "_parked" / PROD_A, a)  # powrot
        self.assertEqual(self._merge(inc, a), 0)
        idx = json.loads((inc / "file-index.json").read_text(encoding="utf-8"))
        self.assertFalse(any(p.get("archive_only") and p["name"] == ARCH_A for p in idx["products"]))
        self._assert_equals_full(inc, "escal2")

    # ---- aliasy DK<->GC: grupa liczona z polaczonej listy ------------
    def test_aliasy_przeliczane_dla_grupy_ze_zmienionym_czlonkiem(self) -> None:
        alias_file = FIXTURE_BASE / "none" / "aliases.json"
        ida = self.mod.norm(PROD_A).replace(" ", "-")[:80]
        idc = self.mod.norm(PROD_C).replace(" ", "-")[:80]
        alias_file.write_text(json.dumps({"groups": [{
            "members": [{"brand": "DK", "product_id": ida}, {"brand": "DK", "product_id": idc}],
            "canonical_id": ida,
        }]}), encoding="utf-8")
        self.mod.PRODUCT_ALIASES_PATH = alias_file
        try:
            _base, inc = self._seed("alias")
            c = self.root / CAT2 / PROD_C
            _write(c / "DOY - GAMMA 100 g - 01.03.2026 - 6300903.00" / "2 - PROJEKT" / "_tmp_x.pdf", b"n", mtime=1_780_001_000.0)
            self.assertEqual(self._merge(inc, c), 0)
            idx = json.loads((inc / "file-index.json").read_text(encoding="utf-8"))
            alfa = [p for p in idx["products"] if p["name"] == PROD_A][0]
            self.assertEqual([x["product_id"] for x in alfa.get("linked_products", [])], [idc])
            self._assert_equals_full(inc, "alias")
        finally:
            alias_file.unlink()

    # ---- bezpieczniki -------------------------------------------------
    def test_brak_bazy_albo_zepsuta_baza_daje_kod_5_i_nie_pisze_indeksu(self) -> None:
        out = FIXTURE_BASE / "nobase"
        out.mkdir(exist_ok=True)
        target = out / "file-index.json"
        if target.exists():
            target.unlink()
        rc = self._run("--root", str(self.root), "--brand", "DK", "--out-dir", str(out),
                       "--only-product", str(self.root / CAT1 / PROD_B), "--merge-into", str(target))
        self.assertEqual(rc, 5)
        self.assertFalse(target.exists())
        target.write_text("{ to nie jest json", encoding="utf-8")
        rc = self._run("--root", str(self.root), "--brand", "DK", "--out-dir", str(out),
                       "--only-product", str(self.root / CAT1 / PROD_B), "--merge-into", str(target))
        self.assertEqual(rc, 5)
        self.assertEqual(target.read_text(encoding="utf-8"), "{ to nie jest json")

    def test_baza_z_innych_rootow_daje_kod_5(self) -> None:
        _base, inc = self._seed("otherroot")
        idx = json.loads((inc / "file-index.json").read_text(encoding="utf-8"))
        idx["roots"] = [{"brand": "DK", "path": "Z:/inny/root"}]
        (inc / "file-index.json").write_text(json.dumps(idx), encoding="utf-8")
        self.assertEqual(self._merge(inc, self.root / CAT1 / PROD_B), 5)

    def test_sciezka_poza_rootem_daje_kod_5(self) -> None:
        _base, inc = self._seed("outside")
        self.assertEqual(self._merge(inc, FIXTURE_BASE / "none"), 5)

    def test_pojedyncza_zmiana_nie_wyzwala_bezpiecznika_ale_masowe_znikniecie_tak(self) -> None:
        _base, inc = self._seed("guard")
        stale = inc / "file-index.rejected.json"
        if stale.exists():  # zostaje po poprzednim przebiegu tego testu
            stale.unlink()
        idx = json.loads((inc / "file-index.json").read_text(encoding="utf-8"))
        ghost = [p for p in idx["products"] if p["name"] == PROD_C][0]
        ghosts = []
        ghost_dirs = []
        for i in range(25):
            g = json.loads(json.dumps(ghost))
            g["name"] = f"DUCH {i:02d}"
            g["id"] = f"duch-{i:02d}"
            g["category"] = "09 - DUCHY"
            g["rel"] = f"09 - DUCHY/DUCH {i:02d}"
            g["path"] = str(self.root / "09 - DUCHY" / f"DUCH {i:02d}").replace("\\", "/")
            ghosts.append(g)
            ghost_dirs.append(self.root / "09 - DUCHY" / f"DUCH {i:02d}")
        idx["products"].extend(ghosts)
        (inc / "file-index.json").write_text(json.dumps(idx), encoding="utf-8")
        b = self.root / CAT1 / PROD_B
        _write(b / "DOY - BETA 100 g - 01.03.2026 - 6300902.00" / "2 - PROJEKT" / "_tmp_g.pdf", b"g", mtime=1_780_001_100.0)
        self.assertEqual(self._merge(inc, b), 0)  # 1 z 29 -> bez odrzucenia
        self.assertFalse((inc / "file-index.rejected.json").exists())
        # 25 znikajacych duchow naraz (np. niedostepny dysk) -> odrzucone, indeks bez zmian
        before = (inc / "file-index.json").read_bytes()
        self.assertEqual(self._merge(inc, *ghost_dirs), 3)
        self.assertTrue((inc / "file-index.rejected.json").exists())
        self.assertEqual((inc / "file-index.json").read_bytes(), before)

    def test_cache_folderow_marketingu_nie_przechodzi_calego_drzewa_przy_przyroscie(self) -> None:
        _base, inc = self._seed("mkt")
        self.assertEqual(self.marketing_walks, 1, "pelny build raz zbiera foldery")
        b = self.root / CAT1 / PROD_B
        _write(b / "DOY - BETA 100 g - 01.03.2026 - 6300902.00" / "2 - PROJEKT" / "_tmp_m.pdf", b"m", mtime=1_780_001_200.0)
        self.assertEqual(self._merge(inc, b), 0)
        self.assertEqual(self.marketing_walks, 1, "przyrost uzywa cache, nie chodzi po drzewie")

    def test_pelny_build_bez_flag_nie_zmienia_wyniku_wzgledem_oryginalu(self) -> None:
        """Golden: pelny build nowego kodu == pelny build kodu z HEAD (kopia w orig/)."""
        orig = REPO / "work" / "2026-10-06" / "W-indeks" / "orig" / "apps" / "web" / "scripts" / "build-file-index.py"
        if not orig.is_file():
            self.skipTest("brak kopii oryginalu (work/.../orig)")
        spec = importlib.util.spec_from_file_location("dam_build_file_index_orig", orig)
        om = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(om)
        none = FIXTURE_BASE / "none"
        om.PRODUCT_ALIASES_PATH = none / "aliases.json"
        om.LANG_OVERRIDES_PATH = none / "lang.json"
        om.PRODUCT_CATALOG_PATH = none / "catalog.json"
        om.BULK_PACKAGING_PATH = none / "bulk.json"
        om._LIVE_PATH = FIXTURE_BASE / "index-live-orig.json"
        om.discover_marketing_materials = lambda products, marketing_root: None
        out_old = FIXTURE_BASE / "golden-old"
        out_new = FIXTURE_BASE / "golden-new"
        old_argv = sys.argv
        sys.argv = ["build-file-index.py", "--root", str(self.root), "--brand", "DK", "--out-dir", str(out_old)]
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                try:
                    om.main()
                except SystemExit:
                    pass
        finally:
            sys.argv = old_argv
        # stary kod wzbogaca (enrich) PRAWDZIWE apps/web/data - wynik fixtury zostaje bez wzbogacenia;
        # porownujemy wiec pliki sprzed enrich: nowy kod w trybie out-dir wzbogaca out-dir, wiec
        # patrzymy na pola, ktore enrich nie rusza.
        self._full(out_new)
        a = canonical(out_old / "file-index.json")
        b = canonical(out_new / "file-index.json")
        for key in ("roots", "root", "category_count", "product_count", "viz_count", "categories", "lang_labels"):
            self.assertEqual(a[key], b[key], key)
        strip = ("authors", "search_blob", "tag_groups")
        pa = [{k: v for k, v in p.items() if k not in strip} for p in a["products"]]
        pb = [{k: v for k, v in p.items() if k not in strip} for p in b["products"]]
        self.assertEqual(pa, pb)
        self.assertEqual(a["viz_latest"], b["viz_latest"])


if __name__ == "__main__":
    unittest.main()
