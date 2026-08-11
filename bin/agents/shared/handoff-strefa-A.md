# HANDOFF - STREFA A (usability brief 2026-07-20, pkt 1-10)

Stan na: 2026-07-20 ~17:00. Praca przerwana decyzja koordynatora (limit API).
Zrodlo prawdy rundy: `agents/shared/usability-brief-2026-07-20.md`.
Wszystkie zmienione JS przechodza `node --check`. Serwery: web 8765, most 8766 (oba dzialaly).

## (a) ZROBIONE i zweryfikowane (screenshot / CDP w przegladarce)

- **Pkt 1 - Historia statusow (#damLifecycleHistoryModal)**: przebudowana na timeline.
  Nowy markup: `.dam-life-hist__head` + licznik `#damLifeHistCount`, filtry F/X/D
  (`[data-life-filter]`, klasy `dam-lifecycle-chip--f/x/d`, toggle = klik ponowny),
  os czasu `.dam-life-hist__timeline` > `.dam-life-hist__item` (data+godzina, chip statusu,
  zakres PRODUKT/WARIANT, indeks jako tag, autor skrocony z tooltipem, przyciski kopiuj +
  przejdz do produktu), empty state. Kod: `dam-explorer.js` (`openLifecycleHistoryModal`),
  style na koncu `dam-brand.css`. ZWERYFIKOWANE: screenshot + test filtra (F -> 1 wpis,
  reset -> 2, licznik sie aktualizuje).

- **Pkt 2 - Etykiety studia**: w `dam-media-preview.js` (`renderVizStudioControls`)
  etykiety to teraz "Tło:", "Perspektywa:", "Język:" (CSS uppercase'uje). Chip
  "Z tłem • JPG" w jednej linii (kropka srodkowa `&bull;`). ZWERYFIKOWANE screenshotem.

- **Pkt 3 - Chipy studia = globalne tagi**: chipy maja klase `dam-viz-badge` +
  nadpisania w `dam-brand.css` scope'owane `#damMediaPreviewStudio` (ksztalt/font/padding
  jak badge, aktywny = fioletowy). Bez edycji `dam-branding.css`. ZWERYFIKOWANE screenshotem.

- **Pkt 4 - ID marketingowe wizualizacji**: `dam-marketing-id.js` ma nowe
  `formatVizId(opts)` (index, persp, size, date -> `V-<IDX>-<PERSP>[-<SIZE>]-<MM>-<RR>`;
  segment SIZE pomijany gdy brak) i `parseIndexFromPath(path)` (ostatni 6-7 cyfrowy indeks).
  Eksport: `DamMarketingId.formatViz`, `DamMarketingId.parseIndexFromPath`.
  W `dam-media-preview.js`: `vizDisplayId()` uzywane w `assetIdChipHtml` dla mode
  "viz-studio". ZWERYFIKOWANE: chip pokazuje `V-6300684-ENFACE-L-04-26` (data z mtime pliku).

- **Pkt 5 - Kopiowanie ID**: `dam-badges.js` `resolveCopyText` najpierw bierze
  `data-marketing-id`; w `dam-media-preview.js` `bindIdChipCopy` (klik + prawy klik
  contextmenu + Enter/Spacja) kopiuje `data-marketing-id`; tooltip uproszczony do
  "ID marketingowe: ... (klik = kopiuj)" bez "(wewn.: br-...)". Dodany fallback-toast
  `#damMediaPreviewToast` (explorer.html nie laduje DamToast).
  UWAGA: w tescie CDP clipboard rzucil blad, bo karta automatyzacji nie ma focusu -
  handler odpala sie poprawnie, realny klik uzytkownika zadziala. Sprawdz recznie 1 raz.

- **Pkt 6 - Skojarzenia lustrzane (viz-studio)**: w `dam-media-preview.js` kolumna
  "Skojarzone materiały" (`linkedBrandingColumnHtml`, `renderLinkedBrandingAssets`,
  mount `#damMediaPreviewLinkedAssets`). Matching: `lp.id === productContext.id` (slug)
  LUB fallback indeks bazowy w `lp.thumb_url` (wzorzec `__6300684_`). Sortowanie
  `assocRank`: web_hero_slider/web_bundle_tile = 0, inne = 1, brand_asset = 2,
  packshot = 3; potem najmniej `linked_products`, potem path. Limit 24 kart + toggle
  "Pokaż wszystkie" (toggle ma CSS full-row w dam-brand.css). Klik karty otwiera asset
  w `openAsset`. `openLightbox` w `dam-explorer.js` przekazuje `productContext`
  {id, name, index} + `product_index`/`mtime` w siblings.
  TEST REFERENCYJNY PRZECHODZI: babka-cytrynowa-nerkowcowy pokazuje br-003363
  ("Babka cytrynowa slider yana (1)", M-SLI03363-02-26) i br-003364 na poczatku listy.

- **Pkt 7 - Modal wizualizacji (dam-viz.js, #damVizModal)**: budowa jak branding -
  tagi na gorze (bylo), tytul, NOWY chip ID `#damVizModalAssetId` (format V-..., kopiuje
  klik/prawy klik/klawiatura, aktualizuje sie przy zmianie wariantu w `selectVariant`),
  warianty, NOWA sekcja `#damVizModalAssoc` ("Skojarzone materiały", ladowana przez nowy
  eksport `DamMediaPreview.renderLinkedAssetsInto(mount, labelEl, productContext)`),
  akcje na dole z Demo/Ukryj (zostaly). "Dodaj miniature" renderuje sie TYLKO gdy
  `showAddManual` = `manualPairedN > 0 || lacksViz` (missingLangs > 0 lub wariant bez
  thumb i path). ZWERYFIKOWANE w przegladarce (modal LEMON BUNDT CAKE: chip
  V-6300670-ENFACE-07-26, assoc(2), Demo+Ukryj sa, AddManual ukryty bo komplet wizek).

- **Pkt 8 - #damThumbPicker mini-eksplorator**: `openThumbGridPicker` w `dam-viz.js`
  przebudowany: naglowek, toolbar wstecz/dalej/w gore/odswiez (historia w JS),
  breadcrumb klikalny (`paintCrumbs`), przelacznik widoku thumbs/list/tiles
  (localStorage `dam_thumb_picker_view`), pliki z tagami (indeks `dam-viz-badge--index`,
  rozszerzenie, data gdy mtime dostepny), z-index 12300 (inline + CSS). Style w
  `dam-brand.css` scope'owane `[data-view]`, zeby nie psuc starszych prostych pickerow.
  Debug/API eksport: `window.damVizOpenThumbPicker(dir, onPicked)`.
  ZWERYFIKOWANE: nawigacja folderow, breadcrumb, tagi (6300621 + PNG), przelaczanie
  widokow, wstecz dziala.

- **Pkt 9 - Assoc edit (dam-assoc-edit.js)**: wyniki wyszukiwania produktow maja
  wiersz tagow `optionTagsHtml` (marka, kategoria bez prefiksu "NN - ", podkategoria,
  jezyki z revisions[0].langs, indeks) + miniatura z hover-zoom 400x400
  (`showThumbZoom`/`hideThumbZoom`, element `#damAssocThumbZoom`, z-index 12400,
  pozycjonowanie prawo/lewo od anchora, znika na mouseleave i przy closePicker).
  ZWERYFIKOWANE CDP: 5 badge'ow tagow dla "babka", zoom 400x400 z-index 12400,
  chowa sie po zjechaniu. (Bez osobnego screenshotu popovera - dorob 1 pass wizualny.)

- **Pkt 10 - #damVariantInfoPopover**: w `dam-viz.js` dodane
  `scheduleVariantInfoHide` (1200 ms) + `cancelVariantInfoHide`; mouseleave triggera
  i popovera startuje timer, mouseenter (oba) anuluje, klik poza = natychmiast (bylo).
  ZWERYFIKOWANE CDP: otwarty -> leave -> widoczny po 600 ms -> zniknal po 1500 ms.

## (b) CZESCIOWE / do dokonczenia

- **Pkt 5**: kopiowanie potwierdzone tylko na poziomie handlera (clipboard wymaga
  focusu okna). Zrob 1 reczny test klik + prawy klik na chip ID w explorerze i brandingu.
- **Pkt 7**: pozytywny przypadek "Dodaj miniature" (produkt z brakujaca wizka) nie
  zostal znaleziony wsrod pierwszych 60 kart - nie zweryfikowano wizualnie, ze przycisk
  SIE POKAZUJE gdy lacksViz. Logika jest w `openProductModal` (zmienna `showAddManual`).
- **Pkt 9**: brak przelotu screenshot+Read samego popovera (tylko dowod CDP).
- **Petla weryfikacji**: pkt 1-8 mialy screenshot pass; pelne "min. 3 przeloty" na
  kazdy punkt nie zostaly domkniete przez przerwanie.

## (c) NIETKNIETE (obowiazki koncowe rundy)

- Wpis do `process.md` (sekcja "STREFA A usability 2026-07-20") - NIE zrobiony (decyzja koordynatora).
- Lekcje do `agents/shared/code-doctrine.md` sekcja 12 - NIE zrobione.
- Finalny raport zbiorczy dla usera.

## (d) Zmienione pliki + aktualne ?v= (spojne we wszystkich HTML)

| Plik | ?v= |
|---|---|
| apps/web/assets/css/dam-brand.css | usab20260720d |
| apps/web/assets/js/dam-explorer.js | usab20260720c |
| apps/web/assets/js/dam-media-preview.js | usab20260720g |
| apps/web/assets/js/dam-marketing-id.js | usab20260720c |
| apps/web/assets/js/dam-badges.js | usab20260720c |
| apps/web/assets/js/dam-viz.js | usab20260720g (laduje TYLKO visualizations.html) |
| apps/web/assets/js/dam-assoc-edit.js | usab20260720c |

Zmiany w HTML (poza bumpami):
- `explorer.html`, `dashboard.html`: dodany `<script dam-marketing-id.js?v=usab20260720c>` przed dam-media-preview.js.
- `visualizations.html`: dodane `<link dam-branding.css?v=usab20260720b>` (po dam-brand.css)
  oraz `<script dam-marketing-id.js>` i `<script dam-media-preview.js>` przed dam-viz.js
  (potrzebne dla sekcji skojarzen i formatu V-ID w modalu viz).

## (e) Wazne ustalenia / diagnozy

- **linked_products dla 6300684 (babka-cytrynowa-nerkowcowy)**: 1802 assety brandingowe
  maja ten produkt w linked_products (masowe podpiecia brand_asset). Rozklad rol:
  brand_asset 1534, packshot 200, bez roli 45, pos_material 19, web_hero_slider 2,
  web_bundle_tile 2. Slidery "Postanowienia Noworoczne" (br-003409/003410) i DPD maja
  linked_products = TYLKO `mix-6x-mini-batoniki-mixy` - NIE zawieraja babki, wiec sie
  nie pokazuja (brak danych, strefa indeksera - NIE naprawiac tutaj).
- **pos_material w danych to czesto smieci** (warstwy PSD: "Layer 118", "LISC4",
  "flor2") - dlatego assocRank daje im 1, nie 0.
- **linked_products entry** = {id: slug produktu, display_name, thumb_url}; indeks
  bazowy siedzi w thumb_url jako `__<indeks>_<lang>.jpg` (stad fallback matching).
- **file-index produkt**: id = slug (np. babka-cytrynowa-nerkowcowy), pola category
  ("01 - BATONY"), subcategory_label, brand, revisions[0].langs.
- Nowe eksporty publiczne: `DamMarketingId.formatViz`, `DamMarketingId.parseIndexFromPath`,
  `DamMediaPreview.renderLinkedAssetsInto(mount, labelEl, productContext)`,
  `window.damVizOpenThumbPicker(dir, cb)`.
- `openFolderPicker` (dam-viz.js) -> pywebview pick_thumb jesli jest, inaczej
  `openThumbGridPicker` (nowy mini-eksplorator).

## (f) Pulapki dla nastepcy

1. **PowerShell inline z $zmiennymi przez narzedzie Shell psuje sie** (interpolacja
   zjada `$t` itd.). Do masowych bumpow ?v= pisz tymczasowy skrypt .ps1 i odpalaj
   `powershell -File`, potem skasuj (tak robilem: wzorzec `[regex]::Replace` po
   `apps/web/*.html`).
2. **Samouczek (Bobek / "Zakończ samouczek")** wyskakuje na swiezych stronach
   i przechwytuje kliki - najpierw kliknij "Zakończ samouczek".
3. W explorerze klik w tekst "KARTON 6x MINI" moze trafic w TAG FILTRA opakowania
   (ustawia szukajke), nie w wiersz wariantu. Wiersz wariantu = `.dam-carrier-toggle-row`.
   Produkt otwieraj przez `window.DamExplorer.openProduct('<slug>')`.
4. **Clipboard w karcie automatyzacji nie dziala** (brak focusu) - nie traktuj
   "Nie udalo sie skopiowac" jako regresji; sprawdzaj, czy handler odpalil.
5. `dam-branding.css` jest ZAKAZANY do edycji, ale visualizations.html teraz go
   laduje - przy bumpach dam-branding.css przez innego agenta trzymaj te sama wersje
   w branding/explorer/dashboard/visualizations (dzis: usab20260720b).
6. Style nowego pickera sa scope'owane `.dam-thumb-picker__grid[data-view]` -
   stare, prostsze pickery (m.in. w dam-assoc-edit.js `openFolderGrid`) uzywaja tych
   samych klas bazowych bez data-view i maja zostac nietkniete.
7. Testy zostawily w localStorage przegladarki `dam_thumb_picker_view=tiles` -
   kosmetyka, ale moze zaskoczyc przy weryfikacji domyslnego widoku.
8. `/folder-images` z mostu nie zwraca mtime plikow - tag daty w pickerze pojawia sie
   tylko gdy pole `mtime`/`modified`/`date` istnieje (dzis zwykle brak).
