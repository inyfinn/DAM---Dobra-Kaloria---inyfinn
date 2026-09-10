# -*- coding: utf-8 -*-
"""Bridge: explorer slim file-index omits heavy file lists."""
from __future__ import annotations

import json
import sys
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import local_bridge as lb  # noqa: E402

INDEX = lb.WEB_ROOT / "data" / "file-index.json"


def test_explorer_slim_omits_files_by_role_and_wizki():
    assert INDEX.is_file(), "live file-index missing"
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    slim = lb._file_index_explorer_slim(data)
    assert slim.get("slim") is True
    assert slim.get("fields") == "explorer"
    assert "viz_latest" not in slim
    products = slim.get("products") or []
    assert len(products) == len(data.get("products") or [])
    assert products, "no products"
    for prod in products:
        assert prod.get("files_slim") is True
        for rev in prod.get("revisions") or []:
            assert "files_by_role" not in rev
            assert "wizki" not in rev
    raw = json.dumps(slim, ensure_ascii=False).encode("utf-8")
    assert len(raw) < 2_500_000, "slim still too heavy: %s" % len(raw)
    assert len(raw) < INDEX.stat().st_size // 2


def test_file_index_product_by_id_returns_full_revision_files():
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    src = (data.get("products") or [None])[0]
    assert src and src.get("id")
    hit = lb._file_index_product_by_id(data, src["id"])
    assert hit is src
    revs = hit.get("revisions") or []
    assert revs
    assert "files_by_role" in revs[0] or "wizki" in revs[0]


if __name__ == "__main__":
    test_explorer_slim_omits_files_by_role_and_wizki()
    test_file_index_product_by_id_returns_full_revision_files()
    print("OK explorer slim")
