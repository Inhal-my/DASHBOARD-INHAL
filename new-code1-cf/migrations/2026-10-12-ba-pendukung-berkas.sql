ALTER TABLE berita_acara_admin ADD COLUMN updated_at TEXT;
ALTER TABLE berita_acara_admin ADD COLUMN needs_regen INTEGER DEFAULT 0;
ALTER TABLE berita_acara_admin_peserta ADD COLUMN urutan INTEGER;
ALTER TABLE berita_acara_admin_peserta ADD COLUMN active INTEGER DEFAULT 1;
CREATE TABLE IF NOT EXISTS berita_acara_admin_berkas (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, id_pengajuan TEXT, npm TEXT,
  urutan INTEGER, page_index INTEGER, file_name TEXT, file_url TEXT,
  active INTEGER DEFAULT 1, superseded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ba_admin_berkas_ba_id ON berita_acara_admin_berkas(ba_id);
