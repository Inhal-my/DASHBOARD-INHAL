# Proses Rilis

Panduan CI/CD, staging, migrasi, dan E2E untuk `new-code1-cf`.

Desain: `docs/superpowers/specs/2026-10-18-release-process-design.md`.

## Ringkasan alur

```text
PR / push main
      |
      v
    CI: test + csp:check + migrations:check + dry-run
      |
      v (push main sukses)
Deploy Staging (otomatis)
      |
      v
E2E Staging (smoke Playwright)

Deploy Production (manual, environment approval)
```

## Secret repository

Tambahkan di GitHub: **Settings > Secrets and variables > Actions**.

| Secret | Keterangan |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token dengan izin Workers Scripts dan D1 (R2 tidak dipakai) |
| `CLOUDFLARE_ACCOUNT_ID` | `e2efd255f61d2b81c7f54c92eb57b946` |
| `STAGING_ADMIN_PASSWORD` | Password admin staging untuk seed dan E2E (minimal 12 karakter) |

Buat environment **staging** dan **production** di GitHub. Untuk `production`,
aktifkan **Required reviewers** agar deploy menunggu persetujuan.

## CI

Workflow `.github/workflows/ci.yml` berjalan pada PR dan push `main` yang menyentuh
`new-code1-cf/**`.

Langkah:

1. `npm ci`
2. `npm test` (Vitest Workers pool)
3. `npm run test:scripts` (tooling rilis)
4. `npm run csp:check`
5. `npm run migrations:check -- --base <sha>`
6. `npx wrangler deploy --dry-run`

CI tidak memakai secret Cloudflare dan tidak melakukan deploy.

## Migrasi

Mesin migrasi: `wrangler d1 migrations` dengan tabel `d1_migrations`.

Aturan:

- File baru: `migrations/YYYY-MM-DD-nama-file.sql` (huruf kecil, tanda hubung) dan
  tanggalnya harus setelah migrasi terakhir.
- File migrasi lama **tidak boleh** diubah, dihapus, atau di-rename. CI menolak
  perubahan tersebut terhadap base branch.
- Tambahkan maksimal satu file migrasi per rilis. Jika perlu lebih dari satu,
  terapkan bertahap sesuai urutan tanggal agar urutan Wrangler tetap pasti.
- Jangan menambahkan `DROP`/`DELETE` tanpa alasan dan backup.
- Sebelum migrasi produksi: buat backup SQL dengan `wrangler d1 export` dan catat
  bookmark D1 Time Travel.

Perintah:

```bash
# Daftar migrasi tertunda
npx wrangler d1 migrations list inhal-poc --remote

# Terapkan migrasi tertunda
npx wrangler d1 migrations apply inhal-poc --remote
```

### Baseline

Database produksi dan staging sudah memiliki skema terkini tetapi belum memiliki
tabel pelacak. Baseline dijalankan sekali:

```bash
# Produksi (setelah backup)
node scripts/migrations-baseline.mjs --apply --database inhal-poc --remote

# Staging
node scripts/migrations-baseline.mjs --apply --database inhal-poc-staging --remote --config wrangler.staging.toml
```

Baseline hanya membuat `d1_migrations` dan mendaftarkan 21 migrasi yang sudah
diterapkan; tidak mengubah skema aplikasi.

## Staging

| Item | Nilai |
|---|---|
| Worker | `inhal-form-staging` |
| URL | https://inhal-form-staging.prodi.workers.dev |
| D1 | `inhal-poc-staging` (`ca9a999b-51dc-4a0d-8588-edf25191aa5a`, APAC) |
| Konfigurasi | `wrangler.staging.toml` |
| Data | sintetis dari `schema.sql` |

Staging tidak memiliki binding R2/Workflow dan tidak menjalankan backup harian. Unggah
berkas ke Drive juga tidak dikonfigurasi; jangan gunakan staging untuk menguji unggah
ke Drive asli.

### Seed admin staging

Deploy Staging otomatis menjalankan seed admin bila secret
`STAGING_ADMIN_PASSWORD` tersedia. Seed membuat atau memperbarui akun
`Staging Admin` dan menonaktifkan MFA akun tersebut agar E2E dapat login.

Workflow **Seed Staging Admin** tersedia untuk menjalankan seed manual (mis. setelah
mengganti password staging).

Untuk lokal:

```bash
export STAGING_ADMIN_PASSWORD='<password-minimal-12-karakter>'
npm run seed:staging -- --apply --remote --config wrangler.staging.toml
```

## Deploy staging

Workflow **Deploy Staging** berjalan otomatis setelah CI sukses di `main`, atau
manual lewat `workflow_dispatch`.

Langkah: apply migrasi tertunda D1 staging -> seed admin staging (bila secret tersedia)
-> `wrangler deploy --config wrangler.staging.toml` -> smoke check `/api/health`.

## Deploy produksi

Workflow **Deploy Production** hanya manual (`workflow_dispatch`), memakai environment
`production` dengan required reviewer.

Input `apply_migrations`:

- `false` (default): hanya menampilkan migrasi tertunda, lalu deploy.
- `true`: menerapkan migrasi tertunda sebelum deploy.

Langkah: test -> CSP check -> tampilkan migrasi tertunda -> (opsional) apply ->
deploy -> smoke check `/api/health`.

Deploy produksi memakai `wrangler.production.toml`. Kedua konfigurasi tidak memuat
binding R2/Workflow karena jalur backup R2 dibatalkan; backup harian ditangani
GitHub Actions (lihat bagian *Backup harian*).

Sebelum menjalankan dengan `apply_migrations=true`:

1. Backup D1 produksi (jalankan workflow **Backup D1**, atau `wrangler d1 export`
   manual; lihat bagian *Backup harian* di bawah).
2. Pastikan migrasi bersifat aditif dan sudah diuji di staging.
3. Catat bookmark Time Travel.

## Backup harian

Backup tidak memakai R2 atau Cloudflare Workflows. Workflow
`.github/workflows/backup-d1.yml` (**Backup D1**) berjalan setiap hari pukul
`0 18 * * *` UTC (01:00 WIB) dan bisa dijalankan manual:

1. `wrangler d1 export inhal-poc --remote` (baca-saja).
2. `scripts/verify-backup.mjs` untuk invariant bisnis.
3. `scripts/backup-snapshot.mjs` untuk snapshot JSON, XLSX, dan `manifest.json`.
4. Artefak `d1-backup-<label>` (retensi 3 hari).
5. Bila secret Drive tersedia: arsip terenkripsi AES-256-GCM dicerminkan ke Google
   Drive lewat Drive Bridge, arsip lebih dari 3 hari dipindahkan ke trash.
6. `scripts/backup-report.mjs` menulis ringkasan run dan menggagalkan run bila
   ukuran D1 menyentuh batas paket.
7. Issue berlabel `backup-failed` dibuka otomatis saat run gagal dan ditutup
   otomatis pada run berikutnya yang sukses.

Secret tambahan: `DRIVE_BRIDGE_URL`, `DRIVE_BRIDGE_TOKEN`, `BACKUP_PASSPHRASE`
(minimal 12 karakter). Tanpa ketiganya, langkah Drive dilewati dan hanya artefak
GitHub yang dibuat.

Prosedur restore dan ambang ukuran: `docs/ops/backup-restore.md`.
Peta komponen dan skenario kegagalan: `docs/ops/arsitektur-dan-failover.md`.

## E2E

Workflow **E2E Staging** berjalan setelah Deploy Staging sukses, manual, dan setiap
hari pukul 02:00 UTC.

Cakupan smoke:

- Portal publik `/` terbuka dan validasi NPM tidak terdaftar memberi pesan.
- Login admin staging berhasil.
- Navigasi dashboard: Verifikasi Pengajuan, Statistik, Berita Acara, Master Data.
- Modal Audit Integritas Data dan Keamanan Akun terbuka.
- Menu mobile dapat dibuka, tab berpindah, dan logout kembali ke login.

Lokal (dari `new-code1-cf/`):

```bash
export E2E_BASE_URL='https://inhal-form-staging.prodi.workers.dev'
export STAGING_ADMIN_PASSWORD='<password-admin-staging>'
node e2e/smoke.cjs
```

Jika gagal, screenshot disimpan di `/tmp/inhal-e2e-failure.png` dan diunggah sebagai
artifact workflow.

## Restore drill staging

Workflow **Restore Drill Staging** (`.github/workflows/restore-drill-staging.yml`)
hanya manual dan tidak mengubah staging maupun produksi. Workflow ini:

1. Mengekspor D1 staging secara baca-saja.
2. Menjalankan `scripts/verify-backup.mjs` pada dump.
3. Mengimpor dump ke database scratch lokal di runner.
4. Mengekspor ulang, memverifikasi, dan membandingkan jumlah tabel inti.
5. Menjalankan Worker lokal terhadap database hasil restore, lalu memeriksa
   `/api/health`, opsi pendaftaran, portal mahasiswa, dan halaman `/portal`.

Jalankan dari tab Actions, pilih **Restore Drill Staging**, lalu **Run workflow**.
Bukti verifikasi diunggah sebagai artifact `restore-drill-evidence` selama 14 hari.
Hasil ini dipakai untuk UAT-O05 di `docs/ops/uat.md`.

## Audit duplikat jadwal

Jalankan audit dry-run sebelum membersihkan jadwal duplikat:

```bash
cd new-code1-cf
npm run audit:jadwal -- /tmp/opencode/jadwal-staging.sql
```

Script hanya membaca dump dan tidak menghasilkan perintah hapus. Prosedur lengkap:
`docs/ops/data-quality.md`.

## UAT dan aksesibilitas

Sebelum deploy produksi, jalankan matriks UAT di `docs/ops/uat.md` pada staging.
Kasus yang menulis data hanya dilakukan di staging. Produksi hanya untuk smoke
read-only.

Pemeriksaan aksesibilitas otomatis ada di `test/accessibility.test.js` dan berjalan
sebagai bagian dari `npm test` (label formulir, nama dialog, `role="alert"`,
`aria-live`, bahasa, viewport, dan alt gambar).

## Rollback

- **Worker**: gunakan riwayat deploy Cloudflare atau `wrangler rollback`.
- **Migrasi**: hentikan workflow; pulihkan dengan D1 Time Travel atau backup SQL
  pra-migrasi. Migrasi yang sudah diterapkan tidak dihapus dari `d1_migrations`.
- **Staging rusak**: deploy ulang dari `main`; data staging boleh di-reset dari
  `schema.sql` karena sintetis.

## Checklist pertama kali

1. Tambahkan tiga secret repository.
2. Buat environment `staging` dan `production`; pasang required reviewer di production.
3. Push perubahan; CI berjalan otomatis.
4. Setelah CI sukses, Deploy Staging berjalan otomatis (migrasi + seed admin + deploy).
5. E2E Staging berjalan otomatis setelah Deploy Staging; cek hasilnya di tab Actions.
6. Jika seed perlu diulang, jalankan **Seed Staging Admin** manual.
7. Verifikasi run **Backup D1** pertama sukses (artefak + arsip Drive) sebelum
   mengaktifkan jadwal produksi.
