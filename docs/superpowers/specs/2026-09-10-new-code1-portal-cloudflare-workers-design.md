# Portal Mahasiswa di Cloudflare Workers — Design Spec

Tanggal: 2026-09-10
Status: Disetujui
Terkait: `docs/superpowers/specs/2026-09-10-new-code1-cloudflare-workers-poc-design.md`

## 1. Tujuan

Memindahkan halaman `portal` (Portal Mahasiswa) dari `new-code1` (Google Apps Script) ke Cloudflare Workers + Hono + D1, sehingga dapat dibuka di:

```
https://inhal-poc.new-code1-cf.workers.dev/portal
```

Fitur portal yang termasuk: login dengan NPM, melihat riwayat pengajuan, melihat detail pengajuan, dan mendaftar pengajuan baru.

## 2. Non-Cakupan

- Unggah berkas (ACC INHAL & bukti bayar) — ditunda ke tahap berikutnya.
- Halaman lain: `dashboard` (admin), `bagian`, `detail-laporan`.
- Autentikasi dengan kata sandi (login tetap cukup NPM, sama seperti aplikasi lama).
- Migrasi data asli dari Google Sheets/Drive.
- Email notifikasi.
- Penyimpanan berkas (R2).

## 3. Konteks

Portal asli berada di `new-code1/pages/portal.html`, sebuah aplikasi Vue 3 (CDN) dengan empat tampilan: `login`, `dashboard`, `detail`, `form`. Portal memanggil lima fungsi backend:

| Fungsi | Status di Worker |
|---|---|
| `getRegistrationOptions` | sudah ada |
| `getStudentNameByNpm` | sudah ada |
| `registerPengajuan` | sudah ada |
| `getStudentPortalData` | **baru** |
| `uploadBuktiFiles` | **ditunda (stub)** |

Sumber port untuk `getStudentPortalData` ada di `new-code1/1_business.gs:712`.

## 4. Arsitektur & Struktur File

```
new-code1-cf/
  public/
    index.html            (sudah ada)
    portal.html           (baru, salinan dari new-code1/pages/portal.html)
  src/
    index.js              (tambah rute /portal, /api/portal/:npm, /api/portal/upload)
    portal.js             (baru: getStudentPortalData)
    repo.js               (tidak berubah)
    lib.js                (tidak berubah)
    pengajuan.js          (tidak berubah)
  test/
    portal.test.js        (baru)
    api.test.js           (tambah uji rute portal)
```

Prinsip: fungsi murni/DB diletakkan terpisah (mis. `portal.js`) dan dapat diuji tanpa HTTP, mengikuti pola `repo.js`/`pengajuan.js` yang sudah ada.

## 5. Kontrak API & Pemetaan Data

### 5.1 `GET /api/portal/:npm`

Mengembalikan data portal mahasiswa. Bentuk sukses:

```json
{
  "nama": "Aisyah Putri",
  "npm": "2201010001",
  "email": "aisyah@contoh.com",
  "noHp": "08123456789",
  "buktiMode": "strict",
  "history": [
    {
      "id": "INHAL-...",
      "idPengajuan": "INHAL-...",
      "tanggalAjuan": "2026-09-10T08:05:03",
      "blok": "A",
      "jenis": "Ujian",
      "detail": "UAS",
      "tanggalKegiatan": "2026-09-20",
      "status": "Menunggu",
      "reason": "",
      "hasUpload": false,
      "linkFinal": "",
      "uploadTimestamp": ""
    }
  ]
}
```

Bentuk gagal (HTTP 200 dengan field `error`, mengikuti perilaku aplikasi lama):

```json
{ "error": "Data pengajuan tidak ditemukan untuk NPM 2201010001." }
```

Aturan pemetaan (port dari `getStudentPortalData`):

- NPM dicocokkan setelah menghilangkan karakter non-angka (padanan `_normalizeNpm`).
- `history` dibangun dari baris `pengajuan` milik NPM tersebut, digabung dengan `detail_kegiatan` per `id_pengajuan`.
- `detail` = gabungan `[pilihan, detail]` dipisah ` - `, antar item dipisah `; `.
- `tanggalKegiatan` = `tanggal_pelaksanaan` detail pertama; jika kosong pakai `tanggal_pelaksanaan` pengajuan.
- `hasUpload` = ada `link_acc_inhal` atau `link_bukti_bayar`.
- `uploadTimestamp` = `updated_at` bila `hasUpload`, jika kosong `"Uploaded"`.
- `email`/`noHp` = nilai tidak kosong dari baris terbaru (berdasarkan `timestamp` menurun).
- `nama` = `nama_lengkap` dari pengajuan; jika kosong, fallback ke tabel `mahasiswa` (fungsi `getStudentNameByNpm`).
- `history` diurutkan `tanggalAjuan` menurun.
- `buktiMode` dari `getBuktiMode` (config `BUKTI_MODE`).
- Bila tidak ada nama dan tidak ada riwayat → kembalikan `{ error: 'Data pengajuan tidak ditemukan untuk NPM <npm>.' }`.

### 5.2 `POST /api/portal/upload` (stub sementara)

Menerima payload JSON apa pun dan selalu mengembalikan:

```json
{ "success": false, "message": "Fitur unggah berkas akan tersedia pada tahap berikutnya." }
```

Tujuan: tombol unggah di portal tetap ada dan memberi pesan jelas, bukan error teknis.

## 6. Perubahan Frontend

- `public/portal.html` = salinan `new-code1/pages/portal.html` dengan dua penggantian scriptlet:
  - `<?= PAGE_TITLES.portal ?>` → `Portal Mahasiswa INHAL`
  - `const APP_URL = '<?= appUrl ?>'` → `const APP_URL = ''`
- Method `run()` diganti dari `google.script.run` menjadi pemetaan `fetch` berikut:

| `fn` | Pemetaan |
|---|---|
| `getRegistrationOptions` | `GET /api/registration-options` |
| `getStudentNameByNpm` | `GET /api/mahasiswa/<npm>` |
| `registerPengajuan` | `POST /api/pengajuan` |
| `getStudentPortalData` | `GET /api/portal/<npm>` |
| `uploadBuktiFiles` | `POST /api/portal/upload` |

- Selain `run()` dan scriptlet, isi halaman tidak diubah (UX/paritas tetap).

## 7. Routing `/portal`

- `new-code1-cf/wrangler.toml`: tambahkan `"/portal"` ke `assets.run_worker_first`.
- `src/index.js`: rute `app.get('/portal', ...)` yang mengambil aset `portal.html` melalui binding `ASSETS`:

```js
app.get('/portal', (c) => {
  const url = new URL('/portal.html', c.req.url);
  return c.env.ASSETS.fetch(new Request(url, c.req.raw));
});
```

Dengan begitu `/portal` menampilkan halaman dan `/portal.html` tetap bisa diakses.

## 8. Pengujian

- Unit (`test/portal.test.js`): 
  - NPM dengan pengajuan → bentuk `history` benar (detail gabungan, `hasUpload`, `buktiMode`).
  - NPM tanpa data → `{ error }` dan tidak melempar exception.
  - Pencocokan NPM mengabaikan karakter non-angka.
- Endpoint (`test/api.test.js`): `GET /api/portal/:npm` status 200 dan bentuk JSON benar; `POST /api/portal/upload` mengembalikan pesan stub.
- Smoke: `GET /portal` mengembalikan 200 dan memuat penanda halaman portal.
- Seluruh suite lama harus tetap lulus (`npm test`).

## 9. Deploy

- Jalankan `npm test` lalu deploy: `npx wrangler deploy` (dengan `CLOUDFLARE_API_TOKEN`).
- URL hasil: `https://inhal-poc.new-code1-cf.workers.dev/portal`.
- Tidak ada perubahan skema D1.

## 10. Risiko

- **Data kosong**: D1 saat ini berisi seed + pengajuan uji; portal akan menampilkan riwayat terbatas sampai pendaftaran nyata masuk.
- **Perbedaan status teks**: pemetaan kode status dilakukan di sisi klien (`mapStatusCode`), jadi teks status baru tetap aman.
- **Unggah berkas belum jalan**: ditangani dengan stub dan pesan yang jelas.
