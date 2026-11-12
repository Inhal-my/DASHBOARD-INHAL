# Laporan Bagian: Matriks Frekuensi BA PEL — Implementation Plan

**Status: SELESAI DIIMPLEMENTASI (2026-11-11), belum di-commit / belum deploy.**
Tanggal: 2026-11-11
Target produksi: `new-code1-cf` (Worker `inhal-form`)
Desain: `docs/superpowers/specs/2026-11-11-laporan-bagian-matriks-ba-design.md`

**Goal:** Mengubah tab "Laporan Bagian" menjadi alat hitung frekuensi dokumen: matriks **Blok × Bagian** berisi jumlah BA PEL, KPI ringkas, dan tabel Detail Kegiatan yang menjelaskan setiap angka — tanpa nominal rupiah.

**Architecture:** Satu file UI (`public/detail-laporan.html`) berisi markup tab, computed turunan, dan CSS berprefix `bgd-`. Tidak ada perubahan query/endpoint maupun skema. Sumber data tetap `beritaAcara` (BA PEL) dan `kegiatan[].baPendukung` (BA PEN); index baru `bagianBaIndex` menjembatani keduanya.

**Tech Stack:** Vue 3 CDN, Tailwind (utility + CSS blok), Vitest, CSP hash per inline script.

---

## 1. Keputusan yang dikunci

| # | Keputusan |
|---|-----------|
| K1 | Fokus tab = matriks frekuensi; tabel detail hanya penjelas. |
| K2 | Satuan hitung = satu BA PEL = satu hitungan; 2 BA PEL = `2×`. |
| K3 | Kegiatan tanpa BA PEL tidak dihitung (`0×`) tetapi tetap didaftar. |
| K4 | Kegiatan tanpa peserta ACC tetap tampil + badge `Tanpa ACC`. |
| K5 | Istilah resmi BA PEL / BA PEN; BA PEN menempel di kolom BA PEL. |
| K6 | Sel 4 keadaan: ≥2 (hijau), 1 (kuning), 0 ada kegiatan (merah muda, klik-able), 0 tanpa kegiatan (putih, disabled). |
| K7 | KPI: Kegiatan, BA PEL, BA PEN, Total hitungan. Tanpa biaya. |
| K8 | Filter Bagian menyempitkan kolom matriks; KPI/detail/footnote ikut. |
| K9 | Kelompok detail default Blok › Bagian, bisa dibalik. |
| K10 | Klik sel hanya menyaring tabel detail; klik ulang / Reset mengembalikan. |

## 2. Non-tujuan

- Tidak mengubah query, endpoint RPC, atau skema D1.
- Tidak mengubah aturan kelengkapan BA maupun alur pembayaran/ACC.
- Tidak menampilkan nominal biaya di tab ini.
- Tidak menyentuh tab lain (`ringkas`, `dosen`, `berita-acara`, `jadwal`, `pembayaran`).

## 3. File Structure

- `new-code1-cf/public/detail-laporan.html` — **Modify**: markup TAB 3, computed `bagian*`, method matriks, CSS `bgd-*`.
- `new-code1-cf/test/detail-laporan-pagination.test.js` — **Modify**: anchor blok tabel dipindah ke `<pager-bar id="pg-bagian"` karena grand total kini berada sebelum pager.
- `new-code1-cf/public/_headers`, `new-code1-cf/src/security/csp.js` — **Regenerate** via `npm run csp:generate` (hash inline script berubah).
- `mockups/laporan-bagian-audit/` — **Add**: mockup revisi 8 (referensi visual disetujui).
- `docs/superpowers/specs/2026-11-11-laporan-bagian-matriks-ba-design.md` — **Add**: spec desain.
- `docs/superpowers/plans/2026-11-11-laporan-bagian-matriks-ba.md` — **Add**: dokumen ini.

## 4. Langkah Implementasi

1. **Index BA** — `bagianBaIndex` memetakan `loose(bagian)::loose(blok)::loose(nama)` ke `{ baPel, baPen }`; `loose` = `normBagian` tanpa non-alfanumerik sehingga `Pilihan - Detail` cocok `Pilihan Detail`.
2. **Enrich baris** — `bagianKegiatanAll` menggabungkan data unit `this.kegiatan` (status peserta, `diBa`) dan baris jadwal-only `this.jadwal`, lalu menambah `baPelCount/baPenCount/hitungan`.
3. **Matriks** — `bagianMatrixCols` (dipersempit filter), `bagianMatrixRows` (counts = hitungan, keg = jumlah kegiatan), `matrixColTotal`, `matrixGrandTotal`; chip `activeMatrixCell` + `filterByMatrixCell`/`resetMatrixCell`.
4. **KPI & scope** — `bagianStats`, `bagianScopeRows` mengikuti `bagianFilter.bagian` untuk BATAS data, bukan filter global.
5. **Detail** — `bagianDetailBlocks` mendukung `group` (`blok`/`bagian`) dengan sort outer/inner; `bagianPagedSections` menambah entri `{type:'header'}`; subtotal per grup, Grand Total = hitungan (+ peserta unik).
6. **State & watcher** — `bagianFilter: { bagian:'', group:'blok' }`; watcher `bagianFilter.bagian` dan `bagianFilter.group` mereset halaman `bagian`/`bagianMatrix`.
7. **Markup & CSS** — filterbar, 4 kartu KPI, `in-heat` matriks + legend 4 keadaan + pager `pg-bagianMatrix`, tabel `in-tbl bgd-dtab` 8 kolom + panel expand `.bgd-panel`, pager `pg-bagian`, dua kartu penjelas, footnote.
8. **CSP** — jalankan `npm run csp:generate` setiap kali inline script berubah; verifikasi dengan `npm run csp:check`.

## 5. Verifikasi

- `npm run csp:check` → `CSP sinkron`.
- `npx vitest run` di `new-code1-cf/` → 112 file / 946 test lulus.
- Uji browser Playwright dengan bootstrap tiruan (`?mode=analitis`): KPI, matriks, legend, klik sel merah menyaring 1 baris, Reset mengembalikan 10 baris, expand panel menampilkan tabel peserta + dokumen BA dan `Kegiatan ini dihitung N×`.
- Rekonsiliasi angka: jumlah `hitungan` detail = `matrixGrandTotal` = KPI Total hitungan.

## 6. Catatan Rilis

- Murni perubahan front-end; tidak perlu migrasi D1.
- Deploy `new-code1-cf` seperti biasa (aset `public/` ikut). Pastikan `_headers` hasil generate ikut terunggah agar CSP tidak memblokir inline script.
