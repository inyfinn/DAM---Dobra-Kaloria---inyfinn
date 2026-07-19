# -*- coding: utf-8 -*-
"""OCR + AI enrichment stub for branding assets (incremental by mtime)."""
from __future__ import annotations

import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
INDEX = WEB / "data" / "branding-index.json"
OUT = WEB / "data" / "branding-recognition.json"
STATUS = WEB / "data" / "branding-recognize-status.json"


def ocr_image(path: Path) -> tuple[str, float]:
    try:
        from rapidocr_onnxruntime import RapidOCR  # type: ignore

        engine = RapidOCR()
        result, _ = engine(str(path))
        if not result:
            return "", 0.0
        text = " ".join(row[1] for row in result if len(row) > 1)
        conf = sum(float(row[2]) for row in result if len(row) > 2) / max(len(result), 1)
        return text, conf
    except Exception:
        return "", 0.0


def video_frame(path: Path, out_jpg: Path) -> bool:
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(path), "-frames:v", "1", str(out_jpg)],
            check=True,
            capture_output=True,
            timeout=120,
        )
        return out_jpg.is_file()
    except (OSError, subprocess.SubprocessError):
        return False


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    args = ap.parse_args()
    if not INDEX.is_file():
        STATUS.write_text(json.dumps({"ok": False, "error": "branding_index_missing"}), encoding="utf-8")
        return 1
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    rec = json.loads(OUT.read_text(encoding="utf-8")) if OUT.is_file() else {"assets": {}}
    store = rec.setdefault("assets", {})
    assets = idx.get("assets") or []
    done = 0
    STATUS.write_text(
        json.dumps({"ok": True, "state": "running", "total": len(assets), "done": 0}),
        encoding="utf-8",
    )
    for a in assets:
        if done >= args.limit:
            break
        aid = a.get("id")
        path = Path(a.get("path") or "")
        if not aid or not path.is_file():
            continue
        if aid in store and store[aid].get("ocr_text"):
            continue
        mt = path.stat().st_mtime
        text, conf = "", 0.0
        if a.get("media_type") == "video":
            frame = WEB / "data" / "tmp" / f"{aid}.jpg"
            frame.parent.mkdir(parents=True, exist_ok=True)
            if video_frame(path, frame):
                text, conf = ocr_image(frame)
        elif path.suffix.lower() in {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".psd", ".psb"}:
            text, conf = ocr_image(path)
        appearance = []
        if text:
            from brand_tag_utils import extract_appearance_from_text

            appearance = extract_appearance_from_text(text + " " + (a.get("name") or ""))
        store[aid] = {
            "ocr_text": text,
            "ocr_confidence": conf,
            "appearance_tags": appearance,
            "linked_product_ids": a.get("linked_product_ids") or [],
            "link_source": "ocr" if text else "none",
            "mtime": mt,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }
        done += 1
        if done % 5 == 0:
            STATUS.write_text(
                json.dumps({"ok": True, "state": "running", "total": len(assets), "done": done}),
                encoding="utf-8",
            )
    rec["updated_at"] = datetime.now(timezone.utc).isoformat()
    OUT.write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
    STATUS.write_text(
        json.dumps({"ok": True, "state": "idle", "total": len(assets), "done": done}),
        encoding="utf-8",
    )
    print(f"recognize done={done}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
