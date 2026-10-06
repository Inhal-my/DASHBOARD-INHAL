# Desain: Tab "Berita Acara" sebagai antrian dua tahap (`new-code1-cf/public/dashboard.html`)

Tanggal: 2026-09-12
Status: Disetujui user (12 Sep 2026)
Mockup: `mockups/ba-proses/index.html` (data dummy, bukan produksi)

## Latar Belakang

Dashboard admin saat ini punya tiga menu yang bersinggungan dengan berita acara:

1. **Laporan Bagian** — audit kelengkapan per kegiatan (baca)
2. **Berita Acara Bagian** — sesi input admin yang menyamar sebagai Bagian (tulis sumber Bagian)
3. **Berita Acara** — daftar + unggah BA Admin (tulis sumber Admin)

Nama-nama itu menyembunyikan model kerja yang sebenarnya. Alur bisnis (disepakati user):

1. Admin mengunggah **BA Pendukung** untuk mendukung keputusan Diterima/Ditolak.
2. Mahasiswa yang Diterima melaksanakan kegiatan di Bagian.
3. Staff Bagian (atau admin cadangan) mengunggah **BA Pelaksanaan**.

Bukan tiga jenis dokumen. Hanya **dua tahap** pada kegiatan yang sama. Tabel fisik tetap terpisah (`berita_acara_admin*` = Pendukung, `berita_acara*` = Pelaksanaan); yang berubah adalah **cara menampilkan**.

## Catatan Supersede

Spec ini menggantikan bagian UI yang relevan dari:

- `2026-09-11-dashboard-laporan-bagian-audit-design.md` (kartu 7, kolom BA+ACC Final, filter Sumber/Status Final)
- `2026-08-21-ba-bagian-tab-dashboard-design.md` (hanya **penempatan nav**; pemisahan sheet dan `adminBagianBypass` tetap)

Yang **dipertahankan**:

- Pemisahan fisik sheet/tabel Bagian vs Admin.
- Pencocokan BA ke kegiatan: NPM peserta dulu, lalu nama kegiatan; tanggal diabaikan.
- Baris **BA tanpa pengajuan** (orphan) ditampilkan, tidak masuk hitungan kartu.
- Ekspor Excel (`.xlsx`) dari tabel proses.
- Alur unggah Pelaksanaan tetap lewat sesi Bagian (`adminBagianBypass`); tidak disamakan dengan unggah Pendukung.

## Keputusan User (12 Sep 2026)

1. Satukan tiga menu menjadi **satu tab Berita Acara** (opsi B), isi utama = **tabel proses** (satu baris = satu kegiatan). **Disetujui.**
2. Label kerja, bukan gudang: **BA Pendukung** / **BA Pelaksanaan**. Bukan “BA Admin / BA Bagian” di UI. **Disetujui.**
3. Lima kartu: Kegiatan, Peserta, BA Pendukung (`sudah/total`), BA Pelaksanaan (`sudah/yang Diterima`), Belum lengkap. **Disetujui.**
4. Batang per Bagian **sepertiga lebar**; peta Bagian × Blok **dua pertiga**, geser horizontal jika blok banyak. Peta = kelengkapan **Pelaksanaan** saja. **Disetujui.**
5. Chip filter: `Semua` | `Belum Pendukung` | `Belum Pelaksanaan` | `Belum lengkap`. Satu tombol **Reset**. **Disetujui.**
6. Header **Tanggal** bisa di-sort (default terbaru). Sort tidak dicampur dengan “belum lengkap dulu”. **Disetujui.**
7. ACC Final **tidak** masuk tab ini (milik Pengajuan). **Disetujui.**
8. Orphan BA: badge/teks, bukan kartu. **Disetujui.**

## Desain

### Navigasi

Nav dashboard (urutan):

1. Pengajuan
2. Statistik
3. **Berita Acara** (tab baru/digabung; menggantikan `bagian`, `baBagian`, `ba`)
4. Master Data

Tombol unggah tetap dua, karena aturannya beda:

- **Unggah BA Pendukung** — form admin yang sudah ada (`uploadBeritaAcaraAdmin`)
- **Unggah BA Pelaksanaan** — buka alur sesi Bagian yang sudah ada (`adminBagianBypass` → picker kegiatan)

### Zona 1 — Kartu (5)

Dihitung dari seluruh `units` (bukan orphan). Tidak mengikuti chip, supaya angka halaman tetap.

| Kartu | Angka | Baris kecil | Klik |
|---|---|---|---|
| Kegiatan | total `units` | `semua kegiatan` | chip `Semua` |
| Peserta | jumlah mahasiswa (bukan tombol) | `mahasiswa` | tidak ada |
| BA Pendukung | `sudah / total` | `{n}% sudah ada` | chip `Belum Pendukung` |
| BA Pelaksanaan | `sudah / yang Diterima` | `{n}% dari yang Diterima` | chip `Belum Pelaksanaan` |
| Belum lengkap | satu angka, merah jika > 0 | `perlu ditindak` | chip `Belum lengkap` |

Pembilang Pelaksanaan hanya kegiatan berstatus **Diterima**. Belum lengkap = Pendukung kosong **atau** (Diterima dan Pelaksanaan kosong).

### Zona 2 — Batang + peta (Pelaksanaan)

Grid `1fr / 2fr`.

- **Kiri — Kelengkapan Pelaksanaan per Bagian:** nama, `done/total · persen`, batang hijau/kuning/merah. Klik = saring Bagian (semua blok).
- **Kanan — Peta Kelengkapan Bagian × Blok:** sel = `sudah Pelaksanaan / jumlah kegiatan`. `–` jika kosong. Overflow-x; kolom nama Bagian sticky. Klik sel = saring Bagian + Blok.
- Legenda: `lengkap` / `sebagian` / `belum`.

### Zona 3 — Chip + Reset

`Semua` | `Belum Pendukung` | `Belum Pelaksanaan` | `Belum lengkap` + teks `Menampilkan X kegiatan` + **Reset**.

Reset satu tombol: chip `Semua`, lokasi kosong, sort Tanggal `desc`.

Chip dan kartu sepadan memakai saringan yang sama. Chip + lokasi (peta/batang) bisa digabung.

### Zona 4 — Tabel proses

Satu baris = satu kegiatan. Kolom kiri → kanan = urutan kerja:

| Kolom | Isi | Sort |
|---|---|---|
| Tanggal | tanggal kegiatan | ya (default `desc`; klik toggle `asc`) |
| Bagian | badge | tidak di mockup; boleh ditambah nanti |
| Blok | | |
| Kegiatan | nama | |
| Peserta | jumlah; expand daftar | |
| BA Pendukung | `Ada` + tautan file, atau `Belum` | |
| Keputusan | Diterima / Ditolak / Menunggu | |
| BA Pelaksanaan | `Ada` + tautan, `Belum` (jika Diterima), atau `—` (belum Diterima) | |
| Aksi | lihat di bawah | |

**Aksi:**

- Pendukung kosong → `Unggah Pendukung`
- Diterima dan Pelaksanaan kosong → `Unggah Pelaksanaan`
- selain itu → `Lihat file`

Default urutan: tanggal terbaru. Filter chip **tidak** memaksa “belum lengkap di atas”; admin yang ingin antrian memakai chip `Belum lengkap`.

Orphan: baris/teks `BA tanpa pengajuan` hanya saat chip `Semua` dan tidak ada saringan lokasi. Tidak masuk hitungan kartu.

### Di luar lingkup

- Tidak mengubah skema D1 / pemisahan tabel BA.
- Tidak menggabungkan unggah Pendukung dan Pelaksanaan jadi satu form.
- Tidak memindah ACC Final ke tab ini.
- Tidak mengubah `bagian.html`.
- Rename worker `inhal-online.prodifkik.workers.dev` tetap backlog terpisah.

## Pengujian (nanti, saat implementasi)

- Kartu dummy: Pendukung `3/9`, Pelaksanaan `2/3`, Belum lengkap `7`.
- Chip `Belum Pendukung` menampilkan baris tanpa Pendukung.
- Chip `Belum Pelaksanaan` hanya baris Diterima tanpa Pelaksanaan.
- Klik sel peta menyaring Bagian + Blok; Reset menghapus chip + lokasi + mengembalikan sort Tanggal `desc`.
- Orphan tidak menambah `Kegiatan` / `Belum lengkap`.
- Suite vitest existing `test/read-bagian-audit.test.js` tetap hijau (logika pencocokan tidak diubah kecuali jika spec implementasi menuntut).
