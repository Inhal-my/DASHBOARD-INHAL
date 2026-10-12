# Desain: Berita Acara per Peristiwa (Draft → Final → Revisi)

Tanggal: 2026-10-12
Status: **Draft desain & rencana — BELUM disetujui untuk implementasi. Jangan diterapkan sebelum ada arahan.**
Terkait: `docs/superpowers/specs/2026-09-12-dashboard-berita-acara-proses-design.md`, `docs/superpowers/specs/2026-09-14-monitoring-kegiatan-tanggal-dan-ba-design.md`

> Dokumen ini murni catatan hasil diskusi. Tidak ada perubahan kode/DB/bridge yang dilakukan.

---

## 1. Latar Belakang & Masalah

Saat ini berita acara (BA) dimodelkan sebagai **satu BA per kegiatan lintas waktu**, dengan dua jalur terpisah:

- **BA Pelaksanaan** — dibuat sisi bagian, tabel `berita_acara` + `berita_acara_peserta` (`schema.sql:114-122`). Alur buat/hapus/ubah di `src/write/beritaAcara.js:299-375`.
- **BA Pendukung** — dibuat admin, tabel `berita_acara_admin` + `berita_acara_admin_peserta` (`schema.sql:123-131`). Alur di `src/write/beritaAcara.js:195-270`.

Masalah yang teridentifikasi:

1. **Kunci unik tidak memuat tanggal.** `kegiatan_key = norm(bagian)|norm(blok)|normKegiatan(nama)` (`src/read/common.js:16`), dijaga `INSERT ... WHERE NOT EXISTS(kegiatan_key)` (`src/write/beritaAcara.js:151-156`). Sementara deteksi duplikat memakai tanggal (`findDuplicateBa`, `:115-128`). Ketidaksinkronan ini membuat unggahan BA kedua dengan nama sama di tanggal berbeda **dilewati senyap** namun tetap mengembalikan `{success:true}` — roster tidak tersimpan.
2. **Roster bertahap tidak terakomodasi.** Gerbang status bersifat per-kelompok (satu "Menunggu" memblokir seluruh grup, `public/bagian.html:558`) dan server menolak bila ada peserta terpilih yang belum ACC (`validateBaPesertaStatus`, `src/write/beritaAcara.js:99-113`). Mahasiswa yang sudah ACC ikut tertahan.
3. **Tidak ada operasi tambah/hapus peserta pada BA berjalan.** Satu-satunya koreksi adalah hapus total lalu unggah ulang (`deleteBeritaAcaraBagian`, `:272`).
4. **Dokumen diunggah manual, bukan digenerate dari daftar peserta.** Roster berubah = file tidak lagi sinkron.
5. **Pengelompokan berbasis teks + tanggal + blok, bukan identitas peristiwa tetap** (`public/bagian.html:532`). Teks `detail` yang berbeda memecah mahasiswa dari kegiatan yang sama.

## 2. Tujuan

- BA = **satu peristiwa bertanggal**, berisi banyak mahasiswa (peserta).
- Roster dapat bertambah/berkurang **sampai Final**; dokumen **digenerate dari daftar peserta**, bukan diunggah.
- **Nomor BA tetap**; perubahan setelah Final menjadi **"Revisi n"**.
- Menggantikan kepemilikan BA Pelaksanaan dari bagian ke **admin**; UI bagian menjadi **read-only**.
- Memperbaiki bug insert senyap dengan memasukkan tanggal ke kunci peristiwa.

## 3. Non-Tujuan

- Mengubah `link_final` per-mahasiswa (tetap seperti sekarang, lihat §9).
- Mengubah alur BA Pendukung (`berita_acara_admin`) kecuali bila disetujui berbeda (lihat §14).
- Menambah tanda tangan digital/e-sign.
- OCR, atau mengubah skema unggah bukti bayar/ACC dan biaya.

## 4. Keputusan Desain (Terkunci)

| # | Keputusan |
|---|-----------|
| D1 | BA = satu dokumen per peristiwa bertanggal. Kegiatan berulang di tanggal berbeda dianggap tidak ada. |
| D2 | Kunci peristiwa = `bagian + blok + nama kegiatan + tanggal`. **Jam** hanya field (bukan kunci). |
| D3 | Pemilik BA hidup = **admin**. UI bagian menjadi **read-only**. |
| D4 | Roster bertahap: **Draft → Final → Revisi**. |
| D5 | Regenerate dokumen **otomatis** (di-debounce) saat peserta berubah pada status Draft. |
| D6 | Dokumen **digenerate aplikasi** dari daftar peserta (tidak ada unggah pihak ketiga). |
| D7 | Peristiwa lahir dari peserta pertama; **tanggal diambil otomatis** dari peserta pertama; admin boleh koreksi **sebelum Final** (kunci dihitung ulang, **nomor BA tetap**). |
| D8 | Gate status **per-orang**: hanya peserta berstatus ACC/Diterima yang boleh masuk BA. |
| D9 | Pemetaan pengajuan → peristiwa **semi-otomatis**: sistem menyarankan; admin dapat menggabungkan/mengganti peristiwa untuk kasus teks berbeda. |
| D10 | Dokumen generated = output resmi; **tanda tangan fisik** di cetakan; arsip = versi generated (belum bertanda tangan). |
| D11 | Regenerate **menimpa file aktif**; **salinan tiap Final/Revisi diarsipkan** ke folder arsip. |
| D12 | **Nomor BA tetap** sepanjang siklus; revisi berlabel **"Revisi n"**. |
| D13 | `dosen` **dipilih admin** di level peristiwa (lalu disinkronkan ke peserta). |
| D14 | Peserta yang statusnya berubah setelah masuk Draft **ditandai**, tidak auto-keluar. |
| D15 | Akses: admin penuh; bagian read-only; mahasiswa tidak (tetap memakai `link_final`). |
| D16 | Relasi dengan `link_final`: **tetap terpisah**. |
| D17 | Regenerate memakai **lock per-BA** sederhana (anti tumpang-tindih admin). |
| D18 | BA **Final terkunci**: menambah/menghapus peserta wajib lewat aksi eksplisit **"Buka Final untuk Revisi"** + konfirmasi. Tidak ada revisi senyap. |

## 5. Model Konseptual

- **Peristiwa** — identitas logis: `bagian + blok + nama kegiatan + tanggal`. Diwujudkan oleh satu baris BA.
- **BA** — nomor (`ba_id`), metadata (bagian, blok, nama kegiatan, tanggal, jam, dosen, jumlah peserta), status, revisi, file aktif, folder arsip.
- **Peserta** — `berita_acara_peserta`: `ba_id`, `id_pengajuan`, `npm`, `nama_lengkap`, `blok`, `status_pengajuan` + usulan kolom `flagged`/`added_at`.
- **Status** — `draft` | `final` | `editing` (transien saat "Buka Final untuk Revisi").
- **Revisi** — angka `revision` (`0` = belum pernah revisi), naik setiap kali Final dibuka untuk perubahan **lalu difinalkan ulang**; dibatalkan tanpa perubahan tidak menaikkan.
- **Perlu regenerate** — flag `needs_regen` (lihat §12).

## 6. Identitas Peristiwa & Pemetaan

- Format kunci peristiwa yang diusulkan: `normKegiatan(bagian)|norm(blok)|normKegiatan(nama)|YYYY-MM-DD`.
- `nama` kegiatan = konvensi `pilihan + (detail ? ' - ' + detail : '')` (konsisten dengan `public/bagian.html:581`).
- **Semi-otomatis**: saat admin menambahkan peserta, sistem mencari peristiwa dengan kunci persis; jika tidak ada, buat peristiwa baru dari peserta pertama. Admin dapat "gabungkan ke peristiwa lain" / "pindah peristiwa" untuk kasus teks berbeda.

## 7. Siklus Hidup & Alur

### 7.1 Draft (pengumpulan)
- Dibuat saat admin menambahkan peserta pertama.
- Nomor BA dialokasikan di sini dan **tetap**.
- Admin menambah/menghapus peserta (hanya status ACC/Diterima).
- Setiap perubahan → regenerate otomatis (debounced) dokumen dari daftar peserta; file aktif ditimpa.
- Koreksi tanggal peristiwa menulis ulang kunci (nomor tetap).

### 7.2 Final
- Aksi eksplisit admin setelah pengumpulan selesai.
- Roster dibekukan; dokumen digenerate sekali untuk dicetak/ditandatangani.
- **Snapshot final diarsipkan** ke folder arsip.

### 7.3 Revisi (hanya via aksi eksplisit)
- BA berstatus Final **terkunci**. Upaya menambah/menghapus peserta **ditolak** sampai admin menjalankan aksi **"Buka Final untuk Revisi"** (D18).
- Konfirmasi menampilkan ringkasan: nomor BA, revisi saat ini, jumlah peserta, dan peringatan "dokumen bertanda tangan akan digantikan".
- Saat dibuka: status menjadi transien `editing`; roster dapat diubah.
- Dibatalkan tanpa perubahan → kembali `final`, `revision` **tidak** berubah.
- Ada perubahan lalu difinalkan ulang → `revision += 1`, label "Revisi n", dokumen digenerate ulang, snapshot baru diarsipkan, file aktif ditimpa. Satu siklus buka→final hanya menaikkan **satu** nomor revisi (berapa pun peserta yang diubah).
- Bagian tetap read-only.

### 7.4 Hapus
- Draft boleh dihapus (nomor dipensiunkan).
- Final tidak dihapus; hanya lewat Revisi. (Rekomendasi — lihat §14.)

## 8. Integrasi Bridge GAS (generate + arsip)

Bridge Apps Script sudah menjadi mesin PDF (lihat `sendFinalPdfEmails` → `callDriveBridge` aksi `sendFinalEmail`, `src/write/email.js:195-224`; aksi lain `saveFile`, `trashFile`, `sendStatusEmail`).

Usulan:
- Aksi baru, mis. `generateBeritaAcara`, menerima metadata + daftar peserta, merender PDF dari template, menimpa file aktif, dan (bila Final/Revisi) menyimpan salinan ke folder arsip.
- Worker menyimpan `active_file_id`/`active_file_url` + `archive` hasilnya.
- Template & folder arsip dikonfigurasi di sisi Apps Script (di luar repo; didokumentasikan di `DEPLOY.md`/`README.md`).

## 9. Relasi dengan `link_final`

- `link_final` per-mahasiswa (dokumen final + email, `src/write/email.js:207-233`) **tidak berubah**.
- BA per-peristiwa adalah dokumen **administrasi internal** yang terpisah (D16).

## 10. Akses & Peran

- **Admin** — buat, tambah/hapus peserta, finalize, revisi, hapus draft, regenerate, lihat semua.
- **Bagian** — read-only (daftar BA per peristiwa).
- **Mahasiswa** — tidak mengakses BA; tetap memakai `link_final`.

## 11. Migrasi & Nasib Data Lama

- Tabel bagian `berita_acara` **dipensiunkan** sebagai sumber tulis; bagian jadi read-only (D3).
- Data lama (`kegiatan_key` tanpa tanggal) **dibiarkan** sebagai arsip; **backfill tanggal** ke kunci agar tidak bentrok dengan kunci baru.
- Tabel `berita_acara_admin*` (BA Pendukung) di luar cakupan kecuali diputuskan lain (§14).

## 12. Penanganan Error & Edge Cases

- **Atomisitas regenerate** (rekomendasi, menunggu konfirmasi §14): DB dan Drive sistem terpisah. Jika regenerate gagal, peserta **tetap tersimpan**, BA ditandai `needs_regen`, admin dapat retry; dokumen lama tetap valid sampai regenerate sukses.
- **Status peserta berubah** setelah masuk Draft → ditandai (`flagged`), tidak auto-keluar (D14).
- **Tambah/hapus peserta pada BA Final** → ditolak; wajib "Buka Final untuk Revisi" (D18). Tidak ada revisi senyap.
- **Tanggal dikoreksi sebelum Final** → kunci dihitung ulang, cek bentrok, nomor tetap (D7).
- **Lock per-BA** saat regenerate (D17).
- **Draft yang tak pernah Final** → daftar/filter "BA Draft belum Final" (rekomendasi §14).

## 13. Rencana Perubahan (BELUM diimplementasi)

> Semua di bawah ini menunggu arahan. Estimasi file yang tersentuh:

**Skema & migrasi**
- `new-code1-cf/schema.sql` + `new-code1-cf/migrations/2026-10-12-ba-per-peristiwa.sql`.
- Tambah kolom pada tabel BA (peristiwa): kunci bertanggal, `status`, `revision`, `dosen`, `jam`, `active_file_id`, `active_file_url`, `archive_folder_id`, `needs_regen`, `finalized_at`, `updated_at`.
- Tambah kolom peserta: `flagged`/`added_at` bila perlu.

**Backend**
- Refactor `src/write/beritaAcara.js` → fungsi baru: buat/dapatkan peristiwa, tambah peserta, hapus peserta, finalize, **bukaFinalUntukRevisi**, finalize ulang (revisi), regenerate, hapus draft.
- Handler baru di `src/rpc.js` (auth `requireAdmin`).
- `src/read/dashboard.js` — bootstrap/daftar BA per-peristiwa untuk admin.
- `src/read/bagian.js` — daftar BA read-only untuk bagian.

**Bridge GAS (di luar repo)**
- Aksi `generateBeritaAcara` + template + folder arsip; dokumentasi `DEPLOY.md`/`README.md`.

**Frontend**
- `public/dashboard.html` — tab Berita Acara admin: daftar peristiwa + status (Draft/Final/Revisi), tambah/hapus peserta, finalize, **tombol "Buka Final untuk Revisi" + konfirmasi**, indikator regenerate.
- `public/bagian.html` — bagian BA read-only.

**Tes**
- Unit: kunci peristiwa (dengan tanggal), tambah/hapus/finalize/revisi, gate status per-orang, backfill migrasi, **tolak edit saat Final + siklus bukaFinal→finalize ulang (revisi naik satu)**.
- Guard template: dashboard/bagian memuat hook baru & marker lama tetap utuh.
- Regression: seluruh suite lama tetap hijau.

**Urutan kerja (high-level, usulan)**
1. Skema + migrasi + backfill tanggal.
2. Inti backend peristiwa (identitas, buat=dapatkan, tambah/hapus peserta, gate per-orang).
3. Regenerate + lock + `needs_regen` + integrasi bridge.
4. Siklus Final/Revisi + arsip snapshot.
5. UI admin (dashboard) + read-only bagian.
6. Migrasi/matikan jalur bagian + tes regression.

## 14. Pertanyaan Terbuka / Rekomendasi Menunggu Konfirmasi

1. **Cakupan tabel:** model baru menggantikan **BA Pelaksanaan** (`berita_acara`) saja, sedangkan **BA Pendukung** (`berita_acara_admin`) tetap? (asumsi: ya)
2. **Flag `needs_regen`** untuk atomisitas regenerate — setuju? (§12)
3. **Draft tak pernah Final:** tambah daftar/filter "BA Draft belum Final"?
4. **Hapus Draft** dan **buka kembali Final** (via Revisi) — setuju aturan §7.4?
5. **Debounce regenerate:** durasi/titik pemicu (timer vs tombol "Simpan peserta").

## 15. Kriteria Terima

- Admin dapat membuat peristiwa, menambah/menghapus peserta (ACC/Diterima), dan dokumen ter-regenerate otomatis.
- Peristiwa sama (bagian+blok+nama+tanggal) tidak membuat BA ganda; BA dengan tanggal berbeda tidak saling menimpa (bug senyap hilang).
- Final membekukan roster + mengarsipkan snapshot; revisi menaikkan label "Revisi n" dan mengarsipkan snapshot baru; nomor tetap.
- Menambah peserta ke BA Final tanpa membuka → **ditolak**; setelah "Buka Final untuk Revisi" → `Revisi n`, nomor tetap, snapshot baru diarsipkan.
- Bagian melihat BA read-only; mahasiswa tidak terpengaruh (`link_final` tetap).
- Seluruh suite tes lama tetap hijau.
