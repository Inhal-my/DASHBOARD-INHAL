-- Kolom arsip dan penggabungan untuk berita_acara.
-- Perubahan ini sudah diterapkan manual di produksi dan staging; file ini
-- merekonstruksi kondisi tersebut agar instalasi baru dan restore konsisten.
ALTER TABLE berita_acara ADD COLUMN archived_at TEXT DEFAULT '';
ALTER TABLE berita_acara ADD COLUMN archived_by TEXT DEFAULT '';
ALTER TABLE berita_acara ADD COLUMN archive_reason TEXT DEFAULT '';
ALTER TABLE berita_acara ADD COLUMN merged_into TEXT DEFAULT '';
CREATE INDEX idx_ba_archived ON berita_acara(archived_at);
