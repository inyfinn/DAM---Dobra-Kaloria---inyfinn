# DATABASE - backupy PostgreSQL (ADR-009)

Oficjalna baza DAM ETA: **PostgreSQL 16** na Synology (kontener `dam-eta-postgres`, port hosta **5433**).

## Lokalny SQLite (offline / mirror)

**Kanoniczna sciezka:** `{ROOT}/DATABASE/dam-local.sqlite`

- `ROOT` = folder Marketing wybrany per uzytkownik/urzadzenie (`machine-config.json`, `user-device-paths`).
- Przy starcie aplikacja **scala** kopie z `bin/DATABASE/`, `apps/desktop/data/` i legacy `.dam-eta/`.
- Gdy ROOT nie jest ustawiony: fallback `bin/DATABASE/dam-local.sqlite`.
- Zapisow kolejkowane per konto (`db_user_queue.py`).

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

## Dostep do zywej bazy

| Skad | Host |
|------|------|
| Domyslnie (wszedzie) | `inyfinn.synology.me:5433` (DDNS) |
| Awaryjnie (LAN) | `192.168.0.145:5433` |

Aplikacja proboje hosty po kolei (patrz `pg-config.example.json` / `dam-connection.env.example`).

**To NIE jest baza:**

- `https://inyfinn.synology.me:5001/` - panel DSM
- QuickConnect - tez panel / uslugi Synology

Tier 1 (logowanie/sesje) czyta Postgres **na zywo**. Tier 2 (aliasy, propozycje tagow) ma lokalny cache odswiezany co **5 min**, gdy dziala `local_bridge.py`. Offline = lokalny SQLite + ten dump jako odtworzenie.
