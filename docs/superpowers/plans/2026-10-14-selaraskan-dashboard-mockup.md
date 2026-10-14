# Selaraskan Visual Dashboard ke Mockup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan seluruh tab `dashboard.html` tampil setara dengan mockup redesain, tanpa menghapus kemampuan produksi.

**Architecture:** Satu file statis Vue 3 (`new-code1-cf/public/dashboard.html`). Semua gaya ditambahkan ke blok `<style>` khusus (tanpa build, tanpa CDN baru). Setiap tab di-restyle dengan primitif kelas `in-*` yang meniru mockup `mockups/pengajuan-v2/index.html`; struktur seksi mengikuti mockup, sedangkan data/binding/perilaku produksi tidak berubah.

**Tech Stack:** HTML statis + Vue 3 (in-page), Tailwind precompiled (kelas ditulis manual), Vitest (`@cloudflare/vitest-pool-workers`) untuk guard template.

## Global Constraints

- Prinsip: **look mockup, fitur produksi tetap**. Urutan/gaya seksi ikut mockup; jangan hapus kemampuan produksi.
- Tidak menambah interaksi baru (kartu statistik non-klik; tanpa tombol "Muat Ulang"; tanpa tambah/hapus Lab).
- Tidak mengubah nama field, computed, method, atau teks berbahasa Indonesia yang sudah ada.
- Nilai CSS primitif disalin **verbatim** dari `mockups/pengajuan-v2/index.html`; tanpa CSS bersama (definisi hanya di `dashboard.html`).
- Tanpa langkah build; tanpa CDN baru.
- Jangan hapus/rename kelas yang di-assert tes: `.dash-card`, `.dash-stat`, `.dash-table`, `.master-table`, `.master-table-dense`, `.ba-cards`, `.ba-pair`, `.heat-table`, `.heat-cell`, `.heat-scroll`, `.btn-soft`, `.btn-primary`, `.check`, dan semua `in-*` lama.
- Tes: `cd new-code1-cf && npx vitest run <file>`; flake env `Network connection lost` boleh diulang sekali.
- Deploy wajib dari `new-code1-cf/`: `CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy --config ./wrangler.toml`.
- Base commit plan: `76e942c`.

---

### Task 1: Primitif CSS lanjutan `in-*`

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (blok `<style>` khusus, sisipkan setelah aturan `.in-statrow` terakhir ~line 333)
- Test: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Produces (kelas CSS): `.in-pageintro`, `.in-avatar`, `.in-celluser`, `.in-docdot`(+`.on.surat`/`.on.acc`/`.on.bukti`), `.in-cards`, `.in-mcard`, `.in-proc`(+`.p`/`.p2`/`.n`/`.t`/`.s`/`.arrow`), `.in-basum`(+`.b`/`.k`/`.n`/`.p`), `.in-heat-legend`(+`.dot`), `.in-manual-note`.

- [ ] **Step 1: Write the failing test**

Tambahkan `it(...)` baru di dalam `describe('dashboard template', ...)`:

```js
it('primitif in-* lanjutan mockup tersedia', async () => {
  const html = await loadDashboardHtml();
  for (const s of ['.in-pageintro {', '.in-avatar {', '.in-celluser {', '.in-docdot {',
    '.in-docdot.on.bukti {', '.in-cards {', '.in-mcard {', '.in-proc {', '.in-basum {',
    '.in-heat-legend {', '.in-manual-note {']) {
    expect(html).toContain(s);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "primitif in-* lanjutan"`
Expected: FAIL (`.in-pageintro {` belum ada).

- [ ] **Step 3: Add the CSS**

Sisipkan blok berikut ke `<style>` khusus `dashboard.html` (setelah `.in-statrow` terakhir):

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
        .in-cards { display:flex; flex-direction:column; gap:12px; padding:12px; }
        @media (min-width:768px){ .in-cards { display:none; } }
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
        .in-heat-legend { display:flex; gap:12px; font-size:11px; color:var(--ink-500); margin-top:10px; }
        .in-heat-legend .dot { width:9px; height:9px; border-radius:99px; display:inline-block; margin-right:4px; }
        .in-manual-note { display:flex; align-items:center; gap:8px; background:var(--violet-soft); color:var(--violet); border-radius:12px; padding:12px; font-size:12.5px; font-weight:600; margin-bottom:16px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "primitif in-* lanjutan"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "style(dashboard): primitif in-* lanjutan dari mockup"
```

---

### Task 2: Tab Pengajuan — kartu statistik, chip, filter, tabel, kartu mobile

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (tab `v-if="tab==='pengajuan'"` ~521-640; computed `statusChips` ~2289)
- Test: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Consumes: primitif Task 1 + primitif lama (`in-statrow`, `in-chip`, `in-tbl`, `in-toolbar`, `in-input`, `in-badge`, `in-celluser`, `in-avatar`, `in-docdot`, `in-cards`, `in-mcard`).
- Produces (markup): baris `in-statrow` 5 kartu di tab Pengajuan; sel Berkas memakai `.in-docdot`; daftar mobile `.in-cards`/`.in-mcard`. Computed baru `pengajuanStatCards` (array `{label,num,icon,tint,color}` 5 item).

- [ ] **Step 1: Write the failing test**

```js
it('pengajuan memakai kartu statistik, avatar, docdot, kartu mobile', async () => {
  const html = await loadDashboardHtml();
  expect(html).toContain('in-statrow dash-stat flex-col');
  expect(html).toContain('in-celluser');
  expect(html).toContain('in-avatar');
  expect(html).toContain('in-docdot');
  expect(html).toContain('in-mcard');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "kartu statistik, avatar, docdot"`
Expected: FAIL.

- [ ] **Step 3: Implement**

3a. Tambah computed `pengajuanStatCards()` (setelah `statusChips`):

```js
pengajuanStatCards() {
    const s = this.stats.perStatus || {};
    return [
        { label: 'Total', num: this.stats.total || 0, icon: 'bi-inbox', tint: 'indigo', color: '#4f46e5' },
        { label: 'Menunggu', num: s.Menunggu || 0, icon: 'bi-hourglass-split', tint: 'amber', color: '#d97706' },
        { label: 'Diterima', num: s.Diterima || 0, icon: 'bi-check2', tint: 'sky', color: '#0284c7' },
        { label: 'ACC', num: s.ACC || 0, icon: 'bi-patch-check', tint: 'emerald', color: '#059669' },
        { label: 'Ditolak', num: s.Ditolak || 0, icon: 'bi-x-lg', tint: 'rose', color: '#e11d48' }
    ];
},
pengajuanInitials(n) {
    const p = String(n || '').trim().split(/\s+/);
    return ((p[0] || '')[0] || '').toUpperCase() + ((p[1] || '')[0] || '').toUpperCase();
},
pengajuanAvatarColor(n) {
    const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#e11d48', '#8b5cf6', '#14b8a6', '#f97316'];
    let h = 0; const s = String(n || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return colors[h % colors.length];
}
```

3b. Sisipkan baris kartu statistik tepat setelah blok header (setelah `</div>` penutup header actions, ~line 532), sebelum blok chip:

```html
<div class="mb-[18px] grid grid-cols-2 gap-[14px] sm:grid-cols-3 lg:grid-cols-5">
    <div v-for="c in pengajuanStatCards" :key="c.label" class="in-statrow dash-stat flex-col" style="align-items:flex-start;gap:6px">
        <div class="ic" :class="c.tint"><i :class="c.icon" :style="{color:c.color}"></i></div>
        <div class="num">{{ c.num }}</div>
        <div class="lbl">{{ c.label }}</div>
    </div>
</div>
```

3c. Chip: tambahkan titik warna. Ubah `statusChips` agar menyertakan `dot`, lalu render:

```js
statusChips() {
    const s = this.stats.perStatus || {};
    const map = { '': '#64748b', 'Menunggu': '#d97706', 'Diterima': '#0284c7', 'ACC': '#059669', 'Ditolak': '#e11d48', 'Dibatalkan': '#64748b' };
    return [
        { key: '', label: 'Semua', count: this.stats.total || 0, dot: map[''] },
        { key: 'Menunggu', label: 'Menunggu', count: s.Menunggu || 0, dot: map['Menunggu'] },
        { key: 'Diterima', label: 'Diterima', count: s.Diterima || 0, dot: map['Diterima'] },
        { key: 'ACC', label: 'ACC', count: s.ACC || 0, dot: map['ACC'] },
        { key: 'Ditolak', label: 'Ditolak', count: s.Ditolak || 0, dot: map['Ditolak'] },
        { key: 'Dibatalkan', label: 'Dibatalkan', count: s.Dibatalkan || 0, dot: map['Dibatalkan'] }
    ];
},
```

Chip markup (~536):

```html
<button v-for="c in statusChips" :key="c.key" @click="setStatusChip(c.key)"
        :class="filters.status===c.key ? 'in-chip is-active' : 'in-chip'"
        class="transition">
    <span class="dot" :style="{background:c.dot}"></span>{{ c.label }}
    <span class="opacity-70">{{ c.count }}</span>
</button>
```

3d. Tabel: ganti `<thead>` dan `<tbody>` tab Pengajuan agar kolom = checkbox | Mahasiswa | Kegiatan | Tanggal Daftar | Status | Berkas | Aksi:

```html
<thead>
    <tr>
        <th class="w-10 px-4 py-3"><input type="checkbox" class="check" :checked="allChecked" @change="toggleAll"></th>
        <th class="px-4 py-3 font-semibold">Mahasiswa</th>
        <th class="px-4 py-3 font-semibold">Kegiatan</th>
        <th class="px-4 py-3 font-semibold">Tanggal Daftar</th>
        <th class="px-4 py-3 font-semibold">Status</th>
        <th class="px-4 py-3 font-semibold">Berkas</th>
        <th class="px-4 py-3 font-semibold text-right">Aksi</th>
    </tr>
</thead>
<tbody>
    <tr v-for="r in pengajuanRows" :key="r['ID Pengajuan']"
        class="cursor-pointer transition hover:bg-slate-50/80"
        :class="r['ID Pengajuan']===manualHighlightId ? 'bg-brand-50/70 ring-2 ring-inset ring-brand-400' : ''"
        @click="openDetail(r['ID Pengajuan'])">
        <td class="px-4 py-2.5" @click.stop><input type="checkbox" class="check" v-model="r.checked"></td>
        <td class="px-4 py-2.5">
            <div class="in-celluser">
                <div class="in-avatar" :style="{background:pengajuanAvatarColor(r['Nama Lengkap'])}">{{ pengajuanInitials(r['Nama Lengkap']) }}</div>
                <div>
                    <div class="font-semibold text-slate-800">{{ r['Nama Lengkap'] }}
                        <span v-if="isManual(r)" class="ml-1.5 in-badge" style="background:var(--violet-soft);color:var(--violet)"><i class="bi bi-pencil-square"></i>Manual</span>
                    </div>
                    <div class="font-mono text-xs text-slate-400">{{ r.NPM }}</div>
                </div>
            </div>
        </td>
        <td class="px-4 py-2.5"><div class="font-semibold text-slate-700">{{ r['Jenis Kegiatan'] }}</div><div class="text-xs text-slate-400">{{ r.Blok }}</div></td>
        <td class="px-4 py-2.5 text-slate-500">{{ formatTanggal(r.Timestamp) }}</td>
        <td class="px-4 py-2.5"><span :class="statusBadge(r.Status)">{{ r.Status }}</span></td>
        <td class="px-4 py-2.5">
            <div class="flex gap-[5px]">
                <a v-if="r['Link Bukti Bayar']" :href="safeUrl(r['Link Bukti Bayar'])" target="_blank" rel="noopener noreferrer" class="in-docdot on bukti" title="Bukti Bayar" @click.stop><i class="bi bi-cash-coin"></i></a>
                <a v-if="r['Link Final']" :href="safeUrl(r['Link Final'])" target="_blank" rel="noopener noreferrer" class="in-docdot on surat" title="Berkas Final" @click.stop><i class="bi bi-file-earmark-text"></i></a>
            </div>
        </td>
        <td class="px-4 py-2.5 text-right" @click.stop>
            <div class="flex justify-end gap-1">
                <button class="rounded-lg p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-brand-600" title="Buka detail" @click="openDetail(r['ID Pengajuan'])"><i class="bi bi-eye text-sm"></i></button>
                <button class="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" title="Hapus pengajuan" @click="deletePengajuanRow(r)"><i class="bi bi-trash text-sm"></i></button>
            </div>
        </td>
    </tr>
</tbody>
```

3e. Tambah daftar kartu mobile setelah `</div>` tabel (sebelum `</div>` penutup dash-card):

```html
<div class="in-cards">
    <div v-for="r in pengajuanRows" :key="'m-'+r['ID Pengajuan']" class="in-mcard cursor-pointer" @click="openDetail(r['ID Pengajuan'])">
        <div class="row1">
            <span class="font-semibold text-slate-800">{{ r['Nama Lengkap'] }}</span>
            <span :class="statusBadge(r.Status)">{{ r.Status }}</span>
        </div>
        <div class="kv"><span>NPM</span><b class="font-mono">{{ r.NPM }}</b><span>Kegiatan</span><b>{{ r['Jenis Kegiatan'] }} - {{ r.Blok }}</b><span>Terdaftar</span><b>{{ formatTanggal(r.Timestamp) }}</b></div>
        <div class="actions"><button class="btn-soft" @click.stop="openDetail(r['ID Pengajuan'])"><i class="bi bi-eye"></i> Detail</button></div>
    </div>
</div>
```

- [ ] **Step 4: Run tests**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "style(dashboard): selaraskan tab pengajuan dengan mockup"
```

---

### Task 3: Tab Manual — 4 panel + catatan

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (tab `v-if="tab==='manual'"` ~643-821)
- Test: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Consumes: `.in-manual-note` (Task 1).

- [ ] **Step 1: Write the failing test**

```js
it('manual memakai panel terpisah dan catatan email', async () => {
  const html = await loadDashboardHtml();
  expect(html).toContain('in-manual-note');
  expect(html).toContain('Identitas Mahasiswa');
  expect(html).toContain('Notifikasi email tidak dikirim');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "manual memakai panel"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Bagi isi kartu form menjadi panel-panel `dash-card` terpisah dengan `panel-head`, tanpa mengubah input/binding:
- Panel 1 header "Identitas Mahasiswa" (sub: "Nama terisi otomatis dari NPM.").
- Panel 2 header "Detail Kegiatan" (field jenis/bidang tetap).
- Panel 3 header "Keterangan".
- Panel 4 header "Aksi" (Status Awal + tombol Reset, Simpan).

Tambahkan `div.in-manual-note` di atas panel 1:

```html
<div class="in-manual-note"><i class="bi bi-envelope-slash"></i> Notifikasi email tidak dikirim untuk pengajuan manual.</div>
```

Pertahankan semua `v-model`, `@blur`, `<input type="file">`, `manual.saving`, dan validasi apa adanya; hanya wrapper layout yang berubah.

- [ ] **Step 4: Run tests**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "style(dashboard): pecah form manual jadi panel sesuai mockup"
```

---

### Task 4: Tab Statistik — selaraskan kartu & bar

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (tab statistik ~836-1000)
- Test: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Consumes: `.in-statrow` (ada), `in-bar-track`/`in-bar-fill` (ada).

- [ ] **Step 1: Write the failing test**

```js
it('statistik memakai primitif bar konsisten', async () => {
  const html = await loadDashboardHtml();
  expect(html).toContain('in-bar-track');
  expect(html).toContain('in-statrow dash-stat flex-col');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "statistik memakai primitif bar"`
Expected: FAIL jika bar belum `in-bar-track` (Task 1/3 sebelumnya sudah ada `in-bar-*`; jika sudah lulus, tetap jalankan untuk baseline).

- [ ] **Step 3: Implement**

- Pastikan grid kartu memakai `in-statrow dash-stat flex-col` (konsisten dengan tab Pengajuan).
- Ganti wrapper bar menjadi `.in-bar-track` + `.in-bar-fill g/y/r` (bila belum).
- Selaraskan spacing label/nilai (w-36→label, h-2.5→track). Jangan ubah `barsOf`, `totalTrend`, atau data lain.

- [ ] **Step 4: Run tests**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "style(dashboard): selaraskan kartu & bar statistik"
```

---

### Task 5: Tab Berita Acara — banner proses, ringkasan, legenda heat

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (tab BA ~887-1142)
- Test: `new-code1-cf/test/dashboard-template.test.js`

**Interfaces:**
- Consumes: `.in-proc`, `.in-basum`, `.in-heat-legend` (Task 1), `.in-bar-track`/`.in-bar-fill`, `.in-heat` (ada).

- [ ] **Step 1: Write the failing test**

```js
it('BA memakai banner proses, ringkasan basum, legenda heat', async () => {
  const html = await loadDashboardHtml();
  expect(html).toContain('in-proc');
  expect(html).toContain('in-basum');
  expect(html).toContain('in-heat-legend');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "BA memakai banner proses"`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Sisipkan banner proses di atas kartu ringkasan (teks statis):

```html
<div class="in-proc">
    <div class="p"><div class="n">1</div><div><div class="t">BA Pendukung</div><div class="s">Diunggah admin tiap bagian</div></div></div>
    <div class="arrow"><i class="bi bi-arrow-right"></i></div>
    <div class="p p2"><div class="n">2</div><div><div class="t">BA Pelaksanaan</div><div class="s">Diunggah setelah kegiatan selesai</div></div></div>
</div>
```

- Ubah wrapper kartu ringkasan `.ba-cards` agar memakai gaya `.in-basum`/`.b` (pertahankan 5 metrik & `setBagianChip` pada kartu Kegiatan).
- Tambah legenda heat di bawah matriks:

```html
<div class="in-heat-legend">
    <span><span class="dot" style="background:#10b981"></span>Lengkap</span>
    <span><span class="dot" style="background:#fbbf24"></span>Sebagian</span>
    <span><span class="dot" style="background:#e2e8f0"></span>Belum</span>
</div>
```

Pertahankan tabel BA, filter/chip, expand, sortir, orphan, dan `bagianHeatmap` apa adanya.

- [ ] **Step 4: Run tests**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "style(dashboard): selaraskan tab berita acara dengan mockup"
```

---

### Task 6: Tab Master — grid & gaya kartu

**Files:**
- Modify: `new-code1-cf/public/dashboard.html` (tab master ~1394-1614)
- Test: `new-code1-cf/test/dashboard-template.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('master memakai grid kartu gaya mockup', async () => {
  const html = await loadDashboardHtml();
  expect(html).toContain('master-grid');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js -t "master memakai grid kartu"`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Tambah kelas `master-grid` pada wrapper grid kartu master dan atur kolom agar setara mockup (5 kolom desktop): `grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 master-grid`.
- Restyle kartu ke gaya mockup (`.in-statrow`-style: ikon 34px brand-soft, label aktif brand). Pertahankan 10 kartu, `selectMaster`/`activeMasterCard`, dan semua tabel body (kolom produksi tidak dihapus).

- [ ] **Step 4: Run tests**

Run: `cd new-code1-cf && npx vitest run test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add new-code1-cf/public/dashboard.html new-code1-cf/test/dashboard-template.test.js
git commit -m "style(dashboard): selaraskan tab master dengan mockup"
```

---

### Task 7: QA, suite penuh, verifikasi preview, deploy

**Files:**
- Test: seluruh `new-code1-cf/test/`

- [ ] **Step 1: Full suite**

Run: `cd new-code1-cf && npx vitest run`
Expected: PASS semua (49 file). Ulangi sekali bila flake env.

- [ ] **Step 2: Preview desktop & mobile**

Jalankan dev server (skill `deploy-website`) dan bandingkan `/dashboard` tiap tab pada lebar <768px dan >=1024px dengan `mockups/pengajuan-v2/index.html`:
- Pengajuan: baris kartu statistik, chip bertitik, tabel kolom mockup, kartu mobile.
- Manual: 4 panel + catatan.
- BA: banner proses, kartu ringkasan, legenda heat.
- Tidak ada error console; tidak ada fitur produksi yang hilang.

- [ ] **Step 3: Deploy**

```bash
cd new-code1-cf
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy --config ./wrangler.toml
```

---

## Self-Review

**Spec coverage:**
- Lapisan visual (§4) → Task 1.
- Pengajuan (§5.1) → Task 2.
- Manual (§5.2) → Task 3.
- Statistik (§5.3) → Task 4.
- BA (§5.4) → Task 5.
- Master (§5.5) → Task 6.
- Pengujian & deploy (§7) → tiap task + Task 7.

**Placeholder scan:** tidak ada TODO/TBD; nilai CSS lengkap; markup perubahan ditulis.

**Type consistency:** Nama `in-*` konsisten; `pengajuanStatCards`, `pengajuanInitials`, `pengajuanAvatarColor` didefinisikan di Task 2 dan hanya dipakai di Task 2; `statusChips` diperluas dengan `dot` (dipakai hanya di tab Pengajuan).

**Risiko:** Task 2 paling besar (restruktur tabel) — wajib review + verifikasi visual.
