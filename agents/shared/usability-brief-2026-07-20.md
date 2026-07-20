# Brief usera: usability 2026-07-20 (ZRODLO PRAWDY dla biezacej rundy napraw)

## HARD POLICY (2026-07-20) - model agentow
**TYLKO GROK:** `cursor-grok-4.5-high-fast` (Grok 4.5 high). Zakaz Opus i Fable
(`claude-opus-*`, `claude-fable-*`) - agenci, Task tool, subagenci. Wszedzie.

## STATUS SYNTEZA (2026-07-20 wieczor) — nie inventuj zieleni

Legenda: **DONE** = agent + CDP/screenshot; **PARTIAL** = UI/kod OK, luka danych/policy;
**OPEN** = nie domkniete. Pelny log: `process.md` (wpis syntezy) +
`agents/shared/handoff-usability-synthesis-2026-07-20.md`.

| Zakres | Punkty | Status |
|--------|--------|--------|
| A Modale 1–10 | 1–5, 7–10 | **DONE** |
| A6 lustrzane assoc | 6 | **PARTIAL** — UI OK; Postanowienia/DPD nie maja `linked_products`→babka w indeksie |
| B Branding 11–18 | 11–14, 16–18 | **DONE** |
| B15 indeks ARCHIWUM | 15 | **PARTIAL** — META z ARCHIWUM w indeksie (7832→49715→51611); SLIDERY-sklep = 0 sciezek (dedup POLSKA-first, zamierzone) |
| B tabs 21–23 | 21–23 | **DONE** (`usab20260720f` / `g`) |
| C Samouczek | 19, 25–26, 39, 41–42 | **DONE** (DobroKaloriuś, C4) |
| D Bridge Explorer | 20, 24 | **DONE** |
| H Danger UX | 27–32 | **DONE** (H + H3) |
| I Shell FOUC | 33 | **DONE** |
| I A3 viz/Links | 34–38 | **DONE (UI+bridge)**; indekser product_element **DONE**; jakosc POS `\Links\` = **OPEN** |
| I Device paths | 40 | **DONE** (MVP) |
| Integracje hub | (poza briefem num.) | **DONE** skeleton/Bento/Konfiguruj/PLANOWANE/FMCG Edytuj |
| Checklista A3 FMCG fill | — | **PARTIAL** `[~]` — UI Edytuj + polish (80vh scroll-trap, X close, hold-delete, prefs KV); kwoty/import = Ty |
| Viz/Branding/Help chrome (changelog admin, page-size OK, help restart) | (dogrywka) | **DONE** |
| Checklista C3 BENTO kart | — | **OPEN** `[ ]` — anatomia `.dam-viz-card` / `.dam-branding-card` zamrozona |

Zapis doslownych wymagan usera z 2026-07-20 (po pierwszej iteracji planu
`dam_usability_repair`). NICZEGO nie pomijac. Kazdy punkt = zadanie.

## A. Modale globalne / wizualizacje / skojarzenia (STREFA A)

1. **Historia statusow - redesign modala.** Obecny modal to golo-tekstowa lista
   ("wyglada strasznie biednie, brak sensownego interfejsu"). Wymagany porzadny
   interfejs: os czasu / tabela, kolorowe chipy F/X/D (`dam-lifecycle-chip--f/x/d`),
   struktura wpisu (data, zakres, indeks, produkt, autor), sensowne akcje.
2. **Studio w #damMediaPreview - napisy.** Poprawic etykiety typu "PERSP:" (pelne,
   ladne slowa), chip "Z tlem JPG" ma miec rozszerzenie po "•" w JEDNEJ linii,
   a nie lamane pod spodem.
3. **Chipy studia = globalny styl tagow.** `dam-media-preview__studio-chip` ma
   wygladac jak globalne tagi (`dam-viz-badge` / `dam-badge-tag`), nie osobny styl.
   Tagi sa globalne i jednolite wszedzie. Pamietac o animacjach (reveal).
4. **ID marketingowe wizualizacji.** Obecnie pokazuje surowa sciezke
   (`viz-2-WIZKI/KAR6X-...jpg`) - ZLE. Format dla wizek: `V-<INDEKS>-<PERSPEKTYWA>-<SKALA>-<DATA>`.
5. **Kopiowanie ID.** Prawy klik / kopiowanie chipu ID kopiuje stary `br-xxxxx`
   zamiast widocznego `M-IMG...`. Ma byc TYLKO id marketingowe (rozbieznosc
   wewn./marketingowe jest niepotrzebna z perspektywy usera).
6. **Skojarzenia dwustronne (lustrzane) - GLOBALNIE.** Modal wizualizacji /
   eksploratora musi pokazywac skojarzone materialy brandingowe (jak modal
   brandingu pokazuje produkty). Przyklad: produkt 6300684 (Babka cytrynowa) ma
   skojarzone br-003363 (X:/Marketing/- POLSKA/06 - STRONY WWW - INTERNET/01 -
   Strona Dobra Kaloria/06 - SLIDERY NA GLOWNA/Babka Cytrynowa) oraz
   .../Postanowienia Noworoczne oraz .../DPD PICKUP/DPD Pickup - Swiateczne
   pysznosci wysylka 0 zl. Skoro w brandingu skojarzenie jest, ma dzialac
   lustrzanie wszedzie (viz modal, explorer modal).
7. **Modal wizualizacji = ta sama budowa co modal brandingu.** Tagi, indeksy,
   pelne informacje. Zachowac przyciski DEMO i UKRYJ (specyficzne dla viz),
   upchnac je sensownie. "Dodaj miniature" tylko gdy wariant (indeks) nie ma
   wizualizacji - wtedy pokazac wariant z placeholderem "brak wizualizacji"
   i pozwolic wskazac inna wizke do przekopiowania.
8. **#damThumbPicker - kompletna przebudowa.** Ma byc ladny mini-eksplorator:
   widoki (miniatury / lista / kafelki), przyciski wstecz/dalej/odswiez,
   TAGI przy produkcie, stylistycznie spojny z reszta. Obecny wyglad "masakryczny".
9. **Edytuj wszystko (assoc edit) - wiecej informacji w wynikach.** Kategoria,
   podkategoria, marka, jezyk, indeks + miniatura produktu; hover na miniature =
   powiekszony podglad ~400x400 jako tooltip.
10. **Popover info wariantu (#damVariantInfoPopover).** Ma znikac po ~1.2 s od
    zjechania kursora oraz po kliknieciu gdziekolwiek indziej.

## B. Branding / dashboard / dane / ladowanie (STREFA B)

11. **Dashboard 2x2 wciaz nie jest 2x2** (widget Najnowsze materialy branding
    renderuje 1 kolumne mimo etykiety). Naprawic realnie i zweryfikowac screenshotem.
12. **Karty brandingu: widoczne indeksy.** Na kafelku jest tresc, ale indeksu nie
    da sie skopiowac - indeksy maja byc widoczne przy tytule (np. obok podtytulu),
    kopiowalne. Dotyczy tez wizualizacji - globalne kafelki.
13. **Licznik plikow w rogu karty za malo widoczny** i przyslaniany przez help fab
    (znak zapytania). Poprawic widocznosc/pozycje.
14. **Liczby przy tagach**: pokazywac "XX elementow w XX plikach" (najpierw
    elementy/grupy, potem pliki), nie samo "106 plikow".
15. **Brakujace dane w brandingu**: tag META pokazuje 106, a brak np.
    X:/Marketing/-- ARCHIWUM --/05_Materialy graficzne e-commerce/08 Kampania META
    (glowny folder banerow META). Sliderow jest wiecej niz pokazuje (np.
    X:/Marketing/-- ARCHIWUM --/05_Materialy graficzne e-commerce/05 - SLIDERY - sklep).
    Zbadac indeksowanie (build-branding-index / brand_folder_context) i naprawic
    zakres skanowania + tagowanie.
    *(2026-07-20 PARTIAL: rebuild 7832→49715 (+pe→51611); META ARCHIWUM w indeksie.
    SLIDERY-sklep: 96/96 overlap POLSKA-first — 0 unikalnych sciezek; policy OPEN
    jesli user chce osobne kopie ARCHIWUM w indeksie.)*
16. **Zachowanie tagow**: klik = zastap wybor (anuluj poprzedni), CTRL+klik = dodaj
    do wyboru. Globalnie w tagach wyszukiwarki.
17. **Tooltip tagow**: po 1.5 s hover, fade in (ladna animacja): co znaczy tag +
    ponizej krotka instrukcja o CTRL. Przy sekcji instrukcji CTRL maly przycisk
    "nie przypominaj wiecej" (zapamietane w localStorage) - potem tooltip to tylko
    opis tagu. Globalnie, ale TYLKO w tagach wyszukiwarki.
18. **Ladowanie przy filtrze tagiem trwa do 10 s bez feedbacku.** Zawsze skeleton
    loading + globalna animacja ladowania: najpierw ~1 s na srodku minimalistyczny
    poziomy pasek "wyszukuje", potem plynnie (ease in/out, GSAP) przechodzi do
    prawego dolnego rogu jako nieinwazyjne kolko. Pasek ladowania nie moze byc
    przyslaniany ani niczego przyslaniac. Jedna globalna implementacja - zmiana
    w jednym miejscu zmienia wszedzie.
    *(2026-07-20 DONE hub Integracje: skeleton fill `#ececf2` + hairline w
    `dam-integrations.css`, `?v=skelvis20260720b` - global `--dam-surface-muted`
    byl za bliski canvas.)*

## C. Samouczek (STREFA C)

19. **Interaktywny samouczek** jako nakladka na cala strone:
    - przy pierwszym wejsciu/logowaniu nieinwazyjne pytanie, czy user chce samouczek,
    - prowadzi maskotka Dobrej Kalorii ("bobek" - listek); sprite 3x3 w
      `apps/web/assets/img/maskotka-bobek.png` (pozy: standardowa, tlumaczaca,
      zadowolona, ucieszona, prezentujaca, myslaca, witajaca, aprobujaca,
      ekspert w spoczynku) - wycinac pozy CSS-em (background-position) i dobierac
      mimike do tresci,
    - NIE zmuszac do klikania wskazanego elementu - kierowac, podpowiadac;
      gdy user klika cos innego, komentarz w stylu "ooo, widze, ze lapiesz to w mig!",
    - nawigacja: wstecz / dalej / pomin faze / zamknij - elementy sterujace zawsze
      w tym samym miejscu; 9 faz = 9 pozycji menu (Dashboard, Eksplorer,
      Wizualizacje, Branding, Projekty, Wiadomosci, Faktury, Kalkulator, Integracje),
    - piekny, schludny design, animacje (GSAP), przezroczysta maskotka bez tla.

## D. Bridge / system (STREFA D)

20. **Otwieranie folderu w Eksploratorze Windows (przycisk Folder Windows).**
    Obecnie okno Eksploratora otwiera sie w tle i nie widac go. Wymagane:
    otwierac jako NOWA KARTE w juz istniejacym oknie Eksploratora (jesli jest
    otwarte), a w kazdym przypadku wysunac okno na pierwszy plan (foreground),
    na ile Windows pozwala. Zmiana po stronie `apps/desktop/local_bridge.py`
    (+ restart bridge, zasada A4).

## E. Branding - zakladki sekcji (dogrywka 2026-07-20 16:31, STREFA B)

21. **Zakladka "POKAZ WSZYSTKO" w #dam-branding-tabs.** Pasek zakladek sekcji
    (Kampanie / Social & wideo / Strony WWW / Packshoty / Brandbook) ma dostac
    PIERWSZA, wyroznona zakladke "Pokaz wszystko", oddzielona separatorem od
    reszty. Domyslnie przy wejsciu na branding.html AKTYWNA ma byc "Pokaz
    wszystko" (chyba ze user sam kliknie inna albo URL wymusza tab). Powod:
    tresci "znikaja", bo user nie widzi, ze jest zaklikana waska kategoria.
    Rozwazyc tez wiecej kategorii, jesli dane na to pozwalaja.
    **DONE** (`dam-branding.js?v=usab20260720f` / css `usab20260720g`).
22. **Popup przy dnie listy**: gdy user przewinie na sam dol wynikow (a aktywna
    jest konkretna zakladka, nie "wszystko"), pokaz nieinwazyjny popup
    wyrownany do dolu: "Nie widzisz swojego pliku? Sprawdz, czy masz zaznaczona
    dobra kategorie. Ewentualnie nacisnij Pokaz wszystko" + przycisk
    [Pokaz wszystko] w popupie. Ladny, nienachalny, zamykalny.
    **DONE**.
23. **Przenies "Pokaz archiwum"** (i pokrewne opcje widoku) z paska
    `.dam-branding-filters--meta` tak, by sekcyjne opcje byly logicznie
    pogrupowane - user chce, by przelacznik typu "pokaz wszystko/archiwum" byl
    osobna sekcja przy zakladkach, a nie zakopany w pasku opcji widoku.
    **DONE**.

## F. Bridge - blad file:/// (dogrywka, STREFA D)

24. **Blad "Nie mozna odnalezc file:///D:/---%20INYFINN..."** przy otwieraniu
    folderu w Eksploratorze: sciezka nie moze byc URL-encoded file:// URI;
    do Navigate2/Shell podawac surowa sciezke Windows z backslashami.
    Test obowiazkowy na sciezkach ze spacjami i myslnikami.

## G. Samouczek - polish maskotki (dogrywka 16:48, STREFA C)

25. **Maskotka w dymkach samouczka**: powieksz obraz maskotki o 25%; maskotka na
    przezroczystym tle (bez kremowego kwadratu), pod nia biale kolko, ale
    maskotka WYSTAJE ok. 15% ponad kolko od gory - NIE przycinac jej do kolka.
    Animacje gora-dol (bob) zostawic, jest dobra.
26. **Padding dymkow samouczka**: tresc ma miec wiecej oddechu od krawedzi,
    ok. +10px z kazdej strony (dymek tresci ORAZ panel sterujacy). Ma byc
    czytelniej i bardziej premium.

## H. Destrukcyjne akcje - doktryna UX (nowa strefa, model Opus 4.8)

27. **Hold-to-delete**: akcje destrukcyjne (usun skojarzenie, usun element,
    ukryj?) zamiast dialogu "Czy jestes pewien?" - przytrzymanie ~300-600 ms
    z wizualnym ringiem postepu wokol przycisku (commitment). Klik = podpowiedz
    "przytrzymaj aby usunac".
28. **Nazywaj akcje, nie pytaj**: przyciski potwierdzen destrukcyjnych maja
    etykiete czasownikowa ("Usun skojarzenie", "Usun projekt"), nigdy "Tak/OK".
29. **Pozycja destrukcyjnego przycisku** nigdy tam, gdzie zwykle stoi Confirm
    (pamiec miesniowa) - odsun go od domyslnej pozycji potwierdzenia.
30. **Czerwony = budzet**: czerwony kolor zarezerwowany WYLACZNIE dla akcji
    destrukcyjnych; audyt panelu - inne czerwone elementy (np. zwykle akcje)
    przemalowac na neutralne.
31. **Danger zone**: jesli sa strony ustawien z operacjami nieodwracalnymi,
    wydzielic sekcje w ramce na koncu strony (wzor GitHub).
32. **Cooldown**: tam gdzie mozliwe, usuwanie miekkie z oknem cofniecia
    (toast "Cofnij" 5-10 s) zamiast natychmiastowej destrukcji.
    Zrodlo: reel UX o przyciskach destrukcyjnych (streszczenie od usera).

## I. Dogrywka 17:22 (GROK 4.5 high - user wymaga Grok, nie Opus/Fable)

33. **Flash starego layoutu przy przejsciu miedzy menu.** Przez ulamek sekundy
    podczas ladowania strony (przejscie miedzy pozycjami menu) miga surowy
    placeholder/szablon, jakby pod aplikacja byla stara nakladka. Znalezc zrodlo
    (niezastylowany stan przed zaladowaniem CSS/JS, FOUC, albo stary markup
    widoczny przed hydracja shell) i wyeliminowac (np. wczesny inline critical CSS
    / klasa is-loading na body zdejmowana po init / spójny splash). STREFA SHELL.
34. **"Brak wizualizacji" nie na czerwono** - ma byc wyszarzone (neutralne),
    czytelne. Placeholder wariantu bez wizki. STREFA viz/media modal.
35. **Klasyfikacja LINKS vs materialy (surowe ELEMENTY).** Kwiatki/elementy typu
    flor2, batonik_liscie3_mod2PMS NIE sa gotowymi materialami i NIE powinny byc w
    "Skojarzone materialy". To SUROWE ELEMENTY (kompozycja opakowania). Reguly:
    - LINKS produktu = zawsze SUROWE ELEMENTY. Sciezka wzorzec:
      `...\<INDEKS>\2 - PROJEKT\Links` (pliki psd/psb/tiff/png).
    - Gotowe elementy do uzycia: `...\<INDEKS>\1 - MATERIALY\ELEMENTY` (tag "Elementy").
    - W modalu: dodaj osobna, zwijalna GRUPE "ELEMENTY" (po rozwinieciu), oddzielona
      od gotowych materialow. Elementy mozna tez wyszukiwac przez skojarzenie
      "skladniki" / "owoce" / "owocki" (nie nowy tag globalny, tylko skojarzenie).
    - Rozroznienie proste po sciezce (Links vs 1 - MATERIALY\ELEMENTY).
    *(2026-07-20 DONE UI+indekser product_element + PI
    `branding.element_assoc_skladniki_owoce`. OPEN: jakosc POS `\Links\` w grupie
    ELEMENTY — osobny sweep.)*
36. **Podglad po LEWEJ stronie okna wyszukiwania** (assoc edit / thumb picker):
    panel podgladu ma byc po lewej od listy wynikow wyszukiwania.
37. **Integracja "Inyfinn Image resizer"** (gdy brak elementow): przycisk w modalu
    "Wygeneruj elementy z Links" - po kliknieciu proba otwarcia programu
    `X:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\Inyfinn Image resizer`
    z wypelnionym input = folder Links danego indeksu, output = folder
    `1 - MATERIALY\ELEMENTY`, konwersja PNG kompresja 60%. OSTRZEZENIE dla usera:
    konwersja chalupnicza, elementy moga wygladac slabo; jak niesatysfakcjonujaco -
    poprosic grafikow. Endpoint w local_bridge.py (uruchomienie programu z argami /
    otwarcie z preselekcja plikow - zbadac jak program przyjmuje input; jesli brak
    CLI, otworz program + folder Links). Przycisk pokazuj tylko gdy ELEMENTY brak,
    a Links istnieja.
38. **Bład wyswietlania** w #damMediaPreview (miniatury skojarzonych - puste/zepsute
    obrazki, np. broken img w skojarzonych produktach). Zdiagnozowac i naprawic.
39. **Maskotka: zmien nazwe z "Bobek" na "DobroKaloriuś"** we wszystkich tekstach
    samouczka. STREFA C (dam-tutorial.js). **DONE (C3).**
40. **Sciezka Marketing per urzadzenie (HARD):** zalogowane konto NIE przenosi
    litery dysku miedzy PC (dom X:/, praca D:/). Identyfikacja: hostname /
    device_id (Sesja urzadzenia / `/auth/identity`). Profil: CRUD wpisow
    urzadzen+sciezek; zapis w Postgres `user-device-paths:{email}`. Runtime
    resolve tylko dla **aktualnego** device_id. STREFA DEVICE — handoff
    `agents/shared/handoff-strefa-DEVICE.md`.
41. **Samouczek C4 - dymek/maskotka/anchor:** mniejszy dolny pad, gap maskotka
    36px, kolko +15%, img +10%, zielony cien; kotwiczenie **right + 40px**
    (nie pod sidebarem). STREFA C4. **DONE** - handoff-strefa-C4.md.
42. **Samouczek - 40 pochwal + typografia PL:** pula 40 roznych pochwal
    (shuffle bez powtorzen); `nbspPl` anty-sieroty/wdowy na copy krokow/toast/
    pochwal. STREFA C4. **DONE** - handoff-strefa-C4.md.

## Wspolne wymagania

- Wszystko GLOBALNE: tagi, modale, kafelki, animacje ladowania - jedna zmiana
  dziala wszedzie.
- Petla weryfikacji dam-dobrakaloria: kod -> node --check/CDP -> screenshot+Read ->
  poprawka; min. 3 przeloty na zadanie wizualne.
- Cache-bust `?v=` w KAZDYM HTML ladujacym zmieniony plik.
- Wpisy do process.md; nowe lekcje do code-doctrine.md sekcja 12.
- Referencje obrazkowe usera: assets czatu (screenshoty modali, kafelkow,
  thumb pickera, maskotka 3x3).
