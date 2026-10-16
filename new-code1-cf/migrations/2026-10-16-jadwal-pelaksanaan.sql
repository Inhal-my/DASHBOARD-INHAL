-- Jadwal Pelaksanaan: admin Bagian membuat jadwal lebih dulu, lalu BA Pelaksanaan
-- merujuk jadwal lewat berita_acara.jadwal_id. Aditif, tanpa DROP/DELETE data lama
CREATE TABLE IF NOT EXISTS jadwal_pelaksanaan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, jadwal_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, kegiatan_key TEXT, tanggal TEXT, jam TEXT, dosen TEXT, catatan TEXT,
  active INTEGER DEFAULT 1, created_by TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS jadwal_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, jadwal_id TEXT, id_pengajuan TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, status_pengajuan TEXT
);
CREATE INDEX IF NOT EXISTS idx_jadwal_kegiatan_key ON jadwal_pelaksanaan(kegiatan_key);
CREATE INDEX IF NOT EXISTS idx_jadwal_peserta_jadwal_id ON jadwal_peserta(jadwal_id);
CREATE INDEX IF NOT EXISTS idx_jadwal_peserta_pengajuan ON jadwal_peserta(id_pengajuan);
ALTER TABLE berita_acara ADD COLUMN jadwal_id TEXT DEFAULT '';
