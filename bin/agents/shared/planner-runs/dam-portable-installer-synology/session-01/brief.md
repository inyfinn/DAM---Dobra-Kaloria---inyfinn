# Brief — DAM portable installer + Synology (session-01)

```markdown
canonical_plan_path: C:\Users\krzysztof.wieczorek\.cursor\plans\dam-portable-installer-synology.plan.md
plan_mode: create
revision: 1
plannerSession: dam-portable-installer-synology/session-01
min_rounds: 10
```

## Cel usera (HARD)

1. Wyeliminować błąd cross-PC `Brak silnika w folderze` (brak `bin\runtime\win\python`).
2. Prawdziwa aplikacja portable/release + installer: bez system Python, bez ręcznego pip.
3. Każda paczka release zawiera pełny embed Python/runtime + deps + assety aplikacji.
4. Czysty layout user-facing: installer + zainstalowana app (`DAM.exe`, `bin/`, skróty). **Nie usuwać source z repo.**
5. Build teraz + wymuszony workflow build-after-change/release. Ocena: pełny installer przy każdej edycji vs incremental sync + bramka release — **jedna jawna decyzja**.
6. Ikony (exe/installer/taskbar/shortcut/uninstaller) = oficjalne logo Dobra Kaloria z repo (nie generyczny tile „DAM”).
7. Synology/Postgres wrócił; DDNS `inyfinn.synology.me` stabilny; LAN IP zmieniony. Secure configurable DDNS, bez hardcodowanego starego IP, bez credentiali w gicie. TLS/cert/port/connectivity/migration/fallback. Kontrolowany switch z „SQLite only until Synology returns”.
8. Installer działa na innym PC; macierz clean-machine.
9. Evidence-only (hashe, artefakty, logi, screenshoty/video).
10. Regresja: branding preview latency, quiz, titles, gazetka, live indexes.
11. Cleanup bez kasowania source/docs/licenses/build tooling; rozdziel source / staging / release.
12. Screenshot: `boot-heal.html` przez sieć/UNC/IP — decyzja supported launch modes.
13. Security: signing, SmartScreen, secrets, DB credentials, least privilege.
14. Rollback/recovery + versioning.
15. Parent = kierownik odbioru; ownership matrix, no-overlap WRITE, merge order, gates.

## Zakres debaty

- Setup + draft rundy 1 + changelog.
- **NIE** implementacja kodu, **NIE** commit, **NIE** FINAL.md / executor brief, **NIE** tworzenie kanonicznego `.plan.md` przed CONVERGED (tylko pointer + draft).

## Fakty z audytu (read-only)

| Fakt | Ścieżka / dowód |
|------|-----------------|
| Błąd UI | `apps/desktop/boot-heal.html` reason `missing_runtime` → tytuł „Brak silnika w folderze” |
| Launcher | `DAM.exe` → `dam_root_launcher.py` → wymaga `bin\runtime\win\python\pythonw.exe` |
| Vendor runtime | `scripts/ops/vendor-runtime-win.ps1` (+ kopia w `bin\scripts\ops\`) |
| Thin exe build | `bin/scripts/ops/build-dam-root-exe.ps1` (PyInstaller onefile; brak trwałego `DAM.spec` w repo — spec w TEMP) |
| Release ZIP (partial) | `bin/scripts/ops/build-release-zip.ps1` — kopiuje drzewo, **nie** buduje installera; wyklucza `tooling` |
| Sync dev | `scripts/ops/sync-apps-to-bin.ps1` (apps → bin/apps) |
| Layout | GIT_ROOT = `DAM.exe`+`bin`+git; CONTENT_ROOT=`bin` |
| Runtime obecny lokalnie | `bin\runtime\win\python` istnieje na tej maszynie (junction `win`) |
| Ikona obecna | `apps/desktop/dam_app.ico` = wygenerowany zielony tile „DAM” (`build-dam-ico.py`) — **nie** logo marki |
| Logo oficjalne | `apps/web/assets/img/logo-dobra-kaloria.svg`, `logo-dk-green.svg`, `logo-dk-white.svg`, `favicon-dk.svg` |
| PG ADR | `bin/docs/ADR/ADR-009-postgres-synology.md` — DDNS first, LAN fallback, offline SQLite |
| Default prefer | `dam_db.py` `_DEFAULT_PREFER.mode = "sqlite"`, `synology: False` (freeze 2026-08-03) |
| Przykład IP | `pg-config.example.json` / `dam-connection.env.example` mają `192.168.0.145` (stary LAN) |
| Nazwa heal | plik = `boot-heal.html` (nie `boot-health.html`) |
| ADRs po cleanup | `bin/docs/ADR/` (ADR-001…010); brak `apps/agents` |
| Brak installera | brak Inno/NSIS/WiX w repo |
| Wersja UI | `DAM_APP_VERSION = "5.0.130"` w `dam-version.js` |

## Zakazane ścieżki / anty-wzorce

- Kasowanie `apps/`, `agents/`, `THEME/`, licencji, ADR, build tooling.
- Commit credentiali / `pg-config.json` / `.env` z hasłem.
- Hardcode nowego LAN IP jako primary (primary = DDNS).
- Traktowanie UNC/`file://` niepełnego drzewa jako wspieranego launch mode bez decyzji.
- Pełny rebuild installera po każdej literówce w JS (chyba że Parent wybierze inaczej — draft proponuje bramkę release).
- Drugi plan kanoniczny / FINAL.md.

## Role po CONVERGED (wdrożenie — poza tą turą Plannera)

- Parent (człowiek): AskQuestion, APPROVAL bramek, odbiór evidence.
- Workery: wg ownership matrix w draftcie (Packaging / Desktop-Runtime / DB-Config / Icons / QA-CleanMachine).
- Critic tej debaty: Composer — tylko `*-critique.md`.
