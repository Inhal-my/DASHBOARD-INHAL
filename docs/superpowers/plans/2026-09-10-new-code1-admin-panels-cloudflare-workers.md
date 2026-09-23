# Admin Panels (dashboard, detail-laporan, bagian) Read-Only Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve `dashboard.html`, `detail-laporan.html`, and `bagian.html` from Cloudflare Workers with real D1 data for all read paths, using a single RPC endpoint plus a `google.script.run` shim.

**Architecture:** Extend D1 schema and the sheet importer, port GAS read functions into pure modules under `src/read/`, expose them through `POST /api/rpc`, and load the static pages with a client shim that replaces `google.script.run`. Writes are stubbed.

**Tech Stack:** Cloudflare Workers, Hono, D1, Vitest (`@cloudflare/vitest-pool-workers`), plain ES modules, Vue 3 (CDN, in pages).

## Global Constraints

- All Cloudflare work stays inside `new-code1-cf/`.
- Do not modify anything under `new-code1/` or `new-code2/`.
- Run `npm`, `npx vitest`, and `wrangler` from inside `new-code1-cf/`.
- Commit trailers: `Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>`.
- Commit messages follow the existing Conventional Commits style.
- D1 stores ISO timestamps `YYYY-MM-DDTHH:mm:ss`; client rows are label-keyed exactly like the sheet headers.
- D1 is a read replica; no Worker writes to Google Sheets.
- Auth error message must be exactly `'Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.'`.
- Stub message must be exactly `'Fitur <fn> belum tersedia pada tahap ini.'`.
- Every test file runs against the D1 schema loaded by `test/setup.js` (splits `schema.sql` on `;`).

---

### Task 1: Schema, production migration, and importer extension

**Files:**
- Modify: `new-code1-cf/schema.sql`
- Create: `new-code1-cf/migrations/2026-09-10-admin-panels.sql`
- Modify: `new-code1-cf/scripts/import-sheets.mjs`
- Modify: `new-code1-cf/src/sheetImport.js`
- Test: `new-code1-cf/test/sheetImport.test.js`

**Interfaces:**
- Consumes: existing `parseGvizResponse`, `tableToRecordsAuto`, `buildImportSql`.
- Produces: D1 tables `admin`, `bagian_staff`, `sessions`, `berita_acara`, `berita_acara_peserta`, `berita_acara_admin`, `berita_acara_admin_peserta`, `master_biaya`, `check_data`, `nomor_surat`, `log_data`; importer writes real rows for all sheets including headerless `Admin`, `BagianStaff`, `MasterBiaya`.

- [ ] **Step 1: Add new tables to `schema.sql`**

Append after the existing `status_history` index lines (keep the existing 7 tables and seed). The `sessions` table stores `kategoris` as a JSON string.

```sql
DROP TABLE IF EXISTS log_data;
DROP TABLE IF EXISTS nomor_surat;
DROP TABLE IF EXISTS check_data;
DROP TABLE IF EXISTS master_biaya;
DROP TABLE IF EXISTS berita_acara_admin_peserta;
DROP TABLE IF EXISTS berita_acara_admin;
DROP TABLE IF EXISTS berita_acara_peserta;
DROP TABLE IF EXISTS berita_acara;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS bagian_staff;
DROP TABLE IF EXISTS admin;

CREATE TABLE admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT, password TEXT, nama TEXT
);
CREATE TABLE bagian_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, kategori TEXT, nama TEXT, pass TEXT
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY, role TEXT, nama TEXT, kategori TEXT, sub_bagian TEXT,
  kategoris TEXT, created_at TEXT, expires_at TEXT
);
CREATE TABLE berita_acara (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jumlah_peserta TEXT, file_name TEXT,
  file_url TEXT, catatan TEXT, sumber TEXT
);
CREATE TABLE berita_acara_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, bagian TEXT, status_pengajuan TEXT
);
CREATE TABLE berita_acara_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jumlah_peserta TEXT, file_name TEXT,
  file_url TEXT, catatan TEXT, sumber TEXT
);
CREATE TABLE berita_acara_admin_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, bagian TEXT, status_pengajuan TEXT
);
CREATE TABLE master_biaya (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kegiatan TEXT, biaya TEXT
);
CREATE TABLE check_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, check_id TEXT, id_pengajuan TEXT,
  npm TEXT, nama_lengkap TEXT, blok TEXT, jenis_kegiatan TEXT, pilihan TEXT, detail TEXT,
  tanggal_pelaksanaan TEXT, bagian TEXT, dosen TEXT, hadir TEXT, catatan TEXT,
  updated_at TEXT, biaya TEXT
);
CREATE TABLE nomor_surat (
  id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, tahun TEXT, last_number INTEGER,
  updated_at TEXT
);
CREATE TABLE log_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, payload TEXT
);
CREATE INDEX idx_ba_ba_id ON berita_acara(ba_id);
CREATE INDEX idx_ba_peserta_ba_id ON berita_acara_peserta(ba_id);
CREATE INDEX idx_check_data_pengajuan ON check_data(id_pengajuan);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

- [ ] **Step 2: Run tests to confirm schema still loads**

Run: `npm test`
Expected: PASS (all existing tests still pass; D1 setup runs new statements without error).

- [ ] **Step 3: Create the production migration file**

Create `new-code1-cf/migrations/2026-09-10-admin-panels.sql` with the same `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` statements (no `DROP`) for exactly the 11 new tables above, so production can be migrated without deleting existing data.

- [ ] **Step 4: Extend importer specs**

In `scripts/import-sheets.mjs`, add specs to `SPECS` (order matters: delete/insert order is the array order). Add after the existing entries:

```js
  {
    sheet: 'Admin',
    table: 'admin',
    columnMap: { Password: 'password', Nama: 'nama' }
  },
  {
    sheet: 'BagianStaff',
    table: 'bagian_staff',
    columnMap: { Email: 'email', Kategori: 'kategori', Nama: 'nama', Pass: 'pass' }
  },
  {
    sheet: 'MasterBiaya',
    table: 'master_biaya',
    columnMap: { Kegiatan: 'kegiatan', Biaya: 'biaya' }
  },
  {
    sheet: 'BeritaAcara',
    table: 'berita_acara',
    columnMap: {
      Timestamp: 'timestamp', 'BA ID': 'ba_id', Bagian: 'bagian', Blok: 'blok',
      'Nama Kegiatan': 'nama_kegiatan', 'Tanggal Pelaksanaan': 'tanggal_pelaksanaan',
      'Jumlah Peserta': 'jumlah_peserta', 'File Name': 'file_name', 'File URL': 'file_url',
      Catatan: 'catatan', Sumber: 'sumber'
    }
  },
  {
    sheet: 'BeritaAcaraPeserta',
    table: 'berita_acara_peserta',
    columnMap: {
      Timestamp: 'timestamp', 'BA ID': 'ba_id', NPM: 'npm', 'Nama Lengkap': 'nama_lengkap',
      Blok: 'blok', Bagian: 'bagian', 'Status Pengajuan': 'status_pengajuan'
    }
  },
  {
    sheet: 'BeritaAcaraAdmin',
    table: 'berita_acara_admin',
    columnMap: {
      Timestamp: 'timestamp', 'BA ID': 'ba_id', Bagian: 'bagian', Blok: 'blok',
      'Nama Kegiatan': 'nama_kegiatan', 'Tanggal Pelaksanaan': 'tanggal_pelaksanaan',
      'Jumlah Peserta': 'jumlah_peserta', 'File Name': 'file_name', 'File URL': 'file_url',
      Catatan: 'catatan', Sumber: 'sumber'
    }
  },
  {
    sheet: 'BeritaAcaraAdminPeserta',
    table: 'berita_acara_admin_peserta',
    columnMap: {
      Timestamp: 'timestamp', 'BA ID': 'ba_id', NPM: 'npm', 'Nama Lengkap': 'nama_lengkap',
      Blok: 'blok', Bagian: 'bagian', 'Status Pengajuan': 'status_pengajuan'
    }
  },
  {
    sheet: 'CheckData',
    table: 'check_data',
    columnMap: {
      Timestamp: 'timestamp', 'Check ID': 'check_id', 'ID Pengajuan': 'id_pengajuan',
      NPM: 'npm', 'Nama Lengkap': 'nama_lengkap', Blok: 'blok',
      'Jenis Kegiatan': 'jenis_kegiatan', Pilihan: 'pilihan', Detail: 'detail',
      'Tanggal Pelaksanaan': 'tanggal_pelaksanaan', Bagian: 'bagian', Dosen: 'dosen',
      Hadir: 'hadir', Catatan: 'catatan', UpdatedAt: 'updated_at', Biaya: 'biaya'
    }
  },
  {
    sheet: 'StatusHistory',
    table: 'status_history',
    columnMap: { Timestamp: 'timestamp', 'ID Pengajuan': 'id_pengajuan', Status: 'status', Catatan: 'catatan', 'Actor Email': 'actor_email' }
  },
  {
    sheet: 'NomorSurat',
    table: 'nomor_surat',
    columnMap: { Type: 'type', Tahun: 'tahun', LastNumber: 'last_number', UpdatedAt: 'updated_at' }
  }
];
```

- [ ] **Step 5: Verify importer output**

Run: `node scripts/import-sheets.mjs /tmp/opencode/inhal-real-import.sql`
Expected: every sheet listed with row counts (`Admin 3`, `BagianStaff 12`, `MasterBiaya 6`, `BeritaAcara 6`, `BeritaAcaraPeserta 6`, `BeritaAcaraAdmin 3`, `BeritaAcaraAdminPeserta 3`, `CheckData 1`, `StatusHistory 25`, `NomorSurat 1`), SQL written.

Run: `grep -c 'INSERT INTO "admin"' /tmp/opencode/inhal-real-import.sql`
Expected: `1` (headerless sheet promoted, single insert).

- [ ] **Step 6: Apply locally**

Run:
```bash
npx wrangler d1 execute inhal-poc --local --file=./schema.sql
npx wrangler d1 execute inhal-poc --local --file=/tmp/opencode/inhal-real-import.sql
```
Expected: exit 0 for both.

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf/schema.sql new-code1-cf/migrations new-code1-cf/scripts/import-sheets.mjs
git commit -m "feat(new-code1-cf): extend schema and importer for admin panels

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 2: Shared read helpers (`src/read/common.js`)

**Files:**
- Create: `new-code1-cf/src/read/common.js`
- Test: `new-code1-cf/test/read-common.test.js`

**Interfaces:**
- Consumes: `env.DB`.
- Produces: `norm`, `baginaKey`, `parseCurrency`, `formatRupiah`, `dateOnly`, `getMasterOptions(db, kategori)`, `getBuktiMode(db)`, `getBiayaMap(db)`, `getBiayaOverrideMap(db)`, `resolveBiayaForPengajuan(pengajuan, biayaMap, overrideMap)`, `resolveBagianFor(masterBagianRows, jenis, pilihan, detail)`, `isWildcardBaginaKategori`, `baginaHasAccess(entry, kategori, subBagian, aliasMap)`, `getBagianAliasMap(rows)`, `resolveBagian12(rawLabel, pilihan, namaKegiatan, labs)`, `getBagianOptions12(labs)`, `normBagianAggregateWithLabs(raw, labs)`, `getBagianBaStatuses(db)`, `getBagianBaFinalOnly(db)`, `pushUnique`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  norm, baginaKey, parseCurrency, formatRupiah, getMasterOptions,
  resolveBagian12, baginaHasAccess, getBagianBaStatuses
} from '../src/read/common.js';

describe('common helpers', () => {
  it('norm lowercases and strips spaces', () => {
    expect(norm(' Praktikum ')).toBe('praktikum');
  });
  it('baginaKey strips non-alphanumerics', () => {
    expect(baginaKey('Lab. Anatomi')).toBe('labanatomi');
  });
  it('parseCurrency reads rupiah strings', () => {
    expect(parseCurrency('Rp. 300.000')).toBe(300000);
    expect(parseCurrency(0)).toBe(0);
  });
  it('formatRupiah uses dot grouping', () => {
    expect(formatRupiah(300000)).toBe('Rp 300.000');
  });
  it('getMasterOptions returns unique category values', async () => {
    const blok = await getMasterOptions(env.DB, 'Blok');
    expect(blok).toEqual(['A', 'B']);
  });
  it('resolveBagian12 maps a lab label', () => {
    const labs = ['Anatomi', 'Biokimia'];
    expect(resolveBagian12('Biokimia', '', '', labs)).toBe('Biokimia');
  });
  it('baginaHasAccess allows wildcard accounts', () => {
    expect(baginaHasAccess({ kategoris: ['*'] }, 'SGD', '')).toBe(true);
  });
  it('getBagianBaStatuses falls back to defaults', async () => {
    expect(await getBagianBaStatuses(env.DB)).toEqual(['Diterima', 'ACC']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/read-common.test.js`
Expected: FAIL (cannot find module `../src/read/common.js`).

- [ ] **Step 3: Implement `src/read/common.js`**

```js
import { getBuktiMode as repoBuktiMode } from '../repo.js';

export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function baginaKey(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function parseCurrency(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const clean = String(str).replace(/[^0-9]/g, '');
  return parseInt(clean, 10) || 0;
}

export function formatRupiah(num) {
  const n = Number(num) || 0;
  const sign = n < 0 ? '-' : '';
  const digits = String(Math.abs(Math.trunc(n)));
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += '.';
    out += digits[i];
  }
  return sign + 'Rp ' + out;
}

export function dateOnly(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : s;
}

export function pushUnique(list, v) {
  const s = String(v || '').replace(/\s+/g, ' ').trim();
  if (s && list.indexOf(s) === -1) list.push(s);
}

export async function getMasterOptions(db, kategori) {
  const { results } = await db.prepare('SELECT kategori, nilai FROM master_kegiatan').all();
  const target = norm(kategori);
  const seen = new Set();
  const out = [];
  for (const r of results || []) {
    if (norm(r.kategori) !== target) continue;
    const v = String(r.nilai || '').trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

export async function getBuktiMode(db) {
  return repoBuktiMode(db);
}

export async function getBiayaMap(db) {
  try {
    const { results } = await db.prepare('SELECT kegiatan, biaya FROM master_biaya').all();
    const map = {};
    for (const r of results || []) {
      const k = String(r.kegiatan || '').trim();
      if (k) map[k] = parseCurrency(r.biaya);
    }
    return map;
  } catch (e) {
    return {};
  }
}

export async function getBiayaOverrideMap(db) {
  try {
    const { results } = await db.prepare('SELECT id_pengajuan, pilihan, detail, tanggal_pelaksanaan, biaya FROM check_data').all();
    const map = {};
    for (const c of results || []) {
      const id = String(c.id_pengajuan || '').trim();
      if (!id) continue;
      if (String(c.detail || '').trim() !== 'BIAYA-OVERRIDE') continue;
      if (String(c.pilihan || '').trim() || String(c.tanggal_pelaksanaan || '').trim()) continue;
      const biaya = String(c.biaya || '').trim();
      if (!biaya) continue;
      map[id] = parseCurrency(biaya);
    }
    return map;
  } catch (e) {
    return {};
  }
}

export function resolveBiayaForPengajuan(pengajuan, biayaMap, overrideMap) {
  const id = String((pengajuan && pengajuan['ID Pengajuan']) || '').trim();
  overrideMap = overrideMap || {};
  if (id && overrideMap[id] !== undefined && overrideMap[id] !== null && String(overrideMap[id]).trim() !== '') {
    return overrideMap[id];
  }
  biayaMap = biayaMap || {};
  const jenis = String((pengajuan && pengajuan['Jenis Kegiatan']) || '').trim();
  if (jenis && biayaMap[jenis] !== undefined) return biayaMap[jenis];
  const jNorm = norm(jenis);
  for (const k of Object.keys(biayaMap)) {
    const kNorm = norm(k);
    if (kNorm && jNorm && (jNorm.indexOf(kNorm) !== -1 || kNorm.indexOf(jNorm) !== -1)) return biayaMap[k];
  }
  return 0;
}

export function resolveBagianFor(masterBagianRows, jenis, pilihan, detail) {
  if (jenis !== 'Praktikum') return '';
  const lab = norm(pilihan);
  const kegiatan = norm(detail);
  for (const r of masterBagianRows || []) {
    if (norm(r.lab) === lab && norm(r.kegiatan_lab) === kegiatan) return r.bagian || '';
  }
  return '';
}

export function isWildcardBaginaKategori(k) {
  const v = baginaKey(k);
  return v === '' || v === '*' || v === 'semua' || v === 'all';
}

export function getBagianAliasMap(rows) {
  const map = {};
  for (const r of rows || []) {
    const lab = baginaKey(r.lab);
    if (!lab) continue;
    for (const field of ['lab', 'kegiatan_lab', 'bagian']) {
      const k = baginaKey(r[field]);
      if (k) map[k] = lab;
    }
  }
  return map;
}

export function baginaHasAccess(entry, kategori, subBagian, aliasMap) {
  if (!entry || !entry.kategoris || entry.kategoris.length === 0) return true;
  const kat = baginaKey(kategori);
  const sub = baginaKey(subBagian);
  const isPraktikum = kat === 'praktikum';
  const map = (isPraktikum && sub) ? (aliasMap || {}) : {};
  for (const raw of entry.kategoris) {
    const nk = baginaKey(raw);
    if (isWildcardBaginaKategori(raw)) return true;
    if (nk === kat) return true;
    if (isPraktikum && nk.indexOf('lab') !== -1 && (!sub || nk.indexOf(sub) !== -1)) return true;
    if (sub && nk === sub) return true;
    if (sub && map[nk] === sub) return true;
  }
  return false;
}

export function getBagianOptions12(labs) {
  return ['Ujian', 'SGD', 'KKD'].concat(labs || []);
}

export function resolveBagian12(rawLabel, pilihan, namaKegiatan, labs) {
  const categories = ['Ujian', 'SGD', 'KKD'];
  const list = labs || [];
  const v = String(rawLabel || '').replace(/\s+/g, ' ').trim();
  const key = norm(v);
  if (key) {
    for (const c of categories) if (norm(c) === key) return c;
    for (const l of list) if (norm(l) === key) return l;
  }
  const pKey = norm(pilihan);
  if (pKey) for (const l of list) if (norm(l) === pKey) return l;
  const nKey = norm(namaKegiatan);
  if (nKey) {
    const sorted = list.slice().sort((a, b) => norm(b).length - norm(a).length);
    for (const l of sorted) if (nKey.indexOf(norm(l)) !== -1) return l;
  }
  return '';
}

export function normBagianAggregateWithLabs(raw, labs) {
  const v = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!v) return 'Lainnya';
  const key = norm(v);
  for (const c of ['SGD', 'KKD', 'Ujian', 'Praktikum']) {
    if (norm(c) === key) return c;
  }
  for (const l of labs || []) {
    if (norm(l) === key) return 'Praktikum';
  }
  return 'Lainnya';
}

async function configValue(db, key, fallback) {
  const row = await db.prepare('SELECT value FROM config WHERE key = ?1').bind(key).first();
  const v = row ? String(row.value || '').trim() : '';
  return v === '' ? fallback : v;
}

export async function getBagianBaStatuses(db) {
  const raw = await configValue(db, 'BAGIAN_BA_STATUSES', '');
  const def = ['Diterima', 'ACC'];
  if (!raw) return def;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : def;
}

export async function getBagianBaFinalOnly(db) {
  return (await configValue(db, 'BAGIAN_BA_FINAL_ONLY', 'true')) !== 'false';
}

export async function getBagianBaSettings(db) {
  return { statuses: await getBagianBaStatuses(db), finalOnly: await getBagianBaFinalOnly(db) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/read-common.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/read/common.js new-code1-cf/test/read-common.test.js
git commit -m "feat(new-code1-cf): add shared read helpers

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 3: Column maps (`src/read/columns.js`)

**Files:**
- Create: `new-code1-cf/src/read/columns.js`
- Test: `new-code1-cf/test/read-columns.test.js`

**Interfaces:**
- Produces: `TABLE_COLUMNS` (object of `table -> { dbColumn: sheetLabel }`) and `toClientRow(table, dbRow)`, `toClientRows(table, dbRows)` returning objects keyed by sheet labels.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { toClientRow, TABLE_COLUMNS } from '../src/read/columns.js';

describe('columns', () => {
  it('maps db columns to sheet labels', () => {
    const row = { id_pengajuan: 'INHAL-1', nama_lengkap: 'Budi', status: 'ACC' };
    const c = toClientRow('pengajuan', row);
    expect(c['ID Pengajuan']).toBe('INHAL-1');
    expect(c['Nama Lengkap']).toBe('Budi');
    expect(c.Status).toBe('ACC');
  });
  it('maps ba columns', () => {
    const c = toClientRow('berita_acara', { ba_id: 'BA-2026-0001', nama_kegiatan: 'X', jumlah_peserta: '2' });
    expect(c['BA ID']).toBe('BA-2026-0001');
    expect(c['Nama Kegiatan']).toBe('X');
    expect(c['Jumlah Peserta']).toBe('2');
  });
  it('keeps unknown columns as-is', () => {
    expect(toClientRow('pengajuan', { extra: 1 }).extra).toBe(1);
  });
  it('exposes every required table', () => {
    for (const t of ['pengajuan','detail_kegiatan','berita_acara','berita_acara_peserta','berita_acara_admin','berita_acara_admin_peserta','master_kegiatan','master_bagian','master_biaya','check_data','config','admin','bagian_staff']) {
      expect(TABLE_COLUMNS[t]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/read-columns.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/read/columns.js`**

```js
export const TABLE_COLUMNS = {
  mahasiswa: { npm: 'NPM', nama_lengkap: 'Nama Lengkap', email: 'Email', blok: 'Blok', keterangan: 'Keterangan' },
  master_kegiatan: { kategori: 'Kategori', nilai: 'Nilai' },
  master_bagian: { lab: 'Lab', kegiatan_lab: 'Kegiatan Lab', bagian: 'Bagian', email: 'Email' },
  master_biaya: { kegiatan: 'Kegiatan', biaya: 'Biaya' },
  config: { key: 'Key', value: 'Value' },
  admin: { password: 'Password', nama: 'Nama' },
  bagian_staff: { email: 'Email', kategori: 'Kategori', nama: 'Nama', pass: 'Pass' },
  pengajuan: {
    timestamp: 'Timestamp', id_pengajuan: 'ID Pengajuan', npm: 'NPM', nama_lengkap: 'Nama Lengkap',
    email: 'Email', no_hp_wa: 'No. HP/WA', blok: 'Blok', jenis_kegiatan: 'Jenis Kegiatan',
    keterangan: 'Keterangan', link_surat_keterangan: 'Link Surat Keterangan', status: 'Status',
    catatan_admin: 'Catatan Admin', notifikasi_terkirim_pada: 'Notifikasi Terkirim Pada',
    status_notifikasi_email: 'Status Notifikasi Email', error_notifikasi_email: 'Error Notifikasi Email',
    nomor_surat: 'Nomor Surat', link_acc_inhal: 'Link ACC INHAL', link_bukti_bayar: 'Link Bukti Bayar',
    link_final: 'Link Final', status_info_bagian: 'Status Info Bagian', waktu_info_bagian: 'Waktu Info Bagian',
    email_bagian: 'Email Bagian', catatan_info_bagian: 'Catatan Info Bagian', updated_at: 'UpdatedAt',
    dosen: 'Dosen', tanggal_pelaksanaan: 'Tanggal Pelaksanaan', lampiran_email: 'Lampiran Email'
  },
  detail_kegiatan: {
    timestamp: 'Timestamp', id_pengajuan: 'ID Pengajuan', jenis_kegiatan: 'Jenis Kegiatan',
    pilihan: 'Pilihan', detail: 'Detail', tanggal_pelaksanaan: 'Tanggal Pelaksanaan', bagian: 'Bagian'
  },
  berita_acara: {
    timestamp: 'Timestamp', ba_id: 'BA ID', bagian: 'Bagian', blok: 'Blok',
    nama_kegiatan: 'Nama Kegiatan', tanggal_pelaksanaan: 'Tanggal Pelaksanaan',
    jumlah_peserta: 'Jumlah Peserta', file_name: 'File Name', file_url: 'File URL',
    catatan: 'Catatan', sumber: 'Sumber'
  },
  berita_acara_peserta: {
    timestamp: 'Timestamp', ba_id: 'BA ID', npm: 'NPM', nama_lengkap: 'Nama Lengkap',
    blok: 'Blok', bagian: 'Bagian', status_pengajuan: 'Status Pengajuan'
  },
  berita_acara_admin: {
    timestamp: 'Timestamp', ba_id: 'BA ID', bagian: 'Bagian', blok: 'Blok',
    nama_kegiatan: 'Nama Kegiatan', tanggal_pelaksanaan: 'Tanggal Pelaksanaan',
    jumlah_peserta: 'Jumlah Peserta', file_name: 'File Name', file_url: 'File URL',
    catatan: 'Catatan', sumber: 'Sumber'
  },
  berita_acara_admin_peserta: {
    timestamp: 'Timestamp', ba_id: 'BA ID', npm: 'NPM', nama_lengkap: 'Nama Lengkap',
    blok: 'Blok', bagian: 'Bagian', status_pengajuan: 'Status Pengajuan'
  },
  check_data: {
    timestamp: 'Timestamp', check_id: 'Check ID', id_pengajuan: 'ID Pengajuan', npm: 'NPM',
    nama_lengkap: 'Nama Lengkap', blok: 'Blok', jenis_kegiatan: 'Jenis Kegiatan', pilihan: 'Pilihan',
    detail: 'Detail', tanggal_pelaksanaan: 'Tanggal Pelaksanaan', bagian: 'Bagian', dosen: 'Dosen',
    hadir: 'Hadir', catatan: 'Catatan', updated_at: 'UpdatedAt', biaya: 'Biaya'
  },
  status_history: {
    timestamp: 'Timestamp', id_pengajuan: 'ID Pengajuan', status: 'Status', catatan: 'Catatan', actor_email: 'Actor Email'
  },
  nomor_surat: { type: 'Type', tahun: 'Tahun', last_number: 'LastNumber', updated_at: 'UpdatedAt' }
};

export function toClientRow(table, dbRow) {
  const map = TABLE_COLUMNS[table] || {};
  const out = {};
  for (const [key, value] of Object.entries(dbRow || {})) {
    out[map[key] || key] = value == null ? '' : value;
  }
  return out;
}

export function toClientRows(table, dbRows) {
  return (dbRows || []).map((r) => toClientRow(table, r));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/read-columns.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/read/columns.js new-code1-cf/test/read-columns.test.js
git commit -m "feat(new-code1-cf): add db-to-sheet column maps

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 4: Sessions and authentication (`src/session.js`)

**Files:**
- Create: `new-code1-cf/src/session.js`
- Test: `new-code1-cf/test/session.test.js`

**Interfaces:**
- Consumes: `common.js` (`baginaHasAccess`, `getBagianAliasMap`).
- Produces: `SESSION_TTL_SECS`, `createSession`, `getSession`, `destroySession`, `requireAdmin`, `requireBagianSession`, `authenticateAdmin`, `authenticateBagian`, `adminBagianBypass`, `logoutSession`, `AUTH_ERROR`.
- `authenticateAdmin(db, password)` returns `{ ok, token, nama }` or `{ ok:false, message }`.
- `authenticateBagian(db, password, kategori, subBagian)` returns `{ ok, token, nama, kategori, subBagian }` or `{ ok:false, message }`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  authenticateAdmin, authenticateBagian, getSession, logoutSession,
  requireAdmin, adminBagianBypass, AUTH_ERROR
} from '../src/session.js';

async function seedAuth() {
  await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('rahasia', 'Admin Utama')").run();
  await env.DB.prepare("INSERT INTO bagian_staff (email, kategori, nama, pass) VALUES ('a@x.id','*','Bagian Umum','bgn')").run();
  await env.DB.prepare("INSERT INTO bagian_staff (email, kategori, nama, pass) VALUES ('b@x.id','SGD','Bagian SGD','sgd')").run();
}

describe('session and auth', () => {
  it('authenticates admin and requires a valid token', async () => {
    await seedAuth();
    const res = await authenticateAdmin(env.DB, 'rahasia');
    expect(res.ok).toBe(true);
    expect(res.nama).toBe('Admin Utama');
    const s = await getSession(env.DB, res.token);
    expect(s.role).toBe('admin');
    await expect(requireAdmin(env.DB, res.token)).resolves.toBeTruthy();
  });
  it('rejects wrong admin password', async () => {
    await seedAuth();
    const res = await authenticateAdmin(env.DB, 'salah');
    expect(res.ok).toBe(false);
    expect(res.message).toBe('Password admin salah.');
  });
  it('rejects invalid token with exact message', async () => {
    await expect(requireAdmin(env.DB, 'nope')).rejects.toThrow(AUTH_ERROR);
  });
  it('authenticates bagian with wildcard and denies mismatched category', async () => {
    await seedAuth();
    const ok = await authenticateBagian(env.DB, 'bgn', 'SGD', '');
    expect(ok.ok).toBe(true);
    const denied = await authenticateBagian(env.DB, 'sgd', 'KKD', '');
    expect(denied.ok).toBe(false);
  });
  it('adminBagianBypass creates a bagian session', async () => {
    await seedAuth();
    const admin = await authenticateAdmin(env.DB, 'rahasia');
    const res = await adminBagianBypass(env.DB, 'SGD', '', admin.token);
    expect(res.ok).toBe(true);
    const s = await getSession(env.DB, res.token);
    expect(s.role).toBe('bagian');
  });
  it('logoutSession destroys the session', async () => {
    await seedAuth();
    const res = await authenticateAdmin(env.DB, 'rahasia');
    await logoutSession(env.DB, res.token);
    expect(await getSession(env.DB, res.token)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/session.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/session.js`**

```js
import { baginaHasAccess, getBagianAliasMap } from './read/common.js';

export const SESSION_TTL_SECS = 4 * 60 * 60;
export const AUTH_ERROR = 'Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.';

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function expiresAt() {
  return new Date(Date.now() + SESSION_TTL_SECS * 1000).toISOString().replace(/\.\d+Z$/, '');
}

export async function createSession(db, payload) {
  const token = crypto.randomUUID();
  const p = payload || {};
  await db.prepare(
    'INSERT INTO sessions (token, role, nama, kategori, sub_bagian, kategoris, created_at, expires_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)'
  ).bind(
    token, p.role || '', p.nama || '', p.kategori || '', p.subBagian || '',
    JSON.stringify(p.kategoris || []), nowIso(), expiresAt()
  ).run();
  return token;
}

export async function getSession(db, token) {
  if (!token) return null;
  const row = await db.prepare('SELECT * FROM sessions WHERE token = ?1').bind(String(token)).first();
  if (!row) return null;
  if (row.expires_at && String(row.expires_at) <= nowIso()) {
    await destroySession(db, token);
    return null;
  }
  let kategoris = [];
  try { kategoris = JSON.parse(row.kategoris || '[]'); } catch (e) { kategoris = []; }
  return {
    role: row.role || '', nama: row.nama || '', kategori: row.kategori || '',
    subBagian: row.sub_bagian || '', kategoris: kategoris
  };
}

export async function destroySession(db, token) {
  if (!token) return;
  await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(String(token)).run();
}

export async function requireAdmin(db, token) {
  const s = await getSession(db, token);
  if (!s || s.role !== 'admin') throw new Error(AUTH_ERROR);
  return s;
}

export async function requireBagianSession(db, kategori, subBagian, token) {
  const s = await getSession(db, token);
  if (!s || s.role !== 'bagian') throw new Error(AUTH_ERROR);
  const kat = String(kategori || '').trim();
  if (kat) {
    const { results } = await db.prepare('SELECT lab, kegiatan_lab, bagian FROM master_bagian').all();
    const aliasMap = getBagianAliasMap(results || []);
    if (!baginaHasAccess({ kategoris: s.kategoris || [] }, kat, subBagian, aliasMap)) {
      throw new Error('Akses ditolak. Akun ini terdaftar untuk kategori: ' + ((s.kategoris || []).join(', ') || '(semua)') + '.');
    }
  }
  return s;
}

export async function authenticateAdmin(db, password) {
  const pwd = String(password || '').trim();
  if (!pwd) return { ok: false, message: 'Masukkan password admin.' };
  const { results } = await db.prepare('SELECT password, nama FROM admin').all();
  for (const row of results || []) {
    if (String(row.password || '').trim() && String(row.password).trim() === pwd) {
      const nama = String(row.nama || '').trim() || 'Admin';
      return { ok: true, token: await createSession(db, { role: 'admin', nama }), nama };
    }
  }
  return { ok: false, message: 'Password admin salah.' };
}

export async function authenticateBagian(db, password, kategori, subBagian) {
  const pwd = String(password || '').trim();
  if (!pwd) return { ok: false, message: 'Masukkan password.' };
  const kat = String(kategori || '').trim();
  const sub = String(subBagian || '').trim();
  const { results } = await db.prepare('SELECT email, kategori, nama, pass FROM bagian_staff').all();
  const { results: masterBagian } = await db.prepare('SELECT lab, kegiatan_lab, bagian FROM master_bagian').all();
  const aliasMap = getBagianAliasMap(masterBagian || []);
  let account = null;
  for (const r of results || []) {
    if (String(r.pass || '').trim() && String(r.pass).trim() === pwd) {
      const entry = { kategoris: r.kategori ? [r.kategori] : [], nama: r.nama };
      if (baginaHasAccess(entry, kat, sub, aliasMap)) {
        account = { nama: String(r.nama || '').trim() || 'Bagian', kategori: String(r.kategori || '').trim(), kategoris: entry.kategoris };
        break;
      }
    }
  }
  if (!account) {
    return { ok: false, message: 'Password tidak berlaku untuk bagian ' + (kat || 'yang dipilih') + ' ini.' };
  }
  const token = await createSession(db, {
    role: 'bagian', nama: account.nama, kategori: kat, subBagian: sub, kategoris: account.kategoris
  });
  return { ok: true, token, nama: account.nama, kategori: kat, subBagian: sub };
}

export async function adminBagianBypass(db, kategori, subBagian, token) {
  const admin = await requireAdmin(db, token);
  const kat = String(kategori || '').trim();
  const allowedCats = ['SGD', 'KKD', 'Ujian', 'Praktikum'];
  if (allowedCats.indexOf(kat) === -1) return { ok: false, message: 'Pilih kategori kegiatan terlebih dahulu.' };
  const sub = String(subBagian || '').trim();
  if (kat === 'Praktikum' && !sub) return { ok: false, message: 'Untuk Praktikum, pilih sub bagian / lab terlebih dahulu.' };
  const newToken = await createSession(db, { role: 'bagian', nama: admin.nama || 'Admin', kategori: kat, subBagian: sub, kategoris: [kat] });
  return { ok: true, token: newToken, nama: admin.nama || 'Admin', kategori: kat, subBagian: sub };
}

export async function logoutSession(db, token) {
  await destroySession(db, token);
  return { success: true, message: 'Anda telah keluar.' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/session.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/session.js new-code1-cf/test/session.test.js
git commit -m "feat(new-code1-cf): add D1 sessions and admin/bagian auth

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 5: RPC dispatcher and endpoint (`src/rpc.js`, `src/index.js`)

**Files:**
- Create: `new-code1-cf/src/rpc.js`
- Modify: `new-code1-cf/src/index.js`
- Test: `new-code1-cf/test/rpc.test.js`

**Interfaces:**
- Consumes: `src/session.js` (auth handlers, `getSession`), `src/read/*.js` handlers.
- Produces: `dispatchRpc(db, fn, args)` returning a JSON-serializable value; `POST /api/rpc` accepting `{ fn, args }`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { dispatchRpc } from '../src/rpc.js';

describe('dispatchRpc', () => {
  it('returns an auth error object for a protected call without token', async () => {
    const res = await dispatchRpc(env.DB, 'getDashboardBootstrap', []);
    expect(res.error).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
  });
  it('stubs unknown write functions', async () => {
    const res = await dispatchRpc(env.DB, 'updatePengajuanStatus', ['x', 'ACC', '', '']);
    expect(res).toEqual({ success: false, message: 'Fitur updatePengajuanStatus belum tersedia pada tahap ini.' });
  });
  it('dispatches authenticateAdmin', async () => {
    await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('rahasia','Admin')").run();
    const res = await dispatchRpc(env.DB, 'authenticateAdmin', ['rahasia']);
    expect(res.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/rpc.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/rpc.js`**

```js
import { getSession, authenticateAdmin, authenticateBagian, logoutSession, adminBagianBypass } from './session.js';
import { getBaginaConfig, getBagianBootstrap, getBeritaAcaraList } from './read/bagian.js';
import { getLaporanBootstrap } from './read/laporan.js';
import {
  getDashboardBootstrap, getDashboardStats, getPengajuanList, getBagianAggregation,
  getBeritaAcaraAdminList, getLabOptions, getMasterDataMonitor, getPengajuanWithDetails,
  getBaUploadOptions, diagnosticData, getBagianBaSettingsHandler
} from './read/dashboard.js';

const HANDLERS = {
  authenticateAdmin: (db, args) => authenticateAdmin(db, args[0]),
  authenticateBagian: (db, args) => authenticateBagian(db, args[0], args[1], args[2]),
  logoutSession: (db, args, ctx) => logoutSession(db, ctx.token),
  adminBagianBypass: (db, args, ctx) => adminBagianBypass(db, args[0], args[1], ctx.token),
  getBaginaConfig: (db, args, ctx) => getBaginaConfig(db, ctx),
  getBagianBaSettings: (db, args, ctx) => getBagianBaSettingsHandler(db, ctx),
  getBagianBootstrap: (db, args, ctx) => getBagianBootstrap(db, args[0], args[1], ctx),
  getBeritaAcaraList: (db, args, ctx) => getBeritaAcaraList(db, args[0], args[1], ctx),
  getLaporanBootstrap: (db, args, ctx) => getLaporanBootstrap(db, ctx),
  getDashboardBootstrap: (db, args, ctx) => getDashboardBootstrap(db, ctx),
  getDashboardStats: (db, args, ctx) => getDashboardStats(db, ctx),
  getPengajuanList: (db, args, ctx) => getPengajuanList(db, args[0], ctx),
  getBagianAggregation: (db, args, ctx) => getBagianAggregation(db, ctx),
  getBeritaAcaraAdminList: (db, args, ctx) => getBeritaAcaraAdminList(db, ctx),
  getLabOptions: (db, args, ctx) => getLabOptions(db, ctx),
  getMasterDataMonitor: (db, args, ctx) => getMasterDataMonitor(db, ctx),
  getPengajuanWithDetails: (db, args, ctx) => getPengajuanWithDetails(db, args[0], ctx),
  getBaUploadOptions: (db, args, ctx) => getBaUploadOptions(db, ctx),
  diagnosticData: (db, args, ctx) => diagnosticData(db, ctx)
};

export async function extractToken(db, args) {
  const list = Array.isArray(args) ? args.slice() : [];
  const last = list[list.length - 1];
  if (typeof last === 'string' && last) {
    const session = await getSession(db, last);
    if (session) {
      list.pop();
      return { token: last, rest: list, session };
    }
  }
  return { token: '', rest: list, session: null };
}

export async function dispatchRpc(db, fn, args) {
  const handler = HANDLERS[String(fn)];
  if (!handler) {
    return { success: false, message: 'Fitur ' + String(fn) + ' belum tersedia pada tahap ini.' };
  }
  const { token, rest, session } = await extractToken(db, args);
  try {
    return await handler(db, rest, { token, session });
  } catch (e) {
    return { error: (e && e.message) ? e.message : String(e) };
  }
}
```

- [ ] **Step 4: Add the endpoint in `src/index.js`**

Add the import and route:

```js
import { dispatchRpc } from './rpc.js';
```

```js
app.post('/api/rpc', async (c) => {
  let body = {};
  try { body = await c.req.json(); } catch (e) { body = {}; }
  const result = await dispatchRpc(c.env.DB, body.fn, body.args);
  return c.json(result);
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS. (Tasks 6-8 create `src/read/bagian.js`, `src/read/laporan.js`, `src/read/dashboard.js`; create empty stubs first if running this task before them, then fill in. Preferred: complete Tasks 6-8 before running the full suite.)

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/src/rpc.js new-code1-cf/src/index.js new-code1-cf/test/rpc.test.js
git commit -m "feat(new-code1-cf): add RPC dispatcher and endpoint

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 6: Dashboard read functions (`src/read/dashboard.js`)

**Files:**
- Create: `new-code1-cf/src/read/dashboard.js`
- Test: `new-code1-cf/test/read-dashboard.test.js`

**Interfaces:**
- Consumes: `common.js`, `columns.js`, `session.js` (`requireAdmin`).
- Produces handlers `(db, ctx)` unless noted: `getDashboardBootstrap`, `getDashboardStats`, `getPengajuanList(db, filters, ctx)`, `getBagianAggregation`, `getBeritaAcaraAdminList`, `getLabOptions`, `getMasterDataMonitor`, `getPengajuanWithDetails(db, idPengajuan, ctx)`, `getBaUploadOptions`, `diagnosticData`, `getBagianBaSettingsHandler`. All except `getLabOptions` call `requireAdmin`.
- `ctx` is `{ token, session }`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getDashboardBootstrap, getPengajuanList, getBaUploadOptions } from '../src/read/dashboard.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }) };
}
async function seed() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','Ujian','Diterima','')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','Ujian','UAS','','2026-09-20','')").run();
  await env.DB.prepare("INSERT INTO master_biaya (kegiatan,biaya) VALUES ('Ujian','Rp. 300.000')").run();
}

describe('dashboard read', () => {
  it('builds bootstrap with stats and biaya', async () => {
    await seed();
    const ctx = await adminCtx();
    const boot = await getDashboardBootstrap(env.DB, ctx);
    expect(boot.pengajuan).toHaveLength(1);
    expect(boot.pengajuan[0]['ID Pengajuan']).toBe('INHAL-1');
    expect(boot.pengajuan[0].Biaya).toBe(300000);
    expect(boot.pengajuan[0]['Biaya Rupiah']).toBe('Rp 300.000');
    expect(boot.stats.total).toBe(1);
    expect(boot.detailMap['INHAL-1']).toHaveLength(1);
  });
  it('filters pengajuan list by status', async () => {
    await seed();
    const ctx = await adminCtx();
    const rows = await getPengajuanList(env.DB, { status: 'Diterima' }, ctx);
    expect(rows).toHaveLength(1);
    const none = await getPengajuanList(env.DB, { status: 'ACC' }, ctx);
    expect(none).toHaveLength(0);
  });
  it('builds ba upload options', async () => {
    await seed();
    const ctx = await adminCtx();
    const opts = await getBaUploadOptions(env.DB, ctx);
    expect(opts.blok).toContain('A');
    expect(opts.details[0].jenis).toBe('Ujian');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/read-dashboard.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/read/dashboard.js`**

```js
import { requireAdmin } from '../session.js';
import { toClientRow, toClientRows } from './columns.js';
import {
  norm, parseCurrency, formatRupiah, getMasterOptions, getBiayaMap, getBiayaOverrideMap,
  resolveBiayaForPengajuan, normBagianAggregateWithLabs, resolveBagian12, getBagianOptions12,
  getBagianBaSettings, pushUnique
} from './common.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function baSumber(r) {
  const s = String((r && r.Sumber) || '').trim().toLowerCase();
  return s === 'admin' ? 'Admin' : 'Bagian';
}

function buildPengajuanClientRows(rows, biayaMap, overrideMap) {
  return rows.map((r) => {
    const copy = toClientRow('pengajuan', r);
    copy.Biaya = resolveBiayaForPengajuan(copy, biayaMap, overrideMap);
    copy['Biaya Rupiah'] = formatRupiah(copy.Biaya);
    const id = String(r.id_pengajuan || '').trim();
    copy.BiayaOverride = (overrideMap[id] !== undefined) ? String(overrideMap[id]) : '';
    return copy;
  });
}

export async function getDashboardStats(db, ctx) {
  await requireAdmin(db, ctx.token);
  return computeDashboardStats(db);
}

async function computeDashboardStats(db) {
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const ba = (await db.prepare('SELECT * FROM berita_acara').all()).results || [];
  const biayaMap = await getBiayaMap(db);
  const overrideMap = await getBiayaOverrideMap(db);
  const labs = await getMasterOptions(db, 'Lab');
  const perStatus = {}, perJenis = {}, perBlok = {}, trend = {}, perBagian = {};
  let totalBiaya = 0;
  for (const p of pengajuan) {
    const row = toClientRow('pengajuan', p);
    const status = String(row.Status || 'Lainnya').trim();
    perStatus[status] = (perStatus[status] || 0) + 1;
    const jenis = String(row['Jenis Kegiatan'] || 'Lainnya').trim();
    perJenis[jenis] = (perJenis[jenis] || 0) + 1;
    const blok = String(row.Blok || '-').trim();
    perBlok[blok] = (perBlok[blok] || 0) + 1;
    totalBiaya += resolveBiayaForPengajuan(row, biayaMap, overrideMap);
    const ts = row.Timestamp;
    if (ts) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        const key = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
        trend[key] = (trend[key] || 0) + 1;
      }
    }
  }
  for (const d of details) {
    const row = toClientRow('detail_kegiatan', d);
    const bagian = normBagianAggregateWithLabs(row['Jenis Kegiatan'] || row.Bagian, labs);
    perBagian[bagian] = (perBagian[bagian] || 0) + 1;
  }
  for (const b of ba) {
    const row = toClientRow('berita_acara', b);
    if (baSumber(row) !== 'Bagian') continue;
    const bagian = normBagianAggregateWithLabs(row.Bagian, labs);
    perBagian[bagian] = (perBagian[bagian] || 0) + (parseInt(row['Jumlah Peserta'], 10) || 0);
  }
  return { total: pengajuan.length, perStatus, perJenis, perBlok, trend, perBagian, totalBiaya, biayaMap };
}

export async function getDashboardBootstrap(db, ctx) {
  await requireAdmin(db, ctx.token);
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const biayaMap = await getBiayaMap(db);
  const overrideMap = await getBiayaOverrideMap(db);
  const stats = await computeDashboardStats(db);

  const sorted = pengajuan.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const detailMap = {};
  for (const d of details) {
    const id = String(d.id_pengajuan || '').trim();
    if (!id) continue;
    if (!detailMap[id]) detailMap[id] = [];
    detailMap[id].push(toClientRow('detail_kegiatan', d));
  }
  const masterBiaya = Object.keys(biayaMap).map((k) => ({ Kegiatan: k, Biaya: biayaMap[k] }));
  masterBiaya.sort((a, b) => a.Biaya - b.Biaya);

  return {
    stats,
    pengajuan: buildPengajuanClientRows(sorted, biayaMap, overrideMap),
    detailMap,
    masterBiaya,
    dosen: await getMasterOptions(db, 'Dosen')
  };
}

export async function getPengajuanList(db, filters, ctx) {
  await requireAdmin(db, ctx.token);
  filters = filters || {};
  const fStatus = String(filters.status || '').trim();
  const fJenis = String(filters.jenis || '').trim();
  const fBlok = String(filters.blok || '').trim();
  const q = norm(filters.search || '');
  let rows = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const client = rows.map((r) => ({ raw: r, row: toClientRow('pengajuan', r) }));
  let selected = client;
  if (fStatus) selected = selected.filter((r) => String(r.row.Status || '').trim() === fStatus);
  if (fJenis) selected = selected.filter((r) => String(r.row['Jenis Kegiatan'] || '').trim() === fJenis);
  if (fBlok) selected = selected.filter((r) => String(r.row.Blok || '').trim() === fBlok);
  if (q) {
    selected = selected.filter((r) => {
      const npm = norm(r.row.NPM);
      const nama = norm(r.row['Nama Lengkap']);
      return (npm && npm.indexOf(q) !== -1) || (nama && nama.indexOf(q) !== -1);
    });
  }
  selected.sort((a, b) => String(b.row.Timestamp || '').localeCompare(String(a.row.Timestamp || '')));
  const biayaMap = await getBiayaMap(db);
  const overrideMap = await getBiayaOverrideMap(db);
  return buildPengajuanClientRows(selected.map((r) => r.raw), biayaMap, overrideMap);
}

export async function getLabOptions(db) {
  return getMasterOptions(db, 'Lab');
}

export async function getPengajuanWithDetails(db, idPengajuan, ctx) {
  await requireAdmin(db, ctx.token);
  const p = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(String(idPengajuan || '').trim()).first();
  if (!p) return null;
  const copy = toClientRow('pengajuan', p);
  const details = (await db.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1').bind(String(idPengajuan || '').trim()).all()).results || [];
  copy.details = toClientRows('detail_kegiatan', details);
  const biayaMap = await getBiayaMap(db);
  const overrideMap = await getBiayaOverrideMap(db);
  copy.Biaya = resolveBiayaForPengajuan(copy, biayaMap, overrideMap);
  const id = String(p.id_pengajuan || '').trim();
  copy.BiayaOverride = (overrideMap[id] !== undefined) ? String(overrideMap[id]) : '';
  copy['Biaya Rupiah'] = formatRupiah(copy.Biaya);
  return copy;
}

export async function getBagianAggregation(db, ctx) {
  await requireAdmin(db, ctx.token);
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const ba = (await db.prepare('SELECT * FROM berita_acara').all()).results || [];
  const labs = await getMasterOptions(db, 'Lab');
  const pMap = {};
  for (const p of pengajuan) pMap[String(p.id_pengajuan || '').trim()] = toClientRow('pengajuan', p);

  const bagianRows = [];
  const bagianIndex = {};
  const addRow = (sumber, bagian, blok, jenisKegiatan, tgl, jumlah, fileUrl, linkFinal) => {
    blok = String(blok || '-').replace(/\s+/g, ' ').trim();
    jenisKegiatan = String(jenisKegiatan || '-').replace(/\s+/g, ' ').trim();
    tgl = String(tgl || '-').replace(/\s+/g, ' ').trim();
    const key = [sumber, bagian, blok, jenisKegiatan, tgl].join('|');
    if (bagianIndex[key] !== undefined) {
      bagianRows[bagianIndex[key]].total += jumlah;
      if (linkFinal && !bagianRows[bagianIndex[key]].linkFinal) bagianRows[bagianIndex[key]].linkFinal = linkFinal;
    } else {
      bagianIndex[key] = bagianRows.length;
      bagianRows.push({ sumber, bagian, blok, jenisKegiatan, tanggalPelaksanaan: tgl, total: jumlah, fileUrl: fileUrl || '', linkFinal: linkFinal || '' });
    }
  };
  for (const d of details) {
    const row = toClientRow('detail_kegiatan', d);
    const p = pMap[String(row['ID Pengajuan'] || '').trim()] || {};
    const bagian = resolveBagian12(row['Jenis Kegiatan'] || row.Bagian, row.Pilihan || row.Bagian, '', labs) || 'Lainnya';
    const pilihan = String(row.Pilihan || '').trim();
    const detailText = String(row.Detail || '').trim();
    const jenisKegiatan = detailText ? (pilihan + ' - ' + detailText) : (pilihan || '-');
    addRow('Pengajuan', bagian, p.Blok, jenisKegiatan, row['Tanggal Pelaksanaan'], 1, '', p['Link Final']);
  }
  for (const b of ba) {
    const row = toClientRow('berita_acara', b);
    if (baSumber(row) !== 'Bagian') continue;
    const bagian = resolveBagian12(row.Bagian, '', row['Nama Kegiatan'], labs);
    if (!bagian) continue;
    addRow('Berita Acara', bagian, row.Blok, String(row['Nama Kegiatan'] || '').trim() || 'Berita Acara', row['Tanggal Pelaksanaan'], parseInt(row['Jumlah Peserta'], 10) || 0, row['File URL']);
  }
  const blokList = [];
  bagianRows.forEach((r) => pushUnique(blokList, r.blok));
  return {
    categories: getBagianOptions12(labs),
    labs,
    rows: bagianRows,
    filters: { bagian: getBagianOptions12(labs), blok: blokList, sumber: ['Pengajuan', 'Berita Acara'] }
  };
}

export async function getBeritaAcaraAdminList(db, ctx) {
  await requireAdmin(db, ctx.token);
  const rows = (await db.prepare('SELECT * FROM berita_acara_admin').all()).results || [];
  rows.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const peserta = (await db.prepare('SELECT * FROM berita_acara_admin_peserta').all()).results || [];
  const map = {};
  for (const r of peserta) {
    const id = String(r.ba_id || '').trim();
    if (!id) continue;
    if (!map[id]) map[id] = [];
    map[id].push({ npm: String(r.npm || '').trim(), namaLengkap: String(r.nama_lengkap || '').trim(), blok: String(r.blok || '').trim() });
  }
  return rows.map((r) => {
    const c = toClientRow('berita_acara_admin', r);
    c.peserta = map[String(r.ba_id || '').trim()] || [];
    return c;
  });
}

export async function getMasterDataMonitor(db, ctx) {
  await requireAdmin(db, ctx.token);
  const all = async (table) => (await db.prepare(`SELECT * FROM ${table}`).all()).results || [];
  return {
    masterKegiatan: await all('master_kegiatan'),
    masterBagian: await all('master_bagian'),
    masterBiaya: await all('master_biaya'),
    config: await all('config'),
    bagianStaff: await all('bagian_staff'),
    admin: await all('admin'),
    bagianSettings: await getBagianBaSettings(db)
  };
}

export async function getBaUploadOptions(db, ctx) {
  await requireAdmin(db, ctx.token);
  try {
    const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
    const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
    const pMap = {};
    for (const p of pengajuan) pMap[String(p.id_pengajuan || '').trim()] = toClientRow('pengajuan', p);
    const blokList = [];
    const blokSeen = {};
    for (const p of pengajuan) {
      const b = String(toClientRow('pengajuan', p).Blok || '').replace(/\s+/g, ' ').trim();
      if (b && !blokSeen[b.toLowerCase()]) { blokSeen[b.toLowerCase()] = true; blokList.push(b); }
    }
    blokList.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const detailMap = {};
    for (const d of details) {
      const row = toClientRow('detail_kegiatan', d);
      const p = pMap[String(row['ID Pengajuan'] || '').trim()];
      const blok = String((p && p.Blok) || '').replace(/\s+/g, ' ').trim();
      const jenis = String(row['Jenis Kegiatan'] || '').replace(/\s+/g, ' ').trim();
      const pilihan = String(row.Pilihan || '').replace(/\s+/g, ' ').trim();
      const detailText = String(row.Detail || '').replace(/\s+/g, ' ').trim();
      if (!jenis && !pilihan && !detailText) continue;
      const key = [blok.toLowerCase(), jenis.toLowerCase(), pilihan.toLowerCase(), detailText.toLowerCase()].join('|');
      if (!detailMap[key]) {
        const nama = pilihan + (detailText ? ' - ' + detailText : '');
        detailMap[key] = { blok, jenis, pilihan, detail: detailText, tanggalPelaksanaan: row['Tanggal Pelaksanaan'], label: (jenis || 'Lainnya') + ' \u2014 ' + (nama || '-'), count: 0 };
      }
      detailMap[key].count++;
    }
    const detailList = Object.keys(detailMap).map((k) => detailMap[k]);
    detailList.sort((a, b) => (a.blok.toLowerCase() + a.label.toLowerCase()).localeCompare(b.blok.toLowerCase() + b.label.toLowerCase()));
    return { blok: blokList, details: detailList, labs: await getMasterOptions(db, 'Lab') };
  } catch (e) {
    return { blok: [], details: [], labs: [] };
  }
}

export async function diagnosticData(db, ctx) {
  await requireAdmin(db, ctx.token);
  const count = async (table) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n || 0;
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const npmDebug = pengajuan.map((p) => {
    const raw = p.npm;
    const s = String(raw || '');
    const codes = [];
    for (let i = 0; i < s.length; i++) codes.push(s.charCodeAt(i));
    const st = String(p.status || '');
    const stCodes = [];
    for (let j = 0; j < st.length; j++) stCodes.push(st.charCodeAt(j));
    return { type: typeof raw, value: JSON.stringify(s), charCodes: codes.join(' '), nama: String(p.nama_lengkap || ''), status: JSON.stringify(st), statusCodes: stCodes.join(' '), timestampType: typeof p.timestamp };
  });
  return {
    sheetId: '',
    sheets: [],
    counts: {
      Pengajuan: pengajuan.length,
      DetailKegiatan: await count('detail_kegiatan'),
      StatusHistory: await count('status_history'),
      CheckData: await count('check_data'),
      Mahasiswa: await count('mahasiswa'),
      LogData: await count('log_data')
    },
    npmDebug,
    portalResult: null,
    listResult: null,
    menungguResult: null
  };
}

export async function getBagianBaSettingsHandler(db, ctx) {
  await requireAdmin(db, ctx.token);
  return getBagianBaSettings(db);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/read-dashboard.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/read/dashboard.js new-code1-cf/test/read-dashboard.test.js
git commit -m "feat(new-code1-cf): port dashboard read functions

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 7: Laporan read function (`src/read/laporan.js`)

**Files:**
- Create: `new-code1-cf/src/read/laporan.js`
- Test: `new-code1-cf/test/read-laporan.test.js`

**Interfaces:**
- Consumes: `common.js`, `columns.js`, `session.js` (`requireAdmin`).
- Produces: `getLaporanBootstrap(db, ctx)`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getLaporanBootstrap } from '../src/read/laporan.js';

describe('getLaporanBootstrap', () => {
  it('summarizes pengajuan with biaya and BA', async () => {
    await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,dosen,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','Ujian','Diterima','dr. Andi','https://x/final')").run();
    await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','Ujian','UAS','','2026-09-20','')").run();
    await env.DB.prepare("INSERT INTO master_biaya (kegiatan,biaya) VALUES ('Ujian','Rp. 300.000')").run();
    const ctx = { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }) };
    const boot = await getLaporanBootstrap(env.DB, ctx);
    expect(boot.summary.totalPendaftar).toBe(1);
    expect(boot.summary.totalDiterima).toBe(1);
    expect(boot.summary.totalBiaya).toBe(300000);
    expect(boot.rows[0].pengajuan['ID Pengajuan']).toBe('INHAL-1');
    expect(boot.rows[0].details).toHaveLength(1);
    expect(boot.dosen).toContain('dr. Andi');
    expect(boot.blok).toContain('A');
    expect(boot.bagian.labs).toContain('Anatomi');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/read-laporan.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/read/laporan.js`**

```js
import { requireAdmin } from '../session.js';
import { toClientRow } from './columns.js';
import { formatRupiah, getMasterOptions, getBiayaMap, getBiayaOverrideMap, resolveBiayaForPengajuan } from './common.js';

function baSumber(r) {
  const s = String((r && r.Sumber) || '').trim().toLowerCase();
  return s === 'admin' ? 'Admin' : 'Bagian';
}

export async function getLaporanBootstrap(db, ctx) {
  await requireAdmin(db, ctx.token);
  const pengajuan = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const histories = (await db.prepare('SELECT * FROM status_history').all()).results || [];
  const ba = (await db.prepare('SELECT * FROM berita_acara').all()).results || [];
  const biayaMap = await getBiayaMap(db);
  const overrideMap = await getBiayaOverrideMap(db);
  const baPeserta = (await db.prepare('SELECT * FROM berita_acara_peserta').all()).results || [];
  const pesertaMap = {};
  for (const r of baPeserta) {
    const id = String(r.ba_id || '').trim();
    if (!id) continue;
    if (!pesertaMap[id]) pesertaMap[id] = [];
    pesertaMap[id].push({ npm: String(r.npm || '').trim(), namaLengkap: String(r.nama_lengkap || '').trim(), blok: String(r.blok || '').trim() });
  }

  const detailById = {};
  for (const d of details) {
    const k = String(d.id_pengajuan || '').trim();
    if (!detailById[k]) detailById[k] = [];
    detailById[k].push(toClientRow('detail_kegiatan', d));
  }
  const historyById = {};
  for (const h of histories) {
    const k = String(h.id_pengajuan || '').trim();
    if (!historyById[k]) historyById[k] = [];
    historyById[k].push(toClientRow('status_history', h));
  }

  let totalPendaftar = 0, totalDiterima = 0, totalDitolak = 0, totalMenunggu = 0, totalAcc = 0, totalBiaya = 0;
  const perJenis = {}, perBlok = {}, perStatus = {};
  const rows = pengajuan.map((p) => {
    const id = String(p.id_pengajuan || '').trim();
    const row = toClientRow('pengajuan', p);
    const status = String(row.Status || '').trim();
    totalPendaftar++;
    if (status === 'Diterima') totalDiterima++;
    if (status === 'Ditolak') totalDitolak++;
    if (status === 'Menunggu') totalMenunggu++;
    if (status === 'ACC') totalAcc++;
    perStatus[status || 'Lainnya'] = (perStatus[status || 'Lainnya'] || 0) + 1;
    const jenis = String(row['Jenis Kegiatan'] || 'Lainnya').trim();
    perJenis[jenis] = (perJenis[jenis] || 0) + 1;
    const blok = String(row.Blok || '-').trim();
    perBlok[blok] = (perBlok[blok] || 0) + 1;
    row.Biaya = resolveBiayaForPengajuan(row, biayaMap, overrideMap);
    row['Biaya Rupiah'] = formatRupiah(row.Biaya);
    totalBiaya += row.Biaya;
    return { pengajuan: row, details: detailById[id] || [], history: historyById[id] || [] };
  });

  const sortedBa = ba.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const beritaAcara = sortedBa.filter((r) => baSumber(toClientRow('berita_acara', r)) === 'Bagian').map((r) => {
    const c = toClientRow('berita_acara', r);
    c.peserta = pesertaMap[String(r.ba_id || '').trim()] || [];
    return c;
  });

  const pushUnique = (list, v) => {
    const s = String(v || '').replace(/\s+/g, ' ').trim();
    if (s && list.indexOf(s) === -1) list.push(s);
  };
  const dosen = [];
  pengajuan.forEach((p) => pushUnique(dosen, toClientRow('pengajuan', p).Dosen));
  dosen.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const blok = [];
  pengajuan.forEach((p) => pushUnique(blok, toClientRow('pengajuan', p).Blok));
  ba.forEach((b) => pushUnique(blok, toClientRow('berita_acara', b).Blok));
  blok.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  return {
    summary: { totalPendaftar, totalDiterima, totalDitolak, totalMenunggu, totalAcc, totalBiaya, perJenis, perBlok, perStatus },
    rows,
    beritaAcara,
    dosen,
    blok,
    bagian: { categories: ['Ujian', 'SGD', 'KKD'], labs: await getMasterOptions(db, 'Lab') }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/read-laporan.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/read/laporan.js new-code1-cf/test/read-laporan.test.js
git commit -m "feat(new-code1-cf): port laporan bootstrap

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 8: Bagian read functions (`src/read/bagian.js`)

**Files:**
- Create: `new-code1-cf/src/read/bagian.js`
- Test: `new-code1-cf/test/read-bagian.test.js`

**Interfaces:**
- Consumes: `common.js`, `columns.js`, `session.js` (`getSession`, `requireBagianSession`, `AUTH_ERROR`).
- Produces: `getBaginaConfig(db, ctx)`, `getBagianBootstrap(db, kategori, subBagian, ctx)`, `getBeritaAcaraList(db, bagianFilter, kategori, ctx)`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getBaginaConfig, getBagianBootstrap, getBeritaAcaraList } from '../src/read/bagian.js';

async function bagianCtx(kategoris = ['*']) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian Umum', kategori: '', subBagian: '', kategoris }) };
}
async function seed() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','Ujian','Diterima')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','Ujian','UAS','','2026-09-20','')").run();
  await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,sumber) VALUES ('2026-09-10T09:00:00','BA-2026-0001','Ujian','A','UAS','2026-09-20','1','Bagian')").run();
  await env.DB.prepare("INSERT INTO berita_acara_peserta (timestamp,ba_id,npm,nama_lengkap,blok) VALUES ('2026-09-10T09:00:00','BA-2026-0001','2201010001','Aisyah','A')").run();
}

describe('bagian read', () => {
  it('returns config without auth', async () => {
    const cfg = await getBaginaConfig(env.DB, {});
    expect(cfg.categories).toEqual(['SGD', 'KKD', 'Ujian', 'Praktikum']);
    expect(Array.isArray(cfg.labOptions)).toBe(true);
  });
  it('returns bootstrap for a valid session', async () => {
    await seed();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.ok).toBe(true);
    expect(boot.rows).toHaveLength(1);
    expect(boot.rows[0].idPengajuan).toBe('INHAL-1');
    expect(boot.baList).toHaveLength(1);
    expect(boot.baList[0].peserta).toHaveLength(1);
  });
  it('returns bootstrap with ok=false on invalid session', async () => {
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', { token: 'nope' });
    expect(boot.ok).toBe(false);
    expect(boot.message).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
  });
  it('returns BA list for a valid session', async () => {
    await seed();
    const list = await getBeritaAcaraList(env.DB, 'Ujian', 'Ujian', await bagianCtx());
    expect(list).toHaveLength(1);
    expect(list[0]['BA ID']).toBe('BA-2026-0001');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/read-bagian.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/read/bagian.js`**

```js
import { getSession, requireBagianSession, AUTH_ERROR } from '../session.js';
import { toClientRow } from './columns.js';
import {
  baginaKey, getMasterOptions, getBagianBaSettings, baginaHasAccess,
  getBagianAliasMap, resolveBagian12
} from './common.js';

function baSumber(r) {
  const s = String((r && r.Sumber) || '').trim().toLowerCase();
  return s === 'admin' ? 'Admin' : 'Bagian';
}

export async function getBaginaConfig(db) {
  return {
    categories: ['SGD', 'KKD', 'Ujian', 'Praktikum'],
    labOptions: await getMasterOptions(db, 'Lab'),
    kegiatanLabOptions: await getMasterOptions(db, 'Kegiatan Lab'),
    ba: await getBagianBaSettings(db)
  };
}

async function computeBagianRows(db, kategori, subBagian) {
  const all = (await db.prepare('SELECT * FROM pengajuan').all()).results || [];
  const details = (await db.prepare('SELECT * FROM detail_kegiatan').all()).results || [];
  const kat = baginaKey(kategori);
  const sub = baginaKey(subBagian);
  const byId = {};
  for (const d of details) {
    const id = String(d.id_pengajuan || '').trim();
    if (!id) continue;
    if (!byId[id]) byId[id] = [];
    byId[id].push(toClientRow('detail_kegiatan', d));
  }
  const rows = [];
  for (const p of all) {
    const prow = toClientRow('pengajuan', p);
    const id = String(prow['ID Pengajuan'] || '').trim();
    const ds = byId[id];
    if (!ds) continue;
    for (const d of ds) {
      const dJenis = baginaKey(d['Jenis Kegiatan']);
      if (kat && dJenis !== kat) continue;
      if (kat === 'praktikum' && sub) {
        const dBagian = baginaKey(d.Bagian);
        const dPilihan = baginaKey(d.Pilihan);
        if (dBagian !== sub && dPilihan !== sub) continue;
      }
      rows.push({
        idPengajuan: id,
        npm: String(prow.NPM || '').trim(),
        namaLengkap: String(prow['Nama Lengkap'] || '').trim(),
        blok: String(prow.Blok || '').trim(),
        jenis: String(d['Jenis Kegiatan'] || '').trim(),
        pilihan: String(d.Pilihan || '').trim(),
        detail: String(d.Detail || '').trim(),
        tanggal: String(d['Tanggal Pelaksanaan'] || ''),
        bagian: String(d.Bagian || '').trim(),
        status: String(prow.Status || '').trim(),
        linkSurat: String(prow['Link Surat Keterangan'] || '').trim(),
        linkFinal: String(prow['Link Final'] || '').trim()
      });
    }
  }
  return rows;
}

async function getBaPesertaMap(db) {
  const rows = (await db.prepare('SELECT * FROM berita_acara_peserta').all()).results || [];
  const map = {};
  for (const r of rows) {
    const id = String(r.ba_id || '').trim();
    if (!id) continue;
    if (!map[id]) map[id] = [];
    map[id].push({ npm: String(r.npm || '').trim(), namaLengkap: String(r.nama_lengkap || '').trim(), blok: String(r.blok || '').trim() });
  }
  return map;
}

async function computeBaList(db, bagianFilter, kategori) {
  const all = (await db.prepare('SELECT * FROM berita_acara').all()).results || [];
  const rows = all.map((r) => toClientRow('berita_acara', r)).filter((r) => baSumber(r) === 'Bagian');
  const filter = baginaKey(bagianFilter);
  const kat = baginaKey(kategori);
  const isPraktikum = kat === 'praktikum';
  const labs = isPraktikum ? await getMasterOptions(db, 'Lab') : null;
  const pesertaMap = await getBaPesertaMap(db);
  const sanitized = rows.map((c) => {
    const copy = Object.assign({}, c);
    copy.peserta = pesertaMap[String(c['BA ID'] || '').trim()] || [];
    return copy;
  });
  if (filter) {
    return sanitized.filter((r) => {
      if (isPraktikum) {
        const resolved = resolveBagian12(r.Bagian, '', r['Nama Kegiatan'], labs);
        return resolved ? baginaKey(resolved) === filter : false;
      }
      return baginaKey(r.Bagian) === filter;
    });
  }
  return sanitized;
}

export async function getBagianBootstrap(db, kategori, subBagian, ctx) {
  const out = {
    ok: false, message: '', nama: '',
    kategori: String(kategori || '').trim(), subBagian: String(subBagian || '').trim(),
    config: { categories: ['SGD', 'KKD', 'Ujian', 'Praktikum'], labOptions: [], kegiatanLabOptions: [] },
    rows: [], baList: []
  };
  try {
    const s = await getSession(db, ctx.token);
    if (!s || s.role !== 'bagian') { out.message = AUTH_ERROR; return out; }
    const kat = out.kategori;
    if (kat) {
      const masterBagian = (await db.prepare('SELECT lab, kegiatan_lab, bagian FROM master_bagian').all()).results || [];
      if (!baginaHasAccess({ kategoris: s.kategoris || [] }, kat, subBagian, getBagianAliasMap(masterBagian))) {
        out.message = 'Akun ini terdaftar untuk kategori: ' + ((s.kategoris || []).join(', ') || '(semua)') + '. Bukan ' + kat + '.';
        return out;
      }
    }
    out.ok = true;
    out.nama = s.nama || '';
    out.config.labOptions = await getMasterOptions(db, 'Lab');
    out.config.kegiatanLabOptions = await getMasterOptions(db, 'Kegiatan Lab');
    out.rows = await computeBagianRows(db, kat, subBagian);
    out.baList = await computeBaList(db, subBagian || out.kategori, out.kategori);
    return out;
  } catch (e) {
    out.message = (e && e.message) ? e.message : String(e);
    return out;
  }
}

export async function getBeritaAcaraList(db, bagianFilter, kategori, ctx) {
  try {
    await requireBagianSession(db, kategori, '', ctx.token);
    return await computeBaList(db, bagianFilter, kategori);
  } catch (e) {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/read-bagian.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS (all files).

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/src/read/bagian.js new-code1-cf/test/read-bagian.test.js
git commit -m "feat(new-code1-cf): port bagian read functions

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 9: Client shim and pages

**Files:**
- Create: `new-code1-cf/public/gs-shim.js`
- Create: `new-code1-cf/public/dashboard.html` (copy of `new-code1/pages/dashboard.html`, edited)
- Create: `new-code1-cf/public/detail-laporan.html` (copy, edited)
- Create: `new-code1-cf/public/bagian.html` (copy, edited)

**Interfaces:**
- Consumes: `POST /api/rpc`.
- Produces: `window.google.script.run` chainable proxy.

- [ ] **Step 1: Create `public/gs-shim.js`**

```js
(function () {
  function rpc(fn, args) {
    return fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn: fn, args: args })
    }).then(function (res) {
      return res.json().catch(function () { return { error: 'Respons tidak valid' }; }).then(function (data) {
        if (!res.ok || (data && data.error)) {
          var msg = (data && (data.error || data.message)) || ('HTTP ' + res.status);
          var err = new Error(msg);
          throw err;
        }
        return data;
      });
    });
  }

  function makeRunner() {
    var onSuccess = function () {};
    var onFailure = function () {};
    var proxy;
    var base = {
      withSuccessHandler: function (fn) { if (typeof fn === 'function') onSuccess = fn; return proxy; },
      withFailureHandler: function (fn) { if (typeof fn === 'function') onFailure = fn; return proxy; }
    };
    proxy = new Proxy(base, {
      get: function (target, prop) {
        if (prop in target) return target[prop];
        return function () {
          var args = Array.prototype.slice.call(arguments);
          rpc(String(prop), args).then(function (r) { onSuccess(r); }).catch(function (e) { onFailure(e); });
        };
      }
    });
    return proxy;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner();
})();
```

- [ ] **Step 2: Copy pages and apply edits**

For each page `new-code1/pages/<name>.html` -> `new-code1-cf/public/<name>.html`:

Replace (dashboard shown; identical pattern for all):
- `<?= PAGE_TITLES.dashboard ?>` -> `Dashboard` (dashboard); `<?= PAGE_TITLES['detail-laporan'] ?>` -> `Laporan Detail` (detail-laporan); `<?= PAGE_TITLES.bagian ?>` -> `Bagian` (bagian).
- `const APP_URL = '<?= appUrl ?>';` -> `const APP_URL = '';`
- `const USER_EMAIL = '<?= userEmail ?>';` -> `const USER_EMAIL = '';`
- `:href="appUrl + '?page=detail-laporan'"` -> `:href="'/detail-laporan'"` (dashboard, 2 occurrences)
- `window.open(APP_URL + '?page=detail-laporan', '_blank')` -> `window.open('/detail-laporan', '_blank')` (dashboard)
- `:href="appUrl + '?page=dashboard'"` -> `:href="'/dashboard'"` (detail-laporan)
- Insert `<script src="/gs-shim.js"></script>` immediately before the Vue CDN `<script src="https://cdn.jsdelivr.net/npm/vue@3/..."></script>` line.

Verify no scriptlets remain:
Run: `grep -nE "<\\?|google.script.run" new-code1-cf/public/dashboard.html new-code1-cf/public/detail-laporan.html new-code1-cf/public/bagian.html`
Expected: only the `google.script.run` occurrences inside the page `run`/`runAsBab` methods remain (these are now served by the shim); no `<?` scriptlets.

- [ ] **Step 3: Local E2E**

Run `npx wrangler dev --port 8787 --ip 127.0.0.1` in a background terminal. Then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/dashboard
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/detail-laporan
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/bagian
curl -s http://127.0.0.1:8787/api/rpc -H 'Content-Type: application/json' -d '{"fn":"authenticateAdmin","args":["<TEST_PASSWORD>"]}'
```
Expected: three `200`s; the last returns `{ "ok": true, ... }` when using a password from the imported `admin` table.

- [ ] **Step 4: Commit**

```bash
git add new-code1-cf/public/gs-shim.js new-code1-cf/public/dashboard.html new-code1-cf/public/detail-laporan.html new-code1-cf/public/bagian.html
git commit -m "feat(new-code1-cf): serve admin panels with google.script.run shim

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 10: Documentation, deploy, and production verification

**Files:**
- Modify: `new-code1-cf/README.md`
- Modify: `new-code1-cf/DEPLOY.md` (if present)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Update README**

Add to the endpoint table: `POST /api/rpc`. Add pages `/dashboard`, `/detail-laporan`, `/bagian`. Add a section explaining that these pages are read-only, that data is refreshed by re-running the importer, and that write actions return the stub message.

- [ ] **Step 2: Run full tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Apply migration + data to production D1**

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=./migrations/2026-09-10-admin-panels.sql
node scripts/import-sheets.mjs /tmp/opencode/inhal-real-import.sql
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=/tmp/opencode/inhal-real-import.sql
```
Expected: exit 0 for all.

- [ ] **Step 4: Deploy**

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```
Expected: `Uploaded inhal-poc`, new Version ID.

- [ ] **Step 5: Verify production**

```bash
curl -s -o /dev/null -w "dashboard %{http_code}\n" https://inhal-poc.new-code1-cf.workers.dev/dashboard
curl -s -o /dev/null -w "laporan %{http_code}\n" https://inhal-poc.new-code1-cf.workers.dev/detail-laporan
curl -s -o /dev/null -w "bagian %{http_code}\n" https://inhal-poc.new-code1-cf.workers.dev/bagian
curl -s https://inhal-poc.new-code1-cf.workers.dev/api/rpc -H 'Content-Type: application/json' -d '{"fn":"getBaginaConfig","args":[]}'
```
Expected: three `200`s; RPC returns `categories` array.

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/README.md new-code1-cf/DEPLOY.md
git commit -m "docs(new-code1-cf): document admin panels

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

## Self-Review

**Spec coverage:**
- Schema + migration + importer -> Task 1.
- Column maps and shared helpers -> Tasks 2, 3.
- Sessions and auth (admin/bagian, bypass, logout) -> Task 4.
- RPC contract, token detection, stubs -> Task 5.
- Dashboard read functions -> Task 6.
- Laporan read -> Task 7.
- Bagian read -> Task 8.
- Shim + pages + routing -> Task 9.
- Docs, migration apply, deploy, verification -> Task 10.
- Performance (single-wave reads, indexes, no cross-request cache) -> Tasks 1, 6.
- Accuracy (label maps, currency parity) -> Tasks 2, 3, 6.

**Placeholder scan:** No TBD/TODO. `<TEST_PASSWORD>` in Task 9 Step 3 is an explicit value to read from the imported `admin` row, not a code placeholder.

**Type consistency:** Handler signatures in `rpc.js` match the exports of `src/read/*.js`. `ctx` is always `{ token, session }`. `toClientRow(table, dbRow)` used consistently. `getBagianBaSettingsHandler` is the dashboard-exported name to avoid colliding with `common.getBagianBaSettings`.

**Known ordering:** Task 5 imports Task 6/7/8 modules. Complete Tasks 6-8 before running the full suite in Task 5 Step 5, or create the modules in order 6, 7, 8 then 5. Recommended order: 1, 2, 3, 4, 6, 7, 8, 5, 9, 10.
