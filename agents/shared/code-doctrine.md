# WYKLADNIA KODU DAM (Code Doctrine) - czytaj ZAWSZE przed zmiana kodu

> Status: OBOWIAZKOWA wykladnia i instrukcja. Dokument nadrzedny nad "przeczuciem".
> Kolejnosc zrodel prawdy: `program-instructions.json` > ten dokument > `memory.md` > kod.
> Ten plik uczy CZYTAC kod DAM, rozumiec DLACZEGO cos dziala (a cos innego nie),
> i podejmowac trafne decyzje szybciej. Nie zgaduj - tu masz mape.

Autor pierwszej wersji: agent, ktory naprawil silnik animacji `reveal` i edytor
skojarzen (2026-07-20). Kazdy kolejny agent DOPISUJE lekcje (patrz sekcja 12).

---

## 0. Jak uzywac tego dokumentu

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
