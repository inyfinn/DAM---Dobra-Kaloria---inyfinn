# DAM - Dobra Kaloria

**Program do pracy z materiałami marek Dobra Kaloria i Good Calories.** Jedno miejsce, w którym widać wszystkie produkty, ich wizualizacje, projekty opakowań i materiały graficzne, razem z tym, kto nad czym pracuje i na jakim etapie jest produkt. Działa na Windows i macOS, a dane trzyma w centralnej bazie, więc każdy komputer widzi to samo.

[**Pobierz najnowszą wersję**](https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases/latest) - Windows (`DAM-Setup.exe`), macOS (`DAM-AppleSilicon.dmg` dla procesorów M, `DAM-Intel.dmg` dla Intela).

## Co potrafi

### Wizualizacje
Galeria packshotów z domyślnym widokiem tylko najnowszych wersji, więc nic starego nie miesza się do pracy. Produkty filtrujesz tagami (smak, typ, opakowanie, autor, opis, podkategoria), sortujesz i skalujesz kafle. Kliknięcie otwiera okno produktu z wariantami, perspektywami (przód, tył), tłem i jakością pliku oraz powiązanymi materiałami. Wizualizacje i&nbsp;Materiały mają ten sam pasek filtrów: zakładki, tagi, przełączniki, DK/GC, zakresy dat (także „Poprzedni miesiąc”) i&nbsp;jeden format licznika.

![Wizualizacje](docs/img/01-wizualizacje.png)

![Wspólny pasek filtrów](docs/img/11-wizualizacje-pasek.png)

### Eksplorer
Pełna struktura produktów z kategoriami po lewej: produkty, warianty i ich pliki jako kafelki. Każdy wariant ma przełącznik Aktualny / Nieaktualny i listę kompletności (plik źródłowy, podgląd PDF, pliki do druku, wizualizacje). Kliknięcie pozycji listy otwiera menu działań: przy brakującym pliku „Zgłoś zapotrzebowanie” albo „Otwórz folder wariantu”, przy obecnym „Otwórz”, „Pokaż w folderze”, „Kopiuj ścieżkę”. Szukasz po indeksie, nazwie albo skojarzeniu, a „Odśwież miniatury” buduje podglądy od nowa z plików na dysku.

Wyniki szukania to kafle produktów z&nbsp;wariantami i&nbsp;jeden licznik. Eksplorer bez wyniku podpowiada dwa kroki dalej.

![Eksplorer](docs/img/02-eksplorer.png)

![Eksplorer: wyniki jako kafle](docs/img/10-eksplorer-szukaj-dalej.png)

### Zadania i Asana w obie strony
Każdy łączy swoje konto Asany raz (Integracje → Asana, osobisty token) i od tej chwili widzi w DAM tylko swoje zadania, na każdym komputerze. Ptaszek w DAM zamyka zadanie w Asanie, a zmiany z Asany pojawiają się w DAM po kilkunastu sekundach. W Wiadomościach rozwinięte zadanie pokazuje, kto je ma, na kiedy, w jakim projekcie i do czego należy, a „Otwórz w Asanie” otwiera aplikację Asana. Zgłoszenie zapotrzebowania może od razu utworzyć zadanie w Asanie.

![Zadania](docs/img/05-zadania.png)

![Wiadomości](docs/img/06-wiadomosci.png)

### Materiały graficzne
Reklamy, filmy, banery, loga i grafiki marki w jednym katalogu, z podziałem na kampanie, social i wideo, strony WWW oraz brandbook. Wyszukiwarka rozumie zwykłe zapytania ("slider niemięsa", "film lato 2026"), a tagi pozwalają zawęzić wynik kliknięciem. Pliki w kilku formatach (PNG, SVG) są jednym elementem, a SVG otwiera się w oknie podglądu.

![Materiały graficzne](docs/img/03-materialy-graficzne.png)

### Materiały graficzne: wszystko poza wizualizacjami
Materiały pokazują wszystko, co jest na dysku Marketing poza wizualizacjami produktów, bez osobnej strony „Inne materiały”. Domyślnie widać gotowe grafiki. Przełączniki dokładają pliki źródłowe (AI, PSD, INDD, AEP), wideo i&nbsp;prezentacje, archiwum albo wszystko z&nbsp;dysku. Kopie wizek nie dublują się w&nbsp;Materiałach. Podglądy SVG, wideo i&nbsp;GIF grają po najechaniu, a&nbsp;pliki AI, INDD i&nbsp;PPTX mają miniatury. Kafle nie mają obrysów ani podkreśleń, a&nbsp;„Pokaż w&nbsp;folderze” otwiera folder od&nbsp;razu.

![Materiały graficzne: wszystko poza wizualizacjami](docs/img/07-materialy-wszystko.png)

Ustawienia → Pokrycie materiałów po każdym przeglądzie liczą, czy program pokazuje wszystko: „Pokrycie: 100%” albo lista braków, a&nbsp;foldery nieczytelne są osobno.

![Pokrycie materiałów](docs/img/08-pokrycie.png)

### Projekty opakowań
Produkt jest kompletny, gdy ma komplet w&nbsp;którymś wariancie. W&nbsp;projekcie każdy wariant ma kafel z&nbsp;listą „jest” / „brak” / „brak, jest w&nbsp;innym wariancie”, a&nbsp;„W toku” pokazuje zadanie z&nbsp;Asany (projekt „Zmiany bieżących opakowań”). Bez połączonej Asany Zadania pokazują przycisk „Połącz Asanę”.

![Projekt: warianty](docs/img/12-projekt-warianty.png)

### Quizy: dane, których program sam nie zgadnie
Strona Quizy ma trzy zakładki z&nbsp;licznikami. **Nośniki** porządkują luźne warianty: klikasz kafelek (albo klawisz), a&nbsp;DAM przenosi wariant do folderu typu (RĘKAW, DOY, KAR3X…), poprawia nazwy plików i&nbsp;dokłada brakujące puste foldery z&nbsp;szablonu (0-ARCHIWUM, 2-PROJEKT, 3-DRUK…; dla eksportu wersje angielskie). Warianty z&nbsp;POLSKA dostają polskie kafelki, z&nbsp;EKSPORT angielskie. Przy nazwie wariantu wpiszesz prawdziwy indeks zamiast 6300XXX, a&nbsp;przy dwóch datach wybierzesz właściwą. Chipy „8 wizek / 2&nbsp;PDF / 2&nbsp;AI” otwierają podgląd na cały ekran z&nbsp;przyciskiem „Otwórz w&nbsp;programie”. Każdy ruch można cofnąć.

![Quiz nośników](docs/img/13-quizy-nosniki.png)

**Materiały graficzne** to jeden quiz skojarzeń: najpierw grafiki z&nbsp;propozycjami DAM, potem pliki z&nbsp;nazwą produktu w&nbsp;nazwie lub folderze, a&nbsp;slidery i&nbsp;banery na końcu. Przy każdym produkcie widać miniaturę, ścieżkę folderu, „Podgląd” i&nbsp;„Pokaż w&nbsp;folderze”, a&nbsp;wyszukiwarka rozumie literówki i&nbsp;indeksy. Zaznaczasz jeden albo kilka produktów i&nbsp;„Zatwierdź i&nbsp;dalej”. „Nic nie pasuje” działa też dla całego folderu, każdy ruch można cofnąć. Quiz rozwiązuje każdy zalogowany.

![Quiz Materiały graficzne](docs/img/14-quizy-produkty.png)

### Pulpit
Kafelki „Zacznij quiz” pojawiają się tylko wtedy, gdy jest coś do zrobienia. Obok liczniki produktów i&nbsp;projektów, „W toku” z&nbsp;Asany i&nbsp;kolumna Powiadomień, która rośnie razem z&nbsp;oknem. Okienka Wiadomości i&nbsp;Powiadomienia rozciągasz w&nbsp;dół i&nbsp;na szerokość, a&nbsp;program pamięta ich rozmiar.

![Pulpit](docs/img/15-pulpit.png)

### Pomoc w każdym miejscu
Znak zapytania (lub klawisz F1) otwiera panel "Pomóż mi tutaj": krótkie wskazówki dla bieżącej strony z przyciskami "Pokaż mi", które podświetlają element na ekranie, samouczek, lista skrótów klawiszowych i słowniczek. Dobrokaloriuś prowadzi przez program, a bez myszy da się przełączać strony (Alt+1...9), szukać (`/` albo Ctrl+K) i chodzić po kaflach klawiszami Tab i strzałkami.

![Pomoc](docs/img/04-pomoc.png)

### Faktury i koszty
Faktury, Koszty, Stawki i Katalog FMCG obsługujesz w&nbsp;całości w&nbsp;programie: dodajesz, edytujesz i&nbsp;usuwasz wpisy oraz importujesz pliki CSV i&nbsp;XLSX. Kwoty są liczone dokładnie (Decimal), a&nbsp;kafle podsumowań mają kolor tylko na liczbie i&nbsp;tylko wtedy, gdy coś znaczy.

![Faktury](docs/img/09-faktury.png)

### Pozostałe moduły
- **Dashboard** - liczniki produktów i projektów, najnowsze wizualizacje i produkty oraz Twoje zadania z Asany, układane po swojemu.
- **Projekty** - projekty opakowań z etapami.
- **Faktury, Integracja i produkcja** - faktury i koszty, integracje (Asana, Teams) oraz dane produkcyjne produktów.
- **Użytkownicy** (tylko administrator) - lista kont z wyszukiwaniem i filtrami, akceptacja nowych osób, klucze licencji, edycja i wyłączanie kont oraz lista komputerów z dostępem do bazy z przyciskiem „Odłącz komputer”.
- **Profil i Ustawienia** - dane konta, komputery i ścieżki do folderu Marketing (każdy komputer może mieć inną literę dysku), motyw jasny i ciemny, zestawy kolorów, osobno kolor główny i kolor akcentu. Ciemny motyw ma jedną drabinę od #09150D i&nbsp;widoczne krawędzie kart.
- **LIVE i LOKALNY** - przełącznik źródła danych: wspólna baza albo tylko pliki z tego komputera.

## Jak to działa

- **Jedna prawda w bazie.** Konta, statusy, tagi i skojarzenia leżą w centralnej bazie PostgreSQL, a plik z dysku Marketing pozostaje źródłem materiałów. Pamięć podręczna miniatur przyspiesza podglądy, a oryginał jest zawsze do otwarcia.
- **Jedno konto, wszędzie.** Logujesz się swoim adresem i hasłem na każdym komputerze. Każdy komputer dostaje w tle własny, ograniczony dostęp do bazy, który administrator może w każdej chwili odłączyć.
- **Instaluj i pracuj.** Instalator zawiera wszystko, czego program potrzebuje: nie trzeba instalować Pythona ani niczego konfigurować. Po instalacji logujesz się kontem firmowym.
- **Aktualizacje same.** Program sprawdza to repozytorium i pobiera nowe wydanie w tle. Wydania są podpisane, więc program instaluje tylko to, co pochodzi od autora. Ręcznie: menu profilu, Sprawdź aktualizacje.
- **Szybki start.** Okno startowe pojawia się od razu, a ponowne kliknięcie ikony w trakcie uruchamiania nie restartuje programu.

## Mapa kodu (dla programistów i agentów)

`bin/docs/mapa-kodu/` to katalog kodu jak w bibliotece: każdy plik z obszarem, celem, funkcjami i trasami z numerami linii oraz słownik ponad 190 pojęć, którymi mówi zespół (wizka, nośnik, łatka, kafelki, odłącz komputer…). Pytanie zadajesz po polsku: `python bin/docs/mapa-kodu/szukaj.py "gdzie snapshot indeksu"` zwraca plik i linię w ułamku sekundy, a `biblioteka.html` daje to samo w przeglądarce. Po zmianach w kodzie: `python bin/docs/mapa-kodu/odswiez.py`.

## Repozytoria

- **Wydania (to repozytorium, publiczne):** instalatory i podpisy do pobrania. Programy na komputerach czytają stąd aktualizacje, dlatego nazwa tego repozytorium się nie zmienia.
- **Kod źródłowy:** `inyfinn/DAM-src` (prywatne).

## Licencja i autorzy

Oprogramowanie komercyjne. Autor: Krzysztof Marcin Wieczorek. Licencji udziela INYFINN ART sp. z o.o. (Katowice). Pełna umowa licencyjna wraz ze streszczeniem jest w instalatorze i w programie (strona Licencja). Program korzysta z motywu Geex i bibliotek open source na ich własnych licencjach.
