# Rencana: Artefak CSV backup + GAS cold reader (tahap 1)

Tanggal: 2026-10-31
Status: tahap 1 selesai; tahap 2 menunggu aksi bridge `saveFilePrivate`.

## Latar belakang

Arsip cadangan D1 hanya tersedia sebagai dump SQLite, snapshot JSON ter-gzip, dan
XLSX. Tidak ada bentuk yang bisa dibaca langsung oleh Google Apps Script tanpa
parser SQL, sehingga "cold reader" (pembaca darurat saat Worker mati) tidak bisa
dibangun di atas artefak lama. GAS juga tidak dapat mendekripsi arsip `.enc`
(AES-256-GCM + scrypt) yang dipakai karena `saveFile` bridge menandai berkas
"anyone with the link".

## Keputusan

1. **Cara 3** — generator backup menambah artefak CSV per tabel (bisa dibaca
   `Utilities.parseCsv`, `fgetcsv`, Excel) dan menuliskannya ke `manifest.json`.
2. **Cara 1** — GAS cold reader **tahap 1 hanya membaca `manifest.json`**:
   aman (tanpa PII), cepat, dan bisa dipakai sekarang.
3. **Tahap 2** (impor CSV, telusuri data, paket SQL restore) menunggu aksi bridge
   `saveFilePrivate` agar berkas berisi PII bisa disimpan privat di Drive.

## Yang dibangun (tahap 1)

| Berkas | Peran |
|---|---|
| `new-code1-cf/scripts/lib/backup-csv.mjs` | `csvCell`, `toCsv`, `csvFileName`, `csvDirName`, `buildCsvManifest`, `buildCsvBlock` |
| `new-code1-cf/scripts/backup-snapshot.mjs` | menulis `out/<label>-csv/<tabel>.csv` + `manifest.csv`, menambah blok `csv` ke `manifest.json` |
| `.github/workflows/backup-d1.yml` | mencatat ringkasan CSV pada run (artefak sudah ikut lewat `out/**`) |
| `new-code1-cf/tools/gas-backup-reader/` | add-on Apps Script: Ringkasan, Bandingkan, Runbook Restore, Catat Drill, Tentang & Akses |
| `new-code1-cf/scripts/__tests__/backup-csv.node.mjs` | uji CSV (kutip, newline, NULL, CRLF, manifest) |
| `new-code1-cf/scripts/__tests__/backup-gas-reader.node.mjs` | uji berkas `.gs` via `vm` + uji kontrak generator → reader |

## Batas yang disengaja

- CSV tidak diunggah ke Drive pada tahap ini (hanya `manifest.json` yang memang
  tanpa PII). Pengiriman CSV menunggu `saveFilePrivate`.
- GAS tidak menulis ke D1 dan tidak mendekripsi `.enc`; restore tetap lewat
  `wrangler` di mesin operator.
- Kolom besar (`uploads.content`) tetap dikecualikan dari CSV, tercatat di
  `manifest.excludedColumns`, dan tetap utuh di dump.

## Verifikasi

- `npm run test:scripts` (48 tes) — termasuk uji CSV dan uji reader.
- Uji end-to-end: `schema.sql` + data uji → `backup-snapshot` →
  `out/GASDRIL-csv/` berisi 27 CSV, `manifest.csv` konsisten dengan
  `manifest.json.counts`.
- `npm run test:local` — suite aplikasi tetap hijau (tanpa perubahan perilaku).

## Tindak lanjut (tahap 2)

1. Tambah aksi `saveFilePrivate` pada Apps Script bridge (tanpa permission
   publik) + flag `--csv-dir` pada `scripts/mirror-drive-backup.mjs`.
2. Menu GAS: impor CSV → sheet `bk_<tabel>` (dicicil 2.000 baris/eksekusi),
   telusuri data, cek sha256 berkas, susun `restore-<label>.sql` + perintah
   `wrangler`, dan cold copy spreadsheet.
3. Perbarui `docs/ops/backup-restore.md` dan SOP bridge saat aksi baru dipakai.
