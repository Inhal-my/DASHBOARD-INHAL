# Desain: Tab "Berita Acara Bagian" di Dashboard + Pemisahan Sheet BA

Tanggal: 2026-08-21
Status: Disetujui user (21 Agu 2026)

## Latar Belakang

Terdapat dua jenis Berita Acara (BA) dengan fungsi berbeda:

1. **BA Bagian** (`Sumber='Bagian'`) — diisi bagian melalui panel bagian (`bagian.html`), berfungsi melengkapi proses. Datanya tampil di dashboard (tab "Laporan Bagian") dan di `detail-laporan.html` (matriks kegiatan + tab BA).
2. **BA Dashboard / Admin** (`Sumber='Admin'`) — diisi admin melalui tab "Berita Acara" di dashboard, berfungsi sebagai dokumen pendukung keputusan Diterima/Ditolak.

Kedua jenis saat ini tersimpan di sheet yang sama (`BeritaAcara` + `BeritaAcaraPeserta`), dibedakan hanya lewat kolom `Sumber`.

### Masalah

- Ketika staff bagian tidak hadir dan BA bagian urgent, admin tidak punya cara mengisi BA bagian dari dashboard:
  - Upload lewat tab "Berita Acara" dashboard menghasilkan `Sumber='Admin'` → tidak tampil di Laporan Bagian maupun detail-laporan, dan tidak tervalidasi aturan bagian.
- User menginginkan pemisahan **fisik** sheet antara BA bagian dan BA dashboard agar isian tidak tercampur.

## Solusi

### 1. Pemisahan Sheet (skema)

| Sheet | Isi |
|---|---|
| `BeritaAcara` (lama) | Hanya BA bagian (`Sumber='Bagian'`) |
| `BeritaAcaraPeserta` (lama) | Peserta BA bagian |
| `BeritaAcaraAdmin` (baru) | Hanya BA dashboard (`Sumber='Admin'`) |
| `BeritaAcaraAdminPeserta` (baru) | Peserta BA dashboard |

- Header `BeritaAcaraAdmin` identik dengan `BeritaAcara`; `BeritaAcaraAdminPeserta` identik dengan `BeritaAcaraPeserta` (termasuk kolom `Sumber`).
- Tambah 2 entri baru di `SCHEMAS` (`0_code.gs`) sehingga dibuat otomatis oleh `setupDatabase()`.

### 2. Migrasi Data Lama

Fungsi `migrateBeritaAcaraSheets()` (idempotent, dipanggil di dalam `setupDatabase()`):

- Untuk setiap baris di `BeritaAcara` dengan `Sumber` berisi `'admin'` (case-insensitive):
  - Salin baris ke `BeritaAcaraAdmin`.
  - Salin baris peserta dengan `BA ID` yang sama dari `BeritaAcaraPeserta` ke `BeritaAcaraAdminPeserta`.
  - Hapus baris asli dari `BeritaAcara` dan `BeritaAcaraPeserta`.
- Idempotent: baris di `BeritaAcara` yang `Sumber='Admin'` hanya ada jika migrasi belum pernah berjalan.

### 3. Server — Fungsi Baru

`adminBagianBypass(kategori, subBagian)` di `1_business.gs`:

- Verifikasi token admin: `requireAuthorized(arguments[arguments.length - 1])`.
- Validasi `kategori` ∈ `['SGD', 'KKD', 'Ujian', 'Praktikum']`.
- Jika `kategori === 'Praktikum'`, `subBagian` (lab) wajib ada.
- Buat sesi bagian: `createSession({ role: 'bagian', nama: <nama admin>, kategori, subBagian, kategoris: [kategori] })`.
- Return `{ ok: true, token, kategori, subBagian, nama }`.
- Semua RPC bagian yang sudah ada (`getBagianBootstrap`, `getBeritaAcaraList`, `uploadBeritaAcaraBagian`) terpakai ulang tanpa diubah karena hanya membutuhkan token sesi bagian sebagai argumen terakhir.

### 4. Server — Perubahan Fungsi Existing (untuk pemisahan sheet)

- `uploadBeritaAcaraAdmin` → tulis ke `BeritaAcaraAdmin` + `BeritaAcaraAdminPeserta`.
- `getBeritaAcaraAdminList` → baca `BeritaAcaraAdmin` + `_getBaPesertaMapAdmin()`.
- `deleteBeritaAcaraAdmin` → baca/hapus dari `BeritaAcaraAdmin` + `BeritaAcaraAdminPeserta`.
- Helper baru `_getBaPesertaMapAdmin()` (salinan `_getBaPesertaMap` untuk sheet admin).
- Fungsi bagian & laporan TIDAK berubah: `uploadBeritaAcaraBagian`, `getBeritaAcaraList`, `getBagianBootstrap`, `_computeBaList`, `_computeBagianAggregation`, `getLaporanBootstrap`, `getDashboardStats`/`_computeDashboardStats` tetap membaca `BeritaAcara`/`BeritaAcaraPeserta`. Filter `_baSumber === 'Bagian'` yang ada tetap aman (selalu lolos setelah migrasi).
- `generateBaId(baSheet)` dipanggil dengan sheet yang sesuai (admin memakai sheet admin) — BA ID unik per sheet.

### 5. Client — Tab Baru di `dashboard.html`

- **Nav**: tambah item `{ key: 'baBagian', icon: 'bi-journal-check', label: 'Berita Acara Bagian' }` tepat setelah item `bagian` (Laporan Bagian). Tambah ke map `pageTitle`.
- **Section** `<section v-if="tab==='baBagian'">` diletakkan tepat setelah section Laporan Bagian. Tiga tahap:
  1. **Pilih Bagian**: select kategori (SGD/KKD/Ujian/Praktikum); jika Praktikum, select lab (`config.labOptions`). Tombol "Mulai Sesi Bagian" → `adminBagianBypass(kategori, subBagian)` via `run()` (token admin otomatis dilampirkan sebagai arg terakhir).
  2. **Panel kegiatan**: replika inti `bagian.html` — daftar kegiatan per blok (statusCounts, blokir `finalOnly`), filter blok, tombol "Unggah Berita Acara" membuka modal picker (pilih kegiatan → centang peserta → tanggal → file → konfirmasi) → `uploadBeritaAcaraBagian(payload, kategori)`.
  3. **Daftar BA** bagian untuk sesi tsb (`getBeritaAcaraList(subBagian || kategori, kategori)`), menampilkan file + peserta, refresh setelah upload.
- **Sesi aktif**: header `Kategori / Sub — sebagai {nama admin}` + tombol "Akhiri Sesi" (`logoutSession` token bagian). Token sesi bagian disimpan **di memori** (`data.bab.token`), bukan localStorage.
- **runAsBab()**: varian `run()` yang melampirkan token sesi bagian sebagai arg terakhir.
- Saat admin logout (`logout()`), token sesi bagian ikut dihancurkan.
- Tanpa delete BA bagian (konsisten dengan panel bagian; fungsi hapus BA bagian memang tidak ada).

### 6. Jaminan Pemisahan

- BA dari tab baru selalu `Sumber='Bagian'` → hanya masuk sheet `BeritaAcara`.
- BA dashboard selalu `Sumber='Admin'` → hanya masuk sheet `BeritaAcaraAdmin`.
- detail-laporan & Laporan Bagian hanya membaca sheet bagian.

## Di Luar Lingkup

- Tidak menambah kolom `Diisi Oleh` (penanda pengganti); audit cukup lewat nama aktor pada sesi bagian.
- Tidak mengubah `bagian.html`.
- Tidak menambah fungsi hapus BA bagian.
- Tidak mengubah BA ID format.

## Komponen Terkait

- `0_code.gs`: `SCHEMAS` (+2 entri), `setupDatabase` (panggil `migrateBeritaAcaraSheets`), `migrateBeritaAcaraSheets()` (baru).
- `1_business.gs`: `adminBagianBypass` (baru), `_getBaPesertaMapAdmin` (baru), `uploadBeritaAcaraAdmin`, `getBeritaAcaraAdminList`, `deleteBeritaAcaraAdmin`.
- `pages/dashboard.html`: nav, section baru, `runAsBab`, computed/methods untuk alur bagian, `logout` diperbarui.

## Pengujian

- Sintaks: verifikasi `.gs` via `node --check` pada salinan `.js`; verifikasi JS inline halaman via ekstraksi + `node --check` (metode yang sudah dipakai).
- Manual setelah deploy:
  - Jalankan `setupDatabase()` → sheet `BeritaAcaraAdmin`/`BeritaAcaraAdminPeserta` dibuat; baris `Sumber='Admin'` di `BeritaAcara` dipindah.
  - Login dashboard → tab "Berita Acara Bagian" → pilih kategori → "Mulai Sesi Bagian" → upload BA → verifikasi masuk sheet `BeritaAcara` dengan `Sumber='Bagian'` dan tampil di detail-laporan.
  - Upload BA dashboard (tab "Berita Acara") → verifikasi masuk sheet `BeritaAcaraAdmin`, tidak tampil di detail-laporan.
