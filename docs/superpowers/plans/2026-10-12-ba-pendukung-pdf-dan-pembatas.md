# BA Pendukung — Berkas PDF & Add-in Sampul/Pembatas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin dapat melampirkan berkas PDF (hasil scanner) per mahasiswa ke BA Pendukung, dan PDF gabungan diberi sampul + halaman pembatas per mahasiswa tanpa mengubah halaman asli.

**Architecture:** Simpan satu berkas Drive per baris `berita_acara_admin_berkas` dengan kolom `page_count` (gambar = 1, PDF = N). Penggabungan di worker memakai `pdf-lib`: gambar di-embed (`embedJpg`/`embedPng`), PDF disalin halamannya (`copyPages`, `ignoreEncryption`), lalu halaman sampul/pembatas teks ditambahkan. Halaman asli tidak digambar apa pun.

**Tech Stack:** Cloudflare Worker (ESM, `nodejs_compat`), D1, `pdf-lib@^1.17.1`, frontend Vue 3 in-page (`public/dashboard.html`, tanpa build). Tes: `vitest` + `@cloudflare/vitest-pool-workers`.

## Global Constraints

- Bahasa Indonesia untuk semua pesan yang dilihat pengguna.
- Tanpa langkah build frontend, tanpa CDN baru; Tailwind = `<style>` inline. Kelas baru ditulis manual.
- Format berkas yang diterima per mahasiswa: `image/jpeg`, `image/jpg`, `image/png`, `application/pdf`.
- Batas: 50 halaman (Σ `page_count` berkas aktif) dan 20 MB total halaman sumber per BA.
- Add-in hanya teks (font standar `Helvetica`/`HelveticaBold`); **tidak** menggambar di atas halaman hasil scan/PDF asli; nomor halaman hanya di halaman yang dibuat server.
- Jalankan tes: `cd new-code1-cf && npx vitest run <file>`. Flake pra-ada `test/write-berita-acara.test.js` boleh diulang bila error jaringan transien.
- Jangan commit `.wrangler/`, `node_modules/`, `mockups/dashboard-redesign/`.
- Jangan jalankan perintah hapus destruktif. Commit sekali per task.
- Migrasi diterapkan per-file via `wrangler d1 execute` (bukan `wrangler d1 migrations apply`); `ALTER TABLE ADD COLUMN` tidak bisa diulang.

---

### Task 1: Skema & migrasi kolom `page_count`

**Files:**
- Create: `new-code1-cf/migrations/2026-10-12-ba-pendukung-pdf.sql`
- Modify: `new-code1-cf/schema.sql:135-139` (tabel `berita_acara_admin_berkas`)
- Modify: `new-code1-cf/DEPLOY.md` (tambahkan §3.2)
- Test: `new-code1-cf/test/migration-ba-pendukung-pdf.test.js`
- Test: `new-code1-cf/test/schema-ba-admin-berkas.test.js`

**Interfaces:**
- Consumes: tidak ada.
- Produces: kolom `page_count INTEGER DEFAULT 1` pada `berita_acara_admin_berkas`; data lama otomatis bernilai `1`.

- [ ] **Step 1: Tulis tes migrasi yang gagal**

Create `new-code1-cf/test/migration-ba-pendukung-pdf.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-12-ba-pendukung-pdf.sql?raw';

const statements = String(migrationSql).split(';').map((s) => s.trim()).filter(Boolean);

async function columnInfo(table, name) {
  const rows = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  return (rows.results || []).find((r) => r.name === name) || null;
}

async function simulatePreMigrationBerkas() {
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara_admin_berkas').run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara_admin_berkas (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, id_pengajuan TEXT, npm TEXT, ' +
      'urutan INTEGER, page_index INTEGER, file_name TEXT, file_url TEXT, ' +
      'active INTEGER DEFAULT 1, superseded_at TEXT)'
  ).run();
}

describe('migrasi ba-pendukung-pdf', () => {
  it('menambah kolom page_count default 1 tanpa kehilangan data lama', async () => {
    await simulatePreMigrationBerkas();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,active) VALUES ('2026-10-12T00:00:00','BA-PEN-2026-0001','INHAL-1','2201010001',1,0,'p1.jpg','https://drive/1',1)"
    ).run();

    for (const stmt of statements) await env.DB.prepare(stmt).run();

    const info = await columnInfo('berita_acara_admin_berkas', 'page_count');
    expect(info).toBeTruthy();
    expect(String(info.dflt_value)).toBe('1');

    const row = await env.DB.prepare('SELECT file_url, page_count FROM berita_acara_admin_berkas').first();
    expect(row.file_url).toBe('https://drive/1');
    expect(Number(row.page_count)).toBe(1);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `cd new-code1-cf && npx vitest run test/migration-ba-pendukung-pdf.test.js`
Expected: FAIL — gagal memuat `../migrations/2026-10-12-ba-pendukung-pdf.sql` (file belum ada).

- [ ] **Step 3: Tulis file migrasi**

Create `new-code1-cf/migrations/2026-10-12-ba-pendukung-pdf.sql`:

```sql
ALTER TABLE berita_acara_admin_berkas ADD COLUMN page_count INTEGER DEFAULT 1;
```

- [ ] **Step 4: Sinkronkan `schema.sql`**

Modify `new-code1-cf/schema.sql` tabel `berita_acara_admin_berkas` menjadi:

```sql
CREATE TABLE berita_acara_admin_berkas (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, id_pengajuan TEXT, npm TEXT,
  urutan INTEGER, page_index INTEGER, file_name TEXT, file_url TEXT,
  page_count INTEGER DEFAULT 1, active INTEGER DEFAULT 1, superseded_at TEXT
);
```

- [ ] **Step 5: Tambahkan tes skema `page_count`**

Append ke `new-code1-cf/test/schema-ba-admin-berkas.test.js` di dalam `describe`:

```js
  it('menyimpan jumlah halaman berkas (page_count)', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,page_count,active) VALUES ('2026-10-12T00:00:00','BA-PEN-2026-0001','INHAL-1','2201010001',1,0,'scan.pdf','https://drive/y',4,1)"
    ).run();
    const row = await env.DB.prepare('SELECT page_count FROM berita_acara_admin_berkas WHERE ba_id = ?1').bind('BA-PEN-2026-0001').first();
    expect(Number(row.page_count)).toBe(4);
  });
```

- [ ] **Step 6: Dokumentasikan migrasi di `DEPLOY.md`**

Tambahkan setelah §3.1 (sekitar baris 113) pada `new-code1-cf/DEPLOY.md`:

````markdown
### 3.2 Migrasi BA Pendukung — berkas PDF (sekali, sebelum deploy Worker baru)

Migrasi `2026-10-12-ba-pendukung-pdf.sql` menambah kolom `page_count` pada
`berita_acara_admin_berkas` (jumlah halaman tiap berkas: gambar = 1, PDF = N).
Jalankan **sebelum** men-deploy Worker baru:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=./migrations/2026-10-12-ba-pendukung-pdf.sql
```

> **Penting — sekali jalan.** `ALTER TABLE ADD COLUMN` tidak bisa diulang
> (gagal `duplicate column name`). Jangan mengulang file yang sudah diterapkan.
````

- [ ] **Step 7: Jalankan tes, pastikan lulus**

Run: `cd new-code1-cf && npx vitest run test/migration-ba-pendukung-pdf.test.js test/schema-ba-admin-berkas.test.js`
Expected: PASS (4 tes).

- [ ] **Step 8: Commit**

```bash
cd /workspace && git add new-code1-cf/migrations/2026-10-12-ba-pendukung-pdf.sql new-code1-cf/schema.sql new-code1-cf/DEPLOY.md new-code1-cf/test/migration-ba-pendukung-pdf.test.js new-code1-cf/test/schema-ba-admin-berkas.test.js
git commit -m "feat(ba-pendukung): kolom page_count berkas + migrasi PDF"
```

---

### Task 2: `mergeBaFilesToPdf` — gabung gambar + PDF + add-in sampul/pembatas

**Files:**
- Modify: `new-code1-cf/src/baMerge.js` (ditulis ulang)
- Modify: `new-code1-cf/src/write/baAdmin.js:6` (import) dan `:343-349` (pemanggilan)
- Test: `new-code1-cf/test/baMerge.test.js` (ditulis ulang)

**Interfaces:**
- Consumes: `pdf-lib`.
- Produces: `mergeBaFilesToPdf(input) -> { bytes, sourcePages, outputPages }` dengan
  `input = { ba: { bagian, blok, namaKegiatan, tanggal } | null, peserta: [{ urutan, nama, npm, halaman }], groups: [{ peserta: { urutan, nama, npm, blok }, files: [{ bytes, mime }] }] }`.
  - `bytes` = `Uint8Array` PDF; `sourcePages` = jumlah halaman sumber; `outputPages` = total halaman keluaran (termasuk add-in).
  - Melempar `Error('Tidak ada halaman gambar yang valid.')` bila tidak ada halaman sumber valid.

- [ ] **Step 1: Tulis tes yang gagal (tulis ulang `test/baMerge.test.js`)**

Replace seluruh isi `new-code1-cf/test/baMerge.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergeBaFilesToPdf } from '../src/baMerge.js';

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
function png() { return Uint8Array.from(atob(PNG_1x1), (c) => c.charCodeAt(0)); }
async function pdf(pageCount) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) d.addPage([200, 300]);
  return await d.save();
}
const BA = { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-10-20' };

describe('mergeBaFilesToPdf', () => {
  it('menggabungkan gambar & PDF, sampul + pembatas, hitungan halaman benar', async () => {
    const out = await mergeBaFilesToPdf({
      ba: BA,
      peserta: [{ urutan: 1, nama: 'Aisyah', npm: '2201', halaman: 3 }],
      groups: [{
        peserta: { urutan: 1, nama: 'Aisyah', npm: '2201', blok: 'A' },
        files: [{ bytes: png(), mime: 'image/png' }, { bytes: await pdf(2), mime: 'application/pdf' }]
      }]
    });
    expect(out.sourcePages).toBe(3);
    expect(out.outputPages).toBe(5); // sampul(1) + pembatas(1) + 3 halaman sumber
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPageCount()).toBe(5);
  });

  it('tanpa add-in saat ba tidak diberikan dan peserta kosong', async () => {
    const out = await mergeBaFilesToPdf({
      ba: null,
      peserta: [],
      groups: [{ peserta: {}, files: [{ bytes: png(), mime: 'image/png' }] }]
    });
    expect(out.sourcePages).toBe(1);
    expect(out.outputPages).toBe(1);
  });

  it('melewati berkas tanpa byte', async () => {
    const out = await mergeBaFilesToPdf({
      ba: null,
      groups: [{ peserta: {}, files: [{ bytes: new Uint8Array(0) }, { bytes: png(), mime: 'image/png' }] }]
    });
    expect(out.sourcePages).toBe(1);
  });

  it('melewati PDF rusak tetapi tetap memakai halaman valid lain', async () => {
    const brokenPdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x00, 0x01]);
    const out = await mergeBaFilesToPdf({
      ba: null,
      groups: [{ peserta: {}, files: [{ bytes: brokenPdf, mime: 'application/pdf' }, { bytes: png(), mime: 'image/png' }] }]
    });
    expect(out.sourcePages).toBe(1);
  });

  it('melempar bila tidak ada halaman valid', async () => {
    await expect(mergeBaFilesToPdf({ ba: null, groups: [] })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `cd new-code1-cf && npx vitest run test/baMerge.test.js`
Expected: FAIL — `mergeBaFilesToPdf` tidak diekspor (`SyntaxError`/import kosong).

- [ ] **Step 3: Tulis ulang `src/baMerge.js`**

Replace seluruh isi `new-code1-cf/src/baMerge.js`:

```js
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const A4_SHORT = 595.28;
const A4_LONG = 841.89;
const MARGIN = 24;
const TEXT_DARK = rgb(0.1, 0.1, 0.1);
const FOOTER_GRAY = rgb(0.55, 0.55, 0.55);

function toBytes(b) {
  if (!b) return null;
  if (b instanceof Uint8Array) return b;
  try { return new Uint8Array(b); } catch (e) { return null; }
}
function looksPng(bytes) { return bytes && bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47; }
function looksPdf(bytes) { return bytes && bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; }

function isPdfFile(file) {
  const mime = String((file && file.mime) || '').toLowerCase();
  if (mime === 'application/pdf') return true;
  return looksPdf(toBytes(file && file.bytes));
}

async function addImagePage(doc, bytes, mime) {
  const isPng = mime === 'image/png' || looksPng(bytes);
  const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const w = img.width;
  const h = img.height;
  const landscape = w > h;
  const pw = landscape ? A4_LONG : A4_SHORT;
  const ph = landscape ? A4_SHORT : A4_LONG;
  const aw = pw - MARGIN * 2;
  const ah = ph - MARGIN * 2;
  const scale = Math.min(aw / w, ah / h);
  const dw = w * scale;
  const dh = h * scale;
  const page = doc.addPage([pw, ph]);
  page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
}

async function copyPdfPages(doc, bytes) {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const copied = await doc.copyPages(src, src.getPageIndices());
  for (const p of copied) doc.addPage(p);
  return copied.length;
}

function fitText(text, font, size, maxWidth) {
  const str = String(text == null ? '' : text);
  if (font.widthOfTextAtSize(str, size) <= maxWidth) return str;
  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(str.slice(0, mid) + '\u2026', size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return str.slice(0, lo) + '\u2026';
}

function addCoverPage(doc, ba, peserta, helv, helvBold) {
  const pw = A4_SHORT;
  const ph = A4_LONG;
  const page = doc.addPage([pw, ph]);
  const left = MARGIN + 16;
  const maxW = pw - left * 2;
  let y = ph - 90;
  page.drawText('BERITA ACARA PENDUKUNG', { x: left, y: y, size: 16, font: helvBold, color: TEXT_DARK });
  y -= 40;
  const lines = [
    'Bagian: ' + (ba.bagian || '-'),
    'Blok: ' + (ba.blok || '-'),
    'Kegiatan: ' + (ba.namaKegiatan || '-'),
    'Tanggal: ' + (ba.tanggal || '-')
  ];
  for (const ln of lines) {
    page.drawText(fitText(ln, helv, 11, maxW), { x: left, y: y, size: 11, font: helv, color: TEXT_DARK });
    y -= 20;
  }
  y -= 20;
  page.drawText('Daftar Peserta', { x: left, y: y, size: 12, font: helvBold, color: TEXT_DARK });
  y -= 22;
  let no = 0;
  for (const pe of (peserta || [])) {
    no += 1;
    const halaman = pe.halaman ? (pe.halaman + ' hal.') : 'belum ada berkas';
    const row = no + '. ' + (pe.nama || pe.npm || '-') + ' (' + (pe.npm || '-') + ') - ' + halaman;
    page.drawText(fitText(row, helv, 10, maxW), { x: left, y: y, size: 10, font: helv, color: TEXT_DARK });
    y -= 16;
    if (y < MARGIN + 40) break;
  }
  return page;
}

function addSeparatorPage(doc, pe, index, total, helv, helvBold) {
  const pw = A4_SHORT;
  const ph = A4_LONG;
  const page = doc.addPage([pw, ph]);
  const left = MARGIN + 16;
  const maxW = pw - left * 2;
  let y = ph - 120;
  page.drawText('PESERTA ' + index + ' / ' + total, { x: left, y: y, size: 12, font: helvBold, color: TEXT_DARK });
  y -= 30;
  const lines = ['Nama: ' + (pe.nama || '-'), 'NPM: ' + (pe.npm || '-'), 'Blok: ' + (pe.blok || '-')];
  for (const ln of lines) {
    page.drawText(fitText(ln, helv, 12, maxW), { x: left, y: y, size: 12, font: helv, color: TEXT_DARK });
    y -= 20;
  }
  return page;
}

export async function mergeBaFilesToPdf(input) {
  const cfg = input || {};
  const groups = Array.isArray(cfg.groups) ? cfg.groups : [];
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const generated = [];

  if (cfg.ba) generated.push(addCoverPage(doc, cfg.ba, cfg.peserta || [], helv, helvBold));

  const withFiles = groups.filter((g) => g && Array.isArray(g.files) && g.files.length);
  let sourcePages = 0;
  let sepIndex = 0;
  for (const g of withFiles) {
    const pe = g.peserta || {};
    if (pe.nama || pe.npm) {
      sepIndex += 1;
      generated.push(addSeparatorPage(doc, pe, sepIndex, withFiles.length, helv, helvBold));
    }
    for (const f of g.files) {
      const bytes = toBytes(f && f.bytes);
      if (!bytes || !bytes.length) continue;
      try {
        if (isPdfFile(f)) sourcePages += await copyPdfPages(doc, bytes);
        else { await addImagePage(doc, bytes, String((f && f.mime) || '')); sourcePages += 1; }
      } catch (e) {
        continue;
      }
    }
  }
  if (!sourcePages) throw new Error('Tidak ada halaman gambar yang valid.');

  const all = doc.getPages();
  const total = all.length;
  for (const page of generated) {
    const idx = all.indexOf(page) + 1;
    if (idx > 0) page.drawText('Hal. ' + idx + '/' + total, { x: MARGIN + 16, y: 20, size: 8, font: helv, color: FOOTER_GRAY });
  }

  const bytes = await doc.save();
  return { bytes: bytes, sourcePages: sourcePages, outputPages: total };
}
```

- [ ] **Step 4: Jalankan tes baMerge, pastikan lulus**

Run: `cd new-code1-cf && npx vitest run test/baMerge.test.js`
Expected: PASS (5 tes).

- [ ] **Step 5: Sesuaikan pemanggil di `src/write/baAdmin.js` agar suite tetap hijau**

Modify import di `new-code1-cf/src/write/baAdmin.js:6` menjadi:

```js
import { mergeBaFilesToPdf } from '../baMerge.js';
```

Modify blok di `new-code1-cf/src/write/baAdmin.js` (sekitar baris 343-349) dari:

```js
    const merged = await mergeImagesToPdf(pages);
    const up = await saveDriveFile(ctx.env, { data: bytesToBase64(merged.bytes), mimeType: 'application/pdf', name: 'ba-' + id + '.pdf' }, 'ba-admin-' + id + '-pdf', { allowedMime: ['application/pdf'], maxBytes: BA_ADMIN_MAX_BYTES, label: 'PDF BA' });
    if (!up.ok) throw new Error(up.message || 'Gagal mengunggah PDF BA.');
    const ts = nowIso();
    await db.prepare('UPDATE berita_acara_admin SET file_url = ?1, file_name = ?2, needs_regen = 0, updated_at = ?3 WHERE ba_id = ?4')
      .bind(up.url, String(up.name || ''), ts, id).run();
    return { success: true, fileUrl: up.url, pages: merged.pages };
```

menjadi:

```js
    const merged = await mergeBaFilesToPdf({
      ba: { bagian: str(ba.bagian), blok: str(ba.blok), namaKegiatan: str(ba.nama_kegiatan), tanggal: str(ba.tanggal_pelaksanaan) },
      peserta: [],
      groups: [{ peserta: {}, files: pages }]
    });
    const up = await saveDriveFile(ctx.env, { data: bytesToBase64(merged.bytes), mimeType: 'application/pdf', name: 'ba-' + id + '.pdf' }, 'ba-admin-' + id + '-pdf', { allowedMime: ['application/pdf'], maxBytes: BA_ADMIN_MAX_BYTES, label: 'PDF BA' });
    if (!up.ok) throw new Error(up.message || 'Gagal mengunggah PDF BA.');
    const ts = nowIso();
    await db.prepare('UPDATE berita_acara_admin SET file_url = ?1, file_name = ?2, needs_regen = 0, updated_at = ?3 WHERE ba_id = ?4')
      .bind(up.url, String(up.name || ''), ts, id).run();
    return { success: true, fileUrl: up.url, pages: merged.sourcePages };
```

- [ ] **Step 6: Jalankan tes regenerasi, pastikan tidak ada regresi**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-regenerate.test.js`
Expected: PASS (5 tes).

- [ ] **Step 7: Commit**

```bash
cd /workspace && git add new-code1-cf/src/baMerge.js new-code1-cf/src/write/baAdmin.js new-code1-cf/test/baMerge.test.js
git commit -m "feat(ba-pendukung): mergeBaFilesToPdf (gambar+PDF, sampul & pembatas)"
```

---

### Task 3: Regenerate per-peserta (grup) + `pageCount` pada baca modal

**Files:**
- Modify: `new-code1-cf/src/write/baAdmin.js` (`runRegenerateBaAdminPdf` ~306-358, `getBaAdminForPengajuan` ~282-297)
- Test: `new-code1-cf/test/ba-admin-regenerate.test.js`

**Interfaces:**
- Consumes: `mergeBaFilesToPdf` (Task 2), kolom `page_count` (Task 1).
- Produces: `getBaAdminForPengajuan(...).data.peserta[].pages` = Σ `page_count`; `.files[]` menyertakan `pageCount`. Regenerate menyusun `[Sampul] + [Pembatas + berkas]` per peserta urut `urutan`.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan ke `new-code1-cf/test/ba-admin-regenerate.test.js` (di dalam `describe`, dan tambahkan import di atas):

```js
import { PDFDocument } from 'pdf-lib';
import { getBaAdminForPengajuan } from '../src/write/baAdmin.js';

async function pdfB64(pageCount) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) d.addPage([200, 300]);
  const bytes = await d.save();
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
```

Tes 1 — PDF per mahasiswa tersalin ke gabungan (hitung halaman output):

```js
  it('menyalin halaman PDF peserta + sampul/pembatas ke PDF gabungan', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await env.DB.prepare("INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,page_count,active) VALUES ('2026-10-12T00:00:00',?1,'INHAL-1','2201010001',1,0,'scan.pdf','https://drive.google.com/file/d/AAAABBBBCCCCDDDDEEEEFFFFGGGG12345/view',2,1)").bind(baId).run();
    const scan = await pdfB64(2);
    let saved = '';
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === 'getFile') return new Response(JSON.stringify({ success: true, base64: scan, mimeType: 'application/pdf' }), { status: 200 });
      saved = body.base64;
      return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/NEWNEWNEWNEWNEWNEWNEWNEWNEW1/view', fileId: 'NEWNEWNEWNEWNEWNEWNEWNEW1' }), { status: 200 });
    }));
    const res = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(res.success).toBe(true);
    const bytes = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(4); // sampul(1) + pembatas(1) + 2 halaman PDF
  });
```

Tes 2 — `pages` = Σ `page_count`:

```js
  it('melaporkan jumlah halaman = total page_count', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await env.DB.prepare("INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,page_count,active) VALUES ('2026-10-12T00:00:00',?1,'INHAL-1','2201010001',1,0,'scan.pdf','https://drive/x',4,1)").bind(baId).run();
    const got = await getBaAdminForPengajuan(env.DB, 'INHAL-1', ctx);
    expect(got.data.peserta[0].pages).toBe(4);
    expect(got.data.peserta[0].files[0].pageCount).toBe(4);
  });
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-regenerate.test.js`
Expected: FAIL — output gabungan belum berisi pembatas (getPageCount = 3 bukan 4), dan `pages` masih berupa jumlah baris (1 bukan 4).

- [ ] **Step 3: Ubah `runRegenerateBaAdminPdf` menjadi berbasis grup**

Di `new-code1-cf/src/write/baAdmin.js`, ganti query berkas dan blok pengambilan halaman di dalam `runRegenerateBaAdminPdf`. Ganti dari:

```js
    const rows = (await db.prepare(
      'SELECT b.* FROM berita_acara_admin_berkas b ' +
      'JOIN berita_acara_admin_peserta p ON p.ba_id = b.ba_id AND p.id_pengajuan = b.id_pengajuan ' +
      'WHERE b.ba_id = ?1 AND b.active = 1 AND p.active = 1 ' +
      'ORDER BY p.urutan, b.page_index'
    ).bind(id).all()).results || [];
```

menjadi:

```js
    const rows = (await db.prepare(
      'SELECT b.*, p.nama_lengkap AS p_nama, p.urutan AS p_urutan FROM berita_acara_admin_berkas b ' +
      'JOIN berita_acara_admin_peserta p ON p.ba_id = b.ba_id AND p.id_pengajuan = b.id_pengajuan ' +
      'WHERE b.ba_id = ?1 AND b.active = 1 AND p.active = 1 ' +
      'ORDER BY p.urutan, b.page_index'
    ).bind(id).all()).results || [];

    const allPeserta = (await db.prepare('SELECT * FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1 ORDER BY urutan').bind(id).all()).results || [];
```

Lalu ganti blok batas + perakitan `pages` (dari `if (rows.length > BA_ADMIN_MAX_PAGES) {` sampai `pages.push({ bytes: base64ToBytes(got.base64), mime: got.mime });` dan `}` penutup loop) menjadi:

```js
    const totalSourcePages = rows.reduce((s, r) => s + (Number(r.page_count) || 1), 0);
    if (totalSourcePages > BA_ADMIN_MAX_PAGES) {
      await db.prepare('UPDATE berita_acara_admin SET needs_regen = 1 WHERE ba_id = ?1').bind(id).run();
      return { success: false, message: 'Batas ' + BA_ADMIN_MAX_PAGES + ' halaman terlampaui.' };
    }

    const pagesByPid = {};
    for (const r of rows) {
      const pid = str(r.id_pengajuan);
      pagesByPid[pid] = (pagesByPid[pid] || 0) + (Number(r.page_count) || 1);
    }
    const pesertaList = allPeserta.map((r) => ({
      urutan: Number(r.urutan) || 0, nama: str(r.nama_lengkap), npm: str(r.npm),
      halaman: pagesByPid[str(r.id_pengajuan)] || 0
    }));

    const groupMap = new Map();
    for (const r of rows) {
      const pid = str(r.id_pengajuan);
      if (!groupMap.has(pid)) groupMap.set(pid, { peserta: { urutan: Number(r.p_urutan) || 0, nama: str(r.p_nama), npm: str(r.npm), blok: '' }, rows: [] });
      groupMap.get(pid).rows.push(r);
    }

    const groups = [];
    let totalBytes = 0;
    for (const g of groupMap.values()) {
      const files = [];
      for (const r of g.rows) {
        const fileId = parseDriveFileId(r.file_url);
        const got = await getDriveFileBase64(ctx.env, fileId);
        if (!got.ok) throw new Error(got.message || 'Gagal mengambil berkas.');
        totalBytes += decodeBase64Size(got.base64);
        if (totalBytes > BA_ADMIN_MAX_BYTES) {
          await db.prepare('UPDATE berita_acara_admin SET needs_regen = 1 WHERE ba_id = ?1').bind(id).run();
          return { success: false, message: 'Total ukuran halaman melebihi 20 MB.' };
        }
        files.push({ bytes: base64ToBytes(got.base64), mime: got.mime });
      }
      groups.push({ peserta: g.peserta, files: files });
    }
```

Ganti pemanggilan merge:

```js
    const merged = await mergeBaFilesToPdf({
      ba: { bagian: str(ba.bagian), blok: str(ba.blok), namaKegiatan: str(ba.nama_kegiatan), tanggal: str(ba.tanggal_pelaksanaan) },
      peserta: pesertaList,
      groups: groups
    });
```

(`return { success: true, fileUrl: up.url, pages: merged.sourcePages };` sudah benar dari Task 2.)

- [ ] **Step 4: Ubah `getBaAdminForPengajuan` agar `pages` = Σ `page_count`**

Di `new-code1-cf/src/write/baAdmin.js`, ganti blok pembangunan `filesByNpm` dan `peserta` (sekitar baris 283-297) dari:

```js
    const filesByNpm = {};
    for (const b of berkas) {
      const k = str(b.npm);
      if (!filesByNpm[k]) filesByNpm[k] = [];
      filesByNpm[k].push({ pageIndex: Number(b.page_index) || 0, fileUrl: str(b.file_url) });
    }
    peserta = rows.map((r) => {
      const files = filesByNpm[str(r.npm)] || [];
      return {
        idPengajuan: str(r.id_pengajuan), npm: str(r.npm), namaLengkap: str(r.nama_lengkap),
        blok: str(r.blok), urutan: Number(r.urutan) || 0, pages: files.length,
        fileUrl: files.length ? files[0].fileUrl : '', files,
        isCurrent: str(r.id_pengajuan) === id
      };
    });
```

menjadi:

```js
    const filesByNpm = {};
    for (const b of berkas) {
      const k = str(b.npm);
      if (!filesByNpm[k]) filesByNpm[k] = [];
      filesByNpm[k].push({ pageIndex: Number(b.page_index) || 0, fileUrl: str(b.file_url), pageCount: Number(b.page_count) || 1 });
    }
    peserta = rows.map((r) => {
      const files = filesByNpm[str(r.npm)] || [];
      const totalPages = files.reduce((s, f) => s + (f.pageCount || 1), 0);
      return {
        idPengajuan: str(r.id_pengajuan), npm: str(r.npm), namaLengkap: str(r.nama_lengkap),
        blok: str(r.blok), urutan: Number(r.urutan) || 0, pages: totalPages,
        fileUrl: files.length ? files[0].fileUrl : '', files,
        isCurrent: str(r.id_pengajuan) === id
      };
    });
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-regenerate.test.js test/rpc-ba-admin.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /workspace && git add new-code1-cf/src/write/baAdmin.js new-code1-cf/test/ba-admin-regenerate.test.js
git commit -m "feat(ba-pendukung): regenerate per-peserta + laporan page_count"
```

---

### Task 4: Unggah PDF + hitung/enforce `page_count`

**Files:**
- Modify: `new-code1-cf/src/write/baAdmin.js` (`countActivePages` ~149-157, `setBaAdminPesertaBerkas` ~159-233)
- Test: `new-code1-cf/test/ba-admin-berkas.test.js`

**Interfaces:**
- Consumes: kolom `page_count` (Task 1), `pdf-lib`.
- Produces: `setBaAdminPesertaBerkas(db, baId, idPengajuan, files, ctx) -> { success, pages, ... }` menerima `files = [{ data, mimeType, name }]` dengan mime gambar atau `application/pdf`; `pages` = total halaman yang baru diunggah; menyimpan `page_count` per baris.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan ke `new-code1-cf/test/ba-admin-berkas.test.js` (tambahkan `import { PDFDocument } from 'pdf-lib';` di atas), lalu:

```js
async function pdfB64(pageCount) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) d.addPage([200, 300]);
  const bytes = await d.save();
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
```

```js
  it('menerima PDF dan menyimpan page_count', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubSave();
    const res = await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [{ data: await pdfB64(3), mimeType: 'application/pdf', name: 'scan.pdf' }], ctx);
    expect(res.success).toBe(true);
    expect(res.pages).toBe(3);
    const row = await env.DB.prepare('SELECT page_count, active FROM berita_acara_admin_berkas WHERE ba_id=?1').bind(baId).first();
    expect(Number(row.page_count)).toBe(3);
    expect(Number(row.active)).toBe(1);
  });

  it('menolak format berkas yang tidak didukung', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    const res = await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [{ data: btoa('hello'), mimeType: 'text/plain', name: 'x.txt' }], ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('PDF');
  });

  it('menghitung batas dari jumlah halaman PDF', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    const res = await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [{ data: await pdfB64(BA_ADMIN_MAX_PAGES + 1), mimeType: 'application/pdf', name: 'big.pdf' }], ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('halaman');
  });
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-berkas.test.js`
Expected: FAIL — PDF ditolak ("Format halaman harus JPG atau PNG"), `page_count` tidak disimpan.

- [ ] **Step 3: Tambah import `pdf-lib`**

Di `new-code1-cf/src/write/baAdmin.js`, tambahkan di baris import:

```js
import { PDFDocument } from 'pdf-lib';
```

- [ ] **Step 4: `countActivePages` menjumlahkan `page_count`**

Ganti isi `countActivePages` di `new-code1-cf/src/write/baAdmin.js` dari:

```js
async function countActivePages(db, baId, exceptIdPengajuan) {
  const rows = (await db.prepare('SELECT id_pengajuan FROM berita_acara_admin_berkas WHERE ba_id = ?1 AND active = 1').bind(baId).all()).results || [];
  let n = 0;
  for (const r of rows) {
    if (exceptIdPengajuan && str(r.id_pengajuan) === str(exceptIdPengajuan)) continue;
    n += 1;
  }
  return n;
}
```

menjadi:

```js
async function countActivePages(db, baId, exceptIdPengajuan) {
  const rows = (await db.prepare('SELECT id_pengajuan, page_count FROM berita_acara_admin_berkas WHERE ba_id = ?1 AND active = 1').bind(baId).all()).results || [];
  let n = 0;
  for (const r of rows) {
    if (exceptIdPengajuan && str(r.id_pengajuan) === str(exceptIdPengajuan)) continue;
    n += Number(r.page_count) || 1;
  }
  return n;
}
```

- [ ] **Step 5: Terima PDF + hitung `page_count` di `setBaAdminPesertaBerkas`**

Di `new-code1-cf/src/write/baAdmin.js`, ganti blok validasi (dari `let totalBytes = 0;` sampai sebelum baris `const p = await db.prepare('SELECT * FROM pengajuan...`) menjadi:

```js
  const prepared = [];
  let newPages = 0;
  let totalBytes = 0;
  for (const f of list) {
    const mime = resolveMime(f && f.mimeType, f && f.data);
    if (mime !== 'image/jpeg' && mime !== 'image/jpg' && mime !== 'image/png' && mime !== 'application/pdf') {
      return { success: false, message: 'Format halaman harus JPG, PNG, atau PDF.' };
    }
    let pageCount = 1;
    if (mime === 'application/pdf') {
      try {
        const src = await PDFDocument.load(base64ToBytes(String(f.data)), { ignoreEncryption: true });
        pageCount = src.getPageCount();
      } catch (e) {
        return { success: false, message: 'PDF tidak dapat dibaca.' };
      }
      if (!pageCount) return { success: false, message: 'PDF tidak memiliki halaman.' };
    }
    totalBytes += decodeBase64Size(f && f.data);
    newPages += pageCount;
    prepared.push({ mime: mime, data: String(f.data), name: String(f.name || ''), pageCount: pageCount });
  }

  const others = await countActivePages(db, id, pid);
  if (others + newPages > BA_ADMIN_MAX_PAGES) {
    return { success: false, message: 'Batas ' + BA_ADMIN_MAX_PAGES + ' halaman per BA terlampaui.' };
  }
  if (totalBytes > BA_ADMIN_MAX_BYTES) {
    return { success: false, message: 'Total ukuran halaman melebihi 20 MB.' };
  }
```

(Catatan: blok lama `const others = await countActivePages(db, id, pid); if (others + list.length > ...) { ... }` dan cek `totalBytes` yang lama dihapus/digantikan oleh blok di atas.)

- [ ] **Step 6: Pakai `prepared` saat unggah dan simpan `page_count`**

Ganti blok unggah (dari `const uploaded = [];`) menjadi:

```js
  const uploaded = [];
  let page = 0;
  for (const it of prepared) {
    const up = await saveDriveFile(ctx.env, { data: it.data, mimeType: it.mime, name: it.name || ('page-' + (page + 1)) }, 'ba-admin-' + id + '-' + (npm || pid), { label: 'Halaman BA' });
    if (!up.ok) return { success: false, message: up.message };
    uploaded.push({ page: page, name: String(up.name || ''), url: up.url, pageCount: it.pageCount });
    page += 1;
  }
```

Ganti statement insert berkas menjadi menyertakan `page_count`:

```js
  for (const u of uploaded) {
    stmts.push(
      db.prepare(
        'INSERT INTO berita_acara_admin_berkas (timestamp, ba_id, id_pengajuan, npm, urutan, page_index, file_name, file_url, page_count, active) ' +
        'VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1)'
      ).bind(ts, id, pid, npm, urutanPeserta, u.page, u.name, u.url, u.pageCount)
    );
  }
```

Ganti nilai kembali:

```js
  return { success: true, pages: newPages };
```

- [ ] **Step 7: Jalankan tes, pastikan lulus**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-berkas.test.js`
Expected: PASS (8 tes).

- [ ] **Step 8: Commit**

```bash
cd /workspace && git add new-code1-cf/src/write/baAdmin.js new-code1-cf/test/ba-admin-berkas.test.js
git commit -m "feat(ba-pendukung): terima berkas PDF + hitung page_count"
```

---

### Task 5: Frontend tombol "Unggah PDF" di kartu BA Pendukung

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (template kartu ~1739-1745, input ~1765, state ~2118, method ~3415-3442)
- Test: `new-code1-cf/test/dashboard-ba-pendukung.test.js`

**Interfaces:**
- Consumes: RPC `baAdminUploadBerkas(baId, idPengajuan, files)` (tidak berubah) dengan `files = [{ data, mimeType, name }]`.
- Produces: tombol "Unggah PDF", input `accept="application/pdf"`, handler `onBaPendukungPdf`.

- [ ] **Step 1: Tambah assertion guard (gagal)**

Modify `new-code1-cf/test/dashboard-ba-pendukung.test.js` — tambahkan di dalam `it`:

```js
    expect(dashboardHtml).toContain('Unggah PDF');
    expect(dashboardHtml).toContain('accept="application/pdf"');
    expect(dashboardHtml).toContain('onBaPendukungPdf(');
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `cd new-code1-cf && npx vitest run test/dashboard-ba-pendukung.test.js`
Expected: FAIL — marker "Unggah PDF" belum ada.

- [ ] **Step 3: Tambah tombol "Unggah PDF" dan input berkas**

Di `new-code1-cf/public/dashboard.html`, pada template baris peserta (sekitar baris 1740), ubah tombol unggah agar memanggil mode scan dan tambahkan tombol PDF setelahnya:

```html
<button class="btn-soft !py-1 !px-2 text-[11px]" :disabled="detail.baPendukung.uploadBusy" @click="unggahBerkasBa(pe, 'scan')"><i class="bi bi-camera"></i> {{ pe.pages ? 'Ganti berkas' : 'Unggah/Scan' }}</button>
<button class="btn-soft !py-1 !px-2 text-[11px]" :disabled="detail.baPendukung.uploadBusy" @click="unggahBerkasBa(pe, 'pdf')"><i class="bi bi-file-earmark-pdf"></i> Unggah PDF</button>
```

Di dekat input kamera (sekitar baris 1765), tambahkan input PDF:

```html
<input ref="baPendukungPdf" type="file" accept="application/pdf" class="hidden" @change="onBaPendukungPdf($event)">
```

- [ ] **Step 4: Ubah `unggahBerkasBa` agar menerima jenis berkas**

Ganti method `unggahBerkasBa(pe)` (sekitar baris 3415) menjadi:

```js
                unggahBerkasBa(pe, kind) {
                    this.detail.baPendukung.uploadFor = pe.idPengajuan;
                    this.detail.baPendukung.uploadItems = [];
                    const ref = kind === 'pdf' ? 'baPendukungPdf' : 'baPendukungCamera';
                    const el = this.$refs[ref]; if (el) el.click();
                },
                onBaPendukungPdf(e) {
                    const files = Array.from(e.target.files || []);
                    if (e.target) e.target.value = '';
                    if (!files.length) return;
                    const d = this.detail.baPendukung;
                    const f = files[0];
                    const reader = new FileReader();
                    reader.onload = () => {
                        const res = String(reader.result || '');
                        const comma = res.indexOf(',');
                        const b64 = comma >= 0 ? res.slice(comma + 1) : res;
                        d.uploadSeq += 1;
                        d.uploadItems = [{ id: 'bap-pdf-' + d.uploadSeq, base64: b64, mime: 'application/pdf', name: f.name }];
                        this.simpanBerkasBa();
                    };
                    reader.onerror = () => this.notify('Gagal membaca PDF.', false);
                    reader.readAsDataURL(f);
                },
```

- [ ] **Step 5: Bawa mime asli di `simpanBerkasBa`**

Ganti baris pembuatan `images` di `simpanBerkasBa` (sekitar baris 3434) dari:

```js
                        const images = Array.from(d.uploadItems).map((it) => ({ data: this.bytesToBase64(it.bytes), mimeType: 'image/jpeg', name: it.id + '.jpg' }));
```

menjadi:

```js
                        const images = Array.from(d.uploadItems).map((it) => (it.base64
                            ? { data: it.base64, mimeType: it.mime || 'application/pdf', name: it.name || 'berkas.pdf' }
                            : { data: this.bytesToBase64(it.bytes), mimeType: it.mime || 'image/jpeg', name: it.name || (it.id + '.jpg') }));
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `cd new-code1-cf && npx vitest run test/dashboard-ba-pendukung.test.js`
Expected: PASS.

- [ ] **Step 7: Jalankan seluruh suite**

Run: `cd new-code1-cf && npx vitest run`
Expected: PASS (semua file). Bila `test/write-berita-acara.test.js` gagal karena `Network connection lost`, ulangi sekali.

- [ ] **Step 8: Commit**

```bash
cd /workspace && git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-ba-pendukung.test.js
git commit -m "feat(ba-pendukung): tombol unggah PDF di kartu BA Pendukung"
```

---

## Self-Review

**1. Spec coverage**

- Amendemen P4 (terima PDF) → Task 4 (validasi mime) + Task 5 (UI).
- Amendemen P17 (PDF tak di-recompress) → Task 2 (`copyPages`) + Task 4 (simpan apa adanya).
- Q1 `page_count` → Task 1 (kolom), Task 4 (isi).
- Q2 copyPages → Task 2.
- Q3 `ignoreEncryption` → Task 2 (`copyPdfPages`) + Task 4 (validasi).
- Q4 batas dari halaman sumber → Task 3 (`totalSourcePages`), Task 4 (`countActivePages`/`newPages`).
- Q5 PDF saja → Task 4 (tidak ada syarat gambar).
- Q6/Q7 add-in A+B → Task 2 (`addCoverPage`/`addSeparatorPage`).
- Q8 nomor hanya di halaman server → Task 2 (footer hanya pada `generated`).
- Q9 ukuran asli dipertahankan → Task 2 (`copyPages`, gambar fit A4).
- Q10 default aktif tanpa toggle → Task 2 (selalu jalan saat `ba` ada).
- Q11 peserta tanpa berkas tanpa pembatas → Task 2 (`withFiles`) + Task 3 (`groups` hanya peserta berberkas).
- Q12 add-in tidak dihitung batas → Task 3/Task 4 menghitung hanya `page_count`.
- Q13 UI tombol PDF + badge Σ halaman → Task 3 (`pages`), Task 5 (tombol).
- Q14 tanpa audit → tidak ada task (sesuai).
- Migrasi & dokumentasi → Task 1.
- Alur §8.3 (peserta bertambah lalu lampirkan PDF) → tertutupi Task 3 + Task 5 (tidak ada perubahan khusus; peserta baru otomatis jadi grup baru).

**2. Placeholder scan:** Tidak ada "TBD"/"TODO"; setiap langkah memuat kode/perintah lengkap.

**3. Type consistency:** `mergeBaFilesToPdf({ ba, peserta, groups }) -> { bytes, sourcePages, outputPages }` konsisten di Task 2/Task 3. `setBaAdminPesertaBerkas(...).pages` konsisten (= total halaman baru) di Task 4. `getBaAdminForPengajuan(...).data.peserta[].pages` konsisten di Task 3/Task 5. Nama kolom `page_count` konsisten. Handler frontend `onBaPendukungPdf` konsisten di Task 5.
