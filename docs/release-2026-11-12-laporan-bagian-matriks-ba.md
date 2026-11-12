# Catatan Rilis: Tab Laporan Bagian sebagai Matriks Frekuensi BA PEL

Tanggal: 2026-11-12
Status: **DIIMPLEMENTASI, DI-COMMIT, DI-PUSH, DAN DI-DEPLOY** (production `inhal-form`).

| Item | Nilai |
| --- | --- |
| Commit | `fe660e6` — `feat(laporan-bagian): matriks frekuensi BA PEL + detail kegiatan` |
| Branch | `main` (`https://github.com/Inhal-my/DASHBOARD-INHAL`) |
| Deploy | `npx wrangler deploy --config wrangler.production.toml` |
| Worker | `inhal-form` — versi `be2e3824-2c15-4fa4-8d06-5769f20221e8` |
| URL | `https://inhal-form.prodi.workers.dev/detail-laporan` |
| Waktu deploy | 2026-11-12 sekitar 09:20 UTC |
Desain: `docs/superpowers/specs/2026-11-11-laporan-bagian-matriks-ba-design.md`
Rencana: `docs/superpowers/plans/2026-11-11-laporan-bagian-matriks-ba.md`
Mockup disetujui: `mockups/laporan-bagian-audit/` (revisi 8)
Preview data dummy: `mockups/laporan-bagian-live/`

---

## 1. Ringkasan perubahan

Tab **Laporan Bagian** diubah dari rekap biaya menjadi **alat hitung frekuensi BA PEL**:

- Matriks **Blok × Bagian** di atas, tabel **Detail Kegiatan** di bawah.
- Satuan hitung = **satu BA PEL = satu hitungan**; ACC bukan syarat dihitung.
- Kegiatan tanpa BA PEL tetap didaftar dengan hitungan `0×` (tidak dihitung).
- KPI: **Kegiatan, BA PEL, BA PEN, Total hitungan**. Nominal rupiah tidak ditampilkan di tab ini.
- Filter Bagian menyempitkan kolom matriks; KPI, detail, dan footnote ikut menyesuaikan.
- Klik sel matriks hanya menyaring tabel detail (tidak mengubah filter global).
- Kelompok detail default **Blok › Bagian**, bisa dibalik menjadi **Bagian › Blok**.

## 2. Aturan hitung yang dikonfirmasi pemilik proyek

- Seluruh **BA Pelaksanaan dengan jadwal berbeda tetap masuk**: 3 BA PEL pada satu kegiatan
  terhitung `3×`, walau tanggal/jam berbeda. Baris detail tetap **satu per kegiatan**.
- Diverifikasi live: 3 BA PEL (20/10, 05/11, 19/11) → sel matriks naik ke 3, KPI +2,
  panel menampilkan 3 dokumen dengan jam masing-masing, tanggal baris = sesi terakhir.
- Kolom **Bukti Bayar tidak diubah** (keputusan pemilik: "cancel perintah untuk kolom bukti bayar").

## 3. Perbaikan bug yang ditemukan lewat preview

| # | Temuan | Perbaikan |
|---|---|---|
| 1 | Kegiatan dengan 2 BA PEL tanggal berbeda muncul sebagai 2 baris yang masing-masing membawa seluruh daftar BA → `hitungan`/KPI dobel | Pengelompokan BA PEL per kegiatan (`normName(Nama Kegiatan)` di dalam bagian+blok), bukan per `nama::tanggal`; peserta digabung tanpa duplikat, tanggal = sesi terakhir, `jumlahPeserta` = max |
| 2 | Setelah klik sel matriks lalu mengubah filter global, tabel detail jadi 0 baris + "Tidak ada data kegiatan untuk filter ini" padahal data ada | Semua watcher filter global (`filters.blok/status/jenis/from/to/search`) mengosongkan `activeMatrixCell` |
| 3 | Filter Bagian tab ini tidak bisa memilih `Lainnya`; label `LAB 1` gagal cocok karena perbandingan string mentah | Select memakai `bagianAllLabels`; perbandingan sel memakai `normBagian` |
| 4 | Tabel detail terbatas ke satu sel tapi KPI global terlihat kontradiktif | Chip "Disaring: Blok · Bagian" + tombol "Tampilkan semua" di header kartu Detail Kegiatan |
| 5 | Computed `bagianDetailBiayaTotal` tidak terpakai setelah kolom biaya dihapus | Dihapus |

## 4. Perubahan file

| File | Perubahan |
|---|---|
| `new-code1-cf/public/detail-laporan.html` | Markup + computed + watcher tab Bagian (matriks, KPI, detail, export) |
| `new-code1-cf/public/_headers` | Hash CSP inline script hasil `npm run csp:generate` |
| `new-code1-cf/src/security/csp.js` | Konstanta CSP hash ikut diperbarui |
| `new-code1-cf/test/detail-laporan-pagination.test.js` | +3 tes regresi: grouping BA PEL per kegiatan, reset `activeMatrixCell` pada filter global, filter Bagian (`bagianAllLabels` + `normBagian`) |
| `docs/superpowers/specs/2026-11-11-laporan-bagian-matriks-ba-design.md` | Paragraf aturan pengelompokan + aturan watcher/filter |
| `docs/superpowers/plans/2026-11-11-laporan-bagian-matriks-ba.md` | Rencana implementasi |
| `mockups/laporan-bagian-audit/` | Mockup visual disetujui (revisi 8) |
| `mockups/laporan-bagian-live/` | Preview data dummy (generator + intercept `/api/rpc` + build script) |

## 5. Verifikasi sebelum rilis

- `npx vitest run` di `new-code1-cf/` → **112 file / 957 tes lulus**.
- `npm run test:scripts` → 85 lulus, 1 skip.
- `npm run csp:check` → CSP sinkron.
- Uji browser (Playwright) pada preview data dummy:
  - KPI, filter Bagian, klik sel, "Tampilkan semua", expand panel peserta + dokumen BA.
  - Rekonsiliasi: total `hitungan` detail = `matrixGrandTotal` = KPI Total hitungan (tanpa sel aktif).
  - Export .xlsx: Rekap Bagian 9 BA (tanpa filter) / 3 (filter SGD) dengan total dihitung ulang;
    Detail Kegiatan & Detail Peserta mengikuti filter aktif.
  - Cakupan BA 9/9 tanpa duplikat/hilang; tanpa page error.
- Uji regresi sel matriks: klik sel → ubah filter global → detail tetap terisi (sebelumnya kosong).

## 6. Risiko & catatan data (bukan bug baru)

- **Tidak ada mutasi data**: perubahan murni read-side (markup/computed) + tes; tidak ada query,
  endpoint, atau migrasi D1.
- Nama kegiatan BA yang tidak seragam (mis. `KKD Refraksi Objektif` vs `KKD - Refraksi Subjektif`)
  tetap menjadi baris berbeda dan menambah hitungan. Bila itu kegiatan yang sama, seragamkan nama di BA.
- BA dengan Bagian/Blok berbeda dari kegiatan induknya dihitung pada sel Bagian/Blok BA tersebut
  (muncul sebagai baris terpisah). Ini perilaku yang disepakati; belum ada validasi khusus.
- BA PEN tidak masuk matriks/Dosen (sesuai desain K5); hanya tampil di kolom BA PEN.
- BA orphan / legacy bernama beda tidak hilang: masuk kolom `Lainnya` atau baris sendiri, tetap dihitung.

## 7. Rollback

1. `git revert <sha-commit-ini>` lalu push ke `main`.
2. Deploy ulang: `npx wrangler deploy --config wrangler.production.toml`.
3. Tidak perlu rollback D1 (tidak ada migrasi).

## 8. Cara memeriksa setelah deploy

1. Buka halaman Detail Laporan → tab **Laporan Bagian** (mode analitis).
2. Cek KPI: Kegiatan / BA PEL / BA PEN / Total hitungan.
3. Klik salah satu sel matriks → tabel detail hanya menampilkan kegiatan pada Blok·Bagian tersebut,
   muncul chip "Disaring" + tombol "Tampilkan semua".
4. Ubah filter global (Blok/Status/Jenis/Tanggal/Cari) → sel matriks otomatis dilepas, detail terisi ulang.
5. Buka satu baris → panel peserta + daftar dokumen BA PEL (semua sesi tampil, dengan jam).
6. Export .xlsx → periksa sheet **Rekap Bagian**, **Detail Kegiatan**, **Detail Peserta**.
