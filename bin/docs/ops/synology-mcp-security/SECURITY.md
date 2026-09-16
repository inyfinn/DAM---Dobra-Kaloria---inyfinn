# Bezpieczeństwo repozytorium

To repozytorium opisuje infrastrukturę domową (Synology NAS, router, panel kancelarii). **Nie commituj sekretów.**

## Co NIE trafia do gita

| Typ | Gdzie trzymać |
|-----|----------------|
| Klucz SSH Cloud Agenta | Sekret `NAS_SSH_KEY` w [Cursor Cloud Environment](https://cursor.com/dashboard/cloud-agents/environments) |
| Hasło routera | Sekret `ROUTER_ADMIN_PASSWORD` w Cursor Environment |
| SMTP / Gmail app password | Plik `smtp.secret` na NAS (poza gitem) |
| Tokeny API, `.env` produkcyjne | Cursor Secrets lub pliki na NAS z `.gitignore` |

Pliki w `.gitignore`: `.cursor/cloud-agent-nas`, `**/*.secret`, `**/data/`, bazy SQLite.

## Audyt (2026-09-01)

- W historii gita **nie znaleziono** kluczy prywatnych OpenSSH/RSA ani tokenów GitHub/AWS.
- Sekrety operacyjne są w **Cursor Environment** (`NAS_SSH_*`), nie w plikach śledzonych przez git.
- Repo było **publiczne** — w dokumentacji widać m.in. publiczne IP, e-maile i mapę usług. Zalecane: **Private** + ochrona gałęzi `main`.

## Zgłaszanie problemów

Jeśli klucz lub hasło trafiło do commita: natychmiast **rotuj** sekret (nowy klucz SSH na NAS, nowy sekret w Cursor), usuń z historii (`git filter-repo` / GitHub support) i ustaw repo na **Private**.

Właściciel: repozytorium `inyfinn/synology-mcp` na GitHubie.
