# -*- coding: utf-8 -*-
"""Syntetyczny ROOT Marketing (M) i opozniona kopia (X) dla testu A/B/C.

Plan naprawy, sekcja 0: "Zwykle lokalne foldery wystarcza do odtworzenia pelnego
ROOT A i opoznionej kopii B. Kopiowanie, opoznianie zmian, usuwanie oraz bledy
dostepu wymusza skrypt testowy."

Zasady:
- wszystko powstaje pod D:\\DAM-lokalne\\testroots (sprawdzane w _guard);
- stary M/X z poprzedniego przebiegu jest PRZENOSZONY (rename) do testroots\\_old,
  nigdy kasowany rekurencyjnie;
- usuwanie pojedynczych plikow testowych (scenariusze "znika lokalna V1",
  "prawdziwe usuniecie na M") - os.remove JEDNEGO pliku, tylko pod testroots.
"""
from __future__ import annotations

import os
import shutil
import time
from dataclasses import dataclass
from pathlib import Path

TESTROOTS = Path(r"D:\DAM-lokalne\testroots")
REQUIRED = ("- POLSKA", "- EKSPORT", "-- ARCHIWUM --")

PL = "- POLSKA"
PROD = f"{PL}/01 - PRODUKTY/- DK"
GRAF = f"{PL}/03 - MATERIAŁY GRAFICZNE"


@dataclass(frozen=True)
class Spec:
    rel: str
    color: tuple[int, int, int]
    label: str
    kind: str = "png"  # png | ai | psd


# Kolejnosc = kolejnosc mtime (co minute), zeby kopia X miala te same czasy.
FILES: tuple[Spec, ...] = (
    Spec(f"{PROD}/01 - BATONY/Baton Figa z makiem/6300101.01 - Baton Figa z makiem 35g/4 - WIZKI/Baton-Figa-z-makiem-FRONT-L.png", (120, 60, 140), "Figa FRONT L"),
    Spec(f"{PROD}/01 - BATONY/Baton Figa z makiem/6300101.01 - Baton Figa z makiem 35g/4 - WIZKI/Baton-Figa-z-makiem-FRONT-S.png", (130, 70, 150), "Figa FRONT S"),
    Spec(f"{PROD}/01 - BATONY/Baton Śliwka w czekoladzie/6300102.01 - Baton Śliwka w czekoladzie 35g/4 - WIZKI/Baton-Śliwka-FRONT-L.png", (90, 40, 60), "Sliwka FRONT L"),
    Spec(f"{PROD}/01 - BATONY/Baton Śliwka w czekoladzie/6300102.01 - Baton Śliwka w czekoladzie 35g/4 - WIZKI/Baton-Śliwka-FRONT-S.png", (95, 45, 65), "Sliwka FRONT S"),
    Spec(f"{PROD}/02 - DOYPACKI/Mus Jabłko Gruszka/6300201.01 - Mus Jabłko Gruszka 200g/4 - WIZKI/Mus-Jabłko-Gruszka-FRONT-L.png", (160, 200, 80), "Mus FRONT L"),
    Spec(f"{PROD}/02 - DOYPACKI/Mus Jabłko Gruszka/6300201.01 - Mus Jabłko Gruszka 200g/4 - WIZKI/Mus-Jabłko-Gruszka-BACK-L.png", (150, 190, 70), "Mus BACK L"),
    Spec(f"{GRAF}/Baner Figa z makiem/Baner Figa z makiem 1200x628.png", (200, 120, 40), "Baner 1200x628"),
    Spec(f"{GRAF}/Baner Figa z makiem/Baner Figa z makiem 1080x1080.png", (210, 130, 50), "Baner 1080x1080"),
    Spec(f"{GRAF}/Baner Figa z makiem/Baner Figa z makiem.ai", (0, 0, 0), "", "ai"),
    Spec(f"{GRAF}/Baner Figa z makiem/Baner Figa z makiem.psd", (0, 0, 0), "", "psd"),
    Spec(f"{GRAF}/Ulotka Mus/Ulotka Mus 1200x628.png", (40, 120, 200), "Ulotka V1"),
    Spec(f"{PL}/05 - SOCIAL MEDIA/Post Wiosna 2026/Post wiosna 1080x1350.png", (240, 200, 210), "Post wiosna"),
    Spec(f"{PL}/- BRANDING i MARKA -/Logo/Logo Dobra Kaloria.png", (20, 140, 60), "Logo M (nowe)"),
    Spec(f"{PL}/- BRANDING i MARKA -/Logo/Logo Dobra Kaloria.ai", (0, 0, 0), "", "ai"),
    Spec(f"{PL}/08 - KAMAPANIE/2026/Kampania Lato/Lato 1200x628.png", (250, 180, 30), "Lato 1200x628"),
    Spec(f"{PL}/08 - KAMAPANIE/2026/Kampania Lato/Lato 1080x1080.png", (250, 190, 40), "Lato 1080x1080"),
)

# Role plikow w scenariuszach (sciezki wzgledne wobec ROOT).
V_FILE = f"{GRAF}/Ulotka Mus/Ulotka Mus 1200x628.png"                     # V1 -> V2 na M, znika na X
NEVER_ON_X = f"{PL}/05 - SOCIAL MEDIA/Post Wiosna 2026/Post wiosna 1080x1350.png"  # opoznienie kopii
OLDER_ON_X = f"{PL}/- BRANDING i MARKA -/Logo/Logo Dobra Kaloria.png"      # starsza wersja na X
EDITABLE_ONLY_M = (f"{GRAF}/Baner Figa z makiem/Baner Figa z makiem.ai",   # lista wariantow M != X
                   f"{GRAF}/Baner Figa z makiem/Baner Figa z makiem.psd")
VARIANT_FOLDER = f"{GRAF}/Baner Figa z makiem"
VANISH_ON_X = f"{PROD}/01 - BATONY/Baton Śliwka w czekoladzie/6300102.01 - Baton Śliwka w czekoladzie 35g/4 - WIZKI/Baton-Śliwka-FRONT-S.png"
REAL_DELETE_ON_M = f"{PL}/08 - KAMAPANIE/2026/Kampania Lato/Lato 1200x628.png"

X_INITIAL_SKIP = {NEVER_ON_X, *EDITABLE_ONLY_M}


def _guard(path: Path) -> Path:
    p = Path(os.path.abspath(path))
    root = Path(os.path.abspath(TESTROOTS))
    if p == root or root not in p.parents:
        raise RuntimeError(f"fixtures: sciezka poza {root}: {p}")
    return p


def _png(path: Path, color: tuple[int, int, int], label: str) -> None:
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (480, 360), color)
    draw = ImageDraw.Draw(img)
    draw.rectangle((20, 20, 460, 340), outline=(255, 255, 255), width=6)
    draw.text((40, 160), label, fill=(255, 255, 255))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG")


def _editable(path: Path, kind: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if kind == "ai":
        body = b"%PDF-1.4\n% syntetyczny plik edytowalny DAM e2e\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
    else:
        body = b"8BPS" + b"\x00" * 60 + b"syntetyczny PSD DAM e2e"
    path.write_bytes(body)


def move_aside(path: Path, stamp: str) -> Path | None:
    """Stary katalog testowy -> testroots\\_old\\<nazwa>-<stamp> (rename, bez kasowania)."""
    path = _guard(path)
    if not path.exists():
        return None
    dest = _guard(TESTROOTS / "_old" / f"{path.name}-{stamp}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    os.rename(path, dest)
    return dest


def build_m(root: Path, base_ts: float) -> dict[str, float]:
    """Pelny ROOT A. Zwraca {rel: mtime}."""
    root = _guard(root)
    for d in REQUIRED:
        (root / d).mkdir(parents=True, exist_ok=True)
    mtimes: dict[str, float] = {}
    for i, spec in enumerate(FILES):
        target = root / spec.rel
        if spec.kind == "png":
            _png(target, spec.color, spec.label)
        else:
            _editable(target, spec.kind)
        ts = float(int(base_ts + i * 60))
        os.utime(target, (ts, ts))
        mtimes[spec.rel] = ts
    return mtimes


def build_x(m_root: Path, x_root: Path, older_days: float = 3.0) -> dict:
    """Opozniona kopia B: bez plikow z X_INITIAL_SKIP, starsza wersja OLDER_ON_X."""
    m_root = _guard(m_root)
    x_root = _guard(x_root)
    for d in REQUIRED:
        (x_root / d).mkdir(parents=True, exist_ok=True)
    copied, skipped = [], []
    for spec in FILES:
        if spec.rel in X_INITIAL_SKIP:
            skipped.append(spec.rel)
            continue
        src = m_root / spec.rel
        dst = x_root / spec.rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        copied.append(spec.rel)
    older = x_root / OLDER_ON_X
    _png(older, (60, 60, 60), "Logo X (STARE)")
    m_ts = (m_root / OLDER_ON_X).stat().st_mtime
    old_ts = float(int(m_ts - older_days * 86400))
    os.utime(older, (old_ts, old_ts))
    return {"copied": copied, "skipped": skipped, "older": {OLDER_ON_X: old_ts}}


def write_v2(m_root: Path) -> float:
    """Nowa wersja V_FILE na M (inna tresc, nowszy mtime)."""
    target = _guard(m_root / V_FILE)
    _png(target, (220, 30, 30), "Ulotka V2")
    ts = float(int(time.time()))
    os.utime(target, (ts, ts))
    return ts


def remove_file(root: Path, rel: str) -> bool:
    """Usun JEDEN plik testowy (nie katalog)."""
    target = _guard(root / rel)
    if target.is_file():
        os.remove(target)
        return True
    return False
