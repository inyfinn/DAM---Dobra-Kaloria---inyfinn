# PROGRESS.md - DAM - Dobra Kaloria - Inyfinn

Ostatnia aktualizacja: **2026-07-18**

| Obszar | Status | Notatka |
|--------|--------|---------|
| Geex UI + desktop launch | done | skrot DAM - Dobra Kaloria - Inyfinn |
| Auth lokalny (bcrypt) | done | SQLite `users` |
| **Sesja = machine_id + device_id + session_id** | **done** | ADR-008; weryfikacja przed startem |
| SQLite lokalna (repo) | done | `apps/desktop/data/dam-local.sqlite` - ADR-007 amended |
| Global search + tagi | done | Smak/Typ/Opakowanie/Autor |
| Taxonomia Typ vs Smak | done | muffin = Smak; kulki/BAT = Typ |
| Modal wiz + FRONT-S + zoom | done | chip zawsze; repair-viz-thumbs |
| Nosniki PS + admin rename | done | POST /rename-index |
| Audit log | done | `audit_log` w SQLite |
| Deployment docs + release ZIP | done | `docs/DEPLOYMENT.md`, `build-release-zip.ps1` |
| Postgres / Docker | cancelled (user) | opcjonalnie Laravel |
| Entra ID pelne | pending | ADR-006 |
| Wspolna baza na NAS (multi-PC) | **done** | Postgres :5433 ADR-009; DDNS first; OFFLINE=SQLite+hint |
| Naming dictionary (PL nosniki/jezyki) | **done** | V1-V10 PASS; DATE ORANGE = OTHER (do potwierdzenia) |
| Wspolne tagi dam-badges + Warianty | **done** | explorer=wiz; cache vizadm2 |
| Tryb admina (rola + czerwona obwodka) | **done** | pick_thumb, viz-flags, folder-images |
| Dashboard widgety + FMCG + notify | **done** | 24 widgety, layout localStorage, koszt OFF domyslnie |
| Tagi wiz - rozmiary + fix OTHER (Faza 1) | **done** | tokeny pill/badge, brak min-height 44px, kolejnosc tagow |
| Podkategoria PL + zgadywanie typu (Faza 2) | **done** | SUBCATEGORY_PL, carrier_guessed, audyt PL znakow |
| Alias produktow DK<->GC (Faza 2) | **done** | product-aliases.json, seed owies-miod<->cornflakes |
| Naprawa MATERIALY->PROJEKT (Faza 3) | **dry-run only** | 16 kandydatow (6 DK/10 GC), czeka na `--apply` po zgodzie |
| Moderacja tagow - kolejka 72h (Faza 4) | **done** | tag-proposals.json, panel w settings.html, carrier-types.json |
| Modal: aliasy w pasku wariantow (Faza 5) | **done** | withAliasItems(), jezyki wyszarzone + zglos zapotrzebowanie |
| Zgloszenia wielokanalowe + inbox (Faza 6) | **done (stub email/Teams/Asana)** | POST /viz-request, inbox.html, notification-groups.json |
| X / Wstecz UX audyt (Faza 6) | **done** | dam-modal-x, goBackNav() zamyka overlay zamiast nawigowac |
| Auth rehydrate (bound-session) | **done** | POST /auth/rehydrate; bez fake sesji z localStorage |
| Sidebar active + bez underline | **done** | aria-current + Geex purple; cache navActive1 |
| Dashboard â€žDostosuj pulpitâ€ť UX | **done** | DnD, preview 350ms, dirty guard, fioletowe checkboxy |
| Inbox copy + dam-inbox.js | **done** | ludzki podtytul; 72h reminder w copy |
| OAuth stub Asana/MS Graph | **done** | oauth_integrations.py + env.example |
| Strony prawne / security docs | **done** | privacy, terms, license, consents, docs-security |
| Dump Postgres w DATABASE/ | **done** | sync godzinowy NAS + sync-database-backups-to-git.py |

## Uruchomienie dla usera

1. Skrot **DAM ETA** na pulpicie.
2. Launcher sprawdza ID maszyny (ADR-008).
3. Baza online = Postgres `inyfinn.synology.me:5433` (DDNS). Offline = lokalny SQLite + dump `DATABASE/`.
4. ROOT plikow: Ustawienia -> folder Marketing.

Postgres zyje na Synology (Docker). User nie instaluje Dockera na PC.
