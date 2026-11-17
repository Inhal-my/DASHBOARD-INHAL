-- Arsip BA Pelaksanaan: BA ganda tidak dihapus, tetapi disembunyikan dari
-- pembacaan aktif. `merged_into` menyimpan BA tujuan saat penggabungan.
-- `revision` dipakai untuk mencegah dua admin menyimpan perubahan bersamaan.
ALTER TABLE berita_acara ADD COLUMN archived_at TEXT DEFAULT '';
ALTER TABLE berita_acara ADD COLUMN archived_by TEXT DEFAULT '';
ALTER TABLE berita_acara ADD COLUMN archive_reason TEXT DEFAULT '';
ALTER TABLE berita_acara ADD COLUMN merged_into TEXT DEFAULT '';
ALTER TABLE berita_acara ADD COLUMN updated_at TEXT DEFAULT '';
ALTER TABLE berita_acara ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_ba_archived ON berita_acara(archived_at);
UPDATE berita_acara SET archived_at = '' WHERE archived_at IS NULL;
UPDATE berita_acara SET archived_by = '' WHERE archived_by IS NULL;
UPDATE berita_acara SET archive_reason = '' WHERE archive_reason IS NULL;
UPDATE berita_acara SET merged_into = '' WHERE merged_into IS NULL;
UPDATE berita_acara SET updated_at = '' WHERE updated_at IS NULL;
