# UAT dan Pemeriksaan Rilis INHAL

Terakhir diperbarui: 2026-10-21

Dokumen ini dipakai untuk UAT Poin 7: matriks pengujian per peran, pemeriksaan
aksesibilitas, bukti, dan kriteria lulus sebelum rilis produksi.

## Lingkungan

| Item | Nilai |
|---|---|
| Aplikasi | `new-code1-cf` (Cloudflare Workers + D1) |
| Staging | https://inhal-form-staging.prodi.workers.dev |
| Produksi | https://inhal-form.prodi.workers.dev |
| Data uji | Sintetis dari `schema.sql` di staging |
| Akun admin | `Staging Admin` (password dari secret `STAGING_ADMIN_PASSWORD`) |

Aturan keselamatan:

- Uji yang menulis, menghapus, atau mengubah data hanya di staging.
- Produksi hanya untuk smoke read-only: `/api/health`, halaman utama, login, dan
  pembacaan daftar.
- Jangan memakai data mahasiswa asli di staging.
- Setiap temuan dicatat dengan ID kasus, langkah reproduksi, dan bukti tangkapan layar.

## Peran

| Peran | Akun | Cakupan |
|---|---|---|
| Mahasiswa | NPM pada data staging | Portal, pendaftaran, unggah berkas |
| Admin | `Staging Admin` + MFA (bila aktif) | Verifikasi, BA, master, audit, ekspor |
| Bagian | Akun bagian staging | Workspace bagian, jadwal, BA Pelaksanaan |
| Operator/IT | Akses Cloudflare/GitHub | Deploy, migrasi, backup, observability |

## Catatan Sesi 2026-10-21

- Lingkungan: staging.
- Penguji: petugas Bagian KKD dan mahasiswa NPM `1908260051`.
- Lulus: M01-M05, M07, A01-A03, A05, A07-A12, B01-B05.
- Temuan: A04 (status peserta BA/jadwal tidak ikut berubah saat pengajuan
  ditolak), M06 dan A06 (perlu detail error; dugaan konfigurasi Drive staging).
- A04 sudah diperbaiki di commit `e165892` dan ter-deploy ke staging (run
  `39564633105`). Status tetap `[!]` sampai retest lulus.

## Matriks UAT

Status: `[ ]` belum, `[x]` lulus, `[!]` gagal. Isi kolom Bukti dengan nama file atau
tautan tiket.

### Mahasiswa

| ID | Skenario | Langkah | Hasil yang diharapkan | Bukti | Status |
|---|---|---|---|---|---|
| UAT-M01 | Buka portal | Buka `/` | Judul "Pengajuan INHAL", input NPM tampil, tanpa error konsol | Sesi UAT staging 2026-10-21 | [x] |
| UAT-M02 | NPM tidak terdaftar | Isi NPM `0000000000`, klik Periksa | Pesan "tidak ditemukan/periksa kembali" muncul, tidak ada data bocor | Sesi UAT staging 2026-10-21 | [x] |
| UAT-M03 | Masuk dengan NPM valid | Isi NPM data staging, klik Periksa | Kartu status dan riwayat pengajuan tampil | Sesi UAT staging 2026-10-21 | [x] |
| UAT-M04 | Validasi form kosong | Buka form pendaftaran, klik Kirim tanpa mengisi | Pesan kesalahan jelas di layar, fokus tetap di form, tidak ada `alert()` | Sesi UAT staging 2026-10-21 | [x] |
| UAT-M05 | Kirim pendaftaran | Isi NPM, nama, email, HP, blok, dan jenis kegiatan yang valid | Pengajuan tersimpan, ID pengajuan tampil, status awal benar | Sesi UAT staging 2026-10-21 | [x] |
| UAT-M06 | Unggah ACC/bukti | Setelah status ACC, unggah PDF/JPG/PNG sesuai batas | Berkas tersimpan, status dan tautan berubah, ukuran salah ditolak | Gagal; perlu detail error. Cek konfigurasi Drive staging dan status ACC | [!] |
| UAT-M07 | NPM salah format | Isi NPM dengan huruf/spasi | Pesan validasi, tidak ada permintaan jaringan yang mengubah data | Sesi UAT staging 2026-10-21 | [x] |

### Admin

| ID | Skenario | Langkah | Hasil yang diharapkan | Bukti | Status |
|---|---|---|---|---|---|
| UAT-A01 | Login kosong/salah | Buka `/dashboard`, klik Masuk tanpa password; ulangi dengan password salah | Pesan kesalahan diumumkan (`role="alert"`), tidak masuk | Sesi UAT staging 2026-10-21 | [x] |
| UAT-A02 | Login + MFA | Masukkan password dan kode autentikator/recovery yang valid | Sidebar tampil, sesi berlaku, MFA tidak diminta ulang | Sesi UAT staging 2026-10-21 | [x] |
| UAT-A03 | Verifikasi pengajuan | Buka tab Pengajuan, cari dan filter data | Daftar, status, dan detail sesuai data staging | Sesi UAT staging 2026-10-21 | [x] |
| UAT-A04 | ACC/tolak/batal | Proses satu pengajuan sampai ACC, lalu tolak/batalkan pengajuan lain | Status berubah, nomor surat berurutan, audit tercatat | Gagal saat sesi pertama: status peserta BA/jadwal tetap ACC. Diperbaiki di commit `e165892`, sudah deploy staging (run `39564633105`); menunggu retest | [!] |
| UAT-A05 | Input manual | Tambah pengajuan manual dengan data valid | Pengajuan muncul di daftar dan portal mahasiswa | Sesi UAT staging 2026-10-21 | [x] |
| UAT-A06 | BA Pendukung | Unggah BA, kelola peserta, regenerate PDF | Berkas dan peserta tersimpan; PDF dapat diunduh | Gagal; perlu detail error. Cek konfigurasi Drive/PDF | [!] |
| UAT-A07 | BA Pelaksanaan | Unggah BA Pelaksanaan dan pilih peserta | BA tersimpan, label benar, peserta tidak duplikat | Sesi UAT staging 2026-10-21 | [x] |
| UAT-A08 | Master data | Tambah, ubah, hapus, dan ganti nama blok | Perubahan konsisten; ganti nama blok menandai BA perlu regen | Sesi UAT staging 2026-10-21 | [x] |
| UAT-A09 | Audit integritas | Buka Master Data > Audit | Ringkasan master dan kualitas data tampil; tombol ulangi berfungsi | Sesi UAT staging 2026-10-21 | [x] |
| UAT-A10 | Ekspor database | Jalankan ekspor XLSX | File terunduh, sheet dan kolom sesuai, tanpa data sensitif | Sesi UAT staging 2026-10-21 | [x] |
| UAT-A11 | Keamanan akun | Buka modal Keamanan, aktifkan/nonaktifkan MFA | Perubahan tersimpan dan login berikutnya mengikuti status MFA | Sesi UAT staging 2026-10-21 | [x] |
| UAT-A12 | Logout | Klik Keluar | Kembali ke layar login, sesi tidak dapat dipakai lagi | Sesi UAT staging 2026-10-21 | [x] |

### Bagian

| ID | Skenario | Langkah | Hasil yang diharapkan | Bukti | Status |
|---|---|---|---|---|---|
| UAT-B01 | Login bagian | Pilih kategori (dan lab untuk Praktikum), masukkan password | Workspace bagian tampil sesuai kategori | Sesi UAT staging 2026-10-21 | [x] |
| UAT-B02 | Data terbatas | Buka ringkasan dan daftar kegiatan | Hanya data bagian sendiri yang tampil | Sesi UAT staging 2026-10-21 | [x] |
| UAT-B03 | Jadwal | Tambah dan ubah jadwal pada kegiatan tanpa BA | Jadwal tersimpan; duplikat identik tidak ditampilkan dua kali | Sesi UAT staging 2026-10-21 | [x] |
| UAT-B04 | BA Pelaksanaan | Unggah BA dan pilih peserta yang belum punya BA | BA tersimpan, sisa peserta berkurang, PDF dapat diunduh | Sesi UAT staging 2026-10-21 | [x] |
| UAT-B05 | Akses lintas bagian | Coba akses ID kegiatan/BA bagian lain melalui permintaan langsung | Ditolak dengan pesan kewenangan, tidak ada data terkirim | Sesi UAT staging 2026-10-21 | [x] |

### Operator/IT

| ID | Skenario | Langkah | Hasil yang diharapkan | Bukti | Status |
|---|---|---|---|---|---|
| UAT-O01 | Health check | `GET /api/health` di staging dan produksi | 200 `{ ok: true, db: "ok" }`, `cache-control: no-store` | | [ ] |
| UAT-O02 | CI dan deploy | Push ke `main`, tunggu CI lalu Deploy Staging | CI lulus, staging ter-deploy, smoke `/api/health` lulus | | [ ] |
| UAT-O03 | Migrasi | Terapkan migrasi tertunda di staging, lalu produksi setelah backup | Migrasi tercatat di `d1_migrations`, aplikasi tetap sehat | | [ ] |
| UAT-O04 | Backup | Jalankan ekspor D1 sesuai `docs/ops/backup-restore.md` | Dump tersimpan, `scripts/verify-backup.mjs` melaporkan `ok: true` | | [ ] |
| UAT-O05 | Restore drill | Jalankan workflow **Restore Drill Staging**, lalu periksa artifact dan ringkasan run | Data inti utuh, dump diverifikasi, dan Worker sementara dapat membaca data | Actions run `39554233150`; artifact `restore-drill-evidence` | [x] |
| UAT-O06 | Observability | Periksa log Worker, Issues, dan uptime monitor | Error memiliki `requestId`; tidak ada kegagalan health berulang | | [ ] |
| UAT-O07 | Rollback | Simulasikan rollback Worker dan migrasi di staging | Worker kembali ke versi sebelumnya; prosedur tercatat | | [ ] |

### Aksesibilitas dan kualitas

| ID | Skenario | Langkah | Hasil yang diharapkan | Bukti | Status |
|---|---|---|---|---|---|
| UAT-X01 | Keyboard | Tab melalui portal, login admin, dan dialog utama | Fokus terlihat, urutan logis, semua aksi dapat dicapai | | [ ] |
| UAT-X02 | Label formulir | Periksa dengan pembaca layar (NVDA/VoiceOver) | Setiap kontrol membacakan label yang benar | | [ ] |
| UAT-X03 | Pengumuman error | Kirim form kosong dan login salah | Pesan error dibacakan otomatis, bukan hanya warna | | [ ] |
| UAT-X04 | Nama dialog | Buka detail, keamanan, audit, dan riwayat | Nama dialog dibacakan; tombol tutup memiliki label | | [ ] |
| UAT-X05 | Zoom/kontras | Zoom 200% dan mode kontras tinggi | Tidak ada teks terpotong; kontras teks utama memadai | | [ ] |
| UAT-X06 | Mobile | Uji lebar 390x844 pada portal dan dashboard | Menu, sheet, dan form dapat dipakai tanpa scroll horizontal | | [ ] |
| UAT-X07 | Reduced motion | Aktifkan prefers-reduced-motion | Animasi glow berhenti; konten tetap terbaca | | [ ] |
| UAT-P01 | Waktu muat | Buka dashboard staging dengan cache kosong | Konten utama tampil < 3 detik pada jaringan normal | | [ ] |
| UAT-P02 | Query plan | Jalankan `EXPLAIN QUERY PLAN` untuk peserta BA, status, jadwal | Memakai indeks Poin 6, bukan `SCAN` tabel penuh | | [ ] |
| UAT-P03 | Batas peserta | Simpan BA dengan lebih dari 500 peserta | Ditolak dengan pesan validasi, data lama tidak berubah | | [ ] |
| UAT-P04 | Data ganda | Buka laporan dengan jadwal duplikat identik | Hanya satu baris tampil; audit kualitas data melaporkan duplikat | | [ ] |

## Pemeriksaan aksesibilitas otomatis

- `test/accessibility.test.js` memeriksa `lang`, viewport, alt gambar, label/`for`,
  nama dialog, `role="alert"`, dan `aria-live`.
- Jalankan bersama suite: `npm test`.
- Batasan yang belum ditutup: focus trap penuh pada semua modal, tombol Escape untuk
  seluruh modal selain dialog konfirmasi, dan audit kontras otomatis. Catat sebagai
  backlog bila belum diperbaiki.

## Kriteria lulus

Rilis dinyatakan lulus bila:

1. Semua kasus UAT berstatus `[x]`, atau temuan `[!]` memiliki severity rendah,
   pemilik, dan target perbaikan yang disetujui.
2. Tidak ada temuan kritis/tinggi pada alur pendaftaran, ACC, BA, autentikasi, dan
   kewenangan bagian.
3. `npm test`, `npm run test:scripts`, `npm run csp:check`, dan
   `npm run migrations:check` lulus di CI.
4. E2E staging lulus.
5. Backup pra-rilis tersedia dan prosedur rollback sudah diuji.
6. Tidak ada error konsol baru di halaman yang diuji.

## Sign-off

| Peran | Nama | Tanggal | Hasil | Catatan |
|---|---|---|---|---|
| Admin/operator | | | | |
| Perwakilan bagian | | | | |
| Mahasiswa | | | | |
| Pemilik produk | | | | |
