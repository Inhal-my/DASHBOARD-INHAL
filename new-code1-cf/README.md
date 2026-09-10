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

## Deploy ke Cloudflare

Lihat `DEPLOY.md`.

## Cakupan

Termasuk: halaman index, 3 endpoint, D1 (7 tabel + seed), test otomatis.
Belum termasuk: auth, email, R2, halaman lain, migrasi data asli, deploy produksi.
