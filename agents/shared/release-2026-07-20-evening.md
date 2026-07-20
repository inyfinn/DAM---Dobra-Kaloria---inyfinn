# Release notes: sesja 2026-07-20 (wieczór)

**Repo:** `inyfinn/DAM---Dobra-Kaloria---inyfinn` · **Wersja hub:** 2.0.7  
**Commity na `main`:** `e28a4bd`, `025aad3` (już na `origin/main`)

Pełny log operacyjny: [`process.md`](../../process.md). Brief usera: [`usability-brief-2026-07-20.md`](usability-brief-2026-07-20.md).

---

## Co wdrożono (DONE + weryfikacja)

### Motion global + skeleton loading
- `dam-grid-reveal.js`: reveal 0.45s, `rootMargin -50px`, kolejność góra→dół, wariant `layout: viz-grid`
- Skeleton shimmer: costs, integrations, invoices, branding (`#ececf2`), wizualizacje (10 kart od `init()`)
- Hover scale przycisków/ikon sidebar; sidebar bez slide (tylko morph)
- Cache: `skel20260720a`, `skelvis20260720b`, `skelbent20260720a`

### Sidebar identity (collapsed logo + meta)
- Slot absolute (logo bottom 38px, meta 10px) w morph i steady collapsed — bez skoku `absolute→flex`
- Meta `display:none` po expand; logo collapsed czytelne w całości
- Cache: `dam-shell.js?v=sidebaridentity20260720b`, `dam-brand.css?v=sidebaridentity20260720a`
- Handoff: [`handoff-strefa-SIDEBAR.md`](handoff-strefa-SIDEBAR.md)

### Explorer — Historia statusów (lifecycle)
- Modal `#damLifecycleHistoryModal`: aktualny stan u góry, hashtagi `#lc_…`, filtry F/X/D/—
- Przywróć + Cofnij (1 poziom), `sessionStorage` dla `restored_from`
- CSS modal 60vw / max 90vh; PI `lifecycle.history_restore` w `program-instructions.json`
- Cache explorer: `dam-explorer.js?v=lifehist20260720a`, `dam-brand.css?v=lifehist20260720a`

### Explorer create (FAZA backlog — podstawowy modal)
- `dam-explorer-add-product.js` + `explorer_create.py`: kategoria/produkt, dry-run „Podgląd”, potwierdzenie
- Bridge: `POST /explorer/create-category|create-product`; szablony z `Szablony folderów`
- Cache: `expb20260720b`
- QA: utworzenie `TEST AGENT CAT` na X: — PASS

### Backlog checklisty (A3 / B3–B7 / C2 / C3)
| ID | Zakres |
|----|--------|
| A3 | FMCG katalog 45 poz. + import-map v2 + CSV template |
| B3 | Poster wideo SVG fallback (bridge + JS) |
| B4 | Tagi Autor w Brandingu |
| B5 | Dashboard layout 2×2 / 1×4 / 1×6 @375/768/1280 — PASS |
| B7 | Sweep cache-bust `bust20260720a` |
| C2 | ERP faktur stub (erp-status + export + UI) |
| C3 | BENTO freeze anatomii — [`bento-card-freeze.md`](bento-card-freeze.md) |

### Integracje hub (równoległe agenty)
- Skeleton Bento span-2, Konfiguruj panel fix, PLANOWANE +30, FMCG Edytuj
- Handoff: [`handoff-strefa-INTEGRACJE.md`](handoff-strefa-INTEGRACJE.md)

---

## Agenci badawczy (DONE — tylko raporty)

| Agent | Wynik |
|-------|--------|
| costs/integrations map | brak `dam-grid-reveal.js`; mounty do skeletonu |
| Branding load | ~43 MB JSON + brak cache frontend = bottleneck |
| Animation audit | GSAP reveal + rozproszone CSS transition |
| Desktop tray | pywebview + pystray; brak minimize→tray |
| Viz vs branding grouping | branding flat; rekomendacja `groupByProduct` pattern |

---

## OPEN — agent przerwany (nie w commicie wieczoru)

**Explorer Create Modal redesign (10-pass ui-taste)** — subagent `202d725c` **aborted** po starcie.

Wymagania usera nadal do domknięcia w `dam-explorer-add-product.js` / `dam-explorer.js`:

1. Podgląd tylko `Tworzenie: X:\…` (bez Plan/Drzewo)
2. Live preview przy wpisywaniu (nie tylko przycisk Podgląd)
3. Edytowalny licznik kategorii (`09 - KREMY`)
4. `#damExpErr` ukryty gdy pusty
5. Drzewo folderów z ikonami pod błędem
6. Checkboxy Geex (bez pomarańczowych natywnych)
7. Warianty domyślnie odznaczone; tag lewo, podgląd prawo
8. Nowy wariant globalny (PL/EN/nazwa → program-instructions)
9. Post-create: Przejdź / Zatwierdź / Cofnij (~2 min)
10. Bump cache w `explorer.html`

Obecny copy w modalu: *„Wypełnij pola i kliknij Podgląd”* — sygnał, że redesign nie domknięty.

---

## Cache-bust — szybka mapa (hard refresh Ctrl+F5)

| Asset | `?v=` | Strony |
|-------|-------|--------|
| `dam-grid-reveal.js` | `skel20260720a` | branding, visualizations, costs, integrations, invoices |
| `dam-shell.js` | `sidebaridentity20260720b` | globalnie |
| `dam-brand.css` | `sidebaridentity20260720a` / `lifehist20260720a` | explorer = lifehist |
| `dam-explorer.js` | `lifehist20260720a` | explorer.html |
| `dam-explorer-add-product.js` | `expb20260720b` | explorer.html |
| `dam-dashboard-widgets.js` | `b5qa20260720f` | dashboard.html |

---

## Checklista użytkownika (stan końcowy sesji)

- **A1, A2** `[ ]` — brak `DAM_ASANA_*` / `DAM_MS_*` w env (user)
- **A3, B3–B7, C2, C3** `[x]`
- **B2** `[ ]` — import FMCG XLSX (openpyxl)
- **C1** `[ ]` — Entra/LDAP produkcyjne

---

## Po wdrożeniu (operacyjnie)

1. Restart bridge po zmianach `local_bridge.py` (A4)
2. Hard refresh stron z tabelą cache powyżej
3. Następna fala: domknąć create modal (OPEN) + opcjonalnie cache frontend Brandingu (IndexedDB)
