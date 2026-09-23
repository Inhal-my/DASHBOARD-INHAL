# Download Database (Excel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin mengunduh seluruh isi D1 sebagai satu file `.xlsx` (satu sheet per tabel) dari kartu Master Data **Download Database**.

**Architecture:** Fungsi murni merakit OOXML/ZIP di Worker. Endpoint baru `POST /api/database-export` (bukan `/api/rpc`) cek sesi admin, baca semua tabel D1, kirim biner xlsx. Dashboard fetch blob dan simpan file.

**Tech Stack:** Cloudflare Workers, Hono, D1, Vitest + `@cloudflare/vitest-pool-workers`, Vue 3 CDN di `dashboard.html`. Tanpa library xlsx npm (ZIP store + SpreadsheetML inlineStr, kompatibel Workers).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-18-download-database-xlsx-design.md`
- Semua tabel user D1, tanpa kecuali (termasuk hash, token, `uploads.content`).
- Sel > 32767 karakter dipotong; kolom `_truncated` = `1` atau `0`.
- Auth: `requireAdmin`; 401 pesan `Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.`
- Gagal generate: 200 bukan file setengah jadi; HTTP 500 `{ success: false, message: "Gagal mengunduh database." }`
- Nama file: `inhal-database-YYYY-MM-DD.xlsx` (tanggal Asia/Jakarta).
- Tidak mendaftarkan `downloadDatabase` di `rpc.js`. Tidak mengubah `gs-shim.js`.
- Tanpa komentar kode baru. Perintah tes dari `new-code1-cf/`: `npx vitest run <file>`.

---

### Task 1: Builder XLSX murni

**Files:**
- Create: `new-code1-cf/src/xlsxExport.js`
- Test: `new-code1-cf/test/xlsx-export.test.js`

**Interfaces:**
- Produces:
  - `EXCEL_MAX_CELL = 32767`
  - `prepareCell(value) => { text: string, truncated: boolean }`
  - `buildXlsx(tables) => Uint8Array` di mana `tables` adalah array `{ name, columns: string[], rows: object[] }` terurut; setiap sheet menambah kolom `_truncated`.

- [ ] **Step 1: Write the failing test** in `new-code1-cf/test/xlsx-export.test.js`
- [ ] **Step 2:** `npx vitest run test/xlsx-export.test.js` — FAIL (modul belum ada)
- [ ] **Step 3:** Implement `xlsxExport.js` (ZIP store + worksheet inlineStr)
- [ ] **Step 4:** Tes hijau
- [ ] **Step 5:** Commit

Tes wajib: magic `PK`; sheet per tabel; tabel kosong hanya header; nilai rahasia ikut; sel > 32767 terpotong + `_truncated`; nama tabel ada di workbook.

### Task 2: Endpoint `POST /api/database-export`

**Files:**
- Create: `new-code1-cf/src/databaseExport.js`
- Modify: `new-code1-cf/src/index.js`
- Test: `new-code1-cf/test/database-export.test.js`

**Interfaces:**
- Produces: `exportDatabase(db, token, now?) => Promise<{ status, headers, body }>`
  - sukses: status 200, content-type spreadsheetml, Content-Disposition attachment filename `inhal-database-YYYY-MM-DD.xlsx`, body Uint8Array
  - 401 / 500 sesuai spec
- `listUserTables(db)`, `readAllTables(db)`

- [ ] Tes: tanpa token / bukan admin → 401; admin → 200 + isi D1 termasuk seed mahasiswa dan insert hash/token/content; RPC `downloadDatabase` tetap stub; tabel sqlite_% tidak jadi sheet
- [ ] Implement handler + route
- [ ] Commit

### Task 3: Kartu UI Master Data

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Modify: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Kartu `downloadDatabase` (`settings: true`, `download: true`), panel peringatan + tombol, method `downloadDatabase()` fetch `/api/database-export`.

- [ ] Tes template: kartu, judul, peringatan, `@click="downloadDatabase"`, tidak lewat `google.script.run` untuk export ini
- [ ] Implement UI + `master.downloading`
- [ ] `npx vitest run` seluruh tes
- [ ] Commit

## Spec coverage

| Spec | Task |
|---|---|
| Kartu Master Data Download Database | 3 |
| Endpoint khusus bukan RPC | 2 |
| Semua tabel + kolom sensitif | 1+2 |
| Potong 32767 + `_truncated` | 1 |
| Auth admin / 401 / 500 | 2 |
| Nama file tanggal Jakarta | 2 |
| Tes template kartu | 3 |
