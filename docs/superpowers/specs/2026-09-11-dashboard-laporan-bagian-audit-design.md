# Desain: Tab "Laporan Bagian" sebagai Audit Kelengkapan BA per Kegiatan (`new-code1-cf/public/dashboard.html`)

Tanggal: 2026-09-11
Status: Disetujui user (11 Sep 2026)

## Latar Belakang

Tab **Laporan Bagian** saat ini berupa **matriks `bagian x blok`** (sel `sudahBA/totalKegiatan` berwarna, klik sel membuka daftar kegiatan). Desain itu ditetapkan di spec `2026-08-21-laporan-bagian-matriks-kelengkapan-design.md`.

Masalah yang ditemukan saat investigasi (kode + data produksi: 14 baris = 9 pengajuan, 5 BA):

1. **Dua sumber BA terpisah.** BA dari Panel Bagian tersimpan di `berita_acara` (+`berita_acara_peserta`, `sumber='Bagian'`); BA yang diunggah admin lewat dashboard tersimpan di `berita_acara_admin` (+`berita_acara_admin_peserta`, `sumber='Admin'`). `getBagianAggregation` hanya membaca `berita_acara`, sehingga BA admin tidak pernah dihitung.
2. **Pencocokan berbasis teks rapuh.** BA dicocokkan ke pengajuan lewat kunci `bagian|blok|nama kegiatan`. `nama_kegiatan` BA berasal dari input bebas admin ("Anatomi — Remediasi", em-dash), sedangkan pengajuan memakai `"Pilihan - Detail"` (hyphen). Akibatnya 2 BA menjadi "orphan" dan hanya 3/9 pengajuan terdeteksi punya BA.
3. **Ada data NPM peserta** di `berita_acara_peserta`/`berita_acara_admin_peserta` — kunci pencocokan yang jauh lebih akurat daripada nama.
4. **Unit tercampur.** Sel `done/total` menghitung peserta, tetapi panel rinciannya menampilkan kegiatan.
5. BA tanpa pengajuan tidak pernah tampil (tersembunyi), dan bila blok banyak matriks melebar serta tidak ada pencarian/sort/ringkasan.

User ingin tab ini dirancang ulang lebih profesional, akurat, dan informatif, dengan fokus **audit per kegiatan**.

## Catatan Supersede

Spec ini menggantikan bagian yang relevan dari `2026-08-21-laporan-bagian-matriks-kelengkapan-design.md`:

- Baris 27 ("BA dashboard `Sumber='Admin'` **tidak** ikut menentukan kelengkapan") **diganti**: BA dari **kedua sumber** dihitung, dengan label sumber yang jelas.
- Baris 31 ("baris BA tanpa Pengajuan tidak memengaruhi apa pun") **diganti**: BA tanpa kegiatan pasangan tetap **ditampilkan** sebagai baris `BA tanpa pengajuan`.
- Keputusan baris 23-24 (**pencocokan mengabaikan tanggal**, toleran selisih tanggal) **dipertahankan**, dan diperkuat dengan pencocokan berbasis NPM peserta sebagai metode utama.

## Keputusan User (11 Sep 2026)

1. Arah desain: **C (hybrid)** — ringkasan + peta kelengkapan + tabel audit. **Disetujui.**
2. Fokus halaman: **audit per kegiatan** (rinci). **Disetujui.**
3. Sumber BA: **Bagian + Admin keduanya dihitung dan dibedakan** (badge/kolom sumber, filter sumber, dua metrik terpisah). **Disetujui.**
4. Ekspor: **Excel (`.xlsx`)**, bukan CSV. **Disetujui.**

## Desain

### Zona 1 — Ringkasan (mengikuti filter aktif)

Kartu-kartu berikut dihitung dari `units` yang lolos filter (Bagian, Blok, Sumber BA, Status BA, Status Final, pencarian). Baris `orphanBa` tidak dihitung di kartu:

| Kartu | Nilai |
|---|---|
| Total Kegiatan | jumlah `units` |
| Total Peserta | jumlah NPM unik pada seluruh `units` terfilter |
| Punya BA (semua sumber) | jumlah `units` yang punya minimal satu BA; ditampilkan `n/total` + persen |
| BA oleh Bagian | jumlah `units` yang punya BA bersumber `Bagian` |
| BA oleh Admin | jumlah `units` yang punya BA bersumber `Admin` |
| Belum BA | jumlah `units` tanpa BA |
| ACC Final | jumlah `units` dengan `linkFinal` terisi |

Gaya konsisten dengan kartu statistik tab Berita Acara (`shadow-soft ring-1 ring-slate-100`, ikon + angka besar + label).

### Zona 2 — Peta kelengkapan

- **Bar horizontal per bagian**: nama bagian, jumlah kegiatan, persen lengkap (`punya BA / total`), warna jelas (hijau/kuning/merah mengikuti rasio). Klik bar memfilter tabel ke bagian tersebut.
- **Heatmap ringkas `bagian x blok`**: sel = `ada BA / total kegiatan` pada irisan itu; klik sel memfilter tabel. Menggantikan matriks besar lama. Sel kosong ditandai `–`.

### Zona 3 — Tabel audit per kegiatan (inti)

Toolbar/filter:
- Dropdown **Bagian**, dropdown **Blok**, dropdown **Sumber BA** (`Semua` / `Bagian` / `Admin`), dropdown **Status BA** (`Semua` / `Ada` / `Belum`), dropdown **Status Final** (`Semua` / `Ada` / `Belum`).
- Input **Cari** (kegiatan, bagian, blok, BA ID, NPM, nama peserta).
- Toggle **Hanya yang belum lengkap** (menampilkan unit tanpa BA).
- Tombol **Reset** filter.
- Tombol **Ekspor Excel**.
- Teks "Menampilkan X dari Y kegiatan".

Kolom tabel (desktop, `md` ke atas):

| Kolom | Isi | Sortir |
|---|---|---|
| Tanggal | tanggal pelaksanaan unit (bila beberapa, tampilkan terurut / "n sesi") | ya |
| Bagian | badge `bagian` | ya |
| Blok | `blok` | ya |
| Kegiatan | `pilihan - detail` | ya |
| Peserta | jumlah peserta; klik untuk expand daftar | ya |
| BA | badge **Ada**/**Belum**; bila ada: BA ID, badge sumber **Bagian**/**Admin**, dan link file | ya (status) |
| ACC Final | badge **Ada**/**Belum** + link final | ya (status) |
| Aksi | link **Lihat BA** (bila ada) + link **Lihat Final** (bila ada) | - |

- Header sticky, hover baris, zebra, kolom pertama sticky saat scroll horizontal.
- Default urutan: Tanggal terbaru di atas.
- Empty state dan loading state dipertahankan.

Baris expand (accordion): daftar peserta (`NPM`, nama, blok, status pengajuan) + rincian setiap BA yang cocok (BA ID, sumber, catatan, waktu unggah, link file) + link final. Beberapa baris boleh terbuka bersamaan (pola `toggleBaExpand` di tab Berita Acara).

Baris **BA tanpa pengajuan** ditampilkan dengan penanda khusus (mis. badge merah "BA tanpa pengajuan"), menampilkan bagian, blok, nama kegiatan, tanggal, peserta BA, sumber, dan link file. Baris ini diletakkan di akhir tabel, tidak dihitung di ringkasan, disembunyikan saat toggle "Hanya yang belum lengkap" aktif, dan tetap disertakan pada ekspor Excel dengan penanda.

### Ekspor Excel

- Menambah **SheetJS (`xlsx`)** dari CDN jsDelivr (dashboard sudah memakai CDN untuk Vue dan bootstrap-icons).
- Ekspor menghasilkan `.xlsx` berisi seluruh baris hasil filter saat itu, dengan kolom: Tanggal, Bagian, Blok, Kegiatan, Jumlah Peserta, Status BA, Sumber BA, BA ID, Link File BA, Status Final, Link Final.
- Nama file: `laporan-bagian-YYYY-MM-DD.xlsx`.

### Tampilan HP (di bawah `md`)

- Tabel diganti daftar kartu ringkas per kegiatan (Kegiatan, Tanggal, Bagian, Blok, Peserta, badge BA + sumber, badge final, tombol expand).
- Kartu ringkasan dan peta kelengkapan tetap tampil (grid menyesuaikan).

## Model Data Backend

`getBagianAggregation` (`src/read/dashboard.js:149`) diperluas untuk mengembalikan struktur berikut (tetap satu RPC, hanya dipakai tab ini):

- `summary`: `{ totalKegiatan, totalPeserta, denganBa, denganBaBagian, denganBaAdmin, belumBa, finalAcc, persenLengkap }`.
- `units[]`: satu entri per kegiatan, berisi:
  - `key` (kunci normalisasi `bagian|blok|kegiatan`),
  - `bagian`, `blok`, `pilihan`, `detail`, `label`, `tanggalList`,
  - `peserta[]` (`npm`, `namaLengkap`, `blok`, `statusPengajuan`),
  - `jumlahPeserta`, `pesertaDenganBa` (jumlah NPM yang tercakup BA),
  - `ba[]` (`baId`, `sumber` `'Bagian'`/`'Admin'`, `fileUrl`, `fileName`, `catatan`, `timestamp`, `tanggal`),
  - `linkFinal`, `statusBa` (`ada`/`belum`), `statusFinal` (`ada`/`belum`).
- `orphanBa[]`: BA tanpa unit kegiatan pasangan (struktur serupa `ba` + bagian/blok/kegiatan/tanggal/peserta).
- `filters`: `{ bagian: [...], blok: [...], sumber: ['Bagian','Admin'] }`.

### Aturan Akurasi

1. **Sumber BA digabung**: baca `berita_acara` + `berita_acara_peserta` (Bagian) dan `berita_acara_admin` + `berita_acara_admin_peserta` (Admin).
2. **Pencocokan utama via NPM peserta**: BA dianggap cocok dengan unit bila ada irisan NPM peserta BA dengan NPM unit pada `bagian` + `blok` yang sama. Mengabaikan tanggal (sesuai keputusan 2026-08-21).
3. **Fallback**: bila tidak ada irisan NPM, cocokkan dengan normalisasi teks `bagian + blok + kegiatan` (ubah em-dash/en-dash `—`/`–` menjadi hyphen `-`, rapikan spasi, samakan huruf besar-kecil), tanpa tanggal.
4. **Dedup**: BA dianggap sama bila `bagian + blok + kegiatan + tanggal + file_url` identik; satu unit boleh punya lebih dari satu BA dan sumbernya ditandai.
5. `totalKegiatan` hanya dihitung dari kegiatan pengajuan (unit), bukan dari BA. BA tanpa pasangan masuk `orphanBa[]` dan tidak mengubah `totalKegiatan`.
6. `persenLengkap = denganBa / totalKegiatan` (0 bila `totalKegiatan` 0).
7. Unit didefinisikan tanpa tanggal; bila satu kegiatan punya beberapa tanggal, semua tanggal dikumpulkan di `tanggalList` dan ditampilkan (mis. "n sesi").
8. `statusBa` bernilai `ada` bila unit punya minimal satu BA cocok (via NPM atau fallback teks); `pesertaDenganBa` = jumlah NPM unit yang tercakup salah satu BA cocok. `statusFinal` bernilai `ada` bila `linkFinal` tidak kosong.

## Frontend

- Mengganti isi section `TAB: LAPORAN BAGIAN` (`dashboard.html:442-543`) mengikuti pola tab Berita Acara.
- Menghapus computed `bagianMatrix`/`bagianCellDetail`/`bagianMatrixCols` dan method `openBagianCell`/`closeBagianDetail`/`matrixCellClass` yang tidak lagi dipakai.
- Computed baru: `bagianUnits` (filter + sort + search), `bagianSummary`, `bagianBar` (per bagian), `bagianHeatmap` (bagian x blok), `bagianOrphanBa`.
- Method baru: `applyBagianFilter` (diperluas sumber/status), `toggleBagianExpand`, `exportBagianExcel`, `resetBagianFilter`, `openBagianFromBar`, `openBagianFromCell`.
- State `bagian` diperluas: `fSumber`, `fStatusBa`, `fStatusFinal`, `q`, `onlyIncomplete`, `sortKey`, `sortDir`, `expanded`, `summary`, `units`, `orphanBa`.
- CSS utilitas ditambah manual di blok `<style>` dashboard (tanpa langkah build Tailwind); manfaatkan class `shadow-soft`, `ring-slate-100`, `btn-*`, dan badge pola tab BA.
- Menambah `<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>`.

## Batasan

- **Tidak ada perubahan skema DB.**
- Backend yang berubah hanya `src/read/dashboard.js` (fungsi `getBagianAggregation`) dan, bila perlu, helper di `src/read/common.js`.
- Frontend yang berubah hanya `new-code1-cf/public/dashboard.html`.
- Tab lain dan RPC lain tidak terpengaruh.
- Tidak menambah komentar pada kode tanpa diminta.

## Pengujian

Unit test worker (`test/read-dashboard.test.js` atau file baru):

1. Pencocokan BA↔unit via irisan NPM pada bagian+blok yang sama.
2. Fallback normalisasi teks (em-dash vs hyphen) saat NPM tidak tersedia.
3. Deteksi `orphanBa` (BA tanpa unit pasangan) dan tidak memengaruhi `totalKegiatan`.
4. Dedup BA identik; satu unit dengan dua BA dari sumber berbeda (Bagian + Admin).
5. Metrik `summary`: `denganBa`, `denganBaBagian`, `denganBaAdmin`, `belumBa`, `finalAcc`, `persenLengkap`.

Uji manual setelah deploy:

1. Tab Laporan Bagian tampil: kartu ringkasan, bar per bagian, heatmap, tabel audit.
2. Filter Bagian/Blok/Sumber/Status BA/Status Final + pencarian + toggle "hanya belum lengkap" + Reset.
3. Expand baris peserta dan rincian BA; baris "BA tanpa pengajuan" tampil dengan penanda.
4. Ekspor Excel menghasilkan `.xlsx` sesuai baris terfilter.
5. Bandingkan angka `punya BA` dan `BA oleh Bagian` dengan data nyata.
