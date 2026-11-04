-- Dosen multi: satu jadwal/berita acara boleh memiliki 2-5 dosen.
-- Tabel relasi menjadi sumber kebenaran; kolom lama jadwal_pelaksanaan.dosen dan
-- berita_acara.dosen tetap diisi dosen utama untuk kompatibilitas.
-- Jalankan sekali pada database lama. Instalasi baru memakai schema.sql.

CREATE TABLE IF NOT EXISTS jadwal_dosen (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, jadwal_id TEXT NOT NULL,
  nama TEXT NOT NULL, nama_key TEXT NOT NULL, urutan INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ba_dosen (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT NOT NULL,
  nama TEXT NOT NULL, nama_key TEXT NOT NULL, urutan INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_jadwal_dosen_jadwal_id ON jadwal_dosen(jadwal_id, urutan);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jadwal_dosen_unique ON jadwal_dosen(jadwal_id, nama_key);
CREATE INDEX IF NOT EXISTS idx_ba_dosen_ba_id ON ba_dosen(ba_id, urutan);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ba_dosen_unique ON ba_dosen(ba_id, nama_key);

-- Backfill dari kolom dosen tunggal yang sudah ada.
INSERT INTO jadwal_dosen (timestamp, jadwal_id, nama, nama_key, urutan)
SELECT MIN(j.timestamp), j.jadwal_id, TRIM(j.dosen), LOWER(TRIM(j.dosen)), 1
FROM jadwal_pelaksanaan j
WHERE TRIM(COALESCE(j.jadwal_id, '')) <> ''
  AND TRIM(COALESCE(j.dosen, '')) <> ''
  AND NOT EXISTS (SELECT 1 FROM jadwal_dosen d WHERE d.jadwal_id = j.jadwal_id)
GROUP BY j.jadwal_id;

INSERT INTO ba_dosen (timestamp, ba_id, nama, nama_key, urutan)
SELECT MIN(b.timestamp), b.ba_id, TRIM(b.dosen), LOWER(TRIM(b.dosen)), 1
FROM berita_acara b
WHERE TRIM(COALESCE(b.ba_id, '')) <> ''
  AND TRIM(COALESCE(b.dosen, '')) <> ''
  AND NOT EXISTS (SELECT 1 FROM ba_dosen d WHERE d.ba_id = b.ba_id)
GROUP BY b.ba_id;
