# Deploy `new-code1-cf` ke Cloudflare

Panduan langkah demi langkah memindahkan isi `new-code1-cf` ke Cloudflare (Worker + Static Assets + D1). Semua perintah dijalankan dari dalam direktori `new-code1-cf/`.

## Info deploy saat ini

| Item | Nilai |
|---|---|
| Akun Cloudflare | `inhal1` (`e2efd255f61d2b81c7f54c92eb57b946`) |
| Worker name | `inhal-form` |
| URL | https://inhal-form.prodi.workers.dev |
| D1 database | `inhal-poc` (`8f412848-d213-4bb3-aeb7-0aff221f9ee3`, region APAC) |
| Workers.dev subdomain | `prodi` |

## Rilis (CI/CD)

Rilis sekarang memakai GitHub Actions dan migrasi native Wrangler. Ringkasan:

- CI: test, `csp:check`, guard migrasi, dan `wrangler deploy --dry-run`.
- Staging otomatis dari `main` ke `inhal-form-staging`.
- Produksi hanya lewat workflow manual dengan approval.
- Migrasi: `npx wrangler d1 migrations list/apply` (bukan `d1 execute` per file).

Panduan lengkap, daftar secret, baseline, dan rollback: `../docs/ops/release.md`.
Langkah manual di bawah tetap berguna untuk operasi darurat atau deploy pertama.

## 0. Prasyarat

- Node.js 22+ dan npm
- Akun Cloudflare
- Dependency terpasang:

```bash
npm install
```

## 1. Autentikasi

Pilih salah satu.

### Opsi 1a: Login interaktif (butuh browser di mesin yang sama)

```bash
npx wrangler login
```

### Opsi 1b: API token (untuk server/headless)

Buat token di dashboard: ikon profil > **My Profile** > **API Tokens** > **Create Token** > template **Edit Cloudflare Workers**, lalu tambahkan permission **Account > D1 > Edit**.

Simpan token ke environment variable (jangan tulis ke `wrangler.toml`, jangan commit ke Git):

```bash
# jalankan di terminal Anda, bukan lewat chat
printf '%s' '<TOKEN_ANDA>' > /root/.cf_token
chmod 600 /root/.cf_token
```

Setiap perintah wrangler berikutnya dijalankan dengan token dari file:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler <perintah>
```

Cek akun yang aktif:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler whoami
```

## 2. Siapkan database D1

Buat database (lewati jika sudah ada):

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 create inhal-poc
```

Salin `database_id` dari output ke `wrangler.toml` **dan** `wrangler.production.toml`,
bagian `[[d1_databases]]`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "inhal-poc"
database_id = "<database_id dari output>"
```

## 3. Terapkan skema ke D1

Untuk PoC (berisi `DROP TABLE` + seed data dummy):

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=./schema.sql
```

Untuk produksi, buat file migrasi terpisah tanpa `DROP TABLE` dan tanpa seed, lalu jalankan file itu.

Migrasi panel admin (`CREATE TABLE IF NOT EXISTS`, aman untuk data yang sudah ada):

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=./migrations/2026-09-10-admin-panels.sql
```

> **Penting — jangan campur `schema.sql` dengan `migrations/*.sql`.** `schema.sql` sudah
> memuat seluruh kolom terkini. Untuk database **baru**, jalankan `schema.sql` saja. File di
> `migrations/` hanya untuk database **lama** yang belum punya kolom hasil migrasi, karena
> `ALTER TABLE ADD COLUMN` akan gagal `duplicate column name` bila dijalankan di atas
> `schema.sql`. Jalankan migrasi berurutan sesuai tanggal dan jangan mengulang migrasi yang
> sudah pernah diterapkan.

### 3.1 Migrasi BA Pendukung (sekali, sebelum deploy Worker baru)

Migrasi `2026-10-12-ba-pendukung-berkas.sql` menambah kolom `updated_at`/`needs_regen` pada
`berita_acara_admin`, kolom `urutan`/`active` pada `berita_acara_admin_peserta`, serta tabel
`berita_acara_admin_berkas`. Jalankan migrasi ini **sebelum** men-deploy Worker baru, karena
kode baru membaca kolom dan tabel tersebut:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=./migrations/2026-10-12-ba-pendukung-berkas.sql
```

> **Penting — migrasi native.** Database produksi sudah di-baseline ke tabel
> `d1_migrations`. Gunakan `npx wrangler d1 migrations apply inhal-poc --remote` untuk
> migrasi baru. Perintah `d1 execute` per file di atas hanya untuk operasi darurat;
> jangan mengulang file yang sudah tercatat di `d1_migrations`.

### 3.2 Migrasi BA Pendukung — berkas PDF (sekali, sebelum deploy Worker baru)

Migrasi `2026-10-12-ba-pendukung-pdf.sql` menambah kolom `page_count` pada
`berita_acara_admin_berkas` (jumlah halaman tiap berkas: gambar = 1, PDF = N).
Jalankan **sebelum** men-deploy Worker baru:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=./migrations/2026-10-12-ba-pendukung-pdf.sql
```

> **Penting — sekali jalan.** `ALTER TABLE ADD COLUMN` tidak bisa diulang
> (gagal `duplicate column name`). Jangan mengulang file yang sudah diterapkan.

Migrasi `2026-10-12-ba-pendukung-byte-size.sql` menambah kolom `byte_size` pada
`berita_acara_admin_berkas` (ukuran sumber tiap berkas dalam byte, untuk batas total 20 MB
per BA). Jalankan **sebelum** men-deploy Worker baru:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=./migrations/2026-10-12-ba-pendukung-byte-size.sql
```

> **Penting — sekali jalan.** `ALTER TABLE ADD COLUMN` tidak bisa diulang
> (gagal `duplicate column name`). Jangan mengulang file yang sudah diterapkan.

### 3.3 Migrasi pemulihan berkas BA Pendukung (sekali, opsional)

Migrasi `2026-10-15-ba-pendukung-berkas-reactivate.sql` memulihkan peserta BA Pendukung
yang aktif tetapi tidak punya berkas aktif sama sekali (mis. berkas lama tergusur tanpa
pengganti, atau peserta dihapus lalu ditambah ulang tanpa unggah berkas baru). Migrasi
mengaktifkan kembali seluruh halaman pada batch unggahan terakhir per peserta dan menandai
BA terkait agar PDF-nya dibuat ulang. File ini hanya berisi `UPDATE` (tanpa `ALTER TABLE`),
sehingga **aman dijalankan berulang**:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=./migrations/2026-10-15-ba-pendukung-berkas-reactivate.sql
```

> Peserta hasil impor sheet `BeritaAcaraAdminPeserta` yang belum pernah punya berkas tetap
> tanpa berkas (memang belum ada) dan perlu diunggah lewat modal "Kelola BA Pendukung".
> Setelah perubahan kode ini, badge "BA Ada" hanya muncul bila peserta benar-benar punya
> minimal satu berkas aktif.

### 3.4 Migrasi backfill `id_pengajuan` peserta BA Pendukung (sekali)

Sheet sumber `BeritaAcaraAdminPeserta` tidak punya kolom `ID Pengajuan`, sehingga peserta
hasil impor menyimpan `id_pengajuan` kosong dan berkasnya tidak bisa diunggah lewat modal
"Kelola BA Pendukung" (`setBaAdminPesertaBerkas` menolak pengajuan kosong). Migrasi
`2026-10-15-ba-pendukung-peserta-id-pengajuan-backfill.sql` memetakan tiap peserta tanpa
`id_pengajuan` ke tepat satu pengajuan ber-NPM sama; baris dengan kandidat ambigu dibiarkan
kosong agar tidak salah pasang. File ini hanya `UPDATE`, **aman dijalankan berulang**:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=./migrations/2026-10-15-ba-pendukung-peserta-id-pengajuan-backfill.sql
```

### 3.5 Migrasi BA Pelaksanaan multi-sesi (sekali, sebelum deploy Worker baru)

Migrasi `2026-10-27-ba-pelaksanaan-sesi.sql` membuat tabel `berita_acara_sesi`
(`ba_id`, `jadwal_id`, `urutan`) sehingga satu BA Pelaksanaan bisa mencakup beberapa sesi
jadwal, lalu membackfill tautan dari BA lama yang masih menyimpan satu `berita_acara.jadwal_id`.
`berita_acara.jadwal_id` tetap diisi sesi paling awal untuk kompatibilitas. Index unik
`jadwal_id` membuat satu jadwal hanya boleh tertaut ke satu BA. File ini hanya
`CREATE TABLE/INDEX IF NOT EXISTS` + `INSERT ... WHERE NOT EXISTS`, **aman dijalankan berulang**,
tetapi jalankan **sebelum** men-deploy Worker baru karena kode baru membaca tabel tersebut:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=./migrations/2026-10-27-ba-pelaksanaan-sesi.sql
```

## 4. Deploy Worker + aset

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy --config wrangler.production.toml
```

Output akan menampilkan URL Worker, mis. `https://inhal-form.<subdomain>.workers.dev`.

Jika muncul peringatan `You need to register a workers.dev subdomain`, daftarkan dulu subdomain di:

```
https://dash.cloudflare.com/<ACCOUNT_ID>/workers/subdomain
```

### 4.1 Secret wajib: bridge Google Drive

Fitur unggah berkas (surat keterangan, ACC INHAL, bukti bayar, berita acara) memakai bridge Apps Script. Worker membutuhkan dua nilai berikut:

- `GAS_DRIVE_URL` (variable biasa di `wrangler.toml`): URL Web App Apps Script.
- `GAS_DRIVE_TOKEN` (**secret**, wajib): token bersama, harus sama dengan `DRIVE_BRIDGE_TOKEN` di Apps Script.

`GAS_DRIVE_TOKEN` tidak ditulis di `wrangler.toml` maupun kode. Set sekali per environment:

```bash
# jalankan di terminal Anda, jangan tempel nilai token ke chat
printf '%s' '<TOKEN_BRIDGE>' | CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler secret put GAS_DRIVE_TOKEN
```

Cek daftar secret yang sudah terpasang (nilai tidak ditampilkan):

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler secret list
```

Tanpa secret ini, semua unggahan akan gagal dengan pesan "Penyimpanan Drive belum dikonfigurasi."

Untuk pengembangan lokal, simpan token yang sama di `new-code1-cf/.dev.vars` (sudah
diabaikan Git) agar `wrangler dev` bisa mengunggah berkas:

```ini
GAS_DRIVE_TOKEN=<TOKEN_BRIDGE>
```

API token Cloudflare jangan ditaruh di `.dev.vars` (nilainya akan terbaca Worker).
Simpan terpisah, mis. di `.cf_token` pada root repo (juga diabaikan Git), lalu pakai
`CLOUDFLARE_API_TOKEN="$(cat ../../.cf_token)"` atau variabel environment Windows.

### 4.2 Aksi bridge Apps Script

Web App Apps Script harus menangani aksi berikut (POST JSON, field `token`):

- `saveFile` — simpan base64, kembalikan `{ success, url, fileId }`.
- `trashFile` — pindahkan berkas ke trash by `fileId`.
- `sendFinalEmail` / `sendStatusEmail` — kirim email.
- `getFile` — **baru**: terima `fileId`, kembalikan `{ success, base64, mimeType }` (isi berkas). Dipakai worker untuk merakit PDF BA Pendukung.

## 5. Verifikasi

Buka URL Worker di browser, atau:

```bash
# ganti URL sesuai hasil deploy
curl https://inhal-form.prodi.workers.dev/api/health
curl https://inhal-form.prodi.workers.dev/api/registration-options
curl -o /dev/null -w "%{http_code}\n" https://inhal-form.prodi.workers.dev/dashboard
curl -o /dev/null -w "%{http_code}\n" https://inhal-form.prodi.workers.dev/detail-laporan
curl -o /dev/null -w "%{http_code}\n" https://inhal-form.prodi.workers.dev/bagian
curl -s https://inhal-form.prodi.workers.dev/api/rpc -H 'Content-Type: application/json' -d '{"fn":"getBaginaConfig","args":[]}'
```

Cek data D1 remote:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --command "SELECT id_pengajuan, npm, status FROM pengajuan ORDER BY id DESC LIMIT 5"
```

## 6. Update / deploy ulang

Setelah mengubah kode di `src/` atau `public/`:

```bash
npm test
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy --config wrangler.production.toml
```

Jika skema berubah, jalankan ulang langkah 3 dengan file migrasi yang sesuai.

## 7. Catatan keamanan

- Jangan pernah menaruh API token di `wrangler.toml`, kode, atau commit Git. Gunakan environment variable `CLOUDFLARE_API_TOKEN`.
- Jika token sempat terekspos (mis. ter-paste di chat atau ter-commit), segera **Roll** token tersebut di dashboard Cloudflare.
- Data seed di `schema.sql` hanya untuk demo; hapus/ ganti sebelum dipakai produksi.

## 8. Backup D1

Backup harian **tidak** dijalankan oleh Worker, R2, atau Cloudflare Workflows
(ketiganya belum aktif). Backup dijalankan GitHub Actions:

- Workflow: `.github/workflows/backup-d1.yml` (**Backup D1**), jadwal
  `0 18 * * *` UTC = 01:00 WIB, bisa dijalankan manual lewat `workflow_dispatch`.
- Hasil: artefak `d1-backup-<label>` (dump SQL, snapshot JSON, XLSX, manifest)
  dengan retensi 3 hari, plus salinan terenkripsi di Google Drive bila secret
  Drive tersedia.

Secret yang dibutuhkan (Settings > Secrets and variables > Actions):

| Secret | Nilai |
|---|---|
| `CLOUDFLARE_API_TOKEN` | sudah ada; dipakai `d1 export` |
| `CLOUDFLARE_ACCOUNT_ID` | `e2efd255f61d2b81c7f54c92eb57b946` |
| `DRIVE_BRIDGE_URL` | sama dengan `GAS_DRIVE_URL` produksi |
| `DRIVE_BRIDGE_TOKEN` | sama dengan `GAS_DRIVE_TOKEN` produksi |
| `BACKUP_PASSPHRASE` | frasa sandi ≥ 12 karakter; simpan juga di pengelola sandi |

Menjalankan setara secara manual dari mesin yang punya akses:

```bash
npx wrangler d1 export inhal-poc --remote --config wrangler.production.toml --output=backup.sql
node scripts/verify-backup.mjs backup.sql
node scripts/backup-snapshot.mjs backup.sql --out=out --label=manual --plan=free
```

Simpan `backup.sql` **di luar repo** dan jangan pernah mengunggahnya ke Drive
tanpa enkripsi: aksi `saveFile` bridge membuat berkas dapat dibuka siapa pun yang
memiliki tautan.

Detail prosedur, ambang ukuran, dan langkah restore: `../docs/ops/backup-restore.md`.
Peta komponen dan skenario kegagalan: `../docs/ops/arsitektur-dan-failover.md`.
