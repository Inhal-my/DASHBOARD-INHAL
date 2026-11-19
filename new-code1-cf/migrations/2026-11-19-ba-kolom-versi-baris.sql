-- Kolom versi baris untuk berita_acara: jejak waktu ubah dan penomoran revisi.
-- Perubahan ini sudah diterapkan manual di produksi. Catat di d1_migrations
-- tanpa menjalankan ulang agar instalasi baru dan restore tetap konsisten.
ALTER TABLE berita_acara ADD COLUMN updated_at TEXT DEFAULT '';
ALTER TABLE berita_acara ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
