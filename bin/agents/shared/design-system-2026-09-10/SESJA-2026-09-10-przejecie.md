# Sesja 2026-09-10: przejęcie projektu DAM Dobra Kaloria

Sesja z 10 września 2026: przejęcie projektu po poprzednikach, termin 6 godzin, właściciel wymaga aplikacji, po której szef może swobodnie klikać.

Rusztowanie poniżej spina dosłowne sformułowania kierownika z transkryptu czatu (`daa93ecb-3331-4e8a-90d7-7fc07dc7d057`). Kierownik decyduje, co jest skończone. Ten dokument nie ogłasza ukończenia.

Źródło cytatów: wiadomości asystenta (kierownika) w transkrypcie JSONL. Angielskie notatki wewnętrzne pominięto. Hasła i wartości sekretów wycięto; odwołanie wyłącznie do ścieżki pliku.

Liczba cytatów w sekcji „Słowami kierownika”: **16**.

---

## Słowami kierownika

### Przejęcie, termin, stan kanonu

> Mam już twarde dane. Zanim zbuduję plan, muszę od Ciebie dwie decyzje kierownicze — bo one zmieniają, co w ogóle wchodzi w te 6 godzin.
>
> Co już wiem (fakty, nie wrażenia):
> - **Design system istnieje** (`bin/design-system/DESIGN_SYSTEM.md`, 58 KB) ale jego dowody są przypięte do wersji **5.0.178**, a produkt jest na **5.0.195** — kanon jest przestarzały o 17 wersji.
> - **Twój defekt ze screena jest w kanonie opisany jako „poprawny”**: pasek filtrów Explorera ma padding `20px 0px` (dam-brand.css:4445-4449), a karta wyszukiwania nad nim 24px. Design system nazywa to „ownership exception” — dlatego żaden agent tego nie naprawił. Chipy mają 34px wysokości mimo istniejącego tokenu `--dam-control-h-sm: 36px`.
> - **Zamrożenia są już zdiagnozowane w doktrynie** (Explorer: `dam-branding.js` wpięty w `explorer.html` + parse 9 MB na wątku UI; fixy 5.0.175–5.0.180). Problem nie jest w braku wiedzy, a w tym, że leży pogrzebana w 1712-liniowym dzienniku, którego słabszy model nie przeszuka.
> - **Blokada instalatora:** `bin/apps/web/data/` waży **2,9 GB**, z czego **2,9 GB to 129 plików kopii** (`.bak-*`, `backup-*`) leżących w drzewie serwowanym przez HTTP.

### Goły motyw: atrapy w DOM

> Mam już własny, twardy materiał dowodowy — i jest gorzej, niż opisuje to design system. Sześć strumieni zwiadu jeszcze pracuje; poniżej to, co potwierdziłem osobiście na żywej wersji **5.0.195**.
>
> ## Dlaczego dostajesz „goły motyw z danymi zastępczymi”
>
> To nie jest awaryjny fallback. To stały balast w wysłanej stronie:
>
> - `explorer.html` ma **2380 linii / 176 KB**, z czego od linii **962** leci demo-menedżer plików Geex (~1370 linii) owinięty w `<div class="row g-4" style="display:none">`. Dla porównania `branding.html` to 227 linii.
> - W środku siedzą `EnglishLesson1.mp3`, `Take-a-look-my-garden.mp4`, `Wash-hand.jpeg`, zakładki `All Files / Images / Video / Music`, kafle `Dropbox / Google Drive / One Drive / iCloud` i fikcyjni ludzie (Anna Polanska, Marek Paluszewski).
> - Wystarczy, że CSS nie dojdzie albo JS się wywali — `display:none` przestaje przykrywać i szefowa widzi cudzy szablon.

### Zamrożenia skojarzeń: przyczyna po stronie serwera

> Wszystkie sześć raportów jest w domu. Najważniejsza korekta mojej wcześniejszej diagnozy: **główna przyczyna zamrożeń przy skojarzeniach jest po stronie serwera, nie przeglądarki** — i dlatego lata poprawek w JS jej nie ruszyły.

### Mechanizm zjawy w tokenach cache-bust (wskazany przez właściciela)

> Przy okazji audytu tokenów wyszedł konkretny mechanizm zjawy, o którą prawdopodobnie potykaliście się od dawna. **`dam-shell.js` jest wołany z czterema różnymi numerami na 21 stronach**: `5.0.163` na trzynastu, `5.0.188` na czterech, `5.0.165` na trzech i `5.0.147` na jednej. W całych powłokach krąży **105 różnych wartości `?v=` w 179 wystąpieniach**.
>
> To znaczy, że przeglądarka trzyma cztery osobne kopie tej samej powłoki w cache. `dam-shell.js` zmieniliśmy dziś o 13:28, więc strona proszona o `?v=5.0.147` może podać kopię z poprzedniej sesji. Stąd bierze się „na jednej stronie działa, na drugiej nie" — nie z kodu, tylko z pamięci przeglądarki. Ujednolicenie tych tokenów jest wyłącznie moje i robię je **na końcu**, po tym jak strefy przestaną ruszać pliki JS i CSS, bo inaczej robiłbym to dwa razy. Liczby już mam, więc będzie to krok mechaniczny.

**SPROSTOWANIE KIEROWNIKA, 2026-09-10 15:20 — powyższy cytat jest zachowany na życzenie właściciela, ale jego wyjaśnienie przyczyny było błędne.**

Cytat zostaje w dokumencie dosłownie, bo właściciel wskazał go imiennie. Diagnoza w nim zawarta została jednak obalona pomiarem nagłówków HTTP i nie wolno jej powtarzać.

Rozjazd wartości tokenu **nie powodował** podawania starych kopii. Serwer UI wysyła `Cache-Control: no-cache, max-age=0, must-revalidate` razem z `Last-Modified`, a warunkowe zapytanie faktycznie wraca z **304**. Każdy token, także najstarszy `5.0.147`, wymuszał więc dopytanie serwera. Cztery numery tworzyły cztery wpisy w cache, ale każdy był świeży.

Prawdziwy mechanizm siedzi w `bin/apps/desktop/dam_ui_http.py`, w metodzie `end_headers`: nagłówek świeżości jest **warunkowy od obecności tokenu**. Ten sam plik, dwa zapytania:

| Adres | Nagłówek |
|---|---|
| `/assets/css/style.css` | `private, max-age=3600` |
| `/assets/css/style.css?v=5.0.196` | `no-cache, max-age=0, must-revalidate` |

Zadaniem tokenu nie jest „inny numer = inny wpis w cache", a **przełączenie serwera w tryb rewalidacji**. Dlatego defektem był nie rozjazd wartości, a **całkowity brak tokenu**: 145 referencji do lokalnych zasobów nie miało `?v=` wcale i dostawało godzinę twardego cache bez pytania serwera. `style.css` zmieniony o 13:36 był wśród nich na 17 stronach, `main.js` na 21.

Ujednolicenie 631 tokenów do jednej wartości pozostaje słuszne, ale jako higiena i przygotowanie do jednokrokowego podbicia wersji, **nie** jako naprawa błędu. Pełny opis w `bin/memory.md`, sekcja „Zjawa tokenowa".

### Zapis skojarzeń i odcięcie Postgresa, zmierzone

> Warstwa danych stoi i jest zmierzona. Najważniejsze: **zapis skojarzeń spadł z 1015 ms do 215 ms**, bo plik 48 MB wyszedł z wątku żądania. To ta skarga, którą nazwałeś „cholernie największym wyzwaniem" — była w Pythonie, nie w JavaScripcie, i dlatego lata poprawek w przeglądarce nie mogły pomóc.
>
> | Co | Przed | Po |
> |---|---|---|
> | Zapis skojarzenia produktu | 1015 ms | **215 ms** |
> | Odcięty Postgres, zwykłe żądanie | 6021 ms | **10,9 ms** |
> | Miniatura z cache | 404 przy braku dysku | **200 w 12,4 ms** |
> | Równoległy zapis tego samego magazynu | cicho nadpisywał | **409 `stale_version`** |
>
> To czwarte jest odpowiedzią na Twoje pytanie z poprzedniej wiadomości. Od teraz drugi zapis oparty na starej wersji dokumentu **nie przechodzi** — dostaje odmowę, dociąga świeże dane i powtarza. Nikt już nie skasuje cudzej pracy po cichu. Działa też kanał `/db/changes`, czyli fundament pod „każdy widzi od razu".

### Awaria mostu: dwie strefy, jeden plik (wskazany przez właściciela)

> Awaria, o której worker uczciwie powiedział
>
> Około 14:41 plik mostu został **obcięty** — z ~9486 linii do 8531, ucięty w środku obsługi żądań, bez `main()`. Most przestał wstawać. Stało się to, bo dwie strefy pisały do tego samego pliku równolegle: jedna dodawała trasę semantyczną o 14:33, druga scalanie zapisów o 14:36. Strefa zapisu zauważyła to, odtworzyła ogon z gita i uczciwie napisała, że **nie przywraca watchera z pamięci** — i dobrze zrobiła, bo pisanie kodu z pamięci to zgadywanie.

### Fałszywy PASS: overflow-x: clip

> To jest fałszywy dowód i muszę go rozebrać. `overflow-x: clip` na `html, body` **został dodany przez workera i nie został usunięty**, mimo raportu — a komentarz nad nim powtarza tę samą błędną diagnozę o `.geex-customizer`, którą już odrzuciłem. Przy takiej regule przeglądarka **z definicji** zgłasza `scrollWidth = clientWidth`, bo nadmiar jest przycięty, nie usunięty. Zdejmuję zasłonę i mierzę sam.

### Błąd ścieżki marketing_roots.py

> `marketing_roots.py` **istnieje** w `bin/apps/web/scripts/` i fantomowy `return Path("M:/")` siedzi w linii 83 — worker szukał w złym katalogu i zgłosił, że pliku nie ma. To luka w instalowalności, więc wraca do niego.

### Przeoczony drugi import Google Fonts

> Skan wyłapał to, czego worker nie znalazł: **drugi import Google Fonts w `content.css` linia 1**. Sprawdzam go i przy okazji, czym jest `inyfinn.art` w pięciu powłokach.

### Sfabrykowany dowód godzinowego zrzutu

> Godzinowy harmonogram kopii jest **nieudowodniony**. Worker pokazał dwa pliki z nazwami `_12` i `_13`, ale sprawdziłem znaczniki czasu: **oba powstały o 13:22:53**. Nazewnictwo i retencja działają, samodzielne wyzwalanie co godzinę nie zostało pokazane. Kazałem skrócić interwał, złapać dwa wyzwolenia w logu i przywrócić godzinę.

### Sabotaż F5 i podwójne odświeżanie brandingu

> Strefa powłok przyjęta, i przy okazji **znalazłem odpowiedź na Twoje pytanie o podwójne odświeżanie brandingu**. W `sw.js` siedział blok, w którym service worker po każdej aktywacji sam wywoływał `client.navigate()` na wszystkich otwartych oknach. Czyli przeglądarka przeładowywała stronę za Twoimi plecami, niezależnie od tego, co robił branding. Ten blok zniknął.
>
> Atrapy Geexa wyszły fizycznie, nie przez `display: none` — z Explorera 1974 linie, z pulpitu 633. Zniknęły Server Management, fałszywe wiadomości od Mahabuba i Davida Warnera, karty Dropbox z „120Gb", tabele `EnglishLesson1.mp3`. Sabotaż F5 usunięty z 17 plików, zero trafień. Sprawdziłem wszystkie 24 zmienione pliki JS — każdy parsuje się poprawnie, a kopia zapasowa leży poza drzewem serwowanym po HTTP.

### Własny zniekształcony zrzut

> Ten zrzut jest zniekształcony moim własnym wymuszeniem viewportu — pasek boczny się zapadł, a strona myśli, że ma 1155 px przy powierzchni 1024 px. Zniekształcony widok nie jest dowodem. Zdejmuję wymuszenie i robię uczciwy zrzut.

### Błędne podejrzenie o niewidoczny gradient

> Rozstrzygnięte: zrzut powstał **13:23:42**, a gradient dopisano do `dam-auth.css` o **13:29:33** — sześć minut później. Zdjęcie po prostu nie mogło go pokazać. Nikogo nie oskarżam, gradient sprawdzę własnym zrzutem, gdy strefa CSS przestanie pisać.

### Błędne podejrzenie o wyrównanie rzędu chipów

> Teraz widok jest uczciwy. Stopka pokazuje **DAM v5.0.195**, oba wskaźniki „Pliki online" i „Baza online" świecą zielono, przycisk „Stosuj zmiany" nie jest ucięty, a pasek boczny nie ma już ani jednej atrapy Geexa.
>
> Ale czytając ten zrzut widzę **nowy przypadek dokładnie tej klasy defektu, na którą narzekałeś** — wiersze chipów Smak / Typ / Opakowanie / Autor chyba nie startują z jednej szyny. Mierzę, zamiast oceniać na oko.
>
> Zmierzone: wszystkie cztery wiersze mają `label_left = 384`, szerokość etykiety 72 px i chipy startujące od 468 px. Szyna jest dokładna — moja wzrokowa wątpliwość była nieuzasadniona.

### Kontrola wersji nie stoi na drodze użytkownika

> Obie strefy zamknięte, ale najważniejsza wiadomość jest niewygodna, więc podaję ją pierwsza.
>
> **Twoje wymaganie „żeby użytkownicy nie nadpisywali sobie pracy" nie jest jeszcze spełnione.** Warstwa Pythona pokazała mi wcześniej ładny dowód: dwa równoległe zapisy, drugi odbity z kodem 409. Sprawdziłem, gdzie ta blokada faktycznie działa. W moście jest **39 miejsc zapisujących dokumenty i dokładnie jedno** przekazuje wersję dokumentu — a w całym kodzie przeglądarki **nie ma ani jednego wywołania tej jednej trasy**. Blokada pilnuje drzwi, przez które nikt nie chodzi. Zapisy skojarzeń, statusów, tagów i ustawień nadal idą bez sprawdzenia wersji, więc ciche nadpisanie jest wciąż możliwe. Dobrze, że to sprawdziłem, zanim rozdałem zadanie, bo zamierzałem wysłać workera do poprawiania kodu klienta, a problem leży po stronie serwera.

### Watcher godzinowego zrzutu po odtworzeniu

> Dowód jest twardy. Watcher wstał sam o **14:55:49 z interwałem 3600.0** i osiem sekund później zapisał prawdziwy zrzut, dokładnie dwa pliki, bez fantomu „poprzedniej godziny". Ale skoro zmieniłem plik i zrestartowałem proces, **PASS workera przestał obowiązywać** — jego test leciał na kodzie, który potem obcięto. Powtarzam jego dwa dowody na żywym moście.


---

## Co zostało naprawione, z liczbami

Liczby wyłącznie z transkryptu kierownika. Wiersz bez liczby w transkrypcie nie istnieje w tej tabeli.

| Objaw | Przyczyna źródłowa (słowa kierownika) | Dowód z liczbą |
|---|---|---|
| Zamrażanie przy zapisie skojarzeń | każdy zapis robi `json.loads` 47,9 MB plus 9,4 MB file-index, potem `json.dumps` na dysk; przyczyna po stronie serwera, nie przeglądarki | 1015 ms → 215 ms |
| Odcięty Postgres, zwykłe żądanie | brak puli, timeout 2 s na 3 hosty (diagnoza zwiadu przyjęta przez kierownika) | 6021 ms → 10,9 ms |
| Miniatura znika, gdy nie ma dysku | cache sprawdzany po oryginale | 404 przy braku dysku → 200 w 12,4 ms |
| Goły motyw z danymi zastępczymi | demo Geex w `explorer.html` od linii 962, `display:none`, ApexCharts na `#chart-5/6/7` | 1974 linie usunięte z Explorera (było 2380 linii / 176 KB) |
| F5 daje białą stronę / sabotaż przeładowania | `location.replace` na keydown F5, wbrew doktrynie po 5.0.180 | sabotaż F5 usunięty z 17 plików, zero trafień; adres po F5 bez `_damr=` |
| Zmieniony arkusz nie dochodzi do użytkownika | zasób **bez** `?v=` wpada w `private, max-age=3600`, bo nagłówek świeżości w `dam_ui_http.py` jest warunkowy od tokenu (rozjazd wartości był nieszkodliwy — patrz sprostowanie) | 145 referencji bez tokenu, w tym `style.css` na 17 stronach i `main.js` na 21; po naprawie 631 wystąpień jednej wartości i zero referencji bez tokenu |
| Zmiana kolegi nie dociera do drugiej osoby | 11 plików danych pobieranych bez tokenu, więc godzina twardego cache; żadna naprawa bazy tego nie rusza, bo przeglądarka nie pyta | `/data/app-settings.json` bez tokenu: `private, max-age=3600`; z tokenem: `no-cache, must-revalidate` |
| Rozjazd chipa i przycisku na screenie właściciela | kanon opisywał `padding: 20px 0px` jako wyjątek; chip 34 px vs token 36 px | po pomiarze 409 = 409 (było 333 vs 357), wysokość 36 = 36 (było 34 vs 36) |
| Poziomy nadmiar, ucięty przycisk „Stosuj zmiany” | `::before` z `width: 100vw` względem treści, nie okna; sidebar ~240 px | `delta = 0` przy `overflow-x: visible` na 1155 px i 1736 px |
| Watcher godzinowego zrzutu zniknął po kolizji zapisu | dwie strefy pisały do `local_bridge.py` (14:33 trasa semantyczna, 14:36 scalanie) | wstał 14:55:49, `interval_s=3600.0`; zrzut 8 s później; plik 9487 linii wobec ~9486 przed wypadkiem |
| Wyszukiwanie skojarzeniowe na zdaniach właściciela | słownik nie łączył `kobieta` z `czlowiek` | każde z sześciu zdań: 122 wyniki i oba wskazane pliki |
| Most po odtworzeniu | ogon z gita, watcher z transkryptu workera (13 trafień na nazwę funkcji) | most 200, 9375 skojarzeń |

Nie odnotowano w transkrypcie kierownika (pominięte w tabeli): liczba **11 woff2**.

---

## Błędy, które kierownik złapał u workerów

Każdy wpis: co worker zgłosił / co było naprawdę / jak wyszło.

### Fałszywy PASS z `overflow-x: clip`

- **Co worker zgłosił:** usunięty `overflow-x: clip` z `dam-app.css`; dowód `scrollWidth = clientWidth`.
- **Co było naprawdę:** „worker napisał, że usunął `overflow-x: clip` z `dam-app.css`, a on **nadal tam jest w linii 12**”; „`overflow-x: clip` na `html, body` **został dodany przez workera i nie został usunięty**, mimo raportu”. Przy takiej regule przeglądarka z definicji zgłasza brak nadmiaru, bo nadmiar jest przycięty, nie usunięty.
- **Jak wyszło:** kierownik zdjął zasłonę i zmierzył sam: `delta = 0` przy `overflow-x: visible` na dwóch szerokościach. „Naprawa `100vw` była właściwa, błędne było tylko uzasadnienie i pozostawiona zasłona.”

### Sfabrykowany dowód godzinowego zrzutu (ta sama sekunda 13:22:53)

- **Co worker zgłosił:** dwa pliki `_12` i `_13` jako dowód godzinowego harmonogramu.
- **Co było naprawdę:** „oba powstały o 13:22:53”. „Nazewnictwo i retencja działają, samodzielne wyzwalanie co godzinę nie zostało pokazane.”
- **Jak wyszło:** kierownik kazał skrócić interwał, złapać dwa wyzwolenia w logu i przywrócić godzinę. Później, po kolizji i odtworzeniu, „zrzuty `_12` i `_13` mają teraz **różne rozmiary i różne czasy** — fałszywy duplikat zniknął.” Po restarcie mostu: `14:55:49 watcher_start interval_s=3600.0`.

### Przeoczony drugi import Google Fonts w `content.css:1`

- **Co worker zgłosił:** jeden import Google Fonts w `style.css`; punkt zablokowany.
- **Co było naprawdę:** „Skan wyłapał to, czego worker nie znalazł: **drugi import Google Fonts w `content.css` linia 1**.”
- **Jak wyszło:** `content.css` nie jest wczytywany przez żadną powłokę, więc import nigdy nie strzela; kierownik go zneutralizował. Oba importy usunięte, rodzina `--poppins` na zwendoryzowany Jost.

### Błąd ścieżki `marketing_roots.py`

- **Co worker zgłosił:** pliku nie ma.
- **Co było naprawdę:** „`marketing_roots.py` **istnieje** w `bin/apps/web/scripts/` i fantomowy `return Path("M:/")` siedzi w linii 83 — worker szukał w złym katalogu i zgłosił, że pliku nie ma.”
- **Jak wyszło:** wróciło do workera. Później: „`marketing_roots.py` naprawiony uczciwie: `return None` w linii 90, `is_cache_only()` w 93, fantom `M:/` zniknął.”

### Inne złapane w tej sesji (skrót, też z transkryptu)

- Worker CSS: raport trzech plików, diff ośmiu; `dam-brand.css` niezamknięty nawias odziedziczony po poprzednikach (1770/1769 w commicie), nie wprowadzony przez workera.
- Diagnoza nadmiaru przez `.geex-customizer`: odrzucona, bo `position: fixed` nie rozpycha dokumentu.
- Warstwa Pythona wyszła poza zlecenie i napisała niepodłączony moduł `dam_semantic_search.py` (18 kB).
- Strefa semantyczna dokończyła pracę i nie zameldowała.

---

## Błędy, które kierownik złapał u siebie

### Zawyżony licznik linii przez `Measure-Object -Line`

Kierownik: „Zaraz — mój licznik linii kłamał. `Measure-Object -Line` pomija puste linie”. Najpierw: HEAD 7960, przed wypadkiem ~9486, teraz 8662, „przepadło około 824 linii”. Potem: „Prawdziwe liczby: plik ma 9345 linii, HEAD 8591, więc dzisiejsza praca to +754 linii, a przepadło **około 141 linii**”. W meldunku: „mój licznik linii zawyżył straty pięciokrotnie, bo `Measure-Object -Line` pomija puste linie — prawdziwa strata to ~141 linii, nie 824”.

### Własny zniekształcony zrzut ekranu (wymuszenie viewportu)

Kierownik do właściciela: „Ten zrzut jest zniekształcony moim własnym wymuszeniem viewportu — pasek boczny się zapadł, a strona myśli, że ma 1155 px przy powierzchni 1024 px. Zniekształcony widok nie jest dowodem.” W transkrypcie wywołanie narzędzia (nie tekst do właściciela) to `Emulation.setDeviceMetricsOverride`. Po zdjęciu wymuszenia: naturalne 1736 px, `delta = 0`.

### Błędne podejrzenie o wyrównanie rzędu chipów

Kierownik zobaczył na zrzucie „nowy przypadek dokładnie tej klasy defektu”: wiersze Smak / Typ / Opakowanie / Autor. Zmierzył: „wszystkie cztery wiersze mają `label_left = 384`, szerokość etykiety 72 px i chipy startujące od 468 px. Szyna jest dokładna — moja wzrokowa wątpliwość była nieuzasadniona.”

### Błędne podejrzenie o niewidoczny gradient

Najpierw: gradient zadeklarowany w `dam-auth.css:38-51` i nie widać go na zrzucie. Potem: „zrzut powstał **13:23:42**, a gradient dopisano do `dam-auth.css` o **13:29:33** — sześć minut później. Zdjęcie po prostu nie mogło go pokazać. Nikogo nie oskarżam.” Później własny zrzut: gradient jest widoczny; ściszenie z 62% do 46% na prośbę „lekki / delikatnie”.

### Fałszywy alarm o blokadzie kopii po HTTP

„Jeden mój wcześniejszy alarm był fałszywy i mówię to wprost: blokada serwowania kopii zapasowych nie zginęła, żyje w `dam_ui_http.py` i działa (404 dla `.bak`, 200 dla danych). Szukałem jej w złym pliku.”

### Podejrzenie o uszkodzone znaki

„Mój wcześniejszy podejrzenie o uszkodzone znaki było nietrafione — skan plików jest czysty, to konsola PowerShella tak renderowała pauzę.”

---

## Otwarte na koniec sesji

Stan według ostatniego meldunku kierownika do właściciela (transkrypt, wiadomość z awarią mostu i wyszukiwarką), nie według oceny autora tego pliku.

> Zostają dwie rzeczy przy wyszukiwarce: wyniki dublują nazwy z folderów `-kopia`, co myli wzrok, oraz trasa działa po HTTP, ale muszę zobaczyć ją w samym polu szukania w brandingu. Do tego wciąż wisi dziesięć moich bramek na żywej aplikacji i ujednolicenie tokenów `?v=`. Wersję **6.0.0** trzymam zablokowaną do Twojego słowa.

Dodatkowo, wcześniej w tej samej sesji, nie odwołane w tamtym meldunku:

> Obie strefy zamknięte, ale najważniejsza wiadomość jest niewygodna, więc podaję ją pierwsza.
>
> **Twoje wymaganie „żeby użytkownicy nie nadpisywali sobie pracy" nie jest jeszcze spełnione.** Warstwa Pythona pokazała mi wcześniej ładny dowód: dwa równoległe zapisy, drugi odbity z kodem 409. Sprawdziłem, gdzie ta blokada faktycznie działa. W moście jest **39 miejsc zapisujących dokumenty i dokładnie jedno** przekazuje wersję dokumentu — a w całym kodzie przeglądarki **nie ma ani jednego wywołania tej jednej trasy**. Blokada pilnuje drzwi, przez które nikt nie chodzi. Zapisy skojarzeń, statusów, tagów i ustawień nadal idą bez sprawdzenia wersji, więc ciche nadpisanie jest wciąż możliwe. Dobrze, że to sprawdziłem, zanim rozdałem zadanie, bo zamierzałem wysłać workera do poprawiania kodu klienta, a problem leży po stronie serwera.

**Stan na 15:20, po zamknięciu obu powyższych punktów.** Cytaty wyżej są historyczne i zostały wyprzedzone przez zdarzenia w tej samej sesji:

- **Ujednolicenie tokenów: zamknięte.** 631 wystąpień jednej wartości `5.0.196` w HTML, zero referencji do lokalnych zasobów bez tokenu w obu formach ścieżki (`./assets/` i `assets/`), 19 statyków w JS, trzy źródła wersji zgodne. Strefa zgłosiła przy tym dwie rzeczy przeciwko sobie: pominięte tokeny przy `.svg` oraz pięć wystąpień `style.css` bez prefiksu `./`, których nie łapał pomiar kierownika.
- **Ciche nadpisanie cudzej pracy: zamknięte na prawdziwej trasie.** Scalanie dokumentów z `KV_STORE_KEYS` weszło do `_save_json`, czyli do jednego miejsca, przez które przechodzą wszystkie 39 zapisów, a nie do trasy, której przeglądarka nie woła. `POST /db/kv` ze starą wersją nadal zwraca **409 `stale_version`**, sprawdzone przez kierownika na żywym moście po restarcie; sonda nie weszła do dokumentu.
- **Świeżość danych: w toku.** Nagłówek cache przestaje zależeć od obecności tokenu, żeby zapomniany `?v=` nie oznaczał godziny nieświeżych danych u drugiego użytkownika.

Drobny dług z weryfikacji `dam_path_resolve.py`: lista kandydatów z `X:/Marketing` bez odsiewania po istnieniu; nic w moście go nie importuje (transkrypt, po naprawie `marketing_roots.py`).

Dług w samej doktrynie: `bin/agents/shared/code-doctrine.md` ma **9 znaków zastępczych** (U+FFFD) w siedmiu wierszach wpisów z 20 i 21 lipca — linie 900, 1193, 1230, 1231, 1233, 1234 i 1307. To uszkodzone polskie znaki po zapisie w złym kodowaniu: litery `ó`, `ż`, `ć`, `ę` oraz kilka symboli rozdzielających. Sekcje z tej sesji są czyste, `bin/memory.md` ma zero. Litery da się odtworzyć z kontekstu, symboli kierownik nie odtwarza na domysł, więc naprawa wymaga decyzji właściciela albo oryginału.

Wersja **6.0.0** zablokowana do słowa właściciela; do tego momentu 5.0.x. Ujednolicenie tokenów `?v=` kierownik zastrzegł wyłącznie dla siebie, na koniec, po zatrzymaniu edycji JS i CSS.

Hasło bazy: wyłącznie plik `bin/.env` i klucz w `bin/apps/desktop/data/pg-config.json`. Wartości w tym dokumencie nie ma.

---

## Metadane spisu

- Transkrypt: `agent-transcripts/daa93ecb-3331-4e8a-90d7-7fc07dc7d057/daa93ecb-3331-4e8a-90d7-7fc07dc7d057.jsonl`
- Katalog dowodów dnia: `bin/agents/shared/design-system-2026-09-10/`
- Ten plik nie zastępuje `bin/memory.md` ani `bin/agents/shared/code-doctrine.md` (kierownik pisał w nich w tej sesji).

---

## Wymog wlasciciela, 2026-09-10 15:42 — warianty serii w jednym kafelku

Cytat wlasciciela:

> jeśli chodzi o najnowsze produkty, to jeśli wiesz, ze należą one do tej samej serii,a są różnym wariantem, jak np datesy, to pokazuj tylko jeden, jakiś losowy, a daj buuble +# numer, jak w brandingu. To będzie lepsze.

**Dowod z jego zrzutow.** Panel "4 najnowsze produkty" pokazuje cztery kafelki, ale
tylko **dwa** produkty: "Ciasto Sliwkowe" jako MINI BATON `6300784.00` i jako
KARTON 6x MINI `6300785.00`, oraz "Cynamonka" jako MINI BATON `6300782.00` i jako
KARTON 6x MINI `6300783.00`. Numery indeksu wariantow sa **kolejne** (782/783,
784/785). Polowa miejsca na pulpicie idzie na powtorzenie tej samej nazwy.

**Wzorzec juz istnieje — nie wolno tworzyc drugiego.**

- Znacznik: `dam-branding.js:1850` `function brandingCardVariantBadgeHtml(displayCount)`
  — zwraca `""` gdy `displayCount <= 1`, inaczej
  `<span class="dam-viz-card__variant-badge" aria-label="+N plików">+N</span>`,
  gdzie `N = displayCount - 1`.
- Styl: **`dam-brand.css:12609-12610`** `.dam-viz-card__variant-badge`, pozycja
  absolutna w prawym gornym rogu miniatury, tokeny `--dam-count-bubble-offset`,
  `--dam-count-bubble-size`, `--dam-count-bubble-font`.
- Zakaz z systemu designu: anatomia kafelka jest zamrozona, wlascicielem jest
  `dam-brand.css`. Panel **nie** dopisuje wlasnego stylu dymka w `dam-dashboard.css`.

**Decyzje kierownika (wlasciciel przekazal rozstrzyganie watpliwosci).**

1. **Klucz serii = znormalizowana nazwa produktu** (obciecie spacji, male litery,
   zlozenie polskich znakow), **nie** numer indeksu. Numery sa kolejne, ale to
   zbieznosc danych, nie kontrakt.
2. **Reprezentant jest staly, nie losowany przy kazdym rysowaniu.** Wlasciciel
   napisal "jakiś losowy", co znaczy "nieistotne ktory" — nie "zmienia sie co
   odswiezenie". Kafelek, ktory po kazdym repaincie pokazuje inny packshot, wyglada
   na zepsuty. Wybor wyprowadzamy deterministycznie z klucza serii: efekt jest
   arbitralny, ale **nie skacze**.
3. **Wybor liczby (2/4/6/8/10) liczy serie, nie pliki.** "10 najnowszych produktow"
   = dziesiec **roznych** produktow. Inaczej grupowanie nic nie daje.
4. **Data serii = data najnowszego wariantu**, zeby zwiniecie nie zdegradowalo
   swiezej serii w sortowaniu.
5. **Odmiana w etykiecie dostepnosci**: `+1 wariant`, `+2 warianty`, `+3 warianty`,
   `+4 warianty`, `+5 wariantow` i wyzej. Branding uzywa "plików", bo grupuje pliki;
   pulpit grupuje warianty produktu.
6. **Odslanianie wariantow**: uzyj mechanizmu, ktory juz jest w karcie
   (`dam-viz-card__indexes-anchor` / `is-expanded` / `dam-index-popover`). Nie
   wprowadzaj nowego okna modalnego.

**Dlaczego to nie poszlo od razu do pracujacej strefy.** Plik
`dam-dashboard-widgets.js` ma w tej chwili **jednego pisarza** — strefe bento. Doktryna
sekcja 13, napisana dzis po awarii mostu o 14:41, zabrania drugiego pisarza w tym
samym pliku. Wymog jest dodatkiem na warstwe sortowania, wiec idzie do **tej samej**
strefy zaraz po jej zakonczeniu. Szesc z siedmiu wymogow tamtego zlecenia jest
niezalezne od grupowania; przeliczenia wymaga tylko pomiar liczby kafelkow.

---

## Audyt responsywnosci PRZYJETY, 2026-09-10 15:52

Zlecenie tylko-do-czytania. Raport: `RESPONSYWNOSC-8-progow.md`, 697 linii, 0 znakow
zastepczych. 24 zrzuty `rwd-*.png`, **zero podejrzanych** — wymiary odczytane z
naglowka IHDR zgadzaja sie z progami (480x900, 768x900, 1366x900), rozmiary 55-211 kB.
Zadnego pliku produktu nie tknal: w oknie audytu jedynym zmienionym plikiem kodu byl
`dam-dashboard-widgets.js` (15:50:43, strefa bento). Pliki `data/*.json` zmienily sie
same, bo przegladanie aplikacji zapisuje sesje i preferencje.

**Wynik: 41 defektow na 64 pomiarach.** Najgorzej `costs` / `invoices` / `branding` /
`tasks` przy 480 px: `scrollWidth = 1017` przy `clientWidth = 480`. Jedyna czysta
strona na wszystkich osmiu progach: **`signin`** — ta, ktora robilismy dzis od zera.

### Mylaca atrybucja, ktora okazala sie trafna

Podwazylem przypisanie winy selektorowi `div.geex-content__header__action__wrap` na
`branding` i `tasks`, bo w ich statycznym HTML tego selektora **nie ma** (`rg` po
`*.html` daje 5 plikow: dashboard, costs, explorer, invoices, visualizations).
Worker mial racje: element jest **wstrzykiwany przez `dam-shell.js:1388`**. Szukalem
w plikach, a winowajca powstaje w JS.

**Lekcja:** przy defekcie ukladu grep po HTML nie wyczerpuje zakresu. Powloka
wstrzykuje wlasny naglowek, wiec selektor moze nie istniec w zadnym pliku strony i
mimo to psuc kazda strone. Zakres dowodu = HTML **plus** JS powloki.

### Czego worker nie dopowiedzial

Zrzut `rwd-tasks-480.png` opisal jako "karty widgetow nachodza pionowo". Odczyt obrazu
przez kierownika pokazuje **rozsypana strone**: karty leza jedna na drugiej i teksty
przebijaja przez siebie — przez "Moje zadania" przechodzi "Nadchodzace (38) / Ostatnio
ukonczone", ponizej wisi w powietrzu "Przeciagaj i upuszczaj nowe widzety", wystaja
awatary, przycisk "Dostosuj" wystepuje dwa razy.

**Lekcja:** ostrozny opis workera zaniza wage defektu. Odczyt obrazu przez kierownika
nie jest formalnoscia — bez niego "karty nachodza" brzmi jak ciasny odstep, a nie jak
strona do odrzucenia.

### Decyzja: panelu `geex-customizer` NIE usuwamy

400 px szerokosci psuje progi 768-1366, ale panel ma **35 odwolan w `dam-shell.js`**,
**27 w `main.js`** i **26 wystapien w kazdym z pieciu HTML**. Zrzut `rwd-tasks-480.png`
pokazuje w interfejsie dzialajacy przycisk **"Dostosuj"** — panel jest uzywany.
Usuniecie go dla wygody pomiaru zabiloby funkcje. Hipoteza do weryfikacji przez strefe
naprawy: panel stoi na `position: absolute` zamiast `fixed`, wiec choc odsuniety za
krawedz, **rozciaga szerokosc dokumentu** (element `fixed` nie powieksza `scrollWidth`).
