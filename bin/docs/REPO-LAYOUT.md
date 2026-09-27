# Uklad repo (od porzadkowania 2026-09-27)

- **Korzen repo** (`ROOT`): `DAM.exe` (launcher), `bin\` (patrz nizej),
  `work\` (wewnatrz repo na dysku, ale poza gitem - patrz `work\README.md`
  i uwaga o Synology Drive tam), pliki samego repo (`.git`, `.github`,
  `.cursor`, `.gitignore`, `.gitattributes`, `.gitleaks.toml`, `CLAUDE.md`,
  `*.code-workspace`).

  Dwie kategorie plikow zostaly w korzeniu CELOWO, nie przez zaniedbanie:
  - **Zywe, uzywane przez aplikacje** (nigdy nie przenosic bez zmiany kodu):
    `URUCHOM-DAM.bat` - launcher, do ktorego wprost odsyla
    `bin/apps/web/assets/js/dam-api.js:686` gdy most padnie; `POPRAWKI.md` i
    `poprawki.jsonl` - program sam tu pisze (panel Pomoc -> "Zglos
    poprawke"), katalog zapisu ustala `reports_root()` w
    `bin/apps/desktop/support_reports.py:115`.
  - **Tracked smieci/notatki bez zywego odwolania w kodzie**, zostawione bo
    przenoszenie tracked plikow to `git mv` (decyzja czlowieka, nie ruch
    plikow): `PLAN-INSTALATOR.md`, `_backup-dash-bento-2026-09-10\`,
    `_backup-shell-geex-2026-09-10\`, `_fffd.txt`.

- **`bin\`**: wszystko, czego aplikacja (desktop + web) i build instalatora
  realnie potrzebuja - `apps\`, `agents\`, `scripts\`, `THEME\`, `docs\`,
  `installer\`, `instalator\`, `DATABASE\` (tylko `README.md` i
  `users-seed.sqlite` sa tracked, `dam-local.sqlite` jest live), `runtime\`
  (vendorowany Python), `PAMIEC-PODRECZNA\` (cache miniatur, pakowany do
  Setupu), `secrets\` (klucz podpisujacy + kod aktywacyjny, NIGDY nie ida do
  repo ani do Setupu w jawnej formie), `tooling\build\` (2 pliki PyInstaller
  spec, tracked).

- **`work\`** (`.gitignore`, ale nadal wewnatrz drzewa, ktore synchronizuje
  Synology Drive - przenosiny tu NIE zmniejszaja ruchu/miejsca w chmurze,
  patrz `work\README.md`): zaleznosci lokalne budowania (`tooling\go`,
  `tooling\downloads`, ...), wyniki starych buildow (`dist\`), kopie
  zapasowe i stare wersje (`_kopie\`), kopie konfliktow Synology Drive
  (`_konflikty-synology\`), luzne notatki (`_notatki\`). `bin\design-system`
  NIE jest tu - kierownik go cofnal (`DESIGN_SYSTEM.md` wymagany regulami
  projektu), zostal w `bin\`. Pelna instrukcja cofania ruchow: `work\README.md`.

## Dlaczego niektore foldery przeniesiono z `bin\` do `work\`

`build-installer.ps1` (jedyny aktualny skrypt budujacy Setup) stage'uje do
`%LOCALAPPDATA%\DAM-build\staging`, nie do `bin\dist`. `bin\tooling\go` jest
uzywany tylko przez `build-dam-root-exe.ps1` / `build-portable.ps1` do
budowy `DAM.exe` (Go) - referencje w tych skryptach zaktualizowano na
`work\tooling\go\bin\go.exe`. Reszta `bin\tooling\*` (npm-cache,
choco-cache, composer-home, downloads, bin/pgsql+php+composer) i `bin\data`
(lokalny Postgres) nie mialy zadnego odwolania w `bin\scripts`, `bin\apps`
ani `bin\installer` - wygladaja na zarzucone lokalne srodowisko dev,
zastapione zdalna baza `dam_eta` (`bin\DATABASE\dam_eta_*.sql.gz`).
