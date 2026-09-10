# DATABASE - backupy PostgreSQL (ADR-009) + lokalny SQLite

Oficjalna baza DAM ETA: **PostgreSQL 16** na Synology
(kontener `dam-eta-postgres`, port hosta **5433**, DDNS `inyfinn.synology.me`).
Silnik live od 2026-09-10: **Postgres**. Lokalny SQLite = OFFLINE / lustro.

## Lokalny SQLite (offline + mirror)

**Kanoniczna sciezka lustra / awarii:** `bin/DATABASE/dam-local.sqlite`

To jest katalog **w projekcie DAM**, nie folder Marketing (`D:\Marketing\DATABASE`
ani `{ROOT}/DATABASE` — tego NIE uzywamy jako live).

Na tej maszynie:

`D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\bin\DATABASE`

(w domu ten sam drzewo projektu bywa mapowane jako `M:\- POLSKA\99 - WYMIANA\...`).

- `dam-local.sqlite` — lustro / OFFLINE, **gitignored**
- `users-seed.sqlite` — seed kont
- `dam_eta_*.sql.gz` — dumpy Postgres

Przy starcie aplikacja **scala** kopie z `apps/desktop/data/dam-local.sqlite`
(legacy) do `bin/DATABASE/`, **preferujac pelna baze (wiecej users / wiekszy plik)**,
nigdy nowsza pusta kopie ~45 KB nad ~7 MB / 18 kont.

Zapisow kolejkowane per konto (`db_user_queue.py`).

Live = Postgres `inyfinn.synology.me:5433`. SQLite tylko gdy PG nie odpowiada.

## Co tu lezy (repo bin/DATABASE)

Pliki `dam_eta_YYYY-MM-DD.sql.gz` - wynik `pg_dump` (pelny dump logiczny, nie surowy katalog PGDATA).

Zawieraja schemat + dane Tier 1/2 (`users`, `device_sessions`, `audit_log`, `dam_kv_store`).

## Retencja

- **1 plik na dzien kalendarzowy** (godzinowy job nadpisuje plik *dzisiejszy*).
- **Maks. 72 dni** - przy nowym dniu kasowany jest najstarszy dump.
- Rotacja: `apps/desktop/scripts/backup-postgres-database.sh` (NAS) oraz `sync-database-backups-to-git.py` (Windows -> Git).

## Sync do Git (Windows)

```powershell
python apps/desktop/scripts/sync-database-backups-to-git.py
# opcjonalnie z push:
python apps/desktop/scripts/sync-database-backups-to-git.py --push
```

Wymaga SSH hosta `syno` w `~/.ssh/config`. Nie commituje hasel - tylko `.sql.gz`.

## Bezpieczenstwo

- Dump zawiera hashe hasel i dane sesji - **tylko prywatne repo**.
- Haslo Postgresa **nigdy** nie trafia do tych plikow (jest w `.env` na NAS i w gitignorowanym `apps/desktop/data/pg-config.json`).
- Port 5433 jest swiadomie na routerze (DDNS multi-PC); nie wystawiaj hasla w publicznym Gicie.

## Dostep do zywej bazy (gdy 5433 otwarty)

| Skad | Host |
|------|------|
| Domyslnie (WAN / DDNS) | `inyfinn.synology.me:5433` |
| Ten sam WAN, gdy DNS padnie | `212.87.249.132:5433` |
| W domu (LAN) | `192.168.1.145:5433` |

Aplikacja proboje hosty po kolei (patrz `pg-config.example.json` / `dam-connection.env.example`).

**To NIE jest baza:**

- `https://inyfinn.synology.me:5001/` - panel DSM
- QuickConnect - tez panel / uslugi Synology

Tier 1 (logowanie/sesje) czyta Postgres **na zywo** gdy dostepny. Offline = lokalny SQLite w `bin/DATABASE/`.
