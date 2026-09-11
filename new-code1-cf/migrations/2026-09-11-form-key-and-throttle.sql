-- Add atomic duplicate guard for pengajuan and login rate limiting.
ALTER TABLE pengajuan ADD COLUMN form_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pengajuan_form_key ON pengajuan(form_key);

CREATE TABLE IF NOT EXISTS auth_throttle (
  key TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT,
  locked_until TEXT
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  pengajuan_id TEXT,
  kind TEXT,
  file_name TEXT,
  mime_type TEXT,
  size INTEGER,
  content TEXT,
  created_at TEXT,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_uploads_pengajuan ON uploads(pengajuan_id);
