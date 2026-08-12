# Panel DAM na Synology (Web Station)

## Gdzie lezy folder web na NAS

| Sciezka NAS | Udzial Windows (RaiDrive) |
|-------------|---------------------------|
| `/volume1/web` | `W:\web` |

Deploy skryptu:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/deploy-panel-dam-synology.ps1
```

Tworzy / aktualizuje: `W:\web\Panel-DAM\` (kopia `apps/web`).

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
