# Backup App — buka hasil backup D1 INHAL secara lokal

Aplikasi kecil untuk **membaca isi dump backup D1** memakai UI INHAL yang asli.
Tidak butuh XAMPP, MySQL, akun Cloudflare, atau koneksi internet setelah
dependensi terpasang.

```
tools/backup-app/
  start.mjs        peluncur: impor dump -> jalankan worker lokal -> buka browser
  sample-dump.mjs  pembuat dump contoh (skema + data uji) tanpa Cloudflare
  lib.mjs          helper murni (path, port, perintah wrangler, mode baca-saja)
  guard.mjs        daftar RPC baca-saja + penolakan endpoint tulis
  worker.js        pembungkus worker produksi dengan penjaga baca-saja
  wrangler.toml    konfigurasi lokal (jangan dipakai deploy)
```

## Kenapa ini bukan aplikasi baru

`worker.js` meng-import `../../src/index.js` — kode Worker yang sama dengan
produksi — lalu menambahkan pemeriksaan di depan `/api/*`. Jadi tampilan,
perhitungan, dan aturan bisnisnya identik; yang ditambahkan hanya pembatas
tulis.

## Coba dulu tanpa dump (data contoh)

Belum punya dump? Buat dump contoh berisi skema + data uji:

```bash
node tools/backup-app/sample-dump.mjs
# hasil: local-data/contoh/inhal-contoh.sql (login: Admin Demo / admin123)
```

Lalu jalankan seperti biasa:

```bash
node tools/backup-app/start.mjs --dump=local-data/contoh/inhal-contoh.sql
```

Opsi pembuat contoh: `--out=<berkas>`, `--password=...`, `--admin=<nama>`.

## Prasyarat

- Node.js 20+ (diuji 22).
- Dependensi `new-code1-cf` sudah terpasang (`npm ci`), karena `wrangler` dipakai
  dari `node_modules` proyek.

## Cara pakai

Dari folder `new-code1-cf`:

```bash
# Buka dump SQL hasil ekspor D1
node tools/backup-app/start.mjs --dump=/path/absolut/inhal-poc.sql
```

Perilaku:

1. Dump **disalin** ke folder sesi baru di `local-data/backup-app/<stamp>-<nama>/`.
2. Dump diimpor ke D1 lokal di folder sesi itu (bukan `local-data` biasa, bukan
   `.wrangler`, bukan Cloudflare).
3. Worker lokal dijalankan di `http://127.0.0.1:8790` (loopback saja).
4. Browser dibuka otomatis. Login memakai akun admin yang ada di dump.

Opsi:

| Opsi | Arti |
|---|---|
| `--dump=<file.sql>` | Wajib (kecuali `--reuse`). Berakhiran `.sql`; path relatif dihitung dari folder tempat perintah dijalankan. |
| `--port=<n>` | Port lokal, default `8790`. |
| `--no-open` | Jangan buka browser otomatis. |
| `--allow-write` | Matikan mode baca-saja (tidak disarankan). |
| `--reuse=<nama folder>` | Pakai ulang sesi yang sudah ada, tanpa impor ulang. |
| `--work-dir=<dir>` | Ganti lokasi sesi; harus di dalam folder proyek. |

Hentikan dengan `Ctrl+C`. Skrip tidak pernah menghapus berkas; setiap
peluncuran membuat folder sesi baru.

## Mode baca-saja (default)

| Yang diblokir | Respons |
|---|---|
| RPC tulis (`deletePengajuanAdmin`, `updatePengajuanStatus`, `sendFinalEmail`, `save*`, `upload*`, `baAdminCreate`, dst.) | HTTP 403 |
| `POST /api/pengajuan` (pendaftaran publik) | HTTP 403 |
| `POST /api/portal/upload` (unggah bukti) | HTTP 403 |
| `POST /api/database-export` | HTTP 403 |

Semua endpoint `GET` dan RPC tampilan diizinkan, termasuk `authenticateAdmin`,
`logoutSession`, `getActivityLog`, `getPengajuanList`, `getPengajuanWithDetails`,
`getBeritaAcara*`, `getLaporanBootstrap`, `getMasterDataMonitor`,
`getUploadMonitor`, `diagnosticData`, `auditMasterIntegrity`, `baAdminGet`.

Daftar lengkap ada di `guard.mjs`. `authenticateAdmin` sengaja diizinkan karena
ia menulis tabel `sessions`/`auth_throttle` **di salinan lokal** dan bisa
memperbarui hash password pada dump — bukan pada database produksi.

## Mengambil dump yang bisa dibuka

| Sumber | Cara |
|---|---|
| Cloudflare langsung | `npx wrangler d1 export inhal-poc --remote --output=inhal-poc.sql` |
| Artefak GitHub (bila Cloudflare mati) | Actions -> **Backup D1** -> unduh `d1-backup-<label>` -> `inhal-poc.sql` |
| Arsip Drive terenkripsi | `node scripts/decrypt-backup.mjs inhal-<label>-database.sql.enc --out=inhal.sql --passphrase="..."` |

Berkas `.enc` ditolak oleh peluncur; dekripsi lebih dulu.

## Batasan yang perlu diketahui

1. **Berkas bukti tidak ikut.** D1 hanya menyimpan tautan Google Drive. Tanpa
   internet, pratinjau/unduh berkas gagal; data dan UI tetap jalan.
2. **MFA bisa menghalangi login.** Bila admin di dump punya MFA aktif, matikan
   pada **salinan lokal** saja:
   `npx wrangler d1 execute inhal-poc --local --persist-to <folder-sesi> --command "UPDATE admin_mfa SET enabled = 0"`.
3. **Arsip bisa lebih tua dari dump produksi.** Data yang tampil adalah kondisi
   saat backup dibuat, bukan kondisi terkini.
4. **PDF/email tidak berfungsi** karena `GAS_DRIVE_URL` sengaja dikosongkan dan
   RPC terkait diblokir.
5. **Jangan pakai `--allow-write`** kecuali untuk eksperimen pada salinan. Tidak
   ada jalur ke produksi, tetapi perubahan bisa membuat data sesi tidak lagi
   sama dengan dump.

## Keamanan

- Akses hanya loopback (`--ip 127.0.0.1`).
- Dump berisi data pribadi mahasiswa dan hash password admin:
  - jangan commit (`local-data/` sudah di `.gitignore`);
  - jangan taruh di `htdocs` XAMPP atau folder yang disajikan web server lain;
  - hapus folder sesi secara manual bila sudah selesai.
- Tidak ada kredensial Cloudflare yang dibaca atau disimpan.

## Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| `Berkas dump tidak ditemukan` | Periksa path. Boleh relatif (dihitung dari folder saat perintah dijalankan) atau absolut. |
| `Berkas .enc harus didekripsi dulu` | Jalankan `scripts/decrypt-backup.mjs`. |
| `Address already in use` | Port dipakai proses lain; jalankan `--port=8791`. |
| Halaman login menolak password | Password mengikuti isi dump; akun belum ada/ganti password sejak backup. Periksa baris `admin` pada dump. |
| Login minta kode autentikator | MFA aktif di dump; matikan `admin_mfa` pada salinan lokal (lihat batasan 2). |
| `impor dump gagal` | Dump bukan ekspor D1/SQLite (mis. dump MySQL) atau rusak; verifikasi dengan `node scripts/verify-backup.mjs <file>`. |

## Tes

```bash
cd new-code1-cf
node --test scripts/__tests__/backup-app.node.mjs
```

Menguji penolakan `--remote`, validasi path/port, folder sesi unik tanpa
penghapusan, perintah wrangler selalu `--local`, serta daftar izin/penolakan
mode baca-saja.
