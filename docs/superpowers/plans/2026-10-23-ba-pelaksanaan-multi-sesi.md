# BA Pelaksanaan Multi-Sesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deteksi, tampilkan, dan ekspor pemeriksaan BA Pelaksanaan multi-sesi di CF dan GAS.

**Architecture:** Satu helper audit server-side mengubah daftar BA Pelaksanaan per kegiatan menjadi baris pemeriksaan dengan sesi terurut, flag kelengkapan, dan perbandingan jadwal. Helper yang sama dipakai laporan detail dan dashboard. UI menampilkan ringkasan, badge multi-sesi, daftar sesi + peserta, dan sheet XLSX tambahan.

**Tech Stack:** CF: Hono + D1 + Vue 3 + Vitest. GAS: Google Apps Script + Vue 3 + Node test.

## Global Constraints

- CF priority; GAS setelah CF.
- Non-blocking: multi-sesi tetap boleh diunggah.
- Tanpa perubahan skema CF. GAS boleh menambah kolom `Label` dan `Kegiatan Key` pada `BeritaAcara`.
- Semua teks UI berbahasa Indonesia, tanpa emoji.
- CF: jalankan `npm test`, `npm run csp:generate`, dan `npm run csp:check`.
- GAS: jalankan `node --test test/*.mjs`.
- TDD: test gagal dulu, lalu implementasi minimal.

---

### Task 1: Helper audit CF

**Files:**
- Create: `new-code1-cf/src/read/baAudit.js`
- Create: `new-code1-cf/test/read-ba-audit.test.js`
- Modify: `new-code1-cf/src/read/laporan.js`
- Modify: `new-code1-cf/src/read/dashboard.js`

**Interfaces:**
- Produces: `buildBaPelaksanaanAudit(units, jadwalList)` -> `{ rows, summary }`.
- `rows[]`: `{ key, bagian, blok, kegiatan, jumlahSesi, status, jadwalCount, jadwalBelum, sesiEkstra, sesiDraft, kemungkinanDuplikat, pesertaUnik, sesi[] }`.
- `sesi[]`: `{ index, baId, label, tanggal, jam, dosen, catatan, timestamp, pesertaCount, peserta, fileUrl, baseFileUrl, jadwalId, jadwalCocok, lengkap, status, flags[] }`.
- Each unit gets `unit.baAudit = row`.

- [x] Write failing test: dua BA kegiatan sama, file URL sama, tanggal/jam berbeda -> `jumlahSesi === 2`, `status === 'Multi-sesi'`, sesi terurut, dedupe tidak menghilangkan sesi.
- [x] Write failing test: jadwal aktif tanpa BA -> `jadwalBelum === 1`; BA tanpa `jadwal_id` -> `sesiEkstra === 1`.
- [x] Write failing test: BA tanpa file/dosen/jam -> `sesiDraft === 1` dan `sesi[0].flags` memuat `Draft`.
- [x] Implement helper dengan normalisasi dua bentuk data (`baId`/`BA ID`, `tanggal`/`Tanggal Pelaksanaan`, `fileUrl`/`File URL`, `jadwalId`/`Jadwal ID`).
- [x] Panggil di `getLaporanBootstrap` setelah `u.jadwal` diisi; return `baAudit: audit.rows`.
- [x] Panggil di `getBagianAggregation`; muat jadwal aktif, return `baAudit: audit.rows`.
- [x] Perbaiki dedupe `getBagianAggregation` agar memakai `sumber|baId`, bukan `fileUrl`.
- [x] Run: `cd new-code1-cf && npm test -- test/read-ba-audit.test.js test/read-laporan.test.js`.

### Task 2: Detail-laporan CF

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html`
- Test: `new-code1-cf/test/detail-laporan-daftar-ba-template.test.js`
- Test: `new-code1-cf/test/detail-laporan-template.test.js`

- [x] Tambah computed `baAuditRows`, `baAuditSummary`, `baAuditExportRows`.
- [x] Tambah kartu ringkasan: Multi-sesi, Total Sesi, Sesi Ekstra, Sesi Draft, Jadwal Belum.
- [x] Tambah badge `Multi-sesi (n)` pada baris Rekap dan tampilan sesi memakai `r.baAudit.sesi` (tanggal, jam, dosen, label, jumlah peserta, flag, daftar peserta via `<details>`).
- [x] Daftar BA: kolom `Sesi`, `Status Sesi`; data `baDaftarItem` mengambil index/total/flags dari `unit.baAudit`.
- [x] Filter `baListFilter.sesi` (`multi`, `ekstra`, `draft`).
- [x] `baReportRows` menambah `Sesi`, `Total Sesi`, `Status Sesi`.
- [x] `exportBaTable` dan `exportDaftarBa` menambah sheet `Pemeriksaan BA` berisi satu baris per sesi.
- [x] Run template tests dan `npm run csp:generate && npm run csp:check`.

### Task 3: Dashboard CF

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Modify: `new-code1-cf/test/dashboard-template.test.js`
- Test: `new-code1-cf/test/dashboard-ba-audit-template.test.js`

- [x] Set `this.bagian.baAudit = data.baAudit || []` di `loadBagian`.
- [x] Tambah state `baAuditFilter`, `baAuditExpanded`; computed `baAuditRows`, `baAuditFiltered`, `baAuditSummary`, `baAuditBlokOptions`.
- [x] Tambah panel `Pemeriksaan BA Pelaksanaan` setelah `Kelengkapan per Blok`: ringkasan, filter Bagian/Blok/Status, tabel per kegiatan, expand sesi + peserta, tombol Kelola/Hapus.
- [x] Tombol `Ekspor Pemeriksaan` menulis XLSX sheet `Pemeriksaan BA`.
- [x] `babSesiCount` dan teks peringatan upload: "Kegiatan ini sudah memiliki N sesi. Unggahan ini menjadi sesi N+1."
- [x] Run: `npm test -- test/dashboard-template.test.js test/dashboard-ba-audit-template.test.js`.

### Task 4: Verifikasi CF

- [x] `cd new-code1-cf && npm test`
- [x] `npm run csp:generate`
- [x] `npm run csp:check`
- [x] `npm run migrations:check`
- [x] Review `git diff`; commit hanya setelah semua hijau.

### Task 5: Backend GAS

**Files:**
- Modify: `new-code1/1_business.gs`
- Modify: `new-code1/0_code.gs`
- Create: `new-code1/test/ba-pelaksanaan-multisesi.test.mjs`

- [x] Tambah `Label` dan `Kegiatan Key` ke schema `BeritaAcara`.
- [x] Tambah `_buildBaPelaksanaanAudit(units, jadwalList)` dengan bentuk data sama seperti CF.
- [x] `_attachBaToLaporanRows` mengembalikan `{ units, baByKey }`; `getLaporanBootstrap` memakai units untuk audit dan return `baAudit`.
- [x] `_buildBagianAggregation` memuat `_computeJadwalList`, memanggil audit, return `baAudit`; `getBaTabData` meneruskan.
- [x] `uploadBeritaAcaraBagian`: izinkan multi-sesi; hapus blokir duplikat tanggal; simpan `Label` dan `Kegiatan Key`; tetap tolak duplikat `Jadwal ID`.
- [x] Test Node membaca sumber dan memastikan helper/field/return ada; test perilaku upload multi-sesi jika harness memungkinkan.
- [x] Run: `cd new-code1 && node --test test/ba-pelaksanaan-multisesi.test.mjs`.

### Task 6: Detail-laporan GAS

**Files:**
- Modify: `new-code1/pages/detail-laporan.html`
- Test: `new-code1/test/detail-laporan-ba-audit.test.mjs`

- [x] Simpan `this.baAudit = data.baAudit || []` di `loadData`.
- [x] Tambah computed `baAuditRows`, `baAuditSummary`, `baAuditExportRows`.
- [x] Kartu ringkasan + badge multi-sesi pada `baGroupRows`.
- [x] Expand BA menampilkan sesi, peserta, flag, dan link file dari audit.
- [x] Daftar BA: kolom `Sesi`, `Status Sesi`; filter `sesi`.
- [x] Export BA/Daftar BA menambah sheet `Pemeriksaan BA`.
- [x] Run test template/string dan `node --test test/*.mjs`.

### Task 7: Dashboard GAS

**Files:**
- Modify: `new-code1/pages/dashboard.html`
- Test: `new-code1/test/dashboard-ba-audit.test.mjs`

- [x] `loadBagian` dan `loadBaTab` menyimpan `baAudit`.
- [x] Panel `Pemeriksaan BA Pelaksanaan`, filter, tabel, expand sesi/peserta, tombol Kelola/Hapus.
- [x] `Ekspor Pemeriksaan` XLSX sheet `Pemeriksaan BA`.
- [x] Peringatan upload multi-sesi.
- [x] Run `cd new-code1 && node --test test/*.mjs`.

### Task 8: Verifikasi GAS

- [x] `cd new-code1 && node --test test/*.mjs`
- [x] Syntax: salin `0_code.gs`, `1_business.gs`, `2_web.gs`, `3_drive_bridge.gs` ke `/tmp/*.js`, lalu `node --check`.
- [x] Review `git diff`.

---

## Catatan verifikasi (2026-10-26)

Semua task di atas sudah selesai dan diverifikasi ulang:

- CF: `npm run test:local` -> 96 file, 692 test lulus; `npm run test:scripts` -> 18 test lulus; `npm run csp:check` -> CSP sinkron; `npm run migrations:check` -> 24 migrasi valid.
- GAS: `node --test test/*.mjs` -> 45 suite, 156 test lulus.
- Tambahan di luar daftar awal:
  - `npm run test:local` (`new-code1-cf/scripts/test-local.mjs`) menjalankan suite dari path ber-spasi dengan menyalin proyek ke `D:\tmp\inhal-cf` (dependensi di-cache per fingerprint `package-lock.json`, ada lock anti-tumpang-tindih).
  - `.gitattributes` memaksa LF dan menghilangkan kegagalan palsu CSP hash/template akibat CRLF.
  - GAS `pages/dashboard.html`: field `Label` dan payload `label` pada unggah BA Pelaksanaan, plus `babSesiCount` + peringatan sesi berikutnya (paritas dengan CF).
- GAS UI belum mengirim `jadwalId`/`Jam`/`Dosen` saat unggah BA Pelaksanaan (backend tetap menerima bila dikirim dan menolak duplikat `Jadwal ID`). Bila tautan jadwal ingin lengkap seperti CF, tambahkan pemilih jadwal aktif di sheet sesi Bagian.

## Catatan deploy (2026-10-26)

- Commit `e4058e2` (LF + `.gitattributes`), `766c438` (`test:local`), `7e9feda` (BA multi-sesi CF+GAS), `a038dd4` (dokumen plan), `a53e368` (abaikan rahasia lokal) sudah di-push ke `origin/main`.
- Produksi CF dideploy dengan konfigurasi **`wrangler.production.toml`** (bukan `wrangler.toml`), karena `wrangler.toml` memuat binding `BACKUP_WORKFLOW`/`BACKUP_BUCKET` yang belum dapat dipakai:
  - R2 belum diaktifkan di akun `e2efd255f61d2b81c7f54c92eb57b946` (`wrangler deploy` dengan `wrangler.toml` gagal `code 10085`; `wrangler r2 bucket list` gagal `code 10042` — perlu aktivasi R2 di dashboard).
  - Bindings produksi saat ini memang tanpa R2/Workflow, jadi `wrangler.production.toml` sesuai kondisi nyata.
- Perintah deploy: `cd new-code1-cf && npx wrangler deploy --config wrangler.production.toml`.
- Hasil: version `4fbe7f96-dd46-4810-abb8-94f577d31788`, URL `https://inhal-form.prodi.workers.dev`.
- Verifikasi live: `/api/health` -> `{"ok":true,"db":"ok",...}`; `/dashboard.html` memuat `babSesiCount` dan header CSP menyajikan hash inline script baru (`sha256-YIEjuEDWX4WfCHWGu3/UhRLHUTaH76/NVWf4kcRFGeg=`).
- Deploy GAS belum otomatis (tidak ada `clasp`/`.clasp.json` di repo): file `new-code1/pages/dashboard.html` (+ `1_business.gs` bila belum) perlu di-paste ke project Apps Script lalu **Deploy > Manage deployments > Edit > New version**.
