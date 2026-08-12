-- DAM ETA audit log (Docker init + pg_store.ensure_schema)
CREATE TABLE IF NOT EXISTS dam_audit_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT 'anonymous',
  path TEXT NOT NULL DEFAULT '',
  local_path TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS dam_audit_log_ts_idx ON dam_audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS dam_audit_log_user_idx ON dam_audit_log (username);
CREATE INDEX IF NOT EXISTS dam_audit_log_action_idx ON dam_audit_log (action);
