# Desain: Migrasi panel admin (dashboard, detail-laporan, bagian) ke Cloudflare Workers (mode baca)

Tanggal: 2026-09-10
Status: disetujui untuk direncanakan

## 1. Konteks dan tujuan

`index` dan `portal` dari aplikasi lama (`new-code1`, Google Apps Script) sudah berjalan di
Cloudflare Workers + Hono + D1 (`new-code1-cf/`). Tahap ini memindahkan tiga halaman panel:

- `dashboard.html` (panel admin, 2538 baris)
- `detail-laporan.html` (laporan admin, 2013 baris)
- `bagian.html` (panel bagian, 932 baris)

Tujuan tahap ini: ketiga halaman dapat diakses dari Cloudflare dan **semua data termuat
dengan cepat dan akurat** dalam mode baca. Aksi yang mengubah data (CRUD, email, unggah
berkas, sinkronisasi) belum diimplementasikan dan di-stub.

Sumber data (Google Sheet `DATABASE_SHEET_ID`) tetap dipakai aplikasi lama. D1 diperlakukan
sebagai **replika baca** yang di-refresh dengan menjalankan ulang importer secara manual.

## 2. Cakupan

Termasuk:
- Perluasan skema D1 (10 tabel baru) dan importer untuk sheet tambahan.
- Port autentikasi admin dan bagian beserta sesi (disimpan di D1).
- Endpoint RPC tunggal + shim `google.script.run` untuk semua halaman.
- Port fungsi baca yang dipakai ketiga halaman.
- Penyalinan ketiga halaman ke `public/` dan perutean `/dashboard`, `/detail-laporan`, `/bagian`.
- Test otomatis untuk auth, dispatch RPC, dan mapper baris.

Tidak termasuk (stub):
- Semua aksi tulis: `updatePengajuanFields`, `updatePengajuanStatus`, `updateDetailKegiatan`,
  `deleteDetailKegiatan`, `deletePengajuanAdmin`, `deleteBeritaAcaraAdmin`,
  `uploadBeritaAcaraAdmin`, `uploadBeritaAcaraBagian`, `syncLogDataToPengajuan`,
  `sendStatusNotificationEmail`, `sendFinalEmail`, `sendBulkFinalEmail`,
  `sendAccFinalToBagian`, `saveBagianBaSettings`, dan semua `save*` (master, config, staff,
  admin).
- Email, unggah berkas (R2), pembuatan PDF, login pembayaran, penulisan balik ke Google Sheet.
- Task ACC Final (portal/Bagian) yang masih pending.

## 3. Pendekatan

RPC generik + shim `google.script.run` (opsi A).

Alasan: ketiga halaman memanggil backend lewat pola
`google.script.run.withSuccessHandler(...).withFailureHandler(...)[fn](...args)` dan
menyisipkan token sesi sebagai argumen terakhir. Mengganti global `google.script.run`
sekaligus menghindari pengeditan ~30 titik pemanggilan dan otomatis mencakup `run` dan
`runAsBab`. Pendekatan REST eksplisit akan memerlukan puluhan endpoint dan edit klien yang
rawan, tanpa manfaat tambahan pada tahap baca.

## 4. Arsitektur dan modul

Worker (`new-code1-cf/`):

- `src/index.js` — tambah `POST /api/rpc` (dan tetap mempertahankan endpoint lama).
- `src/session.js` — sesi berbasis D1: buat, ambil, hapus, validasi kedaluwarsa, dan guard.
- `src/rpc.js` — peta fungsi baca; penentuan token; fallback stub untuk fungsi tulis.
- `src/read/` — modul baca murni yang diport dari GAS:
  - `columns.js` — peta kolom D1 -> label sheet per tabel.
  - `common.js` — `norm`, `parseCurrency`, `formatRupiah`, `resolveBagianFor`,
    `resolveBiayaForPengajuan`, `clientRow`, helper agregasi.
  - `dashboard.js` — fungsi baca dashboard.
  - `laporan.js` — `getLaporanBootstrap`.
  - `bagian.js` — fungsi baca bagian.
  - `admin.js` — monitor master data dan diagnostik.

Aset statis (`public/`):

- `gs-shim.js` — shim global `google.script.run` + util tanggal/npm.
- `dashboard.html`, `detail-laporan.html`, `bagian.html` — salinan halaman lama dengan
  scriptlet diganti.

Batasan modul: setiap modul baca adalah fungsi murni `(db, ...args) -> objek` tanpa efek
samping; `rpc.js` menangani HTTP dan auth; halaman hanya berbicara lewat `/api/rpc`.

## 5. Model data dan importer

### 5.1 Tabel D1 baru

Skema ditambahkan ke `new-code1-cf/schema.sql` sebagai skema kanonik (dipakai test dan D1
lokal; tetap memuat `DROP` + seed dummy). Untuk produksi, disediakan migrasi terpisah
`new-code1-cf/migrations/2026-09-10-admin-panels.sql` yang hanya berisi
`CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` untuk tabel baru, sehingga tidak
menghapus data yang sudah ada. Nama kolom memakai gaya snake_case; label sheet dipetakan di
`src/read/columns.js`.

- `admin(password TEXT, nama TEXT)`
- `bagian_staff(email TEXT, kategori TEXT, nama TEXT, pass TEXT)`
- `sessions(token TEXT PRIMARY KEY, role TEXT, nama TEXT, kategori TEXT, sub_bagian TEXT,
  kategoris TEXT, created_at TEXT, expires_at TEXT)`
- `berita_acara(timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan,
  jumlah_peserta, file_name, file_url, catatan, sumber)`
- `berita_acara_peserta(timestamp, ba_id, npm, nama_lengkap, blok, bagian, status_pengajuan)`
- `berita_acara_admin(...)` — kolom sama dengan `berita_acara`
- `berita_acara_admin_peserta(...)` — kolom sama dengan `berita_acara_peserta`
- `master_biaya(kegiatan TEXT, biaya TEXT)` — nilai mentah `"Rp. 300.000"` dipertahankan
- `check_data(timestamp, check_id, id_pengajuan, npm, nama_lengkap, blok, jenis_kegiatan,
  pilihan, detail, tanggal_pelaksanaan, bagian, dosen, hadir, catatan, updated_at, biaya)`
- `nomor_surat(type TEXT, tahun TEXT, last_number INTEGER, updated_at TEXT)`
- `log_data(id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp, payload TEXT)` — sheet kosong;
  hanya untuk hitungan diagnostik dan sinkronisasi (stub)

Indeks ditambahkan untuk kolom yang sering digabung: `pengajuan(id_pengajuan)`,
`detail_kegiatan(id_pengajuan)`, `berita_acara(ba_id)`, `berita_acara_peserta(ba_id)`,
`check_data(id_pengajuan)`, `sessions(expires_at)`.

### 5.2 Importer

`scripts/import-sheets.mjs` diperluas agar membaca sheet baru:
`Admin`, `BagianStaff`, `BeritaAcara`, `BeritaAcaraPeserta`, `BeritaAcaraAdmin`,
`BeritaAcaraAdminPeserta`, `MasterBiaya`, `CheckData`, `StatusHistory`, `NomorSurat`,
`LogData`.

- `Admin`, `BagianStaff`, dan `MasterBiaya` tidak memiliki baris header terdeteksi gviz;
  gunakan `tableToRecordsAuto` dengan peta label posisional.
- Impor tetap idempoten (`DELETE` lalu `INSERT`).
- SQL hasil impor tidak di-commit (memuat data pribadi).

## 6. Autentikasi dan sesi

Port dari GAS dengan perilaku setara:

- `authenticateAdmin(password)` — cocokkan kolom password tabel `admin`; kembalikan
  `{ok:true, token, nama}` atau `{ok:false, message:'Password admin salah.'}`.
- `authenticateBagian(password, kategori, subBagian)` — cocokkan kolom `pass` tabel
  `bagian_staff`; gunakan `_baginaHasAccess` (wildcard `*`/`semua`/kosong, alias lab dari
  `master_bagian`) seperti GAS; pesan gagal sama persis.
- `logoutSession(token)` — hapus baris sesi; kembalikan `{success:true, message:'Anda telah keluar.'}`.
- `adminBagianBypass(kategori, subBagian, token)` — wajib sesi admin; buat sesi bagian
  (kategoris `[kategori]`); kembalikan `{ok, token, nama, kategori, subBagian}`.
- `requireAdmin(token)` / `requireBagian(kategori, subBagian, token)` — lempar pesan
  `'Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.'` bila gagal.

Sesi: token `crypto.randomUUID()`, TTL 4 jam, `expires_at` diisi ISO. Sesi kedaluwarsa
dianggap tidak ada dan dibersihkan saat diakses. Payload `kategoris` disimpan sebagai JSON
string.

Penentuan token di RPC: bila argumen terakhir berupa string dan ditemukan di tabel `sessions`
(masih berlaku), argumen itu dianggap token dan tidak diteruskan ke handler. Jika tidak,
tidak ada sesi. Ini meniru `arguments[arguments.length-1]` pada GAS.

## 7. Kontrak RPC

`POST /api/rpc`

Request: `{ "fn": "getDashboardBootstrap", "args": [<...>] }`

Response sukses: JSON apa pun yang dikembalikan handler, dengan HTTP 200.

Response gagal (mis. sesi tidak valid): HTTP 200 dengan body `{ "error": "<pesan>" }` agar
klien memanggil failure handler dan menjalankan logika `isAuthError` yang sudah ada. Untuk
fungsi yang tidak dikenal atau stub tulis: HTTP 200 dengan
`{ "success": false, "message": "Fitur <fn> belum tersedia pada tahap ini." }`.

Fungsi baca yang dipetakan:

Auth/umum: `authenticateAdmin`, `authenticateBagian`, `logoutSession`, `adminBagianBypass`,
`getBaginaConfig`, `getBagianBaSettings`.

Dashboard: `getDashboardBootstrap`, `getDashboardStats`, `getPengajuanList`,
`getBagianAggregation`, `getBeritaAcaraAdminList`, `getLabOptions`, `getMasterDataMonitor`,
`getPengajuanWithDetails`, `getBaUploadOptions`, `diagnosticData`.

Laporan: `getLaporanBootstrap`.

Bagian: `getBagianBootstrap`, `getBeritaAcaraList`.

Fungsi lain dianggap stub tulis.

## 8. Shim klien

`public/gs-shim.js` mendefinisikan `window.google.script.run` sebagai objek rantai:

- `.withSuccessHandler(fn)` / `.withFailureHandler(fn)` menyimpan callback.
- Akses properti dinamis `[fnName]` mengembalikan fungsi yang mengirim
  `POST /api/rpc {fn, args}` lalu memanggil success/failure.
- `isAuthError`, `clearSession`, dan konstanta sesi tetap memakai implementasi halaman.

Halaman memuat shim sebelum skrip halaman. `google.script.run` dipanggil di dalam method
`run`/`runAsBab` yang sudah menangani penambahan token; shim tidak menambah token sendiri.

Penanganan hasil: jika HTTP bukan 2xx atau body memuat `error`, shim memanggil failure handler
dengan `{message: <error>}`; selain itu memanggil success handler dengan body JSON. Ini
mempertahankan alur `isAuthError` yang sudah ada di halaman.

## 9. Penyesuaian halaman

Untuk setiap halaman:

- Ganti `<title>` scriptlet dengan judul literal (`Dashboard`, `Laporan Detail`, `Bagian`).
- Ganti `const APP_URL = '<?= appUrl ?>'` menjadi `const APP_URL = ''`.
- Ganti `const USER_EMAIL = '<?= userEmail ?>'` menjadi `const USER_EMAIL = ''`.
- Ganti tautan `appUrl + '?page=detail-laporan'` menjadi `'/detail-laporan'`, dan
  `appUrl + '?page=dashboard'` menjadi `'/dashboard'` (total 3 tautan).
- Muat `<script src="/gs-shim.js"></script>` sebelum skrip utama.

Perutean statis: Assets memetakan `/dashboard` -> `dashboard.html`, `/detail-laporan` ->
`detail-laporan.html`, `/bagian` -> `bagian.html` (tanpa rute Worker tambahan, seperti
`/portal`).

## 10. Performa

- Ukuran data kecil (1761 mahasiswa, pengajuan dan BA belasan baris), sehingga satu kali
  baca penuh per tabel lalu komputasi di memori (mengikuti pola GAS) sudah cepat.
- Satu request bootstrap membaca tabel yang dibutuhkan dalam satu gelombang `Promise.all`,
  bukan per-baris.
- Tidak ada cache lintas-request agar data selalu akurat; hanya memoization per-request untuk
  tabel yang dibaca berulang (mis. `getMasterOptions`).
- Indeks pada kolom gabungan (bagian 5.1) menjaga penggabungan tetap cepat saat data tumbuh.
- Tabel kecil yang tak berubah (`master_kegiatan`, `master_bagian`, `config`, `admin`,
  `bagian_staff`) boleh di-cache di memori modul dengan invalidasi manual, tetapi default
  tanpa cache demi akurasi.

## 11. Akurasi

- Setiap baris D1 dikonversi ke objek berlabel sheet asli lewat `columns.js`, karena halaman
  membaca kunci seperti `'ID Pengajuan'`, `'Nama Lengkap'`, `'Status'`, `'Jenis Kegiatan'`.
- Timestamp disimpan ISO (`YYYY-MM-DDTHH:mm:ss`) oleh importer dan dikembalikan apa adanya,
  setara `_clientDate` GAS.
- `parseCurrency`, `formatRupiah`, `resolveBiayaForPengajuan`, `resolveBagianFor`, dan
  `baginaHasAccess` diport dengan perilaku sama, termasuk pencocokan longgar berbasis `norm`.
- Nilai mentah biaya (`"Rp. 300.000"`) disimpan apa adanya dan di-parse saat baca agar sama
  dengan GAS.
- Refresh data lewat importer ulang; tidak ada penulisan dari Worker.

## 12. Pengujian

Unit (vitest, pola yang sudah ada):
- Parser/importer sheet baru (termasuk headerless `MasterBiaya`, `Admin`, `BagianStaff`).
- Sesi: buat, ambil, kedaluwarsa, hapus; `requireAdmin`/`requireBagian` melempar pesan tepat.
- Auth: admin benar/salah; bagian dengan wildcard, alias lab, dan penolakan kategori.
- Dispatch RPC: pemetaan fungsi, deteksi token, fallback stub.
- Mapper baris: setiap tabel memetakan kolom D1 ke label yang benar.
- Fungsi baca utama diuji dengan data seed dan dibandingkan bentuk keluarannya
  (`getDashboardBootstrap`, `getLaporanBootstrap`, `getBagianBootstrap`, dll.).

End-to-end lokal (`wrangler dev` + D1 lokal berisi data asli hasil importer):
- Login admin, buka `/dashboard`, pastikan bootstrap/stats/daftar termuat.
- Login admin, buka `/detail-laporan`.
- Login bagian, buka `/bagian`, pastikan bootstrap dan daftar BA termuat.
- Pastikan aksi tulis menampilkan pesan stub dan tidak mengubah data.

## 13. Risiko dan catatan

- Port fungsi baca dashboard adalah bagian terbesar; dilakukan bertahap per fungsi dengan test.
- `log_data` kosong dan format sheet lama sangat lebar; hanya kolom inti yang dimodelkan.
- Perubahan data di aplikasi lama tidak otomatis terlihat sampai importer dijalankan ulang.
- Beberapa tautan internal memakai `?page=`; diganti ke rute baru (bagian 9).

## 14. Kriteria penerimaan

- `/dashboard`, `/detail-laporan`, `/bagian` dapat dibuka dan menampilkan data nyata dari D1.
- Login admin dan bagian berfungsi dengan kredensial dari sheet asli.
- Semua fungsi baca pada bagian 7 mengembalikan data yang benar dan sesuai label sheet.
- Aksi tulis menghasilkan pesan stub dan tidak mengubah data.
- Seluruh test lulus.
- Halaman termuat cepat (bootstrap < 1,5 dtk pada D1 produksi) dan akurat.
