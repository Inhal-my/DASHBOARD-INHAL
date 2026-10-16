# Tab "Daftar BA" dan Kelengkapan Berita Acara — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambah tab baru "Daftar BA" (daftar datar semua BA + filter + export dua sheet) dan indikator kelengkapan/keanggotaan BA pada halaman Laporan Detail.

**Architecture:** Sepenuhnya frontend di `new-code1-cf/public/detail-laporan.html`. Data tidak berubah: computed baru meratakan `kegiatan[].baPendukung` (admin) dan `kegiatan[].baPelaksanaan` (Bagian) menjadi baris BA ternormalisasi, lalu difilter di klien. Tanpa perubahan `src/**` atau migrasi.

**Tech Stack:** Vue 3 (global build), Tailwind (bundle inline), SheetJS `XLSX`, Vitest + `@vue/compiler-dom` (test guard template).

## Global Constraints

- Tanpa perubahan backend (`src/**`), skema, atau migrasi. Frontend-only.
- Pertahankan seluruh fitur produksi: Kelola BA, Hapus BA, Riwayat, export lama, tab lama.
- Tidak mengerjakan E/F/G pada iterasi ini.
- Definisi kelengkapan: BA Pelaksanaan Lengkap bila `Dosen` + `Tanggal Pelaksanaan` + `Jam` terisi; BA Pendukung Lengkap bila `File URL` ada.
- Tanggal efektif = `Tanggal Pelaksanaan` bila ada, selain itu `Timestamp`.
- Copy UI memakai istilah: "Pendukung"/"Pelaksanaan", "Lengkap"/"Draft", "masuk BA".
- Semua test dijalankan dari `new-code1-cf/` dengan `npx vitest run <file>`.

---

### Task 1: Hapus dead code computed BA

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html` (blok computed `filteredBaTab` s/d `baGroupPesertaTotal`, sekitar baris 2419-2493)
- Create: `new-code1-cf/test/detail-laporan-daftar-ba-template.test.js`

**Interfaces:**
- Consumes: (tidak ada)
- Produces: file test baru dengan helper `extractAppTemplate`, `installDocumentStub`, `loadHtml` yang dipakai task berikut.

- [ ] **Step 1: Tulis test yang gagal**

Create `new-code1-cf/test/detail-laporan-daftar-ba-template.test.js`:

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

describe('daftar BA: template', () => {
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

describe('daftar BA: pembersihan dead code', () => {
  it('menghapus computed BA yang tidak dipakai', async () => {
    const html = await loadHtml();
    expect(html).not.toContain('baGroupRows');
    expect(html).not.toContain('baGroupSections');
    expect(html).not.toContain('filteredBaTab');
    expect(html).not.toContain('baGroupGrandTotal');
    expect(html).not.toContain('baGroupBaTotal');
    expect(html).not.toContain('baGroupPesertaTotal');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-daftar-ba-template.test.js`
Expected: FAIL pada describe "pembersihan dead code" (karena `baGroupRows` dll masih ada). Test compile PASS.

- [ ] **Step 3: Hapus blok dead code**

Di `new-code1-cf/public/detail-laporan.html`, hapus seluruh blok computed berikut (dimulai dari `filteredBaTab() {` dan berakhir pada penutup `baGroupPesertaTotal() { ... },`):

- `filteredBaTab()`
- `baGroupRows()`
- `baGroupSections()`
- `baGroupGrandTotal()`
- `baGroupBaTotal()`
- `baGroupPesertaTotal()`

Biarkan computed tetangga (`baBlokOptions()` di atasnya dan `baKegiatanRows()` di bawahnya) tidak berubah. Pastikan tanda koma/pemisah antar computed tetap valid.

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run test/detail-laporan-daftar-ba-template.test.js test/detail-laporan-template.test.js`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-daftar-ba-template.test.js
git commit -m "refactor(laporan): hapus computed BA tak terpakai"
```

---

### Task 2: Lapisan data tab Daftar BA

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html` (`initialData` ~baris 1859; blok computed setelah `baKegiatanGrandTotal()`; methods setelah `baReportRows()`)
- Test: `new-code1-cf/test/detail-laporan-daftar-ba-template.test.js`

**Interfaces:**
- Consumes: helper test dari Task 1.
- Produces:
  - state `baListFilter` (objek filter).
  - computed `daftarBaRows`, `filteredDaftarBa`, `daftarBaBagianOptions`, `daftarBaBlokOptions`, `daftarBaJenisOptions`, `daftarBaSumberOptions`, `daftarBaLengkapCount`, `daftarBaDraftCount`, `daftarBaUnitCount`, `daftarBaUnitRows`.
  - method `baLengkap(b, jenis)`, `baTanggalEfektif(b)`, `baDaftarItem(b, jenis, unit)`.
  - Bentuk baris BA (dipakai Task 3/5): `{ id, jenis, bagian, blok, kegiatan, label, tanggal, jam, dosen, pesertaCount, sumber, dibuat, lengkap, fileUrl, catatan, tanggalEfektif }`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `test/detail-laporan-daftar-ba-template.test.js`:

```js
describe('daftar BA: lapisan data', () => {
  it('menyediakan state filter', async () => {
    const html = await loadHtml();
    expect(html).toContain("baListFilter: { bagian: '', blok: '', jenis: '', from: '', to: '', dosen: '', sumber: '', kelengkapan: '', q: '' }");
  });
  it('menyediakan computed dan helper', async () => {
    const html = await loadHtml();
    for (const name of ['daftarBaRows()', 'filteredDaftarBa()', 'daftarBaBagianOptions()',
      'daftarBaBlokOptions()', 'daftarBaJenisOptions()', 'daftarBaSumberOptions()',
      'daftarBaLengkapCount()', 'daftarBaDraftCount()', 'daftarBaUnitCount()', 'daftarBaUnitRows()',
      'baLengkap(', 'baTanggalEfektif(', 'baDaftarItem(']) {
      expect(html).toContain(name);
    }
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-daftar-ba-template.test.js`
Expected: FAIL pada describe "lapisan data".

- [ ] **Step 3: Tambah state filter**

Di `initialData()`, tepat setelah baris `baFilter: { bagian: '', blok: '', q: '' },` tambahkan:

```js
                    baListFilter: { bagian: '', blok: '', jenis: '', from: '', to: '', dosen: '', sumber: '', kelengkapan: '', q: '' },
```

- [ ] **Step 4: Tambah computed**

Di blok `computed`, tepat setelah penutup computed `baKegiatanGrandTotal() { ... },`, tambahkan:

```js
                daftarBaRows() {
                    const out = [];
                    (this.kegiatan || []).forEach((u) => {
                        (u.baPendukung || []).forEach((b) => out.push(this.baDaftarItem(b, 'Pendukung', u)));
                        (u.baPelaksanaan || []).forEach((b) => out.push(this.baDaftarItem(b, 'Pelaksanaan', u)));
                    });
                    return out;
                },
                filteredDaftarBa() {
                    const f = this.baListFilter;
                    const bagian = f.bagian;
                    const blok = String(f.blok || '').trim();
                    const fromD = f.from ? this.dateVal(f.from) : null;
                    const toD = f.to ? this.dateVal(f.to) : null;
                    if (toD) toD.setHours(23, 59, 59, 999);
                    const dosen = f.dosen ? this.normSearch(f.dosen) : '';
                    const q = this.normSearch(f.q);
                    return this.daftarBaRows.filter((r) => {
                        if (bagian && this.normBagian(r.bagian) !== this.normBagian(bagian)) return false;
                        if (blok && String(r.blok || '').trim() !== blok) return false;
                        if (f.jenis && r.jenis !== f.jenis) return false;
                        if (f.sumber && r.sumber !== f.sumber) return false;
                        if (f.kelengkapan === 'Lengkap' && !r.lengkap) return false;
                        if (f.kelengkapan === 'Draft' && r.lengkap) return false;
                        if (dosen && this.normSearch(r.dosen).indexOf(dosen) === -1) return false;
                        if (fromD || toD) {
                            const d = this.dateVal(r.tanggalEfektif);
                            if (!d || (fromD && d < fromD) || (toD && d > toD)) return false;
                        }
                        if (q) {
                            const hay = [r.id, r.kegiatan, r.bagian, r.blok, r.label, r.dosen]
                                .map((s) => this.normSearch(s)).join(' ');
                            if (hay.indexOf(q) === -1) return false;
                        }
                        return true;
                    });
                },
                daftarBaBagianOptions() {
                    const set = {};
                    this.daftarBaRows.forEach((r) => { if (r.bagian) set[r.bagian] = 1; });
                    return Object.keys(set).sort((a, b) => a.localeCompare(b));
                },
                daftarBaBlokOptions() {
                    const bagian = this.baListFilter.bagian;
                    const set = {};
                    this.daftarBaRows.forEach((r) => {
                        if (!r.blok) return;
                        if (bagian && this.normBagian(r.bagian) !== this.normBagian(bagian)) return;
                        set[r.blok] = 1;
                    });
                    return Object.keys(set).sort((a, b) => a.localeCompare(b));
                },
                daftarBaJenisOptions() {
                    return ['Pendukung', 'Pelaksanaan'];
                },
                daftarBaSumberOptions() {
                    const set = {};
                    this.daftarBaRows.forEach((r) => { if (r.sumber) set[r.sumber] = 1; });
                    return Object.keys(set).sort((a, b) => a.localeCompare(b));
                },
                daftarBaLengkapCount() {
                    return this.filteredDaftarBa.filter((r) => r.lengkap).length;
                },
                daftarBaDraftCount() {
                    return this.filteredDaftarBa.filter((r) => !r.lengkap).length;
                },
                daftarBaUnitCount() {
                    const set = {};
                    this.filteredDaftarBa.forEach((r) => {
                        set[this.normBagian(r.bagian) + '::' + (r.blok || '') + '::' + r.kegiatan] = 1;
                    });
                    return Object.keys(set).length;
                },
                daftarBaUnitRows() {
                    const bagian = this.baListFilter.bagian;
                    const blok = String(this.baListFilter.blok || '').trim();
                    return (this.kegiatan || []).filter((u) => {
                        if (bagian && this.normBagian(u.bagian) !== this.normBagian(bagian)) return false;
                        if (blok && String(u.blok || '').trim() !== blok) return false;
                        return true;
                    });
                },
```

- [ ] **Step 5: Tambah method helper**

Di blok `methods`, tepat setelah penutup method `baReportRows(filter, q) { ... },`, tambahkan:

```js
                baLengkap(b, jenis) {
                    if (!b) return false;
                    if (jenis === 'Pendukung') return !!String(b['File URL'] || '').trim();
                    const dosen = String(b.Dosen || '').trim();
                    const tanggal = String(b['Tanggal Pelaksanaan'] || '').trim();
                    const jam = String(b.Jam || '').trim();
                    return !!(dosen && tanggal && jam);
                },
                baTanggalEfektif(b) {
                    if (!b) return '';
                    return b['Tanggal Pelaksanaan'] || b.Timestamp || '';
                },
                baDaftarItem(b, jenis, unit) {
                    const peserta = (b && b.peserta) || [];
                    const tanggal = (b && b['Tanggal Pelaksanaan']) || '';
                    const jumlahField = Number((b && b['Jumlah Peserta']) || 0) || 0;
                    return {
                        id: (b && b['BA ID']) || '',
                        jenis: jenis,
                        bagian: unit ? unit.bagian : this.resolveBagianLabel(b.Bagian, '', b['Nama Kegiatan']),
                        blok: (unit ? unit.blok : b.Blok) || '',
                        kegiatan: (unit ? unit.label : b['Nama Kegiatan']) || '',
                        label: (b && b.Label) || '',
                        tanggal: tanggal,
                        jam: (b && b.Jam) || '',
                        dosen: (b && b.Dosen) || '',
                        pesertaCount: jenis === 'Pelaksanaan' ? peserta.length : (jumlahField || peserta.length),
                        sumber: (b && b.Sumber) || (jenis === 'Pendukung' ? 'Admin' : 'Bagian'),
                        dibuat: (b && b.Timestamp) || '',
                        lengkap: this.baLengkap(b, jenis),
                        fileUrl: (b && b['File URL']) || '',
                        catatan: (b && b.Catatan) || '',
                        tanggalEfektif: this.baTanggalEfektif(b)
                    };
                },
```

- [ ] **Step 6: Jalankan test untuk memastikan lulus**

Run: `npx vitest run test/detail-laporan-daftar-ba-template.test.js`
Expected: PASS semua.

- [ ] **Step 7: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-daftar-ba-template.test.js
git commit -m "feat(laporan): lapisan data tab daftar BA"
```

---

### Task 3: Tab baru + section UI Daftar BA

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html` (array `tabs` ~baris 1843; sisip section setelah penutup tab BA `</section>` ~baris 1337)
- Test: `new-code1-cf/test/detail-laporan-daftar-ba-template.test.js`

**Interfaces:**
- Consumes: computed & state dari Task 2.
- Produces: tab `daftarba` dan section UI (ringkasan, filter, tabel desktop, kartu mobile).

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `test/detail-laporan-daftar-ba-template.test.js`:

```js
describe('daftar BA: tab & UI', () => {
  it('mendaftarkan tab dan section', async () => {
    const html = await loadHtml();
    expect(html).toContain("key: 'daftarba', label: 'Daftar BA'");
    expect(html).toContain("activeTab === 'daftarba'");
  });
  it('memuat kolom dan filter wajib', async () => {
    const html = await loadHtml();
    for (const s of ['>BA ID</th>', '>Jenis</th>', '>Label</th>', '>Dibuat</th>',
      '>Kelengkapan</th>', '>Berkas</th>', '>Sumber</th>', '>Peserta</th>']) {
      expect(html).toContain(s);
    }
    for (const s of ['baListFilter.bagian', 'baListFilter.blok', 'baListFilter.jenis',
      'baListFilter.from', 'baListFilter.to', 'baListFilter.dosen', 'baListFilter.sumber',
      'baListFilter.kelengkapan', 'baListFilter.q']) {
      expect(html).toContain(s);
    }
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-daftar-ba-template.test.js`
Expected: FAIL pada describe "tab & UI".

- [ ] **Step 3: Daftarkan tab**

Di `initialData()`, pada array `tabs`, tepat setelah baris:

```js
                        { key: 'ba', label: 'Berita Acara', icon: 'bi-file-earmark-text' },
```

tambahkan:

```js
                        { key: 'daftarba', label: 'Daftar BA', icon: 'bi-list-check' },
```

- [ ] **Step 4: Sisip section UI**

Di `public/detail-laporan.html`, sisipkan section berikut **setelah** penutup `</section>` tab Berita Acara (tab dengan `v-if="activeTab === 'ba'"`) dan **sebelum** komentar `<!-- ===================== TAB 5: DATA PEMBAYARAN ===================== -->`:

```html
                    <!-- ===================== TAB: DAFTAR BA ===================== -->
                    <section v-if="activeTab === 'daftarba'" class="space-y-4">
                        <div class="in-basum">
                            <div class="b"><div class="k">BA Terfilter</div><div class="n">{{ filteredDaftarBa.length }}</div><div class="p">pendukung + pelaksanaan</div></div>
                            <div class="b"><div class="k">Lengkap</div><div class="n emerald">{{ daftarBaLengkapCount }}</div><div class="p">siap</div></div>
                            <div class="b"><div class="k">Draft</div><div class="n">{{ daftarBaDraftCount }}</div><div class="p">belum lengkap</div></div>
                            <div class="b"><div class="k">Unit Kegiatan</div><div class="n">{{ daftarBaUnitCount }}</div><div class="p">terkait</div></div>
                        </div>
                        <div class="lap-card p-4">
                            <div class="grid gap-3 md:grid-cols-12">
                                <div class="md:col-span-3"><label class="label">Bagian</label><select v-model="baListFilter.bagian" class="input"><option value="">Semua Bagian</option><option v-for="o in daftarBaBagianOptions" :key="o" :value="o">{{ o }}</option></select></div>
                                <div class="md:col-span-3"><label class="label">Blok</label><select v-model="baListFilter.blok" class="input"><option value="">Semua Blok</option><option v-for="o in daftarBaBlokOptions" :key="o" :value="o">{{ o }}</option></select></div>
                                <div class="md:col-span-3"><label class="label">Jenis BA</label><select v-model="baListFilter.jenis" class="input"><option value="">Semua Jenis</option><option v-for="o in daftarBaJenisOptions" :key="o" :value="o">{{ o }}</option></select></div>
                                <div class="md:col-span-3"><label class="label">Sumber</label><select v-model="baListFilter.sumber" class="input"><option value="">Semua Sumber</option><option v-for="o in daftarBaSumberOptions" :key="o" :value="o">{{ o }}</option></select></div>
                                <div class="md:col-span-3"><label class="label">Dari Tanggal</label><input v-model="baListFilter.from" type="date" class="input"></div>
                                <div class="md:col-span-3"><label class="label">Sampai Tanggal</label><input v-model="baListFilter.to" type="date" class="input"></div>
                                <div class="md:col-span-3"><label class="label">Dosen</label><select v-model="baListFilter.dosen" class="input"><option value="">Semua Dosen</option><option v-for="o in dosenOptions" :key="o" :value="o">{{ o }}</option></select></div>
                                <div class="md:col-span-3"><label class="label">Kelengkapan</label><select v-model="baListFilter.kelengkapan" class="input"><option value="">Semua</option><option value="Lengkap">Lengkap</option><option value="Draft">Draft</option></select></div>
                                <div class="md:col-span-6"><label class="label">Cari</label><input v-model="baListFilter.q" class="input" placeholder="BA ID, kegiatan, NPM, atau nama..."></div>
                            </div>
                            <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                                <span class="lap-chip">{{ filteredDaftarBa.length }} BA</span>
                                <span class="lap-chip">{{ daftarBaLengkapCount }} lengkap</span>
                                <span class="lap-chip">{{ daftarBaDraftCount }} draft</span>
                            </div>
                        </div>
                        <div class="overflow-hidden lap-card">
                            <div class="lap-card-head">
                                <div>
                                    <div class="lap-card-title">Daftar Berita Acara</div>
                                    <div class="lap-card-sub">Semua BA Pendukung &amp; Pelaksanaan lintas kegiatan</div>
                                </div>
                            </div>
                            <div class="overflow-x-auto in-desktop-only">
                                <table class="in-tbl">
                                    <thead>
                                        <tr class="lap-th text-[11px] uppercase tracking-wide text-slate-500">
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">BA ID</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Jenis</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Bagian</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Blok</th>
                                            <th class="px-3 py-2.5 text-left">Kegiatan</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Label</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Tanggal</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Jam</th>
                                            <th class="px-3 py-2.5 text-left">Dosen</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-center">Peserta</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Sumber</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Dibuat</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Kelengkapan</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-left">Berkas</th>
                                            <th class="whitespace-nowrap px-3 py-2.5 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="r in filteredDaftarBa" :key="r.jenis + '-' + r.id" class="border-t border-slate-50">
                                            <td class="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-slate-700">{{ r.id }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5"><span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="r.jenis === 'Pendukung' ? 'bg-indigo-50 text-indigo-700' : 'bg-brand-50 text-brand-700'">{{ r.jenis }}</span></td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-slate-700">{{ r.bagian }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-slate-600">{{ r.blok || '-' }}</td>
                                            <td class="px-3 py-2.5 text-slate-800">{{ r.kegiatan || '-' }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-slate-600">{{ r.label || '-' }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-slate-600">{{ r.tanggal ? fmtTanggal(r.tanggal) : '-' }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-slate-600">{{ r.jam || '-' }}</td>
                                            <td class="px-3 py-2.5 text-slate-600">{{ r.dosen || '-' }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-center font-semibold text-slate-700">{{ r.pesertaCount }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5"><span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="r.sumber === 'Admin' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'">{{ r.sumber }}</span></td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-slate-500">{{ r.dibuat ? fmtTanggalWaktu(r.dibuat) : '-' }}</td>
                                            <td class="whitespace-nowrap px-3 py-2.5"><span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="r.lengkap ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">{{ r.lengkap ? 'Lengkap' : 'Draft' }}</span></td>
                                            <td class="whitespace-nowrap px-3 py-2.5"><a v-if="r.fileUrl" :href="safeUrl(r.fileUrl)" target="_blank" rel="noopener noreferrer" class="link">Lihat</a><span v-else class="text-slate-300">-</span></td>
                                            <td class="whitespace-nowrap px-3 py-2.5 text-right">
                                                <div class="flex justify-end gap-1">
                                                    <button class="mini-ic p" title="Kelola BA" @click.stop="openKelolaBa(r.id, r.sumber)"><i class="bi bi-pencil text-[10px]"></i></button>
                                                    <button class="mini-ic x" title="Hapus BA" @click.stop="r.sumber === 'Admin' ? deleteBaAdmin(r.id) : deleteBaBagian(r.id)"><i class="bi bi-x text-[10px]"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div v-if="!filteredDaftarBa.length" class="px-4 py-14 text-center">
                                    <i class="bi bi-table text-3xl text-slate-300"></i>
                                    <p class="mt-3 text-sm text-slate-400">Tidak ada BA sesuai filter.</p>
                                </div>
                            </div>
                            <div class="in-cards">
                                <article v-for="r in filteredDaftarBa" :key="'m-' + r.jenis + '-' + r.id" class="in-mcard">
                                    <div class="row1"><span class="font-semibold text-slate-800">{{ r.id }}</span><span class="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{{ r.jenis }}</span></div>
                                    <div class="kv"><span>Bagian</span><b>{{ r.bagian }}</b><span>Blok</span><b>{{ r.blok || '-' }}</b><span>Kegiatan</span><b>{{ r.kegiatan || '-' }}</b><span>Label</span><b>{{ r.label || '-' }}</b><span>Jadwal</span><b>{{ r.tanggal ? fmtTanggal(r.tanggal) : '-' }} {{ r.jam }}</b><span>Dosen</span><b>{{ r.dosen || '-' }}</b><span>Peserta</span><b>{{ r.pesertaCount }}</b><span>Sumber</span><b>{{ r.sumber }}</b><span>Kelengkapan</span><b>{{ r.lengkap ? 'Lengkap' : 'Draft' }}</b></div>
                                    <div class="actions">
                                        <a v-if="r.fileUrl" :href="safeUrl(r.fileUrl)" target="_blank" rel="noopener noreferrer" class="btn-soft"><i class="bi bi-file-earmark-pdf"></i> Berkas</a>
                                        <button class="btn-soft" @click.stop="openKelolaBa(r.id, r.sumber)"><i class="bi bi-pencil"></i> Kelola</button>
                                        <button class="btn-soft" @click.stop="r.sumber === 'Admin' ? deleteBaAdmin(r.id) : deleteBaBagian(r.id)"><i class="bi bi-trash"></i> Hapus</button>
                                    </div>
                                </article>
                            </div>
                        </div>
                    </section>
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npx vitest run test/detail-laporan-daftar-ba-template.test.js test/detail-laporan-template.test.js`
Expected: PASS semua.

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-daftar-ba-template.test.js
git commit -m "feat(laporan): tab Daftar BA dengan filter dan tabel lengkap"
```

---

### Task 4: Indikator kelengkapan & "Masuk BA" di tab Berita Acara (B)

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html` (sel Progres ~baris 1211-1215; kv kartu mobile ~baris 1309; item BA expand ~baris 1265-1285)
- Test: `new-code1-cf/test/detail-laporan-daftar-ba-template.test.js`

**Interfaces:**
- Consumes: `baLengkap()` dari Task 2.
- Produces: kolom Progres menampilkan "N/M masuk BA"; badge Lengkap/Draft pada item BA.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan:

```js
describe('daftar BA: indikator kelengkapan', () => {
  it('menampilkan rasio masuk BA', async () => {
    const html = await loadHtml();
    expect(html).toContain('masuk BA');
    expect(html).toContain('r.counts.final');
  });
  it('menampilkan badge Lengkap/Draft per BA', async () => {
    const html = await loadHtml();
    expect(html).toContain("baLengkap(b, 'Pendukung')");
    expect(html).toContain("baLengkap(b, 'Pelaksanaan')");
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-daftar-ba-template.test.js`
Expected: FAIL pada describe "indikator kelengkapan".

- [ ] **Step 3: Tambah rasio Masuk BA pada sel Progres**

Di tab Berita Acara, pada sel `<td class="px-3 py-2.5">` yang memuat `<div class="in-progdots" ...>`, tambahkan baris berikut **tepat setelah** penutup `</div>` dari `in-progdots`:

```html
                                                    <div class="mt-0.5 text-[10px] font-semibold text-slate-400">{{ (r.counts && r.counts.final) || 0 }}/{{ (r.peserta || []).length }} masuk BA</div>
```

- [ ] **Step 4: Tambah Masuk BA pada kartu mobile**

Pada kartu mobile tab Berita Acara, ubah baris `div.kv` menjadi (menambahkan pasangan Masuk BA sebelum Biaya):

```html
                                    <div class="kv"><span>Blok</span><b>{{ r.blok || '-' }}</b><span>Peserta</span><b>{{ (r.peserta || []).length }} mahasiswa</b><span>Masuk BA</span><b>{{ (r.counts && r.counts.final) || 0 }}/{{ (r.peserta || []).length }}</b><span>Biaya</span><b class="text-brand-700">{{ fmtRupiah(baKegiatanBiaya(r)) }}</b></div>
```

- [ ] **Step 5: Tambah badge Lengkap/Draft pada item BA Pendukung**

Pada baris expand BA Pendukung, tepat setelah span badge "Pendukung", tambahkan:

```html
                                                                    <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="baLengkap(b, 'Pendukung') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">{{ baLengkap(b, 'Pendukung') ? 'Lengkap' : 'Draft' }}</span>
```

- [ ] **Step 6: Tambah badge Lengkap/Draft pada item BA Pelaksanaan**

Pada baris expand BA Pelaksanaan, tepat setelah span badge "Pelaksanaan", tambahkan:

```html
                                                                    <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="baLengkap(b, 'Pelaksanaan') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">{{ baLengkap(b, 'Pelaksanaan') ? 'Lengkap' : 'Draft' }}</span>
```

- [ ] **Step 7: Jalankan test untuk memastikan lulus**

Run: `npx vitest run test/detail-laporan-daftar-ba-template.test.js test/detail-laporan-template.test.js`
Expected: PASS semua.

- [ ] **Step 8: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-daftar-ba-template.test.js
git commit -m "feat(laporan): indikator kelengkapan dan masuk BA"
```

---

### Task 5: Export XLSX dua sheet (C)

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html` (method setelah `exportBaTable()`; tombol di kepala tab Daftar BA)
- Test: `new-code1-cf/test/detail-laporan-daftar-ba-template.test.js`

**Interfaces:**
- Consumes: `filteredDaftarBa`, `daftarBaUnitRows`, `baKegiatanBiaya`, `setUrlHyperlinks`, `writeXlsxStyled`, `_loadXlsx` (semua sudah ada).
- Produces: method `exportDaftarBa()` menghasilkan workbook 2 sheet: "Daftar BA" dan "Rekap per Unit".

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan:

```js
describe('daftar BA: export xlsx', () => {
  it('menyediakan handler dan dua sheet', async () => {
    const html = await loadHtml();
    expect(html).toContain('exportDaftarBa()');
    expect(html).toContain("'Daftar BA'");
    expect(html).toContain("'Rekap per Unit'");
    expect(html).toContain('Export XLSX');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/detail-laporan-daftar-ba-template.test.js`
Expected: FAIL pada describe "export xlsx".

- [ ] **Step 3: Tambah method export**

Di blok `methods`, tepat setelah penutup method `exportBaTable() { ... },` (method terakhir sebelum penutup `methods`), tambahkan:

```js
                exportDaftarBa() {
                    this.exporting = true;
                    this._loadXlsx().then(() => {
                        try {
                            const wb = XLSX.utils.book_new();
                            const headers = ['BA ID', 'Jenis BA', 'Bagian', 'Blok', 'Nama Kegiatan', 'Label',
                                'Tanggal Pelaksanaan', 'Jam', 'Dosen', 'Jumlah Peserta', 'Sumber', 'Dibuat',
                                'Kelengkapan', 'Catatan', 'File URL'];
                            const rows = this.filteredDaftarBa.map((r) => ({
                                'BA ID': r.id,
                                'Jenis BA': r.jenis,
                                'Bagian': r.bagian,
                                'Blok': r.blok,
                                'Nama Kegiatan': r.kegiatan,
                                'Label': r.label,
                                'Tanggal Pelaksanaan': r.tanggal ? fmtTanggalWaktu(r.tanggal) : '',
                                'Jam': r.jam,
                                'Dosen': r.dosen,
                                'Jumlah Peserta': r.pesertaCount,
                                'Sumber': r.sumber,
                                'Dibuat': r.dibuat ? fmtTanggalWaktu(r.dibuat) : '',
                                'Kelengkapan': r.lengkap ? 'Lengkap' : 'Draft',
                                'Catatan': r.catatan,
                                'File URL': r.fileUrl
                            }));
                            const wsBa = rows.length
                                ? XLSX.utils.json_to_sheet(rows, { header: headers })
                                : XLSX.utils.aoa_to_sheet([headers]);
                            setUrlHyperlinks(wsBa, 'File URL', 'Buka file berita acara');
                            XLSX.utils.book_append_sheet(wb, wsBa, 'Daftar BA');

                            const rekapRows = this.daftarBaUnitRows.map((u) => ({
                                'Bagian': u.bagian,
                                'Blok': u.blok || '',
                                'Nama Kegiatan': u.label,
                                'Masuk BA': ((u.counts && u.counts.final) || 0) + '/' + (u.peserta || []).length,
                                'Jumlah Peserta': (u.peserta || []).length,
                                'BA Pendukung': (u.baPendukung || []).length,
                                'BA Pelaksanaan': (u.baPelaksanaan || []).length,
                                'Biaya': this.baKegiatanBiaya(u)
                            }));
                            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rekapRows), 'Rekap per Unit');

                            writeXlsxStyled(wb, 'Daftar-BA-' + new Date().toISOString().slice(0, 10) + '.xlsx');
                            this.showToast('bi-check-circle', 'Export daftar BA berhasil diunduh.');
                        } catch (e) {
                            this.showToast('bi-x-circle', 'Export gagal: ' + ((e && e.message) ? e.message : e));
                        } finally {
                            this.exporting = false;
                        }
                    }).catch((e) => {
                        this.exporting = false;
                        this.showToast('bi-x-circle', 'Export gagal: ' + ((e && e.message) ? e.message : e));
                    });
                },
```

- [ ] **Step 4: Tambah tombol Export di kepala tab Daftar BA**

Pada `lap-card-head` di section Daftar BA (Task 3), tambahkan tombol **setelah** `<div>...</div>` judul, di dalam `lap-card-head`:

```html
                                <button class="btn-soft !py-1.5 text-xs" :disabled="exporting" @click="exportDaftarBa"><i class="bi bi-file-earmark-excel"></i> Export XLSX</button>
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npx vitest run test/detail-laporan-daftar-ba-template.test.js test/detail-laporan-template.test.js`
Expected: PASS semua.

- [ ] **Step 6: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-daftar-ba-template.test.js
git commit -m "feat(laporan): export xlsx daftar BA dan rekap per unit"
```

---

### Task 6: Verifikasi penuh

**Files:**
- (tidak ada perubahan kode)

**Interfaces:**
- Consumes: seluruh task sebelumnya.
- Produces: konfirmasi suite lulus.

- [ ] **Step 1: Jalankan suite penuh**

Run: `npm test`
Expected: seluruh test file PASS (0 gagal).

- [ ] **Step 2: Cek sisa istilah/regresi**

Run: `node -e "const fs=require('fs');const h=fs.readFileSync('public/detail-laporan.html','utf8');for(const s of ['baGroupRows','filteredBaTab','>Diterima<'])if(h.includes(s))throw new Error('regresi: '+s);console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit (bila ada penyesuaian test)**

```bash
git add -A
git commit -m "test(laporan): verifikasi tab daftar BA" || echo "nothing to commit"
```

---

## Catatan lanjutan (belum dikerjakan)

- **E**: ringkasan semua sesi pelaksanaan per unit (bukan hanya sesi pertama).
- **F**: panel "Jadwal vs Realisasi" (mengalirkan `jadwal_pelaksanaan` ke `laporan.js`).
- **G**: penanda berkas (ada/hilang) + menampilkan `Base File URL` untuk BA Pendukung.
