-- Backfill status pembayaran untuk baris yang sudah punya bukti bayar.
-- Migrasi 2026-10-22 hanya menandai baris tanpa Link Final, sehingga baris yang
-- sudah punya bukti sekaligus Link Final tetap 'belum' dan tampil sebagai
-- "Belum Bayar" di tab Data Pembayaran.
-- Jalankan sekali pada database lama. Instalasi baru memakai schema.sql.

UPDATE pengajuan
SET status_pembayaran = 'menunggu'
WHERE status_pembayaran = 'belum'
  AND payment_revision = 0
  AND COALESCE(TRIM(link_bukti_bayar), '') <> '';