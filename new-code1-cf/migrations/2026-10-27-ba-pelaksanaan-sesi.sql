-- BA Pelaksanaan multi-sesi: satu berita acara boleh mencakup beberapa jadwal.
-- Tabel ini menyimpan tautan BA -> jadwal (banyak baris per BA), sementara
-- berita_acara.jadwal_id tetap diisi sesi pertama untuk kompatibilitas.
-- Jalankan sekali pada database lama. Instalasi baru memakai schema.sql.

CREATE TABLE IF NOT EXISTS berita_acara_sesi (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT NOT NULL,
  jadwal_id TEXT NOT NULL, urutan INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ba_sesi_ba_id ON berita_acara_sesi(ba_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ba_sesi_jadwal_id ON berita_acara_sesi(jadwal_id);

-- Backfill tautan dari BA lama yang sudah menyimpan satu jadwal_id.
-- GROUP BY menjaga indeks unik tetap aman bila ada data lama yang menautkan
-- satu jadwal_id pada lebih dari satu baris berita_acara.
INSERT INTO berita_acara_sesi (timestamp, ba_id, jadwal_id, urutan)
SELECT MIN(b.timestamp), MIN(b.ba_id), b.jadwal_id, 1
FROM berita_acara b
WHERE TRIM(COALESCE(b.ba_id, '')) <> ''
  AND TRIM(COALESCE(b.jadwal_id, '')) <> ''
  AND NOT EXISTS (SELECT 1 FROM berita_acara_sesi s WHERE s.jadwal_id = b.jadwal_id)
GROUP BY b.jadwal_id;
