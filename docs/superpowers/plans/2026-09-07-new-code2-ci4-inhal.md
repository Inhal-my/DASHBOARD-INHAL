# Port INHAL ke CodeIgniter 4.4.7 + MySQL (`new-code2`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun aplikasi web DASHBOARD-INHAL (port penuh `new-code1/`) di folder `new-code2/` berbasis CodeIgniter 4.4.7 + PHP 8.1 + MySQL, termasuk halaman **Pengaturan** untuk mengelola master data (salah satunya menambah **Matakuliah**) dan seluruh konfigurasi.

**Architecture:** CI4 MVC. `PageController` merender view berisi Vue 3 CDN; `app/Controllers/Api/*` menyajikan REST JSON; `app/Models/*` satu per tabel; `app/Libraries/*` memegang logika (auth, upload, email, nomor surat, biaya). File disimpan di `writable/uploads/{acc,bukti,ba,final}/`; path di MySQL. Sesi CI4 database handler. Frontend fetch `credentials: 'same-origin'` dengan CSRF header.

**Tech Stack:** CodeIgniter 4.4.7, PHP 8.1, MySQL 8/MariaDB 10.6+, Vue 3 global build (CDN), Tailwind CSS (inline), SheetJS (CDN on-demand).

**Spec:** `docs/superpowers/specs/2026-09-07-new-code2-ci4-inhal-design.md`

## Global Constraints

- Seluruh kode baru berada di `new-code2/`; folder `new-code1/` tidak boleh diubah.
- Framework: CodeIgniter 4.4.7 (`codeigniter4/framework:4.4.7`), PHP >= 8.1.
- DB: MySQL 8 / MariaDB 10.6+, InnoDB, `utf8mb4_unicode_ci`.
- Nama tabel `snake_case`; tiap tabel punya `id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`.
- Bahasa UI = Indonesia; label/pesan error konsisten dengan `new-code1`.
- Password admin/staf di-hash bcrypt (`password_hash`, `PASSWORD_DEFAULT`); tidak pernah plaintext.
- Tidak ada secret hardcode; DB/SMTP/App lewat `env`.
- API JSON: sukses `{ ok:true, data }`, gagal `{ ok:false, message }`; validasi field 422 `+errors`, duplikat 409, tanpa sesi 401.
- Mutasi wajib filter CSRF + filter auth (admin/bagian sesuai peran).
- `new-code2/database/inhal.sql` harus idempotent import (DROP IF EXISTS lalu CREATE).
- Commit message `feat(scope): ...`; jangan commit ke git tanpa instruksi user.

---

### Task 1: Scaffold project CodeIgniter 4.4.7 + struktur dasar

**Files:**
- Create: `new-code2/` (seluruh tree project CI4)
- Modify: `new-code2/.env` (dari `.env.example`)
- Modify: `new-code2/app/Config/Routes.php`, `Database.php`, `Email.php`, `Session.php`, `App.php`, `Filters.php`
- Modify: `new-code2/public/index.php` (env APP_ENV)
- Create: `new-code2/writable/uploads/acc`, `bukti`, `ba`, `final` (+ `.htaccess` deny)

**Interfaces:**
- Produces: project CI4 bootable di `public/`; konstanta helper (lihat Task 2).

- [ ] **Step 1: Buat project CI 4.4.7**

```bash
cd /workspace
composer create-project codeigniter4/appstarter:4.4.7 new-code2 --no-interaction
cd new-code2 && composer require codeigniter4/framework:4.4.7 --no-interaction
```

Jika tidak ada akses network, fallback: salin starter apa pun yang tersedia di vendor cache dan samakan versi `composer.json` menjadi `codeigniter4/framework:4.4.7`, lalu `composer update`.

- [ ] **Step 2: Verifikasi boot**

```bash
cd /workspace/new-code2 && php public/index.php 2>&1 | head -5
```

Expected: tidak ada fatal error (output bisa "404" atau blank bersih — tanpa stack trace).

- [ ] **Step 3: Siapkan `.env`**

Salin `.env.example` ke `.env`, set:

```
CI_ENVIRONMENT = development
app.baseURL = 'http://localhost:8080/'
database.default.hostname = 127.0.0.1
database.default.database = inhal
database.default.username = root
database.default.password =
database.default.DBDriver = MySQLi
database.default.DBPrefix =
```

- [ ] **Step 4: Aktifkan session database + helper base**

`app/Config/Session.php`: `driver = 'CodeIgniter\Session\Handlers\DatabaseHandler'`, `tableName = 'ci_sessions'`, `expiration = 7200`, cookie `httponly=true`, `samesite='Lax'`.

`app/Config/Filters.php` `$aliases` daftarkan filter (dibuat di Task 5): `admin`, `bagian`, `csrf` (bawaan aktif). `app/Config/App.php` `$charset='UTF-8'`, `$defaultLocale='id'`.

- [ ] **Step 5: Buat direktori upload dengan deny**

```bash
mkdir -p new-code2/writable/uploads/acc new-code2/writable/uploads/bukti new-code2/writable/uploads/ba new-code2/writable/uploads/final
```

Buat `new-code2/writable/uploads/.htaccess`: `Deny from all` (Apache) — akses file selalu lewat controller.

- [ ] **Step 6: Verifikasi struktur**

Run: `ls new-code2/app/Config/Routes.php new-code2/.env` — kedua file ada.

---

### Task 2: Skema database `database/inhal.sql` + import test

**Files:**
- Create: `new-code2/database/inhal.sql`

**Interfaces:**
- Produces: seluruh tabel; kolom nama persis seperti dipakai model (Task 3).

- [ ] **Step 1: Tulis `database/inhal.sql`**

Isi penuh (skema dari spec bagian 3; tabel: `mahasiswa`, `pengajuan`, `detail_kegiatan`, `status_history`, `check_data`, `master_kegiatan`, `master_matakuliah`, `master_bagian`, `master_biaya`, `config`, `nomor_surat`, `admin`, `bagian_staff`, `audit_log`, `log_upload`, `berita_acara`, `berita_acara_peserta`, `berita_acara_admin`, `berita_acara_admin_peserta`, `email_templates`, `ci_sessions`).

```sql
CREATE DATABASE IF NOT EXISTS inhal DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inhal;

DROP TABLE IF EXISTS mahasiswa;
CREATE TABLE mahasiswa (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  npm VARCHAR(20) NOT NULL,
  nama_lengkap VARCHAR(191) NOT NULL,
  email VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  keterangan TEXT NULL,
  UNIQUE KEY uq_mahasiswa_npm (npm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS pengajuan;
CREATE TABLE pengajuan (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_pengajuan VARCHAR(32) NOT NULL,
  timestamp DATETIME NOT NULL,
  npm VARCHAR(20) NOT NULL,
  nama_lengkap VARCHAR(191) NOT NULL,
  email VARCHAR(191) NOT NULL,
  no_hp_wa VARCHAR(32) NOT NULL,
  blok VARCHAR(64) NULL,
  jenis_kegiatan VARCHAR(64) NULL,
  matakuliah VARCHAR(191) NULL,
  dosen VARCHAR(191) NULL,
  tanggal_pelaksanaan DATE NULL,
  keterangan TEXT NULL,
  link_surat_keterangan VARCHAR(512) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Menunggu',
  catatan_admin TEXT NULL,
  notifikasi_terkirim_pada DATETIME NULL,
  status_notifikasi_email VARCHAR(32) NULL,
  error_notifikasi_email TEXT NULL,
  lampiran_email VARCHAR(512) NULL,
  nomor_surat VARCHAR(64) NULL,
  path_acc_inhal VARCHAR(512) NULL,
  path_bukti_bayar VARCHAR(512) NULL,
  path_final VARCHAR(512) NULL,
  status_info_bagian VARCHAR(32) NULL,
  waktu_info_bagian DATETIME NULL,
  email_bagian VARCHAR(191) NULL,
  catatan_info_bagian TEXT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_pengajuan_id (id_pengajuan),
  KEY idx_pengajuan_npm (npm),
  KEY idx_pengajuan_status (status),
  KEY idx_pengajuan_blok (blok),
  KEY idx_pengajuan_tanggal (tanggal_pelaksanaan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS detail_kegiatan;
CREATE TABLE detail_kegiatan (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pengajuan_id BIGINT UNSIGNED NOT NULL,
  id_pengajuan VARCHAR(32) NOT NULL,
  timestamp DATETIME NOT NULL,
  jenis_kegiatan VARCHAR(64) NULL,
  pilihan VARCHAR(191) NULL,
  detail VARCHAR(191) NULL,
  tanggal_pelaksanaan DATE NULL,
  bagian VARCHAR(191) NULL,
  KEY idx_detail_pengajuan (pengajuan_id),
  KEY idx_detail_id_pengajuan (id_pengajuan),
  CONSTRAINT fk_detail_pengajuan FOREIGN KEY (pengajuan_id) REFERENCES pengajuan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS status_history;
CREATE TABLE status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pengajuan_id BIGINT UNSIGNED NOT NULL,
  id_pengajuan VARCHAR(32) NOT NULL,
  timestamp DATETIME NOT NULL,
  status VARCHAR(32) NOT NULL,
  catatan TEXT NULL,
  actor_email VARCHAR(191) NULL,
  KEY idx_history_pengajuan (pengajuan_id),
  KEY idx_history_id_pengajuan (id_pengajuan),
  CONSTRAINT fk_history_pengajuan FOREIGN KEY (pengajuan_id) REFERENCES pengajuan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS check_data;
CREATE TABLE check_data (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  check_id VARCHAR(32) NOT NULL,
  pengajuan_id BIGINT UNSIGNED NULL,
  id_pengajuan VARCHAR(32) NULL,
  timestamp DATETIME NOT NULL,
  npm VARCHAR(20) NULL,
  nama_lengkap VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  jenis_kegiatan VARCHAR(64) NULL,
  pilihan VARCHAR(191) NULL,
  detail VARCHAR(191) NULL,
  tanggal_pelaksanaan DATE NULL,
  bagian VARCHAR(191) NULL,
  dosen VARCHAR(191) NULL,
  hadir TINYINT(1) NULL,
  catatan TEXT NULL,
  biaya DECIMAL(15,2) NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_check_id (check_id),
  KEY idx_check_pengajuan (pengajuan_id),
  KEY idx_check_override (pengajuan_id, detail)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS master_kegiatan;
CREATE TABLE master_kegiatan (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kategori VARCHAR(64) NOT NULL,
  nilai VARCHAR(191) NOT NULL,
  UNIQUE KEY uq_master_kegiatan (kategori, nilai)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS master_matakuliah;
CREATE TABLE master_matakuliah (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode VARCHAR(32) NULL,
  nama VARCHAR(191) NOT NULL,
  blok VARCHAR(64) NULL,
  sks TINYINT UNSIGNED NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_matakuliah_kode (kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS master_bagian;
CREATE TABLE master_bagian (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lab VARCHAR(191) NULL,
  kegiatan_lab VARCHAR(191) NULL,
  bagian VARCHAR(191) NULL,
  email VARCHAR(191) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS master_biaya;
CREATE TABLE master_biaya (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kegiatan VARCHAR(191) NOT NULL,
  biaya DECIMAL(15,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS config;
CREATE TABLE config (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(64) NOT NULL,
  config_value TEXT NULL,
  UNIQUE KEY uq_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS nomor_surat;
CREATE TABLE nomor_surat (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  tahun SMALLINT UNSIGNED NOT NULL,
  last_number INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_nomor_surat (type, tahun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS admin;
CREATE TABLE admin (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS bagian_staff;
CREATE TABLE bagian_staff (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL,
  kategori VARCHAR(64) NULL,
  nama VARCHAR(191) NULL,
  password_hash VARCHAR(255) NOT NULL,
  UNIQUE KEY uq_bagian_staff_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS audit_log;
CREATE TABLE audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  actor_email VARCHAR(191) NULL,
  aksi VARCHAR(191) NULL,
  target VARCHAR(191) NULL,
  detail TEXT NULL,
  alasan TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS log_upload;
CREATE TABLE log_upload (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  pengajuan_id BIGINT UNSIGNED NULL,
  id_pengajuan VARCHAR(32) NULL,
  npm VARCHAR(20) NULL,
  nama_lengkap VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  jenis_kegiatan VARCHAR(64) NULL,
  detail VARCHAR(191) NULL,
  tanggal DATE NULL,
  path_acc_inhal VARCHAR(512) NULL,
  path_bukti_bayar VARCHAR(512) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS berita_acara;
CREATE TABLE berita_acara (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  ba_id VARCHAR(32) NOT NULL,
  bagian VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  nama_kegiatan VARCHAR(191) NULL,
  tanggal_pelaksanaan DATE NULL,
  jumlah_peserta INT UNSIGNED NOT NULL DEFAULT 0,
  file_name VARCHAR(255) NULL,
  file_path VARCHAR(512) NULL,
  catatan TEXT NULL,
  sumber VARCHAR(16) NOT NULL DEFAULT 'Bagian',
  UNIQUE KEY uq_ba_id (ba_id),
  UNIQUE KEY uq_ba_bagian_duplikat (bagian, blok, nama_kegiatan, tanggal_pelaksanaan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS berita_acara_peserta;
CREATE TABLE berita_acara_peserta (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  ba_id VARCHAR(32) NOT NULL,
  npm VARCHAR(20) NULL,
  nama_lengkap VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  bagian VARCHAR(191) NULL,
  status_pengajuan VARCHAR(32) NULL,
  KEY idx_bap_ba (ba_id),
  CONSTRAINT fk_bap_ba FOREIGN KEY (ba_id) REFERENCES berita_acara(ba_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS berita_acara_admin;
CREATE TABLE berita_acara_admin (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  ba_id VARCHAR(32) NOT NULL,
  bagian VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  nama_kegiatan VARCHAR(191) NULL,
  tanggal_pelaksanaan DATE NULL,
  jumlah_peserta INT UNSIGNED NOT NULL DEFAULT 0,
  file_name VARCHAR(255) NULL,
  file_path VARCHAR(512) NULL,
  catatan TEXT NULL,
  sumber VARCHAR(16) NOT NULL DEFAULT 'Admin',
  UNIQUE KEY uq_ba_admin_id (ba_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS berita_acara_admin_peserta;
CREATE TABLE berita_acara_admin_peserta (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  ba_id VARCHAR(32) NOT NULL,
  npm VARCHAR(20) NULL,
  nama_lengkap VARCHAR(191) NULL,
  blok VARCHAR(64) NULL,
  bagian VARCHAR(191) NULL,
  status_pengajuan VARCHAR(32) NULL,
  KEY idx_bap_admin_ba (ba_id),
  CONSTRAINT fk_bap_admin_ba FOREIGN KEY (ba_id) REFERENCES berita_acara_admin(ba_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS email_templates;
CREATE TABLE email_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode VARCHAR(64) NOT NULL,
  subjek VARCHAR(191) NOT NULL,
  body_html MEDIUMTEXT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_email_template_kode (kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS ci_sessions;
CREATE TABLE ci_sessions (
  id VARCHAR(128) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  timestamp INT UNSIGNED NOT NULL DEFAULT 0,
  data BLOB NOT NULL,
  PRIMARY KEY (id, ip_address),
  KEY ci_sessions_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Seed (lampiran ke `inhal.sql`)**

Append sebelum akhir file:

```sql
-- Seed
INSERT INTO config (config_key, config_value) VALUES
('BUKTI_MODE','strict'),
('BAGIAN_BA_FINAL_ONLY','0'),
('BAGIAN_BA_STATUSES','["Diterima","ACC"]'),
('APP_NAME','INHAL'),
('TIMEZONE','Asia/Jakarta');

INSERT INTO master_kegiatan (kategori, nilai) VALUES
('Blok','Blok 1'),('Blok','Blok 2'),
('Ujian','UTS'),('Ujian','UAS'),
('SGD','SGD 1'),('KKD','KKD 1'),
('Lab','Lab A'),('Lab','Lab B'),
('Kegiatan Lab','Praktikum Kimia'),
('Dosen','Dr. Andi, M.Pd.'),('Dosen','Prof. Siti, Ph.D.'),
('Matakuliah','Kimia Dasar'),('Matakuliah','Fisika Dasar');

INSERT INTO master_matakuliah (kode, nama, blok, sks) VALUES
('KIM101','Kimia Dasar','Blok 1',3),
('FIS101','Fisika Dasar','Blok 1',3),
('BIO201','Biologi Sel','Blok 2',2);

INSERT INTO master_biaya (kegiatan, biaya) VALUES
('UTS',50000),('UAS',50000),('SGD 1',25000),('KKD 1',25000);

INSERT INTO admin (nama, password_hash) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');
-- password 'admin123' (hash contoh bcrypt; wajib regenerate saat seed nyata, lihat Task 3 Step 2 note)

INSERT INTO bagian_staff (email, kategori, nama, password_hash) VALUES
('staf.sgd@inhal.test','SGD','Staf SGD', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

INSERT INTO email_templates (kode, subjek, body_html, aktif) VALUES
('acc_diterima','Pengajuan INHAL Diterima','<p>Yth. {NAMA},</p><p>Pengajuan {NPM} telah diterima.</p>',1),
('acc_ditolak','Pengajuan INHAL Ditolak','<p>Yth. {NAMA},</p><p>Pengajuan {NPM} ditolak. Catatan: {CATATAN}</p>',1),
('acc_final','ACC Final INHAL','<p>Yth. {NAMA},</p><p>Nomor surat {NOMOR_SURAT}.</p>',1);

INSERT INTO mahasiswa (npm, nama_lengkap, email, blok) VALUES
('1234567890','Mahasiswa Contoh','contoh@inhal.test','Blok 1');
```

- [ ] **Step 3: Import dan verifikasi**

```bash
mysql -u root < new-code2/database/inhal.sql
mysql -u root -e "USE inhal; SHOW TABLES; SELECT COUNT(*) AS cfg FROM config;"
```

Expected: `SHOW TABLES` menampilkan 21 tabel; `cfg` = 5.

> Catatan untuk implementer: hash `admin123` contoh di atas BUKAN hash valid; saat seed nyata, generate dengan PHP: `php -r "echo password_hash('admin123', PASSWORD_DEFAULT);"` dan tempel hasilnya ke `INSERT INTO admin`.

- [ ] **Step 4: Commit**

```bash
git add new-code2/database/inhal.sql
git commit -m "feat(db): add inhal database schema and seed"
```

---

### Task 3: Helper CI4 + semua Model

**Files:**
- Create: `new-code2/app/Common_inhal.php` (auto-loaded)
- Modify: `new-code2/app/Config/Autoload.php` (`$helpers` += `['url','form','inhal']`)
- Create: `new-code2/app/Models/MahasiswaModel.php`, `PengajuanModel.php`, `DetailKegiatanModel.php`, `StatusHistoryModel.php`, `CheckDataModel.php`, `MasterKegiatanModel.php`, `MasterMatakuliahModel.php`, `MasterBagianModel.php`, `MasterBiayaModel.php`, `ConfigModel.php`, `NomorSuratModel.php`, `AdminModel.php`, `BagianStaffModel.php`, `AuditLogModel.php`, `LogUploadModel.php`, `BeritaAcaraModel.php`, `BeritaAcaraPesertaModel.php`, `BeritaAcaraAdminModel.php`, `BeritaAcaraAdminPesertaModel.php`, `EmailTemplateModel.php`

**Interfaces:**
- Produces: model `find($id)`, `insert()`, `update()`, `delete()`, `first()` per `$allowedFields`; helper `h()` = `esc()`; `config_get($key)/config_set($key,$val)`; `now_id()`; `audit($actor,$aksi,$target,$detail,$alasan)`.

- [ ] **Step 1: Tulis `app/Common_inhal.php`**

```php
<?php

if (!function_exists('config_get')) {
    function config_get(string $key, $default = null)
    {
        $row = db_connect()->table('config')->where('config_key', $key)->get()->getRow();
        return $row ? $row->config_value : $default;
    }
}

if (!function_exists('config_set')) {
    function config_set(string $key, $value): void
    {
        $db = db_connect();
        $exists = $db->table('config')->where('config_key', $key)->countAllResults() > 0;
        if ($exists) {
            $db->table('config')->where('config_key', $key)->update(['config_value' => $value]);
        } else {
            $db->table('config')->insert(['config_key' => $key, 'config_value' => $value]);
        }
    }
}

if (!function_exists('inhal_id')) {
    function inhal_id(string $prefix): string
    {
        return $prefix . '-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
    }
}

if (!function_exists('audit_log_add')) {
    function audit_log_add($actor, $aksi, $target = null, $detail = null, $alasan = null): void
    {
        db_connect()->table('audit_log')->insert([
            'timestamp'   => date('Y-m-d H:i:s'),
            'actor_email' => $actor,
            'aksi'        => $aksi,
            'target'      => $target,
            'detail'      => $detail,
            'alasan'      => $alasan,
        ]);
    }
}
```

- [ ] **Step 2: Buat model dasar**

Setiap model mengikuti pola (contoh `PengajuanModel.php`):

```php
<?php

namespace App\Models;

use CodeIgniter\Model;

class PengajuanModel extends Model
{
    protected $table            = 'pengajuan';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'id_pengajuan','timestamp','npm','nama_lengkap','email','no_hp_wa','blok',
        'jenis_kegiatan','matakuliah','dosen','tanggal_pelaksanaan','keterangan',
        'link_surat_keterangan','status','catatan_admin','notifikasi_terkirim_pada',
        'status_notifikasi_email','error_notifikasi_email','lampiran_email','nomor_surat',
        'path_acc_inhal','path_bukti_bayar','path_final','status_info_bagian',
        'waktu_info_bagian','email_bagian','catatan_info_bagian',
    ];
    protected $useTimestamps = true;
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    public function findByIdPengajuan(string $idPengajuan)
    {
        return $this->where('id_pengajuan', $idPengajuan)->first();
    }
}
```

Buat model sejenis untuk semua tabel, set `$table` dan `$allowedFields` sesuai kolom di Task 2. `ConfigModel`, `MasterMatakuliahModel`, `AdminModel` ditambah method akses kunci (`where('config_key',...)`, `where('kode',...)`, `where('npm',...)`). Sebelum lanjut, generate hash seed valid dan update `inhal.sql`:

```bash
cd /workspace/new-code2 && php -r "echo password_hash('admin123', PASSWORD_DEFAULT), PHP_EOL;"
```

- [ ] **Step 3: Verifikasi**

Run: `php -l new-code2/app/Common_inhal.php` lalu `for f in new-code2/app/Models/*.php; do php -l "$f" >/dev/null || echo "ERR $f"; done`
Expected: tanpa output `ERR`.

- [ ] **Step 4: Commit**

```bash
git add new-code2/app/Common_inhal.php new-code2/app/Models new-code2/app/Config/Autoload.php
git commit -m "feat(models): add inhal helpers and models"
```

---

### Task 4: Library service — Auth, Upload, Biaya, NomorSurat, Email

**Files:**
- Create: `new-code2/app/Libraries/AuthService.php`
- Create: `new-code2/app/Libraries/UploadService.php`
- Create: `new-code2/app/Libraries/BiayaService.php`
- Create: `new-code2/app/Libraries/NomorSuratService.php`
- Create: `new-code2/app/Libraries/EmailAccService.php`

**Interfaces:**
- Produces:
  - `AuthService::adminLogin(string $password): array`, `bagianLogin(string $email, string $password): array`, `logout()`, `sessionBagian()`, `requireAdmin()`, `requireBagian()`, `adminBagianBypass(string $kategori, string $subBagian): array`, `isAdmin(): bool`, `isBagian(): bool`.
  - `UploadService::store(string $jenis, string $idRef, CodeIgniter\HTTP\Files\UploadedFile $file): array{path,file_name}` dan `serve(string $jenis, int $pengajuanId)`; aturan MIME/ekstensi/ukuran dari config.
  - `BiayaService::resolve(int $pengajuanId, string $kegiatan): ?float`, `allMapped(): array`, `setOverride(int $pengajuanId, string $kegiatan, ?float $biaya): void`.
  - `NomorSuratService::next(string $type): string`.
  - `EmailAccService::sendStatus(string $kodeTemplate, array $data): array{ok,message}`, `sendFinal(array $pengajuan): array`, `sendAccFinalToBagian(array $pengajuan): array`.

- [ ] **Step 1: AuthService**

```php
<?php

namespace App\Libraries;

use App\Models\AdminModel;
use App\Models\BagianStaffModel;

class AuthService
{
    public const ROLE_ADMIN = 'admin';
    public const ROLE_BAGIAN = 'bagian';

    public function adminLogin(string $password): array
    {
        if ($password === '') {
            return ['ok' => false, 'message' => 'Masukkan password admin.'];
        }
        $session = session();
        $failed = (int) $session->get('login_failed_admin') ?? 0;
        if ($failed >= 5) {
            return ['ok' => false, 'message' => 'Terlalu banyak percobaan. Coba lagi nanti.'];
        }
        $admin = (new AdminModel())->first();
        if ($admin && password_verify($password, $admin['password_hash'])) {
            $session->remove('login_failed_admin');
            $session->set('auth', ['role' => self::ROLE_ADMIN, 'nama' => $admin['nama']]);
            $session->regenerate(true);
            return ['ok' => true, 'nama' => $admin['nama']];
        }
        $session->set('login_failed_admin', $failed + 1);
        return ['ok' => false, 'message' => 'Password admin salah.'];
    }

    public function bagianLogin(string $email, string $password): array
    {
        $staf = (new BagianStaffModel())->where('email', trim($email))->first();
        if (!$staf || !password_verify($password, $staf['password_hash'])) {
            return ['ok' => false, 'message' => 'Email atau password salah.'];
        }
        $session = session();
        $session->set('auth', [
            'role'       => self::ROLE_BAGIAN,
            'email'      => $staf['email'],
            'nama'       => $staf['nama'],
            'kategori'   => $staf['kategori'],
            'kategoris'  => $staf['kategori'] ? [$staf['kategori']] : [],
        ]);
        $session->regenerate(true);
        return ['ok' => true, 'nama' => $staf['nama'], 'kategori' => $staf['kategori']];
    }

    public function logout(): void
    {
        $session = session();
        $session->remove('auth');
        $session->remove('bab_session');
        $session->destroy();
    }

    public function sessionAuth(): ?array
    {
        return session()->get('auth');
    }

    public function isAdmin(): bool
    {
        return ($this->sessionAuth()['role'] ?? null) === self::ROLE_ADMIN;
    }

    public function isBagian(): bool
    {
        return ($this->sessionAuth()['role'] ?? null) === self::ROLE_BAGIAN;
    }

    public function requireAdmin(): void
    {
        if (!$this->isAdmin()) {
            header('Content-Type: application/json');
            http_response_code(401);
            echo json_encode(['ok' => false, 'message' => 'Sesi admin tidak ditemukan. Silakan login.']);
            exit;
        }
    }

    public function requireBagian(): void
    {
        if (!$this->isBagian()) {
            header('Content-Type: application/json');
            http_response_code(401);
            echo json_encode(['ok' => false, 'message' => 'Sesi bagian tidak ditemukan.']);
            exit;
        }
    }

    public function adminBagianBypass(string $kategori, string $subBagian): array
    {
        $this->requireAdmin();
        $allowed = ['SGD', 'KKD', 'Ujian', 'Praktikum'];
        if (!in_array($kategori, $allowed, true)) {
            return ['ok' => false, 'message' => 'Pilih kategori kegiatan terlebih dahulu.'];
        }
        if ($kategori === 'Praktikum' && trim($subBagian) === '') {
            return ['ok' => false, 'message' => 'Untuk Praktikum, pilih sub bagian / lab terlebih dahulu.'];
        }
        $auth = $this->sessionAuth();
        session()->set('bab_session', [
            'role'      => self::ROLE_BAGIAN,
            'nama'      => $auth['nama'] ?? 'Admin',
            'kategori'  => $kategori,
            'subBagian' => trim($subBagian),
            'kategoris' => [$kategori],
            'bypass'    => true,
        ]);
        return ['ok' => true, 'nama' => $auth['nama'] ?? 'Admin', 'kategori' => $kategori, 'subBagian' => trim($subBagian)];
    }
}
```

- [ ] **Step 2: UploadService**

```php
<?php

namespace App\Libraries;

use Config\UploadConfig;
use CodeIgniter\HTTP\Files\UploadedFile;

class UploadService
{
    private array $dirs = ['acc' => 'acc', 'bukti' => 'bukti', 'ba' => 'ba', 'final' => 'final'];
    private array $mimeOk = ['application/pdf', 'image/jpeg', 'image/png'];

    public function store(string $jenis, string $idRef, UploadedFile $file): array
    {
        if (!$file->isValid() || $file->hasMoved()) {
            return ['ok' => false, 'message' => 'File tidak valid.'];
        }
        if ($file->getSize() > (int) (config_get('UPLOAD_MAX_BYTES', 5242880))) {
            return ['ok' => false, 'message' => 'Ukuran file melebihi batas maksimal.'];
        }
        if (!in_array($file->getMimeType(), $this->mimeOk, true)) {
            return ['ok' => false, 'message' => 'Tipe file tidak diizinkan. Gunakan PDF/JPG/PNG.'];
        }
        $dir = $this->dirs[$jenis] ?? 'acc';
        $ext  = $file->getClientExtension();
        if (in_array(strtolower($ext), ['php', 'phtml', 'phar', 'php3', 'php4', 'php5'], true)) {
            return ['ok' => false, 'message' => 'Ekstensi file tidak diizinkan.'];
        }
        $folder = WRITEPATH . 'uploads/' . $dir . '/';
        if (!is_dir($folder)) {
            mkdir($folder, 0775, true);
        }
        $fileName = $idRef . '_' . $dir . '_' . uniqid() . '.' . $ext;
        if (!$file->move($folder, $fileName)) {
            return ['ok' => false, 'message' => 'Gagal menyimpan file.'];
        }
        return ['ok' => true, 'path' => $dir . '/' . $fileName, 'file_name' => $file->getClientName()];
    }
}
```

- [ ] **Step 3: BiayaService**

```php
<?php

namespace App\Libraries;

use App\Models\CheckDataModel;
use App\Models\MasterBiayaModel;
use App\Models\PengajuanModel;

class BiayaService
{
    public function allMapped(): array
    {
        $rows = (new MasterBiayaModel())->orderBy('biaya', 'ASC')->findAll();
        $map = [];
        foreach ($rows as $r) {
            $map[$r['kegiatan']] = (float) $r['biaya'];
        }
        return $map;
    }

    public function override(int $pengajuanId): ?float
    {
        $row = (new CheckDataModel())
            ->where('pengajuan_id', $pengajuanId)
            ->where('detail', 'BIAYA-OVERRIDE')
            ->first();
        return $row && $row['biaya'] !== null ? (float) $row['biaya'] : null;
    }

    public function resolve(int $pengajuanId, ?string $kegiatan): ?float
    {
        $ov = $this->override($pengajuanId);
        if ($ov !== null) {
            return $ov;
        }
        $map = $this->allMapped();
        return $kegiatan !== null && isset($map[$kegiatan]) ? $map[$kegiatan] : null;
    }

    public function setOverride(int $pengajuanId, string $kegiatan, ?float $biaya): void
    {
        $m = new CheckDataModel();
        $existing = $m->where('pengajuan_id', $pengajuanId)->where('detail', 'BIAYA-OVERRIDE')->first();
        $pengajuan = (new PengajuanModel())->find($pengajuanId);
        $base = [
            'timestamp'  => date('Y-m-d H:i:s'),
            'pengajuan_id' => $pengajuanId,
            'id_pengajuan' => $pengajuan ? $pengajuan['id_pengajuan'] : '',
            'npm'          => $pengajuan ? $pengajuan['npm'] : '',
            'detail'       => 'BIAYA-OVERRIDE',
            'kegiatan'     => $kegiatan,
        ];
        if ($biaya === null || $biaya <= 0) {
            if ($existing) {
                $m->delete($existing['id']);
            }
            return;
        }
        if ($existing) {
            $m->update($existing['id'], ['biaya' => $biaya, 'kegiatan' => $kegiatan]);
        } else {
            $base['check_id'] = inhal_id('CHK');
            $base['biaya'] = $biaya;
            $m->insert($base);
        }
    }
}
```

> Catatan: tambahkan kolom `kegiatan` pada `check_data` bila dipakai menyimpan nama kegiatan override; jika tidak, simpan di `pilihan`. Implementer menentukan salah satu dan konsisten dipakai `BiayaService` + tampilan.

- [ ] **Step 4: NomorSuratService**

```php
<?php

namespace App\Libraries;

use App\Models\NomorSuratModel;

class NomorSuratService
{
    public function next(string $type, ?int $tahun = null): string
    {
        $tahun = $tahun ?? (int) date('Y');
        $db = db_connect();
        $db->transStart();
        $row = (new NomorSuratModel())->where('type', $type)->where('tahun', $tahun)->first();
        $num = $row ? ((int) $row['last_number'] + 1) : 1;
        if ($row) {
            (new NomorSuratModel())->update($row['id'], ['last_number' => $num, 'updated_at' => date('Y-m-d H:i:s')]);
        } else {
            (new NomorSuratModel())->insert(['type' => $type, 'tahun' => $tahun, 'last_number' => $num]);
        }
        $db->transComplete();
        return str_pad((string) $num, 4, '0', STR_PAD_LEFT) . '/' . $type . '/' . $tahun;
    }
}
```

- [ ] **Step 5: EmailAccService**

```php
<?php

namespace App\Libraries;

use App\Models\EmailTemplateModel;

class EmailAccService
{
    private \Config\Email $config;

    public function __construct()
    {
        $this->config = new \Config\Email();
    }

    public function sendStatus(string $kodeTemplate, array $vars): array
    {
        $tpl = (new EmailTemplateModel())->where('kode', $kodeTemplate)->first();
        if (!$tpl || !$tpl['aktif']) {
            return ['ok' => false, 'message' => 'Template email tidak tersedia atau nonaktif.'];
        }
        $email = \Config\Services::email();
        $email->setFrom($this->config->fromEmail, $this->config->fromName);
        $email->setTo($vars['email']);
        $email->setSubject($this->fill($tpl['subjek'], $vars));
        $email->setMessage($this->fill($tpl['body_html'], $vars));
        if (!$email->send()) {
            return ['ok' => false, 'message' => $email->printDebugger(['headers'])];
        }
        return ['ok' => true, 'message' => 'Email terkirim.'];
    }

    private function fill(string $text, array $vars): string
    {
        foreach ($vars as $k => $v) {
            $text = str_replace('{' . strtoupper($k) . '}', (string) $v, $text);
        }
        return $text;
    }
}
```

- [ ] **Step 6: Verifikasi sintaks**

Run: `for f in new-code2/app/Libraries/*.php; do php -l "$f" >/dev/null || echo "ERR $f"; done`
Expected: tanpa output `ERR`.

- [ ] **Step 7: Commit**

```bash
git add new-code2/app/Libraries
git commit -m "feat(libs): add auth, upload, biaya, nomor surat, email services"
```

---

### Task 5: Base API Controller + Filter auth

**Files:**
- Create: `new-code2/app/Controllers/Api/BaseApi.php`
- Create: `new-code2/app/Filters/AdminFilter.php`
- Create: `new-code2/app/Filters/BagianFilter.php`
- Modify: `new-code2/app/Config/Filters.php`

**Interfaces:**
- Produces: `BaseApi::respondOk($data)`, `respondErr($msg, $code=400)`, `respondValidation($errors)`; Filter `AdminFilter`/`BagianFilter` `before()`.

- [ ] **Step 1: Tulis `BaseApi`**

```php
<?php

namespace App\Controllers\Api;

use CodeIgniter\HTTP\ResponseInterface;

class BaseApi extends \CodeIgniter\Controller
{
    protected function respondOk($data): ResponseInterface
    {
        return $this->response->setStatusCode(200)->setJSON(['ok' => true, 'data' => $data]);
    }

    protected function respondErr(string $message, int $code = 400): ResponseInterface
    {
        return $this->response->setStatusCode($code)->setJSON(['ok' => false, 'message' => $message]);
    }

    protected function respondValidation(array $errors): ResponseInterface
    {
        return $this->response->setStatusCode(422)->setJSON(['ok' => false, 'message' => 'Validasi gagal.', 'errors' => $errors]);
    }

    protected function requireAdmin()
    {
        (new \App\Libraries\AuthService())->requireAdmin();
    }

    protected function requireBagian()
    {
        (new \App\Libraries\AuthService())->requireBagian();
    }
}
```

- [ ] **Step 2: Tulis filter**

`AdminFilter.php`:

```php
<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use App\Libraries\AuthService;

class AdminFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if (!(new AuthService())->isAdmin()) {
            return service('response')->setStatusCode(401)->setJSON(['ok' => false, 'message' => 'Sesi admin tidak ditemukan. Silakan login.']);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null) {}
}
```

`BagianFilter.php` analog: cek `isBagian()` untuk rute bagian (atau `bab_session` untuk bypass).

- [ ] **Step 3: Daftarkan di `Filters.php`**

```php
public $aliases = [
    'csrf'     => \CodeIgniter\Filters\CSRF::class,
    'toolbar'  => \CodeIgniter\Filters\DebugToolbar::class,
    'admin'    => \App\Filters\AdminFilter::class,
    'bagian'   => \App\Filters\BagianFilter::class,
];

public $globals = [
    'before' => [
        'csrf' => ['except' => ['api/*']],  // CSRF via header ditangani khusus
    ],
    'after' => ['toolbar'],
];
```

> Catatan CSRF: untuk API JSON, kirim token via header `X-CSRF-TOKEN` (nilai `csrf_hash()`); pastikan hanya dikecualikan jika benar-benar dipakai header. Default CI4 membaca header `X-CSRF-TOKEN` dengan nama token dari `Security::$tokenName`. Implementer memastikan token tersedia (view menyisipkan `<meta name="csrf" content="<?= csrf_hash() ?>">`).

- [ ] **Step 4: Verifikasi**

Run: `php -l app/Controllers/Api/BaseApi.php && php -l app/Filters/AdminFilter.php && php -l app/Filters/BagianFilter.php`
Expected: lulus tanpa error.

- [ ] **Step 5: Commit**

```bash
git add new-code2/app/Controllers/Api/BaseApi.php new-code2/app/Filters new-code2/app/Config/Filters.php
git commit -m "feat(api): add base api controller and auth filters"
```

---

### Task 6: PageController + 6 view shell

**Files:**
- Create: `new-code2/app/Controllers/PageController.php`
- Create: `new-code2/app/Views/pages/index.php`, `portal.php`, `bagian.php`, `dashboard.php`, `detail-laporan.php`, `pengaturan.php`
- Create: `new-code2/app/Views/layouts/nav.php` (partial)
- Modify: `new-code2/app/Config/Routes.php`

**Interfaces:**
- Produces: rute halaman (`/`, `/portal`, `/bagian`, `/dashboard`, `/admin`, `/laporan`, `/pengaturan`). View memakai `$data['page']` untuk judul dan partial nav; menyisipkan `<meta name="csrf" content="<?= csrf_hash() ?>">`.

- [ ] **Step 1: `PageController`**

```php
<?php

namespace App\Controllers;

class PageController extends BaseController
{
    private array $pages = [
        'index'    => 'pages/index',
        'portal'   => 'pages/portal',
        'bagian'   => 'pages/bagian',
        'dashboard'=> 'pages/dashboard',
        'laporan'  => 'pages/detail-laporan',
        'pengaturan'=> 'pages/pengaturan',
    ];

    public function show(string $page = 'index')
    {
        $key = array_key_exists($page, $this->pages) ? $page : 'index';
        $data = [
            'page'   => $key,
            'title'  => ucfirst($key),
            'userEmail' => session()->get('auth.nama') ?? '',
        ];
        return view($this->pages[$key], $data);
    }
}
```

- [ ] **Step 2: Routes**

`app/Config/Routes.php` (append):

```php
$routes->get('/', 'PageController::show/index');
$routes->get('/portal', 'PageController::show/portal');
$routes->get('/bagian', 'PageController::show/bagian');
$routes->get('/dashboard', 'PageController::show/dashboard');
$routes->get('/admin', 'PageController::show/dashboard');
$routes->get('/laporan', 'PageController::show/laporan');
$routes->get('/pengaturan', 'PageController::show/pengaturan');
```

Rute API (prefix `api`) di Task 7 dst di-append terpisah; tempatkan blok API dalam `group('api', function(){...})`.

- [ ] **Step 3: View shell dasar `pages/index.php`**

Kerangka semua halaman mengikuti `new-code1/pages/index.html`: `<!DOCTYPE html lang="id">`, head (font Plus Jakarta Sans, bootstrap-icons CDN, Vue 3 CDN, Tailwind inline), partial nav, `<div id="app" v-cloak>`, dan sebelum `</body>` blok `new Vue` yang mengarah ke API. Untuk tahap ini cukup shell + title + meta CSRF; logika Vue per halaman ditambahkan di Task 7–13 sesuai endpoint-nya.

- [ ] **Step 4: Verifikasi render**

```bash
cd /workspace/new-code2 && php -S localhost:8080 -t public >/tmp/ci.log 2>&1 &
sleep 1
curl -s http://localhost:8080/ | grep -o 'Pendaftaran INHAL' | head -1
curl -s http://localhost:8080/pengaturan | grep -o 'Pendaftaran INHAL\|Pengaturan' | head -1
```

Expected: kedua URL merender HTML (grep tidak kosong). Hentikan server dengan kill pada PID yang direkam (`kill %1`).

- [ ] **Step 5: Commit**

```bash
git add new-code2/app/Controllers/PageController.php new-code2/app/Views new-code2/app/Config/Routes.php
git commit -m "feat(pages): add page controller and six view shells"
```

---

### Task 7: API + view Pendaftaran (publik) dengan field Matakuliah

**Files:**
- Create: `new-code2/app/Controllers/Api/PengajuanApi.php`
- Create: `new-code2/app/Controllers/Api/MasterApi.php` (registration-options + mahasiswa lookup)
- Modify: `new-code2/app/Views/pages/index.php` (logika Vue penuh)
- Modify: `new-code2/app/Config/Routes.php`

**Interfaces:**
- Consumes: `UploadService`, model `PengajuanModel`, `DetailKegiatanModel`, `StatusHistoryModel`, helper `config_get`, `inhal_id`, `audit_log_add`.
- Produces:
  - `GET /api/registration-options` → `{ blok[], ujian[], sgd[], detailSgd[], kkd[], detailKkd[], lab[], kegiatanLab[], dosen[], matakuliah[], buktiMode }`
  - `GET /api/mahasiswa/{npm}` → `{ nama_lengkap }`
  - `POST /api/pengajuan` (publik) → `{ ok, id_pengajuan, message }`

- [ ] **Step 1: `MasterApi::registrationOptions`**

```php
public function registrationOptions()
{
    $master = function (string $kat): array {
        return array_column((new MasterKegiatanModel())->where('kategori', $kat)->orderBy('nilai')->findAll(), 'nilai');
    };
    $matkul = (new MasterMatakuliahModel())->where('aktif', 1)->orderBy('nama')->findAll();
    return $this->respondOk([
        'blok'        => $master('Blok'),
        'ujian'       => $master('Ujian'),
        'sgd'         => $master('SGD'),
        'detailSgd'   => $master('Detail SGD'),
        'kkd'         => $master('KKD'),
        'detailKkd'   => $master('Detail KKD'),
        'lab'         => $master('Lab'),
        'kegiatanLab' => $master('Kegiatan Lab'),
        'dosen'       => $master('Dosen'),
        'matakuliah'  => array_map(fn ($m) => $m['nama'], $matkul),
        'buktiMode'   => config_get('BUKTI_MODE', 'strict'),
    ]);
}

public function mahasiswa(string $npm)
{
    $m = (new MahasiswaModel())->where('npm', trim($npm))->first();
    return $this->respondOk(['nama_lengkap' => $m['nama_lengkap'] ?? '']);
}
```

- [ ] **Step 2: Validasi + duplikat + register di `PengajuanApi`**

```php
public function register()
{
    $r = $this->request->getJSON(true);
    $npm = trim($r['npm'] ?? '');
    $nama = trim($r['namaLengkap'] ?? '');
    $email = trim($r['email'] ?? '');
    $noHp = trim($r['noHp'] ?? '');
    $errors = [];
    if ($npm === '' || $nama === '') {
        $errors['npm'] = 'NPM dan Nama Lengkap wajib diisi.';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Email aktif wajib diisi dengan format yang benar.';
    }
    if (!preg_match('/^[0-9+\-\s().]{8,20}$/', $noHp)) {
        $errors['noHp'] = 'No. HP/WhatsApp wajib diisi dengan format yang benar.';
    }
    if ($errors) {
        return $this->respondValidation($errors);
    }

    $pm = new PengajuanModel();
    $dups = $pm->where('npm', $npm)->where('jenis_kegiatan', trim($r['jenisKegiatan'] ?? ''))
        ->where('matakuliah', trim($r['matakuliah'] ?? ''))
        ->where('tanggal_pelaksanaan', $r['tanggalKegiatan'] ?? null)
        ->findAll();
    if ($dups) {
        return $this->respondErr('Data identik sudah pernah diajukan. Silakan cek status pengajuan Anda.', 409);
    }

    $idPengajuan = inhal_id('INHAL');
    $now = date('Y-m-d H:i:s');
    $pm->insert([
        'id_pengajuan' => $idPengajuan,
        'timestamp'    => $now,
        'npm'          => $npm,
        'nama_lengkap' => $nama,
        'email'        => $email,
        'no_hp_wa'     => $noHp,
        'blok'         => trim($r['blok'] ?? ''),
        'jenis_kegiatan'=> trim($r['jenisKegiatan'] ?? ''),
        'matakuliah'   => trim($r['matakuliah'] ?? ''),
        'dosen'        => trim($r['dosen'] ?? ''),
        'tanggal_pelaksanaan' => $r['tanggalKegiatan'] ?? null,
        'keterangan'   => trim($r['keterangan'] ?? ''),
        'status'       => 'Menunggu',
    ]);
    $pengajuanId = $pm->getInsertID();
    (new DetailKegiatanModel())->insert([
        'pengajuan_id' => $pengajuanId,
        'id_pengajuan' => $idPengajuan,
        'timestamp'    => $now,
        'jenis_kegiatan'=> trim($r['jenisKegiatan'] ?? ''),
        'pilihan'      => trim($r['detailKegiatan'] ?? ''),
        'detail'       => trim($r['detailSgd'] ?? $r['detailKkd'] ?? ''),
        'tanggal_pelaksanaan' => $r['tanggalKegiatan'] ?? null,
        'bagian'       => '',
    ]);
    (new StatusHistoryModel())->insert([
        'pengajuan_id' => $pengajuanId,
        'id_pengajuan' => $idPengajuan,
        'timestamp'    => $now,
        'status'       => 'Menunggu',
        'catatan'      => 'Pendaftaran baru',
        'actor_email'  => $email,
    ]);
    return $this->respondOk(['id_pengajuan' => $idPengajuan, 'message' => 'Pengajuan berhasil dikirim.']);
}
```

> Catatan: formulir berjenis (Ujian/SGD/KKD/Praktikum multi-baris lab) harus menyimpan detail_kegiatan sesuai aturan `_buildDetailKegiatanRows` GAS. Implementer meng-generalisasi langkah di atas menjadi perulangan atas array detail dari frontend, termasuk baris Praktikum per lab.

- [ ] **Step 3: View `index.php` Vue penuh**

Replikasi `new-code1/pages/index.html` (data/options/form/ujian/sgd/kkd/labs), ganti `run(fn,...)` menjadi fetch ke API:

```js
async run(path, payload) {
    const opt = { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name=csrf]').content }, body: JSON.stringify(payload || {}), credentials: 'same-origin' };
    if (!payload) { opt.method = 'GET'; delete opt.body; }
    const res = await fetch('/api/' + path, opt);
    const j = await res.json().catch(() => ({ ok: false, message: 'Respons tidak valid' }));
    if (!j.ok) throw new Error(j.message || 'Terjadi kesalahan');
    return j.data;
}
```

Form menambah select **Matakuliah** (`options.matakuliah`) yang wajib diisi untuk jenis selain Praktikum dan dikirim sebagai `form.matakuliah`. Tombol kirim memanggil `POST /api/pengajuan`.

- [ ] **Step 4: Test endpoint daftar**

```bash
curl -s http://localhost:8080/api/registration-options | grep -o '"matakuliah":\[[^]]*\]'
curl -s -X POST http://localhost:8080/api/pengajuan -H 'Content-Type: application/json' -d '{"npm":"1234567890","namaLengkap":"Uji Coba","email":"a@b.co","noHp":"081234567890","jenisKegiatan":"Ujian","matakuliah":"Kimia Dasar","detailKegiatan":"UTS","tanggalKegiatan":"2026-10-01"}'
```

Expected: options punya `matakuliah` non-kosong; POST balasan `{"ok":true,...}`.

- [ ] **Step 5: Commit**

```bash
git add new-code2/app/Controllers/Api new-code2/app/Views/pages/index.php new-code2/app/Config/Routes.php
git commit -m "feat(daftar): add public registration api and view with matakuliah"
```

---

### Task 8: Portal mahasiswa + upload bukti

**Files:**
- Create: `new-code2/app/Controllers/Api/PortalApi.php`
- Modify: `new-code2/app/Views/pages/portal.php`
- Modify: `new-code2/app/Config/Routes.php`

**Interfaces:**
- Consumes: `UploadService`, `BiayaService` (TIDAK dipakai portal), model.
- Produces:
  - `GET /api/portal/{npm}` → `{ nama, npm, buktiMode, history[] }` tanpa kolom biaya dan tanpa path ACC/bukti.
  - `POST /api/portal/{id}/bukti` (multipart: accFile, buktiFile) → `{ ok, message }`.

- [ ] **Step 1: `PortalApi::data`**

```php
public function data(string $npm)
{
    $npm = trim($npm);
    if ($npm === '') {
        return $this->respondErr('NPM tidak boleh kosong');
    }
    $pm = new PengajuanModel();
    $rows = $pm->where('npm', $npm)->orderBy('timestamp', 'DESC')->findAll();
    $history = [];
    $nama = '';
    foreach ($rows as $p) {
        if ($nama === '' && $p['nama_lengkap']) {
            $nama = $p['nama_lengkap'];
        }
        $hasUpload = !empty($p['path_acc_inhal']) || !empty($p['path_bukti_bayar']);
        $history[] = [
            'id'          => $p['id_pengajuan'],
            'idPengajuan' => $p['id_pengajuan'],
            'tanggalAjuan'=> $p['timestamp'],
            'blok'        => $p['blok'],
            'jenis'       => $p['jenis_kegiatan'],
            'matakuliah'  => $p['matakuliah'],
            'detail'      => '', // diisi dari detail_kegiatan (Task 7 menyimpan)
            'tanggal'     => $p['tanggal_pelaksanaan'],
            'status'      => $p['status'],
            'catatan'     => $p['catatan_admin'],
            'hasUpload'   => $hasUpload,
        ];
    }
    return $this->respondOk(['nama' => $nama, 'npm' => $npm, 'buktiMode' => config_get('BUKTI_MODE', 'strict'), 'history' => $history]);
}
```

Tidak ada field `biaya` atau `path_*` yang dikirim. Tambahkan helper untuk gabung `detail` dari `detail_kegiatan` jika baris detail ada.

- [ ] **Step 2: `PortalApi::uploadBukti`** — validasi strict/lenggang

```php
public function uploadBukti(string $idPengajuan)
{
    $pm = new PengajuanModel();
    $p = $pm->findByIdPengajuan($idPengajuan);
    if (!$p) {
        return $this->respondErr('Pengajuan tidak ditemukan.', 404);
    }
    $req = $this->request;
    $acc = $req->getFile('accFile');
    $bukti = $req->getFile('buktiFile');
    if (!$acc && !$bukti) {
        return $this->respondErr('Tidak ada file yang diunggah.');
    }
    $up = new \App\Libraries\UploadService();
    $save = function ($file, string $jenis, string $prefix) use ($up, $idPengajuan) {
        if (!$file) {
            return ['ok' => true, 'path' => null];
        }
        if (config_get('BUKTI_MODE', 'strict') === 'strict' && $file->getMimeType() !== 'application/pdf') {
            return ['ok' => false, 'message' => 'Maaf, bukti bayar bukan PDF portal. Gunakan PDF asli.'];
        }
        return $up->store($jenis, $prefix . $idPengajuan, $file);
    };
    $resAcc = $save($acc, 'acc', 'acc-');
    if (!$resAcc['ok']) {
        return $this->respondErr($resAcc['message']);
    }
    $resBukti = $save($bukti, 'bukti', 'bukti-');
    if (!$resBukti['ok']) {
        return $this->respondErr($resBukti['message']);
    }
    $upd = [];
    if ($resAcc['path']) {
        $upd['path_acc_inhal'] = $resAcc['path'];
    }
    if ($resBukti['path']) {
        $upd['path_bukti_bayar'] = $resBukti['path'];
    }
    $pm->update($p['id'], $upd);
    (new LogUploadModel())->insert([
        'timestamp'    => date('Y-m-d H:i:s'),
        'pengajuan_id' => $p['id'],
        'id_pengajuan' => $idPengajuan,
        'npm'          => $p['npm'],
        'nama_lengkap' => $p['nama_lengkap'],
        'blok'         => $p['blok'],
        'jenis_kegiatan' => $p['jenis_kegiatan'],
        'path_acc_inhal' => $resAcc['path'] ?? null,
        'path_bukti_bayar' => $resBukti['path'] ?? null,
    ]);
    return $this->respondOk(['message' => 'Berkas berhasil diunggah.']);
}
```

> Validasi strict penuh (ekstraksi `%PDF` + NPM cocok) memakai pustaka PDF bila tersedia; default implementer: cek `application/pdf` + magic `%PDF` dari isi file (`file_get_contents($file->getTempName())` 5 byte pertama). Pesan mahasiswa netral (tidak menyebut "strict").

- [ ] **Step 3: View `portal.php` Vue**

Replikasi `new-code1/pages/portal.html`: input NPM → `GET /api/portal/{npm}` → daftar history; tiap baris "Upload Bukti" modal/file input → `POST /api/portal/{id}/bukti` (FormData + CSRF header). Pesan hasil sesuai aturan netral. Tidak menampilkan biaya.

- [ ] **Step 4: Test**

```bash
curl -s http://localhost:8080/api/portal/1234567890 | grep -o '"nama":"[^"]*"'
```

Expected: `"nama":"Mahasiswa Contoh"` (atau nama lain dari pengajuan yang baru dibuat) dan response TIDAK memuat `"biaya"`.

- [ ] **Step 5: Commit**

```bash
git add new-code2/app/Controllers/Api/PortalApi.php new-code2/app/Views/pages/portal.php new-code2/app/Config/Routes.php
git commit -m "feat(portal): add student portal api and upload bukti view"
```

---

### Task 9: Auth bagian + API bagian + BA bagian + view

**Files:**
- Create: `new-code2/app/Controllers/Api/AuthApi.php`
- Create: `new-code2/app/Controllers/Api/BagianApi.php`
- Modify: `new-code2/app/Views/pages/bagian.php`
- Modify: `new-code2/app/Config/Routes.php`

**Interfaces:**
- Consumes: `AuthService`, `UploadService`, model.
- Produces:
  - `POST /api/auth/bagian` `{email,password}`; `POST /api/auth/logout`.
  - `GET /api/bagian/bootstrap`; `GET /api/bagian/ba`; `POST /api/bagian/ba` (multipart + JSON peserta) → cek duplikat + validasi status peserta; tolak jika `BAGIAN_BA_FINAL_ONLY=1` tanpa ACC final.
  - `POST /api/admin/bagian-bypass`.

- [ ] **Step 1: `AuthApi`**

```php
public function admin()
{
    $r = $this->request->getJSON(true);
    $res = (new AuthService())->adminLogin(trim($r['password'] ?? ''));
    return $res['ok'] ? $this->respondOk(['nama' => $res['nama']]) : $this->respondErr($res['message'], 401);
}

public function bagian()
{
    $r = $this->request->getJSON(true);
    $res = (new AuthService())->bagianLogin(trim($r['email'] ?? ''), trim($r['password'] ?? ''));
    return $res['ok'] ? $this->respondOk(['nama' => $res['nama'], 'kategori' => $res['kategori']]) : $this->respondErr($res['message'], 401);
}

public function bagianBypass()
{
    $r = $this->request->getJSON(true);
    $this->requireAdmin();
    $res = (new AuthService())->adminBagianBypass(trim($r['kategori'] ?? ''), trim($r['subBagian'] ?? ''));
    return $res['ok'] ? $this->respondOk($res) : $this->respondErr($res['message']);
}

public function logout()
{
    (new AuthService())->logout();
    return $this->respondOk(['message' => 'Anda telah keluar.']);
}
```

- [ ] **Step 2: `BagianApi::bootstrap`**

Bootstrap bagian: daftar kegiatan (dari pengajuan+detal berstatus ACC untuk bagian yang berhak) + status counts + config BA + daftar BA milik sesi. Route group `bagian` memakai `BagianFilter`. Payload ringkas agar list praktis.

- [ ] **Step 3: `BagianApi::uploadBa`**

```php
public function uploadBa()
{
    $bagian = session()->get('bab_session') ?? session()->get('auth');
    $kategori = $bagian['kategori'] ?? '';
    $req = $this->request;
    $namaKegiatan = trim($req->getPost('namaKegiatan') ?? '');
    $blok = trim($req->getPost('blok') ?? '');
    $tanggal = trim($req->getPost('tanggalPelaksanaan') ?? '');
    $bagianLabel = trim($req->getPost('bagian') ?? $kategori);
    $pesertaRaw = $req->getPost('peserta') ?? '[]';
    $peserta = json_decode($pesertaRaw, true) ?? [];

    if ($namaKegiatan === '' || $blok === '' || $tanggal === '' || count($peserta) === 0) {
        return $this->respondValidation(['ba' => 'Data BA belum lengkap (nama kegiatan, blok, tanggal, peserta).']);
    }
    $allowed = json_decode(config_get('BAGIAN_BA_STATUSES', '["Diterima","ACC"]'), true) ?? ['Diterima', 'ACC'];
    $blocked = [];
    foreach ($peserta as $p) {
        if (!in_array($p['statusPengajuan'] ?? '', $allowed, true)) {
            $blocked[] = $p['npm'];
        }
    }
    if ($blocked) {
        return $this->respondErr('Upload dibatalkan: peserta belum berstatus ' . implode(' / ', $allowed) . ' — ' . implode(', ', $blocked) . '.', 409);
    }
    $ba = (new BeritaAcaraModel())->where('bagian', $bagianLabel)->where('blok', $blok)
        ->where('nama_kegiatan', $namaKegiatan)->where('tanggal_pelaksanaan', $tanggal)->first();
    if ($ba) {
        return $this->respondErr('Upload dibatalkan: sudah ada berita acara untuk "' . $namaKegiatan . '" pada ' . $tanggal . '.', 409);
    }
    $baId = inhal_id('BA');
    $up = new UploadService();
    $file = $req->getFile('file');
    $saved = ['file_path' => null, 'file_name' => null];
    if ($file && $file->isValid()) {
        $r = $up->store('ba', $baId, $file);
        if (!$r['ok']) {
            return $this->respondErr($r['message']);
        }
        $saved = ['file_path' => $r['path'], 'file_name' => $r['file_name']];
    }
    $bm = new BeritaAcaraModel();
    $bm->insert([
        'timestamp'    => date('Y-m-d H:i:s'),
        'ba_id'        => $baId,
        'bagian'       => $bagianLabel,
        'blok'         => $blok,
        'nama_kegiatan'=> $namaKegiatan,
        'tanggal_pelaksanaan' => $tanggal,
        'jumlah_peserta' => count($peserta),
        'file_name'    => $saved['file_name'],
        'file_path'    => $saved['file_path'],
        'catatan'      => trim($req->getPost('catatan') ?? ''),
        'sumber'       => 'Bagian',
    ]);
    $baIdReal = $bm->getInsertID();
    $bp = new BeritaAcaraPesertaModel();
    foreach ($peserta as $p) {
        $bp->insert([
            'timestamp'        => date('Y-m-d H:i:s'),
            'ba_id'            => $baId,
            'npm'              => $p['npm'],
            'nama_lengkap'     => $p['namaLengkap'],
            'blok'             => $p['blok'] ?? $blok,
            'bagian'           => $bagianLabel,
            'status_pengajuan' => $p['statusPengajuan'],
        ]);
    }
    return $this->respondOk(['baId' => $baId, 'message' => 'Berita acara berhasil diunggah.']);
}
```

- [ ] **Step 4: View `bagian.php` Vue**

Login email+password → list kegiatan ber-status ACC (filter `BAGIAN_BA_FINAL_ONLY`) → pilih kegiatan → checklist peserta → tanggal → file → `POST /api/bagian/ba` (FormData) → pesan sukses/gagal; polling 30s; sesi direstore cookie (refresh aman).

- [ ] **Step 5: Test**

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/bagian -H 'Content-Type: application/json' -H 'Cookie: ci_session=...' -d '{"email":"staf.sgd@inhal.test","password":"admin123"}')
```

Gunakan cookie file (`curl -c /tmp/cj`) agar sesi ikut: `curl -s -c /tmp/cj -X POST .../api/auth/bagian ...` lalu `curl -s -b /tmp/cj .../api/bagian/bootstrap`.
Expected: sukses login; bootstrap bagian mengembalikan data tanpa 401.

- [ ] **Step 6: Commit**

```bash
git add new-code2/app/Controllers/Api/AuthApi.php new-code2/app/Controllers/Api/BagianApi.php new-code2/app/Views/pages/bagian.php new-code2/app/Config/Routes.php
git commit -m "feat(bagian): add bagian auth, api and ba upload view"
```

---

### Task 10: Dashboard admin — bootstrap, pengajuan, statistik, mutasi

**Files:**
- Create: `new-code2/app/Controllers/Api/DashboardApi.php`
- Modify: `new-code2/app/Views/pages/dashboard.php`
- Modify: `new-code2/app/Config/Routes.php`

**Interfaces:**
- Consumes: `BiayaService`, `AuthService`, model.
- Produces:
  - `GET /api/dashboard/bootstrap` (stats, pengajuan rows, masterBiaya, dosen, matakuliah, config dashboard).
  - `GET /api/pengajuan/{id}` (detail + status history + detail_kegiatan).
  - `PUT /api/pengajuan/{id}/status`; `PUT /api/pengajuan/{id}`; `PUT /api/pengajuan/{id}/detail/{detailId}`; `DELETE /api/pengajuan/{id}/detail/{detailId}`; `DELETE /api/pengajuan/{id}`; `PUT /api/pengajuan/{id}/biaya`.
  - `GET /api/dashboard/stats`.

Semua rute di group `admin` → `AdminFilter`. Aturan: `catatan_admin` hanya ditimpa jika non-kosong; setiap mutasi menulis `status_history` bila status berubah + `audit_log`.

- [ ] **Step 1: `DashboardApi::bootstrap`** — gabungkan agregasi `_computeDashboardStats` + `_buildPengajuanClientRows` (spec bagian 4.4). Resolve biaya via `BiayaService`. Tambah daftar `masterBiaya` terurut biaya asc.

- [ ] **Step 2: `DashboardApi::updateStatus`**

```php
public function updateStatus(string $idPengajuan)
{
    $this->requireAdmin();
    $r = $this->request->getJSON(true);
    $status = trim($r['status'] ?? '');
    $catatan = trim($r['catatan'] ?? '');
    $allowed = ['Menunggu', 'Diterima', 'Ditolak', 'ACC', 'Dibatalkan'];
    if (!in_array($status, $allowed, true)) {
        return $this->respondErr('Status tidak valid: ' . $status);
    }
    $pm = new PengajuanModel();
    $p = $pm->findByIdPengajuan($idPengajuan);
    if (!$p) {
        return $this->respondErr('Pengajuan tidak ditemukan.', 404);
    }
    $upd = ['status' => $status];
    if ($catatan !== '') {
        $upd['catatan_admin'] = $catatan;   // hanya ditimpa bila non-kosong
    }
    if ($status === 'ACC') {
        $upd['nomor_surat'] = (new NomorSuratService())->next('ACC');
    }
    $pm->update($p['id'], $upd);
    (new StatusHistoryModel())->insert([
        'pengajuan_id' => $p['id'],
        'id_pengajuan' => $idPengajuan,
        'timestamp'    => date('Y-m-d H:i:s'),
        'status'       => $status,
        'catatan'      => $catatan,
        'actor_email'  => 'admin',
    ]);
    audit_log_add('admin', 'update_status', $idPengajuan, 'status=' . $status, $catatan);
    return $this->respondOk(['message' => 'Status diperbarui.', 'nomor_surat' => $upd['nomor_surat'] ?? null]);
}
```

- [ ] **Step 3: `updateFields`, `updateDetail`, `deleteDetail`, `deletePengajuan`, `updateBiaya`**

`updateBiaya` memanggil `BiayaService::setOverride`. `deletePengajuan` menghapus pengajuan + cascade detail/status_history (FK ON DELETE CASCADE). `deleteDetail`/`updateDetail` operasi per `detail_kegiatan.id`. Semua memanggil `audit_log_add` dan tidak mengirim `keterangan`.

- [ ] **Step 4: View `dashboard.php` Vue** — tab utama; buat dari struktur `new-code1/pages/dashboard.html` dengan fetch API; setiap mutasi minta reload data.

- [ ] **Step 5: Test**

```bash
# login admin pakai cookie jar
curl -s -c /tmp/cj -X POST http://localhost:8080/api/auth/admin -H 'Content-Type: application/json' -d '{"password":"admin123"}'
curl -s -b /tmp/cj http://localhost:8080/api/dashboard/bootstrap | grep -o '"stats"' | head -1
```

Expected: respons berisi `"stats"` dan tidak 401.

- [ ] **Step 6: Commit**

```bash
git add new-code2/app/Controllers/Api/DashboardApi.php new-code2/app/Views/pages/dashboard.php new-code2/app/Config/Routes.php
git commit -m "feat(dashboard): add admin dashboard bootstrap and mutasi apis"
```

---

### Task 11: BA admin + BA bagian tab di dashboard + email ACC

**Files:**
- Create: `new-code2/app/Controllers/Api/BeritaAcaraApi.php`
- Modify: `new-code2/app/Views/pages/dashboard.php` (tab BA)
- Modify: `new-code2/app/Config/Routes.php`

**Interfaces:**
- Consumes: `EmailAccService`.
- Produces:
  - `POST /api/admin/ba`; `DELETE /api/admin/ba/{id}` — BA admin tolak 0 peserta.
  - `GET /api/admin/ba` (daftar BA admin).
  - Email: `POST /api/pengajuan/{id}/email-status`, `POST /api/pengajuan/{id}/email-final`, `POST /api/pengajuan/{id}/email-bagian`.

- [ ] **Step 1: BA admin upload/delete/list**

Replikasi aturan BA bagian (Task 9 Step 3) namun tabel `berita_acara_admin`, `sumber='Admin'`, tanpa unique kombinasi (kecuali `ba_id`), wajib `count($peserta) >= 1`.

- [ ] **Step 2: Email status**

```php
public function emailStatus(string $idPengajuan, string $kode)
{
    $this->requireAdmin();
    $p = (new PengajuanModel())->findByIdPengajuan($idPengajuan);
    if (!$p) {
        return $this->respondErr('Pengajuan tidak ditemukan.', 404);
    }
    $res = (new EmailAccService())->sendStatus($kode, [
        'nama' => $p['nama_lengkap'], 'npm' => $p['npm'], 'email' => $p['email'],
        'nomor_surat' => $p['nomor_surat'] ?? '', 'catatan' => $p['catatan_admin'] ?? '',
    ]);
    $upd = $res['ok']
        ? ['status_notifikasi_email' => 'Terkirim', 'notifikasi_terkirim_pada' => date('Y-m-d H:i:s'), 'error_notifikasi_email' => null]
        : ['status_notifikasi_email' => 'Gagal', 'error_notifikasi_email' => $res['message']];
    (new PengajuanModel())->update($p['id'], $upd);
    return $res['ok'] ? $this->respondOk(['message' => 'Email terkirim.']) : $this->respondErr('Gagal mengirim email: ' . $res['message'], 500);
}
```

`emailFinal` memakai `sendFinal` (bikin nomor surat bila belum ada), `emailBagian` memakai `sendAccFinalToBagian`.

- [ ] **Step 3: Tab BA di `dashboard.php`**

Dari `new-code1/pages/dashboard.html`: modal upload BA admin (pilih kegiatan → peserta → file) + daftar BA admin + tab BA bagian (bypass → sesi bagian) yang memakai `BagianApi` endpoint.

- [ ] **Step 4: Commit**

```bash
git add new-code2/app/Controllers/Api/BeritaAcaraApi.php new-code2/app/Views/pages/dashboard.php new-code2/app/Config/Routes.php
git commit -m "feat(ba): add admin ba and email acc endpoints + dashboard tabs"
```

---

### Task 12: Laporan (bootstrap + matriks + export) view `detail-laporan`

**Files:**
- Create: `new-code2/app/Controllers/Api/LaporanApi.php`
- Modify: `new-code2/app/Views/pages/detail-laporan.php`
- Modify: `new-code2/app/Config/Routes.php`

**Interfaces:**
- Consumes: `BiayaService`.
- Produces:
  - `GET /api/laporan/bootstrap` → `{ summary, rows, beritaAcara, dosen, blok, kategori, masterBiaya }`.
  - Aggregasi frontend matriks bagian/dosen + export XLSX (SheetJS CDN).

- [ ] **Step 1: `LaporanApi::bootstrap`**

Satu query besar (pengajuan + detail_kegiatan + status_history + BA + biaya resolved). Himpun: `rows` per pengajuan berisi `status`, `blok`, `jenis`, `dosen`, `tanggal`, `biaya` (BiayaService), `details`, `history`; `beritaAcara` daftar BA dengan `peserta`; `dosen` dan `blok` list unik. Bayangkan kontrak menyerupai `getLaporanBootstrap` GAS (bagian `laporan` spec 4.5) namun sudah normalize relasional.

- [ ] **Step 2: View `detail-laporan.php`** — dua tab (Laporan Bagian: matriks kelengkapan BA + kolom biaya + subtotal/grand total; Laporan Dosen: matriks jumlah BA, chip biaya). Replikasi `new-code1/pages/detail-laporan.html`; on-demand inject SheetJS; `setUrlHyperlinks`.

- [ ] **Step 3: Test** — render + `GET /api/laporan/bootstrap` via cookie jar admin mengembalikan JSON lengkap.

- [ ] **Step 4: Commit**

```bash
git add new-code2/app/Controllers/Api/LaporanApi.php new-code2/app/Views/pages/detail-laporan.php new-code2/app/Config/Routes.php
git commit -m "feat(laporan): add laporan bootstrap api and matrix export view"
```

---

### Task 13: API Pengaturan (10 seksi termasuk Matakuliah)

**Files:**
- Create: `new-code2/app/Controllers/Api/PengaturanApi.php`
- Modify: `new-code2/app/Config/Routes.php`

**Interfaces:**
- Consumes: model Config/MasterKegiatan/MasterMatakuliah/MasterBagian/MasterBiaya/Admin/BagianStaff/EmailTemplate/NomorSurat/AuditLog; `config_get/set`, `audit_log_add`, `AuthService`.
- Produces (semua `AdminFilter`, response list penuh setelah save):
  - `GET/PUT /api/pengaturan/umum`
  - `GET/PUT /api/pengaturan/kegiatan`
  - `GET/PUT /api/pengaturan/matakuliah` — **CRUD tambah/edit/hapus matakuliah**
  - `GET/PUT /api/pengaturan/bagian`
  - `GET/PUT /api/pengaturan/biaya`
  - `GET/PUT /api/pengaturan/pengguna`
  - `GET/PUT /api/pengaturan/email`
  - `GET/PUT /api/pengaturan/nomor-surat`
  - `GET/PUT /api/pengaturan/upload`
  - `GET/PUT /api/pengaturan/status`
  - `GET /api/pengaturan/audit`

- [ ] **Step 1: Generic CRUD untuk master sederhana**

`MasterKegiatan`, `MasterBagian`, `MasterBiaya`, `MasterMatakuliah` memakai pola: `GET` = daftar; `PUT` = `{ items: [...] }` replace-all dalam transaksi (mirip `saveMaster*` GAS) dengan return list baru.

Contoh `matakuliah`:

```php
public function matakuliahGet()
{
    $rows = (new MasterMatakuliahModel())->orderBy('nama', 'ASC')->findAll();
    return $this->respondOk($rows);
}

public function matakuliahSave()
{
    $this->requireAdmin();
    $items = $this->request->getJSON(true)['items'] ?? null;
    if (!is_array($items)) {
        return $this->respondErr('Payload items wajib array.');
    }
    $m = new MasterMatakuliahModel();
    $db = db_connect();
    $db->transStart();
    foreach ($items as $it) {
        $data = [
            'kode'   => trim($it['kode'] ?? '') ?: null,
            'nama'   => trim($it['nama'] ?? ''),
            'blok'   => trim($it['blok'] ?? '') ?: null,
            'sks'    => isset($it['sks']) && $it['sks'] !== '' ? (int) $it['sks'] : null,
            'aktif'  => isset($it['aktif']) ? (int) $it['aktif'] : 1,
        ];
        if ($data['nama'] === '') {
            continue;
        }
        if (!empty($it['id'])) {
            $m->update((int) $it['id'], $data);
        } else {
            $m->insert($data);
        }
    }
    $db->transComplete();
    audit_log_add('admin', 'save_master', 'master_matakuliah', 'items=' . count($items));
    return $this->respondOk((new MasterMatakuliahModel())->orderBy('nama', 'ASC')->findAll());
}
```

`PUT` juga mendukung hapus: payload item `{ id, _delete: true }` → `$m->delete($id)`. Implementer menerapkan pola yang sama (id + _delete) di keempat controller master agar UI tab seragam.

- [ ] **Step 2: `umum`, `upload`, `status`, `pengguna`, `email`, `nomor-surat`, `audit`**

- `umum`: GET = `{APP_NAME, TIMEZONE, BUKTI_MODE, BAGIAN_BA_STATUSES(json), BAGIAN_BA_FINAL_ONLY}`; PUT simpan ke `config` via `config_set`.
- `upload`: GET = `{UPLOAD_MAX_BYTES, UPLOAD_MIME_WHITELIST}`; PUT → config.
- `status`: GET daftar status tetap (`['Menunggu','Diterima','Ditolak','ACC','Dibatalkan']`) + `BAGIAN_BA_STATUSES` + peta pembuat (default) dari `config`; PUT → config `STATUS_ROLES` (JSON).
- `pengguna`: GET daftar admin + staf (tanpa hash); PUT: simpan/update; jika password diisi → `password_hash(password_hash($pw, PASSWORD_DEFAULT))`; _delete hapus.
- `email`: GET daftar `email_templates` + status SMTP (host, port, user dari Config\Email — tanpa password); PUT simpan template (kode/subjek/body/aktif).
- `nomor-surat`: GET list; PUT set `last_number` + tambah baris tahun baru bila belum ada.
- `audit`: GET `{ logs: limit 200 terbaru, counts: jumlah baris tiap tabel }`.

- [ ] **Step 3: Test** — PUT matakuliah tambah item baru; GET kembali berisi item; hapus dengan `_delete`.

```bash
curl -s -b /tmp/cj -X PUT http://localhost:8080/api/pengaturan/matakuliah -H 'Content-Type: application/json' -d '{"items":[{"nama":"Anatomi","kode":"ANA201","blok":"Blok 2","sks":2}]}'
```

Expected: response array berisi `Anatomi`.

- [ ] **Step 4: Commit**

```bash
git add new-code2/app/Controllers/Api/PengaturanApi.php new-code2/app/Config/Routes.php
git commit -m "feat(pengaturan): add settings api incl matakuliah crud"
```

---

### Task 14: View Pengaturan (settings page lengkap, tab Matakuliah pertama)

**Files:**
- Create: `new-code2/app/Views/pages/pengaturan.php`
- Modify: `new-code2/app/Config/Routes.php` (tidak perlu bila sudah ada rute page)

**Interfaces:**
- Consumes: semua endpoint Task 13.
- Produces: halaman admin `/pengaturan` tab-pill.

- [ ] **Step 1: Struktur Vue halaman**

Satu `#app`, tab pill memakai pola `detail-laporan` (indigo→violet). State: `tab`, `saving`, `list*`, `cfg*`, `toast`.

Tab (dengan tab **Matakuliah** disorot sebagai salah satu tab utama):

```js
tabs: [
  { key: 'umum',        label: 'Umum',         icon: 'bi-gear' },
  { key: 'matakuliah',  label: 'Matakuliah',   icon: 'bi-book' },
  { key: 'kegiatan',    label: 'Master Kegiatan', icon: 'bi-diagram-3' },
  { key: 'bagian',      label: 'Master Bagian', icon: 'bi-people' },
  { key: 'biaya',       label: 'Master Biaya',  icon: 'bi-cash-coin' },
  { key: 'pengguna',    label: 'Pengguna',      icon: 'bi-person-badge' },
  { key: 'email',       label: 'Email & Template', icon: 'bi-envelope' },
  { key: 'nomor',       label: 'Nomor Surat',   icon: 'bi-file-earmark-text' },
  { key: 'upload',      label: 'Upload',        icon: 'bi-cloud-arrow-up' },
  { key: 'status',      label: 'Alur Status',   icon: 'bi-arrow-repeat' },
  { key: 'audit',       label: 'Audit',         icon: 'bi-clock-history' }
]
```

- [ ] **Step 2: Tab Matakuliah**

Grid form "Tambah Matakuliah" (kode, nama, blok, SKS, aktif) + tabel list dengan tombol edit inline / hapus per baris (`_delete: true`). Simpan kirim seluruh baris sebagai `items` ke `PUT /api/pengaturan/matakuliah`, lalu tampilkan list baru. Pesan sukses via toast; halaman reload list dari response.

- [ ] **Step 3: Tab lain**

Setiap tab: GET saat `mounted` per tab aktif (lazy), form/simpan PUT, toast sukses/gagal. Tab Pengguna khusus: tambah baris admin (nama + password opsional) atau staf bagian (email+kategori+nama+password). Tab Audit: tabel logs + tombol refresh.

- [ ] **Step 4: Guard + CSRF meta**

Halaman `/pengaturan` harus admin: PageController `show('pengaturan')` cek `AuthService::isAdmin()`, redirect ke `/` bila bukan admin. Meta CSRF wajib di head.

- [ ] **Step 5: Verifikasi visual + sintaks**

```bash
php -l new-code2/app/Views/pages/pengaturan.php
curl -s -b /tmp/cj http://localhost:8080/pengaturan | grep -o 'Matakuliah' | head -1
```

Expected: halaman mengembalikan HTML berisi kata `Matakuliah`; tidak ada error PHP.

- [ ] **Step 6: Commit**

```bash
git add new-code2/app/Views/pages/pengaturan.php new-code2/app/Controllers/PageController.php
git commit -m "feat(pengaturan): add settings page with matakuliah and master tabs"
```

---

### Task 15: Download file terautentikasi + finalisasi aturan (email/surat/matkul ke laporan)

**Files:**
- Create: `new-code2/app/Controllers/FileApi.php`
- Modify: `new-code2/app/Views/pages/detail-laporan.php` (menampilkan kolom matakuliah jika diinginkan)
- Modify: `new-code2/app/Config/Routes.php`

**Interfaces:**
- Produces: `GET /files/{jenis}/{idPengajuan}` → file (admin/bagian penuh; mahasiswa hanya milik NPM sendiri).

- [ ] **Step 1: `FileApi::index`**

```php
public function index(string $jenis, string $idPengajuan)
{
    $allowed = ['acc', 'bukti', 'ba', 'final'];
    if (!in_array($jenis, $allowed, true)) {
        return $this->respondErr('Jenis file tidak dikenal.', 404);
    }
    $auth = (new AuthService());
    $pm = new PengajuanModel();
    $p = $pm->findByIdPengajuan($idPengajuan);
    if (!$p) {
        return $this->respondErr('Pengajuan tidak ditemukan.', 404);
    }
    // mahasiswa: hanya bukti miliknya sendiri (npm dikirim via query ?npm=)
    if (!$auth->isAdmin() && !$auth->isBagian()) {
        $npm = trim($this->request->getGet('npm') ?? '');
        if ($npm === '' || $npm !== $p['npm'] || $jenis !== 'bukti') {
            return $this->respondErr('Tidak diizinkan.', 403);
        }
    }
    $col = 'path_' . ($jenis === 'acc' ? 'acc_inhal' : ($jenis === 'bukti' ? 'bukti_bayar' : $jenis));
    $path = $p[$col] ?? null;
    if (!$path) {
        return $this->respondErr('File belum tersedia.', 404);
    }
    $full = WRITEPATH . 'uploads/' . $path;
    if (!is_file($full)) {
        return $this->respondErr('File tidak ditemukan di server.', 404);
    }
    return $this->response->setHeader('Content-Type', mime_content_type($full))
        ->setHeader('Content-Disposition', 'inline; filename="' . basename($path) . '"')
        ->setBody(file_get_contents($full));
}
```

Route: `$routes->get('files/(:segment)/(:segment)', 'FileApi::index/$1/$2');` (di luar group API; tanpa filter CSRF).

- [ ] **Step 2: Lengkapi jalur email-final / BA bagian final** — hubungkan `sendFinal` GAS (kirim PDF final bila ada) memakai SMTP + lampiran dari path `final`. Jangan menampilkan secret.

- [ ] **Step 3: Verifikasi** — dengan cookie admin/bagian akses `/files/bukti/{id}` sukses; tanpa sesi → 403. Cek matakuliah muncul di laporan rows bila ditampilkan.

- [ ] **Step 4: Commit**

```bash
git add new-code2/app/Controllers/FileApi.php new-code2/app/Config/Routes.php
git commit -m "feat(files): add authenticated file serving"
```

---

### Task 16: Test PHPUnit inti

**Files:**
- Create: `new-code2/tests/_support/` (if needed)
- Create: `new-code2/tests/unit/BiayaServiceTest.php`
- Create: `new-code2/tests/unit/AuthServiceTest.php`
- Create: `new-code2/tests/feature/RegisterPengajuanTest.php`
- Create: `new-code2/tests/feature/BaDuplicateTest.php`
- Modify: `new-code2/phpunit.xml.dist`

**Interfaces:**
- Produces: perintah `php vendor/bin/phpunit tests` hijau.

- [ ] **Step 1: Tulis test**

`BiayaServiceTest` (resolve override > master), `AuthServiceTest` (login sukses/gagal, bagian), `RegisterPengajuanTest` (validasi email/HP; duplikat → 409), `BaDuplicateTest` (duplikat BA DATE-only ditolak; tanggal `2026-01-15` vs `2026-01-15T00:00:00` dianggap sama), dan cek `catatan_admin` tidak ditimpa saat `catatan=''`.

```php
<?php

namespace Tests\Unit;

use CodeIgniter\Test\CIUnitTestCase;
use App\Libraries\BiayaService;

final class BiayaServiceTest extends CIUnitTestCase
{
    public function testOverrideMenangAtasMaster(): void
    {
        $svc = new BiayaService();
        // siapkan pengajuan + master_biaya UTS=50000 lalu override 75000
        $this->assertSame(75000.0, $svc->resolve($pengajuanId, 'UTS'));
    }

    public function testTanpaOverridePakaiMaster(): void
    {
        $svc = new BiayaService();
        $this->assertSame(50000.0, $svc->resolve($pengajuanId, 'UTS'));
    }
}
```

- [ ] **Step 2: Jalankan dan pastikan lulus**

Run: `cd /workspace/new-code2 && vendor/bin/phpunit tests`
Expected: semua test PASS (jumlah sesuai file test).

- [ ] **Step 3: Commit**

```bash
git add new-code2/tests new-code2/phpunit.xml.dist
git commit -m "test: add core unit and feature tests"
```

---

### Task 17: Verifikasi akhir + cek sintaks frontend + dokumen README `new-code2`

**Files:**
- Create: `new-code2/README.md`
- Create: `new-code2/.gitignore` (bila belum dari starter)

**Interfaces:**
- Produces: app siap preview + dokumentasi.

- [ ] **Step 1: Verifikasi komprehensif**

```bash
# lint semua php
find new-code2/app -name '*.php' -exec php -l {} \; | grep -v 'No syntax errors' || echo 'PHP OK'
# cek view inline JS via node
node -e "console.log('vue syntax check dilakukan per view manual')"
# import ulang db dari bersih
mysql -u root < new-code2/database/inhal.sql
# smoke 6 halaman
php -S localhost:8080 -t new-code2/public >/tmp/ci.log 2>&1 &
for p in / /portal /bagian /dashboard /laporan /pengaturan; do code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080$p); echo "$p -> $code"; done
kill %1
```

Expected: semua halaman `200`; import sukses.

- [ ] **Step 2: Tulis README `new-code2/README.md`** — cara install (composer, .env, import sql, seed admin), daftar halaman, akun bawaan (admin/admin123, staf sgd), struktur, konvensi.

- [ ] **Step 3: Commit**

```bash
git add new-code2/README.md new-code2/.gitignore
git commit -m "docs: add new-code2 readme and gitignore"
```

---

### Task 18: Preview web + dokumentasi hasil

**Files:**
- Modify: (deploy env) sesuai skill `deploy-website`.

- [ ] **Step 1: Jalankan via skill deploy-website** dan beri user URL preview.
- [ ] **Step 2: Catat hasil** (URL, akun uji) pada balasan terakhir ke user.

---

## Self-Review

**Spec coverage:**
- Skema DB → Task 2; model → Task 3; libs → Task 4; filter/base → Task 5; 6 halaman → Task 6 (shell) + 7–14 (isi); pendaftaran → Task 7 (termasuk matakuliah); portal → Task 8; bagian/BA bagian → Task 9; dashboard → Task 10; BA admin + email → Task 11; laporan → Task 12; pengaturan (11 tab incl Matakuliah) → Task 13+14; file serve → Task 15; testing → Task 16; README → Task 17; preview → Task 18. `email_templates`/nomor surat/upload/status/audit masuk Task 13/14.

**Placeholder scan:** tidak ada TBD/TODO. Catatan yang disengaja (hash seed, kolom `kegiatan` vs `pilihan` di override, PDF strict lanjutan, CSRF-header) diberi instruksi eksplisit pilihan untuk implementer.

**Type consistency:** nama kolom model mengikuti Task 2; kontrak helper (`config_get`, `inhal_id`, `audit_log_add`) konsisten; endpoint list di Task 7–15 konsisten dengan rute yang dipakai view Task 7–14.
