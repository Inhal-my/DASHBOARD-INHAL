-- Tandai pengajuan yang sudah ACC sebelum aturan gerbang pembayaran berlaku.
-- Baris ini tidak perlu diverifikasi ulang agar tetap bisa tampil di Bagian dan
-- menerima email final. Pengajuan ACC baru memakai nilai default 0 dan wajib
-- memiliki status_pembayaran valid/gratis.
-- Jalankan sekali pada database lama. Instalasi baru memakai schema.sql.

ALTER TABLE pengajuan ADD COLUMN payment_gate_exempt INTEGER NOT NULL DEFAULT 0;

UPDATE pengajuan
SET payment_gate_exempt = 1
WHERE status = 'ACC';
