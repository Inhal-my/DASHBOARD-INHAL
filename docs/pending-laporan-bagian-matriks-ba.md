# Pending: Tab Laporan Bagian sebagai Matriks Frekuensi BA PEL

Tanggal dicatat: 2026-11-11
Status: **SELESAI DIIMPLEMENTASI, DI-COMMIT, DI-PUSH, DAN DI-DEPLOY (2026-11-12).**
Catatan rilis & hasil deploy: `docs/release-2026-11-12-laporan-bagian-matriks-ba.md`.
Rencana lengkap: `docs/superpowers/plans/2026-11-11-laporan-bagian-matriks-ba.md`
Desain: `docs/superpowers/specs/2026-11-11-laporan-bagian-matriks-ba-design.md`
Mockup referensi: `mockups/laporan-bagian-audit/` (revisi 8, disetujui)

## Ringkasan perubahan
- Tab "Laporan Bagian" menjadi alat hitung frekuensi: matriks **Blok × Bagian** berisi jumlah BA PEL.
- Satuan hitung = **satu BA PEL = satu hitungan**; ACC bukan syarat.
- Kegiatan tanpa BA PEL tidak dihitung (`0×`) tetapi tetap didaftar.
- KPI: Kegiatan, BA PEL, BA PEN, Total hitungan. **Tanpa nominal rupiah.**
- Filter Bagian menyempitkan kolom matriks; klik sel hanya menyaring tabel detail.
- Kelompok detail default Blok › Bagian, bisa dibalik ke Bagian › Blok.

## Sudah diverifikasi
- `npm run csp:check` → CSP sinkron.
- `npx vitest run` di `new-code1-cf/` → 112 file / 957 test lulus.
- Uji browser Playwright: KPI, matriks, legenda, klik sel, Reset, expand panel peserta & dokumen BA.
- Rekonsiliasi: total `hitungan` detail = `matrixGrandTotal` = KPI Total hitungan.

## File yang di-commit pada `fe660e6`
- M `new-code1-cf/public/detail-laporan.html`
- M `new-code1-cf/public/_headers`, M `new-code1-cf/src/security/csp.js`
- M `new-code1-cf/test/detail-laporan-pagination.test.js`
- ?? `docs/superpowers/specs/2026-11-11-laporan-bagian-matriks-ba-design.md`
- ?? `docs/superpowers/plans/2026-11-11-laporan-bagian-matriks-ba.md`
- ?? `mockups/laporan-bagian-audit/`

## Perbaikan audit live preview (2026-11-12)
- Pengelompokan BA PEL per kegiatan (`normName`), bukan per nama+tanggal: kegiatan multi-sesi tidak lagi
  muncul sebagai dua baris yang membawa seluruh daftar BA PEL (menyebabkan `hitungan`/KPI dobel).
- Watcher filter global kini selalu mengosongkan `activeMatrixCell` (sebelumnya hanya `filters.blok`), karena
  sel matriks yang tersisa membuat tabel detail 0 baris padahal data ada.
- Filter Bagian pada tab ini memakai `bagianAllLabels` (termasuk `Lainnya`) dan membandingkan label secara
  `normBagian`, bukan string mentah.
- Chip "Disaring: Blok · Bagian" + "Tampilkan semua" ditambahkan di header kartu Detail Kegiatan.
- Computed `bagianDetailBiayaTotal` (tidak dipakai setelah kolom biaya dihapus) dibuang.

## Yang akan dikerjakan saat disetujui
1. Tinjau ulang diff `detail-laporan.html` bersama pemilik proyek (opsional).
2. Commit dengan trailer `Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>`.
3. Push ke `main` (`https://github.com/Inhal-my/DASHBOARD-INHAL`) / buat PR bila diminta.
4. Deploy `new-code1-cf` (`wrangler deploy`), pastikan `public/_headers` hasil generate ikut terunggah.
5. Verifikasi pasca-deploy: buka tab Laporan Bagian, cek KPI, matriks, filter, dan expand baris.
6. Tidak perlu migrasi D1 (murni perubahan front-end).

## Catatan
- Commit `fe660e6` di branch `main`; deploy worker `inhal-form` versi `be2e3824-2c15-4fa4-8d06-5769f20221e8`.
- Setiap edit inline script di `detail-laporan.html` wajib diikuti `npm run csp:generate`.
