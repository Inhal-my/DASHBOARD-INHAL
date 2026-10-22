-- Verifikasi pembayaran dan riwayat koreksi.
-- Jalankan sekali pada database lama. Instalasi baru memakai schema.sql.

ALTER TABLE pengajuan ADD COLUMN status_pembayaran TEXT NOT NULL DEFAULT 'belum';
ALTER TABLE pengajuan ADD COLUMN kesesuaian_pembayaran TEXT;
ALTER TABLE pengajuan ADD COLUMN nominal_dibayar INTEGER;
ALTER TABLE pengajuan ADD COLUMN tanggal_bayar TEXT;
ALTER TABLE pengajuan ADD COLUMN metode_bayar TEXT;
ALTER TABLE pengajuan ADD COLUMN catatan_verifikasi TEXT;
ALTER TABLE pengajuan ADD COLUMN verified_at TEXT;
ALTER TABLE pengajuan ADD COLUMN verified_by TEXT;
ALTER TABLE pengajuan ADD COLUMN payment_revision INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS pembayaran_revisi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pengajuan TEXT NOT NULL,
  revision INTEGER NOT NULL,
  mode TEXT NOT NULL,
  status_lama TEXT, status_baru TEXT,
  kesesuaian_lama TEXT, kesesuaian_baru TEXT,
  nominal_lama INTEGER, nominal_baru INTEGER,
  tanggal_lama TEXT, tanggal_baru TEXT,
  metode_lama TEXT, metode_baru TEXT,
  alasan TEXT, catatan TEXT, actor TEXT, created_at TEXT,
  before_json TEXT, after_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_pembayaran_revisi_pengajuan
  ON pembayaran_revisi(id_pengajuan, revision);

UPDATE pengajuan
SET status_pembayaran = 'menunggu'
WHERE COALESCE(TRIM(link_bukti_bayar), '') <> ''
  AND COALESCE(TRIM(link_final), '') = '';

UPDATE pengajuan
SET status_pembayaran = 'gratis'
WHERE EXISTS (
  SELECT 1 FROM check_data c
  WHERE c.id_pengajuan = pengajuan.id_pengajuan
    AND c.detail = 'BIAYA-OVERRIDE'
    AND COALESCE(TRIM(c.pilihan), '') = ''
    AND COALESCE(TRIM(c.tanggal_pelaksanaan), '') = ''
    AND CAST(REPLACE(REPLACE(COALESCE(c.biaya, '0'), '.', ''), ',', '') AS INTEGER) = 0
);
