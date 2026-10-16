# Desain: Dashboard Mobile v2 — Bottom-sheet "Buat BA" & Kartu Kelengkapan per Blok

Tanggal: 2026-10-16
Status: disetujui (menunggu review spec)

## Tujuan

Memperbaiki dua masalah pada tab **Berita Acara** di `new-code1-cf/public/dashboard.html`:

- **Konsep 01**: Mempercepat pencarian data saat membuat BA. Alur baru: satu tombol **"Buat BA"** membuka bottom-sheet dengan pencarian cepat berjenjang **Blok -> Kegiatan -> form**, menangani **BA Pendukung dan BA Pelaksanaan** sekaligus.
- **Konsep 06**: Mengganti tabel **"Peta Kelengkapan Bagian x Blok"** yang melebar ke kanan dengan **kartu per Blok** (drill-down), dan menghapus panel **"Kelengkapan Pelaksanaan per Bagian"**.

Referensi visual: `mockups/dashboard-mobile-v2/01-sheet-search.html` dan `mockups/dashboard-mobile-v2/06-blok-cards.html`.

## Non-Goals

- Tidak mengubah backend / RPC / skema / migrasi. Tidak ada endpoint baru.
- Tidak mengubah alur & modal **"Kelola BA Pendukung"** untuk unggah berkas (tetap seperti sekarang).
- Tidak mengubah tab lain, tidak menyentuh `detail-laporan.html`, tidak menyentuh portal.
- Tidak membuat komponen Vue baru berbasis file; tetap satu app seperti pola sekarang.
- Tidak mengubah jumlah/isi kartu ringkasan atas (`ba-cards`) dan filter chip yang ada.

## Constraints

- Produksi berjalan; perubahan hanya di `new-code1-cf/public/dashboard.html` (plus test).
- Pertahankan seluruh fitur yang ada: unggah Pendukung, unggah Pelaksanaan, Kelola/Hapus BA, Riwayat, Ekspor Excel, tabel & kartu mobile daftar unit.
- Pertahankan pola orientasi mobile (bottom-sheet, tombol mengambang) dan desktop.
- Copy UI konsisten dengan istilah yang sudah ada: "Pendukung", "Pelaksanaan", "Buat BA", "Blok", "Lengkap", "Belum".
- Semua test dijalankan dari `new-code1-cf/` dengan `npx vitest run <file>`.

---

## Bagian A — Konsep 01: Bottom-sheet "Buat BA" terpadu

### Titik masuk
- **Tombol header "Buat BA"** (primary) menggantikan tombol "Unggah BA Pendukung" (markup baris 1121) -> membuka sheet. Tombol **Ekspor Excel** tetap.
- **Tombol header "Sesi Bagian"** (soft, sekunder) -> membuka panel `#bab-panel` dengan Kategori/Lab kosong (jalur manual; lihat "Panel Sesi Bagian sebagai opsi tambahan").
- **FAB** (baris 2359-2362) diganti aksinya menjadi membuka sheet yang sama (ikon dan posisi tetap).
- **Tombol per baris di daftar unit tetap seperti sekarang** (kontekstual terhadap baris, tidak butuh pencarian):
  - `openKelolaBaForUnit(r)` (Unggah/Kelola BA Pendukung) -> modal `kb` (tidak diubah).
  - `openPelaksanaanPanel(r)` (Unggah BA Pelaksanaan) -> panel `#bab-panel` (tidak diubah); dari panel, tombol "Buat Berita Acara" membuka sheet langkah form.

### State baru
```js
baSheet: {
  open: false,
  type: 'pelaksanaan',   // 'pelaksanaan' | 'pendukung'  (mengingat pilihan terakhir)
  level: 'blok',         // 'blok' | 'kegiatan'
  blok: '',              // Blok terpilih saat level==='kegiatan'
  q: '',                 // kata kunci pencarian
  loading: false
}
```

### Layout sheet (dari atas ke bawah)
1. **Handle** + header: judul "Buat Berita Acara" + tombol tutup.
2. **Tab tergeser**: `Pendukung` | `Pelaksanaan` (state `baSheet.type`).
3. **Kotak cari** (menempel di atas area gulir). Placeholder: "Cari kegiatan, mahasiswa, atau dosen...".
4. **Breadcrumb** saat `level==='kegiatan'`: tombol kembali "Blok {x}".
5. **Area gulir**:
   - **Tingkat 1 (Blok)** — tampil bila `q` kosong dan `level==='blok'`: daftar Blok dengan jumlah kegiatan (dari `baSheetBlokGroups`). Cukup pilih satu Blok untuk masuk tingkat 2.
   - **Hasil pencarian lintas Blok** — tampil bila `q` tidak kosong: daftar unit dari `baSheetSearchResults`, tiap baris diberi label Blok.
   - **Tingkat 2 (Kegiatan)** — tampil bila `q` kosong dan `level==='kegiatan'`: daftar unit dari `baSheetBlokUnits` (unit di `baSheet.blok`).
   - Tiap baris kegiatan: label kegiatan, `bagian . blok . N peserta`, badge status BA (belum ada / draft / lengkap), dan tombol aksi (`Buat`).
6. **Langkah form (khusus Pelaksanaan)** — bila `bab.ba.open`: form pelaksanaan tampil di dalam sheet (lihat "Form Pelaksanaan").
7. Footer sheet (tombol) hanya pada langkah form.

### Sumber data & computed
Sumber data: **`bagian.units`** (sudah dimuat saat tab BA dibuka). Unit sudah memiliki `{ key, bagian, blok, pilihan, detail, label, tanggal, peserta[], ba[], dosenList[], ... }`.

Computed:
- `baSheetBlokGroups`:
  ```js
  [{ blok, total, belum }]
  ```
  `total` = jumlah unit di blok; `belum` = unit yang belum lengkap (metrik pelaksanaan: `!unitHasPelaksanaan`).
  Urut alfabetis menurut `blok`.
- `baSheetBlokUnits` — `bagian.units` yang `blok === baSheet.blok`.
- `baSheetSearchResults` — `bagian.units` yang cocok `baSheet.q` (normalisasi via `normBagian`), dicari lintas semua Blok. Setiap hasil memakai label Blok-nya.
- Helper `unitMatchesQuery(u, q)` mencocokkan (case-insensitive, dinormalisasi):
  - `u.label`, `u.pilihan`, `u.detail`, `u.blok`;
  - dosen: `u.dosenList` dan `ba[].dosen`;
  - mahasiswa: `peserta[].namaLengkap`, `peserta[].npm`.

### Aksi memilih kegiatan
- `baSheetOpenKegiatan(blok)` — set `baSheet.level='kegiatan'`, `baSheet.blok=blok`, kosongkan `q`.
- `baSheetBack()` — set `baSheet.level='blok'`, `baSheet.blok=''`.
- `baSheetSetType(t)` — set `baSheet.type=t` (mengingat pilihan; tidak persist ke storage, cukup selama sesi).
- `baSheetClose()` — reset `baSheet` (open=false, level='blok', blok='', q='').
- `openBaSheet(type)` — buka sheet: set `open=true`, `level='blok'`, kosongkan `q`; bila `type` diberikan set `baSheet.type`; pastikan `loadBagian()` sudah dijalankan (bila `bagian.units` masih kosong). Dipakai tombol header "Buat BA", FAB, dan panel "Buat Berita Acara".

**Bila `type==='pendukung'`** — `baSheetPickKegiatan(u)`:
```js
const pid = (u.peserta && u.peserta[0] && u.peserta[0].idPengajuan) || '';
if (pid) { this.baSheetClose(); this.openKelolaBaPendukung(pid); }
```
(Menggantikan peran `kbPicker` untuk pemilihan kegiatan. Modal `kb` / "Kelola BA Pendukung" tetap.)

**Bila `type==='pelaksanaan'`** — `baSheetPickKegiatan(u)`:
1. Simpan `bab.ba.kegiatanUnitKey = u.key` (unit terpilih) dan pindahkan `baSheet` ke langkah form (`babOpenBaPicker()` yang disesuaikan).
2. Tentukan lingkup bagian dari `u.bagian` memakai helper baru `deriveBagianScope(bagian)` (logika sama dengan `openPelaksanaanPanel`): mengembalikan `{ kategori, subBagian }`.
3. Pastikan sesi bagian aktif: method baru `babEnsureSession(kategori, subBagian)`:
   - bila `bab.active && bab.kategori===kategori && bab.subBagian===subBagian` -> tidak melakukan apa-apa;
   - selain itu -> jalankan `adminBagianBypass` + `babLoad()` (menggunakan alur `babStart` tanpa validasi UI).
4. Pilih grup kegiatan yang cocok: cari di `babKegiatanGroups` grup dengan `blok===u.blok` dan `pilihan===u.pilihan` dan `detail===u.detail` (fallback cocokkan `tanggal` bila perlu). Set `bab.ba.kegiatanKey` dan `babSelectKegiatan(key)`.
5. Bila grup tidak ditemukan -> tampilkan toast peringatan ("Kegiatan tidak ditemukan pada sesi bagian ini") dan tetap membuka panel lama sebagai fallback.

### Form Pelaksanaan (dipindah ke sheet)
- Markup kartu **"Upload Berita Acara"** (baris 1474-1559) dipindah dari panel ke dalam sheet (langkah form).
- State & method tetap sama: `bab.ba.label`, `bab.ba.tanggal`, `bab.ba.catatan`, `bab.ba.file`, `babTogglePeserta`, `babToggleAllPeserta`, `babOnBaFile`, scan (`scanOnPhotos('pelaksanaan')`, `scanBuildPdf`), `babSubmitBa`, `babDoUploadBa`, `babDuplicate`.
- Modal konfirmasi (`bab.ba.confirm`, baris 1591-1630) tetap di luar sheet.
- **Satu instance form saja** (tidak ada duplikasi). Panel tidak lagi memuat kartu form ini.

### Panel "Sesi Bagian" sebagai opsi tambahan
- Panel `#bab-panel` tetap ada dan dapat dibuka lewat tombol header **"Sesi Bagian"** (kategori kosong) maupun `openPelaksanaanPanel(row)` dari baris unit.
- Isi panel yang dipertahankan: kartu Mulai Sesi (Kategori/Lab -> **Mulai Sesi Bagian**), banner sesi aktif, daftar **"Kegiatan Bagian"**, dan daftar **"Berita Acara Terunggah"**.
- Kartu form unggah **dihilangkan** dari panel.
- Tombol **"Buat Berita Acara"** di dalam panel (`babOpenBaPicker`) diarahkan membuka **sheet langkah form** (bukan form inline). Bila dipanggil dari panel, kegiatan dipilih lewat pemilih sheet (tingkat 1/2).

---

## Bagian B — Konsep 06: Kartu per Blok

### Perubahan struktur tab
- **Hapus** panel "Kelengkapan Pelaksanaan per Bagian" (markup 1169-1184).
- **Ganti** panel "Peta Kelengkapan Bagian x Blok" (markup 1185-1215) dengan **grid kartu per Blok** (di semua ukuran layar).
- Kontainer `ba-pair` (layout 2 kolom) diganti satu `dash-card` selebar penuh yang memuat toggle metrik + grid kartu.

### State & method
```js
bagian.heatMetric  // 'pelaksanaan' (default) | 'gabungan'
```
- `setHeatMetric(m)` — set `bagian.heatMetric`.
- `openBlokCard(blok)` — set `bagian.fBlok = blok; bagian.fBagian = ''; bagian.chip = 'semua';` lalu gulir ke daftar unit (elemen diberi `id="ba-unit-list"`).

### Computed
- `bagianBlokCards` — agregasi `bagian.units` per `blok`:
  ```js
  [{
    blok, total, done, pct, belum
  }]
  ```
  - Metrik `'pelaksanaan'`: `done = units.filter(unitHasPelaksanaan).length`.
  - Metrik `'gabungan'`: `done = units.filter(u => !unitIncomplete(u)).length`.
  - `pct = total ? Math.round(done/total*100) : 0`.
  - `belum = total - done`.
  - Urut alfabetis menurut `blok`.

### Markup kartu
- Header kartu grid: judul "Kelengkapan per Blok" + **toggle metrik** (segmented kecil): `Pelaksanaan` | `Pendukung + Pelaksanaan`.
- Tiap kartu:
  - nama Blok (tebal), jumlah kegiatan (`N kegiatan`);
  - **cincin persentase** (SVG `conic-gradient` atau `stroke-dasharray`) dengan angka `pct%`;
  - footer: `belum` badge ("N belum") bila > 0, atau badge "Lengkap" bila 100%;
  - kartu dengan `pct < 100` diberi warna peringatan (border/background kuning tipis), `pct === 100` normal/emerald.
- Kartu dapat diklik -> `openBlokCard(blok)`.
- Bila `bagian.units` kosong, tampilkan pesan "Belum ada data.".

### ID jangkar
- Beri `id="ba-unit-list"` pada pembungkus daftar unit (`dash-card` baris 1228) supaya `openBlokCard` bisa menggulir ke sana.

### Pembersihan kode mati
- Hapus computed yang tak terpakai: `bagianBar`, `bagianHeatmap`.
- Hapus method tak terpakai: `openBagianFromBar`, `openBagianFromCell`, `heatFillClass` (setelah dipastikan tidak dipakai lagi).
- Hapus CSS tak terpakai: `.ba-pair`, `.heat-scroll`, `.heat-table`, `.heat-sticky`, `.heat-cell`, `.in-bar-track`, `.in-bar-fill`, `.in-heat`, `.in-heat-legend` (dicek ulang, jangan hapus yang masih dipakai di tempat lain).
- `openBagianFromBar`/`openBagianFromCell` digantikan `openBlokCard`.

---

## Error Handling

- **Sheet**: bila `bagian.units` belum dimuat, jalankan `loadBagian()` saat sheet dibuka (seperti peringatan lama di `kbPicker`). Bila hasil tetap kosong, tampilkan pesan "Belum ada kegiatan dimuat. Coba muat ulang.".
- **Pencarian kosong**: bila query tidak menemukan hasil, tampilkan "Tidak ada kegiatan cocok.".
- **Pelaksanaan tanpa grup cocok**: toast peringatan + fallback membuka panel lama (tidak menggagalkan alur).
- **Sesi bagian otomatis gagal**: tangkap error seperti `babStart`; tampilkan toast; sheet tetap terbuka.
- **Kalau kegiatan tidak punya `idPengajuan`** (Pendukung): tombol disabled + tooltip.

## Testing

- Perbarui `test/dashboard-template.test.js`:
  - Pastikan tidak ada lagi penanda lama yang dihapus ("Kelengkapan Pelaksanaan per Bagian", "Peta Kelengkapan Bagian", `heat-table`, `openBagianFromBar`).
  - Pastikan penanda baru ada: state `baSheet`, `bagian.heatMetric`, computed `bagianBlokCards`, `baSheetBlokGroups`, `baSheetSearchResults`, method `openBlokCard`, `setHeatMetric`, `baSheetPickKegiatan`, `deriveBagianScope`, `babEnsureSession`, `id="ba-unit-list"`.
- Tambah `test/dashboard-ba-sheet.test.js` (pola guard template: `extractAppTemplate`/`installDocumentStub`/`loadHtml`):
  - Tab tergeser `Pendukung`/`Pelaksanaan` ada; `baSheet.type` default `'pelaksanaan'`.
  - Tingkat Blok & Kegiatan (`level`) ada; breadcrumb kembali ada.
  - Helper pencarian `unitMatchesQuery` mencocokkan label/blok/nama/NPM.
  - Tombol header "Buat BA" dan FAB memanggil pembuka sheet.
  - Form pelaksanaan (label, tanggal, file, catatan) berada di dalam sheet, bukan di panel.
- Perbarui test yang menyentuh `bagianBar`/`bagianHeatmap` bila ada (mis. `bagian-template.test.js`, `dashboard-ba-pendukung.test.js`).
- Jalankan `npm test` penuh; target semua hijau.

## Item yang Tetap Tidak Berubah

- Modal "Kelola BA Pendukung" (`kb`, `kbPicker` lama tidak dipakai sebagai jalur utama tetapi method `openKelolaBaPendukung` tetap).
- Alur mulai sesi manual di panel (`babStart`, Kategori/Lab).
- Backend, RPC, skema, migrasi, export Excel.
- Kartu ringkasan atas (`ba-cards`) dan filter chip (`setBagianChip`).
- Tabel unit desktop & kartu unit mobile.

## Item yang Ditunda

- Konversi modal "Kelola BA Pendukung" menjadi bottom-sheet (dipilih: pertahankan modal lama).
- Menghapus total `kbPicker` lama (dibiarkan, hanya tidak dijadikan jalur utama) — akan dibersihkan bila sudah dipastikan tak terpakai.
- Persistensi pilihan tab sheet (`baSheet.type`) ke localStorage (cukup selama sesi).
