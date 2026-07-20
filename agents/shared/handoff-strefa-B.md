# HANDOFF - STREFA B (punkty 11-18 briefu usability 2026-07-20)

Data: 2026-07-20 ~17:00. Agent B przerwany decyzja koordynatora (limit API).
Brief zrodlowy: `agents/shared/usability-brief-2026-07-20.md`.
UWAGA: wpis do `process.md` (sekcja "STREFA B usability 2026-07-20") oraz lekcje w
`agents/shared/code-doctrine.md` sekcja 12 zostaly JUZ dopisane przed przerwaniem -
nastepca NIE musi ich duplikowac, tylko uzupelnic o wynik P15.

## (a) ZROBIONE i zweryfikowane (CDP + screenshot + Read)

- **P11 Dashboard 2x2** - DONE. Root cause: w `dam-dashboard.css` ogolna
  `.dam-widget__list` (display:flex, ~linia 404) stala nizej niz
  `.dam-widget__list--media` (grid) o tej samej specyficznosci -> kaskada wygrywala
  flexem i widget renderowal 1 kolumne. Fix: selektor podwojna klasa
  `.dam-widget__list.dam-widget__list--media` (display:grid). Screenshot dashboardu:
  widget "Najnowsze materialy branding" = realne 2 kolumny x 2 rzedy.
- **P12 Chip ID marketingowego** - DONE. `dam-branding.js`: nowa
  `brandingCardIdChipHtml()` renderuje kopiowalny `<button>` przy tytule karty
  (pojedynczej i grupowej), tooltip "Kliknij, aby skopiowac" (`data-dam-tip`),
  klik = clipboard + toast `#damGlobalToast` (mechanizm jak `toastCopied` w
  dam-badges.js). ID USUNIETE z paska badge'ow (`badgesHtml`) - tam bylo uciete.
  CSS `.dam-branding-card__id-chip` w `dam-branding.css` + override
  `.dam-viz-card__title-wrap:has(.dam-branding-card__id-chip){flex-wrap:wrap}`
  (title-wrap w dam-brand.css ma nowrap i ucinal chip - teraz chip lamie sie do
  wlasnej linii). Karty WIZUALIZACJI renderuje `dam-viz.js` = strefa agenta A,
  NIE ruszane (modal viz mial juz chip ID z wczesniejszej sesji).
- **P13 Licznik plikow** - DONE. `.dam-branding-grid-count` w `dam-branding.css`:
  ciemne tlo `rgb(35 32 46 / .92)`, bialy tekst, waga 700, `margin-right: 84px`
  (pas na help fab ~48px + 24px marginesu). Screenshot: pill czytelny, NA LEWO od
  fabu, nic go nie zaslania.
- **P14 Format licznikow** - DONE. `dam-branding.js`: `plWord/fmtElements/fmtFiles`
  (polska odmiana), status (`setStatusEl`) = "115 elementow • 582 pliki",
  licznik siatki (`updateGridCount`) = elementy • pliki (z "X / Y" gdy limit tnie),
  liczniki przy tagach = "(N el. • M pl.)". Elementy per tag liczone w
  `computeFacetCountsPair` przez dedup `folder_group_id || marketingGroupKey(a)`
  (jedna petla, wynik w `facetEls`, cache `facetCountCache` rozszerzony).
- **P16 Tag klik/CTRL** - DONE. Handler `[data-tag-key]` w `renderTagFilters`:
  zwykly klik = ZASTAP caly wybor tym tagiem (drugi klik na jedyny aktywny =
  wyczysc), CTRL/Cmd+klik = toggle multi. Wspolny handler dla wszystkich grup
  facetow. CDP-test: slider -> klik baner = tylko baner; CTRL+slider = baner+slider
  (status "6 elementow • 15 plikow").
- **P17 Tooltips tagow facetow** - DONE. `dam-tooltips.js`: osobna sciezka
  `isFacetTag()` (`.dam-badge-tag[data-tag-key]` wewnatrz
  `.dam-branding-tag-filters`): tooltip po **1.5 s** hoveru, fade-in .25s
  (`#damFacetTip`, CSS wstrzykiwany `<style id=damFacetTipCss>`), tresc = opis
  ("Tag 'X' z grupy 'Y'. Zaweza wyniki...") + sekcja hint "Klik: tylko ten tag.
  CTRL+klik: dodaj do wyboru." + link "Nie przypominaj wiecej"
  (localStorage `damTagCtrlHintDismissed=1`; po dismiss tooltip = tylko opis).
  Tooltip ma pointer-events:auto zeby dalo sie kliknac dismiss (250 ms grace na
  przejscie kursorem). Zwykle tooltipy bez zmian.
- **P18 DamLoader + fazowany render** - DONE (kod + weryfikacja CDP/screenshot).
  Szczegoly w sekcji (f).

## (b) CZESCIOWE

- **P15 Brakujace foldery ARCHIWUM (META / SLIDERY)** - diagnoza zrobiona,
  REBUILD INDEKSU W TOKU przy przerwaniu. Szczegoly w sekcji (e).

## (c) NIETKNIETE

- Brak. Wszystkie punkty 11-18 ruszone; jedynie P15 czeka na koniec rebuildu
  i weryfikacje liczb.

## (d) Zmienione pliki + bumpy ?v=

JS/CSS (moje zmiany, wszystkie przechodza node --check / lints czyste):

| Plik | Wersja ?v= | Gdzie zbumpowane |
|------|-----------|------------------|
| `apps/web/assets/css/dam-dashboard.css` | `usab20260720b` | dashboard.html, settings.html |
| `apps/web/assets/css/dam-branding.css` | `usab20260720d` | branding.html, explorer.html, dashboard.html |
| `apps/web/assets/js/dam-branding.js` | `usab20260720c` | branding.html |
| `apps/web/assets/js/dam-tooltips.js` | `usab20260720b` | branding, explorer, dashboard, integrations, visualizations, settings, profile (.html) |
| `apps/web/assets/js/dam-loader.js` (NOWY) | `?v=1` | 11 HTML: dashboard, explorer, branding, index, inbox, visualizations, settings, integrations, costs, invoices, profile |

Wszystkie bumpy sa JUZ zrobione - nic nie wisi.

## (e) Diagnoza indeksera (P15)

- **Stan przed**: `apps/web/data/branding-index.json` (built_at 2026-07-19 01:36:37,
  7832 assetow) NIE zawiera zadnej sciezki z
  `X:/Marketing/-- ARCHIWUM --/05_Materialy graficzne e-commerce/08 Kampania META`
  ani `.../05 - SLIDERY - sklep` (Grep po "Kampania META" i "SLIDERY - sklep" = 0
  trafien). Foldery ISTNIEJA na dysku X: (sprawdzone Get-ChildItem -LiteralPath).
- **Co wykluczalo**: NIC w aktualnym kodzie. `build-branding-index.py`
  (`scan_marketing_roots`, linie ~272-342) skanuje `-- ARCHIWUM --` jako legacy root
  (rglob calego drzewa, dedup tylko po overlap z POLSKA kluczem `stem+wymiary`).
  Wniosek: stary indeks byl zbudowany skryptem SPRZED wprowadzenia skanu legacy
  (commit "POLSKA-first archive index") albo skan padl cicho - sam rebuild
  powinien zassac brakujace foldery.
- **Rebuild**: ODPALONY `python "apps\web\scripts\build-branding-index.py"`
  (terminal id 942622; powloka PID 48688, wlasciwy python.exe PID **50744**,
  start 14:26 UTC). O ~15:30 dzialal dalej (~65 min) - dysk X: to NFS,
  miniatury/PIL sa wolne. Warningi DecompressionBomb + "More samples per pixel"
  = duze TIFy, niegrozne.
- **UWAGA - Traceback w logu jest NIE-fatalny**: ok. godziny po starcie w logu
  pojawil sie `PIL.Image.DecompressionBombError` (obraz 573 MP) z watku-workera
  `asset_role_utils._probe` (skan przezroczystosci tla). Padl tylko ten jeden
  watek daemon dla jednego pliku; skrypt leci dalej (kolejne warningi po
  tracebacku). Nie restartowac rebuildu z tego powodu. Opcjonalny hardening
  na przyszlosc: w `_probe` zlapac `Image.DecompressionBombError` (albo ustawic
  `Image.MAX_IMAGE_PIXELS`) i zwracac "none".
- **AKTUALIZACJA 17:59**: pierwszy rebuild (PID 50744) ZAKONCZYL SIE bledem
  (exit_code -1 po ~93 min) i NIE zapisal nowego indeksu - `built_at` w
  branding-index.json nadal `2026-07-19T01:36`, "Kampania META" / "SLIDERY - sklep"
  wciaz 0 trafien (plik ma LastWriteTime 17:30 - dotkniety przez inny proces,
  tresc stara). W systemie dziala juz DRUGI rebuild: `python.exe
  apps\web\scripts\build-branding-index.py`, PID **41912** (odpalony przez
  koordynatora/nastepce). Weryfikacja wyniku wg punktow 2-6 ponizej po jego
  zakonczeniu.
- **Jak sprawdzic wynik** (nastepca):
  1. Czy proces zyje: `Get-Process -Id 48688` albo plik terminala
     `C:\Users\xpret\.cursor\projects\...\terminals\942622.txt` (stopka exit_code).
  2. Po zakonczeniu: `rg -c "Kampania META" apps/web/data/branding-index.json`
     oraz `rg -c "SLIDERY - sklep"` - maja byc > 0.
  3. Sprawdz `built_at` w indeksie (ma byc 2026-07-20) i liczby tagow:
     `channel:meta` (bylo 17 plikow) i `facet:slider` - maja WZROSNAC.
  4. Po rebuildzie mozliwe, ze trzeba re-run `enrich-branding-tags.py`
     (tak robiono po poprzednich rebuildach) - sprawdz naglowek skryptu.
  5. UI: branding.html, tag META / Slider - liczniki i karty z ARCHIWUM
     (przelacznik "Pokaz archiwum" moze byc wymagany dla assetow `is_archive`;
     `is_legacy_root_archive` daje tag "Stara struktura" i te NIE sa chowane).
  6. Dopisz wynik (liczby przed/po) do wpisu "STREFA B usability 2026-07-20"
     w process.md.

## (f) Stan DamLoader

- Plik ISTNIEJE: `apps/web/assets/js/dam-loader.js` (nowy, komplet, node --check OK).
- API: `window.DamLoader.start(label)` / `.done()` / `.reset()` / `.isActive()`.
- Zachowanie: bialy pill na srodku (spinner + label + fioletowy pasek indeterminate
  #ab54db), po 1 s GSAP timeline (power2.inOut) zwija tresc i przenosi pill do
  prawego dolnego rogu (right:24 / bottom:92 = NAD help fabem), `done()` = fade-out.
  z-index 13000, pointer-events:none, `prefers-reduced-motion` = od razu maly
  spinner w rogu bez animacji. GSAP ladowany wzorcem z dam-grid-reveal.js
  (wspolny `<script data-dam-gsap="1">`). CSS wstrzykiwany `<style id=damLoaderCss>`.
- Podpiety w HTML: 11 stron (lista w sekcji d), zawsze PRZED dam-grid-reveal.js.
- Podpiety w logice: `dam-branding.js` - klik tagu woła `DamLoader.start("Filtruję…")`
  + `scheduleBrandingRender({tags:true, section:true, loader:true})`. Fazowany
  render (nowy `scheduleBrandingRender`): skeleton w klatce 1 (tylko gdy poprzedni
  render sekcji trwal >150 ms lub pierwszy render przy >800 assetach; rAF +
  setTimeout(0) daje przegladarce klatke na PAINT skeletonow) -> `renderActiveSection`
  w klatce 2 (mierzony `lastSectionRenderMs`) -> `renderTagFilters` w klatce 3 ->
  `finishBrandingLoader()` (done). Flaga `brandingLoaderPending` przezywa
  cancelAnimationFrame przy nadpisaniu harmonogramu - done() nie ginie.
- Root cause 10-sekundowych zamrozen: facet-counts (petla assets x ~100 kluczy
  w `computeFacetCountsPair`) odpalaly sie w tej samej klatce co render siatki;
  teraz siatka pojawia sie PRZED tagami.
- Zweryfikowane CDP: center (cx=814 przy vw=1643, opacity 1, label, pasek) ->
  po ~1.6 s dock w rogu (w=52, right/bottom nad fabem); screenshot: male kolko
  w rogu nad fabem.

## (g) Pulapki dla nastepcy

1. **Samouczek nawiguje karte**: klik "Zakoncz samouczek"/"Dalej" w przegladarce
   agenta przenosi na inna strone (fazy tutoriala). Przed pomiarami CDP ustaw
   dismiss w localStorage i sprawdzaj `location.href` przed kazdym evaluatem.
2. **Stale-frame screenshotow**: wspoldzielona karta IDE potrafi oddac klatke
   z POPRZEDNIEJ strony. Otworz osobna karte (newTab) i/lub wymus scroll/repaint;
   logika = CDP, wyglad = screenshot + Read.
3. **Clipboard w CDP**: `navigator.clipboard.writeText` odrzuca bez user activation
   - "Nie udalo sie skopiowac" przy klikach symulowanych jest OCZEKIWANE; realny
   klik uzytkownika dziala. Testuj mechanizm (handler+toast), nie wynik schowka.
4. **dam-brand.css i dam-viz.js = strefa agenta A** - nie edytowac. Overridy do
   `.dam-viz-card__title-wrap` robione przez `:has()` w dam-branding.css.
5. **Facet counts cache**: `facetCountCache` ma teraz pole `facetEls` - kazda
   zmiana kszaltu wyniku `computeFacetCountsPair` MUSI aktualizowac tez cache-hit
   branch (return z cache) i `computeFacetCounts` (wrapper).
6. **X: (NFS) jest wolny** - rebuild indeksu to dziesiatki minut; nie zabijac
   procesu 48688, nie odpalac drugiego rownolegle (zapis atomowy, ale skan podwojny).
7. **PowerShell**: bez `&&` (uzywac `;`); polskie znaki w sciezkach X: wymagaja
   `[Console]::OutputEncoding=UTF8` + `-LiteralPath`.
8. **dam-loader.js?v=1** - przy kolejnych zmianach loadera bumpowac we WSZYSTKICH
   11 HTML (Grep "dam-loader.js?v=").
