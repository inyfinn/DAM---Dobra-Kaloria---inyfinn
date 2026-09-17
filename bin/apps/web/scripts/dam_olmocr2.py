# -*- coding: utf-8 -*-
"""Most do olmOCR-2 z aplikacji PACKAGING-CHECKER (osobny venv z PyTorch + model).

DAM nie wiezie PyTorcha ani 7B modelu, wiec OCR dziala w procesie potomnym
na interpreterze checkera. Proces jest staly: model (~7B, 4-bit) laduje sie raz
na serie, a nie przy kazdym obrazie (to kosztowalo ~2-3 min na plik).

Kontrakt uzywany przez assoc-from-ocr.py:
  ocr_file(path) -> {"ok", "text", "chars", "error", "engine", "python", "seconds"}
  status()       -> {"ok", "python", "app", "configured", ...}

Zadna funkcja nie rzuca: brak checkera = ok False + opis bledu.
"""
from __future__ import annotations

import atexit
import json
import os
import queue
import subprocess
import threading
import time
from pathlib import Path

ENGINE = "olmocr2"
_DEFAULT_APP = Path(
    r"D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy"
    r"\Program  do sprawdzania\PACKAGING-CHECKER\app"
)
_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
# Slidery/banery maja zwykle < 300 znakow; 1024 tokeny (domyslne checkera) to glownie czekanie.
_DEFAULT_MAX_NEW_TOKENS = "320"
_PROMPT_ECHO_MARKERS = ("CRITICAL RULES", "Preserve ALL Polish characters")

# Staly worker: jedna sciezka na linie stdin -> jedna linia JSON na stdout (z prefiksem).
_WORKER = r"""
import base64, io, json, sys, time
app = sys.argv[1]
sys.path.insert(0, app)
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
from src.qa_ocr_olmocr import ocr_image_b64
print("@@READY", flush=True)
for raw in sys.stdin:
    img_path = raw.rstrip("\r\n")
    if not img_path:
        continue
    t0 = time.time()
    out = {"ok": False, "text": "", "error": None}
    try:
        with Image.open(img_path) as im:
            im = im.convert("RGB")
            im.thumbnail((1600, 1600))
            buf = io.BytesIO()
            im.save(buf, format="PNG")
        text = ocr_image_b64(base64.b64encode(buf.getvalue()).decode("ascii"), timeout=600) or ""
        out.update(ok=bool(text.strip()), text=text, error=None if text.strip() else "empty_text")
    except Exception as exc:
        out["error"] = type(exc).__name__ + ": " + str(exc)[:300]
    out["seconds"] = round(time.time() - t0, 2)
    print("@@RESULT " + json.dumps(out, ensure_ascii=True), flush=True)
"""

_proc: subprocess.Popen | None = None
_lines: "queue.Queue[str]" = queue.Queue()
_lock = threading.Lock()


def _app_dir() -> Path:
    return Path(os.environ.get("DAM_OLMOCR_APP") or _DEFAULT_APP)


def _python() -> Path:
    env = os.environ.get("DAM_OLMOCR_PYTHON")
    if env:
        return Path(env)
    return _app_dir() / "venv" / "Scripts" / "python.exe"


def status() -> dict:
    py, app = _python(), _app_dir()
    return {
        "ok": py.is_file() and (app / "src" / "qa_ocr_olmocr.py").is_file(),
        "engine": ENGINE,
        "python": str(py),
        "python_exists": py.is_file(),
        "app": str(app),
        "plugin_exists": (app / "src" / "qa_ocr_olmocr.py").is_file(),
        "configured": (app / ".env").is_file(),
    }


def _reader(stream) -> None:
    for raw in iter(stream.readline, b""):
        _lines.put(raw.decode("utf-8", "replace").rstrip("\r\n"))
    _lines.put("@@EOF")


def _wait_for(prefix: str, timeout: float) -> str | None:
    deadline = time.time() + timeout
    while True:
        left = deadline - time.time()
        if left <= 0:
            return None
        try:
            line = _lines.get(timeout=left)
        except queue.Empty:
            return None
        if line == "@@EOF":
            return None
        if line.startswith(prefix):
            return line[len(prefix):].strip()


def shutdown() -> None:
    global _proc
    if _proc is None:
        return
    try:
        if _proc.stdin:
            _proc.stdin.close()
        _proc.wait(timeout=20)
    except Exception:  # noqa: BLE001
        _proc.kill()
    _proc = None


atexit.register(shutdown)


def _ensure_worker(timeout: float) -> str | None:
    """Uruchom worker, jesli nie zyje. Zwraca opis bledu albo None."""
    global _proc
    if _proc is not None and _proc.poll() is None:
        return None
    py, app = _python(), _app_dir()
    if not py.is_file():
        return "olmocr_python_missing"
    while not _lines.empty():
        _lines.get_nowait()
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
    env.setdefault("OLMOCR_MAX_NEW_TOKENS", _DEFAULT_MAX_NEW_TOKENS)
    try:
        _proc = subprocess.Popen(
            [str(py), "-u", "-c", _WORKER, str(app)],
            cwd=str(app),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            env=env,
            creationflags=_NO_WINDOW,
        )
    except OSError as exc:
        _proc = None
        return f"spawn:{exc}"
    threading.Thread(target=_reader, args=(_proc.stdout,), daemon=True).start()
    if _wait_for("@@READY", timeout) is None:
        shutdown()
        return "worker_start_failed"
    return None


def ocr_file(path: Path | str, *, timeout: int = 600) -> dict:
    base = {"ok": False, "text": "", "chars": 0, "engine": ENGINE, "python": str(_python())}
    if not Path(path).is_file():
        return {**base, "error": "file_missing"}
    with _lock:
        err = _ensure_worker(timeout=300)
        if err:
            return {**base, "error": err}
        try:
            _proc.stdin.write((str(path) + "\n").encode("utf-8"))
            _proc.stdin.flush()
        except OSError as exc:
            shutdown()
            return {**base, "error": f"worker_write:{exc}"}
        payload = _wait_for("@@RESULT", timeout)
        if payload is None:
            # zawieszony albo padniety worker: nastepny plik dostanie swiezy proces
            shutdown()
            return {**base, "error": "timeout_or_worker_died"}
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return {**base, "error": "bad_worker_json"}
    text = str(data.get("text") or "")
    if any(marker in text for marker in _PROMPT_ECHO_MARKERS):
        # Grafika bez tekstu: model powtarza instrukcje z promptu zamiast OCR.
        return {**base, "error": "prompt_echo", "seconds": data.get("seconds")}
    return {
        **base,
        "ok": bool(data.get("ok")),
        "text": text,
        "chars": len(text),
        "error": data.get("error"),
        "seconds": data.get("seconds"),
    }
