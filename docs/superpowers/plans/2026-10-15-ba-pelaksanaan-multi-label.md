# BA Pelaksanaan: Multi-BA per Kegiatan, Label, & Kandidat Bersih — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membolehkan lebih dari satu BA Pelaksanaan per kegiatan (tanggal boleh sama), menambah kolom `label` opsional pada `berita_acara`, memperbaiki bug simpan bisu akibat ketidakcocokan kunci duplikat, dan menyembunyikan mahasiswa yang sudah terdaftar di BA Pelaksanaan mana pun pada kegiatan yang sama dari daftar kandidat.

**Architecture:** Tambah kolom `berita_acara.label` (migrasi aditif). `buildPersistBaStmts` tidak lagi memakai guard `kegiatan_key NOT EXISTS` untuk jalur Bagian sehingga tiap unggahan benar-benar tersimpan (guard tetap dipertahankan untuk BA Pendukung agar anti-balapan admin tetap aman). `computeBagianRows` menandai baris dengan `baMember` (berdasarkan `kegiatan_key` BA + `id_pengajuan` peserta) agar UI menyaring kandidat. UI `bagian.html` dan panel Bagian di `dashboard.html` menambah input label, mengubah teks status menjadi ACC, dan menampilkan peringatan "BA sudah ada — akan menambah BA baru" (bukan penolakan).

**Tech Stack:** JavaScript ESM, Cloudflare Workers + D1, Vitest, Vue 3 CDN.

## Global Constraints

- BA Pelaksanaan = baris `berita_acara` (`sumber='Bagian'`). **Jumlah tidak dibatasi** per kegiatan; tanggal boleh sama; dibedakan lewat `label` opsional.
- `label` = teks bebas opsional (mis. "Sesi 1", "Hari ke-2"). Tidak dipakai untuk kunci identitas — hanya metadata tampilan.
- Anggota BA Pelaksanaan hanya yang berstatus lolos `getBagianBaStatuses` (setelah Plan A = `['ACC']`). Validasi tetap di `validateBaPesertaStatus`.
- Anggota berupa **metadata saja** (`berita_acara_peserta`); BA Pelaksanaan **tidak** dirakit ulang menjadi PDF (1 file scan per BA, apa adanya).
- `sumber='Bagian'` untuk semua BA Pelaksanaan, baik diunggah Panel Bagian maupun sesi Bagian di dashboard.
- Tanpa constraint unik DB. Konfirmasi duplikat dilakukan di UI (soft), bukan penolakan server.
- **Anti-regresi balapan admin:** guard `kegiatan_key NOT EXISTS` tetap berlaku untuk BA Pendukung (`saveBeritaAcaraAdmin`). Hanya jalur Bagian (`saveBeritaAcaraBagian`) yang diizinkan multi-baris.
- Migrasi DB wajib idempotent & aditif. Jangan menimpa/menghapus data produksi.
- Perintah tes: `npm test`. Semua tes lama harus tetap lulus.
- Terkait: Plan A (`2026-10-15-alur-status-portal.md`) — default status BA = `['ACC']`. Plan B (`2026-10-15-ba-pendukung-dokumen-dasar.md`) — mengubah `src/write/baAdmin.js` (tabel berbeda, tidak bentrok).

---

## File Structure

- `migrations/2026-10-15-ba-pelaksanaan-label.sql` — **Create.** Kolom `label` + backfill kosong.
- `test/migration-ba-pelaksanaan-label.test.js` — **Create.**
- `schema.sql` — **Modify.** Kolom `label` di `berita_acara`.
- `src/write/beritaAcara.js` — **Modify.** Multi-BA Bagian, simpan `label`, perbaiki guard.
- `test/write-berita-acara.test.js` — **Modify.** Multi-BA + label.
- `src/read/columns.js` — **Modify.** Mapping `label`.
- `src/read/bagian.js` — **Modify.** Tandai `baMember` pada baris.
- `test/read-bagian.test.js` — **Modify.** Uji `baMember`.
- `public/bagian.html` — **Modify.** Input label, teks ACC, konfirmasi multi-BA, saring `baMember`.
- `test/bagian-template.test.js` — **Modify.** Guard string UI.
- `public/dashboard.html` — **Modify.** Panel Bagian: input label, teks ACC, konfirmasi multi-BA, saring `baMember`.
- `test/dashboard-ba-pendukung.test.js` — **Modify.** Guard string UI panel Bagian.

---

### Task 1: Migrasi & skema kolom `label`

**Files:**
- Create: `migrations/2026-10-15-ba-pelaksanaan-label.sql`
- Modify: `schema.sql:115-119`
- Test: `test/migration-ba-pelaksanaan-label.test.js`

**Interfaces:**
- Produces: kolom `berita_acara.label TEXT DEFAULT ''`.

- [ ] **Step 1: Write the failing test**

```js
// test/migration-ba-pelaksanaan-label.test.js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-15-ba-pelaksanaan-label.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function simulatePreMigration() {
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara').run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT, ' +
      'nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, dosen TEXT, jumlah_peserta TEXT, ' +
      'file_name TEXT, file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT)'
  ).run();
}

async function columnInfo(table, name) {
  const rows = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  return (rows.results || []).find((r) => r.name === name) || null;
}

describe('migrasi label BA Pelaksanaan', () => {
  it('menambah kolom label', async () => {
    await simulatePreMigration();
    for (const stmt of statements) await env.DB.prepare(stmt).run();
    expect(await columnInfo('berita_acara', 'label')).toBeTruthy();
  });

  it('tidak menimpa label yang sudah terisi (idempotent)', async () => {
    await simulatePreMigration();
    for (const stmt of statements) await env.DB.prepare(stmt).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,sumber,kegiatan_key,label) VALUES ('2026-10-01T08:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-10-01','Bagian','sgd|a|sgd 1','Sesi 1')"
    ).run();
    for (const stmt of statements) await env.DB.prepare(stmt).run();
    const row = await env.DB.prepare("SELECT label FROM berita_acara WHERE ba_id='BA-PEL-2026-0001'").first();
    expect(row.label).toBe('Sesi 1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/migration-ba-pelaksanaan-label.test.js`
Expected: FAIL — modul migrasi belum ada.

- [ ] **Step 3: Write the migration**

```sql
-- migrations/2026-10-15-ba-pelaksanaan-label.sql
-- BA Pelaksanaan: boleh lebih dari satu BA per kegiatan. Tambah label opsional
-- sebagai pembeda tampilan (mis. "Sesi 1"). Tidak menyentuh data lama.
ALTER TABLE berita_acara ADD COLUMN label TEXT DEFAULT '';
UPDATE berita_acara SET label = '' WHERE label IS NULL;
```

- [ ] **Step 4: Update `schema.sql`**

Ubah `schema.sql:115-119` menjadi:

```sql
CREATE TABLE berita_acara (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, dosen TEXT, jumlah_peserta TEXT,
  file_name TEXT, file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT, label TEXT DEFAULT ''
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/migration-ba-pelaksanaan-label.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add migrations/2026-10-15-ba-pelaksanaan-label.sql schema.sql test/migration-ba-pelaksanaan-label.test.js
git commit -m "feat(ba-pelaksanaan): add label column"
```

---

### Task 2: `beritaAcara.js` — multi-BA Bagian, simpan `label`, perbaiki simpan bisu

**Files:**
- Modify: `src/write/beritaAcara.js:115-128`, `:130-171`, `:299-375`
- Test: `test/write-berita-acara.test.js`

**Interfaces:**
- Consumes: `buildPersistBaStmts(db, table, pesertaTable, payload, meta)` dengan tambahan `meta.allowMultiple` (default `false`) dan `meta.withLabel` (default `false`).
- Produces:
  - `saveBeritaAcaraBagian` **tidak lagi menolak** upload kedua untuk kegiatan yang sama; menyimpan `payload.label`.
  - Baris `berita_acara` menyimpan `label`.
  - `updateBeritaAcaraBagian` dapat memperbarui `label`.

**Konteks bug:** `findDuplicateBa` memakai `bagian+blok+nama+tanggal` sebagai identitas, tetapi `buildPersistBaStmts` memakai guard `kegiatan_key NOT EXISTS` (tanpa tanggal). Akibatnya upload kedua dengan tanggal berbeda lolos dari `findDuplicateBa` namun di-*skip* senyap oleh guard → UI melaporkan sukses padahal tidak tersimpan (dan peserta juga tidak tersimpan karena `WHERE EXISTS ... ba_id` gagal).

- [ ] **Step 1: Write the failing tests**

Tambahkan ke `test/write-berita-acara.test.js` (di dalam `describe('berita acara bagian')`):

```js
  it('menyimpan BA Pelaksanaan kedua untuk kegiatan sama dengan tanggal berbeda', async () => {
    await seedPengajuan({ status: 'ACC' });
    const ctx = await bagianCtx(['SGD']);
    const first = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
    }, 'SGD', ctx);
    const second = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-21', label: 'Sesi 2', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
    }, 'SGD', ctx);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    const rows = await env.DB.prepare("SELECT ba_id, tanggal_pelaksanaan, label FROM berita_acara ORDER BY ba_id").all();
    expect(rows.results).toHaveLength(2);
    expect(rows.results[1].tanggal_pelaksanaan).toBe('2026-09-21');
    expect(rows.results[1].label).toBe('Sesi 2');
    const pes = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_peserta').first();
    expect(Number(pes.n)).toBe(2);
  });

  it('menyimpan BA Pelaksanaan kedua walau tanggal sama (dibedakan label)', async () => {
    await seedPengajuan({ status: 'ACC' });
    const ctx = await bagianCtx(['SGD']);
    const base = {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
    };
    await saveBeritaAcaraBagian(env.DB, { ...base, tanggalPelaksanaan: '2026-09-20', label: 'Sesi 1' }, 'SGD', ctx);
    const second = await saveBeritaAcaraBagian(env.DB, { ...base, tanggalPelaksanaan: '2026-09-20', label: 'Sesi 2' }, 'SGD', ctx);
    expect(second.success).toBe(true);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara').first();
    expect(Number(n.n)).toBe(2);
  });
```

Lalu **ubah** tes lama `'stores a BA with Sumber Bagian and blocks duplicates'` (baris `:115-127`) agar tidak lagi mengharapkan penolakan:

```js
  it('stores a BA with Sumber Bagian (duplikat kegiatan kini diizinkan)', async () => {
    await seedPengajuan({ status: 'ACC' });
    const payloadAcc = {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
    };
    const ctx = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, payloadAcc, 'SGD', ctx);
    expect(res.success).toBe(true);
    const ba = await env.DB.prepare('SELECT * FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(res.baId).toMatch(/^BA-PEL-\d{4}-0001$/);
    expect(ba.sumber).toBe('Bagian');

    const second = await saveBeritaAcaraBagian(env.DB, payloadAcc, 'SGD', ctx);
    expect(second.success).toBe(true);
    expect(second.baId).not.toBe(res.baId);
  });
```

Catatan: tes lain di `describe('berita acara bagian')` yang memakai `status='Diterima'`/`statusPengajuan:'Diterima'` akan gagal setelah Plan A (default status = ACC). Saat Plan A dieksekusi, ganti seluruh `'Diterima'` di file ini menjadi `'ACC'`. Bila Plan C dikerjakan lebih dulu, gunakan `'ACC'` pada tes baru dan biarkan yang lama apa adanya sampai Plan A.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/write-berita-acara.test.js`
Expected: FAIL — upload kedua ditolak / `label` tidak tersimpan.

- [ ] **Step 3: Implement di `src/write/beritaAcara.js`**

a) Hapus fungsi `findDuplicateBa` (`:115-128`) — tidak dipakai lagi.

b) Ubah `buildPersistBaStmts` (`:130-167`): tambah dukungan `label` dan `allowMultiple`.

```js
function buildPersistBaStmts(db, table, pesertaTable, payload, meta) {
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
  if (meta.withLabel) cols.label = str(payload.label);
  const keys = Object.keys(cols);
  const placeholders = keys.map((_, i) => '?' + (i + 1)).join(', ');
  const key = meta.allowMultiple ? '' : str(meta.kegiatanKey);
  const insertBa = key
    ? db.prepare(
      `INSERT INTO ${table} (${keys.join(', ')}) SELECT ${placeholders} ` +
      `WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE kegiatan_key = ?${keys.length + 1})`
    ).bind(...keys.map((k) => cols[k]), key)
    : db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).bind(...keys.map((k) => cols[k]));
  const stmts = [insertBa];
  for (const p of payload.__peserta) {
    stmts.push(
      db.prepare(
        `INSERT INTO ${pesertaTable} (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan) ` +
        `SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8 WHERE EXISTS (SELECT 1 FROM ${table} WHERE ba_id = ?2)`
      ).bind(ts, meta.baId, str(p.idPengajuan), p.npm, p.namaLengkap, p.blok, meta.bagian, p.statusPengajuan)
    );
  }
  return stmts;
}
```

c) `saveBeritaAcaraBagian` (`:299-348`): hapus blok `findDuplicateBa` dan teruskan `allowMultiple`/`withLabel`.

```js
export async function saveBeritaAcaraBagian(db, payload, kategori, ctx) {
  const p = payload || {};
  await requireBagianSession(db, kategori, p.bagian, ctx.token, ctx.session);
  const bagian = str(p.bagian) || str(kategori);

  const peserta = normalizeBaPeserta(p);
  if (!peserta.length) {
    return { success: false, message: 'Upload dibatalkan: tidak ada peserta pada berita acara ini. Pilih minimal satu peserta.' };
  }

  const blocked = await validateBaPesertaStatus(db, peserta);
  if (blocked.length) {
    const allowed = await getBagianBaStatuses(db);
    return {
      success: false,
      message: 'Upload dibatalkan: peserta belum berstatus ' + allowed.join(' / ') + ' — ' + blocked.join(', ') + '. Muat ulang data terlebih dahulu.'
    };
  }

  const baId = await nextBaId(db, 'berita_acara');
  let fileUrl = '';
  let fileName = '';
  if (p.file && p.file.data) {
    const up = await saveDriveFile(ctx.env, p.file, 'ba-' + baId);
    if (!up.ok) return { success: false, message: up.message };
    fileUrl = up.url;
    fileName = up.name || '';
  }

  p.__peserta = peserta;
  p.__jumlah = peserta.length;
  p.__sumber = 'Bagian';
  await db.batch([
    ...buildPersistBaStmts(db, 'berita_acara', 'berita_acara_peserta', p, {
      baId: baId, bagian: bagian, fileName: fileName, fileUrl: fileUrl,
      kegiatanKey: kegiatanKey(bagian, str(p.blok), str(p.namaKegiatan)),
      withDosen: true, withLabel: true, allowMultiple: true
    }),
    ...buildSyncStmts(db, peserta, str(p.dosen), str(p.tanggalPelaksanaan), str(p.jam))
  ]);

  return { success: true, baId: baId, message: 'Berita acara berhasil diunggah.' };
}
```

d) `updateBeritaAcaraBagian` (`:350-375`): sertakan `label`.

```js
  const sets = ['tanggal_pelaksanaan = ?1', 'jam = ?2', 'dosen = ?3', 'catatan = ?4', 'label = ?5'];
  const vals = [
    tanggal,
    p.jam !== undefined ? str(p.jam) : str(existing.jam),
    p.dosen !== undefined ? str(p.dosen) : str(existing.dosen),
    p.catatan !== undefined ? str(p.catatan) : str(existing.catatan),
    p.label !== undefined ? str(p.label) : str(existing.label)
  ];
```

(Pastikan indeks `?` pada `WHERE ba_id = ?` menjadi `vals.length + 1` seperti pola yang ada.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/write-berita-acara.test.js`
Expected: PASS. Tes lama BA Pendukung (`menolak BA Pendukung kedua...`, balapan) tetap hijau karena `allowMultiple` default `false`.

- [ ] **Step 5: Commit**

```bash
git add src/write/beritaAcara.js test/write-berita-acara.test.js
git commit -m "fix(ba-pelaksanaan): allow multiple BAs per kegiatan and store label"
```

---

### Task 3: `columns.js` + `bagian.js` — tandai kandidat yang sudah punya BA (opsi A)

**Files:**
- Modify: `src/read/columns.js:26-31`
- Modify: `src/read/bagian.js:23-66`
- Test: `test/read-bagian.test.js`

**Interfaces:**
- Produces: setiap baris hasil `computeBagianRows` memiliki properti `baMember: boolean` — `true` bila `idPengajuan` sudah menjadi peserta BA Pelaksanaan (`berita_acara_peserta`) untuk kegiatan yang sama (`kegiatan_key`), lintas tanggal & label.

- [ ] **Step 1: Write the failing test**

Tambahkan ke `test/read-bagian.test.js`:

```js
  it('menandai peserta yang sudah masuk BA Pelaksanaan sebagai baMember', async () => {
    await seed();
    await env.DB.prepare("UPDATE berita_acara SET kegiatan_key='ujian|a|uas' WHERE ba_id='BA-2026-0001'").run();
    await env.DB.prepare("UPDATE berita_acara_peserta SET id_pengajuan='INHAL-1' WHERE ba_id='BA-2026-0001'").run();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.rows[0].baMember).toBe(true);

    await env.DB.prepare("DELETE FROM berita_acara_peserta").run();
    const boot2 = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot2.rows[0].baMember).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/read-bagian.test.js`
Expected: FAIL — `baMember` belum ada (undefined).

- [ ] **Step 3: Tambah mapping kolom `label` di `src/read/columns.js`**

Ubah objek `berita_acara` (baris 26-31):

```js
  berita_acara: {
    timestamp: 'Timestamp', ba_id: 'BA ID', bagian: 'Bagian', blok: 'Blok',
    nama_kegiatan: 'Nama Kegiatan', tanggal_pelaksanaan: 'Tanggal Pelaksanaan', jam: 'Jam',
    dosen: 'Dosen', jumlah_peserta: 'Jumlah Peserta', file_name: 'File Name', file_url: 'File URL',
    catatan: 'Catatan', sumber: 'Sumber', kegiatan_key: 'Kegiatan Key', label: 'Label'
  },
```

- [ ] **Step 4: Implement `baMember` di `src/read/bagian.js`**

Tambahkan impor `kegiatanKey` (baris 3-6 jadi):

```js
import {
  baginaKey, getMasterOptions, getBagianBaSettings, baginaHasAccess,
  getBagianAliasMap, resolveBagian12, kegiatanKey
} from './common.js';
```

Di dalam `computeBagianRows`, sebelum loop `rows`, bangun peta keanggotaan:

```js
  const baKeyByBaId = {};
  for (const b of (await db.prepare('SELECT ba_id, kegiatan_key FROM berita_acara').all()).results || []) {
    const id = String(b.ba_id || '').trim();
    if (id) baKeyByBaId[id] = String(b.kegiatan_key || '').trim();
  }
  const baMemberByKey = {};
  for (const p of (await db.prepare('SELECT ba_id, id_pengajuan FROM berita_acara_peserta').all()).results || []) {
    const key = baKeyByBaId[String(p.ba_id || '').trim()];
    const idp = String(p.id_pengajuan || '').trim();
    if (!key || !idp) continue;
    if (!baMemberByKey[key]) baMemberByKey[key] = new Set();
    baMemberByKey[key].add(idp);
  }
  const bagianForKey = String(subBagian || kategori || '').trim();
```

Lalu di dalam loop `rows.push({ ... })` tambahkan:

```js
      const namaKegiatan = String(d.Pilihan || '').trim() + (String(d.Detail || '').trim() ? ' - ' + String(d.Detail || '').trim() : '');
      const kk = kegiatanKey(bagianForKey, String(prow.Blok || '').trim(), namaKegiatan);
      const memberSet = baMemberByKey[kk];
      baMember: !!(memberSet && memberSet.has(id))
```

(sisipkan sebagai properti baru pada objek yang di-`push`).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/read-bagian.test.js test/read-columns.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/read/columns.js src/read/bagian.js test/read-bagian.test.js
git commit -m "feat(ba-pelaksanaan): expose baMember flag on bagian rows"
```

---

### Task 4: UI `bagian.html` — label, teks ACC, konfirmasi multi-BA, saring kandidat

**Files:**
- Modify: `public/bagian.html:248-251` (teks picker), `:305-349` (form), `:425` (teks konfirmasi), `:518` (state), `:526-566` (computed), `:954-999` (submit/upload), `:388-407` (daftar BA)
- Test: `test/bagian-template.test.js`

**Interfaces:**
- Consumes: `rows[].baMember`, RPC `uploadBeritaAcaraBagian` dengan `label`.
- Produces: input label opsional; kandidat menyaring `baMember`; konfirmasi duplikat bersifat informatif.

- [ ] **Step 1: Write the failing guard test**

Tambahkan ke `test/bagian-template.test.js`:

```js
describe('guard BA Pelaksanaan multi', () => {
  it('menyediakan input label dan menyaring baMember', async () => {
    const html = (await import('../public/bagian.html?raw')).default;
    expect(html).toContain('ba.label');
    expect(html).toContain('baMember');
    expect(html).not.toContain('Diterima / ACC');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/bagian-template.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement di `public/bagian.html`**

a) Teks picker (`:248-251`):

```html
<div class="section-title"><i class="bi bi-calendar-check"></i> Pilih Kegiatan (ACC)</div>
<div v-if="!kegiatanGroups.length" class="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
    Belum ada kegiatan dengan peserta berstatus ACC yang belum masuk berita acara.
</div>
```

b) State (`:518`) — tambah `label`:

```js
ba: { open: false, kegiatanKey: null, tanggal: '', label: '', catatan: '', file: null, fileName: '', selected: {}, confirm: false, scanItems: [], scanBusy: false, scanSeq: 0 },
```

c) Form (`:305-349`) — tambah input label sebelum "Tanggal Pelaksanaan":

```html
<div>
    <label class="label">Label <span class="font-normal text-slate-400">(opsional)</span></label>
    <input v-model="ba.label" class="input" placeholder="mis. Sesi 1 / Hari ke-2">
</div>
```

d) Teks konfirmasi (`:425`): ganti menjadi "Pastikan seluruh peserta berstatus ACC".

```html
<p class="text-xs text-slate-400">Pastikan seluruh peserta berstatus ACC</p>
```

e) Blok peringatan duplikat (`:432-435`): ubah dari "akan ditolak" menjadi informatif dan sediakan placeholder untuk menampilkan label.

```html
<div v-if="baDuplicate" class="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
    <i class="bi bi-info-circle mt-0.5 shrink-0"></i>
    <span>Sudah ada BA untuk kegiatan ini (Blok {{ selectedGroup.blok }}, {{ formatTanggal(baDuplicate['Tanggal Pelaksanaan']) }}). Upload ini akan menambah BA baru.</span>
</div>
```

f) `kegiatanGroups` (`:526-566`): saring `baMember`. Ganti isi `this.rows.forEach`:

```js
this.rows.forEach(function(r) {
    if (r.baMember) return;
    const key = [r.jenis, r.pilihan, r.detail, r.tanggal, r.blok].join('|');
    if (!map[key]) {
        map[key] = {
            key: key,
            jenis: r.jenis,
            pilihan: r.pilihan,
            detail: r.detail,
            tanggal: r.tanggal,
            blok: r.blok,
            label: 'Blok ' + r.blok + ' · ' + r.pilihan + (r.detail ? ' - ' + r.detail : ''),
            peserta: [],
            statusCounts: {},
            blocked: false
        };
    }
    const g = map[key];
    g.statusCounts[r.status] = (g.statusCounts[r.status] || 0) + 1;
    if (statuses.indexOf(r.status) !== -1) {
        g.peserta.push({
            idPengajuan: r.idPengajuan,
            npm: r.npm,
            namaLengkap: r.namaLengkap,
            blok: r.blok,
            statusPengajuan: r.status
        });
    }
    if (finalOnly && r.status === 'Menunggu') g.blocked = true;
});
```

g) `openBaPicker`/`closeBaPicker` (`:808-828`): reset `this.ba.label = '';` pada keduanya.

h) `doUploadBa` (`:978-986`): sertakan label di payload:

```js
                        const payload = {
                            namaKegiatan: this.selectedGroup.pilihan + (this.selectedGroup.detail ? ' - ' + this.selectedGroup.detail : ''),
                            tanggalPelaksanaan: this.ba.tanggal,
                            label: this.ba.label.trim(),
                            blok: this.selectedGroup.blok,
                            catatan: this.ba.catatan.trim(),
                            bagian: this.subBagian || this.kategori,
                            peserta: this.selectedList,
                            file: await this.readFileAsBase64(this.ba.file)
                        };
```

i) Daftar BA (`:388-407`): tampilkan label bila ada — setelah baris `Nama Kegiatan` (`:393`):

```html
<div v-if="r.Label" class="mt-0.5 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{{ r.Label }}</div>
```

j) `loadBaConfig` fallback (`:739`) dan `baConfig` awal (`:506`): ganti default `['Diterima','ACC']` menjadi `['ACC']`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/bagian-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/bagian.html test/bagian-template.test.js
git commit -m "feat(bagian): label + multi-BA confirmation + hide existing BA members"
```

---

### Task 5: UI `dashboard.html` — panel Bagian (label, teks ACC, konfirmasi multi-BA, saring kandidat)

**Files:**
- Modify: `public/dashboard.html:1402` (teks), `:1431-1468` (form), `:2332` (state), `:2439-2457` (computed), `:2849-2857` (payload), `:1508-1531` (konfirmasi)
- Test: `test/dashboard-ba-pendukung.test.js`

**Interfaces:**
- Consumes: `bab.rows[].baMember`, RPC `uploadBeritaAcaraBagian` dengan `label`.
- Produces: panel "Unggah BA Pelaksanaan" mendukung label, menyaring `baMember`, konfirmasi duplikat informatif.

- [ ] **Step 1: Write the failing guard test**

Tambahkan ke `test/dashboard-ba-pendukung.test.js`:

```js
describe('guard panel BA Pelaksanaan multi', () => {
  it('menyediakan label & menyaring baMember', async () => {
    const html = (await import('../public/dashboard.html?raw')).default;
    expect(html).toContain('bab.ba.label');
    expect(html).toContain('r.baMember');
    expect(html).toContain('menambah BA baru');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/dashboard-ba-pendukung.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement di `public/dashboard.html`**

a) Teks picker (`:1402`): ganti menjadi:

```html
<label class="label">Pilih Kegiatan ({{ (bab.baSettings.statuses || ['ACC']).join(' / ') }})</label>
```

b) State `bab.ba` (`:2332`): tambah `label: ''`.

c) Form (`:1431-1468`): tambah input label di grid, sebelum field tanggal:

```html
<div><label class="label">Label <span class="font-normal text-slate-400">(opsional)</span></label><input v-model="bab.ba.label" class="input" placeholder="mis. Sesi 1"></div>
```

d) Konfirmasi (`:1508-1531`): tambahkan baris peringatan informatif di dalam modal (sebelum tombol). Karena `babDuplicate` belum ada, tambahkan computed baru (lihat e) dan gunakan:

```html
<div v-if="babDuplicate" class="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-200">
    <i class="bi bi-info-circle mt-0.5 shrink-0"></i>
    <span>Sudah ada BA untuk kegiatan ini. Upload ini akan menambah BA baru.</span>
</div>
```

e) `babKegiatanGroups` (`:2439-2457`): saring `baMember`:

```js
                babKegiatanGroups() {
                    const map = {};
                    const statuses = (this.bab.baSettings && this.bab.baSettings.statuses) || ['ACC'];
                    const finalOnly = !(this.bab.baSettings && this.bab.baSettings.finalOnly === false);
                    (this.bab.rows || []).forEach(r => {
                        if (r.baMember) return;
                        const key = [r.jenis, r.pilihan, r.detail, r.tanggal, r.blok].join('|');
                        if (!map[key]) {
                            map[key] = { key: key, jenis: r.jenis, pilihan: r.pilihan, detail: r.detail, tanggal: r.tanggal, blok: r.blok, label: 'Blok ' + r.blok + ' · ' + r.pilihan + (r.detail ? ' - ' + r.detail : ''), peserta: [], statusCounts: {}, blocked: false };
                        }
                        const g = map[key];
                        g.statusCounts[r.status] = (g.statusCounts[r.status] || 0) + 1;
                        if (statuses.indexOf(r.status) !== -1) {
                            g.peserta.push({ idPengajuan: r.idPengajuan, npm: r.npm, namaLengkap: r.namaLengkap, blok: r.blok, statusPengajuan: r.status });
                        }
                        if (finalOnly && r.status === 'Menunggu') g.blocked = true;
                    });
                    const out = Object.values(map).filter(g => !g.blocked && g.peserta.length > 0);
                    out.forEach(g => { g.statusOrder = Object.keys(g.statusCounts); });
                    return out;
                },
                babDuplicate() {
                    const g = this.babSelectedGroup;
                    if (!g) return null;
                    const nama = g.pilihan + (g.detail ? ' - ' + g.detail : '');
                    const bagian = String(this.bab.subBagian || this.bab.kategori || '').trim();
                    return (this.bab.baList || []).find(r => String(r.Bagian || '').trim() === bagian
                        && String(r.Blok || '').trim() === String(g.blok || '').trim()
                        && String(r['Nama Kegiatan'] || '').trim() === nama) || null;
                },
```

f) State `bab.baSettings` (`:2331`) default → `{ statuses: ['ACC'], finalOnly: true }`.

g) `babOpenBaPicker`/`babCloseBaPicker` (`:2784-2802`): reset `this.bab.ba.label = '';`.

h) `babDoUploadBa` (`:2849-2857`): tambah `label: this.bab.ba.label.trim(),` pada payload.

i) Pastikan `bab.rows` sudah membawa `baMember` (dari `getBagianBootstrap`, dipakai `babLoad`). Tidak ada perubahan tambahan.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/dashboard-ba-pendukung.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/dashboard.html test/dashboard-ba-pendukung.test.js
git commit -m "feat(dashboard): label + multi-BA confirmation in bagian panel"
```

---

### Task 6: Verifikasi menyeluruh

- [ ] **Step 1: Jalankan seluruh suite**

Run: `npm test`
Expected: seluruh tes PASS.

- [ ] **Step 2: Pastikan tidak ada sisa guard/fungsi lama**

Run: `rg -n "findDuplicateBa|Sudah ada berita acara untuk" src public`
Expected: tidak ada hasil.

- [ ] **Step 3: Pastikan guard anti-balapan admin masih ada**

Run: `rg -n "NOT EXISTS \(SELECT 1 FROM" src/write/beritaAcara.js`
Expected: 1 hasil (guard di `buildPersistBaStmts`, aktif hanya saat `allowMultiple=false`).

- [ ] **Step 4: Commit (bila ada sisa penyesuaian)**

```bash
git add -A
git commit -m "chore(ba-pelaksanaan): final sweep"
```

---

## Catatan Deploy (manual oleh user)

```bash
cd /workspace/new-code1-cf
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=migrations/2026-10-15-ba-pelaksanaan-label.sql
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```

## Catatan Keputusan (terkunci)

- `berita_acara.kegiatan_key` tetap diisi `kegiatanKey(bagian, blok, nama)` untuk **semua** BA Pelaksanaan kegiatan yang sama; baris boleh berbagi `kegiatan_key`. Ini dipakai untuk grouping dan untuk deteksi `baMember` (opsi A).
- `syncPengajuanPelaksanaan`/`buildSyncStmts` tetap menulis `dosen`/`tanggal_pelaksanaan` ke `pengajuan` untuk peserta. Bila ada beberapa BA untuk kegiatan sama, nilai terakhir yang menang. Perilaku ini **tidak diubah** di plan ini (laporan final menyusul di Plan D).
- Dedup agregasi dashboard (`src/read/dashboard.js:256`) memakai `sumber|bagian|blok|nama|tanggal|fileUrl`; dua BA dengan tanggal + file sama akan ter-dedup. Kasus ini dianggap tidak lazim (tiap BA punya berkas scan sendiri) dan tidak ditangani di plan ini.

## Self-Review

- **Spec coverage:** kolom `label` (Task 1); multi-BA + simpan `label` + perbaikan simpan bisu (Task 2); `baMember`/opsi A (Task 3); UI Bagian (Task 4); UI dashboard panel Bagian (Task 5); verifikasi (Task 6).
- **Placeholder scan:** tidak ada TODO; setiap langkah berisi kode/perintah.
- **Type consistency:** `meta.allowMultiple`/`meta.withLabel` konsisten di Task 2; `baMember` boolean konsisten di Task 3 & 4/5; `babDuplicate` baru didefinisikan sebelum dipakai di Task 5.
