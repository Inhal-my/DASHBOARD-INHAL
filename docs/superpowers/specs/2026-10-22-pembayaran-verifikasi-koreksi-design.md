# Desain Verifikasi Pembayaran dan Koreksi

Tanggal: 22 Oktober 2026
Status: diimplementasikan; pembayaran dipisahkan dari ACC Final/BA 22 Oktober 2026
Mockup acuan: `mockups/pembayaran-verifikasi/` revisi 3.2

## Tujuan

Menambahkan status verifikasi pembayaran per pengajuan, alur validasi, dan alur koreksi yang tercatat. Empat tampilan mockup (tabel, antrean, papan status, ringkasan) diimplementasikan di tab Data Pembayaran.

## Keputusan yang sudah disetujui

1. Tombol `Valid` langsung menyimpan, tanpa dialog konfirmasi tambahan.
2. Dua mode koreksi:
   - Koreksi administratif: tanggal, metode, catatan. Status tetap `valid`.
   - Buka kembali: nominal, bukti, atau kesesuaian bermasalah. Status kembali `menunggu`.
3. Semua admin Keuangan boleh memvalidasi dan mengoreksi. Alasan koreksi wajib. Pelaku dan waktu dicatat.
4. Tidak ada aturan SLA/hari. Semua penanda usia dihapus.
5. Status pembayaran tidak bergantung pada ACC Final/BA. Semua baris dapat diperiksa, divalidasi, dan dikoreksi sesuai status pembayarannya.
6. Implementasi tahap pertama mencakup keempat tampilan: tabel, antrean, papan status, ringkasan.
7. Tidak ada email pemberitahuan verifikasi/koreksi.
8. Tidak ada status Ditolak dan tidak ada tombol Batalkan verifikasi.

## Status dan aturan transisi

Status pembayaran disimpan per `pengajuan`:

- `belum`: belum ada bukti bayar.
- `menunggu`: bukti ada, menunggu validasi.
- `valid`: sudah divalidasi.
- `gratis`: tagihan nol.

Transisi:

- Tanpa bukti -> `belum`.
- Unggah bukti (peserta atau admin) -> `menunggu`.
- `menunggu` + Valid -> `valid`.
- `valid` + koreksi administratif -> tetap `valid`, revisi bertambah.
- `valid` + buka kembali -> `menunggu`, revisi bertambah.
- Reset unggah -> `belum`, hanya boleh jika belum `valid`.
- Tagihan nol -> `gratis`, tidak bisa diverifikasi.

Kesesuaian wajib cocok dengan nominal:

- `nominal = tagihan` -> `pas`
- `nominal < tagihan` -> `kurang`
- `nominal > tagihan` -> `lebih`

Jika pilihan tidak cocok, server menolak. Nilai `kurang`/`lebih` tetap boleh berstatus `valid` sebagai keputusan admin.

## Pemisahan dari ACC Final/BA

Modul pembayaran tidak memakai flag ACC Final/BA sebagai syarat atau penanda:

- `link_final` dan `masukBa` tetap dipakai di modul laporan/BA, bukan di tab Data Pembayaran;
- tidak ada badge atau catatan `Final/BA` di kolom status maupun Ringkasan;
- semua baris `menunggu` masuk Antrean Verifikasi;
- semua baris dapat divalidasi dan dikoreksi sesuai aturan status pembayaran;
- server tidak menolak verifikasi/koreksi hanya karena baris sudah final atau masuk BA.

## Model data

Kolom baru pada `pengajuan`:

- `status_pembayaran TEXT NOT NULL DEFAULT 'belum'`
- `kesesuaian_pembayaran TEXT` (`kurang`/`lebih`/`pas`)
- `nominal_dibayar INTEGER` (rupiah, tanpa desimal)
- `tanggal_bayar TEXT`
- `metode_bayar TEXT`
- `catatan_verifikasi TEXT`
- `verified_at TEXT`
- `verified_by TEXT`
- `payment_revision INTEGER NOT NULL DEFAULT 0`

Tabel baru `pembayaran_revisi` (append-only):

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `id_pengajuan TEXT NOT NULL`
- `revision INTEGER NOT NULL`
- `mode TEXT NOT NULL` (`verifikasi`, `administratif`, `buka_kembali`)
- `status_lama TEXT`, `status_baru TEXT`
- `kesesuaian_lama TEXT`, `kesesuaian_baru TEXT`
- `nominal_lama INTEGER`, `nominal_baru INTEGER`
- `tanggal_lama TEXT`, `tanggal_baru TEXT`
- `metode_lama TEXT`, `metode_baru TEXT`
- `alasan TEXT`
- `catatan TEXT`
- `actor TEXT`
- `created_at TEXT`
- `before_json TEXT`, `after_json TEXT`

Index: `idx_pembayaran_revisi_pengajuan (id_pengajuan, revision)`.

Tidak ada penghapusan baris revisi. Data lama tetap ada.

## Backfill migrasi

Untuk database lama:

- `status_pembayaran = 'gratis'` jika `biaya <= 0`.
- `status_pembayaran = 'menunggu'` jika `link_bukti_bayar` tidak kosong.
- selain itu `'belum'`.
- `nominal_dibayar` dibiarkan `NULL` sampai admin memvalidasi.
- `payment_revision = 0`.

## API/RPC

Modul baru `src/write/pembayaran.js`, didaftarkan di `src/rpc.js`.

`verifyPembayaran(payload)`:

- payload: `idPengajuan`, `nominal`, `tanggal`, `metode`, `kesesuaian`, `catatan`, `expectedRevision`.
- syarat: admin, status `menunggu`, bukti ada, nominal > 0.
- validasi kesesuaian terhadap nominal.
- transaksi: update `pengajuan`, insert `pembayaran_revisi` mode `verifikasi`, tulis audit log.
- hasil: status `valid`, revisi + 1.

`correctPembayaran(payload)`:

- payload: `idPengajuan`, `mode`, `alasan`, `expectedRevision`, plus field sesuai mode.
- syarat: admin, status `valid`, alasan minimal 5 karakter.
- `administratif`: hanya `tanggal`, `metode`, `catatan_verifikasi` yang boleh berubah; status tetap valid.
- `buka_kembali`: status menjadi `menunggu`; `verified_at`/`verified_by` dikosongkan; nominal/tanggal/metode tidak diubah di langkah ini.
- transaksi: update + revisi + audit.
- konflik revisi: tolak dengan pesan "Data sudah diubah admin lain. Muat ulang."

Pengaman pada alur lama:

- unggah bukti peserta: tolak jika status pembayaran `valid`.
- unggah bukti admin: tolak jika `valid`; arahkan ke koreksi buka kembali.
- reset unggah: tolak jika `valid`.
- perubahan `biaya` yang membuat tagihan nol: status menjadi `gratis`.

## Read model

`getLaporanBootstrap` mengembalikan:

- kolom pembayaran baru per pengajuan;
- `pembayaranRevisi` (semua revisi, dikelompokkan per `id_pengajuan`);
- `linkFinal` dan `masukBa` tetap tersedia untuk modul laporan/BA, tidak dipakai untuk membatasi modul pembayaran.

Kolom baru ditambahkan ke `src/read/columns.js`.

## UI

Tab Data Pembayaran memakai segmented control dengan empat tampilan:

1. `Tabel` — tabel datar per pengajuan, mengikuti mockup 01:
   - chip: Aktif, Menunggu, Belum, Gratis, Valid, Semua;
   - filter "Hanya bermasalah";
   - kolom: Peserta, Detail Kegiatan, Tagihan, Dibayar, Status, Bukti, Aksi;
   - panel kanan untuk Periksa/Valid/Koreksi dan riwayat revisi.
2. `Antrean` — daftar `menunggu` di kiri, detail dan keputusan di kanan.
3. `Papan` — empat kolom: Belum Bayar, Menunggu, Valid, Gratis.
4. `Ringkasan` — kartu angka, nilai per status, rekap status, daftar selisih nominal, perlu perhatian, ekspor.

Perilaku tabel:

- Semua baris tampil dan dapat diperiksa tanpa memandang ACC Final/BA.
- Baris `valid` yang baru divalidasi tetap tampil sampai muat ulang (state sesi), setelah itu hanya lewat chip Valid.
- `gratis` tetap tampil.
- `belum` tidak punya tombol Valid.
- Tombol `Koreksi` hanya ada pada baris valid.
- Tidak ada tombol edit langsung pada baris valid.

Panel koreksi:

- Mode administratif: form tanggal/metode/catatan + alasan wajib.
- Mode buka kembali: konfirmasi + alasan wajib.
- Riwayat menampilkan semua revisi: waktu, pelaku, mode, alasan, perubahan.

Ringkasan:

- Tabel `Selisih nominal` memuat semua baris valid yang selisih;
- Daftar perlu perhatian memakai status dan masalah bukti, tanpa penanda hari.
- Tidak ada catatan atau angka terpisah untuk ACC Final/BA.

## Ekspor

- Ekspor mengikuti data yang tampil di tab Pembayaran.
- Tambah kolom: Status Pembayaran, Kesesuaian, Nominal Dibayar, Tanggal Bayar, Metode Bayar, Diverifikasi Oleh, Diverifikasi Pada, Revisi.
- Ringkasan menghitung seluruh baris pembayaran tanpa pemisahan final/BA.

## Pengujian

Unit/integration:

- validasi status dan kesesuaian nominal;
- verifikasi sukses pada baris yang sudah ACC Final atau masuk BA;
- koreksi administratif tetap valid;
- buka kembali mengembalikan ke menunggu;
- alasan wajib dan permission admin;
- konflik revisi;
- unggah/reset setelah valid ditolak;
- backfill dan read model.

Template/UI:

- keempat tampilan ada;
- semua baris dapat diperiksa, divalidasi, dan dikoreksi;
- chip dan panel koreksi;
- ekspor memuat kolom baru.

E2E staging:

- unggah bukti -> menunggu -> valid;
- koreksi administratif;
- buka kembali -> valid ulang;
- baris dengan link final/BA tetap bisa divalidasi dan dikoreksi.

## Rollout

1. Migrasi staging + deploy staging.
2. Uji staging dan UAT.
3. Migrasi produksi + deploy produksi setelah persetujuan.
4. Tidak ada perubahan pada data BA/ACC.

## Di luar cakupan

- OCR otomatis.
- Email/notifikasi verifikasi atau koreksi.
- Persetujuan atasan.
- Perubahan aturan BA/ACC.
- Penghapusan permanen data pembayaran.
