# DASHBOARD-INHAL — Aplikasi Pengajuan & Berita Acara Kegiatan INHAL

Sistem informasi pengelolaan pengajuan kegiatan mahasiswa INHAL (registrasi mahasiswa, persetujuan bagian/ACC, berita acara, laporan, pengaturan) berbasis **CodeIgniter 4.4.7** + **MySQL** + **Vue 3 (CDN)**. UI berbahasa Indonesia.

Proyek ini merupakan hasil porting/penyempurnaan dari aplikasi INHAL sebelumnya ke kode bersih (`new-code2`).

## Persyaratan Sistem

- PHP `^7.4 || ^8.0` (direkomendasikan PHP 8.x) dengan ekstensi: `intl`, `mbstring`, `mysqlnd`, `json`, `curl`
- MySQL 5.7+ / 8.0 (utf8mb4)
- Composer
- Node.js (opsional, untuk `node --check` sintaks JS view)

## Instalasi

```bash
# 1. Pasang dependensi PHP
composer install

# 2. Siapkan konfigurasi lingkungan
cp env .env
# lalu sesuaikan app.baseURL dan database.default.* di .env

# 3. Buat database dan impor skema + data awal
mysql -u root < database/inhal.sql
```

Skema dan seed dibawa dalam satu file `database/inhal.sql` (bukan Migrations CI4). Migrasi otomatis tidak dipakai.

### Akun bawaan (seed)

| Peran   | Login                          | Password  |
|---------|--------------------------------|-----------|
| Admin   | (halaman `/login` tab Admin)   | `admin123`|
| Bagian  | `staf.sgd@inhal.test` (SGD)    | `admin123`|

### Menjalankan server pengembangan

```bash
php -S localhost:8080 -t public
```

Arahkan browser ke `http://localhost:8080`. Pastikan `app.baseURL` di `.env` sesuai.

### Menjalankan test

Suite PHPUnit memakai database terpisah `inhal_test` (dibuat dengan cara yang sama dari `database/inhal.sql`; dikonfigurasi via env `database.tests.*` di `phpunit.xml.dist`).

```bash
mysql -u root < database/inhal.sql        # siapkan ulang database pengembangan bila perlu
# buat database test bila belum ada:
mysql -u root -e "CREATE DATABASE IF NOT EXISTS inhal_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root inhal_test < database/inhal.sql

vendor/bin/phpunit tests
```

## Halaman Aplikasi

| Rute          | Halaman                                                       | Akses          |
|---------------|---------------------------------------------------------------|----------------|
| `/`           | Beranda registrasi mahasiswa                                  | Publik         |
| `/portal`     | Portal mahasiswa (unggah bukti, cek status)                   | Publik (via NPM) |
| `/bagian`     | Login + ruang kerja bagian (BA, upload berita acara)          | Bagian/Admin   |
| `/dashboard`  | Dashboard admin (daftar & status pengajuan)                   | Admin          |
| `/laporan`    | Laporan                                                       | Admin          |
| `/pengaturan` | Pengaturan 11 tab (Umum, Matakuliah, Master, Bagian, Biaya, Pengguna, Email, Nomor Surat, Upload, Status, Audit) | Admin |

Endpoints API berada di bawah `/api/...` dan seluruhnya dibungkus filter `admin`/`bagian` kecuali yang memang publik (registrasi, opsi pendaftaran, portal, login). Respons memakai kontrak:

```json
{ "ok": true,  "data": { ... } }
{ "ok": false, "message": "..." }
```

Rute `/login` (POST) dan seluruh halaman form memakai proteksi CSRF; request JSON API dikecualikan (`api/*`).

## Struktur Proyek

```
new-code2/
├─ app/
│  ├─ Config/            # Routes, Database, Filters, CSRF, dst.
│  ├─ Controllers/
│  │  ├─ Auth.php, Logout.php, PageController.php, FileApi.php
│  │  └─ Api/            # PengajuanApi, PortalApi, BagianApi, DashboardApi,
│  │                     # LaporanApi, BeritaAcaraApi, PengaturanApi, MasterApi
│  ├─ Database/          # (Migrations/Seeds kosong; skema via database/inhal.sql)
│  ├─ Filters/           # AdminFilter, BagianFilter, dll.
│  ├─ Helpers/           # inhal_helper (inhal_id, config_get, audit_log_add, fileLink)
│  ├─ Libraries/         # AuthService, BiayaService, NomorSuratService, UploadService,
│  │                     # EmailAccService, EmailBagianService, dsb.
│  ├─ Models/            # Model per tabel (pengajuan, detail_kegiatan, berita_acara, ...)
│  └─ Views/
│     ├─ layouts/        # kerangka layout
│     └─ pages/          # index (registrasi), portal, bagian, dashboard,
│                        # laporan, detail-laporan, pengaturan
├─ database/inhal.sql    # skema + seed lengkap
├─ public/               # front controller + aset
├─ tests/                # PHPUnit (unit + feature)
└─ writable/uploads/     # file BA/bukti/ACC/final (acc, ba, bukti, final)
```

## Konvensi Penting

- **Bahasa kode & UI**: Indonesia; komentar ringkas. Ringkasan/komunikasi teknis bebas.
- **DB**: tabel `pengajuan`, `detail_kegiatan`, `status_history`, `check_data` (termasuk override `BIAYA-OVERRIDE`), `berita_acara` + `berita_acara_admin` (+ `_peserta`), `master_*`, `config` (key pasangan), `email_templates`, `audit_log`, `log_upload`, `mahasiswa`, `admin`, `bagian_staff`.
- **Biaya**: `BiayaService` memakai `master_biaya` berdasarkan nama kegiatan; override per pengajuan (tabel `check_data`, detail `BIAYA-OVERRIDE`) menang atas master.
- **Status pengajuan**: `Menunggu → Diterima/Ditolak → ACC → Dibatalkan`. Nomor surat dibuat tipe `INHAL` saat transisi ke `Diterima` (tidak diulang saat `ACC`).
- **File**: disimpan di `writable/uploads/{acc,ba,bukti,final}/`. Unduhan memakai rute terautentikasi `GET /files/{jenis}/{idPengajuan|baId}` (`FileApi`), bukan path lokal mentah. Daftar MIME yang diizinkan dikelola pada tab Pengaturan → Upload (`UPLOAD_MIME_WHITELIST` di tabel `config`).
- **Email**: dikirim lewat SMTP yang dikonfigurasi di Pengaturan → Email; bila gagal/absurd, status dicatat `status_notifikasi_email=Gagal` + pesan error (tidak dipalsukan sukses).
- **Audit**: aksi admin/bagian tercatat di `audit_log` melalui helper `audit_log_add`.

## Troubleshooting

- Halaman mengarah `/login` padahal bukan admin → pastikan sesi login admin aktif (halaman `/dashboard`, `/laporan`, `/pengaturan` khusus admin).
- Login API `403` → sertakan header `X-CSRF-TOKEN` (nilai dari `<meta name="csrf">`) dan `X-Requested-With: XMLHttpRequest`, sesuai perilaku form `/login`.
- Nama DB test: `inhal_test` harus diimpor ulang setelah ada perubahan `database/inhal.sql`.
