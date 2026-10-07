# -*- coding: utf-8 -*-
"""Faza 2 "jedno zrodlo prawdy": scalanie indeksu materialow jak Synology Drive.

Baza (PostgreSQL na Synology, tabela dam_assets) trzyma JEDEN wiersz na material.
Kazdy komputer z folderem Marketing (ROOT) skanuje dysk i wysyla tylko roznice;
komputer bez ROOT tylko pobiera (rev > ostatni) i buduje z tego lokalny indeks.

Modul NIE jest wpiety w aplikacje (decyzja kierownika) - to czysta logika:
- diff_scan / diff_scan_report: skan lokalny + stan z bazy -> operacje
  (upsert / tombstone / restore) z bezpiecznikami na niepelny odczyt dysku,
- apply_remote: pobrane wiersze -> nowy lokalny stan,
- warstwa PG przez przekazany obiekt polaczenia (DB-API, kursor zwraca dict jak
  RealDictCursor): ensure_schema, push_ops, pull_since.

Reguly (szczegoly i uzasadnienie: bin/docs/PLAN-jedno-zrodlo-prawdy.md, Faza 2):
1. Dodanie/zmiana: upsert, gdy mtime nowszy albo przy tym samym mtime inny rozmiar
   (remis rozstrzyga rev: wygrywa zapis, ktory znal najnowszy rev).
   Starszy mtime NIGDY nie nadpisuje nowszego (nieaktualna kopia X: nic nie cofa).
2. Usuniecie (tombstone) tylko gdy:
   - ten komputer widzial plik w swoim poprzednim skanie (last_seen) - komputer
     usuwa tylko to, co sam mial (jak klient Synology); pierwszy skan nie usuwa nic,
   - najblizszy istniejacy folder nadrzedny zostal wylistowany w calosci bez bledu
     (scanned_dirs), a zaden folder po drodze nie jest w failed_dirs,
   - wpis w bazie ma mtime <= czas skanu i <= mtime wersji, ktora ten komputer znal,
   - bezpiecznik poddrzewa: jesli w istniejacym (wylistowanym) folderze znika > 20 %
     plikow (min. SUBTREE_MIN_FILES), usuniec z tego poddrzewa nie wysylamy.
3. Przywrocenie: plik znow widziany -> deleted_at NULL. Ta sama wersja (mtime nie
   nowszy) wraca tylko, gdy "pojawila sie" na tym komputerze (nie bylo jej w
   last_seen) - nieaktualna kopia, ktora komputer mial caly czas, nie wskrzesza
   pliku usunietego gdzie indziej.
4. Komputer bez ROOT: tylko pull_since + apply_remote + live_entries.

Partia 28.09 (W2, kontrakty O / T / R z work/kierownicy/2026-09-28b/DECYZJE.md):
O. last_seen to OBSERWACJE: asset_id -> {mtime_ms, size, hash, root_gen, desc, rev}
   - wersja pliku, ktora TEN komputer widzial na dysku (observe()). Zbior id (v1)
   nadal jest przyjmowany: wpis bez wersji = "nie zaobserwowany" (nic nie usuwa,
   nie wysyla samego opisu). Pobranie wierszy z bazy nie zmienia obserwacji.
T. Tombstone tylko dla wersji zaobserwowanej przez ten komputer i tylko gdy baza
   ma DOKLADNIE te wersje (mtime_ms = obs AND size IS NOT DISTINCT FROM obs).
   Audyt 4.1: X widzial V1, M wyslal V2, V1 zniknela na X - dawniej X usuwal V2.
R. Pola relacji folderu (folder_relations.RELATION_FIELDS) nie sa porownywane ani
   wysylane ze skanu - przy zapisie przenoszone z wiersza bazy. Fakty (reszta meta,
   path_rel, name) wysylane tylko, gdy zmienila sie WLASNA obserwacja (desc), z
   base_rev z chwili tej obserwacji; rozne fakty dwoch komputerow = konflikt w
   raporcie, nie nadpisanie (audyt 4.2, ping-pong M/X).
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any, Iterable

try:
    from folder_relations import RELATION_FIELDS as _RELATION_FIELDS
except ImportError:  # pragma: no cover - modul obok, ale import nie moze wywrocic sync
    _RELATION_FIELDS = ("folder_variants", "folder_editable_files",
                        "folder_has_editable", "folder_group_id")
RELATION_FIELDS = frozenset(_RELATION_FIELDS)
CONFLICT_SAMPLE = 20

SUBTREE_SHRINK_LIMIT = 0.20   # > 20 % znikajacych plikow poddrzewa = podejrzany odczyt
SUBTREE_MIN_FILES = 10        # mniejsze poddrzewa nie sa oceniane (1 z 3 plikow to 33 %)
PUSH_COMMIT_EVERY = 500
PULL_BATCH = 2000
ADVISORY_LOCK_KEY = 736420921  # staly klucz blokady zapisow do dam_assets

OP_UPSERT = "upsert"
OP_TOMBSTONE = "tombstone"
OP_RESTORE = "restore"

ROW_FIELDS = ("asset_id", "asset_key", "path_rel", "name", "size", "mtime_ms",
              "content_hash", "meta", "deleted_at", "updated_at", "updated_by",
              "seen_by_machine", "rev")
# Etap 1a (m_columns.sql): pola dodatkowe wiersza. Lustro w SQLite to JSON, wiec nic nie
# kosztuja; normalize_row zachowuje je tylko, gdy sa w wierszu (tryb "off" ich nie pobiera).
ROW_FIELDS_M = ("origin", "master_mtime", "master_size", "author_mtime", "author_size",
                "author_by", "delete_batch")
FUTURE_MS = 300000            # data pliku nowsza od poczatku skanu o > 5 minut = "z przyszlosci"
ROLE_COPY = "copy"
ROLE_M = "m"

# --------------------------------------------------------------------------
# Klucze sciezek (zrodlo prawdy: bin/apps/web/scripts/asset_ids.py)
# --------------------------------------------------------------------------

_asset_ids_mod: Any = None


def _asset_ids() -> Any:
    """asset_ids.py z apps/web/scripts (ten sam uklad w repo i w instalacji)."""
    global _asset_ids_mod
    if _asset_ids_mod is None:
        scripts = Path(__file__).resolve().parent.parent / "web" / "scripts"
        if str(scripts) not in sys.path:
            sys.path.insert(0, str(scripts))
        import asset_ids  # noqa: PLC0415

        _asset_ids_mod = asset_ids
    return _asset_ids_mod


def key_of(path: str) -> str:
    """Klucz sciezki niezalezny od litery dysku (asset_ids.asset_key)."""
    return _asset_ids().asset_key(path)


def id_of(path: str) -> str:
    return _asset_ids().stable_asset_id(path)


def dir_key(path: str, root: str | None = None) -> str:
    """Klucz folderu dla scanned_dirs / failed_dirs. Korzen Marketingu = ''.

    Z `root` liczy sciezke wzgledna (dziala tez dla X:/Marketing, gdzie sam
    asset_key nie wie, ze 'marketing' to korzen)."""
    p = unicodedata.normalize("NFC", str(path or "")).replace("\\", "/")
    if root is not None:
        r = unicodedata.normalize("NFC", str(root)).replace("\\", "/").rstrip("/")
        if p.casefold() == r.casefold():
            return ""
        if p.casefold().startswith(r.casefold() + "/"):
            return re.sub(r"/{2,}", "/", p[len(r) + 1:]).casefold().strip("/")
    return key_of(p)


_DRIVE_PREFIX_RE = re.compile(
    r"^(?:[A-Za-z]:/+|//[^/]+/[^/]+/|/volumes/[^/]+/|/mnt/[^/]+/|/media/[^/]+/)(?:marketing/)?",
    re.IGNORECASE,
)


def scan_entry(path: str, *, size: int | None, mtime_ms: int, root: str | None = None,
               meta: dict | None = None, content_hash: str | None = None,
               asset_id: str | None = None) -> tuple[str, dict]:
    """Pomocnik dla skanera: (asset_id, wpis skanu) z bezwzglednej sciezki pliku.

    asset_id - id nadane juz przez build-branding-index (z rozwiazana kolizja
    8-cyfrowego skrotu); bez niego liczone od klucza. Klucz jest w NFC, ale
    path_rel/name zostaja w zapisie z dysku (NFD na plikach z Maca) - inaczej
    kopia bez ROOT pokazuje inna sciezke niz plik, ktory naprawde istnieje."""
    key = dir_key(path, root)
    p = str(path).replace("\\", "/")
    rel = p
    if root is not None:
        r = str(root).replace("\\", "/").rstrip("/")
        if unicodedata.normalize("NFC", p).casefold().startswith(
                unicodedata.normalize("NFC", r).casefold() + "/"):
            rel = p[len(r) + 1:]
    m = _DRIVE_PREFIX_RE.match(rel)
    if m:
        # 23.09: sciezka spoza podanego korzenia (inna litera dysku) trafiala do
        # path_rel z litera - komputery skladaly potem "M:/M:/...".
        rel = rel[m.end():]
    # Korzen nie pasowal (inny montaz / zagniezdzenie): kotwica jak w asset_ids.asset_key
    # - folder najwyzszego poziomu Marketingu, zeby path_rel i asset_key sie nie rozjechaly.
    low = rel.casefold()
    if len(low) == len(rel) and not any(low.startswith(t) for t in _asset_ids()._KNOWN_TOP):
        for top in _asset_ids()._KNOWN_TOP:
            i = low.find("/" + top)
            if i >= 0:
                rel = rel[i + 1:]
                break
    return asset_id or id_of(key), {
        "asset_key": key,
        "path_rel": rel,
        "name": p.rsplit("/", 1)[-1],
        "size": size,
        "mtime_ms": int(mtime_ms),
        "content_hash": content_hash,
        "meta": dict(meta or {}),
    }


def _parent(key: str) -> str:
    return key.rsplit("/", 1)[0] if "/" in key else ""


def _ancestors(key: str) -> list[str]:
    """Foldery nadrzedne od najblizszego do korzenia ('')."""
    out = []
    k = key
    while True:
        k = _parent(k) if k else None  # type: ignore[assignment]
        if k is None:
            break
        out.append(k)
        if k == "":
            break
    return out


def _int(v: Any, default: int = 0) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _opt_int(v: Any) -> int | None:
    try:
        return None if v is None else int(v)
    except (TypeError, ValueError):
        return None


def _now_ms() -> int:
    return int(time.time() * 1000)


# --------------------------------------------------------------------------
# Scalanie: skan -> operacje
# --------------------------------------------------------------------------

def _push_meta(entry: dict, prev: dict | None) -> dict:
    """Meta do zapisu: fakty ze skanu + pola relacji BEZ ZMIAN z wiersza bazy
    (kontrakt R). Nowy wiersz (brak prev) dostaje relacje ze skanu jako wartosc
    poczatkowa - tylko dla starszych klientow, nowi licza je z katalogu."""
    meta = dict(entry.get("meta") or {})
    if prev is None:
        return meta
    out = facts_meta(meta)
    pmeta = prev.get("meta") if isinstance(prev.get("meta"), dict) else {}
    for k in RELATION_FIELDS:
        if k in pmeta:
            out[k] = pmeta[k]
    return out


def _op(kind: str, aid: str, entry: dict, prev: dict | None, machine: str,
        scan_time_ms: int, reason: str, *, base_rev: int | None = None) -> dict:
    return {
        "op": kind,
        "reason": reason,
        "asset_id": aid,
        "asset_key": str(entry.get("asset_key") or (prev or {}).get("asset_key") or ""),
        "path_rel": str(entry.get("path_rel") or (prev or {}).get("path_rel") or ""),
        "name": str(entry.get("name") or (prev or {}).get("name") or ""),
        "size": _opt_int(entry.get("size")),
        "mtime_ms": _int(entry.get("mtime_ms")),
        "content_hash": entry.get("content_hash"),
        "meta": _push_meta(entry, prev),
        "base_rev": _int((prev or {}).get("rev")) if base_rev is None else int(base_rev),
        "base_mtime_ms": _int((prev or {}).get("mtime_ms")),
        "scan_time_ms": int(scan_time_ms),
        "machine": machine,
    }


def _content_differs(entry: dict, prev: dict) -> bool:
    # Etap 1a: pusty rozmiar po ktorejkolwiek stronie nie jest roznica (kolumna size jest dzis
    # pusta w calym katalogu; gdy skaner zacznie ja podawac, nie moze to dac 73 tys. zmian).
    s_new, s_old = _opt_int(entry.get("size")), _opt_int(prev.get("size"))
    if s_new is not None and s_old is not None and s_new != s_old:
        return True
    h_new, h_old = entry.get("content_hash"), prev.get("content_hash")
    return bool(h_new and h_old and h_new != h_old)


# Listy, w ktorych kolejnosc NIESIE znaczenie (pierwszy produkt = glowny,
# dam-branding.js) - porownywane w kolejnosci, bez sortowania.
_ORDERED_META_LISTS = frozenset({"linked_product_ids", "folder_linked_product_ids"})
_ABS_PATH_RE = re.compile(r"^(?:[A-Za-z]:[\\/]|\\\\|//|/volumes/|/mnt/|/media/)", re.IGNORECASE)
_ROOT_IN_TEXT_RE = re.compile(
    r"(?<![A-Za-z0-9])[A-Za-z]:[\\/]+(?:marketing[\\/]+)?|(?:/volumes|/mnt|/media)/[^/\s]+/(?:marketing/)?",
    re.IGNORECASE,
)


def _canonical_json(v: Any, key: str = "") -> Any:
    """Postac TYLKO do porownan: listy deterministycznie posortowane po tresci
    (poza _ORDERED_META_LISTS), a sciezki bezwzgledne sprowadzone do klucza
    wzglednego - meta folder_variants/folder_editable_files ma sciezki z litera
    dysku, wiec komputery z ROOT D: i M: widzialyby "inny opis" tego samego pliku
    na przemian (28.09, przeglad kierownika B)."""
    if isinstance(v, dict):
        return {k: _canonical_json(v[k], k) for k in sorted(v)}
    if isinstance(v, list):
        items = [_canonical_json(x, key) for x in v]
        if key in _ORDERED_META_LISTS:
            return items
        try:
            items.sort(key=lambda x: json.dumps(x, sort_keys=True, ensure_ascii=False))
        except TypeError:
            pass  # niesortowalna mieszanka typow - zostaw jak jest
        return items
    if isinstance(v, str) and _ABS_PATH_RE.match(v):
        return key_of(v)
    if isinstance(v, str) and ("/" in v or "\\" in v):
        # search_blob i podobne teksty maja sciezke z ROOT komputera, ktory budowal
        # indeks, w srodku tekstu ("... m:/- polska/..." vs "... c:/marketing/- polska/...").
        # 28.09: 33 723 falszywe operacje "meta" miedzy komputerami z roznym ROOT.
        return _ROOT_IN_TEXT_RE.sub("", v)
    return v


def normalize_meta(meta: dict | None) -> dict:
    """Kanoniczna postac meta - TYLKO do porownania (_descriptor_differs). Zapis
    zostaje w kolejnosci ze skanera: kolejnosc folder_variants (Desktop/Tablet/
    Mobile) widac w UI i musi byc taka sama z ROOT i bez ROOT.

    28.09.2026: build-branding-index sklada listy typu folder_variants /
    folder_editable_files z kolejnosci przegladu folderu (os.walk/os.scandir),
    ktora dla remisow (np. dwa pliki z ta sama etykieta "Plik") nie jest
    gwarantowana miedzy kolejnymi przebudowami indeksu. Ten sam material w
    kolko wygladal na "zmieniony opis" (reason=meta) i byl wypychany do bazy
    w kazdym cyklu, mimo ze tresc byla identyczna - tylko kolejnosc elementow
    listy sie odwracala. Sortowanie list w meta przed porownaniem usuwa te
    falszywe roznice; build-branding-index ma tez deterministyczny remis (nazwa)."""
    return _canonical_json(dict(meta or {}))


def facts_meta(meta: dict | None) -> dict:
    """Meta bez pol relacji folderu (kontrakt R) - to, co jest faktem o pliku."""
    return {k: v for k, v in dict(meta or {}).items() if k not in RELATION_FIELDS}


def fact_desc(entry: dict) -> str:
    """Skrot kanonicznych faktow wpisu skanu (kontrakt O, pole `desc`): meta bez
    relacji po normalize_meta + path_rel + name. Ten sam opis na M: i X: daje ten
    sam skrot (sciezki z ROOT sprowadzone do klucza)."""
    payload = {
        "meta": normalize_meta(facts_meta(entry.get("meta"))),
        "path_rel": str(entry.get("path_rel") or ""),
        "name": str(entry.get("name") or ""),
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def observe(entry: dict, root_gen: Any = None) -> dict:
    """Obserwacja (kontrakt O) wersji pliku widzianej na dysku przez ten komputer."""
    return {
        "mtime_ms": _int(entry.get("mtime_ms")),
        "size": _opt_int(entry.get("size")),
        "hash": entry.get("content_hash") or None,
        "root_gen": root_gen,
        "desc": fact_desc(entry),
        "rev": None,
    }


def observations(last_seen: Any) -> dict[str, dict] | None:
    """last_seen w dowolnej postaci -> asset_id -> obserwacja.

    None = pierwszy skan. Slownik (v2) = obserwacje. Zbior/lista id (v1, 2.4.5) =
    pliki obecne, ale BEZ wersji ("nie zaobserwowane"): chronia przed falszywym
    "reappeared", ale nie daja prawa do usuniecia ani do wysylki samego opisu."""
    if last_seen is None:
        return None
    if isinstance(last_seen, dict):
        return {str(k): (dict(v) if isinstance(v, dict) else {}) for k, v in last_seen.items()}
    return {str(k): {} for k in last_seen}


def _has_version(obs: dict | None) -> bool:
    return isinstance(obs, dict) and obs.get("mtime_ms") is not None


def _same_version(obs: dict, other: dict) -> bool:
    """Ta sama wersja pliku: mtime i rozmiar (plus skrot tresci, gdy oba znane)."""
    if _int(obs.get("mtime_ms")) != _int(other.get("mtime_ms")):
        return False
    if _opt_int(obs.get("size")) != _opt_int(other.get("size")):
        return False
    h1 = obs.get("hash") or obs.get("content_hash")
    h2 = other.get("hash") or other.get("content_hash")
    return not (h1 and h2 and h1 != h2)


def stamp_observed_rev(next_seen: Any, rows: dict, ids: Iterable[str]) -> Any:
    """Po cyklu: rev wiersza znany w chwili obserwacji (base_rev dla nastepnej
    zmiany opisu). Dotyczy tylko plikow zaobserwowanych w TYM skanie; zbior (v1)
    zwracany bez zmian."""
    if not isinstance(next_seen, dict):
        return next_seen
    for aid in ids:
        obs = next_seen.get(aid)
        row = rows.get(aid)
        if isinstance(obs, dict) and row is not None:
            obs["rev"] = _int(row.get("rev"))
    return next_seen


def _descriptor_differs(entry: dict, prev: dict) -> bool:
    """Ten sam plik (mtime), ale inne FAKTY opisu: meta bez pol relacji folderu
    (kontrakt R) albo zapis sciezki/nazwy. 23.09: zmiana samego meta nigdy nie
    trafiala do bazy - komputery bez ROOT zostawaly ze starym opisem na zawsze."""
    if normalize_meta(facts_meta(entry.get("meta"))) != normalize_meta(facts_meta(prev.get("meta"))):
        return True
    for f in ("path_rel", "name"):
        if entry.get(f) and str(entry.get(f)) != str(prev.get(f) or ""):
            return True
    return False


def diff_scan_report(prev_rows: dict, scan: dict, scanned_dirs: Iterable[str],
                     scan_time_ms: int, machine: str, *,
                     last_seen: Any = None,
                     failed_dirs: Iterable[str] = (),
                     confirmed_dirs: Iterable[str] = (),
                     root_gen: Any = None,
                     role: str = ROLE_COPY,
                     scan_db_ms: int | None = None,
                     skip_future: bool = False) -> dict:
    """Pelny raport scalania.

    Etap 1a: `role` = "copy" (domyslnie: reguly bez zmian, takze dla trybow off i shadow)
    albo "m" (komputer z M:, tryb on: dane z M: sa wzorcem - patrz _diff_scan_report_m).
    `scan_db_ms` = poczatek skanu na zegarze BAZY (tylko rola m). `skip_future` = pomin wpisy
    z data > 5 min w przod (rola copy w trybie on: baza i tak by je odrzucila).

    prev_rows    asset_id -> wiersz z bazy (lokalne lustro po ostatnim pull; tombstony tez)
    scan         asset_id -> wpis skanu (asset_key, path_rel, name, size, mtime_ms, meta)
    scanned_dirs klucze folderow wylistowanych w calosci bez bledu ('' = korzen)
    failed_dirs  klucze folderow, ktore istnieja, ale nie zostaly wylistowane
                 (blad, brak dostepu, wykluczenie) - nic pod nimi nie jest usuwane
    last_seen    obserwacje TEGO komputera z poprzedniego skanu (kontrakt O):
                 slownik asset_id -> observe(); zbior id (v1) = bez wersji;
                 None = pierwszy skan -> zero usuniec
    confirmed_dirs klucze folderow, ktore admin potwierdzil jako prawdziwe usuniecie -
                 pliki pod nimi NIE podlegaja bezpiecznikowi poddrzewa (pkt 3 nizej).
                 Pozostale warunki usuniecia (last_seen, scanned_dirs, mtime) nadal
                 obowiazuja. Domyslnie puste = zachowanie bez zmian.
    root_gen     generacja/ROOT biezacego skanu (kontrakt G) - obserwacja z inna
                 generacja nie daje prawa do usuniecia ani do wysylki opisu.

    Zwraca {"ops", "blocked": {folder: liczba}, "skipped_unlisted", "stale_ignored",
            "meta_held", "conflicts", "conflict_sample", "tombstone_version_mismatch",
            "unobserved_missing", "next_last_seen" (slownik obserwacji)}.
    """
    if role == ROLE_M:
        return _diff_scan_report_m(prev_rows, scan, scanned_dirs, scan_time_ms, machine,
                                   last_seen=last_seen, failed_dirs=failed_dirs,
                                   root_gen=root_gen, scan_db_ms=scan_db_ms)
    listed = {str(d) for d in scanned_dirs}
    failed = {str(d) for d in failed_dirs}
    confirmed = {str(d) for d in confirmed_dirs}
    obs_before = observations(last_seen)
    seen_before = None if obs_before is None else set(obs_before)
    ops: list[dict] = []
    stale_ignored = 0
    future_skipped = 0
    meta_held = 0
    conflict_sample: list[dict] = []
    next_seen: dict[str, dict] = {}

    def obs_ok(obs: dict | None) -> bool:
        return _has_version(obs) and obs.get("root_gen") == root_gen

    # 1) pliki widziane w skanie: dodanie / zmiana / przywrocenie
    for aid in sorted(scan):
        entry = scan[aid] or {}
        prev = prev_rows.get(aid)
        mt = _int(entry.get("mtime_ms"))
        if skip_future and mt > int(scan_time_ms) + FUTURE_MS:
            future_skipped += 1   # etap 1a: baza (tryb on) odrzuca date z przyszlosci od kopii
            continue
        next_seen[aid] = observe(entry, root_gen)
        if prev is None:
            ops.append(_op(OP_UPSERT, aid, entry, None, machine, scan_time_ms, "add"))
            continue
        pmt = _int(prev.get("mtime_ms"))
        if prev.get("deleted_at") is not None:
            if mt > pmt or (mt == pmt and _content_differs(entry, prev)):
                ops.append(_op(OP_UPSERT, aid, entry, prev, machine, scan_time_ms, "recreate"))
            elif (seen_before is not None and aid not in seen_before
                  and _same_version(next_seen[aid], prev)):
                # Tylko TA SAMA wersja, ktora usunieto (np. z Kosza). Starsza kopia
                # (mtime < usunietej) nigdy nie wskrzesza tombstone (audyt 4.1).
                ops.append(_op(OP_RESTORE, aid, entry, prev, machine, scan_time_ms, "reappeared"))
            else:
                stale_ignored += 1  # nieaktualna kopia, ktora komputer mial caly czas
            continue
        if mt > pmt or (mt == pmt and _content_differs(entry, prev)):
            ops.append(_op(OP_UPSERT, aid, entry, prev, machine, scan_time_ms, "change"))
        elif mt == pmt and _descriptor_differs(entry, prev):
            obs = (obs_before or {}).get(aid)
            own_changed = (obs_ok(obs) and obs.get("desc")
                           and _same_version(obs, next_seen[aid])
                           and obs["desc"] != next_seen[aid]["desc"])
            if own_changed:
                base = obs.get("rev")
                ops.append(_op(OP_UPSERT, aid, entry, prev, machine, scan_time_ms, "meta",
                               base_rev=_int(prev.get("rev")) if base is None else _int(base)))
            else:
                # Opis w bazie inny niz nasz, a nasza obserwacja sie nie zmienila
                # (albo to pierwsza obserwacja tej wersji / pierwszy cykl po
                # migracji): konflikt do raportu, nie nadpisanie.
                meta_held += 1
                if len(conflict_sample) < CONFLICT_SAMPLE:
                    conflict_sample.append({
                        "asset_id": aid, "path_rel": str(prev.get("path_rel") or ""),
                        "db_updated_by": str(prev.get("updated_by") or ""),
                        "db_rev": _int(prev.get("rev")),
                        "why": "unchanged_observation" if obs_ok(obs) and obs.get("desc")
                        and _same_version(obs, next_seen[aid]) else "first_observation",
                    })
        elif mt < pmt:
            stale_ignored += 1  # starsza wersja (np. X: jeszcze nie zsynchronizowany)

    # 2) kandydaci do usuniecia
    candidates: list[str] = []
    skipped_unlisted = 0
    version_mismatch = 0
    unobserved_missing = 0
    keep_seen: set[str] = set()
    if obs_before is not None:
        for aid in obs_before:
            if aid in scan:
                continue
            prev = prev_rows.get(aid)
            if prev is None or prev.get("deleted_at") is not None:
                continue  # juz usuniety (albo nieznany) - nic do roboty
            key = str(prev.get("asset_key") or "")
            ok = False
            for anc in _ancestors(key):
                if anc in failed:
                    break
                if anc in listed:
                    ok = True
                    break
            if not ok:
                skipped_unlisted += 1
                keep_seen.add(aid)
                continue
            obs = obs_before[aid]
            if not obs_ok(obs):
                # v1 (bez wersji) albo inna generacja ROOT: nie wiemy, JAKA wersje
                # ten komputer mial - zadnego usuniecia (kontrakt O).
                unobserved_missing += 1
                keep_seen.add(aid)
                continue
            if not _same_version(obs, prev):
                # Baza ma inna wersje niz ta, ktora znikla z dysku (np. V2 z M,
                # a tu zniknela V1 w trakcie synchronizacji) - to nie jest
                # usuniecie tej wersji (kontrakt T, audyt 4.1).
                version_mismatch += 1
                continue
            pmt = _int(prev.get("mtime_ms"))
            if pmt > int(scan_time_ms):
                keep_seen.add(aid)
                continue
            candidates.append(aid)

    # 3) bezpiecznik poddrzew: tylko foldery, ktore istnieja (zostaly wylistowane)
    blocked: dict[str, int] = {}
    if candidates:
        live_under: dict[str, int] = {}
        for aid, row in prev_rows.items():
            if row.get("deleted_at") is not None:
                continue
            if seen_before is not None and aid not in seen_before:
                continue  # oceniamy tylko pliki, ktore ten komputer mial
            for anc in _ancestors(str(row.get("asset_key") or "")):
                if anc in listed:
                    live_under[anc] = live_under.get(anc, 0) + 1
        gone_under: dict[str, int] = {}
        for aid in candidates:
            for anc in _ancestors(str(prev_rows[aid].get("asset_key") or "")):
                if anc in listed:
                    gone_under[anc] = gone_under.get(anc, 0) + 1
        bad = {d for d, gone in gone_under.items()
               if live_under.get(d, 0) >= SUBTREE_MIN_FILES
               and gone / live_under[d] > SUBTREE_SHRINK_LIMIT}
        for aid in candidates:
            prev = prev_rows[aid]
            ancestors = _ancestors(str(prev.get("asset_key") or ""))
            if not any(a in confirmed for a in ancestors):
                hit = [a for a in ancestors if a in bad]
                if hit:
                    top = hit[-1]  # najwyzszy podejrzany folder - czytelniej w raporcie
                    blocked[top] = blocked.get(top, 0) + 1
                    keep_seen.add(aid)
                    continue
            obs = obs_before[aid]  # type: ignore[index]
            ops.append(_op(OP_TOMBSTONE, aid, {}, prev, machine, scan_time_ms, "missing"))
            ops[-1]["mtime_ms"] = _int(prev.get("mtime_ms"))
            ops[-1]["size"] = _opt_int(prev.get("size"))
            ops[-1]["obs_mtime_ms"] = _int(obs.get("mtime_ms"))
            ops[-1]["obs_size"] = _opt_int(obs.get("size"))

    for aid in keep_seen:
        next_seen[aid] = dict(obs_before[aid])  # type: ignore[index]
    return {"ops": ops, "blocked": blocked, "skipped_unlisted": skipped_unlisted,
            "stale_ignored": stale_ignored, "meta_held": meta_held,
            "conflicts": meta_held, "conflict_sample": conflict_sample,
            "tombstone_version_mismatch": version_mismatch,
            "unobserved_missing": unobserved_missing,
            "future_skipped": future_skipped,
            "next_last_seen": next_seen}


def _row_version(prev: dict) -> int:
    """Wersja pliku na M: zapamietana w wierszu: master_mtime (surowa data z dysku), a dla wiersza
    sprzed etapu 1a, ktorego nikt jeszcze nie potwierdzil na M:, mtime_ms."""
    mm = prev.get("master_mtime")
    return _int(mm) if mm is not None else _int(prev.get("mtime_ms"))


def _op_m(aid: str, entry: dict, prev: dict | None, machine: str, scan_time_ms: int,
          scan_db_ms: int, reason: str, *, base_rev: int | None = None) -> dict:
    """Operacja komputera z M: (instrukcja M1). Data z przyszlosci (> 5 min po poczatku skanu):
    w mtime_ms czas poczatku skanu, w master_mtime surowa data z dysku (spec 3.4)."""
    raw = _int(entry.get("mtime_ms"))
    op = _op(OP_UPSERT, aid, entry, prev, machine, scan_time_ms, reason, base_rev=base_rev)
    op["role"] = ROLE_M
    op["master_mtime"] = raw
    op["scan_db_ms"] = int(scan_db_ms)
    if raw > int(scan_time_ms) + FUTURE_MS:
        op["mtime_ms"] = int(scan_time_ms)
        op["future_clipped"] = True
    return op


def _diff_scan_report_m(prev_rows: dict, scan: dict, scanned_dirs: Iterable[str],
                        scan_time_ms: int, machine: str, *, last_seen: Any = None,
                        failed_dirs: Iterable[str] = (), root_gen: Any = None,
                        scan_db_ms: int | None = None) -> dict:
    """Raport scalania dla komputera z M: w trybie `on` (etap 1a, spec 3.2-3.5).

    To, co jest na M:, jest wzorcem: starsza data tez jest zmiana, plik ze znacznikiem usuniecia
    wraca zawsze, a pamiec "co widzialem" jest w bazie (kolumna origin), nie w obserwacjach tego
    komputera. Nie ma bezpiecznika poddrzew (zastepuja go wstrzymanie, kanarki, swiadek i hamulec
    partii w asset_sync_m). Zwraca te same klucze co wersja dla kopii oraz:
      stamp    [(asset_id, mtime_ms wiersza, rozmiar)] pliki w skanie w tej samej wersji, ktorych
               wiersz nie ma jeszcze origin = 'm' (instrukcja M2)
      missing  [asset_id] zywe wiersze origin = 'm' nieobecne w skanie, z wylistowanym przodkiem
               (instrukcja M3, pierwsze sprawdzenie)
    Wiersze sprzed 1a (origin puste), ktorych nie ma w skanie, NIE trafiaja do `missing`:
    rozstrzyga je tylko narzedzie uzgodnienia (decyzja P1)."""
    listed = {str(d) for d in scanned_dirs}
    failed = {str(d) for d in failed_dirs}
    obs_before = observations(last_seen)
    scan_db = int(scan_time_ms if scan_db_ms is None else scan_db_ms)
    ops: list[dict] = []
    stamp: list[tuple] = []
    missing: list[str] = []
    meta_held = 0
    future_clipped = 0
    conflict_sample: list[dict] = []
    next_seen: dict[str, dict] = {}

    def obs_ok(obs: dict | None) -> bool:
        return _has_version(obs) and obs.get("root_gen") == root_gen

    for aid in sorted(scan):
        entry = scan[aid] or {}
        prev = prev_rows.get(aid)
        raw = _int(entry.get("mtime_ms"))
        next_seen[aid] = observe(entry, root_gen)
        if raw > int(scan_time_ms) + FUTURE_MS:
            future_clipped += 1
        if prev is None:
            ops.append(_op_m(aid, entry, None, machine, scan_time_ms, scan_db, "add"))
            continue
        if prev.get("deleted_at") is not None:
            ops.append(_op_m(aid, entry, prev, machine, scan_time_ms, scan_db, "returned"))
            continue
        if raw != _row_version(prev) or _content_differs(entry, prev):
            ops.append(_op_m(aid, entry, prev, machine, scan_time_ms, scan_db, "change"))
            continue
        if _descriptor_differs(entry, prev):
            obs = (obs_before or {}).get(aid)
            own_changed = (obs_ok(obs) and obs.get("desc")
                           and _same_version(obs, next_seen[aid])
                           and obs["desc"] != next_seen[aid]["desc"])
            if own_changed:
                base = obs.get("rev")
                ops.append(_op_m(aid, entry, prev, machine, scan_time_ms, scan_db, "meta",
                                 base_rev=_int(prev.get("rev")) if base is None else _int(base)))
                continue
            meta_held += 1
            if len(conflict_sample) < CONFLICT_SAMPLE:
                conflict_sample.append({
                    "asset_id": aid, "path_rel": str(prev.get("path_rel") or ""),
                    "db_updated_by": str(prev.get("updated_by") or ""),
                    "db_rev": _int(prev.get("rev")),
                    "why": "unchanged_observation" if obs_ok(obs) and obs.get("desc")
                    and _same_version(obs, next_seen[aid]) else "first_observation",
                })
        if prev.get("origin") != "m":
            stamp.append((aid, _int(prev.get("mtime_ms")), _opt_int(entry.get("size"))))

    skipped_unlisted = 0
    for aid, prev in prev_rows.items():
        if aid in scan or prev.get("deleted_at") is not None or prev.get("origin") != "m":
            continue
        ok = False
        for anc in _ancestors(str(prev.get("asset_key") or "")):
            if anc in failed:
                break
            if anc in listed:
                ok = True
                break
        if ok:
            missing.append(aid)
        else:
            skipped_unlisted += 1
    missing.sort()
    return {"ops": ops, "blocked": {}, "skipped_unlisted": skipped_unlisted,
            "stale_ignored": 0, "meta_held": meta_held,
            "conflicts": meta_held, "conflict_sample": conflict_sample,
            "tombstone_version_mismatch": 0, "unobserved_missing": 0,
            "future_clipped": future_clipped, "future_skipped": 0,
            "stamp": stamp, "missing": missing,
            "next_last_seen": next_seen}


def diff_scan(prev_rows: dict, scan: dict, scanned_dirs: Iterable[str], scan_time_ms: int,
              machine: str, *, last_seen: Iterable[str] | None = None,
              failed_dirs: Iterable[str] = (), confirmed_dirs: Iterable[str] = ()) -> list[dict]:
    """Lista operacji (upsert / tombstone / restore) - patrz diff_scan_report."""
    return diff_scan_report(prev_rows, scan, scanned_dirs, scan_time_ms, machine,
                            last_seen=last_seen, failed_dirs=failed_dirs,
                            confirmed_dirs=confirmed_dirs)["ops"]


# --------------------------------------------------------------------------
# Lokalny stan z bazy
# --------------------------------------------------------------------------

def normalize_row(row: Any) -> dict:
    """Wiersz z PG (dict / RealDictRow) -> zwykly dict; meta zawsze dict."""
    d = {k: (row.get(k) if hasattr(row, "get") else None) for k in ROW_FIELDS}
    meta = d.get("meta")
    if isinstance(meta, (str, bytes)):
        try:
            meta = json.loads(meta)
        except ValueError:
            meta = {}
    d["meta"] = meta if isinstance(meta, dict) else {}
    d["rev"] = _int(d.get("rev"))
    d["mtime_ms"] = _int(d.get("mtime_ms"))
    d["size"] = _opt_int(d.get("size"))
    d["deleted_at"] = _opt_int(d.get("deleted_at"))
    for k in ROW_FIELDS_M:
        if hasattr(row, "keys") and k in row.keys():
            v = row.get(k)
            d[k] = _opt_int(v) if k in ("master_mtime", "master_size", "author_mtime", "author_size") else v
    return d


def apply_remote(local_rows: dict, remote_rows: Iterable[Any]) -> dict:
    """Nowy lokalny stan: wiersz z bazy zastepuje lokalny, gdy ma wiekszy rev.

    Tombstony zostaja w stanie (diff_scan musi wiedziec, ze plik usunieto);
    do budowy indeksu sluzy live_entries(). Wejscie nie jest modyfikowane."""
    out = dict(local_rows)
    for raw in remote_rows or ():
        try:
            row = normalize_row(raw)
        except Exception:  # noqa: BLE001 - uszkodzony wiersz nie psuje reszty
            continue
        aid = row.get("asset_id")
        if not aid:
            continue
        mine = out.get(aid)
        if mine is None or _int(mine.get("rev")) < row["rev"]:
            out[aid] = row
    return out


def max_rev(rows: dict) -> int:
    return max((_int(r.get("rev")) for r in rows.values()), default=0)


def local_path(rel: str, root: str | None) -> str:
    """Sciezka wzgledna z katalogu -> sciezka z ROOT tego komputera."""
    base = None if root is None else str(root).replace("\\", "/").rstrip("/")
    return f"{base}/{rel}" if base is not None else str(rel)


def live_entries(rows: dict, root: str | None = None) -> list[dict]:
    """Wpisy do lokalnego branding-index (bez usunietych), posortowane po kluczu."""
    out = []
    for aid in sorted(rows, key=lambda a: str(rows[a].get("asset_key") or "")):
        r = rows[aid]
        if r.get("deleted_at") is not None:
            continue
        e = dict(r.get("meta") or {})
        rel = str(r.get("path_rel") or r.get("asset_key") or "")
        e.update({
            "id": aid,
            "path": local_path(rel, root),
            "name": r.get("name") or rel.rsplit("/", 1)[-1],
            "mtime_ms": r.get("mtime_ms"),
        })
        # "size" w branding-index to etykieta wizki ("L", "S_SKLEP") z meta -
        # kolumna bajtow jej nie nadpisuje (23.09: 2129 wizek bez rozmiaru).
        if r.get("size") is not None:
            e["size_bytes"] = r.get("size")
        if e.get("size") is None:
            e["size"] = r.get("size")
        out.append(e)
    return out


# --------------------------------------------------------------------------
# PostgreSQL (polaczenie przekazywane z zewnatrz: pg_db.connect() w aplikacji,
# atrapa w testach). Placeholdery %s, kursor zwraca dict (RealDictCursor).
# --------------------------------------------------------------------------

PG_DDL = """
CREATE SEQUENCE IF NOT EXISTS dam_assets_rev_seq;
CREATE TABLE IF NOT EXISTS dam_assets (
  asset_id TEXT PRIMARY KEY,
  asset_key TEXT NOT NULL,
  path_rel TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  size BIGINT,
  mtime_ms BIGINT NOT NULL DEFAULT 0,
  content_hash TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at BIGINT,
  updated_at BIGINT NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT '',
  seen_by_machine TEXT NOT NULL DEFAULT '',
  rev BIGINT NOT NULL DEFAULT nextval('dam_assets_rev_seq')
);
CREATE UNIQUE INDEX IF NOT EXISTS dam_assets_key_idx ON dam_assets (asset_key);
CREATE INDEX IF NOT EXISTS dam_assets_rev_idx ON dam_assets (rev);
"""

_SQL_LOCK = "SELECT pg_advisory_xact_lock(%s)"

# Dodanie / zmiana / odtworzenie nowsza wersja. Starszy mtime nigdy nie wygrywa;
# remis mtime z inna trescia -> wygrywa zapis, ktory znal najnowszy rev (base_rev).
_SQL_UPSERT = """
INSERT INTO dam_assets AS t
  (asset_id, asset_key, path_rel, name, size, mtime_ms, content_hash, meta,
   deleted_at, updated_at, updated_by, seen_by_machine, rev)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, NULL, %s, %s, %s, nextval('dam_assets_rev_seq'))
ON CONFLICT (asset_id) DO UPDATE SET
  asset_key = EXCLUDED.asset_key, path_rel = EXCLUDED.path_rel, name = EXCLUDED.name,
  size = EXCLUDED.size, mtime_ms = EXCLUDED.mtime_ms, content_hash = EXCLUDED.content_hash,
  meta = EXCLUDED.meta, deleted_at = NULL, updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by, seen_by_machine = EXCLUDED.seen_by_machine,
  rev = nextval('dam_assets_rev_seq')
WHERE EXCLUDED.mtime_ms > t.mtime_ms
   OR (EXCLUDED.mtime_ms = t.mtime_ms
       AND (EXCLUDED.size IS DISTINCT FROM t.size
            OR EXCLUDED.content_hash IS DISTINCT FROM t.content_hash
            OR EXCLUDED.meta IS DISTINCT FROM t.meta
            OR EXCLUDED.path_rel IS DISTINCT FROM t.path_rel
            OR EXCLUDED.name IS DISTINCT FROM t.name
            OR t.deleted_at IS NOT NULL)
       AND t.rev <= %s)
RETURNING rev
"""

# Usuniecie (kontrakt T): tylko gdy w bazie jest DOKLADNIE ta wersja, ktora ten
# komputer zaobserwowal na dysku (mtime i rozmiar), i nie nowsza niz czas skanu.
# Dawniej "mtime_ms <= znany" - V2 pobrana z bazy przechodzila jak V1 (audyt 4.1).
_SQL_TOMBSTONE = """
UPDATE dam_assets SET deleted_at = %s, updated_at = %s, updated_by = %s,
  seen_by_machine = %s, rev = nextval('dam_assets_rev_seq')
WHERE asset_id = %s AND deleted_at IS NULL
  AND mtime_ms = %s AND size IS NOT DISTINCT FROM %s AND mtime_ms <= %s
RETURNING rev
"""

# Przywrocenie tej samej (lub starszej) wersji: tylko usuniecie sprzed skanu i tylko
# gdy tombstone w bazie to ten sam, ktory komputer znal (nikt w miedzyczasie nie
# zapisal nowszej wersji).
_SQL_RESTORE = """
UPDATE dam_assets SET deleted_at = NULL, path_rel = %s, name = %s, size = %s,
  mtime_ms = %s, content_hash = %s, meta = %s::jsonb, updated_at = %s, updated_by = %s,
  seen_by_machine = %s, rev = nextval('dam_assets_rev_seq')
WHERE asset_id = %s AND deleted_at IS NOT NULL AND deleted_at <= %s AND rev <= %s
RETURNING rev
"""

_SQL_PULL = """
SELECT asset_id, asset_key, path_rel, name, size, mtime_ms, content_hash, meta,
       deleted_at, updated_at, updated_by, seen_by_machine, rev
FROM dam_assets WHERE rev > %s ORDER BY rev LIMIT %s
"""

# Etap 1a (M11): to samo + pola z m_columns.sql. Uzywane tylko gdy m_rules.mode <> 'off' i kolumny
# istnieja - nowy klient wobec starej bazy nie pyta o nieistniejace kolumny.
_SQL_PULL_M = """
SELECT asset_id, asset_key, path_rel, name, size, mtime_ms, content_hash, meta,
       deleted_at, updated_at, updated_by, seen_by_machine, rev,
       origin, master_mtime, master_size, author_mtime, author_size, author_by, delete_batch
FROM dam_assets WHERE rev > %s ORDER BY rev LIMIT %s
"""


def ensure_schema(pg) -> dict:
    try:
        cur = pg.cursor()
        cur.execute(PG_DDL)
        pg.commit()
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001 - offline / brak uprawnien to normalny stan
        _rollback(pg)
        return {"ok": False, "error": str(exc)[:300]}


def _rollback(pg) -> None:
    try:
        pg.rollback()
    except Exception:  # noqa: BLE001
        pass


def _first_rev(cur) -> int | None:
    row = cur.fetchone()
    if not row:
        return None
    return _int(row["rev"] if hasattr(row, "keys") else row[0])


def _exec_op(cur, op: dict, now_ms: int) -> int | None:
    kind = op.get("op")
    machine = str(op.get("machine") or "")
    meta = json.dumps(op.get("meta") or {}, ensure_ascii=False, sort_keys=True)
    if kind == OP_UPSERT and op.get("role") == ROLE_M:
        import asset_sync_m  # noqa: PLC0415 - leniwie: asset_sync_m importuje ten modul

        return asset_sync_m.exec_m1(cur, op)
    if kind == OP_UPSERT:
        cur.execute(_SQL_UPSERT, (
            op["asset_id"], op["asset_key"], op.get("path_rel") or "", op.get("name") or "",
            op.get("size"), _int(op.get("mtime_ms")), op.get("content_hash"), meta,
            now_ms, machine, machine, _int(op.get("base_rev")),
        ))
        return _first_rev(cur)
    if kind == OP_TOMBSTONE:
        scan_ms = _int(op.get("scan_time_ms"))
        obs_mtime = op["obs_mtime_ms"] if "obs_mtime_ms" in op else op.get("base_mtime_ms")
        obs_size = op["obs_size"] if "obs_size" in op else op.get("size")
        cur.execute(_SQL_TOMBSTONE, (
            scan_ms, now_ms, machine, machine, op["asset_id"],
            _int(obs_mtime), _opt_int(obs_size), scan_ms,
        ))
        return _first_rev(cur)
    if kind == OP_RESTORE:
        cur.execute(_SQL_RESTORE, (
            op.get("path_rel") or "", op.get("name") or "", op.get("size"),
            _int(op.get("mtime_ms")), op.get("content_hash"), meta, now_ms, machine, machine,
            op["asset_id"], _int(op.get("scan_time_ms")), _int(op.get("base_rev")),
        ))
        return _first_rev(cur)
    raise ValueError(f"nieznana operacja: {kind!r}")  # blad programisty


try:  # bez psycopg2 (testy z atrapa SQLite) bledy "danych" to tylko ValueError / UnicodeError
    import psycopg2 as _psycopg2

    _DATA_ERRORS: tuple = (_psycopg2.DataError, _psycopg2.IntegrityError, ValueError, UnicodeError)
    _INTEGRITY_ERRORS: tuple = (_psycopg2.IntegrityError,)
except ImportError:  # pragma: no cover
    _DATA_ERRORS = (ValueError, UnicodeError)
    _INTEGRITY_ERRORS = ()

LOCK_TIMEOUT = "30s"


def _classify(exc: BaseException) -> str:
    """Krotki powod odrzucenia jednej operacji (do raportu cyklu)."""
    if _INTEGRITY_ERRORS and isinstance(exc, _INTEGRITY_ERRORS):
        return "key_collision" if "dam_assets_key_idx" in str(exc) else "integrity"
    if isinstance(exc, UnicodeError) or isinstance(exc, ValueError):
        return "bad_value"
    return "data_error"


def begin_write(cur, writer: str | None = None, *, lock: bool = True) -> None:
    """Poczatek transakcji zapisu do dam_assets. Z `writer` (nowy klient, tryb <> off): limit
    czekania na blokade i znacznik roli dla wyzwalacza (TRZECI ARGUMENT true = zmienna lokalna
    dla transakcji; z false rola zostalaby do konca polaczenia). Bez `writer` jak w 2.6.0."""
    if writer:
        cur.execute("SET LOCAL lock_timeout = '" + LOCK_TIMEOUT + "'")
        cur.execute("SELECT set_config('dam.writer', %s, true)", (writer,))
    if lock:
        cur.execute(_SQL_LOCK, (ADVISORY_LOCK_KEY,))


def push_ops(pg, ops: list[dict], *, now_ms: int | None = None, writer: str | None = None) -> dict:
    """Wyslij operacje. Zapisy serializowane blokada doradcza, zeby rev rosly w
    kolejnosci commitow (pull_since 'rev > ostatni' niczego nie gubi).

    Etap 1a (spec 6): kazda operacja w osobnym SAVEPOINT. Zla (blad danych: znak zerowy w nazwie,
    kolizja klucza) trafia do raportu i NIE wycofuje paczki. Blad polaczenia przerywa paczke jak dotad.
    `writer` ('HOST:m1' / 'HOST:c1') ustawia role zapisu dla wyzwalacza bazy.

    Zwraca {"ok", "applied", "refused", "failed", "errors", "results": [{asset_id, op, applied,
    rev, error?}]}. Odrzucone = baza ma nowsza wersje; nastepny pull_since ja przyniesie."""
    for op in ops:  # bledy programisty zglaszamy przed dotknieciem bazy
        if op.get("op") not in (OP_UPSERT, OP_TOMBSTONE, OP_RESTORE) or not op.get("asset_id"):
            raise ValueError(f"zla operacja: {op!r}")
    stamp = _now_ms() if now_ms is None else int(now_ms)
    results: list[dict] = []
    errors: list[dict] = []
    applied = refused = failed = committed = 0
    try:
        cur = pg.cursor()
        for i, op in enumerate(ops):
            if i % PUSH_COMMIT_EVERY == 0:
                if i:
                    pg.commit()
                    committed = len(results)
                begin_write(cur, writer)
            cur.execute("SAVEPOINT dam_op")
            try:
                rev = _exec_op(cur, op, stamp)
                cur.execute("RELEASE SAVEPOINT dam_op")
            except _DATA_ERRORS as exc:  # dane, nie polaczenie
                cur.execute("ROLLBACK TO SAVEPOINT dam_op")
                err = {"asset_id": op["asset_id"], "op": op["op"], "applied": False, "rev": None,
                       "error": _classify(exc), "detail": str(exc).splitlines()[0][:200] if str(exc) else ""}
                results.append(err)
                errors.append(err)
                failed += 1
                continue
            ok = rev is not None
            applied += int(ok)
            refused += int(not ok)
            results.append({"asset_id": op["asset_id"], "op": op["op"], "applied": ok, "rev": rev})
        pg.commit()
    except Exception as exc:  # noqa: BLE001 - siec / baza: raport, nie wyjatek
        _rollback(pg)
        kept = results[:committed]  # tylko to, co naprawde zatwierdzono
        return {"ok": False, "error": str(exc)[:300],
                "applied": sum(1 for r in kept if r["applied"]),
                "refused": sum(1 for r in kept if not r["applied"] and not r.get("error")),
                "failed": sum(1 for r in kept if r.get("error")),
                "errors": [r for r in kept if r.get("error")][:20], "results": kept}
    return {"ok": True, "applied": applied, "refused": refused, "failed": failed,
            "errors": errors[:20], "results": results}


def pull_since(pg, rev: int, *, limit: int = PULL_BATCH, sql: str | None = None) -> dict:
    """Wiersze z rev > `rev` (paczkami). Zwraca {"ok", "rows", "max_rev", "more"}.
    `sql` = _SQL_PULL_M, gdy etap 1a jest wlaczony (tryb <> off); domyslnie _SQL_PULL."""
    last = _int(rev)
    query = sql or _SQL_PULL
    rows: list[dict] = []
    try:
        cur = pg.cursor()
        while True:
            cur.execute(query, (last, int(limit)))
            batch = cur.fetchall()
            for r in batch:
                row = normalize_row(r)
                rows.append(row)
                last = max(last, row["rev"])
            if len(batch) < int(limit):
                break
        pg.commit()
    except Exception as exc:  # noqa: BLE001
        _rollback(pg)
        return {"ok": False, "error": str(exc)[:300], "rows": rows, "max_rev": last, "more": True}
    return {"ok": True, "rows": rows, "max_rev": last, "more": False}


def _copy_seen(last_seen: Any) -> Any:
    """Kopia last_seen w tej samej postaci (slownik obserwacji albo zbior id v1)."""
    if last_seen is None:
        return None
    if isinstance(last_seen, dict):
        return {k: (dict(v) if isinstance(v, dict) else v) for k, v in last_seen.items()}
    return set(last_seen)


def sync_cycle(pg, local_rows: dict, *, scan: dict | None = None,
               scanned_dirs: Iterable[str] = (), failed_dirs: Iterable[str] = (),
               confirmed_dirs: Iterable[str] = (),
               last_seen: Any = None, scan_time_ms: int = 0,
               machine: str = "", now_ms: int | None = None,
               root_gen: Any = None,
               role: str = ROLE_COPY, m_mode: str = "off", writer: str | None = None,
               scan_db_ms: int | None = None, pull_sql: str | None = None) -> dict:
    """Jeden cykl jak klient Synology: pull -> (diff -> push -> pull).

    scan=None -> komputer bez ROOT: tylko pobiera. Zwraca {"ok", "rows",
    "report", "push", "next_last_seen"}; przy bledzie sieci rows = stan po tym,
    co zdazylo przyjsc, a last_seen sie nie zmienia. next_last_seen po udanym
    cyklu ze skanem = slownik obserwacji (kontrakt O) z rev z chwili obserwacji.

    Etap 1a: `role` "m" + `m_mode` "on" = reguly komputera z M: (M1 + stempel M2 + "brakuje od" M3);
    "m" + "shadow" = stare reguly usuwania i stare instrukcje, ale ze zmienna roli, oraz stempel i
    "brakuje od" do nowych kolumn (usuniec wg nowych regul nie wykonuje); "copy" + "on" odrzuca
    daty z przyszlosci po stronie klienta. `writer` = 'HOST:m1' / 'HOST:c1'. Domyslnie (m_mode
    "off") cykl jest dokladnie tym z 2.6.0, poza izolacja operacji w push_ops."""
    rows = dict(local_rows)
    first = pull_since(pg, max_rev(rows), sql=pull_sql)
    rows = apply_remote(rows, first["rows"])
    out: dict[str, Any] = {"ok": first["ok"], "rows": rows, "report": None, "push": None,
                           "next_last_seen": _copy_seen(last_seen)}
    if not first["ok"]:
        out["error"] = first.get("error", "")
        return out
    if scan is None:
        return out
    m_diff = role == ROLE_M and m_mode == "on"
    report = diff_scan_report(rows, scan, scanned_dirs, scan_time_ms, machine,
                              last_seen=last_seen, failed_dirs=failed_dirs,
                              confirmed_dirs=confirmed_dirs, root_gen=root_gen,
                              role=ROLE_M if m_diff else ROLE_COPY, scan_db_ms=scan_db_ms,
                              skip_future=(role == ROLE_COPY and m_mode == "on"))
    lists = report
    if role == ROLE_M and not m_diff and m_mode != "off":   # shadow: listy z reguly komputera z M:
        lists = _diff_scan_report_m(rows, scan, scanned_dirs, scan_time_ms, machine,
                                    last_seen=last_seen, failed_dirs=failed_dirs,
                                    root_gen=root_gen, scan_db_ms=scan_db_ms)
    out["report"] = {k: v for k, v in report.items() if k not in ("next_last_seen", "stamp", "missing")}
    pushed = push_ops(pg, report["ops"], now_ms=now_ms, writer=writer)
    out["push"] = pushed
    stamped_ids: list[str] = []
    if role == ROLE_M and m_mode != "off" and pushed["ok"]:
        import asset_sync_m  # noqa: PLC0415

        st = asset_sync_m.stamp_and_mark(
            pg, writer, lists.get("stamp") or [], lists.get("missing") or [],
            int(scan_time_ms if scan_db_ms is None else scan_db_ms))
        out["m"] = st
        stamped_ids = st.get("stamped_ok_ids") or []
    second = pull_since(pg, max_rev(rows), sql=pull_sql)
    out["rows"] = apply_remote(rows, second["rows"])
    for aid in stamped_ids:   # wiersz sprzed 1a -> 'm' bez nowego rev: lustro dopisuje to samo, co baza
        r = out["rows"].get(aid)
        if r is not None and r.get("origin") != "m" and _int(r.get("rev")) == _int(rows.get(aid, {}).get("rev")):
            out["rows"][aid] = {**r, "origin": "m", "master_mtime": r.get("mtime_ms")}
    out["ok"] = bool(pushed["ok"] and second["ok"])
    if out["ok"]:
        out["next_last_seen"] = stamp_observed_rev(report["next_last_seen"], out["rows"], scan)
    else:
        out["error"] = pushed.get("error") or second.get("error", "")
    return out
