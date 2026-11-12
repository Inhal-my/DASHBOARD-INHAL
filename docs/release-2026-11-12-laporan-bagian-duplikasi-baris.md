# Catatan Rilis: Perbaikan Duplikasi Baris Tab Laporan Bagian

Tanggal: 2026-11-12
Status: **DIPERBAIKI** (belum di-deploy saat catatan ini dibuat).

## Gejala

Tab **Laporan Bagian** menampilkan 918 baris peserta untuk Bagian Parasitologi,
padahal data `detail_kegiatan` hanya berisi 79 peserta (75 NPM unik, 0 duplikat).
Angka yang sama ikut terbawa ke ekspor Excel (satu sheet per Bagian).

## Akar masalah

Duplikasi bukan berasal dari data D1, melainkan dari `bagianKegiatanAll()` di
`new-code1-cf/public/detail-laporan.html`:

1. **Kunci baris memakai string tanggal mentah.** `fullKey = normName(nama) + '::' + String(tanggal)`.
   Satu unit "Parasitologi - Remediasi" memiliki 13 variasi string tanggal
   (`""`, `2026-11-03`, `2026-11-03T00:00`, `2026-11-09` vs `2026-11-09T11:11`, dst).
2. **Merge unit mengganti peserta dengan seluruh roster unit.** Saat baris digabung
   dengan unit dari `this.kegiatan` (kunci `bagian::blok::label` tanpa tanggal),
   peserta baris diganti dengan semua peserta unit.

Hasilnya `roster (68) x jumlah variasi tanggal (13)` = 884 baris, ditambah
PostTest/Praktikum sehingga total 918. Bug ini masuk lewat commit `fe660e6`
(matriks frekuensi BA PEL), bukan dari fitur ekspor.

## Perbaikan

- `normTgl()` menormalkan tanggal ke `YYYY-MM-DD`; jam (`T00:00`, `T11:11`) dibuang
  dan tanggal kosong menjadi satu grup.
- `unitDateMap` mencatat tanggal per NPM per unit; merge unit hanya menambahkan
  peserta yang tanggalnya cocok dengan baris, bukan seluruh roster.
- Tambah 3 tes regresi di `test/detail-laporan-pagination.test.js`.

## Hasil verifikasi (snapshot produksi)

| Metrik | Sebelum | Sesudah |
| --- | --- | --- |
| Total baris peserta | 1168 | 238 |
| Peserta Parasitologi | 918 | 79 |
| Baris kegiatan | 88 | 85 |

- `npx vitest run` → 112 file / 960 tes lulus.
- `npm run csp:generate` + `npm run csp:check` → CSP sinkron.

## Catatan data (bukan bug kode)

- `BA-PEN-2026-0062` (Parasitologi - Remediasi) tersimpan tanpa
  `tanggal_pelaksanaan`; 43 baris `detail_kegiatan` juga bertanggal kosong.
  Kemungkinan BA Pendukung dibuat admin tanpa/tanggal salah dan perlu dikoreksi.
- `BA-PEN-2026-0031` (Research - Praktikum) memiliki satu baris
  `berita_acara_admin_peserta` ganda untuk NPM/pengajuan yang sama (urutan 3).
  Ini duplikasi data nyata, terpisah dari bug tampilan di atas.
- Status **"Mengikuti PDF bersama"** hanya penanda berkas di BA Pendukung
  (`berita_acara_admin_berkas.scope='shared'`); tidak menambah baris kegiatan
  maupun baris peserta di Laporan Bagian.
