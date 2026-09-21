> # ⚠ DOKUMENT NIEAKTUALNY — NIE WYKONYWAĆ
>
> Zastąpiony 2026-09-21 po rozpoznaniu kodu. **Dwa twierdzenia w tym pliku są błędne:**
>
> 1. **Sekcja B3 każe budować PyInstallerem `engine_launcher.py` — to jest złe.**
>    `engine_launcher.py:57-67` wymaga zmiennych `DAM_HANDSHAKE_PIPE`/`DAM_HANDSHAKE_NONCE`
>    od bootstrapu Go, inaczej wypisuje „Nie uruchamiaj silnika bezposrednio" i kończy kodem 17.
>    `_find_pythonw()` (`:106-110`) szuka wyłącznie `bin/runtime/win/python/pythonw.exe`.
>    Poprawnie: cienki shim `bin/apps/desktop/dam_mac_shim.py` + `bin/tooling/build/DAM-macos.spec`.
> 2. **Twierdzi, że port to „port od zera" — nieprawda.** `bin/apps/desktop/dam_macos.py`
>    już istnieje i jest kompletną ścieżką startową macOS; `__main__.py:18` do niej kieruje.
>
> Aktualny plan: `C:\Users\xpret\.claude\plans\declarative-weaving-corbato.md`.
> Gałąź robocza: `macos-port`.

# Plan: DAM na Windows i macOS — jeden kod, dwa instalatory

Rewizja: 1 · 2026-09-21 · status: NIEAKTUALNY (patrz ramka wyżej)
plan_kind: production · przebiegi: draft + 1 autokrytyka (nie 10 rund MAD — powód w sekcji „Uczciwość procesu”)
Gałąź robocza: `macos-port` (tymczasowa, scalana do `main`)

## O co chodzi?

DAM działa dziś tylko na Windows. Ma działać też na Macu, ale **bez rozdzielania projektu na dwie wersje**:
jeden kod, jedna gałąź, z której powstają dwa instalatory — `DAM-Setup.exe` dla Windows i `DAM.dmg` dla macOS.
Jedna poprawka funkcji ma od razu działać po obu stronach. Rozpoznanie kodu pokazało, że aplikacja jest już
w dużej części przygotowana na inne systemy: `launch.py` i `engine_launcher.py` mają rozgałęzienia, które na
nie-Windows po prostu pomijają windowsowe elementy, zamiast się wywalać. Zostaje policzalna lista miejsc do dorobienia.

## Czego ten plan NIE robi

- Nie używa Wine, Porting Kit ani Wineskin (to narzędzia do cudzych `.exe` bez źródeł; my mamy źródła).
- Nie robi wersji na iOS (telefony) — tam ta aplikacja nie pójdzie i nie taki jest cel.
- Nie przepisuje aplikacji. Zmienia ~6 rodzajów wywołań i dokłada build.
- Nie rusza `main` do momentu, aż port będzie zielony.

## Warstwa A — kroki dla użytkownika

### Krok 1. Zabezpieczenie punktu wyjścia
- **Co jest źle:** na dysku leży praca niezacommitowana; gdyby port coś popsuł, nie ma punktu powrotu.
- **Co zrobimy:** commit i push obecnego stanu, potem gałąź robocza `macos-port`.
- **Gotowe gdy:** `git log origin/main -1` pokazuje Twój commit, a `git branch` pokazuje `macos-port`. Od tej chwili `main` jest nietykalny — `git switch main` zawsze wraca do działającej wersji Windows.

### Krok 2. Jedno miejsce na różnice między systemami
- **Co jest źle:** windowsowe rzeczy (rejestr, `%LOCALAPPDATA%`, otwieranie pliku, pokazanie w folderze) siedzą rozrzucone po plikach.
- **Co zrobimy:** jeden nowy plik `platform_paths.py` z sześcioma funkcjami; reszta kodu wywołuje jego, nie systemu bezpośrednio.
- **Gotowe gdy:** `grep os.startfile` i `grep winreg` w `bin/apps/desktop` nie zwracają nic poza tym jednym plikiem; DAM na Windows startuje i loguje tak jak dziś (zrzut `win-po-kroku-2.png`: ekran logowania bez zmian).

### Krok 3. Dyski z danymi
- **Co jest źle:** ścieżki do materiałów są zapisane jako litery dysków (`M:\`, `X:\Marketing`) — na Macu nie istnieją.
- **Co zrobimy:** lista kandydatów rozszerzona o odpowiedniki macOS (`/Volumes/...`), z zachowaniem dotychczasowej kolejności dla Windows.
- **Gotowe gdy:** na Windows wykrywanie dysków działa jak dziś; w ustawieniach na Macu widać pole z wykrytą ścieżką albo czytelny komunikat „nie znaleziono nośnika”, a nie pusty ekran.

### Krok 4. Budowanie na Macu bez Maca
- **Co jest źle:** nie masz Maca do testów, a PyInstaller nie buduje skrośnie.
- **Co zrobimy:** GitHub Actions na runnerze `macos-latest` (darmowe, repo jest publiczne) buduje wersję mac przy każdym pushu na gałąź.
- **Gotowe gdy:** w zakładce Actions na GitHubie widzisz zielony przebieg i artefakt `DAM-macos.zip` do pobrania. Czerwony przebieg = lista konkretnych błędów, które naprawiamy; to jest tańsze niż zgadywanie.

### Krok 5. Pierwsze prawdziwe uruchomienie
- **Co jest źle:** zielony build nie znaczy, że aplikacja startuje.
- **Co zrobimy:** uruchomienie na Macu (Twoim, brata albo przez akcję zdalną) i przejście: start → ekran logowania → zalogowanie → miniatury.
- **Gotowe gdy:** zrzut `mac-logowanie.png` pokazuje ekran logowania DAM na macOS, a `mac-po-zalogowaniu.png` pokazuje listę produktów z miniaturami.

### Krok 6. Instalator `.dmg`
- **Co jest źle:** `.zip` z aplikacją to nie instalator.
- **Co zrobimy:** `.dmg` z ikoną aplikacji i skrótem do `/Applications` (`create-dmg`), budowany w tym samym przebiegu CI.
- **Gotowe gdy:** po pobraniu `.dmg` i przeciągnięciu ikony do Aplikacji, DAM startuje z Launchpada.

### Krok 7. Jeden release = dwa pliki
- **Co jest źle:** dziś release ma tylko `DAM-Setup.exe`.
- **Co zrobimy:** przy tagu `v*` release dostaje oba pliki — `.exe` (build lokalny, jak dziś) i `.dmg` (z CI).
- **Gotowe gdy:** strona release na GitHubie pokazuje dwa pliki do pobrania.

## Decyzje potrzebne od Ciebie (blokują odpowiednie kroki)

1. **Konto Apple Developer (99 USD/rok)** — bez niego `.dmg` działa, ale przy pierwszym uruchomieniu macOS pokazuje ostrzeżenie i trzeba klikać „Otwórz mimo to” (prawy klik → Otwórz). Z kontem: podpis + notaryzacja, otwiera się normalnie. Blokuje tylko krok 6 w wersji „bez ostrzeżeń”.
2. **Dostęp do Maca do testów** (krok 5) — Twój, brata, czy żaden? Bez tego kroki 1–4 i tak idą, ale 5–7 stoją.
3. **Gdzie na Macu są materiały** — te same zasoby z Synology montowane po SMB (`/Volumes/Marketing`), czy inaczej? Bez odpowiedzi krok 3 dostanie tylko automatyczne wykrywanie.

## Warstwa B — załącznik techniczny

### B1. Nowy moduł `bin/apps/desktop/platform_paths.py`

| Funkcja | Windows dziś | macOS |
| --- | --- | --- |
| `user_data_dir()` | `%LOCALAPPDATA%\DAM` | `~/Library/Application Support/DAM` |
| `install_dir()` | `%LOCALAPPDATA%\Programs\DAM` | `/Applications/DAM.app` |
| `open_file(p)` | `os.startfile(p)` (4 wywołania) | `subprocess.run(["open", p])` |
| `reveal_in_folder(p)` | `explorer /select,p` | `subprocess.run(["open", "-R", p])` |
| `machine_id()` | `winreg` — `machine_identity.py:46` | `IOPlatformUUID` z `ioreg`, fallback `uuid.getnode()` |
| `no_window_kwargs()` | `CREATE_NO_WINDOW` (49 miejsc) | `{}` |

Wzorce zastępowania: `machine_identity.py:46`, `preflight.py:192` (winreg), `os.startfile` ×4, `explorer /select` w `local_bridge.py`.
`CREATE_NO_WINDOW` w większości już jest pod `if sys.platform == "win32"` — sprawdzić 49 wystąpień, podmienić tylko niestrzeżone.

### B2. Korzenie danych
`dam_path_resolve.py:19-21` (`ROOTS`), `:224-232` (`EXTRA_KARTA_ROOTS`, `EXTRA_DOC_ROOTS`), `marketing_discovery.py` (9 miejsc), `local_bridge.py` (18, głównie docstringi — sprawdzić, które są kodem).
Wzorzec: `ROOTS_WIN` + `ROOTS_DARWIN`, wybór po `sys.platform`; kolejność Windows bez zmian (HARD z komentarza w `dam_path_resolve.py:17`).

### B3. `.github/workflows/macos-build.yml`
```yaml
on: { push: { branches: [macos-port] }, workflow_dispatch: {}, release: { types: [published] } }
runs-on: macos-latest
```
Kroki: `actions/setup-go@v5` (1.23) → `go build -ldflags="-s -w" -o DAM` w `bin/apps/desktop/bootstrap` (bez `-H windowsgui`, to flaga tylko Windows)
→ `actions/setup-python@v5` (3.12) → `pip install -r bin/apps/desktop/requirements.txt pyinstaller`
→ `pyinstaller --noconfirm --clean --onedir --windowed --name dam-appw --icon <icns> engine_launcher.py`
→ `actions/upload-artifact@v4`.
Ikona: PyInstaller na macOS wymaga `.icns`, jest tylko `dam_app.ico` — konwersja `sips`/`iconutil` w CI albo dorobienie pliku.

### B4. Ryzyka zależności (do weryfikacji w pierwszym przebiegu CI, nie zgadywać)
`rapidocr-onnxruntime` i `psd-tools` — sprawdzić dostępność kół arm64. Jeśli brak: oznaczyć jako opcjonalne (import w `try`), bo to funkcje dodatkowe (OCR, PSD), nie rdzeń.
`pystray` na macOS wymaga głównego wątku — sprawdzić, czy ikona w pasku nie blokuje startu.

### B5. Weryfikacja (nie „plik istnieje”)
- Krok 2: Windows — DAM startuje, logowanie działa (zrzut). `grep` nie znajduje `winreg`/`startfile` poza `platform_paths.py`.
- Krok 4: przebieg CI zielony, artefakt niepusty (> 50 MB).
- Krok 5: dwa zrzuty z macOS (logowanie, lista produktów).
- Krok 6: `.dmg` montuje się, aplikacja startuje z `/Applications`.
- Krok 7: release pokazuje 2 pliki.

## Autokrytyka (przebieg 2) i co zmieniła

- **[falszywy_PASS]** Kroki 4 i 6 kończyły się na „CI zielone”. Zielony build nie dowodzi, że aplikacja startuje → dodano krok 5 z dwoma nazwanymi zrzutami jako osobną bramkę.
- **[scope_usera]** Brief mówił „jedna gałąź, dwa instalatory”. Draft prowadził długowieczną gałąź portu → poprawione: `macos-port` jest tymczasowa i scala się do `main`, po scaleniu jest jeden kod na zawsze.
- **[kontekst]** Draft zakładał, że kod jest Windows-only. Weryfikacja pokazała istniejące rozgałęzienia `sys.platform` w `launch.py` (10) i `engine_launcher.py` (3), łagodnie pomijające → skala kroku 2 zmniejszona z „przepisać” do „scentralizować”.
- **[ryzyko_modelowe]** Draft podawał `.icns` jako oczywiste; w repo jest tylko `.ico` → dopisane jako konkretny podkrok B3.
- **[zasoby]** Nie ma Maca lokalnie. Zamiast pisać kod na ślepo, krok 4 celowo idzie przed kodowaniem mac-specyficznym: pierwszy czerwony przebieg CI da prawdziwą listę błędów zamiast moich domysłów.
- Otwarte krytyczne: 0. Otwarte decyzje użytkownika: 3 (konto Apple, dostęp do Maca, lokalizacja materiałów).

## Uczciwość procesu

Skill `planner` przewiduje 10 rund Planner/Critic na `plan_kind: production`. Zrobiłem **2 przebiegi własne** (draft + autokrytyka),
bez subagentów — bo 10 rund × 2 modele to koszt porównywalny z tym, co 17.09 zjadło budżet sesji, a `CLAUDE.md` §0 pkt 9 każe pytać
przed masowym odpalaniem subagentów. Jeśli chcesz pełną radę modeli (Planner + Critic jako osobne subagenty, 10 rund), powiedz — uruchomię.
