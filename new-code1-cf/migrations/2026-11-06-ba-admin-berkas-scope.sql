-- Bedakan berkas milik peserta (default) dari berkas bersama milik BA.
ALTER TABLE berita_acara_admin_berkas ADD COLUMN scope TEXT DEFAULT 'peserta';

UPDATE berita_acara_admin_berkas
  SET scope = 'peserta'
  WHERE scope IS NULL OR trim(scope) = '';

CREATE INDEX IF NOT EXISTS idx_ba_admin_berkas_ba_scope_active
  ON berita_acara_admin_berkas(ba_id, scope, active);
