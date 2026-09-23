-- Port the Apps Script LogUpload and AuditLog sheets to D1.
CREATE TABLE IF NOT EXISTS log_upload (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT,
  id_pengajuan TEXT,
  npm TEXT,
  nama_lengkap TEXT,
  blok TEXT,
  jenis_kegiatan TEXT,
  detail TEXT,
  tanggal TEXT,
  link_acc_inhal TEXT,
  link_bukti_bayar TEXT
);
CREATE INDEX IF NOT EXISTS idx_log_upload_pengajuan ON log_upload(id_pengajuan);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT,
  actor_email TEXT,
  aksi TEXT,
  target TEXT,
  detail TEXT,
  alasan TEXT
);
