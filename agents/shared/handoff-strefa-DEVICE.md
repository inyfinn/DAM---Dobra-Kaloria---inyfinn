# Handoff STREFA DEVICE (Grok) — 2026-07-20

## User request (sens)

Sciezka bazowa Marketing ma byc **per urzadzenie** (hostname / device_id), nie globalnie per konto na wszystkie PC. Dom `X:/`, praca `D:/`. CRUD w profilu **i w Ustawieniach (Dysk)** — ta sama karta. Folder picker zamiast klepania sciezki; normalizacja do rootu Marketing.

## Model danych

**Postgres KV:** `user-device-paths:{email}`  

```json
{
  "email": "user@firma.pl",
  "devices": [
    {
      "device_id": "dam-dev-…",
      "hostname": "inyfinn",
      "base_path": "X:\\Marketing",
      "label": "Dom",
      "updated_at": "ISO-8601"
    }
  ],
  "updated_at": "ISO-8601"
}
```

**Cache lokalny:** `apps/desktop/data/user-device-paths.json`  
**Cache UI:** `localStorage.dam_base_path::{device_id}` + legacy `dam_base_path` (tylko biezace urzadzenie).

## Endpointy bridge

| Method | Path | Auth | Opis |
|--------|------|------|------|
| GET | `/user-device-paths` | Bearer | lista urzadzen + `current` |
| GET | `/user-device-paths/current` | Bearer | resolve sciezki dla tego PC |
| POST | `/user-device-paths` | Bearer | `action: upsert\|delete` + pola |
| POST | `/machine-config` | Bearer | + lustro do UDP biezacego device |
| POST | `/pick-folder` | lokalny | `{ start }` → natywny dialog tkinter (przegladarka + most); desktop moze uzyc `pywebview.api.pick_folder` |

## UI — jedna karta, dwa hosty

- `profile.html` → `#damDevicePathsRoot`
- `settings.html` → `#damDisk` zawiera `#damDevicePathsRoot` (embed tej samej karty `DamDevicePaths.mount`)
- Stary formularz `#settingBasePath` + Wykryj/Sprawdz **usuniety z widoku**; zostaje `input[type=hidden]#settingBasePath` (sync dla `dam-settings.js`)
- Formularz: **Folder** | **Wykryj** | **Sprawdz** | Zapisz
- Edytuj/Usun = `.dam-welcome-link`; Usun = `DamDanger.bind` hold-to-delete (gdy dostepny)
- Sidebar **„Sesja urządzenia”** → `profile.html#damDevicePathsRoot`

## Normalizacja rootu

`DamPaths.normalizeMarketingRoot`:
- `X:\Marketing\- POLSKA` → `X:\Marketing`
- segment `Marketing` wycina wszystko ponizej
- stosowane przy pickFolder, save, upsert, setBasePath

## Runtime resolve (`ensureUserBase`)

1. `/user-device-paths/current` (baza)  
2. localStorage scoped  
3. `machine-config` (tylko ten PC)  
4. unset → modal  

Nigdy nie bierze sciezki z innego `device_id`.

## Pliki (ta tura — settings embed + Folder)

- `program-instructions.json` — `device-scoped-base-paths` (settings embed, Folder, normalize)
- `dam-paths.js` — `normalizeMarketingRoot`, `pickFolder` (pywebview → `/pick-folder`)
- `dam-device-paths.js` — Folder/Wykryj/Sprawdz, welcome-link, DamDanger, mount settings
- `settings.html` — zamiana `#damDisk` na mount + script
- `profile.html` — danger + bump `?v=devicepath20260720c`
- `local_bridge.py` — `POST /pick-folder` + `pick_folder_dialog`
- cache-bust: `dam-paths.js?v=devicepath20260720c` (wszystkie HTML), `dam-device-paths.js?v=devicepath20260720c` (profile + settings)

## Testy / QA

- `node --check` dam-paths + dam-device-paths OK; bridge AST OK  
- CDP: card mounted, old detect gone, `normPolska=X:\Marketing`, edit/del = `dam-welcome-link`, DamDanger na Usun  
- Screenshoty: `agents/shared/qa-screenshots/device-settings-pass{1,2,3}*.png`  
- Seed PI → Postgres (`_seed_naming_policy_to_postgres`)

## NIE ruszane

dam-integrations*, dam-shell.js, dam-tutorial*, dam-assoc-edit*, dam-explorer.js

## TODO nastepny

1. Opcjonalnie: Sesja urzadzenia → `settings.html#damDisk` zamiast tylko profilu (koordynator).  
2. Live klik Folder w przegladarce (dialog tkinter na ekranie usera) — nie automatyzowany w CI.  
