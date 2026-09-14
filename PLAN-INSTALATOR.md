# Plan instalatora DAM (X) - skrot

**Pelny plan:** `.cursor/plans/audyt_dam_vs_x_i_installer_c3719d36.plan.md`

## Stan 6.0.0 (2026-09-13)

- Git X: `HEAD` = `origin/main` = `0526d70470fed1da461396a62c16f9a8149c2ad6` (0 ahead / 0 behind).
- Wersja produktu: `version.json` / `dam-version.js` / `runtime_config.py` `APP_VERSION` / `DAM-Setup.iss` `MyAppVersion` = **6.0.0**.
- Commit `0526d70` zawiera installer + cache/indeks + Elementy + panel bazy (warstwa 206+207 na X, bump 6.0.0).
- `DAM-Setup.exe` w GIT_ROOT: 75542098 B, mtime 2026-09-12 15:49:11, FileVersion/ProductVersion 6.0.0. Plik jest w `.gitignore` (nie w gicie).
- Staging instalatora kopiuje named trees (`runtime`, `THEME`, `apps`, `scripts`, `docs`, `agents`, `DATABASE/users-seed`). **Nie pakuje `PAMIEC-PODRECZNA`.**
- Most: `bin/apps/desktop/local_bridge.py` 9034 linie (git show HEAD i drzewo robocze). **NIGDY** `git checkout D -- local_bridge.py`.
- QA PNG (w `0526d70`): `bin/docs/project/qa-6.0.0-explorer-elementy.png`, `qa-6.0.0-db-panel.png`, `qa-6.0.0-settings-db.png`.
- **ZOSTAJE:** instalacja 6.0.0 na czystym komputerze (drugi PC) + screenshot+Read. Ta maszyna nie jest OOTB.

**D: 5.0.207 zostaje** (nie kasowac). **Bez force pull.**

## Dwa commity / warstwy (historia)

1. **5.0.206 - tylko instalator** na X (Chunk A-B).
2. **Selektywny 207 z D** na X, potem bump **6.0.0** (nie 5.0.208). Commit: `0526d70`.

## Kolizje (recznie, nie checkout z D)

`version.json`, `dam-version.js`, HTML `?v=`, `local_bridge.py`, `pg_db.py`, `pg_schema.sql`, `index_supervisor.py`, `runtime_config.py`

**NIGDY:** `git checkout D -- local_bridge.py` (ani checkout z D na powyzsze pliki).

## Chunki A-H

| Chunk | Cel | Stan vs git |
|-------|-----|-------------|
| A | Zamroz liste plikow warstwy 206 | w `0526d70` |
| B | BLOKER1 (runtime + ISS) | w `0526d70` |
| C | OOTB QA na 206 przed merge | cancelled jako installer-gate (user wcial 207 wczesniej) |
| D | Inventory diff D vs `5e50962` | zrobione |
| E | Merge hunks 207 | w `0526d70` (bez slepego checkout mostu) |
| F | Bump (finalnie 6.0.0) | w `0526d70` |
| G | QA UI Elementy/DB | PNG w `0526d70`; parent sadzi |
| H | Rebuild Setup 6.0.0 | Setup na dysku 15:49:11; gitignored |

## Otwarte

- OOTB 6.0.0 na czystym PC (nie ta stacja).
- `PLAN-INSTALATOR.md` (ten plik) nie byl w `0526d70` - do commita parenta.
- `DAM.cmd` w GIT_ROOT: placeholder chmury (Get-Content: operacja w chmurze nie powiodla sie) - nie commitowac jako produkt.

## Zakazy bez komendy

commit, push, reset, force pull, xcopy D-X, junction `apps/`, checkout plikow kolizji z D.

## Mac (6.0.9) — propozycja, nie instalator

Windows zostaje: `DAM.exe` + WebView2 + Inno per-user `{localappdata}\Programs\DAM` (PrivilegesRequired=lowest).

- Dziś UI to HTTP na **:8765** (most :8766). Na Macu Safari/Chrome otwiera ten sam panel, jeśli Python serwuje `serve_browser.py`.
- Domyślny następny krok: **pywebview (cocoa / WKWebView)** + ten sam `bin/apps/web`. Start: `python apps/desktop/__main__.py` (na Darwinie `dam_macos.py`; na Windowsie bez zmian `launch.py`).
- Blokery: WebView2 jest tylko na Windows; podpisany `.dmg` wymaga Apple Developer ID + notarize. **Nie ma** instalatora Maca w 6.0.9.

