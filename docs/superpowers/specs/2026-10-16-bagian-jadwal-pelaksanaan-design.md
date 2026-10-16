# Desain: Jadwal Pelaksanaan & Penataan Ulang Panel Bagian

Tanggal: 2026-10-16
Target: `new-code1-cf/public/bagian.html`, `new-code1-cf/public/portal.html`, `new-code1-cf/src/**`
Prinsip: fitur produksi tetap; migrasi aditif (tanpa DROP/DELETE tabel produksi)

## 1. Tujuan

Menata ulang panel `bagian.html` menjadi tiga tab (**Jadwal** / **Berita Acara** / **Riwayat**) dan
memperkenalkan alur baru: admin Bagian membuat **Jadwal Pelaksanaan** lebih dulu (per unit kegiatan,
dengan peserta), kemudian setelah kegiatan berjalan membuat **Berita Acara Pelaksanaan** yang merujuk
jadwal tersebut. Jadwal juga tampil di detail pengajuan portal siswa sebagai langkah timeline.

## 2. Non-tujuan

- Tidak menghapus kemampuan produksi (Daftar Peserta, unggah + scan BA, lihat file BA, hapus BA,
  filter blok, polling, cache lokal, email/notifikasi).
- Tidak mengubah status pengajuan (`Menunggu`, `ACC`, `Ditolak`, `Dibatalkan`; tanpa `Diterima`).
- Tidak menambah notifikasi email untuk jadwal.
- Tidak mengubah alur BA Pendukung (`berita_acara_admin`) maupun BA lama yang tidak punya jadwal.
- Tidak refactor di luar cakupan; kode lama dipertahankan.

## 3. Keputusan (terkunci saat brainstorming)

1. **Model jadwal**: per unit kegiatan (`kegiatanKey(bagian, blok, namaKegiatan)`), dengan peserta
   terpilih. Satu jadwal -> satu BA Pelaksanaan; satu unit kegiatan boleh punya banyak jadwal
   (menggantikan peran multi-BA/`label`).
2. **Definisi BA "selesai"**: `dosen` + `tanggal_pelaksanaan` + `jam` terisi (definisi kanonik
   `computeUnitProgress().selesai`, src/read/kegiatan.js:12). "Peserta final" = peserta BA berstatus
   `ACC` (sudah dijamin saat pembuatan BA).
3. **Lifecycle jadwal**: tanpa status eksplisit. BA hanya bisa dibuat bila jadwal untuk unit itu ada.
   Jadwal bisa diedit/dibatalkan selama BA-nya belum ada.
4. **Field jadwal**: `tanggal`, `jam`, `dosen` + daftar peserta (tanpa kolom lokasi/catatan baru —
   `catatan` tetap ada sebagai field opsional).
5. **Prefill BA**: saat membuat BA dari jadwal, `tanggal`/`jam`/`dosen`/peserta terisi otomatis dari
   jadwal dan tetap bisa diedit.
6. **Tab**: `Jadwal` / `Berita Acara` / `Riwayat`. **Daftar Peserta** dipertahankan sebagai panel
   collapsible di atas tab.
7. **Jadwal di portal**: muncul sebagai langkah timeline di **detail pengajuan**, setelah pengajuan ACC.
8. **Draft -> selesai otomatis**: BA boleh disimpan sebagai draft (dosen/jam belum diisi); otomatis
   dianggap selesai begitu lengkap, lalu pindah ke Riwayat. Tab Berita Acara menampung BA yang belum
   lengkap + unit/jadwal yang BA-nya belum dibuat.
9. **Jadwal ikut ke Riwayat**: setelah BA-nya selesai, jadwal keluar dari tab Jadwal dan tercatat di
   Riwayat bersama BA-nya.
10. **Kandidat peserta jadwal**: pengajuan berstatus `ACC` pada unit kegiatan itu.

## 4. Model data

### 4.1 Tabel baru `jadwal_pelaksanaan`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `timestamp` | TEXT | ISO |
| `jadwal_id` | TEXT UNIQUE | mis. `JDW-2026-0001` |
| `bagian` | TEXT | Bagian / sub-bagian |
| `blok` | TEXT | |
| `nama_kegiatan` | TEXT | `pilihan - detail` |
| `kegiatan_key` | TEXT | `kegiatanKey(bagian, blok, nama)` |
| `tanggal` | TEXT | tanggal pelaksanaan (rencana) |
| `jam` | TEXT | |
| `dosen` | TEXT | |
| `catatan` | TEXT | opsional |
| `active` | INTEGER DEFAULT 1 | 1=aktif, 0=dibatalkan (soft cancel) |
| `created_by` | TEXT | email/nama sesi |
| `updated_at` | TEXT | ISO |

Index: `idx_jadwal_kegiatan_key ON jadwal_pelaksanaan(kegiatan_key)`.

### 4.2 Tabel baru `jadwal_peserta`

| Kolom | Tipe |
|---|---|
| `id` | INTEGER PK AUTOINCREMENT |
| `timestamp` | TEXT |
| `jadwal_id` | TEXT |
| `id_pengajuan` | TEXT |
| `npm` | TEXT |
| `nama_lengkap` | TEXT |
| `blok` | TEXT |
| `status_pengajuan` | TEXT |

Index: `idx_jadwal_peserta_jadwal_id ON jadwal_peserta(jadwal_id)`,
`idx_jadwal_peserta_pengajuan ON jadwal_peserta(id_pengajuan)`.

### 4.3 Kolom baru `berita_acara.jadwal_id TEXT DEFAULT ''`

Nullable/empty untuk BA lama (tanpa jadwal). Relasi: jadwal -> 0..1 BA (dicari lewat `jadwal_id`).

### 4.4 Id sequence

Format `JDW-<tahun>-<n>` (4 digit), memakai `nextIdNumber(db, 'jadwal:JDW-<tahun>-', max)` seperti
pola `nextBaId` (src/write/beritaAcara.js:23).

## 5. Backend

### 5.1 `src/read/jadwal.js` (baru)

`computeJadwalList(db, bagianFilter, kategori)` -> array objek:
`{ JadwalID, Bagian, Blok, NamaKegiatan, kegiatan_key, Tanggal, Jam, Dosen, Catatan, Active, punyaBa,
baId, peserta:[{ idPengajuan, npm, namaLengkap, blok, statusPengajuan }] }`.
Filter akses Bagian memakai `baginaHasAccess`/`resolveBagian12` (sama seperti `computeBaList`).
`punyaBa`/`baId` diisi dari `berita_acara.jadwal_id`.

### 5.2 `src/write/jadwal.js` (baru)

- `saveJadwalPelaksanaan(db, payload, kategori, ctx)`: `requireBagianSession`; validasi unit + peserta
  berstatus `ACC` (reuse `getBagianBaStatuses`); buat `jadwal_id`; insert `jadwal_pelaksanaan` +
  baris `jadwal_peserta` (satu batch).
- `updateJadwalPelaksanaan(db, jadwalId, payload, ctx)`: `requireBagianSession`; tolak bila sudah ada
  BA merujuk jadwal ini (`berita_acara.jadwal_id = jadwalId`); update field + ganti peserta.
- `cancelJadwalPelaksanaan(db, jadwalId, ctx)`: tolak bila sudah ada BA; set `active = 0`.

Validasi peserta mengikuti pola `validateBaPesertaStatus` (src/write/beritaAcara.js:93).

### 5.3 Perubahan RPC (`src/rpc.js`)

Daftarkan handler baru: `saveJadwalPelaksanaan`, `updateJadwalPelaksanaan`, `cancelJadwalPelaksanaan`,
`lengkapiBeritaAcaraBagian`. `getJadwalList` tidak wajib (data jadwal ikut di bootstrap).

### 5.4 Perubahan read Bagian (`src/read/bagian.js`)

- `getBagianBootstrap`: tambah `out.jadwalList = await computeJadwalList(...)`.
- `computeBaList`: tiap baris BA tambah `selesai` (= `dosen && tanggal_pelaksanaan && jam`) dan
  `Jadwal ID` (dari `berita_acara.jadwal_id`).

### 5.5 Perubahan write BA (`src/write/beritaAcara.js`)

- `saveBeritaAcaraBagian`: terima `payload.jadwalId` opsional.
  - Bila `jadwalId` diisi: validasi jadwal ada & `active=1` & belum punya BA; tolak jika sudah.
  - Isi kolom `jadwal_id` saat insert BA.
  - Bila `jadwalId` kosong: perilaku lama (BA tanpa jadwal) tetap berjalan.
- `lengkapiBeritaAcaraBagian(db, baId, payload, ctx)` (baru): `requireBagianSession`; hanya boleh
  mengubah BA milik bagian ini yang belum lengkap; field `dosen`, `jam`, `tanggal_pelaksanaan`,
  `catatan`, `label`. Dipakai tombol **Lengkapi** draft.
  - Catatan: `updateBeritaAcaraBagian` yang lama bersifat `requireAdmin` (src/write/beritaAcara.js:323)
    dan tidak diubah; jangan memakainya untuk aksi Bagian.
- `saveBeritaAcaraBagian`: saat insert BA dengan `jadwalId`, sertakan kolom `jadwal_id`.

### 5.6 Portal (`src/portal.js`)

`getStudentPortalData`: untuk tiap item history, cari baris `jadwal_peserta` dengan
`id_pengajuan` yang sama; bila ada, lampirkan `jadwal: { Tanggal, Jam, Dosen, JadwalID }` dari
`jadwal_pelaksanaan` (hanya `active=1`). Bila tidak ada, `jadwal: null`.

## 6. UI `bagian.html`

### 6.1 Struktur

- **Info bar** (tetap) di atas.
- **Tab bar segmented**: `Jadwal` | `Berita Acara` | `Riwayat`; state baru `activeTab` (default
  `'jadwal'`). Aksesibel (role tab/tablist, `aria-selected`).
- **Daftar Peserta**: panel collapsible (memakai `listOpen`, `filterOpen`, `fBlok`, `filteredRows`
  yang sudah ada) tetap ditampilkan di atas tab agar tidak kehilangan kemampuan produksi.

### 6.2 Tab Jadwal

- Tombol **"Buat Jadwal"** membuka form jadwal (mirip picker BA yang ada):
  - Pilih unit kegiatan dari `kegiatanGroups` (kandidat ACC, `kegiatanGroups` yang sudah ada).
  - Checklist peserta (reuse `selectKegiatan`/`togglePeserta`/`toggleAllPeserta` pola `ba.selected`).
  - Input `tanggal` (date), `jam` (time), `dosen` (text), `catatan` (opsional).
  - Simpan via `saveJadwalPelaksanaan`.
- Daftar jadwal aktif: kartu berisi unit, tanggal/jam/dosen, jumlah peserta, catatan.
  - Aksi **Edit** (buka form terisi) -> `updateJadwalPelaksanaan`.
  - Aksi **Batalkan** -> `cancelJadwalPelaksanaan` (konfirmasi).
  - Aksi **Buat BA** (bila `punyaBa === false`) -> pindah ke tab Berita Acara dengan form BA
    ter-prefill dari jadwal.

### 6.3 Tab Berita Acara

Dua bagian:
1. **Siap dibuat BA**: daftar jadwal aktif yang `punyaBa === false` -> tombol **Buat BA** membuka form
   BA yang sudah ada (file PDF/scan, catatan, label) ditambah field **Dosen** dan **Jam** yang
   ter-prefill dari jadwal.
2. **Draft**: daftar BA dengan `selesai === false` (dosen/jam belum lengkap) -> tombol **Lengkapi**
   (mengisi dosen/jam lalu simpan via `lengkapiBeritaAcaraBagian`).

Form BA (mempertahankan `ba.*`, `onBaFile`, scan, `submitBa`, `doUploadBa`) menambahkan
`ba.dosen`, `ba.jam`, `ba.jadwalId`. `submitBa` mengirim `dosen`, `jam`, `jadwalId` pada payload
`uploadBeritaAcaraBagian`. Validasi lama (peserta >=1, file, tanggal) dipertahankan; dosen/jam
opsional (bila kosong -> draft).

### 6.4 Tab Riwayat

Daftar BA `selesai === true` (read-only): BA ID, unit, label, tanggal/jam/dosen, peserta, tautan file,
dan info jadwal terkait (tanggal/jam/dosen) bila ada. Aksi hapus (`deleteBeritaAcaraBagian`) tetap
tersedia bila sebelumnya ada.

## 7. UI `portal.html`

- Tambah langkah timeline **"Jadwal Pelaksanaan"** di antara langkah "Instruksi Pembayaran & Berkas"
  dan "Validasi Akhir" pada blok detail (`view === 'detail'`).
- Muncul saat `detailItem.statusCode === 'approved'`.
- Bila `detailItem.jadwal` ada: tampilkan Tanggal (`formatTanggal`), Jam, dan Dosen. Bila tidak:
  placeholder "Belum dijadwalkan".
- Dot/title step mengikuti pola `step2DotClass`/`step2TitleClass` yang ada.

## 8. Migrasi & skema

- `migrations/2026-10-16-jadwal-pelaksanaan.sql`: `CREATE TABLE IF NOT EXISTS jadwal_pelaksanaan`,
  `jadwal_peserta`, index terkait; `ALTER TABLE berita_acara ADD COLUMN jadwal_id TEXT DEFAULT ''`.
  Idempotent (dijalankan via helper `runMigration()` yang toleran `duplicate column name`). Tanpa
  `DROP`/`DELETE`. Komentar SQL tidak memakai `;`.
- `schema.sql`: tambahkan definisi kedua tabel + kolom `jadwal_id` pada `berita_acara` (instalasi baru).

## 9. Pengujian

- `test/read-jadwal.test.js`: `computeJadwalList` mengembalikan peserta & `punyaBa`.
- `test/bagian-jadwal.test.js`: guard template `bagian.html` — ada tab `Jadwal`/`Berita Acara`/
  `Riwayat`, field `Dosen`/`Jam`, tombol "Buat Jadwal", pemanggilan `saveJadwalPelaksanaan`,
  `updateJadwalPelaksanaan`, `cancelJadwalPelaksanaan`, `lengkapiBeritaAcaraBagian`; mempertahankan penanda produksi
  (Daftar Peserta, `uploadBeritaAcaraBagian`, `onBaFile`, scan).
- `test/portal-jadwal.test.js`: guard template `portal.html` — ada langkah `Jadwal Pelaksanaan` dan
  binding `detailItem.jadwal`.
- Update guard `test/bagian-template.test.js` bila struktur berubah (panel Daftar Peserta tetap ada).

Verifikasi: `npx vitest run <file>` lalu `npm test` (seluruh suite) hijau; verifikasi preview desktop +
mobile.

## 10. Risiko

- Penataan ulang menjadi tab menyentuh banyak markup -> risiko regresi; mitigasi: jaga semua binding
  lama, guard test, verifikasi preview.
- Migrasi pada D1 produksi -> aditif & idempotent; jangan menyentuh data BA lama (jadwal_id='').
- BA lama (tanpa jadwal) harus tetap tampil dan bisa dihapus seperti sebelumnya.
- Prefill membuat BA langsung lengkap -> draft harus tetap mungkin; pastikan dosen/jam benar-benar
  opsional saat simpan.
