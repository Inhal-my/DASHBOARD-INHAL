# Desain: Unifikasi BA Pendukung per-Peserta & Koeksistensi dengan BA Pelaksanaan

Tanggal: 2026-10-14
Status: **Diimplementasi** (lihat `docs/superpowers/plans/2026-10-14-ba-pendukung-pelaksanaan-unifikasi.md`).
Terkait:
- `docs/superpowers/specs/2026-10-12-ba-pendukung-revisi-design.md` (model per-peserta, di sini direvisi P10)
- `docs/superpowers/specs/2026-10-12-ba-pendukung-pdf-dan-pembatas-design.md`
- `docs/superpowers/specs/2026-10-12-berita-acara-per-peristiwa-design.md` (BA Pelaksanaan)
- `docs/superpowers/specs/2026-10-12-dashboard-berita-acara-proses-design.md`

> Dokumen ini murni catatan desain hasil diskusi. Tidak ada perubahan kode/DB/bridge.

---

## 1. Latar Belakang & Masalah

Ada **dua alur BA Pendukung** yang saling bertabrakan:

- **Alur A (lama)** — tombol "Unggah BA Pendukung" di tab Berita Acara (`public/dashboard.html:1015`, modal `openBaUpload()` `:4144`, `submitBaAdmin()` `:4318`) → RPC `uploadBeritaAcaraAdmin` → `saveBeritaAcaraAdmin` (`src/write/beritaAcara.js:195`). Sifatnya **satu file per kegiatan** dan **menolak upload kedua** untuk `kegiatan_key` yang sama (`beritaAcara.js:202-205`).
- **Alur B (per-peserta)** — kartu BA Pendukung di modal Detail Pengajuan (`dashboard.html:3596-3699`, RPC `baAdminGet/Create/AddPeserta/UploadBerkas/RemovePeserta/Regenerate`) → `getOrCreateBaAdmin`/`addBaAdminPesertaBulk`/`setBaAdminPesertaBerkas`/`removeBaAdminPeserta`/`regenerateBaAdminPdf` (`src/write/baAdmin.js`). Model **tiap peserta punya berkas sendiri, digabung 1 PDF per kegiatan**.

Masalah yang dilaporkan dan **telah diverifikasi**:

1. **"BA Pendukung hilang dari daftar" setelah BA Pelaksanaan diunggah.**
   Akar: penyaring duplikat `seenBa` di `getBagianAggregation` (`src/read/dashboard.js:242-252`) memakai kunci
   `norm(bagian)|blok|normKegiatan(nama)|tanggal|fileUrl` **tanpa membedakan sumber (Admin vs Bagian)**.
   Bila BA Pendukung dan BA Pelaksanaan sama `bagian/blok/nama/tanggal` dan `file_url` sama (sering dua-duanya **kosong**, mis. BA Pendukung belum di-regenerate), BA Pelaksanaan diproses lebih dulu (`berita_acara` sebelum `berita_acara_admin`, `dashboard.js:244-247`) sehingga **BA Pendukung dibuang diam-diam**.
   Dibuktikan lewat tes `test/ba-coexist.test.js` (kasus `file_url` kosong gagal; `file_url` berbeda lolos).

2. **"BA Pendukung kedua" gagal/ditolak.**
   Karena Alur A menolak `kegiatan_key` duplikat, admin tidak bisa menambah peserta/berkas ke BA kegiatan yang sudah ada dari tab BA. Padahal model yang diinginkan adalah per-peserta (Alur B).

3. **Tab Input Manual tidak memperlihatkan kegiatan yang sama.**
   `submitManual()` (`dashboard.html:3112`) → `createPengajuan` (`src/pengajuan.js:19`) selalu INSERT. Tidak ada panel untuk melihat peserta yang sudah terdaftar di kegiatan (Blok + Jenis + Detail) yang sama, sehingga admin tidak tahu bahwa harus menambah peserta ke kegiatan itu (dan mengelola BA-nya).

## 2. Tujuan

- **Satu jalur** BA Pendukung: per-peserta (Alur B) untuk semua titik masuk.
- BA Pendukung dan BA Pelaksanaan **selalu tampil berdampingan** dan **tidak pernah saling menghapus/menimpa**.
- Tab Input Manual menampilkan peserta yang sudah ada di kegiatan yang sama, dengan aksi menambah peserta ke kegiatan tersebut dan langsung mengelola BA Pendukungnya.
- **Tiap peserta yang masuk BA Pendukung wajib disertai berkas** (tidak ada BA/peserta tanpa berkas).
- Indikator kelengkapan "tiap peserta punya BA" ditampilkan.

## 3. Non-Tujuan

- Mengubah alur BA Pelaksanaan (`berita_acara`/`berita_acara_peserta`), termasuk perilaku Bagian.
- Mengubah aturan keputusan/status pengajuan, biaya, bukti bayar, ACC, dan final.
- Mengubah `submitManual`/`createPengajuan` menjadi merge (dedup `form_key` tetap).
- Tanda tangan digital/e-sign, OCR, audit BA Pendukung.
- Perubahan skema DB (pendekatan B tidak butuh migrasi baru).

## 4. Keputusan Desain (Terkunci)

| # | Keputusan |
|---|-----------|
| D1 | BA Pendukung = satu baris `berita_acara_admin` per kegiatan (`kegiatan_key`), berisi **banyak peserta**; **tiap peserta punya berkas sendiri**; PDF gabungan di-*generate* server. |
| D2 | BA Pelaksanaan tetap **1 file per kegiatan** dari Bagian, berdampingan dengan BA Pendukung. |
| D3 | Kunci dedup `seenBa` diperbaiki agar **membedakan sumber** (dan `baId`), sehingga BA Pendukung & BA Pelaksanaan tidak pernah dianggap duplikat. |
| D4 | Tombol "Unggah/Kelola BA Pendukung" (tab BA + baris unit) membuka **modal "Kelola BA Pendukung"** per kegiatan di dashboard. |
| D5 | Modal "Kelola BA Pendukung" juga menjadi tampilan di Detail Pengajuan (menggabungkan Alur B yang sudah ada). |
| D6 | Menambah peserta ke BA **wajib menyertakan berkas** (≥1 halaman JPG/PNG/PDF) dalam aksi yang sama. **Revisi atas** spec 2026-10-12 (P10 "boleh tanpa berkas") — kini dilarang. |
| D7 | Baris BA kegiatan dibuat pada saat peserta+berkas pertama berhasil disimpan (tidak ada BA kosong). |
| D8 | Alur A di-*pensiun* dari UI: `openBaUpload`/`submitBaAdmin`/`loadBaUploadOptions`/`onBaBlokChange`/`onBaDetailChange` dan RPC `uploadBeritaAcaraAdmin` tidak lagi dipanggil dari dashboard. Fungsi server `saveBeritaAcaraAdmin` dipertahankan sementara sebagai *deprecated* (tidak dipakai UI). |
| D9 | Tab Manual menampilkan panel "Kegiatan ini sudah punya N peserta" setelah Blok + Jenis + Detail (+tanggal) terisi, beserta status & indikator BA, aksi "Tambah peserta lain" dan "Kelola BA Pendukung". |
| D10 | Pencocokan "kegiatan yang sama" memakai kunci yang sama dengan `kegiatanKey` (`jenis + blok + pilihan + detail`). |
| D11 | Batas berkas: **50 halaman** dan **20 MB** per BA (mengikuti `BA_ADMIN_MAX_PAGES`/`BA_ADMIN_MAX_BYTES`, `src/write/baAdmin.js:147-148`). |
| D12 | Regenerate gagal → tandai `needs_regen=1`, `file_url` lama dipertahankan, tombol retry (sudah ada). |
| D13 | Tampilkan `pesertaDenganBa` (`src/read/dashboard.js:287`, sudah dihitung, belum dipakai) sebagai indikator "BA Pendukung x/y peserta". |

## 5. Model Konseptual

- **Kegiatan** — identitas logis `bagian + blok + nama kegiatan` (`kegiatanKey`, `src/read/common.js:16`).
- **BA Pendukung** — satu baris `berita_acara_admin` per kegiatan; `file_url` = PDF gabungan.
- **Peserta BA** — baris `berita_acara_admin_peserta` (`active=1`), punya `urutan`.
- **Berkas peserta** — baris `berita_acara_admin_berkas` (`active=1`), `page_index` 0..n; `active=0` = riwayat.
- **BA Pelaksanaan** — baris `berita_acara` per kegiatan (Bagian) + `berita_acara_peserta`.
- Di unit agregasi, BA Pendukung (`sumber='Admin'`) dan BA Pelaksanaan (`sumber='Bagian'`) disimpan bersama di `unit.ba` tetapi dipisah oleh `unit.baPendukung` / `unit.baPelaksanaan` (`dashboard.js:291-292`).

## 6. Perubahan Backend (Worker)

### 6.1 Perbaikan inti (dedup)
`src/read/dashboard.js:248` — ubah kunci duplikat:
```
dk = norm(bagian)|blok|normKegiatan(nama)|tanggal|fileUrl   // SEBELUM
dk = sumber|bagian|blok|normKegiatan(nama)|tanggal|fileUrl  // SESUDAH (+ sumber)
```
(Cukup tambahkan `sumber`; `baId` opsional sebagai pengaman.) Tujuan: BA Pendukung & BA Pelaksanaan tidak pernah terdedup.

### 6.2 Aksi tulis peserta + berkas (wajib berkas)
`src/write/baAdmin.js` — tambah fungsi `addBaAdminPesertaWithBerkas(db, kegiatan, idPengajuan, images, ctx)`:
1. `getOrCreateBaAdmin` untuk kegiatan (membuat BA bila belum ada).
2. Validasi berkas (JPG/PNG/PDF, batas halaman/ukuran).
3. Unggah semua halaman ke Drive; baru sentuh D1 (semua-sukses-baru-tulis).
4. Tambah peserta aktif (atau re-aktifkan) + berkas aktif.
5. `regenerateBaAdminPdf`.

Bila berkas kosong → **tolak** dengan pesan jelas (D6).

### 6.3 RPC
`src/rpc.js` — tambah `baAdminAddPesertaBerkas: (db,args,ctx) => addBaAdminPesertaWithBerkas(db, args[0], args[1], args[2], ctx)`.
`baAdminGet/Create/AddPeserta/UploadBerkas/RemovePeserta/Regenerate` dipertahankan.
`uploadBeritaAcaraAdmin` **tidak dihapus** (deprecated), tetapi tidak ada pemanggil di UI.

### 6.4 Agregasi
- Perbaikan dedup (6.1).
- Pastikan `u.pesertaDenganBa` tetap dihitung dan terekspos ke klien (sudah).

## 7. Perubahan Frontend (dashboard.html)

### 7.1 Modal "Kelola BA Pendukung" (D4, D5, D6, D7)
Panel/modal per kegiatan, dibuka dari:
- baris unit tab BA (tombol "Unggah Pendukung"/"Kelola Pendukung" pada `dashboard.html:1183,1266`), dan
- kartu BA Pendukung di Detail Pengajuan (`dashboard.html:3596`), serta
- panel "kegiatan yang sama" di tab Manual (7.3).

Sumber data: `baAdminGet` dengan `idPengajuan` milik salah satu peserta unit (tidak perlu RPC baru). Isi:
- Info kegiatan (bagian, blok, nama) + nomor BA + tautan PDF gabungan.
- Daftar peserta BA + jumlah halaman berkas (tautan unduh berkas per peserta).
- Tombol **"Tambah peserta + berkas"**: pilih kandidat (mahasiswa sekegiatan, status lolos `getBagianBaStatuses`), wajib lampirkan berkas (PDF/scan), lalu panggil `baAdminAddPesertaBerkas`.
- Aksi per peserta: ganti berkas (berkas lama `active=0`), hapus dari BA (berkas `active=0`), regenerate.
- Status `needs_regen` + tombol retry.

### 7.2 Routing tombol tab BA
`openBaUpload()` dan modal Flow A dihentikan dari UI; tombol "Unggah BA Pendukung" mengarah ke modal 7.1 untuk kegiatan baris terkait.

### 7.3 Tab Input Manual (D9, D10)
- Setelah Blok + Jenis + Detail (+tanggal) terisi, hitung kunci kegiatan; cari peserta existing dari `pengajuanRows` + `detailMap` yang sudah dimuat.
- Panel "Kegiatan ini sudah punya N peserta" menampilkan: nama, NPM, status, indikator "BA Pendukung ada/belum".
- Aksi:
  - **"Tambah peserta lain ke kegiatan ini"** → bersihkan hanya field identitas (NPM/Nama) agar admin tinggal mengisi peserta baru; Blok/Jenis/Detail tetap.
  - **"Kelola BA Pendukung"** → buka modal 7.1 untuk kegiatan tersebut.

### 7.4 Indikator kelengkapan (D13)
Tampilkan `pesertaDenganBa`/`jumlahPeserta` pada unit (kolom BA Pendukung atau kartu ringkasan), mis. "BA Pendukung 2/3 peserta".

## 8. Alur Ringkas

1. Admin menambah peserta via tab Manual → submit (INSERT seperti sekarang).
2. Setelah Blok+Jenis+Detail terisi, panel kegiatan-sama muncul. Admin dapat menambah peserta lain atau "Kelola BA Pendukung".
3. Di modal Kelola BA: admin memilih peserta + mengunggah berkas → server membuat/menambah peserta & berkas → regenerate PDF gabungan.
4. Bagian mengunggah BA Pelaksanaan untuk kegiatan yang sama → **dua BA tampil berdampingan** (dedup diperbaiki).
5. Hapus/ubah salah satu BA tidak memengaruhi BA jenis lain.

## 9. Error Handling & Edge Cases

- **Berkas kosong** saat tambah peserta → ditolak (D6).
- **Kegiatan tanpa peserta** → tidak ada BA; tombol kelola nonaktif.
- **Batas 50 halaman / 20 MB** → pesan jelas (D11).
- **Regenerate gagal** → `needs_regen=1`, PDF lama tetap (D12).
- **BA Pelaksanaan tanpa file** → tetap boleh; tidak lagi menimpa BA Pendukung (dedup diperbaiki).
- **Peserta status belum lolos** → tidak muncul sebagai kandidat (`getBagianBaStatuses`).
- **Perubahan status peserta** setelah masuk BA → tetap, ditandai saja.

## 10. Keamanan & Akses

- Semua RPC `requireAdmin`.
- Bagian & mahasiswa tidak terpengaruh.
- Tidak mengekspos token; URL Drive seperti mekanisme sekarang.

## 11. Testing

- **Regresi inti**: `test/ba-coexist.test.js` — aktifkan kasus `file_url` kosong (hapus `.skip`) dan pastikan BA Pendukung + Pelaksanaan berdampingan.
- `addBaAdminPesertaWithBerkas`: berkas kosong ditolak; berkas valid → peserta + berkas aktif + `file_url` terisi; idempoten saat peserta sudah ada.
- Agregasi: `pesertaDenganBa` benar (mis. 2/3).
- Guard template dashboard: modal Kelola BA, panel kegiatan-sama di tab Manual, dan **tidak ada lagi** pemanggilan `uploadBeritaAcaraAdmin`/`openBaUpload` dari UI.
- Regresi: seluruh suite lama tetap hijau.

## 12. Kriteria Terima

- Mengunggah BA Pelaksanaan **tidak** membuat BA Pendukung hilang dari daftar unit.
- BA Pendukung dikelola **hanya** lewat jalur per-peserta (modal Kelola BA); tidak ada lagi jalur "satu file per kegiatan".
- Menambah peserta ke BA **wajib** disertai berkas; PDF gabungan ter-*generate*.
- Tab Input Manual menampilkan peserta kegiatan yang sama + aksi tambah peserta & kelola BA.
- Indikator "BA Pendukung x/y peserta" tampil.
- Seluruh suite tes lama tetap hijau.

## 13. Keputusan Tambahan (Terjawab di Diskusi)

1. Model per-peserta hanya untuk **BA Pendukung**; BA Pelaksanaan tetap 1 file per kegiatan.
2. BA Pendukung & BA Pelaksanaan **dua-duanya tetap ada & berdampingan**.
3. Panel kelola BA berbentuk **modal di dashboard**.
4. Peserta BA **wajib berkas langsung** (revisi P10 spec 2026-10-12).
