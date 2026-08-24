# Desain: Tab Berita Acara Menjadi Tabel Rekap (`detail-laporan.html`)

Tanggal: 2026-08-24
Status: Disetujui user (24 Agu 2026)

## Latar Belakang

Tab Berita Acara di `detail-laporan.html` saat ini menampilkan **kartu berkelompok per Bagian** (`baGroups`, `:1329`): tiap grup berisi daftar kartu BA (ID, Nama Kegiatan, Blok/Tanggal, jumlah peserta, tombol "Lihat File", chip peserta). User ingin tampilan ini diubah menjadi **tabel rekap**, mengikuti pola desain tab Laporan Bagian / Laporan Dosen.

## Keputusan User (24 Agu 2026)

1. **Rekapitulasi**: satu baris per grup `Bagian + Blok + Nama Kegiatan` — BA dengan blok/detail/jenis kegiatan sama digabung jadi satu baris. **Disetujui.**
2. **Kolom Biaya**: ditampilkan di tabel BA (konsisten dengan fitur biaya sebelumnya). **Disetujui.**
3. **Link File**: ditampilkan sebagai daftar link **di baris ekspansi saja**; jika bisa, sertakan **link bukti bayar**. **Disetujui.**
4. **Filter**: cukup **Bagian + Blok + Cari** (tanpa filter tanggal). **Disetujui.**

## Desain

### Data per grup

- Key grup: `normBagian(bagianLabel) + '::' + blok + '::' + normName(namaKegiatan)`.
- `bagianLabel` = `resolveBagianLabel(b.Bagian, '', b['Nama Kegiatan'])` (pola `:1332`).
- `namaKegiatan` = `b['Nama Kegiatan']` (berisi `pilihan - detail`, lihat `bagian.html:819`).
- Gabungan `peserta[]` unik (key: NPM) dari semua BA dalam grup.
- `jumlahBa` = jumlah file BA dalam grup.
- `pesertaCount` = jumlah peserta unik.
- `biaya` = Σ `biayaForNpm(npm, blok)` untuk peserta unik.
- `items` = daftar BA mentah dalam grup (untuk baris ekspansi).

### Tabel

Kolom (mengikuti gaya tabel `bagian-detail` `:535-619`):

| Kolom | Isi |
|---|---|
| (expand) | chevron `bi-chevron-down/up` |
| Bagian | label bagian |
| Blok | `blok` |
| Kegiatan | `namaKegiatan` |
| Tanggal | tanggal pelaksanaan (dari BA pertama/representatif) |
| Jumlah BA | jumlah file BA dalam grup |
| Peserta | jumlah peserta unik |
| Biaya | `fmtRupiah(biaya)` (kanan) |
| — | (link file ada di baris ekspansi) |

Struktur:
- **Baris subtotal per Bagian** setelah setiap blok grup bagian (pola `bagianDetailSections` `:1304-1319`): label "Subtotal {Bagian}", jumlah BA, peserta, biaya.
- **Baris Grand Total** di paling bawah (pola `:611-618`).
- **Baris ekspansi** (`v-if="expanded[key]"`, colspan = jumlah kolom): daftar tiap BA dalam grup —
  - BA ID (mono), Tanggal, jumlah peserta,
  - tombol/link **"Lihat File"** (File URL) per BA,
  - daftar **peserta** dengan **link bukti bayar** jika tersedia (resolve dari `this.rows[].pengajuan['Link Bukti Bayar']` via NPM, pola `pLink` di `bagianKegiatanAll` `:1061-1070`).

### Filter tab BA

- State baru `baFilter: { bagian: '', blok: '', q: '' }` (meniru `bagianFilter` `:904`).
- Dropdown **Bagian** (opsi `bagianOptions`), dropdown **Blok** (opsi `baBlokOptions` dari data BA), input **Cari** (mencocokkan `Nama Kegiatan`, `BA ID`, NPM/nama peserta).
- Computed `filteredBaTab` menggantikan pemakaian `filters` global pada tab BA. **Tab lain tidak terpengaruh** (`filteredBa` global tetap dipakai Rekap/dosen/export utama).

### Export XLSX

Tombol Export di header tabel BA (pola `exportDosenMatrix` `:416-418`):
- Sheet **"Rekap BA"**: per grup — Bagian, Blok, Nama Kegiatan, Tanggal, Jumlah BA, Jumlah Peserta, Biaya.
- Sheet **"Detail BA"**: per file BA dalam grup ter-filter — BA ID, Bagian, Blok, Nama Kegiatan, Tanggal, Jumlah Peserta, Biaya, File URL.
- Menggunakan data `filteredBaTab`.

## Batasan

- Hanya `new-code1/pages/detail-laporan.html` yang berubah. Backend (`0_code.gs`/`1_business.gs`) **tidak disentuh**.
- Kompatibilitas: `baGroups` lama boleh dihapus/diganti selama tidak dipakai komponen lain (hanya dipakai di tab BA).
- Tidak menambah komentar pada kode tanpa diminta.
