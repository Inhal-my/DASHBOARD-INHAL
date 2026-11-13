# Release 2026-11-13 - Dosen Searchable Picker

## Ringkasan
- Semua input dosen di aplikasi produksi kini berupa picker pencarian: nilai hanya bisa dipilih dari master Dosen.
- Mengetik hanya menyaring daftar; nilai tidak pernah tersimpan dari teks bebas.
- Nama dosen lama yang tidak ada di master tetap dipertahankan dan diberi label "di luar master".

## Perubahan
- Komponen bersama `public/dosen-picker.js`.
- `bagian.html`: jadwal, lengkapi BA, dan form BA Pelaksanaan memakai picker.
- `dashboard.html`: Kelola BA menjadi multi-dosen (maksimal 5) dengan picker.
- `detail-laporan.html`: Kelola BA memakai picker.
- Server menolak nama dosen baru yang tidak ada di master pada simpan jadwal dan BA.
- Nama dosen master dinormalkan ke ejaan kanonik saat disimpan.

## Catatan Operasional
- Bila master Dosen kosong, validasi master dilewati agar penyimpanan tidak terkunci.
- Menambah dosen baru tetap dilakukan lewat master, bukan lewat form jadwal/BA.
- Dosen yang sudah terpasang pada record lama tidak dipaksa memilih ulang; badge "di luar master" hanya menandai.

## Verifikasi
- `npm run csp:generate` dan `npm run csp:check`: CSP sinkron.
- `npx vitest run`: 115 file / 986 test lulus.
- `npm run test:scripts`: 85 lulus, 1 gagal pada `scripts/__tests__/diagnose-bagian.node.mjs`.
  - Kegagalan berasal dari skrip diagnostik untracked yang mengimpor `computeBagianRows` yang tidak ada di `src/read/bagian.js`; tidak terkait perubahan ini dan tidak ikut dikomit.
