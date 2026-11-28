-- Penanda BA legacy: BA lama yang sah tanpa jadwal sesi. BA tetap dihitung
-- 1 sesi (virtual) dan datanya tidak dihapus, tetapi temuan "tanpa sesi" dan
-- "tanpa jadwal" diabaikan karena statusnya memang disengaja. Penandaan butuh
-- alasan dan tercatat di audit log.
ALTER TABLE berita_acara ADD COLUMN legacy_sesi INTEGER NOT NULL DEFAULT 0;
ALTER TABLE berita_acara ADD COLUMN legacy_reason TEXT DEFAULT '';
ALTER TABLE berita_acara ADD COLUMN legacy_at TEXT DEFAULT '';
ALTER TABLE berita_acara ADD COLUMN legacy_by TEXT DEFAULT '';
UPDATE berita_acara SET legacy_sesi = 0 WHERE legacy_sesi IS NULL;
UPDATE berita_acara SET legacy_reason = '' WHERE legacy_reason IS NULL;
UPDATE berita_acara SET legacy_at = '' WHERE legacy_at IS NULL;
UPDATE berita_acara SET legacy_by = '' WHERE legacy_by IS NULL;
