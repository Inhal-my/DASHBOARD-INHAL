# Desain: Semua Sesi Pelaksanaan, Tab "Jadwal vs Realisasi", dan Penanda Berkas BA

Tanggal: 2026-10-16
Status: disetujui (menunggu review spec)

## Tujuan

Melanjutkan pekerjaan tab "Daftar BA" di `new-code1-cf/public/detail-laporan.html` dengan tiga item yang sebelumnya ditunda:

- **E**: Menampilkan **semua sesi pelaksanaan** per unit kegiatan (sebelumnya hanya sesi pertama `pelaksanaan[0]`).
- **F**: Menambah tab **"Jadwal vs Realisasi"** yang membandingkan sesi jadwal (`jadwal_pelaksanaan`) dengan realisasi BA Pelaksanaan (`berita_acara`, ditautkan lewat `jadwal_id`).
- **G**: Menambah **penanda berkas** (Ada/Hilang) dan menampilkan **Base File URL** untuk BA Pendukung (`berita_acara_admin`).

## Non-Goals

- Tidak mengubah skema/migrasi. F hanya menambah pembacaan tabel yang sudah ada.
- Tidak memakai flag `needs_regen` untuk penanda "Hilang" (keputusan: cukup `File URL` kosong).
- Tidak mengubah perilaku produksi lain (Kelola BA, Hapus BA, Riwayat, export lama, tab lama).

## Constraints

- Produksi berjalan. Migrasi/tulis tidak diubah pada iterasi ini.
- Pertahankan seluruh fitur tab yang ada.
- Copy UI: "Jadwal"/"Realisasi", "Ada"/"Hilang", "Base File".
- Semua test dijalankan dari `new-code1-cf/` dengan `npx vitest run <file>`.

---

## E — Semua sesi pelaksanaan per unit

### Fakta data
`getLaporanBootstrap` sudah mengisi `kegiatan[].pelaksanaan[]` berisi **semua** sesi BA Pelaksanaan dengan bentuk `{ baId, tanggal, jam, dosen }` (`src/read/laporan.js:150`). Tidak ada perubahan backend.

### Perubahan UI (tab Berita Acara)
- Di panel expand baris unit (mekanisme `expanded[r.key]` yang sudah ada), tambah section baru **"Sesi Pelaksanaan (N)"** setelah blok Berita Acara.
- Setiap sesi ditampilkan sebagai baris: `#` (indeks+1), `Tanggal`, `Jam`, `Dosen`, dan `BA ID` (jadi tautan bila File URL BA tersebut ada — padanan BA Pelaksanaan di `r.baPelaksanaan` dicari via `baId`).
- Bila `r.pelaksanaan.length === 0`, section menampilkan teks "Belum ada sesi pelaksanaan."
- Pada sel kolom `Realisasi` (saat ini `r.pelaksanaan[0]`), tambahkan badge kecil **"N sesi"** bila `N > 1` agar baris terlipat memberi petunjuk jumlah sesi. Isi kolom tetap menampilkan sesi pertama.

---

## F — Tab "Jadwal vs Realisasi"

### Backend: `src/read/laporan.js`

Tambah pembacaan:

```js
const jadwalRows = (await db.prepare('SELECT * FROM jadwal_pelaksanaan').all()).results || [];
const jadwalPesertaRows = (await db.prepare('SELECT * FROM jadwal_peserta').all()).results || [];
```

Bentuk data turunan:

- `jadwalPesertaByJadwal`: `{ [jadwalId]: [{ npm, namaLengkap, blok, statusPengajuan }] }`.
- `baIdByJadwal`: dari `berita_acara.jadwal_id` → `ba_id` (BA pertama per jadwal).

Lampirkan ke tiap unit: `u.jadwal = [...]` dengan tiap elemen:

```js
{
  jadwalId, tanggal, jam, dosen, catatan,
  peserta: [{ npm, namaLengkap, blok, statusPengajuan }],
  baId: '' // BA Pelaksanaan yang tertaut (via jadwal_id), atau ''
}
```

- Hanya `jadwal_pelaksanaan.active === 1` yang disertakan.
- Penautan ke unit memakai `kegiatan_key` (fallback `kegiatanKey(bagian, blok, nama_kegiatan)`), konsisten dengan `attach()` unit yang ada.

Tambah field top-level pada objek return:

```js
jadwal: [{
  jadwalId, kegiatanKey, bagian, blok, label, namaKegiatan,
  tanggal, jam, dosen, catatan,
  peserta: [{ npm, namaLengkap, blok, statusPengajuan }],
  baId
}]
```

`beritaAcara` (BA Pelaksanaan) sudah membawa `Jadwal ID` sehingga klien dapat menghitung baris **Extra**.

### Frontend: `public/detail-laporan.html`

Tab baru:

```js
{ key: 'jadwal', label: 'Jadwal vs Realisasi', icon: 'bi-calendar2-check' }
```

State:

```js
jadwalFilter: { bagian: '', blok: '', from: '', to: '', status: '', q: '' }
```

Computed:

- `jadwalRealisasiRows` — satu baris per sesi jadwal:

  Rujukan realisasi diambil dari peta `baPelaksanaanById` yang dibangun klien dari seluruh `kegiatan[].baPelaksanaan[]` (kunci `BA ID`). Bila `baId` ada, baris memakai detail BA tersebut.

  ```js
  {
    jenis: 'Jadwal',
    jadwalId, bagian, blok, kegiatan, label,
    jadwalTanggal, jadwalJam, jadwalDosen, jadwalPesertaCount,
    baId, baTanggal, baJam, baDosen, baPesertaCount,
    status: 'Sesuai' | 'Belum'
  }
  ```

  `Sesuai` bila ada BA tertaut (`baId` non-kosong), `Belum` bila tidak.

- `jadwalExtraRows` — satu baris per BA Pelaksanaan dengan `Jadwal ID` kosong:

  ```js
  {
    jenis: 'Extra',
    baId, bagian, blok, kegiatan, label,
    baTanggal, baJam, baDosen, baPesertaCount,
    status: 'Extra'
  }
  ```

  Sumber BA: `kegiatan[].baPelaksanaan[]` (sudah punya `Jadwal ID`, `Bagian`, `Blok`, `Nama Kegiatan`/`Label`, `Tanggal Pelaksanaan`, `Jam`, `Dosen`, `peserta`).

- `jadwalRealisasiAll` = `jadwalRealisasiRows.concat(jadwalExtraRows)`.
- `jadwalRealisasiFiltered` — menerapkan `jadwalFilter`:
  - `bagian` (normalisasi via `normBagian`), `blok` (trim), `status`, `q`.
  - `from`/`to` menyaring tanggal efektif jadwal (jadwal → `jadwalTanggal`; Extra → `baTanggal`).
  - `q` mencocokkan `jadwalId`, `baId`, `kegiatan`, `bagian`, `blok`, `label`, `jadwalDosen`, `baDosen`.
- Opsi filter: `jadwalBagianOptions`, `jadwalBlokOptions` (Blok bergantung Bagian), `jadwalStatusOptions` = `['Sesuai','Belum','Extra']`.
- Ringkasan: `jadwalTotalCount`, `jadwalSesuaiCount`, `jadwalBelumCount`, `jadwalExtraCount` (berdasar `jadwalRealisasiFiltered`).

UI tab:

- Band ringkasan `in-basum`: Sesi Jadwal, Sesuai, Belum, BA Extra.
- Kartu filter (Bagian, Blok, Dari Tanggal, Sampai Tanggal, Status, Cari).
- Tabel `in-tbl` + kartu mobile `in-cards`/`in-mcard`:
  - Kolom: Kegiatan, Bagian, Blok, Jadwal (tanggal/jam), Dosen Jadwal, Peserta Jadwal, Realisasi (BA ID/tanggal/jam), Dosen Realisasi, Peserta BA, Status.
  - Badge Status: `Sesuai` (emerald), `Belum` (amber), `Extra` (violet).

### Export XLSX (konsisten dengan tab lain)

- Method `exportJadwalRealisasi()` dengan `writeXlsxStyled` + `_loadXlsx`.
- Sheet **"Jadwal vs Realisasi"** dari `jadwalRealisasiFiltered` dengan kolom:
  `Bagian, Blok, Nama Kegiatan, Label, Jenis, Jadwal ID, Tanggal Jadwal, Jam Jadwal, Dosen Jadwal, Peserta Jadwal, BA ID, Tanggal Realisasi, Jam Realisasi, Dosen Realisasi, Peserta Realisasi, Status`.
- Nama file: `Jadwal-Realisasi-<YYYY-MM-DD>.xlsx`.
- Tombol **Export XLSX** di `lap-card-head` tab, disabled saat `exporting`.

---

## G — Penanda berkas & Base File URL (BA Pendukung)

### Fakta data
`baPendukung` berasal dari `berita_acara_admin` dan sudah membawa `Base File URL` / `Base File Name` (`src/read/columns.js:41`). Tidak ada perubahan backend.

### Frontend
- Perluas `baDaftarItem()` dengan:
  - `baseFileUrl: (b && b['Base File URL']) || ''`
  - `berkasAda: !!String((b && b['File URL']) || '').trim()`
- **Tab Daftar BA** kolom "Berkas":
  - Badge **Ada** (emerald) bila `r.berkasAda`, **Hilang** (amber) bila tidak.
  - Bila `r.fileUrl` ada → link **Lihat**.
  - Bila `r.jenis === 'Pendukung'` dan `r.baseFileUrl` ada → link tambahan **Base**.
  - Padanan pada kartu mobile: badge + tautan yang sama.
- **Tab Berita Acara**, item BA Pendukung di panel expand: tambah badge **"Berkas: Ada/Hilang"** dan, bila ada, link **Base File**.
- Export sheet **"Daftar BA"**: tambah kolom `Base File URL` setelah `File URL`; gunakan `setUrlHyperlinks` juga untuk kolom `Base File URL`.

---

## Error Handling

- Bila tabel jadwal kosong atau tanpa penautan, tab tetap tampil dengan tabel kosong dan pesan "Tidak ada data".
- Tanggal efektif kosong tidak memfilter keluar data saat rentang tanggal tidak diisi.
- Export menangkap error via `try/catch` dan menampilkan toast, seperti export lain.

## Testing

- Tambah `test/detail-laporan-jadwal-realisasi-template.test.js` (guard template baru, mengikuti pola `extractAppTemplate`/`installDocumentStub`/`loadHtml` pada `test/detail-laporan-template.test.js`):
  - Tab terdaftar: `key: 'jadwal', label: 'Jadwal vs Realisasi'`, `activeTab === 'jadwal'`.
  - State `jadwalFilter` ada; computed/method kunci ada.
  - Kolom & filter wajib ada; tombol Export XLSX ada; sheet `'Jadwal vs Realisasi'` ada.
  - Badge status `Sesuai`/`Belum`/`Extra` ada.
- Tambah test untuk E: adanya marker `Sesi Pelaksanaan` dan badge `N sesi`.
- Tambah test untuk G: `Base File URL`/`Base File` di UI + kolom export.
- Perbarui `test/detail-laporan-template.test.js` bila perlu (cek regresi tidak memuat istilah lama).
- Jalankan `npm test` penuh; target semua hijau.

## Data Shape Ringkas

```js
// unit baru dari backend (F)
u.jadwal = [{ jadwalId, tanggal, jam, dosen, catatan, peserta: [...], baId }];

// bootstrap top-level (F)
jadwal = [{ jadwalId, kegiatanKey, bagian, blok, label, namaKegiatan,
            tanggal, jam, dosen, catatan, peserta: [...], baId }];

// baris Daftar BA (G) diperluas
{ ...baDaftarItem, baseFileUrl, berkasAda };
```

## Item yang Tetap Ditunda

- Menggunakan `needs_regen` sebagai bagian penanda berkas (keputusan: tidak).
- Sinkronisasi dua arah jadwal↔BA (mis. auto-update jadwal saat BA dibuat). Di luar lingkup.
