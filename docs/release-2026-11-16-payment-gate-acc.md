# Release 2026-11-16 - Gerbang Pembayaran ACC dan Email Final

Status: **sudah di-commit, belum di-deploy.** Migrasi produksi belum dijalankan.

## Ringkasan
- Pengajuan yang baru di-ACC tidak lagi langsung mengirim PDF/email final.
- Mahasiswa wajib upload bukti bayar; admin memverifikasi hingga `valid`.
- Email final dikirim otomatis saat pembayaran divalidasi, bukan saat ACC.
- Dashboard staf Bagian hanya menampilkan ACC yang pembayarannya sudah lolos.
- Pengajuan ACC lama tidak diperiksa ulang dan tetap tampil di Bagian.

## Perubahan kode
- `src/paymentGate.js`: aturan `paymentGatePassed`.
  - Lolos bila status ACC dan `status_pembayaran` bernilai `valid`/`gratis`.
  - Lolos bila `payment_gate_exempt = 1` atau `link_final` sudah terisi (data lama).
- `src/write/pengajuanAdmin.js`: transisi ACC tidak lagi mengirim email final.
- `src/write/pembayaran.js`: verifikasi valid mengirim email final otomatis bila `link_final` masih kosong.
- `src/write/email.js`:
  - Kirim manual dan kirim massal hanya untuk pengajuan yang lolos gerbang.
  - Bulk melewati ACC yang pembayarannya belum valid.
  - `sendFinalPdfEmails` mengembalikan `ok: false` bila bridge email gagal.
- `src/read/bagian.js` dan `public/bagian-state.js`: baris membawa `eligiblePembayaran`; grup, pool edit jadwal, dan kandidat BA menyaring peserta yang belum lolos.
- `src/read/dashboard.js` dan `src/read/laporan.js`: baris admin membawa `Email Final Diizinkan`.
- `public/dashboard.html`: tombol kirim ulang email final hanya muncul untuk pengajuan yang lolos; ada catatan amber bila pembayaran belum valid.
- `schema.sql` dan `migrations/2026-11-16-payment-gate-exempt.sql`: kolom `payment_gate_exempt`.

## Alur admin
1. Admin menetapkan ACC. Status berubah dan nomor surat terbit, tetapi PDF/email final belum dikirim.
2. Mahasiswa upload bukti bayar; status pembayaran menjadi `menunggu`.
3. Admin membuka Laporan Detail > Data Pembayaran > Antrean Verifikasi > Periksa, lalu Validasi.
4. Saat valid, sistem menyimpan revisi/audit dan mengirim PDF final ke mahasiswa serta email ke Bagian.
5. Bila email gagal, pembayaran tetap valid; admin dapat mengirim ulang dari kartu Email ACC Final.
6. Pengajuan baru muncul di dashboard staf Bagian setelah pembayaran valid/gratis.

## Data lama
- Migrasi menandai seluruh pengajuan berstatus ACC saat cutover dengan `payment_gate_exempt = 1`.
- Baris tersebut tetap tampil di Bagian dan tetap bisa dikirimi ulang email tanpa verifikasi ulang.
- ACC baru memakai nilai default 0 sehingga wajib valid/gratis.

## Urutan deploy yang direncanakan (belum dijalankan)
1. Terapkan `migrations/2026-11-16-payment-gate-exempt.sql` ke D1 produksi.
2. Deploy Worker baru.
3. Verifikasi `/bagian`, Data Pembayaran, dan pengiriman email final.

## Catatan
- Koreksi `buka_kembali` mengembalikan pembayaran ke `menunggu`, tetapi `link_final` lama tidak dihapus. Akibatnya pengajuan masih dianggap lolos selama `link_final` terisi. Perlu keputusan bila perilaku ini ingin diubah.
- Dialog konfirmasi ACC di `public/dashboard.html` masih menyebut PDF final dikirim saat ACC; teks ini perlu diperbarui pada perubahan berikutnya.
- Tab Bagian di dashboard admin tidak difilter; filter pembayaran berlaku di halaman staf `/bagian`.

## Verifikasi
- `npx vitest run`: 116 file / 1013 test lulus.
- `npm run csp:check`: CSP sinkron.
- `npm run migrations:check`: 31 file migrasi valid.
