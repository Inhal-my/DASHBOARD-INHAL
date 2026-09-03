# Plan: Tampilkan Biaya di Tab Laporan Dosen & Laporan Bagian (detail-laporan.html)

**Date:** 2026-08-24

**Status:** Proposed

## Goal

Menampilkan nilai biaya pada `detail-laporan.html`:

1. **Tab Laporan Dosen** — data biaya detail sesuai peserta/berita acara; nilai biaya ada di baris data (samping kanan tombol "Lihat File"); plus subtotal/total.
2. **Tab Laporan Bagian** — satu kolom baru "Biaya" di samping kanan kolom "Tanggal"; plus subtotal per bagian dan/atau total.

Tidak ada perubahan backend (`0_code.gs`/`1_business.gs`) — seluruh perhitungan dilakukan di frontend dari `this.rows` yang sudah berisi `pengajuan.Biaya` ter-resolve (override + fallback MasterBiaya, `1_business.gs:1618`).

## Architecture

- **Sumber biaya:** `this.rows[].pengajuan` punya `NPM`, `Blok`, `Biaya` (sudah resolved). BA & peserta punya `npm`. Biaya per peserta dicocokkan lewat **NPM + Blok** (pola sama seperti `npmInfoFor` di `detail-laporan.html:1387`).
- **Biaya per kegiatan/BA** = Σ biaya peserta yang punya pengajuan. Peserta tanpa NPM match dihitung `0`.
- File berubah: `new-code1/pages/detail-laporan.html` (satu-satunya).
- Nama cabang: `feat/biaya-di-laporan-detail` (dari `origin/feat/laporan-dosen-matriks`).

## Design Detail

### Tab Laporan Dosen

1. **Baris detail BA** (`dosenCellDetail`, `:1216-1238`): tambah field `biaya` per BA = Σ biaya peserta BA (`b.peserta[].npm` cocok ke pengajuan via `npm`+`blok`). Layout baris (`:474-485`): tambah chip `Rp X` **di samping kanan tombol "Lihat File"**.
2. **Header panel detail sel** (`:469-471`): tambah subtotal `... · Total Rp X` (Σ biaya semua BA di sel dosen×bagian itu).

### Tab Laporan Bagian

1. **Kolom "Biaya"** baru tepat di samping kanan kolom "Tanggal" (`:549`). Nilai per baris = Σ biaya peserta kegiatan (`bagianKegiatanAll` di `:1020-1104` — tambah field `biaya` per kegiatan; `bagianDetailRows` `:1239-1260` mewarisinya).
2. **Subtotal per Bagian** + **baris Grand Total** di bawah tabel.

### Export XLSX (konsisten)

- Sheet `Detail Kegiatan` (`:1593-1604`): + kolom `Biaya` (total per kegiatan).
- Sheet `Detail Peserta` (`:1606-1619`): + kolom `Biaya` per peserta.
- Sheet `Berita Acara` (`:1621-1631`): + kolom `Biaya` (total per BA).
- Export matriks dosen tetap hitungan (tidak diubah).

## Tasks

- [ ] **Step 1: Helper `biayaForNpm(npm, blok)` + map biaya per NPM**
  - Tambah computed `npmBiayaMap` (mirror `dosenNpmMap` di `:989`) — mapping `npm -> [{blok, biaya}]` dari `this.rows`.
  - Tambah method `biayaForNpm(npm, blok)` (pilih blok cocok, fallback entry pertama, default `0`).
  - Sisipkan setelah `npmInfoFor` (`:1387-1392`) atau dekat `dosenNpmMap`.

- [ ] **Step 2: Tab Laporan Dosen — biaya per BA + subtotal sel**
  - `dosenCellDetail`: tambah `biaya` pada object `out.push`.
  - Template baris detail BA (`:474-485`): chip biaya di kanan tombol "Lihat File".
  - Template header panel sel (`:469-471`): subtotal total biaya (computed `dosenCellBiayaTotal`).

- [ ] **Step 3: Tab Laporan Bagian — kolom Biaya + subtotal/total**
  - `bagianKegiatanAll`: tambah `biaya` per kegiatan (Σ peserta).
  - Template tabel bagian (`:542-596`): tambah `<th>Biaya</th>` setelah `<th>Tanggal</th>`; sel biaya per baris; baris subtotal per bagian + grand total (computed helper atau inline di template via data terstruktur).
  - Update `colspan` baris expanded (`:581`) dari 8 → 9.

- [ ] **Step 4: Export XLSX**
  - `Detail Kegiatan`, `Detail Peserta`, `Berita Acara`: tambah kolom `Biaya`.

- [ ] **Step 5: Verifikasi statis**
  - Scope hanya `new-code1/pages/detail-laporan.html` vs base.
  - Tag balance `<script>/</script>` (detail-laporan: 1/1) & `{`/`}` balance.
  - Semua identifier baru terdefinisi & dipakai.

## Verification

- `git diff --stat origin/feat/laporan-dosen-matriks..HEAD` → hanya `detail-laporan.html`.
- Cek tag balance & brace balance.
- Semua computed/method baru ada di `computed`/`methods`.

## Risks & Mitigations

- **Peserta BA tanpa pengajuan match** → biaya `0` (konsisten dengan catatan yang disepakati).
- **Biaya override per pengajuan** sudah otomatis terwakili karena memakai `pengajuan.Biaya` yang sudah resolved.
- Template verbose (baris subtotal/total) → pakai data terstruktur (`bagianDetailRows` ditambah properti subtotal) untuk menghindari logika berulang.
