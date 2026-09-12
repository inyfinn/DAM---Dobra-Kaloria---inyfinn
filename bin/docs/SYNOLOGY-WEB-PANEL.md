# Panel DAM na Synology (Web Station)

## Gdzie lezy folder web na NAS

| Sciezka NAS | Udzial Windows (RaiDrive) |
|-------------|---------------------------|
| `/volume1/web` | `W:\web` |

Deploy skryptu (z `CONTENT_ROOT` = folder `bin` w repo):

```powershell
powershell -ExecutionPolicy Bypass -File bin\scripts\ops\deploy-panel-dam-synology.ps1
```

Tworzy / aktualizuje: `W:\web\Panel-DAM\` (mirror `bin/apps/web`).

Wykluczenia mirror: `dam-runtime.json`, `dam-identity.json`, `data\thumbs`, `*_Conflict*`, `*.tmp`.
Folder **`pamiec-podreczna\`** na NAS **nie jest kasowany** przez `/MIR` (cache Worker / miniatury whitebg).

Seed cache po deploy:

| NAS (RaiDrive) | Zrodlo repo |
|----------------|-------------|
| `W:\web\Panel-DAM\pamiec-podreczna\thumbs\` | `bin\PAMIEC-PODRECZNA\thumbs\` (329 AVIF) |
| `W:\web\Panel-DAM\pamiec-podreczna\manifest.json` | `{ count, bytes, schema: whitebg-v1, updated }` |

## Harmonogram (godzinowy sync)

**DSM (preferowane po SSH/git na NAS):** dwa kroki w Task Scheduler — `dam-git.sh pull --ff-only`, potem `dam-sync-panel-web.sh` (sciezki w komentarzu na koncu `bin/scripts/ops/synology/dam-git.sh`).

**PC (RaiDrive `W:`):** rejestracja zadania Windows:

```powershell
powershell -ExecutionPolicy Bypass -File bin\scripts\ops\synology\install-panel-dam-hourly-task.ps1
```

Wywoluje co 1 h ten sam deploy co recznie (`deploy-panel-dam-synology.ps1`).

## URL — wazne rozroznienie portow

| URL | Co to jest |
|-----|------------|
| `https://inyfinn.synology.me:5001/` | **Panel DSM** (admin Synology) — **nie** Web Station |
| `https://inyfinn.synology.me/Panel-DAM/` | **Web Station** (port 443 domyslnie) — tu laduje sie statyczny UI |
| `inyfinn.synology.me:5433` | PostgreSQL DAM (ADR-009) |

Nie da sie podmienic calego `:5001` na Panel DAM bez psucia DSM. Panel DAM idzie przez **Web Station** (80/443) albo osobny **Reverse Proxy** w DSM.

## Co dziala po samym wrzuceniu plikow

- HTML/CSS/JS z `apps/web` (dashboard, eksplorer, wizualizacje, branding)
- Ladowanie stron z `/Panel-DAM/dashboard.html`

## Czego **nie** ma bez backendu

DAM to nie czysty static site. Potrzebuje **mostu** `local_bridge.py` (`:8766`):

- logowanie / sesje
- miniatury z dysku Marketing
- zapis skojarzen, indeks, Postgres

Przegladarka z internetu nie widzi `127.0.0.1:8766` na Twoim PC.

## Pelny dostep z internetu (roadmap)

1. **Reverse Proxy** (DSM → Panel logowania → Zaawansowane → Odwrotne proxy):
   - Zrodlo: `https://inyfinn.synology.me` + sciezka `/dam-api/` → cel `http://127.0.0.1:8766` (most na NAS lub PC w LAN)
   - Zrodlo: `/Panel-DAM/` → Web Station (statyczne pliki) **albo** proxy do `http://127.0.0.1:8765` jesli caly stack na NAS

2. **Docker na NAS** (folder `W:\docker\`) — docelowo kontener z `serve_browser.py` + wolumen Marketing (read-only).

3. **Lokalnie** (jak teraz): skrot DAM ETA, `:8765` + `:8766` — zawsze pelna funkcja.

## Po deploy

Sprawdz w przegladarce:

- `https://inyfinn.synology.me/Panel-DAM/dashboard.html`
- Jesli 404: wlacz **Web Station** w Package Center i upewnij sie, ze wirtualny host wskazuje na folder `web`.
