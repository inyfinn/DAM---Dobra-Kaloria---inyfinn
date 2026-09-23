# -*- coding: utf-8 -*-
"""Stabilne id materialow Brandingu: z sciezki wzglednej wobec folderu Marketing.

Dawniej id bylo licznikiem skanu (br-000001, br-000002...). Jeden nowy plik
wczesniej w kolejnosci przesuwal wszystkie dalsze numery, a kazdy komputer
(inny ROOT, inny zestaw plikow) mial inna numeracje. Baza (asset_product_links),
campaigns.json i nadpisania skojarzen trzymaja id - wiec te same dane pokazywaly
na roznych komputerach rozne pliki.

Teraz id liczy sie z samej sciezki PO folderze Marketing:
    M:/- POLSKA/...  ==  X:/Marketing/- POLSKA/...  ==  D:/Marketing/- POLSKA/...
    -> klucz "- polska/..." -> br-0XXXXXXXX (zero + 8 cyfr skrotu SHA-1)

Zero na poczatku jest celowe: DamMarketingId (M-*) bierze cyfry id BEZ pierwszej,
wiec pierwsza cyfra nie moze niesc informacji.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata

_PREFIX_RE = re.compile(
    r"^(?:[a-z]:/|//[^/]+/[^/]+/|/volumes/[^/]+/|/mnt/[^/]+/|/media/[^/]+/)"
    r"(?:marketing/)?",
    re.IGNORECASE,
)
# Foldery w korzeniu Marketingu (REQUIRED_ROOT_FOLDERS w local_bridge.py).
_KNOWN_TOP = ("- polska/", "-- archiwum --/", "- eksport/")

ID_DIGITS = 8
_MOD = 10 ** ID_DIGITS


def asset_key(path: str) -> str:
    """Klucz sciezki niezalezny od litery dysku / montowania / wielkosci liter."""
    p = unicodedata.normalize("NFC", str(path or "")).replace("\\", "/")
    unc = p.startswith("//")
    p = re.sub(r"/{2,}", "/", p)
    low = ("/" + p if unc else p).casefold()
    for top in _KNOWN_TOP:
        i = low.find(top)
        if i == 0 or (i > 0 and low[i - 1] == "/"):
            return low[i:].strip("/")
    m = _PREFIX_RE.match(low)
    if m:
        return low[m.end():].strip("/")
    return low.strip("/")


def _digits(key: str, attempt: int) -> int:
    raw = key if attempt == 0 else f"{key}#{attempt}"
    return int(hashlib.sha1(raw.encode("utf-8")).hexdigest()[:15], 16) % _MOD


def stable_asset_id(path: str, taken: dict | None = None) -> str:
    """br-0 + 8 cyfr. `taken` (id -> klucz) rozwiazuje rzadkie kolizje w jednym indeksie."""
    key = asset_key(path)
    attempt = 0
    while True:
        aid = "br-0%0*d" % (ID_DIGITS, _digits(key, attempt))
        if taken is None:
            return aid
        owner = taken.get(aid)
        if owner is None or owner == key:
            taken[aid] = key
            return aid
        attempt += 1


def is_stable_id(aid: str) -> bool:
    return bool(re.fullmatch(r"br-0\d{%d}" % ID_DIGITS, str(aid or "")))
