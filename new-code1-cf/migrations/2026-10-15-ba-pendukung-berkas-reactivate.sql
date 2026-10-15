-- Pemulihan data BA Pendukung: reaktivasi berkas terakhir untuk peserta yang
-- aktif tetapi tidak punya berkas aktif sama sekali.
--
-- Kondisi ini muncul ketika berkas lama tergusur (superseded) atau peserta
-- dihapus lalu ditambah ulang lewat "Tambah peserta" tanpa unggah berkas baru.
-- Batch unggahan terakhir (timestamp sama dengan baris inactive terbaru)
-- diaktifkan kembali agar seluruh halaman satu unggahan ikut pulih.
--
-- Tidak menyentuh peserta tanpa baris berkas sama sekali (mis. hasil impor
-- sheet BeritaAcaraAdminPeserta) -- peserta tersebut memang belum punya berkas
-- dan perlu diunggah ulang. Aman dijalankan berulang (idempotent).

-- 1) Tandai BA terdampak agar PDF-nya dibuat ulang admin setelah berkas pulih.
UPDATE berita_acara_admin
SET needs_regen = 1
WHERE ba_id IN (
  SELECT DISTINCT p.ba_id
  FROM berita_acara_admin_peserta p
  JOIN berita_acara_admin_berkas b ON b.ba_id = p.ba_id AND b.id_pengajuan = p.id_pengajuan
  WHERE p.active = 1
    AND b.active = 0
    AND NOT EXISTS (
      SELECT 1 FROM berita_acara_admin_berkas a
      WHERE a.ba_id = p.ba_id AND a.id_pengajuan = p.id_pengajuan AND a.active = 1
    )
);

-- 2) Reaktivasi seluruh baris pada batch unggahan terakhir per peserta.
WITH affected AS (
  SELECT b.ba_id AS ba_id, b.id_pengajuan AS id_pengajuan
  FROM berita_acara_admin_berkas b
  JOIN berita_acara_admin_peserta p
    ON p.ba_id = b.ba_id AND p.id_pengajuan = b.id_pengajuan AND p.active = 1
  WHERE b.active = 0
    AND NOT EXISTS (
      SELECT 1 FROM berita_acara_admin_berkas a
      WHERE a.ba_id = b.ba_id AND a.id_pengajuan = b.id_pengajuan AND a.active = 1
    )
  GROUP BY b.ba_id, b.id_pengajuan
),
latest AS (
  SELECT b.id AS id
  FROM berita_acara_admin_berkas b
  JOIN affected f ON f.ba_id = b.ba_id AND f.id_pengajuan = b.id_pengajuan
  WHERE b.active = 0
    AND b.timestamp = (
      SELECT b2.timestamp FROM berita_acara_admin_berkas b2
      WHERE b2.ba_id = b.ba_id AND b2.id_pengajuan = b.id_pengajuan AND b2.active = 0
      ORDER BY b2.id DESC LIMIT 1
    )
)
UPDATE berita_acara_admin_berkas
SET active = 1, superseded_at = NULL
WHERE id IN (SELECT id FROM latest);
