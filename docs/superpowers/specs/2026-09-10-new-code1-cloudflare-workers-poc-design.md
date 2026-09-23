# Desain: DASHBOARD-INHAL — Cloudflare Workers PoC (`new-code1-cf`)

Tanggal: 2026-09-10
Status: Disetujui user (pendekatan A2 — Hono)
Sumber: folder `new-code1/` (Google Apps Script + Google Sheets + Google Drive)
Tujuan: proof-of-concept satu halaman (`index` / pendaftaran) berjalan penuh di Cloudflare Workers + D1, sebagai fondasi migrasi penuh.

## 1. Ringkasan & keputusan yang disetujui

| Keputusan | Pilihan |
|---|---|
| Produk Cloudflare | Cloudflare Workers (Static Assets) |
| Framework backend | Hono (A2) |
| Database | Cloudflare D1 (SQLite) |
| Lokasi project | `new-code1-cf/` (folder baru di root repo) |
| Target PoC | Jalan lokal dulu (`wrangler dev` + D1 lokal) |
| Data D1 | Skema tabel + seed contoh |
| Upload surat (opsional) | Ditunda (R2 fase berikutnya) |
| Frontend | Pakai ulang `new-code1/pages/index.html` + shim `run()` |
| Cakupan halaman | Hanya `index` (pendaftaran publik) |

Dokumen ini **tidak** mencakup: halaman portal/bagian/dashboard/detail-laporan, auth/session, email, nomor surat, R2, migrasi data asli, cron, dan deploy produksi.

## 2. Tujuan (PoC)

1. Membuktikan satu halaman GAS dapat direplikasi di Cloudflare tanpa mengubah tampilan/perilaku form.
2. Membuktikan pola konversi `google.script.run(fn, ...args)` → `fetch('/api/...')`.
3. Membuktikan D1 dapat menggantikan Google Sheets untuk alur tulis/baca (insert Pengajuan + DetailKegiatan + StatusHistory).
4. Menghasilkan kerangka project Worker yang bisa dilanjutkan ke fase migrasi berikutnya.

Kriteria sukses:

- `wrangler dev` menyajikan halaman `index` dengan benar di `http://localhost:8787`.
- Opsi pendaftaran tampil dari D1 (bukan hardcode).
- Blur NPM mengisi Nama Lengkap dari data mahasiswa D1.
- Submit form menyimpan 1 baris `pengajuan`, N baris `detail_kegiatan`, dan 1 baris `status_history` di D1 lokal.
- Duplikasi + validasi email/HP/NPM berperilaku sama seperti GAS.

## 3. Arsitektur & struktur folder

`new-code1-cf/` adalah project Wrangler mandiri yang **tidak mengubah** kode `new-code1/`.

```
new-code1-cf/
  package.json          # devDeps: wrangler, hono
  wrangler.toml         # name, main, compatibility_date, assets, d1 binding
  schema.sql            # skema D1 + seed contoh
  src/index.js          # Hono app + rute /api
  src/gas-port.js       # port helper GAS (norm, validasi, buildDetailKegiatanRows, resolveBagianFor)
  public/index.html     # salinan new-code1/pages/index.html + shim run()
  README.md             # cara menjalankan & verifikasi
```

Alur:

1. Request `GET /` → Worker menyajikan `public/index.html` (Static Assets).
2. Halaman Vue memanggil `run(fn, ...args)` yang di-shim menjadi `fetch('/api/...')`.
3. Worker menangani `/api/...` dengan Hono, membaca/menulis ke binding D1 (`DB`).

Binding `wrangler.toml`:

```toml
name = "inhal-poc"
main = "src/index.js"
compatibility_date = "2026-09-01"

[assets]
directory = "./public"

[[d1_databases]]
binding = "DB"
database_name = "inhal-poc"
database_id = "PLACEHOLDER"   # diisi saat deploy; --local tidak butuh id nyata
```

## 4. Skema D1 (subset PoC) + seed

Nama kolom snake_case, dipetakan 1:1 dari `SCHEMAS` di `0_code.gs`.

```sql
CREATE TABLE mahasiswa (
  npm TEXT PRIMARY KEY, nama_lengkap TEXT, email TEXT, blok TEXT, keterangan TEXT
);
CREATE TABLE master_kegiatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kategori TEXT NOT NULL, nilai TEXT NOT NULL
);
CREATE TABLE master_bagian (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lab TEXT, kegiatan_lab TEXT, bagian TEXT, email TEXT
);
CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE pengajuan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT, id_pengajuan TEXT UNIQUE, npm TEXT, nama_lengkap TEXT, email TEXT,
  no_hp_wa TEXT, blok TEXT, jenis_kegiatan TEXT, dosen TEXT, tanggal_pelaksanaan TEXT,
  keterangan TEXT, link_surat_keterangan TEXT, status TEXT, catatan_admin TEXT,
  notifikasi_terkirim_pada TEXT, status_notifikasi_email TEXT, error_notifikasi_email TEXT,
  lampiran_email TEXT, nomor_surat TEXT, link_acc_inhal TEXT, link_bukti_bayar TEXT,
  link_final TEXT, status_info_bagian TEXT, waktu_info_bagian TEXT, email_bagian TEXT,
  catatan_info_bagian TEXT, updated_at TEXT
);
CREATE TABLE detail_kegiatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, id_pengajuan TEXT,
  jenis_kegiatan TEXT, pilihan TEXT, detail TEXT, tanggal_pelaksanaan TEXT, bagian TEXT
);
CREATE TABLE status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, id_pengajuan TEXT,
  status TEXT, catatan TEXT, actor_email TEXT
);
CREATE INDEX idx_pengajuan_npm ON pengajuan(npm);
CREATE INDEX idx_detail_pengajuan ON detail_kegiatan(id_pengajuan);
CREATE INDEX idx_history_pengajuan ON status_history(id_pengajuan);
CREATE INDEX idx_master_kegiatan_kategori ON master_kegiatan(kategori);
```

Seed contoh: beberapa baris `mahasiswa`, `master_kegiatan` untuk kategori `Blok/Ujian/SGD/Detail SGD/KKD/Detail KKD/Lab/Kegiatan Lab/Dosen`, beberapa `master_bagian`, dan `config('BUKTI_MODE','strict')`.

## 5. Kontrak API (parity dengan GAS)

| Method | Rute | Setara GAS | Respons |
|---|---|---|---|
| GET | `/api/registration-options` | `getRegistrationOptions()` | `{ blok, ujian, sgd, detailSgd, kkd, detailKkd, lab, kegiatanLab, dosen, buktiMode }` |
| GET | `/api/mahasiswa/:npm` | `getStudentNameByNpm(npm)` | string nama (kosong bila tidak ada) — parity penuh agar halaman tidak perlu diubah |
| POST | `/api/pengajuan` | `registerPengajuan(formData)` | `{ success, message, idPengajuan }` |

Aturan `POST /api/pengajuan` (port dari `1_business.gs:193`):

1. Validasi `npm` & `namaLengkap` wajib; `email` format benar; `noHp` format benar. Pesan error identik.
2. Cek duplikat memakai key `[norm(npm), norm(jenis), detail, tanggal]` (port `_buildPengajuanKey` + pembanding `_buildPengajuanKeyFromStored`).
3. `idPengajuan = 'INHAL-' + crypto.randomUUID()` (GAS memakai `Utilities.getUuid()`).
4. Bangun baris detail via `_buildDetailKegiatanRows` (termasuk `_resolveBagianFor` untuk Praktikum).
5. Transaksi D1 (`db.batch`): insert `pengajuan`, `detail_kegiatan[]`, `status_history` (`status='Menunggu'`, `catatan='Pengajuan dibuat.'`, `actor_email=''`).
6. `fileSurat` **diabaikan** di PoC (disimpan kosong); R2 menyusul.

Helper yang di-port ke `src/gas-port.js`: `norm`, `_normalizeFormText`, `_isValidEmail`, `_isValidPhone`, `_buildDetailKegiatanRows`, `_resolveBagianFor`, `_buildPengajuanKey`, `_buildPengajuanKeyFromStored`, `getMasterOptions` (dari D1).

## 6. Shim frontend

Hanya method `run()` di salinan `public/index.html` yang diubah. Kontrak tetap Promise (resolve = hasil, reject = Error message), meniru `google.script.run.withSuccessHandler().withFailureHandler()`.

```js
run(fn, ...args) {
  const map = {
    getRegistrationOptions: () => ({ method: 'GET',  url: '/api/registration-options' }),
    getStudentNameByNpm:    (npm) => ({ method: 'GET',  url: '/api/mahasiswa/' + encodeURIComponent(npm) }),
    registerPengajuan:      (payload) => ({ method: 'POST', url: '/api/pengajuan', body: payload })
  };
  const call = map[fn];
  if (!call) return Promise.reject(new Error('Fungsi tidak dikenal: ' + fn));
  const { method, url, body } = call.apply(null, args);
  return fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  }).then(async (res) => {
    const data = await res.json().catch(() => ({ success: false, message: 'Respons tidak valid' }));
    if (!res.ok && data && data.success !== true) {
      throw new Error(data.message || ('HTTP ' + res.status));
    }
    return data;
  });
}
```

Catatan kompatibilitas bentuk respons: `getStudentNameByNpm` mengembalikan string langsung (bukan `{namaLengkap}`) di GAS, sehingga endpoint `/api/mahasiswa/:npm` sebaiknya mengembalikan string JSON agar halaman tidak perlu diubah. Keputusan final: **endpoint mengembalikan string nama** (parity penuh, halaman tidak disentuh).

## 7. Workflow lokal & verifikasi

```bash
# 1. Masuk folder project
cd new-code1-cf

# 2. Pasang dependensi
npm install

# 3. Buat skema + seed di D1 lokal
npx wrangler d1 execute inhal-poc --local --file=./schema.sql

# 4. Jalankan dev server
npx wrangler dev
```

Verifikasi:

```bash
# Opsi pendaftaran
curl -s http://localhost:8787/api/registration-options

# Nama mahasiswa dari NPM (ganti dengan NPM seed)
curl -s http://localhost:8787/api/mahasiswa/2201010001

# Submit pengajuan
curl -s -X POST http://localhost:8787/api/pengajuan \
  -H 'Content-Type: application/json' \
  -d '{"npm":"2201010001","namaLengkap":"Tes","email":"tes@contoh.com","noHp":"08123456789","jenisKegiatan":"Ujian","detailKegiatan":"UAS","tanggalKegiatan":"2026-09-20"}'

# Cek baris tersimpan
npx wrangler d1 execute inhal-poc --local --command "SELECT id_pengajuan, npm, status FROM pengajuan ORDER BY id DESC LIMIT 5"
```

Uji manual: buka `http://localhost:8787`, isi form, submit, pastikan kartu sukses menampilkan ID Pengajuan.

## 8. Risiko & catatan

- **Paritas helper**: `norm` memakai `normalize('NFKD')` + regex diakritik — port JS standar, aman di Workers.
- **Waktu**: Workers memakai UTC; simpan `timestamp` sebagai ISO lokal (`Asia/Jakarta`) agar tampilan konsisten. Gunakan formatter eksplisit, bukan `new Date().toString()`.
- **UUID**: `crypto.randomUUID()` tersedia di runtime Workers.
- **D1 multi-statement**: eksekusi `schema.sql` lewat file; untuk insert runtime gunakan `db.batch([...])` agar atomik.
- **Static assets vs API**: pastikan rute `/api/*` tidak tertutup oleh fallback aset; gunakan `run_worker_first` bila perlu.
- **`database_id`**: `--local` tidak memerlukan id nyata, tetapi `wrangler.toml` harus tetap valid untuk `deploy` nanti.

## 9. Fase lanjutan (di luar PoC)

1. Skema D1 penuh 13 tabel + skrip migrasi data dari Google Sheets (export CSV → import D1).
2. Auth/session (cookie + hash Web Crypto) menggantikan `Session`/`createSession`.
3. Portal (upload ACC/bukti) + R2 + validasi bukti.
4. Email final (`acc_diterima/ditolak/final`) via API penyedia email + tabel `email_templates` di D1.
5. Bagian (BA) + Dashboard + Laporan + export XLSX.
6. Nomor surat (counter D1 transaksional) + deploy produksi + domain.
