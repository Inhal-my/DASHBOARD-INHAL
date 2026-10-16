# Desain: Drawer Detail Pengajuan (selaras `pengajuan-v2`)

Tanggal: 2026-10-16
Acuan visual: `mockups/pengajuan-v2/index.html`
Target: `new-code1-cf/public/dashboard.html`
Prinsip: **look mockup, fitur produksi tetap**

## 1. Tujuan

Mengganti modal detail pengajuan (modal tengah `max-w-4xl`) pada dashboard produksi menjadi **drawer kanan dengan stepper 3 langkah** (Identitas → Berkas → Keputusan), mengikuti `mockups/pengajuan-v2/index.html`. Perubahan bersifat **struktur visual**; perilaku, data, binding, nama method/field, dan teks produksi dipertahankan, hanya ditata ulang ke dalam langkah-langkah.

## 2. Non-tujuan

- Tidak menghapus atau mengubah kemampuan produksi (edit identitas, edit/hapus detail kegiatan, Kelola BA Pendukung, unggah Surat Keterangan, unggah + scan Bukti Bayar oleh admin, ubah status + catatan, quickStatus ACC/Tolak, email ACC Final, hapus pengajuan).
- Tidak menyentuh file lain (`src/**`, halaman portal, `detail-laporan.html`, dsb.).
- Tidak menambahkan status `Diterima` (tetap dihapus, sesuai Plan A).
- Tidak mengubah nama method/field/computed atau teks berbahasa Indonesia yang sudah ada.
- Fidelitas pixel tidak dikejar; target kesan visual setara dengan mockup.

## 3. Cakupan file

- Modify: `new-code1-cf/public/dashboard.html`
  - Blok `<style>` khusus (tambah primitif `pd-*`).
  - Markup modal detail (`v-if="detail.open"`, saat ini sekitar baris 1784–1999) diganti drawer + stepper.
  - State `detail` (tambah `step`).
  - Method `openDetail` (reset `step`), tambah method `setDetailStep`.
- Modify: `new-code1-cf/test/dashboard-template.test.js` (guard baru + penyesuaian asersi select status).

## 4. Lapisan visual (primitif `pd-*`)

Nilai CSS disalin dari mockup `mockups/pengajuan-v2/index.html` (baris CSS 187–266, 415–417), dengan prefix `pd-` untuk menghindari bentrok. Kelas `.label`, `.value`, `.input`, `.btn-soft`, `.btn-primary`, `.btn-acc`, `.btn-bukti`, `.btn-danger-soft`, `.link` yang sudah ada di produksi di-reuse.

| Primitif | Padanan mockup | Catatan nilai |
|---|---|---|
| `.pd-overlay` | `.drawer-overlay` | fixed inset-0, z-50, bg slate-900/45 + blur, opacity transition |
| `.pd-drawer` / `.pd-drawer.open` | `.drawer`/`.drawer.open` | fixed kanan, lebar 600px, bg `#f7f8fc`, flex kolom, translateX(105%) → 0 |
| `.pd-head`, `.pd-head-top` | `.dr-head`, `.dr-head-top` | bg putih, border bawah, padding 16px 20px 0 |
| `.pd-avatar` | `.dr-head .avatar` | 46px, radius penuh, warna dari hash nama |
| `.pd-id`, `.pd-close` | `.dr-id`, `.dr-close` | judul 16px/800 + meta 12px; tombol tutup 34px |
| `.pd-steps`, `.pd-step(.done/.active)` + `.n`/`.lbl` | `.steps`/`.step` | underline 2.5px, badge angka 22px |
| `.pd-body` | `.dr-body` | flex:1, overflow-y auto, padding 20px |
| `.pd-foot`, `.pd-spacer` | `.dr-foot`, `.spacer` | bg putih, border atas, padding 13px 20px |
| `.pd-card`, `.pd-card-head`, `.pd-card-body` | `.card`, `.card-head`, `.card-body` | radius 14px, shadow-soft, border var(--line) |
| `.pd-grid2`, `.pd-grid3` | `.grid2`, `.grid3` | grid 2/3 kolom |
| `.pd-keg`, `.pd-mini-ic` | `.keg-item`, `.mini-ic` | item detail kegiatan + tombol ikon |
| `.pd-doc-row`, `.pd-doc-ic(.surat/.acc/.bukti)` | `.doc-row`, `.doc-ic` | baris dokumen + ikon berwarna |
| `.pd-pill-ok`, `.pd-pill-no` | `.pill-ok`, `.pill-no` | badge Ada/Belum |
| `.pd-upzone` | `.upzone` | zona unggah putus-putus |
| `.pd-statuspick` (+ `.on`, `.ic`, `.t`, `.s`) | `.statuspick` | grid 2 kolom tombol status; varian warna tanpa `Diterima` |
| `.pd-email`, `.pd-manual-note` | `.email-box`, `.manual-note` | ringkasan email + catatan manual |

Responsive: pada `max-width: 768px`, `.pd-drawer` menjadi bottom-sheet (`top:auto; height:94vh; border-radius:20px 20px 0 0; transform:translateY(105%)`), dengan `.pd-drawer.open{transform:translateY(0)}`.

## 5. Struktur markup

Root: `<div v-if="detail.open" class="pd-overlay" @click="detail.open=false">` lalu `<aside class="pd-drawer" :class="{ open: detail.open }">`.

### 5.1 Head
- `.pd-head-top`: avatar (inisial nama via `pengajuanInitials`, warna via `pengajuanAvatarColor`), nama (`detail.p['Nama Lengkap']`) + `statusBadge(detail.p.Status)`, meta `NPM · Jenis Kegiatan · Blok · ID Pengajuan`, tombol tutup.
- `.pd-steps`: tiga `.pd-step` (data-step 0/1/2) dengan label **Identitas**, **Berkas**, **Keputusan**; klik memanggil `setDetailStep(n)`; kelas `active`/`done` dari `detail.step`.

### 5.2 Body
- `v-if="detail.loading"`: spinner "Memuat detail..." (dipertahankan).
- `v-else-if="detail.p"`:
  - **`detail.step === 0` (Identitas)**:
    - Kartu **Data Mahasiswa**: mode lihat (grid field sama seperti modal lama: NPM, Nama, Email, HP, Blok, Jenis, Tanggal Pelaksanaan, Tanggal Daftar, Biaya, Nomor Surat, Keterangan) + tombol **Edit**; mode edit (`detail.editInduk`) dengan input + `Simpan`/`Batal` (reuse `startEditInduk`, `saveIndukFields`, `cancelEditInduk`, `detail.iForm`, `biayaOptions`).
    - Kartu **Detail Kegiatan**: daftar `detail.p.details` sebagai `.pd-keg` (Pilihan, Detail, Jenis/Tanggal/Bagian) + tombol edit/hapus (reuse `startEditDetail`, `saveDetailRow`, `cancelEditDetail`, `deleteDetailRow`, `detail.editDetailIndex`, `detail.dEdit`).
    - Kartu **Berita Acara Pendukung**: tombol `openKelolaBaPendukung(detail.p['ID Pengajuan'])`.
  - **`detail.step === 1` (Berkas)**:
    - Bar progress jumlah dokumen tersedia `{surat, acc, bukti}` dari 3.
    - `.pd-doc-row` **Surat Keterangan**: bila `detail.p['Link Surat Keterangan']` → pill Ada + tautan; jika tidak → pill Belum + panel unggah (`onSuratFile`, `uploadSurat`, `detail.suratFile`, `detail.suratUploading`, `detail.suratError`).
    - `.pd-doc-row` **ACC INHAL**: read-only; bila `detail.p['Link ACC INHAL']` → pill Ada + tautan, tanpa unggah manual.
    - `.pd-doc-row` **Bukti Bayar**: pill Ada/Belum; panel unggah admin (`onBuktiFile`, `uploadBuktiBayar`, `detail.buktiFile`, `detail.buktiUploading`, `detail.buktiError`) + tombol Scan Kamera (`$refs.buktiCamera` → `scanOnPhotos($event,'bukti')`), thumbnail `detail.scanItems` dengan `scanMove`/`scanRemove`, tombol `scanBuildPdf('bukti')`/`scanClear('bukti')`, tautan "Lihat saat ini".
  - **`detail.step === 2` (Keputusan)**:
    - Catatan manual (`pd-manual-note`) bila `isManual(detail.p)`.
    - Kartu **Perbarui Status**: `.pd-statuspick` dengan 4 tombol (Menunggu, ACC, Ditolak, Dibatalkan — **tanpa Diterima**) yang mengeset `detail.status`; textarea catatan `v-model="detail.catatan"` (label "(wajib)" bila Ditolak/Dibatalkan); tombol utama `updateStatus()` + tombol `quickStatus('ACC')` ("Jadikan ACC") dan `quickStatus('Ditolak')` ("Tolak").
    - Kartu **Email ACC Final**: `sendFinalEmail()` (Kirim Ulang Email ACC Final) dan `sendAccFinalToBagian()` (Kirim Ulang Khusus ke Bagian) dengan syarat yang sama seperti produksi; catatan manual bila manual.
    - Kartu **Hapus** (danger): `deletePengajuan()`.

### 5.3 Foot
- step 0: `Tutup` (tutup) + `Lanjut ke Berkas` (`setDetailStep(1)`).
- step 1: `Kembali` (`setDetailStep(0)`) + `Lanjut ke Keputusan` (`setDetailStep(2)`).
- step 2: `Kembali` (`setDetailStep(1)`) + `Perbarui Status` (`updateStatus`).

## 6. State & method

- `detail` (data) tambah `step: 0`. Field lama dipertahankan apa adanya: `open, loading, p, suratFile, suratName, suratUploading, suratError, buktiFile, buktiUploading, buktiError, scanItems, scanBusy, scanSeq, status, catatan, editInduk, iForm, editDetailIndex, dEdit`.
- `openDetail(id)`: tetap seperti sekarang, ditambah `this.detail.step = 0` saat membuka.
- Method baru `setDetailStep(n)`: `this.detail.step = Math.max(0, Math.min(2, n))`.
- Seluruh method lama tidak berubah nama/perilaku: `startEditInduk`, `saveIndukFields`, `cancelEditInduk`, `startEditDetail`, `saveDetailRow`, `cancelEditDetail`, `deleteDetailRow`, `onSuratFile`, `uploadSurat`, `uploadBuktiBayar`, `onBuktiFile`, `scanOnPhotos`, `scanBuildPdf`, `scanClear`, `scanMove`, `scanRemove`, `openKelolaBaPendukung`, `updateStatus`, `quickStatus`, `sendFinalEmail`, `sendAccFinalToBagian`, `deletePengajuan`, `isManual`, `statusBadge`, `safeUrl`, `formatTanggal`, `formatTanggalWaktu`, `formatRupiah`.

## 7. Z-index

Drawer memakai `z-50` (setara modal lama). Modal **Kelola BA Pendukung** (`z-[120]`) tetap berada di atas drawer sehingga bisa terbuka dari step Identitas.

## 8. Pengujian

Guard baru di `test/dashboard-template.test.js` (pola `loadDashboardHtml()`):
- Primitif CSS tersedia: `.pd-drawer {`, `.pd-step {`, `.pd-doc-row {`, `.pd-statuspick {`, `.pd-card {`.
- Marker markup: `class="pd-drawer"`, `data-step="0"`/`"1"`/`"2"`, label `Identitas`/`Berkas`/`Keputusan`, `Lanjut ke Berkas`, `Lanjut ke Keputusan`.
- Fitur produksi tetap ada: `uploadBuktiBayar`, `onBuktiFile($event)`, `ref="buktiCamera"`, `scanOnPhotos($event, 'bukti')`, `scanBuildPdf('bukti')`, `scanClear('bukti')`, `openKelolaBaPendukung`, `updateStatus()`, `quickStatus('ACC')`, `sendFinalEmail()`, `sendAccFinalToBagian()`, `deletePengajuan()`, `Unggah Bukti Bayar (oleh Admin)`.
- Tidak ada `Diterima`: `expect(html).not.toContain('>Diterima<')` dan `not.toContain("'Diterima'")`.
- Compile Vue bersih (tes lama).
- Menyesuaikan asersi lama yang bergantung pada `<option>ACC</option>` / `<option>Menunggu</option>`: select status diganti `.pd-statuspick`, sehingga asersi diarahkan ke keberadaan `.pd-statuspick` beserta 4 status valid.

Verifikasi: `npx vitest run test/dashboard-template.test.js` dan `npm test` (seluruh suite) hijau; verifikasi visual preview desktop + mobile.

## 9. Risiko

- Penggantian markup besar menyentuh banyak binding → risiko regresi; mitigasi: tes template + verifikasi preview.
- Tumpukan z-index dengan modal lain → pastikan Kelola BA tetap di atas drawer.
- Bottom-sheet mobile perlu diuji agar tidak menutupi footer navigasi.

## 10. Catatan keputusan (terkunci)

- Bentuk: **drawer kanan + stepper 3 langkah** (persis mockup), dipilih pengguna.
- Cakupan fitur: **semua kemampuan produksi dipertahankan**, ditata ulang ke langkah.
- Status valid: `Menunggu`, `ACC`, `Ditolak`, `Dibatalkan` (tanpa `Diterima`).
- Prefix kelas baru: `pd-` (bukan `in-`) agar mudah dibedakan dari lapisan mockup sebelumnya dan menghindari bentrok.
