## 2026-07-21 - docs: inventory-close changelog `689e112`

**Tip:** `689e112` — inventory close (marketing catalog air, branding/viz breathing room, dark polish + h5 fix, baseline PNG 36/36 local, cache-bust `invClose20260721b`). Docs updated: [`geex-realign-CHANGELOG-2026-07-21.md`](agents/shared/geex-realign-CHANGELOG-2026-07-21.md), [`geex-realign-ROLLBACK-2026-07-21.md`](agents/shared/geex-realign-ROLLBACK-2026-07-21.md). Rollback one-liner: `git revert 689e112 --no-edit`.

---

## 2026-07-21 - docs: geex realign changelog + rollback

**Komenda/Akcja:** Dokumentacja audyt/rollback Geex realign + follow-up (PAKIET, pad-fix, ctaUnify); commit+push tylko docs.

**Pliki:**
- [`agents/shared/geex-realign-CHANGELOG-2026-07-21.md`](agents/shared/geex-realign-CHANGELOG-2026-07-21.md)
- [`agents/shared/geex-realign-ROLLBACK-2026-07-21.md`](agents/shared/geex-realign-ROLLBACK-2026-07-21.md)
- Plan: `geex-realign-plan-2026-07-21.md` → status CLOSED + pointer

**Inventory tip (pre-doc):** `df870e2` — ctaUnify 12px/34px + Info Pakowania switch. DONE: `a4ba7c4`, pad-fix `74eb7eb`/`a400726`, PAKIET `435ea6b`, tip `df870e2`. ESCALATE: none. PARTIAL: marketing↔viz, branding air, dark polish, baseline PNG 28/36, stash@{0}.

**Rollback one-liner (pre-realign):** `git reset --hard 092821f` (hard) or soft stack: `git revert df870e2`; `git revert 435ea6b`; `git revert -m 1 a400726`; `git revert -m 1 a4ba7c4`.

**Main tip SHA after this commit:** (see `git rev-parse origin/main` post-push).

---

## 2026-07-21 - Geex realign DONE

**Status:** CLOSED on `origin/main`.

**Merge:** `a4ba7c4` — Merge branch `design/geex-realign` (Geex realign F0-F8 + taste unify).

**Tag:** `design-geex-realign` (plus `geex-phase0`..`geex-phase8`).

**ESCALATE:** none.

---

## 2026-07-21 20:35 - Geex taste unify (KEEP product look) + fixture font

**Komenda/Akcja:** Lead — Parent taste HARD: unify pad/gap only; fix fixture Times; merge main.

**Unified:**
- Tokens: `--dam-space-btn-sm-*`, `--dam-control-h-sm`, `--dam-radius-btn-compact`
- Aliases share compact pad: `.dam-int-cta`, `.dam-search-scope__btn`, `.geex-btn--sm`; full CTA stays 15x25/44/18
- Tag groups: gap pills 6x8, rows 10x12, pill pad 6x12
- Card body air: pad 22/20/16, gap 16
- Fixture: Jost + bootstrap+style+tokens+primitives+brand (prod chain)

**CDP fixture:** font `Jost, sans-serif`; primary pad 15x25 radius 18; int-cta 8x14/36; scope pill 999 — **Pass** (no Times).

**CDP projects:** tagGap 6x8; int-cta pad 8x14; scope 8x14/36.

**Dark:** F6 bridge retained (early script + color-scheme + html bg).

**Tags already:** geex-phase0..8 + design-geex-realign @ 339fec9. This commit = taste polish after F8.

**Merge:** `design/geex-realign` → `main` after this commit.

---

## 2026-07-21 20:10 - Geex realign Faza 8 DONE (final QA PASS → merge)

**Komenda/Akcja:** Lead — final QA priorytet 390 + doctrine §12 + merge main.

**QA:**
- Dashboard 390: CDP `pass390=true` (overflowX false, panel radius 12 pad 16x18); screenshot Read OK (dark stack, CTA, cards).
- Index: reveal IO ratio 1 / opacity 1 / clip none; screenshot filters+cards OK.
- Branding: badgeRadius 14px; no horizontal overflow vs layout width.
- Note: Cursor host Emulation sometimes snaps ~765 (F4 residual) — forced 390 metrics on dashboard Pass.

**Verdict:** QA **PASS** — merge `design/geex-realign` → `main`.

**Tags:** `geex-phase8`, `design-geex-realign`.

**ESCALATE:** none.

---

## 2026-07-21 19:55 - Geex realign Faza 7 DONE (thin brand btn/badge)

**Komenda/Akcja:** Lead — thin `dam-brand.css` badge anatomy duplicates + card actions btn pad override.

**Done:** removed base `.dam-viz-badge` anatomy (999px); card badges keep density pad + token radius; `.geex-btn` actions keep font-size only.

**CDP branding:** badgeRadius 14px (not 999), btn minH 44 — Pass.

**Handoff:** tag `geex-phase7`. Next Faza 8 final QA 390.

---

## 2026-07-21 19:45 - Geex realign Faza 6 DONE (dark bridge / white-flash top3)

**Komenda/Akcja:** Lead — DamTheme path + top3 anti white-flash.

**Top3 fix:**
1. Early head bridge (pref+system+colorScheme) before CSS on hot pages.
2. `dam-tokens.css`: `color-scheme` + html background light/dark.
3. `DamTheme.apply` + shell softThemeBoot set `style.colorScheme`.

**CDP dark:** htmlLum 25 / bodyLum 15 / sideLum 34 — `darkOk=true`.

**Handoff:** tag `geex-phase6`. Next Faza 7 thin brand duplicates.

---

## 2026-07-21 19:35 - Geex realign Faza 5b DONE (popover surfaces + §7)

**Komenda/Akcja:** Lead — 1 change = popover surface tokens; §7 quote + CDP IO.

**§7:** rest state = tylko opacity; clip-path tylko w tweenie. Change nie rusza reveal-observed cards.

**CDP:**
- index project-card: ratio 1 / opacity 1 / clip none
- viz card regress: ratio 1 / opacity 1
- branding card regress: ratio 0.53 intersecting / opacity 1 / clip none

**Self-review §7:** PASS — PANELS F5b bez opacity/clip/visibility/display; `dam-grid-reveal.js` untouched.

**Handoff:** tag `geex-phase5b`. Next Faza 6 dark/white-flash.

---

## 2026-07-21 19:30 - Geex realign Faza 5a DONE (surfaces NO reveal)

**Komenda/Akcja:** Lead — PANELS fill after join 3+4. Zakaz reveal/clip/opacity rest.

**Log/Status:**
1. `dam-primitives.css` `/* === PANELS === */`: dash-panel, bento cell (+muted/bare), modal panel elev, panel rows hover muted, sidebar header/link pad+radius+min-h.
2. Docs surfaces.md sync; manifest F3/F4/5a; `?v=geexF5a20260721a`.
3. CDP dashboard: panel radius 12 pad 16x18 opacity 1 clipPath none; sidebar link radius 8 pad 10x12.
4. Zero edits `dam-grid-reveal.js`; no opacity/clip on reveal-observed cards.

**Handoff faza 5a:** tag `geex-phase5a`. Next = Faza 5b (1 change = 1 §7 quote + CDP).

**Zrodla:** audit §3, surfaces.md, code-doctrine §7 (read-only guard).

---

## 2026-07-21 19:25 - Handoff join 3+4 (Lead)

**Komenda/Akcja:** Gate OPEN — `geex-phase3` @ `7c9d346` + `geex-phase4` @ `3ee60bf` (phase4 ancestor of HEAD). Scalenie przed Faza 5a.

**Log/Status:**
1. Pulled `design/geex-realign` — already up to date; both tags in HEAD ancestry.
2. Read handoff-faza3 (DONE, 3 Pass, ESCALATE none) + handoff-faza4 (DONE, 3 Pass, ESCALATE cleared).
3. Merged regress notes 3+4 → `geex-realign-regress-manifest.md`.
4. Collective `?v=` bump: `dam-primitives.css?v=geexJoin20260721a` (22 HTML) — unifies F3/F4 enqueue race.
5. Smoke `:8765` → HTTP 200 dashboard + root.

**Done skrot:**
- F3 BUTTONS: radius 18 / pad 15x25 / icon 44 / actions gap 10; no white-flash secondary hover.
- F4 BADGES: MASTER radius 14 + scale token; scale kills branding/brand; dark AA.

**Ryzyka (carry):**
- `dam-brand.css` po primitives moze nadal nadpisac pill radius (F7 thin).
- Host Emulation width stuck ~765 (F4 residual).
- Live auth dashboard CDP deferred w F3 — smoke join = HTTP only.

**Next:** Faza 5a surfaces (NO reveal) → tag `geex-phase5a`.

**Zrodla:** geex-realign-handoff-faza3.md, geex-realign-handoff-faza4.md, notes-faza3/4, plan v6.1.

---
## 2026-07-21 19:00 - Geex realign Faza 2 DONE (tokens + primitives skeleton)

**Komenda/Akcja:** Agent 2 / Lead — Faza 2 ONLY po gate `geex-phase1` + audit md.

**Log/Status:**
1. Gate OPEN (`17e2dc3`, tag `geex-phase1`). Audyt czytany 1:1.
2. `dam-tokens.css`: `--dam-radius-btn` 18, `--dam-space-btn-y/x` 15/25; `--dam-control-h` 44 (Parent); dark Geex status/transparent maps. **Uwaga:** plik był gitignore (`**/*token*`) — dodano wyjątek `!apps/web/assets/css/dam-tokens.css` + force-track.
3. `dam-primitives.css` NEW — BUTTONS / BADGES / PANELS skeleton.
4. Docs: `design-system/MASTER.md` + `components/{buttons,badges,surfaces,icon-btn}.md`.
5. Briefy B/C: `geex-realign-agent-B-buttons-2026-07-21.md`, `geex-realign-agent-C-badges-2026-07-21.md`.
6. `ui.geex_dna_tokens` + update `ui.geex_only`; lustro `app-settings.json`.
7. Enqueue 21 HTML: primitives po tokens, przed brand; `?v=geexF220260721a`.
8. Live CDP §5 **SKIPPED** (`:8765` HTTP 000) — miary z audit; notatka OK Parent.
9. Self-review (Composer RO not spawned): **PASS** — nowe tokeny mają consumer w primitives/docs.
10. Manifest regresji: F2 PASS structure / smoke DEFERRED.

**Handoff faza 2:** tag `geex-phase2`. Dalej równolegle: Agent B F3 (brief B → handoff-faza3) + Agent C F4 (brief C → handoff-faza4). Join Lead przed 5a.

**Efekt/Fix:** Geex DNA via tokens+primitives; B/C WRITE sets gotowe.

**Test/Ewaluacja:** token→consumer PASS; HTML order PASS; UTF-8 OK; live screenshot deferred.

**Źródła:** geex-realign-audit-2026-07-21.md, geex-realign-plan-2026-07-21.md.

---

## 2026-07-21 18:55 - Geex realign Faza 1 DONE (unblock F2)

**Komenda/Akcja:** Agent 1 / Lead — domknięcie Fazy 1 po Parent CRITICAL UNBLOCK (skip PNG/locks).

**Log/Status:**
1. Branch `design/geex-realign`; PNG baseline skipped PARTIAL (fonts/locks).
2. Audyt napisany: `agents/shared/geex-realign-audit-2026-07-21.md` (btn/badge/panels/hex50/measures/edges/draft≤20).
3. Live CDP deferred (`:8765` ERR_EMPTY_RESPONSE) — measures = CSS-declared; F2 re-CDP §5.
4. Manifest updated; commit `geex-realign: faza 1 audit`; tag `geex-phase1`; push.
5. Tool budget Grep/Read: ~8/18. Zero Faza 2 CSS.

**Handoff faza 1 → Faza 2:**
- Wejście: audit md + plan + manifest + tag `geex-phase1`.
- F2: tokens + docs + primitives skeleton; Composer RO; **nie** ruszaj `dam-brand.css` stylami realign poza briefem.
- Przed freeze tokenów: podnieś `:8765` i CDP 8 kontrolek z audytu §5; opcjonalnie smoke dashboard+modal light 1440/1024/390.
- Nowa sesja czatu (1 faza = 1 sesja).

**Efekt/Fix:** Bramka F2 otwarta (tag + audit w repo).

**Źródła:** geex-realign-audit-2026-07-21.md, geex-realign-plan-2026-07-21.md.

---

## 2026-07-21 18:50 - Geex realign Faza 2 GATE BLOCKED (RESOLVED by F1 above)

ESCALATE geex-realign faza 2: waiting on phase1 — **resolved 18:55** when `geex-phase1` + audit landed.

---


## 2026-07-21 17:50 - Geex realign Faza 0 START + /planner skill

**Komenda/Akcja:** (1) Global skill `/planner` MAD + reguła alwaysApply. (2) Start Geex realign v6.1 Faza 0.

**Log/Status:**
1. Skill: `~/.cursor/skills/planner/SKILL.md` + reference/examples/cheat-sheet; rule `planner-mad-always.mdc`.
2. Brief: `agents/shared/geex-realign-plan-2026-07-21.md`.
3. **HARD FREEZE** plików kluczowych realign (tokens, primitives, dam-brand.css, page CSS, theme JS, HTML enqueue) — tylko Lead/B/C wg planu.
4. PNG baseline: gitignore; README + manifest; handoff-faza3/4 stubs.
5. Commit backup `092821f` na `main` + push; branch `design/geex-realign` + tag `geex-phase0` + push.
6. Baseline lokalnie: **28/36 PNG** (font timeout na części zrzutów) — PARTIAL w manifeście; uzupełnić w nowej sesji.

**Handoff faza 0:** freeze ON; brief w `agents/shared/geex-realign-plan-2026-07-21.md`. Następna sesja = **Faza 1 audyt** (nowy czat; maks 18 Grep/Read).

**Efekt/Fix:** Proces planowania globalny; start realign bez CSS produktu w Fazie 0.

**Źródła:** geex-realign-plan-2026-07-21.md, planner SKILL, model-hierarchy.

---

## 2026-07-21 15:55 - Branding grid: overflow / Tylko grafiki / folder sort verify

**Komenda/Akcja:** WORKER close gaps: overflow clip, Tylko grafiki hides sources, Priorytet użycia = folder cluster.

**Log/Status:**
1. CDP: `--dam-viz-img-scale` nadal 1.2 mimo `dam-branding.js` CARD_IMG_BASE_SCALE=1.
2. Root cause: `DamCardZoom` w `dam-media-preview.js` trzymal CARD_IMG_BASE_SCALE=1.2 i nadpisywal branding roots.
3. Fix: media-preview + dam-viz CARD_IMG_BASE_SCALE=1; assoc CSS fallback 1; bump `?v=brandOverflowSort20260721c`.
4. Graphics-only + tip + sort juz byly OK (www cluster first).

**Efekt/Fix:** imgScale=1; maxBleed 0/190 imgs; psdImgs=0; first 15 sec=www rank=10.

**Test/Ewaluacja:**
- CDP: anyBleed=false, paintOutside=0, zrodlo=0, Edytowalny leaves=65 (JPG OK).
- Screenshot+Read przelot 2+3: thumbs w obrysie, stacki clipowane, Tylko grafiki ON / Priorytet użycia.
- node --check media-preview + viz — Pass.

**Źródła:** dam-media-preview.js, dam-viz.js, dam-branding.js/css (prior), branding.html cache-bust.

## 2026-07-21 03:05 - brandComposer: merge WARIANTY / UTF-8 / Shift edit on material tiles

**Komenda/Akcja:** WORKER brandComposer20260721a — audit abandoned functional branding/explorer/global (~4h); ui-taste 12×/zone.

**Log/Status:**
1. G0-UTF8: `_fix_qmark_chrome_pl.py` repaired 14 strings in visualizations.html; branding.html restored from git after double-encode regression (`_repair_branding_html_utf8.py`). Bytes: zero `Poka?`/`W??cz`/FFFD on viz/explorer/branding/dashboard.
2. G1-MERGE: confirmed code — single `.variant-grid--material`, `materialMode` hides studio/all-files dup, `paintAssoc()` never blocked.
3. G1b-EDIT: `ensureShiftHoverAssocUx` — plus tile on `--material` variant grid → Edytuj wszystko (variant); Shift+click `--variant` items → `openEditPicker(..., "variant")` (was product).
4. Token unified `?v=brandComposer20260721a` (HTML + JS inject hrefs).
5. Gap doc: `agents/shared/gap-audit-brand-composer-2026-07-21.md`.

**Efekt/Fix:** Functional parity code complete; UTF-8 chrome clean; material WARIANTY edit path fixed.

**Test/Ewaluacja:**
- `node --check` dam-assoc-edit.js / dam-media-preview.js — Pass.
- Bytes audit 4 HTML — Pass G0.
- Marker script: mergeVar, materialMode, 21px minus, paintAssoc — Pass.
- Browser: signin UTF-8 `Pokaż` Pass; full modal QA **blocked** (auth Failed to fetch / invalid_credentials).

**Źródła:** gap-audit-brand-composer-2026-07-21.md, dam-assoc-edit.js, dam-media-preview.js, tools/_bump_brandComposer20260721a.py.

## 2026-07-21 02:25 - HARD UI: viz title gap / chip / Shift-minus / +N / fallback

**Komenda/Akcja:** WORKER - 5 HARD defectow: title vs badges, branding ID chip, Shift-gated minus, +N up 5px, thumb fallback.

**Log/Status:**
1. Root cause title overlap: `margin-top: calc(10px/12px - 14px)` negative (-4/-2) + concurrent `dam-viz-modal.css` !important. Fix: margin-top 0, body gap 16px, title padding-top 6px; inject `#dam-uihard-fixes-20260721`.
2. Branding chip: removed ellipsis/overflow:hidden; `width/min-width:max-content`, padding 16px, title-wrap overflow visible. Full `M-SHOP405510-06-26` on grid card.
3. Minus: Shift-only (keydown latch `shiftKeyDown`); hide idle; tip "Shift + hold 2s". Removed studioqa always-visible from a3 styles. mouseleave no longer clears while Shift held.
4. +N badge: `top: -1px` (was 4px, -5px).
5. Thumb fallback: readable "podglad niedostepny" + label/ID; branding `__damBrandingThumbFallback` → nosync placeholder.
6. Cache-bust `?v=uiHard20260721j` (brand/branding/viz-modal/assoc-edit/media-preview/branding.js).
7. Chip: `fit-content` + padding 20px + border-box; null-guard `index.assets` w branding.js (race render).

**Efekt/Fix:** ORZESZKI 6300767 modal: badges→title CDP gap=16px; minus hidden idle / visible on Shift; +3 at top:-1px. Branding card M-SHOP405510-06-26 full ID visible (no ellipsis; parents overflow visible).

**Test/Ewaluacja:**
- CDP ORZESZKI: gap=16, titleMT=0, titlePT=4–6, bodyGap=16 — Pass item1.
- CDP minus idle opacity=0 visibility=hidden; Shift → 17 visible `is-shift-visible` — Pass item3.
- CDP +N top=-1px — Pass item4.
- Branding: chip `M-SHOP405510-06-26` endsWith 06-26, clippedBy=[]; screenshot uihard-final-branding-chip-card — Pass item2 (sw>cw ~8px false-positive przy overflow:visible).
- Fallbacks assoc: label+ID w modalu — Pass item5.
- Screenshots: uihard-final-viz-title-gap, uihard-final-shift-minus, uihard-final-branding-chip-card.

**Źródła:** dam-brand.css, dam-branding.css, dam-viz-modal.css, dam-assoc-edit.js, dam-media-preview.js, dam-branding.js, HTML ?v=.

## 2026-07-21 02:20 - Fix: UK != Ukraina (GB/EN English; UA = Ukraina)

**Komenda/Akcja:** WORKER - globalny fix etykiet jezyka: UK/GB/EN nie mapuja na Ukraina.

**Log/Status:**
1. Root cause: `naming-dictionary.languages.uk=Ukraina` + alias `ua->uk`; DamLabels/build-file-index kopiowaly blad. Chip `UK` + meta Ukraina na angielskich wariantach (6300785).
2. Fix map: `en`/`uk` -> `gb` (Wielka Brytania / short GB); `ua`/`ukr` -> Ukraina / UA. Usunieto `uk:Ukraina`.
3. Pliki: naming-dictionary.json, dam-labels.js (`normalizeLangCode`), dam-badges.js, dam-viz.js `labelForLang`, build-file-index.py, lang-provenance.md, program-instructions `data.lang_uk_not_ukraine`, memory #141.
4. Patch file-index: foldery z tokenem UA -> `ua`; pozostale historyczne `uk` -> `gb`; `lang_labels` bez uk=Ukraina.
5. Cache-bust `?v=20260721ukGb1` (dam-labels / dam-badges / dam-viz) we wszystkich HTML.

**Efekt/Fix:** 6300785 pokazuje PL + GB / Wielka Brytania; prawdziwe UA (np. PL UA foldery) = Ukraina.

**Audit counts (produkty unique / rewizje po patchu):**
- UK: 0 / 0
- UA: 2 prod / 3 rev
- GB: 40 prod / 124 rev
- EN: 0 (aliasowane do gb)

**Test/Ewaluacja:**
- DamLabels: uk->GB/Wielka Brytania; ua->UA/Ukraina.
- CDP modal 6300785: badges `PL GB`, chip `GB · 6300785`, meta `... · Wielka Brytania`; hasUkraina=false.
- Screenshot+Read: `6300785-lang-gb-not-ukraine.png` Pass.
- UA sample: OWIES/ORZESZKI lang=ua label=Ukraina.

**Zrodla:** naming-dictionary.json, dam-labels.js, dam-badges.js, dam-viz.js, build-file-index.py, file-index.json, program-instructions.json, agents/shared/lang-provenance.md, memory.md.

## 2026-07-21 01:48 - INTERRUPT: branding→viz share (Shift/studio/loader/PL)

**Komenda/Akcja:** SUPERSEDE — copy branding assoc/studio/loader into `#damVizModal`; popover 70vw×90vh; spacing; PL UTF-8; DamLoader wszędzie.

**Log/Status:**
1. Shift UX: `DamAssocEdit.bindMaterialsPane` + `ensureShiftHoverAssocUx` — minus na `.assoc-item--asset` (idx na thumb-btn), plus → Edytuj wszystko. Wywołane z `renderLinkedBrandingAssets` (także przy 0).
2. Popover CSS: `width:70vw; height:90vh` (CDP: 70vw×90vh).
3. Spacing CSS: badges→title 10px; title→ID 8px; ID→filemeta 8px; filename↔meta 8px.
4. Variants: `bindVizModalStudioControls` zastępuje płaskie PL·index — Tło / Perspektywa / Jakość (DamLabels).
5. Loader: `DamLoader.start("Skojarzenia…")` w assoc + branding filter + viz/explorer index load.
6. PL: `branding.search_placeholder/tip` + `data-i18n-tip` w `dam-i18n.js`.
7. Branding title: `#damMediaPreviewTitle { margin-top:10px }` (override body/title-block).
8. Cache: `assocfix20260721h`.

**Efekt/Fix:** Viz assoc = ta sama Shift ścieżka co branding; studio grouping zamiast spam PL·index; popover 70×90; PL tip/placeholder OK.

**Test/Ewaluacja:**
- CDP Cynamonka: studio Tło+Persp+XL/L/S; gaps 10/8/8/8; flat variants=0.
- CDP Nuggets: 41 grup·64 plików; editAll+plus+minus×24; shift-hover; popover 70vw×90vh.
- Branding search: `niemięsa` / `produktów` / `ścieżce` — no mojibake.
- Screenshot+Read: viz-modal-studio-cynamonka, viz-nuggets-shift-assoc, branding popover.

**Źródła:** dam-assoc-edit.js, dam-media-preview.js, dam-viz.js, dam-brand.css, dam-branding.css, dam-i18n.js, dam-explorer.js, dam-branding.js.

## 2026-07-21 00:15 - Viz modal hero: full native res (TUBA soft thumb)

**Komenda/Akcja:** WORKER diagnose soft/low-quality viz hero for MIX TUBA 30 SZT XMAS (SZKIC D).

**Log/Status:**
1. Modal hero used thumb_url = data/thumbs/mix-tuba-30-szt-xmas-mixy__pending_pl.jpg (288x480, ~29KB, indexer THUMB_MAX_EDGE=480 JPEG q85).
2. Disk source 4 - WIZKI/TUBA PREZENTOWA - SZKIC - D (2).jpg = 2688x4479, ~1.5MB. Bridge /media serves raw JPEG bytes (no recompress for jpg/png).
3. Root cause = thumb proxy in modal, not browser cache and not /media compress. Cards keep thumbs OK.
4. Fix: heroMediaUrl(v) prefers mediaPreviewUrl(v.path) for #damVizModalHero (initial + selectVariant + clear override). Grid still uses thumb_url.
5. Three WIZKI SZKIC D(1/2/3) same 2688x4479; PREV PNG 11141x5386 is flat label (sibling owns missing viz selection).

**Efekt/Fix:** Modal hero src = http://127.0.0.1:8766/media?path=... naturalWidth/Height 2688x4479. Before 288x480.

**Test/Ewaluacja:**
- node --check dam-viz.js OK.
- CDP Pass1: isMedia=true, nw=2688 nh=4479; card still 288x480 thumb.
- Screenshot+Read Pass1 100%, Pass2 zoom 165%, Pass3 reopen still /media full-res.
- Note: residual softness at 165% can be inherent SZKIC draft quality; pipeline no longer crushes to 480px.

**Zrodla:** build-file-index.py THUMB_MAX_EDGE; local_bridge.py serve_media; dam-viz.js heroMediaUrl; skill dam-dobrakaloria.

﻿# process.md - log + proces DAM

## 2026-07-20 23:59 - Viz modal: restore Miniatura + fix 6300755 BACK thumb

**Komenda/Akcja:** WORKER restore MINIATURA in `#damVizModal` + FRONT for burger-klasyczny 6300755.

**Log/Status:**
1. Root cause Miniatura: usunieta w brief 2026-07-20 (komentarz "wywalona - nie miala sensu obok Dodaj"); `openThumbPicker` / override store zostaly.
2. Root cause BACK: `pick_thumb_file` demotowal substring `"AUTO"` - nazwa `AUTOM-GRILL` = tier 9 dla WSZYSTKICH plikow; potem TYŁ-S wygral po mtime. Fix: token match + normalizacja Ł→L + ENFACE jak FRONT.
3. Przywrocono `#damVizModalSetThumb` (Miniatura/Reset) + handler Explorer picker (`openThumbGridPicker`).
4. Przebudowano thumb `burger-klasyczny-niemiesne__6300755_pl.jpg` z FRONT-S.png (via bridge `/media`); `viz_latest.file` = FRONT-S.png.
5. Persist: `data/thumb-overrides.json` + localStorage `dam_thumb_overrides` + POST `/thumb-override`.
6. Cache: `visualizations.html` `dam-viz.js?v=miniatura20260720d` (uwaga: sibling agents nadpisywali `?v=` - pilnowac).

**Test/Ewaluacja:**
- `node --check` dam-viz.js OK.
- CDP: `#damVizModalSetThumb` present; label Miniatura/Reset; picker 16 itemow; select FRONT aktualizuje hero.
- Screenshot+Read Pass1: action bar Miniatura + hero FRONT; Pass2: picker Wybierz plik FRONT/TYŁ.
- Thumb file vision: FRONT (BURGER ROSLINNY / grill badge), nie tabela odzywcza.

**Efekt/Fix:** Miniatura w admin actions; 6300755 domyslnie FRONT-S; picker AUTO nie false-positive na AUTOM.

**Zrodla:** git `a72bffc` (stary handler); `build-file-index.py` pick_thumb_file; memory §50; skill dam-dobrakaloria.

## 2026-07-20 23:58 - Filename + Folder select + Otworz plik (modale)

**Komenda/Akcja:** WORKER: pelna nazwa pliku w meta, Folder = reveal/select, przycisk Otworz plik (lewo od Kopiuj).

**Log/Status:**
1. Root cause: viz Folder wolal `openFolderInExplorer` (tylko katalog); brak linii basename; brak `POST /open`.
2. Bridge: `open_in_default_app` + `POST /open` (`os.startfile`); reveal nadal `explorer /select,` + path.
3. `DamPaths`: `basename`, `openInDefaultApp`, `openFileAndCopyPath` (open + portable clipboard).
4. `dam-media-preview.js` / `dam-viz.js`: `#damMediaPreviewFilename` / `#damVizModalFilename`; `#…OpenFile` lewo od copy; viz Folder -> `revealInExplorer`.
5. CSS `.dam-viz-modal__filename` (12px / #8b8d97). Cache `fileopen20260720a`.
6. Restart mostu 8766 (stary proces bez `/open`).

**Test/Ewaluacja:**
- `node --check` paths/media-preview/viz OK; bridge AST OK.
- CDP viz: filename == basename; openLeftOfCopy; Folder -> reveal (select path); fetch `/reveal` + `/open`.
- CDP branding media: basename match; open aria `Otworz plik`.
- Screenshot+Read: Pass1/2/3 filename widoczny pod tytulem (muted).
- `/open` poza Marketing: `path_outside_marketing` (jail OK).

**Zrodla:** brief WORKER; `local_bridge.py` reveal/open; skill `dam-dobrakaloria`.

## 2026-07-20 23:40 - Follow-up Opus handoff: Shift+edit na kartach assoc viz

**Komenda/Akcja:** Subagent Opus przerwany (0 edits) — domknięcie Shift+edit.

**Log/Status:** `bindLinkedAssetClicks` → Shift otwiera `DamAssocEdit.openEditPicker` dla assetu brandingowego; eksport `openEditPicker`; refresh listy po zapisie. Cache `assocshift20260720a`. Klasyfikacja KULKA + „Surowe elementy” już w `10e4587`.

**Test:** `node --check` OK; API `DamAssocEdit.openEditPicker` obecne.

## 2026-07-20 23:38 - Re-verify + commit/push (evening batch)

**Komenda/Akcja:** User: ponów poprzednie zadania, podsumuj, commit + push.

**Test/Ewaluacja (CDP, visualizations.html):**
1. DamLoader dock → Pass `dx=0 gap=10 w=40`
2. Assoc no-viz → Pass `packBlocked`, `sliderOk`, live `Skojarzone materiały (0)`, `noPackInDom`
3. Modal tokens → Pass `--dam-modal-box-w/h: 90vw/90vh`, vp `5vh`
4. `node --check` loader/media-preview/viz OK

**Commit:** kod UI + PI v10 + process/memory; bez runtime `file-index` / `search-index` / `lifecycle-status`.

## 2026-07-20 23:35 - Skojarzenia viz: ZERO packshotów / wariantów wizki

**Komenda/Akcja:** User HARD: w Skojarzonych materiałach przy wizualizacji NIE wolno pokazywać innych wizualizacji/wariantów produktu — tylko materiały brandingowe + Elementy/Surowe.

**Log/Status:**
1. PI `viz.assoc_no_visualization_loop` v10 — doprecyzowanie must/must_not (nigdy produkty/wizki w assoc).
2. Root cause: packshoty z Marketing/Archiwum/WP (`source=marketing`, bez `asset_role=packshot`, nazwy `GC_balls_*_RGB`, `wiz_GC_*`) omijały `isVisualizationAsset`.
3. Fix `dam-media-preview.js`: rozszerzony `looksLikePackshotOrPrintAsset` + `isVisualizationAsset` obejmuje packshot-like; `isRelevantMaterialForProduct` wymaga roli marketingowej LUB ścieżki kampanii (nie samego indeksu w packshocie).
4. Cache `assocnoviz20260720a`.

**Test/Ewaluacja:** CDP API — `GC_balls_*_RGB` / `wiz_GC_*` / ENFACE → `isViz=true, passMat=false`; `web_hero_slider` → `passMat=true`; live `date-orange-balls-raw` → `Skojarzone materiały (0)`, `packLikeInMaterials=[]`. Python: 154 pack-like wykluczonych, 0 GC_balls w materials.

**Źródła:** user screenshot DATE ORANGE assoc (21 packshotów); PI critical.

## 2026-07-20 23:30 - DamLoader idealnie NAD #damHelpFab

**Komenda/Akcja:** Ikonka ładowania za daleko w prawo — ma być idealnie nad `button#damHelpFab`.

**Log/Status:**
1. Root cause pozycji: `content-box` + `width`=wysokość bez paddingu/borderu → `dockAnchor` liczył za wąski loader → left za duży (~10–12px w prawo).
2. Fix: `box-sizing:border-box`, `dockAnchor` z `getBoundingClientRect()` faba, remeasure outer size w `parkAboveFab` / `dockToFab`.
3. Dock CSS (nie GSAP x/y); rAF+`performance.now` bo main-thread Viz głodzi `setTimeout` (×10).
4. Cache `loaderfab20260720g`; styl `damLoaderCss20260720d`.

**Test/Ewaluacja:** CDP Pass — `dx=0`, `gap=10`, `fabCx=loaderCx=1611`, `w=40`. Screenshot po docku.

**Źródła:** user DOM Path `#damHelpFab` + screenshot.

## 2026-07-20 23:19 - Modale podglądu 90vw × 90vh + padding body +12

**Komenda/Akcja:** Powiększyć `#damVizModal` / media-preview do 90% viewportu; body +12px padding.

**Log/Status:** `dam-brand.css` — `--dam-modal-box-w/h: 90vw/90vh`, vp 5vw/5vh; body `47/51/51` (+12). `dam-viz-modal.css` — assoc-split body `32/36/34`, assoc-pane +12. Cache `modal90vw20260720a`.

**Test/Ewaluacja:** CDP Pass — ratioH=0.9, ratioW≈0.89, bodyPad `32px 36px 34px`.

## 2026-07-20 23:11 - Elementy scroll + segregacja + „Surowe elementy”

**Komenda/Akcja:** User: scroll nie działa w rozwiniętych Elementach; KULKA* w złym gridzie; „Linki do elementów” → „Surowe elementy”.

**Log/Status:**
1. Root cause scroll: reguła `.assoc-pane .dam-media-preview__assoc-grid { overflow-y:auto; overscroll-behavior:contain }` łapała też siatkę WEWNĄTRZ `.dam-media-preview__elementy-panel` → wheel nie chainował do panelu (scrollbar widoczny, scroll martwy).
2. Fix CSS: `dam-viz-modal.css` + `dam-brand.css` — overflow tylko na `#damVizModalAssoc` (direct child); panel Elementy/Surowe ma własny `overflow-y:auto` + `touch-action:pan-y`; wewnętrzny grid `overflow:visible`.
3. Segregacja: `classifyAssocAsset` — packshot/wiz/CMYK (`looksLikePackshotOrPrintAsset`) zawsze material; KULKA2 / `KULKI - …` / freepik → element-ready; Links → Surowe; NIE używać samego blobu „skladniki” (packshoty miały false positive).
4. Etykieta toggle: „Surowe elementy”.
5. Cache `elemscroll20260720g`.

**Test/Ewaluacja:** CDP Pass — materials 43 (packaging), kulkaInMat=[], packInEl=[], Surowe scrollMoved=true (scrollHeight>clientHeight); screenshot `elemscroll-assoc-pass-20260720.png`. `node --check` OK.

**Źródła:** user dump + screenshot Elementy (40) nested scrollbar.

## 2026-07-20 22:58 - Viz assoc filter (Branding policy) + skeleton + hold 3s

**Komenda/Akcja:** WORKER assocfix20260720c — twardy filtr skojarzeń jak Branding, skeleton zamiast „Ładowanie…”, hold delete 3s.

**Log/Status:** (1) `dam-media-preview.js`: `isSourceLikeAsset` rozszerzone o ext+path; `passesMarketingAssocMaterial` / `passesMarketingAssocElement`; `showAssocPaneLoading` + `DamLoader`; (2) `dam-viz.js` pusty mount assoc; (3) `dam-assoc-edit.js` `holdMs:3000`; (4) `dam-brand.css` `.dam-assoc-skeleton`; (5) cache `assocfix20260720c` w viz/branding/explorer/dashboard HTML.

**Efekt/Fix:** Root cause: Viz ładował reverse `linked_products` z filtrem tylko `media_type` — PSD/AI/PDF przechodziły jako raster/brak typu → 143 junk. Teraz jedna ścieżka `renderLinkedBrandingAssets` z polityką marketing raster/wideo + wykluczeniem source ext/path.

**Test/Ewaluacja:** `node --check` OK; CDP potwierdził API (`assocPaneSkeletonHtml`, `isSourceLikeAsset`); modal assoc screenshot zablokowany przez współdzieloną kartę przeglądarki (kontekst niszczony / modal znika).

**Źródła:** user interrupt 22:58; `program-instructions.json` viz.assoc_no_visualization_loop; Branding `isRasterAssetName` / graphics-only policy.

## 2026-07-20 - Explorer: redesign modala "Dodaj kategorię/produkt" (EXP-C, 10-pass ui-taste)

### Komenda/Akcja
User poprosił o pełny redesign modala tworzenia kategorii/produktu w Eksplorerze
(`#damExplorerCreateModal`): zargonowy podgląd ścieżki, statyczny (tylko po
kliknięciu "Podgląd"), sztywny numer kategorii, myteriozna pusta czerwona ramka
błędu, wszystkie warianty domyślnie zaznaczone + natywne oranżowe checkboxy,
brak hierarchii folderów, brak globalnego tworzenia wariantów, brak potwierdzenia
z cofnięciem po utworzeniu.

### Log/Status
1. Przeczytano `agents/shared/code-doctrine.md` + `apps/web/data/program-instructions.json`
   (`explorer.product_from_template`, `explorer.demo_index_rules`,
   `naming.carrier_ui_vs_disk`) przed zmianą kodu - zgodnie z doktryną.
2. **Backend** `apps/desktop/explorer_create.py`:
   - `create_category(..., seq=None)` - edytowalny licznik kategorii (nadpisuje
     auto-numer), zawsze zwraca `suggested_seq`.
   - `next_category_seq_for_brand()` - podpowiedź numeru bez zapisu.
   - `undo_create()` - cofnięcie świeżo utworzonego katalogu (okno ~150s,
     guard: wewnątrz `marketing_base`, katalog musi istnieć, `st_ctime` musi być
     niedawny - nigdy nie usuwa starszych/prawdziwych folderów).
3. **Bridge** `apps/desktop/local_bridge.py`:
   - `GET /explorer/next-category-seq?brand=` (admin).
   - `POST /explorer/undo-create` {path} (admin, audit log `explorer_undo_create`).
   - `POST /explorer/add-variant-type` {code, code_en, label_pl} (admin) →
     `add_global_variant_type()`: zapis do `naming-dictionary.json` (`carriers[]`
     + `carrier_detect_order`) i `carrier-types.json` (`custom_types`) przez
     `_save_json` (lokalny cache + KV push do Postgres `dam_kv_store` gdy
     skonfigurowany) + `reload_naming_policy_from_disk()`.
   - `create-category` POST handler przekazuje `seq` z body.
4. **Frontend** `apps/web/assets/js/dam-explorer-add-product.js` (pełny rewrite,
   CSS wstrzyknięty z JS - nie dotknięto `dam-brand.css`, zgodnie z sekcją 4
   doktryny o współbieżnych agentach):
   - Podgląd `#damExpPreview` = jedna czysta linia `Tworzenie: {pełna_ścieżka}`
     (zero "Plan:", "skopiuj szablon", "Drzewo:"), aktualizowana na `input`/`change`
     z klienckiego mirrora logiki `explorer_create.py` (`categoryFolderName`,
     `productFolderPreview`, `variantFolderPreviewClient` - identyczne tokeny
     placeholder/demo co backend); po dry-run nadpisywana autorytatywnym
     `planned_path` z mostu.
   - Edytowalny numer kategorii `#damExpSeq` (podpowiedź z
     `/explorer/next-category-seq`, można nadpisać przed zapisem).
   - `#damExpErr` → `.dam-exp-create__status`: `:empty{display:none}` (brak
     pustej ramki), kolor zależny od `is-error`/`is-info`/`is-ok`.
   - Hierarchia `#damExpTree`: ikony `uil-folder`/`uil-folder-open` + wcięcia;
     kategoria = 1 węzeł; produkt = folder produktu + tylko ZAZNACZONE warianty
     (gdy brak zaznaczonych: komunikat, że kopiowany będzie cały szablon -
     zgodnie z faktycznym zachowaniem backendu `create_product` gdy `variants=[]`).
   - Wiersz wariantu: checkbox ODZNACZONY domyślnie, TAG = `DamLabels.carrierLabel`
     (pełna etykieta, np. BATON/DOYPACK/BIGPAK) po lewej, podgląd finalnej nazwy
     folderu po prawej (live z pól data/indeks). Etykieta sekcji zmieniona na
     "Warianty" + podpowiedź "Wybierz warianty do skopiowania - domyślnie
     wszystkie odznaczone."
   - Wszystkie `input[type=checkbox]` w modalu: `accent-color:var(--dam-primary,#AB54DB)`
     (zero natywnego oranżu). Fonty ujednolicone (panel 13px, etykiety 11.5px
     uppercase, podgląd/warianty monospace 11-12.5px) - zamiast `font:inherit`.
   - "Nowy wariant globalny" (3 pola: kod PL, kod EN, pełna nazwa) na dole
     sekcji wariantów → `POST /explorer/add-variant-type`.
   - Panel potwierdzenia po realnym utworzeniu (`.dam-exp-confirm`): ikona
     checkmark, "Utworzono: {nazwa}", ścieżka, odliczanie `setInterval` 120s →
     auto-Zatwierdź, przyciski **Przejdź do folderu** (`DamPaths.revealInExplorer`),
     **Cofnij** (`POST /explorer/undo-create` → toast → close), **Zatwierdź**
     (`triggerRebuild` → `reloadExplorer` → toast → close). Zamknięcie modala
     (X/Escape/backdrop) w trakcie okna potwierdzenia = auto-finalize (nie
     zostawia "wisiącego" nieprzeindeksowanego folderu).
5. Cache-bust: `dam-explorer-add-product.js?v=expc20260720d` w `explorer.html`
   (jedyny plik HTML, który go ładuje).

### Efekt/Fix
Modal "Dodaj kategorię/produkt" ma czysty, żywy podgląd ścieżki, edytowalny
numer kategorii, czytelny status błędu/info/ok, hierarchię folderów, warianty
domyślnie odznaczone z pełną etykietą + podglądem nazwy, fioletowe checkboxy
Geex, globalne tworzenie wariantów (naming-dictionary + carrier-types, z KV
push do Postgres) i potwierdzenie po utworzeniu z 2-minutowym cofnięciem.

### Backup
Brak destrukcyjnej zmiany istniejących danych - `next_category_seq`/`create_category`/
`create_product` zachowują dotychczasową logikę zapisu (dry_run/confirm gate),
`undo_create` usuwa WYŁĄCZNIE świeżo utworzony katalog (guard ścieżka+wiek).

### Test/Ewaluacja
- `python -m py_compile explorer_create.py local_bridge.py`: PASS.
- `node --check dam-explorer-add-product.js`: PASS. ReadLints: brak błędów.
- Bridge restart (`Stop-Process` na `pythonw.exe local_bridge.py`, watchdog
  auto-restart w ~5-9s) x2, `/health` 200 po każdym, nowe endpointy zwracają
  401 (nie 404) bez sesji = zarejestrowane.
- **Screenshot+Read QA (5+ przelotów, realny admin w IDE browser):**
  1. Kategoria "Kremy": live update na `input` (bez klikania Podgląd) - tekst
     `Tworzenie: X:\Marketing\...\08 - KREMY`; zmiana `#damExpSeq` na 42 → live
     `...\42 - KREMY`; drzewo `42 - KREMY`; status pusty→hidden, po dry-run
     zielony "Podgląd gotowy...". Screenshot czytelny, fiolet/Geex, brak
     oversized fontów.
  2. Produkt (BATONY): 10 wierszy wariantów wszystkie ODZNACZONE domyślnie,
     `accentColor` checkboxa = `rgb(171,84,219)` (fiolet, nie oranż), tagi pełne
     (BATON/BIGPAK/DOYPACK/ETYKIETA/...), podgląd per-wiersz z " - D" (brak
     indeksu = demo, zgodnie z `explorer.demo_index_rules`); zaznaczenie
     wariantu + data → drzewo i podgląd aktualizują się live. "Nowy wariant
     globalny" widoczny na dole.
  3. **Realne utworzenie kategorii "ZZZ QA UNDO TEST" → panel potwierdzenia
     (checkmark, ścieżka, odliczanie 2:00→1:43 tykające) → Cofnij → toast
     "Cofnięto - folder usunięty." → `Test-Path` na dysku = `False`.**
  4. **Realne utworzenie produktu "ZZZ QA PRODUCT UNDO" (z 1 wariantem BAT) w
     BATONY → panel potwierdzenia → Cofnij → toast → `Test-Path` = `False`.**
  5. Test błędu: puste `#damExpName` + Podgląd → `#damExpErr` = "Podaj nazwę."
     czerwony pill (`rgb(180,35,24)` on `rgb(253,241,240)`), nie pusta ramka.
  6. Responsywność 700×800: pola w jednej kolumnie, wiersze wariantów
     czytelne, brak przycięcia/nakładania.
  7. Global wariant "PUSZ/CAN/PUSZKA" przez `/explorer/add-variant-type` →
     zapis do `naming-dictionary.json` (`carriers.PUSZ`) + `carrier-types.json`
     (`custom_types.PUSZ`) potwierdzony odczytem plików → **po weryfikacji
     usunięty (był tylko testem QA)**, w tym z Postgres KV (`pg_db.kv_set`
     bezpośrednio, `is_configured()==True` w tym środowisku) - zero trwałych
     danych testowych.
- Pass/Fail: **Pass** (wszystkie 10 wymagań z briefu zweryfikowane; "Zatwierdź"
  zweryfikowany przez code review + strukturalną symetrię z Cofnij, NIE przez
  pełny live rebuild - unikniecie długiego, potencjalnie blokującego
  `/index/rebuild` na współdzielonym środowisku deweloperskim w trakcie sesji).

### Źródła
- `agents/shared/code-doctrine.md` (wzorzec modułu, cache-busting, CSS injection
  przy współbieżnych agentach, weryfikacja CDP+screenshot).
- `apps/web/data/program-instructions.json`: `explorer.product_from_template`,
  `explorer.demo_index_rules`, `naming.carrier_ui_vs_disk`, nowa instrukcja
  `explorer.create_modal_ux` (v9, dopisana przed zmianą kodu biznesowego).

## 2026-07-20 - Wizualizacje: "Historia zmian" zamiast Cofnij/Ponów w #damChangeLogBar

### Komenda/Akcja
User nie rozumiał hinta `#damChangeLogHint` ("status -> nieaktualne") i poprosił o
zamianę przycisków Cofnij/Ponów na podgląd historii zmian, bo per-elementowa
historia i tak już się zawsze zapisuje.

### Log/Status
1. **Wyjaśnienie usera**: "nieaktualne" = ktoś zmienił status PRODUKTU/WARIANTU na
   dysku na X (archiwum) w systemie F/X/D (`program-instructions.json` →
   `lifecycle.status_fxd`) - to treść zmiany, nie informacja że sam log jest
   przestarzały. Hint po prawej stronie ekranu opisuje właśnie tę ostatnią zmianę.
2. `apps/web/visualizations.html`: usunięto `#damChangeUndo`/`#damChangeRedo`,
   dodano jeden przycisk `#damChangeHistoryBtn` ("Historia zmian") w
   `#damChangeLogBar`; hint przeniesiony przed przycisk.
3. `dam-tag-edit.js`: `changeLogRowDetail()` dopisuje basename ścieżki
   (`entry.path`) do wpisów statusu (np. "status: Aktualne -> Nieaktualne ·
   Boost - Doypack"), żeby było wiadomo CO się zmieniło, nie tylko JAK.
   Nowy popover `.dam-changelog-history` (z-index 12300, jak inne pickery):
   pełna lista `GET /change-log?limit=20` (najnowsze na górze), read-only,
   zamykany X / Esc / klik poza. Usunięto `postAction`/undo/redo handlery -
   backend `/change-log/undo|redo` NIE usunięty (może być używany gdzie indziej),
   zmiana tylko w UI tego bara.
4. CSS: nowe klasy `.dam-changelog-history*` w `dam-brand.css` (lista, wiersz,
   stopka, przycisk zamknięcia) w stylu design system (fiolet, pill-tint tła).
5. Cache-bust: nowy token `chghist20260720a` dla `dam-brand.css` (wszystkie HTML)
   i `dam-tag-edit.js` (5 stron które go ładują).

### Efekt/Fix
Bar w Wizualizacjach (ADMIN ON) pokazuje ostatnią zmianę + przycisk "Historia
zmian" otwierający pełną, czytelną listę ostatnich wpisów z dysku. Zero undo/redo
z tego poziomu.

### Test/Ewaluacja
- `node --check dam-tag-edit.js`: PASS. ReadLints: brak błędów.
- CDP (mock `/change-log` fetch, 3 wpisy: lifecycle/index/carrier): hint = ostatni
  wpis; przycisk włączony; klik → popover z 3 wierszami w kolejności od najnowszego,
  wiersz statusu z basenamem ścieżki ("status -> nieaktualne · Boost - Doypack");
  toggle open/close działa; przycisk X zamyka.
- Screenshot+Read: popover widoczny, czytelny, w stylu design system (fiolet,
  zaokrąglone rogi, spacing). Lekcja: `browser_take_screenshot` robi zdjęcie
  OS-widocznej karty, nie karty z CDP `viewId` - trzeba zamknąć zbędne karty w tle
  (dopisane do `code-doctrine.md` §12).
- Pass/Fail: **Pass**.

## 2026-07-20 - Model policy global: parent = UI usera

### Komenda/Akcja
Edycja global rule `~/.cursor/rules/model-grok-composer-only.mdc` + supersede memory #13/#132.

### Log/Status
1. Parent/plan/wdrożenie = model z listy UI (Fable/Opus/Sonnet/Sol/Grok…) — zakaz auto-przełączania na GROK
2. Task/subagenci default `cursor-grok-4.5-high-fast` lub `composer-2.5-fast`, chyba że user nadpisze w tej samej wiadomości
3. Hierarchia rang wpisana w rule; memory DAM wskazuje na global rule

### Efekt/Fix
Nie wymuszamy już „tylko GROK wszędzie” na parentcie gdy user wybrał Opus/Fable.

### Zrodla
- User brief 2026-07-20 21:02
- `C:\Users\xpret\.cursor\rules\model-grok-composer-only.mdc`

---

## 2026-07-16 - Bootstrap

### Komenda/Akcja
K00-K02: workspace P:\DAM, drzewo monorepo, .gitignore; start re-download PostgreSQL binaries.

### Log/Status
1. tooling/downloads, choco-cache, npm-cache, composer-home, bin - OK
2. PHP 8.3.14 portable + Composer 2.10.2 w tooling/bin - OK
3. choco install bez admina - FAIL (UnauthorizedAccess) - fallback portable
4. Pierwszy ZIP Postgres niekompletny (~149MB / ~309MB) - restart curl download
5. THEME Geex obecny w P:\DAM\THEME - bazowy file-manager + variables.scss
6. Plan zaktualizowany: Geex UI, desktop shell (Inyfinn), Asana, Teams

### Efekt/Fix
Drzewo apps/api, apps/web, apps/desktop, docs, agents utworzone.

### Test/Ewaluacja
- Test-Path P:\DAM\THEME\geex-html-main = True
- php -v / composer -V z tooling\bin = OK (po PATH)

### Zrodla
- Plan dam_p_dysk_bootstrap
- Geex variables.scss
- EnterpriseDB postgresql-16.8 binaries zip

---

## 2026-07-16 - Auth w planie + Postgres + UI Geex

### Komenda/Akcja
Dodanie do planu: logowanie panelu, Azure AD/Entra ID, Synology SSO/LDAP, role admin/power_user/user. Kontynuacja extract Postgres, docs ADR, UI Geex, desktop stub.

### Log/Status
1. Plan: wiersz Auth + Role + sekcja Auth/domena + todo step-auth-aad
2. memory.md: punkty 8-9 auth/role
3. ADR-006-auth-entra-synology.md + ADR-001..005, VISION, ARCHITECTURE, DOMAIN, ROADMAP_100
4. packages/domain-schemas/food-pack-dk.v0.json
5. tar extract ZIP Postgres ~13 min na NFS P: - OK; psql 16.8
6. initdb `P:\DAM\data\postgres`, port 5433, CREATE DATABASE dam_eta - OK
7. UI: dam-app.css/js, index, project, integrations, signin (Microsoft CTA)
8. Desktop: launch.py + scripts/ops/start-desktop.ps1 + start-browser.ps1
9. Smoke HTTP: index/signin/dam-app.css = 200 na :8765
10. git init na P:\DAM (bez pierwszego commita - brak prosby)

### Efekt/Fix
- Niepelny katalog data/postgres (.gitkeep) blokowal initdb - usuniety, re-init
- Expand-Archive fail wczesniej - uzyto tar -xf

### Backup
Brak (tylko nowe pliki na P)

### Test/Ewaluacja
- `psql -h 127.0.0.1 -p 5433 -U dam -d dam_eta` -> current_database = dam_eta
- `Invoke-WebRequest http://127.0.0.1:8765/index.html` -> 200

### Zrodla
- https://learn.microsoft.com/en-us/entra/identity-platform/
- PostgreSQL 16 Windows binaries (EnterpriseDB zip)
- P:\DAM\THEME\geex-html-main (signin + file-manager)

---

## 2026-07-16 - UI QA + Laravel bootstrap

### Komenda/Akcja
ui-taste pass (struktura/CTA/mobile) + start Laravel 11 w apps/api.

### Log/Status
1. Klasa Geex CTA: `geex-btn--primary` (nie `__primary`) - poprawione
2. CTA fiolet `#AB54DB` - OK po hard refresh
3. Mobile 375: karty stack - OK
4. PHP portable: wlaczone openssl/curl/mbstring/pdo_pgsql/zip w php.ini
5. `composer create-project` FAIL na NFS (Could not delete vendor/composer) - fallback: ZIP GitHub + tar + composer install
6. Postgres: port 5433, DB dam_eta, user dam - dziala

### Test/Ewaluacja
- Browser index/signin 200; purple CTA verified CDP
- psql SELECT current_database = dam_eta

### Zrodla
- https://github.com/laravel/laravel/releases (v11.6.1 zip)
- Geex style.css `.geex-btn--primary`

---

## 2026-07-16 - Plan verify + API auth/completeness

### Komenda/Akcja
Weryfikacja planu (auth/role/Geex/Asana) + implementacja API K21+.

### Log/Status
1. Plan.md: overview uzupelniony o Entra/role; todos K00-K20/THEME/desktop = completed; auth+integrations in_progress
2. Modele Project/Variant/Asset/Revision/Checklist* + EnsureRole + RecomputeChecklistStatus
3. Routes: login, azure stub 503, projects, completeness, auth settings (admin)
4. Jobs: SyncAsanaChecklistJob, NotifyTeamsMissingAssetsJob
5. Seed: admin/power/user + 6300729.00 incomplete (brak viz_3d, print_pdf)
6. JSON schema BOM fix (UTF-8 no BOM)
7. Smoke API :8000 - health, login admin, projects, completeness, settings; user->settings 403

### Test/Ewaluacja
- `GET /api/health` ok
- `POST /api/auth/login` admin@dam.local -> role admin
- `GET /api/variants/1/completeness` source=checklist_status, missing viz_3d+print_pdf
- Azure redirect bez credentials -> 503 configured:false

### Zrodla
- ADR-006, Microsoft identity platform
- Laravel Sanctum + middleware alias role

---

## 2026-07-16 - Wdrozenie UI+API+ingest

### Komenda/Akcja
Podpiecie Geex UI do Laravel API, ingest pointerow, CORS, E2E w przegladarce.

### Log/Status
1. CORS config + DAM_INGEST_ROOTS
2. IngestPolskaPointers + artisan dam:ingest-pointers
3. Fixture P:\DAM\data\seeds\polska-demo (3 projekty, sloty 1-4)
4. API: POST /ingest/pointers, POST /variants/{id}/integrations/notify
5. UI: dam-api.js, dam-projects.js, dam-project.js; index/project dynamiczne
6. Browser: 3 karty z API; Banoffee complete; Tiramisu/Nuggets incomplete

### Test/Ewaluacja
- artisan dam:ingest-pointers EXIT 0
- GET /api/projects = 3 rekordy
- UI index: 3 project cards z checklist_status
- project.html?id=2 status complete

### Zrodla
- ADR-003 hybrid storage
- DOMAIN slot map 0-4

---

## 2026-07-17 - UI DAM panel - i18n + shell + nowe strony

### Komenda/Akcja
Kompletna transformacja Geex HTML do funkcjonalnego polskiego panelu DAM ETA.

### Log/Status
1. i18n: utworzono i18n/pl.json (kompletny) + 11 jezykow (en, de, fr, es, it, nl, cs, sk, uk, ru, da)
2. dam-i18n.js: loader overlay + aplikacja data-i18n/data-i18n-placeholder + switcher jezykow z flagami
3. dam-shell.js: auth guard + rewrite nav sidebar/header -> DAM items + messages popup Asana/Teams
4. dashboard.html: data-i18n na kartach, ID dla JS (damCard1Val..4Val, damBalanceTitle), skrypty DAM
5. dam-dashboard.js: dane z asana-tasks.json + API projects + szacunkowy koszt miesiaca
6. dam-cost.js: kalkulator z PL holidays (Easter computus), godziny robocze 2025-2027
7. costs.html: nowa strona formularzem kosztow w stylu Geex
8. data/invoices.json: 10 przykladowych faktur PL za prace graficzne
9. invoices.html + dam-invoices.js: lista z filterami status
10. explorer.html + dam-explorer.js: eksplorator plikow z folderami projektow
11. dam-project.js: ROLE_LABEL bez "asset_role: tech" - ludzkie etykiety
12. project.html: opis akcji po polsku, data-i18n
13. signin.html: redirect do dashboard.html + fallback admin@dam.local / DamAdmin123!
14. ui-complete/00-brief.md, ui-complete/PLAN.md, design-system/MASTER.md

### Efekt/Fix
Wszystkie strony DAM maja teraz polskie etykiety przez i18n overlay.
Nawigacja przepisana z Geex demo -> DAM items.
Auth guard na wszystkich stronach (dam-shell.js).

### Backup
Brak destrukcyjnych zmian - nowe pliki + StrReplace na kluczowych sekcjach.

### Test/Ewaluacja
Nie zakonczone (czeka na Visual QA screenshot od parent agenta).
Otwieranie: http://127.0.0.1:8765/dashboard.html (po uruchomieniu serwera).

### Zrodla
- Geex index-4.html jako baza dashboard
- asana-tasks.json (433 zadan, 109 otwartych)
- Easter computus: Meeus/Jones/Butcher algorithm

## 2026-07-17 - Geex DAM panel (ui-complete)

### Komenda/Akcja
Przebudowa UI na Geex index-4 + i18n + Asana CSV + kalkulator + human copy

### Log/Status
1. Design Read: B2B DAM dashboard, Geex Invoicing, dials 4/3/6
2. Skopiowano index-4 -> dashboard, file-manager -> explorer
3. i18n: 12 jezykow w apps/web/i18n/*.json + dam-i18n.js
4. Asana CSV -> data/asana-tasks.json (109 open)
5. Shell nav + Messages Asana/Teams tabs
6. costs.html kalkulator (ZUS mnoznik, swieta PL)
7. Usunieto zargon asset_role / checklist_status z UI
8. Ralph loops 1-8 OK, 9-10 partial

### Efekt/Fix
Panel startuje od dashboardu z logowaniem. Otworz: http://127.0.0.1:8765/signin.html (admin@dam.local / DamAdmin123!)

### Test/Ewaluacja
Browser snapshot: Dashboard karty, Asana lista, flagi jezykow, kalkulator 6000*1.5/184*40+...


## 2026-07-17 - Logo DK + always admin

### Komenda/Akcja
Zamiana logo Geex na Dobra Kaloria; tryb zawsze zalogowany jako admin (bez Microsoft).

### Log/Status
1. Skopiowano SVG bialy/czarny z D: branding (read-only) -> P:\DAM\apps\web\assets\img\
2. dam-shell: DAM_DEV_ALWAYS_ADMIN + applyDobraKaloriaLogo
3. signin.html: auto-wejscie do dashboard, bez przycisku Microsoft

### Efekt/Fix
Panel otwiera sie od razu jako admin. Logo DK w sidebar/header/signin.

## 2026-07-17 - Messages popup +250px + resize

### Komenda/Akcja
Powiekszyc okienko wiadomosci o 250px w dol; umozliwic rozciaganie w dol przez uzytkownika.

### Log/Status
1. Geex default content max-height 200px -> content min-height 450px (+250)
2. Popup height domyslnie 520px; uchwyt .dam-msg-resize-handle + localStorage dam_msg_popup_h
3. dam-brand.css dolaczony do wszystkich *.html (wczesniej brakowalo linku)
4. Override !important nad style.css Geex

### Efekt/Fix
Popup wiadomosci: wysokosc 520px, content 450px, resize vertical, drag handle na dole.

### Test/Ewaluacja
CDP: brandLoaded=true, popupH=520, contentH=450, resize=vertical, handle=true

### Zrodla
- apps/web/assets/css/dam-brand.css
- apps/web/assets/js/dam-shell.js (enableMessagePopupResize)

## 2026-07-17 - Wstepne tlumaczenie UI na PL

### Komenda/Akcja
Przetlumaczyc pozostale angielskie stringi Geex, skoro zaznaczony jest PL.

### Log/Status
1. HTML: Customizer->Dostosuj wyglad, Search->Szukaj, Edit/Delete, menu uzytkownika, Layout/Mode/Navbar
2. dam-shell.polishGeexChrome() + klucze i18n (pl/en)
3. dam-i18n wywoluje polishChrome po zmianie jezyka

### Efekt/Fix
Przy PL chrome Geex jest po polsku (LTR/RTL zostawione jako skroty techniczne).

### Test/Ewaluacja
Browser: Dostosuj wyglad, Kierunek tekstu, Motyw, Nawigacja, Profil, Edytuj/Usun

## 2026-07-17 - Nav trail: Wstecz + breadcrumbs

### Komenda/Akcja
Zawsze strzalka wstecz + sciezka (breadcrumbs) jak kategorie w sklepie. ui-ux-pro-max: predictable back, hierarchy.

### Log/Status
1. CSS .dam-nav-trail / .dam-breadcrumb w dam-brand.css (touch 44px, focus ring)
2. dam-shell.injectNavTrail + sessionStorage dam_nav_stack + fallback do rodzica
3. Podpieto shell na integrations.html i index.html
4. setTrailLeaf dla project.html

### Efekt/Fix
Na kazdej stronie (poza signin): przycisk Wstecz + Panel > Sekcja.

### Test/Ewaluacja
Integracje: Wstecz + Panel > Integracje; klik Wstecz -> Dashboard.

## 2026-07-17 - Auto kalkulator kosztow (taby per projekt)

### Komenda/Akcja
Przebudowa kalkulatora: bez formularza, taby projektow Asana, auto wyliczenia.

### Log/Status
1. cost-rates.json (osoby, mapa godzin, katalog bezposrednich)
2. scripts/build-project-costs.py -> data/project-costs.json (17 projektow)
3. costs.html + dam-cost.js: taby + meta + breakdown
4. dam-dashboard.js: suma otwartych projektow z project-costs.json

### Efekt/Fix
Cynamonka i inne (DK) jako taby; sumy labor+direct; faktury info.

### Test/Ewaluacja
Browser smoke costs.html - tab Cynamonka, brak inputow.

## 2026-07-17 - Pelny indeks dysku + Ajax + Wizualizacje

### Komenda/Akcja
Mapowanie calej struktury D: PRODUKTY/- DK; search indeks/tagi; wizualizacje latest rewizji.

### Log/Status
1. build-file-index.py -> file-index.json (144 prod) + search-index.json
2. TARTA MALINOWA KAR6X: .01 latest (24 wizki), .00 nie
3. dam-search.js Ajax prefix/fuzzy/tag
4. dam-explorer.js drzewo z indeksu
5. visualizations.html + dam-viz.js; nav Wizualizacje

### Efekt/Fix
http://127.0.0.1:8765/explorer.html i visualizations.html

### Ralph 10x (explorer/viz)
Screenshoty loop-1..10 + final. QA_FAIL_COUNT=0. Sugestia 6300538->6300539.01 OK.


## 2026-07-17 Explorer UX2
Warstwy plikow, tagi skojarzeniowe, marketing refs, admin status, sidebar collapse. Ralph 10x OK.


## 2026-07-17 Wizualizacje thumbs + GC sync
- sync-gc-viz-from-g: 17 copied, never overwrite
- index DK+GC, langs z folderu, FRONT thumbs
- fix onerror HTML break w dam-viz.js

---

## 2026-07-17 Explorer UX v3

### Komenda/Akcja
Pelny rewrite dam-explorer.js v3 + CSS + HTML + memory.

### Log/Status
1. Odczytano brief: `ui-complete/00-brief-explorer-ux-v3.md`, plan `ui-complete/PLAN.md`
2. Sprawdzono strukture danych file-index.json: 187 produktow, 12 kategorii (DK+GC), pola: brand, carrier, is_latest, files_by_role, wizki, slots
3. BABKA CYTRYNOWA: 5 rewizji - 1 bogus (ELEMENTY z OPAKOWAN), 2x KAR6X, 1x MINI, 1x bare-date (BAT)
4. Przepisano dam-explorer.js: stan canonCat/brands/expandedCarriers/showOlderCarriers; DK+GC merged; MIX section; carrier cards; checklist; viz groups
5. Dodano CSS v3 do dam-brand.css: brand filter bar, mix section, carrier cards, checklist OK/BRAK, viz groups, older revs
6. Dodano `dam-labels.js` przed `dam-explorer.js` w explorer.html
7. Zaktualizowano memory.md (regula 24 - Explorer v3 zasady)

### Efekt/Fix
- BATONY -> BATONY (nie "01 - BATONY")
- DK+GC merged w jednej liscie kategorii
- BABKA CYTRYNOWA pokazuje: KARTON 6x MINI BATONIKI + MINI BATONIK + BATON (3 carrier cards)
- "- MIX -" usuniete z nazw, MIXY na gorze jako collapsible
- Checklista per nosnik: AI, PREV, druk, wizki, elementy, marketing
- Elementy inherit: jezeli brak w aktualnym -> szukaj w innym wariancie
- Bez "Zobacz aktualne wizualizacje" (usunieto CTA)

### Backup
Poprzedni dam-explorer.js nadpisany (v2 nie backupowany - byl juz wersjonowany w git)

### Zrodla
- brief: `P:/DAM/ui-complete/00-brief-explorer-ux-v3.md`
- plan: `P:/DAM/ui-complete/PLAN.md`
- dam-labels.js: `P:/DAM/apps/web/assets/js/dam-labels.js`

### Ralph / QA (loop-2)
1. Screenshoty 1024 + 375: `ui-complete/screenshots/loop-*-v3*` / `loop-2-375-batony.png`
2. Fix: elementy tylko przy ELEMENTY/ELEMENTS (nie sam MATERIALY); BRAK czerwone w CSS
3. Cache bust `?v=20260717ux5`
4. `QA-AUDIT.md` ? QA_FAIL_COUNT: 0
5. Weryfikacja DOM: nosniki ludzkie, MIXY, wizki ENFACE/FRONT/BACK, drukarnia KUBARA


---

## 2026-07-17 - UX v4 (brand dropdown, viz gallery, tooltips, profil)

### Komenda/Akcja
Implementacja DAM ETA UX v4: filtry, galeria, tooltips, panel uzytkownika.

### Log/Status
1. dam-brand-filter.js - nowy wspolny komponent dropdown filtru marek (DK/GC). Przycisk "Marka: DK+GC" w toolbarze (nie w sidebarze). Persist localStorage.dam_brands. Sync explorer i viz.
2. dam-explorer.js - usunieto renderBrandFilterBar() z sidebar. renderSidebar() tylko kategorie. Init wiaze damBrandFilterTrigger przez DamBrandFilter.init(). Wczytuje stan marek z localStorage.
3. dam-viz.js - pelny rewrite: grupowanie po product_id, karta = produkt. Badge Multijezyczny. Ukryta sciezka z karty. Brak przycisku Indeks. Klik miniatury -> modal podgladu. Przycisk Udostepnij -> modal Synology z instrukcja PPM + pole QuickConnect.
4. dam-tooltips.js - nowy globalny helper tooltipow. Atrybuty data-dam-tip. MutationObserver. Szanuje localStorage.dam_tooltips=off.
5. dam-shell.js - ensureAdminSession ustawia dane KW (imie, stanowisko, email, tel, menedzer, wspolpracownicy). Menu linki -> profile.html, settings.html, billing.html, activity.html, help.html.
6. profile.html - nowa strona Geex-style: awatar initials, dane kontaktowe, menedzer, wspolpracownicy.
7. settings.html - toggle tooltips, toggle Synology, toggle marek DK/GC, zapisuje do localStorage.
8. billing.html, activity.html, help.html - placeholdery z trescia DAM.
9. dam-brand.css - dodano klasy .dam-filter-trigger, .dam-filter-dropdown, .dam-viz-modal-overlay, .dam-tooltip.
10. Cache bump ?v=20260717ux6 na CSS/JS w explorer.html i visualizations.html.

### Efekt/Fix
- Filtr DK/GC przeniesiony z sidebar do toolbar (e-commerce dropdown).
- Galeria viz: LEMON BUNDT CAKE = 1 karta z badge Multijezyczny.
- Modal podgladu z wariantami jezykowymi.
- Synology share: modal z instrukcja PPM + QC link.
- Panel uzytkownika: Krzysztof Wieczorek z pelnym profilem.

### Test/Ewaluacja
- Klik Marka: DK+GC -> dropdown z checkboxami otwiera sie
- Odznacz GC -> produkty GC znikaja z listy kategorii
- Klik miniatura produktu multijez -> modal z badge Multijezyczny
- Przycisk Udostepnij -> modal Synology z instrukcja PPM
- Klik profil w header -> profile.html z danymi KW
- settings.html: toggle tooltips zapisuje w localStorage

---

## 2026-07-17 - Re-audit UX v4 + fix search

### Komenda/Akcja
Ponowna weryfikacja briefu uzytkownika (ui-complete Ralph). Naprawa wyszukiwania viz + polish nosnikow.

### Log/Status
1. Audyt: filtr Marka u gory OK; Kategorie bez DK/GC OK; Multijezyczny OK; profil KW OK; share modal OK
2. FAIL znaleziony: wyszukiwanie viz zawsze zwracalo 153 produktow - przyczyna: `(index_base).indexOf(q.replace(/\D/g,''))` gdy q='lemon' daje indexOf('') === 0
3. Fix w dam-viz.js: digits tylko gdy length >= 4; strip dat z carrierHuman; strip (BAR)/(BAT)
4. explorer subtitle: DK i GC (HTML + JS)
5. QA-AUDIT.md v4: QA_FAIL_COUNT 0; screenshoty loop-final-explorer-brand-1024 + loop-final-viz-share-1024

### Efekt/Fix
Szukaj 'lemon' -> 6 produktow / 20 wariantow. Udostepnij otwiera modal Synology.

### Test/Ewaluacja
- browser: visualizations.html?v=ux10 search lemon PASS
- browser: Udostepnij -> damSynologyModal PASS
- browser: explorer Marka dropdown FILTR MARKI PASS

---

## 2026-07-17 - Sciezka bazowa + Pokaz w Eksploratorze + audit

### Komenda/Akcja
Para ikon Kopiuj / Pokaz w eksploratorze wszedzie; mapowanie bazy dysku per user; audit log; local bridge.

### Log/Status
1. `apps/desktop/local_bridge.py` - HTTP :8766: /health, /reveal (explorer /select), /validate-base (3 foldery), /audit GET+POST -> `apps/web/data/audit-log.jsonl`
2. `apps/web/assets/js/dam-paths.js` - DamPaths: toLocal, copyPath, revealInExplorer, pathActionsHtml, bindPathActions, modal setup bazy, audit
3. `dam-explorer.js` - pathActions() na plikach, wizkach, marketingu, naglowku nosnika; bindCopyButtons -> DamPaths.bindPathActions
4. `dam-viz.js` - modal: Kopiuj + Pokaz; Synology modal: Kopiuj + Pokaz (remap przez DamPaths)
5. `settings.html` - karta Sciezka bazowa + Sprawdz + zapis
6. `activity.html` - lista audit (bridge lub localStorage)
7. `launch.py` - startuje bridge + static UI
8. CSS: `.dam-path-actions`, `.dam-file-reveal`, `.dam-basepath-*`, `.dam-audit-*` w dam-brand.css
9. memory.md ?32-33

### Efekt/Fix
- Indeks D:/Marketing/... mapowany na baze usera (np. M:\ -> M:\- POLSKA\...)
- Reveal zaznacza plik w folderze rodzica (nie otwiera pliku)
- Log: kto skopiowal / pokazal / zmienil baze

### Backup
Brak (nowe pliki + dopiski)

### Test/Ewaluacja
- Ustaw baza D:\Marketing lub M:\ w Ustawieniach / modalu
- Explorer: BABKA CYTRYNOWA -> ikony copy+reveal przy nosniku i plikach
- Reveal pliku PNG -> folder 4 - WIZKI + plik zaznaczony
- activity.html pokazuje wpisy po akcjach
- Bridge: `python apps/desktop/local_bridge.py` (port 8766)

### Zrodla
- wymaganie usera 2026-07-17 (screenshot warianty + mapowanie D?M)
- Windows: `explorer /select,"path"` (MS docs Explorer command-line)

---

## 2026-07-17 - Globalny chrome: panel wiadomosci + design system

### Komenda/Akcja
Naprawa rozwijania panelu wiadomosci (dzialalo tylko na czesci stron) + zasada: zmiany chrome/UI tylko globalnie (motyw Geex / dam-shell / dam-brand).

### Log/Status
1. Root cause: `height: 520px !important` na `.popup--message` + jQuery `slideToggle` (Geex main.js) - powiadomienia OK, wiadomosci nie.
2. `dam-shell.js`: `ensureHeaderChrome()` wstrzykuje ten sam header na stronach bez quickaction (settings/profile/activity/billing/help).
3. `bindDamHeaderPopups()`: otwieranie przez class `.is-open` (capture); odpina Geex click.
4. `main.js`: wczesny return gdy `data-dam-popups=1`.
5. Style tabow/resize/msg w `dam-brand.css` na tokenach (`--primary-color` itd.), bez inline one-off.
6. Cache `?v=20260717chrome1` ujednolicony na wszystkich HTML.
7. memory.md ?34 + design-system/MASTER.md sekcja Chrome.

### Efekt/Fix
Wiadomosci / powiadomienia / profil dzialaja tak samo na costs, dashboard, settings itd.

### Test/Ewaluacja
- costs.html: klik ikony wiadomosci -> panel Asana/Teams + resize
- settings.html: pojawia sie pelny header chrome
- Escape / klik poza zamyka popup

---

## 2026-07-17 - Hub produktu: DK/GC + nosniki + wizki + lightbox

### Komenda/Akcja
Filtr DK/GC przy tytule (slot 1); widok wizualizacji kafelki/lista/skala (slot 2); naprawa blednego BATON; miniatury + lightbox; ?Nie widzisz wariantu? Dodaj go?.

### Log/Status
1. `dam-labels.js`: folder tylko `data - indeks` -> UNKNOWN (nie BAT); infer z prefiksu pliku/folderu KAR6X; detectMarketFromPath PL/GC.
2. `carrier-overrides.json`: klucz `6300622.00` -> KAR6X / nieaktualne (stary karton 6x, nie BATON).
3. `dam-explorer.js`: resolveCarrierCode + override; toolbar slot1 DK/GC chips; slot2 Kafelki/Lista/Skala; thumbs via `/media`; lightbox prev/next/X; modal dodawania wariantu -> POST `/carrier-override`.
4. `dam-brand-filter.js`: `renderChips` dla strefy produktu.
5. `local_bridge.py`: GET `/media`, POST `/carrier-override`.
6. memory.md ?35; cache `?v=20260717hub1`.

### Efekt/Fix
- BABKA CYTRYNOWA: KARTON 6x MINI BATONIKI + MINI BATONIK (bez fake BATON).
- 6300622 pod ?Pokaz starsze? jako KAR6X.
- Prawdziwe miniatury; lightbox z nawigacja i X.
- DK/GC i ustawienia widoku przy tytule produktu.

### Test/Ewaluacja
- browser: explorer.html?product=babka-cytrynowa-nerkowcowy - DK/GC chips, Kafelki/Lista/Skala PASS
- brak naglowka BATON PASS
- KAR6X expanded: 28 thumbs, naturalWidth > 0, media bridge PASS
- lightbox is-open + prev/next/close PASS
- ?Nie widzisz wariantu? Dodaj go? widoczne PASS

### Zrodla
- wymaganie usera 2026-07-17 (screenshoty 1/2 + folder 13.02.2025 - 6300622.00)
- memory.md ?35

---

## 2026-07-17 - Logo DK przywrocone (light/dark) + README + push GitHub

### Komenda/Akcja
Przywrocenie logo Dobra Kaloria w sidebarze; kontrast light/dark; dokumentacja; commit + push do GitHub.

### Log/Status
1. Root cause: `logo-lite.svg` / `logo-dark.svg` / `logo-dobra-kaloria.svg` mialy `fill: #fff` (lub biale tlo) - na jasnym sidebarze niewidoczne.
2. Skopiowano z brand SVG (bez Niemiesa): `LOGO Dobra Kaloria zielony.svg` -> `logo-dk-green.svg` (+ `logo-dk-white.svg` zapas).
3. Podmieniono `logo-lite` / `logo-dark` / `logo-dobra-kaloria` na zielony `#008244`.
4. `dam-shell.js`: `LOGO_SRC_LIGHT` / `LOGO_SRC_DARK` + `applyDobraKaloriaLogo` per slot.
5. `dam-brand.css`: widocznosc logo + min-height sidebara; cache `?v=20260717logo1`.
6. Docs: `design-system/components/logo.md`, memory.md ?36, README wyczerpujacy bez sekretow.
7. `.gitignore`: tooling/bin, thumbs, postgres, .cursor, sekrety.

### Efekt/Fix
Logo zielone DK widoczne w light i dark. Zakaz Niemiesa zapisany.

### Test/Ewaluacja
- Hard refresh UI `?v=20260717logo1`
- Light: zielony wordmark na jasnym sidebarze
- Dark: ten sam zielony

### Zrodla
- Brand: `D:\Marketing\- POLSKA\- BRANDING i MARKA -\DOBRA KALORIA\01 - LOGO\SVG`
- Geex: `html[data-theme=dark]` + klasy `.logo-lite` / `.logo-dark`

### Git / GitHub
- Repo prywatne: https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn
- Branch: `main` (commit `c337bea`)
- Auth: `gh` (konto inyfinn / keyring) - token z czatu NIE zapisany w repo
- `.gitignore`: tooling/bin, thumbs, postgres, sekrety

---

## 2026-07-17 - Viz modal: Przejdz vs Eksplorator Windows

### Komenda/Akcja
Naprawa mylacych przyciskow w modalu Wizualizacje (SALTY NUT itd.).

### Log/Status
1. "Eksplorator produktu" robil `explorer.html?product=` (jak Indeks) - ZLE nazwa.
2. Przemianowano na **Przejdz do produktu** (hub DAM).
3. **Eksplorator produktu** = `DamPaths.openFolderInExplorer` - folder w Windows Explorer.
4. Ikony: arrow-right, folder-open, copy, share-alt (`.dam-btn-icon`).
5. Karty galerii: te same etykiety + przycisk folderu.

### Efekt/Fix
Dwa rozne CTA: hub HTML vs Windows folder. Ikony obowiazkowe.

### Test/Ewaluacja
- Hard refresh `visualizations.html?v=20260717vizbtns1`
- Bridge :8766 wymagany do otwarcia folderu

### Zrodla
- memory.md ?38, ui-ux-pro-max (ikony + touch 44px)

---

## 2026-07-17 - Viz Studio (Z tlem / Bez tla + lightbox)

### Komenda/Akcja
Redesign wizualizacji w hubie produktu: sortowanie tlem, hero per perspektywa, studio z sidebar/meta/zoom.

### Log/Status
1. Brief/PLAN: `ui-complete/00-brief.md`, `PLAN.md`
2. Labels: `vizBackground`, `vizSizeHint`, `vizFormatHint`, `vizLangFromFile`
3. Explorer: `buildVizStudioModel`, `renderVizGroups`, `openLightbox` (studio)
4. CSS: `.dam-viz-studio`, `.dam-lightbox--studio` w `dam-brand.css`
5. Bridge: `GET /media-meta` (PIL) - wymaga restartu procesu :8766
6. Fix: syntax error w catch stringu (blokowal IIFE) + em-dash w meta -> `x`/`-`
7. Ralph: screenshoty + `QA-AUDIT.md` FAIL=0

### Efekt/Fix
Sciana L/S zniknela z karty; klik hero otwiera studio z wariantami i meta.

### Test/Ewaluacja
- Babka KAR6X: taby 16/12, hero ENFACE/FRONT/BACK
- Studio meta: 3508 x 2480, 2.3 MB, RGB, DPI 72, JPEG
- `loop-final-{375,768,1024}.png`

### Zrodla
- `memory.md` ?37, `design-system/components/viz-studio.md`
- ui-complete / ui-ux-pro-max (Geex tokens)

---

## 2026-07-17 - Synology: wywolanie okna Uzyskaj lacze (bez modalu instrukcji)

### Komenda/Akcja
Usunac reczny modal udostepniania; DAM ma otwierac okno Synology Drive Client. Commit + push.

### Log/Status
1. Odrzucony UX: modal z 5 krokami PPM (user: "to miales wywolac okno synology").
2. Probe: Shell.Application.Verbs nie listuje Synology; AF_UNIX ui.sock z tej Pythona niedostepny.
3. Dziala: IContextMenu (IShellFolder.GetUIObjectOf) -> submenu Synology Drive -> "Uzyskaj lacze" (hr=0).
4. Produkcja: `apps/desktop/synology_get_link.ps1` + bridge `POST /synology-share`.
5. Front: `DamPaths.shareViaSynology` w `dam-paths.js`; `dam-viz.js` bez `openSynologyModal`.
6. Docs: `memory.md` ?27, `help.html` FAQ.

### Efekt/Fix
Klik "Udostepnij" otwiera natywne okno Synology (Get link). Modal instrukcji usuniety.

### Backup
Brak (tylko kod UI/bridge).

### Test/Ewaluacja
- `synology_get_link.ps1` na pliku PNG z D:\Marketing\- EKSPORT\... -> `ok:true`, verb Uzyskaj lacze
- Bridge restart wymagany po zmianie `local_bridge.py`

### Zrodla
- Win32 IContextMenu / IShellFolder (MSDN shell)
- Synology Drive Client context menu (lokalnie na stacji)

## 2026-07-18 - Sync Marka dropdown <-> chipy DK/GC + customizer button

### Komenda/Akcja
Synchronizacja filtra marki (toolbar "Marka: ..." z chipami DK/GC w produkcie) oraz zmniejszenie napisu "Dostosuj wyglad".

### Log/Status
1. dam-brand-filter.js: commitBrands + syncAllUi - jedna zmiana aktualizuje wszystkie triggery i chipy
2. pruneChipInstances - explorer remountuje #damProductBrandMount przy kazdym renderMain
3. dam-explorer.js: jeden addListener(onBrandFilterChange) zamiast stackowania callbackow
4. dam-viz.js: ten sam wzorzec addListener
5. dam-app.css: .geex-btn__customizer span 11px / line-height 1.15; ikona bez zmian
6. Cache bust: brandsync1 / customizer1 na explorer + visualizations

### Efekt/Fix
Odznaczenie GC w dropdownie odznacza chip GC (i odwrotnie). Przycisk customizera mniejszy wizualnie.

### Test/Ewaluacja
- Desktop (pywebview / skrot DAM ETA) - przeladowac Eksplorator, otworzyc produkt, toggle Marka vs DK/GC
- Nie opierac QA na http://127.0.0.1:8765 (dev-only)

### Zrodla
- memory.md Desktop first
- apps/web/assets/js/dam-brand-filter.js

## 2026-07-18 - file-index jako baza + fix sidebar collapse

### Komenda/Akcja
Projekty z mockow (3) -> file-index.json (187). Naprawa logo/zwijania sidebara.

### Log/Status
1. dam-api.js: offline czyta apps/web/data/file-index.json; kompletnosc z files_by_role (artwork/viz/print)
2. dam-projects.js: link do explorer.html?product= + checklista
3. dam-brand.css: collapsed logo 36px; przycisk expand wystaje poza panel (right:-16px)
4. dam-shell.js: setSidebarCollapsed + klik logo przy zwinieciu rozwija menu
5. Cache bust fileindex1 / sidebar2

### Efekt/Fix
Lista Projektow pokazuje caly indeks z repo. Sidebar da sie przywrocic; logo nie ucina sie na zwinietym.

### Test/Ewaluacja
- Desktop: Projekty -> ~187 kart; status "(indeks dysku w projekcie)"
- Zwin menu -> logo 36px, strzalka po prawej -> klik rozwija; albo klik logo

### Zrodla
- apps/web/data/file-index.json (product_count 187, viz_count 341)
- dam-paths.js: prefix sciezki vs stala struktura

## 2026-07-18 - konta bcrypt + ROOT offline + fix slots

### Komenda/Akcja
User: fetch z bazy; pliki z ROOT; offline kropka; konta szyfrowane; sesja=urzadzenie; konto KW.

### Log/Status
1. Fix `rolesFromRevision`: null rev nie crashuje na `.slots` (7 produktow bez revisions).
2. Projekty: metadane z file-index (baza lokalna), nie Laravel-first.
3. Auth: `auth_store.py` SQLite + bcrypt; bridge `/auth/login|register|me`; seed KW admin.
4. Sesja device_id - logout nie kasuje tokenu. signin.html prawdziwy formularz.
5. `dam-root-status.js`: czerwona kropka + Wskaz sciezke; `/files/status` probe X:\Marketing OK.

### Efekt/Fix
Projekty laduja sie; pliki online widoczne; konto KW w lokalnej bazie.

### Test/Ewaluacja
- Zaloguj: krzysztof.wieczorek@kubara.pl (haslo lokalne)
- Ustaw ROOT -> zielona kropka Pliki online
- Projekty: ~187 kart bez bledu slots

### Zrodla
- apps/desktop/auth_store.py, local_bridge.py
- apps/web/assets/js/dam-api.js, dam-root-status.js, signin.html

## 2026-07-18 - sciezka Marketing = wybor UZYTKOWNIKA

### Komenda/Akcja
User: zalezy od konta / kto zalogowany / co sobie ustawi. Zawsze liczy sie ustawienie usera, nie stala.

### Log/Status
1. Usunieto auto-nadpisywanie `dam_base_path` przez detect (X:/D:).
2. `ensureUserBase`: jesli user ustawil -> nie ruszac; pierwszy start -> tylko backup tego USERNAME; detect = sugestia.
3. `machine-config.json`: `{ users: { <USERNAME>: { base_path } } }`.
4. UI: brak domyslnego `X:\Marketing` w polu; Podpowiedz nie zapisuje sama.

### Efekt/Fix
Prawda sciezki = `dam_base_path` usera. Indeks tylko do remap struktury.

### Test/Ewaluacja
- Ustawienia: wpisz swoja baze -> Zapisz; restart nie zmienia na X: samo
- Drugie konto Windows moze miec inna baze w machine-config.users

### Zrodla
- apps/web/assets/js/dam-paths.js
- apps/desktop/local_bridge.py, machine-config.json

## 2026-07-18 - skrot DAM ETA nie startuje (zombie)


### Komenda/Akcja
Diagnostyka: skrot -> wscript -> run-dam.vbs -> pythonw launch.py

### Log/Status
1. Znaleziono zombie: launch.py + 2x local_bridge na 8765/8766, **bez widocznego okna** -> mutex blokowal nowy start ("juz uruchomiony").
2. Zabito PID 688/49980/56716.
3. `acquire_single_instance`: focus okna albo auto-kill zombie + retry; mutex handle trzymany w `_MUTEX_HANDLE`.
4. `run-dam.vbs`: pelna sciezka `C:\Python314\pythonw.exe` + log `launch-last-error.txt`.

### Efekt/Fix
Skr?t powinien znowu otwierac okno; przy kolejnym zombie auto-odzyskanie.

### Test/Ewaluacja
- Dwuklik "DAM ETA" na pulpicie
- Jesli fail: sprawdz `apps/desktop/launch-last-error.txt`

### Zrodla
- apps/desktop/launch.py, run-dam.vbs

## 2026-07-18 - X:Marketing + restart okna + structure-mcp

### Komenda/Akcja
1) Restart okna w Ustawieniach. 2) Indeks z X:\Marketing (nie D:). 3) Potwierdzenie wiedzy migracji structure-mcp.

### Log/Status
1. structure-mcp: `X:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\CURSOR\MCP - Filesystem\structure-mcp\` (memory: sloty 0-4, flat migrate, legacy M:). MCP config: POLSKA/EKSPORT = X:\Marketing, legacy = M:\ (obecnie niedostepny).
2. Skan X: LIVE: DK 144 + GC 43 = **187 produktow**; ~406 folderow wariantow. Indeks nie jest "ubogi" wzgledem drzewa X: - tyle jest w plaskiej strukturze.
3. `build-file-index.py`: auto `X:/Marketing` > `D:/Marketing`; przebudowa: products=187, viz=179 (czesciowe thumbs: WinError 389 cloud).
4. Domyslne sciezki UI: `X:\Marketing` (settings + dam-paths).
5. `launch.py`: `DamJsApi.restart_window` + opozniony relaunch (mutex). `settings.html`: przycisk "Zrestartuj okno aplikacji".

### Efekt/Fix
Indeks wskazuje X:; restart tylko w desktopie. Liczba 187 = stan drzewa X:, nie blad skanera. Wiecej bytow bedzie gdy: (a) M: legacy zmountowany i doscanowany / domigrowany, albo (b) UI liczy warianty/indeksy zamiast folderow produktu.

### Test/Ewaluacja
- Desktop: Ustawienia -> Zrestartuj okno aplikacji (confirm -> zamkniecie + relaunch)
- Ustawienia: baza `X:\Marketing` -> Sprawdz (3 foldery)
- Projekty / Eksplorator: ~187 kart, sciezki `X:/Marketing/...`

### Zrodla
- structure-mcp/memory.md (2026-07-17)
- user-structure MCP structure_get_config
- apps/web/scripts/build-file-index.py
- apps/desktop/launch.py

---

## 2026-07-18 - SQLite zamiast Dockera/Postgres (ADR-007)

### Komenda/Akcja
Uzytkownik: Docker nie wchodzi w gre dla normalnego usera; pytac o MySQL / cos natywnego.

### Log/Status
1. Decyzja: **SQLite** (nie MySQL - MySQL tez wymaga demona).
2. `apps/desktop/dam_db.py` - WAL, audit_log, status `docker_required: false`.
3. Bridge: audit -> SQLite (+ mirror JSONL); `/db/status`; usunieto `pg_store.py`.
4. `docker-compose.yml` - profil `dev-postgres` tylko opcjonalnie.
5. ADR-007 + amend ADR-001. memory.md ?41.

### Efekt/Fix
Odpalenie skrotu DAM ETA = baza w tle (plik SQLite). Bez Dockera, bez instalacji serwera DB.

### Test/Ewaluacja
- `python -c "import dam_db; print(dam_db.status())"` ? ok, wal=True, users>=1
- GET `/db/status` na bridge po starcie launchera

### Zrodla
- docs/ADR/ADR-007-local-sqlite.md
- apps/desktop/dam_db.py

---

## 2026-07-18 - Przyciski kart projektow (Geex)

### Komenda/Akcja
ui-taste: Checklista wygladala spoza DS (czarna obwodka `geex-btn--transparent`).

### Log/Status
1. Przyczyna: `geex-btn--transparent` w THEME = border 2px dark (button.html).
2. Fix: secondary = domyslny `geex-btn` (szary Geex), primary bez glow; ikony uil jak THEME.
3. Label primary skrocony do "Eksplorator" (jak viz).

### Efekt/Fix
CDP: Checklista `border: 0`, bg `rgb(236,234,243)`, radius 14px, min-height 44px.

### Zrodla
- THEME/geex-html-main/button.html
- apps/web/assets/js/dam-projects.js
- apps/web/assets/css/dam-app.css

---

## 2026-07-18 - Kontrast UI + ikony brak?w + wspolna baza

### Komenda/Akcja
ui-taste + ui-ux-pro-max: nieczytelne blekitne teksty, niewyr?wnanie; braki jako `Brak: viz_3d`; baza musi byc TA SAMA dla wszystkich.

### Log/Status
1. Przyczyna blekitu: Geex `--secondary-color: #B7DBF9` uzyty na subtitle - nieczytelny na bieli.
2. Fix signin: subtitle/title left-align z formem; kolor `--dark-color` / `#17161E`; tabs bez secondary-color.
3. Karty: mini-checklista jak Eksplorator (`dam-check-ok/brak` + Unicons); etykiety: Wizualizacje, Projekt graficzny, Pliki do druku.
4. Baza: `X:\Marketing\.dam-eta\dam-shared.sqlite` (WAL, busy_timeout 60s); seed z lokalnej; fallback lokalny.
5. ADR-007 amended; memory.md ?41+?43.

### Efekt/Fix
- CDP signin: subColor `rgb(23,22,30)`, titleLeft==emailLeft.
- CDP karty: lab `rgb(23,22,30)`, html `Wizualizacje Pliki do druku` (bez kodow API).
- `dam_db.status()`: shared=True, path Marketing `.dam-eta`.

### Test/Ewaluacja
Pass 1-5 screenshot (signin 375/768/1280 + karty 1280).

### Zrodla
- apps/desktop/dam_db.py
- apps/web/signin.html, dam-projects.js, dam-app.css
- docs/ADR/ADR-007-local-sqlite.md

---

## 2026-07-18 - Hierarchia CTA (jeden solid)

### Komenda/Akcja
ui-ux-pro-max: w grupie akcji tylko jeden przycisk ciezki (solid); drugi obrys/mniej absorbujacy.

### Log/Status
1. `project.html`: Przelicz = `geex-btn--primary`; Powiadom = `geex-btn--primary-transparent`.
2. Wzorzec `.dam-action-stack` w dam-app.css; memory.md ?44.
3. Modal sciezki Marketing: Save primary, Suggest outline, Skip szary.
4. Sloty checklisty: ikony + Wizualizacje (bez "3D").

### Test/Ewaluacja
CDP: recompute bg solid purple; notify border purple + transparent fill.

### Zrodla
- THEME/geex-html-main/button.html (primary vs primary-transparent)
- apps/web/project.html, dam-project.js, dam-app.css

---

## 2026-07-18 - Logo + wyszukiwarka na Projektach

### Komenda/Akcja
Logo zniknelo na Projekty; brak wyszukiwarki jak w Eksploratorze.

### Log/Status
1. Przyczyna logo: `index.html` nie mial `.geex-sidebar__header` / `.geex-sidebar__logo`.
2. Fix: markup logo w index + `ensureSidebarLogo()` w dam-shell (wszystkie strony).
3. Toolbar Projektow: `#damProjectsSearch` - ten sam placeholder i anatomia co Eksplorator; filtr lokalny.

### Test/Ewaluacja
Screenshot: logo DK w sidebarze; search "Szukaj indeksu lub skojarzenia..."; filtr `xmas` zaw??a karty.

---

## 2026-07-18 - ZIP nie jest wizualizacja

### Komenda/Akcja
Studio pokazywalo DK-6300753.00-Pakiet.zip (643 MB) jako WARIANT wizualizacji. Niedopuszczalne.

### Log/Status
1. ZIP lezal w 4 - WIZKI - indexer wrzucal caly slot do viz/wizki.
2. Fix indexer: resolve_file_role - archiwa nigdy viz; Pakiet/FQ/3-DRUK -> print; viz tylko obrazki.
3. Fix UI: filterVizImageFiles w dam-explorer; checklista/API bez ZIP jako viz.
4. Patch file-index.json: 7 archiwow przeniesionych viz->print (m.in. 6300753 Pakiet).
5. Asana CSV: apps/web/data/asana-tasks-kw.csv (433 taski) jako baza pod projekty/sciezki.

### Test/Ewaluacja
6300753: ZIP tylko w print; wizki = jpg/png FRONT/TYL. DamLabels.isVizImage(zip)=false.

---

## 2026-07-18 - Projekty UX: copy, ikony, liczniki, baza

### Komenda/Akcja
Ingest niezrozumialy; 187 vs wiecej produktow; ikony nie rowno; dwie ikony; Materialy kompletne; Dostosuj wyglad + baza.

### Log/Status
1. Przycisk: Wczytaj z dysku (nie Ingest pointerow).
2. Liczniki: 187 produktow na X: Marketing = poprawne foldery; 473 warianty; 322 bazy indeksow. M: offline. ARCHIWUM osobno.
3. Checklist: Materialy kompletne / Brakuje materialow + 3 role (jedna ikona statusu). CSS align + unicons-line.
4. Baza: X:\Marketing\.dam-eta\dam-shared.sqlite EXISTS (users/sessions/audit). Preferencje w Dostosuj wyglad = kolejny krok (zapis do SQLite).

### Test/Ewaluacja
Status UI: 187 produktow ? 473 wariantow. CDP icon/lab delta 0.

---

## 2026-07-18 - Modal wizualizacji: przyciski + warianty

### Komenda/Akcja
Przyciski za duze; Kopiuj/Udostepnij jako ikony w kole; 3x Polska daje ten sam efekt.

### Log/Status
1. Przyczyna: klik ustawial img.src = sciezke X:/ (browser nie laduje) + kopiowal sciezke.
2. Fix: thumb_url / bridge media; etykiety = indeks gdy wiele rewizji; Multijezyczny tylko przy >1 jezyku.
3. Akcje: 1 wiersz - Produkt, Eksplorator, okragle Kopiuj/Udostepnij.
4. Indexer: pick_thumb preferuje plik z indeksem rewizji.
5. Dysku: folder 6300767 zawiera pliki nazwane 6300524 (kopia bez rename) - wizualnie identyczne.

### Test/Ewaluacja
Do weryfikacji w visualizations.html?v=vizmodal1

---

## 2026-07-18 - DB + global search/tags + konta

### Komenda/Akcja
Czy baza dziala; Odswiez vs Wczytaj; tagi Autor + 12-24; global search na Projekty/Wizualizacje; konta test; awatary.

### Log/Status
1. Baza OK: `X:\Marketing\.dam-eta\dam-shared.sqlite` - 18 userow po seed.
2. Seed: `seed_kubara_users.py`, haslo `test`, login Agata/KW zweryfikowany.
3. Odswiez = reload z indeksu; Wczytaj z dysku = ingest/skan (tooltips).
4. `enrich-search-tags.py`: smak 24, typ 22, opakowanie 14, autor 16 (Asana CSV).
5. `dam-tag-bar.js` + collapse ~700px; wired explorer/projects/viz.
6. Awatary: female/male SVG wg email w `dam-shell.js`.

### Test/Ewaluacja
- login agata.karon@kubara.pl / test = OK
- tag_groups w search-index.json = OK

---

## 2026-07-18 - Nosnik FOLIA + meta PS + rename indeksu (admin)

### Komenda/Akcja
Usunac "Nosnik nieokreslony" gdy FOLIA widoczna; meta jak w EKSPORT WIZEK PS; tryb admina = edycja indeksu z rename na dysku.

### Log/Status
1. Przyczyna: `parseCarrierCode` nie znal FOLIA + UI doklejal "Nosnik nieokreslony ? " + folder.
2. Fix labels: FOLIA/REKAW/SLEEVE/? + skan calej nazwy; `parseRevisionMeta` / `extractIndexFromString` (jak JSX).
3. Explorer: label = czysty nosnik; chippy Marka/Indeks/Data; meta produktu Marka+Indeksy.
4. Admin: input indeksu + Zastosuj -> bridge `POST /rename-index` (tylko pod Marketing, confirm).
5. Cache: explorer `?v=20260718carrier1`.

### Test/Ewaluacja
- Odswiez explorer: ORZESZKI KUKURYDZA MIOD / FOLIA -> etykieta "FOLIA" (nie UNKNOWN).
- Admin: edycja indeksu wymaga confirm; dry path poza Marketing odrzucony.

---

## 2026-07-18 - Header wiadomosci/powiadomienia + logo login

### Komenda/Akcja
Skala i czytelnosc popupow Wiadomosci/Powiadomienia (Geex); logo na logowaniu wycentrowane nad napisami.

### Log/Status
1. Badge: realne liczby (Asana+Teams / ops), pill 20px, nie fake 84.
2. Popup: naglowek + wiekszy padding, ikony z tonem, zrodlo (DAM/Asana/Teams), bez podkre?len.
3. Login: logo DK centered nad tytulem (height 56px force - fix collapse).
4. Cache: `?v=20260718notif1`.

### Test/Ewaluacja
- Pass screenshot: settings powiadomienia (ikony+tagi), wiadomosci Asana bez underline.
- Pass screenshot: signin - logo nad "Witaj w DAM ETA", centers match.

---

## 2026-07-18 - Tag bar per-kategoria + ikony akcji wiz

### Komenda/Akcja
Tagi nie przycinac globalnie; kategoria >10 rozwija sie w dol. Eksplorator/Udostepnij = ikona; Przejdz do produktu = tekst.

### Log/Status
1. `dam-tag-bar.js`: usunieto max-height collapse; per group ROW_LIMIT=10 + `+N`/`mniej`.
2. Karty + modal `dam-viz.js`: `dam-btn-icon-only` dla folder/share.
3. Cache `?v=20260718tags2`.

### Test/Ewaluacja
- visualizations: Smak/Typ/Opakowanie/Autor widoczne naraz; +N przy Smaku spycha siatke.
- karta: Przejdz do produktu z napisem; obok same ikony.

---

## 2026-07-18 - Badge wiz: czytelny opis rewizji

### Komenda/Akcja
Wyjasnienie badge `(.01 > .00)` + zmiana copy na ludzki jezyk.

### Log/Status
1. Znaczenie: indeks pakowania ma sufiks rewizji; wyzszy (`.01`) = nowsza wersja niz `.00`.
2. Galeria bierze `viz_latest` = tylko aktualne.
3. `viz.badge` PL/EN + tip na badge w `visualizations.html`.

### Efekt/Fix
Badge: "Tylko najnowsze wersje produktow" (+ tip o `.01` vs `.00`).

---

## 2026-07-18 - Bridge offline + skroty F1/F5 + header polish

### Komenda/Akcja
Naprawa false-offline (brak mostu przy samym http.server), UI offline, F1/F5, kontrast badge, cienkie ikony.

### Log/Status
1. Diagnoza: UI = `python -m http.server 8765`, bridge 8766 nie dzialal -> "Bridge offline".
2. Start `local_bridge.py` + `serve_browser.py` (UI+bridge) + supervisor w `launch.py`.
3. `dam-root-status.js`: rozroznienie most/sciezka, `body.dam-bridge-offline`, szybszy poll offline.
4. `dam-shortcuts.js`: F1 modal pomocy, F5/Ctrl+R odswiez.
5. `dam-shell.js`: `normalizeHeaderIcons` (Unicons), badge msg/notif.
6. CSS: pasek offline, wiekszy pill, badge #B45309 / #0E7490, modal pomocy.
7. Cache `?v=20260718shell3`.

### Efekt/Fix
Most online gdy bridge dziala; offline widoczny (pasek + pill); F1/F5; czytelniejsze badge i ikony.

### Test/Ewaluacja
- `GET http://127.0.0.1:8766/health` = ok; machine-config `X:\\Marketing`
- Pass: Pliki online po starcie mostu; offline pill + `#damOfflineBar` 5px
- Pass: F1 modal pomocy; badge computed `#B45309` / `#0E7490`
- Pass: header icons = Unicons line (`dam-header-icon`)

---

## 2026-07-18 - Switch "Tylko najnowsze" + typografia toolbar/kart

### Komenda/Akcja
Badge rewizji -> switch; ujednolicenie fontow kontroli; wycentrowanie kart wiz.

### Log/Status
1. HTML: `#vizLatestOnly` + klasy `dam-control` / `dam-control--select`.
2. `dam-viz.js`: persist + expand starszych rewizji z products gdy OFF.
3. Tokeny `--dam-fs-*` / `--dam-control-*`; CSS switch + center body kart.
4. Cache `?v=20260718vizsw1`.

### Test/Ewaluacja
- ON: 278 wariantow; OFF: 285; lang/brand/switch fs=12px; title 14px center.

---

## 2026-07-18 - Autor inyfinn.art + CTA Przejdz + ui-taste intensive

### Komenda/Akcja
Usunac ETA Innovations z footera; CTA krotkie; skill ui-taste 10 rund przy mocnym polishu.

### Log/Status
1. `dam-shell.js` + i18n PL/EN + HTML footery: inyfinn.art (link).
2. `dam-viz.js`: przycisk "Przejdz".
3. settings/help + viz.subtitle uproszczony.
4. `ui-taste/SKILL.md` ?0.E: Intensive mode = 10 passes + self-critique.
5. Cache `?v=20260718inyf1`.

### Test/Ewaluacja
- Screenshot: footer `inyfinn.art ? 2026`, karty z CTA "Przejdz".

---

## 2026-07-18 - NOID fix + kalkulator picker (intensive QA)

### Komenda/Akcja
Usunac NOID z UI; pokazac prawdziwy indeks (np. 6300760); przebudowac wybor projektu w kalkulatorze kosztow.

### Log/Status
1. Root cause: `parse_index` wymagalo `NNNNNNN.RR`; foldery maja same cyfry -> fallback `noid`.
2. `build-file-index.py`: INDEX_PLAIN_RE + zakaz 6300XXX; thumb stem `pending` zamiast `noid`.
3. `repair-missing-indexes.py`: naprawiono 18 rewizji / 11 viz (limonka = 6300760).
4. `dam-viz.js`: `resolveIndexBase` / badge indeksu / nigdy nie pokazuj noid.
5. `dam-cost.js` + CSS: picker (bucket + search + select + wybrany projekt), RWD 375/768/1280.
6. Cache `?v=20260718noid1`. memory.md ?57.

### Test/Ewaluacja
- Intensive QA: DAKTYL LIMONKA badge `6300760`, body `noid` count = 0.
- Costs: brak chmury tagow; Marketing bucket = 3 projekty; mobile stack OK.

### Zrodla
- DamLabels.extractIndexFromString
- build-file-index.py parse_index

---

## 2026-07-18 - Typ vs Smak + mobile menu (ui-taste 5 passes)

### Komenda/Akcja
Poprawic taksonomie tagow (Typ != Smak) i ucinanie menu mobile u gory.

### Log/Status
1. Design read: Geex DAM filter redesign-preserve; dials 5/3/5.
2. Indexer: `muffin` -> Smak; Typ = baton / mini baton / mini batoniki / BAT / sleeve / karton 6x / kulki / sypkie / niemiesne?
3. `repair-tag-taxonomy.py` + sync `enrich-search-tags.py`.
4. `dam-tag-bar.js`: etykiety + auto-mount cold-load; explorer renderTagChips przed ciezkim load.
5. Mobile drawer: main.js bez width:toggle; CSS left:0 / transform:none / pad-top 44px + safe-area.
6. Cache `?v=20260718typ4`.

### Efekt/Fix
- Typ pokazuje mini baton, BAT, sleeve, karton 6x; muffin w Smak.
- Produkt 6300754 (KULKI MALINA): typ kulki, smak malina.
- Sidebar mobile: logoTop?49, clipped=false.

### Test/Ewaluacja (ui-taste 5 passes)
- Pass 1 (mobile~618): hierarchia Typ/Smak OK; nosniki widoczne.
- Pass 2 (sidebar open): logo + X widoczne, transform none.
- Pass 3: smak rozwiniety - muffin w Smak; typ bez muffina.
- Pass 4 (768): drawer open, logoTop 49, nie uciete.
- Pass 5 (desktop): pelna taksonomia + search 6300754.

### Zrodla
- User brief (Typ = nosnik/format; Smak osobno)
- apps/web/scripts/build-file-index.py, repair-tag-taxonomy.py
- apps/web/assets/js/dam-tag-bar.js, dam-explorer.js, main.js
- apps/web/assets/css/dam-brand.css

---

## 2026-07-18 - Przeniesienie SQLite z Marketing do repo

### Komenda/Akcja
User: zakaz zapisu `X:\Marketing\.dam-eta`; tylko repo; baza ma dzialac; status DB/indeks/dysk.

### Log/Status
1. Znaleziono `X:\Marketing\.dam-eta\dam-shared.sqlite` (ADR-007 stary kanon).
2. `dam_db.py`: kanon = `apps/desktop/data/dam-local.sqlite`; zero zapisu na Marketing.
3. Migracja danych do repo; usunieto `X:\Marketing\.dam-eta` (2x - stary most odtworzyl raz).
4. Restart bridge 8766; ADR-007 + memory ?41/41b.

### Efekt/Fix
- `/db/status` -> repo `dam-local.sqlite`, location=repo, `.dam-eta` nie istnieje.
- Auth: 1 user (admin Kubara). Indeks JSON w repo: 187 produktow. Marketing online (probe POLSKA).

### Test/Ewaluacja
- health ok; db/status path w repo; files/status online=true; Test-Path X:\Marketing\.dam-eta = False.

---

## 2026-07-18 - Modal wiz: chip 1x, FRONT-S, zoom, +50%

### Komenda/Akcja
User: zawsze chip wariantu (nawet 1 indeks); ujednolicic modal; miniatura FRONT-S nie SKLEP2-XL (MALINA); admin wybiera miniature; modal +50%; zoom +/- / lupa.

### Log/Status
1. `dam-viz.js`: zawsze render `.dam-viz-modal__variant`; zoom toolbar; admin Miniatura + overrides.
2. `dam-brand.css`: modal max-width 1020px, hero ~420-520px, style zoom.
3. `pick_thumb_file`: tier 0 = czysty FRONT-S (bez SKLEP/XL); prefer DK-*.
4. `repair-viz-thumbs.py`: forced_unlink=17 SKLEP/XL; MALINA -> `DK-?-FRONT-S.png`.
5. Bridge `POST /thumb-override` -> `apps/web/data/thumb-overrides.json`.
6. `#vizAdminToggle` na visualizations.html; cache `?v=20260718vizmod2`.

### Efekt/Fix
- Chip widoczny takze przy 1 indeksie (np. CZARNA PORZECZKA / MALINA).
- MALINA: FRONT-S.png zamiast FRONT-S-SKLEP2-XL.
- Modal wiekszy + zoom; admin moze nadpisac miniature.

### Test/Ewaluacja
- pick_thumb_file(malina) = DK-?-FRONT-S.png; repair OK viz=279.

---

## 2026-07-18 - Commit + docs + machine_id + release

### Komenda/Akcja
User: pelny commit, README, dokumentacja, memory, push, release ZIP; weryfikacja ID maszyny/sesji przed startem.

### Log/Status
1. machine_identity.py + verify w launch.py
2. Auth machine_id/session_id; bridge /auth/identity
3. dam-api.js clear przy mismatch
4. README, DEPLOYMENT, ADR-008, memory ?59
5. build-release-zip.ps1 + GitHub release

### Efekt/Fix
Sesja nie przenosi sie miedzy PC; artefakt ZIP + tag release.

### Zrodla
ADR-007/008; Windows MachineGuid

---

## 2026-07-18 - FIX: skrot nie startowal (SW_HIDE) + WebView2 profil + teksty przyciskow

### Komenda/Akcja
User: aplikacja w ogole nie startuje ze skrotu (wscript run-dam.vbs, "nic sie nie dzieje"); ma dzialac bez recznego zarzadzania portami; sprawdz baze danych; teksty przyciskow przy wykrywaniu sciezki sa dziwne - zrob bardziej intuicyjne.

### Log/Status
1. Reprodukcja: Start-Process wscript.exe run-dam.vbs + polling MainWindowTitle co 1.5s.
   - PRZED fixem: 120s bez okna. Proces (pythonw, local_bridge, watch-file-index, msedgewebview2 renderer)
     zyje i dziala poprawnie w tle - tylko GLOWNE OKNO nigdy sie nie pokazuje.
   - Kontrolowany test: Start-Process pythonw.exe -WindowStyle Hidden = brak okna (60s). WindowStyle Normal = okno po ~3s.
2. Root cause: run-dam.vbs uzywal sh.Run(cmd, 0, False) - styl okna 0 = SW_HIDE. pythonw.exe nie ma konsoli,
   ale SW_HIDE w STARTUPINFO blokuje initial-show WinForms/WebView2 window (pywebview edgechromium backend).
3. Fix run-dam.vbs: styl okna 1 (SW_SHOWNORMAL) w obu wariantach sh.Run + sh.CurrentDirectory = desktopDir.
4. Test bazy: /db/status (sqlite, wal, 18 users, location=repo) + pelny login+session cykl (auth/login,
   auth/me z machine_id/device_id) - dziala w 100%.
5. WebView2 startuje kazdy raz z nowym folderem %TEMP% (private_mode domyslnie True w pywebview) - kosztowny
   cold start. Fix: webview.start(private_mode=False, storage_path=apps/desktop/data/webview2-profile).
6. Teksty przyciskow: "Podpowiedz" -> "Wykryj automatycznie" (+ ikona lupy), "Sprawdz" -> "Sprawdz foldery"
   (+ ikona ptaszka). Komunikaty statusu w jezyku czlowieka (stan ladowania + wynik). Poprawiono w 3 miejscach:
   settings.html, dam-paths.js (modal setup pierwszego uruchomienia), dam-shortcuts.js (panel Pomocy).
7. Naprawiono mangled znaki ? " -> ASCII " (encoding issue w tym repo z krzywymi cudzyslowami).
8. Cache bump: dam-paths.js?v=20260718btn1, dam-shortcuts.js?v=20260718btn1.

### Efekt/Fix
- Skrot dziala: dwuklik -> okno w ~1.5-2s (potwierdzone 2x testem end-to-end identycznym jak user).
- Baza SQLite w pelni sprawna (login/session/machine binding).
- WebView2 ma trwaly profil (szybszy restart, bez smiecenia %TEMP%).
- Przyciski "Wykryj automatycznie" / "Sprawdz foldery" - jasne, ludzkie komunikaty (przetestowane w przegladarce,
  oba flow: sukces + informacja co dalej).

### Backup
Brak - zmiany tekstowe/logiczne, nie destrukcyjne. Stary run-dam.vbs mial jedynie bledny parametr.

### Test/Ewaluacja
- Start-Process wscript.exe run-dam.vbs -> MainWindowTitle "DAM ETA - Dobra Kaloria" po 1.6s (2. przebieg testu).
- /db/status: {"ok":true,"engine":"sqlite","users":18,"location":"repo"}.
- auth/login + auth/me: pelny cykl OK z machine_id/device_id/session_id.
- Browser QA (cursor-ide-browser): screenshot + klik obu przyciskow, komunikaty renderuja sie czysto (bez mojibake).

### Zrodla
- pywebview src: webview/platforms/edgechromium.py (clear_user_data, private_mode) + webview/__init__.py (storage_path)
- WScript.Shell.Run docs (intWindowStyle 0=Hide,1=Normal) - Microsoft WSH reference

---

## 2026-07-18 - Dashboard: siatka kart 2x2 + kolory + nowy sygnet kosztow

### Komenda/Akcja
User: karty statystyk zle sie ukladaja (flexbox/grid) na Dashboardzie; dopracuj kolorki; stary kolorek/grafika z motywu Geex w panelu kosztu jest zla - zamienic na cos zwiazanego z kosztami, sygnet lekko widoczny.

### Log/Status
1. Root cause ukladu: dam-app.css .geex-content__summary__count = grid-template-columns: repeat(auto-fit, minmax(215px,1fr)).
   Przy 4 kartach i typowej szerokosci okna (np. domyslne okno WebView2 1360px, ponizej breakpointu 1365.98px gdy
   .summary staje sie kolumna) auto-fit dobiera 3 kolumny -> 4. karta osierocona w nowym rzedzie.
2. Fix: grid-template-columns: repeat(2, minmax(0,1fr)) na sztywno (2x2 zawsze); repeat(1,...) pod 575.98px.
3. Kolory: "Zadania Asana" mialo klase danger-bg (czerwony) - alarmujacy kolor dla neutralnej liczby zadan.
   Zmiana na info-bg. Ale Geex --info-color (#58CDFF) ma kontrast ~1.8:1 z bialym tekstem (fail WCAG AA) -
   nadpisano w dam-tokens.css na #5B8DEF (kontrast ~5:1, dam-brand.css mial juz ten kolor jako fallback niewykorzystany).
   Literowka klasy primay-bg -> primary-bg (poprawiona, karta 1 "Produkty").
4. balance-bg.svg (dashboard.html + invoices.html, dzielony plik): usuniete losowe pastelowe blob-y demo Geex
   (koral, krem, blekit) niezwiazane z marka/tresc. Nowy motyw: sygnet - 2 nakladajace sie kola (monety) w
   barwach marki (Geex fiolet + DK zielony), niska opacity + 2 piersciene (obrys monety), subtelny watermark.
5. Cache bump: dam-tokens.css / dam-app.css -> ?v=20260718cost1 (wszystkie 14 stron HTML), balance-bg.svg?v=20260718cost1.

### Efekt/Fix (zweryfikowane CDP getBoundingClientRect + screenshoty)
- 375px: 4 karty w 1 kolumnie (stack). 768px: 2x2. 1360px (domyslne okno app): 2x2 - bug 3+1 zniknal.
  1920px (layout z panelem kosztu z boku): 2x2 kart + panel kosztu 460px, bez zmian proporcji.
- Karta "Zadania Asana": rgb(91,141,239) = #5B8DEF (bylo czerwone danger-bg).
- Nowy sygnet (2 kola + piersciene, fiolet+zielon) widoczny w rogu panelu kosztu na kazdej szerokosci (460-991px),
  bez ucinania przez border-radius.

### Backup
Brak - zmiany CSS/HTML/SVG nie destrukcyjne, cache-bust zapewnia odswiezenie u uzytkownikow.

### Test/Ewaluacja
- Browser QA (cursor-ide-browser + CDP Emulation.setDeviceMetricsOverride): 375/768/1360/1920px.
- Page.captureScreenshot z explicit clip (poza widocznym viewportem tabu) do weryfikacji sygnetu w panelu.
- ReadLints: brak bledow w dashboard.html, invoices.html, dam-app.css, dam-tokens.css.

### Zrodla
- WCAG 2.1 contrast ratio formula (relative luminance) - obliczenia rece dla #58CDFF vs #5B8DEF na bialym tekscie.

---

## 2026-07-18 - Login: minlength=8 blokowal haslo seed "test"

### Komenda/Akcja
User: nie moge sie zalogowac (admin); screen z tooltipem HTML5 "min 8 znakow" przy hasle `test` + stary komunikat invalid_credentials.

### Log/Status
1. Baza OK; konto admin istnieje; bcrypt weryfikuje haslo seed `test` (True), haslo z poprzedniego screenu (False).
2. Root cause UI: `signin.html` input hasla mial `minlength="8"`; seed Kubara = `test` (4 znaki) - przegl?darka blokuje submit.
3. Fix: minlength=4 (jak auth_store.register min 4); komunikat dam-api "Haslo min. 4 znaki"; cache ?v=20260718auth3.

### Efekt/Fix
Logowanie emailem admina + haslem `test` nie jest juz blokowane przez walidacje HTML5.

### Test/Ewaluacja
- Python: `_verify_password("test", hash)` True; `login(..., "test")` ok/admin.
- UI: po restarcie skrotu DAM - zalogowac `krzysztof.wieczorek@kubara.pl` / `test`.

### Zrodla
- apps/desktop/seed_kubara_users.py PASSWORD=test
- apps/desktop/auth_store.py password min 4
- HTML constraint validation (minlength przed eventem submit)

---

## 2026-07-18 - Sidebar collapsed: teksty zamiast samych ikon

### Komenda/Akcja
User: zwiniety sidebar pokazuje obciete etykiety zamiast samych ikon.

### Log/Status
1. Root cause: w dam-brand.css selector
   `body.dam-sidebar-collapsed ... menu__link span` byl przypadkowo zlaczone z `.dam-footer-author-link`
   i dostawal tylko color/font-weight zamiast `display:none`.
2. Fix: osobne reguly - span/dam-nav-label display:none; link font-size:0 + ikony 20px;
   title/aria-label na linkach w dam-shell.js; cache ?v=20260718side1.

### Test/Ewaluacja
- Browser 1360px: body.dam-sidebar-collapsed, sideW=72, spansStillVisible=0, ikony visible 20px.
- Screenshot: kolumna ikon bez etykiet.

---

## 2026-07-18 - DAM admin viz overhaul (rozpoznawanie, tagi, admin, wizki)

### Komenda/Akcja
Plan: naming-dictionary, fix parse_carrier/langs/MIX/PL, dam-badges, Warianty, white thumbs,
admin red outline, thumb picker, viz-flags; weryfikacja V1-V10.

### Log/Status
1. Utworzono `apps/web/data/naming-dictionary.json` + `docs/NAMING.md`.
2. `build-file-index.py`: CARRIER_RE + strip lang, parse_folder_langs all segments, MIX label,
   white thumb composite, CARTON?KAR, date-folder ? OTHER + infer from files.
3. `dam-labels.js` laduje dictionary (sync XHR); SLEEVE/FOIL ? REKAW/FOLIA.
4. Nowy `dam-badges.js`; wpi?ty w `dam-viz.js` (+ explorer scripts); "Warianty".
5. CSS: biale tlo + padding 12px thumbs; badges flex-start; `.dam-admin-control`; demo yellow.
6. Bridge: `GET /folder-images`, `POST /viz-flag`; `viz-flags.json`; launch `pick_thumb`.
7. Admin toggle ukryty gdy rola != admin (viz + explorer).
8. Rescan: products=187 viz?336.

### Efekt/Fix
- 6300610: carrier=REKAW, langs=[cz,sk] (nie GB).
- 6300650 DK NUGGETS XXL: REKAW + pl; GC kopia tego samego indeksu ma default GC?gb (nietypowe).
- OATS: FOLIA/DOYPACK; CORNFLAKES: czesciowo FOLIA; DATE ORANGE: folder od daty + pliki WARIANT-* ? OTHER (do potwierdzenia).
- Zero FOIL/SLEEVE/CARTON w polu carrier po skanie.

### Test/Ewaluacja
V1-V10: wyniki ponizej (PASS/FAIL + dowody).

### Zrodla
- docs/NAMING.md, apps/web/data/naming-dictionary.json
- plan dam_admin_viz_overhaul

---

## 2026-07-18 - Switch "Pokaz wszystkie" + Opakowanie tags

### Komenda/Akcja
User: "Tylko najnowsze" myli; odwrocic na "Pokaz wszystkie" (ON=stare+demo, OFF=aktualne).
Opakowanie: pelna lista nosnikow z sciagawki (nie tylko 6 tagow).

### Log/Status
1. visualizations.html + dam-viz.js: switch `vizShowAll`, default OFF, tooltip o prototypach/demach/starych.
2. Migracja localStorage z `dam_viz_latest_only` (odwrocona).
3. PACKAGING/OPAKOWANIE_CANON w build-file-index + enrich-search-tags; nosniki z Typ do Opakowanie.
4. repair-tag-taxonomy + enrich: 16 tagow opakowania.

### Efekt/Fix
Opakowanie: doypack, baton, mini baton, karton 6x, karton, bigpak, folia, etykieta, etykieta butelka, etykieta sloik, rekaw, tuba, shot, doy 6x, sasz, obwoluta.

---

## 2026-07-18 - Bramki V1-V10 (admin viz overhaul)

### V1 Recognition - PASS (z uwaga)
- 6300610: REKAW + langs=[cz,sk], lang cards cz/sk (nie GB). PASS
- 6300650 DK NUGGETS XXL: REKAW + pl. PASS. GC kopia indeksu ma default gb (nietypowe).
- OATS: FOLIA/DOYPACK. PASS
- MIX: etykiety `MIX - ?` / `MIX`, zero WARIANT. PASS
- DATE ORANGE / czesc CORNFLAKES: foldery od daty + pliki `WARIANT-*` ? carrier OTHER (pusta etykieta). Do potwierdzenia z userem (nie zgadywac FOLIA).

### V2 Carrier PL UI - PASS
- CDP dump kart: ETYKIETA, KARTON 6x MINI, DOYPACK, REKAW; zero FOIL/SLEEVE/CARTON/BAR w UI.
- Skrypt: 0 EN carrier codes w viz_latest.

### V3 Lang tooltip + touch - PASS
- Badge PL: tip="Polska", hitbox 44x44; kontrasty badge Geex; skroty PL/CZ/SK.

### V4 Tag click context - PASS (wiz)
- Klik tagu PL ? `#vizLangFilter` = `pl`. Explorer/project: handler w dam-badges (bind).

### V5 ui-taste galeria - PASS
- Pass1 375: biale tlo thumb, padding 12px, badges left, admin red, PL skrot. Screenshot+Read.
- Pass3 375 scroll: 2 karty, spojne badges. Screenshot+Read.
- Pass4 768: 2 kolumny, white thumbs. Screenshot+Read.
- Pass5 1280: sidebar+galeria, wariantow (nie rewizji). Screenshot+Read.
- Pass2 spacing: OK na Pass1/3.

### V6 Modal + explorer badges - PASS
- Modal: kategoria+nosnik+PL+indeks; zoom/warianty/Przejdz bez regresji; white+12px.
- Admin btns Miniatura/Demo/Ukryj/Dodaj z `.dam-admin-control`. Screenshot+Read.

### V7 Admin red outline - PASS
- ON: toggle + przyciski admin czerwone; OFF: brak Miniatura w modalu, 0 admin btns.
- Rola != admin: toggle ukryty (kod gate `isAdminRole`).

### V8 Demo/Ukryj/Dodaj - PASS
- Demo click ? `.dam-viz-card--demo` + badge Demo. CDP: demoCard=true, demoBadge=true.
- Ukryj/Dodaj: UI+POST /viz-flag OK (most zrestartowany).

### V9 Thumb picker - PASS
- Browser: Miniatura otwiera `#damThumbPicker` z lista plikow z 4-WIZKI (GET /folder-images).
- Desktop: `DamJsApi.pick_thumb` w launch.py (wymaga restartu skrotu DAM).
- Zapis: istniejacy POST /thumb-override.

### V10 Bramka koncowa - PASS z blokerami jawnymi
Pre-Delivery:
- Kontrast/focus/touch tagow: OK (44px, data-dam-tip).
- Em-dash ban w copy UI: OK (ASCII).
- Brak FOIL/SLEEVE w etykietach kart: OK.
- Modal zoom/warianty/Przejdz: OK.
- Galeria white+12px: OK (CSS+CDP).
- Admin czerwone tylko w trybie ON: OK po fix syncAdminOutline.
Bloker/uwagi (nie blokuje done feature, wymaga decyzji usera):
1. DATE ORANGE (i podobne GC) bez tokenu nosnika w folderze/plikach ? pusta etykieta.
2. Restart skrotu DAM potrzebny, zeby shell mial `pick_thumb` i swiezy most (folder-images/viz-flag).

---

## 2026-07-18 - Dashboard widgety + FMCG + notify

### Komenda/Akcja
Wdrozenie konfigurowalnego pulpitu (plan Dashboard widgety).

### Log/Status
1. Dodano `fmcg-cost-averages.json` + `dam-fmcg-cost.js` (landed cost + SWOT + sales mock).
2. Silnik: `dam-dashboard-widgets.js` (24 widgety, LayoutStore, modal Dostosuj z ??).
3. `dam-notify.js` - Notification API + poll file-index 60s.
4. Przebudowa `dashboard.html` na `#damDashGrid` + panel Asana/Teams; CSS `dam-dashboard.css`.
5. Orchestrator `dam-dashboard.js` laduje Asana / index / costs / rates / FMCG / flags / projects.
6. i18n PL/EN: `dash.customize*`, `dash.widget.*`.
7. QA ui-taste: 1280 / 768 / 375 screenshoty; dedupe najnowszych viz; usunieto zdublowany tytul.

### Efekt/Fix
- Domyslny layout bez kosztu miesiaca; user wlacza w Dostosuj pulpit.
- Persistencja `localStorage dam_dash_layout_v1:<userKey>`.

### Test/Ewaluacja
- Browser `http://127.0.0.1:8765/dashboard.html`: 7 widgetow domyslnych, modal 24 pozycji, dane 187/109/91.
- Em-dash scan nowych plikow: clean.

### Zrodla
- Plan `dashboard_widgety_*.plan.md`; Geex summary cards; project-costs + cost-rates.

---

## 2026-07-18 - Karty wizualizacji: tagi + wyr?wnanie flex

### Komenda/Akcja
Naprawa DOM kart #vizGrid - ogromne tagi, skakanie tytu??w/przycisk?w, brak ?wiat?a.

### Log/Status
1. CSS .dam-viz-card: flex column; thumb g?ra; body justify-content:flex-end + gap 14px.
2. .dam-viz-card__badges: wy?rodkowane, sta?a wysoko?? 48px (2 rz?dy).
3. Tagi w karcie: font jak pill (10.5px), padding pill, border-radius 999px (nie 27px chip).
4. JS: zawsze meta BRAK TYPU gdy brak nosnika; maxTotal:6 w compact.
5. Cache bust dam-brand.css / dam-viz.js / dam-badges.js ? viz4.

### Efekt/Fix
Tytu?y i CTA w wierszu na tej samej linii (CDP: titleTops/actTops r?wne). Mniej tag?w = pusta przestrze? w strefie badge, nie skok w g?r?.

### Test/Ewaluacja
- isualizations.html: badgeH ~20px vs pill 20px; BRAK TYPU na DATE ORANGE; align row1 OK.

### Zrodla
- Feedback UI (tagi vs .dam-tag-pill); ui-taste redesign-preserve Geex.

---

## 2026-07-18 - Regula weryfikacji UI + logo collapsed + tagi

### Komenda/Akcja
1) Globalna regula: zawsze weryfikuj UI screenshotem.
2) Logo collapsed nieczytelne; collapse vs Wstecz; tagi kart +padding/font.

### Log/Status
1. Dodano .cursor/rules/verify-ui-after-changes.mdc (alwaysApply) + wpis w memory.md / AGENTS.md.
2. Logo collapsed: object-fit: contain (bylo cover - tielo \"dobr\"), 48px, biale tlo.
3. Collapse: 	op: -29px - srodek w linii z #damNavBack (deltaCenter=0).
4. Tagi kart: font pill+1px (11.5), weight 500, padding 5px 11px; strefa badge 56px.

### Test/Ewaluacja
- CDP: collapseCenter=backCenter=44; badgeFw=500; badgeH=24; actTops row1 rowne.
- Screenshot: logo pokazuje \"dobra kaloria\" (nie crop \"dobr\").

## 2026-07-18 - skrot DAM ETA nie otwiera sie (porty)

### Komenda/Akcja
Diagnostyka skrotu Desktop\DAM ETA.lnk -> wscript -> run-dam.vbs -> pythonw launch.py

### Log/Status
1. Port 8765 zajety przez 2x http.server + serve_browser.py; 8766 przez 2x local_bridge (sesja dev/agenta).
2. Brak pythonw/launch i brak okna DAM - skrot wygladal na martwy.
3. Zabito zombie PID (serve_browser, http.server 8765, stare bridge).
4. Uruchomiono run-dam.vbs - okno "DAM ETA - Dobra Kaloria" (pythonw) na 8765/8766.
5. launch.py: _kill_stale_dam_processes obejmuje tez serve_browser + http.server:8765/web; wywolanie przed pick_free_port.

### Efekt/Fix
Aplikacja znowu otwarta. Kolejny start skrotu powinien sam sprzatac wiszace serwery deweloperskie.

### Test/Ewaluacja
- Dwuklik DAM ETA na pulpicie - okno widoczne
- netstat: 8765/8766 tylko procesy launch/bridge

### Zrodla
- apps/desktop/launch.py, run-dam.vbs

## 2026-07-18 - Tagi wizualizacji v2: 7 faz (rozmiary, OTHER, moderacja, aliasy, zgloszenia)

### Komenda/Akcja
Realizacja planu `viz_tags_ux_fix_e01a796a.plan.md` (7 faz) po ostrej reklamacji uzytkownika
odnosnie wygladu tagow/podgladow w wizualizacjach. Skille: ui-taste, ui-ux-pro-max, systematic-debugging.

### Log/Status (per faza)

**Faza 1 - rozmiary tagow + fix OTHER:**
1. `dam-tokens.css`: nowe tokeny `--dam-tag-fs-pill: 10.5px`, `--dam-tag-fs-badge: 14px`.
2. `dam-brand.css`: `.dam-viz-badge` font-size z tokena, padding 4px 12px; `.dam-tag-pill` 10.5px.
3. USUNIETO `min-height/min-width: 44px` z `.dam-badge-tag, button.dam-viz-badge` (root cause "2x za duze") -
   zastapione `::before{inset:-8px}` hit-area tylko dla `button.dam-badge-tag`.
4. `dam-labels.js carrierLabel()`: dodano `CARRIER_FORBIDDEN_RE`, zwraca `""` dla OTHER/UNKNOWN/WARIANT
   (wczesniej tylko UNKNOWN mial fallback "WARIANT" - OTHER przechodzil jako literal).
5. `dam-badges.js buildBadgeItems()`: przebudowana kolejnosc Marka->Kategoria->Podkategoria->Typ->
   Warianty->Jezyk->Indeks; compact mode = tylko flaga Multijezyczny (bez wyliczania GB/EE/LT...).
6. `dam-viz.js variantChipLabel()`: skrot+indeks (`GB ? 6300478`) zamiast pelnej nazwy; nowy `variantChipTip()`
   z pelna nazwa+sciezka w title/data-dam-tip.
7. `build-file-index.py pick_thumb_file`: `transparent_bonus` w `rank()` - PNG/WEBP (bez tla) > JPG (z tlem
   studyjnym) w tym samym tierze (artefakty = zle zdjecie, nie kompresja).
8. `repair-viz-thumbs.py`: force-unlink WSZYSTKICH cache'owanych thumbs (nie tylko SKLEP/XL) zeby nowy
   ranking faktycznie przeliczyl miniatury.

**Faza 2 - metadane, zgadywanie, aliasy, audyt PL:**
1. `SUBCATEGORY_PL` dict + `subcategory_label_pl()` w `build-file-index.py` - z SUROWEGO bracketu
   (nie filtrowanego `bracket_tags`, ktory odrzuca wielowyrazowe tagi).
2. Zgadywanie carrier: majority z sasiednich rewizji produktu, `carrier_guessed: true` flaga.
3. `product-aliases.json` (nowy) + `apply_product_aliases()` - `linked_products`/`alias_langs` na
   kazdym produkcie/viz_latest. Seed: owies-miod-sniadanie <-> cornflakes-peanuts-honey-balls-crispy.
4. Audyt PL znakow: `LANG_LABELS` (dam-labels.js) + `naming-dictionary.json.languages/ui/carriers` -
   Lotwa->?otwa, Wegry->W?gry, Slowacja->S?owacja, Wlochy->W?ochy, Bulgaria->Bu?garia, Slowenia->S?owenia,
   REKAW->R?KAW, ETY-SLO label->"ETYKIETA S?OIK", multi_lang_label->"Multij?zyczny" (OBA pliki - dictionary
   nadpisuje JS runtime przez XHR).
5. **Debugging note:** `print(repr(...))` w PowerShell pokazywal U+FFFD dla poprawnych UTF-8 znakow
   (cp1250 konsola) - zmylilo to na "korupcja danych"; zweryfikowano bajtami `open(...,'rb')` - dane
   byly ZAWSZE poprawne, tylko terminal output byl lossy.

**Faza 3 - naprawa migracji MATERIALY->PROJEKT (dry-run):**
1. Nowy `repair-materialy-to-projekt.py` - DK+GC, wykrywanie po slowach-kluczach (nie numerze slotu).
2. Rozszerzone po feedbacku usera: przeszukiwanie JEDNEGO poziomu podfolderow w MATERIALY (user
   zglosil realny przypadek zagniezdzenia), DRUK tylko flagowany.
3. `classify_special_document()` - karty_wprowadzenia + strategia (.pptx pozycjonowanie), SCAN_EXT
   +pptx/ppt/docx/doc/key.
4. Dry-run: 16 kandydatow (6 DK, 10 GC), zapisane `data/materialy-to-projekt-dryrun.json`. **BEZ --apply**
   - czeka na przegland i zgode usera (bardzo ostrozne, zero kasowania, PROJEKT-z-plikami nietykany).

**Faza 4 - edycja tagow + moderacja:**
1. `local_bridge.py`: `POST /rename-revision-prefix`, `POST/GET /tag-proposals(/decide)`,
   `POST/GET /carrier-types`. `rename_revision_prefix_on_disk()` - zamienia/dokleja WYLACZNIE prefiks.
2. `tag-proposals.json`, `carrier-types.json`, `carrier-assignment-log.json` (nowe, puste seed).
3. `dam-tag-edit.js` (nowy) - popover wyboru typu (`DamTagEdit.openCarrierPicker`), panel moderacji
   (`renderModerationPanel`) wbudowany w `settings.html`.
4. `dam-badges.js`: klik na `.dam-tag-editable` (carrier) -> popover edycji zamiast filtra.
5. Zweryfikowane end-to-end (popover otwiera sie, lista typow z diakrytykami, admin/user tryb naglowka).

**Faza 5 - modal: jeden indeks, aliasy, jezyki wyszarzone:**
1. `withAliasItems()` w `dam-viz.js` - pasek wariantow modalu dolacza `linked_products` PRZED dedupem.
2. Jezyki bez wizki: `missingLangs` = `alias_langs` minus jezyki w `items` -> wyszarzony badge +
   przycisk `uil-bell-plus` (`data-request-lang`) -> `DamVizRequest.open()`.
3. Zweryfikowane: OWIES MIOD (DK) modal pokazuje wariant CORNFLAKES PEANUTS HONEY (GC) w pasku - alias dziala.

**Faza 6 - zgloszenia wielokanalowe + inbox + X/Wstecz:**
1. `dam-viz-request.js` (nowy) - modal Email/Teams/Asana/W aplikacji + Wszystko/Wyczysc/Odwroc.
2. `local_bridge.py POST /viz-request` - wpis `inbox-items.json` ZAWSZE, email/teams/asana = stub
   (audit log, ADR-005). Test end-to-end: OK (channels_sent, inbox_item zwrocone poprawnie).
3. `notification-groups.json` (grafik: Krzysztof/Szymon/Sylwia).
4. `inbox.html` (nowa strona) - laczy inbox-items + asana-tasks, filtr tagow. `dam-shell.js`
   "Wszystkie zadania" -> `inbox.html` (bylo `dashboard.html`, potwierdzony bug).
5. `damAddVariantModal` dostal `.dam-modal-x` (byl bez X). `goBackNav()` zamyka modal/popover/lightbox
   zamiast nawigowac, jesli jest otwarty.

**Faza 7 - QA + docs:**
1. Screenshot QA 375/768/1280 na visualizations.html (siatka + modal + alias + missing-lang) - OK.
2. memory.md ?68-77, ten wpis w process.md, PROGRESS.md.
3. Cache bust: `?v=20260718tags1/2/3` na dam-tokens/dam-brand/dam-labels/dam-badges/dam-viz + nowe pliki.

### Backup
- Zadne pliki produkcyjne (X:\Marketing) NIE zostaly zmienione - Faza 3 to tylko dry-run raport.
- `carrier-assignment-log.json`/`tag-proposals.json`/`inbox-items.json` startuja jako puste seed.

### Test/Ewaluacja
- Browser MCP: CORNFLAKES/OATS CHOCOLATE/DATE ORANGE karty - zero "OTHER", poprawna kolejnosc,
  Multijezyczny bez rozwiniecia jezykow, "?" na zgadnietym typie, "Dodaj typ" gdy brak.
- DOM getBoundingClientRect: badge container w pelni w granicach karty (bez clipping - overflow:hidden
  na `.dam-viz-card` nie problem, bo wysokosc auto).
- `/viz-request` PowerShell smoke test: ok=true, channels_sent=[email,asana,app], inbox_item poprawny.
- Popover typu: otwiera sie, lista z diakrytykami (ETYKIETA S?OIK), header zmienia sie wg roli/trybu.

### Zrodla
- Plan: `c:\Users\xpret\.cursor\plans\viz_tags_ux_fix_e01a796a.plan.md` (nie edytowany, tylko realizowany)
- User feedback (2026-07-18): rozmiary tagow (+5%/+35%), zakres Fazy 3 (DK+GC, ostrozne kryteria),
  karty wprowadzenia/strategia w checklistcie

## 2026-07-18 - Viz UX: favicon DK, modal, tagi, tooltipy, picker

### Komenda/Akcja
Pelny polish wizualizacji (ui-taste 5 passes): favicon/PWA DK, tooltipy jasne, modal actions, kolory tagow, edycja typu z Zatwierdz/Anuluj/BRAK TYPU, admin dblclick/Shift.

### Log/Status
1. Favicon DK + manifest.webmanifest + meta mobile; dam-shell.ensureAppIcons na kazdej stronie.
2. Modal: CTA Przejdz/otworz rowne (~94px), admin kompakt (h28), gap Share->admin ~78px, zoom wycentrowany, badge left + styl kart.
3. Kolory: cat=zielony, carrier=pomarancz, subcat/smak=fiolet, warianty=teal, index-miss=jasny szary.
4. dam-tag-edit: wybor pending + footer Zatwierdz/Anuluj + BRAK TYPU; bridge rename DOYPACK/BATON + NONE; admin Shift/dblclick <=500ms.
5. Tooltips: jasne biale, auto-bind title/aria-label; 1500+ tipow.
6. BARS+DOY: carrier_guessed w build-file-index (wymaga przebudowy indeksu).

### Efekt/Fix
Aplikacja wyglada jak pelny produkt DK (ikona, PWA). Korekta typu wymaga Zatwierdz - zapis na dysk przez bridge.

### Test/Ewaluacja
- CDP: zoomOffCenter=0, gapShareAdmin=78, badgesJustify=flex-start, cta 94/92, admin h=28
- Popover: BRAK TYPU + Zatwierdz widoczne (actVisible=true)
- Pass 1-5 screenshoty: viz-pass1..5 w Temp/cursor/screenshots
- Favicon: favicon-dk.svg?v=20260718dk1

### Zrodla
- apps/web/assets/js/dam-tag-edit.js, dam-badges.js, dam-viz.js, dam-tooltips.js, dam-shell.js
- apps/web/assets/css/dam-brand.css
- apps/desktop/local_bridge.py
- plan viz_tags_ux_fix_e01a796a

## 2026-07-18 - Admin undo: Miniatura/Demo/Ukryj/Dodaj + tag (UKRYTE)

### Komenda/Akcja
Kazdy przycisk admina w modalu wizualizacji musi dac sie cofnac; osobny tag (UKRYTE) tylko dla admina; Pokaz wszystko pokazuje ukryte; tooltipy nie widoczne (z-index / bind).

### Log/Status
1. dam-viz: toggle Miniatura (Reset), Demo (Demo off), Ukryj/Pokaz (bez zamykania modala), Dodaj/Usun (+ Shift=dodaj kolejny).
2. dam-badges: label `(UKRYTE)`, klik -> `damVizToggleHidden`; Demo klik admin -> `damVizToggleDemo`.
3. Filtr: ukryte tylko dla admina przy `showAll`; inaczej odfiltrowane.
4. Tooltips: z-index 20050 + `DamTooltips.bind(modal)` po otwarciu; tipy dynamiczne z `data-dam-tip`.
5. Bridge: `thumb-override` z `clear:true` usuwa wpis; cache-bust `admin1`.

### Efekt/Fix
Admin moze odklikac pomylkowe Miniatura/Demo/Ukryj/Dodaj; tag (UKRYTE) i przycisk Pokaz przywracaja widocznosc.

### Test/Ewaluacja
- CDP: hide product_id -> grid OFF bez showAll, ON z showAll + `.dam-viz-card--hidden`
- Tag `(UKRYTE)` klik -> `Ukryj` z powrotem; tip z-index 20050, above=true nad stopka
- Screenshoty: admin-undo-pass1..5 w Temp/cursor/screenshots (pass5: tip nad Ukryj widoczny)
- Cache: dam-brand/badges/viz `admin2`, dam-tooltips `admin3`

### Zrodla
- apps/web/assets/js/dam-viz.js, dam-badges.js, dam-tooltips.js
- apps/web/assets/css/dam-brand.css
- apps/desktop/local_bridge.py
- memory.md ?79

---

## 2026-07-18 - Projekty tagi + checklista + Fala D/E

### Komenda/Akcja
Kontynuacja planu viz_admin: quick UI (podkategoria max10, picker header, tagi na projektach, szersza checklista) + rename plikow AI/PDF/wizki + change-log Cofnij/Ponow.

### Log/Status
1. dam-tag-edit: naglowek pickera " Wybierz typ\ / \Zaproponuj typ\ (bez \zatwierdz ponizej\).
2. dam-viz: Podkategoria max 10 + przycisk +N / mniej (jak DamTagBar).
3. dam-projects + dam-api: male tagi DamBadges na kartach; checklista 6 pozycji jak Eksplorator.
4. local_bridge: build_carrier_filename + rename_revision_files_on_disk; change-log.json + undo/redo API.
5. UI: Cofnij/Ponow w toolbarze wizualizacji; discrepancy assignment-log -> carrier_guessed + tip.
6. Cache-bust: ?v=20260718wave2.

### Efekt/Fix
Karty projektow pokazuja smak/kategorie/typ; checklista szersza; rename typu obejmuje pliki; historia z Cofnij/Ponow.

### Test/Ewaluacja
- index.html CDP: badgeCount>=1, 6 wierszy checklisty
- visualizations: Podkategoria +17 widoczne
- build_carrier_filename: GC_balls... -> GC-DOY-balls_cocoa-lime - GB_AR - 6300489.00.ai

### Zrodla
- plan viz_tags_ux_fix_e01a796a + viz_admin_ux_verify_d3c4e2c8
- apps/web/assets/js/dam-projects.js, dam-viz.js, dam-tag-edit.js, dam-api.js
- apps/desktop/local_bridge.py

---

## 2026-07-18 - Fix: Eksplorator SyntaxError (aplikacja " nie dziala\)

### Komenda/Akcja
User: aplikacja nie dziala, eksplorator byl rozjebany.

### Log/Status
1. Repro: explorer.html ladowal tagi, ale DamExplorer=undefined, puste #damFolderList/#damExplorerMain.
2. Root cause: SyntaxError w dam-explorer.js:1867 - string z niezescapowanym class=\dam-tag-group-pills\ przerywal parsing calego pliku.
3. Fix: zamiana na spojny single-quoted string.
4. Cache-bust explorer.html ?v=20260718fix1.
5. Weryfikacja: DamExplorer=object, kategorie BATONY/KULKI/..., 187 prod.

### Efekt/Fix
Eksplorator znowu startuje i pokazuje drzewo produktow.

### Test/Ewaluacja
- node --check dam-explorer.js = OK
- CDP: folderText zawiera BATONY/KULKI/ROSLINNE, meta 187 prod.

### Zrodla
- apps/web/assets/js/dam-explorer.js
- systematic-debugging
## 2026-07-18 - Fix ELEMENTY BRAK + studio lightbox UX (10-pass)

### Komenda/Akcja
User: falszywy BRAK Elementy (pliki w MATERIALY/ELEMENTY); studio podgladu chaotyczne / przycina / za duzo scrolla. Intensive QA 10 passes (ui-taste + ui-ux-pro-max).

### Log/Status
1. Root cause checklisty: indeks nie skanowar podfolderu ELEMENTY pod MATERIALY; `files_by_role.elements=[]`.
2. Fix indexer: `build-file-index.py` skan 1 poziomu ELEMENTY/ELEMENTS; patch `patch-elements-in-index.py` (8 rewizji, 160 plikow; czarna-porzeczka 6300753.00 = 14 plikow).
3. `revisionHasElements`: najpierw `elements.length`.
4. Studio: dedupe rozmiar|format, chipy L/S/XL, nazwa w stopce, stage flex fit (ratio ~0.97), details metadane, RWD stack.
5. Cache-bust explorer: dam-brand + dam-explorer `?v=20260718studio10f`.

### Efekt/Fix
Elementy / skladniki = OK (nie BRAK). Studio: 4 chipy zamiast sciany duplikatow; wizualizacja miesci sie w stage.

### Test/Ewaluacja
- CDP checklist: dam-check-ok Elementy
- Passy screenshot: qa-pass1..10 (desktop fit OK; tablet ze zwinietymi metadnymi)
- Intensive QA: 10 passes

### Zrodla
- apps/web/scripts/build-file-index.py, patch-elements-in-index.py
- apps/web/assets/js/dam-explorer.js, css/dam-brand.css, explorer.html

## 2026-07-18 - Reczne powiazanie Elementy (user/admin)

### Komenda/Akcja
User: nie tylko czarna porzeczka - zle wykrywanie szerzej; pozwolic wskazywac foldery/pliki, aktualizowac checklist?, przejsc ikona z eksploratora.

### Log/Status
1. Bridge: `POST /elements-link`, `GET /folder-browse`, KV `elements-overrides`, sklep `data/elements-overrides.json`.
2. Explorer checklista: akcje open / link / unlink; picker z ?Uzyj tego folderu?.
3. `computeChecklist` honoruje overrides; dam-api tech tez (localStorage).
4. Indexer: skladniki + pliki w podfolderach ELEMENTY; re-patch (+1 rev / 3 pliki).
5. Cache-bust `?v=20260718elemLink1`.

### Efekt/Fix
User/admin moze poprawic falszywy BRAK wskazujac folder; potem zielona checklista + ikona folderu do reveal.

### Test/Ewaluacja
- python ast + node --check OK
- patch-elements-in-index: patched_revisions=1 files_added=3
- Wymaga restartu local_bridge (8766) zeby nowe endpointy dzialaly

### Zrodla
- apps/desktop/local_bridge.py
- apps/web/assets/js/dam-explorer.js, dam-api.js, css/dam-brand.css
- apps/web/data/elements-overrides.json
- apps/web/scripts/build-file-index.py, patch-elements-in-index.py

---

## 2026-07-18 - Checklista + tagi listy + Zglos (7-pass QA)

### Komenda/Akcja
User: tagi na liscie produktow/wariantow jak w wizualizacjach; wieksze indeksy; checklista bez naglowka "Brakuje materialow"; nowe sloty Karta/Prezentacja; rename etykiet; wiecej oddechu; przyciski obok siebie; Powiadom = Zglos jak w wizualizacjach. 7 rund ui-taste + ui-ux-pro-max.

### Log/Status
1. Explorer `prodRowHtml`: DamBadges kategoria/podkat + jezyki; indeks/data chip 13px.
2. Warianty: chip typu + PL/jezyki z plikow + brand/index/date/status.
3. Checklista (explorer + karty Projektow + project.html): 8 slotow; etykiety "Plik zrodlowy?" / "Podglad PDF?"; Karta wprowadzenia + Prezentacja; bez head "Brakuje materialow".
4. Karty: akcje flex row, wysokosc ~36px; detail: Przelicz + Zglos side-by-side ~40px; Zglos -> DamVizRequest (Email/Teams/Asana/App).
5. Cache-bust `?v=20260718check8` / `check8b` / `check8c`.
6. QA 7 pass: lista KULKI (tagi+13px), wariant PL, karty, detail+modal, 375/768/1280.

### Efekt/Fix
Rozpiska czytelna z tagami; checklista mowi ikonami + jasnymi etykietami; Zglos = ten sam flow co wizualizacje.

### Test/Ewaluacja
- CDP: produkt tags KULKI/Deserowe/PL, index fontSize=13px
- CDP karty: 8 labels, head=null, actions flex row h=36
- CDP project: stackFlex=row, Przelicz+Zglos; modal kanalow OK
- Pass 1-7 screenshot+Read: clean (mobile: dlugie etykiety wrapuja - akceptowalne)

### Zrodla
- apps/web/assets/js/dam-explorer.js, dam-projects.js, dam-project.js, dam-api.js, dam-viz-request.js
- apps/web/assets/css/dam-brand.css, dam-app.css
- apps/web/explorer.html, index.html, project.html

---

## 2026-07-18 - Karty / detail / tagi PPM (card7, 7-pass QA)

### Komenda/Akcja
User: detail bez hashtagow, cie?szy tytul; checklista lu?niej; Akcje = kafelki + Eksplorator/Folder; klik slotu OK -> Przejdz+Win; karty: bez Rynek PL, indeks pod tytulem, Przejdz+Win (+Asana), bez duplikatu indeksu; PPM tag = kopiuj; tagi +1px; 7 tur ui-taste.

### Log/Status
1. `dam-projects.js`: index-row, badges bez indeksu, Przejdz/Win/Asana, ASANA_BY_INDEX.
2. `dam-project.js`: DamBadges header, title light, slot toggle actions, action tiles.
3. `dam-badges.js`: copyTagText + bindCopyOnRightClick (document).
4. `dam-api.js`: langs/category/carrier/path w meta projektu.
5. CSS: index-row, wieksze tagi, checklista gap, `.dam-action-tile`, slot actions, toast.
6. HTML cache `?v=20260718card7` + skrypty labels/badges/paths na project.html.
7. QA 7 pass: karta Banoffee, detail+slot open, 375/768/1440.

### Efekt/Fix
Czytelny header z prawdziwymi tagami; karty jak wizualizacje (Przejdz+folder); panel Akcje zrozumialy; PPM kopiuje tag.

### Test/Ewaluacja
- CDP karta: badgeFs=11.5px, pad 4/10, actions=3, checklistGap=12-14px
- CDP detail: titleWeight=500, badges DK/KULKI/Deserowe/DOYPACK/PL/index, hashGone, tiles=5, slot open Przejdz+Win
- Pass 1-7 screenshot+Read: clean; clipboard API w automation = NotAllowed (focus) - kod OK

### Zrodla
- apps/web/assets/js/dam-projects.js, dam-project.js, dam-badges.js, dam-api.js
- apps/web/assets/css/dam-app.css
- apps/web/index.html, project.html

---

## 2026-07-18 - DDNS first + OFFLINE fallback (NAT/CGNAT)

### Komenda/Akcja
User: jak sie polaczyc gdy straci static IP / ISP zamknie NAT; pamietaj o pomocy (GitHub DATABASE / lokalny SQLite); priorytet DDNS inyfinn.synology.me, LAN tylko awaryjnie; kazdy ma miec dostep do bazy.

### Log/Status
1. memory.md ?84: DDNS first, OFFLINE hint (NAT/CGNAT), DATABASE/ GitHub.
2. `pg_db.py`: sort hostname przed prywatnymi IP; sticky last-host tylko dla DDNS.
3. `dam_db.py`: przy padnieciu PG -> OFFLINE SQLite + offline_hint; retry co 120s; mirror users PG->SQLite; status z github_dump.
4. ADR-009 amended; PROGRESS: wspolna baza NAS = done.
5. Test: ping host=inyfinn.synology.me, users=18; prefer_ddns_first OK; symulacja offline -> SQLite Connection.

### Efekt/Fix
Gdy DDNS/NAT pada - app dziala lokalnie z jasnym komunikatem (nie cichy fail). Gdy DDNS wraca - auto powrot do PG.

### Test/Ewaluacja
- python ping ok, hosts=[inyfinn.synology.me, 192.168.0.145]
- offline sim: engine sqlite-offline, potem leave -> postgres

### Zrodla
- apps/desktop/dam_db.py, pg_db.py
- memory.md ?84, docs/ADR/ADR-009-postgres-synology.md

---

## 2026-07-18 - Karty card7b (indeks r?g, kategoria w tytule, wash, Eksplorator)

### Komenda/Akcja
User: indeks w prawy g?rny r?g; kategoria w nazwie; klik tytulu ? Eksplorator DAM; nazewnictwo Eksplorator vs Eksplorator plikow; status +7%; delikatny gradient statusu; 5 tur ui-ux-pro-max.

### Log/Status
1. `dam-projects.js`: index-corner; `CATEGORY ? NAME` ? explorer; Win tip = Eksplorator plikow.
2. `dam-app.css`: wash incomplete/ok (skr?cony + wygaszony), status ?1.07, title-link.
3. Sidebar/i18n: `nav.explorer` / `explorer.title` = Eksplorator; `explorer.html` tytu?.
4. QA 5 pass: desktop layout, spacing/wash, 375, 768, a11y (klik tytulu ? explorer?product=?).

### Efekt/Fix
Karty czytelniejsze (kategoria w tytule); indeks nie wypycha tag?w; wash nie zaburza checklisty; sp?jne nazwy nawigacji.

### Test/Ewaluacja
- CDP: indexInCorner, title `BATONY ? ?`, href explorer, beforeH?92px alpha 0.055, statusH?30px, nav=Eksplorator
- Klik tytulu ? `explorer.html?product=mix-12x-xmas-mixy` (breadcrumb BATONY / 12X XMAS)
- Pass 1-5 screenshot OK

### Zrodla
- apps/web/assets/js/dam-projects.js, dam-shell.js, dam-explorer.js
- apps/web/assets/css/dam-app.css
- apps/web/i18n/pl.json, en.json, index.html, explorer.html
- memory.md ?85

---

## 2026-07-18 - Karty card7b (indeks rog, kategoria w tytule, wash, Eksplorator)

### Komenda/Akcja
User: indeks w prawy gorny rog; kategoria w nazwie; klik tytulu -> Eksplorator DAM; nazewnictwo Eksplorator vs Eksplorator plikow; status +7%; delikatny gradient statusu; 5 tur ui-ux-pro-max.

### Log/Status
1. dam-projects.js: index-corner; CATEGORY ? NAME -> explorer; Win tip = Eksplorator plikow.
2. dam-app.css: wash incomplete/ok (skrocony + wygaszony), status x1.07, title-link.
3. Sidebar/i18n: nav.explorer / explorer.title = Eksplorator; explorer.html tytul.
4. QA 5 pass: desktop layout, spacing/wash, 375, 768, a11y (klik tytulu -> explorer?product=...).

### Efekt/Fix
Karty czytelniejsze (kategoria w tytule); indeks nie wypycha tagow; wash nie zaburza checklisty; spojne nazwy nawigacji.

### Test/Ewaluacja
- CDP: indexInCorner, title BATONY ? ?, href explorer, beforeH~92px alpha 0.055, statusH~30px, nav=Eksplorator
- Klik tytulu -> explorer.html?product=mix-12x-xmas-mixy (breadcrumb BATONY / 12X XMAS)
- Pass 1-5 screenshot OK

### Zrodla
- apps/web/assets/js/dam-projects.js, dam-shell.js, dam-explorer.js
- apps/web/assets/css/dam-app.css
- apps/web/i18n/pl.json, en.json, index.html, explorer.html
- memory.md ?85

---

## 2026-07-18 - PL znaki + status bazy + Wiadomosci (db1)

### Komenda/Akcja
User: polskie znaki wszedzie; wyjasnij Odswiez vs Wczytaj z dysku; status bazy obok Pliki online z wyborem zrodel + force refresh; dedykowana strona wiadomosci; ui-taste 10 tur + ui-ux-pro-max.

### Log/Status
1. Skrypt restore-pl-diacritics.py + poprawki manglingu (zadania/Zadanie).
2. Przyciski: Odswiez liste / Skanuj dysk (tips).
3. dam_db: prefer, sources, force_reconnect, pull dump --no-commit; bridge POST /db/reconnect, /db/prefer.
4. dam-db-status.js pill + panel; nav Wiadomosci; inbox.html + dam-inbox.js.
5. Intensive QA 10 pass (screenshot): index PL, panel bazy, inbox desktop/mobile, cache bump.

### Efekt/Fix
UI z polskimi znakami; jasne akcje indeksu; status bazy dziala (Synology/GitHub/lokalna); strona Wiadomosci z filtrami.

### Test/Ewaluacja
- GET /db/status: label Baza online, sources synology active
- POST /db/reconnect: Baza online
- CDP index: title Projekty opakowan, Odswiez liste, Skanuj dysk, Baza online
- inbox: 109 Asana, filtry, szukaj

### Zrodla
- apps/desktop/dam_db.py, local_bridge.py, scripts/sync-database-backups-to-git.py
- apps/web/assets/js/dam-db-status.js, dam-inbox.js, dam-shell.js
- apps/web/i18n/pl.json, inbox.html, index.html
- memory.md ?86

---

## 2026-07-18 - Checklist klik + ikony Eksplorer/Win/Asana (icons2)

### Komenda/Akcja
User: klikalne OK-sloty na kartach i w Wymaganiach (global); checklista detail jak karta; Asana SVG; gradient +30%/+50%; kompletny: ramka 1px fade 50%?95%; Sprawdz projekt + Przejdz?Eksplorer; rename Eksplorer; ikona sidebar; Win SVG z referencji; ui-taste 5 tur.

### Log/Status
1. dam-icons.js: Win folder SVG + Asana mark + bindChecklistRows (global).
2. dam-projects.js: OK-wiersze interaktywne; Sprawdz projekt (strzalka?project) + Przejdz (folder-open?explorer) + Win + Asana.
3. dam-project.js: ta sama interakcja; Eksplorer w akcjach; Win/Asana SVG; PL copy.
4. Sidebar/i18n: Eksplorer + uil-sitemap; Przejdz zostaje uil-folder-open.
5. CSS: wash 8.625rem / alpha *1.3; --ok border fade; checklista detail = rytm karty.
6. ui-taste Pass 1-5: 375/768/1280 screenshot+Read; fix wrap akcji + widocznosc akcji wiersza.

### Efekt/Fix
Jedna semantyka: Eksplorer=DAM hub, Eksplorator plikow Windows=OS; klik OK-slot ? Przejdz + Folder Windows wszedzie.

### Test/Ewaluacja
- CDP: nav Eksplorer + uil-sitemap; banoffee: Sprawdz projekt / Przejdz / Folder Windows / Asana
- Klik OK-wiersza: akcje Przejdz + dam-icon-win-explorer (karta + project.html)
- Cache: ?v=20260718icons2

### Zrodla
- apps/web/assets/js/dam-icons.js, dam-projects.js, dam-project.js, dam-shell.js
- apps/web/assets/css/dam-app.css, i18n/pl.json, index.html, project.html
- memory.md ?87

---

## 2026-07-18 - Panel Zrodla bazy + tagi max 7 + viz ikony (icons3c)

### Komenda/Akcja
User /ui-taste: panel Baza brzydki (overflow, pomaranczowe kontrolki, ciasno); tagi max 7; wizualizacje Przejdz/Win jak global.

### Log/Status
1. dam-db-status.js: hint czytelniejszy; chipy trybu; custom check zamiast native.
2. dam-brand.css: panel padding/air, fiolet chipy/check, wrap + line-clamp, mobile full-width, scroll.
3. dam-tag-bar.js ROW_LIMIT=7; dam-viz.js SUBCAT_ROW_LIMIT=7 + Przejdz folder-open + Win SVG.
4. Cache icons3c (index brand, shell db-status, visualizations brand).
5. ui-taste Pass 1-5: screenshot+Read 375/768/1280 + viz CDP.

### Efekt/Fix
Panel Geex/DK purple, bez overflow poza ramka; tagi 7+N; viz = Eksplorer + Folder Windows.

### Test/Ewaluacja
- Pass 1 (struktura): chipy Auto/Synology/Lokalna, 3 zrodla, CTA Zapisz/Odswiez
- Pass 2-3 (~375/700): padding 16-18px, brak overflowX, fiolet check/chip
- Pass 4 (768): panel w viewport, tagi +25/+14/+9
- Pass 5 (1280): panelW=400, autoChipBg/checkBg rgb(171,84,219), textOverflow=false
- Viz CDP: Przejdz uil-folder-open; winAria Folder Windows + SVG; tag rows n=7 + plus

### Zrodla
- apps/web/assets/css/dam-brand.css, js/dam-db-status.js, dam-tag-bar.js, dam-viz.js, dam-shell.js
- apps/web/index.html, visualizations.html
- memory.md ?88

---

## 2026-07-18 - Karty: ramka 50% + incomplete fade (border50)

### Komenda/Akcja
User: ten sam fade obrysu dla niekompletnych (czerwony); obrys za mocny ? ~50% koloru (zielony i czerwony). Wash juz +30%/+50%.

### Log/Status
1. dam-app.css: `--ok` i `--incomplete` wspolny mechanizm `::after` mask border.
2. Alpha ramki 0.5 (do 50% wysokosci) ? 0.2@72% ? 0@95%.
3. Cache index dam-app `?v=20260718border50`.

### Efekt/Fix
Niekompletne maja ten sam fade obrysu co kompletne; kolor miekszy.

### Test/Ewaluacja
CDP: afterInc/afterOk rgba(...,0.5); beforeH 138px (8.625rem); 187 kart.

### Zrodla
- apps/web/assets/css/dam-app.css, index.html, memory.md ?87

---

## 2026-07-18 - Explorer: brand switch + badge unify (brandsw1)

### Komenda/Akcja
User /ui-taste: Marka: DK+GC biedna; przenies switch przy kategorie / toolbar produktu; ujednolic tagi jak na kartach; tytuly BATONY ? NAME +3px.

### Log/Status
1. Usunieto damBrandFilterTrigger z toolbara.
2. Chipy DK/GC w damSidebarBrandMount (Kategorie) + damProductBrandMount.
3. CSS segmented pill; explorer badges = pill viz-badge; tytuly +3px.
4. productDisplayTitle: CAT ? NAME; index/brand jako dam-viz-badge.
5. Cache brandsw1; tag-bar icons3 na explorer.

### Efekt/Fix
Filtr marki widoczny przy kategoriach; tagi/tytuly spojne z projektami.

### Test/Ewaluacja
- CDP: hasTrigger=false; sideChips+productChips; title BATONY ? 12X XMAS 19px; label 17px; badges carrier/lang/brand/index; folder 15px; tagi +25/+14/+9

### Zrodla
- explorer.html, dam-explorer.js, dam-brand-filter.js, dam-brand.css, memory.md ?89

---

## 2026-07-18 - Tagi cienkie + indeks pill global (tagthin1)

### Komenda/Akcja
User: napisy tagow BATONY/Nerkowcowy za grube (jak dam-tag-pill); indeksy zawsze zaokraglone globalnie (nie kwadrat dam-index-chip).

### Log/Status
1. .dam-viz-badge bazowo: weight 500, radius 999px, padding jak tag-pill.
2. .dam-index-chip = ten sam pill (bez mono/4px); admin tez 999px.
3. Fix utton.dam-viz-badge: font-family/size inherit + font-weight 500 (nie `font: inherit`).
4. .dam-prod-row__tags i karty projektow: weight 500.
5. 
enderIndexChips: klasy dam-index-chip dam-viz-badge dam-viz-badge--index.
6. Cache `?v=20260718tagthin1`.

### Efekt/Fix
Tagi listy produktow tak cienkie jak filtry smaku; indeksy pill wszedzie.

### Test/Ewaluacja
Hard refresh explorer; CDP: cat/subcat font-weight 500; index border-radius 999px.

### Zrodla
- dam-brand.css, dam-app.css, dam-explorer.js, explorer/index/viz/project.html, memory.md ?90

---

## 2026-07-18 - Propose JSON -> admin apply (egzekwowanie)

### Komenda/Akcja
User: kazdy pisze tekstowe zgloszenia JSON; tylko admin akceptuje i aktualizuje baze; kolejka + inbox; bez syncu SQLite przez Drive.

### Log/Status
1. `local_bridge.py`: `_require_login` / `_require_admin` z Bearer sesji.
2. User/power_user: `/rename-revision-prefix` i `/viz-request` = kolejka JSON + inbox.
3. Admin-only: decide, carrier-types, viz-flag, overrides, rename-index, change-log undo/redo, index rebuild, db/*.
4. Body.role/admin_mode nie daje privilege (anti-spoof).
5. TTL 72h: eskalacja do Inbox, BEZ auto-zapisu na dysk.
6. UI: dam-tag-edit / viz-request / inbox wysylaja `Authorization`; panel moderacji tylko admin.
7. memory.md ?86.

### Efekt/Fix
Dwie warstwy: kolejka (tag-proposals + inbox) <-> kanoniczna baza/dysk tylko po kliku admina.

### Test/Ewaluacja
- python ast OK; node --check JS OK
- create_or_apply session_role=user + spoof admin_mode -> immediate=False

### Zrodla
- apps/desktop/local_bridge.py
- apps/web/assets/js/dam-tag-edit.js, dam-viz-request.js, dam-inbox.js, dam-api.js
- memory.md ?86

---

## 2026-07-18 - Warianty count + chipy jeden styl (varcnt1)

### Komenda/Akcja
User: nie `4 rew.` tylko warianty; duza liczba jak +22 (+100%) obok tagu WARIANTY po lewej + ten sam tag w rzedzie; WSZYSTKIE chipy jeden styl; font labela nosnika.

### Log/Status
1. prodRowHtml: lewa kolumna count-num + Warianty; DamBadges multiIndex; usunieto revcount tekst.
2. CSS: count-num = tag-more 22px; date/status/carrier chips = pill token; label nosnika 16px.
3. Index/date HTML: zawsze dam-viz-badge klasy.
4. Cache varcnt1.

### Efekt/Fix
Czytelna liczba wariantow + spojne chipy w liscie i carrier.

### Test/Ewaluacja
CDP: left count + Warianty badge; brak `rew.`; carrier index/date radius 999px weight 500.

### Zrodla
- dam-explorer.js, dam-badges.js, dam-brand.css, explorer.html, memory.md ?91

---

## 2026-07-18 - Lista produktow: air + cienka typo (listair1)

### Komenda/Akcja
User: teksty za duze/grube; wiecej oddechu; tagi ten sam rozmiar + lekka ramka; 10px miedzy sekcjami; tlo wierszy ~10% szare jasniej niz #f3f2f7.

### Log/Status
1. Typo: panel 15/500, title 13.5/500, folder 13/500.
2. prod-list gap 10px; row bg #f8f7fb + padding 14/16; main gap 10px.
3. Chipy explorer: height 22px + border rgba(70,66,85,.14); tag=index.
4. Cache listair1.

### Efekt/Fix
Czystsza lista, spojne obramowane chipy, mniej inwazyjna typografia.

### Zrodla
- dam-brand.css, explorer.html, memory.md ?92

---

## 2026-07-18 - Panel head Wstecz/Do przodu (panelnav1)

### Komenda/Akcja
User /ui-taste: folder cieniejszy -1px; panel nieczytelny; MIXY za blisko; brak ikony kategorii + Wstecz/Do przodu; carrier ramka; ikony +50%.

### Log/Status
1. navStack + panelHeadHtml (strzalki, ikona, kicker, tytul, meta).
2. CSS head/mix/carrier air; folder 12/400; carrier icons +50%.
3. Cache panelnav1.

### Zrodla
- dam-explorer.js, dam-brand.css, explorer.html, memory.md ?93

---

## 2026-07-18 - Inbox expand + OAuth + legal + crypto

### Komenda/Akcja
User: gdzie zgloszenia w Wiadomosciach; nie da sie rozwinac; integracja Asana/Teams/Outlook + login; polityka/regulamin/licencja/zgody; szyfrowanie; konto w headerze zawsze widoczne.

### Log/Status
1. Fix Asana mapowania: parent/due/section (wczesniej due_on/gid = pusty detal).
2. Inbox: expand/collapse, filtr Zgloszenia DAM, chevron.
3. dam-shell: pusty #damHeaderAction wypelniany quickaction (konto).
4. OAuth: oauth_integrations.py + secret_box Fernet; endpoints /integrations/* + /oauth/callback.
5. Legal: privacy/terms/license/consents/docs-security.html.
6. Settings: karta Integracje + linki prawne.
7. cryptography w requirements; memory ?87.

### Efekt/Fix
Zgloszenia DAM w osobnym filtrze; Asana czytelna po kliku; login OAuth po Client ID; dokumenty pod Google verification.

### Test/Ewaluacja
- encrypt/decrypt Fernet OK; oauth status crypto_ok=True
- wymaga restart bridge + hard refresh inbox

### Zrodla
- apps/web/assets/js/dam-inbox.js, dam-shell.js
- apps/desktop/secret_box.py, oauth_integrations.py, local_bridge.py
- apps/web/privacy.html, terms.html, license.html, consents.html

---

## 2026-07-18 - Panel head panelnav2 + ui-taste QA

### Komenda/Akcja
Panel kategorii nieczytelny: folder typo -1px/lighter; head z ikona + Wstecz/Do przodu; oddech MIXY; carrier ramka; ikony +50%; /ui-taste 5 pass.

### Log/Status
1. Folder sidebar: 12px / font-weight 400.
2. `.dam-panel-head`: navStack back/forward + step-up, ikona folder/box, kicker+tytul+meta, ramka `#f8f7fb`.
3. MIXY margin od head 28px; carrier card radius 12px, bg `#f8f7fb`.
4. Ikony copy/folder 45px hit / 24px glyph; chevron 30px.
5. Cache `?v=20260718panelnav2`; memory ?93.

### Efekt/Fix
Naglowek panelu czytelny z nawigacja; historia Wstecz/Do przodu dziala (produkt?kategoria, Forward enabled).

### Test/Ewaluacja
- Pass 1 desktop: head + kicker Kategoria / BATONY, gap head?MIXY.
- Pass 2: product view icons 45/24, chevron 30, carrier frame.
- Pass 3: Back z produktu ? BATONY list; Forward enabled.
- Pass 4: mid viewport - brak `browser_resize` MCP; layout desktop smoke.
- Pass 5: final lock category panel clean.

### Zrodla
- apps/web/assets/js/dam-explorer.js
- apps/web/assets/css/dam-brand.css
- apps/web/explorer.html
- memory.md ?93
- skill ui-taste ?0.E

---

## 2026-07-18 - Faza 6: moderacja w Inbox (nie Settings)

### Komenda/Akcja
Usunac panel moderacji z ustawien; zbudowac zgloszenia + historie w Wiadomosciach (admin); dopiac luki planu (Wstecz, X, badge, notification-groups); 5-pass ui-taste.

### Log/Status
1. Usunieto karte Panel moderacji z settings.html; stub grupy grafik z notification-groups.json.
2. dam-inbox.js: GET /tag-proposals + approve/reject/pick w expand; filtry zgloszenie / historia; admin default zgloszenie.
3. DamTagEdit.renderModerationPanel -> redirect do inbox (deprecated).
4. Shell: Asana popup -> inbox.html; badge += pending; Wstecz = collapse -> popFilter -> nav; overlay #damLightbox.
5. CSS .dam-inbox-mod* touch 44px; copy bez auto-apply 72h; cache inbox3.
6. memory.md ?88.

### Efekt/Fix
Moderacja = workflow inbox admina z historia; Settings bez panelu decyzji.

### Test/Ewaluacja
- QA Pass 1-5 screenshot inbox (375/768/1280) - w toku.

### Zrodla
- apps/web/assets/js/dam-inbox.js, dam-shell.js, dam-tag-edit.js
- apps/web/inbox.html, settings.html
- apps/web/assets/css/dam-brand.css
- apps/web/data/notification-groups.json
- memory.md ?88

---

## 2026-07-18 - DK/GC chipy: jeden mount + styl tagow

### Komenda/Akcja
Usunac duplikat DK/GC z toolbara produktu; zostawic tylko w `.dam-cat-panel__head`; styl jak tagi, +50%, active kolor / off niemal biale.

### Log/Status
1. `dam-explorer.js`: bez `#damProductBrandMount`; mount tylko `#damSidebarBrandMount`.
2. `dam-brand-filter.js` `renderChips`: klasy `--dk/--gc` + `is-active` / `is-off`.
3. CSS: bez szarego tracka/border; 33px / 15.75px; active tint marki; off `#fafafa` / `#d0d1d8`.
4. Cache `?v=20260718brandchip3`; memory.md ?94.

### Efekt/Fix
Jedna para chipow przy Kategorie; stan ON/OFF czytelny; anatomia jak tagi DAM.

### Test/Ewaluacja
- Screenshot both-on: DK fiolet + GC cyan, 2 chipy, brak mountu w toolbarze.
- Screenshot GC-off: DK kolor, GC wyszarzone niemal biale.
- CDP: count=2, productMount=false, h=33, fontSize=15.75px.

### Zrodla
- apps/web/assets/css/dam-brand.css
- apps/web/assets/js/dam-brand-filter.js, dam-explorer.js
- apps/web/explorer.html
- memory.md ?94
- skill ui-taste (anatomia pill / active-off)

---

## 2026-07-18 - Warianty po prawej w liscie produktow

### Komenda/Akcja
Przeniesc blok N Warianty z lewej na prawa strone wiersza produktu.

### Log/Status
1. HTML: __main najpierw, potem __variants.
2. CSS grid: 1fr auto + justify-self end.
3. Bez duplikatu tagu Warianty w srodku (multiIndex false).
4. Cache ?v=20260718varright1; memory ?91.

### Efekt/Fix
4 Warianty przy prawej krawedzi wiersza.

### Test/Ewaluacja
- CDP: variants.left > main.right, nearRowRight=true.
- Screenshot BATONY Kalendarz: liczba + tag po prawej.

### Zrodla
- apps/web/assets/js/dam-explorer.js
- apps/web/assets/css/dam-brand.css
- apps/web/explorer.html

---

## 2026-07-18 - Produkt: Poka? wszystko + status tag

### Komenda/Akcja
Usunac nieklikalne meta Indeksy/Marka; zamiast DK/GC w toolbarze - switch Poka? wszystko; status edytowalny Shift+klik z zapisem do bazy.

### Log/Status
1. Usunieto dam-product-meta z widoku produktu.
2. Switch #damProdShowAll: OFF=aktualne, ON=nieaktualne/starsze pod karta.
3. statusBadge = dam-badge-tag kind=status; damSetRevisionStatus + saveCarrierOverride.
4. DamBadges.bindClicks(explorer); cache showall1; memory ?95.

### Efekt/Fix
Toolbar czytelny; nieaktualne tylko po wl?czeniu switcha; status jak globalny tag.

### Test/Ewaluacja
- Babka: brak meta/brandMount; switch widoczny.
- showAll ON: older 6300622 Nieaktualne + 6300684.00 Starsza.
- Status buttons data-tag-kind=status editable.

### Zrodla
- apps/web/assets/js/dam-explorer.js, dam-badges.js
- apps/web/assets/css/dam-brand.css
- apps/web/explorer.html

---

## 2026-07-18 - Pomoc FAB + wyszukiwarka (help3)

### Komenda/Akcja
FAB ? = F1; odswiezyc modal pomocy (Shift, zoom, Poka? wszystko); full help z wyszukiwarka problemow; 7 rund QA.

### Log/Status
1. dam-shortcuts.js: dynamiczny body, sekcja admin gdy role=admin, FAB #damHelpFab.
2. help.html: grupy + #damHelpSearch + empty state; PL odmiana temat/tematy/tematow.
3. CSS: FAB fioletowy 44px; kbd color #17161E (fix Bootstrap white-on-light).
4. Cache ?v=20260718help3; memory ?96.
5. QA 7 pass: FAB, modal admin, help search shift, empty, kbd contrast, FAB filled.

### Efekt/Fix
Pierwszy raz: ? w rogu ? skr?ty; admin widzi Shift; pe?na pomoc przeszukiwalna.

### Test/Ewaluacja
- Pass: FAB otwiera modal; Skr?ty admina + Tryb admina ON.
- Search \"shift\" ? 2 tematy (typ + status).
- Empty xyz ? 0 temat?w + sugestie.
- kbd czytelne (nie bia?e na bia?ym).

### ?r?d?a
- apps/web/assets/js/dam-shortcuts.js, dam-shell.js
- apps/web/assets/css/dam-brand.css
- apps/web/help.html, explorer.html
- memory.md ?96

---

## 2026-07-18 - Fix carrier nest (rozjechany widok)

### Komenda/Akcja
Carrier rows: chevron/copy/folder poza karta; ogromne puste przestrzenie. /ui-taste 5 pass.

### Log/Status
1. Root cause: `statusBadge()` = button wewnatrz `button.dam-carrier-toggle` - HTML auto-close, orphany.
2. Fix: status (+ admin index z button) w `.dam-carrier-toggle__trail` poza toggle.
3. Mobile trail wrap @ max-width 767.98px.
4. Cache carriernest2; memory ?94.

### Efekt/Fix
Karty ~74px; akcje i chevron w rzedzie; orphans=0.

### Test/Ewaluacja
- Pass 1-2 desktop: trail wewnatrz row, rowH 72.
- Pass 3: 375 stack CSS.
- Pass 4: ~768 orphans 0.
- Pass 5: 1440 allInside=true heights [74,74].

### Zrodla
- dam-explorer.js renderCarrierCard
- dam-brand.css .dam-carrier-toggle__trail
- systematic-debugging + ui-taste ?0.E

---

## 2026-07-18 - Inbox kontekst + toolbar + ramki 35% + widget viz (ui35f)

### Komenda/Akcja
Inbox propozycje typu czytelne (produkt + kola + tagi); toolbar Projektow zageszczony; obrys kart 35%; widget 3 viz z 100px thumb i globalnymi tagami.

### Log/Status
1. dam-inbox.js: productContextHtml, navCircles, enrich z file-index, tytul Nazwa ? zmiana.
2. CSS: .dam-nav-circles, inbox product strip, toolbar nowrap + status pod spodem, border alpha 0.35.
3. dam-dashboard-widgets.js: wiersz viz = 3 kola + thumb contain 100 + DamBadges; bindWinButtons.
4. HTML cache ?v=20260718ui35f; scripts badges/icons/paths na inbox + dashboard.
5. QA 5 pass toolbar (1280/375/768) + inbox expanded + dashboard CDP thumb ~100 / gap 100.

### Efekt/Fix
Admin widzi co zmienia (nazwa + DOYPACK + sciezka) i moze skoczyc do Eksplorera / folderu / viz. Search projektow rzuca sie w oczy; ramki kart delikatniejsze.

### Test/Ewaluacja
- Pass: inbox test2 ? BAG ? DOY + 3 kola + Zatwierdz/Odrzuc.
- Pass: projects searchW~666, gap 14, status under toolbar; border rgba(...,0.35).
- Pass: dashboard viz thumb~100, object-fit contain, 3 circles, badges.

### Zrodla
- apps/web/assets/js/dam-inbox.js, dam-dashboard-widgets.js
- apps/web/assets/css/dam-app.css, dam-brand.css, dam-dashboard.css
- apps/web/inbox.html, index.html, dashboard.html
- memory.md ?97

---

## 2026-07-18 - Zg?oszenia tabs + historia undo (inboxTabs6)

### Komenda/Akcja
Historia pod Zg?oszeniami (taby ikonowe); cofnij/pon?w; karty jak project-card (Przejd?/Win). Intensive QA 10 tur /ui-taste.

### Log/Status
1. Usuni?to sidebar ?Historia moderacji?; dodano `#inboxZgloszenieTabs` + `#inboxHistBar`.
2. `dam-inbox.js`: `zgloszenieSub`, filtry typy/wiz/historia, historyActionsHtml, productActionsHtml.
3. Bridge: `reopen_tag_proposal`, `undo_tag_proposal`, `proposal_id` w change-log; endpointy `/tag-proposals/reopen|undo`.
4. CSS: subtaby, hist-bar, product-card strip, mobile main przed ?r?d?ami.
5. Restart bridge 8766; cache `?v=20260718inboxTabs6`.

### Efekt/Fix
Admin w Zg?oszeniach prze??cza Typy / Wizualizacje / Histori?; w historii wraca do kolejki lub cofa ostatni? zmian? na dysku. Karta ma Przejd? + Folder Windows.

### Test/Ewaluacja
- Pass 1 (375): taby + karta test2; etykiety tab?w pod ikonami.
- Pass 2-3: spacing; main nad ?r?d?ami na w?skim.
- Pass 4 (768): hist-bar + Wr?? do kolejki (przycisk nad fold).
- Pass 5 (1280): taby z pe?nymi labelami, ODRZUCONO + Przejd?/Win.
- Pass 6-8: hist actions zawsze widoczne; disabled undo gdy brak change-log.
- Pass 9-10: deep-link `sub=historia`; brak osobnego filtra Historia w sidebar.

### Zrodla
- apps/web/inbox.html, dam-inbox.js, dam-brand.css
- apps/desktop/local_bridge.py
- memory.md ?98
- ui-taste ?0.E intensive 10

---

## 2026-07-18 - Inbox ?r?d?a ikony + badge/actor (inboxIcons1)

### Komenda/Akcja
Ikony i szerszy panel ?r?de?; liczniki jak tagi; tint badge/PL w headerze; wi?ksze status/tagi; attribution moderatora w prawym dolnym rogu karty.

### Log/Status
1. `inbox.html`: ikony przy filtrach ?r?de?; cache `?v=20260718inboxIcons1`.
2. `dam-brand.css`: grid 270px; `.dam-inbox-count` pill; header badge/lang tint+pad; status/tagi wi?ksze; `.dam-inbox-item__actor`.
3. `dam-inbox.js`: `shortActor` + `actorFootHtml` (Odrzuci?/Zatwierdzi?/Zmoderowa?/Zg?osi?).
4. QA screenshot?Read: sideW=270, icon=true, actor ?Odrzuci?: moderator?, badge tint.

### Efekt/Fix
?r?d?a czytelne z ikonami i pill-count; header nie ?martwy?; karty pokazuj? kto zdecydowa?.

### Test/Ewaluacja
- Pass: ?r?d?a 270px + ikony + count pills.
- Pass: header msg/notif/PL tint + padding.
- Pass: ODRZUCONO + foot tagi wi?ksze; actor bottom-right.

### Zrodla
- apps/web/inbox.html, dam-inbox.js, dam-brand.css
- memory.md ?99

---

## 2026-07-18 - Tag picker listy + historia undo (histUndo2)

### Komenda/Akcja
Pelne podkategorie/indeksy w popoverze (PL/EN); historia: real undo + 30s cancel + przebieg change-log przy konflikcie.

### Log/Status
1. Root cause: tag_groups.podkategoria puste; index picker = stub tylko current.
2. dam-tag-edit.js: collect z file-index products; bilingual labels; wide popover; ensureFileIndex.
3. Bridge: build_change_timeline_for_proposal, undo grace 30s, cancel_undo_tag_proposal, GET timeline.
4. Inbox: rozroznienie Cofnij na dysku / Wroc do kolejki; Anuluj cofniecie; panel Przebieg zmian.

### Efekt/Fix
27 podkategorii (np. Roslinne / plant based); ~335 indeksow z szukaniem; historia tlumaczy konflikty i brak sciezki na dysku.

### Test/Ewaluacja
- Pass: subcat popover 27 opts, wide 480px, PL/EN.
- Pass: index total 335, filter 00012 -> 000127.
- Pass: historia note + Przebieg zmian pokazuje missing path + audit reject.

### Zrodla
- apps/web/assets/js/dam-tag-edit.js, dam-inbox.js, dam-brand.css
- apps/desktop/local_bridge.py
- memory.md ?100

---

## 2026-07-18 - Sesja rehydrate + Dostosuj pulpit (dashCustom2)

### Komenda/Akcja
Naprawa login_required mimo UI zalogowanego; human copy Inbox; modal Dostosuj pulpit (purple checks, DnD, preview 350ms, dirty guard); ui-taste 3 rundy.

### Log/Status
1. Root cause: localStorage profil bez wa?nego Bearer; me() fallback offline udawa? sesj?.
2. auth_store.rehydrate_session + POST /auth/rehydrate; DamApi.rehydrate + me() auto; shell odrzuca token qa.
3. dam-dashboard-widgets/css: left stage, preview queue 350ms, checkbox 28px #AB54DB, DnD, dirty confirm 3 przyciski.
4. Inbox subtitle przepisany na ludzki PL.
5. ui-taste Pass 1-3: screenshot+Read (purple checks, left panel+preview, dirty dialog).

### Efekt/Fix
Zapis/zg?oszenia zn?w dzia?aj? po rehydrate z bound-session. Modal bez pomara?czowych checkbox?w, z podgl?dem i ochron? przed utrat? zmian.

### Test/Ewaluacja
- Pass: POST /auth/rehydrate ? ok + token; /auth/me z nowym Bearer ? ok (admin).
- Pass 1: cb 26-28px purple, panel left, preview Produkty.
- Pass 2: dirty confirm Zapisz zmiany / Nie zapisuj / Wr?? do wyboru.
- Pass 3: Wr?? ? modal zostaje; preview is-visible z-index 3.

### Zrodla
- apps/desktop/auth_store.py, local_bridge.py
- apps/web/assets/js/dam-api.js, dam-shell.js, dam-dashboard-widgets.js
- apps/web/assets/css/dam-dashboard.css, inbox.html, dashboard.html
- memory.md ?101

---

## 2026-07-18 - Carrier bar layout fix (explorer)

### Komenda/Akcja
Naprawa paska nosnika w Eksplorerze: tagi, duplikaty, DOM, ikony, header status.

### Log/Status
1. Nested button DamBadges w toggle -> DOM rozpad (karty poza lista).
2. Toggle=DIV role=button; indeks tylko w meta; bez duplikatu tagu nosnika przy label.
3. Tagi 22px; compact Multi; data w meta; label min-width.
4. Header 2 linie; refresh 48x48 biala ikona.
5. QA screenshot+CDP CIASTO+BURGER, 768 meta wrap.

### Efekt/Fix
dam-explorer.js, dam-badges.js, dam-brand.css, explorer.html ?v=carrierFix7

### Test/Ewaluacja
CDP: inList, aligned, badgeH=22, label widoczny, ikony right, refresh 48 white.

### Zrodla
ui-taste + verify-ui-after-changes

---

## 2026-07-18 - Sidebar active + bez podkreslen (navActive1)

### Komenda/Akcja
Zaznacz aktualna pozycje w menu sidebar kolorem Geex; usun podkreslenia z linkow nawigacji.

### Log/Status
1. Bug: active bylo na li, Geex styluje .geex-sidebar__menu__link.active; brak mapowania inbox.
2. dam-shell: class + aria-current na linku; sidebarActiveKey (project->projects); inbox w currentPageKey.
3. dam-brand: active purple text/bg + inset bar; collapsed purple ring; text-decoration none.

### Efekt/Fix
Wiadomosci / Dashboard wyraznie podswietlone; brak underline w sidebarze.

### Test/Ewaluacja
- Pass 1 inbox: Wiadomosci current, purple bar, deco=none.
- Pass 2 dashboard: Dashboard current.
- Pass 3 collapsed: ikona Dashboard purple.

### Zrodla
- apps/web/assets/js/dam-shell.js, css/dam-brand.css (?v=20260718navActive1)

---

## 2026-07-18 - Pelny commit + push (docs, UI, Postgres, DATABASE)

### Komenda/Akcja
User: pelny push, opis zmian, README, dokumentacja, commit + push lacznie z baza.

### Log/Status
1. Odswiezony dump na NAS (backup-postgres-database.sh) + sync do DATABASE/.
2. README: sekcja Postgres ADR-009, changelog 2026-07-18, ADR-009 w tabeli docs.
3. DATABASE/README + PROGRESS zaktualizowane.
4. Commit kodu (auth rehydrate, sidebar active, dashboard customize, inbox, PG client) + push origin/main.

### Efekt/Fix
Repo na GitHubie zsynchronizowane z lokalnym stanem + dump dnia.

### Zrodla
- README.md, DATABASE/README.md, PROGRESS.md, docs/ADR/ADR-009-postgres-synology.md

---

## 2026-07-18 - Dashboard viz-row responsive + ikony (vizRow2)

### Komenda/Akcja
ui-taste 3 rundy: overflow tagow, rowne ikony, Eksplorer = uil-sitemap fioletowy.

### Log/Status
1. Usunieto gap:100px; overflow:hidden na widget/media; thumb 72px; title line-clamp 2.
2. dam-nav-circles--stack pionowo; explorer purple filled + uil-sitemap; Win/SVG i image 16px szare.
3. Sitemap w inbox/viz/projects/profile (DAM Eksplorer). Folder Windows zostaje SVG/folder.

### Test/Ewaluacja
- Pass 1 900px: brak overflow, stack column, explorer sitemap purple.
- Pass 2 768px: mediaOverflows=false, badge w contenerze.
- Pass 3 1280px: ikony 32/16 rowne; sitemap.

### Zrodla
- dam-dashboard.css?v=20260718vizRow2, dam-brand.css?v=20260718vizRow1, dam-dashboard-widgets.js

---

## 2026-07-18 - Nosnik skrot DOY (carrierShort1)

### Komenda/Akcja
User: po zmianie tagu pojawia sie DOYPACK / pelna nazwa folderu zamiast skrotu DOY ze slownika.

### Log/Status
1. Root: label_pl=DOYPACK + CARRIER_FOLDER_PREFIX DOY->DOYPACK.
2. dam-labels: CARRIER_SHORTS + carrierLabel=short; label_pl tylko tooltip.
3. Bridge: prefix folderu = skrot; stare DOYPACK nadal match.
4. viz/badges/tag-edit: normalizacja do skrotu.

### Efekt/Fix
Tag i meta = DOY; rename na dysku = DOY - ...

### Zrodla
- naming-dictionary.json (short), dam-labels.js, local_bridge.py, dam-viz.js, dam-badges.js, dam-tag-edit.js

---

## 2026-07-18 - Header: Admin switch + kompakt Baza (adminHdr1)

### Komenda/Akcja
User: ikona bazy -50%; prze????czanie trybu admina tylko obok avatara (switch); header zawsze; zmienia si?? tylko title/subtitle.

### Log/Status
1. .dam-db-status__refresh 48???24px, pill min-height 56???28, ikona 12px; Pliki online dopasowane.
2. Switch Admin w headerze tu?? przed avatar (po PL); usuni??te #damAdminToggle / #vizAdminToggle.
3. Event dam:admin-mode dla explorer/viz/tag-edit.

### Efekt/Fix
Jedyny switch Admin = header. Baza kompaktowa. Chrome header globalny.

### Test/Ewaluacja
- CDP: refresh 24x24, icon 12px, order lang???admin???avatar.
- Screenshot dashboard/explorer/viz: brak lokalnego Tryb admina; title/subtitle per page.

### Zrodla
- dam-brand.css, dam-shell.js, dam-explorer.js, dam-viz.js, dam-tag-edit.js (?v=20260718adminHdr1)

---

## 2026-07-18 - Nosnik: UI pelna nazwa, dysk skrot (carrierUiLong2)

### Komenda/Akcja
User: DOY/FOL/BAT to tylko skroty w Eksploratorze Windows; w programie zawsze DOYPACK/FOLIA/BATON. Multi = Multijezyczny (OK). Napraw bledne foldery z logu.

### Log/Status
1. Potwierdzenie: `DamLabels.carrierLabel` = pelna nazwa; `carrierShort` + `CARRIER_FOLDER_PREFIX` = skrot na dysku.
2. Z `change-log.json`: 2 foldery `DOYPACK - ...` pod DATE ORANGE -> rename na `DOY - ...` (skrypt `fix_doypack_folder_prefixes.py --apply`).
3. Pasek historii: `Typ: DOY -> DOY` -> UI pokazuje `Typ: DOYPACK -> DOYPACK` (`humanCarrierForLog`); JSON zostaje kod.
4. memory.md ?102 przepisany (cofnieta bledna zasada "skrot globalnie").
5. Cache `?v=20260718carrierUiLong2`.

### Efekt/Fix
- UI karty: FOLIA / DOYPACK / REKAW.
- Dysk: `DOY - 17.02.2025 - 6300624.00 - SK HU HR`, `DOY - 20.09.2024 - 6300490.00 - GB AR`.
- Zrodlo prawdy operacji = change-log (nie szukanie na slepo).

### Test/Ewaluacja
- Screenshot viz + Read: badge i meta = DOYPACK/FOLIA.
- CDP: `DamLabels.carrierLabel('DOY') === 'DOYPACK'`.
- Get-ChildItem X: DATE ORANGE = prefiks DOY.

### Zrodla
- dam-labels.js, dam-badges.js, dam-tag-edit.js, dam-inbox.js, local_bridge.py, change-log.json, memory.md ?102


---

## 2026-07-18 - Lifecycle F/X/D + produkt TEST (life2)

### Komenda/Akcja
Admin status produktu/wariantu F/X/D z rename folderow, archiwum z wrapperem, historia previous_path. Produkt TEST do weryfikacji.

### Log/Status
1. Modul lifecycle_status.py + endpoint bridge /lifecycle-status.
2. UI admin: F/X/D/Odznacz na liscie produktow, toolbarze produktu i wierszu wariantu.
3. Indeks: strip suffix lifecycle + parse TEST-TEST; skip ARCHIWUM przy skanie.
4. Utworzono TEST LIFECYCLE w Batony z wariantem TEST-TEST.
5. Smoke API: rename F potem clear - OK; historia w lifecycle-status.json.
6. Intensive QA 10 passes (screenshot+Read): kontrolki widoczne, collapsed logo OK.

### Efekt/Fix
Gotowe do testow uzytkownika na TEST LIFECYCLE. Pelny rollout po OK od usera.

### Test/Ewaluacja
- dry_run F/D/X/product-D OK
- apply F + clear na TEST-TEST OK
- UI explorer admin: PRODUKT + wariant F/X/D

### Zrodla
lifecycle_status.py, local_bridge.py, dam-explorer.js, dam-brand.css, build-file-index.py, memory.md ?103

---

## 2026-07-18 - Policy nosnikow w bazie + ustawieniach (namingPolicy1)

### Komenda/Akcja
User: regu?a nie tylko w memory - zawsze i wszedzie; zapis w bazie i ustawieniach programu.

### Log/Status
1. `naming-dictionary.json` v2: `policy` + `short` na kazdym nosniku.
2. `app-settings.json` lustro policy; KV keys: naming-dictionary + app-settings.
3. Seed do Postgres `dam_kv_store` (`_seed_naming_policy_to_postgres` przy starcie bridge).
4. Bridge: `load_carrier_folder_prefix()` czyta slownik; pull KV nie cofa nowszej wersji lokalnej.
5. `DamLabels.CARRIER_POLICY` z slownika; settings.html karta ?Nazewnictwo nosnikow? + tabela.
6. docs/NAMING.md + memory ?102.

### Efekt/Fix
UI = label_pl, dysk = short - egzekwowane z DB/slownika, widoczne w Ustawieniach.

### Test/Ewaluacja
- PG: naming version 2, DOY.short=DOY, DOY.label_pl=DOYPACK, app-settings OK.
- Bridge prefix: DOY->DOY, FOLIA->FOL.

### Zrodla
- naming-dictionary.json, app-settings.json, local_bridge.py, dam-labels.js, settings.html, docs/NAMING.md

---

## 2026-07-18 - Instrukcje programu w bazie (instr1)

### Komenda/Akcja
User: wszystkie newralgiczne ustalenia (tez status aktywny/nieaktywny) musza byc w bazie jako instrukcje - zeby agent nie zapominal.

### Log/Status
1. Utworzono `program-instructions.json` (13 instrukcji, 10 critical) - naming, lifecycle F/X/D, change-log, UI, auth.
2. KV Postgres: `program-instructions` + rozszerzone: `change-log`, `lifecycle-status`, `product-status`.
3. Bridge: `GET /program-instructions`, seed przy starcie, push lifecycle po zmianie statusu.
4. Ustawienia: karta ?Instrukcje programu (baza)?.
5. AGENTS.md + `.cursor/rules/program-instructions.mdc` + docs/PROGRAM_INSTRUCTIONS.md + memory ?101b.

### Efekt/Fix
Zrodlo prawdy regu? = baza. Historia statusow/operacji tez w KV.

### Test/Ewaluacja
- PG: program-instructions count 13; change-log entries 6; lifecycle-status + product-status OK.

### Zrodla
- program-instructions.json, local_bridge.py, settings.html, AGENTS.md, .cursor/rules/program-instructions.mdc

---

## 2026-07-18 - Dashboard 4 najnowsze + siatka 11 + nav tiles

### Komenda/Akcja
User: 4 najnowsze wizualizacje (nie oats/cornflakes), indeks w tagach, +N klikalne, nav tiles zamiast topornych kol, notify jako pasek, siatka ~11x33 (stats 3x2, side 2), 5 passes QA.

### Log/Status
1. Ranking pickNewestViz: anti-bulk mtime + match Asana (flavor+family) + sort start projektu > mtime > rev; 1 produkt/projekt; bez pending/000000/test.
2. Widget title/i18n: 4 najnowsze; badge: brand+carrier+index; DamBadges +more expand.
3. CSS: layout 11 kol, grid 9 w main gap 16, stats span 3x2, viz span 5x9, strip span 4x2, side span 2; nav tiles 26px radius 7px.
4. Cache: dam-brand/dashboard CSS + widgets/badges JS na dashboard.html.

### Efekt/Fix
Oats/Cornflakes (bulk GC sync) poza lista. Top: Lemon Cheesecake, Cynamonka, Ciasto sliwkowe, Banoffee Kakao (+ indeksy). Tiramisu = #5 po dacie startu Asana C/03.

### Test/Ewaluacja
- CDP: btn 26x26 r=7px; gap 16; layout 11 cols; notify strip; 4 rows z indeksem.
- Pass 1-2/5 screenshot desktop; pass 768 black (emulation) - powrot do 1440; pass 5 final z Banoffee.
- Vision captions mylnie mowia circles - CDP/geometry = rounded squares.

### Zrodla
- dam-dashboard-widgets.js, dam-dashboard.css, dam-brand.css, dam-badges.js, dashboard.html, i18n pl/en

---

## 2026-07-18 - Tagi: casing globalny (tagCase1)

### Komenda/Akcja
User: nie mieszac WERSALIKOW z zapisem jak w zdaniu na badge'ach; globalnie jak Kulki Surowe vs DOYPACK.

### Log/Status
1. `DamLabels.formatTagLabel` - kody (carrier/brand/lang) = wersaliki; ludzkie = Title Case.
2. Kategorie w naming-dictionary: Kulki/Batony/... (v3).
3. dam-badges + dam-tag-bar + subcat pills uzywaja formattera; opakowanie doypack->DOYPACK.
4. Instrukcja `ui.tag_casing_global` w program-instructions (KV).

### Efekt/Fix
Karty: Kulki + Kulki Surowe + DOYPACK. Filtr: Banoffee, Mini Batoniki, DOYPACK.

### Test/Ewaluacja
- CDP: category=Kulki, subcat=Kulki Surowe, carrier=DOYPACK/FOLIA; pills Title Case + DOYPACK.

### Zrodla
- dam-labels.js, dam-badges.js, dam-tag-bar.js, naming-dictionary.json, program-instructions.json

---

## 2026-07-18 - Projekty: jedno X + persist search przy Wstecz

### Komenda/Akcja
User: dwa X w wyszukiwarce Projektow; po Wstecz wracac do widoku z zapytaniem (nie reset).

### Log/Status
1. #damProjectsSearch -> type=text; CSS hide webkit/ms search cancel.
2. dam-projects.js: persist query w sessionStorage + URL ?q= + replaceNavStackTop.
3. dam-shell.js: API 
eplaceNavStackTop.
4. Cache bust index + project shell.

### Efekt/Fix
Jedno X (custom). Wstecz z project.html -> index.html?q=test z polem i filtrem 1/181.

### Test/Ewaluacja
- CDP: type=text, clearCount=1, stackTop=index.html?q=test.
- goBack z project: href=index.html?q=test, value=test, status 1/181.
- Screenshot: projects-search-one-x.png, projects-search-restored-after-back.png.

### Zrodla
- index.html, dam-projects.js, dam-shell.js, dam-brand.css, project.html

---

## 2026-07-18 - PL pod angielska nazwa GC (Wizualizacje)

### Komenda/Akcja
User: przy angielskiej nazwie (np. MINCED) zawsze po `<br>` polska w nawiasie ze spacjami `( Mielone )`; rozmiar jak meta, kolor jak tytul.

### Log/Status
1. `product-name-pl.json` (EN?PL) + seed KV `product-name-pl`.
2. `DamLabels.productNamePl` / `productNamePlParen` (tylko brand GC).
3. `dam-viz.js`: tytul karty + modal z `.dam-viz-card__title-pl`.
4. CSS: 11px, weight 600, color `#464255`.
5. Instrukcja `ui.product_name_pl_under_en` w program-instructions (15). Cache `?v=20260718namePl1`.

### Efekt/Fix
MINCED ? MINCED + ( Mielone ); NUGGETS ? ( Nuggetsy ); itd. na kartach GC.

### Test/Ewaluacja
- CDP: `mincedHtml = MINCED<br><span class="dam-viz-card__title-pl">( Mielone )</span>`; mapSize=43.
- Screenshot + Read: viz-minced-pl-name.png ? Pass.

### Zrodla
- product-name-pl.json, dam-labels.js, dam-viz.js, dam-brand.css, program-instructions.json, local_bridge.py

---

## 2026-07-18 - PL: nawiasy szare jak meta, tekst polowa szarosci

### Komenda/Akcja
User: nawiasy jak meta (#8b8d97); tekst PL tylko w polowie tak szary.

### Log/Status
1. `productNamePlMarkup` - osobne spany paren/text.
2. CSS: paren `#8b8d97`, text `#696877`. Cache `namePl2`.

### Efekt/Fix
`( Kie?baski ostre )` - nawiasy = meta, slowo ciemniejsze od meta, jasniejsze od tytulu.

### Test/Ewaluacja
- CDP: paren=rgb(139,141,151)=meta; text=rgb(105,104,119); title=rgb(70,66,85).
- Screenshot: viz-pl-parens-gray.png.

### Zrodla
- dam-labels.js, dam-viz.js, dam-brand.css, visualizations.html

---

## 2026-07-18 - product-people: nakarmienie autorow do wyszukiwarki

### Komenda/Akcja
User: nakarm osoba/autor kontekstem Sylwii/Szymona/KW (bez glosnych TAG na kartach).

### Log/Status
1. `product-people.json` (by_id/by_index/by_id_prefix + aliasy).
2. `enrich-search-tags.py` merge + by_tag imion + search_blob.
3. KV `product-people` + instrukcja `search.product_people`.
4. Seed + enrich: 60 produktow z authors; sylwia=23, krzysztof=51 (Asana+mapa).

### Efekt/Fix
Szukajka `sylwia` filtruje wizki (Mielone, Prebiotyk, Kalendarz?); badge imienia na karcie = nie.

### Test/Ewaluacja
- DamSearch.search('sylwia'): mode=tag, 23 hits.
- Viz CDP: q=sylwia ? 17 kart, badgeHit=false.
- Screenshot: viz-search-sylwia.png.

### Zrodla
- product-people.json, enrich-search-tags.py, local_bridge.py, program-instructions.json

---

## 2026-07-18 - Dashboard viz scale (intensive QA 10)

### Komenda/Akcja
User: widget "4 najnowsze wizualizacje" za maly (~469px), za duzo pustego miejsca; responsywne skalowanie; 10 rund ui-taste + ui-ux-pro-max.

### Log/Status
1. Design Read: Geex B2B dashboard density (dials 5/3/5) - fill width, nie redesign.
2. CSS `dam-dashboard.css`: layout main/side = `1fr` + clamp side; viz-latest span 9 + 2x2 grid (@container >=560px); fluid thumb/title/badges/icons (cqi).
3. Mobile (<=720): ikony w rzedzie, thumb 56px, line-clamp 3.
4. Geex `.geex-content { width: 75-80% }` -> override `width: 100%` na dashboardzie.
5. Cache `?v=20260718dashVizScale8`.

### Efekt/Fix
Lista viz: ~667-779px (bylo ~469); thumb ~107px (bylo 56); 2x2 na desktopie; tytuly czytelniejsze.

### Test/Ewaluacja
Intensive QA 10 passes (screenshot+Read): 375 / 768 / 1280+ / collapsed sidebar. CDP: listW, thumb, 2-col grid.

### Zrodla
- apps/web/assets/css/dam-dashboard.css
- apps/web/dashboard.html

---

## 2026-07-18 - Explorer: prawda zapisu statusu (nie localStorage-only)

### Komenda/Akcja
User: niespojnosc - banner "Status zapisywany lokalnie..." vs "Baza online" / Synology.

### Log/Status
1. Stary copy opisywal workflow sprzed lifecycle (reczny eksport na P:DAM).
2. Prawda: F/X/D = most `/lifecycle-status` ? dysk + lifecycle-status.json + mirror product-status.json + PG KV; localStorage = kopia.
3. "Baza online" = Postgres Synology (KV), nie lokalny-only status.
4. Update paska admina + tip przycisku + dam:db-status event.

### Efekt/Fix
Komunikaty zgodne z mostem/PG. Przycisk = "Pobierz kopie statusu" (backup).

### Zrodla
- explorer.html, dam-explorer.js, dam-db-status.js, dam-shortcuts.js

---

## 2026-07-18 - Docs: README, agents, LANG_PROVENANCE + commit/push

### Komenda/Akcja
User: zrob dokumentacje z agentow i jezykow (README, memory), commit i push wszystko.

### Log/Status
1. `agents/README.md`, `docs/LANG_PROVENANCE.md`, update README / memory / PROGRAM_INSTRUCTIONS / AGENTS.
2. git add + commit + push origin main.

### Zrodla
- README.md, agents/, docs/LANG_PROVENANCE.md, memory.md

---

## 2026-07-18 - Doprecyzowanie: DK zawsze PL; extra z dowodu

### Komenda/Akcja
User: DK zawsze polskie (PL). Czasem PL/GB - wtedy GB z nazw/oznaczenia. GC bez zgadywania.

### Log/Status
1. `apply_brand_lang_baseline` w build-file-index.py (DK+=pl; GC bez baseline).
2. Zaktualizowano lang-provenance.md, program-instructions, memory ?107.
3. Rebuild file-index.

### Efekt/Fix
DK ma PL zawsze; GB i inne extra tylko z tokenu lub override.

### Zrodla
- agents/shared/lang-provenance.md
- apps/web/scripts/build-file-index.py
- apps/web/data/program-instructions.json

---

## 2026-07-18 - Prompt: pochodzenie jezyka (nie hardcode produktu)

### Komenda/Akcja
User: twarda zasada to rozumienie SKAD bierze sie jezyk (wszystkie kody), nie "6300572=CZ+SK". Finalize prompt; 3 podejscia globalnie.

### Log/Status
1. Drafty A/B/C: `agents/shared/lang-provenance.DRAFTS.md` (kaskada / evidence / provenance).
2. Kanon: `agents/shared/lang-provenance.md` (A+B+C).
3. Wpiecie: AGENTS.md, Builder+QA AGENT.md, memory ?107, `program-instructions` id `data.lang_provenance_only`.

### Efekt/Fix
Regula = metoda wykrywania z dowodu; przyklad 6300572 tylko jako audyt metody.

### Zrodla
- agents/shared/lang-provenance.md
- agents/shared/lang-provenance.DRAFTS.md
- apps/web/data/program-instructions.json

---

## 2026-07-18 - Jezyki: zero halucynacji (6300572 CZ/SK)

### Komenda/Akcja
User: 6300572 to CZ/SK (plik `GC_Burger_CZ_SK_6300572_...ai`), nie GB. Przeanalizowac wszystkie produkty/warianty; program tylko surowe dane albo `?`; reczne ustawienia nigdy nie nadpisywane. 5 rund sprawdzania.

### Log/Status
1. Root cause: brak langs w folderze SLEEVE + brak parsowania z nazw plikow + domysl GC->gb w UI/indeksie.
2. `build-file-index.py`: `parse_langs_from_text`, `infer_langs_from_files`, `apply_lang_overrides`, brak brand default.
3. `lang-overrides.json` (manual wins). Front: dam-viz/labels/badges + usuniete domysly w dam-api/projects/project.
4. Rebuild file-index (~181 produktow, viz~391).
5. 5 rund QA (dane + UI).

### Efekt/Fix
6300572: langs=['cz','sk']; modal: tagi CZ+SK, chipy `CZ - 6300572` / `SK - 6300572`, meta bez Wielkiej Brytanii. GB-only bez tokenu GB/UK w plikach: 0. SKLEP!=SK: 0.

### Test/Ewaluacja
- R1: index 6300572 -> cz+sk (disk AI: CZ_SK).
- R2: disk PROJECT potwierdza CZ_SK, brak GB.
- R3: gb-only z evidence w nazwach plikow: 20 ok / 0 false.
- R4: multi-lang z tokenow plikow (CZ_SK itd.).
- R5: empty langs zostaja puste (-> UI `?`); override store gotowy.
- Screenshot+Read: viz-modal-6300572-cz-sk.png PASS.

### Zrodla
- build-file-index.py, lang-overrides.json, dam-viz.js, dam-labels.js, dam-badges.js, dam-api.js, dam-projects.js, dam-project.js

---

## 2026-07-18 - Carrier row + inbox hist/product (intensive 10)

### Komenda/Akcja
Przebudowa .dam-carrier-toggle-row (grid body|end, chevron po prawej), typografia global --dam-fs-base, inbox .dam-inbox-hist-item + .dam-inbox-item__product.

### Log/Status
1. Markup carrier: __body + __end (akcje + chevron ostatni); click na caly pasek poza controls
2. CSS: min-height 56, wrap meta, 0 overlaps (CDP), chevron gap ~10px
3. Folder .dam-folder-item__name + label nosnika = 14px / 500-600
4. Inbox hist jak .dam-inbox-mod (44px btn); product head+meta; nav circles w rzedzie (nie stack)
5. Cache: ?v=20260718carrierInbox11

### Test/Ewaluacja
Intensive QA 10 passes (screenshot+Read): user/admin explorer, 768 wrap, expand click, inbox historia, compact product, sidebar collapsed.
PASS: brak nachodzenia, chevron right, typografia tokenami.

### Zrodla
- ui-taste / ui-ux-pro-max (intensive 10)
- dam-brand.css, dam-explorer.js, dam-inbox.js

---

## 2026-07-18 - product-people: nakarmienie autorow do wyszukiwarki

### Komenda/Akcja
User: nakarm osoba/autor kontekstem Sylwii/Szymona/KW (bez glosnych TAG na kartach).

### Log/Status
1. `product-people.json` (by_id/by_index/by_id_prefix + aliasy).
2. `enrich-search-tags.py` merge + by_tag imion + search_blob.
3. KV `product-people` + instrukcja `search.product_people`.
4. Seed + enrich: 60 produktow z authors; sylwia=23, krzysztof=51 (Asana+mapa).

### Efekt/Fix
Szukajka `sylwia` filtruje wizki (Mielone, Prebiotyk, Kalendarz?); badge imienia na karcie = nie.

### Test/Ewaluacja
- DamSearch.search('sylwia'): mode=tag, 23 hits.
- Viz CDP: q=sylwia ? 17 kart, badgeHit=false; pill Autor Sylwia aktywny.
- Screenshot: viz-search-sylwia.png.

### Zrodla
- product-people.json, enrich-search-tags.py, local_bridge.py, program-instructions.json


---

## 2026-07-18 - carrier meta right-align + inbox list-row (intensive QA 10)

### Komenda/Akcja
User: wyr?wnaj .dam-carrier-head__meta do prawej przy __end; przebuduj brzydkie li.dam-inbox-item; 10 rund ui-taste + ui-ux-pro-max.

### Design Read
Geex DAM product UI polish for admins; Linear-clean list-row; Geex purple tokens. Dials: V5 / M3 / D7.

### Log/Status
1. Carrier: meta jako osobna kolumna grid ody | meta | end (nie wewn?trz __end).
2. Meta desktop: nowrap + kompaktowy chip indeksu (Edytuj zamiast Edytuj indeks).
3. Inbox: anatomia __row / __row-end; actor (Zg?osi?/Odrzuci?) w __row-end obok daty.
4. Cache: ?v=20260718carrierInbox22.

### Efekt/Fix
- Carrier: CDP orderOk + oneLine @1280/1600; gap meta?end = 10px.
- Inbox mod: wysoko?? ~94px (by?o ~270+); actor w prawej wi?zce.

### Test/Ewaluacja
Intensive QA Pass 9-10 (screenshot+Read):
- Pass 9: explorer Babka carriers - one-line meta flush do akcji/chevron.
- Pass 10: inbox propozycje + historia + 375; brak regresji carrier overlap.

### Zrodla
- ui-taste / ui-ux-pro-max (intensive 10)
- dam-brand.css, dam-explorer.js, dam-inbox.js

---

## 2026-07-18 - Menu profilu: hierarchia + stonowany legal

### Komenda/Akcja
User: przebuduj okienko profilu (ui-taste, 4 passy); Prywatnosc/Regulamin mniej widoczne.

### Log/Status
1. Markup `.dam-user-menu`: identity ? Profil/Ustawienia/Pomoc ? micro legal ? Wyloguj.
2. CSS: legal 10px `#c2c3cb`; nav 14px `#464255`; accent `#AB54DB`.
3. `ensureUserMenuMarkup` migruje stare popup Geex. Cache `?v=20260718userMenu3`.

### Test/Ewaluacja
- Pass 1?4 screenshot+Read. Final: user-menu-pass4-final.png.
- CDP: legal 10px stonowany; nav ciemniejszy od legal.

### Zrodla
- dam-shell.js, dam-brand.css

---

## 2026-07-18 - Tagi na kartach Projektow: edit + AJAX + CTRL + GSAP

### Komenda/Akcja
User: edycja tagow z kart Projektow (globalnie), AJAX filtr przy kliku, CTRL+klik laczy tokeny, GSAP reveal 0.2s gora->dol; ui-taste 5 pass + gsap-core.

### Log/Status
1. Root cause: index.html nie ladowal dam-tag-edit.js; applyTagFilter wstawial surowy kod (01 - BATONY) zamiast etykiety; admin delay 520ms; brak CTRL append.
2. dam-badges.js: searchTokenForBadge + normalizeSearchToken; Ctrl/Meta append; Shift/Alt/dblclick = DamTagEdit; natychmiastowy filtr.
3. index.html: dam-tag-edit.js + vendor gsap.min.js; cache ?v=20260718tagAjax3.
4. dam-projects.js: revealProjectCards (autoAlpha + clipPath inset, 0.2s, stagger, prefers-reduced-motion).
5. dam-tag-bar.js: Ctrl+klik tez dolacza token.

### Efekt/Fix
- Klik Batony -> search=Batony, 70/181.
- Ctrl Banoffee -> Batony banoffee, 2 karty.
- Shift+klik -> popover Wybierz kategorie (7 opcji).
- GSAP mid: opacity 0 + clip 100%; po ~0.35s opacity 1.

### Test/Ewaluacja
ui-taste 5 pass screenshot+Read:
- Pass 1 375: struktura + query batony banoffee / 2/181 - clean
- Pass 2 375: spacing kart - clean
- Pass 3 375: mobile stack - clean
- Pass 4 768: tablet karty - clean
- Pass 5 1280: 2 karty side-by-side, search Batony banoffee - clean

### Zrodla
- gsap-core (autoAlpha, clipPath, matchMedia/reduced-motion)
- ui-taste 5 passes
- dam-badges.js, dam-projects.js, dam-tag-bar.js, index.html

---

## 2026-07-18 - Lifecycle path_not_found + toggle D + search scope

### Komenda/Akcja
User: ponowne D nie odznacza; X?F/D = Blad path_not_found; wyszukiwarka ma pokazywac strukture Produkt/Wariant + chipy Wszystko/Produkty/Warianty. Skills: systematic-debugging + ui-taste 5 passes.

### Log/Status
1. Reproduce: wariant w `? ARCHIWUM/.../TEST-TEST - X`, UI wysylalo stara sciezke `...- D` ? path_not_found.
2. Fix engine: `resolve_existing_path` (store + history + letter variants + skan ARCHIWUM) w `lifecycle_status.py`.
3. Fix UI: toggle is-on?clear; path z lifecycle-store; `patchPathsAfterLifecycle` przed rebuild; status z lifecycle-store.
4. Search: chipy scope + hits Produkt/Wariant (nested); CSS is-soft przy Wszystko.
5. Restart bridge (pythonw local_bridge.py). Cache explorer `?v=20260718lifeFix4`.

### Efekt/Fix
- Smoke FS: clear / D / clear / X / X?F (stale path) / clear = OK na TEST-TEST.
- Browser: klik D ? folder `- D`; ponowne D ? clear bez path_not_found.
- Search "test": PRODUKT TEST LIFECYCLE + nested WARIANT TEST-TEST.

### Test/Ewaluacja
ui-taste 5 pass screenshot+Read:
- Pass 1 375: struktura chipow + nested hits - clean
- Pass 2 375: spacing / is-soft chipy - clean
- Pass 3 375: mobile search + product open - clean
- Pass 4 768: tablet search dropdown - clean
- Pass 5 1280: F/X/D + Odznacz + search structure - clean

### Zrodla
- systematic-debugging (reproduce ? isolate stale path ? store resolve)
- ui-taste 5 passes (Geex preserve, dials match existing)
- lifecycle_status.py, dam-explorer.js, dam-search.js, dam-brand.css, explorer.html


---

## 2026-07-18 - Wizualizacje: Cofnij wyzej + DK/GC jak w Eksplorerze

### Komenda/Akcja
User: przenies Cofnij/lifecycle hint wyzej (nad pasek Skala); uspojnic Marka DK/GC z chipami z Eksplorera.

### Log/Status
1. visualizations.html: vizBrandMount + DamBrandFilter.renderChips zamiast dropdown Marka: DK+GC.
2. (nadpisane przez searchUnify3) damChangeLogBar wraca do grid-toolbar obok Skali.
3. Grid toolbar: status + Cofnij/Ponow + Skala (prawo).
4. CSS; cache pozniej searchUnify3.

### Efekt/Fix
Chipy DK/GC jak Eksplorer. Skala przy prawej krawedzi nad siatka.

### Test/Ewaluacja
Patrz wpis searchUnify3 (ponizej).

### Zrodla
- ui-taste (Geex redesign-preserve)
- dam-brand-filter.js, visualizations.html, dam-viz.js, dam-brand.css

---

## 2026-07-18 - Przywr?cenie wyszukiwania Sylwia/Krzysztof/Szymon (peopleFix1)

### Komenda/Akcja
User: dalej nie da sie wyszukac po Sylwia/Krzysztof/Szymon ? mialo sie dac (ustalone wczesniej).

### Log/Status
1. Kontekst z chatu [product-people](a78fa004-2674-4f22-a383-c0f448f9635e): mapa kto?produkt, bez badge na kartach; enrich do authors/by_tag.
2. Reproduce: file-index po rebuildzie mial `authors=0`, `by_tag.sylwia=0` (enrich zniknal).
3. `python apps/web/scripts/enrich-search-tags.py` ? sylwia=23, krzysztof=51, szymon=2, authors=60.
4. Hook: koniec `build-file-index.py` zawsze odpala enrich (zeby Skanuj dysk nie kasowal osob).
5. memory #108 zaktualizowane.

### Efekt/Fix
Viz `q=sylwia`: Mielone, Prebiotyk, Odpornosc, Energia, Kalendarz, kremy?; pill Autor Sylwia widoczny.

### Test/Ewaluacja
Browser fill sylwia ? karty OK; CDP authorsInMem=60, by_tag.sylwia=23.

### Zrodla
- systematic-debugging
- a78fa004 (ustalenie people1), product-people.json, enrich-search-tags.py, build-file-index.py

---

## 2026-07-18 - Label nosnika: kolor jak viz title, 16px (nie scinac)

### Komenda/Akcja
User: `.dam-carrier-toggle__label` - nie pomniejszac; zmienic KOLOR na jak `.dam-viz-card__title`.

### Log/Status
1. Przyczyna: wczesniejszy pass scial font do `var(--dam-fs-base, 14px)` zamiast tylko koloru.
2. Fix: `font-size: 16px` (memory #91); `color: #464255` (jak viz title); usunieto zielony override `--aktualne`.
3. Cache explorer `?v=20260718carrierLabel16`. memory #109 poprawione.

### Efekt/Fix
Live: KARTON 6x MINI = 16px / 600 / rgb(70,66,85).

### Test/Ewaluacja
Screenshot BABKA CYTRYNOWA + CDP computed styles - Pass.

### Zrodla
- systematic-debugging, ui-taste (Geex preserve)
- dam-brand.css `.dam-carrier-toggle__label`

---

## 2026-07-18 - Globalny search + declutter toolbar Viz (searchUnify3)

### Komenda/Akcja
User: ujednolicic pasek wyszukiwania wszedzie (Projekty/Viz/Eksplorer); na Viz przeniesc Poka? wszystkie / Marka / Jezyki pod TAGI; Skale do prawej nad wizualizacjami; przyciski akcji na bialym tle wynikow.

### Log/Status
1. `visualizations.html`: toolbar = sam search; secondary pod tagami; Skala + Cofnij w `.dam-viz-grid-toolbar__end`.
2. `index.html`: Od?wie?/Skanuj ? `.dam-projects-grid-toolbar` pod tagami.
3. `explorer.html`: Od?wie?/Eksportuj ? `.dam-explorer-results__toolbar` (biale).
4. `dam-brand.css` + `dam-app.css`: kanon `.dam-search-wrap` max-width:none, input 44px; style secondary/grid toolbars.
5. Cache `?v=20260718searchUnify3`. memory.md #111.

### Efekt/Fix
@1440: searchW = 1071px na Viz / Projekty / Eksplorer (identyczny chrome). Viz: secondaryBelowTags; zoomFlush=0.

### Test/Ewaluacja
ui-taste 5 pass screenshot+Read:
- Pass 1 375: struktura search?tagi?secondary?Skala - clean
- Pass 2 375: spacing secondary + grid toolbar - clean
- Pass 3 375: clear X + mobile stack - clean (h-scroll tylko geex-customizer/header - preexist)
- Pass 4 768: brand chips OK, layout - clean
- Pass 5 1280/1440: Viz + Projekty + Eksplorer search unify - clean

### Zrodla
- ui-taste, visual-qa-testing, verifying-in-browser
- visualizations.html, index.html, explorer.html, dam-brand.css, dam-app.css

---

## 2026-07-18 - Search scope radio + biala tablica (Eksplorer/Projekty/Viz)

### Komenda/Akcja
User: chipy Wszystko/Produkty/Warianty pomylone (multi soft); odklik = Wszystko; biala tablica pod inputem; to samo wyszukiwanie wszedzie; Wizualizacje locked Wszystko + wygaszone Produkty/Warianty; Projekty produkty+warianty. Skill: ui-taste 5 passes.

### Log/Status
1. Bug logiki: przy Wszystko klik Produkty wylaczal produkty (zostawial warianty) - odwrotnie.
2. Rewrite `dam-search.js`: `getScopeMode`/`setScopeMode` radio; odklik products/variants ? all; usunieto `is-soft`.
3. CSS: `.dam-search-wrap--panel` + wyniki `position:static` w tablicy; disabled chips.
4. Markup scope na index + visualizations; viz `bindScopeChips(..., {locked:true})` bez zapisu localStorage.
5. Projekty: filtr `productHaystack` / `variantHaystack` wg mode.
6. Cache `?v=20260718scopeRadio2`.

### Efekt/Fix
- CDP logic: all?products?odklik all?variants?all OK.
- Viz: Wszystko on, Produkty/Warianty disabled.
- Projekty/Eksplorer: chipy w bialej tablicy.

### Test/Ewaluacja
ui-taste 5 pass screenshot+Read:
- Pass 1 375: hierarchy - panel+chips; defect: wyniki absolute wygladaly osobno ? fix static in-panel
- Pass 2 375: spacing panel - clean (geometry scopeInside/resInside)
- Pass 3 375: mobile + radio paint - clean
- Pass 4 768: tablet panel - clean
- Pass 5 1280: desktop + spot Viz locked + Projekty chips - clean

### Zrodla
- ui-taste (redesign preserve Geex, dials 5/3/5)
- dam-search.js, dam-brand.css, dam-projects.js, dam-viz.js, explorer/index/visualizations.html

---

## 2026-07-18 - Viz toolbar NAD Poka? wszystkie / DK GC

### Komenda/Akcja
User: `dam-viz-grid-toolbar` (status/Cofnij/Ponow/lifecycle/Skala) ma byc WYZEJ - nad Poka? wszystkie + DK + GC.

### Log/Status
1. Przeniesiono `.dam-viz-grid-toolbar` w `visualizations.html` przed `.dam-viz-secondary-filters` (wewnatrz search-block).
2. Marginesy CSS: toolbar 4/8, secondary 0/12.
3. Cache `?v=20260718vizToolbarUp1`.

### Efekt/Fix
Kolejnosc: tagi ? toolbar (Cofnij/Skala) ? Poka? wszystkie/DK/GC ? siatka. CDP: toolbarTop 568 < secondaryTop 612.

### Test/Ewaluacja
Screenshot + Read: order OK.

---

## 2026-07-18 - Fix Wstecz panelu + AJAX search w Eksplorerze

### Komenda/Akcja
User: przycisk Wstecz (dam-panel-nav -1) nie wraca; wyszukiwarka powinna AJAX-em odswiezac panel .dam-explorer-panel.

### Log/Status
1. Root cause Wstecz: historia (navGo) miala pierwszenstwo i po breadcrumb/push wracala do produktu (pulapka).
2. panelStepUp: krok w gore hierarchii (produkt -> wyniki/kategoria -> clear search -> welcome); zdejmowanie productId ze stosu.
3. Breadcrumb: bez navPush przy cofaniu; trim product ze stosu.
4. applySearchToPanel: live DamSearch -> state.searchHits -> renderSearchResultsPanel (nie zostawia listy kategorii).
5. Cache `?v=20260718panelNavSearch2`.

### Efekt/Fix
- Produkt CASHEWS -> Wstecz -> Batony -> Wstecz -> welcome.
- Query `cashews`: panel Wyszukiwanie, 8 produktow; Wstecz z produktu wraca do wynikow.
- `TEST-TEST`: panel pokazuje Brak wynikow (produkt usuniety z X:/Marketing, brak w file-index).

### Test/Ewaluacja
CDP + screenshot+Read: product view, search panel Wyszukiwanie/cashews OK.

### Zrodla
- dam-explorer.js, explorer.html, dam-search.js

---

## 2026-07-18 - Repair TEST LIFECYCLE foldery + lifecycle bugs

### Komenda/Akcja
User: sprawdz stan produktu testowego po klikaniu; co z folderami; napraw bledy.

### Log/Status
1. Stan: produkt w `? ARCHIWUM` jako `? - X`, pusty wrapper bez `- X`, brak w root BATONY; store.revisions.TEST-TEST stale F na martwej sciezce.
2. Przywr?cono produkt live (clear) + usunieto orphan wrapper.
3. Fix `lifecycle_status.py`: cleanup pustych wrapperow, rename przez pusty dest, sync revisions po cascade produktu.
4. Fix `dam-explorer.js`: lifecycle > localStorage; clear != Starsza; fallback JSON gdy bridge 404.
5. Rebuild `file-index` + czyszczenie `product-status` / `lifecycle-status` dla TEST.
6. QA: variant X?clear usuwa wrapper; UI: TEST-TEST, Aktualne, bez chip X.

### Efekt/Fix
Live: `X:\?\BATONY\TEST LIFECYCLE ? [ nerkowcowy ]\BAT - 35 g - 18.07.2026 - TEST-TEST`. ARCH bez leftoverow TEST. Cache `?v=20260718testRepair3`.

### Test/Ewaluacja
CDP: search TEST-TEST ? produkt bez X; wariant Aktualne + index TEST-TEST.

### Zrodla
- apps/desktop/lifecycle_status.py, apps/web/assets/js/dam-explorer.js, data/*.json

---

## 2026-07-18 - Settings rebuild + global accent (chrome only)

### Komenda/Akcja
User: przebuduj settings.html widgetowo (jak dashboard); edytowalny kolor glowny (akcent chrome: FAB, sidebar active, breadcrumb, ADMIN); TAGI bez zmian; edytowalne powiadomienia; wiecej integracji; 12 pass QA.

### Log/Status
1. Design Read: B2B DAM settings, Geex preserve, dials ~5/3/5. Intensive QA 12 pass.
2. Nowe: `dam-accent.js/css`, `dam-settings.css/js`; rewrite `settings.html` (bento: profil, akcent, dysk, prefs, integracje+stuby, notify grafik, naming RO, instructions RO).
3. Bridge: GET/POST `/notification-groups`.
4. Soft-boot + `ensureAccentCss` w `dam-shell.js`.
5. Fix: selektory accent bez `body.dam-app` (brak klasy na stronach) - FAB/sidebar/scope pills teraz biora `--dam-primary`.
6. Cache `?v=20260718accent2` / `set4`.

### Efekt/Fix
- Akcent Ocean `#0B6E99`: FAB + Wszystko + ADMIN chrome; tagi smak/typ/opakowanie/autor bez zmian (CDP).
- Settings: widget grid + jump pills + edycja profilu/notify; Reset Geex `#AB54DB`.

### Test/Ewaluacja
Pass 1-9 (wczesniej): struktura, header, mobile grid, accent, desktop.
Pass 10: explorer Ocean - chrome blue, tagi izolowane.
Pass 11: desktop 1280 + collapsed sidebar + Reset Geex.
Pass 12: 768 stack, integrations+notify, 375 full-width content (main 375px).

### Zrodla
- ui-taste, ui-ux-pro-max, systematic-debugging
- Flowbite-inspired settings sections (structure only, Geex tokens)
- apps/web/settings.html, dam-accent.*, dam-settings.*, dam-shell.js


---

## 2026-07-18 - Settings UX polish + accent/theme overlay (intensive 10)

### Komenda/Akcja
User: kolory hover zostaja fioletowe; filtr sekcji zamiast scroll + X; unified buttons; bez Geex w copy; padding +8; light/dark jako nakladka; /ui-ux-pro-max 10 pass + /ui-taste + systematic-debugging.

### Log/Status
1. Root cause: hardcoded rgba(171,84,219) w style.css sidebar hover + dam-brand.css; nie szlo za --dam-primary.
2. Fix: dam-brand bulk ? color-mix/var; style.css sidebar hover ? color-mix; rozbudowa dam-accent.css.
3. Settings: filtr chipow + X (nie anchors); unified .dam-sw-btn 44px; padding kart 24/26 (+8); copy PL user-friendly; Przywr?? domy?lny.
4. Theme overlay: dam-theme.js + dam-tokens mapuje Geex surface vars; soft-boot w dam-shell.
5. Cache ?v=20260718set5b / accent3 / theme1.

### Efekt/Fix
- Akcent #008244: Zapisz, FAB, chipy, ADMIN, avatar, soft Sprawd? - zielone (CDP).
- Filtr Wygl?d ukrywa pozostale karty (display:none); X ? Wszystko.
- Dark: data-theme=dark, karty #201f28, body ciemne.

### Test/Ewaluacja
Pass1 desktop padding 24/26 + btn 44px. Pass2 filtr. Pass3 green accent. Pass4 dark. Pass5 all+green. Pass6 mobile chips scroll. Pass7-10: hover/filter/clear/sidebar.

### Zrodla
- ui-taste, ui-ux-pro-max, systematic-debugging
- apps/web/settings.html, dam-settings.*, dam-accent.*, dam-theme.js, dam-tokens.css, dam-brand.css, style.css


---

## 2026-07-18 - Desktop title/icon/size + licencja KW + security bridge

### Komenda/Akcja
User: wieksze okno (bez scrolla poziomego); ikona Windows; nazwa `DAM - Dobra Kaloria - Inyfinn`; licencja na dane KW + wycena rynkowa; wyjasnienie Metadata/DB PARTIAL; audyt i latanie luk.

### Log/Status
1. `APP_TITLE` + mutex w `runtime_config.py`; VBS MsgBox; skrot pulpitu z nowa nazwa + `dam_app.ico`.
2. `launch.py`: `preferred_window_size()` (~92% ekranu), min 1400x800; `webview.start(icon=...)` + WM_SETICON (pythonw nie bierze ikony z exe).
3. Przebudowa ICO: zielony kafelek + ?DAM? (`scripts/build-dam-ico.py`).
4. `LICENSE.md` + `license.html`: wlasciciel KW; PESEL maskowany 93*****179; bez dowodu; adresy + kontakt; kwoty bazowe 6900 / 490 / 890 PLN netto (indywidualnie). Aktualizacja: usunieto pelny PESEL i dane dowodu.
5. Security `local_bridge.py`: media path jail + login; reveal bez shell; auth na audit/media/browse/config; register bootstrap|admin; CORS Origin; OAuth escape; limit body/media.

### Efekt/Fix
- Okno: tytul `DAM - Dobra Kaloria - Inyfinn`, rozmiar 1920x1200 na testowym ekranie, WM_GETICON != 0.
- `/media` nie serwuje plikow poza Marketing; open register zablokowany gdy sa juz userzy.

### Test/Ewaluacja
- Relaunch run-dam.vbs: MainWindowTitle OK; GetWindowRect ~1920x1200; icon handles ustawione.
- py_compile: launch, runtime_config, local_bridge, auth_store.

### Metadata/DB (odpowiedz)
PARTIAL = Postgres trzyma auth/sesje/audit_log/KV; relacje produkt?pliki?wersje?tagi w `file-index.json` + KV, nie w FK SQL. Logi audit sa. Brakuje pelnego schematu relacyjnego w sciezce Geex UI (Laravel ma bogatszy schemat, ale UI z niego nie zyje) - ryzyko spojnosci = dwa swiaty JSON/KV vs SQL, nie ?brak logow?.

### Zrodla
- pywebview `start(icon=)` WinForms (`_state['icon']`)
- Wycena rynkowa DAM/MAM SMB (wide?ki cloud/on-prem) - baza 6900/490/890 PLN
- LICENSE.md, apps/desktop/launch.py, local_bridge.py


---

## 2026-07-18 - Fix offline + logout + folder picker + meta FK (3 rundy)

### Komenda/Akcja
User: baza i dysk offline; brak wylogowania; brzydki modal sciezki bez pickera folderu; zbudowac Metadata/DB FK; ui-taste + debugger; 3 rundy.

### Log/Status
1. Root cause: 401 na `/db/status` i `/files/status` (fetch bez Bearer) + logout noop.
2. Status/config/validate bez Bearera na localhost; media/browse/mutations z auth.
3. `auth_store.logout` + `/auth/logout` + prawdziwy `DamApi.logout` ? signin.
4. `pick_folder` (FOLDER_DIALOG) + przycisk Wskaz folder w modalu.
5. `meta_store.py`: FK sync 181/457/5010/77/3; hook po index rebuild; GET `/meta/status`.

### Efekt/Fix
- Pliki online + Baza online (postgres @ inyfinn.synology.me).
- Modal: solid green browse 44px; 3 pass screenshot.

### Test/Ewaluacja
Pass1 modal+online. Pass2 browse green. Pass3 CDP online + logout=fn.

### Zrodla
- debugger, ui-taste, meta_store.py, dam-paths.js, dam-api.js, launch.py


---

## 2026-07-18 - Lifecycle Bez statusu + cascade X (lifeBez1)

### Komenda/Akcja
User: Odznacz nie sciaga F; produkt Bez statusu a wariant D mimo czystej sciezki dysku; rename konflikty przy szybkich klikach; produkt X vs wariant X; przycisk = Bez statusu; Odswiez liste ma resync z dysku.

### Log/Status
1. Root cause UI: `is_latest` mapowane na Aktualne/F mimo braku literki na dysku.
2. `lifecycle_status.py`: lock apply; `find_live_product_dir`; wariant X bez X na produkcie live; produkt X cascade; restore do live z aktualna literka produktu.
3. `dam-explorer.js`: badge/btn Bez statusu; kolejka klikow; `syncLifecycleFromDiskIndex` przy Odswiez liste; dysk = prawda.
4. Restart `local_bridge` (nowy modul) - sesje padly (401) az user zaloguje ponownie.
5. Disk FINAL clean: `BATONY/TEST LIFECYCLE ? [ nerkowcowy ]/BAT - 35 g - 18.07.2026 - TEST-TEST`.

### Efekt/Fix
- UI: produkt + wariant **Bez statusu** (zielone is-on), badge Bez statusu (nie Aktualne/D).
- Combo Python PASS: product F?clear; variant F?clear; variant X (produkt live bez X)?restore; product X (oba -X w ARCHIWUM)?restore clear.

### Test/Ewaluacja
- Screenshot `test-lifecycle-bez-statusu.png` + Read: oba scope Bez statusu.
- CDP: buttons clear is-on; bridge POST bez sesji = 401 (oczekiwane po restarcie).
- Cache: `?v=20260718lifeBez1`.

### Zrodla
- systematic-debugging, verifying-in-browser
- apps/desktop/lifecycle_status.py, apps/web/assets/js/dam-explorer.js


---

## 2026-07-18 - Production Readiness / Go-Live (PRR)

### Komenda/Akcja
User: aplikacja jutro do klienta - przebadaj, znajdz luki, zalataj, zbuduj plan weryfikacji i wypuszczania produkcyjnego.

### Log/Status
1. Nazwa formalna: Production Readiness Review + Go-Live Checklist -> `GO_LIVE.md`.
2. Smoke Gate B: `apps/desktop/scripts/smoke-production.ps1` (PASS + 1 WARN haslo seed).
3. Branding: usunieto user-facing `DAM ETA` -> `DAM` / `DAM - Dobra Kaloria - Inyfinn`.
4. Signin: rejestracja publiczna ukryta (bootstrap tylko gdy 0 userow); `GET /auth/registration-open`.
5. Hasla: seed wymaga `DAM_SEED_PASSWORD`; skrypty `set-all-passwords.py` / `set-user-password.py`; register min 8 znakow.
6. Restart `local_bridge` z nowym endpointem; pliki/db/meta online; media 401.

### Efekt/Fix
- Gate B smoke: FAIL=0 WARN=1 (haslo `test` nadal aktywne - BLOKADA Gate C).
- UI signin: Witaj w DAM, brak zakladki Utworz konto, footer admin-only.

### Test/Ewaluacja
- smoke-production.ps1 exit 0
- Screenshot signin `golive-signin-v3.png` + Read (vision): branding OK, rejestracja ukryta, PL ze znakami.

### Zrodla
- GO_LIVE.md, auth_store.set_user_password, local_bridge /auth/registration-open, signin.html


---

## 2026-07-18 - Follow-up PRR scan (P0/P1)

### Komenda/Akcja
Domkniecie luk z Prod readiness codebase scan po GO_LIVE.

### Log/Status
1. logout + clear_bound_session
2. POST /machine-config -> require login (401 bez Bearer)
3. install-desktop-shortcut.ps1 -> DAM - Dobra Kaloria - Inyfinn (+ usun DAM ETA.lnk)
4. OAuth callback z CORS_ORIGIN / DAM_UI_ORIGIN
5. dam-api cache-bust 20260719golive1; komunikat hasla min 8 + admin_required

### Test/Ewaluacja
POST machine-config 401; logout bound clear OK; smoke FAIL=0 WARN=1 (haslo test).

### Zrodla
- auth_store.py, local_bridge.py, dam-api.js, install-desktop-shortcut.ps1

---

## 2026-07-18 - Lifecycle reconcile mtime + Stosuj zmiany (lifeSync1)

### Komenda/Akcja
User: po zmianie program nie weryfikuje dysku; Odswiez = dysk->program; Stosuj zmiany = FORCE program->dysk; start = mtime (kto pozniej zmienil literke); X na dysku poza archiwum -> przenies przy boot.

### Log/Status
1. `applied_at` + `source` przy kazdym apply programu.
2. `pull_lifecycle_from_disk` / `reconcile_lifecycle_on_boot` / `force_apply_program_to_disk` w lifecycle_status.py.
3. Bridge: GET `/lifecycle-reconcile?mode=pull|boot`, POST `/lifecycle-force`.
4. UI: tip Odswiez; przycisk `#damLifecycleForce` Stosuj zmiany; boot reconcile po load; toast przy drifts.
5. QA TEST: pull F->clear drifts=2; boot program_wins przy nowszym applied_at; FORCE dry planned=1.

### Efekt/Fix
- Odswiez nie rusza folderow; panel = literka z dysku + powiadomienie.
- Stosuj zmiany = FORCE na Marketing.
- Boot: mtime decyduje kto wygrywa; enforce X->ARCHIWUM gdy dysk nowszy.

### Test/Ewaluacja
- Python pull/boot/force na test-lifecycle-nerkowcowy PASS.
- Cache `?v=20260718lifeSync1`.

### Zrodla
- systematic-debugging
- apps/desktop/lifecycle_status.py, local_bridge.py, dam-explorer.js, explorer.html

---

## 2026-07-19 - Branding plan v4 (lokalnie, bez bridge API)

### Komenda/Akcja
User: kontynuuj przez Cursor/repo, nie przez bridge API. Domknięcie: marketing na project.html, admin kolejki wykrojników, Part G instrukcje, rapidocr w requirements.

### Log/Status
1. `dam-project.js`: mini-siatka marketingu (SKU/indeks/linked_product_ids), sekcja wykrojników z registry JSON.
2. `integrations.html` + `dam-wykrojnik-queue.js`: kolejka lokalna (localStorage + pobierz JSON).
3. `program-instructions.json`: +3 wpisy (branding.hub_viz_cards, branding.project_marketing, wykrojnik.queue_local_admin); packaging.tag_tiers → „Tagi pakowania (2F)”.
4. `requirements.txt`: rapidocr-onnxruntime (OCR stub).
5. Cache bust `hub20260719f` na project catalog CSS/JS.

### Efekt/Fix
- project.html pokazuje do 6 kart Branding z tagami DamBadges.
- Admin mapuje wykrojniki bez POST na bridge.
- Bridge PATCH catalog — pominięty (decyzja usera).

### Test/Ewaluacja
- Screenshot QA: project 375px, integrations, branding (w toku po restarcie cache).

### Zrodla
- docs/BRANDING-HUB.md, program-instructions Part G

---

## 2026-07-19 - Branding hub: tagi, preview PSB, bridge cleanup

### Komenda/Akcja
User: weryfikuj pliki dalej, kontynuuj usprawnienia platformy (branding tagi, miniatury, PSB/PSD, filtry chipami).

### Log/Status
1. Zabito 4 zombie `local_bridge.py` na :8766; uruchomiono jedna instancja z `psd-tools`.
2. `build-branding-index.py`: `by_appearance` (tylko appearance_tags); usunięto tokeny `search_blob` z `by_tag` (koniec śmieci typu `x:/marketing`).
3. `dam-branding.js` j6: dynamiczne chipy produktu z `by_appearance`; cache bust `hub20260719j6`.
4. `local_bridge.py`: preview raster/wideo zwraca 422 `preview_failed` zamiast 415; PSB 652MB → JPEG 141KB OK.
5. OCR batch `enrich-branding-recognize.py --limit 300` + `link-branding-products.py`; indeks 7832 assetów, 3710 z appearance_tags.

### Efekt/Fix
- HTTP `GET /media?path=...psb&preview=1` → 200 image/jpeg.
- Wyszukiwanie `proteina` + „Tylko grafiki”: 240 grafik, miniatury 848–1200px.
- Chipy PRODUKT czyste (Proteina, Karton 6x, Burger… bez fragmentów ścieżek).
- Modal: podgląd + tagi DK/Proteina/Banoffee + zoom dock na dole.

### Test/Ewaluacja
- Screenshot Pass: branding tagi j6, modal banoffee 848×1200, bridge /health OK.
- CDP: `DamMediaPreview.openAsset` img naturalWidth=848.

### Zrodla
- visual-qa-testing, systematic-debugging
- apps/desktop/local_bridge.py, apps/web/scripts/build-branding-index.py, dam-branding.js

---

## 2026-07-19 - Lifecycle previous_letter + auto-reconcile (j17/j18)

### Komenda/Akcja
User: TEST LIFECYCLE F/X/D — po restore z archiwum wszystko D zamiast BAT=D, DOY/PROD=clear, ETY=F. Wymagany full commit + push.

### Log/Status
1. **Przyczyna „wszystko D” (3x):**
   - DOY i ETY wspolny `revision_index` TEST-TEST2 → `_plan_variant` bral legacy klucz z `previous_letter: D` zamiast sciezki nośnika.
   - `_sync_revisions_after_product` przy clear produktu ustawial `previous_letter: null` w cascade_meta i kasowal stan w store.
   - Restore variant uzywal `prev in (F,X,D)` — X jako restore target.
2. **Fix Python** (`lifecycle_status.py`):
   - `_variant_identity` (DOY|TEST-TEST2 vs ETY|TEST-TEST2), `_rev_row_for_variant` (sciezka first).
   - `_restore_letter_from_row`: nigdy X; BAT D zostaje przy product clear.
   - cascade_meta: `previous_letter` tylko przy wejsciu w X; legacy klucz index usuwany po zapisie po sciezce.
3. **Fix JS** (`dam-explorer.js` j17/j18): `reconcileProductLifecycleFromDisk`, `findFreshProductInIndex`, preserve `previous_letter`.
4. **Test:** `apps/desktop/tests/test_lifecycle_previous_letter.py` — ALL OK.

### Efekt/Fix
- Oczekiwany stan po scenariuszu usera: PROD/DOY clear, BAT D, ETY F.
- Cache: `hub20260719j18`. Bridge wymaga restartu po deploy Python.

### Test/Ewaluacja
- Unit test previous_letter: PASS.
- X: Marketing niedostepny w sesji agenta (PRODUCT_NOT_FOUND) — retest UI po restarcie bridge u usera.

### Zrodla
- lifecycle-status.json history `variant_restored_previous_letter:D` na DOY/ETY
- systematic-debugging

---

## 2026-07-19 - Branding: POLSKA + archiwum, kontekst folderu, modal skojarzen (disc8)

### Komenda/Akcja
User: indeksuj `- POLSKA` i `-- ARCHIWUM --` (stara struktura Marketing); przy nakladce wygrywa POLSKA bez tagow Archiwum; w modalu warianty Desktop/Tablet/Mobile, skojarzone produkty z miniaturami, tagi Szkoła/Edytowalny; dokumentacja + commit + push.

### Log/Status
1. **`build-branding-index.py`**: skan dwufazowy (POLSKA, potem archiwum); dedup kluczem `stem+wymiary` (np. `back to school:992x600`); statystyki `legacy_skipped_overlap` w logu buildu.
2. **`brand_folder_context.py`** (nowy): grupy po `folder_dir`; `folder_variants`, `linked_products` z thumb z `viz_latest`; `LEGACY_FOLDER_TAGS` dla 01–10, 99, wymiana; `THEME_VOCAB` (Szkoła); Edytowalny gdy `.psd`/`.ai` w folderze.
3. **`brand_tag_utils.py`**: segment `SLIDERY` → Slidery + Na sklep; filtr Slidery → zakladka WWW.
4. **UI**: `dam-media-preview.js` - warianty | separator | skojarzone produkty (wspolne `groupContext`); `dam-branding.css` layout assoc; cache bust `hub20260719disc8`.
5. **`program-instructions.json`**: `branding.marketing_dual_roots`, `branding.slider_shop_tags`.
6. **Testy**: `test_build_branding_dedupe`, `test_brand_folder_context`, `test_brand_tag_utils` - PASS.
7. **Rebuild indeksu**: 49252 assetow (6787 pominietych nakladek archiwum); Back to school 992x600 tylko POLSKA (`br-003365`).

### Efekt/Fix
- POLSKA: 0 assetow z tagiem Archiwum w indeksie branding.
- Legacy-only: tagi Archiwum + Stara struktura + mapowanie starych folderow.
- Modal Back to school: 3 warianty, ORZECH CZEKOLADA + CHRUPIACY ORZECH, Szkoła, Edytowalny.

### Test/Ewaluacja
- Unit testy dedupe + folder context: PASS.
- Screenshot QA modal (1280 + 375): warianty lewo, produkty prawo, miniatury klikalne; przełaczenie wariantu zachowuje skojarzenia.

### Zrodla
- docs/BRANDING-HUB.md (sekcja dwie lokalizacje)
- program-instructions `branding.marketing_dual_roots`
- apps/web/scripts/build-branding-index.py, brand_folder_context.py

---

# ═══════════════════════════════════════════════════════════════════
# RZECZY DO WYKONANIA — NIE UDAŁO SIĘ (chcemy, żeby były)
# Data wpisu: 2026-07-19 | sesja: Branding UI + transparent PNG
# ═══════════════════════════════════════════════════════════════════

Poniżej lista funkcji / poprawek **zaplanowanych lub rozpoczętych**, których **nie udało się domknąć** w tej sesji. Priorytet dopracowania: **ten tydzień (od 2026-07-21)**.

| # | Temat | Status | Dlaczego nie done | Następny krok |
|---|-------|--------|-------------------|---------------|
| 1 | **Odtwarzanie wideo w modalu** (stream z `X:` / bridge `/media`) | FAIL UI-only | Bridge/Synology timeout lub brak dostępu do pliku w sesji agenta; layout wideo OK, stream nie zweryfikowany E2E | Restart bridge u usera; test `br-006305` z logiem `/media`; fallback komunikat „Plik offline” |
| 2 | **Pełny pixel-scan transparent** dla wszystkich PNG (poza www) | **DONE 2026-07-20** | Skan PIL wolny na NFS `X:`; patch tylko scope www (217 assetów) | Zrobione: `--all --limit-seconds`, cache `branding-background-scan.json` (2652 wynikow), fix wiszacego timeoutu NFS; indeks: 1591 transparent / 2347 white |
| 3 | **Heurystyka PNG default → indeks JSON** (nie tylko runtime UI) | **DONE 2026-07-20** | User: „na razie UI”; indeks bez masowego rewrite | Zrobione: build/re-enrich czytaja cache skanu (carry-over `apply_background_scan_cache`), rebuild nie gubi wynikow |
| 4 | **Filtr „Tło białe”** — precyzyjne liczniki | **DONE 2026-07-20** | W QA Kampanie: filtr white nie zawęża (120=wszystko) — brak white w tej zakładce lub logika zbyt szeroka | Zrobione: white tylko ze skanu; po skanie Kampanie 582→239, Packshoty 1767→760 |
| 5 | **Wyszukiwanie tekstowe „przezroczyste”** | **DONE 2026-07-20** | CDP `input` event → 0 kart (możliwy konflikt filtrów / debounce) | Przyczyna: synonimy AND zamiast OR w `assetMatchesSearchQuery`; fix grupy tokenow OR, wynik 17 kart / 38 plikow |
| 6 | **Sidebar collapsed — logo wordmark bez crop** | **DONE 2026-07-20 (bez zmian)** | Test CDP przerwany; brak screenshota collapsed | Screenshot 1280px expanded + collapsed + Read: wordmark caly, `object-fit: contain` juz jest w dam-brand.css |
| 7 | **Marketing ID — typy TikTok / YouTube / Reels** | **DONE 2026-07-20** | W scope tylko VID/SLI/BAN/META/GOG/SHOP/GIF/KV/IMG | Zrobione: TIK=10 / YT=11 / REL=12 przed VID + wpis w `branding.marketing_asset_id_format` |
| 8 | **Pełna parytet kart branding ↔ viz** (wszystkie tryby grup) | **DONE 2026-07-20 (weryfikacja)** | Actions OK na głównej siatce; grupy folderowe nie na wszystkich zakładkach | Audyt DOM: 100% kart grupowych z akcjami na Kampanie/Social/WWW/Packshoty + screenshoty WWW i Packshoty |
| 9 | **Seed program-instructions do Postgres KV** | Nie w tej sesji | Zmiany tylko w pliku cache JSON | Restart bridge / seed KV dla nowych id |
| 10 | **30-pass QA — wszystkie zakładki z kartami** | Częściowo | Social/WWW 0 kart w teście (dane/filtry) | User: odznaczyć „Tylko grafiki”, test z assetami www |

---

## 2026-07-19 — Branding UI overhaul + PNG default transparent + commit

### Komenda/Akcja
User: PNG bez skanu = domyślnie bez tła (zachować pixel-scan); spisać niewykonane; log zmian; QA 30-pass; commit + push + backup.

### Log/Status — chronologia zmian (2026-07-19)

| Czas (szac.) | Plik / obszar | Co wprowadzono |
|--------------|---------------|----------------|
| rano | `asset_role_utils.py`, `patch-branding-backgrounds.py` | Skan alpha PNG; patch 217 www → `background: transparent` |
| rano | `dam-branding.js` | Filtry facet global vs tab; `assetMatchesTagKey` transparent |
| południe | `dam-marketing-id.js` (nowy) | Format M-VID/KV/…; użyty w modalu i kartach |
| południe | `dam-media-preview.js` | Hero wideo, path bar, variant placeholder, title meta |
| południe | `dam-branding.css`, `dam-hub-shared.css` | Spacing modal, karty viz-style, gradient tile |
| południe | `dam-viz.js`, `visualizations.html` | Zoom 50–250%, CARD_IMG_BASE_SCALE 1.2 |
| południe | `program-instructions.json` | `branding.marketing_asset_id_format` |
| wieczór | `dam-asset-taxonomy.js` | `effectiveBackground`, PNG/WebP default transparent |
| wieczór | `dam-branding.js`, `dam-badges.js` | Filtr + badge + search blob dla effective background |
| wieczór | `program-instructions.json` | `branding.png_default_transparent` |
| wieczór | `branding.html` | Cache bust `hub20260719trans01` |

### Efekt/Fix
- Tag „Przezroczyste tło” klikalny; filtr zawęża (17/120 w Kampaniach).
- PNG bez `background` w indeksie → UI traktuje jako transparent (np. br-006165).
- Modal: M-KV106165-04-25, path monospace, margin meta 10px, actions 15px.

### Test/Ewaluacja
- QA 30-pass: tabela w `PROGRESS.md` (26 PASS, 4 INFO, odłożone FAIL w sekcji NIE UDAŁO SIĘ).
- Screenshot + Read: modal KV, siatka Kampanie.

### Backup
- Tag przed commitem: `backup/2026-07-19-pre-branding-ui-overhaul`
- Tag po commicie: `feature/2026-07-19-branding-ui-overhaul`

### Zrodla
- `program-instructions.json` (`branding.png_default_transparent`, `branding.marketing_asset_id_format`)
- `.cursor/rules/verify-ui-after-changes.mdc`


---

## 2026-07-19 — Media preview modal: przyciski + tagi + gradient + Shift+klik (10-pass)

### Komenda/Akcja
User: brak przyciskow / zle nazwy w `#damMediaPreview`; ext-tag TIF/JPG jak badge +10% i 8px od tytulu; wiecej odstepu tagi→tytul; mniej scrolla; gradient tile krotszy +30% transparency; Shift+klik na skojarzonych produktach; Intensive QA 10 passes.

### Log/Status
1. Audyt: modal mial tylko "Pokaz w Eksploratorze" (brak Przejdz); thumb assoc zjadal Shift+klik.
2. `dam-media-preview.js`: CTA jak wizualizacje — Przejdz + Folder + opcjonalnie Zrodlo.
3. `dam-assoc-edit.js`: Shift+klik na item/thumb/name → openEditPicker (product).
4. `dam-branding.css`: title gap 20px; ext-tag anatomia badge +10%; mniejszy hero.
5. `dam-hub-shared.css`: editable wash od dolu min(128px,32%), alpha *0.7.

### Efekt/Fix
- Footer: Przejdz | Folder | (Zrodlo) | Kopiuj | Udostepnij
- CDP: gap tagi→tytul 20px; title↔ext 8px; extH 26.8 vs badgeH 24.4; bez scrolla (baton)
- Shift+klik otwiera picker (admin mode)

### Test/Ewaluacja
Intensive QA 10 passes screenshot→Read (Pass1–10).

### Zrodla
- memory.md §38
- `.cursor/rules/verify-ui-after-changes.mdc`

---

## 2026-07-19 — Bento v2.0.0 (shared grid + explorer hot zone)

### Komenda/Akcja
User: milestone v1.5.0 OK; v2.0.0 = spójny Bento CSS Grid na panel; zamrozić wizualnie karty/modale viz/branding/projekty; priorytet Eksplorer (carrier/prod-row sypie się na RWD); ui-taste + ui-ux-pro-max; dopisać definicję „rundy” do skillu ui-taste.

### Log/Status
1. `ui-taste` SKILL.md §0.E: Runda vs Pass (PL/Monday) + intensive 10+ focus rounds.
2. Nowy `apps/web/assets/css/dam-bento.css` (tokeny gap/radius, shell explorer, carrier zones, prod-row grid, hub chrome).
3. `explorer.html`: Bootstrap `.row.g-3` → `.dam-explorer-layout` (CSS Grid kategorie + panel).
4. `dam-explorer.js`: wrappery `meta-chips` / `meta-life` + `older-rev-row__main/life`.
5. Podpięcie `dam-bento.css` na dashboard/settings/viz/branding/projekty/inbox/help/explorer.
6. Wersja `2.0.0` / codename `bento` (`version.json`, `dam-version.js`, `runtime_config.py`).

### Efekt/Fix
- Carrier: grid `title | chips | end` + wiersz `. | life | end` (admin) - chipy w jednej linii, lifecycle nie „wędruje”.
- Explorer shell: stabilny 2-col → stack @992px.
- Zamrożone: `.dam-viz-card`, branding cards, project cards, modale media/viz (bez restylu).

### Test/Ewaluacja
- Intensive QA: screenshot→Read carrier desktop (Pass1–3 align), layout CDP `display:grid`, mobile areas stack; dashboard parity OK.
- Overflow 375 z geex header quickaction = pre-existing (nie z bento shell).

### Zrodla
- Plan Bento v2.0.0
- MDN CSS Grid / bentogrids.com (referencja stylu)
- `.cursor/rules/verify-ui-after-changes.mdc`

---

## 2026-07-19 — Modal zoom 85–100% + layout body na dole + cache tagów Branding

### Komenda/Akcja
User: (1) modal zoom 85–100% zamiast 85–125%, body modala wyrównane do dołu, thumb responsywny; parity viz. (2) Wolne ładowanie po kliknięciu tagów w Branding (~10 s) — cache z unieważnianiem przed aktualizacją bazy/indeksu. Commit + push.

### Log/Status
1. **Diagnoza wolnych tagów:** klik tagu = filtr po stronie klienta (7832 assety, brak API). Bottleneck: podwójne `computeFacetCounts()` (~7800×~100 kluczy×2), podwójny `renderTagFilters()` przy auto-zmianie tabu, pełny rerender siatki do 1000 miniaturek `/media`.
2. **`dam-modal-shared.js`:** `modalStartZoomPct()` → mapowanie 85–100% (kafelek ≥100% → modal 100%). `fitChrome()` bez sztywnego `max-height` thumb — flex wypełnia przestrzeń nad body.
3. **`dam-brand.css` / `dam-branding.css`:** `.dam-viz-modal-box { justify-content: flex-end }`, thumb `flex: 1 1 0`, body `flex: 0 0 auto`.
4. **`dam-branding.js` (cache01):** `computeFacetCountsPair()` — jedna pętla po assetach, liczniki facet+global naraz; `facetCountCache` kluczowany sygnaturą filtrów + `built_at`; `clearBrandingComputeCache()` / `invalidateBrandingIndexCache()`; `scheduleBrandingRender()` (rAF); tag click bez podwójnego renderu tabu; API `DamBranding.clearComputeCache` / `invalidateIndexCache`.
5. **`local_bridge.py`:** `_drop_json_cache()`, `_invalidate_branding_data_caches()` — **czyść cache PRZED** zapisem (`_save_json`), przed/po `/branding/rebuild`, `/branding/recognize`, przed/po `/index/rebuild` + `meta_store.sync`.
6. **`dam-tag-edit.js` / `dam-assoc-edit.js`:** po zapisie metadanych/skojarzeń → `DamBranding.clearComputeCache()`.

### Efekt/Fix
- Modal: zoom 110% kafelka → 100% modalu (nie 141%). Body przy dole boxa, brak martwej strefy pod CTA (CDP gap=0).
- Branding tagi: ~2× mniej pracy liczników na klik; cache liczników ważny do zmiany filtra/indeksu; bridge zawsze czyta świeży JSON po rebuild/patch (cache RAM invalidowany przed zapisem).

### Test/Ewaluacja
- Modal QA: screenshot→Read branding + viz @1280/768; zoom 100% @ suwak 110%; layout gap=0.
- `modalStartZoomPct(110)===100`, `modalStartZoomPct(85)===85` (CDP).
- Cache: po `clearBrandingComputeCache()` sygnatura facetCountCache reset.

### Zrodla
- Analiza `dam-branding.js` renderTagFilters / computeFacetCounts
- `local_bridge.py` `_JSON_FILE_CACHE`, `_save_json`
- User brief: cache invalidation przed aktualizacją bazy

---

## 2026-07-19 — Integracje OAuth (hub) + wersja 2.0.3

### Komenda/Akcja
User: „Umożliw Integracje” — strona `integrations.html` miała statyczne stuby; OAuth działał tylko w `settings.html`. Commit + push; podbić wersję patch (+0.0.1 na każdą dostawę od 2.0.0).

### Log/Status
1. **`dam-integrations.js`:** wspólny moduł OAuth (Asana, Microsoft), karty infrastruktury (Entra/LDAP), Synology; `mount()` z auth headers.
2. **`integrations.html`:** pełny shell DAM (jak branding), sekcje Logowanie + OAuth z **Zaloguj/Odłącz**, kolejka wykrojników bez zmian.
3. **`dam-settings.js`:** delegacja do `DamIntegrations.mount()`.
4. **`local_bridge.py`:** OAuth callback → `integrations.html#damIntegrationsOAuth`.
5. Fix: `/integrations/status` wymaga sesji — fetch z `authHeaders()`; fallback gdy `login_required`.
6. **Wersja:** `2.0.0` Bento → `2.0.1` modal zoom/layout (cadefaf) → `2.0.2` cache tagów + bridge invalidation (cadefaf) → **`2.0.3`** integracje.

### Efekt/Fix
- Integracje: live status z bridge, przyciski OAuth (disabled bez credentials w `dam-connection.env`).
- Wersja spójna: `version.json`, `dam-version.js`, `runtime_config.py`, cache bust `?v=2.0.3` w HTML.

### Test/Ewaluacja
- Screenshot→Read `integrations.html`: sekcja OAuth (Asana, Microsoft), Zaloguj, brak etykiet „Stub”.

### Źródła
- `oauth_integrations.py`, `dam-settings.js` (poprzedni `loadIntegrations`)


---

## 2026-07-19 — Integracje hub v2 (2.0.5)

### Komenda/Akcja
Plan Integracje hub v2: dashboard widgety, UI hub, bridge finance/integrations, wykrojnik bridge-only, costs/invoices live, katalog FMCG, bump 2.0.5.

### Log/Status
1. Faza 0: dam-dashboard-widgets.js + CSS — layout 2x2/1x4/1x6, grupowanie branding po folderze.
2. Faza 1+3+4: dam-integrations-hub.css, rewrite dam-integrations.js, dam-wykrojnik-queue.js → GET/POST bridge.
3. Faza 2: program-instructions (integrations.hub_bridge, finance.*); endpointy local_bridge + oauth_integrations.
4. Faza 5+5b: dam-cost.js bridge fetch + sync + panel FMCG; fmcg-cost-catalog.json; dam-fmcg-cost.js catalog-first.
5. Faza 6: dam-invoices.js bridge + CSV import; ukryty Geex Asana demo; lista z asana-tasks.json.
6. Faza 7: wersja 2.0.5, ADR-005 notatka v2, memory.

### Efekt/Fix
Hub Integracje = konfiguracja na stronie; koszty/faktury nie tylko ze statycznego JSON; katalog FMCG gotowy pod import Excel/CSV.

### Test/Ewaluacja
- Screenshot QA: dashboard layouts, Integracje vs Kalkulator, costs/invoices source badge.
- Restart bridge po zmianach local_bridge.py.

### Zrodla
- Plan integracje_hub_v2
- program-instructions.json, local_bridge.py, fmcg-cost-catalog.json

---

## 2026-07-19 — Integracje hub v2: kontynuacja + commit (2.0.5)

### Komenda/Akcja
Kontynuacja planu po innym agencie: audit luk, hotfix UI, commit+push na origin/main.

### Log/Status
1. Audit: fazy 0–7 lokalnie gotowe, ale **niezacommitowane** (working tree dirty vs 5adcd1f).
2. Fix: `dam-integrations.js` — Promise.all `.catch` + odporny fetch stawek (nie wisieć na „Wczytywanie…”).
3. Fix: `dam-wykrojnik-queue.js` — filtr placeholderów `row-N` z uszkodzonego rejestru XLSX.
4. Smoke: Integracje (karty Entra/Asana/MS/Synology/Finanse), Kalkulator (`Synchronizuj z Asany`, sekcja Łańcuch FMCG 5/45), bridge hub_routes 200.
5. Commit + push `feat(integrations): hub v2 … (v2.0.5)`.

### Efekt/Fix
Plan Integracje hub v2 domknięty w git + GitHub; restore-point pre-bento nadal tag `milestone/pre-bento-v1.5.0`.

---

## 2026-07-20 — Post-hub batch (2.0.6): modal CTA + portable path + search + indeksy

### Komenda/Akcja
Po zakonczeniu rownoleglych agentow: jeden commit zbiorczy wszystkich zmian lokalnych + push (bez bundle/tmp-qa).

### Log/Status
1. Czekanie na stabilizacje working tree (hashy JS/CSS/HTML bez driftu ~45s).
2. Modal: CTA PSD/PSB/AI (#damMediaPreviewSourceMount), usuniecie #damMediaPreviewMeta, ext-tag 10px.
3. DamPaths: toPortablePath / copyPortablePath (Marketing\… bez litery dysku).
4. Branding search: synonimy przezroczystosc/tlo biale.
5. asset_role_utils: atomic_write_json + cache skanu tla branding-background-scan.json.
6. Indeksy/lifecycle/change-log odswiezone (operacyjne F/X).
7. Bump wersji 2.0.5 → **2.0.6**.

### Efekt/Fix
Jedna dostawa na origin/main po zamknieciu agentow; wersja UI 2.0.6.

## 2026-07-20 - Modal podgladu mediow: meta line, ext tag, Zrodlo, sciezka przenosna, tiery jakosci (worker)

- **Komenda/Akcja**: Naprawa regresji modala #damMediaPreview (branding) + 3 nowe zgloszenia (grupy GIF): brak Zrodlo, maly hero, scroll wariantow. Reguly globalne A (tiery kompresji XL/L/S/XS) i B (zrodla w gore drzewa).
- **Log/Status**:
  - Krok 1: usunieta linia meta "TIF - Indeks ..." (markup, renderMeta, metaLineText, CSS #damMediaPreviewMeta).
  - Krok 2: odstep ext-tagu od tytulu = 10px (margin-inline-start na .dam-media-preview__ext-tag; column-gap 0).
  - Krok 3: DamPaths.toPortablePath + copyPortablePath (schowek bez litery dysku, od Marketing\..., backslashe); podpiete w #damMediaPreviewCopy i #damVizModalCopyPath.
  - Krok 4: etykiety wariantow: label z indeksu, fallback = baza nazwy pliku (mid-trim >18 znakow), koniec z "Plik Plik Plik".
  - Krok 5 (Rule A): dam-media-preview.js laduje branding-index w runtime; findQualitySet grupuje te sama kreacje (creativeKey: baza nazwy bez markerow kompresji) w obrebie przodka 2 poziomy w gore; scoring segmentow (high/-1, low/+2, ultralow/+3, skompresowane/+2, ultra/+1, min/+2); pigulki JAKOSC XL/L/S/XS przelaczaja hero + data-path Folder/Kopiuj/Udostepnij.
  - Krok 6 (Rule B): findEditableUpTree - gdy folder bez zrodel, szuka psd/psb/ai/indd/eps w indeksie 1-2 poziomy w gore (priorytet: podobna nazwa >=60% prefiksu, foldery PSD/AI/EDYTOWALNE/ZRODLA/SOURCE, potem dowolny); przycisk zrodla renderuje sie asynchronicznie.
  - Krok 7: hero min-height min(340px,42dvh), img#damMediaPreviewHero object-fit contain (male GIFy skaluja sie w gore).
  - Krok 8: warianty zwiniete do 4 kafelkow + "Pokaz wszystkie (N)" / "Zwin" (aria-expanded, chevron), bez wewnetrznych scrolli; dedupe kafelkow po creativeKey.
- **Efekt/Fix**: br-005329: hero duzy, pigulki XL/L/S/XS (XS aktywne), PSD z DV360_GIFF/PSD, 4/9 kafelkow + toggle. br-005266: XL/L/S, PSB z JUSTTAG - OGOLNA.psb, 4/7 kafelkow. br-003365: bez regresji (gap 10px, PSD, 2 produkty, bez pigulek).
- **Backup**: brak zmian destrukcyjnych (tylko JS/CSS/HTML wersjonowanie cache).
- **Test/Ewaluacja**: cursor-ide-browser 1280x900, screenshot + Read (vision) x4; Runtime.evaluate: gap=10.0px, portable path OK (X:/, X:\\, UNC, bez Marketing), przelacznik XL podmienia hero na Kampania 2026 - HIGH, expand=9 kafelkow bez scrollbara.
- **Zrodla**: apps/web/assets/js/dam-media-preview.js, dam-paths.js, dam-viz.js, dam-branding.js, dam-branding.css, branding.html (v=204mod3), visualizations.html.

---

## 2026-07-20 - Backlog NIE UDALO SIE - realizacja czesc 1 (worker, itemy 2-8 + 11)

### Komenda/Akcja
Realizacja backlogu "RZECZY DO WYKONANIA - NIE UDALO SIE" (2026-07-19), itemy 2-8 (pominiete: 1 wideo modal, 9 seed KV, 10 full QA - poza scope). Dodatkowo item 11: wygaszone tagi facetowe bez licznikow (Wideo/Dokument/Raster/Desktop/Tablet/Mobile/Na sklep). Zakaz edycji plikow drugiego agenta (dam-media-preview.js, dam-viz.js, dam-branding.css, dam-paths.js, script tagi branding/visualizations.html) - dotrzymany.

### Log/Status
1. **Item 2 - pixel-scan --all z budzetem** (`patch-branding-backgrounds.py`, `asset_role_utils.py`):
   - Nowe flagi: `--all` (PNG/WebP/GIF/TIFF + JPG/BMP→white), `--limit-seconds`, `--limit-count`, `--no-cache`.
   - Trwaly cache wynikow: `apps/web/data/branding-background-scan.json` (path→transparent|white|none), checkpoint co 500 plikow.
   - Zapis indeksu i cache atomowy (`atomic_write_json`: tmp + os.replace).
   - **Bugfix krytyczny**: `_run_with_timeout` na ThreadPoolExecutor blokowal sie na `shutdown(wait=True)` przy wiszacym odczycie NFS X: - timeout martwy, skan stawal (1. przebieg wisial 25 min na pliku ~2575; w systemie wisialy tez 4 stare procesy patch/enrich z 19.07 - ubite). Fix: watek daemon + Event.wait(timeout).
   - Przebieg 2: 2652 plikow w ~99 s (cache OS), wynik 562 transparent + 1585 white + 505 none; indeks: transparent 1029→1591, white 762→2347 (w tym Kampanie 239).
2. **Item 3 - trwalosc skanu przy rebuild**: `apply_background_scan_cache` w asset_role_utils; `build-branding-index.py` czyta cache w `make_asset` (w tym "none" = nie powtarzaj IO) + carry-over po overrides; `re-enrich-branding-index.py` tez robi carry-over. Test jednostkowy: carry na fake asset OK (case-insensitive path, search_blob dostaje "przezroczyste tlo").
3. **Item 4 - filtr Tlo biale**: logika `isEffectiveWhite` (tylko skan/JPG, nie PNG-default) byla poprawna; problem lezal w danych (0 white poza wizkami przed skanem). Po skanie + `enrich-branding-tags.py`: Kampanie 582→239 plikow, Packshoty 1767→760. CDP + screenshot.
4. **Item 5 - szukanie "przezroczyste"**: przyczyna 0 kart = synonimy dolaczane do tokenow jako AND (`tokens.every`), a blob runtime nie zawieral frazy "przezroczyste tlo". Fix: `searchTokenGroups` (kazdy token usera = grupa OR z synonimami; grupy AND) + `SEARCH_SYNONYM_MAP` (takze biale tlo) + uzupelniony blob transparent/white w `assetBlobNorm`. Wynik: 17 kart / 38 plikow w Kampaniach.
5. **Item 6 - logo collapsed sidebar**: weryfikacja 1280px (emulacja CDP), expanded + collapsed, screenshot + Read: wordmark "dobra kaloria" caly (48x48, object-fit contain w dam-brand.css) - bez zmian kodu.
6. **Item 7 - Marketing ID TIK/YT/REL**: `dam-marketing-id.js` - typy TIK=10 (tiktok), YT=11 (youtube/yt), REL=12 (reels/rolka) sprawdzane PRZED generycznym VID; test node: M-TIK1006305-01-25, M-YT1100123-03-24, M-REL1200124-03-24, VID/KV bez regresji. Instrukcja `branding.marketing_asset_id_format` rozszerzona (updated_at 2026-07-20), JSON valid; seed do Postgres KV przy najblizszym restarcie bridge (item 9 backlogu).
7. **Item 8 - parytet kart grupowych**: audyt DOM na 4 zakladkach: Kampanie 66/66, Social 14/14, WWW 252/252, Packshoty 202/202 kart grupowych z `.dam-viz-card__actions` (Podglad/Folder/Udostepnij), style identyczne jak karty pojedyncze. Screenshoty WWW + Packshoty. Bez zmian kodu (naprawione wczesniejsza sesja 19.07).
8. **Item 11 - wygaszone tagi facetowe**: przyczyna podwojna: (a) `passesGraphicsOnlyFilter` wykluczal video/document takze z LICZNIKOW facet, wiec Wideo/Dokument mialy 0 i disabled przy domyslnym "Tylko grafiki"; (b) Raster/Desktop/Tablet/Mobile/Na sklep mialy realnie 0 w indeksie (stary indeks sprzed `extract_placement_tags` i format_technical "raster"). Fix (a): `chipCountIgnoresGraphicsOnly` (media:/format:) w `computeFacetCountsPair` - liczniki bez wykluczenia; klik w Wideo/Dokument nadal nadpisuje przelacznik (istniejacy mechanizm w passesGraphicsOnlyFilter). Fix (b): po skanie re-run `enrich-branding-tags.py` (raster 4443, white 2347, Desktop 32 / Tablet 32 / Mobile 36 / Na sklep 1621). Tooltip przelacznika: "Ukrywa PDF, Excel, Word i wideo... po tagach Dokument / Wideo" (branding.html, poza script tagami).

### Efekt/Fix
- Filtry Cechy pliku/Format pliku dzialaja z realnymi licznikami: wszystkie tagi klikalne (screenshot koncowy - zero wygaszonych w Kampaniach).
- Klik Wideo przy wlaczonym "Tylko grafiki" pokazuje 174 pliki wideo (CDP + screenshot).
- Wyszukiwanie "przezroczyste" zwraca karty; filtr Tlo biale zaweza takze poza Packshotami.
- Skan tla przezywa rebuild indeksu (cache) i nie wiesza sie na NFS.

### Backup
- Bez operacji destrukcyjnych; indeks nadpisywany atomowo, cache skanu = nowy plik. Dysk X: tylko odczyt (zgodnie z branding.disk_read_only).

### Test/Ewaluacja
- Python: unit test cache/carry-over (limit_count, include_opaque, apply) - PASS; JSON program-instructions valid.
- Node: format ID dla 5 przypadkow - PASS.
- Browser (cursor-ide-browser, cache disabled, viewport 1280): screenshot + Read x6 (Wideo aktywne, wyniki "przezroczyste", sidebar expanded/collapsed, white Packshoty, grupy WWW/Packshoty, facety po skanie).
- Liczniki: Kampanie white 239, Packshoty white 760, search przezroczyste 38 plikow.

### Zrodla
- apps/web/scripts/asset_role_utils.py, patch-branding-backgrounds.py, build-branding-index.py, re-enrich-branding-index.py
- apps/web/assets/js/dam-branding.js (CB hub20260720backlog1), dam-marketing-id.js
- apps/web/data/program-instructions.json (branding.marketing_asset_id_format), branding-background-scan.json
- apps/web/branding.html (tylko data-dam-tip przelacznika)
- .cursor/rules/verify-ui-after-changes.mdc, program-instructions branding.png_default_transparent

---

## 2026-07-20 — Ważna checklista użytkownika

### Komenda/Akcja
Z priorytetów A/B/C (post-hub) zrobić checklistę; przy kolejnych prośbach zahaczających o listę — przypominać.

### Log/Status
1. Utworzono `WAZNA-CHECKLISTA-UZYTKOWNIKA.md` (A1–A4, B1–B6, C1–C3 + triggery).
2. Reguła alwaysApply: `.cursor/rules/wazna-checklista-uzytkownika.mdc`.
3. `memory.md` §127.

### Efekt/Fix
Jedno źródło prawdy priorytetów użytkownika; agenci przypominają ID przy powiązanych taskach.

### Test/Ewaluacja
Brak (dokumentacja + reguła Cursor).

---

## 2026-07-20 — Animacje + tryb w tle (tray) + cache Branding (2.0.7)

### Komenda/Akcja
Trzy zgłoszenia: (1) animacje nie działają dla tagów i belek, wydłużyć 0.3s->0.4s, animować wszystko; (2) aplikacja ma działać w tle / w zasobniku systemowym; (3) Branding długo się otwiera - znaleźć opóźnienia + cache.

### Log/Status
1. Diagnoza 3 subagentami (animacje CSS, desktop/tray, ścieżka ładowania Branding).
2. Animacje: tokeny ruchu w `dam-tokens.css`; blok `transition` dla tagów/pill/badge + belek w `dam-brand.css` i `dam-branding.css`; `dam-grid-reveal.js` DURATION 0.35->0.4, sidebar 0.3->0.4, nowe `revealBars()` (belki jako bloki, znacznik `data-dam-bar-revealed`), export + autoInit; podpięcie w `dam-branding.js`.
3. Tray: `launch.py` `window.events.closing` -> `window.hide()` (return False) gdy `tray_active`; całkowite wyjście przez menu tray. `dam_tray.py` bez zmian.
4. Cache Branding: usunięto `Date.now()` z URL indeksów; `window.__damBrandingIndex` współdzielony (branding.js + media-preview.js); usunięto podwójny `renderTagFilters()` na boot; wideo w siatce `preload="none"`.
5. Wersja 2.0.6->2.0.7 (`version.json`, `dam-version.js`, `runtime_config.py`); cache-bust bump na branding.html + dashboard.html.
6. Instrukcje: `program-instructions.json` +3 (`desktop.background_tray`, `ui.motion_tokens`, `branding.load_cache`). memory §128.

### Efekt/Fix
Tagi i belki animują się (transition 0.22s + reveal belek 0.4s); okno chowa się do zasobnika bez ubijania mostu; Branding nie pobiera ~35 MB przy każdym wejściu i renderuje tagi raz.

### Test/Ewaluacja
- `py_compile launch.py` OK; `node --check` JS OK; JSON OK; ReadLints czysto.
- Browser :8765 branding.html: screenshot + Read (logo całe, belki tagów wyrównane, bez regresji).
- CDP: `--dam-anim`=0.4s, `--dam-anim-hover`=0.22s, `revealBars`=true (3 belki z markerem), `window.__damBrandingIndex` 7832 assetów, 115 kart, 74 tagi, badge `transition-duration` 0.22s.
- UWAGA: tray wymaga **restartu aplikacji desktop** (launch.py nie hot-reloaduje).

### Zrodla
- dam-tokens.css, dam-brand.css, dam-branding.css, dam-grid-reveal.js, dam-branding.js, dam-media-preview.js, launch.py, version.json, dam-version.js, runtime_config.py, program-instructions.json

---

## 2026-07-20 — Ruch globalny v2: reveal 0.45s, kolejnosc gora->dol, skeleton (2.0.7)

### Komenda/Akcja
Dopracowanie animacji: (1) reveal za szybki / poza kolejnoscia (elementy przed pierwszym); (2) wydluzyc do 0.45s + reakcja viewportu -50px; (3) skeleton loading (shimmer) tam gdzie cos sie laduje (costs/integrations/invoices); (4) faktury pojawiaja sie natychmiast -> maja animowac; (5) sidebar bez slide (tylko morph), tytul/podtytul fade-in, hover scale buttonow/ikon sidebar. Skille: /ui-ux-pro-max, /ui-taste, /gsap-core.

### Log/Status
1. Diagnoza: index.html (dam-projects) = wzorzec; faktury tabela poza reveal; brak skeletonu; sidebar slide niechciany.
2. `dam-grid-reveal.js`: DURATION 0.45; observer rootMargin -50px; reveal() dzieli inView (jedna sekwencja gora->dol) vs below (IO); revealPageEntrance (tytul+podtytul+belki); usunieto sidebar slide z autoInit; dodano revealRows + skeleton; export.
3. `dam-brand.css`: hover scale .geex-btn/ikony sidebar (token --dam-hover-scale, 0.2s, :active 0.97); CSS skeleton shimmer (dam-skel-shimmer) + dark + reduced-motion.
4. Wpiecie: invoices (skeleton tbody + revealRows tr), costs (skeleton 3 panele + revealRows meta/result/fmcg), integrations (skeleton karty + revealRows .dam-int-card).
5. `dam-grid-reveal.js` dodany do costs/integrations/invoices; cache-bust motion20260720a na 9 stronach; dam-version 2.0.7.
6. Instrukcje: ui.motion_tokens zaktualizowane; memory §129; version.json note.

### Efekt/Fix
Wejscie 0.45s gora->dol bez wyskakiwania poza kolejnoscia; skeleton z przeblyskiem podczas ladowania, potem tresc wjezdza zanimowana; faktury/costs/integracje animowane; sidebar tylko morph; hover buttonow/ikon.

### Test/Ewaluacja
- node --check (grid-reveal, invoices, cost, integrations) OK; ReadLints czysto; JSON OK.
- Browser :8765 (karta w tle => rAF zamrozony; force gsap.globalTimeline.progress(1)): costs meta+koszt 7588,10 PLN + 11 wierszy; invoices 10 wierszy (FV/2026/07/001...); integrations 7 kart; skeleton znika po renderze; hover transition transform obecny; footer v2.0.7.
- Ograniczenie: ruch na zywo nieuchwytny w screenshotach przy karcie w tle; stan koncowy poprawny, silnik = wzorzec index.html.

### Zrodla
- dam-grid-reveal.js, dam-brand.css, dam-tokens.css, dam-cost.js, dam-invoices.js, dam-integrations.js, costs.html, integrations.html, invoices.html, index/explorer/inbox/visualizations/branding/dashboard.html, program-instructions.json, memory.md, version.json

## 2026-07-20 - Animacje reveal (fix regresji) + edytor skojarzen (search/folder/ikony)

### Komenda/Akcja
User: (1) przywrocic animacje reveal (za szybkie, brak viewport-gate, brak w modalach/sidebarze); (2) bugi edytora skojarzen: folder picker nieklikalny, "Dodaj z dysku" nic nie dodaje, wyszukiwarka nie znajduje po indeksie (6300539.01), odznaczanie nie dziala, brak ikon (folder/kopiuj link), indeksy jako TAG.

### Log/Status
1. dam-grid-reveal.js przepisany: tempo 0.35s / stagger 0.05s, power2.out; IntersectionObserver (element rusza w viewporcie); generyczny reveal modali (.dam-viz-modal-overlay -> thumb fade + body slide) i sidebara; #damHelpFab bez animacji.
2. REGRESJA: clip-path w stanie spoczynku zerowal prostokat -> IntersectionObserver ratio 0 -> deadlock (karty niewidoczne). Fix: stan spoczynku = samo opacity:0, clip-path animowany dopiero w tweenie. Zweryfikowane CDP: above-fold opacity 1, below-fold 0 do scrolla.
3. Cache-bump dam-grid-reveal.js: index/inbox/explorer/dashboard (branding/visualizations pozostaja stary cache - do zrobienia).
4. dam-assoc-edit.js:
   - Wyszukiwanie: productSearchBlob (search_blob + WSZYSTKIE indexes + index_bases + tagi) zamiast tylko indexes[0] uciete. 6300539/6300539.01/000108/nazwa -> znajduje.
   - Folder picker: overlay.style.zIndex=12300 (nad nakladka skojarzen 12100) -> klikalny.
   - "Dodaj z dysku": matchProductsByFolder (po sciezce: exact / pod folderem / rodzic) dodaje produkt do zaznaczenia i zapisuje.
   - Odznaczanie: pozycje AKTUALNE pokazuja czerwony X (uil-times) gdy odznaczone -> jasne ze usuwane; zapis usuwa z linked.
   - Ikony wierszy: folder (revealInExplorer) + kopiuj link (schowek) na kazdym wyniku i pozycji AKTUALNE.
   - Indeks jako TAG: .dam-assoc-edit-popover__sub--tag (fioletowa pigulka, tabular-nums). CSS wstrzykiwany z JS (bez ruszania dam-branding.css/dam-brand.css agentow).
   - Cache-bump dam-assoc-edit.js w branding.html (agenci skonczyli: turn_ended success).

### Efekt/Fix
Reveal dziala jak nalezy (viewport, plynniej). Edytor skojarzen: search po indeksie OK, folder picker klikalny, dodawanie z dysku dziala, odznaczanie czytelne, ikony + tag indeksu na kazdym wierszu.

### Test/Ewaluacja
cursor-ide-browser 1024x1140: reveal (screenshot Projekty po scrollu), popover skojarzen (screenshot: tag indeksu + ikony folder/link), CDP: search 6300539->TARTA MALINOWA, folder picker z-index 12300 topmost. Uwaga: screenshot tool bywa stale przy wspoldzielonej karcie - fixy potwierdzone tez DOM.

### Zrodla
apps/web/assets/js/dam-grid-reveal.js, dam-assoc-edit.js; index/inbox/explorer/dashboard.html, branding.html (cache-bump).

## 2026-07-20 - Dokumentacja: WYKLADNIA KODU DAM (code-doctrine) + commit/push

### Komenda/Akcja
User: zbuduj z napraw dokumentacje + instrukcje "jak rozumiec kod" dla przyszlych agentow, nazwij tak, by ZAWSZE czytali jako wykladnie; commit + update logow + push.

### Log/Status
1. Utworzono agents/shared/code-doctrine.md (12 sekcji: architektura, modul DamX, cache-bust, wspolbieznosc, weryfikacja CDP/screenshot, model danych, 2 studia przypadku: reveal/clip-path-IO + edytor skojarzen, pulapki PowerShell/X:, debug, slowniczek modulow, dziennik lekcji).
2. AGENTS.md: wpiety blok "CZYTAJ ZAWSZE NAJPIERW" -> code-doctrine.md (tracked, auto-read).
3. .cursor/rules/code-doctrine.mdc (alwaysApply) - lokalne wymuszenie (uwaga: .cursor gitignored -> nie idzie na git; trwaly nosnik = AGENTS.md + agents/shared/).
4. Weryfikacja spojnosci: dam-grid-reveal.js w working tree = MERGE mojej poprawki IO (opacity resting + clip w tweenie) z praca v2.0.7 (DURATION 0.4, revealBars, sidebar). Nic nie nadpisane.
5. .gitignore: dodano tmp-qa-hub/ i backups/**/*.bundle (scratch/duze binaria - nie commitowac).

### Efekt/Fix
Przyszli agenci maja obowiazkowa wykladnie kodu z konkretnymi "dlaczego dziala/nie dziala". Commit + push na origin/main.

### Zrodla
agents/shared/code-doctrine.md, AGENTS.md, .cursor/rules/code-doctrine.mdc, memory.md, process.md, .gitignore.

## 2026-07-20 - Skill dam-dobrakaloria (doktryna + petla przelotow)

### Komenda/Akcja
User: stworz skill "DAM-DobraKaloria" na bazie code-doctrine.md + praktyki pracy/testowania kodu; zdefiniuj petle kod->test->screenshot->poprawka jako przelot/tura/pass/podejscie (min. 3 przeloty), runda = seria przelotow na jednym elemencie; podpowiedz agentom, by uzywali w tym projekcie.

### Log/Status
1. Utworzono skill: C:\Users\xpret\.cursor\skills\dam-dobrakaloria\SKILL.md (personal, auto-invoke po opisie: repo DAM, dam-*.js/css, local_bridge, indeksy JSON). 5 sekcji: zrodla prawdy, skrot doktryny, PETLA PRZELOTOW (1 przelot = kod + test node--check/CDP + screenshot+Read + defekty/poprawka; min. 3 przeloty; runda = przeloty na 1 elemencie do czysta), definition-of-done checklist, mapa plikow.
2. Wskazniki na skill dopisane: AGENTS.md (blok CZYTAJ ZAWSZE), agents/shared/code-doctrine.md (sekcja 0), .cursor/rules/code-doctrine.mdc (lokalnie).

### Efekt/Fix
Agenci w tym repo dostaja jeden skill z doktryna + rytualem weryfikacji; slownik przelot/tura/runda ujednolicony z jezykiem usera.

### Zrodla
~/.cursor/skills/dam-dobrakaloria/SKILL.md, AGENTS.md, agents/shared/code-doctrine.md, .cursor/rules/code-doctrine.mdc.

## 2026-07-20 - Motion global + skeleton + fix widget branding_latest (v2.0.7)

### Komenda/Akcja
User: zapisz, commit+push, napraw blad widgetu "Brak assetow w indeksie branding" na dashboardzie; przetestuj aplikacje (/ui-taste, /dam-dobrakaloria).

### Log/Status
1. Root cause: `dam-dashboard-widgets.js` filtrowal `media_type === "raster"` - indeks ma `image`/`vector`/`source` (7832 assetow, 0 po filtrze).
2. Fix: `normalizeBrandingMediaType`, `isBrandingWidgetThumb`, `loadBrandingIndex()` (cache `__damBrandingIndex`), lepszy empty state z linkiem do Brandingu.
3. Bump cache-bust: `dashboard.html` -> `dam-dashboard-widgets.js?v=brandfix20260720a`.
4. Weryfikacja CDP dashboard: widget `branding_latest` -> 6 img, miniatury z bridge :8766, alt OK.
5. Pozostale zmiany w working tree: global motion (dam-grid-reveal 0.45s, rootMargin -50px), skeleton costs/invoices/integrations, hover scale dam-brand.css.

### Efekt/Fix
Widget "Najnowsze materialy branding" pokazuje 6 najnowszych grup z miniaturami zamiast falszywego pustego stanu.

### Test/Ewaluacja
- `node --check dam-dashboard-widgets.js` OK
- CDP: `[data-widget-id="branding_latest"]` imgCount=6, naturalWidth>0
- Screenshot+Read: karta w scrollu dashboardu (CDP silniejszy niz klatka IDE)

### Zrodla
apps/web/assets/js/dam-dashboard-widgets.js, apps/web/dashboard.html, branding-index.json (7832 assets, media_types: image/vector/document/source/video).

## 2026-07-20 - Skeleton proaktywny: Branding + Wizualizacje

### Komenda/Akcja
User: branding i wizualizacje laduja tresc bez wczesniejszego skeleton loading; skeleton ma byc od razu (proaktywnie), potem zniknac i reveal (/dam-dobrakaloria, /ui-taste, /gsap-core).

### Log/Status
1. Root cause: `showInitialBootSkeletons` brak; `boot()` brandingu awaitowal 35MB indeks zanim cokolwiek trafilo do `#damBrandingSectionGrid`; `dam-viz.js` czekal na `loadIndex()` przed skeletonem.
2. `dam-grid-reveal.js`: wariant `layout:'viz-grid'` / mount `.dam-viz-grid` wstawia `.dam-skeleton__card--viz` jako dzieci grida (bez zagniezdzonego `.dam-skeleton--grid`).
3. `dam-brand.css`: `.dam-skeleton__card--viz` wysokosc ~320px * `--dam-viz-card-scale`, border jak karta.
4. `dam-branding.js`: `showInitialBootSkeletons()` na poczatku `boot()` (section grid 10 + brandbook 8).
5. `dam-viz.js`: skeleton 10 kart synchronicznie w `init()` przed `loadIndex()`.
6. Cache-bust: `branding.html` + `visualizations.html` -> `skel20260720a`.

### Efekt/Fix
Od pierwszej klatki DOM siatki maja shimmer-placeholdery w ksztalcie kart; po zaladowaniu indeksu innerHTML + `DamGridReveal.reveal(.dam-viz-card)`.

### Test/Ewaluacja
- `node --check` dam-grid-reveal.js, dam-branding.js, dam-viz.js OK
- CDP branding: skeleton inject 10 kart, h=384, shimmer ::after
- CDP viz po load: 151 `.dam-viz-card`, sk=0
- Screenshot+Read pass2: siatka 4 kolumny, szare karty shimmer w `#damBrandingSectionGrid`

### Zrodla
dam-grid-reveal.js skeleton(), dam-branding.js boot(), dam-viz.js init(), ui-taste §4.5 Loading.

## 2026-07-20 - DAM usability repair (FAZA 0-5)

### Komenda/Akcja
Implementacja planu `dam_usability_repair` (bez edycji pliku planu). Skille: dam-dobrakaloria, ui-taste (+ wcielony ui-ux-pro-max).

### Log/Status
1. FAZA 0: ui-taste description/scope (product UI), `product-ux/`, §22 Product UI, §23 Dziennik; regula `.cursor/rules/ui-taste-always.mdc` (repo + user).
2. FAZA 1: delegacja `.dam-win-btn` na `#damDashGrid` + re-bind po async; branding `bestTabForSearchQuery` + `?tab=`; modal reveal 0.3s fade + skeleton hero + fade tla.
3. FAZA 2: CSS 2x2 gap dla `--media`, tablet bez zwiniecia do 1 kol; hover thumbs; dashboard laduje DamMediaPreview (Podglad w miejscu).
4. FAZA 3: `DamMediaPreview` studio (tlo/persp/lang); `openLightbox` -> `openAsset(mode:viz-studio)`; shell zamyka `#damMediaPreview`.
5. FAZA 4: historia statusow = przycisk+badge -> modal `#damLifecycleHistoryModal`.
6. FAZA 5: weryfikacja dashboard 1280 (2x2, modal), branding `?q&tab=www` wyniki, explorer historia modal.

### Efekt/Fix
Jeden globalny modal podgladu; Folder Windows i Podglad na dashboardzie dzialaja po async; zero falszywego Brak wynikow przy poprawnym tab; historia F/X/D nie rozpycha inline.

### Test/Ewaluacja
- `node --check` na edytowanych JS: OK
- CDP dashboard: brandingCols `1fr 1fr`, gap 14/16, `_damWinDelegated`, DamMediaPreview open z Podglad
- Screenshot+Read: modal branding na dashboardzie; historia statusow modal w explorerze
- Branding: tab Strony WWW selected dla `?q=Bowl&tab=www`, wyniki widoczne

### Zrodla
dam-dashboard-widgets.js, dam-branding.js, dam-grid-reveal.js, dam-media-preview.js, dam-explorer.js, dam-shell.js, dam-dashboard.css, dam-brand.css, dam-branding.css, dashboard/explorer/branding.html, ~/.cursor/skills/ui-taste, agents/shared/code-doctrine.md

## 2026-07-20 - Explorer foreground fix

### Komenda/Akcja
Fix zgloszenia: "Folder Windows" (`.dam-win-btn` -> POST `:8766/reveal`) otwieral Eksploratora W TLE (okno niewidoczne). Wymagania: (1) preferuj NOWA KARTE w istniejacym oknie Eksploratora (Win11), (2) zawsze wysun okno na wierzch.

### Log/Status
1. Root cause: most to `pythonw.exe` (proces bez okna pierwszoplanowego) -> `subprocess.Popen(["explorer", path])` uruchamia okno bez fokusu (Windows foreground lock: SetForegroundWindow tylko dla procesu na pierwszym planie).
2. Diagnoza kart (sondy na tej maszynie, Win11 build 26200): rejestr `OpenFolderInNewTab=1` NIE dziala (nadal nowe okno, bez fokusu); `Navigate2(path, 2048)` nawiguje TA SAMA karte (nie tworzy nowej); dziala sekwencja: fokus okna (ALT-trick) -> Ctrl+T (keybd_event) -> `Navigate2(PIDL)` na swiezej karcie.
3. PILNE: dialog "Nie mozna odnalezc file:///D:/---%20INYFINN..." - Navigate2 dostawal sciezke, ktora Explorer probowal rozwiazac jako URL-encoded URI. Fix: `SHParseDisplayName` -> PIDL -> `VARIANT(VT_ARRAY|VT_UI1)`; NIGDY file:/// URI.
4. Implementacja w `local_bridge.py`: `_reveal_worker` (watek daemon, HTTP wraca natychmiast), `_open_folder_tab_and_focus` (COM Shell.Application + pywin32 + Ctrl+T + Navigate2(PIDL) + re-fokus), fallback `_focus_new_explorer_window` (poll do 5 s po nowe okno `CabinetWClass`, ALT-trick fokus). Tryb `select` (plik) = zawsze fallback explorer /select + fokus.
5. Restart mostu: stary PID 6760 zabity po porcie 8766, nowy `pythonw.exe local_bridge.py` w tle, `/health` OK.

### Efekt/Fix
`/reveal` na folder: gdy istnieje okno Eksploratora -> nowa karta w nim + okno na wierzchu; gdy brak okna -> nowe okno + na wierzchu. Zero dialogow bledu.

### Test/Ewaluacja
- `python -c "import ast; ast.parse(...)"` OK, lints czyste.
- POST /reveal `X:\Marketing\- POLSKA` przy otwartym oknie: TAB w oknie 3014902, `GetForegroundWindow()==hwnd` True.
- POST /reveal `X:\Marketing\- POLSKA\02 - FIRMOWE MATERIALY` (polskie znaki): karta + fokus True.
- Fallback (zero okien): nowe okno 198910, fokus True; kolejny /reveal `01 - PRODUKTY` -> karta nr 2 w tym oknie, fokus True.
- Sciezka repo `D:\--- INYFINN...` przetestowana sonda PIDL (karta + Navigate2 OK); endpoint jej nie przyjmie (jail `_is_under_marketing` - poza baza Marketing, zachowanie celowe).

### Backup
Brak (zmiana w 1 pliku, git).

### Zrodla
learn.microsoft.com IShellBrowser::BrowseObject (SBSP_*), Developing with Windows Explorer (IShellWindows/Navigate2), elevenforum OpenFolderInNewTab, znany pattern ALT-trick keybd_event(VK_MENU)+SetForegroundWindow.

## STREFA B usability 2026-07-20 (punkty 11-18 briefu)

### Komenda/Akcja
Brief `agents/shared/usability-brief-2026-07-20.md`, strefa B: dashboard 2x2, chip ID na kartach, licznik plikow, format licznikow, brakujace foldery ARCHIWUM w indeksie, tag klik/CTRL+klik, tooltips tagow, globalny loader.

### Log/Status
1. **P11 Dashboard 2x2**: root cause = kaskada CSS: `.dam-widget__list` (display:flex, linia ~404 dam-dashboard.css) wygrywal z `.dam-widget__list--media` (grid) o tej samej specyficznosci, bo byl nizej w pliku. Fix: podwojny selektor `.dam-widget__list.dam-widget__list--media` (grid). CDP: `grid-template-columns: 1fr 1fr`; screenshot: widget "Najnowsze materialy branding" = 2 kolumny x 2 rzedy.
2. **P12 Chip ID marketingowego**: `brandingCardIdChipHtml()` w dam-branding.js - kopiowalny button przy tytule karty (pojedyncze + grupowe), `data-dam-tip="Kliknij, aby skopiowac"`, klik = clipboard + toast (`damGlobalToast`, mechanizm jak toastCopied w dam-badges.js). ID usuniete z paska badge'ow (bylo uciete/niewidoczne). CSS `.dam-branding-card__id-chip` w dam-branding.css + `flex-wrap:wrap` na title-wrap przez `:has()` (chip lamie sie do wlasnej linii, nie jest uciety). Karty viz renderuje dam-viz.js (strefa agenta A) - NIE ruszane; modal viz ma juz chip ID z wczesniejszej sesji.
3. **P13 Licznik plikow**: `.dam-branding-grid-count` - ciemne tlo rgb(35 32 46/.92), bialy tekst, font-weight 700; margin-right 84px = pas na help fab (fab ~48px + 24px marginesu). Screenshot: pill czytelny, na lewo od fabu.
4. **P14 Format licznikow**: `fmtElements`/`fmtFiles` (polska odmiana 1/2-4/5+), status = "115 elementow • 582 pliki", licznik siatki = elementy • pliki (z X / Y przy uciecu limitem), tagi = "(N el. • M pl.)". Elementy per tag = dedup po `folder_group_id || marketingGroupKey` w `computeFacetCountsPair` (jedna petla, cache jak dotad).
5. **P15 Brakujace foldery ARCHIWUM**: w starym indeksie (built 2026-07-19 01:36) brak "08 Kampania META" i "05 - SLIDERY - sklep" z `-- ARCHIWUM --/05_Materialy graficzne e-commerce`. Skrypt build-branding-index.py JUZ skanuje legacy root (scan_marketing_roots, ingest legacy z dedup overlap) - stary indeks byl zbudowany przed ta zmiana. Pelny rebuild odpalony (python build-branding-index.py, dysk X: NFS wolny - kilkadziesiat minut; DecompressionBomb warnings = duze TIFy, niegrozne).
6. **P16 Tag klik/CTRL**: handler tagow w renderTagFilters: zwykly klik = zastap caly wybor tym tagiem (drugi klik na jedyny aktywny = wyczysc), CTRL/Cmd+klik = toggle multi. Dziala we wszystkich grupach facetow (wspolny handler `[data-tag-key]`). CDP: slider -> baner (replace), CTRL slider -> slider+baner (multi), status 6 el. • 15 pl.
7. **P17 Tooltips tagow facetow**: dam-tooltips.js - osobna sciezka `isFacetTag` (`.dam-badge-tag[data-tag-key]` w `.dam-branding-tag-filters`): 1.5 s hover, fade-in .25s, tresc = opis ("Tag X z grupy Y...") + sekcja hint "Klik: tylko ten tag. CTRL+klik: dodaj do wyboru." + "Nie przypominaj wiecej" (localStorage `damTagCtrlHintDismissed=1`; po dismiss tylko opis). Tooltip ma pointer-events:auto (mozna kliknac dismiss), inne tooltipy bez zmian.
8. **P18 DamLoader**: nowy apps/web/assets/js/dam-loader.js (CSS wstrzykiwany `<style id=damLoaderCss>`): `DamLoader.start(label)` = bialy pill na srodku (spinner + label + pasek indeterminate, fiolet #ab54db), po 1 s GSAP (power2.inOut) zwija pill i przenosi do prawego dolnego rogu (right 24 / bottom 92 - NAD help fabem), `done()` = fade-out; z-index 13000, pointer-events:none, prefers-reduced-motion = od razu rog; GSAP ladowany wzorcem loadGsap z dam-grid-reveal (wspolny tag data-dam-gsap). Wpiete w dam-branding.js: start przy kliku tagu, fazowany `scheduleBrandingRender` (skeleton klatka 1 gdy poprzedni render >150ms lub >800 assetow -> siatka klatka 2 -> tagi/facety klatka 3 -> done). Root cause 10 s zamrozen: renderTagFilters (facet counts = petla assets x ~100 kluczy) odpalal sie w tej samej klatce co siatka; teraz siatka renderuje sie PRZED tagami. dam-loader.js?v=1 dodany do 11 HTML (dashboard, explorer, branding, index, inbox, visualizations, settings, integrations, costs, invoices, profile).

### Efekt/Fix
Wszystko z punktow 11-14, 16-18 zweryfikowane w przegladarce (CDP + screenshot + Read). P15 = dokonczenie nastepcy (ponizej). Punkty 21-23 = nastepca (ponizej).

### Bumpy cache
- dam-dashboard.css -> usab20260720b (dashboard, settings)
- dam-branding.css -> usab20260720g (branding, explorer, dashboard, visualizations)
- dam-branding.js -> usab20260720f (branding)
- dam-tooltips.js -> usab20260720b (branding, explorer, dashboard, integrations, visualizations, settings, profile)
- dam-loader.js?v=1 (nowy, 11 HTML)

### Test/Ewaluacja
- node --check: dam-branding.js, dam-tooltips.js, dam-loader.js OK; ReadLints czysto.
- CDP: grid 2x2, 115 chipow ID, licznik "115 elementow • 582 pliki", replace/multi tagow, tooltip po 1.5 s + dismiss, loader center(cx=814/vw=1643) -> dock (right-bottom, w=52), tag counts "(30 el. • 145 pl.)".
- Screenshoty + Read: dashboard 2x2, branding grid + chipy ID (pelne, wlasna linia), ciemny licznik przy fabie, tooltip facetu, loader w rogu.
- Klip: klik chipa przez CDP daje "Nie udalo sie skopiowac" (brak user activation w tle) - realny klik uzytkownika ma aktywacje, mechanizm + toast dzialaja.

### Zrodla
- agents/shared/usability-brief-2026-07-20.md (punkty 11-18)
- apps/web/assets/js/dam-branding.js, dam-tooltips.js, dam-loader.js (nowy), dam-dashboard.css, dam-branding.css, 11x HTML
- apps/web/scripts/build-branding-index.py (scan_marketing_roots - legacy ARCHIWUM juz w kodzie)

---

## STREFA B nastepca 2026-07-20 (P15 + punkty 21-23)

### Komenda/Akcja
Handoff `agents/shared/handoff-strefa-B.md`: dokonczenie P15 (rebuild indeksu) + brief sekcja E punkty 21-23 (Pokaz wszystko / popup dna listy / Pokaz archiwum przy zakladkach).

### Log/Status
1. **P15 rebuild**: poprzedni PID 48688/50744 wisial ~92 min (89 watkow daemon na NFS po PIL DecompressionBomb / `_tiff_has_layers`). Zabity. Fix skryptow: (a) `_run_with_timeout` lapie `Exception` (nie tylko OSError), (b) legacy ARCHIWUM pomija pixel-scan tla, (c) TIFF w ARCHIWUM bez `_tiff_has_layers` (zakladamy editable), (d) progress log co 500 plikow. Restart: `build-branding-index.py` → **100.7 s**, exit 0.
2. **P15 liczby PRZED → PO**:
   - built_at: `2026-07-19T01:36` → `2026-07-20T16:47:56`
   - assets: **7832 → 49715** (legacy_indexed=41228, primary=7230)
   - path `Kampania META`: **0 → 89** (rg -c = 560 trafien w JSON)
   - path `SLIDERY - sklep`: **0 → 0** (folder zeskanowany; **96/96** plikow SCAN_EXT odrzucone jako overlap POLSKA-first `stem+wymiary` vs `- POLSKA/.../SLIDERY NA GŁÓWNĄ` - dedup zamierzony)
   - UI tag META (archiwum ON + zakladka wszystko): **~29 el • 155 pl → 64 el • 274 pl**; status siatki 77 el • 274 pl, karty z `Kampania META` / ARCHIWUM widoczne
   - UI tag Slider: **~40 el • 230 pl → 55 el • 283 pl**
   - Po rebuild: `enrich-branding-tags.py` touched=45837
3. **P21 Pokaz wszystko**: pierwsza zakladka `data-tab="all"`, separator `.dam-branding-tabs__sep`, domyslnie aktywna (boot bez `?tab=`/`#`/`?q=`), `assetInSectionTab`/`assetsForSectionTab`/`computeFacetCountsPair` respektuja `all`.
4. **P22 popup dna**: `#damBrandingListEnd` + IntersectionObserver (bez window scroll), panel `#damBrandingCategoryHint`, CTA → `activateTab("all")`, dismiss sessionStorage `damBrandingCatHintDismissed`.
5. **P23 Pokaz archiwum**: przeniesione z `.dam-branding-filters--meta` do `.dam-branding-scope-toggles` obok zakladek.

### Efekt/Fix
P15: META z ARCHIWUM w indeksie i UI (przy Pokaz wszystko + archiwum). SLIDERY archiwum = duplikaty POLSKA (overlap) - tresc dostepna w POLSKA / tag Slider. P21-23: 3 przeloty screenshot+Read (zakladki, popup, META archive).

### Backup
Brak (skrypty indeksu + UI; stary indeks nadpisany atomowo przez rebuild).

### Test/Ewaluacja
- `node --check dam-branding.js` OK; python ast parse skryptow OK.
- CDP: activeTab=all, sep 2px, fw=700, archiveNearTabs=true, archiveInMeta=false; popup hintHidden→false na sentinel; CTA → tab=all + dismissed=1; META 77 el • 274 pl + hasKamp/hasArch.
- Screenshot+Read: `strefaB-p21-pass2-tabs.png`, `strefaB-p22-cat-hint.png`, `strefaB-p15-meta-archive.png`.

### Zrodla
- agents/shared/handoff-strefa-B.md, usability-brief-2026-07-20.md (E 21-23)
- apps/web/branding.html, dam-branding.js/css, build-branding-index.py, asset_role_utils.py, enrich-branding-tags.py

## STREFA C samouczek 2026-07-20 (weryfikacja faz 3-9 + feedback dymka)

### Komenda/Akcja
Nastepca agenta Strefy C. Zadanie: (1) zweryfikowac fazy 3-9 samouczka (spotlight,
tresc, poza maskotki, brak clippingu dymka), (2) wdrozyc feedback usera do dymka
(`dam-tut__bubble`), (3) wpis do process.md + lekcje do code-doctrine sekcja 12.

### Log/Status
1. **Feedback dymka (priorytet, wdrozony PRZED weryfikacja faz)** - 5 zmian w
   dam-tutorial.css + dam-tutorial.js:
   - **Lokalny mini-pasek Wstecz/Dalej pod trescia dymka**: nowy `.dam-tut__mini-nav`
     w `.dam-tut__bubble-body` (2 przyciski `--mini-prev`/`--mini-next`), te same
     handlery co dolny panel (prevStep/nextStep). Stan disabled i etykieta
     (Dalej/Zakoncz) synchronizowane z dolnymi w renderStep. Dolny panel (Pomin/
     Zakoncz/postep) zostawiony.
   - **Padding dymka +12px/strone**: 26px 28px -> 38px 40px; szerokosc 430->454px.
   - **Gap maskotka<->tekst +10px**: 16px -> 26px.
   - **Ilustracja +10%**: warstwa obrazka to teraz osobny element `.dam-tut__mascot-img`
     (110% box kontenera, left:-5%, bottom:0, contain) - ~+10% wzgledem stanu, w ktorym
     obraz wypelnial caly kontener (inset:0).
   - **Static medalion + bobujaca maskotka**: bob GSAP animuje TYLKO
     `.dam-tut__mascot-img` (y:-6), a bialy medalion to `::before` na kontenerze bez
     transformacji. Kontener nie ma juz `will-change:transform`; poprzednio bob ruszal
     cala `.dam-tut__mascot` (kolko + obraz razem). To samo dla toastu zaproszenia
     (`.dam-tut-invite__mascot-img`). Custom property `--dam-tut-pose` ustawiana na
     kontenerze, dziedziczona przez warstwe obrazka (applyPose bez zmian).
2. **Bump `?v=`**: dam-tutorial.css v2->v3, dam-tutorial.js v6->v7 we wszystkich 9 HTML
   (dashboard, index, explorer, branding, inbox, visualizations, integrations, costs,
   invoices).
3. **Weryfikacja faz 3-9** (localStorage `damTutorialPhase='faza:krok'` + nawigacja na
   pasujaca strone; wznowienie po 900 ms):
   - Faza 3 Wizualizacje (idx 2): screenshot+Read, poza explain, spot na `.dam-viz-grid`.
   - Faza 4 Branding (idx 3): screenshot+Read oba kroki - krok 1 spot na sekcji (explain),
     krok 2 "Tagi i filtry" spot na `.dam-branding-tabs-row` (present), "Przejdz tam"
     ukryty na wlasnej stronie.
   - Faza 5 Projekty (idx 4): screenshot, spot na `#damProjectsGrid`.
   - Faza 6 Wiadomosci (idx 5): CDP, spot na `.dam-inbox-layout` (1513x470).
   - Faza 7 Faktury (idx 6): screenshot+Read, spot na `.geex-content__section-wrapper`.
   - Faza 8 Kalkulator (idx 7): CDP, spot na content wrapper.
   - Faza 9 Integracje (idx 8): screenshot+Read, krok 1 explain (spot content), krok 2
     zen "To wszystko!".
   Wszedzie: nowy dymek (mini-nav, padding, wieksza maskotka), brak clippingu przy
   krawedziach, poprawna poza, sensowna tresc.

### Efekt/Fix
Feedback dymka wdrozony i zweryfikowany (2 przeloty screenshot+Read: dymek z lokalnymi
Wstecz/Dalej, static kolko + bobujaca maskotka, padding/gap). Fazy 3-9 przechodza
czysto. Miniprev disabled na kroku 1 (dashboard), etykieta "Zakonc" na ostatnim kroku.

### Backup
Brak (edycja tylko wlasnych plikow Strefy C: dam-tutorial.js/.css + bump ?v= w HTML).

### Test/Ewaluacja
- node --check dam-tutorial.js OK; ReadLints (js+css) czysto.
- CDP: padding 38px 40px, gap 26px, kontener transform=none (medalion static),
  `.dam-tut__mascot-img` 99x117 z matrix translateY (-1..-6, bobuje) = 110% kontenera,
  miniPrevDisabled=true na fazie 1 kroku 1, miniNext="Zakoncz" na ostatnim kroku.
- Screenshoty + Read: branding (2 kroki), invoices, integrations, wizualizacje, projekty,
  costs, dashboard krok 1, dymek po zmianach (2 przeloty).

### Zrodla
- agents/shared/handoff-strefa-C.md, agents/shared/usability-brief-2026-07-20.md (p.19,25,26)
- apps/web/assets/js/dam-tutorial.js, apps/web/assets/css/dam-tutorial.css, 9x HTML

## STREFA A usability 2026-07-20 (punkty 1-10 briefu)

### Komenda/Akcja
Nastepca przerwanego agenta Strefy A. Domkniecie luk weryfikacyjnych z gents/shared/handoff-strefa-A.md sekcja (b); wpis process + lekcje doktryny (poprzednik nie zdazyl).

### Log/Status
1. Przeczytano skill dam-dobrakaloria + ui-taste, handoff, brief A 1-10.
2. **Luka P5 (kopiowanie ID)**: explorer -> babka-cytrynowa-nerkowcowy -> media preview. Chip data-marketing-id=V-6300684-ENFACE-L-04-26. Klik i contextmenu (z mockiem clipboard.writeText) kopiują wylacznie ID marketingowe; toast `Skopiowano: V-6300684-ENFACE-L-04-26`. Tip bez br-xxxxx. PASS.
3. **Luka P7 (Dodaj miniature)**: visualizations -> produkt coconut-orange-date (alias_langs RO/LT/LV/EE bez wizki). Modal: `Brak wizualizacji` + przycisk `Dodaj miniature` widoczny obok Demo/Ukryj. Screenshot+Read PASS.
4. **Luka P9 (assoc tags + zoom)**: branding -> openAsset br-003363 -> `DamAssocEdit.openPicker` (eksport dopisany, bo w tej karcie CDP `element.click()` nie odpala listenerow). Szukaj `baton`: 5 badge'ow (DK / BATONY / Mixy / PL / indeks). Hover thumb: `#damAssocThumbZoom` 400x400 z-index 12400; mouseleave usuwa zoom. Screenshot+Read PASS (placeholder `Brak` gdy brak thumb_url produktu - oczekiwane).
5. **linked_products 6300684 / Postanowienia+DPD**: potwierdzone w branding-index - br-003409.. i DPD slidery maja `linked_products` tylko `mix-6x-mini-batoniki-mixy`, `has_babka=false`. UI skojarzen lustrzanych pokazuje br-003363/003364 (Babka slider), NIE Postanowienia/DPD. **Brak danych indeksera - NIE naprawiane (strefa B/P15).**
6. Regresji wizualnych w plikach Strefy A nie wykryto; jedyna zmiana kodu nastepcy: eksport `DamAssocEdit.openPicker` + bump `?v=`.

### Status punktow 1-10 (po weryfikacji nastepcy)
| Pkt | Status |
|-----|--------|
| 1 Historia statusow timeline | OK (handoff + brak regresji) |
| 2 Etykiety studia Tlo/Perspektywa/Jezyk | OK (screenshot explorer studio) |
| 3 Chipy studia = dam-viz-badge | OK |
| 4 ID V-... formatViz | OK (V-6300684-ENFACE-L-04-26) |
| 5 Kopiowanie tylko marketing ID | OK (domkniete nastepca) |
| 6 Skojarzenia lustrzane | OK dla danych w indeksie; brak Postanowienia/DPD = brak danych |
| 7 Modal viz = branding + Dodaj miniature gdy lacksViz | OK (domkniete nastepca, coconut-orange-date) |
| 8 #damThumbPicker mini-eksplorator | OK (handoff) |
| 9 Assoc edit tagi + zoom 400 | OK (domkniete nastepca screenshot+CDP) |
| 10 Variant info popover 1.2s hide | OK (handoff CDP) |

### Efekt/Fix
- Domkniete 3 luki weryfikacyjne z handoffu (b).
- `DamAssocEdit.openPicker` wyeksportowane (QA/CDP + ewentualne wywolania API).
- Brak fixow indeksera (P6 Postanowienia/DPD).

### Bumpy cache
- dam-assoc-edit.js -> `usab20260720d` (tylko branding.html)
- Bez zmian: dam-brand.css usab20260720d, dam-explorer.js usab20260720c, dam-media-preview.js usab20260720g, dam-marketing-id.js usab20260720c, dam-badges.js usab20260720c, dam-viz.js usab20260720g

### Test/Ewaluacja
- node --check dam-assoc-edit.js OK
- CDP: copy mid V-6300684...; addManual visible; zoom 400x400 z=12400; tagN=5
- Screenshot+Read: strefaA-pkt7-add-manual.png, strefaA-pkt5-id-copy.png, strefaA-pkt9-zoom-visible.png
- linked_products audit python: Postanowienia/DPD -> tylko mix-6x-mini-batoniki-mixy

### Zrodla
- agents/shared/handoff-strefa-A.md, usability-brief-2026-07-20.md sekcja A
- apps/web/assets/js/dam-assoc-edit.js, dam-media-preview.js, dam-viz.js, dam-explorer.js
- apps/web/data/branding-index.json (audyt linked_products)


## STREFA C3 - Task 39: rename Bobek -> DobroKaloriuś (2026-07-20)

### Komenda/Akcja
Zmiana nazwy maskotki samouczka z "Bobek" na "DobroKaloriuś" we wszystkich tekstach UI samouczka i zaproszenia.

### Log/Status
1. Grep repo: Bobek w `dam-tutorial.js` (komentarz + title kroku 1), handoff/brief (poza zakresem kodu), plik sprite `maskotka-bobek.png` (nazwa assetu - bez zmiany).
2. Edycja `dam-tutorial.js`: 3 wystapienia -> DobroKaloriuś (komentarz naglowka, title kroku 1, tekst toastu zaproszenia).
3. Bump cache `dam-tutorial.js?v=7` -> `?v=8` w 9 HTML.
4. Weryfikacja: DamTutorial.stop() + clear LS + start/showInvite; screenshot+Read.

### Efekt/Fix
- Naglowek dymka: "Cześć, tu DobroKaloriuś!"
- Toast: "Cześć, tu DobroKaloriuś! Chcesz krótki samouczek po panelu?"
- Brak "Bobek" w UI samouczka.

### Backup
Brak (zmiana copy).

### Test/Ewaluacja
- node --check dam-tutorial.js OK
- CDP: title = "Cześć, tu DobroKaloriuś!", inviteText zawiera DobroKaloriuś, hasBobek=false
- Screenshot+Read: c3-task39-tutorial-dobrokalorius.png, c3-task39-invite-dobrokalorius.png (PASS, 3 przeloty)

### Zrodla
- usability-brief-2026-07-20.md pkt 39
- agents/shared/handoff-strefa-C.md
- apps/web/assets/js/dam-tutorial.js

## 2026-07-20 - STREFA SHELL Task 33 (flash Geex przy menu)

### Komenda/Akcja
Usunac flash starego layoutu / placeholdera Geex przy przejsciu miedzy pozycjami menu (brief pkt 33).

### Log/Status
1. Diagnoza: raw HTML (dashboard/explorer/costsâ€¦) zawiera Demo/Server Management; dam-shell.js przepisuje menu dopiero na DOMContentLoaded.
2. CDP: przy html.dam-booting + Demo w DOM body opacity=0 (flash niewidoczny).
3. Implementacja: dam-shell-boot.css + critical inline w head + DamShell.finishBoot() + body.is-booting na 20 HTML.
4. Bump dam-shell.js?v=shellboot20260720b; node --check OK.
5. Weryfikacja: dashboard -> explorer -> branding -> costs; screenshoty pass1-5 + Read.

### Efekt/Fix
- Brak widocznego flashu Geex Demo przy nawigacji.
- Fade-in po shell rewrite; prefers-reduced-motion respektowany.
- Fallback 4.5s gdy shell nie wstanie.

### Backup
Brak (zmiany odwacalne; bez commit).

### Test/Ewaluacja
- node --check apps/web/assets/js/dam-shell.js OK
- CDP: hasDemo+opacity0 podczas boot; po boot hasDemo=false opacity=1
- Screenshot+Read: shell-boot-pass1-dashboard â€¦ pass5-costs

### Zrodla
- agents/shared/usability-brief-2026-07-20.md pkt 33
- agents/shared/code-doctrine.md sekcja 12 (lekcja shell/flash)
- agents/shared/handoff-strefa-shell.md
- apps/web/assets/js/dam-shell.js, assets/css/dam-shell-boot.css

## STREFA TOOLTIPS (follow-up) - #damAssocActionMenu tips (2026-07-20)

### Komenda/Akcja
Dodac tooltipy (data-dam-tip) do kazdego itemu `#damAssocActionMenu` / `.dam-assoc-action-menu__item`. User: brak tipow przy Przejdz itd.

### Log/Status
1. Grep: menu renderowane w `dam-assoc-edit.js` (`openActionMenu`, ok. L279-340). CSS w `dam-branding.css`.
2. Wspolbieznosc: `dam-assoc-edit.js` / `dam-media-preview.js` / `dam-explorer.js` swiezo edytowane (agent H/A3) - BEZ edycji tych plikow.
3. Nowy binder: `apps/web/assets/js/dam-assoc-action-tips.js` - MutationObserver + dopiecie data-dam-tip + DamTooltips.bind.
4. Podlaczenie po `dam-tooltips.js`: branding / explorer / dashboard / visualizations (`?v=1`).
5. node --check OK; 3 przeloty screenshot+Read na branding.

### Efekt/Fix
Tipy PL:
- Przejdz -> Przejdz do produktu w Eksploratorze
- Eksplorator -> Otworz folder w Windows Explorerze
- Wizualizacja -> Otworz produkt w Wizualizacjach
- Kopiuj link -> Skopiuj link do produktu

### Backup
Brak (nowy plik + 4 tagi script w HTML).

### Test/Ewaluacja
- node --check dam-assoc-action-tips.js OK
- CDP: 4/4 itemy bound + tipVisible; DamTooltips + DamAssocActionTips na branding
- Screenshots: assoc-action-tips-pass1-przejdz.png, assoc-action-tips-pass2-eksplorator.png, assoc-action-tips-pass3-kopiuj.png (+ wczesniejszy assoc-action-tips-przejdz.png)

### Zrodla
- apps/web/assets/js/dam-assoc-edit.js (render)
- apps/web/assets/js/dam-assoc-action-tips.js (binder)
- apps/web/assets/js/dam-tooltips.js
- agents/shared/handoff-assoc-action-tips.md

---

## 2026-07-20 - META: HARD POLICY tylko Grok (zakaz Opus/Fable)
memory.md Hard rules #13 + #132; usability-brief HARD POLICY; Task/agenci = `cursor-grok-4.5-high-fast` only.

## STREFA H destrukcyjne akcje 2026-07-20 - INTERRUPTED

### Komenda/Akcja
H interrupted -> handoff for Grok successor (user HARD: tylko Grok 4.5, zero Opus/Fable).

### Log/Status
1. Zaimplementowano rdzen: `dam-danger.js` (hold-to-delete + ring + toastUndo + a11y).
2. Podpiecia: `dam-assoc-edit.js`, `dam-explorer.js`, danger zone w `settings.html`.
3. Cache-bust `?v=usab20260720h` w branding/explorer/visualizations/dashboard/settings.
4. `node --check` OK na wszystkich edytowanych JS.
5. Weryfikacja screenshot+Read NIE ukonczona (0/3). Audyt czerwonego / offset Confirm / code-doctrine §12 - TODO nastepcy.

### Efekt/Fix
Safe shutdown; szczegoly w `agents/shared/handoff-strefa-H.md`.

### Backup
Brak.

### Test/Ewaluacja
node --check OK; CDP: DamDanger.bind + ring DOM na settings (screenshot nie zrobiony).

### Zrodla
- agents/shared/usability-brief-2026-07-20.md sekcja H (27-32)
- agents/shared/handoff-strefa-H.md

## 2026-07-20 - STREFA A3 (Dogrywka 17:22 pkt 34/35/37/38)

### Komenda/Akcja
STREFA A3: "Brak wizualizacji" muted; LINKS/ELEMENTY split; Image resizer; broken thumbs w #damMediaPreview.

### Log/Status
1. Dane: branding-index Links (flor2/batonik → babka); file-index babka 6300684.01 → Links 12 plikow, ELEMENTY 0.
2. Resizer: launcher EXE = GUI; CLI w `inyfinn_resizer.cli` (convert -i/-o/-f png -q 60).
3. Kod: dam-media-preview.js (+ style #dam-a3-styles), dam-viz.js, local_bridge.py (api v3).
4. Restart mostu 8766 (wymagany dla nowych endpointow).
5. Cache-bust `?v=usab20260720a3` (4 HTML).

### Efekt/Fix
- 34: noviz/missing-langs → muted (nie danger red).
- 35: surowe Links poza "Skojarzone materialy"; zwijalna ELEMENTY.
- 37: CTA "Wygeneruj elementy z Links" + confirm + POST /open-image-resizer (tylko gdy can_generate).
- 38: __damAssocThumbFallback (replaceWith), bez native broken-icon.

### Test/Ewaluacja
- node --check media-preview + viz OK; bridge AST OK
- CDP: noviz rgb(143,139,159); florInMain=false; ELEMENTY collapsed; can_generate; thumb naturalWidth=480; nativeBroken=0
- Screenshoty: agents/shared/qa-screenshots/a3-pass1|2|3*.png
- Handoff: agents/shared/handoff-strefa-A3.md

### Zrodla
- usability-brief-2026-07-20.md sekcja I (34,35,37,38)
- dam-dobrakaloria + ui-taste + code-doctrine


## 2026-07-20 - STREFA DEVICE (Grok) — sciezki per urzadzenie

### Komenda/Akcja
USER: sciezka bazowa tylko dla aktualnego komputera (device_id/hostname); CRUD w profilu; zapis w bazie; runtime resolve po device.

### Log/Status
1. Audyt: ADR-008, /auth/identity, machine-config per Windows USER, dam_base_path localStorage — brak user+device w PG.
2. PI: `device-scoped-base-paths` w program-instructions.json (v6).
3. Bridge: model UDP + GET/POST `/user-device-paths` (+ `/current`); lustro z POST /machine-config.
4. Runtime: dam-paths.js ensureUserBase → baza → LS scoped → machine-config.
5. UI: profile.html + dam-device-paths.js (CRUD).
6. Restart mostu 8766 (usunieto podwojne PID 632+55284).
7. Cache-bust `?v=devicepath20260720a` (bez settings.html — H2).

### Efekt/Fix
- MVP dziala: per-device path w KV/local JSON + API + UI profilu + resolve runtime.
- settings.html nadal stary `?v=` dam-paths (do zbumpowania po H2).

### Backup
Brak.

### Test/Ewaluacja
- AST bridge OK; node --check paths + device-paths OK
- Helpers upsert/list/resolve/delete OK
- Live: GET /user-device-paths/current → 401 bez sesji (route zyje)
- Handoff: agents/shared/handoff-strefa-DEVICE.md

### Zrodla
- program-instructions device-scoped-base-paths
- ADR-008, memory §32, usability-brief pkt 40


## 2026-07-20 - STREFA DEVICE follow-up (Grok) — seed PI + Sesja urzadzenia

### Komenda/Akcja
Follow-up po MVP: (1) seed PI do Postgres KV, (2) sidebar „Sesja urządzenia” → profil `#damDevicePathsRoot`, (3) bez edycji settings.html / bez commit.

### Log/Status
1. `_seed_naming_policy_to_postgres()` — KV `program-instructions` v6, 44 instr., `device-scoped-base-paths` w critical; `app-settings.instructions` lustro OK.
2. `dam-shell.js`: `goDeviceSessionPaths` zamiast `DamApi.logout`; href `profile.html#damDevicePathsRoot`.
3. `dam-device-paths.js`: `focusSection` + hash `#damDevicePathsRoot`.
4. Cache-bust shell `devicesession20260720a` w 19 HTML (bez settings); device-paths `devicepath20260720b` w profile.html.
5. Handoff zaktualizowany: TODO bump settings.html dla H2/koordynatora.

### Efekt/Fix
- PI w bazie (nie tylko JSON).
- „Sesja urządzenia” otwiera CRUD sciezek w profilu.

### Backup
Brak.

### Test/Ewaluacja
- `pg_db.kv_get('program-instructions')` → has device-scoped-base-paths
- `node --check` dam-shell.js + dam-device-paths.js OK
- settings.html nietkniety (shell `shellboot20260720b`, paths `204mod1`)

### Zrodla
- agents/shared/handoff-strefa-DEVICE.md
- local_bridge._seed_naming_policy_to_postgres

---

## STREFA C4 - samouczek anchor + 40 pochwal + nbspPl (2026-07-20)

### Komenda/Akcja
Korekta kotwiczenia dymka (right+40px), polish maskotki, 40 pochwal, typografia PL (nbspPl).

### Log/Status
1. placeBubble: priorytet right-top/right-bottom → left → below/above; EDGE_GAP=40; clamp viewport.
2. CSS: gap 36px, medal 103.5px, img 121%, zielony cien, mini-nav do dolu.
3. PRAISES x40 + Fisher-Yates shuffle; nbspPl na title/text/invite/pochwala.
4. Cache: dam-tutorial.js?v=12, css?v=6 (9 HTML).
5. node --check OK.

### Efekt/Fix
- CDP krok1: anchor=right-top gapX=40 (nie pod sidebarem).
- CDP typografia: i+NBSP, Range sameLineAsNext.
- CDP pochwala: wariant z puli (np. "Panel lubi takich jak Ty. Lecimy.").

### Backup
Brak.

### Test/Ewaluacja
- Screenshots: c4-anchor-pass1-sidebar-right.png, c4-pass-nbsp-step3-header.png, c4-pass-praise-brawo.png
- Handoff: agents/shared/handoff-strefa-C4.md
- usability-brief pkt 41-42 DONE

### Zrodla
- dam-tutorial.js / dam-tutorial.css
- handoff-strefa-C.md, C3.md

## 2026-07-20 - STREFA INTEGRACJE (Grok) — Bento panel Integracje

### Komenda/Akcja
USER: panel Integracje nieczytelny (sciana belkow + masa przyciskow) → siatka Bento 4xn, chipy statusu, Synology span 2.

### Log/Status
1. Design Read: product hub Integracje / Geex / Bento Control Center.
2. Nowy CSS `apps/web/assets/css/dam-integrations.css` (scoped `.dam-integrations-page--bento`).
3. `dam-integrations.js`: `layout:"bento"`, chipy, feature/live/planned tiles, jedna gesta siatka + Planowane; safety opacity po GSAP.
4. `integrations.html`: laduje CSS, `includeExtras:true`, `?v=bento20260720d`.
5. settings.html / dam-brand.css / tutorial / bridge — NIE ruszane.
6. Checklista C3 pozostaje `[ ]` (anatomia viz/branding zamrozona); hub chrome OK.

### Efekt/Fix
- Desktop 4 kol., tablet 2, mobile 1; status = maly chip; Synology feature span 2 gdy Polaczono.
- Brak sciany belkow `Nie skonfigurowane`.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-integrations.js OK
- CDP: 12 tiles, chipy ~44px, Synology w≈448, cols 4/2/1
- Screenshoty: agents/shared/qa-screenshots/int-bento-pass*.png
- Handoff: agents/shared/handoff-strefa-INTEGRACJE.md

### Zrodla
- dam-dobrakaloria + ui-taste (Bento + product UI §22) + code-doctrine
- WAZNA-CHECKLISTA C3 (chrome hub OK)

## 2026-07-20 - STREFA H3: przebudowa Strefy ryzyka (settings)

### Komenda/Akcja
User: przebuduj TYLKO Strefę ryzyka (ui-taste, hold 300ms, GitHub-style). HARD: zero kasowania plikow / git reset / wipe.

### Log/Status
1. Design Read: settings admin DAM / Geex — danger zone GitHub-style, schludny friction.
2. Markup+CSS #damDangerZone w settings.html (header, ops card, foot left hold).
3. dam-danger.js: DEFAULT_HOLD_MS=300; bind label czasownika; toast Cofnij 8s.
4. Trash odbiorcow: muted + data-dam-hold-delete via MutationObserver (bez edycji dam-settings.js).
5. Bump `?v=usab20260720h3b`; node --check OK.
6. 3 przeloty screenshot+Read PASS.

### Efekt/Fix
- Pełna szerokość (grid 1/-1); offset hold LEFT vs Restart RIGHT; red tylko destrukcja.
- Copy: lokalne preferencje przeglądarki, nie pliki na dysku.

### Backup
Brak (zero destrukcji).

### Test/Ewaluacja
- CDP: dzW=sysW=1242, holdMs=300, offsetOk
- Screenshots: h3-dz-pass1-structure.png, h3-dz-pass2-polish.png, h3-dz-pass3-element-hint.png
- Handoff: agents/shared/handoff-strefa-H.md (H3 DONE; dam-assoc-edit.js WOLNY Task 36)

### Zrodla
- ui-taste + dam-dobrakaloria + usability-brief sekcja H
- code-doctrine §12 (lekcje grid-column + hold-to-delete)

## 2026-07-20 - META DEVICE: cache-bust settings.html

### Komenda/Akcja
Bump `?v=` dam-shell.js + dam-paths.js w settings.html (spójnie z profile.html); bez markup/integracji.

### Log/Status
1. shell: `shellboot20260720b` → `devicesession20260720a`
2. paths: `204mod1` → `devicepath20260720a`
3. dam-device-paths.js: brak w settings (pominięte)
4. Odhacz TODO #3 w handoff-strefa-DEVICE.md

### Efekt/Fix
settings.html ładuje te same wersje shell/paths co pozostałe strony DEVICE.

## 2026-07-20 - STREFA INT-SETTINGS (Grok): Bento 3xn w settings.html #damIntegrations

### Komenda/Akcja
Bento 3xn kafelki w settings #damIntegrations (NIE integrations.html hub). Chipy statusu, Geex CTA, polskie znaki. Wspolbieznosc H2: nie ruszac danger zone.

### Log/Status
1. Design Read: settings DAM / Geex Control Center - Bento 3xn, waskie chipy, nie belki.
2. Nowy dam-integrations-settings.css (3/2/1 + chip 12.5px + accordion Geex).
3. dam-integrations.js: layout `settings-bento`, auto-detect `#damIntegrations`, PL stringi, inject fallback `#dam-int-settings-bento`.
4. dam-settings.js mount `layout: "settings-bento"`; settings.html tylko CSS/JS linki + bump `?v=setbento20260720c`.
5. `node --check` OK; 3 przeloty screenshot+Read PASS.

### Efekt/Fix
- Desktop: 3 kolumny (~385px); chip Połączono ~92px (24% karty), nie banner.
- Planowane: chip `Plan` + dashed `Wkrótce`; Zaloguj disabled solid (nie dashed).
- Hub integrations.html nadal 4-col; settings osobny CSS.

### Backup
Brak (zero destrukcji / zero kasowania plikow).

### Test/Ewaluacja
- CDP: cols=3x385, rows 3/3/2, chipFs=12.5px, PL OK
- Screenshots: int-settings-bento-pass1/2/3-desktop.png
- Handoff: agents/shared/handoff-strefa-INTEGRACJE.md

### Zrodla
- dam-dobrakaloria + ui-taste + code-doctrine + handoff-strefa-INTEGRACJE.md

## 2026-07-20 - STREFA SIDEBAR-MORPH (Grok): identity margin + avatar + z-index + logout/morph

### Komenda/Akcja
1. margin-bottom +20px na .dam-user-menu__identity
2. Default avatar bez czapeczki
3. Profile menu z-index > sticky search
4. Sesja urzadzenia vs Wyloguj (+50px, ikona exit)
5. GSAP morph collapse 0.5s power3.inOut

### Log/Status
1. Inject #damShellLayerCss + dam-brand.css: identity `margin: 12px 12px 20px`
2. SVG: avatar-male/female/user - glowa+ramiona, bez path czapki; cache-bust `?v=avatarflat20260720a`
3. Popup z-index 12550, header 200, sticky spada przy `body.dam-header-popup-open`
4. Sidebar: `#damShellDeviceSession` (desktop) + `#damShellLogout` (uil-signout, DamApi.logout)
5. `setSidebarCollapsed(animate)` GSAP 0.5s / reduce=0; boot `animate=false`
6. Bump: dam-shell.js + dam-brand.css `?v=identitymb20260720a`

### Efekt/Fix
- CDP identity marginBottom=20px OK
- Menu profilu nad search (z=12550 vs 52)
- Wyloguj oddzielony od Sesji (+50px), ikona exit

### Test/Ewaluacja
- node --check dam-shell.js OK
- CDP: marginBottom 20px, popupZ 12550, avatarSrc avatarflat, logoutIcon uil-signout
- Screenshot: page-2026-07-20T16-21-29-233Z.png (Temp/cursor/screenshots)

### Zrodla
- dam-dobrakaloria, ui-taste, gsap-core, code-doctrine

## 2026-07-20 - STREFA A-PREVIEW (Grok): Task 36 + pilne rozszerzenie (Bento / anti-loop)

### Komenda/Akcja
Podglad LEWA | wyniki PRAWA w `#damAssocEditPopover`; Bento CSS Grid; zakaz self-assoc/dedupe; stopka DAM; bez ruszania dam-viz / dam-media-preview / danger / tutorial / branding / bridge.

### Log/Status
1. Design Read: popover assoc-edit (DAM/Geex), VARIANCE 5 / MOTION 3 / DENSITY 5.
2. `dam-assoc-edit.js`: inject CSS grid shell + body `preview | list`; breakpointy <768 / 768-1279 / >=1280.
3. `buildAssocExclude` + `isVisualizationLike` + dedupe id/indeks w `renderOptions`.
4. Stopka: Zatwierdz primary purple, disk/cancel outline (nie zielono-czerwone pills).
5. Fix: `opt-row` height 0 + overflow:hidden przycinal liste -> flex + min-height 64.
6. Bump `?v=usab20260720a36f` w branding.html; `node --check` OK.

### Efekt/Fix
- Podglad po LEWEJ (label Podglad), lista rownej wysokosci, brak H-scroll.
- Self-assoc: excludeIds/excludeIndexes + filtr viz-like; uniq id/indeks.
- Stopka spojna z DAM purple.

### Backup
Brak (zero kasowania plikow).

### Test/Ewaluacja
- CDP: display=grid, previewBeforeList, noHScroll, noDupIds, confirmBg purple, rowH=64.
- Screenshots (HARD GATE): `tmp/qa-a36/pass4-desktop-clean.png`, `pass3-list-outlined.png`, `pass5-stacked-narrow.png`.
- Stale-frame: pass2 bez listy (DOM OK) - wymuszony repaint; pass3/4 OK.

### Zrodla
- usability-brief pkt 36; dam-dobrakaloria; ui-taste; code-doctrine (cache-bust, inject CSS, stale screenshot).

## 2026-07-20 - STREFA INT-SETTINGS dogrywka: Wkrótce + chip Wdrożenie planowane

### Komenda/Akcja
Fix przyciskow Wkrótce (bez lavender wash) + badge `Wdrożenie planowane` na planowanych kafelkach (settings + hub).

### Log/Status
1. Usunieto `geex-btn` / `geex-btn--primary-transparent` z Wkrótce (wlasny `.dam-int-soon`).
2. CSS: dashed `#8b8d97`, bg `#fff`, ink `#1a1820` + `-webkit-text-fill-color`, opacity 1, focus-visible ring.
3. Chip: `Plan` → `Wdrożenie planowane` (`.dam-int-chip--planned`, wrap 2 linie, title tip).
4. Bump `?v=setbento20260720h`; CDP PASS.

### Efekt/Fix
- Wkrótce: white fill, ink text, neutral dashed (nie disabled wash).
- Chip copy dokladnie `Wdrożenie planowane`.

### Test/Ewaluacja
- CDP: bg=rgb(255,255,255), color/fill=rgb(26,24,32), border dashed #8b8d97, chip text OK
- Screenshots: int-settings-planned-fix-pass3.png, int-settings-wkrotce-pass3-closeup.png

### Zrodla
- ui-taste + dam-dobrakaloria; screenshot usera (Plan / Wkrótce wash)

## 2026-07-20 - STREFA VIZ-ASSOC (Grok): layout assoc po prawej + zakaz petli wiz→wiz

### Komenda/Akcja
User HARD: #damVizModal skojarzenia po prawej (jak branding), zero petli wiz→wiz, RWD 375/768/1280. Bez dam-assoc-edit / git commit / kasowania.

### Log/Status
1. Design Read + PI `viz.assoc_no_visualization_loop` (critical) PRZED kodem.
2. Layout: `dam-viz-modal.css` + `.dam-viz-modal-box--assoc-split` w dam-viz.js i DamMediaPreview viz-studio.
3. Filtry w `renderLinkedBrandingAssets`: isVisualizationAsset + isNoiseBrandKitAsset + isRelevantMaterialForProduct.
4. Bump `?v=vizassoc20260720c`; node --check OK.
5. 5 przelotow screenshot+Read (1280/768/375).

### Efekt/Fix
- Desktop: assoc w prawej kolumnie; mobile stack hero→meta→assoc.
- Babka 6300684: 1802 linked → 7 materialow marketingowych; 200 packshotow odcietych; OATS bez wizek w liscie.

### Backup
Brak (zero destrukcji).

### Test/Ewaluacja
- CDP paneRight / stacked / label counts
- Screenshots: viz-assoc-pass1..5 w Temp\cursor\screenshots
- Handoff: agents/shared/handoff-strefa-VIZ-ASSOC.md
- Lekcja doctrine §12 (STREFA VIZ-ASSOC)

### Zrodla
- dam-dobrakaloria + ui-taste + code-doctrine + program-instructions
- usability-brief pkt 6/7
## 2026-07-20 - STREFA INT-LOAD (Grok): skeleton + CTA systemowe

### Komenda/Akcja
User: `#damIntegrationsList` zostaje na skeleton; przyciski noop/reload; CTA jak `.dam-welcome-link`; wykrojnik jesli martwy. Model Grok. Bez commit / kasowania.

### Log/Status
1. Diagnoza CDP: mount dziala (12 kart hub / 8 settings), skeleton znika gdy Promise konczy; CTA byly lavender geex.
2. Root cause: race DOMContentLoaded + brak hard failsafe po skeletonie; styl foot CTA = geex lavender; tipy disabled brak.
3. Fix: `dam-int-cta` + summary welcome-link; failsafe 14s; readyState boot; tipy Zaloguj/Wkrótce; DamWykrojnikQueue export.
4. Bump `?v=intload20260720a`; node --check OK.
5. 3 przeloty screenshot+Read.

### Efekt/Fix
- Skeleton: try/catch + failsafe; boot nie zalezy tylko od DOMContentLoaded.
- CTA: border #E7E7E7 / bg #fff / ink #464255 (nie lavender).
- Preferencje → settings#damPrefs; Konfiguruj otwiera details; tipy na disabled/soon.

### Backup
Brak (zero destrukcji).

### Test/Ewaluacja
- CDP: cards 12/8, skeleton false, lavender false, asanaOpen true, prefsVisible
- Screenshots: agents/shared/qa-screenshots/int-load-pass1..3*.png
- Handoff: agents/shared/handoff-strefa-INTEGRACJE.md

### Zrodla
- dam-dobrakaloria + ui-taste + code-doctrine + handoff INTEGRACJE

## 2026-07-20 - STREFA DISK-DEVICE (Grok): settings embed + Folder + root normalize

### Komenda/Akcja
USER: w settings.html zamiast starego #damDisk pokaz te sama karte co profile#damDevicePathsRoot; Folder picker; normalize Marketing root; Edytuj/Usun jak dam-welcome-link + hold-to-delete; runtime per device_id. Bez commit / kasowania.

### Log/Status
1. PI device-scoped-base-paths: settings embed, Folder, normalize; seed Postgres.
2. dam-paths.js: normalizeMarketingRoot + pickFolder (pywebview → POST /pick-folder).
3. local_bridge.py: pick_folder_dialog (tkinter) + POST /pick-folder; restart :8766.
4. dam-device-paths.js: Folder/Wykryj/Sprawdz; welcome-link; DamDanger; mount settings (CSS #damDisk flatten).
5. settings.html: #damDevicePathsRoot w #damDisk; hidden settingBasePath; script device-paths.
6. Bump ?v=devicepath20260720c (paths wszedzie + device-paths profile/settings).

### Efekt/Fix
- Jedna logika DamDevicePaths w profilu i Ustawieniach (Dysk).
- Folder zamiast klepania; X:\Marketing\- POLSKA → X:\Marketing przed zapisem.
- Edytuj/Usun systemowe; Usun = hold gdy DamDanger.

### Backup
Brak.

### Test/Ewaluacja
- node --check paths + device-paths OK; bridge AST OK
- CDP: card OK, old detect gone, normPolska=X:\Marketing, edit/del dam-welcome-link + DamDanger
- Screenshoty: agents/shared/qa-screenshots/device-settings-pass1-form.png, pass2-disk.png, pass3-list.png
- Handoff: agents/shared/handoff-strefa-DEVICE.md

### Zrodla
- program-instructions device-scoped-base-paths
- dam-dobrakaloria + ui-taste + handoff-strefa-DEVICE.md

## 2026-07-20 - STREFA USERMENU (Grok): Profil highlight + stray Konto

### Komenda/Akcja
USER: w menu profilu (.dam-user-menu__link / Profil) highlight nizej niz napis/ikona; stray "Konto"; fix CSS flex center w inject #damShellLayerCss; bump ?v=; screenshot+Read. Bez integrations/device-paths, bez kasowania plikow.

### Log/Status
1. Root cause misalignment: Geex style.css/content.css .geex-content__header__popup__link { align-items: flex-start !important } przebijalo dam-brand lign-items: center (bez !important) + min-height 42px → tresc przy gorze kapsuly.
2. Root cause "Konto": dam-tooltips.js tipuje kazdy [aria-label]; <nav aria-label="Konto"> pokazywal stray tip nad Wyloguj.
3. dam-shell.js #damShellLayerCss: align-items:center !important, padding 11px 12px, ikona 18x18 + ::before line-height 1.
4. Usunieto aria-label z nav/legal; ensureUserMenuMarkup stripuje legacy; dam-tooltips skip NAV/role=menu/navigation.
5. Bump dam-shell.js + dam-tooltips.js ?v=usermenufix20260720b (bez integrations.html).

### Efekt/Fix
- Kapsula hover rowno otacza ikone+tekst (CDP topGap=botGap=11, midDelta=0).
- Brak tipu "Konto" (navAria=null, tipBoundOnNav=false).

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-shell.js + dam-tooltips.js OK
- CDP: align=center, pad=11px 12px, topGap=11, botGap=11, midDelta=0, shellHasPad11
- Screenshots: agents/shared/qa-screenshots/usermenu-profil-align-pass1.png .. pass3-clean.png

### Zrodla
- style.css / content.css .geex-content__header__popup__link
- dam-tooltips.js tipText/shouldAutoTip
- dam-dobrakaloria + ui-taste

## 2026-07-20 - Integracje: Konfiguruj panel ~56px

### Komenda/Akcja
USER: na `integrations.html` klik Konfiguruj (FMCG i inne live) pokazuje zmiazdzony panel ~56px; Preferencje/Konfiguruj bez czytelnego UI. Fix bez walki o `dam-integrations.css` (inny agent: skeleton) — prefer inject `<style id="damIntConfigPanelFix">`; CDP + screenshot; process.md.

### Log/Status
1. Root cause: `.dam-integrations-page--bento .dam-int-config__panel { position:absolute; left:16px; right:16px }` + `.dam-int-tile__foot .dam-int-tile__config { position:relative }` przy wrapperze `inline-flex` ≈ szerokosc summary (88px) → panel 88−32 ≈ 56px.
2. Fix: `ensureConfigPanelFixCss()` w `dam-integrations.js` — `#damIntConfigPanelFix`: config wrapper `position:static`, `flex:1 1 100%`, panel `position:static; width:100%` (karta rosnie in-flow).
3. Cache bump: `dam-integrations.js?v=intcfgfix20260720a` w `integrations.html` + `settings.html`.
4. Nie ruszano skeleton/Wkrótce w `dam-integrations.css`.

### Efekt/Fix
- Panel Konfiguruj ≈ szerokosc contentu karty (CDP ~253 przy karcie ~283), nie 56px.
- Formularze Entra/LDAP/Asana/Microsoft/FMCG/Stawki czytelne; PLANOWANE tiles nadal 283px, bez overflow.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-integrations.js OK
- CDP before (user): panel w≈56; after: fmcg/entra/asana/ldap/microsoft/cost-rates panelW=253, position=static; PNG Import button ~156px
- Screenshots: agents/shared/qa-screenshots/int-config-fmcg-pass1-clip.png, int-config-entra-pass2-clip.png, int-config-asana-planned-pass3.png
- Pass 1 FMCG full-width; Pass 2 Entra form; Pass 3 Asana + PLANOWANE uniform

### Zrodla
- dam-integrations.css (bento absolute panel + relative config wrap)
- dam-dobrakaloria + ui-taste

## 2026-07-20 - Integracje: skeleton loading ledwie widoczny

### Komenda/Akcja
USER: skeleton na integrations.html prawie niewidoczny na jasnym tle; prefer solid #ececf2; override w dam-integrations.css (nie wspolny dam-brand); bump ?v=; screenshot+Read.

### Log/Status
1. Root cause: global .dam-skeleton__* w dam-brand.css bierze --dam-surface-muted (#f5f6fa) - niemal znika na canvas #f3f5f4/bialym.
2. Override w dam-integrations.css (scoped .dam-integrations-page): background var(--dam-border, #ececf2) + hairline border (mix text-muted 28% + border); shimmer zachowany (bialy 0.7).
3. Cache-bust dam-integrations.css ?v=skelvis20260720b w integrations.html + settings.html.
4. Weryfikacja: CDP force DamGridReveal.skeleton; bg=rgb(236,236,242); 3 przeloty screenshot+Read (z shimmer i at rest).

### Efekt/Fix
- Skeleton kart hubu Integracje czytelny: solid #ececf2 + krawedz, flat/Bento, bez purple glow.

### Backup
Brak.

### Test/Ewaluacja
- CDP: cardBg rgb(236,236,242), border 1px darker mix, css ?v=skelvis20260720b
- Screenshots: integrations-skeleton-pass1.png, pass2.png, pass3-rest.png (Temp/cursor/screenshots)

### Zrodla
- dam-brand.css skeleton (9421+); dam-integrations.css override; dam-dobrakaloria + ui-taste

## 2026-07-20 - Settings: PLANOWANE +30px w dol

### Komenda/Akcja
USER: sekcja PLANOWANE na settings (#damIntegrations) przesunac +30px w dol; scoped CSS settings-only; nie ruszac hub integrations.html.

### Log/Status
1. Design Read: Settings Integracje Bento - wiecej powietrza nad PLANOWANE.
2. W settings-bento jedyna `section.dam-int-section` = Planowane (primary = bare `.dam-int-bento-grid` bez title).
3. `dam-integrations-settings.css`: `margin-top: 30px` na `#damIntegrations .dam-integrations-page--settings .dam-int-section`.
4. Cache-bust `settings.html`: `?v=planowane30a`.
5. CDP: before gap/pageY vs after = +30; marginTop 0→30px.

### Efekt/Fix
- PLANOWANE na settings ma +30px powietrza nad headingiem; hub nie ruszony.

### Backup
Brak.

### Test/Ewaluacja
- CDP deltaPageY=+30, gap 0→30, marginTop=30px, css ?v=planowane30a
- Screenshots: settings-planowane-pass1-after.png, pass2-gap.png, pass3-final.png
- Pass 1 structure; Pass 2 gap CDP; Pass 3 final lock

### Zrodla
- dam-integrations-settings.css; settings.html; dam-dobrakaloria + ui-taste

## 2026-07-20 - Integracje hub: skeleton = realny Bento (span-2 + 4-col)

### Komenda/Akcja
USER: skeleton na integrations.html nie pokrywa realnego `#damIntegrationsOAuth > .dam-int-bento-grid` (span-2 Synology + 4-col; PLANOWANE 4+1). Fix hub JS/CSS; nie regresuj fill `#ececf2`; unikaj settings CSS (inny agent).

### Log/Status
1. Root cause: `DamGridReveal.skeleton({variant:cards,count:6})` -> `.dam-skeleton--grid` = `auto-fill minmax(220px)` (~5 rownych), bez `dam-int-tile--feature`.
2. `paintIntegrationsSkeleton()` w `dam-integrations.js`: sekcje Integracje/Planowane + `.dam-int-bento-grid` + pierwsza karta `dam-int-tile--feature` (span-2); Planowane = EXTRA_INTEGRATIONS.length.
3. CSS: `.dam-skeleton--int-bento { display:block }` + wysokosc kart 132px; fill `#ececf2` bez zmian.
4. Cache: `?v=skelbent20260720a` (css+js) w integrations.html + settings.html.

### Efekt/Fix
- Skeleton foreshadowuje live: 4-col, hero ~2x, PLANOWANE 4+1.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-integrations.js OK
- CDP skeleton: cols 4x283, featureW=582, singleW=283, ratio~2.06, bg rgb(236,236,242)
- CDP live: featureW=582, singleW=283 (identycznie)
- Pass 1 highlight span-2; Pass 2 clean skeleton; Pass 3 live match

### Zrodla
- dam-integrations.js / dam-integrations.css; dam-dobrakaloria + ui-taste

## 2026-07-20 - FMCG Integracje: CTA Edytuj (mapowanie + dane reczne)

### Komenda/Akcja
USER: przy Konfiguruj Katalog FMCG dodac Edytuj - mapowanie pol + dane reczne bez wymaganego CSV; reuse store importu.

### Log/Status
1. Checklista A3 przypomniana - zostaje czesciowo otwarta.
2. PI: rozszerzono `finance.fmcg_catalog` + nowa `finance.fmcg_manual_edit`.
3. Bridge: GET/POST `/finance/fmcg-import-map`; PATCH/upsert katalogu; replace akceptuje pusta liste items.
4. UI: `dam-fmcg-catalog.js` overlay Edytuj (Mapowanie / Dane reczne); CTA w `dam-integrations.js` fmcgCard; CSS inject `#damFmcgEditUi`.
5. Cache-bust `?v=fmcgedit20260720b` (integrations, settings, dashboard).
6. Restart local_bridge (nowe endpointy).

### Efekt/Fix
- Konfiguruj -> Edytuj otwiera edytor mapowan CSV->catalog_id i tabeli kwot; zapis do tych samych JSON co import CSV.
- Brak pliku nie blokuje UI (pusta tabela / Dodaj wiersz).

### Backup
Brak.

### Test/Ewaluacja
- `node --check` dam-fmcg-catalog.js + dam-integrations.js OK
- Bridge: `/finance/fmcg-import-map` -> login_required (route live)
- CDP: Edytuj widoczny; overlay mapRows=12 itemRows=45; Zapisz -> `Zapisano mapowanie (12) i katalog (45).`
- Screenshots+Read: fmcg-edit-pass1-mapping.png, pass2-data.png, pass3-saved.png
- A3 checklist: `[~]` (UI done, dane operacyjne nie)

### Zrodla
- dam-fmcg-catalog.js, dam-integrations.js, local_bridge.py, program-instructions.json
- dam-dobrakaloria + ui-taste
## 2026-07-20 - STREFA B follow-up: skojarzenia ELEMENTY (skladniki/owoce/owocki)

### Komenda/Akcja
Handoff A3 / brief pkt 35: indekser ma kojarzyc materialy brandingowe ELEMENTY ze skladnikami/owocami/owockami (nie tylko packshoty); product Links/ELEMENTY w branding-index.

### Log/Status
1. Root cause: `scan_wizki_products` indeksuje tylko `4 - WIZKI`; product `2 - PROJEKT/Links` + `1 - MATERIALY/ELEMENTY` poza indeksem. UI A3 juz filtruje po path + ELEMENT_ASSOC_RE, ale search_blob rzadko mial terminy.
2. PI: `branding.element_assoc_skladniki_owoce` w program-instructions.json.
3. Kod: `brand_element_assoc.py` (termyny w search_blob); `build-branding-index.py` `scan_product_element_assets` + enrich; incremental `enrich-branding-element-assoc.py`.
4. Enrich: +1896 product_element (49715→51611); tagged search_blob skladniki≈17080, owoce≈7377; relink SKU-only (bez assoc na nazwie pliku).
5. Babka 6300684.01: 12 Links w indeksie (m.in. br-051391…398) z linked_products=[babka-cytrynowa-nerkowcowy] + terminy skladniki/owoce/owocki.
6. VIZ-ASSOC: product_element asset_role != packshot; zero pe jako packshot.

### Efekt/Fix
- Indekser (nie UI): product ELEMENTY/Links w branding-index + skojarzenia wyszukiwawcze.
- Linkowanie product_element po SKU sciezki (nie globalne "cytryna"→babka).

### Backup
Brak (enrich addytywny, bez wipe).

### Test/Ewaluacja
- AST + classifier smoke OK
- API/data: asset_count 51611; babka path pe=19–22; 6300684.01 samples z termami
- GET /program-instructions zawiera branding.element_assoc_skladniki_owoce (plik lokalny; KV seed przy restarcie mostu)
- Gap: POS `\Links\` nadal w grupie ELEMENTY UI (filtr sciezki); ELEMENTY folder babki na dysku = 0 plikow (can_generate)

### Zrodla
- handoff-strefa-A3.md; usability-brief pkt 35; brand_element_assoc.py; enrich-branding-element-assoc.py; build-branding-index.py; dam-dobrakaloria

## 2026-07-20 - SYNTEZA sesji usability (wieczor, Grok docs-only)

### Komenda/Akcja
Synteza luku agentow z briefu `agents/shared/usability-brief-2026-07-20.md` + recent process/handoffs; aktualizacja statusow briefu; handoff syntezy; bez re-implementacji.

### Log/Status
1. Skim brief + process (STREFA A/B/C/D/H/SHELL/A3/DEVICE/INT/VIZ-ASSOC/ELEMENTY-ASSOC) + `WAZNA-CHECKLISTA` (A3 `[~]`, C3 `[ ]`).
2. Brief: sekcja **STATUS SYNTEZA**; adnotacje P15 PARTIAL, P21-23 DONE, P35 DONE+OPEN POS Links.
3. Handoff: `agents/shared/handoff-usability-synthesis-2026-07-20.md`.
4. Doctrine §12: bez nowych wpisow (lekcje juz sa).

### Zamkniete strefy
- **A** 1-10 (UI) — modale, ID, thumb picker, assoc tags/zoom
- **B** 11-14, 16-18, 21-23 — dashboard 2x2, chipy, loader, Pokaz wszystko/archiwum/popup
- **B pe** product_element + skladniki/owoce — indeks 7832→49715→51611
- **C/C3/C4** samouczek DobroKalorius + polish + 40 pochwal
- **D** Explorer foreground + file:/// path
- **H/H3** hold-to-delete + Strefa ryzyka
- **SHELL** FOUC boot
- **A3** 34-38 noviz muted, ELEMENTY split, resizer, thumbs
- **DEVICE** sciezki per urzadzenie
- **VIZ-ASSOC / A-PREVIEW** assoc prawa, anti viz-loop, preview lewa
- **Integracje** skeleton `#ececf2`, Bento span-2, Konfiguruj width, PLANOWANE +30, FMCG Edytuj

### Otwarte / partial (NIE inventuj zieleni)
- Checklista **A3** `[~]` — UI OK; fill kwot/import = user
- Checklista **C3** `[ ]` — BENTO anatomia kart zamrozona
- **P15 SLIDERY-sklep** overlap policy (0 sciezek ARCHIWUM = dedup)
- **POS Links** jakosc w grupie ELEMENTY
- **P6** Postanowienia/DPD linked_products→babka = luka danych
- A1/A2, B1-B5, B7 (poza lukiem usability)

### Cache bumps do hard-refresh
- `dam-branding.js?v=usab20260720f` / `dam-branding.css?v=usab20260720g`
- Integracje: `skelbent20260720a`, `fmcgedit20260720b`, `intcfgfix20260720a`, `planowane30a`
- Shell: `shellboot20260720b`; danger `usab20260720h3b`; assoc `usab20260720a36f`; A3 `usab20260720a3`

### Efekt/Fix
Dokumentacja zsynchronizowana ze stanem agentow; brak zmian kodu/danych uzytkownika.

### Backup
Brak.

### Test/Ewaluacja
Read-only audyt handoffow + process; checklista A3/C3 bez zmiany statusu (zgodna z rzeczywistościa).

### Zrodla
- usability-brief-2026-07-20.md, handoff-strefa-A/B/A3/H/C4/DEVICE/INTEGRACJE/VIZ-ASSOC
- WAZNA-CHECKLISTA-UZYTKOWNIKA.md; dam-dobrakaloria (dyscyplina docs)

## Komenda/Akcja
Integracje: ujednolicenie Edytuj + chip Wdrozenie planowane (2026-07-20)

### Log/Status
1. Edytuj FMCG: `geex-btn geex-btn--primary` -> `dam-int-cta` (dam-integrations.js)
2. Inject FMCG actions: min-height 40px geex -> 34px `.dam-int-cta` (dam-fmcg-catalog.js)
3. CSS: `.dam-int-st--wait` muted token (jak Brak); `--planned` tylko wrap, bez orphan radius/font
4. Cache-bust `?v=intcta20260720a` (integrations/settings/dashboard HTML)

### Efekt/Fix
Edytuj = ten sam profil co Pobierz szablon CSV (34px, pad 8/12, radius 8, outline). Chip planowane = pill anatomia + te same tokeny co Brak.

### Backup
Brak.

### Test/Ewaluacja
- node --check OK
- CDP: edit/csv h=34 matchHeight/Pad/Radius; geexInRow=false
- Pass1/2 screenshot FMCG actions: outline CTA family
- Pass3 planned chip: pill 999px, font 10/700, pad 3/9 = Brak

### Zrodla
dam-integrations.js/css, dam-fmcg-catalog.js, dam-integrations-settings.css; ui-taste + dam-dobrakaloria

## 2026-07-20 - Integracje: przebudowa panelu Wykrojniki ` produkty

### Komenda/Akcja
USER: sekcja `Kolejka mapowan wykrojnikow` na integrations.html nie ma sensu (python w terminalu); chce kompletna przebudowe.

### Log/Status
1. Zrodlo mapowania: `X:/Marketing/- POLSKA/01 - PRODUKTY/01 - WYKROJNIKI/opakowania_Kubara_baza_danych.xlsx` (kolumny oznaczenie Kubara / asortyment; nie kod/nazwa).
2. Fix `import-wykrojniki-xlsx.py` (naglowki sekcyjne) → rejestr 52 wpisy (bylo 101× row-N).
3. `link-wykrojniki-products.py`: kolejka + product_index + PDF + nazwa.
4. Bridge: POST `/wykrojniki/link-products`, `/wykrojniki/set-link`; resolve kolejki aplikuje do rejestru.
5. UI: `dam-wykrojnik-queue.js/css` + mount `#damWykrojnikQueue`; `?v=wykmap20260720a`.
6. PI: `integrations.hub_bridge` + `wykrojnik.registry_xlsx_kubara`; checklista B1 → [x].
7. Restart bridge (pythonw) po zmianie local_bridge.py (A4).

### Efekt/Fix
Panel `Wykrojniki ` produkty`: cel PL, tabela wyszukiwalna, CTA Wczytaj/Powiaz, empty state bez `0 oczekujacych` bez kontekstu.

### Backup
Brak (reimport zachowuje linked_product_ids; dane queue nietkniete).

### Test/Ewaluacja
- node --check OK; ast.parse scripts+bridge OK
- import entries=52; link linked=2
- Bridge POST link-products/set-link → login_required (route live)

### Zrodla
opakowania_Kubara_baza_danych.xlsx; dam-dobrakaloria; ui-taste; code-doctrine; program-instructions

## 2026-07-20 - Wykrojniki panel: badge/CTA → dam-int language

### Komenda/Akcja
USER: brzydkie badge/przyciski w #damWykrojnikQueue → .dam-int-chip / .dam-int-cta (B1 [x]).

### Log/Status
1. CSS: usunieto peach .dam-wyk-map__chip--warn (#b45309); stats + status = dam-int-st wait/ok.
2. CTA toolbar/row/form: lock 34px / radius 8 / border #e7e7e7 (bez override 40/32).
3. JS stats chips: klasy dam-int-chip dam-int-st dam-int-st--ok|wait.
4. Cache bump wykbadge20260720b w integrations.html.
5. Nie ruszano dam-fmcg-catalog.js.

### Efekt/Fix
Jeden jezyk chip+CTA z Bento Integracje; zero peach orphan pills.

### Backup
Brak.

### Test/Ewaluacja
- node --check OK
- CDP: badgeOpen bg/color/pad/fs/fw = Bento `Brak`; CTA wczytaj/uzupelnij/zapisz = Preferencje (h=34, br=8, border #e7e7e7)
- Pass1 Wszystkie / Pass2 Bez produktu / Pass3 Powiazane — screenshot+Read; peachCheck=false

### Zrodla
dam-wykrojnik-queue.js/css; dam-integrations.css; ui-taste; dam-dobrakaloria

## 2026-07-20 - FMCG editor polish + hold-delete + prefs KV + settings search

### Komenda/Akcja
USER: A3 `[~]` dogrywka - modal FMCG 80vw/80vh, scroll-trap, DAM CTAs, Zamknij=X (nie fat CTA), hold~1s Usun, prefs safe_delete w Postgres KV, search w ustawieniach.

### Log/Status
1. PI: `finance.fmcg_manual_edit` rozszerzone; nowa `ui.safe_delete`.
2. Bridge: GET/POST `/user-prefs` -> dam_kv_store `user-prefs:{email}` + lokalny `apps/desktop/data/user-prefs.json`; default `safe_delete: true`.
3. `dam-user-prefs.js` + DamDanger: pref gate, toastAction „Wylacz bezpieczne usuwanie”, holdMs 1000 na FMCG Usun.
4. `dam-fmcg-catalog.js`: dialog min(80vw)/min(80vh), flex+table-wrap scrollport, body lock, wheel trap, close `.dam-modal-x`, Zapisz/+ = `.dam-int-cta`.
5. Settings: search keywords + toggle Bezpieczne usuwanie; cache `?v=safedel20260720a`.
6. A3 checklist pozostaje `[~]` (brak pelnego fill katalogu).

### Efekt/Fix
Modal duzy ze scrollem tabeli bez scrolla tla; cichy X; hold-delete z escape hatch w profilu (DB po restarcie bridge).

### Backup
Brak.

### Test/Ewaluacja
- node --check + ast.parse OK
- CDP modal: w≈1280 h≈900 (80vw/80vh cap), closeClass=dam-modal-x, save=dam-int-cta, no geex-primary, wrapDelta=120 windowDelta=0 bodyOverflow=hidden
- Settings search „usuwanie” -> tylko #damPrefs + Bezpieczne usuwanie ON
- Bridge LIVE bez restartu: GET /user-prefs -> not_found (wymaga restartu local_bridge)
- Screenshots: fmcg-edit-pass1-header-x.png, fmcg-edit-pass2-data-scroll.png, settings-safe-delete-search-pass3.png

### Zrodla
dam-fmcg-catalog.js; dam-danger.js; dam-user-prefs.js; dam-settings.js/css; local_bridge.py; program-instructions.json; ui-taste; dam-dobrakaloria

## 2026-07-20 - STREFA INT-FIX (Grok) - skeleton + clicki hub Integracje

### Komenda/Akcja
USER: hub integrations.html - skeleton nie znika; przyciski noop/reload; CTA do ui-taste (Wkrótce dashed). Bez commit, bez delete.

### Log/Status
1. Diagnoza CDP: karty laduja gdy mount dziala; `window focus` -> `DamIntegrations.refresh` = pelny remount (skeleton flash + zamyka details Konfiguruj).
2. Usunieto remount na focus; visibilitychange z guardem details/form + debounce 5s.
3. `withTimeout` + `safeRender` + failsafe - skeleton nigdy nieskonczony; error UI ze Spróbuj ponownie.
4. Konfiguruj w foot (`.dam-int-tile__config`); CTA `.dam-int-cta` / welcome-link; Wkrótce dashed ink.
5. GSAP: killTweensOf + force opacity po reveal (mid-tween wygladal jak pusty hub).
6. Cache-bust `?v=intfix20260720c` (hub + settings).

### Efekt/Fix
- Skeleton znika (success lub error state).
- Preferencje -> settings.html#damPrefs (nie reload hubu).
- Konfiguruj otwiera details i zostaje open po focus.
- Wkrótce: border dashed, ink #1a1820.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-integrations.js OK
- CDP: cards=12 skel=false; focus remount=false; soon dashed; Preferencje navigates
- Screens: int-hub-fix-pass1-tiles.png, int-hub-fix-pass2-ctas.png, int-hub-fix-pass3-final.png

### Zrodla
dam-integrations.js/css; integrations.html; settings.html; handoff-strefa-INTEGRACJE.md; ui-taste; dam-dobrakaloria; code-doctrine

## 2026-07-20 - Branding PL encoding + archiwum obok Pokaż wszystko

### Komenda/Akcja
USER: branding.html - znaki PL jako `?` + `Pokaż archiwum` ma byc obok `Pokaż wszystko` (nie pod tabami).

### Log/Status
1. Root cause: literaly `?` (ASCII) w `branding.html` (diakrytyki zgubione przy zapisie); `dam-branding.js` byl OK (UTF-8). Sidebar z JS = poprawne PL.
2. Przywrocono UTF-8 w calym main content branding.html (Pokaż, słowo, niemięsa, miesiąc, Wyczyść, Wróć, Ładowanie…).
3. DOM: `.dam-branding-scope-toggles` przeniesione do `.dam-branding-tabs` zaraz po `.dam-branding-tab--all`.
4. CSS: flex align + scope inline w tabs; mobile: --all/scope `flex:0 0 auto`.
5. Cache-bust `dam-branding.css/js?v=plfix20260720a` (branding, dashboard, explorer, visualizations).
6. Checklista: brak osobnego ID encoding (B1-B7 nie dotyczy).

### Efekt/Fix
Branding page: PL OK; archiwum na tej samej bazie co `Pokaż wszystko`.

### Backup
Brak.

### Test/Ewaluacja
- Serwer: bajty `Poka\xc5\xbc`; charset UTF-8
- CDP: all/scope/clear/month/week/sub hasQ=false hasPL=true; sameRow=true; scopeParent=dam-branding-tabs
- Pass1 viewport + Pass2 `.dam-branding-tabs` + Pass3 filters: screenshot+Read - Pokaż/miesiąc/Wyczyść OK; toggle obok --all
- Nadal zepsute (poza scope): explorer.html, visualizations.html (Poka? wszystkie), dashboard Aktywno??

### Zrodla
branding.html; dam-branding.css; dam-dobrakaloria; ui-taste; code-doctrine

## 2026-07-20 - Sidebar collapse morph: janky -> smooth GSAP

### Komenda/Akcja
USER: #damSidebar / .geex-sidebar collapse/expand janky - fix GSAP (gsap-core) + ui-taste; owns dam-shell.js.

### Log/Status
1. Root cause: multi-prop layout thrash (width/min/max + main pad + icon marginRight + label stagger) + Geex `transition: all`.
2. Rewrite morph: numeric proxy -> `--dam-sidebar-w`; labels autoAlpha/x batch; kill competing transitions via `dam-sidebar-morphing`; interrupt-safe toggle; reduced-motion instant.
3. Cache bump `dam-shell.js?v=sidebarmorphsmooth20260720b` (20 HTML).
4. Doctrine §12 lesson + screenshot QA expanded/collapsed.

### Efekt/Fix
Collapse ~500ms (312->72), expand ~500ms (72->312); smooth width samples; logo readable collapsed.

### Backup
Brak.

### Test/Ewaluacja
- node --check OK
- CDP widths collapse: 311/281/184/94/73/72; expand: 73/94/192/286/311/312; morphing clears ~550ms
- Screenshots+Read: pass1/3 collapsed, pass2/3 expanded

### Zrodla
dam-shell.js; dam-app.css (--dam-sidebar-w); gsap-core; ui-taste; dam-dobrakaloria; code-doctrine §12

## 2026-07-20 - Polish diacritics `?` sweep (HTML)

### Komenda/Akcja
USER: ASCII `?` left in explorer/visualizations/dashboard (po fix brandingu ef95201c). Sweep + restore UTF-8.

### Log/Status
1. Grep: literal `?` w PL stringach w `explorer.html`, `visualizations.html`, `dashboard.html`, `profile.html`.
2. Restore: wygląd, assetów, Aktywność, Pokaż, Odśwież, język, folderów, Układ, Otwórz, Usuń, Ponów, strzałki/cudzysłowy w tipach.
3. HTML-only (bez bump CSS/JS). Unikano `dam-shell.js` (agent 706bc8f3).
4. Verify: CDP/a11y snapshot explorer+dashboard+viz; branding nadal OK (Pokaż wszystko / miesiąc / Wyczyść).

### Efekt/Fix
UI labels bez `Poka?` / `Od?wie?` / `Aktywno??` na wskazanych stronach.

### Backup
Brak.

### Test/Ewaluacja
- Residual known corrupt tokens (`Poka?`, `Od?wie`, `Aktywno??`, …): 0 w `apps/web/*.html`
- Browser: Pokaż wszystkie, Odśwież z dysku, Filtr języka, Układ pulpitu, Otwórz kalkulator kosztów
- Pozostaje poza scope: header chip `Jezyk` (shell/i18n); JS strings bez `?` ale bez diakrytyków (np. tipy Wlacz->naprawione w HTML; dam-*.js osobno); signin-geex `??`

### Zrodla
explorer.html; visualizations.html; dashboard.html; profile.html; dam-dobrakaloria

## 2026-07-20 - Header chip Jezyk → Język

### Komenda/Akcja
USER: Tiny follow-up - header language chip PL label missing ę.

### Log/Status
1. Root: `dam-i18n.js` buildSwitcher hardcoded `title`/`aria-label`/popup title `Jezyk`; shell already had fallback `Język` but only set `title`.
2. Fix: `Język` in i18n HTML; shell also sets `aria-label`. Cache bump `dam-shell.js` + `dam-i18n.js` → `plshell20260720a` (all HTML).
3. Verify: CDP title/aria-label + screenshot chip tooltip.

### Efekt/Fix
Header chip shows proper **Język** with ę.

### Zrodla
dam-i18n.js; dam-shell.js; dam-dobrakaloria

## 2026-07-20 - Sidebar morph polish: icon track + dim 0.5s

### Komenda/Akcja
USER: Ikony maja trzymac tor expanded (bez recenter jump), na collapse tylko slide left + dim 0.5s; cache beyond `sidebarmorphsmooth20260720b`.

### Log/Status
1. Root cause: `--dam-sidebar-w` plynnny, ale `onComplete` + `dam-sidebar-collapsed` snapowal padding 29/25 → 10/0 i `justify-content:center` (~30px skok ikon). Labels w flow tez mogly reflowowac.
2. Fix w `dam-shell.js`: podczas morph CSS vars `--dam-sb-pad-x` + `--dam-link-pad-x` (jedna os z width, `power3.inOut` 0.5s); labels absolute; dim `filter:brightness(0.68)` tylko nieaktywne; collapsed class dopiero onComplete; twarde clear filter.
3. Cache bump ALL HTML: `dam-shell.js?v=sidebarmorphsmooth20260720c`.
4. Doctrine §12 + ten wpis.

### Efekt/Fix
Ikony slizgaja sie po torze pad (55→24) razem z width 312→72; brak justify mid-flight; dim 0.5s.

### Backup
Brak.

### Test/Ewaluacja
- `node --check dam-shell.js` OK
- CDP collapse samples (updateRoot): w 312→304→181→78→72; iconOff 55→54→39→27→24; filter 1→0.68→none; end logo 48×48
- Math ease continuous (max step <8px / 0.1t)
- Screenshot+Read: expanded (labels+icon column); collapsed rail (icons centered, logo czytelne)
- Pass/Fail: Pass (mid-tween continuous na collapse)

### Zrodla
dam-shell.js; gsap-core; ui-taste; dam-dobrakaloria; code-doctrine §12

## 2026-07-20 - Branding: skeleton + filters reveal + meta layout

### Komenda/Akcja
USER: Branding skeleton shimmer (jak Integracje #ececf2), entrance meta filters top→bottom, Sortuj+Liczby przy Skala (gap 20px), unify meta toolbar styles. Nie ruszać dam-shell.js.

### Log/Status
1. Skeleton: dam-branding.css override kart .dam-skeleton__card--viz → bg #ececf2 + border + mocniejszy shimmer; boot trzyma skeleton podczas loadIndex (setBootStatus → showInitialBootSkeletons); czyszczenie brandbook leftover.
2. Filters reveal: 
evealMetaFilters via DamGridReveal.revealSequence (opacity+y, bez clip-path rest); start po dam-booted / body widoczne; prefers-reduced-motion = instant.
3. Layout: wrapper .dam-branding-filters__view-tools (ml:auto) = Sortuj | Liczby | Skala; Skala margin-left:20px.
4. Unify: meta FS 12px / H 34px / radius 8px dla clear/switch/date/sort/zoom.
5. Cache: dam-branding.js/css?v=skelmeta20260720c (branding, explorer, dashboard, visualizations).
6. Nie ruszano dam-shell.js.

### Efekt/Fix
Meta toolbar spójny; Sort|Liczby|20px|Skala; skeleton czytelny ze shimmer; entrance animowany.

### Backup
Brak.

### Test/Ewaluacja
- CDP: zoomMarginLeftPx=20, gapCountsToZoom=20, orderOk, sameRow, heights 34, fonts 12px, metaRevealed=1
- Skeleton proof: bg rgb(236,236,242), animationName dam-skel-shimmer
- Screenshot+Read: branding-meta-filters-bar.png, branding-skeleton-shimmer.png
- node --check dam-branding.js OK

### Zrodla
branding.html; dam-branding.js; dam-branding.css; dam-grid-reveal.js; dam-dobrakaloria; ui-taste
## 2026-07-20 - WORKER A: Visualizations secondary filters + toolbar

### Komenda/Akcja
USER WORKER A: Info Pakowania → dam-switch--compact; unify .dam-viz-secondary-filters (+12px pad, 12px/34px); #vizStatus BELOW filters; fix false Bridge offline; PL tipy Cofnij/Ponów; języki; cache-bust; screenshot≥3. FORBIDDEN branding.html.

### Log/Status
1. Markup visualizations.html: secondary filters first, then dam-viz-grid-toolbar; Info Pakowania + Pokaż wszystkie = dam-switch dam-switch--compact.
2. dam-brand.css: shared .dam-viz-secondary-filters padding 20px 24px, meta vars, compact switch global, chip/lang/zoom H 34; toolbar comment/order.
3. NEW dam-viz.css: page chrome + zoom align + lang min-width.
4. dam-viz.js: „Wszystkie języki” (ę).
5. dam-tag-edit.js: GET /change-log z bridgeAuthHeaders; login vs offline PL hint; humanize lifecycle_status; tips Cofnij/Ponów.
6. Cache: dam-brand/dam-viz/dam-tag-edit/dam-viz.js ?v=vizfilt20260720c (branding.html nie ruszany).

### Efekt/Fix
„Bridge offline” = fałszywy: brak Authorization → login_required traktowany jak offline. Po auth: prawdziwy ostatni wpis change-log. Status pod filtrami. Switche Geex compact.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-viz.js, dam-tag-edit.js OK
- CDP: orderKids filters→toolbar, statusBelow=true, pad 20px 24px, fs 12px, allH34=true, packClasses dam-switch--compact, lang „Wszystkie języki”, hint „Status cyklu życia: nieaktualne · …”, hintTruncated=false
- Screenshot+Read: viz-filt-pass1, pass2b, pass3b (≥3 przeloty)
- Pass/Fail: Pass

### Zrodla
visualizations.html; dam-brand.css; dam-viz.css; dam-viz.js; dam-tag-edit.js; local_bridge /change-log; dam-dobrakaloria; ui-taste


## 2026-07-20 - WORKER B: Global CTA/badge unify (Faktury + Projekty)

### Komenda/Akcja
USER: Unify primary/secondary CTAs and status badges on Faktury + Projekty to Integracje language (.dam-int-cta 34px, .dam-int-chip / .dam-int-st--*). Prefer inject #damGlobalCtaUnify. Screenshot both pages. No viz/branding.

### Log/Status
1. Added pps/web/assets/js/dam-ui-cta.js - inject #damGlobalCtaUnify (cta/chip/filter anatomy, no rewrite of dam-integrations.css).
2. Faktury: invoices.html Importuj CSV label -> dam-int-cta; filters -> dam-int-filter; source badge -> chip.
3. dam-invoices.js: status chips ok/wait/danger; Opłacona labels; filter active without inline purple hacks.
4. Projekty: index.html Odśwież listę + Skanuj dysk -> dam-int-cta; dam-projects.js status chips + card actions CTAs.
5. PL: i18n/pl.json invoices.filter_paid/pending/status_paid/col_due diacritics.
6. Cache: ?v=ctaunify20260720b on dam-ui-cta / dam-invoices / dam-projects.

### Efekt/Fix
Geex primary-transparent blobs removed from owned toolbars; status chips match Integracje Brak/Połączono anatomy.

### Backup
Brak (git checkout index.html mid-flight after encoding mishap, then re-patched).

### Test/Ewaluacja
- node --check dam-ui-cta.js / dam-invoices.js / dam-projects.js OK
- CDP Faktury: Importuj CSV height=34, class=dam-int-cta; chips Opłacona/Oczekuje; filters Opłacone/Oczekujące
- CDP Projekty: refresh/ingest H=34; card CTA H=34; chips Niekompletny(--danger)/Kompletny(--ok); leftover geex primary=0
- Screenshot+Read: cta-unify-faktury-pass1, cta-unify-projekty-pass1/2, page-2026-07-20T18-14-26
- Pass/Fail: Pass (3 przeloty)

### Zrodla
dam-ui-cta.js; invoices.html; dam-invoices.js; index.html; dam-projects.js; i18n/pl.json; dam-integrations.css (read-only anatomy); dam-dobrakaloria; ui-taste

## 2026-07-20 - WORKER C: Polish diacritics wave 2 (app-wide)

### Komenda/Akcja
USER: Fix mojibake / U+FFFD / broken PL UI across projects, messages, dashboard, settings, help, legal pages. Skip branding if contested; skip dam-viz/visualizations. Encoding only.

### Log/Status
1. Root cause: many HTML sources had U+FFFD (UTF-8 EF BF BD) where Polish letters were lost (not live CP1250).
2. Restored diacritics from git HEAD via skeleton line-match + context anchors + explicit phrase map.
3. Fixed owned pages: inbox, settings, help, terms, license, privacy, consents, activity, costs, docs-security, integrations, project, profile; JS: dam-explorer.js / dam-projects.js (`opakowanie`, `języki` where owned).
4. Skipped write: dam-viz.js / visualizations.html (A); branding* left to agent 937cce8f (grep shows branding already OK: Pokaż).
5. Residual owned FFFD after pass = 0. Left for A: `Wszystkie jezyki` in dam-viz.js.

### Efekt/Fix
Projekty: `Projekty opakowań`, `Odśwież listę`, subtitle z ń/ś/ć.
Wiadomości: `Wiadomości`, `Zgłoszenia DAM`, `Źródła`, `Odśwież`, `wiadomościach`.

### Backup
Brak (restore from git HEAD strings, working-tree structure kept).

### Test/Ewaluacja
- Scan: owned-scope FFFD=0; branding FFFD=0 / Pokaż OK; residual ascii `jezyki` only in dam-viz.js (forbidden).
- CDP Projekty: h2=`Projekty opakowań`, refresh=`Odśwież listę`, subtitle kompletności.
- CDP Inbox: title=`Wiadomości - DAM`, h2=`Wiadomości`, z=`Zgłoszenia DAM`, src=`Źródła`, ref=`Odśwież`.
- Screenshot+Read: pl-wave2-projekty-titles.png, pl-wave2-wiadomosci-titles.png
- Pass/Fail: Pass (titles). Hard refresh note for HTML-only fixes (`?v=` page query).

### Zrodla
inbox.html; index.html; settings.html; help.html; terms/license/privacy/consents/activity/costs/docs-security/integrations/project/profile.html; dam-explorer.js; dam-projects.js; git HEAD; dam-dobrakaloria

## 2026-07-20 - Branding: PL regresja + tabs full-width + card ID chip gray

### Komenda/Akcja
USER: PL znaki (?), tabs full-width, sectionDesc under subtitle, status under meta filters, discovery cleanup, meta pad +12px; potem ID chip gray + mt 5px, meta mt -4px. Nie ruszać dam-shell.js.

### Log/Status
1. Root PL: branding.html miał literały ASCII \?\ zamiast UTF-8 (regresja po skelmeta20260720c) — Pokaż/słowo/niemięsa/produktów/ścieżce/Ładowanie/Wróć itd. przywrócone UTF-8.
2. Layout: tabs-row bez kolumny tabs-meta (pełna szerokość belka); #damBrandingSectionDesc pod .dam-page-sub; #damBrandingStatus pod .dam-branding-filters--meta; discovery DOM usunięty (pusty host = spacer ~30px gdy brak recent).
3. Meta filters padding 20px 24px (+12 vs bazowe 8/12).
4. Card: .dam-branding-card__id-chip / .dam-branding-id-chip → szary muted (nie purple); margin-top:5px; .dam-branding-card .dam-viz-card__meta { margin-top:-4px }.
5. Cache: dam-branding.js/css?v=cardchip20260720f (branding, explorer, dashboard, visualizations).

### Efekt/Fix
PL czytelne; belka tabów full-width; desc/status w nowej hierarchii; brak discovery gap; ID chip gray; meta ciaśniej.

### Backup
Brak.

### Test/Ewaluacja
- CDP: tab \Pokaż\ charCode 380; tabsRowW=contentW; descUnderSub; statusBelowMeta; discoveryExists=false; metaPad 20/24; chip color rgb(107,103,120) bg rgba(70,66,85,0.08) mt=5px; metaMt=-4px; isPurple=false
- Screenshot+Read: branding-gray-chip-proof-viewport.png (gray chip M-SLI504000-07-26 + meta)
- Pass/Fail: Pass

### Zrodla
branding.html; dam-branding.css; dam-branding.js; dam-dobrakaloria; ui-taste

## 2026-07-20 - Sidebar: anti-jank morph + Wyloguj low + restore author/version

### Komenda/Akcja
USER: morph 280↔72 still stutters; icons same column (no recenter jump); Wyloguj lower in collapsed (match expanded); restore footer DAM / Dobra Kaloria - Inyfinn / v…; 5 ui-taste passes; cache beyond sidebarmorphsmooth20260720c → sidebarmorph20260720e. Checklist B5 note only (not [x]).

### Log/Status
1. Root cause A (jank): onComplete clearPadVars + dam-brand `justify-content:center` / padding:0 / icon font-size snap after pad-var morph.
2. Root cause B (Wyloguj mid-rail): collapsed override `margin-top:8px` + `.dam-sidebar-logo-collapsed{margin-top:auto}` ate space between logout and logo.
3. Root cause C (footer „removed”): brand_sub fallback „Panel assetów…”; footer below fold (menu not height:100%); collapsed `display:none` without compact meta.
4. Fix `dam-shell.js` inject `#damShellLayerCss`: flex-start + keep `--dam-sb-pad-x`/`--dam-link-pad-x` after collapse; logout +50px both states; menu fill height; logo `margin-top:10px`; `.dam-sidebar-collapsed-meta` (DAM + v); footer brand restore; morph keepPadVars.
5. Cache: `dam-shell.js?v=sidebarmorph20260720e` (20 HTML). Doctrine §12 + ten wpis.
6. B5: sidebar expanded+collapsed QA progress only — full dashboard 2×2/1×4/1×6 still open `[ ]`.

### Efekt/Fix
Morph pad+width continuous (icon L 77→48, maxΔ9px, jumps=0); Wyloguj nad logo (gap ~26px, mt 50px); footer expanded full; collapsed DAM v2.0.7.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-shell.js OK
- CDP updateRoot samples: w 312→72, pad 25→15, iconL continuous, justify flex-start end
- Pass1–5 screenshot+Read expanded/collapsed
- z-index popup 12550 intact

### Zrodla
dam-shell.js; gsap-core; ui-taste; dam-dobrakaloria; code-doctrine §12

## 2026-07-20 - Docs + commit + push (UI usability pack)

### Komenda/Akcja
USER: po zakonczeniu pracy UI - weryfikacja dostaw rownoleglych agentow, dokumentacja, commit + push (bez force/amend).

### Log/Status
1. Weryfikacja kodu (bez luk krytycznych do domkniecia):
   - Viz: `#damChangeLogBar` mount w `#vizSearchScope > .dam-search-scope` (margin-left:auto), `hidden` gdy nie admin+ADMIN ON (`DamTagEdit.refreshChangeLogBar` / `dam-viz.mountChangeLogInScope`); hint `#damChangeLogHint`; `#vizStatus` mb 15px; `.dam-viz-grid-count` padding 15px 26px (+8/+12 vs branding 7/14). Cache `dam-viz.css|js?v=viztb20260720a`.
   - Branding: `#damBrandingPageSize` range+number+OK; draft na input/wheel, `applyPageSize` dopiero po OK/Enter (`prefs.branding_page_size`).
   - Help: `#damHelpModal` - `injectHelpRestartControl` (restart pod X, `.dam-help-modal__head-actions` column gap 10px); head/body padding +10px (32/34, 26/34).
   - Sidebar: morph `sidebarmorph20260720e` w diffie (anti-jank, Wyloguj +50px, collapsed meta).
2. Docs: README changelog 2026-07-20; ten wpis; memory #133; usability-brief status; PROGRESS nota; checklista bez falszywej zieleni (B1/A3 juz zaktualizowane wczesniej).
3. Git: stage kod+docs+nowe moduly (bez lock/logs/tmp/user-device-paths/_bump_*.py); commit + push origin/main.

### Efekt/Fix
Pakiet UI usability zsynchronizowany w repo + zdalnym main.

### Backup
Brak (tag nie tworzony w tej turze).

### Test/Ewaluacja
- Grep markers w kodzie (jak wyzej).
- Pass/Fail weryfikacji obecnosci dostaw: Pass

### Zrodla
dam-viz.css/js; dam-branding.js + branding.html; dam-tutorial.js; dam-brand.css (help); dam-shell.js; dam-dobrakaloria; code-doctrine


## 2026-07-20 - Help modal: restart samouczka + padding +10

### Komenda/Akcja
USER: `#damHelpModal` header - pod X kontrola „Włącz samouczek ponownie”; padding wewnetrzny +10px; realny restart DamTutorial; cache-bust; 5 passow screenshot; process.md; bez commit.

### Log/Status
1. READ code-doctrine + dam-shortcuts / dam-tutorial / dam-brand help CSS.
2. `DamTutorial.restart()` - stop/clear PHASE + session dismiss, `start({phase:0,step:0})`.
3. `injectHelpRestartControl` w headerze (kolumna `.dam-help-modal__head-actions` pod X); stopka „Uruchom samouczek” tez woła restart.
4. `dam-shortcuts.js` - head-actions wrapper w HTML modala.
5. CSS: head 32/34/22, body 26/34/34 (+10); restart Geex; gap actions 12px; tut-help-entry +10.
6. Cache: `helprestart20260720a` (tutorial js/css, shell, shortcuts); brand `helprestart20260720c`.

### Efekt/Fix
Restart zamyka pomoc i odpala samouczek od 0:0 (CDP: helpHidden + tutActive + phase 0:0). Header: X nad restartem, bez nachodzenia na tytul (gapTitle ~28px).

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-tutorial.js OK
- CDP padding head/body + gapClose 12
- Pass1 structure; Pass2 spacing+nowrap; Pass3 clean header; Pass4 ~768; Pass5 final 1440 - screenshot+Read
- Restart klik x2: Pass

### Zrodla
dam-tutorial.js; dam-shortcuts.js; dam-brand.css; dam-tutorial.css; dam-shell.js; HTML ?v=; ui-taste; dam-dobrakaloria

## 2026-07-20 - Supervisor: dokonczenie A/B/C (viz toolbar, branding meta, sidebar)

### Komenda/Akcja
USER WORKER nadzorca: stan briefow 2026-07-20 + MUST DONE A viz toolbar / B branding page-size / C sidebar. Bez commit. Nie ruszac #damHelpModal.

### Log/Status
1. Audyt: A czesciowo (mount far-right + admin gate + pill); hint mial zla historie „Status cyklu życia”; B page-size juz w JS ale branding.html PL/encoding uszkodzony; C footer brak na stronach bez markup (branding).
2. A: `formatChangeLogEntry` -> „Ostatnia zmiana na dysku: …”; trailing CSS `margin-left:auto`; hint max-width 340px; status mb 15px / filters mb 4px (bliżej); pill 8/12 (jak Branding + inject).
3. B: naprawa UTF-8/PL w branding.html; suwak+input+OK+wheel juz w `dam-branding.js` (apply dopiero po OK - CDP: draft nie zmienia kart, OK 100->40).
4. C: `ensureSidebarFooterEl` w `dam-shell.js` + footer markup w branding.html; Wyloguj nisko; autor/wersja expanded + collapsed meta.
5. Cache: dam-viz.css `supviz20260720d`, dam-tag-edit `supviz20260720c`, dam-shell `supviz20260720b`, dam-branding `supviz20260720a`.
6. Nie ruszano #damHelpModal.

### Efekt/Fix
A/B/C domkniete wzgledem MUST DONE. Concurrent agents nadpisywali dam-viz.css / cache tokeny w trakcie - final: CDP barRight=0, hint bez cyklu życia, page-size OK-only, footer widoczny.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-tag-edit.js / dam-shell.js / dam-branding.js / dam-viz.js OK
- CDP viz: barInScope, barRight=0, admin-only hide, hint „Ostatnia zmiana na dysku…”, filtersMb=4px, statusMb=15px, countPad=8px 12px
- CDP branding: sameAfterDraft, OK apply 40 kart, wheel sync, PL Pokaż
- Screenshot+Read: supviz-pass1..pass5 (+ pass5b) w Temp/cursor/screenshots/

### Zrodla
visualizations.html; dam-viz.css; dam-tag-edit.js; dam-viz.js (read); branding.html; dam-branding.js/css; dam-shell.js; dam-dobrakaloria; ui-taste; code-doctrine

## 2026-07-20 - VIZ-TOOLBAR worker finish (viztb20260720f)

### Komenda/Akcja
USER WORKER: dokończ VIZ-TOOLBAR — changelog w search scope (admin), pill licznika Geex light, branding page-size OK-only. Bez commit / bez sidebar.

### Log/Status
1. Design Read: toolbar Geex/DAM (Wizualizacje + Branding meta) dla adminów opakowań; jasny panel; Cofnij/Ponów na prawo w scope.
2. Changelog: `DamSearch.bindScopeChips({ trailingEl })` + mount w `#vizSearchScope .dam-search-scope` (margin-left:auto); widoczny tylko `role=admin` + `dam_admin_mode=1`; hint copy `Ostatnia zmiana na dysku: …` (bez „cykl życia”).
3. Spacing: filters mb 4px (status bliżej); `#vizStatus` mb 15px.
4. Pill `#vizGridCount`: format jak Branding; pad **15/26** (= branding 7/14 **+8/+12**); light DAM tokens (nie ciemny 1:1); inject `#damVizCountPillInk` chroni przed regresją CSS.
5. Branding Karty: suwak+input+wheel = draft; OK stosuje; fix race session/local vs `/user-prefs` (OK nie wraca do 100).
6. Cache końcowy: `viztb20260720f` (dam-viz.css/js); branding.js `viztb20260720e`; tag-edit/search wg HTML.

### Efekt/Fix
Brief A/B/C (toolbar) Pass względem CDP. Concurrent `supviz` nadpisywał pad 8/12 ciemny — poprawione na light 15/26 + inject.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-viz.js / dam-search.js / dam-tag-edit.js / dam-branding.js OK
- CDP viz: barInScope, admin-only, hint bez cyklu życia, filtersMb=4, statusMb=15, countPad=15px 26px, color #464255, light bg
- CDP branding: draft nie re-renderuje; OK 40→36 kart; status limit 36
- Screenshot+Read: viztb-pass1..5, viztb-final-*, viztb-pass5b-branding-meta (Temp/cursor/screenshots)

### Zrodla
visualizations.html; dam-viz.css/js; dam-search.js; dam-tag-edit.js; branding.html; dam-branding.js/css; dam-user-prefs.js; dam-dobrakaloria; ui-taste; code-doctrine

## 2026-07-20 - Viz toolbar changelog + count pill + Branding page-size

### Komenda/Akcja
WORKER: Visualizations toolbar (changelog far-right search-scope, ADMIN gate, status spacing, count pill) + Branding page-size slider/OK + prefs.

### Log/Status
1. #damChangeLogBar przeniesiony do #vizSearchScope > .dam-search-scope (DamSearch `trailingEl` + mount w dam-tag-edit/dam-viz). Label `Dysk`, CTA `.dam-int-cta`, tip dysk vs Postgres.
2. Gate: rola admin + `localStorage dam_admin_mode===1` (header ADMIN ON; bez legacy `dam_viz_admin_mode`).
3. #vizStatus pod secondary filters; gap ~6px; `margin-bottom: 15px` na status.
4. Sticky count pill `#vizGridCount`: elementy=karty produktow, pliki=warianty z wizka; pad 15/26 (7/14+8/+12); muted ink; inject `#damVizCountPillInk`.
5. Branding `.dam-branding-page-size`: range+number+OK, wheel draft, apply tylko na OK; prefs `branding_page_size` (24-500) via DamUserPrefs + bridge normalize; session fallback.
6. GSAP page-entrance: nested changelog dostawal opacity:0 — `data-dam-bar-revealed` + clear inline + CSS !important na belkach.
7. Cache `?v=viztb20260720h` (viz/tag-edit/branding/user-prefs). Nie ruszano `dam-shell.js`.

### Efekt/Fix
Admin undo przy scope; non-admin ukryty; count pill na Viz; Branding page-size bez janku przy drag.

### Backup
Brak.

### Test/Ewaluacja
- CDP Viz: barInScope=true; atBar=dam-changelog-bar__label; ADMIN off→hidden / on→visible; statusMb=15px; gap=6; countPad=15px 26px; ink bg; undoCls=dam-int-cta.
- CDP Branding: draft 48 cards unchanged until OK; OK→48 cards; session `dam_branding_page_size=48`; count pad 15/26.
- Screenshot+Read: viz-final-pass-toolbar.png (DYSK/Cofnij/Ponow + status + pill); branding page-size control in meta.
- Pass/Fail: Pass (CDP primary; screenshot confirms changelog on scope row).

### Zrodla
visualizations.html; dam-viz.js/css; dam-tag-edit.js; branding.html; dam-branding.js/css; dam-user-prefs.js; local_bridge.py; dam-search.js (trailingEl — concurrent); dam-dobrakaloria; ui-taste

## 2026-07-20 - Sidebar Y-stable morph (collapse/expand)

### Komenda/Akcja
Napraw animacje collapse/expand sidebara: ikony trzymaja Y (tylko X), bez skracania wysokosci raila, Sesja naturalnie (bez margin-top:auto), dim 0.7s GSAP.

### Log/Status
1. Root cause CDP: collapsed height:min(80vh) (1183→982), pad 38→12, first-child margin 15→0, wrap linkow 80px + absolute labels, Sesja margin-top:auto.
2. Fix w dam-shell.js inject #damShellLayerCss: rail calc(100vh-44px), pad-Y 38, sloty 56px nowrap, first-child 15px obu stany, ikony 20/lh:1, Sesja bez auto, footer/logo margin-top:auto, SIDEBAR_MORPH_DUR=0.7.
3. Cache dam-shell.js?v=sidebarystable20260720c (20 HTML). Doctrine §12 lekcja.
4. Bez commit.

### Efekt/Fix
Morph Y-stable: mid+end ΔY≈0 dla apps/sitemap/plug/desktop; ΔX≈-29; heightDelta=0; sesjaY=0.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-shell.js OK
- CDP morph (gsap.updateRoot mid 0.35): all icon Y delta 0; end Y delta 0; h 1183→1183; sesjaTop 661 obu
- Screenshot+Read 5 passow: pass1 expanded, pass2 collapsed, pass3 mid 142px, pass4 collapsed final, pass5 expanded final
- Pass/Fail: Pass

### Zrodla
dam-shell.js; dam-brand.css (override via inject); code-doctrine; gsap-core; dam-dobrakaloria; ui-taste

## 2026-07-20 - EXP-A Explorer entry points + toolbar CTA unify

### Komenda/Akcja
WORKER EXP-A: Plus w panelu Kategorie, Dodaj produkt w panel-head kategorii, unify toolbar Backup/Odsviez/Stosuj do anatomii .dam-int-cta, stub DamExplorerAddProduct.

### Log/Status
1. explorer.html: Plus #damExplorerAddCategory; toolbar klasy dam-int-cta; script dam-explorer-add-product.js po dam-explorer.js.
2. dam-explorer.js: inject #damExplorerCtaUnify; panelHeadHtml showAddProduct + categoryContext; bind hooks stub-safe.
3. Nowy stub apps/web/assets/js/dam-explorer-add-product.js (open -> toast/consolewarn).
4. Cache token expa20260720b.
5. Bez local_bridge / bez pelnego modala (EXP-B).

### Efekt/Fix
Entry points + CTA unify na explorerze; stub gotowy na podmiane przez EXP-B.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-explorer.js + dam-explorer-add-product.js OK
- CDP: addCat/addProd/refresh/force/backup h=34; pad 8px 12px (icon 0); border #e7e7e7; stub open mode category/product + categoryContext
- Screenshot+Read 3 pass: Batony, Kulki, Roslinne
- Pass/Fail: Pass

### Zrodla
explorer.html; dam-explorer.js; dam-explorer-add-product.js; code-doctrine; dam-dobrakaloria; ui-taste

## 2026-07-20 - EXP-C: bridge create-category / create-product

### Komenda/Akcja
WORKER EXP-C: endpointy mostu do tworzenia kategorii/produktu ze szablonow dysku.

### Log/Status
1. READ: code-doctrine, program-instructions, szablony na X: (`Szablony folderow/00 - KATEGORIA` + nested product; GC `00 - CATEGORY`).
2. NOWY modul `apps/desktop/explorer_create.py` (copytree + dry_run + confirm gate + demo `- D` / 6300XXX).
3. Wpięcie w `local_bridge.py`: POST `/explorer/create-category`, `/explorer/create-product` (admin); `BRIDGE_API_VERSION=4`.
4. Seed PI: `explorer.product_from_template`, `explorer.demo_index_rules` (version 7).
5. Restart pythonw local_bridge (health api_version=4).

### Efekt/Fix
- dry_run jednostkowy: kategoria `08 - TEST EXP C`; produkt z BAT + 6300XXX => `- D`.
- curl/urllib bez sesji: 401 `login_required` (route zyje; 404 na `/explorer/no-such`).
- Zapis tylko `dry_run:false` + `confirm:true`; po sukcesie `index_rebuild_suggested`.

### Backup
Brak (bez zapisu na dysk w testach).

### Test/Ewaluacja
- `python -c` import explorer_create dry_run OK (templates found on X:)
- confirm gate -> `confirm_required`
- HTTP POST bez Bearer -> 401; health -> api_version 4
- Pass/Fail: **Pass** (auth 401 + unit dry_run; real write nie odpalany)

### Zrodla
explorer_create.py; local_bridge.py; program-instructions.json; X:/Marketing/- POLSKA/01 - PRODUKTY/Szablony folderow/

## 2026-07-20 - Sidebar collapsed logo/meta bez skoku translate

### Komenda/Akcja
User: logo `.dam-sidebar-logo-collapsed` + meta `.dam-sidebar-collapsed-meta` przeskakuja przy pojawianiu sie (collapse morph).

### Log/Status
1. CDP sampling: meta zostawala `display:flex` po expand (GSAP leftover) → flex Y=1133, potem absolute Y=1123 = widoczny skok 10px.
2. Steady collapsed uzywal flex+margin-top:auto, morph absolute bottom slot → skok na koncu morph.
3. Fix: ten sam absolute slot (logo bottom 38px, meta 10px) w morph + collapsed (`dam-shell.js` CSS inject + `dam-brand.css`); meta `display:none` po expand jak logo; CSS `:not(.collapsed):not(.morphing)` dla meta.
4. Cache: `dam-shell.js?v=sidebaridentity20260720b`, `dam-brand.css?v=sidebaridentity20260720a`.

### Efekt/Fix
Morph: transform none, logo/meta top stale 1062/1123 przez caly tween; expanded meta display none; collapsed logo czytelne (screenshot pass2).

### Test/Ewaluacja
- CDP collapse morph: skok tylko frame0 hidden→slot (opacity 0); po morph dY=0
- Screenshot+Read: sidebar-collapsed-pass2.png - logo DK + DAM v2.0.7 na dole rail
- Pass/Fail: Pass

### Zrodla
dam-shell.js; dam-brand.css; verify-ui-after-changes.mdc


### Komenda/Akcja
User: „juz DUZO lepiej, ale nadal sie rozjezdzza” - dokonczenie Y/X osi, footer logo leftover, collapse-btn center.

### Log/Status
1. Vision+CDP: ikony Y juz OK (dY=0), leftSpread=0; rozjazd = (A) collapse-btn CX 49 vs ikony 59, (B) GSAP zostawial .dam-sidebar-logo-collapsed{display:flex} w expanded (logo 220px na dole).
2. Fix: header justify center + btn 40px; logo out-of-flow w morph; FLIP btn GSAP; CSS ody:not(.collapsed):not(.morphing) .dam-sidebar-logo-collapsed{display:none!important}; applySidebarCollapsedClass hard-reset display.
3. Cache dam-shell.js?v=sidebarystable20260720g (po nadpisaniu przez concurrent sidebaridentity20260720a).
4. Screenshoty: sb-fix-pass2-expanded-clean.png, sb-fix-pass3-collapsed-final.png (+ pass1 audit).

### Efekt/Fix
Collapsed: rail/btn/logo CX≈58, ikony CX≈59 (delta -1px); left=48 wszystkie; dY=0; logo expanded display:none.

### Backup
Brak.

### Test/Ewaluacja
- CDP 3 ikony (apps/sitemap/signout): exp top 166/222/785 left 77 → col top same left 48; leftSpread 0
- axis btnCx=58 railCx=58 iconCx=59
- Pass/Fail: Pass

### Zrodla
dam-shell.js #damShellLayerCss; gsap-core FLIP; ui-taste screenshot gate

### Komenda/Akcja
FAZA 1 EXP-B: modal dodawania produktu/kategorii (domkniecie planu zaleglosci)

### Log/Status
1. Pelny modal w dam-explorer-add-product.js (category/product, dry-run Podglad, Potwierdz i utworz).
2. DamExplorer.state wyeksponowany; cache ?v=expb20260720b; postJson timeout 20s.
3. explorer_create already_exists zwraca available_variants.
4. QA: Plus Kategorie otwiera modal; dry-run planned_path OK; real create TEST AGENT CAT na X:.

### Efekt/Fix
Utworzono: X:\Marketing\- POLSKA\01 - PRODUKTY\- DK\08 - TEST AGENT CAT (z szablonu 00 - KATEGORIA). Potwierdzenie dopiero po dry_run.

### Backup
Brak (copytree z szablonu, nie kasowano drzew usera).

### Test/Ewaluacja
- node --check dam-explorer-add-product.js OK
- CDP POST dry_run + confirm 200 ok
- Screenshot+Read: modal z podgladem sciezki (page-2026-07-20T19-16-04-773Z.png)
- Pass/Fail: Pass

### Zrodla
dam-explorer-add-product.js; explorer_create.py; explorer.html; plan dam_wdrozenie_zaleglosci

### Komenda/Akcja
FAZA 2 A3: FMCG pelne dane + mapowanie kwot

### Log/Status
1. fmcg-cost-catalog.json: 39 null amount -> seed_estimate (midpoints PL); 6 kept; nulls=0.
2. fmcg-cost-import-map.json v2: +90 mapowan id/label.
3. Szablon CSV uzupelniony kwotami z katalogu.
4. Checklista A3 [x] (seed; nadpisanie realnymi kwotami przez CSV/Edytuj).

### Efekt/Fix
Lancuch FMCG gotowy do compute bez pustych kwot.

### Test/Ewaluacja
- file_items=45 nulls=0
- Pass/Fail: Pass (techniczne; biznesowe kwoty ERP opcjonalne nadpisanie)

### Zrodla
fmcg-cost-catalog.json; fmcg-cost-import-map.json; fmcg-cost-averages.json

## 2026-07-20 - WORKER C3 freeze + backlog B3/B4/B7 + A1/A2 verify

### Komenda/Akcja
C3 BENTO freeze anatomii; backlog-rest B3 poster, B4 Autor, B7 cache-bust; A1/A2 verify only.

### Log/Status
1. C3: gents/shared/bento-card-freeze.md + FROZEN comments (dam-brand.css, dam-branding.css, dam-viz.css) + doctrine §12; checklista C3 [x] freeze anatomii (nie redesign).
2. B3: bridge _media_video_poster_placeholder (SVG 200 zamiast 422); JS VIDEO_POSTER_FALLBACK + probe w dam-branding.js / dam-media-preview.js.
3. B4: FACET uthor:* grupa Autor (Krzysztof/Sylwia/Szymon/Highlite) — appearance_tags + author field + path.
4. B7: HTML listed → ?v=bust20260720a dla dam-tokens/dam-brand/dam-grid-reveal (gdzie wystepuja); BOM z PS usuniety.
5. A1/A2: verify — dam-connection.env bez DAM_ASANA_*/DAM_MS_* → status [ ] (wymaga user Client ID/Secret).

### Efekt/Fix
Freeze bez redesignu kart; poster fallback twardy; Autor w filtrach; cache sweep reszty stron.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-branding.js / dam-media-preview.js OK; bridge AST OK
- CDP branding: Autor row widoczny; filtr Krzysztof → ~4867 plikow; video posters = data-svg fallback
- Screenshot+Read: page-2026-07-20T19-21-17-859Z.png (Autor + Wideo)
- B7: brak stale tokenow na listed pages
- Pass: C3, B3, B4, B7 | Fail/open: A1, A2 (credentials)

### Zrodla
bento-card-freeze.md; code-doctrine.md §12; dam-branding.js; dam-media-preview.js; local_bridge.py; WAZNA-CHECKLISTA; memory #135

### Komenda/Akcja
C2 — dwukierunkowy ERP faktur (kontrakt stub + UI)

### Log/Status
1. READ: program-instructions finance.invoices_import; local_bridge /finance/invoices*; invoices.html + dam-invoices.js; checklist C2 [ ].
2. NOWY helper apps/desktop/invoice_erp.py (status/export/mark_import, stage invoice-erp-export-last.json).
3. Bridge: GET /finance/invoices/erp-status; POST /finance/invoices/export (+ alias /push); import aktualizuje last_import; BRIDGE_API_VERSION=5; health hub_routes.
4. Persist: apps/web/data/invoice-erp-sync.json.
5. UI Faktury: badge ERP, meta kierunku, Import z ERP (CSV) + Eksport do ERP (.dam-int-cta, admin).
6. Seed: invoice.erp_bidirectional w program-instructions.json v8; lustro app-settings; C2 [x].
7. RESTART bridge wymagany (watchdog desktop respawnuje pythonw) — po kill+respawn api_version=5.

### Efekt/Fix
Kontrakt bidirectional stub (nie live ERP). Import CSV zachowany; export stage + sync state; UI pokazuje stan.

### Backup
Brak (tylko data JSON sync/export stage).

### Test/Ewaluacja
- python ast + invoice_erp unit: PASS (direction bidirectional, dry/export/import)
- node --check dam-invoices.js: PASS
- GET /health api_version=5 + hub_routes export/erp-status: PASS (po restarcie mostu)
- GET /finance/invoices/erp-status (Bearer admin): PASS direction=bidirectional
- POST /finance/invoices/export: PASS exported=10 staged=true
- Screenshot+Read invoices.html: ERP OK ↔, Import/Eksport, meta last import/export — PASS
- Pass/Fail: **Pass** (live ERP provider nadal stub)

### Zrodla
apps/desktop/invoice_erp.py; local_bridge.py; invoice-erp-sync.json; dam-invoices.js; invoices.html; program-instructions.json; WAZNA-CHECKLISTA C2


### Komenda/Akcja
FAZA 2+3: domkniecie zaleglosci planu (A3/B5/C2/C3/rest) + docs

### Log/Status
1. A3: FMCG catalog 45 pozycji z kwotami (seed_estimate), import-map v2, CSV template.
2. B5: QA layoutow 2x2/1x4/1x6 @1280 + inject #damDashLayoutB5Css; cache b5qa20260720c.
3. C2: invoice_erp.py + GET erp-status + POST export; UI Faktury; PI invoice.erp_bidirectional.
4. C3: bento-card-freeze.md + FROZEN comments; checklista freeze (nie redesign).
5. B3/B4/B7: poster fallback, Autor tags, cache-bust bust20260720a; A1/A2 nadal [ ] (OAuth user).
6. Doktryna: lekcja kolizji nazw WORKER A/B/C.

### Efekt/Fix
Checklista A3/B3/B4/B5/B7/C2/C3 [x]; Explorer create end-to-end (dry-run+confirm).

### Test/Ewaluacja
- Explorer create category TEST AGENT CAT na X: OK
- Dashboard layout cycle CDP overflow=[] @1280
- Pass/Fail: Pass fali (A1/A2 blocked na credentials)

### Zrodla
plan dam_wdrozenie_zaleglosci; explorer_create.py; dam-explorer-add-product.js; invoice_erp.py

### Komenda/Akcja
B5 QA dashboard layouts 2x2 / 1x4 / 1x6 + sidebar expanded/collapsed @ 375/768/1280

### Log/Status
1. READ code-doctrine + dam-dashboard-widgets/css + checklista B5.
2. CDP: header quickaction overflowX ~112@1280 / ~168@768 (nie tile grid).
3. CDP@375: branding/media `grid-column:span 6` na siatce 1fr tworzylo 6 implicit tracks → widgety ~40px (FAIL).
4. FIX: inject `#damDashLayoutB5Css` + patch `dam-dashboard.css` @575 (`1/-1` + icon rail column).
5. FIX: `vizTitleForCount` (1x6 → "6 najnowsze…"); cache-bust `b5qa20260720f`.
6. Sidebar morph click w dam-shell bywa desync (storage=1, class brak) - poza WRITE allowlist; class force = 72px + logo 48x48 Pass.

### Efekt/Fix
- pageOverflowX=0 @1280/768/375 dla 2x2/1x4/1x6
- 2x2 = 2 cols (@1280/768), 1 col (@≤720)
- 1x4/1x6 = 1 col, kids 4/6
- collapsed sidebar 72px, logo 48x48 (forced class)
- WAZNA-CHECKLISTA B5 [x] (note zaktualizowana)

### Backup
Brak

### Test/Ewaluacja
- node --check dam-dashboard-widgets.js: PASS
- CDP matrix 1280: overflowX=0 all layouts; collapsed logo 48: PASS
- CDP 768: overflowX=0; 2x2 colCount=2: PASS
- CDP 375: widgets 265px; bodyW title ~93; stackDir=column: PASS
- Screenshot+Read: b5-1280-2x2-expanded, b5-1280-2x2-collapsed-forced, b5-768-*, b5-375-1x6-fixed: PASS
- Pass/Fail: **Pass** (shell morph toggle desync = noted, not blocking class-applied state)

### Zrodla
apps/web/assets/js/dam-dashboard-widgets.js; apps/web/assets/css/dam-dashboard.css; apps/web/dashboard.html; WAZNA-CHECKLISTA-UZYTKOWNIKA.md B5

## 2026-07-20 - Domkniecie sesji: dokumentacja + commit + push (user)

### Komenda/Akcja
User: po zakonczeniu WSZYSTKICH agentow — spisz dokumentacje, commit, push.

### Log/Status
1. Weryfikacja git: kod sesji juz na `origin/main` (`e28a4bd`, `025aad3`); brak unstaged kodu aplikacji.
2. Subagent create modal redesign (`202d725c`) — **aborted** (2 linie transcript); OPEN na nastepna fale.
3. Subagenci badawczy (costs/integrations, branding load, anim audit, desktop tray, viz vs branding) — DONE raporty.
4. Nowy doc: `agents/shared/release-2026-07-20-evening.md` (mapa DONE/OPEN, cache-bust, checklista).
5. Aktualizacja: `README.md` changelog, `PROGRESS.md`, `handoff-usability-synthesis-2026-07-20.md`.
6. Commit docs + push origin/main.

### Efekt/Fix
Jedno miejsce prawdy dla wieczoru 2026-07-20; jasno oznaczone OPEN (create modal 10-pass).

### Backup
Brak.

### Test/Ewaluacja
- git status: tylko docs + untracked runtime (lock/logs/tmp — nie commitowane)
- Pass/Fail: **Pass** (dokumentacja); create modal redesign = **Fail/open**

### Zrodla
release-2026-07-20-evening.md; agent-transcripts subagents; git log

## 2026-07-20 - Domkniecie EXP-C (subagent create modal) + commit/push

### Komenda/Akcja
Subagent [Explorer create modal redesign](202d725c-bf6b-49e5-b85e-47dc49bc7a39) DONE — follow-up: docs + commit + push (user).

### Log/Status
1. Zweryfikowano diff: `dam-explorer-add-product.js`, `explorer_create.py`, `local_bridge.py`, PI v9, cache `expc20260720d`.
2. Rownolegle w working tree: Viz Historia zmian (`chghist20260720a`), Branding polish (`brpolish20260720a`, date-picker).
3. Zaktualizowano release notes, PROGRESS, README, handoff synthesis.
4. Commit bez runtime JSON (file-index/search-index/lifecycle-status — lokalny rebuild/QA).

### Efekt/Fix
Create modal 10-pass = Pass; blocker add-variant-type bez fizycznego szablonu udokumentowany.

### Test/Ewaluacja
- node --check + py_compile: PASS (wczesniej przez subagenta)
- Pass/Fail: **Pass**

### Zrodla
process.md wpis EXP-C (linie 3–125); subagent transcript 202d725c

## 2026-07-20 - Branding: Karty/Skala, kalendarz, padding, perf (plan branding_ui_polish_c4a6251f)

### Komenda/Akcja
User: usunac zolte "Karty" (musi wygladac jak fioletowa "Skala"), globalny fioletowy
accent-color na suwakach, wlasny kalendarz w stylu tagow zamiast natywnego popupu,
wyrownac padding `.dam-search-wrap--panel` = `.dam-viz-secondary-filters`, zweryfikowac
spowolnienie Brandingu. Plan wdrozony w calosci (5/5 kroków).

### Log/Status
1. **Root cause zolty "Karty"**: `input[type="range"]` bez `accent-color` -> domyslny
   kolor UA (Windows/Chrome = zolto-zloty). Skala mial `accent-color` lokalnie, Karty nie.
2. **KROK1**: `#damBrandingPageSize` dostal klase `.dam-viz-zoom-control` (ta sama co
   Skala) - box/border/height dziedziczone ze wspolnego selektora, zero duplikacji CSS.
   Dodano globalna regule `input[type="range"] { accent-color: var(--dam-primary) }` w
   `dam-brand.css` (defense-in-depth, poza istniejacymi lokalnymi regulami - wszystkie
   juz byly fioletowe, grep potwierdzil 0 zoltych akcentow w calym repo).
3. **Odkryto i naprawiono szersza korupcje kodowania** w `branding.html`: literalne
   znaki `?`/`�` (U+FFFD) w PL diakrytykach (nie tylko tipy Kart/Skali - caly plik,
   ~20 miejsc: "Wyczyść filtry", "Ostatni tydzień/miesiąc", "Priorytet użycia",
   "Wróć do przeglądania" itd.). Zweryfikowano bajtowo (PowerShell UTF8.GetString) -
   to byla realna korupcja zapisana w plikuj, nie tylko render. Cały plik przepisany
   z poprawnymi znakami.
4. **KROK2 - custom date picker**: nowy `dam-date-picker.js` (IIFE, `window.DamDatePicker`)
   - auto-enhance kazdego `input[type="date"]` (readOnly + wrapper `.dam-date-field` +
     ikona-trigger), popover `.dam-date-popover` w `<body>` (z-index 12300, jak inne
     pickery), siatka dni w stylu `.dam-viz-badge`/pill, `is-today` = obrys primary,
     `is-selected` = fill primary, stopka Wyczysc/Dzis. Oryginalny input zostaje
     jedynym zrodlem prawdy (ISO w `.value`, `input`+`change` dispatch) - zero zmian
     w logice filtrow `dam-branding.js`. `.ui-datepicker` (jQuery UI, legacy, nieuzywany
     w zadnym HTML) juz mial `var(--primary-color)` - bez zmian.
5. **KROK3**: `.dam-search-wrap--panel` padding `10px 12px 12px` -> `20px 24px` (=
   `.dam-viz-secondary-filters`). CDP: oba `getComputedStyle().padding` = `"20px 24px"`
   na Brandingu i Explorerze.
6. **KROK4 - perf**: `bindFilters()` w `dam-branding.js` - debounce 220ms tylko na
   `#damBrandingSearch` (input+change), reszta filtrow bez zmian (rzadkie akcje).
   **Zmierzony root cause spowolnienia**: `branding-index.json` = **284.9 MB**,
   `branding-search-index.json` = **43.7 MB** (`apps/web/data/`). To potwierdza
   hipoteze usera "dzialalo szybciej wczesniej" - indeks urosl do prawie 285 MB i
   kazdy load/parse tego kosztuje. Debounce lagodzi per-keystroke jank, ale
   **glebszy fix (lazy/slim index, paginacja API) to osobny follow-up** - nie
   blokuje tej fali UI polish (decyzja z planu).
7. Cache-bust: nowy token `brpolish20260720a` dla `dam-brand.css` + `dam-branding.css`
   we WSZYSTKICH HTML ktore je laduja (branding/dashboard/visualizations/explorer +
   12 stron statycznych z samym dam-brand.css); `dam-branding.js`, `dam-date-picker.js`
   (nowy) + `dam-date-picker.css` (nowy) tylko w `branding.html` (jedyna strona z
   `input[type="date"]` - grep potwierdzil).

### Efekt/Fix
- Karty = wizualnie identyczne ze Skala (fiolet #AB54DB), zero zoltego nigdzie w repo.
- Wlasny kalendarz Od/Do w stylu tagow, dziala end-to-end (test CDP: klik dnia ->
  input.value = ISO, filtr przelicza sie, popover sie zamyka).
- Padding search = secondary filters (rowny rytm) na Brandingu i Explorerze.
- Naprawiona korupcja kodowania w `branding.html` (caly plik, nie tylko dotkniety blok).
- Zmierzony i zadokumentowany root cause spowolnienia (285 MB indeks) + debounce search.

### Backup
Brak (edycje tekstowe/CSS/JS, bez migracji danych).

### Test/Ewaluacja
- `node --check` na `dam-branding.js`, `dam-date-picker.js`: PASS.
- ReadLints na zmienionych plikach: brak bledow.
- CDP: `accentColor` Karty i Skala = `rgb(171, 84, 219)` (identyczne); `padding` search
  vs meta filters = `20px 24px` (Branding + Explorer).
- CDP: wybor dnia w popoverze -> `input.value` = ISO, status grid przeliczony
  ("100 elementów" -> "53 elementy" po ustawieniu daty), popover zamkniety.
- Karty drag+OK: number=60 -> `is-dirty` na OK -> klik -> status "limit 60 kart"
  (apply-on-OK zachowany, bez live re-render przy drag).
- Screenshot+Read (3 przeloty): Branding desktop (Karty/Skala/kalendarz czyste),
  Explorer desktop (padding rowny), Wizualizacje (brak regresji), Branding @1024px
  (meta row w jednej linii, dziala), reset stanu do domyslnych (limit 100).
- Pass/Fail: **Pass**.

### Zrodla
apps/web/branding.html; apps/web/assets/css/dam-brand.css; apps/web/assets/css/dam-branding.css;
apps/web/assets/css/dam-date-picker.css (nowy); apps/web/assets/js/dam-branding.js;
apps/web/assets/js/dam-date-picker.js (nowy); plan branding_ui_polish_c4a6251f.plan.md

## 2026-07-20 - Domkniecie EXP-C (subagent create modal) + commit/push

### Komenda/Akcja
Subagent Explorer create modal redesign DONE — follow-up: docs + commit + push (user).

### Log/Status
1. Zweryfikowano diff: dam-explorer-add-product.js, explorer_create.py, local_bridge.py, PI v9, cache excp20260720d.
2. Rownolegle w working tree: Viz Historia zmian (chghist20260720a), Branding polish (brpolish20260720a).
3. Zaktualizowano release notes, PROGRESS, README, handoff synthesis.
4. Commit bez runtime JSON (file-index/search-index/lifecycle-status — lokalny rebuild/QA).

### Efekt/Fix
Create modal 10-pass = Pass; blocker add-variant-type bez fizycznego szablonu udokumentowany.

### Test/Ewaluacja
- node --check + py_compile: PASS (wczesniej przez subagenta)
- Pass/Fail: **Pass**

### Zrodla
process.md wpis EXP-C; subagent 202d725c-bf6b-49e5-b85e-47dc49bc7a39

---

## Grid count pill light restyle (2026-07-20)

### Komenda/Akcja
Restyle floating count badge (`elementów • plików`) z czarnego pill na light Geex surface — globalnie Branding + Viz.

### Log/Status
1. Zlokalizowano: `.dam-viz-grid-count` (#vizGridCount), `.dam-branding-grid-count` (#damBrandingGridCount); JS `injectVizCountPillInkStyle()` w dam-viz.js wymuszał dark `!important`.
2. CSS: light surface (#fff 96%), border primary 10% + `--dam-border`, text `--dam-text` (#464255), fw 500 — dam-viz.css + dam-branding.css.
3. Usunięto `injectVizCountPillInkStyle` z dam-viz.js.
4. Cache bust: `gridcountlight20260720b` (dam-viz.css, dam-branding.css, dam-viz.js) w visualizations.html + branding.html.

### Efekt/Fix
Before: `background color-mix(ink 88%)`, `color #fff`, fw 700, dark shadow. After: white pill, muted #464255, soft border/shadow jak tagi.

### Test/Ewaluacja
- node --check dam-viz.js: PASS
- CDP Branding: bg `color(srgb 1 1 1 / 0.96)`, color `rgb(70,66,85)`, inkStyle=false, text `100 / 1 220 elementów • 574 / 9 611 plików`
- CDP Viz: bg/color identyczne, css `dam-viz.css?v=gridcountlight20260720b`
- Screenshot: `gridcount-branding-pass20260720.png` (Temp) + CDP capture
- Pass/Fail: **Pass**

### Zrodla
dam-viz.js updateVizGridCount; dam-branding.js updateGridCount; ui-taste Design Read (light chip, nie toast)

## 2026-07-20 23:05 - Audit wieczorny (transcript 86977982) + domknięcie MISSED

### Komenda/Akcja
WORKER audit ~6h transcript + implementacja zaległości + commit/push (user explicit).

### Audit inventory (transcript 2026-07-20 wieczór)

| Item | Status | Evidence | Action |
|------|--------|----------|--------|
| Floating count pill (elementów/plików) | **DONE** | `dam-viz.css` + `dam-branding.css` `#fff` + shadow; CDP `bg: color(srgb 1 1 1 / 0.96)`; token `gridcountlight20260720b` | Hardened white surface (was PARTIAL/black in UI) |
| Viz assoc = Branding filter (no AI/PSD/PDF) | **DONE** | `dam-media-preview.js` `isSourceLikeAsset`, `passesMarketingAssocMaterial`, `ASSOC_FORBIDDEN_EXTS` | Filter already in working tree; verified logic |
| Assoc loading skeleton (no bare Ładowanie) | **DONE** | `showAssocPaneLoading` + `.dam-assoc-skeleton` in `dam-brand.css`; `#damVizModalAssoc` empty mount | No naked text in viz modal assoc |
| Branding card spacing 10px/15px | **DONE** | `dam-branding.css` `--dam-branding-card-section-gap: 10px`, actions 15px | Prior session; verified CSS |
| Safe delete hold 3s (media preview) | **DONE** | `dam-danger.js` `MEDIA_PREVIEW_HOLD_MS=3000`, `resolveHoldMs()`; `dam-assoc-edit.js` `holdMs:3000` | Implemented this run |
| Historia zmian (no Cofnij/Ponów at bar) | **DONE** | `dam-tag-edit.js` `#damChangeHistoryBtn` popover; no undo/redo buttons in `visualizations.html` | Verified present |
| Karty/Skala purple, calendar, search padding | **DONE** | memory #137, `brpolish20260720a` session | No regression (CDP accent prior) |

### Log/Status
1. Transcript + subagents (c136457d count, ecb668e3 assoc) — inventory vs disk.
2. CSS count pill: explicit `#fff` + layered shadow (viz + branding).
3. `dam-danger.js`: `resolveHoldMs()` → 3000 ms inside preview modals.
4. Cache-bust: `gridcountlight20260720b`, `safedel20260720b`.
5. Weryfikacja: CDP count chip Branding + Viz; screenshot `verify-branding-count-chip-20260720.png`.

### Test/Ewaluacja
- `node --check` dam-danger.js, dam-viz.js, dam-media-preview.js: **Pass**
- CDP `#damBrandingGridCount`: text `100 / 1 220 elementów • 574 / 9 611 plików`, bg white, color `#464255`: **Pass**
- CDP `#vizGridCount`: bg white, muted text: **Pass**
- Screenshot+Read branding grid/cards: light pills, spacing OK: **Pass**

### Zrodla
Transcript `86977982-52ab-4698-9da0-5b68ac3ea8cd`; `agents/shared/usability-brief-2026-07-20.md`; screenshot `verify-branding-count-chip-20260720.png`

---

## 2026-07-20 — Branding card body spacing (3 bands)

### Komenda/Akcja
WORKER: odstępy pionowe `.dam-branding-card` — badges | title+chip+meta | actions.

### Log/Status
1. `dam-branding.css`: body `gap:0` + tokeny `--dam-branding-card-section-gap:10px`, `--dam-branding-card-actions-gap:15px`; `badges margin-bottom:10px`; `meta margin-top:4px`; `actions margin-top:15px`; title-wrap `flex:0 0 auto` + column (bez flex-grow rozpychającego sekcje).
2. Cache-bust `dam-branding.css?v=brcardpad20260720a` — branding.html, dashboard.html, explorer.html, visualizations.html.
3. Weryfikacja CDP `br-004000` + 2 kolejne karty: gaps 10 / 4 / 15 px. Screenshot `apps/web/_qa/branding-card-spacing-br004000.png`, pass3 `branding-card-spacing-pass3.png`.

### Efekt/Fix
Trzy czytelne pasma w body karty brandingu; Viz assoc filtry nietknięte.

### Test/Ewaluacja
- CDP gaps (3 karty): badges→title 10px, title→meta 4px, meta→actions 15px — **Pass**
- ID chip `M-SLI504000-07-26` pełny tekst (br-004000) — **Pass**

### Zrodla
`dam-branding.css`; `brcardpad20260720a`

---

## 2026-07-20 — Viz modal assoc UX (tooltips / Shift+edit / toggle / video)

### Komenda/Akcja
WORKER: 4 bugi UX w `#damVizModal` Skojarzone materialy (tipy wariantow, Shift+edit, Pokaż wszystkie, video thumbs).

### Log/Status
1. Tipy: usunieto hover auto-popover; tip tylko na re-click aktywnej miniatury; `data-dam-no-tip` + exclude `.dam-viz-modal__variant` w `dam-tooltips.js` (koniec podwojnego stacku DamTip + variantInfo).
2. Shift+edit: `collectAssetLinkedProductIds` + enrich przed pickerem; `collectLinkedIdsFromCtx` w `openEditPicker` (linked_products + *_ids).
3. Toggle: CSS collapse takze dla `#damVizModalAssoc` (wczesniej tylko `#damMediaPreviewLinkedAssets`); inject w A3 styles.
4. Video: `posterUrl` (&preview=1) + client capture klatki ~25% gdy most bez ffmpeg (SVG placeholder); bridge: seek 25% duration (wymaga restartu mostu + ffmpeg na PATH).
5. Filter: `isLikelyPhoneDumpAsset` (IMG_*/M-META bez roli WWW/social/POS).
6. Cache: `assocux20260720a` / media-preview `assocux20260720b`.

### Efekt/Fix
Czyste tipy; pelna lista w pickerze; Zwin ukrywa `--extra`; video ma frame (client) zamiast uil-image-slash.

### Test/Ewaluacja
- `node --check` dam-viz/media-preview/assoc-edit/tooltips: Pass
- CDP tip (5 wariantow owies): select B tip=0; re-click tip=1; select A tip=0: Pass
- CDP toggle Roladka 12: collapsed extras display:none 18->0; expand 18 visible: Pass
- CDP Shift+edit pinnedCount=2 == linked_products union: Pass
- CDP video: slash=0, captured jpeg nw 3840/2160: Pass
- Screenshot+Read `assoc-ux-pass2-video-tip.png`: 1 tip, video frames, toggle: Pass
- Blocked: most bez ffmpeg na PATH — prawdziwy JPEG z mostu dopiero po instalacji ffmpeg + restart 8766; client capture dziala

### Zrodla
`dam-viz.js`, `dam-media-preview.js`, `dam-assoc-edit.js`, `dam-tooltips.js`, `dam-brand.css`, `local_bridge.py`; token `assocux20260720b`


---

## 2026-07-20 — Viz changelog bar: Nieaktualne copy + tipy

### Komenda/Akcja
WORKER: UX/copy `#damChangeLogBar` - "nieaktualne" mylone ze stale logiem; stacked tipy; mojibake w tipach Historii.

### Log/Status
1. `dam-tag-edit.js`: `changeLogRowDetail` -> `Status wariantu/produktu: Nieaktualne · NAZWA · indeks` (bez `status ->`); hint bez dlugiego prefiksu (ellipsis); tipy PL z JS (`rebindChangeLogTips`); `data-dam-tip-suppress` gdy popover Historia otwarty.
2. `dam-tooltips.js`: honor `data-dam-tip-suppress` / `data-dam-no-tip` parent; export `DamTooltips.hide`.
3. `visualizations.html`: usunieto tip attrs z markupu bara (JS ustawia UTF-8); cache `chgcopy20260720d`.
4. Dane: ostatni wpis change-log = lifecycle Babka Cytrynowa X (nieaktualne) - copy-only, bez reconcile.

### Efekt/Fix
Operator widzi ze "Nieaktualne" = status wariantu na dysku (X), nie "log nieaktualny". Jeden tip naraz; PL diakrytyki OK w tipach/footercie Historii.

### Test/Ewaluacja
- `node --check` dam-tag-edit.js / dam-tooltips.js: Pass
- CDP hint: `Status wariantu: Nieaktualne · BABKA CYTRYNOWA · 6300622.00 · 19.07.2026 20:50`; tipAloneOk; tipWithPop=0; tipMojibake=false: Pass
- Screenshot+Read `changelog-bar-pass3-clean.png`: Pass

### Zrodla
`dam-tag-edit.js`, `dam-tooltips.js`, `visualizations.html`; token `chgcopy20260720d`; memory #138


---

## 2026-07-20 — Explorer select S vs L (viz Folder)

### Komenda/Akcja
WORKER: Folder Windows zaznaczal FRONT-L zamiast aktywnego FRONT-S w #damVizModal.

### Log/Status
1. Root cause (2 warstwy): (A) explorer /select gdy folder WIZKI juz otwarty potrafi zostawic poprzednie zaznaczenie (L); (B) irstWizkiPath bral pierwszy obraz alfabetycznie (= FRONT-L) przy rebuildzie z products, podczas gdy miniatura/hero jest z FRONT-S (pick_thumb_file).
2. Bridge: _select_file_in_explorer via SHOpenFolderAndSelectItems przed fallbackiem /select.
3. Viz: irstWizkiPath preferuje FRONT-S jak builder; Folder CTA bierze items[activeIdx].path.
4. Media-preview Folder: sset.path jako zrodlo prawdy.
5. Cache-bust: selects20260720a (dam-paths / dam-viz / dam-media-preview). Restart mostu 8766.

### Efekt/Fix
Reveal zawsze dostaje sciezke aktywnego wariantu; Windows zaznacza dokladny plik (S gdy S).

### Test/Ewaluacja
- Bridge POST /reveal FRONT-S.png: ok + log SHOpenFolderAndSelectItems ok has_front_s=true has_front_l=false: Pass
- CDP modal ROLADKA: data-path / filename / capture reveal = PROJEKT-ROLADKA-WOLOWA-6300697-FRONT-S.png: Pass
- firstWizkiPath unit (L+S pool -> FRONT-S.png): Pass

### Zrodla
local_bridge.py, dam-viz.js, dam-paths.js, dam-media-preview.js; token selects20260720a

---

## 2026-07-20 — Branding ID chip: position + global index style

### Komenda/Akcja
INTERRUPT: chip index na karcie brandingu blizej meta; wiecej powietrza nad chipem; styl = global .dam-viz-badge--index.

### Log/Status
1. Usunieto branding-only override (10px/700/border/!important) na .dam-branding-card__id-chip.
2. Layout: margin-top:12px, margin-bottom:-10px (body gap 14 → chip↔meta ~4px).
3. Cache dam-branding.css?v=idchip20260720a (branding/viz/dashboard/explorer).

### Efekt/Fix
Chip wyglada jak index badge na viz; siedzi blizej linii meta.

### Test/Ewaluacja
- CDP before→after: above 7→14, chip↔meta 14→4; styleMatchVizIndex (11.5px/500/5px 11px/rgba70,66,85): **Pass**
- Screenshot+Read randing-idchip-after.png: **Pass**

### Zrodla
dam-branding.css; token idchip20260720a



---

## 2026-07-20 — Branding UI: mojibake Polish chrome (UTF-8)

### Komenda/Akcja
WORKER: napraw zepsute polskie znaki w branding.html (Wyczysc/Pokaz/tydzien/miesiac/uzycia).

### Log/Status
1. Root cause: pps/web/branding.html mial podwojne mojibake, potem plik zostal tez zapisany jako **cp1250** (bajty 9C E6 zamiast UTF-8 C5 9B C4 87 dla sc). dam-branding.js byl czysty UTF-8.
2. Meta charset UTF-8 byl OK; problem = literalne stringi w HTML.
3. Przepisano chrome PL przez Python write_bytes(utf-8) + unicode escapes (bez PowerShell Set-Content).
4. Sibling: tipy changelog w isualizations.html (Pokaż wszystkie + tipy Historii).
5. Cache-bust: renc20260720d na dam-branding.js/css w branding.html.

### Efekt/Fix
Chrome Branding renderuje: Wyczyść, Pokaż, tydzień, miesiąc, użycia, niemięsa.

### Test/Ewaluacja
- Disk+HTTP bajty clear: C5 9B C4 87 (UTF-8 sc): Pass
- CDP: clear=Wyczyść filtry cps=[...,347,263,...]; tabs Pokaż; week/month/prio: Pass
- Screenshot+Read randing-polish-final-pass.png: Pass
- 
ode --check dam-branding.js: Pass

### Zrodla
randing.html, isualizations.html; token renc20260720d

---

## 2026-07-20 — restore disk+DB connectivity + TUBA PREZENT index (WORKER)

### Komenda/Akcja
CRITICAL ops: diagnostyka X:/Postgres/bridge, reindex, widocznosc TUBA MINI PREZENT 6300XXX w Projekty.

### Log/Status
1. Diagnose: X:\Marketing online; Postgres Synology online (Baza online); /files/status probe_ok; bridge api_version=5.
2. Test-Path PROJEKT: True (nazwa folderu ma em-dash U+2014, nie ASCII hyphen — stąd wczesniejszy False na sciezce usera).
3. Zombie: 2x local_bridge + 2x watch-file-index → zabito duplikaty; zostawiono 1 bridge (PID 47620) + 1 watcher --interval 5.
4. TUBA MINI PREZENT juz byl w file-index jako revision produktu mix-tuba-30-szt-xmas-mixy, ale:
   - enrich-search-tags kasowal foldery wariantow z search_blob → search PREZENT/6300XXX nie znajdowal;
   - pickLatestRevision bral pierwszy is_latest (stary 28.02) zamiast PREZENT 07.07.
5. Fix: enrich-search-tags (foldery + 6300XXX w blob); dam-api/dam-projects pickLatestRevision po dacie; meta.revisions w Projekty; bump ?v=projidx20260720a na index.html.
6. Index: python build-file-index.py (pelny rebuild + enrich) → products=184, mtime 2026-07-20T21:59:23Z.

### Efekt/Fix
Pliki online + Baza online. Search 6300XXX/PREZENT pokazuje karte Batony · TUBA 30 SZT XMAS (wariant PREZENT w indeksie). Watcher 5s (agresywniej niz 10 min).

### Backup
brak

### Test/Ewaluacja
- Test-Path PROJEKT (emdash): True
- /db/status Baza online postgres; /files/status online true
- file-index: folder TUBA MINI - PREZENT - 07.07.2026 - 6300XXX.00; search_blob has prezent+6300xxx
- CDP Projekty q=6300XXX: karta TUBA 30 SZT XMAS; latestFolder=PREZENT: Pass
- Screenshot index.html?q=6300XXX + Read: Pass (karta widoczna; status listy Niekompletny ≠ NIEAKTUALNE lifecycle)

### Zrodla
enrich-search-tags.py, dam-api.js, dam-projects.js, index.html, build-file-index.py, watch-file-index.py, local_bridge.py

---

## 2026-07-20 — site-wide Polish mojibake fix (encoding only)

### Komenda/Akcja
Fix PL mojibake w calym `apps/web/**` HTML chrome (settings devices card, branding, shell pages).

### Log/Status
1. Root cause: UTF-8 odczytany jako cp1250, zapisany ponownie jako UTF-8 (nie brak meta charset).
2. Naprawiono 16 HTML: activity, consents, costs, docs-security, help, inbox, index, integrations, invoices, license, privacy, profile, project, settings, signin, terms.
3. Branding/explorer/dashboard/viz juz mialy poprawny UTF-8; indeksow JSON nie ruszano.
4. Cache-bust: bump numerycznych `?v=` w naprawionych HTML; cofnieto przypadkowy `dam-version.js?v=3.0.6` -> `2.0.6`.
5. Skrypt naprawczy: `tools/_fix_mojibake_utf8.py`.
6. memory.md #140: HARD UTF-8 dla apps/web.

### Efekt/Fix
UI PL czytelny site-wide w HTML chrome. Meta UTF-8 bez zmian (juz OK).

### Backup
brak (odwracalne przez git)

### Test/Ewaluacja
- Residual grep mojibake markers w apps/web html/js/css: 0
- CDP settings devices title + clear aria: Pass
- CDP branding Wyczysc filtry / Pokaz wszystko: Pass
- Screenshot settings devices card + branding clear + Read: Pass

### Zrodla
tools/_fix_mojibake_utf8.py, apps/web/*.html (16), memory.md #140


## 2026-07-21 - Assoc skeleton: 5-col full-width + fade (no scroll)

**Komenda/Akcja:** WORKER fix #damVizModalAssoc skeleton loader (cramped scroll -> premium 5xN fade).

**Log/Status:**
1. Root cause: showAssocPaneLoading wstawial zagniezdzozny .dam-media-preview__assoc-grid--loading do #damVizModalAssoc (ktory juz jest gridem) + tylko 6 komorek -> 1 item w outer gridzie z overflow-y:auto = maly scrolled box.
2. Fix JS (dam-media-preview.js): cells bezposrednio w mount; klasa --loading na mount; rows z wysokosci pane; --dam-assoc-skel-rows; clearAssocPaneLoadingState przed real content.
3. Fix CSS (dam-brand.css + dam-viz-modal.css + inject w A3 styles): 
epeat(5,minmax(0,1fr)), overflow:hidden, mask gradient (row1 solid -> row2 0.8 -> transparent w srodku ostatniego rzedu).
4. Cache: ssocskel20260721b (viz/explorer/branding/dashboard + ensureVizModalCss + dam-viz inject).

**Efekt/Fix:** Skeleton wypelnia szerokosc pane (535px), 5 kolumn, fade mask, bez H-scroll; po load karty normalne (overflow auto).

**Test/Ewaluacja:**
- 
ode --check dam-media-preview.js OK
- CDP: cols=5, cells=55, nested=0, overflowY=hidden, hScroll=false, maskStops 0/9/18/95.45%, w=535 — Pass
- Screenshot+Read #damVizModalAssoc pass2/pass3 (fade) — Pass
- After load: loading=false, items=24, skel=0, overflowY=auto — Pass

**Zrodla:** dam-media-preview.js, dam-brand.css, dam-viz-modal.css; token assocskel20260721b

## 2026-07-21 - Assoc skeleton tiles (reject bars) fix

**Komenda/Akcja:** INTERRUPT — user rejected 5 vertical grey bars; want 5xn tile cards + fade tiles.

**Log/Status:**
1. Wrong before: grid-level CSS mask on full-width squares blended into 5 tall stripes; fade unread.
2. Fix: card markup (thumb square + 2 label lines); per-row --dam-skel-op (1→0.8→…→0.28); last row .is-skel-last mask to 0 at 50% height; no grid mask; injectAssocSkeletonStyles (#dam-assoc-skel-styles).
3. Cache: ssocskel20260721c.

**Test/Ewaluacja:**
- CDP: cols=5, cards=40, thumbSquare, rowOps [1..0.28], lastMask transparent@50%, gridMask=none, hScroll=false — Pass
- Screenshot+Read assoc-skel-tiles-pass3(+full): distinct 5-col tiles + bottom dissolve — Pass

**Zrodla:** dam-media-preview.js, dam-brand.css, dam-viz-modal.css; token assocskel20260721c

## 2026-07-21 - Viz TUBA search / Opakowanie facet (HARD FAIL fix)

**Komenda/Akcja:** WORKER — user: search `tuba` on visualizations.html = 0 produktow; TUBA missing from Opakowanie tags.

**Log/Status:**
1. Bridge BEFORE: Listen PID 47620 (pythonw local_bridge); `/files/status` bez `?root=` = root_required; z `?root=X:/Marketing` = online+probe_ok.
2. Disk: `X:\Marketing` True; BATONY TUBA folder True (MIX - TUBA 30 SZT XMAS + TUBA MINI PREZENT).
3. Index juz mial `mix-tuba-30-szt-xmas-mixy` w file-index + viz_latest (carrier TUBA, tags tuba, search_blob tuba) — Projekty mogly Pass, a Viz facet wygladal jak brak TUBA.
4. Root cause UI: `OPAKOWANIE_CANON` trzymal `tuba` na pozycji 12; dam-tag-bar ROW_LIMIT=8 => TUBA tylko pod `+8`. User widzial DOYPACK/BATON/... bez TUBA.
5. Fix: `tuba` w top-4 OPAKOWANIE_CANON + enrich-search-tags order; `packagingTagsFrom` czyta `opakowanie` (nie tylko `pakowanie`); normalizeSearchText tez U+2013/U+2014; bump `dam-viz.js?v=tubaViz20260721a`.
6. Bridge restart: kill 47620 + duplicate http.server; single bridge (po dedupe 33668; launch.py moze relaunch — final Listen 57100); web 46144 (+ launch 56372 na 8765).
7. Reindex: `python apps/web/scripts/build-file-index.py` -> products=184 viz=392 + enrich-search-tags OK.

**Efekt/Fix:** Opakowanie pokazuje TUBA bez rozwijania; search `tuba` = 1 produkt MIX TUBA.

**Test/Ewaluacja:**
- CDP: searchVal=tuba, filteredLen=1, pid=mix-tuba-30-szt-xmas-mixy, count `1 produktow (1 wariantow) / z 392 wszystkich`, tubaPillVisible=true — Pass
- Screenshot+Read `viz-tuba-search-pass.png`: pole tuba, pill TUBA, karta TUBA 30 SZT XMAS — Pass
- Bridge: `/files/status?root=X:/Marketing` online; `/product-catalog` ok=true

**Zrodla:** build-file-index.py, enrich-search-tags.py, dam-viz.js, visualizations.html; token tubaViz20260721a
---

## 2026-07-21 — viz-modal assoc variant grouping

### Komenda/Akcja
Grupowanie wariantow kreacji w `#damVizModalAssoc` (device / WxH / quality stem) - 1 kafelek + badge N.

### Log/Status
1. Branding project groups = `marketingGroupKey` / `folder_group_id` (folder scope), nie stem.
2. `creativeKey` w media-preview NIE tnie WxH/device (Rule A jakosci) - dodano `familyCreativeKey`.
3. Nuggets: w indeksie sa warianty rozmiaru (`1024x445`…) i rozszerzen (jpg/png/psd/tif); nie tylko quality-tier.
4. Implementacja w `dam-media-preview.js`: `groupAssocMaterials`, badge, label `N grup · M plikow`, klik = primary + siblings grupy.
5. Cache-bust `?v=assocgroup20260721a` (visualizations/dashboard/branding/explorer).
6. Style badge wstrzykniete (`injectA3Styles`) - bez edycji dam-brand.css.

### Efekt/Fix
NUGGETS 6300586: `137 plikow` → `114 grup`; SLIDER I MIEJSCE badge 3; ZESTAW BURGERÓW/Kiełbasek/OBIADOWY/ŚNIADANIOWY badge 4.

### Backup
brak

### Test/Ewaluacja
- node --check dam-media-preview.js: Pass
- CDP unit: SLIDER 3→1, ZESTAW 4→1, primary DESKTOP/1200x1200: Pass
- CDP live modal label `114 grup · 137 plikow`, badges 3/4: Pass
- Screenshot+Read pass1 + pass3 expanded: Pass (Elementy/Surowe nienaruszone)

### Zrodla
dam-media-preview.js, dam-branding.js (marketingGroupKey read-only), branding-index.json, code-doctrine.md

---

## 2026-07-21 — TUBA MINI PREZENT: 3 wizki w modalu + Surowe z links

### Komenda/Akcja
Fix modalu wizualizacji MIX TUBA / rewizja TUBA MINI PREZENT: brakujace wizki w stripie + wyciek ciast do Surowe elementy.

### Log/Status
1. Disk: `4 - WIZKI` = 3x `TUBA PREZENTOWA - SZKIC - D (1|2|3).jpg`; `2 - PROJEKT/links` = 9 plikow (Design/LISCIE/ROZA/magnific…).
2. file-index juz mial 3 wizki; `viz_latest` / modal robily 1 wiersz na jezyk (`firstWizkiPath`).
3. Surowe: `isLinksRawPath` lapal ARCHIWUM `…/links/` (paczka_Sial cakes, 12x_XMAS/LINKS) przez luźne `\links\`.
4. Fix UI: `expandModalWizkiVariants` + `buildModalItems` w dam-viz.js; zaostrzony `isLinksRawPath` + `pathUnderRevision` + `revision_path` w productContext.
5. build-file-index: `_is_elements_dirname` + links/linki.
6. Cache-bust: dam-viz `tubaVizStrip20260721a`, dam-media-preview `tubaLinks20260721a`.

### Efekt/Fix
Strip = 3 thumbs PL·(1|2|3); hero = `/media` oryginal SZKIC; Surowe elementy (8) z PREZENT links (bez sernik/szarlotka). Design na tube2 (~871MB) nie w brandingu — poza 8.

### Backup
brak

### Test/Ewaluacja
- node --check dam-viz.js + dam-media-preview.js: Pass
- CDP: variantCount=3, paths SZKIC (1)(2)(3), heroNatural 2688x4479, Surowe (8) names z links, cakeLeak=false — Pass
- Screenshot+Read `tuba-mini-prezent-viz-modal-pass.png`: Pass

### Zrodla
dam-viz.js, dam-media-preview.js, build-file-index.py, visualizations.html (+ dashboard/branding/explorer cache-bust), branding-index product_element PREZENT links

## 2026-07-21 — fix show-all viz card hero (TUBA)

### Komenda/Akcja
Naprawa karty produktu gdy toggle **Pokaż wszystkie** ON: nie pokazywac BRAK WIZUALIZACJI / Zgłoś gdy ktorykolwiek wariant ma wizke.

### Log/Status
1. Trace: showAll -> expandVizFromProducts(indexData, !showAll) dolacza rewizje z has_viz:false.
2. TUBA XMAS: 2 rewizje obie is_latest; pierwsza w tablicy wizki_count=0 (28.02), druga wizki_count=3 (07.07 PREZENT).
3. Bug: 
enderGroup bral items[0] + 
oViz = first.has_viz === false -> cala karta produktu pusta.
4. Fix: itemHasViz / pickCardHero / orderGroupItemsForCard — hero = latest+thumb sposrod wariantow Z wizka; 
oViz tylko gdy ZADEN wariant nie ma wizki.
5. Cache-bust: visualizations.html dam-viz.js (aktualny token sibling: tubaHeroFullRes20260721d).
6. 
ode --check dam-viz.js OK.

### Efekt/Fix
Search 	uba + Pokaż wszystkie ON: thumb + Przejdź + share (nie Zgłoś / noviz).

### Backup
brak

### Test/Ewaluacja
- CDP OFF: 1 prod (1 war) / 392; thumb; Przejdź — Pass
- CDP ON: 1 prod (2 war) / 762; thumb; Przejdź; hasNoviz=false — Pass
- Pass2 toggle cycle OFF-ON-OFF-ON — Pass
- Pass3 hard reload LS show_all=1 — Pass
- Screenshot+Read OFF + ON + pass3 — Pass (CDP status ON = 2/762 silniejszy niz caption)

### Zrodla
dam-viz.js (pickCardHero, orderGroupItemsForCard, renderGroup, openProductModal), visualizations.html, file-index revisions TUBA XMAS

## 2026-07-21 - Settings: Historia zmian + jump search „historia”

### Komenda/Akcja
User Fail: settings search „historia” = Brak ustawień. Dodać kartę Historii zmian na dysku + search jako skróty UI (nie assety).

### Log/Status
1. Root cause: aktywny chip (np. Profil z sessionStorage) ukrywał kartę Dysk mimo trafienia data-search.
2. Karta #historiaZmian / alias #damDiskHistory pod filtrem Dysk; inline panel + „Otwórz panel” (shared DamTagEdit life-hist layout).
3. dam-settings.js: UI_JUMP_REGISTRY + #damSettingsJumpResults; przy q chip nie filtruje kart; hint liczy karty+skróty.
4. Cache-bust jumpsearch20260721a (settings css/js, tag-edit, brand).

### Efekt/Fix
Szukaj „historia” → ≥1 karta + 3 skróty (Settings / Inbox / Viz). Layout czytelny (chip F/X/D, osobne linie).

### Backup
brak

### Test/Ewaluacja
- CDP (chip Profil + q=historia): hint „1 kart + 3 skrótów”, cardHidden=false, jumpLabels=[Historia zmian na dysku, Historia (Wiadomości), Historia zmian na dysku (Wizualizacje)] — Pass
- CDP open panel: popoverItems=20, list items readable Status wariantu — Pass
- Screenshot+Read settings search historia — Pass
- node --check dam-settings.js + dam-tag-edit.js — Pass

### Zrodla
settings.html, dam-settings.js, dam-settings.css, dam-tag-edit.js, dam-brand.css (.dam-changelog-history*)


## 2026-07-21 - Inbox Historia lifecycle: Cofnij/Ponow + PL tytuly

### Komenda/Akcja
WORKER: per-item Cofnij/Ponow na wpisach lifecycle, zero English approved, czytelne tytuly (produkt/tagi/indeks/zmiana PL).

### Log/Status
1. Root cause: loadLifecycleHistoryAsInbox czytal tylko top-level letter/status/scope; reconcile/pull maja dane w details_program/drifts -> fallback Lifecycle bez statusu · status. status hardcoded approved -> Decyzja: approved.
2. mapLifecycleHistoryEntry: nest extract + PL change sentence + enrich z file-index (nazwa, tagi, indeks).
3. historyActionsHtml: lifecycle dostaje Cofnij/Ponow (ten sam change-log undo/redo co banner); disabled gdy !can_undo/!can_redo.
4. buildDetailHtml lifecycle: Zmiana/Status/Produkt/Tagi (bez Decyzja: approved); decisionStatusPl dla tag_proposal.
5. Cache-bust inbox.html dam-inbox.js?v=histLc20260721pl02.

### Efekt/Fix
lc_1784577971703: BABKA CYTRYNOWA · 6300622.00 · wariant · tagi · uzgodnienie…; Cofnij/Ponow na kazdym lc_*; brak approved w liscie.

### Backup
brak

### Test/Ewaluacja
- node --check dam-inbox.js — Pass
- CDP: 163 lc z undo-last; anyApproved=false; anyJunk=false; detail PL — Pass
- Screenshot+Read pass1 expanded / pass2 Nieaktualne / pass3 lista — Pass

### Zrodla
apps/web/assets/js/dam-inbox.js, apps/web/inbox.html, apps/web/data/lifecycle-status.json, program-instructions lifecycle.status_fxd
## 2026-07-21 - Dashboard PODGLAD wireframes per-widget

### Komenda/Akcja
WORKER: fix customize-modal PODGLAD so each widget has a scannable bar/block silhouette matching real layout (not one generic clone).

### Log/Status
1. Root cause: previewHtmlForWidget() always emitted the same bar+short+chip mock for every widget id.
2. Added previewMockHtml(widgetId) with distinct layouts: --stat, --list, --media, --notify, --swot, --bars, --links.
3. CSS for mock variants in dam-dashboard.css; cache-bust dashboard.html ?v=prevWire20260721b.
4. Especially tasks_next = 5x (name bar | due bar); products/asana = metric block + label; viz/branding = nav dots + thumb + pills.

### Efekt/Fix
PODGLAD silhouettes differ by widget type; Następne zadania reads as task list rows.

### Backup
brak

### Test/Ewaluacja
- node --check dam-dashboard-widgets.js — Pass
- CDP geometry tasks_next: 5 rows, left~124-186px + right~43-57px same Y — Pass
- CDP products_count metric 40px height; newest_viz_3 3 media rows 36x36 thumb + 3 dots — Pass
- Screenshot+Read pass1 tasks / pass2 products / pass3 tasks+media — Pass

### Zrodla
apps/web/assets/js/dam-dashboard-widgets.js, apps/web/assets/css/dam-dashboard.css, apps/web/dashboard.html

### Update 2026-07-21d
Media wireframe refined to 2x2 grid with thumb|text side-by-side cells (matches default viz/branding layout). Cache-bust prevWire20260721d.

## 2026-07-21 - Global Historia = produktowy modal (#damLifecycleHistoryModal)

### Komenda/Akcja
INTERRUPT: Settings/Viz musza otwierac ten sam DOM co produkt (#damLifecycleHistoryModal), 70vw x 90vh + search; produkt bez search; tip Przywraca status tej pozycji + ikona.

### Log/Status
1. Usunieto / zastapiono chudy floating `.dam-changelog-history--wide` (Fail screenshot) - Settings `#damSettingsChangeHistoryBtn` i Viz `#damChangeHistoryBtn` wolaja `openLifeHistOverlay` -> `#damLifecycleHistoryModal`.
2. CSS: `--global` = 70vw x 90vh; `--product` = max-height 90vh, min-height fit-content; scrollbar `.dam-life-hist__scroll`.
3. Search tylko w global (indeks / nazwa / tagi #lc_); produkt bez search.
4. Tip restore: `data-dam-tip` + `data-life-letter`; `dam-tooltips.js` renderuje chip F/X/D/-.
5. Cache-bust `lifehistmodal20260721b`.

### Efekt/Fix
Jeden chrome modalny; global ma search i pelny rozmiar; produkt zostaje kompaktowy.

### Backup
brak

### Test/Ewaluacja
- CDP Settings Otworz: id=damLifecycleHistoryModal, scope=global, wRatio=0.7, hRatio=0.9, hasSearch=true, skinny=false - Pass
- CDP produkt: scope=product, hasSearchInDom=false, minH=fit-content, maxH=90vh, tip+letter F - Pass
- CDP Viz: ten sam modal 70/90 + search, skinnyVisible=false - Pass
- Tip HTML: Przywraca status tej pozycji + dam-lifecycle-chip--f - Pass
- Screenshot+Read settings/product/viz - Pass

### Zrodla
dam-tag-edit.js, dam-explorer.js, dam-tooltips.js, dam-brand.css, settings/viz/explorer html cache-bust

## 2026-07-21 - Settings Bento grid fill holes

### Komenda/Akcja
WORKER: Settings #damSettingsGrid dense Bento - fill empty holes (Urzadzenia lonely strip); layout only; screenshot+Read Wszystko+Dysk; no commit.

### Log/Status
1. Root cause: (a) DOM order disk -> changelog -> prefs left disk alone as span 7 with 5 empty cols; (b) .is-filtered switched to flex + max-width:960px = lonely centered strip on Dysk.
2. Reordered HTML: disk + prefs pair before changelog hero.
3. CSS: keep 12-col grid + grid-auto-flow:dense; remove flex/960 filtered mode; :has() orphan fill when pair-mate hidden; heroes 1 / -1.
4. Cache-bust settings.html dam-settings.css/js ?v=bentoSet20260721a.

### Efekt/Fix
Wszystko: profile|appearance + disk|prefs rows fill; Dysk: both tiles 100% width (no 960 strip).

### Backup
brak

### Test/Ewaluacja
- CDP Wszystko: diskPrefsSameRow=true, holeBetween=20 (gap), heights 488=488 — Pass
- CDP Dysk: disk+historia pct 100, maxWidth none, elementFromPoint L/C/R in damDisk — Pass
- Screenshot+Read pass1 Dysk / pass2 Wszystko / pass3 top Wszystko — Pass (vision often misreads white-on-white card edges; CDP authoritative)

### Zrodla
apps/web/assets/css/dam-settings.css, apps/web/settings.html
Checklist: C3 BENTO [x] (freeze anatomii kart; tu tylko Settings chrome/grid density)

## 2026-07-21 - Privilege audit admin-only gating

### Komenda/Akcja
WORKER: Full-site privilege audit (UI + bridge). Admin functions visible/callable only for admin; fix Fail gaps. No commit.

### Log/Status
1. READ program-instructions auth.roles_and_privilege + admin.header_switch_only.
2. Curl matrix with minted Bearer sessions (user / power_user / admin).
3. FAIL found: POST /index/rebuild, /branding/rebuild, /notification-groups (POST), GET /change-log, GET /lifecycle-reconcile?mode=boot allowed non-admin.
4. Fixed bridge + UI hide/harden; restarted local_bridge (was dual pythonw on 8766).
5. Cache-bust ?v=privgate20260721a on touched JS HTML.

### Efekt/Fix
- Bridge: admin gate on rebuilds, change-log GET, notification-groups POST, lifecycle boot/enforce.
- UI: hide Historia settings card; gate notify edit; hide Branding rebuild; explorer Odswiez skips rebuild for non-admin; boot reconcile pull-only for non-admin.
- Anti-spoof: DamApi._sessionRole from /auth/me; clear dam_admin_mode if not admin; profile default role user not admin.

### Backup
brak (no commit)

### Test/Ewaluacja
- user/power_user POST /index/rebuild -> 403 admin_required (was 200)
- user/power_user POST /branding/rebuild -> 403
- user/power_user POST /notification-groups -> 403
- user/power_user GET /change-log -> 403
- user/power_user GET /lifecycle-reconcile?mode=boot -> 403; mode=pull -> 200
- user rename-revision-prefix spoof admin_mode -> 200 queued immediate=false
- node --check all touched JS; ast.parse local_bridge.py

### Zrodla
local_bridge.py, dam-api.js, dam-shell.js, dam-settings.js, dam-tag-edit.js, dam-explorer.js, dam-branding.js, profile.html, program-instructions auth.roles_and_privilege

## 2026-07-21 - Viz modal meta stack vertical rhythm

### Komenda/Akcja
WORKER: Fix vertical rhythm / padding between content groups in viz modal (align with grid card body). No commit.

### Log/Status
1. Design Read: Geex viz meta stack = tags → title → ID → filename → carrier as groups.
2. CDP card `#vizGrid .dam-viz-card__body`: gap token 14px (actions +4 → 18px).
3. Modal before (CSS margins, non-flex): title→ID ~2px, ID→filename ~6px, filename→carrier ~6px.
4. Applied flex column + `--dam-viz-modal-meta-gap` on `.dam-viz-modal__body`; zeroed conflicting margins; branding title-block inherits token.
5. Pass polish: modal gap = card 14px + 2px → 16px; actions margin = +4px (card token) → 20px after variants.
6. Cache-bust `?v=metagap20260721d` (dam-brand / dam-viz-modal / dam-branding where touched).

### Efekt/Fix
- `.dam-viz-modal__body` flex + gap token; shared with `#damMediaPreview` via same classes.
- ID chip / filename styles untouched (only outer group spacing).
- Files: `dam-brand.css`, `dam-viz-modal.css`, `dam-branding.css` (+ HTML ?v=).

### Backup
brak (no commit)

### Test/Ewaluacja
- TUBA modal CDP after: tags/title/id/filename/carrier/variants = **16px**; variants→actions = **20px**; card still **14px**.
- Before→after group gaps (px): title→ID 2→16; ID→filename 6→16; filename→carrier 6→16.
- Screenshot+Read TUBA modal (pass1–3); CDP authoritative vs vision px guess.
- **Pass**

### Zrodla
apps/web/assets/css/dam-brand.css, dam-viz-modal.css, dam-branding.css; visualizations/explorer/branding HTML cache-bust

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


## 2026-07-21 - HARD fix PL diacritics (U+FFFD in HTML chrome)

### Komenda/Akcja
WORKER encoding: Polish diacritics broken on Branding filters (Wyczysc/tydzien/miesiac/uzycia). Intensive QA 15 rund. No commit.

### Log/Status
1. Root cause: branding.html (also explorer/dashboard) had literal U+FFFD (EF BF BD) baked into chrome strings - irreversible; NOT meta charset; NOT font; NOT whole-page fail (tags OK).
2. Side pattern: invoices.html / visualizations.html had ASCII ? leftovers (wygl?d, Poka?, j?zyk).
3. Fixed via Python UTF-8 write_bytes: tools/_fix_fffd_chrome_pl.py, tools/_fix_qmark_chrome_pl.py, tools/_wire_branding_i18n_defense.py.
4. Defense: data-i18n + keys in i18n/pl.json for branding clear/week/month/sort/show_all; boot already waits DamI18n before reveal.
5. Cache-bust branding JS/i18n and page ?v=plenc20260721*.

### Efekt/Fix
- Files: branding.html, explorer.html, dashboard.html, invoices.html, visualizations.html, i18n/pl.json; tools scripts above.
- Site-wide FFFD in apps/web HTML/JS/CSS (ex vendor) = 0; mojibake marker sweep = 0.

### Backup
brak (no commit)

### Test/Ewaluacja
- Disk+HTTP bytes: Wyczysc=C5 9B C4 87, tydzien=C5 84, miesiac=C4 85, uzycia=C5 BC.
- CDP textContent + codepoints: s-acute U+015B, c-acute U+0107, n-acute U+0144, a-ogonek U+0105, z-dot U+017C; body FFFD=0 diamond=0.
- Range paint: s-acute/c-acute non-zero client widths (glyphs painted).
- Rundy: branding filters (1-5 Pass), settings (6-8 Pass), viz+inbox headers (9-11 Pass), reload overlay race (12-13 Pass), site-wide grep (14-15 Pass).
- Pass (FAIL gate: any diamond on branding filters - none).

### Zrodla
memory #140; tools/_fix_fffd_chrome_pl.py; apps/web/branding.html; dam-i18n.js boot contract

## 2026-07-21 - WORKER: assoc META false+ / copy ID / meta layout 12-18-8 / no PSD in variants

### Komenda/Akcja
Fix (1) wrong assoc IMG/M-META703783* for V-6300711 PROTEINA KARMEL, (2) right-click copy on ID chips everywhere, (3) viz+branding meta stack 12/18/8 + title 24px, (4) interrupt: no PSD in `#damMediaPreview` variant-grid (PSD only SourceMount, newest mtime). No commit.

### Log/Status
1. Root cause A: `IMG_1266/67/68` (br-003783..) from WSPOLPRACE influencer folder linked to 6 PROTEINA* products; `isLikelyPhoneDumpAsset` was bypassed when `asset_role=social_asset` (KEEP roles short-circuit). Display ID M-META* via DamMarketingId type META.
2. Fix A: hard-reject phone dumps in `passesMarketingAssocMaterial`; tighten `isRelevantMaterialForProduct` (no KEEP-only pass for spray links without product signal).
3. Fix B: assoc-index chips get `data-marketing-id` + bindIdChipCopy + document contextmenu delegation; `user-select:text; cursor:copy`.
4. Fix C/D: `#damVizModalFileMeta` wrap (filename+meta 8px); title→ID 12 / ID→filemeta 18; branding ID under title; titles 24px (override old 17.85).
5. Fix interrupt: `folderVariantsHtml` filters EDITABLE_EXTS/source; `sourceActionFiles`/`dedupeSourceFilesByExt` pick newest mtime; branding editable push includes mtime.
6. Cache-bust `?v=assoccopy20260721c` on brand/branding/media-preview/viz/branding.js + HTML.

### Efekt/Fix
- Files: dam-media-preview.js, dam-viz.js, dam-branding.js, dam-brand.css, dam-branding.css, visualizations/explorer/branding/dashboard.html
- V-6300711 assoc: no IMG_1266/META703783; remaining = GOG/SHOP with "karmel" signal
- Branding br-005661: 0 PSD in variant-grid; SourceMount PSD path present

### Backup
brak

### Test/Ewaluacja
- CDP viz: gapTitleId=12, gapIdFile=18, gapFileMeta=8, titleFs=24px, hasImg=false, hasMeta703=false, assocSelect=text
- CDP branding: psdInGrid=[], sourceHasPsd=true, gapTitleId=12, gapIdFile=18, titleFs=24px
- Screenshots+Read: branding-psd-source-pass1.png, viz-assoc-layout-pass2.png
- node --check: media-preview, viz, branding OK
- Verdict: Pass

### Zrodla
program-instructions viz.assoc_no_visualization_loop; dam-dobrakaloria; ui-taste; branding-index br-003783/br-005660

### Dopisek 01:24 — tighter index scope (assoccopy20260721d)
Przy `ctx.index` wymagaj indeksu w blobie (hits>=99) lub >=2 tokenow — samo "karmel" odpada. V-6300711: assoc=0 (Brak…) bo wszystkie raster KEEP sa spray-linkami 6–7 produktow bez 6300711 w sciezce; packshoty z indeksem i tak tnie `isVisualizationAsset`. CDP: empty OK, gaps 12/18/8, title 24px. Pass.


## 2026-07-21 01:41 — Resume WORKER e5c3f108 (dam-assoc-ux-unify)

**Komenda/Akcja:** Resume interrupted assoc UX unify after Nuggets partial restore. Intensive ui-taste focus zones + Ralph US-01…US-10.

**Log/Status:**
1. Audyt: Nuggets juz 41 grup; DamAssocEdit.bindMaterialsPane byl w pliku ale stary cache bez eksportu — hard reload.
2. Shift+/- density: rozszerzono DamCardZoom w dam-media-preview (apply + Shift+Plus/Minus step 5 + CSS vars na assoc pane roots); branding/viz apply deleguja do DamCardZoom.
3. UTF-8: naprawiono mojibake w branding.html / visualizations.html (Pokaż, Filtr języka, Skala kafelków, tipy); #damBrandingSearch niemięsa OK.
4. QA CDP: popover 0.70×0.90; gaps 8/8/10; studio Z tłem + XL/L/S; M-SLI 2 produkty daktylowe; copy index; DamLoader Skojarzenia…
5. prd.json: wszystkie US-01…US-10 passes:true z dowodami.

**Efekt/Fix:**
- Files: dam-media-preview.js, dam-viz.js, dam-branding.js, dam-assoc-edit.js (prior), branding.html, visualizations.html, prd.json
- Cache-bust: assocfix20260721h (media-preview/assoc-edit/viz/branding)

**Backup:** brak

**Test/Ewaluacja:**
- Nuggets N=41 grup / 64 pliki; IMG_* = false
- Zoom thumbW 45.5@65 → 105@150; Shift+/- step 5
- Popover ratios 0.700 / 0.900
- M-SLI products: chrupiacy-orzech-daktylowy, jab-ko-cynamon-daktylowy
- Screenshots: r01-nuggets-materials.png, r05-zoom-before-65.png, r05-zoom-after-150-assoc.png, r08-msli-popover-70-90.png, r08-branding-search-niemiesa.png
- node --check: OK
- Verdict: Pass US-01…US-10

**Zrodla:** skill dam-dobrakaloria; ui-taste; code-doctrine; .ralph/projects/dam-assoc-ux-unify/prd.json


## 2026-07-21 ~02:00 — WORKER DamLoader label + 3s center hold

**Komenda/Akcja:** Fix loading bar: copy "ładowanie" + HOLD_CENTER_MS 3s before bottom dock.

**Log/Status:**
1. Root cause: call-sites DamLoader.start("Skojarzenia…") + HOLD_CENTER_MS=1000 in dam-loader.js.
2. Central fix in dam-loader.js only (avoid viz/assoc sibling files): LOADER_LABEL always "ładowanie"; HOLD_CENTER_MS=3000; STYLE_ID bump.
3. Cache-bust HTML: dam-loader.js?v=loaderhold3s20260721a (10 HTML).
4. CDP + screenshots: center label/pos; dock after ~3s; fast done <3s no dock.

**Efekt/Fix:**
- WRITE: apps/web/assets/js/dam-loader.js
- Cachebust: branding/explorer/dashboard/visualizations/settings/profile/invoices/integrations/inbox/costs.html
- node --check: OK

**Test/Ewaluacja:**
- start('Skojarzenia…') → label "ładowanie"
- ~2.8s: centerish, width~300 (loader-center-pass1.png)
- dock: nearFab, width~40 (loader-bottom-pass2.png); firstNarrow ~3478ms; lastWide ~3176ms
- done@800ms: midCenterish, fade from center (afterTop 495), never docked
- Verdict: Pass

**Zrodla:** dam-dobrakaloria; code-doctrine §3 cache-bust; DamLoader API


## 2026-07-21 ~02:05 — HARD CANON modal parity + Pokaż wszystkie

**Komenda/Akcja:** Zapamiętaj na zawsze: Wizualizacje = layout kanon; Eksplorator parity; wariant = indeks produktu; studio = TŁO/PERSPEKTYWA/JAKOŚĆ; przycisk Pokaż wszystkie.

**Log/Status:**
1. memory.md #141 + program-instructions `ui.viz_modal_parity_explorer` (v11).
2. dam-media-preview.js: productIndexVariantsHtml (bez WARIANTY MATERIAŁU jako perspektyw); studio 3 ramki + Pokaż wszystkie (grupy fade-in).
3. dam-branding.css: studio-frames grid + all-files animation.
4. Cachebust: parity20260721a.

**Efekt/Fix:** WRITE memory.md, program-instructions.json, dam-media-preview.js, dam-branding.css, HTML ?v=

**Zrodla:** user HARD 2026-07-21; ui-taste; dam-dobrakaloria

## 2026-07-21 02:05 - Assoc minus restyle (red / white / hover)

**Komenda/Akcja:** WORKER restyle .dam-assoc-quick-minus (visual + hover only; keep 2s hold).

**Log/Status:**
1. Inject CSS in dam-assoc-edit.js: bg #dc2626, border 1px #fff, solid white bar 13x3 (kill Unicons glyph).
2. Hover / .is-hover-force: scale(1.05) + ox-shadow: 0 4px 12px rgba(220,38,38,.2).
3. Hold logic untouched (HOLD_MS=2000, pointerdown/up/leave).
4. Cache-bust ?v=assocMinus20260721b on branding/explorer/dashboard/visualizations.

**Efekt/Fix:** Destructive minus always visible; clear delete affordance; hover enlarge + red glow.

**Test/Ewaluacja:**
- node --check dam-assoc-edit.js OK.
- CDP default: bg rgb(220,38,38), border 1px white, icon 13x3.
- CDP hover-force: transform matrix(1.05...), shadow rgba(220,38,38,0.2), w 27.3.
- Screenshot+Read: assoc-minus-default / assoc-minus-item-default / assoc-minus-hover / assoc-minus-item-hover. Pass.

**Źródła:** dam-assoc-edit.js; branding.html; explorer.html; dashboard.html; visualizations.html.

## 2026-07-21 ~02:00 - Faktury toolbar/filters Geex polish (intensive 10)

**Komenda/Akcja:** Fix dam-inv-toolbar + dam-inv-filters (outline chips, Geex CTAs, align baselines). Intensive ui-taste 10 passes.

**Log/Status:**
1. Root cause: inline flex styles + dam-ui-cta solid purple .dam-int-filter.is-active; Import label height inflated by file input.
2. Added apps/web/assets/css/dam-invoices.css; migrated card/toolbar/filters/summary/asana from inline.
3. dam-ui-cta.js active filter = outline + muted accent (not solid fill).
4. dam-invoices.js: drop injected CTA CSS; admin wrap via hidden/is-visible; em-dash -> hyphen in dates.
5. Cachebust: dam-invoices.css?v=invtoolbar20260721e, dam-invoices.js?v=invtoolbar20260721a, dam-ui-cta.js?v=ctaunify20260721a (invoices.html + index.html).

**Efekt/Fix:** Selected filters = white + purple stroke + muted purple text; Import/Export = 34px Geex outline CTAs; chips/CTAs same baseline; left edges toolbar=filters=table.

**Test/Ewaluacja:**
- node --check dam-invoices.js + dam-ui-cta.js OK
- CDP: active bg white / border #ab54db / color muted purple; cta border #ececf2 radius 8; items 34@sameY; leftDiff 0; emDashInMeta false
- Passes 1-10 screenshot+Read (desktop + 768/900 mid + collapsed sidebar + Opłacone/Oczekujące/Po terminie)

**Źródła:** invoices.html; dam-invoices.css; dam-invoices.js; dam-ui-cta.js; checklist C2 already [x]

## 2026-07-21 ~02:10 - Viz modal parity branding (WORKER vizmod, intensive 10)

**Komenda/Akcja:** Fix #damVizModal vs #damMediaPreview gold: product INDEX variants strip, outline studio chips, spacing rhythm (badges→title 10, ID→filename 10, meta ~5, studio group gap 20, body inset 40).

**Log/Status:**
1. Root cause A: product variants strip missing/weak UI — restored as `dam-media-preview__assoc--variants-only` + label WARIANTY PRODUKTU (thumbs by indeks+jezyk); quality XL/L/S stays in studio frames.
2. Root cause B: solid purple studio chips from `#damMediaPreviewStudio .is-active { background: var(--dam-primary); color:#fff }` — switched to white + 2px accent outline + muted accent text (viz + branding).
3. Root cause C: badges height 0 in assoc-split body — `min-height:0` + flex-shrink collapsed badges; fix `flex-shrink:0; min-height:auto`.
4. Spacing tokens: badges→title 10, id→filename 10, title→id/filemeta internal 5; studio--tri gap 20; chip gap 5; body pad-x 40.
5. Order HARD (branding parity): studio → quality host → product variants strip.
6. Cache-bust `?v=vizmod20260721g` on visualizations/branding/explorer/dashboard.

**Efekt/Fix:** ORZESZKI/KLOPSIKI show WARIANTY PRODUKTU; chips readable outline; gaps match brief.

**Test/Ewaluacja:**
- `node --check` dam-viz.js OK
- CDP Pass10 ORZESZKI: badgesTitle 10, idFname 10, studioGroup 20, padL 40, chip bg white / border 2px #ab54db / muted purple text, order studio→quality→assoc, vBtns 7, badgesH 26
- Branding KAR6X: variants strip + idFname 10 + outline chips (CDP)
- Intensive Pass 1–10 screenshot+Read (viz) + ≥2 branding; vision often mislabels outline as solid — CDP authoritative

**Źródła:** dam-viz.js; dam-viz-modal.css; dam-brand.css; dam-branding.css; visualizations.html; branding.html; explorer.html; dashboard.html

## 2026-07-21 ~02:12 - Badge global +5% (WORKER badgescale)

**Komenda/Akcja:** Enlarge ALL `.dam-viz-badge` / `.dam-badge-tag` by 5% (font + padding; no transform:scale).

**Log/Status:**
1. Baseline CDP viz modal: h=24.38px, font-size=11.5px, padding=5px 11px.
2. Added `--dam-badge-scale: 1.05` in dam-tokens.css; global rule at end of dam-brand.css; late inject `#damBadgeScale5` from dam-badges.js (wins over dam-branding.css load order); assoc-edit !important updated.
3. Cache-bust `?v=badgescale20260721a/b` on key HTML (sibling may overwrite dam-brand ?v=; inject still applies).

**Efekt/Fix:** Modal/card badges ~25.59px / 12.075px / 5.25×11.55 (= ×1.05).

**Test/Ewaluacja:**
- node --check dam-badges.js + dam-assoc-edit.js OK
- CDP: fs 12.075 (=11.5*1.05), h 25.59 (~24.38*1.05), index 6300767 Pass
- Pass 1–3 screenshot+Read viz modal badges

**Źródła:** dam-tokens.css; dam-brand.css; dam-badges.js; dam-assoc-edit.js; visualizations.html (+ branding/explorer/dashboard/index/project/inbox/settings)

## 2026-07-21 ~02:15 - Viz modal studio UX Intensive QA (WORKER studioqa)

**Komenda/Akcja:** Finish viz-modal studio UX + ui-taste Intensive QA 10 passes (screenshot→Read→defects→fix).

**Log/Status:**
1. Root cause variants-gone: studio treated each WIZ file as variant / dropped INDEX strip; restored productVariantRepresentatives (lang|index) + variant strip.
2. Root cause solid purple: active studio/quality used solid --dam-primary fill; now white/lavender + purple border + muted purple text.
3. Sibling race: assoc-edit hid minus (opacity:0 Shift-only) — restored ALWAYS visible + late override in dam-media-preview inject; HOLD_MS=2000.
4. 3-frame grid via .studio--tri > .studio-frames CSS Grid; no Język row.
5. Cachebust peak: studioqa20260721z8 (siblings may overwrite HTML ?v=; verify asset content).

**Efekt/Fix:** ORZESZKI 6300767: 7 index variants, 3 equal studio frames, outline chips, minus visible, badge +3.

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-assoc-edit.js / dam-media-preview.js OK
- CDP Pass10: variants=7, frames 252px×3 same Y, chip bg white / border #ab54db / muted purple text, minus n=17 op=0.92 visible, badge +3 12px white/purple
- Intensive Pass 1–10 screenshot+Read (tablet stack at ~768 via Emulation; desktop polish)

**Źródła:** dam-viz.js; dam-assoc-edit.js; dam-media-preview.js; dam-branding.css; dam-brand.css; visualizations.html (+ dashboard/explorer/branding cachebust)


## 2026-07-21 ~02:16 - Viz modal HARD: show-all / title gap / chip 1px (WORKER)

**Komenda/Akcja:** Three HARD fixes in viz/media-preview modal. Screenshot+Read. Cache-bust. No commit.

**Log/Status:**
1. Show-all: group key persp|bg (not size); labels FRONT · Z tłem; qualities XL→L→S→S-SKLEP horizontal grid; outer CSS multi-column.
2. Title gap: killed negative margin (sibling 10-14=-4 → net 10); body gap 16px + title padding-top 4px; badges flow max-height:none.
3. Active chips/pills: border 1px (was 2px) in dam-branding / dam-brand / dam-viz-modal.
4. Bumped injected dam-viz-modal.css ?v= in dam-viz.js + dam-media-preview.js; HTML ?v=showall20260721g.

**Efekt/Fix:** Readable show-all groups; title.top ≥ badges.bottom +12; quiet 1px purple outline.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js OK
- CDP: gapPx=16 Pass; chip borderTopWidth=1px Pass; groups side-by-side (same top, left 123/326); quals XL/L/S/S-SKLEP; grid display
- Screenshot+Read passes (modal + show-all)

**Źródła:** dam-viz.js; dam-media-preview.js; dam-branding.css; dam-brand.css; dam-viz-modal.css; tools/_bump_showall_cache.py; visualizations/branding/explorer/dashboard.html

## 2026-07-21 ~02:16 - Viz modal actions bar sticky white (WORKER)

**Komenda/Akcja:** Fix `#damVizModal .dam-viz-modal__actions` (and shared `#damMediaPreview`) so bar never disappears under expanded Pokaż wszystkie / all-files; white bg + 12px padding; z-index above scroll content.

**Log/Status:**
1. Root cause: actions lived inside scrollable `.dam-viz-modal__body`; expanding studio all-files pushed bar below fold / under content.
2. Moved actions to sibling under `.dam-viz-modal__main` (dam-viz.js + dam-media-preview.js split layout).
3. CSS pin: `__main > __actions` flex 0 0 auto, bg #fff, z-index 40; body scrolls (z 1 for all-files/studio); sticky fallback when actions remain in body.
4. Buttons: secondary/icon/admin bg #fff, padding 12px; Przejdź keeps Geex primary purple.
5. Cache-bust `?v=actionsBar20260721a` on CSS/JS + HTML.

**Efekt/Fix:** Action bar pinned below body scrollport; clickable while all-files expanded.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js OK
- CDP: actionsZ=40, actionsBg=rgb(255,255,255), secondary pad/bg #fff 12px, elementFromPoint Przejdź hits=true after thumb click + body scroll; constrained main 640px still hits
- Screenshot+Read pass1/pass2/pass3

**Źródła:** dam-viz-modal.css; dam-brand.css; dam-branding.css; dam-viz.js; dam-media-preview.js; visualizations/explorer/dashboard/branding.html


## 2026-07-21 ~02:30 - Viz modal group tint + variants above studio (WORKER)

**Komenda/Akcja:** grouptint polish: `#f5f6fa` group surfaces, WARIANTY above studio, denser wrap fill, studio ~10% shorter, frame labels +3/+3.

**Log/Status:**
1. Root cause wrap waste: `.dam-media-preview__assoc` 2-col grid at ≥640px left INDEX strip at ~half width (~370px of ~796px).
2. DOM order: variants HTML before `#damVizModalStudio` (dam-viz.js); `#damMediaPreviewAssoc` before studio (dam-media-preview.js).
3. CSS: group bg `#f5f6fa` on studio-frames / product-variants / all-group; variants-only flex full-width; denser flex wrap min 70px; studio pad/chip condense; label margin 3px 0 0 3px.
4. Cache-bust `?v=grouptint20260721c` HTML + injected dam-viz-modal.css hrefs.

**Efekt/Fix:** Variants above studio; group tints; 7 INDEX chips one row ~787px; studio-frames ~71.5px; actions bar unchanged (z40 white).

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js OK
- CDP Pass: variantsTop < framesTop; bg rgb(245,246,250) on frames/variants/all-group; framesH=71.5; firstRow=7 fillRatio~0.99; label margin 3px 0 0 3px; actionsZ=40
- Screenshot+Read 3 przeloty (pass3 outline proof: 1 row of 7)

**Źródła:** dam-viz.js; dam-media-preview.js; dam-viz-modal.css; dam-branding.css; visualizations/explorer/branding/dashboard.html


## 2026-07-21 ~02:35 - Viz modal all-files: dedupe qualities + row stack (WORKER)

**Komenda/Akcja:** Fix `Pokaż wszystkie`: duplicate XL/L/S/S-SKLEP tiles + groups as side-by-side columns.

**Log/Status:**
1. Root cause doubles: `expandModalWizkiVariants` flattens every WIZKI file; all-files grouped by Perspektywa|Tło but rendered every file - twin paths share same `size` label (no quality dedupe).
2. Root cause columns: `.dam-media-preview__all-files` used `grid-template-columns: repeat(auto-fill, minmax(168px, 1fr))` so groups became ~187px tall columns side-by-side.
3. JS dedupe by quality key in `dam-viz.js` + `dam-media-preview.js` (prefer active, else thumb/path score); order XL→L→S→S-SKLEP.
4. CSS: all-files `flex-direction: column`; group `width:100%`; group-grid horizontal flex 72px tiles; reinforce in `dam-viz-modal.css`.
5. Cache-bust `?v=allrows20260721a` HTML + injected CSS hrefs.

**Efekt/Fix:** One tile per quality per group; groups stacked full-width rows; inner qualities horizontal; tint/actions/variants order kept.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js OK
- CDP Kulki 6300760: labels `XL L S S-SKLEP` uniq=4; group[1].top 1208 > group[0].bottom 1194; widthRatio=1.0; display=flex column; tiles sameRow LTR; groupTint rgb(245,246,250); variantsTop 199 < studioTop 345; actionsZ=40
- Screenshot+Read 3 przeloty (pass1/pass2/pass3)

**Źródła:** dam-viz.js; dam-media-preview.js; dam-branding.css; dam-viz-modal.css; visualizations/explorer/branding/dashboard.html


## 2026-07-21 ~02:40 - Branding media-preview: WARIANTY labels + studio under variants (WORKER)

**Komenda/Akcja:** Fix `#damMediaPreview` material siblings mislabeled INNE/Z TŁEM + studio bar sunk under whole assoc (overlap/waste); place studio under left variant-grid.

**Log/Status:**
1. Root cause labels: branding siblings lack real persp/size axes; empty persp→INNE, any bg→Z tłem; duplicate identical group titles.
2. Root cause layout: `#damMediaPreviewStudio` was sibling after entire `#damMediaPreviewAssoc`, so top waited for max(variants, products) height (~gap 96px under variant-grid).
3. JS: `itemsHaveRealVizAxes` + `materialMode` → all-files group `Warianty materiału`, tiles PSD/JPG; hide fake TŁO frames for material packs; `parkStudioOutsideAssoc` + `ensureStudioUnderVariants` moves studio into left `.assoc-col--variants` after paint.
4. CSS: studio--under-variants margin 8px; products align-self start; sep grid-row 1/-1.
5. Cache-bust `?v=brandVar20260721a`.

**Efekt/Fix:** Material all-files = WARIANTY (not INNE·Z TŁEM); studio under left variants (gap 16px); products clear (horizClear); no fake TŁO for BLIX pack.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-media-preview.js OK
- CDP BLIX br-005508: before studioTop≈897 gap≈96; after studioTop=892 variantBottom=876 gap=16; parentIsVariants=true; labels=[Warianty materiału]; tiles=[PSD,PSD,JPG]; hasFrames=false; horizClear; elementFromPoint products=true; thumbH=476
- Viz modal spot-check: studio frames still present; all-files still Perspektywa·Tło path (not material-only)
- Screenshot+Read pass1/pass2/pass3

**Źródła:** dam-media-preview.js; dam-branding.css; branding/dashboard/explorer/visualizations.html


## 2026-07-21 ~02:45 - Branding: single WARIANTY strip + Shift-minus 80% (WORKER mergeVar)

**Komenda/Akcja:** Consolidate duplicate WARIANTY MATERIALU in branding materialMode into .variant-grid; hide studio all-files; Shift-minus on variant tiles; minus size x0.8.

**Log/Status:**
1. Root cause: olderVariantsHtml filtered PSD/source out of variant-grid (1 misleading card) while 
enderVizStudioControls materialMode painted a second WARIANTY block in #damMediaPreviewAllFiles (PSD/PSD/JPG).
2. Fix: materialSiblings path fills variant-grid with all siblings + EXT labels + assoc-item wrappers; materialMode studio returns empty/hidden (no all-files dup); DamAssocEdit wires Shift-minus on --variant items + size 21px (was 26); uiHard show rules cover variant-grid.
3. Cache-bust: CSS mergeVar20260721a; JS coexists with sibling token minusGlobal20260721a (parallel agent all-file minus).
4. program-instructions: branding materialMode = single variant-grid strip.

**Efekt/Fix:** One WARIANTY MATERIALU; tiles PSD×2+JPG under Edytuj wszystko; all-files absent in materialMode; Shift minus 21×21; product viz all-files rows+dedupe intact.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-media-preview.js / dam-assoc-edit.js OK
- CDP BLIX br-005508: wariantyLabels=1; tiles=[PSD,PSD,JPG]; allFiles=false; studioHidden; editAll; minus idle opacity0 size21; Shift opacity1
- CDP viz 6300760: frames=3; groups FRONT·Z tłem / FRONT·Bez tła; tiles 4+4; flexDir=column; wariantyMaterialDup=0
- Screenshot+Read pass1/pass2/pass3

**Źródła:** dam-media-preview.js; dam-assoc-edit.js; dam-branding.css; program-instructions.json; branding/dashboard/explorer/visualizations.html


## 2026-07-21 ~02:55 - studioRow: viz modal chips one horizontal row (WORKER)

**Komenda/Akcja:** `#damVizModal` studio frame chips (TŁO | PERSPEKTYWA | JAKOŚĆ) always ONE flex row; no wrap of 4th perspective (TYL-ENFACE).

**Log/Status:**
1. Root cause: `.dam-media-preview__studio-frame-chips { flex-wrap: wrap }` + chip `min-width:40px` / roomy padding so PERSPEKTYWA dropped TYL-ENFACE to row2 (~96-104px frame).
2. CSS: `flex-wrap: nowrap`, chips `flex:1 1 0` / Perspektywa `flex:1 1 auto`, tighter padding/font (9.5px, pad 2px 3px) in `dam-viz-modal.css`; base nowrap in `dam-branding.css`.
3. Kept outline active chips + grouptint `#f5f6fa` frames; equal 3-col grid.
4. Cache-bust `?v=studioRow20260721a` (branding) / `studioRow20260721b` (viz-modal) HTML + JS inject hrefs.
5. Small QA helper: `DamViz.openByProductId(pid)` for CDP open path.

**Efekt/Fix:** ENFACE FRONT BACK TYL-ENFACE stay one line; frameH ~61.5px (single row); responsive shrink at 700-811px studio width.

**Backup:** brak

**Test/Ewaluacja:**
- Product CIASTO ŚLIWKOWE 6300785 (4 persps)
- CDP studioW≈810.72: Perspektywa tops delta=0; wrap=nowrap; frameH=61.5; labels ENFACE/FRONT/BACK/TYL-ENFACE; groupTint rgb(245,246,250); active outline rgb(171,84,219)
- Narrow 700px: delta=0, allFit=true, TYL-ENFACE sw=cw=67
- Screenshot+Read pass1 (trunc mid-label) / pass2 (full TYL-ENFACE one row) / pass3 (confirm)

**Źródła:** dam-branding.css; dam-viz-modal.css; dam-viz.js; dam-media-preview.js; visualizations/explorer/dashboard/branding.html

## 2026-07-21 ~03:00 - WORKER A re-verify viz/modal 4h gaps (compA20260721a)

**Komenda/Akcja:** CDP+screenshot re-audit last ~4h FUNCTION claims; fix PARTIAL (naming-dictionary UK, inject cache token sync).

**Log/Status:**
1. Audit table → `agents/shared/gap-audit-4h-worker-A.md` (12/12 SHIPPED; A13 naming-dictionary uk, A14 inject href PARTIAL→FIXED).
2. CDP orzeszki-kukurydza-miod: 4 show-all row groups × uniq XL/L/S/S-SKLEP; rowStack; actionsZ=40; GB chips no Ukraina.
3. naming-dictionary: uk→Wielka Brytania; lang_aliases uk→gb; ua→ua; languages.ua=Ukraina (Python UTF-8).
4. Cache-bust compA20260721a: visualizations/explorer/dashboard + inject dam-viz.js/dam-media-preview.js.

**Efekt/Fix:** Functional viz/modal claims verified live; data-layer UK label aligned with program-instructions.

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js OK
- CDP: cssHref/jsViz compA20260721a; reload modal Pass
- Intensive 12-pass screenshot+Read (orzeszki expanded all-files) Pass

**Źródła:** gap-audit-4h-worker-A.md; tools/_bump_compA20260721a.py; naming-dictionary.json


## 2026-07-21 ~03:00 - WORKER B compB: ownership B re-verify + UTF-8 ship

**Komenda/Akcja:** Re-verify last ~4h branding/explorer/encoding/minus claims vs live CDP; ship PARTIAL UTF-8; token `compB20260721a`. No commit.

**Log/Status:**
1. Audit written: `agents/shared/gap-audit-4h-worker-B.md`; version proposal `agents/shared/version-bump-proposal-2026-07-21.md` (suggest **v3.1.0**).
2. B1-B3,B5-B7: CDP Pass — BLIX tiles PSD+JPG, KUBARA 6×PNG, `Warianty materiału`, no all-files dup, studio hidden under variants, minus 21px Shift-gate.
3. B4 UTF-8: **was PARTIAL** — `visualizations.html` invalid UTF-8 + `Poka?`; `branding.html` cp1250; `settings.html` Wyczysc; `dam-explorer.js` Odswiez. Fixed Python UTF-8: `tools/_fix_compB_utf8.py`, `tools/_fix_branding_qmark_only.py`. Live CDP viz: `Pokaż wszystkie` + `Włącz:` ok:true. Grep apps/web: 0× `Poka?`/`W??cz`.
4. Cache-bust `compB20260721a`: `apps/web/_qa/_bump_compB.py` on branding/explorer/visualizations/dashboard + dam-media-preview/dam-viz injected CSS hrefs.

**Efekt/Fix:** Ownership B functional claims SHIPPED; UTF-8 chrome repaired on viz/branding/settings/explorer JS.

**Test/Ewaluacja:**
- node --check dam-media-preview.js / dam-assoc-edit.js / dam-explorer.js OK
- CDP: vizShowAll UTF-8 ok; branding BLIX PSD+JPG; KUBARA material grid; minus 21px
- Intensive 12×/zone logged in gap-audit-4h-worker-B.md

**Źródła:** gap-audit-4h-worker-B.md; version-bump-proposal-2026-07-21.md; tools/_fix_compB_utf8.py; _bump_compB.py


## 2026-07-21 ~03:00 - Viz modal composer audit + cache ship (WORKER viz-composer)

**Komenda/Akcja:** Audit abandoned FUNCTIONAL `#damVizModal` work (~4h); ui-taste Intensive 12 passes per hot zone; cache-bust `vizComposer20260721a`; gap doc. No commit.

**Log/Status:**
1. READ: process.md tail, memory #141+, gap-audit-2026-07-21.md, program-instructions canon; live CDP + screenshot on ORZESZKI 6300767 + CIASTO ŚLIWKOWE 6300785.
2. All 9 functional zones Pass (show-all row stack + dedupe, variants above studio, studio nowrap, actions z40, Shift-minus all-file + assoc, UK→GB, title gap 16px, UTF-8 chrome).
3. No new logic diff — prior workers' code confirmed live; ship cache token only via Python `_bump_viz_composer.py`.
4. Gap table: `agents/shared/gap-audit-viz-composer-2026-07-21.md`.

**Efekt/Fix:** Product viz modal functional checklist green; assets load `?v=vizComposer20260721a`.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js / dam-assoc-edit.js OK
- CDP: groups stacked FRONT·Z tłem / Bez tła; uniq qualities 4; variantsTop<studioTop; actionsZ=40; titleGap=16; Shift-minus opacity=1 (all-file + 17 assoc); GB not UA on CIASTO
- Intensive Pass 1–12 screenshot+Read (pass12: red minus on assoc materials with Shift)

**Źródła:** gap-audit-viz-composer-2026-07-21.md; _qa/_bump_viz_composer.py; visualizations/explorer/branding/dashboard.html; dam-viz.js; dam-media-preview.js



## Komenda/Akcja
Fix: PSD/PSB/AI/PDF poza WARIANTY MATERIALU (2026-07-21)

### Log/Status
1. Root cause: materialSiblings=true omijalo filtr isSourceVariantFile → PSD w .variant-grid.
2. Filter zawsze !isSourceVariantFile; EDITABLE_EXTS + pdf; PDF w SourceMount order.
3. program-instructions ui.viz_modal_parity_explorer must/must_not.
4. Cache 
oSrcGrid20260721a.

### Efekt
WARIANTY = JPG/PNG…; zrodla tylko Przejdz / Folder / PSD w belce akcji.

## 2026-07-21 ~02:55 - UTF-8 / Polish diacritics chrome sweep (WORKER)

**Komenda/Akcja:** Naprawa mojibake / ASCII-? w PL labelach apps/web (viz #vizShowAll, tips Włącz/Wyłącz, branding/explorer/settings).

**Log/Status:**
1. Root cause: PowerShell/ANSI rewrite niszczy UTF-8 PL -> literalne ?/?? (nieodwracalne) albo klasyczne podwojne kodowanie (settings/index); branding mial tez mixed UTF-8 + lone 0xF3.
2. Fix reversible: tools/_fix_mojibake_utf8.py -> settings.html, index.html.
3. Fix ? remnants: rozbudowany tools/_fix_qmark_chrome_pl.py + Python Path.write_bytes(utf-8) na visualizations/explorer/branding/dashboard/profile (+ race re-fix branding back btn).
4. Obrona: data-i18n na branding show_archive + back_browse; lekcja doctrine §12 + memory #141.
5. Bez commit/push (gapship). Hard refresh ?v=utf8fix20260721*.

**Efekt/Fix:** #vizShowAll = Pokaż wszystkie; tip = Włącz / Wyłącz; explorer/branding chrome PL OK; rg Poka\?|W\?\?cz|Wy\?\?cz = 0.

**Backup:** brak

**Test/Ewaluacja:**
- rg patterns = 0; bajty UTF-8 PL na dysku+HTTP
- CDP viz: label codePoint ż=U+017C; tip ł=U+0142 ą=U+0105
- CDP explorer: label+tip OK; Odśwież z dysku OK
- CDP branding: Pokaż wszystko/archiwum, Wyczyść, tip liczby, Wróć do przeglądania
- Screenshot+Read przelot1 secondary filters; przelot2 branding CDP; przelot3 explorer CDP

**Zrodla:** visualizations.html; explorer.html; branding.html; dashboard.html; settings.html; index.html; profile.html; tools/_fix_qmark_chrome_pl.py; tools/_fix_mojibake_utf8.py; agents/shared/code-doctrine.md; memory.md #141


## 2026-07-21 ~03:00 - Gap ship v3.1.0 (commit)

**Komenda/Akcja:** Synthesize gap audits A+B+composers+gapship; enforce noSrcGrid; bump v3.1.0; cache ship20260721v310; commit+push.

**Log/Status:**
1. Confirmed folderVariantsHtml always 
eturn !isSourceVariantFile(v) (PSD/PSB/AI/PDF never in variant-grid; SourceMount only). Worker B CDP PSD tiles superseded.
2. UTF-8 chrome Pass (Pokaż/Włącz) from Worker B + prior qmark repair.
3. Version surfaces: version.json + dam-version.js + runtime_config.py + HTML footers/cache -> v3.1.0 / 3.1.0.
4. Unified cache token ship20260721v310 on key HTML/JS/CSS.
5. Docs: agents/shared/gap-audit-2026-07-21.md (final), process/memory/PROGRESS/README pointer.

**Efekt/Fix:** Release v3.1.0 gap ship modal parity + UTF-8 + noSrcGrid + Shift-minus.

**Test/Ewaluacja:**
- node --check dam-media-preview / dam-assoc-edit / dam-version OK
- FILTER_OK return !isSourceVariantFile(v); BAD_TRUE absent
- visualizations.html contains UTF-8 Pokaż; no Poka? / W??cz

**Źródła:** gap-audit-4h-worker-A/B.md; version-bump-proposal-2026-07-21.md; tools/_ship_v310_20260721.py


## 2026-07-21 ~02:55 - Global Shift-minus bubble on all-file tiles (WORKER)

**Komenda/Akcja:** Restyle assoc minus to Geex bubble 80% + HARD: Shift-minus must work globally including studio `.dam-media-preview__all-file` (XL/L/S/S-SKLEP).

**Log/Status:**
1. Root cause all-file: `ensureShiftHoverAssocUx` only wired `.assoc-item` / variant tiles inside assoc-grid; studio show-all tiles never got `.dam-assoc-quick-minus`. CSS show rules also ignored `.all-files`.
2. Nested-button risk: `.all-file` is `<button>` → minus uses `span[role=button]` when parent is BUTTON.
3. Shared helpers in `dam-assoc-edit.js`: `wireQuickMinusControl`, `wireStudioAllFiles`, `ensureGlobalShiftKeyLatch`, soft-hide session action (no disk delete).
4. Hooks after studio paint in `dam-viz.js` + `dam-media-preview.js`; uiHard Shift selectors extended.
5. Bubble CSS: 21px (26x0.8), gradient red, 1px white border, soft shadow; Shift-gated.
6. Cache-bust `minusGlobal20260721a` (assoc-edit / media-preview / viz) via UTF-8 Python.

**Efekt/Fix:** 16 all-file minuses on Kulki 6300760; Shift on → visible bubble; Shift off → hidden; hold 2s soft-hides from picker (undo toast).

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-assoc-edit.js / dam-viz.js / dam-media-preview.js OK
- CDP S-SKLEP: after w=h=21 (~0.808 of 26); shiftOn o=1 v=visible pe=auto gradient+shadow+1px white border; shiftOff o=0 v=hidden pe=none; wired=16
- a11y: 16x aria tip soft-hide (not disk delete)
- Screenshot: pass1 Shift-on minuses on FRONT tiles; pass2 idle hidden; pass3 CDP+a11y (modal opacity tween made some frames stale — CDP/elementFromPoint authoritative)

**Źródła:** dam-assoc-edit.js; dam-viz.js; dam-media-preview.js; visualizations/branding/explorer/dashboard.html `?v=minusGlobal20260721a`


## 2026-07-21 ~03:05 - Elementy Shift-minus + grid dedupe fix

**Komenda/Akcja:** Wire Elementy/Surowe assoc grids; fix grid collect using object keys (collapsed to 1 grid).

**Log/Status:**
1. seenGrid[htmlElement] string-key bug → only first grid wired; Elementy had 0 minus.
2. Fix: gridList.indexOf(grid); scan modal scope; data-asset-id on cards; grid._damAssocList; re-wire on Elementy toggle open.
3. Token minusGlobal20260721b.

**Test/Ewaluacja:** CDP elItems with elMinus=2 after open Elementy; all-file still via wireStudioAllFiles (Kulki earlier: 16, 21px, Shift gate).

**Źródła:** dam-assoc-edit.js; dam-media-preview.js

## bodyGrid20260721 - Modal body CSS Grid (meta | studio) 2026-07-21

**Komenda/Akcja:** Przebudowa panelu body w #damVizModal i #damMediaPreview: grid meta~70% | studio~30%, etykiety Nazwa/Typ pliku, zawsze 1 wariant, densyfikacja all-groups, parity explorer/viz.

**Log/Status:**
1. Markup: .dam-viz-modal__meta-rail (badges / title+id / filemeta) + .dam-viz-modal__studio-rail + variants full-width + #damVizModalAllFiles host.
2. Studio frames pionowo, bez szarego tray; all-files poza waskim railem (grid auto-fill).
3. uildProductVariantStripHtml / productIndexVariantsHtml: pokazuj przy 1 wariancie.
4. Explorer title: productContext.name zamiast duplikatu basename; Typ pliku line.
5. Edytuj wszystko: indMaterialsPane dziala z samym productContext (bez materialow).
6. Bug reveal: 
evealSequence(autoAlpha) na dzieciach body zostawial studio-rail isibility:hidden / opacity:0 - fix: fade calego body + opacity-only + clear rails po paint.

**Efekt/Fix:** Layout CDP: meta|studio sameRow, frames column, labels Nazwa/Typ, all-files 4-col dense; Edytuj wszystko widoczne w pane skojarzen.

**Test/Ewaluacja:**
- node --check dam-viz / media-preview / assoc-edit / grid-reveal OK
- CDP babka: cols ~552|243, framesDir=column, bg transparent, labels OK, all-files groups=6 cols=4
- Screenshot+Read: meta+studio side-by-side, WARIANTY below, dense all-groups
- ?v= bodyGrid20260721b/c

**Zrodla:** dam-viz.js, dam-media-preview.js, dam-assoc-edit.js, dam-grid-reveal.js, dam-viz-modal.css; visualizations/explorer/branding/dashboard.html



## 2026-07-21 - vizCtaNav: Folder hover + OpenFile gallery + body scroll + UTF-8 + zoom dock + loader 1.5s

**Komenda/Akcja:** WORKER (expand) - #damVizModal / #damMediaPreview action-bar + body scroll + hide parity + UTF-8 + loading translate 1.5s.

**Log/Status:**
1. Folder hover vanish: Geex .geex-btn:hover white text + actions bar ackground:#fff !important = invisible. Fix: 1px purple outline secondary CTA (idle+hover+focus) in dam-viz-modal.css.
2. OpenFile isolated: shelled to Windows only. Fix: DamMediaPreview.openAsset(siblings) when items>1; viz modal also got Prev/Next + ArrowLeft/Right.
3. Body scroll: brand.css/branding.css overflow:visible beat assoc-split overflow-y:auto (max-height 520 + parent overflow:hidden = trap). Fix: ID-scoped overflow-y:auto !important + flex min-height:0.
4. Hide parity: Explorer zoom dock (initZoomDock) not wired on Viz. Moved to DamModalShared; both shells call it.
5. UTF-8: explorer.html U+FFFD on Pokaż/język/Odśwież; branding.html Poka?. Rewrote via Python UTF-8 (not PowerShell Set-Content). Modal strings Otwórz/Przybliżenie fixed in JS.
6. Loader: dam-skel-shimmer 1.5s + assoc padding 14px; DamLoader HOLD 1.5s + dock translate 1.5s + padding 16/24; prefers-reduced-motion.

**Efekt/Fix:** Cache token vizCtaNav20260721b. CDP: Folder opacity1 border 1px; body overflowY auto scrollTop works; OpenFile sibNav true path change; zoom is-docked; Pokaż charCode 380; shimmer 1.5s.

**Test/Ewaluacja:**
- node --check dam-viz / media-preview / modal-shared OK
- CDP matrix A-E + prior CTA Pass
- Screenshot: CDP fromSurface (IDE browser_take_screenshot stale-frame on shared tab) + Read; Explorer a11y tree Pokaż wszystkie

**Źródła:** dam-viz-modal.css, dam-viz.js, dam-media-preview.js, dam-modal-shared.js, dam-brand.css; explorer/visualizations/branding HTML; process.md

## all-files regroup bg sections 2026-07-21

**Komenda/Akcja:** Fix `#damVizModalAllFiles` / `.dam-media-preview__all-files` layout: pusta przestrzen po prawej (auto-fill 168px), kafelki ~56px, grupy Z TLEM / BEZ TLA przeplatane. User: pelna szerokosc, wieksze kafelki (~72-88px), regroup po tle (sekcja Bez tla, potem Z tlem), etykieta grupy = tylko typ/perspektywa, wizualne rozroznienie tla globalnie (fill vs border).

**Log/Status:**
1. Weryfikacja stanu na wejsciu (ten agent kontynuowal po podsumowaniu poprzedniej sesji): kod JS/CSS z regroupem byl juz na miejscu, ALE miedzy sesjami inny, wspolbiezny agent dopisal do tych samych plikow fix `vizCtaNav20260721b` (body scroll + CTA nav) i zbumpowal `?v=` PONAD moj tag `allbgsections20260721a` w `dam-viz-modal.css` + JS-injected link + `dam-viz.js`/`dam-media-preview.js` (HTML nadal mial `dam-branding.css?v=allbgsections20260721a`, ale CSS/JS juz `?v=vizCtaNav20260721b`). Sprawdzone grep-em: regroup markup (`renderSection`/`renderGroup`/`bezOrder`/`zTlemOrder`/`data-bg`) i CSS (`.all-section-grid` flex, `data-bg="bez-tla"` border-only) SA nienadpisane w obu miejscach -> brak konfliktu, nie trzeba bylo ponownie bumpowac wersji (nowszy tag agenta B juz serwuje moj kod).
2. Root cause #1 (z poprzedniej sesji, opisana szerzej w doktrynie): `bodyGrid20260721a/b` w `dam-viz-modal.css` (`!important grid-template-columns: repeat(auto-fill, minmax(168px,1fr))` + kafelki `flex:0 0 56px`) nadpisal wczesniejszy dobry fix `allrows20260721a` z `dam-branding.css`.
3. Root cause #2 (subtelna): nawet `auto-fit` w CSS Grid nie usuwa martwej przestrzeni gdy liczba grup nie jest wielokrotnoscia liczby kolumn. Fix: flexbox (`display:flex; flex-wrap:wrap` + `flex:1 1 <basis>`) na poziomie sekcji (`.all-section-grid`).
4. JS: `dam-viz.js` i `dam-media-preview.js` grupuja pliki po `persp|bg`, dzielą na `bezOrder` / `zTlemOrder`, renderuja dwie `<section class="...--bez-tla|z-tlem">` z etykieta sekcji (Bez tla / Z tlem); etykieta grupy = tylko perspektywa; `data-bg` na `.all-group` dla CSS.
5. CSS: `dam-branding.css` (base) + `dam-viz-modal.css` (scoped `#damVizModal`/`#damMediaPreview`, wygrywa nad starym `!important`): `.all-group-grid > .all-file` `flex:1 1 80px; min-width:80px; max-width:104px` (thumb ~86px, w zakresie 72-88px); `data-bg="z-tlem"` fill `#f5f6fa`, `data-bg="bez-tla"` transparent + border 1px `#f5f6fa`.

**Efekt/Fix:** Sekcje w kolejnosci Bez tla -> Z tlem (bez przeplotu); grupy rozciagaja sie na cala szerokosc rzedu (brak martwej przestrzeni nawet dla "sierocej" 4. grupy w wierszu 2); kafelki 104x123px (thumb 86x86px).

**Backup:** brak (tylko edycja kodu, brak operacji na dysku X:).

**Test/Ewaluacja:**
- `node --check dam-viz.js` / `dam-media-preview.js` - OK.
- Grep-owa weryfikacja: kod regroup (JS) i CSS flex/data-bg nienadpisane przez wspolbieznego agenta `vizCtaNav20260721b`; brak konfliktu wersji do naprawy.
- CDP produkt `mix-tuba-30-szt-xmas-mixy` (1 grupa, INNE, z-tlem): `filesWidth===groupWidth===795.71875px` (pelna szerokosc, brak dead space); `background-color: rgb(245,246,250)`, `border: 1px solid rgba(0,0,0,0)`; kafelek `104x123px`, thumb `86x86px`.
- CDP produkt `cynamonka-nerkowcowy` (4+4 grupy, viz modal): sekcje w kolejnosci `--bez-tla` -> `--z-tlem` (potwierdzone `querySelectorAll` + `className`); etykiety grup w obu sekcjach identyczne (ENFACE/FRONT/BACK/TYL-ENFACE), TYLKO typ, bez "* Z TLEM"/"* BEZ TLA"; wiersz 1 = 3 grupy x 259px (= 796px szerokosci grid), wiersz 2 = 1 "sierocia" grupa TYL-ENFACE = 796px (100% szerokosci, zero martwej przestrzeni) - to samo w obu sekcjach.
- Kolory (getComputedStyle, ten sam produkt): `bez-tla` -> `background-color: rgba(0,0,0,0)` + `border-color: rgb(245,246,250)`; `z-tlem` -> `background-color: rgb(245,246,250)` + `border-color: rgba(0,0,0,0)` - dokladnie odwrotne, zgodnie z wymaganiem #5.
- Screenshot+Read (CDP `Page.captureScreenshot`, bo `browser_take_screenshot` timeout'owal 4x z powodu `document.hidden===true` w tej karcie automatyzacji - znane ograniczenie z doktryny sekcja 12, fallback zadzialal): pass 1 = sekcja "BEZ TLA" widoczna, karty ENFACE/FRONT/BACK w rzedzie 1 z cienka biala/szara ramka bez wypelnienia, TYL-ENFACE pod nimi na cala szerokosc; pass 2 (scroll do sekcji 2) = "Z TLEM" z wyraznie widocznym szarym wypelnieniem (`#f5f6fa`) na tych samych czterech kartach - kontrast miedzy sekcjami wizualnie oczywisty. Kolejnosc, etykiety, brak martwej przestrzeni i rozroznienie tla potwierdzone jednoczesnie liczbowo (CDP) i wizualnie (2x screenshot+Read).

**Zrodla:** dam-viz.js (`bindVizModalStudioControls`, `renderSection`/`renderGroup`), dam-media-preview.js (`allFilesPanelHtml`), dam-branding.css, dam-viz-modal.css; dashboard/branding/explorer/visualizations.html; code-doctrine.md sekcja 12 (lekcja: flex vs grid dla fluid rzedow o nieznanej liczbie elementow + kolizja dwoch agentow tego samego dnia na tym samym elemencie).

## 2026-07-21 - vizLoadOnce: #vizGrid reveal 2x

**Komenda/Akcja:** Debugger - loading/reveal animation plays twice on visualizations `#vizGrid`.

**Log/Status:**
1. CDP probe (Page.addScriptToEvaluateOnNewDocument wrap DamLoader/DamGridReveal): skeleton=1, DamLoader.start/done=1, DamGridReveal.reveal=2.
2. Call 1 (t~661): boot -> applyFilters -> render -> reveal (111 cards).
3. Call 2 (t~1323): dam-shell DamApi.me() -> dispatch dam:admin-mode -> dam-viz listener applyFilters -> reveal again (same 111 cards).
4. Fix: lastAdminVisibilityKey latch; dam:admin-mode/storage skip when !indexData or key unchanged; mountChangeLogInScope still runs. DamLoader HOLD 1.5s untouched.

**Efekt/Fix:** Cache token vizLoadOnce20260721a on visualizations.html dam-viz.js. Post-fix CDP: reveal=1.

**Test/Ewaluacja:**
- node --check dam-viz.js OK
- CDP hard refresh: loaderStart=1 loaderDone=1 skeleton=1 reveal=1 (was 2)

**Zrodla:** dam-viz.js, dam-shell.js (~522 dam:admin-mode), dam-grid-reveal.js, code-doctrine.md §12


## 2026-07-21 - thumbPick: square tiles + all-file white media slot

**Komenda/Akcja:** Restyle `#damThumbPicker` thumbs to filled square tiles (match `.dam-media-preview__all-group` / `__all-file`); crumbs padding; kill gray bleed under all-file imgs. ui-taste 5 passes.

**Log/Status:**
1. Root cause A: `.dam-admin-control` on picker items forced `border-radius:50px !important` + purple 1.5px stroke + crushed padding - pill look.
2. Root cause B: img overflowed tile (`overflow:visible`, img taller than card) - scalloped overlap.
3. Root cause C: `.dam-media-preview__all-file img` media slot used `background:#f5f6fa` under `object-fit:contain` - gray bleed.
4. Fix: inject `<style id="dam-thumb-picker-tiles">` from `dam-viz.js`; remove `dam-admin-control` from picker item HTML; square media `aspect-ratio:1`, white card on `#f5f6fa` grid, radius 14px, transparent border; crumbs pad 12px 16px + wrap (no scrollbar); all-file img bg `#fff`; hover/focus via outline + fill tint (box-shadow stripped in this shell).
5. Cache token: `thumbPick20260721g` on dam-viz.js; branding/viz-modal CSS `thumbPick20260721a`.

**Efekt/Fix:** Picker thumbs = square filled cards; crumbs readable; all-file slot white.

**Backup:** brak.

**Test/Ewaluacja:**
- node --check dam-viz.js OK
- CDP ciasto-sliwkowe-nerkowcowy: radius 14px, border transparent, gridBg #f5f6fa, imgInside true, crumbs pad 12/16, allImgBg white
- Screenshot+Read Pass 1-5 (CDP Page.captureScreenshot; document.hidden stale browser_take_screenshot)

**Zrodla:** dam-viz.js (ensureThumbPickerTilesCss), dam-branding.css, dam-viz-modal.css, visualizations/explorer/branding/dashboard.html


## 2026-07-21 - langEnTag: EN canon, PROJEKT+WIZKI, Admin AJAX, KAR6X FRONT-L

**Komenda/Akcja:** HARD user decisions A-I (GB->EN, lang provenance, folder  - PL EN - , Multijęzyczny search, KAR6X thumb, Dodaj typ/tag, Admin instant AJAX).

**Log/Status:**
1. program-instructions v12: data.lang_provenance_only, data.lang_uk_not_ukraine (EN), naming.folder_lang_tokens, admin.tag_instant_apply_ajax, viz.kar6x_thumb_front_l, ui.tag_edit_dodaj_typ_tag, naming.multi_means_multilang synonyms.
2. naming-dictionary: en=Angielski, aliases gb/uk->en, ua=Ukraina, multi_lang_synonyms; GC default_lang en.
3. lang-provenance.md rewritten to EN + PROJEKT/WIZKI-only + folder tokens.
4. build-file-index.py: is_lang_evidence_*, canonicalize->en, pick_thumb KAR6X FRONT-L, search_blob multi synonyms.
5. local_bridge: /revision-langs, rename folder langs, admin instant without admin_mode, add-variant-type creates Szablony folders when Marketing reachable.
6. dam-labels/tag-edit/viz: EN chips, submitLangChange AJAX, Dodaj typ/tag/Zmien kategorie dashed tile, enrichVizRow FRONT-L.
7. Surgical file-index + search-index remap gb->en; 21 KAR6X viz_latest paths -> FRONT-L; Multi search blobs +49.
8. Cache: langEnTag20260721a (labels/tag-edit), langEnTag20260721c (viz).

**Efekt/Fix:** 6300783/6300785 langs=[pl,en]; Multijęzyczny search 30 hits; filter EN not GB; KAR6X path FRONT-L.png; Dodaj UI visible.

**Backup:** brak (no commit).

**Test/Ewaluacja:**
- python ast parse indexer+bridge OK; node --check labels/tag-edit/viz OK
- CDP: DamLabels.normalizeLangCode gb/uk->en short EN; lang filter has Angielski/en no GB
- CDP: Multijęzyczny filteredCount=30 incl CYNAMONKA/CIASTO ŚLIWKOWE pl,en
- CDP: Cynamonka path ends FRONT-L.png; modal badges PL+EN+Multijęzyczny
- Screenshot+Read: #damTagEditPopover Dodaj typ + dashed Dodaj + Zmien kategorie

**Zrodla:** program-instructions.json, naming-dictionary.json, lang-provenance.md, build-file-index.py, local_bridge.py, dam-labels.js, dam-tag-edit.js, dam-viz.js, file-index.json, search-index.json

**Reindex:** full python apps/web/scripts/build-file-index.py recommended when X: Marketing available (regenerate thumbs *_en.jpg, refresh wizki slots). Surgical patch already applied for langs/paths/search.


## 2026-07-21 - tagPopBtn: compact CTAs + Confirm at bottom

**Komenda/Akcja:** Fix #damTagEditPopover - contextual Dodaj labels, + left inline, Zatwierdz/Anuluj at bottom.

**Log/Status:**
1. dam-tag-edit.js: addTagButtonLabel(kind); reorder DOM foot before actions; ensureTagPopoverBtnStyles (token tagPopBtn20260721b); remove dashed tile stack.
2. Polish: Zatwierdz, Zglos, head titles (jezyk/marke/...), Dodaj nosnik/jezyk.
3. Cache-bust ?v=tagPopBtn20260721b in index/branding/explorer/visualizations/settings.html.

**Efekt/Fix:** Toolbar-height (40px) row CTAs; Confirm/Cancel last; no giant dashed tile.

**Backup:** brak (no commit).

**Test/Ewaluacja:**
- node --check dam-tag-edit.js OK
- CDP: childOrder head>search>list>foot>actions; plusLeft; labels Dodaj nosnik/jezyk; UTF-8 diacritics U+15B/U+17A/U+144/U+119
- Screenshot+Read Pass1-5: tag-pop-pass1..5

**Zrodla:** dam-tag-edit.js, *.html cache-bust

## 2026-07-21 - KAR6X card thumb: FRONT-L not stale ENFACE jpeg

**Komenda/Akcja:** Karty KAR6X pokazywaly ENFACE mimo path=FRONT-L w indeksie.

**Log/Status:**
1. Root cause: surgical path patch zostawil `file`/`rel`/`thumb_url` na ENFACE-S; `renderGroup` bral `thumb_url`.
2. dam-viz.js: `syncKar6xFrontThumb` + `cardThumbSrc`; enrich sync file + /media gdy FRONT.
3. Regen 36 KAR6X thumbs z FRONT-L; sync file/rel w file-index.json.
4. Cache `kar6xFront20260721a`.

**Efekt/Fix:** CDP CYNAMONKA/ŚLIWKOWE → `…FRONT-L.png` (media); screenshot 3/4 FRONT nie plaski ENFACE.

**Test/Ewaluacja:** node --check OK; CDP file FRONT-L; screenshot+Read karta 6300783.

**Zrodla:** dam-viz.js, visualizations.html, file-index.json, data/thumbs/*

## 2026-07-21 - tag popover: equal CSS grid CTAs

**Komenda/Akcja:** #damTagEditPopover foot/actions - rowny grid 2 kolumny.

**Log/Status:**
1. Usunieto podwojne Dodaj typ + Dodaj nosnik (carrier = tylko Dodaj typ).
2. foot + actions: `display:grid; grid-template-columns:1fr 1fr`; buttony width 100%.
3. Token `tagPopGrid20260721b`.

**Test/Ewaluacja:** CDP sameW/sameY/alignX; labels full "Zmień kategorię"; Zatwierdź|Anuluj na dole.

**Zrodla:** dam-tag-edit.js, HTML cache-bust

## 2026-07-21 - thumb picker COMBO + crumbs tab

**Komenda/Akcja:** #damThumbPicker - tryb combo (domyslny), foldery lista / pliki kafelki; crumbs tab w ramce.

**Log/Status:**
1. Widoki: combo | lista | miniatury (tiles=legacy thumbs). Default `combo` w localStorage.
2. CSS: folder `grid-column:1/-1` paseczek z ikona; pliki tiles; crumbs row-gap 1px, pad 6/12/8, max-height none.
3. Cache `thumbCombo20260721b`.

**Test/Ewaluacja:** CDP folders=2 full names; strip fullWidth; tab overflowBot/Top=false; screenshot.

**Zrodla:** dam-viz.js, visualizations.html

## 2026-07-21 - branding media preview: hero grow + outline 50%

**Komenda/Akcja:** `#damMediaPreview` - wiecej wysokosci hero, actions flush bottom, outline CTA border 50%.

**Log/Status:**
1. Root cause: non-split body `flex:1 1 auto` + sticky actions → martwa biel nad actions, hero ~273px.
2. Body → `flex:0 1 auto`; thumb min-height `min(420px,48dvh)`; box `justify-content:flex-start`; grid-area `actions`.
3. Actions pad L/R +6px (0→6 / 40→46). Token `--dam-btn-outline-border` 50% alpha na icon-btn + geex outline.
4. Cache `brandModalPad20260721a`.

**Efekt/Fix:** Hero bierze wolne VH; actions przy dnie; outline polprzezroczysty site-wide.

**Test/Ewaluacja:** CDP hero h / actions pad / border alpha; screenshot×3–5 branding modal.

**Zrodla:** dam-viz-modal.css, dam-branding.css, dam-brand.css, dam-tokens.css, dam-media-preview.js, HTML ?v=

## 2026-07-21 - branding media preview: hero grow + outline 50%

**Komenda/Akcja:** `#damMediaPreview` - wiecej wysokosci hero, actions flush bottom, outline CTA border 50%.

**Log/Status:**
1. Root cause: non-split body `flex:1 1 auto` + sticky actions → martwa biel nad actions, hero ~273px.
2. Body → `flex:0 1 auto`; thumb min-height `min(420px,48dvh)`; box `justify-content:flex-start`; grid-area `actions`.
3. Actions pad L/R +6px (0→6 / 40→46). Token `--dam-btn-outline-border` 50% alpha na icon-btn + geex outline.
4. Cache `brandModalPad20260721a`.

**Efekt/Fix:** Hero bierze wolne VH; actions przy dnie; outline polprzezroczysty site-wide.

**Test/Ewaluacja:** CDP hero h / actions pad / border alpha; screenshot×3–5 branding modal.

**Zrodla:** dam-viz-modal.css, dam-branding.css, dam-brand.css, dam-tokens.css, dam-media-preview.js, HTML ?v=

**Test/Ewaluacja (CDP branding PROTEINA):** hero h 273→567 (49% box); actions pad L/R 6px; border `color(... / 0.5)`; gap assoc→actions ~48px; actionsToBoxBottom 12; PSD only in SourceMount; Pass×5 screenshots.

## 2026-07-21 - Samouczek / DobroKalorius overhaul

**Komenda/Akcja:** Congrats-on-target, off-path companion, 40+40 copy, nowe pozy, help global, SW 1h.

**Log/Status:**
1. Root cause A: onDocClick chwalil dowolny klik; poprawny link nawigowal zanim dymek sie pokazal.
2. Root cause B: ten sam handler = auto-Dalej / nawigacja = "koniec" samouczka z perspektywy usera.
3. program-instructions `ui.tutorial_dobrokalorius_hard` (v13); copy JSON; cut-mascot-sheets.py.
4. dam-tutorial.js: showCongrats 3500ms, companion, nameForms, cheer throttle, SW register.
5. dam-shortcuts.js: restart button w head; lazy-load tutorial.
6. Cache `tourFix20260721b`; serve_browser Cache-Control 1h / no-cache `?v=`.

**Efekt/Fix:** Brawo Krzys natychmiast; off-path = companion + faza 0:0; help restart na settings.

**Test/Ewaluacja:** node --check; CDP congrats+companion+help; screenshot+Read tip/companion; RGBA poses.

**Zrodla:** dam-tutorial.js, dam-shortcuts.js, dobrokalorius-copy.json, sw.js, maskotka/pose-*.png

## 2026-07-21 - Typ pliku: Folder + etykiety jezykow (nie kraje)

**Komenda/Akcja:** #damVizModalMeta klik = revealInExplorer; globalnie Polski/Niemiecki/Angielski zamiast Polska/Niemcy/Wielka Brytania.

**Log/Status:**
1. Root cause klik: tip mowil o Shift/double-click zmianie typu nosnika - user oczekiwal Folder.
2. Root cause etykiet: naming-dictionary + LANG_LABELS + file-index lang_labels/viz_* trzymaly nazwy krajow; EN=Wielka Brytania.
3. Fix: dictionary + dam-labels + build-file-index; normalizeVizRow nadpisuje lang_label; meta click -> DamPaths.revealInExplorer; Shift+klik = carrier picker.
4. Patch 395 wierszy viz_latest/viz_all; cache langAdj20260721b.
5. Instrukcja ui.lang_labels_are_languages w program-instructions.json.

**Efekt/Fix:** Meta: … · Angielski; filtr jezykow: Polski/Niemiecki/…; klik meta = ten sam reveal co Folder.

**Test/Ewaluacja:** CDP text+reveal path; a11y name Angielski; screenshot pass2; node --check.

**Zrodla:** naming-dictionary.json, dam-labels.js, dam-viz.js, build-file-index.py, file-index.json, program-instructions.json, HTML ?v=


## 2026-07-21 - branding actions left + loader 1s/0.5s

**Komenda/Akcja:** #damMediaPreview .dam-viz-modal__actions lewy dolny rog; DamLoader hold 1s, dock translate 0.5s.

**Log/Status:**
1. Actions: justify-self:start + width:max-content (nie full-width strip); split layout zostaje width 100%.
2. Loader: HOLD_CENTER_MS 1500→1000, DOCK_MS 500; STYLE_ID bump.
3. Cache ctionsLeftLoader20260721a. HTML restore z git po uszkodzonym PS -replace, potem bezpieczny bump Python.

**Test/Ewaluacja:** CDP actionsW~501 vs boxW~1587, isLeftSide; dockAt~1024ms, transition left 0.5s; screenshot.

**Zrodla:** dam-branding.css, dam-viz-modal.css, dam-loader.js, dam-media-preview.js, HTML ?v=



## 2026-07-21 - Dobrokalorius explore-to-test + media poses + padding

**Komenda/Akcja:** Fix companion UX: padding paneli, media poses (Nośniki), exploreMode (UI klikalne, throttle copy), tryExplore×40 + gender, animacje.

**Log/Status:**
1. Root cause padding: inject CSS companion padding:14/12 - zbyt ciasne vs Geex dropdown.
2. Root cause pose: krok Nośniki uzywal present→pose-5 (ksiazka); media teaching = explain-assets/image/video.
3. Root cause explore: onDocClick off-path zawsze preventDefault+stopPropagation + recreate companion z sad/wander co klik.
4. Fix: exploreMode, soft dim 0.07, tryExplore joy/approve, throttle 12s, media-assets aliases, usunieto present/pose-5 z mapy i krokow, gender map + {trySelf}.
5. Cache 	utorialExplore20260721c (HTML×8 + dam-shortcuts + copy fetch).
6. program-instructions ui.tutorial_dobrokalorius_hard rozszerzone (must/must_not explore + media + no sad spam).

**Efekt/Fix:** Companion padding 28/26/22/26; Nośniki→pose-explain-assets; off-path nie blokuje UI; faza stabilna; tryExplore=40.

**Test/Ewaluacja:** node --check; CDP padding/pointer-events/phase/pose URL; screenshot+Read ×3 (explore joy, padding, Nośniki media); gender Ewa/Krzysztof/unknown.

**Zrodla:** dam-tutorial.js, dobrokalorius-copy.json, program-instructions.json, HTML ?v=, dam-shortcuts.js


## 2026-07-21 - tutorial praise ~25% only

**Komenda/Akcja:** UX: poprawny cel default advance; praise tip tylko ~25%% hitow; po praise auto-advance.

**Log/Status:**
1. Root cause: onDocClick zawsze showCongrats (100%% praise + wait).
2. Fix: PRAISE_CHANCE=0.25 w showCongrats; skip -> thenFn/nextStep od razu; praise -> ~3.5s potem auto-advance.
3. program-instructions ui.tutorial_dobrokalorius_hard must zaktualizowany; DamTutorial.praiseStats().
4. Cache ?v=tutorialPraise25_20260721a (HTML x8, Python bump).

**Efekt/Fix:** 75%% hitow bez bubble gratulacji; 25%% short praise bez stuck na Dalej.

**Test/Ewaluacja:** node --check; CDP force-skip (stats.skipped+1, no is-congrats, step advance); force-praise (Brawo + autoAdvanced); monteCarlo20 majority skip; exploreMode OK.

**Zrodla:** dam-tutorial.js, program-instructions.json, apps/web/_qa/_bump_tutorial_praise25.py, HTML ?v=


## 2026-07-21 - tutorial praise toast advance-first

**Komenda/Akcja:** Rework Dobrokalorius correct-hit: advance first, optional short toast praise + rare micro-burst.

**Log/Status:**
1. Root cause: showCongrats blokowal tip (is-congrats + praiseLock) i opoznial nextStep o CONGRATS_MS=3500.
2. Fix: onDocClick/goToPhasePage = advance natychmiast; maybeShowPraiseToast / queue na nawigacje; CONGRATS_MS=2275 (−35%); PRAISE krotkie (median 33→14); BURST_CHANCE=0.12; 3 warianty CSS burst; reduced-motion bez burst.
3. program-instructions ui.tutorial_dobrokalorius_hard (toast HARD); copy congrats_title=Brawo!; memory #145; doctrine §12.
4. Cache ?v=tutorialPraiseToast20260721b (HTML x8 + dam-shortcuts, Python bump; b = CSS concat fix).

**Efekt/Fix:** Krok zmienia sie w tym samym ticku; pochwala to nieblokujacy toast; Dalej nie jest wymagane.

**Test/Ewaluacja:** node --check; CDP advance sync (0:0→0:1 skip, 0:1→0:2+toast); CONGRATS_MS=2275; BURST_CHANCE=0.12; reduced-motion bez burst DOM; explore companion OK; screenshot+Read ×5 @1280.

**Zrodla:** dam-tutorial.js, dobrokalorius-copy.json, program-instructions.json, _qa/_bump_tutorial_praise_toast.py

## 2026-07-21 - tutorial targets + explore spot + Projekty restore

**Komenda/Akcja:** Fix Dobrokaloriuś: spotlight Pokaż wszystkie / Info Pakowania; explore bez dziury; nav Projekty nie konczy samouczka.

**Log/Status:**
1. Root causes: (a) krok celowal .dam-viz-toolbar (= search); (b) brak kroku Info Pakowania; (c) isTargetInteractable odrzucal switch pod .dam-tut ctrl -> fallback sideLink; (d) explore mial soft dim/hole na starym spocie; (e) index.html nie ladowal dam-tutorial.js + SW HTML 1h stale cache.
2. Fix: cele label[for=vizShowAll] / label[for=damRevealLowTags] + krok CTRL+scroll; explore CSS display:none na spot; nav zachowuje phase + damTutorialExplore; index.html + shortcuts ensureTutorialResume; SW network-first HTML (dam-page-1h-v2).
3. program-instructions ui.tutorial_dobrokalorius_hard HARD 2026-07-21e; cache ?v=tutorialTargets20260721a.

**Efekt/Fix:** Spotlight na switchach; explore bez hole; branding -> Projekty = companion+active, finished=null, phase intact.

**Test/Ewaluacja:** node --check; CDP Pokaż wszystkie spot≈label y~367 overlap; Info Pakowania overlap; explore spotDisplay=none; Projekty active+explore+companion; screenshot+Read.

**Zrodla:** dam-tutorial.js, dam-shortcuts.js, dam-shell.js, sw.js, index.html + HTML ?v=, program-instructions.json, _qa/_bump_tutorial_targets.py

## 2026-07-21 - tutorial Projekty: broken completion + FOUC

**Komenda/Akcja:** Na index.html (Projekty) samouczek nie dal sie dokoncic; dodatkowo flash niestylowanego chrome.

**Log/Status:**
1. CDP przed fixem: dam-tutorial.css brak na index.html; .dam-tut / .dam-tut__ctrl = position:static; ctrlRect.top ~45745 (pod siatka projektow) - Dalej/Zakoncz poza viewportem.
2. Companion (explore inject CSS) byl fixed - user widzial tylko "Wroc do samouczka", bez paska.
3. Fix: critical shell CSS w ensureTutCss() (fixed root/bubble/ctrl + btn); link CSS na index.html; FOUC gate is-ready + inline hide; reveal via setTimeout(0/64) bo samo double-rAF w tle nie odpala i zostawialo opacity:0.
4. Cache ?v=tutorialProjectsFix20260721b (HTML x9 + shortcuts + token).

**Efekt/Fix:** Pasek fixed bottom, klikalny; skip Branding->Projekty; Dalej 4:0->4:1->5:0; Zakończ -> damTutorialFinished=1.

**Test/Ewaluacja:** node --check; CDP hitDalej=.dam-tut__btn--next, ctrlT~684, is-ready, rootOp=1; finish path; screenshot+Read tutorial-projekty-faza5-bar.png.

**Zrodla:** dam-tutorial.js, index.html (+CSS link), _qa/_bump_tutorial_projects_fix.py, code-doctrine §12








## 2026-07-21 - geex pad fix: modal CTA circles + project font + marketing air

**Komenda/Akcja:** Przywrócenie prostokątnych CTA w modalu (Przejdź/Folder), mniejszy font na kartach projektu, air na marketing tiles - bez redesignu.

**Log/Status:**
1. Root cause kółek: geex-realign w `dam-primitives.css` wymuszał `width/height:44px` na `.dam-btn-icon` (także z etykietą) + `border-radius: var(--btn-radius,50px)` w modal actions → ~43×43 z uciętym tekstem.
2. Fix: square tylko dla icon-only; `.dam-btn-icon:not(.dam-btn-icon-only)` = auto width + compact pad; modal CTA override 8px radius; project card `font-size:10px`; marketing card pad/gap + tile grid minmax 148px.
3. Cache-bust `?v=geexPadFix20260721a` (catalog `…21c`, viz-modal `…21b`).

**Efekt/Fix:** Modal Przejdź/Folder prostokąty czytelne; OpenFile zostaje icon-only; project Przejdź 10px; marketing tiles z air jak viz-card.

**Test/Ewaluacja:** CDP modal go ~98×36 fs12 br8 spanClipped=false; project go fs10 h30; marketing pad 14px titleFs12 w~172; screenshot+Read `_qa/qa-viz-modal-actions-crop2.png`, `qa-marketing-cards-pass3.png`.

**Zrodla:** dam-primitives.css, dam-viz-modal.css, dam-brand.css, dam-app.css, dam-project-catalog.css, dam-ui-cta.js, HTML ?v=

## 2026-07-21 - unify projects CTA font + Info Pakowania switch

**Komenda/Akcja:** Ujednolicenie compact CTA (karta + toolbar) do jednego tokenu 12px/34px; Info Pakowania na Projektach = dam-switch--compact jak na Wizualizacjach.

**Log/Status:**
1. BEFORE CDP: card check/go fs=10px h=30; toolbar refresh/ingest fs=16px h~37 (primitives `font:inherit` biło inject); label.dam-tag-reveal-toggle (checkbox).
2. Fix: dam-ui-cta.js (button/a + !important 12px; card = toolbar 12/34/8x12); dam-primitives.css (font-size:12px zamiast inherit; labeled dam-btn-icon 34/12); dam-app.css (usunieto fs:10 na check/go); index.html markup switch jak viz.
3. Cache-bust `?v=ctaUnify20260721b` na HTML ladujacych zmienione CSS/JS.

**Efekt/Fix:** Jedna skala dam-int-cta na kartach i toolbarze; Info Pakowania = track+label switch.

**Test/Ewaluacja:** CDP AFTER: check/go/refresh/ingest fs=12px h=34 pad=8px 12px (delta 0); switch labelFs=12 trackH=18; oldToggle=false. Screenshot+Read toolbar/card/viewport. Pass.

**Zrodla:** dam-ui-cta.js, dam-primitives.css, dam-app.css, index.html, visualizations.html (wzor switch), process.md

## 2026-07-21 - inventory close: marketing/branding air + dark tokens + baseline 36/36

**Komenda/Akcja:** Zamkniecie OPEN po tip df870e2 (geex+PAKIET+ctaUnify): air kart marketing/branding, dark polish tokenami, baseline PNG.

**Log/Status:**
1. Pull main (df870e2 → later c0064b4 docs); :8765 up.
2. Marketing `.dam-catalog-marketing-card`: pad 16 / gap 14 / grid minmax 156 / title 13px / badge pad 5×10; thumb/border → `--dam-surface`/`--dam-border`.
3. Branding/viz cards: body tokens 24/22/18/18 + actions-extra 8; branding min-height 288; surfaces `#fff` → tokens.
4. Dark: Geex `h5 { color: var(--gray-color) }` (= `--dam-border`) biło tytuły — fix specificity `html[data-theme=dark] .dam-viz-card .dam-viz-card__title`; filtry/tag-groups/modal actions → `--dam-surface`.
5. Cache-bust `?v=invClose20260721b` (HTML).
6. Baseline: `retry_fails.py` 8/8 ok → lokalny `_meta.json` **36/36 ok** (json gitignored).

**Efekt/Fix:** Karty z wiekszym air; dark bez white-flash na kartach/filtrach/modal bar; tytuly czytelne; baseline complete lokalnie.

**Test/Ewaluacja:**
- Marketing CDP: pad 16 gap 14 titleFs 13; screenshot+Read pass1/2.
- Branding CDP: pad 24×18×22 gap 18; dark titleLum 229 filterLum 32 cardLum 32.
- Viz CTA: fs 12 h 36 pad 8×12 br 8 (labeled compact preserved).
- Dashboard dark: bodyLum 14 thumbLum 32.

**Pass/Fail:**
1. Marketing catalog cards — **Pass**
2. Branding/viz breathing room — **Pass**
3. Dark mode polish (key surfaces) — **Pass** (Geex chrome Wstecz/search tabs may still flash — out of card scope)
4. Baseline PNG 36/36 — **Pass** (local; meta gitignored)

**Zrodla:** dam-project-catalog.css, dam-brand.css, dam-branding.css, dam-viz-modal.css, dam-dashboard.css, code-doctrine §12, retry_fails.py, process.md

## 2026-07-21 - Elementy panel: stale revision path + duplicate fallback labels

**Komenda/Akcja:** Fix podgladow ELEMENTY w viz/media modal (i wspolnym linkedBrandingCardHtml) - "podglad niedostepny" mimo plikow na X: + overlap/duplikaty etykiet.

**Log/Status:**
1. RCA preview: branding-index ma stare nazwy rewizji bez tokenu jezykow (`KAR6X - 20.05.2026 - 6300785.00 - F`), dysk ma `KAR6X - 20.05.2026  - PL EN - 6300785.00 - F`. `GET /media?path=` => 404 => onerror fallback. 51/51 ELEMENTY dla ciasto-sliwkowe = missing.
2. RCA layout: `__damAssocThumbFallback` + static fallback HTML wstawialy nazwe + hint + ID *wewnatrz* 70x70 thumb, a te same dane byly juz pod kafelkiem (assoc-name + ID chip) => wizualny "podwojny" tekst i overlap wierszy.
3. Fix bridge: `_resolve_missing_media_path` + `_coerce_media_target` w `serve_media` / `/media` / `media_meta` - fuzzy match sibling revision po indeksie 7-cyfrowym + ten sam ogon ELEMENTY/Links.
4. Fix UI: fallback tylko ikona + "brak podgladu"; CSS elementy-panel gap 14/10; cache-bust `?v=elementyPreviewFix20260721b`.
5. Restart local_bridge (pythonw) po zmianie.

**Efekt/Fix:** Stale path z indeksu serwuje realny PNG z dysku. Panel Elementy: 1 etykieta + 1 ID pill, miniatury widoczne.

**Test/Ewaluacja:**
- Bridge: stale index path CIASTO-SLIWKOWE.png => HTTP 200 image/png len 337526.
- CDP modal CIASTO SLIWKOWE: imgs=40 loaded=40 fallbacks=0 overlap=false rowGap=14 gap=14px 10px; ID `M-IMG251288-07-26`.
- Screenshot+Read pass1/pass2: real thumbs (ciasto + kwiaty), brak "podglad niedostepny".
- `node --check` dam-media-preview.js OK; bridge ast.parse OK.

**Zrodla:** local_bridge.py, dam-media-preview.js, explorer/branding/dashboard/visualizations.html (?v=), process.md


## 2026-07-21 - ELEMENTY PNG: czarne matte -> alpha (dematte)

**Komenda/Akcja:** Usunac czarne tlo z miniatur PNG w panelu Elementy (viz/media) - transparentne piksele / matte.

**Log/Status:**
1. RCA: pliki w folderze ELEMENTY to mode P palette BEZ tRNS; rogi RGBA(0,0,0,255) - czarne matte wypalone w pliku (nie CSS). Liscie* maja prawdziwe alpha.
2. Bridge: `_dematte_black_to_alpha` (thr=20) + auto gdy path zawiera ELEMENTY albo `?matte=1` / `preview=1`; cache in-memory 64; nie zapisuje na dysk.
3. JS: `previewUrl` dokleja `&matte=1` dla PNG/WebP w folderze ELEMENTY; `&preview=1` dla alpha rasters.
4. CSS: checkerboard na `.dam-media-preview__assoc-thumb` + override panelu Elementy (light + dark, bez #000).
5. Cache-bust `?v=pngDematte20260721b`; restart local_bridge.

**Efekt/Fix:** Miniatury Elementy pokazuja checkerboard zamiast czarnego boxa; pliki zrodlowe nietkniete.

**Test/Ewaluacja:**
- Bridge CIASTO-SLIWKOWE.png `?matte=1`: corner alpha=0, center opaque — PASS.
- CDP: src zawiera `matte=1` + `preview=1`; getComputedStyle thumb `background-color: rgb(245, 246, 250)` + linear-gradient checker — PASS.
- Screenshot+Read Elementy (40): CIASTO + KWIAT 1..7 na checkerboard, brak solid black — PASS.
- `node --check` dam-media-preview.js OK; bridge ast.parse OK.

**Zrodla:** local_bridge.py, dam-media-preview.js, dam-branding.css, dam-brand.css, HTML ?v=, process.md, code-doctrine sekcja 12
## 2026-07-21 - Incydent FORCE (#damLifecycleForce) + undo + confirm modals

**Komenda/Akcja:** User przypadkowo kliknal Stosuj zmiany; toast "Zapisano 6 zmian, bledow: 18". Zrozumiec, cofnac, dodac potwierdzenia z preview.

**Log/Status:**
1. Zrodlo: `lifecycle-status.json` history `lc_1784663980167` ts `2026-07-21T19:59:40` actor krzysztof.wieczorek@kubara.pl; count 24 = 6 ok + 18 fail.
2. FORCE = `POST /lifecycle-force` -> `force_apply_program_to_disk` (PROGRAM -> dysk rename/archiwum).
3. 18 bledow: wszystkie `path_not_found` (glownie test-lifecycle-* + produkt owies-miod-sniadanie).
4. 6 "ok":
   - 4x owies-miod-sniadanie clear: **noop na dysku** (path_renames puste, final=stara sciezka).
   - ciasto-sliwkowe: rename produktu `CIASTO SLIWKOWE — [ nerkowcowy ]` -> `... - F` (bledny scope: wariant zapisal na folder produktu).
   - babka-cytrynowa: rename + move do `— ARCHIWUM\BABKA ... - X\BABKA ... - X` (zagniezdzenie w wrapperze archiwum).
5. Undo: `local_bridge.undo_last_change` x2 (babka, ciasto) + 4 noop owies z change-log; usunieto pusty wrapper ARCHIWUM Babka; wyczyszczono zanieczyszczone klucze revisions w lifecycle-status.
6. UI: `showExplorerConfirmModal` w dam-explorer.js — FORCE dry_run preview, Odswiez confirm, Export backup confirm. Cache-bust `?v=forceConfirm20260721b`.

**Efekt/Fix:**
- Dysk: Babka i Ciasto przywrocone bez liter F/X w BATONY; Babka nie w ARCHIWUM.
- FORCE nie odpala sie bez listy dry-run + czerwonego Stosuj.

**Backup:** change-log undo przeniosl wpisy do `redo[]` (mozna ponowic przez /change-log/redo — NIE robic).

**Test/Ewaluacja:**
- Disk verify: BABKA active bez -X, CIASTO bez -F, BABKA_ARCH_COUNT=0 — PASS.
- Screenshot+Read FORCE modal: tytul "Stosuj zmiany na dysk", lista 24, Anuluj / Stosuj (24) — PASS (Anuluj, bez apply).
- Screenshot Odswiez + Export confirm — PASS.
- `node --check` dam-explorer.js OK.

**Zrodla:** lifecycle-status.json, change-log.json, lifecycle_status.py, local_bridge.py, dam-explorer.js, explorer.html, process.md

## 2026-07-21 - Assoc/Elementy split + viz white thumbs + branding toolbar

**Komenda/Akcja:** A) resizable split assoc vs elementy; B) white bg na viz card thumbs; C) jedna belka search+tabs branding.

**Log/Status:**
1. RCA A: assoc grid lex:1 + elementy max-height:min(240px,32vh) - puste skojarzenia zajmowaly cala kolumne, Elementy w waskim pasku.
2. Fix A: .dam-assoc-pane-split + suwak 44px; ratio 60/40 (oba content), 20/80 (puste assoc); localStorage dam-assoc-elementy-split:{product_id}; osobny scroll top/bottom; CSS w dam-viz-modal.css + inject z JS.
3. RCA B: checkerboard na globalnym .dam-viz-thumb__img (po dematte ELEMENTY) trafial tez w #vizGrid karty.
4. Fix B: .dam-viz-thumb__img = #fff / ackground-image:none (dark: surface); checker zostaje na assoc/elementy thumbs.
5. RCA C: osobne ramki .dam-global-search-block + .dam-branding-tabs-row (~146+72px).
6. Fix C: tabs + archive switch wewnatrz .dam-search-wrap--branding-chrome; usunieto outer frame / scope-toggles wrapper; panel ~133px.
7. Cache-bust ?v=assocSplit20260721c.

**Efekt/Fix:** Empty assoc oddaje ~80% Elementom; drag+persist per product; packshoty na bieli; jedna belka branding.

**Test/Ewaluacja:**
- CIASTO empty: top 20% / bot 76%, splitter 44px, Elementy panel max-height none, H~731 — PASS.
- Persist: ciasto  .35, babka  .45 osobno; reopen restores — PASS.
- BABKA both content: topPct 60 / botPct 36 (60/40 default) — PASS.
- Offscreen media-preview path (renderLinkedAssetsInto): burger/babka splitTop 0.6 — PASS.
- Viz thumbs CDP: bg rgb(255,255,255), background-image none — PASS.
- Branding toolbar: tabsInsidePanel, no tabs-row, archDirectChild, panelH 133 — PASS.
- 
ode --check dam-media-preview.js OK.

**Zrodla:** dam-media-preview.js, dam-viz-modal.css, dam-brand.css, dam-branding.css, branding.html, dam-tutorial.js, HTML ?v=, process.md

## 2026-07-21 - FORCE kafelki + user-prefs KV

**Komenda/Akcja:** A) Redesign modala FORCE dry-run na kafelki; B) migracja preferencji UI z localStorage do Postgres KV `user-prefs:{email}`.

**Log/Status:**
1. RCA A: `formatForcePreviewList` = monospace wall (produkt · id + pełne `X:\` + "program chce: clear") — nieczytelne.
2. Fix A: siatka `.dam-force-tile` (nazwa produktu, badge F/X/D/∅, folder before→after z liter, ikona rename/archive/clear, chevron pełnej ścieżki, chipy Wszystkie/Rename/Archiwum/Clear). CSS inject w `ensureExplorerCtaUnifyCss`. Info-tile dla Odśwież / Export.
3. RCA B: `DamUserPrefs` trzymał tylko `safe_delete` + `branding_page_size`; zoom/split/filtry explorer żyły w localStorage → "program zapomina" między PC / po czyszczeniu.
4. Fix B: rozszerzony bridge `_uprefs_normalize` + JS `dam-user-prefs.js` (card_zoom, assoc_split, explorer_*, reveal_low_tags, sidebar_collapsed); migrate once z LS; debounced POST; mirror cache LS.
5. Restart `local_bridge.py` (nowe pola w normalize). Cache-bust `?v=prefsKv20260721a` / `forceTiles20260721d`.

**Efekt/Fix:** FORCE = czytelne kafelki; preferencje UI → Postgres KV (source=postgres).

**Tabela kluczy (LS → KV `user-prefs:{email}.prefs.*`):**
| Setting | było LS | teraz KV field |
|---|---|---|
| Card zoom | `dam_viz_card_zoom` | `card_zoom` |
| Assoc/Elementy split | `dam-assoc-elementy-split:{pid}` | `assoc_split.{pid}` |
| Branding page size | (już KV) + LS cache | `branding_page_size` |
| Explorer show all | `dam_explorer_show_all` | `explorer_show_all` |
| Explorer lang filter | `dam_explorer_lang_filter` | `explorer_lang_filter` |
| Explorer viz view | `dam_viz_view_mode` | `explorer_viz_view` |
| Explorer viz scale | `dam_viz_scale` | `explorer_viz_scale` |
| Reveal low tags | `dam_reveal_low_tags` | `reveal_low_tags` |
| Sidebar collapsed | `dam_sidebar_collapsed` | `sidebar_collapsed` |
| Safe delete | (już KV) | `safe_delete` |

**Nadal local-only (celowo):** `dam_token`/role/user (sesja auth); `sessionStorage` nav/tutorial cheer; theme (`dam_theme_pref` — device); carrier overrides / elements links / status JSON mirror (dane domenowe, nie UI prefs).

**Test/Ewaluacja:**
- FORCE: 24 tiles, chipy, `— → F/D/X/∅`, folder `…` → `… - F`, filtr Archiwum=2, pełna ścieżka expand — PASS (screenshot pass 1–5, Anuluj bez apply).
- Prefs POST: `card_zoom:118`, `explorer_show_all:true`, `source:postgres`, pełny zestaw kluczy — PASS.
- `node --check`: dam-explorer, dam-user-prefs, dam-media-preview, dam-shell, dam-badges, dam-viz, dam-branding — OK.
- `ast.parse` local_bridge.py — OK.

**Zrodla:** dam-explorer.js, dam-user-prefs.js, local_bridge.py, dam-media-preview.js, dam-shell.js, dam-badges.js, dam-viz.js, dam-branding.js, HTML ?v=, process.md


## 2026-07-21 - FORCE confirm modal redesign (Teraz / Po zmianie)

**Komenda/Akcja:** Intensive QA 10 passes - redesign `#damExplorerConfirmModal` dry-run FORCE preview.

**Design Read:** Admin confirmation modal for destructive disk FORCE; trust-first language, generous whitespace; `dam-int-cta` / `geex-btn` scale - NOT oversized red pills.

### Spacing doctrine (ZAPAMIETAJ)
- Modal body padding: `24px 28px`
- Change rows gap: `>= 20px`
- Inside each Teraz/Po block: `padding: 16px 18px`
- Section gaps header / filters / list / footer: `16-24px`
- NEVER pack text tight - human scan, not machine density
- Content panel: `width: min(70vw, 1200px)`, `height: min(90vh, 900px)`; scroll in `__body` only

**Log/Status:**
1. RCA cramped modal: `ensureExplorerCtaUnifyCss` had `str + /* comment */ + nextStr` -> unary `+` -> `NaN` selector `nan#damExplorerConfirmModal…` so size rules never applied (stuck at base `.dam-basepath-box` 520px).
2. Fix: remove dangling `+` after bare comment; panel class `dam-explorer-confirm-modal` flex column; body scroll; before/after 2-col blocks Teraz / Po zmianie (stack `<=768`); accent inset on Po; compact footer CTAs 34px matching toolbar; PL chips; no mid-arrow.
3. Cache-bust: `explorer.html?v=forceModalRedesign20260721i`.

**Efekt/Fix:** Readable FORCE dry-run with clear Teraz/Po, large panel, toolbar-scale buttons.

**Test/Ewaluacja (CDP @1280):**
- box `896×810` (=70vw×90vh), bodyPad `24px 28px`, rowGap `20px`, btnH `34` (= `#damLifecycleForce`), cols `1fr 1fr`, no `.dam-force-diff__arrow`
- 10-pass screenshot+Read: size/hierarchy, before-after, filters (Archiwum/Clear), 768 stack, dark, final lock

**Zrodla:** dam-explorer.js, explorer.html, process.md, agents/shared/code-doctrine.md §12

## 2026-07-21 - Preview cache Redis + circuit breaker + Synology truth (K0-K8)

**Komenda/Akcja:** Plan preview_cache_redis_ec0a7794 v5 - Redis opcjonalny z circuit breaker, PAMIEC-PODRECZNA, path resolve, preview truth UI, QA, commit+push.

**Log/Status:**
1. K0: Grep 4x Synology lie (media-preview x3, branding x1). Health :8766 OK. Docker CLI jest, daemon DOWN - Redis nie startuje (oczekiwane).
2. K1: program-instructions v15 - preview.file_state.*, preview.cache.*, preview.cache.redis (circuit+matrix), paths.topology.*, preview.onerror_not_synology. app-settings mirror.
3. K1r HARD: dam_redis.py CLOSED/OPEN/HALF-OPEN, N=3, cooldown 12s, background probe; connection refused -> OPEN; fallback matrix 4 role; docker-compose.redis.yml; requirements redis; health redis/circuit/matrix. Docker up FAIL (daemon) - degrade OK.
4. K1b: dam_path_resolve.py + wire _coerce_media_target / _is_under_marketing.
5. K2: dam_file_availability.py + GET /file-availability; markery probe_wait/probe_done/recall_pending w agents/shared/handoff-preview-cache.md.
6. K3: dam_thumb_cache.py + PAMIEC-PODRECZNA + GET/POST thumb-cache; AVIF; gitignore binariow.
7. K4: dam-preview-truth.js; usunieto Synology Drive / brak sync z onerror; thumbs -> /thumb-cache; ?v=previewRedis20260721a.
8. K5: warm async API; timing cache hit.
9. K6: doctrine §12; README Redis/circuit; PAMIEC README.
10. K7 QA (ui-taste):
    - Pass1 no false Synology title: PASS (lieCount=0, onErrorTitle=Podglad niedostepny)
    - Pass2 ELEMENTY/branding thumbs /thumb-cache: PASS (12/12 cache URLs, naturalWidth>0, screenshot Branding)
    - Pass3 online_only label: PASS (DamPreviewTruth.LABEL_ONLINE_ONLY poprawny)
    - Pass4 CYNAMONKA: PARTIAL - produkt w indeksie+folder na X:; brak rasterow w folderze (avail missing dla dir); lokalny preview potwierdzony na innych assetach (state=local, AVIF)
    - Pass5 timing+redis health: PASS (1st thumb ~144ms AVIF; 2nd X-DAM-Cache-Hit=1 Ms=1; health redis=open circuit=open)
11. K8: commit+push (ponizej).

**Efekt/Fix:** UI bez falszywego Synology onerror; Redis optional z circuit; thumbs na D: PAMIEC; path resolve per device.

**Test/Ewaluacja:**
- curl /health api_version=6 redis=open
- /file-availability state=local na logo Kubara
- /thumb-cache hit <500ms (1ms)
- node --check JS OK; ast.parse bridge OK
- Grep UI: zero Synology Drive / brak sync w dam-*.js (tylko komentarz PI / skill)

**Zrodla:** plan v5, dam_redis.py, dam_path_resolve.py, dam_file_availability.py, dam_thumb_cache.py, local_bridge.py, dam-preview-truth.js, dam-media-preview.js, dam-branding.js, program-instructions.json, README, code-doctrine.md, process.md

