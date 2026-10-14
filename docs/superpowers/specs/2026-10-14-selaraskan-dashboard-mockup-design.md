# Desain: Penyelarasan Visual Dashboard ke Mockup (Sub-proyek 1)

Tanggal: 2026-10-14
Acuan visual: `mockups/pengajuan-v2/index.html`
Target: `new-code1-cf/public/dashboard.html`
Prinsip: **look mockup, fitur produksi tetap**

## 1. Tujuan

Membuat seluruh tab dashboard (Pengajuan, Manual, Statistik, Berita Acara, Master Data) tampil setara dengan mockup redesain: urutan seksi, gaya kartu, chip, badge, tabel, avatar, ikon berkas, dan legenda. Perubahan bersifat **struktur visual** — perilaku, data, binding, dan teks produksi dipertahankan.

## 2. Non-tujuan

- Tidak menambah interaksi baru: kartu statistik Pengajuan **tidak** dijadikan filter, tidak ada tombol "Muat Ulang", tidak ada tambah/hapus Lab di form Manual.
- Tidak menghapus fitur produksi (matriks heat dinamis, filter tambahan, expand per-BA, sortir, ekspor, bulk email).
- Tidak mengubah nama field, computed, method, atau teks berbahasa Indonesia yang sudah ada.
- Tidak menyentuh halaman Laporan (`detail-laporan.html`) — itu sub-proyek 2.

## 3. Prinsip resolusi selisih

Mockup lebih sederhana daripada produksi. Aturan:
1. **Urutan & gaya seksi** mengikuti mockup.
2. **Kemampuan produksi dipertahankan**; bila mockup tidak punya padanannya, fitur produksi di-restyle agar seragam, bukan dihapus.
3. Elemen mockup yang **murni visual** dan datanya sudah tersedia → ditambahkan.
4. Elemen mockup yang butuh **data/perilaku baru** → dilewati (fitur tidak ditambah).

## 4. Lapisan visual (`in-*`)

Definisi CSS baru ditambahkan ke blok `<style>` khusus di `dashboard.html` (pola sama seperti Task 1 sebelumnya), nilai **verbatim dari mockup**. Tanpa CSS bersama, tanpa build.

Sudah tersedia (dari pass sebelumnya): `in-chip`(+`.is-active`,`.dot`), `in-badge.(wait|recv|acc|rej|cancel)`, `in-tbl`(+`thead th.text-*`), `in-toolbar`, `in-input`, `in-progdots`, `in-bar-track`, `in-bar-fill.(g|y|r)`, `in-heat`(+`.c.(g|y|r)`,`.lab`), `in-statrow`(+`.ic`,`.num`,`.lbl`,`.pct`), `in-tabsw`/`in-tab`.

Primitif baru yang perlu ditambahkan (sumber baris mockup):

| Primitif | Nilai (verbatim mockup) | Ref |
|---|---|---|
| `.in-pageintro` | `margin-bottom:18px;display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap` + `h2` 21px/800, `p` 4px/13.5px/ink-500 | mockup 85-87 |
| `.in-avatar` | `width:34px;height:34px;border-radius:999px;display:grid;place-items:center;flex:0 0 auto;color:#fff;font-weight:800;font-size:12px` (ukuran sel tabel; versi shell 36px tetap) | mockup 59,146-147 |
| `.in-celluser` | `display:flex;align-items:center;gap:11px` | mockup 146 |
| `.in-docdot` | `width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:12px;border:1px solid var(--line);color:var(--ink-400);background:#fff`; `.on` `color:#fff;border-color:transparent`; `.on.surat` bg `#0284c7`; `.on.acc` bg `#059669`; `.on.bukti` bg `#ea580c` | mockup 155-159 |
| `.in-cards`/`.in-mcard` | `.in-cards{padding:12px;gap:12px;flex-direction:column}`; `.in-mcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;box-shadow:0 1px 2px rgba(15,23,42,.04)}` + `.row1`,`.kv`,`.actions` mengikuti mockup 168-174 | mockup 168-174 |
| `.in-proc` | `display:flex;gap:10px;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;box-shadow:var(--shadow-soft);margin-bottom:18px`; `.p` flex row; `.n` 30px badge brand-soft/brand, `.p2 .n` emerald; `.t` 12.5px/800; `.s` 11px/ink-400; `.arrow` #cbd5e1 | mockup 269-275 |
| `.in-basum` | `display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:18px`; `.b` kartu 14px radius/padding/shadow; `.k` 10.5px uppercase; `.n` 20px/800; `.p` 11px; `.n.rose`/`.n.emerald` warna | mockup 278-286 |
| `.in-heat-legend` | `display:flex;gap:12px;font-size:11px;color:var(--ink-500);margin-top:10px`; `.dot{width:9px;height:9px;border-radius:99px;display:inline-block;margin-right:4px}` | mockup 306-307 |
| `.in-manual-note` | `display:flex;align-items:center;gap:8px;background:var(--violet-soft);color:var(--violet);border-radius:12px;padding:12px;font-size:12.5px;font-weight:600;margin-bottom:16px` | mockup 266 |

Catatan implementasi: karena produksi memakai Tailwind precompiled (bukan stylesheet mockup), kelas utilitas pada markup ditulis ulang atau memakai primitif `in-*` ini. Jangan menghapus kelas yang di-assert tes.

## 5. Perubahan per tab

### 5.1 Pengajuan (`dashboard.html` ~521-640)

- **Tambah baris kartu statistik** di atas chip: 5 kartu horizontal dari data `stats` — Total, Menunggu, Diterima, ACC, Ditolak (pakai `in-statrow`; varian horizontal seperti `.stat` mockup 107). Non-interaktif (tanpa ring aktif, tanpa `@click`).
- **Chip status**: tambahkan titik warna status di dalam `in-chip` (`.dot`), warna: Menunggu `#d97706`, Diterima `#0284c7`, ACC `#059669`, Ditolak `#e11d48`, Dibatalkan `#64748b` (mockup 720).
- **Filter**: selektor `Jenis`/`Blok` ditata sebaris dengan baris chip (mockup 748-751). Field pencarian dalam tab dan tombol **Terapkan** produksi dipertahankan, ditempatkan satu baris di atas chip.
- **Tabel**: ubah kolom menjadi urutan mockup (mockup 754):
  1. Checkbox (tetap; `v-model="r.checked"`).
  2. **Mahasiswa** = `in-celluser` + `in-avatar` inisial (turunan dari `r['Nama Lengkap']`, warna dari hash nama) + nama (`r['Nama Lengkap']`, tag Manual tetap) + sub `r.NPM`.
  3. **Kegiatan** = `r['Jenis Kegiatan']` (nm) + sub `r.Blok`.
  4. **Tanggal Daftar** = `formatTanggal(r.Timestamp)`.
  5. **Status** = `statusBadge(r.Status)`; tambah ikon kecil status (mockup 672) — opsional visual.
  6. **Berkas** = `in-docdot` dari field yang ada: Bukti Bayar (`r['Link Bukti Bayar']` → `.bukti`), Link Final (`r['Link Final']` → `.surat`). Bila kosong → dot `off`. (Mockup punya 3 dot Surat/ACC/Bukti; produksi hanya punya 2 dokumen — tidak menambah data, jadi 2 dot.)
  7. **Aksi** = pertahankan tombol **Hapus** produksi; tambah ikon **detail** (eye, `@click.stop="openDetail(...)"`) agar setara mockup. Baris tetap `@click="openDetail"`.
  - Pertahankan `manualHighlightId` ring, `@click.stop`, `safeUrl`.
- **Tambah daftar kartu mobile** (`in-cards`/`in-mcard`, `md:hidden`) dari `pengajuanRows` agar tampilan HP setara mockup (nama+kegiatan+status+aksi), di samping tabel desktop (`hidden md:block`).

### 5.2 Manual (`dashboard.html` ~643-821)

- Pecah satu kartu menjadi **4 panel** (mockup 888-931): *Identitas Mahasiswa*, *Detail Kegiatan* (jenis + bidang), *Keterangan*, *Aksi* (Status Awal + Reset/Save). Susun ulang wrapper saja; semua `v-model`, `@blur` auto-fill, upload, spinner `manual.saving`, validasi tetap.
- **Tambah catatan visual** `in-manual-note`: "Notifikasi email tidak dikirim untuk pengajuan manual." (mockup 922, 266).
- Grid detail SGD/KKD: mockup `grid3`; produksi `md:grid-cols-2` → tidak dipaksa 3 kolom bila field produksi berbeda; cukup selaraskan spacing/kelas. Praktikum tetap tanpa tambah/hapus Lab.

### 5.3 Statistik (`dashboard.html` ~836-1000)

- Kartu sudah setara (vertikal, ikon+num+lbl+trend/pct). Selaraskan: grid kartu (`stats`), chrome chart (`.in-statrow`/`dash-card` konsisten), geometri bar (label, track `in-bar-track` h-9px, nilai). Pertahankan grid responsif produksi & `totalTrend` dinamis.
- Tidak menambah tombol "Muat Ulang".

### 5.4 Berita Acara (`dashboard.html` ~887-1142)

- **Tambah banner proses** `in-proc` (2 langkah: BA Pendukung → BA Pelaksanaan) dari mockup 1057-1061, 269-275. Teks statis.
- **Ringkasan kartu**: selaraskan `ba-cards` ke gaya `in-basum` (label uppercase, angka besar, varian warna rose/emerald). Tetap 5 metrik produksi.
- **Legenda heat**: tambah `in-heat-legend` dengan titik warna (g/y/r) (mockup 1073, 306-307); teks legenda produksi dipertahankan.
- Matriks heat tetap dinamis (`bagianHeatmap`), filter/chip/expand/sortir/orphan tetap.

### 5.5 Master (`dashboard.html` ~1394-1614)

- Selaraskan grid kartu master ke mockup (mockup 1261: 5 kolom; produksi `grid-cols-2 sm:grid-cols-4`). Restyle kartu ke `.in-statrow`-style. Jangan ubah 10 kartu & `selectMaster`.
- Tabel tetap kolom produksi (mis. Kelola Unggahan 9 kolom) — tidak menghapus kolom "Jenis".

## 6. Perilaku & marker yang dipertahankan

`tab`, `statusChips`, `setStatusChip`, `applyFilter`, `toggleAll`, `bulkFinalEmail`, `deletePengajuanRow`, `openDetail`, `manualHighlightId`, `runDiagnostic`, `exportCsv`, `openDetailReport`, `isManual`, `statusBadge`, `safeUrl`; computed stats/BA/master; kelas `.dash-card`, `.dash-stat`, `.dash-table`, `.master-table`, `.ba-cards`, `.ba-pair`, `.heat-table`, `.heat-cell`, `.heat-scroll`, `.master-stat`, `.btn-soft`, `.btn-primary`, `.check`; semua `in-*` lama.

## 7. Pengujian

- Guard test baru di `test/dashboard-template.test.js`: definisi CSS primitif baru (`in-avatar`, `in-docdot`, `in-basum`, `in-proc`, `in-heat-legend`, `in-mcard`, `in-pageintro`) + marker markup penggunaan (mis. `in-statrow` di tab Pengajuan, `in-docdot`, `in-basum`).
- `npx vitest run test/dashboard-template.test.js` hijau.
- Full suite `npx vitest run` hijau (49 file).
- Verifikasi visual via preview (desktop + mobile) terhadap mockup.

## 8. Risiko

- Perubahan struktur tabel Pengajuan menyentuh banyak binding → risiko regresi; mitigasi: reviewer + tes template + verifikasi preview.
- Penghapusan kolom tidak boleh terjadi; kolom produksi yang tidak ada di mockup dipindahkan ke sel gabungan (Mahasiswa/Kegiatan/Berkas), bukan dihapus.
- Fidelitas pixel tak realistis (Tailwind vs mockup bespoke); target = kesan visual setara.
