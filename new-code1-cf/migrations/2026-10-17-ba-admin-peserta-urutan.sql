-- Isi nomor urut peserta BA Pendukung lama yang masih NULL.
-- Peserta hasil impor sheet tidak membawa kolom urutan, tanpa nomor ini UI
-- menampilkan "0." di depan nama peserta.
--
-- Nomor baru melanjutkan urutan maksimum yang sudah ada pada BA yang sama,
-- diurutkan berdasarkan timestamp lalu id. Aman dijalankan berulang karena
-- hanya menyentuh baris dengan urutan NULL.
WITH ranked AS (
  SELECT p.id,
    COALESCE((
      SELECT MAX(x.urutan) FROM berita_acara_admin_peserta x
      WHERE x.ba_id = p.ba_id AND x.urutan IS NOT NULL
    ), 0) + ROW_NUMBER() OVER (
      PARTITION BY p.ba_id ORDER BY p.timestamp, p.id
    ) AS next_urutan
  FROM berita_acara_admin_peserta p
  WHERE p.urutan IS NULL
)
UPDATE berita_acara_admin_peserta
SET urutan = (SELECT ranked.next_urutan FROM ranked WHERE ranked.id = berita_acara_admin_peserta.id)
WHERE urutan IS NULL
  AND id IN (SELECT id FROM ranked);
