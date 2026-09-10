# Portal Mahasiswa Cloudflare Workers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyajikan halaman Portal Mahasiswa (`portal.html`) dari `new-code1` di Cloudflare Workers + Hono + D1, dapat dibuka di `/portal`.

**Architecture:** Worker yang sama melayani aset statis (`public/portal.html`) dan REST `/api/*` lewat Hono. Halaman GAS dipakai ulang; hanya method `run()` dan dua scriptlet yang diganti. Satu endpoint baru membaca riwayat mahasiswa dari D1; endpoint unggah berkas dibuat stub.

**Tech Stack:** Cloudflare Workers, Hono 4, D1, Wrangler 4, Vitest + `@cloudflare/vitest-pool-workers`, Node 22.

## Global Constraints

- Semua pekerjaan di dalam `new-code1-cf/`; **jangan mengubah** file apa pun di `new-code1/` atau `new-code2/`.
- Runtime Workers; `compatibility_date = "2026-09-01"` (sudah ada).
- Binding D1 bernama `DB`; binding aset bernama `ASSETS` (sudah ada).
- Login portal cukup NPM (tanpa kata sandi).
- Unggah berkas (ACC INHAL & bukti bayar) **tidak diimplementasikan**; hanya stub dengan pesan jelas.
- NPM dicocokkan setelah menghilangkan karakter non-angka.
- Pesan data kosong: `Data pengajuan tidak ditemukan untuk NPM <npm>.`
- Pesan stub unggah: `Fitur unggah berkas akan tersedia pada tahap berikutnya.`
- Setiap task diakhiri commit dengan trailer `Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>`.
- Perintah `npm`, `npx vitest`, `wrangler`, `cp`, dan `node` dijalankan dari dalam `new-code1-cf/`.
- Perintah `git` dijalankan dari root repo (`/workspace`) dengan path berawalan `new-code1-cf/`.

---

### Task 1: `getStudentPortalData` (backend baca riwayat)

**Files:**
- Create: `new-code1-cf/src/portal.js`
- Test: `new-code1-cf/test/portal.test.js`

**Interfaces:**
- Consumes: `getBuktiMode`, `getStudentNameByNpm` dari `src/repo.js`; binding `DB`.
- Produces:
  - `normalizeNpm(value: string): string` — hanya angka.
  - `getStudentPortalData(db, npm): Promise<object>` — sukses `{ nama, npm, email, noHp, buktiMode, history[] }`, gagal `{ error }`. Item `history`: `{ id, idPengajuan, tanggalAjuan, blok, jenis, detail, tanggalKegiatan, status, reason, hasUpload, linkFinal, uploadTimestamp }`.

- [ ] **Step 1: Write the failing test**

Create `new-code1-cf/test/portal.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { getStudentPortalData } from '../src/portal.js';

async function seedPengajuan() {
  await env.DB.prepare(
    'INSERT INTO pengajuan (timestamp, id_pengajuan, npm, nama_lengkap, email, no_hp_wa, blok, jenis_kegiatan, status, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)'
  ).bind('2026-09-10T08:00:00', 'INHAL-a', '2201010001', 'Aisyah Putri', 'aisyah@contoh.com', '08123456789', 'A', 'Ujian', 'Diterima', '2026-09-10T08:00:00').run();
  await env.DB.prepare(
    'INSERT INTO detail_kegiatan (timestamp, id_pengajuan, jenis_kegiatan, pilihan, detail, tanggal_pelaksanaan, bagian) VALUES (?1,?2,?3,?4,?5,?6,?7)'
  ).bind('2026-09-10T08:00:00', 'INHAL-a', 'Ujian', 'UAS', '', '2026-09-20', '').run();
}

describe('getStudentPortalData', () => {
  it('builds history for a known npm', async () => {
    await seedPengajuan();
    const data = await getStudentPortalData(env.DB, '2201010001');
    expect(data.error).toBeUndefined();
    expect(data.nama).toBe('Aisyah Putri');
    expect(data.buktiMode).toBe('strict');
    expect(data.history).toHaveLength(1);
    const h = data.history[0];
    expect(h.idPengajuan).toBe('INHAL-a');
    expect(h.jenis).toBe('Ujian');
    expect(h.detail).toBe('UAS');
    expect(h.tanggalKegiatan).toBe('2026-09-20');
    expect(h.status).toBe('Diterima');
    expect(h.hasUpload).toBe(false);
    expect(h.linkFinal).toBe('');
  });

  it('matches npm regardless of non-digit characters', async () => {
    await seedPengajuan();
    const data = await getStudentPortalData(env.DB, ' 2201-010-001 ');
    expect(data.history).toHaveLength(1);
  });

  it('falls back to mahasiswa name when there is no pengajuan', async () => {
    const data = await getStudentPortalData(env.DB, '2201010002');
    expect(data.nama).toBe('Budi Santoso');
    expect(data.history).toEqual([]);
  });

  it('returns error for an unknown npm', async () => {
    const data = await getStudentPortalData(env.DB, '9999999999');
    expect(data.error).toContain('tidak ditemukan');
  });

  it('returns error for an empty npm', async () => {
    const data = await getStudentPortalData(env.DB, '');
    expect(data.error).toBe('NPM tidak boleh kosong');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/portal.test.js`
Expected: FAIL — `Failed to resolve import "../src/portal.js"`.

- [ ] **Step 3: Write the implementation**

Create `new-code1-cf/src/portal.js`:

```js
import { getBuktiMode, getStudentNameByNpm } from './repo.js';

export function normalizeNpm(value) {
  return String(value == null ? '' : value).replace(/[^0-9]/g, '');
}

export async function getStudentPortalData(db, npm) {
  const npmRaw = String(npm == null ? '' : npm).trim();
  const npmKey = normalizeNpm(npmRaw);
  if (!npmKey) {
    return { error: 'NPM tidak boleh kosong' };
  }

  const { results: all } = await db.prepare('SELECT * FROM pengajuan').all();
  const { results: details } = await db.prepare('SELECT * FROM detail_kegiatan').all();
  const detailById = new Map();
  for (const d of details || []) {
    if (!detailById.has(d.id_pengajuan)) detailById.set(d.id_pengajuan, []);
    detailById.get(d.id_pengajuan).push(d);
  }

  const rows = (all || []).filter((p) => normalizeNpm(p.npm) === npmKey);
  let namaLengkap = '';
  const history = [];

  rows.forEach((p) => {
    if (!namaLengkap && p.nama_lengkap) namaLengkap = String(p.nama_lengkap).trim();
    const id = String(p.id_pengajuan || '').trim();
    const pDetails = detailById.get(id) || [];
    const detailText = pDetails
      .map((d) => [d.pilihan || '', d.detail || ''].filter(Boolean).join(' - '))
      .filter(Boolean)
      .join('; ');
    const tanggalKegiatan = pDetails.length
      ? (pDetails[0].tanggal_pelaksanaan || '')
      : (p.tanggal_pelaksanaan || '');
    const hasUpload = !!(p.link_acc_inhal || p.link_bukti_bayar);
    history.push({
      id: id,
      idPengajuan: id,
      tanggalAjuan: p.timestamp || '',
      blok: p.blok || '',
      jenis: String(p.jenis_kegiatan || '').trim(),
      detail: detailText,
      tanggalKegiatan: tanggalKegiatan,
      status: p.status || 'Menunggu',
      reason: p.catatan_admin || '',
      hasUpload: hasUpload,
      linkFinal: p.link_final || '',
      uploadTimestamp: hasUpload ? (p.updated_at || 'Uploaded') : ''
    });
  });

  if (!namaLengkap) {
    namaLengkap = await getStudentNameByNpm(db, npmKey);
  }
  if (!namaLengkap && history.length === 0) {
    return { error: 'Data pengajuan tidak ditemukan untuk NPM ' + npmRaw + '.' };
  }

  history.sort((a, b) => String(b.tanggalAjuan || '').localeCompare(String(a.tanggalAjuan || '')));

  let latestEmail = '';
  let latestNoHp = '';
  const sortedRows = rows.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  for (const r of sortedRows) {
    if (!latestEmail && r.email) latestEmail = String(r.email).trim();
    if (!latestNoHp && r.no_hp_wa) latestNoHp = String(r.no_hp_wa).trim();
    if (latestEmail && latestNoHp) break;
  }

  const buktiMode = await getBuktiMode(db);

  return {
    nama: namaLengkap || 'Mahasiswa',
    npm: npmRaw,
    email: latestEmail,
    noHp: latestNoHp,
    buktiMode: buktiMode,
    history: history
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/portal.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/portal.js new-code1-cf/test/portal.test.js
git commit -m "feat(new-code1-cf): add student portal data reader

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 2: Rute API portal

**Files:**
- Modify: `new-code1-cf/src/index.js`
- Test: `new-code1-cf/test/api.test.js`

**Interfaces:**
- Consumes: `getStudentPortalData` dari `src/portal.js`.
- Produces:
  - `GET /api/portal/:npm` → JSON objek hasil `getStudentPortalData`.
  - `POST /api/portal/upload` → `{ success: false, message: 'Fitur unggah berkas akan tersedia pada tahap berikutnya.' }` (HTTP 200).

- [ ] **Step 1: Write the failing test**

Append to `new-code1-cf/test/api.test.js`:

```js
describe('portal endpoints', () => {
  it('returns portal data for a known npm', async () => {
    const res = await SELF.fetch('http://example.com/api/portal/2201010001');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nama).toBe('Aisyah Putri');
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.buktiMode).toBe('strict');
  });

  it('returns an error object for an unknown npm', async () => {
    const res = await SELF.fetch('http://example.com/api/portal/9999999999');
    expect(res.status).toBe(200);
    expect(typeof (await res.json()).error).toBe('string');
  });

  it('stubs the upload endpoint', async () => {
    const res = await SELF.fetch('http://example.com/api/portal/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('tahap berikutnya');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/api.test.js`
Expected: FAIL — status 404 untuk `/api/portal/...`.

- [ ] **Step 3: Write the implementation**

Edit `new-code1-cf/src/index.js`. Tambahkan import setelah baris `import { registerPengajuan } from './pengajuan.js';`:

```js
import { getStudentPortalData } from './portal.js';
```

Tambahkan rute berikut sebelum `export default app;`:

```js
app.get('/api/portal/:npm', async (c) => {
  const data = await getStudentPortalData(c.env.DB, c.req.param('npm'));
  return c.json(data);
});

app.post('/api/portal/upload', (c) => {
  return c.json({ success: false, message: 'Fitur unggah berkas akan tersedia pada tahap berikutnya.' });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/api.test.js`
Expected: PASS (semua test di file tersebut).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS (api + lib + repo + pengajuan + portal).

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/src/index.js new-code1-cf/test/api.test.js
git commit -m "feat(new-code1-cf): add portal API routes

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 3: Halaman portal + rute `/portal`

**Files:**
- Create: `new-code1-cf/public/portal.html` (salinan `new-code1/pages/portal.html`)
- Modify: `new-code1-cf/wrangler.toml`
- Modify: `new-code1-cf/src/index.js`

**Interfaces:**
- Consumes: seluruh endpoint Task 2 & endpoint lama; binding `ASSETS`.
- Produces: `GET /portal` menyajikan `public/portal.html`; halaman portal memakai `fetch`.

- [ ] **Step 1: Copy the page**

Run:
```bash
cp ../new-code1/pages/portal.html public/portal.html
```
Expected: `public/portal.html` ada (1011 baris).

- [ ] **Step 2: Replace the two scriptlets**

Di `new-code1-cf/public/portal.html`:

Baris `<title><?= PAGE_TITLES.portal ?></title>` diganti menjadi:
```html
    <title>Portal Mahasiswa INHAL</title>
```

Baris `const APP_URL = '<?= appUrl ?>';` diganti menjadi:
```js
        const APP_URL = '';
```

- [ ] **Step 3: Replace the `run()` method**

Di `new-code1-cf/public/portal.html`, ganti method `run(fn, ...args)` yang memakai `google.script.run` menjadi:

```js
                run(fn, ...args) {
                    const map = {
                        getRegistrationOptions: () => ({ method: 'GET', url: '/api/registration-options' }),
                        getStudentNameByNpm: (npm) => ({ method: 'GET', url: '/api/mahasiswa/' + encodeURIComponent(npm) }),
                        registerPengajuan: (payload) => ({ method: 'POST', url: '/api/pengajuan', body: payload }),
                        getStudentPortalData: (npm) => ({ method: 'GET', url: '/api/portal/' + encodeURIComponent(npm) }),
                        uploadBuktiFiles: (payload) => ({ method: 'POST', url: '/api/portal/upload', body: payload })
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

- [ ] **Step 4: Add `/portal` to run_worker_first**

Di `new-code1-cf/wrangler.toml`, ubah baris:
```toml
run_worker_first = ["/api/*"]
```
menjadi:
```toml
run_worker_first = ["/api/*", "/portal"]
```

- [ ] **Step 5: Add the `/portal` route**

Di `new-code1-cf/src/index.js`, tambahkan rute berikut sebelum `export default app;`:

```js
app.get('/portal', (c) => {
  const url = new URL('/portal.html', c.req.url);
  return c.env.ASSETS.fetch(new Request(url, c.req.raw));
});
```

- [ ] **Step 6: Smoke check the shim**

Run:
```bash
node --input-type=module -e "import {readFileSync} from 'fs'; const h=readFileSync('public/portal.html','utf8'); for (const s of ['/api/registration-options','/api/mahasiswa/','/api/pengajuan','/api/portal/','/api/portal/upload']) { if(!h.includes(s)) throw new Error('missing '+s); } if (h.includes('google.script.run')) throw new Error('google.script.run still present'); if (h.includes('<?=')) throw new Error('scriptlet still present'); console.log('portal shim ok');"
```
Expected: `portal shim ok`

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS semua test.

- [ ] **Step 8: Manual end-to-end verification**

```bash
npm run db:local
npx wrangler dev
```

Lalu:
1. `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/portal` → `200`
2. `curl -s http://127.0.0.1:8787/api/portal/2201010001` → JSON dengan `"nama":"Aisyah Putri"` dan `"history":[...]`
3. Buka `http://127.0.0.1:8787/portal` di browser, login dengan NPM `2201010001`, lihat dashboard muncul.

- [ ] **Step 9: Commit**

```bash
git add new-code1-cf/public/portal.html new-code1-cf/src/index.js new-code1-cf/wrangler.toml
git commit -m "feat(new-code1-cf): serve portal page at /portal

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

---

### Task 4: Dokumentasi + deploy

**Files:**
- Modify: `new-code1-cf/README.md`
- Modify: `new-code1-cf/DEPLOY.md`

**Interfaces:**
- Consumes: seluruh task sebelumnya.
- Produces: dokumentasi rute `/portal` dan cara deploy ulang.

- [ ] **Step 1: Update the README**

Di `new-code1-cf/README.md`, tambahkan baris pada tabel Endpoint:

```
| GET | `/portal` | Halaman Portal Mahasiswa |
| GET | `/api/portal/:npm` | Data portal (riwayat) mahasiswa |
| POST | `/api/portal/upload` | Stub unggah berkas (belum aktif) |
```

Tambahkan juga di bawah tabel:
```markdown
Halaman:
- `/` — Pendaftaran
- `/portal` — Portal Mahasiswa (login cukup NPM)

Unggah berkas ACC/bukti bayar belum aktif (ditunda ke tahap berikutnya).
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS semua file test.

- [ ] **Step 3: Commit docs**

```bash
git add new-code1-cf/README.md
git commit -m "docs(new-code1-cf): document portal routes

Co-authored-by: monkeycode-ai <monkeycode-ai@chaitin.com>"
```

- [ ] **Step 4: Deploy**

Run:
```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```
Expected: sukses, menampilkan URL Worker.

- [ ] **Step 5: Verify production**

Run:
```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deployments list
```
Expected: versi terbaru 100%.

Catatan: sandbox ini tidak bisa membuka `*.workers.dev` (TLS diblokir), jadi verifikasi tampilan dilakukan dari browser pengguna di `https://inhal-poc.new-code1-cf.workers.dev/portal`.

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| 4. Struktur file (`portal.js`, `portal.html`, test) | Task 1, 3 |
| 5.1 `GET /api/portal/:npm` + pemetaan data | Task 1, 2 |
| 5.2 `POST /api/portal/upload` stub | Task 2 |
| 6. Shim frontend + scriptlet | Task 3 |
| 7. Routing `/portal` + `run_worker_first` | Task 3 |
| 8. Pengujian | Task 1, 2, 3 |
| 9. Deploy | Task 4 |
| 10. Risiko (data kosong, status, upload) | Task 1 (error message), Task 2 (stub) |

**2. Placeholder scan:** tidak ada TBD/TODO; semua step memuat kode/perintah lengkap.

**3. Type consistency:** `getStudentPortalData`, `normalizeNpm`, `getBuktiMode`, `getStudentNameByNpm`, dan properti riwayat (`idPengajuan`, `hasUpload`, `linkFinal`, `buktiMode`, dll) konsisten dengan spec dan klien `portal.html`.
