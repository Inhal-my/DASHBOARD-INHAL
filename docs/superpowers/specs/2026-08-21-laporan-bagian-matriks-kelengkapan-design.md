# Desain: Tab "Laporan Bagian" sebagai Matriks Kelengkapan BA

Tanggal: 2026-08-21
Status: Disetujui user (21 Agu 2026)

## Latar Belakang

Tab "Laporan Bagian" di dashboard saat ini menampilkan rekapitulasi peserta sebagai **grid kartu**: satu kartu per agregasi kegiatan (bagian, sumber Pengajuan/Berita Acara, jenis kegiatan, blok, tanggal, total peserta, link file BA), dengan filter Blok/Bagian/Sumber.

### Masalah

- Kartu menampilkan baris Pengajuan dan baris Berita Acara sebagai entri terpisah, sehingga sulit menjawab pertanyaan monitoring utama: **kegiatan mana yang sudah punya Berita Acara dan mana yang belum**.
- User ingin bentuk **tabel matriks** (baris = bagian, kolom = blok) yang fokus pada kelengkapan BA.

## Solusi

Ubah tab "Laporan Bagian" menjadi **matriks kelengkapan BA**. Matriks menggantikan grid kartu. Tidak ada perubahan server: data tetap berasal dari `getDashboardBootstrap` → `_computeBagianAggregation` (pendekatan A — matriks dihitung di frontend).

### 1. Data & Logika Kelengkapan

- **Inventaris kegiatan** = baris agregasi dengan `sumber === 'Pengajuan'` (kegiatan yang diusulkan dan wajib ber-BA).
- **Status BA** = baris agregasi dengan `sumber === 'Berita Acara'` (`_computeBagianAggregation` sudah memfilter `_baSumber(r) === 'Bagian'`, jadi hanya BA bagian yang masuk).
- Kegiatan dianggap **lengkap (ber-BA)** bila ada baris BA dengan kunci yang sama:
  `bagian + blok + jenisKegiatan` — **tanpa** tanggal (keputusan user: toleran terhadap selisih tanggal).
- Pencocokan kunci memakai normalisasi: trim, lower-case, dan penggabungan spasi (`norm` server / `normBagian` frontend).
- Setiap kegiatan muncul **satu kali** di matriks dengan status `✓ ber-BA` / `✗ belum ber-BA`. Sumber tidak ditampilkan sebagai entri terpisah.
- BA dashboard (`Sumber='Admin'`) **tidak** ikut menentukan kelengkapan di tab ini.
- **Penghitungan sel** (per bagian × blok):
  - `totalKegiatan` = banyaknya kegiatan unik dari baris **Pengajuan** (kunci `bagian+blok+jenisKegiatan` ternormalisasi, mengabaikan tanggal).
  - `sudahBA` = banyaknya kegiatan pengajuan tersebut yang memiliki **minimal satu** baris BA dengan kunci yang sama. Baris BA tidak dihitung sebagai kegiatan tersendiri; hanya berfungsi sebagai penanda "lengkap".
  - Jika ada baris BA tanpa baris Pengajuan yang cocok (mis. selisih penamaan), baris BA tersebut tidak memengaruhi `totalKegiatan` maupun `sudahBA`.

### 2. Struktur Matriks

- **Baris** = bagian, urut mengikuti `_getBagianOptions12(labs)`: Ujian, SGD, KKD, lalu daftar lab.
- **Kolom** = blok, diambil dari kegiatan yang ada (urut naik).
- **Sel** (bagian × blok) menampilkan fraksi `sudahBA / totalKegiatan` (mis. `2/3`):
  - **Hijau** bila `sudahBA === totalKegiatan` (semua lengkap).
  - **Kuning** bila `sudahBA > 0` (sebagian).
  - **Merah** bila `sudahBA === 0` (belum ada sama sekali).
  - Sel kosong (tidak ada kegiatan) ditampilkan sebagai `–`.
- **Total per baris** di kolom paling kanan (agregasi seluruh blok untuk bagian itu).
- **Total per kolom** di baris paling bawah (agregasi seluruh bagian untuk blok itu).
- Header baris & kolom **sticky** saat scroll.
- Kegiatan yang belum ber-BA **tetap muncul** (ditandai merah/kuning) — ini keputusan final user; tab tetap berfungsi sebagai monitor kekurangan.

### 3. Filter

- Pertahankan filter **Blok** dan **Bagian** (dropdown, menyempitkan kolom/blok dan baris/bagian pada matriks).
- **Hapus** filter **Sumber** — sumber dipakai internal, tidak ditampilkan.

### 4. Interaksi: Panel Rincian

- Klik sel matriks → muncul **panel inline di bawah matriks** berisi daftar kegiatan untuk sel itu. Matriks tetap terlihat.
- Klik sel lain → isi panel berganti. Ada cara menutup panel.
- Isi daftar kegiatan per sel:
  - Nama kegiatan (jenis kegiatan), blok, tanggal pelaksanaan.
  - Status: `✓ Berita Acara ada` (dengan link file) atau `✗ Belum ada BA`.
  - Jumlah peserta (dari pengajuan; dari BA bila ada).
- Panel menampilkan kegiatan sesuai filter Blok/Bagian yang sedang aktif (sel yang diklik pasti sudah dalam cakupan filter).

### 5. Lingkup File

- **Diubah:** `new-code1/pages/dashboard.html` saja — section `TAB: LAPORAN BAGIAN`, data/computed (baru), methods (baru), penghapusan filter Sumber.
- **Tidak diubah:** `0_code.gs`, `1_business.gs`, `bagian.html`, `detail-laporan.html`, halaman lain.
- Computed baru (contoh): `bagianMatrix` (baris/kolom/sel + status), `bagianCellDetail` (daftar kegiatan sel aktif), `bagianCols`, `bagianRowTotals`, `bagianColTotals`.
- Methods baru: `openBagianCell(bagian, blok)`, `closeBagianDetail()`.
- Filter: `applyBagianFilter` dimutakhirkan (tanpa `fSumber`), `fBlok`/`fBagian` tetap.

## Pengujian

### Verifikasi Sintaks

```bash
python3 - <<'PY'
import re
html = open('new-code1/pages/dashboard.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/dashboard_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/check/dashboard_inline.js
```

Expected: exit 0 tanpa output.

### Pengujian Manual (setelah deploy)

1. Login dashboard → tab **Laporan Bagian** → matriks tampil (baris bagian × kolom blok).
2. Verifikasi sel: warna hijau (semua ber-BA), kuning (sebagian), merah (belum), `–` (kosong).
3. Klik sel → panel rincian di bawah berisi daftar kegiatan dengan status ✓/✗, jumlah peserta, dan link file untuk yang ber-BA.
4. Set filter Blok & Bagian → matriks menyempit; filter Sumber sudah tidak ada.
5. Bandingkan dengan data sheet: jumlah `sudahBA/totalKegiatan` di sel sesuai hitungan baris agregasi Pengajuan vs Berita Acara.
