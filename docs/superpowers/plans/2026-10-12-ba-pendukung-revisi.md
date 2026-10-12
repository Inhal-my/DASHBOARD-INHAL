# BA Pendukung Revisi/Tambah (dari Modal Detail Pengajuan) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin dapat menambah peserta dan merevisi BA Pendukung langsung dari modal Detail Pengajuan, dengan isi BA = gabungan berkas gambar per mahasiswa yang dirakit otomatis di server.

**Architecture:** Worker Cloudflare (Hono + D1) menyimpan metadata peserta/berkas di D1 dan berkas gambar + PDF gabungan di Drive (via bridge Apps Script). Penggabungan PDF dilakukan di worker memakai `pdf-lib`. Frontend `dashboard.html` (Vue) menampilkan kartu BA Pendukung interaktif di modal detail.

**Tech Stack:** Cloudflare Workers, D1, Hono, vanilla Vue 3 (in-page), `pdf-lib`, `vitest` + `@cloudflare/vitest-pool-workers`.

## Global Constraints

- Tanpa langkah build untuk frontend: Tailwind ditulis inline/kelas manual; tanpa CDN baru saat runtime.
- Backend boleh menambah dependency npm yang di-bundle wrangler (`pdf-lib`).
- Semua RPC baru admin-only (`requireAdmin`).
- Berkas halaman: **gambar saja** (JPEG/PNG), dikompres di klien via `ScanPdf.compressToJpeg` sebelum kirim.
- Batas regenerate: **maks 50 halaman** dan **20 MB** total input.
- Riwayat = berkas per mahasiswa (`active=0`, `superseded_at`); PDF gabungan ditimpa (tanpa arsip snapshot).
- Tanpa siklus Draft/Final; tanpa audit.
- Konvensi kolom D1: `snake_case`; akses klien via `toClientRow` (`src/read/columns.js`).
- `berita_acara_admin` = satu per `kegiatan_key` (`normKegiatan(bagian)|norm(blok)|normKegiatan(nama)`).
- Perintah tes: `cd new-code1-cf && npx vitest run <file>`.
- Spec acuan: `docs/superpowers/specs/2026-10-12-ba-pendukung-revisi-design.md`.

---

### Task 1: Skema & migrasi

**Files:**
- Modify: `new-code1-cf/schema.sql` (CREATE TABLE `berita_acara_admin`, `berita_acara_admin_peserta`, tambah tabel `berita_acara_admin_berkas`)
- Create: `new-code1-cf/migrations/2026-10-12-ba-pendukung-berkas.sql`
- Test: `new-code1-cf/test/schema-ba-admin-berkas.test.js`

**Interfaces:**
- Produces: tabel `berita_acara_admin_berkas(id, timestamp, ba_id, id_pengajuan, npm, urutan, page_index, file_name, file_url, active, superseded_at)`; kolom `berita_acara_admin.updated_at`, `berita_acara_admin.needs_regen`; kolom `berita_acara_admin_peserta.urutan`, `berita_acara_admin_peserta.active`.

- [ ] **Step 1: Write the failing test**

`new-code1-cf/test/schema-ba-admin-berkas.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('skema ba pendukung berkas', () => {
  it('menyimpan kolom needs_regen & updated_at pada berita_acara_admin', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,kegiatan_key,needs_regen,updated_at) VALUES ('2026-10-12T00:00:00','BA-PEN-2026-0001','SGD','A','SGD 1','2026-10-20','sgd|a|sgd 1',1,'2026-10-12T01:00:00')"
    ).run();
    const row = await env.DB.prepare('SELECT needs_regen, updated_at FROM berita_acara_admin WHERE ba_id = ?1').bind('BA-PEN-2026-0001').first();
    expect(Number(row.needs_regen)).toBe(1);
    expect(row.updated_at).toBe('2026-10-12T01:00:00');
  });

  it('menyimpan urutan & active pada peserta', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,urutan,active) VALUES ('2026-10-12T00:00:00','BA-PEN-2026-0001','INHAL-1','2201010001','Aisyah','A',1,1)"
    ).run();
    const row = await env.DB.prepare('SELECT urutan, active FROM berita_acara_admin_peserta WHERE ba_id = ?1').bind('BA-PEN-2026-0001').first();
    expect(Number(row.urutan)).toBe(1);
    expect(Number(row.active)).toBe(1);
  });

  it('menyimpan baris berkas per mahasiswa', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,active) VALUES ('2026-10-12T00:00:00','BA-PEN-2026-0001','INHAL-1','2201010001',1,0,'p1.jpg','https://drive/x',1)"
    ).run();
    const row = await env.DB.prepare('SELECT page_index, active FROM berita_acara_admin_berkas WHERE ba_id = ?1').bind('BA-PEN-2026-0001').first();
    expect(Number(row.page_index)).toBe(0);
    expect(Number(row.active)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/schema-ba-admin-berkas.test.js`
Expected: FAIL (no such table/column).

- [ ] **Step 3: Update `schema.sql`**

Ganti definisi `berita_acara_admin` dan `berita_acara_admin_peserta`, lalu tambah tabel berkas (letakkan setelah `berita_acara_admin_peserta`):

```sql
CREATE TABLE berita_acara_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, jumlah_peserta TEXT, file_name TEXT,
  file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT,
  updated_at TEXT, needs_regen INTEGER DEFAULT 0
);
CREATE TABLE berita_acara_admin_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, id_pengajuan TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, bagian TEXT, status_pengajuan TEXT,
  urutan INTEGER, active INTEGER DEFAULT 1
);
CREATE TABLE berita_acara_admin_berkas (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, id_pengajuan TEXT, npm TEXT,
  urutan INTEGER, page_index INTEGER, file_name TEXT, file_url TEXT,
  active INTEGER DEFAULT 1, superseded_at TEXT
);
```

Tambah index (dekat index BA lain):
```sql
CREATE INDEX idx_ba_admin_berkas_ba_id ON berita_acara_admin_berkas(ba_id);
```

- [ ] **Step 4: Create migration**

`new-code1-cf/migrations/2026-10-12-ba-pendukung-berkas.sql` (dijalankan sekali oleh `wrangler d1 migrations apply`, dilacak di tabel `d1_migrations`; `ALTER TABLE ADD COLUMN` untuk DB lama, buat tabel bila belum ada):
```sql
ALTER TABLE berita_acara_admin ADD COLUMN updated_at TEXT;
ALTER TABLE berita_acara_admin ADD COLUMN needs_regen INTEGER DEFAULT 0;
ALTER TABLE berita_acara_admin_peserta ADD COLUMN urutan INTEGER;
ALTER TABLE berita_acara_admin_peserta ADD COLUMN active INTEGER DEFAULT 1;
CREATE TABLE IF NOT EXISTS berita_acara_admin_berkas (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, id_pengajuan TEXT, npm TEXT,
  urutan INTEGER, page_index INTEGER, file_name TEXT, file_url TEXT,
  active INTEGER DEFAULT 1, superseded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ba_admin_berkas_ba_id ON berita_acara_admin_berkas(ba_id);
```

- [ ] **Step 5: Run tests to verify pass (schema fresh)**

Run: `cd new-code1-cf && npx vitest run test/schema-ba-admin-berkas.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/schema.sql new-code1-cf/migrations/2026-10-12-ba-pendukung-berkas.sql new-code1-cf/test/schema-ba-admin-berkas.test.js
git commit -m "feat(ba-pendukung): skema & migrasi berkas per mahasiswa"
```

---

### Task 2: Modul merge gambar → PDF (`pdf-lib`)

**Files:**
- Create: `new-code1-cf/src/baMerge.js`
- Modify: `new-code1-cf/package.json` (tambah dependency `pdf-lib`)
- Create: `new-code1-cf/test/baMerge.test.js`

**Interfaces:**
- Produces: `mergeImagesToPdf(pages)` — `pages: Array<{ bytes: Uint8Array, mime?: string }>` → `Promise<Uint8Array>` (byte PDF). Melempar `Error` bila tidak ada halaman valid.

- [ ] **Step 1: Install dependency**

Run: `cd new-code1-cf && npm install pdf-lib@^1.17.1`
Expected: `pdf-lib` muncul di `dependencies` `package.json`.

- [ ] **Step 2: Write the failing test**

`new-code1-cf/test/baMerge.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergeImagesToPdf } from '../src/baMerge.js';

// JPEG 1x1 px (base64) untuk keperluan tes.
const JPEG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
function png() { return Uint8Array.from(atob(JPEG_1x1), (c) => c.charCodeAt(0)); }

describe('mergeImagesToPdf', () => {
  it('menggabungkan beberapa gambar menjadi PDF multi-halaman', async () => {
    const out = await mergeImagesToPdf([
      { bytes: png(), mime: 'image/png' },
      { bytes: png(), mime: 'image/png' }
    ]);
    expect(out.length).toBeGreaterThan(0);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
  });

  it('melewati halaman tanpa byte dan tetap jalan bila ada satu valid', async () => {
    const out = await mergeImagesToPdf([{ bytes: new Uint8Array(0) }, { bytes: png(), mime: 'image/png' }]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(1);
  });

  it('melempar bila tidak ada halaman valid', async () => {
    await expect(mergeImagesToPdf([])).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/baMerge.test.js`
Expected: FAIL ("Cannot find module '../src/baMerge.js'").

- [ ] **Step 4: Write `src/baMerge.js`**

```js
import { PDFDocument } from 'pdf-lib';

const A4_SHORT = 595.28;
const A4_LONG = 841.89;
const MARGIN = 24;

function looksPng(bytes) {
  return bytes && bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

export async function mergeImagesToPdf(pages) {
  const list = Array.isArray(pages) ? pages : [];
  const doc = await PDFDocument.create();
  let added = 0;
  for (const p of list) {
    const bytes = p && p.bytes instanceof Uint8Array ? p.bytes : (p && p.bytes ? new Uint8Array(p.bytes) : null);
    if (!bytes || !bytes.length) continue;
    const isPng = (p && p.mime === 'image/png') || looksPng(bytes);
    let img;
    try {
      img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch (e) {
      continue;
    }
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
    added += 1;
  }
  if (!added) throw new Error('Tidak ada halaman gambar yang valid.');
  return await doc.save();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/baMerge.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/package.json new-code1-cf/package-lock.json new-code1-cf/src/baMerge.js new-code1-cf/test/baMerge.test.js
git commit -m "feat(ba-pendukung): modul merge gambar ke PDF (pdf-lib)"
```

---

### Task 3: Helper ambil byte berkas dari Drive (bridge `getFile`)

**Files:**
- Modify: `new-code1-cf/src/drive.js` (tambah `getDriveFileBase64`)
- Create: `new-code1-cf/test/drive-getfile.test.js`

**Interfaces:**
- Consumes: `callDriveBridge(env, payload)` (`src/drive.js`).
- Produces: `getDriveFileBase64(env, fileId)` → `Promise<{ ok:true, base64, mime }>` atau `{ ok:false, message }`.

- [ ] **Step 1: Write the failing test**

`new-code1-cf/test/drive-getfile.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDriveFileBase64 } from '../src/drive.js';

afterEach(() => { vi.unstubAllGlobals(); });
const env = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };

describe('getDriveFileBase64', () => {
  it('mengembalikan base64 dari bridge', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ success: true, base64: 'AAAA', mimeType: 'image/jpeg' }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const res = await getDriveFileBase64(env, 'FILEID1234567890ABCDEFG');
    expect(res.ok).toBe(true);
    expect(res.base64).toBe('AAAA');
    expect(res.mime).toBe('image/jpeg');
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.action).toBe('getFile');
    expect(body.fileId).toBe('FILEID1234567890ABCDEFG');
  });

  it('gagal ramah saat bridge tidak dikonfigurasi', async () => {
    const res = await getDriveFileBase64({}, 'FILEID1234567890ABCDEFG');
    expect(res.ok).toBe(false);
  });

  it('gagal bila fileId kosong', async () => {
    const res = await getDriveFileBase64(env, '');
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/drive-getfile.test.js`
Expected: FAIL (getDriveFileBase64 is not a function).

- [ ] **Step 3: Implement in `src/drive.js`** (tambahkan di akhir file)

```js
export async function getDriveFileBase64(env, fileId) {
  const id = String(fileId || '').trim();
  if (!id) return { ok: false, message: 'ID berkas kosong.' };
  const res = await callDriveBridge(env, { action: 'getFile', fileId: id });
  if (!res.ok) return { ok: false, message: res.message || 'Gagal mengambil berkas dari Drive.' };
  const base64 = String((res.data && (res.data.base64 || res.data.data)) || '');
  if (!base64) return { ok: false, message: 'Bridge tidak mengembalikan isi berkas.' };
  return { ok: true, base64: base64, mime: String((res.data && res.data.mimeType) || '') };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/drive-getfile.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/drive.js new-code1-cf/test/drive-getfile.test.js
git commit -m "feat(ba-pendukung): helper getDriveFileBase64 (bridge getFile)"
```

---

### Task 4: Buat/dapat BA + kelola peserta + baca untuk modal

**Files:**
- Create: `new-code1-cf/src/write/baAdmin.js`
- Modify: `new-code1-cf/src/write/beritaAcara.js` (export `nextBaId`)
- Create: `new-code1-cf/test/ba-admin-peserta.test.js`

**Interfaces:**
- Consumes: `requireAdmin` (`src/session.js`), `kegiatanKey` (`src/read/common.js`), `nextBaId` (`src/write/beritaAcara.js`), `resolveBaPesertaFromDetail`-equivalent logic (diimplementasikan ulang di modul ini sebagai `listCandidates`).
- Produces:
  - `getOrCreateBaAdmin(db, kegiatan, ctx)` → `{ success, baId, created }`; `kegiatan = { bagian, blok, namaKegiatan, tanggalPelaksanaan, jam, catatan }`.
  - `addBaAdminPesertaBulk(db, baId, ids, ctx)` → `{ success, added, skipped }`.
  - `getBaAdminForPengajuan(db, idPengajuan, ctx)` → `{ success, data: { kegiatan, ba|null, peserta, candidates } }`.

- [ ] **Step 1: Export `nextBaId`**

Di `src/write/beritaAcara.js`, ubah `async function nextBaId(...)` menjadi `export async function nextBaId(...)`.

- [ ] **Step 2: Write the failing test**

`new-code1-cf/test/ba-admin-peserta.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getOrCreateBaAdmin, addBaAdminPesertaBulk, getBaAdminForPengajuan } from '../src/write/baAdmin.js';

afterEach(() => { vi.unstubAllGlobals(); });
async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}
async function seed(id, npm, nama, status, pilihan) {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00',?1,?2,?3,'A','SGD',?4)").bind(id, npm, nama, status).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00',?1,'SGD',?2,'','2026-10-20','')").bind(id, pilihan).run();
}
const keg = { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20' };

describe('baAdmin create & peserta', () => {
  it('membuat satu BA per kegiatan (idempoten)', async () => {
    const ctx = await adminCtx();
    const a = await getOrCreateBaAdmin(env.DB, keg, ctx);
    const b = await getOrCreateBaAdmin(env.DB, keg, ctx);
    expect(a.success).toBe(true);
    expect(a.created).toBe(true);
    expect(b.baId).toBe(a.baId);
    expect(b.created).toBe(false);
  });

  it('menambah peserta bulk tanpa duplikat & memberi urutan', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    await seed('INHAL-2', '2201010002', 'Budi', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    const r1 = await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1', 'INHAL-2'], ctx);
    expect(r1.added).toBe(2);
    const r2 = await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    expect(r2.added).toBe(0);
    expect(r2.skipped).toBe(1);
    const rows = (await env.DB.prepare('SELECT * FROM berita_acara_admin_peserta WHERE ba_id=?1 AND active=1 ORDER BY urutan').bind(baId).all()).results;
    expect(rows.map(r => r.npm)).toEqual(['2201010001', '2201010002']);
  });

  it('getBaAdminForPengajuan mengembalikan BA, peserta, dan kandidat', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    await seed('INHAL-2', '2201010002', 'Budi', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await env.DB.prepare("INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,active) VALUES ('2026-10-12T00:00:00',?1,'INHAL-1','2201010001',1,0,'p1.jpg','https://drive/f1',1)").bind(baId).run();
    const res = await getBaAdminForPengajuan(env.DB, 'INHAL-1', ctx);
    expect(res.success).toBe(true);
    expect(res.data.ba.baId).toBe(baId);
    expect(res.data.peserta.length).toBe(1);
    expect(res.data.peserta[0].pages).toBe(1);
    expect(res.data.peserta[0].fileUrl).toBe('https://drive/f1');
    expect(res.data.candidates.map(c => c.idPengajuan)).toContain('INHAL-2');
  });

  it('requires admin', async () => {
    await expect(getOrCreateBaAdmin(env.DB, keg, {})).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-peserta.test.js`
Expected: FAIL ("Cannot find module '../src/write/baAdmin.js'").

- [ ] **Step 4: Write `src/write/baAdmin.js`**

```js
import { requireAdmin } from '../session.js';
import { kegiatanKey, getBagianBaStatuses } from '../read/common.js';
import { nextBaId } from './beritaAcara.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}
function lowsp(v) { return str(v).toLowerCase().replace(/\s+/g, ' ').trim(); }
function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

async function findBaByKey(db, key) {
  if (!key) return null;
  return await db.prepare('SELECT * FROM berita_acara_admin WHERE kegiatan_key = ?1').bind(key).first();
}

export async function getOrCreateBaAdmin(db, kegiatan, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const bagian = str(kegiatan.bagian) || 'Admin';
  const blok = str(kegiatan.blok);
  const nama = str(kegiatan.namaKegiatan);
  const key = kegiatanKey(bagian, blok, nama);
  const dup = await findBaByKey(db, key);
  if (dup) return { success: true, baId: str(dup.ba_id), created: false };

  const baId = await nextBaId(db, 'berita_acara_admin');
  const ts = nowIso();
  await db.prepare(
    'INSERT INTO berita_acara_admin (timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan, jam, jumlah_peserta, file_name, file_url, catatan, sumber, kegiatan_key, updated_at, needs_regen) ' +
    "VALUES (?1,?2,?3,?4,?5,?6,?7,'0','','',?8,'Admin',?9,?10,0)"
  ).bind(ts, baId, bagian, blok, nama, str(kegiatan.tanggalPelaksanaan), str(kegiatan.jam), str(kegiatan.catatan), key, ts).run();
  return { success: true, baId, created: true };
}

async function nextUrutan(db, baId) {
  const row = await db.prepare('SELECT MAX(urutan) AS m FROM berita_acara_admin_peserta WHERE ba_id = ?1').bind(baId).first();
  const m = row && row.m != null ? Number(row.m) : 0;
  return (isNaN(m) ? 0 : m) + 1;
}

export async function addBaAdminPesertaBulk(db, baId, ids, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  const list = Array.isArray(ids) ? ids.map((x) => str(x)).filter(Boolean) : [];
  if (!id || !list.length) return { success: true, added: 0, skipped: 0 };

  const ba = await db.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };

  const existing = (await db.prepare('SELECT id_pengajuan FROM berita_acara_admin_peserta WHERE ba_id = ?1').bind(id).all()).results || [];
  const have = {};
  for (const r of existing) have[str(r.id_pengajuan)] = true;

  let urutan = await nextUrutan(db, id);
  let added = 0;
  let skipped = 0;
  const ts = nowIso();
  const stmts = [];
  for (const pid of list) {
    if (have[pid]) { skipped += 1; continue; }
    const p = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(pid).first();
    if (!p) { skipped += 1; continue; }
    stmts.push(
      db.prepare(
        'INSERT INTO berita_acara_admin_peserta (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan, urutan, active) ' +
        'VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1)'
      ).bind(ts, id, pid, str(p.npm), str(p.nama_lengkap), str(p.blok), str(ba.bagian), str(p.status), urutan)
    );
    have[pid] = true;
    urutan += 1;
    added += 1;
  }
  if (stmts.length) await db.batch(stmts);
  if (added) {
    const count = (await db.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1').bind(id).first()).n || 0;
    await db.prepare('UPDATE berita_acara_admin SET jumlah_peserta = ?1, updated_at = ?2 WHERE ba_id = ?3').bind(String(count), ts, id).run();
  }
  return { success: true, added, skipped };
}

async function listCandidates(db, kegiatan) {
  const jenis = lowsp(kegiatan.jenis);
  const pilihan = lowsp(kegiatan.pilihan);
  const detailText = lowsp(kegiatan.detail);
  const blokNorm = str(kegiatan.blok).replace(/\s+/g, ' ');
  const bagian = str(kegiatan.bagian);
  const allowed = await getBagianBaStatuses(db);
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
    const st = str(p.status);
    if (allowed.indexOf(st) === -1) continue;
    out.push({ idPengajuan: pid, npm: str(p.npm), namaLengkap: str(p.nama_lengkap), blok: str(p.blok), bagian, statusPengajuan: st });
  }
  out.sort((a, b) => a.npm.toLowerCase().localeCompare(b.npm.toLowerCase()));
  return out;
}

export async function getBaAdminForPengajuan(db, idPengajuan, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(idPengajuan);
  const p = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(id).first();
  if (!p) return { success: false, message: 'Pengajuan tidak ditemukan.' };

  const details = (await db.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1').all()).results || [];
  const d0 = details[0] || {};
  const bagian = str(d0.jenis_kegiatan) || str(p.jenis_kegiatan) || 'Admin';
  const blok = str(p.blok);
  const nama = str(d0.pilihan) + (str(d0.detail) ? ' - ' + str(d0.detail) : '');
  const tanggal = str(d0.tanggal_pelaksanaan) || str(p.tanggal_pelaksanaan);
  const kegiatan = { bagian, blok, namaKegiatan: nama, jenis: str(d0.jenis_kegiatan), pilihan: str(d0.pilihan), detail: str(d0.detail), tanggalPelaksanaan: tanggal };

  const key = kegiatanKey(bagian, blok, nama);
  const baRow = await findBaByKey(db, key);
  let ba = null;
  let peserta = [];
  if (baRow) {
    ba = { baId: str(baRow.ba_id), bagian: str(baRow.bagian), blok: str(baRow.blok), namaKegiatan: str(baRow.nama_kegiatan), tanggal: str(baRow.tanggal_pelaksanaan), jam: str(baRow.jam), catatan: str(baRow.catatan), fileUrl: str(baRow.file_url), jumlahPeserta: Number(baRow.jumlah_peserta) || 0, needsRegen: Number(baRow.needs_regen) === 1 };
    const rows = (await db.prepare('SELECT * FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1 ORDER BY urutan').bind(ba.baId).all()).results || [];
    const berkas = (await db.prepare('SELECT * FROM berita_acara_admin_berkas WHERE ba_id = ?1 AND active = 1 ORDER BY page_index').bind(ba.baId).all()).results || [];
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
  }
  const candidates = await listCandidates(db, kegiatan);
  const inBa = {};
  for (const x of peserta) inBa[x.idPengajuan] = true;
  const filtered = candidates.filter((c) => !inBa[c.idPengajuan]);
  return { success: true, data: { kegiatan, ba, peserta, candidates: filtered } };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-peserta.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/src/write/baAdmin.js new-code1-cf/src/write/beritaAcara.js new-code1-cf/test/ba-admin-peserta.test.js
git commit -m "feat(ba-pendukung): buat/dapat BA, kelola peserta, baca untuk modal"
```

---

### Task 5: Unggah/ganti/hapus berkas per mahasiswa

**Files:**
- Modify: `new-code1-cf/src/write/baAdmin.js`
- Create: `new-code1-cf/test/ba-admin-berkas.test.js`

**Interfaces:**
- Consumes: `saveDriveFile` (`src/drive.js`), `base64ToBytes`/`decodeBase64Size`/`resolveMime` (`src/uploads.js`), `regenerateBaAdminPdf` (Task 6 — di task ini dipanggil lewat stub agar tidak memblok; lihat catatan).
- Produces:
  - `setBaAdminPesertaBerkas(db, baId, idPengajuan, images, ctx)` → `{ success, pages }`; `images = Array<{ data: base64, mimeType }>`.
  - `removeBaAdminPeserta(db, baId, idPengajuan, ctx)` → `{ success }`.
  - Konstanta `BA_ADMIN_MAX_PAGES = 50`, `BA_ADMIN_MAX_BYTES = 20 * 1024 * 1024`.

> Catatan TDD: agar Task 5 bisa diuji independen sebelum Task 6 ada, `setBaAdminPesertaBerkas`/`removeBaAdminPeserta` **tidak memanggil** regenerate di dalam fungsinya. Regenerate dipanggil oleh handler RPC (Task 7) setelah operasi berkas sukses. Ini juga memisahkan tanggung jawab (I/O vs merge).

- [ ] **Step 1: Write the failing test**

`new-code1-cf/test/ba-admin-berkas.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getOrCreateBaAdmin, addBaAdminPesertaBulk, setBaAdminPesertaBerkas, removeBaAdminPeserta, BA_ADMIN_MAX_PAGES } from '../src/write/baAdmin.js';

afterEach(() => { vi.unstubAllGlobals(); });

const BRIDGE = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };
function stubSave() {
  let n = 0;
  const f = vi.fn(async () => { n += 1; return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/IDIDIDIDIDIDIDID' + n + 'xxxx/view', fileId: 'IDIDIDIDIDIDIDID' + n + 'xxxx' }), { status: 200 }); });
  vi.stubGlobal('fetch', f);
  return f;
}
async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: { ...BRIDGE } };
}
async function seed(id, npm, nama, status, pilihan) {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00',?1,?2,?3,'A','SGD',?4)").bind(id, npm, nama, status).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00',?1,'SGD',?2,'','2026-10-20','')").bind(id, pilihan).run();
}
const keg = { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20' };
const IMG = { data: btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xd9)), mimeType: 'image/jpeg' };

describe('baAdmin berkas', () => {
  it('mengunggah halaman & menyimpan baris berkas', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubSave();
    const res = await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [IMG, IMG], ctx);
    expect(res.success).toBe(true);
    expect(res.pages).toBe(2);
    const rows = (await env.DB.prepare('SELECT page_index, active FROM berita_acara_admin_berkas WHERE ba_id=?1 ORDER BY page_index').bind(baId).all()).results;
    expect(rows.map(r => Number(r.page_index))).toEqual([0, 1]);
    expect(rows.every(r => Number(r.active) === 1)).toBe(true);
  });

  it('mengganti berkas: yang lama menjadi riwayat (active=0)', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubSave();
    await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [IMG], ctx);
    await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [IMG], ctx);
    const active = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE ba_id=?1 AND active=1').bind(baId).first()).n;
    const all = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE ba_id=?1').bind(baId).first()).n;
    expect(Number(active)).toBe(1);
    expect(Number(all)).toBe(2);
  });

  it('menolak melebihi batas halaman', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubSave();
    const many = new Array(BA_ADMIN_MAX_PAGES + 1).fill(IMG);
    const res = await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', many, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('halaman');
  });

  it('hapus peserta: peserta & berkas menjadi tidak aktif', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubSave();
    await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [IMG], ctx);
    const res = await removeBaAdminPeserta(env.DB, baId, 'INHAL-1', ctx);
    expect(res.success).toBe(true);
    const p = await env.DB.prepare('SELECT active FROM berita_acara_admin_peserta WHERE ba_id=?1 AND id_pengajuan=?2').bind(baId, 'INHAL-1').first();
    const b = await env.DB.prepare('SELECT active FROM berita_acara_admin_berkas WHERE ba_id=?1 AND id_pengajuan=?2').bind(baId, 'INHAL-1').first();
    expect(Number(p.active)).toBe(0);
    expect(Number(b.active)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-berkas.test.js`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement in `src/write/baAdmin.js`** (tambahkan import & fungsi)

Tambahan import di atas file:
```js
import { saveDriveFile } from '../drive.js';
import { decodeBase64Size, resolveMime } from '../uploads.js';
```

Tambahan konstanta & fungsi:
```js
export const BA_ADMIN_MAX_PAGES = 50;
export const BA_ADMIN_MAX_BYTES = 20 * 1024 * 1024;

async function countActivePages(db, baId, exceptIdPengajuan) {
  const rows = (await db.prepare('SELECT id_pengajuan FROM berita_acara_admin_berkas WHERE ba_id = ?1 AND active = 1').bind(baId).all()).results || [];
  let n = 0;
  for (const r of rows) {
    if (exceptIdPengajuan && str(r.id_pengajuan) === str(exceptIdPengajuan)) continue;
    n += 1;
  }
  return n;
}

export async function setBaAdminPesertaBerkas(db, baId, idPengajuan, images, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  const pid = str(idPengajuan);
  if (!id || !pid) return { success: false, message: 'BA ID / pengajuan kosong.' };

  const ba = await db.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };

  const list = Array.isArray(images) ? images : [];
  if (!list.length) return { success: false, message: 'Tidak ada halaman yang diunggah.' };

  const others = await countActivePages(db, id, pid);
  if (others + list.length > BA_ADMIN_MAX_PAGES) {
    return { success: false, message: 'Batas ' + BA_ADMIN_MAX_PAGES + ' halaman per BA terlampaui.' };
  }

  let totalBytes = 0;
  for (const img of list) {
    const mime = resolveMime(img && img.mimeType, img && img.data);
    if (mime !== 'image/jpeg' && mime !== 'image/jpg' && mime !== 'image/png') {
      return { success: false, message: 'Format halaman harus JPG atau PNG.' };
    }
    totalBytes += decodeBase64Size(img && img.data);
  }
  if (totalBytes > BA_ADMIN_MAX_BYTES) {
    return { success: false, message: 'Total ukuran halaman melebihi 20 MB.' };
  }

  const p = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(pid).first();
  const npm = str(p && p.npm);
  const ts = nowIso();

  // Pastikan peserta ada & aktif.
  const existingPeserta = await db.prepare('SELECT * FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND id_pengajuan = ?2').bind(id, pid).first();
  if (existingPeserta) {
    if (Number(existingPeserta.active) !== 1) {
      await db.prepare('UPDATE berita_acara_admin_peserta SET active = 1 WHERE ba_id = ?1 AND id_pengajuan = ?2').bind(id, pid).run();
    }
  } else {
    const urutan = await nextUrutan(db, id);
    await db.prepare(
      'INSERT INTO berita_acara_admin_peserta (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan, urutan, active) ' +
      "VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1)"
    ).bind(ts, id, pid, npm, str(p && p.nama_lengkap), str(p && p.blok), str(ba.bagian), str(p && p.status), urutan).run();
  }

  // Nona-aktifkan berkas lama milik peserta ini (riwayat).
  await db.prepare('UPDATE berita_acara_admin_berkas SET active = 0, superseded_at = ?1 WHERE ba_id = ?2 AND id_pengajuan = ?3 AND active = 1').bind(ts, id, pid).run();

  // Unggah halaman baru.
  const urutanPeserta = (await db.prepare('SELECT urutan FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND id_pengajuan = ?2').bind(id, pid).first()).urutan;
  let page = 0;
  for (const img of list) {
    const parsed = { data: String(img.data), mimeType: String(img.mimeType || ''), name: String(img.name || ('page-' + (page + 1))) };
    const up = await saveDriveFile(ctx.env, parsed, 'ba-admin-' + id + '-' + (npm || pid), { label: 'Halaman BA' });
    if (!up.ok) return { success: false, message: up.message };
    await db.prepare(
      'INSERT INTO berita_acara_admin_berkas (timestamp, ba_id, id_pengajuan, npm, urutan, page_index, file_name, file_url, active) ' +
      'VALUES (?1,?2,?3,?4,?5,?6,?7,?8,1)'
    ).bind(ts, id, pid, npm, urutanPeserta, page, String(up.name || ''), up.url).run();
    page += 1;
  }

  const count = (await db.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1').bind(id).first()).n || 0;
  await db.prepare('UPDATE berita_acara_admin SET jumlah_peserta = ?1, updated_at = ?2 WHERE ba_id = ?3').bind(String(count), ts, id).run();
  return { success: true, pages: page };
}

export async function removeBaAdminPeserta(db, baId, idPengajuan, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  const pid = str(idPengajuan);
  if (!id || !pid) return { success: false, message: 'BA ID / pengajuan kosong.' };
  const ts = nowIso();
  await db.batch([
    db.prepare('UPDATE berita_acara_admin_peserta SET active = 0 WHERE ba_id = ?1 AND id_pengajuan = ?2').bind(id, pid),
    db.prepare('UPDATE berita_acara_admin_berkas SET active = 0, superseded_at = ?1 WHERE ba_id = ?2 AND id_pengajuan = ?3 AND active = 1').bind(ts, id, pid)
  ]);
  const count = (await db.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1').bind(id).first()).n || 0;
  await db.prepare('UPDATE berita_acara_admin SET jumlah_peserta = ?1, updated_at = ?2 WHERE ba_id = ?3').bind(String(count), ts, id).run();
  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-berkas.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/write/baAdmin.js new-code1-cf/test/ba-admin-berkas.test.js
git commit -m "feat(ba-pendukung): unggah/ganti/hapus berkas per mahasiswa"
```

---

### Task 6: Regenerate PDF gabungan + `needs_regen`

**Files:**
- Modify: `new-code1-cf/src/write/baAdmin.js`
- Create: `new-code1-cf/test/ba-admin-regenerate.test.js`

**Interfaces:**
- Consumes: `getDriveFileBase64`/`parseDriveFileId` (`src/drive.js`), `saveDriveFile` (`src/drive.js`), `mergeImagesToPdf` (`src/baMerge.js`), `base64ToBytes` (`src/uploads.js`).
- Produces: `regenerateBaAdminPdf(db, baId, ctx)` → `{ success, fileUrl, pages }` atau `{ success:false, message }`; menulis `needs_regen` (1 saat gagal, 0 saat sukses).

- [ ] **Step 1: Write the failing test**

`new-code1-cf/test/ba-admin-regenerate.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getOrCreateBaAdmin, addBaAdminPesertaBulk, regenerateBaAdminPdf } from '../src/write/baAdmin.js';

afterEach(() => { vi.unstubAllGlobals(); });
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const BRIDGE = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };
async function adminCtx() { return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: { ...BRIDGE } }; }
async function seed(id, npm, nama, status, pilihan) {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00',?1,?2,?3,'A','SGD',?4)").bind(id, npm, nama, status).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00',?1,'SGD',?2,'','2026-10-20','')").bind(id, pilihan).run();
}
const keg = { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20' };

async function seedBerkas(baId) {
  await env.DB.prepare("INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,active) VALUES ('2026-10-12T00:00:00',?1,'INHAL-1','2201010001',1,0,'p1.jpg','https://drive.google.com/file/d/AAAABBBBCCCCDDDDEEEEFFFFGGGG12345/view',1)").bind(baId).run();
}

describe('regenerateBaAdminPdf', () => {
  it('sukses: simpan PDF & needs_regen=0', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await seedBerkas(baId);
    const f = vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === 'getFile') return new Response(JSON.stringify({ success: true, base64: PNG, mimeType: 'image/png' }), { status: 200 });
      return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/NEWNEWNEWNEWNEWNEWNEWNEWNEW1/view', fileId: 'NEWNEWNEWNEWNEWNEWNEWNEW1' }), { status: 200 });
    });
    vi.stubGlobal('fetch', f);
    const res = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(res.success).toBe(true);
    const ba = await env.DB.prepare('SELECT file_url, needs_regen FROM berita_acara_admin WHERE ba_id=?1').bind(baId).first();
    expect(ba.file_url).toContain('NEWNEWNEWNEWNEWNEWNEWNEW1');
    expect(Number(ba.needs_regen)).toBe(0);
  });

  it('gagal: needs_regen=1 & file_url lama tetap', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await seedBerkas(baId);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, message: 'bridge down' }), { status: 200 })));
    const res = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(res.success).toBe(false);
    const ba = await env.DB.prepare('SELECT needs_regen FROM berita_acara_admin WHERE ba_id=?1').bind(baId).first();
    expect(Number(ba.needs_regen)).toBe(1);
  });

  it('mengunci regenerate bersamaan untuk BA yang sama', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await seedBerkas(baId);
    let release;
    const gate = new Promise((r) => { release = r; });
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === 'getFile') { await gate; return new Response(JSON.stringify({ success: true, base64: PNG, mimeType: 'image/png' }), { status: 200 }); }
      return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/NEWNEWNEWNEWNEWNEWNEWNEWNEW1/view', fileId: 'NEWNEWNEWNEWNEWNEWNEWNEW1' }), { status: 200 });
    }));
    const p1 = regenerateBaAdminPdf(env.DB, baId, ctx);
    const r2 = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(r2.success).toBe(false);
    expect(r2.message).toContain('sedang berjalan');
    release();
    const r1 = await p1;
    expect(r1.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-regenerate.test.js`
Expected: FAIL (regenerateBaAdminPdf not exported).

- [ ] **Step 3: Implement in `src/write/baAdmin.js`**

Tambahan import:
```js
import { saveDriveFile, getDriveFileBase64, parseDriveFileId } from '../drive.js';
import { base64ToBytes } from '../uploads.js';
import { mergeImagesToPdf } from '../baMerge.js';
```

Fungsi:
```js
async function runRegenerateBaAdminPdf(db, baId, ctx) {
  const id = str(baId);
  const ba = await db.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };

  const rows = (await db.prepare(
    'SELECT b.* FROM berita_acara_admin_berkas b ' +
    'JOIN berita_acara_admin_peserta p ON p.ba_id = b.ba_id AND p.id_pengajuan = b.id_pengajuan ' +
    'WHERE b.ba_id = ?1 AND b.active = 1 AND p.active = 1 ' +
    'ORDER BY p.urutan, b.page_index'
  ).bind(id).all()).results || [];

  if (!rows.length) {
    await db.prepare('UPDATE berita_acara_admin SET needs_regen = 0 WHERE ba_id = ?1').bind(id).run();
    return { success: true, fileUrl: str(ba.file_url), pages: 0 };
  }
  if (rows.length > BA_ADMIN_MAX_PAGES) {
    await db.prepare('UPDATE berita_acara_admin SET needs_regen = 1 WHERE ba_id = ?1').bind(id).run();
    return { success: false, message: 'Batas ' + BA_ADMIN_MAX_PAGES + ' halaman terlampaui.' };
  }

  try {
    const pages = [];
    for (const r of rows) {
      const fileId = parseDriveFileId(r.file_url);
      const got = await getDriveFileBase64(ctx.env, fileId);
      if (!got.ok) throw new Error(got.message || 'Gagal mengambil berkas.');
      pages.push({ bytes: base64ToBytes(got.base64), mime: got.mime });
    }
    const pdfBytes = await mergeImagesToPdf(pages);
    const up = await saveDriveFile(ctx.env, { data: bytesToBase64(pdfBytes), mimeType: 'application/pdf', name: 'ba-' + id + '.pdf' }, 'ba-admin-' + id + '-pdf', { allowedMime: ['application/pdf'], maxBytes: BA_ADMIN_MAX_BYTES, label: 'PDF BA' });
    if (!up.ok) throw new Error(up.message || 'Gagal mengunggah PDF BA.');
    const ts = nowIso();
    await db.prepare('UPDATE berita_acara_admin SET file_url = ?1, file_name = ?2, needs_regen = 0, updated_at = ?3 WHERE ba_id = ?4')
      .bind(up.url, String(up.name || ''), ts, id).run();
    return { success: true, fileUrl: up.url, pages: pages.length };
  } catch (e) {
    await db.prepare('UPDATE berita_acara_admin SET needs_regen = 1 WHERE ba_id = ?1').bind(id).run();
    return { success: false, message: (e && e.message) ? e.message : String(e) };
  }
}
```

Tambahkan helper base64, lock per-BA (P15), dan wrapper publik (letakkan setelah `runRegenerateBaAdminPdf`):
```js
function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

const regenLocks = new Set();

export async function regenerateBaAdminPdf(db, baId, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  if (regenLocks.has(id)) return { success: false, message: 'Regenerate sedang berjalan untuk BA ini.' };
  regenLocks.add(id);
  try {
    return await runRegenerateBaAdminPdf(db, id, ctx);
  } finally {
    regenLocks.delete(id);
  }
}
```

> P15 (lock ringan per-BA) diimplementasikan di wrapper `regenerateBaAdminPdf`: `regenLocks` modul-level mencegah dua regenerate bersamaan untuk BA yang sama (best-effort per-isolate; cukup karena operasi ini jarang dan idempoten lewat `needs_regen`).

> Catatan: `saveDriveFile` menerima `allowedMime`/`maxBytes` via `opts` (sudah ada di `src/drive.js`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-regenerate.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/write/baAdmin.js new-code1-cf/test/ba-admin-regenerate.test.js
git commit -m "feat(ba-pendukung): regenerate PDF gabungan + needs_regen"
```

---

### Task 7: RPC wiring

**Files:**
- Modify: `new-code1-cf/src/rpc.js` (import + handler map)
- Create: `new-code1-cf/test/rpc-ba-admin.test.js`

**Interfaces:**
- Consumes: fungsi dari `src/write/baAdmin.js`.
- Produces (nama RPC): `baAdminGet`, `baAdminCreate`, `baAdminAddPeserta`, `baAdminUploadBerkas`, `baAdminRemovePeserta`, `baAdminRegenerate`.

- [ ] **Step 1: Write the failing test**

`new-code1-cf/test/rpc-ba-admin.test.js`:
```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { dispatchRpc } from '../src/rpc.js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('rpc baAdmin', () => {
  it('baAdminCreate lalu baAdminGet', async () => {
    await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')").run();
    await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00','INHAL-1','SGD','SGD 1','','2026-10-20','')").run();
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    const get0 = await dispatchRpc(env.DB, 'baAdminGet', ['INHAL-1', token], '', env);
    expect(get0.success).toBe(true);
    expect(get0.data.ba).toBe(null);
    const created = await dispatchRpc(env.DB, 'baAdminCreate', [{ bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20' }, token], '', env);
    expect(created.success).toBe(true);
    const get1 = await dispatchRpc(env.DB, 'baAdminGet', ['INHAL-1', token], '', env);
    expect(get1.data.ba.baId).toBe(created.baId);
  });

  it('menolak tanpa token (tanpa bocor detail)', async () => {
    const res = await dispatchRpc(env.DB, 'baAdminGet', ['INHAL-1'], '', env);
    expect(res.success).toBeFalsy();
    expect(res.error || res.message).toBeTruthy();
  });
});
```

> Dispatcher asli: `dispatchRpc(db, fn, args, ip, env)` di `src/rpc.js:116`; token disisipkan sebagai argumen terakhir (pola sama seperti `test/rpc.test.js`). Handler menerima `ctx = { token, session, ip, env }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/rpc-ba-admin.test.js`
Expected: FAIL (unknown RPC / ba null mismatch).

- [ ] **Step 3: Wire handlers in `src/rpc.js`**

Tambahkan import:
```js
import {
  getOrCreateBaAdmin, addBaAdminPesertaBulk, getBaAdminForPengajuan,
  setBaAdminPesertaBerkas, removeBaAdminPeserta, regenerateBaAdminPdf
} from './write/baAdmin.js';
```

Tambahkan ke `HANDLERS`:
```js
  baAdminGet: (db, args, ctx) => getBaAdminForPengajuan(db, args[0], ctx),
  baAdminCreate: (db, args, ctx) => getOrCreateBaAdmin(db, args[0], ctx),
  baAdminAddPeserta: (db, args, ctx) => addBaAdminPesertaBulk(db, args[0], args[1], ctx),
  baAdminUploadBerkas: async (db, args, ctx) => {
    const set = await setBaAdminPesertaBerkas(db, args[0], args[1], args[2], ctx);
    if (!set.success) return set;
    const regen = await regenerateBaAdminPdf(db, args[0], ctx);
    return { success: true, pages: set.pages, fileUrl: regen.fileUrl || '', needsRegen: !regen.success, message: regen.success ? 'Berkas disimpan.' : (regen.message || 'Berkas tersimpan, PDF gagal dirakit.') };
  },
  baAdminRemovePeserta: async (db, args, ctx) => {
    const rm = await removeBaAdminPeserta(db, args[0], args[1], ctx);
    if (!rm.success) return rm;
    const regen = await regenerateBaAdminPdf(db, args[0], ctx);
    return { success: true, needsRegen: !regen.success };
  },
  baAdminRegenerate: (db, args, ctx) => regenerateBaAdminPdf(db, args[0], ctx),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/rpc-ba-admin.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/rpc.js new-code1-cf/test/rpc-ba-admin.test.js
git commit -m "feat(ba-pendukung): RPC baAdminGet/Create/AddPeserta/UploadBerkas/Remove/Regenerate"
```

---

### Task 8: Frontend — kartu BA Pendukung di modal Detail Pengajuan

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Create: `new-code1-cf/test/dashboard-ba-pendukung.test.js`

**Interfaces:**
- Consumes (RPC): `baAdminGet`, `baAdminCreate`, `baAdminAddPeserta`, `baAdminUploadBerkas`, `baAdminRemovePeserta`, `baAdminRegenerate`.
- Consumes (klien): `ScanPdf.compressToJpeg` (`public/scan-pdf.js`).

- [ ] **Step 1: Write the guard test**

`new-code1-cf/test/dashboard-ba-pendukung.test.js`:
```js
import { describe, it, expect } from 'vitest';
import dashboardHtml from '../public/dashboard.html?raw';

describe('dashboard BA Pendukung di modal detail', () => {
  it('memuat kartu, pemilih peserta, dan hook aksi', () => {
    expect(dashboardHtml).toContain('baPendukung');
    expect(dashboardHtml).toContain("openBaPendukung(");
    expect(dashboardHtml).toContain("tambahPesertaBa(");
    expect(dashboardHtml).toContain("unggahBerkasBa(");
    expect(dashboardHtml).toContain("hapusPesertaBa(");
    expect(dashboardHtml).toContain("regenerateBa(");
    expect(dashboardHtml).toContain('Berita Acara Pendukung');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/dashboard-ba-pendukung.test.js`
Expected: FAIL.

- [ ] **Step 3: Tambah state & template**

Di objek `data()` cari blok `detail: { open: false, ... }` (sekitar `public/dashboard.html:2075`) dan tambahkan field `baPendukung`:
```js
baPendukung: { loading: false, data: null, showPicker: false, pickSelected: {}, uploadFor: '', uploadItems: [], uploadBusy: false, uploadSeq: 0 },
```

Ganti blok kartu BA read-only (sekitar `public/dashboard.html:1717-1722`) dengan kartu interaktif:
```html
<div v-if="detail.p" class="ba-align-card dash-card p-4">
    <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-sm font-bold text-slate-900"><i class="bi bi-file-earmark-text text-base text-brand-600"></i> Berita Acara Pendukung</div>
        <button v-if="detail.baPendukung.data && detail.baPendukung.data.ba && detail.baPendukung.data.ba.needsRegen" class="btn-soft !py-1 !px-2 text-[11px]" @click="regenerateBa()"><i class="bi bi-arrow-repeat"></i> Regenerate</button>
    </div>
    <div v-if="detail.baPendukung.loading" class="text-xs text-slate-400">Memuat…</div>
    <template v-else-if="detail.baPendukung.data">
        <div v-if="!detail.baPendukung.data.ba" class="flex items-center gap-2">
            <button class="btn-primary !py-1.5 text-xs" @click="createBaPendukung()"><i class="bi bi-plus-circle"></i> Buat BA Pendukung</button>
            <span class="text-[11px] text-slate-400">Untuk kegiatan: {{ detail.baPendukung.data.kegiatan.namaKegiatan || '-' }}</span>
        </div>
        <template v-else>
            <div class="mb-1 text-[11px] text-slate-500">{{ detail.baPendukung.data.ba.baId }} · {{ detail.baPendukung.data.ba.namaKegiatan }} · {{ detail.baPendukung.data.ba.tanggal || '-' }}</div>
            <a v-if="detail.baPendukung.data.ba.fileUrl" :href="safeUrl(detail.baPendukung.data.ba.fileUrl)" target="_blank" rel="noopener noreferrer" class="btn-primary !py-1.5 text-xs"><i class="bi bi-file-earmark-pdf"></i> Lihat PDF BA</a>
            <div class="mt-3 space-y-2">
                <div v-for="(pe, i) in detail.baPendukung.data.peserta" :key="pe.idPengajuan" :class="pe.isCurrent ? 'rounded-lg ring-1 ring-brand-300' : ''" class="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-100">
                    <span class="text-xs font-semibold text-slate-700">{{ pe.urutan }}. {{ pe.namaLengkap || pe.npm }}</span>
                    <span class="text-[11px] text-slate-400">{{ pe.pages }} halaman</span>
                    <span v-if="!pe.pages" class="rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">Belum ada berkas</span>
                    <span class="ml-auto flex gap-1">
                        <button class="btn-soft !py-1 !px-2 text-[11px]" @click="unggahBerkasBa(pe)"><i class="bi bi-cloud-arrow-up"></i> {{ pe.pages ? 'Ganti berkas' : 'Unggah/Scan halaman' }}</button>
                        <a v-if="pe.pages" :href="safeUrl(berkasBaUrl(pe))" target="_blank" rel="noopener noreferrer" class="btn-soft !py-1 !px-2 text-[11px]"><i class="bi bi-download"></i></a>
                        <button class="btn-soft !py-1 !px-2 text-[11px] !text-rose-600" @click="hapusPesertaBa(pe)"><i class="bi bi-x-lg"></i></button>
                    </span>
                </div>
            </div>
            <div class="mt-3">
                <button class="btn-soft !py-1.5 text-xs" @click="detail.baPendukung.showPicker = !detail.baPendukung.showPicker"><i class="bi bi-person-plus"></i> Tambah peserta</button>
                <div v-if="detail.baPendukung.showPicker" class="mt-2 rounded-xl ring-1 ring-slate-200">
                    <div v-if="!detail.baPendukung.data.candidates.length" class="p-3 text-[11px] text-slate-400">Tidak ada kandidat (mahasiswa sekegiatan berstatus ACC/Diterima yang belum masuk BA).</div>
                    <div v-for="c in detail.baPendukung.data.candidates" :key="c.idPengajuan" class="flex items-center gap-2 border-b border-slate-100 p-2 last:border-0">
                        <input type="checkbox" :value="c.idPengajuan" v-model="detail.baPendukung.pickSelected">
                        <span class="text-xs text-slate-700">{{ c.npm }} — {{ c.namaLengkap }} <span class="text-slate-400">({{ c.blok }})</span></span>
                    </div>
                    <div class="flex justify-end gap-2 p-2">
                        <button class="btn-primary !py-1.5 text-xs" @click="tambahPesertaBa()"><i class="bi bi-check2"></i> Tambahkan</button>
                    </div>
                </div>
            </div>
        </template>
    </template>
</div>
```

Tambahkan input kamera tersembunyi untuk halaman BA Pendukung di dekat `refs` upload lain (di dalam template detail, mis. setelah kartu ini):
```html
<input ref="baPendukungCamera" type="file" accept="image/*" capture="environment" multiple class="hidden" @change="onBaPendukungPhotos($event)">
<input ref="baPendukungFile" type="file" accept=".jpg,.jpeg,.png" multiple class="hidden" @change="onBaPendukungPhotos($event)">
```
Dan tombol pemicu di dalam aksi `unggahBerkasBa` (lihat method) akan `click()` ref tersebut.

- [ ] **Step 4: Tambah methods (di `methods` object, mis. dekat `matchBaForPengajuan`)**

```js
async loadBaPendukung(idPengajuan) {
    const d = this.detail.baPendukung;
    d.loading = true; d.data = null; d.pickSelected = {}; d.showPicker = false;
    try {
        const res = await this.run('baAdminGet', idPengajuan);
        if (res && res.success) d.data = res.data;
        else this.notify((res && res.message) || 'Gagal memuat BA Pendukung.', false);
    } catch (e) {
        this.notify('Gagal memuat BA Pendukung: ' + e, false);
    } finally { d.loading = false; }
},
async createBaPendukung() {
    const k = this.detail.baPendukung.data && this.detail.baPendukung.data.kegiatan;
    if (!k) return;
    const res = await this.run('baAdminCreate', { bagian: k.bagian, blok: k.blok, namaKegiatan: k.namaKegiatan, tanggalPelaksanaan: k.tanggalPelaksanaan || '', jam: '', catatan: '' });
    this.notify((res && res.message) || 'BA Pendukung dibuat.', !!(res && res.success));
    if (res && res.success) await this.loadBaPendukung(this.detail.p['ID Pengajuan']);
},
async tambahPesertaBa() {
    const d = this.detail.baPendukung;
    const ids = Object.keys(d.pickSelected).filter((k) => d.pickSelected[k]);
    if (!ids.length) { this.notify('Pilih minimal satu peserta.', false); return; }
    const baId = d.data.ba.baId;
    const res = await this.run('baAdminAddPeserta', baId, ids);
    this.notify((res && res.success) ? (res.added + ' peserta ditambahkan.') : ((res && res.message) || 'Gagal.'), !!(res && res.success));
    if (res && res.success) await this.loadBaPendukung(this.detail.p['ID Pengajuan']);
},
unggahBerkasBa(pe) {
    this.detail.baPendukung.uploadFor = pe.idPengajuan;
    this.detail.baPendukung.uploadItems = [];
    const el = this.$refs.baPendukungCamera; if (el) el.click();
},
onBaPendukungPhotos(e) {
    const files = Array.from(e.target.files || []);
    if (e.target) e.target.value = '';
    const d = this.detail.baPendukung;
    Promise.all(files.map((f) => window.ScanPdf.compressToJpeg(f))).then((items) => {
        items.forEach((it, i) => { d.uploadSeq += 1; d.uploadItems.push({ id: 'bap-' + d.uploadSeq, bytes: it.bytes, width: it.width, height: it.height }); });
        if (d.uploadItems.length) this.simpanBerkasBa();
    }).catch((err) => this.notify('Gagal memproses gambar: ' + err, false));
},
async simpanBerkasBa() {
    const d = this.detail.baPendukung;
    if (!d.uploadItems.length || !d.uploadFor) return;
    d.uploadBusy = true;
    try {
        const images = Array.from(d.uploadItems).map((it) => ({ data: this.bytesToBase64(it.bytes), mimeType: 'image/jpeg', name: it.id + '.jpg' }));
        const res = await this.run('baAdminUploadBerkas', d.data.ba.baId, d.uploadFor, images);
        this.notify((res && res.message) || 'Berkas disimpan.', !!(res && res.success));
        d.uploadItems = []; d.uploadFor = '';
        if (res && res.success) await this.loadBaPendukung(this.detail.p['ID Pengajuan']);
    } catch (e) {
        this.notify('Gagal menyimpan berkas: ' + e, false);
    } finally { d.uploadBusy = false; }
},
async hapusPesertaBa(pe) {
    const ok = await this.askConfirm({ title: 'Hapus dari BA', message: 'Hapus ' + (pe.namaLengkap || pe.npm) + ' dari BA Pendukung? Berkas lama tetap tersimpan sebagai riwayat.', icon: 'bi-x-lg', tone: 'danger', confirmLabel: 'Hapus' });
    if (!ok) return;
    const res = await this.run('baAdminRemovePeserta', this.detail.baPendukung.data.ba.baId, pe.idPengajuan);
    this.notify((res && res.message) || 'Dihapus.', !!(res && res.success));
    if (res && res.success) await this.loadBaPendukung(this.detail.p['ID Pengajuan']);
},
async regenerateBa() {
    const res = await this.run('baAdminRegenerate', this.detail.baPendukung.data.ba.baId);
    this.notify((res && res.message) || 'Regenerate selesai.', !!(res && res.success));
    await this.loadBaPendukung(this.detail.p['ID Pengajuan']);
},
berkasBaUrl(pe) {
    return (pe && pe.fileUrl) ? pe.fileUrl : '#';
},
bytesToBase64(bytes) {
    let bin = ''; const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
},
```

Di `applyDetailFromRow` (sekitar `public/dashboard.html:3112`), setelah `this.detail.baList = this.matchBaForPengajuan(p);`, tambahkan pemuatan BA Pendukung:
```js
this.loadBaPendukung(p['ID Pengajuan']);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/dashboard-ba-pendukung.test.js`
Expected: PASS.

- [ ] **Step 6: Full regression + manual smoke**

Run: `cd new-code1-cf && npx vitest run`
Expected: seluruh suite hijau.

Manual (via preview server): buka Detail Pengajuan → kartu "Berita Acara Pendukung" → Buat BA → Tambah peserta → Unggah halaman → PDF terbentuk → Ganti/Hapus → regenerate.

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-ba-pendukung.test.js
git commit -m "feat(ba-pendukung): kartu BA Pendukung interaktif di modal Detail Pengajuan"
```

---

### Task 9: Dokumentasi bridge `getFile`

**Files:**
- Modify: `new-code1-cf/DEPLOY.md`

- [ ] **Step 1: Tambah dokumentasi**

Tambahkan bagian "Aksi bridge" di `DEPLOY.md` (dekat dokumentasi `GAS_DRIVE_URL`/`GAS_DRIVE_TOKEN`) yang menjelaskan aksi yang harus disediakan Apps Script:
```markdown
### Aksi Bridge Apps Script

Web App Apps Script harus menangani aksi berikut (POST JSON, field `token`):

- `saveFile` — simpan base64, kembalikan `{ success, url, fileId }`.
- `trashFile` — pindahkan berkas ke trash by `fileId`.
- `sendFinalEmail` / `sendStatusEmail` — kirim email.
- `getFile` — **baru**: terima `fileId`, kembalikan `{ success, base64, mimeType }` (isi berkas). Dipakai worker untuk merakit PDF BA Pendukung.
```

- [ ] **Step 2: Commit**

```bash
git add new-code1-cf/DEPLOY.md
git commit -m "docs(deploy): dokumentasikan aksi bridge getFile"
```

---

## Self-Review

**1. Spec coverage:**
- P1 satu BA per kegiatan → Task 4 `getOrCreateBaAdmin` + `findBaByKey`.
- P2 selalu bisa diedit → Task 5/6 (tanpa status).
- P3/P4 gabungan berkas gambar per mahasiswa → Task 2, 5, 6.
- P5 server + pdf-lib → Task 2.
- P6 riwayat berkas, PDF ditimpa → Task 5 (active=0/superseded_at), Task 6 (update file_url).
- P7 admin only → `requireAdmin` di semua fungsi + Task 7.
- P8 urutan ditambahkan → `urutan` di peserta + ORDER BY di Task 6.
- P9 pemilih peserta → Task 4 `listCandidates` + Task 8 picker.
- P10 peserta tanpa berkas → Task 4 bulk + Task 8 badge.
- P11 gate status → `getBagianBaStatuses` di `listCandidates`.
- P12 bridge getFile → Task 3.
- P13 berkas & PDF di Drive → Task 5/6 `saveDriveFile`.
- P14 needs_regen → Task 6 + Task 8 tombol.
- P15 lock per-BA → Task 6 wrapper `regenerateBaAdminPdf` (`regenLocks`).
- P16 batas 50 halaman/20MB → Task 5/6.
- P17 kompres JPEG → Task 8 (`compressToJpeg`).
- P18 unduh berkas per mahasiswa → Task 4 (`peserta[].files`/`fileUrl`) + Task 8 tombol unduh.
- P19 tanpa audit → tidak ada task (sesuai).

**2. Placeholder scan:** Tidak ada TBD/TODO. Setiap step berisi kode/perintah konkret.

**3. Type consistency:** `mergeImagesToPdf(pages: {bytes, mime})` (Task 2) dipakai konsisten di Task 6. `saveDriveFile(env, input, prefix, opts)` (existing) dipakai konsisten. `getBaAdminForPengajuan` mengembalikan `{ success, data:{ kegiatan, ba, peserta, candidates } }` (Task 4) dan dikonsumsi Task 8. Nama RPC konsisten Task 7 ↔ Task 8.

## Catatan
- `pdf-lib` menambah ukuran bundle worker; ukuran startup masih jauh di bawah batas.
- Aksi bridge `getFile` perlu disetujui/diterapkan di Apps Script (di luar repo) agar regenerate berhasil di produksi; tanpa itu, regenerate akan menandai `needs_regen`.
- Jika `matchBaForPengajuan`/`detail.baList` masih dipakai bagian lain, biarkan; kartu baru menggantikan tampilan BA di modal detail saja.
