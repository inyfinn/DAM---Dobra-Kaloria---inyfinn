"""
DAM ETA - lifecycle status F / X / D na folderach produktu i wariantu.

- F = aktualny / skonczony
- X = nieaktualny / archiwalny (przeniesienie do — ARCHIWUM z zachowaniem struktury produktu)
- D = demo / prototyp / szkic
- clear / none = bez literki

Historia: kazda zmiana zapisuje previous_name + previous_path (+ docelowe).
"""
from __future__ import annotations

import json
import re
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

STATUS_LETTER = {
    "aktualne": "F",
    "nieaktualne": "X",
    "demo": "D",
    "f": "F",
    "x": "X",
    "d": "D",
}
LETTER_STATUS = {"F": "aktualne", "X": "nieaktualne", "D": "demo"}
SUFFIX_RE = re.compile(r"\s+-\s+([FXD])$", re.IGNORECASE)
ARCHIVE_DIR_NAME = "\u2014 ARCHIWUM"  # — ARCHIWUM (jak na dysku)
_APPLY_LOCK = threading.Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_path(p: str) -> str:
    return str(Path(p)).replace("/", "\\")


def strip_status_suffix(name: str) -> str:
    return SUFFIX_RE.sub("", (name or "").rstrip()).rstrip()


def status_letter_of(name: str) -> str:
    m = SUFFIX_RE.search(name or "")
    return (m.group(1).upper() if m else "")


def with_status_suffix(name: str, letter: str | None) -> str:
    base = strip_status_suffix(name)
    if not letter:
        return base
    lit = letter.upper()
    if lit not in ("F", "X", "D"):
        raise ValueError(f"invalid_status_letter:{letter}")
    return f"{base} - {lit}"


def resolve_status_code(status: str | None) -> str:
    """Zwraca F|X|D|'' (pusty = odznacz)."""
    if status is None:
        return ""
    s = str(status).strip().lower()
    if s in ("", "none", "clear", "odznacz", "starsza", "unset"):
        return ""
    if s in STATUS_LETTER:
        return STATUS_LETTER[s]
    if s.upper() in ("F", "X", "D"):
        return s.upper()
    raise ValueError(f"unknown_status:{status}")


def is_archive_segment(name: str) -> bool:
    n = (name or "").strip()
    return n == ARCHIVE_DIR_NAME or n.upper().endswith("ARCHIWUM")


def find_archive_dir(category_dir: Path) -> Path:
    """Katalog archiwum w kategorii (tworzy — ARCHIWUM jesli brak)."""
    preferred = category_dir / ARCHIVE_DIR_NAME
    if preferred.is_dir():
        return preferred
    for child in category_dir.iterdir() if category_dir.is_dir() else []:
        if child.is_dir() and is_archive_segment(child.name):
            return child
    preferred.mkdir(parents=True, exist_ok=True)
    return preferred


def _rmdir_if_empty(path: Path) -> bool:
    """Usun pusty katalog. True gdy usunieto."""
    try:
        if not path.is_dir():
            return False
        if any(path.iterdir()):
            return False
        path.rmdir()
        return True
    except OSError:
        return False


def _safe_rename(src: Path, dest: Path) -> None:
    if src.resolve() == dest.resolve():
        return
    if dest.exists():
        # Pusty leftover (np. wrapper archiwum po restore wariantu) - zdejmij i kontynuuj
        if dest.is_dir() and _rmdir_if_empty(dest):
            pass
        else:
            raise FileExistsError(f"dest_exists:{dest}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dest)


def _cleanup_empty_archive_wrappers(ops: list[dict]) -> list[str]:
    """Po restore wariantu / merge: usun puste wrapery produktu w — ARCHIWUM."""
    notes: list[str] = []
    seen: set[str] = set()
    for op in ops:
        kind = str(op.get("kind") or "")
        if kind not in (
            "variant_restore",
            "variant_archive",
            "product_restore",
            "product_archive",
            "archive_wrapper_merge",
            "archive_wrapper_rename",
        ):
            continue
        for key in ("from", "to"):
            raw = op.get(key) or ""
            if not raw:
                continue
            p = Path(normalize_path(str(raw)))
            # Kandydaci: parent wariantu (wrapper) oraz sam folder gdy pusty
            candidates = [p.parent, p]
            for cand in candidates:
                keyn = normalize_path(str(cand)).lower()
                if keyn in seen:
                    continue
                seen.add(keyn)
                if not cand.is_dir():
                    continue
                parent = cand.parent
                if not parent.is_dir() or not is_archive_segment(parent.name):
                    continue
                if _rmdir_if_empty(cand):
                    notes.append(f"removed_empty_archive_wrapper:{normalize_path(str(cand))}")
    return notes


def _rewrite_path_through_renames(path: str, path_renames: list[dict]) -> str:
    """Przepisz sciezke przez liste rename/move (kolejnosc chronologiczna)."""
    p = normalize_path(path or "")
    if not p:
        return p
    for pr in path_renames:
        old = normalize_path(str(pr.get("old_path") or ""))
        new = normalize_path(str(pr.get("new_path") or ""))
        if not old or not new:
            continue
        if p == old:
            p = new
        elif p.lower().startswith(old.lower() + "\\"):
            p = new + p[len(old) :]
    return p


def _sync_revisions_after_product(
    store: dict,
    *,
    product_id: str,
    letter: str,
    path_renames: list[dict],
    actor: str,
    final_product_path: str = "",
    cascade_meta: list[dict] | None = None,
) -> None:
    """Po cascade produktu: sciezki z rename + literka z dysku (nie slepe kopiowanie litery produktu)."""
    if not product_id:
        return
    prod = Path(normalize_path(final_product_path)) if final_product_path else None
    meta_by_old = {}
    for m in cascade_meta or []:
        if isinstance(m, dict) and m.get("from"):
            meta_by_old[normalize_path(str(m["from"])).lower()] = m
    revs = store.setdefault("revisions", {})
    for _key, row in list(revs.items()):
        if not isinstance(row, dict):
            continue
        if row.get("product_id") != product_id:
            continue
        old_path = str(row.get("path") or "")
        new_path = _rewrite_path_through_renames(old_path, path_renames)
        meta = meta_by_old.get(normalize_path(old_path).lower()) if old_path else None
        if new_path and not Path(new_path).exists() and prod and prod.is_dir():
            base = strip_status_suffix(Path(normalize_path(old_path or new_path)).name)
            for cand_name in _letter_name_variants(base):
                cand = prod / cand_name
                if cand.is_dir():
                    new_path = normalize_path(str(cand))
                    break
        disk_letter = ""
        if new_path:
            disk_letter = status_letter_of(Path(new_path).name)
        if meta and meta.get("new_letter") is not None:
            disk_letter = str(meta.get("new_letter") or "")
        # previous_letter = stan PRZED archiwum; nie nadpisuj None przy restore produktu
        if (
            meta
            and meta.get("previous_letter") is not None
            and (meta.get("old_letter") or "") != (meta.get("new_letter") or "")
        ):
            row["previous_letter"] = meta.get("previous_letter")
        row["path"] = new_path
        row["previous_path"] = old_path or row.get("previous_path") or ""
        row["letter"] = disk_letter or None
        row["status"] = LETTER_STATUS.get(disk_letter, "clear") if disk_letter else "clear"
        row["updated_at"] = utc_now()
        row["updated_by"] = actor
        row["synced_from_product"] = True


def _safe_move_tree(src: Path, dest: Path) -> None:
    if src.resolve() == dest.resolve():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        if dest.is_dir() and _rmdir_if_empty(dest):
            shutil.move(str(src), str(dest))
            return
        # Merge: przenies dzieci do istniejacego folderu
        if not dest.is_dir():
            raise FileExistsError(f"dest_exists_file:{dest}")
        for child in list(src.iterdir()):
            target = dest / child.name
            if target.exists():
                if child.is_dir() and target.is_dir():
                    _safe_move_tree(child, target)
                else:
                    raise FileExistsError(f"dest_exists:{target}")
            else:
                shutil.move(str(child), str(target))
        try:
            src.rmdir()
        except OSError:
            pass
        return
    shutil.move(str(src), str(dest))


def load_lifecycle_store(path: Path) -> dict:
    if not path.is_file():
        return {"updated_at": "", "products": {}, "revisions": {}, "history": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"updated_at": "", "products": {}, "revisions": {}, "history": []}
    data.setdefault("products", {})
    data.setdefault("revisions", {})
    data.setdefault("history", [])
    return data


def save_lifecycle_store(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data["updated_at"] = utc_now()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def append_history(store: dict, entry: dict) -> dict:
    row = {"id": f"lc_{int(datetime.now(timezone.utc).timestamp() * 1000)}", "ts": utc_now(), **entry}
    store.setdefault("history", []).append(row)
    # Cap
    if len(store["history"]) > 2000:
        store["history"] = store["history"][-2000:]
    return row


def _letter_name_variants(name: str) -> list[str]:
    """Wszystkie warianty nazwy z literkami F/X/D i bez."""
    base = strip_status_suffix(name)
    out = [base]
    for lit in ("F", "X", "D"):
        out.append(with_status_suffix(base, lit))
    # Zachowaj tez oryginal jesli inny
    if name and name not in out:
        out.insert(0, name)
    return out


def _unique_paths(paths: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for p in paths:
        if not p:
            continue
        key = normalize_path(p).lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(normalize_path(p))
    return out


def _find_by_basename_near(hint: Path, names: list[str]) -> Path | None:
    """Szukaj folderu o jednej z nazw w parent, product, archiwum kategorii."""
    parents: list[Path] = []
    if hint.parent and hint.parent.exists():
        parents.append(hint.parent)
    # parent.parent = produkt gdy hint = wariant
    if hint.parent and hint.parent.parent and hint.parent.parent.exists():
        parents.append(hint.parent.parent)
    for parent in parents:
        for nm in names:
            cand = parent / nm
            if cand.is_dir():
                return cand
        # archiwum w kategorii (gdy parent = produkt live)
        cat = parent.parent if parent.exists() else None
        if cat and cat.is_dir():
            for child in cat.iterdir():
                if child.is_dir() and is_archive_segment(child.name):
                    for nm in names:
                        # ARCHIWUM / PRODUCT / VARIANT
                        direct = child / nm
                        if direct.is_dir():
                            return direct
                        for prod_wrap in child.iterdir():
                            if not prod_wrap.is_dir():
                                continue
                            nested = prod_wrap / nm
                            if nested.is_dir():
                                return nested
                            # sam wrap produktu
                            if strip_status_suffix(prod_wrap.name).lower() == strip_status_suffix(nm).lower():
                                if prod_wrap.is_dir() and nm == strip_status_suffix(nm):
                                    pass
    return None


def _find_revision_on_disk(
    *,
    revision_index: str,
    product_path: str,
    hint_path: str,
) -> Path | None:
    """Ostateczny skan: folder zawierajacy indeks w nazwie (np. TEST-TEST)."""
    idx = (revision_index or "").strip()
    if not idx:
        return None
    needle = idx.lower()
    roots: list[Path] = []
    if product_path:
        pp = Path(normalize_path(product_path))
        if pp.exists():
            roots.append(pp)
            if pp.parent.exists():
                roots.append(pp.parent)
                for child in pp.parent.iterdir():
                    if child.is_dir() and is_archive_segment(child.name):
                        roots.append(child)
                        # wrap produktu w archiwum
                        wrap = child / strip_status_suffix(pp.name)
                        if wrap.is_dir():
                            roots.append(wrap)
                        for w in child.iterdir():
                            if w.is_dir() and strip_status_suffix(w.name).lower() == strip_status_suffix(pp.name).lower():
                                roots.append(w)
        else:
            # produkt przeniesiony - category z hint
            hp = Path(normalize_path(hint_path)) if hint_path else None
            if hp:
                for anc in [hp.parent, hp.parent.parent if hp.parent else None]:
                    if anc and anc.exists():
                        roots.append(anc)
    elif hint_path:
        hp = Path(normalize_path(hint_path))
        for anc in [hp.parent, hp.parent.parent if hp.parent else None]:
            if anc and anc.exists():
                roots.append(anc)

    seen: set[str] = set()
    for root in roots:
        key = normalize_path(str(root)).lower()
        if key in seen or not root.is_dir():
            continue
        seen.add(key)
        try:
            for child in root.iterdir():
                if not child.is_dir():
                    continue
                if needle in child.name.lower():
                    return child
                # jeden poziom w dol (ARCHIWUM/PRODUKT/WARIANT)
                try:
                    for nested in child.iterdir():
                        if nested.is_dir() and needle in nested.name.lower():
                            return nested
                except OSError:
                    continue
        except OSError:
            continue
    return None


def resolve_existing_path(
    path: str,
    *,
    scope: str,
    product_path: str = "",
    product_id: str = "",
    revision_index: str = "",
    store: dict | None = None,
) -> tuple[Path | None, list[str], str]:
    """
    Znajdz realna sciezke na dysku mimo stale UI path.
    Zwraca (path|None, attempts, resolved_from).
    """
    attempts: list[str] = []
    candidates: list[str] = []

    def add(p: str | None, label: str = "") -> None:
        if not p:
            return
        np = normalize_path(str(p))
        candidates.append(np)
        attempts.append(f"{label}:{np}" if label else np)

    add(path, "request")
    if scope == "product" and product_path:
        add(product_path, "product_path")

    store = store or {}
    revs = store.get("revisions") or {}
    prods = store.get("products") or {}
    history = store.get("history") or []

    if revision_index:
        row = revs.get(revision_index)
        if isinstance(row, dict):
            add(row.get("path"), "store.revision.path")
            add(row.get("previous_path"), "store.revision.previous_path")
        # klucze sciezkowe w store
        for key, row in revs.items():
            if not isinstance(row, dict):
                continue
            if revision_index and (
                key == revision_index
                or str(row.get("path") or "").upper().endswith(revision_index.upper())
                or revision_index.upper() in str(key).upper()
            ):
                add(row.get("path"), "store.rev_scan.path")
                add(row.get("previous_path"), "store.rev_scan.prev")
            if product_id and row.get("product_id") == product_id and revision_index:
                if revision_index.upper() in str(row.get("path") or "").upper() or key == revision_index:
                    add(row.get("path"), "store.by_product.path")
                    add(row.get("previous_path"), "store.by_product.prev")

    if product_id and product_id in prods:
        add(prods[product_id].get("path"), "store.product.path")
        add(prods[product_id].get("previous_path"), "store.product.prev")

    # Historia: od najnowszej
    for h in reversed(history):
        if not isinstance(h, dict):
            continue
        match = False
        if revision_index and h.get("revision_index") == revision_index:
            match = True
        if product_id and h.get("product_id") == product_id and (
            not revision_index or h.get("revision_index") == revision_index or h.get("scope") == scope
        ):
            match = True
        if not match:
            continue
        for op in reversed(h.get("ops") or []):
            if isinstance(op, dict):
                add(op.get("new_path") or op.get("to"), "history.op.to")
                add(op.get("previous_path") or op.get("from"), "history.op.from")
        add(h.get("path"), "history.path")
        if h.get("product_path"):
            add(h.get("product_path"), "history.product_path")

    # Letter variants przy kazdym kandydacie
    expanded: list[str] = []
    for c in candidates:
        expanded.append(c)
        try:
            p = Path(c)
            for nm in _letter_name_variants(p.name):
                expanded.append(normalize_path(str(p.parent / nm)))
        except Exception:  # noqa: BLE001
            continue
    candidates = _unique_paths(expanded)

    for c in candidates:
        p = Path(c)
        if p.exists():
            return p, attempts, "candidate_exists"

    # Disk near-search po basename
    hint = Path(normalize_path(path)) if path else None
    if hint:
        found = _find_by_basename_near(hint, _letter_name_variants(hint.name))
        if found and found.exists():
            attempts.append(f"disk_near:{normalize_path(str(found))}")
            return found, attempts, "disk_near"

    if revision_index:
        found = _find_revision_on_disk(
            revision_index=revision_index,
            product_path=product_path,
            hint_path=path,
        )
        if found and found.exists():
            attempts.append(f"disk_index:{normalize_path(str(found))}")
            return found, attempts, "disk_index"

    # product_path recovery
    if scope == "product" or product_path:
        pp_hint = Path(normalize_path(product_path or path))
        found = _find_by_basename_near(pp_hint, _letter_name_variants(pp_hint.name))
        if found and found.exists():
            attempts.append(f"disk_product:{normalize_path(str(found))}")
            return found, attempts, "disk_product"

    return None, attempts, "not_found"


def resolve_product_path(
    product_path: str,
    *,
    product_id: str = "",
    variant_path: Path | None = None,
    store: dict | None = None,
) -> Path | None:
    """Ustal folder produktu (live lub archiwum) do restore/cascade."""
    store = store or {}
    candidates: list[str] = []
    if product_path:
        candidates.append(normalize_path(product_path))
    if product_id:
        row = (store.get("products") or {}).get(product_id) or {}
        if row.get("path"):
            candidates.append(normalize_path(str(row["path"])))
        if row.get("previous_path"):
            candidates.append(normalize_path(str(row["previous_path"])))
    for h in reversed(store.get("history") or []):
        if product_id and h.get("product_id") == product_id:
            if h.get("product_path"):
                candidates.append(normalize_path(str(h["product_path"])))
            for op in reversed(h.get("ops") or []):
                if isinstance(op, dict) and op.get("kind") in (
                    "product",
                    "product_archive",
                    "product_restore",
                    "product_clear_from_variant",
                ):
                    candidates.append(normalize_path(str(op.get("to") or op.get("new_path") or "")))
                    candidates.append(normalize_path(str(op.get("from") or op.get("previous_path") or "")))
    for c in _unique_paths(candidates):
        p = Path(c)
        if p.is_dir():
            return p
        for nm in _letter_name_variants(p.name):
            alt = p.parent / nm
            if alt.is_dir():
                return alt
            # archiwum
            if p.parent.is_dir():
                for child in p.parent.iterdir():
                    if child.is_dir() and is_archive_segment(child.name):
                        arch_p = child / nm
                        if arch_p.is_dir():
                            return arch_p
    if variant_path and variant_path.exists():
        parent = variant_path.parent
        if parent.is_dir() and not is_archive_segment(parent.name):
            # wariant w produkcie albo w wrap archiwum/produkt
            return parent
    return Path(normalize_path(product_path)) if product_path else None


def apply_lifecycle_status(
    *,
    scope: str,
    status: str,
    path: str,
    product_path: str = "",
    product_id: str = "",
    revision_index: str = "",
    actor: str = "",
    dry_run: bool = False,
    store_path: Path | None = None,
    append_change_log: Callable[[dict], Any] | None = None,
) -> dict:
    """
    scope: 'product' | 'variant'
    status: aktualne|nieaktualne|demo|clear (lub F|X|D)
    """
    # Serializuj operacje FS - szybkie klikniecia nie moga sie nakladac
    with _APPLY_LOCK:
        return _apply_lifecycle_status_unlocked(
            scope=scope,
            status=status,
            path=path,
            product_path=product_path,
            product_id=product_id,
            revision_index=revision_index,
            actor=actor,
            dry_run=dry_run,
            store_path=store_path,
            append_change_log=append_change_log,
        )


def _apply_lifecycle_status_unlocked(
    *,
    scope: str,
    status: str,
    path: str,
    product_path: str = "",
    product_id: str = "",
    revision_index: str = "",
    actor: str = "",
    dry_run: bool = False,
    store_path: Path | None = None,
    append_change_log: Callable[[dict], Any] | None = None,
) -> dict:
    scope = (scope or "").strip().lower()
    if scope not in ("product", "variant"):
        return {"ok": False, "error": "scope_must_be_product_or_variant"}

    try:
        letter = resolve_status_code(status)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}

    store_preload = load_lifecycle_store(store_path) if store_path else {"products": {}, "revisions": {}, "history": []}
    requested_path = normalize_path(path) if path else ""
    target, resolve_attempts, resolved_from = resolve_existing_path(
        path,
        scope=scope,
        product_path=product_path,
        product_id=product_id,
        revision_index=revision_index,
        store=store_preload,
    )
    if target is None or not target.exists():
        return {
            "ok": False,
            "error": "path_not_found",
            "path": requested_path,
            "resolve_attempts": resolve_attempts[-24:],
            "hint": "Brak folderu na dysku i w historii lifecycle. Sprawdz ARCHIWUM / indeks.",
        }

    # Odswiez product_path gdy live wskaznik jest stary
    resolved_product = resolve_product_path(
        product_path,
        product_id=product_id,
        variant_path=target if scope == "variant" else None,
        store=store_preload,
    )
    if resolved_product and resolved_product.exists():
        product_path = normalize_path(str(resolved_product))
    path = normalize_path(str(target))

    ops: list[dict] = []
    path_renames: list[dict] = []

    def plan_rename(src: Path, dest: Path, kind: str) -> None:
        ops.append(
            {
                "op": "rename",
                "kind": kind,
                "from": normalize_path(str(src)),
                "to": normalize_path(str(dest)),
                "previous_name": src.name,
                "new_name": dest.name,
                "previous_path": normalize_path(str(src)),
                "new_path": normalize_path(str(dest)),
            }
        )
        path_renames.append(
            {
                "old_path": normalize_path(str(src)),
                "new_path": normalize_path(str(dest)),
                "kind": kind,
            }
        )

    def plan_move(src: Path, dest: Path, kind: str) -> None:
        ops.append(
            {
                "op": "move",
                "kind": kind,
                "from": normalize_path(str(src)),
                "to": normalize_path(str(dest)),
                "previous_name": src.name,
                "new_name": dest.name,
                "previous_path": normalize_path(str(src)),
                "new_path": normalize_path(str(dest)),
            }
        )
        path_renames.append(
            {
                "old_path": normalize_path(str(src)),
                "new_path": normalize_path(str(dest)),
                "kind": kind,
            }
        )

    if scope == "variant":
        result = _plan_variant(
            target,
            letter=letter,
            product_path=product_path,
            product_id=product_id,
            revision_index=revision_index,
            store=store_preload,
            plan_rename=plan_rename,
            plan_move=plan_move,
        )
    else:
        result = _plan_product(
            target,
            letter=letter,
            product_id=product_id,
            store=store_preload,
            plan_rename=plan_rename,
            plan_move=plan_move,
        )

    if not result.get("ok"):
        return result

    # Cascade flag: gdy wariant odznaczony z D przy produkcie D -> clear product letter
    cascade_notes = result.get("notes") or []

    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "scope": scope,
            "status": LETTER_STATUS.get(letter, "clear") if letter else "clear",
            "letter": letter or None,
            "ops": ops,
            "notes": cascade_notes,
            "resolved_path": path,
            "resolved_from": resolved_from,
            "requested_path": requested_path,
        }

    # Execute bottom-up for renames inside moves: apply in recorded order
    try:
        for op in ops:
            src = Path(op["from"])
            dest = Path(op["to"])
            if op["op"] == "rename":
                _safe_rename(src, dest)
            elif op["op"] == "move":
                _safe_move_tree(src, dest)
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "error": "fs_failed",
            "detail": str(exc),
            "ops": ops,
        }

    cleanup_notes = _cleanup_empty_archive_wrappers(ops)
    if cleanup_notes:
        cascade_notes = list(cascade_notes) + cleanup_notes

    store = load_lifecycle_store(store_path) if store_path else {"products": {}, "revisions": {}, "history": []}
    hist = append_history(
        store,
        {
            "action": "lifecycle_status",
            "scope": scope,
            "status": LETTER_STATUS.get(letter, "clear") if letter else "clear",
            "letter": letter or None,
            "actor": actor,
            "product_id": product_id,
            "revision_index": revision_index,
            "path": normalize_path(path),
            "product_path": normalize_path(product_path) if product_path else "",
            "ops": ops,
            "notes": cascade_notes,
        },
    )

    # Update store pointers
    final_product_path = result.get("final_product_path") or product_path or ""
    final_variant_path = result.get("final_variant_path") or ""
    applied = utc_now()
    if scope == "product" and product_id:
        prev_prod = (store.get("products") or {}).get(product_id) or {}
        old_letter = status_letter_of(Path(normalize_path(path)).name) if path else ""
        prod_row = {
            "status": LETTER_STATUS.get(letter, "clear") if letter else "clear",
            "letter": letter or None,
            "path": final_product_path,
            "previous_path": normalize_path(path),
            "updated_at": applied,
            "applied_at": applied,
            "source": "program",
            "updated_by": actor,
        }
        if letter:
            prod_row["previous_letter"] = old_letter or None
        elif prev_prod.get("previous_letter") is not None:
            # Po restore zostaw previous na to czego uzywalismy (undo 1 poziom)
            prod_row["previous_letter"] = None
        store["products"][product_id] = prod_row
        _sync_revisions_after_product(
            store,
            product_id=product_id,
            letter=letter,
            path_renames=path_renames,
            actor=actor,
            final_product_path=final_product_path,
            cascade_meta=result.get("cascade_meta") or [],
        )
    if scope == "variant":
        key = _variant_store_key(path_str=normalize_path(final_variant_path or path or ""))
        if not key:
            key = revision_index or ""
        prev_rev = _rev_row_for_variant(
            store, product_id, Path(normalize_path(path)) if path else Path("."), revision_index
        )
        if not prev_rev and key:
            prev_rev = (store.get("revisions") or {}).get(key) or {}
        old_v_letter = status_letter_of(Path(normalize_path(path)).name) if path else ""
        applied_letter = letter
        if result.get("restored_letter") is not None and not letter:
            applied_letter = str(result.get("restored_letter") or "")
        rev_row = {
            "status": LETTER_STATUS.get(applied_letter, "clear") if applied_letter else "clear",
            "letter": applied_letter or None,
            "path": final_variant_path or normalize_path(str(ops[-1]["to"] if ops else path)),
            "previous_path": normalize_path(path),
            "product_id": product_id,
            "updated_at": applied,
            "applied_at": applied,
            "source": "program",
            "updated_by": actor,
        }
        if letter:
            # X ponownie (juz X) — nie kasuj zapamiętanego stanu sprzed archiwum
            if letter == "X" and old_v_letter == "X" and prev_rev.get("previous_letter") is not None:
                rev_row["previous_letter"] = prev_rev.get("previous_letter")
            else:
                rev_row["previous_letter"] = old_v_letter or None
        else:
            rev_row["previous_letter"] = None
        if revision_index:
            rev_row["revision_index"] = revision_index
        store["revisions"][key] = rev_row
        # Legacy klucz po samym indeksie (DOY+ETY wspolny TEST-TEST2) — nie uzywaj do lookup
        if revision_index and revision_index != key and revision_index in store.get("revisions", {}):
            leg = store["revisions"].get(revision_index)
            if isinstance(leg, dict) and leg.get("product_id") == product_id:
                del store["revisions"][revision_index]
        # Po zdjeciu F z wariantu: jesli zaden inny nie ma F -> zdejmij F z produktu
        if result.get("product_cleared") and product_id:
            store["products"][product_id] = {
                "status": "clear",
                "letter": None,
                "path": result.get("final_product_path") or product_path,
                "previous_path": product_path,
                "previous_letter": "F",
                "updated_at": applied,
                "applied_at": applied,
                "source": "program",
                "updated_by": actor,
                "cleared_by_variant": True,
            }
        _ = prev_rev  # zachowane na ewentualny debug

    if store_path:
        save_lifecycle_store(store_path, store)

    if append_change_log:
        append_change_log(
            {
                "action": "lifecycle_status",
                "scope": scope,
                "status": LETTER_STATUS.get(letter, "clear") if letter else "clear",
                "letter": letter or None,
                "actor": actor,
                "product_id": product_id,
                "revision_index": revision_index,
                "path": normalize_path(final_variant_path or final_product_path or path),
                "folder_rename": {
                    "old_path": normalize_path(path),
                    "new_path": normalize_path(
                        final_variant_path or final_product_path or (ops[-1]["to"] if ops else path)
                    ),
                },
                "path_renames": path_renames,
                "lifecycle_history_id": hist.get("id"),
                "notes": cascade_notes,
            }
        )

    return {
        "ok": True,
        "dry_run": False,
        "scope": scope,
        "status": LETTER_STATUS.get(letter, "clear") if letter else "clear",
        "letter": letter or None,
        "ops": ops,
        "notes": cascade_notes,
        "final_product_path": result.get("final_product_path"),
        "final_variant_path": result.get("final_variant_path"),
        "history_id": hist.get("id"),
        "product_cleared": bool(result.get("product_cleared")),
        "resolved_path": path,
        "resolved_from": resolved_from,
        "requested_path": requested_path,
    }


def find_live_product_dir(
    category_dir: Path | None,
    product_path: str = "",
    wrap_name: str = "",
) -> Path | None:
    """
    Znajdz LIVE folder produktu (z literka F/D/X albo bez).
    Nie tworzy duplikatu obok 'NAME - F' gdy szukamy samego 'NAME'.
    """
    # 1) Jawna sciezka produktu jesli zyje poza archiwum
    if product_path:
        pp = Path(normalize_path(product_path))
        if pp.is_dir() and not is_archive_segment(pp.parent.name):
            return pp
        base = strip_status_suffix(pp.name)
        parent = pp.parent
        if parent.is_dir() and is_archive_segment(parent.name):
            parent = parent.parent
        if parent.is_dir() and base:
            for nm in _letter_name_variants(base):
                cand = parent / nm
                if cand.is_dir() and not is_archive_segment(cand.parent.name):
                    return cand

    # 2) Po nazwie wrappera / bazie w kategorii live
    if category_dir and category_dir.is_dir():
        base2 = strip_status_suffix(wrap_name or "")
        if base2:
            for nm in _letter_name_variants(base2):
                cand = category_dir / nm
                if cand.is_dir():
                    return cand
            return category_dir / base2
    return None


def _carrier_prefix(folder_name: str) -> str:
    m = re.match(r"^([A-Z]{2,8})\s*-", str(folder_name or "").strip(), re.I)
    return m.group(1).upper() if m else ""


def _variant_identity(folder_name: str) -> str:
    """Nośnik + indeks (np. DOY|TEST-TEST2) — rozroznia wspolny revision_index."""
    base = strip_status_suffix(str(folder_name or ""))
    carrier = _carrier_prefix(base)
    parts = [p.strip() for p in base.split(" - ") if p.strip()]
    index_token = parts[-1] if parts else base
    return f"{carrier}|{index_token}".lower()


def _rev_row_for_child(store: dict | None, product_id: str, child: Path) -> dict:
    if not store or not product_id:
        return {}
    revs = store.get("revisions") or {}
    child_norm = normalize_path(str(child)).lower()
    child_id = _variant_identity(child.name)
    base = strip_status_suffix(child.name).lower()
    child_carrier = _carrier_prefix(child.name)
    best: dict | None = None
    for _k, row in revs.items():
        if not isinstance(row, dict):
            continue
        if row.get("product_id") != product_id:
            continue
        rp = normalize_path(str(row.get("path") or "")).lower()
        if rp == child_norm:
            return row
        rp_name = Path(rp).name if rp else ""
        if rp_name and _variant_identity(rp_name) == child_id:
            return row
        if strip_status_suffix(rp_name).lower() == base:
            if child_carrier and _carrier_prefix(rp_name) and _carrier_prefix(rp_name) != child_carrier:
                continue
            best = row
    return best or {}


def _rev_row_for_variant(
    store: dict | None,
    product_id: str,
    variant: Path,
    revision_index: str = "",
) -> dict:
    """Lookup wariantu: sciezka/nośnik (prawda), NIGDY wspolny revision_index jako pierwszy."""
    row = _rev_row_for_child(store, product_id, variant)
    if row:
        return row
    if revision_index and store:
        leg = (store.get("revisions") or {}).get(revision_index) or {}
        if leg and leg.get("product_id") == product_id:
            leg_path = normalize_path(str(leg.get("path") or "")).lower()
            var_norm = normalize_path(str(variant)).lower()
            if leg_path == var_norm:
                return leg
            if leg_path and _variant_identity(Path(leg_path).name) == _variant_identity(variant.name):
                return leg
    return {}


def _restore_letter_from_row(row: dict, *, old_l: str, product_had_x: bool) -> str:
    """Przy odklikaniu X: przywroc stan sprzed archiwum (nigdy X)."""
    prev_l = str(row.get("previous_letter") or "").strip().upper()
    if prev_l == "X":
        prev_l = ""
    if old_l == "D" and product_had_x:
        return "D"
    if prev_l in ("F", "D"):
        return prev_l
    return ""


def _resolve_archive_product_wrapper(
    arch: Path,
    prod_base_name: str,
    *,
    plan_rename,
    plan_move,
) -> Path:
    """
    Docelowy wrapper produktu w archiwum przy X wariantu: zawsze NAME - X.
    Scala legacy wrapper bez suffiksu (stary bug) z docelowym - X.
    """
    target_name = with_status_suffix(prod_base_name, "X")
    target = arch / target_name
    legacy = arch / prod_base_name
    if not legacy.is_dir() or legacy.name == target_name:
        return target
    if target.is_dir():
        for child in list(legacy.iterdir()):
            if not child.is_dir() or child.name.startswith("."):
                continue
            dest_child = target / child.name
            if not dest_child.exists():
                plan_move(child, dest_child, "archive_wrapper_merge")
    else:
        plan_rename(legacy, target, "archive_wrapper_rename")
    return target


def _sibling_variant_has_f(product_dir: Path | None, exclude: Path | None = None) -> bool:
    if not product_dir or not product_dir.is_dir():
        return False
    ex = normalize_path(str(exclude)) if exclude else ""
    for child in product_dir.iterdir():
        if not child.is_dir() or child.name.startswith("."):
            continue
        if ex and normalize_path(str(child)) == ex:
            continue
        if status_letter_of(child.name) == "F":
            return True
    return False


def _plan_variant(
    variant: Path,
    *,
    letter: str,
    product_path: str,
    product_id: str = "",
    revision_index: str = "",
    store: dict | None = None,
    plan_rename,
    plan_move,
) -> dict:
    notes: list[str] = []
    product_cleared = False
    restored_letter = None

    parent = variant.parent
    archive_product = None
    in_archive = False
    if is_archive_segment(parent.name):
        in_archive = True
        category_dir = parent.parent
        product = Path(normalize_path(product_path)) if product_path else None
    elif parent.parent and is_archive_segment(parent.parent.name):
        in_archive = True
        archive_product = parent
        category_dir = parent.parent.parent
        product = Path(normalize_path(product_path)) if product_path else None
    else:
        product = Path(normalize_path(product_path)) if product_path else parent
        if not product.is_dir():
            product = parent
        category_dir = product.parent

    current_letter = status_letter_of(variant.name)
    # Odznaczenie: przywroc previous_letter ze store (nie zawsze "bez statusu")
    effective_letter = letter
    if not letter:
        row = _rev_row_for_variant(store, product_id, variant, revision_index)
        prev = str(row.get("previous_letter") or "").strip().upper()
        if prev == "X":
            prev = ""
        if prev in ("F", "D"):
            effective_letter = prev
            restored_letter = prev
            notes.append(f"variant_restored_previous_letter:{prev}")
        else:
            effective_letter = ""
            restored_letter = ""

    new_name = with_status_suffix(variant.name, effective_letter or None)
    working = variant

    if working.name != new_name:
        dest = working.parent / new_name
        plan_rename(working, dest, "variant")
        working = dest

    # Archiwum / restore
    if effective_letter == "X":
        if category_dir is None:
            return {"ok": False, "error": "category_unknown_for_archive"}
        arch = find_archive_dir(category_dir)
        prod_base_name = strip_status_suffix(
            (product.name if product and product.exists() else "")
            or (Path(normalize_path(product_path)).name if product_path else "")
            or (archive_product.name if archive_product else "")
            or "UNKNOWN"
        )
        wrap = _resolve_archive_product_wrapper(
            arch,
            prod_base_name,
            plan_rename=plan_rename,
            plan_move=plan_move,
        )
        dest = wrap / working.name
        if normalize_path(str(working.parent)) == normalize_path(str(wrap)):
            pass
        elif (
            strip_status_suffix(working.parent.name).lower() == prod_base_name.lower()
            and working.parent.parent.is_dir()
            and is_archive_segment(working.parent.parent.name)
        ):
            # rename wrapera lub merge w _resolve - bez osobnego variant_archive
            working = dest
        else:
            plan_move(working, dest, "variant_archive")
            working = dest
        notes.append("variant_moved_to_archive_with_product_wrapper")
        live_keep = find_live_product_dir(category_dir, product_path, prod_base_name)
        final_product_path = normalize_path(str(live_keep)) if live_keep else (
            normalize_path(product_path) if product_path else normalize_path(str(category_dir / prod_base_name))
        )
    else:
        if in_archive or current_letter == "X":
            if category_dir is None:
                return {"ok": False, "error": "category_unknown_for_restore"}
            wrap_hint = (
                (archive_product.name if archive_product else "")
                or (Path(normalize_path(product_path)).name if product_path else "")
            )
            live_product = find_live_product_dir(category_dir, product_path, wrap_hint)
            if live_product is None:
                return {"ok": False, "error": "live_product_not_found_for_restore"}
            dest = live_product / working.name
            if normalize_path(str(working.parent)) != normalize_path(str(live_product)):
                plan_move(working, dest, "variant_restore")
                working = dest
            product = live_product
            notes.append("variant_restored_from_archive")
        final_product_path = (
            normalize_path(str(product))
            if product and str(product)
            else (normalize_path(product_path) if product_path else "")
        )

    # Zdjecie F z wariantu: jesli produkt ma F i zaden inny wariant nie ma F -> zdejmij F produktu
    live_prod = Path(normalize_path(final_product_path)) if final_product_path else None
    if (
        current_letter == "F"
        and effective_letter != "F"
        and live_prod
        and live_prod.exists()
        and status_letter_of(live_prod.name) == "F"
        and not _sibling_variant_has_f(live_prod, exclude=working)
    ):
        cleared_name = with_status_suffix(live_prod.name, None)
        if live_prod.name != cleared_name:
            dest_p = live_prod.parent / cleared_name
            plan_rename(live_prod, dest_p, "product_clear_f_no_variant_f")
            old_prefix = normalize_path(str(live_prod)).lower() + "\\"
            wnorm = normalize_path(str(working)).lower()
            if wnorm.startswith(old_prefix):
                rel = working.relative_to(live_prod)
                working = dest_p / rel
            final_product_path = normalize_path(str(dest_p))
            product_cleared = True
            notes.append("product_f_cleared_no_variant_f")

    return {
        "ok": True,
        "final_variant_path": normalize_path(str(working)),
        "final_product_path": final_product_path,
        "product_cleared": product_cleared,
        "restored_letter": restored_letter,
        "notes": notes,
    }


def _plan_product(
    product: Path,
    *,
    letter: str,
    product_id: str = "",
    store: dict | None = None,
    plan_rename,
    plan_move,
) -> dict:
    """
    Cascade liter:
      D: bez litery / F -> D; X bez zmian (archiwum)
      X: bez litery / F -> X; D bez zmian; produkt do archiwum
      F: TYLKO produkt, gdy >=1 wariant ma F (bez cascade na warianty)
      clear: przywroc previous_letter produktu i wariantow
    """
    notes: list[str] = []
    cascade_meta: list[dict] = []
    category_dir = product.parent
    in_archive = is_archive_segment(category_dir.name)
    live_category = category_dir.parent if in_archive else category_dir

    current_letter = status_letter_of(product.name)
    children = [c for c in product.iterdir() if c.is_dir() and not c.name.startswith(".")]

    # F: wymaga co najmniej jednego wariantu F; bez cascade
    if letter == "F":
        if not any(status_letter_of(c.name) == "F" for c in children):
            return {
                "ok": False,
                "error": "product_f_requires_variant_f",
                "hint": (
                    "Produkt moze miec F tylko gdy przynajmniej jeden wariant tez ma F. "
                    "Najpierw nadaj F wybranemu wariantowi."
                ),
            }
        working = product
        new_prod_name = with_status_suffix(product.name, "F")
        if working.name != new_prod_name:
            dest = working.parent / new_prod_name
            plan_rename(working, dest, "product")
            working = dest
        if in_archive:
            dest = live_category / working.name
            if normalize_path(str(working.parent)) != normalize_path(str(live_category)):
                plan_move(working, dest, "product_restore")
                working = dest
            notes.append("product_restored_from_archive")
        return {
            "ok": True,
            "final_product_path": normalize_path(str(working)),
            "final_variant_path": "",
            "notes": notes,
            "cascaded_variants": 0,
            "cascade_meta": [],
        }

    # Wylicz docelowa literke kazdego wariantu
    child_targets: list[tuple[Path, str, str]] = []  # child, old_letter, new_letter
    for child in children:
        old_l = status_letter_of(child.name)
        row = _rev_row_for_child(store, product_id, child)
        prev_l = str(row.get("previous_letter") or "").strip().upper()
        if prev_l == "X":
            prev_l = ""

        if letter == "D":
            if old_l == "X":
                new_l = "X"
            else:
                new_l = "D"  # "", F, D -> D
        elif letter == "X":
            if old_l == "D":
                new_l = "D"
            else:
                new_l = "X"  # "", F, X -> X
        else:  # clear / restore produktu z archiwum
            new_l = _restore_letter_from_row(
                row, old_l=old_l, product_had_x=(current_letter == "X")
            )
        child_targets.append((child, old_l, new_l))

    working = product
    for child, old_l, new_l in child_targets:
        new_name = with_status_suffix(child.name, new_l or None)
        # Po rename produktu sciezka dziecka bedzie pod working - planujemy na biezacym parent
        src = working / child.name if child.parent == product else child
        # child still under original product before product rename
        src = child
        if src.name != new_name:
            plan_rename(src, src.parent / new_name, "variant_cascade")
        meta_entry = {
            "from": normalize_path(str(src)),
            "to": normalize_path(str(src.parent / new_name)),
            "old_letter": old_l or "",
            "new_letter": new_l or "",
        }
        # Zapamietaj stan sprzed archiwum tylko gdy wchodzimy w X (nie przy restore)
        if letter == "X" and old_l != "X":
            meta_entry["previous_letter"] = old_l or None
        cascade_meta.append(meta_entry)

    # Literka produktu
    if letter:
        target_prod_letter = letter
    else:
        prow = ((store or {}).get("products") or {}).get(product_id) or {}
        prev_p = str(prow.get("previous_letter") or "").strip().upper()
        target_prod_letter = prev_p if prev_p in ("F", "X", "D") else ""

    new_prod_name = with_status_suffix(product.name, target_prod_letter or None)
    logical_child_names = [with_status_suffix(c.name, nl or None) for c, _ol, nl in child_targets]

    if working.name != new_prod_name:
        dest = working.parent / new_prod_name
        plan_rename(working, dest, "product")
        working = dest

    if letter == "X" or target_prod_letter == "X":
        arch = find_archive_dir(live_category)
        dest = arch / working.name
        if normalize_path(str(working.parent)) != normalize_path(str(arch)):
            plan_move(working, dest, "product_archive")
            working = dest
        notes.append("product_moved_to_category_archive")
    elif (current_letter == "X" or in_archive) and target_prod_letter != "X":
        dest = live_category / working.name
        if normalize_path(str(working.parent)) != normalize_path(str(live_category)):
            plan_move(working, dest, "product_restore")
            working = dest
        notes.append("product_restored_from_archive")

    # Popraw cascade_meta "to" po rename/move produktu
    for m in cascade_meta:
        base = strip_status_suffix(Path(m["to"]).name)
        for nm in logical_child_names:
            if strip_status_suffix(nm) == base:
                m["to"] = normalize_path(str(working / nm))
                break

    return {
        "ok": True,
        "final_product_path": normalize_path(str(working)),
        "final_variant_path": "",
        "notes": notes,
        "cascaded_variants": len(child_targets),
        "cascade_meta": cascade_meta,
    }


# ---------------------------------------------------------------------------
# Reconcile: dysk <-> program (mtime)
# ---------------------------------------------------------------------------


def _parse_iso_ts(raw: str | None) -> datetime | None:
    if not raw:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def folder_mtime_dt(path: Path) -> datetime | None:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    except OSError:
        return None


def path_in_archive(path: Path) -> bool:
    for part in path.parts:
        if is_archive_segment(part):
            return True
    return False


def _norm_letter(letter: Any) -> str:
    if not letter:
        return ""
    s = str(letter).strip().upper()
    return s if s in ("F", "X", "D") else ""


def _load_file_index(file_index_path: Path | None) -> dict:
    if not file_index_path or not file_index_path.is_file():
        return {"products": []}
    try:
        data = json.loads(file_index_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"products": []}
    if isinstance(data, list):
        return {"products": data}
    data.setdefault("products", [])
    return data


def _iter_index_entities(
    file_index: dict,
    *,
    product_id_filter: str | None = None,
) -> list[dict]:
    """Zwraca listy {scope, product_id, revision_index, path, name} z indeksu."""
    out: list[dict] = []
    for p in file_index.get("products") or []:
        if not isinstance(p, dict):
            continue
        pid = str(p.get("id") or "")
        if product_id_filter and pid != product_id_filter:
            continue
        ppath = normalize_path(str(p.get("path") or ""))
        if ppath:
            out.append(
                {
                    "scope": "product",
                    "product_id": pid,
                    "revision_index": "",
                    "path": ppath,
                    "name": str(p.get("name") or Path(ppath).name),
                }
            )
        for r in p.get("revisions") or []:
            if not isinstance(r, dict):
                continue
            rpath = normalize_path(str(r.get("path") or r.get("folder") or ""))
            if not rpath:
                continue
            out.append(
                {
                    "scope": "variant",
                    "product_id": pid,
                    "revision_index": str(r.get("index") or ""),
                    "path": rpath,
                    "name": str(r.get("name") or Path(rpath).name),
                }
            )
    return out


def _variant_store_key(disk_path: Path | None = None, *, path_str: str = "") -> str:
    """Klucz wariantu w lifecycle store — sciezka dyskowa (index moze byc wspolny)."""
    if disk_path is not None:
        return normalize_path(str(disk_path))
    return normalize_path(path_str or "")


def _resolve_entity_path(path_str: str) -> Path | None:
    if not path_str:
        return None
    p = Path(normalize_path(path_str))
    if p.is_dir():
        return p
    base = strip_status_suffix(p.name)
    parent = p.parent
    if not parent.is_dir():
        return None
    for nm in _letter_name_variants(base):
        cand = parent / nm
        if cand.is_dir():
            return cand
    # szukaj w ARCHIWUM kategorii
    if parent.is_dir():
        for child in parent.iterdir():
            if child.is_dir() and is_archive_segment(child.name):
                for nm in _letter_name_variants(base):
                    cand = child / nm
                    if cand.is_dir():
                        return cand
                    # wrapper produktu w archiwum
                    for wrap in child.iterdir() if child.is_dir() else []:
                        if not wrap.is_dir():
                            continue
                        if strip_status_suffix(wrap.name) == strip_status_suffix(parent.name) or True:
                            for nm2 in _letter_name_variants(base):
                                cand2 = wrap / nm2
                                if cand2.is_dir():
                                    return cand2
    return None


def pull_lifecycle_from_disk(
    *,
    store_path: Path,
    file_index_path: Path | None = None,
    actor: str = "refresh",
    product_id_filter: str | None = None,
) -> dict:
    """
    Odswiez: TYLKO dysk -> program. Bez rename/move folderow.
    Zwraca drifts (store przed vs literka na dysku) + aktualizuje store.
    """
    store = load_lifecycle_store(store_path)
    index = _load_file_index(file_index_path)
    drifts: list[dict] = []
    updated = 0
    now = utc_now()

    for ent in _iter_index_entities(index, product_id_filter=product_id_filter):
        disk_path = _resolve_entity_path(ent["path"])
        if disk_path is None:
            continue
        disk_letter = _norm_letter(status_letter_of(disk_path.name))
        disk_status = LETTER_STATUS.get(disk_letter, "clear") if disk_letter else "clear"
        disk_mtime = folder_mtime_dt(disk_path)
        in_arch = path_in_archive(disk_path)

        if ent["scope"] == "product":
            key = ent["product_id"]
            prev = dict(store.get("products", {}).get(key) or {})
            prev_letter = _norm_letter(prev.get("letter"))
            if prev_letter != disk_letter or normalize_path(str(prev.get("path") or "")) != normalize_path(str(disk_path)):
                drifts.append(
                    {
                        "scope": "product",
                        "product_id": key,
                        "revision_index": "",
                        "previous_letter": prev_letter or None,
                        "previous_status": prev.get("status") or "clear",
                        "disk_letter": disk_letter or None,
                        "disk_status": disk_status,
                        "path": normalize_path(str(disk_path)),
                        "in_archive": in_arch,
                        "disk_mtime": disk_mtime.isoformat() if disk_mtime else None,
                        "applied_at": prev.get("applied_at") or prev.get("updated_at"),
                        "needs_archive_move": bool(disk_letter == "X" and not in_arch),
                        "direction": "disk_to_program",
                    }
                )
                store.setdefault("products", {})[key] = {
                    **prev,
                    "status": disk_status,
                    "letter": disk_letter or None,
                    "path": normalize_path(str(disk_path)),
                    "updated_at": now,
                    "source": "disk",
                    "synced_from_disk": True,
                    "synced_by": actor,
                    "disk_mtime": disk_mtime.isoformat() if disk_mtime else None,
                    # nie nadpisuj applied_at - to znacznik ostatniego zapisu PROGRAMU
                }
                updated += 1
        else:
            key = _variant_store_key(disk_path)
            prev = dict(store.get("revisions", {}).get(key) or {})
            # fallback: stary klucz po revision_index (migracja)
            if not prev and ent["revision_index"]:
                prev = dict(store.get("revisions", {}).get(ent["revision_index"]) or {})
            if not prev:
                for rk, rv in (store.get("revisions") or {}).items():
                    if isinstance(rv, dict) and normalize_path(str(rv.get("path") or "")) == normalize_path(ent["path"]):
                        prev = dict(rv)
                        key = rk
                        break
            prev_letter = _norm_letter(prev.get("letter"))
            if prev_letter != disk_letter or normalize_path(str(prev.get("path") or "")) != normalize_path(str(disk_path)):
                drifts.append(
                    {
                        "scope": "variant",
                        "product_id": ent["product_id"],
                        "revision_index": ent["revision_index"],
                        "previous_letter": prev_letter or None,
                        "previous_status": prev.get("status") or "clear",
                        "disk_letter": disk_letter or None,
                        "disk_status": disk_status,
                        "path": normalize_path(str(disk_path)),
                        "in_archive": in_arch,
                        "disk_mtime": disk_mtime.isoformat() if disk_mtime else None,
                        "applied_at": prev.get("applied_at") or prev.get("updated_at"),
                        "needs_archive_move": bool(disk_letter == "X" and not in_arch),
                        "direction": "disk_to_program",
                    }
                )
                store.setdefault("revisions", {})[key] = {
                    **prev,
                    "status": disk_status,
                    "letter": disk_letter or None,
                    "path": normalize_path(str(disk_path)),
                    "product_id": ent["product_id"],
                    "updated_at": now,
                    "source": "disk",
                    "synced_from_disk": True,
                    "synced_by": actor,
                    "disk_mtime": disk_mtime.isoformat() if disk_mtime else None,
                }
                updated += 1

    if drifts:
        append_history(
            store,
            {
                "action": "lifecycle_pull_from_disk",
                "actor": actor,
                "drift_count": len(drifts),
                "drifts": drifts[:80],
                "product_id_filter": product_id_filter or "",
            },
        )
    save_lifecycle_store(store_path, store)
    return {
        "ok": True,
        "mode": "pull",
        "updated": updated,
        "drifts": drifts,
        "store": store,
    }


def reconcile_lifecycle_on_boot(
    *,
    store_path: Path,
    file_index_path: Path | None = None,
    actor: str = "startup",
    product_id_filter: str | None = None,
    enforce_moves: bool = True,
    append_change_log: Callable[[dict], Any] | None = None,
) -> dict:
    """
    Start programu: porownaj mtime dysku vs applied_at programu.
    - disk_mtime > applied_at => dysk wygrywa: store = dysk; opcjonalnie enforce X->archiwum
    - applied_at >= disk_mtime i rozjazd => program wygrywa: zostaw store, oznacz needs_force
    """
    store = load_lifecycle_store(store_path)
    index = _load_file_index(file_index_path)
    disk_wins: list[dict] = []
    program_wins: list[dict] = []
    enforced: list[dict] = []
    now = utc_now()

    for ent in _iter_index_entities(index, product_id_filter=product_id_filter):
        disk_path = _resolve_entity_path(ent["path"])
        if disk_path is None:
            continue
        disk_letter = _norm_letter(status_letter_of(disk_path.name))
        disk_status = LETTER_STATUS.get(disk_letter, "clear") if disk_letter else "clear"
        disk_mtime = folder_mtime_dt(disk_path)
        in_arch = path_in_archive(disk_path)

        if ent["scope"] == "product":
            key = ent["product_id"]
            prev = dict(store.get("products", {}).get(key) or {})
        else:
            key = _variant_store_key(disk_path)
            prev = dict(store.get("revisions", {}).get(key) or {})
            if not prev and ent.get("revision_index"):
                prev = dict(store.get("revisions", {}).get(ent["revision_index"]) or {})
            if not prev:
                for rk, rv in (store.get("revisions") or {}).items():
                    if isinstance(rv, dict) and normalize_path(str(rv.get("path") or "")) in (
                        normalize_path(ent["path"]),
                        normalize_path(str(disk_path)),
                    ):
                        prev = dict(rv)
                        key = rk
                        break

        prev_letter = _norm_letter(prev.get("letter"))
        applied_dt = _parse_iso_ts(str(prev.get("applied_at") or prev.get("updated_at") or ""))
        if prev_letter == disk_letter and normalize_path(str(prev.get("path") or "")) == normalize_path(str(disk_path)):
            # Literka zgodna - ale X poza archiwum nadal wymaga enforce
            if enforce_moves and disk_letter == "X" and not in_arch:
                pass  # spadnie do enforce nizej przez disk_wins-like
            else:
                continue

        disk_newer = False
        if disk_mtime and applied_dt:
            disk_newer = disk_mtime > applied_dt
        elif disk_mtime and not applied_dt:
            disk_newer = True  # brak znacznika programu -> ufaj dyskowi
        elif not disk_mtime and applied_dt:
            disk_newer = False
        else:
            disk_newer = prev_letter != disk_letter  # fallback: jak jest rozjazd, pull z dysku

        row = {
            "scope": ent["scope"],
            "product_id": ent["product_id"],
            "revision_index": ent.get("revision_index") or "",
            "previous_letter": prev_letter or None,
            "disk_letter": disk_letter or None,
            "path": normalize_path(str(disk_path)),
            "in_archive": in_arch,
            "disk_mtime": disk_mtime.isoformat() if disk_mtime else None,
            "applied_at": prev.get("applied_at") or prev.get("updated_at"),
            "needs_archive_move": bool(disk_letter == "X" and not in_arch),
        }

        if disk_newer or (prev_letter != disk_letter and not applied_dt):
            row["winner"] = "disk"
            disk_wins.append(row)
            bucket = store.setdefault("products" if ent["scope"] == "product" else "revisions", {})
            bucket[key] = {
                **prev,
                "status": disk_status,
                "letter": disk_letter or None,
                "path": normalize_path(str(disk_path)),
                "product_id": ent["product_id"] if ent["scope"] == "variant" else prev.get("product_id"),
                "updated_at": now,
                "source": "disk",
                "synced_from_disk": True,
                "synced_by": actor,
                "disk_mtime": disk_mtime.isoformat() if disk_mtime else None,
            }
            if ent["scope"] == "product":
                bucket[key].pop("product_id", None)
        else:
            row["winner"] = "program"
            row["needs_force"] = True
            program_wins.append(row)

    # Enforce lokalizacji X gdy dysk wygral (lub literka X poza archiwum)
    if enforce_moves:
        for row in list(disk_wins):
            if not row.get("needs_archive_move"):
                continue
            status_code = LETTER_STATUS.get(row["disk_letter"] or "", "nieaktualne")
            r = apply_lifecycle_status(
                scope=row["scope"],
                status=status_code,
                path=row["path"],
                product_id=row["product_id"],
                revision_index=row.get("revision_index") or "",
                actor=actor,
                dry_run=False,
                store_path=store_path,
                append_change_log=append_change_log,
            )
            enforced.append(
                {
                    **row,
                    "enforce_ok": bool(r.get("ok")),
                    "enforce_error": r.get("error"),
                    "final_path": r.get("final_variant_path") or r.get("final_product_path"),
                }
            )
        # przeladuj store po enforce
        store = load_lifecycle_store(store_path)

    if disk_wins or program_wins or enforced:
        append_history(
            store,
            {
                "action": "lifecycle_reconcile_boot",
                "actor": actor,
                "disk_wins": len(disk_wins),
                "program_wins": len(program_wins),
                "enforced": len(enforced),
                "details_disk": disk_wins[:40],
                "details_program": program_wins[:40],
                "details_enforced": enforced[:40],
            },
        )
        save_lifecycle_store(store_path, store)

    return {
        "ok": True,
        "mode": "boot",
        "disk_wins": disk_wins,
        "program_wins": program_wins,
        "enforced": enforced,
        "store": store,
    }


def force_apply_program_to_disk(
    *,
    store_path: Path,
    file_index_path: Path | None = None,
    actor: str = "force",
    product_id_filter: str | None = None,
    dry_run: bool = False,
    append_change_log: Callable[[dict], Any] | None = None,
) -> dict:
    """
    Stosuj zmiany: PROGRAM -> dysk (FORCE).
    Dla kazdego wpisu store gdzie literka/status != dysk: apply_lifecycle_status.
    """
    store = load_lifecycle_store(store_path)
    index = _load_file_index(file_index_path)
    planned: list[dict] = []
    results: list[dict] = []

    index_paths: dict[tuple[str, str], str] = {}
    index_product_paths: dict[str, str] = {}
    for ent in _iter_index_entities(index, product_id_filter=product_id_filter):
        if ent["scope"] == "product":
            index_product_paths[ent["product_id"]] = ent["path"]
        elif ent["scope"] == "variant" and ent.get("revision_index"):
            index_paths[(ent["product_id"], ent["revision_index"])] = ent["path"]

    # Zbierz cele z store + uzupelnij sciezki z indeksu
    targets: list[dict] = []
    for pid, prow in (store.get("products") or {}).items():
        if product_id_filter and pid != product_id_filter:
            continue
        if not isinstance(prow, dict):
            continue
        targets.append(
            {
                "scope": "product",
                "product_id": pid,
                "revision_index": "",
                "status": prow.get("status") or "clear",
                "letter": _norm_letter(prow.get("letter")),
                "path": normalize_path(str(prow.get("path") or "")),
            }
        )
    for rkey, rrow in (store.get("revisions") or {}).items():
        if not isinstance(rrow, dict):
            continue
        pid = str(rrow.get("product_id") or "")
        if product_id_filter and pid != product_id_filter:
            continue
        targets.append(
            {
                "scope": "variant",
                "product_id": pid,
                "revision_index": str(rkey) if not str(rkey).startswith("X:") else str(rrow.get("index") or rkey),
                "status": rrow.get("status") or "clear",
                "letter": _norm_letter(rrow.get("letter")),
                "path": normalize_path(str(rrow.get("path") or "")),
            }
        )

    # Jesli store pusty dla filtra - uzyj indeksu z literka ze store local? skip
    # Uzupelnij path z indeksu gdy brak lub gdy indeks ma swiezsza sciezke dyskowa
    by_pid = {e["product_id"]: e for e in _iter_index_entities(index, product_id_filter=product_id_filter) if e["scope"] == "product"}
    for t in targets:
        if t["scope"] == "product":
            ip = index_product_paths.get(t["product_id"] or "")
            if ip:
                t["path"] = ip
            elif not t["path"] and t["product_id"] in by_pid:
                t["path"] = by_pid[t["product_id"]]["path"]
        elif t["scope"] == "variant":
            ip = index_paths.get((t["product_id"] or "", t.get("revision_index") or ""))
            if ip:
                t["path"] = ip
                idx_lit = _norm_letter(status_letter_of(Path(ip).name))
                if idx_lit and not t["letter"]:
                    t["letter"] = idx_lit
                    t["status"] = LETTER_STATUS.get(idx_lit, "clear")
        if not t["path"] and t["scope"] == "product" and t["product_id"] in by_pid:
            t["path"] = by_pid[t["product_id"]]["path"]
        disk_path = _resolve_entity_path(t["path"]) if t["path"] else None
        disk_letter = _norm_letter(status_letter_of(disk_path.name)) if disk_path else ""
        want = t["letter"]
        if disk_path and disk_letter == want:
            # dodatkowo: X musi byc w archiwum
            if want == "X" and not path_in_archive(disk_path):
                pass
            else:
                continue
        if not disk_path and not t["path"]:
            continue
        planned.append(
            {
                **t,
                "disk_letter": disk_letter or None,
                "disk_path": normalize_path(str(disk_path)) if disk_path else t["path"],
            }
        )

    if dry_run:
        return {"ok": True, "dry_run": True, "planned": planned, "count": len(planned)}

    for item in planned:
        status = item["status"] if item["status"] not in ("", None) else ("clear" if not item["letter"] else LETTER_STATUS.get(item["letter"], "clear"))
        if item["letter"] and status == "clear":
            status = LETTER_STATUS.get(item["letter"], "clear")
        if not item["letter"]:
            status = "clear"
        r = apply_lifecycle_status(
            scope=item["scope"],
            status=status,
            path=item.get("disk_path") or item["path"],
            product_id=item["product_id"],
            revision_index=item.get("revision_index") or "",
            actor=actor,
            dry_run=False,
            store_path=store_path,
            append_change_log=append_change_log,
        )
        results.append(
            {
                "scope": item["scope"],
                "product_id": item["product_id"],
                "revision_index": item.get("revision_index") or "",
                "ok": bool(r.get("ok")),
                "error": r.get("error"),
                "letter": r.get("letter"),
                "final_path": r.get("final_variant_path") or r.get("final_product_path"),
            }
        )

    store = load_lifecycle_store(store_path)
    append_history(
        store,
        {
            "action": "lifecycle_force_apply",
            "actor": actor,
            "count": len(results),
            "results": results[:80],
        },
    )
    save_lifecycle_store(store_path, store)
    ok_n = sum(1 for x in results if x.get("ok"))
    return {
        "ok": True,
        "mode": "force",
        "planned": len(planned),
        "applied_ok": ok_n,
        "applied_fail": len(results) - ok_n,
        "results": results,
        "store": store,
    }
