# Desain: Samakan dashboard admin `new-code1` dengan `new-code1-cf`

Tanggal: 2026-09-19
Status: Disetujui user (19 Sep 2026)

## Latar Belakang

`new-code1` (Google Apps Script + Spreadsheet) dan `new-code1-cf` (Cloudflare Worker + D1) adalah dua runtime dari aplikasi INHAL. Dashboard CF sudah lebih baru:

- Nav 4 item: Pengajuan, Statistik, **satu tab Berita Acara**, Master Data
- Tab Berita Acara = tabel proses dua tahap (BA Pendukung lalu BA Pelaksanaan)
- Master Data = kartu Mahasiswa + Tambah/Ubah/Hapus **per baris** + CSV mahasiswa

Dashboard GAS masih:

- Nav 6 item, termasuk **Laporan Bagian** dan **Berita Acara Bagian** terpisah
- Master Data tanpa Mahasiswa; simpan **mengganti seluruh sheet**
- Tidak ada kartu Download Database (dan **tidak akan ditambah**)

User memilih opsi 2: samakan **seluruh dashboard CF** ke `new-code1`, dengan runtime tetap Spreadsheet.

## Keputusan User (19 Sep 2026)

1. Pendekatan **A**: port UI CF; API GAS mengikuti kontrak CF (`units` + `orphanBa`; CRUD per baris). **Disetujui.**
2. Master Data: **Tambah/Ubah/Hapus per baris** seperti CF (bukan visual-only, bukan replace-all dari UI). **Disetujui.**
3. Kartu **Download Database dibatalkan**. Tidak ada ekspor dump Spreadsheet. **Disetujui.**
4. Tiga menu BA digabung menjadi **satu tab Berita Acara** seperti CF. **Disetujui.**
5. Password Admin / Bagian Staff **tetap teks biasa** di sheet; UI field kosong saat Ubah = tidak menimpa. **Disetujui.**
6. Paginasi tabel (20 baris) + picker Master Data horizontal + aksi baris horizontal. **Disetujui.**
7. CSV mahasiswa maks **500 baris** per request (kuota GAS), bukan 5000 seperti D1. **Disetujui** (Bagian 4).

## Catatan Supersede

Spec ini **hanya** berlaku untuk `new-code1/` (GAS). Spec CF (`2026-09-12-master-data-mahasiswa-crud-design.md`, `2026-09-12-dashboard-berita-acara-proses-design.md`, `2026-09-18-download-database-xlsx-design.md`) **tidak diubah**.

Yang **dipertahankan** di GAS:

- Sheet fisik `BeritaAcara*` vs `BeritaAcaraAdmin*` tetap terpisah.
- Alur unggah Pelaksanaan tetap `adminBagianBypass` → Panel Bagian (`runAsBab`).
- Unggah Pendukung tetap `uploadBeritaAcaraAdmin`.
- Fungsi replace-all lama (`saveMasterKegiatan`, `saveMasterBagian`, `saveMasterBiaya`, `saveConfig`, `saveBagianStaff`, `saveAdminList`) **tidak dihapus**; UI baru tidak memanggilnya.
- Password **tidak di-hash**.
- Halaman `detail-laporan.html`, `portal.html`, `bagian.html`, `index.html` tidak diubah.

## Desain

### 1. Navigasi

Nav dashboard (urutan):

1. Pengajuan
2. Statistik
3. **Berita Acara** (menggantikan `bagian`, `baBagian`, `ba`)
4. Master Data

`pageTitle` dan `switchTab` hanya mengenal keempat kunci itu. State `bab` (sesi admin-sebagai-Bagian) tetap ada, dipicu dari tab `ba`.

### 2. Tab Berita Acara

Meniru `new-code1-cf/public/dashboard.html` tab `ba`:

**Header kanan**

- **Unggah BA Pendukung** (`btn-primary`) → `openBaUpload()`
- **Ekspor Excel** (`btn-soft`) → SheetJS di klien dari baris tabel proses
- **Tidak ada** tombol Unggah BA Pelaksanaan di header

**Zona 1 — lima kartu** (dari seluruh `units`, tidak mengikuti chip):

| Kartu | Angka | Klik |
|---|---|---|
| Kegiatan | total `units` | chip Semua |
| Peserta | jumlah NPM unik | tidak ada |
| BA Pendukung | `sudah / total` | chip Belum Pendukung |
| BA Pelaksanaan | `sudah / yang eligible` | chip Belum Pelaksanaan |
| Belum lengkap | satu angka, merah jika > 0 | chip Belum lengkap |

Eligible = `unitKeputusan` (status tertinggi peserta: Ditolak < Dibatalkan < Menunggu < Diterima < ACC) adalah **Diterima atau ACC**. Pembilang Pelaksanaan = jumlah unit eligible; pembilang `sudah` = eligible yang sudah punya BA Pelaksanaan. Belum lengkap = Pendukung kosong **atau** (eligible dan Pelaksanaan kosong). ACC Final **tidak** masuk tab ini. Label kecil kartu Pelaksanaan: `{n}% dari yang Diterima` (teks CF; hitungan tetap Diterima+ACC).

**Zona 2 — batang + peta**

- Batang per Bagian: sepertiga lebar; kelengkapan **Pelaksanaan**.
- Peta Bagian × Blok: dua pertiga; geser horizontal jika blok banyak; kelengkapan **Pelaksanaan** saja.

**Zona 3 — filter + tabel**

Chip: `Semua` | `Belum Pendukung` | `Belum Pelaksanaan` | `Belum lengkap`. Satu tombol Reset. Dropdown Blok / Bagian. Sortir header Tanggal (default terbaru).

Tabel proses: **satu baris = satu kegiatan** (`units`), plus baris orphan BA (badge "BA tanpa pengajuan", tidak masuk hitungan kartu).

Kolom tabel (desktop, sama CF): Tanggal, Bagian, Blok, Kegiatan, Peserta, BA Pendukung, Keputusan, BA Pelaksanaan, **Progres**, **Realisasi**, **Dosen**, Aksi.

Progres = 6 titik (`pendaftaran`, `pendukung`, `keputusan`, `final`, `pelaksanaan`, `selesai`) dari `computeUnitProgress` di backend unit (salin rumus CF `src/read/kegiatan.js`). Klik titik → modal Riwayat (hitung di klien dari `unit`). Realisasi = tanggal/jam BA Pelaksanaan. Dosen = `dosenList` dari BA Pelaksanaan.

Eligible Pelaksanaan = keputusan unit `Diterima` **atau** `ACC` (bukan hanya Diterima).

Kolom Aksi **horizontal** (`flex-row flex-wrap gap-1`, bukan tumpuk `flex-col`):

1. Belum Pendukung → **Unggah Pendukung** (`btn-primary`)
2. Eligible dan belum Pelaksanaan → **Unggah Pelaksanaan** (`btn-emerald`) → `openPelaksanaanPanel(row)` (prefill kategori, `scrollIntoView` panel sesi, `loadBagian` jika perlu)
3. Ada BA Pelaksanaan → ikon Kelola + Hapus (horizontal)
4. Ada BA Pendukung → ikon Hapus (horizontal)

HP: kartu ringkas per kegiatan; aksi tetap horizontal.

**Ekspor Excel:** CDN SheetJS `xlsx@0.18.5` (seperti CF dan `detail-laporan.html`). `exportBagianExcel()` menulis baris tabel proses ke `berita-acara-YYYY-MM-DD.xlsx`. Bukan dump database.

**Paginasi tabel BA:** 20 baris per halaman. Footer: `Menampilkan x–y dari n` · Prev · nomor (elipsis jika banyak) · Next. Ganti chip/filter/sortir mereset ke halaman 1.

**Orphan BA:** ditampilkan hanya jika chip = Semua dan tidak ada filter Blok/Bagian. CSS `btn-emerald` ditambah ke `<style>` dashboard GAS (belum ada).

### 3. Backend agregasi BA

`getBagianAggregation()` di `1_business.gs` **mengganti** bentuk lama `{ rows, filters }` (hanya dipakai `pages/dashboard.html`) menjadi kontrak CF:

```
{
  categories, labs, filters: { bagian, blok, sumber },
  summary, units, orphanBa
}
```

Setiap `unit`:

- `key` = `kegiatanKey(bagian, blok, label)` (norm lowercase, spasi dirapikan)
- `bagian`, `blok`, `pilihan`, `detail`, `label`, `tanggal`, `tanggalList`
- `peserta[]` (`npm`, `namaLengkap`, `blok`, `statusPengajuan`, `linkFinal`, `idPengajuan`)
- `ba[]` (Pendukung `sumber === 'Admin'`, Pelaksanaan `sumber === 'Bagian'`)
- `baPendukung`, `baPelaksanaan`, `pelaksanaan` (`baId`, `tanggal`, `jam`, `dosen`), `dosenList`, `linkFinal`, `jumlahPeserta`
- `progress` + `counts` dari rumus CF `computeUnitProgress`

Pencocokan BA ke unit (urutan):

1. `Kegiatan Key` langsung jika ada
2. NPM peserta BA ∩ NPM peserta unit, dalam kandidat Bagian+Blok yang sama
3. Nama kegiatan dinormalkan (sama atau `endsWith`)
4. Jika tidak cocok → `orphanBa`

Tanggal **tidak** dipakai untuk mencocokkan. Duplikat BA (Bagian+Blok+nama+tanggal+fileUrl sama) dilewati.

`_computeBagianAggregation` lama (matriks `rows` sumber Pengajuan/Berita Acara) **diganti**. `detail-laporan.html` tidak memakai fungsi ini.

Fungsi unggah Pendukung (`uploadBeritaAcaraAdmin`) dan `adminBagianBypass` tidak diubah.

Agar tombol Kelola/Hapus CF jalan di GAS, **tambah** (tidak ada sekarang):

- `deleteBeritaAcaraBagian(baId)` — hapus baris `BeritaAcara` + peserta; admin only
- `updateBeritaAcaraBagian(baId, payload)` — ubah tanggal/jam/dosen/catatan BA Pelaksanaan
- `updateBeritaAcaraAdmin(baId, payload)` — sama untuk BA Pendukung (opsional UI; CF memakainya dari modal Kelola)

`deleteBeritaAcaraAdmin` yang sudah ada dipakai Hapus Pendukung.

### 4. Master Data — layout

Picker kartu: **chip horizontal** di atas panel (bukan kolom kiri yang panjang). Kartu aktif = ring indigo.

Urutan chip:

1. Mahasiswa (`bi-mortarboard`) — baru, paling kiri
2. Master Kegiatan
3. Master Bagian
4. Master Biaya
5. Config
6. Bagian Staff
7. Pengaturan Bagian (form, bukan tabel)
8. Admin

**Tidak ada** chip Download Database.

Panel kanan: header tipis, search, aksi (Tambah; Mahasiswa juga Unggah CSV). Tabel denser, thead sticky.

Pengaturan Bagian: form toggle/status yang sudah ada. Simpan tetap `saveBagianBaSettings`.

### 5. Master Data — CRUD per baris

Setiap tabel kecuali Pengaturan Bagian:

- Header: search + **Tambah**
- Kolom **Aksi** horizontal: ikon Ubah; ikon Hapus (kecuali Config)
- Modal **satu baris**. Simpan memanggil fungsi per-baris
- Paginasi 20 baris; ganti search/kartu mereset halaman 1

**Mahasiswa**

Kolom: NPM, Nama Lengkap, Email, Blok, Keterangan.

- Tambah: NPM wajib unik; jika sudah ada → gagal, bukan overwrite. Email/Blok/Keterangan opsional.
- Ubah: NPM dikunci. Gagal jika NPM tidak ada.
- Hapus: konfirmasi NPM + nama. **Tidak** cascade ke Pengajuan.
- CSV hanya di kartu Mahasiswa.

CSV:

- Header wajib `NPM` dan `Nama Lengkap` (case-insensitive; alias `npm` / `nama_lengkap` / `Nama`)
- Kolom lain diabaikan
- Upsert by NPM: insert baru (email/blok/keterangan kosong); update **hanya** Nama Lengkap
- Lewati baris NPM kosong. Tolak NPM duplikat di dalam file
- Maks **500** baris per request
- Konfirmasi sebelum tulis: jumlah sekarang vs akan insert / update / dilewati

**Tabel lain**

| Kartu | Identitas tulis | Tambah | Ubah | Hapus |
|---|---|---|---|---|
| Kegiatan | `_row` | ya | ya | ya |
| Bagian | `_row` | ya | ya | ya |
| Biaya | `_row` | ya | ya | ya |
| Config | `Key` (tidak diubah saat Ubah) | ya | ya | **tidak** |
| Bagian Staff | `Email` (unik, case-insensitive) | ya | ya | ya |
| Admin | `_row` | ya | ya | ya |

Password Admin/Staff: **plaintext**. Field kosong saat Ubah = nilai lama tidak ditimpa. Field terisi = simpan teks baru apa adanya. Kolom Pass/Password di tabel boleh menampilkan nilai sheet (bukan hash).

Config: Key unik; tidak ada Hapus di UI; backend menolak delete Config. Staff: email tidak boleh duplikat. Value `BUKTI_MODE` di tabel ditampilkan Bypass/Strict (bukan `lenggang`/`strict`); modal Ubah memakai dropdown dua nilai itu seperti editor Config GAS sekarang.

### 6. Identitas baris `_row`

Spreadsheet master (Kegiatan, Bagian, Biaya, Admin) **tidak punya kolom id**. `getMasterDataMonitor` menambahkan `_row` = nomor baris sheet (1-based, header = 1, data mulai 2).

Saat Ubah/Hapus dengan `_row`:

1. Ambil `LockService.getScriptLock()`, `waitLock(30000)`
2. Baca ulang baris `_row`
3. Bandingkan fingerprint (semua kolom tampilan, trim) dengan nilai yang dikirim klien saat buka modal
4. Tidak cocok (baris bergeser / isi beda / kosong) → `{ success: false, message: 'Baris sudah berubah. Muat ulang Master Data.' }` — **jangan** tulis/hapus
5. Cocok → `setValues` atau `deleteRow`

Insert: `appendRow`, tanpa `_row`.

Mahasiswa / Config / Staff **tidak** memakai `_row`; kunci bisnis (NPM / Key / Email).

Klien **wajib** mengirim `_row` + salinan kolom asli (`original`) pada update/delete Kegiatan, Bagian, Biaya, Admin.

### 7. API

`getMasterDataMonitor` menambah `mahasiswa` (semua baris sheet Mahasiswa) dan `_row` pada baris Kegiatan/Bagian/Biaya/Admin.

Fungsi baru di `1_business.gs` (semua `requireAuthorized` / admin; sesi bagian ditolak):

- `saveMahasiswa(payload)` — `payload.row.mode` = `insert` | `update`. NPM wajib.
- `deleteMahasiswa(npm)`
- `importMahasiswaCsv(payload)` — `payload.rows` = `{ npm, namaLengkap }[]`; kembalikan `{ success, inserted, updated, skipped, message }`
- `saveMasterRow(payload)` — `payload.table` salah satu: `MasterKegiatan`, `MasterBagian`, `MasterBiaya`, `Config`, `BagianStaff`, `Admin` (nama sheet GAS, bukan snake_case D1). Insert jika tanpa identitas; update jika ada.
- `deleteMasterRow(payload)` — Config ditolak. Lainnya by kunci di atas.

Mahasiswa tidak lewat `saveMasterRow`.

Nama `table` memakai **nama sheet GAS** agar tidak membingungkan mapping D1. UI `dashboard.html` menyimpan `table` per kartu sesuai nama itu.

`getBagianAggregation` sesuai bagian 3.

### 8. Error handling

- Gagal simpan → toast error, modal tetap terbuka
- CSV gagal validasi (header, duplikat, >500) → toast, tidak tulis
- Hapus → dialog konfirmasi yang sudah ada
- `_row` stale → pesan muat ulang, tidak menimpa baris lain
- NPM Tambah yang sudah ada → pesan jelas
- Semua mutasi di bawah `LockService`

### 9. File yang berubah

- `new-code1/pages/dashboard.html` — nav, tab BA, Master Data, paginasi, chip picker, CDN SheetJS, CSS `btn-emerald`
- `new-code1/1_business.gs` — `getBagianAggregation`, `getMasterDataMonitor`, CRUD master per baris, `deleteBeritaAcaraBagian`, `updateBeritaAcaraBagian`, `updateBeritaAcaraAdmin`

Tidak mengubah: `0_code.gs` skema sheet (kecuali helper kecil jika perlu fingerprint/`_row`), `2_web.gs`, halaman lain, `new-code1-cf/**`.

### 10. Testing

Repo `new-code1` tidak punya runner GAS. Tambah tes Node di `new-code1/test/` (boleh `node:test`, tanpa dependensi baru) untuk logika murni yang diekstrak ke helper yang juga dipanggil Apps Script, atau diduplikasi sebagai fungsi uji:

- `kegiatanKey` / pencocokan BA → unit vs orphan
- Fingerprint `_row` cocok vs stale
- Parse aturan CSV (bukan I/O sheet)

Checklist manual setelah deploy GAS:

1. Nav 4 item; tab lama Laporan Bagian / BA Bagian tidak ada
2. Tab BA: 5 kartu, chip, unggah Pendukung, Pelaksanaan scroll ke panel
3. Master Mahasiswa: tambah/ubah/hapus + CSV 2 baris
4. Config tidak punya Hapus; Key terkunci saat Ubah
5. Password staff kosong saat Ubah tidak mengubah Pass di sheet
6. Paginasi 20; chip Master Data horizontal

### 11. Di luar cakupan

- Kartu / endpoint Download Database
- Hash password
- Hapus fungsi replace-all lama
- Cascade hapus mahasiswa ke pengajuan
- CSV import di tabel selain Mahasiswa
- Ubah skema sheet (tidak menambah kolom `id`)
- Port `detail-laporan.html` / portal / panel Bagian
- Deploy Cloudflare `new-code1-cf`

## Komponen (batas)

| Unit | Tanggung jawab | Bergantung pada |
|---|---|---|
| Nav + tab `ba` | Satu menu, tabel proses, kartu, chip, paginasi | `getBagianAggregation` |
| `openPelaksanaanPanel(row)` | Prefill, scroll, muat sesi | `adminBagianBypass`, `bab` |
| Modal Kelola / Hapus BA | Ubah tanggal-jam-dosen; hapus BA | `updateBeritaAcara*`, `deleteBeritaAcara*` |
| `exportBagianExcel` | XLSX klien dari `bagianTableRows` | SheetJS CDN |
| Chip Master Data | Pilih kartu tanpa sidebar panjang | state `master.tab` |
| Modal satu baris | Tambah/Ubah | `saveMahasiswa` / `saveMasterRow` |
| Guard `_row` | Tolak tulis jika fingerprint beda | `LockService`, baca ulang sheet |
| CSV klien | Parse + dialog hitung | `importMahasiswaCsv` |
