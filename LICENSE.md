# UMOWA LICENCYJNA UŻYTKOWNIKA KOŃCOWEGO (EULA)
## Program „DAM - Dobra Kaloria - Inyfinn”

| Pole | Wartość |
|------|---------|
| **Wersja dokumentu** | 2.0 |
| **Data wejścia w życie** | 2026-07-30 |
| **Jurysdykcja** | Rzeczpospolita Polska |
| **Język wiążący** | polski |

---

## SPIS TREŚCI

1. [Definicje](#1-definicje)
2. [Właściciel i przedmiot umowy](#2-właściciel-i-przedmiot-umowy)
3. [Udzielenie licencji](#3-udzielenie-licencji)
4. [Ograniczenia i zakazy](#4-ograniczenia-i-zakazy)
5. [Własność intelektualna](#5-własność-intelektualna)
6. [Opłaty, modele handlowe i fakturowanie](#6-opłaty-modele-handlowe-i-fakturowanie)
7. [Wsparcie, aktualizacje i SLA](#7-wsparcie-aktualizacje-i-sla)
8. [Dane, poufność i RODO](#8-dane-poufność-i-rodo)
9. [Audyt i kontrola licencji](#9-audyt-i-kontrola-licencji)
10. [Komponenty osób trzecich](#10-komponenty-osób-trzecich)
11. [Wyłączenie gwarancji](#11-wyłączenie-gwarancji)
12. [Ograniczenie odpowiedzialności](#12-ograniczenie-odpowiedzialności)
13. [Rozwiązanie umowy](#13-rozwiązanie-umowy)
14. [Postanowienia końcowe](#14-postanowienia-końcowe)
15. [Dane kontaktowe Właściciela](#15-dane-kontaktowe-właściciela)

---

## 1. Definicje

W niniejszej umowie:

- **„Program”** – oprogramowanie komputerowe „DAM - Dobra Kaloria - Inyfinn” (Desktop ETA, warstwa web, most lokalny `local_bridge`, skrypty wdrożeniowe, dokumentacja, konfiguracje, bazy danych wdrożeniowe oraz wszelkie aktualizacje udostępnione przez Właściciela).
- **„Właściciel”** – Krzysztof Wieczorek (kryptonim: Krzysiu), podmiot wyłącznie uprawniony do udzielania licencji.
- **„Licencjobiorca” / „Użytkownik”** – osoba fizyczna lub podmiot, któremu Właściciel **pisemnie** udzielił licencji.
- **„Wdrożenie”** – instancja Programu uruchomiona dla jednej organizacji (jeden tenant logiczny), z określoną liczbą stanowisk.
- **„Stanowisko”** – jedno urządzenie lub jedna sesja użytkownika uprawnionego do korzystania z Programu w ramach Wdrożenia.
- **„Materiały”** – kod źródłowy, binaria, assety UI, schematy baz, dumpy, instrukcje operacyjne, logi projektowe.
- **„Dane Klienta”** – pliki marketingowe, metadane, indeksy, miniatury, wpisy w bazach – nie stanowiące własności Właściciela co do treści, lecz przetwarzane przez Program.

---

## 2. Właściciel i przedmiot umowy

### 2.1. Właściciel wyłączny

Właścicielem wyłącznym Programu oraz Materiałów (z wyjątkiem komponentów osób trzecich, o których mowa w §10) jest:

| Pole | Dane |
|------|------|
| Imię i nazwisko | **Krzysztof Wieczorek** (kryptonim: **Krzysiu**) |
| PESEL (maskowany) | **93*****179** |
| Telefon | **535 295 861** |
| E-mail | **XPRETRAX@GMAIL.COM** |
| Adres zamieszkania | ul. Czartoryskiego 2/4 m. 108, 42-200 Częstochowa |
| Adres korespondencji | ul. Makuszyńskiego 47D / 7, 42-209 Częstochowa |

Właściciel oświadcza, że Program jest jego utworem / wdrożeniem autorskim i przysługują mu **autorskie prawa majątkowe i osobiste** w zakresie dozwolonym ustawą o prawie autorskim i prawach pokrewnych (dalej: **u.p.a.**).

### 2.2. Charakter oprogramowania

Program jest **oprogramowaniem własnościowym (proprietary)**. **Nie** jest oprogramowaniem open-source. Brak udzielenia licencji oznacza brak prawa do używania Programu.

### 2.3. Akceptacja

Instalacja, uruchomienie, logowanie lub korzystanie z Programu (w tym wersji demonstracyjnej) oznacza **akceptację** niniejszej umowy w całości. W razie braku zgody – należy niezwłocznie zaprzestać korzystania i usunąć kopie Programu.

---

## 3. Udzielenie licencji

### 3.1. Zakres

Licencja jest udzielana **wyłącznie na piśmie** (e-mail na adres Właściciela lub dokument podpisany) i obejmuje tylko:

- prawo **używania** Programu wewnętrznie w organizacji Licencjobiorcy;
- w zakresie: liczby stanowisk, modułów, środowisk (prod/test) i okresu – **wyraźnie** określonym w pozwoleniu;
- na terytorium wskazanym w pozwoleniu (domyślnie: Polska / UE, jeśli nie uzgodniono inaczej).

### 3.2. Czego licencja nie obejmuje

Licencja **nie** obejmuje m.in.:

- prawa do publicznego udostępniania kodu lub buildów;
- hostingu multi-tenant / SaaS dla podmiotów trzecich bez osobnej umowy;
- przeniesienia autorskich praw majątkowych;
- tworzenia utworów zależnych (derivative works) poza konfiguracją dozwoloną w dokumentacji;
- odsprzedaży, sublicencji, dzierżawy lub użyczenia bez zgody Właściciela.

### 3.3. Licencja domyślna Właściciela

Korzystanie przez samego Właściciela z Programu nie wymaga odrębnej licencji, lecz podlega niniejszej umowie w zakresie ograniczeń wobec osób trzecich.

---

## 4. Ograniczenia i zakazy

Bez **uprzedniej pisemnej zgody** Właściciela zabrania się w szczególności:

1. **Dystrybucji** – kopiowania, udostępniania, wysyłania lub publikowania Programu lub jego części (w tym repozytorium Git, ZIP, obrazów Docker) osobom nieuprawnionym.
2. **Inżynierii wstecznej** – dekompilacji, deasemblacji, odtwarzania kodu źródłowego, z wyjątkiem przypadków **bezwzględnie** dozwolonych prawem i po uprzednim zawiadomieniu Właściciela.
3. **Usuwania oznaczeń** – znaków towarowych, copyright, numerów wersji, ekranów licencji (`license.html`), metadanych w `LICENSE.md`.
4. **Obejścia zabezpieczeń** – m.in. wiązania sesji z urządzeniem (`machine_id`), kontroli dostępu, limitów stanowisk.
5. **Użytku konkurencyjnego** – budowy produktu DAM/MAM/PIM konkurencyjnego w oparciu o Program lub jego fragmenty.
6. **Benchmarków publicznych** – publikowania wyników testów wydajności Programu bez zgody (benchmarki wewnętrzne dozwolone).
7. **Użytku poza zakresem** – przekroczenia liczby stanowisk, użytkowników lub organizacji objętych pozwoleniem.

Naruszenie któregokolwiek z powyższych punktów uprawnia Właściciela do **natychmiastowego** wygaszenia licencji oraz dochodzenia roszczeń na zasadach prawa polskiego.

---

## 5. Własność intelektualna

1. Wszelkie prawa do Programu, dokumentacji, nazwy „DAM - Dobra Kaloria - Inyfinn”, layoutów UI (z zastrzeżeniem motywu Geex – §10), schematów danych i know-how pozostają przy Właścicielu.
2. Licencjobiorca nabywa wyłącznie **ograniczone prawo użytkowania** (licencję), nigdy własność Programu.
3. **Dane Klienta** (pliki na dysku Marketing, metadane produktów) pozostają własnością Licencjobiorcy / jego organizacji. Program jest narzędziem do ich katalogowania.
4. **Sugestie i feedback** przekazane Właścicielowi mogą być wykorzystane bez obowiązku wynagrodzenia, o ile nie uzgodniono inaczej pisemnie.
5. Właściciel może rejestrować utwór w odpowiednich rejestrach (ZAiKS itd.) – Licencjobiorca nie nabywa do tego uprawnień.

---

## 6. Opłaty, modele handlowe i fakturowanie

### 6.1. Kwoty bazowe (orientacyjne)

Wycena rynkowa DAM/MAM (SMB, 2025–2026): abonamenty cloud ok. **10–50 USD / użytkownik / mies.**; pakiety roczne ok. **2 500–15 000 EUR**; segment mid-market często od ok. **500 EUR / mies.** Dla custom DAM FMCG (Synology, UI lokalne, kilka stanowisk) przyjęto **kwoty bazowe netto**:

| Model | Kwota bazowa (PLN netto) | Zakres domyślny |
|-------|--------------------------|-----------------|
| **Licencja jednorazowa** | **6 900** | 1 organizacja, do 10 stanowisk, 12 mies. wsparcia poprawek krytycznych |
| **Abonament miesięczny** | **490 / mies.** | do 5 aktywnych użytkowników |
| **Abonament rozszerzony** | **890 / mies.** | do 15 aktywnych użytkowników |

### 6.2. Ustalenie indywidualne

Powyższe kwoty są **punktem wyjścia**, nie ofertą wiążącą. **Ostateczna cena, zakres modułów, SLA i forma płatności są zawsze ustalane indywidualnie** z Właścicielem. Właściciel może udzielić licencji nieodpłatnej, obniżyć stawkę lub wstrzymać świadczenie według własnego uznania.

### 6.3. Zaległości

Brak terminowej zapłaty po wystawieniu faktury (jeśli dotyczy) uprawnia Właściciela do **wstrzymania** aktualizacji, wsparcia lub kluczy dostępu do środowisk współdzielonych (Postgres, hosting), po uprzednim wezwaniu e-mailem.

---

## 7. Wsparcie, aktualizacje i SLA

1. **Aktualizacje** – udostępniane według harmonogramu Właściciela; brak obowiązku wstecznej kompatybilności z każdą konfiguracją klienta, chyba że umowa pisemna stanowi inaczej.
2. **Wsparcie** – kanały: e-mail Właściciela; czas reakcji uzgadniany indywidualnie (brak domyślnego SLA 24/7).
3. **Poprawki krytyczne** – w ramach licencji jednorazowej: 12 miesięcy od daty wdrożenia, o ile nie uzgodniono dłużej.
4. **Środowisko** – Licencjobiorca odpowiada za backup danych, dostęp do dysku Marketing i infrastruktury (NAS, PostgreSQL, sieć).

---

## 8. Dane, poufność i RODO

1. Program może przetwarzać **Dane Klienta** wyłącznie w celu świadczenia funkcji DAM (indeksowanie, miniatury, metadane, sesje użytkowników).
2. Właściciel jako twórca oprogramowania **nie** przejmuje własności plików marketingowych; pełni rolę administratora / podmiotu przetwarzającego **tylko** jeśli tak uzgodniono umową powierzenia (DPA).
3. **PESEL** w dokumentacji publikowany jest wyłącznie w formie maskowanej. Pełny PESEL i dane dowodu osobistego **nie** są publikowane.
4. Strony zobowiązują się do **zachowania poufności** know-how technicznego Programu i warunków handlowych, o ile nie muszą być ujawnione prawem.
5. Szczegóły RODO: `privacy.html`, `consents.html` w warstwie web Programu.

---

## 9. Audyt i kontrola licencji

Właściciel (lub upoważniony audytor) ma prawo, po **7-dniowym** uprzedzeniu e-mailem, przeprowadzić **audyt** zgodności z licencją (liczba stanowisk, środowiska, kopie Programu). Licencjobiorca udzieli rozsądnej współpracy. Koszty audytu ponosi Właściciel, chyba że audyt wykaże istotne naruszenie – wtedy koszty może ponieść Licencjobiorca.

---

## 10. Komponenty osób trzecich

1. **Motyw UI Geex** – używany zgodnie z licencją zakupu motywu; niniejsza EULA nie rozszerza praw do Geex.
2. **Open source** (m.in. Bootstrap, jQuery, Unicons, ApexCharts, GSAP, Python packages) – na warunkach ich licencji (MIT, Apache, BSD itd.). Lista w `package.json` / `requirements.txt` / vendor w `apps/web/assets/vendor`.
3. **PostgreSQL, Synology DSM, Web Station** – infrastruktura klienta / Właściciela, osobne umowy z dostawcami.
4. W razie konfliktu licencji komponentu OS z niniejszą EULA – **pierwszeństwo** ma licencja OS dla tego komponentu.

---

## 11. Wyłączenie gwarancji

PROGRAM JEST DOSTARCZANY W STANIE **„AS IS”** I **„AS AVAILABLE”**, W NAJSZERSZYM ZAKRESIE DOZWOLONYM PRAWEM.

Właściciel **nie gwarantuje**, że Program:

- będzie działał nieprzerwanie lub bez błędów;
- spełni wszystkie indywidualne oczekiwania biznesowe Licencjobiorcy;
- będzie kompatybilny z każdą przyszłą wersją systemu operacyjnego, przeglądarki lub NAS.

Jedyną formą gwarancji mogą być **postanowienia umowy pisemnej** zawartej osobno między stronami.

---

## 12. Ograniczenie odpowiedzialności

1. Właściciel **nie ponosi** odpowiedzialności za utracone korzyści, utratę danych (w zakresie dozwolonym prawem), szkody pośrednie lub wtórne wynikłe z korzystania lub niemożności korzystania z Programu.
2. Łączna odpowiedzialność odszkodowawcza Właściciela wobec Licencjobiorcy (jeśli w ogóle przysługuje) jest ograniczona do **wysokości opłat faktycznie zapłaconych** za Program w **12 miesięcy** poprzedzających zdarzenie, chyba że szkoda wynikła z **umsyślnego** działania Właściciela.
3. Powyższe nie wyłącza odpowiedzialności, której wyłączyć nie można na mocy bezwzględnie obowiązujących przepisów prawa polskiego.

---

## 13. Rozwiązanie umowy

1. Licencja **wygasa** z chwilą: upływu okresu, na jaki została udzielona; rozwiązania umowy pisemnej; naruszenia §4; braku zapłaty (jeśli dotyczy).
2. Po wygaśnięciu Licencjobiorca **usuwa** kopie Programu i przestaje korzystać z usług współdzielonych (bazy, hosting), o ile Właściciel nie zezwoli inaczej na piśmie.
3. Postanowienia §5, §8 (poufność), §11, §12 i §14 pozostają w mocy po rozwiązaniu.

---

## 14. Postanowienia końcowe

1. **Prawo właściwe** – prawo polskie.
2. **Sąd** – sąd właściwy dla siedziby / miejsca zamieszkania Właściciela, o ile przepisy bezwzględnie obowiązujące nie stanowią inaczej.
3. **Zmiany EULA** – Właściciel może zaktualizować niniejszy dokument; nowa wersja obowiązuje od daty publikacji w repozytorium / `license.html`. Dalsze korzystanie po publikacji = akceptacja, o ile Licencjobiorca nie wypowie licencję w terminie 14 dni.
4. **Rozdzielność** – nieważność jednego postanowienia nie wpływa na ważność pozostałych.
5. **Całość umowy** – niniejsza EULA wraz z pisemnym pozwoleniem na licencję, `terms.html`, `privacy.html` i `consents.html` stanowią całość porozumienia, o ile nie zawarto umowy głównej stanowiącej inaczej.

---

## 15. Dane kontaktowe Właściciela

Wszelkie zgody, pozwolenia, wypowiedzenia i korespondencja prawna:

- **E-mail:** XPRETRAX@GMAIL.COM  
- **Telefon:** 535 295 861  
- **Adres korespondencji:** ul. Makuszyńskiego 47D / 7, 42-209 Częstochowa  

---

**© 2026 Krzysztof Wieczorek. Wszelkie prawa zastrzeżone.**

*Identyfikator produktu: DAM-DOBRAKALORIA-INYFINN | Wersja dokumentu EULA: 2.0*
