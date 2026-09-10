CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT, password TEXT, nama TEXT
);
CREATE TABLE IF NOT EXISTS bagian_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, kategori TEXT, nama TEXT, pass TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, role TEXT, nama TEXT, kategori TEXT, sub_bagian TEXT,
  kategoris TEXT, created_at TEXT, expires_at TEXT
);
CREATE TABLE IF NOT EXISTS berita_acara (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jumlah_peserta TEXT, file_name TEXT,
  file_url TEXT, catatan TEXT, sumber TEXT
);
CREATE TABLE IF NOT EXISTS berita_acara_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, bagian TEXT, status_pengajuan TEXT
);
CREATE TABLE IF NOT EXISTS berita_acara_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jumlah_peserta TEXT, file_name TEXT,
  file_url TEXT, catatan TEXT, sumber TEXT
);
CREATE TABLE IF NOT EXISTS berita_acara_admin_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, bagian TEXT, status_pengajuan TEXT
);
CREATE TABLE IF NOT EXISTS master_biaya (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kegiatan TEXT, biaya TEXT
);
CREATE TABLE IF NOT EXISTS check_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, check_id TEXT, id_pengajuan TEXT,
  npm TEXT, nama_lengkap TEXT, blok TEXT, jenis_kegiatan TEXT, pilihan TEXT, detail TEXT,
  tanggal_pelaksanaan TEXT, bagian TEXT, dosen TEXT, hadir TEXT, catatan TEXT,
  updated_at TEXT, biaya TEXT
);
CREATE TABLE IF NOT EXISTS nomor_surat (
  id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, tahun TEXT, last_number INTEGER,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS log_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, payload TEXT
);
CREATE INDEX IF NOT EXISTS idx_ba_ba_id ON berita_acara(ba_id);
CREATE INDEX IF NOT EXISTS idx_ba_peserta_ba_id ON berita_acara_peserta(ba_id);
CREATE INDEX IF NOT EXISTS idx_check_data_pengajuan ON check_data(id_pengajuan);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
