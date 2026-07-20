# WYKLADNIA KODU DAM (Code Doctrine) - czytaj ZAWSZE przed zmiana kodu

> Status: OBOWIAZKOWA wykladnia i instrukcja. Dokument nadrzedny nad "przeczuciem".
> Kolejnosc zrodel prawdy: `program-instructions.json` > ten dokument > `memory.md` > kod.
> Ten plik uczy CZYTAC kod DAM, rozumiec DLACZEGO cos dziala (a cos innego nie),
> i podejmowac trafne decyzje szybciej. Nie zgaduj - tu masz mape.

Autor pierwszej wersji: agent, ktory naprawil silnik animacji `reveal` i edytor
skojarzen (2026-07-20). Kazdy kolejny agent DOPISUJE lekcje (patrz sekcja 12).

---

## 0. Jak uzywac tego dokumentu

> **SKILL projektu:** `dam-dobrakaloria` (Cursor Agent Skill, `~/.cursor/skills/dam-dobrakaloria/`).
> Zawiera skrot tej doktryny + obowiazkowa petle weryfikacji:
> **kod -> test (node --check / CDP) -> screenshot+Read -> poprawka = 1 PRZELOT**
> (synonimy usera: tura / pass / podejscie). Minimum 3 przeloty na zadanie wizualne.
> **RUNDA** = seria przelotow na JEDNYM elemencie az do czystego wyniku
> ("10 rund" = 10 elementow, nie 10 screenshotow calosci). Jesli skill jest
> dostepny w srodowisku - uzywaj go przy kazdym zadaniu w tym repo.

- Przed KAZDA zmiana w `apps/web/**` przeczytaj sekcje 1-6 (fundamenty) i te
  studium przypadku (7-8), ktore dotyka Twojego obszaru.
- Gdy cos "nie dziala u usera, a u mnie tak" - sekcja 3 (cache) i sekcja 5 (weryfikacja).
- Gdy edytujesz plik, ktory moze edytowac inny agent - sekcja 4 (wspolbieznosc).
- Gdy dodajesz animacje / overlay / modal - sekcje 7 (reveal) i 8 (z-index warstw).
- Po rozwiazaniu nowego, nieoczywistego problemu - DOPISZ lekcje w sekcji 12.

---

## 1. Mapa systemu (architektura runtime)

DAM to panel bez build-stepu dla warstwy web. To znaczy: **piszesz zwykly ES5-ish
JS/CSS/HTML, ktory przegladarka laduje wprost**. Nie ma bundlera, nie ma transpilacji.
Dlatego:

- Zmiana w pliku `.js`/`.css` dziala dopiero gdy przegladarka pobierze nowa wersje
  (patrz sekcja 3 - cache-busting).
- Skladnia musi byc zgodna z przegladarka (unikaj rzeczy wymagajacych transpilacji,
  trzymaj sie wzorca z sasiednich plikow).

Dwa procesy w tle (uruchamia je user / desktop shell, NIE restartuj bez potrzeby):

| Co | URL | Rola |
|----|-----|------|
| Serwer web (python http.server) | `http://127.0.0.1:8765` | serwuje `apps/web/**` (HTML/JS/CSS/JSON) |
| Most lokalny (`apps/desktop/local_bridge.py`) | `http://127.0.0.1:8766` | dostep do dysku `X:`, podglady, zapis skojarzen, OAuth, finanse |

Dane to statyczne pliki JSON w `apps/web/data/` (nie baza w runtime web):

- `file-index.json` - produkty/warianty (patrz sekcja 6).
- `branding-index.json` - assety brandingowe (linked_products, folder_editable_files, background...).
- `branding-search-index.json`, `program-instructions.json`, override'y.

Most 8766 jest jedynym mostem do `X:` (NFS/Synology). Operacje na dysku sa WOLNE
i moga sie zawiesic (sekcja 9). Web bez mostu nadal renderuje UI z JSON-ow.

---

## 2. Wzorzec modulu i jak znalezc "wlasciciela" funkcji

Kazdy plik JS to IIFE eksportujaca jeden globalny obiekt `DamXxx`:

```js
(function (global) {
  "use strict";
  // ... funkcje wewnetrzne (closure, NIE widoczne z konsoli) ...
  global.DamFoo = { publicMethod: ..., ... };
})(window);
```

Konsekwencje praktyczne:

- Funkcje NIE wymienione w `global.DamFoo = {...}` sa prywatne - nie wywolasz ich
  z konsoli/CDP. Zeby przetestowac prywatna sciezke, wywolaj ja przez UI
  (klik, event) albo przez publiczne API modulu.
- "Kto to renderuje?" -> szukaj po nazwie klasy CSS / id elementu (Grep), potem po
  `global.Dam...`. Mapa modulow: sekcja 11.
- Moduly gadaja przez `window.DamX` (np. `DamPaths`, `DamMediaPreview`, `DamBadges`,
  `DamGridReveal`, `DamAssocEdit`). Zawsze sprawdzaj `typeof` przed uzyciem
  (moga sie ladowac w roznej kolejnosci).

---

## 3. Cache-busting - #1 powod "zmienilem, a nie dziala"

HTML laduje skrypty z wersja: `dam-foo.js?v=jakas-wersja`. Przegladarka cache'uje
po pelnym URL (razem z `?v=`). **Jesli nie zmienisz `?v=`, user dostanie STARY plik**
mimo Twojej edycji.

Zasada:
1. Zmieniasz `apps/web/assets/js/foo.js` lub `.css`? -> zbumpuj `?v=` w KAZDYM HTML,
   ktory go laduje (Grep `foo.js?v=`).
2. Dodanie `?v=` do adresu STRONY (np. `index.html?v=x`) NIE odswieza skryptu -
   skrypt ma wlasny `?v=` w tagu i to on decyduje.
3. Do QA w przegladarce mozesz wymusic swiezosc przez inny `?v=` w tagu skryptu albo
   CDP `Network.setCacheDisabled`. Ale user zobaczy fix dopiero po bumpie w HTML.

Pulapka wspolbieznosci: jesli inny agent wlasnie edytuje ten sam HTML (tagi skryptow),
patrz sekcja 4 zanim zbumpujesz.

---

## 4. Wspolbiezni agenci - wlasnosc plikow (HARD)

W tym repo czesto pracuje kilku agentow naraz (patrz `AGENTS.md`). Edycja tego samego
pliku = nadpisanie cudzej pracy.

Zasady:

1. **Nie edytuj pliku, ktory nalezy do innego, aktywnego agenta.** Jesli zadanie tego
   wymaga - odloz te czesc i zanotuj, albo poczekaj az skonczy.
2. Jak sprawdzic czy agent skonczyl: w transkrypcie subagenta ostatnia linia
   `{"type":"turn_ended","status":"success"}`. Dopiero wtedy jego pliki sa "wolne".
3. **Potrzebujesz stylu, a CSS nalezy do innego agenta? Wstrzyknij CSS z JS.**
   Wzorzec (uzyty w `dam-assoc-edit.js`): jednorazowy `<style id="...">` dodany do
   `document.head`. Zero konfliktu z plikami `.css` agentow.
   ```js
   function ensureInjectedCss() {
     if (document.getElementById("mojeCss")) return;
     var s = document.createElement("style");
     s.id = "mojeCss";
     s.textContent = "...reguly...";
     document.head.appendChild(s);
   }
   ```
4. Z-index / warstwy overlayow potrafi kolidowac miedzy modulami roznych agentow -
   ustawiaj je swiadomie i lokalnie (sekcja 8).

---

## 5. Weryfikacja: DOM/CDP vs screenshot

Regula repo (`verify-ui-after-changes.mdc`) to HARD GATE: po zmianie wizualnej
robisz screenshot i CZYTASZ go narzedziem Read (vision). To zostaje.

ALE naucz sie dwoch rzeczy:

1. **Dowod liczbowy > "wyglada ok".** Do sprawdzenia logiki (czy element widoczny, jaki
   ma z-index, ile jest wynikow, jaka pozycja) uzywaj CDP `Runtime.evaluate` /
   `getBoundingClientRect` / `getComputedStyle` / `elementFromPoint`. To jest
   deterministyczne i nie klamie.
2. **Stale-frame gotcha (wspoldzielona karta przegladarki).** Gdy kilka agentow dzieli
   te sama karte IDE, `browser_take_screenshot` potrafi zwrocic STARA klatke (np. bez
   swiezo otwartego modala), mimo ze DOM potwierdza, ze modal istnieje. Objaw: DOM mowi
   "overlay display:flex z-index 12100", a screenshot pokazuje czysta strone.
   Obejscie: wymus repaint (drobny scroll / toggle transformu + `void el.offsetHeight`),
   odczekaj klatke, zrob screenshot ponownie. Jesli dalej stale - zaufaj pomiarowi DOM
   i zapisz to jako znane ograniczenie, ale NIE deklaruj "done" wizualnie bez chocby
   jednego swiezego screenshotu kluczowej klatki.

Kolejnosc: najpierw CDP (czy logika dziala), potem screenshot+Read (czy wyglada dobrze).

---

## 6. Model danych (co znaczy co)

`file-index.json` -> `products[]`. Klucze wazne przy skojarzeniach i wyszukiwaniu:

| Pole | Znaczenie | Pulapka |
|------|-----------|---------|
| `id` | slug produktu (np. `tarta-malinowa-nerkowcowy`) | uzywany jako klucz skojarzen |
| `display_name` / `name` | nazwa czytelna / z folderu | `name` moze miec `-` zamiast em-dash |
| `indexes` | WSZYSTKIE indeksy produktu, np. `["000108.00","6300539.01",...]` | pelne, z kropka i wariantem |
| `index_bases` | indeksy bez sufiksu `.NN` | do dopasowan "po bazie" |
| `revisions[].index` | indeks per rewizja | zrodlo `indexes` |
| `search_blob` | gotowy, znormalizowany tekst do wyszukiwania | UZYWAJ GO - juz scala nazwy/indeksy/tagi |
| `path` | sciezka na dysku (`X:/Marketing/...`) | do dopasowania folder->produkt i "otworz folder" |
| `tags` | tagi produktu | |

`branding-index.json` -> assety brandingowe: `linked_products`, `folder_group_id`,
`folder_editable_files`, `background` (transparent/white - z realnego skanu pikseli),
`media_type` (image/video/document/vector). Zapis skojarzen: POST
`:8766/branding/asset-associations` (`asset_id`, `folder_group_id`,
`linked_product_ids`, `linked_variant_ids`).

Lekcja z sekcji 8 (search): NIE buduj wlasnego, ubogiego bloba z `indexes[0]` -
uzyj `search_blob` + pelnych `indexes`/`index_bases`.

---

## 7. STUDIUM PRZYPADKU 1 - Silnik animacji `reveal` (`dam-grid-reveal.js`)

### Co robi
Wspolny silnik "wjazdu" elementow: siatki kart (Projekty, Wizualizacje, Branding,
Dashboard, Eksplorer, Wiadomosci), tresc modali (gora->dol) i sidebar. GSAP jako
biblioteka animacji. API: `DamGridReveal.reveal(container, selector)` (siatki) i
`revealSequence(...)` (modale/sidebar). Tempo (po v2.0.7): `DURATION ~0.4s`,
`STAGGER 0.05s`; belki (toolbary/filtry) animowane jednorazowo przez `revealBars()`.

### Jak dziala i DLACZEGO tak
- Siatki uzywaja **IntersectionObserver** - element animuje sie DOPIERO gdy wjedzie
  w viewport ("jak na prawdziwej stronie"). Bez tego cala siatka 44000px animuje sie
  naraz przy renderze i user nigdy tego nie widzi.
- Modale nie sa scrollowane do widoku - pojawiaja sie - wiec dla nich robimy kaskade
  OD RAZU (`revealSequence`), bez bramki viewportu.
- Modale animujemy **generycznie, przez MutationObserver na `document.body`**, ktory
  wykrywa dodanie `.dam-viz-modal-overlay` i odslania `.dam-viz-modal__thumb` (fade) +
  dzieci `.dam-viz-modal__body` (zjazd z gory). Dzieki temu NIE dotykamy plikow modali
  (`dam-media-preview.js`, `dam-viz.js`) - patrz sekcja 4.
- `#damHelpFab` i stale przyciski NIE animuja sie (nie sa w selektorach).
- `prefers-reduced-motion` => czyscimy style, element od razu widoczny.

### PULAPKA, ktora kosztowala regresje (naucz sie tego na pamiec)
Chcielismy efekt "wycierania" od gory: `clip-path: inset(0% 0% 100% 0%)` w stanie
spoczynku (element scisniety do zera wysokosci), potem animacja do `inset(0 0 0 0)`.

**To zakleszcza IntersectionObserver.** Collapsing `clip-path` zeruje malowany
prostokat elementu, wiec IO raportuje `intersectionRatio = 0` i `isIntersecting=false`
- nawet gdy element jest fizycznie w viewporcie. Skoro IO nigdy nie widzi elementu,
reveal nigdy sie nie odpala => karty zostaja `opacity:0` na zawsze.

Dowod (zmierzony CDP `IntersectionObserver` na tej samej karcie):
- stan z `clip-path: inset(...100%)` -> `ratio 0`, `isIntersecting false`
- po usunieciu `clip-path` -> `ratio 0.61`, `isIntersecting true`

**Zasada (poprawka):** stan spoczynku obserwowanego elementu = TYLKO `opacity: 0`
(prostokat nienaruszony, IO dziala). `clip-path` (wycieranie) dodajemy DOPIERO w
tweenie `fromTo(...)` i czyscimy na koncu (`clearProps`).
```js
gsap.set(nodes, { opacity: 0 });               // stan spoczynku - bez clip-path
gsap.fromTo(nodes,
  { opacity: 0, clipPath: "inset(0% 0% 100% 0%)" },   // clip tylko na czas animacji
  { opacity: 1, clipPath: "inset(0% 0% 0% 0%)", clearProps: "clipPath,opacity", ... });
```

### Powiazana lekcja: `autoAlpha` vs `opacity`
GSAP `autoAlpha` = `opacity` + `visibility`. `visibility:hidden` bywa OK dla IO, ale
zeby wykluczyc ryzyko - dla elementow OBSERWOWANYCH przez IO uzywaj czystej `opacity`.
`clip-path` i `display:none` LAMIA IO; `opacity` i (zwykle) `visibility` - nie.

---

## 8. STUDIUM PRZYPADKU 2 - Edytor skojarzen (`dam-assoc-edit.js`)

### 8.1 Wyszukiwarka nie znajdowala po indeksie (np. `6300539.01`)
Przyczyna: blob wyszukiwania budowano z `productIndexOf(p)`, ktore zwraca
`indexes[0]` UCIETE do kropki (`"6300539.01"` -> `"6300539"`, a czesto tylko
`"000108"`). Wiec caly zbior pozostalych indeksow (i pelna forma z `.01`) nie byl
przeszukiwany. Efekt: "jest tam jak byk, a nie znajduje".

**Zasada:** do wyszukiwania uzywaj bogatego bloba - `search_blob` + `indexes` (pelne)
+ `index_bases` + `tags` + nazwy. Nie wymyslaj ubozszej wersji tego, co indekser juz
policzyl.
```js
function productSearchBlob(p){
  return [p.search_blob||"", p.display_name||"", p.name||"", p.id||"",
          (p.indexes||[]).join(" "), (p.index_bases||[]).join(" "),
          (p.tags||[]).join(" ")].join(" ").toLowerCase();
}
```

### 8.2 Folder picker byl nieklikalny (warstwy z-index)
Overlay edytora skojarzen `.dam-assoc-edit-overlay` ma `z-index: 12100`. Folder picker
`.dam-thumb-picker-overlay` mial `z-index: 10050`. Picker otwieral sie POD nakladka
skojarzen (ktora zaslania caly ekran) => kliki trafialy w spodnia nakladke.

Diagnoza warstw (deterministyczna): `document.elementFromPoint(x,y)` w srodku pickera
- jesli zwraca element spoza pickera, picker jest zaslaniany.

**Zasada:** overlay otwierany "na wierzchu" innego overlaya musi miec WYZSZY z-index.
Poprawka bez ruszania cudzego CSS: ustaw inline w JS `overlay.style.zIndex = "12300"`.
Utrzymuj swiadoma skale warstw (modale ~9999, nakladki edycji ~12100, pickery nad nimi
~12300).

### 8.3 "Dodaj z dysku" nic nie dodawalo
Stara implementacja po wyborze folderu tylko pokazywala toast "dodaj recznie" i
konczyla - nigdy nie mapowala folderu na produkt.

**Zasada:** feature ma faktycznie wykonac akcje. Rozwiazanie: dopasuj folder do
produktu po `path` z `file-index.json` (normalizacja: backslash->slash, bez koncowego
slasha, lowercase), priorytet: exact match -> produkty POD folderem -> produkt bedacy
RODZICEM folderu. Dodane id trafiaja do `selected` i zapisuja sie.

### 8.4 Odznaczanie bylo niejasne
Odznaczona pozycja w "AKTUALNE" zostawala z pustym checkiem - user nie wiedzial, czy
cos sie stalo. Zapis i tak bral `Object.keys(selected)`, wiec logicznie dzialalo, ale
UX klamal.

**Zasada:** komunikuj stan wizualnie. Odznaczona pozycja "aktualna" pokazuje CZERWONY
X (`uil-times`) = "zostanie usunieta". To zamyka petle poznawcza usera.

### 8.5 Ikony w wierszach + indeks jako TAG
User chcial "typowe ikony" (folder, kopiuj link) i indeksy jako tagi. Uwaga
techniczna: **nie zagniezdzaj `<button>` w `<button>`**. Wiersz to `<div opt-row>` z
glownym `<button opt>` (toggle) + osobnym `<span row-actions>` z przyciskami ikon.
Toggle bindujemy TYLKO na `.opt[data-id]`; ikony maja `stopPropagation`. Styl (tag,
ikony) wstrzykniety z JS (sekcja 4).

---

## 9. Pulapki srodowiska (Windows / PowerShell / X:)

- **PowerShell nie akceptuje `&&`** jako separatora. Uzywaj `;` lub osobnych wywolan,
  albo sprawdzaj `$LASTEXITCODE`.
- **`curl` w PowerShell to alias `Invoke-WebRequest`** i potrafi zawisnac przy pipe.
  Do HTTP uzywaj `curl.exe -s --max-time 8 ...`.
- Sciezki repo maja spacje i myslniki - zawsze cytuj `"..."`.
- Dysk `X:` (Marketing) to NFS/Synology - odczyt bywa wolny i moze sie ZAWIESIC.
  Skany pikseli/podglady rob z budzetem czasu i timeoutem; nie blokuj w nieskonczonosc
  (byl realny bug: `ThreadPoolExecutor.shutdown(wait=True)` wisial na martwym odczycie
  NFS - timeout nigdy nie dzialal; fix: watek daemon + `Event.wait(timeout)`).
- **Em-dash ban:** w kodzie/UI uzywaj `-` (hyphen), nie `—`/`–`.

---

## 10. Zasady debugowania (jak myslec)

1. Mikroinput -> makroplan: rozbij zgloszenie na atomy, ustal przyczyne PRZED fixem.
2. Najpierw znajdz PRZYCZYNE (root cause), nie objaw. Dowod > hipoteza (CDP, logi, dane).
3. "Dlaczego dziala X, a nie Y" - szukaj roznicy pomiarowej (np. IO ratio 0 vs 0.61).
4. Nie zgaduj funkcji/pol danych - sprawdz `file-index.json`/`branding-index.json`.
5. Nie ruszaj plikow innych agentow (sekcja 4). Nie restartuj mostu/serwera bez potrzeby.
6. Backup/ostroznosc przy operacjach destrukcyjnych; przy niejasnosci - pytaj.

---

## 11. Slowniczek modulow DamX (gdzie czego szukac)

| Modul (`window.Dam*`) | Plik | Odpowiada za |
|-----------------------|------|--------------|
| `DamGridReveal` | `dam-grid-reveal.js` | animacje reveal siatek/modali/sidebara |
| `DamAssocEdit` | `dam-assoc-edit.js` | edycja skojarzen produktow/wariantow, folder picker |
| `DamMediaPreview` | `dam-media-preview.js` | modal podgladu assetu brandingowego |
| `DamViz` | `dam-viz.js` | modal wizualizacji, warianty |
| `DamBranding` | `dam-branding.js` | siatka/filtry/facety brandingu, search |
| `DamPaths` | `dam-paths.js` | sciezki, `revealInExplorer`, `toPortablePath`, bridgeUrl |
| `DamBadges` | `dam-badges.js` | tagi/badge, klik->filtr |
| `DamMarketingId` | `dam-marketing-id.js` | kody typu assetu (VID/GIF/TIK/YT/REL...) |
| `DamProjects` | `dam-projects.js` | siatka Projekty |
| `DamExplorer` | `dam-explorer.js` | Eksplorer (wiersze produktow/nosnikow) |

Most: `apps/desktop/local_bridge.py` (endpointy: `/folder-browse`, `/folder-images`,
`/media`, `/branding/asset-associations`, `/program-instructions`, finanse, OAuth).

---

## 12. Dziennik lekcji (DOPISUJ tu nowe odkrycia)

Format wpisu: data | obszar | objaw | przyczyna | zasada.

- 2026-07-20 | sidebar morph | jank przy collapse/expand mimo GSAP 0.5s |
  tween `width+minWidth+maxWidth` + `paddingInlineStart` + `marginRight` ikon
  + stagger etykiet walczyl z Geex `transition: all 0.3s` i robil layout thrash
  co klatke | jedna os: proxy liczbowy -> `--dam-sidebar-w` (dam-app.css steers
  sidebar + main); etykiety tylko `autoAlpha`/`x` bez stagger; podczas morph
  `transition:none!important` + `will-change` na width/pad; kill TL przy toggle;
  `prefers-reduced-motion` => duration 0 / natychmiast.
- 2026-07-20 | wykrojniki XLSX | rejestr pelen `row-N` bez nazw | Kubara
  `opakowania_Kubara_baza_danych.xlsx` ma wiele sekcji z powtarzanym naglowkiem
  (kolumna „oznaczenie Kubara”, nie `kod` w wierszu 0) | parser szuka wierszy
  naglowka po markerze; nie zakladaj pierwszego wiersza arkusza; UI nie pokazuje
  `python …` jako glownego UX - bridge `POST /wykrojniki/reimport|link-products`.
- 2026-07-20 | bridge restart | nowe POST routes = `not_found` mimo edycji pliku |
  listener to `pythonw.exe` (watchdog), nie `python.exe` zabity przez agenta |
  przy restarcie mostu zabijaj procesy z `CommandLine` zawierajacym `local_bridge`.
- 2026-07-20 | integrations skeleton | rowne ~5 kart zamiast Bento | `DamGridReveal.skeleton`
  (`auto-fill minmax(220px)`) nie zna `dam-int-bento-grid` / `dam-int-tile--feature` |
  hub: wlasny skeleton na realnych klasach siatki (span-2 + sekcje Integracje/Planowane);
  nie uzywaj generic cards skeleton dla layoutow z `grid-column: span`.
- 2026-07-20 | usermenu | highlight Profil nizej niz ikona/tekst | Geex
  `.geex-content__header__popup__link { align-items: flex-start !important }`
  przebija dam-brand bez !important + min-height | w `#damShellLayerCss` wymus
  `align-items:center !important` + rowne `padding` (nie sam min-height).
- 2026-07-20 | tooltips | stray tip "Konto" w menu profilu | `dam-tooltips.js`
  tipuje kazdy `[aria-label]`, takze `<nav aria-label="Konto">` | nie dawaj
  aria-label na kontenery (nav/legal); `shouldAutoTip` skip NAV / role=menu.
- 2026-07-20 | paths / device | litera dysku „globalna” dla konta | remote work
  (dom X: vs praca D:) | sciezka Marketing = per `device_id` (KV
  `user-device-paths:{email}` + `/user-device-paths/current`); LS/machine-config
  tylko cache biezacego PC; PI `device-scoped-base-paths`.
- 2026-07-20 | reveal | karty niewidoczne mimo animacji | `clip-path` w stanie spoczynku
  zeruje prostokat -> IntersectionObserver ratio 0 -> deadlock | stan spoczynku = tylko
  `opacity:0`; `clip-path` wylacznie w tweenie.
- 2026-07-20 | skojarzenia/search | brak wynikow dla `6300539.01` | blob z `indexes[0]`
  ucietego | uzywaj `search_blob` + pelnych `indexes`/`index_bases`.
- 2026-07-20 | overlay | folder picker nieklikalny | nizszy z-index (10050) niz nakladka
  skojarzen (12100) | picker musi miec wyzszy z-index (inline 12300); diagnoza
  `elementFromPoint`.
- 2026-07-20 | wspolbieznosc | ryzyko nadpisania CSS innego agenta | wstrzykuj CSS z JS
  (`<style id>`), nie edytuj cudzych `.css`.
- 2026-07-20 | QA | screenshot pokazuje stara klatke | wspoldzielona karta IDE | wymus
  repaint + odczekaj klatke; potwierdzaj logike CDP; nie ufaj samej auto-caption.
- 2026-07-20 | dashboard branding_latest | "Brak assetow w indeksie branding" przy
  7832 assetach | filtr `media_type === "raster"` (legacy) vs indeks z `image`/`vector`/`source`
  | uzywaj `normalizeMediaType` (raster->image) + `isBrandingWidgetThumb`; wspoldziel
  `window.__damBrandingIndex` z brandingiem.
- 2026-07-20 | skeleton / branding+viz | pusta siatka podczas ladowania indeksu
  | skeleton tylko w costs/invoices; boot brandingu czekal na `await loadIndex()` zanim
  cos w `#damBrandingSectionGrid` | `showInitialBootSkeletons()` synchronicznie na starcie
  `boot()` / `init()`; `skeleton(..., layout:'viz-grid')` wstawia karty bezposrednio do
  `.dam-viz-grid`; po renderze innerHTML + `reveal(vizCard)`.
- 2026-07-20 | dashboard win-btn | Folder Windows nie otwiera po async branding_latest
  | `bindWinButtons(mount)` przed `outerHTML` w `.then()` | delegacja klik na `#damDashGrid`
  + re-bind na hoscie po async/toggle.
- 2026-07-20 | branding ?q | Brak wynikow z kafelka dashboardu | domyslna zakladka
  `campaigns` bez hitow | `bestTabForSearchQuery(q)` + `?tab=` ze sciezki assetu.
- 2026-07-20 | modal unify | dwa systemy podgladu (#damLightbox vs DamMediaPreview)
  | explorer nie ladowal media-preview | adapter `openLightbox` -> `openAsset(mode:
  viz-studio)`; shell close `#damMediaPreview` pierwszy.
- 2026-07-20 | bridge /reveal | okno Eksploratora otwiera sie W TLE | most = `pythonw`
  bez okna pierwszoplanowego, wiec explorer.exe z subprocess nie dostaje fokusu
  (foreground lock) | fokus wymus ALT-trickiem: `keybd_event(VK_MENU)` +
  `SetForegroundWindow` + `ShowWindow` + `BringWindowToTop`; rob to w watku daemon,
  nie blokuj odpowiedzi HTTP.
- 2026-07-20 | bridge /reveal karta | Navigate2 pokazywal dialog "Nie mozna odnalezc
  file:///...%20..." | sciezka podana Navigate2 jako string bywa rozwiazywana jako
  URL-encoded file URI (spacje/myslniki lamia parsing) | ZAWSZE PIDL:
  `SHParseDisplayName(path)` -> `PIDLAsString` -> `VARIANT(VT_ARRAY|VT_UI1)`.
  Nowa karta Win11 (build 26200): rejestr `OpenFolderInNewTab=1` NIE dziala,
  `Navigate2(path, 2048)` nawiguje biezaca karte; dziala fokus okna -> Ctrl+T
  (keybd_event) -> Navigate2(PIDL) na swiezej (pustej `LocationURL`) karcie;
  swieza karta przez chwile rzuca E_ABORT - retry ~8x co 0.4 s.
- 2026-07-20 | dashboard 2x2 | widget z etykieta 2x2 renderowal 1 kolumne | ogolna
  `.dam-widget__list` (display:flex) stala NIZEJ w dam-dashboard.css niz
  `.dam-widget__list--media` (grid) o tej samej specyficznosci - kaskada wygrywala
  flexem | przy rownej specyficznosci wygrywa pozniejsza regula; podbij selektor
  podwojna klasa (`.dam-widget__list.dam-widget__list--media`), nie `!important`.
- 2026-07-20 | branding perf | klik tagu mrozil UI do ~10 s | `renderTagFilters`
  (facet counts = petla assets x ~100 kluczy) w TEJ SAMEJ klatce co render siatki
  | fazuj: skeleton (klatka 1, tylko gdy poprzedni render >150 ms) -> siatka
  (klatka 2) -> tagi/facety (klatka 3, rAF); loader `DamLoader.start/done` na klamrze;
  skeleton musi dostac klatke na PAINT przed ciezkim synchronicznym renderem
  (rAF + setTimeout 0), inaczej nigdy go nie widac.
- 2026-07-20 | badge w title-wrap | chip ID uciety wielokropkiem mimo miejsca w karcie
  | `.dam-viz-card__title-wrap` ma `flex-wrap:nowrap` (dam-brand.css) i chip byl
  sciskany | scope'owany override `:has(.dam-branding-card__id-chip){flex-wrap:wrap}`
  w moim CSS - chip lamie sie do wlasnej linii; nie ruszaj cudzego dam-brand.css.
- 2026-07-20 | clipboard | `navigator.clipboard.writeText` z klikow symulowanych CDP
  odrzuca promise (brak user activation / fokusu dokumentu) | testujac kopiowanie w tle
  weryfikuj mechanizm (handler + toast), nie sam wynik clipboardu; realny klik ma
  aktywacje.
- 2026-07-20 | QA / samouczek | klik "Zakoncz samouczek" w tle NAWIGUJE karte na inna
  strone (fazy samouczka) | przed testami brandingu ustaw flagi dismissu samouczka
  w localStorage albo pracuj na swiezej karcie i sprawdzaj `location.href` przed
  kazdym pomiarem CDP.
- 2026-07-20 | samouczek/CSS custom property | `url('assets/img/...')` w custom property
  ustawianej JS-em w inline style rozwiazywal sie wzgledem pliku CSS (assets/css/), nie
  dokumentu -> 404 | buduj ABSOLUTNY URL przez `new URL(path, location.href).href` zanim
  wstawisz do `--var: url('...')`; nie wracaj do relatywnych sciezek w custom property.
- 2026-07-20 | samouczek/maskotka | bob (GSAP y) ruszal cala maskotke razem z bialym
  medalionem, choc kolko ma stac | pseudo-element (`::after`) NIE da sie animowac GSAP-em,
  wiec bob musial ruszac kontener | rozdziel warstwy: medalion = `::before` na kontenerze
  BEZ transformacji (static), obraz = osobny realny element `.dam-tut__mascot-img` ktory
  jako jedyny dostaje tween y; custom property (`--dam-tut-pose`) na kontenerze dziedziczy
  sie do dziecka. Zasada ogolna: animujesz tylko warstwe, ktora ma sie ruszac, nie rodzica
  z elementami statycznymi.
- 2026-07-20 | samouczek/wznowienie miedzy stronami | test faz przez `localStorage
  damTutorialPhase` + nawigacja bywal "lepki": strona X wznawiala poprzednia faze
  (np. Kalkulator pokazywal Branding) | gdy poprzednia karta ma AKTYWNY samouczek,
  jego stan/`PHASE_KEY` moze kolidowac przy nawigacji (klucz nie zawsze nadpisany na
  czas) | przed ustawieniem nowej fazy wywolaj `window.DamTutorial.stop()` (robi
  `lsDel(PHASE_KEY)`), potem `setItem` docelowej fazy, potem nawiguj/reload. Produkcyjny
  resume (goToPhasePage: savePhase -> location.href -> boot) dziala poprawnie - to byla
  pulapka testowa, nie bug.
- 2026-07-20 | samouczek/wspolbieznosc HTML | rownolegli agenci bumpuja `?v=` w tych
  samych 9 HTML | rob bump WYLACZNIE regexem po wlasnym wzorcu (`dam-tutorial.css?v=` /
  `dam-tutorial.js?v=`), nigdy globalnie po `?v=`, zeby nie ruszyc wersji cudzych plikow.
- 2026-07-20 | samouczek/API | `window.DamTutorial.next()`/`.prev()` nie sa publiczne
  | w testach klikaj `.dam-tut__btn--next`/`--prev` (lub mini-nav `--mini-next`/
  `--mini-prev`), albo steruj przez publiczne `start({phase,step})`/`stop()`.
- 2026-07-20 | Strefa A / skojarzenia lustrzane | user oczekuje sliderow Postanowienia/DPD
  przy produkcie 6300684 (babka), a UI ich nie pokazuje | w `branding-index`
  te assety maja `linked_products` tylko `mix-6x-mini-batoniki-mixy` (brak slug
  babki / indeksu w thumb_url) | matching lustrzany jest OK; brak = blad danych
  indeksera (P15), nie UI. Nie "doklejaj" assetow po nazwie w modalu.
- 2026-07-20 | Strefa A / assocRank | pos_material wyglada jak "slider" w oczach usera
  | w danych to czesto warstwy PSD (Layer 118, LISC4) | `assocRank` daje
  web_hero_slider/web_bundle_tile = 0, pos_material = 1; nie promuj pos_material
  do czola listy tylko bo sciezka zawiera "slider".
- 2026-07-20 | Strefa A / viz "Dodaj miniature" | trudno trafic kafelek z lacksViz
  wsrod pierwszych kart | `showAddManual = manualPairedN > 0 || missingLangs.length
  || items bez thumb/path`; missingLangs = alias_langs/langs minus langs obecne
  w wariantach | do QA szukaj produktu z `alias_langs` szerszym niz obecne wizki
  (np. coconut-orange-date: DE+GB, brak RO/LT/LV/EE).
- 2026-07-20 | QA / CDP click | `HTMLElement.click()` / `dispatchEvent(MouseEvent)`
  w Runtime.evaluate bywa calkowicie martwe w karcie automatyzacji (nawet na
  swiezym buttonie w body), mimo ze MCP `browser_click` raportuje sukces |
  do otwierania pickerow eksportuj API (`DamAssocEdit.openPicker`) albo uzywaj
  MCP click po dismissie `#damTutorialOverlay` (`.dam-tut__btn--end`); nie
  uznawaj "brak popovera po .click()" za regresje UI bez sprawdzenia API.
- 2026-07-20 | Strefa A / thumb picker | tag daty pliku rzadko widoczny |
  most `/folder-images` nie zwraca `mtime` | renderuj date tylko gdy pole
  istnieje; nie udawaj daty z indeksu produktu.
- 2026-07-20 | PowerShell / bump ?v= | inline `$zmienne` w narzedziu Shell sa
  zjadane przez interpolacje hosta | masowe bumpy: tymczasowy `.ps1` +
  `powershell -File`, potem skasuj; unikaj `&&` (uzywaj `;`).
- 2026-07-20 | explorer / otwieranie produktu | klik w tekst "KARTON 6x MINI"
  ustawia filtr opakowania zamiast otworzyc wariant | wiersz =
  `.dam-carrier-toggle-row`; produkt z CDP: `DamExplorer.openProduct(slug)`.
- 2026-07-20 | shell / flash Geex Demo przy nawigacji menu | wiele stron HTML
  (dashboard, explorer, costs, invoices…) zawiera **statyczny markup szablonu Geex**
  (`Demo`, `Server Management`, `Banking`, `Crypto`) w `.geex-header__menu` /
  `.geex-sidebar__menu`; `dam-shell.js` przepisuje menu dopiero na
  `DOMContentLoaded` | miedzy first paint a init shella user widzi stary layout
  (FOUC + flash placeholdera) | fix: `html.dam-booting` + inline critical CSS
  (`#dam-shell-boot-critical`) ukrywa `body` (`opacity:0`) od pierwszej klatki;
  `DamShell.finishBoot()` (double rAF po rewrite chrome) zdejmuje klase i
  fade-in (`dam-shell-boot.css`, `prefers-reduced-motion`); fallback 4.5s w
  `<head>` gdy shell nie wstanie | NIE polegac na samym zewnetrznym CSS boot -
  musi byc INLINE w `<head>` przed body; `?v=` strony NIE bumpuje shella.
- 2026-07-20 | Strefa A3 / Links vs materialy | w "Skojarzone materialy" wpadaja
  surowe pliki z folderu `Links` (flor2, batonik_liscie…) | klasyfikuj po sciezce:
  `\\Links\\` / `\\2 - PROJEKT\\Links` = SUROWE; `\\1 - MATERIAŁY\\ELEMENTY` =
  gotowe elementy | wyrzuc z glownej listy i pokaz w zwijalnej grupie ELEMENTY
  (domyslnie collapsed). Indekser nie indeksuje Links produktu 01-PRODUKTY -
  tylko POS/branding Links; product Links/ELEMENTY resolvuj z dysku przez most
  (`/product-links-elementy`). Gleboki fix skojarzen "skladniki/owoce" w
  indekserze = agent B (`build-branding-index.py`).
- 2026-07-20 | Strefa A3 / "Brak wizualizacji" czerwone | label
  `.dam-viz-modal__missing-langs-label` i chip `.dam-viz-badge--lang-missing`
  uzywaja `var(--danger-color)` w `dam-brand.css` | czerwien = tylko destrukcja;
  przy wspolbieznosci (nie ruszac dam-brand.css) wstrzyknij override
  `<style id="dam-a3-styles">` z tokenem muted (`#8f8b9f` / surface-muted).
- 2026-07-20 | Strefa A3 / broken img w skojarzeniach | `onerror="this.src='data:…'"`
  w atrybucie HTML bywa kruche (escape / petla) i zostawia native broken-icon |
  uzyj `window.__damAssocThumbFallback` = `replaceWith` ikony
  `.dam-media-preview__assoc-thumb--fallback` (uil-image-slash). Dowod: CDP
  `naturalWidth` + `querySelectorAll(...fallback)` > opis vision przy stale-frame.
- 2026-07-20 | Strefa A3 / Inyfinn Image resizer | launcher
  `InyfinnPhotoResizer.exe` (~10 KB) to GUI starter, NIE przyjmuje CLI;
  prawdziwy CLI: `inyfinn_resizer.cli` (`convert -i -o -f png -q 60`) przez
  `BIN/dev/.venv/Scripts/python.exe -m …` gdy venv istnieje | inaczej GUI +
  `reveal_in_explorer(Links)` (PIDL/foreground ze Strefy D). Endpointy:
  `GET /product-links-elementy`, `POST /open-image-resizer`; po dodaniu
  **wymagany restart mostu** (`BRIDGE_API_VERSION` w `/health`).
- 2026-07-20 | STREFA H / danger zone settings | karta „Strefa ryzyka”
  sciskala sie do ~1/12 szerokosci | klasa `.dam-sw--danger` nie miala
  `grid-column` w `dam-settings.css` (siatka 12-col) | zawsze jawnie
  `grid-column: 1 / -1` w inline CSS nowej sekcji settings; nie polegaj
  na domyslnym spanie.
- 2026-07-20 | STREFA H / hold-to-delete | dialog „Czy jestes pewien?” +
  czerwone dekoracyjne X | commitment: `DamDanger.bind` / `data-dam-hold-delete`
  (~300 ms, ring SVG), etykieta czasownika, offset od Confirm/Restart,
  czerwień tylko na destrukcji, soft-delete `toastUndo` 5–10 s; CSS inject
  z JS (`#damDangerInjectedCss`) gdy nie wolno ruszac cudzego dam-brand.css.
- 2026-07-20 | Integracje / Bento + GSAP revealRows | `DamGridReveal.revealRows`
  (`autoAlpha` + stagger) w IDE browser potrafi **zamarznac w polowie**
  (opacity 0.1–0.5, reszta `visibility:hidden`) mimo ze DOM/rects sa OK |
  po `revealRows` dodaj safety `setTimeout` wymuszajacy `opacity:1` /
  `visibility:visible` na `.dam-int-card` gdy computed opacity < 1 |
  layout bento: osobny `dam-integrations.css` + `opts.layout:"bento"`
  (nie ruszac anatomii `.dam-viz-card` / `.dam-branding-card` = C3).
- 2026-07-20 | Integracje / settings vs hub | ten sam `DamIntegrations.mount`
  serwuje dwa chrome: hub `layout:"bento"` = 4-col, settings
  `layout:"settings-bento"` (lub auto `#damIntegrations`) = 3-col |
  CSS settings osobno (`dam-integrations-settings.css`); przy konflikcie
  H2 na `settings.html` wstrzykuj `<style id="dam-int-settings-bento">`
  z JS; status = chip (`.dam-int-chip`), nigdy geex-badge na 100% szerokosci
  karty; `dam-settings.css` `.dam-int-card` bez grida = belki full-width
  dopoki nie zaladujesz bento CSS + tile markup.
- 2026-07-20 | STREFA VIZ-ASSOC / petla wiz→wiz | `renderLinkedBrandingAssets`
  bierze WSZYSTKIE assety z `linked_products` z branding-index — w tym
  ~2000 `asset_role=packshot` / `source=wizki` | przy podgladzie wizualizacji
  lista "Skojarzone materialy" zamieniala sie w galerie innych wizek |
  filtr UI: `isVisualizationAsset` (packshot / wizki / sciezka `4 - WIZKI|VISUALS`)
  + `isNoiseBrandKitAsset` (IKONY/logo) + `isRelevantMaterialForProduct`
  (role WWW/social/POS albo tokeny nazwy/indeksu w sciezce) | layout:
  `.dam-viz-modal-box--assoc-split` w `dam-viz-modal.css` (grid 2-col desktop,
  stack hero→meta→assoc <768). Indekser: nie linkuj packshotow jako
  "material brandingowy" przy innym packshocie (PI `viz.assoc_no_visualization_loop`).
- 2026-07-20 | STREFA B follow-up / ELEMENTY skojarzenia | product-folder
  `2 - PROJEKT/Links` + `1 - MATERIALY/ELEMENTY` NIE byly w branding-index
  (scan 01-PRODUKTY tylko WIZKI packshoty) | UI A3 filtruje ELEMENTY po
  sciezce + `search_blob` (skladniki/owoce/owocki), ale brak danych |
  fix: `scan_product_element_assets` + `brand_element_assoc.py` (term in
  search_blob, NIE facet CANONICAL_TAGS) + incremental
  `enrich-branding-element-assoc.py`; linkowanie product_element TYLKO po
  SKU ze sciezki (nie `match_products_by_associations` na nazwie pliku —
  inaczej kazda "cytryna*.tif" leci na babke). PI:
  `branding.element_assoc_skladniki_owoce`. Pixel-scan tla WYLACZONY dla
  `source=product_element` (TIFF 50–120 MB na NFS).
- 2026-07-20 | STREFA INT-LOAD / skeleton integracji | `#damIntegrationsList`
  zostaje na `dam-skeleton--grid` albo CTA wygladaja na "tylko odswiez" |
  (1) inline mount tylko na `DOMContentLoaded` gdy readyState juz `complete`
  = mount nigdy; (2) skeleton bez hard failsafe gdy Promise/most wisi;
  (3) remount na focus zamyka `<details>` i flashuje skeleton |
  boot: `if (readyState==="loading") addEventListener else mount()`;
  po skeletonie failsafe ~14s → `showLoadError`; nie remountuj gdy
  `details[open]` / focus w formularzu; foot CTA = `.dam-int-cta`
  (tokeny jak `.dam-welcome-link`), nie `geex-btn--primary-transparent`.
- 2026-07-20 | STREFA B / rebuild indeksu na X: NFS | `build-branding-index`
  + PIL na TIFF 100M–500M px gromadzi watki daemon (`_run_with_timeout`
  5 s) i wisi dziesiatki minut przy CPU≈0 | (1) w workerze lap `Exception`
  (DecompressionBombError nie jest OSError), (2) legacy `-- ARCHIWUM --`
  pomijaj pixel-scan tla i `_tiff_has_layers` (editable z zalozenia),
  (3) log progress co N plikow + flush; przy 80+ watkach zabij i restart
  z fixem - nie odpalaj drugiego skanu rownolegle.
- 2026-07-20 | STREFA B / POLSKA-first overlap | folder ARCHIWUM
  `05 - SLIDERY - sklep` moze miec 0 sciezek w indeksie mimo plikow na dysku
  gdy `file_overlap_key(stem+wymiary)` trafia w `- POLSKA/.../SLIDERY` |
  to zamierzony dedup; UI Slider rosnie z kopii POLSKA. META (unikalne)
  wchodzi jako nowe assety `is_archive` + tag `Stara struktura`.
- 2026-07-20 | STREFA B / zakladka wszystko vs tag→tab | klik `channel:meta`
  ustawia tab `social` (FACET_TAB_BY_KEY) i chowa assety sekcji `other`/
  e-commerce ARCHIWUM | po filtrze tagiem wroc na `data-tab="all"` albo
  nie przelaczaj sekcji gdy user jest na "Pokaz wszystko"; popup dna listy
  = IntersectionObserver na `#damBrandingListEnd`, nie `window.onscroll`.
- 2026-07-20 | Integracje / Konfiguruj panel ~56px | open `.dam-int-config__panel`
  wygladal jak pionowy pasek tekstu | panel `position:absolute; left/right:16px`
  kotwiczyl sie w `.dam-int-tile__config` (`inline-flex` + `position:relative`
  ≈ szerokosc summary ~88px) → 88−32 ≈ 56px | nie dawaj absolute left/right
  wzgledem shrink-wrap wrappera przycisku; panel in-flow na `width:100%`
  foota (`flex:1 1 100%` + `position:static`) albo kotwica do samego tile;
  fix wstrzykniety `#damIntConfigPanelFix` z `dam-integrations.js` (wspolbiezni
  agenci na CSS). Auto-caption screenshotu bywa biasowana starym bugiem —
  mierz `getBoundingClientRect` + ewentualnie szerokosc przycisku w PNG.
- 2026-07-20 | Overlay scroll-trap + close X | `#damFmcgEditOverlay` wheel
  przewijal tlo zamiast tabeli; Zamknij jako fat `.dam-int-cta` konkuruje z Zapisz |
  (1) dialog `width:min(80vw,…); height:min(80vh,…); display:flex; overflow:hidden`,
  scrollport = `.dam-fmcg-edit__table-wrap` + `overscroll-behavior:contain`,
  (2) `body`/`html` class lock + `wheel`/`touchmove` capture: prevent poza wrapem,
  na wrapie prevent tylko na krawedzi, (3) close = `.dam-modal-x` (ikona), CTA akcji
  zostaja `.dam-int-cta`; hold-delete = DamDanger + prefs KV `user-prefs:{email}`.
  Dowod: wrap.scrollTop sie zmienia, window.scrollY = 0.
- 2026-07-20 | Integracje hub / focus remount | przyciski „tylko odświeżają”,
  Konfiguruj sie zamyka, skeleton flash | `window.addEventListener("focus",
  DamIntegrations.refresh)` robił pełny remount (skeleton + wipe `<details>`) |
  NIE remountuj na focus; najwyżej `visibilitychange` z guardem
  `details[open]` / form focus + debounce; Promise.all z `withTimeout` +
  failsafe clear skeleton; po `revealRows` rób `gsap.killTweensOf` + force
  opacity (mid-tween wygląda jak pusty hub / „zostal skeleton”).
- 2026-07-20 | Sidebar morph / icon recenter jank | width `--dam-sidebar-w` płynny,
  ale na `onComplete` klasa `dam-sidebar-collapsed` snapuje `padding` 29→10,
  link `padding` 25→0 + `justify-content:center` (~30px skok ikon) |
  podczas morph trzymaj tor ikon w CSS vars (`--dam-sb-pad-x`, `--dam-link-pad-x`)
  + `justify-content:flex-start`; labels `position:absolute` (bez reflow);
  dim = `filter:brightness` (nie color snap na active); klasę collapsed dopiero
  w `onComplete` gdy pad ≈ center rail. Cache: `dam-shell.js?v=sidebarmorphsmooth20260720c`.
  Uwaga QA: `document.hidden` w IDE browser pauzuje rAF/GSAP - do mid-tween
  użyj `gsap.updateRoot(t0+dt)` od bieżącego `globalTimeline.time()`, nie od 0.
- 2026-07-20 | Sidebar morph / pad vars + logout + footer | po morph `clearPadVars`
  + `justify-content:center` z `dam-brand.css` = drugi snap mimo płynnego tweenu;
  Wyloguj mid-rail = `margin-top:8px` collapsed + logo `margin-top:auto` zjada
  przestrzeń; footer „zniknął” = poniżej fold (menu bez `height:100%`) + fallback
  brand_sub | (1) po collapse ZOSTAW `--dam-sb-pad-x`/`--dam-link-pad-x` i
  override collapsed na `flex-start` (inject `#damShellLayerCss`), stały slot
  ikony 20/22px, (2) logout `+50px` w obu stanach; menu `min-height:100%`;
  logo collapsed `margin-top:10px` nie `auto`, (3) footer expanded
  `DAM / Dobra Kaloria - Inyfinn / v…`; collapsed `.dam-sidebar-collapsed-meta`.
  Cache: `dam-shell.js?v=sidebarmorph20260720e`.
- 2026-07-20 | Change-log vs „Baza online” | hint `#damChangeLogHint` = „Bridge
  offline” mimo zielonego „Baza online” | `/change-log` wymaga sesji
  (`_require_login`); fetch BEZ `Authorization` dostaje `ok:false,
  login_required`, a UI traktował każdy `!ok` jak offline. „Baza online” =
  Postgres/status pill, nie most change-log. Fix: `bridgeAuthHeaders()` na GET
  + rozróżnij `login_required` vs sieć; copy PL: „Most zmian niedostępny -
  Cofnij/Ponów lokalnie”. Cofnij/Ponów = undo/redo rename typu/indeksu/plików
  na dysku X: przez most 8766 (tylko admin).
