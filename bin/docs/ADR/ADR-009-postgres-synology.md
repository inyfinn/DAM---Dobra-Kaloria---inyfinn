# ADR-009 - Wspolna baza PostgreSQL na Synology

Status: Accepted  
Date: 2026-07-18  
Amends: ADR-007 (SQLite lokalny zostaje jako sciezka odwrotu / maszyna bez LAN)  
Related: ADR-008 (sesja nadal zwiazana z machine_id per PC)

## Context

DAM ETA uruchamia sie na wielu PC w LAN. Dane wspolne (konta, sesje, audit,
propozycje tagow, aliasy produktow, slownik nazw) musza byc **jednolite** -
nikt nie pulluje Gita zeby zobaczyc zmiane typu opakowania.

Odrzucone:
- **SQLite w Git** - plik binarny, merge = korupcja, sekrety w historii.
- **Sync pliku SQLite przez Synology Drive / Dropbox** - WAL + `-shm` nie sa
  synchronizowane atomowo; klasyczny sposob na uszkodzenie bazy przy
  rownoczesnym zapisie (dokumentowane przez autorow SQLite).

NAS (`LAN_IP_PLACEHOLDER` w LAN, WAN `inyfinn.synology.me` / `WAN_IP_PLACEHOLDER`, DSM 7.3.2) ma juz Container Manager (Docker 24).
Systemowy Postgres Synology nasluchuje tylko na `127.0.0.1:5432` (Contacts,
Calendar, Photos...) - **nie wolno go reuzywac**.

## Decision

1. **Dedykowany kontener** `postgres:16-alpine` na Synology:
   - host port **5433** -> kontener 5432
   - dane: `/volume1/docker/dam-eta-postgres/data` (NIE na root `/`)
   - rola/baza: `dam_eta` / `dam_eta` (nie superuser `postgres`)
   - haslo w `/volume1/docker/dam-eta-postgres/.env` (chmod 600, poza Gitem)
   - compose: `restart: unless-stopped`, healthcheck `pg_isready`

2. **Host priorytet (2026-09-10):** zawsze **DDNS** `inyfinn.synology.me:5433`, potem IP WAN `WAN_IP_PLACEHOLDER`, LAN `LAN_IP_PLACEHOLDER` tylko w domu. QuickConnect / `:5001` = DSM, nie PG.
   Klient (`pg_db`) sortuje hostname przed prywatnymi IP.

3. **Tier 1 - zywe zapytania gdy online** (`users`, `device_sessions`, `audit_log`):
   - gdy PG skonfigurowany a niedostepny -> tryb **OFFLINE** (jawny):
     lokalny SQLite + `offline_mode` / `offline_hint` (NAT/CGNAT/zmienne IP).
   - to NIE jest ciche udawanie online; co ~120 s retry DDNS.
   - dumpy wspolne: `DATABASE/` w GitHub (+ sync Marketing).

4. **Tier 2 - Postgres = prawda, lokalny JSON = cache**:
   - tabela `dam_kv_store(store_key, payload JSONB, updated_at, updated_by)`
   - store_key = nazwa pliku bez `.json` (np. `tag-proposals`, `product-aliases`,
     `naming-dictionary`, `carrier-types`, `carrier-assignment-log`,
     `notification-groups`, `inbox-items`, `carrier-overrides`, `viz-flags`,
     `thumb-overrides`)
   - zapis: Postgres (`SELECT ... FOR UPDATE`) + natychmiast lokalny plik
   - watcher co **5 min** sciaga stores do lokalnego cache

5. **Konfiguracja klienta** (per maszyna, gitignored):
   - `apps/desktop/data/pg-config.json` (szablon: `pg-config.example.json`)
   - albo `dam-connection.env` / env `DAM_PG_HOSTS=inyfinn.synology.me,WAN_IP_PLACEHOLDER,LAN_IP_PLACEHOLDER`

6. **Lokalny SQLite** (`dam-local.sqlite`) = offline + mirror userow gdy PG online.
   Nie jest usuwany automatycznie.

7. **Poza zakresem tej decyzji:** `file-index.json` / `search-index.json`
   (cache skanu dysku X:), faktury/koszty (`invoices.json`, `cost-rates.json`).

## Consequences

- Uzytkownik koncowy nadal nie instaluje Dockera - Postgres zyje na NAS.
- Kazdy PC laczy sie przez **DDNS** (takze spoza LAN); LAN = fallback.
- Port 5433 jest na routerze (NAT) - bez publicznego IP / przy CGNAT DDNS
  moze nie dzialac mimo poprawnej konfiguracji NAS; wtedy OFFLINE + GitHub dump.
- Haslo rozprowadzane w zamknietym ZIP release / recznie na stacje
  (nie w publicznym Gicie).
- Migracja jednorazowa: `python apps/desktop/scripts/migrate_to_postgres.py`
  (domyslnie dry-run, `--apply` po akceptacji raportu).
- Schemat: `apps/desktop/pg_schema.sql`. Klient: `apps/desktop/pg_db.py` + `dam_db.py`.

## Security checklist

- [x] Router: port-forward TCP 5433 -> NAS (swiadomie, dla DDNS multi-PC)
- [ ] Strong password + tylko znane stacje (nie publiczny Git)
- [ ] `.env` na NAS: `chmod 600`, wlasciciel Inyfinn
- [x] `apps/desktop/data/pg-config.json` w `.gitignore`
- [x] Backup: `pg_dump` godzinowy -> `DATABASE/` + Git sync

## Related

- ADR-007 - SQLite lokalny (MVP / offline / rollback)
- ADR-008 - machine_id / device_id (nadal obowiazuje przy wspolnej bazie)
