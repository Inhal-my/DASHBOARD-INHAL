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

- [ ] Write failing test: dua BA kegiatan sama, file URL sama, tanggal/jam berbeda -> `jumlahSesi === 2`, `status === 'Multi-sesi'`, sesi terurut, dedupe tidak menghilangkan sesi.
- [ ] Write failing test: jadwal aktif tanpa BA -> `jadwalBelum === 1`; BA tanpa `jadwal_id` -> `sesiEkstra === 1`.
- [ ] Write failing test: BA tanpa file/dosen/jam -> `sesiDraft === 1` dan `sesi[0].flags` memuat `Draft`.
- [ ] Implement helper dengan normalisasi dua bentuk data (`baId`/`BA ID`, `tanggal`/`Tanggal Pelaksanaan`, `fileUrl`/`File URL`, `jadwalId`/`Jadwal ID`).
- [ ] Panggil di `getLaporanBootstrap` setelah `u.jadwal` diisi; return `baAudit: audit.rows`.
- [ ] Panggil di `getBagianAggregation`; muat jadwal aktif, return `baAudit: audit.rows`.
- [ ] Perbaiki dedupe `getBagianAggregation` agar memakai `sumber|baId`, bukan `fileUrl`.
- [ ] Run: `cd new-code1-cf && npm test -- test/read-ba-audit.test.js test/read-laporan.test.js`.

### Task 2: Detail-laporan CF

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html`
- Test: `new-code1-cf/test/detail-laporan-daftar-ba-template.test.js`
- Test: `new-code1-cf/test/detail-laporan-template.test.js`

- [ ] Tambah computed `baAuditRows`, `baAuditSummary`, `baAuditExportRows`.
- [ ] Tambah kartu ringkasan: Multi-sesi, Total Sesi, Sesi Ekstra, Sesi Draft, Jadwal Belum.
- [ ] Tambah badge `Multi-sesi (n)` pada baris Rekap dan tampilan sesi memakai `r.baAudit.sesi` (tanggal, jam, dosen, label, jumlah peserta, flag, daftar peserta via `<details>`).
- [ ] Daftar BA: kolom `Sesi`, `Status Sesi`; data `baDaftarItem` mengambil index/total/flags dari `unit.baAudit`.
- [ ] Filter `baListFilter.sesi` (`multi`, `ekstra`, `draft`).
- [ ] `baReportRows` menambah `Sesi`, `Total Sesi`, `Status Sesi`.
- [ ] `exportBaTable` dan `exportDaftarBa` menambah sheet `Pemeriksaan BA` berisi satu baris per sesi.
- [ ] Run template tests dan `npm run csp:generate && npm run csp:check`.

### Task 3: Dashboard CF

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Modify: `new-code1-cf/test/dashboard-template.test.js`
- Test: `new-code1-cf/test/dashboard-ba-audit-template.test.js`

- [ ] Set `this.bagian.baAudit = data.baAudit || []` di `loadBagian`.
- [ ] Tambah state `baAuditFilter`, `baAuditExpanded`; computed `baAuditRows`, `baAuditFiltered`, `baAuditSummary`, `baAuditBlokOptions`.
- [ ] Tambah panel `Pemeriksaan BA Pelaksanaan` setelah `Kelengkapan per Blok`: ringkasan, filter Bagian/Blok/Status, tabel per kegiatan, expand sesi + peserta, tombol Kelola/Hapus.
- [ ] Tombol `Ekspor Pemeriksaan` menulis XLSX sheet `Pemeriksaan BA`.
- [ ] `babSesiCount` dan teks peringatan upload: "Kegiatan ini sudah memiliki N sesi. Unggahan ini menjadi sesi N+1."
- [ ] Run: `npm test -- test/dashboard-template.test.js test/dashboard-ba-audit-template.test.js`.

### Task 4: Verifikasi CF

- [ ] `cd new-code1-cf && npm test`
- [ ] `npm run csp:generate`
- [ ] `npm run csp:check`
- [ ] `npm run migrations:check`
- [ ] Review `git diff`; commit hanya setelah semua hijau.

### Task 5: Backend GAS

**Files:**
- Modify: `new-code1/1_business.gs`
- Modify: `new-code1/0_code.gs`
- Create: `new-code1/test/ba-pelaksanaan-multisesi.test.mjs`

- [ ] Tambah `Label` dan `Kegiatan Key` ke schema `BeritaAcara`.
- [ ] Tambah `_buildBaPelaksanaanAudit(units, jadwalList)` dengan bentuk data sama seperti CF.
- [ ] `_attachBaToLaporanRows` mengembalikan `{ units, baByKey }`; `getLaporanBootstrap` memakai units untuk audit dan return `baAudit`.
- [ ] `_buildBagianAggregation` memuat `_computeJadwalList`, memanggil audit, return `baAudit`; `getBaTabData` meneruskan.
- [ ] `uploadBeritaAcaraBagian`: izinkan multi-sesi; hapus blokir duplikat tanggal; simpan `Label` dan `Kegiatan Key`; tetap tolak duplikat `Jadwal ID`.
- [ ] Test Node membaca sumber dan memastikan helper/field/return ada; test perilaku upload multi-sesi jika harness memungkinkan.
- [ ] Run: `cd new-code1 && node --test test/ba-pelaksanaan-multisesi.test.mjs`.

### Task 6: Detail-laporan GAS

**Files:**
- Modify: `new-code1/pages/detail-laporan.html`
- Test: `new-code1/test/detail-laporan-ba-audit.test.mjs`

- [ ] Simpan `this.baAudit = data.baAudit || []` di `loadData`.
- [ ] Tambah computed `baAuditRows`, `baAuditSummary`, `baAuditExportRows`.
- [ ] Kartu ringkasan + badge multi-sesi pada `baGroupRows`.
- [ ] Expand BA menampilkan sesi, peserta, flag, dan link file dari audit.
- [ ] Daftar BA: kolom `Sesi`, `Status Sesi`; filter `sesi`.
- [ ] Export BA/Daftar BA menambah sheet `Pemeriksaan BA`.
- [ ] Run test template/string dan `node --test test/*.mjs`.

### Task 7: Dashboard GAS

**Files:**
- Modify: `new-code1/pages/dashboard.html`
- Test: `new-code1/test/dashboard-ba-audit.test.mjs`

- [ ] `loadBagian` dan `loadBaTab` menyimpan `baAudit`.
- [ ] Panel `Pemeriksaan BA Pelaksanaan`, filter, tabel, expand sesi/peserta, tombol Kelola/Hapus.
- [ ] `Ekspor Pemeriksaan` XLSX sheet `Pemeriksaan BA`.
- [ ] Peringatan upload multi-sesi.
- [ ] Run `cd new-code1 && node --test test/*.mjs`.

### Task 8: Verifikasi GAS

- [ ] `cd new-code1 && node --test test/*.mjs`
- [ ] Syntax: salin `0_code.gs`, `1_business.gs`, `2_web.gs`, `3_drive_bridge.gs` ke `/tmp/*.js`, lalu `node --check`.
- [ ] Review `git diff`.
