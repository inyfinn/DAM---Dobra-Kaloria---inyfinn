# -*- coding: utf-8 -*-
"""Dowod dopasowania fraz wlasciciela dla dam_semantic_search."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(r"d:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn")
sys.path.insert(0, str(ROOT / "bin" / "apps" / "desktop"))

import dam_semantic_search as sem  # noqa: E402

TARGET_NEW = "dobra kaloria_BSA  5061_NEW.jpg"
TARGET_ALT = "dobra kaloria_BSA  5061_ALT.tif"

PHRASES = [
    "zdjecie gdzie laska je kulke",
    "dziewczyna z kuleczką",
    "kulki dziewczyna",
    "kulki kobieta",
    "modelka je kulkę",
    "modelka gryzie kulke",
]


def has_name(hits, name: str) -> bool:
    return any(h.get("name") == name for h in hits)


def main() -> None:
    rows = []
    all_ok = True
    for q in PHRASES:
        res = sem.search(q, limit=200)
        strict = res["strict"]
        ok_new = has_name(strict, TARGET_NEW)
        ok_alt = has_name(strict, TARGET_ALT)
        ok = ok_new and ok_alt
        if not ok:
            all_ok = False
        rows.append(
            {
                "query": q,
                "concepts": res["concepts"],
                "strict_count": res["counts"]["strict"],
                "associated_count": res["counts"]["associated"],
                "NEW_in_strict": ok_new,
                "ALT_in_strict": ok_alt,
                "pass": ok,
            }
        )
        print("---")
        print("Q:", q)
        print("concepts:", res["concepts"])
        print("strict:", res["counts"]["strict"], "associated:", res["counts"]["associated"])
        print("NEW.jpg strict:", ok_new, "ALT.tif strict:", ok_alt)

    neg = sem.search("traktor na ksiezycu", limit=200)
    print("---")
    print("NEG traktor na ksiezycu", neg["concepts"], neg["counts"])

    kulki = sem.search("kulki dziewczyna", limit=200)
    assoc_names = [h.get("name") for h in kulki["associated"]]
    assoc_paths = [h.get("path") for h in kulki["associated"]]
    baton_in_strict = [
        h["path"]
        for h in kulki["strict"]
        if "baton" in (h.get("path") or "").lower()
        and "kulka" not in (h.get("path") or "").lower()
        and "kulki" not in (h.get("path") or "").lower()
    ]
    niemieso_in_strict = [
        h["path"]
        for h in kulki["strict"]
        if "niemies" in fold_path(h.get("path") or "")
        and "kulka" not in (h.get("path") or "").lower()
    ]
    baton_in_assoc = [p for p in assoc_paths if "baton" in (p or "").lower()]
    niem_in_assoc = [p for p in assoc_paths if "niemies" in fold_path(p or "") or "roslinn" in fold_path(p or "")]
    print("---")
    print("ORDER baton_in_strict_without_kulka", len(baton_in_strict))
    print("ORDER niemieso_in_strict_without_kulka", len(niemieso_in_strict))
    print("ORDER baton_in_associated", len(baton_in_assoc), "sample:", baton_in_assoc[:3])
    print("ORDER niem_in_associated", len(niem_in_assoc), "sample:", niem_in_assoc[:3])
    print("assoc reasons sample:", [h.get("association_reason") for h in kulki["associated"][:5]])

    out = {
        "phrases": rows,
        "all_six_pass": all_ok,
        "negative": {
            "query": "traktor na ksiezycu",
            "concepts": neg["concepts"],
            "counts": neg["counts"],
            "pass": neg["counts"]["strict"] == 0 and neg["counts"]["associated"] == 0,
        },
        "order": {
            "baton_in_strict_without_kulka": len(baton_in_strict),
            "niemieso_in_strict_without_kulka": len(niemieso_in_strict),
            "baton_in_associated": len(baton_in_assoc),
            "niem_in_associated": len(niem_in_assoc),
            "assoc_reason_sample": [h.get("association_reason") for h in kulki["associated"][:8]],
        },
    }
    dest = Path(__file__).with_name("semantic-search-proof.json")
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", dest)
    print("ALL_SIX", all_ok)


def fold_path(p: str) -> str:
    return sem.fold_text(p)


if __name__ == "__main__":
    main()
