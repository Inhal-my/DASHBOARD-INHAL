# Desain: Tab "Laporan Dosen" sebagai Matriks Jumlah BA per Dosen & Bagian

Tanggal: 2026-08-22
Status: Disetujui user (22 Agu 2026)

## Latar Belakang

Tab "Laporan Dosen" di `detail-laporan.html` saat ini menampilkan **daftar dosen yang bisa diperluas**, masing-masing berisi tabel pengajuan mahasiswa (NPM, jenis kegiatan, blok, tanggal, status, biaya).

### Masalah

- Tampilan tidak menjawab pertanyaan monitoring utama: **berapa Berita Acara (BA) yang sudah diunggah per dosen, per bagian**.
- User ingin tab ini diubah menjadi **tabel matriks**: baris = dosen, kolom = bagian, isi sel = jumlah BA (dari bagian, bukan dari dashboard/admin).
- User juga ingin total per baris/kolom dan berbagai filter (Blok, Bagian, Cari Dosen, Jenis Kegiatan, Rentang Tanggal).

## Solusi

Ubah tab "Laporan Dosen" menjadi **matriks jumlah BA per dosen & bagian**. Tampilan lama (daftar pengajuan per dosen) **dihapus total** dari tab ini. Tidak ada perubahan server: data tetap berasal dari `getLaporanBootstrap` (pendekatan A — matriks dihitung di frontend, konsisten dengan tab Laporan Bagian).

### 1. Sumber Data & Logika Atribusi BA → Dosen

**Sumber data (sudah tersedia di klien):**

- `beritaAcara` — array BA **dari bagian saja** (`getLaporanBootstrap` sudah memfilter `_baSumber(r) === 'Bagian'`). Tiap item punya:
  - `peserta[]` berisi `npm`, `namaLengkap`, `blok`.
  - `Bagian`, `Blok`, `Nama Kegiatan`, `Tanggal Pelaksanaan`, `Jumlah Peserta`, `File URL`.
- `rows` — daftar pengajuan; tiap `r.pengajuan` punya `NPM`, `Dosen`, `Blok`, `Jenis Kegiatan`, `Tanggal Pelaksanaan`.

**Join & atribusi (keputusan user: "via peserta BA"):**

1. Bangun peta `NPM → dosen` dari `rows`. Karena satu NPM bisa punya beberapa pengajuan, pencocokan dilakukan dengan urutan prioritas:
   - Cocokkan NPM **dan** Blok BA-nya ke pengajuan (blok sama).
   - Jika tidak ada yang cocok, ambil pengajuan pertama dengan NPM tersebut.
2. Untuk setiap BA: iterasi `b.peserta`, resolve dosen tiap peserta, kumpulkan dosen yang muncul (**dedupe per BA**).
3. **Satu BA dihitung untuk setiap dosen yang mahasiswanya ada di BA itu** — sesuai keputusan user.
4. Kolom "Bagian" di-resolve dengan `resolveBagianLabel(b.Bagian, '', b['Nama Kegiatan'])` — fungsi yang sama dengan tab Laporan Bagian, sehingga label kolom konsisten (Ujian/SGD/KKD/Lab, plus "Lainnya" jika ada).

**Aturan hitung:**

- Sel `(dosen, bagian)` = jumlah **dokumen BA unik** (BA ID) yang terkait dosen itu pada bagian itu.
- Total baris = jumlah BA per dosen (seluruh bagian).
- Total kolom = jumlah BA per bagian (seluruh dosen).
- Grand total = seluruh BA yang masuk (dalam cakupan filter).
- Satu BA boleh dihitung untuk beberapa dosen (via peserta), tapi **dihitung sekali per dosen** (dedupe BA ID per dosen).

### 2. Struktur Matriks

- **Baris** = dosen, urut alfabetis. **Hanya dosen dengan ≥1 BA** (dalam cakupan filter) yang muncul — keputusan user: sembunyikan dosen tanpa BA.
- **Kolom** = bagian (`bagianAllLabels`: Ujian, SGD, KKD, Lab, plus "Lainnya" bila ada). Kolom pertama sticky berisi nama dosen.
- **Sel** = angka jumlah BA (atau `0` pudar untuk sel kosong, non-clickable).

**Baris & kolom total:**

- Baris terakhir **Total**: jumlah per kolom bagian (dijumlahkan semua dosen).
- Kolom terakhir **Total**: jumlah per dosen (semua bagian).
- Pojok kanan-bawah: **grand total**.

**Penanda visual (premium):**

- Avatar ikon + gradient untuk dosen (konsisten dengan gaya avatar yang ada).
- Sel berangka diberi tint warna `brand` dan bisa diklik; sel `0` berwarna pudar (`text-slate-200`), non-clickable.
- Sel aktif ditandai `bg-brand-600 text-white` + ring (pola sama dengan `activeMatrixCell` di tab Laporan Bagian).
- Zebra striping baris; header kiri sticky saat scroll horizontal.

**Header kartu:**

- Judul "Rekap Berita Acara per Dosen & Bagian".
- Baris info ringkas: `X dosen` · `Y bagian` · `Z BA total` (chip, pola tab Laporan Bagian).
- Tombol kecil **Export XLSX** di header untuk mengunduh matriks + total (reuse SheetJS yang sudah dipakai di export tab lain).

### 3. Filter

Panel filter di atas matriks, konsisten dengan pola tab Laporan Bagian:

- **Blok** — dropdown dari `this.blok`; memfilter BA berdasarkan `b.Blok`.
- **Jenis Kegiatan** — dropdown dari nilai `Jenis Kegiatan` yang ada di data (Ujian/SGD/KKD/Praktikum); BA lolos jika **minimal satu** peserta-nya punya jenis kegiatan tersebut.
- **Rentang Tanggal** — `from`/`to`; memfilter berdasarkan `Tanggal Pelaksanaan` BA.
- **Bagian** — dropdown; jika dipilih, matriks hanya menampilkan kolom bagian itu (filter kolom).
- **Cari Dosen** — input teks; memfilter baris dosen berdasarkan nama.

Semua filter **komposable** (bisa dikombinasikan). Dosen yang ditampilkan dihitung ulang setelah filter; yang muncul hanya yang masih punya BA dalam cakupan filter.

### 4. Interaksi: Panel Detail BA

- Klik angka pada sel → **panel detail BA** muncul **di bawah tabel** (dalam kartu yang sama), menampilkan daftar BA untuk `(dosen, bagian)` tersebut:
  - `Nama Kegiatan`, `Tanggal Pelaksanaan`, `Jumlah Peserta`, link `File URL`.
- Klik sel lain → isi panel berganti. Ada tombol **Reset** untuk menutup panel (pola `activeMatrixCell` + `filterByMatrixCell` di tab Laporan Bagian).
- Header panel detail menunjukkan konteks: `Dosen: <nama> · Bagian: <bagian>`.

### 5. Lingkup File

- **Diubah:** `new-code1/pages/detail-laporan.html` saja — section `TAB: LAPORAN DOSEN` diganti total, plus data/computed/methods baru.
- **Tidak diubah:** `0_code.gs`, `1_business.gs`, `dashboard.html`, `bagian.html`, halaman lain.

Komponen baru (frontend-only):

- Computed: `dosenMatrix` (baris/kolom/sel + total), `dosenMatrixCols` (label kolom bagian), `dosenMatrixRows` (baris dosen + counts), `dosenColTotal(bagian)`, `dosenRowTotal`, `dosenGrandTotal`, `dosenCellDetail` (daftar BA sel aktif), `dosenFilterState`.
- Data state: `dosenFilter` (`{ blok, jenis, from, to, bagian, q }`), `activeDosenCell` (`{ dosen, bagian, key }`).
- Methods: `openDosenCell(dosen, bagian)`, `closeDosenDetail()`, `resetDosenCell()`, `exportDosenMatrix()`, helper resolve NPM→dosen.
- Filter menggunakan **state tersendiri** `dosenFilter` (bukan `filters` global) agar pemilihan filter di tab ini tidak saling memengaruhi tab lain.

## Pengujian

### Verifikasi Sintaks

```bash
python3 - <<'PY'
import re
html = open('new-code1/pages/detail-laporan.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/detail_laporan_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/check/detail_laporan_inline.js
```

Expected: exit 0 tanpa output.

### Pengujian Manual (setelah deploy)

1. Login dashboard → tab **Laporan Dosen** → matriks tampil (baris dosen × kolom bagian) dengan total per baris/kolom dan grand total.
2. Verifikasi atribusi: satu BA dengan peserta dari 2 dosen dihitung untuk kedua dosen; BA dihitung sekali per dosen.
3. Klik sel → panel detail BA di bawah berisi daftar BA (nama kegiatan, tanggal, jumlah peserta, link file).
4. Uji tiap filter: Blok, Jenis Kegiatan, Rentang Tanggal, Bagian (menyempitkan kolom), Cari Dosen; kombinasi filter bekerja.
5. Dosen tanpa BA dalam cakupan filter tidak muncul.
6. Tombol Export XLSX mengunduh matriks + total dengan benar.
7. Tab lain (Rekap, Laporan Bagian, Berita Acara) tetap berfungsi normal.
