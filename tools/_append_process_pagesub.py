# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "process.md"
entry = """
## 2026-07-21 - Inbox page-sub copy + UTF-8 overlay boot order

### Komenda/Akcja
WORKER: odchudz copy dam-page-sub, font-weight 300, sieroty/nbsp PL, fix race i18n overlay vs shell boot vs GSAP entrance (bez flash mojibake / ukrytego podtytulu).

### Log/Status
1. Root cause race: DamShell.finishBoot() przed async DamI18n.load; potem GSAP revealPageEntrance (autoAlpha) na subtitle pod body opacity:0 + stuck CSSTransition body 0->1.
2. Copy Inbox skrocony + NBSP (i/po/72 h/bez); branding/explorer/index page-sub UTF-8 + data-i18n.
3. DamI18n.whenReady + nbspPl; shell scheduleBootReveal; grid-reveal entrance bez subtitle; shell-boot bez transition; opacity !important na page-sub.
4. Jost wght@300 site-wide; cache-bust i18nboot20260721* / pagesub20260721b / shellboot20260721a.

### Efekt/Fix
Subtitle skrocony PL, fw=300, bodyOp=1, subVis=visible. Boot: hidden -> overlay ready -> reveal raz.

### Backup
brak

### Test/Ewaluacja
- node --check dam-i18n.js / dam-shell.js / dam-grid-reveal.js — Pass
- CDP: fw 300, nbsp>=7, bodyOp 1, subOp 0.82, diacritics — Pass
- Screenshot+Read crop dam-page-sub — Pass

### Zrodla
apps/web/inbox.html, branding.html, explorer.html, index.html, dam-i18n.js, dam-shell.js, dam-grid-reveal.js, dam-app.css, dam-shell-boot.css, i18n/pl.json, i18n/en.json
"""
p.write_text(p.read_text(encoding="utf-8") + entry, encoding="utf-8")
print("ok")
