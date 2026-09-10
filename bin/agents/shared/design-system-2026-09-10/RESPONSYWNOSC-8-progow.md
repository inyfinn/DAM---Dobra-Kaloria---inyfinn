# Audyt responsywności DAM — 8 progów × 8 stron

**Data:** 2026-09-10  
**Metoda:** Playwright Chromium (CDP `Runtime.evaluate`), viewport rzeczywisty Wx900  
**Serwer UI:** `http://127.0.0.1:8765` (HTTP 200)  
**Most:** `http://127.0.0.1:8766/health` (HTTP 200)  
**PID port 8765:** 95240 (1 proces)  
**PID port 8766:** 17808 (1 proces)  
**Wykluczone:** `/dashboard.html` (strefa równoległa)  

---

## 1. Stan wyjściowy

| Strona | HTTP | URL końcowy |
|--------|------|-------------|
| `/signin.html` | 200 | `http://127.0.0.1:8765/signin.html` |
| `/explorer.html` | 200 | `http://127.0.0.1:8765/explorer.html` |
| `/visualizations.html` | 200 | `http://127.0.0.1:8765/visualizations.html` |
| `/costs.html` | 200 | `http://127.0.0.1:8765/costs.html` |
| `/invoices.html` | 200 | `http://127.0.0.1:8765/invoices.html` |
| `/branding.html` | 200 | `http://127.0.0.1:8765/branding.html` |
| `/settings.html` | 200 | `http://127.0.0.1:8765/settings.html` |
| `/tasks.html` | 200 | `http://127.0.0.1:8765/tasks.html` |

**Uwagi:**
- `explorer.html` — pierwszy pass timeout (`networkidle`); uzupełniono z `domcontentloaded` + token demo.
- `visualizations.html` — bez tokenu redirect na `signin.html?reason=no_token`; uzupełniono z `localStorage.dam_token=demo-admin-dev-token`.
- Pozostałe strony shell ładują się bez tokenu (HTTP 200, URL bez redirectu).

## 2. Skala problemu — nadmiar poziomy

- **Pomiary:** 64 / 64 (8 stron × 8 progów)
- **Defekty (overflow > 1 px):** 41 / 64
- **Czyste:** 23 / 64

- **Najgorsza strona:** `costs` — overflow **537 px** @ **480 px**
- **Najgorszy winowajca:** `div.geex-content__header__action__wrap` (szer. 473 px, right 1017 px)

### 2.1 Tabela defektów (tylko wiersze z overflow > 1 px)

| Strona | Prog (px) | clientWidth | scrollWidth | nadmiar | Winowajca (selektor) | szer. (px) | overflow el. (px) |
|--------|-----------|-------------|-------------|---------|----------------------|------------|---------------------|
| branding | 480 | 480 | 1017 | **537** | `div.geex-content__header__action__wrap` | 473 | 537 |
| costs | 480 | 480 | 1017 | **537** | `div.geex-content__header__action__wrap` | 473 | 537 |
| invoices | 480 | 480 | 1017 | **537** | `div.geex-content__header__action__wrap` | 473 | 537 |
| settings | 480 | 480 | 1017 | **537** | `button.dam-settings-jump__clear` | 40 | 688 |
| tasks | 480 | 480 | 1017 | **537** | `div.geex-content__header__action__wrap` | 473 | 537 |
| branding | 576 | 576 | 1064 | **488** | `div.geex-content__header__action__wrap` | 473 | 488 |
| costs | 576 | 576 | 1064 | **488** | `div.geex-content__header__action__wrap` | 473 | 488 |
| invoices | 576 | 576 | 1064 | **488** | `div.geex-content__header__action__wrap` | 473 | 488 |
| settings | 576 | 576 | 1064 | **488** | `button.dam-settings-jump__clear` | 40 | 592 |
| tasks | 576 | 576 | 1064 | **488** | `div.geex-content__header__action__wrap` | 473 | 488 |
| explorer | 480 | 480 | 927 | **447** | `div.geex-content__header__action__wrap` | 473 | 447 |
| visualizations | 480 | 480 | 927 | **447** | `div.geex-content__header__action__wrap` | 473 | 447 |
| explorer | 576 | 576 | 974 | **398** | `div.geex-customizer` | 400 | 400 |
| visualizations | 576 | 576 | 974 | **398** | `div.geex-customizer` | 400 | 400 |
| costs | 1200 | 1200 | 1588 | **388** | `div.geex-customizer` | 400 | 400 |
| costs | 992 | 992 | 1353 | **361** | `div.geex-customizer` | 400 | 400 |
| costs | 768 | 768 | 1048 | **280** | `div.geex-customizer` | 400 | 400 |
| invoices | 768 | 768 | 1048 | **280** | `div.geex-customizer` | 400 | 400 |
| settings | 768 | 768 | 1048 | **280** | `div.geex-customizer` | 400 | 400 |
| tasks | 768 | 768 | 1048 | **280** | `div.geex-customizer` | 400 | 400 |
| tasks | 1200 | 1200 | 1441 | **241** | `div.geex-customizer` | 400 | 400 |
| invoices | 1200 | 1200 | 1433 | **233** | `div.geex-customizer` | 400 | 400 |
| costs | 1366 | 1366 | 1588 | **222** | `div.geex-customizer` | 400 | 400 |
| visualizations | 1200 | 1200 | 1416 | **216** | `div.geex-customizer` | 400 | 400 |
| tasks | 992 | 992 | 1206 | **214** | `div.geex-customizer` | 400 | 400 |
| invoices | 992 | 992 | 1198 | **206** | `div.geex-customizer` | 400 | 400 |
| branding | 768 | 768 | 958 | **190** | `div.geex-customizer` | 400 | 400 |
| explorer | 768 | 768 | 958 | **190** | `div.geex-customizer` | 400 | 400 |
| visualizations | 768 | 768 | 958 | **190** | `div.geex-customizer` | 400 | 400 |
| settings | 1200 | 1200 | 1389 | **189** | `div.geex-customizer` | 400 | 400 |
| visualizations | 992 | 992 | 1181 | **189** | `div.geex-customizer` | 400 | 400 |
| explorer | 1200 | 1200 | 1373 | **173** | `div.geex-customizer` | 400 | 400 |
| branding | 1200 | 1200 | 1367 | **167** | `div.geex-customizer` | 400 | 400 |
| settings | 992 | 992 | 1154 | **162** | `div.geex-customizer` | 400 | 400 |
| explorer | 992 | 992 | 1138 | **146** | `div.geex-customizer` | 400 | 400 |
| branding | 992 | 992 | 1132 | **140** | `div.geex-customizer` | 400 | 400 |
| invoices | 1366 | 1366 | 1433 | **67** | `div.geex-customizer` | 400 | 400 |
| visualizations | 1366 | 1366 | 1416 | **50** | `div.geex-customizer` | 400 | 400 |
| costs | 1600 | 1600 | 1629 | **29** | `div.geex-customizer` | 400 | 400 |
| settings | 1366 | 1366 | 1389 | **23** | `div.geex-customizer` | 400 | 400 |
| explorer | 1366 | 1366 | 1373 | **7** | `div.geex-customizer` | 400 | 400 |

### 2.2 Wiersze czyste (nadmiar ≤ 1 px)

- **branding:** 1366, 1600, 1920 px — OK
- **costs:** 1920 px — OK
- **explorer:** 1600, 1920 px — OK
- **invoices:** 1600, 1920 px — OK
- **settings:** 1600, 1920 px — OK
- **signin:** 480, 576, 768, 992, 1200, 1366, 1600, 1920 px — OK
- **tasks:** 1366, 1600, 1920 px — OK
- **visualizations:** 1600, 1920 px — OK

## 3. Cele dotyku i czytelność (480 px i 576 px)

### 3.1 Prog 480 px

#### `signin`
- **Cele dotyku < 44×44 px (5):**
  - `label` — 418×24 px — „Email''
  - `label` — 38×24 px — „Hasło''
  - `#togglePassword.uil-eye.toggle-password-type` — 20×30 px — „''
  - `label.geex-content__authentication__checkbox-label` — 418×21 px — „Zapamiętaj to urządzenie''
  - `#switchToRegister` — 129.5×20 px — „Utwórz konto admina''

#### `explorer`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootRefreshBtn.dam-root-status__refresh` — 30×30 px — „''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `button.dam-search-scope__btn.is-on` — 80.7×36 px — „Wszystko''
  - `button.dam-search-scope__btn` — 78.2×36 px — „Produkty''
  - `button.dam-search-scope__btn` — 77.9×36 px — „Warianty''
  - `button.dam-tag-pill` — 90.3×26.4 px — „Nerkowcowy''
  - `button.dam-tag-pill` — 66.4×26.4 px — „Proteina''
  - `button.dam-tag-pill` — 62×26.4 px — „Orzech''
  - `button.dam-tag-pill` — 58.2×26.4 px — „Lemon''
  - `button.dam-tag-pill` — 77.8×26.4 px — „Czekolada''
  - `button.dam-tag-pill` — 60.1×26.4 px — „Karmel''
  - `button.dam-tag-pill` — 54.7×26.4 px — „Kokos''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `#damMsgBadge.geex-content__header__badge.dam-badge--msg` — 11 px — „21''
  - `#damNotifBadge.geex-content__header__badge.dam-badge--notif` — 11 px — „4''
  - `span.dam-switch__label` — 11 px — „Admin''
  - `div.dam-tag-group-row.dam-tag-group--smak` — 11 px — „Smak:NerkowcowyProteinaOrzechLemonCzekol''
  - `span.dam-tag-group-label` — 11 px — „Smak:''
  - `span.dam-tag-group-pills` — 11 px — „NerkowcowyProteinaOrzechLemonCzekoladaKa''
  - `button.dam-tag-pill` — 11.5 px — „Nerkowcowy''
  - `button.dam-tag-pill` — 11.5 px — „Proteina''
  - `button.dam-tag-pill` — 11.5 px — „Orzech''
  - `button.dam-tag-pill` — 11.5 px — „Lemon''

#### `visualizations`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootRefreshBtn.dam-root-status__refresh` — 30×30 px — „''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `button.dam-search-scope__btn.is-on` — 354×36 px — „Wszystko''
  - `button.dam-search-scope__btn.is-disabled` — 354×36 px — „Produkty''
  - `button.dam-search-scope__btn.is-disabled` — 354×36 px — „Warianty''
  - `button.dam-tag-pill` — 90.3×26.4 px — „Nerkowcowy''
  - `button.dam-tag-pill` — 66.4×26.4 px — „Proteina''
  - `button.dam-tag-pill` — 62×26.4 px — „Orzech''
  - `button.dam-tag-pill` — 58.2×26.4 px — „Lemon''
  - `button.dam-tag-pill` — 77.8×26.4 px — „Czekolada''
  - `button.dam-tag-pill` — 60.1×26.4 px — „Karmel''
  - `button.dam-tag-pill` — 54.7×26.4 px — „Kokos''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `#damMsgBadge.geex-content__header__badge.dam-badge--msg` — 11 px — „21''
  - `#damNotifBadge.geex-content__header__badge.dam-badge--notif` — 11 px — „4''
  - `span.dam-switch__label` — 11 px — „Admin''
  - `div.dam-tag-group-row.dam-tag-group--smak` — 11 px — „Smak:NerkowcowyProteinaOrzechLemonCzekol''
  - `span.dam-tag-group-label` — 11 px — „Smak:''
  - `span.dam-tag-group-pills` — 11 px — „NerkowcowyProteinaOrzechLemonCzekoladaKa''
  - `button.dam-tag-pill` — 11.5 px — „Nerkowcowy''
  - `button.dam-tag-pill` — 11.5 px — „Proteina''
  - `button.dam-tag-pill` — 11.5 px — „Orzech''
  - `button.dam-tag-pill` — 11.5 px — „Lemon''

#### `costs`
- **Cele dotyku < 44×44 px (8):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootResetBtn.dam-root-status__btn` — 114.3×36 px — „Wskaż folder''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `button.dam-cost-bucket.is-active` — 374×40 px — „Produkty opakowań''
  - `button.dam-cost-bucket` — 374×40 px — „Marketing / e-commerce''
  - `button.dam-cost-bucket` — 374×40 px — „Wszystkie''
- **Tekst < 12 px (11):**
  - `#damMsgBadge.geex-content__header__badge.dam-badge--msg` — 11 px — „21''
  - `#damNotifBadge.geex-content__header__badge.dam-badge--notif` — 11 px — „4''
  - `span.dam-switch__label` — 11 px — „Admin''
  - `div.dam-cost-picker__selected-kicker` — 11 px — „Wybrany projekt''
  - `p.dam-cost-card__note` — 11 px — „Stawki godzinowe z konfiguracji firmy. G''
  - `div.dam-cost-row-meta` — 11 px — „Grafik · 90 h × 53,57 PLN/h''
  - `div.dam-cost-row-meta` — 11 px — „Koordynacja / PM · 12 h × 58,33 PLN/h''
  - `div.dam-cost-row-meta` — 11 px — „Nieprzypisane · 8 h × 45,83 PLN/h''
  - `div.dam-cost-row-meta` — 11 px — „Projekt graficzny · paid''
  - `p.dam-cost-card__note` — 11 px — „Faktury sa informacyjnie - nie wchodza d''

#### `invoices`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootResetBtn.dam-root-status__btn` — 114.3×36 px — „Wskaż folder''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `button.dam-int-filter.inv-filter-btn` — 83.9×36 px — „Wszystkie''
  - `button.dam-int-filter.inv-filter-btn` — 81.3×36 px — „Opłacone''
  - `button.dam-int-filter.inv-filter-btn` — 91.4×36 px — „Oczekujące''
  - `button.dam-int-filter.inv-filter-btn` — 90.1×36 px — „Po terminie''
  - `label.dam-inv-cb` — 28×21 px — „''
  - `input.dam-asana-task-cb.dam-inv-cb__input` — 20×20 px — „''
  - `label.dam-inv-cb` — 28×21 px — „''
  - `input.dam-asana-task-cb.dam-inv-cb__input` — 20×20 px — „''
  - `label.dam-inv-cb` — 28×21 px — „''
  - `input.dam-asana-task-cb.dam-inv-cb__input` — 20×20 px — „''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `span.dam-int-chip.dam-int-st` — 10 px — „Oczekuje''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Oczekuje''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Po terminie''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''

#### `branding`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootRefreshBtn.dam-root-status__refresh` — 30×30 px — „''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `button.dam-branding-tab.dam-branding-tab--all` — 115.5×34 px — „Pokaż wszystko''
  - `#damBrandingIncludeArchive.dam-switch__input` — 1×1 px — „''
  - `button.dam-branding-tab` — 181×34 px — „Kampanie''
  - `button.dam-branding-tab` — 181×34 px — „Social & wideo''
  - `button.dam-branding-tab` — 181×34 px — „Strony WWW''
  - `button.dam-branding-tab` — 181×34 px — „Brandbook''
  - `label.dam-branding-sort` — 217.1×34 px — „Sortuj
                  
              ''
  - `#damBrandingSort` — 180×34 px — „Priorytet użycia
                    Wpr''
  - `label.dam-switch.dam-switch--compact` — 158.6×34 px — „Liczby przy tagach''
  - `#damBrandingTagCounts.dam-switch__input` — 1×1 px — „''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `span` — 10 px — „Wektor''
  - `#damMsgBadge.geex-content__header__badge.dam-badge--msg` — 11 px — „21''
  - `#damNotifBadge.geex-content__header__badge.dam-badge--notif` — 11 px — „4''
  - `span.dam-switch__label` — 11 px — „Admin''
  - `#damBrandingPageSizeOk.dam-int-cta.dam-branding-page-size__ok` — 11 px — „OK''
  - `div.dam-tag-group-row.dam-branding-tag-group--marka` — 11 px — „Marka:DKGC''
  - `span.dam-tag-group-label` — 11 px — „Marka:''
  - `div.dam-tag-group-row.dam-branding-tag-group--autor` — 11 px — „Autor:KrzysztofSylwiaSzymonHighlite''
  - `span.dam-tag-group-label` — 11 px — „Autor:''
  - `div.dam-tag-group-row.dam-branding-tag-group--skojarzenia` — 11 px — „Skojarzenia:SliderBanerBurgerGrillProtei''

#### `settings`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootRefreshBtn.dam-root-status__refresh` — 30×30 px — „''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `label.visually-hidden` — 1×1 px — „Szukaj w ustawieniach i skrótach panelu''
  - `button.dam-settings-jump__chip.is-active` — 80.7×40 px — „Wszystko''
  - `button.dam-settings-jump__chip` — 78.6×40 px — „Profil''
  - `button.dam-settings-jump__chip` — 92.1×40 px — „Wygląd''
  - `button.dam-settings-jump__chip` — 76.4×40 px — „Dysk''
  - `button.dam-settings-jump__chip` — 112.3×40 px — „Preferencje''
  - `button.dam-settings-jump__chip` — 104.3×40 px — „Integracje''
  - `button.dam-settings-jump__chip` — 131.9×40 px — „Powiadomienia''
  - `button.dam-settings-jump__chip` — 121.8×40 px — „Nazewnictwo''
  - `button.dam-settings-jump__chip` — 105.8×40 px — „Konwersja''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `code` — 8.8 px — „preview.cache.offline_browse''
  - `code` — 8.8 px — „lifecycle.requires_db''
  - `code` — 8.8 px — „ui.no_fake_controls''
  - `code` — 8.8 px — „branding.grid_no_wizki_visuals_packshot''
  - `code` — 8.8 px — „index.continuous_auto_indexing''
  - `code` — 8.8 px — „index.supervisor_singleton_bridge_owned''
  - `code` — 8.8 px — „assoc.sqlite_sot_unified_write''
  - `code` — 8.8 px — „assoc.seed_dry_run_gate''
  - `code` — 8.8 px — „branding.quiz_viz_handoff_20260806''
  - `code` — 8.8 px — „workspace.layout_bin''

#### `tasks`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootRefreshBtn.dam-root-status__refresh` — 30×30 px — „''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `select.dam-tasks-select` — 110×40 px — „Mój tydzieńTen miesiąc''
  - `button.dam-tasks-btn` — 97.8×40 px — „Dostosuj''
  - `button.dam-tasks-ai__tab.is-active` — 63.4×32 px — „Zapytaj''
  - `button.dam-tasks-ai__tab` — 67.5×32 px — „Ostatnie''
  - `button.dam-tasks-ai__chip` — 226.5×36 px — „Podsumuj moje nadchodzące priorytety''
  - `button.dam-tasks-ai__chip` — 207.2×36 px — „Podsumuj moje ostatnie osiągnięcia''
  - `button.dam-tasks-ai__chip` — 190.2×36 px — „Znajdź, co wymaga mojej uwagi''
  - `button.dam-tasks-btn.dam-tasks-btn--primary` — 71.1×40 px — „Zapytaj''
  - `button.dam-tasks-tab.is-active` — 120.4×34 px — „Nadchodzące (38)''
  - `button.dam-tasks-tab` — 82.5×34 px — „Zaległe (71)''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `span.dam-tasks-badge` — 10 px — „Nowe''
  - `span.dam-tasks-badge` — 10 px — „Nowe''
  - `#damMsgBadge.geex-content__header__badge.dam-badge--msg` — 11 px — „21''
  - `#damNotifBadge.geex-content__header__badge.dam-badge--notif` — 11 px — „4''
  - `span.dam-switch__label` — 11 px — „Admin''
  - `p.dam-tasks-ai__hint` — 11 px — „Asystent DAM to stub UI (bez Asana AI). ''
  - `span.dam-tasks-pill` — 11 px — „ZMIANY BIEŻĄCYCH OPAKOWAŃ''
  - `span.dam-tasks-source` — 11 px — „1 sub''
  - `span.dam-tasks-pill` — 11 px — „ZMIANY BIEŻĄCYCH OPAKOWAŃ''
  - `span.dam-tasks-source` — 11 px — „2 sub''

### 3.2 Prog 576 px

#### `signin`
- **Cele dotyku < 44×44 px (5):**
  - `label` — 460×24 px — „Email''
  - `label` — 38×24 px — „Hasło''
  - `#togglePassword.uil-eye.toggle-password-type` — 20×30 px — „''
  - `label.geex-content__authentication__checkbox-label` — 460×21 px — „Zapamiętaj to urządzenie''
  - `#switchToRegister` — 129.5×20 px — „Utwórz konto admina''

#### `explorer`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootRefreshBtn.dam-root-status__refresh` — 30×30 px — „''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `button.dam-search-scope__btn.is-on` — 80.7×36 px — „Wszystko''
  - `button.dam-search-scope__btn` — 78.2×36 px — „Produkty''
  - `button.dam-search-scope__btn` — 77.9×36 px — „Warianty''
  - `button.dam-tag-pill` — 90.3×26.4 px — „Nerkowcowy''
  - `button.dam-tag-pill` — 66.4×26.4 px — „Proteina''
  - `button.dam-tag-pill` — 62×26.4 px — „Orzech''
  - `button.dam-tag-pill` — 58.2×26.4 px — „Lemon''
  - `button.dam-tag-pill` — 77.8×26.4 px — „Czekolada''
  - `button.dam-tag-pill` — 60.1×26.4 px — „Karmel''
  - `button.dam-tag-pill` — 54.7×26.4 px — „Kokos''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `#damMsgBadge.geex-content__header__badge.dam-badge--msg` — 11 px — „21''
  - `#damNotifBadge.geex-content__header__badge.dam-badge--notif` — 11 px — „4''
  - `span.dam-switch__label` — 11 px — „Admin''
  - `div.dam-tag-group-row.dam-tag-group--smak` — 11 px — „Smak:NerkowcowyProteinaOrzechLemonCzekol''
  - `span.dam-tag-group-label` — 11 px — „Smak:''
  - `span.dam-tag-group-pills` — 11 px — „NerkowcowyProteinaOrzechLemonCzekoladaKa''
  - `button.dam-tag-pill` — 11.5 px — „Nerkowcowy''
  - `button.dam-tag-pill` — 11.5 px — „Proteina''
  - `button.dam-tag-pill` — 11.5 px — „Orzech''
  - `button.dam-tag-pill` — 11.5 px — „Lemon''

#### `visualizations`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootRefreshBtn.dam-root-status__refresh` — 30×30 px — „''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `button.dam-search-scope__btn.is-on` — 450×36 px — „Wszystko''
  - `button.dam-search-scope__btn.is-disabled` — 450×36 px — „Produkty''
  - `button.dam-search-scope__btn.is-disabled` — 450×36 px — „Warianty''
  - `button.dam-tag-pill` — 90.3×26.4 px — „Nerkowcowy''
  - `button.dam-tag-pill` — 66.4×26.4 px — „Proteina''
  - `button.dam-tag-pill` — 62×26.4 px — „Orzech''
  - `button.dam-tag-pill` — 58.2×26.4 px — „Lemon''
  - `button.dam-tag-pill` — 77.8×26.4 px — „Czekolada''
  - `button.dam-tag-pill` — 60.1×26.4 px — „Karmel''
  - `button.dam-tag-pill` — 54.7×26.4 px — „Kokos''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `#damMsgBadge.geex-content__header__badge.dam-badge--msg` — 11 px — „21''
  - `#damNotifBadge.geex-content__header__badge.dam-badge--notif` — 11 px — „4''
  - `span.dam-switch__label` — 11 px — „Admin''
  - `div.dam-tag-group-row.dam-tag-group--smak` — 11 px — „Smak:NerkowcowyProteinaOrzechLemonCzekol''
  - `span.dam-tag-group-label` — 11 px — „Smak:''
  - `span.dam-tag-group-pills` — 11 px — „NerkowcowyProteinaOrzechLemonCzekoladaKa''
  - `button.dam-tag-pill` — 11.5 px — „Nerkowcowy''
  - `button.dam-tag-pill` — 11.5 px — „Proteina''
  - `button.dam-tag-pill` — 11.5 px — „Orzech''
  - `button.dam-tag-pill` — 11.5 px — „Lemon''

#### `costs`
- **Cele dotyku < 44×44 px (8):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootResetBtn.dam-root-status__btn` — 114.3×36 px — „Wskaż folder''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `button.dam-cost-bucket.is-active` — 470×40 px — „Produkty opakowań''
  - `button.dam-cost-bucket` — 470×40 px — „Marketing / e-commerce''
  - `button.dam-cost-bucket` — 470×40 px — „Wszystkie''
- **Tekst < 12 px (11):**
  - `#damMsgBadge.geex-content__header__badge.dam-badge--msg` — 11 px — „21''
  - `#damNotifBadge.geex-content__header__badge.dam-badge--notif` — 11 px — „4''
  - `span.dam-switch__label` — 11 px — „Admin''
  - `div.dam-cost-picker__selected-kicker` — 11 px — „Wybrany projekt''
  - `p.dam-cost-card__note` — 11 px — „Stawki godzinowe z konfiguracji firmy. G''
  - `div.dam-cost-row-meta` — 11 px — „Grafik · 90 h × 53,57 PLN/h''
  - `div.dam-cost-row-meta` — 11 px — „Koordynacja / PM · 12 h × 58,33 PLN/h''
  - `div.dam-cost-row-meta` — 11 px — „Nieprzypisane · 8 h × 45,83 PLN/h''
  - `div.dam-cost-row-meta` — 11 px — „Projekt graficzny · paid''
  - `p.dam-cost-card__note` — 11 px — „Faktury sa informacyjnie - nie wchodza d''

#### `invoices`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootResetBtn.dam-root-status__btn` — 114.3×36 px — „Wskaż folder''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `button.dam-int-filter.inv-filter-btn` — 83.9×36 px — „Wszystkie''
  - `button.dam-int-filter.inv-filter-btn` — 81.3×36 px — „Opłacone''
  - `button.dam-int-filter.inv-filter-btn` — 91.4×36 px — „Oczekujące''
  - `button.dam-int-filter.inv-filter-btn` — 90.1×36 px — „Po terminie''
  - `label.dam-inv-cb` — 28×21 px — „''
  - `input.dam-asana-task-cb.dam-inv-cb__input` — 20×20 px — „''
  - `label.dam-inv-cb` — 28×21 px — „''
  - `input.dam-asana-task-cb.dam-inv-cb__input` — 20×20 px — „''
  - `label.dam-inv-cb` — 28×21 px — „''
  - `input.dam-asana-task-cb.dam-inv-cb__input` — 20×20 px — „''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `span.dam-int-chip.dam-int-st` — 10 px — „Oczekuje''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Oczekuje''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Po terminie''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''
  - `span.dam-int-chip.dam-int-st` — 10 px — „Opłacona''

#### `branding`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootRefreshBtn.dam-root-status__refresh` — 30×30 px — „''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `button.dam-branding-tab.dam-branding-tab--all` — 115.5×34 px — „Pokaż wszystko''
  - `#damBrandingIncludeArchive.dam-switch__input` — 1×1 px — „''
  - `button.dam-branding-tab` — 229×34 px — „Kampanie''
  - `button.dam-branding-tab` — 229×34 px — „Social & wideo''
  - `button.dam-branding-tab` — 229×34 px — „Strony WWW''
  - `button.dam-branding-tab` — 229×34 px — „Brandbook''
  - `label.dam-branding-sort` — 217.1×34 px — „Sortuj
                  
              ''
  - `#damBrandingSort` — 180×34 px — „Priorytet użycia
                    Wpr''
  - `label.dam-switch.dam-switch--compact` — 158.6×34 px — „Liczby przy tagach''
  - `#damBrandingTagCounts.dam-switch__input` — 1×1 px — „''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `span` — 10 px — „Wektor''
  - `#damMsgBadge.geex-content__header__badge.dam-badge--msg` — 11 px — „21''
  - `#damNotifBadge.geex-content__header__badge.dam-badge--notif` — 11 px — „4''
  - `span.dam-switch__label` — 11 px — „Admin''
  - `#damBrandingPageSizeOk.dam-int-cta.dam-branding-page-size__ok` — 11 px — „OK''
  - `div.dam-tag-group-row.dam-branding-tag-group--marka` — 11 px — „Marka:DKGC''
  - `span.dam-tag-group-label` — 11 px — „Marka:''
  - `div.dam-tag-group-row.dam-branding-tag-group--autor` — 11 px — „Autor:KrzysztofSylwiaSzymonHighlite''
  - `span.dam-tag-group-label` — 11 px — „Autor:''
  - `div.dam-tag-group-row.dam-branding-tag-group--skojarzenia` — 11 px — „Skojarzenia:SliderBanerBurgerGrillProtei''

#### `settings`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootRefreshBtn.dam-root-status__refresh` — 30×30 px — „''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `label.visually-hidden` — 1×1 px — „Szukaj w ustawieniach i skrótach panelu''
  - `button.dam-settings-jump__chip.is-active` — 80.7×40 px — „Wszystko''
  - `button.dam-settings-jump__chip` — 78.6×40 px — „Profil''
  - `button.dam-settings-jump__chip` — 92.1×40 px — „Wygląd''
  - `button.dam-settings-jump__chip` — 76.4×40 px — „Dysk''
  - `button.dam-settings-jump__chip` — 112.3×40 px — „Preferencje''
  - `button.dam-settings-jump__chip` — 104.3×40 px — „Integracje''
  - `button.dam-settings-jump__chip` — 131.9×40 px — „Powiadomienia''
  - `button.dam-settings-jump__chip` — 121.8×40 px — „Nazewnictwo''
  - `button.dam-settings-jump__chip` — 105.8×40 px — „Konwersja''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `code` — 8.8 px — „preview.cache.offline_browse''
  - `code` — 8.8 px — „lifecycle.requires_db''
  - `code` — 8.8 px — „ui.no_fake_controls''
  - `code` — 8.8 px — „branding.grid_no_wizki_visuals_packshot''
  - `code` — 8.8 px — „index.continuous_auto_indexing''
  - `code` — 8.8 px — „index.supervisor_singleton_bridge_owned''
  - `code` — 8.8 px — „assoc.sqlite_sot_unified_write''
  - `code` — 8.8 px — „assoc.seed_dry_run_gate''
  - `code` — 8.8 px — „branding.quiz_viz_handoff_20260806''
  - `code` — 8.8 px — „workspace.layout_bin''

#### `tasks`
- **Cele dotyku < 44×44 px (30):**
  - `a.dam-breadcrumb__link` — 35×26.2 px — „Panel''
  - `#damRootRefreshBtn.dam-root-status__refresh` — 30×30 px — „''
  - `#damDbRefreshBtn.dam-db-status__refresh` — 30×30 px — „''
  - `label.dam-switch.dam-admin-header-switch` — 99.4×36 px — „Admin''
  - `#damAdminModeSwitch.dam-switch__input` — 1×1 px — „''
  - `select.dam-tasks-select` — 110×40 px — „Mój tydzieńTen miesiąc''
  - `button.dam-tasks-btn` — 97.8×40 px — „Dostosuj''
  - `button.dam-tasks-ai__tab.is-active` — 63.4×32 px — „Zapytaj''
  - `button.dam-tasks-ai__tab` — 67.5×32 px — „Ostatnie''
  - `button.dam-tasks-ai__chip` — 226.5×36 px — „Podsumuj moje nadchodzące priorytety''
  - `button.dam-tasks-ai__chip` — 207.2×36 px — „Podsumuj moje ostatnie osiągnięcia''
  - `button.dam-tasks-ai__chip` — 190.2×36 px — „Znajdź, co wymaga mojej uwagi''
  - `button.dam-tasks-btn.dam-tasks-btn--primary` — 71.1×40 px — „Zapytaj''
  - `button.dam-tasks-tab.is-active` — 120.4×34 px — „Nadchodzące (38)''
  - `button.dam-tasks-tab` — 82.5×34 px — „Zaległe (71)''
  - … i 15 więcej
- **Tekst < 12 px (20):**
  - `span.dam-tasks-badge` — 10 px — „Nowe''
  - `span.dam-tasks-badge` — 10 px — „Nowe''
  - `#damMsgBadge.geex-content__header__badge.dam-badge--msg` — 11 px — „21''
  - `#damNotifBadge.geex-content__header__badge.dam-badge--notif` — 11 px — „4''
  - `span.dam-switch__label` — 11 px — „Admin''
  - `p.dam-tasks-ai__hint` — 11 px — „Asystent DAM to stub UI (bez Asana AI). ''
  - `span.dam-tasks-pill` — 11 px — „ZMIANY BIEŻĄCYCH OPAKOWAŃ''
  - `span.dam-tasks-source` — 11 px — „1 sub''
  - `span.dam-tasks-pill` — 11 px — „ZMIANY BIEŻĄCYCH OPAKOWAŃ''
  - `span.dam-tasks-source` — 11 px — „2 sub''

## 4. Nachodzenie nawigacji / nagłówka na treść (480 px)

| Strona | Nachodzi? | nav (px) | firstChild (px) | hOverlap | vOverlap |
|--------|-----------|----------|-----------------|----------|----------|
| signin | — | brak nav/content | — | — | — |
| explorer | **NIE** | 0×0 | 404×201 | 0 | 0 |
| visualizations | **NIE** | 0×0 | 404×201 | 0 | 0 |
| costs | **NIE** | 0×0 | 404×201 | 0 | 0 |
| invoices | **NIE** | 0×0 | 404×201 | 0 | 0 |
| branding | **NIE** | 0×0 | 404×226 | 0 | 0 |
| settings | **NIE** | 0×0 | 404×201 | 0 | 0 |
| tasks | **NIE** | 0×0 | 404×201 | 0 | 0 |

**Interpretacja:** Na 480 px sidebar (`div.geex-sidebar`) ma wymiary 0×0 (ukryty off-canvas); pierwszy blok treści (`.geex-content__header`) startuje od `top≈22 px`. Formalnie brak nachodzenia nav→content. **Wyjątek wizualny:** `tasks` @ 480 px — karty widgetów nachodzą pionowo na siebie (widać na `rwd-tasks-480.png`); to defekt layoutu kart, nie sidebaru.

## 5. Rozjazd progów DAM vs drabina motywu Geex

Drabina motywu (Geex): `479 / 575 / 767 / 991 / 1199 / 1365 / 1439 / 1599 / 1920`  
Progi pomiarowe: `480 / 576 / 768 / 992 / 1200 / 1366 / 1600 / 1920`  

| Plik | Linia | Prog (px) | Kontekst |
|------|-------|-----------|----------|
| `dam-assoc-quiz.css` | 202 | **860** | `@media (max-width: 860px) {` |
| `dam-auth.css` | 19 | **1440** | `@media only screen and (max-width: 1440px) {` |
| `dam-bento.css` | 107 | **1100** | `@media (max-width: 1100px) {` |
| `dam-bento.css` | 299 | **700** | `@media (max-width: 700px) {` |
| `dam-brand.css` | 1315 | **900** | `@media (max-width: 900px) {` |
| `dam-brand.css` | 1355 | **520** | `@media (max-width: 520px) {` |
| `dam-brand.css` | 1617 | **900** | `@media (max-width: 900px) {` |
| `dam-brand.css` | 3892 | **700** | `@media (max-width: 700px) {` |
| `dam-brand.css` | 3941 | **700** | `@media (max-width: 700px) {` |
| `dam-brand.css` | 6715 | **900** | `@media (max-width: 900px) {` |
| `dam-brand.css` | 7679 | **1100** | `@media (max-width: 1100px) {` |
| `dam-brand.css` | 7985 | **720** | `@media (max-width: 720px) {` |
| `dam-brand.css` | 8768 | **640** | `@media (max-width: 640px) {` |
| `dam-brand.css` | 8944 | **640** | `@media (max-width: 640px) {` |
| `dam-brand.css` | 9213 | **640** | `@media (max-width: 640px) {` |
| `dam-brand.css` | 9428 | **900** | `@media (max-width: 900px) {` |
| `dam-brand.css` | 10204 | **560** | `@media (max-width: 560px) {` |
| `dam-brand.css` | 10329 | **560** | `@media (max-width: 560px) {` |
| `dam-branding.css` | 1384 | **900** | `@media (max-width: 900px) {` |
| `dam-branding.css` | 1398 | **640** | `@media (max-width: 640px) {` |
| `dam-branding.css` | 2764 | **640** | `@media (min-width: 640px) {` |
| `dam-branding.css` | 2840 | **639** | `@media (max-width: 639px) {` |
| `dam-branding.css` | 3276 | **900** | `@media (max-width: 900px) {` |
| `dam-dashboard.css` | 339 | **1100** | `@media (max-width: 1100px) {` |
| `dam-dashboard.css` | 859 | **1100** | `@media (max-width: 1100px) {` |
| `dam-dashboard.css` | 1469 | **1100** | `@media (max-width: 1100px) {` |
| `dam-dashboard.css` | 1476 | **720** | `@media (max-width: 720px) {` |
| `dam-dashboard.css` | 1483 | **720** | `@media (max-width: 720px) {` |
| `dam-dashboard.css` | 3199 | **900** | `@media (max-width: 900px) {` |
| `dam-dashboard.css` | 3235 | **1100** | `@media (max-width: 1100px) {` |
| `dam-integrations-settings.css` | 37 | **960** | `@media (max-width: 960px) {` |
| `dam-integrations-settings.css` | 44 | **560** | `@media (max-width: 560px) {` |
| `dam-integrations.css` | 32 | **1100** | `@media (max-width: 1100px) {` |
| `dam-integrations.css` | 38 | **560** | `@media (max-width: 560px) {` |
| `dam-integrations.css` | 82 | **560** | `@media (max-width: 560px) {` |
| `dam-invoices.css` | 296 | **900** | `@media (max-width: 900px) {` |
| `dam-settings.css` | 371 | **1100** | `@media (max-width: 1100px) {` |
| `dam-settings.css` | 513 | **640** | `@media (max-width: 640px) {` |
| `dam-settings.css` | 958 | **640** | `@media (max-width: 640px) {` |
| `dam-settings.css` | 1063 | **640** | `@media (max-width: 640px) {` |
| `dam-tasks.css` | 794 | **1100** | `@media (max-width: 1100px) {` |
| `dam-tasks.css` | 803 | **640** | `@media (max-width: 640px) {` |
| `dam-tutorial.css` | 443 | **640** | `@media (max-width: 640px) {` |
| `dam-viz-modal.css` | 481 | **1100** | `@media (max-width: 1100px) {` |
| `dam-viz-modal.css` | 928 | **1023** | `@media (max-width: 1023px) and (min-width: 768px) {` |
| `dam-viz-modal.css` | 1006 | **374** | `@media (max-width: 374px) {` |
| `dam-viz-modal.css` | 1354 | **900** | `@media (max-width: 900px) {` |
| `dam-viz-modal.css` | 1375 | **520** | `@media (max-width: 520px) {` |
| `dam-viz.css` | 320 | **700** | `@media (max-width: 700px) {` |
| `dam-wykrojnik-queue.css` | 377 | **720** | `@media (max-width: 720px) {` |

## 6. Zrzuty dowodowe (24 × Read)

### `rwd-branding-480.png` — 480x900
- **Opis:** Branding mobile — nagłówek przepełniony, karty materiałów brandowych w kolumnie.

### `rwd-branding-768.png` — 768x900
- **Opis:** Branding tablet — siatka 2-kolumnowa kart brandingowych.

### `rwd-branding-1366.png` — 1366x900
- **Opis:** Branding desktop — pełna siatka kart z podglądem materiałów.

### `rwd-costs-480.png` — 480x900
- **Opis:** Kalkulator kosztów mobile — nagłówek nachodzi poziomo (widoczny poziomy scroll), karta wyboru projektu.

### `rwd-costs-768.png` — 768x900
- **Opis:** Koszty tablet — nagłówek nadal przepełniony, formularz projektu w jednej kolumnie.

### `rwd-costs-1366.png` — 1366x900
- **Opis:** Koszty desktop — pełny layout z tabelą kosztów i panelem projektu obok.

### `rwd-explorer-480.png` — 480x900
- **Opis:** Eksplorator na telefonie — nagłówek z hamburgerem, pasek filtrów Smak/Typ/Opakowanie z chipami, brak widocznego drzewa folderów.

### `rwd-explorer-768.png` — 768x900
- **Opis:** Eksplorator na tablecie — szerszy pasek filtrów, chipy w dwóch kolumnach, nadal brak panelu drzewa po lewej.

### `rwd-explorer-1366.png` — 1366x900
- **Opis:** Eksplorator desktop — pełny layout z drzewem kategorii po lewej i siatką folderów po prawej.

### `rwd-invoices-480.png` — 480x900
- **Opis:** Faktury mobile — nagłówek z akcjami wychodzi poza viewport, lista faktur poniżej.

### `rwd-invoices-768.png` — 768x900
- **Opis:** Faktury tablet — nagłówek częściowo mieści się, tabela zwężona.

### `rwd-invoices-1366.png` — 1366x900
- **Opis:** Faktury desktop — pełna tabela faktur z filtrami.

### `rwd-settings-480.png` — 480x900
- **Opis:** Ustawienia mobile — nagłówek przepełniony, lista sekcji ustawień w jednej kolumnie.

### `rwd-settings-768.png` — 768x900
- **Opis:** Ustawienia tablet — formularze ustawień w układzie jednokolumnowym.

### `rwd-settings-1366.png` — 1366x900
- **Opis:** Ustawienia desktop — panel boczny sekcji + treść ustawień.

### `rwd-signin-480.png` — 480x900
- **Opis:** Formularz logowania DAM wyśrodkowany na jasnoszarym tle — logo Dobra Kaloria, pola email/hasło, fioletowy przycisk Zaloguj.

### `rwd-signin-768.png` — 768x900
- **Opis:** Ten sam ekran logowania przy szerszym viewporcie — karta auth pozostaje wąska i wyśrodkowana.

### `rwd-signin-1366.png` — 1366x900
- **Opis:** Logowanie na desktopie — duża pusta przestrzeń po bokach, karta formularza ~400 px szerokości.

### `rwd-tasks-480.png` — 480x900
- **Opis:** Zadania mobile — nagłówek wychodzi w prawo (scroll ~537 px), karty „Moje zadania” / „Notatnik” nachodzą pionowo na siebie (tekst zlane).

### `rwd-tasks-768.png` — 768x900
- **Opis:** Zadania tablet — szersza lista zadań, filtry u góry.

### `rwd-tasks-1366.png` — 1366x900
- **Opis:** Zadania desktop — pełny widok zadań z kolumnami statusów.

### `rwd-visualizations-480.png` — 480x900
- **Opis:** Wizualizacje mobile — nagłówek, wyszukiwarka, chipy filtrów kategorii, dolny pasek Produkty/Materiały.

### `rwd-visualizations-768.png` — 768x900
- **Opis:** Wizualizacje tablet — szersze chipy filtrów, siatka miniatur zaczyna się poniżej filtra.

### `rwd-visualizations-1366.png` — 1366x900
- **Opis:** Wizualizacje desktop — pełna galeria kart produktów z filtrami u góry.

## 7. Trzy najcięższe defekty

1. **`costs` @ 480 px** — nadmiar **537 px** (`scrollWidth=1017`, `clientWidth=480`)
   - Winowajca: `div.geex-content__header__action__wrap` — szer. 473 px, `right=1017` px
2. **`invoices` @ 480 px** — nadmiar **537 px** (`scrollWidth=1017`, `clientWidth=480`)
   - Winowajca: `div.geex-content__header__action__wrap` — szer. 473 px, `right=1017` px
3. **`branding` @ 480 px** — nadmiar **537 px** (`scrollWidth=1017`, `clientWidth=480`)
   - Winowajca: `div.geex-content__header__action__wrap` — szer. 473 px, `right=1017` px

## 8. Podsumowanie per strona

- **signin:** brak overflow na żadnym progu ✅
- **explorer:** 6/8 progów z overflow; max 447 px @ 480 px
- **visualizations:** 6/8 progów z overflow; max 447 px @ 480 px
- **costs:** 7/8 progów z overflow; max 537 px @ 480 px
- **invoices:** 6/8 progów z overflow; max 537 px @ 480 px
- **branding:** 5/8 progów z overflow; max 537 px @ 480 px
- **settings:** 6/8 progów z overflow; max 537 px @ 480 px
- **tasks:** 5/8 progów z overflow; max 537 px @ 480 px

---
*Audyt TYLKO-DO-CZYTANIA — zero zmian w plikach produktu.*