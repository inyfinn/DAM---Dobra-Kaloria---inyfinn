# DATABASE — backupy PostgreSQL (ADR-009)

Oficjalna baza DAM ETA: **PostgreSQL na Synology** (`192.168.0.145:5433`, kontener `dam-eta-postgres`).

## Co tu lezy

Pliki `dam_eta_YYYY-MM-DD.sql.gz` — wynik `pg_dump` (pełny dump logiczny, nie surowy katalog PGDATA).

## Retencja

- **1 plik na dzień kalendarzowy** (godzinowy job nadpisuje plik *dzisiejszy*).
- **Maks. 72 dni** — przy nowym dniu kasowany jest najstarszy dump.
- Rotacja w skryptach: `apps/desktop/scripts/backup-postgres-database.sh` (NAS) oraz `sync-database-backups-to-git.py` (Windows → Git).

## Bezpieczeństwo

- Dump zawiera hashe haseł i dane sesji — **tylko prywatne repo**.
- Hasło Postgresa **nigdy** nie trafia do tych plików (jest w `.env` na NAS i w gitignorowanym `apps/desktop/data/pg-config.json`).
- Nie wystawiaj portu `5433` na internet. Dostęp spoza LAN = VPN do domu.

## Dostęp do żywej bazy

| Skąd | Działa? |
|------|---------|
| PC w sieci LAN Synology | Tak |
| Poza domem bez VPN | **Nie** — `192.168.0.145` nie jest publiczne |
| Poza domem z VPN (WireGuard / Synology VPN) | Tak |

Tier 1 (logowanie/sesje) czyta Postgres **na żywo**. Tier 2 (aliasy, propozycje tagów…) ma lokalny cache odświeżany co **5 min**, gdy działa `local_bridge.py`.
