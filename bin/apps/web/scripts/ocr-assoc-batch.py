# -*- coding: utf-8 -*-
"""Wsadowe skojarzenia OCR dla grafik Brandingu bez skojarzen. Mysl przewodnia:
odpalic w piatek wieczorem, nie dotykac przez weekend, w poniedzialek przejrzec
kolejke 'pending' w aplikacji.

Uruchamiac interpreterem PACKAGING-CHECKER (ma rapidocr + PIL):
  <checker>\\venv\\Scripts\\python.exe ocr-assoc-batch.py --apply

Zrodlo obrazu na plik (resolve_ocr_sources.py, bundlowany Python DAM - ma dekoder
AVIF ktorego brak w venv checkera):
  1. Miniatura z PAMIEC-PODRECZNA/thumbs (szybkie, ~48% grafik ma juz cache)
  2. Brak miniatury -> pelna sciezka na dysku Marketing (musi byc zamontowany)

Etapy OCR na plik:
  1. RapidOCR (CPU, ~1-3 s) - filtr: jesli od razu daje pewne dopasowanie (>=95,
     tekst wprost z OCR), olmOCR sie nie odpala. Bez tego caly katalog (~2100
     plikow x 1.5-3 min/plik na olmOCR) nie zmiescilby sie w weekend.
  2. olmOCR-2 (GPU, semantyczny - "widzi" produkt na opakowaniu, nie tylko
     surowe znaki) - gdy RapidOCR nie dal pewnego trafienia. Wlaczone domyslnie;
     --no-olmocr wylacza (tylko szybki RapidOCR).

Zapis (--apply) do asset_product_links w dam-local.sqlite:
  - status 'auto'    : dopasowanie z samego tekstu OCR (reason ocr_*), score >= AUTO_MIN_SCORE
  - status 'pending' : reszta >= PENDING_MIN_SCORE (kolejka do przejrzenia, siatka jej nie pokazuje)
Dopasowania po nazwie folderu (path_*) nigdy nie ida jako 'auto' - daja falszywe skojarzenia.

Postep: JSONL z jedna linia na plik; ponowne uruchomienie pomija przetworzone id
(Ctrl+C w dowolnym momencie jest bezpieczny). Na koniec (--apply) przebudowuje
branding-grid-index.json z bazy.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
WEB = SCRIPTS.parent
BIN = WEB.parent.parent
sys.path.insert(0, str(SCRIPTS))

GRID = WEB / "data" / "branding-grid-index.json"
DEFAULT_DB = BIN / "DATABASE" / "dam-local.sqlite"
DEFAULT_CHECKPOINT = WEB.parent / "desktop" / "data" / "ocr-assoc-batch.jsonl"
DAM_PYTHON = BIN / "runtime" / "win" / "python" / "python.exe"
RESOLVE_SOURCES = SCRIPTS / "resolve_ocr_sources.py"
IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp")
AUTO_MIN_SCORE = 95
PENDING_MIN_SCORE = 70
RESOLVE_CHUNK = 200


def _load_afo():
    spec = importlib.util.spec_from_file_location("assoc_from_ocr", SCRIPTS / "assoc-from-ocr.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _done_ids(checkpoint: Path) -> set[str]:
    done: set[str] = set()
    if not checkpoint.is_file():
        return done
    for line in checkpoint.read_text(encoding="utf-8").splitlines():
        try:
            done.add(json.loads(line)["id"])
        except (ValueError, KeyError, TypeError):
            continue
    return done


def _targets(limit: int, done: set[str], locked: set[str]) -> list[dict]:
    assets = json.loads(GRID.read_text(encoding="utf-8"))["assets"]
    out = []
    for a in assets:
        aid = str(a.get("id") or "")
        if not aid or aid in done or aid in locked or a.get("linked_product_ids"):
            continue
        if not str(a.get("name") or "").lower().endswith(IMAGE_EXT):
            continue
        if not Path(str(a.get("path") or "")).is_file():
            continue
        out.append(a)
    out.sort(key=lambda a: -int(a.get("mtime_ms") or 0))
    return out[:limit] if limit else out


def _resolve_sources(targets: list[dict]) -> dict[str, str]:
    """Zdekoduj miniatury (AVIF) do PNG przez bundlowany Python DAM. Brak = pelna sciezka."""
    if not DAM_PYTHON.is_file():
        return {}
    resolved: dict[str, str] = {}
    payload = [{"id": a["id"], "path": a["path"]} for a in targets]
    for i in range(0, len(payload), RESOLVE_CHUNK):
        chunk = payload[i : i + RESOLVE_CHUNK]
        try:
            proc = subprocess.run(
                [str(DAM_PYTHON), str(RESOLVE_SOURCES)],
                input=json.dumps(chunk, ensure_ascii=False),
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=300,
            )
            part = json.loads(proc.stdout or "{}")
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
            continue
        for aid, png in part.items():
            if png:
                resolved[aid] = png
    return resolved


def _decide(suggestions: list[dict]) -> list[tuple[str, int, str, str]]:
    rows = []
    for s in suggestions:
        score, reason = int(s["score"]), str(s["reason"])
        if score >= AUTO_MIN_SCORE and reason.startswith("ocr_"):
            rows.append((s["product_id"], score, reason, "auto"))
        elif score >= PENDING_MIN_SCORE:
            rows.append((s["product_id"], score, reason, "pending"))
    return rows


def _write_links(db: Path, aid: str, source: str, rows) -> None:
    if not rows:
        return
    conn = sqlite3.connect(str(db), timeout=60)
    try:
        with conn:
            for pid, score, reason, status in rows:
                # nigdy nie nadpisuj recznych decyzji (override/confirmed/rejected)
                conn.execute(
                    "INSERT INTO asset_product_links "
                    "(asset_id, product_id, score, source, status, reason, updated_at, updated_by) "
                    "VALUES (?,?,?,?,?,?,?,?) "
                    "ON CONFLICT(asset_id, product_id) DO UPDATE SET "
                    "score=excluded.score, status=excluded.status, reason=excluded.reason, "
                    "updated_at=excluded.updated_at, source=excluded.source "
                    "WHERE asset_product_links.source LIKE 'ocr_%' "
                    "AND asset_product_links.status IN ('auto','pending')",
                    (aid, pid, float(score), source, status, reason, _now(), "ocr-assoc-batch"),
                )
    finally:
        conn.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="zapisz do dam-local.sqlite")
    ap.add_argument("--no-olmocr", action="store_true", help="tylko szybki RapidOCR, bez GPU-fallback")
    ap.add_argument("--limit", type=int, default=0, help="0 = wszystkie")
    ap.add_argument("--db", type=Path, default=DEFAULT_DB)
    ap.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    args = ap.parse_args()
    use_olmocr = not args.no_olmocr

    afo = _load_afo()
    from rapidocr_onnxruntime import RapidOCR

    rapid = RapidOCR()
    file_index = afo._load_json(afo.FILE_INDEX, {})
    associations = afo._load_json(afo.ASSOC_JSON, {})
    locked = afo._override_locked_ids()
    targets = _targets(args.limit, _done_ids(args.checkpoint), locked)
    print(f"do przetworzenia: {len(targets)} (apply={args.apply}, olmocr={use_olmocr})", flush=True)
    print("przygotowuje zrodla obrazow (miniatury z cache)...", flush=True)
    sources = _resolve_sources(targets)
    print(f"z cache miniatur: {len(sources)}/{len(targets)}, reszta z pelnej sciezki", flush=True)

    t_start = time.time()
    auto_n = pending_n = 0
    for i, a in enumerate(targets, 1):
        aid, path = str(a["id"]), str(a["path"])
        src = sources.get(aid, path)
        t0 = time.time()
        engine, text, err = "rapid", "", None
        try:
            found, _ = rapid(src)
            text = " ".join(r[1] for r in (found or []))
        except Exception as exc:  # noqa: BLE001
            err = f"rapid:{exc}"[:200]
        suggestions = afo.suggest_products(text, a, file_index=file_index, associations=associations)
        rows = _decide(suggestions)
        if use_olmocr and not any(r[3] == "auto" for r in rows):
            ocr = afo.ocr_file(Path(src))
            if ocr.get("ok"):
                engine, text, err = "olmocr2", str(ocr.get("text") or ""), None
                suggestions = afo.suggest_products(text, a, file_index=file_index, associations=associations)
                rows = _decide(suggestions)
            else:
                err = err or str(ocr.get("error"))
        if args.apply:
            _write_links(args.db, aid, f"ocr_{engine}", rows)
        auto_n += sum(1 for r in rows if r[3] == "auto")
        pending_n += sum(1 for r in rows if r[3] == "pending")
        rec = {
            "id": aid,
            "name": a.get("name"),
            "source": "thumb" if aid in sources else "full",
            "engine": engine,
            "ocr_text": text,
            "error": err,
            "decisions": [{"product_id": p, "score": s, "reason": r, "status": st} for p, s, r, st in rows],
            "applied": bool(args.apply),
            "seconds": round(time.time() - t0, 2),
            "at": _now(),
        }
        with args.checkpoint.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        if i % 25 == 0 or i == len(targets):
            el = time.time() - t_start
            eta = el / i * (len(targets) - i)
            print(f"{i}/{len(targets)}  auto={auto_n} pending={pending_n}  {el/60:.0f} min, zostalo ~{eta/60:.0f} min", flush=True)

    if args.apply and targets:
        # venv checkera nie ma ijson; runtime DAM ma go zawsze (sprawdza to instalator).
        dam_python = BIN / "runtime" / "win" / "python" / "python.exe"
        subprocess.run(
            [str(dam_python), str(SCRIPTS / "build-branding-grid-index.py"), "--from-sqlite", str(args.db)],
            check=False,
        )
    print(f"KONIEC: plikow={len(targets)} auto={auto_n} pending={pending_n}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
