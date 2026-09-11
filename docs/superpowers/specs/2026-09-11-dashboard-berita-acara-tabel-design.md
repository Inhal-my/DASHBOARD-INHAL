# Desain: Tab Berita Acara Menjadi Tabel (`new-code1-cf/public/dashboard.html`)

Tanggal: 2026-09-11
Status: Disetujui user (11 Sep 2026)

## Latar Belakang

Tab **Berita Acara** di dashboard admin (`new-code1-cf/public/dashboard.html:762`) saat ini menampilkan daftar **kartu per BA** (`:800-835`). Setiap kartu memakai sekitar 5 baris (ID + waktu unggah, Blok + Nama Kegiatan, tanggal pelaksanaan, badge Bagian, chip peserta, tombol Hapus/Lihat File/expand peserta), sehingga daftar cepat menjadi sangat panjang dan kurang enak dipindai.

User ingin tab ini diubah menjadi **kartu statistik + tabel data** yang lebih informatif, profesional, dan modern.

Catatan: spec `2026-08-24-tab-berita-acara-tabel-design.md` berlaku untuk halaman GAS lama `new-code1/pages/detail-laporan.html` (dengan grouping, kolom biaya, subtotal). Spec ini terpisah dan khusus untuk dashboard `new-code1-cf`.

## Keputusan User (11 Sep 2026)

1. Gaya: **kartu statistik + tabel data** (opsi B). **Disetujui.**
2. Kolom: **Tanggal Pelaksanaan, Blok, Nama Kegiatan (+ BA ID kecil), Bagian, Peserta, Waktu Unggah, Aksi** (7 kolom). **Disetujui.**
3. Detail peserta: **baris expand / accordion**. **Disetujui.**
4. Kartu statistik: **Total BA, Total Peserta, Jumlah Blok, Jumlah Bagian**, mengikuti filter aktif. **Disetujui.**
5. Tampilan HP: **responsif — tabel di desktop, kartu ringkas di HP**. **Disetujui.**
6. Fitur bantu: **pencarian + sortir via klik header**, tanpa pagination. **Disetujui.**

## Desain

### 1. Header & Toolbar

- Judul "Berita Acara" dan tombol **Upload Berita Acara** tetap (`openBaUpload()`, `:2561`).
- Toolbar filter diperluas: input **Cari** (nama kegiatan, Blok, Bagian, BA ID), dropdown **Blok**, dropdown **Bagian**, teks "Menampilkan X dari Y BA", tombol **Reset** filter.
- Filter Blok/Bagian tetap memakai state dan `applyBaFilter()` yang ada (`:2550`, state `ba` di `:1320`). Pencarian dan sortir murni computed di sisi klien.

### 2. Kartu Statistik (4 kartu)

Menghitung dari hasil filter aktif (search + Blok + Bagian), bukan seluruh data:

| Kartu | Nilai |
|---|---|
| Total BA | jumlah baris BA |
| Total Peserta | jumlah peserta **unik** (berdasarkan NPM) dari seluruh BA terfilter |
| Jumlah Blok | jumlah blok unik |
| Jumlah Bagian | jumlah bagian unik |

Gaya: ikon + angka besar + label, konsisten dengan `master-stat`/shadow-soft ring yang sudah dipakai dashboard.

### 3. Tabel Data (desktop, `md` ke atas)

| Kolom | Isi | Sortir |
|---|---|---|
| Tanggal Pelaksanaan | `formatTanggalWaktu(r['Tanggal Pelaksanaan'])` | ya |
| Blok | `r.Blok` | ya |
| Nama Kegiatan | `r['Nama Kegiatan']`, di bawahnya `BA ID` monospace kecil | ya |
| Bagian | badge `r.Bagian` | ya |
| Peserta | tombol/chip angka `r['Jumlah Peserta']` -> expand | ya |
| Waktu Unggah | `formatTanggal(r.Timestamp)` | ya |
| Aksi | link **Lihat File** (`r['File URL']`, buka tab baru) + tombol **Hapus** | - |

- Header sticky, hover baris, zebra.
- Sortir: klik header -> toggle asc/desc, ikon panah (`bi-arrow-down-up`/`bi-sort-*`). Default urutan **Tanggal Pelaksanaan terbaru** di atas.
- Loading state dan empty state dipertahankan.

### 4. Baris Expand Peserta

- Klik kolom **Peserta** -> toggle `expandedBa[BA ID]` (state & pola `toggleBaExpand()` sudah ada, `:2558`).
- Baris expand (colspan seluruh kolom) menampilkan daftar peserta: **nama, NPM, blok** (data `r.peserta[]`).
- Beberapa baris boleh terbuka bersamaan.

### 5. Tampilan HP (di bawah `md`)

- Tabel disembunyikan; diganti daftar **kartu ringkas** per BA berisi info utama (Nama Kegiatan + BA ID, Tanggal, Blok, Bagian, Peserta), tombol expand peserta, dan aksi (Lihat File, Hapus). Kartu statistik tetap tampil (grid 2 kolom).

### 6. Alur Data

- Tidak ada perubahan backend/API/RPC. Sumber data tetap `ba.rows` (`:1320`) hasil `applyBaFilter()`.
- Satu computed baru untuk: pencarian, sortir, dan agregat kartu statistik. Data peserta sudah tersedia di `ba.rows[].peserta`.

## Batasan

- Hanya `new-code1-cf/public/dashboard.html` yang berubah. Backend (`src/**`) **tidak disentuh**.
- Tab lain tidak terpengaruh; state `ba`/`expandedBa` tetap dipakai.
- Tidak menambah komentar pada kode tanpa diminta.
- Tidak menambah dependensi baru.

## Verifikasi

- Uji data kosong, sedikit (1-2 BA), dan banyak.
- Kombinasi filter Blok/Bagian + pencarian, lalu reset.
- Expand/collapse peserta, termasuk beberapa baris sekaligus.
- Sortir tiap kolom (asc/desc) dan default Tanggal Pelaksanaan terbaru.
- Tombol Lihat File dan Hapus (dialog konfirmasi) tetap berfungsi.
- Tampilan HP: kartu ringkas tampil benar, tanpa scroll horizontal.
