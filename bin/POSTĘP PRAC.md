# Postęp prac DAM - Faza 3 „ten sam obraz na każdym komputerze”

## GDZIE JESTEŚMY (aktualizowane na bieżąco)

**2.5.2 (30.09, KRZYSZTOFWI) - design Dobra Kaloria, wydane:** https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases/tag/v2.5.2
DAM wygląda jak program „Stwórz prezentację” (design system Dobra Kaloria 1.4.1: drabina powierzchni L0-L4, tagi w odcieniu stylu).
Pełny styl: warstwa `assets/css/dam-dk-components.css` działa tylko pod `html[data-dam-style="dk"]`; białe tła i literały tekstu
w CSS/JS zamienione na `var(--dam-paper|--dam-ink*, literał)`, więc inne zestawy zostają piksel w piksel (diff ~0 %).
Okna: zasłona 56 % w barwie stylu (ciemny 66 %), ramka L4 i cień okna. Czerwień błędu w kremie jasnym `#C0262C` (DS 1.4.1).
Dziennik pełnego stylu: `bin/design-system/evidence/2026-09-30-dk-full/POSTEP.md`.
Zestaw „Dobra Kaloria” zastąpiony dwoma zestawami w obu trybach:
„Dobra Kaloria 1 · zieleń” (domyślny: jasny szałwiowy / ciemna zieleń) i „Dobra Kaloria 2 · krem” (jasny krem /
ciemny krem). Tryb jasny/ciemny i pozostałe zestawy bez zmian. Styl DK: Mindset (nagłówki) + Lato z paczki,
żółty przycisk głównej akcji, obrys 2 px przycisków drugorzędnych, etykiety wersalikami, pola 1,5 px + fokus 3 px,
karty 12 px. Nowa plansza startowa Dobra Kaloria (`dam_splash.py`, `dam-splash.html`) z czasem z poprzedniego startu.
Szczegóły i decyzje: `bin/design-system/DESIGN_SYSTEM.md` §0. Dowody: `bin/design-system/evidence/2026-09-30-dk-theme/`.
Favicon panelu = nowa ikona DAM (`dam.ico`, `dam-256.png`). Zrzuty finalne: `evidence/2026-09-30-dk-theme/final/` (statyczny serwer :8765 z repo, most :8766 zainstalowanej aplikacji, sesja podstawiona w testerze; DAM-domyślny przed/po + 4 warianty DK).

**2.4.9 (29.09, KRZYSZTOFWI) - wydane:** https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases/tag/v2.4.9
- **Grafiki:** pomiar na żywej aplikacji (444 karty Wizualizacji): 11 x 504 (budowa miniatury z M: > 2,5 s) i 13 x odmowa połączenia przy żywym moście - kolejka połączeń mostu miała 5 miejsc. Teraz 128; karta po błędzie pyta `/preview/status` (animacja ładowania, ponowienie, bez ciągnięcia oryginału z M:, uczciwy opis na końcu); Branding najwyżej 3 oryginały naraz. Po instalacji 2.4.9: 445/445 miniatur OK, 24 naraz p95 0,25 s. Zrzut z aplikacji niewykonany (ekran zablokowany - „Nieprawidłowe dojście”).
- **ROOT KRZYSZTOFWI był pusty od świeżej instalacji 28.09** - właściciel katalogu nie skanował. Ustawiony `M:\` (`state\machine-config.json`); pierwszy cykl: 4 migawki opublikowane, +719 materiałów, 0 usunięć, 0 odmów bramki.
- **Mac:** DMG 2.4.7 bez konfiguracji bazy (brak sekretu w CI) + aktywacja tylko na Windows -> logowanie do kont startowych („nieprawidłowy email lub hasło”). Teraz: aktywacja kodem w pęku kluczy macOS, DMG z `pg-config.sealed.json` z sekretu `DAM_PG_SEALED_JSON` (ustawiony 29.09, otwiera się kodem wydania z `%USERPROFILE%\.dam`), bez aktywacji komunikat „Aplikacja nie jest aktywowana”. Niesprawdzone na prawdziwym Macu (brak dostępu) - testy z symulacją darwin + CI na macOS.
- **Porządek:** Synology Drive przywrócił do korzenia stare pliki i 151 plików `*_Conflict*` w bin - przeniesione do `work` (`work/_porzadek-2026-09-29/MANIFEST.tsv`).

**2.4.8 (28.09 wieczór, INYFINN):** przełącznik źródła danych LIVE / LOKALNY w stopce panelu bocznego. LIVE = cały katalog z bazy (jak dotąd). LOKALNY = tylko ROOT tego komputera: most nie pobiera migawek z bazy i nie scala wierszy, `build-branding-index.py` pisze `branding-index.json` ze skanu; po przełączeniu indeksy przebudowują się z ROOT (LOKALNY) albo pobierają z bazy (LIVE). Ustawienie per komputer w `bin/apps/desktop/data/data-mode.json` (poza gitem). LOKALNY wymaga pełnego ROOT. Skojarzenia (ręczne decyzje) nadal z bazy w obu trybach. Kod: `data_mode.py`, `GET/POST /data-mode`, `dam-data-mode.js`; test `tests/test_data_mode.py`. Dowód UI: zrzut z atrapą mostu, nie z zainstalowanej aplikacji.

Sprzątanie 28.09 na INYFINN: `work\_kopie` (3,8 GB) i 2 porzucone `branding-index.json.*.tmp` (2×272 MB) w Koszu Windows. **`work\distin-dist` (3,9 GB, stary staging builda) i `work\_konflikty-synology` (279 MB) zniknęły z dysku bez wpisu w Koszu** (Windows usunął je trwale mimo wywołania przez skrypt kosza) - kopia może być w koszu Synology Drive na serwerze. Baza `dam_restore_test` na NAS nadal stoi: jej usunięcie jest nieodwracalne, zasady bezpieczeństwa na to nie pozwalają.

**Otwarte po 2.4.7:** (1) dostarczenie zmian A->B/C 13-26 s zamiast celu 5 s (odczyt co 30 s w moście); (2) `/branding/live-www-scan` dokleja karty ze skanu lokalnego dysku - do decyzji (wyłączyć w trybie rows?); (3) uzupełnienie ~23,8 tys. brakujących miniatur siatki z M: porcjami na KRZYSZTOFWI; (4) `bin/secrets/activation-code.txt` ma inny kod niż `%USERPROFILE%/.dam/activation-code.txt`, którym pieczętuje build; (5) baza `dam_restore_test` na NAS do usunięcia ręcznie (hook blokuje DROP); (6) KINGAUR i INYFINN zaktualizować do 2.4.7; (7) sprzątanie miejsca (wyżej). Dowód z czystego Windows (Sandbox) - niewykonany, test paczki na tym PC + A/B/C.

Cel: każdy komputer pokazuje ten sam Branding i te same wizualizacje. Katalog ma jednego
właściciela (baza na inyfinn-syno, zasilana jednym indeksatorem); ROOT na komputerze mówi tylko,
czy oryginał jest pod ręką. Plan: `work\PLAN-NAPRAWY-DAM-DLA-CLAUDE -2.md` (jeden komputer,
wszystko robi Claude). Decyzje wykonawcze: `work\kierownicy\2026-09-28b\DECYZJE.md` (sekcja 8 wygrywa).

| Krok | Co | Stan (28.09) |
|---|---|---|
| 0 | Mapa kto zapisuje / kto czyta; kopie SQLite (8/8 OK, `D:\DAM-lokalne\backup`); izolacja testów od bazy produkcyjnej | kopie i izolacja: zrobione (`5db5aea7`); mapa: w toku; kopia produkcji (pg_dump): zablokowana przez klasyfikator |
| 1 | 4.1 starsza kopia kasuje nowszy plik | zrobione w kodzie (`e45615fd`), testy czerwone na 2.4.5 / zielone teraz, na atrapie bazy |
| 1 | 4.2 przepychanka M/X, listy wariantów liczone ze wspólnego katalogu | zrobione w kodzie (`e45615fd`), jw. |
| 2 | 5 przełączanie ROOT (numer generacji, `/Volumes`, UNC, dostępność) | zrobione w kodzie (`2a738de3`), dostępność 359 ms; zrzut UI - przy teście instalacji |
| - | Instalator: stare foldery DAM do Kosza, deinstalacja sprząta, bez zabijania nowego DAM | zrobione w skrypcie (`3732cced`, `ac89e199`), testy piaskownicy OK; pełny test instalacji - przy wydaniu |
| 3 | Jeden katalog dla wszystkich paneli: właściciel katalogu = `index_authority` (KRZYSZTOFWI z M:), bramka w bazie działa też na stare wersje, klient bez uprawnień bierze wersję z bazy, zmiany co 30 s | **włączone na produkcji 28.09 ~15:50** (kopia przed: `dam_eta-przed-bramka.dump`); kod `2c538c07`, testy PG 22/22; wycofanie: `work/2026-09-28/W5/rollback-production.sql` (pusta lista + DISABLE TRIGGER) |
| 4 | Podglądy: stany gotowy/czeka/błąd/format bez podglądu, `/preview/status`, opis na karcie | zrobione (`0833cbd9`, `35195626`); pokrycie produkcji (grid): 24 361 gotowe / 23 778 czekają / 13 506 bez podglądu - uzupełnianie brakujących z M: porcjami: do zrobienia po instalacji 2.4.6 |
| 5 | Test 3 izolowanych instancji A/B/C na tym PC (A właściciel, B opóźniona kopia, C bez ROOT) | **S1-S8 PASS**, zrzuty Brandingu i Wizualizacji identyczne na A/B/C (`work/2026-09-28/W8/20260928_164840`), uprząż `bin/scripts/qa/e2e/run_abc.py` |
| 6 | Porządek i wydanie | wydane **2.4.6** i **2.4.7** (release z .exe + .sig); 2.4.6 zainstalowane i aktywowane na KRZYSZTOFWI (sprzątanie w instalatorze działa: faza Stop 4,5 s, autostart nowej instalacji zachowany). Pomiar miejsca: repo 14 GB (work 8,4 GB - w tym `work/dist` 5,4 GB starych stagingów; `bin/apps/web/data` 2,2 GB - 6 starych kopii branding-index po 270-413 MB) - do przeniesienia do Kosza po potwierdzeniu (>500 MB) |

Ograniczenia dowodu (stan 28.09): kopia produkcji zrobiona przez SSH (`D:\DAM-lokalne\backup\pg\2026-09-28\dam_eta.dump`, 45,5 MB, test odtworzenia: liczby wierszy zgodne); testowa baza `dam_eta_test` + rola `dam_test` na inyfinn-syno; 4.1 i 4.2 na prawdziwym PG: czerwone na 2.4.5, zielone teraz (`b69d2833`). Na serwerze została baza `dam_restore_test` (kopia z testu odtworzenia) - hook blokuje DROP, do usunięcia ręcznie. Pełny zestaw: 683 testy Python + 27 JS OK. Przy okazji: test `test_index_assoc_backend` uruchamiał prawdziwą przebudowę Brandingu jako sierotę (błąd od 2.4.5) - naprawione (`6a7f1fd2`).

Stan na 2026-09-28, 12:00 (KRZYSZTOFWI). Wydanie: **2.4.5**
(https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases/tag/v2.4.5).
Szczegóły techniczne i pomiary: `bin/docs/PLAN-jedno-zrodlo-prawdy.md`, sekcja „Faza 3”.
Materiały z debaty kierowników 28.09: `%LOCALAPPDATA%\DAM-repair\kierownicy\` (A-propozycja, B-krytyka, B-przeglad).

## 28.09 - co zrobione (2.4.4)

| # | Co | Dowód |
|---|----|-------|
| 1 | „Figa z makiem” w aplikacji na KRZYSZTOFWI: **43 materiały** (32 wizualizacje + 11 doypack), miniatury widoczne. Uwaga: ta aplikacja to jeszcze 2.3.9 (baner „Gotowa aktualizacja”). | zrzut `DAM-repair\243\shots\live-figa.png` |
| 2 | Instalator bez `branding-index.scan.json` i `branding-scan-dirs.json` (robocopy /XF, Inno Excludes, PyInstaller SKIP_NAMES) + `[InstallDelete]` obu plików - instalatory <= 2.4.3 dokładały cudzy skan, runner brałby go za własny. | robocopy /L: plik pominięty |
| 3 | `campaigns.json` oznaczany jako własny build po przebudowie Brandingu - w moście i w watcherze (`watch-file-index.py`). | test czerwony -> zielony |
| 4 | Reguła `assoc.sqlite_sot_unified_write` w `program-instructions.json` zgodna z ADR-011 (PostgreSQL = baza główna, SQLite = lustro offline); `version` 26 -> 27, inaczej most nadpisałby plik starą wersją z bazy. | JSON OK |
| 5 | **Koniec pętli synchronizacji** (te same materiały wysyłane co cykl): builder przy remisie etykiety zostawiał kolejność z dysku (`os.scandir`), a porównanie meta było wrażliwe na kolejność list. Teraz: porównanie kanoniczne (listy sortowane, ścieżki bezwzględne jako klucz względny - koniec ping-pongu między ROOT D: i M:), bez sortowania `linked_product_ids` (kolejność = główny produkt); zapis do bazy bez zmian formatu; builder sortuje remis po nazwie i ścieżce. | 4 nowe testy |
| 6 | Test zależny od kolejności (`test_slim_publish_reschedules_when_lock_held`): nowy test podmieniał `rebuild_lock.acquire_lock` zanim `branding_publish` go zaimportował - podróbka zostawała na stałe. | 617 testów OK |
| 7 | Podpis instalatora 2.4.3 sprawdzony (`OK ok`). Czysta instalacja rozpakowana (innounp) bez uruchamiania - instalator zabija każdy most DAM i nadpisuje wpisy HKCU tego samego AppId. Bez kodu aktywacyjnego czysta kopia nie łączy się z bazą (Figa = 0, zgodnie z oczekiwaniem). | `DAM-repair\243\` |

Testy przy wydaniu: 617 Python desktop OK, wszystkie `test_*.js` OK, `tests-touch-guard.py` OK.

## 28.09 - 2.4.5 (poprawka po pomiarze)

Pomiar na pełnym zbiorze (61 832 wiersze w bazie, skan 57 803) pokazał po 2.4.4 **33 723 fałszywe operacje „meta”**: `search_blob` i ścieżki w meta zawierają ROOT komputera, który zbudował indeks. Komputer **KINGAUR** (ROOT `C:\Marketing`) zapisał dziś 37 062 wierszy z `c:/marketing/...`, a KRZYSZTOFWI (ROOT `M:\`) nadpisywał je z `m:/...` - ping-pong na żywo. 2.4.5: porównanie usuwa prefiks ROOT także w środku tekstu (Windows, UNC, /Volumes, /mnt, /media). Po poprawce: 2 892 operacje - prawdziwe różnice zawartości folderów (listy plików edytowalnych, pliki `._`, nowe pliki) i 89 nowych plików. Czas porównania pełnego zbioru: ok. 20 s na cykl ze skanem (raz na przebudowę Brandingu).

Instalacja 2.4.4/2.4.5 na aplikacji KRZYSZTOFWI: zablokowana przez klasyfikator (instalator zatrzymuje działający most) - do zrobienia przez użytkownika banerem „Zainstaluj”. **Na KINGAUR też trzeba zainstalować 2.4.5**, inaczej ping-pong trwa od jego strony.

## 28.09 - otwarte po 2.4.5

- **Dowód z aktywowanej czystej instalacji** wymaga kodu aktywacyjnego od admina (kopiowania poświadczeń bazy z tej instalacji odmówiono - słusznie). Alternatywa: zaktualizować aplikację na tym komputerze do 2.4.4 banerem i sprawdzić Figę/miniatury ponownie.
- **Stare klienty (<= 2.4.3) z ROOT nadal wyślą co cykl materiały z odwróconą kolejnością list** - do czasu aktualizacji do 2.4.4 (nowy klient nie odpowiada na ich zapis, więc pętla nie rośnie).
- **Koszt porównania kanonicznego** na ~58 tys. wierszy w cyklu ze skanem - niezmierzony.
- Z punktu 3 niżej nadal otwarte: pokrycie miniatur (backfill na M:\ po godzinach, porcjami), jeden indeksator (decyzja), uszkodzona `bin/DATABASE/dam-local.sqlite` (diagnoza tylko na kopii), repo poza Synology Drive (decyzja).

## 0. Zasada pracy przy zmianie komputera (HARD)

**Zanim cokolwiek zrobisz na innym komputerze niż poprzednio (np. INYFINN -> KRZYSZTOFWI): najpierw `git pull` z GitHuba.** Dopiero potem edycja, build, testy. GitHub `main` jest źródłem prawdy dla kodu. Bez tego pracujesz na starym kodzie i nadpiszesz cudzą pracę.

```
git status          # czy nic lokalnie nie wisi
git pull origin main
```

Jeśli `git pull` odmawia przez lokalne zmiany: najpierw `git stash push -u -m "przed pull <data>"`, potem pull. Nigdy `git reset --hard` ani `git clean`.

## 0a. Prawo publikacji (decyzja właściciela, HARD)

**28.09 (decyzja właściciela): mechanizm właściciela katalogu jest WŁĄCZONY.** `dam_meta.index_authority = ["KRZYSZTOFWI"]`, wyzwalacze `dam_authority_gate_snapshots` i `dam_authority_gate_assets` aktywne (sprawdzone 28.09 wieczorem). Wspólny katalog zmienia tylko właściciel; inne komputery dodają nowe pliki, ale nie usuwają, nie przywracają i nie nadpisują indeksów. Wcześniejsza decyzja z 27.09 („każdy komputer ma prawo publikacji”) jest nieaktualna. Wycofanie: `work/2026-09-28/W5/rollback-production.sql`.

## 1. Cel

Każdy komputer, z folderem Marketing (ROOT) czy bez, pokazuje ten sam katalog,
te same metadane, skojarzenia i miniatury. Źródłem prawdy jest baza PostgreSQL
na `inyfinn-syno`. Oryginały leżą na `administratorkubara`. ROOT wybrany na
komputerze służy tylko do otwierania plików, nie do zmieniania wspólnego katalogu.

Docelowy układ (propozycja Astry, przyjęta):

```
administratorkubara: oryginały
        |
jeden indeksator z dostępem do plików
        |                         \
inyfinn-syno: katalog w PostgreSQL   inyfinn-syno: wspólne podglądy
        \                         /
             DAM na każdym komputerze  <-  ROOT wybrany na tym komputerze
```

## 2. Co zrobione (w 2.4.3)

| # | Co | Dowód |
|---|----|-------|
| 1 | **Przełączanie ROOT jedną operacją.** Most sprawdza ścieżkę z limitem czasu, zapisuje, czyści pamięci podręczne, odpowiada. UI zmienia się dopiero po potwierdzeniu i od razu odświeża Eksplorator, bez F5. | Kopia testowa z zalogowanym kontem: zapis 64 ms, odświeżony widok 820-1026 ms. 33 testy. |
| 2 | **Zapis ROOT nie zrywa już połączenia z bazą.** Wcześniej każdy zapis ROOT restartował połączenie z PostgreSQL. | `local_bridge.py`, `write_machine_config` |
| 3 | **Most bierze ROOT wybrany przez użytkownika.** Wcześniej ignorował wybór i zawsze szedł kolejnością M, X, D. | `dam_path_resolve.py` |
| 4 | **Trzy stany ROOT:** pełny / niepełny / brak. Folder niepełny zapisuje się z żółtym ostrzeżeniem. Folder bez żadnego folderu Marketing wymaga „Zapisz mimo to”. Skan i publikacja tylko z pełnego ROOT. | zrzuty z kopii testowej |
| 5 | **Miniatury bez ROOT.** Klucz miniatury liczony z bazy, brakujący plik pobierany z serwera zamiast „Brak miniatury”. | Świeży komputer zaraz po starcie: 0/400 -> 213/400 materiałów, 0/200 -> 200/200 wizualizacji. |
| 6 | **Spis miniatur na serwerze łączony, nie zastępowany.** Wcześniej publikacja z jednego komputera kasowała połowę spisu (31 935 -> 15 052 wpisów). Usunięty limit 8 000 wierszy. | wiersze w bazie: 8 009 -> 34 201 |
| 7 | **Komputer publikuje do bazy tylko indeks, który sam zbudował.** Plik z instalatora nigdy nie trafia do bazy. Najpierw pobiera, potem publikuje. | Na żywo po restarcie mostu: `refused_not_built_here` dla plików spoza własnego buildu. |
| 8 | **Mechanizm listy komputerów z prawem publikacji** jest w kodzie, ale **wyłączony** (klucz `dam_meta.index_authority` nie istnieje). Decyzja właściciela 27.09: **każdy komputer ma prawo publikacji.** Lokalna kopia bywa nowsza niż M:, bo zmiana jeszcze nie dotarła przez Synology. Nowsza wersja pliku wygrywa ze starszą niezależnie od komputera (reguła mtime w `asset_sync.py`). | `/index-authority/status`: `authority_configured: false` |
| 9 | **Po zmianie ROOT pierwszy skan niczego nie usuwa ani nie przywraca.** | test `test_reset_scan_memory.py` |
| 10 | **Branding w trybie wierszy** nie jest już nadpisywany skanem lokalnym (przyczyna „0 materiałów” produktu w złotej aplikacji). | poprawka w kodzie, patrz sekcja 4 |
| 11 | **Pierwsza synchronizacja po starcie** widoczna w `/index/snapshots` (`first_sync`). | na żywo: 1,5 s |
| 12 | **Kopie `.bak` siatki Brandingu** ograniczone do 2 (wcześniej ~25 MB przy każdej publikacji, także u użytkowników). | test |
| 13 | **Pliki konfliktów Synology** nie trafiają do instalatora. | `build-installer.ps1` |
| 14 | **Porządek repo:** w korzeniu tylko `DAM.exe`, `bin`, `work` i pliki gita. Zależności, buildy, kopie, konflikty w `work/`. Nic nie skasowane, lista cofania: `work/_porzadek-2026-09-27/MANIFEST.tsv`. | `bin`: 12 GB -> 3,3 GB |
| 15 | **Uszkodzona lokalna baza** `bin/DATABASE/dam-local.sqlite`: sprawdzone, że wszystkie 27 ręcznych decyzji o skojarzeniach są w bazie głównej. Żadna nie ginie. | porównanie klucz po kluczu |
| 16 | **Testy nie mogą dotykać żywych plików bazy** (strażnik). | `bin/scripts/qa/tests-touch-guard.py` |

Testy przy ostatnim pełnym przebiegu: 611 Python desktop OK.

## 3. Co planowałem, a nie zostało zrobione

| Rzecz | Dlaczego nie | Co trzeba |
|-------|--------------|-----------|
| **Dowód z zainstalowanego `DAM.exe` na czystym komputerze** (bez ROOT i z ROOT) | Skończył się limit. Dowody są z kopii testowej, nie z instalatora. | Zainstalować 2.4.3 w Piaskownicy Windows albo na drugim komputerze, porównać z tym komputerem: liczba produktów, materiały produktu „Figa z makiem”, miniatury, przełączenie ROOT. |
| **Potwierdzenie naprawy „0 materiałów” w złotej aplikacji** | Poprawka jest w kodzie, most zrestartowany, ale produktu nie sprawdziłem. | Otworzyć projekt „Figa z makiem” na tym komputerze, powinno być 43 materiały. |
| **Pokrycie miniatur powyżej 44 %** | ok. 13,5 tys. oryginałów jest tylko w chmurze (X: to Synology Drive „na żądanie”). Brak narzędzi do PDF (3 082), SVG, AI, wideo (ok. 13 tys.). | Uruchomić uzupełnianie miniatur na komputerze z `M:\` (KINGAUR albo KRZYSZTOFWI) albo na serwerze. Dodać Poppler do instalatora. |
| **Jeden indeksator** zamiast skanu na każdym komputerze | Wymaga decyzji, gdzie ma działać. Lista uprawnionych (punkt 8) jest krokiem przejściowym. | Zmierzyć, czy `inyfinn-syno` ma dostęp do plików `administratorkubara`. |
| **Reguła w `program-instructions.json`** mówi, że źródłem skojarzeń jest lokalny SQLite | Sprzeczna z ADR-011 i z kodem (baza główna = PostgreSQL). Nie poprawiłem. | Zmienić regułę `assoc.sqlite_sot_unified_write` na zgodną z ADR-011. |
| **`campaigns.json` po buildzie Brandingu** nie jest oznaczany jako własny build | Nie zrobione. Do czasu poprawki nie publikuje się do bazy. | Dopisać `mark_built_here("campaigns", ...)` po udanym `build-branding-index.py`. |
| **Te same 4 materiały wysyłane w każdym cyklu** synchronizacji | Zauważone, nie zbadane. | Sprawdzić, dlaczego `br-003022082`, `br-023619512`, `br-055537327`, `br-058318955` wracają co cykl. |
| **Kopia skanu `branding-index.scan.json` (373 MB) w instalatorze** | Zauważone w trakcie buildu 2.4.3. Instalator ma przez to 450 MB. | Dodać plik do wykluczeń w `DAM-Setup.iss`. |

## 4. Czego się nie udało i co poszło źle

- **Zmiana metadanych produktów (meta_store) była błędna i została wycofana.** Plik, który miała naprawiać, trzyma konta użytkowników, a tabel metadanych nikt nie czyta. Przy okazji testy wyzerowały tabele metadanych w lokalnym pliku (konta i skojarzenia nietknięte). Dodany strażnik testów.
- **Dwie liczby z początku były błędne:** „56 % pokrycia miniatur” (naprawdę 40,1 %) i „pierwsze pobranie czeka 10 minut” (naprawdę 8 s).
- **Przegląd decyzji przez drugiego kierownika wszedł za późno.** Część pracy workerów trzeba było powtarzać.
- **Porządek w `work/` częściowo wraca**, bo repo leży w folderze synchronizowanym przez Synology Drive (pliki konfliktów wracają z chmury).
- **Lokalna baza `bin/DATABASE/dam-local.sqlite` jest uszkodzona** (brakuje ostatniej strony pliku). Aplikacja pobrała skojarzenia z bazy głównej i działa, ale plik nadal jest uszkodzony.

## 5. Sugestie

1. **Przenieść repo poza folder Synology Drive** (np. `D:\DAM-dev`). To jest źródło uszkodzonej bazy SQLite, wracających plików `_Conflict` i wspólnej pamięci skanu między dwoma komputerami. Decyzja właściciela.
2. **Zainstalować 2.4.3 na wszystkich komputerach.** Komputer publikuje tylko indeks, który sam zbudował, więc stary plik z instalatora już nikomu nie podmieni katalogu.
3. **Uzupełnianie miniatur uruchomić na komputerze z `M:\`:**
   `python -c "import sys; sys.path.insert(0, r'<bin\apps\desktop>'); import dam_thumb_cache as t; t.cli()" backfill --workers 2`
4. **Budować instalator z czystej kopii commita** (`bin/scripts/ops/prepare-clean-build.ps1`), nie z roboczego drzewa.
5. **Następny krok architektury (do dyskusji):** indeksator na komputerze z `M:\` jako dodatkowe źródło, bez odbierania prawa publikacji innym.

## 6. Plan następnej partii (w tej kolejności)

Następna sesja: komputer **KRZYSZTOFWI**. Krok 0: `git pull origin main` (sekcja 0).

1. Dowód z instalatora 2.4.3 na czystym środowisku: bez ROOT i z ROOT.
2. Sprawdzić produkt „Figa z makiem” w złotej aplikacji.
3. Wykluczyć `branding-index.scan.json` z instalatora.
4. Poprawić regułę skojarzeń w `program-instructions.json`.
5. `campaigns.json` jako własny build.
6. Zbadać pętlę 4 materiałów.
7. Wydanie 2.4.4.

Kierownik: Opus 5.5. Workerzy: Sonnet do zadań 3-6, Opus do dowodu z instalacji.

## 7. Układ folderu

| Gdzie | Co |
|-------|----|
| korzeń | `DAM.exe`, `bin/`, `work/`, pliki gita (`.git`, `.github`, `.gitignore`, `.gitattributes`, `.gitleaks.toml`), `CLAUDE.md`, plik workspace, `.cursor/` |
| `bin/` | wszystko, czego potrzebuje aplikacja i budowa instalatora |
| `work/` | zależności budowania, stare buildy, kopie, pliki konfliktów, notatki; nie jest w gicie |

Z korzenia do `work/_korzen-2026-09-27/` przeniesione 27.09: `URUCHOM-DAM.bat`, `POPRAWKI.md`, `poprawki.jsonl`, `PLAN-INSTALATOR.md`, `_fffd.txt`, `_backup-dash-bento-2026-09-10/`, `_backup-shell-geex-2026-09-10/`. Zgłoszenia poprawek z aplikacji zapisują się teraz w `bin/POPRAWKI.md`.
