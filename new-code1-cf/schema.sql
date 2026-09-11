DROP TABLE IF EXISTS status_history;
DROP TABLE IF EXISTS detail_kegiatan;
DROP TABLE IF EXISTS pengajuan;
DROP TABLE IF EXISTS config;
DROP TABLE IF EXISTS master_bagian;
DROP TABLE IF EXISTS master_kegiatan;
DROP TABLE IF EXISTS mahasiswa;

CREATE TABLE mahasiswa (
  npm TEXT PRIMARY KEY, nama_lengkap TEXT, email TEXT, blok TEXT, keterangan TEXT
);
CREATE TABLE master_kegiatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kategori TEXT NOT NULL, nilai TEXT NOT NULL
);
CREATE TABLE master_bagian (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lab TEXT, kegiatan_lab TEXT, bagian TEXT, email TEXT
);
CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE pengajuan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT, id_pengajuan TEXT UNIQUE, form_key TEXT, npm TEXT, nama_lengkap TEXT, email TEXT,
  no_hp_wa TEXT, blok TEXT, jenis_kegiatan TEXT, dosen TEXT, tanggal_pelaksanaan TEXT,
  keterangan TEXT, link_surat_keterangan TEXT, status TEXT, catatan_admin TEXT,
  notifikasi_terkirim_pada TEXT, status_notifikasi_email TEXT, error_notifikasi_email TEXT,
  lampiran_email TEXT, nomor_surat TEXT, link_acc_inhal TEXT, link_bukti_bayar TEXT,
  link_final TEXT, status_info_bagian TEXT, waktu_info_bagian TEXT, email_bagian TEXT,
  catatan_info_bagian TEXT, updated_at TEXT
);
CREATE TABLE detail_kegiatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, id_pengajuan TEXT,
  jenis_kegiatan TEXT, pilihan TEXT, detail TEXT, tanggal_pelaksanaan TEXT, bagian TEXT
);
CREATE TABLE status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, id_pengajuan TEXT,
  status TEXT, catatan TEXT, actor_email TEXT
);
CREATE INDEX idx_pengajuan_npm ON pengajuan(npm);
CREATE UNIQUE INDEX idx_pengajuan_form_key ON pengajuan(form_key);
CREATE INDEX idx_detail_pengajuan ON detail_kegiatan(id_pengajuan);
CREATE INDEX idx_history_pengajuan ON status_history(id_pengajuan);

INSERT INTO mahasiswa (npm, nama_lengkap, email, blok, keterangan) VALUES
('2201010001','Aisyah Putri','aisyah@contoh.com','A',''),
('2201010002','Budi Santoso','budi@contoh.com','B',''),
('2201010003','Citra Dewi','citra@contoh.com','A','');

INSERT INTO master_kegiatan (kategori, nilai) VALUES
('Blok','A'),('Blok','B'),
('Ujian','UAS'),('Ujian','UTS'),
('SGD','SGD 1'),('Detail SGD','Materi A'),
('KKD','KKD 1'),('Detail KKD','Materi B'),
('Lab','Lab Anatomi'),('Kegiatan Lab','Praktikum 1'),
('Dosen','dr. Andi');

INSERT INTO master_bagian (lab, kegiatan_lab, bagian, email) VALUES
('Lab Anatomi','Praktikum 1','Anatomi','anatomi@contoh.com');

INSERT INTO config (key, value) VALUES ('BUKTI_MODE','strict');

DROP TABLE IF EXISTS log_data;
DROP TABLE IF EXISTS nomor_surat;
DROP TABLE IF EXISTS check_data;
DROP TABLE IF EXISTS master_biaya;
DROP TABLE IF EXISTS berita_acara_admin_peserta;
DROP TABLE IF EXISTS berita_acara_admin;
DROP TABLE IF EXISTS berita_acara_peserta;
DROP TABLE IF EXISTS berita_acara;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS bagian_staff;
DROP TABLE IF EXISTS admin;
DROP TABLE IF EXISTS uploads;

CREATE TABLE admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT, password TEXT, nama TEXT
);
CREATE TABLE bagian_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, kategori TEXT, nama TEXT, pass TEXT
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY, role TEXT, nama TEXT, kategori TEXT, sub_bagian TEXT,
  kategoris TEXT, created_at TEXT, expires_at TEXT
);
CREATE TABLE auth_throttle (
  key TEXT PRIMARY KEY, fail_count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT, locked_until TEXT
);
CREATE TABLE uploads (
  id TEXT PRIMARY KEY, pengajuan_id TEXT, kind TEXT, file_name TEXT, mime_type TEXT,
  size INTEGER, content TEXT, created_at TEXT, created_by TEXT
);
CREATE INDEX idx_uploads_pengajuan ON uploads(pengajuan_id);
CREATE TABLE berita_acara (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jumlah_peserta TEXT, file_name TEXT,
  file_url TEXT, catatan TEXT, sumber TEXT
);
CREATE TABLE berita_acara_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, bagian TEXT, status_pengajuan TEXT
);
CREATE TABLE berita_acara_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jumlah_peserta TEXT, file_name TEXT,
  file_url TEXT, catatan TEXT, sumber TEXT
);
CREATE TABLE berita_acara_admin_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, bagian TEXT, status_pengajuan TEXT
);
CREATE TABLE master_biaya (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kegiatan TEXT, biaya TEXT
);
CREATE TABLE check_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, check_id TEXT, id_pengajuan TEXT,
  npm TEXT, nama_lengkap TEXT, blok TEXT, jenis_kegiatan TEXT, pilihan TEXT, detail TEXT,
  tanggal_pelaksanaan TEXT, bagian TEXT, dosen TEXT, hadir TEXT, catatan TEXT,
  updated_at TEXT, biaya TEXT
);
CREATE TABLE nomor_surat (
  id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, tahun TEXT, last_number INTEGER,
  updated_at TEXT
);
CREATE TABLE log_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, payload TEXT
);
CREATE INDEX idx_ba_ba_id ON berita_acara(ba_id);
CREATE INDEX idx_ba_peserta_ba_id ON berita_acara_peserta(ba_id);
CREATE INDEX idx_check_data_pengajuan ON check_data(id_pengajuan);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
