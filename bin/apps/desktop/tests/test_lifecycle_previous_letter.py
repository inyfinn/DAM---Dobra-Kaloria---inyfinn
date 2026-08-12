"""Test: restore z archiwum zachowuje previous_letter per nośnik (nie wspolny index)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import lifecycle_status as ls  # noqa: E402


def _simulate_variant_clear(
    store: dict,
    product_id: str,
    variant_path: str,
    revision_index: str,
) -> str:
    """Zwraca effective letter po odkliknieciu X (clear) na wariancie."""
    variant = Path(variant_path)
    row = ls._rev_row_for_variant(store, product_id, variant, revision_index)
    prev = str(row.get("previous_letter") or "").strip().upper()
    if prev == "X":
        prev = ""
    if prev in ("F", "D"):
        return prev
    return ""


def _simulate_product_clear_child(
    store: dict,
    product_id: str,
    child_name: str,
    product_had_x: bool = True,
) -> str:
    child = Path(f"X:/cat/prod/{child_name}")
    row = ls._rev_row_for_child(store, product_id, child)
    old_l = ls.status_letter_of(child_name)
    return ls._restore_letter_from_row(row, old_l=old_l, product_had_x=product_had_x)


def test_shared_index_doy_ety_not_cross_contaminated():
    """DOY i ETY maja TEST-TEST2 — lookup po sciezce, nie legacy klucz."""
    store = {
        "revisions": {
            "X:/p/DOY - 35 g - TEST-TEST2 - X": {
                "product_id": "test-lifecycle-nerkowcowy",
                "path": "X:/p/DOY - 35 g - TEST-TEST2 - X",
                "previous_letter": None,
                "letter": "X",
            },
            "X:/p/ETY - 35 g - TEST-TEST2 - X": {
                "product_id": "test-lifecycle-nerkowcowy",
                "path": "X:/p/ETY - 35 g - TEST-TEST2 - X",
                "previous_letter": "F",
                "letter": "X",
            },
            # Legacy bug: jeden wpis TEST-TEST2 skorumpowany na D
            "TEST-TEST2": {
                "product_id": "test-lifecycle-nerkowcowy",
                "path": "X:/p/ETY - 35 g - TEST-TEST2 - D",
                "previous_letter": "D",
                "letter": "D",
            },
        }
    }
    pid = "test-lifecycle-nerkowcowy"
    doy = _simulate_variant_clear(
        store, pid, "X:/p/DOY - 35 g - TEST-TEST2 - X", "TEST-TEST2"
    )
    ety = _simulate_variant_clear(
        store, pid, "X:/p/ETY - 35 g - TEST-TEST2 - X", "TEST-TEST2"
    )
    assert doy == "", f"DOY powinien byc bez statusu, dostal {doy!r}"
    assert ety == "F", f"ETY powinien byc F, dostal {ety!r}"


def test_full_scenario_expected_final_letters():
    """Scenariusz uzytkownika: po restore produktu BAT=D, reszta clear/F."""
    pid = "test-lifecycle-nerkowcowy"
    store = {
        "products": {pid: {"previous_letter": None, "letter": "X"}},
        "revisions": {
            "X:/p/BAT - 35 g - TEST-TEST - D": {
                "product_id": pid,
                "path": "X:/p/BAT - 35 g - TEST-TEST - D",
                "previous_letter": None,
                "letter": "D",
            },
            "X:/p/DOY - 35 g - TEST-TEST2 - X": {
                "product_id": pid,
                "path": "X:/p/DOY - 35 g - TEST-TEST2 - X",
                "previous_letter": None,
                "letter": "X",
            },
            "X:/p/ETY - 35 g - TEST-TEST2 - X": {
                "product_id": pid,
                "path": "X:/p/ETY - 35 g - TEST-TEST2 - X",
                "previous_letter": "F",
                "letter": "X",
            },
        },
    }

    # Krok 5: odklik ETY X -> F
    assert (
        _simulate_variant_clear(
            store, pid, "X:/p/ETY - 35 g - TEST-TEST2 - X", "TEST-TEST2"
        )
        == "F"
    )

    # Krok 6: odklik DOY X -> clear
    assert (
        _simulate_variant_clear(
            store, pid, "X:/p/DOY - 35 g - TEST-TEST2 - X", "TEST-TEST2"
        )
        == ""
    )

    # Krok 7: odklik produkt X — cascade na pozostale w archiwum
    bat = _simulate_product_clear_child(
        store, pid, "BAT - 35 g - TEST-TEST - D", product_had_x=True
    )
    assert bat == "D", f"BAT powinien zostac D, dostal {bat!r}"

    # ETY/DOY juz live — product clear nie dotyka; sprawdz identity rozroznia
    assert ls._variant_identity("DOY - 35 g - TEST-TEST2") != ls._variant_identity(
        "ETY - 35 g - TEST-TEST2"
    )


def test_never_restore_to_x():
    row = {"previous_letter": "X"}
    assert ls._restore_letter_from_row(row, old_l="X", product_had_x=True) == ""


if __name__ == "__main__":
    test_shared_index_doy_ety_not_cross_contaminated()
    test_full_scenario_expected_final_letters()
    test_never_restore_to_x()
    print("ALL OK")
