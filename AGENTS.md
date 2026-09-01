# AGENTS.md

Project agent docs live under [`bin/docs/project/AGENTS.md`](bin/docs/project/AGENTS.md)
(3-role map: Architect / Builder / QA) and [`bin/agents/README.md`](bin/agents/README.md).
Repository code and data live under `bin/` (the Windows layout calls this
`CONTENT_ROOT`; the parent that holds `DAM.exe` + `.git` is `GIT_ROOT`).

## Cursor Cloud specific instructions

This repo is developed primarily on Windows, but the dev stack runs fine on the
Linux Cloud VM. The environment update script already installs dependencies
(Python packages to `~/.local`, PHP/Composer, and the API's Composer/npm deps).

### Products / services

| Service | Where | Start command (from `bin/`) | Port | Notes |
|---------|-------|-----------------------------|------|-------|
| **DAM UI + local bridge** (primary product) | `apps/desktop` + `apps/web` | `python3 apps/desktop/serve_browser.py` | UI `8765`, bridge `8766` | Serves the Geex web UI and the Python `local_bridge.py` API together. This is the real product. |
| **Laravel API** (secondary / fallback) | `apps/api` | `php artisan serve --host=127.0.0.1 --port=8000` | `8000` | Parallel skeleton used by the web UI only as an auth/API fallback. |

The desktop native shell (`apps/desktop/launch.py`, pywebview) does **not** run
headless on the Cloud VM — use `serve_browser.py` (browser dev mode) instead.
Do **not** run bare `python -m http.server 8765`; without the bridge the UI
shows "Pliki offline".

### Non-obvious caveats

- **Ports before browser (HARD):** `:8765` and `:8766` must return HTTP 2xx.
  Smoke: `curl --max-time 5 http://127.0.0.1:8766/health`. See
  `bin/docs/project/AGENTS.md` for the full doctrine.
- **DB is SQLite offline by default** at `bin/DATABASE/dam-local.sqlite`
  (gitignored, auto-created on bridge start; users merged from
  `bin/DATABASE/users-seed.sqlite`). Postgres (Synology `:5433`) and Redis
  (`:6379`) are **optional** — the bridge degrades gracefully when they are
  absent. `watcher_ok:false` / `no_roots_under:M:` in `/health` is expected on
  Linux (no Marketing network drive).
- **Login needs a password set.** Seed accounts (18 Kubara users, e.g. admin
  `krzysztof.wieczorek@kubara.pl`) ship with bcrypt hashes but **no committed
  password**. Set one for local dev with:
  `DAM_SEED_PASSWORD='<8+ chars>' python3 apps/desktop/scripts/set-all-passwords.py`
  (banned trivial values like `test`/`password`). Then sign in at
  `http://127.0.0.1:8765/signin.html`.
- **Runtime writes dirty the tree.** Running the bridge/tests rewrites tracked
  files under `apps/desktop/data/` and `apps/web/data/` (e.g. `file-index.json`,
  `search-index.json`, `program-instructions.json`). These are regenerated
  artifacts — do **not** commit them; `git checkout -- bin/apps/desktop/data bin/apps/web/data`
  to reset.
- **SSH do Synology (alias `syno` / `nas`):** kanoniczna konfiguracja i sekrety sa w repo
  [`inyfinn/synology-mcp`](https://github.com/inyfinn/synology-mcp) (`docs/dom/cloud-agent-ssh.md`).
  SSH z internetu: **`inyfinn.synology.me:5022`** (nie port 22). Sekrety w Cursor Cloud
  Environment (nie w gicie): `NAS_SSH_KEY`, `NAS_SSH_USER=Inyfinn`, `NAS_SSH_HOST`,
  `NAS_SSH_PORT=5022`. Ten repo ma `.cursor/environment.json` — **podlacz te same sekrety**
  do Environment agenta DAM (obecny run bez linked environment nie widzi `NAS_SSH_*`).
  Setup: `bash bin/scripts/ops/setup-cloud-ssh-syno.sh` (czyta `NAS_SSH_KEY` →
  `~/.ssh/cloud-agent-nas`, aliasy `nas` + `syno`). Test: `ssh syno 'docker ps'`.
  `sync-database-backups-to-git.py` wymaga `ssh syno`. Diagnostyka PG bez SSH:
  `curl -sk https://inyfinn.synology.me/dam-api/db/status`.
- **Laravel API on Linux:** configure `apps/api/.env` with `DB_CONNECTION=sqlite`
  (default `.env.example` points at Postgres `:5433`), `touch database/database.sqlite`,
  then `php artisan key:generate && php artisan migrate`. The Sanctum
  `personal_access_tokens` migration must be published
  (`php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"`
  then `php artisan migrate`) — it is **gitignored** (`**/*token*` in root
  `.gitignore`) so it is not committed and must be re-published on a fresh
  checkout before API login works. `DamDemoSeeder` fails on Linux (it reads a
  hardcoded Windows path `P:\DAM\...`); create dev users via `php artisan tinker`
  instead.

### Lint / test / build

- Desktop tests: `cd bin/apps/desktop && python3 -m unittest discover -s tests -v`
  (2 tests fail on Linux due to Windows/data-fixture assumptions — pre-existing,
  not env-related).
- Web JS tests: `node bin/apps/web/scripts/tests/test_*.js`; JS syntax check via
  `node --check <file.js>`. QA smoke/contract scripts in `bin/scripts/qa/`.
- Laravel: tests `cd bin/apps/api && php artisan test`; lint `./vendor/bin/pint`
  (reports pre-existing style issues; use `--test` to check without fixing).
