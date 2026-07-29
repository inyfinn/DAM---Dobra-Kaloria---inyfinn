"""
Explorer: create category / product from Marketing disk templates.

Templates live under:
  {marketing_base}/- POLSKA/01 - PRODUKTY/Szablony folderow/
    00 - KATEGORIA/          (DK)
      NAZWA PRODUKTU — [ podkategoria ]/   (U+2014 em dash, as on disk)
        BAT - 00 g - DD MM RRRR - 6300XXX.00/
        ...
    00 - CATEGORY/           (GC)
      PRODUCT NAME — [ subcategory ]/
        ...

Targets:
  DK: {base}/- POLSKA/01 - PRODUKTY/- DK/{NN} - {NAME}/
  GC: {base}/- EKSPORT/01 - PRODUCTS/- GC/{NN} - {NAME}/

HARD:
  - Never delete user trees (only remove leftover *template* placeholder after
    category copytree, and unused *template* variant slots inside a freshly
    copied product tree before it is exposed).
  - Real write only when dry_run is False AND confirm is True.
  - Demo suffix " - D" per lifecycle.status_fxd when demo=true or index is
    missing / matches 6300XXX.
"""
from __future__ import annotations

import re
import shutil
import time
from pathlib import Path
from typing import Any

# Product folder separator on disk templates (U+2014 EM DASH) - match disk, not UI ban.
PRODUCT_EM_DASH = "\u2014"

BRAND_FOLDER = {"DK": "- DK", "GC": "- GC"}
CATEGORY_TEMPLATE_NAME = {"DK": "00 - KATEGORIA", "GC": "00 - CATEGORY"}
PRODUCTS_REL = {
    "DK": ("- POLSKA", "01 - PRODUKTY"),
    "GC": ("- EKSPORT", "01 - PRODUCTS"),
}
# Folder name may differ by encoding/normalization; match case-insensitively.
TEMPLATES_DIR_RE = re.compile(r"^szablony\s+folder", re.IGNORECASE)
CATEGORY_NUM_RE = re.compile(r"^(\d+)\s*-\s*(.+)$")
PLACEHOLDER_DATE_TOKENS = ("DD MM RRRR", "DD MM YYYY", "DD_MM_YYYY", "DD.MM.RRRR")
PLACEHOLDER_INDEX_RE = re.compile(r"6300XXX(?:\.\d+)?", re.IGNORECASE)
DEMO_INDEX_RE = re.compile(r"^6300XXX(?:\.\d+)?$", re.IGNORECASE)
UNSAFE_NAME_RE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def _norm_brand(brand: str) -> str:
    b = (brand or "").strip().upper()
    if b not in ("DK", "GC"):
        raise ValueError("brand_must_be_DK_or_GC")
    return b


def _safe_name(name: str, *, field: str = "name") -> str:
    raw = (name or "").strip()
    if not raw:
        raise ValueError(f"{field}_required")
    cleaned = UNSAFE_NAME_RE.sub("", raw).strip(" .")
    if not cleaned or cleaned in (".", ".."):
        raise ValueError(f"{field}_invalid")
    return cleaned


def _is_demo_index(index: str | None) -> bool:
    idx = (index or "").strip()
    if not idx:
        return True
    return bool(DEMO_INDEX_RE.match(idx))


def should_append_demo(demo: bool, index: str | None = None) -> bool:
    """lifecycle.status_fxd: D = demo; missing/6300XXX index implies demo."""
    if demo:
        return True
    return _is_demo_index(index)


def append_demo_suffix(folder_name: str, *, apply: bool) -> str:
    name = (folder_name or "").rstrip()
    if not apply:
        return name
    if re.search(r"\s-\sD$", name, flags=re.IGNORECASE):
        return name
    return f"{name} - D"


def resolve_templates_dir(marketing_base: Path) -> Path | None:
    """{base}/- POLSKA/01 - PRODUKTY/Szablony folderow/ (name match flexible)."""
    produkty = marketing_base / "- POLSKA" / "01 - PRODUKTY"
    if not produkty.is_dir():
        return None
    for child in produkty.iterdir():
        if child.is_dir() and TEMPLATES_DIR_RE.match(child.name):
            return child
    # Exact common spellings
    for candidate in ("Szablony folderów", "Szablony folderow"):
        p = produkty / candidate
        if p.is_dir():
            return p
    return None


def brand_products_root(marketing_base: Path, brand: str) -> Path:
    b = _norm_brand(brand)
    rel = PRODUCTS_REL[b]
    return marketing_base.joinpath(*rel, BRAND_FOLDER[b])


def resolve_category_template(marketing_base: Path, brand: str) -> Path | None:
    templates = resolve_templates_dir(marketing_base)
    if templates is None:
        return None
    name = CATEGORY_TEMPLATE_NAME[_norm_brand(brand)]
    p = templates / name
    return p if p.is_dir() else None


def resolve_product_template(marketing_base: Path, brand: str) -> Path | None:
    cat = resolve_category_template(marketing_base, brand)
    if cat is None:
        return None
    # Prefer folder that looks like the product name template (contains " [ ").
    candidates = [c for c in cat.iterdir() if c.is_dir()]
    for c in candidates:
        if " [" in c.name and c.name.rstrip().endswith("]"):
            return c
    return candidates[0] if candidates else None


def next_category_seq(brand_root: Path) -> int:
    best = 0
    if not brand_root.is_dir():
        return 1
    for child in brand_root.iterdir():
        if not child.is_dir():
            continue
        m = CATEGORY_NUM_RE.match(child.name)
        if not m:
            continue
        try:
            best = max(best, int(m.group(1)))
        except ValueError:
            continue
    return best + 1


def format_category_folder(seq: int, name: str) -> str:
    return f"{seq:02d} - {_safe_name(name).upper()}"


def format_product_folder(name: str, subcategory: str, *, demo: bool = False) -> str:
    n = _safe_name(name).upper()
    sub = _safe_name(subcategory, field="subcategory").lower()
    base = f"{n} {PRODUCT_EM_DASH} [ {sub} ]"
    return append_demo_suffix(base, apply=demo)


def _replace_placeholders(text: str, *, date: str, index: str) -> str:
    out = text
    date_s = (date or "").strip()
    index_s = (index or "").strip()
    if date_s:
        for tok in PLACEHOLDER_DATE_TOKENS:
            out = out.replace(tok, date_s)
    if index_s:
        out = PLACEHOLDER_INDEX_RE.sub(index_s, out)
    return out


def resolve_category_path(
    marketing_base: Path,
    brand: str,
    category_path: str,
) -> Path | None:
    """Accept absolute path or path relative to brand products root / marketing base."""
    raw = (category_path or "").strip()
    if not raw:
        return None
    p = Path(raw)
    if p.is_absolute():
        return p if p.is_dir() else None
    brand_root = brand_products_root(marketing_base, brand)
    cand = brand_root / raw
    if cand.is_dir():
        return cand
    cand2 = marketing_base / raw
    if cand2.is_dir():
        return cand2
    # Relative with brand prefix omitted: "01 - BATONY"
    if brand_root.is_dir():
        for child in brand_root.iterdir():
            if child.is_dir() and child.name.lower() == Path(raw).name.lower():
                return child
    return None


def _gate_write(dry_run: bool, confirm: bool) -> dict | None:
    if dry_run:
        return None
    if not confirm:
        return {
            "ok": False,
            "error": "confirm_required",
            "message": "Zapis na dysk wymaga dry_run:false oraz confirm:true.",
        }
    return None


def next_category_seq_for_brand(marketing_base: str | Path, brand: str) -> dict[str, Any]:
    """Read-only helper: suggested next free category number (GET /explorer/next-category-seq)."""
    try:
        b = _norm_brand(brand)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}
    base = Path(str(marketing_base)).resolve()
    if not base.is_dir():
        return {"ok": False, "error": "marketing_base_not_found", "message": f"Brak bazy Marketing: {base}"}
    brand_root = brand_products_root(base, b)
    return {"ok": True, "brand": b, "suggested_seq": next_category_seq(brand_root)}


def create_category(
    *,
    marketing_base: str | Path,
    brand: str,
    name: str,
    seq: int | None = None,
    dry_run: bool = True,
    confirm: bool = False,
) -> dict[str, Any]:
    """
    POST /explorer/create-category

    Body: { brand, name, seq?, dry_run, confirm }
    `seq` (opcjonalny) nadpisuje auto-numer kategorii (edytowalny licznik w UI) -
    zawsze zwracamy `suggested_seq`, zeby UI mogl podpowiedziec domyslna wartosc.
    Returns: { ok, dry_run, planned_path, created_path?, message, suggested_seq, ... }
    """
    gate = _gate_write(bool(dry_run), bool(confirm))
    if gate:
        return gate

    try:
        b = _norm_brand(brand)
        safe = _safe_name(name)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}

    base = Path(str(marketing_base)).resolve()
    if not base.is_dir():
        return {
            "ok": False,
            "error": "marketing_base_not_found",
            "message": f"Brak bazy Marketing: {base}",
        }

    tmpl = resolve_category_template(base, b)
    expected = (
        base
        / "- POLSKA"
        / "01 - PRODUKTY"
        / "Szablony folderów"
        / CATEGORY_TEMPLATE_NAME[b]
    )
    if tmpl is None:
        return {
            "ok": False,
            "error": "template_not_found",
            "expected_path": str(expected),
            "message": (
                f"Brak szablonu kategorii {CATEGORY_TEMPLATE_NAME[b]} "
                f"w Szablony folderow."
            ),
        }

    brand_root = brand_products_root(base, b)
    suggested_seq = next_category_seq(brand_root)
    try:
        seq_val = int(seq) if seq is not None and str(seq).strip() != "" else suggested_seq
    except (TypeError, ValueError):
        seq_val = suggested_seq
    if seq_val < 1:
        seq_val = suggested_seq
    folder_name = format_category_folder(seq_val, safe)
    planned = brand_root / folder_name

    if planned.exists():
        return {
            "ok": False,
            "error": "already_exists",
            "planned_path": str(planned),
            "suggested_seq": suggested_seq,
            "message": f"Folder juz istnieje: {planned.name}",
        }

    payload: dict[str, Any] = {
        "ok": True,
        "dry_run": bool(dry_run),
        "brand": b,
        "name": safe,
        "seq": seq_val,
        "suggested_seq": suggested_seq,
        "template_path": str(tmpl),
        "planned_path": str(planned),
        "planned_tree": [str(planned)],
        "message": (
            f"Plan: skopiuj szablon kategorii -> {planned.name}"
            if dry_run
            else f"Utworzono kategorie: {planned.name}"
        ),
    }

    if dry_run:
        return payload

    try:
        brand_root.mkdir(parents=True, exist_ok=True)
        shutil.copytree(str(tmpl), str(planned))
        # Strip nested product template placeholder - category starts empty.
        # NEVER touch anything outside planned/.
        for child in list(planned.iterdir()):
            if not child.is_dir():
                continue
            if " [" in child.name and child.name.rstrip().endswith("]"):
                shutil.rmtree(str(child))
        payload["created_path"] = str(planned)
        payload["index_rebuild_suggested"] = True
        payload["index_rebuild_hint"] = "POST /index/rebuild"
        return payload
    except OSError as exc:
        # Best-effort rollback of the new tree only (never user trees).
        if planned.is_dir() and planned.resolve().is_relative_to(brand_root.resolve()):
            try:
                shutil.rmtree(str(planned))
            except OSError:
                pass
        return {"ok": False, "error": "copy_failed", "message": str(exc), "planned_path": str(planned)}


def _list_template_variants(product_tmpl: Path) -> list[str]:
    return sorted(c.name for c in product_tmpl.iterdir() if c.is_dir())


def create_product(
    *,
    marketing_base: str | Path,
    brand: str,
    category_path: str,
    name: str,
    subcategory: str,
    variants: list[dict] | None = None,
    demo: bool = False,
    dry_run: bool = True,
    confirm: bool = False,
    existing_product_path: str = "",
) -> dict[str, Any]:
    """
    POST /explorer/create-product

    Body: {
      brand, category_path, name, subcategory,
      variants: [{enabled, template_folder, date, index}],
      demo, dry_run, confirm,
      existing_product_path  # optional: add variants into existing product folder
    }
    """
    gate = _gate_write(bool(dry_run), bool(confirm))
    if gate:
        return gate

    try:
        b = _norm_brand(brand)
        safe_name = _safe_name(name)
        safe_sub = _safe_name(subcategory, field="subcategory")
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}

    base = Path(str(marketing_base)).resolve()
    if not base.is_dir():
        return {
            "ok": False,
            "error": "marketing_base_not_found",
            "message": f"Brak bazy Marketing: {base}",
        }

    existing_raw = str(existing_product_path or "").strip()
    existing_product: Path | None = None
    if existing_raw:
        cand = Path(existing_raw)
        if not cand.is_dir():
            return {
                "ok": False,
                "error": "existing_product_not_found",
                "message": f"Brak folderu produktu: {existing_raw}",
            }
        existing_product = cand.resolve()
        if not str(existing_product).lower().startswith(str(base).lower()):
            return {
                "ok": False,
                "error": "existing_product_outside_base",
                "message": "existing_product_path poza baza Marketing.",
            }

    cat = resolve_category_path(base, b, category_path)
    if cat is None and existing_product is None:
        return {
            "ok": False,
            "error": "category_not_found",
            "message": f"Nie znaleziono folderu kategorii: {category_path}",
        }

    product_tmpl = resolve_product_template(base, b)
    if product_tmpl is None:
        cat_tmpl = resolve_category_template(base, b)
        expected = str(
            (cat_tmpl or (base / "- POLSKA" / "01 - PRODUKTY" / "Szablony folderów"))
        )
        return {
            "ok": False,
            "error": "template_not_found",
            "expected_path": expected,
            "message": "Brak szablonu produktu wewnatrz 00 - KATEGORIA / 00 - CATEGORY.",
        }

    available = _list_template_variants(product_tmpl)
    var_specs: list[dict[str, Any]] = []
    for raw in variants or []:
        if not isinstance(raw, dict):
            continue
        if not bool(raw.get("enabled", True)):
            continue
        folder = str(raw.get("template_folder") or "").strip()
        if not folder:
            continue
        # Allow exact name or case-insensitive match against template children.
        match = next((a for a in available if a == folder), None)
        if match is None:
            match = next((a for a in available if a.lower() == folder.lower()), None)
        if match is None:
            return {
                "ok": False,
                "error": "variant_template_not_found",
                "template_folder": folder,
                "available_variants": available,
                "message": f"Brak wariantu szablonu: {folder}",
            }
        idx = str(raw.get("index") or "").strip()
        date = str(raw.get("date") or "").strip()
        var_demo = should_append_demo(bool(demo), idx)
        new_name = _replace_placeholders(match, date=date, index=idx)
        new_name = append_demo_suffix(new_name, apply=var_demo)
        var_specs.append(
            {
                "template_folder": match,
                "date": date,
                "index": idx,
                "planned_name": new_name,
                "demo_suffix": var_demo,
            }
        )

    # --- mode add-variant: copy only selected variants into existing product ---
    if existing_product is not None:
        if not var_specs:
            if dry_run:
                return {
                    "ok": True,
                    "mode": "add-variant",
                    "dry_run": True,
                    "bootstrap": True,
                    "brand": b,
                    "name": safe_name or existing_product.name,
                    "subcategory": safe_sub,
                    "demo": bool(demo),
                    "category_path": str(cat) if cat is not None else str(existing_product.parent),
                    "template_path": str(product_tmpl),
                    "available_variants": available,
                    "variants_planned": [],
                    "planned_path": str(existing_product),
                    "planned_tree": [str(existing_product)],
                    "existing_product_path": str(existing_product),
                    "message": "Wybierz warianty ze Szablonów.",
                }
            return {
                "ok": False,
                "error": "variants_required",
                "message": "Wybierz co najmniej jeden wariant ze Szablonow.",
            }
        planned_tree = [str(existing_product / v["planned_name"]) for v in var_specs]
        for v in var_specs:
            dest = existing_product / v["planned_name"]
            if dest.exists():
                return {
                    "ok": False,
                    "error": "variant_already_exists",
                    "planned_path": str(dest),
                    "message": f"Wariant juz istnieje: {v['planned_name']}",
                }
        payload: dict[str, Any] = {
            "ok": True,
            "mode": "add-variant",
            "dry_run": bool(dry_run),
            "brand": b,
            "name": safe_name or existing_product.name,
            "subcategory": safe_sub,
            "demo": bool(demo),
            "category_path": str(cat) if cat is not None else str(existing_product.parent),
            "template_path": str(product_tmpl),
            "available_variants": available,
            "variants_planned": var_specs,
            "planned_path": str(existing_product),
            "planned_tree": planned_tree,
            "existing_product_path": str(existing_product),
            "message": (
                f"Plan: dodaj warianty do {existing_product.name}"
                if dry_run
                else f"Dodano warianty do: {existing_product.name}"
            ),
        }
        if dry_run:
            return payload
        created_paths: list[str] = []
        try:
            for v in var_specs:
                src = product_tmpl / v["template_folder"]
                dest = existing_product / v["planned_name"]
                shutil.copytree(str(src), str(dest))
                created_paths.append(str(dest))
                _rename_placeholder_files(
                    dest,
                    product_name=safe_name or existing_product.name,
                    date=v.get("date") or "",
                    index=v.get("index") or "",
                )
            payload["created_path"] = str(existing_product)
            payload["created_paths"] = created_paths
            payload["index_rebuild_suggested"] = True
            payload["index_rebuild_hint"] = "POST /index/rebuild"
            return payload
        except OSError as exc:
            for p in created_paths:
                try:
                    pp = Path(p)
                    if pp.is_dir() and pp.resolve().is_relative_to(existing_product.resolve()):
                        shutil.rmtree(str(pp))
                except OSError:
                    pass
            return {
                "ok": False,
                "error": "copy_failed",
                "message": str(exc),
                "planned_path": str(existing_product),
                "mode": "add-variant",
            }

    # Product-level demo: explicit flag OR any variant with missing/6300XXX index
    # OR no variants (placeholder product).
    product_demo = bool(demo)
    if not product_demo:
        if not var_specs:
            product_demo = True
        else:
            product_demo = any(_is_demo_index(v.get("index")) for v in var_specs)

    product_folder = format_product_folder(safe_name, safe_sub, demo=product_demo)
    planned_product = cat / product_folder

    if planned_product.exists():
        return {
            "ok": False,
            "error": "already_exists",
            "planned_path": str(planned_product),
            "available_variants": available,
            "message": f"Produkt juz istnieje: {product_folder}",
        }

    planned_tree = [str(planned_product)]
    for v in var_specs:
        planned_tree.append(str(planned_product / v["planned_name"]))

    payload = {
        "ok": True,
        "dry_run": bool(dry_run),
        "brand": b,
        "name": safe_name,
        "subcategory": safe_sub,
        "demo": product_demo,
        "category_path": str(cat),
        "template_path": str(product_tmpl),
        "available_variants": available,
        "variants_planned": var_specs,
        "planned_path": str(planned_product),
        "planned_tree": planned_tree,
        "message": (
            f"Plan: skopiuj szablon produktu -> {product_folder}"
            if dry_run
            else f"Utworzono produkt: {product_folder}"
        ),
    }

    if dry_run:
        return payload

    try:
        shutil.copytree(str(product_tmpl), str(planned_product))
        created_paths = [str(planned_product)]

        # Keep only selected variants; rename placeholders. Never touch sibling
        # products - we only mutate inside the freshly copied planned_product.
        keep_templates = {v["template_folder"] for v in var_specs}
        if var_specs:
            for child in list(planned_product.iterdir()):
                if not child.is_dir():
                    continue
                if child.name not in keep_templates:
                    shutil.rmtree(str(child))
                    continue
                spec = next(v for v in var_specs if v["template_folder"] == child.name)
                dest = planned_product / spec["planned_name"]
                if child.name != spec["planned_name"]:
                    if dest.exists():
                        shutil.rmtree(str(dest))
                    child.rename(dest)
                created_paths.append(str(dest))
                # Light rename of placeholder files inside variant (name/index).
                _rename_placeholder_files(
                    dest,
                    product_name=safe_name,
                    date=spec.get("date") or "",
                    index=spec.get("index") or "",
                )
        else:
            # Full template tree kept; still try placeholder renames on all variants.
            for child in planned_product.iterdir():
                if child.is_dir():
                    created_paths.append(str(child))
                    _rename_placeholder_files(
                        child,
                        product_name=safe_name,
                        date="",
                        index="",
                    )

        payload["created_path"] = str(planned_product)
        payload["created_paths"] = created_paths
        payload["index_rebuild_suggested"] = True
        payload["index_rebuild_hint"] = "POST /index/rebuild"
        return payload
    except OSError as exc:
        if planned_product.is_dir() and planned_product.resolve().is_relative_to(cat.resolve()):
            try:
                shutil.rmtree(str(planned_product))
            except OSError:
                pass
        return {
            "ok": False,
            "error": "copy_failed",
            "message": str(exc),
            "planned_path": str(planned_product),
        }


UNDO_WINDOW_SECONDS = 150  # ~2 min zapasu (UI liczy 120s, most akceptuje troche wiecej)


def undo_create(
    *,
    marketing_base: str | Path,
    path: str,
    max_age_seconds: int = UNDO_WINDOW_SECONDS,
) -> dict[str, Any]:
    """
    POST /explorer/undo-create

    Cofniecie swiezo utworzonej kategorii/produktu (2-minutowe okno). Usuwa
    WYLACZNIE `path` zwrocony jako created_path przez create_category/create_product -
    nigdy drzewa usera. Bezpieczniki:
      - path musi byc W OBREBIE marketing_base,
      - path musi istniec i byc katalogiem,
      - katalog musi byc utworzony niedawno (st_ctime < max_age_seconds temu) -
        to blokuje przypadkowe usuniecie starszego, prawdziwego folderu.
    """
    base = Path(str(marketing_base)).resolve()
    if not base.is_dir():
        return {"ok": False, "error": "marketing_base_not_found", "message": f"Brak bazy Marketing: {base}"}

    raw = (path or "").strip()
    if not raw:
        return {"ok": False, "error": "path_required"}

    try:
        target = Path(raw).resolve()
    except OSError:
        return {"ok": False, "error": "invalid_path"}

    if not target.is_dir():
        return {"ok": False, "error": "not_found", "message": f"Folder nie istnieje (juz cofniete?): {target}"}

    try:
        target.relative_to(base)
    except ValueError:
        return {"ok": False, "error": "outside_marketing_base", "message": "Sciezka poza baza Marketing - odmowa."}

    try:
        age = time.time() - target.stat().st_ctime
    except OSError as exc:
        return {"ok": False, "error": "stat_failed", "message": str(exc)}

    if age > max_age_seconds:
        return {
            "ok": False,
            "error": "undo_window_expired",
            "message": f"Okno cofniecia ({max_age_seconds}s) minelo - folder utworzony {int(age)}s temu.",
        }

    try:
        shutil.rmtree(str(target))
    except OSError as exc:
        return {"ok": False, "error": "delete_failed", "message": str(exc)}

    return {"ok": True, "deleted_path": str(target)}


def _rename_placeholder_files(
    variant_dir: Path,
    *,
    product_name: str,
    date: str,
    index: str,
) -> None:
    """Rename files under a freshly copied variant when placeholders remain."""
    name_token = _safe_name(product_name)
    for path in sorted(variant_dir.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if not path.is_file():
            continue
        new_name = _replace_placeholders(path.name, date=date, index=index)
        # Common DK/GC template tokens
        new_name = new_name.replace("NAZWA", name_token)
        new_name = new_name.replace("NAME", name_token)
        if new_name != path.name:
            dest = path.with_name(new_name)
            if not dest.exists():
                try:
                    path.rename(dest)
                except OSError:
                    pass
