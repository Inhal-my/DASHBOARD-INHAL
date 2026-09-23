# Laporan Dosen BA Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the "Laporan Dosen" tab in `detail-laporan.html` into a matrix of BA counts per dosen & bagian, with filters, clickable cells that show BA detail, and XLSX export — frontend-only.

**Architecture:** Pure frontend change in the single inline Vue app of `new-code1/pages/detail-laporan.html`. No server changes (`0_code.gs`, `1_business.gs` untouched). Data comes from `getLaporanBootstrap` (`beritaAcara` = BA from bagian only, `rows` = pengajuan with `NPM`/`Dosen`/`Blok`/`Jenis Kegiatan`). Attribution BA→dosen is done by joining each BA participant's NPM to the pengajuan data (NPM+Blok match first, else first pengajuan with that NPM). The old expandable dosen list is deleted entirely. Filter state lives in a dedicated `dosenFilter` object so it never interferes with the other tabs' `filters`/`bagianFilter`.

**Tech Stack:** Vue 3 (global build via CDN), Tailwind-like custom classes (`brand-*`, `bg-slate-*`, `shadow-soft`, `input`, `btn-soft`, `link`), Bootstrap Icons (`bi-*`), SheetJS for export. No build step — this is a PHP-rendered GAS page.

## Global Constraints

- Only modify `new-code1/pages/detail-laporan.html`. Do NOT touch `0_code.gs`, `1_business.gs`, `bagian.html`, `dashboard.html`, or any other file.
- Follow the existing code style exactly: 4-space indent inside `<script>`, 20-space indent for data/computed/methods members (matching the file's indentation), no semicolons, single quotes, comma-dangling inside objects.
- No comments in code unless the surrounding code has them (it does not).
- Reuse existing helpers: `normSearch`, `normBagian`, `resolveBagianLabel`, `bagianKey`, `dateVal`, `showToast`, `matrixColTotal`/`matrixCellKey`/`filterByMatrixCell`/`resetMatrixCell` patterns from the Laporan Bagian tab.
- Reuse existing global fns: `fmtTanggal`, `fmtTanggalWaktu`, `fmtRupiah` are registered as globalProperties and also referenced directly in methods.
- The page is a Google Apps Script web app: the Vue app is one inline `<script>` block (lines 599–1414). A session token is appended as the last arg in `run(fn, ...args)`; we only read data already fetched by `loadData()`, so no new GAS calls.
- Do not add `blok` filter options from `this.blok` to other tabs; `dosenFilter.blok` dropdown reuses the existing `this.blok` array.
- No delete operations via shell; all changes are edits inside the HTML file (git tracks history).

---

### Task 1: Data State — add `dosenFilter` & `activeDosenCell`, remove `expandedDosen`

**Files:**
- Modify: `new-code1/pages/detail-laporan.html:763-767` (data() members)
- Modify: `new-code1/pages/detail-laporan.html:1286-1288` (loadData reset)

**Interfaces:**
- Produces: data `dosenFilter` `{ blok, jenis, from, to, bagian, q }` (all strings, all `''` by default); data `activeDosenCell` `null` (later set to `{ key, dosen, bagian }`). Removes `expandedDosen` which the dosen tab template (deleted in Task 5) and `toggleDosen` (deleted in Task 6) still reference.

- [ ] **Step 1: Edit `data()`**

Replace this block:

```js
                    expanded: {},
                    expandedDosen: {},
                    bagianFilter: { bagian: '', blok: '', q: '' },
                    activeMatrixCell: null,
```

with:

```js
                    expanded: {},
                    dosenFilter: { blok: '', jenis: '', from: '', to: '', bagian: '', q: '' },
                    activeDosenCell: null,
                    bagianFilter: { bagian: '', blok: '', q: '' },
                    activeMatrixCell: null,
```

- [ ] **Step 2: Edit `loadData()` reset**

Replace this line in the success branch:

```js
                        this.expandedDosen = {};
```

with:

```js
                        this.activeDosenCell = null;
```

(There is only one occurrence of `this.expandedDosen = {}`; leave the `this.expanded = {}` line just above it untouched.)

- [ ] **Step 3: Verify syntax**

Run the extraction + check:

```bash
mkdir -p /tmp/opencode/check && python3 - <<'PY'
import re
html = open('new-code1/pages/detail-laporan.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/detail_laporan_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/check/detail_laporan_inline.js
```

Expected: exit 0, no output. (Note: the file still references the to-be-removed `dosenGroups`/`expandedDosen` in template+methods until Tasks 5/6; `node --check` only parses syntax, so it stays green. The Vue template is not parsed by node.)

- [ ] **Step 4: Commit**

```bash
git add new-code1/pages/detail-laporan.html
git commit -m "feat(laporan-dosen): add dosenFilter and activeDosenCell data state"
```

---

### Task 2: NPM → Dosen Resolution (computed `dosenNpmMap` + methods `npmInfoFor`, `resolveDosenForNpm`)

**Files:**
- Modify: `new-code1/pages/detail-laporan.html:875-897` (replace `dosenGroups` computed)
- Modify: `new-code1/pages/detail-laporan.html:1147-1181` (methods, insert after `resolveBagianLabel`)

**Interfaces:**
- Consumes: data `rows` (each `r.pengajuan` has `NPM`, `Dosen`, `Blok`, `Jenis Kegiatan`).
- Produces: computed `dosenNpmMap` → `{ '<npm>': [{ dosen, blok, jenis }, ...] }`; method `npmInfoFor(npm, baBlok)` → best-match entry object `{ dosen, blok, jenis }` or `null`; method `resolveDosenForNpm(npm, baBlok)` → dosen display name string or `null`. Used by Tasks 3–6.

- [ ] **Step 1: Replace `dosenGroups` with `dosenNpmMap`**

Replace the entire `dosenGroups` computed (lines 875–897, from `dosenGroups() {` through its closing `},`) with:

```js
                dosenNpmMap() {
                    const map = {};
                    this.rows.forEach(r => {
                        const p = r.pengajuan;
                        const npm = String(p.NPM || '').trim();
                        if (!npm) return;
                        if (!map[npm]) map[npm] = [];
                        map[npm].push({
                            dosen: String(p.Dosen || '').trim() || 'Tanpa Dosen',
                            blok: String(p.Blok || '').trim(),
                            jenis: String(p['Jenis Kegiatan'] || '').trim()
                        });
                    });
                    return map;
                },
```

- [ ] **Step 2: Add resolution methods**

Insert these two methods immediately after the `resolveBagianLabel(v, pilihan, namaKegiatan) { ... },` method (i.e., before `dateVal`):

```js
                npmInfoFor(npm, baBlok) {
                    const list = this.dosenNpmMap[String(npm || '').trim()] || [];
                    if (!list.length) return null;
                    const blok = String(baBlok || '').trim();
                    return list.find(x => x.blok && x.blok === blok) || list[0];
                },
                resolveDosenForNpm(npm, baBlok) {
                    const info = this.npmInfoFor(npm, baBlok);
                    return info ? info.dosen : null;
                },
```

- [ ] **Step 3: Verify syntax**

Re-run the Task 1 Step 3 extraction + `node --check`. Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add new-code1/pages/detail-laporan.html
git commit -m "feat(laporan-dosen): add NPM to dosen resolution map and helpers"
```

---

### Task 3: Matrix Computeds (`dosenFilteredBa`, `dosenMatrixCols`, `dosenMatrixRows`, `dosenMatrix`, `dosenGrandTotal`, `dosenCellDetail`)

**Files:**
- Modify: `new-code1/pages/detail-laporan.html:1035-1039` (insert after `matrixGrandTotal`)

**Interfaces:**
- Consumes: `dosenFilter` (Task 1), `dosenNpmMap`/`npmInfoFor` (Task 2), `bagianAllLabels`, `resolveBagianLabel`, `normBagian`, `normSearch`, `dateVal`, `beritaAcara`.
- Produces: computed `dosenFilteredBa` → filtered `beritaAcara`; computed `dosenMatrixCols` → array of bagian label strings (narrowed by `dosenFilter.bagian`); computed `dosenMatrixRows` → array of `{ key, label, counts, total }` (counts keyed by `normBagian` label; only dosen with ≥1 BA; sorted alphabetically; filtered by `dosenFilter.q`); computed `dosenMatrix` → `{ cols, rows, grandTotal }` bundle; computed `dosenGrandTotal` → number; computed `dosenCellDetail` → array of `{ nama, tanggal, jumlahPeserta, fileUrl }` for the active cell (empty if `activeDosenCell` is null).

- [ ] **Step 1: Insert the six computed blocks**

Insert the following immediately after the `matrixGrandTotal()` computed (lines 1035–1039, i.e., right after its closing `},` and before `bagianDetailRows() {`):

```js
                dosenFilteredBa() {
                    const blok = String(this.dosenFilter.blok || '').trim();
                    const jenis = String(this.dosenFilter.jenis || '').trim();
                    const fromD = this.dosenFilter.from ? this.dateVal(this.dosenFilter.from) : null;
                    const toD = this.dosenFilter.to ? this.dateVal(this.dosenFilter.to) : null;
                    if (toD) toD.setHours(23, 59, 59, 999);
                    return this.beritaAcara.filter(b => {
                        if (blok && String(b.Blok || '').trim() !== blok) return false;
                        if (jenis) {
                            const ok = (b.peserta || []).some(p => {
                                const info = this.npmInfoFor(String(p.npm || '').trim(), b.Blok);
                                return info && info.jenis === jenis;
                            });
                            if (!ok) return false;
                        }
                        if (fromD || toD) {
                            const d = this.dateVal(b['Tanggal Pelaksanaan']);
                            if (!d) return false;
                            if (fromD && d < fromD) return false;
                            if (toD && d > toD) return false;
                        }
                        return true;
                    });
                },
                dosenMatrixCols() {
                    let cols = this.bagianAllLabels.slice();
                    const sel = String(this.dosenFilter.bagian || '').trim();
                    if (sel) {
                        const sk = this.normBagian(sel);
                        cols = cols.filter(c => this.normBagian(c) === sk);
                    }
                    return cols;
                },
                dosenMatrixRows() {
                    const cols = this.dosenMatrixCols;
                    const colKeys = cols.map(c => this.normBagian(c));
                    const q = this.normSearch(this.dosenFilter.q);
                    const map = {};
                    this.dosenFilteredBa.forEach(b => {
                        const bagianLabel = this.resolveBagianLabel(b.Bagian, '', b['Nama Kegiatan']) || 'Lainnya';
                        const bk = this.normBagian(bagianLabel);
                        if (colKeys.indexOf(bk) === -1) return;
                        const seenDosen = {};
                        (b.peserta || []).forEach(p => {
                            const dosen = this.resolveDosenForNpm(String(p.npm || '').trim(), b.Blok);
                            if (!dosen) return;
                            const dk = this.normSearch(dosen);
                            if (seenDosen[dk]) return;
                            seenDosen[dk] = 1;
                            if (!map[dk]) {
                                map[dk] = { key: dk, label: dosen, counts: {}, total: 0 };
                                colKeys.forEach(k => { map[dk].counts[k] = 0; });
                            }
                            map[dk].counts[bk] = (map[dk].counts[bk] || 0) + 1;
                            map[dk].total++;
                        });
                    });
                    let arr = Object.values(map);
                    if (q) arr = arr.filter(r => this.normSearch(r.label).indexOf(q) !== -1);
                    arr.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
                    return arr;
                },
                dosenGrandTotal() {
                    let t = 0;
                    this.dosenMatrixRows.forEach(r => { t += r.total; });
                    return t;
                },
                dosenMatrix() {
                    return { cols: this.dosenMatrixCols, rows: this.dosenMatrixRows, grandTotal: this.dosenGrandTotal };
                },
                dosenCellDetail() {
                    const cell = this.activeDosenCell;
                    if (!cell) return [];
                    const bk = this.normBagian(cell.bagian);
                    const dk = this.normSearch(cell.dosen);
                    const out = [];
                    this.dosenFilteredBa.forEach(b => {
                        const bagianLabel = this.resolveBagianLabel(b.Bagian, '', b['Nama Kegiatan']) || 'Lainnya';
                        if (this.normBagian(bagianLabel) !== bk) return;
                        const found = (b.peserta || []).some(p => {
                            const d = this.resolveDosenForNpm(String(p.npm || '').trim(), b.Blok);
                            return d && this.normSearch(d) === dk;
                        });
                        if (!found) return;
                        out.push({
                            nama: b['Nama Kegiatan'] || '-',
                            tanggal: b['Tanggal Pelaksanaan'] || '',
                            jumlahPeserta: Math.max((b.peserta || []).length, Number(b['Jumlah Peserta']) || 0),
                            fileUrl: b['File URL'] || ''
                        });
                    });
                    return out;
                },
```

- [ ] **Step 2: Verify syntax**

Re-run extraction + `node --check`. Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add new-code1/pages/detail-laporan.html
git commit -m "feat(laporan-dosen): add BA matrix computed properties"
```

---

### Task 4: Interaction Methods & Watchers (`dosenColTotal`, `dosenCellKey`, `openDosenCell`, `resetDosenCell`, `closeDosenDetail`, watchers)

**Files:**
- Modify: `new-code1/pages/detail-laporan.html:1081-1093` (watch block)
- Modify: `new-code1/pages/detail-laporan.html:1209-1234` (methods, insert near `matrixColTotal`/`resetMatrixCell`)

**Interfaces:**
- Consumes: `activeDosenCell` (Task 1), `dosenMatrixRows` (Task 3), `normBagian`/`normSearch`.
- Produces: method `dosenColTotal(bagianLabel)` → number (column sum across rows); method `dosenCellKey(dosen, bagian)` → `normSearch(dosen) + '::' + normBagian(bagian)`; method `openDosenCell(dosen, bagian)` sets `activeDosenCell` and smooth-scrolls to `#dosen-detail`; methods `resetDosenCell()`/`closeDosenDetail()` clear `activeDosenCell`. Watchers clear `activeDosenCell` whenever any `dosenFilter` field changes.

- [ ] **Step 1: Add `dosenColTotal` and `dosenCellKey` methods**

Insert immediately after the `matrixColTotal(bagianLabel) { ... },` method (lines 1209–1214, right before `matrixCellKey`):

```js
                dosenColTotal(bagianLabel) {
                    let t = 0;
                    const bk = this.normBagian(bagianLabel);
                    this.dosenMatrixRows.forEach(r => { t += r.counts[bk] || 0; });
                    return t;
                },
                dosenCellKey(dosen, bagian) {
                    return this.normSearch(dosen) + '::' + this.normBagian(bagian);
                },
```

- [ ] **Step 2: Add `openDosenCell`, `resetDosenCell`, `closeDosenDetail` methods**

Insert immediately after the `resetMatrixCell() { ... },` method (lines 1230–1234):

```js
                openDosenCell(dosen, bagian) {
                    this.activeDosenCell = { key: this.dosenCellKey(dosen, bagian), dosen: dosen, bagian: bagian };
                    this.$nextTick(() => {
                        const el = document.getElementById('dosen-detail');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                },
                resetDosenCell() {
                    this.activeDosenCell = null;
                },
                closeDosenDetail() {
                    this.activeDosenCell = null;
                },
```

- [ ] **Step 3: Add `dosenFilter` watchers**

Inside the `watch: {` block, after the two existing `bagianFilter` watchers and before the closing `},` of the watch object, add:

```js
                'dosenFilter.blok': function () { this.activeDosenCell = null; },
                'dosenFilter.jenis': function () { this.activeDosenCell = null; },
                'dosenFilter.from': function () { this.activeDosenCell = null; },
                'dosenFilter.to': function () { this.activeDosenCell = null; },
                'dosenFilter.bagian': function () { this.activeDosenCell = null; },
                'dosenFilter.q': function () { this.activeDosenCell = null; },
```

- [ ] **Step 4: Verify syntax**

Re-run extraction + `node --check`. Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add new-code1/pages/detail-laporan.html
git commit -m "feat(laporan-dosen): add matrix interaction methods and dosenFilter watchers"
```

---

### Task 5: Replace the Laporan Dosen Tab Template

**Files:**
- Modify: `new-code1/pages/detail-laporan.html:336-397` (entire `TAB 2: LAPORAN DOSEN` section)

**Interfaces:**
- Consumes: `dosenMatrix` (Task 3), `dosenFilter` (Task 1), `dosenColTotal`, `dosenCellKey`, `openDosenCell`, `closeDosenDetail`, `activeDosenCell`, `dosenCellDetail`, `blok`, `jenisOptions`, `bagianOptions`, `bagianKey`, `fmtTanggalWaktu`.
- Produces: The new tab UI. Deletes all references to `dosenGroups`, `toggleDosen`, `expandedDosen`, and the old per-dosen pengajuan table.

- [ ] **Step 1: Replace the section**

Replace the entire section from `<!-- ===================== TAB 2: LAPORAN DOSEN ===================== -->` through its closing `</section>` (lines 335–397) with:

```html
                    <!-- ===================== TAB 2: LAPORAN DOSEN ===================== -->
                    <section v-if="activeTab === 'dosen'" class="space-y-4">
                        <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                            <div class="grid gap-3 md:grid-cols-12">
                                <div class="md:col-span-3">
                                    <label class="label">Blok</label>
                                    <select v-model="dosenFilter.blok" class="input">
                                        <option value="">Semua Blok</option>
                                        <option v-for="o in blok" :key="o" :value="o">{{ o }}</option>
                                    </select>
                                </div>
                                <div class="md:col-span-3">
                                    <label class="label">Jenis Kegiatan</label>
                                    <select v-model="dosenFilter.jenis" class="input">
                                        <option value="">Semua Jenis</option>
                                        <option v-for="o in jenisOptions" :key="o" :value="o">{{ o }}</option>
                                    </select>
                                </div>
                                <div class="md:col-span-3">
                                    <label class="label">Bagian</label>
                                    <select v-model="dosenFilter.bagian" class="input">
                                        <option value="">Semua Bagian</option>
                                        <option v-for="o in bagianOptions" :key="o" :value="o">{{ o }}</option>
                                    </select>
                                </div>
                                <div class="md:col-span-3">
                                    <label class="label">Cari Dosen</label>
                                    <input v-model="dosenFilter.q" class="input" placeholder="Ketik nama dosen...">
                                </div>
                                <div class="md:col-span-3">
                                    <label class="label">Dari Tanggal</label>
                                    <input v-model="dosenFilter.from" type="date" class="input">
                                </div>
                                <div class="md:col-span-3">
                                    <label class="label">Sampai Tanggal</label>
                                    <input v-model="dosenFilter.to" type="date" class="input">
                                </div>
                                <div class="flex items-end md:col-span-6">
                                    <button v-if="activeDosenCell" class="btn-soft w-full" @click="resetDosenCell">
                                        <i class="bi bi-arrow-counterclockwise"></i> Reset
                                    </button>
                                </div>
                            </div>
                            <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                                <span class="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-500">{{ dosenMatrix.rows.length }} dosen</span>
                                <span class="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-500">{{ dosenMatrix.cols.length }} bagian</span>
                                <span class="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-500">{{ dosenMatrix.grandTotal }} BA total</span>
                            </div>
                        </div>

                        <div id="dosen-matrix" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                                <div>
                                    <div class="font-bold text-slate-800">Rekap Berita Acara per Dosen &amp; Bagian</div>
                                    <div class="text-xs text-slate-400">Klik angka pada sel untuk melihat daftar BA-nya</div>
                                </div>
                                <button class="btn-soft !py-1.5 text-xs" :disabled="exporting" @click="exportDosenMatrix">
                                    <i class="bi bi-file-earmark-excel"></i> Export XLSX
                                </button>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                                            <th class="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left">Dosen</th>
                                            <th v-for="b in dosenMatrix.cols" :key="b" class="whitespace-nowrap px-3 py-2.5 text-center">{{ b }}</th>
                                            <th class="px-3 py-2.5 text-center">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(row, ri) in dosenMatrix.rows" :key="row.key" :class="ri % 2 ? 'bg-slate-50/50' : 'bg-white'">
                                            <td :class="ri % 2 ? 'bg-slate-50' : 'bg-white'" class="sticky left-0 z-10 px-4 py-2">
                                                <div class="flex items-center gap-2">
                                                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-violet-500 text-white"><i class="bi bi-person-video3 text-sm"></i></div>
                                                    <span class="font-semibold text-slate-700">{{ row.label }}</span>
                                                </div>
                                            </td>
                                            <td v-for="b in dosenMatrix.cols" :key="b" class="px-1 py-1 text-center">
                                                <button
                                                    :disabled="!row.counts[bagianKey(b)]"
                                                    :class="[
                                                        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition',
                                                        activeDosenCell && activeDosenCell.key === dosenCellKey(row.label, b)
                                                            ? 'bg-brand-600 text-white shadow-md ring-2 ring-brand-600/30'
                                                            : (row.counts[bagianKey(b)] ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'text-slate-200')
                                                    ]"
                                                    @click="openDosenCell(row.label, b)">
                                                    {{ row.counts[bagianKey(b)] || '0' }}
                                                </button>
                                            </td>
                                            <td class="px-3 py-2 text-center font-bold text-slate-800">{{ row.total }}</td>
                                        </tr>
                                        <tr class="bg-slate-100">
                                            <td class="sticky left-0 z-10 bg-slate-100 px-4 py-2.5 font-bold text-slate-700">Total</td>
                                            <td v-for="b in dosenMatrix.cols" :key="b" class="px-3 py-2.5 text-center font-bold text-slate-700">{{ dosenColTotal(b) }}</td>
                                            <td class="px-3 py-2.5 text-center font-extrabold text-slate-900">{{ dosenMatrix.grandTotal }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div v-if="!dosenMatrix.rows.length" class="border-t border-slate-100 px-4 py-14 text-center">
                                <i class="bi bi-table text-3xl text-slate-300"></i>
                                <p class="mt-3 text-sm text-slate-400">Tidak ada data BA untuk filter ini.</p>
                            </div>
                        </div>

                        <div v-if="activeDosenCell" id="dosen-detail" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                                <div>
                                    <div class="font-bold text-slate-800">Detail BA: {{ activeDosenCell.dosen }}</div>
                                    <div class="text-xs text-slate-400">Bagian: {{ activeDosenCell.bagian }} · {{ dosenCellDetail.length }} BA</div>
                                </div>
                                <button class="btn-soft !py-1.5 text-xs" @click="closeDosenDetail"><i class="bi bi-x-lg"></i> Tutup</button>
                            </div>
                            <div v-if="dosenCellDetail.length" class="divide-y divide-slate-50">
                                <div v-for="(d, i) in dosenCellDetail" :key="i" class="flex flex-wrap items-center gap-3 px-4 py-3">
                                    <div class="min-w-0 flex-1">
                                        <div class="truncate font-semibold text-slate-800">{{ d.nama }}</div>
                                        <div class="text-xs text-slate-400">{{ fmtTanggalWaktu(d.tanggal) }}</div>
                                    </div>
                                    <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">{{ d.jumlahPeserta }} peserta</span>
                                    <a v-if="d.fileUrl" :href="d.fileUrl" target="_blank" class="btn-soft !py-1.5 text-xs"><i class="bi bi-file-earmark-pdf"></i> Lihat File</a>
                                </div>
                            </div>
                            <div v-else class="px-4 py-10 text-center text-sm text-slate-400">Tidak ada BA untuk kombinasi ini.</div>
                        </div>
                    </section>
```

- [ ] **Step 2: Verify syntax**

Re-run extraction + `node --check`. Expected: exit 0.

- [ ] **Step 3: Verify no stale references to removed members**

Run:

```bash
rg -n "dosenGroups|toggleDosen|expandedDosen" new-code1/pages/detail-laporan.html
```

Expected: no matches (all removed by this task except nothing left; `expandedDosen` references will be fully gone after Task 6 removes `toggleDosen`'s body — verify here that only `toggleDosen` in methods remains, which Task 6 removes).

- [ ] **Step 4: Commit**

```bash
git add new-code1/pages/detail-laporan.html
git commit -m "feat(laporan-dosen): render BA count matrix per dosen & bagian"
```

---

### Task 6: Export — refactor `_loadXlsx`, add `exportDosenMatrix`, replace the old `Dosen` sheet, remove `toggleDosen`

**Files:**
- Modify: `new-code1/pages/detail-laporan.html:1206-1208` (remove `toggleDosen` method)
- Modify: `new-code1/pages/detail-laporan.html:1303-1398` (`exportExcel` — extract loader + replace `Dosen` sheet, add `exportDosenMatrix` after it)

**Interfaces:**
- Consumes: `dosenMatrix` (Task 3), `dosenColTotal`, `dosenCellKey` (Task 4), `showToast`, SheetJS global `XLSX`.
- Produces: method `_loadXlsx()` → Promise resolving once `window.XLSX` is available (CDN-injected); method `exportDosenMatrix()` → downloads a single-sheet workbook `Rekap-Dosen-YYYY-MM-DD.xlsx` with the matrix + totals. `exportExcel` now uses `this._loadXlsx()` and its `'Dosen'` sheet is replaced by the matrix rows. `toggleDosen` is deleted.

- [ ] **Step 1: Remove `toggleDosen`**

Delete this method entirely (lines 1206–1208):

```js
                toggleDosen(key) {
                    this.expandedDosen[key] = !this.expandedDosen[key];
                },
```

- [ ] **Step 2: Extract `_loadXlsx` and update `exportExcel`'s loader**

Replace the beginning of `exportExcel()` (the `loadXlsx` inner definition, lines 1304–1311, plus the `loadXlsx().then` call at 1313) so the method starts like this:

```js
                _loadXlsx() {
                    return new Promise((resolve, reject) => {
                        if (window.XLSX) return resolve();
                        const s = document.createElement('script');
                        s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                        s.onload = () => resolve();
                        s.onerror = () => reject(new Error('Gagal memuat library export.'));
                        document.head.appendChild(s);
                    });
                },
                exportExcel() {
                    this.exporting = true;
                    this._loadXlsx().then(() => {
```

Concretely: replace the block from `exportExcel() {` through the line `loadXlsx().then(() => {` (lines 1303–1313) with the above.

- [ ] **Step 3: Replace the `'Dosen'` sheet in `exportExcel`**

Replace these lines (1327–1332):

```js
                            const dosenRows = [];
                            this.dosenGroups.forEach(g => g.rows.forEach(r => {
                                const p = r.pengajuan;
                                dosenRows.push({ Dosen: g.label, NPM: p.NPM, Nama: p['Nama Lengkap'], 'Jenis Kegiatan': p['Jenis Kegiatan'], Blok: p.Blok, 'Tanggal Pelaksanaan': fmtTanggal(p['Tanggal Pelaksanaan']), Status: p.Status || '', Biaya: Number(p.Biaya) || 0 });
                            }));
                            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dosenRows), 'Dosen');
```

with:

```js
                            const dosenCols = this.dosenMatrixCols;
                            const dosenRows = this.dosenMatrixRows.map(r => {
                                const row = { Dosen: r.label };
                                dosenCols.forEach(b => { row[b] = r.counts[this.bagianKey(b)] || 0; });
                                row.Total = r.total;
                                return row;
                            });
                            const dosenTotalRow = { Dosen: 'Total' };
                            dosenCols.forEach(b => { dosenTotalRow[b] = this.dosenColTotal(b); });
                            dosenTotalRow.Total = this.dosenGrandTotal;
                            dosenRows.push(dosenTotalRow);
                            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dosenRows), 'Rekap Dosen');
```

Note: `r.counts[this.bagianKey(b)]` is equivalent to `r.counts[this.normBagian(b)]` because `bagianKey` = `normBagian` (defined at 1218–1220). This keeps the sheet consistent with the matrix cell keys used in the UI.

- [ ] **Step 4: Add `exportDosenMatrix` method**

Insert immediately after the closing `},` of `exportExcel()` (i.e., before `mounted()`). The full new method:

```js
                exportDosenMatrix() {
                    this.exporting = true;
                    this._loadXlsx().then(() => {
                        try {
                            const wb = XLSX.utils.book_new();
                            const cols = this.dosenMatrixCols;
                            const rows = this.dosenMatrixRows.map(r => {
                                const row = { Dosen: r.label };
                                cols.forEach(b => { row[b] = r.counts[this.bagianKey(b)] || 0; });
                                row.Total = r.total;
                                return row;
                            });
                            const totalRow = { Dosen: 'Total' };
                            cols.forEach(b => { totalRow[b] = this.dosenColTotal(b); });
                            totalRow.Total = this.dosenGrandTotal;
                            rows.push(totalRow);
                            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Rekap Dosen');
                            XLSX.writeFile(wb, 'Rekap-Dosen-' + new Date().toISOString().slice(0, 10) + '.xlsx');
                            this.showToast('bi-check-circle', 'Export matriks dosen berhasil diunduh.');
                        } catch (e) {
                            this.showToast('bi-x-circle', 'Export gagal: ' + ((e && e.message) ? e.message : e));
                        } finally {
                            this.exporting = false;
                        }
                    }).catch(e => {
                        this.exporting = false;
                        this.showToast('bi-x-circle', 'Export gagal: ' + ((e && e.message) ? e.message : e));
                    });
                }
```

- [ ] **Step 5: Verify syntax and stale references**

Re-run extraction + `node --check` (expected: exit 0), then:

```bash
rg -n "dosenGroups|toggleDosen|expandedDosen" new-code1/pages/detail-laporan.html
```

Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add new-code1/pages/detail-laporan.html
git commit -m "feat(laporan-dosen): export dosen BA matrix to xlsx and remove legacy dosen list"
```

---

### Task 7: Final Verification

**Files:**
- Verify: `new-code1/pages/detail-laporan.html` only (plus docs already committed).

- [ ] **Step 1: Syntax check**

```bash
mkdir -p /tmp/opencode/check && python3 - <<'PY'
import re
html = open('new-code1/pages/detail-laporan.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/detail_laporan_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/check/detail_laporan_inline.js
```

Expected: exit 0, no output.

- [ ] **Step 2: Confirm no server files changed**

```bash
git status --short
```

Expected: only `new-code1/pages/detail-laporan.html` shows as modified among the tracked files in this feature's commits (all `new-code1/*` files are currently untracked; the expected final `git status` after committing should show only the unrelated untracked files `_backup-archive/`, `new-code1/2_web.gs`, etc. and none of the forbidden server files newly modified by us).

- [ ] **Step 3: Confirm forbidden files untouched**

```bash
git diff --stat -- 0_code.gs 1_business.gs dashboard.html bagian.html pages/bagian.html pages/dashboard.html 2>/dev/null || true
```

Expected: empty output (no changes).

- [ ] **Step 4: Manual test checklist (requires deploy, not runnable in this session)**

1. Login dashboard → tab **Laporan Dosen** → matrix renders (dosen rows × bagian columns) with per-row/per-column totals and grand total.
2. A single BA whose participants belong to 2 dosen counts once for each dosen; BA counted once per dosen (dedupe).
3. Click a numbered cell → detail panel below lists BA (nama kegiatan, tanggal, jumlah peserta, link file); clicking another cell swaps content; Reset/Tutup clears it.
4. Each filter (Blok, Jenis Kegiatan, Rentang Tanggal, Bagian narrowing columns, Cari Dosen) and combinations work.
5. Dosen with no BA in filter scope do not appear.
6. **Export XLSX** in the dosen tab downloads `Rekap-Dosen-<date>.xlsx` with matrix + totals.
7. Other tabs (Rekap, Laporan Bagian, Berita Acara) still work; the main **Export Excel** button still downloads all sheets including the renamed `Rekap Dosen` sheet.
