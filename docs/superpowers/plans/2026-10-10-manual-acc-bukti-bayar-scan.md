# Manual Input, Status ACC, Unggah Bukti Bayar Admin & Scan Kamera — Implementation Record

**Status:** Selesai (implemented, tested, pushed, deployed) pada 2026-10-10.

**Goal:** Empat penambahan pada panel admin `new-code1-cf`:
1. Tab **Manual** untuk admin membuat pengajuan tanpa email/No. HP.
2. Opsi status **ACC** pada perbarui status.
3. **Unggah Bukti Bayar (oleh Admin)** di detail pengajuan.
4. **Scan kamera** untuk bukti bayar (multi-halaman → PDF), meniru alur scan Berita Acara.

**Architecture:** Cloudflare Workers + Hono + D1, frontend Vue 3 CDN di `dashboard.html`. RPC dispatcher `src/rpc.js` + `public/gs-shim.js`. Pembuat PDF client-side `public/scan-pdf.js`.

**Tech Stack:** Cloudflare Workers, Hono, D1, Vitest + `@cloudflare/vitest-pool-workers`, Vue 3 CDN, `scan-pdf.js`.

## Global Constraints

- Perintah tes dari `new-code1-cf/`: `npx vitest run <file>` (suite penuh: `npx vitest run`).
- Tanpa komentar kode baru.
- `TAB_KEYS = ['pengajuan','manual','stats','ba','master']`.
- Bukti bayar: tepat satu berkas, maksimal 5 MB (`MAX_BA_UPLOAD_BYTES`), mime `application/pdf|image/jpeg|image/jpg|image/png`.

---

### Task 1: Tab Manual (input manual oleh admin)

**Files:**
- Modify: `new-code1-cf/src/pengajuan.js`, `new-code1-cf/src/read/columns.js`, `new-code1-cf/src/rpc.js`, `new-code1-cf/public/dashboard.html`
- Add: `new-code1-cf/migrations/2026-10-10-pengajuan-sumber.sql`, kolom `sumber` di `new-code1-cf/schema.sql`
- Test: `new-code1-cf/test/manual-pengajuan.test.js`, `new-code1-cf/test/dashboard-template.test.js`

**Ringkasan:**
- `createPengajuan(db, formData, env, opts)` + `registerPengajuan` + `registerManualPengajuan`. `MANUAL_STATUSES = ['Menunggu','Diterima']`.
- RPC admin-only `registerManualPengajuan` + `getRegistrationOptions`; endpoint publik `POST /api/pengajuan` tetap ketat (tidak membaca `manual`/`status` dari body).
- Kolom D1 `sumber` (`Portal`/`Manual`); migrasi remote dijalankan, 9 baris lama di-backfill `Portal`.
- Form manual = form portal tanpa Email & No. HP/WA; Status Awal `Menunggu`/`Diterima`; catatan riwayat `"Pengajuan dibuat manual oleh admin."`; email notifikasi nonaktif; Badge `Manual`; ikon `bi-pencil-square`; label kolom `Sumber`.

- [x] Migrasi `sumber` + backfill remote
- [x] Backend `registerManualPengajuan` + kolom `sumber`
- [x] Tab & form Manual di `dashboard.html`
- [x] Tes + commit `52dcf5d`

### Task 2: Opsi status ACC

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`, `new-code1-cf/test/dashboard-template.test.js`

**Ringkasan:**
- Dropdown Status menampilkan `<option>ACC</option>`; tombol cepat **"Jadikan ACC"** memanggil `quickStatus('ACC')`.
- `quickStatus` menambah cabang `ACC` dengan `askConfirm` ("Tidak ada email yang dikirim...") lalu `updateStatus()` → `updatePengajuanStatus(...,'ACC')` tanpa email. Berlaku untuk baris Manual & Portal.

- [x] UI opsi ACC + tombol cepat
- [x] Tes + commit `1902c14`

### Task 3: Unggah Bukti Bayar (oleh Admin)

**Files:**
- Modify: `new-code1-cf/src/write/pengajuanAdmin.js`, `new-code1-cf/src/rpc.js`, `new-code1-cf/public/dashboard.html`
- Test: `new-code1-cf/test/manual-pengajuan.test.js`, `new-code1-cf/test/dashboard-template.test.js`

**Ringkasan:**
- `uploadBuktiAdmin(db, idPengajuan, file, ctx)` (`requireAdmin`; `saveDriveFile(ctx.env, file, 'bukti-'+id, { label: 'bukti bayar' })`; update `link_bukti_bayar`; `writeLogUpload` + `writeAuditLog` aksi `UPLOAD_BUKTI_ADMIN`).
- Terdaftar di `src/rpc.js` sebagai `uploadBuktiAdmin`.
- Kartu "Unggah Bukti Bayar (oleh Admin)" di modal detail; state `detail.buktiFile/buktiUploading/buktiError`; method `onBuktiFile`, `uploadBuktiBayar` (readFileAsBase64 → `uploadBuktiAdmin` → `reloadDetail`).

- [x] Backend + RPC
- [x] Kartu UI
- [x] Tes + commit `830231d`, deploy `fb6cc890-6d2c-45d2-b07c-f1d5463161a8`

### Task 4: Scan kamera bukti bayar

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`, `new-code1-cf/test/dashboard-template.test.js`

**Ringkasan:**
- Input `<input ref="buktiCamera" accept="image/*" capture="environment" multiple @change="scanOnPhotos($event,'bukti')">`.
- Tombol **Scan Kamera** / **Buat PDF** / **Bersihkan**, grid thumbnail (hapus + geser kiri/kanan), indikator proses.
- `scanTarget('bukti')` → `this.detail`; state scan (`scanItems/scanBusy/scanSeq`) pada `detail`, direset saat modal dibuka/ganti pengajuan.
- `scanBuildPdf('bukti')` menamai berkas `Bukti-Bayar-Scan-<stamp>.pdf` dan menyetel `detail.buktiFile`, siap diunggah lewat "Unggah Bukti Bayar".

- [x] UI scan kamera + state
- [x] Tes (326/326, 38 file) + commit `97d2bab`, deploy `af0b9df8-7ff4-4f84-9ac4-c7e36b080cbe`

## Coverage

| Fitur | Task | Commit | Deploy version |
|---|---|---|---|
| Tab Manual + kolom Sumber | 1 | `52dcf5d` | — |
| Opsi status ACC | 2 | `1902c14` | — |
| Unggah bukti bayar admin | 3 | `830231d` | `fb6cc890-6d2c-45d2-b07c-f1d5463161a8` |
| Scan kamera bukti bayar | 4 | `97d2bab` | `af0b9df8-7ff4-4f84-9ac4-c7e36b080cbe` |

**Branch:** `feat/new-code2-ci4-inhal` (GitHub `Inhal-my/DASHBOARD-INHAL`).
**Worker:** `inhal-form` — https://inhal-form.prodi.workers.dev

---

## Port ke Google Apps Script (GAS)

Empat fitur yang sama diport ke dua aplikasi GAS: `new-code1/` (Vue 3 CDN di `pages/dashboard.html`, `0_code.gs`/`1_business.gs`) dan aplikasi legacy di root (`Code.js` + `dashboard.html` jQuery/Bootstrap + `bagian.html`). Aplikasi GAS tidak memakai D1; sumber data adalah Google Sheets/Drive.

### new-code1

| Fitur | Ringkasan | Commit |
|---|---|---|
| A Tab Manual + kolom `Sumber` | `SCHEMAS.Pengajuan` + `Sumber`; `registerManualPengajuan` + `_createPengajuan`; tab & form Manual; badge; email nonaktif | `fec949e` |
| B Opsi status ACC | opsi `ACC` + tombol cepat; `askConfirm` tanpa email | `c7dca6b` |
| C Unggah bukti bayar admin | kartu di modal detail; backend `uploadBuktiAdmin` (Drive `bukti-<id>`, update `Link Bukti Bayar`, `writeAuditLog` `UPLOAD_BUKTI_ADMIN`) | `c5cdd72` |
| D Scan kamera (bukti + BA) | `ScanPdf` di-inline di `dashboard.html`; target `bukti`/`pendukung`/`pelaksanaan`; `scanBuildPdf` → `*.pdf` | `26abde2` |

- Tes: `node --test 'test/*.test.mjs'` → 53/53. Deploy GAS manual (Apps Script editor → New version).

### Root GAS (legacy)

| Fitur | Ringkasan | Commit |
|---|---|---|
| A Tab Manual + kolom `Sumber` | Tab sidebar baru + `#tab-manual`; backend `registerManualPengajuan` (`requireAuthorized`, `_ensureLogDataColumn('Sumber')`); `Sumber` di `getCheckPageData`; badge Manual. Tab `#tab-pengajuan` (stub) dibiarkan | `c8ad247` |
| B Status ACC asli | `normalizeStatus` → `ACC` (bukan Diterima); kartu ringkasan ACC; filter + badge; tombol "Jadikan ACC"; backend `updateStatusAndSendEmail` cabang `ACC` menyimpan tanpa PDF/email | `42fd1d8` |
| C Unggah bukti bayar admin | kontrol unggah di modal detail; backend `uploadBuktiAdmin(rowIndex,fileData,existingAccUrl)` → Drive + `_saveToLogUpload`, mempertahankan URL ACC | `4a3a155` |
| D Scan kamera (bukti + BA) | `ScanPdf` di-inline di `dashboard.html` & `bagian.html`; scan pada bukti bayar, BA admin (`#baCameraInput`), dan BA bagian (`#ba-camera-input`); `Buat PDF` menghasilkan `File` yang dipakai jalur unggah yang ada | `fc39a67` |

**Keputusan desain (dikonfirmasi pengguna):**
- Tab Manual di root = tab sidebar **baru** (bukan mengisi stub `#tab-pengajuan`).
- `ACC` = status tersimpan terpisah, **tanpa** email/PDF (template root tidak punya varian ACC).
- Engine scan = builder PDF vanilla di-inline (tanpa jsPDF/CDN), sama seperti `new-code1-cf/public/scan-pdf.js`.
- Batas berkas: bukti bayar 5 MB; BA admin tetap 10 MB sesuai UI lama; scan PDF mengikuti batas masing-masing.
