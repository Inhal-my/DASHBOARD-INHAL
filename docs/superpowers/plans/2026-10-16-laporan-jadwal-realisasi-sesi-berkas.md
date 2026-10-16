# Sesi Pelaksanaan, Tab "Jadwal vs Realisasi", dan Penanda Berkas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambah tampilan semua sesi pelaksanaan per unit (E), tab baru "Jadwal vs Realisasi" (F), dan penanda berkas + Base File URL untuk BA Pendukung (G) pada halaman Laporan Detail.

**Architecture:** Hanya F menyentuh backend: `src/read/laporan.js` (getLaporanBootstrap) membaca `jadwal_pelaksanaan`/`jadwal_peserta` dan mengirim `jadwal[]` top-level serta `kegiatan[].jadwal[]`. E dan G sepenuhnya frontend. Seluruh UI ada di `public/detail-laporan.html`.

**Tech Stack:** Cloudflare Workers + D1, Vue 3 (global build), Tailwind inline, SheetJS `XLSX`, Vitest + `@vue/compiler-dom` (test guard template).

## Global Constraints

- Tanpa perubahan skema/migrasi. F hanya membaca tabel yang sudah ada.
- Pertahankan seluruh fitur produksi (Kelola BA, Hapus BA, Riwayat, export lama, tab lama, tab "Daftar BA").
- Definisi "Hilang" (G): `File URL` kosong. Tidak memakai `needs_regen`.
- F: baris = satu per sesi jadwal; status `Sesuai`/`Belum`; BA tanpa jadwal = `Extra`.
- Semua test dijalankan dari `new-code1-cf/` dengan `npx vitest run <file>`.
- Commit per task; trailer `Co-authored-by` ditambahkan otomatis oleh hook (jangan tulis manual).

---

### Task 1: Backend — jadwal masuk `getLaporanBootstrap`

**Files:**
- Modify: `new-code1-cf/src/read/laporan.js`
- Test: `new-code1-cf/test/laporan-jadwal-realisasi.test.js`

**Interfaces:**
- Consumes: `jadwal_pelaksanaan`, `jadwal_peserta`, `berita_acara.jadwal_id`; `kegiatanKey` dari `./common.js`.
- Produces: `boot.jadwal: [{ jadwalId, kegiatanKey, bagian, blok, namaKegiatan, label, tanggal, jam, dosen, catatan, peserta: [{npm,namaLengkap,blok,statusPengajuan}], baId }]`; `kegiatan[].jadwal: [{ jadwalId, tanggal, jam, dosen, catatan, peserta, baId }]`.

- [ ] **Step 1: Tulis test yang gagal**

Create `new-code1-cf/test/laporan-jadwal-realisasi.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getLaporanBootstrap } from '../src/read/laporan.js';

async function seedUnit() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-10-02','')").run();
}

describe('getLaporanBootstrap jadwal', () => {
  it('membawa daftar jadwal aktif dan menautkannya ke unit', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await seedUnit();
    await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-10-01T08:00:00','JDW-2026-0001','SGD','A','SGD 1','sgd|a|sgd 1','2026-10-02','09:00','dr. Andi','',1)").run();
    await env.DB.prepare("INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan) VALUES ('2026-10-01T08:00:00','JDW-2026-0001','INHAL-1','2201010001','Aisyah','A','ACC')").run();
    await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,sumber,kegiatan_key,jadwal_id) VALUES ('2026-10-02T09:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-10-02','09:00','dr. Andi','Bagian','sgd|a|sgd 1','JDW-2026-0001')").run();

    const boot = await getLaporanBootstrap(env.DB, { token });
    expect(Array.isArray(boot.jadwal)).toBe(true);
    const j = boot.jadwal.find((x) => x.jadwalId === 'JDW-2026-0001');
    expect(j).toBeTruthy();
    expect(j.baId).toBe('BA-PEL-2026-0001');
    expect(j.peserta).toHaveLength(1);
    expect(j.peserta[0].namaLengkap).toBe('Aisyah');
    const unit = boot.kegiatan.find((u) => u.key === 'sgd|a|sgd 1');
    expect(unit.jadwal).toHaveLength(1);
    expect(unit.jadwal[0].jadwalId).toBe('JDW-2026-0001');
    expect(unit.jadwal[0].baId).toBe('BA-PEL-2026-0001');
  });

  it('mengecualikan jadwal tidak aktif', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-10-01T08:00:00','JDW-2026-0009','SGD','A','SGD 1','sgd|a|sgd 1','2026-10-02','09:00','dr. Andi','',0)").run();
    const boot = await getLaporanBootstrap(env.DB, { token });
    expect(boot.jadwal.find((x) => x.jadwalId === 'JDW-2026-0009')).toBeFalsy();
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/laporan-jadwal-realisasi.test.js`
Expected: FAIL (boot.jadwal undefined).

- [ ] **Step 3: Baca tabel jadwal di `getLaporanBootstrap`**

Di `new-code1-cf/src/read/laporan.js`, tepat setelah blok `for (const r of baPeserta) { ... }` yang mengisi `pesertaMap` (berakhir sebelum `const baMemberByKey = {};`), tambahkan:

```js
  const jadwalRows = (await db.prepare('SELECT * FROM jadwal_pelaksanaan').all()).results || [];
  const jadwalPesertaRows = (await db.prepare('SELECT * FROM jadwal_peserta').all()).results || [];
  const jadwalPesertaByJadwal = {};
  for (const p of jadwalPesertaRows) {
    const j = String(p.jadwal_id || '').trim();
    if (!j) continue;
    if (!jadwalPesertaByJadwal[j]) jadwalPesertaByJadwal[j] = [];
    jadwalPesertaByJadwal[j].push({
      npm: String(p.npm || '').trim(),
      namaLengkap: String(p.nama_lengkap || '').trim(),
      blok: String(p.blok || '').trim(),
      statusPengajuan: String(p.status_pengajuan || '').trim()
    });
  }
  const baIdByJadwal = {};
  for (const b of ba) {
    const j = String(b.jadwal_id || '').trim();
    if (j && !baIdByJadwal[j]) baIdByJadwal[j] = String(b.ba_id || '').trim();
  }
  const jadwalList = [];
  for (const r of jadwalRows) {
    if (Number(r.active) !== 1) continue;
    const jid = String(r.jadwal_id || '').trim();
    const jBagian = String(r.bagian || '').trim();
    const jBlok = String(r.blok || '').trim();
    const jNama = String(r.nama_kegiatan || '').trim();
    const jKey = String(r.kegiatan_key || '').trim() || kegiatanKey(jBagian, jBlok, jNama);
    jadwalList.push({
      jadwalId: jid, kegiatanKey: jKey, bagian: jBagian, blok: jBlok,
      namaKegiatan: jNama, label: jNama,
      tanggal: String(r.tanggal || '').trim(), jam: String(r.jam || '').trim(),
      dosen: String(r.dosen || '').trim(), catatan: String(r.catatan || '').trim(),
      peserta: jadwalPesertaByJadwal[jid] || [], baId: baIdByJadwal[jid] || ''
    });
  }
```

- [ ] **Step 4: Inisialisasi `jadwal` pada unit**

Di objek pembuatan unit (baris `units.push({ key, bagian, blok: blokUnit, label, peserta: [], baPendukung: [], baPelaksanaan: [], pelaksanaan: [], dosenList: [] });`), tambahkan `jadwal: []` sehingga menjadi:

```js
        units.push({ key, bagian, blok: blokUnit, label, peserta: [], baPendukung: [], baPelaksanaan: [], pelaksanaan: [], dosenList: [], jadwal: [] });
```

- [ ] **Step 5: Lampirkan jadwal ke unit**

Tepat setelah blok `for (const u of units) { u.pelaksanaan = ...; u.progress = ...; u.counts = ...; }` (sebelum `return {`), tambahkan:

```js
  const jadwalByKey = {};
  for (const j of jadwalList) {
    if (!jadwalByKey[j.kegiatanKey]) jadwalByKey[j.kegiatanKey] = [];
    jadwalByKey[j.kegiatanKey].push({
      jadwalId: j.jadwalId, tanggal: j.tanggal, jam: j.jam, dosen: j.dosen,
      catatan: j.catatan, peserta: j.peserta, baId: j.baId
    });
  }
  for (const u of units) u.jadwal = jadwalByKey[u.key] || [];
```

- [ ] **Step 6: Kembalikan `jadwal` top-level**

Pada objek `return { ... }` di akhir fungsi, tambahkan `jadwal: jadwalList,` setelah `kegiatan: units,`:

```js
    kegiatan: units,
    jadwal: jadwalList,
    bagian: { categories: ['Ujian', 'SGD', 'KKD'], labs }
```

- [ ] **Step 7: Jalankan test**

Run: `npx vitest run test/laporan-jadwal-realisasi.test.js test/read-laporan.test.js`
Expected: PASS semua.

- [ ] **Step 8: Commit**

```bash
git add new-code1-cf/src/read/laporan.js new-code1-cf/test/laporan-jadwal-realisasi.test.js
git commit -m "feat(laporan): bawa jadwal pelaksanaan pada bootstrap laporan"
```

---

### Task 2: Frontend — lapisan data tab Jadwal vs Realisasi

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html`
- Test: `new-code1-cf/test/detail-laporan-jadwal-realisasi-template.test.js`

**Interfaces:**
- Consumes: `bootstrap.jadwal`, `bootstrap.kegiatan[].jadwal`, `baPelaksanaan[].Jadwal ID`.
- Produces: state `jadwal`, `jadwalFilter`; computed `baPelaksanaanIndex`, `jadwalRealisasiRows`, `jadwalExtraRows`, `jadwalRealisasiAll`, `jadwalRealisasiFiltered`, `jadwalBagianOptions`, `jadwalBlokOptions`, `jadwalStatusOptions`, `jadwalTotalCount`, `jadwalSesuaiCount`, `jadwalBelumCount`, `jadwalExtraCount`.

- [ ] **Step 1: Tulis test yang gagal**

Create `new-code1-cf/test/detail-laporan-jadwal-realisasi-template.test.js`:

```js
import { env } from 'cloudflare:test';
import { compile } from '@vue/compiler-dom';
import { describe, it, expect } from 'vitest';

function extractAppTemplate(html) {
  const start = html.indexOf('<div id="app"');
  if (start === -1) throw new Error('#app root not found');
  const scriptStart = html.indexOf('<script src="/gs-shim.js"', start);
  const slice = html.slice(start, scriptStart === -1 ? html.length : scriptStart);
  const re = /<div\b|<\/div>/g;
  let depth = 0;
  let end = -1;
  let m;
  while ((m = re.exec(slice))) {
    if (m[0] === '</div>') { depth -= 1; if (depth === 0) { end = re.lastIndex; break; } }
    else depth += 1;
  }
  if (end === -1) throw new Error('#app root close not found');
  return slice.slice(0, end);
}

function installDocumentStub() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement: () => {
      const el = {
        _html: '',
        set innerHTML(v) { this._html = String(v); },
        get innerHTML() { return this._html; },
        get textContent() { return this._html; },
        get children() {
          const match = this._html.match(/^<div foo="([\s\S]*)">$/);
          const value = match ? match[1] : this._html;
          return [{ getAttribute: () => value }];
        }
      };
      return el;
    }
  };
}

async function loadHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/detail-laporan.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('jadwal realisasi: template', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadHtml();
    const errors = [];
    compile(extractAppTemplate(html), {
      onError: (e) => errors.push(e.message),
      onWarn: (w) => errors.push('warn: ' + w.message)
    });
    expect(errors).toEqual([]);
  });
});

describe('jadwal realisasi: lapisan data', () => {
  it('menyediakan state jadwal & filter', async () => {
    const html = await loadHtml();
    expect(html).toContain('jadwal: [],');
    expect(html).toContain("jadwalFilter: { bagian: '', blok: '', from: '', to: '', status: '', q: '' }");
    expect(html).toContain('this.jadwal = data.jadwal || []');
  });
  it('menyediakan computed kunci', async () => {
    const html = await loadHtml();
    for (const name of ['baPelaksanaanIndex()', 'jadwalRealisasiRows()', 'jadwalExtraRows()',
      'jadwalRealisasiAll()', 'jadwalRealisasiFiltered()', 'jadwalBagianOptions()',
      'jadwalBlokOptions()', 'jadwalStatusOptions()', 'jadwalTotalCount()',
      'jadwalSesuaiCount()', 'jadwalBelumCount()', 'jadwalExtraCount()']) {
      expect(html).toContain(name);
    }
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-jadwal-realisasi-template.test.js`
Expected: FAIL pada describe "lapisan data".

- [ ] **Step 3: Tambah state**

Di `initialData()`, tepat setelah baris `baListFilter: { bagian: '', blok: '', jenis: '', from: '', to: '', dosen: '', sumber: '', kelengkapan: '', q: '' },`, tambahkan:

```js
                    jadwal: [],
                    jadwalFilter: { bagian: '', blok: '', from: '', to: '', status: '', q: '' },
```

- [ ] **Step 4: Isi `jadwal` saat load**

Di `loadData()`, tepat setelah baris `this.blok = data.blok || [];`, tambahkan:

```js
                        this.jadwal = data.jadwal || [];
```

Dan di blok `catch`, tepat setelah `this.blok = [];`, tambahkan:

```js
                        this.jadwal = [];
```

- [ ] **Step 5: Tambah computed**

Di blok `computed`, ganti penutup computed `daftarBaUnitRows()` berikut:

```js
                daftarBaUnitRows() {
                    const bagian = this.baListFilter.bagian;
                    const blok = String(this.baListFilter.blok || '').trim();
                    return (this.kegiatan || []).filter((u) => {
                        if (bagian && this.normBagian(u.bagian) !== this.normBagian(bagian)) return false;
                        if (blok && String(u.blok || '').trim() !== blok) return false;
                        return true;
                    });
                }
            },
```

dengan versi berikut (menambahkan koma setelah `daftarBaUnitRows` dan computed baru):

```js
                daftarBaUnitRows() {
                    const bagian = this.baListFilter.bagian;
                    const blok = String(this.baListFilter.blok || '').trim();
                    return (this.kegiatan || []).filter((u) => {
                        if (bagian && this.normBagian(u.bagian) !== this.normBagian(bagian)) return false;
                        if (blok && String(u.blok || '').trim() !== blok) return false;
                        return true;
                    });
                },
                baPelaksanaanIndex() {
                    const map = {};
                    (this.kegiatan || []).forEach((u) => {
                        (u.baPelaksanaan || []).forEach((b) => {
                            const id = String(b['BA ID'] || '').trim();
                            if (id) map[id] = b;
                        });
                    });
                    return map;
                },
                jadwalRealisasiRows() {
                    const idx = this.baPelaksanaanIndex;
                    return (this.jadwal || []).map((j) => {
                        const b = j.baId ? idx[j.baId] : null;
                        return {
                            jenis: 'Jadwal',
                            key: 'J-' + j.jadwalId,
                            jadwalId: j.jadwalId || '',
                            baId: j.baId || '',
                            bagian: j.bagian || '',
                            blok: j.blok || '',
                            kegiatan: j.namaKegiatan || j.label || '',
                            label: j.label || '',
                            jadwalTanggal: j.tanggal || '',
                            jadwalJam: j.jam || '',
                            jadwalDosen: j.dosen || '',
                            jadwalPesertaCount: (j.peserta || []).length,
                            baTanggal: b ? (b['Tanggal Pelaksanaan'] || '') : '',
                            baJam: b ? (b.Jam || '') : '',
                            baDosen: b ? (b.Dosen || '') : '',
                            baPesertaCount: b ? ((b.peserta || []).length || 0) : 0,
                            status: j.baId ? 'Sesuai' : 'Belum'
                        };
                    });
                },
                jadwalExtraRows() {
                    const out = [];
                    (this.kegiatan || []).forEach((u) => {
                        (u.baPelaksanaan || []).forEach((b) => {
                            if (String(b['Jadwal ID'] || '').trim()) return;
                            out.push({
                                jenis: 'Extra',
                                key: 'E-' + (b['BA ID'] || ''),
                                jadwalId: '',
                                baId: b['BA ID'] || '',
                                bagian: u.bagian || '',
                                blok: u.blok || '',
                                kegiatan: u.label || '',
                                label: b.Label || '',
                                jadwalTanggal: '', jadwalJam: '', jadwalDosen: '', jadwalPesertaCount: 0,
                                baTanggal: b['Tanggal Pelaksanaan'] || '',
                                baJam: b.Jam || '',
                                baDosen: b.Dosen || '',
                                baPesertaCount: (b.peserta || []).length,
                                status: 'Extra'
                            });
                        });
                    });
                    return out;
                },
                jadwalRealisasiAll() {
                    return this.jadwalRealisasiRows.concat(this.jadwalExtraRows);
                },
                jadwalRealisasiFiltered() {
                    const f = this.jadwalFilter;
                    const bagian = f.bagian;
                    const blok = String(f.blok || '').trim();
                    const fromD = f.from ? this.dateVal(f.from) : null;
                    const toD = f.to ? this.dateVal(f.to) : null;
                    if (toD) toD.setHours(23, 59, 59, 999);
                    const q = this.normSearch(f.q);
                    return this.jadwalRealisasiAll.filter((r) => {
                        if (bagian && this.normBagian(r.bagian) !== this.normBagian(bagian)) return false;
                        if (blok && String(r.blok || '').trim() !== blok) return false;
                        if (f.status && r.status !== f.status) return false;
                        const dRef = r.jenis === 'Extra' ? r.baTanggal : r.jadwalTanggal;
                        if (fromD || toD) {
                            const d = this.dateVal(dRef);
                            if (!d || (fromD && d < fromD) || (toD && d > toD)) return false;
                        }
                        if (q) {
                            const hay = [r.jadwalId, r.baId, r.kegiatan, r.bagian, r.blok, r.label, r.jadwalDosen, r.baDosen]
                                .map((s) => this.normSearch(s)).join(' ');
                            if (hay.indexOf(q) === -1) return false;
                        }
                        return true;
                    });
                },
                jadwalBagianOptions() {
                    const set = {};
                    this.jadwalRealisasiAll.forEach((r) => { if (r.bagian) set[r.bagian] = 1; });
                    return Object.keys(set).sort((a, b) => a.localeCompare(b));
                },
                jadwalBlokOptions() {
                    const bagian = this.jadwalFilter.bagian;
                    const set = {};
                    this.jadwalRealisasiAll.forEach((r) => {
                        if (!r.blok) return;
                        if (bagian && this.normBagian(r.bagian) !== this.normBagian(bagian)) return;
                        set[r.blok] = 1;
                    });
                    return Object.keys(set).sort((a, b) => a.localeCompare(b));
                },
                jadwalStatusOptions() {
                    return ['Sesuai', 'Belum', 'Extra'];
                },
                jadwalTotalCount() {
                    return this.jadwalRealisasiFiltered.length;
                },
                jadwalSesuaiCount() {
                    return this.jadwalRealisasiFiltered.filter((r) => r.status === 'Sesuai').length;
                },
                jadwalBelumCount() {
                    return this.jadwalRealisasiFiltered.filter((r) => r.status === 'Belum').length;
                },
                jadwalExtraCount() {
                    return this.jadwalRealisasiFiltered.filter((r) => r.status === 'Extra').length;
                }
            },
```

- [ ] **Step 6: Jalankan test**

Run: `npx vitest run test/detail-laporan-jadwal-realisasi-template.test.js test/detail-laporan-template.test.js`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-jadwal-realisasi-template.test.js
git commit -m "feat(laporan): lapisan data tab jadwal vs realisasi"
```

---

### Task 3: Frontend — tab + section UI "Jadwal vs Realisasi"

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html`
- Test: `new-code1-cf/test/detail-laporan-jadwal-realisasi-template.test.js`

**Interfaces:**
- Consumes: computed dari Task 2.
- Produces: tab `jadwal` + section UI (ringkasan, filter, tabel desktop, kartu mobile).

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `test/detail-laporan-jadwal-realisasi-template.test.js`:

```js
describe('jadwal realisasi: tab & UI', () => {
  it('mendaftarkan tab dan section', async () => {
    const html = await loadHtml();
    expect(html).toContain("key: 'jadwal', label: 'Jadwal vs Realisasi'");
    expect(html).toContain("activeTab === 'jadwal'");
  });
  it('memuat kolom, filter, dan badge status', async () => {
    const html = await loadHtml();
    for (const s of ['>Jadwal</th>', '>Dosen Jadwal</th>', '>Peserta Jadwal</th>',
      '>Realisasi</th>', '>Dosen Realisasi</th>', '>Peserta BA</th>', '>Status</th>']) {
      expect(html).toContain(s);
    }
    for (const s of ['jadwalFilter.bagian', 'jadwalFilter.blok', 'jadwalFilter.from',
      'jadwalFilter.to', 'jadwalFilter.status', 'jadwalFilter.q']) {
      expect(html).toContain(s);
    }
    expect(html).toContain('Sesuai');
    expect(html).toContain('Belum');
    expect(html).toContain('Extra');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-jadwal-realisasi-template.test.js`
Expected: FAIL pada describe "tab & UI".

- [ ] **Step 3: Daftarkan tab**

Di `initialData()`, pada array `tabs`, tepat setelah baris `{ key: 'daftarba', label: 'Daftar BA', icon: 'bi-list-check' },`, tambahkan:

```js
                        { key: 'jadwal', label: 'Jadwal vs Realisasi', icon: 'bi-calendar2-check' },
```

- [ ] **Step 4: Sisip section UI**

Sisipkan section berikut **sebelum** baris `<!-- ===================== TAB 5: DATA PEMBAYARAN ===================== -->`:

```html
                    <!-- ===================== TAB: JADWAL VS REALISASI ===================== -->
                    <section v-if="activeTab === 'jadwal'" class="space-y-4">
                        <div class="in-basum">
                            <div class="b"><div class="k">Sesi Jadwal</div><div class="n">{{ jadwalTotalCount }}</div><div class="p">terfilter</div></div>
                            <div class="b"><div class="k">Sesuai</div><div class="n emerald">{{ jadwalSesuaiCount }}</div><div class="p">punya BA</div></div>
                            <div class="b"><div class="k">Belum</div><div class="n">{{ jadwalBelumCount }}</div><div class="p">tanpa BA</div></div>
                            <div class="b"><div class="k">BA Extra</div><div class="n">{{ jadwalExtraCount }}</div><div class="p">tanpa jadwal</div></div>
                        </div>
                        <div class="lap-card p-4">
                            <div class="grid gap-3 md:grid-cols-12">
                                <div class="md:col-span-3"><label class="label">Bagian</label><select v-model="jadwalFilter.bagian" class="input"><option value="">Semua Bagian</option><option v-for="o in jadwalBagianOptions" :key="o" :value="o">{{ o }}</option></select></div>
                                <div class="md:col-span-3"><label class="label">Blok</label><select v-model="jadwalFilter.blok" class="input"><option value="">Semua Blok</option><option v-for="o in jadwalBlokOptions" :key="o" :value="o">{{ o }}</option></select></div>
                                <div class="md:col-span-3"><label class="label">Dari Tanggal</label><input v-model="jadwalFilter.from" type="date" class="input"></div>
                                <div class="md:col-span-3"><label class="label">Sampai Tanggal</label><input v-model="jadwalFilter.to" type="date" class="input"></div>
                                <div class="md:col-span-3"><label class="label">Status</label><select v-model="jadwalFilter.status" class="input"><option value="">Semua Status</option><option v-for="o in jadwalStatusOptions" :key="o" :value="o">{{ o }}</option></select></div>
                                <div class="md:col-span-6"><label class="label">Cari</label><input v-model="jadwalFilter.q" class="input" placeholder="Jadwal ID, BA ID, kegiatan, atau dosen..."></div>
                            </div>
                            <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                                <span class="lap-chip">{{ jadwalTotalCount }} sesi</span>
                                <span class="lap-chip">{{ jadwalSesuaiCount }} sesuai</span>
                                <span class="lap-chip">{{ jadwalBelumCount }} belum</span>
                                <span class="lap-chip">{{ jadwalExtraCount }} extra</span>
                            </div>
                        </div>
                        <div class="overflow-hidden lap-card">
                            <div class="lap-card-head">
                                <div>
                                    <div class="lap-card-title">Jadwal vs Realisasi</div>
                                    <div class="lap-card-sub">Perbandingan sesi jadwal pelaksanaan dengan BA realisasi</div>
                                </div>
                            </div>
                            <div class="overflow-x-auto in-desktop-only">
                                <table class="in-tbl">
                                    <thead>
                                        <tr class="lap-th text-[11px] uppercase tracking-wide text-slate-500">
                                            <th class="px-3 py-2.5 text-left">Kegiatan</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Bagian</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Blok</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Jadwal</th>
                                            <th class="px-3 py-2.5 text-left">Dosen Jadwal</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-center">Peserta Jadwal</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Realisasi</th>
                                            <th class="px-3 py-2.5 text-left">Dosen Realisasi</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-center">Peserta BA</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="r in jadwalRealisasiFiltered" :key="r.key" class="border-t border-slate-50">
                                            <td class="px-3 py-2.5 text-slate-800">{{ r.kegiatan || '-' }}<span v-if="r.label" class="text-slate-400"> · {{ r.label }}</span></td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-slate-700">{{ r.bagian }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-slate-600">{{ r.blok || '-' }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-slate-600"><span v-if="r.jadwalTanggal">{{ fmtTanggal(r.jadwalTanggal) }}</span><span v-else class="text-slate-300">-</span><span v-if="r.jadwalJam" class="text-slate-400"> {{ r.jadwalJam }}</span></td>
                                            <td class="px-3 py-2.5 text-slate-600">{{ r.jadwalDosen || '-' }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-center font-semibold text-slate-700">{{ r.jenis === 'Extra' ? '-' : r.jadwalPesertaCount }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5"><span v-if="r.baId" class="font-mono text-xs text-slate-700">{{ r.baId }}</span><span v-else class="text-slate-300">-</span><span v-if="r.baTanggal" class="text-slate-400"> · {{ fmtTanggal(r.baTanggal) }}</span><span v-if="r.baJam" class="text-slate-400"> {{ r.baJam }}</span></td>
                                            <td class="px-3 py-2.5 text-slate-600">{{ r.baDosen || '-' }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-center font-semibold text-slate-700">{{ r.baId ? r.baPesertaCount : '-' }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5"><span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="r.status === 'Sesuai' ? 'bg-emerald-50 text-emerald-700' : (r.status === 'Belum' ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700')">{{ r.status }}</span></td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div v-if="!jadwalRealisasiFiltered.length" class="px-4 py-14 text-center">
                                    <i class="bi bi-calendar2-x text-3xl text-slate-300"></i>
                                    <p class="mt-3 text-sm text-slate-400">Tidak ada data jadwal/realisasi.</p>
                                </div>
                            </div>
                            <div class="in-cards">
                                <article v-for="r in jadwalRealisasiFiltered" :key="'m-' + r.key" class="in-mcard">
                                    <div class="row1"><span class="font-semibold text-slate-800">{{ r.kegiatan || '-' }}</span><span class="rounded-full px-2 py-0.5 text-[10px] font-bold" :class="r.status === 'Sesuai' ? 'bg-emerald-50 text-emerald-700' : (r.status === 'Belum' ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700')">{{ r.status }}</span></div>
                                    <div class="kv"><span>Bagian</span><b>{{ r.bagian }}</b><span>Blok</span><b>{{ r.blok || '-' }}</b><span>Jadwal</span><b>{{ r.jadwalTanggal ? fmtTanggal(r.jadwalTanggal) : '-' }} {{ r.jadwalJam }}</b><span>Dosen Jadwal</span><b>{{ r.jadwalDosen || '-' }}</b><span>Peserta Jadwal</span><b>{{ r.jenis === 'Extra' ? '-' : r.jadwalPesertaCount }}</b><span>Realisasi</span><b>{{ r.baId || '-' }} {{ r.baJam }}</b><span>Dosen Realisasi</span><b>{{ r.baDosen || '-' }}</b><span>Peserta BA</span><b>{{ r.baId ? r.baPesertaCount : '-' }}</b></div>
                                </article>
                            </div>
                        </div>
                    </section>

```

- [ ] **Step 5: Jalankan test**

Run: `npx vitest run test/detail-laporan-jadwal-realisasi-template.test.js test/detail-laporan-template.test.js`
Expected: PASS semua.

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-jadwal-realisasi-template.test.js
git commit -m "feat(laporan): tab Jadwal vs Realisasi dengan filter dan tabel"
```

---

### Task 4: Frontend — Export XLSX tab Jadwal vs Realisasi

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html`
- Test: `new-code1-cf/test/detail-laporan-jadwal-realisasi-template.test.js`

**Interfaces:**
- Consumes: `jadwalRealisasiFiltered`, `writeXlsxStyled`, `_loadXlsx`.
- Produces: method `exportJadwalRealisasi()`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan:

```js
describe('jadwal realisasi: export xlsx', () => {
  it('menyediakan handler, sheet, dan tombol', async () => {
    const html = await loadHtml();
    expect(html).toContain('exportJadwalRealisasi()');
    expect(html).toContain("'Jadwal vs Realisasi'");
    expect(html).toContain('Export XLSX');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-jadwal-realisasi-template.test.js`
Expected: FAIL pada describe "export xlsx".

- [ ] **Step 3: Tambah method export**

Ganti penutup method `exportDaftarBa()` berikut:

```js
                    }).catch((e) => {
                        this.exporting = false;
                        this.showToast('bi-x-circle', 'Export gagal: ' + ((e && e.message) ? e.message : e));
                    });
                }
            },
            mounted() {
```

dengan (menambah `exportJadwalRealisasi`):

```js
                    }).catch((e) => {
                        this.exporting = false;
                        this.showToast('bi-x-circle', 'Export gagal: ' + ((e && e.message) ? e.message : e));
                    });
                },
                exportJadwalRealisasi() {
                    this.exporting = true;
                    this._loadXlsx().then(() => {
                        try {
                            const wb = XLSX.utils.book_new();
                            const rows = this.jadwalRealisasiFiltered.map((r) => ({
                                'Bagian': r.bagian,
                                'Blok': r.blok,
                                'Nama Kegiatan': r.kegiatan,
                                'Label': r.label,
                                'Jenis': r.jenis,
                                'Jadwal ID': r.jadwalId,
                                'Tanggal Jadwal': r.jadwalTanggal ? fmtTanggalWaktu(r.jadwalTanggal) : '',
                                'Jam Jadwal': r.jadwalJam,
                                'Dosen Jadwal': r.jadwalDosen,
                                'Peserta Jadwal': r.jenis === 'Extra' ? '' : r.jadwalPesertaCount,
                                'BA ID': r.baId,
                                'Tanggal Realisasi': r.baTanggal ? fmtTanggalWaktu(r.baTanggal) : '',
                                'Jam Realisasi': r.baJam,
                                'Dosen Realisasi': r.baDosen,
                                'Peserta Realisasi': r.baId ? r.baPesertaCount : '',
                                'Status': r.status
                            }));
                            const ws = rows.length
                                ? XLSX.utils.json_to_sheet(rows)
                                : XLSX.utils.aoa_to_sheet([['Bagian', 'Blok', 'Nama Kegiatan', 'Label', 'Jenis', 'Jadwal ID', 'Tanggal Jadwal', 'Jam Jadwal', 'Dosen Jadwal', 'Peserta Jadwal', 'BA ID', 'Tanggal Realisasi', 'Jam Realisasi', 'Dosen Realisasi', 'Peserta Realisasi', 'Status']]);
                            XLSX.utils.book_append_sheet(wb, ws, 'Jadwal vs Realisasi');
                            writeXlsxStyled(wb, 'Jadwal-Realisasi-' + new Date().toISOString().slice(0, 10) + '.xlsx');
                            this.showToast('bi-check-circle', 'Export jadwal vs realisasi berhasil diunduh.');
                        } catch (e) {
                            this.showToast('bi-x-circle', 'Export gagal: ' + ((e && e.message) ? e.message : e));
                        } finally {
                            this.exporting = false;
                        }
                    }).catch((e) => {
                        this.exporting = false;
                        this.showToast('bi-x-circle', 'Export gagal: ' + ((e && e.message) ? e.message : e));
                    });
                }
            },
            mounted() {
```

- [ ] **Step 4: Tambah tombol Export**

Pada `lap-card-head` di section "Jadwal vs Realisasi" (Task 3), tepat setelah `<div>...</div>` judul, tambahkan:

```html
                                <button class="btn-soft !py-1.5 text-xs" :disabled="exporting" @click="exportJadwalRealisasi"><i class="bi bi-file-earmark-excel"></i> Export XLSX</button>
```

- [ ] **Step 5: Jalankan test**

Run: `npx vitest run test/detail-laporan-jadwal-realisasi-template.test.js test/detail-laporan-template.test.js`
Expected: PASS semua.

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-jadwal-realisasi-template.test.js
git commit -m "feat(laporan): export xlsx jadwal vs realisasi"
```

---

### Task 5: Frontend — E: semua sesi pelaksanaan per unit

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html`
- Test: `new-code1-cf/test/detail-laporan-jadwal-realisasi-template.test.js`

**Interfaces:**
- Consumes: `r.pelaksanaan[]`, `r.baPelaksanaan[]`.
- Produces: method `baPelaksanaanFileUrl(baId)`; section "Sesi Pelaksanaan" + badge "N sesi".

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan:

```js
describe('sesi pelaksanaan per unit', () => {
  it('menampilkan daftar semua sesi dan badge jumlah', async () => {
    const html = await loadHtml();
    expect(html).toContain('Sesi Pelaksanaan');
    expect(html).toContain('sesi</span>');
    expect(html).toContain('baPelaksanaanFileUrl(');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-jadwal-realisasi-template.test.js`
Expected: FAIL pada describe "sesi pelaksanaan per unit".

- [ ] **Step 3: Tambah method `baPelaksanaanFileUrl`**

Di blok `methods`, tepat setelah penutup method `baDaftarItem(b, jenis, unit) { ... },`, tambahkan:

```js
                baPelaksanaanFileUrl(baId) {
                    const id = String(baId || '').trim();
                    if (!id) return '';
                    for (const u of (this.kegiatan || [])) {
                        for (const b of (u.baPelaksanaan || [])) {
                            if (String(b['BA ID'] || '').trim() === id) return b['File URL'] || '';
                        }
                    }
                    return '';
                },
```

- [ ] **Step 4: Tambah badge "N sesi" pada sel Realisasi**

Ganti sel berikut di tab Berita Acara:

```html
                                                <td class="whitespace-nowrap px-3 py-2.5 text-slate-600">
                                                    <span v-if="r.pelaksanaan && r.pelaksanaan.length">{{ fmtTanggalWaktu(r.pelaksanaan[0].tanggal + (r.pelaksanaan[0].jam ? 'T' + r.pelaksanaan[0].jam : '')) }}</span>
                                                    <span v-else class="text-slate-300">-</span>
                                                </td>
```

dengan:

```html
                                                <td class="whitespace-nowrap px-3 py-2.5 text-slate-600">
                                                    <span v-if="r.pelaksanaan && r.pelaksanaan.length">{{ fmtTanggalWaktu(r.pelaksanaan[0].tanggal + (r.pelaksanaan[0].jam ? 'T' + r.pelaksanaan[0].jam : '')) }}</span>
                                                    <span v-else class="text-slate-300">-</span>
                                                    <span v-if="(r.pelaksanaan || []).length > 1" class="ml-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">{{ r.pelaksanaan.length }} sesi</span>
                                                </td>
```

- [ ] **Step 5: Tambah section "Sesi Pelaksanaan"**

Di panel expand tab Berita Acara, tepat setelah penutup `</div>` kolom Berita Acara (yaitu baris yang menutup blok yang dimulai `<div class="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Berita Acara</div>`, sebelum `</div>` penutup grid `grid gap-4 lg:grid-cols-2`), tambahkan:

```html
                                                        <div class="lg:col-span-2">
                                                            <div class="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Sesi Pelaksanaan ({{ (r.pelaksanaan || []).length }})</div>
                                                            <div v-if="!(r.pelaksanaan || []).length" class="text-xs text-slate-400">Belum ada sesi pelaksanaan.</div>
                                                            <div class="space-y-1">
                                                                <div v-for="(s, si) in (r.pelaksanaan || [])" :key="'sx' + si" class="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs">
                                                                    <span class="font-mono text-[10px] text-slate-400">#{{ si + 1 }}</span>
                                                                    <span v-if="s.tanggal" class="text-slate-600">{{ fmtTanggal(s.tanggal) }}</span>
                                                                    <span v-else class="text-slate-400">-</span>
                                                                    <span v-if="s.jam" class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{{ s.jam }}</span>
                                                                    <span class="text-slate-600">{{ s.dosen || '-' }}</span>
                                                                    <a v-if="baPelaksanaanFileUrl(s.baId)" :href="safeUrl(baPelaksanaanFileUrl(s.baId))" target="_blank" rel="noopener noreferrer" class="link ml-auto">{{ s.baId }}</a>
                                                                    <span v-else class="ml-auto font-mono text-[10px] text-slate-400">{{ s.baId }}</span>
                                                                </div>
                                                            </div>
                                                        </div>
```

- [ ] **Step 6: Jalankan test**

Run: `npx vitest run test/detail-laporan-jadwal-realisasi-template.test.js test/detail-laporan-template.test.js`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-jadwal-realisasi-template.test.js
git commit -m "feat(laporan): daftar semua sesi pelaksanaan per unit"
```

---

### Task 6: Frontend — G: penanda berkas & Base File URL

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html`
- Test: `new-code1-cf/test/detail-laporan-jadwal-realisasi-template.test.js`

**Interfaces:**
- Consumes: `Base File URL` pada BA Pendukung.
- Produces: `baDaftarItem().baseFileUrl`, `baDaftarItem().berkasAda`; badge Ada/Hilang + link Base di Daftar BA dan item BA Pendukung; kolom export `Base File URL`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan:

```js
describe('penanda berkas BA pendukung', () => {
  it('menyediakan baseFileUrl & berkasAda', async () => {
    const html = await loadHtml();
    expect(html).toContain("baseFileUrl: (b && b['Base File URL']) || ''");
    expect(html).toContain("berkasAda: !!String((b && b['File URL']) || '').trim()");
  });
  it('menampilkan badge Ada/Hilang dan Base File', async () => {
    const html = await loadHtml();
    expect(html).toContain("r.berkasAda ? 'Ada' : 'Hilang'");
    expect(html).toContain('Base File');
    expect(html).toContain("'Base File URL'");
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-jadwal-realisasi-template.test.js`
Expected: FAIL pada describe "penanda berkas BA pendukung".

- [ ] **Step 3: Perluas `baDaftarItem`**

Di method `baDaftarItem(b, jenis, unit)`, tepat setelah baris `fileUrl: (b && b['File URL']) || '',`, tambahkan:

```js
                        baseFileUrl: (b && b['Base File URL']) || '',
                        berkasAda: !!String((b && b['File URL']) || '').trim(),
```

- [ ] **Step 4: Ubah kolom "Berkas" tab Daftar BA**

Ganti sel berikut:

```html
                                            <td class="whitespace-nowrap px-3 py-2.5"><a v-if="r.fileUrl" :href="safeUrl(r.fileUrl)" target="_blank" rel="noopener noreferrer" class="link">Lihat</a><span v-else class="text-slate-300">-</span></td>
```

dengan:

```html
                                            <td class="whitespace-nowrap px-3 py-2.5"><span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="r.berkasAda ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">{{ r.berkasAda ? 'Ada' : 'Hilang' }}</span> <a v-if="r.fileUrl" :href="safeUrl(r.fileUrl)" target="_blank" rel="noopener noreferrer" class="link">Lihat</a> <a v-if="r.jenis === 'Pendukung' && r.baseFileUrl" :href="safeUrl(r.baseFileUrl)" target="_blank" rel="noopener noreferrer" class="link">Base</a></td>
```

- [ ] **Step 5: Ubah kartu mobile Daftar BA**

Ganti baris actions berikut:

```html
                                    <div class="actions">
                                        <a v-if="r.fileUrl" :href="safeUrl(r.fileUrl)" target="_blank" rel="noopener noreferrer" class="btn-soft"><i class="bi bi-file-earmark-pdf"></i> Berkas</a>
```

dengan:

```html
                                    <div class="actions">
                                        <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="r.berkasAda ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">{{ r.berkasAda ? 'Ada' : 'Hilang' }}</span>
                                        <a v-if="r.fileUrl" :href="safeUrl(r.fileUrl)" target="_blank" rel="noopener noreferrer" class="btn-soft"><i class="bi bi-file-earmark-pdf"></i> Berkas</a>
                                        <a v-if="r.jenis === 'Pendukung' && r.baseFileUrl" :href="safeUrl(r.baseFileUrl)" target="_blank" rel="noopener noreferrer" class="btn-soft"><i class="bi bi-file-earmark-pdf"></i> Base</a>
```

- [ ] **Step 6: Tambah penanda pada item BA Pendukung (tab Berita Acara)**

Di tab Berita Acara, tepat setelah span badge Lengkap/Draft BA Pendukung (`{{ baLengkap(b, 'Pendukung') ? 'Lengkap' : 'Draft' }}</span>`), tambahkan:

```html
                                                                    <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="b['File URL'] ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">{{ b['File URL'] ? 'Berkas: Ada' : 'Berkas: Hilang' }}</span>
                                                                    <a v-if="b['Base File URL']" :href="safeUrl(b['Base File URL'])" target="_blank" rel="noopener noreferrer" class="link">Base File</a>
```

- [ ] **Step 7: Tambah kolom Base File URL pada export Daftar BA**

Di method `exportDaftarBa()`, ubah array header:

```js
                            const headers = ['BA ID', 'Jenis BA', 'Bagian', 'Blok', 'Nama Kegiatan', 'Label',
                                'Tanggal Pelaksanaan', 'Jam', 'Dosen', 'Jumlah Peserta', 'Sumber', 'Dibuat',
                                'Kelengkapan', 'Catatan', 'File URL'];
```

menjadi:

```js
                            const headers = ['BA ID', 'Jenis BA', 'Bagian', 'Blok', 'Nama Kegiatan', 'Label',
                                'Tanggal Pelaksanaan', 'Jam', 'Dosen', 'Jumlah Peserta', 'Sumber', 'Dibuat',
                                'Kelengkapan', 'Catatan', 'File URL', 'Base File URL'];
```

Dan ubah baris objek terakhir `'File URL': r.fileUrl` menjadi:

```js
                                'File URL': r.fileUrl,
                                'Base File URL': r.baseFileUrl
```

Dan tambah hyperlink setelah `setUrlHyperlinks(wsBa, 'File URL', 'Buka file berita acara');`:

```js
                            setUrlHyperlinks(wsBa, 'Base File URL', 'Buka file dasar');
```

- [ ] **Step 8: Jalankan test**

Run: `npx vitest run test/detail-laporan-jadwal-realisasi-template.test.js test/detail-laporan-template.test.js`
Expected: PASS semua.

- [ ] **Step 9: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-jadwal-realisasi-template.test.js
git commit -m "feat(laporan): penanda berkas dan base file url BA pendukung"
```

---

### Task 7: Verifikasi penuh

**Files:**
- (tidak ada perubahan kode)

**Interfaces:**
- Consumes: seluruh task sebelumnya.

- [ ] **Step 1: Jalankan suite penuh**

Run: `npm test`
Expected: seluruh test file PASS (0 gagal).

- [ ] **Step 2: Cek regresi istilah/sheet lama**

Run:

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('public/detail-laporan.html','utf8');for(const s of ['baGroupRows','filteredBaTab','>Diterima<'])if(h.includes(s))throw new Error('regresi: '+s);console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Verifikasi bootstrap mengirim jadwal (smoke)**

Run: `npx vitest run test/laporan-jadwal-realisasi.test.js test/detail-laporan-jadwal-realisasi-template.test.js`
Expected: PASS semua.

- [ ] **Step 4: Commit (bila ada penyesuaian test)**

```bash
git add -A
git commit -m "test(laporan): verifikasi jadwal vs realisasi" || echo "nothing to commit"
```

---

## Catatan

- Semua perubahan frontend memakai pola `in-*`/`lap-*` yang sudah ada agar konsisten dengan mockup.
- Rujukan realisasi pada F memakai `Jadwal ID` (relasi eksplisit BA↔jadwal); BA Pelaksanaan tanpa `Jadwal ID` menjadi baris `Extra`.
