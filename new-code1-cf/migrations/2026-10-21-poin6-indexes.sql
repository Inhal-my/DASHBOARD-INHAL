-- Indeks untuk jalur baca dan pembersihan data Poin 6.
CREATE INDEX IF NOT EXISTS idx_ba_admin_berkas_pengajuan_active
ON berita_acara_admin_berkas(id_pengajuan, active);

CREATE INDEX IF NOT EXISTS idx_ba_admin_peserta_ba_active
ON berita_acara_admin_peserta(ba_id, active);

CREATE INDEX IF NOT EXISTS idx_ba_admin_peserta_pengajuan_active
ON berita_acara_admin_peserta(id_pengajuan, active);

CREATE INDEX IF NOT EXISTS idx_ba_peserta_pengajuan
ON berita_acara_peserta(id_pengajuan);

CREATE INDEX IF NOT EXISTS idx_pengajuan_blok
ON pengajuan(blok);

CREATE INDEX IF NOT EXISTS idx_pengajuan_status
ON pengajuan(status);

CREATE INDEX IF NOT EXISTS idx_jadwal_active_tanggal
ON jadwal_pelaksanaan(active, tanggal);
