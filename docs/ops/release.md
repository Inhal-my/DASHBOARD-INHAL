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
| `CLOUDFLARE_API_TOKEN` | Token dengan izin Workers Scripts, D1, dan Workers R2 (bila nanti dipakai) |
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

Staging tidak memiliki binding Workflow/R2 sampai R2 aktif. Unggah berkas ke Drive
juga tidak dikonfigurasi; jangan gunakan staging untuk menguji unggah ke Drive asli.

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

Saat ini deploy produksi memakai `wrangler.production.toml` (tanpa binding
Workflow/R2) karena R2 belum aktif. Setelah R2 aktif dan bucket backup tersedia,
ganti langkah deploy ke `npx wrangler deploy` dengan `wrangler.toml`.

Sebelum menjalankan dengan `apply_migrations=true`:

1. Backup D1 produksi.
2. Pastikan migrasi bersifat aditif dan sudah diuji di staging.
3. Catat bookmark Time Travel.

## E2E

Workflow **E2E Staging** berjalan setelah Deploy Staging sukses, manual, dan setiap
hari pukul 02:00 UTC.

Cakupan smoke:

- Portal publik `/portal` terbuka.
- Login admin staging berhasil.
- Sidebar dashboard tampil.
- Modal Keamanan Akun terbuka.

Lokal:

```bash
export E2E_BASE_URL='https://inhal-form-staging.prodi.workers.dev'
export STAGING_ADMIN_PASSWORD='<password-admin-staging>'
NODE_PATH="$(npm root -g)" node e2e/smoke.cjs
```

Jika gagal, screenshot disimpan di `/tmp/inhal-e2e-failure.png` dan diunggah sebagai
artifact workflow.

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
7. Setelah R2 aktif: tambahkan binding backup ke staging bila perlu, lalu deploy
   produksi dengan konfigurasi lengkap.
