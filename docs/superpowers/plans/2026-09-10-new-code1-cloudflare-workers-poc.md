# Cloudflare Workers PoC (`new-code1-cf`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjalankan halaman `index` (pendaftaran) dari `new-code1` di Cloudflare Workers + Hono + D1, sepenuhnya lokal, sebagai fondasi migrasi penuh.

**Architecture:** Satu Worker melayani Static Assets (`public/index.html`) dan REST `/api/*` lewat Hono. Halaman GAS dipakai ulang; hanya method `run()` diganti menjadi `fetch`. Data disimpan di D1 (binding `DB`).

**Tech Stack:** Cloudflare Workers, Hono 4, D1, Wrangler 4, Vitest + `@cloudflare/vitest-pool-workers`, Node 22.

## Global Constraints

- Project baru di `new-code1-cf/`; **jangan mengubah** file apa pun di `new-code1/`.
- Runtime Workers; `compatibility_date = "2026-09-01"`.
- Binding D1 bernama `DB`; `database_name = "inhal-poc"`.
- Framework backend: Hono.
- Frontend: salinan `new-code1/pages/index.html`; hanya method `run()` yang diubah.
- Tanpa auth/session, email, R2, halaman lain, migrasi data asli di PoC.
- Timestamp lokal Asia/Jakarta via `nowLocalIso()` (format `YYYY-MM-DDTHH:mm:ss`).
- ID pengajuan: `'INHAL-' + crypto.randomUUID()`.
- Pesan duplikat persis: `Data identik sudah pernah diajukan. Silakan cek status pengajuan Anda.`
- Perintah dijalankan dari dalam `new-code1-cf/`.
- Setiap task diakhiri commit.

---

### Task 1: Scaffold Worker + Hono + D1 schema + test harness

**Files:**
- Create: `new-code1-cf/package.json`
- Create: `new-code1-cf/wrangler.toml`
- Create: `new-code1-cf/vitest.config.js`
- Create: `new-code1-cf/test/setup.js`
- Create: `new-code1-cf/schema.sql`
- Create: `new-code1-cf/src/index.js`
- Test: `new-code1-cf/test/api.test.js`

**Interfaces:**
- Consumes: none.
- Produces: Worker default export (Hono app) dengan `GET /api/health`; binding `DB`; `schema.sql` (DDL + seed) yang dipakai `test/setup.js` dan `wrangler d1 execute`.

- [ ] **Step 1: Write the failing test**

Create `new-code1-cf/test/api.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';

describe('scaffold', () => {
  it('responds ok on health', async () => {
    const res = await SELF.fetch('http://example.com/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('applies schema and seed to D1', async () => {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM mahasiswa').first();
    expect(row.n).toBe(3);
  });
});
```

- [ ] **Step 2: Create the test harness and schema**

Create `new-code1-cf/schema.sql`:

```sql
DROP TABLE IF EXISTS status_history;
DROP TABLE IF EXISTS detail_kegiatan;
DROP TABLE IF EXISTS pengajuan;
DROP TABLE IF EXISTS config;
DROP TABLE IF EXISTS master_bagian;
DROP TABLE IF EXISTS master_kegiatan;
DROP TABLE IF EXISTS mahasiswa;

CREATE TABLE mahasiswa (
  npm TEXT PRIMARY KEY, nama_lengkap TEXT, email TEXT, blok TEXT, keterangan TEXT
);
CREATE TABLE master_kegiatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kategori TEXT NOT NULL, nilai TEXT NOT NULL
);
CREATE TABLE master_bagian (
  id INTEGER PRIMARY KEY AUTOINCREMENT, lab TEXT, kegiatan_lab TEXT, bagian TEXT, email TEXT
);
CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE pengajuan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT, id_pengajuan TEXT UNIQUE, npm TEXT, nama_lengkap TEXT, email TEXT,
  no_hp_wa TEXT, blok TEXT, jenis_kegiatan TEXT, dosen TEXT, tanggal_pelaksanaan TEXT,
  keterangan TEXT, link_surat_keterangan TEXT, status TEXT, catatan_admin TEXT,
  notifikasi_terkirim_pada TEXT, status_notifikasi_email TEXT, error_notifikasi_email TEXT,
  lampiran_email TEXT, nomor_surat TEXT, link_acc_inhal TEXT, link_bukti_bayar TEXT,
  link_final TEXT, status_info_bagian TEXT, waktu_info_bagian TEXT, email_bagian TEXT,
  catatan_info_bagian TEXT, updated_at TEXT
);
CREATE TABLE detail_kegiatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, id_pengajuan TEXT,
  jenis_kegiatan TEXT, pilihan TEXT, detail TEXT, tanggal_pelaksanaan TEXT, bagian TEXT
);
CREATE TABLE status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, id_pengajuan TEXT,
  status TEXT, catatan TEXT, actor_email TEXT
);
CREATE INDEX idx_pengajuan_npm ON pengajuan(npm);
CREATE INDEX idx_detail_pengajuan ON detail_kegiatan(id_pengajuan);
CREATE INDEX idx_history_pengajuan ON status_history(id_pengajuan);

INSERT INTO mahasiswa (npm, nama_lengkap, email, blok, keterangan) VALUES
('2201010001','Aisyah Putri','aisyah@contoh.com','A',''),
('2201010002','Budi Santoso','budi@contoh.com','B',''),
('2201010003','Citra Dewi','citra@contoh.com','A','');

INSERT INTO master_kegiatan (kategori, nilai) VALUES
('Blok','A'),('Blok','B'),
('Ujian','UAS'),('Ujian','UTS'),
('SGD','SGD 1'),('Detail SGD','Materi A'),
('KKD','KKD 1'),('Detail KKD','Materi B'),
('Lab','Lab Anatomi'),('Kegiatan Lab','Praktikum 1'),
('Dosen','dr. Andi');

INSERT INTO master_bagian (lab, kegiatan_lab, bagian, email) VALUES
('Lab Anatomi','Praktikum 1','Anatomi','anatomi@contoh.com');

INSERT INTO config (key, value) VALUES ('BUKTI_MODE','strict');
```

Create `new-code1-cf/test/setup.js`:

```js
import { beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import schemaSql from '../schema.sql?raw';

beforeEach(async () => {
  await env.DB.exec(schemaSql);
});
```

Create `new-code1-cf/vitest.config.js`:

```js
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    setupFiles: ['./test/setup.js'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: { d1Databases: ['DB'] }
      }
    }
  }
});
```

- [ ] **Step 3: Create project config**

Create `new-code1-cf/package.json`:

```json
{
  "name": "new-code1-cf",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:local": "wrangler d1 execute inhal-poc --local --file=./schema.sql",
    "test": "vitest run"
  },
  "dependencies": {
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "vitest": "~2.1.0",
    "wrangler": "^4.0.0"
  }
}
```

Create `new-code1-cf/wrangler.toml`:

```toml
name = "inhal-poc"
main = "src/index.js"
compatibility_date = "2026-09-01"

[assets]
directory = "./public"
binding = "ASSETS"
run_worker_first = ["/api/*"]

[[d1_databases]]
binding = "DB"
database_name = "inhal-poc"
database_id = "00000000-0000-0000-0000-000000000000"
```

- [ ] **Step 4: Write minimal implementation**

Create `new-code1-cf/src/index.js`:

```js
import { Hono } from 'hono';

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: `node_modules/` terbuat tanpa error.

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: 2 tests PASS (`responds ok on health`, `applies schema and seed to D1`).

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf
git commit -m "chore(new-code1-cf): scaffold worker, D1 schema, and test harness"
```

---

### Task 2: Pure helper library (`src/lib.js`)

**Files:**
- Create: `new-code1-cf/src/lib.js`
- Test: `new-code1-cf/test/lib.test.js`

**Interfaces:**
- Consumes: none.
- Produces:
  - `norm(value: string): string`
  - `normalizeFormText(value): string`
  - `isValidEmail(value): boolean`
  - `isValidPhone(value): boolean`
  - `bagianKey(lab, kegiatan): string`
  - `buildPengajuanKey(formData): string`
  - `storedKeyFromDetails(pengajuan, details): string`
  - `buildDetailKegiatanRows(formData, idPengajuan, bagianMap, nowIso): Array<object>` (keys: `timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian`)
  - `nowLocalIso(date?: Date): string`
  - `newIdPengajuan(): string`

- [ ] **Step 1: Write the failing test**

Create `new-code1-cf/test/lib.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  norm, isValidEmail, isValidPhone, bagianKey,
  buildPengajuanKey, storedKeyFromDetails, buildDetailKegiatanRows,
  nowLocalIso, newIdPengajuan
} from '../src/lib.js';

describe('norm & validators', () => {
  it('normalizes case and whitespace', () => {
    expect(norm('  Lab Anatomi ')).toBe('lab anatomi');
  });
  it('validates email and phone', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidPhone('0812-3456-789')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
  });
});

describe('buildPengajuanKey', () => {
  it('builds key for Ujian', () => {
    expect(buildPengajuanKey({ npm: '1', jenisKegiatan: 'Ujian', detailKegiatan: 'UAS', tanggalKegiatan: '2026-09-20' }))
      .toBe('1||ujian||uas||2026-09-20');
  });
  it('builds key for Praktikum with sorted parts', () => {
    const form = { npm: '1', jenisKegiatan: 'Praktikum', praktikum: [
      { lab: 'Lab B', kegiatanLab: 'X', tanggal: '2026-09-21' },
      { lab: 'Lab A', kegiatanLab: 'Y', tanggal: '2026-09-20' }
    ] };
    expect(buildPengajuanKey(form)).toBe('1||praktikum||lab a | y | 2026-09-20 && lab b | x | 2026-09-21||2026-09-21');
  });
});

describe('storedKeyFromDetails', () => {
  it('matches form key semantics', () => {
    const key = storedKeyFromDetails(
      { npm: '1', jenis_kegiatan: 'Ujian' },
      [{ pilihan: 'UAS', detail: '', tanggal_pelaksanaan: '2026-09-20' }]
    );
    expect(key).toBe('1||ujian||uas||2026-09-20');
  });
});

describe('buildDetailKegiatanRows', () => {
  it('builds praktikum rows with bagian from map', () => {
    const map = new Map([[bagianKey('Lab Anatomi', 'Praktikum 1'), 'Anatomi']]);
    const rows = buildDetailKegiatanRows(
      { jenisKegiatan: 'Praktikum', praktikum: [{ lab: 'Lab Anatomi', kegiatanLab: 'Praktikum 1', tanggal: '2026-09-20' }] },
      'INHAL-x', map, '2026-09-10T08:00:00'
    );
    expect(rows).toEqual([{
      timestamp: '2026-09-10T08:00:00', id_pengajuan: 'INHAL-x', jenis_kegiatan: 'Praktikum',
      pilihan: 'Lab Anatomi', detail: 'Praktikum 1', tanggal_pelaksanaan: '2026-09-20', bagian: 'Anatomi'
    }]);
  });
  it('builds ujian row with empty bagian', () => {
    const rows = buildDetailKegiatanRows({ jenisKegiatan: 'Ujian', detailKegiatan: 'UAS', tanggalKegiatan: '2026-09-20' }, 'INHAL-y', new Map(), '2026-09-10T08:00:00');
    expect(rows).toHaveLength(1);
    expect(rows[0].bagian).toBe('');
  });
});

describe('ids and time', () => {
  it('prefixes uuid', () => {
    expect(newIdPengajuan()).toMatch(/^INHAL-[0-9a-f-]{36}$/);
  });
  it('formats local iso', () => {
    expect(nowLocalIso(new Date(2026, 8, 10, 8, 5, 3))).toBe('2026-09-10T08:05:03');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/lib.test.js`
Expected: FAIL — `Failed to resolve import "../src/lib.js"`.

- [ ] **Step 3: Write the implementation**

Create `new-code1-cf/src/lib.js`:

```js
export function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeFormText(value) {
  return String(value == null ? '' : value).trim();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

export function isValidPhone(value) {
  return /^[0-9+\-\s().]{8,20}$/.test(String(value || '').trim());
}

export function bagianKey(lab, kegiatan) {
  return norm(lab) + '|' + norm(kegiatan);
}

export function buildPengajuanKey(formData) {
  const npm = norm(formData.npm);
  const jenis = norm(formData.jenisKegiatan);
  let detail = '';
  let tanggal = '';
  if (jenis === 'ujian') {
    detail = norm(formData.detailKegiatan);
    tanggal = norm(formData.tanggalKegiatan);
  } else if (jenis === 'sgd') {
    detail = [norm(formData.pilihanSgd), norm(formData.detailSgd)].filter(Boolean).join(' | ');
    tanggal = norm(formData.tanggalKegiatan);
  } else if (jenis === 'kkd') {
    detail = [norm(formData.pilihanKkd), norm(formData.detailKkd)].filter(Boolean).join(' | ');
    tanggal = norm(formData.tanggalKegiatan);
  } else if (jenis === 'praktikum' && Array.isArray(formData.praktikum) && formData.praktikum.length > 0) {
    const parts = formData.praktikum
      .map((p) => [norm(p.lab), norm(p.kegiatanLab), norm(p.tanggal)].filter(Boolean).join(' | '))
      .filter(Boolean)
      .sort();
    detail = parts.join(' && ');
    tanggal = norm(formData.praktikum[0].tanggal);
  }
  return [npm, jenis, detail, tanggal].join('||');
}

export function storedKeyFromDetails(pengajuan, details) {
  const npm = norm(pengajuan.npm);
  const jenis = norm(pengajuan.jenis_kegiatan);
  const detailParts = [];
  let tanggal = '';
  (details || []).forEach((d) => {
    detailParts.push([norm(d.pilihan), norm(d.detail)].filter(Boolean).join(' | '));
    if (!tanggal) tanggal = norm(d.tanggal_pelaksanaan);
  });
  const detail = detailParts.filter(Boolean).sort().join(' && ');
  return [npm, jenis, detail, tanggal].join('||');
}

export function buildDetailKegiatanRows(formData, idPengajuan, bagianMap, nowIso) {
  const rows = [];
  const jenis = normalizeFormText(formData.jenisKegiatan);
  const addRow = (pilihan, detail, tanggal) => {
    rows.push({
      timestamp: nowIso,
      id_pengajuan: idPengajuan,
      jenis_kegiatan: jenis,
      pilihan,
      detail,
      tanggal_pelaksanaan: tanggal,
      bagian: jenis === 'Praktikum' ? (bagianMap.get(bagianKey(pilihan, detail)) || '') : ''
    });
  };
  if (jenis === 'Ujian') {
    addRow(normalizeFormText(formData.detailKegiatan), '', normalizeFormText(formData.tanggalKegiatan));
  } else if (jenis === 'SGD') {
    addRow(normalizeFormText(formData.pilihanSgd), normalizeFormText(formData.detailSgd), normalizeFormText(formData.tanggalKegiatan));
  } else if (jenis === 'KKD') {
    addRow(normalizeFormText(formData.pilihanKkd), normalizeFormText(formData.detailKkd), normalizeFormText(formData.tanggalKegiatan));
  } else if (jenis === 'Praktikum' && Array.isArray(formData.praktikum)) {
    formData.praktikum.forEach((p) => {
      const lab = normalizeFormText(p && p.lab);
      const kegiatan = normalizeFormText(p && p.kegiatanLab);
      const tanggal = normalizeFormText(p && p.tanggal);
      if (lab || kegiatan) addRow(lab, kegiatan, tanggal);
    });
  }
  return rows;
}

export function nowLocalIso(date = new Date()) {
  const pad = (n) => (n < 10 ? '0' : '') + n;
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

export function newIdPengajuan() {
  return 'INHAL-' + crypto.randomUUID();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/lib.test.js`
Expected: PASS (semua test di file tersebut).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS (api + lib).

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/src/lib.js new-code1-cf/test/lib.test.js
git commit -m "feat(new-code1-cf): add GAS pure helper ports"
```

---

### Task 3: D1 read layer (`src/repo.js`)

**Files:**
- Create: `new-code1-cf/src/repo.js`
- Test: `new-code1-cf/test/repo.test.js`

**Interfaces:**
- Consumes: `norm`, `bagianKey`, `storedKeyFromDetails` dari `src/lib.js`; binding `DB`; seed `schema.sql`.
- Produces:
  - `getMasterOptions(db, kategori): Promise<string[]>`
  - `getBuktiMode(db): Promise<'strict'|'lenggang'>`
  - `getStudentNameByNpm(db, npm): Promise<string>`
  - `getBagianMap(db): Promise<Map<string,string>>`
  - `findDuplicatePengajuan(db, formKey): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

Create `new-code1-cf/test/repo.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { getMasterOptions, getBuktiMode, getStudentNameByNpm, getBagianMap, findDuplicatePengajuan } from '../src/repo.js';

describe('repo reads', () => {
  it('returns master options by kategori (case-insensitive)', async () => {
    expect(await getMasterOptions(env.DB, 'Ujian')).toEqual(['UAS', 'UTS']);
    expect(await getMasterOptions(env.DB, 'ujian')).toEqual(['UAS', 'UTS']);
  });
  it('returns bukti mode', async () => {
    expect(await getBuktiMode(env.DB)).toBe('strict');
  });
  it('returns student name by npm', async () => {
    expect(await getStudentNameByNpm(env.DB, '2201010001')).toBe('Aisyah Putri');
    expect(await getStudentNameByNpm(env.DB, '000')).toBe('');
  });
  it('returns bagian map', async () => {
    const map = await getBagianMap(env.DB);
    expect(map.get('lab anatomi|praktikum 1')).toBe('Anatomi');
  });
  it('detects no duplicate initially', async () => {
    expect(await findDuplicatePengajuan(env.DB, '1||ujian||uas||2026-09-20')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/repo.test.js`
Expected: FAIL — `Failed to resolve import "../src/repo.js"`.

- [ ] **Step 3: Write the implementation**

Create `new-code1-cf/src/repo.js`:

```js
import { norm, bagianKey, storedKeyFromDetails } from './lib.js';

export async function getMasterOptions(db, kategori) {
  const { results } = await db.prepare('SELECT kategori, nilai FROM master_kegiatan').all();
  const target = norm(kategori);
  const seen = new Set();
  const out = [];
  for (const r of results || []) {
    if (norm(r.kategori) !== target) continue;
    const v = String(r.nilai || '').trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

export async function getBuktiMode(db) {
  const row = await db.prepare("SELECT value FROM config WHERE key = 'BUKTI_MODE'").first();
  const v = row ? String(row.value || '').trim() : '';
  return v === 'lenggang' ? 'lenggang' : 'strict';
}

export async function getStudentNameByNpm(db, npm) {
  const row = await db.prepare('SELECT nama_lengkap FROM mahasiswa WHERE npm = ?1').bind(String(npm || '').trim()).first();
  return row ? (row.nama_lengkap || '') : '';
}

export async function getBagianMap(db) {
  const { results } = await db.prepare('SELECT lab, kegiatan_lab, bagian FROM master_bagian').all();
  const map = new Map();
  for (const r of results || []) {
    const key = bagianKey(r.lab, r.kegiatan_lab);
    if (key !== '|' && !map.has(key)) map.set(key, r.bagian || '');
  }
  return map;
}

export async function findDuplicatePengajuan(db, formKey) {
  if (!formKey) return false;
  const { results: pengajuans } = await db.prepare('SELECT id_pengajuan, npm, jenis_kegiatan FROM pengajuan').all();
  const { results: details } = await db.prepare('SELECT id_pengajuan, pilihan, detail, tanggal_pelaksanaan FROM detail_kegiatan').all();
  const byId = new Map();
  for (const d of details || []) {
    if (!byId.has(d.id_pengajuan)) byId.set(d.id_pengajuan, []);
    byId.get(d.id_pengajuan).push(d);
  }
  for (const p of pengajuans || []) {
    if (storedKeyFromDetails(p, byId.get(p.id_pengajuan) || []) === formKey) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/repo.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/repo.js new-code1-cf/test/repo.test.js
git commit -m "feat(new-code1-cf): add D1 read layer"
```

---

### Task 4: Read endpoints (`/api/registration-options`, `/api/mahasiswa/:npm`)

**Files:**
- Modify: `new-code1-cf/src/index.js`
- Test: `new-code1-cf/test/api.test.js` (tambahkan blok)

**Interfaces:**
- Consumes: `getMasterOptions`, `getStudentNameByNpm`, `getBuktiMode` dari `src/repo.js`.
- Produces: dua rute GET. `registration-options` mengembalikan objek dengan key `blok,ujian,sgd,detailSgd,kkd,detailKkd,lab,kegiatanLab,dosen,buktiMode`. `mahasiswa/:npm` mengembalikan **JSON string** nama (parity `getStudentNameByNpm`).

- [ ] **Step 1: Write the failing test**

Append to `new-code1-cf/test/api.test.js`:

```js
import { getMasterOptions } from '../src/repo.js'; // (boleh dihapus setelah hijau)

describe('read endpoints', () => {
  it('returns registration options', async () => {
    const res = await SELF.fetch('http://example.com/api/registration-options');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ujian).toEqual(['UAS', 'UTS']);
    expect(body.lab).toEqual(['Lab Anatomi']);
    expect(body.buktiMode).toBe('strict');
    expect(body).toHaveProperty('detailSgd');
    expect(body).toHaveProperty('detailKkd');
    expect(body).toHaveProperty('dosen');
  });

  it('returns student name as a JSON string', async () => {
    const res = await SELF.fetch('http://example.com/api/mahasiswa/2201010001');
    expect(res.status).toBe(200);
    expect(await res.json()).toBe('Aisyah Putri');
  });

  it('returns empty string for unknown npm', async () => {
    const res = await SELF.fetch('http://example.com/api/mahasiswa/999');
    expect(await res.json()).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/api.test.js`
Expected: FAIL — status 404 untuk `/api/registration-options`.

- [ ] **Step 3: Write the implementation**

Replace `new-code1-cf/src/index.js` with:

```js
import { Hono } from 'hono';
import { getMasterOptions, getBuktiMode, getStudentNameByNpm } from './repo.js';

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/registration-options', async (c) => {
  const db = c.env.DB;
  const [blok, ujian, sgd, detailSgd, kkd, detailKkd, lab, kegiatanLab, dosen, buktiMode] = await Promise.all([
    getMasterOptions(db, 'Blok'),
    getMasterOptions(db, 'Ujian'),
    getMasterOptions(db, 'SGD'),
    getMasterOptions(db, 'Detail SGD'),
    getMasterOptions(db, 'KKD'),
    getMasterOptions(db, 'Detail KKD'),
    getMasterOptions(db, 'Lab'),
    getMasterOptions(db, 'Kegiatan Lab'),
    getMasterOptions(db, 'Dosen'),
    getBuktiMode(db)
  ]);
  return c.json({ blok, ujian, sgd, detailSgd, kkd, detailKkd, lab, kegiatanLab, dosen, buktiMode });
});

app.get('/api/mahasiswa/:npm', async (c) => {
  const name = await getStudentNameByNpm(c.env.DB, c.req.param('npm'));
  return c.json(name);
});

export default app;
```

Hapus baris import `getMasterOptions` yang tidak dipakai dari test (yang ditambahkan di Step 1).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/api.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/index.js new-code1-cf/test/api.test.js
git commit -m "feat(new-code1-cf): add registration options and mahasiswa endpoints"
```

---

### Task 5: Registration write path (`POST /api/pengajuan`)

**Files:**
- Create: `new-code1-cf/src/pengajuan.js`
- Modify: `new-code1-cf/src/index.js`
- Test: `new-code1-cf/test/pengajuan.test.js`

**Interfaces:**
- Consumes: `buildPengajuanKey`, `buildDetailKegiatanRows`, `normalizeFormText`, `isValidEmail`, `isValidPhone`, `nowLocalIso`, `newIdPengajuan` dari `src/lib.js`; `getBagianMap`, `findDuplicatePengajuan` dari `src/repo.js`.
- Produces: `registerPengajuan(db, formData): Promise<{ success: boolean, idPengajuan?: string, message: string }>` dan rute `POST /api/pengajuan` (200 saat sukses, 400 saat gagal).

- [ ] **Step 1: Write the failing test**

Create `new-code1-cf/test/pengajuan.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';

async function post(body) {
  return SELF.fetch('http://example.com/api/pengajuan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

const validBody = {
  npm: '2201010001', namaLengkap: 'Aisyah Putri', email: 'aisyah@contoh.com',
  noHp: '08123456789', blok: 'A', jenisKegiatan: 'Ujian',
  detailKegiatan: 'UAS', tanggalKegiatan: '2026-09-20'
};

describe('POST /api/pengajuan', () => {
  it('rejects missing name', async () => {
    const res = await post({ npm: '1', email: 'a@b.com', noHp: '08123456789' });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('NPM dan Nama Lengkap wajib diisi.');
  });

  it('rejects bad email', async () => {
    const res = await post({ ...validBody, email: 'bukan-email' });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('Email aktif wajib diisi dengan format yang benar.');
  });

  it('stores pengajuan, detail, and status history', async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.idPengajuan).toMatch(/^INHAL-/);

    const p = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(body.idPengajuan).first();
    expect(p.npm).toBe('2201010001');
    expect(p.status).toBe('Menunggu');
    expect(p.updated_at).toBe(p.timestamp);

    const d = await env.DB.prepare('SELECT COUNT(*) AS n FROM detail_kegiatan WHERE id_pengajuan = ?1').bind(body.idPengajuan).first();
    expect(d.n).toBe(1);

    const h = await env.DB.prepare('SELECT * FROM status_history WHERE id_pengajuan = ?1').bind(body.idPengajuan).first();
    expect(h.status).toBe('Menunggu');
    expect(h.catatan).toBe('Pengajuan dibuat.');
  });

  it('rejects an identical duplicate', async () => {
    await post(validBody);
    const res = await post(validBody);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('Data identik sudah pernah diajukan. Silakan cek status pengajuan Anda.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/pengajuan.test.js`
Expected: FAIL — rute `POST /api/pengajuan` belum ada (404).

- [ ] **Step 3: Write the implementation**

Create `new-code1-cf/src/pengajuan.js`:

```js
import {
  buildPengajuanKey, buildDetailKegiatanRows, normalizeFormText,
  isValidEmail, isValidPhone, nowLocalIso, newIdPengajuan
} from './lib.js';
import { getBagianMap, findDuplicatePengajuan } from './repo.js';

const PENGAJUAN_COLUMNS = [
  'timestamp', 'id_pengajuan', 'npm', 'nama_lengkap', 'email', 'no_hp_wa', 'blok',
  'jenis_kegiatan', 'dosen', 'tanggal_pelaksanaan', 'keterangan', 'link_surat_keterangan',
  'status', 'catatan_admin', 'notifikasi_terkirim_pada', 'status_notifikasi_email',
  'error_notifikasi_email', 'lampiran_email', 'nomor_surat', 'link_acc_inhal',
  'link_bukti_bayar', 'link_final', 'status_info_bagian', 'waktu_info_bagian',
  'email_bagian', 'catatan_info_bagian', 'updated_at'
];

export async function registerPengajuan(db, formData) {
  const npm = normalizeFormText(formData.npm);
  const nama = normalizeFormText(formData.namaLengkap);
  const email = normalizeFormText(formData.email);
  const noHp = normalizeFormText(formData.noHp);
  if (!npm || !nama) {
    return { success: false, message: 'NPM dan Nama Lengkap wajib diisi.' };
  }
  if (!email || !isValidEmail(email)) {
    return { success: false, message: 'Email aktif wajib diisi dengan format yang benar.' };
  }
  if (!noHp || !isValidPhone(noHp)) {
    return { success: false, message: 'No. HP/WhatsApp wajib diisi dengan format yang benar.' };
  }

  const formKey = buildPengajuanKey(formData);
  if (formKey && await findDuplicatePengajuan(db, formKey)) {
    return { success: false, message: 'Data identik sudah pernah diajukan. Silakan cek status pengajuan Anda.' };
  }

  const idPengajuan = newIdPengajuan();
  const nowIso = nowLocalIso();
  const bagianMap = await getBagianMap(db);
  const detailRows = buildDetailKegiatanRows(formData, idPengajuan, bagianMap, nowIso);
  if (detailRows.length === 0) {
    return { success: false, message: 'Detail kegiatan tidak valid.' };
  }

  const values = {
    timestamp: nowIso, id_pengajuan: idPengajuan, npm, nama_lengkap: nama, email,
    no_hp_wa: noHp, blok: normalizeFormText(formData.blok),
    jenis_kegiatan: normalizeFormText(formData.jenisKegiatan), dosen: '',
    tanggal_pelaksanaan: '', keterangan: normalizeFormText(formData.keterangan),
    link_surat_keterangan: '', status: 'Menunggu', catatan_admin: '',
    notifikasi_terkirim_pada: '', status_notifikasi_email: '', error_notifikasi_email: '',
    lampiran_email: '', nomor_surat: '', link_acc_inhal: '', link_bukti_bayar: '',
    link_final: '', status_info_bagian: '', waktu_info_bagian: '', email_bagian: '',
    catatan_info_bagian: '', updated_at: nowIso
  };
  const placeholders = PENGAJUAN_COLUMNS.map((_, i) => '?' + (i + 1)).join(', ');
  const stmts = [
    db.prepare('INSERT INTO pengajuan (' + PENGAJUAN_COLUMNS.join(', ') + ') VALUES (' + placeholders + ')')
      .bind(...PENGAJUAN_COLUMNS.map((col) => values[col]))
  ];
  for (const d of detailRows) {
    stmts.push(
      db.prepare('INSERT INTO detail_kegiatan (timestamp, id_pengajuan, jenis_kegiatan, pilihan, detail, tanggal_pelaksanaan, bagian) VALUES (?1,?2,?3,?4,?5,?6,?7)')
        .bind(d.timestamp, d.id_pengajuan, d.jenis_kegiatan, d.pilihan, d.detail, d.tanggal_pelaksanaan, d.bagian)
    );
  }
  stmts.push(
    db.prepare('INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) VALUES (?1,?2,?3,?4,?5)')
      .bind(nowIso, idPengajuan, 'Menunggu', 'Pengajuan dibuat.', '')
  );

  try {
    await db.batch(stmts);
  } catch (e) {
    return { success: false, message: 'Gagal menyimpan pengajuan: ' + (e && e.message ? e.message : String(e)) };
  }
  return { success: true, idPengajuan, message: 'Pengajuan berhasil didaftarkan.' };
}
```

Add the route to `new-code1-cf/src/index.js` (import + handler, sebelum `export default app`):

```js
import { registerPengajuan } from './pengajuan.js';

app.post('/api/pengajuan', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: 'Data tidak valid.' }, 400);
  }
  const result = await registerPengajuan(c.env.DB, body);
  return c.json(result, result.success ? 200 : 400);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/pengajuan.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS (api + lib + repo + pengajuan).

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/src/pengajuan.js new-code1-cf/src/index.js new-code1-cf/test/pengajuan.test.js
git commit -m "feat(new-code1-cf): add pengajuan registration write path"
```

---

### Task 6: Frontend page + `run()` shim

**Files:**
- Create: `new-code1-cf/public/index.html` (salinan `new-code1/pages/index.html`)
- Test: manual + smoke check

**Interfaces:**
- Consumes: 3 endpoint dari Task 4 & 5.
- Produces: halaman `index` yang berkomunikasi lewat `fetch`, bukan `google.script.run`.

- [ ] **Step 1: Copy the page**

Run: `mkdir -p new-code1-cf/public && cp new-code1/pages/index.html new-code1-cf/public/index.html`
Expected: `new-code1-cf/public/index.html` ada.

- [ ] **Step 2: Replace the `run()` method**

Di `new-code1-cf/public/index.html`, ganti method `run(fn, ...args)` yang memakai `google.script.run` menjadi:

```js
                run(fn, ...args) {
                    const map = {
                        getRegistrationOptions: () => ({ method: 'GET', url: '/api/registration-options' }),
                        getStudentNameByNpm: (npm) => ({ method: 'GET', url: '/api/mahasiswa/' + encodeURIComponent(npm) }),
                        registerPengajuan: (payload) => ({ method: 'POST', url: '/api/pengajuan', body: payload })
                    };
                    const call = map[fn];
                    if (!call) return Promise.reject(new Error('Fungsi tidak dikenal: ' + fn));
                    const { method, url, body } = call(...args);
                    return fetch(url, {
                        method: method,
                        headers: body ? { 'Content-Type': 'application/json' } : undefined,
                        body: body ? JSON.stringify(body) : undefined
                    }).then(async (res) => {
                        const data = await res.json().catch(() => ({ success: false, message: 'Respons tidak valid' }));
                        if (!res.ok) throw new Error((data && data.message) || ('HTTP ' + res.status));
                        return data;
                    });
                },
```

- [ ] **Step 3: Smoke check the shim**

Run: `node --input-type=module -e "import {readFileSync} from 'fs'; const h=readFileSync('new-code1-cf/public/index.html','utf8'); for (const s of ['/api/registration-options','/api/mahasiswa/','/api/pengajuan']) { if(!h.includes(s)) throw new Error('missing '+s); } if (h.includes('google.script.run')) throw new Error('google.script.run still present'); console.log('shim ok');"`
Expected: `shim ok`

- [ ] **Step 4: Manual end-to-end verification**

```bash
npm run db:local
npx wrangler dev
```

Lalu di browser `http://localhost:8787`:
1. Halaman `Pendaftaran INHAL` muncul.
2. Pilih NPM `2201010001`, blur field → Nama Lengkap terisi otomatis "Aisyah Putri".
3. Pilih jenis `Ujian`, isi detail/tanggal, submit → kartu sukses menampilkan ID `INHAL-...`.
4. Cek data:

```bash
npx wrangler d1 execute inhal-poc --local --command "SELECT id_pengajuan, npm, status FROM pengajuan ORDER BY id DESC LIMIT 3"
```
Expected: baris terbaru dengan `status = Menunggu`.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/index.html
git commit -m "feat(new-code1-cf): serve index page with fetch shim"
```

---

### Task 7: README + final verification

**Files:**
- Create: `new-code1-cf/README.md`

**Interfaces:**
- Consumes: seluruh task sebelumnya.
- Produces: dokumentasi cara menjalankan & memverifikasi PoC.

- [ ] **Step 1: Write the README**

Create `new-code1-cf/README.md`:

```markdown
# new-code1-cf — Cloudflare Workers PoC

Proof-of-concept halaman pendaftaran (`index`) dari `new-code1` (Google Apps Script) di Cloudflare Workers + Hono + D1.

## Prasyarat

- Node.js 22+, npm
- Tidak perlu akun Cloudflare untuk mode lokal

## Menjalankan lokal

```bash
npm install
npm run db:local
npx wrangler dev
```

Buka http://localhost:8787

## Menjalankan test

```bash
npm test
```

## Endpoint

| Method | Rute | Keterangan |
|---|---|---|
| GET | `/api/health` | Cek Worker |
| GET | `/api/registration-options` | Opsi form pendaftaran |
| GET | `/api/mahasiswa/:npm` | Nama mahasiswa (string) |
| POST | `/api/pengajuan` | Simpan pendaftaran |

## Cakupan

Termasuk: halaman index, 3 endpoint, D1 (7 tabel + seed), test otomatis.
Belum termasuk: auth, email, R2, halaman lain, migrasi data asli, deploy produksi.
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS semua file test.

- [ ] **Step 3: Verify schema applies via wrangler CLI**

Run: `npm run db:local`
Expected: output sukses tanpa error.

- [ ] **Step 4: Commit**

```bash
git add new-code1-cf/README.md
git commit -m "docs(new-code1-cf): add PoC README"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| 3. Arsitektur & struktur folder | Task 1, 6 |
| 4. Skema D1 + seed | Task 1 |
| 5. Kontrak API + port helper | Task 2, 3, 4, 5 |
| 6. Shim frontend | Task 6 |
| 7. Workflow lokal & verifikasi | Task 6, 7 |
| 8. Risiko (timestamp, UUID, batch) | Task 2 (`nowLocalIso`, `newIdPengajuan`), Task 5 (`db.batch`) |
| 9. Fase lanjutan | Di luar cakupan (dicatat di README) |

**2. Placeholder scan:** tidak ada TBD/TODO; semua step memuat kode/perintah lengkap.

**3. Type consistency:** `registerPengajuan`, `getMasterOptions`, `getStudentNameByNpm`, `getBuktiMode`, `getBagianMap`, `findDuplicatePengajuan`, `buildDetailKegiatanRows`, `storedKeyFromDetails`, `nowLocalIso`, `newIdPengajuan`, `bagianKey` dipakai dengan nama & signature yang sama di seluruh task.
