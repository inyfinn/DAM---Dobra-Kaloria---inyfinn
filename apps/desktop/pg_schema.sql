-- DAM ETA - schemat PostgreSQL (Synology, patrz docs/ADR/ADR-009-postgres-synology.md)
-- Tier 1: auth/audyt - zawsze zywe zapytania, bez lokalnego cache (patrz pg_db.py, auth_store.py).
-- Tier 2: dam_kv_store - jeden wiersz = jeden dzisiejszy plik JSON w apps/web/data/
--         (product-aliases, naming-dictionary, tag-proposals, carrier-types,
--          carrier-assignment-log, notification-groups, inbox-items,
--          carrier-overrides, viz-flags). Klient trzyma lokalny cache pliku,
--          odswiezany natychmiast po wlasnym zapisie i co 30 min przez watcher.
-- Idempotentne - bezpieczne do wielokrotnego odtworzenia.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  password_hash TEXT NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS device_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  machine_id TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  windows_user TEXT NOT NULL DEFAULT '',
  hostname TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  ts TEXT NOT NULL,
  action TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT 'anonymous',
  path TEXT NOT NULL DEFAULT '',
  local_path TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  meta_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (username);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);

-- Tier 2: dokument-store - "store_key" = nazwa pliku bez rozszerzenia (np. "tag-proposals").
CREATE TABLE IF NOT EXISTS dam_kv_store (
  store_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);
