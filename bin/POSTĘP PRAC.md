# Postęp prac DAM - Faza 3 „ten sam obraz na każdym komputerze”

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

**Nikomu nie odbieramy prawa do publikacji.** Dysk M: jest najwierniejszy, ale lokalna kopia na komputerze bywa nowsza, zanim Synology dowiezie zmianę na M:. Rozstrzyga data pliku (nowsza wygrywa), nie komputer. Mechanizm `index_authority` zostaje w kodzie wyłączony. Nie włączać bez wyraźnej decyzji właściciela.

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
