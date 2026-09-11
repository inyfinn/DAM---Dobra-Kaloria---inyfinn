"""
Device-scoped Marketing path resolution for DAM bridge.

Roots = user-device-paths (current device) + MARKETING_CANDIDATES + machine-config.
Never invent Synology as the reason a path failed - that is UI / file-availability.
"""
from __future__ import annotations

import os
import re
import time
from pathlib import Path
from typing import Callable, Optional, Sequence

# Default candidates when bridge has not injected its list yet.
DEFAULT_MARKETING_CANDIDATES: tuple[Path, ...] = (
    Path("X:/Marketing"),
    Path("D:/Marketing"),
    Path("M:/"),
)


def _norm(p: str | Path) -> str:
    s = str(p or "").strip().replace("/", "\\")
    while "\\\\" in s:
        s = s.replace("\\\\", "\\")
    return s


def marketing_roots(
    *,
    email: str = "",
    resolve_base_path: Optional[Callable[[str], dict]] = None,
    marketing_candidates: Sequence[Path] = DEFAULT_MARKETING_CANDIDATES,
    machine_config_path: Optional[Path] = None,
) -> list[Path]:
    """Ordered unique roots: UDP current → machine-config → candidates."""
    roots: list[Path] = []
    seen: set[str] = set()

    def add(p: Path | str | None) -> None:
        if not p:
            return
        try:
            rp = Path(str(p)).resolve()
        except OSError:
            rp = Path(str(p))
        key = str(rp).lower()
        if key in seen:
            return
        seen.add(key)
        roots.append(rp)

    if resolve_base_path and email:
        try:
            info = resolve_base_path(email) or {}
            add(info.get("base_path") or "")
        except Exception:
            pass

    if machine_config_path and machine_config_path.is_file():
        try:
            import json

            data = json.loads(machine_config_path.read_text(encoding="utf-8"))
            add((data.get("base_path") or data.get("path") or "").strip())
        except (OSError, ValueError, TypeError):
            pass

    for c in marketing_candidates:
        add(c)
    return roots


def is_under_marketing(
    path: Path | str,
    *,
    email: str = "",
    resolve_base_path: Optional[Callable[[str], dict]] = None,
    marketing_candidates: Sequence[Path] = DEFAULT_MARKETING_CANDIDATES,
    machine_config_path: Optional[Path] = None,
) -> bool:
    try:
        resolved = Path(path).resolve()
    except OSError:
        return False
    for root in marketing_roots(
        email=email,
        resolve_base_path=resolve_base_path,
        marketing_candidates=marketing_candidates,
        machine_config_path=machine_config_path,
    ):
        try:
            resolved.relative_to(root)
            return True
        except (ValueError, OSError):
            continue
    return False


def marketing_relative_key(
    path: Path | str,
    *,
    email: str = "",
    resolve_base_path: Optional[Callable[[str], dict]] = None,
    marketing_candidates: Sequence[Path] = DEFAULT_MARKETING_CANDIDATES,
    machine_config_path: Optional[Path] = None,
) -> str:
    """Relative key under Marketing root (forward slashes, lower drive-agnostic)."""
    try:
        resolved = Path(path).resolve()
    except OSError:
        resolved = Path(_norm(path))
    for root in marketing_roots(
        email=email,
        resolve_base_path=resolve_base_path,
        marketing_candidates=marketing_candidates,
        machine_config_path=machine_config_path,
    ):
        try:
            rel = resolved.relative_to(root)
            return str(rel).replace("\\", "/").lstrip("/")
        except (ValueError, OSError):
            continue
    # Fallback: basename chain without drive
    s = _norm(resolved)
    if len(s) >= 2 and s[1] == ":":
        s = s[2:]
    return s.replace("\\", "/").lstrip("/")


def resolve_physical_path(
    path: str,
    email: str = "",
    *,
    normalize_path: Optional[Callable[[str], str]] = None,
    resolve_base_path: Optional[Callable[[str], dict]] = None,
    marketing_candidates: Sequence[Path] = DEFAULT_MARKETING_CANDIDATES,
    machine_config_path: Optional[Path] = None,
    fuzzy_resolve: Optional[Callable[[str], Optional[str]]] = None,
) -> str:
    """
    Resolve user/index path to a physical file path on the current device.

    1) normalize
    2) if file exists → return
    3) rebase relative key onto each marketing root
    4) optional fuzzy_resolve (bridge rename drift)
    """
    raw = (path or "").strip()
    if not raw:
        return ""
    if normalize_path:
        target = normalize_path(raw)
    else:
        target = os.path.normpath(raw.replace("/", "\\"))

    try:
        if os.path.isfile(target):
            return target
    except OSError:
        pass

    rel = marketing_relative_key(
        target,
        email=email,
        resolve_base_path=resolve_base_path,
        marketing_candidates=marketing_candidates,
        machine_config_path=machine_config_path,
    )
    if rel:
        for root in marketing_roots(
            email=email,
            resolve_base_path=resolve_base_path,
            marketing_candidates=marketing_candidates,
            machine_config_path=machine_config_path,
        ):
            cand = root / Path(rel.replace("/", os.sep))
            try:
                if cand.is_file():
                    return str(cand)
            except OSError:
                continue

    if fuzzy_resolve:
        try:
            hit = fuzzy_resolve(target)
            if hit:
                return hit
        except Exception:
            pass
    return target


# Extra document roots outside the Marketing tree (karty / finished OK.pdf).
# D first, then G (network twin). Projekty wstępne wins for *- OK.pdf.
EXTRA_KARTA_ROOTS: tuple[Path, ...] = (
    Path(r"D:\Projekty opakowań"),
    Path(r"G:\Projekty opakowań"),
)
EXTRA_OK_ROOTS: tuple[Path, ...] = (
    Path(r"D:\Projekty wstępne"),
    Path(r"D:\Projekty opakowań"),
    Path(r"G:\Projekty opakowań"),
)
EXTRA_DOC_ROOTS: tuple[Path, ...] = EXTRA_KARTA_ROOTS + (Path(r"D:\Projekty wstępne"),)

_INDEX7_RE = re.compile(r"(?<!\d)(\d{7})(?!\d)")
_OK_PDF_RE = re.compile(r"[\s_\-]ok(?:\s|\.|$)", re.I)
_EXTRAS_CACHE: tuple[float, dict[str, dict[str, str]]] | None = None
_EXTRAS_TTL_SEC = 60.0


def _path_upper(p: str) -> str:
    return str(p or "").replace("/", "\\").upper()


def is_ready_elements_path(path: str) -> bool:
    """Gotowe ELEMENTY only — never Adobe Links / empty slot name."""
    pa = _path_upper(path)
    ready = (
        "\\ELEMENTY\\" in pa
        or pa.endswith("\\ELEMENTY")
        or "\\ELEMENTS\\" in pa
        or "\\SKLADNIKI\\" in pa
        or "\\SKŁADNIKI\\" in pa
        or "\\INGREDIENTS\\" in pa
    )
    if not ready:
        return False
    # Links inside ELEMENTY still count; Links-only does not.
    if ("\\LINKS\\" in pa or "\\LINKI\\" in pa) and (
        "\\ELEMENTY\\" not in pa and "\\ELEMENTS\\" not in pa
    ):
        return False
    return True


def is_preview_filename(name: str) -> bool:
    u = str(name or "").upper()
    ext = Path(str(name or "")).suffix.lower()
    if re.search(r"\bPREV\b", u):
        return True
    folded = u.replace("Ą", "A")
    if ext == ".pdf" and "PODGLAD" in folded:
        return True
    if re.search(r"[-_]F([-_.]|$)", u) and "FQ" not in u:
        return True
    return False


def is_artwork_filename(name: str) -> bool:
    return Path(str(name or "")).suffix.lower() in {".ai", ".psd", ".indd"}


def is_print_filename(name: str) -> bool:
    u = str(name or "").upper()
    ext = Path(str(name or "")).suffix.lower()
    if ext in {".zip", ".rar", ".7z"}:
        return True
    return "FQ" in u and ext in {".pdf", ".ai"}


def extras_digits(index: str) -> str:
    d = re.sub(r"\D", "", str(index or ""))
    return d[:7] if len(d) >= 7 else ""


def scan_extra_documents() -> dict[str, dict[str, str]]:
    """7-digit index -> {karta, presentation} paths. First-wins (D before G)."""
    global _EXTRAS_CACHE
    now = time.time()
    if _EXTRAS_CACHE is not None and (now - _EXTRAS_CACHE[0]) < _EXTRAS_TTL_SEC:
        return _EXTRAS_CACHE[1]
    out: dict[str, dict[str, str]] = {}

    def walk_roots(roots: tuple[Path, ...], kind: str) -> None:
        for root in roots:
            try:
                if not root.is_dir():
                    continue
            except OSError:
                continue
            try:
                for dirpath, _dirnames, filenames in os.walk(root):
                    for fn in filenames:
                        m = _INDEX7_RE.search(fn)
                        if not m:
                            continue
                        digits = m.group(1)
                        slot = out.setdefault(digits, {})
                        ext = Path(fn).suffix.lower()
                        low = fn.lower()
                        full = str(Path(dirpath) / fn)
                        if kind == "karta" and ext in {".xlsx", ".xls", ".xlsm"} and "karta" in low:
                            slot.setdefault("karta", full)
                        elif kind == "ok" and ext == ".pdf" and _OK_PDF_RE.search(low):
                            slot.setdefault("presentation", full)
            except OSError:
                continue

    walk_roots(EXTRA_KARTA_ROOTS, "karta")
    walk_roots(EXTRA_OK_ROOTS, "ok")
    _EXTRAS_CACHE = (now, out)
    return out


def extras_for_index(index: str) -> dict[str, str]:
    digits = extras_digits(index)
    if not digits:
        return {}
    return scan_extra_documents().get(digits) or {}


def revision_checklist(
    rev: dict,
    extras: dict[str, str] | None = None,
) -> tuple[dict[str, bool], dict[str, str]]:
    """Truth flags + open-paths from files_by_role. Never green on empty ELEMENTY slot."""
    fbr = (rev or {}).get("files_by_role") or {}
    src = list(fbr.get("source") or [])
    prt = list(fbr.get("print") or [])
    viz = list(fbr.get("viz") or [])
    wizki = list((rev or {}).get("wizki") or [])
    elements = list(fbr.get("elements") or [])
    extras = extras or {}

    def _name(f: dict) -> str:
        return str((f or {}).get("name") or "")

    def _path(f: dict) -> str:
        return str((f or {}).get("path") or (f or {}).get("folder") or "")

    ready_el = [f for f in elements if is_ready_elements_path(_path(f) or _name(f))]
    artwork_f = [f for f in src if is_artwork_filename(_name(f))]
    prev_f = [f for f in src if is_preview_filename(_name(f))]
    print_f = prt[:] or [f for f in src if is_print_filename(_name(f))]
    viz_f = [
        f
        for f in (viz + wizki)
        if Path(_name(f)).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".gif"}
    ]
    karta_f = list(fbr.get("karty_wprowadzenia") or [])
    prez_f = list(fbr.get("strategia") or [])

    flags = {
        "artwork": bool(artwork_f),
        "prev": bool(prev_f),
        "print_pdf": bool(print_f),
        "viz_3d": bool(viz_f),
        "tech": bool(ready_el),
        "marketing": False,
        "karta": bool(karta_f) or bool(extras.get("karta")),
        "presentation": bool(prez_f) or bool(extras.get("presentation")),
    }
    paths = {
        "artwork": (_path(artwork_f[0]) if artwork_f else "") or extras.get("presentation", ""),
        "prev": _path(prev_f[0]) if prev_f else "",
        "print_pdf": _path(print_f[0]) if print_f else "",
        "viz_3d": _path(viz_f[0]) if viz_f else "",
        "tech": _path(ready_el[0]) if ready_el else "",
        "marketing": "",
        "karta": (_path(karta_f[0]) if karta_f else "") or extras.get("karta", ""),
        "presentation": (_path(prez_f[0]) if prez_f else "") or extras.get("presentation", ""),
    }
    return flags, paths
