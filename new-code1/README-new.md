# DASHBOARD-INHAL — Web App Google Apps Script

Dokumen ini merangkum **seluruh alur fungsi** web app INHAL (Institusi Nusantara... Handling) di folder `new-code1/`: struktur kode, model data, API per halaman, dan riwayat fitur. Cocok untuk orientasi developer baru maupun rekap pekerjaan.

---

## 1. Ringkasan Aplikasi

Aplikasi web **monitoring proses INHAL** (ijazah/legalisir), dibangun di atas:

- **Google Apps Script (V8)** sebagai backend + hosting webapp (`executeAs: USER_DEPLOYING`, `access: ANYONE`).
- **Google Sheets** sebagai database (`DATABASE_SHEET_ID` di `0_code.gs`).
- **Google Drive** untuk penyimpanan file bukti (`DRIVE_FOLDER_ID`).
- **Vue 3** (global build, tanpa build tool) di setiap halaman HTML.
- **Tailwind CSS** (blok CSS compiled inline di tiap halaman) + font Plus Jakarta Sans.
- **SheetJS (xlsx)** via CDN di `detail-laporan.html` untuk export XLSX dengan hyperlink yang dapat diklik.

Halaman dilayani lewat satu deployment webapp dengan routing `?page=...` di `2_web.gs`.

---

## 2. Struktur Kode (`new-code1/`)

| File | Peran |
|---|---|
| `0_code.gs` | Data layer: konstanta (sheet ID, drive ID), `SCHEMAS`, helper akses sheet (`ensureSheetWithHeaders`, `generateId`, `appendRowSafe`, `getRowByKey`, `upsertRowByKey`, `deleteRowByKey`), cache (`_rowsCache`, `getAllRowsCached`, `invalidateSheetCache`), sesi (`createSession`/`getSession`/`destroySession`), audit log, migrasi BA sheets. |
| `1_business.gs` | Seluruh logika bisnis + fungsi API GAS (terbesar, ~3240 baris). Setiap fungsi di halaman memanggilnya via `google.script.run`. |
| `2_web.gs` | Routing `doGet` (param `?page=`), `PAGE_TITLES`, alias `admin` → `dashboard`, `renderPage`. |
| `pages/index.html` | Pendaftaran pengajuan (publik). |
| `pages/portal.html` | Portal mahasiswa: daftar/pengajuan baru, upload ACC + bukti bayar, validasi bukti, lihat status. |
| `pages/bagian.html` | Panel Bagian: pilih kegiatan, input status peserta, upload Berita Acara bagian. |
| `pages/dashboard.html` | Dashboard admin: tab Pengajuan, Berita Acara (bagian & admin), Master Data, Laporan. |
| `pages/detail-laporan.html` | Laporan admin: tab Laporan Bagian + tab Laporan Dosen (matriks BA, biaya), export XLSX. |
| `template-acc-diterima-ditolak.html`, `template-acc-final.html` | Template email ACC. |
| `docs/2026-08-18-detail-laporan-tabs-design.md` | Spesifikasi desain halaman laporan (dasar seluruh fitur laporan). |
| `appsscript.json` | Konfigurasi project: runtime V8, oauth scopes (spreadsheets, drive, send_mail, userinfo.email). |

> Struktur ini adalah hasil **refactor** dari kode legacy di root repo (`Code.js` satu file besar + halaman HTML datar seperti `check.html`, `admin.html`, `info.html`). Versi `new-code1/` memisahkan backend menjadi 3 file dan menata halaman ke folder `pages/`.

---

## 3. Model Data (Google Sheets)

Skema didefinisikan sebagai array kolom di `SCHEMAS` (`0_code.gs:22`). Kolom baru ditambahkan lewat pola `ensureSheetWithHeaders` (migrasi otomatis menambah kolom di akhir jika belum ada). Peta fungsi halaman → sheet bisa disimak di bagian 4.

| Sheet | Kolom (sesuai `SCHEMAS`) | Fungsi |
|---|---|---|
| `Pengajuan` | `Timestamp`, `ID Pengajuan`, `NPM`, `Nama Lengkap`, `Email`, `No. HP/WA`, `Blok`, `Jenis Kegiatan`, `Dosen`, `Tanggal Pelaksanaan`, `Keterangan`, `Link Surat Keterangan`, `Status`, `Catatan Admin`, `Notifikasi Terkirim Pada`, `Status Notifikasi Email`, `Error Notifikasi Email`, `Lampiran Email`, `Nomor Surat`, `Link ACC INHAL`, `Link Bukti Bayar`, `Link Final`, `Status Info Bagian`, `Waktu Info Bagian`, `Email Bagian`, `Catatan Info Bagian`, `UpdatedAt` | Data induk setiap pengajuan. |
| `DetailKegiatan` | `Timestamp`, `ID Pengajuan`, `Jenis Kegiatan`, `Pilihan`, `Detail`, `Tanggal Pelaksanaan`, `Bagian` | Baris kegiatan/BA (bisa >1 per pengajuan). |
| `StatusHistory` | `Timestamp`, `ID Pengajuan`, `Status`, `Catatan`, `Actor Email` | Riwayat status (pelaku dicatat sebagai `Actor Email`, bukan `UpdatedBy`). |
| `Mahasiswa` | `NPM`, `Nama Lengkap`, `Email`, `Blok`, `Keterangan` | Data mahasiswa. |
| `MasterKegiatan` | `Kategori`, `Nilai` | Referensi nilai kegiatan (nilai dropdown diisi lewat master ini). |
| `MasterBagian` | `Lab`, `Kegiatan Lab`, `Bagian`, `Email` | Opsi bagian + email staf. |
| `MasterBiaya` | `Kegiatan`, `Biaya` | Daftar biaya per kegiatan (dipakai dropdown per-baris & fallback). |
| `Admin` | `Password`, `Nama` | Autentikasi admin. |
| `BagianStaff` | `Email`, `Kategori`, `Nama`, `Pass` | Autentikasi staf bagian. |
| `Config` | `Key`, `Value` | Pengaturan dinamis: `BUKTI_MODE` (`strict`/`lenggang`), `BAGIAN_BA_STATUSES`, `BAGIAN_BA_FINAL_ONLY`. |
| `NomorSurat` | `Type`, `Tahun`, `LastNumber`, `UpdatedAt` | Penomoran surat per tahun (`getNextSuratNumberYearly`). |
| `LogUpload` | `Timestamp`, `ID Pengajuan`, `NPM`, `Nama Lengkap`, `Blok`, `Jenis Kegiatan`, `Detail`, `Tanggal`, `Link ACC INHAL`, `Link Bukti Bayar` | Riwayat upload file. |
| `AuditLog` | `Timestamp`, `Actor Email`, `Aksi`, `Target`, `Detail`, `Alasan` | Jejak audit perubahan data. |
| `BeritaAcara` / `BeritaAcaraPeserta` | BA bagian | BA yang diupload bagian (`Sumber` = `'Bagian'`). |
| `BeritaAcaraAdmin` / `BeritaAcaraAdminPeserta` | BA admin | BA yang diupload admin (dipisah dari BA bagian, hasil fitur sheet split; `Sumber` = `'Admin'`). |
| `CheckData` | `Timestamp`, `Check ID`, `ID Pengajuan`, `NPM`, `Nama Lengkap`, `Blok`, `Jenis Kegiatan`, `Pilihan`, `Detail`, `Tanggal Pelaksanaan`, `Bagian`, `Dosen`, `Hadir`, `Catatan`, `Biaya`, `UpdatedAt` | Data check/presensi per pengajuan. |

### Konvensi penting
- **Biaya override per pengajuan** disimpan di `CheckData` sebagai baris dengan key `[ID Pengajuan, '', 'BIAYA-OVERRIDE', '']` — sentinel `'BIAYA-OVERRIDE'` di kolom `Detail`. Key unik dibangun `_checkDataKey(c)` (`1_business.gs:2931`); `_upsertBiayaCheckData` (`:2463`) melakukan dedupe baris override (hapus semua duplikat lalu tulis ulang). Menulis biaya kosong akan menghapus baris override → kembali ke default.
- **Resolusi biaya** berjenjang: `_getBiayaOverrideMap` (dari CheckData) → fallback `_getBiayaMap` (MasterBiaya), dipakai di `_resolveBiayaForPengajuan` dan dimuat ke dashboard sebagai dropdown **per-baris** (`{Kegiatan, Biaya}`), bukan daftar nilai unik.
- **Duplikat BA bagian** ditolak backend di `uploadBeritaAcaraBagian` (`1_business.gs:1200`): kombinasi `Bagian` + `Blok` + `Nama Kegiatan` + `Tanggal Pelaksanaan` yang sama persis akan di-return dengan pesan penolakan; frontend (`bagian.html`) menampilkan banner peringatan sebelum submit. Perbandingan tanggal memakai normalisasi `_dateOnly()` (`0_code.gs`) agar format `"2026-01-15"` dan `"2026-01-15T00:00:00"` dianggap sama.
- Semua penulisan data bisnis lewat pola `LockService.getScriptLock()` + `waitLock(30000)` → baca → tulis → `finally` unlock, plus `AuditLog` (via `appendRowSafe('AuditLog', ...)`).

---

## 4. Alur Pengguna & API per Halaman

Pola pemanggilan backend di setiap halaman: wrapper `run(fn, ...args)` → `google.script.run.withSuccessHandler(...).withFailureHandler(...)`. Semua fungsi API di bawah didefinisikan di `1_business.gs`.

### `index.html` — Pendaftaran (publik)
`getRegistrationOptions` → `getStudentNameByNpm` → `registerPengajuan`. Cek duplikat dilakukan **di backend** lewat `checkDuplicatePengajuan` yang dipanggil dari dalam `registerPengajuan` (bukan dipanggil langsung oleh halaman).
- `registerPengajuan` mewajibkan **Email aktif** dan **No. HP/WhatsApp** yang valid (`_isValidEmail`/`_isValidPhone`, `1_business.gs`) selain NPM/Nama — divalidasi juga di frontend `index.html` & `portal.html` (input bertanda `*`).

### `portal.html` — Portal Mahasiswa
`getRegistrationOptions`, `getStudentNameByNpm`, `getStudentPortalData` (status + detail + `buktiMode`), `registerPengajuan`, `uploadBuktiFiles`.
- Alur upload: pilih file ACC INHAL + bukti bayar → `validateBukti()` **client-side** → `submitUpload` → `uploadBuktiFiles` (backend).
- `validateBukti` membedakan jalur berdasarkan `buktiMode`: mode `lenggang` menerima file apa pun; mode `strict` menuntut PDF portal (header `%PDF`, ekstraksi teks, regex NPM 10 digit cocok). Pesan yang ditampilkan ke mahasiswa **netral** (tidak menyebut mode): sukses = "cek berkas valid", gagal = "cek berkas gagal, gunakan file pdf dari portal mahasiswa".

### `bagian.html` — Panel Bagian
`authenticateBagian` → `getBagianBootstrap`, `getBaginaConfig`, `getBeritaAcaraList`, `uploadBeritaAcaraBagian`, `logoutSession`.
- `uploadBeritaAcaraBagian` melewati `_validateBaPesertaStatus` (peserta harus sesuai status yang diizinkan pengaturan BA) lalu cek duplikat (lihat konvensi di bagian 3) sebelum menulis BA + peserta ke `BeritaAcara`/`BeritaAcaraPeserta`.
- Notifikasi lewat toast (`showToast`) kini dirender (sebelumnya state di-set tanpa elemen di template); sesi bagian dipulihkan dari `localStorage` saat `mounted()` (refresh tidak memaksa login ulang).

### `dashboard.html` — Dashboard Admin
Autentikasi `authenticateAdmin` (token sesi `_CURRENT_SESSION`). Panggilan aktual:

| Kelompok | Fungsi (`this.run('...', ...)`) |
|---|---|
| Bootstrap & data | `getDashboardBootstrap`, `getPengajuanList`, `getPengajuanWithDetails`, `getDashboardStats`, `getMasterDataMonitor`, `getDosenOptions`, `getLabOptions`, `getBaUploadOptions`, `getBagianAggregation`, `getBagianBaSettings`, `getBeritaAcaraAdminList` |
| Mutasi pengajuan | `updatePengajuanStatus`, `updatePengajuanFields`, `updateDetailKegiatan`, `deleteDetailKegiatan`, `deletePengajuanAdmin`, `syncLogDataToPengajuan` |
| BA | `uploadBeritaAcaraAdmin`, `deleteBeritaAcaraAdmin`, `saveBagianBaSettings`, `adminBagianBypass` |
| Email | `sendFinalEmail`, `sendBulkFinalEmail`, `sendAccFinalToBagian`, `sendStatusNotificationEmail` |
| Master data (via `saveFn`) | `saveAdminList`, `saveBagianStaff`, `saveConfig`, `saveMasterKegiatan`, `saveMasterBagian`, `saveMasterBiaya` |
| Utilitas | `diagnosticData`, `logoutSession` |

- Tab **Berita Acara Bagian** di dashboard memakai `adminBagianBypass` (membuat sesi bagian dari token admin) dan membaca sheet `BeritaAcaraAdmin` terpisah.
- `updatePengajuanStatus` dan `getPengajuanWithDetails` dilindungi `requireAuthorized` (satu-satunya fungsi yang sebelumnya lolos tanpa cek sesi).
- `updatePengajuanStatus` hanya menimpa `Catatan Admin` bila isi catatan **non-kosong**; modal status mem-prefill catatan tersimpan. `Keterangan` tidak pernah dikirim/ditimpa oleh fitur mana pun.
- `uploadBeritaAcaraAdmin` menolak BA tanpa peserta (sebelumnya bisa tersimpan 0 peserta).
- Tab **Laporan Bagian**: tiap kegiatan di panel detail kini menampilkan badge **"ACC Final"** (ceklis sama dengan "BA ada") + link "Final", berdasarkan `Link Final` pengajuan yang ditambahkan di agregasi backend `getBagianAggregation` (field `linkFinal`).
- Setelah simpan master (`saveEdit`), dashboard me-reset lazy-load `loaded.pengajuan`/`loaded.stats` lalu reload agar data pengajuan langsung segar.

### `detail-laporan.html` — Laporan (admin)
`authenticateAdmin` → `getLaporanBootstrap` (memuat data laporan + `masterBiaya`), `logoutSession`.
> Catatan: fungsi laporan legacy `getDetailLaporanData` telah **dihapus** (batch 11); laporan cukup memakai `getLaporanBootstrap`.

Dua tab:
- **Laporan Bagian**: matriks kelengkapan BA per bagian; kolom kegiatan + Tanggal + **Biaya**; subtotal per bagian + grand total; `exportExcel` (client-side via SheetJS).
- **Laporan Dosen**: matriks jumlah BA per dosen & bagian; `dosenFilter` (q + bagian) mempersempit tab; sel dosen menampilkan chip **biaya** per BA; header total; `exportDosenMatrix`.

Biaya per BA dihitung dari peserta (match NPM+Blok), biaya per pengajuan ter-resolve lewat override → fallback MasterBiaya (dilakukan backend, `getLaporanBootstrap`).

**Export XLSX** (SheetJS `xlsx@0.18.5`, CDN jsdelivr) di `detail-laporan.html`:
- `exportExcel`, `exportDosenMatrix`, `exportBaTable`.
- Kolom tanggal memakai `fmtTanggalWaktu`; kolom `Link` ditambahkan setelah `Biaya` di rekap.
- Helper `setUrlHyperlinks(ws, header, tooltip)` (`detail-laporan.html:864`) dipasang ke sheet ber-URL (`Rekap`, `Detail Kegiatan`, `Detail Peserta`, `Berita Acara`, `Detail BA`) agar link bukti bayar / BA **bisa diklik** di file xlsx (tanpa helper, SheetJS menulis teks biasa).

---

## 5. Alur Proses Pembuatan (Workflow Pengembangan)

Semua pengembangan berjalan dengan pola **Superpowers SDD** (plan-driven, task per-commit, review per-task, whole-branch review, merge fast-forward). Ledger proses ada di `.superpowers/sdd/progress.md`; spec & plan di `docs/superpowers/plans/`.

### Siklus per fitur
1. **Design spec** (`docs/superpowers/.../*-design*.md`) — kebutuhan, keputusan desain, batasan (mis. berapa file yang boleh berubah).
2. **Implementation plan** (bernomor task) — tiap task satu brief; implementer membuat commit per task.
3. **Branch fitur** (`feat/...`) bercabang dari `main` atau cabang fitur aktif.
4. **Review per task** — reviewer membaca diff antar-commit; masalah dicatat di ledger (`Critical`/`Important`/`Minor`).
5. **Verification task** (task terakhir) — tanpa perubahan kode: cek scope file, keseimbangan tag/braces, identitas identifier.
6. **Whole-branch review** → verdict `APPROVED`/`With fixes`.
7. **Finishing**: merge fast-forward ke cabang aktif, hapus cabang, lalu (jika user minta) push ke origin.

### Cabang & integrasi
- `main` — baseline awal (`9f44d13 Add files via upload`).
- `feat/laporan-dosen-matriks` — cabang kerja aktif yang menjadi tempat penggabungan hampir semua fitur setelahnya (laporan bagian, laporan dosen, optimasi loading, modal mobile, edit/hapus, biaya, export, duplikat BA, BUKTI_MODE).
- Fitur-fitur lain (`feat/ba-bagian`, `feat/loading-speed-*`, `feat/dashboard-*`, `feat/pengaturan-biaya-*`) di-merge **fast-forward** ke `feat/laporan-dosen-matriks`.

---

## 6. Kronologi Fitur (Riwayat Kerja)

Urutan dari git history + ledger SDD (65 commit per git log):

| Urutan | Fitur | Komit kunci |
|---|---|---|
| 0 | Upload kode awal (legacy: `Code.js` + halaman datar) | `9f44d13` |
| 1 | **BA Bagian: tab dashboard + pemisahan sheet** — admin bisa upload BA bagian, disimpan di sheet terpisah; migrasi schema; `adminBagianBypass`; sesi bagian. | `47dc820`..`635b4a3` |
| 2 | **Laporan Bagian sebagai matriks kelengkapan BA** — computed/methods/matrix + panel detail; buang filter sumber. | `954827f`..`c793e26` |
| 3 | **Laporan Dosen BA Matrix** — state `dosenFilter`/`activeDosenCell`, peta NPM per dosen, computed matriks, interaksi, render, export XLSX + hapus legacy. 7 task, whole-branch APPROVED. | `53d86b6`..`8925a15` |
| 4 | **Optimasi kecepatan loading `detail-laporan.html`** — index-map `detailById`/`historyById` (hindari O(n·m)), ukur `loadTimeMs`, skeleton per-tab, defer load Vue + gate boot. Deviasi plan yang disetujui (defer ubah perilaku boot; fix dengan `bootDetailLaporan()` + `window.Vue`/DOMContentLoaded). | `6cd8d17`..`6347db2` |
| 5 | **Perbaikan modal mobile `dashboard.html`** — class `.modal-overlay/.panel/.body`, hilangkan util Tailwind bentrok (`items-center`, `max-h-[88vh]`, `flex-1`), scroll-lock saat modal terbuka. Verdict "With fixes" (uji browser nyata = tugas user saat deploy). | `3c34bdb`..`6f58929` |
| 6 | **Edit/Hapus Pengajuan & Detail Kegiatan** — `updateDetailKegiatan`/`deleteDetailKegiatan` by index (backend), helper `_findDetailKegiatanRowByIdIndex`, edit field induk, edit per-baris detail, tombol Simpan/Hapus di modal. Fix `a7d8b8a` (toast error saat hapus gagal). Merge lokal saja (belum di-push). | `ca20c33`..`a7d8b8a` |
| 7 | **Pengaturan Biaya Per Pengajuan (override)** — kolom `Biaya` di `SCHEMAS.CheckData`; `_upsertBiayaCheckData` + key sentinel `'BIAYA-OVERRIDE'` (Opsi B, user) untuk hindari bentrok baris check; `_getBiayaOverrideMap` + `_resolveBiayaForPengajuan` (override dulu, fallback MasterBiaya) di 9 call site; dropdown Biaya di dashboard (Keterangan Dosen, bawah Tanggal); fix fast-path `_buildPengajuanClientRows` (BiayaOverride) + reload stats. Whole-branch APPROVED. | `c5689de`..`5545786` |
| 8 | **Tampilkan Biaya di Tab Laporan Detail** — tab Laporan Dosen: `npmBiayaMap`/`biayaForNpm`, chip biaya per BA, header total sel; tab Laporan Bagian: kolom Biaya setelah Tanggal, subtotal per bagian, grand total; export XLSX konsisten + dedupe NPM di sheet BA. Hanya `detail-laporan.html` berubah. Whole-branch REVIEW: Ready to merge: Yes. | `8292b5b`..`81b3b6c` |
| 9 | **Export XLSX: kolom Link + hyperlink klik** — kolom `Link` setelah `Biaya` di rekap; `fmtTanggalWaktu` untuk Tanggal Pelaksanaan; helper `setUrlHyperlinks` di 5 sheet export + `exportBaTable`; reload data pengajuan/stats otomatis setelah simpan master (`saveEdit` invalidate cache `MasterBiaya`/`MasterBagian`). | `19030bf` |
| 10 | **Dropdown biaya per-baris + guard duplikat BA + BUKTI_MODE** — `masterBiaya` menjadi array `{Kegiatan, Biaya}` (dropdown label "Kegiatan - Rp", sortir ascending); `uploadBeritaAcaraBagian` menolak BA duplikat (Bagian+Blok+Kegiatan+Tanggal) dengan banner peringatan di `bagian.html`; label config BUKTI_MODE jadi "Strict"/"Bypass" dengan field dropdown (nilai backend `strict`/`lenggang` tetap); portal memakai label netral + pesan validasi netral tanpa menyebut mode. | `0cfbe97` |
| 11 | **Batch pemantapan: keamanan + perbaikan + badge ACC Final** — (a) `requireAuthorized` di `updatePengajuanStatus` & `getPengajuanWithDetails` (dua-satunya fungsi dashboard tanpa cek sesi); (b) toast `bagian.html` kini dirender + sesi dipulihkan saat refresh; (c) normalisasi tanggal `_dateOnly` untuk cek duplikat BA (frontend & backend); (d) `Catatan Admin` hanya ditimpa bila non-kosong + modal status prefill catatan; (e) `uploadBeritaAcaraAdmin` menolak BA 0 peserta; (f) badge **"ACC Final"** + link di Laporan Bagian dashboard (`linkFinal` dari agregasi); (g) wajib **Email aktif + No. HP** valid di `index`/`portal` + validasi backend; (h) hapus 21 fungsi legacy mati (`getCheckPageData`, `getAllPengajuan`, `getStatusHistory`, `getPengajuanByNpm`, `updateLinkFinal`, `getBagianMappings`, `getAcceptedStudentData`, opsi master lama, `getDetailLaporanData`, `getSchemas`/`getSheetSchema`/`getHeaders`/`validateDatabaseSchema`, `renderMessagePage`). | *(commit batch ini)* |

Catatan: fitur 7–10 sudah digabung ke `feat/laporan-dosen-matriks` dan di-push ke origin (push terakhir `ef322ac..0cfbe97`); fitur 11 (batch pemantapan) menyusul pada commit berikutnya.

---

## 7. Konvensi & Aturan Main-Tenant (tripwire)

- **Hanya 1-2 file berubah per fitur**; scope diverifikasi saat task verification (mis. fitur 8 hanya `detail-laporan.html`). Fitur 9–10 sengaja digabung menjadi satu commit saat permintaan user.
- Setiap commit memakai trailer `Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>`.
- Dilarang menambah komentar pada kode tanpa diminta; nama fungsi/halaman tetap konsisten dengan pola lama.
- Review berjenjang: per-task clean → ledger → whole-branch. Masalah `Minor` boleh diteruskan jika konsisten pola lama (didokumentasikan).
- Deploy & pengujian interaktif (login + data nyata) adalah **tanggung jawab user** pada deployment asli — halaman GAS tidak bisa diuji login lewat preview statis lokal.
