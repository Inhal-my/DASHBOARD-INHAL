-- BA Pendukung: pisahkan dokumen dasar (file lama) dari PDF gabungan per-anggota
ALTER TABLE berita_acara_admin ADD COLUMN base_file_url TEXT DEFAULT '';
ALTER TABLE berita_acara_admin ADD COLUMN base_file_name TEXT DEFAULT '';

-- Backfill dokumen dasar dari file_url lama, hanya bila BA belum punya
-- berkas per-peserta aktif (BA yang sudah di-regenerate tidak disentuh)
UPDATE berita_acara_admin SET base_file_url = file_url
  WHERE (base_file_url IS NULL OR base_file_url = '')
    AND file_url IS NOT NULL AND file_url <> ''
    AND NOT EXISTS (
      SELECT 1 FROM berita_acara_admin_berkas b
      WHERE b.ba_id = berita_acara_admin.ba_id AND b.active = 1
    );
