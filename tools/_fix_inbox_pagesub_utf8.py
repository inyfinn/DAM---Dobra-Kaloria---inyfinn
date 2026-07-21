# -*- coding: utf-8 -*-
"""UTF-8 safe: shorten page-subs, fix mojibake, Jost 300, cache-bust i18n/shell/css."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "apps" / "web"
NBSP = "\u00A0"

INBOX_SUB = (
    f"Zadania i{NBSP}zgłoszenia. Filtr po{NBSP}źródle. "
    f"Po{NBSP}72{NBSP}h bez decyzji{NBSP}-{NBSP}przypomnienie. "
    f"Nic nie zapisuje się samo."
)
BRANDING_SUB = f"Reklamy, filmy i{NBSP}grafiki marki. Szukaj albo kliknij tag."
EXPLORER_SUB = f"Pełna struktura produktów Dobra Kaloria i{NBSP}Good Calories"
INDEX_SUB = f"Lista projektów opakowań i{NBSP}ich kompletności plików."

I18N_V = "i18nboot20260721a"
SHELL_V = "i18nboot20260721a"
APP_CSS_V = "pagesub20260721a"
FONT_OLD = "family=Jost:wght@400;500;600;700"
FONT_NEW = "family=Jost:wght@300;400;500;600;700"


def replace_once(text: str, old: str, new: str) -> str:
    if old not in text:
        return text
    return text.replace(old, new, 1)


def patch_html(path: Path) -> list[str]:
    notes = []
    raw = path.read_bytes()
    text = raw.decode("utf-8")
    name = path.name

    if FONT_OLD in text:
        text = text.replace(FONT_OLD, FONT_NEW)
        notes.append("jost300")

    # cache-bust shared modules
    import re

    def bump(pat: str, ver: str, label: str):
        nonlocal text
        ntext, n = re.subn(pat, rf"\1{ver}", text)
        if n:
            text = ntext
            notes.append(f"{label}x{n}")

    bump(r"(dam-i18n\.js\?v=)[^\"'\s>]+", I18N_V, "i18n")
    bump(r"(dam-shell\.js\?v=)[^\"'\s>]+", SHELL_V, "shell")
    bump(r"(dam-app\.css\?v=)[^\"'\s>]+", APP_CSS_V, "appcss")

    if name == "inbox.html":
        # replace subtitle paragraph (any current content)
        text2, n = re.subn(
            r'(<p class="geex-content__header__subtitle dam-page-sub")[^>]*>(.*?)</p>',
            rf'\1 data-i18n="messages.subtitle">{INBOX_SUB}</p>',
            text,
            count=1,
            flags=re.S,
        )
        if n:
            text = text2
            notes.append("inbox-sub")
        else:
            notes.append("inbox-sub-MISS")

    if name == "branding.html":
        text2, n = re.subn(
            r'(<p class="geex-content__header__subtitle dam-page-sub")[^>]*>(.*?)</p>',
            rf'\1 data-i18n="branding.subtitle">{BRANDING_SUB}</p>',
            text,
            count=1,
            flags=re.S,
        )
        if n:
            text = text2
            notes.append("branding-sub")
        else:
            notes.append("branding-sub-MISS")

    if name == "explorer.html":
        # only content-header subtitle (not popup CEO ThemeWant)
        marker = 'class="geex-content__header__title"'
        idx = text.find(marker)
        if idx >= 0:
            chunk = text[idx : idx + 500]
            m = re.search(
                r'<p class="geex-content__header__subtitle"[^>]*>.*?</p>',
                chunk,
                flags=re.S,
            )
            if m:
                new_p = (
                    f'<p class="geex-content__header__subtitle" data-i18n="explorer.subtitle">'
                    f"{EXPLORER_SUB}</p>"
                )
                text = text[: idx + m.start()] + new_p + text[idx + m.end() :]
                notes.append("explorer-sub")

    if name == "index.html":
        text2, n = re.subn(
            r'(<p class="geex-content__header__subtitle dam-page-sub")[^>]*>(.*?)</p>',
            rf'\1 data-i18n="projects.subtitle">{INDEX_SUB}</p>',
            text,
            count=1,
            flags=re.S,
        )
        if n:
            text = text2
            notes.append("index-sub")

    out = text.encode("utf-8")
    if out != raw:
        path.write_bytes(out)
        notes.append("wrote")
    return notes


def patch_pl_json():
    p = ROOT / "i18n" / "pl.json"
    import json

    data = json.loads(p.read_text(encoding="utf-8"))
    data["messages.subtitle"] = INBOX_SUB
    data["messages.title"] = "Wiadomości"
    data["branding.subtitle"] = BRANDING_SUB
    data["explorer.subtitle"] = EXPLORER_SUB
    data["projects.subtitle"] = INDEX_SUB
    # keep keys unique - json load already collapsed dupes if any
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return ["pl.json"]


def patch_en_json():
    p = ROOT / "i18n" / "en.json"
    import json

    data = json.loads(p.read_text(encoding="utf-8"))
    data["messages.subtitle"] = (
        f"Tasks and{NBSP}requests. Filter by{NBSP}source. "
        f"Reminder after{NBSP}72{NBSP}h with{NBSP}no{NBSP}decision. Nothing saves itself."
    )
    data["branding.subtitle"] = (
        f"Brand ads, films and{NBSP}graphics. Search or{NBSP}click a{NBSP}tag."
    )
    data["projects.subtitle"] = (
        f"Packaging projects and{NBSP}file completeness."
    )
    if "explorer.subtitle" in data:
        data["explorer.subtitle"] = (
            f"Full product structure for Dobra Kaloria and{NBSP}Good Calories"
        )
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return ["en.json"]


def main():
    report = []
    for html in sorted(ROOT.glob("*.html")):
        notes = patch_html(html)
        if notes:
            report.append(f"{html.name}: {', '.join(notes)}")
    report.append("i18n: " + ", ".join(patch_pl_json() + patch_en_json()))
    out = ROOT.parents[1] / "tools" / "_fix_inbox_pagesub_report.txt"
    out.write_text("\n".join(report), encoding="utf-8")
    print(out.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
