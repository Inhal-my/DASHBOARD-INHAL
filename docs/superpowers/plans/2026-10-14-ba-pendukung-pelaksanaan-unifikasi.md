# Unifikasi BA Pendukung & Koeksistensi BA Pelaksanaan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan alur BA Pendukung per-peserta sebagai satu-satunya jalur, memperbaiki dedup agregasi agar BA Pendukung & BA Pelaksanaan selalu berdampingan, dan menambah panel kelola di tab Berita Acara + tab Input Manual.

**Architecture:** Backend Worker (Cloudflare) + D1. Agregasi unit di `src/read/dashboard.js` menerima perbaikan kunci dedup dan indikator. Fungsi tulis per-peserta di `src/write/baAdmin.js` ditambah `addBaAdminPesertaWithBerkas` yang menyatukan buat-BA + unggah berkas + regenerate PDF, diekspos via RPC `baAdminAddPesertaBerkas`. Frontend Vue 3 (CDN lokal, tanpa build step) di `public/dashboard.html` mendapat modal tunggal "Kelola BA Pendukung" yang dipakai dari tab BA, detail pengajuan, dan tab Manual; alur lama "satu file per kegiatan" dihentikan dari UI.

**Tech Stack:** JavaScript ESM, Cloudflare Workers, D1 (SQLite), Vitest (`@cloudflare/vitest-pool-workers`), pdf-lib, Vue 3 (global build lokal), Tailwind (bundle precompiled inline).

## Global Constraints

- Tanpa langkah build & tanpa CDN runtime. Kelas Tailwind baru WAJIB di-*hand-define* di blok `<style>` dashboard. Prefix kelas baru `in-*` bila membuat kelas custom.
- Jangan hapus/rename kelas CSS atau marker yang di-assert tes lama, kecuali tes tersebut memang diubah eksplisit di plan ini.
- Salinan (copy) berbahasa Indonesia, konsisten dengan UI yang ada.
- Tes dijalankan dari `new-code1-cf/`: `cd new-code1-cf && npx vitest run <file>`. Flake env `Network connection lost` → ulangi sekali.
- Jangan commit kecuali diminta. Bila diminta: branch `YYMMDD-feat-...`, jangan force-push.
- Batas berkas BA: `BA_ADMIN_MAX_PAGES = 50`, `BA_ADMIN_MAX_BYTES = 20 * 1024 * 1024` (`src/write/baAdmin.js:147-148`). MIME izin: `image/jpeg`, `image/jpg`, `image/png`, `application/pdf`.
- Semua RPC baru wajib `requireAdmin`.
- Tanpa perubahan skema DB.
- Vue: helper berargumen WAJIB di `methods`, bukan `computed` (dijaga `test/dashboard-template.test.js:304`).

---

## File Structure

- `new-code1-cf/src/read/dashboard.js` — perbaikan kunci dedup `seenBa`; expose `baPendukungIds` di bootstrap.
- `new-code1-cf/src/write/baAdmin.js` — tambah `addBaAdminPesertaWithBerkas`.
- `new-code1-cf/src/rpc.js` — import + handler `baAdminAddPesertaBerkas`.
- `new-code1-cf/public/dashboard.html` — modal `Kelola BA Pendukung`, picker kegiatan, panel tab Manual, indikator pesertaDenganBa, pensiun Flow A.
- `new-code1-cf/test/ba-coexist.test.js` — aktifkan kasus bug (hapus `.skip`).
- `new-code1-cf/test/ba-admin-peserta-berkas.test.js` — BARU, tes `addBaAdminPesertaWithBerkas`.
- `new-code1-cf/test/dashboard-bootstrap-ba-pendukung.test.js` — BARU, tes `baPendukungIds`.
- `new-code1-cf/test/dashboard-template.test.js` — update guard FAB + tambah guard modal/pensiun Flow A.
- `new-code1-cf/test/dashboard-ba-pendukung.test.js` — tulis ulang guard ke modal baru.
- `new-code1-cf/test/scan-pdf.test.js` — update guard scan Pendukung ke modal baru.
- `new-code1-cf/test/dashboard-manual-kegiatan.test.js` — BARU, guard panel kegiatan-sama.

---

## Task 1: Perbaiki dedup agregasi (BA Pendukung tidak hilang)

**Files:**
- Modify: `new-code1-cf/src/read/dashboard.js:248`
- Test: `new-code1-cf/test/ba-coexist.test.js`

**Interfaces:**
- Consumes: `collectBa(table, pesertaTable, sumber)` sudah menempel `sumber` (`'Bagian'`/`'Admin'`) pada tiap `b` (`src/read/dashboard.js:205-240`).
- Produces: `unit.baPendukung` (`sumber==='Admin'`) dan `unit.baPelaksanaan` (`sumber==='Bagian'`) berisi masing-masing 1 item untuk kegiatan yang sama saat `file_url` sama/kosong.

- [ ] **Step 1: Aktifkan tes regresi (hapus `.skip`)**

Di `new-code1-cf/test/ba-coexist.test.js`, ubah baris 21 dari:

```js
  it.skip('keduanya tetap tampil saat BA Pelaksanaan diunggah (BUG: ter-dedup di getBagianAggregation seenBa saat file_url sama/kosong)', async () => {
```

menjadi:

```js
  it('keduanya tetap tampil saat BA Pelaksanaan diunggah (file_url sama/kosong)', async () => {
```

- [ ] **Step 2: Tambah asersi `pesertaDenganBa`**

Di dalam tes pertama yang baru diaktifkan (sebelum kurung penutup `});` tes tersebut, setelah `expect(unit.baPelaksanaan.length).toBe(1);`), tambahkan:

```js
    expect(unit.pesertaDenganBa).toBe(1);
    expect(unit.jumlahPeserta).toBe(2);
```

- [ ] **Step 3: Jalankan tes untuk memastikan GAGAL**

Run: `cd new-code1-cf && npx vitest run test/ba-coexist.test.js`
Expected: FAIL pada tes pertama — `unit.baPendukung.length` bernilai `0` (bukan `1`) karena BA Pendukung ter-dedup.

- [ ] **Step 4: Perbaiki kunci dedup**

Di `new-code1-cf/src/read/dashboard.js`, ganti baris 248:

```js
    const dk = [norm(b.bagian), b.blok.toLowerCase(), normKegiatanText(b.namaKegiatan), b.tanggal, b.fileUrl].join('|');
```

menjadi:

```js
    const dk = [b.sumber, norm(b.bagian), b.blok.toLowerCase(), normKegiatanText(b.namaKegiatan), b.tanggal, b.fileUrl].join('|');
```

- [ ] **Step 5: Jalankan tes untuk memastikan LULUS**

Run: `cd new-code1-cf && npx vitest run test/ba-coexist.test.js`
Expected: PASS (2 tes).

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/src/read/dashboard.js new-code1-cf/test/ba-coexist.test.js
git commit -m "fix(ba): cegah BA Pendukung ter-dedup dengan BA Pelaksanaan di agregasi"
```

---

## Task 2: Backend `addBaAdminPesertaWithBerkas` + RPC

**Files:**
- Modify: `new-code1-cf/src/write/baAdmin.js` (tambah fungsi di akhir file)
- Modify: `new-code1-cf/src/rpc.js:28-30` (import) dan `:107` (handler)
- Test: `new-code1-cf/test/ba-admin-peserta-berkas.test.js` (BARU)

**Interfaces:**
- Consumes: `getOrCreateBaAdmin(db, kegiatan, ctx)` → `{success, baId, created}`; `setBaAdminPesertaBerkas(db, baId, idPengajuan, images, ctx)` → `{success, pages}`; `regenerateBaAdminPdf(db, baId, ctx)` → `{success, fileUrl?, message?}` (`src/write/baAdmin.js`).
- Produces: `addBaAdminPesertaWithBerkas(db, kegiatan, idPengajuan, images, ctx)` → `{success: true, baId, pages, fileUrl, needsRegen, message}` atau `{success: false, message}`. RPC `baAdminAddPesertaBerkas(kegiatan, idPengajuan, images)`.

- [ ] **Step 1: Tulis tes yang GAGAL**

Buat `new-code1-cf/test/ba-admin-peserta-berkas.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { addBaAdminPesertaWithBerkas } from '../src/write/baAdmin.js';

afterEach(() => { vi.unstubAllGlobals(); });

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const BRIDGE = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };
async function adminCtx() { return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: { ...BRIDGE } }; }
async function seed(id, npm, nama, status, pilihan) {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00',?1,?2,?3,'A','SGD',?4)").bind(id, npm, nama, status).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00',?1,'SGD',?2,'','2026-10-20','')").bind(id, pilihan).run();
}
const keg = { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20' };
const IMG = { data: PNG, mimeType: 'image/png', name: 'p.png' };

function stubBridge() {
  vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.action === 'getFile') return new Response(JSON.stringify({ success: true, base64: PNG, mimeType: 'image/png' }), { status: 200 });
    return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/NEWNEWNEWNEWNEWNEWNEWNEW1/view', fileId: 'NEWNEWNEWNEWNEWNEWNEWNEW1' }), { status: 200 });
  }));
}

describe('addBaAdminPesertaWithBerkas', () => {
  it('menolak bila berkas kosong (tidak membuat BA)', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const res = await addBaAdminPesertaWithBerkas(env.DB, keg, 'INHAL-1', [], ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('wajib');
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin').first()).n;
    expect(Number(n)).toBe(0);
  });

  it('membuat BA, peserta aktif, berkas aktif, dan PDF tergenerate', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    stubBridge();
    const res = await addBaAdminPesertaWithBerkas(env.DB, keg, 'INHAL-1', [IMG], ctx);
    expect(res.success).toBe(true);
    const baId = res.baId;
    const p = await env.DB.prepare('SELECT active FROM berita_acara_admin_peserta WHERE ba_id=?1 AND id_pengajuan=?2').bind(baId, 'INHAL-1').first();
    expect(Number(p.active)).toBe(1);
    const b = await env.DB.prepare('SELECT active FROM berita_acara_admin_berkas WHERE ba_id=?1 AND id_pengajuan=?2').bind(baId, 'INHAL-1').first();
    expect(Number(b.active)).toBe(1);
    const ba = await env.DB.prepare('SELECT file_url, needs_regen FROM berita_acara_admin WHERE ba_id=?1').bind(baId).first();
    expect(ba.file_url).toContain('NEWNEWNEWNEWNEWNEWNEWNEW1');
    expect(Number(ba.needs_regen)).toBe(0);
  });

  it('idempoten saat peserta sudah ada (tidak menggandakan baris)', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    stubBridge();
    const r1 = await addBaAdminPesertaWithBerkas(env.DB, keg, 'INHAL-1', [IMG], ctx);
    const r2 = await addBaAdminPesertaWithBerkas(env.DB, keg, 'INHAL-1', [IMG], ctx);
    expect(r1.baId).toBe(r2.baId);
    const rows = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_peserta WHERE ba_id=?1 AND id_pengajuan=?2').bind(r1.baId, 'INHAL-1').first()).n;
    expect(Number(rows)).toBe(1);
    const ber = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE ba_id=?1 AND id_pengajuan=?2 AND active=1').bind(r1.baId, 'INHAL-1').first()).n;
    expect(Number(ber)).toBe(1);
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan GAGAL**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-peserta-berkas.test.js`
Expected: FAIL — `addBaAdminPesertaWithBerkas is not a function` (import undefined).

- [ ] **Step 3: Implementasi fungsi**

Di `new-code1-cf/src/write/baAdmin.js`, tambahkan di akhir file (setelah `regenerateBaAdminPdf`, baris 434):

```js
export async function addBaAdminPesertaWithBerkas(db, kegiatan, idPengajuan, images, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const pid = str(idPengajuan);
  if (!pid) return { success: false, message: 'Pengajuan kosong.' };
  const list = Array.isArray(images) ? images : [];
  if (!list.length) return { success: false, message: 'Berkas wajib diunggah untuk menambah peserta BA.' };

  const created = await getOrCreateBaAdmin(db, kegiatan, ctx);
  if (!created.success) return created;

  const set = await setBaAdminPesertaBerkas(db, created.baId, pid, list, ctx);
  if (!set.success) return set;

  const regen = await regenerateBaAdminPdf(db, created.baId, ctx);
  return {
    success: true,
    baId: created.baId,
    pages: set.pages,
    fileUrl: (regen && regen.fileUrl) || '',
    needsRegen: !(regen && regen.success),
    message: (regen && regen.success) ? 'Peserta & berkas disimpan.' : ((regen && regen.message) || 'Berkas tersimpan, PDF gagal dirakit.')
  };
}
```

- [ ] **Step 4: Registrasi RPC**

Di `new-code1-cf/src/rpc.js`, ubah import baris 27-30 menjadi:

```js
import {
  getOrCreateBaAdmin, addBaAdminPesertaBulk, getBaAdminForPengajuan,
  setBaAdminPesertaBerkas, removeBaAdminPeserta, regenerateBaAdminPdf,
  addBaAdminPesertaWithBerkas
} from './write/baAdmin.js';
```

Dan tambahkan handler setelah baris 107 (`baAdminAddPeserta:`):

```js
  baAdminAddPesertaBerkas: (db, args, ctx) => addBaAdminPesertaWithBerkas(db, args[0], args[1], args[2], ctx),
```

- [ ] **Step 5: Jalankan tes untuk memastikan LULUS**

Run: `cd new-code1-cf && npx vitest run test/ba-admin-peserta-berkas.test.js`
Expected: PASS (3 tes).

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/src/write/baAdmin.js new-code1-cf/src/rpc.js new-code1-cf/test/ba-admin-peserta-berkas.test.js
git commit -m "feat(ba): tambah addBaAdminPesertaWithBerkas (wajib berkas) + RPC"
```

---

## Task 3: Bootstrap `baPendukungIds`

**Files:**
- Modify: `new-code1-cf/src/read/dashboard.js:79-107` (`getDashboardBootstrap`)
- Test: `new-code1-cf/test/dashboard-bootstrap-ba-pendukung.test.js` (BARU)

**Interfaces:**
- Produces: `getDashboardBootstrap(...)` mengembalikan `baPendukungIds: string[]` — daftar `id_pengajuan` unik yang punya baris `berita_acara_admin_peserta` dengan `active=1`.

- [ ] **Step 1: Tulis tes yang GAGAL**

Buat `new-code1-cf/test/dashboard-bootstrap-ba-pendukung.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getDashboardBootstrap } from '../src/read/dashboard.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}

describe('getDashboardBootstrap baPendukungIds', () => {
  it('mengembalikan id pengajuan yang punya BA Pendukung aktif', async () => {
    await env.DB.prepare("INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,jumlah_peserta,file_name,file_url,catatan,sumber,kegiatan_key,updated_at,needs_regen) VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001','SGD','A','SGD 1','2026-10-20','','1','','','','Admin','sgd|a|sgd 1','2026-10-01T08:00:00',0)").run();
    await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan,urutan,active) VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001','INHAL-1','2201010001','Aisyah','A','SGD','ACC',1,1)").run();
    await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan,urutan,active) VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001','INHAL-2','2201010002','Budi','A','SGD','ACC',2,0)").run();

    const ctx = await adminCtx();
    const b = await getDashboardBootstrap(env.DB, ctx);
    expect(b.baPendukungIds).toContain('INHAL-1');
    expect(b.baPendukungIds).not.toContain('INHAL-2');
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan GAGAL**

Run: `cd new-code1-cf && npx vitest run test/dashboard-bootstrap-ba-pendukung.test.js`
Expected: FAIL — `b.baPendukungIds` undefined.

- [ ] **Step 3: Implementasi**

Di `new-code1-cf/src/read/dashboard.js`, tepat sebelum `return {` (baris 100) di `getDashboardBootstrap`, tambahkan:

```js
  const baPendukungRows = (await db.prepare('SELECT id_pengajuan FROM berita_acara_admin_peserta WHERE active = 1').all()).results || [];
  const baPendukungIds = Array.from(new Set(baPendukungRows.map((r) => String(r.id_pengajuan || '').trim()).filter(Boolean)));
```

Dan tambahkan `baPendukungIds,` ke objek yang di-`return` (setelah `dosen: await getMasterOptions(db, 'Dosen')`, baris 105):

```js
  return {
    stats,
    pengajuan: buildPengajuanClientRows(sorted, biayaMap, overrideMap),
    detailMap,
    masterBiaya,
    dosen: await getMasterOptions(db, 'Dosen'),
    baPendukungIds
  };
```

- [ ] **Step 4: Jalankan tes untuk memastikan LULUS**

Run: `cd new-code1-cf && npx vitest run test/dashboard-bootstrap-ba-pendukung.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/src/read/dashboard.js new-code1-cf/test/dashboard-bootstrap-ba-pendukung.test.js
git commit -m "feat(dashboard): expose baPendukungIds di bootstrap"
```

---

## Task 4: Modal "Kelola BA Pendukung" (detail pengajuan)

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Test: `new-code1-cf/test/dashboard-ba-pendukung.test.js` (tulis ulang)

**Interfaces:**
- Consumes: RPC `baAdminGet`, `baAdminCreate` (tidak lagi dipakai UI), `baAdminAddPesertaBerkas`, `baAdminUploadBerkas`, `baAdminRemovePeserta`, `baAdminRegenerate`.
- Produces: state `kb` + method `openKelolaBaPendukung(idPengajuan)`, `closeKelolaBaPendukung()`, `loadKelolaBa(id)`, `kbReload()`, `kbTogglePick(id)`, `kbStartBerkas(kind, pe)`, `onKbPdf(e)`, `onKbPhotos(e)`, `kbSubmit()`, `kbRemove(pe)`, `kbRegenerate()`. ID elemen: `kbCamera`, `kbPdf`.

- [ ] **Step 1: Tulis ulang guard test yang GAGAL**

Ganti seluruh isi `new-code1-cf/test/dashboard-ba-pendukung.test.js` dengan:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadDashboardHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/dashboard.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('dashboard modal Kelola BA Pendukung', () => {
  it('menyediakan modal, pemilih peserta+berkas, dan hook aksi', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('openKelolaBaPendukung(');
    expect(html).toContain('kbStartBerkas(');
    expect(html).toContain('baAdminAddPesertaBerkas');
    expect(html).toContain('kbRemove(');
    expect(html).toContain('kbRegenerate(');
    expect(html).toContain('Kelola BA Pendukung');
    expect(html).toContain('ref="kbCamera"');
    expect(html).toContain('ref="kbPdf"');
    expect(html).toContain('onKbPdf(');
    expect(html).toContain('onKbPhotos(');
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan GAGAL**

Run: `cd new-code1-cf && npx vitest run test/dashboard-ba-pendukung.test.js`
Expected: FAIL — `openKelolaBaPendukung(` tidak ditemukan.

- [ ] **Step 3: Ganti kartu BA Pendukung di modal detail dengan peluncur**

Di `new-code1-cf/public/dashboard.html`, ganti blok baris 1920-1970 (dari `<div v-if="detail.p" class="ba-align-card dash-card p-4">` sampai `</div>` sebelum komentar `<!-- status update -->`, termasuk dua `<input ref="baPendukungCamera"...>`/`<input ref="baPendukungPdf"...>`) dengan:

```html
                                <div v-if="detail.p" class="ba-align-card dash-card p-4">
                                    <div class="mb-2 flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-2 text-sm font-bold text-slate-900"><i class="bi bi-file-earmark-text text-base text-brand-600"></i> Berita Acara Pendukung</div>
                                        <button class="btn-primary !py-1.5 !px-3 text-xs" @click="openKelolaBaPendukung(detail.p['ID Pengajuan'])"><i class="bi bi-gear"></i> Kelola BA Pendukung</button>
                                    </div>
                                    <p class="text-[11px] text-slate-400">Kelola peserta dan berkas BA Pendukung untuk kegiatan pengajuan ini. Tiap peserta wajib memiliki berkas.</p>
                                </div>
```

- [ ] **Step 4: Tambah state `kb`**

Di `new-code1-cf/public/dashboard.html`, pada objek `detail` di `data()` (baris 2323), hapus properti `baPendukung: { loading: false, data: null, ... loadSeq: 0 }, ` sehingga `detail` menjadi:

```js
                    detail: { open: false, loading: false, p: null, suratFile: null, suratName: '', suratUploading: false, suratError: '', buktiFile: null, buktiUploading: false, buktiError: '', scanItems: [], scanBusy: false, scanSeq: 0, status: 'Diterima', catatan: '', editInduk: false, iForm: { email: '', noHp: '', blok: '', jenisKegiatan: '', tanggalPelaksanaan: '', biaya: '' }, editDetailIndex: -1, dEdit: { jenisKegiatan: '', pilihan: '', detail: '', tanggalPelaksanaan: '' } },
```

Lalu setelah baris `ba: { rows: [], ... },` (baris 2325), tambahkan state baru:

```js
                    kb: { open: false, loading: false, data: null, pick: false, addPick: '', kind: '', targetPid: '', uploadItems: [], uploadBusy: false, uploadSeq: 0, loadSeq: 0, lastId: '' },
```

- [ ] **Step 5: Hapus method BA Pendukung lama**

Di `new-code1-cf/public/dashboard.html`, hapus blok baris 3596-3702 (dari `async openBaPendukung() {` sampai `berkasBaUrl(pe) { ... },` inklusif). Pertahankan `bytesToBase64(bytes) { ... },` yang berada tepat setelahnya.

- [ ] **Step 6: Tambah method modal baru**

Di `new-code1-cf/public/dashboard.html`, tepat setelah `bytesToBase64(bytes) { ... },` tambahkan:

```js
                openKelolaBaPendukung(idPengajuan) {
                    const id = String(idPengajuan || '').trim();
                    if (!id) { this.notify('Peserta tidak ditemukan.', false); return; }
                    this.kb.open = true;
                    this.kb.pick = false;
                    this.kb.addPick = '';
                    this.kb.kind = '';
                    this.kb.targetPid = '';
                    this.kb.uploadItems = [];
                    this.loadKelolaBa(id);
                },
                closeKelolaBaPendukung() {
                    this.kb.open = false;
                    this.kb.data = null;
                    this.kb.uploadItems = [];
                },
                async loadKelolaBa(idPengajuan) {
                    const kb = this.kb;
                    kb.lastId = idPengajuan;
                    kb.loadSeq += 1;
                    const seq = kb.loadSeq;
                    kb.loading = true;
                    try {
                        const res = await this.run('baAdminGet', idPengajuan);
                        if (seq !== kb.loadSeq) return;
                        if (res && res.success) kb.data = res.data;
                        else this.notify((res && res.message) || 'Gagal memuat BA Pendukung.', false);
                    } catch (e) {
                        if (seq !== kb.loadSeq) return;
                        this.notify('Gagal memuat BA Pendukung: ' + e, false);
                    } finally {
                        if (seq === kb.loadSeq) kb.loading = false;
                    }
                },
                kbReload() { if (this.kb.lastId) this.loadKelolaBa(this.kb.lastId); },
                kbTogglePick(id) {
                    const k = String(id || '');
                    this.kb.addPick = this.kb.addPick === k ? '' : k;
                },
                kbStartBerkas(kind, pe) {
                    const isAdd = String(kind || '').indexOf('add') === 0;
                    if (isAdd) {
                        if (!this.kb.addPick) { this.notify('Pilih peserta yang akan ditambahkan terlebih dahulu.', false); return; }
                        this.kb.kind = 'add';
                        this.kb.targetPid = this.kb.addPick;
                    } else {
                        if (!pe) return;
                        this.kb.kind = 'change';
                        this.kb.targetPid = pe.idPengajuan;
                    }
                    this.kb.uploadItems = [];
                    const isPdf = String(kind || '').indexOf('pdf') !== -1;
                    const el = this.$refs[isPdf ? 'kbPdf' : 'kbCamera'];
                    if (el) el.click();
                },
                onKbPdf(e) {
                    const files = Array.from(e.target.files || []);
                    if (e.target) e.target.value = '';
                    if (!files.length) return;
                    const kb = this.kb;
                    const f = files[0];
                    const reader = new FileReader();
                    reader.onload = () => {
                        const res = String(reader.result || '');
                        const comma = res.indexOf(',');
                        const b64 = comma >= 0 ? res.slice(comma + 1) : res;
                        kb.uploadSeq += 1;
                        kb.uploadItems = [{ id: 'kb-pdf-' + kb.uploadSeq, base64: b64, mime: 'application/pdf', name: f.name }];
                        this.kbSubmit();
                    };
                    reader.onerror = () => this.notify('Gagal membaca PDF.', false);
                    reader.readAsDataURL(f);
                },
                onKbPhotos(e) {
                    const files = Array.from(e.target.files || []);
                    if (e.target) e.target.value = '';
                    if (!files.length) return;
                    const kb = this.kb;
                    Promise.all(files.map((f) => window.ScanPdf.compressToJpeg(f))).then((items) => {
                        items.forEach((it) => { kb.uploadSeq += 1; kb.uploadItems.push({ id: 'kb-' + kb.uploadSeq, bytes: it.bytes, width: it.width, height: it.height }); });
                        if (kb.uploadItems.length) this.kbSubmit();
                    }).catch((err) => this.notify('Gagal memproses gambar: ' + err, false));
                },
                async kbSubmit() {
                    const kb = this.kb;
                    const data = kb.data;
                    if (!kb.uploadItems.length || !kb.targetPid) return;
                    if (!data) { this.notify('Data BA belum siap.', false); return; }
                    kb.uploadBusy = true;
                    try {
                        const images = Array.from(kb.uploadItems).map((it) => (it.base64
                            ? { data: it.base64, mimeType: it.mime || 'application/pdf', name: it.name || 'berkas.pdf' }
                            : { data: this.bytesToBase64(it.bytes), mimeType: it.mime || 'image/jpeg', name: it.name || (it.id + '.jpg') }));
                        let res;
                        if (kb.kind === 'add') {
                            res = await this.run('baAdminAddPesertaBerkas', data.kegiatan, kb.targetPid, images);
                        } else {
                            if (!data.ba) { this.notify('BA Pendukung belum tersedia.', false); return; }
                            res = await this.run('baAdminUploadBerkas', data.ba.baId, kb.targetPid, images);
                        }
                        this.notify((res && res.message) || 'Berkas disimpan.', !!(res && res.success));
                        kb.uploadItems = []; kb.targetPid = ''; kb.kind = ''; kb.addPick = '';
                        if (res && res.success) await this.loadKelolaBa(kb.lastId);
                    } catch (e) {
                        this.notify('Gagal menyimpan berkas: ' + e, false);
                    } finally { kb.uploadBusy = false; }
                },
                async kbRemove(pe) {
                    const ok = await this.askConfirm({ title: 'Hapus dari BA', message: 'Hapus ' + (pe.namaLengkap || pe.npm) + ' dari BA Pendukung? Berkas lama tetap tersimpan sebagai riwayat.', icon: 'bi-x-lg', tone: 'danger', confirmLabel: 'Hapus' });
                    if (!ok) return;
                    const res = await this.run('baAdminRemovePeserta', this.kb.data.ba.baId, pe.idPengajuan);
                    this.notify((res && res.message) || 'Dihapus.', !!(res && res.success));
                    if (res && res.success) await this.loadKelolaBa(this.kb.lastId);
                },
                async kbRegenerate() {
                    const res = await this.run('baAdminRegenerate', this.kb.data.ba.baId);
                    this.notify((res && res.message) || 'Regenerate selesai.', !!(res && res.success));
                    await this.loadKelolaBa(this.kb.lastId);
                },
```

- [ ] **Step 7: Tandai `kb.open` pada `anyModalOpen`**

Di `new-code1-cf/public/dashboard.html` baris 2700, ubah:

```js
                    return !!(this.detail.open || this.ba.modal || this.master.rowModal.open || this.bab.ba.confirm || this.dialog.open || this.master.uploads.reset.open || this.kelola.open || this.riwayat.open);
```

menjadi:

```js
                    return !!(this.detail.open || this.kb.open || this.master.rowModal.open || this.bab.ba.confirm || this.dialog.open || this.master.uploads.reset.open || this.kelola.open || this.riwayat.open);
```

- [ ] **Step 8: Tambah CSS z-index dan markup modal**

Di `new-code1-cf/public/dashboard.html`, tambahkan baris CSS setelah baris 120 dan setelah baris 198 (dua blok style):

```css
        .z-\[120\] { z-index: 120; }
```

(di blok kedua tanpa indentasi `        `: `.z-\[120\] { z-index: 120; }`)

Lalu tambahkan markup modal tepat setelah elemen modal Flow A (setelah `</transition>` penutup modal Flow A di baris 2164):

```html
        <!-- ============ MODAL: KELOLA BA PENDUKUNG ============ -->
        <transition name="fade">
            <div v-if="kb.open" class="fixed inset-0 z-[120] modal-overlay">
                <div class="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" @click="closeKelolaBaPendukung()"></div>
                <transition name="pop" appear>
                    <div class="modal-panel max-w-2xl shadow-lift">
                        <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                            <h3 class="text-sm font-bold text-slate-900"><i class="bi bi-file-earmark-text text-brand-600"></i> Kelola BA Pendukung</h3>
                            <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" @click="closeKelolaBaPendukung()"><i class="bi bi-x-lg"></i></button>
                        </div>
                        <div class="modal-body px-6 py-4">
                            <div v-if="kb.loading" class="py-6 text-center text-xs text-slate-400">Memuat…</div>
                            <template v-else-if="kb.data">
                                <div class="text-xs text-slate-500">
                                    <span class="font-semibold text-slate-700">{{ kb.data.kegiatan.namaKegiatan || '-' }}</span>
                                    · {{ kb.data.kegiatan.bagian }} · {{ kb.data.kegiatan.blok }}
                                    · {{ kb.data.kegiatan.tanggalPelaksanaan || '-' }}
                                </div>
                                <div v-if="kb.data.ba" class="mt-2 flex flex-wrap items-center gap-2">
                                    <span class="font-mono text-xs font-bold text-slate-700">{{ kb.data.ba.baId }}</span>
                                    <a v-if="kb.data.ba.fileUrl" :href="safeUrl(kb.data.ba.fileUrl)" target="_blank" rel="noopener noreferrer" class="btn-primary !py-1 !px-2 text-[11px]"><i class="bi bi-file-earmark-pdf"></i> Lihat PDF BA</a>
                                    <button v-if="kb.data.ba.needsRegen" class="btn-soft !py-1 !px-2 text-[11px]" @click="kbRegenerate()"><i class="bi bi-arrow-repeat"></i> Regenerate</button>
                                </div>
                                <div v-else class="mt-2 text-[11px] text-slate-400">Belum ada BA. Pilih peserta dan unggah berkas untuk membuatnya.</div>

                                <div class="mt-4">
                                    <div class="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Peserta ({{ (kb.data.peserta || []).length }})</div>
                                    <div class="space-y-2">
                                        <div v-for="pe in kb.data.peserta" :key="pe.idPengajuan" class="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-100">
                                            <span class="text-xs font-semibold text-slate-700">{{ pe.urutan }}. {{ pe.namaLengkap || pe.npm }}</span>
                                            <span class="font-mono text-[10px] text-slate-400">{{ pe.npm }}</span>
                                            <span v-if="pe.pages" class="text-[11px] text-slate-400">{{ pe.pages }} halaman</span>
                                            <span v-else class="rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">Belum ada berkas</span>
                                            <span class="ml-auto flex gap-1">
                                                <button class="btn-soft !py-1 !px-2 text-[11px]" :disabled="kb.uploadBusy" @click="kbStartBerkas('change-scan', pe)"><i class="bi bi-camera"></i> {{ pe.pages ? 'Ganti berkas' : 'Unggah/Scan' }}</button>
                                                <button class="btn-soft !py-1 !px-2 text-[11px]" :disabled="kb.uploadBusy" @click="kbStartBerkas('change-pdf', pe)"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
                                                <a v-if="pe.pages && pe.files && pe.files.length" :href="safeUrl(pe.files[0].fileUrl)" target="_blank" rel="noopener noreferrer" class="btn-soft !py-1 !px-2 text-[11px]"><i class="bi bi-download"></i></a>
                                                <button class="btn-soft !py-1 !px-2 text-[11px] !text-rose-600" @click="kbRemove(pe)"><i class="bi bi-x-lg"></i></button>
                                            </span>
                                        </div>
                                        <div v-if="!(kb.data.peserta || []).length" class="text-[11px] text-slate-400">Belum ada peserta pada BA ini.</div>
                                    </div>
                                </div>

                                <div class="mt-4">
                                    <button class="btn-soft !py-1.5 text-xs" @click="kb.pick = !kb.pick"><i class="bi bi-person-plus"></i> Tambah peserta + berkas</button>
                                    <div v-if="kb.pick" class="mt-2 rounded-xl ring-1 ring-slate-200">
                                        <div v-if="!(kb.data.candidates || []).length" class="p-3 text-[11px] text-slate-400">Tidak ada kandidat (mahasiswa sekegiatan berstatus ACC/Diterima yang belum masuk BA).</div>
                                        <label v-for="c in kb.data.candidates" :key="c.idPengajuan" class="flex items-center gap-2 border-b border-slate-100 p-2 last:border-0">
                                            <input type="radio" name="kbAdd" class="h-4 w-4 accent-brand-600" :checked="kb.addPick === c.idPengajuan" @change="kbTogglePick(c.idPengajuan)">
                                            <span class="text-xs text-slate-700">{{ c.npm }} — {{ c.namaLengkap }} <span class="text-slate-400">({{ c.blok }})</span></span>
                                        </label>
                                        <div class="flex flex-wrap justify-end gap-2 p-2">
                                            <button class="btn-soft !py-1.5 text-xs" :disabled="kb.uploadBusy || !kb.addPick" @click="kbStartBerkas('add-scan', null)"><i class="bi bi-camera"></i> Scan kamera</button>
                                            <button class="btn-primary !py-1.5 text-xs" :disabled="kb.uploadBusy || !kb.addPick" @click="kbStartBerkas('add-pdf', null)"><i class="bi bi-file-earmark-pdf"></i> Unggah PDF</button>
                                        </div>
                                    </div>
                                </div>
                                <p v-if="kb.uploadBusy" class="mt-2 text-[11px] text-brand-600">Mengunggah & merakit PDF…</p>
                            </template>
                        </div>
                        <div class="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-3.5">
                            <button class="btn-soft" @click="closeKelolaBaPendukung()">Tutup</button>
                        </div>
                        <input ref="kbCamera" type="file" accept="image/*" capture="environment" multiple class="hidden" @change="onKbPhotos($event)">
                        <input ref="kbPdf" type="file" accept="application/pdf" class="hidden" @change="onKbPdf($event)">
                    </div>
                </transition>
            </div>
        </transition>
```

- [ ] **Step 9: Jalankan tes untuk memastikan LULUS**

Run: `cd new-code1-cf && npx vitest run test/dashboard-ba-pendukung.test.js test/dashboard-template.test.js`
Expected: `dashboard-ba-pendukung` PASS. `dashboard-template` mungkin masih PASS (modal Flow A & `ba` state belum dihapus di task ini).

- [ ] **Step 10: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-ba-pendukung.test.js
git commit -m "feat(dashboard): modal Kelola BA Pendukung per-peserta di detail pengajuan"
```

---

## Task 5: Routing tab BA + pensiun Flow A

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Test: `new-code1-cf/test/dashboard-template.test.js`, `new-code1-cf/test/scan-pdf.test.js`

**Interfaces:**
- Consumes: `openKelolaBaPendukung(idPengajuan)` dari Task 4.
- Produces: `openKelolaBaForUnit(u)`, `openKelolaBaPicker()`, `closeKelolaBaPicker()`, `kbPickerOpenUnit(u)`, state `kbPicker: { open:false }`. Tak ada lagi pemanggilan `openBaUpload(`, `submitBaAdmin(`, atau `uploadBeritaAcaraAdmin` dari UI.

- [ ] **Step 1: Update guard test (GAGAL)**

Di `new-code1-cf/test/dashboard-template.test.js`, ganti blok tes baris 375-381 menjadi:

```js
  it('FAB (+) membuka picker Kelola BA Pendukung', async () => {
    const html = await loadDashboardHtml();
    const m = html.match(/<button[^>]*class="fab-btn[^"]*"[^>]*>/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain('@click="openKelolaBaPicker()"');
    expect(m[0]).toContain('Tambah Berita Acara Pendukung');
  });
```

Dan tambahkan tes baru di akhir file (sebelum `});` penutup `describe('dashboard template', ...)` yang ada di baris 318, atau tambahkan `describe` baru):

```js
describe('dashboard pensiun alur BA Pendukung lama', () => {
  it('tidak lagi memakai alur satu-file-per-kegiatan', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('openBaUpload(');
    expect(html).not.toContain('submitBaAdmin(');
    expect(html).not.toContain('uploadBeritaAcaraAdmin');
  });
  it('menyediakan picker kegiatan dan tombol Kelola BA Pendukung di baris unit', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('openKelolaBaPicker()');
    expect(html).toContain('openKelolaBaForUnit(');
  });
});
```

Di `new-code1-cf/test/scan-pdf.test.js`, ganti blok tes baris 105-113 menjadi:

```js
  it('menyediakan scan untuk BA Pendukung (modal kelola)', async () => {
    const html = await loadHtml('dashboard.html');
    expect(html).toContain('ref="kbCamera"');
    expect(html).toContain('@change="onKbPhotos($event)"');
    expect(html).toContain('ref="kbPdf"');
    expect(html).toContain('@change="onKbPdf($event)"');
  });
```

- [ ] **Step 2: Jalankan tes untuk memastikan GAGAL**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js test/scan-pdf.test.js`
Expected: FAIL — masih ada `openBaUpload(` dan `ref="pendukungCamera"`.

- [ ] **Step 3: Tambah state `kbPicker`**

Di `new-code1-cf/public/dashboard.html` setelah state `kb: {...},` (Task 4 Step 4), tambahkan:

```js
                    kbPicker: { open: false },
```

Lalu di computed `anyModalOpen` (baris 2700), tambahkan `this.kbPicker.open` sehingga menjadi:

```js
                    return !!(this.detail.open || this.kb.open || this.kbPicker.open || this.master.rowModal.open || this.bab.ba.confirm || this.dialog.open || this.master.uploads.reset.open || this.kelola.open || this.riwayat.open);
```

- [ ] **Step 4: Tambah method routing & picker**

Di `new-code1-cf/public/dashboard.html`, setelah `kbRegenerate() { ... },` (Task 4 Step 6), tambahkan:

```js
                openKelolaBaForUnit(u) {
                    const p = (u && u.peserta) || [];
                    if (!p.length) { this.notify('Kegiatan ini belum punya peserta.', false); return; }
                    this.openKelolaBaPendukung(p[0].idPengajuan);
                },
                openKelolaBaPicker() {
                    this.kbPicker.open = true;
                    if (this.tab !== 'ba') this.switchTab('ba');
                },
                closeKelolaBaPicker() { this.kbPicker.open = false; },
                kbPickerOpenUnit(u) {
                    const p = (u && u.peserta) || [];
                    if (!p.length) { this.notify('Kegiatan ini belum punya peserta.', false); return; }
                    this.kbPicker.open = false;
                    this.openKelolaBaPendukung(p[0].idPengajuan);
                },
```

- [ ] **Step 5: Ganti tombol header dan baris unit**

Di `new-code1-cf/public/dashboard.html` baris 1015, ubah `@click="openBaUpload()"` menjadi `@click="openKelolaBaPicker()"` (label tetap `Unggah BA Pendukung`).

Pada baris 1183 dan 1266, ubah setiap `@click="openBaUpload()">Unggah Pendukung</button>` menjadi `@click="openKelolaBaForUnit(r)">Unggah Pendukung</button>`.

Setelah tombol "Unggah Pelaksanaan" desktop (baris 1184) tambahkan tombol Kelola (di luar rantai `v-if`/`v-else-if`):

```html
                                                        <button v-if="!r.__orphan && unitHasPendukung(r)" class="btn-soft !px-2 !py-1 text-[11px]" @click="openKelolaBaForUnit(r)"><i class="bi bi-gear"></i> Kelola BA Pendukung</button>
```

Setelah tombol "Unggah Pelaksanaan" mobile (baris 1267) tambahkan:

```html
                                        <button v-if="!r.__orphan && unitHasPendukung(r)" class="btn-soft !px-2 !py-1 text-[11px]" @click="openKelolaBaForUnit(r)"><i class="bi bi-gear"></i> Kelola</button>
```

- [ ] **Step 6: Ganti FAB**

Di `new-code1-cf/public/dashboard.html` baris 2233, ubah `@click="openBaUpload()"` menjadi `@click="openKelolaBaPicker()"`.

- [ ] **Step 7: Hapus modal Flow A**

Di `new-code1-cf/public/dashboard.html`, hapus blok baris 2081-2164 (dari komentar `<!-- ============ MODAL: UPLOAD BA ============ -->` sampai `</transition>` penutup modal tersebut). JANGAN hapus modal `kelola.open`/`kelolaBaPicker` yang ditambahkan Task 4.

- [ ] **Step 8: Hapus state, computed, dan method Flow A**

Di `new-code1-cf/public/dashboard.html`:
1. Hapus properti `ba: { rows: [], all: [], ... },` dari `data()` (baris 2325).
2. Hapus computed `baDetailOptions() { ... },` dan `selectedBaDetail() { ... },` (baris 2622-2631).
3. Hapus method berikut: `openBaUpload`, `closeBaUpload`, `loadBaUploadOptions`, `onBaBlokChange`, `onBaDetailChange`, `onBaFile` (blok berurutan dari `openBaUpload() {` sampai tepat sebelum `scanTarget(which) {`), dan `submitBaAdmin` (dari `async submitBaAdmin() {` sampai tepat sebelum `async deleteBaRecord(baId, sumber) {`). JANGAN hapus `readFileAsBase64(file) { ... },` (masih dipakai `submitManual`).
4. Ubah `scanTarget(which)` agar tidak lagi menangani `'pendukung'`:

```js
                scanTarget(which) {
                    if (which === 'pelaksanaan') return this.bab.ba;
                    if (which === 'bukti') return this.detail;
                    return null;
                },
```

Catatan: `scanEnsure`, `scanClear`, `scanRemove`, `scanMove`, `scanOnPhotos`, `scanBuildPdf` tetap ada (dipakai pelaksanaan & bukti). `scanTarget` bernilai `null` hanya bila dipanggil dengan `'pendukung'`; pastikan tidak ada lagi pemanggil `'pendukung'` (sudah dihapus pada step ini).

- [ ] **Step 9: Tambah markup picker kegiatan**

Di `new-code1-cf/public/dashboard.html`, setelah markup modal Kelola BA Pendukung (Task 4 Step 8), tambahkan:

```html
        <!-- ============ MODAL: PILIH KEGIATAN BA PENDUKUNG ============ -->
        <transition name="fade">
            <div v-if="kbPicker.open" class="fixed inset-0 z-[120] modal-overlay">
                <div class="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" @click="closeKelolaBaPicker()"></div>
                <div class="modal-panel max-w-lg shadow-lift">
                    <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                        <h3 class="text-sm font-bold text-slate-900">Pilih Kegiatan — Kelola BA Pendukung</h3>
                        <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" @click="closeKelolaBaPicker()"><i class="bi bi-x-lg"></i></button>
                    </div>
                    <div class="modal-body max-h-[60vh] overflow-y-auto px-6 py-4">
                        <div v-if="!(bagian.units || []).length" class="text-xs text-slate-400">Belum ada kegiatan dimuat. Buka tab Berita Acara lebih dulu.</div>
                        <button v-for="u in (bagian.units || []).filter(x => !x.__orphan)" :key="u.key" class="mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ring-1 ring-slate-100 hover:bg-brand-50" @click="kbPickerOpenUnit(u)">
                            <span class="text-xs font-semibold text-slate-700">{{ u.label }}</span>
                            <span class="text-[10px] text-slate-400">{{ u.bagian }} · {{ u.blok }} · {{ u.jumlahPeserta }} peserta</span>
                        </button>
                    </div>
                </div>
            </div>
        </transition>
```

- [ ] **Step 10: Jalankan tes untuk memastikan LULUS**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js test/scan-pdf.test.js test/dashboard-ba-pendukung.test.js`
Expected: PASS semua.

- [ ] **Step 11: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js new-code1-cf/test/scan-pdf.test.js
git commit -m "refactor(dashboard): pensiunkan alur BA Pendukung satu-file, tambah picker kegiatan"
```

---

## Task 6: Panel "kegiatan yang sama" di tab Manual

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Test: `new-code1-cf/test/dashboard-manual-kegiatan.test.js` (BARU)

**Interfaces:**
- Consumes: `detailMap` (dari bootstrap), `pengajuanRows`, `baPendukungIds` (Task 3), `normBagian`, `statusBadge`, `openKelolaBaPendukung` (Task 4).
- Produces: computed `manualKegiatanDetailRows`, `manualSameKegiatan`, `baPendukungSet`; method `manualAddAnother()`. Kunci pencocokan: `normBagian(jenis)|normBagian(blok)|normBagian(pilihan)|normBagian(detail)`.

- [ ] **Step 1: Tulis guard test (GAGAL)**

Buat `new-code1-cf/test/dashboard-manual-kegiatan.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadDashboardHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/dashboard.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('dashboard tab manual: kegiatan yang sama', () => {
  it('menampilkan panel peserta sekegiatan dan aksi kelola BA', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('manualSameKegiatan');
    expect(html).toContain('manualAddAnother()');
    expect(html).toContain('Kegiatan ini sudah punya');
    expect(html).toContain('openKelolaBaPendukung(m.idPengajuan)');
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan GAGAL**

Run: `cd new-code1-cf && npx vitest run test/dashboard-manual-kegiatan.test.js`
Expected: FAIL — `manualSameKegiatan` tidak ditemukan.

- [ ] **Step 3: Simpan `baPendukungIds` dari bootstrap**

Di `new-code1-cf/public/dashboard.html` `data()`, setelah `detailMap: {},` (baris 2319), tambahkan:

```js
                    baPendukungIds: [],
```

Di method `bootstrap()` (baris 3182), setelah `this.detailMap = b.detailMap || {};`, tambahkan:

```js
                        this.baPendukungIds = b.baPendukungIds || [];
```

- [ ] **Step 4: Tambah computed**

Di `new-code1-cf/public/dashboard.html` `computed`, setelah `selectedBaDetail` yang dihapus (Task 5), tambahkan (pada lokasi yang sama, yaitu sebelum `allChecked()`):

```js
                baPendukungSet() {
                    const set = {};
                    for (const id of (this.baPendukungIds || [])) set[String(id)] = true;
                    return set;
                },
                manualKegiatanDetailRows() {
                    const jenis = String(this.manual.form.jenisKegiatan || '').trim();
                    const blok = String(this.manual.form.blok || '').trim();
                    if (!jenis || !blok) return [];
                    const rows = [];
                    const push = (pilihan, detail) => rows.push({ jenis, blok, pilihan: String(pilihan || '').trim(), detail: String(detail || '').trim() });
                    if (jenis === 'Ujian') push(this.manual.ujian.pilihan, '');
                    else if (jenis === 'SGD') push(this.manual.sgd.pilihan, this.manual.sgd.detail);
                    else if (jenis === 'KKD') push(this.manual.kkd.pilihan, this.manual.kkd.detail);
                    else if (jenis === 'Praktikum') (this.manual.labs || []).forEach((l) => push(l.lab, l.kegiatanLab));
                    return rows.filter((r) => r.pilihan || r.detail);
                },
                manualSameKegiatan() {
                    const wanted = this.manualKegiatanDetailRows;
                    if (!wanted.length) return [];
                    const key = (r) => [this.normBagian(r.jenis), this.normBagian(r.blok), this.normBagian(r.pilihan), this.normBagian(r.detail)].join('|');
                    const wantedKeys = {};
                    for (const w of wanted) wantedKeys[key(w)] = true;
                    const out = [];
                    for (const row of this.pengajuanRows) {
                        const id = String(row['ID Pengajuan'] || '').trim();
                        if (!id) continue;
                        const details = this.detailMap[id] || [];
                        const match = details.some((d) => wantedKeys[
                            [this.normBagian(d['Jenis Kegiatan']), this.normBagian(row.Blok), this.normBagian(d.Pilihan), this.normBagian(d.Detail)].join('|')
                        ]);
                        if (!match) continue;
                        out.push({
                            idPengajuan: id, npm: row.NPM, namaLengkap: row['Nama Lengkap'],
                            status: row.Status, blok: row.Blok, hasBa: this.baPendukungSet[id] === true
                        });
                    }
                    return out;
                },
```

- [ ] **Step 5: Tambah method `manualAddAnother`**

Di `new-code1-cf/public/dashboard.html` methods, setelah `resetManualForm() { ... },` (baris 3103-3111), tambahkan:

```js
                manualAddAnother() {
                    this.manual.form.npm = '';
                    this.manual.form.namaLengkap = '';
                    this.notify('Isi NPM & Nama peserta baru. Blok, Jenis, dan Detail tetap sama.');
                },
```

- [ ] **Step 6: Tambah markup panel**

Di `new-code1-cf/public/dashboard.html`, tepat sebelum `<div class="mb-4 overflow-hidden dash-card">` yang berisi panel "Aksi" (baris 915), tambahkan:

```html
                        <div v-if="manualSameKegiatan.length" class="mb-4 overflow-hidden dash-card">
                            <div class="panel-head">
                                <h3><i class="bi bi-people"></i> Kegiatan ini sudah punya {{ manualSameKegiatan.length }} peserta</h3>
                            </div>
                            <div class="p-4">
                                <div class="space-y-1">
                                    <div v-for="m in manualSameKegiatan" :key="m.idPengajuan" class="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-slate-100">
                                        <span class="font-semibold text-slate-700">{{ m.namaLengkap || '-' }}</span>
                                        <span class="font-mono text-[10px] text-slate-400">{{ m.npm }}</span>
                                        <span class="rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset" :class="statusBadge(m.status)">{{ m.status || '-' }}</span>
                                        <span class="rounded-full px-2 py-0.5 text-[10px] font-bold" :class="m.hasBa ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'">BA {{ m.hasBa ? 'Ada' : 'Belum' }}</span>
                                        <button type="button" class="btn-soft !py-1 !px-2 text-[11px] ml-auto" @click="openKelolaBaPendukung(m.idPengajuan)"><i class="bi bi-gear"></i> Kelola BA</button>
                                    </div>
                                </div>
                                <div class="mt-3">
                                    <button type="button" class="btn-soft !py-1.5 text-xs" @click="manualAddAnother()"><i class="bi bi-person-plus"></i> Tambah peserta lain ke kegiatan ini</button>
                                </div>
                            </div>
                        </div>
```

- [ ] **Step 7: Jalankan tes untuk memastikan LULUS**

Run: `cd new-code1-cf && npx vitest run test/dashboard-manual-kegiatan.test.js test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-manual-kegiatan.test.js
git commit -m "feat(dashboard): panel peserta sekegiatan + kelola BA di tab Manual"
```

---

## Task 7: Indikator `pesertaDenganBa` di tab BA

**Files:**
- Modify: `new-code1-cf/public/dashboard.html:1154`
- Test: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Consumes: `unit.pesertaDenganBa` & `unit.jumlahPeserta` dari `getBagianAggregation` (`src/read/dashboard.js:287-288`, sudah ada).

- [ ] **Step 1: Tambahkan assert ke guard test**

Di `new-code1-cf/test/dashboard-template.test.js`, tambahkan tes di dalam `describe('dashboard template', ...)` (setelah tes baris 119-124):

```js
  it('menampilkan indikator BA Pendukung x/y peserta', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('pesertaDenganBa');
  });
```

- [ ] **Step 2: Jalankan tes untuk memastikan GAGAL**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js`
Expected: FAIL — `pesertaDenganBa` belum ada di dashboard.html.

- [ ] **Step 3: Tampilkan indikator**

Di `new-code1-cf/public/dashboard.html` baris 1154, setelah span badge "Ada"/"Belum", tambahkan:

```html
                                                        <span class="ml-1 text-[10px] text-slate-400">{{ r.pesertaDenganBa }}/{{ r.jumlahPeserta }}</span>
```

- [ ] **Step 4: Jalankan tes untuk memastikan LULUS**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "feat(dashboard): indikator BA Pendukung x/y peserta di tab BA"
```

---

## Task 8: Verifikasi penuh

**Files:**
- Test: seluruh suite.

- [ ] **Step 1: Jalankan seluruh suite**

Run: `cd new-code1-cf && npx vitest run`
Expected: PASS semua. Bila muncul flake `Network connection lost`, ulangi seluruh perintah sekali.

- [ ] **Step 2: Verifikasi manual template ter-compile**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "compiles without Vue template errors"`
Expected: PASS (memastikan markup modal baru tidak merusak template Vue).

- [ ] **Step 3: Perbarui status spec**

Di `docs/superpowers/specs/2026-10-14-ba-pendukung-pelaksanaan-unifikasi-design.md`, ubah baris 4 `Status:` menjadi:

```markdown
Status: **Diimplementasi** (lihat `docs/superpowers/plans/2026-10-14-ba-pendukung-pelaksanaan-unifikasi.md`).
```

- [ ] **Step 4: Commit akhir**

```bash
git add docs/superpowers/specs/2026-10-14-ba-pendukung-pelaksanaan-unifikasi-design.md
git commit -m "docs(ba): tandai spec unifikasi BA Pendukung sebagai diimplementasi"
```

---

## Catatan Eksekusi

- **Urutan wajib**: Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Task 4 menyediakan `openKelolaBaPendukung` yang dipakai Task 5/6; Task 3 menyediakan `baPendukungIds` yang dipakai Task 6.
- **Deploy (setelah semua task, bila diminta user)**: dari `new-code1-cf/`, `CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy --config ./wrangler.toml`.
- **Satu peserta per aksi "Tambah peserta + berkas"**: pemilihan kandidat memakai radio (tunggal) agar berkas ↔ peserta tidak ambigu.
