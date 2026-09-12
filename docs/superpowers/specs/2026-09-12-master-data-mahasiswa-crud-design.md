# Desain: CRUD Mahasiswa + Master Data per-baris + tombol BA Pelaksanaan (`new-code1-cf`)

Tanggal: 2026-09-12
Status: Disetujui user (12 Sep 2026)

## Latar Belakang

Dua keluhan terpisah di dashboard admin:

1. **Master Data** tidak punya kartu Mahasiswa. Tabel `mahasiswa` (NPM, nama, email, blok, keterangan) dipakai portal lookup, tapi admin tidak bisa menambah/ubah/hapus dari dashboard. Kartu lain (Kegiatan, Bagian, Biaya, Config, Staff, Admin) masih memakai modal Edit yang **mengganti seluruh tabel** (`replaceAll`) — berat, rawan race, dan tidak cocok untuk data mahasiswa yang banyak.
2. **BA Pelaksanaan** di tab Berita Acara: tombol header `Unggah BA Pelaksanaan` tidak diinginkan. Tombol Aksi di tabel memanggil `openPelaksanaanPanel()` yang hanya set `bab.showPanel = true` tanpa scroll, jadi klik terasa mati. Kedua tombol Aksi memakai `btn-primary` indigo yang sama.

Tidak ada perubahan skema BA. ACC Final tetap di Pengajuan.

## Catatan Supersede

Spec ini **mengubah** satu butir UI dari `2026-09-12-dashboard-berita-acara-proses-design.md`:

- Tombol header **Unggah BA Pelaksanaan dihapus**. Unggah Pelaksanaan hanya dari kolom Aksi baris kegiatan (scroll ke panel sesi yang sudah ada).
- Tombol header **Unggah BA Pendukung** dan **Ekspor Excel** tetap.

Yang **dipertahankan** dari spec BA proses:

- Satu tab `ba`; tabel proses 1 baris = 1 kegiatan; label Pendukung / Pelaksanaan.
- Unggah Pelaksanaan tetap `adminBagianBypass` (bukan form unggah admin).
- Tidak mengubah skema fisik `berita_acara*` vs `berita_acara_admin*`.

RPC `saveMasterKegiatan`, `saveMasterBagian`, `saveMasterBiaya`, `saveConfig`, `saveBagianStaff`, `saveAdminList` (replace-all) **tidak dipakai UI baru**. Tidak dihapus di rilis ini.

## Keputusan User (12 Sep 2026)

1. Aksi Unggah Pelaksanaan: sembunyikan tombol header; klik Aksi scroll ke panel sesi Bagian di bawah tabel, prefill kategori dari baris. **Disetujui (A).**
2. Mahasiswa: kartu khusus, Tambah / Ubah / Hapus per baris + Unggah CSV. **Disetujui (B).**
3. CSV Mahasiswa: upsert by NPM (update yang cocok, insert baru, baris lama yang tidak ada di CSV dibiarkan). **Disetujui (A).**
4. Konfirmasi CSV: dialog jumlah baris sekarang vs akan insert / update. **Disetujui (A).**
5. Tab Master Data lain juga didesain ulang: Tambah / Ubah / Hapus per baris (bukan visual-only). **Disetujui (B).**
6. Config: Tambah / Ubah saja, tanpa Hapus. **Disetujui (B).**
7. Pendekatan implementasi: RPC per-baris (bukan replace-all dari UI, bukan generic catch-all). **Disetujui (1).**
8. CSV Mahasiswa kolom **hanya NPM dan Nama Lengkap**. Email / Blok / Keterangan tidak di CSV. **Disetujui (koreksi).**

## Desain

### 1. Tab Berita Acara — tombol Pelaksanaan

Header kanan tab `ba`:

- **Unggah BA Pendukung** (`btn-primary`) — modal yang sudah ada (`openBaUpload`).
- **Ekspor Excel** (`btn-soft`).
- **Tidak ada** tombol Unggah BA Pelaksanaan di header.

Kolom Aksi (desktop + kartu mobile), urutan prioritas tidak berubah:

1. Belum Pendukung → tombol **Unggah Pendukung** (`btn-primary` indigo) → `openBaUpload()`.
2. Eligible Pelaksanaan (keputusan Diterima|ACC) dan belum ada BA Pelaksanaan → tombol **Unggah Pelaksanaan** (`btn-emerald`, hijau, bukan indigo) → `openPelaksanaanPanel(r)`.
3. Selain itu → tautan Lihat file jika ada.

`openPelaksanaanPanel(row)`:

1. `bab.showPanel = true`.
2. Prefill `bab.kategori` dari `row.bagian`: cocokkan ke SGD / KKD / Ujian / Praktikum (plus `bab.subBagian` lab jika Praktikum). Jika tidak cocok, biarkan picker kosong.
3. `scrollIntoView` pada panel sesi (`tab==='ba' && bab.showPanel`).
4. Muat data Bagian jika belum (`loadBagian`).

Panel sesi, Mulai Sesi, picker kegiatan, unggah, Tutup: tidak berubah. Invalid kategori = panel terbuka, admin pilih manual.

### 2. Master Data — layout

Sidebar kiri, urutan kartu:

1. **Mahasiswa** (baru, `bi-mortarboard`) — paling atas
2. Master Kegiatan
3. Master Bagian
4. Master Biaya
5. Config
6. Bagian Staff
7. Pengaturan Bagian (form, bukan tabel)
8. Admin

Panel kanan lebih rapat: header tipis, search, aksi; tabel denser (padding sel lebih kecil, thead sticky). CSS utility baru harus ada di blok `<style>` inline (tidak ada build Tailwind).

Setiap tabel kecuali Pengaturan Bagian:

- Header: search + **Tambah**.
- Kolom **Aksi**: Ubah; Hapus (kecuali Config).
- Modal kecil **satu baris** (bukan editor seluruh tabel). Simpan memanggil RPC per-baris.

Pengaturan Bagian: form toggle/status yang sudah ada, dipadatkan saja. Simpan tetap `saveBagianBaSettings`.

### 3. Mahasiswa

Kolom tampilan: NPM, Nama Lengkap, Email, Blok, Keterangan.

- **Tambah**: modal; NPM wajib unik. Jika NPM sudah ada, RPC gagal (bukan overwrite). Email / Blok / Keterangan opsional.
- **Ubah**: modal; NPM tidak diubah (kunci). Gagal jika NPM tidak ada.
- **Hapus**: konfirmasi NPM + nama. Tidak cascade ke `pengajuan`.
- **Unggah CSV** di header kartu Mahasiswa saja.

CSV:

- Kolom wajib: `NPM`, `Nama Lengkap` (header case-insensitive; alias `npm` / `nama_lengkap` / `Nama` diterima).
- Kolom lain di file diabaikan.
- Upsert by NPM: insert baru; update hanya `nama_lengkap`; `email`, `blok`, `keterangan` tidak disentuh.
- Insert baru: email/blok/keterangan kosong.
- Konfirmasi sebelum tulis: jumlah mahasiswa sekarang vs akan insert / akan update.
- Lewati baris NPM kosong. Tolak jika ada NPM duplikat di dalam file. Maks 5000 baris.

### 4. Tabel master lain (per-baris)

| Kartu | Kunci tulis | Tambah | Ubah | Hapus |
|---|---|---|---|---|
| Kegiatan | `id` integer | ya | ya | ya |
| Bagian | `id` integer | ya | ya | ya |
| Biaya | `id` integer | ya | ya | ya |
| Config | `Key` (tidak diubah saat Ubah) | ya | ya | **tidak** |
| Bagian Staff | `id` integer; email unik | ya | ya | ya |
| Admin | `id` integer | ya | ya | ya |

Password Admin / Staff: field kosong saat Ubah = hash lama tidak diganti; teks baru = di-hash ulang. Kolom Pass/Password di tabel tidak menampilkan hash penuh (placeholder seperti sekarang).

Config: Key unik. Key tidak bisa diganti di Ubah (sama seperti NPM mahasiswa). Tidak ada tombol Hapus di UI dan RPC menolak delete Config. Staff: email tidak boleh duplikat saat Tambah/Ubah.

### 5. API

`getMasterDataMonitor` menambah `mahasiswa` via `toClientRows('mahasiswa', ...)`.

RPC baru (semua `requireAdmin`):

- `saveMahasiswa(row)` — `row.mode` = `insert` | `update`. Insert gagal jika NPM sudah ada. Update gagal jika NPM tidak ada; hanya kolom selain NPM yang diubah. NPM wajib.
- `deleteMahasiswa(npm)`
- `importMahasiswaCsv(rows)` — upsert by NPM; setiap row `{ npm, namaLengkap }`; kembalikan `{ success, inserted, updated, skipped }`.
- `saveMasterRow({ table, row })` — insert jika `row` tanpa `id` (config: tanpa Key yang sudah ada). Update jika `id` ada (config: Key ada). Staff/Admin: password kosong pada update = hash tidak diubah.
- `deleteMasterRow({ table, id })` — hapus by `id` (config: ditolak, meskipun `id`/`key` dikirim).

`table` yang diizinkan: `master_kegiatan`, `master_bagian`, `master_biaya`, `config`, `bagian_staff`, `admin`. Mahasiswa tidak lewat `saveMasterRow`.

RPC replace-all lama tetap di `rpc.js` tetapi UI tidak memanggilnya.

### 6. Error handling

- Gagal RPC → toast error, modal tetap terbuka.
- CSV: toast + jangan tulis jika validasi file gagal (duplikat NPM, >5000, header tidak ada NPM/Nama).
- Hapus: dialog konfirmasi (`dialog` yang sudah ada).
- NPM Tambah yang sudah ada → pesan jelas, tidak overwrite diam-diam (overwrite hanya lewat CSV upsert atau Ubah).

### 7. Testing

- Template (`dashboard-template.test.js`): header BA tidak mengandung Unggah BA Pelaksanaan; Aksi Pelaksanaan class emerald + `openPelaksanaanPanel(r)`; kartu Mahasiswa + Unggah CSV + kolom Aksi; compile Vue tetap.
- RPC/repo: save/delete mahasiswa by NPM; CSV upsert (update tidak mengubah email/blok/keterangan); skip NPM kosong; tolak duplikat NPM di file; Config delete ditolak; Staff/Admin password kosong tidak mengubah hash.
- Tidak ada tes skema BA baru.

### 8. Di luar cakupan

- Rename worker `inhal-poc` / subdomain `prodifkik` (backlog).
- Hapus RPC replace-all lama.
- Cascade hapus mahasiswa ke pengajuan.
- CSV import di tabel selain Mahasiswa.
- Ubah skema `mahasiswa` (kolom tetap npm PK, nama_lengkap, email, blok, keterangan).
- ACC Final, matching BA, heatmap, chip filter.

## Komponen (batas)

| Unit | Tanggung jawab | Bergantung pada |
|---|---|---|
| `openPelaksanaanPanel(row)` | Buka panel, prefill, scroll | `bab`, `loadBagian`, DOM panel |
| Kartu Mahasiswa + CSV parse di klien | UI CRUD + parse CSV + dialog hitung | RPC mahasiswa |
| `saveMahasiswa` / `deleteMahasiswa` / `importMahasiswaCsv` | Tulis D1 `mahasiswa` | `requireAdmin` |
| `saveMasterRow` / `deleteMasterRow` | Tulis satu baris master | `requireAdmin`, hash password |
| Modal satu baris | Form Tambah/Ubah | `saveFn` per kartu |

Setiap unit punya satu tujuan; UI tidak menulis SQL; RPC tidak mengenal CSS.
