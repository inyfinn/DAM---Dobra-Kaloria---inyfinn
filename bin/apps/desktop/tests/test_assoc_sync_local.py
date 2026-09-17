# -*- coding: utf-8 -*-
"""Lokalne znaczniki dirty dla synchronizacji skojarzen (ADR-011)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import assoc_repo  # noqa: E402


def _dirty(conn, aid, pid):
    return conn.execute(
        "SELECT dirty FROM asset_product_links WHERE asset_id=? AND product_id=?", (aid, pid)
    ).fetchone()[0]


def test_any_write_marks_dirty(tmp_path):
    db = tmp_path / "t.sqlite"
    assoc_repo.upsert_confirmed_links("br-1", ["p1"], db_path=db, mirror=False, schedule_publish=False)
    conn = assoc_repo.connect(db)
    assert _dirty(conn, "br-1", "p1") == 1
    conn.execute("UPDATE asset_product_links SET dirty=0")
    conn.execute("UPDATE asset_product_links SET status='rejected' WHERE asset_id='br-1'")
    assert _dirty(conn, "br-1", "p1") == 1
    # zewnetrzny skrypt bez wiedzy o dirty
    conn.execute(
        "INSERT INTO asset_product_links(asset_id, product_id, status) VALUES('br-2','p2','auto')"
    )
    assert _dirty(conn, "br-2", "p2") == 1


def test_pull_marker_does_not_mark_dirty(tmp_path):
    conn = assoc_repo.connect(tmp_path / "t.sqlite")
    conn.execute(
        "INSERT INTO asset_product_links(asset_id, product_id, status, dirty) VALUES('br-1','p1','auto',2)"
    )
    conn.execute(
        "UPDATE asset_product_links SET status='confirmed', dirty=2 WHERE asset_id='br-1'"
    )
    conn.execute("UPDATE asset_product_links SET dirty=0 WHERE dirty=2")
    assert _dirty(conn, "br-1", "p1") == 0
