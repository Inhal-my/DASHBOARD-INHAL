# Dashboard Mobile v2 — Bottom-sheet "Buat BA" & Kartu Kelengkapan per Blok — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merombak tab **Berita Acara** di `new-code1-cf/public/dashboard.html` dengan **Konsep 01** (satu tombol "Buat BA" membuka bottom-sheet pencarian berjenjang Blok → Kegiatan → form, menangani BA Pendukung & Pelaksanaan) dan **Konsep 06** (mengganti tabel "Peta Kelengkapan" dengan kartu per Blok + menghapus panel "Kelengkapan per Bagian").

**Architecture:** Sepenuhnya frontend, satu komponen Vue global (pola `createApp` yang sudah ada). Tidak menyentuh backend/RPC/skema. Sumber data memakai `bagian.units` yang sudah dimuat oleh `loadBagian()`. Modal "Kelola BA Pendukung" (`kb`) dan alur sesi bagian (`babStart`, `adminBagianBypass`) dipertahankan.

**Tech Stack:** Vue 3 (global build), Tailwind inline + CSS kustom di `<style>`, Cloudflare Workers assets, Vitest + `@vue/compiler-dom` (test guard template).

## Global Constraints

- Tanpa perubahan backend, RPC, skema, atau migrasi. Tidak ada endpoint baru.
- Hanya ubah `new-code1-cf/public/dashboard.html` dan file test di `new-code1-cf/test/`.
- Pertahankan seluruh fitur: unggah Pendukung, unggah Pelaksanaan, Kelola/Hapus BA, Riwayat, Ekspor Excel, kartu ringkasan atas (`ba-cards`), filter chip, tabel unit desktop & kartu unit mobile, panel `#bab-panel`.
- Copy UI: "Pendukung", "Pelaksanaan", "Buat BA", "Blok", "Lengkap", "Belum".
- Semua test dijalankan dari `new-code1-cf/` dengan `npx vitest run <file>`; target akhir `npx vitest run` semua hijau.
- Commit per task. **Jangan tulis trailer `Co-authored-by` manual** — hook `prepare-commit-msg` menambahkannya.

---

### Task 1: Konsep 06 — Kartu Kelengkapan per Blok

Mengganti panel "Kelengkapan Pelaksanaan per Bagian" + tabel "Peta Kelengkapan Bagian × Blok" dengan satu kartu berisi **toggle metrik + grid kartu per Blok**.

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Test: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Consumes: `bagian.units` (`{ blok, bagian, ... }`), `unitHasPelaksanaan(u)`, `unitIncomplete(u)`.
- Produces: state `bagian.heatMetric`; computed `bagianBlokCards` (`[{ blok, total, done, pct, belum }]`); method `setHeatMetric(m)`, `openBlokCard(blok)`; anchor `id="ba-unit-list"`.

- [ ] **Step 1: Perbarui test guard yang menyentuh markup lama**

Edit `new-code1-cf/test/dashboard-template.test.js`.

Ubah baris 79 agar tidak lagi mengharapkan "Peta Kelengkapan Bagian × Blok" dan menambahkan penanda baru:

```js
    expect(html).toContain('Kelengkapan per Blok');
    expect(html).not.toContain('Peta Kelengkapan Bagian × Blok');
```

Biarkan baris 80 (`expect(html).toContain('Unggah BA Pendukung')`) apa adanya untuk task ini — tombol header baru diubah di Task 2.

Ubah baris 220 (hapus `.in-heat .c.g {` dari daftar CSS yang harus ada):

```js
    for (const s of ['--line:#e7ebf3', '.in-chip {', '.in-badge.wait {', '.in-tbl thead th {', '.in-tbl thead th.text-right {', '.in-toolbar {', '.in-input {', '.in-progdots i.all {', '.in-bar-fill.g {', '.in-tabsw {', '.in-statrow {']) {
```

Ubah baris 235 (tabel heat lama digantikan penanda kartu):

```js
    expect(html).toContain('bagianBlokCards');
    expect(html).not.toContain('heat-table in-heat');
```

Ubah baris 249 (hapus `.in-heat-legend {` dari daftar CSS):

```js
    for (const s of ['.in-pageintro {', '.in-avatar {', '.in-celluser {', '.in-docdot {',
      '.in-docdot.on.bukti {', '.in-cards {', '.in-mcard {', '.in-proc {', '.in-basum {',
      '.in-manual-note {']) {
```

Ubah blok baris 283-291 (hapus legenda heat & teks geser):

```js
  it('BA memakai banner proses, ringkasan basum, kartu blok', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('class="in-proc"');
    expect(html).toContain('ba-cards in-basum');
    expect(html).toContain('bagianBlokCards');
    expect(html).toContain('Kelengkapan per Blok');
    expect(html).toContain('BA Pendukung');
    expect(html).toContain('BA Pelaksanaan');
  });
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/dashboard-template.test.js`
Expected: FAIL (HTML masih memuat "Peta Kelengkapan Bagian × Blok", belum ada `bagianBlokCards`).

- [ ] **Step 3: Tambah state `bagian.heatMetric`**

Di `public/dashboard.html` baris 2452, ubah objek `bagian`:

```js
                    bagian: { units: [], orphanBa: [], fBagian: '', fBlok: '', chip: 'semua', q: '', sortKey: 'tanggal', sortDir: 'desc', expanded: {}, options: [], labs: [], bloks: [], heatMetric: 'pelaksanaan' },
```

- [ ] **Step 4: Ganti markup panel bagian + peta heatmap (baris 1169-1216)**

Ganti seluruh blok `<div class="ba-pair mb-4"> ... </div>` (baris 1169 sampai 1216) dengan kartu baru:

```html
                        <div class="mb-4 overflow-hidden dash-card">
                            <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
                                <h2 class="text-sm font-bold text-slate-900">Kelengkapan per Blok</h2>
                                <div class="ml-auto inline-flex rounded-full bg-slate-100 p-0.5 text-[11px] font-semibold">
                                    <button class="rounded-full px-3 py-1" :class="bagian.heatMetric==='pelaksanaan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'" @click="setHeatMetric('pelaksanaan')">Pelaksanaan</button>
                                    <button class="rounded-full px-3 py-1" :class="bagian.heatMetric==='gabungan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'" @click="setHeatMetric('gabungan')">Pendukung + Pelaksanaan</button>
                                </div>
                            </div>
                            <div v-if="!bagianBlokCards.length" class="px-4 py-8 text-center text-sm text-slate-400">Belum ada data.</div>
                            <div v-else class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
                                <button v-for="c in bagianBlokCards" :key="c.blok" class="rounded-2xl border p-3 text-left transition hover:shadow-sm" :class="c.pct === 100 ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/30'" @click="openBlokCard(c.blok)">
                                    <div class="flex items-start justify-between gap-2">
                                        <div class="min-w-0">
                                            <div class="truncate text-sm font-bold text-slate-900">Blok {{ c.blok }}</div>
                                            <div class="text-[11px] text-slate-400">{{ c.total }} kegiatan</div>
                                        </div>
                                        <div class="ba-ring shrink-0" :style="{ background: 'conic-gradient(' + (c.pct === 100 ? '#10b981' : '#f59e0b') + ' ' + (c.pct * 3.6) + 'deg, #e2e8f0 0deg)' }">
                                            <span>{{ c.pct }}%</span>
                                        </div>
                                    </div>
                                    <div class="mt-2">
                                        <span v-if="c.pct === 100" class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Lengkap</span>
                                        <span v-else class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{{ c.belum }} belum</span>
                                    </div>
                                </button>
                            </div>
                        </div>
```

- [ ] **Step 5: Beri jangkar `id="ba-unit-list"` pada kartu daftar unit**

Di baris 1228, ubah:

```html
                        <div id="ba-unit-list" class="overflow-hidden dash-card">
```

- [ ] **Step 6: Tambah CSS `.ba-ring`, hapus CSS heat/ba-pair**

Di blok `<style>`:
- Hapus baris 240 `.ba-pair { ... }` dan baris 248 `.ba-pair { grid-template-columns: 1fr; }`.
- Hapus baris 241 `.heat-scroll { ... }`, 242-243 `.heat-table`, 244 `.heat-sticky`, 245 `.heat-cell`.
- Hapus baris 398-405 `.in-heat ...` (semua baris `.in-heat`).
- Hapus baris 459-460 `.in-heat-legend ...`.
- **Pertahankan** `.in-bar-track`, `.in-bar-fill`, `.in-bar-fill.g/.y/.r` (baris 393-397) — masih dipakai `statCharts` dan diassert test.
- Tambahkan setelah baris 396 `.in-bar-fill.r { ... }`:

```css
        .ba-ring { width:44px; height:44px; border-radius:9999px; display:flex; align-items:center; justify-content:center; }
        .ba-ring > span { width:34px; height:34px; border-radius:9999px; background:#fff; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; color:#334155; }
```

- [ ] **Step 7: Hapus computed `bagianBar` & `bagianHeatmap`**

Hapus computed `bagianBar` (baris 2696-2705) dan `bagianHeatmap` (baris 2706-2721) di `public/dashboard.html`.

- [ ] **Step 8: Tambah computed `bagianBlokCards`**

Sisipkan tepat setelah computed `bagianSummary` (setelah baris 2661, sebelum `bagianFilteredUnits`):

```js
                bagianBlokCards() {
                    const map = {};
                    const metric = this.bagian.heatMetric || 'pelaksanaan';
                    (this.bagian.units || []).forEach(u => {
                        const b = String(u.blok || '').trim();
                        if (!b) return;
                        if (!map[b]) map[b] = { blok: b, total: 0, done: 0 };
                        map[b].total += 1;
                        const ok = metric === 'gabungan' ? !this.unitIncomplete(u) : this.unitHasPelaksanaan(u);
                        if (ok) map[b].done += 1;
                    });
                    return Object.values(map)
                        .map(c => Object.assign(c, { pct: c.total ? Math.round((c.done / c.total) * 100) : 0, belum: c.total - c.done }))
                        .sort((a, b) => a.blok.localeCompare(b.blok));
                },
```

- [ ] **Step 9: Hapus method lama, tambah `setHeatMetric` & `openBlokCard`**

Hapus method `heatFillClass` (baris 4167-4172), `heatCellClass` (4173-4177), `openBagianFromBar` (4195-4198), `openBagianFromCell` (4199-4202).

Sisipkan tepat setelah `setBagianChip(chip)` (baris 4178-4180):

```js
                setHeatMetric(m) {
                    this.bagian.heatMetric = m === 'gabungan' ? 'gabungan' : 'pelaksanaan';
                },
                openBlokCard(blok) {
                    this.bagian.fBlok = blok;
                    this.bagian.fBagian = '';
                    this.bagian.chip = 'semua';
                    this.$nextTick(() => {
                        const el = document.getElementById('ba-unit-list');
                        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                },
```

- [ ] **Step 10: Jalankan test**

Run: `npx vitest run test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
cd /workspace/new-code1-cf
git add public/dashboard.html test/dashboard-template.test.js
git commit -m "feat(dashboard): kartu kelengkapan per blok gantikan peta heatmap"
```

---

### Task 2: Konsep 01 — Bottom-sheet "Buat BA" (shell + alur Pendukung)

Menambahkan sheet, state, computed, helper pencarian, dan mengarahkan tombol header "Buat BA", FAB, serta tab Pendukung ke modal `kb` yang sudah ada. Pada task ini jalur **Pelaksanaan** masih fallback ke panel lama (diganti di Task 3).

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Test: `new-code1-cf/test/dashboard-template.test.js`, `new-code1-cf/test/dashboard-ba-sheet.test.js` (baru)

**Interfaces:**
- Consumes: `bagian.units`, `openKelolaBaPendukung(pid)`, `openPelaksanaanPanel(u)`, `normBagian(v)`, `loadBagian()`, `sectionLoading.bagian`.
- Produces: state `baSheet { open, type, level, blok, q, loading }`; computed `baSheetBlokGroups`, `baSheetBlokUnits`, `baSheetSearchResults`; method `openBaSheet(type)`, `baSheetClose()`, `baSheetSetType(t)`, `baSheetOpenKegiatan(blok)`, `baSheetBack()`, `baSheetPickKegiatan(u)`, `unitMatchesQuery(u, q)`; markup `.ba-sheet-wrap`.

- [ ] **Step 1: Tulis test baru yang gagal**

Create `new-code1-cf/test/dashboard-ba-sheet.test.js`:

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
    if (m[0] === '</div>') {
      depth -= 1;
      if (depth === 0) { end = re.lastIndex; break; }
    } else {
      depth += 1;
    }
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

async function loadDashboardHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/dashboard.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('dashboard BA sheet template', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadDashboardHtml();
    compile(extractAppTemplate(html), {
      onError: (e) => { throw new Error(e.message); },
      onWarn: (w) => { throw new Error('warn: ' + w.message); }
    });
  });

  it('menyediakan state baSheet dengan default pelaksanaan', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('baSheet: {');
    expect(html).toContain("type: 'pelaksanaan'");
    expect(html).toContain("level: 'blok'");
  });

  it('menyediakan tab tergeser dan aksi tingkat sheet', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('Buat Berita Acara');
    expect(html).toContain("baSheetSetType('pendukung')");
    expect(html).toContain("baSheetSetType('pelaksanaan')");
    expect(html).toContain('baSheetOpenKegiatan(g.blok)');
    expect(html).toContain('baSheetBack()');
    expect(html).toContain('baSheetClose()');
  });

  it('menyediakan computed dan helper pencarian lintas blok', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('baSheetBlokGroups()');
    expect(html).toContain('baSheetBlokUnits()');
    expect(html).toContain('baSheetSearchResults()');
    expect(html).toContain('unitMatchesQuery(u, q)');
    expect(html).toContain('baSheetPickKegiatan(u)');
  });

  it('mengarahkan header dan FAB ke pembuka sheet', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('@click="openKelolaBaPicker()"');
    expect(html).toContain('openBaSheet()');
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/dashboard-ba-sheet.test.js`
Expected: FAIL (`baSheet: {` belum ada).

- [ ] **Step 3: Tambah state `baSheet`**

Di `public/dashboard.html`, sisipkan tepat sebelum baris `detailMap: {},` (baris 2446):

```js
                    baSheet: { open: false, type: 'pelaksanaan', level: 'blok', blok: '', q: '', loading: false },
```

- [ ] **Step 4: Tambah computed sheet**

Sisipkan tepat setelah computed `bagianBlokCards` (hasil Task 1 Step 8):

```js
                baSheetBlokGroups() {
                    const map = {};
                    (this.bagian.units || []).forEach(u => {
                        const b = String(u.blok || '').trim();
                        if (!b) return;
                        if (!map[b]) map[b] = { blok: b, total: 0, belum: 0 };
                        map[b].total += 1;
                        if (!this.unitHasPelaksanaan(u)) map[b].belum += 1;
                    });
                    return Object.values(map).sort((a, b) => a.blok.localeCompare(b.blok));
                },
                baSheetBlokUnits() {
                    const b = this.baSheet.blok;
                    return (this.bagian.units || []).filter(u => String(u.blok || '').trim() === b);
                },
                baSheetSearchResults() {
                    const q = this.normBagian(this.baSheet.q);
                    if (!q) return [];
                    return (this.bagian.units || []).filter(u => this.unitMatchesQuery(u, q));
                },
```

- [ ] **Step 5: Tambah method sheet + helper pencarian**

Sisipkan method berikut tepat setelah `openKelolaBaPicker()` / `closeKelolaBaPicker()` (baris 3895-3899):

```js
                openBaSheet(type) {
                    if (type) this.baSheet.type = type === 'pendukung' ? 'pendukung' : 'pelaksanaan';
                    this.baSheet.open = true;
                    this.baSheet.level = 'blok';
                    this.baSheet.blok = '';
                    this.baSheet.q = '';
                    this.baSheet.loading = false;
                    if (this.tab !== 'ba') this.switchTab('ba');
                    if (!(this.bagian.units || []).length && !this.loaded.bagian) this.loadBagian();
                },
                baSheetClose() {
                    if (this.bab.ba.open) this.babCloseBaPicker();
                    this.baSheet.open = false;
                    this.baSheet.level = 'blok';
                    this.baSheet.blok = '';
                    this.baSheet.q = '';
                },
                baSheetSetType(t) {
                    this.baSheet.type = t === 'pendukung' ? 'pendukung' : 'pelaksanaan';
                },
                baSheetOpenKegiatan(blok) {
                    this.baSheet.level = 'kegiatan';
                    this.baSheet.blok = blok;
                    this.baSheet.q = '';
                },
                baSheetBack() {
                    this.baSheet.level = 'blok';
                    this.baSheet.blok = '';
                    this.baSheet.q = '';
                },
                unitMatchesQuery(u, q) {
                    const needle = q || this.normBagian(this.baSheet.q);
                    if (!needle) return false;
                    const hay = [u.label, u.pilihan, u.detail, u.blok, u.bagian];
                    (u.dosenList || []).forEach(d => hay.push(d));
                    (u.ba || []).forEach(b => hay.push(b.dosen));
                    (u.peserta || []).forEach(p => { hay.push(p.namaLengkap); hay.push(p.npm); });
                    return hay.some(v => this.normBagian(v).indexOf(needle) !== -1);
                },
                baSheetPickKegiatan(u) {
                    if (this.baSheet.type === 'pendukung') {
                        const pid = (u.peserta && u.peserta[0] && u.peserta[0].idPengajuan) || '';
                        if (!pid) { this.notify('Kegiatan ini belum punya peserta.', false); return; }
                        this.baSheetClose();
                        this.openKelolaBaPendukung(pid);
                        return;
                    }
                    this.baSheetClose();
                    this.openPelaksanaanPanel(u);
                },
```

- [ ] **Step 6: Ubah tombol header "Buat BA" + tambah tombol "Sesi Bagian"**

Di baris 1121, ganti tombol "Unggah BA Pendukung":

```html
                            <button class="btn-primary !py-2 text-xs" @click="openBaSheet()"><i class="bi bi-plus-lg"></i> Buat BA</button>
                            <button class="btn-soft !py-2 text-xs" @click="bab.showPanel = true"><i class="bi bi-people"></i> Sesi Bagian</button>
```

- [ ] **Step 7: Ubah FAB (baris 2360)**

```html
        <button v-if="loggedIn" type="button" class="fab-btn lg:hidden" @click="openBaSheet()" aria-label="Buat Berita Acara" title="Buat Berita Acara">
            <i class="bi bi-plus-lg"></i>
        </button>
```

- [ ] **Step 7b: Perbarui test guard untuk tombol header baru**

Di `new-code1-cf/test/dashboard-template.test.js`, ubah baris 80:

```js
    expect(html).toContain('Buat BA');
    expect(html).not.toContain('Unggah BA Pendukung');
```

- [ ] **Step 8: Tambah CSS sheet**

Sisipkan setelah blok `.ba-ring > span { ... }` (hasil Task 1 Step 6):

```css
        .ba-sheet-wrap { position:fixed; inset:0; z-index:120; }
        .ba-sheet-scrim { position:absolute; inset:0; background:rgba(15,23,42,.45); -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px); }
        .ba-sheet { position:absolute; left:0; right:0; bottom:0; max-height:92vh; background:#fff; border-radius:22px 22px 0 0; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 -20px 50px -20px rgba(15,23,42,.5); }
        .ba-sheet-head { flex:0 0 auto; border-bottom:1px solid var(--line); padding:10px 16px 12px; }
        .ba-handle { width:40px; height:4px; border-radius:9999px; background:#cbd5e1; margin:0 auto 10px; }
        .ba-sheet-search { flex:0 0 auto; padding:10px 16px; border-bottom:1px solid var(--line); }
        .ba-sheet-body { flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:12px 16px calc(16px + env(safe-area-inset-bottom)); }
        .ba-sheet-list { display:flex; flex-direction:column; gap:8px; }
        .ba-sheet-row { display:flex; align-items:center; gap:10px; border:1px solid #e2e8f0; border-radius:14px; padding:10px 12px; text-align:left; transition:border-color .15s, background .15s; }
        .ba-sheet-row:hover { border-color:#a5b4fc; background:rgba(79,70,229,.04); }
        .ba-sheet-blok { border:1px solid #e2e8f0; border-radius:16px; padding:12px; text-align:left; transition:border-color .15s, box-shadow .15s; }
        .ba-sheet-blok:hover { border-color:#a5b4fc; box-shadow:0 6px 18px -12px rgba(79,70,229,.6); }
        @media (min-width:1024px) { .ba-sheet { left:50%; right:auto; transform:translateX(-50%); width:560px; } }
```

- [ ] **Step 9: Tambah markup sheet**

Sisipkan tepat setelah FAB (setelah penutup `</button>` FAB, sebelum `<!-- ============ MOBILE MENU SHEET ============ -->`):

```html
        <!-- ============ SHEET: BUAT BA ============ -->
        <div v-if="loggedIn && baSheet.open" class="ba-sheet-wrap">
            <div class="ba-sheet-scrim" @click="baSheetClose()"></div>
            <div class="ba-sheet">
                <div class="ba-sheet-head">
                    <div class="ba-handle"></div>
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="text-base font-extrabold text-slate-900">Buat Berita Acara</h2>
                        <button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" @click="baSheetClose()"><i class="bi bi-x-lg"></i></button>
                    </div>
                    <div class="mt-3 inline-flex rounded-full bg-slate-100 p-0.5 text-xs font-semibold">
                        <button class="rounded-full px-4 py-1.5" :class="baSheet.type==='pendukung' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'" @click="baSheetSetType('pendukung')">Pendukung</button>
                        <button class="rounded-full px-4 py-1.5" :class="baSheet.type==='pelaksanaan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'" @click="baSheetSetType('pelaksanaan')">Pelaksanaan</button>
                    </div>
                </div>
                <div class="ba-sheet-search">
                    <div class="master-search">
                        <i class="bi bi-search"></i>
                        <input v-model="baSheet.q" class="input" placeholder="Cari kegiatan, mahasiswa, atau dosen...">
                    </div>
                </div>
                <div class="ba-sheet-body">
                    <button v-if="baSheet.level==='kegiatan' && !baSheet.q" class="mb-3 flex items-center gap-1 text-xs font-semibold text-brand-600" @click="baSheetBack()"><i class="bi bi-chevron-left"></i> Blok {{ baSheet.blok }}</button>

                    <div v-if="sectionLoading.bagian" class="py-10 text-center text-sm text-slate-400">Memuat...</div>

                    <template v-else-if="baSheet.q">
                        <div v-if="!baSheetSearchResults.length" class="py-10 text-center text-sm text-slate-400">Tidak ada kegiatan cocok.</div>
                        <div v-else class="ba-sheet-list">
                            <button v-for="u in baSheetSearchResults" :key="u.key" class="ba-sheet-row" @click="baSheetPickKegiatan(u)">
                                <div class="min-w-0 flex-1">
                                    <div class="truncate text-sm font-bold text-slate-800">{{ u.label }}</div>
                                    <div class="mt-0.5 text-[11px] text-slate-400">Blok {{ u.blok }} · {{ u.bagian }} · {{ (u.peserta || []).length }} peserta</div>
                                </div>
                                <span class="shrink-0 text-xs font-semibold text-brand-600">Buat</span>
                            </button>
                        </div>
                    </template>

                    <template v-else-if="baSheet.level==='blok'">
                        <div v-if="!baSheetBlokGroups.length" class="py-10 text-center text-sm text-slate-400">Belum ada kegiatan dimuat. Coba muat ulang.</div>
                        <div v-else class="grid grid-cols-2 gap-2.5">
                            <button v-for="g in baSheetBlokGroups" :key="g.blok" class="ba-sheet-blok" @click="baSheetOpenKegiatan(g.blok)">
                                <div class="text-sm font-bold text-slate-900">Blok {{ g.blok }}</div>
                                <div class="text-[11px] text-slate-400">{{ g.total }} kegiatan</div>
                                <div class="mt-1 text-[11px] font-semibold" :class="g.belum ? 'text-amber-600' : 'text-emerald-600'">{{ g.belum ? g.belum + ' belum' : 'Lengkap' }}</div>
                            </button>
                        </div>
                    </template>

                    <template v-else>
                        <div v-if="!baSheetBlokUnits.length" class="py-10 text-center text-sm text-slate-400">Tidak ada kegiatan pada blok ini.</div>
                        <div v-else class="ba-sheet-list">
                            <button v-for="u in baSheetBlokUnits" :key="u.key" class="ba-sheet-row" @click="baSheetPickKegiatan(u)">
                                <div class="min-w-0 flex-1">
                                    <div class="truncate text-sm font-bold text-slate-800">{{ u.label }}</div>
                                    <div class="mt-0.5 text-[11px] text-slate-400">{{ u.bagian }} · {{ (u.peserta || []).length }} peserta</div>
                                </div>
                                <span class="shrink-0 text-xs font-semibold text-brand-600">Buat</span>
                            </button>
                        </div>
                    </template>
                </div>
            </div>
        </div>
```

- [ ] **Step 10: Hapus jalur `kbPicker` lama dari header**

Pastikan tidak ada lagi pemanggilan `openKelolaBaPicker()` di header/FAB (sudah digantikan). Method `openKelolaBaPicker`, `closeKelolaBaPicker`, `kbPickerOpenUnit`, dan state `kbPicker` **boleh dibiarkan** (tidak dipakai sebagai jalur utama; dibersihkan nanti). Verifikasi:

Run: `rg -n "openKelolaBaPicker\(\)" new-code1-cf/public/dashboard.html`
Expected: hanya definisi `openKelolaBaPicker() {` (tidak ada pemanggilan).

- [ ] **Step 11: Jalankan test**

Run: `npx vitest run test/dashboard-ba-sheet.test.js test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
cd /workspace/new-code1-cf
git add public/dashboard.html test/dashboard-ba-sheet.test.js test/dashboard-template.test.js
git commit -m "feat(dashboard): bottom-sheet Buat BA dengan pencarian lintas blok"
```

---

### Task 3: Konsep 01 — Form Pelaksanaan di dalam sheet

Memindahkan kartu form "Upload Berita Acara" dari panel `#bab-panel` ke dalam sheet, menambah sesi otomatis (`deriveBagianScope` + `babEnsureSession`), dan mengarahkan pemilihan kegiatan Pelaksanaan ke form dalam sheet.

**Files:**
- Modify: `new-code1-cf/public/dashboard.html`
- Test: `new-code1-cf/test/dashboard-ba-sheet.test.js`, `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Consumes: `babKegiatanGroups`, `babOpenBaPicker()`, `babSelectKegiatan(key)`, `bab.ba.*`, `babOnBaFile`, `babSubmitBa`, `babTogglePeserta`, `scanOnPhotos`, `scanBuildPdf`.
- Produces: method `deriveBagianScope(bagian)` → `{ kategori, subBagian }`; `babEnsureSession(kategori, subBagian)` → `Promise<boolean>`; `_babStartCore()`; `_baSheetPickPelaksanaan(u)`; `baSheetChangeKegiatan()`; panel tanpa kartu form.

- [ ] **Step 1: Perbarui test (form pindah ke sheet)**

Di `new-code1-cf/test/dashboard-ba-sheet.test.js`, tambahkan test:

```js
  it('menempatkan form pelaksanaan di dalam sheet, bukan panel', async () => {
    const html = await loadDashboardHtml();
    const sheetStart = html.indexOf('ba-sheet-wrap');
    const sheetEnd = html.indexOf('<!-- ============ MOBILE MENU SHEET', sheetStart);
    const sheet = html.slice(sheetStart, sheetEnd);
    expect(sheet).toContain('babOnBaFile');
    expect(sheet).toContain('babSubmitBa');

    const panelStart = html.indexOf('id="bab-panel"');
    const panelEnd = html.indexOf('<!-- ============ TAB: MASTER', panelStart);
    const panel = html.slice(panelStart, panelEnd);
    expect(panel).not.toContain('babOnBaFile');
  });

  it('menyediakan sesi otomatis dan pemilihan pelaksanaan', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('deriveBagianScope(bagian)');
    expect(html).toContain('babEnsureSession(kategori, subBagian)');
    expect(html).toContain('_baSheetPickPelaksanaan(u)');
  });
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run test/dashboard-ba-sheet.test.js`
Expected: FAIL (form masih di panel; `deriveBagianScope` belum ada).

- [ ] **Step 3: Refactor `babStart` → `babStart` + `_babStartCore`**

Ganti method `babStart` (baris 2887-2903) dengan:

```js
                async babStart() {
                    if (!this.bab.kategori) { this.notify('Pilih kategori kegiatan terlebih dahulu.', false); return false; }
                    if (this.bab.kategori === 'Praktikum' && !this.bab.subBagian) { this.notify('Untuk Praktikum, pilih sub bagian / lab terlebih dahulu.', false); return false; }
                    return await this._babStartCore();
                },
                async _babStartCore() {
                    this.bab.loading = true;
                    try {
                        const res = await this.run('adminBagianBypass', this.bab.kategori, this.bab.subBagian);
                        if (!res || !res.ok) { this.notify((res && res.message) || 'Gagal memulai sesi bagian.', false); return false; }
                        this.bab.token = res.token;
                        this.bab.nama = res.nama || 'Admin';
                        this.bab.active = true;
                        await this.babLoad();
                        return true;
                    } catch (e) {
                        this.notify('Gagal: ' + e, false);
                        return false;
                    } finally {
                        this.bab.loading = false;
                    }
                },
                async babEnsureSession(kategori, subBagian) {
                    if (this.bab.active && this.bab.kategori === kategori && (this.bab.subBagian || '') === (subBagian || '')) return true;
                    if (this.bab.active) this.babEnd();
                    this.bab.kategori = kategori;
                    this.bab.subBagian = subBagian || '';
                    return await this._babStartCore();
                },
```

- [ ] **Step 4: Refactor `openPelaksanaanPanel` memakai `deriveBagianScope`**

Ganti method `openPelaksanaanPanel(row)` (baris 4248-4271) dengan:

```js
                deriveBagianScope(bagian) {
                    const key = this.normBagian(bagian);
                    if (!key) return { kategori: '', subBagian: '' };
                    if (key === this.normBagian('SGD')) return { kategori: 'SGD', subBagian: '' };
                    if (key === this.normBagian('KKD')) return { kategori: 'KKD', subBagian: '' };
                    if (key === this.normBagian('Ujian')) return { kategori: 'Ujian', subBagian: '' };
                    const lab = (this.bagian.labs || []).find((l) => this.normBagian(l) === key);
                    if (lab) return { kategori: 'Praktikum', subBagian: lab };
                    return { kategori: '', subBagian: '' };
                },
                openPelaksanaanPanel(row) {
                    this.bab.showPanel = true;
                    if (!this.loaded.bagian && !this.bagian.labs.length) this.loadBagian();
                    const scope = this.deriveBagianScope((row && row.bagian) || '');
                    this.bab.kategori = scope.kategori;
                    this.bab.subBagian = scope.subBagian;
                    this.$nextTick(() => {
                        const el = document.getElementById('bab-panel');
                        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                },
```

- [ ] **Step 5: Ubah `baSheetPickKegiatan` jalur Pelaksanaan**

Ganti blok `else` terakhir pada `baSheetPickKegiatan` (hasil Task 2 Step 5) menjadi:

```js
                    this._baSheetPickPelaksanaan(u);
```

dan tambahkan method baru tepat setelahnya:

```js
                async _baSheetPickPelaksanaan(u) {
                    const scope = this.deriveBagianScope(u.bagian);
                    if (!scope.kategori) { this.notify('Bagian kegiatan ini tidak dikenali.', false); return; }
                    this.baSheet.loading = true;
                    try {
                        const ok = await this.babEnsureSession(scope.kategori, scope.subBagian);
                        if (!ok) return;
                        const match = this.babKegiatanGroups.find(g =>
                            String(g.blok || '').trim() === String(u.blok || '').trim()
                            && this.normBagian(g.pilihan) === this.normBagian(u.pilihan)
                            && this.normBagian(g.detail) === this.normBagian(u.detail)) || null;
                        if (!match) {
                            this.notify('Kegiatan tidak ditemukan pada sesi bagian ini.', false);
                            this.baSheetClose();
                            this.openPelaksanaanPanel(u);
                            return;
                        }
                        this.babOpenBaPicker();
                        this.babSelectKegiatan(match.key);
                    } finally {
                        this.baSheet.loading = false;
                    }
                },
                baSheetChangeKegiatan() {
                    this.bab.ba.open = false;
                    this.bab.ba.kegiatanKey = null;
                    this.bab.ba.selected = {};
                    this.baSheet.level = 'kegiatan';
                    this.baSheet.q = '';
                },
```

- [ ] **Step 6: Pindahkan markup form ke sheet**

Di dalam `.ba-sheet-body` (Task 2 Step 9), bungkus seluruh `<template v-else-if=...>` yang ada dengan `v-else` berikut. Ubah baris pertama `.ba-sheet-body` menjadi:

```html
                <div class="ba-sheet-body">
                    <template v-if="baSheet.type==='pelaksanaan' && bab.ba.open && babSelectedGroup">
                        <div class="flex items-center justify-between gap-2">
                            <div class="min-w-0">
                                <div class="truncate text-sm font-bold text-slate-900">{{ babSelectedGroup.label }}</div>
                                <div class="text-[11px] text-slate-400">{{ babSelectedGroup.peserta.length }} mahasiswa</div>
                            </div>
                            <button class="shrink-0 text-[11px] font-semibold text-brand-600" @click="baSheetChangeKegiatan"><i class="bi bi-chevron-left"></i> Ganti</button>
                        </div>
                        <div class="mt-3">
                            <div class="flex items-center justify-between gap-2">
                                <label class="label">Peserta Kegiatan</label>
                                <button class="text-[11px] font-semibold text-brand-600" @click="babToggleAllPeserta">{{ babAllSelected ? 'Batal Semua' : 'Pilih Semua' }}</button>
                            </div>
                            <div class="space-y-1.5">
                                <label v-for="p in babSelectedGroup.peserta" :key="p.idPengajuan" class="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-2.5 transition hover:border-brand-300" :class="bab.ba.selected[p.idPengajuan] ? 'border-brand-400 bg-brand-50/40' : ''">
                                    <input type="checkbox" class="h-4 w-4 accent-brand-600" :checked="!!bab.ba.selected[p.idPengajuan]" @change="babTogglePeserta(p.idPengajuan)">
                                    <div class="min-w-0 flex-1">
                                        <div class="truncate text-xs font-bold text-slate-800">{{ p.namaLengkap }}</div>
                                        <div class="font-mono text-[10px] text-slate-400">{{ p.npm }}</div>
                                    </div>
                                    <span class="shrink-0 text-[10px]" :class="statusBadge(p.statusPengajuan)">{{ p.statusPengajuan }}</span>
                                </label>
                            </div>
                        </div>
                        <div class="mt-3 grid gap-3">
                            <div><label class="label">Label <span class="font-normal text-slate-400">(opsional)</span></label><input v-model="bab.ba.label" class="input" placeholder="mis. Sesi 1"></div>
                            <div><label class="label">Tanggal Pelaksanaan</label><input v-model="bab.ba.tanggal" type="date" class="input"></div>
                            <div>
                                <label class="label">File BA (PDF / JPG / PNG)</label>
                                <div class="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-3">
                                    <i class="bi bi-cloud-arrow-up text-xl text-brand-400"></i>
                                    <div class="min-w-0 flex-1 truncate text-xs text-slate-500">
                                        <span v-if="!bab.ba.file">Pilih file atau scan kamera...</span>
                                        <span v-else class="font-semibold text-slate-700">{{ bab.ba.fileName }}</span>
                                    </div>
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" class="max-w-[120px] text-xs" @change="babOnBaFile">
                                </div>
                                <div class="mt-2 flex flex-wrap items-center gap-2">
                                    <button type="button" class="btn-soft !py-1.5 text-xs" :disabled="bab.ba.scanBusy" @click="$refs.pelaksanaanCamera.click()">
                                        <i class="bi bi-camera"></i> Scan Kamera
                                    </button>
                                    <span v-if="bab.ba.scanItems.length" class="text-[11px] text-slate-500">{{ bab.ba.scanItems.length }} halaman</span>
                                    <button v-if="bab.ba.scanItems.length" type="button" class="btn-primary !py-1.5 text-xs" :disabled="bab.ba.scanBusy" @click="scanBuildPdf('pelaksanaan')">
                                        <i class="bi bi-file-earmark-pdf"></i> Buat PDF
                                    </button>
                                    <button v-if="bab.ba.scanItems.length" type="button" class="btn-soft !py-1.5 text-xs" @click="scanClear('pelaksanaan')">Bersihkan</button>
                                </div>
                                <input ref="pelaksanaanCamera" type="file" accept="image/*" capture="environment" multiple class="hidden" @change="scanOnPhotos($event, 'pelaksanaan')">
                                <div v-if="bab.ba.scanItems.length" class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                                    <div v-for="(it, idx) in bab.ba.scanItems" :key="it.id" class="relative overflow-hidden rounded-lg ring-1 ring-slate-200">
                                        <img :src="it.url" :alt="'Halaman ' + (idx + 1)" class="h-20 w-full object-cover">
                                        <span class="absolute left-1 top-1 rounded bg-slate-900/70 px-1.5 text-[10px] font-semibold text-white">{{ idx + 1 }}</span>
                                        <button type="button" class="absolute right-1 top-1 rounded bg-rose-600/90 px-1.5 text-[10px] font-bold text-white" @click="scanRemove(idx, 'pelaksanaan')">x</button>
                                        <div class="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-slate-900/60 py-0.5">
                                            <button type="button" class="rounded px-1 text-[11px] text-white disabled:opacity-30" :disabled="idx === 0" title="Geser ke kiri" @click="scanMove(idx, -1, 'pelaksanaan')"><i class="bi bi-arrow-left"></i></button>
                                            <button type="button" class="rounded px-1 text-[11px] text-white disabled:opacity-30" :disabled="idx === bab.ba.scanItems.length - 1" title="Geser ke kanan" @click="scanMove(idx, 1, 'pelaksanaan')"><i class="bi bi-arrow-right"></i></button>
                                        </div>
                                    </div>
                                </div>
                                <p v-if="bab.ba.scanBusy" class="mt-2 text-[11px] text-brand-600">Memproses gambar...</p>
                            </div>
                            <div><label class="label">Catatan <span class="font-normal text-slate-400">(opsional)</span></label><textarea v-model="bab.ba.catatan" rows="2" class="input"></textarea></div>
                        </div>
                        <div class="mt-4 flex gap-2">
                            <button class="btn-soft flex-1" @click="baSheetChangeKegiatan"><i class="bi bi-arrow-left"></i> Ganti Kegiatan</button>
                            <button class="btn-primary flex-1" @click="babSubmitBa"><i class="bi bi-check2"></i> Lanjut</button>
                        </div>
                    </template>
                    <template v-else>
```

Lalu tutup `</template>` tambahan tepat sebelum penutup `</div>` dari `.ba-sheet-body` (setelah blok level kegiatan).

- [ ] **Step 7: Sembunyikan tab & cari saat menampilkan form**

Di kepala sheet, ubah pembungkus tab (`<div class="mt-3 inline-flex ...">`) agar memakai `v-if="!(baSheet.type==='pelaksanaan' && bab.ba.open && babSelectedGroup)"`, dan pembungkus `<div class="ba-sheet-search">` juga memakai `v-if` yang sama:

```html
                    <div v-if="!(baSheet.type==='pelaksanaan' && bab.ba.open && babSelectedGroup)" class="mt-3 inline-flex rounded-full bg-slate-100 p-0.5 text-xs font-semibold">
```

```html
                <div v-if="!(baSheet.type==='pelaksanaan' && bab.ba.open && babSelectedGroup)" class="ba-sheet-search">
```

- [ ] **Step 8: Hapus kartu form dari panel + arahkan tombol "Buat Berita Acara"**

Di `#bab-panel`, hapus seluruh kartu "Upload Berita Acara" (baris 1475-1559) dari `<div class="space-y-5">`, sisakan kartu "Berita Acara Terunggah" (baris 1561-1587).

Di header panel (dekat tombol Tutup, baris 1389), tambahkan tombol:

```html
                        <div class="flex items-center gap-2">
                            <button class="btn-primary !py-2 text-xs" @click="openBaSheet('pelaksanaan')"><i class="bi bi-plus-circle"></i> Buat Berita Acara</button>
                            <button class="btn-soft !py-2 text-xs" @click="closePelaksanaanPanel()"><i class="bi bi-x-lg"></i> Tutup</button>
                        </div>
```

- [ ] **Step 9: Naikkan z-index modal konfirmasi upload**

Di baris 1591, ubah `class="fixed inset-0 z-50 modal-overlay"` menjadi:

```html
                        <div v-if="bab.ba.confirm" class="fixed inset-0 z-[130] modal-overlay">
```

- [ ] **Step 10: Tutup sheet setelah upload sukses**

Di method `babDoUploadBa` (baris 2996-3025), pada blok sukses, tambahkan penutupan sheet. Ubah:

```js
                        if (res && res.success) {
                            this.babCloseBaPicker();
                            this.baSheet.open = false;
                            const fileEl = document.querySelector('input[type=file]');
                            if (fileEl) fileEl.value = '';
                            await this.babLoadBaList();
                            this.loaded.bagian = false;
                            await this.loadBagian();
                        }
```

- [ ] **Step 11: Perbarui test guard `dashboard-template.test.js`**

Pastikan baris 92 (aksi baris `openPelaksanaanPanel(r)`) masih ada. Tidak ada perubahan lain diperlukan.

- [ ] **Step 12: Jalankan test**

Run: `npx vitest run test/dashboard-ba-sheet.test.js test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
cd /workspace/new-code1-cf
git add public/dashboard.html test/dashboard-ba-sheet.test.js test/dashboard-template.test.js
git commit -m "feat(dashboard): form pelaksanaan pindah ke sheet dengan sesi otomatis"
```

---

### Task 4: Verifikasi penuh & pembersihan kode mati

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (bila ada sisa kode mati)
- Test: seluruh `new-code1-cf/test/`

- [ ] **Step 1: Jalankan seluruh test**

Run: `cd /workspace/new-code1-cf && npx vitest run`
Expected: PASS semua (target: 73 file / ≥ 525 test).

- [ ] **Step 2: Verifikasi kompilasi template & keberadaan penanda**

Run: `npx vitest run test/dashboard-template.test.js test/dashboard-ba-sheet.test.js`
Expected: PASS.

- [ ] **Step 3: Bersihkan sisa jalur `kbPicker` bila tidak terpakai**

Run: `rg -n "kbPicker|openKelolaBaPicker|closeKelolaBaPicker|kbPickerOpenUnit" new-code1-cf/public/dashboard.html`

Bila hanya tersisa definisi (tanpa pemanggilan), hapus state `kbPicker` (baris 2454), method `openKelolaBaPicker`/`closeKelolaBaPicker`/`kbPickerOpenUnit` (baris 3895-3905), dan markup modal `kbPicker` bila ada. Bila masih ada rujukan, biarkan (catat sebagai item ditunda).

- [ ] **Step 4: Cek sisa tanda heat/ba-pair yang mungkin tertinggal**

Run: `rg -n "bagianBar|bagianHeatmap|openBagianFromBar|openBagianFromCell|heatFillClass|heatCellClass|in-heat|heat-table|heat-scroll|heat-cell|heat-sticky|ba-pair" new-code1-cf/public/dashboard.html`
Expected: tidak ada hasil (kecuali bila sengaja dipertahankan; catat).

- [ ] **Step 5: Jalankan test sekali lagi**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit (bila ada perubahan)**

```bash
cd /workspace/new-code1-cf
git add public/dashboard.html test/
git commit -m "chore(dashboard): bersihkan jalur kbPicker dan css heat yang tak terpakai"
```

---

## Self-Review

- **Spec Bagian A**: titik masuk (header/FAB/panel) — Task 2 Step 6-7, Task 3 Step 8. State `baSheet` — Task 2 Step 3. Layout sheet (handle, tab, cari, breadcrumb, tingkat 1/2, hasil lintas blok) — Task 2 Step 9. Computed & helper — Task 2 Step 4-5. Aksi `baSheetPickKegiatan` Pendukung — Task 2 Step 5; Pelaksanaan — Task 3 Step 5. Form pelaksanaan dalam sheet — Task 3 Step 6. `deriveBagianScope` + `babEnsureSession` — Task 3 Step 3-4. Panel tetap & kartu form dihapus — Task 3 Step 8. Modal konfirmasi tetap di luar sheet — Task 3 Step 9.
- **Spec Bagian B**: hapus panel "Kelengkapan Pelaksanaan per Bagian" & tabel heat — Task 1 Step 4. `bagian.heatMetric`, `bagianBlokCards`, `setHeatMetric`, `openBlokCard` — Task 1 Step 3/8/9. Anchor `ba-unit-list` — Task 1 Step 5. Pembersihan kode mati — Task 1 Step 6-7/9, Task 4.
- **Spec Testing**: update `dashboard-template.test.js` — Task 1 Step 1, Task 2 Step 1/10; test baru `dashboard-ba-sheet.test.js` — Task 2 Step 1, Task 3 Step 1; `npm test` penuh — Task 4 Step 1/5.
- Type consistency: `baSheetBlokGroups` → `{ blok, total, belum }`; `bagianBlokCards` → `{ blok, total, done, pct, belum }`; `deriveBagianScope` → `{ kategori, subBagian }`; `babEnsureSession` → `Promise<boolean>`.
