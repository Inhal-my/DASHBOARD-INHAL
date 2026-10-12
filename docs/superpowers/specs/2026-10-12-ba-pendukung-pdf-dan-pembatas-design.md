# Desain: BA Pendukung — Berkas PDF (Scanner) + Add-in Sampul & Pembatas

Tanggal: 2026-10-12
Status: **Disetujui untuk desain — BELUM diimplementasi. Jangan diterapkan sebelum ada plan & arahan.**
Terkait: `docs/superpowers/specs/2026-10-12-ba-pendukung-revisi-design.md` (keputusan P1–P19)

> Dokumen ini murni catatan desain hasil diskusi. Tidak ada perubahan kode/DB/bridge.
> Dokumen ini **menambah** dukungan berkas PDF dan add-in; P1–P19 tetap berlaku kecuali **P4** dan **P17** yang diamandemen (lihat §4).

---

## 1. Latar Belakang & Masalah

Fitur BA Pendukung saat ini hanya menerima berkas **gambar** JPG/PNG per halaman (P4). Banyak admin men-scan dokumen dengan aplikasi scanner ponsel, yang keluarannya berupa **PDF multi-halaman**. PDF itu tidak bisa dilampirkan karena tiga titik menolaknya:

1. Input kamera `accept="image/*"` (`public/dashboard.html`) menyaring PDF.
2. `ScanPdf.compressToJpeg()` memuat berkas via elemen `<img>`; PDF gagal (`onerror`).
3. `setBaAdminPesertaBerkas` (`src/write/baAdmin.js:179`) menolak mime selain `image/jpeg|jpg|png`.

Akibatnya admin harus mengonversi PDF ke gambar dulu (menurunkan kualitas dan merepotkan).

Di sisi lain, PDF gabungan saat ini hanya berisi tumpukan halaman tanpa penanda identitas, sehingga sulit dinavigasi ketika berisi banyak mahasiswa.

## 2. Tujuan

- Admin dapat melampirkan **berkas PDF** (hasil scanner) per mahasiswa, selain gambar.
- PDF asli **disalin utuh** (bukan di-raster ulang, bukan di-recolor), sehingga isi dan warna asli tetap.
- PDF gabungan menjadi lebih jelas lewat **sampul** dan **halaman pembatas per mahasiswa** (teks saja, tidak menyentuh halaman asli).
- Tetap **satu PDF gabungan per kegiatan**; peserta baru otomatis masuk ke rakitan berikutnya tanpa menyentuh berkas peserta lain.

## 3. Non-Tujuan

- Tidak mengubah P1–P3, P5–P16, P18–P19.
- Tidak menambah UI ubah urutan peserta (P8).
- Tidak mengubah geometri/isi halaman asli: tidak menambah margin, tidak menggambar apa pun di atas halaman hasil scan/PDF asli.
- Tidak mengubah warna/filter apa pun. Add-in hanya teks hitam/abu di halaman baru.
- Tidak ada OCR, e-sign, atau audit (P19).

## 4. Amendemen Keputusan Lama

| # | Sebelum (spec P) | Sesudah |
|---|------------------|---------|
| P4 | Format berkas per mahasiswa = **gambar saja** | gambar JPG/PNG **atau PDF** |
| P17 | Tiap halaman dikompres ke **JPEG** lalu disusun jadi PDF | gambar tetap dikompres JPEG; **PDF asli disalin tanpa kompres/recompress** |

## 5. Keputusan Baru (Terkunci)

| # | Keputusan |
|---|-----------|
| Q1 | Satu berkas BA = satu file: gambar (1 halaman) **atau** PDF (N halaman). Jumlah halaman disimpan di kolom `page_count` per baris `berita_acara_admin_berkas`. |
| Q2 | Penggabungan server: gambar → `embedJpg`/`embedPng`; PDF → `PDFDocument.load` + `copyPages` **seluruh** halaman apa adanya (konten, ukuran, warna utuh). |
| Q3 | PDF terenkripsi → `PDFDocument.load(bytes, { ignoreEncryption: true })`. Bila tetap gagal diparse → berkas ditolak dengan pesan; berkas lama tidak berubah. |
| Q4 | Batas tetap P16: Σ `page_count` berkas aktif ≤ **50 halaman** dan total byte ≤ **20 MB**. Dihitung dari **halaman sumber**, bukan jumlah file/berkas. |
| Q5 | PDF boleh menjadi **satu-satunya** berkas peserta (tanpa gambar). |
| Q6 | **Add-in A — Halaman pembatas**: halaman A4 putih baru sebelum berkas tiap peserta yang ber-berkas aktif: nomor urut, nama, NPM, blok. |
| Q7 | **Add-in B — Halaman sampul**: halaman A4 putih baru di paling awal: judul "BERITA ACARA PENDUKUNG", bagian/blok/nama kegiatan, tanggal, dan daftar **seluruh peserta aktif** (no, nama, NPM, jumlah halaman; peserta tanpa berkas ditandai "belum ada berkas"). |
| Q8 | **Nomor halaman (opsi aman)**: teks "Hal. i/N" kecil abu-abu **hanya** di halaman yang dibuat server (sampul + pembatas); `i` = nomor halaman keluaran, `N` = total halaman keluaran (termasuk add-in). Halaman asli tidak digambar apa pun. |
| Q9 | Halaman asli mempertahankan ukuran aslinya (PDF). Gambar tetap di-fit ke A4 seperti sekarang. Ukuran halaman campur diperbolehkan. |
| Q10 | Add-in A+B aktif secara default. Tidak ada toggle di UI; opsi dukungan disiapkan di `mergeBaFilesToPdf` bila kelak diperlukan. |
| Q11 | Peserta **tanpa** berkas aktif tidak mendapat halaman pembatas dan tidak menyumbang halaman. |
| Q12 | Halaman add-in **tidak** dihitung terhadap batas 50 halaman (hanya halaman sumber). |
| Q13 | UI: tombol **"Unggah PDF"** (`accept="application/pdf"`) di samping tombol kamera; badge halaman = Σ `page_count`; unduh per berkas. |
| Q14 | Tanpa audit (lanjutan P19). |

## 6. Model Konseptual

- **Berkas** — satu baris `berita_acara_admin_berkas` mewakili **satu file** di Drive: gambar (1 halaman) atau PDF (N halaman). Ditambah kolom `page_count`.
- **Susunan PDF gabungan** — `[Sampul]` lalu, untuk tiap peserta ber-berkas (urut `peserta.urutan`): `[Halaman pembatas]` + halaman berkas (urut `page_index`, lalu halaman internal PDF).
- **Add-in** dihasilkan saat regenerate dan menjadi bagian dari PDF gabungan; **tidak** disimpan sebagai berkas terpisah dan tidak masuk riwayat.
- **Batas** dihitung atas halaman sumber aktif.

## 7. Skema & Migrasi (usulan)

Migrasi baru `new-code1-cf/migrations/2026-10-12-ba-pendukung-pdf.sql` + sinkron `schema.sql`:

```sql
ALTER TABLE berita_acara_admin_berkas ADD COLUMN page_count INTEGER DEFAULT 1;
```

- Semua baris lama adalah gambar → `page_count` default `1`, aman.
- Tidak ada tabel baru.
- Jalankan sekali (`ALTER TABLE ADD COLUMN` tidak bisa diulang), sebelum deploy Worker baru (mengikuti aturan `DEPLOY.md`).

## 8. Alur

### 8.1 Unggah gambar (tidak berubah)
Kamera/galeri → kompres JPEG di klien → kirim base64 → simpan (`page_count = 1`) → regenerate.

### 8.2 Unggah PDF per mahasiswa
- Admin klik **"Unggah PDF"** pada baris peserta → pilih file `application/pdf`.
- Klien membaca file sebagai base64 apa adanya (mime `application/pdf`, nama file), **tanpa** kompres.
- Server (`baAdminUploadBerkas`):
  1. Validasi mime = gambar atau PDF.
  2. Bila PDF: parse dengan `PDFDocument.load({ ignoreEncryption: true })` untuk memvalidasi **dan** menghitung halaman → `page_count`.
  3. Cek batas: Σ `page_count` aktif (setelah mengganti berkas peserta ini) ≤ 50 dan total ≤ 20 MB; bila lewat → tolak berpesan, berkas lama tetap.
  4. Simpan PDF sebagai **satu** baris berkas (`page_count = N`); tandai berkas lama peserta itu `active = 0`, `superseded_at = now`.
  5. Lanjut `regenerateBaAdminPdf` (otomatis dari RPC `baAdminUploadBerkas`).
- Hasil: peserta menampilkan "N halaman"; tautan "Lihat PDF BA" menunjuk PDF gabungan baru.

### 8.3 Tambah peserta lalu lampirkan PDF
1. **"Tambah peserta"** → pilih mahasiswa (sekegiatan/blok, status ACC/Diterima, belum masuk BA) → **"Tambahkan"**. Peserta masuk dengan `urutan = max+1`, tanpa berkas (P10). Belum mengubah PDF gabungan.
2. Baris peserta baru menampilkan **"Belum ada berkas"**; klik **"Unggah PDF"** → ikuti §8.2.
3. Server merakit ulang PDF gabungan: peserta lain tidak tersentuh; peserta baru ditambahkan di akhir (setelah halaman pembatasnya).

### 8.4 Ganti berkas (revisi)
Sama seperti §8.2/§8.1 untuk peserta mana pun. Berkas lama peserta itu `active = 0` (riwayat, P6), berkas baru ditambahkan; regenerate. Tidak menyentuh peserta lain.

### 8.5 Hapus peserta
Peserta `active = 0`; berkasnya `active = 0` → regenerate (perilaku lama, P6).

### 8.6 Regenerate
1. Ambil berkas aktif digabung peserta aktif, urut `peserta.urutan` lalu `page_index`.
2. Kelompokkan per peserta.
3. Ambil byte tiap berkas dari Drive (bridge `getFile`), klasifikasi gambar/PDF (dari mime, fallback magic bytes `%PDF`).
4. Susun `[Sampul]` + `[Pembatas + halaman]` per peserta → PDF (`mergeBaFilesToPdf`).
5. Unggah PDF ke Drive → `berita_acara_admin.file_url` diperbarui; `needs_regen = 0`, `updated_at = now`.
6. Gagal → `needs_regen = 1`; `file_url` lama dipertahankan (P14). Lock per-BA (P15).

## 9. Backend (Worker) & Bridge

**`src/baMerge.js`** — fungsinya diperluas menjadi `mergeBaFilesToPdf(input)`:
- `input = { ba: { bagian, blok, namaKegiatan, tanggal }, peserta: [ { urutan, nama, npm, halaman } ], groups: [ { peserta: { urutan, nama, npm, blok }, files: [ { bytes, mime, pageCount } ] } ] }`.
  - `peserta` = seluruh peserta aktif (untuk daftar di sampul, Q7); `groups` = hanya peserta yang punya berkas aktif (untuk pembatas + halaman, Q11).
- Keluaran: `{ bytes, sourcePages, outputPages }` (`sourcePages` = halaman sumber; `outputPages` = total termasuk add-in).
- Cabang per file:
  - gambar (`image/jpeg|jpg|png` atau magic JPEG/PNG) → `embedJpg`/`embedPng`, fit A4 (seperti sekarang).
  - PDF (mime `application/pdf` atau magic `%PDF`) → `const src = await PDFDocument.load(bytes, { ignoreEncryption: true }); const copied = await out.copyPages(src, src.getPageIndices()); copied.forEach((p) => out.addPage(p));` — tanpa mengubah halaman.
- Add-in (teks saja, font standar `Helvetica`/`HelveticaBold`, hitam/abu):
  - `addCoverPage(doc, ba, groups)` — sampul B.
  - `addSeparatorPage(doc, peserta, index, total)` — pembatas A.
  - Teks footer "Hal. i/N" hanya di halaman yang dibuat server (Q8).
- Bila tidak ada halaman sumber → `throw` seperti perilaku sekarang.

**`src/write/baAdmin.js`**:
- `setBaAdminPesertaBerkas`: terima mime `application/pdf`; untuk PDF hitung halaman via pdf-lib; `page_count` = N (PDF) atau 1 (gambar); simpan kolom `page_count`.
- `countActivePages`: jumlahkan `page_count` (bukan jumlah baris).
- `runRegenerateBaAdminPdf`: kelompokkan baris aktif per peserta; ambil `mime` dari `getFile`; panggil `mergeBaFilesToPdf` dengan `ba` + `groups`.
- `getBaAdminForPengajuan`: `peserta[].pages` = Σ `page_count`; `peserta[].files[]` menyertakan `pageCount` (dan `mime` bila perlu).

**Bridge GAS**: aksi `getFile` sudah mengembalikan `base64` + `mimeType` (P12). Untuk PDF, pastikan `mimeType` = `application/pdf`; kode tetap punya fallback deteksi magic bytes `%PDF`, jadi tidak wajib bergantung pada mime.

**RPC (`src/rpc.js`)**: tetap `baAdminUploadBerkas` (tidak ada RPC baru). Param ketiga tetap array berkas `{ data, mimeType, name }`; gambar = berkas ber-mime gambar (kompatibel mundur).

## 10. Frontend (Modal Detail Pengajuan)

- Input tersembunyi baru: `baPendukungPdf` (`accept="application/pdf"`).
- Baris tiap peserta punya dua tombol berkas: **"Unggah/Scan halaman"** (kamera → kompres JPEG) dan **"Unggah PDF"** (`accept="application/pdf"`).
- `unggahBerkasBa(pe, kind)` dengan `kind` `'scan'` | `'pdf'` menentukan input yang diklik.
- `simpanBerkasBa` membawa mime asli: kamera → `image/jpeg`; PDF → `application/pdf` (tanpa kompres). Untuk PDF, dibaca sebagai base64 utuh.
- Tampilan: badge jumlah halaman = Σ `page_count`; tautan unduh per berkas (label jumlah halaman untuk PDF); penanda "Belum ada berkas".
- Pesan error batas 50 halaman/20 MB ditampilkan lewat notifikasi yang ada.

## 11. Error Handling & Edge Cases

- **PDF rusak / gagal parse** → tolak berkas, berkas lama tetap; pesan jelas.
- **Lewat batas 50 halaman / 20 MB** → tolak berkas baru, berkas lama tetap; pesan jelas.
- **PDF terenkripsi** → coba `ignoreEncryption`; bila tetap gagal → tolak.
- **Peserta tanpa berkas** → dilewati; tanpa halaman pembatas (P10/Q11).
- **Hapus peserta terakhir** → PDF gabungan bisa kosong / tanpa halaman (perilaku lama P14).
- **Regenerate gagal** → `needs_regen = 1`, `file_url` lama dipertahankan, tombol retry (P14).
- **Lock per-BA** mencegah regenerate bersamaan (P15).
- **PDF multi-ukuran halaman** diizinkan (tidak dipaksa A4, Q9).
- **Status peserta berubah** setelah masuk BA → tetap ditandai (tidak auto-keluar, perilaku lama).

## 12. Keamanan & Akses

- Semua RPC `requireAdmin` (tidak berubah).
- Tidak mengekspos token; URL Drive seperti mekanisme sekarang.
- Tidak ada data pengguna baru yang terekspos.

## 13. Testing

- **`baMerge`**: gambar+PDF campuran; PDF multi-halaman (urutan benar); sampul & pembatas terbentuk; `sourcePages` vs `outputPages` benar; nomor halaman hanya di halaman server; PDF terenkripsi ditangani; halaman asli tidak dimodifikasi (mis. tidak error saat dipanggil ulang).
- **`ba-admin-berkas`**: terima PDF; tolak mime tak didukung; cap 50 menghitung `page_count`; `page_count` tersimpan.
- **`ba-admin-regenerate`**: campuran gambar+PDF; `needs_regen` pada kegagalan; `file_url` lama dipertahankan.
- **Migrasi**: kolom `page_count` ada, default `1`, data lama aman (uji terhadap DB pra-migrasi).
- **Guard dashboard**: marker "Unggah PDF" dan input `accept="application/pdf"` ada.
- **Regresi**: seluruh suite lama tetap hijau.

## 14. Kriteria Terima

- Admin dapat melampirkan PDF hasil scanner ke seorang peserta, baik sebagai satu-satunya berkas maupun bersama gambar.
- Halaman PDF asli muncul utuh di PDF gabungan (dapat dibuka, urutan benar, warna tidak berubah).
- PDF gabungan memiliki sampul (B) di awal dan halaman pembatas (A) sebelum berkas tiap peserta; nomor halaman hanya tercetak di halaman yang dibuat server.
- Menambah peserta baru lalu melampirkan PDF hanya menambah bagian peserta itu; berkas peserta lain tidak berubah; peserta baru tampil di akhir.
- Batas 50 halaman (Σ `page_count`) dan 20 MB ditegakkan dengan pesan jelas; pelanggaran tidak merusak data lama.
- PDF terenkripsi yang gagal diparse ditolak dengan pesan; PDF yang bisa dibuka (dengan `ignoreEncryption`) berhasil.
- Seluruh suite tes lama tetap hijau.
