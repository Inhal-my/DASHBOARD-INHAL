# SOP Backup dan Restore D1 INHAL

Terakhir diperbarui: 2026-10-17

## Ringkasan

- Database: D1 `inhal-poc`, akun Cloudflare `e2efd255f61d2b81c7f54c92eb57b946`.
- Time Travel D1: restore point 30 hari (Workers Paid) atau 7 hari (Workers Free), selalu aktif.
- Arsip R2: ekspor harian pukul 01:00 UTC ke bucket privat `inhal-poc-backups`, retensi 180 hari.
- Workflow: `d1-backup`, binding `BACKUP_WORKFLOW`.
- Uji integritas: `scripts/verify-backup.mjs`.

## Prasyarat

- Wrangler terpasang dan login ke akun Cloudflare yang memiliki akses D1, R2, dan Workflows.
- R2 sudah diaktifkan di akun.
- Token API untuk ekspor D1 tersedia. Token disimpan sebagai secret Worker, bukan di repo.
- Untuk restore Time Travel, operator harus memahami bahwa operasi ini menimpa database.

## Penyiapan awal (sekali)

### 1. Aktifkan R2 dan buat bucket

Buka Cloudflare Dashboard > R2 Object Storage > Enable R2. Setelah aktif:

```bash
# Membuat bucket privat arsip
npx wrangler r2 bucket create inhal-poc-backups
```

### 2. Buat token ekspor D1

Buat API token dengan izin ekspor D1 untuk database target. Simpan nilainya sebagai secret Worker:

```bash
# Menyimpan token sebagai secret terenkripsi
npx wrangler secret put D1_REST_API_TOKEN
```

Jangan menulis token ke `wrangler.toml`, `.env`, atau file yang di-commit.

### 3. Deploy Worker

```bash
# Deploy Worker beserta Workflow dan binding R2
npx wrangler deploy
```

### 4. Pasang lifecycle 180 hari

```bash
# Menghapus otomatis objek prefix d1/ setelah 180 hari
npx wrangler r2 bucket lifecycle add inhal-poc-backups d1-retention-180 d1/ --expire-days 180 --force
```

Verifikasi:

```bash
# Melihat aturan lifecycle
npx wrangler r2 bucket lifecycle list inhal-poc-backups
```

### 5. Trigger pertama dan verifikasi

```bash
# Menjalankan backup manual
npx wrangler workflows trigger d1-backup
```

```bash
# Melihat status instance terbaru
npx wrangler workflows instances list d1-backup --reverse
```

Setelah instance selesai, buka dashboard R2 dan pastikan ada:

- `d1/<timestamp>.sql`
- `d1/<timestamp>.json`
- `status/last-success.json`

## Operasi harian

Tidak ada tindakan manual. Workflow berjalan setiap hari pukul 01:00 UTC (08:00 WIB).

Pemeriksaan mingguan:

1. Buka Workflows > `d1-backup` dan pastikan instance terbaru berstatus `complete`.
2. Buka R2 > `inhal-poc-backups` dan pastikan ada objek `d1/` baru.
3. Baca `status/last-failure.json`. Jika objek ini lebih baru dari `status/last-success.json`, selidiki kegagalan.

## Uji restore dari arsip R2

```bash
# Mengunduh dump terbaru dari R2 (ganti nama file)
npx wrangler r2 object get inhal-poc-backups/d1/<timestamp>.sql --file=/tmp/inhal-backup.sql --remote
```

```bash
# Memeriksa integritas dan referensi
cd new-code1-cf
node scripts/verify-backup.mjs /tmp/inhal-backup.sql
```

Hasil lulus bila keluar dengan kode 0 dan `"ok": true`. Script memeriksa:

- `PRAGMA integrity_check`
- keberadaan dan jumlah tabel inti
- duplikat `master_kegiatan`
- referensi blok yang tidak ada di master
- `kegiatan_key` yang tidak sinkron

Blok kosong dilaporkan tetapi tidak menggagalkan verifikasi karena dapat merupakan kondisi data yang sudah ada.

Catat hasil di bagian catatan di bawah.

## Latihan restore lokal (tanpa R2)

Dipakai untuk menguji prosedur sebelum R2 aktif atau saat latihan di laptop.

```bash
# Ekspor D1 lokal
npx wrangler d1 export inhal-poc --local --output=/tmp/opencode/backups/inhal-local.sql

# Verifikasi dump
node scripts/verify-backup.mjs /tmp/opencode/backups/inhal-local.sql
```

Buat konfigurasi sementara di luar repo (jangan commit) yang menunjuk database
scratch:

```toml
name = "inhal-form-restore"
compatibility_date = "2025-01-01"

[[d1_databases]]
binding = "DB"
database_name = "inhal-poc-restore"
database_id = "11111111-2222-4333-8444-555555555555"
```

```bash
# Impor dump ke database scratch lokal
npx wrangler d1 execute inhal-poc-restore --local --config /tmp/opencode/wrangler.restore.toml --file=/tmp/opencode/backups/inhal-local.sql

# Bandingkan jumlah tabel inti
npx wrangler d1 execute inhal-poc-restore --local --config /tmp/opencode/wrangler.restore.toml --json --command "SELECT (SELECT COUNT(*) FROM mahasiswa) AS mahasiswa, (SELECT COUNT(*) FROM pengajuan) AS pengajuan, (SELECT COUNT(*) FROM master_kegiatan) AS master_kegiatan, (SELECT COUNT(*) FROM berita_acara) AS berita_acara, (SELECT COUNT(*) FROM berita_acara_admin) AS berita_acara_admin"
```

Ekspor ulang database scratch lalu jalankan `scripts/verify-backup.mjs`; hasil harus
`"ok": true`.

## Restore Time Travel

Gunakan untuk insiden yang masih dalam jendela retensi Time Travel.

```bash
# Melihat bookmark saat ini
npx wrangler d1 time-travel info inhal-poc
```

```bash
# Melihat bookmark pada waktu tertentu
npx wrangler d1 time-travel info inhal-poc --timestamp="2026-10-17T12:00:00Z"
```

```bash
# Restore ke bookmark yang dipilih
npx wrangler d1 time-travel restore inhal-poc --bookmark=<bookmark>
```

Simpan bookmark undo yang dicetak setelah restore. Setelah restore:

1. Buka `/api/health`.
2. Login admin.
3. Periksa jumlah pengajuan dan master kegiatan.
4. Jalankan audit integritas master.
5. Catat waktu, penyebab, bookmark, dan hasil.

## Restore dari arsip R2

Restore in-place dari dump tidak dipakai karena berisiko menghapus data yang lebih baru. Langkah yang aman:

1. Buat database D1 baru.
2. Impor dump ke database baru.
3. Jalankan `scripts/verify-backup.mjs` pada dump tersebut.
4. Validasi aplikasi terhadap database baru.
5. Arahkan binding `DB` ke database baru melalui perubahan konfigurasi dan deploy.
6. Simpan database lama sampai validasi selesai.

## Eskalasi

- Backup gagal dua hari berturut-turut: jalankan trigger manual, periksa pesan di `status/last-failure.json`, dan periksa status Workflows.
- Data rusak: hentikan penulisan, tentukan waktu kejadian, gunakan Time Travel bila masih dalam jendela retensi.
- Token API bocor: cabut token, buat token baru, perbarui secret, dan deploy ulang bila diperlukan.

## Catatan uji

### 2026-10-17

- Backup pra-Poin 1: `inhal-poc-20261017-pre-poin1.sql`, integritas `ok`, ditemukan 2 duplikat master.
- Backup pasca-Poin 1: `inhal-poc-20261017-post-poin1.sql`, integritas `ok`, duplikat 0, referensi blok asing 0, `kegiatan_key` drift 0.
- Uji restore R2 pertama menunggu aktivasi R2 dan backup harian pertama.

### 2026-10-21 (lokal)

- Dump: `/tmp/opencode/backups/inhal-local-20261021.sql`, integritas `ok`.
- Jumlah: mahasiswa 6, pengajuan 6, master_kegiatan 13, berita_acara 2,
  berita_acara_admin 1.
- Restore ke database scratch lokal berhasil (131 perintah). Ekspor ulang scratch
  juga `ok`, tanpa duplikat/orphan/drift.
- Latihan ini tidak menggantikan uji restore R2; uji R2 tetap menunggu bucket aktif.

### 2026-10-21 (staging restore drill)

- Workflow: **Restore Drill Staging**, run `39554233150`, hasil `success`.
- Sumber: D1 staging diekspor baca-saja, lalu diverifikasi `ok`.
- Restore: dump diimpor ke database scratch lokal di runner, diekspor ulang,
  diverifikasi `ok`, dan jumlah tabel inti sama.
- Jumlah tabel inti: mahasiswa 3, pengajuan 0, master_kegiatan 11, berita_acara 0,
  berita_acara_admin 0.
- Aplikasi: Worker lokal membaca database hasil restore; `/api/health`, opsi
  pendaftaran, portal mahasiswa, dan `/portal` lulus.
- Bukti: artifact `restore-drill-evidence` (kedaluwarsa 2026-11-04).
- Catatan: drill memakai salinan lokal, bukan mengarahkan staging ke database baru.
  Staging dan produksi tidak diubah.

### 2026-10-21 (produksi)

- Deploy produksi Poin 6: run `39551735466`, versi Worker
  `40c4f4a2-12c0-49ab-8ebf-dea26bd596b2`.
- Time Travel bookmark sebelum migrasi:
  `000001f8-0000000e-0000510b-9ea1ed190410e6b647b71d99001a0cf4`.
- Migrasi `2026-10-21-poin6-backfill-mahasiswa-blok.sql` dan
  `2026-10-21-poin6-indexes.sql` berstatus diterapkan; health produksi 200.
- Tidak ada dump ekspor produksi pada rilis ini karena R2 belum aktif dan token
  Cloudflare lokal tidak tersedia. Gunakan Time Travel atau backup R2 setelah aktif.

### 2026-10-26 (produksi)

- Deploy produksi perbaikan status pembayaran: versi Worker
  `c7ddf806-fea0-45a0-a89a-beb6236ad583`, health produksi 200.
- Ekspor pra-migrasi `wrangler d1 export`: 450 KB, disimpan di luar repo
  (`D:\tmp\backup-pre-pembayaran-2026-10-26.sql`).
- Time Travel bookmark sebelum migrasi (dari URL ekspor):
  `00000232-00000000-00005110-0b794c0855aedc2f9d22967601df076e`.
  Bookmark setelah migrasi:
  `00000232-00000002-00005110-a5ba1b2cd7db89c9375bff0286391c7d`.
- Migrasi `2026-10-26-pembayaran-backfill-menunggu.sql` berstatus diterapkan.
  Hasil: `menunggu` 25 baris, `valid` 1 baris, dan 0 baris ber-bukti yang
  masih `belum`.
