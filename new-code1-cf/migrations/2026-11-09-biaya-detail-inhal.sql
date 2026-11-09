-- Biaya kini ditentukan oleh nama Detail (Inhal/Remediasi/Praktikum/PostTest).
-- Samakan penulisan PostTest pada master biaya agar cocok persis dengan
-- detail_kegiatan dan opsi Kegiatan Lab.

UPDATE master_biaya
SET kegiatan = 'PostTest'
WHERE lower(trim(kegiatan)) = 'postest'
  AND NOT EXISTS (
    SELECT 1 FROM master_biaya WHERE lower(trim(kegiatan)) = 'posttest'
  );

UPDATE master_biaya
SET kegiatan = 'Gratis PostTest'
WHERE lower(trim(kegiatan)) = 'gratis postest'
  AND NOT EXISTS (
    SELECT 1 FROM master_biaya WHERE lower(trim(kegiatan)) = 'gratis posttest'
  );

-- Pastikan opsi Detail KKD/SGD "Inhal" tersedia di master kegiatan.
INSERT INTO master_kegiatan (kategori, nilai)
SELECT 'Detail KKD', 'Inhal'
WHERE NOT EXISTS (
  SELECT 1 FROM master_kegiatan
  WHERE lower(trim(kategori)) = 'detail kkd' AND lower(trim(nilai)) = 'inhal'
);

INSERT INTO master_kegiatan (kategori, nilai)
SELECT 'Detail SGD', 'Inhal'
WHERE NOT EXISTS (
  SELECT 1 FROM master_kegiatan
  WHERE lower(trim(kategori)) = 'detail sgd' AND lower(trim(nilai)) = 'inhal'
);
