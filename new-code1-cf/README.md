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
| POST | `/api/rpc` | Dispatcher RPC panel admin (mode baca) |

Halaman:
- `/` — Pendaftaran
- `/portal` — Portal Mahasiswa (login cukup NPM)
- `/dashboard` — Panel admin (dashboard)
- `/detail-laporan` — Laporan detail (admin)
- `/bagian` — Panel bagian

Unggah berkas ACC/bukti bayar belum aktif (ditunda ke tahap berikutnya).

## Panel admin (mode baca)

Halaman `dashboard`, `detail-laporan`, dan `bagian` disajikan dari Worker. Setiap
halaman memuat `/gs-shim.js` yang menyediakan `google.script.run` dan meneruskan
panggilan ke `POST /api/rpc` dengan body `{ fn, args }`.

- Semua endpoint baca mengembalikan data asli dari D1.
- Aksi tulis belum aktif dan mengembalikan `Fitur <fn> belum tersedia pada tahap ini.`
- Auth admin/bagian memakai sesi di D1 (token, masa berlaku 4 jam). Sesi tidak valid
  menghasilkan `Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.`
- D1 berperan sebagai replika baca; perbarui data dengan menjalankan ulang importer.

## Impor data asli dari Google Sheets

Data asli (Mahasiswa, MasterKegiatan, MasterBagian, Config, Pengajuan, DetailKegiatan,
Admin, BagianStaff, MasterBiaya, BeritaAcara, BeritaAcaraPeserta, BeritaAcaraAdmin,
BeritaAcaraAdminPeserta, CheckData, StatusHistory, NomorSurat) dapat diimpor dari Google
Sheet sumber. Script menghasilkan SQL lalu menerapkannya ke D1.

Sheet `Admin` diimpor berdasarkan posisi kolom (kolom 0 = password, kolom 1 = nama)
karena label header-nya tidak selaras dengan data.

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

Termasuk: halaman index, portal, dashboard, detail-laporan, bagian, endpoint terkait,
D1 (18 tabel), auth admin/bagian + sesi, RPC baca panel admin, impor data asli, test otomatis.
Belum termasuk: aksi tulis panel admin, email, R2, unggah berkas.
