-- Backfill id_pengajuan untuk peserta BA Pendukung hasil impor sheet
-- BeritaAcaraAdminPeserta (sheet sumber tidak punya kolom ID Pengajuan,
-- sehingga id_pengajuan tersimpan kosong dan berkas tidak bisa diunggah
-- lewat modal "Kelola BA Pendukung").
--
-- Setiap peserta tanpa id_pengajuan dipetakan ke tepat satu pengajuan dengan
-- NPM sama, memakai kecocokan jenis_kegiatan / pilihan / detail terhadap kolom
-- bagian peserta (atau bila mahasiswa hanya punya satu pengajuan). Hanya baris
-- dengan satu kandidat unik yang diisi supaya tidak salah pasang. Idempotent:
-- baris yang sudah terisi tidak disentuh lagi.

WITH matched AS (
  SELECT p.id AS peserta_id, MIN(g.id_pengajuan) AS id_pengajuan
  FROM berita_acara_admin_peserta p
  JOIN pengajuan g ON g.npm = p.npm
  WHERE (p.id_pengajuan IS NULL OR p.id_pengajuan = '')
    AND (
      lower(g.jenis_kegiatan) = lower(p.bagian)
      OR EXISTS (
        SELECT 1 FROM detail_kegiatan d
        WHERE d.id_pengajuan = g.id_pengajuan
          AND (lower(d.pilihan) = lower(p.bagian) OR lower(d.detail) = lower(p.bagian))
      )
      OR (SELECT COUNT(*) FROM pengajuan g3 WHERE g3.npm = p.npm) = 1
    )
  GROUP BY p.id
  HAVING COUNT(*) = 1
)
UPDATE berita_acara_admin_peserta
SET id_pengajuan = (
  SELECT m.id_pengajuan FROM matched m WHERE m.peserta_id = berita_acara_admin_peserta.id
)
WHERE id IN (SELECT peserta_id FROM matched);
