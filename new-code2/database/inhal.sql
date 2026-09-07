CREATE DATABASE IF NOT EXISTS inhal DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inhal;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS mahasiswa;
CREATE TABLE mahasiswa (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  npm VARCHAR(20) NOT NULL,
  nama_lengkap VARCHAR(191) NOT NULL,
  email VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  keterangan TEXT NULL,
  UNIQUE KEY uq_mahasiswa_npm (npm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS pengajuan;
CREATE TABLE pengajuan (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_pengajuan VARCHAR(32) NOT NULL,
  timestamp DATETIME NOT NULL,
  npm VARCHAR(20) NOT NULL,
  nama_lengkap VARCHAR(191) NOT NULL,
  email VARCHAR(191) NOT NULL,
  no_hp_wa VARCHAR(32) NOT NULL,
  blok VARCHAR(64) NULL,
  jenis_kegiatan VARCHAR(64) NULL,
  matakuliah VARCHAR(191) NULL,
  dosen VARCHAR(191) NULL,
  tanggal_pelaksanaan DATE NULL,
  keterangan TEXT NULL,
  link_surat_keterangan VARCHAR(512) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Menunggu',
  catatan_admin TEXT NULL,
  notifikasi_terkirim_pada DATETIME NULL,
  status_notifikasi_email VARCHAR(32) NULL,
  error_notifikasi_email TEXT NULL,
  lampiran_email VARCHAR(512) NULL,
  nomor_surat VARCHAR(64) NULL,
  path_acc_inhal VARCHAR(512) NULL,
  path_bukti_bayar VARCHAR(512) NULL,
  path_final VARCHAR(512) NULL,
  status_info_bagian VARCHAR(32) NULL,
  waktu_info_bagian DATETIME NULL,
  email_bagian VARCHAR(191) NULL,
  catatan_info_bagian TEXT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_pengajuan_id (id_pengajuan),
  KEY idx_pengajuan_npm (npm),
  KEY idx_pengajuan_status (status),
  KEY idx_pengajuan_blok (blok),
  KEY idx_pengajuan_tanggal (tanggal_pelaksanaan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS detail_kegiatan;
CREATE TABLE detail_kegiatan (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pengajuan_id BIGINT UNSIGNED NOT NULL,
  id_pengajuan VARCHAR(32) NOT NULL,
  timestamp DATETIME NOT NULL,
  jenis_kegiatan VARCHAR(64) NULL,
  pilihan VARCHAR(191) NULL,
  detail VARCHAR(191) NULL,
  tanggal_pelaksanaan DATE NULL,
  bagian VARCHAR(191) NULL,
  KEY idx_detail_pengajuan (pengajuan_id),
  KEY idx_detail_id_pengajuan (id_pengajuan),
  CONSTRAINT fk_detail_pengajuan FOREIGN KEY (pengajuan_id) REFERENCES pengajuan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS status_history;
CREATE TABLE status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pengajuan_id BIGINT UNSIGNED NOT NULL,
  id_pengajuan VARCHAR(32) NOT NULL,
  timestamp DATETIME NOT NULL,
  status VARCHAR(32) NOT NULL,
  catatan TEXT NULL,
  actor_email VARCHAR(191) NULL,
  KEY idx_history_pengajuan (pengajuan_id),
  KEY idx_history_id_pengajuan (id_pengajuan),
  CONSTRAINT fk_history_pengajuan FOREIGN KEY (pengajuan_id) REFERENCES pengajuan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS check_data;
CREATE TABLE check_data (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  check_id VARCHAR(32) NOT NULL,
  pengajuan_id BIGINT UNSIGNED NULL,
  id_pengajuan VARCHAR(32) NULL,
  timestamp DATETIME NOT NULL,
  npm VARCHAR(20) NULL,
  nama_lengkap VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  jenis_kegiatan VARCHAR(64) NULL,
  pilihan VARCHAR(191) NULL,
  detail VARCHAR(191) NULL,
  tanggal_pelaksanaan DATE NULL,
  bagian VARCHAR(191) NULL,
  dosen VARCHAR(191) NULL,
  hadir TINYINT(1) NULL,
  catatan TEXT NULL,
  biaya DECIMAL(15,2) NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_check_id (check_id),
  KEY idx_check_pengajuan (pengajuan_id),
  KEY idx_check_override (pengajuan_id, detail)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS master_kegiatan;
CREATE TABLE master_kegiatan (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kategori VARCHAR(64) NOT NULL,
  nilai VARCHAR(191) NOT NULL,
  UNIQUE KEY uq_master_kegiatan (kategori, nilai)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS master_matakuliah;
CREATE TABLE master_matakuliah (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode VARCHAR(32) NULL,
  nama VARCHAR(191) NOT NULL,
  blok VARCHAR(64) NULL,
  sks TINYINT UNSIGNED NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_matakuliah_kode (kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS master_bagian;
CREATE TABLE master_bagian (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lab VARCHAR(191) NULL,
  kegiatan_lab VARCHAR(191) NULL,
  bagian VARCHAR(191) NULL,
  email VARCHAR(191) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS master_biaya;
CREATE TABLE master_biaya (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kegiatan VARCHAR(191) NOT NULL,
  biaya DECIMAL(15,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS config;
CREATE TABLE config (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(64) NOT NULL,
  config_value TEXT NULL,
  UNIQUE KEY uq_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS nomor_surat;
CREATE TABLE nomor_surat (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  tahun SMALLINT UNSIGNED NOT NULL,
  last_number INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_nomor_surat (type, tahun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS admin;
CREATE TABLE admin (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS bagian_staff;
CREATE TABLE bagian_staff (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL,
  kategori VARCHAR(64) NULL,
  nama VARCHAR(191) NULL,
  password_hash VARCHAR(255) NOT NULL,
  UNIQUE KEY uq_bagian_staff_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS audit_log;
CREATE TABLE audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  actor_email VARCHAR(191) NULL,
  aksi VARCHAR(191) NULL,
  target VARCHAR(191) NULL,
  detail TEXT NULL,
  alasan TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS log_upload;
CREATE TABLE log_upload (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  pengajuan_id BIGINT UNSIGNED NULL,
  id_pengajuan VARCHAR(32) NULL,
  npm VARCHAR(20) NULL,
  nama_lengkap VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  jenis_kegiatan VARCHAR(64) NULL,
  detail VARCHAR(191) NULL,
  tanggal DATE NULL,
  path_acc_inhal VARCHAR(512) NULL,
  path_bukti_bayar VARCHAR(512) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS berita_acara;
CREATE TABLE berita_acara (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  ba_id VARCHAR(32) NOT NULL,
  bagian VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  nama_kegiatan VARCHAR(191) NULL,
  tanggal_pelaksanaan DATE NULL,
  jumlah_peserta INT UNSIGNED NOT NULL DEFAULT 0,
  file_name VARCHAR(255) NULL,
  file_path VARCHAR(512) NULL,
  catatan TEXT NULL,
  sumber VARCHAR(16) NOT NULL DEFAULT 'Bagian',
  UNIQUE KEY uq_ba_id (ba_id),
  UNIQUE KEY uq_ba_bagian_duplikat (bagian, blok, nama_kegiatan, tanggal_pelaksanaan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS berita_acara_peserta;
CREATE TABLE berita_acara_peserta (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  ba_id VARCHAR(32) NOT NULL,
  npm VARCHAR(20) NULL,
  nama_lengkap VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  bagian VARCHAR(191) NULL,
  status_pengajuan VARCHAR(32) NULL,
  KEY idx_bap_ba (ba_id),
  CONSTRAINT fk_bap_ba FOREIGN KEY (ba_id) REFERENCES berita_acara(ba_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS berita_acara_admin;
CREATE TABLE berita_acara_admin (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  ba_id VARCHAR(32) NOT NULL,
  bagian VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  nama_kegiatan VARCHAR(191) NULL,
  tanggal_pelaksanaan DATE NULL,
  jumlah_peserta INT UNSIGNED NOT NULL DEFAULT 0,
  file_name VARCHAR(255) NULL,
  file_path VARCHAR(512) NULL,
  catatan TEXT NULL,
  sumber VARCHAR(16) NOT NULL DEFAULT 'Admin',
  UNIQUE KEY uq_ba_admin_id (ba_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS berita_acara_admin_peserta;
CREATE TABLE berita_acara_admin_peserta (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  ba_id VARCHAR(32) NOT NULL,
  npm VARCHAR(20) NULL,
  nama_lengkap VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  bagian VARCHAR(191) NULL,
  status_pengajuan VARCHAR(32) NULL,
  KEY idx_bap_admin_ba (ba_id),
  CONSTRAINT fk_bap_admin_ba FOREIGN KEY (ba_id) REFERENCES berita_acara_admin(ba_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS email_templates;
CREATE TABLE email_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode VARCHAR(64) NOT NULL,
  subjek VARCHAR(191) NOT NULL,
  body_html MEDIUMTEXT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_email_template_kode (kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS ci_sessions;
CREATE TABLE ci_sessions (
  id VARCHAR(128) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  timestamp INT UNSIGNED NOT NULL DEFAULT 0,
  data BLOB NOT NULL,
  PRIMARY KEY (id, ip_address),
  KEY ci_sessions_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed
INSERT INTO config (config_key, config_value) VALUES
('BUKTI_MODE','strict'),
('BAGIAN_BA_FINAL_ONLY','0'),
('BAGIAN_BA_STATUSES','["Diterima","ACC"]'),
('APP_NAME','INHAL'),
('TIMEZONE','Asia/Jakarta');

INSERT INTO master_kegiatan (kategori, nilai) VALUES
('Blok','Blok 1'),('Blok','Blok 2'),
('Ujian','UTS'),('Ujian','UAS'),
('SGD','SGD 1'),('KKD','KKD 1'),
('Lab','Lab A'),('Lab','Lab B'),
('Kegiatan Lab','Praktikum Kimia'),
('Dosen','Dr. Andi, M.Pd.'),('Dosen','Prof. Siti, Ph.D.'),
('Matakuliah','Kimia Dasar'),('Matakuliah','Fisika Dasar');

INSERT INTO master_matakuliah (kode, nama, blok, sks) VALUES
('KIM101','Kimia Dasar','Blok 1',3),
('FIS101','Fisika Dasar','Blok 1',3),
('BIO201','Biologi Sel','Blok 2',2);

INSERT INTO master_biaya (kegiatan, biaya) VALUES
('UTS',50000),('UAS',50000),('SGD 1',25000),('KKD 1',25000);

INSERT INTO admin (nama, password_hash) VALUES
('admin', '$2y$10$f8NQznPFlskQcsn0Ncfu3uMf/xXDVXYx8LpvhpoCKj9NC2ZxlbB..');

INSERT INTO bagian_staff (email, kategori, nama, password_hash) VALUES
('staf.sgd@inhal.test','SGD','Staf SGD', '$2y$10$f8NQznPFlskQcsn0Ncfu3uMf/xXDVXYx8LpvhpoCKj9NC2ZxlbB..');

INSERT INTO email_templates (kode, subjek, body_html, aktif) VALUES
('acc_diterima','Pengajuan INHAL Diterima','<p>Yth. {NAMA},</p><p>Pengajuan {NPM} telah diterima.</p>',1),
('acc_ditolak','Pengajuan INHAL Ditolak','<p>Yth. {NAMA},</p><p>Pengajuan {NPM} ditolak. Catatan: {CATATAN}</p>',1),
('acc_final','ACC Final INHAL','<p>Yth. {NAMA},</p><p>Nomor surat {NOMOR_SURAT}.</p>',1);

INSERT INTO mahasiswa (npm, nama_lengkap, email, blok) VALUES
('1234567890','Mahasiswa Contoh','contoh@inhal.test','Blok 1');

SET FOREIGN_KEY_CHECKS = 1;
