-- Migrasi integritas master Blok.
-- 1. Rename data lama Gastrointestinal, hepatobilier, and pancreas -> Gastro.
-- 2. Sinkronkan kegiatan_key pada BA dan jadwal.
-- 3. Tandai PDF BA Admin yang sudah ada untuk dibuat ulang.
-- 4. Deduplikasi master_kegiatan dan pasang unique index.

-- Kegiatan key memakai blok ternormalisasi: huruf kecil, spasi dirapatkan.
UPDATE berita_acara
SET kegiatan_key = replace(kegiatan_key, 'gastrointestinal, hepatobilier, and pancreas', 'gastro')
WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';

UPDATE berita_acara_admin
SET kegiatan_key = replace(kegiatan_key, 'gastrointestinal, hepatobilier, and pancreas', 'gastro')
WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';

UPDATE jadwal_pelaksanaan
SET kegiatan_key = replace(kegiatan_key, 'gastrointestinal, hepatobilier, and pancreas', 'gastro')
WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';

UPDATE berita_acara_admin
SET needs_regen = 1
WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas'
  AND coalesce(file_url, '') <> '';

UPDATE pengajuan SET blok = 'Gastro' WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';
UPDATE check_data SET blok = 'Gastro' WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';
UPDATE mahasiswa SET blok = 'Gastro' WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';
UPDATE berita_acara SET blok = 'Gastro' WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';
UPDATE berita_acara_peserta SET blok = 'Gastro' WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';
UPDATE berita_acara_admin SET blok = 'Gastro' WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';
UPDATE berita_acara_admin_peserta SET blok = 'Gastro' WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';
UPDATE jadwal_pelaksanaan SET blok = 'Gastro' WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';
UPDATE jadwal_peserta SET blok = 'Gastro' WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';
UPDATE log_upload SET blok = 'Gastro' WHERE lower(trim(blok)) = 'gastrointestinal, hepatobilier, and pancreas';

-- Bila master lama masih ada: ubah ke Gastro, atau hapus bila Gastro sudah ada.
UPDATE master_kegiatan
SET nilai = 'Gastro'
WHERE lower(trim(kategori)) = 'blok'
  AND lower(trim(nilai)) = 'gastrointestinal, hepatobilier, and pancreas'
  AND NOT EXISTS (
    SELECT 1 FROM master_kegiatan
    WHERE lower(trim(kategori)) = 'blok' AND lower(trim(nilai)) = 'gastro'
  );

DELETE FROM master_kegiatan
WHERE lower(trim(kategori)) = 'blok'
  AND lower(trim(nilai)) = 'gastrointestinal, hepatobilier, and pancreas';

-- Deduplikasi semua kategori: simpan baris dengan id terkecil.
DELETE FROM master_kegiatan
WHERE id NOT IN (
  SELECT MIN(id) FROM master_kegiatan
  GROUP BY lower(trim(kategori)), lower(trim(nilai))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_kegiatan_unique
ON master_kegiatan(lower(trim(kategori)), lower(trim(nilai)));

INSERT INTO audit_log (timestamp, actor_email, aksi, target, detail, alasan)
VALUES (
  datetime('now'),
  'migration',
  'RENAME_MASTER',
  'Blok: Gastrointestinal, hepatobilier, and pancreas -> Gastro',
  'Migrasi data lama ke nama blok Gastro.',
  ''
);
