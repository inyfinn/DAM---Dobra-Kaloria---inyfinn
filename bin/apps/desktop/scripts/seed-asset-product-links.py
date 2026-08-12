# -*- coding: utf-8 -*-
"""Seed asset_product_links from overrides + refilter JSONL with dry-run gate.

HARD: validate asset_id vs fat branding-index and product_id vs file-index.
Never overwrite confirmed/rejected. Default is dry-run; --apply requires
quality gate (or --force after reviewing report).
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
import sys
import time
from collections import Counter
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

DATA = DESKTOP / "data"
DB = DATA / "dam-local.sqlite"
WEB = DESKTOP.parent / "web"
OVERRIDES = WEB / "data" / "branding-associations-overrides.json"
FAT_INDEX = WEB / "data" / "branding-index.json"
FILE_INDEX = WEB / "data" / "file-index.json"
def _artifact_dir() -> Path:
    rel = Path("agents") / "shared" / "planner-runs" / "instant-assoc-quiz" / "session-01" / "artifacts"
    content_root = DESKTOP.parents[1]  # bin or GIT_ROOT
    for base in (content_root, content_root.parent, DESKTOP.parents[2]):
        cand = base / rel
        if cand.is_dir():
            return cand
    return content_root / rel


ART = _artifact_dir()

# Quality gate: reject mass seed unless enough rows validate.
MIN_VALID_RATIO = 0.85
MIN_VALID_ROWS = 50
# Strict/strong-only: smaller but auditable SKU/OCR sets (does not bypass spray/token gates).
MIN_VALID_ROWS_STRONG = 20
# Same spray / token thresholds as quality_gate (quarantine uses these, no product hardcode).
SPRAY_MIN_SHARE = 0.15
SPRAY_MIN_N = 80
TOKEN_DOMINANCE_SHARE = 0.7
# Quarantine helper: broader "keep" set (multi_token etc.) — NOT used for --strong-only accept.
_STRONG_REASON_RE = re.compile(
    r"^(sku_match|ocr_line_phrase|path_line_phrase|generic_plus_line|"
    r"generic_plus_path|multi_token|filename_sku|ean)",
    re.IGNORECASE,
)
# HARD parent 2026-08-10: seed only exact SKU/index + OCR line phrase (assoc_adequacy).
# path_line_phrase / generic_plus_* / multi_token / token_plus_context are NOT enough.
_STRICT_EVIDENCE_RE = re.compile(r"^(sku_match|ocr_line_phrase)(:|$)", re.IGNORECASE)


def is_strong_assoc_evidence(reason: str) -> bool:
    return bool(_STRONG_REASON_RE.search(str(reason or "").strip()))


def is_strict_assoc_evidence(reason: str) -> bool:
    """Auditable SKU/OCR only (assoc_adequacy sku_match / ocr_line_phrase)."""
    return bool(_STRICT_EVIDENCE_RE.match(str(reason or "").strip()))


def is_weak_token_reason(reason: str) -> bool:
    return str(reason or "").startswith("token_plus_context")


def _assoc_adequacy():
    scripts = WEB / "scripts"
    if str(scripts) not in sys.path:
        sys.path.insert(0, str(scripts))
    import assoc_adequacy as aa  # noqa: WPS433

    return aa


def _is_placeholder_index(key: str) -> bool:
    k = str(key or "").split(".")[0]
    if not k.isdigit() or len(k) < 5:
        return True
    return set(k) <= {"0"}


def _product_indexes(product: dict) -> list[str]:
    idxs = product.get("indexes") or product.get("index_bases") or []
    if not idxs and product.get("index"):
        idxs = [product["index"]]
    return [str(x) for x in idxs if x]


def _disambiguate_sku_products(
    aa, asset_blob: str, product_ids: set[str], products: dict[str, dict]
) -> list[str]:
    """When one SKU maps to multiple products, require distinctive name/path token win."""
    scored: list[tuple[int, str]] = []
    for pid in product_ids:
        prod = products[pid]
        toks = aa._distinctive_tokens(pid, str(prod.get("name") or ""))
        hits = [t for t in toks if t in asset_blob]
        scored.append((len(hits), pid))
    scored.sort(key=lambda x: (-x[0], x[1]))
    if not scored or scored[0][0] <= 0:
        return []
    if len(scored) > 1 and scored[0][0] == scored[1][0]:
        return []
    return [scored[0][1]]


def collect_live_strict_evidence_rows() -> dict:
    """Build accepted_rows from live fat+file indexes via assoc_adequacy SKU/OCR only.

    Does not trust refilter JSONL reasons (artifact is keyword-heavy). No product hardcode.
    """
    aa = _assoc_adequacy()
    stats = {
        "lines": 0,
        "valid_pending": 0,
        "valid_auto": 0,
        "reject_bad_json": 0,
        "reject_missing_ids": 0,
        "reject_unknown_asset": 0,
        "reject_unknown_product": 0,
        "reject_low_score": 0,
        "reject_weak_evidence": 0,
        "reject_ambiguous_sku": 0,
        "reject_quarantined": 0,
        "duplicates": 0,
        "sample_valid": [],
        "sample_rejected": [],
        "sample_quarantined": [],
        "quarantine_by_product": {},
        "quarantine_tags": {},
        "accepted_rows": [],
        "id_valid_total": 0,
        "id_valid_ratio": 1.0,
        "mode": "strong_only_live_scan",
        "evidence_reason_counts": {},
        "sample_evidence": [],
    }
    if not FAT_INDEX.is_file() or not FILE_INDEX.is_file():
        stats["error"] = "missing_live_indexes"
        return stats
    try:
        fat = json.loads(FAT_INDEX.read_text(encoding="utf-8"))
        file_idx = json.loads(FILE_INDEX.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        stats["error"] = f"index_read:{exc}"
        return stats
    assets = [a for a in (fat.get("assets") or []) if isinstance(a, dict) and a.get("id")]
    products = {
        str(p["id"]): p for p in (file_idx.get("products") or []) if isinstance(p, dict) and p.get("id")
    }
    sku_map: dict[str, set[str]] = {}
    for pid, prod in products.items():
        for raw in _product_indexes(prod):
            key = str(raw).split(".")[0]
            if _is_placeholder_index(key):
                continue
            sku_map.setdefault(key, set()).add(pid)

    seen: set[tuple[str, str]] = set()
    reason_counts: Counter = Counter()

    def _accept(aid: str, pid: str, score: float, reason: str, evidence: dict) -> None:
        key = (aid, pid)
        if key in seen:
            stats["duplicates"] += 1
            return
        seen.add(key)
        # SKU/OCR @ high score => auto (grid slim uses auto|confirmed).
        # Quiz queue must include auto (see branding_asset_routes /assoc/queue).
        status = "auto"
        stats["valid_auto"] += 1
        row = {
            "asset_id": aid,
            "product_id": pid,
            "score": float(score),
            "source": "strong_sku_ocr",
            "status": status,
            "reason": reason,
        }
        stats["accepted_rows"].append(row)
        reason_counts[reason.split(":")[0]] += 1
        if len(stats["sample_evidence"]) < 12:
            stats["sample_evidence"].append(evidence)

    for asset in assets:
        aid = str(asset.get("id"))
        name = str(asset.get("name") or "")
        path = str(asset.get("path") or asset.get("rel_path") or "")
        ocr = str(asset.get("ocr_text") or asset.get("ocr") or "")
        skus = aa.extract_skus(name, path, ocr)
        if not skus:
            continue
        blob = aa._norm(f"{name} {path}")
        cands: set[str] = set()
        for sku in skus:
            cands |= sku_map.get(str(sku).split(".")[0]) or set()
        if not cands:
            continue
        if len(cands) == 1:
            chosen = list(cands)
        else:
            chosen = _disambiguate_sku_products(aa, blob, cands, products)
            if not chosen:
                stats["reject_ambiguous_sku"] += 1
                continue
        for pid in chosen:
            prod = products[pid]
            score, reason = aa.score_product_link(
                asset_name=name,
                asset_path=path,
                ocr_text=ocr,
                product_id=pid,
                product_name=str(prod.get("name") or ""),
                product_path=str(prod.get("path") or ""),
                product_indexes=_product_indexes(prod),
            )
            stats["lines"] += 1
            if not is_strict_assoc_evidence(reason):
                stats["reject_weak_evidence"] += 1
                continue
            _accept(
                aid,
                pid,
                float(score),
                reason,
                {
                    "asset_id": aid,
                    "product_id": pid,
                    "score": score,
                    "reason": reason,
                    "matched_skus": sorted(skus),
                    "product_indexes": _product_indexes(prod)[:6],
                    "asset_name": name[:120],
                    "asset_path_tail": path[-140:],
                    "ocr_len": len(ocr),
                },
            )

    # OCR line phrases on assets that have OCR text (rare, but auditable).
    for asset in assets:
        ocr = str(asset.get("ocr_text") or asset.get("ocr") or "")
        if len(ocr.strip()) < 8:
            continue
        aid = str(asset.get("id"))
        name = str(asset.get("name") or "")
        path = str(asset.get("path") or asset.get("rel_path") or "")
        for pid, prod in products.items():
            score, reason = aa.score_product_link(
                asset_name=name,
                asset_path=path,
                ocr_text=ocr,
                product_id=pid,
                product_name=str(prod.get("name") or ""),
                product_path=str(prod.get("path") or ""),
                product_indexes=_product_indexes(prod),
            )
            if not reason.startswith("ocr_line_phrase"):
                continue
            stats["lines"] += 1
            _accept(
                aid,
                pid,
                float(score),
                reason,
                {
                    "asset_id": aid,
                    "product_id": pid,
                    "score": score,
                    "reason": reason,
                    "matched_skus": [],
                    "product_indexes": _product_indexes(prod)[:6],
                    "asset_name": name[:120],
                    "asset_path_tail": path[-140:],
                    "ocr_len": len(ocr),
                },
            )

    valid = stats["valid_pending"] + stats["valid_auto"]
    stats["valid_total"] = valid
    stats["id_valid_total"] = valid
    stats["id_valid_ratio"] = 1.0 if valid else 0.0
    stats["valid_ratio"] = 1.0 if valid else 0.0
    stats["evidence_reason_counts"] = dict(reason_counts)
    stats["reject_total"] = (
        stats["reject_weak_evidence"]
        + stats["reject_ambiguous_sku"]
        + stats["duplicates"]
    )
    stats["sample_valid"] = [
        {k: r[k] for k in ("asset_id", "product_id", "score", "status", "reason")}
        for r in stats["accepted_rows"][:8]
    ]
    # Spray metrics for gate
    rows = stats["accepted_rows"]
    if rows:
        top_pid, top_n = Counter(r.get("product_id") for r in rows).most_common(1)[0]
        stats["top_product_id"] = top_pid
        stats["top_product_count"] = top_n
        stats["top_product_share"] = round(top_n / max(1, len(rows)), 4)
    return stats


def filter_rows_strict_evidence(stats: dict) -> dict:
    """Drop non-SKU/OCR rows from an existing validate_jsonl result (JSONL path)."""
    aa = _assoc_adequacy()
    try:
        fat = json.loads(FAT_INDEX.read_text(encoding="utf-8")) if FAT_INDEX.is_file() else {}
        file_idx = json.loads(FILE_INDEX.read_text(encoding="utf-8")) if FILE_INDEX.is_file() else {}
    except (OSError, json.JSONDecodeError):
        fat, file_idx = {}, {}
    assets = {
        str(a["id"]): a for a in (fat.get("assets") or []) if isinstance(a, dict) and a.get("id")
    }
    products = {
        str(p["id"]): p
        for p in (file_idx.get("products") or [])
        if isinstance(p, dict) and p.get("id")
    }
    kept: list[dict] = []
    rejected_weak = 0
    samples: list[dict] = []
    for row in list(stats.get("accepted_rows") or []):
        aid = str(row.get("asset_id") or "")
        pid = str(row.get("product_id") or "")
        asset = assets.get(aid) or {}
        prod = products.get(pid) or {}
        if not asset or not prod:
            rejected_weak += 1
            continue
        score, reason = aa.score_product_link(
            asset_name=str(asset.get("name") or ""),
            asset_path=str(asset.get("path") or asset.get("rel_path") or ""),
            ocr_text=str(asset.get("ocr_text") or asset.get("ocr") or ""),
            product_id=pid,
            product_name=str(prod.get("name") or ""),
            product_path=str(prod.get("path") or ""),
            product_indexes=_product_indexes(prod),
        )
        if not is_strict_assoc_evidence(reason):
            rejected_weak += 1
            continue
        status = "auto"
        kept.append(
            {
                "asset_id": aid,
                "product_id": pid,
                "score": float(score),
                "source": "strong_sku_ocr",
                "status": status,
                "reason": reason,
            }
        )
        if len(samples) < 8:
            samples.append(
                {
                    "asset_id": aid,
                    "product_id": pid,
                    "score": score,
                    "reason": reason,
                    "asset_name": str(asset.get("name") or "")[:120],
                    "product_indexes": _product_indexes(prod)[:6],
                }
            )
    stats["reject_weak_evidence"] = int(stats.get("reject_weak_evidence") or 0) + rejected_weak
    stats["accepted_rows"] = kept
    stats["valid_pending"] = sum(1 for r in kept if r["status"] == "pending")
    stats["valid_auto"] = sum(1 for r in kept if r["status"] == "auto")
    stats["valid_total"] = stats["valid_pending"] + stats["valid_auto"]
    stats["sample_valid"] = [
        {k: r[k] for k in ("asset_id", "product_id", "score", "status", "reason")} for r in kept[:8]
    ]
    stats["sample_evidence"] = samples
    stats["evidence_reason_counts"] = dict(Counter(r["reason"].split(":")[0] for r in kept))
    stats["mode"] = "strong_only_jsonl_rescored"
    return stats


def ensure_schema(conn: sqlite3.Connection) -> None:
    import assoc_repo

    assoc_repo.ensure_schema(conn)


def load_asset_ids() -> set[str]:
    ids: set[str] = set()
    if not FAT_INDEX.is_file():
        return ids
    try:
        data = json.loads(FAT_INDEX.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ids
    for a in (data.get("assets") or []) if isinstance(data, dict) else []:
        if isinstance(a, dict) and a.get("id"):
            ids.add(str(a["id"]))
    return ids


def load_product_ids() -> set[str]:
    ids: set[str] = set()
    if not FILE_INDEX.is_file():
        return ids
    try:
        data = json.loads(FILE_INDEX.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ids
    for p in (data.get("products") or []) if isinstance(data, dict) else []:
        if isinstance(p, dict) and p.get("id"):
            ids.add(str(p["id"]))
    return ids


def seed_overrides(conn: sqlite3.Connection, now: str) -> int:
    if not OVERRIDES.is_file():
        return 0
    ov = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    n = 0
    cur = conn.cursor()
    for aid, patch in (ov.get("assets") or {}).items():
        pids = list((patch or {}).get("linked_product_ids") or [])
        for pid in pids:
            cur.execute(
                "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                "VALUES(?,?,?,?,?,?,?,?) "
                "ON CONFLICT(asset_id, product_id) DO UPDATE SET "
                "status='confirmed', source='override', score=100, updated_at=excluded.updated_at, updated_by='seed'",
                (str(aid), str(pid), 100.0, "override", "confirmed", "override", now, "seed"),
            )
            n += 1
    return n


def validate_jsonl(
    path: Path,
    asset_ids: set[str],
    product_ids: set[str],
) -> dict:
    stats = {
        "lines": 0,
        "valid_pending": 0,
        "valid_auto": 0,
        "reject_bad_json": 0,
        "reject_missing_ids": 0,
        "reject_unknown_asset": 0,
        "reject_unknown_product": 0,
        "reject_low_score": 0,
        "reject_quarantined": 0,
        "duplicates": 0,
        "sample_valid": [],
        "sample_rejected": [],
        "sample_quarantined": [],
        "quarantine_by_product": {},
        "quarantine_tags": {},
        "accepted_rows": [],
        "id_valid_total": 0,
        "id_valid_ratio": 0.0,
    }
    seen: set[tuple[str, str]] = set()
    if not path.is_file():
        stats["error"] = f"missing:{path}"
        return stats
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            stats["lines"] += 1
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                stats["reject_bad_json"] += 1
                if len(stats["sample_rejected"]) < 8:
                    stats["sample_rejected"].append({"reason": "bad_json", "line": line[:160]})
                continue
            aid = str(row.get("asset_id") or "")
            pid = str(row.get("product_id") or "")
            if not aid or not pid:
                stats["reject_missing_ids"] += 1
                continue
            key = (aid, pid)
            if key in seen:
                stats["duplicates"] += 1
                continue
            seen.add(key)
            if asset_ids and aid not in asset_ids:
                stats["reject_unknown_asset"] += 1
                if len(stats["sample_rejected"]) < 8:
                    stats["sample_rejected"].append(
                        {"reason": "unknown_asset", "asset_id": aid, "product_id": pid}
                    )
                continue
            if product_ids and pid not in product_ids:
                stats["reject_unknown_product"] += 1
                if len(stats["sample_rejected"]) < 8:
                    stats["sample_rejected"].append(
                        {"reason": "unknown_product", "asset_id": aid, "product_id": pid}
                    )
                continue
            status = str(row.get("status") or "pending")
            score = row.get("score")
            try:
                score_f = float(score) if score is not None else None
            except (TypeError, ValueError):
                score_f = None
            if score_f is not None and score_f < 50:
                stats["reject_low_score"] += 1
                continue
            if status == "auto" or (score_f is not None and score_f >= 75 and status != "pending"):
                status = "auto"
                stats["valid_auto"] += 1
            else:
                status = "pending"
                stats["valid_pending"] += 1
            accepted = {
                "asset_id": aid,
                "product_id": pid,
                "score": score_f,
                "source": str(row.get("source") or "refilter"),
                "status": status,
                "reason": str(row.get("reason") or ""),
            }
            stats["accepted_rows"].append(accepted)
    # Structural ID-valid before quality quarantine (ratio gate must not punish quarantine).
    id_valid = stats["valid_pending"] + stats["valid_auto"]
    stats["id_valid_total"] = id_valid
    stats["id_valid_ratio"] = (id_valid / stats["lines"]) if stats["lines"] else 0.0
    quarantine_spray_groups(stats)
    return stats


def _quarantine_weak_for_pid(
    rows: list[dict], pid: str, tag: str
) -> tuple[list[dict], list[dict]]:
    keep: list[dict] = []
    dropped: list[dict] = []
    for row in rows:
        if row.get("product_id") == pid and not is_strong_assoc_evidence(str(row.get("reason") or "")):
            q = dict(row)
            q["quarantine_reason"] = tag
            dropped.append(q)
        else:
            keep.append(row)
    return keep, dropped


def quarantine_spray_groups(stats: dict) -> dict:
    """Drop low-evidence spray groups from accepted_rows; keep OCR/SKU/multi_token.

    General (no product hardcode): uses SPRAY_MIN_* and TOKEN_DOMINANCE_SHARE.
    Only quarantines product_id groups at spray scale (n >= SPRAY_MIN_N) so
    dispersed pending stay accepted. Confirmed/rejected are never in this path.
    """
    rows = list(stats.get("accepted_rows") or [])
    quarantined: list[dict] = []

    # Phase 1: same spray heuristic as quality_gate (share + absolute n).
    while rows:
        counts = Counter(r.get("product_id") for r in rows)
        top_pid, top_n = counts.most_common(1)[0]
        share = top_n / max(1, len(rows))
        if not (share >= SPRAY_MIN_SHARE and top_n >= SPRAY_MIN_N):
            break
        tag = f"spray_product:{top_pid}:{top_n}:{share:.2f}"
        rows, dropped = _quarantine_weak_for_pid(rows, str(top_pid), tag)
        if not dropped:
            break
        quarantined.extend(dropped)

    # Phase 2: token_plus_context dominance — quarantine weak rows in large groups only.
    while rows:
        tok_n = sum(1 for r in rows if is_weak_token_reason(str(r.get("reason") or "")))
        if tok_n / max(1, len(rows)) < TOKEN_DOMINANCE_SHARE:
            break
        totals = Counter(r.get("product_id") for r in rows)
        weak_by_pid = Counter(
            r.get("product_id")
            for r in rows
            if is_weak_token_reason(str(r.get("reason") or ""))
            and not is_strong_assoc_evidence(str(r.get("reason") or ""))
        )
        candidates = [
            (pid, n) for pid, n in weak_by_pid.most_common() if totals[pid] >= SPRAY_MIN_N
        ]
        if not candidates:
            break
        victim = str(candidates[0][0])
        tag = f"token_context_spray:{victim}:{totals[victim]}"
        rows, dropped = _quarantine_weak_for_pid(rows, victim, tag)
        if not dropped:
            break
        quarantined.extend(dropped)

    stats["accepted_rows"] = rows
    stats["reject_quarantined"] = len(quarantined)
    stats["quarantine_by_product"] = {
        str(pid): int(n) for pid, n in Counter(r.get("product_id") for r in quarantined).most_common()
    }
    stats["quarantine_tags"] = {
        str(tag): int(n)
        for tag, n in Counter(r.get("quarantine_reason") for r in quarantined).most_common(24)
    }
    stats["sample_quarantined"] = [
        {
            k: q.get(k)
            for k in ("asset_id", "product_id", "score", "status", "reason", "quarantine_reason")
        }
        for q in quarantined[:8]
    ]
    stats["valid_pending"] = sum(1 for r in rows if r.get("status") == "pending")
    stats["valid_auto"] = sum(1 for r in rows if r.get("status") == "auto")
    valid = stats["valid_pending"] + stats["valid_auto"]
    stats["valid_total"] = valid
    stats["reject_total"] = (
        int(stats.get("reject_bad_json") or 0)
        + int(stats.get("reject_missing_ids") or 0)
        + int(stats.get("reject_unknown_asset") or 0)
        + int(stats.get("reject_unknown_product") or 0)
        + int(stats.get("reject_low_score") or 0)
        + int(stats.get("duplicates") or 0)
        + int(stats.get("reject_quarantined") or 0)
    )
    # Ratio gate: structural ID validity (pre-quarantine). Accepted share is informational.
    stats["valid_ratio"] = float(stats.get("id_valid_ratio") or 0.0)
    stats["accepted_ratio_after_quarantine"] = (valid / stats["lines"]) if stats.get("lines") else 0.0
    stats["sample_valid"] = [
        {k: r[k] for k in ("asset_id", "product_id", "score", "status", "reason")}
        for r in rows[:8]
    ]
    return stats


def quality_gate(stats: dict, *, strong_only: bool = False) -> tuple[bool, str]:
    if stats.get("error"):
        return False, str(stats["error"])
    min_rows = MIN_VALID_ROWS_STRONG if strong_only else MIN_VALID_ROWS
    if not strong_only and not stats.get("lines"):
        return False, "empty_artifact"
    if strong_only and int(stats.get("valid_total") or 0) <= 0:
        return False, "empty_strong_evidence"
    # Post-filter accepted must still be large enough to seed.
    if int(stats.get("valid_total") or 0) < min_rows:
        return False, f"valid_total<{min_rows}"
    if not strong_only:
        # Structural ID-valid ratio (quarantine must not tank this below threshold).
        id_ratio = float(stats.get("id_valid_ratio") or stats.get("valid_ratio") or 0)
        if id_ratio < MIN_VALID_RATIO:
            return False, f"valid_ratio<{MIN_VALID_RATIO}"
        unk = int(stats.get("reject_unknown_asset") or 0) + int(
            stats.get("reject_unknown_product") or 0
        )
        id_valid = int(stats.get("id_valid_total") or stats.get("valid_total") or 0)
        if unk > id_valid:
            return False, "unknown_ids_dominate"
    rows = stats.get("accepted_rows") or []
    if strong_only:
        # Every accepted row must be auditable SKU/OCR — never token/path/multi.
        for r in rows:
            if not is_strict_assoc_evidence(str(r.get("reason") or "")):
                return False, f"non_strict_reason:{r.get('reason')}"
            if is_weak_token_reason(str(r.get("reason") or "")):
                return False, "token_plus_context_in_strong"
    if rows:
        top_pid, top_n = Counter(r.get("product_id") for r in rows).most_common(1)[0]
        share = top_n / max(1, len(rows))
        stats["top_product_id"] = top_pid
        stats["top_product_share"] = round(share, 4)
        stats["top_product_count"] = top_n
        if share >= SPRAY_MIN_SHARE and top_n >= SPRAY_MIN_N:
            return False, f"spray_product:{top_pid}:{top_n}:{share:.2f}"
        tok_n = sum(1 for r in rows if is_weak_token_reason(str(r.get("reason") or "")))
        if tok_n / max(1, len(rows)) >= TOKEN_DOMINANCE_SHARE:
            return False, f"token_context_dominant:{tok_n}/{len(rows)}"
    return True, "ok"


def apply_accepted(conn: sqlite3.Connection, rows: list[dict], now: str) -> dict:
    cur = conn.cursor()
    n = {"pending": 0, "auto": 0}
    for row in rows:
        status = row["status"]
        cur.execute(
            "INSERT INTO asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
            "VALUES(?,?,?,?,?,?,?,?) "
            "ON CONFLICT(asset_id, product_id) DO UPDATE SET "
            "score=excluded.score, source=excluded.source, status=CASE "
            "WHEN asset_product_links.status IN ('confirmed','rejected') THEN asset_product_links.status "
            "ELSE excluded.status END, "
            "reason=CASE "
            "WHEN asset_product_links.status IN ('confirmed','rejected') THEN asset_product_links.reason "
            "ELSE excluded.reason END, "
            "updated_at=CASE "
            "WHEN asset_product_links.status IN ('confirmed','rejected') THEN asset_product_links.updated_at "
            "ELSE excluded.updated_at END",
            (
                row["asset_id"],
                row["product_id"],
                row["score"],
                row["source"],
                status,
                row["reason"],
                now,
                "seed",
            ),
        )
        n[status] = n.get(status, 0) + 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", type=Path, default=DB)
    ap.add_argument("--seed-input", type=Path, default=ART / "seed-input-refilter.jsonl")
    ap.add_argument("--pending", type=Path, default=ART / "refilter-pending.jsonl")
    ap.add_argument("--dry-run", action="store_true", default=True, help="Default: validate only")
    ap.add_argument("--apply", action="store_true", help="Apply seed when quality gate passes")
    ap.add_argument("--force", action="store_true", help="Apply even if quality gate fails (DANGER)")
    ap.add_argument(
        "--strong-only",
        action="store_true",
        help="Accept only assoc_adequacy sku_match / ocr_line_phrase from live indexes "
        "(explicit; does not change default dry-run semantics).",
    )
    ap.add_argument(
        "--strong-from-jsonl",
        action="store_true",
        help="With --strong-only: rescore JSONL pairs instead of live SKU/OCR scan.",
    )
    ap.add_argument("--overrides-only", action="store_true")
    ap.add_argument("--report", type=Path, default=DATA / "assoc-seed-dry-run.json")
    args = ap.parse_args()

    # --apply implies not dry-run
    dry_run = not args.apply

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    asset_ids = load_asset_ids()
    product_ids = load_product_ids()
    seed_path = args.seed_input if args.seed_input.is_file() else args.pending
    if args.overrides_only:
        stats = {"lines": 0, "valid_total": 0, "accepted_rows": [], "valid_ratio": 1.0}
    elif args.strong_only and not args.strong_from_jsonl:
        stats = collect_live_strict_evidence_rows()
    elif args.strong_only and args.strong_from_jsonl:
        stats = validate_jsonl(seed_path, asset_ids, product_ids)
        # Undo spray quarantine keep of multi_token — strict rescore from live data.
        stats = filter_rows_strict_evidence(stats)
    else:
        stats = validate_jsonl(seed_path, asset_ids, product_ids)
    gate_ok, gate_reason = (
        (True, "overrides_only")
        if args.overrides_only
        else quality_gate(stats, strong_only=bool(args.strong_only))
    )

    report = {
        "ok": True,
        "dry_run": dry_run,
        "strong_only": bool(args.strong_only),
        "seed_path": str(seed_path) if not (args.strong_only and not args.strong_from_jsonl) else "live:fat+file-index",
        "asset_id_universe": len(asset_ids),
        "product_id_universe": len(product_ids),
        "validation": {
            k: v
            for k, v in stats.items()
            if k not in {"accepted_rows"}
        },
        "evidence_reason_counts": stats.get("evidence_reason_counts") or {},
        "sample_evidence": stats.get("sample_evidence") or [],
        "quarantine": {
            "quarantined_total": int(stats.get("reject_quarantined") or 0),
            "by_product": stats.get("quarantine_by_product") or {},
            "tags": stats.get("quarantine_tags") or {},
            "sample": stats.get("sample_quarantined") or [],
            "accepted_after": int(stats.get("valid_total") or 0),
            "id_valid_total": int(stats.get("id_valid_total") or 0),
            "id_valid_ratio": float(stats.get("id_valid_ratio") or 0),
            "accepted_ratio_after_quarantine": float(
                stats.get("accepted_ratio_after_quarantine") or 0
            ),
        },
        "quality_gate": {"ok": gate_ok, "reason": gate_reason},
        "applied": False,
        "note": "",
    }

    if dry_run:
        report["note"] = (
            "Dry-run only. Review report; re-run with --apply when quality_gate.ok "
            "(or --force after human review)."
            + (" Mode=strong-only (SKU/OCR)." if args.strong_only else "")
        )
        args.report.parent.mkdir(parents=True, exist_ok=True)
        # Keep report small: drop accepted_rows from disk report
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0

    if not gate_ok and not args.force:
        report["ok"] = False
        report["note"] = "Quality gate failed; refusing mass seed. Use --force only after review."
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 2

    args.db.parent.mkdir(parents=True, exist_ok=True)
    bak = args.db.with_suffix(args.db.suffix + f".{int(time.time())}.bak")
    if args.db.is_file():
        shutil.copy2(args.db, bak)
        report["backup"] = str(bak)

    conn = sqlite3.connect(str(args.db))
    try:
        ensure_schema(conn)
        # Snapshot confirmed before seed
        before = dict(
            conn.execute("SELECT status, COUNT(1) FROM asset_product_links GROUP BY status").fetchall()
        )
        n_ov = seed_overrides(conn, now)
        applied = {"pending": 0, "auto": 0}
        if not args.overrides_only:
            applied = apply_accepted(conn, stats.get("accepted_rows") or [], now)
        conn.commit()
        after = dict(
            conn.execute("SELECT status, COUNT(1) FROM asset_product_links GROUP BY status").fetchall()
        )
        # Preserve invariant: confirmed/rejected must not drop
        if int(after.get("confirmed") or 0) < int(before.get("confirmed") or 0):
            conn.rollback()
            report["ok"] = False
            report["note"] = "Abort: confirmed count decreased"
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return 3
        if int(after.get("rejected") or 0) < int(before.get("rejected") or 0):
            conn.rollback()
            report["ok"] = False
            report["note"] = "Abort: rejected count decreased"
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return 3
        report["applied"] = True
        report["overrides_rows"] = n_ov
        report["jsonl_applied"] = applied
        report["counts_before"] = before
        report["counts_after"] = after
        report["forced"] = bool(args.force and not gate_ok)
    finally:
        conn.close()

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
