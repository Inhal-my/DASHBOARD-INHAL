# Backup Viewer (PHP, read-only)

Membuka arsip cadangan INHAL lewat web server lokal (XAMPP/`php -S`) **tanpa**
Cloudflare dan tanpa Node. Viewer ini hanya membaca artefak CSV yang dihasilkan
`new-code1-cf/scripts/backup-snapshot.mjs`, tidak menulis apa pun.

## Yang perlu ada

- PHP 8.x (XAMPP macOS sudah menyertakan).
- Folder arsip berisi `manifest.csv` + `<tabel>.csv` (mis. `20261031-0100-csv/`).

## Pasang di XAMPP (macOS)

```bash
# 1. Salin viewer ke htdocs
cp -R new-code1-cf/tools/backup-viewer /Applications/XAMPP/xamppfiles/htdocs/backup-viewer

# 2. Salin arsip CSV ke folder data (nama folder = label)
mkdir -p /Applications/XAMPP/xamppfiles/htdocs/backup-viewer/data
cp -R ~/Downloads/d1-backup-20261031-0100/out/20261031-0100-csv \
      /Applications/XAMPP/xamppfiles/htdocs/backup-viewer/data/20261031-0100
```

Buka `http://localhost/backup-viewer/`.

## Tanpa XAMPP

```bash
php -S 127.0.0.1:8080 -t new-code1-cf/tools/backup-viewer
```

`php -S` mengikat ke loopback sehingga hanya bisa dibuka dari komputer sendiri.

## Fitur

| Fitur | Keterangan |
|---|---|
| Daftar arsip | dari subfolder `data/` yang memiliki `manifest.csv` |
| Daftar tabel | dibaca dari `manifest.csv` beserta jumlah baris |
| Tabel | paginasi 100 baris, sel panjang dipotong + tooltip |
| Pencarian | substring lintas kolom pada tabel aktif |
| Unduh CSV | mengalirkan berkas asli (`<tabel>.csv`) tanpa menulis berkas baru |

## Batas

- CSV **tidak** memuat kolom besar (`uploads.content`) dan kolom > 20 KB
  dikecualikan — sama seperti snapshot/XLSX. Untuk isi penuh pakai dump SQLite.
- Tidak ada fitur edit, hapus, atau unggah: seluruh kode hanya membaca berkas.
- Nama tabel dan label divalidasi `^[A-Za-z0-9_]+$` sebelum dipakai sebagai path
  (mencegah path traversal).

## Keamanan

- Akses dibatasi `127.0.0.0/8` dan `::1`; alamat lain mendapat HTTP 403.
- `data/` dilindungi `.htaccess` (`Require all denied`) agar berkas arsip tidak
  bisa diunduh langsung.
- Respons memakai `Cache-Control: no-store`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Arsip berisi data pribadi: jangan taruh folder ini di server publik dan jangan
  commit `data/` ke repositori (sudah masuk `.gitignore`).
