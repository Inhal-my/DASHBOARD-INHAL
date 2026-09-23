# Monitoring Kegiatan, Tanggal, dan Berita Acara — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan BA Pelaksanaan sebagai satu-satunya sumber tanggal-waktu dan dosen pelaksanaan, lalu menyajikan rekapitulasi per kegiatan (dengan drill-down mahasiswa) di dashboard dan detail-laporan.

**Architecture:** Tambah kolom `jam`, `dosen`, `kegiatan_key` pada tabel BA; pusatkan helper `kegiatanKey()` di `src/read/common.js` dan logika progres di `src/read/kegiatan.js`. Tulis/ubah BA menyinkronkan `pengajuan.dosen` + `pengajuan.tanggal_pelaksanaan`. Read API mengembalikan unit kegiatan berisi peserta, BA, realisasi, dan progres. Frontend memakai struktur baris kegiatan yang sama dengan dua "kulit".

**Tech Stack:** Cloudflare Workers, D1 (SQLite), vanilla Vue 3 (CDN) di HTML, Vitest (`@cloudflare/vitest-pool-workers`).

Spec: `docs/superpowers/specs/2026-09-14-monitoring-kegiatan-tanggal-dan-ba-design.md`

## Global Constraints

- Kerjakan di `new-code1-cf/`; repo git dijalankan dari `/workspace`.
- Branch kerja: `feat/new-code2-ci4-inhal`.
- Jalankan test dari `new-code1-cf/`: `npx vitest run <file> --maxWorkers=1 --minWorkers=1`.
- Jangan menulis komentar kode.
- Jangan memakai kelas Tailwind yang tidak ada; hanya kelas yang sudah terbukti ada di HTML setempat.
- Test harness mereseed D1 dari `schema.sql` pada setiap `beforeEach`, jadi kolom baru wajib ada di `schema.sql`.
- Commit message tanpa trailer manual (git hook menambahkannya).
- Deploy hanya bila diminta: `CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy` dari `new-code1-cf/`.
- Jangan mengubah perilaku email.

---

### Task 1: Skema, migrasi, dan pemetaan kolom

**Files:**
- Modify: `new-code1-cf/schema.sql` (tabel `berita_acara`, `berita_acara_admin`; bagian index)
- Create: `new-code1-cf/migrations/2026-09-14-ba-tanggal-dosen.sql`
- Modify: `new-code1-cf/src/read/columns.js`
- Test: `new-code1-cf/test/schema-ba-columns.test.js`

**Interfaces:**
- Produces: kolom DB `berita_acara.jam`, `berita_acara.dosen`, `berita_acara.kegiatan_key`, `berita_acara_admin.jam`, `berita_acara_admin.kegiatan_key`; header klien `Jam`, `Dosen`, `Kegiatan Key`.

- [ ] **Step 1: Tulis test yang gagal**

Create `new-code1-cf/test/schema-ba-columns.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('skema ba tanggal & dosen', () => {
  it('menyimpan jam, dosen, kegiatan_key pada berita_acara', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan, jam, dosen, kegiatan_key) VALUES ('2026-09-20T00:00:00','BA-2026-0001','SGD','A','SGD 1','2026-09-20','09:00','dr. Andi','sgd|a|sgd 1')"
    ).run();
    const row = await env.DB.prepare('SELECT jam, dosen, kegiatan_key FROM berita_acara WHERE ba_id = ?1').bind('BA-2026-0001').first();
    expect(row.jam).toBe('09:00');
    expect(row.dosen).toBe('dr. Andi');
    expect(row.kegiatan_key).toBe('sgd|a|sgd 1');
  });

  it('menyimpan jam dan kegiatan_key pada berita_acara_admin', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan, jam, kegiatan_key) VALUES ('2026-09-12T00:00:00','BA-2026-0002','SGD','A','SGD 1','2026-09-12','10:15','sgd|a|sgd 1')"
    ).run();
    const row = await env.DB.prepare('SELECT jam, kegiatan_key FROM berita_acara_admin WHERE ba_id = ?1').bind('BA-2026-0002').first();
    expect(row.jam).toBe('10:15');
    expect(row.kegiatan_key).toBe('sgd|a|sgd 1');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run test/schema-ba-columns.test.js --maxWorkers=1 --minWorkers=1`
Expected: FAIL dengan pesan `no such column: jam`.

- [ ] **Step 3: Ubah `schema.sql`**

Pada `CREATE TABLE berita_acara`, ganti definisi kolom menjadi:

```sql
CREATE TABLE berita_acara (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, dosen TEXT, jumlah_peserta TEXT,
  file_name TEXT, file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT
);
```

Pada `CREATE TABLE berita_acara_admin`:

```sql
CREATE TABLE berita_acara_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, jumlah_peserta TEXT,
  file_name TEXT, file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT
);
```

Tambahkan index di akhir file (dekat index BA yang ada):

```sql
CREATE INDEX IF NOT EXISTS idx_ba_kegiatan_key ON berita_acara(kegiatan_key);
CREATE INDEX IF NOT EXISTS idx_ba_admin_kegiatan_key ON berita_acara_admin(kegiatan_key);
```

- [ ] **Step 4: Buat file migrasi remote**

Create `new-code1-cf/migrations/2026-09-14-ba-tanggal-dosen.sql`:

```sql
ALTER TABLE berita_acara ADD COLUMN jam TEXT;
ALTER TABLE berita_acara ADD COLUMN dosen TEXT;
ALTER TABLE berita_acara ADD COLUMN kegiatan_key TEXT;
ALTER TABLE berita_acara_admin ADD COLUMN jam TEXT;
ALTER TABLE berita_acara_admin ADD COLUMN kegiatan_key TEXT;
CREATE INDEX IF NOT EXISTS idx_ba_kegiatan_key ON berita_acara(kegiatan_key);
CREATE INDEX IF NOT EXISTS idx_ba_admin_kegiatan_key ON berita_acara_admin(kegiatan_key);
UPDATE pengajuan SET dosen = '', tanggal_pelaksanaan = '';
```

- [ ] **Step 5: Tambah pemetaan di `src/read/columns.js`**

Pada entri `berita_acara`, ganti menjadi:

```js
  berita_acara: {
    timestamp: 'Timestamp', ba_id: 'BA ID', bagian: 'Bagian', blok: 'Blok',
    nama_kegiatan: 'Nama Kegiatan', tanggal_pelaksanaan: 'Tanggal Pelaksanaan', jam: 'Jam',
    dosen: 'Dosen', jumlah_peserta: 'Jumlah Peserta', file_name: 'File Name', file_url: 'File URL',
    catatan: 'Catatan', sumber: 'Sumber', kegiatan_key: 'Kegiatan Key'
  },
```

Pada entri `berita_acara_admin`:

```js
  berita_acara_admin: {
    timestamp: 'Timestamp', ba_id: 'BA ID', bagian: 'Bagian', blok: 'Blok',
    nama_kegiatan: 'Nama Kegiatan', tanggal_pelaksanaan: 'Tanggal Pelaksanaan', jam: 'Jam',
    jumlah_peserta: 'Jumlah Peserta', file_name: 'File Name', file_url: 'File URL',
    catatan: 'Catatan', sumber: 'Sumber', kegiatan_key: 'Kegiatan Key'
  },
```

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `npx vitest run test/schema-ba-columns.test.js test/read-columns.test.js --maxWorkers=1 --minWorkers=1`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf/schema.sql new-code1-cf/migrations/2026-09-14-ba-tanggal-dosen.sql new-code1-cf/src/read/columns.js new-code1-cf/test/schema-ba-columns.test.js
git commit -m "feat(new-code1-cf): add jam/dosen/kegiatan_key columns for BA"
```

---

### Task 2: Helper `kegiatanKey` + simpan BA Pelaksanaan + sinkron pengajuan

**Files:**
- Modify: `new-code1-cf/src/read/common.js`
- Modify: `new-code1-cf/src/write/beritaAcara.js`
- Test: `new-code1-cf/test/write-berita-acara.test.js`

**Interfaces:**
- Produces:
  - `kegiatanKey(bagian, blok, nama): string` (dari `src/read/common.js`), format `norm(bagian)|norm(blok)|norm(nama)`.
  - `saveBeritaAcaraBagian(db, payload, kategori, ctx)` kini menyimpan `jam`, `dosen`, `kegiatan_key` dan menyinkronkan `pengajuan.dosen` + `pengajuan.tanggal_pelaksanaan`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `new-code1-cf/test/write-berita-acara.test.js` (di dalam `describe('berita acara bagian', ...)`):

```js
  it('menyimpan jam, dosen, dan kegiatan_key serta menyinkron ke pengajuan', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      jam: '09:00', dosen: 'dr. Andi', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'Diterima' }]
    }, 'SGD', ctx);
    expect(res.success).toBe(true);
    const ba = await env.DB.prepare('SELECT jam, dosen, kegiatan_key FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(ba.jam).toBe('09:00');
    expect(ba.dosen).toBe('dr. Andi');
    expect(ba.kegiatan_key).toBe('sgd|a|sgd 1');
    const p = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(p.dosen).toBe('dr. Andi');
    expect(p.tanggal_pelaksanaan).toBe('2026-09-20T09:00');
  });
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run test/write-berita-acara.test.js --maxWorkers=1 --minWorkers=1`
Expected: FAIL karena `jam`/`dosen` bernilai `null`/`undefined`.

- [ ] **Step 3: Tambah `kegiatanKey` di `src/read/common.js`**

Tambahkan tepat setelah fungsi `norm`:

```js
export function kegiatanKey(bagian, blok, nama) {
  return [norm(bagian), norm(blok), norm(nama)].join('|');
}
```

- [ ] **Step 4: Ubah `persistBa` dan `saveBeritaAcaraBagian`**

Di `src/write/beritaAcara.js`, tambahkan import:

```js
import { kegiatanKey } from '../read/common.js';
```

Ganti seluruh fungsi `persistBa` menjadi:

```js
async function persistBa(db, table, pesertaTable, payload, meta) {
  const ts = nowIso();
  const cols = {
    timestamp: ts,
    ba_id: meta.baId,
    bagian: meta.bagian,
    blok: str(payload.blok),
    nama_kegiatan: str(payload.namaKegiatan),
    tanggal_pelaksanaan: str(payload.tanggalPelaksanaan),
    jam: str(payload.jam),
    jumlah_peserta: payload.__jumlah,
    file_name: meta.fileName,
    file_url: meta.fileUrl,
    catatan: str(payload.catatan),
    sumber: payload.__sumber,
    kegiatan_key: meta.kegiatanKey
  };
  if (meta.withDosen) cols.dosen = str(payload.dosen);
  const keys = Object.keys(cols);
  const placeholders = keys.map((_, i) => '?' + (i + 1)).join(', ');
  const stmts = [
    db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).bind(...keys.map((k) => cols[k]))
  ];
  for (const p of payload.__peserta) {
    stmts.push(
      db.prepare(
        `INSERT INTO ${pesertaTable} (timestamp, ba_id, npm, nama_lengkap, blok, bagian, status_pengajuan) ` +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
      ).bind(ts, meta.baId, p.npm, p.namaLengkap, p.blok, meta.bagian, p.statusPengajuan)
    );
  }
  await db.batch(stmts);
}

async function syncPengajuanPelaksanaan(db, peserta, dosen, tanggal, jam) {
  const tgl = str(tanggal);
  const j = str(jam);
  const value = tgl && j ? (tgl + 'T' + j) : tgl;
  const ts = nowIso();
  const stmts = [];
  for (const p of peserta) {
    const id = str(p.idPengajuan);
    if (!id) continue;
    stmts.push(
      db.prepare('UPDATE pengajuan SET dosen = ?1, tanggal_pelaksanaan = ?2, updated_at = ?3 WHERE id_pengajuan = ?4')
        .bind(str(dosen), value, ts, id)
    );
  }
  if (stmts.length) await db.batch(stmts);
}
```

Pada `saveBeritaAcaraAdmin`, ganti pemanggilan `persistBa` menjadi:

```js
  await persistBa(db, 'berita_acara_admin', 'berita_acara_admin_peserta', p, {
    baId: baId, bagian: bagian, fileName: fileName, fileUrl: fileUrl,
    kegiatanKey: kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan)), withDosen: false
  });
```

Pada `saveBeritaAcaraBagian`, setelah baris `p.__sumber = 'Bagian';`, ganti pemanggilan menjadi:

```js
  await persistBa(db, 'berita_acara', 'berita_acara_peserta', p, {
    baId: baId, bagian: bagian, fileName: fileName, fileUrl: fileUrl,
    kegiatanKey: kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan)), withDosen: true
  });
  await syncPengajuanPelaksanaan(db, peserta, str(p.dosen), str(p.tanggalPelaksanaan), str(p.jam));
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `npx vitest run test/write-berita-acara.test.js --maxWorkers=1 --minWorkers=1`
Expected: PASS semua (termasuk test lama).

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/src/read/common.js new-code1-cf/src/write/beritaAcara.js new-code1-cf/test/write-berita-acara.test.js
git commit -m "feat(new-code1-cf): store jam/dosen/kegiatan_key and sync pengajuan on BA Pelaksanaan"
```

---

### Task 3: Hapus BA Pelaksanaan mengosongkan pengajuan peserta

**Files:**
- Modify: `new-code1-cf/src/write/beritaAcara.js`
- Test: `new-code1-cf/test/write-berita-acara.test.js`

**Interfaces:**
- Consumes: `syncPengajuanPelaksanaan` (Task 2) — pakai ulang konsep; di sini kosongkan nilai.
- Produces: `deleteBeritaAcaraBagian` mengosongkan `pengajuan.dosen` & `tanggal_pelaksanaan` peserta sebelum menghapus.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `new-code1-cf/test/write-berita-acara.test.js` dalam `describe('berita acara bagian', ...)`:

```js
  it('menghapus BA mengosongkan dosen dan tanggal pelaksanaan peserta', async () => {
    await seedPengajuan();
    const bagian = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      jam: '09:00', dosen: 'dr. Andi', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'Diterima' }]
    }, 'SGD', bagian);
    const admin = await adminCtx();
    await deleteBeritaAcaraBagian(env.DB, res.baId, admin);
    const p = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(p.dosen).toBe('');
    expect(p.tanggal_pelaksanaan).toBe('');
  });
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run test/write-berita-acara.test.js --maxWorkers=1 --minWorkers=1`
Expected: FAIL — `p.dosen` masih `dr. Andi`.

- [ ] **Step 3: Ubah `deleteBeritaAcaraBagian`**

Ganti fungsi `deleteBeritaAcaraBagian` di `src/write/beritaAcara.js` menjadi:

```js
export async function deleteBeritaAcaraBagian(db, baId, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };

  const existing = await db.prepare('SELECT ba_id, file_url FROM berita_acara WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

  const peserta = (await db.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1').bind(id).all()).results || [];
  const ids = peserta.map((r) => str(r.id_pengajuan)).filter(Boolean);
  const ts = nowIso();
  const clears = ids.map((pid) =>
    db.prepare('UPDATE pengajuan SET dosen = \'\', tanggal_pelaksanaan = \'\', updated_at = ?1 WHERE id_pengajuan = ?2').bind(ts, pid)
  );

  await db.batch([
    ...clears,
    db.prepare('DELETE FROM berita_acara_peserta WHERE ba_id = ?1').bind(id),
    db.prepare('DELETE FROM berita_acara WHERE ba_id = ?1').bind(id)
  ]);

  const fileId = parseDriveFileId(existing.file_url);
  if (fileId) await trashDriveFile(ctx.env, fileId);

  return { success: true, message: 'Berita acara berhasil dihapus.' };
}
```

Catatan: `berita_acara_peserta` tidak menyimpan `id_pengajuan` saat ini — lihat Step 4.

- [ ] **Step 4: Simpan `id_pengajuan` di tabel peserta**

`berita_acara_peserta` belum punya kolom `id_pengajuan`, jadi pencarian di Step 3 selalu kosong. Tambahkan kolom itu.

Di `schema.sql`, ganti definisi `berita_acara_peserta`:

```sql
CREATE TABLE berita_acara_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, id_pengajuan TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, bagian TEXT, status_pengajuan TEXT
);
```

Di `migrations/2026-09-14-ba-tanggal-dosen.sql`, tambahkan:

```sql
ALTER TABLE berita_acara_peserta ADD COLUMN id_pengajuan TEXT;
```

Di `persistBa` (Task 2), ubah INSERT peserta menjadi:

```js
    stmts.push(
      db.prepare(
        `INSERT INTO ${pesertaTable} (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan) ` +
        'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
      ).bind(ts, meta.baId, str(p.idPengajuan), p.npm, p.namaLengkap, p.blok, meta.bagian, p.statusPengajuan)
    );
```

Tambahkan pemetaan di `columns.js` entri `berita_acara_peserta`:

```js
  berita_acara_peserta: {
    timestamp: 'Timestamp', ba_id: 'BA ID', id_pengajuan: 'ID Pengajuan', npm: 'NPM', nama_lengkap: 'Nama Lengkap',
    blok: 'Blok', bagian: 'Bagian', status_pengajuan: 'Status Pengajuan'
  },
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `npx vitest run test/write-berita-acara.test.js test/schema-ba-columns.test.js --maxWorkers=1 --minWorkers=1`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/schema.sql new-code1-cf/migrations/2026-09-14-ba-tanggal-dosen.sql new-code1-cf/src/read/columns.js new-code1-cf/src/write/beritaAcara.js new-code1-cf/test/write-berita-acara.test.js
git commit -m "feat(new-code1-cf): clear pengajuan dates when deleting BA Pelaksanaan"
```

---

### Task 4: `updateBeritaAcaraBagian` (modal Kelola BA) + RPC

**Files:**
- Modify: `new-code1-cf/src/write/beritaAcara.js`
- Modify: `new-code1-cf/src/rpc.js`
- Test: `new-code1-cf/test/write-berita-acara.test.js`

**Interfaces:**
- Produces: `updateBeritaAcaraBagian(db, baId, payload, ctx)` dengan `payload = { bagian, kategori, tanggal, jam, dosen, catatan, file? }`; mengembalikan `{ success, message }`; menyinkronkan ulang `pengajuan`.
- Produces: RPC name `updateBeritaAcaraBagian` (args: baId, payload).

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `new-code1-cf/test/write-berita-acara.test.js` (import `updateBeritaAcaraBagian` di daftar import atas):

```js
  it('memperbarui jam dan dosen serta menyinkron ulang pengajuan', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'Diterima' }]
    }, 'SGD', await bagianCtx(['SGD']));
    const up = await updateBeritaAcaraBagian(env.DB, res.baId, { tanggal: '2026-09-20', jam: '13:30', dosen: 'dr. Budi', catatan: 'revisi' }, ctx);
    expect(up.success).toBe(true);
    const ba = await env.DB.prepare('SELECT jam, dosen, catatan FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(ba.jam).toBe('13:30');
    expect(ba.dosen).toBe('dr. Budi');
    expect(ba.catatan).toBe('revisi');
    const p = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(p.dosen).toBe('dr. Budi');
    expect(p.tanggal_pelaksanaan).toBe('2026-09-20T13:30');
  });
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run test/write-berita-acara.test.js --maxWorkers=1 --minWorkers=1`
Expected: FAIL — `updateBeritaAcaraBagian is not a function`.

- [ ] **Step 3: Implementasikan `updateBeritaAcaraBagian`**

Tambahkan di `src/write/beritaAcara.js` setelah `saveBeritaAcaraBagian`:

```js
export async function updateBeritaAcaraBagian(db, baId, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };
  const existing = await db.prepare('SELECT * FROM berita_acara WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

  const p = payload || {};
  const tanggal = p.tanggal !== undefined ? str(p.tanggal) : str(existing.tanggal_pelaksanaan);
  if (!tanggal) return { success: false, message: 'Tanggal pelaksanaan wajib diisi.' };

  const sets = ['tanggal_pelaksanaan = ?1', 'jam = ?2', 'dosen = ?3', 'catatan = ?4'];
  const vals = [
    tanggal,
    p.jam !== undefined ? str(p.jam) : str(existing.jam),
    p.dosen !== undefined ? str(p.dosen) : str(existing.dosen),
    p.catatan !== undefined ? str(p.catatan) : str(existing.catatan)
  ];
  await db.prepare('UPDATE berita_acara SET ' + sets.join(', ') + ' WHERE ba_id = ?' + (vals.length + 1)).bind(...vals, id).run();

  const peserta = (await db.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1').bind(id).all()).results || [];
  await syncPengajuanPelaksanaan(db, peserta.map((r) => ({ idPengajuan: r.id_pengajuan })), vals[2], tanggal, vals[1]);

  return { success: true, message: 'Berita acara diperbarui.' };
}
```

- [ ] **Step 4: Daftarkan RPC**

Di `src/rpc.js`, ubah import BA:

```js
import {
  saveBeritaAcaraAdmin, deleteBeritaAcaraAdmin, saveBeritaAcaraBagian, deleteBeritaAcaraBagian, updateBeritaAcaraBagian
} from './write/beritaAcara.js';
```

Tambahkan handler setelah `uploadBeritaAcaraBagian`:

```js
  updateBeritaAcaraBagian: (db, args, ctx) => updateBeritaAcaraBagian(db, args[0], args[1], ctx),
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `npx vitest run test/write-berita-acara.test.js test/rpc.test.js --maxWorkers=1 --minWorkers=1`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/src/write/beritaAcara.js new-code1-cf/src/rpc.js new-code1-cf/test/write-berita-acara.test.js
git commit -m "feat(new-code1-cf): add updateBeritaAcaraBagian for Kelola BA modal"
```

---

### Task 5: BA Pendukung — jam, kegiatan_key, maksimal satu, dan `updateBeritaAcaraAdmin`

**Files:**
- Modify: `new-code1-cf/src/write/beritaAcara.js`
- Modify: `new-code1-cf/src/rpc.js`
- Test: `new-code1-cf/test/write-berita-acara.test.js`

**Interfaces:**
- Produces: `saveBeritaAcaraAdmin` menyimpan `jam` + `kegiatan_key` dan menolak BA Pendukung kedua untuk `kegiatan_key` yang sama.
- Produces: `updateBeritaAcaraAdmin(db, baId, payload, ctx)`; RPC `updateBeritaAcaraAdmin`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di `describe('berita acara admin', ...)`:

```js
  it('menolak BA Pendukung kedua untuk kegiatan yang sama', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const first = await saveBeritaAcaraAdmin(env.DB, { ...adminPayload, jam: '10:15' }, ctx);
    expect(first.success).toBe(true);
    const second = await saveBeritaAcaraAdmin(env.DB, { ...adminPayload, jam: '11:00' }, ctx);
    expect(second.success).toBe(false);
    expect(second.message).toContain('sudah ada');
  });

  it('memperbarui BA Pendukung', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const res = await saveBeritaAcaraAdmin(env.DB, { ...adminPayload, jam: '10:15' }, ctx);
    const up = await updateBeritaAcaraAdmin(env.DB, res.baId, { tanggal: '2026-09-21', jam: '08:00', catatan: 'ok' }, ctx);
    expect(up.success).toBe(true);
    const ba = await env.DB.prepare('SELECT tanggal_pelaksanaan, jam, catatan FROM berita_acara_admin WHERE ba_id = ?1').bind(res.baId).first();
    expect(ba.jam).toBe('08:00');
    expect(ba.tanggal_pelaksanaan).toBe('2026-09-21');
    expect(ba.catatan).toBe('ok');
  });
```

Tambahkan `updateBeritaAcaraAdmin` di import atas.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run test/write-berita-acara.test.js --maxWorkers=1 --minWorkers=1`
Expected: FAIL (duplikat belum dicegah; `updateBeritaAcaraAdmin` belum ada).

- [ ] **Step 3: Cegah duplikat di `saveBeritaAcaraAdmin`**

Di `saveBeritaAcaraAdmin`, setelah baris `const bagian = str(p.bagian) || 'Admin';`, tambahkan:

```js
  const key = kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan));
  const dup = await db.prepare('SELECT ba_id FROM berita_acara_admin WHERE kegiatan_key = ?1').bind(key).first();
  if (dup) {
    return { success: false, message: 'Upload dibatalkan: sudah ada berita acara pendukung untuk kegiatan ini.' };
  }
```

Lalu ganti pemanggilan `persistBa` admin (dari Task 2) menjadi memakai `kegiatanKey: key`.

- [ ] **Step 4: Implementasikan `updateBeritaAcaraAdmin`**

Tambahkan setelah `deleteBeritaAcaraAdmin`:

```js
export async function updateBeritaAcaraAdmin(db, baId, payload, ctx) {
  await requireAdmin(db, ctx.token);
  const id = str(baId);
  if (!id) return { success: false, message: 'BA ID wajib diisi.' };
  const existing = await db.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Berita acara tidak ditemukan.' };

  const p = payload || {};
  const tanggal = p.tanggal !== undefined ? str(p.tanggal) : str(existing.tanggal_pelaksanaan);
  if (!tanggal) return { success: false, message: 'Tanggal pelaksanaan wajib diisi.' };

  const vals = [
    tanggal,
    p.jam !== undefined ? str(p.jam) : str(existing.jam),
    p.catatan !== undefined ? str(p.catatan) : str(existing.catatan)
  ];
  await db.prepare('UPDATE berita_acara_admin SET tanggal_pelaksanaan = ?1, jam = ?2, catatan = ?3 WHERE ba_id = ?4').bind(...vals, id).run();
  return { success: true, message: 'Berita acara pendukung diperbarui.' };
}
```

- [ ] **Step 5: Daftarkan RPC**

Di `src/rpc.js`, tambahkan `updateBeritaAcaraAdmin` pada import dan handler:

```js
  updateBeritaAcaraAdmin: (db, args, ctx) => updateBeritaAcaraAdmin(db, args[0], args[1], ctx),
```

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `npx vitest run test/write-berita-acara.test.js test/rpc.test.js --maxWorkers=1 --minWorkers=1`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf/src/write/beritaAcara.js new-code1-cf/src/rpc.js new-code1-cf/test/write-berita-acara.test.js
git commit -m "feat(new-code1-cf): enforce single BA Pendukung and add updateBeritaAcaraAdmin"
```

---

### Task 6: Logika progres bersama + agregasi dashboard

**Files:**
- Create: `new-code1-cf/src/read/kegiatan.js`
- Modify: `new-code1-cf/src/read/dashboard.js` (`getBagianAggregation`, sekitar baris 149-302)
- Test: `new-code1-cf/test/read-kegiatan-progress.test.js`
- Test: `new-code1-cf/test/read-dashboard.test.js`

**Interfaces:**
- Produces: `computeUnitProgress(unit)` di mana `unit` = `{ peserta: [{statusPengajuan, linkFinal}], baPendukung: [], baPelaksanaan: [] }`, mengembalikan `{ pendaftaran, pendukung, keputusan, final, pelaksanaan, selesai }` dengan nilai `'all' | 'partial' | 'none'`, plus `counts = { peserta, keputusan, final }`.
- Produces: tiap unit `getBagianAggregation` kini punya `progress`, `counts`, `baPendukung`, `baPelaksanaan`, `pelaksanaan: [{ baId, tanggal, jam, dosen }]`, `dosenList`.

- [ ] **Step 1: Tulis test yang gagal**

Create `new-code1-cf/test/read-kegiatan-progress.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeUnitProgress } from '../src/read/kegiatan.js';

describe('computeUnitProgress', () => {
  it('menandai tahap sebagian dan selesai', () => {
    const unit = {
      peserta: [
        { statusPengajuan: 'Diterima', linkFinal: 'x' },
        { statusPengajuan: 'Menunggu', linkFinal: '' }
      ],
      baPendukung: [{ baId: 'BA-2026-0001' }],
      baPelaksanaan: [{ baId: 'BA-2026-0011', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi' }]
    };
    const p = computeUnitProgress(unit);
    expect(p.pendaftaran).toBe('all');
    expect(p.pendukung).toBe('all');
    expect(p.keputusan).toBe('partial');
    expect(p.final).toBe('partial');
    expect(p.pelaksanaan).toBe('all');
    expect(p.selesai).toBe('all');
    expect(p.counts).toEqual({ peserta: 2, keputusan: 1, final: 1 });
  });

  it('selesai hanya bila dosen, tanggal, dan jam lengkap', () => {
    const unit = {
      peserta: [{ statusPengajuan: 'ACC', linkFinal: 'x' }],
      baPendukung: [],
      baPelaksanaan: [{ baId: 'BA-2026-0011', tanggal: '2026-09-20', jam: '', dosen: 'dr. Andi' }]
    };
    const p = computeUnitProgress(unit);
    expect(p.pelaksanaan).toBe('all');
    expect(p.selesai).toBe('none');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run test/read-kegiatan-progress.test.js --maxWorkers=1 --minWorkers=1`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Implementasikan `src/read/kegiatan.js`**

```js
function stage(done, total) {
  if (!total || done <= 0) return 'none';
  return done >= total ? 'all' : 'partial';
}

export function computeUnitProgress(unit) {
  const peserta = (unit && unit.peserta) || [];
  const baPendukung = (unit && unit.baPendukung) || [];
  const baPelaksanaan = (unit && unit.baPelaksanaan) || [];
  const total = peserta.length;
  const decided = peserta.filter((p) => p.statusPengajuan === 'Diterima' || p.statusPengajuan === 'Ditolak').length;
  const finalCount = peserta.filter((p) => p.linkFinal).length;
  const selesai = baPelaksanaan.some((b) => b.dosen && b.tanggal && b.jam);
  return {
    pendaftaran: total > 0 ? 'all' : 'none',
    pendukung: baPendukung.length ? 'all' : 'none',
    keputusan: stage(decided, total),
    final: stage(finalCount, total),
    pelaksanaan: baPelaksanaan.length ? 'all' : 'none',
    selesai: selesai ? 'all' : 'none',
    counts: { peserta: total, keputusan: decided, final: finalCount }
  };
}
```

- [ ] **Step 4: Integrasikan ke `getBagianAggregation`**

Di `src/read/dashboard.js`, tambahkan import:

```js
import { computeUnitProgress } from './kegiatan.js';
```

Pada `addPeserta` di dalam `getBagianAggregation`, tambahkan `linkFinal`:

```js
    addPeserta(unit, {
      npm: String(p.NPM || '').trim(),
      namaLengkap: String(p['Nama Lengkap'] || '').trim(),
      blok: String(p.Blok || '').trim(),
      statusPengajuan: String(p.Status || '').trim(),
      linkFinal: String(p['Link Final'] || '').trim(),
      idPengajuan: idp
    });
```

Pada `collectBa` tambahkan `jam`, `dosen`, `kegiatanKey` ke objek `rec`:

```js
        jam: String(c.Jam || '').trim(),
        dosen: String(c.Dosen || '').trim(),
        kegiatanKey: String(c['Kegiatan Key'] || '').trim(),
```

Ganti blok pencocokan BA (baris `const orphanBa = [];` hingga `for (const u of matched) u.ba.push(b);`) menjadi pencocokan berbasis kunci lebih dulu:

```js
  const unitByKey = {};
  for (const u of units) unitByKey[u.key] = u;

  const orphanBa = [];
  for (const b of baList) {
    const direct = b.kegiatanKey ? unitByKey[b.kegiatanKey] : null;
    if (direct) { direct.ba.push(b); continue; }
    const bBagian = resolveBagian12(b.bagian, '', b.namaKegiatan, labs) || b.bagian;
    const candidates = unitByBag[bagKey(bBagian, b.blok)] || [];
    const bNpms = b.peserta.map((p) => p.npm).filter(Boolean);
    let matched = candidates.filter((u) => u.peserta.some((p) => p.npm && bNpms.indexOf(p.npm) !== -1));
    if (!matched.length) {
      const bName = normKegiatanText(b.namaKegiatan);
      matched = candidates.filter((u) => {
        const l = normKegiatanText(u.label);
        return !!l && (bName === l || bName.endsWith(l));
      });
    }
    if (!matched.length) { orphanBa.push(b); continue; }
    for (const u of matched) u.ba.push(b);
  }
```

Pada loop final per unit (setelah `u.statusFinal = ...`), tambahkan:

```js
    u.baPendukung = u.ba.filter((b) => b.sumber === 'Admin');
    u.baPelaksanaan = u.ba.filter((b) => b.sumber === 'Bagian');
    u.pelaksanaan = u.baPelaksanaan.map((b) => ({ baId: b.baId, tanggal: b.tanggal, jam: b.jam || '', dosen: b.dosen || '' }));
    const dosenSet = [];
    for (const b of u.baPelaksanaan) if (b.dosen && dosenSet.indexOf(b.dosen) === -1) dosenSet.push(b.dosen);
    u.dosenList = dosenSet;
    u.progress = computeUnitProgress(u);
    u.counts = u.progress.counts;
```

Catatan: `unit.key` saat ini `[norm(bagian), blok.toLowerCase(), norm(label)].join('|')` — tidak identik dengan `kegiatanKey` (yang pakai `norm(blok)`). Samakan dengan mengubah baris `const key = ...` menjadi:

```js
    const key = kegiatanKey(bagian, blok, label);
```

Tambahkan `kegiatanKey` pada import dari `./common.js` di `dashboard.js`.

- [ ] **Step 5: Tulis test read dashboard**

Tambahkan ke `new-code1-cf/test/read-dashboard.test.js`:

```js
import { getBagianAggregation } from '../src/read/dashboard.js';
import { createSession } from '../src/session.js';

it('mengembalikan progres dan realisasi per kegiatan', async () => {
  const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC','http://final')"
  ).run();
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')"
  ).run();
  await env.DB.prepare(
    "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,kegiatan_key) VALUES ('2026-09-20T08:00:00','BA-2026-0001','SGD','A','SGD 1','2026-09-20','09:00','dr. Andi','sgd|a|sgd 1')"
  ).run();
  const res = await getBagianAggregation(env.DB, { token });
  const unit = res.units.find((u) => u.key === 'sgd|a|sgd 1');
  expect(unit).toBeTruthy();
  expect(unit.progress.selesai).toBe('all');
  expect(unit.pelaksanaan[0].jam).toBe('09:00');
  expect(unit.dosenList).toEqual(['dr. Andi']);
});
```

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `npx vitest run test/read-kegiatan-progress.test.js test/read-dashboard.test.js --maxWorkers=1 --minWorkers=1`
Expected: PASS (test lama dashboard juga harus tetap lulus).

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf/src/read/kegiatan.js new-code1-cf/src/read/dashboard.js new-code1-cf/test/read-kegiatan-progress.test.js new-code1-cf/test/read-dashboard.test.js
git commit -m "feat(new-code1-cf): compute kegiatan progress and realisasi in dashboard aggregation"
```

---

### Task 7: `getLaporanBootstrap` mengembalikan unit kegiatan

**Files:**
- Modify: `new-code1-cf/src/read/laporan.js`
- Test: `new-code1-cf/test/read-laporan.test.js`

**Interfaces:**
- Consumes: `computeUnitProgress` (Task 6), `kegiatanKey` (Task 2).
- Produces: `getLaporanBootstrap` mengembalikan tambahan `kegiatan: [ { key, bagian, blok, label, peserta, baPendukung, baPelaksanaan, pelaksanaan, dosenList, progress, counts } ]`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `new-code1-cf/test/read-laporan.test.js`:

```js
it('mengembalikan unit kegiatan dengan progres', async () => {
  const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC','http://final')"
  ).run();
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')"
  ).run();
  const data = await getLaporanBootstrap(env.DB, { token });
  expect(Array.isArray(data.kegiatan)).toBe(true);
  const unit = data.kegiatan.find((u) => u.key === 'sgd|a|sgd 1');
  expect(unit).toBeTruthy();
  expect(unit.progress.final).toBe('all');
});
```

Pastikan `createSession` sudah diimport di file test tersebut; bila belum, tambahkan `import { createSession } from '../src/session.js';`.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run test/read-laporan.test.js --maxWorkers=1 --minWorkers=1`
Expected: FAIL — `data.kegiatan` undefined.

- [ ] **Step 3: Implementasikan pengelompokan di `getLaporanBootstrap`**

Di `src/read/laporan.js`, tambahkan import:

```js
import { kegiatanKey } from './common.js';
import { computeUnitProgress } from './kegiatan.js';
```

Muat BA admin juga (setelah baris `const ba = ... berita_acara ...`):

```js
  const baAdmin = (await db.prepare('SELECT * FROM berita_acara_admin').all()).results || [];
```

Sebelum `return`, bangun unit kegiatan:

```js
  const baAdminClient = baAdmin.map((r) => toClientRow('berita_acara_admin', r));
  const baClient = sortedBa.filter((r) => baSumber(toClientRow('berita_acara', r)) === 'Bagian')
    .map((r) => { const c = toClientRow('berita_acara', r); c.peserta = pesertaMap[String(r.ba_id || '').trim()] || []; return c; });

  const units = [];
  const unitIndex = {};
  for (const row of rows) {
    const p = row.pengajuan;
    const idp = String(p['ID Pengajuan'] || '').trim();
    for (const d of row.details) {
      const pilihan = String(d.Pilihan || '').trim();
      const detailText = String(d.Detail || '').trim();
      const label = detailText ? (pilihan + ' - ' + detailText) : (pilihan || '-');
      const bagian = String(d.Bagian || '').trim() || 'Lainnya';
      const blok = String(p.Blok || '').trim();
      const key = kegiatanKey(bagian, blok, label);
      if (unitIndex[key] === undefined) {
        unitIndex[key] = units.length;
        units.push({ key, bagian, blok, label, peserta: [], baPendukung: [], baPelaksanaan: [], pelaksanaan: [], dosenList: [] });
      }
      const u = units[unitIndex[key]];
      if (!u.peserta.some((x) => x.idPengajuan === idp)) {
        u.peserta.push({
          idPengajuan: idp,
          npm: String(p.NPM || '').trim(),
          namaLengkap: String(p['Nama Lengkap'] || '').trim(),
          statusPengajuan: String(p.Status || '').trim(),
          linkFinal: String(p['Link Final'] || '').trim()
        });
      }
    }
  }
  const attach = (list, bucket) => {
    for (const b of list) {
      const key = b['Kegiatan Key'] || kegiatanKey(b.Bagian, b.Blok, b['Nama Kegiatan']);
      const u = unitIndex[key] !== undefined ? units[unitIndex[key]] : null;
      if (!u) continue;
      u[bucket].push(b);
    }
  };
  attach(baAdminClient, 'baPendukung');
  attach(baClient, 'baPelaksanaan');
  for (const u of units) {
    u.pelaksanaan = u.baPelaksanaan.map((b) => ({ baId: b['BA ID'], tanggal: b['Tanggal Pelaksanaan'], jam: b.Jam || '', dosen: b.Dosen || '' }));
    const dosenSet = [];
    for (const b of u.baPelaksanaan) if (b.Dosen && dosenSet.indexOf(b.Dosen) === -1) dosenSet.push(b.Dosen);
    u.dosenList = dosenSet;
    u.progress = computeUnitProgress(u);
    u.counts = u.progress.counts;
  }
```

Tambahkan `kegiatan: units` pada objek `return`.

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run test/read-laporan.test.js test/read-dashboard.test.js --maxWorkers=1 --minWorkers=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/read/laporan.js new-code1-cf/test/read-laporan.test.js
git commit -m "feat(new-code1-cf): return kegiatan units with progress in laporan bootstrap"
```

---

### Task 8: Frontend dashboard — kolom kegiatan, progres, realisasi, modal Kelola BA

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Test: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Consumes: unit dari `getBagianAggregation` dengan `progress`, `counts`, `pelaksanaan`, `dosenList`, `baPendukung`, `baPelaksanaan`.
- Produces: baris kegiatan menampilkan progres 6 titik, realisasi, dosen; modal "Kelola BA"; input Dosen & Tanggal Pelaksanaan pengajuan dinonaktifkan.

- [ ] **Step 1: Tulis test template yang gagal**

Tambahkan ke `new-code1-cf/test/dashboard-template.test.js`:

```js
it('memuat progres kegiatan dan modal Kelola BA', async () => {
  const html = await loadDashboard();
  expect(html).toContain('progresDots');
  expect(html).toContain('kelolaBa');
  expect(html).toContain('Riwayat Proses');
});
```

Gunakan pola helper yang sudah ada di file test tersebut untuk mengambil isi `dashboard.html`.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run test/dashboard-template.test.js --maxWorkers=1 --minWorkers=1`
Expected: FAIL — penanda belum ada.

- [ ] **Step 3: Tambahkan kolom Progres, Realisasi, Dosen pada baris kegiatan**

Di `dashboard.html`, pada tabel unit (`getBagianAggregation`), ganti bagian sel "BA Pelaksanaan" dan "Aksi" agar menampilkan progres, realisasi, dan dosen. Tambahkan tepat sebelum kolom Aksi:

```html
                                                <td class="p-3">
                                                    <div class="flex items-center gap-1" :title="stageTooltip(r)">
                                                        <span v-for="(s, si) in progresDots(r)" :key="si" class="inline-block h-2.5 w-2.5 rounded-full" :class="s === 'all' ? 'bg-emerald-500' : (s === 'partial' ? 'bg-amber-400' : 'bg-slate-200')"></span>
                                                    </div>
                                                </td>
                                                <td class="p-3 text-xs text-slate-600">
                                                    <div v-if="r.pelaksanaan && r.pelaksanaan.length">
                                                        <div v-for="(s, si) in r.pelaksanaan" :key="si" class="whitespace-nowrap">{{ formatTanggal(s.tanggal) }}<span v-if="s.jam"> {{ s.jam }}</span></div>
                                                    </div>
                                                    <span v-else class="text-slate-300">-</span>
                                                </td>
                                                <td class="p-3 text-xs text-slate-600">{{ (r.dosenList && r.dosenList.length) ? r.dosenList.join(', ') : '-' }}</td>
```

- [ ] **Step 4: Tambahkan metode progres + modal Kelola BA**

Tambahkan method berikut di objek Vue (dekat `unitHasPelaksanaan`):

```js
                progresDots(r) {
                    const p = r.progress || {};
                    return [p.pendaftaran, p.pendukung, p.keputusan, p.final, p.pelaksanaan, p.selesai];
                },
                stageTooltip(r) {
                    const c = r.counts || {};
                    const p = r.progress || {};
                    return 'Pendaftaran: ' + (c.peserta || 0) + ' peserta' +
                        ' · Pendukung: ' + (p.pendukung === 'all' ? 'ada' : 'belum') +
                        ' · Keputusan: ' + (c.keputusan || 0) + '/' + (c.peserta || 0) +
                        ' · ACC Final: ' + (c.final || 0) + '/' + (c.peserta || 0) +
                        ' · Pelaksanaan: ' + (p.pelaksanaan === 'all' ? 'ada' : 'belum') +
                        ' · Selesai: ' + (p.selesai === 'all' ? 'ya' : 'belum');
                },
                openKelolaBa(baId, sumber) {
                    const list = (this.bagian.units || []).flatMap((u) => (u.ba || []));
                    const found = list.find((b) => b.baId === baId) || {};
                    this.kelola = {
                        open: true, baId: baId, sumber: sumber || found.sumber || 'Bagian',
                        tanggal: found.tanggal || '', jam: found.jam || '', dosen: found.dosen || '', catatan: found.catatan || ''
                    };
                },
                async submitKelolaBa() {
                    const k = this.kelola;
                    this.loading = true;
                    try {
                        const fn = k.sumber === 'Admin' ? 'updateBeritaAcaraAdmin' : 'updateBeritaAcaraBagian';
                        const res = await this.run(fn, k.baId, { tanggal: k.tanggal, jam: k.jam, dosen: k.dosen, catatan: k.catatan });
                        this.notify((res && res.message) || 'Selesai.', !!(res && res.success));
                        if (res && res.success) {
                            k.open = false;
                            await this.loadBagian();
                        }
                    } catch (e) {
                        this.notify('Gagal: ' + e, false);
                    } finally {
                        this.loading = false;
                    }
                },
```

Tambahkan state `kelola` pada `data()`:

```js
                    kelola: { open: false, baId: '', sumber: 'Bagian', tanggal: '', jam: '', dosen: '', catatan: '' },
```

Tambahkan modal HTML (dekat modal BA yang ada) dan tombol `Kelola` pada chip BA:

```html
                        <div v-if="kelola.open" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
                            <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-lift">
                                <h3 class="mb-4 text-sm font-bold text-slate-900">Kelola BA {{ kelola.baId }}</h3>
                                <div class="grid gap-3 sm:grid-cols-2">
                                    <div><label class="label">Tanggal Pelaksanaan</label><input v-model="kelola.tanggal" type="date" class="input"></div>
                                    <div><label class="label">Jam</label><input v-model="kelola.jam" type="time" class="input"></div>
                                    <div class="sm:col-span-2"><label class="label">Dosen</label><input v-model="kelola.dosen" class="input" list="dosenList"></div>
                                    <div class="sm:col-span-2"><label class="label">Catatan</label><textarea v-model="kelola.catatan" rows="2" class="input"></textarea></div>
                                </div>
                                <div class="mt-5 flex justify-end gap-2">
                                    <button class="btn-soft" @click="kelola.open = false">Batal</button>
                                    <button class="btn-primary" :disabled="loading" @click="submitKelolaBa">Simpan</button>
                                </div>
                            </div>
                        </div>
```

- [ ] **Step 5: Jadikan input Dosen & Tanggal Pelaksanaan read-only**

Di panel detail pengajuan, ganti input `detail.dForm.dosen` dan `detail.dForm.tanggalPelaksanaan` menjadi read-only dan beri catatan sumber:

```html
                                    <div><label class="label">Dosen</label><input :value="detail.dForm.dosen" class="input bg-slate-50" readonly></div>
```

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `npx vitest run test/dashboard-template.test.js --maxWorkers=1 --minWorkers=1`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "feat(new-code1-cf): kegiatan progress, realisasi and Kelola BA modal in dashboard"
```

---

### Task 9: Frontend detail-laporan — tabel kegiatan lengkap + drill-down

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html`
- Test: `new-code1-cf/test/dashboard-template.test.js` (tambahkan pemeriksaan detail-laporan bila pola memungkinkan)

**Interfaces:**
- Consumes: `data.kegiatan` dari `getLaporanBootstrap` (Task 7).

- [ ] **Step 1: Muat `kegiatan` dari bootstrap**

Di `loadData()` (`detail-laporan.html`), tambahkan setelah `this.beritaAcara = ...`:

```js
                        this.kegiatan = data.kegiatan || [];
```

Dan di `data()` tambahkan `kegiatan: [],`.

- [ ] **Step 2: Ganti tabel tab Berita Acara menjadi tabel kegiatan**

Pada tab `ba`, ganti tabel kelompok lama menjadi struktur level kegiatan (memakai `this.kegiatan`), dengan kolom: chevron · Bagian · Blok · Kegiatan · Progres · Realisasi · Dosen · Peserta · Pendukung · Pelaksanaan · Biaya · Aksi. Gunakan penanda yang sama seperti dashboard:

```html
                                                <td class="px-3 py-2.5">
                                                    <div class="flex items-center gap-1" :title="stageTooltip(r)">
                                                        <span v-for="(s, si) in progresDots(r)" :key="si" class="inline-block h-2 w-2 rounded-full" :class="s === 'all' ? 'bg-emerald-500' : (s === 'partial' ? 'bg-amber-400' : 'bg-slate-200')"></span>
                                                    </div>
                                                </td>
                                                <td class="whitespace-nowrap px-3 py-2.5 text-slate-600">
                                                    <span v-if="r.pelaksanaan && r.pelaksanaan.length">{{ formatTanggalWaktu(r.pelaksanaan[0].tanggal + (r.pelaksanaan[0].jam ? 'T' + r.pelaksanaan[0].jam : '')) }}</span>
                                                    <span v-else class="text-slate-300">-</span>
                                                </td>
                                                <td class="px-3 py-2.5 text-slate-600">{{ (r.dosenList && r.dosenList.length) ? r.dosenList.join(', ') : '-' }}</td>
```

Tambahkan method `progresDots` dan `stageTooltip` (sama seperti Task 8) di objek Vue.

- [ ] **Step 3: Drill-down mahasiswa**

Pada baris expand kegiatan, render tabel peserta `r.peserta` dengan kolom Nama/NPM · Status · ACC Final · (Biaya bila tersedia). Tampilkan juga chip BA pendukung/pelaksanaan dari `r.baPendukung`/`r.baPelaksanaan` beserta tombol `Kelola` dan `Hapus`.

- [ ] **Step 4: Jadikan Dosen & Tanggal Pelaksanaan read-only di tab Rekap**

Pada tabel Rekap per mahasiswa, kolom Dosen & Tanggal Pelaksanaan tetap ditampilkan tetapi tidak dapat diedit (tidak ada kontrol input).

- [ ] **Step 5: Jalankan test suite terkait**

Run: `npx vitest run test/read-laporan.test.js --maxWorkers=1 --minWorkers=1`
Expected: PASS. Verifikasi template compile dengan menjalankan `test/dashboard-template.test.js` bila helper-nya mendukung file detail-laporan; jika tidak, cukup pastikan sintaks skrip inline valid lewat pemeriksaan manual di Step 6.

- [ ] **Step 6: Verifikasi sintaks skrip inline**

Run:

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('new-code1-cf/public/detail-laporan.html','utf8');const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;let m,i=0,ok=true;while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){ok=false;console.log('SYNTAX ERROR:',e.message);}}console.log('scripts',i,ok?'OK':'FAIL');"
```

Expected: `scripts 1 OK`.

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html
git commit -m "feat(new-code1-cf): kegiatan-level recap with mahasiswa drill-down in detail-laporan"
```

---

### Task 10: Drawer "Riwayat Proses"

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Modify: `new-code1-cf/public/detail-laporan.html`

**Interfaces:**
- Consumes: unit yang punya `baPendukung`, `baPelaksanaan`, `peserta`, `pelaksanaan`.

- [ ] **Step 1: Tambahkan state & method drawer (kedua file)**

```js
                riwayat: { open: false, unit: null },
                openRiwayat(r) {
                    this.riwayat = { open: true, unit: r };
                },
                riwayatEvents(r) {
                    if (!r) return [];
                    const out = [];
                    const firstDate = (r.peserta || []).map((p) => p.tanggalDaftar).filter(Boolean).sort()[0];
                    out.push({ label: 'Pendaftaran', detail: (r.counts && r.counts.peserta ? r.counts.peserta : (r.peserta || []).length) + ' mahasiswa', time: firstDate || '' });
                    for (const b of (r.baPendukung || [])) out.push({ label: 'BA Pendukung', detail: b.baId, time: b.timestamp || '' });
                    out.push({ label: 'Keputusan', detail: (r.counts ? r.counts.keputusan : 0) + ' diputuskan', time: '' });
                    out.push({ label: 'ACC Final', detail: (r.counts ? r.counts.final : 0) + ' terkirim', time: '' });
                    for (const b of (r.baPelaksanaan || [])) out.push({ label: 'BA Pelaksanaan', detail: b.baId + (b.dosen ? ' · ' + b.dosen : '') + (b.jam ? ' · ' + b.tanggal + ' ' + b.jam : ''), time: b.timestamp || '' });
                    out.push({ label: 'Selesai', detail: (r.progress && r.progress.selesai === 'all') ? 'lengkap' : 'belum', time: '' });
                    return out;
                },
```

Catatan: `peserta` dari dashboard belum punya `tanggalDaftar`; biarkan kosong bila tidak ada (drawer tetap menampilkan label). Jangan menambah kolom baru di luar spec.

- [ ] **Step 2: Tambahkan drawer HTML (kedua file)**

```html
                <div v-if="riwayat.open" class="fixed inset-0 z-40 flex justify-end bg-slate-900/40" @click.self="riwayat.open = false">
                    <div class="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-lift">
                        <div class="mb-4 flex items-center justify-between">
                            <h3 class="text-sm font-bold text-slate-900">Riwayat Proses</h3>
                            <button class="text-slate-400 hover:text-slate-600" @click="riwayat.open = false"><i class="bi bi-x-lg"></i></button>
                        </div>
                        <ol class="space-y-3">
                            <li v-for="(e, i) in riwayatEvents(riwayat.unit)" :key="i" class="flex gap-3">
                                <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500"></span>
                                <div>
                                    <div class="text-sm font-semibold text-slate-800">{{ e.label }}</div>
                                    <div class="text-xs text-slate-500">{{ e.detail }}</div>
                                    <div v-if="e.time" class="text-[11px] text-slate-400">{{ e.time }}</div>
                                </div>
                            </li>
                        </ol>
                    </div>
                </div>
```

- [ ] **Step 3: Buka drawer dari baris kegiatan**

Tambahkan tombol `Riwayat` di kolom Aksi tiap baris kegiatan:

```html
                                                        <button class="btn-soft !px-2 !py-1 text-[11px]" @click="openRiwayat(r)">Riwayat</button>
```

- [ ] **Step 4: Verifikasi sintaks skrip inline kedua file**

Run:

```bash
node -e "const fs=require('fs');for(const f of ['new-code1-cf/public/dashboard.html','new-code1-cf/public/detail-laporan.html']){const h=fs.readFileSync(f,'utf8');const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;let m,i=0,ok=true;while((m=re.exec(h))){i++;try{new Function(m[1]);}catch(e){ok=false;console.log(f,'SYNTAX ERROR:',e.message);}}console.log(f,'scripts',i,ok?'OK':'FAIL');}"
```

Expected: kedua file `OK`.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/public/detail-laporan.html
git commit -m "feat(new-code1-cf): add Riwayat Proses drawer in dashboard and detail-laporan"
```

---

### Task 11: Verifikasi menyeluruh

**Files:**
- Tidak ada file baru.

- [ ] **Step 1: Jalankan seluruh test**

Run: `npx vitest run --maxWorkers=1 --minWorkers=1`
Expected: semua test lulus (jumlah file bertambah sesuai test baru).

- [ ] **Step 2: Periksa sintaks skrip inline kedua halaman**

Run perintah Node pada Task 10 Step 4.
Expected: kedua file `OK`.

- [ ] **Step 3: Verifikasi tidak ada kolom Biaya di dashboard**

Run: `rg -n "Biaya" new-code1-cf/public/dashboard.html`
Expected: tidak ada kolom tabel Biaya pada tab Berita Acara (kecuali pada form/aksi yang memang sudah ada sebelumnya, mis. input biaya pengajuan).

- [ ] **Step 4: (Opsional, bila diminta) deploy & verifikasi**

Run:
```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```
Kemudian verifikasi halaman live memuat penanda `progresDots`, `openKelolaBa`, dan `Riwayat Proses`.

- [ ] **Step 5: Commit sisa bila ada**

```bash
git status --short
```

Bila bersih, tidak ada aksi. Bila ada perubahan, commit sesuai konvensi.

---

## Catatan konsistensi

- Nama field klien baru: `Jam`, `Dosen` (hanya `berita_acara`), `Kegiatan Key`.
- Nama fungsi bersama: `kegiatanKey()` (common), `computeUnitProgress()` (`src/read/kegiatan.js`).
- Nilai progres: `'all' | 'partial' | 'none'`.
- RPC baru: `updateBeritaAcaraBagian`, `updateBeritaAcaraAdmin`.
