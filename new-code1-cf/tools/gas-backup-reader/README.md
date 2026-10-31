# INHAL Backup Reader (Apps Script)

Pembaca darurat arsip cadangan D1 INHAL untuk Google Sheets. **Tahap 1 hanya
membaca `manifest.json`** — jumlah baris per tabel, hash, ukuran, status ambang.
Tidak ada data pribadi yang dibaca atau disimpan.

Restore database **tidak** dilakukan dari Apps Script. Add-on ini hanya
menyiapkan runbook dan mencatat bukti drill; pelaksanaan restore tetap di mesin
yang memiliki `wrangler` dan akses Cloudflare.

## Pasang

1. Buat Google Spreadsheet baru (mis. `INHAL Backup Reader`), lalu
   **Extensions → Apps Script**.
2. Buat berkas berikut dan salin isinya dari folder ini:
   `Code.gs`, `Menu.gs`, `Manifest.gs`, `Summary.gs`, `Compare.gs`,
   `Checklist.gs`, `DrillLog.gs`, `Access.gs`.
3. Buka **Project Settings → Show `appsscript.json` manifest file**, lalu samakan
   dengan `appsscript.json` di folder ini (scope `spreadsheets`, `drive.readonly`,
   `script.container.ui`).
4. Isi **Script Properties** → `ALLOWLIST` dengan email pengelola, dipisah koma.
   Wildcard domain didukung: `*@umsu.ac.id`. Tanpa `ALLOWLIST`, semua menu
   menolak berjalan.
5. Muat ulang spreadsheet → menu **🛡️ INHAL Backup** muncul.

## Menu

| Menu | Fungsi |
|---|---|
| Ringkasan Backup… | Meminta `fileId` manifest → menulis sheet `bk_ringkasan` + `bk_tabel` |
| Bandingkan Dua Backup… | Dua `fileId` manifest → sheet `bk_banding` (status `sama/berubah/hilang/baru`) |
| Runbook Restore (Checklist) | Menulis sheet `bk_restore` berisi prosedur A–D dari `docs/ops/backup-restore.md` |
| Catat Drill… | Menambah bukti drill ke sheet `bk_audit` |
| Tentang & Akses | Versi, pengguna, allowlist, batas tahap 1 |

`fileId` manifest bisa diambil dari tautan Drive: `https://drive.google.com/file/d/<FILE_ID>/view`.
Bila dikosongkan, add-on memakai manifest terakhir yang pernah dibuka.

## Cara mendapat `manifest.json`

- Artefak GitHub Actions **Backup D1** → `out/manifest.json`
  (`gh run download <run-id> -n d1-backup-<label> -D ./restore`).
- Atau dari Drive: berkas `inhal-<label>-manifest.json` (sengaja **tidak**
  dienkripsi karena hanya berisi metadata, tanpa data pribadi).

## Batas yang disengaja

- **Tanpa data pribadi**: CSV, snapshot, dan dump tetap terenkripsi/terbatas;
  tahap 2 (membaca CSV, menelusuri data, paket restore SQL) menunggu aksi bridge
  `saveFilePrivate` agar berkas berisi PII bisa disimpan privat di Drive.
- **Tanpa tulis ke D1**: Apps Script tidak punya jalur ke Cloudflare D1.
- **Batas Google**: eksekusi 6 menit (akun biasa) dan 10 juta sel per spreadsheet
  — relevan saat tahap 2 mengimpor CSV; tahap 1 hanya metadata sehingga aman.

## Uji

Fungsi murni diuji tanpa API Google melalui Node:

```bash
cd new-code1-cf
node --test scripts/__tests__/backup-gas-reader.node.mjs
```

Uji tersebut memuat seluruh berkas `.gs` ke konteks `vm`, memeriksa parser
manifest, perbandingan, runbook, allowlist, dan memastikan setiap fungsi yang
dipanggil menu benar-benar ada. Satu uji menjalankan
`scripts/backup-snapshot.mjs` sungguhan lalu memastikan manifest hasilnya
terbaca oleh reader (kontrak generator ↔ reader).
