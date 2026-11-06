# DAM - Dobra Kaloria

**Program do pracy z materiałami marek Dobra Kaloria i Good Calories.** Jedno miejsce, w którym widać wszystkie produkty, ich wizualizacje, projekty opakowań i materiały graficzne, razem z tym, kto nad czym pracuje i na jakim etapie jest produkt. Działa na Windows i macOS, a dane trzyma w centralnej bazie, więc każdy komputer widzi to samo.

[**Pobierz najnowszą wersję**](https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases/latest) - Windows (`DAM-Setup.exe`), macOS (`DAM-AppleSilicon.dmg` dla procesorów M, `DAM-Intel.dmg` dla Intela).

## Co potrafi

### Wizualizacje
Galeria packshotów z domyślnym widokiem tylko najnowszych wersji, więc nic starego nie miesza się do pracy. Produkty filtrujesz tagami (smak, typ, opakowanie, autor, opis, podkategoria), sortujesz i skalujesz kafle. Kliknięcie otwiera okno produktu z wariantami, perspektywami (przód, tył), tłem i jakością pliku oraz powiązanymi materiałami.

![Wizualizacje](docs/img/01-wizualizacje.png)

### Eksplorer
Pełna struktura produktów z kategoriami po lewej: produkty, warianty i ich pliki jako kafelki. Każdy wariant ma przełącznik Aktualny / Nieaktualny i listę kompletności (plik źródłowy, podgląd PDF, pliki do druku, wizualizacje). Kliknięcie pozycji listy otwiera menu działań: przy brakującym pliku „Zgłoś zapotrzebowanie” albo „Otwórz folder wariantu”, przy obecnym „Otwórz”, „Pokaż w folderze”, „Kopiuj ścieżkę”. Szukasz po indeksie, nazwie albo skojarzeniu, a „Odśwież miniatury” buduje podglądy od nowa z plików na dysku.

![Eksplorer](docs/img/02-eksplorer.png)

### Zadania i Asana w obie strony
Każdy łączy swoje konto Asany raz (Integracje → Asana, osobisty token) i od tej chwili widzi w DAM tylko swoje zadania, na każdym komputerze. Ptaszek w DAM zamyka zadanie w Asanie, a zmiany z Asany pojawiają się w DAM po kilkunastu sekundach. W Wiadomościach rozwinięte zadanie pokazuje, kto je ma, na kiedy, w jakim projekcie i do czego należy, a „Otwórz w Asanie” otwiera aplikację Asana. Zgłoszenie zapotrzebowania może od razu utworzyć zadanie w Asanie.

![Zadania](docs/img/05-zadania.png)

![Wiadomości](docs/img/06-wiadomosci.png)

### Materiały graficzne
Reklamy, filmy, banery, loga i grafiki marki w jednym katalogu, z podziałem na kampanie, social i wideo, strony WWW oraz brandbook. Wyszukiwarka rozumie zwykłe zapytania ("slider niemięsa", "film lato 2026"), a tagi pozwalają zawęzić wynik kliknięciem. Pliki w kilku formatach (PNG, SVG) są jednym elementem, a SVG otwiera się w oknie podglądu.

![Materiały graficzne](docs/img/03-materialy-graficzne.png)

### Pomoc w każdym miejscu
Znak zapytania (lub klawisz F1) otwiera panel "Pomóż mi tutaj": krótkie wskazówki dla bieżącej strony z przyciskami "Pokaż mi", które podświetlają element na ekranie, samouczek, lista skrótów klawiszowych i słowniczek. Dobrokaloriuś prowadzi przez program, a bez myszy da się przełączać strony (Alt+1...9), szukać (`/` albo Ctrl+K) i chodzić po kaflach klawiszami Tab i strzałkami.

![Pomoc](docs/img/04-pomoc.png)

### Pozostałe moduły
- **Dashboard** - liczniki produktów i projektów, najnowsze wizualizacje i produkty oraz Twoje zadania z Asany, układane po swojemu.
- **Projekty** - projekty opakowań z etapami.
- **Faktury, Integracja i produkcja** - faktury i koszty, integracje (Asana, Teams) oraz dane produkcyjne produktów.
- **Użytkownicy** (tylko administrator) - lista kont z wyszukiwaniem i filtrami, akceptacja nowych osób, klucze licencji, edycja i wyłączanie kont oraz lista komputerów z dostępem do bazy z przyciskiem „Odłącz komputer”.
- **Profil i Ustawienia** - dane konta, komputery i ścieżki do folderu Marketing (każdy komputer może mieć inną literę dysku), motyw jasny i ciemny, zestawy kolorów.
- **LIVE i LOKALNY** - przełącznik źródła danych: wspólna baza albo tylko pliki z tego komputera.

## Jak to działa

- **Jedna prawda w bazie.** Konta, statusy, tagi i skojarzenia leżą w centralnej bazie PostgreSQL, a plik z dysku Marketing pozostaje źródłem materiałów. Pamięć podręczna miniatur przyspiesza podglądy, a oryginał jest zawsze do otwarcia.
- **Jedno konto, wszędzie.** Logujesz się swoim adresem i hasłem na każdym komputerze. Każdy komputer dostaje w tle własny, ograniczony dostęp do bazy, który administrator może w każdej chwili odłączyć.
- **Instaluj i pracuj.** Instalator zawiera wszystko, czego program potrzebuje: nie trzeba instalować Pythona ani niczego konfigurować. Po instalacji logujesz się kontem firmowym.
- **Aktualizacje same.** Program sprawdza to repozytorium i pobiera nowe wydanie w tle. Wydania są podpisane, więc program instaluje tylko to, co pochodzi od autora. Ręcznie: menu profilu, Sprawdź aktualizacje.
- **Szybki start.** Okno startowe pojawia się od razu, a ponowne kliknięcie ikony w trakcie uruchamiania nie restartuje programu.

## Repozytoria

- **Wydania (to repozytorium, publiczne):** instalatory i podpisy do pobrania. Programy na komputerach czytają stąd aktualizacje, dlatego nazwa tego repozytorium się nie zmienia.
- **Kod źródłowy:** `inyfinn/DAM-src` (prywatne).

## Licencja i autorzy

Oprogramowanie komercyjne. Autor: Krzysztof Marcin Wieczorek. Licencji udziela INYFINN ART sp. z o.o. (Katowice). Pełna umowa licencyjna wraz ze streszczeniem jest w instalatorze i w programie (strona Licencja). Program korzysta z motywu Geex i bibliotek open source na ich własnych licencjach.
