# Deploy `new-code1-cf` ke Cloudflare

Panduan langkah demi langkah memindahkan isi `new-code1-cf` ke Cloudflare (Worker + Static Assets + D1). Semua perintah dijalankan dari dalam direktori `new-code1-cf/`.

## Info deploy saat ini

| Item | Nilai |
|---|---|
| Akun Cloudflare | `inhal1` (`e2efd255f61d2b81c7f54c92eb57b946`) |
| Worker name | `inhal-poc` |
| URL | https://inhal-poc.new-code1-cf.workers.dev |
| D1 database | `inhal-poc` (`8f412848-d213-4bb3-aeb7-0aff221f9ee3`, region APAC) |
| Workers.dev subdomain | `new-code1-cf` |

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

Salin `database_id` dari output ke `wrangler.toml`, bagian `[[d1_databases]]`:

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

## 4. Deploy Worker + aset

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```

Output akan menampilkan URL Worker, mis. `https://inhal-poc.<subdomain>.workers.dev`.

Jika muncul peringatan `You need to register a workers.dev subdomain`, daftarkan dulu subdomain di:

```
https://dash.cloudflare.com/<ACCOUNT_ID>/workers/subdomain
```

## 5. Verifikasi

Buka URL Worker di browser, atau:

```bash
# ganti URL sesuai hasil deploy
curl https://inhal-poc.new-code1-cf.workers.dev/api/health
curl https://inhal-poc.new-code1-cf.workers.dev/api/registration-options
```

Cek data D1 remote:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --command "SELECT id_pengajuan, npm, status FROM pengajuan ORDER BY id DESC LIMIT 5"
```

## 6. Update / deploy ulang

Setelah mengubah kode di `src/` atau `public/`:

```bash
npm test
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```

Jika skema berubah, jalankan ulang langkah 3 dengan file migrasi yang sesuai.

## 7. Catatan keamanan

- Jangan pernah menaruh API token di `wrangler.toml`, kode, atau commit Git. Gunakan environment variable `CLOUDFLARE_API_TOKEN`.
- Jika token sempat terekspos (mis. ter-paste di chat atau ter-commit), segera **Roll** token tersebut di dashboard Cloudflare.
- Data seed di `schema.sql` hanya untuk demo; hapus/ ganti sebelum dipakai produksi.
