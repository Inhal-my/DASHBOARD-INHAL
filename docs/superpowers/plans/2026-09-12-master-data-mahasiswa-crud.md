# CRUD Mahasiswa + Master Data per-baris + tombol BA Pelaksanaan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah CRUD Mahasiswa (per-baris + impor CSV) dan CRUD per-baris untuk tabel master lain di dashboard, serta perbaiki UX tombol BA Pelaksanaan.

**Architecture:** RPC per-baris (`saveMahasiswa`, `deleteMahasiswa`, `importMahasiswaCsv`, `saveMasterRow`, `deleteMasterRow`) menulis satu baris ke D1 tanpa mengganti seluruh tabel. UI dashboard memakai modal satu baris + tombol Unggah CSV (parse di klien, tulis lewat RPC). Aksi BA Pelaksanaan scroll ke panel sesi Bagian yang sudah ada dengan prefill kategori.

**Tech Stack:** Cloudflare Workers, Hono, D1, Vitest + `@cloudflare/vitest-pool-workers`, Vue 3 (runtime CDN) di `dashboard.html`, `@vue/compiler-dom` untuk tes template.

## Global Constraints

- Tidak mengubah skema D1. Tabel `mahasiswa` tetap `(npm TEXT PRIMARY KEY, nama_lengkap, email, blok, keterangan)`.
- Semua RPC baru memanggil `requireAdmin(db, ctx.token)` lebih dulu.
- UI memakai RPC per-baris; RPC replace-all lama (`saveMasterKegiatan`, dll.) tidak dipanggil UI baru dan tidak dihapus.
- CSV Mahasiswa hanya kolom `NPM` dan `Nama Lengkap`; kolom lain diabaikan.
- Config: tidak boleh dihapus (UI maupun RPC).
- Password Admin/Staff: field kosong saat update = hash lama tidak diubah.
- Tidak ada build Tailwind: setiap utility class yang dipakai harus ada di blok `<style>` inline `dashboard.html`.
- Tanpa komentar kode baru.
- Commit trailer: `Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>`.
- Perintah dijalankan dari `new-code1-cf/`: `npx vitest run <file>`.
- Git dijalankan dari `/workspace`.

---

### Task 1: RPC `saveMahasiswa` dan `deleteMahasiswa`

**Files:**
- Modify: `new-code1-cf/src/write/master.js` (tambah di akhir file, setelah `saveBagianBaSettings`)
- Test: `new-code1-cf/test/write-master-rows.test.js` (create)

**Interfaces:**
- Consumes: `requireAdmin` dari `../session.js`; helper `str` yang sudah ada di `master.js`.
- Produces:
  - `saveMahasiswa(db, payload, ctx) => Promise<{success:boolean, message:string}>` — `payload = { row: { npm, namaLengkap, email, blok, keterangan, mode } }`, `mode` = `'insert'|'update'`.
  - `deleteMahasiswa(db, npm, ctx) => Promise<{success:boolean, message:string}>`

- [ ] **Step 1: Write the failing test**

Create `new-code1-cf/test/write-master-rows.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveMahasiswa, deleteMahasiswa } from '../src/write/master.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }) };
}

describe('saveMahasiswa', () => {
  it('rejects writes without an admin token', async () => {
    await expect(saveMahasiswa(env.DB, { row: { npm: '1', mode: 'insert' } }, {})).rejects.toThrow();
    await expect(deleteMahasiswa(env.DB, '1', {})).rejects.toThrow();
  });

  it('inserts a new mahasiswa', async () => {
    const res = await saveMahasiswa(env.DB, {
      row: { npm: '9900000001', namaLengkap: 'Baru Satu', email: 'b@x.id', blok: 'A', keterangan: 'baru', mode: 'insert' }
    }, await adminCtx());
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT * FROM mahasiswa WHERE npm = ?1').bind('9900000001').first();
    expect(row.nama_lengkap).toBe('Baru Satu');
    expect(row.email).toBe('b@x.id');
  });

  it('rejects insert when NPM already exists', async () => {
    const ctx = await adminCtx();
    const res = await saveMahasiswa(env.DB, { row: { npm: '9900000001', namaLengkap: 'Dobel', mode: 'insert' } }, ctx);
    expect(res.success).toBe(false);
    const row = await env.DB.prepare('SELECT nama_lengkap FROM mahasiswa WHERE npm = ?1').bind('9900000001').first();
    expect(row.nama_lengkap).toBe('Baru Satu');
  });

  it('updates an existing mahasiswa and rejects missing NPM on update', async () => {
    const ctx = await adminCtx();
    const ok = await saveMahasiswa(env.DB, {
      row: { npm: '9900000001', namaLengkap: 'Diubah', email: '', blok: '', keterangan: '', mode: 'update' }
    }, ctx);
    expect(ok.success).toBe(true);
    const row = await env.DB.prepare('SELECT nama_lengkap, email FROM mahasiswa WHERE npm = ?1').bind('9900000001').first();
    expect(row.nama_lengkap).toBe('Diubah');
    expect(row.email).toBe('');
    const miss = await saveMahasiswa(env.DB, { row: { npm: '0000000000', namaLengkap: 'X', mode: 'update' } }, ctx);
    expect(miss.success).toBe(false);
  });

  it('rejects empty NPM', async () => {
    const res = await saveMahasiswa(env.DB, { row: { npm: '  ', mode: 'insert' } }, await adminCtx());
    expect(res.success).toBe(false);
  });
});

describe('deleteMahasiswa', () => {
  it('deletes an existing row and rejects a missing one', async () => {
    const ctx = await adminCtx();
    const ok = await deleteMahasiswa(env.DB, '9900000001', ctx);
    expect(ok.success).toBe(true);
    expect(await env.DB.prepare('SELECT npm FROM mahasiswa WHERE npm = ?1').bind('9900000001').first()).toBeNull();
    const miss = await deleteMahasiswa(env.DB, '9900000001', ctx);
    expect(miss.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/write-master-rows.test.js`
Expected: FAIL — `saveMahasiswa is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `new-code1-cf/src/write/master.js`:

```js
export async function saveMahasiswa(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const row = (payload && payload.row) || {};
  const npm = str(row.npm !== undefined ? row.npm : row.NPM);
  if (!npm) return { success: false, message: 'NPM wajib diisi.' };
  const mode = str(row.mode) === 'update' ? 'update' : 'insert';
  const nama = str(row.namaLengkap !== undefined ? row.namaLengkap : row['Nama Lengkap']);
  const email = str(row.email !== undefined ? row.email : row.Email);
  const blok = str(row.blok !== undefined ? row.blok : row.Blok);
  const keterangan = str(row.keterangan !== undefined ? row.keterangan : row.Keterangan);
  const existing = await db.prepare('SELECT npm FROM mahasiswa WHERE npm = ?1').bind(npm).first();
  if (mode === 'insert') {
    if (existing) return { success: false, message: 'NPM ' + npm + ' sudah ada.' };
    await db.prepare('INSERT INTO mahasiswa (npm, nama_lengkap, email, blok, keterangan) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(npm, nama, email, blok, keterangan).run();
    return { success: true, message: 'Mahasiswa ditambahkan.' };
  }
  if (!existing) return { success: false, message: 'NPM ' + npm + ' tidak ditemukan.' };
  await db.prepare('UPDATE mahasiswa SET nama_lengkap = ?2, email = ?3, blok = ?4, keterangan = ?5 WHERE npm = ?1')
    .bind(npm, nama, email, blok, keterangan).run();
  return { success: true, message: 'Mahasiswa diperbarui.' };
}

export async function deleteMahasiswa(db, npm, ctx) {
  await requireAdmin(db, ctx.token);
  const key = str(npm);
  if (!key) return { success: false, message: 'NPM wajib diisi.' };
  const existing = await db.prepare('SELECT npm FROM mahasiswa WHERE npm = ?1').bind(key).first();
  if (!existing) return { success: false, message: 'NPM ' + key + ' tidak ditemukan.' };
  await db.prepare('DELETE FROM mahasiswa WHERE npm = ?1').bind(key).run();
  return { success: true, message: 'Mahasiswa dihapus.' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/write-master-rows.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/write/master.js new-code1-cf/test/write-master-rows.test.js
git commit -m "feat(new-code1-cf): add per-row save/delete mahasiswa RPC"
```

---

### Task 2: RPC `importMahasiswaCsv`

**Files:**
- Modify: `new-code1-cf/src/write/master.js`
- Test: `new-code1-cf/test/write-master-rows.test.js`

**Interfaces:**
- Consumes: `requireAdmin`, `str`, `MAX_ROWS` (sudah ada).
- Produces: `importMahasiswaCsv(db, payload, ctx) => Promise<{success:boolean, message:string, inserted?:number, updated?:number, skipped?:number}>` — `payload = { rows: [{ npm, namaLengkap }] }`.

- [ ] **Step 1: Write the failing test**

Append to `new-code1-cf/test/write-master-rows.test.js`:

```js
import { importMahasiswaCsv } from '../src/write/master.js';

describe('importMahasiswaCsv', () => {
  it('inserts new NPM and updates existing NPM, keeping other columns', async () => {
    const ctx = await adminCtx();
    await env.DB.prepare("INSERT INTO mahasiswa (npm, nama_lengkap, email, blok, keterangan) VALUES ('8800000001','Lama','lama@x.id','Z','note')").run();
    const res = await importMahasiswaCsv(env.DB, {
      rows: [
        { npm: '8800000001', namaLengkap: 'Nama Baru' },
        { npm: '8800000002', namaLengkap: 'Siswa Dua' }
      ]
    }, ctx);
    expect(res.success).toBe(true);
    expect(res.inserted).toBe(1);
    expect(res.updated).toBe(1);
    const kept = await env.DB.prepare('SELECT * FROM mahasiswa WHERE npm = ?1').bind('8800000001').first();
    expect(kept.nama_lengkap).toBe('Nama Baru');
    expect(kept.email).toBe('lama@x.id');
    expect(kept.blok).toBe('Z');
    expect(kept.keterangan).toBe('note');
    const fresh = await env.DB.prepare('SELECT * FROM mahasiswa WHERE npm = ?1').bind('8800000002').first();
    expect(fresh.email).toBe('');
    expect(fresh.blok).toBe('');
  });

  it('skips blank NPM and rejects duplicate NPM in the file', async () => {
    const ctx = await adminCtx();
    const res = await importMahasiswaCsv(env.DB, {
      rows: [{ npm: '', namaLengkap: 'Kosong' }, { npm: '8800000003', namaLengkap: 'Tiga' }]
    }, ctx);
    expect(res.success).toBe(true);
    expect(res.skipped).toBe(1);
    const dup = await importMahasiswaCsv(env.DB, {
      rows: [{ npm: '8800000004', namaLengkap: 'A' }, { npm: '8800000004', namaLengkap: 'B' }]
    }, ctx);
    expect(dup.success).toBe(false);
    expect(await env.DB.prepare('SELECT npm FROM mahasiswa WHERE npm = ?1').bind('8800000004').first()).toBeNull();
  });

  it('rejects an empty payload', async () => {
    const res = await importMahasiswaCsv(env.DB, { rows: [] }, await adminCtx());
    expect(res.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/write-master-rows.test.js`
Expected: FAIL — `importMahasiswaCsv is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `new-code1-cf/src/write/master.js`:

```js
export async function importMahasiswaCsv(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const list = Array.isArray(payload && payload.rows) ? payload.rows : [];
  const guard = tooMany(list);
  if (guard) return guard;
  const parsed = [];
  const seen = new Set();
  let skipped = 0;
  for (const raw of list) {
    const npm = str(raw && (raw.npm !== undefined ? raw.npm : raw.NPM));
    if (!npm) { skipped++; continue; }
    if (seen.has(npm)) return { success: false, message: 'NPM duplikat di file: ' + npm };
    seen.add(npm);
    const nama = str(raw && (raw.namaLengkap !== undefined ? raw.namaLengkap : raw['Nama Lengkap']));
    parsed.push({ npm: npm, nama: nama });
  }
  if (!parsed.length) return { success: false, message: 'Tidak ada baris valid pada CSV.' };
  const existingRows = (await db.prepare('SELECT npm FROM mahasiswa').all()).results || [];
  const existing = new Set(existingRows.map((r) => String(r.npm)));
  const statements = [];
  let inserted = 0;
  let updated = 0;
  for (const row of parsed) {
    if (existing.has(row.npm)) {
      statements.push(db.prepare('UPDATE mahasiswa SET nama_lengkap = ?2 WHERE npm = ?1').bind(row.npm, row.nama));
      updated++;
    } else {
      statements.push(db.prepare("INSERT INTO mahasiswa (npm, nama_lengkap, email, blok, keterangan) VALUES (?1, ?2, '', '', '')").bind(row.npm, row.nama));
      inserted++;
    }
  }
  await db.batch(statements);
  return {
    success: true,
    message: 'Impor selesai: ' + inserted + ' baru, ' + updated + ' diperbarui.',
    inserted: inserted,
    updated: updated,
    skipped: skipped
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/write-master-rows.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/write/master.js new-code1-cf/test/write-master-rows.test.js
git commit -m "feat(new-code1-cf): add mahasiswa CSV upsert RPC"
```

---

### Task 3: RPC generik `saveMasterRow` dan `deleteMasterRow`

**Files:**
- Modify: `new-code1-cf/src/write/master.js`
- Test: `new-code1-cf/test/write-master-rows.test.js`

**Interfaces:**
- Consumes: `requireAdmin`, `pick`, `str`, `isHashed`, `hashPassword`.
- Produces:
  - `saveMasterRow(db, payload, ctx) => Promise<{success:boolean, message:string}>` — `payload = { table, row }`.
  - `deleteMasterRow(db, payload, ctx) => Promise<{success:boolean, message:string}>` — `payload = { table, id }`.
- Tabel yang diizinkan: `master_kegiatan`, `master_bagian`, `master_biaya`, `config`, `bagian_staff`, `admin`.

- [ ] **Step 1: Write the failing test**

Append to `new-code1-cf/test/write-master-rows.test.js`:

```js
import { saveMasterRow, deleteMasterRow } from '../src/write/master.js';

describe('saveMasterRow and deleteMasterRow', () => {
  it('inserts and updates a master_kegiatan row by id', async () => {
    const ctx = await adminCtx();
    const ins = await saveMasterRow(env.DB, { table: 'master_kegiatan', row: { Kategori: 'Blok', Nilai: 'C' } }, ctx);
    expect(ins.success).toBe(true);
    const row = await env.DB.prepare("SELECT * FROM master_kegiatan WHERE nilai = 'C'").first();
    const upd = await saveMasterRow(env.DB, { table: 'master_kegiatan', row: { id: row.id, Kategori: 'Blok', Nilai: 'D' } }, ctx);
    expect(upd.success).toBe(true);
    const after = await env.DB.prepare('SELECT nilai FROM master_kegiatan WHERE id = ?1').bind(row.id).first();
    expect(after.nilai).toBe('D');
  });

  it('rejects unknown tables and empty rows', async () => {
    const ctx = await adminCtx();
    expect((await saveMasterRow(env.DB, { table: 'pengajuan', row: { npm: '1' } }, ctx)).success).toBe(false);
    expect((await saveMasterRow(env.DB, { table: 'master_kegiatan', row: {} }, ctx)).success).toBe(false);
  });

  it('inserts config and rejects duplicate key, never deletes config', async () => {
    const ctx = await adminCtx();
    const ins = await saveMasterRow(env.DB, { table: 'config', row: { Key: 'TEMA', Value: 'indigo' } }, ctx);
    expect(ins.success).toBe(true);
    const dup = await saveMasterRow(env.DB, { table: 'config', row: { Key: 'tema', Value: 'x' } }, ctx);
    expect(dup.success).toBe(false);
    const cfg = await env.DB.prepare("SELECT * FROM config WHERE key = 'TEMA'").first();
    const del = await deleteMasterRow(env.DB, { table: 'config', id: cfg.id }, ctx);
    expect(del.success).toBe(false);
  });

  it('keeps the old password when the field is blank on update', async () => {
    const ctx = await adminCtx();
    await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('pbkdf2$1000$YQ==$YQ==','Admin Lama')").run();
    const row = await env.DB.prepare('SELECT * FROM admin ORDER BY id DESC LIMIT 1').first();
    const upd = await saveMasterRow(env.DB, { table: 'admin', row: { id: row.id, Password: '', Nama: 'Admin Tetap' } }, ctx);
    expect(upd.success).toBe(true);
    const after = await env.DB.prepare('SELECT password, nama FROM admin WHERE id = ?1').bind(row.id).first();
    expect(after.password).toBe('pbkdf2$1000$YQ==$YQ==');
    expect(after.nama).toBe('Admin Tetap');
  });

  it('hashes a new password on update', async () => {
    const ctx = await adminCtx();
    const row = await env.DB.prepare('SELECT * FROM admin ORDER BY id DESC LIMIT 1').first();
    const upd = await saveMasterRow(env.DB, { table: 'admin', row: { id: row.id, Password: 'rahasia2', Nama: 'Admin' } }, ctx);
    expect(upd.success).toBe(true);
    const after = await env.DB.prepare('SELECT password FROM admin WHERE id = ?1').bind(row.id).first();
    expect(after.password).toMatch(/^pbkdf2\$/);
  });

  it('deletes a non-config row and rejects a missing id', async () => {
    const ctx = await adminCtx();
    const row = await env.DB.prepare("SELECT * FROM master_kegiatan WHERE nilai = 'D'").first();
    const ok = await deleteMasterRow(env.DB, { table: 'master_kegiatan', id: row.id }, ctx);
    expect(ok.success).toBe(true);
    const miss = await deleteMasterRow(env.DB, { table: 'master_kegiatan', id: 999999 }, ctx);
    expect(miss.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/write-master-rows.test.js`
Expected: FAIL — `saveMasterRow is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `new-code1-cf/src/write/master.js` (letakkan tabel konstanta di atas fungsi):

```js
const MASTER_TABLES = {
  master_kegiatan: {
    cols: [['kategori', ['Kategori', 'kategori']], ['nilai', ['Nilai', 'nilai']]]
  },
  master_bagian: {
    cols: [
      ['lab', ['Lab', 'lab']],
      ['kegiatan_lab', ['Kegiatan Lab', 'KegiatanLab', 'kegiatanLab', 'kegiatan_lab']],
      ['bagian', ['Bagian', 'bagian']],
      ['email', ['Email', 'email']]
    ]
  },
  master_biaya: {
    cols: [['kegiatan', ['Kegiatan', 'kegiatan']], ['biaya', ['Biaya', 'biaya']]]
  },
  config: {
    cols: [['key', ['Key', 'key']], ['value', ['Value', 'value']]]
  },
  bagian_staff: {
    cols: [
      ['email', ['Email', 'email']], ['kategori', ['Kategori', 'kategori']],
      ['nama', ['Nama', 'nama']], ['pass', ['Pass', 'pass', 'Password', 'password']]
    ],
    passwordCol: 'pass',
    uniqueCol: 'email'
  },
  admin: {
    cols: [['password', ['Password', 'password', 'Email', 'email']], ['nama', ['Nama', 'nama']]],
    passwordCol: 'password'
  }
};

async function rejectDuplicate(db, table, spec, mapped, id) {
  if (!spec.uniqueCol) return null;
  const value = mapped[spec.uniqueCol];
  if (!value) return null;
  const found = await db.prepare('SELECT id FROM ' + table + ' WHERE lower(' + spec.uniqueCol + ') = lower(?1)').bind(value).first();
  if (found && Number(found.id) !== Number(id)) {
    return { success: false, message: 'Nilai ' + value + ' sudah ada.' };
  }
  return null;
}

export async function saveMasterRow(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const table = str(payload && payload.table);
  const spec = MASTER_TABLES[table];
  if (!spec) return { success: false, message: 'Tabel tidak dikenal.' };
  const raw = (payload && payload.row) || {};
  const mapped = {};
  let filled = false;
  for (const [field, keys] of spec.cols) {
    const value = pick(raw, keys);
    mapped[field] = value;
    if (value !== '') filled = true;
  }
  if (!filled) return { success: false, message: 'Baris kosong.' };
  const id = Number(raw.id) || 0;
  if (spec.passwordCol) {
    const pw = mapped[spec.passwordCol];
    if (pw && !isHashed(pw)) mapped[spec.passwordCol] = await hashPassword(pw);
  }
  if (table === 'config') {
    const key = mapped.key;
    if (!key) return { success: false, message: 'Key wajib diisi.' };
    if (id) {
      const exists = await db.prepare('SELECT id FROM config WHERE id = ?1').bind(id).first();
      if (!exists) return { success: false, message: 'Config tidak ditemukan.' };
      const dup = await db.prepare('SELECT id FROM config WHERE lower(key) = lower(?1) AND id != ?2').bind(key, id).first();
      if (dup) return { success: false, message: 'Key ' + key + ' sudah ada.' };
      await db.prepare('UPDATE config SET key = ?2, value = ?3 WHERE id = ?1').bind(id, key, mapped.value).run();
      return { success: true, message: 'Config diperbarui.' };
    }
    const found = await db.prepare('SELECT id FROM config WHERE lower(key) = lower(?1)').bind(key).first();
    if (found) return { success: false, message: 'Key ' + key + ' sudah ada.' };
    await db.prepare('INSERT INTO config (key, value) VALUES (?1, ?2)').bind(key, mapped.value).run();
    return { success: true, message: 'Config ditambahkan.' };
  }
  const dupRow = await rejectDuplicate(db, table, spec, mapped, id);
  if (dupRow) return dupRow;
  if (id) {
    const exists = await db.prepare('SELECT id FROM ' + table + ' WHERE id = ?1').bind(id).first();
    if (!exists) return { success: false, message: 'Baris tidak ditemukan.' };
    const fields = spec.cols
      .map(([field]) => field)
      .filter((field) => !(spec.passwordCol === field && mapped[field] === ''));
    const sets = fields.map((field, i) => field + ' = ?' + (i + 2)).join(', ');
    const values = fields.map((field) => mapped[field]);
    await db.prepare('UPDATE ' + table + ' SET ' + sets + ' WHERE id = ?1').bind(id, ...values).run();
    return { success: true, message: 'Baris diperbarui.' };
  }
  const cols = spec.cols.map(([field]) => field);
  const values = cols.map((field) => mapped[field]);
  const placeholders = cols.map((_, i) => '?' + (i + 1)).join(', ');
  await db.prepare('INSERT INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + placeholders + ')').bind(...values).run();
  return { success: true, message: 'Baris ditambahkan.' };
}

export async function deleteMasterRow(db, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const table = str(payload && payload.table);
  if (table === 'config') return { success: false, message: 'Config tidak boleh dihapus.' };
  const spec = MASTER_TABLES[table];
  if (!spec) return { success: false, message: 'Tabel tidak dikenal.' };
  const id = Number(payload && payload.id) || 0;
  if (!id) return { success: false, message: 'ID tidak valid.' };
  const exists = await db.prepare('SELECT id FROM ' + table + ' WHERE id = ?1').bind(id).first();
  if (!exists) return { success: false, message: 'Baris tidak ditemukan.' };
  await db.prepare('DELETE FROM ' + table + ' WHERE id = ?1').bind(id).run();
  return { success: true, message: 'Baris dihapus.' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/write-master-rows.test.js`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/write/master.js new-code1-cf/test/write-master-rows.test.js
git commit -m "feat(new-code1-cf): add generic per-row master RPC"
```

---

### Task 4: `getMasterDataMonitor` menyertakan `mahasiswa`

**Files:**
- Modify: `new-code1-cf/src/read/dashboard.js:323-335`
- Test: `new-code1-cf/test/write-master-rows.test.js`

**Interfaces:**
- Consumes: `toClientRows('mahasiswa', rows)`.
- Produces: `getMasterDataMonitor(...).mahasiswa` = array baris `{ NPM, 'Nama Lengkap', Email, Blok, Keterangan }`.

- [ ] **Step 1: Write the failing test**

Append to `new-code1-cf/test/write-master-rows.test.js`:

```js
import { getMasterDataMonitor } from '../src/read/dashboard.js';

describe('getMasterDataMonitor mahasiswa', () => {
  it('includes mahasiswa mapped to client columns', async () => {
    await env.DB.prepare("INSERT INTO mahasiswa (npm, nama_lengkap, email, blok, keterangan) VALUES ('7700000001','Uji Map','u@x.id','B','ket')").run();
    const data = await getMasterDataMonitor(env.DB, await adminCtx());
    const row = data.mahasiswa.find((r) => r.NPM === '7700000001');
    expect(row['Nama Lengkap']).toBe('Uji Map');
    expect(row.Email).toBe('u@x.id');
    expect(row.Blok).toBe('B');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/write-master-rows.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'find')` because `data.mahasiswa` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `new-code1-cf/src/read/dashboard.js`, add `mahasiswa` to the object returned by `getMasterDataMonitor`:

```js
  return {
    mahasiswa: toClientRows('mahasiswa', await all('mahasiswa')),
    masterKegiatan: toClientRows('master_kegiatan', await all('master_kegiatan')),
    masterBagian: toClientRows('master_bagian', await all('master_bagian')),
    masterBiaya: toClientRows('master_biaya', await all('master_biaya')),
    config: toClientRows('config', await all('config')),
    bagianStaff: toClientRows('bagian_staff', await all('bagian_staff')),
    admin: toClientRows('admin', await all('admin')),
    bagianSettings: await getBagianBaSettings(db)
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/write-master-rows.test.js`
Expected: PASS (16 tests).

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/read/dashboard.js new-code1-cf/test/write-master-rows.test.js
git commit -m "feat(new-code1-cf): include mahasiswa in master monitor"
```

---

### Task 5: Wire RPC handlers

**Files:**
- Modify: `new-code1-cf/src/rpc.js`
- Test: `new-code1-cf/test/rpc.test.js`

**Interfaces:**
- Consumes: fungsi dari Task 1-3.
- Produces: handler RPC bernama `saveMahasiswa`, `deleteMahasiswa`, `importMahasiswaCsv`, `saveMasterRow`, `deleteMasterRow`.

- [ ] **Step 1: Write the failing test**

Append to `new-code1-cf/test/rpc.test.js`:

```js
  it('dispatches the new master row RPCs', async () => {
    const sess = await dispatchRpc(env.DB, 'authenticateAdmin', ['rahasia']);
    const token = sess.token;
    const save = await dispatchRpc(env.DB, 'saveMahasiswa', [{ row: { npm: '6600000001', namaLengkap: 'RPC Test', mode: 'insert' } }, token]);
    expect(save.success).toBe(true);
    const csv = await dispatchRpc(env.DB, 'importMahasiswaCsv', [{ rows: [{ npm: '6600000002', namaLengkap: 'CSV Test' }] }, token]);
    expect(csv.success).toBe(true);
    const master = await dispatchRpc(env.DB, 'saveMasterRow', [{ table: 'master_biaya', row: { Kegiatan: 'KKD', Biaya: 'Rp 1' } }, token]);
    expect(master.success).toBe(true);
    const del = await dispatchRpc(env.DB, 'deleteMahasiswa', ['6600000001', token]);
    expect(del.success).toBe(true);
  });
```

Catatan: `rpc.test.js` sebelumnya menyisipkan admin `'rahasia'` di test lain dengan `admin` yang sama; pengujian ini membuat admin baru agar mandiri:

Tambahkan tepat sebelum baris `it('dispatches the new master row RPCs'` di atas:

```js
  it('sets up an admin for row RPC tests', async () => {
    await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('rahasia','Admin')").run();
    expect(true).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/rpc.test.js`
Expected: FAIL — `Fitur saveMahasiswa belum tersedia...` (`success` undefined).

- [ ] **Step 3: Write minimal implementation**

In `new-code1-cf/src/rpc.js`, extend the import from `./write/master.js`:

```js
import {
  saveMasterKegiatan, saveMasterBagian, saveMasterBiaya, saveConfig,
  saveBagianStaff, saveAdminList, saveBagianBaSettings,
  saveMahasiswa, deleteMahasiswa, importMahasiswaCsv, saveMasterRow, deleteMasterRow
} from './write/master.js';
```

Add handlers inside `HANDLERS` (setelah `saveBagianBaSettings`):

```js
  saveMahasiswa: (db, args, ctx) => saveMahasiswa(db, args[0], ctx),
  deleteMahasiswa: (db, args, ctx) => deleteMahasiswa(db, args[0], ctx),
  importMahasiswaCsv: (db, args, ctx) => importMahasiswaCsv(db, args[0], ctx),
  saveMasterRow: (db, args, ctx) => saveMasterRow(db, args[0], ctx),
  deleteMasterRow: (db, args, ctx) => deleteMasterRow(db, args[0], ctx),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/rpc.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/rpc.js new-code1-cf/test/rpc.test.js
git commit -m "feat(new-code1-cf): wire master row and mahasiswa RPC handlers"
```

---

### Task 6: BA Pelaksanaan — hapus tombol header, prefill + scroll, warna emerald

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Test: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Consumes: `bab.showPanel`, `loadBagian()`, `bab.kategori`, `bab.subBagian`, `babLabOptions`.
- Produces: `openPelaksanaanPanel(row)` menerima baris unit; `catWhere (behavioural)` id panel `#bab-panel` untuk `scrollIntoView`.

- [ ] **Step 1: Write the failing test**

In `new-code1-cf/test/dashboard-template.test.js`, update the marker test and add a new one. Replace the assertion `expect(html).toContain('Unggah BA Pelaksanaan');` (still valid for Aksi buttons) and add:

```js
  it('removes the header Pelaksanaan button and uses emerald for the row action', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('<i class="bi bi-journal-check"></i> Unggah BA Pelaksanaan');
    expect(html).toContain('class="btn-emerald !px-2 !py-1 text-[11px]" @click="openPelaksanaanPanel(r)"');
    expect(html).toContain('id="bab-panel"');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/dashboard-template.test.js`
Expected: FAIL — header button still present / no `btn-emerald` / no `#bab-panel`.

- [ ] **Step 3: Write minimal implementation**

3a. Tambah CSS `btn-emerald` di blok `<style>` inline pertama (dekat `.btn-soft`, sekitar baris 33):

```css
        .btn-emerald { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; border-radius: .75rem; background: #059669; padding: .625rem 1rem; font-size: .875rem; font-weight: 600; color: #fff; transition: background .15s ease; box-shadow: 0 1px 2px rgba(15,23,42,.12); }
        .btn-emerald:hover { background: #047857; }
```

3b. Hapus tombol header Pelaksanaan di sekitar baris 530:

```html
                            <button class="btn-soft !py-2 text-xs" @click="openPelaksanaanPanel()"><i class="bi bi-journal-check"></i> Unggah BA Pelaksanaan</button>
```

3c. Ganti kedua tombol Aksi `Unggah Pelaksanaan` (baris 674 dan 729) menjadi:

```html
                                                        <button v-else-if="!r.__orphan && unitPelaksanaanEligible(r) && !unitHasPelaksanaan(r)" class="btn-emerald !px-2 !py-1 text-[11px]" @click="openPelaksanaanPanel(r)">Unggah Pelaksanaan</button>
```

(Pada blok mobile baris 729 indentasinya satu tingkat lebih kecil; sesuaikan tetapi kelas dan `@click` sama.)

3d. Tambahkan `id="bab-panel"` pada div panel sekitar baris 736:

```html
                    <div v-if="tab==='ba' && bab.showPanel" id="bab-panel" class="mt-6">
```

3e. Ganti isi `openPelaksanaanPanel` (baris 2762-2765) menjadi:

```js
                openPelaksanaanPanel(row) {
                    this.bab.showPanel = true;
                    if (!this.loaded.bagian && !this.bagian.labs.length) this.loadBagian();
                    const bagian = String((row && row.bagian) || '').trim();
                    this.bab.subBagian = '';
                    if (bagian) {
                        const key = this.normBagian(bagian);
                        if (key === this.normBagian('SGD')) this.bab.kategori = 'SGD';
                        else if (key === this.normBagian('KKD')) this.bab.kategori = 'KKD';
                        else if (key === this.normBagian('Ujian')) this.bab.kategori = 'Ujian';
                        else {
                            const labs = this.bagian.labs || [];
                            const lab = labs.find((l) => this.normBagian(l) === key);
                            if (lab) { this.bab.kategori = 'Praktikum'; this.bab.subBagian = lab; }
                            else this.bab.kategori = '';
                        }
                    } else {
                        this.bab.kategori = '';
                    }
                    this.$nextTick(() => {
                        const el = document.getElementById('bab-panel');
                        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                },
```

Catatan: `normBagian` sudah ada di komponen. Bila hasil cocok lab maka `subBagian` diisi; kategori selain 4 nilai di atas dibiarkan kosong.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "fix(new-code1-cf): hide header pelaksanaan and make row action actionable"
```

---

### Task 7: Master Data — kartu Mahasiswa + modal baris + tombol Hapus + impor CSV

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Test: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Consumes: `getMasterDataMonitor` (kini punya `mahasiswa`), RPC Task 5, `this.run`, `askConfirm`, `notify`, `loadMaster`.
- Produces:
  - `master.rowModal` state `{ open, table, key, mode, fields, originalId }`.
  - `openMasterRow(cardKey, row?)`, `saveMasterRow()`, `deleteMasterRow(row)`, `onMahasiswaCsv(e)`, `parseCsv(text)`.

- [ ] **Step 1: Write the failing test**

Append to `new-code1-cf/test/dashboard-template.test.js`:

```js
  it('adds the Mahasiswa master card with CSV upload and row actions', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("key: 'mahasiswa', title: 'Mahasiswa'");
    expect(html).toContain('Unggah CSV');
    expect(html).toContain('@click="openMasterRow(activeMasterCard.key)"');
    expect(html).toContain('@click="deleteMasterRow(r)"');
    expect(html).toContain('onMahasiswaCsv');
    expect(html).toContain("master.rowModal");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/dashboard-template.test.js`
Expected: FAIL — markers absent.

- [ ] **Step 3: Write minimal implementation**

3a. Tambah kartu Mahasiswa paling atas di `master.cards` (baris 1471, sebelum `masterKegiatan`):

```js
                            { key: 'mahasiswa', title: 'Mahasiswa', short: 'Mahasiswa', desc: 'Data mahasiswa (NPM, nama, email, blok, keterangan). Impor massal lewat CSV kolom NPM + Nama Lengkap.', cols: ['NPM', 'Nama Lengkap', 'Email', 'Blok', 'Keterangan'], table: 'mahasiswa', icon: 'bi-mortarboard' },
```

Tambahkan juga `table` pada kartu tabel lain agar tombol Aksi tahu target: `masterKegiatan` → `table: 'master_kegiatan'`, `masterBagian` → `'master_bagian'`, `masterBiaya` → `'master_biaya'`, `config` → `'config'`, `bagianStaff` → `'bagian_staff'`, `admin` → `'admin'`.

3b. Tambah state `rowModal` di `master` state (setelah `search: ''`, baris 1470):

```js
                        rowModal: { open: false, table: '', cardKey: '', mode: 'insert', fields: {}, originalId: 0 },
```

3c. Header kartu: tambah tombol Unggah CSV (khusus mahasiswa) dan tombol Tambah, ganti tombol Edit lama. Di sekitar baris 1004-1010, ganti blok `<div v-if="!activeMasterCard.settings" ...>` menjadi:

```html
                                <div v-if="!activeMasterCard.settings" class="flex flex-wrap items-center gap-2">
                                    <div class="master-search">
                                        <i class="bi bi-search"></i>
                                        <input v-model="master.search" type="text" class="input" placeholder="Cari..." />
                                    </div>
                                    <label v-if="activeMasterCard.key === 'mahasiswa'" class="btn-soft !px-3 !py-1.5 text-xs whitespace-nowrap cursor-pointer">
                                        <i class="bi bi-upload"></i> Unggah CSV
                                        <input type="file" accept=".csv,text/csv" class="hidden" @change="onMahasiswaCsv">
                                    </label>
                                    <button class="btn-primary !px-3 !py-1.5 text-xs whitespace-nowrap" @click="openMasterRow(activeMasterCard.key)"><i class="bi bi-plus-lg"></i> Tambah</button>
                                </div>
```

3d. Kolom Aksi pada tabel (baris 1015-1027): tambah `<th class="px-5 py-3 font-semibold w-24">Aksi</th>` dan ubah baris data:

```html
                                        <tr v-for="(r,i) in activeMasterRows" class="border-t border-slate-50">
                                            <td v-for="c in activeMasterCard.cols" class="px-5 py-2.5 text-slate-600">{{ masterCellValue(r, c) }}</td>
                                            <td class="px-5 py-2.5">
                                                <div class="flex items-center gap-1">
                                                    <button class="master-row-btn" title="Ubah" @click="openMasterRow(activeMasterCard.key, r)"><i class="bi bi-pencil"></i></button>
                                                    <button v-if="activeMasterCard.key !== 'config'" class="master-row-btn danger" title="Hapus" @click="deleteMasterRow(r)"><i class="bi bi-trash"></i></button>
                                                </div>
                                            </td>
                                        </tr>
```

3e. Tambah modal baris sebelum `<!-- ============ MODAL: UPLOAD BA ============ -->` (baris 1329):

```html
        <transition name="fade">
            <div v-if="master.rowModal.open" class="fixed inset-0 z-50 modal-overlay">
                <div class="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" @click="master.rowModal.open=false"></div>
                <transition name="pop" appear>
                    <div class="modal-panel max-w-xl shadow-lift">
                        <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                            <h3 class="text-sm font-bold text-slate-900">{{ master.rowModal.mode === 'update' ? 'Ubah' : 'Tambah' }} {{ master.rowModal.title }}</h3>
                            <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" @click="master.rowModal.open=false"><i class="bi bi-x-lg"></i></button>
                        </div>
                        <div class="modal-body px-6 py-4 space-y-3">
                            <div v-for="c in master.rowModal.cols" :key="c">
                                <label class="label">{{ c }}</label>
                                <input v-model="master.rowModal.fields[c]" class="input" :disabled="master.rowModal.mode === 'update' && master.rowModal.disabled.includes(c)" :placeholder="c">
                            </div>
                        </div>
                        <div class="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-3.5">
                            <button class="btn-soft" @click="master.rowModal.open=false">Batal</button>
                            <button class="btn-primary" :disabled="master.saving" @click="saveMasterRow()"><i class="bi bi-save"></i> Simpan</button>
                        </div>
                    </div>
                </transition>
            </div>
        </transition>
```

3f. Tambah CSS `master-row-btn` di blok style inline pertama (`.hidden` sudah ada di CSS terkompilasi):

```css
        .master-row-btn { display: inline-flex; align-items: center; justify-content: center; height: 1.9rem; width: 1.9rem; border-radius: .5rem; color: #64748b; transition: all .15s ease; }
        .master-row-btn:hover { background: #eef2ff; color: #4f46e5; }
        .master-row-btn.danger:hover { background: #fff1f2; color: #e11d48; }
```

3g. Tambah state `saving` di `master` (bila belum ada — sudah ada `saving: false`), dan `title`, `cols`, `disabled` pada `rowModal`. Update inisialisasi state `rowModal` menjadi:

```js
                        rowModal: { open: false, table: '', cardKey: '', title: '', cols: [], disabled: [], mode: 'insert', fields: {}, originalId: 0 },
```

3h. Tambah method di bagian `// ---------- master ----------` (setelah `masterCount`):

```js
                openMasterRow(cardKey, row) {
                    const card = this.master.cards.find((c) => c.key === cardKey);
                    if (!card) return;
                    const fields = {};
                    card.cols.forEach((c) => { fields[c] = row ? String(row[c] === undefined || row[c] === null ? '' : row[c]) : ''; });
                    const isUpdate = !!row;
                    const disabled = [];
                    if (isUpdate && cardKey === 'mahasiswa') disabled.push('NPM');
                    if (isUpdate && cardKey === 'config') disabled.push('Key');
                    this.master.rowModal = {
                        open: true,
                        table: card.table,
                        cardKey: cardKey,
                        title: card.title,
                        cols: (card.cols || []).slice(),
                        disabled: disabled,
                        mode: isUpdate ? 'update' : 'insert',
                        fields: fields,
                        originalId: row && row.id ? row.id : 0
                    };
                },
                async saveMasterRow() {
                    const rm = this.master.rowModal;
                    const row = Object.assign({}, rm.fields);
                    if (rm.originalId) row.id = rm.originalId;
                    this.master.saving = true;
                    try {
                        let res;
                        if (rm.table === 'mahasiswa') {
                            res = await this.run('saveMahasiswa', {
                                row: {
                                    npm: String(rm.fields.NPM || '').trim(),
                                    namaLengkap: String(rm.fields['Nama Lengkap'] || '').trim(),
                                    email: String(rm.fields.Email || '').trim(),
                                    blok: String(rm.fields.Blok || '').trim(),
                                    keterangan: String(rm.fields.Keterangan || '').trim(),
                                    mode: rm.mode
                                }
                            });
                        } else {
                            res = await this.run('saveMasterRow', { table: rm.table, row: row });
                        }
                        if (res && res.success === false) { this.notify((res && res.message) || 'Gagal menyimpan.', false); return; }
                        this.notify((res && res.message) || 'Disimpan.');
                        this.master.rowModal.open = false;
                        await this.loadMaster();
                    } catch (e) {
                        this.notify('Gagal: ' + e, false);
                    } finally {
                        this.master.saving = false;
                    }
                },
                async deleteMasterRow(row) {
                    const card = this.activeMasterCard;
                    const isMhs = card.key === 'mahasiswa';
                    const label = isMhs ? (row.NPM + ' - ' + row['Nama Lengkap']) : this.masterCellValue(row, card.cols[0]);
                    const ok = await this.askConfirm({
                        title: 'Hapus data',
                        message: 'Hapus ' + label + '?',
                        tone: 'danger',
                        confirmLabel: 'Hapus'
                    });
                    if (!ok) return;
                    try {
                        const res = isMhs
                            ? await this.run('deleteMahasiswa', row.NPM)
                            : await this.run('deleteMasterRow', { table: card.table, id: row.id });
                        if (res && res.success === false) { this.notify((res && res.message) || 'Gagal menghapus.', false); return; }
                        this.notify((res && res.message) || 'Dihapus.');
                        await this.loadMaster();
                    } catch (e) {
                        this.notify('Gagal: ' + e, false);
                    }
                },
                parseCsv(text) {
                    const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim() !== '');
                    if (!lines.length) return { error: 'CSV kosong.' };
                    const splitLine = (line) => {
                        const out = [];
                        let cur = '';
                        let quoted = false;
                        for (let i = 0; i < line.length; i++) {
                            const ch = line[i];
                            if (quoted) {
                                if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
                                else if (ch === '"') quoted = false;
                                else cur += ch;
                            } else if (ch === '"') quoted = true;
                            else if (ch === ',' || ch === ';') { out.push(cur); cur = ''; }
                            else cur += ch;
                        }
                        out.push(cur);
                        return out.map((v) => v.trim());
                    };
                    const header = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ' '));
                    let npmIdx = header.findIndex((h) => h === 'npm');
                    let namaIdx = header.findIndex((h) => h === 'nama lengkap' || h === 'nama_lengkap' || h === 'nama');
                    if (npmIdx === -1 || namaIdx === -1) return { error: 'Header CSV harus memuat kolom NPM dan Nama Lengkap.' };
                    const rows = [];
                    for (let i = 1; i < lines.length; i++) {
                        const cells = splitLine(lines[i]);
                        rows.push({ npm: String(cells[npmIdx] || '').trim(), namaLengkap: String(cells[namaIdx] || '').trim() });
                    }
                    return { rows: rows };
                },
                async onMahasiswaCsv(e) {
                    const input = e.target;
                    const file = input.files && input.files[0];
                    input.value = '';
                    if (!file) return;
                    let text = '';
                    try {
                        text = await file.text();
                    } catch (err) {
                        this.notify('Gagal membaca file CSV.', false);
                        return;
                    }
                    const parsed = this.parseCsv(text);
                    if (parsed.error) { this.notify(parsed.error, false); return; }
                    const valid = (parsed.rows || []).filter((r) => r.npm);
                    if (!valid.length) { this.notify('Tidak ada baris NPM valid.', false); return; }
                    if (valid.length > 5000) { this.notify('Maksimal 5000 baris.', false); return; }
                    const seen = {};
                    let dup = '';
                    valid.forEach((r) => { if (seen[r.npm]) dup = r.npm; seen[r.npm] = true; });
                    if (dup) { this.notify('NPM duplikat di file: ' + dup, false); return; }
                    const existing = new Set((this.master.data.mahasiswa || []).map((r) => String(r.NPM)));
                    let insert = 0;
                    let update = 0;
                    valid.forEach((r) => { if (existing.has(r.npm)) update++; else insert++; });
                    const ok = await this.askConfirm({
                        title: 'Impor CSV Mahasiswa',
                        message: 'Mengimpor ' + valid.length + ' baris.',
                        details: [insert + ' mahasiswa baru', update + ' mahasiswa diperbarui', (parsed.rows.length - valid.length) + ' baris dilewati (NPM kosong)'],
                        confirmLabel: 'Impor'
                    });
                    if (!ok) return;
                    try {
                        const res = await this.run('importMahasiswaCsv', { rows: valid });
                        if (res && res.success === false) { this.notify((res && res.message) || 'Gagal impor.', false); return; }
                        this.notify((res && res.message) || 'Impor selesai.');
                        await this.loadMaster();
                    } catch (err2) {
                        this.notify('Gagal: ' + err2, false);
                    }
                },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "feat(new-code1-cf): mahasiswa master card with row CRUD and CSV import"
```

---

### Task 8: Dense layout + hapus modal master lama + regresi penuh

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Test: seluruh suite.

**Interfaces:**
- Consumes: state `master.modal` lama dan `editMaster` masih ada tetapi tidak lagi dipanggil UI.
- Produces: tombol Edit lama hilang; tabel lebih rapat.

- [ ] **Step 1: Write the failing test**

Append to `new-code1-cf/test/dashboard-template.test.js`:

```js
  it('removes the old replace-all master editor entrypoint', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('@click="editMaster(activeMasterCard.key)"');
    expect(html).toContain('master-table-dense');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/dashboard-template.test.js`
Expected: FAIL — `master-table-dense` belum ada. (Assertion `editMaster` sudah lolos sejak Task 7.)

- [ ] **Step 3: Write minimal implementation**

3a. Tambah class denser pada tabel master (baris 1013):

```html
                                <table class="master-table master-table-dense w-full text-left text-sm">
```

3b. Tambah CSS denser di blok style inline pertama:

```css
        .master-table-dense th, .master-table-dense td { padding-top: .4rem; padding-bottom: .4rem; }
```

3c. Hapus modal editor lama (blok `<!-- ============ MODAL: MASTER EDITOR ============ -->`, baris 1282-1327) dan method `editMaster`, `addMasterRow`, `removeMasterRow`, `saveEdit` (baris 2960-3001) **hanya jika** tidak ada referensi lain. Cek dulu:

Run: `npx vitest run` — jika ada test lama yang memanggil `saveMasterKegiatan` langsung dari `write/master.js`, itu tetap hijau karena fungsi tidak dihapus.

- [ ] **Step 4: Run full suite**

Run: `npx vitest run`
Expected: PASS semua file.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "refactor(new-code1-cf): remove replace-all master editor and densify tables"
```

---

### Task 9: Verifikasi lint + build + deploy

**Files:**
- Tidak ada perubahan kode.

- [ ] **Step 1: Jalankan seluruh test**

Run: `cd new-code1-cf && npx vitest run`
Expected: PASS semua.

- [ ] **Step 2: Deploy ke worker POC**

Run:
```bash
cd new-code1-cf
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```
Expected: menampilkan `Uploaded ...` dan URL `https://inhal-poc.new-code1-cf.workers.dev`.

- [ ] **Step 3: Verifikasi produksi**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://inhal-poc.new-code1-cf.workers.dev/dashboard
curl -s -o /dev/null -w "%{http_code}\n" https://inhal-poc.new-code1-cf.workers.dev/api/health
```
Expected: `200` dan `200`. Buka dashboard, cek tab Master Data punya kartu Mahasiswa + Unggah CSV, dan tab Berita Acara tidak punya tombol header Pelaksanaan.

---

## Catatan untuk pelaksana

- `masterCellValue` dipakai untuk label tombol Hapus; aman untuk semua kartu karena memakai kolom pertama.
- `toClientRow` mempertahankan `id` dari DB, sehingga `row.id` tersedia untuk update/hapus.
- Config tidak punya `table` unik di form Tambah? Ia punya: kartu `config` diberi `table: 'config'` pada Task 7 Step 3a.
- Bila `normBagian` tidak ada sebagai method terpisah, cek `resolveBaBagian` yang sudah memakai `this.normBagian`.
- Jangan hapus RPC replace-all lama di `rpc.js`; spec melarang.
