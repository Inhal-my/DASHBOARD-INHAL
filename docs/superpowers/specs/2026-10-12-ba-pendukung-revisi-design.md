# Desain: BA Pendukung Revisi/Tambah dari Modal Detail Pengajuan

Tanggal: 2026-10-12
Status: **Disetujui untuk desain — BELUM diimplementasi. Jangan diterapkan sebelum ada plan & arahan.**
Terkait: `docs/superpowers/specs/2026-10-12-berita-acara-per-peristiwa-design.md` (BA Pelaksanaan), `docs/superpowers/specs/2026-09-12-dashboard-berita-acara-proses-design.md`

> Dokumen ini murni catatan desain hasil diskusi. Tidak ada perubahan kode/DB/bridge.

---

## 1. Latar Belakang & Masalah

Berita Acara (BA) Pendukung dimiliki **admin**:
- Tabel `berita_acara_admin` + `berita_acara_admin_peserta` (`schema.sql:123-131`).
- Dibuat lewat modal terpisah di dashboard (`public/dashboard.html:1834`), satu BA per kegiatan, duplikat ditolak (`saveBeritaAcaraAdmin`, `src/write/beritaAcara.js:195`).
- **Revisi terbatas**: `updateBeritaAcaraAdmin` (`:252`) hanya bisa mengubah tanggal/jam/catatan — **tidak** bisa ganti file atau mengubah peserta.
- Di **modal Detail Pengajuan**, BA terkait hanya ditampilkan **read-only** sebagai daftar tautan (`detail.baList`, `public/dashboard.html:1717`; pencocokan `matchBaForPengajuan`, `:3331`).

Akibatnya admin tidak bisa menambah peserta atau merevisi dokumen BA Pendukung langsung dari konteks pengajuan; satu-satunya koreksi adalah hapus total lalu unggah ulang (`deleteBeritaAcaraAdmin`, `:233`).

## 2. Tujuan

- Admin dapat **menambah** dan **merevisi** BA Pendukung langsung dari **modal Detail Pengajuan**.
- Isi BA Pendukung = **gabungan berkas (gambar) tiap mahasiswa**, dirakit otomatis oleh server.
- BA Pendukung **selalu bisa diedit** (tanpa status Draft/Final).
- **Riwayat berkas per mahasiswa** dipertahankan.

## 3. Non-Tujuan

- Mengubah alur BA Pelaksanaan (`berita_acara`/`berita_acara_peserta`) — diatur di spec terpisah.
- Membuat siklus Draft/Final/Revisi untuk BA Pendukung.
- Dukungan unggah **PDF** per mahasiswa (hanya gambar).
- UI ubah urutan peserta secara manual.
- Tanda tangan digital/e-sign, OCR.
- Mengubah alur unggah bukti bayar/ACC dan biaya.
- Audit siapa yang mengubah BA Pendukung (semua aksi dilakukan admin).

## 4. Keputusan Desain (Terkunci)

| # | Keputusan |
|---|-----------|
| P1 | BA Pendukung = satu dokumen per kegiatan (`bagian + blok + nama kegiatan`); aturan duplikat dipertahankan. |
| P2 | BA Pendukung **selalu bisa diedit** (tambah/hapus peserta, ganti berkas, koreksi tanggal/jam/catatan). Tanpa status Draft/Final. |
| P3 | Isi BA = **gabungan berkas gambar per mahasiswa**, dirakit otomatis server. |
| P4 | Format berkas per mahasiswa = **gambar saja** (hasil scan kamera / unggah JPG/PNG). |
| P5 | Penggabungan PDF dilakukan **di server (worker) memakai `pdf-lib`**. |
| P6 | Riwayat = **berkas per mahasiswa** (berkas lama `active=false`, tetap tersimpan). **PDF gabungan ditimpa** (tanpa arsip snapshot PDF). |
| P7 | Akses: **hanya admin**, dari modal Detail Pengajuan. Bagian & mahasiswa read-only/tidak terpengaruh. |
| P8 | Urutan peserta di PDF gabungan = **urutan ditambahkan**; tanpa UI ubah urutan. |
| P9 | Menambah mahasiswa **lain** ke BA lewat **pemilih peserta** di kartu BA (daftar mahasiswa sekegiatan). |
| P10 | Peserta boleh ditambahkan **tanpa berkas dulu**; berkas diunggah/di-scan per mahasiswa menyusul. |
| P11 | Gate peserta yang bisa dipilih = status yang sama seperti aturan BA bagian (`getBagianBaStatuses`, default ACC/Diterima). |
| P12 | Bridge GAS ditambah aksi **`getFile`** (ambil byte berkas by file id) untuk merakit PDF. |
| P13 | Berkas halaman **dan** PDF gabungan disimpan di **Drive** (D1 hanya menyimpan URL/metadata). |
| P14 | Kegagalan regenerate tidak menghilangkan berkas/metadata; BA ditandai `needs_regen` + tombol retry. |
| P15 | Regenerate memakai **lock ringan per-BA** (anti tumpang-tindih admin). |
| P16 | Batas regenerate: **maks 50 halaman** dan **20 MB** total input per regenerate. |
| P17 | Tiap halaman dikompres ke **JPEG** (`compressToJpeg` yang ada, kualitas default) lalu disusun menjadi **PDF**. |
| P18 | Admin dapat **mengunduh berkas per mahasiswa** (tautan per berkas/halaman), selain PDF gabungan. |
| P19 | **Tanpa audit** perubahan BA Pendukung (semua aksi dilakukan admin). |

## 5. Model Konseptual

- **BA Pendukung** — identitas logis `bagian + blok + nama kegiatan`. Diwujudkan satu baris `berita_acara_admin` dengan `file_url` = PDF gabungan aktif.
- **Peserta** — mahasiswa yang termasuk BA (`berita_acara_admin_peserta`), diurutkan berdasarkan urutan ditambahkan.
- **Berkas** — satu halaman gambar milik seorang peserta (`berita_acara_admin_berkas`). Banyak baris per peserta = banyak halaman. Baris `active=0` = riwayat.
- **Susunan PDF** — daftar berkas aktif, urut `peserta.urutan` lalu `page_index`.

## 6. Skema & Migrasi (usulan)

Migrasi baru `new-code1-cf/migrations/2026-10-12-ba-pendukung-berkas.sql` + sinkron `schema.sql`:

- `berita_acara_admin`: tambah `updated_at TEXT`, `needs_regen INTEGER DEFAULT 0`.
- `berita_acara_admin_peserta`: tambah `urutan INTEGER`, `active INTEGER DEFAULT 1`.
- Tabel baru:
  ```sql
  CREATE TABLE berita_acara_admin_berkas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT, ba_id TEXT, id_pengajuan TEXT, npm TEXT,
    urutan INTEGER, page_index INTEGER,
    file_name TEXT, file_url TEXT,
    active INTEGER DEFAULT 1, superseded_at TEXT
  );
  CREATE INDEX idx_ba_admin_berkas_ba_id ON berita_acara_admin_berkas(ba_id);
  ```
- Data lama: baris `berita_acara_admin*` yang ada tetap valid; kolom baru default aman (tanpa berkas → PDF gabungan berisi file lama bila ada, atau kosong).

## 7. Alur

### 7.1 Buat BA dari modal detail
- Prefill `bagian`, `blok`, `nama_kegiatan` dari pengajuan; tanggal default dari `tanggal_pelaksanaan`; jam opsional.
- `getOrCreateBaAdmin`: cari by `kegiatan_key`; jika ada pakai, jika tidak buat (`BA-PEN-YYYY-####`).

### 7.2 Tambah peserta
- Via **pemilih peserta** (daftar mahasiswa `getBagianBaStatuses` di kegiatan sama, belum ada di BA).
- Peserta ditambahkan sebagai baris aktif (`urutan` = max+1) **tanpa berkas** (P10).
- Mahasiswa pada detail yang dibuka bisa ditambahkan lewat pemilih yang sama.

### 7.3 Unggah/Scan berkas per mahasiswa
- Grid `scanItems` (reuse), multi-halaman, kamera capture / unggah JPG/PNG.
- Kirim gambar (base64) → server unggah ke Drive → baris `berita_acara_admin_berkas` (`page_index` 0..n) → regenerate.

### 7.4 Ganti berkas (revisi)
- Berkas lama peserta ditandai `active=0`, `superseded_at=now` (riwayat, P6).
- Berkas baru ditambahkan (`page_index` dari 0) → regenerate.

### 7.5 Hapus peserta
- Peserta `active=0`; berkasnya `active=0` (riwayat tetap) → regenerate.

### 7.6 Regenerate
1. Ambil berkas aktif urut (`peserta.urutan`, `page_index`).
2. Ambil byte tiap berkas (dari permintaan bila baru, atau bridge `getFile`).
3. Gabung jadi PDF (`mergeImagesToPdf`).
4. Unggah ke Drive → `berita_acara_admin.file_url` diperbarui; `needs_regen=0`, `updated_at=now`.
5. Gagal → `needs_regen=1`; `file_url` lama dipertahankan.

### 7.7 Koreksi metadata
- `updateBeritaAcaraAdmin` (tanggal/jam/catatan) dipertahankan. Koreksi metadata **tidak memicu regenerate**, karena PDF gabungan hanya berisi gambar halaman (nomor/tanggal BA tidak dirender ke dalam PDF).

## 8. Backend (Worker) & Bridge

**Modul baru** `src/baMerge.js`: `mergeImagesToPdf(pages)` memakai `pdf-lib` (`embedJpg`/`embedPng`) → byte PDF. Satu titik, mudah diuji.

**Fungsi tulis** (`src/write/beritaAcara.js` atau modul baru):
- `getOrCreateBaAdmin(db, kegiatan, ctx)` → `ba_id`.
- `addBaAdminPeserta(db, baId, idPengajuan, images, ctx)`.
- `replaceBaAdminBerkas(db, baId, idPengajuan, images, ctx)`.
- `removeBaAdminPeserta(db, baId, idPengajuan, ctx)`.
- `regenerateBaAdminPdf(db, baId, ctx)`.
- `addBaAdminPesertaBulk(db, baId, ids, ctx)` (pemilih peserta, tanpa berkas).

**Ambil byte berkas:** aksi bridge baru `getFile` (base64 by file id). Didokumentasikan di `DEPLOY.md`.

**RPC** (`src/rpc.js`, semua `requireAdmin`):
`baAdminGet`, `baAdminCreate`, `baAdminAddPeserta`, `baAdminAddPesertaBulk`, `baAdminReplaceBerkas`, `baAdminRemovePeserta`, `baAdminRegenerate`.

**Read:** perluas data modal detail agar membawa BA kegiatan + peserta aktif + berkas aktif + kandidat peserta (mahasiswa sekegiatan).

## 9. Frontend (Modal Detail Pengajuan)

Kartu **"Berita Acara Pendukung"** (menggantikan kartu BA read-only `detail.baList`):
- **BA belum ada** → tombol **"Buat BA Pendukung"**.
- **BA sudah ada** → nomor BA, tanggal/jam/catatan (dapat dikoreksi), tautan **"Lihat PDF BA"**, daftar peserta.

**Pemilih peserta:** tombol **"Tambah peserta"** → daftar mahasiswa sekegiatan (belum masuk BA) dengan checkbox + "pilih semua" + kotak cari; konfirmasi menambah peserta (tanpa berkas).

**Per peserta:** badge jumlah halaman, aksi **"Unggah/Scan halaman"**, **"Ganti berkas"**, **"Hapus dari BA"**, dan **tautan unduh berkas per mahasiswa** (P18). Baris "Belum ada berkas" ditandai.

**Indikator:** `needs_regen` + tombol **"Regenerate"** (retry); toast sukses/gagal; PDF lama tetap bisa diunduh sampai regenerate sukses.

## 10. Error Handling & Edge Cases

- **Regenerate gagal** → metadata/berkas tetap; `needs_regen=1`; retry manual (P14).
- **Batas jumlah/ukuran**: maks **50 halaman** dan **20 MB** total input per regenerate (P16); pesan jelas bila terlampaui.
- **Peserta tanpa berkas** → diizinkan (P10); tidak menggagalkan regenerate (halaman peserta kosong dilewati) tetapi ditandai di UI.
- **Hapus peserta terakhir** → BA tetap ada (file gabungan bisa kosong); admin dapat menghapus BA lewat jalur lama.
- **Gambar tidak valid/rusak** → dilewati dengan catatan, regenerate tetap jalan bila ada ≥1 halaman valid.
- **Lock per-BA** mencegah dua regenerate bersamaan (P15).
- **Status peserta berubah** setelah masuk BA → tetap, ditandai saja (tidak auto-keluar).

## 11. Keamanan & Akses

- Semua RPC `requireAdmin`.
- Bagian & mahasiswa tidak terpengaruh (read-only/tetap).
- Tidak mengekspos token; URL Drive seperti mekanisme sekarang.

## 12. Testing

- Unit `baMerge`: JPEG/PNG → PDF; urutan halaman; gambar rusak dilewati.
- Unit add/replace/remove/bulk: baris peserta & berkas benar, `active`/`superseded_at`, urutan.
- `getOrCreateBaAdmin`: satu BA per kegiatan (idempoten).
- `regenerateBaAdminPdf`: sukses → `file_url` berubah, `needs_regen=0`; gagal (mock bridge) → `needs_regen=1`, `file_url` lama.
- Bridge `getFile` (mock).
- Guard template dashboard: kartu BA Pendukung, pemilih peserta, marker `scanItems`, tombol aksi ada.
- Regresi: seluruh suite lama tetap hijau.

## 13. Keputusan Tambahan (Terjawab)

1. Batas regenerate: **50 halaman / 20 MB** (P16).
2. Gambar halaman dikompres **JPEG** (`compressToJpeg`, kualitas default) lalu disusun menjadi **PDF** (P17).
3. Admin **dapat mengunduh berkas per mahasiswa** selain PDF gabungan (P18).
4. **Tanpa audit** perubahan BA Pendukung (P19).

## 14. Kriteria Terima

- Dari modal Detail Pengajuan, admin dapat membuat BA Pendukung (blok & nama terisi otomatis) untuk kegiatan pengajuan.
- Admin dapat menambah peserta (pemilih) tanpa berkas, lalu mengunggah/men-scan halaman per mahasiswa.
- Admin dapat mengganti berkas seorang mahasiswa (berkas lama tersimpan sebagai riwayat), menghapus peserta dari BA, dan **mengunduh berkas per mahasiswa**.
- Server menggabungkan berkas aktif menjadi satu PDF per kegiatan; `file_url` BA diperbarui; urutan sesuai urutan ditambahkan; batas 50 halaman / 20 MB ditegakkan.
- Kegagalan regenerate ditandai `needs_regen` dan dapat di-retry tanpa kehilangan data.
- Bagian & mahasiswa tidak terpengaruh; seluruh suite tes lama tetap hijau.
