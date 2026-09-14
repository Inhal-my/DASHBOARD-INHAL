ALTER TABLE berita_acara ADD COLUMN jam TEXT;
ALTER TABLE berita_acara ADD COLUMN dosen TEXT;
ALTER TABLE berita_acara ADD COLUMN kegiatan_key TEXT;
ALTER TABLE berita_acara_admin ADD COLUMN jam TEXT;
ALTER TABLE berita_acara_admin ADD COLUMN kegiatan_key TEXT;
CREATE INDEX IF NOT EXISTS idx_ba_kegiatan_key ON berita_acara(kegiatan_key);
CREATE INDEX IF NOT EXISTS idx_ba_admin_kegiatan_key ON berita_acara_admin(kegiatan_key);
UPDATE pengajuan SET dosen = '', tanggal_pelaksanaan = '';
