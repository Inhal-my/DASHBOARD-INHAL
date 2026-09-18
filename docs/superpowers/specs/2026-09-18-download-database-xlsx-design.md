# Desain: Download Database (Excel) di Master Data (`new-code1-cf`)

Tanggal: 2026-09-18
Status: Disetujui user (18 Sep 2026)

## Latar Belakang

Admin ingin mengecek ulang seluruh data yang tersimpan di D1 tanpa perintah Wrangler. Tempat yang diminta: menu di area pengaturan dashboard, judul **Download Database**.

Runtime database adalah Cloudflare D1, bukan spreadsheet. Unduhan adalah **ekspor baca** ke satu file Excel, bukan memindahkan runtime kembali ke Google Sheets.

## Keputusan User (18 Sep 2026)

1. Format: CSV/Excel. **Disetujui.**
2. Bentuk file: satu workbook Excel (`.xlsx`) berisi banyak sheet, seluruh data yang telah tersimpan selama proses berjalan. **Disetujui.**
3. Isi: semua tabel tanpa kecuali, termasuk hash password, token sesi, dan konten unggahan. **Disetujui.**
4. Pendekatan: Worker yang merakit XLSX (bukan merakit di browser, bukan ZIP CSV). **Disetujui (A).**
5. UI, alur backend, error/batas, dan cakupan uji: **disetujui per bagian.**

## Di Luar Cakupan

- Tidak mengubah runtime database (tetap D1).
- Tidak mengekspor ke Google Sheets.
- Tidak menambah tab navigasi sidebar baru (Pengajuan / Statistik / Berita Acara / Master Data tetap).
- Tidak ada restore/import dari file Excel hasil unduhan.
- Tidak mengubah `gs-shim.js` agar RPC mengembalikan biner.
- Tidak ada filter tabel, rentang tanggal, atau pilihan kolom pada rilis ini.

## Desain

### 1. UI — kartu Master Data

Tab yang dipakai: `tab === 'master'` (label navigasi **Master Data**; ini area pengaturan dashboard).

Kartu sidebar baru, paling bawah setelah **Admin**:

- `key: 'downloadDatabase'`
- `title` / `short`: `Download Database`
- `desc`: satu file Excel, satu sheet per tabel, seluruh data tersimpan
- `icon`: `bi-download`
- `settings: true` (bukan tabel CRUD)

Panel kanan (pola sama dengan **Pengaturan Bagian**):

- Judul **Download Database**
- Teks singkat: file berisi seluruh tabel D1 (satu sheet per tabel).
- Peringatan: file berisi data pribadi, hash password, token sesi, dan isi unggahan. Jangan bagikan.
- Tombol **Download Database**. Disabled + spinner selama unduhan.
- Nama file: `inhal-database-YYYY-MM-DD.xlsx` (tanggal Asia/Jakarta).

Hanya admin yang sudah login. Sesi bagian tidak melihat aksi ini sebagai endpoint yang sah (meski kartu hanya ada di dashboard admin).

Kartu Master Data lain tidak berubah.

### 2. Transport — endpoint khusus, bukan JSON RPC

`POST /api/rpc` dan `gs-shim.js` selalu `res.json()`. File `.xlsx` tidak lewat jalur itu.

Endpoint baru:

```
POST /api/database-export
Content-Type: application/json
Body: { "token": "<session token admin>" }
```

Sukses:

- HTTP 200
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="inhal-database-YYYY-MM-DD.xlsx"`
- Body: biner workbook

Gagal:

- HTTP 401 jika token kosong, bukan admin, atau sesi kedaluwarsa. Body JSON `{ "success": false, "message": "Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali." }`
- HTTP 500 jika baca D1 atau generate Excel gagal, atau hasil melebihi batas memori Worker. Body JSON `{ "success": false, "message": "Gagal mengunduh database." }`

Frontend dashboard: `fetch` ke endpoint ini (bukan `google.script.run`). Jika `content-type` spreadsheet, simpan blob. Jika JSON error, tampilkan `message` lewat toast yang sudah ada.

Handler RPC `downloadDatabase` **tidak** didaftarkan di `rpc.js`.

### 3. Isi workbook

Sumber: semua tabel user di D1 (`sqlite_master` type=`table`, exclude `sqlite_%`).

Urutan sheet: urutan nama tabel terurut alfabet.

Satu tabel = satu sheet. Nama sheet = nama tabel. Semua nama tabel saat ini <= 31 karakter dan tidak memakai karakter terlarang Excel (`\ / * ? : [ ]`).

Baris 1: nama kolom sesuai skema tabel, plus kolom terakhir `_truncated`.

Baris berikutnya: semua baris `SELECT * FROM <table>` tanpa filter. Nilai `null` jadi sel kosong. Nilai non-teks di-string-kan.

Kolom termasuk yang sensitif dan biner-sebagai-teks:

- `admin.password`, `bagian_staff.pass`
- `sessions.token` dan kolom sesi lain
- `uploads.content` (base64) dan kolom unggahan lain

Tabel kosong: sheet tetap ada, hanya header.

### 4. Batas Excel dan Worker

Batas sel Excel: 32.767 karakter. Jika nilai lebih panjang:

- sel dipotong ke 32.767 karakter
- kolom `_truncated` baris itu = `1`

Jika tidak ada sel terpotong pada baris itu, `_truncated` = `0`.

Jika generate gagal (termasuk kehabisan memori Worker ~128 MB), tidak mengirim file setengah jadi: HTTP 500 + pesan di atas.

Tidak ada streaming parsial dan tidak ada pecah file.

### 5. Auth

Pakai `requireAdmin` / sesi `role === 'admin'` yang sama dengan tulis master. Token dari `localStorage` dashboard (`inhal_admin_session`), dikirim di body JSON.

### 6. Modul generate

Fungsi murni di Worker, terpisah dari HTTP:

- input: peta `{ tableName: { columns: string[], rows: object[] } }`
- output: `Uint8Array` / `ArrayBuffer` file xlsx

Library OOXML boleh dipakai asal kompatibel Cloudflare Workers (tanpa Node `fs`). Tidak merakit xlsx di browser.

### 7. Pengujian

- Tanpa token / token bukan admin / sesi kedaluwarsa → 401 + pesan sesi, bukan file.
- Admin valid, beberapa tabel berisi data (termasuk hash, token, `uploads.content`) → 200, workbook, satu sheet per tabel, header = kolom + `_truncated`, isi sesuai D1.
- Tabel kosong → sheet hanya header.
- Nilai > 32.767 karakter → terpotong, `_truncated` = `1` pada baris itu.
- Kartu **Download Database** ada di Master Data; kartu lain tidak rusak.
- `POST /api/rpc` tidak menangani `downloadDatabase`.

## Komponen

| Unit | Tanggung jawab | Dependensi |
|---|---|---|
| Kartu UI Master Data | Tampilkan peringatan + tombol, fetch blob, simpan file, toast error | `session.token`, endpoint export |
| `POST /api/database-export` | Auth admin, baca semua tabel, panggil builder, kirim xlsx atau JSON error | D1, session, xlsx builder |
| XLSX builder | Workbook, sheet per tabel, potong sel, kolom `_truncated` | tidak ke D1/HTTP |

## Data flow

1. Admin buka Master Data → kartu Download Database.
2. Klik tombol → `POST /api/database-export` + token.
3. Worker cek sesi admin.
4. Worker `SELECT *` semua tabel user.
5. Builder membuat xlsx (potong sel jika perlu).
6. Browser mengunduh `inhal-database-YYYY-MM-DD.xlsx`.
