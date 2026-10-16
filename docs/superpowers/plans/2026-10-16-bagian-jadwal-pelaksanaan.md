# Jadwal Pelaksanaan & Penataan Ulang Panel Bagian — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambah alur Jadwal Pelaksanaan (dibuat admin Bagian) yang direferensikan BA Pelaksanaan, menata `bagian.html` menjadi tab Jadwal/Berita Acara/Riwayat, dan menampilkan jadwal di timeline detail portal.

**Architecture:** Dua tabel D1 baru (`jadwal_pelaksanaan`, `jadwal_peserta`) + kolom `berita_acara.jadwal_id`. Modul `src/read/jadwal.js` dan `src/write/jadwal.js` baru; integrasi ke `src/read/bagian.js`, `src/write/beritaAcara.js`, `src/rpc.js`, `src/portal.js`. UI murni Vue 3 global + Tailwind (tidak ada build step).

**Tech Stack:** Cloudflare Workers + Hono, D1 (SQLite), Vue 3 (CDN, global build), Vitest + `@cloudflare/vitest-pool-workers`.

## Global Constraints

- Data produksi berjalan: migrasi **aditif** (ADD/CREATE IF NOT EXISTS), tanpa `DROP`/`DELETE` tabel/kolom produksi.
- Komentar SQL tidak boleh memakai `;`. Setiap statement diakhiri `;` (dipisah runner `migrations/*.test.js` dan `test/setup.js`).
- Status pengajuan: `Menunggu`, `ACC`, `Ditolak`, `Dibatalkan` (tanpa `Diterima`).
- Bahasa UI Indonesia. Komentar kode minimal; hanya bila menjelaskan "mengapa".
- Pertahankan seluruh kemampuan produksi `bagian.html` (Daftar Peserta, unggah + scan BA, lihat file, hapus BA, filter blok, polling, cache lokal).
- Definisi BA "selesai": `dosen` + `tanggal_pelaksanaan` + `jam` terisi.
- Nama tabel/kolom DB `snake_case`; payload RPC/objek klien memakai nama yang sudah ada (`namaKegiatan`, `tanggalPelaksanaan`, `peserta`, dst.).
- Verifikasi tiap task: jalankan test terkait; task terakhir jalankan `npm test` penuh.

---

## File Structure

- Create: `new-code1-cf/migrations/2026-10-16-jadwal-pelaksanaan.sql`
- Create: `new-code1-cf/src/read/jadwal.js`
- Create: `new-code1-cf/src/write/jadwal.js`
- Modify: `new-code1-cf/schema.sql`
- Modify: `new-code1-cf/src/read/columns.js`
- Modify: `new-code1-cf/src/read/bagian.js`
- Modify: `new-code1-cf/src/write/beritaAcara.js`
- Modify: `new-code1-cf/src/rpc.js`
- Modify: `new-code1-cf/src/portal.js`
- Modify: `new-code1-cf/public/bagian.html`
- Modify: `new-code1-cf/public/portal.html`
- Create tests: `test/migration-jadwal-pelaksanaan.test.js`, `test/read-jadwal.test.js`, `test/write-jadwal.test.js`, `test/read-bagian-jadwal.test.js`, `test/write-berita-acara-jadwal.test.js`, `test/rpc-jadwal.test.js`, `test/portal-jadwal.test.js`, `test/bagian-jadwal-template.test.js`, `test/portal-jadwal-template.test.js`

---

### Task 1: Skema & migrasi (tabel jadwal + kolom `jadwal_id`)

**Files:**
- Create: `new-code1-cf/migrations/2026-10-16-jadwal-pelaksanaan.sql`
- Modify: `new-code1-cf/schema.sql`
- Modify: `new-code1-cf/src/read/columns.js:26-31` (mapping `berita_acara`)
- Test: `new-code1-cf/test/migration-jadwal-pelaksanaan.test.js`

**Interfaces:**
- Produces: tabel `jadwal_pelaksanaan(id, timestamp, jadwal_id, bagian, blok, nama_kegiatan, kegiatan_key, tanggal, jam, dosen, catatan, active, created_by, updated_at)`, tabel `jadwal_peserta(id, timestamp, jadwal_id, id_pengajuan, npm, nama_lengkap, blok, status_pengajuan)`, kolom `berita_acara.jadwal_id`, mapping klien `Jadwal ID`.

- [ ] **Step 1: Write the failing test**

`new-code1-cf/test/migration-jadwal-pelaksanaan.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-16-jadwal-pelaksanaan.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function simulatePreMigration() {
  await env.DB.prepare('DROP TABLE IF EXISTS jadwal_peserta').run();
  await env.DB.prepare('DROP TABLE IF EXISTS jadwal_pelaksanaan').run();
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara').run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT, ' +
      'nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, dosen TEXT, jumlah_peserta TEXT, ' +
      'file_name TEXT, file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT, label TEXT DEFAULT \'\')'
  ).run();
}

async function runMigration() {
  for (const stmt of statements) {
    try {
      await env.DB.prepare(stmt).run();
    } catch (e) {
      if (String(e && e.message).indexOf('duplicate column name') === -1) throw e;
    }
  }
}

async function columnInfo(table, name) {
  const rows = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  return (rows.results || []).find((r) => r.name === name) || null;
}

describe('migrasi jadwal pelaksanaan', () => {
  it('membuat tabel jadwal dan menambah kolom jadwal_id', async () => {
    await simulatePreMigration();
    await runMigration();
    await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,active) VALUES ('2026-10-01T08:00:00','JDW-2026-0001','SGD','A','SGD 1','sgd|a|sgd 1','2026-10-02','09:00','dr. Andi',1)").run();
    await env.DB.prepare("INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm) VALUES ('2026-10-01T08:00:00','JDW-2026-0001','INHAL-1','2201010001')").run();
    const j = await env.DB.prepare("SELECT jadwal_id FROM jadwal_pelaksanaan WHERE jadwal_id='JDW-2026-0001'").first();
    expect(j.jadwal_id).toBe('JDW-2026-0001');
    expect(await columnInfo('berita_acara', 'jadwal_id')).toBeTruthy();
  });

  it('idempotent (dapat dijalankan dua kali)', async () => {
    await simulatePreMigration();
    await runMigration();
    await runMigration();
    expect(await columnInfo('berita_acara', 'jadwal_id')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/migration-jadwal-pelaksanaan.test.js`
Expected: FAIL — `Cannot find module '../migrations/2026-10-16-jadwal-pelaksanaan.sql?raw'`.

- [ ] **Step 3: Create the migration file**

`new-code1-cf/migrations/2026-10-16-jadwal-pelaksanaan.sql`:

```sql
-- Jadwal Pelaksanaan: admin Bagian membuat jadwal lebih dulu, lalu BA Pelaksanaan
-- merujuk jadwal lewat berita_acara.jadwal_id. Aditif, tanpa DROP/DELETE data lama
CREATE TABLE IF NOT EXISTS jadwal_pelaksanaan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, jadwal_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, kegiatan_key TEXT, tanggal TEXT, jam TEXT, dosen TEXT, catatan TEXT,
  active INTEGER DEFAULT 1, created_by TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS jadwal_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, jadwal_id TEXT, id_pengajuan TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, status_pengajuan TEXT
);
CREATE INDEX IF NOT EXISTS idx_jadwal_kegiatan_key ON jadwal_pelaksanaan(kegiatan_key);
CREATE INDEX IF NOT EXISTS idx_jadwal_peserta_jadwal_id ON jadwal_peserta(jadwal_id);
CREATE INDEX IF NOT EXISTS idx_jadwal_peserta_pengajuan ON jadwal_peserta(id_pengajuan);
ALTER TABLE berita_acara ADD COLUMN jadwal_id TEXT DEFAULT '';
```

- [ ] **Step 4: Update `schema.sql` (instalasi baru)**

Di blok `DROP TABLE` (sekitar baris 73-84) tambahkan sebelum `DROP TABLE IF EXISTS berita_acara_peserta;`:

```sql
DROP TABLE IF EXISTS jadwal_peserta;
DROP TABLE IF EXISTS jadwal_pelaksanaan;
```

Setelah `CREATE TABLE berita_acara_peserta (...)` (baris 123) tambahkan tabel baru:

```sql
CREATE TABLE jadwal_pelaksanaan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, jadwal_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, kegiatan_key TEXT, tanggal TEXT, jam TEXT, dosen TEXT, catatan TEXT,
  active INTEGER DEFAULT 1, created_by TEXT, updated_at TEXT
);
CREATE TABLE jadwal_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, jadwal_id TEXT, id_pengajuan TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, status_pengajuan TEXT
);
CREATE INDEX idx_jadwal_kegiatan_key ON jadwal_pelaksanaan(kegiatan_key);
CREATE INDEX idx_jadwal_peserta_jadwal_id ON jadwal_peserta(jadwal_id);
CREATE INDEX idx_jadwal_peserta_pengajuan ON jadwal_peserta(id_pengajuan);
```

Pada `CREATE TABLE berita_acara` tambahkan kolom terakhir: `..., kegiatan_key TEXT, label TEXT DEFAULT '', jadwal_id TEXT DEFAULT ''`.

- [ ] **Step 5: Add client column mapping**

Di `new-code1-cf/src/read/columns.js`, objek `berita_acara`, ubah baris terakhir menjadi:

```js
    catatan: 'Catatan', sumber: 'Sumber', kegiatan_key: 'Kegiatan Key', label: 'Label', jadwal_id: 'Jadwal ID'
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/migration-jadwal-pelaksanaan.test.js test/schema-ba-columns.test.js`
Expected: PASS (keduanya).

- [ ] **Step 7: Commit**

```bash
cd /workspace && git add new-code1-cf/migrations/2026-10-16-jadwal-pelaksanaan.sql new-code1-cf/schema.sql new-code1-cf/src/read/columns.js new-code1-cf/test/migration-jadwal-pelaksanaan.test.js
git commit -m "feat(jadwal): tabel jadwal pelaksanaan dan kolom berita_acara.jadwal_id"
```

---

### Task 2: `src/read/jadwal.js` — `computeJadwalList`

**Files:**
- Create: `new-code1-cf/src/read/jadwal.js`
- Test: `new-code1-cf/test/read-jadwal.test.js`

**Interfaces:**
- Consumes: `baginaKey`, `kegiatanKey`, `getMasterOptions`, `resolveBagian12` dari `./common.js`.
- Produces: `computeJadwalList(db, bagianFilter, kategori)` → array `{ JadwalID, Bagian, Blok, NamaKegiatan, kegiatan_key, Tanggal, Jam, Dosen, Catatan, Active, punyaBa, baId, peserta: [{ idPengajuan, npm, namaLengkap, blok, statusPengajuan }] }`.

- [ ] **Step 1: Write the failing test**

`new-code1-cf/test/read-jadwal.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { computeJadwalList } from '../src/read/jadwal.js';

async function seedJadwal(id = 'JDW-2026-0001', bagian = 'SGD', blok = 'A', nama = 'SGD 1') {
  await env.DB.prepare(
    "INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-10-01T08:00:00',?1,?2,?3,?4,?5,'2026-10-02','09:00','dr. Andi','',1)"
  ).bind(id, bagian, blok, nama, [bagian, blok, nama].join('|').toLowerCase()).run();
  await env.DB.prepare(
    "INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan) VALUES ('2026-10-01T08:00:00',?1,'INHAL-1','2201010001','Aisyah','A','ACC')"
  ).bind(id).run();
}

describe('computeJadwalList', () => {
  it('mengembalikan jadwal aktif dengan peserta', async () => {
    await seedJadwal();
    const list = await computeJadwalList(env.DB, '', '');
    expect(list).toHaveLength(1);
    expect(list[0].JadwalID).toBe('JDW-2026-0001');
    expect(list[0].Dosen).toBe('dr. Andi');
    expect(list[0].punyaBa).toBe(false);
    expect(list[0].peserta).toHaveLength(1);
    expect(list[0].peserta[0].namaLengkap).toBe('Aisyah');
  });

  it('menandai punyaBa bila ada BA merujuk jadwal', async () => {
    await seedJadwal();
    await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,sumber,kegiatan_key,jadwal_id) VALUES ('2026-10-02T09:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-10-02','Bagian','sgd|a|sgd 1','JDW-2026-0001')").run();
    const list = await computeJadwalList(env.DB, '', '');
    expect(list[0].punyaBa).toBe(true);
    expect(list[0].baId).toBe('BA-PEL-2026-0001');
  });

  it('menyembunyikan jadwal yang dibatalkan', async () => {
    await seedJadwal();
    await env.DB.prepare("UPDATE jadwal_pelaksanaan SET active=0").run();
    const list = await computeJadwalList(env.DB, '', '');
    expect(list).toHaveLength(0);
  });

  it('menyaring berdasarkan bagian', async () => {
    await seedJadwal('JDW-2026-0001', 'SGD', 'A', 'SGD 1');
    await seedJadwal('JDW-2026-0002', 'KKD', 'B', 'KKD 1');
    const list = await computeJadwalList(env.DB, 'KKD', 'KKD');
    expect(list).toHaveLength(1);
    expect(list[0].JadwalID).toBe('JDW-2026-0002');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/read-jadwal.test.js`
Expected: FAIL — `Cannot find module '../src/read/jadwal.js'`.

- [ ] **Step 3: Implement `src/read/jadwal.js`**

```js
import { baginaKey, getMasterOptions, resolveBagian12 } from './common.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

export async function computeJadwalList(db, bagianFilter, kategori) {
  const jadwal = (await db.prepare('SELECT * FROM jadwal_pelaksanaan').all()).results || [];
  const pesertaRows = (await db.prepare('SELECT * FROM jadwal_peserta').all()).results || [];
  const baRows = (await db.prepare('SELECT ba_id, jadwal_id FROM berita_acara').all()).results || [];

  const baIdByJadwal = {};
  for (const b of baRows) {
    const j = str(b.jadwal_id);
    if (j && !baIdByJadwal[j]) baIdByJadwal[j] = str(b.ba_id);
  }
  const pesertaByJadwal = {};
  for (const p of pesertaRows) {
    const j = str(p.jadwal_id);
    if (!j) continue;
    if (!pesertaByJadwal[j]) pesertaByJadwal[j] = [];
    pesertaByJadwal[j].push({
      idPengajuan: str(p.id_pengajuan), npm: str(p.npm),
      namaLengkap: str(p.nama_lengkap), blok: str(p.blok),
      statusPengajuan: str(p.status_pengajuan)
    });
  }

  const rows = [];
  for (const r of jadwal) {
    if (Number(r.active) !== 1) continue;
    const id = str(r.jadwal_id);
    rows.push({
      JadwalID: id,
      Bagian: str(r.bagian),
      Blok: str(r.blok),
      NamaKegiatan: str(r.nama_kegiatan),
      kegiatan_key: str(r.kegiatan_key),
      Tanggal: str(r.tanggal),
      Jam: str(r.jam),
      Dosen: str(r.dosen),
      Catatan: str(r.catatan),
      Active: Number(r.active) || 0,
      punyaBa: !!baIdByJadwal[id],
      baId: baIdByJadwal[id] || '',
      peserta: pesertaByJadwal[id] || []
    });
  }

  const filter = baginaKey(bagianFilter);
  if (!filter) return rows;
  const kat = baginaKey(kategori);
  const isPraktikum = kat === 'praktikum';
  const labs = isPraktikum ? await getMasterOptions(db, 'Lab') : null;
  return rows.filter((r) => {
    if (isPraktikum) {
      const resolved = resolveBagian12(r.Bagian, '', r.NamaKegiatan, labs);
      return resolved ? baginaKey(resolved) === filter : false;
    }
    return baginaKey(r.Bagian) === filter;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/read-jadwal.test.js`
Expected: PASS (4 tes).

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add new-code1-cf/src/read/jadwal.js new-code1-cf/test/read-jadwal.test.js
git commit -m "feat(jadwal): computeJadwalList baca jadwal pelaksanaan"
```

---

### Task 3: `src/write/jadwal.js` — save/update/cancel + `nextJadwalId`

**Files:**
- Create: `new-code1-cf/src/write/jadwal.js`
- Modify: `new-code1-cf/src/write/beritaAcara.js:93` (exports `validateBaPesertaStatus`)
- Test: `new-code1-cf/test/write-jadwal.test.js`

**Interfaces:**
- Consumes: `requireBagianSession` (`../session.js`), `nextIdNumber` (`../sequence.js`), `kegiatanKey`, `getBagianBaStatuses` (`../read/common.js`), `validateBaPesertaStatus` (`./beritaAcara.js`).
- Produces: `nextJadwalId(db)`, `saveJadwalPelaksanaan(db, payload, kategori, ctx)`, `updateJadwalPelaksanaan(db, jadwalId, payload, kategori, ctx)`, `cancelJadwalPelaksanaan(db, jadwalId, kategori, ctx)`.

- [ ] **Step 1: Export the shared validator**

Di `new-code1-cf/src/write/beritaAcara.js:93`, ubah:

```js
async function validateBaPesertaStatus(db, peserta) {
```
menjadi:
```js
export async function validateBaPesertaStatus(db, peserta) {
```

- [ ] **Step 2: Write the failing test**

`new-code1-cf/test/write-jadwal.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveJadwalPelaksanaan, updateJadwalPelaksanaan, cancelJadwalPelaksanaan } from '../src/write/jadwal.js';

async function bagianCtx(kategoris) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris: kategoris || ['SGD'] }) };
}
async function seedPengajuan(status = 'ACC') {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD',?1)").bind(status).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')").run();
}
const payload = {
  bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '',
  peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
};

describe('jadwal write', () => {
  it('requires bagian session', async () => {
    await expect(saveJadwalPelaksanaan(env.DB, payload, 'SGD', {})).rejects.toThrow();
  });

  it('menyimpan jadwal dan peserta', async () => {
    await seedPengajuan();
    const res = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', await bagianCtx(['SGD']));
    expect(res.success).toBe(true);
    expect(res.jadwalId).toMatch(/^JDW-\d{4}-0001$/);
    const j = await env.DB.prepare('SELECT * FROM jadwal_pelaksanaan WHERE jadwal_id=?1').bind(res.jadwalId).first();
    expect(j.dosen).toBe('dr. Andi');
    expect(j.kegiatan_key).toBe('sgd|a|sgd 1');
    expect(Number(j.active)).toBe(1);
    const p = await env.DB.prepare('SELECT * FROM jadwal_peserta WHERE jadwal_id=?1').bind(res.jadwalId).all();
    expect(p.results).toHaveLength(1);
  });

  it('menolak peserta non-ACC', async () => {
    await seedPengajuan('Menunggu');
    const res = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', await bagianCtx(['SGD']));
    expect(res.success).toBe(false);
    expect(res.message).toContain('belum berstatus');
  });

  it('mengubah jadwal selama belum ada BA', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const res = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', ctx);
    const up = await updateJadwalPelaksanaan(env.DB, res.jadwalId, { ...payload, jam: '10:30', dosen: 'dr. Budi' }, 'SGD', ctx);
    expect(up.success).toBe(true);
    const j = await env.DB.prepare('SELECT jam, dosen FROM jadwal_pelaksanaan WHERE jadwal_id=?1').bind(res.jadwalId).first();
    expect(j.jam).toBe('10:30');
    expect(j.dosen).toBe('dr. Budi');
  });

  it('membatalkan jadwal (soft cancel)', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const res = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', ctx);
    const cancel = await cancelJadwalPelaksanaan(env.DB, res.jadwalId, 'SGD', ctx);
    expect(cancel.success).toBe(true);
    const j = await env.DB.prepare('SELECT active FROM jadwal_pelaksanaan WHERE jadwal_id=?1').bind(res.jadwalId).first();
    expect(Number(j.active)).toBe(0);
  });

  it('mengunci jadwal setelah BA dibuat', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const res = await saveJadwalPelaksanaan(env.DB, payload, 'SGD', ctx);
    await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,sumber,kegiatan_key,jadwal_id) VALUES ('2026-09-10T09:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-09-20','Bagian','sgd|a|sgd 1',?1)").bind(res.jadwalId).run();
    const up = await updateJadwalPelaksanaan(env.DB, res.jadwalId, payload, 'SGD', ctx);
    expect(up.success).toBe(false);
    const cancel = await cancelJadwalPelaksanaan(env.DB, res.jadwalId, 'SGD', ctx);
    expect(cancel.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/write-jadwal.test.js`
Expected: FAIL — `Cannot find module '../src/write/jadwal.js'`.

- [ ] **Step 4: Implement `src/write/jadwal.js`**

```js
import { requireBagianSession } from '../session.js';
import { nextIdNumber } from '../sequence.js';
import { kegiatanKey, getBagianBaStatuses } from '../read/common.js';
import { validateBaPesertaStatus } from './beritaAcara.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function normalizePeserta(payload) {
  const raw = payload && payload.peserta ? payload.peserta : [];
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const p of raw) {
    const npm = str(p && p.npm);
    const nama = str((p && p.namaLengkap) || (p && p.nama));
    if (npm || nama) {
      out.push({
        idPengajuan: str(p && p.idPengajuan), npm: npm, namaLengkap: nama,
        blok: str(p && p.blok), statusPengajuan: str((p && p.statusPengajuan) || (p && p.status))
      });
    }
  }
  return out;
}

export async function nextJadwalId(db) {
  const year = new Date().getFullYear();
  const prefix = 'JDW-' + year + '-';
  const { results } = await db.prepare('SELECT jadwal_id FROM jadwal_pelaksanaan').all();
  let max = 0;
  for (const r of results || []) {
    const id = str(r.jadwal_id);
    if (id.indexOf(prefix) !== 0) continue;
    const n = parseInt(id.slice(prefix.length), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  const n = await nextIdNumber(db, 'jadwal:' + prefix, max);
  return prefix + String(n).padStart(4, '0');
}

function buildInsertStmts(db, jadwalId, payload, meta) {
  const ts = nowIso();
  const stmts = [
    db.prepare(
      'INSERT INTO jadwal_pelaksanaan (timestamp, jadwal_id, bagian, blok, nama_kegiatan, kegiatan_key, tanggal, jam, dosen, catatan, active, created_by, updated_at) ' +
      'VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,1,?11,?1)'
    ).bind(ts, jadwalId, meta.bagian, str(payload.blok), str(payload.namaKegiatan), meta.kegiatanKey,
      str(payload.tanggal), str(payload.jam), str(payload.dosen), str(payload.catatan), meta.createdBy)
  ];
  for (const p of payload.__peserta) {
    stmts.push(
      db.prepare(
        'INSERT INTO jadwal_peserta (timestamp, jadwal_id, id_pengajuan, npm, nama_lengkap, blok, status_pengajuan) ' +
        'VALUES (?1,?2,?3,?4,?5,?6,?7)'
      ).bind(ts, jadwalId, p.idPengajuan, p.npm, p.namaLengkap, p.blok, p.statusPengajuan)
    );
  }
  return stmts;
}

async function validatePayload(db, peserta, allowedMsg) {
  if (!peserta.length) {
    return { ok: false, message: allowedMsg || 'Simpan dibatalkan: pilih minimal satu peserta.' };
  }
  const blocked = await validateBaPesertaStatus(db, peserta);
  if (blocked.length) {
    const allowed = await getBagianBaStatuses(db);
    return { ok: false, message: 'Simpan dibatalkan: peserta belum berstatus ' + allowed.join(' / ') + ' — ' + blocked.join(', ') + '.' };
  }
  return { ok: true };
}

export async function saveJadwalPelaksanaan(db, payload, kategori, ctx) {
  const p = payload || {};
  await requireBagianSession(db, kategori, p.bagian, ctx.token, ctx.session);
  const bagian = str(p.bagian) || str(kategori);
  const peserta = normalizePeserta(p);
  const check = await validatePayload(db, peserta);
  if (!check.ok) return { success: false, message: check.message };

  const jadwalId = await nextJadwalId(db);
  p.__peserta = peserta;
  await db.batch(buildInsertStmts(db, jadwalId, p, {
    bagian: bagian,
    kegiatanKey: kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan)),
    createdBy: str(ctx.session && ctx.session.nama)
  }));
  return { success: true, jadwalId: jadwalId, message: 'Jadwal pelaksanaan berhasil disimpan.' };
}

async function findActiveJadwal(db, jadwalId) {
  const row = await db.prepare('SELECT * FROM jadwal_pelaksanaan WHERE jadwal_id = ?1').bind(jadwalId).first();
  if (!row || Number(row.active) !== 1) return null;
  return row;
}

async function hasBa(db, jadwalId) {
  return !!(await db.prepare('SELECT ba_id FROM berita_acara WHERE jadwal_id = ?1').bind(jadwalId).first());
}

export async function updateJadwalPelaksanaan(db, jadwalId, payload, kategori, ctx) {
  const p = payload || {};
  const id = str(jadwalId);
  const existing = await findActiveJadwal(db, id);
  if (!existing) return { success: false, message: 'Jadwal pelaksanaan tidak ditemukan.' };
  await requireBagianSession(db, kategori, existing.bagian, ctx.token, ctx.session);
  if (await hasBa(db, id)) return { success: false, message: 'Jadwal terkunci: berita acara sudah dibuat.' };

  const peserta = normalizePeserta(p);
  const check = await validatePayload(db, peserta);
  if (!check.ok) return { success: false, message: check.message };

  const ts = nowIso();
  const bagian = str(p.bagian) || str(existing.bagian) || str(kategori);
  await db.batch([
    db.prepare(
      'UPDATE jadwal_pelaksanaan SET bagian=?1, blok=?2, nama_kegiatan=?3, kegiatan_key=?4, tanggal=?5, jam=?6, dosen=?7, catatan=?8, updated_at=?9 WHERE jadwal_id=?10'
    ).bind(bagian, str(p.blok), str(p.namaKegiatan), kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan)),
      str(p.tanggal), str(p.jam), str(p.dosen), str(p.catatan), ts, id),
    db.prepare('DELETE FROM jadwal_peserta WHERE jadwal_id=?1').bind(id),
    ...peserta.map((pp) => db.prepare(
      'INSERT INTO jadwal_peserta (timestamp, jadwal_id, id_pengajuan, npm, nama_lengkap, blok, status_pengajuan) VALUES (?1,?2,?3,?4,?5,?6,?7)'
    ).bind(ts, id, pp.idPengajuan, pp.npm, pp.namaLengkap, pp.blok, pp.statusPengajuan))
  ]);
  return { success: true, message: 'Jadwal pelaksanaan diperbarui.' };
}

export async function cancelJadwalPelaksanaan(db, jadwalId, kategori, ctx) {
  const id = str(jadwalId);
  const existing = await findActiveJadwal(db, id);
  if (!existing) return { success: false, message: 'Jadwal pelaksanaan tidak ditemukan.' };
  await requireBagianSession(db, kategori, existing.bagian, ctx.token, ctx.session);
  if (await hasBa(db, id)) return { success: false, message: 'Jadwal terkunci: berita acara sudah dibuat.' };
  await db.prepare('UPDATE jadwal_pelaksanaan SET active=0, updated_at=?1 WHERE jadwal_id=?2').bind(nowIso(), id).run();
  return { success: true, message: 'Jadwal pelaksanaan dibatalkan.' };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/write-jadwal.test.js test/write-berita-acara.test.js`
Expected: PASS (keduanya).

- [ ] **Step 6: Commit**

```bash
cd /workspace && git add new-code1-cf/src/write/jadwal.js new-code1-cf/src/write/beritaAcara.js new-code1-cf/test/write-jadwal.test.js
git commit -m "feat(jadwal): simpan, ubah, dan batalkan jadwal pelaksanaan"
```

---

### Task 4: Bootstrap Bagian menyertakan jadwal + tanda `selesai` pada BA

**Files:**
- Modify: `new-code1-cf/src/read/bagian.js`
- Test: `new-code1-cf/test/read-bagian-jadwal.test.js`

**Interfaces:**
- Consumes: `computeJadwalList` dari Task 2.
- Produces: `getBagianBootstrap(...).jadwalList` (array), dan `getBeritaAcaraList(...)`/`getBagianBootstrap(...).baList[i].selesai` (boolean) + `['Jadwal ID']`.

- [ ] **Step 1: Write the failing test**

`new-code1-cf/test/read-bagian-jadwal.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getBagianBootstrap, getBeritaAcaraList } from '../src/read/bagian.js';

async function bagianCtx(kategoris = ['Ujian']) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian Umum', kategori: 'Ujian', subBagian: '', kategoris }) };
}
async function seed() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','Ujian','ACC')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','Ujian','UAS','','2026-09-20','')").run();
  await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-09-10T08:00:00','JDW-2026-0001','Ujian','A','UAS','ujian|a|uas','2026-09-20','09:00','dr. Andi','',1)").run();
  await env.DB.prepare("INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan) VALUES ('2026-09-10T08:00:00','JDW-2026-0001','INHAL-1','2201010001','Aisyah','A','ACC')").run();
}

describe('bagian bootstrap jadwal', () => {
  it('menyertakan jadwalList di bootstrap', async () => {
    await seed();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.ok).toBe(true);
    expect(Array.isArray(boot.jadwalList)).toBe(true);
    expect(boot.jadwalList).toHaveLength(1);
    expect(boot.jadwalList[0].JadwalID).toBe('JDW-2026-0001');
  });

  it('menandai BA selesai bila dosen+tanggal+jam terisi', async () => {
    await seed();
    await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,jumlah_peserta,sumber,kegiatan_key,jadwal_id) VALUES ('2026-09-20T09:00:00','BA-PEL-2026-0001','Ujian','A','UAS','2026-09-20','09:00','dr. Andi','1','Bagian','ujian|a|uas','JDW-2026-0001')").run();
    const list = await getBeritaAcaraList(env.DB, 'Ujian', 'Ujian', await bagianCtx());
    expect(list).toHaveLength(1);
    expect(list[0].selesai).toBe(true);
    expect(list[0]['Jadwal ID']).toBe('JDW-2026-0001');

    await env.DB.prepare("UPDATE berita_acara SET jam=''").run();
    const list2 = await getBeritaAcaraList(env.DB, 'Ujian', 'Ujian', await bagianCtx());
    expect(list2[0].selesai).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/read-bagian-jadwal.test.js`
Expected: FAIL — `boot.jadwalList` undefined / `list[0].selesai` undefined.

- [ ] **Step 3: Modify `src/read/bagian.js`**

Tambahkan import di baris atas:

```js
import { computeJadwalList } from './jadwal.js';
```

Di `computeBaList`, di dalam `rows.map((c) => { const copy = ...; copy.peserta = ...; return copy; })`, tambahkan sebelum `return copy;`:

```js
    copy.selesai = !!(String(c.Dosen || '').trim() && String(c['Tanggal Pelaksanaan'] || '').trim() && String(c.Jam || '').trim());
```

Di `getBagianBootstrap`, pada objek `out` awal tambahkan `jadwalList: []` (setelah `rows: [], baList: []`), dan setelah baris `out.baList = await computeBaList(...)` tambahkan:

```js
    out.jadwalList = await computeJadwalList(db, subBagian || out.kategori, out.kategori);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/read-bagian-jadwal.test.js test/read-bagian.test.js`
Expected: PASS (keduanya).

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add new-code1-cf/src/read/bagian.js new-code1-cf/test/read-bagian-jadwal.test.js
git commit -m "feat(jadwal): bootstrap bagian memuat jadwal dan status selesai BA"
```

---

### Task 5: BA merujuk jadwal + `lengkapiBeritaAcaraBagian` + registrasi RPC

**Files:**
- Modify: `new-code1-cf/src/write/beritaAcara.js`
- Modify: `new-code1-cf/src/rpc.js`
- Test: `new-code1-cf/test/write-berita-acara-jadwal.test.js`, `new-code1-cf/test/rpc-jadwal.test.js`

**Interfaces:**
- Consumes: `saveJadwalPelaksanaan` (Task 3) untuk menyiapkan jadwal di test; `dispatchRpc` (`../rpc.js`).
- Produces: `saveBeritaAcaraBagian` menerima `payload.jadwalId`; `lengkapiBeritaAcaraBagian(db, baId, payload, kategori, ctx)`; handler RPC `saveJadwalPelaksanaan`, `updateJadwalPelaksanaan`, `cancelJadwalPelaksanaan`, `lengkapiBeritaAcaraBagian`.

- [ ] **Step 1: Write the failing tests**

`new-code1-cf/test/write-berita-acara-jadwal.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveJadwalPelaksanaan } from '../src/write/jadwal.js';
import { saveBeritaAcaraBagian, lengkapiBeritaAcaraBagian } from '../src/write/beritaAcara.js';

async function bagianCtx(kategoris = ['SGD']) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris }), env: {} };
}
async function seedPengajuan() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')").run();
}
const peserta = [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }];

describe('BA merujuk jadwal', () => {
  it('menyimpan jadwal_id pada BA', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const j = await saveJadwalPelaksanaan(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '', peserta }, 'SGD', ctx);
    const res = await saveBeritaAcaraBagian(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '', jadwalId: j.jadwalId, peserta }, 'SGD', ctx);
    expect(res.success).toBe(true);
    const ba = await env.DB.prepare('SELECT jadwal_id FROM berita_acara WHERE ba_id=?1').bind(res.baId).first();
    expect(ba.jadwal_id).toBe(j.jadwalId);
  });

  it('menolak BA kedua untuk jadwal yang sama', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const j = await saveJadwalPelaksanaan(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '', peserta }, 'SGD', ctx);
    await saveBeritaAcaraBagian(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', jadwalId: j.jadwalId, catatan: '', peserta }, 'SGD', ctx);
    const dup = await saveBeritaAcaraBagian(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', jadwalId: j.jadwalId, catatan: '', peserta }, 'SGD', ctx);
    expect(dup.success).toBe(false);
    expect(dup.message).toContain('sudah ada');
  });

  it('menolak jadwal yang dibatalkan', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const j = await saveJadwalPelaksanaan(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '', peserta }, 'SGD', ctx);
    await env.DB.prepare('UPDATE jadwal_pelaksanaan SET active=0').run();
    const res = await saveBeritaAcaraBagian(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', jadwalId: j.jadwalId, catatan: '', peserta }, 'SGD', ctx);
    expect(res.success).toBe(false);
  });

  it('lengkapi mengisi dosen/jam dan menyinkron pengajuan', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const draft = await saveBeritaAcaraBagian(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', catatan: '', peserta }, 'SGD', ctx);
    const filled = await lengkapiBeritaAcaraBagian(env.DB, draft.baId, { jam: '13:30', dosen: 'dr. Budi' }, 'SGD', ctx);
    expect(filled.success).toBe(true);
    const ba = await env.DB.prepare('SELECT jam, dosen, tanggal_pelaksanaan FROM berita_acara WHERE ba_id=?1').bind(draft.baId).first();
    expect(ba.jam).toBe('13:30');
    expect(ba.dosen).toBe('dr. Budi');
    const p = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan=?1').bind('INHAL-1').first();
    expect(p.dosen).toBe('dr. Budi');
    expect(p.tanggal_pelaksanaan).toBe('2026-09-20T13:30');
  });
});
```

`new-code1-cf/test/rpc-jadwal.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { dispatchRpc } from '../src/rpc.js';

async function bagianToken() {
  return await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris: ['SGD'] });
}
async function seedPengajuan() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')").run();
}

describe('rpc jadwal', () => {
  it('menyimpan jadwal lewat dispatchRpc', async () => {
    await seedPengajuan();
    const token = await bagianToken();
    const payload = {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
    };
    const res = await dispatchRpc(env.DB, 'saveJadwalPelaksanaan', [payload, 'SGD', token], 'local', env);
    expect(res.success).toBe(true);
    expect(res.jadwalId).toMatch(/^JDW-/);
    const bad = await dispatchRpc(env.DB, 'saveJadwalPelaksanaan', [payload, 'SGD'], 'local', env);
    expect(bad.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd new-code1-cf && npx vitest run test/write-berita-acara-jadwal.test.js test/rpc-jadwal.test.js`
Expected: FAIL — `lengkapiBeritaAcaraBagian` tidak ada / `dispatchRpc` balikan "belum tersedia".

- [ ] **Step 3: Modify `src/write/beritaAcara.js`**

(a) Di `buildPersistBaStmts`, setelah pembuatan `cols` dan sebelum `if (meta.withDosen) cols.dosen = ...`, tambahkan:

```js
  if (meta.withJadwal) cols.jadwal_id = str(payload.jadwalId);
```

(b) Di `saveBeritaAcaraBagian`, setelah blok `blocked` dan sebelum `const baId = await nextBaId(...)`, tambahkan:

```js
  const jadwalId = str(p.jadwalId);
  if (jadwalId) {
    const jd = await db.prepare('SELECT jadwal_id, active FROM jadwal_pelaksanaan WHERE jadwal_id = ?1').bind(jadwalId).first();
    if (!jd || Number(jd.active) !== 1) {
      return { success: false, message: 'Jadwal pelaksanaan tidak ditemukan atau sudah dibatalkan.' };
    }
    const dup = await db.prepare('SELECT ba_id FROM berita_acara WHERE jadwal_id = ?1').bind(jadwalId).first();
    if (dup) return { success: false, message: 'Berita acara untuk jadwal ini sudah ada.' };
  }
```

Lalu pada pemanggilan `buildPersistBaStmts(...)` di fungsi itu, ubah objek meta menjadi menyertakan `withJadwal: true`:

```js
      kegiatanKey: kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan)), withDosen: true, withLabel: true, allowMultiple: true, withJadwal: true
```

(c) Tambahkan fungsi baru di akhir file:

```js
export async function lengkapiBeritaAcaraBagian(db, baId, payload, kategori, ctx) {
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };
  const existing = await db.prepare('SELECT * FROM berita_acara WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };
  await requireBagianSession(db, kategori, existing.bagian, ctx.token, ctx.session);

  const p = payload || {};
  const tanggal = p.tanggal !== undefined ? str(p.tanggal) : str(existing.tanggal_pelaksanaan);
  const jam = p.jam !== undefined ? str(p.jam) : str(existing.jam);
  const dosen = p.dosen !== undefined ? str(p.dosen) : str(existing.dosen);
  const catatan = p.catatan !== undefined ? str(p.catatan) : str(existing.catatan);
  const label = p.label !== undefined ? str(p.label) : str(existing.label);

  const peserta = (await db.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1').bind(id).all()).results || [];
  await db.batch([
    db.prepare('UPDATE berita_acara SET tanggal_pelaksanaan=?1, jam=?2, dosen=?3, catatan=?4, label=?5 WHERE ba_id=?6')
      .bind(tanggal, jam, dosen, catatan, label, id),
    ...buildSyncStmts(db, peserta.map((r) => ({ idPengajuan: r.id_pengajuan })), dosen, tanggal, jam)
  ]);
  return { success: true, message: 'Berita acara dilengkapi.' };
}
```

- [ ] **Step 4: Register RPC handlers in `src/rpc.js`**

Ubah import dari `./write/beritaAcara.js` menjadi menyertakan `lengkapiBeritaAcaraBagian`:

```js
import {
  saveBeritaAcaraAdmin, deleteBeritaAcaraAdmin, saveBeritaAcaraBagian, deleteBeritaAcaraBagian,
  updateBeritaAcaraBagian, updateBeritaAcaraAdmin, lengkapiBeritaAcaraBagian
} from './write/beritaAcara.js';
import { saveJadwalPelaksanaan, updateJadwalPelaksanaan, cancelJadwalPelaksanaan } from './write/jadwal.js';
```

Di objek `HANDLERS`, setelah baris `uploadBeritaAcaraBagian: ...`, tambahkan:

```js
  saveJadwalPelaksanaan: (db, args, ctx) => saveJadwalPelaksanaan(db, args[0], args[1], ctx),
  updateJadwalPelaksanaan: (db, args, ctx) => updateJadwalPelaksanaan(db, args[0], args[1], args[2], ctx),
  cancelJadwalPelaksanaan: (db, args, ctx) => cancelJadwalPelaksanaan(db, args[0], args[1], ctx),
  lengkapiBeritaAcaraBagian: (db, args, ctx) => lengkapiBeritaAcaraBagian(db, args[0], args[1], args[2], ctx),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd new-code1-cf && npx vitest run test/write-berita-acara-jadwal.test.js test/rpc-jadwal.test.js test/write-berita-acara.test.js`
Expected: PASS (ketiganya).

- [ ] **Step 6: Commit**

```bash
cd /workspace && git add new-code1-cf/src/write/beritaAcara.js new-code1-cf/src/rpc.js new-code1-cf/test/write-berita-acara-jadwal.test.js new-code1-cf/test/rpc-jadwal.test.js
git commit -m "feat(jadwal): BA merujuk jadwal, lengkapi draft, dan handler RPC"
```

---

### Task 6: Portal menyertakan jadwal per pengajuan

**Files:**
- Modify: `new-code1-cf/src/portal.js`
- Test: `new-code1-cf/test/portal-jadwal.test.js`

**Interfaces:**
- Produces: setiap item `history[i].jadwal` = `{ Tanggal, Jam, Dosen, JadwalID }` atau `null`.

- [ ] **Step 1: Write the failing test**

`new-code1-cf/test/portal-jadwal.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { getStudentPortalData } from '../src/portal.js';

async function seed() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')").run();
  await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-09-10T08:00:00','JDW-2026-0001','SGD','A','SGD 1','sgd|a|sgd 1','2026-09-20','09:00','dr. Andi','',1)").run();
  await env.DB.prepare("INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan) VALUES ('2026-09-10T08:00:00','JDW-2026-0001','INHAL-1','2201010001','Aisyah','A','ACC')").run();
}

describe('portal jadwal', () => {
  it('melampirkan jadwal pada pengajuan terkait', async () => {
    await seed();
    const data = await getStudentPortalData(env.DB, '2201010001');
    expect(data.history).toHaveLength(1);
    expect(data.history[0].jadwal).toBeTruthy();
    expect(data.history[0].jadwal.Dosen).toBe('dr. Andi');
    expect(data.history[0].jadwal.Jam).toBe('09:00');
  });

  it('null bila tidak ada jadwal', async () => {
    await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-2','2201010002','Budi','B','SGD','ACC')").run();
    const data = await getStudentPortalData(env.DB, '2201010002');
    expect(data.history[0].jadwal).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/portal-jadwal.test.js`
Expected: FAIL — `history[0].jadwal` undefined.

- [ ] **Step 3: Modify `src/portal.js`**

Setelah baris pengambilan `details` (sekitar baris 96), tambahkan:

```js
  const { results: jadwalPeserta } = await db.prepare('SELECT id_pengajuan, jadwal_id FROM jadwal_peserta').all();
  const { results: jadwalRows } = await db.prepare('SELECT jadwal_id, tanggal, jam, dosen, active FROM jadwal_pelaksanaan').all();
  const jadwalById = {};
  for (const j of jadwalRows || []) {
    if (Number(j.active) !== 1) continue;
    jadwalById[str(j.jadwal_id)] = {
      JadwalID: str(j.jadwal_id), Tanggal: str(j.tanggal), Jam: str(j.jam), Dosen: str(j.dosen)
    };
  }
  const jadwalByPengajuan = {};
  for (const jp of jadwalPeserta || []) {
    const j = jadwalById[str(jp.jadwal_id)];
    if (j) jadwalByPengajuan[str(jp.id_pengajuan)] = j;
  }
```

Di dalam `history.push({ ... })`, tambahkan properti:

```js
      jadwal: jadwalByPengajuan[id] || null,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/portal-jadwal.test.js test/portal.test.js`
Expected: PASS (keduanya).

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add new-code1-cf/src/portal.js new-code1-cf/test/portal-jadwal.test.js
git commit -m "feat(jadwal): portal melampirkan jadwal pelaksanaan per pengajuan"
```

---

### Task 7: `bagian.html` — tab bar + tab Jadwal + method jadwal

**Files:**
- Modify: `new-code1-cf/public/bagian.html`
- Test: `new-code1-cf/test/bagian-jadwal-template.test.js`

**Interfaces:**
- Consumes: RPC `saveJadwalPelaksanaan`, `updateJadwalPelaksanaan`, `cancelJadwalPelaksanaan`; bootstrap `res.jadwalList`.
- Produces: state `activeTab`, `jadwalList`, `jadwal`; computed `jadwalKegiatanGroups`; method `openJadwalForm`, `closeJadwalForm`, `selectJadwalKegiatan`, `toggleJadwalPeserta`, `toggleAllJadwalPeserta`, `saveJadwal`, `editJadwal`, `cancelJadwal`, `buatBaDariJadwal`, `setTab`.

- [ ] **Step 1: Write the failing test**

`new-code1-cf/test/bagian-jadwal-template.test.js`:

```js
import { env } from 'cloudflare:test';
import { compile } from '@vue/compiler-dom';
import { describe, it, expect } from 'vitest';

function extractAppTemplate(html) {
  const start = html.indexOf('<div id="app"');
  const scriptStart = html.indexOf('<script src="/gs-shim.js"', start);
  const slice = html.slice(start, scriptStart === -1 ? html.length : scriptStart);
  const re = /<div\b|<\/div>/g;
  let depth = 0, end = -1, m;
  while ((m = re.exec(slice))) {
    if (m[0] === '</div>') { depth -= 1; if (depth === 0) { end = re.lastIndex; break; } }
    else depth += 1;
  }
  return slice.slice(0, end);
}
function installDocumentStub() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement: () => ({ _html: '', set innerHTML(v) { this._html = String(v); }, get innerHTML() { return this._html; }, get textContent() { return this._html; }, get children() { const match = this._html.match(/^<div foo="([\s\S]*)">$/); const value = match ? match[1] : this._html; return [{ getAttribute: () => value }]; } })
  };
}
async function loadBagianHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/bagian.html'));
  return res.text();
}

describe('bagian template jadwal', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadBagianHtml();
    const errors = [];
    compile(extractAppTemplate(html), { onError: (e) => errors.push(e.message), onWarn: (w) => errors.push('warn: ' + w.message) });
    expect(errors).toEqual([]);
  });

  it('memiliki tab Jadwal / Berita Acara / Riwayat', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('activeTab');
    expect(html).toContain('setTab(\'jadwal\')');
    expect(html).toContain('setTab(\'ba\')');
    expect(html).toContain('setTab(\'riwayat\')');
  });

  it('memiliki alur jadwal', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Buat Jadwal');
    expect(html).toContain('saveJadwalPelaksanaan');
    expect(html).toContain('cancelJadwalPelaksanaan');
    expect(html).toContain('jadwal.dosen');
    expect(html).toContain('jadwal.jam');
  });

  it('tetap mempertahankan fitur produksi Daftar Peserta', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Daftar Peserta');
    expect(html).toContain('filteredRows');
    expect(html).toContain('openBaPicker');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/bagian-jadwal-template.test.js`
Expected: FAIL — `activeTab` belum ada.

- [ ] **Step 3: Add tab bar and restructure wrapper in `bagian.html`**

Ganti baris pembuka grid (baris 162)

```html
                    <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
```

dengan pembungkus vertikal:

```html
                    <div class="space-y-5">
```

Setelah kartu **Daftar Peserta** ditutup (tepat sebelum `<!-- ===== UPLOAD BERITA ACARA ===== -->`), sisipkan tab bar:

```html
                    <!-- ===== TAB BAR ===== -->
                    <div class="flex gap-1 rounded-2xl bg-white p-1 shadow-soft ring-1 ring-slate-100" role="tablist">
                        <button role="tab" :aria-selected="activeTab==='jadwal'" class="flex-1 rounded-xl px-3 py-2 text-sm font-bold transition" :class="activeTab==='jadwal' ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'" @click="setTab('jadwal')"><i class="bi bi-calendar-plus mr-1"></i>Jadwal</button>
                        <button role="tab" :aria-selected="activeTab==='ba'" class="flex-1 rounded-xl px-3 py-2 text-sm font-bold transition" :class="activeTab==='ba' ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'" @click="setTab('ba')"><i class="bi bi-file-earmark-text mr-1"></i>Berita Acara</button>
                        <button role="tab" :aria-selected="activeTab==='riwayat'" class="flex-1 rounded-xl px-3 py-2 text-sm font-bold transition" :class="activeTab==='riwayat' ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'" @click="setTab('riwayat')"><i class="bi bi-clock-history mr-1"></i>Riwayat</button>
                    </div>
```

Bungkus kartu Upload BA dan Daftar BA dengan `v-if="activeTab==='ba'"`: pada pembuka kartu Upload BA (baris 230) ubah

```html
                    <div class="ba-sticky overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
```
menjadi
```html
                    <div v-if="activeTab==='ba'" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
```

dan pada kartu Daftar Berita Acara (baris 372) ubah
```html
                    <div class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
```
menjadi
```html
                    <div v-if="activeTab==='riwayat'" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
```

- [ ] **Step 4: Insert the Jadwal tab markup**

Sisipkan tepat setelah tab bar (sebelum kartu Upload BA):

```html
                    <!-- ===== TAB: JADWAL ===== -->
                    <div v-if="activeTab==='jadwal'" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                        <div class="flex items-center gap-3 border-b border-slate-100 p-5">
                            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><i class="bi bi-calendar-plus"></i></div>
                            <div class="flex-1">
                                <h2 class="text-base font-bold text-slate-900">Jadwal Pelaksanaan</h2>
                                <p class="text-xs text-slate-400">{{ jadwalList.length }} jadwal aktif</p>
                            </div>
                        </div>
                        <div class="p-4">
                            <button v-if="!jadwal.open" class="btn-primary w-full" @click="openJadwalForm"><i class="bi bi-plus-circle"></i> Buat Jadwal</button>
                            <div v-else class="space-y-4">
                                <div v-if="!jadwal.kegiatanKey">
                                    <div class="section-title"><i class="bi bi-calendar-check"></i> Pilih Kegiatan (ACC)</div>
                                    <div v-if="!jadwalKegiatanGroups.length" class="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Belum ada kegiatan ACC untuk dijadwalkan.</div>
                                    <div v-else class="space-y-2">
                                        <button v-for="g in jadwalKegiatanGroups" :key="g.key" class="group flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[.99]" @click="selectJadwalKegiatan(g.key)">
                                            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><i class="bi bi-journal-text"></i></div>
                                            <div class="min-w-0 flex-1">
                                                <div class="text-sm font-bold text-slate-900">{{ g.label }}</div>
                                                <div class="mt-0.5 flex items-center gap-3 text-[11px] text-slate-400"><span class="flex items-center gap-1"><i class="bi bi-calendar3"></i>{{ formatTanggal(g.tanggal) }}</span></div>
                                            </div>
                                            <span class="chip shrink-0 bg-brand-50 text-brand-700">{{ g.peserta.length }} peserta</span>
                                        </button>
                                    </div>
                                    <button class="btn-soft mt-3 w-full" @click="closeJadwalForm"><i class="bi bi-x-lg"></i> Batal</button>
                                </div>
                                <div v-else>
                                    <div class="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                                        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm"><i class="bi bi-journal-check"></i></div>
                                        <div class="min-w-0 flex-1">
                                            <div class="text-sm font-bold text-slate-900">{{ jadwalSelectedGroup ? jadwalSelectedGroup.label : '' }}</div>
                                            <div class="text-[11px] text-slate-400">{{ jadwalSelectedGroup ? jadwalSelectedGroup.peserta.length : 0 }} peserta</div>
                                        </div>
                                        <button class="text-xs font-semibold text-brand-600" @click="jadwal.kegiatanKey=null">Ubah</button>
                                    </div>
                                    <div class="mt-3">
                                        <div class="mb-2 flex items-center justify-between">
                                            <span class="text-xs font-bold uppercase tracking-wide text-slate-400">Pilih Peserta</span>
                                            <button class="text-xs font-semibold text-brand-600" @click="toggleAllJadwalPeserta">{{ jadwalAllSelected ? 'Hapus Semua' : 'Pilih Semua' }}</button>
                                        </div>
                                        <div class="space-y-2">
                                            <label v-for="p in (jadwalSelectedGroup ? jadwalSelectedGroup.peserta : [])" :key="p.idPengajuan" class="flex items-center gap-3 rounded-xl border p-3 transition" :class="jadwal.selected[p.idPengajuan] ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white'">
                                                <input type="checkbox" class="h-4 w-4 accent-indigo-600" :checked="!!jadwal.selected[p.idPengajuan]" @change="toggleJadwalPeserta(p.idPengajuan)">
                                                <div class="min-w-0 flex-1">
                                                    <div class="truncate text-sm font-semibold text-slate-800">{{ p.namaLengkap }}</div>
                                                    <div class="font-mono text-[11px] text-slate-400">NPM {{ p.npm }}</div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                    <div class="mt-4 space-y-4">
                                        <div><label class="label">Tanggal Pelaksanaan</label><input v-model="jadwal.tanggal" type="date" class="input"></div>
                                        <div><label class="label">Jam</label><input v-model="jadwal.jam" type="time" class="input"></div>
                                        <div><label class="label">Dosen</label><input v-model="jadwal.dosen" class="input" placeholder="Nama dosen pengampu"></div>
                                        <div><label class="label">Catatan (Opsional)</label><input v-model="jadwal.catatan" class="input" placeholder="opsional"></div>
                                    </div>
                                    <div class="mt-4 flex gap-3">
                                        <button class="btn-soft flex-1" @click="closeJadwalForm">Batal</button>
                                        <button class="btn-primary flex-1" :disabled="loading" @click="saveJadwal"><i class="bi bi-save"></i> {{ jadwal.editingId ? 'Simpan Perubahan' : 'Simpan Jadwal' }}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-if="jadwalList.length" class="divide-y divide-slate-50 border-t border-slate-100">
                            <div v-for="j in jadwalList" :key="j.JadwalID" class="p-4">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <div class="font-mono text-[11px] text-slate-400">{{ j.JadwalID }}</div>
                                        <div class="mt-0.5 text-sm font-bold text-slate-900">{{ j.Blok }} · {{ j.NamaKegiatan }}</div>
                                        <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                            <span class="flex items-center gap-1"><i class="bi bi-calendar3"></i>{{ formatTanggal(j.Tanggal) }}</span>
                                            <span v-if="j.Jam" class="flex items-center gap-1"><i class="bi bi-clock"></i>{{ j.Jam }}</span>
                                            <span v-if="j.Dosen" class="flex items-center gap-1"><i class="bi bi-person-badge"></i>{{ j.Dosen }}</span>
                                        </div>
                                    </div>
                                    <span class="chip shrink-0 bg-brand-50 text-brand-700">{{ j.peserta.length }} peserta</span>
                                </div>
                                <div v-if="j.Catatan" class="mt-2 text-xs text-slate-500">{{ j.Catatan }}</div>
                                <div class="mt-3 flex flex-wrap gap-2">
                                    <button v-if="!j.punyaBa" class="btn-primary !py-2 text-xs" @click="buatBaDariJadwal(j.JadwalID)"><i class="bi bi-file-earmark-plus"></i> Buat BA</button>
                                    <span v-else class="chip bg-emerald-50 text-emerald-700">BA {{ j.baId }}</span>
                                    <button class="btn-soft !py-2 text-xs" @click="editJadwal(j.JadwalID)"><i class="bi bi-pencil"></i> Edit</button>
                                    <button class="btn-soft !py-2 text-xs text-rose-600" @click="cancelJadwal(j.JadwalID)"><i class="bi bi-x-circle"></i> Batalkan</button>
                                </div>
                            </div>
                        </div>
                    </div>
```

- [ ] **Step 5: Add state, computed, and methods**

Di `data()`, setelah `baList: [],` tambahkan:

```js
                    jadwalList: [],
                    activeTab: 'jadwal',
                    jadwal: { open: false, editingId: null, kegiatanKey: null, tanggal: '', jam: '', dosen: '', catatan: '', selected: {} },
```

Di `computed`, setelah `filteredBaList()`, tambahkan:

```js
                jadwalKegiatanGroups() {
                    const map = {};
                    const statuses = this.baConfig.statuses || ['ACC'];
                    this.rows.forEach(function(r) {
                        const key = [r.jenis, r.pilihan, r.detail, r.tanggal, r.blok].join('|');
                        if (!map[key]) {
                            map[key] = {
                                key: key, jenis: r.jenis, pilihan: r.pilihan, detail: r.detail, tanggal: r.tanggal, blok: r.blok,
                                label: 'Blok ' + r.blok + ' · ' + r.pilihan + (r.detail ? ' - ' + r.detail : ''),
                                peserta: []
                            };
                        }
                        if (statuses.indexOf(r.status) !== -1) {
                            map[key].peserta.push({ idPengajuan: r.idPengajuan, npm: r.npm, namaLengkap: r.namaLengkap, blok: r.blok, statusPengajuan: r.status });
                        }
                    });
                    return Object.values(map).filter(function(g) { return g.peserta.length > 0; });
                },
                jadwalSelectedGroup() {
                    if (!this.jadwal.kegiatanKey) return null;
                    return this.jadwalKegiatanGroups.find(function(g) { return g.key === this.jadwal.kegiatanKey; }.bind(this)) || null;
                },
                jadwalAllSelected() {
                    if (!this.jadwalSelectedGroup) return false;
                    const list = this.jadwalSelectedGroup.peserta;
                    return list.length > 0 && list.every(function(p) { return !!this.jadwal.selected[p.idPengajuan]; }.bind(this));
                },
                riwayatBaList() {
                    return this.baList.filter(function(r) { return r.selesai; });
                },
                draftBaList() {
                    return this.baList.filter(function(r) { return !r.selesai; });
                },
                jadwalSiapBaList() {
                    return this.jadwalList.filter(function(j) { return !j.punyaBa; });
                }
```

Di `methods`, setelah `loadBaList()`, tambahkan:

```js
                setTab(t) { this.activeTab = t; },
                openJadwalForm() {
                    this.jadwal = { open: true, editingId: null, kegiatanKey: null, tanggal: '', jam: '', dosen: '', catatan: '', selected: {} };
                    window.scrollTo(0, 0);
                },
                closeJadwalForm() {
                    this.jadwal = { open: false, editingId: null, kegiatanKey: null, tanggal: '', jam: '', dosen: '', catatan: '', selected: {} };
                },
                selectJadwalKegiatan(key) {
                    const g = this.jadwalKegiatanGroups.find(function(x) { return x.key === key; });
                    if (!g) return;
                    this.jadwal.kegiatanKey = key;
                    this.jadwal.selected = {};
                    this.jadwal.tanggal = this.dateOnly(g.tanggal);
                },
                toggleJadwalPeserta(idPengajuan) {
                    this.jadwal.selected[idPengajuan] = !this.jadwal.selected[idPengajuan];
                },
                toggleAllJadwalPeserta() {
                    if (!this.jadwalSelectedGroup) return;
                    const target = !this.jadwalAllSelected;
                    this.jadwalSelectedGroup.peserta.forEach(function(p) { this.jadwal.selected[p.idPengajuan] = target; }.bind(this));
                },
                jadwalSelectedList() {
                    if (!this.jadwalSelectedGroup) return [];
                    return this.jadwalSelectedGroup.peserta.filter(function(p) { return !!this.jadwal.selected[p.idPengajuan]; }.bind(this));
                },
                async saveJadwal() {
                    if (!this.jadwalSelectedGroup) { this.showToast('Pilih kegiatan terlebih dahulu.', 'error'); return; }
                    const list = this.jadwalSelectedList();
                    if (!list.length) { this.showToast('Pilih minimal satu peserta.', 'error'); return; }
                    if (!this.jadwal.tanggal) { this.showToast('Isi tanggal pelaksanaan terlebih dahulu.', 'error'); return; }
                    this.loading = true;
                    try {
                        const payload = {
                            bagian: this.subBagian || this.kategori,
                            blok: this.jadwalSelectedGroup.blok,
                            namaKegiatan: this.jadwalSelectedGroup.pilihan + (this.jadwalSelectedGroup.detail ? ' - ' + this.jadwalSelectedGroup.detail : ''),
                            tanggal: this.jadwal.tanggal, jam: this.jadwal.jam, dosen: this.jadwal.dosen, catatan: this.jadwal.catatan.trim(),
                            peserta: list
                        };
                        const res = this.jadwal.editingId
                            ? await this.run('updateJadwalPelaksanaan', this.jadwal.editingId, payload, this.kategori)
                            : await this.run('saveJadwalPelaksanaan', payload, this.kategori);
                        this.showToast(res.message, res.success ? 'success' : 'error');
                        if (res.success) { this.closeJadwalForm(); await this.loadData(); }
                    } catch (e) {
                        this.showToast('Gagal: ' + e, 'error');
                    } finally {
                        this.loading = false;
                    }
                },
                editJadwal(id) {
                    const j = this.jadwalList.find(function(x) { return x.JadwalID === id; });
                    if (!j) return;
                    const key = [j.NamaKegiatan].length ? null : null;
                    const g = this.jadwalKegiatanGroups.find(function(x) { return x.blok === j.Blok && (x.pilihan + (x.detail ? ' - ' + x.detail : '')) === j.NamaKegiatan; }) || null;
                    const selected = {};
                    (j.peserta || []).forEach(function(p) { selected[p.idPengajuan] = true; });
                    this.jadwal = {
                        open: true, editingId: j.JadwalID, kegiatanKey: g ? g.key : (key || '__edit__'),
                        tanggal: this.dateOnly(j.Tanggal), jam: j.Jam, dosen: j.Dosen, catatan: j.Catatan, selected: selected
                    };
                    this.activeTab = 'jadwal';
                },
                async cancelJadwal(id) {
                    if (!window.confirm('Batalkan jadwal ini?')) return;
                    this.loading = true;
                    try {
                        const res = await this.run('cancelJadwalPelaksanaan', id, this.kategori);
                        this.showToast(res.message, res.success ? 'success' : 'error');
                        if (res.success) await this.loadData();
                    } catch (e) {
                        this.showToast('Gagal: ' + e, 'error');
                    } finally {
                        this.loading = false;
                    }
                },
                buatBaDariJadwal(id) {
                    const j = this.jadwalList.find(function(x) { return x.JadwalID === id; });
                    if (!j) return;
                    this.openBaFromJadwal(j);
                },
```

Catatan implementasi: `editJadwal` di atas memakai `jadwalKegiatanGroups` untuk menemukan grup; bila grup tidak ada (peserta sudah baMember pada BA lain), `this.jadwal.kegiatanKey` diberi `'__edit__'` dan `jadwalSelectedGroup` bernilai null sehingga daftar peserta tampil kosong. Untuk kerangka Task 7 ini, cukup: tampilkan jadwal dan form; penyempurnaan pemilihan peserta edit dilakukan di Task 8 melalui `openBaFromJadwal`/penyesuaian. Ganti baris `const key = ...` yang tidak terpakai dengan menghapusnya (hapus dua baris `const key = ...;`).

- [ ] **Step 6: Wire bootstrap cache**

Di `applyBootstrap`, tambahkan setelah `this.baList = res.baList || [];`:

```js
                    this.jadwalList = res.jadwalList || [];
```

Di `writeCache`, tambahkan `jadwalList: this.jadwalList,` pada objek. Di `readCache`, tidak perlu diubah. Di `login()` dan `mounted()` pada blok `if (cached) { ... }`, tambahkan `this.jadwalList = cached.jadwalList || [];`. Di `logout()` tambahkan `this.jadwalList = [];` dan reset `this.activeTab = 'jadwal';`.

- [ ] **Step 7: Add `openBaFromJadwal` placeholder used by Task 8**

Di `methods`, setelah `buatBaDariJadwal`, tambahkan (implementasi penuh di Task 8):

```js
                openBaFromJadwal(j) {
                    this.ba = Object.assign({}, this.ba, {
                        open: true, mode: 'jadwal', jadwalId: j.JadwalID,
                        jadwalInfo: { label: 'Blok ' + j.Blok + ' · ' + j.NamaKegiatan, blok: j.Blok, namaKegiatan: j.NamaKegiatan, tanggal: this.dateOnly(j.Tanggal), jam: j.Jam, dosen: j.Dosen },
                        jadwalPeserta: (j.peserta || []).map(function(p) { return { idPengajuan: p.idPengajuan, npm: p.npm, namaLengkap: p.namaLengkap, blok: p.blok, statusPengajuan: p.statusPengajuan }; }),
                        kegiatanKey: null, selected: {}, tanggal: this.dateOnly(j.Tanggal), dosen: j.Dosen, jam: j.Jam
                    });
                    (j.peserta || []).forEach(function(p) { this.ba.selected[p.idPengajuan] = true; }.bind(this));
                    this.activeTab = 'ba';
                    window.scrollTo(0, 0);
                },
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/bagian-jadwal-template.test.js test/bagian-template.test.js`
Expected: PASS (keduanya). Jika `bagian-template.test.js` gagal karena class grid lama, ubah asersi `kartu tersusun grid 1 kolom di HP dan 2 kolom di PC` menjadi memeriksa `class="space-y-5"`.

- [ ] **Step 9: Commit**

```bash
cd /workspace && git add new-code1-cf/public/bagian.html new-code1-cf/test/bagian-jadwal-template.test.js new-code1-cf/test/bagian-template.test.js
git commit -m "feat(bagian): tab Jadwal dengan form dan daftar jadwal pelaksanaan"
```

---

### Task 8: `bagian.html` — tab Berita Acara (jadwal mode + draft) & Riwayat

**Files:**
- Modify: `new-code1-cf/public/bagian.html`
- Test: `new-code1-cf/test/bagian-jadwal-template.test.js` (tambahan kasus)

**Interfaces:**
- Consumes: `lengkapiBeritaAcaraBagian`, `openBaFromJadwal` (Task 7), `draftBaList`, `riwayatBaList`, `jadwalSiapBaList` (Task 7).
- Produces: `ba.mode`, `ba.jadwalId`, `ba.jadwalInfo`, `ba.jadwalPeserta`, `ba.dosen`, `ba.jam`; method `lengkapiDraft`, `saveLengkapi`.

- [ ] **Step 1: Extend the failing test**

Tambahkan ke `test/bagian-jadwal-template.test.js` dalam `describe`:

```js
  it('memiliki mode BA dari jadwal, draft, dan riwayat', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('ba.jadwalId');
    expect(html).toContain('lengkapiBeritaAcaraBagian');
    expect(html).toContain('draftBaList');
    expect(html).toContain('riwayatBaList');
    expect(html).toContain('ba.dosen');
    expect(html).toContain('ba.jam');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/bagian-jadwal-template.test.js`
Expected: FAIL — `ba.jadwalId` belum ada.

- [ ] **Step 3: Extend `ba` state**

Di `data()`, pada objek `ba: { ... }`, tambahkan properti `mode: 'manual', jadwalId: '', jadwalInfo: null, jadwalPeserta: [], dosen: '', jam: '', lengkapi: null`. Contoh bentuk akhir:

```js
                    ba: { open: false, mode: 'manual', kegiatanKey: null, jadwalId: '', jadwalInfo: null, jadwalPeserta: [], tanggal: '', jam: '', dosen: '', label: '', catatan: '', file: null, fileName: '', selected: {}, confirm: false, scanItems: [], scanBusy: false, scanSeq: 0, lengkapi: null },
```

Sesuaikan juga dua tempat reset `this.ba = { ... }` (di `openBaPicker` dan `logout`) dengan bentuk yang sama.

- [ ] **Step 4: Update `selectedGroup` computed for jadwal mode**

Ganti awal `selectedGroup()` menjadi:

```js
                selectedGroup() {
                    if (this.ba.mode === 'jadwal') {
                        if (!this.ba.jadwalInfo) return null;
                        const j = this.ba.jadwalInfo;
                        return { key: 'jadwal:' + this.ba.jadwalId, blok: j.blok, pilihan: j.namaKegiatan, detail: '', tanggal: j.tanggal, label: j.label, peserta: this.ba.jadwalPeserta };
                    }
                    if (!this.ba.kegiatanKey) return null;
                    return this.kegiatanGroups.find(function(g) { return g.key === this.ba.kegiatanKey; }.bind(this)) || null;
                },
```

- [ ] **Step 5: Add dosen/jam inputs and jadwal-mode header in the BA form**

Di form BA, setelah blok input `Label` (baris ~307-310), tambahkan:

```html
                                        <div v-if="ba.mode==='jadwal'" class="rounded-2xl bg-brand-50 p-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                                            <i class="bi bi-calendar-check mr-1"></i> Dari jadwal {{ ba.jadwalId }}
                                        </div>
                                        <div>
                                            <label class="label">Dosen</label>
                                            <input v-model="ba.dosen" class="input" placeholder="Nama dosen">
                                        </div>
                                        <div>
                                            <label class="label">Jam</label>
                                            <input v-model="ba.jam" type="time" class="input">
                                        </div>
```

Ubah tombol "Ubah" pada header grup (baris 282) menjadi hanya tampil pada mode manual:

```html
                                        <button v-if="ba.mode!=='jadwal'" class="text-xs font-semibold text-brand-600" @click="backToKegiatanPicker">Ubah</button>
```

- [ ] **Step 6: Update `doUploadBa` payload**

Ganti objek `payload` di `doUploadBa` menjadi:

```js
                        const payload = {
                            namaKegiatan: this.selectedGroup.pilihan + (this.selectedGroup.detail ? ' - ' + this.selectedGroup.detail : ''),
                            tanggalPelaksanaan: this.ba.tanggal,
                            jam: this.ba.jam || '',
                            dosen: this.ba.dosen || '',
                            jadwalId: this.ba.jadwalId || '',
                            label: this.ba.label.trim(),
                            blok: this.selectedGroup.blok,
                            catatan: this.ba.catatan.trim(),
                            bagian: this.subBagian || this.kategori,
                            peserta: this.selectedList,
                            file: await this.readFileAsBase64(this.ba.file)
                        };
```

- [ ] **Step 7: Reset `mode`/`jadwalId` in `openBaPicker`**

Di `openBaPicker`, tambahkan `this.ba.mode = 'manual'; this.ba.jadwalId = ''; this.ba.jadwalInfo = null; this.ba.jadwalPeserta = []; this.ba.dosen = ''; this.ba.jam = '';` setelah `this.ba.open = true;`.

- [ ] **Step 8: Insert "Siap dibuat BA" section and draft list in the BA tab**

Di dalam kartu Upload BA, tepat setelah tombol toggle `Buat Berita Acara` (blok `v-if="!ba.open"`), tambahkan daftar "Siap dibuat BA" (di luar form):

```html
                            <div v-if="!ba.open && jadwalSiapBaList.length" class="mt-4 space-y-2">
                                <div class="section-title !mb-2"><i class="bi bi-calendar-check"></i> Siap dibuat BA (dari jadwal)</div>
                                <div v-for="j in jadwalSiapBaList" :key="j.JadwalID" class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3">
                                    <div class="min-w-0">
                                        <div class="text-sm font-semibold text-slate-900">{{ j.Blok }} · {{ j.NamaKegiatan }}</div>
                                        <div class="text-[11px] text-slate-400">{{ formatTanggal(j.Tanggal) }}<template v-if="j.Jam"> · {{ j.Jam }}</template><template v-if="j.Dosen"> · {{ j.Dosen }}</template></div>
                                    </div>
                                    <button class="btn-primary !py-2 text-xs" @click="buatBaDariJadwal(j.JadwalID)"><i class="bi bi-file-earmark-plus"></i> Buat BA</button>
                                </div>
                            </div>
```

Tepat setelah kartu Upload BA ditutup (masih di dalam tab `ba`), tambahkan kartu Draft:

```html
                    <div v-if="activeTab==='ba'" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                        <div class="flex items-center gap-3 border-b border-slate-100 p-5">
                            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><i class="bi bi-hourglass-split"></i></div>
                            <div class="flex-1">
                                <h2 class="text-base font-bold text-slate-900">Draft Berita Acara</h2>
                                <p class="text-xs text-slate-400">Belum lengkap (dosen/tanggal/jam)</p>
                            </div>
                        </div>
                        <div v-if="!draftBaList.length" class="p-6 text-center text-sm text-slate-500">Tidak ada draft.</div>
                        <div v-else class="divide-y divide-slate-50">
                            <div v-for="r in draftBaList" :key="r['BA ID']" class="p-4">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <div class="font-mono text-[11px] text-slate-400">{{ r['BA ID'] }}</div>
                                        <div class="mt-0.5 text-sm font-bold text-slate-900">{{ r.Blok }} · {{ r['Nama Kegiatan'] }}</div>
                                    </div>
                                    <button class="btn-soft !py-2 text-xs" @click="lengkapiDraft(r)"><i class="bi bi-pencil"></i> Lengkapi</button>
                                </div>
                            </div>
                        </div>
                    </div>
```

Isi kartu **Riwayat** (yang sudah diberi `v-if="activeTab==='riwayat'"` pada Task 7): ganti seluruh isi `divide-y`-nya agar memakai `riwayatBaList` (bukan `filteredBaList`). Ubah baris `v-for="(r, i) in filteredBaList"` menjadi `v-for="(r, i) in riwayatBaList"` dan baris penanda kosong `v-else-if="!filteredBaList.length"` menjadi `v-else-if="!riwayatBaList.length"`.

- [ ] **Step 9: Add the lengkapi modal and methods**

Sebelum blok `<!-- ===== TOAST ===== -->`, tambahkan modal:

```html
        <!-- ===== LENGKAPI DRAFT BA ===== -->
        <transition name="slide">
            <div v-if="ba.lengkapi" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
                <div class="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" @click="ba.lengkapi=null"></div>
                <div class="safe-b relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-lift sm:rounded-3xl">
                    <div class="flex items-center gap-3">
                        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><i class="bi bi-pencil-square"></i></div>
                        <div class="min-w-0 flex-1">
                            <h3 class="text-sm font-bold text-slate-900">Lengkapi Berita Acara</h3>
                            <p class="text-xs text-slate-400">{{ ba.lengkapi.id }}</p>
                        </div>
                    </div>
                    <div class="mt-4 space-y-3">
                        <div><label class="label">Dosen</label><input v-model="ba.lengkapi.dosen" class="input"></div>
                        <div><label class="label">Jam</label><input v-model="ba.lengkapi.jam" type="time" class="input"></div>
                        <div><label class="label">Tanggal</label><input v-model="ba.lengkapi.tanggal" type="date" class="input"></div>
                    </div>
                    <div class="mt-4 flex gap-3">
                        <button class="btn-soft flex-1" @click="ba.lengkapi=null">Batal</button>
                        <button class="btn-primary flex-1" :disabled="loading" @click="saveLengkapi"><i class="bi bi-check-lg"></i> Simpan</button>
                    </div>
                </div>
            </div>
        </transition>
```

Di `methods`, tambahkan:

```js
                lengkapiDraft(r) {
                    this.ba.lengkapi = { id: r['BA ID'], dosen: r.Dosen || '', jam: r.Jam || '', tanggal: this.dateOnly(r['Tanggal Pelaksanaan']) };
                },
                async saveLengkapi() {
                    if (!this.ba.lengkapi) return;
                    this.loading = true;
                    try {
                        const payload = { dosen: this.ba.lengkapi.dosen, jam: this.ba.lengkapi.jam, tanggal: this.ba.lengkapi.tanggal };
                        const res = await this.run('lengkapiBeritaAcaraBagian', this.ba.lengkapi.id, payload, this.kategori);
                        this.showToast(res.message, res.success ? 'success' : 'error');
                        if (res.success) { this.ba.lengkapi = null; await this.loadData(); }
                    } catch (e) {
                        this.showToast('Gagal: ' + e, 'error');
                    } finally {
                        this.loading = false;
                    }
                },
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/bagian-jadwal-template.test.js test/bagian-template.test.js`
Expected: PASS (keduanya).

- [ ] **Step 11: Commit**

```bash
cd /workspace && git add new-code1-cf/public/bagian.html new-code1-cf/test/bagian-jadwal-template.test.js
git commit -m "feat(bagian): tab Berita Acara dari jadwal, draft lengkapi, dan riwayat"
```

---

### Task 9: `portal.html` — langkah timeline Jadwal Pelaksanaan

**Files:**
- Modify: `new-code1-cf/public/portal.html`
- Test: `new-code1-cf/test/portal-jadwal-template.test.js`

**Interfaces:**
- Consumes: `detailItem.jadwal` dari Task 6.
- Produces: langkah timeline baru + computed `stepJadwalDotClass`/`stepJadwalTitleClass`.

- [ ] **Step 1: Write the failing test**

`new-code1-cf/test/portal-jadwal-template.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadPortalHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/portal.html'));
  return res.text();
}

describe('guard template portal jadwal', () => {
  it('menambahkan langkah Jadwal Pelaksanaan', async () => {
    const html = await loadPortalHtml();
    expect(html).toContain('Jadwal Pelaksanaan');
    expect(html).toContain('detailItem.jadwal');
    expect(html).toContain('Belum dijadwalkan');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/portal-jadwal-template.test.js`
Expected: FAIL — `Jadwal Pelaksanaan` belum ada.

- [ ] **Step 3: Insert timeline step in `portal.html`**

Di blok timeline (`view === 'detail'`), setelah step 2 (`Instruksi Pembayaran & Berkas`, berakhir pada penutup `</div>` setelah paragraf `Menunggu persetujuan admin.`) dan sebelum `<!-- step 3 -->`, sisipkan:

```html
                                    <!-- step: jadwal pelaksanaan -->
                                    <div class="t-item">
                                        <div class="t-dot" :class="stepJadwalDotClass"></div>
                                        <div class="text-sm font-bold" :class="stepJadwalTitleClass">Jadwal Pelaksanaan</div>
                                        <div v-if="detailItem.jadwal" class="mt-1.5 space-y-0.5 text-xs text-slate-600">
                                            <div><i class="bi bi-calendar3 mr-1 text-slate-400"></i>{{ formatTanggal(detailItem.jadwal.Tanggal) }}</div>
                                            <div v-if="detailItem.jadwal.Jam"><i class="bi bi-clock mr-1 text-slate-400"></i>{{ detailItem.jadwal.Jam }}</div>
                                            <div v-if="detailItem.jadwal.Dosen"><i class="bi bi-person-badge mr-1 text-slate-400"></i>{{ detailItem.jadwal.Dosen }}</div>
                                        </div>
                                        <p v-else class="mt-1 text-xs text-slate-400">Belum dijadwalkan.</p>
                                    </div>
```

- [ ] **Step 4: Add computed classes**

Di objek `computed`, setelah `step3TitleClass()`, tambahkan:

```js
                stepJadwalDotClass() {
                    if (this.detailItem.jadwal) return 'bg-blue-500';
                    return 'bg-slate-300';
                },
                stepJadwalTitleClass() {
                    return this.detailItem.jadwal ? 'text-slate-900' : 'text-slate-400';
                },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/portal-jadwal-template.test.js test/portal-template.test.js`
Expected: PASS (keduanya).

- [ ] **Step 6: Commit**

```bash
cd /workspace && git add new-code1-cf/public/portal.html new-code1-cf/test/portal-jadwal-template.test.js
git commit -m "feat(portal): langkah jadwal pelaksanaan di detail pengajuan"
```

---

### Task 10: Verifikasi penuh

- [ ] **Step 1: Run the full suite**

Run: `cd new-code1-cf && npm test`
Expected: seluruh suite hijau (0 gagal). Bila ada flake `Network connection lost`, jalankan ulang sekali.

- [ ] **Step 2: Commit (bila ada penyesuaian test)**

```bash
cd /workspace && git status --short
```
Bila bersih, tidak ada commit tambahan.

---

## Catatan eksekusi

- Jalankan task berurutan; setiap task diakhiri commit kecil.
- Setelah Task 1, jalankan migrasi ke D1 produksi dengan strategi yang sudah dipakai sebelumnya (wrangler d1 execute) bila diminta pengguna.
- Verifikasi visual (preview) dilakukan setelah Task 8 & 9.
