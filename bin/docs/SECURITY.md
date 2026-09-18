# Bezpieczeństwo DAM - podręcznik administratora

Dokument dla administratora programu i dla przyszłych agentów. Opisuje stan po audycie
z 2026-09-17: co przed czym chroni, jak wydać nową wersję, jak przekazać kod aktywacyjny,
jak odblokować adres IP i co zrobić przy zmianie haseł.

Reguły wiążące (źródło prawdy dla kodu) są w `apps/web/data/program-instructions.json`,
wpisy o identyfikatorach `security.*`. Ten plik je tłumaczy na procedury.

---

## 1. Model zagrożeń

Co jest wystawione na świat:

| Element | Dostępność | Ryzyko |
|---|---|---|
| Repozytorium GitHub | publiczne | każdy czyta kod, historię i wszystko, co kiedykolwiek do niej trafiło |
| Wydania GitHub (DAM-Setup.exe) | publiczne | każdy pobiera instalator i może go rozpakować |
| Synology (Postgres 5433, panel WWW, most pod `/dam-api/`) | z internetu | zgadywanie haseł, skanowanie portów, podstawione żądania |
| Komputery użytkowników | praca z domu i z biura | kopia dysku, inny użytkownik tego samego PC |

Co wykryto 2026-09-17 (i co zostało załatane):

1. Instalator woził jawne hasło do bazy Postgres. Każdy, kto pobrał wydanie, miał hasło.
2. Konta seed miały wspólne, słabe hasło znane z publicznego repozytorium.
3. Most działał też publicznie na NAS, a część tras nie wymagała logowania.
4. Aktualizacje weryfikowała tylko suma SHA-256 publikowana obok pliku.

**Uwaga, która nie znika przez łatki:** hasło do Postgresa, które wyszło w starych,
publicznych instalatorach, jest spalone do chwili jego zmiany na Synology. Zobacz rozdział 7.

---

## 2. Co przed czym chroni

| Mechanizm | Plik | Chroni przed |
|---|---|---|
| Zapieczętowana konfiguracja bazy + kod aktywacyjny | `apps/desktop/pg_seal.py`, `scripts/ops/seal-pg-config.py` | odczytaniem hasła do bazy z pobranego instalatora |
| DPAPI na aktywowanej konfiguracji | `apps/desktop/pg_seal.py` | odczytaniem hasła z kopii dysku albo przez innego użytkownika tego PC |
| Podpis wydania Ed25519 | `apps/desktop/release_verify.py`, `scripts/ops/sign-release.py` | podmianą instalatora w wydaniu (także po przejęciu konta GitHub) |
| Kontrola nagłówka `Host` w moście | `apps/desktop/local_bridge.py`, `dam_ui_http.py` | atakiem DNS rebinding na most `127.0.0.1` |
| Tryb publiczny (`PUBLIC_MODE`) | `apps/desktop/local_bridge.py` | wywołaniem z internetu tras, które operują na dysku komputera |
| Blokada IP 3 próby / 999 minut | `apps/desktop/ip_guard.py` | zgadywaniu haseł z internetu |
| Polityka haseł (min. 10 znaków, lista słabych) | `apps/desktop/auth_store.py` | logowaniu hasłem znanym z publicznego repozytorium |
| Wykluczenia w synchronizacji panelu | `scripts/ops/synology/dam-sync-panel-web.sh` | wystawieniu danych firmowych w publicznym katalogu WWW |

Czego te mechanizmy **nie** załatwiają: szyfrowania ruchu do Postgresa z przypięciem
certyfikatu (`sslmode=require` nie chroni przed podmianą serwera), dostępu fizycznego do
NAS oraz haseł, które użytkownik sam komuś poda.

---

## 3. Wydanie nowej wersji krok po kroku

Na maszynie budującej, czyli każdej, która ma folder roboczy z `bin\secrets`:

1. **Wersja.** Podbij w czterech miejscach naraz: `apps/web/version.json`,
   `apps/web/assets/js/dam-version.js`, `apps/desktop/runtime_config.py` (`APP_VERSION`),
   `installer/DAM-Setup.iss` (`MyAppVersion`). Build czyta `version.json`.
2. **Build.**

   ```powershell
   powershell -NoProfile -File bin\scripts\ops\build-installer.ps1
   ```

   Build sam pieczętuje konfigurację bazy (`pg-config.sealed.json`), podpisuje pliki
   Authenticode i wywołuje podpis wydania. Gdy pieczętowanie albo podpis się nie uda,
   build przerywa. Jawnego hasła nie ma prawa być w katalogu staging.
3. **Podpis wydania** (build robi to sam; ręcznie tylko przy powtórce):

   ```powershell
   python bin\scripts\ops\sign-release.py sign bin\instalator\DAM-Setup.exe --version 2.0.8
   python bin\scripts\ops\sign-release.py verify bin\instalator\DAM-Setup.exe
   ```

4. **Test czystej instalacji** w Windows Sandbox (przed publikacją):
   `mkdir C:\Temp\dam-sandbox-out`, potem dwuklik `bin\scripts\ops\sandbox-smoke.wsb`.
   Po kilku minutach w folderze wyników ma być `summary.json` z `"result": "PASS"`,
   a w `preflight.json` punkty bazy, folderu Marketing, indeksu i watchera.
5. **Publikacja.** Do wydania GitHub wgraj **oba** pliki: `DAM-Setup.exe`
   **i** `DAM-Setup.exe.sig`. Bez `.sig` aplikacja odrzuci aktualizację.
6. **Kod aktywacyjny.** Jeżeli się zmienił (zobacz rozdział 4), przekaż go użytkownikom
   osobno od instalatora.

---

## 4. Kod aktywacyjny

* Kod leży w folderze roboczym w `bin\secrets\activation-code.txt` (decyzja użytkownika
  z 2026-09-18) albo w zmiennej `DAM_ACTIVATION_CODE`. Stara lokalizacja
  `%USERPROFILE%\.dam\activation-code.txt` jest czytana tylko jako zapas. Nowy kod powstaje
  wyłącznie wtedy, gdy nie ma go w żadnym z tych miejsc, bo zmiana kodu wymusza ponowną
  aktywację wszystkich komputerów.
* Format: 25 znaków base32 w pięciu grupach, np. `ABCDE-FGHIJ-KLMNP-QRSTU-VWXYZ`.
  Przy wpisywaniu wielkość liter, spacje i myślniki nie mają znaczenia.
* Kod przekazuje się **inną drogą niż instalator**: telefonicznie albo SMS-em. Nigdy
  mailem z linkiem do wydania, nigdy w repozytorium, nigdy w tym pliku.
* Użytkownik wpisuje kod na ekranie logowania, gdy program o niego poprosi. Bez kodu
  program działa w trybie offline na lokalnym SQLite.
* **Zmiana kodu = nowy build.** Komputery już aktywowane działają dalej, bo mają
  konfigurację zapisaną pod DPAPI.
* Po pięciu błędnych próbach w ciągu minuty aktywacja czeka minutę (`pg_seal`).

Kopia zapasowa kodu: trzymaj ją poza repozytorium i poza folderem synchronizowanym
(menedżer haseł albo koperta w sejfie). Utrata kodu przy zachowanym pliku
`activation-code.txt` nie boli; utrata obu = trzeba wydać nowy build z nowym kodem.

---

## 5. Klucz podpisujący wydania

* Klucz prywatny: `bin\secrets\release-signing-key.pem` w folderze roboczym (albo ścieżka
  z `DAM_RELEASE_KEY`; zapasowo stara lokalizacja `%USERPROFILE%\.dam`). Nigdy w
  repozytorium: `bin\secrets` wykluczają dwie reguły `.gitignore` (`/bin/*` i `**/*secret*`),
  a build przerywa się, jeśli `*.pem` albo `activation-code.txt` trafi do paczki.
* **Świadome ryzyko (decyzja użytkownika 2026-09-18):** folder roboczy na `D:` synchronizuje
  się przez Synology Drive z **firmowym** NAS-em (administratorkubara), do którego użytkownik
  nie ma dostępu administracyjnego. Administratorzy IT firmy mogą więc odczytać klucz
  podpisujący i kod aktywacyjny. Zysk: build i podpis działają z każdego komputera z tym
  folderem. Gdy aplikacja stanie się produkcyjna, przenieś oba pliki poza folder
  synchronizowany i wskaż je zmiennymi `DAM_RELEASE_KEY` i `DAM_ACTIVATION_CODE`.
* Klucz publiczny jest przypięty w `apps/desktop/release-pubkey.json` i jedzie z aplikacją.
* Kopia zapasowa: zaszyfrowany nośnik trzymany poza biurem albo menedżer haseł. Sam plik
  PEM wystarczy do podpisywania, więc traktuj go jak hasło do wszystkich komputerów.
* **Gdy klucz zginie albo wycieknie:**
  1. `python bin\scripts\ops\sign-release.py init` tworzy nową parę i dopisuje nowy klucz
     publiczny do `release-pubkey.json` (stary wpis zostaw, żeby stare wydania nadal się
     weryfikowały; przy wycieku stary wpis usuń).
  2. Zbuduj i podpisz nowe wydanie nowym kluczem.
  3. Użytkownicy, którzy mają starą wersję z samym starym kluczem publicznym, muszą
     **zainstalować to wydanie ręcznie** (pobrać `DAM-Setup.exe` i uruchomić). Automatyczna
     aktualizacja ich nie przeniesie, bo nie zna nowego klucza.

---

## 6. Odblokowanie adresu IP

Reguła: 3 nieudane logowania z jednego adresu w ciągu 999 minut blokują adres na stałe.
Biuro (`89.25.208.179`) jest na białej liście, więc pomyłki w biurze nie odcinają firmy.

Odblokowanie: zaloguj się jako administrator, wejdź w **Ustawienia -> Zablokowane adresy IP**,
znajdź adres i kliknij odblokuj. Widżet pokazuje też białą listę i licznik prób.

Dodatkowe adresy na białą listę: zmienna `DAM_IP_ALLOWLIST` (adresy po przecinku) przy
starcie mostu. Stan blokad leży w bazie, więc przeżywa restart mostu i widać go z każdego
komputera administratora.

Blokada dotyczy trybu publicznego (most na NAS zna prawdziwy adres z nagłówka `X-Real-IP`
od nginx). Na komputerze użytkownika klientem jest zawsze `127.0.0.1`, tam działa limit
prób na konto (8 prób w 5 minut).

---

## 7. Zmiana hasła do Postgresa na Synology

To jedyny krok, który realnie unieważnia hasło z opublikowanych wcześniej instalatorów.
Kolejność jest ważna, bo w trakcie zmiany program przechodzi w tryb offline.

1. **Synology:** w DSM (albo przez `psql`) zmień hasło użytkownika bazy:
   `ALTER USER <uzytkownik> WITH PASSWORD '<nowe-haslo>';`
2. **Maszyna budująca:** wpisz nowe hasło do lokalnego, nieśledzonego pliku
   `bin/apps/desktop/data/pg-config.json` (plik jest w `.gitignore` i służy tylko jako
   źródło dla builda).
3. Zbuduj nowe wydanie (rozdział 3). Build zapieczętuje nową konfigurację. Jeżeli przy
   okazji zmieniasz kod aktywacyjny, zrób to przed buildem.
4. **Komputery użytkowników.** Uwaga, to nie dzieje się samo: komputer już aktywowany ma
   stare hasło zapisane pod DPAPI w `bin\apps\desktop\data\pg-config.dpapi`, a program
   uznaje taką instalację za skonfigurowaną (`pg_db.activation_required()` zwraca fałsz).
   Po zmianie hasła taki komputer po prostu nie połączy się z bazą i będzie pracował
   offline. Żeby wrócił do bazy:
   1. zainstaluj nowe wydanie (nowa zapieczętowana konfiguracja),
   2. zamknij DAM i usuń plik `bin\apps\desktop\data\pg-config.dpapi` w folderze instalacji,
   3. uruchom DAM i wpisz kod aktywacyjny.

   Krótko: **po zmianie hasła bazy wszystkie komputery trzeba aktywować ponownie.**
5. **NAS:** most na Synology czyta konfigurację ze swojego katalogu. Po zmianie hasła
   zaktualizuj ją tam i zrestartuj most (rozdział 9).

---

## 8. Hasła kont użytkowników

* Minimum 10 znaków. Odrzucane są hasła z listy słabych, hasło równe części adresu e-mail
  przed `@` oraz hasła zbudowane z mniej niż czterech różnych znaków.
* Logowanie poprawnym, ale słabym hasłem **nie daje sesji**: program od razu prosi o zmianę
  hasła (`password_change_required`). Dopiero nowe hasło otwiera aplikację.
* Zmiana hasła przez użytkownika: okno na ekranie logowania (`dam-password-change.js`,
  `POST /auth/change-password`). Wymaga starego hasła i unieważnia wszystkie sesje konta.
* Zmiana hasła przez administratora (reset komuś, kto zapomniał). Skrypt sam zapyta
  o nowe hasło, więc nie trafia ono do historii poleceń:

  ```powershell
  python bin\apps\desktop\scripts\set-user-password.py --email imie.nazwisko@kubara.pl
  ```

  Wszystkim kontom naraz (handover): `set-all-passwords.py` z `DAM_SEED_PASSWORD`
  (minimum 10 znaków, słabe hasła odrzucane).

  Hasło tymczasowe przekaż poza aplikacją i poproś o zmianę przy pierwszym logowaniu
  (program i tak jej zażąda, jeżeli hasło nie spełnia polityki).
* Nigdy nie zapisuj haseł w repozytorium, w komunikatach commitów ani w dokumentacji.

---

## 9. Tryb publiczny mostu na NAS

* Włącza go `DAM_PUBLIC_MODE=1` albo `DAM_UI_ORIGIN` spoza loopback (tak działa
  `scripts/ops/synology/start-dam-bridge.sh`, który ustawia
  `DAM_UI_ORIGIN=https://inyfinn.synology.me/Panel-DAM`).
* Zmienne, które mają znaczenie: `DAM_UI_ORIGIN` (adres panelu), `DAM_PUBLIC_MODE`,
  `DAM_PUBLIC_HOSTS` (dodatkowe dozwolone nazwy w nagłówku `Host`), `DAM_IP_ALLOWLIST`.
* Bez sesji dostępne są tylko trasy z `PUBLIC_ANON_PATHS` (logowanie, zmiana hasła, status).
  Trasy komputera użytkownika (`/open`, `/reveal`, `/pick-folder`, `/preflight`,
  `/db/activate`, `/telemetry/tail`, aktualizacje) są w trybie publicznym wyłączone.
* Anonimowe `/health` zwraca tylko `{ok, service}`.
* **Po `git pull` na NAS trzeba zrestartować most**, inaczej nadal działa stary kod:

  ```sh
  kill "$(cat /volume1/web/_nginx/dam-bridge.pid)"
  sh ".../bin/scripts/ops/synology/start-dam-bridge.sh"
  ```

* Do publicznego katalogu WWW idą wyłącznie pliki interfejsu. Dane firmowe (faktury,
  koszty, skrzynka, dane osobowe) są wykluczone w `dam-sync-panel-web.sh`
  i `deploy-panel-dam-synology.ps1`. Po każdej zmianie listy wykluczeń sprawdź, co
  faktycznie leży w katalogu na NAS.

---

## 10. Gdy coś pójdzie nie tak

| Objaw | Pierwszy ruch |
|---|---|
| Użytkownik widzi pusty ekran zamiast plików | pasek na górze strony (preflight) mówi, czego brakuje: folderu Marketing, indeksu albo działającego watchera |
| Program prosi o kod aktywacyjny u kogoś, kto już go wpisywał | skasowany `pg-config.dpapi` albo nowa instalacja; podaj kod ponownie |
| Program pracuje offline mimo dostępu do sieci | sprawdź, czy hasło bazy nie zostało zmienione bez ponownej aktywacji (rozdział 7) |
| Aktualizacja się nie instaluje | w wydaniu brakuje `DAM-Setup.exe.sig` albo podpisano innym kluczem |
| Ktoś nie może się zalogować z domu po literówkach | jego adres IP jest zablokowany, odblokuj w Ustawieniach (rozdział 6) |

Powiązane dokumenty: `GO_LIVE.md` (odbiór wdrożenia), `installer/CODE-SIGNING.md`
(podpis Authenticode i Ed25519), `docs/SYNOLOGY-WEB-PANEL.md` (panel na NAS),
`WAZNA-CHECKLISTA-UZYTKOWNIKA.md` (lista dla użytkownika).
