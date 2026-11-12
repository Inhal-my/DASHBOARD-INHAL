# Desain: Tab Laporan Bagian sebagai Matriks Frekuensi BA PEL

Tanggal: 2026-11-11
Status: **Diimplementasi** (mockup revisi 8 disetujui, diterapkan ke `new-code1-cf/public/detail-laporan.html`).
Terkait:
- Mockup: `mockups/laporan-bagian-audit/` (revisi 8, data dummy)
- Kode: `new-code1-cf/public/detail-laporan.html` (tab `bagian`)
- Guard test: `new-code1-cf/test/detail-laporan-template.test.js`, `new-code1-cf/test/detail-laporan-pagination.test.js`

---

## 1. Masalah

Tab "Laporan Bagian" lama memakai tabel rekap biaya + matriks yang menghitung **jumlah kegiatan**. Akibatnya:

1. Angka matriks tidak mencerminkan beban dokumen: satu kegiatan dengan dua Berita Acara Pelaksanaan (BA PEL) tetap dihitung 1.
2. Kolom biaya dan bukti bayar mendominasi tabel detail, padahal rekap biaya sudah ada di tab Pembayaran.
3. Kegiatan yang belum punya BA PEL tidak terlihat sebagai pekerjaan tertunda karena hanya muncul sebagai sel 0 tanpa penjelasan.
4. Legenda matriks hanya membedakan 2 keadaan, tidak membedakan "0 tanpa kegiatan" dan "0 tetapi ada kegiatan".

## 2. Keputusan

| # | Keputusan | Alasan |
| --- | --- | --- |
| K1 | Fokus tab = **alat hitung frekuensi**: matriks **Blok × Bagian** di atas, tabel **Detail Kegiatan** di bawah | Matriks menjawab "berapa BA PEL per blok/bagian"; detail hanya penjelas angka |
| K2 | Satuan hitung = **satu BA PEL = satu hitungan**; kegiatan dengan 2 BA PEL menyumbang 2 | Angka matriks = jumlah dokumen yang harus diperiksa |
| K3 | Kegiatan tanpa BA PEL **tidak dihitung** (0) tetapi **tetap didaftar** dengan Hitungan `0×` | Pekerjaan tertunda tetap terlihat |
| K4 | Kegiatan tanpa peserta ACC **tetap tampil** + badge `Tanpa ACC` | Tidak menyembunyikan kegiatan terjadwal |
| K5 | Istilah resmi **BA PEL** (Berita Acara Pelaksanaan) dan **BA PEN** (Berita Acara Pendukung); BA PEN menempel di kolom BA PEL | Tidak ada kolom terpisah untuk BA PEN |
| K6 | Matriks 4 keadaan: ≥2 BA PEL (hijau), 1 BA PEL (kuning), 0 ada kegiatan (merah muda, klik-able), 0 tanpa kegiatan (putih, disabled) | Sel merah muda menandai kegiatan yang belum ber-BA PEL |
| K7 | KPI: **Kegiatan, BA PEL, BA PEN, Total hitungan**; biaya tidak ditampilkan | Rekap biaya ada di tab Pembayaran |
| K8 | Filter Bagian **menyempitkan kolom matriks** ke satu bagian; KPI/detail/footnote ikut menyesuaikan | Satu pintu filter, konsisten dengan mockup |
| K9 | Kelompok detail default **Blok › Bagian**, bisa dibalik ke **Bagian › Blok** | Fleksibel tanpa mengubah data |
| K10 | Klik sel menyaring tabel detail (bukan filter global); klik sel yang sama / "Tampilkan semua" / Reset mengembalikan | Menghindari efek samping ke tab lain |

Non-tujuan: tidak mengubah query/endpoint data, tidak mengubah aturan kelengkapan BA, tidak menampilkan nominal rupiah di tab ini.

## 3. Struktur Data

`bagianBaIndex` (computed baru) memetakan `loose(bagian)::loose(blok)::loose(nama)` ke:

```js
{ baPel: [{ baId, tanggal, jam, dosen, jumlahPeserta, pesertaNpm[], fileUrl }],
  baPen: [{ baId, tanggal, jam, jumlahPeserta, fileUrl }] }
```

- Sumber BA PEL: `this.beritaAcara` (BA sumber Bagian).
- Sumber BA PEN: `this.kegiatan[].baPendukung`.
- `loose()` = `normBagian` lalu buang semua non-alfanumerik, sehingga `Pilihan - Detail` dan `Pilihan Detail` cocok.

`bagianKegiatanAll` menambahkan properti turunan per baris:

```js
{ ...row, baPel: [...], baPen: [...], baPelCount, baPenCount, hitungan }
```

Baris BA PEL dikelompokkan per kegiatan (`normName(Nama Kegiatan)` di dalam bagian+blok), bukan per
`nama::tanggal`. Beberapa sesi BA PEL pada tanggal berbeda tetap satu baris detail; tanggal yang
dipakai adalah tanggal sesi terakhir dan daftar peserta digabung tanpa duplikat. Tanpa aturan ini
kegiatan multi-sesi muncul sebagai dua baris yang masing-masing membawa seluruh daftar BA PEL
sehingga `hitungan` dan KPI BA PEL terhitung dua kali.

## 4. Matriks & KPI

- `bagianMatrixCols` = `bagianAllLabels`, dipersempit ke `bagianFilter.bagian` bila dipilih.
- `bagianMatrixRows[].counts[k]` = jumlah BA PEL; `rows[].keg[k]` = jumlah kegiatan; `rows[].total` = jumlah kolom yang sedang tampil.
- `matrixColTotal(b)`, `matrixGrandTotal` mengikuti kolom yang tampil.
- Ekspor "Rekap Bagian" tetap memakai seluruh `bagianAllLabels` dengan total dihitung ulang dari `matrixColTotal`.
- `bagianKpis` = `[Kegiatan, BA PEL, BA PEN, Total hitungan]` dari `bagianKegiatanAll` (terfilter global).

## 5. Detail Kegiatan

- 8 kolom: chevron, Bagian, Blok, Kegiatan, Tanggal, Peserta, BA PEL · BA PEN, Hitungan.
- Tanggal = tanggal BA PEL terakhir; jika belum ada BA PEL, tanggal jadwal dengan keterangan "jadwal (rencana)".
- Peserta = `ACC/total` + `menunggu · ditolak`; tanpa pendaftar → "tanpa pendaftar" + badge `Tanpa ACC`.
- BA PEL · BA PEN = badge `N BA PEL` / `Belum ada BA PEL` + `BA PEN: N berkas`; peringatan merah bila peserta BA PEL < ACC.
- Hitungan = `N×`; `0×` bergaya putus-putus kuning.
- Panel baris: tabel peserta (NPM, Nama, Status, Di BA PEL, bukti bayar) + tabel dokumen BA PEL + "Kegiatan ini dihitung N×" + BA PEN.

## 6. Paginasi & Pengelompokan

- `bagianDetailBlocks()` mengelompokkan menurut `bagianFilter.group` (default `blok`), bukan per bagian saja; setiap blok grup memiliki `{ bagian, outer, inner, rows, subtotal }`.
- `bagianPageSlices()`, `bagianPageInfo()`, `bagianPagedSections()` tidak berubah kontrak (dipakai guard test paginasi).
- Subtotal grup menampilkan jumlah kegiatan, peserta, dan hitungan; Grand Total menampilkan peserta + hitungan.
- Watcher `bagianFilter.bagian` dan `bagianFilter.group` mereset halaman `bagian`/`bagianMatrix` ke 1.
- Watcher `bagianFilter.bagian` membandingkan label secara ternormalisasi (`normBagian`) agar pilihan filter
  `LAB 1` tetap cocok dengan label matriks; pilihan filter memakai `bagianAllLabels` supaya bagian `Lainnya`
  juga bisa dipilih.
- Watcher filter global (`filters.blok/status/jenis/from/to/search`) selalu mengosongkan `activeMatrixCell`,
  sehingga menyaring ulang tidak menyisakan sel matriks lama yang membuat tabel detail kosong.
- Header kartu Detail Kegiatan menampilkan chip "Disaring: Blok · Bagian" + tombol "Tampilkan semua" saat
  sebuah sel matriks aktif, agar KPI global dan tabel detail yang terbatas tidak terbaca kontradiktif.

## 7. CSS

Kelas baru berprefix `bgd-` (tanpa menambah utility Tailwind baru):

| Kelas | Peran |
| --- | --- |
| `.bgd-keg`, `.bgd-sub` | Nama kegiatan + subteks |
| `.bgd-hit`, `.bgd-hit.zero` | Pil hitungan |
| `.bgd-badges`, `.bgd-badge.*` | Badge BA PEL / BA PEN / Tanpa ACC |
| `.bgd-grp`, `.bgd-gbadge`, `.bgd-gname`, `.bgd-gcount` | Baris grup detail |
| `.bgd-panel`, `.bgd-panel-title`, `.bgd-side` | Panel dua kolom saat baris dibuka |
| `.bgd-ptab`, `.bgd-btab` | Tabel peserta & dokumen BA |
| `.bgd-empty`, `.bgd-flag`, `.bgd-status.*` | Keadaan kosong, tanda centang, status peserta |

## 8. Pengujian

- `test/detail-laporan-template.test.js`: template valid, primitif `in-heat`/`in-tbl` tetap ada, `Blok \ Bagian` + "Baris = Blok, kolom = Bagian" tetap ada.
- `test/detail-laporan-pagination.test.js`: state pager, helper, ids `pg-bagian`/`pg-bagianMatrix`, subtotal grup, baris total di luar potongan, watcher reset halaman. Satu asersi kolom grand total diganti dari biaya (`bagianDetailGrandTotal`) ke `bagianDetailHitunganTotal` karena kolom biaya dihapus dari tab.
- `npx vitest run` di `new-code1-cf/`.
