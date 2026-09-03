# Optimasi Kecepatan Loading `detail-laporan.html` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mempercepat & membuat transparan waktu muat halaman `detail-laporan.html` lewat optimasi server (hapus O(n×m)), pengukuran waktu yang ditampilkan, dan skeleton per tab.

**Architecture:** Optimasi server dilakukan di `getLaporanBootstrap` (`1_business.gs`) dengan mengganti loop-filter `details`/`history` per pengajuan menjadi index-map sekali-bangun. Sisi client (`detail-laporan.html`): `loadData()` mencatat durasi via `performance.now()` ke `loadTimeMs`, badge waktu muncul di hero, overlay full-screen diganti skeleton inline per tab, dan tag `<script src="vue...">` diberi `defer`. Semua hasil output dijamin identik dengan sebelumnya.

**Tech Stack:** Google Apps Script (server), Vue 3 CDN + Tailwind inline (client).

## Global Constraints

- Hanya dua file yang diubah: `new-code1/1_business.gs` (hanya fungsi `getLaporanBootstrap`) dan `new-code1/pages/detail-laporan.html`.
- `0_code.gs`, `dashboard.html`, `bagian.html`, `index.html`, `portal.html`, dan fungsi GAS lain TIDAK diubah.
- Output `getLaporanBootstrap` harus identik (struktur, isi, urutan) sebelum vs sesudah optimasi — khususnya `details`/`history` per pengajuan dan array kosong untuk pengajuan tanpa data.
- Semua kelas CSS skeleton menggunakan Tailwind yang SUDAH ada di halaman (`animate-pulse`, `bg-slate-200/70`, `rounded-*`, `space-y-*`). Tidak menambah kelas baru.
- Tidak ada cache klien baru; tidak ada endpoint GAS baru; bentuk payload `getLaporanBootstrap` tidak berubah.

---

### Task 1: Optimasi server — hilangkan O(n×m) di `getLaporanBootstrap`

**Files:**
- Modify: `new-code1/1_business.gs:1553-1594` (blok pembacaan data + loop `rows.map`)

**Interfaces:**
- Consumes: `getAllRows(sheetName)` (sudah ada), `_clientRow(obj)` (sudah ada), `_resolveBiayaForPengajuan`, `formatRupiah`, `_getBiayaMap`, `_getBaPesertaMap` — semua sudah ada, tidak diubah.
- Produces: `getLaporanBootstrap(token)` — kontrak respons TIDAK berubah; hanya implementasi internal yang dioptimasi.

- [ ] **Step 1: Lihat kode saat ini yang akan diubah**

Buka `new-code1/1_business.gs:1551-1594`. Kode saat ini:

```js
function getLaporanBootstrap() {
    requireAuthorized(arguments[arguments.length - 1]);
    const pengajuan = getAllRows('Pengajuan');
    const details = getAllRows('DetailKegiatan');
    const histories = getAllRows('StatusHistory');
    const ba = getAllRows('BeritaAcara');
    const biayaMap = _getBiayaMap();
    const baPesertaMap = _getBaPesertaMap();

    let totalPendaftar = 0;
    let totalDiterima = 0;
    let totalDitolak = 0;
    let totalMenunggu = 0;
    let totalAcc = 0;
    let totalBiaya = 0;
    const perJenis = {};
    const perBlok = {};
    const perStatus = {};

    const rows = pengajuan.map(function(p) {
        const id = String(p['ID Pengajuan'] || '').trim();
        const status = String(p.Status || '').trim();
        totalPendaftar++;
        if (status === 'Diterima') totalDiterima++;
        if (status === 'Ditolak') totalDitolak++;
        if (status === 'Menunggu') totalMenunggu++;
        if (status === 'ACC') totalAcc++;
        perStatus[status || 'Lainnya'] = (perStatus[status || 'Lainnya'] || 0) + 1;
        const jenis = String(p['Jenis Kegiatan'] || 'Lainnya').trim();
        perJenis[jenis] = (perJenis[jenis] || 0) + 1;
        const blok = String(p.Blok || '-').trim();
        perBlok[blok] = (perBlok[blok] || 0) + 1;

        const pengajuanCopy = _clientRow(p);
        pengajuanCopy.Biaya = _resolveBiayaForPengajuan(pengajuanCopy, biayaMap);
        pengajuanCopy['Biaya Rupiah'] = formatRupiah(pengajuanCopy.Biaya);
        totalBiaya += pengajuanCopy.Biaya;

        return {
            pengajuan: pengajuanCopy,
            details: details.filter(function(d) { return String(d['ID Pengajuan'] || '').trim() === id; }).map(function(d) { return _clientRow(d); }),
            history: histories.filter(function(h) { return String(h['ID Pengajuan'] || '').trim() === id; }).map(function(h) { return _clientRow(h); })
        };
    });
```

- [ ] **Step 2: Tambah index-map dan ganti loop**

Di `new-code1/1_business.gs`, segera setelah `const baPesertaMap = _getBaPesertaMap();` tambahkan dua index-map:

```js
    const detailById = {};
    details.forEach(function(d) {
        const k = String(d['ID Pengajuan'] || '').trim();
        if (!detailById[k]) detailById[k] = [];
        detailById[k].push(d);
    });
    const historyById = {};
    histories.forEach(function(h) {
        const k = String(h['ID Pengajuan'] || '').trim();
        if (!historyById[k]) historyById[k] = [];
        historyById[k].push(h);
    });
```

Ganti blok `return { ... }` di dalam `rows.map` menjadi:

```js
        return {
            pengajuan: pengajuanCopy,
            details: (detailById[id] || []).map(function(d) { return _clientRow(d); }),
            history: (historyById[id] || []).map(function(h) { return _clientRow(h); })
        };
```

Urutan elemen dalam `detailById[id]` adalah urutan baris asli `details` (karena `push` berurutan), sehingga output identik.

- [ ] **Step 3: Verifikasi sintaks file GAS**

Jalankan ekstraksi validasi. Karena `1_business.gs` menggunakan sintaks Apps Script (mirip JS ES5), gunakan checker:

```bash
mkdir -p /tmp/opencode/check
cp new-code1/1_business.gs /tmp/opencode/check/business.gs.js
sed -i 's/^function /async function /; ' /tmp/opencode/check/business.gs.js 2>/dev/null || true
node --check /tmp/opencode/check/business.gs.js
```

Expected: exit 0 tanpa output. (Jika `node --check` melaporkan error sintaks dari konstruksi non-ES5 di file lain, abaikan — hanya pastikan tidak ada error di area `getLaporanBootstrap`. Jika checker gagal total karena fitur non-Node, lanjut ke Step 4 yang memvalidasi logika dengan harness.)

- [ ] **Step 4: Simulasikan output lama vs baru (harness Node)**

Buat `/tmp/opencode/check/harness_laporan.cjs` dengan fixture kecil:

```js
const _clientRow = (r) => Object.assign({}, r);

function buildOld(pengajuan, details, histories) {
    return pengajuan.map(function(p) {
        const id = String(p['ID Pengajuan'] || '').trim();
        return {
            pengajuan: _clientRow(p),
            details: details.filter(function(d) { return String(d['ID Pengajuan'] || '').trim() === id; }).map(function(d) { return _clientRow(d); }),
            history: histories.filter(function(h) { return String(h['ID Pengajuan'] || '').trim() === id; }).map(function(h) { return _clientRow(h); })
        };
    });
}

function buildNew(pengajuan, details, histories) {
    const detailById = {};
    details.forEach(function(d) {
        const k = String(d['ID Pengajuan'] || '').trim();
        if (!detailById[k]) detailById[k] = [];
        detailById[k].push(d);
    });
    const historyById = {};
    histories.forEach(function(h) {
        const k = String(h['ID Pengajuan'] || '').trim();
        if (!historyById[k]) historyById[k] = [];
        historyById[k].push(h);
    });
    return pengajuan.map(function(p) {
        const id = String(p['ID Pengajuan'] || '').trim();
        return {
            pengajuan: _clientRow(p),
            details: (detailById[id] || []).map(function(d) { return _clientRow(d); }),
            history: (historyById[id] || []).map(function(h) { return _clientRow(h); })
        };
    });
}

const pengajuan = [
    { 'ID Pengajuan': 'P1', Status: 'Diterima' },
    { 'ID Pengajuan': 'P2', Status: 'Menunggu' },
    { 'ID Pengajuan': ' P1 ', Status: 'ACC' }
];
const details = [
    { 'ID Pengajuan': 'P1', Kegiatan: 'A' },
    { 'ID Pengajuan': 'P2', Kegiatan: 'B' },
    { 'ID Pengajuan': 'P3', Kegiatan: 'C' }
];
const histories = [
    { 'ID Pengajuan': 'P2', Status: 'x' },
    { 'ID Pengajuan': 'P1', Status: 'y' }
];

const oldOut = buildOld(pengajuan, details, histories);
const newOut = buildNew(pengajuan, details, histories);
if (JSON.stringify(oldOut) !== JSON.stringify(newOut)) {
    console.error('MISMATCH');
    console.error('old:', JSON.stringify(oldOut));
    console.error('new:', JSON.stringify(newOut));
    process.exit(1);
}
if (newOut[2].details.length !== 1 || newOut[2].details[0].Kegiatan !== 'A') {
    console.error('FAIL: trim/id lookup untuk P1 (dengan spasi) tidak benar');
    process.exit(1);
}
console.log('OK: output identik, lookup trim benar');
```

Jalankan:

```bash
node /tmp/opencode/check/harness_laporan.cjs
```

Expected: `OK: output identik, lookup trim benar` dan exit 0.

- [ ] **Step 5: Commit**

```bash
git add new-code1/1_business.gs
git commit -m "perf(laporan): build detail/history index-map in getLaporanBootstrap to avoid O(n*m)"
```

---

### Task 2: Client — ukur waktu muat & tampilkan badge di hero

**Files:**
- Modify: `new-code1/pages/detail-laporan.html:806` (data `loading: false` → tambah `loadTimeMs`), `:1461-1487` (`loadData`), `:129-131` (badge di hero), `:1622-1624` (`mounted` — tidak diubah, hanya cek)

**Interfaces:**
- Consumes: `performance.now()` (Web API), state `loadTimeMs` (baru), method `loadData()` (sudah ada).
- Produces: state `this.loadTimeMs` (number ms atau `0`); badge hero yang tampil saat `loadTimeMs > 0`; `console.time('getLaporanBootstrap')` / `console.timeEnd` di `loadData`.

- [ ] **Step 1: Tambah state `loadTimeMs`**

Di `new-code1/pages/detail-laporan.html`, dalam `data() return { ... }` pada baris `loading: false,` tambahkan tepat setelahnya:

```js
                    loading: false,
                    loadTimeMs: 0,
```

- [ ] **Step 2: Tambahkan timing di `loadData`**

Buka `loadData()` (sekitar baris 1461). Ganti blok `async loadData() { ... }` menjadi:

```js
                async loadData() {
                    this.loading = true;
                    const t0 = performance.now();
                    console.time('getLaporanBootstrap');
                    try {
                        const data = await this.run('getLaporanBootstrap');
                        this.summary = data.summary || {};
                        this.rows = data.rows || [];
                        this.beritaAcara = data.beritaAcara || [];
                        this.dosen = data.dosen || [];
                        this.blok = data.blok || [];
                        this.bagian = data.bagian || { categories: [], labs: [] };
                        this.expanded = {};
                        this.activeDosenCell = null;
                        this.activeMatrixCell = null;
                        this.animateNumbers();
                        this.animateCharts();
                        this.loadTimeMs = Math.round(performance.now() - t0);
                    } catch (e) {
                        this.summary = {};
                        this.rows = [];
                        this.beritaAcara = [];
                        this.dosen = [];
                        this.blok = [];
                        this.bagian = { categories: [], labs: [] };
                        this.showToast('bi-x-circle', 'Gagal memuat data: ' + (e || 'Terjadi kesalahan.'));
                    } finally {
                        this.loading = false;
                    }
                },
```

Setelah `try/catch/finally` selesai (tepat sebelum `},` penutup method), tambahkan di dalam `finally` sebelum `this.loading = false;`:

```js
                    } finally {
                        this.loading = false;
                        console.timeEnd('getLaporanBootstrap');
                    }
```

(Simplenya: `loadData` berakhir dengan `finally { this.loading = false; console.timeEnd('getLaporanBootstrap'); }`.)

- [ ] **Step 3: Tambah badge waktu di hero**

Di hero (baris 129-131), tombol "Muat Ulang" saat ini:

```html
                <button class="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/20 transition hover:bg-white/25" @click="loadData()">
                    <i class="bi bi-arrow-clockwise"></i>Muat Ulang
                </button>
```

Tambahkan badge sebelum tombol tersebut (di dalam `<div class="mb-6 flex flex-wrap items-center gap-4 ...">`):

```html
                <span v-if="loadTimeMs" class="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white/90 ring-1 ring-white/20">
                    <i class="bi bi-stopwatch"></i>Dimuat dalam {{ (loadTimeMs / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) }} dtk
                </span>
```

- [ ] **Step 4: Verifikasi sintaks inline script**

```bash
python3 - <<'PY'
import re
html = open('new-code1/pages/detail-laporan.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/detail_laporan_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/check/detail_laporan_inline.js
```

Expected: exit 0 tanpa output.

- [ ] **Step 5: Commit**

```bash
git add new-code1/pages/detail-laporan.html
git commit -m "feat(laporan): measure and display data load time in hero badge"
```

---

### Task 3: Client — skeleton per tab menggantikan overlay penuh

**Files:**
- Modify: `new-code1/pages/detail-laporan.html:47-58` (hapus overlay), `:182-634` (tambah skeleton di tiap section tab), `:178-180` (`transition name="fade"` — dibiarkan)

**Interfaces:**
- Consumes: state `loading` (sudah ada), `activeTab` (sudah ada), `v-if="activeTab === '...'"` per section (sudah ada).
- Produces: — (perubahan template murni; tidak ada state/method baru)

- [ ] **Step 1: Hapus overlay full-screen**

Hapus seluruh blok overlay (baris 47-58):

```html
        <!-- loading overlay -->
        <transition name="fade">
            <div v-if="loading" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
                <div class="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-lift">
                    <svg class="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    <span class="text-sm font-semibold text-slate-700">Memuat data...</span>
                </div>
            </div>
        </transition>
```

- [ ] **Step 2: Skeleton tab REKAP**

Di dalam `<section v-if="activeTab === 'rekap'" class="space-y-6">` (baris 182), tambahkan di baris paling atas section (sebelum grid kartu), blok skeleton yang hanya tampil saat loading:

```html
                    <section v-if="activeTab === 'rekap'" class="space-y-6">
                        <div v-if="loading" class="space-y-6">
                            <div class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                                <div v-for="i in 6" :key="i" class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                                    <div class="mb-3 h-9 w-9 animate-pulse rounded-xl bg-slate-200/70"></div>
                                    <div class="h-4 w-2/3 animate-pulse rounded bg-slate-200/70"></div>
                                    <div class="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-200/70"></div>
                                </div>
                            </div>
                            <div class="grid gap-4 lg:grid-cols-2">
                                <div class="h-64 animate-pulse rounded-2xl bg-white shadow-soft ring-1 ring-slate-100"></div>
                                <div class="h-64 animate-pulse rounded-2xl bg-white shadow-soft ring-1 ring-slate-100"></div>
                            </div>
                            <div class="h-64 animate-pulse rounded-2xl bg-white shadow-soft ring-1 ring-slate-100"></div>
                        </div>
                        <template v-else>
                        <div class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
```

Kemudian tambahkan `</template>` tepat di atas baris penutup section rekap (`</section>` pada baris 333). Hasil akhir di area itu:

```html
                            <div class="h-64 animate-pulse rounded-2xl bg-white shadow-soft ring-1 ring-slate-100"></div>
                        </template>
                    </section>
```

- [ ] **Step 3: Skeleton tab DOSEN**

Di dalam `<section v-if="activeTab === 'dosen'" class="space-y-4">` (baris 336), tambahkan di baris paling atas:

```html
                    <section v-if="activeTab === 'dosen'" class="space-y-4">
                        <div v-if="loading" class="space-y-4">
                            <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                                <div class="grid gap-3 md:grid-cols-12">
                                    <div v-for="i in 4" :key="i" class="h-10 animate-pulse rounded-xl bg-slate-200/70 md:col-span-3"></div>
                                </div>
                            </div>
                            <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                                <div class="mb-4 h-4 w-48 animate-pulse rounded bg-slate-200/70"></div>
                                <div v-for="i in 5" :key="i" class="mb-2 h-8 animate-pulse rounded-xl bg-slate-200/70"></div>
                            </div>
                        </div>
                        <template v-else>
                        <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
```

Tutup `</template>` tepat di atas penutup `</section>` dosen (baris 461), sehingga pola sama seperti tab rekap: `</template>` lalu `</section>`.

- [ ] **Step 4: Skeleton tab BAGIAN**

Di dalam `<section v-if="activeTab === 'bagian'" class="space-y-4">` (baris 464), tambahkan:

```html
                    <section v-if="activeTab === 'bagian'" class="space-y-4">
                        <div v-if="loading" class="space-y-4">
                            <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                                <div class="grid gap-3 md:grid-cols-12">
                                    <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-xl bg-slate-200/70 md:col-span-4"></div>
                                </div>
                            </div>
                            <div v-for="i in 4" :key="i" class="h-14 animate-pulse rounded-2xl bg-white shadow-soft ring-1 ring-slate-100"></div>
                        </div>
                        <template v-else>
                        <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
```

Tutup `</template>` tepat di atas penutup `</section>` bagian (baris 610).

- [ ] **Step 5: Skeleton tab BA**

Di dalam `<section v-if="activeTab === 'ba'" class="space-y-4">` (baris 613), tambahkan:

```html
                    <section v-if="activeTab === 'ba'" class="space-y-4">
                        <div v-if="loading" class="space-y-4">
                            <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                                <div class="h-10 animate-pulse rounded-xl bg-slate-200/70"></div>
                            </div>
                            <div v-for="i in 4" :key="i" class="space-y-2 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
                                <div class="h-4 w-1/2 animate-pulse rounded bg-slate-200/70"></div>
                                <div class="h-3 w-2/3 animate-pulse rounded bg-slate-200/70"></div>
                            </div>
                        </div>
                        <template v-else>
                        <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
```

Tutup `</template>` tepat di atas penutup `</section>` ba (baris 655).

- [ ] **Step 6: Verifikasi sintaks inline script**

```bash
python3 - <<'PY'
import re
html = open('new-code1/pages/detail-laporan.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
open('/tmp/opencode/check/detail_laporan_inline.js', 'w', encoding='utf-8').write(scripts[-1])
PY
node --check /tmp/opencode/check/detail_laporan_inline.js
```

Expected: exit 0 tanpa output.

- [ ] **Step 7: Verifikasi struktur template (jumlah tag seimbang)**

```bash
python3 - <<'PY'
import re
html = open('new-code1/pages/detail-laporan.html', encoding='utf-8').read()
# balance-check sederhana untuk <template> di dalam tab contents
body = html[html.index('<div :key="activeTab">'):html.index('</main>')]
opens = len(re.findall(r'<template v-else>', body))
print('template opens:', opens)
print('template closes:', body.count('</template>'))
PY
```

Expected: `template opens: 4` dan `template closes: 4` (satu per tab). Jika tidak, perbaiki sebelum commit.

- [ ] **Step 8: Commit**

```bash
git add new-code1/pages/detail-laporan.html
git commit -m "feat(laporan): replace full-screen loading overlay with per-tab skeletons"
```

---

### Task 4: Client — `defer` pada script Vue + verifikasi final

**Files:**
- Modify: `new-code1/pages/detail-laporan.html:662` (tag script Vue)
- Test: `/tmp/opencode/check/detail_laporan_inline.js` (verifikasi sintaks)

**Interfaces:**
- Consumes: `Vue` global (CDN `vue.global.prod.js`), `#app` di body.
- Produces: — (atribut `defer` pada tag script; tidak ada perubahan perilaku — app di-mount setelah parse selesai di `mounted()`).

- [ ] **Step 1: Tambah `defer` pada tag Vue**

Di `new-code1/pages/detail-laporan.html:662`, ubah:

```html
    <script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"></script>
```

menjadi:

```html
    <script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js" defer></script>
```

- [ ] **Step 2: Verifikasi sintaks inline script**

```bash
node --check /tmp/opencode/check/detail_laporan_inline.js
```

(File sudah dibuat di Task 2/3. Jika belum ada, jalankan ulang ekstraksi dari Step 4 Task 2.)

Expected: exit 0 tanpa output.

- [ ] **Step 3: Regresi — pastikan tidak ada referensi ke fungsi yang dihapus**

```bash
rg -n "dosenGroups|toggleDosen|expandedDosen" new-code1/pages/detail-laporan.html || echo "OK: tidak ada referensi fungsi lama"
```

Expected: output `OK: tidak ada referensi fungsi lama` (atau zero match).

- [ ] **Step 4: Regresi — pastikan diff hanya dua file yang diizinkan**

```bash
git diff --stat main...HEAD
```

Expected: hanya `new-code1/1_business.gs` dan `new-code1/pages/detail-laporan.html` (+ file docs/spec/plan yang memang diizinkan). Tidak ada file lain yang berubah.

- [ ] **Step 5: Commit**

```bash
git add new-code1/pages/detail-laporan.html
git commit -m "perf(laporan): defer vue script load"
```

---

## Self-Review

### 1. Spec coverage
- Bagian 1 (server O(n×m)) → Task 1. ✅
- Bagian 2 (ukur & tampilkan waktu) → Task 2. ✅
- Bagian 3 (skeleton per tab) → Task 3. ✅
- Bagian 4 (defer Vue, tanpa cache) → Task 4 (defer) + Global Constraints (tanpa cache). ✅
- Pengujian: verifikasi sintaks (tiap task), simulasi server (Task 1 Step 4), manual (post-deploy, di spec). ✅

### 2. Placeholder scan
Semua step berisi kode lengkap dan perintah eksekusi dengan expected output. Tidak ada "TBD", "implement later", atau "handle edge cases" tanpa kode. ✅

### 3. Type consistency
- State: `loadTimeMs` (number) — didefinisikan Task 2 Step 1, dipakai Task 2 Step 3. Konsisten.
- `loading`, `activeTab` — sudah ada, dipakai skeleton Task 3. Konsisten.
- `getLaporanBootstrap` kontrak respons tidak berubah — Task 1 menjaga ini. ✅
