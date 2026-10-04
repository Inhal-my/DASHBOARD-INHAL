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
| POST | `/api/portal/upload` | Unggah berkas ACC INHAL & bukti bayar |
| POST | `/api/rpc` | Dispatcher RPC panel admin (baca & tulis) |

Halaman:
- `/` — Pendaftaran
- `/portal` — Pengajuan INHAL (login cukup NPM)
- `/dashboard` — Panel admin (dashboard)
- `/detail-laporan` — Laporan detail (admin)
- `/bagian` — Panel bagian

Unggah berkas (surat keterangan, ACC INHAL, bukti bayar, berita acara) aktif melalui bridge Google Drive (butuh secret `GAS_DRIVE_TOKEN`).

## Panel admin

Halaman `dashboard`, `detail-laporan`, dan `bagian` disajikan dari Worker. Setiap
halaman memuat `/gs-shim.js` yang menyediakan `google.script.run` dan meneruskan
panggilan ke `POST /api/rpc` dengan body `{ fn, args }`.

- D1 adalah sumber data utama (baca dan tulis).
- Aksi tulis (master data, pengajuan, berita acara, email, reset unggahan) aktif dan
  tercatat di `audit_log` / `status_history`.
- Auth admin/bagian memakai sesi di D1 (token, masa berlaku 4 jam). Sesi tidak valid
  menghasilkan `Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.`
- Data dapat diimpor ulang dari Google Sheets (idempotent `DELETE` lalu `INSERT`) dan
  diekspor ke `.xlsx`; lihat bagian impor dan endpoint `POST /api/database-export`.

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

Termasuk: halaman portal, dashboard, detail-laporan, bagian, endpoint terkait, D1,
auth admin/bagian + sesi, RPC baca & tulis panel admin, email notifikasi, unggah berkas
via bridge Google Drive, reset unggahan, impor data asli, ekspor `.xlsx`, test otomatis.
Belum termasuk: penyimpanan R2 (berkas disimpan di Google Drive).
