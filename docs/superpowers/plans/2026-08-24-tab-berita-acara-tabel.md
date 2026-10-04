# Plan: Tab Berita Acara Menjadi Tabel Rekap (detail-laporan.html)

**Date:** 2026-08-24

**Status:** Proposed

## Goal

Mengubah tab **Berita Acara** di `new-code1/pages/detail-laporan.html` dari tampilan kartu berkelompok menjadi **tabel rekap** (gaya tab Laporan Bagian):

1. Satu baris per grup `Bagian + Blok + Nama Kegiatan`; BA dengan blok/detail/jenis kegiatan sama digabung.
2. Kolom: Bagian, Blok, Kegiatan, Tanggal, Jumlah BA, Peserta, **Biaya**.
3. Link file BA **dan** link bukti bayar peserta hanya di **baris ekspansi**.
4. Filter: **Bagian + Blok + Cari** saja.
5. Export XLSX (Rekap BA + Detail BA).

Tidak ada perubahan backend (`0_code.gs`/`1_business.gs`) — seluruh perhitungan di frontend dari `this.beritaAcara` + `this.rows`.

## Architecture

- **Sumber data:** `this.beritaAcara[]` (tiap item punya `Bagian`, `Blok`, `Nama Kegiatan`, `Tanggal Pelaksanaan`, `Jumlah Peserta`, `File URL`, `peserta[]`). `this.rows[].pengajuan` untuk resolve biaya (`biayaForNpm`) dan link bukti bayar (`Link Bukti Bayar`) via NPM.
- **Biaya per grup** = Σ `biayaForNpm(npm, blok)` untuk peserta unik.
- **File berubah:** `new-code1/pages/detail-laporan.html` (satu-satunya).
- **Nama cabang:** `feat/tab-berita-acara-tabel` (dari `origin/feat/laporan-dosen-matriks`).

## Design Detail

### State & filter

- Tambah state `baFilter: { bagian: '', blok: '', q: '' }` (meniru `bagianFilter` `:904`).
- Computed `baBlokOptions` — daftar blok dari `this.beritaAcara` (opsional: batasi sesuai `baFilter.bagian`).
- Computed `filteredBaTab` — filter `beritaAcara` oleh `baFilter` (bagian via `resolveBagianLabel`, q mencocokkan `Nama Kegiatan`, `BA ID`, NPM/nama peserta). **Tab lain tidak terpengaruh.**

### Computed rekap

- Computed `baGroupMap` / `baGroupRows` — group BA per `normBagian(bagianLabel) + '::' + blok + '::' + normName(namaKegiatan)`.
  - Tiap grup: `{ key, bagian, blok, nama, tanggal, jumlahBa, pesertaCount, biaya, items: [] }`.
  - Peserta unik via set NPM.
  - Sort: bagian → blok → nama kegiatan (pola `:1141`).
- Computed `baGroupSections` — sisipkan baris subtotal per Bagian (pola `bagianDetailSections` `:1304-1319`): `{ type: 'subtotal', bagian, jumlahBa, pesertaCount, biaya }`.
- Computed `baGroupGrandTotal` — Σ biaya seluruh grup.
- Computed `baGroupBaTotal` — Σ jumlah BA.
- Computed `baGroupPesertaTotal` — jumlah peserta unik seluruh grup.

### Template tab BA

Ganti seluruh isi `section activeTab === 'ba'` (`:673-725`):

1. **Filter bar** (meniru `bagian` tab `:501-526`): dropdown Bagian, dropdown Blok, input Cari. Info chip jumlah grup/BA.
2. **Tabel** (meniru `:535-619`):
   - `<thead>`: Bagian, Blok, Kegiatan, Tanggal, Jumlah BA, Peserta, Biaya.
   - `<tbody>`: loop `baGroupSections` — `subtotal` → baris `bg-slate-100/80`; `row` → baris klik-ekspansi (`toggleExpand(g.key)`).
   - **Baris ekspansi**: `v-if="expanded[g.key]"`, colspan 7, daftar `g.items`:
     - Per BA: BA ID (mono), Tanggal, jumlah peserta, tombol **"Lihat File"** (File URL).
     - Daftar **peserta unik** grup dengan **link bukti bayar** bila ada (`linkBuktiForNpm(npm)`).
   - **Grand Total** di bawah (`:611-618` analog).
3. **Tombol Export XLSX** di header tabel (pola `exportDosenMatrix` `:416-418`).

### Helper baru

- `linkBuktiForNpm(npm)` — resolve `Link Bukti Bayar` dari `this.rows` via NPM (pola `pLink` di `bagianKegiatanAll` `:1061-1070`). Return `''` bila tidak ada.
- Method `exportBaTable()` — bikin workbook:
  - Sheet `Rekap BA`: per grup `baGroupSections` (row) — Bagian, Blok, Nama Kegiatan, Tanggal, Jumlah BA, Jumlah Peserta, Biaya.
  - Sheet `Detail BA`: per file BA dalam `filteredBaTab` — BA ID, Bagian, Blok, Nama Kegiatan, Tanggal, Jumlah Peserta, Biaya, File URL.
  - Pakai `XLSX.utils.book_new/json_to_sheet/book_append_sheet/writeFile` (pola `exportExcel` `:1624-1710`).

## Tasks

- [ ] **Step 1: State + computed filter & rekap**
  - Tambah `baFilter` di `data()`.
  - Tambah computed: `baBlokOptions`, `filteredBaTab`, `baGroupRows`, `baGroupSections`, `baGroupGrandTotal`, `baGroupBaTotal`, `baGroupPesertaTotal`.
  - Sisipkan dekat computed `baGroups` (`:1329`) atau blok bagian.

- [ ] **Step 2: Template tab BA — filter bar + tabel + baris ekspansi + subtotal/grand total**
  - Ganti `section activeTab === 'ba'` (`:673-725`).
  - Header tabel dengan tombol Export XLSX.

- [ ] **Step 3: Helper `linkBuktiForNpm` + method `exportBaTable`**
  - Tambah method di blok `methods` (dekat `biayaForNpm` `:1456-1461`).
  - Export XLSX dua sheet.

- [ ] **Step 4: Verifikasi statis (tanpa perubahan kode)**
  - Scope: hanya `detail-laporan.html` berubah vs base.
  - Identifier baru ada (baFilter, filteredBaTab, baGroupRows, baGroupSections, baGroupGrandTotal, linkBuktiForNpm, exportBaTable).
  - Keseimbangan tag: div, table, tr, td, th, template, script-braces.
  - Tab lain (rekap/dosen/bagian) tetap memakai computed lama (`filteredBa`, `baGroups` dibuang hanya bila tak dipakai).

## Notes / Deviasi yang Diizinkan

- `baGroups` lama boleh dihapus bila tak dipakai di tempat lain (verifikasi `rg 'baGroups'` sebelum hapus).
- Jika jumlah kolom berubah, sesuaikan `colspan` baris ekspansi & subtotal dengan tepat.
- Tidak menambah komentar pada kode; ikuti pola penamaan yang ada.
