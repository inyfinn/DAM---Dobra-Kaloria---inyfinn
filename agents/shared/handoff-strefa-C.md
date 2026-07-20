# Handoff STREFA C - samouczek DAM (DobroKaloriuś) - 2026-07-20

> **Update C3 (Task 39 DONE):** nazwa maskotki w UI = **DobroKaloriuś** (nie Bobek).
> Szczegoly: [`handoff-strefa-C3.md`](handoff-strefa-C3.md). Cache JS: `dam-tutorial.js?v=8`.

Stan na moment przerwania pracy (limit API koordynatora). Kod jest SPOJNY:
`node --check` przechodzi, wersje `?v=` zbumpowane, zadna edycja nie wisi w polowie.

## (a) Co dziala i zostalo ZWERYFIKOWANE screenshotem + Read

- **Toast zaproszenia** (prawy dol, ~2 s po zaladowaniu dashboardu, gdy brak
  `damTutorialSeen`): maskotka "wave" w medalionie, tekst "Cześć, tu DobroKaloriuś!
  Chcesz krótki samouczek po panelu?", przyciski [Jasne, pokaż] [Nie teraz]
  [Nie pytaj więcej].
  Screenshot + zoom OK (padding 24px 26px, przezroczysta maskotka wystaje nad kolko).
  - "Nie teraz" -> sessionStorage `damTutorialNotNow=1` (zweryfikowane CDP).
  - "Nie pytaj więcej" -> localStorage `damTutorialSeen=1` (zweryfikowane CDP).
  - "Jasne, pokaż" -> start samouczka (zweryfikowane w poprzednich przelotach).
- **Faza 1 (Dashboard)**: krok 1 (powitanie, poza wave) i krok 2 "Co tu znajdziesz"
  (poza explain, spotlight na karcie `.dam-widget--stat`) - screenshoty OK.
- **Panel sterujacy** (dol-srodek, pill): Wstecz / Faza X/9 + kropki / Dalej /
  Pomin faze / Zakoncz samouczek. Padding 20px 24px. Screenshot + zoom OK.
  Wstecz poprawnie disabled na kroku 1. Klik "Dalej" przechodzi krok i zmienia poze.
- **Spotlight**: box-shadow wyciecie, plynne przejscia GSAP - dziala (fazy 1-2).
- **Wznowienie miedzy stronami**: `localStorage damTutorialPhase='1:0'` +
  wejscie na `explorer.html` wznawia faze 2 "Eksplorer" (poza explain, spotlight
  na `#damExplorerMain`) - screenshot OK.
- **Klawiatura** (strzalki, Esc) i pochwala po kliknieciu usera - zaimplementowane,
  testowane w wczesniejszych przelotach (przed dogrywka maskotki).
- **Wpis "Uruchom samouczek"** w modalu pomocy (#damHelpModal, wstrzykiwany
  pollingiem z dam-tutorial.js) - zaimplementowane, sprawdzone wczesniej.

## (b) Dogrywka maskotki - STAN: WSZYSTKO ZROBIONE i zweryfikowane (2 przeloty)

1. **Przezroczyste tlo**: TAK. Skrypt Pillow:
   `apps/web/scripts/cut-mascot-sprite.py` - tnie sprite 3x3
   (`assets/img/maskotka-bobek.png`, to JPEG z kremowym tlem), flood-fill od
   krawedzi (tolerancja 90 sum roznic RGB), usuwa TYLKO obszar spojny z
   krawedziami, dodatkowo filtr komponentow usuwa plakietki z numerami
   ("1", "2"...) i skrawki liter u gory kafla, 1px erozja (MinFilter 3) +
   GaussianBlur 0.6 na masce alpha zdejmuje kremowa obwodke. Wynik:
   `apps/web/assets/img/maskotka/pose-1.png` ... `pose-9.png` (WYGENEROWANE,
   sprawdzone Read vision - krawedzie czyste). Skrypt jest idempotentny,
   mozna odpalac ponownie: `python apps/web/scripts/cut-mascot-sprite.py`.
2. **+25% rozmiaru**: TAK. Medalion dymka 72->90px, toastu 60->75px
   (CSS var `--tut-medal`).
3. **Kolko + 15% wystawania**: TAK. `.dam-tut__mascot` / `.dam-tut-invite__mascot`
   to kontener wys. `calc(var(--tut-medal) * 1.18)`; `::before` = biale kolko
   (osobna warstwa, bottom:0, bez overflow:hidden), `::after` = PNG pozy
   (background z var `--dam-tut-pose`, contain, center bottom-5px). Zmierzone
   CDP: overhang 15.2%.
4. **+10px padding**: TAK. Dymek tresci 16/18 -> 26px 28px; panel sterujacy
   10/14 -> 20px 24px (mobile media query 8/10 -> 16px 18px); toast 14/16 ->
   24px 26px. Szerokosci dymkow poszerzone (400->430px, toast 360->390px),
   zaokraglenia bez zmian.
5. Poprawiono tez tytul kroku 1: "Czesc, tu Bobek!" -> "Cześć, tu Bobek!".
   **(C3 Task 39)** dalej: "Cześć, tu DobroKaloriuś!".

## (c) Pliki i podpiecia

Nowe/wlasne pliki STREFY C:
- `apps/web/assets/js/dam-tutorial.js` (IIFE, `window.DamTutorial`)
- `apps/web/assets/css/dam-tutorial.css`
- `apps/web/scripts/cut-mascot-sprite.py`
- `apps/web/assets/img/maskotka/pose-1.png` ... `pose-9.png`

Podpiecia (wszystkie 9 HTML, po `dam-app.css` / przed `</body>`):
`dashboard.html`, `index.html`, `explorer.html`, `branding.html`, `inbox.html`,
`visualizations.html`, `integrations.html`, `costs.html`, `invoices.html`
- AKTUALNE WERSJE (po C3): `dam-tutorial.css?v=3`, `dam-tutorial.js?v=8`.

## (d) Struktura kodu dam-tutorial.js

- Klucze localStorage/sessionStorage: `damTutorialSeen` (1 = nie pokazuj toastu),
  `damTutorialPhase` ("faza:krok", np. "1:0" = wznowienie po nawigacji),
  sessionStorage `damTutorialNotNow` (1 = nie pokazuj toastu w tej sesji).
- Pozy: `POSE_FILES` (standard=1, explain=2, happy=3, joy=4, present=5, think=6,
  wave=7, approve=8, zen=9), `applyPose(el, name)` ustawia CSS var
  `--dam-tut-pose` na PELNY URL (new URL wzgledem location.href - patrz pulapka 1).
- Fazy: tablica `PHASES` (9 faz = 9 pozycji sidebara, kazda `steps[]` z
  `target` = lista selektorow fallback, `pose`, `title`, `text`).
- Kluczowe funkcje: `boot()` (init + wznowienie z damTutorialPhase),
  `showInvite()` (toast), `start()`, `endTutorial()`, `renderStep()`,
  `moveSpotlight(rect)`, `buildOverlay()`, `injectHelpEntry()` (polling na
  #damHelpModal), `loadGsap()` (wzor z dam-grid-reveal.js), obsluga klawiatury
  (ArrowLeft/Right, Esc), click-capture z pochwala.
- API publiczne: `window.DamTutorial.start()` (+ wewnetrzne metody nie sa
  eksponowane - w testach klikac `.dam-tut__btn--next` itd.).
- DOM: `#damTutorialOverlay` (z-index ~14000), `#damTutorialInvite`,
  klasy `dam-tut__bubble`, `dam-tut__mascot`, `dam-tut__ctrl`, `dam-tut__spot`,
  przyciski `dam-tut__btn--prev/--next/--skip/--end`.

## (e) Pulapki dla nastepcy

1. **url() w CSS custom property**: relatywny `url('assets/img/...')` ustawiony
   JS-em w inline style rozwiazywal sie NIEPOPRAWNIE (2x 404 wzgledem
   assets/css/). Fix: `applyPose` buduje absolutny URL przez
   `new URL(path, location.href)`. Nie wracac do relatywnych.
2. **Cursor selection mode blokuje klikniecia**: w karcie przegladarki z aktywnym
   trybem zaznaczania Cursora syntetyczne clicki sa ubijane
   (stopImmediatePropagation w capture). Testowac w SWIEZEJ karcie i podawac
   `viewId` przy screenshotach (stale-frame!).
3. **Screenshot ma skale ~1.6x** wzgledem wspolrzednych CSS z CDP - przy
   cropowaniu Pillow mnozyc wspolrzedne przez (szer. pliku / szer. viewportu).
4. **Rownolegli agenci bumpuja ?v= w tych samych HTML** - edycje HTML robic
   StrReplace/regex tylko na wlasnym pliku (dam-tutorial), nie dotykac cudzych.
5. `window.DamTutorial.next()` NIE istnieje publicznie - w testach klikac
   przycisk `.dam-tut__btn--next`.
6. Sprite zrodlowy `maskotka-bobek.png` to w rzeczywistosci JPEG - dlatego
   przezroczystosc robi skrypt Pillow, nie sam plik.

## TODO dla nastepcy (nie zrobione przeze mnie)

1. Przelot weryfikacyjny faz 3-9 (wizualizacje, branding, projekty, wiadomosci,
   faktury, koszty, integracje) - selektory targetow sa wpisane, ale fazy 3+
   nie byly ogladane screenshotem po dogrywce maskotki.
2. Test pochwaly (klik w tresc strony podczas samouczka) po zmianach maskotki.
3. Wpis do `process.md` (sekcja "STREFA C samouczek 2026-07-20") oraz lekcje
   do `agents/shared/code-doctrine.md` sekcja 12 (min. pulapki 1-3 z tej listy).
4. Ewentualny commit (user decyduje).
