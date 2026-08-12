# LOGI — DAM Dobra Kaloria (operacyjny)

Format: Data | Akcja | Status | Efekt | Dalej

---

## 2026-08-12 — sesja biuro (przed domem)

| Pole | Treść |
|------|--------|
| Wersje | **5.0.136** telemetria/db ping → **5.0.137** login email+hasło → **5.0.138** AVIF cache-first → **5.0.139** kill legacy JPG → **5.0.140** handoff Synology |
| Synology Postgres | **NIE DZIAŁA** (stan na 2026-08-12 ~16:45 CEST) |
| Dowód | `inyfinn.synology.me:5433` → TCP refuse/timeout (~2–4 s); `192.168.0.145:5433` → timeout (~4 s) |
| Preferencje lokalne | `bin/apps/desktop/data/db-prefer.json` → `mode=auto`, `synology=true` (gitignored) |
| Config lokalny | `bin/apps/desktop/data/pg-config.json` przywrócony z `.off` (gitignored, hasło lokalnie) |
| Runtime | Aplikacja na **SQLite offline** (`dam-local.sqlite`); po 1. failu PG kolejne `ping` ~4 ms |
| Legacy thumbs | **USUNIĘTE** `bin/apps/web/data/thumbs/*.jpg` (402 plików); UI tylko `/thumb-cache` AVIF q30 |
| Telemetria | `bin/apps/desktop/logs/telemetry-YYYY-MM-DD.jsonl` + daemon health 60 s |
| ROOT | Nietykalny poza buildem `DAM.exe` / `DAM-Setup.exe` (gitignore) |

### Co zrobić w domu (po `git pull`)

1. Zainstaluj najnowszy **DAM-Setup.exe** z GitHub Releases (albo lokalny build).
2. Na routerze / NAS: **port forwarding TCP 5433** → Postgres Synology; sprawdź czy ISP nie daje CGNAT.
3. Test:
   ```powershell
   cd bin\apps\desktop
   python -c "import dam_db, pg_db; dam_db.reset_path_cache(); pg_db.reset_config_cache(); print(dam_db.ping())"
   ```
   Oczekiwane przy sukcesie: `engine=postgres`, `ok=True`, `latency_ms` niski.
4. W UI: źródła bazy → Synology / Auto; Odśwież bazę.
5. Kontynuuj: warm AVIF (`POST /thumb-cache/warm`), indeksowanie przyrostowe, ewentualny dump `DATABASE/`.

### Zakaz commitów (lokalne śmieci)

- `*.sqlite*.bak`, `index-watcher.log`, `user-prefs.json`, `index-rebuild.lock*`, `pg-config.json`, `db-prefer.json`
- NIE usuwać niczego z GIT_ROOT poza świadomym buildem artefaktów

---

*Dopisuj nowe wiersze na końcu tego pliku.*
