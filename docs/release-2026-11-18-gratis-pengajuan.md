# Release 2026-11-18 - Penandaan Pengajuan Gratis

Status: **di-commit dan di-deploy ke produksi.** Tidak ada migrasi database.

## Ringkasan
- Verifikator dapat menandai satu pengajuan sebagai **Gratis** langsung dari panel
  status di Dashboard.
- Menandai gratis berarti: status langsung **ACC**, biaya/tagihan menjadi **Rp 0**,
  `status_pembayaran` menjadi `gratis`, dan surat final (PDF ACC + email) dikirim
  otomatis tanpa menunggu validasi pembayaran.
- Biaya Rp 0 ditampilkan sebagai "Gratis" di Dashboard, Laporan, dan Detail Laporan.
- Portal mahasiswa tidak lagi meminta unggah bukti bayar untuk pengajuan gratis;
  yang tampil adalah info gratis dan tombol unduh Bukti ACC Final.

## Keputusan perilaku
- Gratis adalah keputusan status oleh verifikator, bukan koreksi biaya pascabayar,
  sehingga kontrolnya berupa checkbox di panel verifikator.
- Menandai gratis juga menetapkan biaya/tagihan menjadi 0.
- Status dikunci ke ACC; tombol Tolak/Batalkan dinonaktifkan selama gratis dicentang.
- Pengajuan dengan sumber `Manual` tetap boleh ditandai gratis, tetapi tidak
  mengirim email.
- Tombol Periksa Pembayaran tetap tampil untuk baris gratis (hanya untuk melihat).

## Perubahan kode
- `src/write/pengajuanAdmin.js`
  - `updatePengajuanStatus(db, id, newStatus, catatan, actorEmail, ctx, gratis)`:
    parameter baru `gratis`.
  - Bila gratis: wajib verifikator (pelanggaran dicatat audit `DENY`); menolak bila
    status saat ini atau status sebelumnya `Ditolak`/`Dibatalkan`, atau bila
    `status_pembayaran` sudah `valid`.
  - Memaksa `status = 'ACC'`, melewati pengaturan `allowManualAcc`, menetapkan
    `settledAtApproval` dan `gratisAtApproval`, menulis biaya 0 melalui
    `upsertBiayaCheckData`, dan menetapkan `status_pembayaran = 'gratis'`.
  - Catatan riwayat memakai `catatan` bila diisi, selain itu `Gratis`; audit action
    `GRATIS`.
  - Surat final dibuat saat itu juga (`autoFinal`) lalu email final dikirim kecuali
    sumber `Manual`.
- `src/rpc.js`: meneruskan argumen `gratis` ke `updatePengajuanStatus`.
- `public/dashboard.html`
  - State `detail.gratis` dan `detail.gratisPrevStatus`, di-reset saat detail dimuat.
  - Checkbox "Gratis" (warna emerald) hanya untuk verifikator, dengan info
    "Langsung ACC, biaya Rp 0, dan email final dikirim tanpa validasi pembayaran."
  - `onGratisToggle()` mengunci status ke ACC saat dicentang dan mengembalikan status
    sebelumnya saat dilepas.
  - `updateStatus()` memakai dialog "Tetapkan Pengajuan Gratis" lalu memanggil RPC
    dengan `gratis = true`.
  - Aksi status cepat disembunyikan selama gratis; tombol status dinonaktifkan.
  - `canCheckPayment` mengizinkan `status_pembayaran = 'gratis'`.
  - `formatBiaya()` menampilkan "Gratis" untuk nilai <= 0 (kartu, tagihan, pilihan
    biaya).
- `src/read/common.js`: helper `formatBiaya(num)` (nilai <= 0 menjadi `Gratis`).
- `src/read/dashboard.js` dan `src/read/laporan.js`: kolom `Biaya Rupiah` memakai
  `formatBiaya`.
- `public/detail-laporan.html`: `fmtBiaya` untuk tampilan tagihan/pembayaran.
- `src/portal.js`
  - `uploadBuktiFiles` menolak unggahan bila `status_pembayaran = 'gratis'`
    ("Pengajuan ini gratis, tidak perlu mengunggah bukti bayar.").
  - Data portal mengekspos flag `gratis` per pengajuan.
- `public/portal.html`
  - Kotak upload bukti disembunyikan untuk pengajuan gratis dan diganti info
    "Pengajuan ini gratis (Rp 0). Tidak perlu unggah bukti bayar."
  - Step validasi akhir menampilkan tombol unduh Bukti ACC Final karena `link_final`
    sudah terisi otomatis.
  - Banner reset unggahan tidak tampil untuk pengajuan gratis.

## Alur verifikator
1. Buka detail pengajuan di Dashboard, centang **Gratis**.
2. Status otomatis menjadi ACC dan biaya menjadi Rp 0.
3. Klik **Perbarui Status**; konfirmasi "Tetapkan Pengajuan Gratis".
4. Sistem menyimpan ACC + biaya 0 + `status_pembayaran = gratis`, membuat surat
   final, dan mengirim email final (kecuali sumber Manual).
5. Mahasiswa melihat status ACC, info gratis, dan tautan Bukti ACC Final di portal.

## Verifikasi
- `npx vitest run`: 119 file / 1071 test lulus.
- `npm run csp:check`: CSP sinkron.
- Cakupan tes baru: penandaan gratis (biaya 0, status gratis, surat final, email),
  penolakan non-verifikator, penolakan bila pembayaran sudah valid, penolakan dari
  status Ditolak, sumber Manual tanpa email, opsi "Gratis (Rp 0)", label biaya, dan
  penolakan unggah bukti di portal untuk pengajuan gratis.

## Catatan
- Kolom `payment_gate_exempt` (migrasi `2026-11-16-payment-gate-exempt.sql`) masih
  belum diterapkan di produksi dan tidak dibutuhkan oleh fitur ini, karena
  `status_pembayaran = 'gratis'` sudah lolos gerbang pembayaran.
- Pengajuan gratis yang sudah punya `link_final` tidak memicu pembuatan surat baru.
