# Desain: Laporan Detail v2 — Tiga Halaman (Ringkas / Analitis / Cetak)

Tanggal: 2026-10-17
Status: disetujui konsep, diimplementasikan

## Tujuan

Menata ulang `new-code1-cf/public/detail-laporan.html` mengikuti **Konsep 02** pada `mockups/laporan-detail/02-tiga-halaman.html`:

- Tiga halaman mandiri yang dapat dipilih lewat tab tingkat halaman: **Ringkas**, **Analitis**, dan **Cetak**.
- **Ringkas** menjawab "bagaimana kondisi laporan secara umum" dalam satu layar: KPI pokok, kegiatan terbaru, distribusi status, dan tindakan yang perlu diambil.
- **Analitis** memuat seluruh kemampuan analisis yang sudah ada (7 tab lama) tanpa menghilangkan fitur.
- **Cetak** menghasilkan dokumen formal siap cetak A4 dari data yang sama, dengan kontrol isi dokumen.

Referensi visual: `mockups/laporan-detail/02-tiga-halaman.html`.

## Non-Goals

- Tidak mengubah backend, RPC, skema, atau migrasi. Data tetap berasal dari `getLaporanBootstrap`.
- Tidak mengubah login, sidebar, topbar, bottom nav, atau halaman lain.
- Tidak menghapus tab analitis lama: `rekap`, `dosen`, `bagian`, `ba`, `daftarba`, `jadwal`, `bayar`.
- Tidak menambah dependensi baru.
- Tidak mengubah format export `.xlsx` yang sudah ada.

## Constraints

- Produksi berjalan; perubahan terbatas pada `new-code1-cf/public/detail-laporan.html` dan test.
- Semua fitur lama harus tetap dapat diakses: filter global, pencarian, export xlsx, kelola BA, riwayat, matriks dosen/bagian, pembayaran.
- Semua test dijalankan dari `new-code1-cf/` dengan `npx vitest run test/detail-laporan-template.test.js`.
- Bahasa desain: Plus Jakarta Sans via Tailwind yang sudah ada, indigo `#4f46e5`, kartu `rounded-2xl`/`lap-card`, primitif `in-*` yang sudah dipakai.
- Tidak ada angka rekaan. Semua KPI dan tindakan dihitung dari data yang sudah dimuat.

---

## A. Navigasi Halaman

Tiga tombol mode di atas konten:

```
Ringkas | Analitis | Cetak
```

- State baru: `laporanMode` dengan nilai `'ringkas' | 'analitis' | 'cetak'`, default `'ringkas'`.
- Tombol memanggil `switchLaporanMode(mode)`: mengubah state, menyimpan mode ke query string (`?mode=analitis`), dan menggulir ke atas.
- Saat halaman dimuat, mode dibaca dari query string; nilai tidak dikenal jatuh ke `ringkas`.
- Mode tidak mengubah `activeTab` analitis. Pengguna kembali ke tab analitis terakhir saat berpindah mode.
- Judul topbar mengikuti mode (`Ringkasan Laporan`, `Analisis Laporan`, `Cetak Laporan`), bukan label tab analitis.

Filter global (desktop dan mobile) tetap satu sumber kebenaran dan **tampil pada mode Analitis dan Cetak**, disembunyikan pada Ringkas. Tombol "Ubah filter" di Ringkas berpindah ke Analitis.

## B. Ringkas

Struktur:

1. Header halaman: judul, periode aktif, tombol "Ubah filter" dan "Ekspor .xlsx".
2. Callout kecil: Ringkas hanya memuat agregat pokok.
3. Empat KPI:
   - **Kegiatan** — jumlah kegiatan hasil filter.
   - **Peserta** — jumlah pendaftar hasil filter.
   - **Honor** — total biaya hasil filter.
   - **Berkas lengkap** — persentase kegiatan yang seluruh pesertanya sudah punya bukti bayar.
4. Grid dua kolom (desktop): tabel **Kegiatan terbaru** (6 kegiatan, urut tanggal terbaru) + kolom kanan berisi donut **Distribusi Status** dan kartu **Tindakan**.
5. Di mobile, semua menumpuk satu kolom; tabel menjadi kartu ringkas.

Sumber data:

- `ringkasKegiatanAll` = `bagianKegiatanAll` yang difilter oleh `filters` global (blok, tanggal, status, pencarian). Setiap item membawa `nama`, `tanggal`, `bagian`, `blok`, `peserta`, `biaya`, `berkasLengkap`, `status`, `sumber`.
- Status kegiatan = status peserta dominan; jika seri, prioritas `Menunggu > ACC > Ditolak > Dibatalkan`.
- `ringkasStats` dihitung dari `ringkasKegiatanAll` dan `filteredRows`.
- `ringkasRecent` = 6 item terbaru berdasarkan tanggal.
- `ringkasTindakan`:
  - jumlah pengajuan berstatus Menunggu,
  - jumlah kegiatan yang belum punya BA (`sumber !== 'BA'`),
  - total biaya pengajuan yang masih Menunggu.

## C. Analitis

- Judul halaman + filter global + tab switcher lama (7 tab) tetap seperti sekarang.
- Seluruh markup tab lama dipindahkan ke dalam panel `laporanMode === 'analitis'` tanpa perubahan perilaku.
- Tab default tetap `rekap`.
- Tidak ada duplikasi query data; semua computed lama tetap dipakai.

## D. Cetak

Struktur:

1. Header halaman + tombol "Cetak" (memanggil `window.print()`) dan "Unduh .xlsx".
2. Kartu **Pengaturan dokumen**:
   - Jenis laporan: `Rekap & rincian`, `Rekap saja`, `Rincian saja`.
   - Lampiran: kop laboratorium, tanda tangan (checkbox).
3. Kartu **Sebelum mencetak**: periode, jumlah kegiatan/peserta, peringatan kegiatan belum final dan berkas belum lengkap — semuanya dari data terfilter.
4. **Lembar cetak** (`print-sheet`) dengan:
   - kop laboratorium (opsional),
   - judul "Laporan Pelaksanaan Praktikum" dan subjudul semester,
   - meta: periode, blok, status, waktu cetak,
   - A. Ringkasan (4 kotak: kegiatan, peserta, honor, berkas lengkap),
   - B. Rekapitulasi per Blok (kegiatan, peserta, honor, berkas lengkap),
   - C. Rincian Kegiatan (nama, tanggal, bagian, blok, dosen, peserta, status, berkas),
   - tanda tangan (opsional),
   - footer dokumen.

Aturan cetak:

- `@media print` menyembunyikan sidebar, topbar, filter, tab mode, dan semua elemen `.no-print`.
- Hanya `print-sheet` yang terlihat; `@page { size: A4; margin: 14mm; }`.
- Baris tabel tidak terpotong antar halaman (`break-inside: avoid`).
- Data cetak mengikuti filter global dan `cetak.jenis`.

## E. Perubahan Data & Computed

State baru:

```js
laporanMode: 'ringkas',
cetak: { jenis: 'lengkap', kop: true, ttd: true }
```

Computed baru:

- `modeTitle`, `modeSubtitle`
- `ringkasKegiatanAll`, `ringkasRecent`, `ringkasStats`, `ringkasTindakan`, `ringkasByBlok`
- `cetakMeta`, `cetakRingkasan`, `cetakRekapBlok`, `cetakRincian`

Method baru:

- `switchLaporanMode(mode)`
- `printLaporan()`

## F. Test

Tambahan pada `test/detail-laporan-template.test.js`:

- State dan method mode tersedia (`laporanMode`, `switchLaporanMode`, `printLaporan`).
- Label `Ringkas`, `Analitis`, `Cetak` ada dan tab lama tetap ada.
- Ringkas memakai `ringkasStats`, `ringkasRecent`, `ringkasTindakan`.
- Lembar cetak memakai `print-sheet`, `cetak.jenis`, dan aturan `@media print`.
- Semua assertion lama tetap lulus.

## G. Risiko

- **Duplikasi judul**: mode header + `in-pageintro` tab analitis. Dijaga singkat agar tidak berulang.
- **Data kosong**: semua KPI dan tabel harus punya empty state, bukan `NaN`/`undefined`.
- **Filter tidak konsisten**: Ringkas memakai filter global yang sama dengan Analitis; tidak ada filter terpisah.
- **Cetak di mobile**: tabel rincian bisa sempit; gunakan font cetak kecil dan `table-layout: fixed` dengan lebar kolom eksplisit.
