# QA "bez ROOT" - parity gold vs noroot

Po co: sprawdzic, co widzi uzytkownik w DAM, gdy na jego komputerze NIE MA
podpietego folderu Marketing (ROOT: M:\, X:\, D:\Marketing, UNC), w porownaniu
do zlotej aplikacji (z ROOT). Bez tego mozna przeoczyc regresje, ktore ujawniaja
sie tylko na "czystym" komputerze (np. licznik produktow, zaslepki miniatur,
status kompletnosci).

Nic tu nie modyfikuje kodu aplikacji ani zlotej instalacji - tylko czyta przez
HTTP i robi zrzuty headless Chrome.

## Pliki

- `noroot_bridge.py` - nakladka na `local_bridge.py`: udaje komputer bez ROOT
  (M:\, X:\, D:\Marketing, UNC "nie istnieja" dla `os.stat/listdir/open/...`).
  Folder aplikacji podaje sie jawnie: `--app <folder>`.
- `start-noroot.ps1` - startuje most (`noroot_bridge.py`) i serwer statyczny UI
  dla kopii bez ROOT. Startuje kazdy proces TYLKO jesli port jest wolny.
- `shot.js` - zrzut ekranu strony przez CDP (headless Chrome), tryb
  `--target gold` (zlota aplikacja, porty 8765/8766) albo `--target noroot`
  (kopia bez ROOT, porty 9765/9766, z przekierowaniem zapasowych zapytan
  `:8766` na `:9766`).
- `parity.js` - eval wstrzykiwany na stronie: zbiera liczby widoczne w DOM
  (licznik produktow/elementow, liczba kart, status Kompletny/Niekompletny,
  obrazki wczytane/zepsute, zaslepki, a na `project.html` dodatkowo status
  projektu, checklist kompletnosci, liczbe materialow marketingowych i
  obecnosc KPI bento).
- `run-parity.ps1` - dla kompletu stron robi zrzut+eval na obu aplikacjach i
  zapisuje wyniki.

## Jak uruchomic

1. Upewnij sie, ze zlota aplikacja dziala (porty 8765/8766) - **nigdy jej nie
   startuj ani nie zabijaj z tego zestawu skryptow**, tylko czytaj.
2. Uruchom caly komplet:

   ```powershell
   .\run-parity.ps1 -OutDir "C:\sciezka\do\wynikow\parity"
   ```

   Domyslnie uzywa kopii bez ROOT w
   `C:\Users\krzysztof.wieczorek\AppData\Local\DAM-bezroot-test` i sam ja
   wystartuje przez `start-noroot.ps1`, jesli porty 9765/9766 jeszcze nie
   odpowiadaja (idempotentne - jesli juz dzialaja, nic nie rusza).

3. Wyniki w `-OutDir`:
   - `<strona>-gold.png`, `<strona>-noroot.png` - zrzuty ekranu (1530x1170)
   - `parity.json` - liczby z eval dla obu wersji, wszystkie strony
   - `roznice.md` - tylko pola, ktore sie roznia miedzy gold a noroot

## Uwaga

- `project.html` potrzebuje ~12-14 s na doladowanie danych - stąd dluzszy
  `Wait` dla tych stron w `run-parity.ps1`.
- Zrzut ekranu to NIE dowod sam w sobie - zawsze przeczytaj obraz (np.
  narzedziem Read), a nie tylko jego rozmiar w bajtach.
- Porty 9411-9413 sa zajete przez inne harnessy QA w tym repo - `shot.js`
  uzywa 9420 (gold) i 9421 (noroot) dla CDP, zeby ich nie kolidowac.
