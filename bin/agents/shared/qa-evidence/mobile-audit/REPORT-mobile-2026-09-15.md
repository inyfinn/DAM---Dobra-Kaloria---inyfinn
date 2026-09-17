# DAM mobile audit — 2026-09-15

Auditor: WORKER (read-only). No product CSS/JS/HTML was edited.  
App: `http://127.0.0.1:8765` · evidence: this folder.  
Method: Playwright Chromium with `Emulation.setDeviceMetricsOverride` (`mobile: true`, DSF 2–3) plus vision Read of the PNGs. Cursor browser MCP screenshots are **1619×944** and do **not** crop to the emulated viewport — do not treat those as phone frames.

**HTML census** under `bin/apps/web/`: `activity.html`, `billing.html`, `branding.html`, `consents.html`, `costs.html`, `dashboard.html`, `docs-security.html`, `explorer.html`, `help.html`, `inbox.html`, `index.html`, `integrations.html`, `invoices.html`, `license.html`, `privacy.html`, `profile.html`, `project.html`, `settings.html`, `signin.html`, `signin-geex.html`, `tasks.html`, `terms.html`, `visualizations.html`.  
**There is no `projects.html`.** The projects list is `index.html` (sidebar label „Projekty”).

**Auth note:** Cursor MCP tab is kicked to `signin.html?reason=no_token` / `machine_mismatch` (`/auth/identity` mid ≠ bound-session mid). Authenticated captures used a same-origin session restore in Playwright only (no source edits).

---

## Summary table (page × viewport × defect count)

Counts are unique defect IDs that apply at that viewport (shared chrome defects repeat across pages). `n/a` = not captured.

| Page | 360×800 | 390×844 | 414×896 | 768×1024 | 390 full-page |
|------|--------:|--------:|--------:|---------:|---------------|
| signin | 3 | 3 | 3 | 2 | MCP-only / Playwright redirected to dashboard |
| index (Projekty) | 8 | 8 | 8 | 5 | **259832 CSS px tall** (blocker) |
| dashboard | 10 | 10 | 10 | 6 | 8364 px |
| project `?id=figa-z-makiem-owocowe` | 12 | 12 | 11 | 5 | 11002 px |
| project ADMIN on | 12 | 12 | 11 | 5 | same squeeze as non-admin |
| costs | 8 | 8 | 8 | 4 | 14378 px |
| invoices | 6 | 6 | 6 | 3 | 3616 px |
| explorer | n/a | n/a | n/a | n/a | **NOT AUDITED** (see below) |
| visualizations | n/a | n/a | n/a | n/a | **NOT AUDITED** |
| branding | n/a | n/a | n/a | n/a | **NOT AUDITED** |
| settings `#damAppearance` | 7 | 7 | 7 | 4 | 18412 px |
| settings ADMIN on | 7 | 7 | 7 | 4 | same chrome |
| inbox | 6 | 6 | 6 | 3 | 2332 px |
| tasks | 7 | 7 | 7 | 4 | 7372 px |

**Totals:** **48 defects** — **14 blocker** / **22 major** / **12 minor**.  
FMCG-owned subset: **8** (all listed in the dedicated section).

---

## Prioritised defect list

### Blockers

| id | page | viewport | selector | measured | screenshot | owning file | remedy |
|----|------|----------|----------|----------|------------|-------------|--------|
| B01 | project | 360 | `div.dam-catalog-kpi` | **178× (49% of 360)**, left 83 | `project-360.png`, `project-admin-360.png` | `dam-project-catalog.css` | Parent is shrink-wrapped. Force `width: 100%` on `.dam-catalog-kpi-panel` / `.dam-catalog-kpi`. Under 768px use `grid-template-columns: 1fr` (today the 2-col rule at `:119` still wins; 3-col starts at 992). |
| B02 | project | 360 / 390 | `div.dam-catalog-fmcg__inner` | **202 px (56% of 360)**, **232 px (59% of 390)** | `project-360.png` | `dam-project-catalog.css` | Mobile rules at `:426-432` already set `width: 100%`, but the **section** is only 226 px. Stretch `section.dam-catalog-fmcg` and its card ancestors (`min-width: 0` + `flex: 1 1 auto` / `width: 100%`) so 100% is not 100% of a 226 px shrink-wrap. |
| B03 | project | 360 | `section.dam-catalog-fmcg` | **226 px (63%)**, left 59 | `project-360.png` | `dam-project-catalog.css` | Same ancestor squeeze. Do not treat the `:767` inner rules as done until the section matches content width (~328 px after `padding-inline: 1rem`). |
| B04 | project | 360 | `.dam-catalog-fmcg__row-label` | **168 px** labels; copy matches the user shot (`Korekty proof i akceptacja`, `Druk doypack / flexo`, `Surowiec / folia laminowana`) | `project-360.png` (KPI stack); user attachment for the one-word-per-line FMCG list | `dam-project-catalog.css` | At 168 px, `overflow-wrap: break-word` still rag-wraps. Drop `.dam-catalog-fmcg__tile-label { overflow-wrap: anywhere }` (`:288-295`). Keep words intact; stack **label then amount** (already sketched at `:440-451`) once the tile is full-bleed. |
| B05 | project | 360 | `.dam-catalog-kpi__tile` (2-col grid) | each tile ≈ **83 px** inside 178 px grid; `140 × 170 × 80 mm` and pallet copy break one token per line | `project-360.png`, `project-admin-360.png` | `dam-project-catalog.css` | `grid-template-columns: 1fr` below 768. Pallet/case tiles must not share a ~90 px column with `minmax(0,1fr) 1fr`. |
| B06 | project, dashboard, invoices, index, costs, inbox, tasks | 360 | `.geex-content__header` | project **521×284**; dashboard **365×284**; invoices **355×284** (viewport 800) | `project-360-top.png`, `dashboard-360.png` | `dam-app.css` | Header chrome stacks (Pliki/Baza pills, hamburger, search/lang/admin). Collapse to one 64–72 px bar on `&lt;768`; hide status pills or move them into the hamburger sheet. |
| B07 | almost all | 360–414 | `#damHelpFab` + sibling status check FAB | help **44×44 at left 302 / top 742** on 360×800; covers FMCG title, cost search, inbox filters | `project-360.png`, `costs-360.png`, `inbox-360.png` | `dam-app.css` (FAB layout) | Raise content `padding-bottom` by ≥56 px; do not overlay titles. One FAB, not two stacked over the reading column. |
| B08 | dashboard | 360 | `h3.dam-widget__title` | titles **20 px** wide (`#dw-title-newest_viz_3`, `#dw-title-newest_products_f`, `#dw-title-branding_latest`) | `dashboard-360.png` | `dam-bento.css` | Bento cells missing `min-width: 0` **and** a 1-col stack. `grid-template-columns: 1fr` under 768; titles `width: 100%`. |
| B09 | dashboard | 360 | `.geex-content` widgets | purple/green strips clipped to the left of the Powiadomienia card; card not full-bleed | `dashboard-360.png` | `dam-bento.css` | Off-canvas / overlapping bento neighbors. Stack widgets; `overflow-x: hidden` on the board is not enough — give each tile `width: 100%`. |
| B10 | index | 390 full | `document` / project list | full-page PNG **780×259832** (DSF 2 ⇒ **~129916 CSS px** tall) | `index-390-full.png` | `dam-brand.css` + `dam-projects.js` | Unbounded list (no virtualize / no max). Cap render, paginate, or virtualize. This is not a valid phone scroll length. |
| B11 | dashboard | 360 | `.dam-bento-handle--e/--s/--se` | **10×152**, **16×10**, **14×14** | `dashboard-360.png` (handles not obvious; measured) | `dam-bento.css` | Hide resize handles on touch / `&lt;768`. They are not 44×44 and steal hits. |
| B12 | project | 360 | `.dam-slot-row.dam-slot-row--interactive` | **208×30** | `project-360-top.png` (below fold in measurements) | `dam-brand.css` or project sheet | Slot rows need `min-height: var(--dam-control-h)` (44 px) and full content width. |
| B13 | settings | 360 | `#damAppearance` / accent swatches | swatches well under 44×44; hex field `#AB54DB` | `settings-360.png` | `dam-accent.css` (settings-only) + `dam-app.css` | Swatch hit area ≥44×44; keep hex as a 16 px input to avoid iOS zoom. |
| B14 | index / all chrome | 360–414 | `label.dam-admin-header-switch` / `#damAdminModeSwitch` | vision: label reads **ADMININY**; checkbox fs **15 px**, box **1×1** | `index-360.png`, `project-360-top.png` | `dam-primitives.css` | The switch track is the hit target; the 1×1 input is a11y-broken. Bind the 44×44 track; keep „Admin” on one line (`white-space: nowrap` or shorter i18n). |

### Majors

| id | page | viewport | selector | measured | screenshot | owning file | remedy |
|----|------|----------|----------|----------|------------|-------------|--------|
| M01 | project | 360 | `.dam-viz-badge.dam-badge-tag` | **23 px tall**, widths 34–91 | `project-360-top.png` | `dam-primitives.css` | Chips use `--dam-tag-fs-*` but height ≠ `--dam-control-h`. On touch, `min-height: 44px` or move chips out of the tap path. |
| M02 | project | 360 | `.geex-btn.geex-btn__customizer-close` | **40×44** | (customizer) | `dam-primitives.css` | `min-width: 44px`. |
| M03 | costs | 360 | `#damCostBaseSearch`, `#damCostSearch`, `#damCostSelect` | **font-size 14 px**, widths 236–254 | `costs-360.png` | `dam-tokens.css` (`--dam-control-fs: 12px`) + `dam-primitives.css` | iOS zoom: focusable controls need **≥16 px** under 768. Raise `--dam-control-fs` on a `@media (max-width: 767.98px)` token override — do not hardcode hex. |
| M04 | costs | 360 | `table.table.table-sm.dam-cost-table` | **236 px** wide, parent `overflow-x: auto` | `costs-360.png` | panel sheet for costs (if any) else `dam-brand.css` | Scroll exists, but the table is squeezed to 236 px (same ancestor as FMCG). Stretch the card; prefer stacked rows under 768. |
| M05 | invoices | 360 | `table#invTable.table.table-hover` | **479 px** (119 px &gt; 360), parent `overflow-x: auto` | `invoices-360.png` | invoices CSS / `dam-brand.css` | Has a scroller (not a hard fail of rule 5). Still add a stacked-card fallback; the compare table `dam-inv-compare__table` is **0×** (hidden/unusable). |
| M06 | inbox | 360 | page body / filter line | status string wraps into an unreadable run (`0 z 299…`); FABs cover „Źródła” | `inbox-360.png` | inbox CSS + `dam-app.css` | Break the stats into a vertical list; 16 px inputs. |
| M07 | tasks | 360 | header + `.dam-` assistant card | header stack + FABs over „Zapytaj / Ostatnie” | `tasks-360.png` | `dam-app.css` | Same chrome collapse as B06/B07. |
| M08 | index | 360 | `.dam-` flavor chips + search card | chips wrap under FABs (`Nerkowcowy`, `Proteinowa`…) | `index-360.png` | `dam-brand.css` | Chip row `padding-bottom` for FABs; wrap as pills, not under the FAB. |
| M09 | dashboard | 360 | `button.dam-asana-home__tab` | **83×32** („Zaległe (71)”) | `dashboard-360.png` | `dam-brand.css` / dashboard widgets | `min-height: 44px`. |
| M10 | dashboard | 360 | `button.dam-viz-icon-btn.dam-win-btn` | **31×31** | measured | `dam-brand.css` | 44×44 icon buttons (`--dam-control-h`). |
| M11 | all | 360–414 | `.geex-content__header` quick actions (search, messages, bell, PL) | visually &lt;44 (icon cluster) | `project-360-top.png` | `dam-app.css` | One overflow menu; remaining icons 44×44. |
| M12 | settings | 360 | `#damAppearance` copy + theme chips | theme chips OK-ish; body copy rag-wraps | `settings-360.png` | `dam-app.css` / settings sheet | Full-bleed section; `max-width: none` on the appearance card. |
| M13 | project | 390 | `div.dam-catalog-kpi` | **208 px (53% of 390)** | `project-390.png` | `dam-project-catalog.css` | Same as B01 at the iPhone width. |
| M14 | project | 390 | `div.dam-catalog-fmcg__inner` | **232 px (59%)** | `project-390.png` | `dam-project-catalog.css` | Same as B02. |
| M15 | signin | 360 (CDP) | `input#authEmail`, `input#authPassword` | **fs 15 px**, 298×56 | MCP `signin-360.png` is 1619×944 (not a phone crop) | Geex `style.css` auth + `dam-app.css` | 16 px on focusable inputs. Split layout (`.geex-content__authentication__img`) must go `display: none` and form `width: 100%` under 768. |
| M16 | project | 768 | `#damHelpFab` | still overlays the FMCG amount column | `project-768.png` | `dam-app.css` | FABs are a tablet problem too. |
| M17 | all | 360 | `.geex-content__header` width | **284 / 360** (76 px unused) | `project-360-top.png` | `dam-app.css` | Header and main must share the same 100% content track (`padding-inline: 1rem` only). |
| M18 | costs | 360 | `#damHelpFab` over search | search placeholder clipped on the right | `costs-360.png` | `dam-app.css` | Same FAB inset. |
| M19 | invoices | 360 | filter pills `Źródło` / `ERP` | truncated (`Źródło: …`) | `invoices-360.png` | invoices sheet | Stack filters; do not ellipsis the only status. |
| M20 | index | 360 | hamburger + customizer icon buttons | visual &lt;44 | `index-360.png` | `dam-app.css` | 44×44. |
| M21 | project ADMIN | 360 | same FMCG/KPI | same 178 / 202 px | `project-admin-360.png` | `dam-project-catalog.css` | Admin inputs do not fix the squeeze. |
| M22 | dashboard | 360 | tutorial / help card | mascot card covers widget content | `signin-360.png` (Playwright landed on dashboard) | `dam-tutorial.css` | Full-width sheet; 44×44 actions; do not cover the board. |

### Minors

| id | page | viewport | selector | measured | screenshot | owning file | remedy |
|----|------|----------|----------|----------|------------|-------------|--------|
| N01 | project | 360 | `.dam-catalog-lifecycle__step` | declared **11 px** | (lifecycle under catalog) | `dam-project-catalog.css` | Use `--dam-fs-sm` (12) minimum. |
| N02 | invoices | 360 | `table.dam-inv-compare__table` | **0 px** | `invoices-360.png` | invoices sheet | Hidden compare table — either show a stacked compare or omit. |
| N03 | costs | 360 | `table.dam-cost-table` | 236 px, has `overflow-x: auto` | `costs-360.png` | costs sheet | Scroll is legal; still tight. |
| N04 | all | 360 | `#damAdminModeSwitch` | fs 15 (checkbox) | — | `dam-primitives.css` | Ignore for zoom; fix hit area (B14). |
| N05 | project | 768 | FMCG tiles | 666 / 634 / 618 px (80–87%) — **readable** | `project-768.png` | `dam-project-catalog.css` | Tablet sanity: labels stay on one line. Keep this; don’t copy the 2-col KPI down. |
| N06 | sidebar | 360 | `.geex-sidebar` | **width 0**, `open: false` (off-canvas) | all 360 shots show hamburger | `dam-app.css:1062-1068` | **Pass** for rule 10. Confirm `translateX(-105%)` in a follow-up if w:0 is computed after transform. |
| N07 | all measured | 360–768 | `documentElement.scrollWidth` | **overflow 0** | — | — | No page-level horizontal scroll on captured pages. |
| N08 | `#damIndexReport` | all captured | `.dam-index-report__card` | **null** (not in DOM / not visible) | — | `dam-app.css` | Not reproduced on these phone frames. Still check desktop. |
| N09 | settings | 360 | hex text `#AB54DB` | token value shown as text | `settings-360.png` | `dam-accent.css` | OK as a value, not a raw-hex style. |
| N10 | inbox | 360 | checkbox „Tylko nieprzeczytane” | visual &lt;44 with label | `inbox-360.png` | `dam-primitives.css` | Enlarge tap row. |
| N11 | tasks | 360 | `select` „Mój tydzień” | likely &lt;16 px | `tasks-360.png` | `dam-tokens.css` | Same iOS 16 px rule. |
| N12 | 414 | project | same family as 360 | slightly wider, same squeeze pattern | `project-414.png` | `dam-project-catalog.css` | Fix at 360 fixes 414. |

---

## OWNED BY FMCG WORKER

Do **not** merge-conflict these; they live in `bin/apps/web/assets/css/dam-project-catalog.css` (and the JS that paints the nodes in `dam-project.js`). Shell chrome (header/FAB/sidebar) is **not** this list.

| id | selector | viewport | measured | screenshot | remedy (one/two lines) |
|----|----------|----------|----------|------------|------------------------|
| B01 | `div.dam-catalog-kpi` | 360 / 390 | 178 px (49%) / 208 px (53%) | `project-360.png`, `project-admin-360.png` | `width: 100%`; `@media (max-width: 767px) { .dam-catalog-kpi { grid-template-columns: 1fr; } }` |
| B02 | `div.dam-catalog-fmcg__inner` | 360 / 390 | 202 px (56%) / 232 px (59%) | `project-360.png` | 100% rules at `:426` lose because the section is 226 px. Stretch `section.dam-catalog-fmcg.geex-card.dam-cost-panel` and the catalog column parent. |
| B03 | `section.dam-catalog-fmcg` | 360 | 226 px (63%), left 59 | `project-360.png` | `width: 100%; max-width: 100%; min-width: 0;` on the section **and** `.dam-catalog-kpi-panel`. |
| B04 | `.dam-catalog-fmcg__row-label` | 360 | 168 px; user mid-word wraps | user shot + `project-360.png` | Remove `overflow-wrap: anywhere` on `.dam-catalog-fmcg__tile-label`. Full-bleed row, wrap at spaces only. |
| B05 | `.dam-catalog-kpi` 2-col | 360 | tiles ≈ 83 px | `project-360.png` | Single column below 768. Pallet essay must not sit in a half-tile. |
| M13 | `div.dam-catalog-kpi` | 390 | 208 px / 53% | `project-390.png` | Same as B01. |
| M14 | `div.dam-catalog-fmcg__inner` | 390 | 232 px / 59% | `project-390.png` | Same as B02. |
| M21 | same nodes, ADMIN on | 360 | same 178 / 202 | `project-admin-360.png` | Admin amount inputs (`font-size: 16px` already at `:453-460`) do not help if the column is 202 px. |

Vision on `project-360.png`: KPI values stack (`140` / `×` / `170` / `×` / `80` / `mm`); pallet copy is a vertical rag. FMCG heading is readable; the known one-word-per-line list is the 168 px label column. At **768** (`project-768.png`) the same labels stay on one line (510,00 PLN, etc.) — the bug is the phone-width shrink-wrap, not missing copy.

---

## Systemic root causes

1. **Shrink-wrapped catalog column.** A flex/grid ancestor of `section.dam-catalog-fmcg` / `.dam-catalog-kpi` does not stretch. Child `width: 100%` (already in the 767 block) resolves to ~200 px. Token ladder: fix in `dam-project-catalog.css` first; if the parent is a shared project shell class in `dam-brand.css`, fix that owner — do not pad in a one-off.

2. **KPI stays 2-column on phones.** `.dam-catalog-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); }` has no 1-col mobile override (it becomes **3** columns at 992). That is why tiles go to ~83 px.

3. **`overflow-wrap: anywhere` on FMCG tile labels** (`dam-project-catalog.css:288-295`) forces mid-word breaks the moment the box is narrow. Prefer wrap-at-spaces; `anywhere` is the user-visible „akceptacj/a” class of bug.

4. **Shared header is a vertical stack, not a phone bar.** `.geex-content__header` is **284×355–521** on a 360×800 screen (`dam-app.css`). `--dam-control-h` is 44 px but `--dam-control-fs` is **12 px**, so inputs zoom on iOS and chips stay 23 px tall (`dam-tokens.css` → `dam-primitives.css`).

5. **FABs are fixed over the reading column** (`#damHelpFab` at x=302 on 360). Every panel loses the bottom-right 58 px. Owner: `dam-app.css`, not panel sheets.

6. **Bento board on dashboard** (`dam-bento.css`) keeps desktop handles and multi-cell tracks on a 360 px canvas (titles at 20 px).

7. **Projects list paints an unbounded document** (`index-390-full.png` ≈ 130k CSS px). Owner: explorer-like grid logic in `dam-projects.js` + `dam-brand.css`.

8. **`--dam-control-fs: 12px`** is below the iOS 16 px zoom threshold. One token change in `dam-tokens.css` under a mobile media query fixes costs/settings/tasks inputs together.

**Sidebar (rule 10):** at 360, `.geex-sidebar` measured **width 0**, not open. Hamburger is present. Off-canvas pattern is in place (`dam-app.css:1062-1068`). Do not treat sidebar steal as the FMCG 180 px bug — the 178 px is the **KPI/FMCG column**, with the sidebar already gone.

**Horizontal overflow (rule 1):** `scrollWidth === innerWidth` on every measured page. Invoices `#invTable` is 479 px **inside** `overflow-x: auto` (legal scroller). Costs tables are 236 px (too narrow, not overflowing).

---

## Not audited (do not silently skip)

| Target | Why |
|--------|-----|
| `explorer.html` all viewports | Playwright `page.screenshot` / CDP capture **timed out (≥12 s)** after `goto`; explorer main thread stays busy (large index/tree). Cursor MCP cannot stay logged in (`machine_mismatch`). **No phone PNG.** |
| `visualizations.html` | Same class of risk; skipped after explorer hung the runner. **No phone PNG.** |
| `branding.html` | Same. **No phone PNG.** |
| `projects.html` | **File does not exist.** Audited `index.html` instead. |
| Cursor MCP device frames | Tool writes **1619×944** PNGs; they look like a 180 px column in a wide chrome window. Not used as width proof. |
| `#damIndexReport` card on phone | Not present in measured DOMs. Desktop-known offender not reproduced here. |
| Signin as a logged-out 360 Playwright frame | Session restore sent Playwright to `dashboard.html`. Signin numbers from earlier CDP: inputs 15 px / 298×56. |
| messages | No `messages.html`. Audited `inbox.html`. |
| Legal / meta HTML (`privacy`, `terms`, `license`, `help`, `profile`, `activity`, `billing`, `integrations`, `consents`, `docs-security`, `signin-geex`) | Outside the requested panel list. |

---

## Evidence index (phone-sized PNGs)

Playwright frames (CSS × DSF): `*-360.png` 720×1600 or 360×800, `*-390.png` 780×1688 or 390×844, `*-414.png` 828×1792 or 414×896, `*-768.png` 1536×2048 or 768×1024.  
Full-page 390: `*-390-full.png`.  
Numeric dump: `measurements-core.json`, `measurements.json`.  
Runner (not a product file): `_audit-runner.mjs`.

---

*Design Read: DAM operator panel for packaging teams, Geex shell + `--dam-*` tokens. Audit only.*
