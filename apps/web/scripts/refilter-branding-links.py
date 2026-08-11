# -*- coding: utf-8 -*-
"""Masowe czyszczenie polluted linked_* w branding-index (assoc_adequacy rev4).

- Backup timestampowany przed zapisem
- Filtruje linked_product_ids / linked_products / folder_linked_product_ids
- auto >=75; pending 50-74 (jsonl); drop <50; IKONY / .svg => 70
- Override assets z branding-associations-overrides.json = nie ruszamy
- Bez pelnego OLMOCR batch
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
DATA = WEB / "data"
SCRIPTS = Path(__file__).resolve().parent
INDEX = DATA / "branding-index.json"
FILE_INDEX = DATA / "file-index.json"
ASSOC = DATA / "product-associations.json"
OVERRIDES = DATA / "branding-associations-overrides.json"
REPO = WEB.parents[1]
ART = REPO / "agents" / "shared" / "planner-runs" / "instant-assoc-quiz" / "session-01" / "artifacts"

sys.path.insert(0, str(SCRIPTS))
from assoc_adequacy import score_product_link  # noqa: E402


def _utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def load_override_forced_products() -> dict[str, list[str]]:
    """Mapa asset_id -> linked_product_ids z overrides (nigdy nie oslabiac)."""
    if not OVERRIDES.is_file():
        return {}
    try:
        ov = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    forced: dict[str, list[str]] = {}

    def apply(aid: str, pids: list[str], *, overwrite: bool) -> None:
        key = str(aid)
        if not overwrite and key in forced:
            return
        seen: set[str] = set()
        out: list[str] = []
        for pid in pids:
            p = str(pid or "").strip()
            if not p or p in seen:
                continue
            seen.add(p)
            out.append(p)
        forced[key] = out

    for aid, patch in (ov.get("assets") or {}).items():
        patch = patch or {}
        if "linked_product_ids" not in patch:
            continue
        pids = list(patch.get("linked_product_ids") or [])
        apply(str(aid), pids, overwrite=True)
        for vid in patch.get("linked_variant_ids") or []:
            apply(str(vid), pids, overwrite=False)
    for patch in (ov.get("folder_groups") or {}).values():
        patch = patch or {}
        if "linked_product_ids" not in patch:
            continue
        pids = list(patch.get("linked_product_ids") or [])
        for vid in patch.get("linked_variant_ids") or []:
            apply(str(vid), pids, overwrite=False)
    return forced


def _is_iconish(asset: dict) -> bool:
    path = str(asset.get("path") or "")
    name = str(asset.get("name") or "")
    path_u = path.upper().replace("\\", "/")
    if "/IKONY/" in path_u or path_u.endswith("/IKONY") or "\\IKONY\\" in path.upper():
        return True
    if "IKONY" in path_u.split("/"):
        return True
    if name.lower().endswith(".svg"):
        return True
    return False


def _collect_candidate_ids(asset: dict) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()

    def add(pid: str) -> None:
        p = str(pid or "").strip()
        if not p or p in seen:
            return
        seen.add(p)
        out.append(p)

    for pid in asset.get("linked_product_ids") or []:
        add(pid)
    for row in asset.get("linked_products") or []:
        if isinstance(row, dict):
            add(row.get("id") or "")
        else:
            add(row)
    for pid in asset.get("folder_linked_product_ids") or []:
        add(pid)
    singular = asset.get("linked_product_id")
    if singular:
        add(singular)
    return out


def _score_keep(
    *,
    asset: dict,
    pid: str,
    products_by_id: dict,
    associations: dict,
    min_score: int,
) -> tuple[bool, int, str]:
    p = products_by_id.get(pid) or {}
    score, reason = score_product_link(
        asset_name=str(asset.get("name") or ""),
        asset_path=str(asset.get("path") or ""),
        ocr_text=str(asset.get("ocr_text") or ""),
        product_id=pid,
        product_name=str(p.get("name") or p.get("display_name") or ""),
        product_path=str(p.get("path") or ""),
        product_indexes=p.get("indexes") or [],
        associations=associations,
    )
    return score >= min_score, score, reason


def _rebuild_linked_products(kept_ids: list[str], prev_rows: list, products_by_id: dict) -> list[dict]:
    prev_by_id = {}
    for row in prev_rows or []:
        if isinstance(row, dict) and row.get("id"):
            prev_by_id[str(row["id"])] = row
    out: list[dict] = []
    for pid in kept_ids:
        if pid in prev_by_id:
            out.append(prev_by_id[pid])
            continue
        p = products_by_id.get(pid) or {}
        out.append(
            {
                "id": pid,
                "display_name": str(p.get("display_name") or p.get("name") or pid),
                "thumb_url": "",
            }
        )
    return out


def refilter(
    *,
    dry_run: bool = False,
    verify_only: bool = False,
    pending_out: Path | None = None,
    auto_min: int = 75,
    pending_min: int = 50,
) -> dict:
    if not INDEX.is_file():
        raise SystemExit(f"missing {INDEX}")
    print(f"loading {INDEX} ...", flush=True)
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    file_index = json.loads(FILE_INDEX.read_text(encoding="utf-8")) if FILE_INDEX.is_file() else {}
    associations = json.loads(ASSOC.read_text(encoding="utf-8")) if ASSOC.is_file() else {}
    products = file_index.get("products") or []
    products_by_id = {p.get("id"): p for p in products if p.get("id")}
    forced = load_override_forced_products()
    assets = idx.get("assets") or []

    stats: dict = {
        "asset_count": len(assets),
        "assets_with_links_before": 0,
        "assets_touched": 0,
        "override_enforced": 0,
        "links_before": 0,
        "links_after": 0,
        "links_removed": 0,
        "pending_count": 0,
        "auto_count": 0,
        "iconish_touched": 0,
        "iconish_links_removed": 0,
        "dry_run": dry_run,
        "backup": None,
        "backup_bytes": None,
        "samples": {},
        "auto_min": auto_min,
        "pending_min": pending_min,
    }
    pending_rows: list[dict] = []

    verify_ids = {
        "br-005067",
        "br-000458",
        "br-001003",
        "br-005033",
    }

    for asset in assets:
        aid = str(asset.get("id") or "")
        cands = _collect_candidate_ids(asset)
        if not cands and aid not in forced:
            continue
        if cands:
            stats["assets_with_links_before"] += 1
            stats["links_before"] += len(set(cands))
        elif aid in forced:
            stats["assets_with_links_before"] += 1

        prev_ids = list(asset.get("linked_product_ids") or [])
        prev_folder = [str(x) for x in (asset.get("folder_linked_product_ids") or []) if str(x).strip()]
        prev_lp = list(asset.get("linked_products") or [])
        prev_singular = asset.get("linked_product_id")
        iconish = _is_iconish(asset)
        floor = max(70 if iconish else pending_min, pending_min)
        scored: list[tuple[int, str, str]] = []
        removed_here = 0
        override_enforced = False
        auto_kept: list[str] = []
        pending_kept: list[tuple[int, str, str]] = []

        if aid in forced:
            kept = list(forced[aid])
            override_enforced = True
            scored = [(100, pid, "override_forced") for pid in kept]
            auto_kept = list(kept)
            removed_here = len(set(cands) - set(kept))
        else:
            for pid in cands:
                _ok, score, reason = _score_keep(
                    asset=asset,
                    pid=pid,
                    products_by_id=products_by_id,
                    associations=associations,
                    min_score=0,
                )
                if score >= auto_min:
                    scored.append((score, pid, reason))
                    auto_kept.append(pid)
                elif score >= floor:
                    scored.append((score, pid, reason))
                    pending_kept.append((score, pid, reason))
                    pending_rows.append(
                        {
                            "asset_id": aid,
                            "product_id": pid,
                            "score": score,
                            "source": "refilter",
                            "status": "pending",
                            "reason": reason,
                            "name": asset.get("name") or "",
                            "path": asset.get("path") or "",
                        }
                    )
                else:
                    removed_here += 1
            scored.sort(key=lambda x: (-x[0], x[1]))
            kept = list(auto_kept)
            stats["pending_count"] += len(pending_kept)
            stats["auto_count"] += len(auto_kept)

        new_lp = _rebuild_linked_products(kept, prev_lp, products_by_id)
        if override_enforced:
            folder_kept = list(kept)
        elif prev_folder:
            folder_kept = [pid for pid in kept if pid in set(prev_folder)]
        else:
            folder_kept = list(kept)

        changed = (
            prev_ids != kept
            or prev_folder != folder_kept
            or [r.get("id") if isinstance(r, dict) else r for r in prev_lp] != kept
            or (prev_singular or None) != (kept[0] if kept else None)
        )

        if changed:
            stats["assets_touched"] += 1
            stats["links_removed"] += max(0, len(set(cands)) - len(kept))
            if override_enforced:
                stats["override_enforced"] += 1
            if iconish:
                stats["iconish_touched"] += 1
                stats["iconish_links_removed"] += removed_here
            if not dry_run and not verify_only:
                asset["linked_product_ids"] = kept
                asset["folder_linked_product_ids"] = folder_kept
                asset["linked_products"] = new_lp
                if kept:
                    asset["linked_product_id"] = kept[0]
                elif "linked_product_id" in asset:
                    asset["linked_product_id"] = None

        stats["links_after"] += len(kept)

        if aid in verify_ids or (
            aid
            and any(
                k in str(asset.get("name") or "").lower() + str(asset.get("path") or "").lower()
                for k in ("baseball", "tennis-ball", "kulki limonka", "limonka", "kulki")
            )
            and "mix-6x" in " ".join(cands).lower()
            and len(stats["samples"]) < 24
        ):
            stats["samples"][aid] = {
                "name": asset.get("name"),
                "path_tail": str(asset.get("path") or "")[-80:],
                "iconish": iconish,
                "min_score": floor,
                "override_enforced": override_enforced,
                "before": cands,
                "kept": kept,
                "pending": [pid for _s, pid, _r in pending_kept],
                "scores": [{"id": pid, "score": s, "reason": r} for s, pid, r in scored],
                "removed": [pid for pid in cands if pid not in set(kept)],
            }

    if pending_out is not None:
        pending_out.parent.mkdir(parents=True, exist_ok=True)
        with pending_out.open("w", encoding="utf-8") as pf:
            for row in pending_rows:
                pf.write(json.dumps(row, ensure_ascii=False) + "\n")
        stats["pending_out"] = str(pending_out)
        stats["pending_lines"] = len(pending_rows)

    if verify_only or dry_run:
        return stats

    stamp = _utc_stamp()
    backup_dir = REPO / "_restore_backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup = backup_dir / f"branding-index-{stamp}.json"
    print(f"backup -> {backup}", flush=True)
    shutil.copy2(INDEX, backup)
    stats["backup"] = str(backup)
    h = hashlib.sha256()
    with INDEX.open("rb") as bf:
        for chunk in iter(lambda: bf.read(1024 * 1024), b""):
            h.update(chunk)
    stats["sha256_before"] = h.hexdigest()

    idx["links_refiltered_at"] = datetime.now(timezone.utc).isoformat()
    idx["links_refilter"] = {
        "engine": "assoc_adequacy_rev4",
        "auto_min": auto_min,
        "pending_min": pending_min,
        "icon_min_score": 70,
        "assets_touched": stats["assets_touched"],
        "links_removed": stats["links_removed"],
        "pending_count": stats["pending_count"],
        "override_enforced": stats["override_enforced"],
    }
    stats["backup_bytes"] = backup.stat().st_size if backup.is_file() else None
    idx["linked_product_count"] = sum(1 for a in assets if a.get("linked_product_ids"))

    tmp = INDEX.with_suffix(".json.tmp")
    print(f"writing {tmp} ...", flush=True)
    tmp.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(INDEX)
    print(f"wrote {INDEX}", flush=True)
    return stats


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verify-only", action="store_true", help="score samples, no write")
    ap.add_argument("--json-out", type=str, default="")
    ap.add_argument("--pending-out", type=str, default="")
    ap.add_argument("--auto-min", type=int, default=75)
    ap.add_argument("--pending-min", type=int, default=50)
    args = ap.parse_args()
    pending = Path(args.pending_out) if args.pending_out else (None if args.verify_only else ART / "refilter-pending.jsonl")
    stats = refilter(
        dry_run=args.dry_run,
        verify_only=args.verify_only,
        pending_out=pending,
        auto_min=args.auto_min,
        pending_min=args.pending_min,
    )
    print(json.dumps({k: v for k, v in stats.items() if k != "samples"}, ensure_ascii=False, indent=2))
    print("--- samples ---", flush=True)
    print(json.dumps(stats.get("samples") or {}, ensure_ascii=False, indent=2))
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
