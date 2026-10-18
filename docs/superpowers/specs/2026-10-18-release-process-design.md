# Desain Proses Rilis (Poin 5)

Tanggal: 2026-10-18
Status: disetujui, diimplementasikan bertahap.

## Tujuan

Mengubah rilis dari langkah manual menjadi alur yang dapat diulang dan diaudit:

1. CI menjalankan test, pemeriksaan CSP, dan guard migrasi pada setiap PR/push.
2. Staging terpisah dari produksi dengan database sintetis.
3. Migrasi dilacak oleh `wrangler d1 migrations` dan hanya boleh ditambah, bukan diubah.
4. Deploy produksi memerlukan persetujuan manusia dan opsi migrasi eksplisit.
5. Smoke test browser memverifikasi alur inti setelah deploy staging.

## Keputusan

- **Bertahap**: CI -> baseline/staging -> workflow deploy -> E2E.
- **Staging**: D1 `inhal-poc-staging` terpisah, data sintetis dari `schema.sql`, admin uji di-seed dari `STAGING_ADMIN_PASSWORD`. Tidak memakai data produksi.
- **Deploy**: staging otomatis dari `main`; produksi hanya `workflow_dispatch` dengan environment `production` dan required reviewer.
- **Migrasi**: mesin native Wrangler (`d1_migrations`) dengan baseline sekali untuk database yang sudah ada, plus guard CI.
- **E2E**: Playwright smoke terbatas pada portal publik, login admin, dashboard, dan modal Keamanan Akun.

## Komponen

### CI

`.github/workflows/ci.yml` pada PR/push `main`, hanya untuk perubahan `new-code1-cf/**`:

- Node 22, `npm ci`.
- `npm test` (Vitest Workers pool).
- `npm run test:scripts` (test Node untuk tooling rilis).
- `npm run csp:check`.
- `npm run migrations:check -- --base <ref>` untuk PR/push.
- `npx wrangler deploy --dry-run`.

Tidak memakai secret Cloudflare.

### Guard migrasi

`scripts/check-migrations.mjs`:

- Semua file di `migrations/` harus cocok `YYYY-MM-DD-nama.sql`.
- Urutan diambil dari nama file.
- File lama tidak boleh diubah atau dihapus. Perbandingan memakai
  `git diff --name-status --diff-filter=MDR <base> -- migrations`.
- Migrasi baru ditambahkan sebagai file baru.

### Baseline

Database yang sudah berjalan belum memiliki tabel `d1_migrations`.
`scripts/migrations-baseline.mjs` membuat SQL:

```sql
CREATE TABLE IF NOT EXISTS d1_migrations (...);
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('<nama-file>');
```

Baseline hanya menulis tabel pelacak, tidak mengubah skema aplikasi.
Dijalankan sekali pada produksi (setelah backup) dan staging (setelah `schema.sql`).
Setelah itu `wrangler d1 migrations list/apply` menjadi sumber kebenaran.

### Staging

- Worker: `inhal-form-staging`.
- D1: `inhal-poc-staging` (APAC).
- Konfigurasi: `wrangler.staging.toml` tanpa `[[workflows]]`/`[[r2_buckets]]`.
- Seed: `schema.sql` (sintetis) + `scripts/seed-staging.mjs` untuk admin uji.
- URL: `https://inhal-form-staging.prodi.workers.dev`.

### Workflow deploy

- `deploy-staging.yml`: berjalan setelah CI sukses di `main`, environment `staging`,
  menerapkan migrasi tertunda lalu deploy.
- `deploy-production.yml`: `workflow_dispatch`, environment `production`, input
  `apply_migrations`. Menjalankan test, menampilkan migrasi tertunda, menerapkan bila
  dipilih, lalu deploy dan smoke check `/api/health`.

Secret repository:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `STAGING_ADMIN_PASSWORD`

### E2E

- `playwright.config.js`, `e2e/smoke.spec.js`.
- Target `E2E_BASE_URL` (default staging).
- Skenario: portal publik memuat, login admin berhasil, dashboard tampil, modal
  Keamanan Akun terbuka.
- Dijalankan setelah deploy staging dan bisa manual/nightly.

## Rollback dan kegagalan

- Deploy produksi gagal: Worker versi sebelumnya tetap aktif; gunakan riwayat deploy
  Cloudflare atau `wrangler rollback`.
- Migrasi gagal: workflow berhenti sebelum deploy. Pulihkan dengan D1 Time Travel atau
  backup SQL pra-migrasi.
- E2E gagal: staging ditandai tidak sehat; produksi tidak terpengaruh.

## Di luar lingkup

- Deploy produksi otomatis dari tag.
- Menyalin data produksi ke staging.
- Backup otomatis sebelum migrasi (menunggu R2 aktif); sementara dicatat manual.
