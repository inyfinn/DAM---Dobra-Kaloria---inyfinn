#!/usr/bin/env python3
"""
Bake the real DAM sidebar (nav + logo) into static HTML so the correct
interface shows at first paint — no Geex-demo skeleton, no JS interface
rewrite layer. dam-shell.js stays idempotent (only active state + i18n text).

Language overlays (data-i18n) remain; interface overlays are removed.

Replaces, in every page that has a Geex sidebar:
  * <ul class="geex-sidebar__menu"> ...demo... </ul>  -> DAM nav (data-dam-nav)
  * sidebar logo <img> -> Dobra Kaloria logo

Idempotent: skips pages whose menu already has data-dam-nav.

Usage:
    python bin/scripts/qa/bake-dam-shell-static.py [--dry] [--only dashboard.html]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent.parent / "apps" / "web"

# key -> (href, uil icon, i18n, PL label)
NAV = [
    ("dashboard", "dashboard.html", "uil-apps", "nav.dashboard", "Dashboard"),
    ("explorer", "explorer.html", "uil-sitemap", "nav.explorer", "Eksplorer"),
    ("visualizations", "visualizations.html", "uil-image", "nav.visualizations", "Wizualizacje"),
    ("branding", "branding.html", "uil-palette", "nav.branding", "Branding"),
    ("projects", "index.html", "uil-box", "nav.projects", "Projekty"),
    ("inbox", "inbox.html", "uil-envelope", "nav.inbox", "Wiadomości"),
    ("tasks", "tasks.html", "uil-check-square", "nav.tasks", "Zadania"),
    ("invoices", "invoices.html", "uil-invoice", "nav.invoices", "Faktury"),
    ("costs", "costs.html", "uil-calculator-alt", "nav.costs", "Kalkulator kosztów"),
    ("integrations", "integrations.html", "uil-plug", "nav.integrations", "Integracja i produkcja"),
]

# filename -> active nav key
PAGE_KEY = {
    "dashboard.html": "dashboard",
    "explorer.html": "explorer",
    "visualizations.html": "visualizations",
    "branding.html": "branding",
    "index.html": "projects",
    "project.html": "projects",
    "inbox.html": "inbox",
    "tasks.html": "tasks",
    "invoices.html": "invoices",
    "costs.html": "costs",
    "integrations.html": "integrations",
}

ICON_STYLE = 'style="font-size:20px;margin-right:8px;width:22px;text-align:center"'
LOGO_SRC = "assets/img/logo-dk-green.svg"


def build_header_menu(active_key: str) -> str:
    lines = ['<ul class="geex-header__menu" data-dam-nav="1">']
    for key, href, icon, i18n, label in NAV:
        on = key == active_key
        li_cls = "geex-header__menu__item" + (" active" if on else "")
        a_cls = "geex-header__menu__link" + (" active" if on else "")
        aria = ' aria-current="page"' if on else ""
        lines.append(
            f'\t\t\t\t<li class="{li_cls}">'
            f'<a href="{href}" class="{a_cls}"{aria}>'
            f'<i class="uil {icon}" style="font-size:18px;margin-right:6px"></i>'
            f'<span data-i18n="{i18n}">{label}</span>'
            f"</a></li>"
        )
    lines.append("\t\t\t</ul>")
    return "\n".join(lines)


def build_menu(active_key: str) -> str:
    lines = ['<ul class="geex-sidebar__menu" data-dam-nav="1">']
    for key, href, icon, i18n, label in NAV:
        on = key == active_key
        li_cls = "geex-sidebar__menu__item" + (" active" if on else "")
        a_cls = "geex-sidebar__menu__link" + (" active" if on else "")
        aria = ' aria-current="page"' if on else ""
        lines.append(
            f'\t\t\t\t<li class="{li_cls}">'
            f'<a href="{href}" class="{a_cls}"{aria} title="{label}" aria-label="{label}">'
            f'<i class="uil {icon}" aria-hidden="true" {ICON_STYLE}></i>'
            f'<span class="dam-nav-label" data-i18n="{i18n}">{label}</span>'
            f"</a></li>"
        )
    lines.append(
        '\t\t\t\t<li class="geex-sidebar__menu__item dam-nav-device-session">'
        '<a href="profile.html#damDevicePathsRoot" class="geex-sidebar__menu__link dam-device-session-btn" '
        'id="damShellDeviceSession" title="Sesja urządzenia - ścieżki Marketing" aria-label="Sesja urządzenia" '
        'data-dam-tip="Sesja urządzenia: ścieżki Marketing na tym PC">'
        f'<i class="uil uil-desktop" aria-hidden="true" {ICON_STYLE}></i>'
        '<span class="dam-nav-label">Sesja urządzenia</span></a></li>'
    )
    lines.append(
        '\t\t\t\t<li class="geex-sidebar__menu__item dam-nav-logout">'
        '<a href="#" class="geex-sidebar__menu__link dam-logout-btn" id="damShellLogout" '
        'title="Wyloguj" aria-label="Wyloguj" data-dam-tip="Wyloguj z konta DAM">'
        f'<i class="uil uil-signout" aria-hidden="true" {ICON_STYLE}></i>'
        '<span class="dam-nav-label" data-i18n="nav.logout">Wyloguj</span></a></li>'
    )
    lines.append(
        '\t\t\t\t<li class="geex-sidebar__menu__item dam-nav-version" aria-hidden="true">'
        '<span class="dam-sidebar-version" id="damSidebarVersion" title="Wersja programu DAM"></span></li>'
    )
    lines.append("\t\t\t</ul>")
    return "\n".join(lines)


def replace_ul(html: str, ul_class: str, new_html: str) -> tuple[str, bool]:
    start = html.find('<ul class="' + ul_class + '"')
    if start < 0:
        return html, False
    if html[start:start + 200].find("data-dam-nav") >= 0:
        return html, False  # already baked
    depth = 0
    end = -1
    for m in re.finditer(r"<ul\b|</ul>", html[start:]):
        if m.group(0) == "</ul>":
            depth -= 1
            if depth == 0:
                end = start + m.end()
                break
        else:
            depth += 1
    if end < 0:
        return html, False
    return html[:start] + new_html + html[end:], True


LOGO_BLOCK_RE = re.compile(
    r'(<a[^>]*class="geex-sidebar__logo"[^>]*>)(.*?)(</a>)',
    re.IGNORECASE | re.DOTALL,
)


def replace_logo(html: str) -> tuple[str, bool]:
    def repl(mm):
        inner = (
            f'\n\t\t\t\t<img class="logo-lite dam-logo-dk" src="{LOGO_SRC}" alt="Dobra Kaloria" width="150" height="48" />'
            f'\n\t\t\t\t<img class="logo-dark dam-logo-dk" src="{LOGO_SRC}" alt="Dobra Kaloria" width="150" height="48" />\n\t\t\t'
        )
        opening = re.sub(r'href="[^"]*"', 'href="dashboard.html"', mm.group(1))
        return opening + inner + mm.group(3)

    new = LOGO_BLOCK_RE.sub(repl, html, count=1)
    return new, new != html


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    files = sorted(WEB.glob("*.html"))
    if args.only:
        files = [WEB / args.only]

    changed = 0
    for f in files:
        html = f.read_text(encoding="utf-8")
        has_side = 'class="geex-sidebar__menu"' in html
        has_head = 'class="geex-header__menu"' in html
        if not has_side and not has_head:
            continue
        active = PAGE_KEY.get(f.name, "")
        new = html
        new, ok_menu = replace_ul(new, "geex-sidebar__menu", build_menu(active))
        new, ok_head = replace_ul(new, "geex-header__menu", build_header_menu(active))
        new, ok_logo = replace_logo(new)
        if not (ok_menu or ok_head or ok_logo):
            print(f"skip (already baked): {f.name}")
            continue
        if args.dry:
            print(f"[dry] {f.name}: side={ok_menu} head={ok_head} logo={ok_logo} active={active or '-'}")
        else:
            f.write_text(new, encoding="utf-8")
            print(f"baked {f.name}: side={ok_menu} head={ok_head} logo={ok_logo} active={active or '-'}")
        changed += 1
    print(f"done: {changed} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
