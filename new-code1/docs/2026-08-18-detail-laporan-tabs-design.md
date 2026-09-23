# Spesifikasi — Redesign Halaman Laporan (detail-laporan.html)

Tanggal: 2026-08-18
Status: Disetujui desain, siap implementasi

## 1. Tujuan

Mengubah `pages/detail-laporan.html` menjadi halaman laporan admin bertab sehingga admin dapat
merekapitulasi seluruh kegiatan INHAL dan memeriksa laporan per Bagian dan/atau per Dosen, dengan
tampilan yang lebih profesional, mewah, dan animatif namun tetap cepat.

## 2. Struktur Halaman

- Navbar atas tetap (judul + link Dashboard/Beranda).
- **Bar filter global** (sticky di bawah navbar) + **tab switcher** (pill) di bawahnya.
- 4 tab laporan.

### Tab switcher
- Pill horizontal, ikon + label, indikator aktif dengan gradien brand (indigo→violet).
- Transisi antar tab memakai `<transition name="fade">`.

### Bar filter global (premium)
- Glassmorphism: `bg-white/70 backdrop-blur-xl`, `ring-1 ring-white/60`, `rounded-2xl`, `shadow-lift`.
- Kontrol: rentang tanggal pelaksanaan (dari–sampai), filter Blok, filter Status, tombol Export (.xlsx).
- Efek: entrance animation (fade + slide-down), focus glow pada input, hover lift.

## 3. Tab

### Tab 1 — Rekap Keseluruhan
- Kartu ringkasan dengan **angka animasi count-up** + ikon gradien: total pendaftar, per status, total biaya.
- **Grafik (SVG, tanpa library)**: donat distribusi status (animasi stroke draw-in) + bar per jenis/blok (animasi lebar).
- Tabel flat semua pengajuan (expandable: detail kegiatan + riwayat status), filter jenis/status/cari + Blok + rentang tanggal.

### Tab 2 — Laporan Dosen
- Dikelompokkan per dosen (hanya dosen yang memiliki data).
- Header kartu = ringkasan: nama dosen, jumlah pengajuan, chip status, total biaya.
- Drill-down → daftar pengajuan dosen tsb (NPM, nama, jenis, blok, tanggal, status, biaya) → expand detail + riwayat.

### Tab 3 — Laporan Bagian
- Dikelompokkan per bagian (SGD/KKD/Ujian/Praktikum + nama lab).
- Header = ringkasan: total kegiatan/peserta, jumlah Pengajuan vs Berita Acara.
- Drill-down → entri kegiatan (detail kegiatan pengajuan + berita acara) dengan label sumber → expand detail.

### Tab 4 — Laporan Berita Acara
- Dikelompokkan per bagian; tiap BA: BA ID, blok, nama kegiatan, tanggal, jumlah peserta, daftar peserta, link file.

## 4. Data & Backend

- Tambah fungsi `getLaporanBootstrap()` di `business.gs` (satu panggilan, `requireAuthorized()`):
  - `summary` (total, per status, per jenis, per blok, total biaya).
  - `rows` (pengajuan + detail + riwayat + biaya ter-resolve).
  - `beritaAcara` (BA + peserta via `_getBaPesertaMap`).
  - `dosen` (distinct dari `Pengajuan.Dosen`).
  - `blok` (distinct dari pengajuan + BA).
  - `bagian` (`categories` + `labs` dari master).
- Pengelompokan per dosen/bagian dilakukan di frontend.
- Filter (tanggal/blok/status) diterapkan di frontend terhadap data yang sudah dimuat.

## 5. Export .xlsx

- Library SheetJS dimuat **on-demand** (injeksi `<script>` saat tombol Export pertama diklik) agar
  initial load tetap cepat.
- Export data tab aktif ke file `.xlsx` (sheet per tab: Rekap / Dosen / Bagian / BA).

## 6. Desain Premium (grafik, gradien, efek)

- Palet: brand indigo `#4f46e5` → violet, status: amber/emerald/rose/indigo/slate.
- Gradien: header/tab aktif/tombol/bilah grafik memakai gradien indigo→violet.
- Grafik: donat status + bar per jenis/blok (SVG murni, tanpa Chart.js) dengan animasi draw-in.
- Animasi: count-up angka, chart draw-in, transisi tab (fade), hover lift kartu, focus glow.
- Efek: glassmorphism filter bar, `shadow-lift`, glow halus.

## 7. Verifikasi

- `node -e` `new Function` untuk inline JS.
- Rebuild CSS Tailwind setelah penambahan class.
- Tidak mengubah halaman lain (dashboard.html tetap memakai fungsi backend lama).
