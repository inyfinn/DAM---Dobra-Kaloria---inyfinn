# -*- coding: utf-8 -*-
"""Zgloszenia poprawek zapisywane DO PLIKU, nie tylko do skrzynki w bazie.

Po co osobny plik, skoro zgloszenie i tak trafia do skrzynki adminow:

1. Uzytkownik pytal wprost "nawet nie wiadomo, gdzie to sie wysyla". Skrzynka
   siedzi w bazie i jest niewidoczna z zewnatrz. Plik widac, mozna go otworzyc,
   przeszukac i wrzucic do gita razem z poprawka, ktora go zamyka.
2. Plik jest czytelny dla asystenta pracujacego na repo - moze przejrzec liste,
   wziac zatwierdzone pozycje i wprowadzic je jako rutyne.

DECYZJA UZYTKOWNIKA (2026-09-22): zgloszenie NIE jest poleceniem.
Status nowego wpisu to zawsze ``nowe``. Dopiero administrator zmienia go na
``zatwierdzone`` i tylko takie wolno realizowac. ``odrzucone`` zostaje w pliku
jako slad decyzji, ``zrobione`` domyka watek.

Uklad na dysku (katalog wybrany przez :func:`reports_root`)::

    POPRAWKI.md                 - lista dla ludzi, najnowsze na dole
    poprawki.jsonl              - to samo maszynowo, jeden wpis na linie
    poprawki-zrzuty/P-0007-1.png

Katalog: repozytorium, gdy zapisywalne (praca na kodzie); inaczej katalog
danych uzytkownika - zamrozona aplikacja z .dmg albo Program Files nie moze
pisac do wnetrza bundla (ta sama pulapka co w 2.2.6).
"""
from __future__ import annotations

import base64
import binascii
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent

MD_NAME = "POPRAWKI.md"
JSONL_NAME = "poprawki.jsonl"
SHOTS_DIRNAME = "poprawki-zrzuty"

STATUS_NEW = "nowe"
STATUSES = ("nowe", "zatwierdzone", "odrzucone", "zrobione")

MAX_SHOTS = 6
MAX_SHOT_BYTES = 8 * 1024 * 1024
# Tylko rastry, ktore da sie obejrzec bez narzedzi. Zadnego svg (skrypty w srodku).
SHOT_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

MD_HEADER = """# Poprawki zgłoszone w DAM

Ten plik dopisuje sam program (Pomoc -> "Zgłoś poprawkę"). Nowe wpisy lądują na dole.

**Jak to działa:** zgłoszenie nie jest poleceniem. Każdy nowy wpis ma `Status: nowe`.
Administrator zmienia status na `zatwierdzone` i dopiero wtedy poprawkę wolno wprowadzać.

| Status | Znaczenie |
|---|---|
| `nowe` | czeka na decyzję administratora |
| `zatwierdzone` | do wprowadzenia |
| `odrzucone` | świadoma decyzja na nie - zostaje jako ślad |
| `zrobione` | wprowadzone; warto dopisać numer wersji |

Zrzuty ekranu leżą w `poprawki-zrzuty/`. Wpisów nie kasujemy - historia decyzji ma wartość.

---
"""


def _is_writable(path: Path) -> bool:
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".dam-poprawki-probe"
        probe.write_text("1", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


def _user_data_root() -> Path:
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(base) / "DAM"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "DAM"
    return Path(os.environ.get("XDG_DATA_HOME") or (Path.home() / ".local" / "share")) / "DAM"


def _under_test_runner() -> bool:
    """Czy leci nas test, a nie prawdziwa aplikacja.

    Bez tej bramki KAZDY przebieg zestawu testow dopisywal smieci do
    PRAWDZIWEGO POPRAWKI.md w korzeniu repo - 15 wpisow "anna (user) / x"
    narobilo sie w jeden dzien, bo tests/test_variant_notes.py wola
    create_support_report() bez podmiany tej funkcji. Test ma podmieniac
    reports_root u siebie, ale kod tez musi sie bronic sam: backlog
    uzytkownika nie moze zalezec od tego, czy ktos pamietal o patchu.
    """
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return True
    if "unittest" in sys.modules or "pytest" in sys.modules:
        return True
    return os.path.basename(sys.argv[0] or "").startswith("test")


def reports_root() -> Path:
    """Katalog na POPRAWKI.md. Repo, gdy zapisywalne; inaczej dane uzytkownika."""
    override = (os.environ.get("DAM_REPORTS_ROOT") or "").strip()
    if override:
        return Path(override)
    # bin/apps/desktop -> bin/apps -> bin -> korzen repo
    repo_root = DESKTOP_DIR.parents[2]
    if _under_test_runner():
        # Piaskownica na czas testow - nigdy korzen repo.
        import tempfile  # noqa: PLC0415 - tylko sciezka testowa

        return Path(tempfile.gettempdir()) / "dam-poprawki-test"
    if _is_writable(repo_root):
        return repo_root
    return _user_data_root()


def _now() -> datetime:
    return datetime.now(timezone.utc).astimezone()


def _next_id(jsonl: Path) -> str:
    """P-0001, P-0002, ... Numer bierzemy z pliku, zeby przezyl restart."""
    last = 0
    try:
        with jsonl.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rid = str((json.loads(line) or {}).get("id") or "")
                except (ValueError, TypeError):
                    continue
                m = re.match(r"^P-(\d+)$", rid)
                if m:
                    last = max(last, int(m.group(1)))
    except OSError:
        last = 0
    return "P-%04d" % (last + 1)


def _decode_shot(raw: Any) -> tuple[bytes, str] | None:
    """Zrzut z przegladarki: data:image/png;base64,.... Zwraca (bajty, rozszerzenie)."""
    if isinstance(raw, dict):
        raw = raw.get("data") or raw.get("data_url") or ""
    text = str(raw or "").strip()
    if not text.startswith("data:"):
        return None
    head, _, payload = text.partition(",")
    if not payload or ";base64" not in head:
        return None
    mime = head[5:].split(";", 1)[0].strip().lower()
    ext = SHOT_TYPES.get(mime)
    if not ext:
        return None
    try:
        blob = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        return None
    if not blob or len(blob) > MAX_SHOT_BYTES:
        return None
    return blob, ext


def _save_shots(root: Path, rid: str, shots: Any) -> list[str]:
    """Zapisz zrzuty; zwroc sciezki wzgledne do wpisania w POPRAWKI.md."""
    if not isinstance(shots, list) or not shots:
        return []
    out: list[str] = []
    target = root / SHOTS_DIRNAME
    for i, raw in enumerate(shots[:MAX_SHOTS], start=1):
        decoded = _decode_shot(raw)
        if decoded is None:
            continue
        blob, ext = decoded
        name = "%s-%d%s" % (rid, i, ext)
        try:
            target.mkdir(parents=True, exist_ok=True)
            (target / name).write_bytes(blob)
        except OSError:
            continue
        out.append("%s/%s" % (SHOTS_DIRNAME, name))
    return out


def _md_block(entry: dict) -> str:
    shots = entry.get("shots") or []
    if shots:
        shot_line = ", ".join("[%s](%s)" % (Path(s).name, s) for s in shots)
    else:
        shot_line = "brak"
    body = str(entry.get("body") or "").strip() or "_(bez opisu)_"
    lines = [
        "",
        "## %s - %s - %s" % (entry["id"], entry["at_local"], entry["kind_label"]),
        "",
        "- **Status:** %s" % entry["status"],
        "- **Tytuł:** %s" % (entry.get("title") or "-"),
        "- **Zgłosił:** %s%s" % (entry.get("actor") or "nieznany",
                                 (" (%s)" % entry["role"]) if entry.get("role") else ""),
        "- **Strona:** %s" % (entry.get("page") or "-"),
        "- **Wersja:** %s" % (entry.get("version") or "nieznana"),
        "- **Zrzuty:** %s" % shot_line,
        "",
        body,
        "",
        "---",
    ]
    return "\n".join(lines) + "\n"


def append_report(payload: dict, actor: str = "", role: str = "", version: str = "",
                  kind_label: str = "") -> dict:
    """Dopisz zgloszenie do POPRAWKI.md + poprawki.jsonl. Zwroc sciezki."""
    root = reports_root()
    md = root / MD_NAME
    jsonl = root / JSONL_NAME
    try:
        root.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        return {"ok": False, "error": "reports_dir_unwritable", "detail": str(exc)}

    rid = _next_id(jsonl)
    now = _now()
    shots = _save_shots(root, rid, payload.get("shots"))
    entry = {
        "id": rid,
        "status": STATUS_NEW,
        "at": now.isoformat(timespec="seconds"),
        "at_local": now.strftime("%Y-%m-%d %H:%M"),
        "kind": str(payload.get("kind") or "inne"),
        "kind_label": kind_label or str(payload.get("kind") or "inne"),
        "title": str(payload.get("title") or "").strip(),
        "body": str(payload.get("body") or "").strip(),
        "page": str(payload.get("page") or "").strip(),
        "version": version,
        "actor": actor,
        "role": role,
        "shots": shots,
    }

    try:
        if not md.exists() or not md.read_text(encoding="utf-8").strip():
            md.write_text(MD_HEADER, encoding="utf-8")
        with md.open("a", encoding="utf-8") as fh:
            fh.write(_md_block(entry))
        with jsonl.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError as exc:
        return {"ok": False, "error": "reports_write_failed", "detail": str(exc)}

    return {
        "ok": True,
        "id": rid,
        "file": str(md),
        "shots": shots,
        "shots_saved": len(shots),
    }
