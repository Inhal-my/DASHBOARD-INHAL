# Tab "Laporan Bagian" sebagai Matriks Kelengkapan BA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah tab "Laporan Bagian" di dashboard dari grid kartu menjadi matriks kelengkapan BA (baris = bagian, kolom = blok, sel = `sudahBA/totalKegiatan` berwarna) dengan panel rincian inline saat sel diklik.

**Architecture:** Frontend-only (pendekatan A). Data tetap dari `getDashboardBootstrap` → `_computeBagianAggregation` (tidak ada perubahan server). Vue menghitung matriks dari `bagian.all`/`bagian.rows` lewat computed baru, dan menampilkan matriks + panel rincian sebagai pengganti section kartu di `new-code1/pages/dashboard.html`.

**Tech Stack:** Google Apps Script web app; Vue 2 via inline script di `new-code1/pages/dashboard.html`; Tailwind-style utility classes; Bootstrap Icons.

## Global Constraints

- Hanya `new-code1/pages/dashboard.html` yang boleh diubah. **Jangan sentuh** `0_code.gs`, `1_business.gs`, `bagian.html`, `detail-laporan.html`, halaman lain.
- Inventaris kegiatan = baris dengan `sumber === 'Pengajuan'`; status BA = baris dengan `sumber === 'Berita Acara'` (BA bagian; `_computeBagianAggregation` sudah memfilter `_baSumber(r) === 'Bagian'`).
- Kunci kelengkapan (ternormalisasi, tanpa tanggal): `normBagian(bagian) + '|' + trim(blok) + '|' + normBagian(jenisKegiatan)`. `normBagian` = lower-case + buang diakritik + gabung spasi (sudah ada di method `normBagian(v)`, dashboard.html:1995).
- `totalKegiatan` per sel = banyaknya kegiatan unik dari baris Pengajuan di sel itu. `sudahBA` = banyaknya kegiatan pengajuan yang punya minimal satu baris BA dengan kunci sama. Baris BA tidak dihitung sebagai kegiatan tersendiri.
- Filter: **Blok** dan **Bagian** dipertahankan; **Sumber** dihapus (data `fSumber`, kondisi filter, dan dropdown).
- Kegiatan yang belum ber-BA **tetap muncul** (sel merah/kuning) — monitor kekurangan.
- Gaya: ikuti kelas yang sudah ada (`input`, `label`, `btn-primary`, `btn-soft`, `link`, `rounded-2xl`, `shadow-soft`, `ring-1 ring-slate-100`, dll). Tidak ada komentar baru di kode.

---

### Task 1: Data state + computed matriks

**Files:**
- Modify: `new-code1/pages/dashboard.html` — data object `bagian` (sekitar baris 1140), blok `computed:` (tambah setelah `bagianBlokOptions`, sekitar baris 1271)

**Interfaces:**
- Consumes: `this.bagian.all` (baris agregasi dari bootstrap), `this.bagian.rows` (hasil filter), `this.bagian.options` (daftar bagian dari server), `this.bagian.detail` (state baru), method `normBagian(v)`.
- Produces: computed `bagianMatrixCols` → `string[]`; computed `bagianMatrix` → `{ rows, cols, colTotals, grandTotal, grandDone }`; computed `bagianCellDetail` → `array[]`; data `bagian.detail` → `null | { bagian, blok }`.

- [ ] **Step 1: Update data object `bagian`**

Cari (sekitar baris 1140):

```js
                    bagian: { rows: [], all: [], fBagian: '', fSumber: '', fBlok: '', options: [], labs: [], bloks: [] },
```

Ganti menjadi (hapus `fSumber`, tambah `detail`):

```js
                    bagian: { rows: [], all: [], fBagian: '', fBlok: '', options: [], labs: [], bloks: [], detail: null },
```

- [ ] **Step 2: Tambah computed setelah `bagianBlokOptions`**

Cari blok `bagianBlokOptions()` (sekitar baris 1269-1271):

```js
                bagianBlokOptions() {
                    return (this.bagian.bloks || []).filter(b => b && b !== '-');
                },
```

Tepat setelah kurung tutup `},` method itu, tambahkan tiga computed berikut:

```js
                bagianMatrixCols() {
                    const seen = [];
                    (this.bagian.rows || []).forEach(r => {
                        const b = String(r.blok || '').trim();
                        if (b && b !== '-' && seen.indexOf(b) === -1) seen.push(b);
                    });
                    return seen.sort();
                },
                bagianMatrix() {
                    const rows = this.bagian.rows || [];
                    const normK = (r) => this.normBagian(r.bagian) + '|' + String(r.blok || '').trim() + '|' + this.normBagian(r.jenisKegiatan);
                    const baRowByKey = {};
                    rows.forEach(r => {
                        if (r.sumber === 'Berita Acara') {
                            const k = normK(r);
                            if (!baRowByKey[k]) baRowByKey[k] = r;
                        }
                    });
                    const cellMap = {};
                    rows.forEach(r => {
                        if (r.sumber !== 'Pengajuan') return;
                        const ck = this.normBagian(r.bagian) + '|' + String(r.blok || '').trim();
                        if (!cellMap[ck]) cellMap[ck] = { kegiatan: [], done: 0, total: 0 };
                        const ba = baRowByKey[normK(r)];
                        const hasBa = !!ba;
                        cellMap[ck].kegiatan.push({
                            jenisKegiatan: r.jenisKegiatan,
                            tanggalPelaksanaan: r.tanggalPelaksanaan,
                            total: r.total,
                            hasBa: hasBa,
                            fileUrl: hasBa ? ba.fileUrl : ''
                        });
                        cellMap[ck].total += 1;
                        if (hasBa) cellMap[ck].done += 1;
                    });
                    const cols = this.bagianMatrixCols;
                    const colTotals = {};
                    cols.forEach(b => { colTotals[b] = { total: 0, done: 0 }; });
                    const bagRows = [];
                    const rowsBags = [];
                    (this.bagian.options || []).forEach(bag => {
                        if (this.bagian.fBagian && bag !== this.bagian.fBagian) return;
                        rowsBags.push(bag);
                    });
                    rows.forEach(r => {
                        const b = r.bagian;
                        if (b && rowsBags.indexOf(b) === -1 && (!this.bagian.fBagian || b === this.bagian.fBagian)) rowsBags.push(b);
                    });
                    rowsBags.forEach(bag => {
                        const bKey = this.normBagian(bag);
                        const cells = {};
                        let rowTotal = 0, rowDone = 0;
                        cols.forEach(blok => {
                            const c = cellMap[bKey + '|' + blok] || { kegiatan: [], done: 0, total: 0 };
                            cells[blok] = c;
                            rowTotal += c.total;
                            rowDone += c.done;
                            colTotals[blok].total += c.total;
                            colTotals[blok].done += c.done;
                        });
                        bagRows.push({ bagian: bag, cells: cells, total: rowTotal, done: rowDone });
                    });
                    let grandTotal = 0, grandDone = 0;
                    bagRows.forEach(r => { grandTotal += r.total; grandDone += r.done; });
                    return { rows: bagRows, cols: cols, colTotals: colTotals, grandTotal: grandTotal, grandDone: grandDone };
                },
                bagianCellDetail() {
                    if (!this.bagian.detail) return [];
                    const d = this.bagian.detail;
                    const m = this.bagianMatrix;
                    const row = m.rows.find(r => this.normBagian(r.bagian) === this.normBagian(d.bagian));
                    if (!row) return [];
                    const cell = row.cells[d.blok];
                    return cell ? cell.kegiatan : [];
                },
```

- [ ] **Step 3: Verifikasi sintaks**

```bash
python3 - <<'PY'
import re
html = open('new-code1/pages/dashboard.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/dashboard_inline.js', 'w', encoding='utf-8').write(scripts[-1])
print('extracted', len(scripts), 'inline scripts')
PY
node --check /tmp/opencode/check/dashboard_inline.js
```

Expected: `node --check` tanpa error (exit 0).

- [ ] **Step 4: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(laporan-bagian): add BA completeness matrix computed + data state"
```

---

### Task 2: Methods + filter Sumber dihapus

**Files:**
- Modify: `new-code1/pages/dashboard.html` — blok `methods:` (bagian method `applyBagianFilter`, sekitar baris 1998-2004)

**Interfaces:**
- Consumes: data `bagian.detail`, `bagian.all`, `bagian.fBagian`, `bagian.fBlok`.
- Produces: methods `applyBagianFilter()` (tanpa `fSumber`), `openBagianCell(bagian, blok)`, `closeBagianDetail()`, `matrixCellClass(c)` → `string`.

- [ ] **Step 1: Perbarui `applyBagianFilter` dan tambah methods**

Cari (sekitar baris 1998-2004):

```js
                applyBagianFilter() {
                    const rows = this.bagian.all.filter(r =>
                        (!this.bagian.fBagian || r.bagian === this.bagian.fBagian) &&
                        (!this.bagian.fBlok || r.blok === this.bagian.fBlok) &&
                        (!this.bagian.fSumber || r.sumber === this.bagian.fSumber));
                    this.bagian.rows = rows;
                },
```

Ganti menjadi:

```js
                applyBagianFilter() {
                    const rows = this.bagian.all.filter(r =>
                        (!this.bagian.fBagian || r.bagian === this.bagian.fBagian) &&
                        (!this.bagian.fBlok || r.blok === this.bagian.fBlok));
                    this.bagian.rows = rows;
                },
                openBagianCell(bagian, blok) {
                    this.bagian.detail = { bagian: bagian, blok: blok };
                },
                closeBagianDetail() {
                    this.bagian.detail = null;
                },
                matrixCellClass(c) {
                    if (c.done === c.total) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
                    if (c.done > 0) return 'bg-amber-50 text-amber-700 ring-amber-200';
                    return 'bg-rose-50 text-rose-700 ring-rose-200';
                },
```

- [ ] **Step 2: Verifikasi sintaks**

```bash
python3 - <<'PY'
import re
html = open('new-code1/pages/dashboard.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/dashboard_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/check/dashboard_inline.js
```

Expected: exit 0.

- [ ] **Step 3: Cek tidak ada sisa `fSumber`**

```bash
grep -n "fSumber" new-code1/pages/dashboard.html
```

Expected: **tidak ada output** (semua referensi `fSumber` sudah dihapus di Task 1-2 dan akan dihapus dari template di Task 3).

- [ ] **Step 4: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(laporan-bagian): matrix methods and remove sumber filter"
```

---

### Task 3: Ganti section kartu dengan matriks + panel rincian

**Files:**
- Modify: `new-code1/pages/dashboard.html` — section `TAB: LAPORAN BAGIAN` (sekitar baris 368-429), termasuk dropdown filter

**Interfaces:**
- Consumes: computed `bagianMatrix`, `bagianMatrixCols`, `bagianCellDetail`; methods `openBagianCell`, `closeBagianDetail`, `matrixCellClass`, `applyBagianFilter`; helpers `formatTanggal`, `bagianBlokOptions`; data `bagian.fBlok`, `bagian.fBagian`, `bagian.detail`, `bagian.options`, `bagian.rows`, `sectionLoading.bagian`.
- Produces: markup matriks + panel rincian inline.

- [ ] **Step 1: Ganti seluruh section Laporan Bagian**

Cari blok berikut (seluruh section `v-if="tab==='bagian'"`, sekitar baris 368-429). Ganti **seluruh blok** ini:

```html
                <!-- ============ TAB: LAPORAN BAGIAN ============ -->
                <section v-if="tab==='bagian'">
                    <div class="mb-5">
                        <h1 class="text-xl font-extrabold tracking-tight text-slate-900">Laporan Bagian</h1>
                        <p class="mt-0.5 text-sm text-slate-500">Rekapitulasi peserta per bagian kegiatan.</p>
                    </div>

                    <div v-if="sectionLoading.bagian" class="mb-4 flex items-center justify-center gap-3 rounded-2xl bg-white py-12 text-slate-400 shadow-soft ring-1 ring-slate-100">
                        <svg class="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        <span class="text-sm font-semibold">Memuat laporan bagian...</span>
                    </div>

                    <div class="mb-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                        <div class="grid gap-3 md:grid-cols-12">
                            <div class="md:col-span-3">
                                <select v-model="bagian.fBlok" class="input" @change="applyBagianFilter()">
                                    <option value="">Semua Blok</option>
                                    <option v-for="b in bagianBlokOptions" :key="b" :value="b">{{ b }}</option>
                                </select>
                            </div>
                            <div class="md:col-span-3">
                                <select v-model="bagian.fBagian" class="input" @change="applyBagianFilter()">
                                    <option value="">Semua Bagian</option>
                                    <option v-for="o in bagian.options" :key="o" :value="o">{{ o }}</option>
                                </select>
                            </div>
                            <div class="md:col-span-3">
                                <select v-model="bagian.fSumber" class="input" @change="applyBagianFilter()">
                                    <option value="">Semua Sumber</option>
                                    <option>Pengajuan</option><option>Berita Acara</option>
                                </select>
                            </div>
                            <div class="md:col-span-3 flex items-center text-xs text-slate-400">
                                {{ bagian.rows.length }} baris data
                            </div>
                        </div>
                    </div>

                    <div class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                        <div v-if="!bagian.rows.length" class="px-4 py-12 text-center text-sm text-slate-400">Belum ada data.</div>
                        <div v-else class="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                            <div v-for="r in bagian.rows" class="rounded-2xl border border-slate-100 p-4 transition hover:border-slate-200">
                                <div class="flex items-start justify-between gap-2">
                                    <span class="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{{ r.bagian }}</span>
                                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{{ r.sumber }}</span>
                                </div>
                                <div class="mt-2 text-sm font-bold text-slate-900">{{ r.jenisKegiatan }}</div>
                                <div class="mt-2 space-y-1 text-xs text-slate-500">
                                    <div class="flex items-center gap-1.5"><i class="bi bi-grid"></i> {{ r.blok }}</div>
                                    <div class="flex items-center gap-1.5"><i class="bi bi-calendar3"></i> {{ formatTanggal(r.tanggalPelaksanaan) }}</div>
                                </div>
                                <div class="mt-3 flex items-center justify-between">
                                    <span class="text-sm font-extrabold text-slate-800">{{ r.total }} peserta</span>
                                    <a v-if="r.fileUrl" :href="r.fileUrl" target="_blank" class="link text-xs">Lihat File</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
```

dengan blok baru berikut:

```html
                <!-- ============ TAB: LAPORAN BAGIAN ============ -->
                <section v-if="tab==='bagian'">
                    <div class="mb-5">
                        <h1 class="text-xl font-extrabold tracking-tight text-slate-900">Laporan Bagian</h1>
                        <p class="mt-0.5 text-sm text-slate-500">Matriks kelengkapan berita acara per bagian &amp; blok.</p>
                    </div>

                    <div v-if="sectionLoading.bagian" class="mb-4 flex items-center justify-center gap-3 rounded-2xl bg-white py-12 text-slate-400 shadow-soft ring-1 ring-slate-100">
                        <svg class="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        <span class="text-sm font-semibold">Memuat laporan bagian...</span>
                    </div>

                    <div class="mb-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                        <div class="grid gap-3 md:grid-cols-12">
                            <div class="md:col-span-3">
                                <select v-model="bagian.fBlok" class="input" @change="applyBagianFilter()">
                                    <option value="">Semua Blok</option>
                                    <option v-for="b in bagianBlokOptions" :key="b" :value="b">{{ b }}</option>
                                </select>
                            </div>
                            <div class="md:col-span-3">
                                <select v-model="bagian.fBagian" class="input" @change="applyBagianFilter()">
                                    <option value="">Semua Bagian</option>
                                    <option v-for="o in bagian.options" :key="o" :value="o">{{ o }}</option>
                                </select>
                            </div>
                            <div class="md:col-span-6 flex items-center text-xs text-slate-400">
                                {{ bagianMatrix.rows.length }} bagian · {{ bagianMatrix.cols.length }} blok
                            </div>
                        </div>
                    </div>

                    <div class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                        <div v-if="!bagianMatrix.cols.length" class="px-4 py-12 text-center text-sm text-slate-400">Belum ada data.</div>
                        <div v-else class="overflow-x-auto">
                            <table class="w-full border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th class="sticky left-0 top-0 z-20 min-w-[150px] border-b border-slate-100 bg-white p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Bagian</th>
                                        <th v-for="b in bagianMatrix.cols" :key="'h' + b" class="sticky top-0 z-10 border-b border-slate-100 bg-white p-3 text-center text-xs font-bold text-slate-600">{{ b }}</th>
                                        <th class="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 p-3 text-center text-xs font-bold text-slate-600">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="r in bagianMatrix.rows" :key="'r' + r.bagian">
                                        <td class="sticky left-0 z-10 border-b border-slate-50 bg-white p-3 text-sm font-bold text-slate-800">{{ r.bagian }}</td>
                                        <td v-for="b in bagianMatrix.cols" :key="'c' + r.bagian + b" class="border-b border-slate-50 p-2 text-center">
                                            <button v-if="r.cells[b].total" class="w-full rounded-xl px-2 py-2 text-xs font-bold ring-1 ring-inset transition hover:opacity-80" :class="matrixCellClass(r.cells[b])" @click="openBagianCell(r.bagian, b)">
                                                {{ r.cells[b].done }}/{{ r.cells[b].total }}
                                            </button>
                                            <span v-else class="text-slate-300">–</span>
                                        </td>
                                        <td class="border-b border-slate-50 bg-slate-50/50 p-3 text-center text-xs font-bold text-slate-700">
                                            <span v-if="r.total">{{ r.done }}/{{ r.total }}</span>
                                            <span v-else class="text-slate-300">–</span>
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td class="sticky left-0 z-10 bg-slate-50 p-3 text-xs font-bold uppercase tracking-wider text-slate-500">Total</td>
                                        <td v-for="b in bagianMatrix.cols" :key="'f' + b" class="bg-slate-50 p-3 text-center text-xs font-bold text-slate-700">
                                            <span v-if="bagianMatrix.colTotals[b].total">{{ bagianMatrix.colTotals[b].done }}/{{ bagianMatrix.colTotals[b].total }}</span>
                                            <span v-else class="text-slate-300">–</span>
                                        </td>
                                        <td class="bg-slate-100 p-3 text-center text-xs font-bold text-slate-800">
                                            <span v-if="bagianMatrix.grandTotal">{{ bagianMatrix.grandDone }}/{{ bagianMatrix.grandTotal }}</span>
                                            <span v-else class="text-slate-300">–</span>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div v-if="bagian.detail" class="mt-4 overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
                        <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
                            <h2 class="text-sm font-bold text-slate-900">Kegiatan {{ bagian.detail.bagian }} · Blok {{ bagian.detail.blok }}</h2>
                            <button class="ml-auto btn-soft !px-3 !py-1 text-xs" @click="closeBagianDetail()"><i class="bi bi-x-lg"></i> Tutup</button>
                        </div>
                        <div v-if="!bagianCellDetail.length" class="px-4 py-8 text-center text-sm text-slate-400">Tidak ada kegiatan.</div>
                        <div v-else class="divide-y divide-slate-50">
                            <div v-for="(k, i) in bagianCellDetail" :key="i" class="flex flex-wrap items-center gap-3 p-4">
                                <span class="rounded-full px-2 py-0.5 text-[10px] font-bold" :class="k.hasBa ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'">
                                    {{ k.hasBa ? '✓ BA ada' : '✗ Belum ada BA' }}
                                </span>
                                <div class="min-w-0 flex-1">
                                    <div class="text-sm font-bold text-slate-800">{{ k.jenisKegiatan }}</div>
                                    <div class="mt-0.5 text-xs text-slate-400">{{ formatTanggal(k.tanggalPelaksanaan) }} · {{ k.total }} peserta</div>
                                </div>
                                <a v-if="k.hasBa && k.fileUrl" :href="k.fileUrl" target="_blank" class="link text-xs"><i class="bi bi-eye"></i> Lihat File</a>
                            </div>
                        </div>
                    </div>
                </section>
```

- [ ] **Step 2: Verifikasi sintaks**

```bash
python3 - <<'PY'
import re
html = open('new-code1/pages/dashboard.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/dashboard_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/check/dashboard_inline.js
```

Expected: exit 0.

- [ ] **Step 3: Cek wiring template**

```bash
grep -n "bagianMatrix\|bagianCellDetail\|openBagianCell\|closeBagianDetail\|matrixCellClass" new-code1/pages/dashboard.html
```

Expected: setiap nama muncul minimal 2 kali (definisi + pemakaian di template).

- [ ] **Step 4: Commit**

```bash
git add new-code1/pages/dashboard.html
git commit -m "feat(laporan-bagian): render BA completeness matrix with detail panel"
```

---

### Task 4: Verifikasi lintas-file

**Files:**
- Review: `new-code1/pages/dashboard.html`

- [ ] **Step 1: Verifikasi sintaks final**

```bash
python3 - <<'PY'
import re
html = open('new-code1/pages/dashboard.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/dashboard_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/check/dashboard_inline.js
```

Expected: exit 0.

- [ ] **Step 2: Cek tidak ada sisa filter Sumber**

```bash
grep -n "fSumber\|Semua Sumber" new-code1/pages/dashboard.html
```

Expected: tidak ada output.

- [ ] **Step 3: Cek konsistensi nama**

```bash
grep -n "bagianMatrix\b\|bagianMatrixCols\|bagianCellDetail\|openBagianCell\|closeBagianDetail\|matrixCellClass" new-code1/pages/dashboard.html
```

Expected: setiap nama terdefinisi (di computed/methods) dan terpakai (di template).

- [ ] **Step 4: Cek git**

```bash
git status
git log --oneline -6
```

Expected: 3 commit Task 1-3 ada di log; working tree bersih (kecuali `new-code1/` dan `_backup-archive/` yang tidak di-track).

---

## Catatan Pengujian Manual (setelah deploy)

1. Login dashboard → tab **Laporan Bagian** → matriks tampil (baris bagian × kolom blok).
2. Verifikasi sel: hijau (semua ber-BA), kuning (sebagian), merah (belum), `–` (kosong).
3. Klik sel → panel rincian di bawah berisi daftar kegiatan dengan status ✓/✗, jumlah peserta, dan link file untuk yang ber-BA.
4. Set filter Blok & Bagian → matriks menyempit; filter Sumber sudah tidak ada.
5. Bandingkan dengan sheet: `sudahBA/totalKegiatan` per sel sesuai hitungan baris agregasi Pengajuan vs Berita Acara.
