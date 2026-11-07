-- Indeks waktu untuk modul Riwayat Log (tab dashboard "Riwayat").
-- Modul hanya membaca 3 tabel: audit_log, status_history, log_upload.
-- status_history & log_upload sudah punya indeks per pengajuan, belum per waktu;
-- audit_log belum punya indeks sama sekali. Tanpa indeks pun fungsional untuk
-- volume sekarang, indeks mencegah pemindaian penuh saat data tumbuh.

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON status_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_upload_timestamp ON log_upload(timestamp);
