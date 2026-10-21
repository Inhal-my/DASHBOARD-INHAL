-- Backfill blok mahasiswa yang masih kosong dari pengajuan.
-- Hanya diisi bila satu NPM memiliki tepat satu nilai blok yang tidak kosong.
-- NPM dengan beberapa blok berbeda sengaja dilewati dan akan muncul di audit kualitas data.
UPDATE mahasiswa
SET blok = (
  SELECT MIN(trim(p.blok))
  FROM pengajuan p
  WHERE p.npm = mahasiswa.npm
    AND trim(coalesce(p.blok, '')) <> ''
)
WHERE trim(coalesce(mahasiswa.blok, '')) = ''
  AND (
    SELECT COUNT(DISTINCT lower(trim(p.blok)))
    FROM pengajuan p
    WHERE p.npm = mahasiswa.npm
      AND trim(coalesce(p.blok, '')) <> ''
  ) = 1;
