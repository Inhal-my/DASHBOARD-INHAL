# Desain: DASHBOARD-INHAL — Port CodeIgniter 4.4.7 + MySQL (`new-code2`)

Tanggal: 2026-09-07
Status: Disetujui user (bagian 1–6)
Sumber: folder `new-code1/` (Google Apps Script + Sheets)
Tujuan: aplikasi web setara (parity penuh) di `new-code2/`

## 1. Keputusan yang sudah disetujui

| Keputusan | Pilihan |
|---|---|
| Framework | CodeIgniter 4.4.7, PHP 8.1, MySQL |
| Cakupan | Parity penuh seluruh fitur `new-code1` |
| File | Lokal `writable/uploads/` (bukan Google Drive) |
| Frontend | Vue 3 (CDN, tanpa Vite) + Tailwind, halaman terpisah |
| Arsitektur | Pendekatan A: halaman Vue per page + REST JSON CI4 |
| Tambahan | Halaman Pengaturan admin untuk seluruh fungsi |

Tidak dalam lingkup: SPA Vite, Google Drive API, migrasi data otomatis dari Google Sheets (seed MySQL terpisah).

## 2. Arsitektur

Folder `new-code2/` adalah project CodeIgniter 4.4.7 mandiri.

```
new-code2/
  app/Controllers/PageController.php      render halaman Vue
  app/Controllers/Api/                    REST JSON
  app/Models/                             satu model per tabel
  app/Libraries/AuthService.php
  app/Libraries/UploadService.php
  app/Libraries/EmailAccService.php
  app/Libraries/NomorSuratService.php
  app/Libraries/BiayaService.php
  app/Filters/AdminAuth.php
  app/Filters/BagianAuth.php
  app/Views/pages/index.php
  app/Views/pages/portal.php
  app/Views/pages/bagian.php
  app/Views/pages/dashboard.php
  app/Views/pages/detail-laporan.php
  app/Views/pages/pengaturan.php
  writable/uploads/{acc,bukti,ba,final}/
  database/inhal.sql                      skema + seed
  public/                                 index.php, assets
```

Alur:

1. Browser membuka rute halaman PHP; server merender HTML + Vue 3 CDN + Tailwind (inline/compiled), sama pola `new-code1` `?page=`.
2. Vue memanggil `/api/...` dengan session cookie CI4 (bukan `google.script.run`).
3. File disimpan di `writable/uploads/{acc,bukti,ba,final}/`; path relatif disimpan di MySQL.
4. Email ACC lewat SMTP `app/Config/Email.php` + tabel `email_templates`.
5. Auth: session CI4. Admin = nama + password. Staf bagian = email + password. Mahasiswa tidak login; identifikasi NPM.

Routing halaman:

| URL | View | Peran |
|---|---|---|
| `/` | `pages/index.php` | Publik: pendaftaran |
| `/portal` | `pages/portal.php` | Publik: portal mahasiswa |
| `/bagian` | `pages/bagian.php` | Staf bagian |
| `/dashboard` | `pages/dashboard.php` | Admin operasional |
| `/laporan` | `pages/detail-laporan.php` | Admin laporan |
| `/pengaturan` | `pages/pengaturan.php` | Admin konfigurasi |

Alias: `/admin` redirect ke `/dashboard`.

## 3. Database MySQL

File: `new-code2/database/inhal.sql`. Engine InnoDB, charset `utf8mb4`, collation `utf8mb4_unicode_ci`. Setiap tabel bisnis punya `id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`. Timestamp: `created_at` / `updated_at` DATETIME. Kolom sheet GAS yang namanya spasi/simbol dipetakan ke `snake_case`.

### 3.1 `mahasiswa`

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | BIGINT PK AI | |
| npm | VARCHAR(20) UNIQUE NOT NULL | |
| nama_lengkap | VARCHAR(191) NOT NULL | |
| email | VARCHAR(191) NULL | |
| blok | VARCHAR(64) NULL | |
| keterangan | TEXT NULL | |

### 3.2 `pengajuan`

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | BIGINT PK AI | |
| id_pengajuan | VARCHAR(32) UNIQUE NOT NULL | format `INH-YYYYMMDD-XXXX` |
| timestamp | DATETIME NOT NULL | waktu daftar |
| npm | VARCHAR(20) NOT NULL | index |
| nama_lengkap | VARCHAR(191) NOT NULL | |
| email | VARCHAR(191) NOT NULL | wajib, divalidasi |
| no_hp_wa | VARCHAR(32) NOT NULL | wajib, divalidasi |
| blok | VARCHAR(64) NULL | index |
| jenis_kegiatan | VARCHAR(64) NULL | Ujian/SGD/KKD/Praktikum |
| matakuliah | VARCHAR(191) NULL | dari master_matakuliah.nama |
| dosen | VARCHAR(191) NULL | |
| tanggal_pelaksanaan | DATE NULL | |
| keterangan | TEXT NULL | tidak pernah di-overwrite UI |
| link_surat_keterangan | VARCHAR(512) NULL | |
| status | VARCHAR(32) NOT NULL DEFAULT 'Menunggu' | index; nilai: Menunggu, Diterima, Ditolak, ACC, Dibatalkan |
| catatan_admin | TEXT NULL | hanya ditimpa jika payload non-kosong |
| notifikasi_terkirim_pada | DATETIME NULL | |
| status_notifikasi_email | VARCHAR(32) NULL | |
| error_notifikasi_email | TEXT NULL | |
| lampiran_email | VARCHAR(512) NULL | |
| nomor_surat | VARCHAR(64) NULL | |
| path_acc_inhal | VARCHAR(512) NULL | relatif ke writable |
| path_bukti_bayar | VARCHAR(512) NULL | |
| path_final | VARCHAR(512) NULL | |
| status_info_bagian | VARCHAR(32) NULL | Belum dikirim / Terkirim / Gagal |
| waktu_info_bagian | DATETIME NULL | |
| email_bagian | VARCHAR(191) NULL | |
| catatan_info_bagian | TEXT NULL | |
| created_at, updated_at | DATETIME | |

Index: `(npm)`, `(status)`, `(blok)`, `(tanggal_pelaksanaan)`.

### 3.3 `detail_kegiatan`

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | BIGINT PK AI | |
| pengajuan_id | BIGINT NOT NULL FK → pengajuan.id ON DELETE CASCADE | index |
| id_pengajuan | VARCHAR(32) NOT NULL | denormalisasi untuk lookup |
| timestamp | DATETIME NOT NULL | |
| jenis_kegiatan | VARCHAR(64) NULL | |
| pilihan | VARCHAR(191) NULL | |
| detail | VARCHAR(191) NULL | |
| tanggal_pelaksanaan | DATE NULL | |
| bagian | VARCHAR(191) NULL | |

### 3.4 `status_history`

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | BIGINT PK AI | |
| pengajuan_id | BIGINT NOT NULL FK | index |
| id_pengajuan | VARCHAR(32) NOT NULL | |
| timestamp | DATETIME NOT NULL | |
| status | VARCHAR(32) NOT NULL | |
| catatan | TEXT NULL | |
| actor_email | VARCHAR(191) NULL | |

### 3.5 `check_data`

Parity sentinel biaya override: baris dengan `detail = 'BIAYA-OVERRIDE'`, `pilihan` kosong, `npm` kosong. Unique logis `(pengajuan_id, npm, detail, pilihan)`.

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | BIGINT PK AI | |
| check_id | VARCHAR(32) UNIQUE NOT NULL | |
| pengajuan_id | BIGINT NULL FK | index |
| id_pengajuan | VARCHAR(32) NULL | |
| timestamp | DATETIME NOT NULL | |
| npm | VARCHAR(20) NULL | |
| nama_lengkap | VARCHAR(191) NULL | |
| blok | VARCHAR(64) NULL | |
| jenis_kegiatan | VARCHAR(64) NULL | |
| pilihan | VARCHAR(191) NULL | |
| detail | VARCHAR(191) NULL | sentinel `BIAYA-OVERRIDE` |
| tanggal_pelaksanaan | DATE NULL | |
| bagian | VARCHAR(191) NULL | |
| dosen | VARCHAR(191) NULL | |
| hadir | TINYINT(1) NULL | |
| catatan | TEXT NULL | |
| biaya | DECIMAL(15,2) NULL | |
| created_at, updated_at | DATETIME | |

### 3.6 Master

`master_kegiatan`: `kategori VARCHAR(64)`, `nilai VARCHAR(191)`, unique `(kategori, nilai)`. Kategori: Blok, Ujian, SGD, Detail SGD, KKD, Detail KKD, Lab, Kegiatan Lab, Dosen, Matakuliah.

`master_matakuliah`: `kode VARCHAR(32)`, `nama VARCHAR(191) NOT NULL`, `blok VARCHAR(64) NULL`, `sks TINYINT UNSIGNED NULL`, `aktif TINYINT(1) DEFAULT 1`, unique `(kode)` jika kode diisi. Dipakai dropdown pendaftaran/portal dan dikelola di tab Pengaturan → Matakuliah.

`master_bagian`: `lab`, `kegiatan_lab`, `bagian`, `email`.

`master_biaya`: `kegiatan VARCHAR(191)`, `biaya DECIMAL(15,2) NOT NULL`.

`config`: `config_key VARCHAR(64) UNIQUE`, `config_value TEXT`. Key awal: `BUKTI_MODE` (`strict`/`lenggang`), `BAGIAN_BA_STATUSES` (JSON array), `BAGIAN_BA_FINAL_ONLY` (`0`/`1`), `APP_NAME`, `TIMEZONE` (`Asia/Jakarta`), `UPLOAD_MAX_BYTES`, `UPLOAD_MIME_WHITELIST` (JSON).

`nomor_surat`: `type VARCHAR(32)`, `tahun SMALLINT`, `last_number INT`, unique `(type, tahun)`.

### 3.7 Auth, audit, upload log

`admin`: `nama VARCHAR(191)`, `password_hash VARCHAR(255)` (bcrypt). Bukan plaintext.

`bagian_staff`: `email VARCHAR(191) UNIQUE`, `kategori VARCHAR(64)`, `nama VARCHAR(191)`, `password_hash VARCHAR(255)`.

Session: tabel native CI4 `ci_sessions` (database handler).

`audit_log`: `timestamp`, `actor_email`, `aksi`, `target`, `detail`, `alasan`.

`log_upload`: `timestamp`, `pengajuan_id`, `id_pengajuan`, `npm`, `nama_lengkap`, `blok`, `jenis_kegiatan`, `detail`, `tanggal`, `path_acc_inhal`, `path_bukti_bayar`.

### 3.8 Berita Acara (tetap dipisah)

`berita_acara` + `berita_acara_peserta` (`sumber` default `Bagian`).

`berita_acara_admin` + `berita_acara_admin_peserta` (`sumber` default `Admin`).

Kolom header BA: `ba_id VARCHAR(32) UNIQUE`, `bagian`, `blok`, `nama_kegiatan`, `tanggal_pelaksanaan DATE`, `jumlah_peserta INT`, `file_name`, `file_path`, `catatan`, `sumber`.

Peserta: `ba_id`, `npm`, `nama_lengkap`, `blok`, `bagian`, `status_pengajuan`.

Unique BA bagian: `(bagian, blok, nama_kegiatan, tanggal_pelaksanaan)`. Perbandingan tanggal selalu DATE-only (tanpa waktu), setara `_dateOnly()` GAS.

BA admin: tidak unique kombinasi yang sama; wajib `jumlah_peserta >= 1`.

### 3.9 Email templates (baru untuk halaman pengaturan)

`email_templates`: `kode VARCHAR(64) UNIQUE` (`acc_diterima`, `acc_ditolak`, `acc_final`), `subjek VARCHAR(191)`, `body_html MEDIUMTEXT`, `aktif TINYINT(1) DEFAULT 1`.

Seed isi dari `template-acc-diterima-ditolak.html` dan `template-acc-final.html`.

### 3.10 Resolusi biaya

Urutan: override `check_data` (`detail='BIAYA-OVERRIDE'` untuk `pengajuan_id`) → fallback `master_biaya` by nama kegiatan. Menulis biaya kosong menghapus baris override.

## 4. Halaman, peran, API

Semua API JSON: sukses `{ ok: true, data }`, gagal `{ ok: false, message }`. Validasi field: HTTP 422 `{ ok: false, message, errors: {field: msg} }`. Duplikat: HTTP 409. Tanpa sesi: HTTP 401. CSRF token CI4 pada POST/PUT/DELETE.

Wrapper frontend `run(path, payload)` mengirim cookie session otomatis (fetch `credentials: 'same-origin'`).

### 4.1 Pendaftaran `/` (publik)

- `GET /api/registration-options` — master blok, jenis, dosen, kegiatan.
- `GET /api/mahasiswa/:npm` — nama jika ada.
- `POST /api/pengajuan` — wajib NPM, nama, email aktif, no HP/WA valid; cek duplikat di backend (npm + jenis + tanggal + detail kegiatan); status awal `Menunggu`; tulis `status_history`.

### 4.2 Portal `/portal` (publik, identifikasi NPM)

- `GET /api/portal/:npm` — daftar pengajuan milik NPM. **Tidak** mengirim kolom biaya, **tidak** mengirim path/file ACC/bukti yang sudah terkirim.
- `POST /api/pengajuan` — sama daftar.
- `POST /api/pengajuan/:id/bukti` — upload ACC INHAL + bukti bayar.

Validasi bukti: `BUKTI_MODE=lenggang` terima file whitelist apa pun; `strict` menuntut PDF (`%PDF`), ekstraksi teks, regex NPM 10 digit cocok. Pesan ke mahasiswa netral: sukses "cek berkas valid", gagal "cek berkas gagal, gunakan file pdf dari portal mahasiswa".

### 4.3 Panel bagian `/bagian`

- `POST /api/auth/bagian` — email + password.
- `POST /api/auth/logout`
- `GET /api/bagian/bootstrap`
- `GET /api/bagian/config`
- `GET /api/bagian/ba`
- `POST /api/bagian/ba` — multipart file + peserta. Tolak duplikat (bagian+blok+nama_kegiatan+tanggal DATE-only). Validasi status peserta vs `BAGIAN_BA_STATUSES`. Jika `BAGIAN_BA_FINAL_ONLY=1`, kegiatan tanpa ACC final diblokir.

Sesi bagian dipulihkan dari cookie CI4 (bukan localStorage token GAS). Toast error/sukses dirender.

### 4.4 Dashboard `/dashboard` (admin)

Login `POST /api/auth/admin`. Operasional saja; master data pindah ke `/pengaturan`.

Tab: Pengajuan, Statistik, Laporan Bagian (matriks + badge BA ada / ACC Final + link file), Berita Acara Admin, Berita Acara Bagian (bypass sesi bagian lewat `POST /api/admin/bagian-bypass`).

Mutasi:

- `GET /api/dashboard/bootstrap`, `GET /api/pengajuan`, `GET /api/pengajuan/:id`
- `PUT /api/pengajuan/:id/status` — catatan_admin hanya jika non-kosong
- `PUT /api/pengajuan/:id`, `PUT /api/pengajuan/:id/detail/:detailId`, `DELETE` detail/pengajuan
- `PUT /api/pengajuan/:id/biaya` — override
- `POST /api/admin/ba`, `DELETE /api/admin/ba/:id` — BA admin, tolak 0 peserta
- Email: `POST /api/pengajuan/:id/email-status`, `POST /api/pengajuan/:id/email-final`, `POST /api/email/bulk-final`, `POST /api/pengajuan/:id/email-bagian`

Filter `AdminAuth` pada seluruh rute `/api/dashboard/*`, `/api/pengajuan` mutasi, `/api/admin/*`, `/api/laporan/*`, `/api/pengaturan/*`.

### 4.5 Laporan `/laporan` (admin)

Satu panggilan `GET /api/laporan/bootstrap`: summary, rows (pengajuan+detail+history+biaya ter-resolve), beritaAcara, dosen, blok, bagian, masterBiaya.

Tab frontend: Laporan Bagian (matriks kelengkapan, kolom biaya, subtotal, grand total), Laporan Dosen (matriks jumlah BA, chip biaya). Export XLSX client-side SheetJS CDN on-demand; kolom Link jadi hyperlink.

### 4.6 Pengaturan `/pengaturan` (admin) — tambahan disetujui

Dashboard tidak lagi menyimpan master. Semua konfigurasi di halaman ini.

| Tab | Isi | API |
|---|---|---|
| Umum | APP_NAME, TIMEZONE, BUKTI_MODE, BAGIAN_BA_STATUSES, BAGIAN_BA_FINAL_ONLY | `GET/PUT /api/pengaturan/umum` |
| Master Kegiatan | kategori + nilai (Blok, Ujian, SGD, KKD, Lab, Dosen, dll.) | `GET/PUT /api/pengaturan/kegiatan` |
| Matakuliah | CRUD kode, nama, blok, SKS, aktif — dropdown daftar/portal | `GET/PUT /api/pengaturan/matakuliah` |
| Master Bagian | lab, kegiatan_lab, bagian, email | `GET/PUT /api/pengaturan/bagian` |
| Master Biaya | kegiatan + nominal | `GET/PUT /api/pengaturan/biaya` |
| Pengguna | CRUD admin + staf bagian (hash bcrypt) | `GET/PUT /api/pengaturan/pengguna` |
| Email | SMTP via env/config file + CRUD `email_templates` + on/off | `GET/PUT /api/pengaturan/email` |
| Nomor Surat | type, tahun, last_number | `GET/PUT /api/pengaturan/nomor-surat` |
| Upload | UPLOAD_MAX_BYTES, MIME whitelist | `GET/PUT /api/pengaturan/upload` |
| Alur Status | daftar status (read-mostly, seed tetap), siapa boleh ubah (config JSON) | `GET/PUT /api/pengaturan/status` |
| Audit | daftar `audit_log` + diagnostik hitung baris tabel | `GET /api/pengaturan/audit` |

Setiap PUT menulis `audit_log`. Password baru di-hash; response tidak mengembalikan hash.

## 5. File upload & unduh

Direktori: `writable/uploads/acc/`, `bukti/`, `ba/`, `final/`. Nama file: `{id_pengajuan}_{jenis}_{uniqid}.{ext}`. Sanitize: buang path, whitelist ekstensi dari config.

Unduh: `GET /files/{jenis}/{id}` lewat controller. Admin/bagian: session. Mahasiswa: hanya bukti milik pengajuan NPM yang sama, tanpa mengekspos ACC orang lain. Bukan document root langsung ke `writable/`.

## 6. Email

Library `EmailAccService` memakai template DB. Variabel: `{NAMA}`, `{NPM}`, `{STATUS}`, `{NOMOR_SURAT}`, `{CATATAN}`. Gagal kirim: `status_notifikasi_email=Gagal`, simpan error, pengajuan tetap tersimpan. SMTP di `app/Config/Email.php` / env (`email.smtpHost`, dll.) — bukan hardcode.

## 7. Keamanan

- Password bcrypt (`PASSWORD_DEFAULT`).
- CSRF CI4 pada mutasi.
- Session cookie HttpOnly; CSRF cookie sesuai CI4.
- Upload: MIME + ukuran + nama sanitasi; tolak `php/phtml/phar`.
- Portal tidak expose biaya dan file ACC/bukti terkirim.
- Rate limit login: 5 gagal / 15 menit per IP+identifier → 429.
- `adminBagianBypass` hanya admin; membuat session role bagian di memori server (CI4 session key terpisah `bab_session`), bukan localStorage.

## 8. UI

Vue 3 global build CDN, Tailwind compiled inline per halaman (pola `new-code1`). Font Plus Jakarta Sans. Palet indigo `#4f46e5` → violet. Status: amber/emerald/rose/indigo/slate. Navbar + link antar halaman sesuai peran. Modal dashboard memakai overlay/panel/body (perbaikan mobile yang sudah ada). Halaman pengaturan: tab pill sama pola laporan.

## 9. Seed

`database/inhal.sql` berisi:

- 1 admin: nama `admin`, password `admin123` (hash bcrypt) — ganti setelah install.
- 1 staf bagian contoh (kategori SGD).
- Master kegiatan/bagian/biaya minimal agar dropdown hidup.
- Config default: `BUKTI_MODE=strict`, `BAGIAN_BA_FINAL_ONLY=0`, `BAGIAN_BA_STATUSES=["Diterima","ACC"]`.
- 3 template email.
- 2–3 pengajuan contoh (Menunggu, Diterima, ACC) + 1 detail kegiatan.

Tidak ada migrasi otomatis dari Spreadsheet Google.

## 10. Testing

- PHPUnit model: CRUD pengajuan, resolusi biaya override vs master, duplikat BA DATE-only, validasi email/HP, catatan_admin tidak tertimpa jika kosong.
- Feature API: daftar publik, login admin/bagian sukses/gagal, mutasi tanpa sesi 401, MIME ditolak, BA 0 peserta ditolak, portal tidak berisi biaya.
- Frontend: `node -e` `new Function` pada blok JS tiap view.
- Smoke manual 6 halaman setelah deploy lokal.

## 11. Konvensi implementasi

- Bahasa UI Indonesia (label, pesan error) seperti `new-code1`.
- Tidak menambah komentar kode kecuali diminta.
- Tidak hardcode secret; DB/SMTP lewat `env`.
- File GAS `new-code1/` tidak diubah.
- Preview web: reverse proxy `/api` ke PHP built-in/Apache di satu port (aturan frontend-backend).

## 12. Kriteria selesai

1. Folder `new-code2/` berisi CI 4.4.7 yang boot.
2. `database/inhal.sql` import tanpa error di MySQL 8 / MariaDB 10.6+.
3. Enam halaman di atas berfungsi dengan API.
4. Parity aturan bisnis di bagian 4 (duplikat, bukti, BA, biaya, catatan, portal tanpa biaya).
5. Halaman pengaturan mengontrol seluruh config/master/pengguna/email/nomor surat/upload/status/audit.
6. Upload file lokal + unduh terautentikasi.
7. Test PHPUnit inti lulus.
