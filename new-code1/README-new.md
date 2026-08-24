# DASHBOARD-INHAL — Web App Google Apps Script

Dokumen ini merangkum **seluruh alur proses pembuatan** web app INHAL (Institusi Nusantara... Handling) sejak kode awal diunggah hingga fitur terbaru. Cocok untuk orientasi developer baru maupun rekap pekerjaan.

---

## 1. Ringkasan Aplikasi

Aplikasi web **monitoring proses INHAL** (ijazah/legalisir), dibangun di atas:

- **Google Apps Script (V8)** sebagai backend + hosting webapp (`executeAs: USER_DEPLOYING`, `access: ANYONE`).
- **Google Sheets** sebagai database (`DATABASE_SHEET_ID` di `0_code.gs`).
- **Google Drive** untuk penyimpanan file bukti (`DRIVE_FOLDER_ID`).
- **Vue 3** (global build, tanpa build tool) di setiap halaman HTML.
- **Tailwind CSS** (blok CSS compiled inline di tiap halaman) + font Plus Jakarta Sans.

Halaman publik/pribadi dilayani lewat satu deployment webapp dengan routing `?page=...` di `2_web.gs`.

---

## 2. Struktur Kode (`new-code1/`)

| File | Peran |
|---|---|
| `0_code.gs` | Data layer: konstanta (sheet ID, drive ID), `SCHEMAS`, helper akses sheet (`ensureSheetWithHeaders`, `generateId`, `appendRowSafe`, `findRowByColumnValue`), cache. |
| `1_business.gs` | Seluruh logika bisnis + fungsi API GAS (terbesar, ~3225 baris). Setiap fungsi di halaman memanggilnya via `google.script.run`. |
| `2_web.gs` | Routing `doGet`, `PAGE_TITLES`, `renderPage`, `renderMessagePage`. |
| `pages/index.html` | Pendaftaran mahasiswa (publik). |
| `pages/portal.html` | Portal mahasiswa: upload bukti, lihat status. |
| `pages/bagian.html` | Panel Bagian: input status + upload Berita Acara bagian. |
| `pages/dashboard.html` | Dashboard admin (dengan tab termasuk Berita Acara Bagian). |
| `pages/detail-laporan.html` | Laporan admin: tab Laporan Bagian + tab Laporan Dosen (matriks BA, biaya). |
| `template-acc-diterima-ditolak.html`, `template-acc-final.html` | Template email ACC. |
| `docs/2026-08-18-detail-laporan-tabs-design.md` | Spesifikasi desain halaman laporan (dasar seluruh fitur laporan). |
| `appsscript.json` | Konfigurasi project: runtime V8, oauth scopes (spreadsheets, drive, send_mail, userinfo.email). |

> Struktur ini adalah hasil **refactor** dari kode legacy di root repo (`Code.js` satu file besar + halaman HTML datar seperti `check.html`, `admin.html`, `info.html`). Versi `new-code1/` memisahkan backend menjadi 3 file dan menata halaman ke folder `pages/`.

---

## 3. Model Data (Google Sheets)

Skema didefinisikan sebagai array kolom di `SCHEMAS` (`0_code.gs`). Kolom yang baru ditambahkan **tidak boleh disisipkan di tengah** tanpa mempertimbangkan kompatibilitas; pola yang dipakai adalah `ensureSheetWithHeaders` (migrasi otomatis menambah kolom baru di akhir jika belum ada).

Sheet utama:

| Sheet | Kolom kunci | Fungsi |
|---|---|---|
| `Pengajuan` | `ID Pengajuan`, `NPM`, `Status`, `Link Bukti Bayar`, `Link Final`, `Status Info Bagian`, `Nomor Surat`, `UpdatedAt` | Data induk setiap pengajuan. |
| `DetailKegiatan` | `ID Pengajuan`, `Jenis Kegiatan`, `Pilihan`, `Detail`, `Tanggal Pelaksanaan`, `Bagian` | Baris kegiatan/BA (bisa >1 per pengajuan). |
| `StatusHistory` | `ID Pengajuan`, `Status`, `Catatan`, `UpdatedBy`, `Timestamp` | Riwayat status. |
| `Mahasiswa` | `NPM`, `Nama`, `Email`, `No. HP` | Data mahasiswa. |
| `MasterKegiatan` | `Blok`, `Ujian`, `SGD`, `Detail SGD`, `KKD`, `Detail KKD`, `Lab`, `Kegiatan Lab`, `Dosen` | Opsi dropdown master. |
| `MasterBagian` | daftar bagian | Opsi bagian. |
| `MasterBiaya` | nilai biaya | Daftar nilai biaya kegiatan (untuk dropdown & fallback). |
| `Admin` | password admin | Autentikasi admin. |
| `BagianStaff` | akun bagian | Autentikasi staf bagian. |
| `Config` | key/value | Pengaturan dinamis (mode bukti, dsb). |
| `NomorSurat` | penomoran surat per tahun | `getNextSuratNumberYearly`. |
| `LogUpload` | log | Riwayat upload file. |
| `AuditLog` | log | Jejak audit perubahan data. |
| `BeritaAcara` / `BeritaAcaraPeserta` | BA mahasiswa | BA yang diupload bagian. |
| `BeritaAcaraAdmin` / `BeritaAcaraAdminPeserta` | BA admin | BA yang diupload admin (dipisah dari BA bagian, hasil fitur sheet split). |
| `CheckData` | `ID Pengajuan`, `Detail`, `Catatan`, `Biaya`, `UpdatedAt` | Data check per pengajuan. Kolom `Detail` punya sentinel `'BIAYA-OVERRIDE'` untuk baris override biaya. |

### Konvensi penting
- **Biaya override per pengajuan** disimpan di `CheckData` dengan key `[ID Pengajuan, '', 'BIAYA-OVERRIDE', '']` (sentinel pada kolom Detail) — bukan kolom baru di `Pengajuan`. Ini hasil keputusan desain "Opsi B" user (lihat fitur di bawah).
- Key unik CheckData dibangun oleh `_checkDataKey(c)` (`1_business.gs:2918`); `_upsertBiayaCheckData` melakukan dedupe override rows.
- Semua penulisan data bisnis lewat pola: `waitLock` → baca → tulis → `finally` unlock, plus `AuditLog`.

---

## 4. Alur Pengguna & API per Halaman

Pola pemanggilan backend di setiap halaman: wrapper `run(fn, ...args)` → `google.script.run.withSuccessHandler(...).withFailureHandler(...)`.

### `index.html` — Pendaftaran (publik)
`getRegistrationOptions` → `getStudentNameByNpm` → `registerPengajuan` (+ `checkDuplicatePengajuan`).

### `portal.html` — Portal Mahasiswa
`getRegistrationOptions`, `getStudentNameByNpm`, `getStudentPortalData` (status + detail), `registerPengajuan`, `uploadBuktiFiles`.

### `bagian.html` — Panel Bagian
`authenticateBagian` → `getBagianBootstrap`, `getBaginaConfig`, `getBeritaAcaraList`, `uploadBeritaAcaraBagian`, `logoutSession`.

### `dashboard.html` — Dashboard Admin
Autentikasi admin (`authenticateAdmin`, token sesi `_CURRENT_SESSION`). ~28 panggilan termasuk:
`getDashboardBootstrap`, `getPengajuanWithDetails`, `updatePengajuanStatus`, `updatePengajuanFields`, `updateDetailKegiatan`, `deleteDetailKegiatan`, `deletePengajuanAdmin`, `uploadBeritaAcaraAdmin`, `sendBulkFinalEmail`, `getBagianBaSettings`, `saveBagianBaSettings`, `getMasterOptions`, `saveMasterKegiatan`, `getNextSuratNumberYearly`, dsb.

Tab **Berita Acara Bagian** di dashboard memakai `adminBagianBypass` (membuat sesi bagian dari token admin) dan membaca sheet `BeritaAcaraAdmin` terpisah.

### `detail-laporan.html` — Laporan (admin)
`authenticateAdmin` → `getLaporanBootstrap`, `getDetailLaporanData`, `logoutSession`.

Dua tab:
- **Laporan Bagian**: matriks kelengkapan BA per bagian; tabel berisi kolom kegiatan + Tanggal + **Biaya**; subtotal per bagian + grand total; `exportXlsx`.
- **Laporan Dosen**: matriks jumlah BA per dosen & bagian; `dosenFilter` (q + bagian) mempersempit tab; sel dosen menampilkan chip **biaya** per BA; header total; `exportDosenMatrix`.

Biaya per BA dihitung dari peserta (match NPM+Blok), biaya per pengajuan ter-resolve lewat override → fallback MasterBiaya (dilakukan backend, `getLaporanBootstrap` / `getDetailLaporanData`).

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
- `feat/laporan-dosen-matriks` — cabang kerja aktif yang menjadi tempat penggabungan hampir semua fitur setelahnya (laporan bagian, laporan dosen, optimasi loading, modal mobile, edit/hapus, biaya).
- Fitur-fitur lain (`feat/ba-bagian`, `feat/loading-speed-*`, `feat/dashboard-*`, `feat/pengaturan-biaya-*`) di-merge **fast-forward** ke `feat/laporan-dosen-matriks`.

---

## 6. Kronologi Fitur (Riwayat Kerja)

Urutan dari git history + ledger SDD (59 commit per git log):

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

Catatan: fitur 7 & 8 sudah digabung ke `feat/laporan-dosen-matriks` dan di-push ke origin (`97086e8..dc9dc66`, lalu `dc9dc66..81b3b6c`).

---

## 7. Konvensi & Aturan Main-Tenant (tripwire)

- **Hanya 1-2 file berubah per fitur**; scope diverifikasi saat task verification (mis. fitur 8 hanya `detail-laporan.html`).
- Setiap commit memakai trailer `Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>`.
- Dilarang menambah komentar pada kode tanpa diminta; nama fungsi/halaman tetap konsisten dengan pola lama.
- Review berjenjang: per-task clean → ledger → whole-branch. Masalah `Minor` boleh diteruskan jika konsisten pola lama (didokumentasikan).
- Deploy & pengujian interaktif (login + data nyata) adalah **tanggung jawab user** pada deployment asli — halaman GAS tidak bisa diuji login lewat preview statis lokal.
