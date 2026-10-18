CREATE TABLE IF NOT EXISTS admin_mfa (
  admin_id INTEGER PRIMARY KEY,
  secret TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  recovery TEXT NOT NULL DEFAULT '[]',
  last_step INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

ALTER TABLE sessions ADD COLUMN admin_id INTEGER;
