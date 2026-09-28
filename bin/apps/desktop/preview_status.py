# -*- coding: utf-8 -*-
"""Plan naprawy DAM, etap 4 (`work/PLAN-NAPRAWY-DAM-DLA-CLAUDE -2.md`, sekcja 7):
klasyfikacja stanu podgladu jednego assetu, w JEDNEJ wersji zawartosci, dla
JEDNEGO profilu.

Czysta logika - bez IO, bez sieci, bez PostgreSQL, bez importu `pg_db`. Wejscie
to zwykle dataclassy zbudowane przez wywolujacego (np.
`bin/scripts/ops/preview-coverage.py`) z wierszy `dam_assets` i
`dam_thumb_cache_index` oraz z lokalnego rejestru porazek
(`dam_thumb_cache.load_preview_failures()`).

Stany (plan, sekcja 7): `ready`, `pending`, `failed`, `unsupported`.
Klucz wersji = (asset_id, mtime_ms, size, profil) - NIGDY litera dysku
("Klucz podgladu wiaz z asset_id, wersja zawartosci, profilem i wersja
generatora, nie z lokalna litera dysku").

Zrodlo prawdy dla obslugiwanych rozszerzen: `dam_thumb_cache.FILL_SUPPORTED_EXT`
(bin/apps/desktop/dam_thumb_cache.py:3253-3255 w chwili pisania tego modulu) -
dokladnie ten sam zestaw, ktorym `_fill_run_once`/`_backfill_jobs` juz odsiewaja
SVG/AI/EPS/inne formaty, ktorych PIL nie otworzy (wiec `_encode_thumb` i tak
zwrocilby `(None, "")` po cichej probie). `test_preview_status.py` pilnuje, ze
ten import sie nie rozjedzie z dam_thumb_cache.

Jednostki mtime - UWAGA, dwie rozne w tym samym systemie:
- `dam_assets.mtime_ms` (Postgres) - MILISEKUNDY (BIGINT).
- `dam_thumb_cache_index.mtime` / wpisy `thumb-rel-index.json` - SEKUNDY
  (float), bo `dam_thumb_cache._digest()` liczy `int(mt)` z sekund.
  `ThumbIndexEntry.mtime` w tym module trzyma SEKUNDY (jak w bazie/indeksie);
  `classify_asset` sam przelicza na wspolna jednostke przy porownaniu.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Iterable, Mapping, Optional

STATE_READY = "ready"
STATE_PENDING = "pending"
STATE_FAILED = "failed"
STATE_UNSUPPORTED = "unsupported"

VALID_STATES = (STATE_READY, STATE_PENDING, STATE_FAILED, STATE_UNSUPPORTED)

DEFAULT_PROFILE = "grid"


@dataclass(frozen=True)
class AssetRow:
    """Wycinek `dam_assets` potrzebny do klasyfikacji podgladu jednej wersji pliku."""

    asset_id: str
    path_rel: str
    mtime_ms: int
    size: int = 0
    name: str = ""

    @property
    def extension(self) -> str:
        base = (self.name or self.path_rel or "").replace("\\", "/").rsplit("/", 1)[-1]
        dot = base.rfind(".")
        return base[dot:].lower() if dot >= 0 else ""

    @property
    def folder(self) -> str:
        p = (self.path_rel or "").replace("\\", "/").strip("/")
        return p.rsplit("/", 1)[0] if "/" in p else "(korzen)"


@dataclass(frozen=True)
class ThumbIndexEntry:
    """Jeden wiersz `dam_thumb_cache_index` (store_key = 'rel|profil'). `mtime` w SEKUNDACH."""

    digest: str
    mtime: float = 0.0


@dataclass(frozen=True)
class FailureRecord:
    """Jeden wpis `preview-failures.json` (`dam_thumb_cache.record_preview_failure`)."""

    mtime_ms: int
    reason: str = ""
    at: str = ""


@dataclass(frozen=True)
class PreviewStatus:
    asset_id: str
    profile: str
    state: str
    reason: str = ""
    digest: str = ""

    def to_dict(self) -> dict:
        return {
            "asset_id": self.asset_id,
            "profile": self.profile,
            "state": self.state,
            "reason": self.reason,
            "digest": self.digest,
        }


def _ext_of(extension_or_path: str) -> str:
    s = (extension_or_path or "").lower()
    if s.startswith("."):
        return s
    dot = s.rfind(".")
    return s[dot:] if dot >= 0 else s


def is_supported_extension(extension_or_path: str, supported_extensions: Iterable[str]) -> bool:
    """`extension_or_path` moze byc samym rozszerzeniem (".png") albo pelna
    nazwa/sciezka - obie formy sa akceptowane, zeby wolno bylo podac zarowno
    `AssetRow.extension`, jak i surowa nazwe pliku."""
    return _ext_of(extension_or_path) in supported_extensions


def classify_asset(
    asset: AssetRow,
    *,
    profile: str,
    index_entry: Optional[ThumbIndexEntry],
    failure: Optional[FailureRecord],
    supported_extensions: Iterable[str],
) -> PreviewStatus:
    """Sklasyfikuj JEDNA (asset, profil) pare wzgledem BIEZACEJ wersji pliku
    (asset.mtime_ms). Kolejnosc rozstrzygania (plan naprawy, etap 4):

    1. `unsupported` - rozszerzenie spoza `supported_extensions`. Sprawdzane
       PRZED czymkolwiek innym: dam_thumb_cache nigdy nawet nie probuje
       zbudowac takiego podgladu (patrz `_backfill_jobs`,
       dam_thumb_cache.py:3499-3501), wiec dla tych plikow nie moze istniec
       ani wpis w indeksie, ani sensowna porazka - to nie jest "pending"
       (nigdy sie nie doczeka) ani "failed" (nikt nie probowal).
    2. `ready` - wpis w indeksie ISTNIEJE i jego wersja jest >= biezacej wersji
       pliku (index_entry.mtime, w sekundach, zrzutowane na milisekundy,
       porownane z asset.mtime_ms). Rownosc liczy sie jako aktualny (ten sam
       skan moglby dac ten sam mtime z obu stron).
    3. `failed` - nie ma aktualnego wpisu w indeksie, ALE jest zapisana
       porazka DOKLADNIE dla tej wersji pliku (failure.mtime_ms == asset.mtime_ms).
       Starsza porazka (inna wersja) NIE liczy sie jako failed dla nowej
       wersji - plik mogl sie od tego czasu zmienic i jeszcze nikt nie
       probowal go zbudowac ponownie -> pending.
    4. `pending` - wszystko inne: brak wpisu, brak porazki dla tej wersji,
       albo wpis w indeksie jest STARSZY niz biezaca wersja pliku (plan etap 4
       p.3: "po zmianie zawartosci nie serwuj starej miniatury jako
       aktualnej" - taki wpis nie liczy sie jako `ready`).
    """
    if not is_supported_extension(asset.extension, supported_extensions):
        ext_label = asset.extension or "(brak rozszerzenia)"
        return PreviewStatus(
            asset.asset_id, profile, STATE_UNSUPPORTED,
            reason=f"rozszerzenie {ext_label} nie jest obslugiwane przez generator podgladow",
        )

    if index_entry is not None:
        index_mtime_ms = int(round(float(index_entry.mtime or 0.0) * 1000))
        if index_mtime_ms >= int(asset.mtime_ms):
            return PreviewStatus(asset.asset_id, profile, STATE_READY, digest=index_entry.digest)
        reason = "wpis w indeksie miniatur jest starszy niz biezaca wersja pliku"
    else:
        reason = "brak wpisu w indeksie miniatur dla tej wersji pliku"

    if failure is not None and int(failure.mtime_ms) == int(asset.mtime_ms):
        return PreviewStatus(
            asset.asset_id, profile, STATE_FAILED,
            reason=failure.reason or "generowanie podgladu nie powiodlo sie",
        )

    return PreviewStatus(asset.asset_id, profile, STATE_PENDING, reason=reason)


@dataclass
class CoverageReport:
    profile: str
    counts: dict = field(default_factory=dict)
    by_extension: dict = field(default_factory=dict)
    top_missing_folders: list = field(default_factory=list)
    total: int = 0

    def to_dict(self) -> dict:
        return {
            "profile": self.profile,
            "total": self.total,
            "counts": dict(self.counts),
            "by_extension": {k: dict(v) for k, v in self.by_extension.items()},
            "top_missing_folders": [{"folder": f, "count": n} for f, n in self.top_missing_folders],
        }


def build_coverage_report(
    assets: Iterable[AssetRow],
    *,
    profile: str,
    index_by_asset: Mapping[str, ThumbIndexEntry],
    failures_by_asset: Mapping[str, FailureRecord],
    supported_extensions: Iterable[str],
    top_n: int = 20,
) -> tuple[CoverageReport, list]:
    """Klasyfikuje kazdy asset i agreguje liczniki. `index_by_asset` i
    `failures_by_asset` sa kluczowane przez `asset.asset_id` - dopasowanie
    sciezek (litera dysku, wielkosc liter, UNC...) jest odpowiedzialnoscia
    wywolujacego (patrz `bin/scripts/ops/preview-coverage.py`), nie tego
    modulu. Zwraca (raport, lista PreviewStatus w kolejnosci wejscia)."""
    supported = frozenset(supported_extensions)
    counts: Counter = Counter()
    by_ext: dict[str, Counter] = defaultdict(Counter)
    missing_folders: Counter = Counter()
    statuses: list[PreviewStatus] = []
    total = 0
    for asset in assets:
        total += 1
        status = classify_asset(
            asset,
            profile=profile,
            index_entry=index_by_asset.get(asset.asset_id),
            failure=failures_by_asset.get(asset.asset_id),
            supported_extensions=supported,
        )
        statuses.append(status)
        counts[status.state] += 1
        ext_label = asset.extension or "(brak)"
        by_ext[ext_label][status.state] += 1
        if status.state in (STATE_PENDING, STATE_FAILED):
            missing_folders[asset.folder] += 1
    report = CoverageReport(
        profile=profile,
        counts=dict(counts),
        by_extension={k: dict(v) for k, v in by_ext.items()},
        top_missing_folders=missing_folders.most_common(top_n),
        total=total,
    )
    return report, statuses
