# BA Pendukung: Dokumen Dasar & Anggota Dinamis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan file lama BA Pendukung (`file_url`) sebagai "dokumen dasar" yang terpisah dari berkas per-anggota, menggabungkannya paling awal di PDF gabungan, dan membolehkan anggota berstatus apa pun (termasuk `Menunggu`) ditambahkan ke BA Pendukung yang sudah ada.

**Architecture:** Tambah kolom `base_file_url`/`base_file_name` pada `berita_acara_admin` (migrasi aditif + backfill). `src/baMerge.js` menerima `baseFile` dan menyalin halamannya sebelum berkas per-peserta. `src/write/baAdmin.js` mengambil dokumen dasar saat regenerate, menyediakan `setBaAdminBaseFile`/`removeBaAdminBaseFile`, dan menghapus filter status pada kandidat. Modal "Kelola BA Pendukung" di dashboard menampilkan/unggah/hapus dokumen dasar.

**Tech Stack:** JavaScript ESM, Cloudflare Workers + D1, Vitest, pdf-lib, Vue 3 CDN.

## Global Constraints

- BA Pendukung = **1 baris `berita_acara_admin` per kegiatan** (`kegiatan_key`), banyak anggota.
- `base_file_url` = dokumen dasar (hasil konversi dari `file_url` lama). Halaman dokumen dasar diletakkan **paling awal** (setelah sampul sistem), lalu berkas per-anggota menurut `urutan`.
- Anggota BA Pendukung boleh berstatus apa pun: `Menunggu`, `ACC`, `Ditolak`, `Dibatalkan` — **tanpa pengecualian**.
- BA lama boleh ditambahi anggota baru tanpa kehilangan dokumen dasarnya.
- Regenerate PDF **tidak** menghapus dokumen dasar; `base_file_url` tidak pernah ditimpa oleh hasil gabungan (hasil gabungan tetap di `file_url`).
- Batas tetap: `BA_ADMIN_MAX_PAGES = 50`, `BA_ADMIN_MAX_BYTES = 20 * 1024 * 1024`.
- Migrasi DB wajib idempotent & aditif. Jangan menimpa data produksi.
- Semua RPC BA Pendukung tetap `requireAdmin`.
- Perintah tes: `npm test`. Semua tes lama harus tetap lulus.
- Terkait: Plan A (`2026-10-15-alur-status-portal.md`) — default `getBagianBaStatuses` sudah `['ACC']`.

---

## File Structure

- `migrations/2026-10-15-ba-admin-base-file.sql` — **Create.** Kolom dokumen dasar + backfill.
- `test/migration-ba-admin-base-file.test.js` — **Create.**
- `schema.sql` — **Modify.** Kolom baru di `berita_acara_admin`.
- `src/baMerge.js` — **Modify.** Dukungan `baseFile`.
- `test/baMerge.test.js` — **Modify.** Uji baseFile.
- `src/write/baAdmin.js` — **Modify.** Kandidat semua status, base file, regenerate.
- `src/read/columns.js` — **Modify.** Mapping `base_file_url`/`base_file_name`.
- `src/rpc.js` — **Modify.** Handler `baAdminSetBaseFile`, `baAdminRemoveBaseFile`.
- `test/ba-admin-regenerate.test.js` — **Modify.** Uji dokumen dasar.
- `test/ba-admin-peserta.test.js` — **Modify.** Kandidat semua status.
- `public/dashboard.html` — **Modify.** Modal Kelola BA: seksi dokumen dasar.

---

### Task 1: Migrasi & skema kolom dokumen dasar

**Files:**
- Create: `migrations/2026-10-15-ba-admin-base-file.sql`
- Modify: `schema.sql:124-129`
- Test: `test/migration-ba-admin-base-file.test.js`

**Interfaces:**
- Produces: kolom `berita_acara_admin.base_file_url TEXT DEFAULT ''` dan `base_file_name TEXT DEFAULT ''`.

- [ ] **Step 1: Write the failing test**

```js
// test/migration-ba-admin-base-file.test.js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-15-ba-admin-base-file.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function simulatePreMigration() {
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara_admin').run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara_admin (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT, ' +
      'nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, jumlah_peserta TEXT, file_name TEXT, ' +
      'file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT, updated_at TEXT, needs_regen INTEGER DEFAULT 0)'
  ).run();
}

async function columnInfo(table, name) {
  const rows = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  return (rows.results || []).find((r) => r.name === name) || null;
}

describe('migrasi dokumen dasar BA Pendukung', () => {
  it('menambah kolom base_file_url & base_file_name', async () => {
    await simulatePreMigration();
    for (const stmt of statements) await env.DB.prepare(stmt).run();
    expect(await columnInfo('berita_acara_admin', 'base_file_url')).toBeTruthy();
    expect(await columnInfo('berita_acara_admin', 'base_file_name')).toBeTruthy();
  });

  it('backfill base_file_url = file_url hanya untuk BA tanpa berkas aktif', async () => {
    await simulatePreMigration();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_name,file_url,Sumber,kegiatan_key) VALUES ('2026-10-01T08:00:00','BA-PEN-LEGACY','KKD','A','KKD 1','2026-10-01','1','old.pdf','https://drive/old','Admin','k1')".replace('Sumber', 'sumber')
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_name,file_url,sumber,kegiatan_key) VALUES ('2026-10-01T08:00:00','BA-PEN-EMPTY','KKD','A','KKD 2','2026-10-01','1','','', 'Admin','k2')"
    ).run();

    for (const stmt of statements) await env.DB.prepare(stmt).run();

    const legacy = await env.DB.prepare("SELECT base_file_url FROM berita_acara_admin WHERE ba_id='BA-PEN-LEGACY'").first();
    const empty = await env.DB.prepare("SELECT base_file_url FROM berita_acara_admin WHERE ba_id='BA-PEN-EMPTY'").first();
    expect(legacy.base_file_url).toBe('https://drive/old');
    expect(empty.base_file_url).toBe('');
  });

  it('tidak menimpa base_file_url yang sudah terisi (idempotent)', async () => {
    await simulatePreMigration();
    for (const stmt of statements) await env.DB.prepare(stmt).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_name,file_url,base_file_url,sumber,kegiatan_key) VALUES ('2026-10-01T08:00:00','BA-PEN-1','KKD','A','KKD 1','2026-10-01','1','','https://drive/merged','https://drive/base','Admin','k1')"
    ).run();
    for (const stmt of statements) await env.DB.prepare(stmt).run();
    const row = await env.DB.prepare("SELECT base_file_url FROM berita_acara_admin WHERE ba_id='BA-PEN-1'").first();
    expect(row.base_file_url).toBe('https://drive/base');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/migration-ba-admin-base-file.test.js`
Expected: FAIL — modul migrasi belum ada.

- [ ] **Step 3: Write the migration**

```sql
-- migrations/2026-10-15-ba-admin-base-file.sql
-- BA Pendukung: pisahkan "dokumen dasar" (file lama) dari PDF gabungan per-anggota.
ALTER TABLE berita_acara_admin ADD COLUMN base_file_url TEXT DEFAULT '';
ALTER TABLE berita_acara_admin ADD COLUMN base_file_name TEXT DEFAULT '';

-- Backfill dokumen dasar dari file_url lama, hanya bila BA belum punya
-- berkas per-peserta aktif (BA yang sudah di-regenerate tidak disentuh).
UPDATE berita_acara_admin SET base_file_url = file_url
  WHERE (base_file_url IS NULL OR base_file_url = '')
    AND file_url IS NOT NULL AND file_url <> ''
    AND NOT EXISTS (
      SELECT 1 FROM berita_acara_admin_berkas b
      WHERE b.ba_id = berita_acara_admin.ba_id AND b.active = 1
    );
```

- [ ] **Step 4: Update `schema.sql`**

Ubah `schema.sql:124-129` menjadi:

```sql
CREATE TABLE berita_acara_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, jumlah_peserta TEXT, file_name TEXT,
  file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT,
  updated_at TEXT, needs_regen INTEGER DEFAULT 0,
  base_file_url TEXT DEFAULT '', base_file_name TEXT DEFAULT ''
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/migration-ba-admin-base-file.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add migrations/2026-10-15-ba-admin-base-file.sql schema.sql test/migration-ba-admin-base-file.test.js
git commit -m "feat(ba-pendukung): add base_file_url column and backfill"
```

---

### Task 2: `baMerge.js` menyalin dokumen dasar lebih dulu

**Files:**
- Modify: `src/baMerge.js:119-162`
- Test: `test/baMerge.test.js`

**Interfaces:**
- Consumes: `mergeBaFilesToPdf({ ba, peserta, groups, baseFile })` di mana `baseFile = { bytes: Uint8Array, mime: string }` (opsional).
- Produces: halaman keluaran = sampul + (baseFile bila ada) + pembatas/berkas per-peserta. `sourcePages` menghitung halaman baseFile.

- [ ] **Step 1: Write the failing test**

Tambahkan ke `test/baMerge.test.js`:

```js
import { PDFDocument } from 'pdf-lib';

async function makePdf(pageCount) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) d.addPage([200, 300]);
  return await d.save();
}

describe('mergeBaFilesToPdf dengan dokumen dasar', () => {
  it('menempatkan halaman dokumen dasar sebelum berkas peserta', async () => {
    const base = await makePdf(2);
    const member = await makePdf(1);
    const res = await mergeBaFilesToPdf({
      ba: { bagian: 'KKD', blok: 'A', namaKegiatan: 'KKD 1', tanggal: '2026-10-01' },
      peserta: [{ urutan: 1, nama: 'Aisyah', npm: '1001', halaman: 1 }],
      baseFile: { bytes: base, mime: 'application/pdf' },
      groups: [{ peserta: { urutan: 1, nama: 'Aisyah', npm: '1001', blok: 'A' }, files: [{ bytes: member, mime: 'application/pdf' }] }]
    });
    // sampul(1) + dokumen dasar(2) + pembatas(1) + peserta(1) = 5
    expect(res.outputPages).toBe(5);
    expect(res.sourcePages).toBe(3);
  });

  it('menghasilkan PDF hanya dari dokumen dasar bila tanpa berkas peserta', async () => {
    const base = await makePdf(3);
    const res = await mergeBaFilesToPdf({
      ba: { bagian: 'KKD', blok: 'A', namaKegiatan: 'KKD 1', tanggal: '2026-10-01' },
      peserta: [],
      baseFile: { bytes: base, mime: 'application/pdf' },
      groups: []
    });
    expect(res.outputPages).toBe(4); // sampul(1) + dasar(3)
    expect(res.sourcePages).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/baMerge.test.js`
Expected: FAIL — dokumen dasar tidak disalin; `outputPages` berbeda.

- [ ] **Step 3: Implement**

Di `src/baMerge.js`, ubah bagian dalam `mergeBaFilesToPdf` (setelah sampul, sebelum loop `withFiles`):

```js
export async function mergeBaFilesToPdf(input) {
  const cfg = input || {};
  const groups = Array.isArray(cfg.groups) ? cfg.groups : [];
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const generated = [];

  if (cfg.ba) {
    for (const p of addCoverPages(doc, cfg.ba, cfg.peserta || [], helv, helvBold)) generated.push(p);
  }

  let sourcePages = 0;
  const base = cfg.baseFile;
  if (base && base.bytes && base.bytes.length) {
    try {
      const bytes = toBytes(base.bytes);
      if (isPdfFile(base)) sourcePages += await copyPdfPages(doc, bytes);
      else { await addImagePage(doc, bytes, String(base.mime || '')); sourcePages += 1; }
    } catch (e) {
      // dokumen dasar rusak diabaikan; berkas peserta tetap diproses
    }
  }

  const withFiles = groups.filter((g) => g && Array.isArray(g.files) && g.files.length);
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/baMerge.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/baMerge.js test/baMerge.test.js
git commit -m "feat(baMerge): prepend base document pages"
```

---

### Task 3: `baAdmin.js` — kandidat semua status, ekspos dokumen dasar, regenerate menyertakan dokumen dasar

**Files:**
- Modify: `src/write/baAdmin.js:1-2, 117-145, 281-331, 333-434`
- Test: `test/ba-admin-peserta.test.js`, `test/ba-admin-regenerate.test.js`

**Interfaces:**
- Produces:
  - `listCandidates` tidak memfilter status (kandidat = semua pengajuan sekegiatan/blok yang belum masuk BA).
  - `getBaAdminForPengajuan` → `data.ba.baseFileUrl`, `data.ba.baseFileName`.
  - `setBaAdminBaseFile(db, baId, file, ctx)` → `{ success, baseFileUrl?, message }`.
  - `removeBaAdminBaseFile(db, baId, ctx)` → `{ success, message }`.
  - `runRegenerateBaAdminPdf` menyertakan dokumen dasar ke PDF gabungan.

- [ ] **Step 1: Write the failing tests**

Di `test/ba-admin-peserta.test.js`, ubah tes kandidat agar menyertakan peserta `Menunggu` yang kini muncul:

```js
  it('kandidat mencakup semua status termasuk Menunggu', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    await seed('INHAL-2', '2201010002', 'Budi', 'Menunggu', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    const res = await getBaAdminForPengajuan(env.DB, 'INHAL-1', ctx);
    expect(res.data.candidates.map((c) => c.idPengajuan)).toContain('INHAL-2');
    expect(res.data.candidates.find((c) => c.idPengajuan === 'INHAL-2').statusPengajuan).toBe('Menunggu');
  });
```

Di `test/ba-admin-regenerate.test.js`, tambahkan:

```js
  it('menggabungkan dokumen dasar + berkas peserta', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await seedBerkas(baId);
    await env.DB.prepare("UPDATE berita_acara_admin SET base_file_url='https://drive.google.com/file/d/BASEFILE0000000000000BASE/view' WHERE ba_id=?1").bind(baId).run();
    const base = await pdfB64(2);
    const member = await pdfB64(1);
    let saved = '';
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === 'getFile') {
        const isBase = String(body.fileId || '').indexOf('BASE') === 0;
        return new Response(JSON.stringify({ success: true, base64: isBase ? base : member, mimeType: 'application/pdf' }), { status: 200 });
      }
      saved = body.base64;
      return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/NEWNEWNEWNEWNEWNEWNEWNEWNEW1/view', fileId: 'NEWNEWNEWNEWNEWNEWNEWNEW1' }), { status: 200 });
    }));
    const res = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(res.success).toBe(true);
    const bytes = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
    const doc = await PDFDocument.load(bytes);
    // sampul(1) + dasar(2) + pembatas(1) + peserta(1) = 5
    expect(doc.getPageCount()).toBe(5);
  });

  it('setBaAdminBaseFile menyimpan dokumen dasar & regenerate', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    const base = await pdfB64(1);
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === 'getFile') return new Response(JSON.stringify({ success: true, base64: base, mimeType: 'application/pdf' }), { status: 200 });
      return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/BASEFILE0000000000000BASE/view', fileId: 'BASEFILE0000000000000BASE' }), { status: 200 });
    }));
    const res = await setBaAdminBaseFile(env.DB, baId, { data: base, mimeType: 'application/pdf', name: 'dasar.pdf' }, ctx);
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT base_file_url FROM berita_acara_admin WHERE ba_id=?1').bind(baId).first();
    expect(row.base_file_url).toContain('BASEFILE');
  });
```

Pastikan import `setBaAdminBaseFile` ditambahkan pada baris import di file tes tersebut.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/ba-admin-peserta.test.js test/ba-admin-regenerate.test.js`
Expected: FAIL — kandidat `Menunggu` tersaring; `baseFileUrl`/`setBaAdminBaseFile` belum ada.

- [ ] **Step 3: Implement di `src/write/baAdmin.js`**

a) Ubah import baris 2 (hapus `getBagianBaStatuses`):

```js
import { kegiatanKey, getMasterOptions, resolveBagian12 } from '../read/common.js';
```

b) `listCandidates` — hapus filter status. Ganti `src/write/baAdmin.js:117-145`:

```js
async function listCandidates(db, kegiatan) {
  const jenis = lowsp(kegiatan.jenis);
  const pilihan = lowsp(kegiatan.pilihan);
  const detailText = lowsp(kegiatan.detail);
  const blokNorm = str(kegiatan.blok).replace(/\s+/g, ' ');
  const bagian = str(kegiatan.bagian);
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const idSet = new Set();
  for (const d of details) {
    if (lowsp(d.jenis_kegiatan) !== jenis) continue;
    if (lowsp(d.pilihan) !== pilihan) continue;
    if (lowsp(d.detail) !== detailText) continue;
    const pid = str(d.id_pengajuan);
    if (pid) idSet.add(pid);
  }
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const out = [];
  for (const p of pengajuan) {
    const pid = str(p.id_pengajuan);
    if (!idSet.has(pid)) continue;
    if (str(p.blok).replace(/\s+/g, ' ') !== blokNorm) continue;
    out.push({ idPengajuan: pid, npm: str(p.npm), namaLengkap: str(p.nama_lengkap), blok: str(p.blok), bagian, statusPengajuan: str(p.status) });
  }
  out.sort((a, b) => a.npm.toLowerCase().localeCompare(b.npm.toLowerCase()));
  return out;
}
```

c) Tambah `baseFileUrl`/`baseFileName` pada objek `ba` di `getBaAdminForPengajuan` (baris 306):

```js
    ba = { baId: str(baRow.ba_id), bagian: str(baRow.bagian), blok: str(baRow.blok), namaKegiatan: str(baRow.nama_kegiatan), tanggal: str(baRow.tanggal_pelaksanaan), jam: str(baRow.jam), catatan: str(baRow.catatan), fileUrl: str(baRow.file_url), baseFileUrl: str(baRow.base_file_url), baseFileName: str(baRow.base_file_name), jumlahPeserta: Number(baRow.jumlah_peserta) || 0, needsRegen: Number(baRow.needs_regen) === 1 };
```

d) `runRegenerateBaAdminPdf` — sertakan dokumen dasar. Ganti blok dari query `rows` hingga pemanggilan `mergeBaFilesToPdf` (baris 341-399) dengan:

```js
    const rows = (await db.prepare(
      'SELECT b.*, p.nama_lengkap AS p_nama, p.blok AS p_blok, p.urutan AS p_urutan FROM berita_acara_admin_berkas b ' +
      'JOIN berita_acara_admin_peserta p ON p.ba_id = b.ba_id AND p.id_pengajuan = b.id_pengajuan ' +
      'WHERE b.ba_id = ?1 AND b.active = 1 AND p.active = 1 ' +
      'ORDER BY p.urutan, b.page_index'
    ).bind(id).all()).results || [];

    const allPeserta = (await db.prepare('SELECT * FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1 ORDER BY urutan').bind(id).all()).results || [];

    const baseUrl = str(ba.base_file_url);
    if (!rows.length && !baseUrl) {
      await db.prepare("UPDATE berita_acara_admin SET file_url = '', file_name = '', needs_regen = 0 WHERE ba_id = ?1").bind(id).run();
      return { success: true, fileUrl: '', pages: 0 };
    }

    let baseFile = null;
    let basePages = 0;
    if (baseUrl) {
      const baseId = parseDriveFileId(baseUrl);
      const gotBase = await getDriveFileBase64(ctx.env, baseId);
      if (!gotBase.ok) throw new Error(gotBase.message || 'Gagal mengambil dokumen dasar.');
      const baseBytes = base64ToBytes(gotBase.base64);
      baseFile = { bytes: baseBytes, mime: gotBase.mime };
      if (baseFile.mime === 'application/pdf') {
        try { basePages = (await PDFDocument.load(baseBytes, { ignoreEncryption: true })).getPageCount(); } catch (e) { basePages = 1; }
      } else {
        basePages = 1;
      }
    }

    const totalSourcePages = rows.reduce((s, r) => s + (Number(r.page_count) || 1), 0) + basePages;
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
      if (!groupMap.has(pid)) groupMap.set(pid, { peserta: { urutan: Number(r.p_urutan) || 0, nama: str(r.p_nama), npm: str(r.npm), blok: str(r.p_blok) }, rows: [] });
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
    const merged = await mergeBaFilesToPdf({
      ba: { bagian: str(ba.bagian), blok: str(ba.blok), namaKegiatan: str(ba.nama_kegiatan), tanggal: str(ba.tanggal_pelaksanaan) },
      peserta: pesertaList,
      groups: groups,
      baseFile: baseFile
    });
```

e) Tambahkan dua fungsi baru di akhir `src/write/baAdmin.js` (setelah `addBaAdminPesertaWithBerkas`):

```js
export async function setBaAdminBaseFile(db, baId, file, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID kosong.' };
  const ba = await db.prepare('SELECT ba_id FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };
  if (!(file && file.data)) return { success: false, message: 'Tidak ada dokumen dasar yang diunggah.' };

  const up = await saveDriveFile(ctx.env, file, 'ba-admin-base-' + id, { label: 'Dokumen dasar BA' });
  if (!up.ok) return { success: false, message: up.message };
  const ts = nowIso();
  await db.prepare('UPDATE berita_acara_admin SET base_file_url = ?1, base_file_name = ?2, updated_at = ?3 WHERE ba_id = ?4')
    .bind(up.url, String(up.name || ''), ts, id).run();
  const regen = await regenerateBaAdminPdf(db, id, ctx);
  return {
    success: true,
    baseFileUrl: up.url,
    message: (regen && regen.success) ? 'Dokumen dasar disimpan.' : ((regen && regen.message) || 'Dokumen dasar disimpan, PDF gabungan gagal dirakit.')
  };
}

export async function removeBaAdminBaseFile(db, baId, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID kosong.' };
  const ba = await db.prepare('SELECT base_file_url FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };
  const fileId = parseDriveFileId(ba.base_file_url);
  const ts = nowIso();
  await db.prepare("UPDATE berita_acara_admin SET base_file_url = '', base_file_name = '', updated_at = ?1 WHERE ba_id = ?2").bind(ts, id).run();
  if (fileId) { try { await trashDriveFile(ctx.env, fileId); } catch (e) {} }
  const regen = await regenerateBaAdminPdf(db, id, ctx);
  return { success: true, message: (regen && regen.success) ? 'Dokumen dasar dihapus.' : ((regen && regen.message) || 'Dokumen dasar dihapus.') };
}
```

Import `trashDriveFile` ada di baris 4 (`saveDriveFile, getDriveFileBase64, parseDriveFileId`). Tambahkan `trashDriveFile`:

```js
import { saveDriveFile, trashDriveFile, getDriveFileBase64, parseDriveFileId } from '../drive.js';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/ba-admin-peserta.test.js test/ba-admin-regenerate.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/write/baAdmin.js test/ba-admin-peserta.test.js test/ba-admin-regenerate.test.js
git commit -m "feat(ba-pendukung): base document + allow all statuses in candidates"
```

---

### Task 4: RPC & kolom ekspor

**Files:**
- Modify: `src/rpc.js:31, 106-122`
- Modify: `src/read/columns.js:36-41`

**Interfaces:**
- Consumes: `setBaAdminBaseFile`, `removeBaAdminBaseFile` dari `src/write/baAdmin.js`.
- Produces: RPC `baAdminSetBaseFile(db, args, ctx)` dengan `args = [baId, file]`; `baAdminRemoveBaseFile(db, args, ctx)` dengan `args = [baId]`.

- [ ] **Step 1: Implement import & handler di `src/rpc.js`**

Tambahkan `setBaAdminBaseFile, removeBaAdminBaseFile` pada import dari `./write/baAdmin.js` (blok import baris 26-31). Lalu tambahkan handler setelah baris 122 (`baAdminRegenerate`):

```js
  baAdminSetBaseFile: (db, args, ctx) => setBaAdminBaseFile(db, args[0], args[1], ctx),
  baAdminRemoveBaseFile: (db, args, ctx) => removeBaAdminBaseFile(db, args[0], ctx)
```

- [ ] **Step 2: Tambah mapping kolom di `src/read/columns.js`**

Ubah objek `berita_acara_admin` (baris 36-41):

```js
  berita_acara_admin: {
    timestamp: 'Timestamp', ba_id: 'BA ID', bagian: 'Bagian', blok: 'Blok',
    nama_kegiatan: 'Nama Kegiatan', tanggal_pelaksanaan: 'Tanggal Pelaksanaan', jam: 'Jam',
    jumlah_peserta: 'Jumlah Peserta', file_name: 'File Name', file_url: 'File URL',
    catatan: 'Catatan', sumber: 'Sumber', kegiatan_key: 'Kegiatan Key',
    base_file_url: 'Base File URL', base_file_name: 'Base File Name'
  },
```

- [ ] **Step 3: Run the RPC/columns tests**

Run: `npx vitest run test/rpc.test.js test/rpc-ba-admin.test.js test/read-columns.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/rpc.js src/read/columns.js
git commit -m "feat(ba-pendukung): rpc + column mapping for base document"
```

---

### Task 5: UI dashboard — seksi dokumen dasar di modal Kelola BA

**Files:**
- Modify: `public/dashboard.html:2082-2087` (seksi header BA), `:2111` (teks kandidat), `:2128-2129` (input file), `:3600-3699` (methods)
- Test: `test/dashboard-bootstrap-ba-pendukung.test.js` (guard string)

**Interfaces:**
- Consumes: RPC `baAdminSetBaseFile(baId, { data, mimeType, name })`, `baAdminRemoveBaseFile(baId)`; `data.ba.baseFileUrl`.

- [ ] **Step 1: Write the failing guard test**

Tambahkan ke `test/dashboard-bootstrap-ba-pendukung.test.js`:

```js
describe('guard dokumen dasar BA Pendukung', () => {
  it('modal menyediakan aksi dokumen dasar', async () => {
    const html = (await import('../public/dashboard.html?raw')).default;
    expect(html).toContain('baAdminSetBaseFile');
    expect(html).toContain('Dokumen dasar');
    expect(html).not.toContain('berstatus ACC/Diterima');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/dashboard-bootstrap-ba-pendukung.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement di `public/dashboard.html`**

a) Setelah blok header BA (`:2082-2087`), tambahkan seksi dokumen dasar **di dalam** `<template v-else-if="kb.data">`, setelah `</div>` penutup baris header BA:

```html
                                <div v-if="kb.data.ba" class="mt-3 rounded-xl bg-slate-50 p-3">
                                    <div class="text-xs font-bold uppercase tracking-wide text-slate-400">Dokumen dasar</div>
                                    <div class="mt-1 flex flex-wrap items-center gap-2">
                                        <a v-if="kb.data.ba.baseFileUrl" :href="safeUrl(kb.data.ba.baseFileUrl)" target="_blank" rel="noopener noreferrer" class="btn-soft !py-1 !px-2 text-[11px]"><i class="bi bi-file-earmark"></i> Lihat dokumen dasar</a>
                                        <span v-else class="text-[11px] text-slate-400">Belum ada dokumen dasar (opsional).</span>
                                        <button class="btn-soft !py-1 !px-2 text-[11px]" :disabled="kb.uploadBusy" @click="kbPickBase()"><i class="bi bi-upload"></i> {{ kb.data.ba.baseFileUrl ? 'Ganti' : 'Unggah' }}</button>
                                        <button v-if="kb.data.ba.baseFileUrl" class="btn-soft !py-1 !px-2 text-[11px] !text-rose-600" :disabled="kb.uploadBusy" @click="kbRemoveBase()"><i class="bi bi-x-lg"></i> Hapus</button>
                                    </div>
                                    <p class="mt-1 text-[10px] text-slate-400">Dokumen dasar tampil paling awal pada PDF BA Pendukung.</p>
                                </div>
```

b) Ganti teks kandidat (baris 2111):

```html
                                        <div v-if="!(kb.data.candidates || []).length" class="p-3 text-[11px] text-slate-400">Tidak ada kandidat (mahasiswa sekegiatan yang belum masuk BA).</div>
```

c) Tambahkan input file tersembunyi setelah `kbPdf` (baris 2129):

```html
                        <input ref="kbBaseFile" type="file" accept="application/pdf,image/*" class="hidden" @change="onKbBaseFile($event)">
```

d) Tambahkan methods setelah `kbRegenerate()` (baris 3699):

```js
                kbPickBase() {
                    if (!this.kb.data || !this.kb.data.ba) { this.notify('Buat BA dengan menambah peserta terlebih dahulu.', false); return; }
                    const el = this.$refs.kbBaseFile;
                    if (el) el.click();
                },
                onKbBaseFile(e) {
                    const files = Array.from(e.target.files || []);
                    if (e.target) e.target.value = '';
                    if (!files.length) return;
                    const f = files[0];
                    const reader = new FileReader();
                    reader.onload = async () => {
                        const res = String(reader.result || '');
                        const comma = res.indexOf(',');
                        const b64 = comma >= 0 ? res.slice(comma + 1) : res;
                        const ba = this.kb.data && this.kb.data.ba;
                        if (!ba) return;
                        this.kb.uploadBusy = true;
                        try {
                            const r = await this.run('baAdminSetBaseFile', ba.baId, { data: b64, mimeType: f.type || 'application/pdf', name: f.name });
                            this.notify((r && r.message) || 'Dokumen dasar disimpan.', !!(r && r.success));
                            if (r && r.success) await this.loadKelolaBa(this.kb.lastId);
                        } catch (err) {
                            this.notify('Gagal menyimpan dokumen dasar: ' + err, false);
                        } finally {
                            this.kb.uploadBusy = false;
                        }
                    };
                    reader.onerror = () => this.notify('Gagal membaca berkas.', false);
                    reader.readAsDataURL(f);
                },
                async kbRemoveBase() {
                    const ba = this.kb.data && this.kb.data.ba;
                    if (!ba) return;
                    const ok = await this.askConfirm({ title: 'Hapus dokumen dasar', message: 'Hapus dokumen dasar dari BA Pendukung ini?', icon: 'bi-x-lg', tone: 'danger', confirmLabel: 'Hapus' });
                    if (!ok) return;
                    const res = await this.run('baAdminRemoveBaseFile', ba.baId);
                    this.notify((res && res.message) || 'Dokumen dasar dihapus.', !!(res && res.success));
                    if (res && res.success) await this.loadKelolaBa(this.kb.lastId);
                },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/dashboard-bootstrap-ba-pendukung.test.js test/dashboard-ba-pendukung.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/dashboard.html test/dashboard-bootstrap-ba-pendukung.test.js
git commit -m "feat(dashboard): base document controls in Kelola BA Pendukung"
```

---

### Task 6: Verifikasi menyeluruh

- [ ] **Step 1: Jalankan seluruh suite**

Run: `npm test`
Expected: seluruh tes PASS.

- [ ] **Step 2: Pastikan tidak ada filter status tersisa di kandidat BA Pendukung**

Run: `rg -n "getBagianBaStatuses" src/write/baAdmin.js`
Expected: tidak ada hasil.

- [ ] **Step 3: Commit (bila ada sisa penyesuaian)**

```bash
git add -A
git commit -m "chore(ba-pendukung): final sweep"
```

---

## Catatan Deploy (manual oleh user)

```bash
cd /workspace/new-code1-cf
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=migrations/2026-10-15-ba-admin-base-file.sql
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```

## Self-Review

- **Spec coverage:** kolom `base_file_url` + backfill (Task 1); halaman dasar paling awal (Task 2); regenerate menyertakan dokumen dasar & BA lama tetap bisa ditambahi (Task 3); anggota semua status (Task 3); UI kelola dokumen dasar (Task 5); RPC (Task 4).
- **Placeholder scan:** tidak ada TODO; semua langkah berisi kode/perintah.
- **Type consistency:** `baseFile = { bytes, mime }` konsisten di Task 2 & 3; `setBaAdminBaseFile(db, baId, file, ctx)` konsisten di Task 3 & 4; properti UI `data.ba.baseFileUrl` konsisten dengan Task 3.
