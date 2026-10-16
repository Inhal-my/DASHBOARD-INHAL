# Desain: Tab "Daftar BA" dan Peningkatan Kelengkapan Berita Acara di Laporan Detail

Tanggal: 2026-10-16
Target: `new-code1-cf/public/detail-laporan.html`
Prinsip: frontend-only, tanpa perubahan backend/migrasi; fitur produksi tetap; data yang sudah dikirim server dipakai maksimal

## 1. Tujuan

Membuat **management Berita Acara** di halaman Laporan Detail lebih **informatif dan lengkap**:

- **A.** Menambah **tab baru "Daftar BA"** berisi daftar datar (flat list) semua BA (Pendukung + Pelaksanaan)
  lintas kegiatan, dengan kolom lengkap.
- **B.** Menambah indikator **kelengkapan per BA** (Lengkap/Draft) dan **keanggotaan peserta** ("Masuk BA X/Y").
- **C.** Memperluas **Export XLSX** menjadi dua sheet: "Daftar BA" dan "Rekap per Unit".
- **D.** Menambah **filter** pada tab Daftar BA: Bagian, Blok, Jenis BA, Rentang tanggal, Dosen, Sumber,
  Kelengkapan, dan pencarian bebas.

## 2. Non-tujuan

- Tidak mengubah backend (`src/**`), skema, atau migrasi. Semua perhitungan dilakukan di klien.
- Tidak mengubah isi/alur tab Berita Acara yang lama (rekap per-unit kegiatan) selain penambahan B.
- Tidak menghapus kemampuan produksi (Kelola BA, Hapus BA, Riwayat, export lama).
- Tidak mengerjakan E (ringkasan semua sesi), F (panel Jadwal vs Realisasi), G (penanda berkas +
  `Base File URL`) pada iterasi ini; dicatat sebagai lanjutan.
- Tidak refactor di luar cakupan, kecuali pembersihan dead code yang disebut di bagian 7.

## 3. Keputusan (terkunci saat brainstorming)

1. **Struktur**: tab **baru** "Daftar BA" (bukan sub-view/ganti isi), diletakkan setelah tab "Berita Acara".
2. **Kolom Daftar BA** (lengkap): `BA ID`, `Jenis`, `Bagian`, `Blok`, `Kegiatan`, `Label`, `Tanggal`,
   `Jam`, `Dosen`, `Peserta`, `Sumber`, `Dibuat`, `Kelengkapan`, `Berkas`, `Aksi`.
3. **Filter** (lengkap): Bagian, Blok, Jenis BA, Rentang tanggal, Dosen, Sumber, Kelengkapan, Cari.
4. **Export**: dua sheet ("Daftar BA" kolom lengkap termasuk `Catatan`, dan "Rekap per Unit");
   export lama di tab Berita Acara tetap dipertahankan.
5. **Definisi tanggal efektif (untuk rentang tanggal)**: `Tanggal Pelaksanaan` bila ada, selain itu
   `Timestamp` dibuat. (BA Pendukung tidak punya tanggal pelaksanaan.)
6. **Definisi kelengkapan**: BA Pelaksanaan **Lengkap** bila `Dosen` + `Tanggal Pelaksanaan` + `Jam`
   terisi; BA Pendukung **Lengkap** bila `File URL` ada. Selain itu **Draft**.
7. **Dead code** `filteredBaTab` / `baGroupRows` / `baGroupSections` / `baGroupGrandTotal` /
   `baGroupBaTotal` / `baGroupPesertaTotal` dihapus karena tidak dipakai template dan digantikan
   pendekatan baru.

## 4. Sumber data

Tidak ada endpoint baru. `getLaporanBootstrap` (`src/read/laporan.js`) sudah mengirim:

- `kegiatan`: array unit. Setiap unit memuat:
  - `baPendukung`: baris `berita_acara_admin` (lengkap, termasuk `Base File URL`, `Catatan`, `Sumber`, `Timestamp`),
  - `baPelaksanaan`: baris `berita_acara` sumber Bagian (lengkap, termasuk `Label`, `Catatan`, `Sumber`, `Timestamp`, `Jadwal ID`, `peserta`),
  - `peserta[].masukBa` / `linkFinal`, `progress`, `counts` (`peserta`, `keputusan`, `final`),
  - `key`, `bagian`, `blok`, `label`.
- `beritaAcara`: daftar BA Bagian (dengan `peserta`) — tetap dipakai export/tab lama.
- `dosenOptions`, `bagian.labs`, `blok`.

Field BA yang tersedia dari `toClientRow` (`src/read/columns.js:26-42`): `BA ID`, `Bagian`, `Blok`,
`Nama Kegiatan`, `Tanggal Pelaksanaan`, `Jam`, `Dosen`, `Jumlah Peserta`, `File Name`, `File URL`,
`Catatan`, `Sumber`, `Kegiatan Key`, `Label`, `Jadwal ID`, `Timestamp`.

## 5. Rancangan UI

### 5.1 Tab baru

- Tambah ke `tabs`: `{ key: 'daftarba', label: 'Daftar BA', icon: 'bi-list-check' }` setelah `ba`.
- Section `<section v-if="activeTab === 'daftarba'">` baru.

### 5.2 Ringkasan

- Chip ringkas: jumlah BA terfilter, jumlah Lengkap, jumlah Draft, jumlah unit.

### 5.3 Filter

- State baru `baListFilter: { bagian, blok, jenis, from, to, dosen, sumber, kelengkapan, q }`.
- Kontrol: Bagian (select), Blok (select), Jenis (select: Semua/Pendukung/Pelaksanaan), Dari & Sampai
  (date), Dosen (select dari `dosenOptions`), Sumber (select: Semua/Bagian/Admin), Kelengkapan (select:
  Semua/Lengkap/Draft), Cari (teks: BA ID/kegiatan/NPM/nama).
- Tombol reset filter.

### 5.4 Tabel + kartu

- Tabel desktop (`in-tbl`, dalam `in-desktop-only`) dan kartu mobile (`in-cards`) mengikuti pola tab
  Berita Acara agar konsisten.
- Kolom: `BA ID`, `Jenis` (badge Pendukung/Pelaksanaan), `Bagian`, `Blok`, `Kegiatan`, `Label`,
  `Tanggal`, `Jam`, `Dosen`, `Peserta`, `Sumber` (badge Bagian/Admin), `Dibuat`, `Kelengkapan`
  (badge Lengkap/Draft), `Berkas` (tautan "Lihat" bila ada, selain itu "-"), `Aksi` (Kelola + Hapus).
  - `Peserta` = jumlah peserta BA; untuk BA Pendukung (yang tidak punya daftar peserta) gunakan
    field `Jumlah Peserta`.
- Empty state bila tidak ada BA sesuai filter.

### 5.5 Export

- Tombol Export XLSX pada kepala tab. Menghasilkan dua sheet:
  - `Daftar BA`: kolom tabel + `Catatan`.
  - `Rekap per Unit`: `Bagian`, `Blok`, `Kegiatan`, `Progres` (ringkas), `Peserta`, `BA Pendukung`,
    `BA Pelaksanaan`, `Biaya`. Unit disaring hanya dengan **Bagian/Blok dari `baListFilter`**; filter
    yang spesifik BA (Jenis/Dosen/Sumber/Kelengkapan/rentang/Cari) tidak berlaku untuk rekap unit.

### 5.6 Peningkatan tab Berita Acara (B)

- Tambah kolom **"Masuk BA"** pada tabel per-unit: `counts.final`/`counts.peserta` (mis. `3/5`),
  beserta variannya pada kartu mobile.
- Tambah badge **Lengkap/Draft** pada tiap item BA di baris expand (memakai definisi kelengkapan §3.6).

## 6. Computed & Method (klien)

Computed baru:

- `daftarBaRows`: ratakan `kegiatan` -> objek BA ter-enrich `{ ...ba, jenis, bagian, blok, kegiatan, peserta, lengkap, dibuat, tanggalEfektif }`.
- `filteredDaftarBa`: terapkan `baListFilter` (Bagian/Blok/Jenis/Sumber/Kelengkapan, rentang tanggal efektif, pencarian).
- `daftarBaBagianOptions`, `daftarBaBlokOptions`, `daftarBaJenisOptions`, `daftarBaSumberOptions`.
- `daftarBaLengkapCount`, `daftarBaDraftCount`, `daftarBaUnitCount`.

Helper:

- `baLengkap(b, jenis)` -> boolean (definisi §3.6), dipakai badge dan kolom.
- `baJenisLabel(b)`, `baTanggalEfektif(b)`.

Method:

- `exportDaftarBa()` -> bangun dua sheet dari `filteredDaftarBa` + `baKegiatanRows` (filter bersama), unduh `.xlsx` (pakai XLSX yang sudah dimuat halaman).
- Aksi baris memakai ulang `openKelolaBa(baId, sumber)` dan `deleteBaAdmin`/`deleteBaBagian`.

## 7. Pembersihan kode

Hapus computed yang tidak dipakai template: `filteredBaTab`, `baGroupRows`, `baGroupSections`,
`baGroupGrandTotal`, `baGroupBaTotal`, `baGroupPesertaTotal` (`public/detail-laporan.html:2419-2493`).
Tidak ada referensi lain selain antar-sendiri.

## 8. Pengujian

- `test/detail-laporan-daftar-ba-template.test.js` (guard template, pola sama dengan
  `test/bagian-jadwal-template.test.js`):
  - template ter-compile tanpa error,
  - tab `daftarba` dan label "Daftar BA" ada,
  - kolom wajib ada (teks header),
  - filter wajib ada (`baListFilter`),
  - `exportDaftarBa` dan dua nama sheet ada,
  - definisi kelengkapan & "Masuk BA" ada,
  - computed mati sudah hilang (`baGroupRows` tidak lagi ada).
- Jalankan `test/detail-laporan-template.test.js` (bila ada) + suite penuh `npm test`.

## 9. Risiko

- **Kinerja render**: daftar datar bisa panjang. Mitigasi: filter default kosong, tabel `overflow-x-auto`,
  tidak ada operasi berat per baris (definisi kelengkapan O(1)).
- **Konsistensi label**: gunakan fungsi bersama (`resolveBagianLabel`, `normSearch`, `normBagian`) agar
  filter Bagian konsisten dengan tab lain.
- **Mobile**: sediakan kartu agar tidak hanya tabel.
