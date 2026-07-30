# Panel DAM na Synology (Web Station, port 443)

## Kanoniczny URL (bez :5001)

| URL | Rola |
|-----|------|
| **`https://inyfinn.synology.me/Panel-DAM/`** | **Panel DAM** (Web Station, HTTPS 443) |
| `https://inyfinn.synology.me:5001/` | Panel **DSM** (admin Synology) — nie używamy do DAM |

Czysta ścieżka = tylko Web Station. Port `:5001` **nie jest potrzebny** do Panel-DAM.

## Gdzie leży folder web na NAS

| Ścieżka NAS | Udział Windows (RaiDrive) |
|-------------|---------------------------|
| `/volume1/web` | `W:\web` |

Pliki Panel-DAM: `/volume1/web/Panel-DAM/` (= `W:\web\Panel-DAM\`).

## Deploy (jedyna komenda)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/install-panel-dam-synology.ps1
```

Albo sam sync plików:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/deploy-panel-dam-synology.ps1
```

Skrypt kopiuje `apps/web` → `W:\web\Panel-DAM\`, dopisuje `LICENSE.md`, `index.html`, `data/dam-runtime.json` (origin `https://inyfinn.synology.me/Panel-DAM`).

## Ręcznie (bez skryptu)

1. Włącz **Web Station** (Package Center).
2. Upewnij się, że host `inyfinn.synology.me` wskazuje na folder `web` (domyślnie `/volume1/web`).
3. Skopiuj zawartość `apps/web` do `W:\web\Panel-DAM\`.
4. Sprawdź: `https://inyfinn.synology.me/Panel-DAM/dashboard.html`

## Co działa po samym wrzuceniu plików

- HTML/CSS/JS (dashboard, eksplorer, wizualizacje, branding, licencja)
- Ładowanie stron z `/Panel-DAM/...`

## Czego nie ma bez mostu (bridge)

DAM to nie czysty static site. Potrzebuje **`local_bridge.py`** (`:8766`):

- logowanie / sesje
- miniatury z dysku Marketing
- zapis skojarzeń, indeks, Postgres

Przeglądarka **nie czyta dysku** — tylko `fetch()` do mostu. Patrz modal „Ścieżka Marketing na tym komputerze” (ścieżka lokalna urządzenia z mostem, np. `X:\Marketing`).

## Pełny DAM z internetu (roadmap)

1. Most na NAS (Docker) + wolumen Marketing (`/volume1/...`).
2. Reverse Proxy w DSM (port **443**, nie 5001):
   - `/Panel-DAM/` → Web Station (statyczne pliki)
   - `/Panel-DAM/dam-api/` → `http://127.0.0.1:8776` (most; 8765 zajęty przez panel-klienta)
3. W `Panel-DAM/data/dam-runtime.json`: `"bridge": "https://inyfinn.synology.me/Panel-DAM/dam-api"`

## Legacy: nginx DSM :5001 (opcjonalnie, niezalecane)

Wcześniejsza próba serwowania Panel-DAM przez nginx DSM (`dsm.panel-dam.conf`) — **rezygnujemy** na rzecz czystego URL na 443.

- Plik w repo (archiwum): `scripts/ops/synology/dsm.panel-dam.conf`
- Instalacja tylko jeśli świadomie: `install-panel-dam-synology.ps1 -WithDsm5001Nginx`
- Usunięcie z NAS: `install-panel-dam-synology.ps1 -RemoveDsm5001Nginx`

**Redirect z :5001** — caly ruch `/Panel-DAM*`, `/panel-dam*`, `paneldam`, `dam-panel` (w tym bookmark Google) → `https://inyfinn.synology.me/Panel-DAM/` na **443**. Na :5001 **nie serwujemy** plikow — tylko 301. Wdrozenie: `install-panel-dam-synology.ps1 -WithDsm5001Nginx`.

## Lokalnie (pełna funkcja)

Skrót DAM ETA: `apps/desktop/run-dam.vbs` → UI `:8765` + most `:8766` na PC z `X:\Marketing`.
