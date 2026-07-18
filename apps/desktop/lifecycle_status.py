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


def _safe_rename(src: Path, dest: Path) -> None:
    if src.resolve() == dest.resolve():
        return
    if dest.exists():
        raise FileExistsError(f"dest_exists:{dest}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dest)


def _safe_move_tree(src: Path, dest: Path) -> None:
    if src.resolve() == dest.resolve():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
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
    scope = (scope or "").strip().lower()
    if scope not in ("product", "variant"):
        return {"ok": False, "error": "scope_must_be_product_or_variant"}

    try:
        letter = resolve_status_code(status)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}

    target = Path(normalize_path(path))
    if not target.exists():
        return {"ok": False, "error": "path_not_found", "path": str(target)}

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
            plan_rename=plan_rename,
            plan_move=plan_move,
        )
    else:
        result = _plan_product(
            target,
            letter=letter,
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
    if scope == "product" and product_id:
        store["products"][product_id] = {
            "status": LETTER_STATUS.get(letter, "clear") if letter else "clear",
            "letter": letter or None,
            "path": final_product_path,
            "previous_path": normalize_path(path),
            "updated_at": utc_now(),
            "updated_by": actor,
        }
    if scope == "variant":
        key = revision_index or normalize_path(final_variant_path or path)
        store["revisions"][key] = {
            "status": LETTER_STATUS.get(letter, "clear") if letter else "clear",
            "letter": letter or None,
            "path": final_variant_path or normalize_path(str(ops[-1]["to"] if ops else path)),
            "previous_path": normalize_path(path),
            "product_id": product_id,
            "updated_at": utc_now(),
            "updated_by": actor,
        }
        # Jesli wariant odznaczyl D i produkt tez zostal odznaczony
        if result.get("product_cleared") and product_id:
            store["products"][product_id] = {
                "status": "clear",
                "letter": None,
                "path": result.get("final_product_path") or product_path,
                "previous_path": product_path,
                "updated_at": utc_now(),
                "updated_by": actor,
                "cleared_by_variant": True,
            }

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
    }


def _plan_variant(
    variant: Path,
    *,
    letter: str,
    product_path: str,
    plan_rename,
    plan_move,
) -> dict:
    notes: list[str] = []
    product_cleared = False

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
    new_name = with_status_suffix(variant.name, letter or None)
    working = variant

    # 1) Rename wariantu w miejscu
    if working.name != new_name:
        dest = working.parent / new_name
        plan_rename(working, dest, "variant")
        working = dest

    # 2) Archiwum / restore
    if letter == "X":
        if category_dir is None:
            return {"ok": False, "error": "category_unknown_for_archive"}
        arch = find_archive_dir(category_dir)
        prod_base_name = strip_status_suffix(
            (Path(normalize_path(product_path)).name if product_path else "")
            or (archive_product.name if archive_product else "")
            or (product.name if product else "UNKNOWN")
        )
        wrap = arch / prod_base_name
        dest = wrap / working.name
        if normalize_path(str(working.parent)) != normalize_path(str(wrap)):
            plan_move(working, dest, "variant_archive")
            working = dest
        notes.append("variant_moved_to_archive_with_product_wrapper")
        final_product_path = normalize_path(product_path) if product_path else normalize_path(
            str(category_dir / prod_base_name)
        )
    else:
        if in_archive or current_letter == "X":
            live_product = Path(normalize_path(product_path)) if product_path else None
            if live_product is None or not live_product.exists():
                if category_dir is None:
                    return {"ok": False, "error": "category_unknown_for_restore"}
                prod_base = strip_status_suffix(
                    (archive_product.name if archive_product else "")
                    or (live_product.name if live_product else "UNKNOWN")
                )
                live_product = category_dir / prod_base
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

    # 3) Odznaczenie DEMO wariantu przy produkcie DEMO -> clear literki produktu
    live_prod = None
    if product_path:
        cand = Path(normalize_path(product_path))
        if cand.exists():
            live_prod = cand
    if live_prod is None and product and Path(product).exists() and not in_archive:
        live_prod = Path(product)

    if live_prod and live_prod.exists() and status_letter_of(live_prod.name) == "D" and letter != "D":
        cleared_name = with_status_suffix(live_prod.name, None)
        if live_prod.name != cleared_name:
            dest_p = live_prod.parent / cleared_name
            plan_rename(live_prod, dest_p, "product_clear_from_variant")
            # Jesli wariant nadal pod starym produktem - przepisz final path
            old_prefix = normalize_path(str(live_prod)).lower() + "\\"
            wnorm = normalize_path(str(working)).lower()
            if wnorm.startswith(old_prefix):
                rel = working.relative_to(live_prod)
                working = dest_p / rel
            final_product_path = normalize_path(str(dest_p))
            product_cleared = True
            notes.append("product_demo_cleared_because_variant_unmarked")

    return {
        "ok": True,
        "final_variant_path": normalize_path(str(working)),
        "final_product_path": final_product_path,
        "product_cleared": product_cleared,
        "notes": notes,
    }


def _plan_product(
    product: Path,
    *,
    letter: str,
    plan_rename,
    plan_move,
) -> dict:
    notes: list[str] = []
    category_dir = product.parent
    in_archive = is_archive_segment(category_dir.name)
    if in_archive:
        live_category = category_dir.parent
    else:
        live_category = category_dir

    current_letter = status_letter_of(product.name)
    new_prod_name = with_status_suffix(product.name, letter or None)
    working = product

    # Cascade variants first (rename children), then product folder
    children = [c for c in product.iterdir() if c.is_dir() and not c.name.startswith(".")]
    # Skip nested archive noise
    child_ops_targets: list[tuple[Path, str]] = []
    for child in children:
        child_new = with_status_suffix(child.name, letter or None)
        child_ops_targets.append((child, child_new))

    for child, child_new in child_ops_targets:
        if child.name != child_new:
            plan_rename(child, child.parent / child_new, "variant_cascade")

    # Re-resolve children after planned renames (logical)
    logical_children = []
    for child, child_new in child_ops_targets:
        logical_children.append(working / child_new)

    if working.name != new_prod_name:
        dest = working.parent / new_prod_name
        plan_rename(working, dest, "product")
        working = dest
        logical_children = [working / c.name for c in logical_children]

    if letter == "X":
        arch = find_archive_dir(live_category)
        dest = arch / working.name
        if normalize_path(str(working.parent)) != normalize_path(str(arch)):
            plan_move(working, dest, "product_archive")
            working = dest
        notes.append("product_moved_to_category_archive")
    elif (current_letter == "X" or in_archive) and letter != "X":
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
        "cascaded_variants": len(child_ops_targets),
    }
