# Desain: Penyelarasan Visual Laporan ke Mockup (Sub-proyek 2)

Tanggal: 2026-10-14
Acuan visual: `mockups/pengajuan-v2/laporan-detail.html`
Target: `new-code1-cf/public/detail-laporan.html`
Prinsip: **look mockup, fitur produksi tetap**

## 1. Tujuan

Membuat seluruh tab `detail-laporan.html` (Rekap Keseluruhan, Laporan Dosen, Laporan Bagian, Berita Acara, Data Pembayaran) tampil setara dengan mockup redesain: page intro, filterbar, tab strip, kartu statistik, badge persentase, chip, tabel, avatar, ikon berkas, band ringkasan, legenda heat, dan kartu mobile. Perubahan bersifat **struktur visual** — perilaku, data, binding, dan teks produksi dipertahankan.

## 2. Non-tujuan

- Tidak menghapus fitur produksi: ekspor xlsx (`exportExcel`, `exportDosenMatrix`, `exportBaTable`, `writeXlsxStyled`), hapus baris, `ExpandedDetail`, matriks Blok×Bagian interaktif (`filterByMatrixCell`), filter global + sheet mobile, `progresDots` 6 tahap + `stageTooltip`, kelola BA + Riwayat, multi-badge status pembayaran, filter kelengkapan.
- Tidak mengubah nama field, computed, method, kelas `lap-*`/`in-*`, atau teks berbahasa Indonesia yang sudah ada (mis. vocab `Portal`/`Manual`, `{{ baKegiatanBaTotal }} BA total`, label `Dosen \ Bagian`, `Blok \ Bagian`).
- Tidak mengubah model filter berlapis (filter global sticky `filter-desktop sticky top-16` + sheet mobile + filter per tab). Mockup memakai satu `filterbar`; kita hanya **menata ulang tampilan** filter yang ada agar menyerupai mockup, bukan menggabungkannya.
- Tidak menyederhanakan kolom tabel, `progresDots`, atau tabel Bagian menjadi versi mockup yang lebih sedikit.

## 3. Prinsip resolusi selisih

Mockup jauh lebih sederhana daripada produksi. Aturan:
1. **Urutan & gaya seksi** mengikuti mockup.
2. **Kemampuan produksi dipertahankan**; bila mockup tidak punya padanannya (kolom Aksi/hapus, ekspor, matriks, `progresDots` 6 tahap, orphan BA), fitur di-restyle agar seragam — bukan dihapus.
3. Elemen mockup yang **murni visual** dan datanya sudah tersedia → ditambahkan (avatar, docdot, band statistik, legenda heat, kartu mobile, page-intro).
4. Elemen mockup yang butuh **data/perilaku baru** → hanya ditambahkan bila dihitung dari data yang sudah ada dan tidak mengubah method/field produksi (badge pct Rekap, bar chart Dosen). Interaksi baru dihindari: chip filter memakai `filters.status` + `applyFilter()` yang sudah ada.

## 4. Lapisan visual (`in-*`)

Definisi CSS baru ditambahkan ke blok `<style>` khusus `detail-laporan.html` (setelah token/`lap-*`/`in-*` yang ada, ~line 126-211). Nilai **disalin verbatim** dari primitif `in-*` yang sudah dipakai di `dashboard.html` (sumber: blok `<style>` `dashboard.html`), tanpa CSS bersama, tanpa build.

Sudah tersedia di `detail-laporan.html`: `in-chip`, `in-badge.(wait|recv|acc|rej|cancel)`, `in-tbl`(+`thead th.text-*`), `in-toolbar`, `in-input`, `in-progdots`, `in-bar-track`, `in-bar-fill.(g|y|r)`, `in-heat`(+`.c.(g|y|r)`,`.lab`), `in-tabsw`/`in-tab`(+`.is-active`), `in-statrow`(+`.ic`,`.num`,`.lbl`,`.pct`), `lap-*`.

Primitif baru yang di-port dari `dashboard.html`:

| Primitif | Sumber | Nilai |
|---|---|---|
| `.in-pageintro` (+`h2`,`p`) | dashboard `:338-340` | `margin-bottom:18px;display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap` |
| `.in-avatar` | dashboard `:341` | `width:34px;height:34px;border-radius:9999px;display:grid;place-items:center;flex:0 0 auto;color:#fff;font-weight:800;font-size:12px` |
| `.in-celluser` | dashboard `:342` | `display:flex;align-items:center;gap:11px` |
| `.in-docdot` (+`.on`,`.on.surat`,`.on.acc`,`.on.bukti`) | dashboard `:343-347` | `26px` kotak 8px radius; `.on.surat` `#0284c7`, `.on.acc` `#059669`, `.on.bukti` `#ea580c` |
| `.in-cards` / `.in-mcard` (+`.row1`,`.kv`,`.actions`) | dashboard `:348-355` | `in-cards` default `display:none`, tampil ≤1023px; `in-mcard` kartu putih radius 14px |
| `.in-desktop-only` | dashboard `:350` | `@media (max-width:1023px){ display:none }` |
| `.in-proc` (+`.p`,`.n`,`.p2`,`.t`,`.s`,`.arrow`) | dashboard `:356-362` | banner proses |
| `.in-basum` (+`.b`,`.k`,`.n`,`.p`,`.n.rose`,`.n.emerald`) | dashboard `:363-371` | grid 5 kolom, kartu ringkasan |
| `.in-heat-legend` (+`.dot`) | dashboard `:372-373` | legenda heat |
| `.in-manual-note` | dashboard `:374` | catatan ungu |
| `.panel-head` (+`h3`,`.sub`) | dashboard `:375-377` | kepala panel |
| `.in-statrow .ic.<tint>` (indigo/amber/emerald/sky/rose/violet/teal/slate) | dashboard `:329-336` | latar ikon per-tint (varian warna belum ada di `detail-laporan.html`; token `--*-soft` sudah ada) |

Sudah ada di `detail-laporan.html` dan dipakai ulang (tidak perlu di-port): `.in-statrow .pct` (`:202`, untuk badge persentase Rekap), `.in-statrow .ic` dasar (`:199`).

Catatan implementasi: produksi memakai Tailwind precompiled; bila markup baru memakai utilitas yang belum ter-compile (mis. `lg:grid-cols-5`, `ring-2`, `ring-brand-*`, `gap-[...]`, `min-w-[...]`, `mb-[...]`), definisikan manual di blok `<style>` (pola `dashboard.html:378-411`) atau pakai kelas `in-*`/`lap-*`. Jangan menghapus kelas yang di-assert tes.

## 5. Perubahan per tab

### 5.1 Rekap Keseluruhan (`detail-laporan.html` ~500-678)

- Tambah **page-intro** (`in-pageintro`): judul + sub di atas seksi. Tombol aksi produksi (Laporan, ekspor, dll.) tetap.
- **Kartu statistik**: 6 kartu `in-statrow lap-stat` tetap; tambah **badge persentase** memakai `.in-statrow .pct` yang sudah ada (nilai share dari total, dihitung dari data `summaryCards` — tanpa field/method baru). Tata letak kartu mengikuti mockup (baris atas: ikon + pct).
- **Toolbar**: tambah baris **chip status + jumlah** (mengikuti mockup 793-797) yang **memakai ulang** `filters.status` + `applyFilter()` (tanpa method/state baru). Select `Jenis Kegiatan` dan input `Cari Mahasiswa` tetap (`<label class="label">...` dipertahankan untuk tes).
- **Tabel**: kolom tetap 13 (termasuk **Aksi/hapus** dan chevron expand). Sel **Mahasiswa** → `in-celluser` + `in-avatar` (inisial + warna hash nama) + nama + NPM + tag Manual. Sel **Bukti** → `in-docdot` (menggantikan ikon centang; pertahankan judul). Vocab Sumber tetap `Portal`/`Manual`.
- **Kartu mobile**: tambah `in-cards`/`in-mcard` (tampil ≤1023px, tabel desktop diberi `in-desktop-only`) dari data baris yang sama, dengan aksi Detail/expand, berkas, dan Hapus (mengikuti pelajaran dashboard: fitur mobile tidak hilang).
- Pertahankan donut `Distribusi Status`, bar chart jenis/blok, `animateCharts()`, `ExpandedDetail`.

### 5.2 Laporan Dosen (`~681-820`)

- Tambah **kartu bar chart "Jumlah BA per Dosen"** (mockup 833-837) memakai `in-bar-track`/`in-bar-fill`; nilai dihitung dari data matriks dosen yang ada (computed turunan baru, tanpa mengubah method produksi).
- Tambah **legenda heat** `in-heat-legend` di bawah matriks (mockup 842).
- Restyle matriks + cell detail ke token mockup; **pertahankan**: filter 6 field (`dosenFilter`), matriks dinamis (`dosenMatrix`/`dosenCellDetail`), avatar baris, `activeDosenCell` + `scrollIntoView`, ekspor `exportDosenMatrix`, `<div v-if="activeDosenCell" class="flex items-end md:col-span-6">`.

### 5.3 Laporan Bagian (`~823-1002`)

- Restyle kedua kartu tabel (kegiatan-level + matriks) dan header ke token mockup; `lap-card`/`in-tbl`/`in-heat` tetap.
- **Pertahankan**: `bagianDetailSections` (subtotal per bagian + grand total), matriks Blok×Bagian, `filterByMatrixCell`/`resetMatrixCell`, `activeMatrixCell` ring, label `Blok \ Bagian` + blurbs (`Baris = Blok, kolom = Bagian`), `<div v-if="activeMatrixCell" class="flex items-end md:col-span-2">`.

### 5.4 Berita Acara (`~1005-1178`)

- Tambah **band `.in-basum` 5 kartu** (Kegiatan, Peserta, BA Pendukung, BA Pelaksanaan, Total BA) di atas chip, nilainya dari data `baKegiatan*`/summary yang ada. Chip `{{ baKegiatanBaTotal }} BA total` / `{{ baKegiatanRows.length }} kegiatan` **tetap**.
- Restyle tabel (12 kolom tetap) + expand; **pertahankan** `progresDots` 6 tahap + `stageTooltip`, kelola BA (`openKelolaBa`, `deleteBaAdmin`, `deleteBaBagian`), Riwayat (`openRiwayat`), ekspor `exportBaTable`, tag "Belum ada BA".
- Tambah **kartu mobile** `in-cards`/`in-mcard`.

### 5.5 Data Pembayaran (`~1181-1298`)

- Tambah **band 3 kartu** (Total Tagihan, Sudah Bayar, Belum Bayar) di atas chip, nilai dari `pembayaranSummary()` yang ada.
- Restyle chip/filter/tabel; **pertahankan** filter `bayarFilter` (q/status/kelengkapan), multi-badge `m.statuses`, expand Rincian (`linkBukti`/`linkAcc`), ekspor 2 sheet (`'Pembayaran Mahasiswa'`/`'Pembayaran Detail'`, `'Link ACC INHAL': it.linkAcc`).
- Tambah **kartu mobile** `in-cards`/`in-mcard`.

## 6. Perilaku & marker yang dipertahankan

Semua identifier yang di-assert `test/detail-laporan-template.test.js`, termasuk: `baKegiatanRows`, `baKegiatanBiaya`, `progresDots`, `stageTooltip`, `openKelolaBa`, `deleteBaAdmin`, `dosenSuggestionsList`, `npmPembayaranMap`, `pembayaranRows/Filtered/Summary`, `bayarBuktiUrl`, `m.statuses`, `baExportRows`, `baReportRows`, `BA_EXPORT_HEADERS`, `writeXlsxStyled`, `xlsxPatchSheet`, `xlsxBuildZip`, `safeUrl`, `filter-desktop sticky top-16`, `filter-mobile-bar`, `sheet-overlay/panel/handle`, `activeFilterCount`, `resetGlobalFilters()`, `activeFilterCount`, `scroll-margin-top`, `in-tab is-active`, `class="in-tbl"`, `class="in-statrow`, label `Dosen \ Bagian`/`Blok \ Bagian`, `>Aksi</th>`, `btn-acc`, `btn-bukti`, `lap-card/stat/chip/th`, shell (`app-shell`, `sidebar-aside`, `main-wrap`, `content-wrap`, `bottom-nav`, `bnav-btn`), `'Pembayaran Mahasiswa'`/`'Pembayaran Detail'`/`'Link ACC INHAL'`, vocab `Portal`/`Manual`, `Sumber: p.Sumber || 'Portal'`.

Kelas `lap-*` tetap dipakai pada markup (bukan diganti dengan kelas mockup).

## 7. Pengujian

- Guard test baru di `test/detail-laporan-template.test.js`: definisi CSS primitif baru (`in-pageintro`, `in-avatar`, `in-celluser`, `in-docdot`, `in-cards`, `in-mcard`, `in-basum`, `in-heat-legend`, `in-proc`, `panel-head`, `.in-statrow .ic.<tint>`) + marker markup **spesifik** (mis. `in-celluser` di sel Rekap, `in-basum` di tab BA, band 3 kartu di Bayar, `.pct` di Rekap, kartu bar Dosen) yang gagal bila markup tidak ada (bukan sekadar token CSS).
- `npx vitest run test/detail-laporan-template.test.js` hijau.
- Full suite `npx vitest run` hijau (49 file).
- Bila markup memakai utilitas Tailwind arbitrary, tambah guard yang memastikan definisinya ada (pelajaran sub-proyek 1).
- Verifikasi visual preview desktop + mobile terhadap mockup.

## 8. Risiko

- Perubahan struktur tabel Rekap + penambahan kartu mobile menyentuh banyak binding → mitigasi: reviewer + guard test markup-spesifik + verifikasi preview.
- Penghapusan kolom/fitur tidak boleh terjadi; elemen mockup yang lebih sedikit tidak boleh menggantikan fitur produksi (pertahankan Aksi/hapus/ekspor/matriks/`progresDots` 6 tahap).
- Utilitas Tailwind arbitrary yang dipakai markup baru berisiko tak ter-compile → definisikan manual + guard tes (pelajaran `dashboard.html`).
- Fidelitas pixel tak realistis (Tailwind vs mockup bespoke); target = kesan visual setara.
