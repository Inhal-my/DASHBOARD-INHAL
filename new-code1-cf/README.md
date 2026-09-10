# new-code1-cf — Cloudflare Workers PoC

Proof-of-concept halaman pendaftaran (`index`) dari `new-code1` (Google Apps Script) di Cloudflare Workers + Hono + D1.

## Prasyarat

- Node.js 22+, npm
- Tidak perlu akun Cloudflare untuk mode lokal

## Menjalankan lokal

Jalankan dari dalam direktori `new-code1-cf/`:

```bash
npm install
npm run db:local
npx wrangler dev
```

Buka http://localhost:8787

## Menjalankan test

```bash
npm test
```

## Endpoint

| Method | Rute | Keterangan |
|---|---|---|
| GET | `/api/health` | Cek Worker |
| GET | `/api/registration-options` | Opsi form pendaftaran |
| GET | `/api/mahasiswa/:npm` | Nama mahasiswa (string) |
| POST | `/api/pengajuan` | Simpan pendaftaran |
| GET | `/api/portal/:npm` | Data portal (riwayat) mahasiswa |
| POST | `/api/portal/upload` | Stub unggah berkas (belum aktif) |

Halaman:
- `/` — Pendaftaran
- `/portal` — Portal Mahasiswa (login cukup NPM)

Unggah berkas ACC/bukti bayar belum aktif (ditunda ke tahap berikutnya).

## Impor data asli dari Google Sheets

Data asli (Mahasiswa, MasterKegiatan, MasterBagian, Config, Pengajuan, DetailKegiatan)
dapat diimpor dari Google Sheet sumber. Script menghasilkan SQL lalu menerapkannya ke D1.

```bash
# Hasilkan SQL (default: /tmp/opencode/inhal-real-import.sql)
node scripts/import-sheets.mjs

# Terapkan ke D1 lokal
npx wrangler d1 execute inhal-poc --local --file=/tmp/opencode/inhal-real-import.sql

# Terapkan ke D1 produksi
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=/tmp/opencode/inhal-real-import.sql
```

Impor bersifat idempotent (`DELETE` lalu `INSERT`). Sheet ID dapat diubah lewat
env `INHAL_SHEET_ID`. Hasil SQL tidak di-commit karena memuat data pribadi.

## Deploy ke Cloudflare

Lihat `DEPLOY.md`.

## Cakupan

Termasuk: halaman index + portal, endpoint terkait, D1 (7 tabel), impor data asli, test otomatis.
Belum termasuk: auth, email, R2, halaman lain, unggah berkas.
