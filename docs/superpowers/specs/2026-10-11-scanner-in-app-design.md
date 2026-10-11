# Desain: Scanner In-App (Live Kamera + Deteksi Tepi Dokumen)

Tanggal: 2026-10-11
Status: Disetujui (menunggu review spec)
Terkait: `docs/superpowers/plans/2026-10-11-port-mockup-redesign.md`

## 1. Latar Belakang & Masalah

Mockup `mockups/pengajuan-v2/index.html` menampilkan UI "Scan Kamera" in-app:
overlay full-screen, pratinjau kamera langsung (`getUserMedia`), bingkai empat
sudut + garis scan, multi-halaman, geser/hapus, lalu membangun PDF.

Produksi (`public/dashboard.html` dan `public/bagian.html`) **tidak** memiliki
kamera in-app. Tombol "Scan Kamera" hanya memicu
`<input type="file" accept="image/*" capture="environment" multiple>` yang
membuka aplikasi kamera OS untuk memotret. Foto lalu diproses
`scan-pdf.js` (`compressToJpeg` → `buildPdf`) menjadi PDF. Jadi produksi sudah
punya multi-halaman + reorder + PDF, tetapi belum ada pratinjau kamera dan belum
ada koreksi tepi/perspektif dokumen.

Akibatnya, tampilan dan pengalaman berbeda dari mockup, dan hasil foto tidak
di-dewarp/dibersihkan.

## 2. Tujuan

Menyediakan scanner in-app pada semua titik scan produksi:

1. Deteksi tepi dokumen sungguhan (bukan animasi), lalu koreksi perspektif (dewarp).
2. Hasil abu-abu bersih ala scanner dokumen (adaptive threshold).
3. Multi-halaman, pratinjau, geser/hapus, menjadi satu PDF (batas 5 MB tetap).
4. Fallback ke kamera OS bila kamera/library tidak tersedia.

Titik scan yang dicakup (4):
- `dashboard.html`: BA Pelaksanaan, Bukti Bayar, BA Pendukung.
- `bagian.html`: BA.

## 3. Non-Tujuan (di luar scope)

- Tidak mengubah backend/RPC/skema D1, alur unggah (1 file, maks 5 MB), atau biaya override.
- Tidak menambah OCR.
- Tidak menambah koreksi 4 sudut manual (potensi iterasi berikutnya).
- Tidak menyentuh `detail-laporan.html`, `portal.html`, `index.html` (tidak punya scan).
- Flash/torch, rotasi manual, filter warna: di-skip (YAGNI).

## 4. Keputusan Desain

- **Library:** OpenCV.js self-hosted (pendekatan A). Kandidat: `@techstark/opencv-js`
  versi dipin, file `dist/opencv.js` dengan wasm tertanam (single-file ±10–11 MB).
- **Fidelitas:** deteksi tepi + perspektif sungguhan (pilihan pengguna).
- **Gaya hasil:** grayscale + `adaptiveThreshold` ("abu-abu bersih ala scanner").
- **Cakupan:** semua 4 titik scan.

## 5. Arsitektur & Unit

### 5.1 `public/vendor/opencv.<versi>.js` (asset statis, di-commit)
Build single-file dengan wasm tertanam. Nama diberi versi agar cache aman
(`immutable`). Tidak ada fetch `.wasm` terpisah → menghindari isu MIME/COOP pada
Cloudflare Workers Assets.

### 5.2 `public/scanner.js` (baru) — modul framework-agnostic
Mengekspos `window.Scanner`:
- `loadEngine()` — menyuntik `<script src="/vendor/opencv.<versi>.js">` sekali,
  resolve ketika OpenCV siap (`cv.onRuntimeInitialized` atau promise factory).
  Idempotent.
- `isSupported(navigatorLike)` — boolean: ada `mediaDevices.getUserMedia`.
- `open({ title, onApply, pages })` — membuat overlay DOM full-screen, mengelola
  stream kamera, pratinjau live + overlay kanvas tepi, tombol shutter,
  thumbnail halaman, geser/hapus, tombol "Gunakan"/"Batal". Saat "Gunakan",
  memanggil `onApply(pages)` dengan array `{ bytes, width, height, url }`.
- Self-contained: menyuntik `<style>` sendiri dengan kelas ber-namespace
  `.scn-*`. Tidak bergantung pada utility Tailwind inline tiap halaman, sehingga
  tampilan identik di kedua file. `z-index` tinggi (mis. 2000) agar di atas
  sidebar/topbar.

`scanner.js` tidak tahu Vue. Host hanya menyediakan `title` dan callback.

### 5.3 `public/scan-pdf.js` — tidak berubah
`compressToJpeg` dan `buildPdf` tetap dipakai host untuk membangun PDF.

### 5.4 Integrasi host (perubahan minimal)
- `dashboard.html`: tambah method `openScanner(which)` yang memanggil
  `window.Scanner.open({ title, onApply: pages => this.scanAddPages(pages, which) })`,
  dan `scanAddPages(pages, which)` yang mem-push ke `t.scanItems` dengan bentuk
  objek yang sudah dipakai (`id, url, bytes, width, height`). Grid pratinjau,
  geser/hapus, dan `scanBuildPdf` yang ada otomatis bekerja tanpa perubahan.
- `bagian.html`: tambah `openScanner()` + penambahan item ke `ba.scanItems`.
- Ganti handler tombol "Scan Kamera" (`@click="$refs.*Camera.click()"`) menjadi
  `@click="openScanner(...)"`.
- **Pertahankan** `<input capture="environment" multiple>` sebagai fallback.
- Muat `/scanner.js` via `<script src="/scanner.js" defer></script>` (setelah
  `scan-pdf.js`) di `dashboard.html` dan `bagian.html`.

## 6. Pipeline Deteksi & Gambar (OpenCV.js)

1. Ambil frame `<video>` → canvas kerja (sisi panjang ~1280).
2. `cv.imread` → `cvtColor(GRAY)` → `GaussianBlur` → `Canny` → `dilate`.
3. `findContours` → pilih kontur terbesar dengan area > ~15% frame.
4. `approxPolyDP` → bila tepat 4 titik: urutkan `tl, tr, br, bl`;
   bila bukan: fallback kotak penuh (seluruh frame) atau `minAreaRect`.
5. `getPerspectiveTransform` + `warpPerspective` → gambar lurus.
6. `cvtColor(GRAY)` → `adaptiveThreshold` (blockSize ~15–25, C ~10),
   opsional `medianBlur`.
7. `cv.imshow` → canvas → `toDataURL('image/jpeg', 0.8)`; hitung
   `bytes/width/height`.

Overlay tepi live: menjalankan langkah 2–4 pada interval throttle ~400–600 ms
(bukan tiap frame) untuk menggambar quad hijau. Tombol shutter tetap bekerja
walau deteksi belum "locked" (memakai fallback kotak penuh).

Manajemen memori: setiap `cv.Mat` dihapus via helper `withMat`/`try-finally`
(cegah kebocoran memori wasm).

## 7. Fallback & Error Handling

- `getUserMedia` butuh secure context (HTTPS). Produksi dan preview HTTPS; localhost juga secure.
- Kamera/izin gagal (`NotAllowedError`, `NotFoundError`, dsb.) atau
  `isSupported` false → overlay menampilkan pesan + tombol "Pakai kamera OS"
  (memicu input fallback lama) dan "Batal".
- Engine gagal dimuat → tawarkan "Lanjut tanpa deteksi" (menangkap frame apa
  adanya, tanpa warp/threshold) atau "Kamera OS".
- Dokumen tak terdeteksi → fallback kotak penuh; pengguna tetap bisa menjepret;
  tampilkan notifikasi.
- Batas 5 MB tetap ditegakkan `scanBuildPdf` yang sudah ada; pesan error lama
  dipertahankan.

## 8. Ukuran, Performa, Deployment

- Asset baru ±10–11 MB, hanya diunduh saat scanner dibuka pertama (lazy), lalu
  di-cache HTTP.
- Mitigasi repo: satu langkah vendoring terdokumentasi (unduh tarball paket,
  salin `dist/opencv.js` ke `public/vendor/`), lalu di-commit.
- `wrangler deploy` mengunggah asset baru. Verifikasi batas Cloudflare
  (≤25 MiB/file).
- Deteksi di-throttle; downscale 1280; Mat selalu dihapus; object URL di-revoke
  (sudah ada di `scanClear`/`scanRemove`).
- Tanpa langkah build, tanpa CDN.

## 9. Testing & Kriteria Terima

### 9.1 Unit (vitest)
Mengikuti pola `test/scan-pdf.test.js`: `import src from '../public/scanner.js?raw'`
lalu `new Function('window', src)(win)`. Uji helper murni:
- `Scanner.__test.orderCorners(points)` → urutan `tl,tr,br,bl`.
- Penghitungan ukuran output dari 4 titik.
- `Scanner.isSupported(navigatorLike)`.

### 9.2 Guard template
`test/scan-pdf.test.js` / `test/dashboard-template.test.js` diperluas (atau file
baru) untuk memastikan:
- `dashboard.html` dan `bagian.html` memuat `<script src="/scanner.js" defer>`.
- Ada `openScanner(` dan `scanAddPages(`.
- Input fallback `capture="environment"` **tetap ada**.
- Marker method scan lama tetap utuh (agar test lama hijau).

### 9.3 Regression
Seluruh suite lama (baseline 342 test / 38 file) tetap hijau.

### 9.4 Manual (preview HTTPS)
Matrix: deteksi berhasil, tak terdeteksi, izin ditolak, tanpa kamera,
3 halaman → PDF < 5 MB, iOS Safari.

### 9.5 Kriteria terima
Dari tombol "Scan Kamera" di 4 titik: overlay live kamera terbuka; tepi dokumen
terdeteksi dan di-dewarp; output abu-abu bersih; multi-halaman menjadi PDF
<5 MB; fallback kamera-OS bekerja saat kamera tak tersedia.

## 10. Asumsi yang Diverifikasi Saat Implementasi

1. Build `@techstark/opencv-js` benar-benar self-contained (wasm tertanam) dan
   dapat dimuat offline dari origin yang sama. Bila tidak, gunakan build resmi
   OpenCV.js dan host `.wasm` terpisah dengan MIME yang benar.
2. Ukuran file < 25 MiB (batas asset Cloudflare).
3. `getUserMedia` tersedia pada target perangkat (mobile Chrome/Safari modern).

## 11. Risiko

- **Repo membesar** ±10 MB. Mitigasi: satu file ter-pin, lazy-load.
- **Memori HP kelas bawah** saat deteksi live. Mitigasi: throttle, downscale,
  hapus Mat, tombol shutter manual.
- **Deteksi gagal pada latar ramai.** Mitigasi: fallback kotak penuh.

## 12. Potensi Iterasi Berikutnya (Future)

- Penyesuaian 4 sudut manual (drag).
- Mode warna/BW yang bisa dipilih.
- Kompresi/perpustakaan alternatif yang lebih ringan.
