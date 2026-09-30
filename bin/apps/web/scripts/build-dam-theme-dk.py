# -*- coding: utf-8 -*-
"""Generuje bin/apps/web/assets/css/dam-theme-dk.css (styl Dobra Kaloria w DAM).
Uruchom: python bin/apps/web/scripts/build-dam-theme-dk.py (po zmianie arkuszy dam-*.css).
Listy selektorow (tekst na akcencie, szary tekst pomocniczy) pochodza ze skanu arkuszy dam-*.css."""
import re
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]  # bin/apps/web
CSS = WEB / "assets" / "css"
OUT = CSS / "dam-theme-dk.css"
S = 'html[data-dam-style="dk"]'
W = ':where(html[data-dam-style="dk"])'


def rules(skip_dark=True):
    for f in sorted(CSS.glob("dam-*.css")):
        if f.name == "dam-theme-dk.css" or (skip_dark and f.name.startswith("dam-dark-")):
            continue
        txt = re.sub(r"/\*.*?\*/", "", f.read_text(encoding="utf-8", errors="replace"), flags=re.S)
        for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", txt):
            sel, body = m.group(1).strip(), m.group(2)
            if sel.startswith("@"):
                continue
            yield f.name, sel, body


# 1) tekst na wypelnieniu akcentem
BG = re.compile(r"background(?:-color)?\s*:\s*([^;]*)", re.I)
FGW = re.compile(r"(?<![-\w])color\s*:\s*(#fff\b|#ffffff\b|white\b|var\(--white-color[^;]*\))", re.I)
onacc = []
for fn, sel, body in rules(skip_dark=False):
    bm = BG.search(body)
    if not bm:
        continue
    val = bm.group(1)
    if not re.match(r"\s*var\(--(dam-primary|primary-color)\b(?!-hover)", val):
        continue
    if not FGW.search(body):
        continue
    for s in sel.split(","):
        s = s.strip()
        s = re.sub(r'^html(\.dark|\[data-theme="?dark"?\])\s+', "", s)
        if not s or "data-theme" in s or "geex-btn--primary" in s and "project-card" not in s or ".dam-btn-primary" in s:
            continue
        if s.startswith(".geex-btn:not("):
            s = s.replace(":not(.geex-btn--success)", ":not(.geex-btn--success):not(.geex-btn--primary)")
        if s not in onacc:
            onacc.append(s)
for s in [".dam-viz-card__variant-badge", "#damDbAutoBtn.is-on", '#damDbAutoBtn[aria-pressed="true"]',
          ".dam-db-mode-chip.is-on", "#settingsSave", "#damSchemeOpenPicker",
          "#damSchemePickerOverlay .dam-scheme-picker__foot [data-scheme-picker-close]",
          ".dam-sw-btn--primary", "#settingProfileAvatar"]:
    if s not in onacc:
        onacc.append(s)

# 2) szary literal #8b8d97 -> --dam-text-muted
FG = re.compile(r"(?<![-\w])color\s*:\s*#8b8d97\s*(!important)?", re.I)
gray, grayimp = [], []
for fn, sel, body in rules():
    fm = FG.search(body)
    if not fm:
        continue
    for s in sel.split(","):
        s = s.strip()
        if not s or "data-theme" in s or s.startswith("html.dark"):
            continue
        tgt = grayimp if fm.group(1) else gray
        if s not in tgt:
            tgt.append(s)


def block(prefix, sels, decl):
    return ",\n".join(f"{prefix} {s}" for s in sels) + " {\n" + decl + "}\n"


HEAD = f"""/**
 * DAM - styl Dobra Kaloria (2.5.2, 2026-09-30). PLIK GENEROWANY: bin/apps/web/scripts/build-dam-theme-dk.py -
 * zmiany ogolne wpisuj w czesc "reczna" tego generatora albo w dam-tokens.css.
 *
 * Zrodlo: design system Dobra Kaloria 1.3.1 = wyglad programu "Stworz prezentacje"
 * (skill ds-dobra-kaloria: DESIGN_SYSTEM.md, components.md, tokens.css).
 * Dziala tylko w zestawach "Dobra Kaloria 1 - zielen" i "Dobra Kaloria 2 - krem" (oba tryby):
 * dam-theme.js ustawia wtedy {S}. Pozostale zestawy DAM bez zmian.
 * Laduj jako OSTATNI arkusz strony. Gestosc (wysokosci wierszy, odstepy list) bez zmian.
 *
 * Zasady DS: Mindset = naglowki stron i sekcji (wersaliki), Lato = reszta; zolty = glowna akcja
 * (jedna na ekran), zielen = marka/zaznaczenie/linki; przycisk 4 px, pole 8 px, karta 12 px;
 * obrys drugorzednego przycisku 2 px w akcencie; pole z ramka 1,5 px; fokus 3 px w akcencie.
 */

/* ---- Tekst: Lato -------------------------------------------------------- */
{S} body {{
  font-family: var(--dam-font);
  color: var(--dam-text);
}}

/* ---- Naglowki stron i sekcji: Mindset, wersaliki ------------------------- */
{S} .geex-content__header__title,
{S} .geex-content__authentication__title,
{S} .dam-widget__title,
{S} .dam-help-page__group-title,
{S} .dam-hub-section-title,
{S} .dam-dash-panel__title,
{S} .dam-catalog-marketing__heading,
{S} .dam-inbox-side__title,
{S} .dam-scheme-picker__head h2 {{
  font-family: var(--dam-font-display);
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  line-height: 1.05;
}}
{S} .geex-content__header__title,
{S} .geex-content__authentication__title {{
  color: var(--dam-text);
}}

/* ---- Etykiety nad sekcjami (eyebrow): Lato Bold, wersaliki, 0,1em ---------- */
{S} .dam-sw-block__label,
{S} .dam-scheme-group__label,
{S} .dam-media-preview__assoc-label,
{S} .dam-viz-modal__meta-k,
{S} .dam-welcome-section__title,
{S} .dam-cat-panel__title,
{S} .dam-tag-group-label {{
  font-family: var(--dam-font);
  font-weight: 700 !important;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--dam-label, var(--dam-text-muted)) !important;
}}

/* ---- Glowna akcja: zolty, brazowy tekst, Lato Bold, promien 4 --------------
   Selektory z button./a. i podwojona klasa: dam-accent.css (wstrzykiwany pozniej) ma
   button.geex-btn.geex-btn--primary {{background ... !important}}. */
{S} .geex-btn--primary:not(.dam-badge-tag):not(.dam-viz-badge),
{S} button.geex-btn.geex-btn--primary,
{S} a.geex-btn.geex-btn--primary,
{S} .dam-btn-primary:not(.dam-badge-tag),
{S} #authSubmit,
{S} button.geex-content__authentication__form-submit {{
  background: var(--dam-cta-bg) !important;
  color: var(--dam-cta-ink) !important;
  border-color: var(--dam-cta-bg) !important;
  box-shadow: none !important;
  border-radius: var(--dam-radius-btn) !important;
  font-family: var(--dam-font);
  font-weight: 700;
  transition: background-color var(--dam-anim-hover) ease-out, color var(--dam-anim-hover) ease-out;
}}
{S} .geex-btn--primary:not(.dam-badge-tag):not(.dam-viz-badge):hover,
{S} button.geex-btn.geex-btn--primary:hover,
{S} a.geex-btn.geex-btn--primary:hover,
{S} button.geex-btn.geex-btn--primary.active,
{S} .dam-btn-primary:not(.dam-badge-tag):hover,
{S} #authSubmit:hover,
{S} button.geex-content__authentication__form-submit:hover {{
  background: var(--dam-cta-bg-hover) !important;
  border-color: var(--dam-cta-bg-hover) !important;
  color: var(--dam-cta-ink) !important;
}}
{S} .geex-btn--primary i,
{S} .geex-btn--primary svg,
{S} .geex-content__authentication__form-submit i {{
  color: inherit !important;
}}

/* Akcje powtarzane w kazdej karcie siatki (Wizualizacje, Projekty) zostaja w akcencie -
   zolty ma byc jeden na ekranie. */
{S} .dam-viz-card .geex-btn--primary:not(.dam-badge-tag):not(.dam-viz-badge),
{S} .dam-viz-card button.geex-btn.geex-btn--primary,
{S} .dam-viz-card a.geex-btn.geex-btn--primary,
{S} .dam-viz-card .dam-btn-primary:not(.dam-badge-tag),
{S} .dam-project-card button.geex-btn.geex-btn--primary,
{S} .dam-project-card a.geex-btn.geex-btn--primary,
{S} .dam-project-card .geex-btn--primary:not(.dam-badge-tag):not(.dam-viz-badge) {{
  background: var(--dam-primary) !important;
  border-color: var(--dam-primary) !important;
  color: var(--dam-on-primary) !important;
}}
{S} .dam-viz-card .geex-btn--primary:not(.dam-badge-tag):not(.dam-viz-badge):hover,
{S} .dam-viz-card button.geex-btn.geex-btn--primary:hover,
{S} .dam-viz-card a.geex-btn.geex-btn--primary:hover,
{S} .dam-project-card button.geex-btn.geex-btn--primary:hover,
{S} .dam-project-card a.geex-btn.geex-btn--primary:hover {{
  background: var(--dam-primary-hover) !important;
  border-color: var(--dam-primary-hover) !important;
}}

/* ---- Przycisk drugorzedny: obrys 2 px w akcencie, tekst w akcencie ----------
   2 px = ramka 1 px + wewnetrzny cien 1 px: przycisk nie rosnie (gestosc bez zmian). */
{S} .geex-btn--secondary,
{S} .geex-btn.dam-win-btn:not(.geex-btn--primary):not(.geex-btn--danger),
{S} .dam-win-btn:not(.geex-btn--primary):not(.geex-btn--danger),
{S} .geex-btn.geex-btn--primary-transparent {{
  color: var(--dam-primary) !important;
  border-color: var(--dam-primary) !important;
  box-shadow: inset 0 0 0 1px var(--dam-primary) !important;
  border-radius: var(--dam-radius-btn) !important;
  font-weight: 700;
}}
{S} .geex-btn--secondary:hover,
{S} .geex-btn.dam-win-btn:not(.geex-btn--primary):not(.geex-btn--danger):hover,
{S} .dam-win-btn:not(.geex-btn--primary):not(.geex-btn--danger):hover,
{S} .geex-btn.geex-btn--primary-transparent:hover {{
  color: var(--dam-primary-hover) !important;
  border-color: var(--dam-primary-hover) !important;
  box-shadow: inset 0 0 0 1px var(--dam-primary-hover) !important;
  background-color: var(--dam-surface-hover, var(--dam-surface)) !important;
}}

/* ---- Link w tresci: podkreslony, w akcencie -------------------------------- */
{S} .geex-content a:not([class]):not([role]) {{
  color: var(--dam-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-thickness: 1.5px;
}}
{S} .geex-content a:not([class]):not([role]):hover {{
  color: var(--dam-primary-hover);
}}

/* ---- Pola: promien 8, ramka 1,5 px, fokus 3 px w akcencie ------------------- */
{S} input.form-control:not(.dam-search-input),
{S} select.form-control,
{S} select.form-select,
{S} textarea.form-control,
{S} .dam-settings-page input[type="text"],
{S} .dam-settings-page input[type="email"],
{S} .dam-settings-page input[type="password"],
{S} .dam-settings-page input[type="number"],
{S} .dam-settings-page select,
{S} .dam-settings-page textarea {{
  border: 1.5px solid var(--dam-field-border, var(--dam-border)) !important;
  border-radius: var(--dam-radius-sm) !important;
}}
{S} input.form-control:focus,
{S} select.form-control:focus,
{S} select.form-select:focus,
{S} textarea.form-control:focus,
{S} .dam-settings-page input:focus,
{S} .dam-settings-page select:focus,
{S} .dam-settings-page textarea:focus {{
  border-color: var(--dam-primary) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dam-primary) 28%, transparent) !important;
  outline: none;
}}
{S} input[type="checkbox"],
{S} input[type="radio"],
{S} input[type="range"],
{S} progress {{
  accent-color: var(--dam-primary);
}}

/* ---- Pasek zmian: etykieta miala literal #6B6778 (2,7:1 w ciemnym) ------------ */
{S} .dam-changelog-bar__label {{
  color: var(--dam-text-muted) !important;
}}

/* ---- Karty: promien 12, cien podbarwiony ------------------------------------ */
{S} .dam-viz-card,
{S} .dam-project-card,
{S} .dam-widget,
{S} .geex-card {{
  border-radius: var(--dam-radius-md);
}}
{S} .dam-viz-card,
{S} .dam-project-card {{
  box-shadow: var(--dam-shadow-card);
}}
"""


def catrule(sels, name):
    joined = ",\n".join(f"{S} {x}" for x in sels)
    return (f"{joined} {{\n  background: var(--dam-cat-{name}-bg) !important;\n"
            f"  color: var(--dam-cat-{name}-fg) !important;\n}}\n")
CAT = "".join([
    catrule([".dam-tag-group--smak .dam-tag-pill", ".dam-prod-tag.dam-tag-group--smak"], "amber"),
    catrule([".dam-tag-group--typ .dam-tag-pill", ".dam-prod-tag.dam-tag-group--typ", ".dam-viz-badge--cat",
             ".dam-branding-tag-group--przeznaczenie .dam-viz-badge.dam-badge-tag"], "green"),
    catrule([".dam-tag-group--opakowanie .dam-tag-pill", ".dam-prod-tag.dam-tag-group--opakowanie",
             ".dam-viz-badge--carrier", ".dam-viz-badge--multilang"], "brown"),
    catrule([".dam-tag-group--autor .dam-tag-pill", ".dam-tag-group--osoba .dam-tag-pill",
             ".dam-prod-tag.dam-tag-group--autor", ".dam-prod-tag.dam-tag-group--osoba",
             ".dam-branding-tag-group--autor .dam-viz-badge.dam-badge-tag"], "olive"),
    catrule([".dam-viz-badge--mix", ".dam-viz-badge--variants", ".dam-viz-badge--source"], "sand"),
    catrule([".dam-viz-badge--lang", ".dam-tag-group--podkategoria .dam-tag-pill", ".dam-viz-badge--subcat"], "pine"),
])

TAIL = f"""
/* ---- Kategorie tagow: paleta DK zamiast fioletu / pomaranczu / niebieskiego ------
   Zielen (typ, kategoria), bursztyn (smak), braz (opakowanie, nosnik), oliwka (autor),
   piasek (mix, warianty, zrodlo), sosna (jezyk). Tekst >= 4,5:1 na tle chipa w obu trybach. */
{S} {{
  --dam-cat-green-fg: #0B5F31;  --dam-cat-green-bg: #DDEBE1;
  --dam-cat-amber-fg: #7A4E00;  --dam-cat-amber-bg: #FFF4D6;
  --dam-cat-brown-fg: #7D5E44;  --dam-cat-brown-bg: #F3EADF;
  --dam-cat-olive-fg: #4F5F2A;  --dam-cat-olive-bg: #EEF1DC;
  --dam-cat-sand-fg: #6E5F3C;   --dam-cat-sand-bg: #F0EBDD;
  --dam-cat-pine-fg: #3E5A48;   --dam-cat-pine-bg: #E4EEE7;
}}
{S}[data-theme="dark"] {{
  --dam-cat-green-fg: #8AD6A8;  --dam-cat-green-bg: rgb(111 199 146 / 0.16);
  --dam-cat-amber-fg: #EBCB6B;  --dam-cat-amber-bg: rgb(235 203 107 / 0.16);
  --dam-cat-brown-fg: #D2B48F;  --dam-cat-brown-bg: rgb(210 180 143 / 0.16);
  --dam-cat-olive-fg: #C8CF9A;  --dam-cat-olive-bg: rgb(200 207 154 / 0.14);
  --dam-cat-sand-fg: #C9BEA6;   --dam-cat-sand-bg: rgb(201 190 166 / 0.14);
  --dam-cat-pine-fg: #B3C9BA;   --dam-cat-pine-bg: rgb(179 201 186 / 0.14);
}}
{CAT}

/* ---- Wyszukiwarka: podpowiedzi i wyniki na powierzchni motywu ------------------
   dam-brand.css ma tu bialy #fff na stale - w trybie ciemnym jasny tekst na bialym tle. */
{S} .dam-search-results,
{S} .dam-search-suggest {{
  background: var(--dam-surface);
  border-color: var(--dam-border);
}}
{S} .dam-search-suggest__item,
{S} .dam-search-suggest__term,
{S} .dam-search-hits a,
{S} .dam-search-suggest a {{
  color: var(--dam-text);
}}
{S} .dam-search-suggest__note {{
  color: var(--dam-text-muted);
}}

/* ---- Okna, menu i dymki na powierzchniach motywu -------------------------------
   Arkusze paneli maja tu stale biale tla i ciemnofioletowy tekst (#464255): w trybie ciemnym
   bialy pasek okna, niewidoczne linki menu. Kolory z tokenow motywu, ksztalt bez zmian. */
{S} .dam-preview-nav,
{S} .dam-basepath-box,
{S} .dam-help-modal__panel,
{S} .dam-help-modal__body {{
  background: var(--dam-surface) !important;
  color: var(--dam-text);
  border-color: var(--dam-border);
}}
{S} .dam-preview-nav button,
{S} .dam-help-modal__close,
{S} .dam-modal-x,
{S} .dam-sidebar-collapse-btn,
{S} .dam-int-cta--icon,
{S} .dam-help-modal__restart {{
  background: var(--dam-surface-raised, var(--dam-surface)) !important;
  color: var(--dam-text) !important;
  border-color: var(--dam-border-strong) !important;
}}
{S} .dam-preview-nav button:hover,
{S} .dam-help-modal__close:hover,
{S} .dam-modal-x:hover,
{S} .dam-sidebar-collapse-btn:hover,
{S} .dam-int-cta--icon:hover,
{S} .dam-help-modal__restart:hover {{
  background: var(--dam-surface-hover) !important;
}}
{S} .dam-help-card,
{S} .dam-help-pill,
{S} .dam-viz-modal__variant {{
  background: var(--dam-surface-hover) !important;
  border-color: var(--dam-border) !important;
  color: var(--dam-text-muted);
}}
{S} .dam-help-modal__title,
{S} .dam-help-modal__section h3,
{S} .dam-basepath-box h3,
{S} .dam-basepath-found-title,
{S} .dam-user-menu__link,
{S} .dam-user-menu__link span,
{S} .dam-lang-option,
{S} .dam-lang-option span {{
  color: var(--dam-text) !important;
}}
{S} .dam-help-modal__lead,
{S} .dam-help-card p,
{S} .dam-viz-modal__variant-label,
{S} .dam-viz-modal__filepath-text,
{S} .dam-viz-card__title-pl-paren {{
  color: var(--dam-text-muted) !important;
}}
{S} .dam-help-modal__eyebrow {{
  color: var(--dam-label) !important;
}}
{S} .dam-help-modal kbd,
{S} .dam-help-modal code,
{S} .dam-basepath-box code {{
  background: var(--dam-surface-sunken) !important;
  color: var(--dam-text) !important;
  border-color: var(--dam-border) !important;
}}
{S} .dam-user-menu__logout {{
  background: var(--dam-surface-hover) !important;
  color: var(--dam-text) !important;
  border-color: var(--dam-border) !important;
}}

/* ---- Fokus klawiatury: 3 px w akcencie (DS §2.7) ----------------------------- */
{S} :focus-visible {{
  outline: 3px solid var(--dam-primary);
  outline-offset: 2px;
}}

/* ---- Ruch: szanuj ustawienie systemu ----------------------------------------- */
@media (prefers-reduced-motion: reduce) {{
  {S} *,
  {S} *::before,
  {S} *::after {{
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }}
}}
"""

out = HEAD
out += ("\n/* ---- Tekst na wypelnieniu akcentem --------------------------------------------\n"
        "   --dam-on-primary z DK_PACKS: bialy na #0F763E / #007936, ciemny na jasnym akcencie trybu\n"
        f"   ciemnego (#6FC792, #4CC46A). {len(onacc)} selektorow: reguly z tlem var(--dam-primary) i bialym\n"
        "   tekstem (skan dam-*.css) + elementy z audytu kontrastu (test_dark_contrast.py). */\n")
out += block(S, onacc, "  color: var(--dam-on-primary) !important;\n")
out += ("\n/* ---- Tekst pomocniczy: kolor motywu zamiast starego szarego #8b8d97 ------------\n"
        f"   {len(gray) + len(grayimp)} selektorow z literalem color:#8b8d97 (3,3:1 na bieli). :where() = specyficznosc\n"
        "   samej klasy: wygrywa z regula bazowa (ten arkusz jest ostatni), stany :hover/.is-active\n"
        "   z arkuszy panelu nadal wygrywaja. */\n")
out += block(W, gray, "  color: var(--dam-text-muted);\n")
if grayimp:
    out += block(W, grayimp, "  color: var(--dam-text-muted) !important;\n")
out += TAIL
OUT.write_text(out, encoding="utf-8")
print("onacc", len(onacc), "gray", len(gray), len(grayimp), "bytes", len(out))
