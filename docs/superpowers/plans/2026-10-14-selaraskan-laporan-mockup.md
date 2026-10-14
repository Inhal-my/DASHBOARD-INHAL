# Selaraskan Visual Laporan ke Mockup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan seluruh tab `detail-laporan.html` tampil setara dengan mockup redesain `laporan-detail.html`, tanpa menghapus kemampuan produksi.

**Architecture:** Satu file statis Vue 3 (`new-code1-cf/public/detail-laporan.html`). Semua gaya ditambahkan ke blok `<style>` khusus (tanpa build, tanpa CDN baru). Setiap tab di-restyle dengan primitif kelas `in-*` yang meniru mockup `mockups/pengajuan-v2/laporan-detail.html`; struktur seksi mengikuti mockup, sedangkan data/binding/perilaku produksi tidak berubah.

**Tech Stack:** HTML statis + Vue 3 (in-page), Tailwind precompiled (kelas ditulis manual), Vitest (`@cloudflare/vitest-pool-workers`) untuk guard template.

## Global Constraints

- Prinsip: **look mockup, fitur produksi tetap**. Urutan/gaya seksi ikut mockup; jangan hapus kemampuan produksi (kolom Aksi/hapus, ekspor xlsx, matriks interaktif, `progresDots` 6 tahap, filter berlapis).
- **Struktur visual saja**: tanpa perubahan field/computed/method/teks produksi selain yang eksplisit di task; tanpa interaksi baru selain chip status yang memakai ulang `filters.status`.
- Nilai CSS primitif disalin **verbatim** dari `dashboard.html`/mockup; tanpa CSS bersama (definisi hanya di `detail-laporan.html`).
- Tanpa langkah build; tanpa CDN baru.
- Jangan hapus/rename kelas yang di-assert tes: `.lap-card`, `.lap-card-head`, `.lap-card-title`, `.lap-card-sub`, `.lap-stat`, `.lap-chip`, `.lap-th`, `.in-chip`, `.in-badge`, `.in-tbl`, `.in-toolbar`, `.in-input`, `.in-progdots`, `.in-bar-track`, `.in-bar-fill`, `.in-heat`, `.in-tabsw`, `.in-tab`, `.in-statrow`, `.app-shell`, `.sidebar-aside`, `.main-wrap`, `.content-wrap`, `.topbar-*`, `.bottom-nav`, `.bnav-btn`, `.fab-btn`, `.sheet-*`, `.heat-table`, `.btn-acc`, `.btn-bukti`, `.check`, dan semua `in-*` lama.
- Bila markup baru memakai utilitas Tailwind arbitrary, definisikan manual di blok `<style>` (pelajaran sub-proyek 1).
- Tes: `cd new-code1-cf && npx vitest run <file>`; flake env `Network connection lost` boleh diulang sekali.
- Deploy wajib dari `new-code1-cf/`: `CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy --config ./wrangler.toml`.
- Base commit plan: `d504f9e`.

---

### Task 1: Primitif CSS lanjutan `in-*`

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html` (blok `<style>` khusus, sisipkan sebelum `</style>` ~line 211, setelah aturan `.achip .mini-ic.x`)
- Test: `new-code1-cf/test/detail-laporan-template.test.js`

**Interfaces:**
- Produces (kelas CSS): `.in-pageintro`, `.in-avatar`, `.in-celluser`, `.in-docdot`(+`.on.surat`/`.on.acc`/`.on.bukti`), `.in-cards`, `.in-desktop-only`, `.in-mcard`(+`.row1`/`.kv`/`.actions`), `.in-proc`(+`.p`/`.p2`/`.n`/`.t`/`.s`/`.arrow`), `.in-basum`(+`.b`/`.k`/`.n`/`.p`), `.in-heat-legend`(+`.dot`), `.panel-head`(+`h3`/`.sub`), `.in-statrow .ic.<tint>`, `.in-bar-fill.brand`.

- [ ] **Step 1: Write the failing test**

Tambahkan `it(...)` baru di dalam `describe('detail-laporan template', ...)`:

```js
it('primitif in-* lanjutan mockup tersedia', async () => {
  const html = await loadHtml();
  for (const s of ['.in-pageintro {', '.in-avatar {', '.in-celluser {', '.in-docdot {',
    '.in-docdot.on.bukti {', '.in-cards {', '.in-mcard {', '.in-proc {', '.in-basum {',
    '.in-heat-legend {', '.panel-head {', '.in-statrow .ic.indigo {', '.in-bar-fill.brand {']) {
    expect(html).toContain(s);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js -t "primitif in-* lanjutan"`
Expected: FAIL (`.in-pageintro {` belum ada).

- [ ] **Step 3: Add the CSS**

Sisipkan blok berikut ke `<style>` khusus `detail-laporan.html` (sebelum `</style>`):

```css
        /* ===== Primitif lanjutan (mockup pengajuan-v2) ===== */
        .in-pageintro { margin-bottom:18px; display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .in-pageintro h2 { margin:0; font-size:21px; font-weight:800; }
        .in-pageintro p { margin:4px 0 0; color:var(--ink-500); font-size:13.5px; }
        .in-avatar { width:34px; height:34px; border-radius:9999px; display:grid; place-items:center; flex:0 0 auto; color:#fff; font-weight:800; font-size:12px; }
        .in-celluser { display:flex; align-items:center; gap:11px; }
        .in-docdot { width:26px; height:26px; border-radius:8px; display:grid; place-items:center; font-size:12px; border:1px solid var(--line); color:var(--ink-400); background:#fff; }
        .in-docdot.on { color:#fff; border-color:transparent; }
        .in-docdot.on.surat { background:#0284c7; }
        .in-docdot.on.acc { background:#059669; }
        .in-docdot.on.bukti { background:#ea580c; }
        .in-cards { display:none; flex-direction:column; gap:12px; padding:12px; }
        @media (max-width:1023px){ .in-cards { display:flex; } }
        @media (max-width:1023px){ .in-desktop-only { display:none; } }
        .in-mcard { background:#fff; border:1px solid var(--line); border-radius:14px; padding:14px; box-shadow:0 1px 2px rgba(15,23,42,.04); }
        .in-mcard .row1 { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
        .in-mcard .kv { display:grid; grid-template-columns:92px 1fr; gap:4px 10px; font-size:12.5px; color:var(--ink-500); }
        .in-mcard .kv b { color:var(--ink-700); font-weight:600; }
        .in-mcard .actions { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; }
        .in-proc { display:flex; gap:10px; flex-wrap:wrap; background:#fff; border:1px solid var(--line); border-radius:var(--radius); padding:14px 16px; box-shadow:var(--shadow-soft); margin-bottom:18px; }
        .in-proc .p { display:flex; align-items:center; gap:10px; flex:1; min-width:220px; }
        .in-proc .p .n { width:30px; height:30px; border-radius:10px; display:grid; place-items:center; font-weight:800; font-size:13px; flex:0 0 auto; background:var(--brand-soft); color:var(--brand); }
        .in-proc .p.p2 .n { background:var(--emerald-soft); color:var(--emerald); }
        .in-proc .p .t { font-size:12.5px; font-weight:800; color:var(--ink-900); }
        .in-proc .p .s { font-size:11px; color:var(--ink-400); }
        .in-proc .arrow { color:#cbd5e1; display:grid; place-items:center; font-size:16px; }
        .in-basum { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin-bottom:18px; }
        .in-basum .b { background:#fff; border:1px solid var(--line); border-radius:14px; padding:14px; box-shadow:var(--shadow-soft); text-align:left; transition:.15s; }
        .in-basum .b:hover { border-color:#cbd5e1; }
        .in-basum .k { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-400); }
        .in-basum .n { margin-top:5px; font-size:20px; font-weight:800; }
        .in-basum .p { font-size:11px; font-weight:600; color:var(--ink-400); }
        .in-basum .n.rose { color:var(--rose); }
        .in-basum .n.emerald { color:var(--emerald); }
        @media (max-width:1100px){ .in-basum { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        .in-heat-legend { display:flex; gap:12px; font-size:11px; color:var(--ink-500); margin-top:10px; }
        .in-heat-legend .dot { width:9px; height:9px; border-radius:99px; display:inline-block; margin-right:4px; }
        .panel-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 16px; border-bottom:1px solid var(--line); flex-wrap:wrap; }
        .panel-head h3 { margin:0; font-size:13.5px; font-weight:800; display:flex; align-items:center; gap:8px; color:var(--ink-900); }
        .panel-head .sub { font-size:11.5px; color:var(--ink-400); font-weight:500; margin-top:2px; }
        .in-statrow .top { display:flex; width:100%; align-items:center; }
        .in-statrow .ic.indigo { background:var(--brand-soft); color:var(--brand); }
        .in-statrow .ic.amber { background:var(--amber-soft); color:var(--amber); }
        .in-statrow .ic.emerald { background:var(--emerald-soft); color:var(--emerald); }
        .in-statrow .ic.sky { background:var(--sky-soft); color:var(--sky); }
        .in-statrow .ic.rose { background:var(--rose-soft); color:var(--rose); }
        .in-statrow .ic.violet { background:var(--violet-soft); color:var(--violet); }
        .in-statrow .ic.teal { background:var(--teal-soft); color:var(--teal); }
        .in-statrow .ic.slate { background:#f1f5f9; color:#64748b; }
        .in-bar-fill.brand { background:linear-gradient(90deg,#6366f1,#a78bfa); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js -t "primitif in-* lanjutan"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-template.test.js
git commit -m "style(laporan): primitif in-* lanjutan dari mockup"
```

---

### Task 2: Tab Rekap — page-intro, badge pct, chip status, avatar, docdot, kartu mobile

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html` (tab `v-if="activeTab === 'rekap'"` ~500-678; computed `summaryCards` ~1750; methods `safeUrl` ~)
- Test: `new-code1-cf/test/detail-laporan-template.test.js`

**Interfaces:**
- Consumes: primitif Task 1 + `in-statrow`, `in-chip`, `in-celluser`, `in-avatar`, `in-docdot`, `in-cards`, `in-mcard`, `in-pageintro`.
- Produces (computed/methods): `summaryCards()` diperluas dengan `pct` + `tint` nama mockup; `statusChips()` baru (array `{key,label,count,dot}`); method `vwInitials(n)` dan `vwAvatarColor(n)`.
- Marker markup: `.in-pageintro`, `.in-celluser`, `.in-docdot`, `.in-cards`.

- [ ] **Step 1: Write the failing test**

```js
it('rekap memakai page-intro, pct, avatar, docdot, chip status, kartu mobile', async () => {
  const html = await loadHtml();
  expect(html).toContain('in-pageintro');
  expect(html).toContain('vwInitials');
  expect(html).toContain('vwAvatarColor');
  expect(html).toContain('statusChips');
  expect(html).toContain('in-celluser');
  expect(html).toContain('in-docdot');
  expect(html).toContain('class="in-cards"');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js -t "rekap memakai page-intro"`
Expected: FAIL.

- [ ] **Step 3: Implement**

3a. Ganti isi computed `summaryCards()` (~1750-1759) agar menyertakan `pct` + tint mockup:

```js
                summaryCards() {
                    const t = this.animated.totalPendaftar || 0;
                    const share = (n) => (t ? Math.round(((n || 0) / t) * 100) + '%' : '0%');
                    return [
                        { label: 'Total Pendaftar', num: this.animated.totalPendaftar, icon: 'bi-people-fill', color: '#4f46e5', tint: 'indigo', pct: '100%' },
                        { label: 'Menunggu', num: this.animated.totalMenunggu, icon: 'bi-hourglass-split', color: '#d97706', tint: 'amber', pct: share(this.animated.totalMenunggu) },
                        { label: 'Diterima', num: this.animated.totalDiterima, icon: 'bi-check2-circle', color: '#059669', tint: 'sky', pct: share(this.animated.totalDiterima) },
                        { label: 'ACC', num: this.animated.totalAcc, icon: 'bi-patch-check-fill', color: '#6366f1', tint: 'emerald', pct: share(this.animated.totalAcc) },
                        { label: 'Ditolak', num: this.animated.totalDitolak, icon: 'bi-x-circle', color: '#e11d48', tint: 'rose', pct: share(this.animated.totalDitolak) },
                        { label: 'Total Biaya', num: fmtRupiah(this.animated.totalBiaya), money: true, icon: 'bi-cash-stack', color: '#0d9488', tint: 'teal' }
                    ];
                },
```

3b. Tambah computed `statusChips()` tepat setelah `summaryCards()`:

```js
                statusChips() {
                    const counts = {};
                    let total = 0;
                    this.rows.forEach(r => {
                        const s = String(r.pengajuan.Status || '').trim() || 'Lainnya';
                        counts[s] = (counts[s] || 0) + 1;
                        total++;
                    });
                    const dot = { '': '#64748b', 'Menunggu': '#d97706', 'Diterima': '#0284c7', 'ACC': '#059669', 'Ditolak': '#e11d48', 'Dibatalkan': '#64748b' };
                    const out = [{ key: '', label: 'Semua', count: total, dot: dot[''] }];
                    ['Menunggu', 'Diterima', 'ACC', 'Ditolak', 'Dibatalkan'].forEach(s => out.push({ key: s, label: s, count: counts[s] || 0, dot: dot[s] }));
                    return out;
                },
```

3c. Tambah method `vwInitials` dan `vwAvatarColor` di objek `methods:` (dekat `safeUrl`):

```js
                vwInitials(n) {
                    const p = String(n || '').trim().split(/\s+/);
                    return ((p[0] || '')[0] || '').toUpperCase() + ((p[1] || '')[0] || '').toUpperCase();
                },
                vwAvatarColor(n) {
                    const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#e11d48', '#8b5cf6', '#14b8a6', '#f97316'];
                    let h = 0; const s = String(n || '');
                    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
                    return colors[h % colors.length];
                },
```

3d. Sisipkan **page-intro** tepat setelah `<section v-if="activeTab === 'rekap'" class="space-y-6">` (~500):

```html
                        <div class="in-pageintro">
                            <div>
                                <h2>Rekap Keseluruhan</h2>
                                <p>Ringkasan seluruh pengajuan, status, biaya, dan sebaran kegiatan.</p>
                            </div>
                        </div>
```

3e. Ubah markup kartu statistik (~517-523) agar memakai baris `.top` + badge `.pct`:

```html
                            <div v-for="c in summaryCards" :key="c.label" class="in-statrow lap-stat flex-col" style="align-items:flex-start;gap:6px">
                                <div class="top">
                                    <div class="ic" :class="c.tint"><i :class="c.icon" :style="{color:c.color}"></i></div>
                                    <span v-if="c.pct !== undefined" class="pct">{{ c.pct }}</span>
                                </div>
                                <div>
                                    <div class="num" :class="c.money ? 'text-sm' : ''">{{ c.num }}</div>
                                    <div class="lbl uppercase tracking-wider">{{ c.label }}</div>
                                </div>
                            </div>
```

3f. Sisipkan baris **chip status** di dalam kartu filter (~596), sebelum `<div class="grid gap-3 md:grid-cols-12">`:

```html
                            <div class="mb-3 flex flex-wrap gap-2">
                                <button v-for="c in statusChips" :key="c.key" type="button"
                                        :class="filters.status === c.key ? 'in-chip is-active' : 'in-chip'"
                                        @click="filters.status = c.key">
                                    <span class="dot" :style="{background:c.dot}"></span>{{ c.label }}
                                    <span class="opacity-70">{{ c.count }}</span>
                                </button>
                            </div>
```

3g. Ubah sel **NPM / Nama** (~646-649) menjadi avatar `in-celluser`:

```html
                                                <td class="px-3 py-3">
                                                    <div class="in-celluser">
                                                        <div class="in-avatar" :style="{background: vwAvatarColor(r.pengajuan['Nama Lengkap'])}">{{ vwInitials(r.pengajuan['Nama Lengkap']) }}</div>
                                                        <div>
                                                            <div class="font-semibold text-slate-800">{{ r.pengajuan['Nama Lengkap'] }}</div>
                                                            <div class="font-mono text-xs text-slate-400">{{ r.pengajuan.NPM }}</div>
                                                        </div>
                                                    </div>
                                                </td>
```

3h. Ubah sel **Bukti** (~661-664) menjadi `in-docdot`:

```html
                                                <td class="px-4 py-3">
                                                    <div class="flex gap-[5px]">
                                                        <a v-if="r.pengajuan['Link Bukti Bayar']" :href="safeUrl(r.pengajuan['Link Bukti Bayar'])" target="_blank" rel="noopener noreferrer" class="in-docdot on bukti" title="Bukti Bayar" @click.stop><i class="bi bi-cash-coin"></i></a>
                                                        <a v-if="r.pengajuan['Link ACC INHAL']" :href="safeUrl(r.pengajuan['Link ACC INHAL'])" target="_blank" rel="noopener noreferrer" class="in-docdot on acc" title="ACC INHAL" @click.stop><i class="bi bi-patch-check"></i></a>
                                                        <span v-if="!r.pengajuan['Link Bukti Bayar'] && !r.pengajuan['Link ACC INHAL']" class="text-slate-300">-</span>
                                                    </div>
                                                </td>
```

3i. Tambah kelas `in-desktop-only` pada wrapper tabel (~617 `<div class="overflow-x-auto">` menjadi `<div class="overflow-x-auto in-desktop-only">`) dan sisipkan **kartu mobile** tepat setelah `</div>` penutup wrapper tabel (~675), masih di dalam `lap-card`:

```html
                            <div class="in-cards">
                                <article v-for="r in filteredRows" :key="'m-' + r.pengajuan['ID Pengajuan']" class="in-mcard cursor-pointer" @click="toggleExpand(r.pengajuan['ID Pengajuan'])">
                                    <div class="row1">
                                        <div class="in-celluser">
                                            <div class="in-avatar" :style="{background: vwAvatarColor(r.pengajuan['Nama Lengkap'])}">{{ vwInitials(r.pengajuan['Nama Lengkap']) }}</div>
                                            <span class="font-semibold text-slate-800">{{ r.pengajuan['Nama Lengkap'] }}</span>
                                        </div>
                                        <span :class="statusBadgeCls(r.pengajuan.Status)">{{ r.pengajuan.Status || '-' }}</span>
                                    </div>
                                    <div class="kv"><span>NPM</span><b class="font-mono">{{ r.pengajuan.NPM }}</b><span>Kegiatan</span><b>{{ r.pengajuan['Jenis Kegiatan'] }} · {{ r.pengajuan.Blok }}</b><span>Pelaksanaan</span><b>{{ fmtTanggal(r.pengajuan['Tanggal Pelaksanaan']) }}</b><span>Dosen</span><b>{{ r.pengajuan.Dosen || '-' }}</b><span>Sumber</span><b>{{ (r.pengajuan.Sumber || '').trim() === 'Manual' ? 'Manual' : 'Portal' }}</b><span>Biaya</span><b class="text-brand-700">{{ r.pengajuan['Biaya Rupiah'] || fmtRupiah(r.pengajuan.Biaya) }}</b></div>
                                    <div v-if="expanded[r.pengajuan['ID Pengajuan']]" class="mt-2 border-t border-slate-100 pt-2"><expanded-detail :r="r"></expanded-detail></div>
                                    <div class="actions">
                                        <button class="btn-soft" @click.stop="toggleExpand(r.pengajuan['ID Pengajuan'])"><i class="bi bi-chevron-down"></i> Detail</button>
                                        <button class="btn-soft" @click.stop="deletePengajuanRow(r)"><i class="bi bi-trash"></i> Hapus</button>
                                    </div>
                                </article>
                            </div>
```

- [ ] **Step 4: Run tests**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-template.test.js
git commit -m "style(laporan): selaraskan tab rekap dengan mockup"
```

---

### Task 3: Tab Dosen — bar chart "Jumlah BA per Dosen" + legenda heat

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html` (tab `v-if="activeTab === 'dosen'"` ~681-820; computed setelah `dosenMatrix` ~2117)
- Test: `new-code1-cf/test/detail-laporan-template.test.js`

**Interfaces:**
- Consumes: `.in-bar-track`, `.in-bar-fill.brand` (Task 1), `.in-heat-legend`, `.in-badge`.
- Produces (computed): `dosenBaBars()` → array `{label,value,pct}` dari `dosenMatrixRows`.

- [ ] **Step 1: Write the failing test**

```js
it('dosen memakai bar chart BA per dosen dan legenda heat', async () => {
  const html = await loadHtml();
  expect(html).toContain('dosenBaBars');
  expect(html).toContain('Jumlah Berita Acara per Dosen');
  expect(html).toContain('in-heat-legend');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js -t "dosen memakai bar chart"`
Expected: FAIL.

- [ ] **Step 3: Implement**

3a. Tambah computed `dosenBaBars()` setelah `dosenMatrix()` (~2119):

```js
                dosenBaBars() {
                    const rows = this.dosenMatrixRows.slice().sort((a, b) => b.total - a.total);
                    const max = Math.max(1, ...rows.map(r => r.total));
                    return rows.map(r => ({ label: r.label, value: r.total, pct: Math.round((r.total / max) * 100) }));
                },
```

3b. Sisipkan kartu chart tepat setelah kartu filter Dosen (`</div>` penutup `lap-card p-4` ~740, sebelum `<div id="dosen-matrix" ...>` ~742):

```html
                        <div class="lap-card p-4">
                            <div class="mb-4 flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2">
                                    <i class="bi bi-bar-chart-steps text-brand-500"></i>
                                    <h2 class="lap-card-title">Jumlah Berita Acara per Dosen</h2>
                                </div>
                                <span class="in-badge cancel">{{ dosenMatrix.grandTotal }} BA total</span>
                            </div>
                            <div class="space-y-3">
                                <div v-for="b in dosenBaBars" :key="b.label">
                                    <div class="mb-1 flex items-center justify-between text-xs">
                                        <span class="text-slate-600">{{ b.label }}</span>
                                        <span class="font-bold text-slate-800">{{ b.value }} kegiatan</span>
                                    </div>
                                    <div class="in-bar-track"><div class="in-bar-fill brand transition-all duration-700 ease-out" :style="{ width: (b.pct * barProgress) + '%' }"></div></div>
                                </div>
                                <div v-if="!dosenBaBars.length" class="text-sm text-slate-400">Belum ada data.</div>
                            </div>
                        </div>
```

3c. Tambah legenda heat tepat setelah `</div>` penutup `.heat-scroll` (~791), masih di dalam `lap-card` `id="dosen-matrix"`:

```html
                            <div class="in-heat-legend px-3 pb-3">
                                <span><i class="dot" style="background:#ecfdf5;border:1px solid #a7f3d0"></i>2+ kegiatan</span>
                                <span><i class="dot" style="background:#fffbeb;border:1px solid #fde68a"></i>1 kegiatan</span>
                            </div>
```

- [ ] **Step 4: Run tests**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-template.test.js
git commit -m "style(laporan): tambah chart BA per dosen & legenda heat"
```

---

### Task 4: Tab Bagian — satukan matriks Blok×Bagian ke primitif heat

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html` (tab `v-if="activeTab === 'bagian'"` ~823-1002; matriks ~966-999)
- Test: `new-code1-cf/test/detail-laporan-template.test.js`

**Interfaces:**
- Consumes: `.in-heat`(+`.c.g`/`.c.y`), `.in-heat-legend`.
- Produces (markup): matrix table `class="heat-table in-heat w-full"` dengan sel `heat-cell c` + legenda.

- [ ] **Step 1: Write the failing test**

```js
it('bagian memakai primitif heat yang konsisten', async () => {
  const html = await loadHtml();
  expect(html).toContain('heat-table in-heat w-full');
  expect(html).toContain('Baris = Blok, kolom = Bagian');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js -t "bagian memakai primitif heat"`
Expected: FAIL (`heat-table in-heat w-full` belum ada).

- [ ] **Step 3: Implement**

3a. Ubah tag tabel matriks (~966) dari `<table class="w-full text-sm">` menjadi `<table class="heat-table in-heat w-full">`.

3b. Ubah tombol sel matriks (~978-988) agar memakai kelas heat konsisten (pertahankan `@click="filterByMatrixCell(b, row.label)"`, `:disabled`, dan kondisi `activeMatrixCell`):

```html
                                                <button
                                                    :disabled="!row.counts[bagianKey(b)]"
                                                    :class="[
                                                        'heat-cell c inline-flex h-8 w-8 items-center justify-center text-sm font-bold transition',
                                                        activeMatrixCell && activeMatrixCell.key === matrixCellKey(row.label, b)
                                                            ? 'bg-brand-600 text-white shadow-md ring-2 ring-brand-600/30'
                                                            : (row.counts[bagianKey(b)] >= 2 ? 'g' : (row.counts[bagianKey(b)] === 1 ? 'y' : 'text-slate-200'))
                                                    ]"
                                                    @click="filterByMatrixCell(b, row.label)">
                                                    {{ row.counts[bagianKey(b)] || '0' }}
                                                </button>
```

3c. Tambah legenda heat tepat setelah `</div>` penutup wrapper `overflow-x-auto` (~999), masih di dalam `lap-card` matriks:

```html
                            <div class="in-heat-legend px-3 pb-3">
                                <span><i class="dot" style="background:#ecfdf5;border:1px solid #a7f3d0"></i>2+ kegiatan</span>
                                <span><i class="dot" style="background:#fffbeb;border:1px solid #fde68a"></i>1 kegiatan</span>
                            </div>
```

- [ ] **Step 4: Run tests**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-template.test.js
git commit -m "style(laporan): satukan matriks bagian ke primitif heat"
```

---

### Task 5: Tab Berita Acara — band ringkasan `.in-basum` + kartu mobile

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html` (tab `v-if="activeTab === 'ba'"` ~1005-1178)
- Test: `new-code1-cf/test/detail-laporan-template.test.js`

**Interfaces:**
- Consumes: `.in-basum`(+`.b`/`.k`/`.n`/`.p`), `.in-cards`/`.in-mcard`/`.in-desktop-only`.
- Produces (markup): band 5 kartu di awal tab; wrapper tabel `in-desktop-only`; daftar `.in-cards`.

- [ ] **Step 1: Write the failing test**

```js
it('BA memakai band ringkasan basum dan kartu mobile', async () => {
  const html = await loadHtml();
  expect(html).toContain('class="in-basum"');
  expect(html).toContain('>BA Pelaksanaan</div>');
  expect(html).toContain('in-mcard');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js -t "BA memakai band ringkasan"`
Expected: FAIL.

- [ ] **Step 3: Implement**

3a. Sisipkan **band basum** tepat setelah `<template v-else>` awal tab BA (~1015), sebelum kartu filter:

```html
                        <div class="in-basum">
                            <div class="b"><div class="k">Kegiatan</div><div class="n">{{ baKegiatanRows.length }}</div><div class="p">baris kegiatan</div></div>
                            <div class="b"><div class="k">Peserta</div><div class="n">{{ baKegiatanPesertaTotal }}</div><div class="p">mahasiswa</div></div>
                            <div class="b"><div class="k">BA Pendukung</div><div class="n">{{ baKegiatanPendukungTotal }}</div><div class="p">sebelum keputusan</div></div>
                            <div class="b"><div class="k">BA Pelaksanaan</div><div class="n emerald">{{ baKegiatanPelaksanaanTotal }}</div><div class="p">setelah kegiatan</div></div>
                            <div class="b"><div class="k">Total BA</div><div class="n">{{ baKegiatanBaTotal }}</div><div class="p">pendukung + pelaksanaan</div></div>
                        </div>
```

3b. Tambah kelas `in-desktop-only` pada wrapper tabel BA (~1053 `<div class="overflow-x-auto">`).

3c. Sisipkan **kartu mobile** tepat setelah `</div>` penutup wrapper tabel (~1171), masih di dalam `lap-card` BA:

```html
                            <div class="in-cards">
                                <article v-for="r in baKegiatanRows" :key="'m-' + r.key" class="in-mcard cursor-pointer" @click="toggleExpand(r.key)">
                                    <div class="row1">
                                        <span class="font-semibold text-slate-800">{{ r.label }}</span>
                                        <span class="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{{ r.bagian }}</span>
                                    </div>
                                    <div class="kv"><span>Blok</span><b>{{ r.blok || '-' }}</b><span>Peserta</span><b>{{ (r.peserta || []).length }} mahasiswa</b><span>Biaya</span><b class="text-brand-700">{{ fmtRupiah(baKegiatanBiaya(r)) }}</b></div>
                                    <div v-if="expanded[r.key]" class="mt-2 border-t border-slate-100 pt-2 text-xs">
                                        <div class="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Peserta ({{ (r.peserta || []).length }})</div>
                                        <div v-for="(p, pi) in r.peserta" :key="pi" class="flex flex-wrap items-center gap-2 py-0.5">
                                            <span class="font-mono text-[10px] text-slate-400">{{ p.npm }}</span>
                                            <span class="font-semibold text-slate-700">{{ p.namaLengkap || '-' }}</span>
                                            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{{ p.statusPengajuan || '-' }}</span>
                                        </div>
                                        <div v-if="!(r.peserta || []).length" class="text-slate-400">Belum ada peserta.</div>
                                    </div>
                                    <div class="actions">
                                        <template v-for="(b, bi) in (r.baPendukung || [])" :key="'mp' + bi">
                                            <span class="achip pend">{{ b['BA ID'] }}<button class="mini-ic p" @click.stop="openKelolaBa(b['BA ID'], 'Admin')"><i class="bi bi-pencil text-[10px]"></i></button><button class="mini-ic x" @click.stop="deleteBaAdmin(b['BA ID'])"><i class="bi bi-x text-[10px]"></i></button></span>
                                        </template>
                                        <template v-for="(b, bi) in (r.baPelaksanaan || [])" :key="'ml' + bi">
                                            <span class="achip pel">{{ b['BA ID'] }}<button class="mini-ic p" @click.stop="openKelolaBa(b['BA ID'], 'Bagian')"><i class="bi bi-pencil text-[10px]"></i></button><button class="mini-ic x" @click.stop="deleteBaBagian(b['BA ID'])"><i class="bi bi-x text-[10px]"></i></button></span>
                                        </template>
                                        <button class="btn-soft" @click.stop="openRiwayat(r)"><i class="bi bi-clock-history"></i> Riwayat</button>
                                        <button class="btn-soft" @click.stop="toggleExpand(r.key)"><i class="bi bi-chevron-down"></i> Detail</button>
                                    </div>
                                </article>
                            </div>
```

Pertahankan seluruh kolom tabel, chip `{{ baKegiatanBaTotal }} BA total`, `progresDots`, `stageTooltip`, `openKelolaBa`, `deleteBaAdmin`, `deleteBaBagian`, `openRiwayat`, dan `exportBaTable` apa adanya.

- [ ] **Step 4: Run tests**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-template.test.js
git commit -m "style(laporan): selaraskan tab berita acara dengan mockup"
```

---

### Task 6: Tab Pembayaran — band 3 kartu + kartu mobile

**Files:**
- Modify: `new-code1-cf/public/detail-laporan.html` (tab `v-if="activeTab === 'bayar'"` ~1181-1298)
- Test: `new-code1-cf/test/detail-laporan-template.test.js`

**Interfaces:**
- Consumes: `.in-statrow .ic.*`, `.in-statrow .pct`, `.in-cards`/`.in-mcard`/`.in-desktop-only`.
- Produces: method `sharePct(n, d)`; band 3 kartu (Total Tagihan / Sudah Bayar / Belum Bayar); kartu mobile dengan rincian.

- [ ] **Step 1: Write the failing test**

```js
it('pembayaran memakai band kartu statistik dan kartu mobile', async () => {
  const html = await loadHtml();
  expect(html).toContain('sharePct');
  expect(html).toContain('>Total Tagihan</div>');
  expect(html).toContain('in-mcard');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js -t "pembayaran memakai band kartu"`
Expected: FAIL.

- [ ] **Step 3: Implement**

3a. Tambah method `sharePct` di objek `methods:` (dekat `vwInitials`):

```js
                sharePct(n, d) {
                    return d ? Math.round(((n || 0) / d) * 100) + '%' : '0%';
                },
```

3b. Sisipkan **band 3 kartu** tepat setelah `<template v-else>` awal tab Bayar (~1190), sebelum kartu filter:

```html
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div class="in-statrow lap-stat flex-col" style="align-items:flex-start;gap:6px">
                                <div class="top"><div class="ic indigo"><i class="bi bi-cash-stack"></i></div></div>
                                <div><div class="num text-sm">{{ fmtRupiah(pembayaranSummary.biaya) }}</div><div class="lbl uppercase tracking-wider">Total Tagihan</div></div>
                            </div>
                            <div class="in-statrow lap-stat flex-col" style="align-items:flex-start;gap:6px">
                                <div class="top"><div class="ic emerald"><i class="bi bi-check2-circle"></i></div><span class="pct">{{ sharePct(pembayaranSummary.sudah, pembayaranSummary.total) }}</span></div>
                                <div><div class="num">{{ pembayaranSummary.sudah }}</div><div class="lbl uppercase tracking-wider">Sudah Bayar</div></div>
                            </div>
                            <div class="in-statrow lap-stat flex-col" style="align-items:flex-start;gap:6px">
                                <div class="top"><div class="ic rose"><i class="bi bi-x-circle"></i></div><span class="pct">{{ sharePct(pembayaranSummary.belum, pembayaranSummary.total) }}</span></div>
                                <div><div class="num">{{ pembayaranSummary.belum }}</div><div class="lbl uppercase tracking-wider">Belum Bayar</div></div>
                            </div>
                        </div>
```

3c. Tambah kelas `in-desktop-only` pada wrapper tabel Bayar (~1238 `<div class="overflow-x-auto">`).

3d. Sisipkan **kartu mobile** tepat setelah `</div>` penutup wrapper tabel (~1295), masih di dalam `lap-card` Bayar:

```html
                            <div class="in-cards">
                                <article v-for="m in pembayaranFiltered" :key="'m-' + m.npm" class="in-mcard cursor-pointer" @click="toggleExpand('bayar:' + m.npm)">
                                    <div class="row1">
                                        <span class="font-semibold text-slate-800">{{ m.nama }}</span>
                                        <span :class="m.lunas ? 'in-badge acc' : (m.jumlahBukti ? 'in-badge wait' : 'in-badge cancel')">{{ m.jumlahBukti }}/{{ m.jumlahPengajuan }}</span>
                                    </div>
                                    <div class="kv"><span>NPM</span><b class="font-mono">{{ m.npm }}</b><span>Kegiatan</span><b>{{ m.jumlahPengajuan }}</b><span>Total Biaya</span><b class="text-brand-700">{{ fmtRupiah(m.totalBiaya) }}</b></div>
                                    <div v-if="expanded['bayar:' + m.npm]" class="mt-2 space-y-2 border-t border-slate-100 pt-2">
                                        <div v-for="(it, i) in m.items" :key="i" class="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <span class="font-semibold text-slate-800">{{ it.jenis }}</span>
                                                <span :class="statusBadgeCls(it.status)">{{ it.status }}</span>
                                                <span class="font-semibold text-teal-700">{{ fmtRupiah(it.biaya) }}</span>
                                            </div>
                                            <div class="mt-1 flex flex-wrap gap-2">
                                                <a v-if="it.linkBukti" :href="safeUrl(it.linkBukti)" target="_blank" rel="noopener noreferrer" class="btn-bukti" @click.stop><i class="bi bi-cash-coin"></i> Bukti Bayar</a>
                                                <a v-if="it.linkAcc" :href="safeUrl(it.linkAcc)" target="_blank" rel="noopener noreferrer" class="btn-acc" @click.stop><i class="bi bi-patch-check"></i> ACC INHAL</a>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="actions">
                                        <a v-if="bayarBuktiUrl(m)" :href="safeUrl(bayarBuktiUrl(m))" target="_blank" rel="noopener noreferrer" class="btn-bukti" @click.stop><i class="bi bi-cash-coin"></i> Bukti</a>
                                        <button class="btn-soft" @click.stop="toggleExpand('bayar:' + m.npm)"><i class="bi bi-chevron-down"></i> Rincian</button>
                                    </div>
                                </article>
                            </div>
```

Pertahankan filter (q/status/kelengkapan), `m.statuses`, `bayarBuktiUrl(m)`, dan ekspor 2 sheet apa adanya.

- [ ] **Step 4: Run tests**

Run: `cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/detail-laporan.html new-code1-cf/test/detail-laporan-template.test.js
git commit -m "style(laporan): selaraskan tab pembayaran dengan mockup"
```

---

### Task 7: QA, suite penuh, verifikasi preview, deploy

**Files:**
- Test: seluruh `new-code1-cf/test/`

- [ ] **Step 1: Full suite**

Run: `cd new-code1-cf && npx vitest run`
Expected: PASS semua (49 file). Ulangi sekali bila flake env.

- [ ] **Step 2: Verifikasi utilitas Tailwind arbitrary**

Pastikan kelas utility yang dipakai markup baru sudah ter-definisi (definisikan manual bila perlu):

```bash
cd new-code1-cf && npx vitest run test/detail-laporan-template.test.js
```

Periksa manual: `text-[10px]`, `text-[10.5px]`, `bg-brand-50`, `text-brand-700`, `gap-[5px]`, `tracking-wider` — jika belum ter-compile, tambahkan definisi ke blok `<style>` dan tambahkan guard test.

- [ ] **Step 3: Preview desktop & mobile**

Jalankan dev server (skill `deploy-website`) dan bandingkan `/detail-laporan` tiap tab pada lebar <1023px dan >=1024px dengan `mockups/pengajuan-v2/laporan-detail.html`:
- Rekap: page-intro, badge pct, chip bertitik, avatar+docdot, kartu mobile.
- Dosen: chart BA per dosen, legenda heat.
- Bagian: matriks heat konsisten + legenda.
- BA: band basum + kartu mobile + `progresDots` utuh.
- Bayar: band 3 kartu + kartu mobile.
- Tidak ada error console; tidak ada fitur produksi yang hilang (kolom Aksi, ekspor, drill-down).

- [ ] **Step 4: Deploy**

```bash
cd new-code1-cf
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy --config ./wrangler.toml
```

Verifikasi `/detail-laporan` produksi (byte-identik lokal via `curl -s | shasum -a 256`).

---

## Self-Review

**Spec coverage:**
- Lapisan visual (§4) → Task 1.
- Rekap (§5.1) → Task 2.
- Dosen (§5.2) → Task 3.
- Bagian (§5.3) → Task 4.
- BA (§5.4) → Task 5.
- Pembayaran (§5.5) → Task 6.
- Pengujian & deploy (§7) → tiap task + Task 7.

**Placeholder scan:** tidak ada TODO/TBD; nilai CSS lengkap; markup perubahan ditulis.

**Type consistency:** Nama `in-*` konsisten; `summaryCards().pct`/`tint` dipakai Task 2; `statusChips` didefinisikan & dipakai Task 2; `vwInitials`/`vwAvatarColor` didefinisikan Task 2 & hanya dipakai Rekap; `dosenBaBars` didefinisikan Task 3 & hanya dipakai Dosen; `sharePct` didefinisikan Task 6 & hanya dipakai Bayar.

**Risiko:** Task 2 & Task 5 paling besar (penambahan kartu mobile) — wajib review + verifikasi visual. Task 4 mengubah warna sel matriks Bagian (b/y/g) — verifikasi makna tetap (2+ / 1).
